// ============================================================
// SISCOF v3 — idex.js
// Motor IDEX: calcula criticidad, frecuencias y genera CSF
// ============================================================

// ── Escalas de frecuencia ────────────────────────────────────
const FRECUENCIAS_ORDEN = [
  '2x_semana','1x_semana','1x_15dias','1x_mes','1x_bimestral'
]
const FRECUENCIA_LABELS = {
  '2x_semana':    '2 veces / semana',
  '1x_semana':    '1 vez / semana',
  '1x_15dias':    '1 vez / 15 días',
  '1x_mes':       '1 vez / mes',
  '1x_bimestral': '1 vez / bimestral',
}
const FRECUENCIA_VISITAS_MES = {
  '2x_semana':    8,
  '1x_semana':    4,
  '1x_15dias':    2,
  '1x_mes':       1,
  '1x_bimestral': 1,
}

// ── Niveles de criticidad P×C → escala 1-5 ──────────────────
function nivelDesdeValorPxC(valor) {
  if (!valor) return 1
  if (valor >= 21) return 5
  if (valor >= 16) return 4
  if (valor >= 11) return 3
  if (valor >= 6)  return 2
  return 1
}

// ── Nivel desde Excel delitos CT ────────────────────────────
function nivelDesdeExcel(categoria, cantidad) {
  if (!cantidad || cantidad === 0) return 1
  const escalaPersonas = [
    {max:3,n:1},{max:8,n:2},{max:13,n:3},{max:19,n:4},{max:Infinity,n:5}
  ]
  const escalaCasos = [
    {max:1,n:1},{max:2,n:2},{max:3,n:3},{max:4,n:4},{max:Infinity,n:5}
  ]
  const usaPersonas = [
    'trafico_migrantes','ingreso_adulto','ingreso_nna',
    'egreso_adulto','egreso_nna'
  ].includes(categoria)
  return (usaPersonas ? escalaPersonas : escalaCasos)
    .find(e => cantidad <= e.max)?.n || 1
}

// ── Frecuencia según nivel de criticidad ────────────────────
function frecuenciaPorNivel(nivel) {
  switch(nivel) {
    case 5: return '2x_semana'
    case 4: return '2x_semana'
    case 3: return '1x_semana'
    case 2: return '1x_15dias'
    default: return '1x_mes'
  }
}

// ── MAX entre dos frecuencias ────────────────────────────────
function maxFrecuencia(a, b) {
  const ia = FRECUENCIAS_ORDEN.indexOf(a)
  const ib = FRECUENCIAS_ORDEN.indexOf(b)
  if (ia === -1) return b
  if (ib === -1) return a
  return ia <= ib ? a : b // menor índice = mayor frecuencia
}

// ── Nivel texto desde número ─────────────────────────────────
function nivelTexto(n) {
  switch(n) {
    case 5: return 'EMERGENCIA'
    case 4: return 'RIESGO CRÍTICO'
    case 3: return 'RIESGO ALTO'
    case 2: return 'MODERADO'
    default: return 'BAJO'
  }
}

function nivelProbabilidad(n) {
  switch(n) {
    case 5: case 4: return 'ALTA'
    case 3:         return 'MEDIA'
    default:        return 'BAJA'
  }
}

