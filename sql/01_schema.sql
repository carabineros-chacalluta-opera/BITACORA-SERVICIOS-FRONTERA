-- ============================================================
-- SISCOF - Sistema de Control Fronterizo
-- Prefectura Arica Nro. 1 - Carabineros de Chile
-- Schema completo Supabase
-- ============================================================

-- ── EXTENSIONES ──
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- CUARTELES
-- ============================================================
CREATE TABLE cuarteles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('comisaria','tenencia','reten')),
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- USUARIOS
-- ============================================================
CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  grado TEXT,
  rol TEXT NOT NULL CHECK (rol IN ('jefe_servicio','administrador','comisaria','prefectura')),
  cuartel_id UUID REFERENCES cuarteles(id),
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PERSONAL POR CUARTEL
-- ============================================================
CREATE TABLE personal (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cuartel_id UUID NOT NULL REFERENCES cuarteles(id),
  nombre_completo TEXT NOT NULL,
  grado TEXT NOT NULL,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- VEHÍCULOS POR CUARTEL
-- ============================================================
CREATE TABLE vehiculos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cuartel_id UUID NOT NULL REFERENCES cuarteles(id),
  patente TEXT NOT NULL,
  tipo TEXT,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PUNTOS TERRITORIALES (Hitos, PNH, SIE)
-- ============================================================
CREATE TABLE puntos_territoriales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cuartel_id UUID NOT NULL REFERENCES cuarteles(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('hito','pnh','sie')),
  nombre TEXT NOT NULL,
  pais TEXT CHECK (pais IN ('PERU','BOLIVIA','CHILE')),
  referencia_localizacion TEXT,
  tipo_sie TEXT, -- solo para SIE
  -- FVC configuración
  valor_estrategico TEXT CHECK (valor_estrategico IN ('critico','alto','medio','bajo','simbolico')) DEFAULT 'medio',
  -- Estacionalidad por mes [1..12]
  estacionalidad JSONB DEFAULT '{"1":"medio","2":"medio","3":"medio","4":"medio","5":"medio","6":"medio","7":"medio","8":"medio","9":"medio","10":"medio","11":"medio","12":"medio"}',
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FVC - FRECUENCIA DE VISITA CALCULADA
-- ============================================================
CREATE TABLE fvc_mensual (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  punto_id UUID NOT NULL REFERENCES puntos_territoriales(id),
  anio INTEGER NOT NULL,
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  -- Scores de cada variable (0-100)
  score_actividad NUMERIC(5,2) DEFAULT 0,
  score_inteligencia NUMERIC(5,2) DEFAULT 20,
  score_estacionalidad NUMERIC(5,2) DEFAULT 50,
  score_valor_estrategico NUMERIC(5,2) DEFAULT 50,
  -- Puntaje final y FVC resultante
  puntaje_total NUMERIC(5,2) DEFAULT 0,
  fvc_asignada TEXT CHECK (fvc_asignada IN ('2x_semana','1x_semana','1x_15dias','1x_mes','1x_bimestral')),
  visitas_requeridas INTEGER,
  -- Control
  aprobado_por UUID REFERENCES usuarios(id),
  aprobado_en TIMESTAMPTZ,
  ajuste_manual BOOLEAN DEFAULT FALSE,
  justificacion_ajuste TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(punto_id, anio, mes)
);

-- ============================================================
-- CSF - CARTA DE SITUACIÓN FRONTERIZA
-- ============================================================
CREATE TABLE csf (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cuartel_id UUID NOT NULL REFERENCES cuarteles(id),
  numero TEXT NOT NULL,
  fecha_emision DATE NOT NULL,
  fecha_vigencia_inicio DATE NOT NULL,
  fecha_vigencia_fin DATE NOT NULL,
  clasificacion TEXT DEFAULT 'RESERVADO',
  amenaza_principal TEXT,
  idea_fuerza TEXT,
  cargado_por UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Estado de inteligencia por punto en cada CSF
CREATE TABLE csf_puntos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  csf_id UUID NOT NULL REFERENCES csf(id),
  punto_id UUID NOT NULL REFERENCES puntos_territoriales(id),
  estado TEXT CHECK (estado IN ('amenaza_activa','zona_atencion','sin_novedad','descartado')) DEFAULT 'sin_novedad',
  observacion TEXT,
  score_inteligencia NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE estado
      WHEN 'amenaza_activa' THEN 100
      WHEN 'zona_atencion' THEN 60
      WHEN 'sin_novedad' THEN 20
      WHEN 'descartado' THEN 0
      ELSE 20
    END
  ) STORED
);

