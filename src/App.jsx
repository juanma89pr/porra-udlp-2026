import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, where, query } from 'firebase/firestore';
import { auth, db, storage } from './firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { SUPER_ADMIN_EMAIL, estadoSuscripcionCliente, generarEnlaceRenovacion, calcularStatsProgreso } from './utils/helpers';

import { APP_VERSION } from './version';

// ── Sistema de actualizaciones forzadas ──────────────────────────────────────
// Usa imports estáticos (db ya disponible) en vez de import() dinámico
// que puede fallar antes de que Firebase inicialice
var KEY_VERSION = 'bt_app_version';

var comprobarVersionYActualizar = function() {
  getDoc(doc(db, 'config', 'app')).then(function(snap) {
    if (!snap.exists()) return;
    var vCentral = snap.data().version;
    if (!vCentral) return;
    var vLocal = localStorage.getItem(KEY_VERSION);
    if (vLocal !== vCentral) {
      console.log('[Balancet] Nueva versión:', vCentral, '→ recargando');
      localStorage.setItem(KEY_VERSION, vCentral);
      window.location.reload(true);
    }
  }).catch(function() {});
};

// Comprobar al cargar (con pequeño delay para que Firebase inicialice)
setTimeout(comprobarVersionYActualizar, 2000);

// Comprobar al volver de minimizado
document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'visible') {
    comprobarVersionYActualizar();
    // Recargar novedades al volver a la app — detecta las que publicó el admin mientras estaba cerrada
    if (window._btRecargarNovedades) window._btRecargarNovedades();
  }
});
import usePlan from './hooks/usePlan';

import InicioScreen from './screens/InicioScreen';
import RegistroScreen from './screens/RegistroScreen';
import BalanceScreen from './screens/BalanceScreen';
import PerfilScreen from './screens/PerfilScreen';

import FoodBlock from './blocks/FoodBlock';
import MoovBlock from './blocks/MoovBlock';
import MindfulnessBlock from './blocks/MindfulnessBlock';
import MiPlanScreen from './screens/MiPlanScreen';

import AdminPanel from './admin/AdminPanel';
import CuestionarioApp from './CuestionarioApp';
import Tutorial from './Tutorial';
import BannerPlan from './components/BannerPlan';
import ModalNovedad from './components/ModalNovedad';
import CestaBalancet from './components/CestaBalancet';
import TareaCliente from './components/TareaCliente';
import LimiteError from './components/LimiteError';
import TutorialCambio from './components/TutorialCambio';
import FeedbackBalancet from './components/FeedbackBalancet';
import { SplashBienvenida, ModalConfirmarAyer, ModalInactividad, ModalTuMes, ModalDocumentoPendiente, ModalRenovacion, ModalRenovacionConfirmada, ModalSueno, ModalReflexionDiaria } from './components/ModalesApp';
import { cargarRegistro, guardarRegistro } from './useRegistro';
import LogoSello from './components/LogoSello';
import Icono from './components/Icono';
import DocumentoFirma from './components/DocumentoFirma';
import { fechaKey, estadoDia } from './hooks/useHistorial';

