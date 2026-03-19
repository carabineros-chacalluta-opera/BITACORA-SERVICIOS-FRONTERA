// ============================================================
// SISCOF v3 — app.js
// ACTUALIZACIÓN: menú CSF para admin, comisaria, prefectura
// ============================================================

let _pantalla = 'dashboard'

function renderApp() {
  document.body.innerHTML = `
    <nav class="navbar">
      <div class="navbar-logo">
        <img src="img/escudo-carabineros.png" alt=""
          class="navbar-escudo" onerror="this.style.display='none'" />
        <div class="navbar-logo-txt">
          <span class="navbar-siscof">SISCOF</span>
          <span class="navbar-unidad">
            ${SISCOF_CONFIG.NOMBRE_UNIDAD.toUpperCase()}
          </span>
        </div>
      </div>

      <div class="navbar-links">
        <button class="nav-btn active" id="nav-dashboard"
          onclick="navegar('dashboard')">
          ◈ Dashboard
        </button>

        ${APP.puedeRegistrar ? `
        <button class="nav-btn" id="nav-registro"
          onclick="navegar('registro')">
          ⊕ Nuevo Servicio
        </button>` : ''}

        <button class="nav-btn" id="nav-historial"
          onclick="navegar('historial')">
          ≡ Historial
        </button>

        ${APP.esAdmin || APP.esComisaria ? `
        <button class="nav-btn" id="nav-maestras"
          onclick="navegar('maestras')">
          ◻ Puntos
        </button>` : ''}

        ${APP.esAdmin || APP.esComisaria || APP.esPrefectura ? `
        <button class="nav-btn" id="nav-csf"
          onclick="navegar('csf')"
          style="position:relative">
          📄 Cartas CSF
        </button>` : ''}

        ${APP.esAdmin ? `
        <button class="nav-btn" id="nav-usuarios"
          onclick="navegar('usuarios')">
          ◎ Usuarios
        </button>
        <button class="nav-btn" id="nav-admin"
          onclick="navegar('admin')">
          ⚙ Admin
        </button>` : ''}
      </div>

      <div class="navbar-user">
        <span id="sync-badge" class="sync-badge sync-ok"
          onclick="intentarSync()" title="Estado sincronización">
          <span class="sync-dot"></span>SYNC OK
        </span>
        <div class="navbar-user-info">
          <span class="navbar-user-nombre">
            ${APP.perfil?.grado||''} ${APP.perfil?.nombre||''}
          </span>
          <span class="navbar-user-cuartel">
            ${APP.cuartel?.nombre || 'Todos los cuarteles'}
          </span>
        </div>
        <button class="btn-logout" onclick="logout()">
          Cerrar sesión
        </button>
      </div>
    </nav>

    <main id="main-content">
      <div id="pantalla-dashboard"></div>
      <div id="pantalla-registro"  style="display:none"></div>
      <div id="pantalla-historial" style="display:none"></div>
      <div id="pantalla-maestras"  style="display:none"></div>
      <div id="pantalla-csf"       style="display:none"></div>
      <div id="pantalla-usuarios"  style="display:none"></div>
      <div id="pantalla-admin"     style="display:none"></div>
    </main>

    <div id="toast-container"></div>`

  actualizarIndicadorSync()
  navegar('dashboard')
}

async function navegar(pantalla) {
  _pantalla = pantalla
  document.querySelectorAll('.nav-btn')
    .forEach(b => b.classList.remove('active'))
  const navBtn = el(`nav-${pantalla}`)
  if (navBtn) navBtn.classList.add('active')

  const pantallas = [
    'dashboard','registro','historial',
    'maestras','csf','usuarios','admin'
  ]
  pantallas.forEach(p => {
    const pe = el(`pantalla-${p}`)
    if (pe) pe.style.display = p === pantalla ? '' : 'none'
  })

  if (pantalla === 'dashboard') await renderDashboard()
  if (pantalla === 'registro')  await renderRegistro()
  if (pantalla === 'historial') await renderHistorial()
  if (pantalla === 'maestras')  await renderMaestras()
  if (pantalla === 'csf')       await renderCSF()
  if (pantalla === 'usuarios')  await renderUsuarios()
  if (pantalla === 'admin')     renderAdmin()
}