// ════════════════════════════════════════════════════════════
// FUNCIÓN PRINCIPAL: calcular todos los datos para la CSF
// ════════════════════════════════════════════════════════════
async function calcularDatosCSF(cuartelId, fechaInicio, fechaFin) {
  // ── 1. Cargar datos del período ──────────────────────────
  const [
    { data: servicios },
    { data: puntos },
    { data: cuartel },
  ] = await Promise.all([
    APP.sb.from('servicios').select('id')
      .eq('cuartel_id', cuartelId)
      .eq('estado', 'enviado')
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin),
    APP.sb.from('puntos_territoriales').select('*')
      .eq('cuartel_id', cuartelId)
      .eq('activo', true)
      .order('tipo').order('nombre'),
    APP.sb.from('cuarteles').select('*')
      .eq('id', cuartelId).single(),
  ])

  const svcIds = (servicios || []).map(s => s.id)

  let tareas=[], resultados=[], detenidos=[], especies=[], hallazgos=[]
  if (svcIds.length) {
    const [t, r, d, e, h] = await Promise.all([
      APP.sb.from('tareas').select('*').in('servicio_id', svcIds),
      APP.sb.from('resultados').select('*').in('servicio_id', svcIds),
      APP.sb.from('detenidos').select('*').in('servicio_id', svcIds),
      APP.sb.from('especies').select('*').in('servicio_id', svcIds),
      APP.sb.from('hallazgos').select('*').in('servicio_id', svcIds),
    ])
    tareas     = t.data || []
    resultados = r.data || []
    detenidos  = d.data || []
    especies   = e.data || []
    hallazgos  = h.data || []
  }

  // ── 2. Criticidad P×C por punto ──────────────────────────
  const criticidadPorPunto = {}
  ;(puntos || []).forEach(p => {
    const tareasPunto = tareas.filter(t => t.punto_id === p.id && t.criticidad_calc)
    const promedio    = tareasPunto.length
      ? tareasPunto.reduce((a,t) => a + (t.criticidad_calc||0), 0) / tareasPunto.length
      : 0
    const max = tareasPunto.length
      ? Math.max(...tareasPunto.map(t => t.criticidad_calc||0))
      : 0
    const ultimoEstado = tareasPunto.sort((a,b) =>
      new Date(b.created_at) - new Date(a.created_at))[0]?.estado_punto || 'sin_novedad'
    const hallazgosPunto = hallazgos.filter(h => h.punto_id === p.id)
    const visitasPunto   = tareas.filter(t => t.punto_id === p.id)

    criticidadPorPunto[p.id] = {
      promedio:     Math.round(promedio * 10) / 10,
      max,
      nivel_pxc:    nivelDesdeValorPxC(max),
      estado_actual: ultimoEstado,
      visitas:      visitasPunto.length,
      hallazgos:    hallazgosPunto.length,
    }
  })

  // ── 3. Niveles Excel delitos CT ───────────────────────────
  const nivelesExcel = {
    vehiculos_delito:    nivelDesdeExcel('casos',
      especies.filter(e => e.tipo==='vehiculo' && e.tenia_encargo).length),
    contrabando_armas:   nivelDesdeExcel('casos',
      resultados.filter(r => r.tipo_delito==='armas').length),
    contrabando_entrada: nivelDesdeExcel('casos',
      resultados.filter(r => r.tipo_delito==='contrabando' && r.direccion_contrabando==='entrada').length),
    contrabando_salida:  nivelDesdeExcel('casos',
      resultados.filter(r => r.tipo_delito==='contrabando' && r.direccion_contrabando==='salida').length),
    trafico_migrantes:   nivelDesdeExcel('trafico_migrantes',
      detenidos.filter(d => d.tipo_delito==='trafico_migrantes').length),
    ingreso_adulto:      nivelDesdeExcel('ingreso_adulto',
      detenidos.filter(d => d.situacion_migratoria==='irregular' && (d.edad||99)>=18).length),
    ingreso_nna:         nivelDesdeExcel('ingreso_nna',
      detenidos.filter(d => d.situacion_migratoria==='irregular' && d.edad!==null && d.edad<18).length),
    egreso_adulto:       nivelDesdeExcel('egreso_adulto',
      resultados.filter(r => r.tipo_resultado==='egreso_ilegal').length),
    egreso_nna:          nivelDesdeExcel('egreso_nna',
      resultados.filter(r => r.tipo_resultado==='egreso_ilegal' && r.edad_nna<18).length),
    ley_20000:           nivelDesdeExcel('casos',
      resultados.filter(r => r.tipo_delito==='trafico_drogas').length),
    avistamiento_ffpp:   nivelDesdeExcel('casos',
      resultados.filter(r => r.tipo_resultado==='avistamiento_ffpp_extranjero').length),
    daño_hitos:          nivelDesdeExcel('casos',
      resultados.filter(r => r.tipo_resultado==='daño_a_hito').length),
    abigeato:            nivelDesdeExcel('casos',
      resultados.filter(r => r.tipo_delito==='abigeato').length),
  }

  // ── 4. Nivel Excel máximo del sector ─────────────────────
  const nivelExcelMax = Math.max(...Object.values(nivelesExcel))

  // ── 5. Criticidad final + frecuencia por punto ───────────
  const puntosProcesados = (puntos || []).map(p => {
    const cp       = criticidadPorPunto[p.id] || { nivel_pxc:1, visitas:0, hallazgos:0 }
    const nivelFinal = Math.max(cp.nivel_pxc, nivelExcelMax > 2 ? nivelExcelMax - 1 : 1)
    const frecCriticidad = frecuenciaPorNivel(nivelFinal)
    const frecMin    = p.frecuencia_minima || '1x_mes'
    const frecFinal  = maxFrecuencia(frecMin, frecCriticidad)
    const visitasReq = FRECUENCIA_VISITAS_MES[frecFinal] || 1
    const meta       = nivelFinal >= 4 ? '≥ 90%' : nivelFinal === 3 ? '≥ 85%' : '≥ 75%'
    const tareasEspecificas = _generarTareasEspecificas(p, nivelFinal, frecFinal)

    return {
      ...p,
      nivel_pxc:          cp.nivel_pxc,
      nivel_excel:        nivelExcelMax,
      nivel_final:        nivelFinal,
      nivel_texto:        nivelTexto(nivelFinal),
      nivel_probabilidad: nivelProbabilidad(nivelFinal),
      frec_minima:        frecMin,
      frec_criticidad:    frecCriticidad,
      frec_final:         frecFinal,
      frec_label:         FRECUENCIA_LABELS[frecFinal],
      visitas_requeridas: visitasReq,
      visitas_ejecutadas: cp.visitas,
      hallazgos_periodo:  cp.hallazgos,
      estado_actual:      cp.estado_actual || 'sin_novedad',
      meta_cumplimiento:  meta,
      tareas_especificas: tareasEspecificas,
    }
  }).sort((a,b) => b.nivel_final - a.nivel_final)

  // ── 6. Amenaza principal sugerida ────────────────────────
  const amenazaSugerida = _calcularAmenazaPrincipal(
    resultados, detenidos, hallazgos, nivelesExcel
  )

  // ── 7. Estadísticas del período ──────────────────────────
  const estadisticas = {
    total_servicios:     svcIds.length,
    total_detenciones:   detenidos.length,
    total_uf:            resultados.reduce((a,r) => a+(r.valor_total_uf||0), 0),
    total_hallazgos:     hallazgos.length,
    puntos_visitados:    puntosProcesados.filter(p => p.visitas_ejecutadas > 0).length,
    puntos_totales:      puntosProcesados.length,
    delitos_ct:          resultados.filter(r =>
      ['trafico_drogas','trafico_migrantes','trata_personas',
       'contrabando','armas','falsificacion','abigeato'].includes(r.tipo_delito)).length,
    objetivos_int:       detenidos.filter(d => d.tiene_alerta_internacional).length,
  }

  return {
    cuartel:          cuartel.data,
    fechaInicio,
    fechaFin,
    puntos:           puntosProcesados,
    nivelesExcel,
    nivelExcelMax,
    amenazaSugerida,
    estadisticas,
    // Datos crudos para el IDFI
    rawData: { tareas, resultados, detenidos, especies, hallazgos }
  }
}

