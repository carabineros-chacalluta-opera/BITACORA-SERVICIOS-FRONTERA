// ============================================================
// SISCOF v3 — dashboard.js
// FIX: loop infinito resuelto separando estructura del contenido
//      Los botones de filtro NO se recrean en cada actualización
//      Solo se actualizan los datos internos en #dash-contenido
// ============================================================

let _filtro         = '28dias'
let _dashCuartelIds = []
let _dashCuarteles  = []

async function renderDashboard() {
  const anioAnt   = new Date().getFullYear() - 1
  _dashCuarteles  = await obtenerCuarteles()
  _dashCuartelIds = _dashCuarteles.map(c => c.id)
  if (!APP.tieneVisionGlobal && APP.cuartel) {
    _dashCuarteles  = [APP.cuartel]
    _dashCuartelIds = [APP.cuartel.id]
  }

  const tituloRol = APP.esPrefectura  ? 'Prefectura Arica Nro. 1'
    : APP.esComisaria ? '4ª Comisaría Chacalluta'
    : (APP.cuartel?.nombre || '')
  const subRol = APP.esPrefectura
    ? `${_dashCuarteles.length} cuarteles · Vista consolidada`
    : APP.esComisaria
    ? `${_dashCuarteles.length} cuarteles bajo mando`
    : 'Vista personal · Mi cuartel'

  // ── Crear estructura UNA SOLA VEZ ────────────────────────
  // Los botones de filtro quedan con IDs fijos.
  // Solo #dash-contenido se reemplaza en actualizaciones.
  el('pantalla-dashboard').innerHTML = `
    <div class="container" id="dash-container">
      <div class="flex-sb flex-wrap gap3"
        style="align-items:flex-start;gap:1.25rem 1rem">
        <div>
          <h1 style="font-size:1.75rem;font-weight:700;
            letter-spacing:-.5px;color:var(--text)">
            ${tituloRol}
          </h1>
          <p style="font-size:.78rem;color:var(--muted);
            margin-top:4px;font-weight:500">
            ${subRol} · Comparativa vs mismo período ${anioAnt}
          </p>
        </div>
        <div class="filtros-bar">
          <button id="btn-f-7dias"
            class="btn-filtro ${_filtro==='7dias'?'active':''}"
            onclick="cambiarFiltro('7dias')">
            Última semana
          </button>
          <button id="btn-f-28dias"
            class="btn-filtro ${_filtro==='28dias'?'active':''}"
            onclick="cambiarFiltro('28dias')">
            Últimos 28 días
          </button>
          <button id="btn-f-anio"
            class="btn-filtro ${_filtro==='anio'?'active':''}"
            onclick="cambiarFiltro('anio')">
            Año a la fecha
          </button>
        </div>
      </div>
      <!-- Solo este div se actualiza al cambiar filtro -->
      <div id="dash-contenido">
        <div class="cargando">Cargando datos...</div>
      </div>
    </div>`

  await _cargarContenido()
}

// ── Carga solo el contenido dinámico ─────────────────────────
async function _cargarContenido() {
  const zona = el('dash-contenido')
  if (!zona) return
  zona.innerHTML = `<div class="cargando">Cargando datos...</div>`
  try {
    const datos = await obtenerDashboard(_dashCuartelIds, _filtro)
    zona.innerHTML = `
      ${idfiConsolidadoHtml(datos)}
      ${indicadoresCuartelSeleccionado(datos.resumen[0])}
      ${alertasHtml(datos.resumen)}
      ${APP.tieneVisionGlobal
        ? tablaCuartelesHtml(datos.resumen, datos.cuarteles)
        : detalleCuartelHtml(datos.resumen[0], APP.cuartel)}`
  } catch(e) {
    zona.innerHTML = `
      <div class="card" style="color:var(--rojo);
        font-size:.82rem;padding:1.5rem">
        Error al cargar: ${e.message}
      </div>`
  }
}

// ── cambiarFiltro NO llama a renderDashboard ──────────────────
// Solo actualiza clases de botones y recarga el contenido.
// Así se evita el loop: renderDashboard → innerHTML → onChange
async function cambiarFiltro(f) {
  if (_filtro === f) return  // ya está activo, no hacer nada
  _filtro = f
  ;['7dias','28dias','anio'].forEach(id => {
    const btn = el(`btn-f-${id}`)
    if (btn) btn.classList.toggle('active', id === f)
  })
  await _cargarContenido()
}

