/* app.js v9: +Integración Supabase corregida + Sincronización Cloud + Offline Queue */

(async function(){

  // --- INICIO REGISTRO SERVICE WORKER ---
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(r => console.log('ServiceWorker registrado:', r.scope))
        .catch(e => console.error('Fallo SW:', e));
    });
  }
  // --- FIN SERVICE WORKER ---

  // --- INICIO CONFIGURACIÓN SUPABASE ---
  const SUPABASE_URL = 'https://npqdbaldloistjlbjofg.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wcWRiYWxkbG9pc3RqbGJqb2ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzMDUyNzksImV4cCI6MjA3Nzg4MTI3OX0.kO9brJqFup2Rl_WLoE4TPudweqiioIi4j6DwNUreDwg';

  let supabase = null;

  if (window.supabase && SUPABASE_URL !== 'https://TU_ID_DE_PROYECTO.supabase.co') {
    try {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log("✅ Cliente de Supabase inicializado.");
    } catch (e) {
      console.error("Error inicializando Supabase:", e);
      alert("Error de configuración: No se pudo conectar a Supabase.");
    }
  } 
  else if (!window.supabase) {
    console.error("❌ Supabase SDK no cargado. Asegúrate de incluir @supabase/supabase-js antes de app.js.");
    alert("Error: No se cargó la librería de Supabase. Verifica el orden de los <script>.");
  } 
  else if (SUPABASE_URL === 'https://TU_ID_DE_PROYECTO.supabase.co') {
    console.warn("⚠️ Supabase no está configurado correctamente. Usa tus claves reales en app.js.");
  }

  // --- FIN CONFIGURACIÓN SUPABASE ---

  let isOnline = navigator.onLine;
  window.addEventListener('online', () => { 
    isOnline = true; 
    showToast('Estás en línea. Sincronizando...', 'info'); 
    if(typeof synchronizeData === 'function') synchronizeData(); 
  });
  window.addEventListener('offline', () => { 
    isOnline = false; 
    showToast('Estás sin conexión. Trabajando en modo local.', 'info'); 
  });

  await openDB(); // IndexedDB abierta

  // --- SISTEMA DE TOAST ---
  let toastTimer;
  const toast = document.getElementById('toastNotification');
  const toastIcon = document.getElementById('toastIcon');
  const toastMessage = document.getElementById('toastMessage');
  const ICONS = {
    success:`✅`, error:`❌`, loading:`⏳`, info:`ℹ️`
  };
  function showToast(msg, type='info', dur=3000){
    if(!toast) return;
    clearTimeout(toastTimer);
    toast.className = 'toast-container show ' + type;
    toastMessage.textContent = msg;
    toastIcon.textContent = ICONS[type] || 'ℹ️';
    if(type!=='loading' && dur>0){
      toastTimer=setTimeout(()=>hideToast(),dur);
    }
  }
  function hideToast(){
    if(!toast) return;
    toast.classList.remove('show');
  }

  // --- UTILIDADES ---
  async function hashText(text){
    const data = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  async function fileToDataURL(file){
    return new Promise((res,rej)=>{
      const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file);
    });
  }

  // --- FUNCIÓN DE SINCRONIZACIÓN CON SUPABASE ---
  async function synchronizeData(servicioActual) {
    if (!isOnline || !supabase) {
      console.warn("No se puede sincronizar: offline o sin Supabase.");
      return;
    }

    try {
      showToast('Sincronizando datos...', 'loading', 0);

      // 1️⃣ Obtener usuarios locales pendientes
      const users = await getAllByServicio('users', servicioActual);
      for (const u of users) {
        if (!u.id_auth) {
          console.log("Subiendo usuario a Supabase:", u.nombre);
          const { data, error } = await supabase
            .from('users')
            .insert([{ nombre: u.nombre, rol: u.rol, servicio: u.nombre_servicio }]);
          if (error) console.error("Error subiendo usuario:", error);
        }
      }

      // 2️⃣ Subir paquetes locales pendientes
      const paquetes = await getAllByServicio('paquetes', servicioActual);
      for (const p of paquetes) {
        if (!p.synced) {
          const { error } = await supabase
            .from('paquetes')
            .upsert([{ ...p, servicio: servicioActual }]);
          if (!error) {
            p.synced = true;
            await putItem('paquetes', p);
          }
        }
      }

      // 3️⃣ Descargar nuevos registros desde Supabase (solo los recientes)
      const { data: nuevosPaqs, error: errPaqs } = await supabase
        .from('paquetes')
        .select('*')
        .eq('servicio', servicioActual);

      if (!errPaqs && nuevosPaqs?.length) {
        for (const np of nuevosPaqs) {
          const existe = await query('paquetes', c => c.value.guia === np.guia && c.value.servicio === servicioActual);
          if (!existe.length) await addItem('paquetes', np);
        }
      }

      hideToast();
      showToast('Sincronización completada ✅', 'success', 3000);
    } catch (e) {
      console.error("Error en synchronizeData:", e);
      hideToast();
      showToast('Error al sincronizar: ' + e.message, 'error', 4000);
    }
  }

  // --- LOGIN Y REGISTRO ---
  if(document.body.classList.contains('page-login')){
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    loginForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const usuario = document.getElementById('loginUsuario').value.trim();
      const pass = document.getElementById('loginPass').value;
      const servicio = document.getElementById('loginServicio').value.trim().toLowerCase();

      if(!supabase){ showToast('Modo offline', 'info'); return; }
      showToast('Iniciando sesión...', 'loading', 0);

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: `${usuario}@${servicio}.local`,
          password: pass
        });
        if(error) throw error;

        const user = data.user;
        const meta = user.user_metadata;

        localStorage.setItem('ctrl_user', JSON.stringify({
          id_auth: user.id,
          nombre: meta.nombre,
          rol: meta.rol,
          nombre_servicio: meta.nombre_servicio
        }));

        hideToast();
        showToast('Sesión iniciada ✅', 'success');
        location.href='main.html';
      } catch(err) {
        hideToast();
        showToast('Error: '+err.message, 'error', 4000);
      }
    });

    registerForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const nombre = document.getElementById('regNombre').value.trim();
      const pass = document.getElementById('regPass').value;
      const pass2 = document.getElementById('regPass2').value;
      const servicio = document.getElementById('regServicio').value.trim().toLowerCase();
      const fotoFile = document.getElementById('regFoto').files[0];

      if(pass !== pass2){ showToast('Las contraseñas no coinciden', 'error'); return; }
      if(!fotoFile){ showToast('Debes tomar una foto de perfil', 'error'); return; }
      if(!supabase){ showToast('Supabase no inicializado', 'error'); return; }

      const fotoDataURL = await fileToDataURL(fotoFile);
      showToast('Registrando...', 'loading', 0);

      try {
        const { data, error } = await supabase.auth.signUp({
          email: `${nombre.split(' ')[0].toLowerCase()}@${servicio}.local`,
          password: pass,
          options: {
            data: { nombre, rol: 'guardia', nombre_servicio: servicio, foto: fotoDataURL }
          }
        });
        if(error) throw error;
        hideToast();
        showToast('Registro exitoso ✅', 'success');
        setTimeout(()=>location.href='main.html',1500);
      } catch(err){
        hideToast();
        showToast('Error: '+err.message, 'error', 4000);
      }
    });
  }

  // --- MAIN PAGE ---
  if(document.body.classList.contains('page-main')){
    const user = JSON.parse(localStorage.getItem('ctrl_user') || 'null');
    if(!user){
      showToast("Sin sesión. Regresando...", 'error');
      setTimeout(()=>location.href='index.html',2000);
      return;
    }

    document.getElementById('saludo').textContent = `Buen turno, ${user.nombre} (${user.nombre_servicio})`;

    document.getElementById('logoutBtn').onclick = async ()=>{
      if(supabase) await supabase.auth.signOut();
      localStorage.removeItem('ctrl_user');
      location.href='index.html';
    };

    if(isOnline) await synchronizeData(user.nombre_servicio);
  }

})();
