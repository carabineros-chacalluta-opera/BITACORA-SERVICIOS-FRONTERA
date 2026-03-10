// ============================================================
// SISCOF — CONFIGURACIÓN CENTRAL
// Prefectura Arica Nro. 1 · Carabineros de Chile
// ============================================================
// INSTRUCCIONES:
// Complete las credenciales de Supabase antes de subir a GitHub Pages.
// Obténgalas en: https://supabase.com → su proyecto → Settings → API
// ============================================================

const SISCOF_CONFIG = {

  // ── SUPABASE ─────────────────────────────────────────────
  SUPABASE_URL:      '',   // ← Pegue su Project URL aquí
  SUPABASE_ANON_KEY: '',   // ← Pegue su anon public key aquí

  // ── SISTEMA ──────────────────────────────────────────────
  NOMBRE_SISTEMA:    'SISCOF',
  NOMBRE_UNIDAD:     'Prefectura Arica Nro. 1',
  NOMBRE_INSTITUCION:'Carabineros de Chile',

  // ── ROLES ────────────────────────────────────────────────
  ROLES: {
    JEFE_SERVICIO: 'jefe_servicio',
    ADMINISTRADOR: 'administrador',
    COMISARIA:     'comisaria',
    PREFECTURA:    'prefectura',
  },

  // ── ALERTAS ──────────────────────────────────────────────
  HORAS_ALERTA_SIN_REGISTRO: 24,

  // ── FVC PESOS ────────────────────────────────────────────
  FVC_PESOS: {
    actividad:        0.40,
    inteligencia:     0.30,
    estacionalidad:   0.20,
    valor_estrategico:0.10,
  },

  // ── IDFI PESOS ───────────────────────────────────────────
  IDFI_PESOS: {
    dfp: 0.40,
    dfo: 0.60,
  },

  // ── UMBRALES IDFI ────────────────────────────────────────
  IDFI_NIVELES: {
    OPTIMO:    { min: 90, color: '#00ff88', label: 'ÓPTIMO'    },
    ADECUADO:  { min: 70, color: '#ffd600', label: 'ADECUADO'  },
    DEFICIENTE:{ min: 50, color: '#ff8c00', label: 'DEFICIENTE'},
    CRITICO:   { min: 0,  color: '#ff3b3b', label: 'CRÍTICO'   },
  },

}

// Validación al cargar
if (!SISCOF_CONFIG.SUPABASE_URL || !SISCOF_CONFIG.SUPABASE_ANON_KEY) {
  console.warn('[SISCOF] Credenciales de Supabase no configuradas. Edite js/config.js')
}
