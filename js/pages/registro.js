// ============================================================
// SISCOF v3 — Registro de Servicio (Wizard 4 pasos)
// Nuevos: M5 Decreto N°78, turno nocturno, alerta cohecho,
//         offline (IndexedDB), R7 bienes COT sin detenido
// ============================================================

let _paso = 1
let _servicio = {}
let _tareas   = []
let _personal = []
let _vehiculos= []
let _puntos   = []
let _m5Activo = false

const TIPOS_TAREA = {
  territorial: [
    { tipo: 'visita_hito',       icono: '🏔', label: 'Visita a Hito Fronterizo' },
    { tipo: 'fiscalizacion_pnh', icono: '🚧', label: 'Fiscalización PNH' },
    { tipo: 'visita_sie',        icono: '🏛', label: 'Visita a SIE' },
    { tipo: 'coordinacion',      icono: '🤝', label: 'Coordinación Institucional' },
    { tipo: 'entrevista',        icono: '👥', label: 'Entrevista / Fuente Humana' },
    { tipo: 'patrullaje',        icono: '🗺', label: 'Patrullaje General' },
  ],
  operativa: [
    { tipo: 'control_vehicular_sin', icono: '🚗',   label: 'Control Vehicular Sin Novedad' },
    { tipo: 'control_vehicular_con', icono: '🚗⚡', label: 'Control Vehicular Con Resultado' },
    { tipo: 'control_migratorio',    icono: '🛂',   label: 'Control Migratorio' },
    { tipo: 'detencion',             icono: '⚖️',   label: 'Detención' },
    { tipo: 'incautacion',           icono: '📦',   label: 'Incautación Sin Detenido' },
    { tipo: 'bien_cot_sin_detenido', icono: '🎯',   label: 'Bien COT Sin Detenido (R7)' },
    { tipo: 'rescate',               icono: '🆘',   label: 'Rescate / Asistencia' },
    { tipo: 'hallazgo_encargo',      icono: '🔎',   label: 'Bien Con Encargo' },
  ],
  administrativa: [
    { tipo: 'traslado_admin', icono: '⛽', label: 'Traslado Administrativo' },
    { tipo: 'mantenimiento',  icono: '🔧', label: 'Mantenimiento' },
    { tipo: 'apoyo_unidad',   icono: '🤲', label: 'Apoyo Otra Unidad' },
    { tipo: 'otro_admin',     icono: '📋', label: 'Otro' },
  ],
}

const TIPOS_FLAT = Object.values(TIPOS_TAREA).flat()
const DELITOS = {
  trafico_drogas: 'Tráfico de drogas',   trafico_migrantes: 'Tráfico de migrantes',
  trata_personas: 'Trata de personas',   contrabando: 'Contrabando',
  armas: 'Porte ilegal de armas',        falsificacion: 'Falsificación documental',
  abigeato: 'Abigeato', receptacion: 'Receptación', cohecho: 'Cohecho', otro: 'Otro',
}
const NACIONALIDADES = ['BOLIVIANO','PERUANO','CHILENO','VENEZOLANO','COLOMBIANO','ECUATORIANO','ARGENTINO','OTRO']

async function renderRegistro() {
  if (!APP.puedeRegistrar) {
    el('pantalla-registro').innerHTML = `<div class="cargando">SIN ACCESO</div>`
    return
  }
  el('pantalla-registro').innerHTML = `<div class="cargando">CARGANDO...</div>`
  _personal  = await obtenerPersonalConFallback(APP.cuartel.id)
  _vehiculos = await obtenerVehiculosConFallback(APP.cuartel.id)
  _puntos    = await obtenerPuntosConFallback(APP.cuartel.id)
  _paso = 1; _m5Activo = false
  _servicio = {
    personal_id:'', nombre_jefe:'', fecha: hoy(), turno:'',
    hora_inicio:'', vehiculo_id:'', patente_texto:'', km_inicio:'',
    hora_termino:'', km_termino:'', obs_generales:'',
    tiene_mision_ffaa: false, unidad_ffaa: '',
  }
  _tareas = []
  renderPaso()
}

function hoy() { return new Date().toISOString().split('T')[0] }

function renderPaso() {
  const wrap = el('pantalla-registro')
  wrap.innerHTML = `
    <div class="container-sm">
      ${progreso()}
      <div class="card" id="paso-contenido">
        ${_paso === 1 ? paso1Html() : ''}
        ${_paso === 2 ? paso2Html() : ''}
        ${_paso === 3 ? paso3Html() : ''}
        ${_paso === 4 ? paso4Html() : ''}
      </div>
    </div>`
  if (_paso === 2) bindTareas()
}

function progreso() {
  const labels = ['SERVICIO','TAREAS','CIERRE','CONFIRMAR']
  const items  = labels.map((l, i) => {
    const n = i + 1; const done = _paso > n; const act = _paso === n
    return `<div class="paso-item">
      ${i > 0 ? `<div class="paso-linea"></div>` : ''}
      <div class="paso-circulo ${done || act ? 'done' : ''}">${n}</div>
      <span class="paso-label ${done || act ? 'done' : ''}">${l}</span>
    </div>`
  }).join('')
  return `<div class="progreso gap3">${items}</div>`
}

