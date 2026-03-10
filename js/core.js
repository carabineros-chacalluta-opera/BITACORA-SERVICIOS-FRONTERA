// ============================================================
// SISCOF — Core: Supabase client + estado global + IDFI
// ============================================================

// ── Cliente Supabase ─────────────────────────────────────────
let _sb = null
function getSupabase() {
  if (_sb) return _sb
  if (!SISCOF_CONFIG.SUPABASE_URL || !SISCOF_CONFIG.SUPABASE_ANON_KEY)
    throw new Error('Configure las credenciales en js/config.js')
  _sb = supabase.createClient(SISCOF_CONFIG.SUPABASE_URL, SISCOF_CONFIG.SUPABASE_ANON_KEY)
  return _sb
}

// ── Estado global ────────────────────────────────────────────
const APP = {
  user:    null,
  perfil:  null,
  cuartel: null,
  get sb() { return getSupabase() },
  get esJefe()          { return this.perfil?.rol === SISCOF_CONFIG.ROLES.JEFE_SERVICIO },
  get esAdmin()         { return this.perfil?.rol === SISCOF_CONFIG.ROLES.ADMINISTRADOR },
  get esComisaria()     { return this.perfil?.rol === SISCOF_CONFIG.ROLES.COMISARIA },
  get esPrefectura()    { return this.perfil?.rol === SISCOF_CONFIG.ROLES.PREFECTURA },
  get puedeRegistrar()  { return this.esJefe || this.esAdmin },
  get tieneVisionGlobal(){ return this.esComisaria || this.esPrefectura },
}

// ── Autenticación ────────────────────────────────────────────
async function login(email, password) {
  const { data, error } = await APP.sb.auth.signInWithPassword({ email, password })
  if (error) throw error
  await cargarPerfil(data.user)
  return data.user
}

async function logout() {
  await APP.sb.auth.signOut()
  APP.user = APP.perfil = APP.cuartel = null
  renderLogin()
}

async function cargarPerfil(authUser) {
  APP.user = authUser
  const { data } = await APP.sb
    .from('usuarios')
    .select('*, cuartel:cuarteles(*)')
    .eq('email', authUser.email)
    .single()
  if (data) { APP.perfil = data; APP.cuartel = data.cuartel }
}

async function iniciarSesion() {
  const { data: { session } } = await APP.sb.auth.getSession()
  if (session?.user) { await cargarPerfil(session.user); return true }
  return false
}

// ── Helpers de datos ─────────────────────────────────────────
async function obtenerCuarteles() {
  const { data } = await APP.sb
    .from('cuarteles').select('*')
    .eq('activo', true).order('tipo').order('nombre')
  return data || []
}

async function obtenerCuartelIds() {
  if (APP.tieneVisionGlobal) {
    const c = await obtenerCuarteles(); return c.map(x => x.id)
  }
  return APP.cuartel ? [APP.cuartel.id] : []
}

