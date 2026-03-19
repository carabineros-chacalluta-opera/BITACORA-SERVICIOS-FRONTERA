// ============================================================
// SISCOF v3 — registro.js — VERSIÓN CONSOLIDADA COMPLETA
// Incluye: GPS, radio influencia, coords sexagesimales,
//          criticidad automática P×C, campos Excel (dirección
//          contrabando, egreso ilegal, avistamiento, daño hito)
// ============================================================

let _paso=1, _servicio={}, _tareas=[], _puntos=[], _m5Activo=false
const _personal=[], _vehiculos=[]

const TIPOS_TAREA = {
  territorial: [
    {tipo:'visita_hito',       icono:'🏔',label:'Visita a Hito Fronterizo'},
    {tipo:'fiscalizacion_pnh', icono:'🚧',label:'Fiscalización PNH'},
    {tipo:'visita_sie',        icono:'🏛',label:'Visita a SIE'},
    {tipo:'coordinacion',      icono:'🤝',label:'Coordinación Institucional'},
    {tipo:'entrevista',        icono:'👥',label:'Entrevista / Fuente Humana'},
    {tipo:'patrullaje',        icono:'🗺',label:'Patrullaje General'},
  ],
  operativa: [
    {tipo:'control_vehicular_sin',icono:'🚗',  label:'Control Vehicular Sin Novedad'},
    {tipo:'control_vehicular_con',icono:'🚗⚡',label:'Control Vehicular Con Resultado'},
    {tipo:'control_migratorio',   icono:'🛂',  label:'Control Migratorio'},
    {tipo:'detencion',            icono:'⚖️',  label:'Detención'},
    {tipo:'incautacion',          icono:'📦',  label:'Incautación Sin Detenido'},
    {tipo:'bien_cot_sin_detenido',icono:'🎯',  label:'Bien COT Sin Detenido (R7)'},
    {tipo:'rescate',              icono:'🆘',  label:'Rescate / Asistencia'},
    {tipo:'hallazgo_encargo',     icono:'🔎',  label:'Bien Con Encargo'},
  ],
  administrativa: [
    {tipo:'traslado_admin',icono:'⛽',label:'Traslado Administrativo'},
    {tipo:'mantenimiento', icono:'🔧',label:'Mantenimiento'},
    {tipo:'apoyo_unidad',  icono:'🤲',label:'Apoyo Otra Unidad'},
    {tipo:'otro_admin',    icono:'📋',label:'Otro'},
  ],
}
const TIPOS_FLAT=Object.values(TIPOS_TAREA).flat()

const DELITOS={
  trafico_drogas:'Tráfico de drogas (Ley 20.000)',
  trafico_migrantes:'Tráfico ilícito de migrantes',
  trata_personas:'Trata de personas',
  contrabando:'Contrabando de mercadería',
  armas:'Contrabando de armas y munición',
  falsificacion:'Falsificación documental',
  abigeato:'Abigeato',
  receptacion:'Receptación',
  cohecho:'Cohecho',
  otro:'Otro',
}
const TIPOS_RESULTADO=[
  {v:'detencion',            l:'Detención'},
  {v:'infraccion_migratoria',l:'Infracción migratoria'},
  {v:'documento_falsificado',l:'Documento falsificado'},
  {v:'vehiculo_encargo',     l:'Vehículo / bien con encargo'},
  {v:'incautacion_sin_detenido',l:'Incautación sin detenido'},
  {v:'bien_cot_sin_detenido',l:'Bien COT sin detenido (R7)'},
  {v:'objetivo_internacional',l:'Objetivo internacional'},
  {v:'egreso_ilegal',        l:'Egreso ilegal ← NUEVO'},
  {v:'daño_a_hito',          l:'Daño a hito fronterizo ← NUEVO'},
  {v:'avistamiento_ffpp_extranjero',l:'Avistamiento FF.PP./militares extr. ← NUEVO'},
  {v:'otro',                 l:'Otro positivo'},
]
const EVIDENCIAS=[
  'Huellas vehiculares','Huellas peatonales','Residuos recientes',
  'Campamento','Vehículo abandonado','Señalización ilícita',
  'Avistamiento FF.PP./militares extranjeros','Otro',
]
const NACIONALIDADES=['BOLIVIANO','PERUANO','CHILENO','VENEZOLANO','COLOMBIANO','ECUATORIANO','ARGENTINO','OTRO']
const ESTADO_PUNTO={
  sin_novedad:   {label:'Sin novedad',    color:'#1a6b2a',bg:'#e8f5ea'},
  zona_atencion: {label:'Zona de atención',color:'#9a6e00',bg:'#fffbea'},
  amenaza_activa:{label:'Amenaza activa', color:'#d70015',bg:'#fff0f1'},
  descartado:    {label:'Descartado',     color:'#6e6e73',bg:'#f0f0f2'},
}

// ── Helpers cuartel ───────────────────────────────────────────
function getCuartelId()  { return APP.cuartel?.id  || _servicio._cuartel_id_manual || null }
function getCuartelObj() { return APP.cuartel      || _servicio._cuartel_manual    || null }
function hoy()           { return new Date().toISOString().split('T')[0] }

// ── Entrada principal ─────────────────────────────────────────
async function renderRegistro() {
  if (!APP.puedeRegistrar) {
    el('pantalla-registro').innerHTML=`<div class="cargando">SIN ACCESO</div>`; return
  }
  if (APP.sinCuartel) {
    el('pantalla-registro').innerHTML=`<div class="cargando">CARGANDO...</div>`
    const todos=await obtenerCuarteles()
    el('pantalla-registro').innerHTML=`
      <div class="container-sm"><div class="card gap3">
        <div class="sec-titulo">Seleccionar cuartel para este servicio</div>
        <p style="font-size:.8rem;color:var(--muted)">Su usuario no tiene cuartel asignado. Seleccione el cuartel del servicio a registrar.</p>
        <div class="campo"><label>Cuartel</label>
          <select id="sel-cuartel-manual" onchange="seleccionarCuartelManual(this.value)">
            <option value="">Seleccionar cuartel...</option>
            ${todos.map(c=>`<option value="${c.id}">${c.nombre}</option>`).join('')}
          </select></div>
        <div id="wizard-wrap"></div>
      </div></div>`
    return
  }
  await _iniciarWizard(APP.cuartel.id)
}

async function seleccionarCuartelManual(cuartelId) {
  if (!cuartelId) return
  const todos=await obtenerCuarteles()
  const cuartel=todos.find(c=>c.id===cuartelId); if(!cuartel) return
  _servicio._cuartel_id_manual=cuartelId; _servicio._cuartel_manual=cuartel
  const wrap=el('wizard-wrap')
  if(wrap) wrap.innerHTML=`<div class="cargando" style="padding:1.5rem">Cargando...</div>`
  await _iniciarWizard(cuartelId)
}

async function _iniciarWizard(cuartelId) {
  _puntos=await obtenerPuntosConFallback(cuartelId)
  _paso=1; _m5Activo=false; _tareas=[]
  _servicio={..._servicio,
    personal_id:'',nombre_jefe:'',fecha:hoy(),turno:'',
    hora_inicio:'',vehiculo_id:'',patente_texto:'',km_inicio:'',
    hora_termino:'',km_termino:'',obs_generales:'',
    tiene_mision_ffaa:false,unidad_ffaa:'',
  }
  renderPaso()
}

