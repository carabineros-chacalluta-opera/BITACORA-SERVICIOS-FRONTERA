-- ============================================================
-- SISCOF - Puntos Territoriales
-- Inserción de Hitos, PNH y SIE por cuartel
-- ============================================================

-- ── HITOS CHACALLUTA (1-30, Perú) ──
INSERT INTO puntos_territoriales (cuartel_id, tipo, nombre, pais, valor_estrategico)
SELECT c.id, 'hito', 'Hito ' || n, 'PERU', 'medio'
FROM cuarteles c, generate_series(1,30) n
WHERE c.codigo = 'CHACALLUTA';

-- ── HITOS ALCÉRRECA (31-47, Perú) ──
INSERT INTO puntos_territoriales (cuartel_id, tipo, nombre, pais, valor_estrategico)
SELECT c.id, 'hito', 'Hito ' || n, 'PERU', 'medio'
FROM cuarteles c, generate_series(31,47) n
WHERE c.codigo = 'ALCERRECA';

-- ── HITOS TACORA (48-68, Perú) ──
INSERT INTO puntos_territoriales (cuartel_id, tipo, nombre, pais, valor_estrategico)
SELECT c.id, 'hito', 'Hito ' || n, 'PERU', 'medio'
FROM cuarteles c, generate_series(48,68) n
WHERE c.codigo = 'TACORA';

UPDATE puntos_territoriales SET nombre = 'Hito 53-A'
WHERE nombre = 'Hito 53' AND cuartel_id = (SELECT id FROM cuarteles WHERE codigo = 'TACORA')
  AND ctid IN (
    SELECT ctid FROM puntos_territoriales
    WHERE nombre = 'Hito 53' AND cuartel_id = (SELECT id FROM cuarteles WHERE codigo = 'TACORA')
    LIMIT 1 OFFSET 1
  );

-- ── HITOS VISVIRI (69-80 Perú + Bolivia) ──
INSERT INTO puntos_territoriales (cuartel_id, tipo, nombre, pais, valor_estrategico)
SELECT c.id, 'hito', 'Hito ' || n, 'PERU', 'medio'
FROM cuarteles c, generate_series(69,80) n
WHERE c.codigo = 'VISVIRI';

INSERT INTO puntos_territoriales (cuartel_id, tipo, nombre, pais, valor_estrategico)
SELECT c.id, 'hito', nombre, 'BOLIVIA', 'medio'
FROM cuarteles c,
(VALUES
  ('S/N-V'), ('S/N-VI'), ('VI-1'), ('VI-2'), ('VI-3'), ('VI-4'),
  ('S/N-VII'), ('94-VIII'), ('S/N-IX'), ('IX-1'), ('S/N-X'),
  ('X-1'), ('X-2'), ('X-3'), ('S/N-XI'), ('93-XII'), ('92-XIII')
) AS t(nombre)
WHERE c.codigo = 'VISVIRI';

-- ── HITOS CAQUENA ──
INSERT INTO puntos_territoriales (cuartel_id, tipo, nombre, pais, valor_estrategico)
SELECT c.id, 'hito', nombre, 'BOLIVIA', 'medio'
FROM cuarteles c,
(VALUES ('91-XIV'), ('90-XV'), ('88-XVI')) AS t(nombre)
WHERE c.codigo = 'CAQUENA';

-- ── HITOS CHUNGARÁ ──
INSERT INTO puntos_territoriales (cuartel_id, tipo, nombre, pais, valor_estrategico)
SELECT c.id, 'hito', nombre, 'BOLIVIA', 'medio'
FROM cuarteles c,
(VALUES ('84-XVII'), ('82-XVIII')) AS t(nombre)
WHERE c.codigo = 'CHUNGARA';

-- ── HITOS GUALLATIRE ──
INSERT INTO puntos_territoriales (cuartel_id, tipo, nombre, pais, valor_estrategico)
SELECT c.id, 'hito', nombre, 'BOLIVIA', 'medio'
FROM cuarteles c,
(VALUES ('80-XIX'), ('79-S/N'), ('78-XX'), ('S/N-Guallatire-1'), ('S/N-Guallatire-2')) AS t(nombre)
WHERE c.codigo = 'GUALLATIRE';

-- ── HITOS CHILCAYA ──
INSERT INTO puntos_territoriales (cuartel_id, tipo, nombre, pais, valor_estrategico)
SELECT c.id, 'hito', nombre, 'BOLIVIA', 'medio'
FROM cuarteles c,
(VALUES
  ('S/N-Chilcaya-1'), ('S/N-Chilcaya-2'), ('S/N-XXI'),
  ('S/N-XXII'), ('S/N-XXIII'), ('S/N-XXIV')
) AS t(nombre)
WHERE c.codigo = 'CHILCAYA';

