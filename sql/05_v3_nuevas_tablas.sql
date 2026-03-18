-- ============================================================
-- SISCOF v3 — Nuevas tablas y columnas
-- Ejecutar DESPUÉS de 04_actualizacion_idfi.sql
-- ============================================================

-- ── 1. Tabla alertas_criticas (cohecho + IDFI crítico) ──────
CREATE TABLE IF NOT EXISTS alertas_criticas (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cuartel_id  UUID NOT NULL REFERENCES cuarteles(id),
  usuario_id  UUID REFERENCES usuarios(id),
  tipo        TEXT NOT NULL CHECK (tipo IN ('cohecho','idfi_critico','otro')),
  detalle     TEXT,
  fecha       DATE NOT NULL DEFAULT CURRENT_DATE,
  revisada    BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. Columnas M5 en servicios ─────────────────────────────
ALTER TABLE servicios
  ADD COLUMN IF NOT EXISTS tiene_mision_ffaa BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS unidad_ffaa       TEXT;

-- ── 3. Tipo resultado bien_cot_sin_detenido ─────────────────
-- Actualizar el CHECK constraint de resultados para incluir R7
-- Nota: PostgreSQL no soporta ADD CONSTRAINT IF NOT EXISTS directamente
-- Si da error "constraint already exists", ignorar.
ALTER TABLE resultados DROP CONSTRAINT IF EXISTS resultados_tipo_resultado_check;
ALTER TABLE resultados ADD CONSTRAINT resultados_tipo_resultado_check
  CHECK (tipo_resultado IN (
    'detencion','infraccion_migratoria','documento_falsificado',
    'vehiculo_encargo','incautacion_sin_detenido',
    'bien_cot_sin_detenido',
    'objetivo_internacional','otro'
  ));

-- ── 4. RLS para alertas_criticas ────────────────────────────
ALTER TABLE alertas_criticas ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "auth_read"   ON alertas_criticas
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "auth_insert" ON alertas_criticas
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "auth_update" ON alertas_criticas
  FOR UPDATE USING (auth.role() = 'authenticated');

-- ── 5. Índices para rendimiento ─────────────────────────────
CREATE INDEX IF NOT EXISTS idx_servicios_cuartel_fecha
  ON servicios(cuartel_id, fecha, estado);
CREATE INDEX IF NOT EXISTS idx_tareas_servicio
  ON tareas(servicio_id, tipo, categoria);
CREATE INDEX IF NOT EXISTS idx_resultados_servicio
  ON resultados(servicio_id, tipo_delito);
CREATE INDEX IF NOT EXISTS idx_detenidos_servicio
  ON detenidos(servicio_id);
CREATE INDEX IF NOT EXISTS idx_alertas_cuartel
  ON alertas_criticas(cuartel_id, fecha);

-- ── 6. Vista alertas activas ────────────────────────────────
CREATE OR REPLACE VIEW v_alertas_activas AS
SELECT
  a.id, a.tipo, a.detalle, a.fecha, a.revisada,
  c.nombre AS cuartel,
  u.nombre AS usuario
FROM alertas_criticas a
JOIN cuarteles c ON c.id = a.cuartel_id
LEFT JOIN usuarios u ON u.id = a.usuario_id
WHERE a.revisada = FALSE
ORDER BY a.fecha DESC, a.created_at DESC;

-- ── 7. Verificar instalación ────────────────────────────────
SELECT
  'alertas_criticas' AS tabla,
  COUNT(*) AS registros
FROM alertas_criticas
UNION ALL
SELECT 'servicios con M5', COUNT(*) FROM servicios WHERE tiene_mision_ffaa = TRUE;