// ── Dashboard principal ──────────────────────────────────────
async function obtenerDashboard(cuartelIds, filtro) {
  const { inicio, fin, anioActual, mesInicio, mesFin } = calcularFechas(filtro)

  const [
    { data: servicios },
    { data: resultados },
    { data: detenidos },
    { data: especies },
    { data: tareas },
    { data: hallazgos },
    { data: historial },
    { data: histIdfi },
    cuarteles,
  ] = await Promise.all([
    APP.sb.from('servicios').select('id,cuartel_id,fecha,minutos_operativos,km_inicio,km_termino')
      .in('cuartel_id', cuartelIds).eq('estado','enviado').gte('fecha',inicio).lte('fecha',fin),
    APP.sb.from('resultados').select('id,cuartel_id,tipo_delito,tipo_resultado,valor_total_uf,servicio_id')
      .in('cuartel_id', cuartelIds),
    APP.sb.from('detenidos').select('id,cuartel_id,nacionalidad,situacion_migratoria,tiene_alerta_internacional,servicio_id')
      .in('cuartel_id', cuartelIds),
    APP.sb.from('especies').select('id,cuartel_id,tipo,valor_uf,servicio_id')
      .in('cuartel_id', cuartelIds),
    APP.sb.from('tareas').select('id,cuartel_id,tipo,categoria,nivel_coordinacion,cantidad_vehiculos,cantidad_personas,tiene_resultado,servicio_id')
      .in('cuartel_id', cuartelIds),
    APP.sb.from('hallazgos').select('id,cuartel_id,servicio_id')
      .in('cuartel_id', cuartelIds),
    // Historial DFO año anterior — mismos meses
    APP.sb.from('historial_anual').select('*')
      .in('cuartel_id', cuartelIds)
      .eq('anio', anioActual - 1)
      .gte('mes', mesInicio).lte('mes', mesFin),
    // Historial IDFI año anterior — mismos meses
    APP.sb.from('historial_idfi').select('*')
      .in('cuartel_id', cuartelIds)
      .eq('anio', anioActual - 1)
      .gte('mes', mesInicio).lte('mes', mesFin),
    obtenerCuarteles(),
  ])

  const servicioIds = (servicios || []).map(s => s.id)

  // Filtrar por servicioIds para consistencia temporal
  const resMap  = (resultados || []).filter(r => servicioIds.includes(r.servicio_id))
  const detMap  = (detenidos  || []).filter(d => servicioIds.includes(d.servicio_id))
  const espMap  = (especies   || []).filter(e => servicioIds.includes(e.servicio_id))
  const tarMap  = (tareas     || []).filter(t => servicioIds.includes(t.servicio_id))
  const halMap  = (hallazgos  || []).filter(h => servicioIds.includes(h.servicio_id))

  const resumen = cuartelIds.map(cid => {
    const svcs = (servicios || []).filter(s => s.cuartel_id === cid)
    const ress = resMap.filter(r => r.cuartel_id === cid)
    const dets = detMap.filter(d => d.cuartel_id === cid)
    const esps = espMap.filter(e => e.cuartel_id === cid)
    const tars = tarMap.filter(t => t.cuartel_id === cid)
    const hals = halMap.filter(h => h.cuartel_id === cid)
    const hist = (historial || []).filter(h => h.cuartel_id === cid)
    const hidfi= (histIdfi  || []).filter(h => h.cuartel_id === cid)

    // ── Valores actuales DFO (brutos) ──
    const det_total  = dets.length
    const uf_total   = ress.reduce((a,r) => a + (r.valor_total_uf||0), 0)
    const arm_total  = esps.filter(e => e.tipo === 'arma').length
    const serv_total = svcs.length
    const inf_mig    = ress.filter(r => r.tipo_resultado === 'infraccion_migratoria').length
    const docs_falsos= ress.filter(r => r.tipo_resultado === 'documento_falsificado').length
    const obj_int    = dets.filter(d => d.tiene_alerta_internacional).length

    // ── Valores actuales DFP (brutos) ──
    const hitos_vis  = tars.filter(t => t.tipo === 'visita_hito').length
    const pnh_fisc   = tars.filter(t => t.tipo === 'fiscalizacion_pnh').length
    const sie_vis    = tars.filter(t => t.tipo === 'visita_sie').length
    const coords     = tars.filter(t => t.tipo === 'coordinacion')
    const coord_total= coords.length

    // ── Calcular indicadores IDFI ──
    const dfp = calcularDFP(tars, hals, cuarteles.find(c => c.id === cid))
    const dfo = calcularDFO(ress, dets, esps, tars)
    const idfi_actual = calcularIDFI(dfp.total, dfo.total)

    // ── Historial DFO año anterior ──
    const hist_det  = hist.reduce((a,h) => a + (h.detenciones_total||0), 0)
    const hist_uf   = hist.reduce((a,h) => a + (h.valor_uf_total||0), 0)
    const hist_arm  = hist.reduce((a,h) => a + (h.armas_recuperadas||0), 0)
    const hist_serv = hist.reduce((a,h) => a + (h.servicios_desplegados||0), 0)
    const sin_hist  = hist.length === 0

    // ── Historial IDFI año anterior (mismos meses) ──
    const idfi_hist  = hidfi.length ? promedio(hidfi.map(h => h.idfi))     : null
    const dfp_hist   = hidfi.length ? promedio(hidfi.map(h => h.dfp_total)): null
    const dfo_hist   = hidfi.length ? promedio(hidfi.map(h => h.dfo_total)): null
    const dfp01_hist = hidfi.length ? promedio(hidfi.map(h => h.dfp_01))   : null
    const dfp02_hist = hidfi.length ? promedio(hidfi.map(h => h.dfp_02))   : null
    const dfp03_hist = hidfi.length ? promedio(hidfi.map(h => h.dfp_03))   : null
    const dfp04_hist = hidfi.length ? promedio(hidfi.map(h => h.dfp_04))   : null
    const dfp05_hist = hidfi.length ? promedio(hidfi.map(h => h.dfp_05))   : null
    const dfo01_hist = hidfi.length ? promedio(hidfi.map(h => h.dfo_01))   : null
    const dfo02_hist = hidfi.length ? promedio(hidfi.map(h => h.dfo_02))   : null
    const dfo03_hist = hidfi.length ? promedio(hidfi.map(h => h.dfo_03))   : null
    const dfo04_hist = hidfi.length ? promedio(hidfi.map(h => h.dfo_04))   : null
    const dfo05_hist = hidfi.length ? promedio(hidfi.map(h => h.dfo_05))   : null
    const dfo06_hist = hidfi.length ? promedio(hidfi.map(h => h.dfo_06))   : null
    const sin_idfi_hist = hidfi.length === 0

    return {
      cuartel_id: cid,
      cuartel: cuarteles.find(c => c.id === cid),
      // DFO bruto
      detenciones: det_total, uf_incautadas: uf_total,
      armas: arm_total, servicios: serv_total,
      infracciones_migratorias: inf_mig,
      docs_falsificados: docs_falsos,
      obj_internacionales: obj_int,
      // DFP bruto
      hitos_visitados: hitos_vis, pnh_fiscalizados: pnh_fisc,
      sie_visitados: sie_vis, coordinaciones: coord_total,
      hallazgos_registrados: hals.length,
      // IDFI actual
      dfp, dfo, idfi_actual,
      // Comparativa DFO año anterior
      hist_det, hist_uf, hist_arm, hist_serv, sin_hist,
      var_det:  det_total  - hist_det,
      var_uf:   uf_total   - hist_uf,
      var_arm:  arm_total  - hist_arm,
      var_serv: serv_total - hist_serv,
      // Comparativa IDFI año anterior
      idfi_hist, dfp_hist, dfo_hist, sin_idfi_hist,
      dfp01_hist, dfp02_hist, dfp03_hist, dfp04_hist, dfp05_hist,
      dfo01_hist, dfo02_hist, dfo03_hist, dfo04_hist, dfo05_hist, dfo06_hist,
    }
  })

  // Totales consolidados
  const totales = resumen.reduce((acc, r) => ({
    detenciones:   acc.detenciones   + r.detenciones,
    uf_incautadas: acc.uf_incautadas + r.uf_incautadas,
    armas:         acc.armas         + r.armas,
    servicios:     acc.servicios     + r.servicios,
    hist_det:      acc.hist_det      + r.hist_det,
    hist_uf:       acc.hist_uf       + r.hist_uf,
    hist_arm:      acc.hist_arm      + r.hist_arm,
    hist_serv:     acc.hist_serv     + r.hist_serv,
    sin_hist:      acc.sin_hist      || r.sin_hist,
    idfi_actual:   acc.idfi_actual   + r.idfi_actual,
    idfi_hist_sum: acc.idfi_hist_sum + (r.idfi_hist || 0),
    sin_idfi_hist: acc.sin_idfi_hist || r.sin_idfi_hist,
    n: acc.n + 1,
  }), {
    detenciones:0, uf_incautadas:0, armas:0, servicios:0,
    hist_det:0, hist_uf:0, hist_arm:0, hist_serv:0, sin_hist:false,
    idfi_actual:0, idfi_hist_sum:0, sin_idfi_hist:false, n:0,
  })

  totales.idfi_prom = totales.n > 0 ? totales.idfi_actual / totales.n : 0
  totales.idfi_hist_prom = totales.n > 0 ? totales.idfi_hist_sum / totales.n : 0

  return { resumen, totales, cuarteles, periodo: { inicio, fin } }
}