// ── PASO 1 ────────────────────────────────────────────────────
function paso1Html() {
  const opsPersonal = _personal.map(p =>
    `<option value="${p.id}" data-nombre="${p.grado} ${p.nombre_completo}">${p.grado} ${p.nombre_completo}</option>`).join('')
  const opsVehiculo = _vehiculos.map(v =>
    `<option value="${v.id}" data-patente="${v.patente}">${v.patente} — ${v.tipo || ''}</option>`).join('')
  return `
    <h2 style="font-family:var(--display);font-size:1.5rem;letter-spacing:3px;color:var(--text);margin-bottom:.25rem">PASO 1 — DATOS DEL SERVICIO</h2>
    <p style="font-family:var(--mono);font-size:.68rem;color:var(--muted);margin-bottom:1.5rem">
      Cuartel: <strong style="color:var(--verde)">${APP.cuartel?.nombre}</strong>
      ${!navigator.onLine ? '<span style="color:var(--amarillo);margin-left:.5rem">● MODO OFFLINE</span>' : ''}
    </p>

    <!-- M5 Toggle Decreto N°78 -->
    <div class="m5-toggle-wrap ${_m5Activo ? 'm5-active' : ''}" id="m5-wrap">
      <span class="m5-icon">🪖</span>
      <div class="m5-label">
        <div class="m5-title">M5 — Misión en Apoyo FF.AA.</div>
        <div class="m5-sub">Decreto N°78 / Operativo conjunto con Fuerzas Armadas</div>
      </div>
      <label class="check-label" style="margin:0">
        <input type="checkbox" id="m5-check" ${_m5Activo ? 'checked' : ''}
          onchange="toggleM5(this.checked)" />
        <span style="font-weight:700;font-size:.78rem;color:${_m5Activo ? '#0055d4' : 'var(--muted)'}">
          ${_m5Activo ? 'ACTIVO' : 'Activar'}
        </span>
      </label>
    </div>
    <div id="m5-detalle" style="${_m5Activo ? '' : 'display:none'};margin-bottom:1rem">
      <div class="campo">
        <label>Unidad FF.AA. coordinada</label>
        <input id="m5-unidad" type="text" placeholder="Ej: Regimiento Huamachuco N°23..."
          value="${_servicio.unidad_ffaa}" onchange="_servicio.unidad_ffaa=this.value" />
      </div>
    </div>

    <div class="g2 gap">
      <div class="campo">
        <label>Jefe de Servicio</label>
        <select id="f-personal" onchange="selPersonal(this)">
          <option value="">Seleccionar...</option>${opsPersonal}
        </select>
      </div>
      <div class="campo">
        <label>Turno</label>
        <select id="f-turno">
          <option value="">Seleccionar...</option>
          <option value="manana">Mañana (06:00–14:00)</option>
          <option value="tarde">Tarde (14:00–22:00)</option>
          <option value="noche">Noche (22:00–06:00)</option>
        </select>
      </div>
      <div class="campo">
        <label>Fecha</label>
        <input id="f-fecha" type="date" value="${_servicio.fecha}" />
      </div>
      <div class="campo">
        <label>Hora Inicio</label>
        <input id="f-hora-inicio" type="time" value="${_servicio.hora_inicio}" />
      </div>
      <div class="campo">
        <label>Vehículo</label>
        <select id="f-vehiculo" onchange="selVehiculo(this)">
          <option value="">Seleccionar...</option>${opsVehiculo}
        </select>
      </div>
      <div class="campo">
        <label>Km Inicio</label>
        <input id="f-km-inicio" type="number" value="${_servicio.km_inicio}" placeholder="0" />
      </div>
    </div>
    <div id="p1-error" class="form-error" style="display:none"></div>
    <div class="flex-gap" style="margin-top:1.5rem">
      <button class="btn btn-primario" onclick="irPaso2()">CONTINUAR →</button>
    </div>`
}

function toggleM5(activo) {
  _m5Activo = activo
  _servicio.tiene_mision_ffaa = activo
  const wrap  = el('m5-wrap')
  const det   = el('m5-detalle')
  if (wrap)  wrap.classList.toggle('m5-active', activo)
  if (det)   det.style.display = activo ? '' : 'none'
}

function selPersonal(sel) {
  _servicio.personal_id = sel.value
  _servicio.nombre_jefe = sel.selectedOptions[0]?.dataset.nombre || ''
}
function selVehiculo(sel) {
  _servicio.vehiculo_id   = sel.value
  _servicio.patente_texto = sel.selectedOptions[0]?.dataset.patente || ''
}

function irPaso2() {
  _servicio.turno       = el('f-turno')?.value
  _servicio.fecha       = el('f-fecha')?.value
  _servicio.hora_inicio = el('f-hora-inicio')?.value
  _servicio.km_inicio   = el('f-km-inicio')?.value
  const err = el('p1-error')
  if (!_servicio.nombre_jefe || !_servicio.turno || !_servicio.fecha || !_servicio.hora_inicio) {
    err.textContent = 'Complete todos los campos obligatorios.'; err.style.display = ''; return
  }
  err.style.display = 'none'; _paso = 2; renderPaso()
}

