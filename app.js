/* app.js v8: +Integración con Supabase (Auth + Sincronización DB) + Data por Servicio + Sync Queue Offline */
(async function(){
  
  // --- INICIO REGISTRO PWA SERVICE WORKER ---
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('ServiceWorker registrado con éxito, scope:', registration.scope);
        })
        .catch(err => {
          console.error('Fallo en el registro de ServiceWorker:', err);
        });
    });
  }
  // --- FIN REGISTRO PWA ---

  // --- INICIO CONFIGURACIÓN SUPABASE ---
  // ★★★ ¡TUS NUEVAS CLAVES DE PROYECTO! ★★★
  const SUPABASE_URL = 'https://npqdbaldloistjlbjofg.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wcWRiYWxkbG9pc3RqbGJqb2ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzMDUyNzksImV4cCI6MjA3Nzg4MTI3OX0.kO9brJqFup2Rl_WLoE4TPudweqiioIi4j6DwNUreDwg';

  let supabase = null;
  // Comparamos con el texto de ejemplo ORIGINAL
  if (window.supabase && SUPABASE_URL !== 'https://TU_ID_DE_PROYECTO.supabase.co') {
    try {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log("Cliente de Supabase inicializado.");
    } catch (e) {
      console.error("Error inicializando Supabase. Verifica la URL y la Clave.", e);
      alert("Error de configuración: No se pudo conectar a Supabase. Revisa las claves en app.js.");
    }
  } else if (SUPABASE_URL === 'https://TU_ID_DE_PROYECTO.supabase.co') {
     console.warn("Supabase no está configurado. Reemplaza la URL y la Clave en app.js");
     if (document.body.classList.contains('page-main')) {
       alert("ADVERTENCIA: Supabase no está configurado. La app funcionará en modo 100% offline. Reemplaza la URL y la Clave en app.js para habilitar la sincronización.");
     }
  }
  // --- FIN CONFIGURACIÓN SUPABASE ---


  // --- INICIO ESTADO GLOBAL DE CONEXIÓN ---
  let isOnline = navigator.onLine;
  let currentUserService = null; // Se setea al cargar main.html
  let isSyncing = false;
  
  window.addEventListener('online', () => { 
    isOnline = true; 
    if(typeof showToast === 'function') showToast('Estás en línea. Sincronizando...', 'info'); 
    if(typeof synchronizeData === 'function') synchronizeData(); 
  });
  window.addEventListener('offline', () => { 
    isOnline = false; 
    if(typeof showToast === 'function') showToast('Estás sin conexión. Trabajando en modo local.', 'info'); 
  });
  // --- FIN ESTADO GLOBAL DE CONEXIÓN ---


  // --- INICIO SETUP DE jspdf ---
  let jsPDF;
  if(window.jspdf) {
    jsPDF = window.jspdf.jsPDF;
  }
  // --- FIN SETUP ---

  await openDB(); // Abre IndexedDB

  // --- ★★★ CORRECCIÓN: SISTEMA DE NOTIFICACIÓN TOAST MOVIDO AQUÍ ★★★ ---
  // Se mueve aquí para que esté disponible en la página de Login Y en la Principal.
  let toastTimer;
  const toast = document.getElementById('toastNotification');
  const toastIcon = document.getElementById('toastIcon');
  const toastMessage = document.getElementById('toastMessage');
  const ICONS = {
    success: `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2m-2 15l-5-5l1.41-1.41L10 16.17l7.59-7.59L19 10z"/></svg>`,
    error: `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2m1 15h-2v-2h2zm0-4h-2V7h2z"/></svg>`,
    loading: `<svg class="spinner" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-dasharray="15" stroke-dashoffset="15" stroke-linecap="round" stroke-width="2" d="M12 3C16.9706 3 21 7.02944 21 12"><animate fill="freeze" attributeName="stroke-dashoffset" dur="0.3s" values="15;0"/><animateTransform attributeName="transform" dur="1.5s" repeatCount="indefinite" type="rotate" values="0 12 12;360 12 12"/></path></svg>`,
    info: `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2m1 15h-2v-6h2zm0-8h-2V7h2z"/></svg>`
  };
  function showToast(message, type = 'success', duration = 3000) {
    if (!toast || !toastIcon || !toastMessage) return; 
    clearTimeout(toastTimer);
    toastMessage.textContent = message;
    toastIcon.innerHTML = ICONS[type] || ICONS['info'];
    toast.className = 'toast-container';
    toast.classList.add(type);
    toast.classList.add('show');
    toast.classList.remove('hiding');
    if (type !== 'loading' && duration > 0) {
      toastTimer = setTimeout(() => { hideToast(); }, duration);
    }
  }
  function hideToast() {
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.classList.remove('show');
    toast.classList.add('hiding');
    setTimeout(() => {
      toast.classList.remove('hiding', 'success', 'error', 'loading', 'info');
      toastIcon.innerHTML = '';
      toastMessage.textContent = '';
    }, 500);
  }
  const showMessage = showToast;
  const clearMessage = hideToast;
  // --- FIN SISTEMA DE NOTIFICACIÓN TOAST ---

  // --- NUEVA FUNCIÓN: Generador de Banner de Notificación ---
  async function createBannerImage(text) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const width = 600, height = 120, ratio = 1; 
      canvas.width = width * ratio; canvas.height = height * ratio;
      canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
      ctx.scale(ratio, ratio);
      ctx.fillStyle = '#28a745';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 28px system-ui, -apple-system, Segoe UI, Roboto, Arial';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text, width / 2, height / 2);
      resolve(canvas.toDataURL('image/png'));
    });
  }

  async function hashText(text){
    const enc = new TextEncoder();
    const data = enc.encode(text);
    const hash = await crypto.subtle.digest('SHA-256', data); 
    const hex = [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
    return hex;
  }
  
  async function fileToDataURL(file){
    if(!file) return null;
    return new Promise((res,rej)=>{
      const r = new FileReader();
      r.onload = ()=>res(r.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }

  async function compressImage(file, quality = 0.7, maxWidth = 1280) {
    if (!file) return null;
    const imageBitmap = await createImageBitmap(file);
    const { width, height } = imageBitmap;
    let newWidth, newHeight;
    if (width > maxWidth) {
      const ratio = maxWidth / width;
      newWidth = maxWidth;
      newHeight = height * ratio;
    } else {
      newWidth = width;
      newHeight = height;
    }
    const canvas = document.createElement('canvas');
    canvas.width = newWidth;
    canvas.height = newHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imageBitmap, 0, 0, newWidth, newHeight);
    return new Promise((resolve) => {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(dataUrl);
    });
  }


  // --- PÁGINA DE LOGIN / REGISTRO ---
  if(document.body.classList.contains('page-login')){
     
    // Redirección si ya hay sesión (pero checamos si la sesión de Supabase es válida)
    const loggedInUser = JSON.parse(localStorage.getItem('ctrl_user') || 'null');
    if(loggedInUser && supabase){
      // Verifica si la sesión de Supabase sigue activa
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          console.log("Sesión de Supabase activa. Redirigiendo...");
          location.href = 'main.html';
        } else {
          console.log("Sesión de Supabase expirada. Limpiando localStorage.");
          localStorage.removeItem('ctrl_user');
        }
      });
    } else if (loggedInUser && !supabase) {
        // Modo offline, si ya hay un usuario en local, lo dejamos pasar
        console.log("Modo offline. Usuario local encontrado. Redirigiendo...");
        location.href = 'main.html';
    }

    const container = document.querySelector('main.container'); 
    const showRegister = document.getElementById('showRegister');
    const showLogin = document.getElementById('showLogin');     
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    if (showRegister && showLogin && container) {
      showRegister.onclick = () => { container.classList.add('active'); };
      showLogin.onclick = () => { container.classList.remove('active'); };
    }
    const openPrivacyLink = document.getElementById('openPrivacyLink');
    const privacyModal = document.getElementById('privacyModal');
    const closePrivacyBtn = document.getElementById('closePrivacyBtn');
    if (openPrivacyLink && privacyModal && closePrivacyBtn) {
      openPrivacyLink.onclick = (e) => { e.preventDefault(); privacyModal.classList.remove('hidden'); };
      closePrivacyBtn.onclick = () => { privacyModal.classList.add('hidden'); };
      privacyModal.addEventListener('click', (e) => { if (e.target === privacyModal) { privacyModal.classList.add('hidden'); } });
    }
    const regFotoInput = document.getElementById('regFoto');
    const regFotoBtn = document.getElementById('regFotoBtn');
    const regFotoPreview = document.getElementById('regFotoPreview');
    regFotoBtn.addEventListener('click', () => { regFotoInput.click(); });
    regFotoInput.addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if(!f) { regFotoPreview.innerHTML=''; return; }
      const url = await fileToDataURL(f); 
      regFotoPreview.innerHTML = `<img alt="foto perfil" src="${url}">`;
    });

    // --- LÓGICA DE REGISTRO CON SUPABASE ---
    registerForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const fotoFile = regFotoInput.files[0];
      const nombre = document.getElementById('regNombre').value.trim();
      const pass = document.getElementById('regPass').value;
      const pass2 = document.getElementById('regPass2').value;
      const codigo = document.getElementById('regCodigo').value.trim();
      const nombreServicio = document.getElementById('regServicio').value.trim().toLowerCase(); // Nuevo campo

      // ★★★ CORRECCIÓN: Usamos showToast en lugar de alert ★★★
      if (!fotoFile) { showToast('Es obligatorio tomar una foto de perfil para el registro.', 'error'); return; }
      if(pass !== pass2){ showToast('Las contraseñas no coinciden', 'error'); return; } 
      if(!nombreServicio){ showToast('El "Nombre del Servicio" es obligatorio', 'error'); return; }
      if (!supabase) { showToast('Error: El cliente de Supabase no está inicializado. Revisa la configuración en app.js.', 'error'); return; }

      const usuario = nombre.split(' ')[0].toLowerCase();
      const hashed = await hashText(pass); // Hash local para IndexedDB
      const fotoDataURL = await compressImage(fotoFile); 
      const ADMIN_CODE = "admin123"; // Código de admin
      const userRol = (codigo === ADMIN_CODE) ? 'admin' : 'guardia';

      // Email ficticio para Supabase Auth (usuario@servicio.local)
      const email = `${usuario}@${nombreServicio}.local`;

      try{
        // ★★★ CORRECCIÓN: Esta línea ahora funciona ★★★
        showToast('Registrando usuario...', 'loading', 0);
        
        // 1. Registrar en Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: email,
          password: pass,
          options: {
            // Guardamos los metadatos que no son de auth
            data: {
              nombre: nombre,
              rol: userRol,
              nombre_servicio: nombreServicio,
              foto: fotoDataURL
            }
          }
        });

        if (authError) {
          throw new Error(`Error en Supabase Auth: ${authError.message}`);
        }

        if (!authData.user) {
           throw new Error("No se recibió información del usuario de Supabase después del registro.");
        }
        
        console.log("Usuario registrado en Supabase Auth:", authData.user);

        const userData = {
          id_auth: authData.user.id, // ID de Supabase Auth
          usuario, 
          nombre, 
          password: hashed, // Guardamos el hash local también
          rol: userRol, 
          foto: fotoDataURL, 
          created: Date.now(),
          nombre_servicio: nombreServicio
        };

        // 2. Guardar en IndexedDB local
        const localId = await addItem('users', userData);
        
        // 3. Iniciar sesión localmente y redirigir
        const userToStore = {
          id: localId, // ID de IndexedDB
          id_auth: authData.user.id, // ID de Supabase
          usuario: usuario,
          nombre: nombre,
          rol: userRol,
          fotoGuardia: fotoDataURL,
          nombre_servicio: nombreServicio // ¡IMPORTANTE!
        };

        localStorage.setItem('ctrl_user', JSON.stringify(userToStore));
        // ★★★ CORRECCIÓN: Esta línea ahora funciona ★★★
        hideToast();
        location.href = 'main.html'; // Redirige a la app principal

      }catch(err){ 
        // ★★★ CORRECCIÓN: Esta línea ahora funciona ★★★
        hideToast();
        showToast('Error en el registro. Es posible que el usuario ya exista en ese servicio. Detalle: ' + err.message, 'error', 7000); 
        console.error(err); 
      }
    });

    // --- LÓGICA DE LOGIN CON SUPABASE ---
    loginForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const usuario = document.getElementById('loginUsuario').value.trim();
      const pass = document.getElementById('loginPass').value;
      const nombreServicio = document.getElementById('loginServicio').value.trim().toLowerCase(); // Nuevo campo

      // ★★★ CORRECCIÓN: Usamos showToast en lugar de alert ★★★
      if (!nombreServicio) {
        showToast('El "Nombre del Servicio" es obligatorio para iniciar sesión.', 'error');
        return;
      }
      if (!supabase) {
        showToast('Error: El cliente de Supabase no está inicializado. Revisa la configuración en app.js.', 'error'); 
        // Intento de login local si Supabase no está
        await attemptLocalLogin(usuario, pass, nombreServicio);
        return;
      }

      // Email ficticio para Supabase Auth
      const email = `${usuario}@${nombreServicio}.local`;

      try {
        showToast('Iniciando sesión...', 'loading', 0);
        
        // 1. Iniciar sesión en Supabase
        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
          email: email,
          password: pass,
        });

        if (loginError) {
          throw new Error(loginError.message);
        }

        const user = loginData.user;
        const userMeta = user.user_metadata;

        // Verificamos que los metadatos existan
        if (!userMeta || !userMeta.nombre_servicio || userMeta.nombre_servicio !== nombreServicio) {
          await supabase.auth.signOut(); // Cerramos la sesión si el servicio no coincide
          throw new Error("Los metadatos del usuario están incompletos o el servicio es incorrecto.");
        }

        // 2. Buscar usuario en IndexedDB (o crearlo si no existe localmente)
        let localUser = await getByIndex('users', 'id_auth', user.id);
        let localId = localUser ? localUser.id : null;

        if (!localUser) {
          console.warn("Usuario de Supabase no encontrado localmente. Creando registro local...");
          const hashed = await hashText(pass); // Guardamos hash local
          localId = await addItem('users', {
            id_auth: user.id,
            usuario: usuario,
            nombre: userMeta.nombre,
            password: hashed,
            rol: userMeta.rol,
            foto: userMeta.foto,
            created: new Date(user.created_at).getTime(),
            nombre_servicio: userMeta.nombre_servicio
          });
        }
        
        // 3. Guardar sesión en localStorage
        const userToStore = {
          id: localId, // ID de IndexedDB
          id_auth: user.id, // ID de Supabase
          usuario: usuario,
          nombre: userMeta.nombre,
          rol: userMeta.rol,
          fotoGuardia: userMeta.foto,
          nombre_servicio: userMeta.nombre_servicio // ¡IMPORTANTE!
        };
        
        localStorage.setItem('ctrl_user', JSON.stringify(userToStore));

        // 4. ¡¡¡INICIAR SINCRONIZACIÓN!!!
        showToast('Sincronizando datos...', 'loading', 0);
        await synchronizeData(userMeta.nombre_servicio); // Sincroniza ANTES de redirigir

        hideToast();
        location.href = 'main.html';

      } catch (err) {
        hideToast();
        console.error("Error de login:", err);
        if (err.message.includes("Invalid login credentials")) {
          showToast('Usuario, contraseña o servicio incorrectos.', 'error');
          // Si falla el login de Supabase, intentamos el login local
          await attemptLocalLogin(usuario, pass, nombreServicio);
        } else {
          showToast('Error: ' + err.message, 'error', 5000);
        }
      }
    });

    async function attemptLocalLogin(usuario, pass, nombreServicio) {
        console.warn("Intentando inicio de sesión local (offline)...");
        const hashed = await hashText(pass);
        const users = await getAllByServicio('users', nombreServicio);
        const user = users.find(u => (u.usuario === usuario || u.nombre === usuario) && u.password === hashed);

        if(user){
            showToast('Iniciando sesión en modo offline', 'info', 2000);
            const userToStore = {
              id: user.id,
              id_auth: user.id_auth, // Puede ser undefined si se creó offline
              usuario: user.usuario,
              nombre: user.nombre,
              rol: user.rol,
              fotoGuardia: user.foto,
              nombre_servicio: user.nombre_servicio
            };
            localStorage.setItem('ctrl_user', JSON.stringify(userToStore));
            setTimeout(() => location.href = 'main.html', 1500);
        } else {
            if (!isOnline) {
              showToast('Usuario, contraseña o servicio incorrectos. No se puede verificar en línea.', 'error');
            }
        }
    }

    // Creación de usuario demo (solo si la DB está vacía)
    const existing = await getAll('users');
    if(existing.length===0){
      const demoHash = await hashText('guard123');
      try{ 
        await addItem('users',{
          usuario:'guardia',
          nombre:'Guardia Demo',
          password:demoHash,
          rol:'guardia', 
          foto: null, 
          created:Date.now(),
          nombre_servicio: 'demo' // Servicio demo
        }); 
      }catch(e){ console.error("Error creando usuario demo", e); }
    }
  }

  // --- PÁGINA PRINCIPAL (MAIN SPA) ---
  if(document.body.classList.contains('page-main')){
    
    if (!jsPDF) {
      console.error("jsPDF no se cargó correctamente.");
      const pdfBtn = document.getElementById('downloadPdfBtn');
      if(pdfBtn) pdfBtn.disabled = true;
    }
    
    // Cargar usuario desde localStorage
    const user = JSON.parse(localStorage.getItem('ctrl_user') || 'null');
    
    // ¡¡¡VALIDACIÓN CRUCIAL!!!
    if(!user || !user.nombre_servicio){ 
      // ★★★ CORRECCIÓN: Usamos showToast en lugar de alert ★★★
      showToast("No hay sesión de usuario o el servicio no está definido. Volviendo al login.", 'error', 4000);
      localStorage.removeItem('ctrl_user');
      setTimeout(() => location.href='index.html', 4100); 
      return; 
    }
    
    // Seteamos el servicio actual
    currentUserService = user.nombre_servicio;
    console.log(`Servicio actual: ${currentUserService}`);

    const userRol = user.rol || 'guardia';
    const userFoto = user.fotoGuardia || null; 

    document.getElementById('saludo').textContent = `Buen turno ${user.nombre} (${currentUserService})`;
    document.getElementById('logoutBtn').onclick = async ()=>{ 
      if (supabase) {
        await supabase.auth.signOut();
        console.log("Sesión de Supabase cerrada.");
      }
      localStorage.removeItem('ctrl_user'); 
      location.href='index.html'; 
    };

    const navBtnAdmin = document.getElementById('nav-btn-admin');
    if (userRol === 'admin') {
      navBtnAdmin.classList.remove('hidden');
    }

    const mainContainer = document.getElementById('app-main-container'); 
    const navBtns = document.querySelectorAll('.nav-btn');
    
    async function showScreen(id){ 
      mainContainer.classList.remove('show-paqueteria', 'show-directorio', 'show-historial', 'show-admin');
      if (id === 'screen-paqueteria') { mainContainer.classList.add('show-paqueteria'); } 
      else if (id === 'screen-directorio') { mainContainer.classList.add('show-directorio'); await refreshDomicilios(); } 
      else if (id === 'screen-historial') { mainContainer.classList.add('show-historial'); await refreshPaquetes(); } 
      else if (id === 'screen-admin') { if (userRol !== 'admin') return; mainContainer.classList.add('show-admin'); await refreshUsuarios(); }
      navBtns.forEach(b=>b.classList.remove('active'));
      document.querySelector(`.nav-btn[data-screen="${id}"]`).classList.add('active');
    }
    
    navBtns.forEach(btn=>btn.addEventListener('click', async () => await showScreen(btn.dataset.screen)));

    // --- Definición de Elementos (sin cambios) ---
    const guiaEl = document.getElementById('guia');
    const guiaSuggestions = document.getElementById('guiaSuggestions');
    const nombreDest = document.getElementById('nombreDest');
    const nombresList = document.getElementById('nombresList');
    const paqueteriaInput = document.getElementById('paqueteriaInput');
    const paqList = document.getElementById('paqList');
    const domicilioInput = document.getElementById('domicilioInput');
    const domList = document.getElementById('domList');
    const fotoInput = document.getElementById('fotoInput');
    const fotoPreview = document.getElementById('fotoPreview');
    const recibirBtn = document.getElementById('recibirBtn');
    const entregarBtn = document.getElementById('entregarBtn');
    const comentariosPaquete = document.getElementById('comentariosPaquete');
    const notificarSi = document.getElementById('notificarSi');
    const fotoBtn = document.getElementById('fotoBtn');
    const idFotoBtn = document.getElementById('idFotoBtn');
    const historialPaquetes = document.getElementById('historialPaquetes'); 
    const tablaDomicilios = document.getElementById('tablaDomicilios');
    const domForm = document.getElementById('domForm');
    const addResident = document.getElementById('addResident');
    const moreResidents = document.getElementById('moreResidents');
    const buscarHist = document.getElementById('buscarHist');
    const filtroEstado = document.getElementById('filtroEstado');
    const fechaDesde = document.getElementById('fechaDesde');
    const fechaHasta = document.getElementById('fechaHasta');
    const fechaDesdeLabel = document.getElementById('fechaDesdeLabel');
    const fechaHastaLabel = document.getElementById('fechaHastaLabel');
    const historialContador = document.getElementById('historialContador'); 
    const firmaModal = document.getElementById('firmaModal');
    const firmaCanvas = document.getElementById('firmaCanvas');
    const limpiarFirma = document.getElementById('limpiarFirma');
    const guardarFirma = document.getElementById('guardarFirma');
    const cerrarFirma = document.getElementById('cerrarFirma');
    const idFotoInput = document.getElementById('idFotoInput');
    const idPreview = document.getElementById('idPreview');
    const notificarEntregaSi = document.getElementById('notificarEntregaSi');
    const confirmEntregarModal = document.getElementById('confirmEntregarModal');
    const confirmEntregarMsg = document.getElementById('confirmEntregarMsg');
    const cancelEntregarBtn = document.getElementById('cancelEntregarBtn');
    const confirmEntregarBtn = document.getElementById('confirmEntregarBtn');
    const entregarVariosBtn = document.getElementById('entregarVariosBtn');
    const confirmEntregarVariosModal = document.getElementById('confirmEntregarVariosModal');
    const domicilioVariosTxt = document.getElementById('domicilioVariosTxt');
    const listaPaquetesVarios = document.getElementById('listaPaquetesVarios');
    const cancelVariosBtn = document.getElementById('cancelVariosBtn');
    const confirmVariosBtn = document.getElementById('confirmVariosBtn');
    const deleteConfirmModal = document.getElementById('deleteConfirmModal');
    const deleteConfirmMsg = document.getElementById('deleteConfirmMsg');
    const deleteCancelBtn = document.getElementById('deleteCancelBtn');
    const deleteConfirmBtn = document.getElementById('deleteConfirmBtn');
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');
    const refreshUsersBtn = document.getElementById('refreshUsersBtn');
    const tablaUsuarios = document.getElementById('tablaUsuarios');
    const imageViewer = document.getElementById('imageViewer');
    const viewerImg = document.getElementById('viewerImg');
    const viewerMeta = document.getElementById('viewerMeta');
    const prevImg = document.getElementById('prevImg');
    const nextImg = document.getElementById('nextImg');
    const closeImageViewer = document.getElementById('closeImageViewer');
    const exportBackupBtn = document.getElementById('exportBackupBtn');
    const restoreBackupBtn = document.getElementById('restoreBackupBtn');
    const restoreBackupInput = document.getElementById('restoreBackupInput');
    const startScannerBtn = document.getElementById('startScannerBtn');
    const stopScannerBtn = document.getElementById('stopScannerBtn');
    const scannerModal = document.getElementById('scannerModal');
    const scannerVideo = document.getElementById('scanner-video');
    const scannerStatus = document.getElementById('scannerStatus');

    let itemToDelete = { type: null, id: null }; 
    let currentBatchToDeliver = []; 
    let domicilioDebounceTimer; 
    
    // --- SISTEMA DE NOTIFICACIÓN TOAST (MOVIDO ARRIBA) ---
    // El código estaba aquí, pero se movió fuera del 'if page-main'
    // para estar disponible en la página de login.
    
    // --- HELPER WEB SHARE API (sin cambios) ---
    function dataURLtoFile(dataUrl, filename) {
      if (!dataUrl) return null;
      try {
        const arr = dataUrl.split(',');
        if (arr.length < 2) return null;
        const mimeMatch = arr[0].match(/:(.*?);/);
        if (!mimeMatch || mimeMatch.length < 2) return null;
        const mime = mimeMatch[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while(n--){ u8arr[n] = bstr.charCodeAt(n); }
        return new File([u8arr], filename, {type:mime});
      } catch (e) { console.error("Error al convertir Data URL a File:", e); return null; }
    }

    // --- Lógica del Canvas de Firma (sin cambios) ---
    const ctx = firmaCanvas.getContext('2d');
    function setupCanvas(){
      const modalBody = firmaModal.querySelector('.modal-body');
      if (!modalBody) return;
      const rect = modalBody.getBoundingClientRect();
      const style = window.getComputedStyle(modalBody);
      const paddingLeft = parseFloat(style.paddingLeft);
      const paddingRight = parseFloat(style.paddingRight);
      const displayW = rect.width - paddingLeft - paddingRight;
      const displayH = 200; 
      const ratio = window.devicePixelRatio || 1;
      firmaCanvas.style.width = displayW + 'px';
      firmaCanvas.style.height = displayH + 'px';
      firmaCanvas.width = Math.floor(displayW * ratio);
      firmaCanvas.height = Math.floor(displayH * ratio);
      ctx.setTransform(1,0,0,1,0,0);
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      clearCanvas();
    }
    let hasSigned = false;
    function clearCanvas(){
      ctx.clearRect(0,0,firmaCanvas.width, firmaCanvas.height);
      ctx.save();
      ctx.strokeStyle = '#cfe6ff';
      ctx.setLineDash([6,6]);
      const w = (firmaCanvas.width/(window.devicePixelRatio||1)) -12;
      const h = (firmaCanvas.height/(window.devicePixelRatio||1)) -12;
      ctx.strokeRect(6,6, w, h);
      ctx.restore();
      hasSigned = false; 
    }
    const observer = new MutationObserver((mutations) => {
      for (let mutation of mutations) {
        if (mutation.attributeName === 'class') {
          const isHidden = firmaModal.classList.contains('hidden');
          if (!isHidden) { setupCanvas(); }
        }
      }
    });
    observer.observe(firmaModal, { attributes: true });
    let drawing=false;
    function getPos(e){
      const r = firmaCanvas.getBoundingClientRect();
      let clientX, clientY;
      if(e.touches && e.touches[0]){ clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
      else { clientX = e.clientX; clientY = e.clientY; }
      return { x: clientX - r.left, y: clientY - r.top };
    }
    function pointerDown(e){ e.preventDefault(); drawing = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
    function pointerMove(e){ if(!drawing) return; e.preventDefault(); const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.strokeStyle = '#05304b'; ctx.stroke(); hasSigned = true; }
    function pointerUp(e){ drawing = false; }
    firmaCanvas.addEventListener('touchstart', pointerDown, {passive:false});
    firmaCanvas.addEventListener('touchmove', pointerMove, {passive:false});
    firmaCanvas.addEventListener('touchend', pointerUp);
    firmaCanvas.addEventListener('mousedown', pointerDown);
    window.addEventListener('mousemove', pointerMove);
    window.addEventListener('mouseup', pointerUp);
    limpiarFirma.addEventListener('click', ()=>{ clearCanvas(); });

    // --- Lógica de Fotos (sin cambios) ---
    fotoBtn.addEventListener('click', () => { fotoInput.click(); });
    idFotoBtn.addEventListener('click', () => { idFotoInput.click(); });
    fotoInput.addEventListener('change', async (e)=>{
      const f = e.target.files[0];
      if(!f) { fotoPreview.innerHTML=''; return; }
      const url = await fileToDataURL(f);
      fotoPreview.innerHTML = `<img alt="foto paquete" src="${url}">`;
    });
    idFotoInput.addEventListener('change', async (e)=>{
      const f = e.target.files[0];
      if(!f) { idPreview.innerHTML=''; return; }
      const url = await fileToDataURL(f);
      idPreview.innerHTML = `<img alt="foto id" src="${url}">`;
    });

    // --- Lógica de Refresh (MODIFICADA PARA USAR SERVICIO) ---
    async function rebuildAutocomplete(){
      // ¡MODIFICADO! Usa getAllByServicio
      const paqs = await getAllByServicio('paquetes', currentUserService); 
      const doms = await getAllByServicio('domicilios', currentUserService);
      const nombres = new Set(); const paqsTxt = new Set();
      doms.forEach(d=>{ if(d.residentes) d.residentes.forEach(r=>nombres.add(r)); });
      paqs.forEach(p=>{ if(p.nombre) nombres.add(p.nombre); if(p.paqueteria) paqsTxt.add(p.paqueteria); });
      nombresList.innerHTML=''; paqList.innerHTML=''; domList.innerHTML='';
      nombres.forEach(n=>{ const o=document.createElement('option'); o.value=n; nombresList.appendChild(o); });
      paqsTxt.forEach(n=>{ const o=document.createElement('option'); o.value=n; paqList.appendChild(o); });
      doms.forEach(d=>{ const o=document.createElement('option'); o.value=d.calle; domList.appendChild(o); }); 
    }
    async function refreshDomicilios(){
      // ¡MODIFICADO! Usa getAllByServicio
      const doms = await getAllByServicio('domicilios', currentUserService); 
      tablaDomicilios.innerHTML='';
      doms.forEach(d=>{
        const row = document.createElement('div'); row.className='row';
        row.innerHTML = `<div class="info"><strong>${d.calle}</strong><div class="muted">${(d.residentes||[]).join(', ')}</div><div class="telefono"><span class="muted">Tel:</span> ${d.telefono || 'No registrado'}</div></div><div><button class="btn ghost" data-id="${d.id}" data-act="edit">Editar</button></div>`;
        tablaDomicilios.appendChild(row);
      });
    }
    async function refreshPaquetes(){
      // ¡MODIFICADO! Usa getAllByServicio
      const paqs = await getAllByServicio('paquetes', currentUserService); 
      const filter = buscarHist.value.toLowerCase(); const estadoF = filtroEstado.value;
      const desde = fechaDesde.valueAsDate; const hasta = fechaHasta.valueAsDate;
      const rows = paqs.filter(p=>{
        if(filter){ const found = (p.guia||'').toLowerCase().includes(filter) || (p.nombre||'').toLowerCase().includes(filter) || (p.estado||'').toLowerCase().includes(filter) || (p.domicilio||'').toLowerCase().includes(filter); if(!found) return false; }
        if(estadoF && p.estado !== estadoF) return false;
        const fechaPaquete = new Date(p.created);
        if(desde && fechaPaquete < desde) return false;
        if(hasta) { const hastaMañana = new Date(hasta); hastaMañana.setDate(hastaMañana.getDate() + 1); if (fechaPaquete >= hastaMañana) return false; }
        return true;
      }).sort((a,b)=>b.created - a.created);
      historialPaquetes.innerHTML = '';
      const fallbackGuardiaImg = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxZW0iIGhlaWdodD0iMWVtIiB2aWV3Qm94PSIwIDAgMjQgMjQiPjxwYXRoIGZpbGw9ImN1cnJlbnRDb2xvciIgZD0iTTIyIDlpLTJ2MGE1IDUgMCAwIDAtNy4xNi00LjcyTDEyIDEwLjA5TDExLjE2IDQuMjdBNCA0IDAgMCAwIDggNUg1YTMgMyAwIDAgMC0zIDN2MWEzIDMgMCAwIDAgMyAzSDh2N0g2djJoMTJ2LTJoLTJ2LTd6TTkgN2EyIDIgMCAwIDEgMiAyaC43Nkw5LjM4IDdoLjI5em0yIDVWNC4wN2E0IDQgMCAwIDEgMS4xNi00LjcyTDEyIDEwLjA5TDExLjE2IDQuMjdBNCA0IDAgMCAwIDggNUg1YTMgMyAwIDAgMC0zIDN2MWEzIDMgMCAwIDAgMyAzSDh2N0g2djJoMTJ2LTJoLTJ2LTd6TTkgN2EyIDIgMCAwIDEgMiAyaC43Nkw5LjM4IDdoLjI5em0yIDVWNC4wN2E0IDQgMCAwIDEgMS4zOCAxbDIuMjQgNy55M0gxMWExIDEgMCAwIDAtMS0xVjdoMVoiLz48L3N2Zz4=';
      rows.forEach(p=>{
        const card = document.createElement('div'); card.className = `historial-card estado-${p.estado || 'na'}`;
        let thumbsHTML = '';
        if(p.foto){ thumbsHTML += `<img src="${p.foto}" class="thumb" alt="Foto Paquete" data-paquete-id="${p.id}" data-type="foto">`; }
        if(p.idFoto){ thumbsHTML += `<img src="${p.idFoto}" class="thumb" alt="Foto ID" data-paquete-id="${p.id}" data-type="id">`; }
        if(p.firma){ thumbsHTML += `<img src="${p.firma}" class="thumb thumb-firma" alt="Firma" data-paquete-id="${p.id}" data-type="firma">`; }
        let actionsHTML = `<button class="btn ghost" data-id="${p.id}" data-act="view">Ver</button>`;
        if (userRol === 'admin') { actionsHTML += ` <button class="btn danger-ghost" data-id="${p.id}" data-act="delete">Eliminar</button>`; }
        const fotoRecibidoSrc = p.fotoRecibidoPor || fallbackGuardiaImg; const fotoEntregadoSrc = p.fotoEntregadoPor || fallbackGuardiaImg;
        
        card.innerHTML = `<div class="card-header"><strong>${p.domicilio || 'Sin domicilio'}</strong><span class="guia">Guía: ${p.guia || '—'} | Paquetería: ${p.paqueteria || 'N/A'} | Residente: ${p.nombre}</span></div><div class="card-body"><div class="card-section"><span class="label">Estado</span><span class="estado-tag">${p.estado === 'en_caseta' ? 'En Caseta' : 'Entregado'}</span></div>${p.comentarios ? `<div class="card-section"><span class="label">Comentarios</span><p class="comentarios">${p.comentarios}</p></div>` : ''}<div class="card-section"><span class="label">Trazabilidad</span><div class="trazabilidad"><div class="guardia-info"><img src="${fotoRecibidoSrc}" alt="Guardia que recibió" class="guardia-thumb"><div class="guardia-info-texto"><strong>Recibió:</strong> ${p.recibidoPor || '-'}<span class="fecha">${formatDate(p.created)}</span></div></div>${p.entregadoEn ? `<div class="guardia-info"><img src="${fotoEntregadoSrc}" alt="Guardia que entregó" class="guardia-thumb"><div class="guardia-info-texto"><strong>Entregó:</strong> ${p.entregadoPor || '-'}<span class="fecha">${formatDate(p.entregadoEn)}</span></div></div>` : ''}</div></div>${thumbsHTML ? `<div class="card-section"><span class="label">Galería</span><div class="galeria-thumbs">${thumbsHTML}</div></div>` : ''}</div><div class="card-footer">${actionsHTML}</div>`;

        card.querySelectorAll('.thumb, [data-act="view"]').forEach(el => { el.addEventListener('click', async () => { const id = el.dataset.paqueteId || el.dataset.id; const type = el.dataset.type || 'foto'; const paquete = await getByKey('paquetes', Number(id)); if (paquete) openViewerFor(paquete, type); }); });
        card.querySelectorAll('[data-act="delete"]').forEach(el => { el.addEventListener('click', async () => { if (userRol !== 'admin') return; const id = Number(el.dataset.id); const p = await getByKey('paquetes', id); if (!p) return; itemToDelete = { type: 'paquete', id: p.id }; deleteConfirmMsg.textContent = `¿Estás seguro de eliminar el paquete con guía ${p.guia} para ${p.nombre}? Esta acción no se puede deshacer.`; deleteConfirmModal.classList.remove('hidden'); }); });
        historialPaquetes.appendChild(card);
      });
      const totalMostrados = rows.length; const enCasetaMostrados = rows.filter(p => p.estado === 'en_caseta').length;
      historialContador.textContent = `Mostrando: ${totalMostrados} paquetes | En Caseta (filtrados): ${enCasetaMostrados}`;
    }
    function formatDate(ts){ if(!ts) return '-'; const d = new Date(ts); return d.toLocaleString(); }
    function formatLabelDate(dateString) { if (!dateString) return null; try { const parts = dateString.split('-'); const year = parseInt(parts[0], 10); const month = parseInt(parts[1], 10); const day = parseInt(parts[2], 10); const shortYear = year.toString().slice(-2); return `${day}/${month}/${shortYear}`; } catch (e) { return dateString; } }

    await rebuildAutocomplete(); await refreshDomicilios(); await refreshPaquetes();

    // --- Lógica de Sugerencias (MODIFICADA) ---
    guiaEl.addEventListener('input', async ()=>{
      clearMessage(); 
      const q = guiaEl.value.trim().toLowerCase();
      guiaSuggestions.innerHTML = '';
      if(!q) return;
      // ¡MODIFICADO! Usa getAllByServicio
      const paqs = await getAllByServicio('paquetes', currentUserService);
      const matches = paqs.filter(p => p.estado === 'en_caseta' && ((p.guia||'').toLowerCase().includes(q) || (p.nombre||'').toLowerCase().includes(q)));
      if(matches.length){
        const ul = document.createElement('ul');
        matches.slice(0,8).forEach(m=>{
          const li = document.createElement('li');
          li.textContent = `${m.guia} · ${m.nombre} · ${m.paqueteria||''}`;
          li.addEventListener('click', async ()=>{
            guiaEl.value = m.guia;
            nombreDest.value = m.nombre || '';
            paqueteriaInput.value = m.paqueteria || '';
            domicilioInput.value = m.domicilio || '';
            comentariosPaquete.value = m.comentarios || ''; 
            guiaSuggestions.innerHTML = '';
            if (m.foto) { fotoPreview.innerHTML = `<img alt="foto paquete existente" src="${m.foto}">`; } else { fotoPreview.innerHTML = ''; }
            fotoInput.value = ''; 
          });
          ul.appendChild(li);
        });
        guiaSuggestions.appendChild(ul);
      }
    });

    // --- Lógica de entrega múltiple (MODIFICADA) ---
    const handleDomicilioInput = async () => {
      const dom = domicilioInput.value.trim();
      const domLower = dom.toLowerCase();
      
      if (!dom) { return; }
      if (!confirmEntregarModal.classList.contains('hidden') || !confirmEntregarVariosModal.classList.contains('hidden') || !firmaModal.classList.contains('hidden')) { return; }
      if (guiaEl.value.trim().length > 0) { return; }
      
      // ¡MODIFICADO! Usa getAllByServicio
      const paqs = await getAllByServicio('paquetes', currentUserService);
      
      const paquetesParaEntregar = paqs.filter(p => 
        p.domicilio && 
        p.domicilio.toLowerCase().includes(domLower) && 
        p.estado === 'en_caseta'
      );
      
      if (paquetesParaEntregar.length > 0) {
        currentBatchToDeliver = paquetesParaEntregar;
        const primerDomicilio = paquetesParaEntregar[0].domicilio;
        const paquetesDelMismoDomicilio = paquetesParaEntregar.filter(p => p.domicilio === primerDomicilio);
        
        domicilioVariosTxt.textContent = primerDomicilio; 
        
        listaPaquetesVarios.innerHTML = '<ul>' + paquetesDelMismoDomicilio.map(p => {
            const fotoMiniatura = p.foto ? `<img src="${p.foto}" class="thumb-miniatura" data-paquete-id="${p.id}" data-type="foto" alt="foto paquete">` : '';
            return `<li style="display: flex; align-items: center; gap: 8px;">${fotoMiniatura}<div><strong>${p.guia}</strong> - ${p.nombre}<div class="info-paquete">${p.paqueteria || 'Sin paquetería'} | Recibido: ${formatDate(p.created)}</div></div></li>`;
          }).join('') + '</ul>';
        
        confirmEntregarVariosModal.classList.remove('hidden');
      }
    };
    const debouncedDomicilioSearch = () => {
      clearTimeout(domicilioDebounceTimer);
      domicilioDebounceTimer = setTimeout(handleDomicilioInput, 1000);
    };
    domicilioInput.addEventListener('input', debouncedDomicilioSearch);
    domicilioInput.addEventListener('paste', debouncedDomicilioSearch);
    domicilioInput.addEventListener('change', debouncedDomicilioSearch);
    
    listaPaquetesVarios.addEventListener('click', (e) => {
      const target = e.target;
      if (target.classList.contains('thumb-miniatura')) {
        const paqueteId = Number(target.dataset.paqueteId);
        const tipoFoto = target.dataset.type;
        const paquete = currentBatchToDeliver.find(p => p.id === paqueteId);
        if (paquete) { openViewerFor(paquete, tipoFoto); }
      }
    });

    // --- RECIBIR PAQUETE (MODIFICADO CON SYNC) ---
    recibirBtn.addEventListener('click', async ()=>{
      clearMessage();
      const guia = guiaEl.value.trim();
      const nombre = nombreDest.value.trim();
      const comentarios = comentariosPaquete.value.trim(); 
      const fotoActual = fotoInput.files[0]; 
      const fotoExistente = fotoPreview.querySelector('img') ? fotoPreview.querySelector('img').src : null; 
      if(!guia || !nombre){ showMessage('Guía y nombre son obligatorios', 'error'); return; }
      if (!fotoActual && !fotoExistente) { showMessage('Es obligatorio tomar foto del paquete', 'error'); return; }
      showMessage('Guardando paquete...', 'loading', 0);
      
      // ¡MODIFICADO! Usa getAllByServicio
      const paqs = await getAllByServicio('paquetes', currentUserService);
      const p = paqs.find(x => x.guia === guia);
      if (p && p.estado === 'entregado') { showMessage('Ese paquete ya fue entregado', 'error'); return; }
      
      const fotoDataURL = fotoActual ? await compressImage(fotoActual) : fotoExistente;
      
      const paqueteData = { 
        guia, nombre, 
        paqueteria: paqueteriaInput.value, 
        domicilio: domicilioInput.value, 
        foto: fotoDataURL, 
        estado: 'en_caseta', 
        created: Date.now(), 
        recibidoPor: user.nombre, 
        fotoRecibidoPor: userFoto, 
        comentarios: comentarios, 
        entregadoPor: null, fotoEntregadoPor: null, entregadoEn: null, firma: null, idFoto: null,
        servicio: currentUserService // ¡IMPORTANTE!
      };

      try{
        let localId;
        let action;
        
        if(p) {
          // Actualizar paquete existente
          action = 'update';
          paqueteData.id = p.id;
          localId = p.id;
          await putItem('paquetes', paqueteData);
        } else {
          // Añadir paquete nuevo
          action = 'add';
          localId = await addItem('paquetes', paqueteData);
          paqueteData.id = localId; // Añadimos el ID local al payload
          
          // Añadir al historial local
          const histData = {
            paqueteId:localId, 
            estado:'en_caseta', 
            usuario:user.nombre, 
            fecha:Date.now(),
            nota:'',
            servicio: currentUserService // ¡IMPORTANTE!
          };
          const histId = await addItem('historial', histData);
          histData.id = histId;
          
          // Sincronizar historial
          if (isOnline && supabase) {
            supabase.from('historial').insert(histData).then(({ error }) => {
              if (error) {
                console.error("Error sync (add historial):", error);
                addItemToSyncQueue('add', 'historial', histData);
              }
            });
          } else {
            await addItemToSyncQueue('add', 'historial', histData);
          }
        }
        
        // Sincronizar paquete
        if (isOnline && supabase) {
          const supabasePayload = { ...paqueteData };
          supabasePayload.id = localId;

          if (action === 'add') {
            const { error } = await supabase.from('paquetes').upsert(supabasePayload);
             if (error) {
                console.error("Error sync (add paquete):", error);
                await addItemToSyncQueue('add', 'paquetes', paqueteData);
             }
          } else {
            const { error } = await supabase.from('paquetes').update(supabasePayload).eq('id', localId);
            if (error) {
                console.error("Error sync (update paquete):", error);
                await addItemToSyncQueue('update', 'paquetes', paqueteData);
            }
          }
        } else {
          await addItemToSyncQueue(action, 'paquetes', paqueteData);
        }

        // --- Lógica de Notificación (sin cambios) ---
        let notified = false;
        if (notificarSi.checked) {
          const dom = domicilioInput.value.trim(); let domInfo = null;
          if (dom) { const doms = await getAllByServicio('domicilios', currentUserService); domInfo = doms.find(d => d.calle === dom); }
          const nombreRes = nombreDest.value.trim() || `residente del ${dom}`;
          const paqInfo = `Paquete: ${paqueteriaInput.value || 'N/A'}\nGuía: ${guia}`;
          const domInfoMsg = `Domicilio: ${dom || 'No especificado'}`;
          const comentariosMsg = comentarios ? `\nComentarios: ${comentarios}` : '';
          const msg = `📦 *PAQUETE EN CASETA* 📦\nHola ${nombreRes}, se ha recibido 1 paquete para su domicilio.\n\n${domInfoMsg}\n${paqInfo}${comentariosMsg}\n\nRecibido por: ${user.nombre}.`;
          
          const fotoFile = dataURLtoFile(fotoDataURL, `paquete_${guia}.png`);
          const bannerDataURL = await createBannerImage('✅ Paquete en Caseta ✅');
          const bannerFile = dataURLtoFile(bannerDataURL, 'notificacion.png');
          const files = [];
          if (bannerFile) { files.push(bannerFile); }
          if (fotoFile) { files.push(fotoFile); }
          const shareDataWithFiles = { text: msg, files: files };
          const shareDataTextOnly = { text: msg };
          let canShareFiles = false;
          if (navigator.canShare && files.length > 1) { 
            try { if (navigator.canShare(shareDataWithFiles)) { canShareFiles = true; } } 
            catch (e) { console.warn("Error chequeando canShare con archivos:", e); canShareFiles = false; }
          }
          if (canShareFiles) {
            try { await navigator.share(shareDataWithFiles); notified = true; } 
            catch (err) {
              console.warn("Web Share API (con 2 archivos) falló:", err); notified = false; 
              if (err.name !== 'AbortError' && domInfo && domInfo.telefono) { const url = `https://wa.me/${domInfo.telefono}?text=${encodeURIComponent(msg)}`; window.open(url, '_blank'); notified = true; }
            }
          } 
          else if (navigator.canShare && navigator.canShare(shareDataTextOnly)) {
             console.warn("No se pueden compartir archivos, compartiendo solo texto.");
             try { await navigator.share(shareDataTextOnly); notified = true; } 
             catch(err) { if (err.name !== 'AbortError' && domInfo && domInfo.telefono) { const url = `https://wa.me/${domInfo.telefono}?text=${encodeURIComponent(msg)}`; window.open(url, '_blank'); notified = true;} }
          }
          else if (domInfo && domInfo.telefono) { console.log("Web Share API no soportada, usando fallback de WA."); const url = `https://wa.me/${domInfo.telefono}?text=${encodeURIComponent(msg)}`; window.open(url, '_blank'); notified = true; }
        } 
        
        if(notified) { showMessage(p ? 'Paquete actualizado (Abriendo app...)' : 'Paquete registrado (Abriendo app...)', 'success', 4000); } 
        else { showMessage(p ? 'Paquete actualizado' : 'Paquete registrado', 'success'); }
        guiaEl.value=''; nombreDest.value=''; paqueteriaInput.value=''; domicilioInput.value=''; fotoInput.value='';
        comentariosPaquete.value = ''; fotoPreview.innerHTML = ''; notificarSi.checked = true;
        await refreshPaquetes(); await rebuildAutocomplete();
      }catch(err){ const errorMsg = (err.name === 'ConstraintError' || (err.message && err.message.includes('key'))) ? 'Error: Guía duplicada.' : 'Error al guardar.'; showMessage(errorMsg, 'error'); console.error(err); }
    });

    // --- FLUJO DE ENTREGA (MODIFICADO) ---
    entregarBtn.addEventListener('click', async ()=>{
      clearMessage(); currentBatchToDeliver = []; 
      const guia = guiaEl.value.trim();
      if(!guia){ showMessage('Escribe la guía del paquete a entregar', 'error'); return; }
      
      // ¡MODIFICADO! Usa getAllByServicio
      const paqs = await getAllByServicio('paquetes', currentUserService);
      const p = paqs.find(x=>x.guia===guia);
      if(!p){ showMessage('Paquete no encontrado', 'error'); return; }
      if (p.estado === 'entregado') { showMessage('Ese paquete ya fue entregado', 'error'); return; }
      confirmEntregarMsg.textContent = `¿Estás seguro de entregar el paquete ${p.guia} a ${p.nombre}?`;
      confirmEntregarModal.classList.remove('hidden');
    });
    cancelEntregarBtn.addEventListener('click', () => { confirmEntregarModal.classList.add('hidden'); });
    confirmEntregarBtn.addEventListener('click', () => {
      confirmEntregarModal.classList.add('hidden'); firmaModal.classList.remove('hidden');
      idPreview.innerHTML = ''; idFotoInput.value = ''; notificarEntregaSi.checked = true; clearCanvas();
    });
    cancelVariosBtn.addEventListener('click', () => { confirmEntregarVariosModal.classList.add('hidden'); currentBatchToDeliver = []; });
    confirmVariosBtn.addEventListener('click', () => {
      confirmEntregarVariosModal.classList.add('hidden'); firmaModal.classList.remove('hidden');
      idPreview.innerHTML = ''; idFotoInput.value = ''; notificarEntregaSi.checked = true; clearCanvas();
    });

    // --- MODAL DE FIRMA (MODIFICADO CON SYNC) ---
    cerrarFirma.addEventListener('click', () => { firmaModal.classList.add('hidden'); currentBatchToDeliver = []; });
    guardarFirma.addEventListener('click', async ()=>{
      const idFotoFile = idFotoInput.files[0]; const idFotoPreviewSrc = idPreview.querySelector('img') ? idPreview.querySelector('img').src : null;
      if (!idFotoFile && !idFotoPreviewSrc) { showMessage('Es obligatorio tomar foto de ID', 'error'); return; }
      if (!hasSigned) { showMessage('Es obligatorio firmar en el recuadro', 'error'); return; }
      showMessage('Guardando firma y entrega...', 'loading', 0);
      
      const firmaDataURL = firmaCanvas.toDataURL('image/png');
      const idFotoDataURL = idFotoFile ? await compressImage(idFotoFile) : idFotoPreviewSrc;
      const entregadoPor = user.nombre; 
      const entregadoEn = Date.now();
      
      let notified = false; let domInfo = null; let msg = ""; let shareTitle = ""; let comentarios = "";
      
      // --- Lógica para Múltiples Paquetes ---
      if (currentBatchToDeliver.length > 0) {
        const dom = currentBatchToDeliver[0].domicilio; comentarios = currentBatchToDeliver[0].comentarios || ""; 
        try {
          for (const p of currentBatchToDeliver) {
            p.estado = 'entregado'; p.firma = firmaDataURL; p.idFoto = idFotoDataURL; p.entregadoPor = entregadoPor; p.entregadoEn = entregadoEn; p.fotoEntregadoPor = userFoto; 
            
            // 1. Actualizar en IndexedDB
            await putItem('paquetes', p);
            
            // 2. Crear historial en IndexedDB
            const histData = {paqueteId:p.id, estado:'entregado', usuario:entregadoPor, fecha:entregadoEn, nota:'Entrega en lote', servicio: currentUserService};
            const histId = await addItem('historial', histData);
            histData.id = histId;
            
            // 3. Sincronizar (o encolar)
            if (isOnline && supabase) {
              supabase.from('paquetes').update(p).eq('id', p.id).then(({error}) => {
                 if (error) { console.error('Error sync (update paquete lote):', error); addItemToSyncQueue('update', 'paquetes', p); }
              });
              supabase.from('historial').insert(histData).then(({error}) => {
                 if (error) { console.error('Error sync (add historial lote):', error); addItemToSyncQueue('add', 'historial', histData); }
              });
            } else {
              await addItemToSyncQueue('update', 'paquetes', p);
              await addItemToSyncQueue('add', 'historial', histData);
            }
          }
          if (dom) { const doms = await getAllByServicio('domicilios', currentUserService); domInfo = doms.find(d => d.calle === dom); }
          const comentariosMsg = comentarios ? `\nComentarios: ${comentarios}` : '';
          msg = `✅ *PAQUETES ENTREGADOS* ✅\nHola residente del ${dom}, se han entregado ${currentBatchToDeliver.length} paquetes en su domicilio.${comentariosMsg}\n\nEntregado por: ${user.nombre}.`;
          shareTitle = "Paquetes Entregados";
        } catch (err) { showMessage('Error al guardar entrega múltiple', 'error'); console.error(err); return; }
        currentBatchToDeliver = []; 
        
      // --- Lógica para Paquete Individual ---
      } else {
        try {
          const guia = guiaEl.value.trim(); 
          const p = await getByKey('paquetes', (await getByIndex('paquetes', 'guia', guia)).id);
          
          if(!p || p.servicio !== currentUserService){ firmaModal.classList.add('hidden'); showMessage('Paquete no encontrado', 'error'); return; }
          if (p.estado === 'entregado') { firmaModal.classList.add('hidden'); showMessage('Ese paquete ya fue entregado', 'error'); return; }
          
          p.estado = 'entregado'; p.firma = firmaDataURL; p.idFoto = idFotoDataURL; p.entregadoPor = entregadoPor; p.entregadoEn = entregadoEn; p.fotoEntregadoPor = userFoto;
          
          // 1. Actualizar en IndexedDB
          await putItem('paquetes', p);
          
          // 2. Crear historial en IndexedDB
          const histData = {paqueteId:p.id, estado:'entregado', usuario:entregadoPor, fecha:entregadoEn, nota:'', servicio: currentUserService};
          const histId = await addItem('historial', histData);
          histData.id = histId;

          // 3. Sincronizar (o encolar)
          if (isOnline && supabase) {
             supabase.from('paquetes').update(p).eq('id', p.id).then(({error}) => {
                 if (error) { console.error('Error sync (update paquete):', error); addItemToSyncQueue('update', 'paquetes', p); }
              });
             supabase.from('historial').insert(histData).then(({error}) => {
                 if (error) { console.error('Error sync (add historial):', error); addItemToSyncQueue('add', 'historial', histData); }
              });
          } else {
            await addItemToSyncQueue('update', 'paquetes', p);
            await addItemToSyncQueue('add', 'historial', histData);
          }

          comentarios = p.comentarios || ""; const dom = p.domicilio;
          if (dom) { const doms = await getAllByServicio('domicilios', currentUserService); domInfo = doms.find(d => d.calle === dom); }
          const comentariosMsg = comentarios ? `\nComentarios: ${comentarios}` : '';
          msg = `✅ *PAQUETE ENTREGADO* ✅\nHola ${p.nombre}, se ha entregado su paquete (Guía: ${p.guia}).${comentariosMsg}\n\nEntregado por: ${user.nombre}.`;
          shareTitle = "Paquete Entregado";
        } catch (err) { showMessage('Error al guardar la entrega', 'error'); console.error(err); return; }
      }
      
      // --- Lógica de Notificación (sin cambios) ---
      if (notificarEntregaSi.checked) {
        const firmaFile = dataURLtoFile(firmaDataURL, `firma_entrega.png`); const idFile = dataURLtoFile(idFotoDataURL, `id_entrega.png`);
        const files = [];
        if (firmaFile) files.push(firmaFile); 
        if (idFile) files.push(idFile);
        const shareDataWithFiles = { text: msg, files: files };
        const shareDataTextOnly = { text: msg };
        let canShareFiles = false;
        if (navigator.canShare && files.length > 1) { 
            try { if (navigator.canShare(shareDataWithFiles)) { canShareFiles = true; } } 
            catch (e) { console.warn("Error chequeando canShare con archivos (entrega):", e); canShareFiles = false; }
        }
        if (canShareFiles) {
          try { await navigator.share(shareDataWithFiles); notified = true; } 
          catch (err) {
            console.warn("Web Share API (con 2 archivos) falló:", err); notified = false;
            if (err.name !== 'AbortError' && domInfo && domInfo.telefono) { const url = `https://wa.me/${domInfo.telefono}?text=${encodeURIComponent(msg)}`; window.open(url, '_blank'); notified = true; }
          }
        }
        else if (navigator.canShare && navigator.canShare(shareDataTextOnly)) {
           console.warn("No se pueden compartir archivos (entrega), compartiendo solo texto.");
           try { await navigator.share(shareDataTextOnly); notified = true; } 
           catch(err) { if (err.name !== 'AbortError' && domInfo && domInfo.telefono) { const url = `https://wa.me/${domInfo.telefono}?text=${encodeURIComponent(msg)}`; window.open(url, '_blank'); notified = true;} }
        }
        else if (domInfo && domInfo.telefono) { console.log("Web Share API no soportada (entrega), usando fallback de WA."); const url = `https://wa.me/${domInfo.telefono}?text=${encodeURIComponent(msg)}`; window.open(url, '_blank'); notified = true; }
      } 
      
      if (notified) { showMessage('Entrega guardada. (Abriendo app...)', 'success', 4000); } 
      else { showMessage('Entrega guardada exitosamente', 'success'); }
      firmaModal.classList.add('hidden');
      guiaEl.value=''; nombreDest.value=''; paqueteriaInput.value=''; domicilioInput.value=''; fotoInput.value='';
      comentariosPaquete.value = ''; fotoPreview.innerHTML = ''; idPreview.innerHTML = ''; idFotoInput.value = '';
      hasSigned = false; entregarVariosBtn.disabled = true; entregarVariosBtn.textContent = 'Entregar (Varios)';
      await refreshPaquetes();
    });

    // --- GUARDAR DOMICILIO (MODIFICADO CON SYNC) ---
    domForm.addEventListener('submit', async (e)=>{
      e.preventDefault(); clearMessage();
      const calle = document.getElementById('domCalle').value.trim(); const res1 = document.getElementById('domResidente1').value.trim();
      const nota = document.getElementById('domNota').value.trim(); const telefono = document.getElementById('domTelefono').value.trim();
      const cleanPhone = telefono.replace(/[^0-9]/g, ''); 
      if(telefono && (!cleanPhone || cleanPhone.length < 10)) { showMessage('Teléfono inválido. Use solo números.', 'error'); return; }
      const otros = Array.from(document.querySelectorAll('.residenteField')).map(i=>i.value.trim()).filter(Boolean);
      const residentes = [res1, ...otros];
      showMessage('Guardando domicilio...', 'loading', 0);
      
      const domData = {
        calle, residentes, nota, 
        telefono: cleanPhone, 
        created:Date.now(),
        servicio: currentUserService // ¡IMPORTANTE!
      };

      try{
        // 1. Guardar en IndexedDB
        const localId = await addItem('domicilios', domData);
        domData.id = localId; // Añadir ID local
        
        // 2. Sincronizar (o encolar)
        if (isOnline && supabase) {
          supabase.from('domicilios').insert(domData).then(({error}) => {
             if (error) { console.error('Error sync (add domicilio):', error); addItemToSyncQueue('add', 'domicilios', domData); }
          });
        } else {
          await addItemToSyncQueue('add', 'domicilios', domData);
        }

        showMessage('Domicilio guardado', 'success');
        domForm.reset(); moreResidents.innerHTML='';
        await refreshDomicilios(); await rebuildAutocomplete();
      }catch(err){ showMessage('Error al guardar domicilio', 'error'); console.error(err); }
    });

    // --- Lógica de Tablas (MODIFICADA CON SYNC) ---
    tablaDomicilios.addEventListener('click', async (e)=>{
      const act = e.target.dataset.act; const id = Number(e.target.dataset.id);
      if(act==='edit'){
        // getByKey sigue funcionando porque es por PK
        const d = await getByKey('domicilios', id); if(!d) return;
        document.getElementById('domCalle').value = d.calle;
        document.getElementById('domResidente1').value = (d.residentes && d.residentes[0]) || '';
        document.getElementById('domNota').value = d.nota || '';
        document.getElementById('domTelefono').value = d.telefono || '';
        showMessage('Datos cargados para editar.', 'info', 2000);
      }
    });
    deleteCancelBtn.addEventListener('click', () => { deleteConfirmModal.classList.add('hidden'); itemToDelete = { type: null, id: null }; });
    deleteConfirmBtn.addEventListener('click', async () => {
      if (userRol !== 'admin' || !itemToDelete.id) return;
      if (itemToDelete.type === 'usuario' && itemToDelete.id === user.id) {
         showMessage('No puedes eliminar tu propia cuenta', 'error');
         deleteConfirmModal.classList.add('hidden'); itemToDelete = { type: null, id: null }; return;
      }
      showMessage('Eliminando registro...', 'loading', 0);
      deleteConfirmModal.classList.add('hidden');
      
      try {
        // 1. Eliminar de IndexedDB
        await deleteItem(itemToDelete.type === 'paquete' ? 'paquetes' : 'users', itemToDelete.id);
        
        // 2. Sincronizar (o encolar)
        const storeName = itemToDelete.type === 'paquete' ? 'paquetes' : 'users';
        const deletePayload = { id: itemToDelete.id };
        
        if (isOnline && supabase) {
           supabase.from(storeName).delete().eq('id', itemToDelete.id).then(({error}) => {
             if (error) { console.error(`Error sync (delete ${storeName}):`, error); addItemToSyncQueue('delete', storeName, deletePayload); }
           });
        } else {
          await addItemToSyncQueue('delete', storeName, deletePayload);
        }

        // 3. Refrescar UI
        if (itemToDelete.type === 'paquete') { await refreshPaquetes(); } 
        else if (itemToDelete.type === 'usuario') { await refreshUsuarios(); }
        
        showMessage('Registro eliminado exitosamente', 'success');
      } catch (err) { showMessage('Error al eliminar el registro', 'error'); console.error(err); }
      itemToDelete = { type: null, id: null };
    });

    // --- Lógica del Visor (sin cambios) ---
    let currentGallery = []; let currentIndex = 0;
    function openViewerFor(p, type){
      currentGallery = [];
      if(p.foto) currentGallery.push({src:p.foto, meta:`Foto paquete — ${p.guia}`});
      if(p.idFoto) currentGallery.push({src:p.idFoto, meta:`ID — ${p.guia}`});
      if(p.firma) currentGallery.push({src:p.firma, meta:`Firma — ${p.guia}`});
      if(currentGallery.length===0) return;
      let desiredIndex = 0;
      if (type === 'id' && p.idFoto) { desiredIndex = currentGallery.findIndex(x => x.meta.startsWith('ID')); } 
      else if (type === 'firma' && p.firma) { desiredIndex = currentGallery.findIndex(x => x.meta.startsWith('Firma')); }
      currentIndex = desiredIndex >= 0 ? desiredIndex : 0;
      showGalleryImage(); imageViewer.classList.remove('hidden');
    }
    function showGalleryImage(){ const item = currentGallery[currentIndex]; if(!item) return; viewerImg.src = item.src; viewerMeta.textContent = item.meta; }
    prevImg.addEventListener('click', ()=>{ if(currentGallery.length===0) return; currentIndex = (currentIndex - 1 + currentGallery.length) % currentGallery.length; showGalleryImage(); });
    nextImg.addEventListener('click', ()=>{ if(currentGallery.length===0) return; currentIndex = (currentIndex + 1) % currentGallery.length; showGalleryImage(); });
    closeImageViewer.addEventListener('click', ()=>{ imageViewer.classList.add('hidden'); viewerImg.src=''; });

    // --- Lógica de Filtros (sin cambios) ---
    buscarHist.addEventListener('input', refreshPaquetes);
    filtroEstado.addEventListener('change', refreshPaquetes);
    fechaDesde.addEventListener('change', (e) => { const formatted = formatLabelDate(e.target.value); const labelElement = e.target.parentElement; if (formatted) { fechaDesdeLabel.textContent = formatted; labelElement.classList.add('has-value'); } else { fechaDesdeLabel.textContent = '🗓️ Desde'; labelElement.classList.remove('has-value'); } refreshPaquetes(); });
    fechaHasta.addEventListener('change', (e) => { const formatted = formatLabelDate(e.target.value); const labelElement = e.target.parentElement; if (formatted) { fechaHastaLabel.textContent = formatted; labelElement.classList.add('has-value'); } else { fechaHastaLabel.textContent = '🗓️ Hasta'; labelElement.classList.remove('has-value'); } refreshPaquetes(); });
    
    // --- Lógica del Escáner (sin cambios) ---
    let isScannerActive = false; let cameraStream = null; let zxingCodeReader = null; let barcodeDetector = null; let scanAnimationFrame = null; 
    function onCodeDetected(code) {
      if (!isScannerActive || !code) return;
      console.log("Código detectado:", code);
      if (guiaEl) { guiaEl.value = code; }
      stopScanner();
      showToast(`Código escaneado`, 'success');
      if (guiaEl) { guiaEl.dispatchEvent(new Event('input', { bubbles: true })); }
    }
    function stopScanner() {
      if (!isScannerActive) return;
      isScannerActive = false;
      if (zxingCodeReader) { zxingCodeReader.reset(); zxingCodeReader = null; }
      if (scanAnimationFrame) { cancelAnimationFrame(scanAnimationFrame); scanAnimationFrame = null; }
      barcodeDetector = null;
      if (cameraStream) { cameraStream.getTracks().forEach(track => track.stop()); cameraStream = null; }
      if (scannerVideo) { scannerVideo.srcObject = null; }
      scannerModal.classList.add('hidden');
      scannerStatus.textContent = 'Iniciando cámara...';
      console.log("Escáner detenido.");
    }
    if (stopScannerBtn) { stopScannerBtn.addEventListener('click', stopScanner); }
    if (startScannerBtn) {
      startScannerBtn.addEventListener('click', async () => {
        if (isScannerActive) return;
        const hasZxing = typeof ZXing !== 'undefined';
        const hasBarcodeDetector = typeof window.BarcodeDetector !== 'undefined';
        if (!hasZxing && !hasBarcodeDetector) { showToast('Error: Librería de escáner no cargó.', 'error'); console.error("No se encontró ni ZXing ni BarcodeDetector."); return; }
        scannerModal.classList.remove('hidden'); isScannerActive = true; scannerStatus.textContent = 'Solicitando cámara...';
        try {
          const constraints = { video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } };
          cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
          scannerVideo.srcObject = cameraStream;
          scannerVideo.play().catch(e => console.error("Error al reproducir video", e));
          scannerStatus.textContent = 'Apunte al código...';
          if (hasBarcodeDetector) {
            console.log("Usando API nativa: BarcodeDetector");
            barcodeDetector = new window.BarcodeDetector();
            const scanFrame = async () => {
              if (!isScannerActive || !barcodeDetector) return;
              try {
                if (scannerVideo.readyState >= 2) { 
                  const barcodes = await barcodeDetector.detect(scannerVideo);
                  if (barcodes.length > 0) { onCodeDetected(barcodes[0].rawValue); } 
                  else { scanAnimationFrame = requestAnimationFrame(scanFrame); }
                } else { scanAnimationFrame = requestAnimationFrame(scanFrame); }
              } catch (e) { console.error("Error en frame de BarcodeDetector:", e); if (isScannerActive) { scanAnimationFrame = requestAnimationFrame(scanFrame); } }
            };
            scanFrame();
          } else if (hasZxing) {
            console.log("Usando fallback: ZXing-js");
            zxingCodeReader = new ZXing.BrowserMultiFormatReader();
            zxingCodeReader.decodeFromStream(cameraStream, scannerVideo, (result, err) => {
              if (result) { onCodeDetected(result.getText()); }
              if (err && !(err instanceof ZXing.NotFoundException)) { console.error("Error de ZXing:", err); }
            });
          }
        } catch (err) {
          console.error("Error al iniciar el escáner:", err);
          let errorMsg = "Error al iniciar escáner.";
          if (err.name === 'NotAllowedError' || err.toString().includes('Permission')) { errorMsg = "Permiso de cámara denegado."; } 
          else if (err.name === 'NotFoundError' || err.name === 'NotReadableError') { errorMsg = "No se encontró cámara."; }
          if (location.protocol !== 'https:' && (err.name === 'NotAllowedError' || err.name === 'NotFoundError')) { errorMsg = "Pruebe en un servidor HTTPS (GitHub Pages)."; }
          showToast(errorMsg, 'error', 5000);
          stopScanner(); 
        }
      });
    }
    
    // --- Lógica de Respaldo (MODIFICADA) ---
    exportBackupBtn.addEventListener('click', async () => {
      if (userRol !== 'admin') return;
      showMessage('Generando respaldo (solo este servicio)...', 'loading', 0);
      try {
        const backupData = {
          users: await getAllByServicio('users', currentUserService),
          domicilios: await getAllByServicio('domicilios', currentUserService),
          paquetes: await getAllByServicio('paquetes', currentUserService),
          historial: await getAllByServicio('historial', currentUserService),
          metadata: { version: DB_VERSION, exportedAt: new Date().toISOString(), servicio: currentUserService }
        };
        const jsonString = JSON.stringify(backupData);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const dateStr = new Date().toISOString().split('T')[0];
        a.download = `ctrl_paqueteria_backup_${currentUserService}_${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showMessage('Respaldo exportado exitosamente', 'success');
      } catch (err) {
        showMessage('Error al generar el respaldo', 'error');
        console.error("Error al exportar:", err);
      }
    });
    restoreBackupBtn.addEventListener('click', () => {
      if (userRol !== 'admin') return;
      if (!confirm(`¡ADVERTENCIA!\n\nEsto borrará TODOS los datos locales para el servicio "${currentUserService}" y los reemplazará con los del archivo.\n\n¿Estás seguro de continuar?`)) {
        return;
      }
      restoreBackupInput.click();
    });
    restoreBackupInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      showMessage('Restaurando respaldo...', 'loading', 0);
      try {
        const jsonString = await file.text();
        const backupData = JSON.parse(jsonString);
        if (!backupData.users || !backupData.paquetes || !backupData.domicilios) {
          throw new Error("El archivo de respaldo no es válido.");
        }
        if (backupData.metadata && backupData.metadata.servicio && backupData.metadata.servicio !== currentUserService) {
          throw new Error(`Este respaldo es para el servicio "${backupData.metadata.servicio}". Solo puedes restaurar respaldos para "${currentUserService}".`);
        }
        
        const stores = ['users', 'domicilios', 'paquetes', 'historial'];
        for (const store of stores) {
            const items = await getAllByServicio(store, currentUserService);
            for (const item of items) {
                await deleteItem(store, item.id);
            }
        }
        
        await bulkAdd('users', backupData.users);
        await bulkAdd('domicilios', backupData.domicilios);
        await bulkAdd('paquetes', backupData.paquetes);
        await bulkAdd('historial', backupData.historial);
        
        if(isOnline && supabase) {
          showToast('Restauración local completa. Sincronizando con la nube...', 'loading', 0);
          await synchronizeData(currentUserService, true); // true = forzar push
        }

        showMessage('Restauración completada.', 'success', 2000);
        setTimeout(() => {
          location.reload();
        }, 2100);
      } catch (err) {
        showMessage(`Error al restaurar: ${err.message}`, 'error', 5000);
        console.error("Error al restaurar:", err);
      } finally {
        restoreBackupInput.value = '';
      }
    });

    // --- Funciones Admin (MODIFICADAS) ---
    async function refreshUsuarios() {
      if (userRol !== 'admin') return;
      const users = await getAllByServicio('users', currentUserService);
      tablaUsuarios.innerHTML = '';
      if (users.length === 0) { tablaUsuarios.innerHTML = '<p class="muted">No hay usuarios registrados para este servicio.</p>'; return; }
      users.forEach(u => {
        const row = document.createElement('div'); row.className = 'row';
        row.innerHTML = `<div class="info" style="display: flex; align-items: center; gap: 10px;"><img src="${u.foto || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxZW0iIGhlaWdodD0iMWVtIiB2aWV3Qm94PSIwIDAgMjQgMjUiPjxwYXRoIGZpbGw9ImN1cnJlbnRDb2xvciIgZD0iTTIyIDlpLTJ2MGE1IDUgMCAwIDAtNy4xNi00LjcyTDEyIDEwLjA5TDExLjE2IDQuMjdBNCA0IDAgMCAwIDggNUg1YTMgMyAwIDAgMC0zIDN2MWEzIDMgMCAwIDAgMyAzSDh2N0g2djJoMTJ2LTJoLTJ2LTd6TTkgN2EyIDIgMCAwIDEgMiAyaC43Nkw5LjM4IDdoLjI5em0yIDVWNC4wN2E0IDQgMCAwIDEgMS4zOCAxbDIuMjQgNy55M0gxMWExIDEgMCAwIDAtMS0xVjdoMVoiLz48L3N2Zz4='}" class="guardia-thumb"><div><strong>${u.nombre}</strong><div class="muted">Usuario: ${u.usuario} | Rol: ${u.rol || 'guardia'}</div></div></div><div>${u.id === user.id ? '<span class="muted">(Tú)</span>' : `<button class="btn danger-ghost" data-id="${u.id}" data-act="delete_user">Eliminar</button>`}</div>`;
        tablaUsuarios.appendChild(row);
      });
    }
    tablaUsuarios.addEventListener('click', (e) => {
      const act = e.target.dataset.act; const id = Number(e.target.dataset.id);
      if (act === 'delete_user') {
        if (userRol !== 'admin' || id === user.id) return;
        const u = e.target.closest('.row').querySelector('.info strong').textContent;
        itemToDelete = { type: 'usuario', id: id };
        deleteConfirmMsg.textContent = `¿Estás seguro de eliminar al usuario ${u}? Esta acción no se puede deshacer.`;
        deleteConfirmModal.classList.remove('hidden');
      }
    });
    refreshUsersBtn.addEventListener('click', refreshUsuarios);
    downloadPdfBtn.addEventListener('click', descargarPDF);
    async function descargarPDF() {
      if (userRol !== 'admin' || !jsPDF) { showMessage('Error: La librería PDF no se cargó', 'error'); return; }
      showMessage('Generando PDF (solo este servicio)...', 'loading', 0);
      try {
        const doc = new jsPDF(); 
        const allPaquetes = await getAllByServicio('paquetes', currentUserService); 
        const allDomicilios = await getAllByServicio('domicilios', currentUserService);
        
        const fechaHoy = new Date().toLocaleString();
        doc.setFontSize(18); doc.text(`Reporte de Paquetería (${currentUserService})`, 14, 22); doc.setFontSize(11); doc.setTextColor(100);
        doc.text(`Generado por: ${user.nombre} (${user.rol})`, 14, 28); doc.text(`Fecha: ${fechaHoy}`, 14, 34);
        const enCaseta = allPaquetes.filter(p => p.estado === 'en_caseta');
        doc.autoTable({ startY: 40, head: [['Guía', 'Domicilio', 'Residente', 'Recibido (Fecha)', 'Recibido (Guardia)', 'Comentarios']], body: enCaseta.map(p => [ p.guia, p.domicilio, p.nombre, formatDate(p.created), p.recibidoPor, p.comentarios || '-' ]), headStyles: { fillColor: [11, 58, 102] }, didDrawPage: (data) => { doc.setFontSize(16); doc.text('Paquetes Actualmente en Caseta', data.settings.margin.left, data.settings.top - 10); } });
        const entregados = allPaquetes.filter(p => p.estado === 'entregado').sort((a,b) => b.entregadoEn - a.entregadoEn).slice(0, 50);
        doc.autoTable({ head: [['Guía', 'Domicilio', 'Residente', 'Entregado (Fecha)', 'Entregado (Guardia)', 'Comentarios']], body: entregados.map(p => [ p.guia, p.domicilio, p.nombre, formatDate(p.entregadoEn), p.entregadoPor, p.comentarios || '-' ]), headStyles: { fillColor: [21, 128, 61] }, didDrawPage: (data) => { doc.setFontSize(16); doc.text('Últimos 50 Paquetes Entregados', data.settings.margin.left, data.settings.top - 10); } });
        doc.autoTable({ head: [['Domicilio', 'Residentes', 'Teléfono', 'Nota']], body: allDomicilios.map(d => [ d.calle, (d.residentes || []).join(', '), d.telefono || '-', d.nota || '-' ]), headStyles: { fillColor: [107, 114, 128] }, didDrawPage: (data) => { doc.setFontSize(16); doc.text('Directorio de Domicilios', data.settings.margin.left, data.settings.top - 10); } });
        doc.save(`Reporte_CtrlPaqueteria_${currentUserService}_${new Date().toISOString().split('T')[0]}.pdf`);
        showMessage('PDF generado.', 'success');
      } catch (err) { showMessage('Error al generar el PDF', 'error'); console.error("Error PDF:", err); }
    }
    // --- FIN FUNCIONES ADMIN ---


    // --- ★★★ NUEVA FUNCIÓN DE SINCRONIZACIÓN ★★★ ---
    async function synchronizeData(serviceName = currentUserService, forcePush = false) {
      if (!isOnline || !supabase || isSyncing) {
         if(isSyncing) console.warn("Sincronización ya en progreso.");
         if(!isOnline) console.log("No hay conexión, omitiendo sincronización.");
         if(!supabase) console.log("Supabase no configurado, omitiendo sincronización.");
         return;
      }
      if (!serviceName) {
        console.error("No se puede sincronizar sin un nombre de servicio.");
        return;
      }
      
      isSyncing = true;
      console.log(`Iniciando sincronización para el servicio: ${serviceName}`);
      showToast('Sincronizando...', 'loading', 0);
      
      try {
        // 1. Verificar sesión de Supabase
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error("Sesión de Supabase no válida o expirada.");
        }
        
        // 2. Empujar (PUSH) cambios locales de la cola
        const itemsToSync = await getAll('sync_queue');
        if (itemsToSync.length > 0) {
          console.log(`Enviando ${itemsToSync.length} cambios locales a Supabase...`);
          
          for (const item of itemsToSync) {
            if (item.payload && item.payload.servicio !== serviceName && item.payload.nombre_servicio !== serviceName) {
               console.warn("Omitiendo item de la cola de otro servicio:", item);
               continue;
            }
            
            let error = null;
            try {
              if (item.action === 'add' || item.action === 'update') {
                ({ error } = await supabase.from(item.storeName).upsert(item.payload));
              } 
              else if (item.action === 'delete') {
                ({ error } = await supabase.from(item.storeName).delete().eq('id', item.payload.id));
              }
              
              if (error) {
                throw new Error(error.message);
              } else {
                await deleteItem('sync_queue', item.id);
              }
            } catch (e) {
               console.error(`Error al sincronizar item (ID: ${item.id}, Acción: ${item.action}, Store: ${item.storeName}):`, e);
            }
          }
        } else {
          console.log("No hay cambios locales para enviar.");
        }

        // 3. Descargar (PULL) todos los datos del servicio desde Supabase
        console.log("Descargando datos actualizados de Supabase...");
        
        const storesToSync = ['paquetes', 'domicilios', 'users', 'historial'];
        for (const storeName of storesToSync) {
          const fieldName = (storeName === 'users') ? 'nombre_servicio' : 'servicio';
          
          const { data, error } = await supabase
            .from(storeName)
            .select('*')
            .eq(fieldName, serviceName);

          if (error) {
            throw new Error(`Error descargando ${storeName}: ${error.message}`);
          }
          
          if (data) {
            console.log(`Descargados ${data.length} registros de ${storeName}`);
            const localItems = await getAllByServicio(storeName, serviceName);
            for (const item of localItems) {
              await deleteItem(storeName, item.id);
            }
            await bulkAdd(storeName, data);
          }
        }
        
        console.log("Sincronización completada.");
        showToast('Sincronización completada', 'success');
        
        // 4. Refrescar la UI
        await rebuildAutocomplete();
        await refreshDomicilios();
        await refreshPaquetes();
        if (mainContainer.classList.contains('show-admin')) {
          await refreshUsuarios();
        }

      } catch (err) {
        console.error("Error durante la sincronización:", err);
        showToast(`Error de sincronización: ${err.message}`, 'error', 5000);
        if (err.message.includes("Sesión")) {
          localStorage.removeItem('ctrl_user');
          location.href = 'index.html';
        }
      } finally {
        isSyncing = false;
      }
    }
    
    // Ejecuta la sincronización al cargar la página principal
    if (isOnline) {
      synchronizeData(currentUserService);
    }
  }
})();


