# SISCOF — Sistema de Control Fronterizo
### Prefectura Arica Nro. 1 · Carabineros de Chile

---

## TECNOLOGÍA

- **HTML + CSS + JavaScript puro** — sin frameworks, sin npm, sin build
- **Supabase** — base de datos PostgreSQL en la nube
- **GitHub Pages** — hosting gratuito, cero configuración

El sistema funciona directamente desde el navegador. No requiere instalar nada.

---

## ESTRUCTURA DE ARCHIVOS

```
siscof/
├── index.html                 ← Punto de entrada único
├── css/
│   └── siscof.css             ← Estilos globales
├── js/
│   ├── config.js              ← ⭐ AQUÍ VAN LAS CREDENCIALES
│   ├── core.js                ← Cliente Supabase + estado global
│   └── pages/
│       ├── login.js           ← Pantalla de acceso
│       ├── app.js             ← Navbar + routing
│       ├── dashboard.js       ← Dashboard con filtros y comparativas
│       └── registro.js        ← Wizard de registro de servicio
└── sql/
    ├── 01_schema.sql          ← Tablas de la base de datos
    ├── 02_datos_maestros.sql  ← Hitos, PNH y SIE precargados
    └── 03_vistas_funciones.sql← Cálculo IDFI y comparativas
```

---

## PASO 1 — CONFIGURAR LA BASE DE DATOS (SUPABASE)

### 1.1 Ejecutar los SQL

En su proyecto Supabase → **SQL Editor**, ejecute en orden:

1. `sql/01_schema.sql`
2. `sql/02_datos_maestros.sql`
3. `sql/03_vistas_funciones.sql`

### 1.2 Crear usuarios en Supabase Auth

**Authentication → Users → Invite user**

Cree un usuario por cada persona autorizada. Use sus emails institucionales.

### 1.3 Registrar usuarios en la tabla `usuarios`

```sql
INSERT INTO usuarios (email, nombre, grado, rol, cuartel_id)
VALUES (
  'apellido@carabineros.cl',
  'Nombre Apellido',
  'Teniente',
  'administrador',
  (SELECT id FROM cuarteles WHERE codigo = 'CHACALLUTA')
);
```

**Roles disponibles:**
| Rol | Acceso |
|---|---|
| `jefe_servicio` | Solo registrar servicios |
| `administrador` | Registrar + configurar cuartel |
| `comisaria`     | Ver todos los cuarteles |
| `prefectura`    | Ver todo consolidado |

**Códigos de cuarteles:**
| Código | Cuartel |
|---|---|
| `CHACALLUTA` | 4ª Comisaría Chacalluta (F) |
| `ALCERRECA`  | Retén Alcérreca (F) |
| `TACORA`     | Retén Tacora (F) |
| `VISVIRI`    | Tenencia Visviri (F) |
| `CAQUENA`    | Retén Caquena (F) |
| `CHUNGARA`   | Tenencia Chungará (F) |
| `CHUCUYO`    | Retén Chucuyo (F) |
| `GUALLATIRE` | Retén Guallatire (F) |
| `CHILCAYA`   | Retén Chilcaya (F) |

### 1.4 Registrar personal por cuartel

```sql
INSERT INTO personal (cuartel_id, nombre_completo, grado)
VALUES (
  (SELECT id FROM cuarteles WHERE codigo = 'CHACALLUTA'),
  'Juan Pérez González', 'Cabo 1°'
);
```

### 1.5 Registrar vehículos

```sql
INSERT INTO vehiculos (cuartel_id, patente, tipo)
VALUES (
  (SELECT id FROM cuarteles WHERE codigo = 'CHACALLUTA'),
  'AP-2889', 'Camioneta 4x4'
);
```

### 1.6 Cargar historial 2025

```sql
INSERT INTO historial_anual
  (cuartel_id, anio, mes, detenciones_total, valor_uf_total,
   armas_recuperadas, servicios_desplegados)
VALUES (
  (SELECT id FROM cuarteles WHERE codigo = 'CHACALLUTA'),
  2025, 1,   -- año y mes
  3,         -- detenciones
  280.50,    -- UF incautadas
  0,         -- armas
  45         -- servicios desplegados
);
-- Repita por cada mes (1-12) y cada cuartel
```

---

## PASO 2 — CONFIGURAR LAS CREDENCIALES

Abra el archivo `js/config.js` y complete los dos campos:

```javascript
const SISCOF_CONFIG = {
  SUPABASE_URL:      'https://iblzxodbotmdnpzcgdey.supabase.co',
  SUPABASE_ANON_KEY: 'eyJ...',   // ← Su clave anon public
  // ...
}
```

Obtenga estos valores en:
**Supabase → su proyecto → Settings → API**

---

## PASO 3 — PUBLICAR EN GITHUB PAGES

### 3.1 Crear repositorio privado en GitHub

1. GitHub → **New repository**
2. Nombre: `siscof`
3. Seleccione **Private**
4. Haga clic en **Create repository**

### 3.2 Subir los archivos

**Opción A — Interfaz web de GitHub (más simple):**
1. Arrastre todos los archivos al repositorio en GitHub
2. Haga clic en **Commit changes**

**Opción B — Git por línea de comandos:**
```bash
git init
git add .
git commit -m "SISCOF - version inicial"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/siscof.git
git push -u origin main
```

### 3.3 Activar GitHub Pages

1. En el repositorio → **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: **main** / Folder: **/ (root)**
4. Haga clic en **Save**

GitHub le asignará una URL del tipo:
`https://TU_USUARIO.github.io/siscof/`

> ⚠️ GitHub Pages publica el código aunque el repo sea privado.
> Las credenciales de Supabase estarán visibles en `js/config.js`.
> Para mayor seguridad, restrinja los dominios autorizados en:
> **Supabase → Authentication → URL Configuration → Allowed Origins**
> Agregue: `https://TU_USUARIO.github.io`

---

## ACCESO AL SISTEMA

Una vez desplegado, los usuarios acceden con:
- **URL:** `https://TU_USUARIO.github.io/siscof/`
- **Email:** el registrado en Supabase Auth
- **Contraseña:** la definida al crear el usuario

---

## MANTENIMIENTO

### Agregar nuevo funcionario
```sql
INSERT INTO personal (cuartel_id, nombre_completo, grado)
VALUES ((SELECT id FROM cuarteles WHERE codigo = 'TACORA'), 'Nombre', 'Sargento');
```

### Activar/desactivar un punto territorial
```sql
UPDATE puntos_territoriales SET activo = FALSE
WHERE nombre = 'Hito 15' AND cuartel_id = (SELECT id FROM cuarteles WHERE codigo = 'CHACALLUTA');
```

### Consultar IDFI de un cuartel
```sql
SELECT * FROM calcular_idfi(
  (SELECT id FROM cuarteles WHERE codigo = 'VISVIRI'),
  '2026-01-01'::DATE, CURRENT_DATE
);
```

### Consultar comparativa histórica
```sql
SELECT * FROM comparativa_historica(
  (SELECT id FROM cuarteles WHERE codigo = 'CHACALLUTA'),
  2026, 1, 3  -- año, mes_inicio, mes_fin
);
```

---

*Sistema desarrollado para la Prefectura Arica Nro. 1 · Carabineros de Chile*
*Basado en el Informe Técnico Nro. 01/2026 · 4ª Comisaría Chacalluta (F)*