// ── Generar tareas específicas según criticidad ──────────────
function _generarTareasEspecificas(punto, nivel, frecFinal) {
  const tipo = punto.tipo
  const base = tipo === 'hito'
    ? `Visita Hito ${punto.nombre} con verificación de estado y registro fotográfico`
    : tipo === 'pnh'
    ? `Fiscalización PNH ${punto.nombre} con Formulario F-DFP-01, registro GPS y fotográfico`
    : `Visita SIE ${punto.nombre}, verificación instalación y coordinar con personal a cargo`

  if (nivel >= 4) return `${base}. Énfasis VIE–DOM con patrullaje nocturno 22:00–04:00. Prioridad máxima.`
  if (nivel === 3) return `${base}. Reforzar cobertura horaria. Verificar señalización y accesos.`
  return `${base}. Vigilancia de rutina.`
}

// ── Calcular amenaza principal ───────────────────────────────
function _calcularAmenazaPrincipal(resultados, detenidos, hallazgos, nivelesExcel) {
  // Encontrar el delito CT más frecuente
  const conteos = {}
  resultados.forEach(r => {
    if (r.tipo_delito) conteos[r.tipo_delito] = (conteos[r.tipo_delito]||0)+1
  })
  const delitoDominante = Object.entries(conteos)
    .sort((a,b) => b[1]-a[1])[0]

  const etiquetasDelito = {
    trafico_drogas:    'Tráfico de drogas (Ley 20.000)',
    trafico_migrantes: 'Tráfico ilícito de migrantes',
    trata_personas:    'Trata de personas',
    contrabando:       'Contrabando de mercadería',
    armas:             'Contrabando de armas y munición',
    abigeato:          'Abigeato',
    cohecho:           'Cohecho',
  }

  // Encontrar hallazgo más relevante
  const hallazgoAlto = hallazgos
    .filter(h => h.nivel_relevancia === 'alto')
    .sort((a,b) => new Date(b.created_at)-new Date(a.created_at))[0]

  if (!delitoDominante && !hallazgoAlto) {
    return 'Sin actividad delictual confirmada en el período. Mantener vigilancia preventiva.'
  }

  let texto = ''
  if (delitoDominante) {
    const etiq = etiquetasDelito[delitoDominante[0]] || delitoDominante[0]
    texto += `${etiq} confirmada en el período (${delitoDominante[1]} caso${delitoDominante[1]>1?'s':''})`
  }
  if (hallazgoAlto) {
    texto += texto ? `. Hallazgo de alta relevancia: ${hallazgoAlto.descripcion?.substring(0,80)}` : hallazgoAlto.descripcion?.substring(0,120)
  }
  return texto + '. Mantener patrullaje reforzado en sectores priorizados.'
}

