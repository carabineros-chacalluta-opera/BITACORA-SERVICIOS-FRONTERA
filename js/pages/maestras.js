// ============================================================
// SISCOF v3 — Tablas Maestras (Hitos, PNH, SIE)
// ============================================================

let _puntosFiltro = 'todos'

async function renderMaestras() {
  el('pantalla-maestras').innerHTML = `<div class="cargando">Cargando puntos territoriales</div>`
  try {
    const cuartelIds = await obtenerCuartelIds()
    const cuarteles  = await obtenerCuarteles()
    const { data: puntos } = await APP.sb.from('puntos_territoriales')
      .select('*, cuartel:cuarteles(nombre,codigo)')
      .in('cuartel_id', cuartelIds)
      .order('tipo').order('nombre')

    window._puntosData = puntos || []
    renderMaestrasUI(cuarteles)
  } catch(e) {
    el('pantalla-maestras').innerHTML = `<div class="cargando">Error: ${e.message}</div>`
  }
}

function renderMaestrasUI(cuarteles) {
  const tipos = { hito: 'Hitos', pnh: 'PNH', sie: 'SIE' }
  const colores = { hito: 'var(--verde)', pnh: 'var(--rojo)', sie: 'var(--azul)' }
  const filtroHtml = Object.entries(tipos).map(([k, v]) => `
    <button class="btn-filtro ${_puntosFiltro === k ? 'active' : ''}" onclick="filtrarPuntos('${k}')">${v}</button>`).join('')

  el('pantalla-maestras').innerHTML = `
    <div class="container">
      <div class="flex-sb" style="margin-bottom:1.25rem;flex-wrap:wrap;gap:.75rem">
        <div>
          <h2 style="font-size:1.4rem;font-weight:700;color:var(--text)">Puntos Territoriales</h2>
          <p style="font-size:.78rem;color:var(--muted);margin-top:2px">
            ${window._puntosData.length} puntos registrados (${window._puntosData.filter(p=>p.activo).length} activos)
          </p>
        </div>
        <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">
          <div class="filtros-bar">
            <button class="btn-filtro ${_puntosFiltro==='todos'?'active':''}" onclick="filtrarPuntos('todos')">Todos</button>
            ${filtroHtml}
          </div>
          ${APP.esAdmin ? `<button class="btn btn-primario" style="font-size:.78rem;padding:.4rem .85rem"
            onclick="mostrarFormPunto()">+ Nuevo punto</button>` : ''}
        </div>
      </div>
      <div id="lista-puntos" class="maestras-grid">
        ${renderListaPuntos(window._puntosData)}
      </div>
    </div>`
}

function renderListaPuntos(puntos) {
  const filtrados = _puntosFiltro === 'todos' ? puntos : puntos.filter(p => p.tipo === _puntosFiltro)
  if (!filtrados.length) return `<div style="color:var(--muted);font-size:.82rem;padding:2rem;text-align:center;grid-column:1/-1">Sin puntos en este filtro</div>`

  const colorTipo = { hito: '#1a6b2a', pnh: '#d70015', sie: '#0055d4' }
  const bgTipo    = { hito: '#e8f5ea', pnh: '#fff0f1', sie: '#e8f0fe' }

  return filtrados.map(p => `
    <div class="maestra-item ${!p.activo ? 'opacity: .5' : ''}">
      <div>
        <div class="maestra-nombre">${p.nombre}</div>
        <div class="maestra-tipo">${p.cuartel?.codigo || ''} · ${p.pais || ''}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.3rem">
        <span class="maestra-badge" style="background:${bgTipo[p.tipo]||'#f0f0f2'};color:${colorTipo[p.tipo]||'#6e6e73'}">
          ${p.tipo.toUpperCase()}
        </span>
        <span style="font-size:.6rem;color:var(--muted);font-family:var(--mono)">
          ${p.valor_estrategico?.toUpperCase() || 'MEDIO'}
        </span>
        ${!p.activo ? `<span style="font-size:.6rem;color:var(--muted2)">INACTIVO</span>` : ''}
      </div>
    </div>`).join('')
}

function filtrarPuntos(tipo) {
  _puntosFiltro = tipo
  const lista = el('lista-puntos')
  if (lista) lista.innerHTML = renderListaPuntos(window._puntosData)
  document.querySelectorAll('.btn-filtro').forEach(b => b.classList.remove('active'))
  event.target.classList.add('active')
}

function mostrarFormPunto() {
  toast('Funcionalidad de agregar punto disponible próximamente', 'ok')
}
