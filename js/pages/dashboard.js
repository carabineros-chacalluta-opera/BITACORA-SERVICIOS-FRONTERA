// ============================================================
// SISCOF — Dashboard
// Diseño institucional Carabineros de Chile
// ============================================================

let _dashCuartelIds = []
let _dashCuarteles  = []
let _dashDetalleId  = null

async function renderDashboard() {
  el('pantalla-dashboard').innerHTML = `<div class="cargando">Cargando datos</div>`

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

  const tituloRol = APP.esPrefectura
    ? 'Prefectura Arica Nro. 1'
    : APP.esComisaria
    ? '4ª Comisaría Chacalluta'
    : (APP.cuartel?.nombre || '')

  const subRol = APP.esPrefectura
    ? `${_dashCuarteles.length} cuarteles · Vista consolidada`
    : APP.esComisaria
    ? `${_dashCuarteles.length} cuarteles bajo mando`
    : 'Vista personal · Mi cuartel'

  const anioAnt = new Date().getFullYear() - 1

  el('pantalla-dashboard').innerHTML = `
    <div class="container">

      <!-- ── Header ── -->
      <div class="flex-sb flex-wrap gap3" style="align-items:flex-start;gap:1.25rem 1rem">
        <div>
          <h1 style="font-size:1.75rem;font-weight:700;letter-spacing:-.5px;color:var(--text);line-height:1.1">
            ${tituloRol}
          </h1>
          <p style="font-size:.78rem;color:var(--muted);margin-top:4px;font-weight:500">
            ${subRol}
          </p>
        </div>
        <div class="filtros-bar">
          <button class="btn-filtro ${_filtro==='7dias'  ?'active':''}" onclick="cambiarFiltro('7dias')">Última semana</button>
          <button class="btn-filtro ${_filtro==='28dias' ?'active':''}" onclick="cambiarFiltro('28dias')">Últimos 28 días</button>
          <button class="btn-filtro ${_filtro==='anio'   ?'active':''}" onclick="cambiarFiltro('anio')">Año a la fecha</button>
        </div>
      </div>

      <p class="sin-dato gap2" style="margin-top:-.75rem">
        Comparativa vs mismo período ${anioAnt}
      </p>

      <!-- ── Métricas consolidadas ── -->
      <div class="g4 gap3">
        ${metricaCard('Detenciones',       datos.totales.detenciones,              datos.totales.hist_det,  datos.totales.sin_hist, 'var(--rojo)',    ''      )}
        ${metricaCard('UF Incautadas',     datos.totales.uf_incautadas.toFixed(0), datos.totales.hist_uf,   datos.totales.sin_hist, 'var(--amarillo)',' UF'   )}
        ${metricaCard('Armas recuperadas', datos.totales.armas,                    datos.totales.hist_arm,  datos.totales.sin_hist, 'var(--azul)',    ''      )}
        ${metricaCard('Servicios',         datos.totales.servicios,                datos.totales.hist_serv, datos.totales.sin_hist, 'var(--verde)',   ''      )}
      </div>

      <!-- ── Alertas ── -->
      ${alertasHtml(datos.resumen)}

      <!-- ── Vista según rol ── -->
      ${APP.tieneVisionGlobal
        ? tablaCuartelesHtml(datos.resumen, datos.cuarteles)
        : detalleCuartelHtml(datos.resumen[0], APP.cuartel)
      }

    </div>
  `
}

async function cambiarFiltro(f) {
  _filtro = f
  el('pantalla-dashboard').innerHTML = `<div class="cargando">Actualizando</div>`
  await actualizarDashboard()
}

// ── Métricas ─────────────────────────────────────────────────
function metricaCard(titulo, valor, hist, sinHist, color, sufijo = '') {
  const var_ = Number(valor) - Number(hist)
  const pct  = hist > 0 ? Math.abs((var_ / hist) * 100).toFixed(1) : null
  const varTxt = sinHist
    ? `<span class="sin-dato">Sin dato año anterior</span>`
    : `${varHtml(var_, false, sufijo)}${pct !== null ? ` <span class="sin-dato">(${pct}%)</span>` : ''}`

  return `
    <div class="metrica-card" style="--accent-color:${color}">
      <div class="metrica-label">${titulo}</div>
      <div class="metrica-valor" style="color:${color}">${valor}${sufijo}</div>
      <div class="metrica-comp">${varTxt}</div>
    </div>
  `
}

// ── Tabla cuarteles ───────────────────────────────────────────
function tablaCuartelesHtml(resumen, cuarteles) {
  const TIPOS = [
    { key: 'comisaria', label: 'Comisaría'  },
    { key: 'tenencia',  label: 'Tenencias'  },
    { key: 'reten',     label: 'Retenes'    },
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
      const det_   = varHtml(r.var_det, r.sin_hist)
      const uf_    = varHtml(r.var_uf,  r.sin_hist, ' UF')
      rows += `
        <tr class="${alerta ? 'fila-alerta' : ''}" onclick="toggleDetalle('${c.id}')">
          <td>
            ${alerta ? '<span class="badge-alerta">Sin registro</span>' : ''}
            ${c.nombre}
          </td>
          <td>${r.detenciones} ${det_}</td>
          <td>${r.uf_incautadas.toFixed(0)} UF ${uf_}</td>
          <td>${r.armas}</td>
          <td>${r.infracciones_migratorias}</td>
          <td>${r.hitos_visitados}</td>
          <td>${r.pnh_fiscalizados}</td>
          <td>${r.servicios}</td>
          <td style="color:var(--muted)">›</td>
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
      <div class="sec-titulo">Cuarteles bajo mando</div>
      <div style="overflow-x:auto">
        <table class="tabla-cuarteles">
          <thead>
            <tr>
              <th>Cuartel</th>
              <th>Detenciones</th>
              <th>UF Incautadas</th>
              <th>Armas</th>
              <th>Inf. Mig.</th>
              <th>Hitos</th>
              <th>PNH</th>
              <th>Servicios</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
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
      <div class="sec-titulo">Resumen operativo — ${(cuartel?.nombre || '').toUpperCase()}</div>
      <div class="g4">
        ${itemDetalle('Hitos visitados',   r.hitos_visitados,           'var(--verde)'   )}
        ${itemDetalle('PNH fiscalizados',  r.pnh_fiscalizados,          'var(--verde)'   )}
        ${itemDetalle('SIE visitados',     r.sie_visitados,             'var(--verde)'   )}
        ${itemDetalle('Coordinaciones',    r.coordinaciones,            'var(--azul)'    )}
        ${itemDetalle('Detenciones',       r.detenciones,               'var(--rojo)'    )}
        ${itemDetalle('UF incautadas',     r.uf_incautadas.toFixed(0),  'var(--amarillo)')}
        ${itemDetalle('Inf. migratorias',  r.infracciones_migratorias,  'var(--rojo)'    )}
        ${itemDetalle('Docs falsificados', r.docs_falsificados,         'var(--naranja)' )}
      </div>
    </div>
  `
}

function itemDetalle(label, valor, color) {
  return `
    <div class="item-detalle">
      <div class="item-detalle-valor" style="color:${Number(valor) > 0 ? color : 'var(--muted2)'}">
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
    `<div class="alerta-item">
      <span class="dot-rojo">●</span>
      <span><strong>${r.cuartel?.nombre || ''}</strong> — Sin servicios registrados en el período seleccionado</span>
    </div>`
  ).join('')
  return `
    <div class="alertas-panel gap3">
      <div class="sec-titulo" style="color:var(--rojo)">⚠ Alertas activas</div>
      ${items}
    </div>
  `
}