-- ============================================================
-- SERVICIOS DE SOBERANÍA
-- ============================================================
CREATE TABLE servicios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cuartel_id UUID NOT NULL REFERENCES cuarteles(id),
  personal_id UUID REFERENCES personal(id),
  nombre_jefe TEXT NOT NULL, -- backup textual
  fecha DATE NOT NULL,
  turno TEXT NOT NULL CHECK (turno IN ('manana','tarde','noche')),
  hora_inicio TIME NOT NULL,
  hora_termino TIME,
  vehiculo_id UUID REFERENCES vehiculos(id),
  patente_texto TEXT,
  km_inicio INTEGER,
  km_termino INTEGER,
  -- Calculados
  duracion_minutos INTEGER,
  minutos_operativos INTEGER,
  minutos_administrativos INTEGER,
  -- Estado
  estado TEXT DEFAULT 'borrador' CHECK (estado IN ('borrador','enviado','corregido')),
  obs_generales TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TAREAS DENTRO DE UN SERVICIO
-- ============================================================
CREATE TABLE tareas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  servicio_id UUID NOT NULL REFERENCES servicios(id) ON DELETE CASCADE,
  orden INTEGER NOT NULL, -- posición en la línea de tiempo
  categoria TEXT NOT NULL CHECK (categoria IN ('territorial','operativa','administrativa')),
  tipo TEXT NOT NULL,
  -- Para tareas territoriales
  punto_id UUID REFERENCES puntos_territoriales(id),
  -- Datos comunes
  hora_inicio TIME,
  hora_termino TIME,
  duracion_minutos INTEGER,
  tiene_hallazgo BOOLEAN DEFAULT FALSE,
  tiene_resultado BOOLEAN DEFAULT FALSE,
  observaciones TEXT,
  -- Para controles sin resultado
  cantidad_vehiculos INTEGER DEFAULT 0,
  cantidad_personas INTEGER DEFAULT 0,
  -- Para coordinaciones
  institucion TEXT,
  nivel_coordinacion TEXT CHECK (nivel_coordinacion IN ('alto','medio','bajo')),
  detalle_coordinacion TEXT,
  -- Para tareas administrativas
  motivo_administrativo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- HALLAZGOS DE INTELIGENCIA
-- ============================================================
CREATE TABLE hallazgos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tarea_id UUID NOT NULL REFERENCES tareas(id) ON DELETE CASCADE,
  servicio_id UUID NOT NULL REFERENCES servicios(id),
  cuartel_id UUID NOT NULL REFERENCES cuarteles(id),
  punto_id UUID REFERENCES puntos_territoriales(id),
  hora TIME,
  tipo_evidencia TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  nivel_relevancia TEXT DEFAULT 'medio' CHECK (nivel_relevancia IN ('alto','medio','bajo')),
  incorporado_csf BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RESULTADOS OPERATIVOS (PROCEDIMIENTOS)
