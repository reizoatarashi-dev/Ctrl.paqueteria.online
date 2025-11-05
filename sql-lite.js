/* sql-lite.js v4: +Campos/Índices de 'servicio' + 'sync_queue' + helper 'getAllByServicio' */
const DB_NAME = "ctrl_paqueteria_db_v1";
const DB_VERSION = 4; // ¡Versión incrementada por los nuevos índices!
let DB;

function openDB(){
  return new Promise((resolve,reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    
    req.onupgradeneeded = (e)=>{
      const db = e.target.result;
      const tx = e.target.transaction;
      
      console.log(`Actualizando base de datos a v${DB_VERSION}...`);

      // --- Users Store ---
      let userStore;
      if(!db.objectStoreNames.contains('users')){
        userStore = db.createObjectStore('users',{keyPath:'id',autoIncrement:true});
        userStore.createIndex('usuario','usuario',{unique:true});
      } else {
        userStore = tx.objectStore('users');
      }
      if (!userStore.indexNames.contains('rol')) {
        userStore.createIndex('rol', 'rol', { unique: false });
      }
      // +Nuevos índices para Supabase y Servicio
      if (!userStore.indexNames.contains('id_auth')) {
        userStore.createIndex('id_auth', 'id_auth', { unique: false }); // No 'unique' por si se crea local
      }
      if (!userStore.indexNames.contains('nombre_servicio')) {
        userStore.createIndex('nombre_servicio', 'nombre_servicio', { unique: false });
      }

      // --- Domicilios Store ---
      let domStore;
      if(!db.objectStoreNames.contains('domicilios')){
        domStore = db.createObjectStore('domicilios',{keyPath:'id',autoIncrement:true});
        domStore.createIndex('calle','calle',{unique:false});
      } else {
         domStore = tx.objectStore('domicilios');
      }
      // +Nuevo índice
      if (!domStore.indexNames.contains('servicio')) {
        domStore.createIndex('servicio', 'servicio', { unique: false });
      }

      // --- Paquetes Store ---
      let paqueteStore;
      if(!db.objectStoreNames.contains('paquetes')){
        paqueteStore = db.createObjectStore('paquetes',{keyPath:'id',autoIncrement:true});
        paqueteStore.createIndex('guia','guia',{unique:true}); // Esto puede dar problemas si guías se repiten entre servicios
      } else {
        paqueteStore = tx.objectStore('paquetes');
      }
      // +Nuevos índices
      if (!paqueteStore.indexNames.contains('estado')) {
        paqueteStore.createIndex('estado', 'estado', { unique: false });
      }
      if (!paqueteStore.indexNames.contains('domicilio')) {
        paqueteStore.createIndex('domicilio', 'domicilio', { unique: false });
      }
      if (!paqueteStore.indexNames.contains('servicio')) {
        paqueteStore.createIndex('servicio', 'servicio', { unique: false });
      }
      // Arreglo para índice de guía: no puede ser único si es multitenant
      if (paqueteStore.indexNames.contains('guia')) {
         paqueteStore.deleteIndex('guia');
         paqueteStore.createIndex('guia', 'guia', { unique: false });
         console.log("Índice 'guia' recreado como NO único.");
      }


      // --- Historial Store ---
      let histStore;
      if(!db.objectStoreNames.contains('historial')){
        histStore = db.createObjectStore('historial',{keyPath:'id',autoIncrement:true});
        histStore.createIndex('paqueteId','paqueteId',{unique:false});
      } else {
        histStore = tx.objectStore('historial');
      }
      // +Nuevos índices
      if (!histStore.indexNames.contains('fecha')) {
        histStore.createIndex('fecha', 'fecha', { unique: false });
      }
      if (!histStore.indexNames.contains('estado')) {
        histStore.createIndex('estado', 'estado', { unique: false });
      }
      if (!histStore.indexNames.contains('servicio')) {
        histStore.createIndex('servicio', 'servicio', { unique: false });
      }
      
      // --- ★★★ NUEVA TABLA: Sync Queue ★★★ ---
      if(!db.objectStoreNames.contains('sync_queue')){
        const syncStore = db.createObjectStore('sync_queue',{keyPath:'id',autoIncrement:true});
        syncStore.createIndex('timestamp', 'timestamp', { unique: false });
        console.log("Object store 'sync_queue' creado.");
      }
      
      console.log("Actualización de BD completada.");
    };
    
    req.onsuccess = (e)=>{DB=e.target.result;resolve(DB)};
    req.onerror = (e)=>{reject(e)};
  });
}

function tx(storeName, mode='readwrite'){
  if (!DB) {
    console.error("La base de datos no está abierta.");
    return null; // O rechazar una promesa
  }
  const t = DB.transaction([storeName], mode);
  return t.objectStore(storeName);
}