// ── CÁLCULO IDFI ────────────────────────────────────────────

function calcularDFP(tars, hals, cuartel) {
  const p = SISCOF_CONFIG.DFP_PESOS
  const pc = SISCOF_CONFIG.PESOS_COORDINACION

  // DFP-01: Hitos visitados
  const hitos_vis = tars.filter(t => t.tipo === 'visita_hito').length
  const meta_hitos = Math.max(cuartel?.total_hitos || 5, 1)
  const dfp01 = Math.min((hitos_vis / meta_hitos) * 100, 100)

  // DFP-02: PNH fiscalizados
  const pnh_fisc = tars.filter(t => t.tipo === 'fiscalizacion_pnh').length
  const meta_pnh = Math.max(cuartel?.total_pnh || 3, 1)
  const dfp02 = Math.min((pnh_fisc / meta_pnh) * 100, 100)

  // DFP-03: SIE visitados
  const sie_vis = tars.filter(t => t.tipo === 'visita_sie').length
  const meta_sie = Math.max(cuartel?.total_sie || 2, 1)
  const dfp03 = Math.min((sie_vis / meta_sie) * 100, 100)

  // DFP-04: Coordinaciones ponderadas por nivel
  const coords = tars.filter(t => t.tipo === 'coordinacion')
  const score_coords = coords.reduce((a, c) => a + (pc[c.nivel_coordinacion] || 1), 0)
  const meta_coord = (SISCOF_CONFIG.META_COORDINACIONES_MES || 4) * pc.alto
  const dfp04 = Math.min((score_coords / meta_coord) * 100, 100)

  // DFP-05: Producción de inteligencia (hallazgos)
  const meta_hall = SISCOF_CONFIG.META_HALLAZGOS_MES || 4
  const dfp05 = Math.min((hals.length / meta_hall) * 100, 100)

  const total = (dfp01 * p.dfp01) + (dfp02 * p.dfp02) + (dfp03 * p.dfp03)
              + (dfp04 * p.dfp04) + (dfp05 * p.dfp05)

  return { dfp01, dfp02, dfp03, dfp04, dfp05, total }
}

