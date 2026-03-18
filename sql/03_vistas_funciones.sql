-- ============================================================
-- SISCOF — Vistas, Funciones y RLS
-- Prefectura Arica Nro. 1 · Carabineros de Chile
-- ============================================================

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE servicios   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tareas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE resultados  ENABLE ROW LEVEL SECURITY;
ALTER TABLE detenidos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE especies    ENABLE ROW LEVEL SECURITY;
ALTER TABLE hallazgos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_idfi ENABLE ROW LEVEL SECURITY;

-- Políticas: usuarios autenticados leen su propio cuartel
-- (ajustar según lógica de roles en su proyecto Supabase Auth)
CREATE POLICY IF NOT EXISTS "auth_read" ON servicios
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "auth_insert" ON servicios
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "auth_read" ON tareas
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "auth_insert" ON tareas
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "auth_read" ON resultados
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "auth_insert" ON resultados
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "auth_read" ON detenidos
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "auth_insert" ON detenidos
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "auth_read" ON especies
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "auth_insert" ON especies
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "auth_read" ON hallazgos
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "auth_insert" ON hallazgos
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "auth_read" ON historial_idfi
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "auth_upsert" ON historial_idfi
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================
-- VISTA: RESUMEN MENSUAL POR CUARTEL
-- ============================================================
CREATE OR REPLACE VIEW v_resumen_mensual AS
SELECT
  s.cuartel_id,
  c.nombre AS cuartel,
  c.tipo AS tipo_cuartel,
  EXTRACT(YEAR  FROM s.fecha)::INTEGER AS anio,
  EXTRACT(MONTH FROM s.fecha)::INTEGER AS mes,
  COUNT(DISTINCT s.id) AS total_servicios,
  SUM(s.minutos_operativos) AS minutos_operativos_total,
  SUM(s.km_termino - s.km_inicio)
    FILTER (WHERE s.km_termino IS NOT NULL AND s.km_inicio IS NOT NULL) AS km_totales
FROM servicios s
JOIN cuarteles c ON c.id = s.cuartel_id
WHERE s.estado = 'enviado'
GROUP BY s.cuartel_id, c.nombre, c.tipo, anio, mes;

-- ============================================================
-- VISTA: RESULTADOS OPERATIVOS MENSUAL
-- ============================================================
CREATE OR REPLACE VIEW v_resultados_mensual AS
SELECT
  r.cuartel_id,
  c.nombre AS cuartel,
  EXTRACT(YEAR  FROM s.fecha)::INTEGER AS anio,
  EXTRACT(MONTH FROM s.fecha)::INTEGER AS mes,
  COUNT(d.id) AS total_detenidos,
  COUNT(d.id) FILTER (WHERE r.tipo_delito IN (
    'trafico_drogas','trafico_migrantes','trata_personas',
    'contrabando','armas','falsificacion','abigeato','receptacion','cohecho'
  )) AS detenidos_ct,
  COUNT(d.id) FILTER (WHERE d.tiene_alerta_internacional = TRUE) AS objetivos_internacionales,
  COUNT(r.id) FILTER (WHERE r.tipo_resultado = 'documento_falsificado') AS docs_falsificados,
  COUNT(r.id) FILTER (WHERE r.tipo_resultado = 'infraccion_migratoria') AS infracciones_migratorias,
  COUNT(r.id) FILTER (WHERE r.tipo_resultado = 'objetivo_internacional') AS resultados_obj_int,
  COALESCE(SUM(r.valor_total_uf), 0) AS valor_uf_total,
  COALESCE(SUM(t.cantidad_vehiculos), 0) AS controles_vehiculares,
  COALESCE(SUM(t.cantidad_personas), 0) AS controles_personas
FROM resultados r
JOIN servicios s ON s.id = r.servicio_id
JOIN cuarteles c ON c.id = r.cuartel_id
LEFT JOIN detenidos d ON d.resultado_id = r.id
LEFT JOIN tareas    t ON t.id = r.tarea_id
WHERE s.estado = 'enviado'
GROUP BY r.cuartel_id, c.nombre, anio, mes;

