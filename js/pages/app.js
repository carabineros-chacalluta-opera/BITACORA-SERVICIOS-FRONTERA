// ============================================================
// SISCOF — App shell + navegación
// ============================================================

let _filtro = '28dias'
let _pantalla = 'dashboard'

function renderApp() {
  document.body.innerHTML = `
    <!-- NAVBAR -->
    <nav class="navbar">
      <div class="navbar-logo">
        SISCOF
        <span>${SISCOF_CONFIG.NOMBRE_UNIDAD.toUpperCase()}</span>
      </div>
      <div class="navbar-links">
        <button class="nav-btn active" id="nav-dashboard" onclick="navegar('dashboard')">
          ◈ DASHBOARD
        </button>
        ${APP.puedeRegistrar ? `
        <button class="nav-btn" id="nav-registro" onclick="navegar('registro')">
          ⊕ NUEVO SERVICIO
        </button>` : ''}
      </div>
      <div class="navbar-user">
        <span class="navbar-user-nombre">${APP.perfil?.grado || ''} ${APP.perfil?.nombre || ''}</span>
        <span class="navbar-user-cuartel">${APP.cuartel?.nombre || APP.perfil?.rol || ''}</span>
        <button class="btn-logout" onclick="logout()">CERRAR SESIÓN</button>
      </div>
    </nav>

    <!-- PANTALLAS -->
    <div id="pantalla-dashboard"></div>
    <div id="pantalla-registro" style="display:none"></div>
  `

  navegar('dashboard')
}

async function navegar(pantalla) {
  _pantalla = pantalla

  // Actualizar navbar
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'))
  const navBtn = el(`nav-${pantalla}`)
  if (navBtn) navBtn.classList.add('active')

  // Mostrar/ocultar pantallas
  el('pantalla-dashboard').style.display = pantalla === 'dashboard' ? '' : 'none'
  if (el('pantalla-registro')) el('pantalla-registro').style.display = pantalla === 'registro' ? '' : 'none'

  if (pantalla === 'dashboard') await renderDashboard()
  if (pantalla === 'registro')  await renderRegistro()
}
