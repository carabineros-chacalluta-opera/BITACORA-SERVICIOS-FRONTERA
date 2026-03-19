// ============================================================
// SISCOF v3 — csf.js
// Pantalla: Generar CSF + Seguimiento + Reprogramaciones
// Accesible desde menú Admin (rol: admin, comisaria, prefectura)
// ============================================================

let _csfTab      = 'generar'  // 'generar' | 'seguimiento' | 'historial'
let _csfDatos    = null        // datos calculados por IDEX
let _csfBorrador = null        // borrador editable
let _csfCuartelId= null
let _csfCsfs     = []          // historial de CSFs

// ── Entrada principal ────────────────────────────────────────
async function renderCSF() {
  if (!APP.esAdmin && !APP.esComisaria && !APP.esPrefectura) {
    el('pantalla-csf').innerHTML = `<div class="cargando">SIN ACCESO</div>`
    return
  }

  const cuarteles = await obtenerCuarteles()
  _csfCuartelId   = APP.cuartel?.id || cuarteles[0]?.id || null

  el('pantalla-csf').innerHTML = `
    <div class="container" style="max-width:1000px">

      <!-- Tabs -->
      <div style="display:flex;gap:.5rem;margin-bottom:1.5rem;
        border-bottom:2px solid var(--border);padding-bottom:0">
        ${_tabBtn('generar',     '📄 Generar CSF')}
        ${_tabBtn('seguimiento', '📊 Seguimiento')}
        ${_tabBtn('historial',   '📁 Historial')}
      </div>

      <div id="csf-contenido">
        <div class="cargando">Cargando...</div>
      </div>

    </div>`

  await _cambiarTabCSF(_csfTab)
}

function _tabBtn(tab, label) {
  const act = _csfTab === tab
  return `<button
    id="csf-tab-${tab}"
    onclick="_cambiarTabCSF('${tab}')"
    style="padding:.6rem 1.25rem;border:none;background:none;
      font-size:.82rem;font-weight:${act?700:500};cursor:pointer;
      color:${act?'var(--verde)':'var(--muted)'};
      border-bottom:${act?'2px solid var(--verde)':'2px solid transparent'};
      margin-bottom:-2px;transition:all .15s">
    ${label}
  </button>`
}

async function _cambiarTabCSF(tab) {
  _csfTab = tab
  ;['generar','seguimiento','historial'].forEach(t => {
    const btn = el(`csf-tab-${t}`)
    if (!btn) return
    btn.style.fontWeight   = t === tab ? '700' : '500'
    btn.style.color        = t === tab ? 'var(--verde)' : 'var(--muted)'
    btn.style.borderBottom = t === tab ? '2px solid var(--verde)' : '2px solid transparent'
  })
  const zona = el('csf-contenido')
  if (!zona) return
  zona.innerHTML = `<div class="cargando">Cargando...</div>`

  if (tab === 'generar')      await _renderGenerador()
  if (tab === 'seguimiento')  await _renderSeguimiento()
  if (tab === 'historial')    await _renderHistorial()
}

// ════════════════════════════════════════════════════════════
// TAB 1: GENERADOR DE CSF
// ════════════════════════════════════════════════════════════
async function _renderGenerador() {
  const cuarteles = await obtenerCuarteles()
  const hoy       = new Date()
  const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    .toISOString().split('T')[0]
  const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth()+1, 0)
    .toISOString().split('T')[0]

  const zona = el('csf-contenido')
  zona.innerHTML = `
    <div class="card gap3" style="margin-bottom:1rem">
      <div class="sec-titulo">Parámetros de la Carta de Situación Fronteriza</div>
      <div class="g2 gap">
        <div class="campo">
          <label for="csf-cuartel">Cuartel</label>
          <select id="csf-cuartel" onchange="_csfCuartelId=this.value">
            ${cuarteles.map(c =>
              `<option value="${c.id}" ${c.id===_csfCuartelId?'selected':''}>${c.nombre}</option>`
            ).join('')}
          </select>
        </div>
        <div class="campo">
          <label for="csf-clasif">Clasificación</label>
          <select id="csf-clasif">
            <option value="SECRETO">SECRETO</option>
            <option value="RESERVADO">RESERVADO</option>
          </select>
        </div>
        <div class="campo">
          <label for="csf-inicio">Vigencia desde</label>
          <input id="csf-inicio" type="date" value="${primerDia}" />
        </div>
        <div class="campo">
          <label for="csf-fin">Vigencia hasta</label>
          <input id="csf-fin" type="date" value="${ultimoDia}" />
        </div>
      </div>
      <button class="btn btn-primario" onclick="_generarBorradorCSF()"
        style="align-self:flex-start">
        ⚙ Generar borrador automático
      </button>
    </div>
    <div id="csf-borrador-wrap"></div>`
}

