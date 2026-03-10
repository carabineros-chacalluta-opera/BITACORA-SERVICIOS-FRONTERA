-- ============================================================
-- SISCOF - Row Level Security + Vistas + Funciones
-- ============================================================

-- ── RLS básico (ampliar según auth de Supabase) ──
ALTER TABLE servicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE tareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE resultados ENABLE ROW LEVEL SECURITY;
ALTER TABLE detenidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE especies ENABLE ROW LEVEL SECURITY;
ALTER TABLE hallazgos ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- VISTA: RESUMEN DE SERVICIOS POR CUARTEL Y MES
-- ============================================================
CREATE OR REPLACE VIEW v_resumen_mensual AS
SELECT
  s.cuartel_id,
  c.nombre AS cuartel,
  c.tipo AS tipo_cuartel,
  EXTRACT(YEAR FROM s.fecha)::INTEGER AS anio,
  EXTRACT(MONTH FROM s.fecha)::INTEGER AS mes,
  COUNT(DISTINCT s.id) AS total_servicios,
  SUM(s.minutos_operativos) AS minutos_operativos_total,
  SUM(s.minutos_administrativos) AS minutos_admin_total,
  SUM(s.km_termino - s.km_inicio) FILTER (WHERE s.km_termino IS NOT NULL AND s.km_inicio IS NOT NULL) AS km_totales
FROM servicios s
JOIN cuarteles c ON c.id = s.cuartel_id
WHERE s.estado = 'enviado'
GROUP BY s.cuartel_id, c.nombre, c.tipo, anio, mes;

-- ============================================================
-- VISTA: RESULTADOS OPERATIVOS POR CUARTEL Y MES
-- ============================================================
CREATE OR REPLACE VIEW v_resultados_mensual AS
SELECT
  r.cuartel_id,
  c.nombre AS cuartel,
  EXTRACT(YEAR FROM s.fecha)::INTEGER AS anio,
  EXTRACT(MONTH FROM s.fecha)::INTEGER AS mes,
  -- Detenciones
  COUNT(d.id) AS total_detenidos,
  COUNT(d.id) FILTER (WHERE r.tipo_delito IN ('trafico_drogas','trafico_migrantes','trata_personas','contrabando','armas')) AS detenidos_ct,
  COUNT(d.id) FILTER (WHERE d.nacionalidad = 'BOLIVIANO') AS det_bolivianos,
  COUNT(d.id) FILTER (WHERE d.nacionalidad = 'PERUANO') AS det_peruanos,
  COUNT(d.id) FILTER (WHERE d.nacionalidad = 'CHILENO') AS det_chilenos,
  COUNT(d.id) FILTER (WHERE d.nacionalidad NOT IN ('BOLIVIANO','PERUANO','CHILENO')) AS det_otras_nac,
  -- Tipos de delito
  COUNT(r.id) FILTER (WHERE r.tipo_delito = 'trafico_drogas') AS det_trafico_drogas,
  COUNT(r.id) FILTER (WHERE r.tipo_delito = 'trafico_migrantes') AS det_trafico_migrantes,
  COUNT(r.id) FILTER (WHERE r.tipo_delito = 'trata_personas') AS det_trata_personas,
  COUNT(r.id) FILTER (WHERE r.tipo_delito = 'contrabando') AS det_contrabando,
  COUNT(r.id) FILTER (WHERE r.tipo_delito = 'armas') AS det_armas,
  COUNT(r.id) FILTER (WHERE r.tipo_delito = 'falsificacion') AS det_falsificacion,
  -- Incautaciones
  COALESCE(SUM(r.valor_total_uf), 0) AS valor_uf_total,
  -- Controles
  COALESCE(SUM(t.cantidad_vehiculos), 0) AS controles_vehiculares,
  COALESCE(SUM(t.cantidad_personas), 0) AS controles_personas
FROM resultados r
JOIN servicios s ON s.id = r.servicio_id
JOIN cuarteles c ON c.id = r.cuartel_id
LEFT JOIN detenidos d ON d.resultado_id = r.id
LEFT JOIN tareas t ON t.id = r.tarea_id
WHERE s.estado = 'enviado'
GROUP BY r.cuartel_id, c.nombre, anio, mes;

