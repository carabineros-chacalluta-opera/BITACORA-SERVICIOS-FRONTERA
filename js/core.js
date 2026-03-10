// ============================================================
// SISCOF — Core: Supabase client + estado global
// ============================================================

// ── Cliente Supabase (cargado desde CDN en index.html) ──────
let _sb = null
function getSupabase() {
  if (_sb) return _sb
  if (!SISCOF_CONFIG.SUPABASE_URL || !SISCOF_CONFIG.SUPABASE_ANON_KEY) {
    throw new Error('Configure las credenciales en js/config.js')
  }
  _sb = supabase.createClient(SISCOF_CONFIG.SUPABASE_URL, SISCOF_CONFIG.SUPABASE_ANON_KEY)
  return _sb
}

// ── Estado global de la sesión ───────────────────────────────
const APP = {
  user:    null,
  perfil:  null,
  cuartel: null,

  get sb() { return getSupabase() },

  get esJefe()       { return this.perfil?.rol === SISCOF_CONFIG.ROLES.JEFE_SERVICIO },
  get esAdmin()      { return this.perfil?.rol === SISCOF_CONFIG.ROLES.ADMINISTRADOR },
  get esComisaria()  { return this.perfil?.rol === SISCOF_CONFIG.ROLES.COMISARIA },
  get esPrefectura() { return this.perfil?.rol === SISCOF_CONFIG.ROLES.PREFECTURA },
  get puedeRegistrar(){ return this.esJefe || this.esAdmin },
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
  APP.user    = null
  APP.perfil  = null
  APP.cuartel = null
  renderLogin()
}

async function cargarPerfil(authUser) {
  APP.user = authUser
  const { data } = await APP.sb
    .from('usuarios')
    .select('*, cuartel:cuarteles(*)')
    .eq('email', authUser.email)
    .single()
  if (data) {
    APP.perfil  = data
    APP.cuartel = data.cuartel
  }
}

async function iniciarSesion() {
  const { data: { session } } = await APP.sb.auth.getSession()
  if (session?.user) {
    await cargarPerfil(session.user)
    return true
  }
  return false
}

// ── Helpers de datos ─────────────────────────────────────────
async function obtenerCuarteles() {
  const { data } = await APP.sb
    .from('cuarteles')
    .select('*')
    .eq('activo', true)
    .order('tipo').order('nombre')
  return data || []
}

async function obtenerCuartelIds() {
  if (APP.tieneVisionGlobal) {
    const cuarteles = await obtenerCuarteles()
    return cuarteles.map(c => c.id)
  }
  return APP.cuartel ? [APP.cuartel.id] : []
}

async function obtenerDashboard(cuartelIds, filtro) {
  const { inicio, fin, anioActual, mesInicio, mesFin } = calcularFechas(filtro)

  const [
    { data: servicios },
    { data: resultados },
    { data: detenidos },
    { data: especies },
    { data: tareas },
    { data: historial },
    cuarteles
  ] = await Promise.all([
    APP.sb.from('servicios').select('id,cuartel_id,fecha,minutos_operativos,km_inicio,km_termino')
      .in('cuartel_id', cuartelIds).eq('estado','enviado').gte('fecha', inicio).lte('fecha', fin),
    APP.sb.from('resultados').select('id,cuartel_id,tipo_delito,tipo_resultado,valor_total_uf,servicio_id')
      .in('cuartel_id', cuartelIds),
    APP.sb.from('detenidos').select('id,cuartel_id,nacionalidad,servicio_id')
      .in('cuartel_id', cuartelIds),
    APP.sb.from('especies').select('id,cuartel_id,tipo,valor_uf,servicio_id')
      .in('cuartel_id', cuartelIds),
    APP.sb.from('tareas').select('id,cuartel_id,tipo,categoria,nivel_coordinacion,servicio_id')
      .in('cuartel_id', cuartelIds),
    APP.sb.from('historial_anual').select('*')
      .in('cuartel_id', cuartelIds)
      .eq('anio', anioActual - 1)
      .gte('mes', mesInicio).lte('mes', mesFin),
    obtenerCuarteles(),
  ])

  const servicioIds = (servicios || []).map(s => s.id)

  // Filtrar por servicio_id para consistencia temporal
  const resMap = (resultados || []).filter(r => servicioIds.includes(r.servicio_id))
  const detMap = (detenidos  || []).filter(d => servicioIds.includes(d.servicio_id))
  const espMap = (especies   || []).filter(e => servicioIds.includes(e.servicio_id))
  const tarMap = (tareas     || []).filter(t => servicioIds.includes(t.servicio_id))

  const resumen = cuartelIds.map(cid => {
    const svcs = (servicios || []).filter(s => s.cuartel_id === cid)
    const ress = resMap.filter(r => r.cuartel_id === cid)
    const dets = detMap.filter(d => d.cuartel_id === cid)
    const esps = espMap.filter(e => e.cuartel_id === cid)
    const tars = tarMap.filter(t => t.cuartel_id === cid)
    const hist = (historial || []).filter(h => h.cuartel_id === cid)

    const det_total = dets.length
    const uf_total  = ress.reduce((a, r) => a + (r.valor_total_uf || 0), 0)
    const arm_total = esps.filter(e => e.tipo === 'arma').length
    const serv_total= svcs.length

    const hist_det  = hist.reduce((a,h) => a + (h.detenciones_total || 0), 0)
    const hist_uf   = hist.reduce((a,h) => a + (h.valor_uf_total    || 0), 0)
    const hist_arm  = hist.reduce((a,h) => a + (h.armas_recuperadas || 0), 0)
    const hist_serv = hist.reduce((a,h) => a + (h.servicios_desplegados || 0), 0)
    const sin_hist  = hist.length === 0

    return {
      cuartel_id: cid,
      cuartel: cuarteles.find(c => c.id === cid),
      detenciones: det_total, uf_incautadas: uf_total, armas: arm_total, servicios: serv_total,
      infracciones_migratorias: ress.filter(r => r.tipo_resultado === 'infraccion_migratoria').length,
      docs_falsificados: ress.filter(r => r.tipo_resultado === 'documento_falsificado').length,
      hitos_visitados:  tars.filter(t => t.tipo === 'visita_hito').length,
      pnh_fiscalizados: tars.filter(t => t.tipo === 'fiscalizacion_pnh').length,
      sie_visitados:    tars.filter(t => t.tipo === 'visita_sie').length,
      coordinaciones:   tars.filter(t => t.tipo === 'coordinacion').length,
      hist_det, hist_uf, hist_arm, hist_serv, sin_hist,
      var_det: det_total - hist_det, var_uf: uf_total - hist_uf,
      var_arm: arm_total - hist_arm, var_serv: serv_total - hist_serv,
    }
  })

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
  }), { detenciones:0, uf_incautadas:0, armas:0, servicios:0, hist_det:0, hist_uf:0, hist_arm:0, hist_serv:0, sin_hist:false })

  return { resumen, totales, cuarteles, periodo: { inicio, fin } }
}

