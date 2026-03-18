// ============================================================
// SISCOF v3 — Offline Engine
// IndexedDB via Dexie.js + cola de sincronización automática
// ============================================================

let _db = null

async function initOfflineDB() {
  _db = new Dexie('siscof_local')
  _db.version(1).stores({
    sync_queue:  '++id, tabla, estado, created_at',
    cache_puntos: 'id, cuartel_id, tipo, activo',
    cache_personal: 'id, cuartel_id, activo',
    cache_vehiculos: 'id, cuartel_id, activo',
    servicios_borrador: 'id, cuartel_id, created_at',
  })
  await _db.open()
  console.log('[SISCOF] IndexedDB inicializada')
  // Actualizar indicador en navbar si ya está renderizado
  actualizarIndicadorSync()
  // Iniciar ciclo de sync si hay conexión
  window.addEventListener('online', () => intentarSync())
  intentarSync()
}

// ── Indicador visual de sync en navbar ──────────────────────
async function actualizarIndicadorSync() {
  if (!_db) return
  const pendientes = await _db.sync_queue.where('estado').equals('pendiente').count()
  const errores    = await _db.sync_queue.where('estado').equals('error').count()
  const badge = document.getElementById('sync-badge')
  if (!badge) return
  if (errores > 0) {
    badge.className = 'sync-badge sync-error'
    badge.innerHTML = `<span class="sync-dot"></span>${errores} ERROR SYNC`
  } else if (pendientes > 0) {
    badge.className = 'sync-badge sync-pending'
    badge.innerHTML = `<span class="sync-dot"></span>${pendientes} PENDIENTE${pendientes > 1 ? 'S' : ''}`
  } else {
    badge.className = 'sync-badge sync-ok'
    badge.innerHTML = `<span class="sync-dot"></span>SYNC OK`
  }
}

// ── Encolar operación para sync ──────────────────────────────
async function encolarSync(tabla, operacion, payload) {
  if (!_db) return
  await _db.sync_queue.add({
    tabla, operacion, payload: JSON.stringify(payload),
    estado: 'pendiente', intentos: 0,
    created_at: new Date().toISOString()
  })
  actualizarIndicadorSync()
  if (navigator.onLine) intentarSync()
}

// ── Intentar sincronizar cola ────────────────────────────────
let _syncEnProceso = false
async function intentarSync() {
  if (_syncEnProceso || !_db || !navigator.onLine) return
  if (!APP?.sb) return
  _syncEnProceso = true
  try {
    const items = await _db.sync_queue
      .where('estado').anyOf(['pendiente','error'])
      .and(i => i.intentos < 5)
      .toArray()
    for (const item of items) {
      try {
        await _db.sync_queue.update(item.id, { estado: 'procesando' })
        const payload = JSON.parse(item.payload)
        if (item.operacion === 'insert') {
          const { error } = await APP.sb.from(item.tabla).insert(payload)
          if (error) throw error
        } else if (item.operacion === 'upsert') {
          const { error } = await APP.sb.from(item.tabla).upsert(payload)
          if (error) throw error
        }
        await _db.sync_queue.delete(item.id)
      } catch {
        await _db.sync_queue.update(item.id, {
          estado: 'error', intentos: (item.intentos || 0) + 1
        })
      }
    }
  } finally {
    _syncEnProceso = false
    actualizarIndicadorSync()
  }
}

// ── Cache de datos maestros ──────────────────────────────────
async function cachearDatosMaestros(cuartelId) {
  if (!_db || !APP?.sb) return
  try {
    const [{ data: pts }, { data: prs }, { data: vhs }] = await Promise.all([
      APP.sb.from('puntos_territoriales').select('*').eq('activo', true),
      APP.sb.from('personal').select('*').eq('cuartel_id', cuartelId).eq('activo', true),
      APP.sb.from('vehiculos').select('*').eq('cuartel_id', cuartelId).eq('activo', true),
    ])
    if (pts) { await _db.cache_puntos.clear(); await _db.cache_puntos.bulkPut(pts) }
    if (prs) { await _db.cache_personal.clear(); await _db.cache_personal.bulkPut(prs) }
    if (vhs) { await _db.cache_vehiculos.clear(); await _db.cache_vehiculos.bulkPut(vhs) }
    console.log('[SISCOF] Datos maestros cacheados')
  } catch(e) {
    console.warn('[SISCOF] No se pudo cachear datos maestros:', e.message)
  }
}

// ── Obtener puntos desde cache si no hay red ─────────────────
async function obtenerPuntosConFallback(cuartelId) {
  if (navigator.onLine && APP?.sb) {
    const { data } = await APP.sb.from('puntos_territoriales')
      .select('*').eq('cuartel_id', cuartelId).eq('activo', true)
      .order('tipo').order('nombre')
    return data || []
  }
  if (!_db) return []
  return await _db.cache_puntos.where('cuartel_id').equals(cuartelId)
    .and(p => p.activo === true).toArray()
}

async function obtenerPersonalConFallback(cuartelId) {
  if (navigator.onLine && APP?.sb) {
    const { data } = await APP.sb.from('personal')
      .select('*').eq('cuartel_id', cuartelId).eq('activo', true)
      .order('nombre_completo')
    return data || []
  }
  if (!_db) return []
  return await _db.cache_personal.where('cuartel_id').equals(cuartelId)
    .and(p => p.activo === true).sortBy('nombre_completo')
}

async function obtenerVehiculosConFallback(cuartelId) {
  if (navigator.onLine && APP?.sb) {
    const { data } = await APP.sb.from('vehiculos')
      .select('*').eq('cuartel_id', cuartelId).eq('activo', true)
    return data || []
  }
  if (!_db) return []
  return await _db.cache_vehiculos.where('cuartel_id').equals(cuartelId)
    .and(v => v.activo === true).toArray()
}
