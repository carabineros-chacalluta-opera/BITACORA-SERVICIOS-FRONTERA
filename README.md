# SISCOF — Sistema de Control Fronterizo
**Prefectura Arica Nro. 1 · 4ª Comisaría Chacalluta (F) · Carabineros de Chile**

---

## Estructura de archivos

```
siscof/
├── index.html
├── css/
│   └── siscof.css
├── js/
│   ├── config.js
│   ├── core.js
│   └── pages/
│       ├── login.js
│       ├── app.js
│       ├── dashboard.js
│       └── registro.js
├── sql/
│   ├── 01_schema.sql           ← Schema completo (instalación nueva)
│   ├── 02_datos_maestros.sql   ← Hitos, PNH, SIE por cuartel
│   ├── 03_vistas_funciones.sql ← Vistas, RLS y funciones PostgreSQL
│   └── 04_actualizacion_idfi.sql ← SOLO si ya tiene el sistema instalado
├── img/
│   └── escudo-carabineros.png
└── README.md
```

---

## PASOS DE ACTUALIZACIÓN EN SUPABASE

### ▶ Escenario A — Sistema ya instalado (actualización)

Acceder a: **Supabase → SQL Editor** y ejecutar los siguientes scripts en orden.

---

### PASO 1 — Nuevos campos en tablas existentes

Ejecutar **`sql/04_actualizacion_idfi.sql`** completo.

Esto agrega:
- `detenidos.tiene_alerta_internacional` → campo booleano para **DFO-06**
- `cuarteles.total_hitos / total_pnh / total_sie` → denominadores para DFP-01, 02, 03
- `cuarteles.meta_hallazgos_mes` → meta para **DFP-05**
- `cuarteles.meta_coordinaciones_mes` → meta para **DFP-04**
- `cuarteles.meta_uf_periodo` → meta para **DFO-05**
- `cuarteles.meta_objetivos_int` → meta para **DFO-06**
- **Nueva tabla `historial_idfi`** → comparativa IDFI año anterior

---

### PASO 2 — Actualizar vistas y funciones

Ejecutar **`sql/03_vistas_funciones.sql`** completo.

Esto actualiza:
- `v_resultados_mensual` → incluye `objetivos_internacionales`
- `v_cobertura_mensual` → incluye `score_coordinacion` ponderado
- `calcular_idfi()` → función server-side con los 11 indicadores
- `comparativa_historica()` → ahora incluye comparativa IDFI

> **Nota:** Si aparece error `policy already exists`, ignorar y continuar.

---

### PASO 3 — Verificar totales de puntos por cuartel

Ejecutar en SQL Editor:

```sql
SELECT codigo, nombre, total_hitos, total_pnh, total_sie
FROM cuarteles ORDER BY tipo, nombre;
```

Si los valores son 0 (sistema recién actualizado), ejecutar:

```sql
UPDATE cuarteles c SET
  total_hitos = (SELECT COUNT(*) FROM puntos_territoriales
                 WHERE cuartel_id = c.id AND tipo = 'hito' AND activo = TRUE),
  total_pnh   = (SELECT COUNT(*) FROM puntos_territoriales
                 WHERE cuartel_id = c.id AND tipo = 'pnh'  AND activo = TRUE),
  total_sie   = (SELECT COUNT(*) FROM puntos_territoriales
                 WHERE cuartel_id = c.id AND tipo = 'sie'  AND activo = TRUE);
```

---

### PASO 4 — Carga del historial IDFI año 2025

Para que aparezca la comparativa "vs año anterior" en el dashboard,
hay que cargar los datos de 2025. Hay dos formas:

**Opción A — Desde el sistema (recomendada)**

Una vez que el sistema esté funcionando con datos reales:
1. Ingresar con usuario Administrador
2. Ir al menú **Administración**
3. Seleccionar mes y año ya transcurrido
4. Presionar **"Guardar IDFI del mes en historial"**
5. Repetir para cada mes de 2025

**Opción B — Carga manual con datos aproximados**

Si dispone de estadísticas de 2025, puede cargarlos directamente:

```sql
-- Ejemplo: enero 2025 para Chacalluta
-- Ajuste los valores según sus registros físicos
INSERT INTO historial_idfi
  (cuartel_id, anio, mes, dfp_total, dfo_total, idfi, nivel)
VALUES (
  (SELECT id FROM cuarteles WHERE codigo = 'CHACALLUTA'),
  2025, 1,
  70.0,     -- DFP estimado enero 2025
  65.0,     -- DFO estimado enero 2025
  67.0,     -- IDFI = (70×0.40) + (65×0.60)
  'adecuado'
)
ON CONFLICT (cuartel_id, anio, mes) DO UPDATE
  SET dfp_total = EXCLUDED.dfp_total,
      dfo_total = EXCLUDED.dfo_total,
      idfi      = EXCLUDED.idfi,
      nivel     = EXCLUDED.nivel;
```

> Mientras no haya datos en `historial_idfi`, el dashboard muestra
> "Sin dato año anterior" sin romper nada.

---

### ▶ Escenario B — Instalación nueva

Ejecutar en este orden exacto:

1. `sql/01_schema.sql` — crea todas las tablas
2. `sql/02_datos_maestros.sql` — inserta hitos, PNH y SIE
3. `sql/03_vistas_funciones.sql` — crea vistas, funciones y RLS
4. Luego el Paso 3 de actualización de totales (arriba)

---

## Configuración

Editar **`js/config.js`**:

```js
SUPABASE_URL:      'https://XXXX.supabase.co',
SUPABASE_ANON_KEY: 'eyJ...',
```

Las metas para normalizar indicadores también están en `config.js`:

```js
META_UF_PERIODO:            500,   // UF — normaliza DFO-05
META_HALLAZGOS_MES:         4,     // reportes — normaliza DFP-05
META_COORDINACIONES_MES:    4,     // coordinaciones por mes
META_OBJETIVOS_INT_PERIODO: 1,     // DFO-06 objetivo mínimo
```

---

## Indicadores implementados (Informe Técnico Nro. 01/2026)

| ID | Nombre | Peso | Estado |
|---|---|---|---|
| DFP-01 | Hitos Fronterizos | 25% | ✅ |
| DFP-02 | PNH Fiscalizados | 30% | ✅ |
| DFP-03 | SIE Visitados | 15% | ✅ |
| DFP-04 | Coordinación Internacional (ponderada) | 15% | ✅ |
| DFP-05 | Producción de Inteligencia | 15% | ✅ |
| DFO-01 | Eficacia de Controles | 15% | ✅ |
| DFO-02 | Documentación Falsificada | 10% | ✅ |
| DFO-03 | Control Migratorio | 15% | ✅ |
| DFO-04 | Interdicción CT | 30% | ✅ |
| DFO-05 | Impacto Económico UF | 15% | ✅ |
| DFO-06 | Objetivos Internacionales | 15% | ✅ |
| **IDFI** | DFP×0.40 + DFO×0.60 | — | ✅ |

**Comparativa histórica:** disponible para todos los indicadores vs mismo período año anterior.

---

## Despliegue en GitHub Pages

```
git add .
git commit -m "SISCOF v2 — IDFI completo + comparativa histórica"
git push origin main
```

Activar GitHub Pages en: **Settings → Pages → Branch: main / root**

---

*Carabineros de Chile · Prefectura Arica Nro. 1*
*Informe Técnico Nro. 01/2026 — Ten. Damian H. Vergara Cortez*