function renderPaso() {
  const wrap=el('wizard-wrap')
  const contenido=`${progreso()}<div class="card" id="paso-contenido" style="margin-top:1rem">
    ${_paso===1?paso1Html():_paso===2?paso2Html():_paso===3?paso3Html():paso4Html()}
  </div>`
  if(wrap&&APP.sinCuartel){ wrap.innerHTML=contenido; return }
  el('pantalla-registro').innerHTML=`<div class="container-sm">${contenido}</div>`
}

function progreso() {
  return `<div class="progreso gap3">${['SERVICIO','TAREAS','CIERRE','CONFIRMAR'].map((l,i)=>{
    const n=i+1,done=_paso>n,act=_paso===n
    return `<div class="paso-item">${i>0?`<div class="paso-linea"></div>`:''}
      <div class="paso-circulo ${done||act?'done':''}">${n}</div>
      <span class="paso-label ${done||act?'done':''}">${l}</span></div>`
  }).join('')}</div>`
}

// ── PASO 1 ────────────────────────────────────────────────────
function paso1Html() {
  const cn=getCuartelObj()?.nombre||'—'
  return `
    <h2 style="font-family:var(--display);font-size:1.5rem;letter-spacing:3px;color:var(--text);margin-bottom:.25rem">PASO 1 — DATOS DEL SERVICIO</h2>
    <p style="font-family:var(--mono);font-size:.68rem;color:var(--muted);margin-bottom:1.5rem">
      Cuartel: <strong style="color:var(--verde)">${cn}</strong>
      ${!navigator.onLine?'<span style="color:var(--amarillo);margin-left:.5rem">● MODO OFFLINE</span>':''}
    </p>
    <div class="m5-toggle-wrap ${_m5Activo?'m5-active':''}" id="m5-wrap">
      <span class="m5-icon">🪖</span>
      <div class="m5-label">
        <div class="m5-title">M5 — Misión en Apoyo FF.AA.</div>
        <div class="m5-sub">Decreto N°78 / Operativo conjunto con Fuerzas Armadas</div>
      </div>
      <label class="check-label" style="margin:0">
        <input type="checkbox" ${_m5Activo?'checked':''} onchange="toggleM5(this.checked)" />
        <span style="font-weight:700;font-size:.78rem;color:${_m5Activo?'#0055d4':'var(--muted)'}">
          ${_m5Activo?'ACTIVO':'Activar'}</span>
      </label>
    </div>
    <div id="m5-detalle" style="${_m5Activo?'':'display:none'};margin-bottom:1rem">
      <div class="campo"><label>Unidad FF.AA. coordinada</label>
        <input id="m5-unidad" type="text" placeholder="Ej: Regimiento Huamachuco N°23..."
          value="${_servicio.unidad_ffaa}" onchange="_servicio.unidad_ffaa=this.value" /></div>
    </div>
    <div class="g2 gap">
      <div class="campo"><label>Jefe de Servicio</label>
        <input id="f-nombre-jefe" type="text" placeholder="Grado y nombre completo"
          value="${_servicio.nombre_jefe}" onchange="_servicio.nombre_jefe=this.value.trim()" /></div>
      <div class="campo"><label>Nombre del Servicio</label>
        <input id="f-turno" type="text"
          placeholder="Ej: Muralla Digital, Centinela, 1er. Control Frontera..."
          value="${_servicio.turno}" onchange="_servicio.turno=this.value.trim()" /></div>
      <div class="campo"><label>Fecha</label>
        <input id="f-fecha" type="date" value="${_servicio.fecha}" /></div>
      <div class="campo"><label>Hora Inicio</label>
        <input id="f-hora-inicio" type="time" value="${_servicio.hora_inicio}" /></div>
      <div class="campo"><label>Vehículo / Patente</label>
        <input id="f-vehiculo-texto" type="text" placeholder="Ej: BPZK-45 — Camioneta"
          value="${_servicio.patente_texto}" onchange="_servicio.patente_texto=this.value.trim()" /></div>
      <div class="campo"><label>Km Inicio</label>
        <input id="f-km-inicio" type="number" value="${_servicio.km_inicio}" placeholder="0" /></div>
    </div>
    <div id="p1-error" class="form-error" style="display:none"></div>
    <div class="flex-gap" style="margin-top:1.5rem">
      <button class="btn btn-primario" onclick="irPaso2()">CONTINUAR →</button>
    </div>`
}

function toggleM5(activo) {
  _m5Activo=activo; _servicio.tiene_mision_ffaa=activo
  el('m5-wrap')?.classList.toggle('m5-active',activo)
  const det=el('m5-detalle'); if(det) det.style.display=activo?'':'none'
}

function irPaso2() {
  _servicio.nombre_jefe  =el('f-nombre-jefe')?.value?.trim()||_servicio.nombre_jefe
  _servicio.turno        =el('f-turno')?.value?.trim()||_servicio.turno
  _servicio.fecha        =el('f-fecha')?.value
  _servicio.hora_inicio  =el('f-hora-inicio')?.value
  _servicio.patente_texto=el('f-vehiculo-texto')?.value?.trim()||_servicio.patente_texto
  _servicio.km_inicio    =el('f-km-inicio')?.value
  const err=el('p1-error')
  if(!_servicio.nombre_jefe||!_servicio.turno||!_servicio.fecha||!_servicio.hora_inicio){
    err.textContent='Complete Jefe de Servicio, Nombre del Servicio, Fecha y Hora Inicio.'
    err.style.display=''; return
  }
  err.style.display='none'; _paso=2; renderPaso()
}

// ── PASO 2 ────────────────────────────────────────────────────
function paso2Html() {
  const tlHtml=_tareas.length
    ?`<div class="timeline" id="timeline">${_tareas.map((t,i)=>tareaHtml(t,i)).join('')}</div>`
    :`<div style="color:var(--muted);font-family:var(--mono);font-size:.72rem;letter-spacing:1px;padding:1rem 0;text-align:center">SIN TAREAS AGREGADAS AÚN</div>`
  const btns=Object.entries(TIPOS_TAREA).map(([cat,tipos])=>`
    <div class="cat-label-bar">${cat==='territorial'?'🗺 TERRITORIAL':cat==='operativa'?'⚡ OPERATIVA':'📋 ADMINISTRATIVA'}</div>
    <div class="grid-tareas">${tipos.map(t=>`
      <button class="btn-tarea" onclick="agregarTarea('${t.tipo}','${cat}')">
        <span style="font-size:1.2rem">${t.icono}</span><span>${t.label}</span>
      </button>`).join('')}</div>`).join('')
  return `
    <h2 style="font-family:var(--display);font-size:1.5rem;letter-spacing:3px;color:var(--text);margin-bottom:.25rem">PASO 2 — TAREAS DEL SERVICIO</h2>
    <p style="font-family:var(--mono);font-size:.68rem;color:var(--muted);margin-bottom:1.25rem">Agregue las tareas en el orden que ocurrieron</p>
    <div id="timeline-wrap">${tlHtml}</div>
    <div class="selector-tareas gap2">${btns}</div>
    <div class="flex-gap" style="margin-top:1.5rem">
      <button class="btn btn-secundario" onclick="_paso=1;renderPaso()">← VOLVER</button>
      <button class="btn btn-primario"   onclick="_paso=3;renderPaso()">CONTINUAR →</button>
    </div>`
}