function calcularDFO(ress, dets, esps, tars) {
  const p = SISCOF_CONFIG.DFO_PESOS

  const total_ctrl = Math.max(
    tars.reduce((a, t) => a + (t.cantidad_vehiculos||0) + (t.cantidad_personas||0), 0), 1
  )
  const total_proc = Math.max(ress.length, 1)

  // DFO-01: Eficacia controles (con resultado / total controles)
  const con_res = tars.filter(t => t.tiene_resultado).length
  const dfo01 = Math.min((con_res / total_ctrl) * 100, 100)

  // DFO-02: Documentación falsificada
  const docs = ress.filter(r => r.tipo_resultado === 'documento_falsificado').length
  const dfo02 = Math.min((docs / total_ctrl) * 100, 100)

  // DFO-03: Control migratorio
  const inf_mig = ress.filter(r => r.tipo_resultado === 'infraccion_migratoria').length
  const det_irr = dets.filter(d => d.situacion_migratoria === 'irregular').length
  const dfo03 = Math.min(((inf_mig + det_irr) / total_ctrl) * 100, 100)

  // DFO-04: Interdicción CT
  const ct = ress.filter(r => SISCOF_CONFIG.DELITOS_CT.includes(r.tipo_delito)).length
  const dfo04 = Math.min((ct / total_proc) * 100, 100)

  // DFO-05: Impacto económico UF (normalizado sobre meta)
  const uf = esps.reduce((a, e) => a + (e.valor_uf||0), 0)
    + ress.reduce((a, r) => a + (r.valor_total_uf||0), 0)
  const dfo05 = Math.min((uf / (SISCOF_CONFIG.META_UF_PERIODO || 500)) * 100, 100)

  // DFO-06: Objetivos internacionales
  const obj_int = dets.filter(d => d.tiene_alerta_internacional).length
  const dfo06 = Math.min(
    (obj_int / (SISCOF_CONFIG.META_OBJETIVOS_INT_PERIODO || 1)) * 100, 100
  )

  const total = (dfo01 * p.dfo01) + (dfo02 * p.dfo02) + (dfo03 * p.dfo03)
              + (dfo04 * p.dfo04) + (dfo05 * p.dfo05) + (dfo06 * p.dfo06)

  return { dfo01, dfo02, dfo03, dfo04, dfo05, dfo06, uf_total: uf, total }
}