-- ============================================================
-- VISTA: COBERTURA TERRITORIAL POR CUARTEL Y MES
-- ============================================================
CREATE OR REPLACE VIEW v_cobertura_mensual AS
SELECT
  t.cuartel_id,
  c.nombre AS cuartel,
  EXTRACT(YEAR FROM s.fecha)::INTEGER AS anio,
  EXTRACT(MONTH FROM s.fecha)::INTEGER AS mes,
  COUNT(t.id) FILTER (WHERE t.tipo = 'visita_hito') AS hitos_visitados,
  COUNT(t.id) FILTER (WHERE t.tipo = 'fiscalizacion_pnh') AS pnh_fiscalizados,
  COUNT(t.id) FILTER (WHERE t.tipo = 'visita_sie') AS sie_visitados,
  COUNT(t.id) FILTER (WHERE t.tipo = 'coordinacion') AS coordinaciones,
  COUNT(t.id) FILTER (WHERE t.tipo = 'coordinacion' AND t.nivel_coordinacion = 'alto') AS coord_alto,
  COUNT(t.id) FILTER (WHERE t.tipo = 'coordinacion' AND t.nivel_coordinacion = 'medio') AS coord_medio,
  COUNT(t.id) FILTER (WHERE t.tipo = 'coordinacion' AND t.nivel_coordinacion = 'bajo') AS coord_bajo,
  COUNT(h.id) AS hallazgos_registrados
FROM tareas t
JOIN servicios s ON s.id = t.servicio_id
JOIN cuarteles c ON c.id = t.cuartel_id
LEFT JOIN hallazgos h ON h.tarea_id = t.id
WHERE s.estado = 'enviado' AND t.categoria = 'territorial'
GROUP BY t.cuartel_id, c.nombre, anio, mes;

-- ============================================================
-- FUNCIÓN: CALCULAR FVC PARA UN PUNTO Y MES
-- ============================================================
CREATE OR REPLACE FUNCTION calcular_fvc(
  p_punto_id UUID,
  p_anio INTEGER,
  p_mes INTEGER
) RETURNS TABLE (
  puntaje NUMERIC,
  fvc TEXT,
  visitas_requeridas INTEGER,
  score_actividad NUMERIC,
  score_inteligencia NUMERIC,
  score_estacionalidad NUMERIC,
  score_valor_estrategico NUMERIC
) AS $$
DECLARE
  v_punto puntos_territoriales%ROWTYPE;
  v_score_act NUMERIC := 0;
  v_score_int NUMERIC := 20;
  v_score_est NUMERIC := 50;
  v_score_val NUMERIC := 50;
  v_total NUMERIC;
  v_fvc TEXT;
  v_visitas INTEGER;
  v_fecha_inicio DATE;
  v_fecha_fin DATE;
  v_mes_key TEXT;
  v_csf_vigente UUID;