async function _generarBorradorCSF() {
  const cuartelId  = el('csf-cuartel')?.value || _csfCuartelId
  const fechaIni   = el('csf-inicio')?.value
  const fechaFin   = el('csf-fin')?.value
  const clasif     = el('csf-clasif')?.value || 'SECRETO'
  const wrap       = el('csf-borrador-wrap')

  if (!cuartelId || !fechaIni || !fechaFin) {
    toast('Complete todos los parámetros','err'); return
  }
  wrap.innerHTML = `<div class="cargando">Calculando criticidad y frecuencias...</div>`

  try {
    _csfDatos  = await calcularDatosCSF(cuartelId, fechaIni, fechaFin)
    const nro  = await siguienteNumeroCSF(cuartelId)
    _csfBorrador = {
      numero:              nro,
      cuartel_id:          cuartelId,
      cuartel_nombre:      _csfDatos.cuartel?.nombre || '',
      clasificacion:       clasif,
      fecha_emision:       new Date().toISOString().split('T')[0],
      fecha_vigencia_inicio: fechaIni,
      fecha_vigencia_fin:    fechaFin,
      amenaza_principal:   _csfDatos.amenazaSugerida,
      instrucciones_generales: _instruccionesDefault(),
    }
    wrap.innerHTML = _htmlBorradorCSF(_csfDatos, _csfBorrador)
  } catch(e) {
    wrap.innerHTML = `<div class="card" style="color:var(--rojo);padding:1rem">
      Error al calcular: ${e.message}</div>`
  }
}