function calcularIDFI(dfp, dfo) {
  const p = SISCOF_CONFIG.IDFI_PESOS
  return (dfp * p.dfp) + (dfo * p.dfo)
}

// ── Guardar historial IDFI al cerrar mes ─────────────────────
async function cerrarMesIDFI(cuartelId, anio, mes) {
  const inicio = `${anio}-${String(mes).padStart(2,'0')}-01`
  const lastDay = new Date(anio, mes, 0).getDate()
  const fin = `${anio}-${String(mes).padStart(2,'0')}-${lastDay}`

  const [{ data: svcs }] = await Promise.all([
    APP.sb.from('servicios').select('id')
      .eq('cuartel_id', cuartelId).eq('estado','enviado')
      .gte('fecha', inicio).lte('fecha', fin)
  ])
  const svcIds = (svcs || []).map(s => s.id)
  if (!svcIds.length) return

  const [
    { data: ress }, { data: dets }, { data: esps },
    { data: tars }, { data: hals }
  ] = await Promise.all([
    APP.sb.from('resultados').select('*').in('servicio_id', svcIds),
    APP.sb.from('detenidos').select('*').in('servicio_id', svcIds),
    APP.sb.from('especies').select('*').in('servicio_id', svcIds),
    APP.sb.from('tareas').select('*').in('servicio_id', svcIds),
    APP.sb.from('hallazgos').select('*').in('servicio_id', svcIds),
  ])

  const cuartel = APP.cuartel
  const dfp = calcularDFP(tars||[], hals||[], cuartel)
  const dfo = calcularDFO(ress||[], dets||[], esps||[], tars||[])
  const idfi_val = calcularIDFI(dfp.total, dfo.total)

  const nivel = idfiLabel(idfi_val).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')

  const { error } = await APP.sb.from('historial_idfi').upsert({
    cuartel_id: cuartelId, anio, mes,
    dfp_01: dfp.dfp01, dfp_02: dfp.dfp02, dfp_03: dfp.dfp03,
    dfp_04: dfp.dfp04, dfp_05: dfp.dfp05, dfp_total: dfp.total,
    dfo_01: dfo.dfo01, dfo_02: dfo.dfo02, dfo_03: dfo.dfo03,
    dfo_04: dfo.dfo04, dfo_05: dfo.dfo05, dfo_06: dfo.dfo06,
    dfo_total: dfo.total,
    idfi: idfi_val, nivel,
  })
  if (error) throw error
  return { dfp, dfo, idfi: idfi_val, nivel }
}

