// ============================================================
// SISCOF v3 — Historial de servicios
// ============================================================

async function renderHistorial() {
  el('pantalla-historial').innerHTML = `<div class="cargando">Cargando historial</div>`
  try {
    const cuartelIds = await obtenerCuartelIds()
    if (!cuartelIds.length) { el('pantalla-historial').innerHTML = `<div class="cargando">Sin cuartel asignado</div>`; return }
    const { data: servicios } = await APP.sb
      .from('servicios')
      .select('id,cuartel_id,nombre_jefe,fecha,turno,estado,tiene_mision_ffaa,created_at,cuartel:cuarteles(nombre)')
      .in('cuartel_id', cuartelIds)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200)

    el('pantalla-historial').innerHTML = `
      <div class="container">
        <div class="flex-sb" style="margin-bottom:1.25rem;flex-wrap:wrap;gap:.75rem">
          <div>
            <h2 style="font-size:1.4rem;font-weight:700;color:var(--text)">Historial de Servicios</h2>
            <p style="font-size:.78rem;color:var(--muted);margin-top:2px">Últimos 200 registros</p>
          </div>
          <input id="buscador-hist" type="text" placeholder="Buscar por jefe, fecha..."
            style="width:240px;padding:.45rem .75rem;border:1.5px solid var(--border);
            border-radius:var(--radius-sm);font-size:.82rem;background:var(--bg2)"
            oninput="filtrarHistorial()" />
        </div>
        <div class="card" style="padding:0;overflow:hidden">
          <div style="overflow-x:auto">
            <table class="tabla-historial" id="tabla-hist">
              <thead>
                <tr>
                  <th>Fecha</th><th>Cuartel</th><th>Jefe de Servicio</th>
                  <th>Turno</th><th>Estado</th><th>M5</th><th></th>
                </tr>
              </thead>
              <tbody id="tbody-hist">
                ${(servicios||[]).map(s => filaHistorial(s)).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>`
    window._historialData = servicios || []
  } catch(e) {
    el('pantalla-historial').innerHTML = `<div class="cargando">Error: ${e.message}</div>`
  }
}

function filaHistorial(s) {
  const turnoLabel = { manana: 'Mañana', tarde: 'Tarde', noche: 'Noche' }[s.turno] || s.turno
  const estadoColor = s.estado === 'enviado' ? 'var(--verde)' : s.estado === 'borrador' ? 'var(--amarillo)' : 'var(--muted)'
  return `<tr data-id="${s.id}" style="cursor:pointer" onclick="verDetalleServicio('${s.id}')">
    <td style="font-weight:600">${s.fecha}</td>
    <td style="font-size:.78rem">${s.cuartel?.nombre || '—'}</td>
    <td>${s.nombre_jefe}</td>
    <td>${turnoLabel}</td>
    <td><span style="color:${estadoColor};font-weight:600;font-size:.75rem;text-transform:uppercase">${s.estado}</span></td>
    <td>${s.tiene_mision_ffaa ? '<span style="color:var(--azul);font-weight:600;font-size:.72rem">🪖 D°78</span>' : '—'}</td>
    <td style="color:var(--muted)">›</td>
  </tr>`
}

function filtrarHistorial() {
  const q = el('buscador-hist')?.value?.toLowerCase() || ''
  const tbody = el('tbody-hist')
  if (!tbody || !window._historialData) return
  const filtrados = window._historialData.filter(s =>
    s.nombre_jefe?.toLowerCase().includes(q) ||
    s.fecha?.includes(q) ||
    s.cuartel?.nombre?.toLowerCase().includes(q)
  )
  tbody.innerHTML = filtrados.map(s => filaHistorial(s)).join('')
}

