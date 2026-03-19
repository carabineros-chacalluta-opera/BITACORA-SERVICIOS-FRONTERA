// ============================================================
// SISCOF v3 — core.js
// ACTUALIZACIÓN COMPLETA: geoespacial + criticidad + dms
// ============================================================

let _sb = null
function getSupabase() {
  if (_sb) return _sb
  if (!SISCOF_CONFIG.SUPABASE_URL || !SISCOF_CONFIG.SUPABASE_ANON_KEY)
    throw new Error('Configure las credenciales en js/config.js')
  _sb = supabase.createClient(SISCOF_CONFIG.SUPABASE_URL, SISCOF_CONFIG.SUPABASE_ANON_KEY)
  return _sb
}

const APP = {
  user: null, perfil: null, cuartel: null,
  get sb()             { return getSupabase() },
  get esJefe()         { return this.perfil?.rol === SISCOF_CONFIG.ROLES.JEFE_SERVICIO },
  get esAdmin()        { return this.perfil?.rol === SISCOF_CONFIG.ROLES.ADMINISTRADOR },
  get esComisaria()    { return this.perfil?.rol === SISCOF_CONFIG.ROLES.COMISARIA },
  get esPrefectura()   { return this.perfil?.rol === SISCOF_CONFIG.ROLES.PREFECTURA },
  get sinCuartel()     { return !this.cuartel?.id },
  get puedeRegistrar() { return this.esJefe || this.esAdmin || this.sinCuartel },
  get tieneVisionGlobal() { return this.esComisaria || this.esPrefectura || this.sinCuartel },
}

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
    .from('usuarios').select('*, cuartel:cuarteles(*)')
    .eq('email', authUser.email).single()
  if (data) {
    APP.perfil  = data
    APP.cuartel = data.cuartel || null
    if (data.cuartel?.id && typeof cachearDatosMaestros === 'function')
      cachearDatosMaestros(data.cuartel.id)
  }
}

async function iniciarSesion() {
  const { data: { session } } = await APP.sb.auth.getSession()
  if (session?.user) { await cargarPerfil(session.user); return true }
  return false
}

async function obtenerCuarteles() {
  const { data } = await APP.sb.from('cuarteles').select('*')
    .eq('activo', true).order('tipo').order('nombre')
  return data || []
}

async function obtenerCuartelIds() {
  if (APP.tieneVisionGlobal) { const c = await obtenerCuarteles(); return c.map(x => x.id) }
  return APP.cuartel ? [APP.cuartel.id] : []
}

