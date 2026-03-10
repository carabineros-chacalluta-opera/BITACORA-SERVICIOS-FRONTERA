// ============================================================
// SISCOF — App shell + navegación
// Diseño institucional Carabineros de Chile
// ============================================================

let _filtro   = '28dias'
let _pantalla = 'dashboard'

function renderApp() {
  document.body.innerHTML = `

    <!-- ── NAVBAR ── -->
    <nav class="navbar">

      <!-- Logo / identidad -->
      <div class="navbar-logo">
        <span class="navbar-logo-nombre">SISCOF</span>
        <span class="navbar-logo-sub">${SISCOF_CONFIG.NOMBRE_UNIDAD}</span>
      </div>

      <!-- Navegación -->
      <div class="navbar-links">
        <button class="nav-btn active" id="nav-dashboard" onclick="navegar('dashboard')">
          ◈ &nbsp;Dashboard
        </button>
        ${APP.puedeRegistrar ? `
        <button class="nav-btn" id="nav-registro" onclick="navegar('registro')">
          ＋ &nbsp;Nuevo servicio
        </button>` : ''}
      </div>

      <!-- Usuario -->
      <div class="navbar-user">
        <div class="navbar-user-info">
          <span class="navbar-user-nombre">
            ${APP.perfil?.grado ? APP.perfil.grado + ' ' : ''}${APP.perfil?.nombre || ''}
          </span>
          <span class="navbar-user-cuartel">
            ${APP.cuartel?.nombre || APP.perfil?.rol || ''}
          </span>
        </div>
        <button class="btn-logout" onclick="logout()">Cerrar sesión</button>
      </div>

    </nav>

    <!-- ── PANTALLAS ── -->
    <div id="pantalla-dashboard"></div>
    <div id="pantalla-registro" style="display:none"></div>
  `

  navegar('dashboard')
}

async function navegar(pantalla) {
  _pantalla = pantalla

  // Actualizar estado activo en navbar
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'))
  const navBtn = el(`nav-${pantalla}`)
  if (navBtn) navBtn.classList.add('active')

  // Mostrar / ocultar pantallas
  el('pantalla-dashboard').style.display = pantalla === 'dashboard' ? '' : 'none'
  if (el('pantalla-registro'))
    el('pantalla-registro').style.display = pantalla === 'registro' ? '' : 'none'

  if (pantalla === 'dashboard') await renderDashboard()
  if (pantalla === 'registro')  await renderRegistro()
}
