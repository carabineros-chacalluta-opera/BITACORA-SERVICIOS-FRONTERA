// ============================================================
// SISCOF v3 — Panel de Administración
// Denominadores por cuartel + Cierre mensual IDFI + Config
// ============================================================

function renderAdmin() {
  if (!APP.esAdmin) {
    el('pantalla-admin').innerHTML = `<div class="cargando">SIN ACCESO</div>`; return
  }
  const ahora = new Date()
  el('pantalla-admin').innerHTML = `
    <div class="container" style="max-width:860px">
      <h2 style="font-size:1.4rem;font-weight:700;margin-bottom:1.5rem">Administración del Sistema</h2>

      <!-- ── Denominadores por cuartel ── -->
      <div class="card gap3" style="margin-bottom:1.25rem">
        <div class="sec-titulo">Denominadores e indicadores por cuartel</div>
        <p style="font-size:.8rem;color:var(--muted)">
          Estos valores definen las metas para normalizar cada indicador DFP/DFO.
          Se actualizan cuando cambia la cantidad de puntos territoriales activos.
        </p>
        <div id="denominadores-wrap">
          <div class="cargando" style="padding:1rem">Cargando cuarteles...</div>
        </div>
        <button class="btn btn-primario" onclick="guardarDenominadores()">Guardar denominadores</button>
        <div id="denom-resultado" style="font-size:.82rem;color:var(--muted)"></div>
      </div>

      <!-- ── Cierre mensual IDFI ── -->
      <div class="card gap3" style="margin-bottom:1.25rem">
        <div class="sec-titulo">Cierre mensual IDFI</div>
        <p style="font-size:.82rem;color:var(--muted)">
          Guarda el IDFI calculado del mes en el historial para comparar con el año siguiente.
        </p>
        <div class="g2 gap2">
          <div class="campo"><label>Año</label>
            <input id="admin-anio" type="number" value="${ahora.getFullYear()}" min="2020" max="2099" /></div>
          <div class="campo"><label>Mes</label>
            <select id="admin-mes">
              ${['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
                .map((m,i) => `<option value="${i+1}" ${i+1===ahora.getMonth()?'selected':''}>${m}</option>`).join('')}
            </select></div>
        </div>
        <button class="btn btn-primario" onclick="ejecutarCierreMes()">Guardar IDFI del mes en historial</button>
        <div id="admin-resultado" style="font-size:.82rem;color:var(--muted)"></div>
      </div>

      <!-- ── Configuración de conexión ── -->
      <div class="card gap3">
        <div class="sec-titulo">Configuración del sistema</div>
        <div class="g2 gap">
          <div class="campo"><label>Nombre de la unidad</label>
            <input id="cfg-unidad" type="text" value="${SISCOF_CONFIG.NOMBRE_UNIDAD}" /></div>
          <div class="campo"><label>Nombre de la institución</label>
            <input id="cfg-inst" type="text" value="${SISCOF_CONFIG.NOMBRE_INSTITUCION}" /></div>
        </div>
        <div style="display:flex;gap:.75rem;flex-wrap:wrap">
          <button class="btn btn-secundario" onclick="verificarConexion()">Verificar conexión Supabase</button>
          <button class="btn btn-secundario" onclick="limpiarCacheOffline()">Limpiar cache offline</button>
        </div>
        <div id="cfg-resultado" style="font-size:.82rem;color:var(--muted)"></div>
      </div>
    </div>`

  cargarDenominadores()
}