-- ============================================================
-- PNH - PASOS NO HABILITADOS
-- ============================================================

-- CHACALLUTA (coinciden con hitos 1-21 excepto 18)
INSERT INTO puntos_territoriales (cuartel_id, tipo, nombre, pais, valor_estrategico)
SELECT c.id, 'pnh', 'PNH ' || nombre, 'PERU', 'alto'
FROM cuarteles c,
(VALUES
  ('Hito 1'),('Hito 2'),('Hito 3'),('Hito 4'),('Hito 5'),
  ('Hito 6'),('Hito 7'),('Hito 8'),('Hito 9'),('Hito 10'),
  ('Hito 11'),('Hito 12'),('Hito 13'),('Hito 14'),('Hito 15'),
  ('Hito 16'),('Hito 17'),('Hito 19'),('Hito 20'),('Hito 21')
) AS t(nombre)
WHERE c.codigo = 'CHACALLUTA';

-- ALCÉRRECA
INSERT INTO puntos_territoriales (cuartel_id, tipo, nombre, pais, valor_estrategico)
SELECT c.id, 'pnh', nombre, 'PERU', 'alto'
FROM cuarteles c,
(VALUES ('PNH Huichicolla'), ('PNH Lampallares')) AS t(nombre)
WHERE c.codigo = 'ALCERRECA';

-- TACORA
INSERT INTO puntos_territoriales (cuartel_id, tipo, nombre, pais, valor_estrategico)
SELECT c.id, 'pnh', nombre, 'PERU', 'alto'
FROM cuarteles c,
(VALUES ('PNH Aguas Calientes'), ('PNH Laguna Blanca')) AS t(nombre)
WHERE c.codigo = 'TACORA';

-- VISVIRI
INSERT INTO puntos_territoriales (cuartel_id, tipo, nombre, pais, valor_estrategico)
SELECT c.id, 'pnh', nombre, pais::TEXT, 'alto'
FROM cuarteles c,
(VALUES
  ('PNH Hito 69',    'PERU'),
  ('PNH Hito 77',    'PERU'),
  ('Paso Piñuta',    'PERU'),
  ('Pista 4',        'PERU'),
  ('PNH Hito 80',    'PERU'),
  ('Paso Sica-Sica', 'BOLIVIA'),
  ('Paso Hito 93-XII','BOLIVIA'),
  ('Paso Guarichuto','BOLIVIA')
) AS t(nombre, pais)
WHERE c.codigo = 'VISVIRI';

-- CAQUENA
INSERT INTO puntos_territoriales (cuartel_id, tipo, nombre, pais, valor_estrategico)
SELECT c.id, 'pnh', nombre, 'BOLIVIA', 'alto'
FROM cuarteles c,
(VALUES ('Portezuelo Casiri'), ('Portezuelo de Achuta')) AS t(nombre)
WHERE c.codigo = 'CAQUENA';

-- CHUNGARÁ
INSERT INTO puntos_territoriales (cuartel_id, tipo, nombre, pais, valor_estrategico)
SELECT c.id, 'pnh', nombre, 'BOLIVIA', 'alto'
FROM cuarteles c,
(VALUES
  ('PNH Hito 84-XVII'),
  ('Costado CF Chungará'),
  ('PNH Hito XVIII')
) AS t(nombre)
WHERE c.codigo = 'CHUNGARA';

-- GUALLATIRE
INSERT INTO puntos_territoriales (cuartel_id, tipo, nombre, pais, valor_estrategico)
SELECT c.id, 'pnh', nombre, 'BOLIVIA', 'alto'
FROM cuarteles c,
(VALUES
  ('Portezuelo Japu Hito 80-XIX'),
  ('Portezuelo Macaya Hito 78-XX')
) AS t(nombre)
WHERE c.codigo = 'GUALLATIRE';

-- CHILCAYA
INSERT INTO puntos_territoriales (cuartel_id, tipo, nombre, pais, valor_estrategico)
SELECT c.id, 'pnh', nombre, 'BOLIVIA', 'alto'
FROM cuarteles c,
(VALUES
  ('Hito XXII Cotasi Paquisa'),
  ('Portezuelo Quilhuiri Hito XXIII'),
  ('Cerro Capitán Hito XXIV')
) AS t(nombre)
WHERE c.codigo = 'CHILCAYA';

-- ============================================================
-- SIE - SITIOS DE INTERÉS ESTRATÉGICO
-- ============================================================