// ── PASO 2 ────────────────────────────────────────────────────
function paso2Html() {
  const timelineHtml = _tareas.length
    ? `<div class="timeline" id="timeline">${_tareas.map((t, i) => tareaHtml(t, i)).join('')}</div>`
    : `<div style="color:var(--muted);font-family:var(--mono);font-size:.72rem;
        letter-spacing:1px;padding:1rem 0;text-align:center">SIN TAREAS AGREGADAS AÚN</div>`
  const botonesHtml = Object.entries(TIPOS_TAREA).map(([cat, tipos]) => `
    <div class="cat-label-bar">
      ${cat === 'territorial' ? '🗺 TERRITORIAL' : cat === 'operativa' ? '⚡ OPERATIVA' : '📋 ADMINISTRATIVA'}
    </div>
    <div class="grid-tareas">
      ${tipos.map(t => `
        <button class="btn-tarea" onclick="agregarTarea('${t.tipo}','${cat}')">
          <span style="font-size:1.2rem">${t.icono}</span><span>${t.label}</span>
        </button>`).join('')}
    </div>`).join('')
  return `
    <h2 style="font-family:var(--display);font-size:1.5rem;letter-spacing:3px;color:var(--text);margin-bottom:.25rem">PASO 2 — TAREAS DEL SERVICIO</h2>
    <p style="font-family:var(--mono);font-size:.68rem;color:var(--muted);margin-bottom:1.25rem">Agregue las tareas en el orden que ocurrieron</p>
    <div id="timeline-wrap">${timelineHtml}</div>
    <div class="selector-tareas gap2">${botonesHtml}</div>
    <div class="flex-gap" style="margin-top:1.5rem">
      <button class="btn btn-secundario" onclick="_paso=1;renderPaso()">← VOLVER</button>
      <button class="btn btn-primario" onclick="_paso=3;renderPaso()">CONTINUAR →</button>
    </div>`
}

function bindTareas() {}

function agregarTarea(tipo, categoria) {
  const id = `t${Date.now()}`
  _tareas.push({
    id, tipo, categoria, orden: _tareas.length + 1,
    punto_id:'', hora_inicio:'', hora_termino:'',
    observaciones:'', tiene_hallazgo: false, tiene_resultado: false,
    cantidad_vehiculos: 0, cantidad_personas: 0,
    institucion:'', nivel_coordinacion:'', detalle_coordinacion:'',
    motivo_administrativo:'',
    resultado: { tipo_resultado:'', tipo_delito:'', numero_parte:'', valor_total_uf:0,
      como_se_detecto:'', como_se_actuo:'', info_para_csf:'', detenidos:[], especies:[] },
    hallazgo: { tipo_evidencia:'', descripcion:'', nivel_relevancia:'medio' }
  })
  const wrap = el('timeline-wrap')
  if (wrap) wrap.innerHTML = `<div class="timeline" id="timeline">${_tareas.map((t, i) => tareaHtml(t, i)).join('')}</div>`
}

function eliminarTarea(id) {
  _tareas = _tareas.filter(t => t.id !== id)
  const wrap = el('timeline-wrap')
  if (wrap) wrap.innerHTML = _tareas.length
    ? `<div class="timeline">${_tareas.map((t, i) => tareaHtml(t, i)).join('')}</div>`
    : `<div style="color:var(--muted);font-family:var(--mono);font-size:.72rem;padding:1rem 0;text-align:center">SIN TAREAS AGREGADAS AÚN</div>`
}

function syncTarea(id, campo, valor) {
  const t = _tareas.find(t => t.id === id)
  if (!t) return
  if (campo.startsWith('res.')) t.resultado[campo.slice(4)] = valor
  else if (campo.startsWith('hal.')) t.hallazgo[campo.slice(4)] = valor
  else t[campo] = valor
}