async function verDetalleServicio(id) {
  try {
    const { data: svc } = await APP.sb.from('servicios').select('*, cuartel:cuarteles(nombre)').eq('id', id).single()
    const { data: tareas } = await APP.sb.from('tareas').select('*').eq('servicio_id', id).order('orden')
    const { data: resultados } = await APP.sb.from('resultados').select('*').eq('servicio_id', id)
    const { data: detenidos }  = await APP.sb.from('detenidos').select('*').eq('servicio_id', id)

    const modal = document.createElement('div')
    modal.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.5);overflow-y:auto;padding:2rem 1rem'
    modal.innerHTML = `
      <div style="background:#fff;border-radius:16px;max-width:680px;margin:0 auto;padding:2rem">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:1.5rem">
          <div>
            <div style="font-size:1.2rem;font-weight:700">Servicio — ${svc.fecha}</div>
            <div style="font-size:.8rem;color:var(--muted)">${svc.cuartel?.nombre} · ${svc.nombre_jefe}</div>
            ${svc.tiene_mision_ffaa ? `<div style="font-size:.75rem;color:var(--azul);font-weight:600;margin-top:4px">🪖 M5 Activo — ${svc.unidad_ffaa || 'Decreto N°78'}</div>` : ''}
          </div>
          <button onclick="this.closest('div[style*=fixed]').remove()"
            style="background:var(--bg3);border:none;border-radius:6px;padding:.3rem .7rem;cursor:pointer;font-size:.85rem">✕</button>
        </div>
        <div class="g4" style="margin-bottom:1.25rem">
          <div class="item-detalle"><div class="item-detalle-valor">${tareas?.length || 0}</div><div class="item-detalle-label">Tareas</div></div>
          <div class="item-detalle"><div class="item-detalle-valor">${resultados?.length || 0}</div><div class="item-detalle-label">Resultados</div></div>
          <div class="item-detalle"><div class="item-detalle-valor">${detenidos?.length || 0}</div><div class="item-detalle-label">Detenidos</div></div>
          <div class="item-detalle"><div class="item-detalle-valor">${svc.km_termino && svc.km_inicio ? svc.km_termino - svc.km_inicio : '—'}</div><div class="item-detalle-label">Km recorridos</div></div>
        </div>
        ${svc.obs_generales ? `<div style="background:var(--bg3);border-radius:8px;padding:.75rem;font-size:.8rem;color:var(--text2);margin-bottom:1rem"><strong>Obs. generales:</strong> ${svc.obs_generales}</div>` : ''}
        <div style="font-size:.7rem;font-weight:700;letter-spacing:1.5px;color:var(--muted);text-transform:uppercase;margin-bottom:.5rem">Tareas</div>
        ${(tareas||[]).map(t => `<div style="padding:.5rem 0;border-bottom:1px solid var(--border2);font-size:.8rem"><strong>${t.orden}. ${t.tipo}</strong> <span style="color:var(--muted)">${t.hora_inicio||''} → ${t.hora_termino||''}</span>${t.tiene_resultado?'<span style="color:var(--rojo);margin-left:.5rem">⚡ Con resultado</span>':''}${t.tiene_hallazgo?'<span style="color:var(--amarillo);margin-left:.5rem">● Hallazgo</span>':''}</div>`).join('')}
        ${APP.esAdmin ? `<div style="margin-top:1.25rem;text-align:right"><button onclick="eliminarServicioAdmin('${id}',this)" class="btn" style="background:var(--rojo-claro);color:var(--rojo);border:1px solid #ffccd0;font-size:.75rem">Eliminar (solo admin)</button></div>` : ''}
      </div>`
    document.body.appendChild(modal)
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove() })
  } catch(e) { toast('Error al cargar detalle: ' + e.message, 'err') }
}

async function eliminarServicioAdmin(id, btn) {
  if (!confirm('¿Eliminar este servicio y todas sus tareas? Esta acción no se puede deshacer.')) return
  btn.disabled = true; btn.textContent = 'Eliminando...'
  try {
    await APP.sb.from('servicios').delete().eq('id', id)
    document.querySelector(`[data-id="${id}"]`)?.remove()
    document.querySelector('div[style*=fixed]')?.remove()
    toast('Servicio eliminado', 'ok')
  } catch(e) { toast('Error: ' + e.message, 'err'); btn.disabled = false }
}
