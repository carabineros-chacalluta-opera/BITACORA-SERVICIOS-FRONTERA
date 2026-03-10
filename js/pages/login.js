// ============================================================
// SISCOF — Login
// ============================================================

function renderLogin() {
  document.body.innerHTML = `
    <div class="login-wrap">
      <div class="login-card">
        <div class="login-escudo">⚜</div>
        <div class="login-titulo">SISCOF</div>
        <div class="login-sub">SISTEMA DE CONTROL FRONTERIZO</div>
        <div class="login-inst">${SISCOF_CONFIG.NOMBRE_UNIDAD} · ${SISCOF_CONFIG.NOMBRE_INSTITUCION}</div>

        <div class="campo gap">
          <label for="login-email">CORREO INSTITUCIONAL</label>
          <input id="login-email" type="email" placeholder="usuario@carabineros.cl" autocomplete="email" />
        </div>
        <div class="campo gap2">
          <label for="login-pass">CONTRASEÑA</label>
          <input id="login-pass" type="password" placeholder="••••••••" autocomplete="current-password" />
        </div>

        <div id="login-error" class="form-error" style="display:none"></div>

        <button id="login-btn" class="btn btn-primario btn-block" onclick="doLogin()">
          INGRESAR AL SISTEMA
        </button>

        <div class="login-footer">
          USO EXCLUSIVO PERSONAL AUTORIZADO · ${SISCOF_CONFIG.NOMBRE_UNIDAD.toUpperCase()}
        </div>
      </div>
    </div>
  `

  // Enter para hacer login
  document.getElementById('login-pass').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin()
  })
}

async function doLogin() {
  const email = el('login-email')?.value?.trim()
  const pass  = el('login-pass')?.value

  if (!email || !pass) {
    const err = el('login-error')
    err.textContent = 'Ingrese su correo y contraseña.'
    err.style.display = ''
    return
  }

  const btn = el('login-btn')
  btn.disabled = true
  btn.textContent = 'VERIFICANDO...'

  try {
    await login(email, pass)
    renderApp()
  } catch (e) {
    const err = el('login-error')
    err.textContent = 'Credenciales incorrectas. Verifique su correo y contraseña.'
    err.style.display = ''
    btn.disabled = false
    btn.textContent = 'INGRESAR AL SISTEMA'
  }
}