function tareaHtml(t, index) {
  const info  = TIPOS_FLAT.find(x => x.tipo === t.tipo)
  const puntosFiltrados = _puntos.filter(p =>
    (t.tipo === 'visita_hito'       && p.tipo === 'hito') ||
    (t.tipo === 'fiscalizacion_pnh' && p.tipo === 'pnh')  ||
    (t.tipo === 'visita_sie'        && p.tipo === 'sie')
  )
  const necesitaPunto   = ['visita_hito','fiscalizacion_pnh','visita_sie'].includes(t.tipo)
  const esControl       = t.tipo.startsWith('control_vehicular') || t.tipo === 'control_migratorio'
  const esAdmin         = t.categoria === 'administrativa'
  const esCoord         = t.tipo === 'coordinacion'
  const necesitaRes     = ['control_vehicular_con','detencion','incautacion','hallazgo_encargo','bien_cot_sin_detenido'].includes(t.tipo)

  return `
    <div class="tarea-card cat-${t.categoria}" id="tarea-${t.id}">
      <div class="tarea-header">
        <span class="tarea-icon">${info?.icono || ''}</span>
        <span class="tarea-titulo">#${index+1} — ${info?.label || t.tipo}</span>
        <button class="btn-del" onclick="eliminarTarea('${t.id}')">✕</button>
      </div>
      <div class="g3 gap">
        <div class="campo sm"><label>Hora Inicio</label>
          <input type="time" value="${t.hora_inicio}" onchange="syncTarea('${t.id}','hora_inicio',this.value)" /></div>
        <div class="campo sm"><label>Hora Término</label>
          <input type="time" value="${t.hora_termino}" onchange="syncTarea('${t.id}','hora_termino',this.value)" /></div>
      </div>
      ${necesitaPunto ? `
      <div class="campo sm gap">
        <label>Punto Visitado</label>
        <select onchange="syncTarea('${t.id}','punto_id',this.value)">
          <option value="">Seleccionar punto...</option>
          ${puntosFiltrados.map(p => `<option value="${p.id}">${p.nombre} — ${p.pais}</option>`).join('')}
        </select>
      </div>` : ''}
      ${esCoord ? `
      <div class="g2 gap">
        <div class="campo sm">
          <label>Institución</label>
          <select onchange="syncTarea('${t.id}','institucion',this.value)">
            <option value="">Seleccionar...</option>
            ${['PNP Tacna','PNP Arica','PDI','Aduana','SML','Ejército','Armada','FACh','Otra'].map(i => `<option>${i}</option>`).join('')}
          </select>
        </div>
        <div class="campo sm">
          <label>Nivel</label>
          <select onchange="syncTarea('${t.id}','nivel_coordinacion',this.value)">
            <option value="">Seleccionar...</option>
            <option value="alto">Alto — Operativo bilateral</option>
            <option value="medio">Medio — Intercambio operativo</option>
            <option value="bajo">Bajo — Saludo protocolar</option>
          </select>
        </div>
        <div class="campo sm gc12">
          <label>Detalle</label>
          <input type="text" placeholder="Descripción breve" onchange="syncTarea('${t.id}','detalle_coordinacion',this.value)" />
        </div>
      </div>` : ''}
      ${esAdmin ? `
      <div class="campo sm gap">
        <label>Motivo</label>
        <select onchange="syncTarea('${t.id}','motivo_administrativo',this.value)">
          <option value="">Seleccionar motivo...</option>
          ${['Combustible','Traslado a ciudad','Taller / mecánico','Apoyo a otra unidad','Trámite administrativo','Otro']
            .map(m => `<option>${m}</option>`).join('')}
        </select>
      </div>` : ''}
      ${esControl ? `
      <div class="g2 gap">
        <div class="campo sm"><label>N° Vehículos</label>
          <input type="number" min="0" value="${t.cantidad_vehiculos}" onchange="syncTarea('${t.id}','cantidad_vehiculos',+this.value)" /></div>
        <div class="campo sm"><label>N° Personas</label>
          <input type="number" min="0" value="${t.cantidad_personas}" onchange="syncTarea('${t.id}','cantidad_personas',+this.value)" /></div>
      </div>` : ''}
      ${necesitaRes ? resultadoHtml(t) : ''}
      <label class="check-label" style="margin-top:.75rem">
        <input type="checkbox" ${t.tiene_hallazgo ? 'checked' : ''}
          onchange="syncTarea('${t.id}','tiene_hallazgo',this.checked);toggleHallazgo('${t.id}',this.checked)" />
        <span style="color:var(--amarillo)">¿Hay hallazgo relevante para inteligencia / CSF?</span>
      </label>
      <div id="hallazgo-bloque-${t.id}" class="hallazgo-bloque" style="${t.tiene_hallazgo ? '' : 'display:none'}">
        <div class="g2 gap">
          <div class="campo sm">
            <label>Tipo de Evidencia</label>
            <select onchange="syncTarea('${t.id}','hal.tipo_evidencia',this.value)">
              <option value="">Seleccionar...</option>
              ${['Huellas vehiculares','Huellas peatonales','Residuos recientes','Campamento','Vehículo abandonado','Señalización ilícita','Otro']
                .map(e => `<option>${e}</option>`).join('')}
            </select>
          </div>
          <div class="campo sm">
            <label>Relevancia</label>
            <select onchange="syncTarea('${t.id}','hal.nivel_relevancia',this.value)">
              <option value="alto">Alta</option>
              <option value="medio" selected>Media</option>
              <option value="bajo">Baja</option>
            </select>
          </div>
          <div class="campo sm gc12">
            <label>Descripción detallada</label>
            <textarea placeholder="Hora exacta, ubicación, características, estado de la evidencia..."
              onchange="syncTarea('${t.id}','hal.descripcion',this.value)">${t.hallazgo.descripcion}</textarea>
          </div>
        </div>
      </div>
      ${necesitaPunto && t.punto_id ? `
      <div class="campo sm" style="margin-top:.75rem">
        <label>Observaciones del punto</label>
        <input type="text" placeholder="Estado del punto, novedades..." onchange="syncTarea('${t.id}','observaciones',this.value)" />
      </div>` : ''}
    </div>`
}

function toggleHallazgo(id, show) {
  const b = el(`hallazgo-bloque-${id}`); if (b) b.style.display = show ? '' : 'none'
}