function _htmlBorradorCSF(datos, borrador) {
  const est = datos.estadisticas
  const pnhs = datos.puntos.filter(p => p.tipo === 'pnh')
  const hitos = datos.puntos.filter(p => p.tipo === 'hito')
  const sies  = datos.puntos.filter(p => p.tipo === 'sie')
  // Para la sección II mostrar PNH primero, luego hitos
  const lugaresPatrullar = [...pnhs, ...hitos, ...sies].slice(0, 15)

  return `
  <!-- PREVIEW CSF -->
  <div class="card" style="border:2px solid var(--verde);padding:0;overflow:hidden;margin-bottom:1rem">

    <!-- Header -->
    <div style="background:var(--verde);color:#fff;padding:.75rem 1rem;
      display:grid;grid-template-columns:1fr auto">
      <div style="font-size:.85rem;font-weight:700;letter-spacing:.5px">
        CARTA DE SITUACIÓN FRONTERIZA — DEMANDA PREVENTIVA
      </div>
      <div style="font-size:.7rem;opacity:.85;text-align:right">
        Carabineros de Chile · Prefectura Arica Nro. 1
      </div>
    </div>

    <!-- Meta -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);
      font-size:.72rem;border-bottom:1px solid var(--border)">
      ${_metaCelda('Nro. CSF',      borrador.numero)}
      ${_metaCelda('Clasificación', `<strong>${borrador.clasificacion}</strong>`)}
      ${_metaCelda('Emisión',       borrador.fecha_emision)}
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);
      font-size:.72rem;border-bottom:1px solid var(--border)">
      ${_metaCelda('Sector',        borrador.cuartel_nombre)}
      ${_metaCelda('Vigencia desde',borrador.fecha_vigencia_inicio)}
      ${_metaCelda('Vigencia hasta',borrador.fecha_vigencia_fin)}
    </div>

    <!-- I. Análisis de Amenaza -->
    <div style="border-bottom:1px solid var(--border)">
      <div style="background:#f5f5f7;padding:.45rem .85rem;
        font-size:.74rem;font-weight:700;color:var(--text)">
        I.  ANÁLISIS DE AMENAZA
      </div>
      <div style="padding:.65rem .85rem">
        <div style="font-size:.72rem;font-weight:700;color:var(--verde);
          margin-bottom:.35rem">AMENAZA PRINCIPAL</div>
        <textarea id="csf-amenaza"
          style="width:100%;border:1px solid var(--border);border-radius:6px;
            padding:.5rem;font-size:.75rem;color:var(--text);
            background:var(--bg2);min-height:60px;resize:vertical"
          onchange="_csfBorrador.amenaza_principal=this.value"
        >${borrador.amenaza_principal}</textarea>
        <div style="font-size:.65rem;color:var(--muted);margin-top:.25rem">
          ✎ Editable — Sugerido automáticamente desde los datos del período
        </div>
      </div>
    </div>

    <!-- II. Lugares a patrullar -->
    <div style="border-bottom:1px solid var(--border)">
      <div style="background:#f5f5f7;padding:.45rem .85rem;
        font-size:.74rem;font-weight:700;color:var(--text)">
        II.  LUGARES A PATRULLAR — PASOS NO HABILITADOS PRIORIZADOS
      </div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:.7rem">
          <thead>
            <tr style="background:#f0f0f2">
              <th style="padding:.35rem .55rem;text-align:left;border-bottom:2px solid var(--border)">N°</th>
              <th style="padding:.35rem .55rem;text-align:left;border-bottom:2px solid var(--border)">Nombre</th>
              <th style="padding:.35rem .55rem;text-align:left;border-bottom:2px solid var(--border)">Latitud</th>
              <th style="padding:.35rem .55rem;text-align:left;border-bottom:2px solid var(--border)">Longitud</th>
              <th style="padding:.35rem .55rem;text-align:left;border-bottom:2px solid var(--border)">Serv.</th>
              <th style="padding:.35rem .55rem;text-align:left;border-bottom:2px solid var(--border)">Tareas Específicas</th>
            </tr>
          </thead>
          <tbody>
            ${lugaresPatrullar.map((p,i) => `
              <tr style="${i%2===1?'background:#fafafa':''}">
                <td style="padding:.35rem .55rem">${String(i+1).padStart(2,'0')}</td>
                <td style="padding:.35rem .55rem;font-weight:600">${p.nombre}</td>
                <td style="padding:.35rem .55rem;font-family:monospace">
                  ${p.latitud ? decimalADms(p.latitud, false) : '—'}
                </td>
                <td style="padding:.35rem .55rem;font-family:monospace">
                  ${p.longitud ? decimalADms(p.longitud, true) : '—'}
                </td>
                <td style="padding:.35rem .55rem;white-space:nowrap">
                  <span style="background:${_colorNivel(p.nivel_final)}22;
                    color:${_colorNivel(p.nivel_final)};font-weight:700;
                    padding:1px 6px;border-radius:3px;font-size:.68rem">
                    ${p.frec_label}
                  </span>
                </td>
                <td style="padding:.35rem .55rem;font-size:.68rem;color:var(--muted2)">
                  ${p.tareas_especificas}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- III. Niveles de criticidad -->
    <div style="border-bottom:1px solid var(--border)">
      <div style="background:#f5f5f7;padding:.45rem .85rem;
        font-size:.74rem;font-weight:700;color:var(--text)">
        III.  NIVELES DE CRITICIDAD POR SECTOR
      </div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:.7rem">
          <thead>
            <tr style="background:#f0f0f2">
              <th style="padding:.35rem .55rem;text-align:left;border-bottom:2px solid var(--border)">N° / Sector</th>
              <th style="padding:.35rem .55rem;text-align:left;border-bottom:2px solid var(--border)">Nivel de Criticidad</th>
              <th style="padding:.35rem .55rem;text-align:left;border-bottom:2px solid var(--border)">Probabilidad</th>
              <th style="padding:.35rem .55rem;text-align:left;border-bottom:2px solid var(--border)">Observación</th>
            </tr>
          </thead>
          <tbody>
            ${lugaresPatrullar.filter((p,i)=>i<8).map((p,i) => `
              <tr style="${i%2===1?'background:#fafafa':''}">
                <td style="padding:.35rem .55rem;font-weight:600">${String(i+1).padStart(2,'0')} · ${p.nombre}</td>
                <td style="padding:.35rem .55rem">
                  <span style="background:${_colorNivel(p.nivel_final)}22;
                    color:${_colorNivel(p.nivel_final)};font-weight:700;
                    padding:2px 8px;border-radius:3px;font-size:.68rem">
                    NIVEL ${p.nivel_final} — ${p.nivel_texto}
                  </span>
                </td>
                <td style="padding:.35rem .55rem;font-weight:600;
                  color:${_colorNivel(p.nivel_final)}">
                  ${p.nivel_probabilidad}
                </td>
                <td style="padding:.35rem .55rem;font-size:.68rem;color:var(--muted2)">
                  ${p.hallazgos_periodo>0
                    ? `${p.hallazgos_periodo} hallazgo${p.hallazgos_periodo>1?'s':''} registrados en el período`
                    : 'Sin actividad registrada en el período'}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- IV. Tareas DFP -->
    <div style="border-bottom:1px solid var(--border)">
      <div style="background:#f5f5f7;padding:.45rem .85rem;
        font-size:.74rem;font-weight:700;color:var(--text)">
        IV.  DEMANDA FRONTERIZA PREVENTIVA — TAREAS ASIGNADAS
      </div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:.7rem">
          <thead>
            <tr style="background:#f0f0f2">
              <th style="padding:.35rem .55rem;border-bottom:2px solid var(--border)">N°</th>
              <th style="padding:.35rem .55rem;border-bottom:2px solid var(--border)">Tarea</th>
              <th style="padding:.35rem .55rem;border-bottom:2px solid var(--border)">Frecuencia</th>
              <th style="padding:.35rem .55rem;border-bottom:2px solid var(--border)">Responsable</th>
              <th style="padding:.35rem .55rem;border-bottom:2px solid var(--border)">Meta</th>
            </tr>
          </thead>
          <tbody>
            ${lugaresPatrullar.filter(p => p.nivel_final >= 2).map((p,i) => `
              <tr style="${i%2===1?'background:#fafafa':''}">
                <td style="padding:.35rem .55rem">${String(i+1).padStart(2,'0')}</td>
                <td style="padding:.35rem .55rem;font-size:.69rem">
                  ${p.tareas_especificas}
                </td>
                <td style="padding:.35rem .55rem;white-space:nowrap">
                  ${p.frec_label}
                </td>
                <td style="padding:.35rem .55rem">Jefe Destacamento</td>
                <td style="padding:.35rem .55rem;font-weight:600;
                  color:${_colorNivel(p.nivel_final)}">
                  ${p.meta_cumplimiento}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- V. Instrucciones generales -->
    <div style="border-bottom:1px solid var(--border)">
      <div style="background:#f5f5f7;padding:.45rem .85rem;
        font-size:.74rem;font-weight:700;color:var(--text)">
        V.  INSTRUCCIONES GENERALES DEL SERVICIO
      </div>
      <div style="padding:.65rem .85rem">
        <textarea id="csf-instrucciones"
          style="width:100%;border:1px solid var(--border);border-radius:6px;
            padding:.5rem;font-size:.73rem;color:var(--text);
            background:var(--bg2);min-height:100px;resize:vertical"
          onchange="_csfBorrador.instrucciones_generales=this.value"
        >${borrador.instrucciones_generales}</textarea>
      </div>
    </div>

    <!-- VI. Firmas -->
    <div>
      <div style="background:#f5f5f7;padding:.45rem .85rem;
        font-size:.74rem;font-weight:700;color:var(--text)">
        VI.  FIRMAS Y VALIDACIÓN
      </div>
      <div style="padding:.75rem .85rem;display:grid;
        grid-template-columns:1fr 1fr;gap:1rem">
        <div style="text-align:center;padding:1rem;
          border:1px dashed var(--border);border-radius:6px">
          <div style="font-size:.72rem;font-weight:700;margin-bottom:.5rem">
            Comisario · Validador
          </div>
          <div style="font-size:.68rem;color:var(--muted)">Firma y timbre</div>
        </div>
        <div style="text-align:center;padding:1rem;
          border:1px dashed var(--border);border-radius:6px">
          <div style="font-size:.72rem;font-weight:700;margin-bottom:.5rem">
            Subprefecto Fronterizo · Autorización
          </div>
          <div style="font-size:.68rem;color:var(--muted)">Firma y timbre</div>
        </div>
      </div>
    </div>

  </div>

  <!-- Botones de acción -->
  <div style="display:flex;gap:.75rem;flex-wrap:wrap;margin-top:1rem">
    <button class="btn btn-primario" onclick="_publicarCSF()">
      ✓ Publicar y guardar CSF
    </button>
    <button class="btn btn-secundario" onclick="_exportarCSFPDF()">
      ↓ Exportar PDF
    </button>
    <div style="font-size:.72rem;color:var(--muted);align-self:center">
      Período: ${est.total_servicios} servicios ·
      ${est.puntos_visitados}/${est.puntos_totales} puntos visitados ·
      ${est.total_detenciones} detenciones · ${est.total_uf.toFixed(0)} UF
    </div>
  </div>`
}

function _metaCelda(label, valor) {
  return `<div style="padding:.35rem .65rem;border-right:1px solid var(--border)">
    <div style="font-size:9px;font-weight:700;letter-spacing:1px;
      text-transform:uppercase;color:var(--muted);margin-bottom:2px">${label}</div>
    <div style="font-size:.74rem;font-weight:600;color:var(--text)">${valor}</div>
  </div>`
}

function _colorNivel(n) {
  if (n >= 5) return '#d70015'
  if (n === 4) return '#d70015'
  if (n === 3) return '#c45000'
  if (n === 2) return '#9a6e00'
  return '#1a6b2a'
}

function _instruccionesDefault() {
  return `A. El personal en servicio fronterizo debe portar permanentemente: GPS, teléfono satelital, arma primaria y secundaria, binoculares/visor nocturno, chaleco balístico obligatorio, sistema fotográfico, equipo radial portátil y carta topográfica.

B. En todo procedimiento el personal policial debe garantizar medidas de seguridad de Técnicas en Zonas Fronterizas respecto a los individuos controlados.

C. El Jefe de Patrulla es responsable de documentar el cumplimiento de los lineamientos de la presente CSF. Los registros deben ser precisos y reflejar fielmente las acciones ejecutadas.

D. En ninguna circunstancia se permitirá que el personal policial cruce el Límite Político Internacional de la República de Chile.`
}

// ── Publicar CSF ─────────────────────────────────────────────
async function _publicarCSF() {
  if (!_csfBorrador || !_csfDatos) {
    toast('Genere primero el borrador','err'); return
  }
  const amenaza    = el('csf-amenaza')?.value || _csfBorrador.amenaza_principal
  const instrucciones = el('csf-instrucciones')?.value || _csfBorrador.instrucciones_generales

  try {
    // Guardar CSF principal
    const { data: csf, error: csfErr } = await APP.sb.from('csf').insert({
      cuartel_id:             _csfBorrador.cuartel_id,
      numero:                 _csfBorrador.numero,
      clasificacion:          _csfBorrador.clasificacion,
      fecha_emision:          _csfBorrador.fecha_emision,
      fecha_vigencia_inicio:  _csfBorrador.fecha_vigencia_inicio,
      fecha_vigencia_fin:     _csfBorrador.fecha_vigencia_fin,
      amenaza_principal:      amenaza,
      instrucciones_generales:instrucciones,
      elaborado_por:          APP.perfil?.id,
      estado:                 'publicada',
    }).select().single()
    if (csfErr) throw csfErr

    // Guardar puntos de la CSF
    const puntosPayload = _csfDatos.puntos.map(p => ({
      csf_id:                csf.id,
      punto_id:              p.id,
      nivel_criticidad:      p.nivel_final,
      frecuencia_asignada:   p.frec_final,
      visitas_requeridas:    p.visitas_requeridas,
      tareas_especificas:    p.tareas_especificas,
      meta_cumplimiento:     p.meta_cumplimiento,
      score_inteligencia:    p.hallazgos_periodo * 10,
    }))
    if (puntosPayload.length) {
      const { error: ptErr } = await APP.sb.from('csf_puntos').insert(puntosPayload)
      if (ptErr) throw ptErr
    }

    toast('CSF publicada correctamente','ok')
    _csfBorrador = null; _csfDatos = null
    await _cambiarTabCSF('historial')

  } catch(e) {
    toast('Error al publicar: '+e.message,'err')
  }
}

// ── Exportar PDF ─────────────────────────────────────────────
function _exportarCSFPDF() {
  if (!_csfBorrador) { toast('Genere primero el borrador','err'); return }
  const contenido = document.querySelector('.card[style*="border:2px solid var(--verde)"]')
  if (!contenido) { toast('Vista previa no disponible','err'); return }
  // Abrir ventana de impresión del borrador
  const w = window.open('','_blank')
  w.document.write(`
    <html><head><title>${_csfBorrador.numero}</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:11px;margin:20px}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #ccc;padding:4px 6px;text-align:left}
      th{background:#f0f0f0;font-weight:bold}
      .verde{color:#1a6b2a} .rojo{color:#d70015}
      @media print{button{display:none}}
    </style></head><body>
    ${contenido.outerHTML}
    <br><button onclick="window.print()">Imprimir / Guardar PDF</button>
    </body></html>`)
  w.document.close()
}

// ════════════════════════════════════════════════════════════
// TAB 2: SEGUIMIENTO DE CSF ACTIVA
// ════════════════════════════════════════════════════════════
async function _renderSeguimiento() {
  const zona = el('csf-contenido')
  zona.innerHTML = `<div class="cargando">Cargando CSF activa...</div>`

  // Buscar la CSF más reciente del cuartel
  const cuartelId = _csfCuartelId || APP.cuartel?.id
  if (!cuartelId) {
    zona.innerHTML = `<div class="card" style="color:var(--muted);padding:1rem">
      Seleccione un cuartel para ver el seguimiento.</div>`
    return
  }

  const { data: csfs } = await APP.sb.from('csf').select('*')
    .eq('cuartel_id', cuartelId)
    .eq('estado', 'publicada')
    .order('fecha_emision', {ascending:false})
    .limit(1)

  if (!csfs?.length) {
    zona.innerHTML = `
      <div class="card" style="text-align:center;padding:2rem">
        <div style="font-size:2rem;margin-bottom:.75rem">📄</div>
        <div style="font-size:.85rem;font-weight:700;margin-bottom:.5rem">
          Sin CSF activa para este cuartel
        </div>
        <div style="font-size:.75rem;color:var(--muted)">
          Genere y publique una CSF en la pestaña "Generar CSF"
        </div>
      </div>`
    return
  }

  const csfActiva = csfs[0]
  try {
    const cum = await calcularCumplimientoCSF(csfActiva.id, cuartelId)
    zona.innerHTML = _htmlSeguimiento(cum)
  } catch(e) {
    zona.innerHTML = `<div class="card" style="color:var(--rojo);padding:1rem">
      Error: ${e.message}</div>`
  }
}

function _htmlSeguimiento(cum) {
  const diasRestantes = Math.max(0,
    Math.ceil((new Date(cum.csf.fecha_vigencia_fin||'2099-01-01') - new Date()) / 864e5))

  return `
    <!-- Header seguimiento -->
    <div class="card gap3" style="border-left:4px solid var(--verde);
      margin-bottom:1rem">
      <div style="display:flex;justify-content:space-between;
        align-items:flex-start;flex-wrap:wrap;gap:.5rem">
        <div>
          <div class="sec-titulo" style="margin:0">
            SEGUIMIENTO ${cum.csf.numero}
          </div>
          <div style="font-size:.72rem;color:var(--muted);margin-top:3px">
            ${cum.csf.fecha_vigencia_inicio} → ${cum.csf.fecha_vigencia_fin||'vigente'}
            · Día ${cum.dias_transcurridos} de ${cum.dias_totales}
            ${diasRestantes > 0 ? `· ${diasRestantes} días restantes` : '· VENCIDA'}
          </div>
        </div>
        <button class="btn btn-secundario" style="font-size:.72rem"
          onclick="_renderSeguimiento()">↺ Actualizar</button>
      </div>
    </div>

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);
      gap:.6rem;margin-bottom:1rem">
      ${_kpiSeg(`${cum.pct_global}%`,  'Cumplimiento global',
        cum.pct_global>=90?'var(--verde)':cum.pct_global>=70?'var(--amarillo)':'var(--rojo)')}
      ${_kpiSeg(`${cum.puntos_al_dia}/${cum.puntos.length}`, 'Puntos al día','var(--azul)')}
      ${_kpiSeg(cum.puntos_atrasados,  'Alertas activas',    'var(--rojo)')}
      ${_kpiSeg(`${cum.mayor_atraso_dias}d`, 'Mayor atraso', 'var(--amarillo)')}
    </div>

    <!-- Alertas -->
    ${cum.puntos.filter(p=>p.estado==='atrasado').map(p=>`
      <div style="background:#fff0f1;border:1.5px solid var(--rojo);
        border-radius:8px;padding:.65rem .85rem;margin-bottom:.5rem">
        <div style="font-size:.77rem;font-weight:700;color:var(--rojo)">
          🚨 INCUMPLIMIENTO — ${p.nombre}
        </div>
        <div style="font-size:.7rem;color:#9a0010;margin-top:2px">
          Exige ${p.frec_label} · Última visita hace ${p.dias_sin_visita} días
          · ${p.visitas_ejecutadas}/${p.visitas_requeridas} visitas ejecutadas
        </div>
        <button class="btn btn-secundario"
          style="font-size:.65rem;padding:.25rem .6rem;margin-top:.4rem"
          onclick="_abrirReprogramacion('${p.punto_id}','${p.nombre}')">
          Registrar reprogramación
        </button>
      </div>`).join('')}

    <!-- Tabla por punto -->
    <div class="card" style="padding:0;overflow:hidden">
      <div style="background:#f5f5f7;padding:.5rem .85rem;font-size:.74rem;
        font-weight:700;color:var(--text)">
        Estado por punto territorial
      </div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:.72rem">
          <thead>
            <tr style="background:#f5f5f7">
              <th style="padding:.35rem .6rem;text-align:left;
                border-bottom:2px solid var(--border)">Punto</th>
              <th style="padding:.35rem .6rem;border-bottom:2px solid var(--border)">Tipo</th>
              <th style="padding:.35rem .6rem;border-bottom:2px solid var(--border)">Frec.</th>
              <th style="padding:.35rem .6rem;border-bottom:2px solid var(--border)">Req.</th>
              <th style="padding:.35rem .6rem;border-bottom:2px solid var(--border)">Ejec.</th>
              <th style="padding:.35rem .6rem;border-bottom:2px solid var(--border)">Cumpl.</th>
              <th style="padding:.35rem .6rem;border-bottom:2px solid var(--border)">Última visita</th>
              <th style="padding:.35rem .6rem;border-bottom:2px solid var(--border)">Estado</th>
            </tr>
          </thead>
          <tbody>
            ${cum.puntos.map((p,i) => {
              const estadoColor = p.estado==='al_dia'?'#e8f5ea':p.estado==='atrasado'?'#fff0f1':'#fffbea'
              const estadoLabel = p.estado==='al_dia'?'✓ Al día':p.estado==='atrasado'?'✕ Atrasado':'⚠ Próximo'
              const estadoText  = p.estado==='al_dia'?'#1a6b2a':p.estado==='atrasado'?'#d70015':'#9a6e00'
              return `
              <tr style="${i%2===1?'background:#fafafa':''}">
                <td style="padding:.4rem .6rem;font-weight:600">${p.nombre}</td>
                <td style="padding:.4rem .6rem;text-align:center">
                  <span style="font-size:.65rem;font-weight:700;padding:1px 5px;
                    border-radius:3px;
                    background:${p.tipo==='pnh'?'#fff0f1':p.tipo==='hito'?'#e8f5ea':'#e8f0fe'};
                    color:${p.tipo==='pnh'?'#d70015':p.tipo==='hito'?'#1a6b2a':'#0055d4'}">
                    ${p.tipo.toUpperCase()}
                  </span>
                </td>
                <td style="padding:.4rem .6rem;font-size:.68rem">${p.frec_label}</td>
                <td style="padding:.4rem .6rem;text-align:center">${p.visitas_requeridas}</td>
                <td style="padding:.4rem .6rem;text-align:center;font-weight:700">${p.visitas_ejecutadas}</td>
                <td style="padding:.4rem .6rem">
                  <div style="background:#f0f0f2;border-radius:3px;
                    height:6px;overflow:hidden;width:60px;display:inline-block;
                    vertical-align:middle">
                    <div style="height:6px;width:${p.pct_cumplimiento}%;
                      background:${estadoText};border-radius:3px"></div>
                  </div>
                  <span style="margin-left:.3rem;font-weight:700;
                    color:${estadoText}">${p.pct_cumplimiento}%</span>
                </td>
                <td style="padding:.4rem .6rem;font-size:.68rem;color:var(--muted)">
                  ${p.ultima_visita||'—'}
                  ${p.dias_sin_visita?`<span style="color:${estadoText}"> (${p.dias_sin_visita}d)</span>`:''}
                </td>
                <td style="padding:.4rem .6rem">
                  <span style="background:${estadoColor};color:${estadoText};
                    font-size:.68rem;font-weight:700;padding:2px 7px;border-radius:3px">
                    ${estadoLabel}
                  </span>
                </td>
              </tr>`}).join('')}
          </tbody>
        </table>
      </div>
    </div>`
}

function _kpiSeg(valor, label, color) {
  return `
    <div style="background:#fff;border:1px solid var(--border);
      border-radius:10px;padding:.65rem .5rem;text-align:center">
      <div style="font-size:1.5rem;font-weight:700;
        letter-spacing:-1px;line-height:1;color:${color}">${valor}</div>
      <div style="font-size:.6rem;font-weight:700;letter-spacing:.5px;
        color:var(--muted);margin-top:.2rem">${label}</div>
    </div>`
}

// ── Modal reprogramación ──────────────────────────────────────
function _abrirReprogramacion(puntoId, puntoNombre) {
  const modal = document.createElement('div')
  modal.id = 'modal-reprog'
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.5);
    display:flex;align-items:center;justify-content:center;z-index:9999`
  modal.innerHTML = `
    <div style="background:#fff;border-radius:14px;padding:1.5rem;
      width:480px;max-width:95vw;max-height:90vh;overflow-y:auto">
      <div style="font-size:.9rem;font-weight:700;color:var(--text);
        margin-bottom:1rem">Registrar Reprogramación — ${puntoNombre}</div>
      <div class="campo gap">
        <label for="rep-causal">Causal</label>
        <select id="rep-causal">
          <option value="meteorologica">🌩 Meteorológica — Condiciones climáticas extremas</option>
          <option value="mecanica">🔧 Mecánica — Vehículo en taller / avería</option>
          <option value="logistica">📦 Logística — Sin combustible / ruta cortada</option>
          <option value="operativa_prioritaria">🚨 Operativa prioritaria — Servicio de urgencia</option>
          <option value="administrativa">📋 Administrativa — Capacitación / comisión oficial</option>
        </select>
      </div>
      <div class="campo gap">
        <label for="rep-tipo">Tipo de ajuste</label>
        <select id="rep-tipo">
          <option value="traslado_mismo_periodo">Trasladar a nueva fecha (mismo período)</option>
          <option value="descuento_periodo">Descontar del período — no recuperar</option>
          <option value="traslado_siguiente_periodo">Trasladar al siguiente período</option>
        </select>
      </div>
      <div class="campo gap">
        <label for="rep-fecha">Nueva fecha (si aplica)</label>
        <input id="rep-fecha" type="date" />
      </div>
      <div class="campo gap">
        <label for="rep-detalle">Detalle</label>
        <textarea id="rep-detalle" placeholder="Descripción de la situación..."
          style="min-height:60px"></textarea>
      </div>
      <div style="display:flex;gap:.75rem;margin-top:1rem">
        <button class="btn btn-primario" onclick="_guardarReprogramacion('${puntoId}')">
          Guardar solicitud
        </button>
        <button class="btn btn-secundario" onclick="document.getElementById('modal-reprog').remove()">
          Cancelar
        </button>
      </div>
    </div>`
  document.body.appendChild(modal)
}

async function _guardarReprogramacion(puntoId) {
  const cuartelId = _csfCuartelId || APP.cuartel?.id
  const { data: csfs } = await APP.sb.from('csf').select('id')
    .eq('cuartel_id', cuartelId).eq('estado','publicada')
    .order('fecha_emision',{ascending:false}).limit(1)
  if (!csfs?.length) { toast('Sin CSF activa','err'); return }

  const { error } = await APP.sb.from('reprogramaciones_csf').insert({
    csf_id:         csfs[0].id,
    punto_id:       puntoId,
    cuartel_id:     cuartelId,
    fecha_original: new Date().toISOString().split('T')[0],
    fecha_nueva:    el('rep-fecha')?.value || null,
    tipo_ajuste:    el('rep-tipo')?.value,
    causal:         el('rep-causal')?.value,
    detalle:        el('rep-detalle')?.value,
    solicitado_por: APP.perfil?.id,
    estado:         APP.esAdmin ? 'aprobada' : 'pendiente',
  })
  if (error) { toast('Error: '+error.message,'err'); return }
  document.getElementById('modal-reprog')?.remove()
  toast(APP.esAdmin ? 'Reprogramación aprobada automáticamente' : 'Solicitud enviada al Administrador','ok')
  await _renderSeguimiento()
}

// ════════════════════════════════════════════════════════════
// TAB 3: HISTORIAL DE CSF
// ════════════════════════════════════════════════════════════
async function _renderHistorial() {
  const zona      = el('csf-contenido')
  const cuartelId = _csfCuartelId || APP.cuartel?.id
  const cuarteles = await obtenerCuarteles()

  const { data: csfs } = await APP.sb.from('csf')
    .select('*, cuartel:cuarteles(nombre)')
    .eq('cuartel_id', cuartelId)
    .order('fecha_emision', {ascending:false})
    .limit(20)

  zona.innerHTML = `
    <div style="display:flex;gap:.75rem;align-items:center;margin-bottom:1rem;flex-wrap:wrap">
      <div class="campo" style="margin:0;flex:1;min-width:200px">
        <label for="hist-cuartel">Cuartel</label>
        <select id="hist-cuartel"
          onchange="_csfCuartelId=this.value;_cambiarTabCSF('historial')">
          ${cuarteles.map(c=>
            `<option value="${c.id}" ${c.id===cuartelId?'selected':''}>${c.nombre}</option>`
          ).join('')}
        </select>
      </div>
    </div>

    ${!csfs?.length
      ? `<div class="card" style="text-align:center;padding:2rem;color:var(--muted)">
          Sin CSF generadas para este cuartel</div>`
      : `<div class="card" style="padding:0;overflow:hidden">
          <table style="width:100%;border-collapse:collapse;font-size:.75rem">
            <thead>
              <tr style="background:#f5f5f7">
                <th style="padding:.4rem .7rem;text-align:left;border-bottom:2px solid var(--border)">N° CSF</th>
                <th style="padding:.4rem .7rem;border-bottom:2px solid var(--border)">Emisión</th>
                <th style="padding:.4rem .7rem;border-bottom:2px solid var(--border)">Vigencia</th>
                <th style="padding:.4rem .7rem;border-bottom:2px solid var(--border)">Clasif.</th>
                <th style="padding:.4rem .7rem;border-bottom:2px solid var(--border)">Estado</th>
                <th style="padding:.4rem .7rem;border-bottom:2px solid var(--border)"></th>
              </tr>
            </thead>
            <tbody>
              ${(csfs||[]).map((c,i) => `
                <tr style="${i%2===1?'background:#fafafa':''}">
                  <td style="padding:.4rem .7rem;font-weight:700">${c.numero||'—'}</td>
                  <td style="padding:.4rem .7rem">${c.fecha_emision||'—'}</td>
                  <td style="padding:.4rem .7rem;font-size:.68rem">
                    ${c.fecha_vigencia_inicio} → ${c.fecha_vigencia_fin||'vigente'}
                  </td>
                  <td style="padding:.4rem .7rem">
                    <span style="background:#fff0f1;color:#d70015;
                      font-size:.65rem;font-weight:700;padding:1px 6px;
                      border-radius:3px">${c.clasificacion||'—'}</span>
                  </td>
                  <td style="padding:.4rem .7rem">
                    <span style="background:${c.estado==='publicada'?'#e8f5ea':'#f0f0f2'};
                      color:${c.estado==='publicada'?'#1a6b2a':'#6e6e73'};
                      font-size:.65rem;font-weight:700;padding:1px 6px;border-radius:3px">
                      ${(c.estado||'borrador').toUpperCase()}
                    </span>
                  </td>
                  <td style="padding:.4rem .7rem">
                    <button class="btn btn-secundario"
                      style="font-size:.65rem;padding:.2rem .5rem"
                      onclick="_verDetalleCSF('${c.id}')">
                      Ver
                    </button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`}
  `
}

async function _verDetalleCSF(csfId) {
  const { data: csf } = await APP.sb.from('csf').select('*').eq('id',csfId).single()
  const { data: pts } = await APP.sb.from('csf_puntos')
    .select('*, punto:puntos_territoriales(nombre,tipo)')
    .eq('csf_id', csfId)
  if (!csf) return

  const w = window.open('','_blank')
  w.document.write(`
    <html><head><title>${csf.numero}</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:11px;margin:20px;color:#333}
      h2{color:#1a6b2a;font-size:14px}
      table{width:100%;border-collapse:collapse;margin:8px 0}
      th,td{border:1px solid #ccc;padding:4px 6px;text-align:left;font-size:11px}
      th{background:#f0f0f0;font-weight:bold}
      .badge{display:inline-block;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:bold}
    </style></head><body>
    <h2>CARTA DE SITUACIÓN FRONTERIZA — ${csf.numero}</h2>
    <table>
      <tr><td><b>Clasificación</b></td><td>${csf.clasificacion}</td>
          <td><b>Emisión</b></td><td>${csf.fecha_emision}</td></tr>
      <tr><td><b>Vigencia desde</b></td><td>${csf.fecha_vigencia_inicio}</td>
          <td><b>Vigencia hasta</b></td><td>${csf.fecha_vigencia_fin||'—'}</td></tr>
    </table>
    <h2>I. Amenaza Principal</h2>
    <p>${csf.amenaza_principal||'—'}</p>
    <h2>II–IV. Puntos Territoriales</h2>
    <table>
      <thead><tr><th>Punto</th><th>Tipo</th><th>Nivel</th><th>Frecuencia</th><th>Meta</th></tr></thead>
      <tbody>
        ${(pts||[]).map(p=>`
          <tr>
            <td>${p.punto?.nombre||'—'}</td>
            <td>${p.punto?.tipo||'—'}</td>
            <td>${p.nivel_criticidad||'—'}</td>
            <td>${FRECUENCIA_LABELS[p.frecuencia_asignada]||p.frecuencia_asignada||'—'}</td>
            <td>${p.meta_cumplimiento||'—'}</td>
          </tr>`).join('')}
      </tbody>
    </table>
    <h2>V. Instrucciones Generales</h2>
    <p>${(csf.instrucciones_generales||'').replace(/\n/g,'<br>')}</p>
    <br><button onclick="window.print()">Imprimir / Guardar PDF</button>
    </body></html>`)
  w.document.close()
}