function agregarTarea(tipo,categoria) {
  const id=`t${Date.now()}`
  _tareas.push({
    id,tipo,categoria,orden:_tareas.length+1,
    punto_id:'',hora_inicio:'',hora_termino:'',
    observaciones:'',tiene_hallazgo:false,tiene_resultado:false,
    cantidad_vehiculos:0,cantidad_personas:0,
    institucion:'',nivel_coordinacion:'',detalle_coordinacion:'',
    motivo_administrativo:'',
    latitud_evento:null,longitud_evento:null,
    estado_punto:'sin_novedad',puntos_cercanos:[],
    prob_terreno:null,consec_terreno:null,
    resultado:{
      tipo_resultado:'',tipo_delito:'',numero_parte:'',valor_total_uf:0,
      como_se_detecto:'',info_para_csf:'',detenidos:[],especies:[],
      latitud_evento:null,longitud_evento:null,
      direccion_contrabando:'',
    },
    hallazgo:{tipo_evidencia:'',descripcion:'',nivel_relevancia:'medio'},
  })
  _refrescarTimeline()
}

function eliminarTarea(id) {
  _tareas=_tareas.filter(t=>t.id!==id); _refrescarTimeline()
}

function _refrescarTimeline() {
  const wrap=el('timeline-wrap'); if(!wrap) return
  wrap.innerHTML=_tareas.length
    ?`<div class="timeline" id="timeline">${_tareas.map((t,i)=>tareaHtml(t,i)).join('')}</div>`
    :`<div style="color:var(--muted);font-family:var(--mono);font-size:.72rem;padding:1rem 0;text-align:center">SIN TAREAS AGREGADAS AÚN</div>`
  // Recalcular criticidad de tareas que ya tenían datos
  _tareas.forEach(t=>{ if(t.latitud_evento&&t.longitud_evento) buscarPuntosCercanos(t.id,t.latitud_evento,t.longitud_evento) })
}

function syncTarea(id,campo,valor) {
  const t=_tareas.find(t=>t.id===id); if(!t) return
  if(campo.startsWith('res.'))      t.resultado[campo.slice(4)]=valor
  else if(campo.startsWith('hal.')) t.hallazgo[campo.slice(4)]=valor
  else                              t[campo]=valor
  // Recalcular criticidad automáticamente tras cualquier cambio relevante
  const camposCriticidad=['estado_punto','tiene_hallazgo','tiene_resultado','punto_id']
  if(camposCriticidad.includes(campo)||campo.startsWith('res.')||campo.startsWith('hal.'))
    actualizarCriticidadVisual(id)
}

// ── GPS ───────────────────────────────────────────────────────
async function usarGPSTarea(tareaId) {
  const btn=el(`gps-btn-${tareaId}`)
  if(btn){btn.textContent='Obteniendo GPS...';btn.disabled=true}
  try {
    const pos=await obtenerGPS()
    syncTarea(tareaId,'latitud_evento',pos.lat)
    syncTarea(tareaId,'longitud_evento',pos.lon)
    const latEl=el(`lat-${tareaId}`); const lonEl=el(`lon-${tareaId}`)
    if(latEl) latEl.value=decimalADms(pos.lat,false)
    if(lonEl) lonEl.value=decimalADms(pos.lon,true)
    buscarPuntosCercanos(tareaId,pos.lat,pos.lon)
    if(btn){btn.textContent='✓ GPS capturado';btn.className='btn btn-secundario btn-gps-ok'}
  } catch(e) {
    if(btn){btn.disabled=false;btn.textContent='GPS no disponible'}
    toast('GPS: '+e.message,'err')
  }
}

function buscarPuntosCercanos(tareaId,lat,lon) {
  const t=_tareas.find(t=>t.id===tareaId); if(!t||!lat||!lon) return
  const cercanos=puntosMasCercanos(lat,lon,_puntos,3)
  t.puntos_cercanos=cercanos
  const wrap=el(`puntos-cercanos-${tareaId}`); if(!wrap) return
  if(!cercanos.length){
    wrap.innerHTML=`<div style="font-size:.7rem;color:var(--muted)">Sin puntos con coordenadas cargadas en el radio</div>`; return
  }
  wrap.innerHTML=cercanos.map(p=>{
    const colorTipo=p.tipo==='hito'?'var(--verde)':p.tipo==='pnh'?'var(--rojo)':'var(--azul)'
    const bgTipo   =p.tipo==='hito'?'var(--verde-claro)':p.tipo==='pnh'?'var(--rojo-claro)':'var(--azul-claro)'
    const sel=t.punto_id===p.id
    return `<div onclick="seleccionarPuntoCercano('${tareaId}','${p.id}')"
      style="padding:.5rem .75rem;border-radius:7px;margin-bottom:.35rem;cursor:pointer;
        background:${sel?'var(--verde-claro)':'var(--bg3)'};
        border:1.5px solid ${sel?'var(--verde)':'var(--border)'};
        display:flex;align-items:center;justify-content:space-between;gap:.5rem">
      <div>
        <div style="font-size:.78rem;font-weight:700;color:${colorTipo}">${p.nombre}</div>
        <div style="font-size:.65rem;color:var(--muted)">
          <span style="background:${bgTipo};color:${colorTipo};padding:1px 5px;border-radius:3px;font-weight:700;margin-right:.3rem">${p.tipo.toUpperCase()}</span>
          ${p.valor_estrategico?.toUpperCase()||''}
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:.8rem;font-weight:700;color:${p.dentro_radio?'var(--verde)':'var(--muted2)'}">${p.distancia_km} km</div>
        <div style="font-size:.6rem;color:${p.dentro_radio?'var(--verde)':'var(--muted2)'}">
          ${p.dentro_radio?'✓ dentro del radio':'fuera del radio'}</div>
      </div>
    </div>`
  }).join('')
}

function seleccionarPuntoCercano(tareaId,puntoId) {
  syncTarea(tareaId,'punto_id',puntoId)
  const lat=el(`lat-${tareaId}`)?.dataset.decimal
  const lon=el(`lon-${tareaId}`)?.dataset.decimal
  if(lat&&lon) buscarPuntosCercanos(tareaId,parseFloat(lat),parseFloat(lon))
  actualizarCriticidadVisual(tareaId)
  toast(`Punto asociado: ${_puntos.find(p=>p.id===puntoId)?.nombre||puntoId}`,'ok')
}