function resultadoHtml(t) {
  return `
    <div class="resultado-bloque" id="res-bloque-${t.id}">
      <div class="resultado-titulo">⚡ RESULTADO DEL PROCEDIMIENTO</div>
      <div class="g2 gap">
        <div class="campo sm">
          <label>Tipo de Resultado</label>
          <select onchange="syncTarea('${t.id}','res.tipo_resultado',this.value);syncTarea('${t.id}','tiene_resultado',true)">
            <option value="">Seleccionar...</option>
            <option value="detencion">Detención</option>
            <option value="infraccion_migratoria">Infracción migratoria</option>
            <option value="documento_falsificado">Documento falsificado</option>
            <option value="vehiculo_encargo">Vehículo / bien con encargo</option>
            <option value="incautacion_sin_detenido">Incautación sin detenido</option>
            <option value="bien_cot_sin_detenido">Bien COT sin detenido (R7)</option>
            <option value="objetivo_internacional">Objetivo internacional</option>
            <option value="otro">Otro positivo</option>
          </select>
        </div>
        <div class="campo sm">
          <label>Tipo de Delito</label>
          <select onchange="syncTarea('${t.id}','res.tipo_delito',this.value)">
            <option value="">Sin delito / N/A</option>
            ${Object.entries(DELITOS).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}
          </select>
        </div>
        <div class="campo sm">
          <label>N° Parte (obligatorio)</label>
          <input type="text" placeholder="Ej: 1234/2026" onchange="syncTarea('${t.id}','res.numero_parte',this.value)" />
        </div>
        <div class="campo sm">
          <label>Valor Total (UF)</label>
          <input type="number" step="0.01" value="0" onchange="syncTarea('${t.id}','res.valor_total_uf',+this.value)" />
        </div>
      </div>
      <div class="flex-sb" style="margin-bottom:.5rem">
        <span class="sec-titulo" style="margin:0">DETENIDOS</span>
        <button class="btn-add" onclick="agregarDetenido('${t.id}')">+ Agregar detenido</button>
      </div>
      <div id="detenidos-${t.id}"></div>
      <div class="flex-sb" style="margin-bottom:.5rem;margin-top:.75rem">
        <span class="sec-titulo" style="margin:0">ESPECIES INCAUTADAS</span>
        <button class="btn-add" onclick="agregarEspecie('${t.id}')">+ Agregar especie</button>
      </div>
      <div id="especies-${t.id}"></div>
      <div class="campo sm gap">
        <label>¿Cómo se detectó?</label>
        <select onchange="syncTarea('${t.id}','res.como_se_detecto',this.value)">
          <option value="">Seleccionar...</option>
          ${['Patrullaje rutinario','Punto de control','Inteligencia previa','Coordinación externa','Denuncia ciudadana']
            .map(o => `<option>${o}</option>`).join('')}
        </select>
      </div>
      <div class="campo sm">
        <label>Información útil para la CSF</label>
        <textarea placeholder="Modus operandi, datos de interés, recomendaciones..."
          onchange="syncTarea('${t.id}','res.info_para_csf',this.value)"></textarea>
      </div>
    </div>`
}

function agregarDetenido(tareaId) {
  const t = _tareas.find(t => t.id === tareaId); if (!t) return
  const did = `d${Date.now()}`
  t.resultado.detenidos.push({ id: did, nacionalidad:'', edad:'', sexo:'', situacion_migratoria:'irregular', tiene_alerta_internacional: false })
  renderDetenidosEspecies(tareaId)
}
function agregarEspecie(tareaId) {
  const t = _tareas.find(t => t.id === tareaId); if (!t) return
  const eid = `e${Date.now()}`
  t.resultado.especies.push({ id: eid, tipo:'droga', descripcion:'', valor_uf:0, tipo_droga:'', cantidad_droga:'', unidad_droga:'kg', tipo_arma:'', cantidad_armas:1, numero_serie:'', monto_dinero:'', moneda:'CLP', tipo_vehiculo:'', marca:'', modelo:'', patente:'', tenia_encargo:false })
  renderDetenidosEspecies(tareaId)
}