async function addItem(store, data){
  return new Promise((resolve,reject)=>{
    const st = tx(store);
    if (!st) return reject("Error en transacción al añadir item");
    const req = st.add(data);
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = (e)=>reject(e);
  });
}
async function putItem(store, data){
  return new Promise((resolve,reject)=>{
    const st = tx(store);
    if (!st) return reject("Error en transacción al actualizar item");
    const req = st.put(data);
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = (e)=>reject(e);
  });
}
async function deleteItem(store, key){
  return new Promise((resolve,reject)=>{
    const st = tx(store);
    if (!st) return reject("Error en transacción al borrar item");
    const req = st.delete(key);
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = (e)=>reject(e);
  });
}
async function getByIndex(store, indexName, value){
  return new Promise((resolve,reject)=>{
    const st = tx(store,'readonly');
    if (!st) return reject("Error en transacción al getByIndex");
    const idx = st.index(indexName);
    const req = idx.get(value);
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = (e)=>reject(e);
  });
}
async function getAll(store){
  return new Promise((resolve,reject)=>{
    const st = tx(store,'readonly');
    if (!st) return reject("Error en transacción al getAll");
    const req = st.getAll();
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = (e)=>reject(e);
  });
}
async function getByKey(store, key){
  return new Promise((resolve,reject)=>{
    const st = tx(store,'readonly');
    if (!st) return reject("Error en transacción al getByKey");
    const req = st.get(key);
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = (e)=>reject(e);
  });
}

// --- ★★★ NUEVO HELPER: Obtener por Servicio ★★★ ---
/**
 * Obtiene todos los registros de un store que coinciden con un servicio.
 * @param {string} store - El nombre del store (ej: 'paquetes', 'users').
 * @param {string} servicio - El nombre del servicio a filtrar.
 */
async function getAllByServicio(store, servicio) {
  return new Promise((resolve, reject) => {
    const st = tx(store, 'readonly');
    if (!st) return reject(`Error en transacción al getAllByServicio para ${store}`);
    
    // El store 'users' usa 'nombre_servicio', los demás usan 'servicio'
    const indexName = (store === 'users') ? 'nombre_servicio' : 'servicio';
    
    if (!st.indexNames.contains(indexName)) {
      return reject(`Índice '${indexName}' no encontrado en el store '${store}'.`);
    }
    
    const idx = st.index(indexName);
    const req = idx.getAll(servicio);
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e);
  });
}


async function query(store, callback){
  return new Promise((resolve,reject)=>{
    const st = tx(store,'readonly');
    if (!st) return reject("Error en transacción al query");
    const req = st.openCursor();
    const out = [];
    req.onsuccess = (e)=>{
      const cur = e.target.result;
      if(!cur){ resolve(out); return; }
      const res = callback(cur);
      if(res !== false) out.push(cur.value);
      cur.continue();
    };
    req.onerror = (e)=>reject(e);
  });
}

// --- INICIO: NUEVAS FUNCIONES DE RESPALDO Y SYNC ---

/**
 * Añade una operación a la cola de sincronización.
 * @param {string} action - 'add', 'update', 'delete'.
 * @param {string} storeName - El nombre de la tabla (ej: 'paquetes').
 * @param {object} payload - Los datos del objeto.
 */
async function addItemToSyncQueue(action, storeName, payload) {
  console.log(`Encolando acción: ${action} en ${storeName}`);
  return addItem('sync_queue', {
    action: action,
    storeName: storeName,
    payload: payload,
    timestamp: Date.now()
  });
}

/**
 * Borra todos los datos de un object store.
 * @param {string} storeName - El nombre del store a limpiar.
 */
async function clearStore(storeName) {
  return new Promise((resolve, reject) => {
    const st = tx(storeName);
    if (!st) return reject(`Error en transacción al clearStore ${storeName}`);
    const req = st.clear();
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e);
  });
}

/**
 * Añade un array de items a un store.
 * @param {string} storeName - El nombre del store.
 * @param {Array<Object>} items - Los items a añadir.
 */
async function bulkAdd(storeName, items) {
  return new Promise((resolve, reject) => {
    if (!items || items.length === 0) {
      return resolve(); // Nada que añadir
    }
    
    const t = DB.transaction([storeName], 'readwrite');
    const st = t.objectStore(storeName);

    t.onerror = (e) => reject(e);
    t.oncomplete = () => resolve();
    
    // Iterar y añadir cada item
    // Usamos 'put' en lugar de 'add' para sobrescribir datos viejos si los IDs coinciden
    items.forEach(item => {
      st.put(item); 
    });
  });
}
// --- FIN: NUEVAS FUNCIONES DE RESPALDO Y SYNC ---