-- CHACALLUTA
INSERT INTO puntos_territoriales (cuartel_id, tipo, nombre, tipo_sie, referencia_localizacion, pais, valor_estrategico)
SELECT c.id, 'sie', nombre, tipo_sie, ref, pais::TEXT, val
FROM cuarteles c,
(VALUES
  ('Complejo Fronterizo Chacalluta',         'COMPLEJO FRONTERIZO',  'LPI con Perú',                'PERU',  'critico'),
  ('Aeropuerto Chacalluta Internacional',    'AEROPUERTO',           'LPI con Perú',                'PERU',  'critico'),
  ('Estación FF.CC. Pampa Ossa',             'ESTACION FF.CC.',      'Km 93 Línea Férrea Ruta A-13','CHILE', 'alto'),
  ('Estación FF.CC. Puquio',                 'ESTACION FF.CC.',      'Km 113 Línea Férrea Ruta A-13','CHILE','alto'),
  ('Antena Entel',                           'ANTENA COMUNICACIONES','Ruta A-135 Km 45',            'CHILE', 'medio'),
  ('Estación Pampa Ossa FF.CC.',             'ESTACION FF.CC.',      'Ruta A-13',                   'CHILE', 'medio')
) AS t(nombre, tipo_sie, ref, pais, val)
WHERE c.codigo = 'CHACALLUTA';

-- ALCÉRRECA
INSERT INTO puntos_territoriales (cuartel_id, tipo, nombre, tipo_sie, referencia_localizacion, pais, valor_estrategico)
SELECT c.id, 'sie', nombre, tipo_sie, ref, 'PERU', val
FROM cuarteles c,
(VALUES
  ('Posta Rural Alcérreca',       'CENTRO SALUD',    'LPI con Perú', 'medio'),
  ('Cuartel Militar Jarcaña',     'RECINTO MILITAR', 'LPI con Perú', 'alto'),
  ('Oleoducto Sica-Sica',         'OLEODUCTO',       'LPI con Perú', 'critico'),
  ('Puente Quebrada Allane',      'PUENTE',          'LPI con Perú', 'alto')
) AS t(nombre, tipo_sie, ref, val)
WHERE c.codigo = 'ALCERRECA';

-- TACORA
INSERT INTO puntos_territoriales (cuartel_id, tipo, nombre, tipo_sie, referencia_localizacion, pais, valor_estrategico)
SELECT c.id, 'sie', nombre, tipo_sie, ref, 'PERU', val
FROM cuarteles c,
(VALUES
  ('Complejo Azufrero Abandonado', 'PLANTA AZUFRE',  'LPI con Perú', 'medio'),
  ('Laguna Blanca',                'LAGUNA / LAGO',  'LPI con Perú', 'bajo'),
  ('Villa Industrial',             'LOCALIDAD',      'LPI con Perú', 'medio'),
  ('Iglesia Poblado de Tacora',    'IGLESIA',        'LPI con Perú', 'bajo')
) AS t(nombre, tipo_sie, ref, val)
WHERE c.codigo = 'TACORA';

-- VISVIRI
INSERT INTO puntos_territoriales (cuartel_id, tipo, nombre, tipo_sie, referencia_localizacion, pais, valor_estrategico)
SELECT c.id, 'sie', nombre, tipo_sie, ref, pais::TEXT, val
FROM cuarteles c,
(VALUES
  ('Posta Rural Visviri',                'CENTRO SALUD',          'Poblado Visviri',         'CHILE',   'medio'),
  ('Complejo Fronterizo Visviri',        'COMPLEJO FRONTERIZO',   'Poblado Visviri',         'BOLIVIA', 'critico'),
  ('Estación Ferroviaria Arica-La Paz',  'ESTACION FF.CC.',       'Poblado Visviri',         'CHILE',   'alto'),
  ('Oleoducto Sica-Sica',               'OLEODUCTO',             'Frontera Chile-Bolivia',  'BOLIVIA', 'critico'),
  ('Municipalidad de General Lagos',     'SERVICIO MUNICIPAL',    'Poblado Visviri',         'CHILE',   'medio'),
  ('Registro Civil Visviri',             'SERVICIO PUBLICO',      'Poblado Visviri',         'CHILE',   'bajo'),
  ('Antena Mirador Telecomunicaciones',  'ANTENA COMUNICACIONES', 'Poblado Visviri',         'CHILE',   'alto'),
  ('Plaza Poblado Visviri',              'PLAZA',                 'Poblado Visviri',         'CHILE',   'bajo'),
  ('Escuela Internado de Visviri',       'EST. EDUCACIONAL',      'Poblado Visviri',         'CHILE',   'medio'),
  ('Escuela Poblado Chujlluta',          'EST. EDUCACIONAL',      'Poblado Chujlluta',       'CHILE',   'bajo'),
  ('Escuela Colpita',                    'EST. EDUCACIONAL',      'Poblado Colpita',         'CHILE',   'bajo'),
  ('Escuela Guacollo',                   'EST. EDUCACIONAL',      'Poblado Guacollo',        'CHILE',   'bajo'),
  ('Escuela Cosapilla',                  'EST. EDUCACIONAL',      'Poblado Cosapilla',       'CHILE',   'bajo')
) AS t(nombre, tipo_sie, ref, pais, val)
WHERE c.codigo = 'VISVIRI';