// ── Dashboard ────────────────────────────────────────────────
async function obtenerDashboard(cuartelIds, filtro) {
  const { inicio, fin, anioActual, mesInicio, mesFin } = calcularFechas(filtro)
  const [
    { data: servicios }, { data: resultados }, { data: detenidos },
    { data: especies },  { data: tareas },     { data: hallazgos },
    { data: historial }, { data: histIdfi },   cuarteles,
  ] = await Promise.all([
    APP.sb.from('servicios').select('id,cuartel_id,fecha,minutos_operativos,km_inicio,km_termino')
      .in('cuartel_id', cuartelIds).eq('estado','enviado').gte('fecha',inicio).lte('fecha',fin),
    APP.sb.from('resultados').select('id,cuartel_id,tipo_delito,tipo_resultado,valor_total_uf,servicio_id')
      .in('cuartel_id', cuartelIds),
    APP.sb.from('detenidos').select('id,cuartel_id,nacionalidad,situacion_migratoria,tiene_alerta_internacional,servicio_id,edad')
      .in('cuartel_id', cuartelIds),
    APP.sb.from('especies').select('id,cuartel_id,tipo,valor_uf,servicio_id,tenia_encargo')
      .in('cuartel_id', cuartelIds),
    APP.sb.from('tareas').select('id,cuartel_id,tipo,categoria,nivel_coordinacion,cantidad_vehiculos,cantidad_personas,tiene_resultado,punto_id,servicio_id,prob_terreno,consec_terreno,criticidad_calc,estado_punto')
      .in('cuartel_id', cuartelIds),
    APP.sb.from('hallazgos').select('id,cuartel_id,servicio_id,punto_id,nivel_relevancia')
      .in('cuartel_id', cuartelIds),
    APP.sb.from('historial_anual').select('*').in('cuartel_id', cuartelIds)
      .eq('anio', anioActual - 1).gte('mes', mesInicio).lte('mes', mesFin),
    APP.sb.from('historial_idfi').select('*').in('cuartel_id', cuartelIds)
      .eq('anio', anioActual - 1).gte('mes', mesInicio).lte('mes', mesFin),
    obtenerCuarteles(),
  ])

  const servicioIds = (servicios || []).map(s => s.id)
  const resMap  = (resultados || []).filter(r => servicioIds.includes(r.servicio_id))
  const detMap  = (detenidos  || []).filter(d => servicioIds.includes(d.servicio_id))
  const espMap  = (especies   || []).filter(e => servicioIds.includes(e.servicio_id))
  const tarMap  = (tareas     || []).filter(t => servicioIds.includes(t.servicio_id))
  const halMap  = (hallazgos  || []).filter(h => servicioIds.includes(h.servicio_id))
  const tieneCohecho = resMap.some(r => r.tipo_delito === 'cohecho')

  const resumen = cuartelIds.map(cid => {
    const svcs  = (servicios || []).filter(s => s.cuartel_id === cid)
    const ress  = resMap.filter(r => r.cuartel_id === cid)
    const dets  = detMap.filter(d => d.cuartel_id === cid)
    const esps  = espMap.filter(e => e.cuartel_id === cid)
    const tars  = tarMap.filter(t => t.cuartel_id === cid)
    const hals  = halMap.filter(h => h.cuartel_id === cid)
    const hist  = (historial || []).filter(h => h.cuartel_id === cid)
    const hidfi = (histIdfi  || []).filter(h => h.cuartel_id === cid)
    const cuartelObj = cuarteles.find(c => c.id === cid)
    const dfp = calcularDFP(tars, hals, cuartelObj)
    const dfo = calcularDFO(ress, dets, esps, tars, cuartelObj)
    const idfi_actual = calcularIDFI(dfp.total, dfo.total)
    return {
      cuartel_id: cid, cuartel: cuartelObj,
      detenciones: dets.length,
      uf_incautadas: ress.reduce((a,r) => a+(r.valor_total_uf||0), 0),
      armas: esps.filter(e=>e.tipo==='arma').length,
      servicios: svcs.length,
      infracciones_migratorias: ress.filter(r=>r.tipo_resultado==='infraccion_migratoria').length,
      docs_falsificados: ress.filter(r=>r.tipo_resultado==='documento_falsificado').length,
      obj_internacionales: dets.filter(d=>d.tiene_alerta_internacional).length,
      hitos_visitados: dfp.hitos_visitados, pnh_fiscalizados: dfp.pnh_fiscalizados,
      sie_visitados: dfp.sie_visitados, coordinaciones: dfp.coordinaciones,
      hallazgos_registrados: hals.length,
      dfp, dfo, idfi_actual,
      hist_det:  hist.reduce((a,h)=>a+(h.detenciones_total||0),0),
      hist_uf:   hist.reduce((a,h)=>a+(h.valor_uf_total||0),0),
      hist_arm:  hist.reduce((a,h)=>a+(h.armas_recuperadas||0),0),
      hist_serv: hist.reduce((a,h)=>a+(h.servicios_desplegados||0),0),
      sin_hist:  hist.length === 0,
      idfi_hist: hidfi.length ? promedio(hidfi.map(h=>h.idfi)) : null,
      dfp_hist:  hidfi.length ? promedio(hidfi.map(h=>h.dfp_total)) : null,
      dfo_hist:  hidfi.length ? promedio(hidfi.map(h=>h.dfo_total)) : null,
      sin_idfi_hist: hidfi.length === 0,
    }
  })

  const totales = resumen.reduce((acc,r) => ({
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
    idfi_hist_sum: acc.idfi_hist_sum + (r.idfi_hist||0),
    sin_idfi_hist: acc.sin_idfi_hist || r.sin_idfi_hist,
    n: acc.n + 1,
  }), { detenciones:0, uf_incautadas:0, armas:0, servicios:0,
       hist_det:0, hist_uf:0, hist_arm:0, hist_serv:0, sin_hist:false,
       idfi_actual:0, idfi_hist_sum:0, sin_idfi_hist:false, n:0 })

  totales.idfi_prom      = totales.n > 0 ? totales.idfi_actual   / totales.n : 0
  totales.idfi_hist_prom = totales.n > 0 ? totales.idfi_hist_sum / totales.n : 0
  return { resumen, totales, cuarteles, periodo:{inicio,fin}, tieneCohecho }
}