-- ============================================================
CREATE TABLE resultados (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tarea_id UUID NOT NULL REFERENCES tareas(id) ON DELETE CASCADE,
  servicio_id UUID NOT NULL REFERENCES servicios(id),
  cuartel_id UUID NOT NULL REFERENCES cuarteles(id),
  tipo_resultado TEXT NOT NULL,
  -- Delito
  tipo_delito TEXT,
  modalidad TEXT,
  numero_parte TEXT,
  -- Controles con resultado
  controles_vehiculares INTEGER DEFAULT 0,
  controles_personas INTEGER DEFAULT 0,
  -- Valor total
  valor_total_uf NUMERIC(12,2) DEFAULT 0,
  -- Narrativa
  como_se_detecto TEXT,
  como_se_actuo TEXT,
  info_para_csf TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DETENIDOS
-- ============================================================
CREATE TABLE detenidos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resultado_id UUID NOT NULL REFERENCES resultados(id) ON DELETE CASCADE,
  servicio_id UUID NOT NULL REFERENCES servicios(id),
  cuartel_id UUID NOT NULL REFERENCES cuarteles(id),
  nacionalidad TEXT NOT NULL,
  edad INTEGER,
  sexo TEXT CHECK (sexo IN ('M','F','otro')),
  situacion_migratoria TEXT CHECK (situacion_migratoria IN ('regular','irregular','solicitante_refugio','no_aplica')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ESPECIES INCAUTADAS
-- ============================================================
CREATE TABLE especies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resultado_id UUID NOT NULL REFERENCES resultados(id) ON DELETE CASCADE,
  servicio_id UUID NOT NULL REFERENCES servicios(id),
  cuartel_id UUID NOT NULL REFERENCES cuarteles(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('droga','dinero','vehiculo','arma','mercaderia','otro')),
  -- Droga
  tipo_droga TEXT,
  cantidad_droga NUMERIC(10,3),
  unidad_droga TEXT,
  -- Dinero
  monto_dinero NUMERIC(15,2),
  moneda TEXT,
  -- Vehículo
  tipo_vehiculo TEXT,
  marca TEXT,
  modelo TEXT,
  patente TEXT,
  anio INTEGER,
  tenia_encargo BOOLEAN DEFAULT FALSE,
  -- Arma
  tipo_arma TEXT,
  cantidad_armas INTEGER,
  tiene_municion BOOLEAN DEFAULT FALSE,
  cantidad_municion INTEGER,
  numero_serie TEXT,
  -- Común
  descripcion TEXT,
  valor_uf NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- HISTORIAL 2025 (carga manual desde Excel)
-- ============================================================
CREATE TABLE historial_anual (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cuartel_id UUID NOT NULL REFERENCES cuarteles(id),
  anio INTEGER NOT NULL,
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  -- Resultados operativos
  detenciones_total INTEGER DEFAULT 0,
  det_trafico_drogas INTEGER DEFAULT 0,
  det_trafico_migrantes INTEGER DEFAULT 0,
  det_trata_personas INTEGER DEFAULT 0,
  det_contrabando INTEGER DEFAULT 0,
  det_armas INTEGER DEFAULT 0,
  det_falsificacion INTEGER DEFAULT 0,
  det_abigeato INTEGER DEFAULT 0,
  det_otro INTEGER DEFAULT 0,
  -- Nacionalidades
  det_bolivianos INTEGER DEFAULT 0,
  det_peruanos INTEGER DEFAULT 0,
  det_chilenos INTEGER DEFAULT 0,
  det_venezolanos INTEGER DEFAULT 0,
  det_colombianos INTEGER DEFAULT 0,
  det_otras_nac INTEGER DEFAULT 0,
  -- Incautaciones
  valor_uf_total NUMERIC(12,2) DEFAULT 0,
  armas_recuperadas INTEGER DEFAULT 0,
  -- Otros
  infracciones_migratorias INTEGER DEFAULT 0,
  docs_falsificados INTEGER DEFAULT 0,
  vehiculos_encargo INTEGER DEFAULT 0,
  servicios_desplegados INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cuartel_id, anio, mes)
);

-- ============================================================
-- DATOS MAESTROS - INSERCIÓN INICIAL
-- ============================================================

-- Cuarteles
INSERT INTO cuarteles (codigo, nombre, tipo) VALUES
  ('CHACALLUTA', '4ª Comisaría Chacalluta (F)', 'comisaria'),
  ('ALCERRECA',  'Retén Alcérreca (F)',           'reten'),
  ('TACORA',     'Retén Tacora (F)',               'reten'),
  ('VISVIRI',    'Tenencia Visviri (F)',            'tenencia'),
  ('CAQUENA',    'Retén Caquena (F)',               'reten'),
  ('CHUNGARA',   'Tenencia Chungará (F)',           'tenencia'),
  ('CHUCUYO',    'Retén Chucuyo (F)',               'reten'),
  ('GUALLATIRE', 'Retén Guallatire (F)',            'reten'),
  ('CHILCAYA',   'Retén Chilcaya (F)',              'reten');