async function cargarDenominadores() {
  const wrap = el('denominadores-wrap')
  if (!wrap) return
  try {
    const { data: cuarteles } = await APP.sb.from('cuarteles').select('*').eq('activo', true).order('tipo').order('nombre')
    if (!cuarteles?.length) { wrap.innerHTML = '<p style="font-size:.8rem;color:var(--muted)">Sin cuarteles.</p>'; return }
    window._cuartelesAdmin = cuarteles
    wrap.innerHTML = cuarteles.map(c => `
      <div class="denom-card" style="margin-bottom:.75rem">
        <div style="font-size:.82rem;font-weight:700;color:var(--text);margin-bottom:.5rem">${c.nombre}</div>
        <div class="denom-grid">
          <div class="campo"><div class="denom-label">Total Hitos</div>
            <input class="denom-input" type="number" id="d-hitos-${c.id}" value="${c.total_hitos||0}" min="0" /></div>
          <div class="campo"><div class="denom-label">Total PNH</div>
            <input class="denom-input" type="number" id="d-pnh-${c.id}" value="${c.total_pnh||0}" min="0" /></div>
          <div class="campo"><div class="denom-label">Total SIE</div>
            <input class="denom-input" type="number" id="d-sie-${c.id}" value="${c.total_sie||0}" min="0" /></div>
          <div class="campo"><div class="denom-label">Meta UF / período</div>
            <input class="denom-input" type="number" id="d-uf-${c.id}" value="${c.meta_uf_periodo||500}" min="1" /></div>
          <div class="campo"><div class="denom-label">Meta coordinaciones / mes</div>
            <input class="denom-input" type="number" id="d-coord-${c.id}" value="${c.meta_coordinaciones_mes||4}" min="1" /></div>
          <div class="campo"><div class="denom-label">Meta hallazgos / mes</div>
            <input class="denom-input" type="number" id="d-hall-${c.id}" value="${c.meta_hallazgos_mes||4}" min="1" /></div>
          <div class="campo"><div class="denom-label">Meta objetivos int. / período</div>
            <input class="denom-input" type="number" id="d-obj-${c.id}" value="${c.meta_objetivos_int||1}" min="1" /></div>
        </div>
      </div>`).join('')
  } catch(e) { wrap.innerHTML = `<p style="font-size:.8rem;color:var(--rojo)">Error: ${e.message}</p>` }
}

async function guardarDenominadores() {
  const res = el('denom-resultado')
  if (res) res.textContent = 'Guardando...'
  const cuarteles = window._cuartelesAdmin || []
  let ok = 0
  for (const c of cuarteles) {
    const vals = {
      total_hitos:           parseInt(el(`d-hitos-${c.id}`)?.value) || 0,
      total_pnh:             parseInt(el(`d-pnh-${c.id}`)?.value)   || 0,
      total_sie:             parseInt(el(`d-sie-${c.id}`)?.value)   || 0,
      meta_uf_periodo:       parseFloat(el(`d-uf-${c.id}`)?.value)  || 500,
      meta_coordinaciones_mes: parseInt(el(`d-coord-${c.id}`)?.value) || 4,
      meta_hallazgos_mes:    parseInt(el(`d-hall-${c.id}`)?.value)  || 4,
      meta_objetivos_int:    parseInt(el(`d-obj-${c.id}`)?.value)   || 1,
    }
    try {
      const { error } = await APP.sb.from('cuarteles').update(vals).eq('id', c.id)
      if (!error) ok++
    } catch {}
  }
  if (res) res.innerHTML = `<span style="color:var(--verde)">✓ ${ok} cuarteles actualizados correctamente</span>`
  toast('Denominadores guardados', 'ok')
}

async function ejecutarCierreMes() {
  if (!APP.cuartel) { toast('Sin cuartel asignado', 'err'); return }
  const anio = parseInt(el('admin-anio')?.value)
  const mes  = parseInt(el('admin-mes')?.value)
  const res  = el('admin-resultado')
  if (res) res.textContent = 'Calculando...'
  try {
    const r = await cerrarMesIDFI(APP.cuartel.id, anio, mes)
    if (res) res.innerHTML = `<span style="color:var(--verde)">✓ Guardado.</span>
      IDFI ${r.idfi.toFixed(1)}% · DFP ${r.dfp.total.toFixed(1)}% · DFO ${r.dfo.total.toFixed(1)}%`
    toast('IDFI guardado en historial', 'ok')
  } catch(e) {
    if (res) res.textContent = 'Error: ' + e.message
    toast('Error al guardar: ' + e.message, 'err')
  }
}

async function verificarConexion() {
  const res = el('cfg-resultado')
  if (res) res.textContent = 'Verificando...'
  try {
    const { data, error } = await APP.sb.from('cuarteles').select('count').limit(1)
    if (error) throw error
    if (res) res.innerHTML = `<span style="color:var(--verde)">✓ Conexión con Supabase OK</span>`
  } catch(e) {
    if (res) res.innerHTML = `<span style="color:var(--rojo)">✕ Error: ${e.message}</span>`
  }
}

async function limpiarCacheOffline() {
  if (!_db) { toast('IndexedDB no inicializada', 'err'); return }
  try {
    await _db.cache_puntos.clear()
    await _db.cache_personal.clear()
    await _db.cache_vehiculos.clear()
    toast('Cache offline limpiada', 'ok')
  } catch(e) { toast('Error: ' + e.message, 'err') }
}
