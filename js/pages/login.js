// ============================================================
// SISCOF — Login
// Diseño institucional Carabineros de Chile
// ============================================================

function renderLogin() {
  document.body.innerHTML = `
    <div class="login-wrap">
      <div class="login-card">

        <!-- Escudo institucional -->
        <div class="login-escudo">
          <img
            src="img/escudo-carabineros.png"
            alt="Carabineros de Chile"
            onerror="this.outerHTML='<span style=\\'font-size:3rem;display:block;text-align:center\\'>⚜</span>'"
          />
        </div>

        <div class="login-titulo">SISCOF</div>
        <div class="login-sub">Sistema de Control Fronterizo</div>
        <div class="login-inst">
          ${SISCOF_CONFIG.NOMBRE_UNIDAD} · ${SISCOF_CONFIG.NOMBRE_INSTITUCION}
        </div>

        <div class="login-divider"></div>

        <div class="campo gap">
          <label for="login-email">Correo institucional</label>
          <input
            id="login-email"
            type="email"
            placeholder="usuario@carabineros.cl"
            autocomplete="email"
          />
        </div>

        <div class="campo gap2">
          <label for="login-pass">Contraseña</label>
          <input
            id="login-pass"
            type="password"
            placeholder="••••••••"
            autocomplete="current-password"
          />
        </div>

        <div id="login-error" class="form-error" style="display:none"></div>

        <button
          id="login-btn"
          class="btn btn-primario btn-block"
          onclick="doLogin()"
        >
          Ingresar al sistema
        </button>

        <div class="login-footer">
          Uso exclusivo personal autorizado ·
          ${SISCOF_CONFIG.NOMBRE_UNIDAD.toUpperCase()}
        </div>

      </div>
    </div>
  `

  // Enter para hacer login
  document.getElementById('login-pass').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin()
  })

  // Focus automático en email
  setTimeout(() => document.getElementById('login-email')?.focus(), 100)
}

async function doLogin() {
  const emailEl = el('login-email')
  const passEl  = el('login-pass')
  const errEl   = el('login-error')
  const btn     = el('login-btn')

  const email = emailEl?.value?.trim()
  const pass  = passEl?.value

  if (!email || !pass) {
    errEl.textContent = 'Ingrese su correo y contraseña.'
    errEl.style.display = ''
    return
  }

  btn.disabled    = true
  btn.textContent = 'Verificando...'
  errEl.style.display = 'none'

  try {
    await login(email, pass)
    renderApp()
  } catch (e) {
    errEl.textContent = 'Credenciales incorrectas. Verifique su correo y contraseña.'
    errEl.style.display = ''
    btn.disabled    = false
    btn.textContent = 'Ingresar al sistema'
    passEl.value    = ''
    passEl.focus()
  }
}