function calcularFechas(filtro) {
  const hoy  = new Date()
  const fin  = hoy.toISOString().split('T')[0]
  let inicio
  if (filtro === '7dias')  inicio = new Date(hoy - 7  * 864e5).toISOString().split('T')[0]
  if (filtro === '28dias') inicio = new Date(hoy - 28 * 864e5).toISOString().split('T')[0]
  if (filtro === 'anio')   inicio = `${hoy.getFullYear()}-01-01`
  const mesInicio = Number(inicio.split('-')[1])
  const mesFin    = Number(fin.split('-')[1])
  return { inicio, fin, anioActual: hoy.getFullYear(), mesInicio, mesFin }
}

// ── Utilidades UI ─────────────────────────────────────────────
function el(id) { return document.getElementById(id) }

function html(id, content) {
  const e = el(id)
  if (e) e.innerHTML = content
}

function show(id) { const e = el(id); if (e) e.style.display = '' }
function hide(id) { const e = el(id); if (e) e.style.display = 'none' }

function idfiColor(val) {
  if (val >= 90) return SISCOF_CONFIG.IDFI_NIVELES.OPTIMO.color
  if (val >= 70) return SISCOF_CONFIG.IDFI_NIVELES.ADECUADO.color
  if (val >= 50) return SISCOF_CONFIG.IDFI_NIVELES.DEFICIENTE.color
  return SISCOF_CONFIG.IDFI_NIVELES.CRITICO.color
}

function idfiLabel(val) {
  if (val >= 90) return SISCOF_CONFIG.IDFI_NIVELES.OPTIMO.label
  if (val >= 70) return SISCOF_CONFIG.IDFI_NIVELES.ADECUADO.label
  if (val >= 50) return SISCOF_CONFIG.IDFI_NIVELES.DEFICIENTE.label
  return SISCOF_CONFIG.IDFI_NIVELES.CRITICO.label
}

function varHtml(variacion, sinDato, sufijo = '') {
  if (sinDato) return `<span class="sin-dato">Sin dato año ant.</span>`
  const color = variacion >= 0 ? '#00ff88' : '#ff3b3b'
  const flecha = variacion >= 0 ? '▲' : '▼'
  return `<span style="color:${color}">${flecha} ${variacion >= 0 ? '+' : ''}${typeof variacion === 'number' && !Number.isInteger(variacion) ? variacion.toFixed(0) : variacion}${sufijo}</span>`
}

function toast(msg, tipo = 'ok') {
  const t = document.createElement('div')
  t.className = `toast toast-${tipo}`
  t.textContent = msg
  document.body.appendChild(t)
  setTimeout(() => t.remove(), 3500)
}