BEGIN
  SELECT * INTO v_punto FROM puntos_territoriales WHERE id = p_punto_id;

  -- Score valor estratégico
  v_score_val := CASE v_punto.valor_estrategico
    WHEN 'critico'   THEN 100
    WHEN 'alto'      THEN 75
    WHEN 'medio'     THEN 50
    WHEN 'bajo'      THEN 25
    WHEN 'simbolico' THEN 10
    ELSE 50
  END;

  -- Score estacionalidad del mes
  v_mes_key := p_mes::TEXT;
  v_score_est := CASE (v_punto.estacionalidad->>v_mes_key)
    WHEN 'alto'  THEN 100
    WHEN 'medio' THEN 50
    WHEN 'bajo'  THEN 10
    ELSE 50
  END;

  -- Score actividad (últimos 90 días desde inicio del mes)
  v_fecha_inicio := make_date(p_anio, p_mes, 1) - INTERVAL '90 days';
  v_fecha_fin    := make_date(p_anio, p_mes, 1);

  SELECT COALESCE(
    LEAST(
      (
        SELECT SUM(
          CASE e.tipo
            WHEN 'arma'       THEN 10
            WHEN 'droga'      THEN 10
            WHEN 'vehiculo'   THEN 7
            WHEN 'dinero'     THEN 6
            ELSE 3
          END
        )
        FROM hallazgos h
        JOIN tareas t ON t.id = h.tarea_id
        JOIN servicios s ON s.id = t.servicio_id
        LEFT JOIN resultados r ON r.tarea_id = t.id
        LEFT JOIN especies e ON e.resultado_id = r.id
        WHERE h.punto_id = p_punto_id
          AND s.fecha BETWEEN v_fecha_inicio AND v_fecha_fin
      ) * 10, -- normalizar a 100
      100
    ),
    0
  ) INTO v_score_act;

  -- Score inteligencia (CSF vigente)
  SELECT cp.score_inteligencia INTO v_score_int
  FROM csf_puntos cp
  JOIN csf cf ON cf.id = cp.csf_id
  WHERE cp.punto_id = p_punto_id
    AND cf.cuartel_id = v_punto.cuartel_id
    AND cf.fecha_vigencia_fin >= make_date(p_anio, p_mes, 1)
  ORDER BY cf.fecha_emision DESC
  LIMIT 1;

  IF v_score_int IS NULL THEN v_score_int := 20; END IF;

  -- Puntaje final
  v_total := (v_score_act * 0.40) + (v_score_int * 0.30) +
             (v_score_est * 0.20) + (v_score_val * 0.10);

  -- FVC asignada
  v_fvc := CASE
    WHEN v_total >= 80 THEN '2x_semana'
    WHEN v_total >= 60 THEN '1x_semana'
    WHEN v_total >= 40 THEN '1x_15dias'
    WHEN v_total >= 20 THEN '1x_mes'
    ELSE '1x_bimestral'
  END;

  v_visitas := CASE v_fvc
    WHEN '2x_semana'    THEN 8
    WHEN '1x_semana'    THEN 4
    WHEN '1x_15dias'    THEN 2
    WHEN '1x_mes'       THEN 1
    WHEN '1x_bimestral' THEN 1
  END;

  RETURN QUERY SELECT v_total, v_fvc, v_visitas,
    v_score_act, v_score_int, v_score_est, v_score_val;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCIÓN: CALCULAR IDFI PARA UN CUARTEL Y PERÍODO
-- ============================================================
CREATE OR REPLACE FUNCTION calcular_idfi(
  p_cuartel_id UUID,
  p_fecha_inicio DATE,
  p_fecha_fin DATE
) RETURNS TABLE (
  dfp01 NUMERIC, dfp02 NUMERIC, dfp03 NUMERIC,
  dfp04 NUMERIC, dfp05 NUMERIC, dfp_ponderado NUMERIC,
  dfo01 NUMERIC, dfo02 NUMERIC, dfo03 NUMERIC,
  dfo04 NUMERIC, dfo05 NUMERIC, dfo06 NUMERIC,
  dfo_ponderado NUMERIC, idfi NUMERIC, nivel TEXT
) AS $$
DECLARE
  -- DFP
  v_hitos_asignados INTEGER;
  v_hitos_visitados INTEGER;
  v_pnh_asignados INTEGER;
  v_pnh_fiscalizados INTEGER;
  v_sie_planificados INTEGER;
  v_sie_visitados INTEGER;
  v_coord_planificado NUMERIC;
  v_coord_ejecutado NUMERIC;
  v_reportes_solicitados INTEGER := 4; -- mensual por defecto
  v_reportes_entregados INTEGER;
  -- DFO
  v_total_controles INTEGER;
  v_controles_resultado INTEGER;
  v_total_identidad INTEGER;
  v_docs_falsos INTEGER;
  v_total_migratorios INTEGER;
  v_resultados_migratorios INTEGER;
  v_total_procedimientos INTEGER;
  v_detenciones_ct INTEGER;
  v_valor_uf NUMERIC;
  v_meta_uf NUMERIC := 500;
  v_objetivos_requeridos INTEGER := 1;
  v_objetivos_capturados INTEGER;
  -- Resultados
  r_dfp01 NUMERIC; r_dfp02 NUMERIC; r_dfp03 NUMERIC;
  r_dfp04 NUMERIC; r_dfp05 NUMERIC; r_dfp_pond NUMERIC;
  r_dfo01 NUMERIC; r_dfo02 NUMERIC; r_dfo03 NUMERIC;
  r_dfo04 NUMERIC; r_dfo05 NUMERIC; r_dfo06 NUMERIC;
  r_dfo_pond NUMERIC; r_idfi NUMERIC; r_nivel TEXT;