// ── Criticidad automática visual ──────────────────────────────
function actualizarCriticidadVisual(tareaId) {
  const t=_tareas.find(t=>t.id===tareaId); if(!t) return
  const r=calcularCriticidadAutomatica(t,_puntos)
  t.prob_terreno=r.prob; t.consec_terreno=r.consec
  const panel=el(`criticidad-auto-${tareaId}`); if(!panel) return
  const info=criticidadInfo(r.valor)
  panel.style.background=info.bg; panel.style.color=info.color
  panel.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:.72rem;font-weight:700">${r.nivel}</div>
        <div style="font-size:.63rem;margin-top:2px;opacity:.85">Prob: ${r.prob} × Consec: ${r.consec} = ${r.valor}</div>
      </div>
      <div style="font-size:1.5rem;font-weight:700;letter-spacing:-1px;line-height:1">${r.valor}</div>
    </div>`
}

// ── HTML de cada tarea ────────────────────────────────────────
function tareaHtml(t,index) {
  const info=TIPOS_FLAT.find(x=>x.tipo===t.tipo)
  const esTerritorial=t.categoria==='territorial'
  const necesitaPunto=['visita_hito','fiscalizacion_pnh','visita_sie'].includes(t.tipo)
  const esControl    =t.tipo.startsWith('control_vehicular')||t.tipo==='control_migratorio'
  const esAdmin      =t.categoria==='administrativa'
  const esCoord      =t.tipo==='coordinacion'
  const necesitaRes  =['control_vehicular_con','detencion','incautacion','hallazgo_encargo','bien_cot_sin_detenido'].includes(t.tipo)
  const latDms=t.latitud_evento  ? decimalADms(t.latitud_evento,false) : ''
  const lonDms=t.longitud_evento ? decimalADms(t.longitud_evento,true) : ''

  return `
<div class="tarea-card cat-${t.categoria}" id="tarea-${t.id}">
  <div class="tarea-header">
    <span class="tarea-icon">${info?.icono||''}</span>
    <span class="tarea-titulo">#${index+1} — ${info?.label||t.tipo}</span>
    <button class="btn-del" onclick="eliminarTarea('${t.id}')">✕</button>
  </div>
  <div class="g3 gap">
    <div class="campo sm"><label>Hora Inicio</label>
      <input type="time" value="${t.hora_inicio}" onchange="syncTarea('${t.id}','hora_inicio',this.value)" /></div>
    <div class="campo sm"><label>Hora Término</label>
      <input type="time" value="${t.hora_termino}" onchange="syncTarea('${t.id}','hora_termino',this.value)" /></div>
  </div>

  <!-- ── BLOQUE GPS ── -->
  <div style="background:var(--azul-claro);border:1px solid #bbd3ff;border-radius:var(--radius-sm);padding:.75rem;margin:.5rem 0">
    <div style="font-family:var(--mono);font-size:.58rem;font-weight:700;letter-spacing:1.5px;color:var(--azul);margin-bottom:.5rem">📍 UBICACIÓN DEL EVENTO</div>
    <div class="g3 gap" style="margin-bottom:.5rem">
      <div class="campo sm"><label>Latitud</label>
        <input id="lat-${t.id}" type="text" placeholder='18°21\'08"S'
          value="${latDms}" data-decimal="${t.latitud_evento||''}"
          onchange="
            const dec=dmsADecimal(this.value)||parseFloat(this.value)||null;
            this.dataset.decimal=dec||'';
            syncTarea('${t.id}','latitud_evento',dec);
            const lon=parseFloat(el('lon-${t.id}')?.dataset.decimal)||null;
            if(dec&&lon) buscarPuntosCercanos('${t.id}',dec,lon)" /></div>
      <div class="campo sm"><label>Longitud</label>
        <input id="lon-${t.id}" type="text" placeholder='69°45\'30"O'
          value="${lonDms}" data-decimal="${t.longitud_evento||''}"
          onchange="
            const dec=dmsADecimal(this.value)||parseFloat(this.value)||null;
            this.dataset.decimal=dec||'';
            syncTarea('${t.id}','longitud_evento',dec);
            const lat=parseFloat(el('lat-${t.id}')?.dataset.decimal)||null;
            if(lat&&dec) buscarPuntosCercanos('${t.id}',lat,dec)" /></div>
      <div style="display:flex;flex-direction:column;justify-content:flex-end">
        <button id="gps-btn-${t.id}" class="btn btn-secundario"
          style="font-size:.7rem;padding:.4rem .65rem;width:100%"
          onclick="usarGPSTarea('${t.id}')">📍 Usar GPS</button>
      </div>
    </div>
    <div style="font-size:.68rem;color:var(--azul);margin-bottom:.35rem;font-weight:600">Puntos territoriales dentro del radio:</div>
    <div id="puntos-cercanos-${t.id}">
      <div style="font-size:.7rem;color:var(--muted)">${t.latitud_evento?'Calculando...':'Ingrese coordenadas o use GPS para ver puntos cercanos'}</div>
    </div>
  </div>

  ${necesitaPunto?`
  <div class="campo sm gap"><label>O seleccione punto directamente</label>
    <select onchange="syncTarea('${t.id}','punto_id',this.value);actualizarCriticidadVisual('${t.id}')">
      <option value="">Seleccionar desde lista...</option>
      ${_puntos.filter(p=>(t.tipo==='visita_hito'&&p.tipo==='hito')||(t.tipo==='fiscalizacion_pnh'&&p.tipo==='pnh')||(t.tipo==='visita_sie'&&p.tipo==='sie'))
        .map(p=>`<option value="${p.id}" ${t.punto_id===p.id?'selected':''}>${p.nombre} — ${p.pais}</option>`).join('')}
    </select></div>`:''}

  ${esTerritorial?`
  <!-- ── CRITICIDAD AUTOMÁTICA ── -->
  <div style="background:var(--verde-claro);border:1px solid #b8e0c0;border-radius:var(--radius-sm);padding:.75rem;margin:.4rem 0">
    <div style="font-family:var(--mono);font-size:.58rem;font-weight:700;letter-spacing:1.5px;color:var(--verde);margin-bottom:.5rem">📊 EVALUACIÓN EN TERRENO</div>
    <div style="font-size:.72rem;font-weight:600;color:var(--text);margin-bottom:.4rem">Estado del punto al visitar:</div>
    <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.6rem">
      ${Object.entries(ESTADO_PUNTO).map(([val,info])=>`
        <button id="ep-${t.id}-${val}"
          onclick="syncTarea('${t.id}','estado_punto','${val}');_resaltarEstado('${t.id}','${val}')"
          style="padding:.35rem .7rem;border-radius:6px;border:1.5px solid ${info.color};font-size:.7rem;font-weight:700;cursor:pointer;
            background:${t.estado_punto===val?info.bg:'var(--bg2)'};color:${info.color};
            opacity:${t.estado_punto===val?1:.6}">
          ${info.label}</button>`).join('')}
    </div>
    <div style="font-size:.72rem;color:var(--muted);margin-bottom:.35rem">Criticidad calculada automáticamente:</div>
    <div id="criticidad-auto-${t.id}"
      style="padding:.5rem .75rem;border-radius:6px;font-size:.73rem;font-weight:600;
        background:${criticidadInfo(t.prob_terreno&&t.consec_terreno?t.prob_terreno*t.consec_terreno:0).bg};
        color:${criticidadInfo(t.prob_terreno&&t.consec_terreno?t.prob_terreno*t.consec_terreno:0).color}">
      ${t.prob_terreno&&t.consec_terreno
        ?`<div style="display:flex;justify-content:space-between;align-items:center">
            <div><div style="font-size:.72rem;font-weight:700">${criticidadLabel(t.prob_terreno*t.consec_terreno)}</div>
            <div style="font-size:.63rem;margin-top:2px;opacity:.85">Prob: ${t.prob_terreno} × Consec: ${t.consec_terreno} = ${t.prob_terreno*t.consec_terreno}</div></div>
            <div style="font-size:1.5rem;font-weight:700;letter-spacing:-1px;line-height:1">${t.prob_terreno*t.consec_terreno}</div>
          </div>`
        :'Complete tipo de evidencia o procedimiento para calcular'}
    </div>
    <div style="font-size:.63rem;color:var(--muted);margin-top:.3rem">Prob. ← estado + evidencia + resultado · Consec. ← valor estratégico punto + delito CT + alertas</div>
  </div>`:''}

  ${esCoord?`
  <div class="g2 gap">
    <div class="campo sm"><label>Institución</label>
      <select onchange="syncTarea('${t.id}','institucion',this.value)">
        <option value="">Seleccionar...</option>
        ${['PNP Tacna','PNP Arica','PDI','Aduana','SML','Ejército','Armada','FACh','Otra'].map(i=>`<option>${i}</option>`).join('')}
      </select></div>
    <div class="campo sm"><label>Nivel coordinación</label>
      <select onchange="syncTarea('${t.id}','nivel_coordinacion',this.value)">
        <option value="">Seleccionar...</option>
        <option value="alto">Alto — Operativo bilateral</option>
        <option value="medio">Medio — Intercambio operativo</option>
        <option value="bajo">Bajo — Saludo protocolar</option>
      </select></div>
    <div class="campo sm gc12"><label>Detalle coordinación</label>
      <input type="text" placeholder="Descripción breve" onchange="syncTarea('${t.id}','detalle_coordinacion',this.value)" /></div>
  </div>`:''}

  ${esAdmin?`
  <div class="campo sm gap"><label>Motivo</label>
    <select onchange="syncTarea('${t.id}','motivo_administrativo',this.value)">
      <option value="">Seleccionar motivo...</option>
      ${['Combustible','Traslado a ciudad','Taller / mecánico','Apoyo a otra unidad','Trámite administrativo','Otro'].map(m=>`<option>${m}</option>`).join('')}
    </select></div>`:''}

  ${esControl?`
  <div class="g2 gap">
    <div class="campo sm"><label>N° Vehículos</label>
      <input type="number" min="0" value="${t.cantidad_vehiculos}" onchange="syncTarea('${t.id}','cantidad_vehiculos',+this.value)" /></div>
    <div class="campo sm"><label>N° Personas</label>
      <input type="number" min="0" value="${t.cantidad_personas}" onchange="syncTarea('${t.id}','cantidad_personas',+this.value)" /></div>
  </div>`:''}

  ${necesitaRes?resultadoHtml(t):''}

  <label class="check-label" style="margin-top:.75rem">
    <input type="checkbox" ${t.tiene_hallazgo?'checked':''}
      onchange="syncTarea('${t.id}','tiene_hallazgo',this.checked);toggleHallazgo('${t.id}',this.checked)" />
    <span style="color:var(--amarillo)">¿Hay hallazgo relevante para inteligencia / CSF?</span>
  </label>
  <div id="hallazgo-bloque-${t.id}" style="${t.tiene_hallazgo?'':'display:none'}">
    <div class="g2 gap">
      <div class="campo sm"><label>Tipo de Evidencia</label>
        <select onchange="syncTarea('${t.id}','hal.tipo_evidencia',this.value)">
          <option value="">Seleccionar...</option>
          ${EVIDENCIAS.map(e=>`<option ${t.hallazgo.tipo_evidencia===e?'selected':''}>${e}</option>`).join('')}
        </select></div>
      <div class="campo sm"><label>Relevancia</label>
        <select onchange="syncTarea('${t.id}','hal.nivel_relevancia',this.value)">
          <option value="alto" ${t.hallazgo.nivel_relevancia==='alto'?'selected':''}>Alta</option>
          <option value="medio" ${t.hallazgo.nivel_relevancia==='medio'||!t.hallazgo.nivel_relevancia?'selected':''}>Media</option>
          <option value="bajo" ${t.hallazgo.nivel_relevancia==='bajo'?'selected':''}>Baja</option>
        </select></div>
      <div class="campo sm gc12"><label>Descripción detallada</label>
        <textarea placeholder="Hora exacta, ubicación, características..."
          onchange="syncTarea('${t.id}','hal.descripcion',this.value)">${t.hallazgo.descripcion}</textarea></div>
    </div>
  </div>

  <div class="campo sm" style="margin-top:.75rem">
    <label>Observaciones de la tarea</label>
    <input type="text" placeholder="Novedades, condiciones del terreno..."
      value="${t.observaciones}" onchange="syncTarea('${t.id}','observaciones',this.value)" />
  </div>
</div>`
}

function _resaltarEstado(tareaId, val) {
  const t=_tareas.find(t=>t.id===tareaId); if(!t) return
  Object.keys(ESTADO_PUNTO).forEach(v=>{
    const btn=el(`ep-${tareaId}-${v}`); if(!btn) return
    const info=ESTADO_PUNTO[v]
    btn.style.background=t.estado_punto===v?info.bg:'var(--bg2)'
    btn.style.opacity=t.estado_punto===v?'1':'.6'
  })
  actualizarCriticidadVisual(tareaId)
}

function toggleHallazgo(id,show) {
  const b=el(`hallazgo-bloque-${id}`); if(b) b.style.display=show?'':'none'
  actualizarCriticidadVisual(id)
}

// ── Resultado ─────────────────────────────────────────────────
function resultadoHtml(t) {
  const esContrabando=t.resultado.tipo_delito==='contrabando'
  return `
<div class="resultado-bloque">
  <div class="resultado-titulo">⚡ RESULTADO DEL PROCEDIMIENTO</div>
  <div class="g2 gap">
    <div class="campo sm"><label>Tipo de Resultado</label>
      <select onchange="syncTarea('${t.id}','res.tipo_resultado',this.value);syncTarea('${t.id}','tiene_resultado',true);actualizarCriticidadVisual('${t.id}')">
        <option value="">Seleccionar...</option>
        ${TIPOS_RESULTADO.map(r=>`<option value="${r.v}" ${t.resultado.tipo_resultado===r.v?'selected':''}>${r.l}</option>`).join('')}
      </select></div>
    <div class="campo sm"><label>Tipo de Delito</label>
      <select onchange="syncTarea('${t.id}','res.tipo_delito',this.value);_toggleDireccionContrabando('${t.id}',this.value);actualizarCriticidadVisual('${t.id}')">
        <option value="">Sin delito / N/A</option>
        ${Object.entries(DELITOS).map(([k,v])=>`<option value="${k}" ${t.resultado.tipo_delito===k?'selected':''}>${v}</option>`).join('')}
      </select></div>
    <div class="campo sm gc12" id="dir-contrabando-wrap-${t.id}" style="${esContrabando?'':'display:none'}">
      <label>Dirección del contrabando</label>
      <select onchange="syncTarea('${t.id}','res.direccion_contrabando',this.value)">
        <option value="">Seleccionar...</option>
        <option value="entrada" ${t.resultado.direccion_contrabando==='entrada'?'selected':''}>Entrada al país</option>
        <option value="salida"  ${t.resultado.direccion_contrabando==='salida'?'selected':''}>Salida del país</option>
      </select></div>
    <div class="campo sm"><label>N° Parte</label>
      <input type="text" placeholder="Ej: 1234/2026" value="${t.resultado.numero_parte}"
        onchange="syncTarea('${t.id}','res.numero_parte',this.value)" /></div>
    <div class="campo sm"><label>Valor Total (UF)</label>
      <input type="number" step="0.01" value="${t.resultado.valor_total_uf||0}"
        onchange="syncTarea('${t.id}','res.valor_total_uf',+this.value)" /></div>
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
  <div class="campo sm gap"><label>¿Cómo se detectó?</label>
    <select onchange="syncTarea('${t.id}','res.como_se_detecto',this.value)">
      <option value="">Seleccionar...</option>
      ${['Patrullaje rutinario','Punto de control','Inteligencia previa','Coordinación externa','Denuncia ciudadana'].map(o=>`<option>${o}</option>`).join('')}
    </select></div>
  <div class="campo sm"><label>Información útil para la CSF</label>
    <textarea placeholder="Modus operandi, datos de interés..."
      onchange="syncTarea('${t.id}','res.info_para_csf',this.value)"></textarea></div>
</div>`
}

function _toggleDireccionContrabando(tareaId, delito) {
  const wrap=el(`dir-contrabando-wrap-${tareaId}`)
  if(wrap) wrap.style.display=delito==='contrabando'?'':'none'
}

// ── Detenidos / Especies ──────────────────────────────────────
function agregarDetenido(tareaId) {
  const t=_tareas.find(t=>t.id===tareaId); if(!t) return
  t.resultado.detenidos.push({id:`d${Date.now()}`,nacionalidad:'',edad:'',sexo:'',situacion_migratoria:'irregular',tiene_alerta_internacional:false})
  renderDetenidosEspecies(tareaId)
}
function agregarEspecie(tareaId) {
  const t=_tareas.find(t=>t.id===tareaId); if(!t) return
  t.resultado.especies.push({id:`e${Date.now()}`,tipo:'droga',descripcion:'',valor_uf:0,tipo_droga:'',cantidad_droga:'',unidad_droga:'kg',tipo_arma:'',cantidad_armas:1,numero_serie:'',tipo_vehiculo:'',marca:'',modelo:'',patente:'',tenia_encargo:false})
  renderDetenidosEspecies(tareaId)
}
function renderDetenidosEspecies(tareaId) {
  const t=_tareas.find(t=>t.id===tareaId); if(!t) return
  const dw=el(`detenidos-${tareaId}`)
  if(dw) dw.innerHTML=t.resultado.detenidos.map(d=>`
    <div style="background:var(--bg2);padding:.6rem;border-radius:var(--radius);margin-bottom:.4rem">
      <div class="g3">
        <div class="campo sm"><label>Nacionalidad</label>
          <select onchange="syncDetenido('${tareaId}','${d.id}','nacionalidad',this.value)">
            <option value="">Seleccionar...</option>
            ${NACIONALIDADES.map(n=>`<option ${d.nacionalidad===n?'selected':''}>${n}</option>`).join('')}
          </select></div>
        <div class="campo sm"><label>Edad</label>
          <input type="number" min="0" max="99" value="${d.edad}"
            onchange="syncDetenido('${tareaId}','${d.id}','edad',+this.value)" /></div>
        <div class="campo sm"><label>Sexo</label>
          <select onchange="syncDetenido('${tareaId}','${d.id}','sexo',this.value)">
            <option value="">—</option>
            <option value="M" ${d.sexo==='M'?'selected':''}>Masculino</option>
            <option value="F" ${d.sexo==='F'?'selected':''}>Femenino</option>
          </select></div>
        <div class="campo sm" style="grid-column:1/3"><label>Situación Migratoria</label>
          <select onchange="syncDetenido('${tareaId}','${d.id}','situacion_migratoria',this.value)">
            <option value="irregular" ${d.situacion_migratoria==='irregular'?'selected':''}>Irregular</option>
            <option value="regular" ${d.situacion_migratoria==='regular'?'selected':''}>Regular</option>
            <option value="solicitante_refugio">Solicitante de refugio</option>
            <option value="no_aplica">No aplica</option>
          </select></div>
        <div class="campo sm" style="grid-column:1/-1">
          <label class="check-label" style="margin:0">
            <input type="checkbox" ${d.tiene_alerta_internacional?'checked':''}
              onchange="syncDetenido('${tareaId}','${d.id}','tiene_alerta_internacional',this.checked);actualizarCriticidadVisual('${tareaId}')" />
            <span style="color:var(--rojo);font-weight:600">⚑ Objetivo con alerta internacional</span>
          </label></div>
        <button class="btn-del" style="align-self:flex-end"
          onclick="eliminarDetenido('${tareaId}','${d.id}')">✕</button>
      </div>
    </div>`).join('')
  const ew=el(`especies-${tareaId}`)
  if(ew) ew.innerHTML=t.resultado.especies.map(e=>`
    <div style="background:var(--bg2);padding:.75rem;border-radius:var(--radius);margin-bottom:.4rem">
      <div class="g3 gap">
        <div class="campo sm"><label>Tipo</label>
          <select onchange="syncEspecie('${tareaId}','${e.id}','tipo',this.value)">
            ${['droga','dinero','vehiculo','arma','mercaderia','otro'].map(o=>`<option value="${o}" ${e.tipo===o?'selected':''}>${o.charAt(0).toUpperCase()+o.slice(1)}</option>`).join('')}
          </select></div>
        <div class="campo sm"><label>Valor (UF)</label>
          <input type="number" step="0.01" value="${e.valor_uf}"
            onchange="syncEspecie('${tareaId}','${e.id}','valor_uf',+this.value)" /></div>
        <label class="check-label" style="align-self:flex-end">
          <input type="checkbox" ${e.tenia_encargo?'checked':''}
            onchange="syncEspecie('${tareaId}','${e.id}','tenia_encargo',this.checked)" />
          <span style="font-size:.7rem">Con encargo</span>
        </label>
        <button class="btn-del" style="align-self:flex-end"
          onclick="eliminarEspecie('${tareaId}','${e.id}')">✕</button>
      </div>
      ${e.tipo==='droga'?`<div class="g3">
        <div class="campo sm"><label>Tipo droga</label><input type="text" value="${e.tipo_droga}" placeholder="Cocaína..." onchange="syncEspecie('${tareaId}','${e.id}','tipo_droga',this.value)"/></div>
        <div class="campo sm"><label>Cantidad</label><input type="number" step="0.001" value="${e.cantidad_droga}" onchange="syncEspecie('${tareaId}','${e.id}','cantidad_droga',this.value)"/></div>
        <div class="campo sm"><label>Unidad</label><select onchange="syncEspecie('${tareaId}','${e.id}','unidad_droga',this.value)"><option>kg</option><option>g</option><option>unidades</option></select></div>
      </div>`:''}
      ${e.tipo==='arma'?`<div class="g3">
        <div class="campo sm"><label>Tipo arma</label><input type="text" value="${e.tipo_arma}" placeholder="Pistola..." onchange="syncEspecie('${tareaId}','${e.id}','tipo_arma',this.value)"/></div>
        <div class="campo sm"><label>Cantidad</label><input type="number" value="${e.cantidad_armas}" onchange="syncEspecie('${tareaId}','${e.id}','cantidad_armas',+this.value)"/></div>
        <div class="campo sm"><label>N° Serie</label><input type="text" value="${e.numero_serie}" onchange="syncEspecie('${tareaId}','${e.id}','numero_serie',this.value)"/></div>
      </div>`:''}
      ${e.tipo==='vehiculo'?`<div class="g3">
        <div class="campo sm"><label>Tipo</label><input type="text" value="${e.tipo_vehiculo}" placeholder="Camioneta..." onchange="syncEspecie('${tareaId}','${e.id}','tipo_vehiculo',this.value)"/></div>
        <div class="campo sm"><label>Marca / Modelo</label><input type="text" value="${e.marca}" onchange="syncEspecie('${tareaId}','${e.id}','marca',this.value)"/></div>
        <div class="campo sm"><label>Patente</label><input type="text" value="${e.patente}" onchange="syncEspecie('${tareaId}','${e.id}','patente',this.value)"/></div>
      </div>`:''}
      ${['mercaderia','otro'].includes(e.tipo)?`
        <div class="campo sm"><label>Descripción</label><input type="text" value="${e.descripcion}" onchange="syncEspecie('${tareaId}','${e.id}','descripcion',this.value)"/></div>`:''}
    </div>`).join('')
}
function syncDetenido(tId,dId,c,v){const t=_tareas.find(t=>t.id===tId);const d=t?.resultado.detenidos.find(d=>d.id===dId);if(d)d[c]=v}
function eliminarDetenido(tId,dId){const t=_tareas.find(t=>t.id===tId);if(t){t.resultado.detenidos=t.resultado.detenidos.filter(d=>d.id!==dId);renderDetenidosEspecies(tId)}}
function syncEspecie(tId,eId,c,v){const t=_tareas.find(t=>t.id===tId);const e=t?.resultado.especies.find(e=>e.id===eId);if(e)e[c]=v}
function eliminarEspecie(tId,eId){const t=_tareas.find(t=>t.id===tId);if(t){t.resultado.especies=t.resultado.especies.filter(e=>e.id!==eId);renderDetenidosEspecies(tId)}}

// ── PASO 3 ────────────────────────────────────────────────────
function paso3Html() {
  return `
    <h2 style="font-family:var(--display);font-size:1.5rem;letter-spacing:3px;color:var(--text);margin-bottom:1.5rem">PASO 3 — CIERRE DEL SERVICIO</h2>
    <div class="g2 gap">
      <div class="campo"><label>Hora Término</label>
        <input id="f-hora-termino" type="time" value="${_servicio.hora_termino}" oninput="detectarTurnoNocturno()" /></div>
      <div class="campo"><label>Km Término</label>
        <input id="f-km-termino" type="number" value="${_servicio.km_termino}" placeholder="0" /></div>
    </div>
    <div id="aviso-nocturno" class="aviso-nocturno"></div>
    <div class="campo gap2"><label>Observaciones Generales</label>
      <textarea id="f-obs" placeholder="Condiciones climáticas, novedades menores...">${_servicio.obs_generales}</textarea>
    </div>
    <div class="flex-gap" style="margin-top:1.5rem">
      <button class="btn btn-secundario" onclick="_paso=2;renderPaso()">← VOLVER</button>
      <button class="btn btn-primario"   onclick="irPaso4()">REVISAR SERVICIO →</button>
    </div>`
}
function detectarTurnoNocturno(){
  const hI=_servicio.hora_inicio||'',hT=el('f-hora-termino')?.value||'',aviso=el('aviso-nocturno')
  if(!aviso||!hI||!hT)return
  if(hT<hI){
    const[hi,mi]=hI.split(':').map(Number),[ht,mt]=hT.split(':').map(Number)
    const mins=(24*60-hi*60-mi)+ht*60+mt,h=Math.floor(mins/60),m=mins%60
    aviso.style.display='';aviso.textContent=`🌙 Turno nocturno detectado — Duración: ${h}h ${m}m (cruza medianoche)`
  }else{aviso.style.display='none'}
}
function calcularDuracionNocturna(hI,hT){
  if(!hI||!hT||hT>=hI)return null
  const[hi,mi]=hI.split(':').map(Number),[ht,mt]=hT.split(':').map(Number)
  return(24*60-hi*60-mi)+ht*60+mt
}
function irPaso4(){
  _servicio.hora_termino=el('f-hora-termino')?.value
  _servicio.km_termino=el('f-km-termino')?.value
  _servicio.obs_generales=el('f-obs')?.value
  _paso=4;renderPaso()
}

// ── PASO 4 ────────────────────────────────────────────────────
function paso4Html(){
  const conResult=_tareas.filter(t=>t.tiene_resultado).length
  const conHallazgo=_tareas.filter(t=>t.tiene_hallazgo).length
  const conGeo=_tareas.filter(t=>t.latitud_evento&&t.longitud_evento).length
  const conCrit=_tareas.filter(t=>t.prob_terreno&&t.consec_terreno).length
  const tieneCohecho=verificarCohecho(_tareas)
  const cn=getCuartelObj()?.nombre||'—'
  return `
    <h2 style="font-family:var(--display);font-size:1.5rem;letter-spacing:3px;color:var(--text);margin-bottom:1.5rem">PASO 4 — CONFIRMAR Y ENVIAR</h2>
    ${tieneCohecho?`<div class="alerta-cohecho" style="margin-bottom:1rem">
      <div class="alerta-cohecho-titulo">🚨 COHECHO — ALERTA INSTITUCIONAL MÁXIMA</div>
      <div class="alerta-cohecho-sub">Se notificará la cadena de mando al enviar.</div>
    </div>`:''}
    <div class="resumen-lista gap2">
      ${filaResumen('Cuartel',   cn)}
      ${filaResumen('Jefe',      _servicio.nombre_jefe)}
      ${filaResumen('Fecha',     _servicio.fecha)}
      ${filaResumen('Servicio',  _servicio.turno||'—')}
      ${filaResumen('Horario',   `${_servicio.hora_inicio} → ${_servicio.hora_termino}`)}
      ${filaResumen('Vehículo',  _servicio.patente_texto||'—')}
      ${filaResumen('Km',        `${_servicio.km_inicio||'—'} → ${_servicio.km_termino||'—'}`)}
      ${_servicio.tiene_mision_ffaa?filaResumen('M5 FF.AA.',`<span style="color:var(--azul);font-weight:600">ACTIVO — ${_servicio.unidad_ffaa||'Decreto N°78'}</span>`):''}
      ${filaResumen('Tareas',`<span style="color:var(--verde)">${_tareas.length} registradas</span>`)}
      ${conResult?filaResumen('Con resultado',`<span style="color:var(--rojo)">${conResult}</span>`):''}
      ${conHallazgo?filaResumen('Hallazgos intel.',`<span style="color:var(--amarillo)">${conHallazgo}</span>`):''}
      ${filaResumen('GPS registrado',`<span style="color:${conGeo?'var(--verde)':'var(--muted)'}">${conGeo}/${_tareas.length} tareas</span>`)}
      ${filaResumen('Eval. criticidad',`<span style="color:${conCrit?'var(--verde)':'var(--muted)'}">${conCrit} evaluaciones automáticas</span>`)}
      ${!navigator.onLine?filaResumen('Conexión','<span style="color:var(--amarillo)">⚠ OFFLINE — Se sincronizará automáticamente</span>'):''}
    </div>
    <div class="aviso" style="margin-top:1rem">⚠ Una vez enviado no puede modificarse sin autorización del Administrador.</div>
    <div class="flex-gap" style="margin-top:1.5rem">
      <button class="btn btn-secundario" onclick="_paso=3;renderPaso()">← VOLVER</button>
      <button class="btn btn-primario" id="btn-enviar" onclick="iniciarEnvio()">▶ ENVIAR SERVICIO</button>
    </div>`
}
function filaResumen(k,v){return`<div class="resumen-fila"><span class="resumen-key">${k}</span><span>${v}</span></div>`}

function iniciarEnvio(){
  if(verificarCohecho(_tareas)){
    mostrarModalAlerta(`Este servicio registra cohecho. Se registrará alerta crítica.`,(c)=>{if(c)enviarServicio()})
  }else{enviarServicio()}
}

// ── Envío ─────────────────────────────────────────────────────
async function enviarServicio(){
  const btn=el('btn-enviar')
  if(btn){btn.disabled=true;btn.textContent='GUARDANDO...'}
  const cuartelId=getCuartelId()
  if(!cuartelId){toast('No hay cuartel seleccionado','err');if(btn){btn.disabled=false;btn.textContent='▶ ENVIAR SERVICIO'}return}
  const dur=calcularDuracionNocturna(_servicio.hora_inicio,_servicio.hora_termino)
  const svcPayload={
    cuartel_id:cuartelId,nombre_jefe:_servicio.nombre_jefe,fecha:_servicio.fecha,
    turno:_servicio.turno,hora_inicio:_servicio.hora_inicio,
    hora_termino:_servicio.hora_termino||null,patente_texto:_servicio.patente_texto||null,
    km_inicio:parseInt(_servicio.km_inicio)||null,km_termino:parseInt(_servicio.km_termino)||null,
    obs_generales:_servicio.obs_generales||null,
    tiene_mision_ffaa:_servicio.tiene_mision_ffaa||false,
    unidad_ffaa:_servicio.unidad_ffaa||null,duracion_minutos:dur||null,estado:'enviado',
  }
  try {
    if(!navigator.onLine){await encolarSync('servicios','insert',svcPayload);mostrarExito(true);return}
    const{data:svc,error:svcErr}=await APP.sb.from('servicios').insert(svcPayload).select().single()
    if(svcErr)throw svcErr
    for(const tarea of _tareas){
      const{data:tar,error:tarErr}=await APP.sb.from('tareas').insert({
        servicio_id:svc.id,cuartel_id:cuartelId,orden:tarea.orden,
        categoria:tarea.categoria,tipo:tarea.tipo,punto_id:tarea.punto_id||null,
        hora_inicio:tarea.hora_inicio||null,hora_termino:tarea.hora_termino||null,
        observaciones:tarea.observaciones||null,
        tiene_hallazgo:tarea.tiene_hallazgo,tiene_resultado:tarea.tiene_resultado,
        cantidad_vehiculos:tarea.cantidad_vehiculos||0,cantidad_personas:tarea.cantidad_personas||0,
        institucion:tarea.institucion||null,nivel_coordinacion:tarea.nivel_coordinacion||null,
        motivo_administrativo:tarea.motivo_administrativo||null,
        latitud_evento:tarea.latitud_evento||null,longitud_evento:tarea.longitud_evento||null,
        prob_terreno:tarea.prob_terreno||null,consec_terreno:tarea.consec_terreno||null,
        estado_punto:tarea.estado_punto||null,
      }).select().single()
      if(tarErr)throw tarErr
      if(tarea.tiene_hallazgo&&tarea.hallazgo.descripcion){
        await APP.sb.from('hallazgos').insert({
          tarea_id:tar.id,servicio_id:svc.id,cuartel_id:cuartelId,
          punto_id:tarea.punto_id||null,tipo_evidencia:tarea.hallazgo.tipo_evidencia,
          descripcion:tarea.hallazgo.descripcion,nivel_relevancia:tarea.hallazgo.nivel_relevancia,
          latitud_evento:tarea.latitud_evento||null,longitud_evento:tarea.longitud_evento||null,
        })
      }
      if(tarea.tiene_resultado&&tarea.resultado.tipo_resultado){
        const{data:res,error:resErr}=await APP.sb.from('resultados').insert({
          tarea_id:tar.id,servicio_id:svc.id,cuartel_id:cuartelId,
          tipo_resultado:tarea.resultado.tipo_resultado,tipo_delito:tarea.resultado.tipo_delito||null,
          numero_parte:tarea.resultado.numero_parte||null,valor_total_uf:tarea.resultado.valor_total_uf||0,
          como_se_detecto:tarea.resultado.como_se_detecto||null,info_para_csf:tarea.resultado.info_para_csf||null,
          latitud_evento:tarea.latitud_evento||null,longitud_evento:tarea.longitud_evento||null,
          punto_id_cercano:tarea.punto_id||null,
          direccion_contrabando:tarea.resultado.direccion_contrabando||null,
        }).select().single()
        if(resErr)throw resErr
        if(tarea.resultado.tipo_delito==='cohecho')
          await registrarAlertaCritica('cohecho',`Servicio ${svc.id} — Parte N°${tarea.resultado.numero_parte||'S/N'}`,cuartelId)
        for(const d of tarea.resultado.detenidos){
          await APP.sb.from('detenidos').insert({
            resultado_id:res.id,servicio_id:svc.id,cuartel_id:cuartelId,
            nacionalidad:d.nacionalidad,edad:parseInt(d.edad)||null,sexo:d.sexo||null,
            situacion_migratoria:d.situacion_migratoria||null,
            tiene_alerta_internacional:d.tiene_alerta_internacional||false,
          })
        }
        for(const e of tarea.resultado.especies){
          await APP.sb.from('especies').insert({
            resultado_id:res.id,servicio_id:svc.id,cuartel_id:cuartelId,
            tipo:e.tipo,descripcion:e.descripcion||null,valor_uf:e.valor_uf||0,
            tipo_droga:e.tipo_droga||null,cantidad_droga:parseFloat(e.cantidad_droga)||null,
            unidad_droga:e.unidad_droga||null,tipo_arma:e.tipo_arma||null,
            cantidad_armas:parseInt(e.cantidad_armas)||null,numero_serie:e.numero_serie||null,
            tipo_vehiculo:e.tipo_vehiculo||null,marca:e.marca||null,
            modelo:e.modelo||null,patente:e.patente||null,tenia_encargo:e.tenia_encargo||false,
          })
        }
      }
    }
    mostrarExito(false); toast('Servicio registrado correctamente','ok')
  }catch(e){
    console.error('[SISCOF]',e)
    toast('Error: '+(e.message||e.details||JSON.stringify(e)),'err')
    if(btn){btn.disabled=false;btn.textContent='▶ ENVIAR SERVICIO'}
  }
}

function mostrarExito(offline){
  el('pantalla-registro').innerHTML=`
    <div class="container-sm"><div class="exito-wrap">
      <div class="exito-icon">${offline?'📴':'✅'}</div>
      <div class="exito-titulo">${offline?'GUARDADO OFFLINE':'SERVICIO REGISTRADO'}</div>
      <div class="exito-sub">${offline?'Se sincronizará al recuperar conexión.':'Guardado y registrado correctamente.'}</div>
      <button class="btn btn-primario" onclick="renderRegistro()">+ REGISTRAR NUEVO SERVICIO</button>
    </div></div>`
}