// ════════════════════════════════════════════════════════════
// CALCULAR CUMPLIMIENTO DE UNA CSF ACTIVA
// ════════════════════════════════════════════════════════════
async function calcularCumplimientoCSF(csfId, cuartelId) {
  // Cargar datos de la CSF
  const { data: csf } = await APP.sb.from('csf').select('*').eq('id', csfId).single()
  if (!csf) throw new Error('CSF no encontrada')

  const { data: csfPuntos } = await APP.sb
    .from('csf_puntos').select('*, punto:puntos_territoriales(*)')
    .eq('csf_id', csfId)

  // Cargar reprogramaciones aprobadas
  const { data: reprog } = await APP.sb
    .from('reprogramaciones_csf')
    .select('*')
    .eq('csf_id', csfId)
    .eq('estado', 'aprobada')

  // Servicios en el período de vigencia
  const { data: svcs } = await APP.sb.from('servicios').select('id,fecha')
    .eq('cuartel_id', cuartelId).eq('estado', 'enviado')
    .gte('fecha', csf.fecha_vigencia_inicio)
    .lte('fecha', csf.fecha_vigencia_fin || new Date().toISOString().split('T')[0])

  const svcIds = (svcs||[]).map(s => s.id)
  let tareas = []
  if (svcIds.length) {
    const { data: t } = await APP.sb.from('tareas').select('punto_id,tipo,servicio_id')
      .in('servicio_id', svcIds)
    tareas = t || []
  }

  // Calcular días transcurridos y semanas del período
  const inicio  = new Date(csf.fecha_vigencia_inicio)
  const hoy     = new Date()
  const finVig  = csf.fecha_vigencia_fin ? new Date(csf.fecha_vigencia_fin) : hoy
  const diasTotal = Math.ceil((finVig - inicio) / 864e5)
  const diasTrans = Math.min(Math.ceil((hoy - inicio) / 864e5), diasTotal)
  const semanasTrans = Math.max(diasTrans / 7, 0.5)

  // Calcular cumplimiento por punto
  const puntosCumplimiento = (csfPuntos||[]).map(cp => {
    const punto = cp.punto
    const frec  = cp.frecuencia_asignada || '1x_mes'

    // Visitas requeridas proporcionales al tiempo transcurrido
    const visitasMes     = FRECUENCIA_VISITAS_MES[frec] || 1
    const visitasReqTotal= Math.max(Math.round(visitasMes * (diasTrans/30)), 1)

    // Descontar reprogramaciones aprobadas
    const reprogPunto = (reprog||[]).filter(r =>
      r.punto_id === punto.id && r.tipo_ajuste !== 'traslado_mismo_periodo'
    ).length
    const visitasReqAjustadas = Math.max(visitasReqTotal - reprogPunto, 0)

    // Visitas ejecutadas
    const visitasEjec = tareas.filter(t =>
      t.punto_id === punto.id &&
      ['visita_hito','fiscalizacion_pnh','visita_sie'].includes(t.tipo)
    ).length

    const pct = visitasReqAjustadas > 0
      ? Math.min(Math.round((visitasEjec / visitasReqAjustadas) * 100), 100)
      : 100

    // Última visita
    const visitasSvcs = tareas.filter(t => t.punto_id === punto.id)
    const ultimaVisita = visitasSvcs.length
      ? (svcs||[]).find(s => s.id === visitasSvcs[visitasSvcs.length-1].servicio_id)?.fecha
      : null

    // Días sin visita
    const diasSinVisita = ultimaVisita
      ? Math.ceil((hoy - new Date(ultimaVisita)) / 864e5) : diasTrans

    // Umbral de alerta según frecuencia
    const umbralAlerta = {
      '2x_semana':4, '1x_semana':8, '1x_15dias':18, '1x_mes':35, '1x_bimestral':65
    }[frec] || 35

    const estado = pct >= 90 ? 'al_dia'
      : diasSinVisita > umbralAlerta ? 'atrasado'
      : pct >= 50 ? 'proximo'
      : 'atrasado'

    return {
      punto_id:             punto.id,
      nombre:               punto.nombre,
      tipo:                 punto.tipo,
      frecuencia:           frec,
      frec_label:           FRECUENCIA_LABELS[frec],
      visitas_requeridas:   visitasReqAjustadas,
      visitas_ejecutadas:   visitasEjec,
      pct_cumplimiento:     pct,
      ultima_visita:        ultimaVisita,
      dias_sin_visita:      diasSinVisita,
      estado,
      reprog_aprobadas:     reprogPunto,
    }
  })

  // KPIs globales
  const totalReq  = puntosCumplimiento.reduce((a,p) => a+p.visitas_requeridas, 0)
  const totalEjec = puntosCumplimiento.reduce((a,p) => a+p.visitas_ejecutadas, 0)
  const pctGlobal = totalReq > 0 ? Math.round((totalEjec/totalReq)*100) : 100
  const atrasados = puntosCumplimiento.filter(p => p.estado === 'atrasado').length
  const alDia     = puntosCumplimiento.filter(p => p.estado === 'al_dia').length
  const mayorAtraso = puntosCumplimiento
    .filter(p => p.ultima_visita)
    .sort((a,b) => b.dias_sin_visita - a.dias_sin_visita)[0]?.dias_sin_visita || 0

  return {
    csf,
    puntos:          puntosCumplimiento,
    pct_global:      pctGlobal,
    total_requeridas:totalReq,
    total_ejecutadas:totalEjec,
    puntos_al_dia:   alDia,
    puntos_atrasados:atrasados,
    mayor_atraso_dias:mayorAtraso,
    dias_transcurridos:diasTrans,
    dias_totales:    diasTotal,
  }
}

// ── Número correlativo de CSF ────────────────────────────────
async function siguienteNumeroCSF(cuartelId) {
  const anio = new Date().getFullYear()
  const { data, count } = await APP.sb.from('csf')
    .select('id', { count:'exact' })
    .eq('cuartel_id', cuartelId)
  const n = (count||0) + 1
  return `CSF-${String(n).padStart(3,'0')}/${anio}`
}