// ════════════════════════════════════════════════════════════
// IDFI CONSOLIDADO
// ════════════════════════════════════════════════════════════
function idfiConsolidadoHtml(datos) {
  const anioAnt = new Date().getFullYear() - 1
  const r = datos.resumen[0]
  if (!r) return ''

  const idfi  = r.idfi_actual
  const dfp   = r.dfp?.total || 0
  const dfo   = r.dfo?.total || 0
  const color = idfiColor(idfi)
  const label = idfiLabel(idfi)
  const bgCol = idfiColorBg(idfi)

  const sin_hist  = r.sin_idfi_hist
  const varIdfi   = sin_hist || r.idfi_hist === null ? null : idfi - r.idfi_hist
  const varDfp    = sin_hist || r.dfp_hist  === null ? null : dfp  - r.dfp_hist
  const varDfo    = sin_hist || r.dfo_hist  === null ? null : dfo  - r.dfo_hist

  const dfpAlta = dfp >= 70
  const dfoAlta = dfo >= 10
  let diagnostico='', diagColor='', diagBg=''
  if  (dfpAlta  &&  dfoAlta) { diagnostico='Territorio disputado — Alta presión delictual'; diagColor='#d70015'; diagBg='#fff0f1' }
  if  (dfpAlta  && !dfoAlta) { diagnostico='★ Disuasión efectiva — Escenario óptimo';      diagColor='#1a6b2a'; diagBg='#e8f5ea' }
  if  (!dfpAlta &&  dfoAlta) { diagnostico='Reacción tardía — Inteligencia externa';        diagColor='#c45000'; diagBg='#fff4ec' }
  if  (!dfpAlta && !dfoAlta) { diagnostico='⚠ Abandono territorial — CRISIS';              diagColor='#d70015'; diagBg='#fff0f1' }

  return `
    <div class="card gap3"
      style="border-left:4px solid ${color};background:${bgCol}">
      <div class="flex-sb flex-wrap"
        style="gap:1rem;align-items:flex-start">

        <div>
          <div class="sec-titulo" style="margin-bottom:.3rem">
            ÍNDICE DE DESEMPEÑO FRONTERIZO INTEGRAL
            — Informe Técnico Nro. 01/2026
          </div>
          <div style="display:flex;align-items:baseline;
            gap:.75rem;flex-wrap:wrap">
            <span style="font-size:3.2rem;font-weight:700;
              letter-spacing:-2px;color:${color};line-height:1">
              ${idfi.toFixed(1)}%
            </span>
            <span style="background:${color};color:#fff;
              font-size:.7rem;font-weight:700;letter-spacing:1.5px;
              padding:4px 10px;border-radius:4px">
              ${label}
            </span>
            ${varIdfi !== null
              ? `<span style="font-size:.85rem">
                  ${varHtml(varIdfi,false,' pts')} vs ${anioAnt}
                  ${pctHtml(idfi, r.idfi_hist)}
                 </span>`
              : `<span class="sin-dato">Sin dato ${anioAnt}</span>`}
          </div>
          <div style="margin-top:.85rem">
            <div style="font-family:var(--mono);font-size:.58rem;
              color:var(--muted);letter-spacing:1.5px;margin-bottom:4px">
              DFP 40% &nbsp;·&nbsp; DFO 60%
            </div>
            <div style="height:10px;border-radius:5px;overflow:hidden;
              display:flex;width:280px;max-width:100%">
              <div style="width:40%;background:var(--verde);opacity:.85"></div>
              <div style="width:60%;background:var(--azul)"></div>
            </div>
            <div style="display:flex;gap:1.5rem;margin-top:6px;
              font-size:.75rem;font-weight:600">
              <span style="color:var(--verde)">
                DFP ${dfp.toFixed(1)}%
                ${varDfp !== null ? varHtml(varDfp,false,' pts') : ''}
              </span>
              <span style="color:var(--azul)">
                DFO ${dfo.toFixed(1)}%
                ${varDfo !== null ? varHtml(varDfo,false,' pts') : ''}
              </span>
            </div>
          </div>
        </div>

        <div>
          <div class="sec-titulo" style="margin-bottom:.5rem">
            Diagnóstico territorial
          </div>
          <div style="background:${diagBg};
            border:1.5px solid ${diagColor}33;
            border-radius:var(--radius-sm);
            padding:.65rem 1rem;font-size:.8rem;
            font-weight:600;color:${diagColor};max-width:280px">
            ${diagnostico}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;
            gap:4px;margin-top:.6rem;width:280px">
            ${matrizCelda('DFP ▲ + DFO ▲','Disputado',    dfpAlta  &&  dfoAlta, '#d70015')}
            ${matrizCelda('DFP ▲ + DFO ▼','Disuasión ★',  dfpAlta  && !dfoAlta, '#1a6b2a')}
            ${matrizCelda('DFP ▼ + DFO ▲','Reactivo',     !dfpAlta &&  dfoAlta, '#c45000')}
            ${matrizCelda('DFP ▼ + DFO ▼','Crisis',       !dfpAlta && !dfoAlta, '#d70015')}
          </div>
        </div>

      </div>
    </div>`
}