function renderDetenidosEspecies(tareaId) {
  const t = _tareas.find(t => t.id === tareaId); if (!t) return
  const dWrap = el(`detenidos-${tareaId}`)
  if (dWrap) dWrap.innerHTML = t.resultado.detenidos.map(d => `
    <div style="background:var(--bg2);padding:.6rem;border-radius:var(--radius);margin-bottom:.4rem">
      <div class="g3">
        <div class="campo sm"><label>Nacionalidad</label>
          <select onchange="syncDetenido('${tareaId}','${d.id}','nacionalidad',this.value)">
            <option value="">Seleccionar...</option>
            ${NACIONALIDADES.map(n => `<option ${d.nacionalidad===n?'selected':''}>${n}</option>`).join('')}
          </select></div>
        <div class="campo sm"><label>Edad</label>
          <input type="number" min="0" max="99" value="${d.edad}" onchange="syncDetenido('${tareaId}','${d.id}','edad',this.value)" /></div>
        <div class="campo sm"><label>Sexo</label>
          <select onchange="syncDetenido('${tareaId}','${d.id}','sexo',this.value)">
            <option value="">—</option>
            <option value="M" ${d.sexo==='M'?'selected':''}>Masculino</option>
            <option value="F" ${d.sexo==='F'?'selected':''}>Femenino</option>
          </select></div>
        <div class="campo sm" style="grid-column:1/3"><label>Situación Migratoria</label>
          <select onchange="syncDetenido('${tareaId}','${d.id}','situacion_migratoria',this.value)">
            <option value="irregular" ${d.situacion_migratoria==='irregular'?'selected':''}>Irregular</option>
            <option value="regular"   ${d.situacion_migratoria==='regular'  ?'selected':''}>Regular</option>
            <option value="solicitante_refugio">Solicitante de refugio</option>
            <option value="no_aplica">No aplica</option>
          </select></div>
        <div class="campo sm" style="grid-column:1/-1">
          <label class="check-label" style="margin:0">
            <input type="checkbox" ${d.tiene_alerta_internacional?'checked':''}
              onchange="syncDetenido('${tareaId}','${d.id}','tiene_alerta_internacional',this.checked)" />
            <span style="color:var(--rojo);font-weight:600">⚑ Objetivo con alerta internacional (DFO-06)</span>
          </label></div>
        <button class="btn-del" style="align-self:flex-end" onclick="eliminarDetenido('${tareaId}','${d.id}')">✕</button>
      </div>
    </div>`).join('')

  const eWrap = el(`especies-${tareaId}`)
  if (eWrap) eWrap.innerHTML = t.resultado.especies.map(e => `
    <div style="background:var(--bg2);padding:.75rem;border-radius:var(--radius);margin-bottom:.4rem">
      <div class="g3 gap">
        <div class="campo sm"><label>Tipo</label>
          <select onchange="syncEspecie('${tareaId}','${e.id}','tipo',this.value)">
            ${['droga','dinero','vehiculo','arma','mercaderia','otro'].map(o => `<option value="${o}" ${e.tipo===o?'selected':''}>${o.charAt(0).toUpperCase()+o.slice(1)}</option>`).join('')}
          </select></div>
        <div class="campo sm"><label>Valor (UF)</label>
          <input type="number" step="0.01" value="${e.valor_uf}" onchange="syncEspecie('${tareaId}','${e.id}','valor_uf',+this.value)" /></div>
        <button class="btn-del" style="align-self:flex-end" onclick="eliminarEspecie('${tareaId}','${e.id}')">✕</button>
      </div>
      ${e.tipo==='droga'?`<div class="g3"><div class="campo sm"><label>Tipo droga</label><input type="text" value="${e.tipo_droga}" placeholder="Cocaína..." onchange="syncEspecie('${tareaId}','${e.id}','tipo_droga',this.value)"/></div><div class="campo sm"><label>Cantidad</label><input type="number" step="0.001" value="${e.cantidad_droga}" onchange="syncEspecie('${tareaId}','${e.id}','cantidad_droga',this.value)"/></div><div class="campo sm"><label>Unidad</label><select onchange="syncEspecie('${tareaId}','${e.id}','unidad_droga',this.value)"><option>kg</option><option>g</option><option>unidades</option></select></div></div>`:''}
      ${e.tipo==='arma'?`<div class="g3"><div class="campo sm"><label>Tipo arma</label><input type="text" value="${e.tipo_arma}" placeholder="Pistola..." onchange="syncEspecie('${tareaId}','${e.id}','tipo_arma',this.value)"/></div><div class="campo sm"><label>Cantidad</label><input type="number" value="${e.cantidad_armas}" onchange="syncEspecie('${tareaId}','${e.id}','cantidad_armas',+this.value)"/></div><div class="campo sm"><label>N° Serie</label><input type="text" value="${e.numero_serie}" onchange="syncEspecie('${tareaId}','${e.id}','numero_serie',this.value)"/></div></div>`:''}
      ${e.tipo==='vehiculo'?`<div class="g3"><div class="campo sm"><label>Tipo</label><input type="text" value="${e.tipo_vehiculo}" placeholder="Camioneta..." onchange="syncEspecie('${tareaId}','${e.id}','tipo_vehiculo',this.value)"/></div><div class="campo sm"><label>Marca</label><input type="text" value="${e.marca}" onchange="syncEspecie('${tareaId}','${e.id}','marca',this.value)"/></div><div class="campo sm"><label>Patente</label><input type="text" value="${e.patente}" onchange="syncEspecie('${tareaId}','${e.id}','patente',this.value)"/></div></div>`:''}
      ${['mercaderia','otro'].includes(e.tipo)?`<div class="campo sm"><label>Descripción</label><input type="text" value="${e.descripcion}" onchange="syncEspecie('${tareaId}','${e.id}','descripcion',this.value)"/></div>`:''}
    </div>`).join('')
}

function syncDetenido(tId, dId, campo, val) {
  const t = _tareas.find(t => t.id === tId); const d = t?.resultado.detenidos.find(d => d.id === dId)
  if (d) d[campo] = val
}
function eliminarDetenido(tId, dId) {
  const t = _tareas.find(t => t.id === tId)
  if (t) { t.resultado.detenidos = t.resultado.detenidos.filter(d => d.id !== dId); renderDetenidosEspecies(tId) }
}
function syncEspecie(tId, eId, campo, val) {
  const t = _tareas.find(t => t.id === tId); const e = t?.resultado.especies.find(e => e.id === eId)
  if (e) e[campo] = val
}
function eliminarEspecie(tId, eId) {
  const t = _tareas.find(t => t.id === tId)
  if (t) { t.resultado.especies = t.resultado.especies.filter(e => e.id !== eId); renderDetenidosEspecies(tId) }
}

// ── PASO 3 ────────────────────────────────────────────────────
function paso3Html() {
  return `
    <h2 style="font-family:var(--display);font-size:1.5rem;letter-spacing:3px;color:var(--text);margin-bottom:1.5rem">PASO 3 — CIERRE DEL SERVICIO</h2>
    <div class="g2 gap">
      <div class="campo"><label>Hora Término</label>
        <input id="f-hora-termino" type="time" value="${_servicio.hora_termino}"
          oninput="detectarTurnoNocturno()" /></div>
      <div class="campo"><label>Km Término</label>
        <input id="f-km-termino" type="number" value="${_servicio.km_termino}" placeholder="0" /></div>
    </div>
    <div id="aviso-nocturno" class="aviso-nocturno"></div>
    <div class="campo gap2">
      <label>Observaciones Generales</label>
      <textarea id="f-obs" placeholder="Condiciones climáticas, novedades menores...">${_servicio.obs_generales}</textarea>
    </div>
    <div class="flex-gap" style="margin-top:1.5rem">
      <button class="btn btn-secundario" onclick="_paso=2;renderPaso()">← VOLVER</button>
      <button class="btn btn-primario" onclick="irPaso4()">REVISAR SERVICIO →</button>
    </div>`
}

