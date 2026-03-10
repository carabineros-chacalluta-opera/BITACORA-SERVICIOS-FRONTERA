// ============================================================
// SISCOF — Dashboard
// ============================================================

let _dashCuartelIds  = []
let _dashCuarteles   = []
let _dashDetalleId   = null

async function renderDashboard() {
  el('pantalla-dashboard').innerHTML = `<div class="cargando">CARGANDO DATOS...</div>`

  // Obtener cuarteles visibles según rol
  _dashCuarteles  = await obtenerCuarteles()
  _dashCuartelIds = _dashCuarteles.map(c => c.id)
  if (!APP.tieneVisionGlobal && APP.cuartel) {
    _dashCuarteles  = [APP.cuartel]
    _dashCuartelIds = [APP.cuartel.id]
  }

  await actualizarDashboard()
}

async function actualizarDashboard() {
  const datos = await obtenerDashboard(_dashCuartelIds, _filtro)

  const tituloRol = APP.esPrefectura ? 'PREFECTURA ARICA NRO. 1'
    : APP.esComisaria ? '4ª COMISARÍA CHACALLUTA'
    : (APP.cuartel?.nombre || '').toUpperCase()

  const subRol = APP.esPrefectura ? `${_dashCuarteles.length} cuarteles · Vista consolidada`
    : APP.esComisaria ? `${_dashCuarteles.length} cuarteles bajo mando`
    : 'Mi cuartel · Vista personal'

  const anioAnt = new Date().getFullYear() - 1

  el('pantalla-dashboard').innerHTML = `
    <div class="container">

      <!-- Header -->
      <div class="flex-sb gap3" style="flex-wrap:wrap;gap:1rem;align-items:flex-start">
        <div>
          <h1 style="font-family:var(--display);font-size:1.9rem;letter-spacing:4px;color:var(--text)">${tituloRol}</h1>
          <p style="font-family:var(--mono);font-size:.68rem;color:var(--muted);letter-spacing:1px;margin-top:4px">${subRol}</p>
        </div>
        <div class="filtros-bar">
          <button class="btn-filtro ${_filtro==='7dias'?'active':''}"  onclick="cambiarFiltro('7dias')">ÚLTIMA SEMANA</button>
          <button class="btn-filtro ${_filtro==='28dias'?'active':''}" onclick="cambiarFiltro('28dias')">ÚLTIMOS 28 DÍAS</button>
          <button class="btn-filtro ${_filtro==='anio'?'active':''}"   onclick="cambiarFiltro('anio')">AÑO A LA FECHA</button>
        </div>
      </div>

      <p class="sin-dato gap2">Comparativa vs mismo período ${anioAnt}</p>

      <!-- Métricas consolidadas -->
      <div class="g4 gap3">
        ${metricaCard('DETENCIONES', datos.totales.detenciones, datos.totales.hist_det, datos.totales.sin_hist, 'var(--red)')}
        ${metricaCard('UF INCAUTADAS', datos.totales.uf_incautadas.toFixed(0), datos.totales.hist_uf.toFixed(0), datos.totales.sin_hist, 'var(--yellow)', ' UF')}
        ${metricaCard('ARMAS RECUPERADAS', datos.totales.armas, datos.totales.hist_arm, datos.totales.sin_hist, 'var(--blue)')}
        ${metricaCard('SERVICIOS REGISTRADOS', datos.totales.servicios, datos.totales.hist_serv, datos.totales.sin_hist, 'var(--green)')}
      </div>

      <!-- Alertas -->
      ${alertasHtml(datos.resumen)}

      <!-- Vista según rol -->
      ${APP.tieneVisionGlobal
        ? tablaCuartelesHtml(datos.resumen, datos.cuarteles)
        : detalleCuartelHtml(datos.resumen[0], APP.cuartel)
      }

    </div>
  `
}

async function cambiarFiltro(f) {
  _filtro = f
  el('pantalla-dashboard').innerHTML = `<div class="cargando">ACTUALIZANDO...</div>`
  await actualizarDashboard()
}

// ── Métricas ─────────────────────────────────────────────────
function metricaCard(titulo, valor, hist, sinHist, color, sufijo = '') {
  const var_ = Number(valor) - Number(hist)
  const pct  = hist > 0 ? Math.abs(((var_) / hist) * 100).toFixed(1) : null
  const varTxt = sinHist
    ? `<span class="sin-dato">Sin dato año anterior</span>`
    : `${varHtml(var_, false, sufijo)}${pct !== null ? ` <span class="sin-dato">(${pct}%)</span>` : ''}`

  return `
    <div class="metrica-card">
      <div class="metrica-label">${titulo}</div>
      <div class="metrica-valor" style="color:${color}">${valor}${sufijo}</div>
      <div class="metrica-comp">${varTxt}</div>
    </div>
  `
}