function matrizCelda(label, estado, activo, color) {
  return `
    <div style="padding:5px 8px;border-radius:4px;
      font-size:.6rem;font-weight:${activo?700:400};
      background:${activo?color+'22':'var(--bg3)'};
      border:1.5px solid ${activo?color:'var(--border)'};
      color:${activo?color:'var(--muted)'}">
      <div>${label}</div>
      <div style="font-weight:700">${estado}</div>
    </div>`
}

// ════════════════════════════════════════════════════════════
// PANEL DFP + DFO POR INDICADOR
// ════════════════════════════════════════════════════════════
function indicadoresCuartelSeleccionado(r) {
  if (!r || !r.dfp || !r.dfo) return ''
  const anioAnt = new Date().getFullYear() - 1
  const sin     = r.sin_idfi_hist

  return `
    <div class="g2 gap3" style="align-items:start">

      <div class="card">
        <div style="display:flex;align-items:center;
          justify-content:space-between;margin-bottom:1rem">
          <div>
            <div class="sec-titulo" style="margin:0;color:var(--verde)">
              ◈ Demanda Fronteriza Preventiva
            </div>
            <div style="font-size:.65rem;color:var(--muted);margin-top:2px">
              Peso: 40% del IDFI
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:1.6rem;font-weight:700;
              color:var(--verde);letter-spacing:-.5px">
              ${r.dfp.total.toFixed(1)}%
            </div>
            ${sin
              ? `<div class="sin-dato">Sin dato ${anioAnt}</div>`
              : `<div style="font-size:.7rem">
                  ${varHtml(r.dfp.total-(r.dfp_hist||0),false,' pts')}
                 </div>`}
          </div>
        </div>
        ${indicadorFila('DFP-01','Hitos Fronterizos', 'Peso 25%',r.dfp.dfp01,r.dfp01_hist,sin,'#1a6b2a')}
        ${indicadorFila('DFP-02','PNH Fiscalizados',  'Peso 30%',r.dfp.dfp02,r.dfp02_hist,sin,'#1a6b2a')}
        ${indicadorFila('DFP-03','SIE Visitados',     'Peso 15%',r.dfp.dfp03,r.dfp03_hist,sin,'#2a8a3e')}
        ${indicadorFila('DFP-04','Coordinación Int.', 'Peso 15%',r.dfp.dfp04,r.dfp04_hist,sin,'#2a8a3e')}
        ${indicadorFila('DFP-05','Prod. Inteligencia','Peso 15%',r.dfp.dfp05,r.dfp05_hist,sin,'#2a8a3e')}
        <div style="margin-top:1rem;padding-top:.75rem;
          border-top:1px solid var(--border)">
          ${barraProgreso(r.dfp.total,'#1a6b2a')}
        </div>
      </div>

      <div class="card">
        <div style="display:flex;align-items:center;
          justify-content:space-between;margin-bottom:1rem">
          <div>
            <div class="sec-titulo" style="margin:0;color:var(--azul)">
              ⚡ Demanda Fronteriza Operativa
            </div>
            <div style="font-size:.65rem;color:var(--muted);margin-top:2px">
              Peso: 60% del IDFI
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:1.6rem;font-weight:700;
              color:var(--azul);letter-spacing:-.5px">
              ${r.dfo.total.toFixed(1)}%
            </div>
            ${sin
              ? `<div class="sin-dato">Sin dato ${anioAnt}</div>`
              : `<div style="font-size:.7rem">
                  ${varHtml(r.dfo.total-(r.dfo_hist||0),false,' pts')}
                 </div>`}
          </div>
        </div>
        ${indicadorFila('DFO-01','Eficacia Controles',  'Peso 15%',r.dfo.dfo01,r.dfo01_hist,sin,'#0055d4')}
        ${indicadorFila('DFO-02','Docs. Falsificados',  'Peso 10%',r.dfo.dfo02,r.dfo02_hist,sin,'#0055d4')}
        ${indicadorFila('DFO-03','Control Migratorio',  'Peso 15%',r.dfo.dfo03,r.dfo03_hist,sin,'#0055d4')}
        ${indicadorFila('DFO-04','Interdicción CT',     'Peso 30%',r.dfo.dfo04,r.dfo04_hist,sin,'#d70015')}
        ${indicadorFila('DFO-05','Impacto Económico UF','Peso 15%',r.dfo.dfo05,r.dfo05_hist,sin,'#9a6e00')}
        ${indicadorFila('DFO-06','Obj. Internacionales','Peso 15%',r.dfo.dfo06,r.dfo06_hist,sin,'#c45000')}
        <div style="margin-top:1rem;padding-top:.75rem;
          border-top:1px solid var(--border)">
          ${barraProgreso(r.dfo.total,'#0055d4')}
        </div>
      </div>

    </div>`
}