function detectarTurnoNocturno() {
  const hI = el('f-hora-inicio') ? (_servicio.hora_inicio || '') : ''
  const hT = el('f-hora-termino')?.value || ''
  const aviso = el('aviso-nocturno')
  if (!aviso || !hI || !hT) return
  if (hT < hI && hT !== '') {
    const [hi, mi] = hI.split(':').map(Number)
    const [ht, mt] = hT.split(':').map(Number)
    const mins = (24*60 - hi*60 - mi) + ht*60 + mt
    const h = Math.floor(mins/60); const m = mins % 60
    aviso.style.display = ''
    aviso.textContent = `🌙 Turno nocturno detectado — Duración calculada: ${h}h ${m}m (cruza medianoche)`
  } else {
    aviso.style.display = 'none'
  }
}

function calcularDuracionNocturna(hI, hT) {
  if (!hI || !hT || hT >= hI) return null
  const [hi, mi] = hI.split(':').map(Number)
  const [ht, mt] = hT.split(':').map(Number)
  return (24*60 - hi*60 - mi) + ht*60 + mt
}

function irPaso4() {
  _servicio.hora_termino  = el('f-hora-termino')?.value
  _servicio.km_termino    = el('f-km-termino')?.value
  _servicio.obs_generales = el('f-obs')?.value
  _paso = 4; renderPaso()
}

// ── PASO 4 ────────────────────────────────────────────────────
function paso4Html() {
  const conResult   = _tareas.filter(t => t.tiene_resultado).length
  const conHallazgo = _tareas.filter(t => t.tiene_hallazgo).length
  const tieneCohecho = verificarCohecho(_tareas)
  return `
    <h2 style="font-family:var(--display);font-size:1.5rem;letter-spacing:3px;color:var(--text);margin-bottom:1.5rem">PASO 4 — CONFIRMAR Y ENVIAR</h2>
    ${tieneCohecho ? `<div class="alerta-cohecho" style="margin-bottom:1rem">
      <div class="alerta-cohecho-titulo">🚨 COHECHO — ALERTA INSTITUCIONAL MÁXIMA</div>
      <div class="alerta-cohecho-sub">Este servicio registra un procedimiento por cohecho. Al enviarlo se notificará la cadena de mando.</div>
    </div>` : ''}
    <div class="resumen-lista gap2">
      ${filaResumen('Cuartel',    APP.cuartel?.nombre)}
      ${filaResumen('Jefe',       _servicio.nombre_jefe)}
      ${filaResumen('Fecha',      _servicio.fecha)}
      ${filaResumen('Turno',      { manana:'Mañana', tarde:'Tarde', noche:'Noche' }[_servicio.turno] || '')}
      ${filaResumen('Horario',    `${_servicio.hora_inicio} → ${_servicio.hora_termino}`)}
      ${filaResumen('Vehículo',   _servicio.patente_texto || '—')}
      ${filaResumen('Km',         `${_servicio.km_inicio || '—'} → ${_servicio.km_termino || '—'}`)}
      ${_servicio.tiene_mision_ffaa ? filaResumen('M5 FF.AA.', `<span style="color:var(--azul);font-weight:600">ACTIVO — ${_servicio.unidad_ffaa || 'Decreto N°78'}</span>`) : ''}
      ${filaResumen('Tareas',     `<span style="color:var(--verde)">${_tareas.length} registradas</span>`)}
      ${conResult   ? filaResumen('Con resultado', `<span style="color:var(--rojo)">${conResult}</span>`) : ''}
      ${conHallazgo ? filaResumen('Hallazgos intel.', `<span style="color:var(--amarillo)">${conHallazgo}</span>`) : ''}
      ${!navigator.onLine ? filaResumen('Conexión', '<span style="color:var(--amarillo)">⚠ OFFLINE — Se sincronizará automáticamente</span>') : ''}
    </div>
    <div class="aviso" style="margin-top:1rem">⚠ Una vez enviado no puede modificarse sin autorización del Administrador.</div>
    <div class="flex-gap" style="margin-top:1.5rem">
      <button class="btn btn-secundario" onclick="_paso=3;renderPaso()">← VOLVER</button>
      <button class="btn btn-primario" id="btn-enviar" onclick="iniciarEnvio()">▶ ENVIAR SERVICIO</button>
    </div>`
}

function filaResumen(key, val) {
  return `<div class="resumen-fila"><span class="resumen-key">${key}</span><span>${val}</span></div>`
}

function iniciarEnvio() {
  if (verificarCohecho(_tareas)) {
    mostrarModalAlerta(
      `Este servicio registra un procedimiento por <strong>cohecho</strong>. El sistema registrará una alerta crítica y notificará la cadena de mando.`,
      (confirmado) => { if (confirmado) enviarServicio() }
    )
  } else {
    enviarServicio()
  }
}

