// ============================================================
// SISCOF v3 — Motor de cálculo IDFI
// Unificado cliente/servidor. Corrige bugs de v2:
//   - DFP deduplica punto_id (igual que SQL DISTINCT)
//   - DFO-06 usa meta configurable (no hardcodeado /1)
//   - DFO-01 solo tareas operativas en denominador
// ============================================================

function calcularDFP(tars, hals, cuartel) {
  const p  = SISCOF_CONFIG.DFP_PESOS
  const pc = SISCOF_CONFIG.PESOS_COORDINACION

  // ── DFP-01: Hitos visitados (DISTINCT punto_id) ──
  const hitos_ids  = new Set(tars.filter(t => t.tipo === 'visita_hito' && t.punto_id).map(t => t.punto_id))
  const meta_hitos = Math.max(cuartel?.total_hitos || 5, 1)
  const dfp01 = Math.min((hitos_ids.size / meta_hitos) * 100, 100)

  // ── DFP-02: PNH fiscalizados (DISTINCT punto_id) ──
  const pnh_ids  = new Set(tars.filter(t => t.tipo === 'fiscalizacion_pnh' && t.punto_id).map(t => t.punto_id))
  const meta_pnh = Math.max(cuartel?.total_pnh || 3, 1)
  const dfp02 = Math.min((pnh_ids.size / meta_pnh) * 100, 100)

  // ── DFP-03: SIE visitados (DISTINCT punto_id) ──
  const sie_ids  = new Set(tars.filter(t => t.tipo === 'visita_sie' && t.punto_id).map(t => t.punto_id))
  const meta_sie = Math.max(cuartel?.total_sie || 2, 1)
  const dfp03 = Math.min((sie_ids.size / meta_sie) * 100, 100)

  // ── DFP-04: Coordinaciones ponderadas ──
  const coords = tars.filter(t => t.tipo === 'coordinacion')
  const score_coords = coords.reduce((a, c) => a + (pc[c.nivel_coordinacion] || 1), 0)
  const meta_coord = (SISCOF_CONFIG.META_COORDINACIONES_MES || 4) * pc.alto
  const dfp04 = Math.min((score_coords / meta_coord) * 100, 100)

  // ── DFP-05: Producción de inteligencia ──
  const meta_hall = SISCOF_CONFIG.META_HALLAZGOS_MES || 4
  const dfp05 = Math.min((hals.length / meta_hall) * 100, 100)

  const total = (dfp01 * p.dfp01) + (dfp02 * p.dfp02) + (dfp03 * p.dfp03)
              + (dfp04 * p.dfp04) + (dfp05 * p.dfp05)

  return {
    dfp01, dfp02, dfp03, dfp04, dfp05, total,
    // brutos para KPIs
    hitos_visitados:   hitos_ids.size,
    pnh_fiscalizados:  pnh_ids.size,
    sie_visitados:     sie_ids.size,
    coordinaciones:    coords.length,
  }
}

function calcularDFO(ress, dets, esps, tars, cuartel) {
  const p = SISCOF_CONFIG.DFO_PESOS

  // Denominador: SOLO tareas operativas
  const tars_op = tars.filter(t => t.categoria === 'operativa')
  const total_ctrl = Math.max(
    tars_op.reduce((a, t) => a + (t.cantidad_vehiculos || 0) + (t.cantidad_personas || 0), 0), 1
  )
  const total_proc = Math.max(ress.length, 1)

  // ── DFO-01: Eficacia controles ──
  const con_res = tars.filter(t => t.tiene_resultado).length
  const dfo01 = Math.min((con_res / total_ctrl) * 100, 100)

  // ── DFO-02: Documentación falsificada ──
  const docs = ress.filter(r => r.tipo_resultado === 'documento_falsificado').length
  const dfo02 = Math.min((docs / total_ctrl) * 100, 100)

  // ── DFO-03: Control migratorio ──
  const inf_mig = ress.filter(r => r.tipo_resultado === 'infraccion_migratoria').length
  const det_irr = dets.filter(d => d.situacion_migratoria === 'irregular').length
  const dfo03 = Math.min(((inf_mig + det_irr) / total_ctrl) * 100, 100)

  // ── DFO-04: Interdicción CT ──
  const ct = ress.filter(r => SISCOF_CONFIG.DELITOS_CT.includes(r.tipo_delito)).length
  const dfo04 = Math.min((ct / total_proc) * 100, 100)

  // ── DFO-05: Impacto económico UF ──
  const uf = esps.reduce((a, e) => a + (e.valor_uf || 0), 0)
           + ress.reduce((a, r) => a + (r.valor_total_uf || 0), 0)
  const dfo05 = Math.min((uf / (SISCOF_CONFIG.META_UF_PERIODO || 500)) * 100, 100)

  // ── DFO-06: Objetivos internacionales (meta configurable) ──
  const obj_int   = dets.filter(d => d.tiene_alerta_internacional).length
  const meta_oi   = Math.max(cuartel?.meta_objetivos_int || SISCOF_CONFIG.META_OBJETIVOS_INT_PERIODO || 1, 1)
  const dfo06 = Math.min((obj_int / meta_oi) * 100, 100)

  const total = (dfo01 * p.dfo01) + (dfo02 * p.dfo02) + (dfo03 * p.dfo03)
              + (dfo04 * p.dfo04) + (dfo05 * p.dfo05) + (dfo06 * p.dfo06)

  return { dfo01, dfo02, dfo03, dfo04, dfo05, dfo06, uf_total: uf, total }
}

function calcularIDFI(dfp, dfo) {
  const p = SISCOF_CONFIG.IDFI_PESOS
  return (dfp * p.dfp) + (dfo * p.dfo)
}

// ── Diagnóstico 2×2 con umbrales documentados ───────────────
function calcularDiagnostico(dfp, dfo) {
  const umbralDFP = SISCOF_CONFIG.DFP_UMBRAL_DIAGNOSTICO || 70
  const umbralDFO = SISCOF_CONFIG.DFO_UMBRAL_DIAGNOSTICO || 15
  const dfpAlta = dfp >= umbralDFP
  const dfoAlta = dfo >= umbralDFO
  if (dfpAlta && dfoAlta)   return { texto: 'Territorio disputado — Alta presión delictual', color: '#d70015', bg: '#fff0f1', dfpAlta, dfoAlta }
  if (dfpAlta && !dfoAlta)  return { texto: '★ Disuasión efectiva — Escenario óptimo',       color: '#1a6b2a', bg: '#e8f5ea', dfpAlta, dfoAlta }
  if (!dfpAlta && dfoAlta)  return { texto: 'Reacción tardía — Inteligencia externa',          color: '#c45000', bg: '#fff4ec', dfpAlta, dfoAlta }
  return                           { texto: '⚠ Abandono territorial — CRISIS',                color: '#d70015', bg: '#fff0f1', dfpAlta, dfoAlta }
}