function indicadorFila(codigo, nombre, peso, valor, histVal, sinHist, color) {
  const pct   = (valor||0).toFixed(1)
  const nivel = valor>=90?'ÓPTIMO':valor>=70?'ADECUADO':valor>=50?'DEFICIENTE':'CRÍTICO'
  const varVal = (!sinHist && histVal !== null)
    ? (valor - histVal).toFixed(1) : null
  return `
    <div style="padding:.6rem 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:flex-start;
        justify-content:space-between;gap:.5rem">
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:.5rem">
            <span style="font-family:var(--mono);font-size:.58rem;
              font-weight:700;color:${color};
              background:${color}18;padding:2px 6px;border-radius:3px">
              ${codigo}
            </span>
            <span style="font-size:.78rem;font-weight:600;
              color:var(--text)">${nombre}</span>
            <span style="font-size:.6rem;color:var(--muted)">${peso}</span>
          </div>
          ${barraProgreso(valor, color)}
        </div>
        <div style="text-align:right;min-width:80px">
          <div style="font-size:1rem;font-weight:700;
            color:${idfiColor(valor)}">${pct}%</div>
          <div style="font-size:.6rem;font-weight:600;
            color:${idfiColor(valor)}">${nivel}</div>
          ${varVal !== null
            ? `<div style="font-size:.65rem">
                ${varHtml(parseFloat(varVal),false,' pts')}
               </div>`
            : `<span class="sin-dato" style="font-size:.58rem">—</span>`}
        </div>
      </div>
    </div>`
}

// ════════════════════════════════════════════════════════════
// TABLA CUARTELES
// ════════════════════════════════════════════════════════════
function tablaCuartelesHtml(resumen, cuarteles) {
  const TIPOS = [
    {key:'comisaria',label:'Comisaría'},
    {key:'tenencia', label:'Tenencias'},
    {key:'reten',    label:'Retenes'},
  ]
  let rows = ''
  TIPOS.forEach(({key,label}) => {
    const lista = cuarteles.filter(c => c.tipo === key)
    if (!lista.length) return
    rows += `<tr class="tipo-sep"><td colspan="10">${label}</td></tr>`
    lista.forEach(c => {
      const r = resumen.find(x => x.cuartel_id === c.id)
      if (!r) return
      const alerta = r.servicios === 0
      const idfi   = r.idfi_actual || 0
      const color  = idfiColor(idfi)
      const lbl    = idfiLabel(idfi)
      rows += `
        <tr class="${alerta?'fila-alerta':''}"
          onclick="toggleDetalle('${c.id}')">
          <td>
            ${alerta?'<span class="badge-alerta">Sin registro</span>':''}
            ${c.nombre}
          </td>
          <td>
            <span style="font-weight:700;color:${color}">
              ${idfi.toFixed(0)}%
            </span>
            <span style="font-size:.6rem;color:${color};margin-left:3px">
              ${lbl}
            </span>
          </td>
          <td>${r.dfp?.total?.toFixed(0)||0}%</td>
          <td>${r.dfo?.total?.toFixed(0)||0}%</td>
          <td>${r.detenciones} ${varHtml(r.var_det,r.sin_hist)}</td>
          <td>${r.uf_incautadas.toFixed(0)} ${varHtml(r.var_uf,r.sin_hist,' UF')}</td>
          <td>${r.armas}</td>
          <td>${r.hitos_visitados}</td>
          <td>${r.servicios}</td>
          <td style="color:var(--muted)">›</td>
        </tr>
        <tr id="detalle-fila-${c.id}" style="display:none"
          class="detalle-fila">
          <td colspan="10">
            <div class="detalle-inner">
              ${indicadoresCuartelSeleccionado(r)}
              ${detalleCuartelHtml(r,c)}
            </div>
          </td>
        </tr>`
    })
  })

  return `
    <div class="card gap3">
      <div class="sec-titulo">Cuarteles bajo mando</div>
      <div style="overflow-x:auto">
        <table class="tabla-cuarteles">
          <thead>
            <tr>
              <th>Cuartel</th><th>IDFI</th><th>DFP</th><th>DFO</th>
              <th>Detenciones</th><th>UF Incautadas</th><th>Armas</th>
              <th>Hitos</th><th>Servicios</th><th></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`
}