-- CHUNGARÁ
INSERT INTO puntos_territoriales (cuartel_id, tipo, nombre, tipo_sie, referencia_localizacion, pais, valor_estrategico)
SELECT c.id, 'sie', nombre, tipo_sie, ref, 'BOLIVIA', 'critico'
FROM cuarteles c,
(VALUES ('Complejo Fronterizo Chungará', 'COMPLEJO FRONTERIZO', 'LPI con Bolivia')) AS t(nombre, tipo_sie, ref)
WHERE c.codigo = 'CHUNGARA';

-- CHUCUYO
INSERT INTO puntos_territoriales (cuartel_id, tipo, nombre, tipo_sie, referencia_localizacion, pais, valor_estrategico)
SELECT c.id, 'sie', nombre, tipo_sie, ref, 'CHILE', val
FROM cuarteles c,
(VALUES
  ('Iglesia Parinacota',       'IGLESIA',           'Poblado de Parinacota',     'medio'),
  ('Laguna Cotacotani',        'LAGUNA / LAGO',     'Ruta 11-CH Km 171',         'bajo'),
  ('Mirador Los Payachata',    'ATRACTIVO TURISTICO','Ruta 11-CH Km 158.2',      'bajo'),
  ('Parque Nacional Lauca',    'PARQUE NACIONAL',   'LPI con Bolivia',           'alto')
) AS t(nombre, tipo_sie, ref, val)
WHERE c.codigo = 'CHUCUYO';

-- GUALLATIRE
INSERT INTO puntos_territoriales (cuartel_id, tipo, nombre, tipo_sie, referencia_localizacion, pais, valor_estrategico)
SELECT c.id, 'sie', nombre, tipo_sie, ref, 'BOLIVIA', val
FROM cuarteles c,
(VALUES
  ('Puente Río Lauca',                             'PUENTE',         'Ruta A-95 Km 123', 'alto'),
  ('Reserva Natural Las Vicuñas',                  'RESERVA NATURAL','Ruta A-235 Km 31', 'medio'),
  ('Iglesia de la Inmaculada Concepción Guallatire','IGLESIA',        'Ruta A-95 Km 137', 'bajo')
) AS t(nombre, tipo_sie, ref, val)
WHERE c.codigo = 'GUALLATIRE';

-- CHILCAYA
INSERT INTO puntos_territoriales (cuartel_id, tipo, nombre, tipo_sie, referencia_localizacion, pais, valor_estrategico)
SELECT c.id, 'sie', nombre, tipo_sie, ref, 'BOLIVIA', val
FROM cuarteles c,
(VALUES
  ('Salar de Surire',    'MONUMENTO NATURAL', 'LPI con Bolivia', 'alto'),
  ('Minera Quiborax',    'MINERA',            'LPI con Bolivia', 'alto'),
  ('Termas de Poyoquere','TERMAS',            'LPI con Bolivia', 'bajo')
) AS t(nombre, tipo_sie, ref, val)
WHERE c.codigo = 'CHILCAYA';

-- CAQUENA
INSERT INTO puntos_territoriales (cuartel_id, tipo, nombre, tipo_sie, referencia_localizacion, pais, valor_estrategico)
SELECT c.id, 'sie', nombre, tipo_sie, ref, 'BOLIVIA', val
FROM cuarteles c,
(VALUES
  ('Puente Caquena',   'PUENTE',              'LPI con Bolivia', 'alto'),
  ('Antena WOM',       'ANTENA COMUNICACIONES','LPI con Bolivia', 'medio'),
  ('Iglesia Caquena',  'IGLESIA',             'LPI con Bolivia', 'bajo'),
  ('Laguna Casiri',    'LAGUNA / LAGO',       'LPI con Bolivia', 'medio')
) AS t(nombre, tipo_sie, ref, val)
WHERE c.codigo = 'CAQUENA';
