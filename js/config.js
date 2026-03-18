// ============================================================
// SISCOF — CONFIGURACIÓN CENTRAL
// Prefectura Arica Nro. 1 · Carabineros de Chile
// ============================================================

const SISCOF_CONFIG = {

  // ── SUPABASE ─────────────────────────────────────────────
  SUPABASE_URL:      'https://jsojspuccytzvlzxabvb.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impzb2pzcHVjY3l0enZsenhhYnZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzcwOTUsImV4cCI6MjA4ODcxMzA5NX0.lsPnNuZqjNxfAsiWjhjGHc7QlQZ_GfMfRWhURKDVNPI',

  // ── SISTEMA ──────────────────────────────────────────────
  NOMBRE_SISTEMA:     'SISCOF',
  NOMBRE_UNIDAD:      'Prefectura Arica Nro. 1',
  NOMBRE_INSTITUCION: 'Carabineros de Chile',

  // ── ROLES ────────────────────────────────────────────────
  ROLES: {
    JEFE_SERVICIO: 'jefe_servicio',
    ADMINISTRADOR: 'administrador',
    COMISARIA:     'comisaria',
    PREFECTURA:    'prefectura',
  },

  // ── ALERTAS ──────────────────────────────────────────────
  HORAS_ALERTA_SIN_REGISTRO: 24,

  // ── FVC PESOS ────────────────────────────────────────────
  FVC_PESOS: {
    actividad:         0.40,
    inteligencia:      0.30,
    estacionalidad:    0.20,
    valor_estrategico: 0.10,
  },

  // ── IDFI PESOS (Informe Técnico Nro. 01/2026) ────────────
  IDFI_PESOS: {
    dfp: 0.40,
    dfo: 0.60,
  },

  // ── PESOS DFP (suma = 1.0) ───────────────────────────────
  DFP_PESOS: {
    dfp01: 0.25,   // Hitos Fronterizos
    dfp02: 0.30,   // PNH
    dfp03: 0.15,   // SIE
    dfp04: 0.15,   // Coordinación Internacional
    dfp05: 0.15,   // Producción de Inteligencia
  },

  // ── PESOS DFO (suma = 1.0) ───────────────────────────────
  DFO_PESOS: {
    dfo01: 0.15,   // Eficacia de Controles
    dfo02: 0.10,   // Documentación Falsificada
    dfo03: 0.15,   // Control Migratorio
    dfo04: 0.30,   // Interdicción CT
    dfo05: 0.15,   // Impacto Económico UF
    dfo06: 0.15,   // Objetivos Internacionales
  },

  // ── COORDINACIÓN — pesos por nivel ──────────────────────
  PESOS_COORDINACION: { alto: 3, medio: 2, bajo: 1 },

  // ── DELITOS CT (Crimen Transnacional) ────────────────────
  DELITOS_CT: [
    'trafico_drogas', 'trafico_migrantes', 'trata_personas',
    'contrabando', 'armas', 'abigeato', 'falsificacion',
    'receptacion', 'cohecho',
  ],

  // ── METAS POR PERÍODO ────────────────────────────────────
  META_UF_PERIODO:            500,   // UF — normaliza DFO-05
  META_HALLAZGOS_MES:         4,     // reportes — normaliza DFP-05
  META_COORDINACIONES_MES:    4,     // coordinaciones
  META_OBJETIVOS_INT_PERIODO: 1,     // DFO-06

  // ── UMBRALES IDFI (Informe Técnico Nro. 01/2026) ─────────
  IDFI_NIVELES: {
    OPTIMO:    { min: 90, color: '#1a6b2a', label: 'ÓPTIMO'    },
    ADECUADO:  { min: 70, color: '#9a6e00', label: 'ADECUADO'  },
    DEFICIENTE:{ min: 50, color: '#c45000', label: 'DEFICIENTE'},
    CRITICO:   { min: 0,  color: '#d70015', label: 'CRÍTICO'   },
  },

}

if (!SISCOF_CONFIG.SUPABASE_URL || !SISCOF_CONFIG.SUPABASE_ANON_KEY) {
  console.warn('[SISCOF] Credenciales de Supabase no configuradas.')
}

// ── v3: Umbral DFO para diagnóstico 2x2 (configurable) ──────
SISCOF_CONFIG.DFO_UMBRAL_DIAGNOSTICO = 15  // % mínimo para considerar DFO "alto"

// ── v3: Umbrales diagnóstico documentados (IT 01/2026) ───────
SISCOF_CONFIG.DFP_UMBRAL_DIAGNOSTICO = 70  // % mínimo DFP "alta cobertura"