// ── Envío (online + offline) ──────────────────────────────────
async function enviarServicio() {
  const btn = el('btn-enviar')
  if (btn) { btn.disabled = true; btn.textContent = 'GUARDANDO...' }

  // Calcular duración nocturna si aplica
  const durNocturna = calcularDuracionNocturna(_servicio.hora_inicio, _servicio.hora_termino)

  const svcPayload = {
    cuartel_id:     APP.cuartel.id,
    personal_id:    _servicio.personal_id || null,
    nombre_jefe:    _servicio.nombre_jefe,
    fecha:          _servicio.fecha,
    turno:          _servicio.turno,
    hora_inicio:    _servicio.hora_inicio,
    hora_termino:   _servicio.hora_termino || null,
    vehiculo_id:    _servicio.vehiculo_id || null,
    patente_texto:  _servicio.patente_texto || null,
    km_inicio:      parseInt(_servicio.km_inicio) || null,
    km_termino:     parseInt(_servicio.km_termino) || null,
    obs_generales:  _servicio.obs_generales || null,
    tiene_mision_ffaa: _servicio.tiene_mision_ffaa || false,
    unidad_ffaa:    _servicio.unidad_ffaa || null,
    duracion_minutos: durNocturna,
    estado:         'enviado',
  }

  try {
    if (!navigator.onLine) {
      // Guardar offline
      await encolarSync('servicios', 'insert', svcPayload)
      mostrarExito(true)
      return
    }

    const { data: svc, error: svcErr } = await APP.sb.from('servicios')
      .insert(svcPayload).select().single()
    if (svcErr) throw svcErr

    for (const tarea of _tareas) {
      const { data: tar, error: tarErr } = await APP.sb.from('tareas').insert({
        servicio_id: svc.id, cuartel_id: APP.cuartel.id,
        orden: tarea.orden, categoria: tarea.categoria, tipo: tarea.tipo,
        punto_id: tarea.punto_id || null,
        hora_inicio: tarea.hora_inicio || null, hora_termino: tarea.hora_termino || null,
        observaciones: tarea.observaciones || null,
        tiene_hallazgo: tarea.tiene_hallazgo, tiene_resultado: tarea.tiene_resultado,
        cantidad_vehiculos: tarea.cantidad_vehiculos || 0,
        cantidad_personas: tarea.cantidad_personas || 0,
        institucion: tarea.institucion || null,
        nivel_coordinacion: tarea.nivel_coordinacion || null,
        motivo_administrativo: tarea.motivo_administrativo || null,
      }).select().single()
      if (tarErr) throw tarErr

      if (tarea.tiene_hallazgo && tarea.hallazgo.descripcion) {
        await APP.sb.from('hallazgos').insert({
          tarea_id: tar.id, servicio_id: svc.id, cuartel_id: APP.cuartel.id,
          punto_id: tarea.punto_id || null,
          tipo_evidencia: tarea.hallazgo.tipo_evidencia,
          descripcion: tarea.hallazgo.descripcion,
          nivel_relevancia: tarea.hallazgo.nivel_relevancia,
        })
      }

      if (tarea.tiene_resultado && tarea.resultado.tipo_resultado) {
        const { data: res, error: resErr } = await APP.sb.from('resultados').insert({
          tarea_id: tar.id, servicio_id: svc.id, cuartel_id: APP.cuartel.id,
          tipo_resultado: tarea.resultado.tipo_resultado,
          tipo_delito: tarea.resultado.tipo_delito || null,
          numero_parte: tarea.resultado.numero_parte || null,
          valor_total_uf: tarea.resultado.valor_total_uf || 0,
          como_se_detecto: tarea.resultado.como_se_detecto || null,
          info_para_csf: tarea.resultado.info_para_csf || null,
        }).select().single()
        if (resErr) throw resErr

        // Alerta cohecho
        if (tarea.resultado.tipo_delito === 'cohecho') {
          await registrarAlertaCritica('cohecho',
            `Servicio ${svc.id} — Parte N°${tarea.resultado.numero_parte || 'S/N'}`,
            APP.cuartel.id)
        }

        for (const d of tarea.resultado.detenidos) {
          await APP.sb.from('detenidos').insert({
            resultado_id: res.id, servicio_id: svc.id, cuartel_id: APP.cuartel.id,
            nacionalidad: d.nacionalidad, edad: parseInt(d.edad) || null,
            sexo: d.sexo || null, situacion_migratoria: d.situacion_migratoria || null,
            tiene_alerta_internacional: d.tiene_alerta_internacional || false,
          })
        }
        for (const e of tarea.resultado.especies) {
          await APP.sb.from('especies').insert({
            resultado_id: res.id, servicio_id: svc.id, cuartel_id: APP.cuartel.id,
            tipo: e.tipo, descripcion: e.descripcion || null, valor_uf: e.valor_uf || 0,
            tipo_droga: e.tipo_droga || null, cantidad_droga: parseFloat(e.cantidad_droga) || null,
            unidad_droga: e.unidad_droga || null, tipo_arma: e.tipo_arma || null,
            cantidad_armas: parseInt(e.cantidad_armas) || null, numero_serie: e.numero_serie || null,
            tipo_vehiculo: e.tipo_vehiculo || null, marca: e.marca || null,
            modelo: e.modelo || null, patente: e.patente || null,
          })
        }
      }
    }
    mostrarExito(false)
    toast('Servicio registrado correctamente', 'ok')
  } catch (e) {
    toast('Error al guardar: ' + e.message, 'err')
    if (btn) { btn.disabled = false; btn.textContent = '▶ ENVIAR SERVICIO' }
  }
}

function mostrarExito(offline) {
  el('pantalla-registro').innerHTML = `
    <div class="container-sm">
      <div class="exito-wrap">
        <div class="exito-icon">${offline ? '📴' : '✅'}</div>
        <div class="exito-titulo">${offline ? 'GUARDADO OFFLINE' : 'SERVICIO REGISTRADO'}</div>
        <div class="exito-sub">${offline
          ? 'El servicio se sincronizará automáticamente al recuperar la conexión.'
          : 'El servicio ha sido guardado y registrado correctamente.'}</div>
        <button class="btn btn-primario" onclick="renderRegistro()">+ REGISTRAR NUEVO SERVICIO</button>
      </div>
    </div>`
}