function toggleDetalle(cuartelId) {
  const fila = el(`detalle-fila-${cuartelId}`)
  if (!fila) return
  fila.style.display = fila.style.display === 'none' ? '' : 'none'
}

// ════════════════════════════════════════════════════════════
// DETALLE CUARTEL
// ════════════════════════════════════════════════════════════
function detalleCuartelHtml(r, cuartel) {
  if (!r) return ''
  return `
    <div class="card gap3">
      <div class="sec-titulo">
        Resumen operativo — ${(cuartel?.nombre||'').toUpperCase()}
      </div>
      <div class="g4">
        ${itemDetalle('Detenciones',       r.detenciones,              'var(--rojo)')}
        ${itemDetalle('UF Incautadas',     r.uf_incautadas.toFixed(0), 'var(--amarillo)')}
        ${itemDetalle('Armas',             r.armas,                    'var(--azul)')}
        ${itemDetalle('Servicios',         r.servicios,                'var(--verde)')}
        ${itemDetalle('Hitos visitados',   r.hitos_visitados,          'var(--verde)')}
        ${itemDetalle('PNH fiscalizados',  r.pnh_fiscalizados,         'var(--verde)')}
        ${itemDetalle('SIE visitados',     r.sie_visitados,            'var(--verde)')}
        ${itemDetalle('Coordinaciones',    r.coordinaciones,           'var(--azul)')}
        ${itemDetalle('Hallazgos intel.',  r.hallazgos_registrados,    'var(--amarillo)')}
        ${itemDetalle('Inf. Migratorias',  r.infracciones_migratorias, 'var(--rojo)')}
        ${itemDetalle('Docs Falsificados', r.docs_falsificados,        'var(--naranja)')}
        ${itemDetalle('Obj. Internac.',    r.obj_internacionales,      'var(--rojo)')}
      </div>
    </div>`
}

function itemDetalle(label, valor, color) {
  return `
    <div class="item-detalle">
      <div class="item-detalle-valor"
        style="color:${Number(valor)>0?color:'var(--muted2)'}">
        ${valor}
      </div>
      <div class="item-detalle-label">${label}</div>
    </div>`
}

// ════════════════════════════════════════════════════════════
// ALERTAS
// ════════════════════════════════════════════════════════════
function alertasHtml(resumen) {
  const alertas = []
  resumen.forEach(r => {
    if (r.servicios === 0)
      alertas.push(`<strong>${r.cuartel?.nombre||''}</strong> — Sin servicios registrados en el período`)
    if (r.idfi_actual < 50)
      alertas.push(`<strong>${r.cuartel?.nombre||''}</strong> — IDFI CRÍTICO (${r.idfi_actual.toFixed(1)}%)`)
    if (r.dfp?.dfp01 < 50)
      alertas.push(`<strong>${r.cuartel?.nombre||''}</strong> — DFP-01 Control de hitos insuficiente`)
  })
  if (!alertas.length) return ''
  return `
    <div class="alertas-panel gap3">
      <div class="sec-titulo" style="color:var(--rojo)">⚠ Alertas activas</div>
      ${alertas.map(a => `
        <div class="alerta-item">
          <span class="dot-rojo">●</span>
          <span>${a}</span>
        </div>`).join('')}
    </div>`
}