async function cerrarMesIDFI(cuartelId, anio, mes) {
  const inicio  = `${anio}-${String(mes).padStart(2,'0')}-01`
  const lastDay = new Date(anio, mes, 0).getDate()
  const fin     = `${anio}-${String(mes).padStart(2,'0')}-${lastDay}`
  const { data: svcs } = await APP.sb.from('servicios').select('id')
    .eq('cuartel_id', cuartelId).eq('estado','enviado').gte('fecha',inicio).lte('fecha',fin)
  const svcIds = (svcs||[]).map(s=>s.id)
  if (!svcIds.length) throw new Error('No hay servicios enviados en ese período')
  const [{ data:ress },{ data:dets },{ data:esps },{ data:tars },{ data:hals }] =
    await Promise.all([
      APP.sb.from('resultados').select('*').in('servicio_id',svcIds),
      APP.sb.from('detenidos').select('*').in('servicio_id',svcIds),
      APP.sb.from('especies').select('*').in('servicio_id',svcIds),
      APP.sb.from('tareas').select('*').in('servicio_id',svcIds),
      APP.sb.from('hallazgos').select('*').in('servicio_id',svcIds),
    ])
  const cuartel = APP.cuartel
  const dfp     = calcularDFP(tars||[], hals||[], cuartel)
  const dfo     = calcularDFO(ress||[], dets||[], esps||[], tars||[], cuartel)
  const idfi_val = calcularIDFI(dfp.total, dfo.total)
  const nivel   = idfiLabel(idfi_val).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  const { error } = await APP.sb.from('historial_idfi').upsert({
    cuartel_id:cid, anio, mes,
    dfp_01:dfp.dfp01, dfp_02:dfp.dfp02, dfp_03:dfp.dfp03,
    dfp_04:dfp.dfp04, dfp_05:dfp.dfp05, dfp_total:dfp.total,
    dfo_01:dfo.dfo01, dfo_02:dfo.dfo02, dfo_03:dfo.dfo03,
    dfo_04:dfo.dfo04, dfo_05:dfo.dfo05, dfo_06:dfo.dfo06,
    dfo_total:dfo.total, idfi:idfi_val, nivel,
  })
  if (error) throw error
  return { dfp, dfo, idfi:idfi_val, nivel }
}

// ── Fechas ───────────────────────────────────────────────────
function calcularFechas(filtro) {
  const hoy = new Date()
  const fin = hoy.toISOString().split('T')[0]
  let inicio
  if (filtro === '7dias')       inicio = new Date(hoy - 7*864e5).toISOString().split('T')[0]
  else if (filtro === '28dias') inicio = new Date(hoy - 28*864e5).toISOString().split('T')[0]
  else if (filtro === 'anio')   inicio = `${hoy.getFullYear()}-01-01`
  else if (filtro?.inicio)      return {
    inicio:filtro.inicio, fin:filtro.fin,
    anioActual: hoy.getFullYear(),
    mesInicio: Number(filtro.inicio.split('-')[1]),
    mesFin:    Number(filtro.fin.split('-')[1]),
  }
  else inicio = new Date(hoy - 28*864e5).toISOString().split('T')[0]
  return { inicio, fin, anioActual:hoy.getFullYear(),
    mesInicio:Number(inicio.split('-')[1]), mesFin:Number(fin.split('-')[1]) }
}

