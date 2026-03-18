// ============================================================
// SISCOF — Login institucional
// ============================================================

function renderLogin() {
  document.body.innerHTML = `
    <div class="login-wrap">
      <div class="login-card">

        <div class="login-escudo-wrap">
          <img src="img/escudo-carabineros.png"
            alt="Carabineros de Chile"
            class="login-escudo-img"
            onerror="this.style.display='none';document.getElementById('login-escudo-fallback').style.display=''" />
          <span id="login-escudo-fallback" style="display:none;font-size:3rem">⚜</span>
        </div>

        <div class="login-titulo">SISCOF</div>
        <div class="login-sub">SISTEMA DE CONTROL FRONTERIZO</div>
        <div class="login-inst">
          ${SISCOF_CONFIG.NOMBRE_UNIDAD} · ${SISCOF_CONFIG.NOMBRE_INSTITUCION}
        </div>

        <div class="campo gap3">
          <label for="login-email">CORREO INSTITUCIONAL</label>
          <input id="login-email" type="email"
            placeholder="usuario@carabineros.cl"
            autocomplete="email" />
        </div>

        <div class="campo gap2">
          <label for="login-pass">CONTRASEÑA</label>
          <input id="login-pass" type="password"
            placeholder="••••••••"
            autocomplete="current-password" />
        </div>

        <div id="login-error" class="form-error" style="display:none"></div>

        <button id="login-btn" class="btn btn-primario btn-block" onclick="doLogin()">
          INGRESAR AL SISTEMA
        </button>

        <div class="login-footer">
          USO EXCLUSIVO PERSONAL AUTORIZADO<br>
          ${SISCOF_CONFIG.NOMBRE_UNIDAD.toUpperCase()} · ${SISCOF_CONFIG.NOMBRE_INSTITUCION.toUpperCase()}
        </div>
      </div>
    </div>
  `

  document.getElementById('login-pass').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin()
  })
  document.getElementById('login-email').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('login-pass').focus()
  })
}

async function doLogin() {
  const email = el('login-email')?.value?.trim()
  const pass  = el('login-pass')?.value
  const err   = el('login-error')
  const btn   = el('login-btn')

  err.style.display = 'none'

  if (!email || !pass) {
    err.textContent   = 'Ingrese su correo y contraseña.'
    err.style.display = ''
    return
  }

  btn.disabled    = true
  btn.textContent = 'VERIFICANDO...'

  try {
    await login(email, pass)
    renderApp()
  } catch (e) {
    err.textContent   = 'Credenciales incorrectas. Verifique e intente nuevamente.'
    err.style.display = ''
    btn.disabled      = false
    btn.textContent   = 'INGRESAR AL SISTEMA'
  }
}
