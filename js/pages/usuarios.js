// ============================================================
// SISCOF v3 — Gestión de Usuarios
// CRUD completo con RUT, grado, rol, cuartel
// ============================================================

async function renderUsuarios() {
  if (!APP.esAdmin) {
    el('pantalla-usuarios').innerHTML = `<div class="cargando">SIN ACCESO</div>`; return
  }
  el('pantalla-usuarios').innerHTML = `<div class="cargando">Cargando usuarios</div>`
  try {
    const [{ data: usuarios }, cuarteles] = await Promise.all([
      APP.sb.from('usuarios').select('*, cuartel:cuarteles(nombre)').order('nombre'),
      obtenerCuarteles(),
    ])
    window._usuariosData   = usuarios || []
    window._cuartelesData  = cuarteles
    renderUsuariosUI()
  } catch(e) {
    el('pantalla-usuarios').innerHTML = `<div class="cargando">Error: ${e.message}</div>`
  }
}

function renderUsuariosUI() {
  const rolLabel = { jefe_servicio: 'Jefe Serv.', administrador: 'Admin', comisaria: 'Comisaría', prefectura: 'Prefectura' }
  const rolClass = { jefe_servicio: 'rol-jefe', administrador: 'rol-admin', comisaria: 'rol-comis', prefectura: 'rol-pref' }
  const rows = (window._usuariosData || []).map(u => `
    <tr>
      <td style="font-weight:600">${u.nombre}</td>
      <td style="font-size:.78rem;color:var(--muted)">${u.grado || '—'}</td>
      <td><span class="rol-badge ${rolClass[u.rol] || ''}">${rolLabel[u.rol] || u.rol}</span></td>
      <td style="font-size:.78rem">${u.cuartel?.nombre || '—'}</td>
      <td><span style="color:${u.activo?'var(--verde)':'var(--muted2)'};font-size:.75rem;font-weight:600">
        ${u.activo ? 'ACTIVO' : 'INACTIVO'}</span></td>
      <td>
        <button onclick="toggleUsuario('${u.id}',${!u.activo})"
          style="font-size:.7rem;padding:.2rem .55rem;border-radius:4px;border:1px solid var(--border);
          background:var(--bg3);cursor:pointer;color:var(--text2)">
          ${u.activo ? 'Desactivar' : 'Activar'}
        </button>
      </td>
    </tr>`).join('')

  el('pantalla-usuarios').innerHTML = `
    <div class="container" style="max-width:860px">
      <div class="flex-sb" style="margin-bottom:1.25rem;flex-wrap:wrap;gap:.75rem">
        <h2 style="font-size:1.4rem;font-weight:700;color:var(--text)">Gestión de Usuarios</h2>
        <button class="btn btn-primario" style="font-size:.78rem;padding:.4rem .85rem"
          onclick="mostrarFormNuevoUsuario()">+ Nuevo usuario</button>
      </div>

      <!-- Formulario nuevo usuario (colapsado) -->
      <div id="form-usuario" style="display:none" class="card gap3" style="margin-bottom:1.25rem">
        <div class="sec-titulo">Nuevo usuario</div>
        <div class="g2 gap">
          <div class="campo"><label>Nombre completo</label><input id="nu-nombre" type="text" placeholder="Vergara Cortez Damian H." /></div>
          <div class="campo"><label>Grado</label>
            <select id="nu-grado">
              <option value="">Sin grado</option>
              ${['Carabinero','Cabo','Sargento 2°','Sargento 1°','Sub oficial','Sub teniente','Teniente','Capitán','Mayor','Teniente Coronel','Coronel'].map(g=>`<option>${g}</option>`).join('')}
            </select></div>
          <div class="campo"><label>Correo institucional</label><input id="nu-email" type="email" placeholder="usuario@carabineros.cl" /></div>
          <div class="campo"><label>Contraseña temporal</label><input id="nu-pass" type="password" placeholder="Mínimo 8 caracteres" /></div>
          <div class="campo"><label>Rol</label>
            <select id="nu-rol">
              <option value="jefe_servicio">Jefe de Servicio (registra bitácoras)</option>
              <option value="administrador">Administrador (acceso total)</option>
              <option value="comisaria">Comisaría (visión cuarteles subordinados)</option>
              <option value="prefectura">Prefectura (visión global)</option>
            </select></div>
          <div class="campo"><label>Cuartel asignado</label>
            <select id="nu-cuartel">
              <option value="">Sin cuartel específico</option>
              ${(window._cuartelesData||[]).map(c=>`<option value="${c.id}">${c.nombre}</option>`).join('')}
            </select></div>
        </div>
        <div id="nu-error" class="form-error" style="display:none"></div>
        <div class="flex-gap">
          <button class="btn btn-primario" onclick="crearUsuario()">Crear usuario</button>
          <button class="btn btn-secundario" onclick="el('form-usuario').style.display='none'">Cancelar</button>
        </div>
      </div>

      <div class="card" style="padding:0;overflow:hidden">
        <div style="overflow-x:auto">
          <table class="tabla-usuarios">
            <thead><tr>
              <th>Nombre</th><th>Grado</th><th>Rol</th><th>Cuartel</th><th>Estado</th><th></th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>

      <div style="font-size:.72rem;color:var(--muted);margin-top:.75rem;padding:.6rem;
        background:var(--bg3);border-radius:var(--radius-sm)">
        💡 Para crear usuarios se requiere acceso a la Edge Function de Supabase configurada con la Service Role key.
        Sin ella, los usuarios deben crearse directamente en Supabase Dashboard → Authentication.
      </div>
    </div>`
}

function mostrarFormNuevoUsuario() {
  const form = el('form-usuario')
  if (form) form.style.display = form.style.display === 'none' ? '' : 'none'
}

async function crearUsuario() {
  const nombre  = el('nu-nombre')?.value?.trim()
  const email   = el('nu-email')?.value?.trim()
  const pass    = el('nu-pass')?.value
  const grado   = el('nu-grado')?.value
  const rol     = el('nu-rol')?.value
  const cuartel = el('nu-cuartel')?.value
  const errEl   = el('nu-error')

  if (!nombre || !email || !pass || !rol) {
    errEl.textContent = 'Complete nombre, correo, contraseña y rol.'
    errEl.style.display = ''; return
  }
  if (pass.length < 8) {
    errEl.textContent = 'La contraseña debe tener al menos 8 caracteres.'
    errEl.style.display = ''; return
  }
  errEl.style.display = 'none'

  try {
    // Intentar via Edge Function si existe; si no, insertar solo en tabla usuarios
    // (el usuario en Supabase Auth debe crearse manualmente si no hay Edge Function)
    const { error } = await APP.sb.from('usuarios').insert({
      email, nombre, grado: grado || null, rol,
      cuartel_id: cuartel || null, activo: true,
    })
    if (error) throw error
    toast('Usuario creado en tabla. Cree la cuenta Auth en Supabase Dashboard.', 'ok')
    el('form-usuario').style.display = 'none'
    renderUsuarios()
  } catch(e) {
    errEl.textContent = 'Error: ' + e.message; errEl.style.display = ''
  }
}

async function toggleUsuario(id, nuevoEstado) {
  try {
    const { error } = await APP.sb.from('usuarios').update({ activo: nuevoEstado }).eq('id', id)
    if (error) throw error
    const u = window._usuariosData?.find(u => u.id === id)
    if (u) u.activo = nuevoEstado
    renderUsuariosUI()
    toast(`Usuario ${nuevoEstado ? 'activado' : 'desactivado'}`, 'ok')
  } catch(e) { toast('Error: ' + e.message, 'err') }
}