// ── Geoespacial ───────────────────────────────────────────────
function distanciaKm(lat1, lon1, lat2, lon2) {
  if (!lat1||!lon1||!lat2||!lon2) return null
  const R=6371, dLat=(lat2-lat1)*Math.PI/180, dLon=(lon2-lon1)*Math.PI/180
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2
  return parseFloat((R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))).toFixed(2))
}

function puntosMasCercanos(lat, lon, puntos, limite=3) {
  return puntos
    .filter(p => p.latitud && p.longitud)
    .map(p => ({
      ...p,
      distancia_km: distanciaKm(lat, lon, p.latitud, p.longitud),
      dentro_radio: distanciaKm(lat, lon, p.latitud, p.longitud) <= (p.radio_influencia_km||10),
    }))
    .sort((a,b) => a.distancia_km - b.distancia_km)
    .slice(0, limite)
}

async function obtenerGPS() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('GPS no disponible')); return }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({
        lat: parseFloat(pos.coords.latitude.toFixed(7)),
        lon: parseFloat(pos.coords.longitude.toFixed(7)),
        precision: pos.coords.accuracy,
      }),
      err => reject(new Error('No se pudo obtener ubicación: '+err.message)),
      { timeout:10000, enableHighAccuracy:true }
    )
  })
}

// ── Coordenadas sexagesimales ─────────────────────────────────
function dmsADecimal(dms) {
  if (!dms || typeof dms !== 'string') return null
  const s    = dms.trim().toUpperCase()
  const hemi = s.slice(-1)
  const nums = s.replace(/[^\d.]+/g,' ').trim().split(/\s+/).map(Number)
  if (!nums.length) return null
  const [grados=0, minutos=0, segundos=0] = nums
  let decimal = grados + minutos/60 + segundos/3600
  if (hemi==='S'||hemi==='O'||hemi==='W') decimal = -decimal
  return parseFloat(decimal.toFixed(7))
}

function decimalADms(decimal, esLongitud=false) {
  if (decimal===null||decimal===undefined) return ''
  const abs     = Math.abs(decimal)
  const grados  = Math.floor(abs)
  const minRest = (abs - grados)*60
  const minutos = Math.floor(minRest)
  const segundos = Math.round((minRest - minutos)*60)
  const hemi    = esLongitud
    ? (decimal >= 0 ? 'E' : 'O')
    : (decimal >= 0 ? 'N' : 'S')
  return `${grados}°${String(minutos).padStart(2,'0')}'${String(segundos).padStart(2,'0')}"${hemi}`
}