-- ============================================================
-- VISTA: COBERTURA TERRITORIAL MENSUAL
-- ============================================================
CREATE OR REPLACE VIEW v_cobertura_mensual AS
SELECT
  t.cuartel_id,
  c.nombre AS cuartel,
  EXTRACT(YEAR  FROM s.fecha)::INTEGER AS anio,
  EXTRACT(MONTH FROM s.fecha)::INTEGER AS mes,
  COUNT(t.id) FILTER (WHERE t.tipo = 'visita_hito')       AS hitos_visitados,
  COUNT(t.id) FILTER (WHERE t.tipo = 'fiscalizacion_pnh') AS pnh_fiscalizados,
  COUNT(t.id) FILTER (WHERE t.tipo = 'visita_sie')        AS sie_visitados,
  COUNT(t.id) FILTER (WHERE t.tipo = 'coordinacion')      AS coordinaciones,
  -- DFP-04 ponderación
  COALESCE(SUM(CASE t.nivel_coordinacion
    WHEN 'alto' THEN 3 WHEN 'medio' THEN 2 ELSE 1
  END) FILTER (WHERE t.tipo = 'coordinacion'), 0) AS score_coordinacion,
  COUNT(h.id) AS hallazgos_registrados
FROM tareas t
JOIN servicios s ON s.id = t.servicio_id
JOIN cuarteles c ON c.id = t.cuartel_id
LEFT JOIN hallazgos h ON h.tarea_id = t.id
WHERE s.estado = 'enviado' AND t.categoria = 'territorial'
GROUP BY t.cuartel_id, c.nombre, anio, mes;