// ── Fechas ───────────────────────────────────────────────────
function calcularFechas(filtro) {
  const hoy = new Date()
  const fin = hoy.toISOString().split('T')[0]
  let inicio
  if (filtro === '7dias')  inicio = new Date(hoy - 7  * 864e5).toISOString().split('T')[0]
  if (filtro === '28dias') inicio = new Date(hoy - 28 * 864e5).toISOString().split('T')[0]
  if (filtro === 'anio')   inicio = `${hoy.getFullYear()}-01-01`
  if (!inicio) inicio = new Date(hoy - 28 * 864e5).toISOString().split('T')[0]
  const mesInicio = Number(inicio.split('-')[1])
  const mesFin    = Number(fin.split('-')[1])
  return { inicio, fin, anioActual: hoy.getFullYear(), mesInicio, mesFin }
}

// ── Helpers matemáticos ──────────────────────────────────────
function promedio(arr) {
  if (!arr || !arr.length) return 0
  return arr.reduce((a, b) => a + (b || 0), 0) / arr.length
}

// ── Utilidades UI ────────────────────────────────────────────
function el(id) { return document.getElementById(id) }
function html(id, content) { const e = el(id); if (e) e.innerHTML = content }
function show(id) { const e = el(id); if (e) e.style.display = '' }
function hide(id) { const e = el(id); if (e) e.style.display = 'none' }

function idfiColor(val) {
  const n = SISCOF_CONFIG.IDFI_NIVELES
  if (val >= n.OPTIMO.min)    return n.OPTIMO.color
  if (val >= n.ADECUADO.min)  return n.ADECUADO.color
  if (val >= n.DEFICIENTE.min)return n.DEFICIENTE.color
  return n.CRITICO.color
}
function idfiLabel(val) {
  const n = SISCOF_CONFIG.IDFI_NIVELES
  if (val >= n.OPTIMO.min)    return n.OPTIMO.label
  if (val >= n.ADECUADO.min)  return n.ADECUADO.label
  if (val >= n.DEFICIENTE.min)return n.DEFICIENTE.label
  return n.CRITICO.label
}
function idfiColorBg(val) {
  if (val >= 90) return '#e8f5ea'
  if (val >= 70) return '#fffbea'
  if (val >= 50) return '#fff4ec'
  return '#fff0f1'
}

function varHtml(variacion, sinDato, sufijo = '') {
  if (sinDato || variacion === null || variacion === undefined)
    return `<span class="sin-dato">Sin dato año ant.</span>`
  const color  = variacion >= 0 ? '#1a6b2a' : '#d70015'
  const flecha = variacion >= 0 ? '▲' : '▼'
  const val    = typeof variacion === 'number' && !Number.isInteger(variacion)
    ? variacion.toFixed(1) : variacion
  return `<span style="color:${color};font-weight:600">${flecha} ${variacion >= 0 ? '+' : ''}${val}${sufijo}</span>`
}

function pctHtml(actual, hist) {
  if (!hist || hist === 0) return ''
  const pct = ((actual - hist) / hist * 100).toFixed(1)
  const color = pct >= 0 ? '#1a6b2a' : '#d70015'
  return `<span style="color:${color};font-size:.68rem">(${pct >= 0 ? '+' : ''}${pct}%)</span>`
}

function toast(msg, tipo = 'ok') {
  const t = document.createElement('div')
  t.className = `toast toast-${tipo}`
  t.innerHTML = `<span>${tipo === 'ok' ? '✓' : '✕'}</span> ${msg}`
  document.body.appendChild(t)
  setTimeout(() => t.remove(), 3500)
}

// Barra de progreso visual
function barraProgreso(valor, color, fondo = '#e8e8ed') {
  const pct = Math.min(Math.max(valor || 0, 0), 100).toFixed(1)
  return `
    <div style="height:5px;background:${fondo};border-radius:3px;overflow:hidden;margin-top:4px">
      <div style="height:100%;width:${pct}%;background:${color};border-radius:3px;transition:width .4s ease"></div>
    </div>`
}