BEGIN
  -- Totales de puntos asignados
  SELECT COUNT(*) INTO v_hitos_asignados FROM puntos_territoriales WHERE cuartel_id = p_cuartel_id AND tipo = 'hito' AND activo = TRUE;
  SELECT COUNT(*) INTO v_pnh_asignados   FROM puntos_territoriales WHERE cuartel_id = p_cuartel_id AND tipo = 'pnh'  AND activo = TRUE;
  SELECT COUNT(*) INTO v_sie_planificados FROM puntos_territoriales WHERE cuartel_id = p_cuartel_id AND tipo = 'sie' AND activo = TRUE;

  -- DFP-01: Hitos visitados conforme FVC
  SELECT COUNT(DISTINCT t.punto_id) INTO v_hitos_visitados
  FROM tareas t JOIN servicios s ON s.id = t.servicio_id
  WHERE s.cuartel_id = p_cuartel_id AND s.estado = 'enviado'
    AND t.tipo = 'visita_hito'
    AND s.fecha BETWEEN p_fecha_inicio AND p_fecha_fin;

  r_dfp01 := CASE WHEN v_hitos_asignados = 0 THEN 0
    ELSE LEAST((v_hitos_visitados::NUMERIC / v_hitos_asignados) * 100, 100) END;

  -- DFP-02: PNH fiscalizados
  SELECT COUNT(DISTINCT t.punto_id) INTO v_pnh_fiscalizados
  FROM tareas t JOIN servicios s ON s.id = t.servicio_id
  WHERE s.cuartel_id = p_cuartel_id AND s.estado = 'enviado'
    AND t.tipo = 'fiscalizacion_pnh'
    AND s.fecha BETWEEN p_fecha_inicio AND p_fecha_fin;

  r_dfp02 := CASE WHEN v_pnh_asignados = 0 THEN 0
    ELSE LEAST((v_pnh_fiscalizados::NUMERIC / v_pnh_asignados) * 100, 100) END;

  -- DFP-03: SIE visitados
  SELECT COUNT(DISTINCT t.punto_id) INTO v_sie_visitados
  FROM tareas t JOIN servicios s ON s.id = t.servicio_id
  WHERE s.cuartel_id = p_cuartel_id AND s.estado = 'enviado'
    AND t.tipo = 'visita_sie'
    AND s.fecha BETWEEN p_fecha_inicio AND p_fecha_fin;

  r_dfp03 := CASE WHEN v_sie_planificados = 0 THEN 0
    ELSE LEAST((v_sie_visitados::NUMERIC / v_sie_planificados) * 100, 100) END;

  -- DFP-04: Coordinaciones (puntaje ponderado por nivel)
  SELECT COALESCE(SUM(CASE nivel_coordinacion WHEN 'alto' THEN 3 WHEN 'medio' THEN 2 ELSE 1 END), 0) INTO v_coord_ejecutado
  FROM tareas t JOIN servicios s ON s.id = t.servicio_id
  WHERE s.cuartel_id = p_cuartel_id AND s.estado = 'enviado'
    AND t.tipo = 'coordinacion'
    AND s.fecha BETWEEN p_fecha_inicio AND p_fecha_fin;

  r_dfp04 := LEAST(v_coord_ejecutado * 10, 100);

  -- DFP-05: Hallazgos registrados (proxy de producción inteligencia)
  SELECT COUNT(*) INTO v_reportes_entregados
  FROM hallazgos h JOIN servicios s ON s.id = h.servicio_id
  WHERE h.cuartel_id = p_cuartel_id AND s.estado = 'enviado'
    AND s.fecha BETWEEN p_fecha_inicio AND p_fecha_fin;

  r_dfp05 := LEAST(v_reportes_entregados * 25, 100);

  -- DFP Ponderado
  r_dfp_pond := (r_dfp01*0.25) + (r_dfp02*0.30) + (r_dfp03*0.15) + (r_dfp04*0.15) + (r_dfp05*0.15);

  -- DFO-01: Eficacia controles
  SELECT COALESCE(SUM(t.cantidad_vehiculos + t.cantidad_personas), 0) INTO v_total_controles
  FROM tareas t JOIN servicios s ON s.id = t.servicio_id
  WHERE s.cuartel_id = p_cuartel_id AND s.estado = 'enviado'
    AND t.categoria = 'operativa' AND s.fecha BETWEEN p_fecha_inicio AND p_fecha_fin;

  SELECT COUNT(*) INTO v_controles_resultado
  FROM resultados r JOIN servicios s ON s.id = r.servicio_id
  WHERE r.cuartel_id = p_cuartel_id AND s.estado = 'enviado'
    AND s.fecha BETWEEN p_fecha_inicio AND p_fecha_fin;

  r_dfo01 := CASE WHEN v_total_controles = 0 THEN 0
    ELSE LEAST((v_controles_resultado::NUMERIC / v_total_controles) * 100, 100) END;

  -- DFO-02: Documentos falsificados
  SELECT COUNT(*) INTO v_docs_falsos
  FROM resultados r JOIN servicios s ON s.id = r.servicio_id
  WHERE r.cuartel_id = p_cuartel_id AND s.estado = 'enviado'
    AND r.tipo_resultado = 'documento_falsificado'
    AND s.fecha BETWEEN p_fecha_inicio AND p_fecha_fin;

  r_dfo02 := LEAST(v_docs_falsos * 20, 100);

  -- DFO-03: Control migratorio
  SELECT COUNT(*) INTO v_total_migratorios
  FROM tareas t JOIN servicios s ON s.id = t.servicio_id
  WHERE s.cuartel_id = p_cuartel_id AND s.estado = 'enviado'
    AND t.tipo LIKE '%migratorio%' AND s.fecha BETWEEN p_fecha_inicio AND p_fecha_fin;

  SELECT COUNT(*) INTO v_resultados_migratorios
  FROM resultados r JOIN servicios s ON s.id = r.servicio_id
  WHERE r.cuartel_id = p_cuartel_id AND s.estado = 'enviado'
    AND r.tipo_resultado = 'infraccion_migratoria'
    AND s.fecha BETWEEN p_fecha_inicio AND p_fecha_fin;

  r_dfo03 := CASE WHEN v_total_migratorios = 0 THEN 0
    ELSE LEAST((v_resultados_migratorios::NUMERIC / GREATEST(v_total_migratorios,1)) * 100, 100) END;

  -- DFO-04: Interdicción CT
  SELECT COUNT(*) INTO v_total_procedimientos
  FROM resultados r JOIN servicios s ON s.id = r.servicio_id
  WHERE r.cuartel_id = p_cuartel_id AND s.estado = 'enviado'
    AND s.fecha BETWEEN p_fecha_inicio AND p_fecha_fin;

  SELECT COUNT(*) INTO v_detenciones_ct
  FROM resultados r JOIN servicios s ON s.id = r.servicio_id
  WHERE r.cuartel_id = p_cuartel_id AND s.estado = 'enviado'
    AND r.tipo_delito IN ('trafico_drogas','trafico_migrantes','trata_personas','contrabando','armas','falsificacion')
    AND s.fecha BETWEEN p_fecha_inicio AND p_fecha_fin;

  r_dfo04 := CASE WHEN v_total_procedimientos = 0 THEN 0
    ELSE LEAST((v_detenciones_ct::NUMERIC / GREATEST(v_total_procedimientos,1)) * 100, 100) END;

  -- DFO-05: Impacto económico UF
  SELECT COALESCE(SUM(r.valor_total_uf), 0) INTO v_valor_uf
  FROM resultados r JOIN servicios s ON s.id = r.servicio_id
  WHERE r.cuartel_id = p_cuartel_id AND s.estado = 'enviado'
    AND s.fecha BETWEEN p_fecha_inicio AND p_fecha_fin;

  r_dfo05 := LEAST((v_valor_uf / v_meta_uf) * 100, 100);

  -- DFO-06: Objetivos internacionales
  SELECT COUNT(*) INTO v_objetivos_capturados
  FROM resultados r JOIN servicios s ON s.id = r.servicio_id
  WHERE r.cuartel_id = p_cuartel_id AND s.estado = 'enviado'
    AND r.tipo_resultado = 'objetivo_internacional'
    AND s.fecha BETWEEN p_fecha_inicio AND p_fecha_fin;

  r_dfo06 := LEAST((v_objetivos_capturados::NUMERIC / v_objetivos_requeridos) * 100, 100);

  -- DFO Ponderado
  r_dfo_pond := (r_dfo01*0.15) + (r_dfo02*0.10) + (r_dfo03*0.15) +
                (r_dfo04*0.30) + (r_dfo05*0.15) + (r_dfo06*0.15);

  -- IDFI
  r_idfi := (r_dfp_pond * 0.40) + (r_dfo_pond * 0.60);

  -- Nivel
  r_nivel := CASE
    WHEN r_idfi >= 90 THEN 'ÓPTIMO'
    WHEN r_idfi >= 70 THEN 'ADECUADO'
    WHEN r_idfi >= 50 THEN 'DEFICIENTE'
    ELSE 'CRÍTICO'
  END;

  RETURN QUERY SELECT
    r_dfp01, r_dfp02, r_dfp03, r_dfp04, r_dfp05, r_dfp_pond,
    r_dfo01, r_dfo02, r_dfo03, r_dfo04, r_dfo05, r_dfo06,
    r_dfo_pond, r_idfi, r_nivel;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCIÓN: COMPARATIVA HISTÓRICA