// ── Criticidad automática ─────────────────────────────────────
function calcularCriticidadAutomatica(tarea, puntos) {
  // PROBABILIDAD desde datos registrados
  let prob = { sin_novedad:1, zona_atencion:2, amenaza_activa:4, descartado:0 }[tarea.estado_punto] ?? 1

  if (tarea.tiene_hallazgo && tarea.hallazgo?.tipo_evidencia) {
    const pesoEv = {
      'Huellas peatonales':1, 'Huellas vehiculares':1,
      'Residuos recientes':2, 'Campamento':2,
      'Vehículo abandonado':3, 'Señalización ilícita':3, 'Otro':1,
      'Avistamiento FF.PP./militares extranjeros':4,
    }
    prob = Math.max(prob, (pesoEv[tarea.hallazgo.tipo_evidencia]||1)+1)
    if (tarea.hallazgo.nivel_relevancia==='alto') prob = Math.min(prob+1, 5)
  }
  if (tarea.tiene_resultado && tarea.resultado?.tipo_resultado) {
    const graves=['detencion','bien_cot_sin_detenido','objetivo_internacional']
    prob = graves.includes(tarea.resultado.tipo_resultado)
      ? Math.min(prob+2, 5) : Math.min(prob+1, 5)
  }
  prob = Math.min(Math.max(prob, 1), 5)

  // CONSECUENCIA desde valor estratégico del punto + delito
  let consec = 2
  const puntoAsociado = puntos.find(p => p.id === tarea.punto_id)
  if (puntoAsociado) {
    consec = { simbolico:1, bajo:1, medio:2, alto:3, critico:4 }[puntoAsociado.valor_estrategico] ?? 2
  }
  const delitosCT = ['trafico_drogas','trafico_migrantes','trata_personas','contrabando','armas','falsificacion','abigeato']
  if (tarea.resultado?.tipo_delito && delitosCT.includes(tarea.resultado.tipo_delito))
    consec = Math.min(consec+1, 5)
  if (tarea.resultado?.tipo_delito === 'cohecho') consec = Math.min(consec+2, 5)
  if (tarea.resultado?.detenidos?.some(d=>d.tiene_alerta_internacional)) consec = Math.min(consec+1, 5)
  consec = Math.min(Math.max(consec, 1), 5)

  const valor = prob * consec
  return { prob, consec, valor, nivel: criticidadLabel(valor) }
}

// ── Niveles Excel delitos CT ──────────────────────────────────
function calcularNivelDelitoExcel(categoria, cantidad) {
  if (!cantidad || cantidad === 0) return 1
  const umbralPersonas = [{max:3,nivel:1},{max:8,nivel:2},{max:13,nivel:3},{max:19,nivel:4},{max:Infinity,nivel:5}]
  const umbralCasos    = [{max:1,nivel:1},{max:2,nivel:2},{max:3,nivel:3},{max:4,nivel:4},{max:Infinity,nivel:5}]
  const usaPersonas    = ['trafico_migrantes','ingreso_ilegal_adulto','ingreso_ilegal_nna','egreso_ilegal_adulto','egreso_ilegal_nna'].includes(categoria)
  return (usaPersonas ? umbralPersonas : umbralCasos).find(e => cantidad <= e.max)?.nivel || 1
}

function calcularNivelesDelitosCT(resultados, detenidos, especies) {
  return {
    vehiculos_delito:    calcularNivelDelitoExcel('casos', especies.filter(e=>e.tipo==='vehiculo'&&e.tenia_encargo).length),
    contrabando_armas:   calcularNivelDelitoExcel('casos', resultados.filter(r=>r.tipo_delito==='armas').length),
    contrabando_entrada: calcularNivelDelitoExcel('casos', resultados.filter(r=>r.tipo_delito==='contrabando'&&r.direccion_contrabando==='entrada').length),
    contrabando_salida:  calcularNivelDelitoExcel('casos', resultados.filter(r=>r.tipo_delito==='contrabando'&&r.direccion_contrabando==='salida').length),
    trafico_migrantes:   calcularNivelDelitoExcel('trafico_migrantes', detenidos.filter(d=>d.tipo_delito==='trafico_migrantes').length),
    ingreso_adulto:      calcularNivelDelitoExcel('ingreso_ilegal_adulto', detenidos.filter(d=>d.situacion_migratoria==='irregular'&&(d.edad||99)>=18).length),
    ingreso_nna:         calcularNivelDelitoExcel('ingreso_ilegal_nna', detenidos.filter(d=>d.situacion_migratoria==='irregular'&&d.edad!==null&&d.edad<18).length),
    egreso_adulto:       calcularNivelDelitoExcel('egreso_ilegal_adulto', resultados.filter(r=>r.tipo_resultado==='egreso_ilegal'&&(r.edad_imputado||99)>=18).length),
    egreso_nna:          calcularNivelDelitoExcel('egreso_ilegal_nna', resultados.filter(r=>r.tipo_resultado==='egreso_ilegal'&&r.edad_imputado!==null&&r.edad_imputado<18).length),
    ley_20000:           calcularNivelDelitoExcel('casos', resultados.filter(r=>r.tipo_delito==='trafico_drogas').length),
    avistamiento_ffpp:   calcularNivelDelitoExcel('casos', resultados.filter(r=>r.tipo_resultado==='avistamiento_ffpp_extranjero').length),
    daño_hitos:          calcularNivelDelitoExcel('casos', resultados.filter(r=>r.tipo_resultado==='daño_a_hito').length),
    abigeato:            calcularNivelDelitoExcel('casos', resultados.filter(r=>r.tipo_delito==='abigeato').length),
  }
}

