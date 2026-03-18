// ============================================================
// SISCOF v3 — Alert Engine
// Cohecho + IDFI crítico + modal institucional
// ============================================================

let _alertaCallback = null

function verificarCohecho(tareas) {
  return tareas.some(t =>
    t.resultado?.tipo_delito === 'cohecho' ||
    t.resultado?.tipo_resultado === 'cohecho'
  )
}

function mostrarModalAlerta(mensaje, onConfirm) {
  const modal = document.getElementById('modal-alerta')
  const msg   = document.getElementById('modal-alerta-msg')
  if (!modal || !msg) { onConfirm(true); return }
  msg.innerHTML = mensaje
  modal.style.display = 'flex'
  _alertaCallback = onConfirm
}

function cerrarModalAlerta(confirmado) {
  const modal = document.getElementById('modal-alerta')
  if (modal) modal.style.display = 'none'
  if (_alertaCallback) { _alertaCallback(confirmado); _alertaCallback = null }
}

async function registrarAlertaCritica(tipo, detalle, cuartelId) {
  if (!APP?.sb) return
  try {
    await APP.sb.from('alertas_criticas').insert({
      tipo,
      detalle,
      cuartel_id: cuartelId,
      usuario_id: APP.perfil?.id || null,
      fecha: new Date().toISOString().split('T')[0],
    })
  } catch(e) {
    console.warn('[SISCOF] No se pudo registrar alerta crítica:', e.message)
    // Encolar para sync si hay IndexedDB
    if (typeof encolarSync === 'function') {
      encolarSync('alertas_criticas', 'insert', {
        tipo, detalle, cuartel_id: cuartelId,
        usuario_id: APP.perfil?.id || null,
        fecha: new Date().toISOString().split('T')[0],
      })
    }
  }
}

function bannerCohecho(texto) {
  return `
    <div class="alerta-cohecho">
      <div class="alerta-cohecho-titulo">
        🚨 ALERTA INSTITUCIONAL — COHECHO DETECTADO
      </div>
      <div class="alerta-cohecho-sub">${texto}</div>
    </div>`
}