-- ============================================================
CREATE OR REPLACE FUNCTION comparativa_historica(
  p_cuartel_id UUID,
  p_anio INTEGER,
  p_mes_inicio INTEGER,
  p_mes_fin INTEGER
) RETURNS TABLE (
  -- Actual
  detenciones_actual INTEGER,
  uf_actual NUMERIC,
  armas_actual INTEGER,
  servicios_actual INTEGER,
  -- Histórico
  detenciones_hist INTEGER,
  uf_hist NUMERIC,
  armas_hist INTEGER,
  servicios_hist INTEGER,
  -- Variación
  var_detenciones INTEGER,
  var_uf NUMERIC,
  var_armas INTEGER,
  var_servicios INTEGER,
  -- Porcentajes
  pct_detenciones NUMERIC,
  pct_uf NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH actual AS (
    SELECT
      COUNT(DISTINCT d.id)::INTEGER AS det,
      COALESCE(SUM(r.valor_total_uf), 0) AS uf,
      COUNT(e.id) FILTER (WHERE e.tipo = 'arma')::INTEGER AS arm,
      COUNT(DISTINCT s.id)::INTEGER AS srv
    FROM servicios s
    LEFT JOIN resultados r ON r.servicio_id = s.id
    LEFT JOIN detenidos d ON d.servicio_id = s.id
    LEFT JOIN especies e ON e.servicio_id = s.id
    WHERE s.cuartel_id = p_cuartel_id
      AND s.estado = 'enviado'
      AND EXTRACT(YEAR FROM s.fecha) = p_anio
      AND EXTRACT(MONTH FROM s.fecha) BETWEEN p_mes_inicio AND p_mes_fin
  ),
  historico AS (
    SELECT
      COALESCE(SUM(h.detenciones_total), 0)::INTEGER AS det,
      COALESCE(SUM(h.valor_uf_total), 0) AS uf,
      COALESCE(SUM(h.armas_recuperadas), 0)::INTEGER AS arm,
      COALESCE(SUM(h.servicios_desplegados), 0)::INTEGER AS srv
    FROM historial_anual h
    WHERE h.cuartel_id = p_cuartel_id
      AND h.anio = p_anio - 1
      AND h.mes BETWEEN p_mes_inicio AND p_mes_fin
  )
  SELECT
    a.det, a.uf, a.arm, a.srv,
    h.det, h.uf, h.arm, h.srv,
    (a.det - h.det), (a.uf - h.uf), (a.arm - h.arm), (a.srv - h.srv),
    CASE WHEN h.det = 0 THEN NULL ELSE ROUND(((a.det - h.det)::NUMERIC / h.det) * 100, 1) END,
    CASE WHEN h.uf  = 0 THEN NULL ELSE ROUND(((a.uf  - h.uf)::NUMERIC  / h.uf)  * 100, 1) END
  FROM actual a, historico h;
END;
$$ LANGUAGE plpgsql;
