-- ============================================================
-- SISCOF — ACTUALIZACIÓN SUPABASE
-- Paso 4: Nuevos campos requeridos por IDFI (Informe Téc. 01/2026)
-- Ejecutar SOLO si es sistema existente.
-- Si es instalación nueva, el 01_schema.sql ya los incluye.
-- ============================================================

-- ── 1. detenidos: alerta internacional (DFO-06) ──
ALTER TABLE detenidos
  ADD COLUMN IF NOT EXISTS tiene_alerta_internacional BOOLEAN DEFAULT FALSE;

-- ── 2. cuarteles: metas para normalización de indicadores ──
ALTER TABLE cuarteles
  ADD COLUMN IF NOT EXISTS total_hitos INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS total_pnh   INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS total_sie   INTEGER DEFAULT 2,
  ADD COLUMN IF NOT EXISTS meta_hallazgos_mes       INTEGER DEFAULT 4,
  ADD COLUMN IF NOT EXISTS meta_coordinaciones_mes  INTEGER DEFAULT 4,
  ADD COLUMN IF NOT EXISTS meta_uf_periodo          NUMERIC(12,2) DEFAULT 500,
  ADD COLUMN IF NOT EXISTS meta_objetivos_int       INTEGER DEFAULT 1;

-- ── 3. Actualizar totales reales por cuartel ──
-- (ejecutar después de verificar sus datos en puntos_territoriales)
UPDATE cuarteles c SET
  total_hitos = (SELECT COUNT(*) FROM puntos_territoriales WHERE cuartel_id = c.id AND tipo = 'hito' AND activo = TRUE),
  total_pnh   = (SELECT COUNT(*) FROM puntos_territoriales WHERE cuartel_id = c.id AND tipo = 'pnh'  AND activo = TRUE),
  total_sie   = (SELECT COUNT(*) FROM puntos_territoriales WHERE cuartel_id = c.id AND tipo = 'sie'  AND activo = TRUE);

-- ── 4. Nueva tabla historial_idfi (comparativa año anterior) ──
CREATE TABLE IF NOT EXISTS historial_idfi (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cuartel_id  UUID NOT NULL REFERENCES cuarteles(id),
  anio        INTEGER NOT NULL,
  mes         INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  -- Indicadores DFP
  dfp_01      NUMERIC(5,2) DEFAULT 0,   -- Hitos
  dfp_02      NUMERIC(5,2) DEFAULT 0,   -- PNH
  dfp_03      NUMERIC(5,2) DEFAULT 0,   -- SIE
  dfp_04      NUMERIC(5,2) DEFAULT 0,   -- Coordinación
  dfp_05      NUMERIC(5,2) DEFAULT 0,   -- Inteligencia
  dfp_total   NUMERIC(5,2) DEFAULT 0,
  -- Indicadores DFO
  dfo_01      NUMERIC(5,2) DEFAULT 0,   -- Eficacia controles
  dfo_02      NUMERIC(5,2) DEFAULT 0,   -- Docs falsificados
  dfo_03      NUMERIC(5,2) DEFAULT 0,   -- Control migratorio
  dfo_04      NUMERIC(5,2) DEFAULT 0,   -- Interdicción CT
  dfo_05      NUMERIC(5,2) DEFAULT 0,   -- Impacto UF
  dfo_06      NUMERIC(5,2) DEFAULT 0,   -- Obj. internacionales
  dfo_total   NUMERIC(5,2) DEFAULT 0,
  -- IDFI
  idfi        NUMERIC(5,2) DEFAULT 0,
  nivel       TEXT CHECK (nivel IN ('optimo','adecuado','deficiente','critico')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cuartel_id, anio, mes)
);
