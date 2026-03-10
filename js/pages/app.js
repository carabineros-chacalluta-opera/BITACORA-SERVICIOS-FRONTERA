// ============================================================
// SISCOF — App shell + navegación
// ============================================================

let _pantalla = 'dashboard'

function renderApp() {
  document.body.innerHTML = `
    <nav class="navbar">
      <div class="navbar-logo">
        <img src="img/escudo-carabineros.png" alt="" class="navbar-escudo"
          onerror="this.style.display='none'" />
        <div class="navbar-logo-txt">
          <span class="navbar-siscof">SISCOF</span>
          <span class="navbar-unidad">${SISCOF_CONFIG.NOMBRE_UNIDAD.toUpperCase()}</span>
        </div>
      </div>

      <div class="navbar-links">
        <button class="nav-btn active" id="nav-dashboard" onclick="navegar('dashboard')">
          ◈ Dashboard
        </button>
        ${APP.puedeRegistrar ? `
        <button class="nav-btn" id="nav-registro" onclick="navegar('registro')">
          ⊕ Nuevo Servicio
        </button>` : ''}
        ${APP.esAdmin ? `
        <button class="nav-btn" id="nav-admin" onclick="navegar('admin')">
          ⚙ Administración
        </button>` : ''}
      </div>

      <div class="navbar-user">
        <div class="navbar-user-info">
          <span class="navbar-user-nombre">
            ${APP.perfil?.grado || ''} ${APP.perfil?.nombre || ''}
          </span>
          <span class="navbar-user-cuartel">
            ${APP.cuartel?.nombre || APP.perfil?.rol || ''}
          </span>
        </div>
        <button class="btn-logout" onclick="logout()">Cerrar sesión</button>
      </div>
    </nav>

    <main id="main-content">
      <div id="pantalla-dashboard"></div>
      <div id="pantalla-registro"  style="display:none"></div>
      <div id="pantalla-admin"     style="display:none"></div>
    </main>

    <div id="toast-container"></div>
  `

  navegar('dashboard')
}

async function navegar(pantalla) {
  _pantalla = pantalla

  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'))
  const navBtn = el(`nav-${pantalla}`)
  if (navBtn) navBtn.classList.add('active')

  const pantallas = ['dashboard', 'registro', 'admin']
  pantallas.forEach(p => {
    const pe = el(`pantalla-${p}`)
    if (pe) pe.style.display = p === pantalla ? '' : 'none'
  })

  if (pantalla === 'dashboard') await renderDashboard()
  if (pantalla === 'registro')  await renderRegistro()
  if (pantalla === 'admin')     renderAdmin()
}

// ── Panel administración simple ──────────────────────────────
function renderAdmin() {
  const ahora = new Date()
  el('pantalla-admin').innerHTML = `
    <div class="container" style="max-width:640px">
      <h2 style="font-size:1.4rem;font-weight:700;margin-bottom:1.5rem">Administración</h2>

      <div class="card gap3">
        <div class="sec-titulo">Cierre mensual IDFI</div>
        <p style="font-size:.82rem;color:var(--muted)">
          Guarda el IDFI calculado del mes seleccionado en el historial.
          Esto permite comparar con el año siguiente.
        </p>
        <div class="g2 gap2">
          <div class="campo">
            <label>Año</label>
            <input id="admin-anio" type="number" value="${ahora.getFullYear()}" min="2020" max="2099" />
          </div>
          <div class="campo">
            <label>Mes</label>
            <select id="admin-mes">
              ${['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
                .map((m,i) => `<option value="${i+1}" ${i+1===ahora.getMonth()?'selected':''}>${m}</option>`)
                .join('')}
            </select>
          </div>
        </div>
        <button class="btn btn-primario" onclick="ejecutarCierreMes()">
          Guardar IDFI del mes en historial
        </button>
        <div id="admin-resultado" style="font-size:.82rem;color:var(--muted)"></div>
      </div>
    </div>
  `
}

async function ejecutarCierreMes() {
  if (!APP.cuartel) { toast('Sin cuartel asignado', 'err'); return }
  const anio = parseInt(el('admin-anio')?.value)
  const mes  = parseInt(el('admin-mes')?.value)
  const res  = el('admin-resultado')
  if (res) res.textContent = 'Calculando...'
  try {
    const r = await cerrarMesIDFI(APP.cuartel.id, anio, mes)
    if (res) res.innerHTML = `
      <span style="color:var(--verde)">✓ Guardado.</span>
      IDFI ${r.idfi.toFixed(1)}% · DFP ${r.dfp.total.toFixed(1)}% · DFO ${r.dfo.total.toFixed(1)}%
    `
    toast('IDFI guardado en historial', 'ok')
  } catch(e) {
    if (res) res.textContent = 'Error: ' + e.message
    toast('Error al guardar: ' + e.message, 'err')
  }
}