// ─── Marca "B" cobalto para el header (versión ligera de LogoSello, sin wordmark) ──
function LogoMark(props) {
  var s = props.size || 30;
  return (
    <svg width={s} height={s} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <line x1="22" y1="12" x2="22" y2="68" stroke="#3b82f6" strokeWidth="6" strokeLinecap="round" />
      <line x1="22" y1="12" x2="52" y2="12" stroke="#3b82f6" strokeWidth="6" strokeLinecap="round" />
      <line x1="22" y1="40" x2="52" y2="40" stroke="#3b82f6" strokeWidth="6" strokeLinecap="round" />
      <line x1="22" y1="68" x2="52" y2="68" stroke="#3b82f6" strokeWidth="6" strokeLinecap="round" />
      <line x1="52" y1="12" x2="62" y2="26" stroke="#3b82f6" strokeWidth="6" strokeLinecap="round" />
      <line x1="62" y1="26" x2="52" y2="40" stroke="#3b82f6" strokeWidth="6" strokeLinecap="round" />
      <line x1="52" y1="40" x2="65" y2="54" stroke="#3b82f6" strokeWidth="6" strokeLinecap="round" />
      <line x1="65" y1="54" x2="52" y2="68" stroke="#3b82f6" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

// ─── Tabs de la barra inferior ────────────────────────────────────────────────
// Hora (local del dispositivo) a partir de la cual se ofrece la reflexión
// diaria de Mindfulness. Debe coincidir con HORA_REFLEXION de MindBlock.jsx.
var HORA_REFLEXION_DIARIA = 21;

// Inicio es el centro de mandos: desde ahí se abren los tres bloques. La
// pestaña que antes era "Registro" pasa a ser el calendario, y tocar el día de
// hoy en él abre el registro completo (Food + Moov + Mind seguidos).
var TABS = [
  { id: 'inicio', label: 'Inicio', icon: 'Home' },
  { id: 'hoy', label: 'Calendario', icon: 'Calendar' },
  { id: 'balance', label: 'Balance', icon: 'BarChart3' },
  { id: 'perfil', label: 'Perfil', icon: 'User' }
];

// Comprueba si un aviso ya se ocultó HOY (guardado en el dispositivo). Como
// la app es una PWA, la mayoría de sesiones nunca hacen una recarga real —
// se queda en segundo plano y vuelve — así que un simple estado de React no
// basta: sin esto, un aviso cerrado una vez no volvía a aparecer nunca más.
var yaOcultadoHoy = function(clave) {
  try {
    var hoy = new Date().toISOString().slice(0, 10);
    return localStorage.getItem(clave) === hoy;
  } catch (e) { return false; }
};
var ocultarHoy = function(clave) {
  try { localStorage.setItem(clave, new Date().toISOString().slice(0, 10)); } catch (e) {}
};

function MainApp() {
  // ── Estado global ──────────────────────────────────────────────────────────
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [booting, setBooting] = useState(true);
  const [errorSync, setErrorSync] = useState(null); // aviso de fallo de sincronización

  const [authView, setAuthView] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // darkMode = modo noche. El tema por defecto es el claro con cabeceras
  // cobalto (la marca); la noche es una opción de lectura más suave. Se
  // recuerda en el dispositivo; si no hay preferencia guardada, sigue al
  // sistema.
  const [darkMode, setDarkMode] = useState(function() {
    try {
      var g = window.localStorage.getItem('bt_modo_noche');
      if (g === '1') return true;
      if (g === '0') return false;
    } catch (e) { void e; }
    return false;
  });

  // Inicio es el centro de mandos: la app abre siempre ahí.
  const [tab, setTab] = useState('inicio');
  const [registroVista, setRegistroVista] = useState('hoy'); // 'hoy' | 'calendario' — antes eran 2 tabs (HOY / TuMes)
  const [bloqueActivo, setBloqueActivo] = useState(null);
  const [cestaAbierta, setCestaAbierta] = useState(false);
  const [tareasPendientes, setTareasPendientes] = useState([]);
  const [tareaAbierta, setTareaAbierta] = useState(null);
  // Tutorial del cambio de navegación: solo para quien ya había visto el
  // tutorial original (es decir, ya usaba la app) y aún no ha visto este.
  const [verTutorialCambio, setVerTutorialCambio] = useState(false);
  const [bloqueOrigen, setBloqueOrigen] = useState('inicio');

  const [config, setConfig] = useState({});
  const [nombre, setNombre] = useState('Atleta');
  const [foto, setFoto] = useState(null);
  const [ancla, setAncla] = useState('');
  const [anamnesisPendiente, setAnamnesisPendiente] = useState(false);
  const [documentosPendientes, setDocumentosPendientes] = useState([]);
  const [documentoAbierto, setDocumentoAbierto] = useState(null);
  const [avisoDocumentoOculto, setAvisoDocumentoOculto] = useState(function() {
    return yaOcultadoHoy('balancet_doc_oculto');
  });
  const [ultimaFotoProgreso, setUltimaFotoProgreso] = useState(null);
  const [statsProgreso, setStatsProgreso] = useState(null);
  const [diasPendientes, setDiasPendientes] = useState([]); // últimos 3 días con datos a medias, sin confirmar
  const [diaParaAbrirTuMes, setDiaParaAbrirTuMes] = useState(null);
  const [avisoRenovacionOculto, setAvisoRenovacionOculto] = useState(function() {
    return yaOcultadoHoy('balancet_renov_oculto');
  });
  const [puntosGozo, setPuntosGozo] = useState(0);
  const [avisoRenovacionConfirmada, setAvisoRenovacionConfirmada] = useState(null);
  const [suenoYaRegistrado, setSuenoYaRegistrado] = useState(true); // true por defecto, para no parpadear el modal mientras carga
  const [avisoSuenoOculto, setAvisoSuenoOculto] = useState(function() { return yaOcultadoHoy('balancet_sueno_oculto'); });
  const [reflexionYaRegistrada, setReflexionYaRegistrada] = useState(true);
  const [avisoReflexionOculto, setAvisoReflexionOculto] = useState(function() { return yaOcultadoHoy('balancet_reflexion_oculto'); });
  const [mindHoy, setMindHoy] = useState({});
  const [perfilCreadoEn, setPerfilCreadoEn] = useState(null);

  // Confirmación de día anterior
  const [modalAyer, setModalAyer] = useState(null);
  const [modalTuMes, setModalTuMes] = useState(null); // { diasSinConfirmar }
  const [splashActivo, setSplashActivo] = useState(false);
  const [modalInactividad, setModalInactividad] = useState(false);
  const [novedadActiva, setNovedadActiva] = useState(null);
  const [feedbackPendiente, setFeedbackPendiente] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);
  const [numClientes, setNumClientes] = useState(0);
  const [dayStamp, setDayStamp] = useState(new Date().toDateString());
  const [tutorialVisto, setTutorialVisto] = useState(true);
  const [bannerPlanVisto, setBannerPlanVisto] = useState(true);
  const [verTarifas, setVerTarifas] = useState(false); // true = no mostrar hasta saber

  var plan = usePlan(config);
  // ── Funciones auxiliares — definidas ANTES de los useEffect que las usan ───

  var cargarNovedades = function(uid, novedadesVistasFirestore) {
    var vistasSession = Array.isArray(window._btNovedadesVistas) ? window._btNovedadesVistas : [];
    var vistas = novedadesVistasFirestore.concat(vistasSession.filter(function(id) {
      return novedadesVistasFirestore.indexOf(id) === -1;
    }));
    window._btNovedadesVistas = vistas;
    window._btNovedadesVistasActuales = vistas;

    getDocs(collection(db, 'novedades')).then(function(snap) {
      var ahora = Date.now();
      var TREINTA_Y_SEIS_HORAS = 36 * 60 * 60 * 1000;
      var todas = [];
      snap.forEach(function(d) {
        var n = Object.assign({ id: d.id }, d.data());
        if (!n.publicado) return;
        // Usar siempre las vistas actuales (pueden haber cambiado por reenvío)
        var vistasActuales = window._btNovedadesVistasActuales || vistas;
        if (vistasActuales.indexOf(n.id) !== -1) return;
        if (n.expiraEn && ahora > n.expiraEn) return;
        if (n.tipo === 'podcast' && n.creadoEn && (ahora - n.creadoEn) > TREINTA_Y_SEIS_HORAS) return;
        todas.push(n);
      });
      // Ordenar por creadoEn (más reciente primero) — más fiable que fecha string
      todas.sort(function(a, b) { return (b.creadoEn || 0) - (a.creadoEn || 0); });
      if (todas.length > 0) setNovedadActiva(todas[0]);
      else setNovedadActiva(null);
    }).catch(function() {});
  };

  var verificarAyer = function(uid) {
    if (!uid) return;
    var ayer = new Date(); ayer.setDate(ayer.getDate() - 1);
    var ayerKey = ayer.getFullYear() + '-' + String(ayer.getMonth()+1).padStart(2,'0') + '-' + String(ayer.getDate()).padStart(2,'0');
    getDoc(doc(db, 'users', uid, 'registros', ayerKey)).then(function(snap) {
      if (!snap.exists()) return;
      var r = snap.data();
      if (r.completado) return;
      var tieneAlgo = (r.comidasCompletadas && r.comidasCompletadas.length > 0) || r.moov || r.sleep || r.peso;
      if (!tieneAlgo) return;
      setModalAyer({ fecha: ayerKey, uid: uid, comidas: r.comidasCompletadas ? r.comidasCompletadas.length : 0, entrenado: r.moov && r.moov.entrenado, suenoHoras: r.sleep && r.sleep.horas ? r.sleep.horas : null, peso: r.peso || null });
    }).catch(function() {});
  };

  var verificarDiasSinConfirmar = function(uid) {
    if (!uid) return;
    var hoy = new Date();
    var diasSinConfirmar = 0;
    var promesas = [];
    for (var i = 2; i <= 7; i++) {
      var d = new Date(hoy); d.setDate(d.getDate() - i);
      var k = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      promesas.push(
        (function(fecha) {
          return getDoc(doc(db, 'users', uid, 'registros', fecha)).then(function(snap) {
            if (!snap.exists()) return;
            var r = snap.data();
            if (r.completado) return;
            var tieneAlgo = (r.comidasCompletadas && r.comidasCompletadas.length > 0) || r.moov || r.sleep;
            if (tieneAlgo) diasSinConfirmar++;
          }).catch(function() {});
        })(k)
      );
    }
    Promise.all(promesas).then(function() {
      if (diasSinConfirmar >= 2) setModalTuMes({ diasSinConfirmar: diasSinConfirmar });
    });
  };

  var comprobarAlEntrar = function(uid, historial, creadoEn) {
    verificarAyer(uid);
    verificarDiasSinConfirmar(uid);

    // Si el cliente se creó hace menos de 48h, nunca puede ser "inactivo" —
    // simplemente no ha tenido tiempo de registrar nada todavía.
    var cuentaMuyReciente = creadoEn && (Date.now() - creadoEn) < 48 * 60 * 60 * 1000;
    if (cuentaMuyReciente) { setSplashActivo(true); setTimeout(function() { setSplashActivo(false); }, 4200); return; }

    // Comprobar inactividad: revisar hoy Y ayer
    // El modal solo sale si no hay NINGÚN dato en las últimas 48h
    var hoy = new Date();
    var ayer = new Date(hoy); ayer.setDate(ayer.getDate() - 1);
    var hoyKey = hoy.getFullYear() + '-' + String(hoy.getMonth()+1).padStart(2,'0') + '-' + String(hoy.getDate()).padStart(2,'0');
    var ayerKey = ayer.getFullYear() + '-' + String(ayer.getMonth()+1).padStart(2,'0') + '-' + String(ayer.getDate()).padStart(2,'0');

    var tieneRegistro = function(r) {
      if (!r) return false;
      if (r.comidasCompletadas && r.comidasCompletadas.length > 0) return true;
      if (r.moov && r.moov.entrenado) return true;
      if (r.moov && r.moov.pasos && parseInt(r.moov.pasos, 10) > 0) return true;
      if (r.agua && r.agua.tomas && r.agua.tomas.length > 0) return true;
      if (r.agua && r.agua.vasos && r.agua.vasos > 0) return true; // sistema antiguo
      if (r.sleep && r.sleep.horas) return true;
      if (r.peso) return true;
      if (r.menuFijadoEn) return true; // eligió menú hoy = interacción real
      return false;
    };

    Promise.all([
      getDoc(doc(db, 'users', uid, 'registros', hoyKey)),
      getDoc(doc(db, 'users', uid, 'registros', ayerKey))
    ]).then(function(snaps) {
      var tieneHoy = snaps[0].exists() && tieneRegistro(snaps[0].data());
      var tieneAyer = snaps[1].exists() && tieneRegistro(snaps[1].data());
      if (!tieneHoy && !tieneAyer) setModalInactividad(true);
    }).catch(function() {
      // Si falla la lectura no molestar
    });

    setSplashActivo(true);
    setTimeout(function() { setSplashActivo(false); }, 4200);
  };

  // ── Splash breve, independiente de Firebase ────────────────────────────────
  // ── La onda: confirmación de cada toque ───────────────────────────────────
  // Un único listener global en lugar de tocar los cientos de botones de la
  // app. Se engancha en fase de captura para que funcione aunque el botón
  // detenga la propagación, y respeta "reducir movimiento" del sistema.
  useEffect(function() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var alTocar = function(ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest('button, [role="button"]') : null;
      if (!btn || btn.disabled) return;
      var caja = btn.getBoundingClientRect();
      if (caja.width === 0) return;
      var estilo = window.getComputedStyle(btn);
      if (estilo.position === 'static') btn.style.position = 'relative';
      if (estilo.overflow !== 'hidden') btn.style.overflow = 'hidden';
      var lado = Math.max(caja.width, caja.height);
      var onda = document.createElement('span');
      onda.className = 'bt-onda-punto';
      onda.style.width = lado + 'px';
      onda.style.height = lado + 'px';
      onda.style.left = ((ev.clientX - caja.left) - lado / 2) + 'px';
      onda.style.top = ((ev.clientY - caja.top) - lado / 2) + 'px';
      btn.appendChild(onda);
      setTimeout(function() { if (onda.parentNode) onda.parentNode.removeChild(onda); }, 650);
    };
    document.addEventListener('pointerdown', alTocar, true);
    return function() { document.removeEventListener('pointerdown', alTocar, true); };
  }, []);
  useEffect(function() {
    var t = setTimeout(function() { setBooting(false); }, 1200);
    return function() { clearTimeout(t); };
  }, []);

  // ── Reset de medianoche + confirmación del día anterior ───────────────────
  useEffect(function() {
    var iv = setInterval(function() {
      var hoy = new Date().toDateString();
      setDayStamp(function(prev) {
        if (prev !== hoy) {
          // Día nuevo: verificar si ayer quedó sin confirmar
          if (user) verificarAyer(user.uid);
          return hoy;
        }
        return prev;
      });
    }, 30000);
    return function() { clearInterval(iv); };
  }, [user]);

  // ── Tema: init desde preferencia del sistema ───────────────────────────────
  useEffect(function() {
    try { if (window.localStorage.getItem('bt_modo_noche') !== null) return; } catch (e) { void e; }
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    setDarkMode(mq.matches);
  }, []);

  // ── Aplicar clase de tema al <html> (dispara los tokens de index.css) ──────
  useEffect(function() {
    var el = document.documentElement;
    if (darkMode) { el.classList.add('noche'); el.classList.remove('light'); }
    else { el.classList.remove('noche'); el.classList.add('light'); }
    try { window.localStorage.setItem('bt_modo_noche', darkMode ? '1' : '0'); } catch (e) { void e; }
  }, [darkMode]);

  // ── Auth + carga del documento de usuario ──────────────────────────────────
  useEffect(function() {
    var unsub = onAuthStateChanged(auth, async function(current) {
      if (!current) {
        setUser(null);
        setIsAdmin(false);
        setConfig({});
        setLoading(false);
        return;
      }
      setUser(current);

      // Admin
      if (current.email === SUPER_ADMIN_EMAIL) {
        setIsAdmin(true);
        try {
          var q = await getDocs(collection(db, 'users'));
          var n = 0;
          q.forEach(function(d) { if (d.data().email !== SUPER_ADMIN_EMAIL) n = n + 1; });
          setNumClientes(n);
        } catch (e) {}
        // Cargar novedades también para admin
        cargarNovedades(current.uid, []);
        setLoading(false);
        return;
      }

      // Cliente: cargar documento y configuracion
      setIsAdmin(false);
      try {
        var snap = await getDoc(doc(db, 'users', current.uid));
        var data = snap.exists() ? snap.data() : {};

        if (data.configuracion) {
          var base = { comidasConfig: { mediaManana: false, merienda: false, recena: false }, modulosActivos: { food: false, moov: false } };
          var merged = Object.assign({}, base, data.configuracion);
          setConfig(merged);
        } else {
          setConfig({});
        }

        var nom = data.nombre || (data.configuracion && data.configuracion.nombre) || 'Atleta';
        setNombre(nom);
        if (data.fotoPerfil) setFoto(data.fotoPerfil);
        // TUTORIAL_VERSION: si se sube, todos los clientes vuelven a ver el
        // tutorial una vez (aunque ya lo tuvieran marcado como visto), útil
        // cuando hay un cambio estructural real como este (rediseño visual
        // completo v2: círculo de Balance del día, Registro unificado con
        // Hoy/Calendario, nav de 4 tabs).
        var TUTORIAL_VERSION = 3;
        var tutorialVersionVista = data.tutorialVersionVista || 1;
        setTutorialVisto(data.tutorialVisto === true && tutorialVersionVista >= TUTORIAL_VERSION);
        setBannerPlanVisto(data.bannerPlanVisto === true);
        setAncla(data.motivacion || data.porQueEstasAqui || '');
        setAnamnesisPendiente(data.anamnesisPendiente === true);
        setPuntosGozo(typeof data.puntosGozo === 'number' ? data.puntosGozo : 0);
        setPerfilCreadoEn(data.creadoEn || null);
        setUltimaFotoProgreso(data.ultimaFotoProgreso || null);
        if (data.avisoRenovacionConfirmada && data.avisoRenovacionConfirmada.visto === false) {
          setAvisoRenovacionConfirmada(data.avisoRenovacionConfirmada);
        }

        // Sueño de hoy — si no lo ha registrado aún, se le pregunta con el
        // modal de buenos días (una vez al día, con tono positivo)
        try {
          var regHoy = await cargarRegistro(current.uid);
          var yaTieneSueno = regHoy && regHoy.sleep && regHoy.sleep.horas;
          setSuenoYaRegistrado(!!yaTieneSueno);
          var yaTieneReflexion = regHoy && regHoy.mind && regHoy.mind.reflexionDiaria;
          setReflexionYaRegistrada(!!yaTieneReflexion);
          setMindHoy((regHoy && regHoy.mind) || {});
        } catch (e) { setSuenoYaRegistrado(true); setReflexionYaRegistrada(true); } // si falla la carga, no molestar con los modales

        // Documentos pendientes de firma
        try {
          var docsSnap = await getDocs(query(collection(db, 'users', current.uid, 'documentos'), where('estado', '==', 'pendiente')));
          var listaDocs = [];
          docsSnap.forEach(function(d) { listaDocs.push(Object.assign({ id: d.id }, d.data())); });
          setDocumentosPendientes(listaDocs);
        } catch (e) {}

        // Historial de registros — para calcular datos reales de progreso
        // (días registrados, completados, adherencia, mejor racha) y usarlos
        // en el storytelling de renovación. Nunca datos inventados.
        try {
          var regSnap = await getDocs(collection(db, 'users', current.uid, 'registros'));
          var mapaHist = {};
          regSnap.forEach(function(d) { mapaHist[d.id] = d.data(); });
          setStatsProgreso(calcularStatsProgreso(mapaHist));

          // Días pendientes — de los últimos 3 días (sin contar hoy), cuáles
          // tienen datos a medias (empezados pero no confirmados)
          var pendientes = [];
          var i;
          for (i = 1; i <= 3; i++) {
            var dPend = new Date();
            dPend.setDate(dPend.getDate() - i);
            var keyPend = fechaKey(dPend);
            var regPend = mapaHist[keyPend];
            if (estadoDia(regPend) === 'parcial') {
              pendientes.push({ fecha: keyPend, nombreDia: dPend.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' }) });
            }
          }
          setDiasPendientes(pendientes);
        } catch (e) {}

        // Cargar novedades no vistas
        var novedadesVistas = data.novedadesVistas || [];
        cargarNovedades(current.uid, novedadesVistas);
        // Registrar función para recargar novedades al volver a la app
        window._btRecargarNovedades = function() {
          var vistasActuales = Array.isArray(window._btNovedadesVistasActuales) ? window._btNovedadesVistasActuales : (data.novedadesVistas || []);
          cargarNovedades(current.uid, vistasActuales);
        };

        // Feedback Balancet — cada 14 días (solo clientes con plan y 3+ días
        // de registros acumulados; una cuenta recién creada nunca lo ve)
        if (data.tienePlan) {
          getDocs(collection(db, 'users', current.uid, 'registros')).then(function(regSnap) {
            if (regSnap.size < 3) return; // menos de 3 días de actividad — aún no toca
            var ultimoFb = data.ultimoFeedback || null;
            var pospuestoHasta = data.feedbackPospuesto || null;
            var hoyMs = Date.now();
            var mostrarFb = false;
            if (!ultimoFb) {
              mostrarFb = true;
            } else {
              var partesFb = ultimoFb.split('-');
              var fechaFb = new Date(parseInt(partesFb[0],10), parseInt(partesFb[1],10)-1, parseInt(partesFb[2],10)).getTime();
              if (hoyMs - fechaFb >= 14 * 24 * 3600 * 1000) mostrarFb = true;
            }
            if (mostrarFb && pospuestoHasta && hoyMs < pospuestoHasta) mostrarFb = false;
            if (mostrarFb) {
              setTimeout(function() { setFeedbackPendiente(true); }, 2500);
            }
          }).catch(function() {});
        }

        // Verificar día anterior + inactividad + splash
        comprobarAlEntrar(current.uid, null, data.creadoEn);

      } catch (e) {
        console.warn('[Balancet] Error cargando usuario:', e.message);
      }
      setLoading(false);
    });
    return function() { unsub(); };
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────────
  var mensajeAuthError = function(codigo) {
    var mensajes = {
      'auth/user-not-found':        'No existe ninguna cuenta con ese email.',
      'auth/wrong-password':         'Contraseña incorrecta. Inténtalo de nuevo.',
      'auth/invalid-credential':     'Email o contraseña incorrectos.',
      'auth/email-already-in-use':   'Ya existe una cuenta con ese email. Intenta iniciar sesión.',
      'auth/weak-password':          'La contraseña debe tener al menos 6 caracteres.',
      'auth/invalid-email':          'El email no tiene un formato válido.',
      'auth/too-many-requests':      'Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.',
      'auth/network-request-failed': 'Sin conexión. Comprueba tu internet e inténtalo de nuevo.',
      'auth/user-disabled':          'Esta cuenta ha sido desactivada. Contacta con Juan.',
      'auth/popup-closed-by-user':   'El proceso de acceso fue cancelado.',
      'auth/requires-recent-login':  'Por seguridad, vuelve a iniciar sesión antes de continuar.'
    };
    return mensajes[codigo] || 'Error al acceder. Revisa tus datos e inténtalo de nuevo.';
  };

  var [authError, setAuthError] = useState('');

  var handleAuth = async function() {
    setAuthError('');
    try {
      if (authView === 'register') {
        var res = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'users', res.user.uid), { email: email, rol: 'usuario', tienePlan: false });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setAuthError(mensajeAuthError(err.code));
    }
  };

  var handleLogout = function() {
    signOut(auth);
    setBloqueActivo(null);
    setTab('inicio');
  };

  var handleRecuperar = function() {
    if (!email || email.indexOf('@') === -1) {
      alert('Escribe primero tu email en el campo de arriba y vuelve a pulsar "¿Olvidaste tu contraseña?".');
      return;
    }
    sendPasswordResetEmail(auth, email).then(function() {
      alert('Te hemos enviado un email a ' + email + ' con un enlace para restablecer tu contraseña. Revisa también la carpeta de spam.');
    }).catch(function(err) {
      if (err.code === 'auth/user-not-found') alert('No hay ninguna cuenta con ese email. ¿Seguro que lo escribiste bien?');
      else alert('No se pudo enviar el email. Revisa que el email sea correcto.');
    });
  };

  var toggleTema = function() { setDarkMode(function(d) { return !d; }); };

  // Guardar foto de perfil en Firebase Storage (no en Firestore como base64)
  // Esto reduce el tamaño del documento de usuario de varios KB a una URL corta
  var guardarFotoPerfil = function(base64) {
    if (!user || !user.uid) return;
    // Mostrar inmediatamente en la UI
    setFoto(base64);
    // Intentar subir a Storage
    try {
      var storageRef = ref(storage, 'fotos_perfil/' + user.uid + '.jpg');
      uploadString(storageRef, base64, 'data_url').then(function() {
        return getDownloadURL(storageRef);
      }).then(function(url) {
        // Guardar solo la URL en Firestore (mucho más ligero que el base64)
        setDoc(doc(db, 'users', user.uid), { fotoPerfil: url }, { merge: true }).catch(function() {});
      }).catch(function() {
        // Si Storage falla (ej: reglas), guardar base64 como fallback
        setDoc(doc(db, 'users', user.uid), { fotoPerfil: base64 }, { merge: true }).catch(function() {});
      });
    } catch(e) {
      // Fallback: guardar base64 si Storage no está disponible
      setDoc(doc(db, 'users', user.uid), { fotoPerfil: base64 }, { merge: true }).catch(function() {});
    }
  };

  var irATab = function(t) {
    setBloqueActivo(null); // reset del bloque al cambiar de tab
    setTab(t);
  };

  var abrirBloque = function(id) {
    setBloqueOrigen(tab);
    setBloqueActivo(id);
  };

  var cerrarBloque = function() {
    setBloqueActivo(null);
    setTab(bloqueOrigen); // vuelve a la tab desde la que se entro
  };

  var abrirPerfil = function() {
    setBloqueActivo(null);
    setTab('perfil');
  };

  // ── SPLASH / LOADING ─────────────────────────────────────────────────────────
  if (booting || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '18px', background: 'var(--bt-bg)' }}>
        <div style={{ background: '#09090b', borderRadius: '18px', padding: '12px' }}>
          <LogoMark size={56} />
        </div>
        <div style={{ width: '24px', height: '24px', border: '2px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%' }} className="animate-spin"></div>
      </div>
    );
  }

  // ── LOGIN / REGISTRO ─────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'var(--bt-bg)' }}>
        <div className="animate-slide-up" style={{ width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <LogoSello size={90} color="#3b82f6" subtitulo={true} />
          </div>

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={function(e) { setEmail(e.target.value); }}
            style={{ width: '100%', padding: '15px', borderRadius: '14px', border: '1px solid var(--bt-border)', background: 'var(--bt-card)', color: 'var(--bt-text)', fontSize: '14px', outline: 'none' }} />
          <input
            type="password"
            placeholder="Contrasena"
            value={password}
            onChange={function(e) { setPassword(e.target.value); }}
            style={{ width: '100%', padding: '15px', borderRadius: '14px', border: '1px solid var(--bt-border)', background: 'var(--bt-card)', color: 'var(--bt-text)', fontSize: '14px', outline: 'none' }} />

          <button
            onClick={handleAuth}
            className="btn-primary"
            style={{ width: '100%', padding: '15px', borderRadius: '14px', border: 'none', background: 'var(--bt-primary)', color: '#ffffff', fontWeight: 900, textTransform: 'uppercase', fontSize: '14px', cursor: 'pointer' }}>
            {authView === 'register' ? 'Crear cuenta' : 'Acceder'}
          </button>

          {authError ? (
            <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <p style={{ color: '#ef4444', fontSize: '13px', fontWeight: 700, lineHeight: 1.4 }}>{authError}</p>
            </div>
          ) : null}

          {authView !== 'register' ? (
            <button
              onClick={handleRecuperar}
              style={{ background: 'none', border: 'none', color: 'var(--bt-text-3)', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}>
              ¿Olvidaste tu contraseña?
            </button>
          ) : null}

          <button
            onClick={function() { window.location.href = '/cuestionario'; }}
            style={{ width: '100%', padding: '13px', borderRadius: '14px', border: '1px solid var(--bt-primary)', background: 'transparent', color: 'var(--bt-primary)', fontWeight: 800, fontSize: '13px', cursor: 'pointer', marginTop: '2px' }}>
            Soy nuevo → Hacer el cuestionario
          </button>

          <button
            onClick={function() { setAuthView(authView === 'register' ? 'login' : 'register'); }}
            style={{ background: 'none', border: 'none', color: 'var(--bt-text-3)', fontSize: '12px', cursor: 'pointer', marginTop: '4px' }}>
            {authView === 'register' ? 'Ya tengo cuenta' : 'Crear cuenta con email y contraseña'}
          </button>
        </div>
      </div>
    );
  }

  // ── VISTA ADMIN (el admin no ve la app de cliente, aterriza en su panel) ─────
  if (isAdmin) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bt-bg)', color: 'var(--bt-text)' }}>
        <AdminPanel
          numClientes={numClientes}
          nombre={nombre}
          darkMode={darkMode}
          onToggleTema={toggleTema}
          onLogout={handleLogout} />
      </div>
    );
  }

  // ── Props comunes para las pantallas/bloques ─────────────────────────────────
  var screenProps = {
    user: user,
    config: config,
    plan: plan,
    nombre: nombre,
    foto: foto,
    darkMode: darkMode,
    abrirBloque: abrirBloque,
    ancla: ancla,
    puntosGozo: puntosGozo,
    statsProgreso: statsProgreso,
    perfilCreadoEn: perfilCreadoEn,
    diasPendientes: diasPendientes,
    diaInicialAbrir: diaParaAbrirTuMes,
    onIrADiaPendiente: function(fecha) { setDiaParaAbrirTuMes(fecha); setTab('hoy'); setRegistroVista('calendario'); },
    onDiaInicialConsumido: function() { setDiaParaAbrirTuMes(null); },
    onToggleTema: toggleTema,
    onGuardarFoto: guardarFotoPerfil,
    abrirTarifas: function() { setVerTarifas(true); }
  };

  // ── Contenido segun bloque activo o tab ──────────────────────────────────────
  var contenido = null;
  if (bloqueActivo === 'food') contenido = <FoodBlock {...screenProps} onVolver={cerrarBloque} onAbrirCesta={function() { setCestaAbierta(true); }} />;
  else if (bloqueActivo === 'moov') contenido = <MoovBlock {...screenProps} onVolver={cerrarBloque} />;
  else if (bloqueActivo === 'mindfulness') contenido = <MindfulnessBlock {...screenProps} onVolver={cerrarBloque} />;
  // Compatibilidad: si algo abre 'mind' o 'sleep' directamente, redirigir a mindfulness
  else if (bloqueActivo === 'mind' || bloqueActivo === 'sleep') contenido = <MindfulnessBlock {...screenProps} />;
  // Registro del día completo: los tres bloques seguidos, con Food arriba. Es
  // lo que se abre al tocar "hoy" en el calendario.
  else if (bloqueActivo === 'dia') contenido = (
    <div>
      <FoodBlock {...screenProps} onVolver={cerrarBloque} onAbrirCesta={function() { setCestaAbierta(true); }} />
      <div style={{ padding: '0 16px' }}><div style={{ borderTop: '1px solid var(--bt-divider)', margin: '4px 0 12px' }}></div></div>
      <MoovBlock {...screenProps} />
      <div style={{ padding: '0 16px' }}><div style={{ borderTop: '1px solid var(--bt-divider)', margin: '4px 0 12px' }}></div></div>
      <MindfulnessBlock {...screenProps} />
    </div>
  );
  else if (tab === 'inicio') contenido = <InicioScreen {...screenProps} onAbrirCesta={function() { setCestaAbierta(true); }} />;
  else if (tab === 'hoy') contenido = <RegistroScreen {...screenProps} subvista="calendario" soloCalendario={true} onAbrirDia={function() { abrirBloque('dia'); }} onSubvistaChange={setRegistroVista} />;
  else if (tab === 'balance') contenido = <BalanceScreen {...screenProps} />;
  else if (tab === 'perfil') contenido = (
    <PerfilScreen
      nombre={nombre}
      foto={foto}
      email={user.email}
      plan={plan}
      darkMode={darkMode}
      anamnesisPendiente={anamnesisPendiente}
      documentosPendientes={documentosPendientes}
      onAbrirDocumento={function(docItem) { setDocumentoAbierto(docItem); }}
      uid={user.uid}
      ultimaFotoProgreso={ultimaFotoProgreso}
      onFotoProgresoSubida={function() { setUltimaFotoProgreso(Date.now()); }}
      onToggleTema={toggleTema}
      onLogout={handleLogout}
      onGuardarFoto={guardarFotoPerfil}
      abrirTarifas={function() { setVerTarifas(true); }} />
  );

  var enBloque = bloqueActivo !== null;

  // ── BLOQUEO POR PLAN VENCIDO — sustituye toda la app, no es un aviso descartable ──
  var estSuscBloqueo = estadoSuscripcionCliente(plan.suscripcion);
  var debeBloquear = estSuscBloqueo.estado === 'vencido' && plan.tienePlan && tutorialVisto && !splashActivo && user.email !== SUPER_ADMIN_EMAIL;
  if (debeBloquear) {
    var diasComoClienteBloqueo = perfilCreadoEn ? Math.floor((Date.now() - perfilCreadoEn) / (1000 * 60 * 60 * 24)) : null;
    var enlaceBloqueo = generarEnlaceRenovacion(plan.suscripcion.periodo, Object.assign({ uid: user.uid, nombre: nombre, dias: diasComoClienteBloqueo }, statsProgreso || {}));
    var primerNombreBloqueo = (nombre || '').split(' ')[0];
    var waUrlBloqueo = 'https://wa.me/34682498645?text=' + encodeURIComponent('Hola Juan! Quiero seguir con mi plan, ¿me ayudas?');
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bt-bg)', color: 'var(--bt-text)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '28px' }}>
        <div style={{ width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px', textAlign: 'center' }}>

          <div style={{ width: '64px', height: '64px', borderRadius: '18px', background: 'color-mix(in srgb, var(--bt-primary) 14%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icono nombre="Lock" tam={28} color="var(--bt-primary)" opacidad={0.85} />
          </div>

          <div>
            <p style={{ fontWeight: 900, fontSize: '20px', letterSpacing: '-0.01em' }}>Espera, {primerNombreBloqueo || 'no te vayas'}</p>
            <p style={{ color: 'var(--bt-text-2)', fontSize: '14px', lineHeight: 1.7, marginTop: '10px' }}>
              Todo tu progreso sigue aquí, guardado y esperándote: tu racha, tus registros, todo lo que has construido hasta ahora. No lo dejes a medias justo ahora.
            </p>
          </div>

          <div className="bt-card" style={{ width: '100%', padding: '16px', display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <p style={{ fontWeight: 900, fontSize: '22px', color: '#eab308' }}>{(statsProgreso && statsProgreso.mejorRacha) || 0}</p>
              <p style={{ fontSize: '10px', color: 'var(--bt-text-3)', fontWeight: 700 }}>mejor racha</p>
            </div>
            <div style={{ width: '1px', background: 'var(--bt-border)' }}></div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <p style={{ fontWeight: 900, fontSize: '22px', color: 'var(--bt-primary)' }}>{Math.abs(estSuscBloqueo.dias)}</p>
              <p style={{ fontSize: '10px', color: 'var(--bt-text-3)', fontWeight: 700 }}>días esperando tu vuelta</p>
            </div>
          </div>

          <a href={enlaceBloqueo} target="_blank" rel="noreferrer"
            style={{ width: '100%', padding: '16px', borderRadius: '14px', border: 'none', background: 'var(--bt-primary)', color: '#fff', fontWeight: 900, fontSize: '15px', textDecoration: 'none' }}>
            Continuar mi plan →
          </a>
          <a href={waUrlBloqueo} target="_blank" rel="noreferrer"
            style={{ fontSize: '13px', color: 'var(--bt-text-3)', textDecoration: 'underline' }}>
            ¿Dudas? Habla con Juan
          </a>
          <button onClick={handleLogout}
            style={{ marginTop: '4px', padding: '10px', borderRadius: '10px', border: '1px solid var(--bt-border)', background: 'transparent', color: 'var(--bt-text-3)', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  // ── APP SHELL ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bt-bg)', color: 'var(--bt-text)', paddingBottom: '78px' }}>

      {/* TARIFAS — overlay accesible desde bloques bloqueados y Perfil */}
      {verTarifas ? (
        <div style={{ position: 'fixed', inset: 0, zIndex: 280, background: 'var(--bt-bg)', overflowY: 'auto' }}>
          {/* Para clientes activos: su plan, hasta cuándo, y UN paso siguiente.
              La tabla completa de precios vive en el shop, para quien aún no
              es cliente. */}
          <MiPlanScreen
            onVolver={function() { setVerTarifas(false); }}
            plan={plan}
            user={user} />
        </div>
      ) : null}

      {/* BANNER DE PLAN NUEVO — aparece cuando el admin carga un Excel nuevo */}
      {!bannerPlanVisto && plan.tienePlan && tutorialVisto ? (
        <BannerPlan
          uid={user ? user.uid : null}
          plan={plan}
          nombre={nombre}
          esNuevoCliente={perfilCreadoEn ? (Date.now() - perfilCreadoEn) < 7 * 24 * 60 * 60 * 1000 : false}
          onCerrar={function() { setBannerPlanVisto(true); }} />
      ) : null}

      {/* TUTORIAL de primera vez — overlay autocontenido con datos ficticios */}
      {!tutorialVisto ? (
        <Tutorial
          uid={user ? user.uid : null}
          nombre={nombre}
          tieneMoov={plan.tieneMoov}
          tieneFood={plan.tieneFood}
          onFin={function() { setTutorialVisto(true); }} />
      ) : null}

      {/* SPLASH — pantalla de bienvenida con mensajes rotativos */}
      {/* Banner de error de sincronización — aparece si Firebase rechaza una escritura */}
      {errorSync ? (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999, background: '#ef4444', color: '#fff', padding: '10px 16px', fontSize: '13px', fontWeight: 700, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <Icono nombre="AlertTriangle" tam={15} color="#ffffff" />
          <span>{errorSync}</span>
          <button onClick={function() { setErrorSync(null); }} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '16px', marginLeft: '8px', padding: 0 }}>×</button>
        </div>
      ) : null}

      {splashActivo && plan.tienePlan && tutorialVisto ? (
        <SplashBienvenida nombre={nombre} darkMode={darkMode} />
      ) : null}

      {/* NOVEDAD — aparece a todos los usuarios incluido admin */}
      {novedadActiva && !splashActivo ? (
        <ModalNovedad
          novedad={novedadActiva}
          uid={user ? user.uid : null}
          onAccion={function(accion) {
            // Acciones internas que puede lanzar una novedad desde su CTA.
            // Así el cliente prueba la novedad en el mismo momento en que la
            // lee, sin tener que buscarla luego por la app.
            if (accion === 'momento_balancet') {
              window._btAbrirMomento = true;
              setBloqueActivo('mindfulness');
            } else if (accion === 'abrir_mindfulness') {
              setBloqueActivo('mindfulness');
            } else if (accion === 'abrir_moov') {
              setBloqueActivo('moov');
            } else if (accion === 'abrir_food') {
              setBloqueActivo('food');
            } else if (accion === 'ir_inicio') {
              setBloqueActivo(null);
              setTab('inicio');
            }
          }}
          onCerrar={function() {
            // Actualizar el array de novedadesVistas en memoria y en Firestore
            if (user && user.uid && novedadActiva) {
              var vistas = Array.isArray(window._btNovedadesVistas) ? window._btNovedadesVistas : [];
              if (vistas.indexOf(novedadActiva.id) === -1) {
                vistas = vistas.concat([novedadActiva.id]);
              }
              window._btNovedadesVistas = vistas;
              setDoc(doc(db, 'users', user.uid), { novedadesVistas: vistas }, { merge: true }).catch(function() {});
            }
            setNovedadActiva(null);
          }} />
      ) : null}

      {/* FEEDBACK BALANCET — cada 14 días, solo con plan, no encima de novedades ni splash */}
      {feedbackPendiente && !splashActivo && !novedadActiva && tutorialVisto ? (
        <FeedbackBalancet
          user={user}
          onCerrar={function() {
            // "Ahora no" — posponer 2 días máximo
            if (user && user.uid) {
              setDoc(doc(db, 'users', user.uid), { feedbackPospuesto: Date.now() + 2 * 24 * 3600 * 1000 }, { merge: true }).catch(function() {});
            }
            setFeedbackPendiente(false);
          }}
          onCompletado={function() {
            setFeedbackPendiente(false);
          }} />
      ) : null}

      {/* MODAL — días sin confirmar en TuMes */}
      {modalTuMes && tutorialVisto && !splashActivo && !modalAyer ? (
        <ModalTuMes
          datos={modalTuMes}
          onIrTuMes={function() { setModalTuMes(null); setBloqueActivo(null); setTab('hoy'); setRegistroVista('calendario'); }}
          onCerrar={function() { setModalTuMes(null); }} />
      ) : null}

      {/* MODAL — confirmar día anterior sin completar */}
      {modalAyer ? (
        <ModalConfirmarAyer
          datos={modalAyer}
          db={db}
          onConfirmar={function() {
            setDoc(doc(db, 'users', modalAyer.uid, 'registros', modalAyer.fecha), { completado: true }, { merge: true })
              .then(function() { setModalAyer(null); })
              .catch(function() { setModalAyer(null); });
          }}
          onCerrar={function() { setModalAyer(null); }} />
      ) : null}

      {/* MODAL — inactividad: ayuda a retomar */}
      {modalInactividad && plan.tienePlan && tutorialVisto && !splashActivo ? (
        <ModalInactividad
          nombre={nombre}
          onCerrar={function() { setModalInactividad(false); }} />
      ) : null}

      {/* AVISO — documento nuevo pendiente de firmar, aparece nada más entrar */}
      {documentosPendientes.length > 0 && !avisoDocumentoOculto && !yaOcultadoHoy('balancet_doc_oculto') && !documentoAbierto && tutorialVisto && !splashActivo && !modalAyer && !modalTuMes ? (
        <ModalDocumentoPendiente
          nombre={nombre}
          documento={documentosPendientes[0]}
          onVer={function() { setAvisoDocumentoOculto(true); setDocumentoAbierto(documentosPendientes[0]); }}
          onCerrar={function() { ocultarHoy('balancet_doc_oculto'); setAvisoDocumentoOculto(true); }} />
      ) : null}

      {/* Aviso positivo — Juan acaba de confirmar una renovación pagada por Bizum/efectivo */}
      {avisoRenovacionConfirmada ? (
        <ModalRenovacionConfirmada
          nombre={nombre}
          fechaFin={avisoRenovacionConfirmada.fechaFin}
          onCerrar={function() {
            setAvisoRenovacionConfirmada(null);
            updateDoc(doc(db, 'users', user.uid), { 'avisoRenovacionConfirmada.visto': true }).catch(function() {});
          }} />
      ) : null}

      {/* Buenos días — pregunta las horas de sueño de anoche, una vez al día, en tono positivo */}
      {!suenoYaRegistrado && !avisoSuenoOculto && !avisoRenovacionConfirmada && tutorialVisto && !splashActivo && !modalAyer && !modalTuMes && plan.tienePlan && !(documentosPendientes.length > 0 && !avisoDocumentoOculto) ? (
        <ModalSueno
          onGuardar={function(horas) {
            guardarRegistro(user.uid, { sleep: { horas: horas, calidad: '' }, _actualizado: new Date().toISOString() });
            setSuenoYaRegistrado(true);
            ocultarHoy('balancet_sueno_oculto');
            setAvisoSuenoOculto(true);
          }}
          onCerrar={function() { ocultarHoy('balancet_sueno_oculto'); setAvisoSuenoOculto(true); }} />
      ) : null}

      {/* Reflexión diaria de Mindfulness — para TODOS los clientes, tengan plan
          o no. Solo a partir de HORA_REFLEXION_DIARIA (hora local del propio
          dispositivo): es un cierre del día, no algo que despachar por la mañana
          antes de haber vivido la jornada. Si no se contesta esa noche, al día
          siguiente vuelve a esperar hasta esa hora. */}
      {new Date().getHours() >= HORA_REFLEXION_DIARIA && !reflexionYaRegistrada && !avisoReflexionOculto && (suenoYaRegistrado || avisoSuenoOculto) && !avisoRenovacionConfirmada && tutorialVisto && !splashActivo && !modalAyer && !modalTuMes && !(documentosPendientes.length > 0 && !avisoDocumentoOculto) ? (
        <ModalReflexionDiaria
          onGuardar={function(opcionKey, notaLibre) {
            if (!user.uid) return;
            var regActualizadoMind = Object.assign({}, mindHoy, {
              reflexionDiaria: { opcion: opcionKey, nota: notaLibre, fecha: new Date().toISOString() }
            });
            guardarRegistro(user.uid, { mind: regActualizadoMind, _actualizado: new Date().toISOString() });
            setReflexionYaRegistrada(true);
          }}
          onCerrar={function() { ocultarHoy('balancet_reflexion_oculto'); setAvisoReflexionOculto(true); }} />
      ) : null}

      {/* AVISO — plan por vencer o vencido, con enlace directo a precios (sin pasar por citas) */}
      {(function() {
        if (avisoRenovacionOculto || yaOcultadoHoy('balancet_renov_oculto') || !tutorialVisto || splashActivo || modalAyer || modalTuMes || (documentosPendientes.length > 0 && !avisoDocumentoOculto)) return null;
        var estSusc = estadoSuscripcionCliente(plan.suscripcion);
        if (estSusc.estado !== 'por_vencer' && estSusc.estado !== 'vencido') return null;
        var diasComoClienteAviso = perfilCreadoEn ? Math.floor((Date.now() - perfilCreadoEn) / (1000 * 60 * 60 * 24)) : null;
        var enlace = generarEnlaceRenovacion(plan.suscripcion.periodo, Object.assign({ uid: user.uid, nombre: nombre, dias: diasComoClienteAviso }, statsProgreso || {}));
        return (
          <ModalRenovacion
            nombre={nombre}
            estado={estSusc.estado}
            dias={estSusc.dias}
            enlace={enlace}
            onCerrar={function() { ocultarHoy('balancet_renov_oculto'); setAvisoRenovacionOculto(true); }} />
        );
      })()}

      {/* Documento pendiente de firma */}
      {documentoAbierto ? (
        <DocumentoFirma
          uid={user.uid}
          email={user.email}
          documento={documentoAbierto}
          onCerrar={function() { setDocumentoAbierto(null); }}
          onFirmado={function() {
            setDocumentosPendientes(function(prev) {
              return prev.filter(function(d) { return d.id !== documentoAbierto.id; });
            });
            setDocumentoAbierto(null);
          }} />
      ) : null}

      {/* HEADER STICKY — solo Logo + nombre + perfil (sin Inicio/Balance) */}
      <header style={{ position: 'sticky', top: 0, zIndex: 30, background: 'var(--bt-bg)', borderBottom: '1px solid var(--bt-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
        {/* Logo clicable — atajo directo a Inicio desde cualquier punto de la
            app, sin tener que ir retrocediendo con "volver". Si hay un bloque
            abierto (Food/Moov/Mind) también lo cierra. */}
        <div onClick={function() { setBloqueActivo(null); setTab('inicio'); }}
          style={{ display: 'flex', alignItems: 'center', gap: '9px', cursor: 'pointer' }}>
          <LogoMark size={28} />
          <span style={{ fontWeight: 900, fontSize: '17px', letterSpacing: '-0.04em', background: 'linear-gradient(135deg, #60a5fa, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Balancet</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--bt-text-2)' }}>{nombre}</span>

          {/* Botón tema oscuro/claro */}
          <button onClick={toggleTema} aria-label="Cambiar tema"
            style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid var(--bt-border)', background: 'var(--bt-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Icono nombre={darkMode ? 'Sun' : 'Moon'} tam={15} color="var(--bt-text-2)" opacidad={0.85} />
          </button>

          <button
            onClick={abrirPerfil}
            className="avatar-btn"
            aria-label="Perfil"
            style={{ width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--bt-primary)', background: 'var(--bt-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
            {foto
              ? <img src={foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontWeight: 900, color: 'var(--bt-primary)', fontSize: '15px' }}>{nombre.charAt(0).toUpperCase()}</span>}
          </button>
        </div>
      </header>

      {/* CONTENIDO */}
      <main key={(bloqueActivo || tab) + '-' + dayStamp} className="tab-enter">
        <LimiteError nombre={'pantalla:' + tab}>
          {/* key={tab} fuerza a React a montar de nuevo el contenido al cambiar
              de pestaña, y con ello se dispara la animación de entrada. Sin la
              key, React reutiliza el nodo y la transición no se ve. */}
          <div key={tab + '-' + (bloqueActivo || '')} className="bt-pantalla">
            {contenido}
          </div>
        </LimiteError>
      </main>

      {/* Tarea pendiente — aviso permanente hasta que la resuelva. No es un
          modal que se pueda cerrar y olvidar: Juan le ha pedido algo concreto
          y hasta que no lo haga, el plan no puede avanzar. */}
      {tareasPendientes.length > 0 && !enBloque && !splashActivo && tutorialVisto && !tareaAbierta ? (
        <button onClick={function() { setTareaAbierta(tareasPendientes[0]); }}
          style={{ position: 'fixed', left: '12px', right: '12px', bottom: '78px', zIndex: 26, padding: '13px 15px', borderRadius: '14px', border: 'none', backgroundImage: 'var(--bt-primary-gradient)', boxShadow: '0 6px 22px rgba(59,130,246,0.38)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '11px', textAlign: 'left' }}>
          <span style={{ fontSize: '19px', flexShrink: 0 }}>📋</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', color: '#fff', fontWeight: 800, fontSize: '13px' }}>{tareasPendientes[0].titulo}</span>
            <span style={{ display: 'block', color: 'rgba(255,255,255,0.85)', fontSize: '11px', marginTop: '1px' }}>
              Juan te ha pedido esto{tareasPendientes.length > 1 ? ' · y ' + (tareasPendientes.length - 1) + ' más' : ''}
            </span>
          </span>
          <Icono nombre="ChevronRight" tam={17} color="#ffffff" grosor={2.4} />
        </button>
      ) : null}

      {tareaAbierta ? (
        <TareaCliente
          tarea={tareaAbierta}
          user={user}
          onCerrar={function(completada) {
            if (completada) {
              setTareasPendientes(tareasPendientes.filter(function(t) { return t.id !== tareaAbierta.id; }));
            }
            setTareaAbierta(null);
          }} />
      ) : null}

      {verTutorialCambio && !splashActivo ? (
        <TutorialCambio onCerrar={function() { setVerTutorialCambio(false); }} />
      ) : null}

      {cestaAbierta ? (
        <CestaBalancet user={user} plan={plan} onCerrar={function() { setCestaAbierta(false); }} />
      ) : null}

      {/* BARRA INFERIOR: nav de 5 tabs, o "← Volver" dentro de un bloque */}
      <nav style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 30, background: 'var(--bt-bg)', borderTop: '1px solid var(--bt-border)' }} className="pb-safe">
        {enBloque ? (
          <button
            onClick={cerrarBloque}
            style={{ width: '100%', padding: '16px', background: 'none', border: 'none', color: 'var(--bt-primary)', fontWeight: 800, fontSize: '14px', cursor: 'pointer' }}>
            ← Volver
          </button>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '8px 4px' }}>
            {TABS.map(function(t) {
              var activa = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={function() { irATab(t.id); }}
                  data-tutorial={'nav-' + t.id}
                  className={'nav-item' + (activa ? ' active' : '')}
                  style={{ flex: 1, background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', padding: '6px 0', cursor: 'pointer', color: activa ? 'var(--bt-primary)' : 'var(--bt-text-3)' }}>
                  <Icono nombre={t.icon} tam={20} color={activa ? 'var(--bt-primary)' : 'var(--bt-text-3)'} grosor={activa ? 2.2 : 1.5} />
                  <span style={{ fontSize: '10px', fontWeight: activa ? 800 : 600 }}>{t.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </nav>
    </div>
  );
}

export default function AppRouter() {
  if (typeof window !== 'undefined' && window.location.pathname.indexOf('/cuestionario') !== -1) {
    return <CuestionarioApp />;
  }
  return <MainApp />;
}