// ── Helpers ───────────────────────────────────────────────────
function promedio(arr) { return arr?.length ? arr.reduce((a,b)=>a+(b||0),0)/arr.length : 0 }
function el(id)             { return document.getElementById(id) }
function html(id, content)  { const e=el(id); if(e) e.innerHTML=content }
function show(id)           { const e=el(id); if(e) e.style.display='' }
function hide(id)           { const e=el(id); if(e) e.style.display='none' }

function idfiColor(val) {
  const n=SISCOF_CONFIG.IDFI_NIVELES
  if(val>=n.OPTIMO.min)    return n.OPTIMO.color
  if(val>=n.ADECUADO.min)  return n.ADECUADO.color
  if(val>=n.DEFICIENTE.min)return n.DEFICIENTE.color
  return n.CRITICO.color
}
function idfiLabel(val) {
  const n=SISCOF_CONFIG.IDFI_NIVELES
  if(val>=n.OPTIMO.min)    return n.OPTIMO.label
  if(val>=n.ADECUADO.min)  return n.ADECUADO.label
  if(val>=n.DEFICIENTE.min)return n.DEFICIENTE.label
  return n.CRITICO.label
}
function criticidadInfo(val) {
  if(val>=21) return {bg:'#d70015',color:'#fff'}
  if(val>=16) return {bg:'#fff0f1',color:'#d70015'}
  if(val>=11) return {bg:'#fff4ec',color:'#c45000'}
  if(val>=6)  return {bg:'#fffbea',color:'#9a6e00'}
  return          {bg:'#e8f5ea',color:'#1a6b2a'}
}
function criticidadLabel(val) {
  if(val>=21) return `Criticidad: ${val} — EMERGENCIA`
  if(val>=16) return `Criticidad: ${val} — RIESGO CRÍTICO`
  if(val>=11) return `Criticidad: ${val} — RIESGO ALTO`
  if(val>=6)  return `Criticidad: ${val} — MODERADO`
  return            `Criticidad: ${val} — BAJO`
}
function toast(msg, tipo='ok') {
  let c=document.getElementById('toast-container')
  if(!c){c=document.createElement('div');c.id='toast-container';document.body.appendChild(c)}
  const t=document.createElement('div')
  t.className=`toast toast-${tipo}`
  t.innerHTML=`<span>${tipo==='ok'?'✓':'✕'}</span> ${msg}`
  c.appendChild(t); setTimeout(()=>t.remove(),3500)
}
function barraProgreso(valor,color,fondo='#e8e8ed') {
  const pct=Math.min(Math.max(valor||0,0),100).toFixed(1)
  return `<div style="height:5px;background:${fondo};border-radius:3px;overflow:hidden;margin-top:4px">
    <div style="height:100%;width:${pct}%;background:${color};border-radius:3px;transition:width .4s ease"></div>
  </div>`
}
function varHtml(variacion, sinDato, sufijo='') {
  if(sinDato||variacion===null||variacion===undefined)
    return `<span class="sin-dato">Sin dato año ant.</span>`
  const color=variacion>=0?'#1a6b2a':'#d70015'
  const flecha=variacion>=0?'▲':'▼'
  const val=typeof variacion==='number'&&!Number.isInteger(variacion)?variacion.toFixed(1):variacion
  return `<span style="color:${color};font-weight:600">${flecha} ${variacion>=0?'+':''}${val}${sufijo}</span>`
}