// ── Tabla cuarteles ───────────────────────────────────────────
function tablaCuartelesHtml(resumen, cuarteles) {
  const TIPOS = [
    { key: 'comisaria', label: 'COMISARÍA' },
    { key: 'tenencia',  label: 'TENENCIAS' },
    { key: 'reten',     label: 'RETENES' },
  ]

  let rows = ''
  TIPOS.forEach(({ key, label }) => {
    const lista = cuarteles.filter(c => c.tipo === key)
    if (!lista.length) return
    rows += `<tr class="tipo-sep"><td colspan="9">${label}</td></tr>`
    lista.forEach(c => {
      const r = resumen.find(x => x.cuartel_id === c.id)
      if (!r) return
      const alerta = r.servicios === 0
      const det_   = varHtml(r.var_det,  r.sin_hist)
      const uf_    = varHtml(r.var_uf,   r.sin_hist, ' UF')
      rows += `
        <tr class="${alerta ? 'fila-alerta' : ''}" onclick="toggleDetalle('${c.id}')">
          <td><span${alerta ? ' class="badge-alerta"' : ''}>&#9679;</span> ${c.nombre}</td>
          <td>${r.detenciones} ${det_}</td>
          <td>${r.uf_incautadas.toFixed(0)} UF ${uf_}</td>
          <td>${r.armas}</td>
          <td>${r.infracciones_migratorias}</td>
          <td>${r.hitos_visitados}</td>
          <td>${r.pnh_fiscalizados}</td>
          <td>${r.servicios}</td>
          <td style="color:var(--muted)">▾</td>
        </tr>
        <tr id="detalle-fila-${c.id}" style="display:none" class="detalle-fila">
          <td colspan="9">
            <div class="detalle-inner">
              ${detalleCuartelHtml(r, c)}
            </div>
          </td>
        </tr>
      `
    })
  })

  return `
    <div class="card gap3">
      <div class="sec-titulo">CUARTELES BAJO MANDO</div>
      <table class="tabla-cuarteles">
        <thead>
          <tr>
            <th>CUARTEL</th>
            <th>DETENCIONES</th>
            <th>UF INCAUTADAS</th>
            <th>ARMAS</th>
            <th>INF. MIG.</th>
            <th>HITOS</th>
            <th>PNH</th>
            <th>SERVICIOS</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `
}

function toggleDetalle(cuartelId) {
  const fila = el(`detalle-fila-${cuartelId}`)
  if (!fila) return
  fila.style.display = fila.style.display === 'none' ? '' : 'none'
}

// ── Detalle cuartel ───────────────────────────────────────────
function detalleCuartelHtml(r, cuartel) {
  if (!r) return ''
  return `
    <div class="card gap3">
      <div class="sec-titulo">RESUMEN OPERATIVO — ${(cuartel?.nombre || '').toUpperCase()}</div>
      <div class="g4">
        ${itemDetalle('HITOS VISITADOS',    r.hitos_visitados,          'var(--green)')}
        ${itemDetalle('PNH FISCALIZADOS',   r.pnh_fiscalizados,         'var(--green)')}
        ${itemDetalle('SIE VISITADOS',      r.sie_visitados,            'var(--green)')}
        ${itemDetalle('COORDINACIONES',     r.coordinaciones,           'var(--blue)')}
        ${itemDetalle('DETENCIONES',        r.detenciones,              'var(--red)')}
        ${itemDetalle('UF INCAUTADAS',      r.uf_incautadas.toFixed(0), 'var(--yellow)')}
        ${itemDetalle('INF. MIGRATORIAS',   r.infracciones_migratorias, 'var(--red)')}
        ${itemDetalle('DOCS FALSIFICADOS',  r.docs_falsificados,        'var(--orange)')}
      </div>
    </div>
  `
}

function itemDetalle(label, valor, color) {
  return `
    <div class="item-detalle">
      <div class="item-detalle-valor" style="color:${Number(valor) > 0 ? color : 'var(--muted)'}">
        ${valor}
      </div>
      <div class="item-detalle-label">${label}</div>
    </div>
  `
}

// ── Alertas ───────────────────────────────────────────────────
function alertasHtml(resumen) {
  const sinRegistro = resumen.filter(r => r.servicios === 0)
  if (!sinRegistro.length) return ''
  const items = sinRegistro.map(r =>
    `<div class="alerta-item"><span class="dot-rojo">●</span> <strong>${r.cuartel?.nombre || ''}</strong> — Sin servicios registrados en el período seleccionado</div>`
  ).join('')
  return `
    <div class="alertas-panel gap3">
      <div class="sec-titulo" style="color:var(--red)">⚠ ALERTAS ACTIVAS</div>
      ${items}
    </div>
  `
}