-- ============================================================
-- FUNCIÓN: CALCULAR FVC
-- ============================================================
CREATE OR REPLACE FUNCTION calcular_fvc(
  p_punto_id UUID,
  p_anio INTEGER,
  p_mes INTEGER
) RETURNS TABLE (
  puntaje NUMERIC, fvc TEXT, visitas_requeridas INTEGER,
  score_actividad NUMERIC, score_inteligencia NUMERIC,
  score_estacionalidad NUMERIC, score_valor_estrategico NUMERIC
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
BEGIN
  SELECT * INTO v_punto FROM puntos_territoriales WHERE id = p_punto_id;

  v_score_val := CASE v_punto.valor_estrategico
    WHEN 'critico'   THEN 100 WHEN 'alto'   THEN 75
    WHEN 'medio'     THEN 50  WHEN 'bajo'   THEN 25
    WHEN 'simbolico' THEN 10  ELSE 50 END;

  v_mes_key   := p_mes::TEXT;
  v_score_est := CASE (v_punto.estacionalidad->>v_mes_key)
    WHEN 'alto' THEN 100 WHEN 'medio' THEN 50 WHEN 'bajo' THEN 10 ELSE 50 END;

  v_fecha_inicio := make_date(p_anio, p_mes, 1) - INTERVAL '90 days';
  v_fecha_fin    := make_date(p_anio, p_mes, 1);

  SELECT COALESCE(LEAST(
    (SELECT SUM(CASE e.tipo WHEN 'arma' THEN 10 WHEN 'droga' THEN 10
                WHEN 'vehiculo' THEN 7 WHEN 'dinero' THEN 6 ELSE 3 END)
     FROM hallazgos h
     JOIN tareas t ON t.id = h.tarea_id
     JOIN servicios s ON s.id = t.servicio_id
     LEFT JOIN resultados r ON r.tarea_id = t.id
     LEFT JOIN especies e ON e.resultado_id = r.id
     WHERE h.punto_id = p_punto_id AND s.fecha BETWEEN v_fecha_inicio AND v_fecha_fin) * 10,
    100), 0) INTO v_score_act;

  SELECT cp.score_inteligencia INTO v_score_int
  FROM csf_puntos cp
  JOIN csf cf ON cf.id = cp.csf_id
  WHERE cp.punto_id = p_punto_id AND cf.cuartel_id = v_punto.cuartel_id
    AND cf.fecha_vigencia_fin >= make_date(p_anio, p_mes, 1)
  ORDER BY cf.fecha_emision DESC LIMIT 1;

  IF v_score_int IS NULL THEN v_score_int := 20; END IF;

  v_total := (v_score_act*0.40)+(v_score_int*0.30)+(v_score_est*0.20)+(v_score_val*0.10);

  v_fvc := CASE
    WHEN v_total >= 80 THEN '2x_semana'
    WHEN v_total >= 60 THEN '1x_semana'
    WHEN v_total >= 40 THEN '1x_15dias'
    WHEN v_total >= 20 THEN '1x_mes'
    ELSE '1x_bimestral' END;

  v_visitas := CASE v_fvc
    WHEN '2x_semana' THEN 8 WHEN '1x_semana' THEN 4
    WHEN '1x_15dias' THEN 2 ELSE 1 END;

  RETURN QUERY SELECT v_total, v_fvc, v_visitas,
    v_score_act, v_score_int, v_score_est, v_score_val;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCIÓN: CALCULAR IDFI COMPLETO (SERVER-SIDE)
-- Usado opcionalmente para auditoría desde Supabase
-- El cálculo principal se realiza en el cliente (core.js)
-- ============================================================
CREATE OR REPLACE FUNCTION calcular_idfi(
  p_cuartel_id UUID,
  p_fecha_inicio DATE,
  p_fecha_fin DATE
) RETURNS TABLE (
  dfp01 NUMERIC, dfp02 NUMERIC, dfp03 NUMERIC, dfp04 NUMERIC, dfp05 NUMERIC, dfp_ponderado NUMERIC,
  dfo01 NUMERIC, dfo02 NUMERIC, dfo03 NUMERIC, dfo04 NUMERIC, dfo05 NUMERIC, dfo06 NUMERIC,
  dfo_ponderado NUMERIC, idfi NUMERIC, nivel TEXT
) AS $$
DECLARE
  -- Puntos asignados
  v_hitos_asig INTEGER; v_pnh_asig INTEGER; v_sie_asig INTEGER;
  -- DFP
  v_hitos_vis INTEGER; v_pnh_fisc INTEGER; v_sie_vis INTEGER;
  v_coord_score NUMERIC; v_hall INTEGER;
  -- DFO
  v_total_ctrl INTEGER; v_con_res INTEGER;
  v_docs_falsos INTEGER; v_inf_mig INTEGER; v_det_irr INTEGER;
  v_total_proc INTEGER; v_ct INTEGER;
  v_valor_uf NUMERIC; v_obj_int INTEGER;
  -- Resultados
  r_dfp01 NUMERIC; r_dfp02 NUMERIC; r_dfp03 NUMERIC; r_dfp04 NUMERIC; r_dfp05 NUMERIC;
  r_dfp NUMERIC;
  r_dfo01 NUMERIC; r_dfo02 NUMERIC; r_dfo03 NUMERIC; r_dfo04 NUMERIC;
  r_dfo05 NUMERIC; r_dfo06 NUMERIC; r_dfo NUMERIC;
  r_idfi NUMERIC; r_nivel TEXT;
  -- Metas (pueden ajustarse desde cuarteles)
  v_meta_hitos INTEGER; v_meta_pnh INTEGER; v_meta_sie INTEGER;
  v_meta_coord NUMERIC := 12; v_meta_hall INTEGER := 4; v_meta_uf NUMERIC := 500;
BEGIN
  SELECT total_hitos, total_pnh, total_sie, meta_hallazgos_mes, meta_uf_periodo
  INTO v_meta_hitos, v_meta_pnh, v_meta_sie, v_meta_hall, v_meta_uf
  FROM cuarteles WHERE id = p_cuartel_id;

  v_meta_hitos := GREATEST(COALESCE(v_meta_hitos, 5), 1);
  v_meta_pnh   := GREATEST(COALESCE(v_meta_pnh,   3), 1);
  v_meta_sie   := GREATEST(COALESCE(v_meta_sie,   2), 1);
  v_meta_hall  := GREATEST(COALESCE(v_meta_hall,  4), 1);
  v_meta_uf    := GREATEST(COALESCE(v_meta_uf, 500),  1);

  -- DFP-01 Hitos
  SELECT COUNT(DISTINCT t.punto_id) INTO v_hitos_vis
  FROM tareas t JOIN servicios s ON s.id = t.servicio_id
  WHERE s.cuartel_id = p_cuartel_id AND s.estado = 'enviado'
    AND t.tipo = 'visita_hito' AND s.fecha BETWEEN p_fecha_inicio AND p_fecha_fin;
  r_dfp01 := LEAST((COALESCE(v_hitos_vis,0)::NUMERIC / v_meta_hitos) * 100, 100);

  -- DFP-02 PNH
  SELECT COUNT(DISTINCT t.punto_id) INTO v_pnh_fisc
  FROM tareas t JOIN servicios s ON s.id = t.servicio_id
  WHERE s.cuartel_id = p_cuartel_id AND s.estado = 'enviado'
    AND t.tipo = 'fiscalizacion_pnh' AND s.fecha BETWEEN p_fecha_inicio AND p_fecha_fin;
  r_dfp02 := LEAST((COALESCE(v_pnh_fisc,0)::NUMERIC / v_meta_pnh) * 100, 100);

  -- DFP-03 SIE
  SELECT COUNT(DISTINCT t.punto_id) INTO v_sie_vis
  FROM tareas t JOIN servicios s ON s.id = t.servicio_id
  WHERE s.cuartel_id = p_cuartel_id AND s.estado = 'enviado'
    AND t.tipo = 'visita_sie' AND s.fecha BETWEEN p_fecha_inicio AND p_fecha_fin;
  r_dfp03 := LEAST((COALESCE(v_sie_vis,0)::NUMERIC / v_meta_sie) * 100, 100);

  -- DFP-04 Coordinaciones ponderadas
  SELECT COALESCE(SUM(CASE nivel_coordinacion WHEN 'alto' THEN 3 WHEN 'medio' THEN 2 ELSE 1 END), 0)
  INTO v_coord_score
  FROM tareas t JOIN servicios s ON s.id = t.servicio_id
  WHERE s.cuartel_id = p_cuartel_id AND s.estado = 'enviado'
    AND t.tipo = 'coordinacion' AND s.fecha BETWEEN p_fecha_inicio AND p_fecha_fin;
  r_dfp04 := LEAST((v_coord_score / v_meta_coord) * 100, 100);

  -- DFP-05 Hallazgos inteligencia
  SELECT COUNT(*) INTO v_hall
  FROM hallazgos h JOIN servicios s ON s.id = h.servicio_id
  WHERE h.cuartel_id = p_cuartel_id AND s.estado = 'enviado'
    AND s.fecha BETWEEN p_fecha_inicio AND p_fecha_fin;
  r_dfp05 := LEAST((COALESCE(v_hall,0)::NUMERIC / v_meta_hall) * 100, 100);

  -- DFP ponderado
  r_dfp := (r_dfp01*0.25)+(r_dfp02*0.30)+(r_dfp03*0.15)+(r_dfp04*0.15)+(r_dfp05*0.15);

  -- Total controles
  SELECT GREATEST(COALESCE(SUM(t.cantidad_vehiculos + t.cantidad_personas), 0), 1)
  INTO v_total_ctrl
  FROM tareas t JOIN servicios s ON s.id = t.servicio_id
  WHERE s.cuartel_id = p_cuartel_id AND s.estado = 'enviado'
    AND t.categoria = 'operativa' AND s.fecha BETWEEN p_fecha_inicio AND p_fecha_fin;

  SELECT GREATEST(COUNT(*), 1) INTO v_total_proc
  FROM resultados r JOIN servicios s ON s.id = r.servicio_id
  WHERE r.cuartel_id = p_cuartel_id AND s.estado = 'enviado'
    AND s.fecha BETWEEN p_fecha_inicio AND p_fecha_fin;

  -- DFO-01 Eficacia
  SELECT COUNT(*) INTO v_con_res
  FROM tareas t JOIN servicios s ON s.id = t.servicio_id
  WHERE s.cuartel_id = p_cuartel_id AND s.estado = 'enviado'
    AND t.tiene_resultado = TRUE AND s.fecha BETWEEN p_fecha_inicio AND p_fecha_fin;
  r_dfo01 := LEAST((COALESCE(v_con_res,0)::NUMERIC / v_total_ctrl) * 100, 100);

  -- DFO-02 Docs falsificados
  SELECT COUNT(*) INTO v_docs_falsos
  FROM resultados r JOIN servicios s ON s.id = r.servicio_id
  WHERE r.cuartel_id = p_cuartel_id AND s.estado = 'enviado'
    AND r.tipo_resultado = 'documento_falsificado'
    AND s.fecha BETWEEN p_fecha_inicio AND p_fecha_fin;
  r_dfo02 := LEAST((COALESCE(v_docs_falsos,0)::NUMERIC / v_total_ctrl) * 100, 100);

  -- DFO-03 Control migratorio
  SELECT COUNT(*) INTO v_inf_mig
  FROM resultados r JOIN servicios s ON s.id = r.servicio_id
  WHERE r.cuartel_id = p_cuartel_id AND s.estado = 'enviado'
    AND r.tipo_resultado = 'infraccion_migratoria'
    AND s.fecha BETWEEN p_fecha_inicio AND p_fecha_fin;
  SELECT COUNT(*) INTO v_det_irr
  FROM detenidos d JOIN servicios s ON s.id = d.servicio_id
  WHERE d.cuartel_id = p_cuartel_id AND s.estado = 'enviado'
    AND d.situacion_migratoria = 'irregular'
    AND s.fecha BETWEEN p_fecha_inicio AND p_fecha_fin;
  r_dfo03 := LEAST(((COALESCE(v_inf_mig,0) + COALESCE(v_det_irr,0))::NUMERIC / v_total_ctrl) * 100, 100);

  -- DFO-04 Interdicción CT
  SELECT COUNT(*) INTO v_ct
  FROM resultados r JOIN servicios s ON s.id = r.servicio_id
  WHERE r.cuartel_id = p_cuartel_id AND s.estado = 'enviado'
    AND r.tipo_delito IN ('trafico_drogas','trafico_migrantes','trata_personas',
      'contrabando','armas','falsificacion','abigeato','receptacion','cohecho')
    AND s.fecha BETWEEN p_fecha_inicio AND p_fecha_fin;
  r_dfo04 := LEAST((COALESCE(v_ct,0)::NUMERIC / v_total_proc) * 100, 100);

  -- DFO-05 Impacto UF
  SELECT COALESCE(SUM(r.valor_total_uf), 0) INTO v_valor_uf
  FROM resultados r JOIN servicios s ON s.id = r.servicio_id
  WHERE r.cuartel_id = p_cuartel_id AND s.estado = 'enviado'
    AND s.fecha BETWEEN p_fecha_inicio AND p_fecha_fin;
  r_dfo05 := LEAST((v_valor_uf / v_meta_uf) * 100, 100);

  -- DFO-06 Objetivos internacionales
  SELECT COUNT(*) INTO v_obj_int
  FROM detenidos d JOIN servicios s ON s.id = d.servicio_id
  WHERE d.cuartel_id = p_cuartel_id AND s.estado = 'enviado'
    AND d.tiene_alerta_internacional = TRUE
    AND s.fecha BETWEEN p_fecha_inicio AND p_fecha_fin;
  r_dfo06 := LEAST((COALESCE(v_obj_int,0)::NUMERIC / 1) * 100, 100);

  -- DFO ponderado
  r_dfo := (r_dfo01*0.15)+(r_dfo02*0.10)+(r_dfo03*0.15)+
            (r_dfo04*0.30)+(r_dfo05*0.15)+(r_dfo06*0.15);

  -- IDFI
  r_idfi := (r_dfp*0.40)+(r_dfo*0.60);
  r_nivel := CASE WHEN r_idfi>=90 THEN 'ÓPTIMO' WHEN r_idfi>=70 THEN 'ADECUADO'
    WHEN r_idfi>=50 THEN 'DEFICIENTE' ELSE 'CRÍTICO' END;

  RETURN QUERY SELECT
    r_dfp01, r_dfp02, r_dfp03, r_dfp04, r_dfp05, r_dfp,
    r_dfo01, r_dfo02, r_dfo03, r_dfo04, r_dfo05, r_dfo06,
    r_dfo, r_idfi, r_nivel;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCIÓN: COMPARATIVA HISTÓRICA (DFO bruto + IDFI)
-- ============================================================
CREATE OR REPLACE FUNCTION comparativa_historica(
  p_cuartel_id UUID,
  p_anio INTEGER,
  p_mes_inicio INTEGER,
  p_mes_fin INTEGER
) RETURNS TABLE (
  detenciones_actual INTEGER, uf_actual NUMERIC,
  armas_actual INTEGER,       servicios_actual INTEGER,
  detenciones_hist INTEGER,   uf_hist NUMERIC,
  armas_hist INTEGER,         servicios_hist INTEGER,
  var_detenciones INTEGER,    var_uf NUMERIC,
  var_armas INTEGER,          var_servicios INTEGER,
  pct_detenciones NUMERIC,    pct_uf NUMERIC,
  -- IDFI comparativa
  idfi_actual NUMERIC,        idfi_hist NUMERIC,
  dfp_actual NUMERIC,         dfp_hist NUMERIC,
  dfo_actual NUMERIC,         dfo_hist NUMERIC
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
    WHERE s.cuartel_id = p_cuartel_id AND s.estado = 'enviado'
      AND EXTRACT(YEAR  FROM s.fecha) = p_anio
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
  ),
  idfi_act AS (
    SELECT AVG(hi.idfi) AS idfi, AVG(hi.dfp_total) AS dfp, AVG(hi.dfo_total) AS dfo
    FROM historial_idfi hi
    WHERE hi.cuartel_id = p_cuartel_id AND hi.anio = p_anio
      AND hi.mes BETWEEN p_mes_inicio AND p_mes_fin
  ),
  idfi_hist AS (
    SELECT AVG(hi.idfi) AS idfi, AVG(hi.dfp_total) AS dfp, AVG(hi.dfo_total) AS dfo
    FROM historial_idfi hi
    WHERE hi.cuartel_id = p_cuartel_id AND hi.anio = p_anio - 1
      AND hi.mes BETWEEN p_mes_inicio AND p_mes_fin
  )
  SELECT
    a.det, a.uf, a.arm, a.srv,
    h.det, h.uf, h.arm, h.srv,
    (a.det - h.det), (a.uf - h.uf), (a.arm - h.arm), (a.srv - h.srv),
    CASE WHEN h.det=0 THEN NULL ELSE ROUND(((a.det-h.det)::NUMERIC/h.det)*100,1) END,
    CASE WHEN h.uf =0 THEN NULL ELSE ROUND(((a.uf -h.uf )::NUMERIC/h.uf )*100,1) END,
    ia.idfi, ih.idfi,
    ia.dfp,  ih.dfp,
    ia.dfo,  ih.dfo
  FROM actual a, historico h, idfi_act ia, idfi_hist ih;
END;
$$ LANGUAGE plpgsql;
