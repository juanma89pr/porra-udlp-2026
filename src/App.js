/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword, signInWithCustomToken, signOut } from "firebase/auth";
import { getFirestore, collection, doc, getDocs, onSnapshot, query, where, limit, writeBatch, updateDoc, orderBy, setDoc, getDoc, increment, deleteDoc, runTransaction, serverTimestamp, addDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { getMessaging, getToken } from "firebase/messaging";
import { getDatabase, ref, onValue, onDisconnect, set } from "firebase/database";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";

// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyDyxwLEkH36_7uXNeBYayIwZYI8IuAsDm4",
    authDomain: "porra-udlp-2026-v2.firebaseapp.com",
    projectId: "porra-udlp-2026-v2",
    storageBucket: "porra-udlp-2026-v2.appspot.com",
    messagingSenderId: "611441868159",
    appId: "1:611441868159:web:13008731a05c4321946e4a",
    measurementId: "G-J9T3S8SZT6",
    databaseURL: "https://porra-udlp-2026-v2-default-rtdb.europe-west1.firebasedatabase.app"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const messaging = getMessaging(app);

// Notificaciones push — pide permiso y registra el token del dispositivo,
// ligado al nombre del jugador (para poder dirigir avisos a una persona en
// concreto, como el admin, y no solo mandar a todos siempre).
//
// ⚠️ IMPORTANTE — falta un dato tuyo que no puedo inventar: la clave VAPID
// pública de tu proyecto Firebase. Se saca de Firebase Console → Configuración
// del proyecto → Cloud Messaging → "Certificados push web" → genera un par
// de claves si no tienes ninguna, y copia la clave pública aquí abajo, donde
// pone VAPID_KEY_PENDIENTE.
const VAPID_KEY = 'VAPID_KEY_PENDIENTE';

async function registrarNotificacionesPush(nombreUsuario) {
    try {
        if (!('Notification' in window) || VAPID_KEY === 'VAPID_KEY_PENDIENTE') return;
        var permiso = await Notification.requestPermission();
        if (permiso !== 'granted') return;
        var registro = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        var token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registro });
        if (token) {
            await setDoc(doc(db, 'notification_tokens', token), {
                usuario: nombreUsuario, actualizadoEn: serverTimestamp(),
            }, { merge: true });
        }
    } catch (e) {
        console.warn('No se pudo registrar notificaciones push:', e.message);
    }
}

const rtdb = getDatabase(app);
const storage = getStorage(app);
const functions = getFunctions(app, "europe-west1");

// --- DATOS DE LA APLICACIÓN 26/27 ---
// Lista de jugadores base de la liga padre (los 15 originales)
// Los nuevos jugadores hasta 20 se añaden dinámicamente desde Firestore
const JUGADORES_BASE = ["Juanma", "Lucy", "Antonio", "Mari", "Pedro", "Pedrito", "Himar", "Sarito", "Vicky", "Carmelo", "Laura", "Carlos", "José", "Claudio", "Javi"];
const APUESTA_NORMAL = 1;
const APUESTA_VIP = 2;
const MAX_JUGADORES = 20;
const JORNADAS_CUARENTENA = 5; // nuevos jugadores en período de prueba
const MIN_ACTIVACIONES_EL_OTRO = 3; // mínimo de activaciones durante la temporada
const PENALIZACION_EL_OTRO = 5; // puntos a restar si no se activa mínimo 3 veces

// 20 equipos LaLiga EA Sports 26/27 — confirmados (junio 2026)
// Bajan: Oviedo, Mallorca, Girona — Suben: Racing Santander, Deportivo, Málaga
// UDLP NO está en Primera este año (está en Segunda/Hypermotion)
const EQUIPOS_PRIMERA_DIVISION = [
    "FC Barcelona", "Real Madrid", "Atlético de Madrid", "Villarreal CF",
    "Real Betis", "Celta de Vigo", "Real Sociedad", "Getafe CF",
    "Athletic Club", "Sevilla FC", "Rayo Vallecano", "Deportivo Alavés",
    "RCD Espanyol", "Valencia CF", "Elche CF", "CA Osasuna",
    "Levante UD", "Racing de Santander", "RC Deportivo", "Málaga CF"
];

// API Football config
const API_FOOTBALL_KEY = process.env.REACT_APP_API_FOOTBALL_KEY || "";
const LEAGUE_ID_SEGUNDA = 141;
const LEAGUE_ID_PRIMERA = 140;

// Comparación de nombres tolerante a acentos y mayúsculas — antes "José"
// (con tilde) no cruzaba contra "Jose" (sin tilde) que a veces devuelve la
// API, y esos jugadores se quedaban sin encontrarse por una tontería de
// tipografía. Se usa en todos los sitios donde cruzamos nuestra plantilla
// (o nombres de equipo) contra lo que devuelve la API.
function normalizarTexto(s) {
    return (s || '').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita acentos (á->a, ñ->n, etc.)
        .trim();
}

function nombresSonSimilares(nombreA, nombreB) {
    var a = normalizarTexto(nombreA);
    var b = normalizarTexto(nombreB);
    if (!a || !b) return false;
    var ultimaA = a.split(' ').pop();
    var ultimaB = b.split(' ').pop();
    return a.indexOf(ultimaB) !== -1 || b.indexOf(ultimaA) !== -1;
}


// Busca el partido de Primera División de un equipo cerca de una fecha dada
// (la fecha de la jornada de Segunda). No usamos el ID numérico del equipo
// en la API (no tengo los 20 IDs verificados) — en su lugar pedimos TODOS
// los partidos de Primera en una ventana de ±4 días y buscamos el nuestro
// por nombre, igual que hace el resto de la app al cruzar plantillas.
async function buscarPartidoPrimera(equipoNombre, fechaReferenciaStr) {
    if (!API_FOOTBALL_KEY || !equipoNombre) return null;
    var fechaBase = fechaReferenciaStr ? new Date(fechaReferenciaStr) : new Date();
    if (isNaN(fechaBase.getTime())) fechaBase = new Date();
    var desde = new Date(fechaBase); desde.setDate(desde.getDate() - 4);
    var hasta = new Date(fechaBase); hasta.setDate(hasta.getDate() + 4);
    var fmt = function(d) { return d.toISOString().slice(0, 10); };

    // season=2026 confirmado directamente en el panel de API-Football para
    // La Liga 26/27 (temporada activa: 2026-08-15 a 2027-05-30) — ya no hace
    // falta probar varias, era justo lo único que quedaba por confirmar.
    try {
        var url = 'https://v3.football.api-sports.io/fixtures?league=' + LEAGUE_ID_PRIMERA +
            '&season=2026&from=' + fmt(desde) + '&to=' + fmt(hasta);
        var res = await fetch(url, { headers: { 'x-apisports-key': API_FOOTBALL_KEY } });
        var data = await res.json();
        var partidos = data.response || [];
        var encontrado = partidos.find(function(p) {
            return nombresSonSimilares(p.teams.home.name, equipoNombre) || nombresSonSimilares(p.teams.away.name, equipoNombre);
        });
        if (encontrado) {
            var esLocal = nombresSonSimilares(encontrado.teams.home.name, equipoNombre);
            return {
                fixtureId: encontrado.fixture.id,
                fecha: encontrado.fixture.date,
                rival: esLocal ? encontrado.teams.away.name : encontrado.teams.home.name,
                esLocal: esLocal,
                estadoCorto: encontrado.fixture.status.short,
                golesEquipo: esLocal ? encontrado.goals.home : encontrado.goals.away,
                golesRival: esLocal ? encontrado.goals.away : encontrado.goals.home,
            };
        }
    } catch (e) { console.warn('Error buscando partido de Primera:', e.message); }
    return null;
}

// Trae TODOS los partidos de Primera en una ventana de fechas — a diferencia
// de buscarPartidoPrimera (que busca UN equipo concreto), esto da la
// jornada entera de golpe, para poder verla completa de un vistazo (uso de
// admin) en vez de tener que consultar equipo por equipo.
async function buscarJornadaCompletaPrimera(fechaReferenciaStr, diasVentana) {
    if (!API_FOOTBALL_KEY) return [];
    var fechaBase = fechaReferenciaStr ? new Date(fechaReferenciaStr) : new Date();
    if (isNaN(fechaBase.getTime())) fechaBase = new Date();
    var ventana = diasVentana || 4;
    var desde = new Date(fechaBase); desde.setDate(desde.getDate() - ventana);
    var hasta = new Date(fechaBase); hasta.setDate(hasta.getDate() + ventana);
    var fmt = function(d) { return d.toISOString().slice(0, 10); };

    // season=2026 confirmado directamente en el panel de API-Football.
    try {
        var url = 'https://v3.football.api-sports.io/fixtures?league=' + LEAGUE_ID_PRIMERA +
            '&season=2026&from=' + fmt(desde) + '&to=' + fmt(hasta);
        var res = await fetch(url, { headers: { 'x-apisports-key': API_FOOTBALL_KEY } });
        var data = await res.json();
        var partidos = data.response || [];
        if (partidos.length > 0) {
            return partidos.map(function(p) {
                return {
                    fixtureId: p.fixture.id,
                    fecha: p.fixture.date,
                    local: p.teams.home.name,
                    visitante: p.teams.away.name,
                    estadoCorto: p.fixture.status.short,
                    golesLocal: p.goals.home,
                    golesVisitante: p.goals.away,
                };
            }).sort(function(a, b) { return new Date(a.fecha) - new Date(b.fecha); });
        }
    } catch (e) { console.warn('Error buscando jornada completa de Primera:', e.message); }
    return [];
}

// Tabla de puntuación Mis 5 Estrellas (calculada vía API)
const PUNTOS_ESTRELLAS = {
    titular: 2,
    suplente: 1,
    gol_portero_defensa: 8,
    gol_centrocampista: 6,
    gol_delantero: 5,
    asistencia: 3,
    porteria_cero_portero: 4,
    porteria_cero_defensa: 2,
    amarilla: -1,
    roja: -3,
    penalti_fallado: -2,
    gol_propia: -2,
};

// Plantilla de fallback (usada si la API no está disponible)
// Se actualiza automáticamente desde API-Football al cargar la app
// Plantilla real UD Las Palmas 26/27 — pretemporada Marbella (22/07/2026)
// Fotos: se cargan desde API-Football o ESPN CDN como fallback
// Team ID en API-Football: 534 (UD Las Palmas) — confirmado en directo por
// el admin desde el Live Tester del panel de API-Football (antes tenía un
// 275 mal puesto desde el principio, que era otro equipo distinto; por eso
// nunca cruzaba ningún nombre de jugador con la plantilla real).
const API_TEAM_ID_UDLP = 534;
// Plantilla oficial UD Las Palmas 26/27
// Fotos: API-Football media CDN (confirmados) + ui-avatars fallback
// Para jugadores sin apiId usamos foto de Wikipedia cuando disponible
const PLANTILLA_FALLBACK = [
    // PORTEROS
    { dorsal:"1",  nombre:"Dinko Horkas",       posicion:"Portero",        apiId:430567,  wikiImg:'' },
    { dorsal:"13", nombre:"José Antonio Caro",  posicion:"Portero",        apiId:0,       wikiImg:'' },
    { dorsal:"33", nombre:"Adri Suárez",        posicion:"Portero",        apiId:0,       wikiImg:'' },
    // DEFENSAS
    { dorsal:"2",  nombre:"Marvin Park",        posicion:"Defensa",        apiId:324219,  wikiImg:'' },
    { dorsal:"5",  nombre:"Viti Rozada",        posicion:"Defensa",        apiId:0,       wikiImg:'' },
    { dorsal:"4",  nombre:"Álex Suárez",        posicion:"Defensa",        apiId:289254,  wikiImg:'' },
    { dorsal:"15", nombre:"Juanma Herzog",      posicion:"Defensa",        apiId:284516,  wikiImg:'' },
    { dorsal:"?",  nombre:"Valentín Pezzolesi", posicion:"Defensa",        apiId:0,       wikiImg:'' }, // dorsal 23 que tenía aquí ahora es de Andrés Rodríguez (fichaje nuevo) — revisar dorsal real de Pezzolesi
    { dorsal:"17", nombre:"Enrique Clemente",   posicion:"Defensa",        apiId:0,       wikiImg:'' },
    { dorsal:"23", nombre:"Andrés Rodríguez",   posicion:"Defensa",        apiId:0,       wikiImg:'' }, // NUEVO fichaje 26/27 — dorsal 23 confirmado (viene de la cesión de Cristian Gutiérrez)
    { dorsal:"?",  nombre:"Giovanni Bonfanti",  posicion:"Defensa",        apiId:0,       wikiImg:'' }, // NUEVO — cedido por la Atalanta, dorsal aún sin confirmar
    // CENTROCAMPISTAS
    { dorsal:"8",  nombre:"Sergio Ruiz",        posicion:"Centrocampista", apiId:0,       wikiImg:'' }, // dorsal actualizado: 8 (antes tenía 12 en esta lista)
    { dorsal:"20", nombre:"Kirian Rodríguez",   posicion:"Centrocampista", apiId:37073,   wikiImg:'' },
    { dorsal:"26", nombre:"Enzo Loiodice",      posicion:"Centrocampista", apiId:290060,  wikiImg:'' },
    { dorsal:"?",  nombre:"Mateo Acimovic",     posicion:"Centrocampista", apiId:0,       wikiImg:'' }, // dorsal 8 liberado (ahora es de Sergio Ruiz) — dorsal real sin confirmar todavía
    { dorsal:"11", nombre:"Iñaki González",     posicion:"Centrocampista", apiId:286026,  wikiImg:'' },
    { dorsal:"18", nombre:"Edward Cedeño",      posicion:"Centrocampista", apiId:0,       wikiImg:'' }, // dorsal actualizado: 18 (antes tenía 16 en esta lista) — OJO: puede solaparse con el de Miyashiro, revisar
    // ATACANTES / MEDIAPUNTA
    { dorsal:"14", nombre:"Manu Fuster",        posicion:"Mediapunta",     apiId:289255,  wikiImg:'' },
    { dorsal:"?",  nombre:"Taisei Miyashiro",   posicion:"Mediapunta",     apiId:320742,  wikiImg:'' }, // RESTAURADO — sigue en la plantilla (japonés, cedido por el Vissel Kobe, volvió de cesión el 30/06/2026). Dorsal en duda: fuentes de mitad de temporada lo daban con el 18, pero ese número ahora aparece asignado a Cedeño — confirmar cuál es el actual
    { dorsal:"22", nombre:"Ale García",         posicion:"Mediapunta",     apiId:0,       wikiImg:'' }, // dorsal actualizado: 22 (antes tenía 10 en esta lista)
    { dorsal:"7",  nombre:"Jefté Betancor",     posicion:"Delantero",      apiId:0,       wikiImg:'' }, // NUEVO fichaje 26/27 — dorsal 7 confirmado
    // DELANTEROS
    { dorsal:"9",  nombre:"Jeremía Recoba",     posicion:"Delantero",      apiId:366988,  wikiImg:'' },
    { dorsal:"19", nombre:"Jesé Rodríguez",     posicion:"Delantero",      apiId:1831,    wikiImg:'' },
    { dorsal:"?",  nombre:"Sandro Ramírez",     posicion:"Delantero",      apiId:18892,   wikiImg:'' }, // RESTAURADO — sigue en la plantilla según foro udlaspalmas.NET (31/07/2026). El dorsal 7 que tenía antes es ahora de Jefté Betancor — confirmar su dorsal actual
    { dorsal:"41", nombre:"Elías Romero",       posicion:"Delantero",      apiId:0,       wikiImg:'' },
].map(function(j) {
    // Mapa de IDs de Sofascore — CDN público, sin CORS, fotos reales
    var sofascoreIds = {
        'Dinko Horkas': 868411, 'Marvin Park': 942489, 'Álex Suárez': 889668,
        'Juanma Herzog': 837459, 'Kirian Rodríguez': 964985, 'Enzo Loiodice': 1002088,
        'Iñaki González': 1190406, 'Manu Fuster': 856321, 'Taisei Miyashiro': 1030799,
        'Jeremía Recoba': 1640614, 'Jesé Rodríguez': 98637, 'Sandro Ramírez': 477615,
        'Enrique Clemente': 872344, 'Viti Rozada': 921034,
        // Añadidos — resto de la plantilla
        'José Antonio Caro': 847993, 'Sergio Ruiz': 2045616, 'Valentín Pezzolesi': 1893819,
        'Ale García': 1130503, 'Elías Romero': 2045614,
        // Sin ID confirmado todavía — usan avatar de iniciales:
        // Adri Suárez, Edward Cedeño, Mateo Acimovic, Andrés Rodríguez,
        // Giovanni Bonfanti, Jefté Betancor
    };
    var sofaId = sofascoreIds[j.nombre];
    var foto = sofaId
        ? 'https://img.sofascore.com/api/v1/player/' + sofaId + '/image'
        : 'https://ui-avatars.com/api/?name=' + encodeURIComponent(j.nombre) + '&background=001F6B&color=FFD700&size=120&bold=true&font-size=0.38&length=2';
    return { ...j, imageUrl: foto };
});

// ============================================================================
// --- ESTILOS PREMIUM ---
// ============================================================================
const colors = {
    deepBlue: '#001F6B', blue: '#001F6B', golden: '#FFD700', goldenDark: '#d4af37', yellow: '#FFD700', gold: '#FFD700', silver: '#aaa',
    lightText: '#f0f0f0', darkText: '#f0f0f0', danger: '#e63946', success: '#10b981', warning: '#d4af37',
    darkUI: '#ffffff', darkUIAlt: '#f5f5f5',
    status: { 'Próximamente': '#6c757d', 'Pre-apertura': '#d4af37', 'Abierta': '#10b981', 'Cerrada': '#e63946', 'En vivo': '#dc3545', 'Finalizada': '#d4af37' }
};

const styles = {
    colors,
    container: { display: 'flex', flexDirection: 'column', width: '100%', minHeight: '100dvh', background: 'linear-gradient(160deg,#080e24 0%,#0a1228 100%)', fontFamily: "'Teko', sans-serif" },
    card: { width: '100%', flex: 1, backgroundColor: 'transparent', color: '#f0f0f0', padding: '0', minHeight: '100dvh' },
    title: { fontFamily: "'Teko', sans-serif", color: '#FFD700', textTransform: 'uppercase', letterSpacing: '2px', textAlign: 'center', borderBottom: '2px solid rgba(255,215,0,0.3)', paddingBottom: '10px', marginBottom: '20px', fontSize: 'clamp(1.6rem, 5vw, 2.2rem)', fontWeight: 700 },
    mainButton: { fontFamily: "'Oswald', sans-serif", padding: '14px 28px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', border: 'none', borderRadius: '30px', background: `linear-gradient(135deg, ${colors.goldenDark}, ${colors.golden})`, color: '#000', marginTop: '20px', transition: 'all 0.3s ease', textTransform: 'uppercase', letterSpacing: '1px', boxShadow: '0 4px 12px rgba(212,175,55,0.35)' },
    secondaryButton: { fontFamily: "'Montserrat', sans-serif", padding: '10px 20px', fontSize: '0.9rem', cursor: 'pointer', border: `1px solid ${colors.deepBlue}`, borderRadius: '20px', backgroundColor: 'rgba(0,31,107,0.05)', color: colors.deepBlue, transition: 'all 0.3s ease', textTransform: 'uppercase', fontWeight: 'bold' },
    placeholder: { padding: '40px 20px', backgroundColor: '#f9f9f9', border: `1px dashed ${colors.goldenDark}`, borderRadius: '16px', textAlign: 'center', color: '#555' },
    epicSplashContainer: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: '#001F6B', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', zIndex: 9999, animation: 'fadeOut 0.5s ease 2.5s forwards' },
    epicSplashSubtitle: { fontFamily: "'Montserrat', sans-serif", fontSize: 'clamp(1rem, 4vw, 1.5rem)', fontWeight: '600', color: '#FFD700', letterSpacing: '5px', marginBottom: '10px', textTransform: 'uppercase' },
    epicSplashTitle: { fontFamily: "'Oswald', sans-serif", fontSize: 'clamp(3rem, 10vw, 5.5rem)', fontWeight: 'bold', color: '#ffffff', textTransform: 'uppercase', textAlign: 'center', animation: 'pulse 1.5s infinite alternate', lineHeight: 1.1 },
    navbar: { display: 'none' },
    navButton: { display: 'none' },
    navButtonActive: { display: 'none' },
    logoutButton: { display: 'none' },
    form: { backgroundColor: '#f9f9f9', padding: '30px', borderRadius: '20px', marginTop: '20px', border: '1px solid rgba(0,0,0,0.08)' },
    formSectionTitle: { fontFamily: "'Oswald', sans-serif", color: colors.deepBlue, fontSize: '1.4rem', textAlign: 'center', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '1px' },
    formGroup: { marginBottom: '25px', backgroundColor: '#ffffff', padding: '20px', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' },
    label: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginBottom: '15px', color: '#555', fontWeight: '600', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '1px' },
    oddsBadge: { backgroundColor: colors.goldenDark, color: '#000', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', fontFamily: "'Montserrat', sans-serif" },
    input: { width: 'calc(100% - 24px)', padding: '14px', border: '1px solid rgba(0,0,0,0.15)', borderRadius: '12px', backgroundColor: '#ffffff', color: '#0a0a0a', fontSize: '1rem', fontFamily: "'Montserrat', sans-serif", transition: 'border 0.3s' },
    // (estilo jokerInput eliminado — el Jóquer ya no existe en la app)
    miJornadaMatchInfo: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', width: '100%', margin: '25px 0', flexWrap: 'nowrap' },
    miJornadaScoreInputs: { display: 'flex', alignItems: 'center', gap: '10px', flex: '0 0 auto' },
    miJornadaTeamLogo: { width: 'clamp(60px, 18vw, 90px)', height: 'clamp(60px, 18vw, 90px)', objectFit: 'contain', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))' },
    resultInput: { width: '65px', height: '65px', textAlign: 'center', padding: '10px', border: `2px solid ${colors.goldenDark}`, borderRadius: '16px', backgroundColor: '#f9f9f9', color: colors.deepBlue, fontSize: '2rem', fontFamily: "'Oswald', sans-serif", fontWeight: 'bold' },
    separator: { fontSize: '1.5rem', fontWeight: 'bold', color: '#555' },
    checkbox: { width: '22px', height: '22px', accentColor: colors.golden, cursor: 'pointer' },
    message: { marginTop: '20px', padding: '15px', borderRadius: '12px', backgroundColor: colors.success, color: '#fff', textAlign: 'center', fontWeight: 'bold', fontFamily: "'Montserrat', sans-serif" },
    table: { width: '100%', marginTop: '20px', borderCollapse: 'separate', borderSpacing: '0 8px', color: '#0a0a0a' },
    th: { backgroundColor: 'transparent', color: '#555', padding: '12px', borderBottom: `2px solid ${colors.golden}`, textAlign: 'left', textTransform: 'uppercase', fontFamily: "'Oswald', sans-serif", fontSize: '0.9rem', letterSpacing: '1px' },
    tr: { backgroundColor: '#f9f9f9', transition: 'transform 0.2s ease', borderRadius: '12px' },
    td: { padding: '15px', border: 'none', fontSize: '0.95rem' },
    tdRank: { padding: '15px', border: 'none', fontFamily: "'Oswald', sans-serif", fontWeight: 'bold', fontSize: '1.1rem', textAlign: 'center', color: colors.golden },
    tdTotalPoints: { padding: '15px', border: 'none', fontFamily: "'Oswald', sans-serif", fontWeight: 'bold', fontSize: '1.3rem', textAlign: 'center', color: colors.golden },
    vipBanner: { background: `linear-gradient(135deg, rgba(212,175,55,0.2), rgba(0,0,0,0.5))`, border: `1px solid ${colors.goldenDark}`, color: colors.golden, fontWeight: 'bold', padding: '15px', borderRadius: '12px', textAlign: 'center', marginBottom: '25px', fontSize: '1.1rem', fontFamily: "'Oswald', sans-serif", letterSpacing: '1px', backdropFilter: 'blur(5px)' },
    prizeBannerFinal: { backgroundColor: 'rgba(0,0,0,0.4)', border: `1px solid rgba(255,215,0,0.3)`, borderRadius: '16px', padding: '20px', marginBottom: '30px', boxShadow: `0 10px 30px rgba(0,0,0,0.5)` },
    prizeBannerTitle: { fontFamily: "'Oswald', sans-serif", color: colors.golden, fontSize: '1.3rem', textAlign: 'center', textTransform: 'uppercase', marginBottom: '15px', letterSpacing: '1px' },
    prizeList: { display: 'flex', flexDirection: 'column', gap: '10px', fontFamily: "'Montserrat', sans-serif" },
    prizeItem: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', padding: '12px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' },
    h2hContainer: { backgroundColor: 'rgba(0,0,0,0.2)', border: `1px solid rgba(255,215,0,0.2)`, borderRadius: '12px', padding: '20px', marginBottom: '25px', textAlign: 'center' },
    pasaButtonActive: { flex: 1, padding: '15px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', border: 'none', borderRadius: '12px', background: `linear-gradient(135deg, ${colors.goldenDark}, ${colors.golden})`, color: colors.darkText, transition: 'transform 0.2s ease', boxShadow: `0 8px 20px rgba(212,175,55,0.3)`, textTransform: 'uppercase', fontFamily: "'Oswald', sans-serif" },
    pasaButtonInactive: { flex: 1, padding: '15px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', border: `1px solid rgba(255,215,0,0.3)`, borderRadius: '12px', backgroundColor: 'rgba(0,0,0,0.4)', color: colors.silver, transition: 'all 0.3s ease', textTransform: 'uppercase', fontFamily: "'Oswald', sans-serif" },
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 10, 20, 0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' },
    modalContent: { backgroundColor: 'rgba(0, 29, 61, 0.95)', padding: '40px 30px', borderRadius: '24px', width: '90%', maxWidth: '500px', border: `1px solid rgba(255, 215, 0, 0.3)`, boxShadow: `0 30px 60px rgba(0,0,0,0.8), inset 0 0 30px rgba(255,215,0,0.05)`, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' },
    modalDots: { display: 'flex', justifyContent: 'center', gap: '8px', margin: '25px 0' },
    modalDotActive: { width: '25px', height: '6px', borderRadius: '3px', backgroundColor: colors.golden, transition: 'all 0.3s' },
    modalDotInactive: { width: '10px', height: '6px', borderRadius: '3px', backgroundColor: 'rgba(255,255,255,0.2)', transition: 'all 0.3s' },
    bracketContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', margin: '30px 0', padding: '25px', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '20px', border: `1px solid rgba(255,215,0,0.15)` },
    bracketMatchup: { display: 'flex', justifyContent: 'space-around', width: '100%', gap: '15px', alignItems: 'center', borderBottom: `1px solid rgba(255,255,255,0.05)`, paddingBottom: '20px' },
    bracketTeam: { flex: 1, textAlign: 'center', padding: '15px', backgroundColor: 'rgba(0,0,0,0.5)', border: `1px solid rgba(255,255,255,0.1)`, borderRadius: '12px', fontWeight: '600', fontSize: '1rem', color: colors.silver },
    bracketWinner: { backgroundColor: 'rgba(212, 175, 55, 0.1)', borderColor: colors.golden, color: colors.golden, boxShadow: `0 0 20px rgba(212,175,55,0.15)`, fontWeight: 'bold' },
    bracketFinal: { marginTop: '10px', textAlign: 'center', padding: '25px', background: `linear-gradient(135deg, rgba(212,175,55,0.15), rgba(0,0,0,0.5))`, border: `1px solid ${colors.goldenDark}`, borderRadius: '16px', width: '90%', boxShadow: `0 10px 30px rgba(0,0,0,0.3)` },
    secrecyBadge: { display: 'inline-block', backgroundColor: 'rgba(230,57,70,0.2)', color: colors.danger, border: `1px solid ${colors.danger}`, padding: '4px 12px', borderRadius: '15px', fontSize: '0.75rem', fontWeight: 'bold', marginLeft: '10px', textTransform: 'uppercase' },
    liveBanner: { position: 'sticky', top: 0, left: 0, width: '100%', background: `linear-gradient(90deg, #8b0000, ${colors.danger}, #8b0000)`, color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '12px', zIndex: 100, fontFamily: "'Oswald', sans-serif", fontSize: '1.1rem', letterSpacing: '2px', animation: 'blink-live 2s infinite', boxShadow: '0 5px 15px rgba(0,0,0,0.5)' },
    userList: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '15px', marginTop: '40px' },
    userButton: { position: 'relative', width: '100%', padding: '20px 10px', fontSize: '1.1rem', fontWeight: '600', cursor: 'pointer', border: `1px solid rgba(255,255,255,0.1)`, borderRadius: '16px', backgroundColor: 'rgba(0,0,0,0.4)', color: colors.silver, transition: 'all 0.3s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', backdropFilter: 'blur(5px)' },
    loginProfileIconCircle: { width: '55px', height: '55px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '2rem', color: colors.darkText, background: `linear-gradient(135deg, ${colors.goldenDark}, ${colors.golden})`, boxShadow: '0 5px 15px rgba(0,0,0,0.5)' },
    adminJornadaItem: { padding: '25px', backgroundColor: 'rgba(0,0,0,0.3)', border: `1px solid rgba(255,215,0,0.2)`, borderRadius: '16px', marginBottom: '25px' },
    adminSelect: { width: '100%', padding: '12px', border: `1px solid rgba(255,215,0,0.3)`, borderRadius: '10px', backgroundColor: 'rgba(0,0,0,0.6)', color: colors.golden, fontWeight: 'bold', fontFamily: "'Montserrat', sans-serif" },
    saveButton: { padding: '12px 20px', border: 'none', borderRadius: '10px', backgroundColor: colors.success, color: 'white', cursor: 'pointer', textTransform: 'uppercase', fontWeight: 'bold', fontFamily: "'Oswald', sans-serif", letterSpacing: '1px' },
    liveAdminContainer: { marginTop: '30px', paddingTop: '25px', borderTop: `1px solid rgba(230,57,70,0.3)`, backgroundColor: 'rgba(230, 57, 70, 0.05)', padding: '20px', borderRadius: '12px' },
    betPill: { display: 'inline-block', padding: '6px 12px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 'bold', fontFamily: "'Oswald', sans-serif", letterSpacing: '1px', border: `1px solid rgba(255,255,255,0.1)`, backgroundColor: 'rgba(0,0,0,0.5)', color: colors.silver, margin: '2px' },
    betPillWin: { display: 'inline-block', padding: '6px 12px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 'bold', fontFamily: "'Oswald', sans-serif", letterSpacing: '1px', border: `1px solid ${colors.success}`, backgroundColor: 'rgba(16,185,129,0.15)', color: colors.success, margin: '2px', boxShadow: `0 0 10px rgba(16,185,129,0.5)` },
    graphContainer: { margin: '25px 0', padding: '25px', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: '16px', border: `1px solid rgba(255,215,0,0.15)` },
    graphBarWrapper: { marginBottom: '15px', textAlign: 'left' },
    graphBarLabel: { display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', color: colors.silver, marginBottom: '5px', fontWeight: 'bold', fontFamily: "'Montserrat', sans-serif" },
    graphBarBg: { height: '14px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '7px', overflow: 'hidden' },
    graphBarFill: { height: '100%', background: `linear-gradient(90deg, ${colors.goldenDark}, ${colors.golden})`, transition: 'width 1s ease-out' }
};

// ============================================================================
// --- LÓGICA Y HELPERS ---
// ============================================================================
const formatFullDateTime = (firebaseDate) => { if (!firebaseDate || !firebaseDate.seconds) return 'Fecha por confirmar'; return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(firebaseDate.seconds * 1000)).replace(',', ' a las'); };

const getNombreJornada = (num) => {
    if (num === 43) return "IDA SEMIFINAL"; if (num === 44) return "VUELTA SEMIFINAL";
    if (num === 45) return "IDA FINAL"; if (num === 46) return "VUELTA FINAL";
    return `JORNADA ${num}`;
};

// --- CORRECCIÓN DEFINITIVA: LÓGICA FLEXIBLE DE TEXTOS (PASA/NO PASA, GANA/PIERDE) ---
const check1x2 = (apuesta, real, tipoPartido, desenlace) => {
    const ap = (apuesta || '').toLowerCase().trim();
    const re = (real || '').toLowerCase().trim();
    const des = (desenlace || '').toLowerCase().trim();

    if (tipoPartido === 'vuelta_semi' || tipoPartido === 'vuelta_final') {
        if (des.includes('no pasa') && ap.includes('no pasa')) return true;
        if (des.includes('pasa') && !des.includes('no pasa') && ap.includes('pasa') && !ap.includes('no pasa')) return true;
        if (des.includes('no asciende') && ap.includes('no asciende')) return true;
        if (des.includes('asciende') && !des.includes('no asciende') && ap.includes('asciende') && !ap.includes('no asciende')) return true;
    } else {
        if (re.includes('empat') && ap.includes('empat')) return true;
        if (re.includes('pierde') && ap.includes('pierde')) return true;
        if (re.includes('gana') && ap.includes('gana')) return true;
    }
    return false;
};

const calculateProvisionalPoints = (pronostico, liveData, jornada) => {
    if (!pronostico || !liveData || !jornada || jornada.estado !== 'En vivo') return 0;
    let ptos = 0; const esVip = jornada.esVip || false; 
    
    const gL = parseInt(liveData.golesLocal) || 0;
    const gV = parseInt(liveData.golesVisitante) || 0;
    
    let exactoAcertado = false;
    
    if (pronostico.golesLocal !== '' && pronostico.golesVisitante !== '') {
        const pL = parseInt(pronostico.golesLocal); const pV = parseInt(pronostico.golesVisitante);
        if (gL === pL && gV === pV) exactoAcertado = true;
    }

    if (exactoAcertado) ptos += esVip ? 6 : 3;

    let rReal = '';
    if (jornada.equipoLocal === "UD Las Palmas") { rReal = gL > gV ? 'gana' : (gL < gV ? 'pierde' : 'empate'); } 
    else if (jornada.equipoVisitante === "UD Las Palmas") { rReal = gV > gL ? 'gana' : (gV < gL ? 'pierde' : 'empate'); } 
    else { rReal = gL > gV ? 'gana' : (gL < gV ? 'pierde' : 'empate'); }

    if (check1x2(pronostico.resultado1x2, rReal, jornada.tipoPartido, jornada.desenlace)) {
        ptos += esVip ? 2 : 1;
    }

    const golReal = (liveData.primerGoleador || '').trim().toLowerCase();
    const golAp = (pronostico.goleador || '').trim().toLowerCase();
    if (gL > 0 || gV > 0 || golReal === "sg") {
        if (pronostico.sinGoleador && golReal === "sg") ptos += 1;
        else if (!pronostico.sinGoleador && golAp !== "" && golAp === golReal && golReal !== "sg") ptos += esVip ? 4 : 2;
    }
    return ptos;
};

// ============================================================================
// --- COMPONENTES UI Y MODALES BASE ---
// ============================================================================
// Avatares emoji predefinidos por categoría
// ============================================================================
// --- PERFILES — foto real con filtro UDLP (prioridad) + emojis fútbol ---
// ============================================================================

// Set curado de "cultura fútbol / redes" para quien no suba foto.
// Renderizados en badge premium (gradiente azul→dorado, no emoji plano).
const EMOJIS_FUTBOL = ["🐐","🔥","👑","⚡","💯","🏆","🎯","🦁","🧠","🥶","😈","⭐","🥇","🛡️","⚔️","🚀"];

// Aplica un filtro duotono azul/dorado UDLP a una imagen y devuelve un Blob JPEG.
// sombras -> #001F6B (azul UDLP), luces -> #FFD700 (dorado UDLP)
// Aplica un filtro duotono azul/dorado UDLP a una imagen y devuelve un Blob JPEG.
// sombras -> #001F6B (azul UDLP), luces -> #FFD700 (dorado UDLP)
// Nunca se queda colgada: si algo falla en el canvas (pasa con ciertos formatos
// raros o navegadores embebidos como el de WhatsApp), rechaza la promesa en vez
// de quedarse esperando para siempre.
function aplicarFiltroUDLP(imgElement) {
    return new Promise(function(resolve, reject) {
        try {
            var SIZE = 480;
            var canvas = document.createElement('canvas');
            canvas.width = SIZE; canvas.height = SIZE;
            var ctx = canvas.getContext('2d');

            // Recorte centrado cuadrado (cover)
            var iw = imgElement.naturalWidth, ih = imgElement.naturalHeight;
            if (!iw || !ih) { reject(new Error('La imagen no tiene dimensiones válidas.')); return; }
            var side = Math.min(iw, ih);
            var sx = (iw - side) / 2, sy = (ih - side) / 2;
            ctx.drawImage(imgElement, sx, sy, side, side, 0, 0, SIZE, SIZE);

            var data = ctx.getImageData(0, 0, SIZE, SIZE);
            var px = data.data;
            var shadow = [0, 31, 107];   // #001F6B
            var highlight = [255, 215, 0]; // #FFD700

            for (var i = 0; i < px.length; i += 4) {
                var lum = (0.299*px[i] + 0.587*px[i+1] + 0.114*px[i+2]) / 255;
                px[i]   = shadow[0] + (highlight[0]-shadow[0]) * lum;
                px[i+1] = shadow[1] + (highlight[1]-shadow[1]) * lum;
                px[i+2] = shadow[2] + (highlight[2]-shadow[2]) * lum;
            }
            ctx.putImageData(data, 0, 0);
            canvas.toBlob(function(blob) {
                if (!blob) { reject(new Error('El navegador no pudo procesar esta imagen.')); return; }
                resolve(blob);
            }, 'image/jpeg', 0.9);
        } catch (err) {
            reject(err);
        }
    });
}

// Envuelve cualquier promesa con un límite de tiempo — para que nada se quede
// "procesando" para siempre si el navegador se cuelga con un formato raro.
function conTimeout(promise, ms, mensajeTimeout) {
    return new Promise(function(resolve, reject) {
        var t = setTimeout(function() { reject(new Error(mensajeTimeout)); }, ms);
        promise.then(function(v) { clearTimeout(t); resolve(v); },
                      function(e) { clearTimeout(t); reject(e); });
    });
}

// Icono de perfil unificado: foto real filtrada > emoji fútbol > balón por defecto.
function IconoPerfil({ perfil, size }) {
    var foto = perfil && perfil.foto;
    if (foto) {
        return (
            <div style={{width:size,height:size,borderRadius:'50%',overflow:'hidden',
                background:'#001F6B',boxShadow:'0 0 0 2px #FFD700'}}>
                <img src={foto} alt="" style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}} />
            </div>
        );
    }
    var emoji = (perfil && perfil.emoji) || '⚽';
    return (
        <div style={{width:size,height:size,borderRadius:'50%',
            background:'linear-gradient(135deg,#001F6B,#003a9e)',
            display:'flex',alignItems:'center',justifyContent:'center',
            fontSize:size*0.48,boxShadow:'0 0 0 2px #FFD700'}}>
            {emoji}
        </div>
    );
}

// Componente de avatar de jugador con burbuja de El Otro
// Burbuja de ayuda desplegable — pulsas el título y se abre/cierra. Estilo
// único reutilizado en El Otro Equipo y en Estrellas, para que toda la
// información de reglas se vea y se comporte igual en toda la app.
function AcordeonAyuda({ icono, titulo, children, abiertoPorDefecto }) {
    var [abierto, setAbierto] = useState(!!abiertoPorDefecto);
    return (
        <div style={{marginBottom:10,borderRadius:14,overflow:'hidden',
            border: abierto ? '1px solid rgba(0,31,107,0.18)' : '1px solid rgba(0,31,107,0.1)',
            background: abierto ? 'rgba(0,31,107,0.03)' : '#fff',
            boxShadow: abierto ? '0 2px 8px rgba(0,31,107,0.06)' : 'none',
            transition:'all .2s ease'}}>
            <button onClick={function(){setAbierto(function(v){return !v;});}} style={{
                width:'100%',display:'flex',alignItems:'center',gap:10,padding:'13px 14px',
                background:'none',border:'none',cursor:'pointer',textAlign:'left'}}>
                <span style={{fontSize:16,flexShrink:0}}>{icono}</span>
                <span style={{flex:1,fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:1.5,color:'#001F6B',textTransform:'uppercase',fontWeight:600}}>{titulo}</span>
                <span style={{fontSize:11,color:'rgba(0,31,107,0.35)',flexShrink:0}}>{abierto ? 'Ocultar' : 'Ver'}</span>
                <span style={{fontSize:11,color:'rgba(0,31,107,0.4)',display:'inline-block',
                    transform: abierto ? 'rotate(180deg)' : 'none', transition:'transform .2s ease',flexShrink:0}}>▼</span>
            </button>
            {abierto && (
                <div style={{padding:'0 14px 14px 14px'}}>
                    {children}
                </div>
            )}
        </div>
    );
}

// Variable de módulo, actualizada en vivo por un listener en App() sobre
// configuracion/mostrarApellidos — así el admin puede activar/desactivar el
// recorte automático de apellidos desde el panel, sin tocar código.
// Por defecto (false) se recortan los apellidos, que es el comportamiento
// que se pidió mantener.
var MOSTRAR_APELLIDOS = false;

// Nombre a mostrar al resto de la app — automático, sin que nadie tenga que
// tocar nada: si alguien se registró con apellido ("María García"), aquí
// mismo se recorta a "María" para todo lo que ven los demás. Si hay un apodo
// puesto a mano, ese manda por encima de todo. El admin puede desactivar
// este recorte entero desde el panel (MOSTRAR_APELLIDOS).
function nombreVisible(nombreCrudo, perfil) {
    if (perfil && perfil.apodo) return perfil.apodo;
    if (!nombreCrudo) return nombreCrudo || '';
    if (MOSTRAR_APELLIDOS) return nombreCrudo;
    // Quita el apellido siempre — incluso si perfil llega undefined (que pasa
    // en algunos sitios donde el mapa de perfiles todavía no se ha cargado o
    // no tiene entrada para este nombre).
    var partes = nombreCrudo.trim().split(/\s+/);
    return partes[0];
}

var hashPin = async function(nombre, pin) {
    var str = nombre.toLowerCase().trim() + ':' + pin;
    var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(function(b) { return b.toString(16).padStart(2,'0'); }).join('');
};

var LOGOS_EQUIPOS = {
    // ── UD LAS PALMAS ────────────────────────────────────────────────────────
    'UD Las Palmas':           'https://upload.wikimedia.org/wikipedia/en/thumb/e/e5/UD_Las_Palmas_logo.svg/120px-UD_Las_Palmas_logo.svg.png',
    'Las Palmas':              'https://upload.wikimedia.org/wikipedia/en/thumb/e/e5/UD_Las_Palmas_logo.svg/120px-UD_Las_Palmas_logo.svg.png',

    // ── SEGUNDA DIVISIÓN 26/27 ───────────────────────────────────────────────
    'Albacete Balompié':       'https://upload.wikimedia.org/wikipedia/en/thumb/4/41/Albacete_Balompie_logo.svg/120px-Albacete_Balompie_logo.svg.png',
    'Albacete':                'https://upload.wikimedia.org/wikipedia/en/thumb/4/41/Albacete_Balompie_logo.svg/120px-Albacete_Balompie_logo.svg.png',
    'Córdoba CF':              'https://upload.wikimedia.org/wikipedia/en/thumb/5/52/C%C3%B3rdoba_CF_logo.svg/120px-C%C3%B3rdoba_CF_logo.svg.png',
    'Córdoba':                 'https://upload.wikimedia.org/wikipedia/en/thumb/5/52/C%C3%B3rdoba_CF_logo.svg/120px-C%C3%B3rdoba_CF_logo.svg.png',
    'Málaga CF':               'https://upload.wikimedia.org/wikipedia/en/thumb/6/6d/M%C3%A1laga_CF_logo.svg/120px-M%C3%A1laga_CF_logo.svg.png',
    'Málaga':                  'https://upload.wikimedia.org/wikipedia/en/thumb/6/6d/M%C3%A1laga_CF_logo.svg/120px-M%C3%A1laga_CF_logo.svg.png',
    'Burgos CF':               'https://upload.wikimedia.org/wikipedia/en/thumb/0/07/Burgos_CF_logo.svg/120px-Burgos_CF_logo.svg.png',
    'Burgos':                  'https://upload.wikimedia.org/wikipedia/en/thumb/0/07/Burgos_CF_logo.svg/120px-Burgos_CF_logo.svg.png',
    "Real Sociedad 'B'":       'https://upload.wikimedia.org/wikipedia/en/thumb/f/f1/Real_Sociedad_logo.svg/120px-Real_Sociedad_logo.svg.png',
    'Real Sociedad B':         'https://upload.wikimedia.org/wikipedia/en/thumb/f/f1/Real_Sociedad_logo.svg/120px-Real_Sociedad_logo.svg.png',
    'CD Leganés':              'https://upload.wikimedia.org/wikipedia/en/thumb/6/6d/CD_Leganes_logo.svg/120px-CD_Leganes_logo.svg.png',
    'Leganés':                 'https://upload.wikimedia.org/wikipedia/en/thumb/6/6d/CD_Leganes_logo.svg/120px-CD_Leganes_logo.svg.png',
    'UD Almería':              'https://upload.wikimedia.org/wikipedia/en/thumb/6/6b/UD_Almer%C3%ADa_logo.svg/120px-UD_Almer%C3%ADa_logo.svg.png',
    'Almería':                 'https://upload.wikimedia.org/wikipedia/en/thumb/6/6b/UD_Almer%C3%ADa_logo.svg/120px-UD_Almer%C3%ADa_logo.svg.png',
    'Cádiz CF':                'https://upload.wikimedia.org/wikipedia/en/thumb/6/6e/C%C3%A1diz_CF_logo.svg/120px-C%C3%A1diz_CF_logo.svg.png',
    'Cádiz':                   'https://upload.wikimedia.org/wikipedia/en/thumb/6/6e/C%C3%A1diz_CF_logo.svg/120px-C%C3%A1diz_CF_logo.svg.png',
    'Granada CF':              'https://upload.wikimedia.org/wikipedia/en/thumb/0/09/Granada_CF_logo.svg/120px-Granada_CF_logo.svg.png',
    'Granada':                 'https://upload.wikimedia.org/wikipedia/en/thumb/0/09/Granada_CF_logo.svg/120px-Granada_CF_logo.svg.png',
    'SD Eibar':                'https://upload.wikimedia.org/wikipedia/en/thumb/d/d8/SD_Eibar_logo.svg/120px-SD_Eibar_logo.svg.png',
    'Eibar':                   'https://upload.wikimedia.org/wikipedia/en/thumb/d/d8/SD_Eibar_logo.svg/120px-SD_Eibar_logo.svg.png',
    'SD Huesca':               'https://upload.wikimedia.org/wikipedia/en/thumb/3/3b/SD_Huesca_logo.svg/120px-SD_Huesca_logo.svg.png',
    'Huesca':                  'https://upload.wikimedia.org/wikipedia/en/thumb/3/3b/SD_Huesca_logo.svg/120px-SD_Huesca_logo.svg.png',
    'Sporting de Gijón':       'https://upload.wikimedia.org/wikipedia/en/thumb/f/f4/Real_Sporting_de_Gij%C3%B3n_logo.svg/120px-Real_Sporting_de_Gij%C3%B3n_logo.svg.png',
    'Sporting Gijón':          'https://upload.wikimedia.org/wikipedia/en/thumb/f/f4/Real_Sporting_de_Gij%C3%B3n_logo.svg/120px-Real_Sporting_de_Gij%C3%B3n_logo.svg.png',
    'Racing de Santander':     'https://upload.wikimedia.org/wikipedia/en/thumb/b/b4/Racing_Santander_logo.svg/120px-Racing_Santander_logo.svg.png',
    'Racing Santander':        'https://upload.wikimedia.org/wikipedia/en/thumb/b/b4/Racing_Santander_logo.svg/120px-Racing_Santander_logo.svg.png',
    'Racing':                  'https://upload.wikimedia.org/wikipedia/en/thumb/b/b4/Racing_Santander_logo.svg/120px-Racing_Santander_logo.svg.png',
    'Real Valladolid':         'https://upload.wikimedia.org/wikipedia/en/thumb/3/31/Real_Valladolid_logo.svg/120px-Real_Valladolid_logo.svg.png',
    'Valladolid':              'https://upload.wikimedia.org/wikipedia/en/thumb/3/31/Real_Valladolid_logo.svg/120px-Real_Valladolid_logo.svg.png',
    'CD Castellón':            'https://upload.wikimedia.org/wikipedia/en/thumb/6/65/CD_Castell%C3%B3n_logo.svg/120px-CD_Castell%C3%B3n_logo.svg.png',
    'Castellón':               'https://upload.wikimedia.org/wikipedia/en/thumb/6/65/CD_Castell%C3%B3n_logo.svg/120px-CD_Castell%C3%B3n_logo.svg.png',
    'CD Mirándés':             'https://upload.wikimedia.org/wikipedia/en/thumb/7/7c/CD_Mirand%C3%A9s_logo.svg/120px-CD_Mirand%C3%A9s_logo.svg.png',
    'Mirándés':                'https://upload.wikimedia.org/wikipedia/en/thumb/7/7c/CD_Mirand%C3%A9s_logo.svg/120px-CD_Mirand%C3%A9s_logo.svg.png',
    'AD Ceuta':                'https://upload.wikimedia.org/wikipedia/en/thumb/8/87/AD_Ceuta_FC_logo.svg/120px-AD_Ceuta_FC_logo.svg.png',
    'Ceuta':                   'https://upload.wikimedia.org/wikipedia/en/thumb/8/87/AD_Ceuta_FC_logo.svg/120px-AD_Ceuta_FC_logo.svg.png',
    'Cultural Leonesa':        'https://upload.wikimedia.org/wikipedia/en/thumb/0/07/Cultural_Leonesa_logo.svg/120px-Cultural_Leonesa_logo.svg.png',
    'Real Zaragoza':           'https://upload.wikimedia.org/wikipedia/en/thumb/4/4e/Real_Zaragoza_logo.svg/120px-Real_Zaragoza_logo.svg.png',
    'Zaragoza':                'https://upload.wikimedia.org/wikipedia/en/thumb/4/4e/Real_Zaragoza_logo.svg/120px-Real_Zaragoza_logo.svg.png',
    'RC Deportivo':            'https://upload.wikimedia.org/wikipedia/en/thumb/7/77/Deportivo_de_La_Coru%C3%B1a_logo.svg/120px-Deportivo_de_La_Coru%C3%B1a_logo.svg.png',
    'Deportivo de la Coruña':  'https://upload.wikimedia.org/wikipedia/en/thumb/7/77/Deportivo_de_La_Coru%C3%B1a_logo.svg/120px-Deportivo_de_La_Coru%C3%B1a_logo.svg.png',
    'Deportivo':               'https://upload.wikimedia.org/wikipedia/en/thumb/7/77/Deportivo_de_La_Coru%C3%B1a_logo.svg/120px-Deportivo_de_La_Coru%C3%B1a_logo.svg.png',
    'FC Andorra':              'https://upload.wikimedia.org/wikipedia/en/thumb/3/33/FC_Andorra_logo.svg/120px-FC_Andorra_logo.svg.png',
    'Andorra':                 'https://upload.wikimedia.org/wikipedia/en/thumb/3/33/FC_Andorra_logo.svg/120px-FC_Andorra_logo.svg.png',

    // ── PRIMERA DIVISIÓN — EL OTRO EQUIPO ────────────────────────────────────
    'FC Barcelona':            'https://upload.wikimedia.org/wikipedia/en/thumb/4/47/FC_Barcelona_%28crest%29.svg/120px-FC_Barcelona_%28crest%29.svg.png',
    'Barcelona':               'https://upload.wikimedia.org/wikipedia/en/thumb/4/47/FC_Barcelona_%28crest%29.svg/120px-FC_Barcelona_%28crest%29.svg.png',
    'Real Madrid':             'https://upload.wikimedia.org/wikipedia/en/thumb/5/56/Real_Madrid_CF.svg/120px-Real_Madrid_CF.svg.png',
    'Atlético de Madrid':      'https://upload.wikimedia.org/wikipedia/en/thumb/f/f4/Atletico_Madrid_2017_logo.svg/120px-Atletico_Madrid_2017_logo.svg.png',
    'Atlético Madrid':         'https://upload.wikimedia.org/wikipedia/en/thumb/f/f4/Atletico_Madrid_2017_logo.svg/120px-Atletico_Madrid_2017_logo.svg.png',
    'Villarreal CF':           'https://upload.wikimedia.org/wikipedia/en/thumb/b/b9/Villarreal_CF_logo-en.svg/120px-Villarreal_CF_logo-en.svg.png',
    'Villarreal':              'https://upload.wikimedia.org/wikipedia/en/thumb/b/b9/Villarreal_CF_logo-en.svg/120px-Villarreal_CF_logo-en.svg.png',
    'Real Betis':              'https://upload.wikimedia.org/wikipedia/en/thumb/1/13/Real_betis_logo.svg/120px-Real_betis_logo.svg.png',
    'Celta de Vigo':           'https://upload.wikimedia.org/wikipedia/en/thumb/1/12/RC_Celta_de_Vigo_logo.svg/120px-RC_Celta_de_Vigo_logo.svg.png',
    'Celta':                   'https://upload.wikimedia.org/wikipedia/en/thumb/1/12/RC_Celta_de_Vigo_logo.svg/120px-RC_Celta_de_Vigo_logo.svg.png',
    'Real Sociedad':           'https://upload.wikimedia.org/wikipedia/en/thumb/f/f1/Real_Sociedad_logo.svg/120px-Real_Sociedad_logo.svg.png',
    'Getafe CF':               'https://upload.wikimedia.org/wikipedia/en/thumb/2/2e/Getafe_CF_logo.svg/120px-Getafe_CF_logo.svg.png',
    'Getafe':                  'https://upload.wikimedia.org/wikipedia/en/thumb/2/2e/Getafe_CF_logo.svg/120px-Getafe_CF_logo.svg.png',
    'Athletic Club':           'https://upload.wikimedia.org/wikipedia/en/thumb/9/98/Club_Athletic_de_Bilbao_logo.svg/120px-Club_Athletic_de_Bilbao_logo.svg.png',
    'Athletic':                'https://upload.wikimedia.org/wikipedia/en/thumb/9/98/Club_Athletic_de_Bilbao_logo.svg/120px-Club_Athletic_de_Bilbao_logo.svg.png',
    'Sevilla FC':              'https://upload.wikimedia.org/wikipedia/en/thumb/3/3b/Sevilla_FC_logo.svg/120px-Sevilla_FC_logo.svg.png',
    'Sevilla':                 'https://upload.wikimedia.org/wikipedia/en/thumb/3/3b/Sevilla_FC_logo.svg/120px-Sevilla_FC_logo.svg.png',
    'Rayo Vallecano':          'https://upload.wikimedia.org/wikipedia/en/thumb/2/27/Rayo_Vallecano_logo.svg/120px-Rayo_Vallecano_logo.svg.png',
    'Rayo':                    'https://upload.wikimedia.org/wikipedia/en/thumb/2/27/Rayo_Vallecano_logo.svg/120px-Rayo_Vallecano_logo.svg.png',
    'Deportivo Alavés':        'https://upload.wikimedia.org/wikipedia/en/thumb/b/b9/Deportivo_Alav%C3%A9s_logo.svg/120px-Deportivo_Alav%C3%A9s_logo.svg.png',
    'Alavés':                  'https://upload.wikimedia.org/wikipedia/en/thumb/b/b9/Deportivo_Alav%C3%A9s_logo.svg/120px-Deportivo_Alav%C3%A9s_logo.svg.png',
    'RCD Espanyol':            'https://upload.wikimedia.org/wikipedia/en/thumb/7/76/Rcd_espanyol_new_crest.svg/120px-Rcd_espanyol_new_crest.svg.png',
    'Espanyol':                'https://upload.wikimedia.org/wikipedia/en/thumb/7/76/Rcd_espanyol_new_crest.svg/120px-Rcd_espanyol_new_crest.svg.png',
    'Valencia CF':             'https://upload.wikimedia.org/wikipedia/en/thumb/c/ce/Valenciacf.svg/120px-Valenciacf.svg.png',
    'Valencia':                'https://upload.wikimedia.org/wikipedia/en/thumb/c/ce/Valenciacf.svg/120px-Valenciacf.svg.png',
    'CA Osasuna':              'https://upload.wikimedia.org/wikipedia/en/thumb/d/db/Osasuna_logo.svg/120px-Osasuna_logo.svg.png',
    'Elche CF':                'https://upload.wikimedia.org/wikipedia/en/thumb/0/01/Elche_CF_logo.svg/120px-Elche_CF_logo.svg.png',
    'Levante UD':              'https://upload.wikimedia.org/wikipedia/en/thumb/6/6d/Levante_UD_logo.svg/120px-Levante_UD_logo.svg.png',
    'Osasuna':                 'https://upload.wikimedia.org/wikipedia/en/thumb/d/db/Osasuna_logo.svg/120px-Osasuna_logo.svg.png',
};

var getLogoEquipo = function(nombre, teamLogos) {
    if (!nombre) return '';
    if (teamLogos && teamLogos[nombre]) return teamLogos[nombre];
    if (LOGOS_EQUIPOS[nombre]) return LOGOS_EQUIPOS[nombre];
    var keys = Object.keys(LOGOS_EQUIPOS);
    for (var i = 0; i < keys.length; i++) {
        if (nombre.toLowerCase().includes(keys[i].toLowerCase()) ||
            keys[i].toLowerCase().includes(nombre.toLowerCase())) {
            return LOGOS_EQUIPOS[keys[i]];
        }
    }
    var ini = nombre.split(' ').map(function(w) { return w[0] || ''; }).join('').substring(0, 3).toUpperCase();
    return 'https://placehold.co/60x60/001F6B/FFD700?text=' + encodeURIComponent(ini);
};

const PlayerAvatar = ({ name, perfil, elOtroData, size = 40, showElOtro = false, teamLogos }) => {
    var elOtroEquipo = elOtroData && elOtroData.equipo;
    var elOtroRevelado = elOtroData && elOtroData.revelado;

    return (
        <div style={{position:'relative', display:'inline-flex', flexDirection:'column', alignItems:'center', gap:4}}>
            <div style={{position:'relative'}}>
                <div style={{border: '2px solid rgba(0,31,107,0.15)', borderRadius:'50%', boxShadow: '0 2px 8px rgba(0,31,107,0.12)'}}>
                    <IconoPerfil perfil={perfil} size={size} />
                </div>
                {/* Burbuja de El Otro — cuando es secreto, solo el interrogante;
                    cuando se revela, el escudo REAL del equipo (nunca un
                    emoji genérico que se pueda confundir con un escudo de verdad) */}
                {showElOtro && elOtroEquipo && (
                    <div style={{
                        position: 'absolute', top: -6, right: -6,
                        width: size * 0.45, height: size * 0.45, borderRadius: '50%',
                        background: elOtroRevelado ? '#fff' : '#001F6B', border: '1.5px solid #FFD700',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: size * 0.18, overflow: 'hidden',
                    }}>
                        {elOtroRevelado ? (
                            <img src={getLogoEquipo(elOtroEquipo, teamLogos)} alt={elOtroEquipo} style={{width:'80%',height:'80%',objectFit:'contain'}}
                                onError={function(e){e.target.style.display='none';}} />
                        ) : '❓'}
                    </div>
                )}
            </div>
            <span style={{
                fontFamily:"'Teko',sans-serif", fontSize: size * 0.28,
                letterSpacing: 1, color:'#001F6B', textTransform:'uppercase',
                maxWidth: size * 2.5, textAlign:'center', lineHeight: 1
            }}>{nombreVisible(name, perfil)}</span>
        </div>
    );
};

const PlayerProfileDisplay = ({ name, profile, defaultColor = styles.colors.lightText, isOnline = false }) => {
    const p = profile || {}; const color = p.color || defaultColor; const isG = typeof color === 'string' && color.startsWith('linear-gradient');
    const nStyle = { ...(isG ? { background: color, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } : { color }), fontWeight: 'bold' };
    return (<span style={{display: 'inline-flex', alignItems: 'center', gap: '8px' }}><IconoPerfil perfil={p} size={26} /><span style={nStyle}>{nombreVisible(name, p)}</span>{isOnline && <span style={{width: '8px', height: '8px', backgroundColor: styles.colors.success, borderRadius: '50%', boxShadow: `0 0 8px ${styles.colors.success}`}}></span>}</span>);
};

// ============================================================================
// --- PERFIL — Edición de emoji y apodo ---
// ============================================================================
const PerfilScreen = ({ currentUser, tema, cambiarTema, teamLogos }) => {
    var G = styles.colors;
    var [perfil, setPerfil] = useState({ emoji: '⚽', apodo: '', foto: null });
    var [guardado, setGuardado] = useState(false);
    var [guardando, setGuardando] = useState(false);
    var [subiendoFoto, setSubiendoFoto] = useState(false);
    var [convirtiendoFormato, setConvirtiendoFormato] = useState(false);
    var [previewFoto, setPreviewFoto] = useState(null); // dataURL local mientras se procesa/sube
    var [errorFoto, setErrorFoto] = useState('');
    var [miElOtroPerfil, setMiElOtroPerfil] = useState(null); // el equipo elegido, para verlo siempre en su propio perfil
    var fileInputRef = useRef(null);

    useEffect(function() {
        if (!currentUser) return;
        var unsub = onSnapshot(doc(db, "elOtro", currentUser), function(snap) {
            setMiElOtroPerfil(snap.exists() ? snap.data() : null);
        });
        return function() { unsub(); };
    }, [currentUser]);

    useEffect(function() {
        if (!currentUser) return;
        getDoc(doc(db, "perfiles", currentUser)).then(function(snap) {
            if (snap.exists()) {
                setPerfil(function(p) { return { ...p, ...snap.data() }; });
                setGuardado(true);
            }
        });
    }, [currentUser]);

// Convierte HEIC/HEIF (el formato por defecto de fotos en iPhone) a JPEG
// ANTES de intentar nada más — es la causa real, con diferencia, de que la
// subida se quedara "procesando" para siempre: Chrome, Firefox y Edge no
// saben leer HEIC de forma nativa (ni con <img>, ni con canvas), así que el
// filtro fallaba en silencio sin ni siquiera llegar a lanzar un error claro.
// Se carga la librería bajo demanda (solo si hace falta), así no penaliza a
// nadie que suba JPG/PNG normal, que es la mayoría.
async function convertirHeicSiHaceFalta(file) {
    var pareceHeic = (file.type && (file.type === 'image/heic' || file.type === 'image/heif')) ||
        /\.(heic|heif)$/i.test(file.name || '');
    if (!pareceHeic) return file;
    try {
        var modulo = await import('https://esm.sh/heic2any@0.0.4');
        var heic2any = modulo.default;
        var resultado = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
        var blobFinal = Array.isArray(resultado) ? resultado[0] : resultado;
        return new File([blobFinal], 'foto.jpg', { type: 'image/jpeg' });
    } catch (e) {
        console.warn('No se pudo convertir el HEIC, se sigue con el archivo original:', e.message);
        return file; // si falla la conversión, seguimos igualmente — el resto de cerrojos ya cubren este caso
    }
}

    var manejarSeleccionFoto = async function(e) {
        var file = e.target.files && e.target.files[0];
        if (!file) return;
        setErrorFoto('');
        if (file.type && !file.type.startsWith('image/')) { setErrorFoto('Elige un archivo de imagen.'); return; }
        if (file.size > 8 * 1024 * 1024) { setErrorFoto('La imagen pesa demasiado (máx. 8MB).'); return; }

        // === FILOSOFÍA: subir primero, filtro después ===
        // Antes el flujo era: convertir HEIC → cargar en <img> → aplicar
        // filtro en canvas → subir el resultado. Demasiados pasos que pueden
        // fallar en silencio en distintos navegadores. Ahora: se sube la foto
        // TAL CUAL primero (garantiza que al menos la foto se guarde), y
        // LUEGO se intenta aplicar el filtro y resubir la versión filtrada.
        // Si el filtro falla por lo que sea, la foto sin filtro ya está guardada.

        setSubiendoFoto(true);
        try {
            // Paso 1: subir la foto original directamente, sin tocar nada
            var ref = storageRef(storage, 'perfiles/' + currentUser + '/foto.jpg');
            await uploadBytes(ref, file, { contentType: file.type || 'image/jpeg' });
            var url = await getDownloadURL(ref);
            await setDoc(doc(db, "perfiles", currentUser), {
                nombre: currentUser, foto: url, actualizadoEn: serverTimestamp()
            }, { merge: true });
            setPerfil(function(p) { return { ...p, foto: url }; });
            setPreviewFoto(url);
            setGuardado(true);

            // Paso 2 (en segundo plano): intentar aplicar el filtro UDLP y
            // resubir la versión filtrada. Si falla, la foto original ya está
            // guardada y visible — no se pierde nada.
            try {
                var objectUrl = URL.createObjectURL(file);
                var img = new Image();
                img.crossOrigin = 'anonymous';
                await new Promise(function(resolve, reject) {
                    img.onload = resolve;
                    img.onerror = reject;
                    setTimeout(function() { reject(new Error('timeout')); }, 8000);
                    img.src = objectUrl;
                });
                var blob = await conTimeout(aplicarFiltroUDLP(img), 10000, 'Filtro tardó demasiado');
                await uploadBytes(ref, blob, { contentType: 'image/jpeg' });
                var urlFiltrada = await getDownloadURL(ref);
                await setDoc(doc(db, "perfiles", currentUser), {
                    foto: urlFiltrada, actualizadoEn: serverTimestamp()
                }, { merge: true });
                setPerfil(function(p) { return { ...p, foto: urlFiltrada }; });
                setPreviewFoto(URL.createObjectURL(blob));
                URL.revokeObjectURL(objectUrl);
            } catch (filtroErr) {
                console.warn('Filtro UDLP no se pudo aplicar (la foto original ya está guardada):', filtroErr.message);
            }

            setSubiendoFoto(false);
            setErrorFoto('');
        } catch (err) {
            console.error('Error subiendo foto:', err);
            setSubiendoFoto(false);
            var msgErr = err.message || 'Error desconocido';
            if (err.code === 'storage/unauthorized' || msgErr.indexOf('unauthorized') !== -1 || msgErr.indexOf('permission') !== -1) {
                setErrorFoto('Las reglas de Firebase Storage no permiten subir fotos. Ve a Firebase Console → Storage → Rules y comprueba que las reglas permitan escritura.');
            } else {
                setErrorFoto('No se pudo subir la foto: ' + msgErr);
            }
            alert('Error subiendo foto: ' + msgErr);
        }
    };

    var elegirEmoji = async function(em) {
        setPerfil(function(p) { return { ...p, emoji: em }; });
        setGuardando(true);
        try {
            await setDoc(doc(db, "perfiles", currentUser), {
                nombre: currentUser, emoji: em, actualizadoEn: serverTimestamp()
            }, { merge: true });
            setGuardado(true);
        } catch(e) { console.error(e); }
        setGuardando(false);
    };

    var guardarApodo = async function() {
        setGuardando(true);
        try {
            // Si deja el campo vacío, NO guardamos el nombre completo como
            // apodo (eso bloquearía el recorte automático del apellido para
            // siempre) — simplemente no fijamos apodo, y el nombre visible
            // sigue siendo el recorte automático de toda la vida.
            var datosAGuardar = { nombre: currentUser, actualizadoEn: serverTimestamp() };
            if (perfil.apodo && perfil.apodo.trim()) datosAGuardar.apodo = perfil.apodo.trim();
            await setDoc(doc(db, "perfiles", currentUser), datosAGuardar, { merge: true });
            setGuardado(true);
        } catch(e) { console.error(e); }
        setGuardando(false);
    };

    var avatarActual = previewFoto || perfil.foto;
    var tieneApellido = currentUser && currentUser.trim().split(/\s+/).length > 1;

    return (
        <div style={{paddingBottom:40}}>
            <h2 style={styles.title}>MI PERFIL</h2>

            {/* Aviso automático: detectado apellido en el nombre registrado */}
            {tieneApellido && !perfil.apodo && (
                <div style={{background:'rgba(255,215,0,0.08)',border:'1px solid rgba(212,175,55,0.3)',borderRadius:14,padding:'14px 16px',marginBottom:16}}>
                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:13,letterSpacing:1,color:'#8a6a00',fontWeight:700,marginBottom:4}}>
                        📛 Hemos detectado tu apellido en el nombre
                    </p>
                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,0,0,0.6)',lineHeight:1.6}}>
                        Te registraste como "{currentUser}" — al resto de jugadores ya solo les aparece <strong>"{currentUser.trim().split(/\s+/)[0]}"</strong> automáticamente, en avatares y clasificación. Si prefieres que se muestre otra cosa, ponte un apodo justo aquí abajo.
                    </p>
                </div>
            )}

            {/* Vista previa del avatar */}
            <div style={{textAlign:'center',marginBottom:24}}>
                <div style={{display:'inline-flex',flexDirection:'column',alignItems:'center',gap:8,
                    background:'#fff',borderRadius:20,padding:24,border:'1px solid rgba(0,31,107,0.08)'}}>
                    {avatarActual ? (
                        <div style={{width:88,height:88,borderRadius:'50%',overflow:'hidden',
                            boxShadow:'0 0 0 3px #FFD700, 0 4px 16px rgba(0,31,107,0.2)'}}>
                            <img src={avatarActual} alt="" style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}} />
                        </div>
                    ) : (
                        <div style={{width:88,height:88,borderRadius:'50%',
                            background:'linear-gradient(135deg,#001F6B,#003a9e)',
                            display:'flex',alignItems:'center',justifyContent:'center',
                            fontSize:44,boxShadow:'0 0 0 3px #FFD700, 0 4px 16px rgba(0,31,107,0.2)'}}>
                            {perfil.emoji || '⚽'}
                        </div>
                    )}
                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:20,fontWeight:700,color:G.deepBlue,letterSpacing:2,textTransform:'uppercase'}}>
                        {nombreVisible(currentUser, perfil)}
                    </p>
                    {guardado && !subiendoFoto && <span style={{fontFamily:"'Inter',sans-serif",fontSize:10,color:'#10b981',letterSpacing:2,textTransform:'uppercase'}}>✓ Guardado</span>}
                </div>
            </div>

            {/* Mi Otro Equipo — el dueño del perfil SIEMPRE ve su propio
                equipo, aunque para el resto siga siendo secreto hasta la 3ª
                activación (esa regla es solo de cara a los demás). */}
            {miElOtroPerfil && miElOtroPerfil.equipo && (
                <div style={{background:'linear-gradient(135deg,#001F6B,#003a9e)',borderRadius:16,padding:18,marginBottom:16,display:'flex',alignItems:'center',gap:14}}>
                    <img src={getLogoEquipo(miElOtroPerfil.equipo, teamLogos)} alt={miElOtroPerfil.equipo} style={{width:44,height:44,objectFit:'contain',flexShrink:0}}
                        onError={function(e){e.target.style.display='none';}} />
                    <div style={{flex:1}}>
                        <p style={{fontFamily:"'Teko',sans-serif",fontSize:11,letterSpacing:2,color:'rgba(255,215,0,0.6)',textTransform:'uppercase',marginBottom:2}}>Mi Otro Equipo</p>
                        <p style={{fontFamily:"'Teko',sans-serif",fontSize:20,fontWeight:700,color:'#fff'}}>{miElOtroPerfil.equipo}</p>
                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'rgba(255,255,255,0.5)'}}>
                            {miElOtroPerfil.activaciones || 0} activaciones · ×{getMultiplicadorOtro(miElOtroPerfil.activaciones || 0)} actual
                            {(miElOtroPerfil.activaciones || 0) < 3 ? ' · 🔒 secreto para el resto' : ' · 👁️ ya visible para todos'}
                        </p>
                    </div>
                </div>
            )}

            {/* Opción principal: subir foto con filtro UDLP */}
            <div style={{background:'linear-gradient(135deg,#001F6B,#00296e)',borderRadius:16,padding:20,marginBottom:16,
                border:'1px solid rgba(0,31,107,0.08)'}}>
                <p style={{fontFamily:"'Teko',sans-serif",fontSize:16,letterSpacing:2,color:'#FFD700',textTransform:'uppercase',fontWeight:700,marginBottom:4}}>
                    Sube tu foto
                </p>
                <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(255,255,255,0.6)',marginBottom:16,lineHeight:1.5}}>
                    Se aplica automáticamente el filtro azul y dorado de la UDLP. Es la opción recomendada para tu perfil.
                </p>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={manejarSeleccionFoto} style={{display:'none'}} />
                <button onClick={function() { fileInputRef.current && fileInputRef.current.click(); }}
                    disabled={subiendoFoto || convirtiendoFormato}
                    style={{width:'100%',fontFamily:"'Teko',sans-serif",fontSize:'1.05rem',letterSpacing:2,
                        background:'#FFD700',color:'#001F6B',border:'none',borderRadius:30,padding:14,
                        cursor: subiendoFoto ? 'default' : 'pointer', opacity: subiendoFoto ? 0.7 : 1}}>
                    {convirtiendoFormato ? 'CONVIRTIENDO FORMATO...' : subiendoFoto ? 'PROCESANDO...' : (perfil.foto ? 'CAMBIAR FOTO' : '📷 SUBIR FOTO')}
                </button>
                {errorFoto && (
                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'#ff8a8a',marginTop:10,textAlign:'center'}}>{errorFoto}</p>
                )}
            </div>

            {/* Alternativa rápida: emoji fútbol */}
            <div style={{background:'#fff',borderRadius:16,padding:20,border:'1px solid rgba(0,31,107,0.08)',marginBottom:16}}>
                <p style={{fontFamily:"'Teko',sans-serif",fontSize:13,letterSpacing:2,color:G.deepBlue,opacity:.6,textTransform:'uppercase',marginBottom:12}}>
                    O elige un icono rápido
                </p>
                <div style={{display:'grid',gridTemplateColumns:'repeat(8,1fr)',gap:8}}>
                    {EMOJIS_FUTBOL.map(function(em) {
                        var sel = !perfil.foto && perfil.emoji === em;
                        return (
                            <button key={em} onClick={function() { elegirEmoji(em); }}
                                style={{aspectRatio:'1',borderRadius:'50%',
                                    border: sel ? '2.5px solid #FFD700' : '1.5px solid rgba(0,31,107,0.1)',
                                    background: sel ? 'linear-gradient(135deg,#001F6B,#003a9e)' : '#f8f8f8',
                                    fontSize:20,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
                                    boxShadow: sel ? '0 0 0 2px rgba(0,31,107,0.15)' : 'none'}}>
                                {em}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Apodo */}
            <div style={{background:'#fff',borderRadius:16,padding:20,border:'1px solid rgba(0,31,107,0.08)',marginBottom:16}}>
                <p style={{fontFamily:"'Teko',sans-serif",fontSize:13,letterSpacing:2,color:G.deepBlue,opacity:.6,textTransform:'uppercase',marginBottom:12}}>
                    Tu apodo (opcional)
                </p>
                <input
                    type="text"
                    value={perfil.apodo || ''}
                    onChange={function(e) { setPerfil(function(p) { return {...p, apodo: e.target.value}; }); setGuardado(false); }}
                    onBlur={guardarApodo}
                    placeholder={currentUser}
                    maxLength={20}
                    style={{width:'100%',padding:'14px 16px',border:'1.5px solid rgba(0,31,107,0.15)',borderRadius:12,
                        fontFamily:"'Teko',sans-serif",fontSize:20,letterSpacing:2,color:G.deepBlue,
                        background:'#f8f9ff',textTransform:'uppercase'}}
                />
                <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:G.deepBlue,opacity:.4,marginTop:8}}>
                    Si lo dejas vacío, usaremos tu nombre real. Se guarda al salir del campo.
                </p>
            </div>

            {/* Tema visual */}
            {cambiarTema && (
                <div style={{background:'#fff',borderRadius:16,padding:20,border:'1px solid rgba(0,31,107,0.08)',
                    display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <div>
                        <p style={{fontFamily:"'Teko',sans-serif",fontSize:13,letterSpacing:2,color:G.deepBlue,opacity:.6,textTransform:'uppercase'}}>
                            Tono de la app
                        </p>
                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:G.deepBlue,opacity:.4,marginTop:2}}>
                            {tema === 'oscuro' ? 'Pizarra oscura' : 'Pizarra clara'}
                        </p>
                    </div>
                    <button onClick={cambiarTema} style={{
                        width:56,height:30,borderRadius:20,border:'none',cursor:'pointer',
                        background: tema==='oscuro' ? '#001F6B' : '#e5e8f5', position:'relative',padding:0}}>
                        <div style={{
                            width:24,height:24,borderRadius:'50%',background:'#FFD700',position:'absolute',top:3,
                            left: tema==='oscuro' ? 29 : 3, transition:'left .2s ease',
                            display:'flex',alignItems:'center',justifyContent:'center'}}>
                            <i className={'ti ' + (tema==='oscuro' ? 'ti-moon' : 'ti-sun')} style={{fontSize:13,color:'#001F6B'}} aria-hidden="true" />
                        </div>
                    </button>
                </div>
            )}
        </div>
    );
};





// ============================================================================
// HELPER — Comprobar si un jugador tiene la inscripción pagada
// ============================================================================
var jugadorHaPagado = function(nombre, pagosArr) {
    return pagosArr.some(function(p) {
        return p.jugador === nombre &&
               p.tipo === 'inscripcion' &&
               p.estado !== 'fallido' &&
               p.estado !== 'rechazado' &&
               p.estado !== 'cancelado';
    });
};

// Banner de pago pendiente — se muestra en lugar del contenido bloqueado
var BannerPagoPendiente = function({ onIrAPagos }) {
    return (
        <div style={{
            background:'linear-gradient(135deg,#001F6B 0%,#0035b8 100%)',
            borderRadius:20, padding:32, textAlign:'center', margin:'20px 0',
        }}>
            <div style={{fontSize:52,marginBottom:12}}>🔒</div>
            <p style={{fontFamily:"'Teko',sans-serif",fontSize:22,letterSpacing:3,
                color:'#FFD700',textTransform:'uppercase',marginBottom:8}}>
                Inscripción pendiente
            </p>
            <p style={{fontFamily:"'Inter',sans-serif",fontSize:14,
                color:'rgba(255,255,255,0.65)',lineHeight:1.75,marginBottom:24,maxWidth:280,margin:'0 auto 24px'}}>
                Para apostar, elegir tu equipo o participar en las estrellas necesitas confirmar tu inscripción de <strong style={{color:'#FFD700'}}>5€</strong>.
            </p>
            <button onClick={onIrAPagos} style={{
                fontFamily:"'Teko',sans-serif",fontSize:15,letterSpacing:3,
                background:'#FFD700',color:'#001F6B',border:'none',borderRadius:30,
                padding:'14px 32px',cursor:'pointer',textTransform:'uppercase',
                boxShadow:'0 6px 24px rgba(255,215,0,0.35)',fontWeight:700,
            }}>
                Pagar inscripción — 5€ →
            </button>
            <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,
                color:'rgba(255,255,255,0.3)',marginTop:16,lineHeight:1.5}}>
                Si alguien va a pagar por ti, díselo — puede hacerlo desde su cuenta.
            </p>
        </div>
    );
};

// ============================================================================
// LOGOS DE EQUIPOS — URLs públicas de Wikipedia (sin API key, sin seed)
// Funcionan siempre desde cualquier dispositivo
// ============================================================================



const TeamDisplay = ({ teamLogos, teamName, shortName = false, imgStyle }) => {
    var logoSrc = getLogoEquipo(teamName, teamLogos);
    return (
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'6px',flex:'0 0 auto'}}>
            <img src={logoSrc} style={imgStyle} alt={teamName}
                onError={function(e){e.target.src='https://placehold.co/60x60/001F6B/FFD700?text=' + encodeURIComponent((teamName||'?').substring(0,3));}} />
            <span style={{fontSize:'clamp(0.75rem,2.5vw,0.9rem)',fontWeight:600,color:styles.colors.lightText,fontFamily:"'Montserrat',sans-serif",textAlign:'center',maxWidth:90,lineHeight:1.2}}>
                {shortName && teamName === 'UD Las Palmas' ? 'UDLP' : teamName}
            </span>
        </div>
    );
};

const LoadingSkeleton = () => (<div style={{padding:'60px', textAlign:'center', color:styles.colors.golden, fontFamily:"'Oswald', sans-serif", fontSize:'1.2rem', letterSpacing:'2px'}}>CARGANDO DATOS...</div>);

// ─── MODO CONSTRUCCIÓN ────────────────────────────────────────────────────────
// Cambia a false para desbloquear la app cuando esté lista
const APP_EN_CONSTRUCCION = false; // Lanzada al público — 11 agosto 2026

const CODIGO_PRUEBA = 'udlp2027';

const ModoConstruccion = () => {
    const [fase, setFase] = useState(0);
    const [showForm, setShowForm] = useState(false);
    const [nombre, setNombre] = useState('');
    const [codigoPrueba, setCodigoPrueba] = useState('');
    const [errorCodigo, setErrorCodigo] = useState('');
    const [enviado, setEnviado] = useState(false);
    const [enviando, setEnviando] = useState(false);

    const irFase1 = () => {
        setFase(1);
        const msgs = ['m1','m2','m3','m4','m5','m6','m7','m8','m9','m10','m11'];
        const delays = [800,1400,2000,3000,4200,5000,6200,7000,8400,9200,9800];
        msgs.forEach((id,i) => {
            setTimeout(() => {
                const el = document.getElementById('mc-'+id);
                if(el){ el.style.opacity='1'; el.style.transform='translateY(0)'; }
            }, delays[i]);
        });
        setTimeout(() => setFase(2), 12000);
    };

    const handlePreinscripcion = async () => {
        if(!nombre.trim()) return;
        setEnviando(true);
        try {
            await addDoc(collection(db, 'preinscripciones'), {
                nombre: nombre.trim(),
                fecha: serverTimestamp(),
            });
            setEnviado(true);
        } catch(e) {
            console.error(e);
            alert('Error al guardar. Inténtalo de nuevo.');
        }
        setEnviando(false);
    };

    const campoStyle = {position:'absolute',inset:0,width:'100%',height:'100%',overflow:'visible'};
    const msgBase = {
        fontFamily:"'Inter',sans-serif",fontWeight:300,letterSpacing:'4px',
        color:'#0a0a0a',textTransform:'uppercase',lineHeight:1.8,
        opacity:0,transform:'translateY(12px)',
        transition:'opacity .9s ease, transform .9s ease',
        marginBottom:'4px',display:'block'
    };
    const msgBig = {
        ...msgBase,fontFamily:"'Bebas Neue',sans-serif",
        fontSize:'clamp(2.2rem,9vw,3.2rem)',letterSpacing:'3px',
        fontWeight:400,lineHeight:1,margin:'14px 0',
        transition:'opacity 1s ease, transform 1s ease',
    };

    return (
        <div style={{position:'fixed',inset:0,fontFamily:"'Inter',sans-serif",overflow:'hidden',zIndex:9999,background:'#fff'}}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@300;400&display=swap');
                .pf1{animation:pfc 10s ease-in-out infinite 0s}.pf2{animation:pfc 10s ease-in-out infinite 3.3s}
                .pf3{animation:pfc 10s ease-in-out infinite 6.6s}.pf4{animation:pfc 8s ease-in-out infinite 1.5s}
                .pf5{animation:pfc 12s ease-in-out infinite 4s}.pf6{animation:pfc 9s ease-in-out infinite 7s}
                @keyframes pfc{0%{opacity:0}12%{opacity:1}80%{opacity:1}100%{opacity:0}}
                .ps1{stroke-dasharray:320;stroke-dashoffset:320;animation:pst 6s ease-in-out 2s infinite}
                .ps2{stroke-dasharray:280;stroke-dashoffset:280;animation:pst 6s ease-in-out 10s infinite}
                .ps3{stroke-dasharray:300;stroke-dashoffset:300;animation:pst 6s ease-in-out 18s infinite}
                @keyframes pst{0%{stroke-dashoffset:320;opacity:0}8%{opacity:.11}55%{stroke-dashoffset:0;opacity:.11}85%{opacity:0}100%{stroke-dashoffset:320;opacity:0}}
                .pj{animation:pjg ease-in-out infinite}
                .pj1{animation-duration:5s;animation-delay:0s}.pj2{animation-duration:6s;animation-delay:1.4s}
                .pj3{animation-duration:5.5s;animation-delay:2.8s}.pj4{animation-duration:7s;animation-delay:.7s}
                .pj5{animation-duration:6.5s;animation-delay:3.2s}.pj6{animation-duration:5.2s;animation-delay:1.9s}
                .pj7{animation-duration:8s;animation-delay:2.5s}.pj8{animation-duration:6s;animation-delay:.3s}
                .pj9{animation-duration:5.5s;animation-delay:3.8s}.pj10{animation-duration:7s;animation-delay:1.1s}
                .pj11{animation-duration:6s;animation-delay:4.2s}
                @keyframes pjg{0%{opacity:0}18%{opacity:1}72%{opacity:1}100%{opacity:0}}
                .sflt{animation:sflt 3.5s ease-in-out infinite}
                @keyframes sflt{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
                .mcfi{animation:mcfi .6s ease .4s both}.mcfi2{animation:mcfi2 .5s ease .7s both}
                .mcfi3{animation:mcfi .5s ease .9s both}.mcfi4{animation:mcfi2 .4s ease 1.1s both}
                @keyframes mcfi{from{opacity:0}to{opacity:.32}}
                @keyframes mcfi2{from{opacity:0}to{opacity:1}}
                .mcd{animation:mcdp 1.6s ease-in-out infinite}
                .mcd:nth-child(2){animation-delay:.25s}.mcd:nth-child(3){animation-delay:.5s}
                @keyframes mcdp{0%,100%{opacity:.15;transform:scale(1)}50%{opacity:.6;transform:scale(1.5)}}
                .f0btn:active{transform:scale(.97)}
            `}</style>

            {/* ── FASE 0: PANTALLA AZUL/BLANCA ── */}
            <div style={{
                position:'absolute',inset:0,
                background:'linear-gradient(160deg,#001F6B 0%,#0035b8 45%,#ffffff 100%)',
                display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                padding:'40px 28px',textAlign:'center',
                opacity: fase===0 ? 1 : 0,
                transition:'opacity 1.2s ease',
                pointerEvents: fase===0 ? 'all' : 'none',
                zIndex:50
            }}>
                <div style={{fontSize:'2.8rem',marginBottom:24,animation:'sflt 2s ease-in-out infinite'}}>📲</div>
                <div style={{
                    fontFamily:"'Bebas Neue',sans-serif",
                    fontSize:'clamp(1.6rem,6vw,2.2rem)',
                    color:'#ffffff',letterSpacing:'2px',lineHeight:1.25,marginBottom:16
                }}>¿Ya has desinstalado la app<br/>para reinstalarla?</div>
                <div style={{
                    fontFamily:"'Inter',sans-serif",fontSize:13,fontWeight:300,
                    color:'rgba(255,255,255,0.6)',letterSpacing:'1px',lineHeight:1.8,
                    marginBottom:44,maxWidth:300
                }}>Si no lo has hecho todavía,<br/>hazlo ahora y vuelve a entrar.<br/>Solo tarda 30 segundos.</div>
                <button className="f0btn" onClick={irFase1} style={{
                    fontFamily:"'Bebas Neue',sans-serif",
                    fontSize:'1.1rem',letterSpacing:'3px',
                    background:'#ffffff',color:'#001F6B',
                    border:'none',borderRadius:'40px',
                    padding:'14px 36px',cursor:'pointer',
                    boxShadow:'0 8px 24px rgba(0,0,0,0.2)',
                    transition:'transform .2s'
                }}>Quiero empezar ya →</button>
            </div>

            {/* ── FASE 1: PRESENTACIÓN ── */}
            <div style={{
                position:'absolute',inset:0,background:'#ffffff',
                display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                padding:'40px 28px',textAlign:'center',
                opacity: fase===1 ? 1 : 0,
                transition:'opacity 1.4s ease',
                pointerEvents: fase===1 ? 'all' : 'none',
                zIndex:40
            }}>
                {/* Campo lápiz fondo */}
                <svg style={{...campoStyle,opacity: fase===1 ? 1 : 0, transition:'opacity 2s ease 0.8s'}}
                    viewBox="0 0 400 700" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="xMidYMid slice">
                    <path d="M40 60 L361 62 L359 638 L38 640 Z" stroke="#0a0a0a" strokeWidth="1.2" opacity="0.06" strokeLinecap="round"/>
                    <path d="M41 61 L362 59 L360 639 L39 641 Z" stroke="#0a0a0a" strokeWidth="0.4" opacity="0.03" strokeLinecap="round"/>
                    <path d="M40 349 Q200 347 360 350" stroke="#0a0a0a" strokeWidth="1" opacity="0.06" strokeLinecap="round"/>
                    <path d="M200 292 Q256 295 258 350 Q256 406 200 408 Q144 406 142 350 Q144 295 200 292" stroke="#0a0a0a" strokeWidth="1" opacity="0.06" strokeLinecap="round"/>
                    <path d="M108 60 L108 168 Q110 170 292 168 L292 60" stroke="#0a0a0a" strokeWidth="1" opacity="0.06" strokeLinecap="round"/>
                    <path d="M152 60 L152 110 Q154 112 248 110 L248 60" stroke="#0a0a0a" strokeWidth="0.7" opacity="0.04" strokeLinecap="round"/>
                    <path d="M148 168 Q200 200 252 168" stroke="#0a0a0a" strokeWidth="0.7" opacity="0.05" strokeLinecap="round"/>
                    <path d="M108 640 L108 532 Q110 530 292 532 L292 640" stroke="#0a0a0a" strokeWidth="1" opacity="0.06" strokeLinecap="round"/>
                    <path d="M152 640 L152 590 Q154 588 248 590 L248 640" stroke="#0a0a0a" strokeWidth="0.7" opacity="0.04" strokeLinecap="round"/>
                    <path d="M148 532 Q200 500 252 532" stroke="#0a0a0a" strokeWidth="0.7" opacity="0.05" strokeLinecap="round"/>
                    <path d="M40 60 Q54 60 54 74" stroke="#0a0a0a" strokeWidth="0.7" opacity="0.04" strokeLinecap="round"/>
                    <path d="M360 60 Q346 60 346 74" stroke="#0a0a0a" strokeWidth="0.7" opacity="0.04" strokeLinecap="round"/>
                    <path d="M40 640 Q54 640 54 626" stroke="#0a0a0a" strokeWidth="0.7" opacity="0.04" strokeLinecap="round"/>
                    <path d="M360 640 Q346 640 346 626" stroke="#0a0a0a" strokeWidth="0.7" opacity="0.04" strokeLinecap="round"/>
                    <circle cx="200" cy="350" r="3" fill="#001F6B" opacity="0.12"/>
                    <circle cx="200" cy="140" r="2.5" fill="#0a0a0a" opacity="0.08"/>
                    <circle cx="200" cy="560" r="2.5" fill="#0a0a0a" opacity="0.08"/>
                </svg>

                {/* Mensajes */}
                <div style={{position:'relative',zIndex:10,display:'flex',flexDirection:'column',alignItems:'center',maxWidth:320}}>
                    <span id="mc-m1" style={{...msgBase,fontSize:'clamp(.8rem,3vw,.95rem)'}}>Serán</span>
                    <span id="mc-m2" style={{...msgBig,color:'#001F6B'}}>11</span>
                    <span id="mc-m3" style={{...msgBase,fontSize:'clamp(.8rem,3vw,.95rem)'}}>jugadores</span>
                    <span id="mc-m4" style={{...msgBase,fontSize:'clamp(.75rem,2.5vw,.85rem)',marginTop:18,opacity:0}}>Otros tantos que querrán jugar</span>
                    <span id="mc-m5" style={{...msgBase,fontSize:'clamp(.75rem,2.5vw,.85rem)',marginTop:20}}>Goles · Asistencias</span>
                    <span id="mc-m6" style={{...msgBase,fontSize:'clamp(.75rem,2.5vw,.85rem)'}}>Entradas · Faltas</span>
                    <span id="mc-m7" style={{...msgBase,fontSize:'clamp(.7rem,2.5vw,.8rem)',marginTop:20}}>Y todo esto mientras</span>
                    <span id="mc-m8" style={{...msgBase,fontSize:'clamp(.7rem,2.5vw,.8rem)'}}>el equipo lucha por el ascenso</span>
                    <span id="mc-m9" style={{...msgBig,color:'#001F6B',marginTop:20}}>¿Estás listo?</span>
                    <span id="mc-m10" style={{...msgBase,fontSize:'clamp(.7rem,2.5vw,.8rem)',letterSpacing:'6px',marginTop:8}}>Se viene algo</span>
                    <span id="mc-m11" style={{...msgBig,fontSize:'clamp(2.6rem,11vw,3.8rem)',color:'#0a0a0a'}}>GRANDE</span>
                </div>
            </div>

            {/* ── FASE 2: PIZARRA FINAL ── */}
            <div style={{
                position:'absolute',inset:0,background:'#fff',
                display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                opacity: fase===2 ? 1 : 0,
                transition:'opacity 1.6s ease',
                pointerEvents: fase===2 ? 'all' : 'none',
                zIndex:30
            }}>
                <svg style={campoStyle} viewBox="0 0 400 600" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="xMidYMid slice">
                    <g className="pf1" opacity="0">
                        <rect x="55" y="55" width="290" height="490" stroke="#001F6B" strokeWidth="0.8" opacity="0.07"/>
                        <line x1="55" y1="300" x2="345" y2="300" stroke="#001F6B" strokeWidth="0.7" opacity="0.07"/>
                        <circle cx="200" cy="300" r="46" stroke="#001F6B" strokeWidth="0.7" opacity="0.06"/>
                        <rect x="113" y="55" width="174" height="96" stroke="#001F6B" strokeWidth="0.7" opacity="0.06"/>
                        <rect x="113" y="449" width="174" height="96" stroke="#001F6B" strokeWidth="0.7" opacity="0.06"/>
                        <path d="M138 151 Q200 176 262 151" stroke="#001F6B" strokeWidth="0.6" opacity="0.05"/>
                        <path d="M138 449 Q200 424 262 449" stroke="#001F6B" strokeWidth="0.6" opacity="0.05"/>
                        <circle cx="200" cy="300" r="2.5" fill="#FFD700" opacity="0.3"/>
                    </g>
                    <g className="pf2" opacity="0" transform="rotate(90,200,300)">
                        <rect x="55" y="110" width="290" height="380" stroke="#001F6B" strokeWidth="0.8" opacity="0.07"/>
                        <line x1="200" y1="110" x2="200" y2="490" stroke="#001F6B" strokeWidth="0.7" opacity="0.07"/>
                        <circle cx="200" cy="300" r="46" stroke="#001F6B" strokeWidth="0.7" opacity="0.06"/>
                    </g>
                    <g className="pf3" opacity="0" transform="rotate(45,200,300)">
                        <rect x="75" y="130" width="250" height="340" stroke="#001F6B" strokeWidth="0.8" opacity="0.06"/>
                        <line x1="75" y1="300" x2="325" y2="300" stroke="#001F6B" strokeWidth="0.6" opacity="0.06"/>
                        <circle cx="200" cy="300" r="40" stroke="#001F6B" strokeWidth="0.6" opacity="0.06"/>
                    </g>
                    <g className="pf4" opacity="0">
                        <rect x="75" y="70" width="250" height="120" stroke="#FFD700" strokeWidth="0.8" opacity="0.12"/>
                        <rect x="75" y="410" width="250" height="120" stroke="#FFD700" strokeWidth="0.8" opacity="0.12"/>
                        <circle cx="200" cy="150" r="2.5" fill="#FFD700" opacity="0.3"/>
                    </g>
                    <g className="pf5" opacity="0" transform="rotate(-25,200,300)">
                        <rect x="65" y="115" width="270" height="370" stroke="#001F6B" strokeWidth="0.7" opacity="0.06"/>
                        <circle cx="200" cy="300" r="50" stroke="#FFD700" strokeWidth="0.6" opacity="0.08" strokeDasharray="5 7"/>
                    </g>
                    <circle className="pj pj1"  cx="200" cy="530" r="10" stroke="#001F6B" strokeWidth="0.8" opacity="0.08" fill="none"/>
                    <circle className="pj pj2"  cx="110" cy="445" r="9"  stroke="#001F6B" strokeWidth="0.8" opacity="0.08" fill="none"/>
                    <circle className="pj pj3"  cx="200" cy="448" r="9"  stroke="#001F6B" strokeWidth="0.8" opacity="0.08" fill="none"/>
                    <circle className="pj pj4"  cx="290" cy="445" r="9"  stroke="#001F6B" strokeWidth="0.8" opacity="0.08" fill="none"/>
                    <circle className="pj pj5"  cx="130" cy="355" r="8"  stroke="#FFD700" strokeWidth="0.7" opacity="0.15" fill="none"/>
                    <circle className="pj pj6"  cx="200" cy="348" r="8"  stroke="#FFD700" strokeWidth="0.7" opacity="0.15" fill="none"/>
                    <circle className="pj pj7"  cx="270" cy="355" r="8"  stroke="#FFD700" strokeWidth="0.7" opacity="0.15" fill="none"/>
                    <circle className="pj pj8"  cx="100" cy="255" r="8"  stroke="#001F6B" strokeWidth="0.7" opacity="0.07" fill="none"/>
                    <circle className="pj pj9"  cx="200" cy="245" r="8"  stroke="#001F6B" strokeWidth="0.7" opacity="0.07" fill="none"/>
                    <circle className="pj pj10" cx="300" cy="255" r="8"  stroke="#001F6B" strokeWidth="0.7" opacity="0.07" fill="none"/>
                    <circle className="pj pj11" cx="200" cy="158" r="8"  stroke="#FFD700" strokeWidth="0.7" opacity="0.12" fill="none"/>
                    <circle className="pj pj6"  cx="200" cy="348" r="2" fill="#FFD700" opacity="0.2"/>
                    <circle className="pj pj11" cx="200" cy="158" r="2" fill="#FFD700" opacity="0.18"/>
                    <path className="ps1" d="M148 505 Q182 355 212 108" stroke="#001F6B" strokeWidth="0.9" fill="none" strokeLinecap="round"/>
                    <path className="ps2" d="M298 472 Q238 328 158 92"  stroke="#001F6B" strokeWidth="0.9" fill="none" strokeLinecap="round"/>
                    <path className="ps3" d="M68 392 Q158 298 338 182"  stroke="#FFD700" strokeWidth="0.8" fill="none" strokeLinecap="round" strokeDasharray="6 9"/>
                </svg>

                <div style={{position:'relative',zIndex:20,display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center',padding:'0 28px',width:'100%'}}>
                    <div className="sflt" style={{width:80,height:96,marginBottom:24,zIndex:30}}>
                        <img src="/escudo.png" alt="UD Las Palmas"
                            style={{width:'100%',height:'100%',objectFit:'contain',filter:'drop-shadow(0 4px 16px rgba(0,20,80,.22))'}}
                            onError={e=>e.target.style.display='none'}/>
                    </div>
                    <div style={{display:'flex',alignItems:'baseline',justifyContent:'center',marginBottom:14}}>
                        <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'clamp(3.8rem,14vw,5.2rem)',color:'#0a0a0a',letterSpacing:3,lineHeight:1}}>PORRA&nbsp;</span>
                        <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'clamp(3.8rem,14vw,5.2rem)',color:'transparent',WebkitTextStroke:'2px #0a0a0a',letterSpacing:3,lineHeight:1}}>UDLP</span>
                    </div>
                    <div className="mcfi" style={{fontFamily:"'Inter',sans-serif",fontSize:10,fontWeight:300,letterSpacing:7,color:'#0a0a0a',textTransform:'uppercase',marginBottom:18}}>2 0 2 6 &nbsp;—&nbsp; 2 0 2 7</div>
                    <div className="mcfi2" style={{display:'flex',alignItems:'center',gap:10,width:150,marginBottom:16}}>
                        <div style={{flex:1,height:1,background:'linear-gradient(90deg,transparent,rgba(10,10,10,.18),transparent)'}}/>
                        <div style={{width:4,height:4,borderRadius:'50%',background:'#FFD700'}}/>
                        <div style={{flex:1,height:1,background:'linear-gradient(90deg,rgba(10,10,10,.18),transparent)'}}/>
                    </div>
                    <div className="mcfi3" style={{fontFamily:"'Inter',sans-serif",fontSize:9,fontWeight:300,letterSpacing:6,color:'#0a0a0a',textTransform:'uppercase',marginBottom:26}}>Creando algo grande</div>
                    <div className="mcfi4" style={{display:'flex',gap:6,marginBottom:28}}>
                        {[0,1,2].map(i=>(<div key={i} className="mcd" style={{width:4,height:4,borderRadius:'50%',background:'#001F6B',animationDelay:`${i*0.25}s`}}/>))}
                    </div>

                    {/* PREINSCRIPCIÓN */}
                    {!showForm && !enviado && (
                        <button onClick={()=>setShowForm(true)} style={{
                            fontFamily:"'Bebas Neue',sans-serif",
                            fontSize:'1rem',letterSpacing:'3px',
                            background:'#001F6B',color:'#FFD700',
                            border:'none',borderRadius:'30px',
                            padding:'12px 28px',cursor:'pointer',
                            boxShadow:'0 4px 16px rgba(0,31,107,0.2)',
                            transition:'transform .2s, box-shadow .2s',
                            animation:'mcfi2 .5s ease 1.5s both'
                        }}>PREINSCRÍBETE AQUÍ →</button>
                    )}

                    {showForm && !enviado && (
                        <div style={{
                            width:'100%',maxWidth:280,
                            animation:'mcfi2 .4s ease both'
                        }}>
                            <p style={{
                                fontFamily:"'Inter',sans-serif",fontSize:10,fontWeight:300,
                                letterSpacing:4,color:'#0a0a0a',opacity:.5,
                                textTransform:'uppercase',marginBottom:12,textAlign:'center'
                            }}>Tu nombre para la lista</p>
                            <input
                                type="text"
                                value={nombre}
                                onChange={e=>setNombre(e.target.value)}
                                onKeyDown={e=>e.key==='Enter'&&handlePreinscripcion()}
                                placeholder="Escribe tu nombre..."
                                maxLength={40}
                                style={{
                                    width:'100%',padding:'12px 16px',
                                    border:'1.5px solid rgba(0,31,107,0.2)',
                                    borderRadius:'12px',
                                    fontFamily:"'Inter',sans-serif",fontSize:'0.95rem',
                                    color:'#0a0a0a',background:'#f8f8f8',
                                    outline:'none',marginBottom:10,
                                    textAlign:'center',letterSpacing:'1px'
                                }}
                                autoFocus
                            />
                            <button onClick={handlePreinscripcion} disabled={enviando||!nombre.trim()} style={{
                                width:'100%',
                                fontFamily:"'Bebas Neue',sans-serif",
                                fontSize:'1rem',letterSpacing:'3px',
                                background: nombre.trim() ? '#001F6B' : 'rgba(0,31,107,0.3)',
                                color:'#FFD700',border:'none',borderRadius:'30px',
                                padding:'12px',cursor: nombre.trim() ? 'pointer' : 'not-allowed',
                                transition:'all .2s'
                            }}>{enviando ? 'GUARDANDO...' : 'APUNTAR MI NOMBRE'}</button>
                        </div>
                    )}

                    {enviado && (
                        <div style={{textAlign:'center',animation:'mcfi2 .5s ease both'}}>
                            <div style={{fontSize:'2rem',marginBottom:8}}>✅</div>
                            <p style={{
                                fontFamily:"'Bebas Neue',sans-serif",fontSize:'1.2rem',
                                letterSpacing:'2px',color:'#001F6B',marginBottom:4
                            }}>¡{nombre}, ya estás en la lista!</p>
                            <p style={{
                                fontFamily:"'Inter',sans-serif",fontSize:10,fontWeight:300,
                                letterSpacing:3,color:'#0a0a0a',opacity:.4,textTransform:'uppercase'
                            }}>Te avisaremos cuando empiece la temporada</p>
                        </div>
                    )}

                    {/* Acceso modo prueba — solo para testers */}
                    <div style={{marginTop:32,width:'100%',maxWidth:280}}>
                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:9,letterSpacing:3,
                            color:'rgba(0,0,0,0.2)',textTransform:'uppercase',textAlign:'center',marginBottom:8}}>
                            Acceso de prueba
                        </p>
                        <div style={{display:'flex',gap:8}}>
                            <input
                                type="password"
                                value={codigoPrueba}
                                onChange={function(e){setCodigoPrueba(e.target.value);setErrorCodigo('');}}
                                onKeyDown={function(e){
                                    if(e.key==='Enter'){
                                        if(codigoPrueba===CODIGO_PRUEBA){
                                            sessionStorage.setItem('porra_prueba','1');
                                            window.location.reload();
                                        } else { setErrorCodigo('Código incorrecto'); }
                                    }
                                }}
                                placeholder="Código..."
                                style={{flex:1,padding:'8px 12px',border:'1px solid rgba(0,0,0,0.1)',
                                    borderRadius:8,fontFamily:"'Inter',sans-serif",fontSize:12,
                                    background:'rgba(0,0,0,0.03)',outline:'none',color:'#0a0a0a'}}
                            />
                            <button onClick={function(){
                                if(codigoPrueba===CODIGO_PRUEBA){
                                    sessionStorage.setItem('porra_prueba','1');
                                    window.location.reload();
                                } else { setErrorCodigo('Código incorrecto'); }
                            }} style={{padding:'8px 16px',background:'#001F6B',color:'#FFD700',
                                border:'none',borderRadius:8,fontFamily:"'Bebas Neue',sans-serif",
                                fontSize:12,letterSpacing:1,cursor:'pointer'}}>
                                →
                            </button>
                        </div>
                        {errorCodigo && <p style={{fontFamily:"'Inter',sans-serif",fontSize:10,
                            color:'#e63946',marginTop:4,textAlign:'center'}}>{errorCodigo}</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// --- PANTALLAS DE USUARIO ---
// ============================================================================

// Plazo de APERTURA del draft de El Otro Equipo — fecha FIJA de la primera
// noche real de apertura, no recalculada. El fallo real que había: esta
// constante se calculaba como "medianoche de HOY" cada vez que alguien
// cargaba la app — como el draft ya lleva días abierto, seguía diciendo
// "abre esta noche" para siempre, con un número de horas sin sentido según
// a qué hora del día se cargara. Ahora es una fecha del pasado, fija, y a
// partir de aquí lo único que sigue pausando el draft día a día es la
// pausa nocturna (01:00-09:00), no esto.
// El draft ya lleva días abierto de verdad (turnos reales, saltos reales,
// bajas reales ya han pasado) — así que esta fecha ya no necesita ser
// precisa, solo tiene que quedar inequívocamente en el pasado para siempre,
// sin que yo tenga que adivinar la fecha exacta de apertura cada vez (eso
// es justo lo que salió mal la vez anterior: adiviné mal y puse la
// apertura en la noche de HOY en vez de en el pasado). A partir de aquí,
// lo único que sigue pausando el draft día a día es la pausa nocturna
// (01:00-09:00), nunca esta fecha.
const PLAZO_APERTURA_EL_OTRO = new Date('2020-01-01T00:00:00Z');
const PLAZO_EL_OTRO = new Date('2026-08-14T17:00:00Z');
// Tiempo máximo por turno antes de saltarlo: 60 minutos
const TIMEOUT_TURNO_MINUTOS = 60;

// Pausa nocturna del draft de El Otro Equipo — de 01:00 a 09:00 hora canaria,
// todos los días mientras dure el draft (por igualdad de condiciones, ya que
// hay gente durmiendo). Nadie recibe turno nuevo durante la pausa, y a quien
// ya le tocaba se le "congela" el cronómetro — al reanudar sigue exactamente
// donde se quedó, sin que las horas de sueño le coman su tiempo de turno.
function estaEnPausaNocturna(fecha) {
    // 01:00-09:00 hora canaria (UTC+1 en agosto) = 00:00-08:00 UTC
    var h = fecha.getUTCHours();
    return h >= 0 && h < 8;
}

function minutosPausaEnRango(inicio, fin) {
    var minutosPausa = 0;
    var cursor = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), inicio.getUTCDate(), 0, 0, 0));
    while (cursor < fin) {
        var pausaInicio = new Date(cursor.getTime());
        var pausaFin = new Date(cursor.getTime() + 8 * 60 * 60 * 1000);
        var solapaInicio = new Date(Math.max(pausaInicio.getTime(), inicio.getTime()));
        var solapaFin = new Date(Math.min(pausaFin.getTime(), fin.getTime()));
        if (solapaFin > solapaInicio) minutosPausa += (solapaFin - solapaInicio) / 60000;
        cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    }
    return minutosPausa;
}

function minutosEfectivosTranscurridos(inicio, fin) {
    var totalBruto = (fin - inicio) / 60000;
    return Math.max(0, totalBruto - minutosPausaEnRango(inicio, fin));
}

// Cuenta atrás de El Otro Equipo en la pantalla principal — antes de que
// abra la temporada, cuenta hasta PLAZO_APERTURA_EL_OTRO; durante la pausa
// nocturna (01:00-09:00), cuenta hasta que se reanude a las 09:00. Si está
// abierto ahora mismo, no muestra nada (no hace falta contar nada).
function CuentaAtrasElOtro() {
    var [ahora, setAhora] = useState(new Date());
    useEffect(function() {
        var t = setInterval(function() { setAhora(new Date()); }, 1000);
        return function() { clearInterval(t); };
    }, []);

    var objetivo = null;
    var etiqueta = '';
    if (ahora < PLAZO_APERTURA_EL_OTRO) {
        objetivo = PLAZO_APERTURA_EL_OTRO;
        etiqueta = '🛡️ El Otro Equipo abre en';
    } else if (estaEnPausaNocturna(ahora)) {
        var proximas09 = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate(), 8, 0, 0));
        if (proximas09 <= ahora) proximas09 = new Date(proximas09.getTime() + 24 * 60 * 60 * 1000);
        objetivo = proximas09;
        etiqueta = '🌙 El Otro Equipo se reanuda en';
    } else {
        return null;
    }

    var msRestante = objetivo - ahora;
    if (msRestante < 0) return null;
    var horas = Math.floor(msRestante / 3600000);
    var minutos = Math.floor((msRestante % 3600000) / 60000);
    var segundos = Math.floor((msRestante % 60000) / 1000);
    var pad = function(n) { return String(n).padStart(2, '0'); };

    return (
        <div style={{background:'linear-gradient(135deg,#001F6B,#003a9e)',borderRadius:14,padding:'14px 16px',marginBottom:16,textAlign:'center'}}>
            <p style={{fontFamily:"'Teko',sans-serif",fontSize:12,letterSpacing:2,color:'rgba(255,215,0,0.7)',textTransform:'uppercase',marginBottom:6}}>
                {etiqueta}
            </p>
            <p style={{fontFamily:"'Teko',sans-serif",fontSize:30,fontWeight:700,color:'#FFD700',letterSpacing:2}}>
                {pad(horas)}:{pad(minutos)}:{pad(segundos)}
            </p>
        </div>
    );
}

const TABLA_PUNTOS_ESTRELLAS = [
    { accion: 'Gol (portero/defensa)', estrellas: 8 },
    { accion: 'Gol (centrocampista)', estrellas: 6 },
    { accion: 'Gol (delantero)', estrellas: 5 },
    { accion: 'Asistencia', estrellas: 3 },
    { accion: 'Portería a cero (portero)', estrellas: 4 },
    { accion: 'Portería a cero (defensa)', estrellas: 2 },
    { accion: 'Ser titular', estrellas: 2 },
    { accion: 'Entrar como suplente', estrellas: 1 },
    { accion: 'Tarjeta amarilla', estrellas: -1 },
    { accion: 'Tarjeta roja', estrellas: -3 },
    { accion: 'Penalti fallado', estrellas: -2 },
];

const MisEstrellasModal = ({ user, plantilla, jornada, onClose }) => {
    var G = styles.colors;
    var [seleccion, setSeleccion] = useState([]);
    var [guardado, setGuardado] = useState(false);
    var [guardando, setGuardando] = useState(false);
    var [posFiltro, setPosicion] = useState('Todos');
    var [tab, setTab] = useState('elegir'); // 'elegir' | 'puntos'

    useEffect(function() {
        if (!jornada) return;
        getDoc(doc(db, "estrellas_seleccion", jornada.id, "jugadores", user)).then(function(snap) {
            if (snap.exists()) { setSeleccion(snap.data().jugadores || []); setGuardado(true); }
        });
    }, [jornada, user]);

    var toggle = function(j) {
        if (jornada && jornada.estado !== 'Abierta') return; // solo bloqueado cuando la jornada realmente cierra
        var ya = seleccion.find(function(s) { return s.nombre === j.nombre; });
        if (ya) { setSeleccion(seleccion.filter(function(s) { return s.nombre !== j.nombre; })); }
        else if (seleccion.length < 5) { setSeleccion([...seleccion, j]); }
    };

    var guardar = async function() {
        if (!jornada || seleccion.length === 0) return;
        setGuardando(true);
        try {
            await setDoc(doc(db, "estrellas_seleccion", jornada.id, "jugadores", user), {
                jugadores: seleccion, guardadoEn: serverTimestamp(), usuario: user
            }, { merge: true });
            setGuardado(true);
        } catch(e) { console.error(e); }
        setGuardando(false);
    };

    var posiciones = ['Todos','Portero','Defensa','Centrocampista','Mediapunta','Delantero'];
    var plantillaFiltrada = posFiltro === 'Todos' ? plantilla : plantilla.filter(function(j) { return j.posicion === posFiltro; });

    return (
        <div style={{position:'fixed',inset:0,background:'rgba(0,10,40,0.75)',zIndex:200,display:'flex',alignItems:'flex-end',justifyContent:'center'}}
            onClick={function(e) { if (e.target === e.currentTarget) onClose(); }}>
            <div style={{background:'#fff',borderRadius:'24px 24px 0 0',width:'100%',maxWidth:520,
                maxHeight:'90vh',display:'flex',flexDirection:'column',animation:'slideIn .3s ease'}}>

                {/* Header */}
                <div style={{background:'#001F6B',borderRadius:'24px 24px 0 0',padding:'18px 20px 0'}}>
                    <div style={{display:'flex',alignItems:'center',marginBottom:12}}>
                        <div>
                            <p style={{fontFamily:"'Teko',sans-serif",fontSize:22,fontWeight:700,color:'#FFD700',letterSpacing:2}}>MIS 5 ESTRELLAS</p>
                            <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'rgba(255,255,255,0.4)'}}>
                                J{jornada && jornada.numeroJornada} · {seleccion.length}/5 seleccionados
                            </p>
                        </div>
                        <button onClick={onClose} style={{marginLeft:'auto',background:'none',border:'none',color:'rgba(255,255,255,0.3)',fontSize:22,cursor:'pointer'}}>✕</button>
                    </div>
                    {/* Tabs */}
                    <div style={{display:'flex',gap:0}}>
                        {[['elegir','Elegir jugadores'],['puntos','Tabla de ⭐']].map(function(t) {
                            return (
                                <button key={t[0]} onClick={function() { setTab(t[0]); }}
                                    style={{flex:1,padding:'10px 0',border:'none',cursor:'pointer',
                                        background:'transparent',borderBottom: tab===t[0] ? '3px solid #FFD700' : '3px solid transparent',
                                        fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:2,textTransform:'uppercase',
                                        color: tab===t[0] ? '#FFD700' : 'rgba(255,255,255,0.35)'}}>
                                    {t[1]}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Contenido */}
                <div style={{flex:1,overflowY:'auto',padding:'16px'}}>
                    {tab === 'puntos' ? (
                        <div>
                            <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:G.deepBlue,opacity:.6,marginBottom:16,lineHeight:1.6}}>
                                Cada acción de tus jugadores elegidos suma o resta estrellas. El ranking de estrellas de la jornada determina cuántos puntos ganas para la clasificación general (1º→5pts, 2º→4pts, ...).
                            </p>
                            {TABLA_PUNTOS_ESTRELLAS.map(function(r,i) {
                                return (
                                    <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:'1px solid rgba(0,31,107,0.05)'}}>
                                        <span style={{fontFamily:"'Inter',sans-serif",fontSize:13,color:G.deepBlue,flex:1}}>{r.accion}</span>
                                        <span style={{fontFamily:"'Teko',sans-serif",fontSize:18,fontWeight:700,
                                            color: r.estrellas > 0 ? '#FFD700' : G.danger}}>
                                            {r.estrellas > 0 ? '+' : ''}{r.estrellas} ⭐
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <>
                            {/* Selección actual — con foto */}
                            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16,minHeight:36}}>
                                {seleccion.map(function(j,i) {
                                    return (
                                        <span key={i} onClick={function() { toggle(j); }}
                                            style={{display:'inline-flex',alignItems:'center',gap:6,
                                                background:G.golden,color:'#001F6B',borderRadius:20,padding:'4px 12px 4px 4px',
                                                fontFamily:"'Inter',sans-serif",fontSize:12,fontWeight:600,
                                                cursor: (!jornada || jornada.estado==='Abierta') ? 'pointer' : 'default'}}>
                                            {getFotoJugador(j) ? (
                                                <img src={getFotoJugador(j)} alt="" style={{width:20,height:20,borderRadius:'50%',objectFit:'cover',background:'#fff'}}
                                                    onError={function(e){e.target.style.display='none';}} />
                                            ) : <span>⭐</span>}
                                            {j.nombre}
                                        </span>
                                    );
                                })}
                                {seleccion.length === 0 && <span style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,31,107,0.35)'}}>Ningún jugador seleccionado aún</span>}
                            </div>

                            {/* Filtro posición */}
                            <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:14}}>
                                {posiciones.map(function(p) {
                                    return (
                                        <button key={p} onClick={function() { setPosicion(p); }}
                                            style={{padding:'5px 12px',borderRadius:20,border:'none',cursor:'pointer',
                                                fontFamily:"'Inter',sans-serif",fontSize:11,fontWeight:600,
                                                background: posFiltro===p ? G.deepBlue : '#f0f0f0',
                                                color: posFiltro===p ? '#FFD700' : G.deepBlue}}>
                                            {p}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Jugadores */}
                            {(!jornada || jornada.estado === 'Abierta') && (
                                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:10,marginBottom:16}}>
                                    {plantillaFiltrada.map(function(j,i) {
                                        var sel = !!seleccion.find(function(s) { return s.nombre===j.nombre; });
                                        var lleno = seleccion.length >= 5 && !sel;
                                        return (
                                            <button key={i} onClick={function() { toggle(j); }} disabled={lleno}
                                                style={{padding:'12px 8px',borderRadius:14,cursor:lleno?'not-allowed':'pointer',
                                                    border: sel?'2px solid #FFD700':'1.5px solid rgba(0,31,107,0.1)',
                                                    background: sel?'rgba(255,215,0,0.1)':'#f8f8f8',
                                                    opacity: lleno?0.4:1,textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
                                                {getFotoJugador(j) ? (
                                                    <img src={getFotoJugador(j)} alt={j.nombre}
                                                        style={{width:44,height:44,borderRadius:'50%',objectFit:'cover',border: sel?'2px solid #FFD700':'2px solid rgba(0,31,107,0.1)'}}
                                                        onError={function(e){e.target.style.display='none';}} />
                                                ) : (
                                                    <div style={{width:44,height:44,borderRadius:'50%',background:'rgba(0,31,107,0.08)',
                                                        display:'flex',alignItems:'center',justifyContent:'center',
                                                        fontFamily:"'Teko',sans-serif",fontSize:16,color:G.deepBlue}}>
                                                        {j.dorsal}
                                                    </div>
                                                )}
                                                <span style={{fontFamily:"'Inter',sans-serif",fontSize:11,fontWeight:600,color:G.deepBlue,lineHeight:1.2}}>{j.nombre}</span>
                                                <span style={{fontFamily:"'Inter',sans-serif",fontSize:9,color:'rgba(0,31,107,0.4)'}}>{j.posicion}</span>
                                                {sel && <span style={{fontSize:14}}>⭐</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {jornada && jornada.estado !== 'Abierta' ? (
                                <div style={{background:'rgba(0,31,107,0.05)',border:'1px solid rgba(0,31,107,0.12)',borderRadius:12,padding:16,textAlign:'center'}}>
                                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:16,color:G.deepBlue,letterSpacing:2}}>🔒 JORNADA CERRADA</p>
                                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:G.deepBlue,opacity:.5,marginTop:4}}>Tu selección quedó fijada al cerrarse la jornada.</p>
                                </div>
                            ) : seleccion.length > 0 && (
                                <button onClick={guardar} disabled={guardando}
                                    style={{width:'100%',fontFamily:"'Teko',sans-serif",fontSize:'1.1rem',letterSpacing:2,
                                        background: guardado ? '#10b981' : G.deepBlue, color: guardado ? '#fff' : '#FFD700',
                                        border:'none',borderRadius:30,padding:14,cursor:'pointer'}}>
                                    {guardando ? 'GUARDANDO...' : guardado ? '✅ GUARDADO — ACTUALIZAR' : 'CONFIRMAR ' + seleccion.length + ' ESTRELLA' + (seleccion.length>1?'S':'')}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const PorraAnualModal = ({ user, onClose }) => {
    var G = styles.colors;
    var [ascenso, setAscenso] = useState('');
    var [puesto, setPuesto] = useState('');
    var [guardado, setGuardado] = useState(false);
    var [cargando, setCargando] = useState(true);
    var [mensaje, setMensaje] = useState('');

    useEffect(function() {
        getDoc(doc(db, "porraAnual2627", user)).then(function(snap) {
            if (snap.exists()) {
                var d = snap.data();
                setAscenso(d.ascenso || '');
                setPuesto(d.puesto || '');
                setGuardado(true);
            }
            setCargando(false);
        });
    }, [user]);

    var guardar = async function() {
        if (!ascenso || !puesto) { setMensaje('Rellena ambas opciones.'); return; }
        try {
            await setDoc(doc(db, "porraAnual2627", user), {
                ascenso: ascenso, puesto: Number(puesto), usuario: user, guardadoEn: serverTimestamp()
            }, { merge: true });
            setGuardado(true);
            setMensaje('✅ Porra anual guardada. Puedes modificarla hasta que empiece la J6.');
        } catch(e) { setMensaje('❌ Error: ' + e.message); }
    };

    return (
        <div style={{position:'fixed',inset:0,background:'rgba(0,10,40,0.7)',zIndex:200,display:'flex',alignItems:'flex-end',justifyContent:'center'}}
            onClick={function(e) { if (e.target === e.currentTarget) onClose(); }}>
            <div style={{background:'#fff',borderRadius:'24px 24px 0 0',padding:'28px 24px 40px',width:'100%',maxWidth:500,animation:'slideIn .3s ease'}}>
                <div style={{display:'flex',alignItems:'center',marginBottom:20}}>
                    <div>
                        <p style={{fontFamily:"'Teko',sans-serif",fontSize:22,fontWeight:700,color:G.deepBlue,letterSpacing:2}}>PORRA ANUAL 26/27</p>
                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:G.deepBlue,opacity:.5}}>Hasta 20 puntos extra · Cierra antes de la Jornada 6</p>
                    </div>
                    <button onClick={onClose} style={{marginLeft:'auto',background:'none',border:'none',fontSize:22,color:'rgba(0,31,107,0.3)',cursor:'pointer'}}>✕</button>
                </div>

                {cargando ? <p style={{textAlign:'center',color:G.deepBlue,fontFamily:"'Teko',sans-serif",letterSpacing:2}}>CARGANDO...</p> : (
                    <>
                        {/* Pregunta 1: ¿Asciende? */}
                        <div style={{marginBottom:20}}>
                            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                                <p style={{fontFamily:"'Teko',sans-serif",fontSize:15,letterSpacing:2,color:G.deepBlue,textTransform:'uppercase',flex:1}}>¿Asciende la UDLP?</p>
                                <span style={{fontFamily:"'Teko',sans-serif",fontSize:13,background:'rgba(0,31,107,0.08)',color:G.deepBlue,padding:'3px 10px',borderRadius:10}}>5 PTS</span>
                            </div>
                            <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:G.deepBlue,opacity:.45,marginBottom:10}}>
                                Si asciende por playoff, se cuenta la posición antes del playoff.
                            </p>
                            <div style={{display:'flex',gap:10}}>
                                {['Sí asciende','No asciende'].map(function(op) {
                                    var sel = ascenso === op;
                                    return (
                                        <button key={op} onClick={function() { setAscenso(op); setGuardado(false); }}
                                            style={{flex:1,padding:'14px 0',borderRadius:12,border: sel ? 'none' : '1.5px solid rgba(0,31,107,0.15)',
                                                background: sel ? '#001F6B' : '#f8f8f8',fontFamily:"'Teko',sans-serif",
                                                fontSize:16,fontWeight:700,letterSpacing:1,color: sel ? '#FFD700' : 'rgba(0,31,107,0.4)',cursor:'pointer'}}>
                                            {op}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Pregunta 2: Puesto */}
                        <div style={{marginBottom:20}}>
                            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                                <p style={{fontFamily:"'Teko',sans-serif",fontSize:15,letterSpacing:2,color:G.deepBlue,textTransform:'uppercase',flex:1}}>Puesto final en liga</p>
                                <span style={{fontFamily:"'Teko',sans-serif",fontSize:13,background:'rgba(0,31,107,0.08)',color:G.deepBlue,padding:'3px 10px',borderRadius:10}}>10 PTS · o 20 si aciertas ambas</span>
                            </div>
                            <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:6}}>
                                {Array.from({length:22},function(_,i) { return i+1; }).map(function(n) {
                                    var sel = Number(puesto) === n;
                                    return (
                                        <button key={n} onClick={function() { setPuesto(n); setGuardado(false); }}
                                            style={{padding:'10px 0',borderRadius:10,border: sel ? 'none' : '1px solid rgba(0,31,107,0.12)',
                                                background: sel ? '#001F6B' : '#f8f8f8',fontFamily:"'Teko',sans-serif",
                                                fontSize:16,fontWeight:700,color: sel ? '#FFD700' : 'rgba(0,31,107,0.5)',cursor:'pointer'}}>
                                            {n}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {mensaje && <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color: mensaje.startsWith('✅') ? '#10b981' : G.danger,marginBottom:12,textAlign:'center'}}>{mensaje}</p>}
                        <button onClick={guardar}
                            style={{width:'100%',fontFamily:"'Teko',sans-serif",fontSize:'1.1rem',letterSpacing:2,
                                background: guardado ? '#10b981' : G.deepBlue,color:'#fff',border:'none',borderRadius:30,padding:14,cursor:'pointer'}}>
                            {guardado ? '✅ GUARDADO' : 'GUARDAR PORRA ANUAL'}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

const MiJornadaScreen = ({ user, teamLogos, plantilla, userProfiles, onlineUsers, pagos, onIrAPagos }) => {
    var G = styles.colors;
    var [jornada, setJornada] = useState(null);
    var [loading, setLoading] = useState(true);
    var [pronostico, setPronostico] = useState({ golesLocal: '', golesVisitante: '', resultado1x2: '' });
    var [elOtroActivado, setElOtroActivado] = useState(false);
    var [partidoOtro, setPartidoOtro] = useState(null); // partido de Primera del Otro Equipo, cargado al saber la jornada
    var [cargandoPartidoOtro, setCargandoPartidoOtro] = useState(false);
    var [miElOtro, setMiElOtro] = useState(null);
    var [guardado, setGuardado] = useState(false);
    var [mensaje, setMensaje] = useState('');
    var [participantes, setParticipantes] = useState([]);
    var [pronosticosTodos, setPronosticosTodos] = useState([]); // para stats agregadas — sin exponer nombres en UI
    var [timeLeft, setTimeLeft] = useState('');
    var [showPorraAnual, setShowPorraAnual] = useState(false);
    var [showEstrellas, setShowEstrellas] = useState(false);

    // Sincronización automática con API cada 5 minutos cuando hay jornada en vivo
    useEffect(function() {
        if (!jornada || (jornada.estado !== 'En vivo' && jornada.estado !== 'Abierta')) return;
        if (!API_FOOTBALL_KEY) return;
        var sincronizar = async function() {
            try {
                // season=2026 confirmado directamente en el panel de API-Football
                // para la Segunda División 26/27 — ya no hace falta probar dos.
                var url = 'https://v3.football.api-sports.io/fixtures?league=141&season=2026&date=' + jornada.fecha + '&team=' + API_TEAM_ID_UDLP;
                var res = await fetch(url, { headers: { 'x-apisports-key': API_FOOTBALL_KEY } });
                var data = await res.json();
                if (data.response && data.response.length > 0) {
                    var f = data.response[0];
                    var isLive = ['LIVE','1H','2H','HT','ET'].includes(f.fixture.status.short);
                    var primerGol = (f.events||[]).find(function(e) { return e.type==='Goal' && e.detail!=='Missed Penalty'; });
                    await setDoc(doc(db, "jornadas", jornada.id), {
                        fixtureId: f.fixture.id, // necesario para pedir luego las estadísticas por jugador (Estrellas)
                        liveData: {
                            golesLocal: f.goals.home,
                            golesVisitante: f.goals.away,
                            primerGoleador: primerGol ? primerGol.player.name : '',
                            isLive: isLive,
                            actualizadoEn: new Date().toISOString()
                        },
                        estado: isLive ? 'En vivo' : jornada.estado
                    }, { merge: true });

                    // Estrellas en directo — estimación provisional, NO toca la
                    // clasificación definitiva (esa solo se escribe al finalizar).
                    if (isLive && plantilla && plantilla.length > 0) {
                        try {
                            var urlJug = 'https://v3.football.api-sports.io/fixtures/players?fixture=' + f.fixture.id;
                            var resJug = await fetch(urlJug, { headers: { 'x-apisports-key': API_FOOTBALL_KEY } });
                            var dataJug = await resJug.json();
                            if (dataJug.response && dataJug.response.length > 0) {
                                var statsPorApiId = {};
                                dataJug.response.forEach(function(equipo) {
                                    (equipo.players || []).forEach(function(p) {
                                        statsPorApiId[p.player.id] = (p.statistics && p.statistics[0]) || {};
                                    });
                                });
                                var udlpEsLocal = jornada.equipoLocal === 'UD Las Palmas';
                                var golesEncajadosAhora = udlpEsLocal ? f.goals.away : f.goals.home;
                                var porteriaACeroAhora = golesEncajadosAhora === 0;
                                var calc = calcularPuntosPlantillaDesdeStats(statsPorApiId, plantilla, porteriaACeroAhora);
                                await setDoc(doc(db, "jornadas", jornada.id), {
                                    liveEstrellas: { puntosPorNombre: calc.puntosPorNombre, actualizadoEn: new Date().toISOString() }
                                }, { merge: true });
                            }
                        } catch(e2) { console.warn('Estrellas en vivo — error:', e2.message); }
                    }
                }
            } catch(e) { console.warn('API sync error:', e.message); }
        };
        sincronizar(); // Primera vez inmediata
        var intervalo = setInterval(sincronizar, 5 * 60 * 1000); // Cada 5 min
        return function() { clearInterval(intervalo); };
    }, [jornada, plantilla]);

    // Cargar jornada activa
    useEffect(function() {
        if (!user) return;
        var q = query(collection(db, "jornadas"),
            where("estado", "in", ["Abierta", "En vivo"]),
            orderBy("numeroJornada", "desc"), limit(1));
        var unsub = onSnapshot(q, function(snap) {
            if (!snap.empty) {
                var j = { id: snap.docs[0].id, ...snap.docs[0].data() };
                setJornada(j);
                // Cargar pronóstico existente
                getDoc(doc(db, "pronosticos", snap.docs[0].id, "jugadores", user)).then(function(p) {
                    if (p.exists()) {
                        var d = p.data();
                        setPronostico({ golesLocal: d.golesLocal ?? '', golesVisitante: d.golesVisitante ?? '', resultado1x2: d.resultado1x2 || '' });
                        setElOtroActivado(d.elOtroActivado || false);
                        setGuardado(true);
                    }
                });
                // Participantes que ya apostaron + sus marcadores (para stats agregadas, sin mostrar nombres)
                onSnapshot(collection(db, "pronosticos", snap.docs[0].id, "jugadores"), function(ps) {
                    var docs = ps.docs.map(function(d) { return { id: d.id, ...d.data() }; });
                    setParticipantes(docs.map(function(d) { return d.id; }));
                    setPronosticosTodos(docs);
                });
            }

            setLoading(false);
        });
        // Mi El Otro
        var unsubOtro = onSnapshot(doc(db, "elOtro", user), function(snap) {
            if (snap.exists()) setMiElOtro(snap.data());
        });
        return function() { unsub(); unsubOtro(); };
    }, [user]);

    // Buscar el partido de Primera del Otro Equipo en cuanto sepamos qué
    // equipo tengo y qué jornada de Segunda está abierta — así puedo mostrar
    // rival, fecha y hora, y saber cuándo se cierra el plazo de activación.
    useEffect(function() {
        if (!miElOtro || !miElOtro.equipo || !jornada) { setPartidoOtro(null); return; }
        setCargandoPartidoOtro(true);
        buscarPartidoPrimera(miElOtro.equipo, jornada.fecha).then(function(p) {
            setPartidoOtro(p);
            setCargandoPartidoOtro(false);
        }).catch(function() { setCargandoPartidoOtro(false); });
    }, [miElOtro, jornada]);

    // Plazo de activación: hasta que empiece el partido de Primera de tu
    // equipo — nunca después, para no entrar en conflicto con lo que ya haya
    // pasado en el campo.
    var plazoActivacionSuperado = !!(partidoOtro && partidoOtro.fecha && new Date() >= new Date(partidoOtro.fecha));

    // Countdown al cierre
    useEffect(function() {
        if (!jornada || !jornada.fechaCierre) return;
        var tick = setInterval(function() {
            var cierre = jornada.fechaCierre.toDate ? jornada.fechaCierre.toDate() : new Date(jornada.fechaCierre);
            var diff = cierre - new Date();
            if (diff <= 0) { setTimeLeft('CERRADO'); clearInterval(tick); return; }
            var h = Math.floor(diff / 3600000);
            var m = Math.floor((diff % 3600000) / 60000);
            var s = Math.floor((diff % 60000) / 1000);
            setTimeLeft(h + 'h ' + m + 'm ' + s + 's');
        }, 1000);
        return function() { clearInterval(tick); };
    }, [jornada]);

    // ¿Ha pagado esta jornada en concreto? El sistema deja apostar igualmente
    // (no bloquea el formulario) — el pago solo confirma que el resultado
    // contará al cerrar la jornada. Sin pagar, el resultado no se tiene en
    // cuenta aunque esté guardado.
    var jornadaCodigo = jornada ? 'J' + jornada.numeroJornada : null;
    var jornadaPagada = jornadaCodigo && (pagos || []).some(function(p) {
        return p.jugador === user && p.jornada === jornadaCodigo &&
            (p.tipo === 'jornada_normal' || p.tipo === 'jornada_vip') &&
            p.estado !== 'cancelado' && p.estado !== 'rechazado' && p.estado !== 'fallido';
    });

    var guardar = async function() {
        if (pronostico.golesLocal === '' || pronostico.golesVisitante === '' || !pronostico.resultado1x2) {
            setMensaje('Rellena el marcador y el 1X2 antes de guardar.'); return;
        }
        if (elOtroActivado && plazoActivacionSuperado) {
            setMensaje('❌ Ya no puedes activar El Otro Equipo — su partido de Primera ya ha empezado.');
            return;
        }
        try {
            await setDoc(doc(db, "pronosticos", jornada.id, "jugadores", user), {
                golesLocal: Number(pronostico.golesLocal),
                golesVisitante: Number(pronostico.golesVisitante),
                resultado1x2: pronostico.resultado1x2,
                elOtroActivado: elOtroActivado,
                // Guardamos el partido exacto en el momento de activar, para
                // que al cerrar la jornada no haya que adivinar cuál era.
                elOtroFixtureId: elOtroActivado && partidoOtro ? partidoOtro.fixtureId : null,
                elOtroEquipoUsado: elOtroActivado ? (miElOtro && miElOtro.equipo) : null,
                guardadoEn: serverTimestamp(),
                usuario: user,
                puntosObtenidos: 0,
            }, { merge: true });
            setGuardado(true);
            setMensaje(jornadaPagada ? '✅ Apuesta guardada correctamente.' : '✅ Apuesta guardada — recuerda pagar esta jornada por Bizum para que cuente.');
        } catch(e) { setMensaje('❌ Error al guardar: ' + e.message); }
    };

    // Multiplicador de El Otro según activaciones — versión única en getMultiplicadorOtro()
    var getMultiplicador = getMultiplicadorOtro;

    if (loading) return <LoadingSkeleton />;

    // Bloqueo hasta que pague la inscripción
    if (!jugadorHaPagado(user, pagos || [])) {
        return (
            <div style={{paddingBottom:40}}>
                <h2 style={{fontFamily:"'Teko',sans-serif",fontSize:22,letterSpacing:3,color:'#001F6B',textTransform:'uppercase',marginBottom:6,fontWeight:700}}>MI JORNADA</h2>
                <BannerPagoPendiente onIrAPagos={onIrAPagos} />
            </div>
        );
    }

    var cerrado = jornada && jornada.estado !== 'Abierta';
    var finalizada = jornada && jornada.estado === 'Finalizada';
    var mult = miElOtro ? getMultiplicador(miElOtro.activaciones || 0) : 2;

    // Estadísticas agregadas de la jornada — SIN nombres, para que la gente
    // vea qué resultados se repiten y pueda evitar duplicarse, sin saber quién puso qué.
    var statsDistribucion = function() {
        var porMarcador = {}; // "2-1" -> conteo
        var por1x2 = { Local: 0, Empate: 0, Visitante: 0 };
        pronosticosTodos.forEach(function(p) {
            if (p.golesLocal === undefined || p.golesVisitante === undefined) return;
            var key = p.golesLocal + '-' + p.golesVisitante;
            porMarcador[key] = (porMarcador[key] || 0) + 1;
            if (p.resultado1x2 && por1x2[p.resultado1x2] !== undefined) por1x2[p.resultado1x2]++;
        });
        var marcadoresOrdenados = Object.keys(porMarcador)
            .map(function(k) { return { marcador: k, cuenta: porMarcador[k] }; })
            .sort(function(a, b) { return b.cuenta - a.cuenta; });
        return { marcadoresOrdenados: marcadoresOrdenados, por1x2: por1x2, total: pronosticosTodos.length };
    };

    if (!jornada) return (
        <div style={{padding:40,textAlign:'center'}}>
            <p style={{fontFamily:"'Teko',sans-serif",fontSize:22,color:G.deepBlue,letterSpacing:2}}>NO HAY JORNADA ACTIVA</p>
            <p style={{fontFamily:"'Inter',sans-serif",fontSize:13,color:G.deepBlue,opacity:.5,marginTop:8}}>La próxima jornada estará disponible pronto.</p>
        </div>
    );

    return (
        <div style={{paddingBottom:40}}>
            {/* Banner jornada */}
            <div style={{background:'#001F6B',borderRadius:18,padding:20,marginBottom:20,position:'relative',overflow:'hidden'}}>
                <div style={{position:'absolute',top:0,right:0,width:120,height:120,background:'rgba(255,215,0,0.04)',borderRadius:'0 18px 0 120px'}} />
                <p style={{fontFamily:"'Teko',sans-serif",fontSize:11,letterSpacing:4,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',marginBottom:4}}>
                    Jornada {jornada.numeroJornada} {jornada.esVip ? '⭐ VIP' : ''} {jornada.derbi ? '🔥 DERBI' : ''}
                </p>
                {/* Escudos y marcador */}
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                    <img src={jornada.equipoLocal === 'UD Las Palmas' ? '/escudo.png' : getLogoEquipo(jornada.equipoLocal, teamLogos)}
                        alt={jornada.equipoLocal} style={{width:32,height:32,objectFit:'contain',flexShrink:0}}
                        onError={function(e){e.target.src='https://placehold.co/60x60/001F6B/FFD700?text=' + encodeURIComponent((jornada.equipoLocal||'?').substring(0,3));}} />
                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:22,fontWeight:700,color:'#FFD700',letterSpacing:1,flex:1}}>
                        {jornada.equipoLocal} vs {jornada.equipoVisitante}
                    </p>
                    <img src={jornada.equipoVisitante === 'UD Las Palmas' ? '/escudo.png' : getLogoEquipo(jornada.equipoVisitante, teamLogos)}
                        alt={jornada.equipoVisitante} style={{width:32,height:32,objectFit:'contain',flexShrink:0}}
                        onError={function(e){e.target.src='https://placehold.co/60x60/001F6B/FFD700?text=' + encodeURIComponent((jornada.equipoVisitante||'?').substring(0,3));}} />
                </div>
                <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'rgba(255,255,255,0.35)'}}>
                    {jornada.estadio} · {jornada.fecha}
                </p>
                {timeLeft && timeLeft !== 'CERRADO' && (
                    <div style={{marginTop:12,display:'flex',alignItems:'center',gap:8}}>
                        <i className="ti ti-clock" style={{color:'rgba(255,255,255,0.4)',fontSize:14}} aria-hidden="true" />
                        <span style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'rgba(255,255,255,0.4)'}}>Cierra en {timeLeft}</span>
                    </div>
                )}
                {timeLeft === 'CERRADO' && (
                    <div style={{marginTop:12,background:'rgba(230,57,70,0.2)',borderRadius:8,padding:'6px 12px',display:'inline-block'}}>
                        <span style={{fontFamily:"'Teko',sans-serif",fontSize:13,letterSpacing:2,color:'#e63946'}}>APUESTAS CERRADAS</span>
                    </div>
                )}
                <div style={{position:'absolute',top:16,right:16,textAlign:'right'}}>
                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:11,color:'rgba(255,255,255,0.3)',letterSpacing:2}}>HAN APOSTADO</p>
                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:22,fontWeight:700,color:'rgba(255,255,255,0.6)'}}>{participantes.length}</p>
                </div>
            </div>

            {/* Cuenta atrás de El Otro Equipo — apertura de temporada, o reanudación tras la pausa nocturna */}
            <CuentaAtrasElOtro />

            {/* Banner VIP */}
            {jornada.esVip && (
                <div style={{background:'rgba(255,215,0,0.1)',border:'1px solid rgba(255,215,0,0.3)',borderRadius:12,padding:12,marginBottom:16,textAlign:'center'}}>
                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:16,letterSpacing:3,color:G.golden,textTransform:'uppercase'}}>⭐ Jornada VIP — Puntos dobles en resultado y 1X2 · Cuesta 2€</p>
                </div>
            )}

            {/* Aviso: apuesta guardada pero jornada sin pagar todavía — con
                cuenta atrás del cierre para que sea urgente de verdad */}
            {guardado && !jornadaPagada && (
                <div style={{background:'rgba(230,57,70,0.08)',border:'1.5px solid rgba(230,57,70,0.35)',borderRadius:14,padding:'14px 16px',marginBottom:16}}>
                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:15,letterSpacing:1,color:'#e63946',fontWeight:700,marginBottom:4}}>
                        ⚠️ PAGA ANTES DE QUE CIERRE
                    </p>
                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,0,0,0.6)',lineHeight:1.6,marginBottom:4}}>
                        Tu apuesta ya está guardada, pero <strong>NO cuenta si no pagas por Bizum antes de que se cierre el plazo</strong> (5 minutos antes del partido). Pagar no bloquea que sigas cambiando tu resultado.
                    </p>
                    {timeLeft && timeLeft !== 'CERRADO' && (
                        <p style={{fontFamily:"'Teko',sans-serif",fontSize:20,fontWeight:700,color:'#e63946',marginBottom:8}}>
                            ⏱️ Cierre en {timeLeft}
                        </p>
                    )}
                    <button onClick={function(){ onIrAPagos(jornadaCodigo, jornada.esVip); }} style={{fontFamily:"'Teko',sans-serif",fontSize:13,letterSpacing:1,
                        background:'#e63946',color:'#fff',border:'none',borderRadius:20,padding:'8px 18px',cursor:'pointer'}}>
                        💳 Pagar ahora →
                    </button>
                </div>
            )}

            {/* Formulario de apuesta */}
            {!cerrado && (
                <div style={{background:'#fff',borderRadius:16,padding:20,border:'1px solid rgba(0,31,107,0.08)',marginBottom:16}}>
                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:13,letterSpacing:3,color:G.deepBlue,opacity:.5,textTransform:'uppercase',marginBottom:16}}>Tu apuesta</p>

                    {/* Marcador */}
                    <div style={{marginBottom:20}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                            <p style={{fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:2,color:G.deepBlue,textTransform:'uppercase',flex:1}}>Marcador exacto</p>
                            <span style={{fontFamily:"'Teko',sans-serif",fontSize:13,background:'rgba(0,31,107,0.08)',color:G.deepBlue,padding:'3px 10px',borderRadius:10}}>
                                {jornada.esVip ? '6 PTS' : '3 PTS'} + BOTE
                            </span>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:12,justifyContent:'center'}}>
                            <div style={{textAlign:'center'}}>
                                <img src={getLogoEquipo(jornada.equipoLocal, teamLogos)}
                                    alt={jornada.equipoLocal} style={{width:36,height:36,objectFit:'contain',marginBottom:4}}
                                    onError={function(e){e.target.style.display='none';}} />
                                <p style={{fontFamily:"'Inter',sans-serif",fontSize:9,color:G.deepBlue,opacity:.5,marginBottom:4}}>{jornada.equipoLocal.toUpperCase()}</p>
                                <input type="number" min="0" max="20" value={pronostico.golesLocal}
                                    onChange={function(e) { setPronostico(function(p) { return {...p, golesLocal: e.target.value}; }); setGuardado(false); }}
                                    style={{width:64,height:64,textAlign:'center',border:'2px solid rgba(0,31,107,0.2)',borderRadius:14,
                                        fontFamily:"'Teko',sans-serif",fontSize:32,fontWeight:700,color:G.deepBlue,background:'#f8f9ff'}} />
                            </div>
                            <span style={{fontFamily:"'Teko',sans-serif",fontSize:28,color:'rgba(0,31,107,0.3)'}}>—</span>
                            <div style={{textAlign:'center'}}>
                                <img src={getLogoEquipo(jornada.equipoVisitante, teamLogos)}
                                    alt={jornada.equipoVisitante} style={{width:36,height:36,objectFit:'contain',marginBottom:4}}
                                    onError={function(e){e.target.style.display='none';}} />
                                <p style={{fontFamily:"'Inter',sans-serif",fontSize:9,color:G.deepBlue,opacity:.5,marginBottom:4}}>{jornada.equipoVisitante.toUpperCase()}</p>
                                <input type="number" min="0" max="20" value={pronostico.golesVisitante}
                                    onChange={function(e) { setPronostico(function(p) { return {...p, golesVisitante: e.target.value}; }); setGuardado(false); }}
                                    style={{width:64,height:64,textAlign:'center',border:'2px solid rgba(0,31,107,0.2)',borderRadius:14,
                                        fontFamily:"'Teko',sans-serif",fontSize:32,fontWeight:700,color:G.deepBlue,background:'#f8f9ff'}} />
                            </div>
                        </div>
                    </div>

                    {/* 1X2 */}
                    <div style={{marginBottom:20}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                            <p style={{fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:2,color:G.deepBlue,textTransform:'uppercase',flex:1}}>1X2</p>
                            <span style={{fontFamily:"'Teko',sans-serif",fontSize:13,background:'rgba(0,31,107,0.08)',color:G.deepBlue,padding:'3px 10px',borderRadius:10}}>
                                {jornada.esVip ? '4 PTS' : '2 PTS'}
                            </span>
                        </div>
                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:G.deepBlue,opacity:.5,marginBottom:10}}>
                            Puedes elegir distinto al marcador — es tu estrategia
                        </p>
                        <div style={{display:'flex',gap:8}}>
                            {['Gana','Empata','Pierde'].map(function(op) {
                                var sel = pronostico.resultado1x2 === op;
                                return (
                                    <button key={op} onClick={function() { setPronostico(function(p) { return {...p, resultado1x2: op}; }); setGuardado(false); }}
                                        style={{flex:1,padding:'12px 0',borderRadius:12,border: sel ? 'none' : '1.5px solid rgba(0,31,107,0.15)',
                                            background: sel ? '#001F6B' : '#f8f8f8',
                                            fontFamily:"'Teko',sans-serif",fontSize:17,fontWeight:700,letterSpacing:1,
                                            color: sel ? '#FFD700' : 'rgba(0,31,107,0.4)',cursor:'pointer',textTransform:'uppercase'}}>
                                        {op}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* El Otro */}
                    {miElOtro && miElOtro.equipo && (function() {
                        var muestraEscudo = miElOtro.revelado || (miElOtro.activaciones || 0) >= 3;
                        var horaPartido = partidoOtro && partidoOtro.fecha ? new Date(partidoOtro.fecha).toLocaleString('es-ES', {weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit', timeZone:'Atlantic/Canary'}) : null;
                        return (
                        <div style={{marginBottom:20,background: elOtroActivado ? 'rgba(0,31,107,0.05)' : '#f8f8f8',
                            borderRadius:14,padding:16,border: elOtroActivado ? '1.5px solid #001F6B' : '1.5px solid rgba(0,31,107,0.1)'}}>
                            <div style={{display:'flex',alignItems:'center',gap:12}}>
                                {muestraEscudo ? (
                                    <img src={getLogoEquipo(miElOtro.equipo, teamLogos)} alt={miElOtro.equipo} style={{width:38,height:38,objectFit:'contain',flexShrink:0}}
                                        onError={function(e){e.target.style.display='none';}} />
                                ) : (
                                    <span style={{width:38,height:38,borderRadius:'50%',background:'rgba(0,31,107,0.08)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>👤</span>
                                )}
                                <div style={{flex:1}}>
                                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:2,color:G.deepBlue,textTransform:'uppercase',marginBottom:2}}>
                                        El Otro Equipo · {muestraEscudo ? miElOtro.equipo : 'Secreto'}
                                    </p>
                                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:G.deepBlue,opacity:.5}}>
                                        {elOtroActivado ? 'Activado — ×' + mult + ' si gana, ÷' + mult + ' si pierde' : 'Actívalo para multiplicar (o dividir) tus puntos de esta jornada'}
                                    </p>
                                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:10,color:G.deepBlue,opacity:.35,marginTop:2}}>
                                        Activaciones: {miElOtro.activaciones || 0} · Multiplicador actual: ×{mult}
                                    </p>
                                </div>
                                <button onClick={function() {
                                    if (!elOtroActivado && plazoActivacionSuperado) return; // no se puede activar si ya empezó su partido
                                    setElOtroActivado(function(v) { return !v; }); setGuardado(false);
                                }}
                                    disabled={!elOtroActivado && plazoActivacionSuperado}
                                    style={{width:50,height:28,borderRadius:14,border:'none',cursor: (!elOtroActivado && plazoActivacionSuperado) ? 'not-allowed' : 'pointer',transition:'all .2s',
                                        background: elOtroActivado ? '#001F6B' : 'rgba(0,31,107,0.15)',position:'relative',opacity:(!elOtroActivado && plazoActivacionSuperado)?0.4:1}}>
                                    <div style={{width:22,height:22,borderRadius:'50%',background:'#fff',position:'absolute',
                                        top:3, left: elOtroActivado ? 25 : 3,transition:'left .2s'}} />
                                </button>
                            </div>

                            {/* Info del partido real de su equipo esta jornada */}
                            {cargandoPartidoOtro && (
                                <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:G.deepBlue,opacity:.4,marginTop:10}}>Buscando su partido de Primera...</p>
                            )}
                            {!cargandoPartidoOtro && partidoOtro && (
                                <div style={{marginTop:10,paddingTop:10,borderTop:'1px solid rgba(0,31,107,0.08)',display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                                    <span style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:G.deepBlue,opacity:.6}}>
                                        {partidoOtro.esLocal ? 'Juega en casa vs' : 'Juega fuera vs'} <strong>{partidoOtro.rival}</strong>
                                    </span>
                                    {horaPartido && <span style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:G.deepBlue,opacity:.4}}>· {horaPartido}</span>}
                                </div>
                            )}
                            {!cargandoPartidoOtro && !partidoOtro && (
                                <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:G.deepBlue,opacity:.35,marginTop:10}}>No encontramos su próximo partido de Primera todavía.</p>
                            )}
                            {plazoActivacionSuperado && !elOtroActivado && (
                                <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:G.danger,marginTop:8}}>
                                    ⏰ Su partido ya ha empezado — no puedes activarlo esta jornada.
                                </p>
                            )}
                            {!plazoActivacionSuperado && !elOtroActivado && partidoOtro && partidoOtro.fecha && (function() {
                                var msHastaPartido = new Date(partidoOtro.fecha) - new Date();
                                var horasHastaPartido = msHastaPartido / 3600000;
                                if (horasHastaPartido > 0 && horasHastaPartido < 24) {
                                    var hh = Math.floor(horasHastaPartido);
                                    var mm = Math.floor((msHastaPartido % 3600000) / 60000);
                                    return (
                                        <div style={{marginTop:8,background:'rgba(230,57,70,0.08)',border:'1px solid rgba(230,57,70,0.25)',borderRadius:10,padding:'8px 12px'}}>
                                            <p style={{fontFamily:"'Teko',sans-serif",fontSize:13,color:'#e63946',fontWeight:700}}>
                                                ⚠️ ACTIVA TU COMODÍN ANTES DE QUE EMPIECE EL PARTIDO
                                            </p>
                                            <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'rgba(230,57,70,0.8)',lineHeight:1.5}}>
                                                Quedan <strong>{hh}h {mm}m</strong> para que empiece el partido de tu equipo de Primera. Si no activas El Otro Equipo antes, <strong>pierdes la oportunidad esta jornada</strong>.
                                            </p>
                                        </div>
                                    );
                                }
                                return null;
                            })()}
                        </div>
                        );
                    })()}

                    {/* Botón guardar */}
                    {mensaje && <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color: mensaje.startsWith('✅') ? '#10b981' : G.danger,marginBottom:12,textAlign:'center'}}>{mensaje}</p>}
                    <button onClick={guardar}
                        style={{width:'100%',fontFamily:"'Teko',sans-serif",fontSize:'1.1rem',letterSpacing:2,
                            background: guardado ? '#10b981' : G.deepBlue, color: guardado ? '#fff' : '#FFD700',
                            border:'none',borderRadius:30,padding:14,cursor:'pointer',textTransform:'uppercase'}}>
                        {guardado ? '✅ GUARDADO — Puedes modificar hasta el cierre' : 'GUARDAR MI APUESTA'}
                    </button>

                    {/* Estadísticas agregadas — sin nombres, para evitar repetir marcador.
                        Con pocas apuestas esto deja de ser anónimo de verdad (con 1 sola
                        apuesta, se ve exactamente lo que puso esa persona) — por eso no se
                        muestra nada hasta que haya un mínimo de 5 apuestas guardadas. */}
                    {(function() {
                        var stats = statsDistribucion();
                        if (stats.total < 5) return (
                            <div style={{marginTop:16,background:'rgba(0,31,107,0.03)',borderRadius:14,padding:16,border:'1px dashed rgba(0,31,107,0.15)',textAlign:'center'}}>
                                <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:G.deepBlue,opacity:.4}}>
                                    🔒 Las estadísticas de marcadores se desbloquean con 5 apuestas guardadas (van {stats.total}) — así nunca se puede intuir quién puso qué.
                                </p>
                            </div>
                        );
                        return (
                            <div style={{marginTop:16,background:'rgba(0,31,107,0.03)',borderRadius:14,padding:16,border:'1px dashed rgba(0,31,107,0.15)'}}>
                                <p style={{fontFamily:"'Teko',sans-serif",fontSize:12,letterSpacing:2,color:G.deepBlue,opacity:.55,textTransform:'uppercase',marginBottom:10}}>
                                    🔒 Lo que ha marcado la gente ({stats.total} apuestas) — sin nombres
                                </p>
                                <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:12}}>
                                    {stats.marcadoresOrdenados.map(function(m) {
                                        return (
                                            <span key={m.marcador} style={{fontFamily:"'Teko',sans-serif",fontSize:14,fontWeight:700,
                                                color:G.deepBlue,background:'rgba(0,31,107,0.07)',padding:'4px 10px',borderRadius:8,letterSpacing:1}}>
                                                {m.marcador} <span style={{opacity:.5,fontSize:11}}>×{m.cuenta}</span>
                                            </span>
                                        );
                                    })}
                                </div>
                                <div style={{display:'flex',gap:14,fontFamily:"'Inter',sans-serif",fontSize:11,color:G.deepBlue,opacity:.6}}>
                                    <span>Local: <strong>{stats.por1x2.Local}</strong></span>
                                    <span>Empate: <strong>{stats.por1x2.Empate}</strong></span>
                                    <span>Visitante: <strong>{stats.por1x2.Visitante}</strong></span>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* Vista de resultado si está cerrada */}
            {cerrado && guardado && (
                <div style={{background:'#fff',borderRadius:16,padding:20,border:'1px solid rgba(0,31,107,0.08)',marginBottom:16}}>
                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:13,letterSpacing:3,color:G.deepBlue,opacity:.5,textTransform:'uppercase',marginBottom:12}}>Tu apuesta</p>
                    <div style={{display:'flex',alignItems:'center',gap:12,justifyContent:'center',marginBottom:12}}>
                        <span style={{fontFamily:"'Teko',sans-serif",fontSize:36,fontWeight:700,color:G.deepBlue,letterSpacing:2}}>
                            {pronostico.golesLocal} — {pronostico.golesVisitante}
                        </span>
                    </div>
                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:G.deepBlue,opacity:.6,textAlign:'center'}}>
                        1X2: <strong>{pronostico.resultado1x2}</strong>
                        {elOtroActivado && miElOtro && ' · El Otro Equipo activado ×' + mult}
                    </p>
                </div>
            )}

            {cerrado && !guardado && (
                <div style={{background:'rgba(230,57,70,0.08)',borderRadius:16,padding:20,border:'1px solid rgba(230,57,70,0.2)',marginBottom:16,textAlign:'center'}}>
                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:16,letterSpacing:2,color:G.danger}}>NO APOSTASTE ESTA JORNADA</p>
                </div>
            )}

            {/* Resultado real si está finalizada */}
            {finalizada && (
                <div style={{background:'#001F6B',borderRadius:16,padding:20,marginBottom:16,textAlign:'center'}}>
                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:11,letterSpacing:4,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',marginBottom:8}}>Resultado final</p>
                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:40,fontWeight:700,color:'#FFD700',letterSpacing:3}}>
                        {jornada.resultadoLocal} — {jornada.resultadoVisitante}
                    </p>
                    {jornada.ganadores && jornada.ganadores.length > 0 && (
                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(255,255,255,0.5)',marginTop:8}}>
                            🏆 {jornada.ganadores.join(', ')}
                        </p>
                    )}
                </div>
            )}

            {/* Banner Porra Anual — PROMINENTE en J1-J5 */}
            {jornada.numeroJornada <= 5 && (
                <button onClick={function() { setShowPorraAnual(true); }}
                    style={{width:'100%',background:'linear-gradient(135deg,#001F6B,#0035b8)',
                        border:'none',borderRadius:18,padding:20,cursor:'pointer',
                        marginBottom:20,textAlign:'left',display:'flex',alignItems:'center',gap:16,
                        boxShadow:'0 8px 28px rgba(0,31,107,0.25)'}}>
                    <div style={{width:52,height:52,background:'rgba(255,215,0,0.15)',borderRadius:14,
                        display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,flexShrink:0}}>📅</div>
                    <div style={{flex:1}}>
                        <p style={{fontFamily:"'Teko',sans-serif",fontSize:20,fontWeight:700,color:'#FFD700',letterSpacing:2,textTransform:'uppercase',marginBottom:4}}>
                            PORRA ANUAL · J{jornada.numeroJornada}/5
                        </p>
                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(255,255,255,0.6)',lineHeight:1.5,margin:0}}>
                            ¿Ascenderá la UDLP? ¿En qué puesto quedará? Hasta <strong style={{color:'#FFD700'}}>20 pts</strong> extra
                        </p>
                    </div>
                    <span style={{fontFamily:"'Teko',sans-serif",fontSize:24,color:'rgba(255,215,0,0.5)'}}>→</span>
                </button>
            )}

            {showPorraAnual && <PorraAnualModal user={user} onClose={function() { setShowPorraAnual(false); }} />}
            {showEstrellas && <MisEstrellasModal user={user} plantilla={plantilla} onClose={function() { setShowEstrellas(false); }} jornada={jornada} />}

            {/* Botón flotante 5 Estrellas */}
            {jornada && !cerrado && (
                <button onClick={function() { setShowEstrellas(true); }}
                    style={{position:'fixed',bottom:24,right:20,width:60,height:60,borderRadius:'50%',
                        background:'linear-gradient(135deg,#001F6B,#0035b8)',border:'none',cursor:'pointer',
                        display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',
                        boxShadow:'0 6px 24px rgba(0,31,107,0.35)',zIndex:30,animation:'menuPulse 2s ease 3s 3'}}>
                    <span style={{fontSize:20,lineHeight:1}}>⭐</span>
                    <span style={{fontFamily:"'Teko',sans-serif",fontSize:10,letterSpacing:1,color:'rgba(255,255,255,0.7)',textTransform:'uppercase',marginTop:1}}>5</span>
                </button>
            )}
        </div>
    );
};

// ============================================================================
// --- TUTORIAL ÉPICO — Presentación nueva temporada 26/27 ---
// ============================================================================
const TutorialEpico = ({ user, plantilla, onClose }) => {
    var [slide, setSlide] = useState(0);
    var [saliendo, setSaliendo] = useState(false);
    var [escudoActivo, setEscudoActivo] = useState(0);
    var [jugadorActivo, setJugadorActivo] = useState(0);
    var [jugadoresElegidos, setJugadoresElegidos] = useState([]);
    var [multDemo, setMultDemo] = useState(0);
    var audioRef = { current: null };

    // Música épica de fondo — volumen bajo
    useEffect(function() {
        var audio = new Audio('/intro.mp3');
        audio.volume = 0.18;
        audio.loop = true;
        audio.play().catch(function() {}); // silencia el error si el navegador bloquea autoplay
        audioRef.current = audio;
        return function() {
            audio.pause();
            audio.currentTime = 0;
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    var EQUIPOS_PRIMERA = [
        "FC Barcelona","Real Madrid","Atlético de Madrid","Villarreal CF",
        "Real Betis","Celta de Vigo","Real Sociedad","Getafe CF",
        "Athletic Club","Sevilla FC","Rayo Vallecano","Deportivo Alavés",
        "RCD Espanyol","Valencia CF","Leganés","CA Osasuna",
        "Real Valladolid","Racing Santander","RC Deportivo","Málaga CF"
    ];

    var JUGADORES_TUTORIAL = (plantilla || []).filter(function(j) { return j.apiId > 0; }).slice(0,8);
    var TOTAL_SLIDES = 18;

    useEffect(function() {
        if (slide !== 11) return;
        var t = setInterval(function() { setEscudoActivo(function(v){return(v+1)%EQUIPOS_PRIMERA.length;}); }, 160);
        return function(){clearInterval(t);};
    }, [slide]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(function() {
        if (slide !== 9) return;
        var t = setInterval(function() { setJugadorActivo(function(v){return(v+1)%Math.max(1,JUGADORES_TUTORIAL.length);}); }, 700);
        return function(){clearInterval(t);};
    }, [slide]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(function() {
        if (slide !== 12) return;
        var t = setInterval(function() { setMultDemo(function(v){return(v+1)%3;}); }, 1800);
        return function(){clearInterval(t);};
    }, [slide]);

    var cerrar = function() {
        setSaliendo(true);
        setTimeout(function() {
            localStorage.setItem('tutorial_2627_'+user, '1');
            onClose();
        }, 400);
    };

    var siguiente = function() {
        if (slide < TOTAL_SLIDES-1) setSlide(function(v){return v+1;});
        else cerrar();
    };

    var toggleJugador = function(j) {
        var ya = jugadoresElegidos.find(function(x){return x.nombre===j.nombre;});
        if (ya) setJugadoresElegidos(jugadoresElegidos.filter(function(x){return x.nombre!==j.nombre;}));
        else if (jugadoresElegidos.length < 5) setJugadoresElegidos([...jugadoresElegidos, j]);
    };

    // ── ESTILOS PIZARRA TÁCTICA ──────────────────────────────────────────────
    var fondos = Array(TOTAL_SLIDES).fill('#fafaf8');

    // SVG del campo de fútbol como fondo del tutorial
    var CampoSVG = (
        <svg style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:0}}
            viewBox="0 0 400 700" fill="none" preserveAspectRatio="xMidYMid slice">
            <rect x="38" y="58" width="324" height="584" stroke="#001F6B" strokeWidth="0.9" opacity="0.04" rx="2"/>
            <line x1="38" y1="350" x2="362" y2="350" stroke="#001F6B" strokeWidth="0.7" opacity="0.04"/>
            <circle cx="200" cy="350" r="52" stroke="#001F6B" strokeWidth="0.7" opacity="0.04"/>
            <circle cx="200" cy="350" r="2.5" fill="#FFD700" opacity="0.2"/>
            <rect x="108" y="58" width="184" height="100" stroke="#001F6B" strokeWidth="0.7" opacity="0.04"/>
            <rect x="148" y="58" width="104" height="54" stroke="#001F6B" strokeWidth="0.5" opacity="0.03"/>
            <rect x="108" y="542" width="184" height="100" stroke="#001F6B" strokeWidth="0.7" opacity="0.04"/>
            <rect x="148" y="588" width="104" height="54" stroke="#001F6B" strokeWidth="0.5" opacity="0.03"/>
            <path d="M138 158 Q200 184 262 158" stroke="#001F6B" strokeWidth="0.5" opacity="0.03"/>
            <path d="M138 542 Q200 516 262 542" stroke="#001F6B" strokeWidth="0.5" opacity="0.03"/>
            <circle cx="200" cy="118" r="2" fill="#001F6B" opacity="0.05"/>
            <circle cx="200" cy="582" r="2" fill="#001F6B" opacity="0.05"/>
        </svg>
    );

    var S = {
        eyebrow: {fontFamily:"'Inter',sans-serif",fontSize:10,letterSpacing:6,color:'rgba(0,31,107,0.4)',textTransform:'uppercase',marginBottom:8,textAlign:'center'},
        titulo: {fontFamily:"'Bebas Neue',sans-serif",fontWeight:400,color:'#001F6B',letterSpacing:3,lineHeight:1,textAlign:'center',marginBottom:16,fontSize:'clamp(2.6rem,11vw,3.8rem)'},
        tituloMega: {fontFamily:"'Bebas Neue',sans-serif",fontWeight:400,color:'#001F6B',letterSpacing:3,lineHeight:1,textAlign:'center',marginBottom:16,fontSize:'clamp(3.2rem,13vw,5rem)'},
        cuerpo: {fontFamily:"'Inter',sans-serif",fontSize:'clamp(13px,3.5vw,15px)',color:'rgba(0,0,0,0.55)',lineHeight:1.8,textAlign:'center',maxWidth:340,margin:'0 auto 18px'},
        sep: {width:'100%',maxWidth:160,height:1,margin:'12px auto',background:'linear-gradient(90deg,transparent,rgba(0,31,107,0.12),transparent)'},
        sepDot: {display:'flex',alignItems:'center',gap:10,justifyContent:'center',margin:'12px 0'},
        card: {background:'rgba(255,255,255,0.9)',border:'1px solid rgba(0,31,107,0.1)',borderRadius:14,padding:'13px 14px'},
        cardAzul: {background:'rgba(0,31,107,0.03)',border:'1px solid rgba(0,31,107,0.12)',borderRadius:14,padding:'13px 14px'},
        cardDorado: {background:'rgba(255,215,0,0.06)',border:'1px solid rgba(255,215,0,0.35)',borderRadius:14,padding:'13px 14px'},
        infoBox: {background:'rgba(0,31,107,0.04)',border:'1px solid rgba(0,31,107,0.1)',borderRadius:14,padding:'13px 16px',width:'100%',maxWidth:360},
        badge: {display:'inline-flex',alignItems:'center',gap:6,background:'rgba(255,215,0,0.12)',border:'1.5px solid rgba(255,215,0,0.45)',borderRadius:20,padding:'4px 14px',marginBottom:10},
        ptoRow: {display:'flex',alignItems:'center',gap:10,background:'rgba(255,255,255,0.9)',border:'1px solid rgba(0,31,107,0.08)',borderRadius:10,padding:'10px 14px',width:'100%',maxWidth:360},
        statRow: {display:'flex',width:'100%',maxWidth:360,border:'1px solid rgba(0,31,107,0.08)',borderRadius:14,overflow:'hidden',background:'rgba(255,255,255,0.85)'},
        iconBig: {fontSize:'clamp(56px,13vw,72px)',display:'block',marginBottom:16,animation:'floatIcon 3s ease-in-out infinite',textAlign:'center'},
    };

    var renderSlide = function() {
        switch(slide) {

        case 0: return (
            <div style={{textAlign:'center'}}>
                <img src="/escudo.png" alt="UDLP"
                    style={{width:80,height:96,objectFit:'contain',marginBottom:20,
                        filter:'drop-shadow(0 4px 18px rgba(0,31,107,0.18))',
                        animation:'floatIcon 3s ease-in-out infinite'}}
                    onError={function(e){e.target.style.display='none';}} />
                <div style={S.eyebrow}>Temporada 26/27</div>
                <h1 style={S.tituloMega}>BIENVENIDO{user?<>,<br/>{user.toUpperCase()}</>:''}</h1>
                <div style={S.sepDot}><div style={{flex:1,maxWidth:80,height:1,background:'linear-gradient(90deg,transparent,rgba(0,31,107,0.1))'}}/>
                <div style={{width:4,height:4,borderRadius:'50%',background:'#FFD700'}}/><div style={{flex:1,maxWidth:80,height:1,background:'linear-gradient(90deg,rgba(0,31,107,0.1),transparent)'}}/></div>
                <p style={S.cuerpo}>La porra más épica de la familia arranca una nueva temporada. Nuevas reglas, misma pasión por los colores.</p>
                <div style={{...S.badge}}><span style={{fontFamily:"'Teko',sans-serif",fontSize:11,letterSpacing:4,color:'#001F6B',textTransform:'uppercase'}}>Desliza para descubrir las novedades</span></div>
            </div>
        );

        case 1: return (
            <div style={{textAlign:'center'}}>
                <span style={S.iconBig}>🏟️</span>
                <div style={S.eyebrow}>UD Las Palmas · 2º año en Segunda</div>
                <h1 style={S.titulo}>EL AÑO<br/>DEL ASCENSO</h1>
                <p style={S.cuerpo}>El año pasado estuvimos <strong style={{color:'#001F6B'}}>a un paso del ascenso</strong>. El playoff nos dejó a las puertas. Esta temporada la UDLP va a por todas — y ustedes estarán en cada partido.</p>
                <div style={S.statRow}>
                    {[['42','Jornadas'],['15 AGO','Primer partido'],['20','Jugadores']].map(function(s,i){return(
                        <div key={i} style={{flex:1,padding:'14px 8px',textAlign:'center',borderRight:i<2?'1px solid rgba(0,31,107,0.06)':'none'}}>
                            <p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,color:'#001F6B',letterSpacing:1}}>{s[0]}</p>
                            <p style={{fontFamily:"'Inter',sans-serif",fontSize:9,color:'rgba(0,0,0,0.35)',letterSpacing:2,textTransform:'uppercase',marginTop:2}}>{s[1]}</p>
                        </div>
                    );})}
                </div>
            </div>
        );

        case 2: return (
            <div style={{textAlign:'center'}}>
                <span style={S.iconBig}>⚽</span>
                <div style={S.eyebrow}>El juego central de siempre</div>
                <h1 style={S.titulo}>LA PORRA</h1>
                <p style={S.cuerpo}>Cada semana, antes del partido de la UDLP, haces tu apuesta. Adivinas el <strong style={{color:'#001F6B'}}>marcador exacto</strong> y, si aciertas, te llevas el <strong style={{color:'#001F6B'}}>bote acumulado</strong>.</p>
                <div style={{display:'flex',gap:10,width:'100%',maxWidth:360}}>
                    <div style={{...S.cardDorado,flex:1,textAlign:'center'}}>
                        <div style={{fontSize:24,marginBottom:6}}>🎯</div>
                        <p style={{fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:2,color:'#001F6B',textTransform:'uppercase',marginBottom:3}}>Exacto</p>
                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'rgba(0,0,0,0.45)',lineHeight:1.5}}>Ganas el bote</p>
                    </div>
                    <div style={{...S.card,flex:1,textAlign:'center'}}>
                        <div style={{fontSize:24,marginBottom:6}}>💰</div>
                        <p style={{fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:2,color:'rgba(0,31,107,0.5)',textTransform:'uppercase',marginBottom:3}}>Nadie acierta</p>
                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'rgba(0,0,0,0.35)',lineHeight:1.5}}>El bote crece</p>
                    </div>
                </div>
            </div>
        );

        case 3: return (
            <div style={{textAlign:'center'}}>
                <div style={S.eyebrow}>Tu apuesta semanal</div>
                <h1 style={S.titulo}>¿CÓMO SE<br/>APUESTA?</h1>
                <p style={{...S.cuerpo,fontSize:13}}>Rellenas el marcador y el 1X2 por separado. Pueden contradecirse — eso es estrategia.</p>
                <div style={{display:'flex',flexDirection:'column',gap:9,width:'100%',maxWidth:360}}>
                    <div style={{...S.cardAzul,display:'flex',alignItems:'center',gap:14,padding:'14px 16px',textAlign:'left'}}>
                        <span style={{fontSize:28,flexShrink:0}}>⚽</span>
                        <div><p style={{fontFamily:"'Teko',sans-serif",fontSize:18,letterSpacing:1,color:'#001F6B',marginBottom:2}}>Marcador exacto</p><p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'rgba(0,0,0,0.45)',lineHeight:1.5}}>Eliges el resultado: 2-1, 0-0, 3-0...</p></div>
                    </div>
                    <div style={{...S.card,display:'flex',alignItems:'center',gap:14,padding:'14px 16px',textAlign:'left'}}>
                        <span style={{fontSize:28,flexShrink:0}}>1️⃣</span>
                        <div><p style={{fontFamily:"'Teko',sans-serif",fontSize:18,letterSpacing:1,color:'#001F6B',marginBottom:2}}>1X2 — Independiente</p><p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'rgba(0,0,0,0.45)',lineHeight:1.5}}>¿Gana, empata o pierde? Tu estrategia.</p></div>
                    </div>
                </div>
            </div>
        );

        case 4: return (
            <div style={{textAlign:'center'}}>
                <div style={S.eyebrow}>¿Cuánto vale acertar?</div>
                <h1 style={S.titulo}>RESULTADO<br/>Y 1X2</h1>
                <div style={{display:'flex',flexDirection:'column',gap:7,width:'100%',maxWidth:360,marginBottom:14}}>
                    <div style={S.ptoRow}><span style={{flex:1,fontFamily:"'Inter',sans-serif",fontSize:13,color:'rgba(0,0,0,0.6)'}}>⚽ Resultado exacto</span><span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,color:'#001F6B',minWidth:40,textAlign:'right'}}>3</span><span style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'rgba(0,31,107,0.35)',minWidth:48,textAlign:'right'}}>6 VIP</span></div>
                    <div style={S.ptoRow}><span style={{flex:1,fontFamily:"'Inter',sans-serif",fontSize:13,color:'rgba(0,0,0,0.6)'}}>1️⃣ 1X2 acertado</span><span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,color:'#001F6B',minWidth:40,textAlign:'right'}}>2</span><span style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'rgba(0,31,107,0.35)',minWidth:48,textAlign:'right'}}>4 VIP</span></div>
                </div>
                <div style={S.infoBox}><p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,31,107,0.7)',lineHeight:1.7,textAlign:'center'}}>🏆 Las jornadas <strong>VIP</strong> doblan los puntos y cuestan <strong>2€</strong>.<br/>El bote solo lo gana quien acierta el <strong>marcador exacto</strong>.</p></div>
            </div>
        );

        case 5: return (
            <div style={{textAlign:'center'}}>
                <span style={S.iconBig}>📋</span>
                <div style={S.eyebrow}>Las reglas del juego</div>
                <h1 style={S.titulo}>NORMAS<br/>BÁSICAS</h1>
                <div style={{display:'flex',flexDirection:'column',gap:8,width:'100%',maxWidth:360}}>
                    {[['⏰','Plazo de apuesta','Hasta 5 minutos antes del partido — hora canaria'],
                      ['🔒','Apuestas secretas','Nadie ve el pronóstico hasta que cierra la jornada'],
                      ['💸','Coste','1€ jornada normal · 2€ jornada VIP'],
                      ['🏆','Porra Anual','¿Asciende la UDLP? ¿En qué puesto? Hasta 20 pts extra (J1-J5)'],
                    ].map(function(r,i){return(
                        <div key={i} style={{...S.card,display:'flex',alignItems:'flex-start',gap:12,padding:'11px 14px',textAlign:'left'}}>
                            <span style={{fontSize:18,flexShrink:0}}>{r[0]}</span>
                            <div><p style={{fontFamily:"'Teko',sans-serif",fontSize:16,letterSpacing:1,color:'#001F6B',marginBottom:2}}>{r[1]}</p><p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'rgba(0,0,0,0.45)',lineHeight:1.5}}>{r[2]}</p></div>
                        </div>
                    );})}
                </div>
            </div>
        );

        case 6: return (
            <div style={{textAlign:'center'}}>
                <span style={S.iconBig}>📊</span>
                <div style={S.eyebrow}>A lo largo de la temporada</div>
                <h1 style={S.titulo}>LA CLASIFICACIÓN<br/>GENERAL</h1>
                <p style={S.cuerpo}>Todos los puntos — resultado, 1X2, estrellas y multiplicador — se acumulan durante las 42 jornadas. Al final, el que más puntos tenga, <strong style={{color:'#001F6B'}}>gana</strong>.</p>
                <div style={S.statRow}>
                    {[['10','pts máx/jornada'],['42','jornadas'],['+ 20','porra anual']].map(function(s,i){return(
                        <div key={i} style={{flex:1,padding:'14px 8px',textAlign:'center',borderRight:i<2?'1px solid rgba(0,31,107,0.06)':'none'}}>
                            <p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,color:'#001F6B',letterSpacing:1}}>{s[0]}</p>
                            <p style={{fontFamily:"'Inter',sans-serif",fontSize:9,color:'rgba(0,0,0,0.35)',letterSpacing:2,textTransform:'uppercase',marginTop:2}}>{s[1]}</p>
                        </div>
                    );})}
                </div>
            </div>
        );

        case 7: return (
            <div style={{textAlign:'center'}}>
                <span style={S.iconBig}>⭐</span>
                <div style={{...S.badge}}><span style={{fontFamily:"'Teko',sans-serif",fontSize:11,letterSpacing:4,color:'#001F6B',textTransform:'uppercase'}}>⚡ NOVEDAD 26/27 ⚡</span></div>
                <h1 style={S.titulo}>MIS 5<br/>ESTRELLAS</h1>
                <p style={S.cuerpo}>Antes de cada partido, eliges hasta <strong style={{color:'#001F6B'}}>5 jugadores de la UDLP</strong>. La API registra sus actuaciones en tiempo real — goles, asistencias, paradas, tarjetas — y cada acción genera <strong style={{color:'#001F6B'}}>estrellas ⭐</strong>.</p>
                <div style={{display:'flex',flexDirection:'column',gap:8,width:'100%',maxWidth:360}}>
                    <div style={{...S.cardDorado,padding:'12px 14px'}}>
                        <p style={{fontFamily:"'Teko',sans-serif",fontSize:13,letterSpacing:2,color:'#001F6B',textTransform:'uppercase',marginBottom:6}}>Clasificación de jornada → puntos</p>
                        <div style={{display:'flex',gap:6,justifyContent:'center'}}>
                            {[['🥇','5 pts'],['🥈','4 pts'],['🥉','3 pts'],['4º','2 pts'],['5º','1 pt']].map(function(r,i){return(
                                <div key={i} style={{textAlign:'center',flex:1}}>
                                    <p style={{fontSize:16,marginBottom:2}}>{r[0]}</p>
                                    <p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,color:'#001F6B'}}>{r[1]}</p>
                                </div>
                            );})}
                        </div>
                    </div>
                    <div style={{...S.card,padding:'12px 14px',textAlign:'left'}}>
                        <p style={{fontFamily:"'Teko',sans-serif",fontSize:13,letterSpacing:2,color:'#001F6B',textTransform:'uppercase',marginBottom:4}}>Dos ligas en paralelo</p>
                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,0,0,0.55)',lineHeight:1.6}}>
                            📊 <strong style={{color:'#001F6B'}}>Clasificación general</strong> — los puntos (5,4,3,2,1) de estrellas suman al total de la liga normal.<br/>
                            ⭐ <strong style={{color:'#001F6B'}}>Liga de estrellas</strong> — las estrellas acumuladas forman una clasificación propia con premios al final de temporada.
                        </p>
                    </div>
                </div>
            </div>
        );

        case 8: return (
            <div style={{textAlign:'center'}}>
                <div style={S.eyebrow}>Tabla completa de estrellas por acción</div>
                <h1 style={S.titulo}>¿QUÉ ACCIONES<br/>DAN ESTRELLAS?</h1>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,width:'100%',maxWidth:360,marginBottom:12}}>
                    {[
                        ['⚽ Gol portero/defensa','+8⭐',false],
                        ['⚽ Gol centrocampista','+6⭐',false],
                        ['⚽ Gol delantero','+5⭐',false],
                        ['🧤 Parada penalti','+5⭐',false],
                        ['🅰️ Asistencia','+3⭐',false],
                        ['🧤 Portería a 0 (portero)','+4⭐',false],
                        ['🧤 Portería a 0 (defensa)','+2⭐',false],
                        ['👟 Titular (+60 min)','+2⭐',false],
                        ['🧤 Parada genérica','+1⭐',false],
                        ['👟 Suplente (entra)','+1⭐',false],
                        ['🟨 Tarjeta amarilla','-1⭐',true],
                        ['❌ Penalti fallado','-2⭐',true],
                        ['🟥 Tarjeta roja','-3⭐',true],
                    ].map(function(r,i){return(
                        <div key={i} style={{...S.card,display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 10px'}}>
                            <span style={{fontFamily:"'Inter',sans-serif",fontSize:10,color:'rgba(0,0,0,0.5)'}}>{r[0]}</span>
                            <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:17,color:r[2]?'#b91c1c':'#001F6B',flexShrink:0,marginLeft:4}}>{r[1]}</span>
                        </div>
                    );})}
                </div>
                <div style={S.infoBox}><p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,31,107,0.7)',textAlign:'center',lineHeight:1.6}}>
                    Un portero con portería a 0 + parada de penalti + 3 paradas normales suma <strong>+12⭐</strong>.<br/>
                    Los puntos se calculan automáticamente tras cada partido con estadísticas oficiales.<br/>
                    La clave: elige jugadores <strong>activos con balón</strong>, no solo atacantes.
                </p></div>
            </div>
        );

        case 9: return (
            <div style={{textAlign:'center'}}>
                <div style={S.eyebrow}>Así se juega cada semana</div>
                <h1 style={S.titulo}>ELIGE TUS<br/>5 ESTRELLAS</h1>
                <p style={{...S.cuerpo,fontSize:13,marginBottom:14}}>Seleccionas hasta 5 jugadores antes del partido. Sus acciones reales generan ⭐. Al final del partido, las estrellas se convierten en puntos según el ranking de la jornada.</p>
                {/* Animación estrellas → puntos */}
                <div style={{display:'flex',alignItems:'center',gap:8,justifyContent:'center',marginBottom:14,width:'100%',maxWidth:360}}>
                    <div style={{...S.cardDorado,flex:1,textAlign:'center',padding:'10px 8px'}}>
                        <p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:'#001F6B',marginBottom:2}}>⭐⭐⭐</p>
                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:10,color:'rgba(0,0,0,0.45)'}}>Tus jugadores acumulan estrellas</p>
                    </div>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:'rgba(0,31,107,0.3)',flexShrink:0}}>→</div>
                    <div style={{...S.card,flex:1,textAlign:'center',padding:'10px 8px',border:'1.5px solid rgba(0,31,107,0.2)'}}>
                        <p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:'#001F6B',marginBottom:2}}>5 PTS</p>
                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:10,color:'rgba(0,0,0,0.45)'}}>Si eres el mejor de la jornada</p>
                    </div>
                </div>
                <div style={{display:'flex',flexWrap:'wrap',gap:12,justifyContent:'center',maxWidth:340,margin:'0 auto 14px'}}>
                    {JUGADORES_TUTORIAL.map(function(j,i){
                        var sel = !!jugadoresElegidos.find(function(x){return x.nombre===j.nombre;});
                        var dest = i===jugadorActivo;
                        return(
                            <div key={j.nombre} onClick={function(){toggleJugador(j);}}
                                style={{display:'flex',flexDirection:'column',alignItems:'center',gap:5,cursor:'pointer',
                                    transition:'all .3s ease',
                                    transform:dest?'scale(1.18) translateY(-4px)':sel?'scale(1.05)':'scale(1)',
                                    opacity:dest||sel?1:0.5}}>
                                <div style={{width:52,height:52,borderRadius:'50%',overflow:'hidden',
                                    border:sel?'2px solid #001F6B':dest?'1.5px solid rgba(0,31,107,0.4)':'1.5px solid rgba(0,31,107,0.12)',
                                    background:'rgba(0,31,107,0.04)',transition:'all .3s ease',
                                    display:'flex',alignItems:'center',justifyContent:'center',
                                    fontFamily:"'Bebas Neue',sans-serif",fontSize:16,color:'rgba(0,31,107,0.4)'}}>
                                    <img src={getFotoJugador(j)} alt={j.nombre} style={{width:'100%',height:'100%',objectFit:'cover'}}
                                        onError={function(e){e.target.outerHTML='<span style="font-family:\'Bebas Neue\',sans-serif;font-size:16px;color:rgba(0,31,107,0.4)">'+j.dorsal+'</span>';}} />
                                </div>
                                <p style={{fontFamily:"'Inter',sans-serif",fontSize:9,color:sel?'#001F6B':dest?'rgba(0,31,107,0.6)':'rgba(0,0,0,0.3)',maxWidth:56,textAlign:'center',lineHeight:1.2,fontWeight:sel?600:400}}>
                                    {j.nombre.split(' ')[0]}
                                </p>
                                {sel && <span style={{fontSize:10}}>⭐</span>}
                            </div>
                        );
                    })}
                </div>
                <div style={{display:'flex',gap:7,justifyContent:'center'}}>
                    {[['1º','5 pts'],['2º','4 pts'],['3º','3 pts'],['4º','2 pts'],['5º','1 pt']].map(function(r,i){return(
                        <div key={i} style={{...S.cardDorado,textAlign:'center',padding:'7px 7px',minWidth:48}}>
                            <p style={{fontFamily:"'Teko',sans-serif",fontSize:11,color:'rgba(0,31,107,0.5)'}}>{r[0]}</p>
                            <p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:'#001F6B'}}>{r[1]}</p>
                        </div>
                    );})}
                </div>
                <p style={{fontFamily:"'Inter',sans-serif",fontSize:10,color:'rgba(0,0,0,0.2)',marginTop:10}}>Toca los jugadores · {jugadoresElegidos.length}/5</p>
            </div>
        );

        case 10: return (
            <div style={{textAlign:'center'}}>
                <div style={{width:76,height:76,borderRadius:'50%',border:'1.5px solid rgba(0,31,107,0.15)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px',animation:'floatIcon 3s ease-in-out infinite',fontSize:36,background:'rgba(0,31,107,0.03)'}}>🛡️</div>
                <div style={{...S.badge}}><span style={{fontFamily:"'Teko',sans-serif",fontSize:11,letterSpacing:4,color:'#001F6B',textTransform:'uppercase'}}>🆕 GRAN NOVEDAD 26/27 🆕</span></div>
                <h1 style={S.titulo}>EL OTRO<br/>EQUIPO</h1>
                <p style={S.cuerpo}>Cada jugador tiene asignado <strong style={{color:'#001F6B'}}>un equipo de Primera División</strong> para toda la temporada. Cada jornada decides si activarlo — puede <strong style={{color:'#001F6B'}}>multiplicar tus puntos</strong> o reducirlos a la mitad.</p>
                <div style={{display:'flex',gap:10,width:'100%',maxWidth:360}}>
                    {[['Gana','×2-3','#15803d'],['Empata','×1','rgba(0,0,0,0.3)'],['Pierde','÷2','#b91c1c']].map(function(r,i){return(
                        <div key={i} style={{...S.card,flex:1,textAlign:'center',padding:'12px 8px'}}>
                            <p style={{fontFamily:"'Inter',sans-serif",fontSize:9,color:'rgba(0,0,0,0.4)',marginBottom:6,letterSpacing:1}}>{r[0]}</p>
                            <p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:r[2],letterSpacing:1}}>{r[1]}</p>
                        </div>
                    );})}
                </div>
            </div>
        );

        case 11: return (
            <div style={{textAlign:'center'}}>
                <div style={S.eyebrow}>Primera División 26/27</div>
                <h1 style={S.titulo}>20 EQUIPOS<br/>20 JUGADORES</h1>
                <p style={{...S.cuerpo,fontSize:13,marginBottom:14}}>Uno por jugador. El orden de elección sigue la clasificación del año pasado. Pedrito elige primero.</p>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:5,width:'100%',maxWidth:360,margin:'0 auto 14px'}}>
                    {EQUIPOS_PRIMERA.map(function(eq,i){
                        var activo = i===escudoActivo;
                        return(
                            <div key={eq} style={{background:activo?'rgba(0,31,107,0.06)':'rgba(255,255,255,0.85)',
                                border:activo?'1px solid rgba(0,31,107,0.3)':'1px solid rgba(0,31,107,0.07)',
                                borderRadius:8,padding:'7px 4px',textAlign:'center',
                                transition:'all .18s ease',transform:activo?'scale(1.09)':'scale(1)'}}>
                                <p style={{fontFamily:"'Teko',sans-serif",fontSize:9,color:activo?'#001F6B':'rgba(0,0,0,0.35)',letterSpacing:0.5,lineHeight:1.2}}>
                                    {eq.replace(/FC |CD |SD |CF |RCD |RC |CA |UD /g,'').split(' ')[0]}
                                </p>
                            </div>
                        );
                    })}
                </div>
                <div style={S.infoBox}><p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,31,107,0.7)',textAlign:'center',lineHeight:1.7}}>
                    📅 Plazo: <strong>hoy 00:00</strong> → <strong>14 ago 18:00</strong> (hora canaria)<br/>
                    ⏱️ 60 min por turno — si no eliges, pasas al final<br/>
                    <span style={{color:'rgba(0,0,0,0.35)',fontSize:11}}>🪑 Si no vas a jugar de verdad... alguien más merece esa silla</span>
                </p></div>
            </div>
        );

        case 12: return (
            <div style={{textAlign:'center'}}>
                <span style={S.iconBig}>⚡</span>
                <div style={S.eyebrow}>Cuanto más lo usas, más potente</div>
                <h1 style={S.titulo}>EL<br/>MULTIPLICADOR</h1>
                <p style={{...S.cuerpo,fontSize:13}}>Empieza en ×2 y puede llegar a ×3 si lo activas con constancia durante la temporada.</p>
                <div style={{display:'flex',gap:10,width:'100%',maxWidth:360,marginBottom:14}}>
                    {[['1ª-2ª\nactivación','×2',0],['3ª-4ª\nactivación','×2.5',1],['5ª+\nactivación','×3',2]].map(function(r,i){
                        var hl = multDemo===i;
                        return(
                            <div key={i} style={{flex:1,background:hl?'rgba(0,31,107,0.05)':'rgba(255,255,255,0.85)',
                                border:hl?'1.5px solid #001F6B':'1px solid rgba(0,31,107,0.1)',
                                borderRadius:14,padding:'14px 8px',textAlign:'center',
                                transition:'all .4s ease',transform:hl?'scale(1.04)':'scale(1)'}}>
                                <p style={{fontFamily:"'Inter',sans-serif",fontSize:10,color:'rgba(0,0,0,0.4)',marginBottom:8,lineHeight:1.4}}>{r[0]}</p>
                                <p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:32,color:hl?'#001F6B':'rgba(0,31,107,0.25)',letterSpacing:1,transition:'color .4s'}}>{r[1]}</p>
                            </div>
                        );
                    })}
                </div>
                <div style={S.infoBox}><p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,31,107,0.7)',textAlign:'center',lineHeight:1.6}}>
                    🤫 Tu equipo es <strong>secreto</strong> mientras lo usas — a partir de tu <strong>3ª activación</strong> (cuando llegas a ×2.5) se hace público para todos, automáticamente.<br/>
                    📐 Redondeo: al <strong>multiplicar</strong> siempre hacia <strong>arriba</strong>; al <strong>dividir</strong> siempre hacia <strong>abajo</strong>.
                </p></div>
            </div>
        );

        case 13: return (
            <div style={{textAlign:'center'}}>
                <span style={S.iconBig}>🍎</span>
                <div style={S.eyebrow}>Explicado facilito</div>
                <h1 style={S.titulo}>ES UN<br/>COMODÍN</h1>
                <p style={{...S.cuerpo,fontSize:13,marginBottom:12}}>
                    Piénsalo así: tienes un equipo alternativo, tu comodín de toda la temporada. Cada semana decides si lo usas o no — nunca es obligatorio.
                </p>
                <p style={{...S.cuerpo,fontSize:13,marginBottom:12}}>
                    Si lo activas <strong>antes de que empiece el partido de Primera de tu equipo</strong>, lo que haga ese equipo afecta a tus puntos de la jornada:
                </p>
                <div style={{display:'flex',flexDirection:'column',gap:8,width:'100%',maxWidth:340,marginBottom:14,textAlign:'left'}}>
                    <div style={{...S.card,padding:'10px 14px',display:'flex',alignItems:'center',gap:10}}>
                        <span style={{fontSize:18}}>🟰</span>
                        <span style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,0,0,0.6)'}}>Empata → tus puntos <strong>no cambian</strong></span>
                    </div>
                    <div style={{...S.card,padding:'10px 14px',display:'flex',alignItems:'center',gap:10}}>
                        <span style={{fontSize:18}}>📈</span>
                        <span style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,0,0,0.6)'}}>Gana → tus puntos se <strong>multiplican</strong> (×2, ×2.5 o ×3)</span>
                    </div>
                    <div style={{...S.card,padding:'10px 14px',display:'flex',alignItems:'center',gap:10}}>
                        <span style={{fontSize:18}}>📉</span>
                        <span style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,0,0,0.6)'}}>Pierde → tus puntos se <strong>dividen</strong> (÷2, ÷2.5 o ÷3)</span>
                    </div>
                </div>
                <div style={S.infoBox}><p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,31,107,0.7)',textAlign:'center',lineHeight:1.7}}>
                    🧮 <strong>Caso práctico:</strong> sacaste 6 puntos esa jornada entre porra y Estrellas. Activas tu comodín y tu equipo gana. Llevas 3 activaciones → multiplicador ×2.5.<br/>
                    <strong>6 × 2.5 = 15 → redondeo al alza → 15 puntos.</strong><br/>
                    Si en cambio hubiera perdido: 6 ÷ 2.5 = 2.4 → redondeo a la baja → <strong>2 puntos.</strong><br/><br/>
                    Con todos los factores a favor (buena jornada + estrellas + comodín en racha) puedes llegar a sumar entre <strong>2 y 30 puntos</strong> en una sola jornada.
                </p></div>
            </div>
        );

        case 14: return (
            <div style={{textAlign:'center'}}>
                <div style={S.eyebrow}>Todo junto</div>
                <h1 style={S.titulo}>RESUMEN<br/>DE PUNTOS</h1>
                <div style={{display:'flex',flexDirection:'column',gap:7,width:'100%',maxWidth:360}}>
                    {[['⚽','Resultado exacto','3','6 VIP'],['1️⃣','1X2 acertado','2','4 VIP'],['⭐','1º en Estrellas','5','5 VIP'],['⭐','2º / 3º / 4º / 5º','4-1','igual'],['🛡️','El Otro Equipo gana','×2-3','todo'],['🛡️','El Otro Equipo pierde','÷2','todo'],['📅','Porra Anual (J1-J5)','+20','una vez']].map(function(r,i){return(
                        <div key={i} style={S.ptoRow}>
                            <span style={{fontSize:14,flexShrink:0}}>{r[0]}</span>
                            <span style={{flex:1,fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,0,0,0.6)'}}>{r[1]}</span>
                            <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:'#001F6B',minWidth:40,textAlign:'right'}}>{r[2]}</span>
                            <span style={{fontFamily:"'Inter',sans-serif",fontSize:10,color:'rgba(0,31,107,0.35)',minWidth:44,textAlign:'right'}}>{r[3]}</span>
                        </div>
                    );})}
                </div>
            </div>
        );

        case 15: return (
            <div style={{textAlign:'center'}}>
                <span style={S.iconBig}>💳</span>
                <div style={S.eyebrow}>Antes de empezar</div>
                <h1 style={S.titulo}>INSCRIPCIÓN<br/>5€</h1>
                <p style={S.cuerpo}>Un único pago para toda la temporada — 42 jornadas. <strong style={{color:'#001F6B'}}>Sin pago confirmado, no hay acceso a las apuestas ni a El Otro Equipo.</strong></p>
                <div style={{display:'flex',flexDirection:'column',gap:8,width:'100%',maxWidth:360,marginBottom:14}}>
                    <div style={{...S.cardDorado,display:'flex',alignItems:'center',gap:12,padding:'14px 16px',textAlign:'left'}}>
                        <span style={{fontSize:22,flexShrink:0}}>📲</span>
                        <div style={{flex:1}}>
                            <p style={{fontFamily:"'Teko',sans-serif",fontSize:16,letterSpacing:1,color:'#001F6B',marginBottom:2}}>Pago por Bizum</p>
                            <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'rgba(0,0,0,0.45)',marginBottom:6}}>Directo desde tu app del banco, sin comisiones</p>
                            <div style={{display:'inline-flex',alignItems:'center',gap:6,background:'rgba(0,145,255,0.08)',border:'1px solid rgba(0,145,255,0.2)',borderRadius:8,padding:'4px 10px'}}>
                                <span style={{fontFamily:"'Inter',sans-serif",fontSize:11,fontWeight:600,color:'#0091FF',letterSpacing:1}}>BIZUM</span>
                                <span style={{fontFamily:"'Inter',sans-serif",fontSize:9,color:'rgba(0,145,255,0.6)'}}>· al instante</span>
                            </div>
                        </div>
                    </div>
                    <div style={{...S.card,display:'flex',alignItems:'center',gap:12,padding:'12px 14px',textAlign:'left'}}>
                        <span style={{fontSize:20,flexShrink:0}}>👨‍👩‍👧</span>
                        <div>
                            <p style={{fontFamily:"'Teko',sans-serif",fontSize:16,letterSpacing:1,color:'#001F6B',marginBottom:2}}>Pago familiar / grupal</p>
                            <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'rgba(0,0,0,0.45)',lineHeight:1.5}}>Si alguien de tu casa se encarga de tu pago, puede seguir siendo así. Ustedes eligen quién paga por quién — la app lo gestiona en un solo cobro.</p>
                        </div>
                    </div>
                    <div style={{...S.card,display:'flex',alignItems:'center',gap:12,padding:'12px 14px',textAlign:'left'}}>
                        <span style={{fontSize:20,flexShrink:0}}>🔒</span>
                        <div>
                            <p style={{fontFamily:"'Teko',sans-serif",fontSize:16,letterSpacing:1,color:'#001F6B',marginBottom:2}}>Nunca compartes datos bancarios</p>
                            <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'rgba(0,0,0,0.45)',lineHeight:1.5}}>El Bizum lo haces tú mismo desde tu banco — la app solo registra la confirmación</p>
                        </div>
                    </div>
                </div>
                <div style={S.infoBox}><p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,31,107,0.7)',lineHeight:1.7,textAlign:'center'}}>
                    🏆 <strong>Top 3 de la porra con premio asegurado</strong> — el bote sale de las inscripciones (5€ × jugadores): <strong>65%</strong> para el 1º, <strong>25%</strong> para el 2º, <strong>10%</strong> para el 3º. El resto de premios (Estrellas, rifas...) salen de otros botes internos, no de este.<br/>
                    ❄️ <strong>Campeón de Invierno</strong> — reconocimiento propio a mitad de temporada.<br/>
                    🎟️ <strong>Rifas</strong> durante toda la temporada, para todos.<br/>
                    ⭐ <strong>Liga de Estrellas</strong> — premio aparte, de alto valor, que iremos desvelando poco a poco.<br/>
                    ✨ Y más sorpresas según avance la temporada.
                </p></div>
            </div>
        );

        case 16: return (
            <div style={{textAlign:'center'}}>
                <span style={S.iconBig}>👥</span>
                <div style={S.eyebrow}>Quedan 5 huecos libres</div>
                <h1 style={S.titulo}>INVITA A<br/>UN AMIGO</h1>
                <div style={{display:'flex',gap:5,flexWrap:'wrap',justifyContent:'center',maxWidth:320,margin:'0 auto 10px'}}>
                    {Array.from({length:20},function(_,i){return(
                        <div key={i} style={{width:15,height:15,borderRadius:'50%',
                            background:i<15?'rgba(0,31,107,0.65)':'transparent',
                            border:i<15?'1.5px solid rgba(0,31,107,0.4)':'1.5px dashed rgba(0,31,107,0.2)'}} />
                    );})}
                </div>
                <p style={{fontFamily:"'Teko',sans-serif",fontSize:12,letterSpacing:3,color:'rgba(0,31,107,0.4)',textTransform:'uppercase',marginBottom:14}}>15/20 plazas · quedan 5</p>
                <p style={{...S.cuerpo,fontSize:13}}>La liga admite hasta <strong style={{color:'#001F6B'}}>20 jugadores</strong>. Si traes a alguien, <strong style={{color:'#001F6B'}}>la próxima temporada tendrás tu propia liga</strong>.</p>
                <div style={S.infoBox}><p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,31,107,0.7)',textAlign:'center',lineHeight:1.7}}>🏆 Más jugadores = más bote<br/>🚀 Quien llene plazas, <strong>gestiona su propia liga</strong> la próxima temporada<br/>📲 Botón de invitar en el menú de la app</p></div>
            </div>
        );

        case 17: return (
            <div style={{textAlign:'center'}}>
                <img src="/escudo.png" alt="UDLP"
                    style={{width:80,height:96,objectFit:'contain',marginBottom:18,
                        filter:'drop-shadow(0 4px 18px rgba(0,31,107,0.2))',
                        animation:'floatIcon 3s ease-in-out infinite'}}
                    onError={function(e){e.target.style.display='none';}} />
                <div style={S.eyebrow}>Todo listo</div>
                <h1 style={S.tituloMega}>¿ESTÁN<br/>LISTOS?</h1>
                <p style={S.cuerpo}>La liga empieza el <strong style={{color:'#001F6B'}}>15 de agosto</strong>.<br/>El Otro Equipo se elige del <strong style={{color:'#001F6B'}}>11 al 14 de agosto</strong>.<br/>A continuación crearás tu perfil.</p>
                <div style={{display:'flex',gap:8,width:'100%',maxWidth:360,marginBottom:16}}>
                    {[['⚽','Porra','42 jornadas'],['🛡️','El Otro','×2 hasta ×3'],['⭐','Estrellas','Liga paralela'],['💳','5€','Inscripción']].map(function(r,i){return(
                        <div key={i} style={{...S.cardDorado,flex:1,textAlign:'center',padding:'12px 5px'}}>
                            <span style={{fontSize:18,display:'block',marginBottom:5}}>{r[0]}</span>
                            <p style={{fontFamily:"'Teko',sans-serif",fontSize:11,color:'#001F6B',letterSpacing:1,textTransform:'uppercase',lineHeight:1.2}}>{r[1]}</p>
                            <p style={{fontFamily:"'Inter',sans-serif",fontSize:9,color:'rgba(0,0,0,0.35)',marginTop:3}}>{r[2]}</p>
                        </div>
                    );})}
                </div>
            </div>
        );

        default: return null;
        }
    };

    return (
        <div style={{
            position:'fixed',inset:0,zIndex:500,
            background:'#fafaf8',
            display:'flex',flexDirection:'column',
            transition:'opacity .4s ease',
            animation: saliendo ? 'fadeOut .4s ease forwards' : 'fadeIn .3s ease',
            overflow:'hidden',
        }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@300;400;500;600&display=swap');
                @keyframes fadeOut{to{opacity:0;transform:scale(.98)}}
                @keyframes floatIcon{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
                @keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
                @keyframes fadeIn{from{opacity:0}to{opacity:1}}
            `}</style>

            {/* Campo de fútbol — fondo permanente */}
            <svg style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:0}}
                viewBox="0 0 400 700" fill="none" preserveAspectRatio="xMidYMid slice">
                <rect x="38" y="58" width="324" height="584" stroke="#001F6B" strokeWidth="0.9" opacity="0.04" rx="2"/>
                <line x1="38" y1="350" x2="362" y2="350" stroke="#001F6B" strokeWidth="0.7" opacity="0.04"/>
                <circle cx="200" cy="350" r="52" stroke="#001F6B" strokeWidth="0.7" opacity="0.04"/>
                <circle cx="200" cy="350" r="2.5" fill="#FFD700" opacity="0.2"/>
                <rect x="108" y="58" width="184" height="100" stroke="#001F6B" strokeWidth="0.7" opacity="0.04"/>
                <rect x="108" y="542" width="184" height="100" stroke="#001F6B" strokeWidth="0.7" opacity="0.04"/>
                <path d="M138 158 Q200 184 262 158" stroke="#001F6B" strokeWidth="0.5" opacity="0.03"/>
                <path d="M138 542 Q200 516 262 542" stroke="#001F6B" strokeWidth="0.5" opacity="0.03"/>
            </svg>

            {/* Contenido scrollable */}
            <div key={slide} style={{
                flex:1,overflowY:'auto',display:'flex',flexDirection:'column',
                alignItems:'center',justifyContent:'center',
                padding:'24px 28px 100px',position:'relative',zIndex:2,
                animation:'slideUp .3s ease both',
            }}>
                {renderSlide()}
            </div>

            {/* Barra inferior */}
            <div style={{
                position:'absolute',bottom:0,left:0,right:0,zIndex:10,
                display:'flex',alignItems:'center',justifyContent:'space-between',
                padding:'12px 18px 26px',
                background:'linear-gradient(to top,rgba(250,250,248,0.96) 60%,transparent)',
            }}>
                <button onClick={function(){if(slide>0)setSlide(function(v){return v-1;});}}
                    style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:14,letterSpacing:2,
                        background:'rgba(0,31,107,0.06)',color:'rgba(0,31,107,0.5)',
                        border:'1px solid rgba(0,31,107,0.1)',borderRadius:24,padding:'10px 18px',cursor:'pointer',
                        opacity:slide===0?0.2:1,textTransform:'uppercase'}}>← Atrás</button>

                <div style={{display:'flex',gap:5,alignItems:'center'}}>
                    {Array.from({length:TOTAL_SLIDES},function(_,i){return(
                        <div key={i} onClick={function(){setSlide(i);}}
                            style={{width:i===slide?18:5,height:5,borderRadius:3,cursor:'pointer',
                                background:i===slide?'#001F6B':'rgba(0,31,107,0.15)',
                                transition:'all .3s ease'}} />
                    );})}
                </div>

                <button onClick={siguiente}
                    style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:slide===TOTAL_SLIDES-1?12:15,letterSpacing:2,
                        background:slide===TOTAL_SLIDES-1?'#001F6B':'rgba(0,31,107,0.06)',
                        color:slide===TOTAL_SLIDES-1?'#FFD700':'rgba(0,31,107,0.7)',
                        border:slide===TOTAL_SLIDES-1?'none':'1px solid rgba(0,31,107,0.12)',
                        borderRadius:24,padding:'10px 18px',cursor:'pointer',textTransform:'uppercase',
                        boxShadow:slide===TOTAL_SLIDES-1?'0 4px 18px rgba(0,31,107,0.2)':'none'}}>
                    {slide===TOTAL_SLIDES-1?'¡CREAR MI PERFIL!':'Siguiente →'}
                </button>
            </div>

            {/* Saltar */}
            {slide < TOTAL_SLIDES-1 && (
                <button onClick={cerrar}
                    style={{position:'absolute',top:14,right:14,zIndex:20,
                        background:'none',border:'none',fontFamily:"'Inter',sans-serif",
                        fontSize:10,color:'rgba(0,0,0,0.2)',cursor:'pointer',letterSpacing:1}}>
                    Saltar
                </button>
            )}

            {/* Contador */}
            <div style={{position:'absolute',top:14,left:14,zIndex:20,
                fontFamily:"'Teko',sans-serif",fontSize:12,letterSpacing:3,
                color:'rgba(0,31,107,0.2)',textTransform:'uppercase'}}>
                {slide+1} / {TOTAL_SLIDES}
            </div>
        </div>
    );
};


// ============================================================================
// --- MIS 5 ESTRELLAS MODAL — acceso flotante desde Mi Jornada ---
// ============================================================================

// Foto oficial de jugador vía CDN público de API-Football (mismo apiId que
// usamos para calcular sus puntos de Estrellas — no requiere clave para la imagen).
function getFotoJugador(jug) {
    if (!jug) return '';
    if (jug.fotoManual) return jug.fotoManual; // fijada a mano en Admin → Verificar fotos, siempre gana
    if (!jug.apiId) return '';
    return 'https://media.api-sports.io/football/players/' + jug.apiId + '.png';
}


// ============================================================================
// --- PORRA ANUAL MODAL ---
// ============================================================================


const LaJornadaScreen = ({ userProfiles, onlineUsers, teamLogos }) => {
    var G = styles.colors;
    var [jornada, setJornada] = useState(null);
    var [participantes, setParticipantes] = useState([]);
    var [elOtroTodos, setElOtroTodos] = useState({});
    var [partidosPrimera, setPartidosPrimera] = useState([]);

    useEffect(function() {
        buscarJornadaCompletaPrimera(new Date().toISOString(), 5).then(function(r) {
            setPartidosPrimera(r || []);
        }).catch(function() {});
    }, []);
    var [clasifEstrellas, setClasifEstrellas] = useState([]);
    var [seleccionesEstrellasJornada, setSeleccionesEstrellasJornada] = useState([]); // para la comparativa en vivo
    var [loading, setLoading] = useState(true);
    // Lista completa de jugadores registrados — para que se vea a todo el
    // grupo aquí, no solo a quien ya ha apostado.
    var JUGADORES_FUNDADORES_LJ = ["Juanma","Lucy","Antonio","Mari","Pedro","Pedrito","Himar","Sarito","Vicky","Carmelo","Laura","Carlos","José","Claudio","Javi"];
    var [jugadoresAprobadosLJ, setJugadoresAprobadosLJ] = useState([]);
    var [jugadoresInactivosLJ, setJugadoresInactivosLJ] = useState([]);
    var JUGADORES_TODOS_LJ = Array.from(new Set(JUGADORES_FUNDADORES_LJ.concat(jugadoresAprobadosLJ)));
    var JUGADORES_ACTIVOS_LJ = JUGADORES_TODOS_LJ.filter(function(j) { return jugadoresInactivosLJ.indexOf(j) === -1; });

    useEffect(function() {
        var unsub = onSnapshot(doc(db, 'configuracion', 'jugadoresAprobados'), function(snap) {
            setJugadoresAprobadosLJ(snap.exists() ? (snap.data().nombres || []) : []);
        });
        return function() { unsub(); };
    }, []);
    useEffect(function() {
        var unsub = onSnapshot(doc(db, 'configuracion', 'jugadoresInactivos'), function(snap) {
            setJugadoresInactivosLJ(snap.exists() ? (snap.data().nombres || []) : []);
        });
        return function() { unsub(); };
    }, []);

    useEffect(function() {
        var unsubEst = onSnapshot(collection(db, "clasificacion_estrellas"), function(snap) {
            var datos = snap.docs.map(function(d) { return { id: d.id, ...d.data() }; })
                .sort(function(a,b) { return (b.puntosEstrellas||0) - (a.puntosEstrellas||0); });
            setClasifEstrellas(datos);
        });
        return function() { unsubEst(); };
    }, []);

    useEffect(function() {
        var q = query(collection(db, "jornadas"),
            where("estado", "in", ["Abierta","Cerrada","En vivo","Finalizada"]),
            orderBy("numeroJornada","desc"), limit(1));
        var unsub = onSnapshot(q, function(snap) {
            if (!snap.empty) {
                var j = { id: snap.docs[0].id, ...snap.docs[0].data() };
                setJornada(j);
                onSnapshot(collection(db, "pronosticos", j.id, "jugadores"), function(ps) {
                    setParticipantes(ps.docs.map(function(d) { return { id: d.id, ...d.data() }; }));
                });
                onSnapshot(collection(db, "estrellas_seleccion", j.id, "jugadores"), function(es) {
                    setSeleccionesEstrellasJornada(es.docs.map(function(d) { return { id: d.id, ...d.data() }; }));
                });
            }
            setLoading(false);
        });
        // El Otro Equipo de todos los jugadores
        var unsubOtro = onSnapshot(collection(db, "elOtro"), function(snap) {
            var m = {};
            snap.forEach(function(d) { m[d.id] = d.data(); });
            setElOtroTodos(m);
        });
        return function() { unsub(); unsubOtro(); };
    }, []);

    if (loading) return <LoadingSkeleton />;
    if (!jornada) return <div style={{padding:40,textAlign:'center'}}><p style={{fontFamily:"'Teko',sans-serif",fontSize:20,color:G.deepBlue,opacity:.5}}>SIN JORNADA ACTIVA</p></div>;

    var abierta = jornada.estado === 'Abierta';
    var udlpEsLocal = jornada.equipoLocal === 'UD Las Palmas';
    var live = jornada.liveData;
    var isLive = jornada.estado === 'En vivo' && live && live.isLive;
    var gL = isLive ? live.golesLocal : (jornada.estado==='Finalizada' ? jornada.resultadoLocal : null);
    var gV = isLive ? live.golesVisitante : (jornada.estado==='Finalizada' ? jornada.resultadoVisitante : null);

    var coste = jornada.esVip ? APUESTA_VIP : APUESTA_NORMAL;
    var bote = parseFloat(jornada.bote || 0) + participantes.length * coste;
    var ganadoresExactos = participantes.filter(function(p) {
        return gL !== null && gV !== null && parseInt(p.golesLocal)===parseInt(gL) && parseInt(p.golesVisitante)===parseInt(gV);
    });

    return (
        <div style={{paddingBottom:40}}>
            <h2 style={styles.title}>LA JORNADA</h2>

            {/* Banner resultado */}
            <div style={{background:'#001F6B',borderRadius:20,padding:24,marginBottom:20,textAlign:'center'}}>
                <p style={{fontFamily:"'Teko',sans-serif",fontSize:11,letterSpacing:4,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',marginBottom:16}}>
                    Jornada {jornada.numeroJornada} {jornada.esVip?'⭐ VIP':''} {jornada.derbi?'🔥':''} · {jornada.fecha}
                </p>
                {/* Marcador con escudos */}
                <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:12}}>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8,flex:1}}>
                        {udlpEsLocal ? (
                            <img src={'/escudo.png'} alt="UDLP"
                                style={{width:52,height:52,objectFit:'contain',filter:'drop-shadow(0 2px 8px rgba(0,0,0,0.3))'}}
                                onError={function(e){e.target.style.display='none';}} />
                        ) : (
                            <img src={getLogoEquipo(jornada.equipoLocal, teamLogos)} alt={jornada.equipoLocal}
                                style={{width:52,height:52,objectFit:'contain',filter:'drop-shadow(0 2px 8px rgba(0,0,0,0.3))'}}
                                onError={function(e){e.target.src='https://placehold.co/60x60/001F6B/FFD700?text=' + encodeURIComponent((jornada.equipoLocal||'?').substring(0,3));}} />
                        )}
                        <span style={{fontFamily:"'Teko',sans-serif",fontSize:13,color:'rgba(255,255,255,0.6)',letterSpacing:1,textTransform:'uppercase'}}>
                            {udlpEsLocal ? 'UD Las Palmas' : jornada.equipoLocal}
                        </span>
                    </div>
                    <div style={{textAlign:'center',flexShrink:0}}>
                        {gL !== null && gV !== null ? (
                            <p style={{fontFamily:"'Teko',sans-serif",fontSize:52,fontWeight:700,color:'#FFD700',letterSpacing:4,lineHeight:1}}>
                                {gL} — {gV}
                            </p>
                        ) : (
                            <p style={{fontFamily:"'Teko',sans-serif",fontSize:36,color:'rgba(255,255,255,0.2)',letterSpacing:4}}>vs</p>
                        )}
                        <div style={{marginTop:8}}>
                            {isLive && <span style={{fontFamily:"'Teko',sans-serif",fontSize:12,letterSpacing:3,color:'#e63946',padding:'4px 12px',background:'rgba(230,57,70,0.2)',borderRadius:10,animation:'blink-live 1.5s infinite'}}>EN VIVO</span>}
                            {!isLive && <span style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'rgba(255,255,255,0.3)'}}>{jornada.estado}</span>}
                        </div>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8,flex:1}}>
                        {udlpEsLocal ? (
                            <img src={getLogoEquipo(jornada.equipoVisitante, teamLogos)} alt={jornada.equipoVisitante}
                                style={{width:52,height:52,objectFit:'contain',filter:'drop-shadow(0 2px 8px rgba(0,0,0,0.3))'}}
                                onError={function(e){e.target.src='https://placehold.co/60x60/001F6B/FFD700?text=' + encodeURIComponent((jornada.equipoVisitante||'?').substring(0,3));}} />
                        ) : (
                            <img src={'/escudo.png'} alt="UDLP"
                                style={{width:52,height:52,objectFit:'contain',filter:'drop-shadow(0 2px 8px rgba(0,0,0,0.3))'}}
                                onError={function(e){e.target.style.display='none';}} />
                        )}
                        <span style={{fontFamily:"'Teko',sans-serif",fontSize:13,color:'rgba(255,255,255,0.6)',letterSpacing:1,textTransform:'uppercase'}}>
                            {udlpEsLocal ? jornada.equipoVisitante : 'UD Las Palmas'}
                        </span>
                    </div>
                </div>
                {/* Bote */}
                <div style={{marginTop:16,display:'flex',justifyContent:'center',gap:24}}>
                    <div style={{textAlign:'center'}}>
                        <p style={{fontFamily:"'Teko',sans-serif",fontSize:24,fontWeight:700,color:'#FFD700'}}>{bote.toFixed(0)}€</p>
                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:10,color:'rgba(255,255,255,0.35)',letterSpacing:2,textTransform:'uppercase'}}>Bote</p>
                    </div>
                    <div style={{textAlign:'center'}}>
                        <p style={{fontFamily:"'Teko',sans-serif",fontSize:24,fontWeight:700,color:'rgba(255,255,255,0.6)'}}>{participantes.length}</p>
                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:10,color:'rgba(255,255,255,0.35)',letterSpacing:2,textTransform:'uppercase'}}>Apuestas</p>
                    </div>
                </div>
            </div>

            {/* Pronósticos */}
            <div style={{background:'#fff',borderRadius:16,border:'1px solid rgba(0,31,107,0.08)',overflow:'hidden'}}>
                <div style={{background:'rgba(0,31,107,0.04)',padding:'12px 16px',borderBottom:'1px solid rgba(0,31,107,0.06)'}}>
                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:13,letterSpacing:3,color:G.deepBlue,opacity:.5,textTransform:'uppercase'}}>
                        {abierta ? 'APUESTAS SECRETAS HASTA EL CIERRE' : 'PRONÓSTICOS'}
                    </p>
                </div>

                {abierta ? (
                    <div style={{padding:24,textAlign:'center'}}>
                        <p style={{fontSize:36,marginBottom:8}}>🔒</p>
                        <p style={{fontFamily:"'Teko',sans-serif",fontSize:18,letterSpacing:2,color:G.deepBlue,textTransform:'uppercase',marginBottom:4}}>
                            Apuestas en curso
                        </p>
                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:G.deepBlue,opacity:.5}}>
                            Los pronósticos se revelarán cuando cierren las apuestas.
                        </p>
                        {/* Todo el grupo, no solo quien ya ha apostado — atenuados
                            quienes todavía no lo han hecho, para que se vean entre
                            ellos de un vistazo. La burbuja de El Otro Equipo aquí
                            es la de ESTA jornada en concreto (activado o no), no
                            si tienen equipo elegido para toda la temporada. */}
                        <div style={{display:'flex',flexWrap:'wrap',gap:14,justifyContent:'center',marginTop:20}}>
                            {JUGADORES_ACTIVOS_LJ.map(function(nombre) {
                                var apuesta = participantes.find(function(p) { return p.id === nombre; });
                                var haApostado = !!apuesta;
                                var perf = userProfiles[nombre] || {};
                                var otro = elOtroTodos[nombre];
                                var tieneEquipoOtro = !!(otro && otro.equipo);
                                var activadoEstaJornada = haApostado && apuesta.elOtroActivado;
                                return (
                                    <div key={nombre} style={{opacity: haApostado ? 1 : 0.35, display:'flex', flexDirection:'column', alignItems:'center', gap:4, transition:'opacity .2s'}}>
                                        <div style={{position:'relative'}}>
                                            <div style={{border: '2px solid rgba(0,31,107,0.15)', borderRadius:'50%', boxShadow: '0 2px 8px rgba(0,31,107,0.12)'}}>
                                                <IconoPerfil perfil={perf} size={44} />
                                            </div>
                                            {tieneEquipoOtro && (
                                                <div style={{
                                                    position:'absolute', top:-6, right:-6, width:20, height:20, borderRadius:'50%',
                                                    background: activadoEstaJornada ? '#001F6B' : 'rgba(0,31,107,0.15)',
                                                    border: activadoEstaJornada ? '1.5px solid #FFD700' : '1.5px solid rgba(0,31,107,0.2)',
                                                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:9,
                                                }} title={activadoEstaJornada ? 'Ha activado El Otro Equipo esta jornada' : 'No ha activado El Otro Equipo esta jornada'}>
                                                    🛡️❓
                                                </div>
                                            )}
                                        </div>
                                        <span style={{fontFamily:"'Inter',sans-serif",fontSize:9,color:G.deepBlue,opacity:.6,maxWidth:50,textAlign:'center',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                                            {nombreVisible(nombre, perf)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div style={{padding:'8px 0'}}>
                        {JUGADORES_ACTIVOS_LJ
                            .map(function(nombre) { return participantes.find(function(p) { return p.id === nombre; }) || { id: nombre, sinApuesta: true }; })
                            .sort(function(a,b) { return (b.puntosObtenidos||0)-(a.puntosObtenidos||0); })
                            .map(function(p) {
                            var ganador = ganadoresExactos.find(function(g) { return g.id === p.id; });
                            var perf = userProfiles[p.id] || {};
                            var otro = elOtroTodos[p.id];
                            var elOtroActivado = p.elOtroActivado;
                            return (
                                <div key={p.id} style={{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',
                                    borderBottom:'1px solid rgba(0,31,107,0.05)', opacity: p.sinApuesta ? 0.4 : 1,
                                    background: ganador ? 'rgba(255,215,0,0.06)' : 'transparent'}}>
                                    {/* Avatar con burbuja El Otro Equipo */}
                                    <PlayerAvatar name={p.id} perfil={perf} elOtroData={otro} size={40} showElOtro={true} teamLogos={teamLogos} />
                                    <div style={{flex:1}}>
                                        {p.sinApuesta ? (
                                            <span style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,31,107,0.4)',fontStyle:'italic'}}>
                                                No apostó esta jornada
                                            </span>
                                        ) : (
                                        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                                            <span style={{
                                                fontFamily:"'Teko',sans-serif",fontSize:18,fontWeight:700,
                                                color: ganador ? G.golden : G.deepBlue,
                                                background: ganador ? 'rgba(255,215,0,0.12)' : 'rgba(0,31,107,0.06)',
                                                padding:'3px 10px',borderRadius:8,letterSpacing:1}}>
                                                {p.golesLocal}-{p.golesVisitante}
                                            </span>
                                            <span style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'rgba(0,31,107,0.5)'}}>
                                                {p.resultado1x2}
                                            </span>
                                            <span style={{fontFamily:"'Inter',sans-serif",fontSize:10,
                                                background: elOtroActivado ? 'rgba(0,31,107,0.08)' : 'rgba(0,31,107,0.03)',
                                                color: elOtroActivado ? G.deepBlue : 'rgba(0,31,107,0.35)',
                                                padding:'2px 8px',borderRadius:10}}>
                                                {elOtroActivado && otro ? ('El Otro ' + (otro.revelado ? '· ' + otro.equipo : '🛡️')) : 'El Otro sin activar'}
                                            </span>
                                            {ganador && <span style={{fontSize:14}}>🏆</span>}
                                        </div>
                                        )}
                                    </div>
                                    {/* Puntos */}
                                    {!p.sinApuesta && (jornada.estado==='Finalizada' || isLive) && (
                                        <span style={{fontFamily:"'Teko',sans-serif",fontSize:22,fontWeight:700,color: ganador?G.golden:G.deepBlue}}>
                                            {p.puntosObtenidos||0}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                        {participantes.length === 0 && (
                            <p style={{fontFamily:"'Inter',sans-serif",fontSize:13,color:G.deepBlue,opacity:.4,padding:24,textAlign:'center'}}>
                                Nadie apostó en esta jornada.
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Estrellas EN VIVO — comparativa provisional durante el partido, NO definitiva */}
            {isLive && jornada.liveEstrellas && jornada.liveEstrellas.puntosPorNombre && seleccionesEstrellasJornada.length > 0 && (function() {
                var puntosLive = jornada.liveEstrellas.puntosPorNombre;
                var ranking = seleccionesEstrellasJornada.map(function(sel) {
                    var total = (sel.jugadores || []).reduce(function(acc, j) { return acc + (puntosLive[j.nombre] || 0); }, 0);
                    return { id: sel.id, total: total };
                }).sort(function(a,b) { return b.total - a.total; });
                return (
                    <div style={{background:'#fff',borderRadius:16,border:'1px solid rgba(230,57,70,0.15)',overflow:'hidden',marginTop:16}}>
                        <div style={{background:'rgba(230,57,70,0.06)',padding:'12px 16px',borderBottom:'1px solid rgba(230,57,70,0.08)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                            <p style={{fontFamily:"'Teko',sans-serif",fontSize:13,letterSpacing:3,color:G.danger,opacity:.8,textTransform:'uppercase'}}>
                                🔴 Estrellas EN VIVO
                            </p>
                            <span style={{fontFamily:"'Inter',sans-serif",fontSize:10,color:G.danger,opacity:.5}}>Provisional — no cuenta todavía</span>
                        </div>
                        <div style={{padding:'6px 0'}}>
                            {ranking.slice(0,5).map(function(p, i) {
                                var perf = userProfiles[p.id] || {};
                                return (
                                    <div key={p.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 16px',
                                        borderBottom: i < 4 ? '1px solid rgba(0,31,107,0.05)' : 'none'}}>
                                        <span style={{fontFamily:"'Teko',sans-serif",fontSize:16,color: i===0 ? G.danger : 'rgba(0,31,107,0.3)',minWidth:18,textAlign:'center'}}>
                                            {i+1}
                                        </span>
                                        <PlayerAvatar name={p.id} perfil={perf} size={32} />
                                        <span style={{flex:1,fontFamily:"'Inter',sans-serif",fontSize:13,color:G.deepBlue,fontWeight: i===0?600:400}}>
                                            {p.id}
                                        </span>
                                        <span style={{fontFamily:"'Teko',sans-serif",fontSize:18,fontWeight:700,color: i===0 ? G.danger : G.deepBlue}}>
                                            {p.total}⭐
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })()}

            {/* Clasificación de Estrellas — quién va ganando */}
            {clasifEstrellas.length > 0 && (
                <div style={{background:'#fff',borderRadius:16,border:'1px solid rgba(0,31,107,0.08)',overflow:'hidden',marginTop:16}}>
                    <div style={{background:'rgba(255,215,0,0.06)',padding:'12px 16px',borderBottom:'1px solid rgba(0,31,107,0.06)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <p style={{fontFamily:"'Teko',sans-serif",fontSize:13,letterSpacing:3,color:G.deepBlue,opacity:.6,textTransform:'uppercase'}}>
                            ⭐ Estrellas — Liga Paralela
                        </p>
                        <span style={{fontFamily:"'Inter',sans-serif",fontSize:10,color:G.deepBlue,opacity:.35}}>Acumulado temporada</span>
                    </div>
                    <div style={{padding:'6px 0'}}>
                        {clasifEstrellas.slice(0,5).map(function(p, i) {
                            var perf = userProfiles[p.id] || {};
                            return (
                                <div key={p.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 16px',
                                    borderBottom: i < 4 ? '1px solid rgba(0,31,107,0.05)' : 'none',
                                    background: i===0 ? 'rgba(255,215,0,0.07)' : 'transparent'}}>
                                    <span style={{fontFamily:"'Teko',sans-serif",fontSize:16,color: i===0 ? G.golden : 'rgba(0,31,107,0.3)',minWidth:18,textAlign:'center'}}>
                                        {i+1}
                                    </span>
                                    <PlayerAvatar name={p.id} perfil={perf} size={32} />
                                    <span style={{flex:1,fontFamily:"'Inter',sans-serif",fontSize:13,color:G.deepBlue,fontWeight: i===0?600:400}}>
                                        {p.id}
                                    </span>
                                    {i===0 && <span style={{fontSize:13}}>🏆</span>}
                                    <span style={{fontFamily:"'Teko',sans-serif",fontSize:18,fontWeight:700,color: i===0 ? G.golden : G.deepBlue}}>
                                        {p.puntosEstrellas || 0}⭐
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Partidos de Primera relevantes — los que afectan a jugadores
                del grupo que tienen equipo elegido en El Otro, para que se
                vea de un vistazo qué partidos importan esta jornada. */}
            {partidosPrimera.length > 0 && (
                <div style={{marginTop:24}}>
                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:13,letterSpacing:3,color:G.deepBlue,opacity:.4,textTransform:'uppercase',marginBottom:10}}>
                        Partidos de Primera · El Otro Equipo
                    </p>
                    <div style={{background:'#fff',border:'1px solid rgba(0,31,107,0.1)',borderRadius:16,overflow:'hidden'}}>
                        {partidosPrimera.map(function(p) {
                            var fechaObj = new Date(p.fecha);
                            var fechaTexto = fechaObj.toLocaleString('es-ES', {weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit', timeZone:'Atlantic/Canary'});
                            var finalizado = p.estadoCorto === 'FT' || p.estadoCorto === 'AET' || p.estadoCorto === 'PEN';
                            var enVivo = p.estadoCorto === '1H' || p.estadoCorto === '2H' || p.estadoCorto === 'HT';
                            return (
                                <div key={p.fixtureId} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderBottom:'1px solid rgba(0,31,107,0.05)',flexWrap:'wrap'}}>
                                    <span style={{fontFamily:"'Inter',sans-serif",fontSize:10,color:'rgba(0,31,107,0.4)',minWidth:100}}>{fechaTexto}</span>
                                    <span style={{fontFamily:"'Teko',sans-serif",fontSize:14,color:G.deepBlue,flex:1}}>{p.local} vs {p.visitante}</span>
                                    {finalizado && (
                                        <span style={{fontFamily:"'Teko',sans-serif",fontSize:14,fontWeight:700,color:'#10b981'}}>{p.golesLocal}-{p.golesVisitante}</span>
                                    )}
                                    {enVivo && (
                                        <span style={{fontFamily:"'Inter',sans-serif",fontSize:10,background:'rgba(230,57,70,0.1)',color:'#e63946',padding:'2px 8px',borderRadius:10}}>EN VIVO {p.golesLocal}-{p.golesVisitante}</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};


const ElCaminoScreen = ({ user, userProfiles, onlineUsers }) => {
    const [config, setConfig] = useState(null); 
    const [apuesta, setApuesta] = useState(''); 
    const [hasBet, setHasBet] = useState(false);
    const [allBets, setAllBets] = useState([]);
    const [timeLeft, setTimeLeft] = useState('');
    const [stats, setStats] = useState({});

    useEffect(() => { 
        const unsubConfig = onSnapshot(doc(db, "configuracion", "playoff"), (d) => { if(d.exists()) setConfig(d.data()); }); 
        getDoc(doc(db, "apuestasExtra", user)).then(d => { if(d.exists()){ setApuesta(d.data().equipo); setHasBet(true); }}); 
        const unsubBets = onSnapshot(collection(db, "apuestasExtra"), (snap) => { 
            let fetchedBets = snap.docs.map(d => ({id: d.id, ...d.data()}));
            
            // --- INYECCIÓN AUTOMÁTICA DEL MÁLAGA (Para Carlos, Carmelo, José) ---
            const faltan = ['Carlos', 'Carmelo', 'José'];
            faltan.forEach(nombre => {
                if (!fetchedBets.find(b => b.id === nombre)) {
                    fetchedBets.push({ id: nombre, equipo: 'Málaga CF', inyectado: true });
                }
            });

            setAllBets(fetchedBets);

            // --- CÁLCULO DE GRÁFICA DE PORCENTAJES ---
            const conteo = {};
            fetchedBets.forEach(b => { conteo[b.equipo] = (conteo[b.equipo] || 0) + 1; });
            setStats(conteo);
        });
        return () => { unsubConfig(); unsubBets(); };
    }, [user]);

    useEffect(() => {
        if (!config?.fechaCierreApuestaExtra?.seconds) return;
        const timer = setInterval(() => {
            const target = new Date(config.fechaCierreApuestaExtra.seconds * 1000);
            const now = new Date();
            const diff = target - now;
            if (diff <= 0) { setTimeLeft('CERRADO'); clearInterval(timer); } 
            else {
                const d = Math.floor(diff / (1000 * 60 * 60 * 24));
                const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
                const m = Math.floor((diff / 1000 / 60) % 60);
                const s = Math.floor((diff / 1000) % 60);
                setTimeLeft(`${d}d ${h}h ${m}m ${s}s`);
            }
        }, 1000);
        return () => clearInterval(timer);
    }, [config]);

    const handleBet = async (eq) => { 
        if(hasBet || config?.bloqueado) return; 
        if(window.confirm(`¿Apostar por ${eq}? Sumarás +5 puntos si asciende.`)) { 
            await setDoc(doc(db, "apuestasExtra", user), { equipo: eq }); setApuesta(eq); setHasBet(true); 
        }
    };

    const isSecreto = config?.fechaCierreApuestaExtra && new Date() < new Date(config.fechaCierreApuestaExtra.seconds * 1000);
    const totalVotes = allBets.length;

    return (
        <div>
            <h2 style={styles.title}>EL CAMINO AL ASCENSO</h2>
            <div style={styles.bracketContainer}>
                <div style={styles.bracketMatchup}><div style={{...styles.bracketTeam, ...(config?.semi1_ganador === 'UD Almería' ? styles.bracketWinner : {})}}>UD Almería</div><span style={{color: styles.colors.silver, fontSize: '1.2rem', fontFamily: "'Oswald', sans-serif"}}>VS</span><div style={{...styles.bracketTeam, ...(config?.semi1_ganador === 'CD Castellón' ? styles.bracketWinner : {})}}>CD Castellón</div></div>
                <div style={styles.bracketMatchup}><div style={{...styles.bracketTeam, ...(config?.semi2_ganador === 'Málaga CF' ? styles.bracketWinner : {})}}>Málaga CF</div><span style={{color: styles.colors.silver, fontSize: '1.2rem', fontFamily: "'Oswald', sans-serif"}}>VS</span><div style={{...styles.bracketTeam, ...(config?.semi2_ganador === 'UD Las Palmas' ? styles.bracketWinner : {})}}>UD Las Palmas</div></div>
                <div style={styles.bracketFinal}><h4 style={{fontFamily: "'Oswald', sans-serif", color: styles.colors.golden, marginBottom: '15px', fontSize: '1.5rem', letterSpacing: '2px'}}>GRAN FINAL</h4><p style={{fontSize: '1.2rem', fontWeight: '600', color: styles.colors.lightText}}>{config?.semi1_ganador || '???'} vs {config?.semi2_ganador || '???'}</p>{config?.ascendido && <h3 style={{fontFamily: "'Oswald', sans-serif", color: styles.colors.success, marginTop: '20px', fontSize: '2rem', textShadow: '0 0 20px rgba(16,185,129,0.5)'}}>🎉 ASCIENDE: {config.ascendido} 🎉</h3>}</div>
            </div>
            
            <div style={{...styles.form, textAlign: 'center'}}>
                <h3 style={{fontFamily: "'Oswald', sans-serif", color: styles.colors.golden, marginBottom: '10px', fontSize: '1.4rem', letterSpacing: '1px'}}>APUESTA EXTRA <span style={styles.oddsBadge}>+5 PTS</span></h3>
                <p style={{marginBottom: '20px', color: styles.colors.silver, fontSize: '0.9rem'}}>¿Qué equipo logrará el ansiado ascenso a Primera?</p>
                
                {isSecreto && !config?.bloqueado && timeLeft !== 'CERRADO' && (
                    <div style={{marginBottom: '25px', padding: '15px', backgroundColor: 'rgba(230,57,70,0.1)', border: `1px solid rgba(230,57,70,0.3)`, borderRadius: '12px'}}>
                        <p style={{color: styles.colors.silver, fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.85rem', marginBottom: '5px', letterSpacing: '1px'}}>Cierre de Apuestas en:</p>
                        <p style={{color: styles.colors.danger, fontSize: '2rem', fontWeight: 'bold', fontFamily: "'Oswald', sans-serif", letterSpacing: '2px', textShadow: '0 0 10px rgba(230,57,70,0.4)'}}>{timeLeft}</p>
                    </div>
                )}

                {!hasBet && (!config || !config.bloqueado) && timeLeft !== 'CERRADO' ? (
                    <div style={{display: 'flex', gap: '15px', flexWrap: 'wrap', justifyContent: 'center'}}>
                        {["UD Almería", "Málaga CF", "UD Las Palmas", "CD Castellón"].map(eq => (<button key={eq} onClick={() => handleBet(eq)} style={{...styles.secondaryButton, padding: '12px 20px', fontSize: '1rem'}}>{eq}</button>))}
                    </div>
                ) : (
                    <div style={{padding: '20px', backgroundColor: 'rgba(212,175,55,0.05)', borderRadius: '16px', border: `1px solid rgba(212,175,55,0.3)`}}>
                        <p style={{fontWeight: '600', fontSize: '1.1rem', color: styles.colors.silver}}>Tu apuesta: <span style={{color: styles.colors.golden, fontFamily: "'Oswald', sans-serif", fontSize: '1.4rem', letterSpacing: '1px', marginLeft: '10px'}}>{apuesta || 'No apostaste'}</span></p>
                        {config?.ascendido && apuesta && <p style={{marginTop: '15px', fontWeight: 'bold', fontSize: '1.1rem', color: config.ascendido === apuesta ? styles.colors.success : styles.colors.danger}}>{config.ascendido === apuesta ? '¡HAS GANADO +5 PUNTOS!' : 'Apuesta Fallada'}</p>}
                    </div>
                )}
            </div>

            {/* --- GRÁFICA DE FAVORITOS --- */}
            {totalVotes > 0 && (
                <div style={styles.graphContainer}>
                    <h4 style={{fontFamily: "'Oswald', sans-serif", color: styles.colors.golden, marginBottom: '20px', textAlign: 'center', letterSpacing: '1px', fontSize: '1.2rem'}}>📊 FAVORITOS DE LA PEÑA</h4>
                    {Object.keys(stats).sort((a,b) => stats[b] - stats[a]).map(equipo => {
                        const pct = Math.round((stats[equipo] / totalVotes) * 100);
                        return (
                            <div key={equipo} style={styles.graphBarWrapper}>
                                <div style={styles.graphBarLabel}>
                                    <strong style={{color: '#fff'}}>{equipo}</strong>
                                    <span>{pct}% ({stats[equipo]} votos)</span>
                                </div>
                                <div style={styles.graphBarBg}>
                                    <div style={{...styles.graphBarFill, width: `${pct}%`}}></div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            <div style={{marginTop: '40px'}}>
                <h4 style={styles.formSectionTitle}>APUESTAS DE LOS JUGADORES</h4>
                <div style={{backgroundColor: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '16px', border: `1px solid rgba(255,215,0,0.15)`}}>
                    {allBets.length > 0 ? (
                        <ul style={{listStyle: 'none', padding: 0}}>
                            {allBets.map(b => (
                                <li key={b.id} style={{padding: '12px 0', borderBottom: `1px solid rgba(255,255,255,0.05)`, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                    <PlayerProfileDisplay name={b.id} profile={userProfiles[b.id]} isOnline={onlineUsers ? onlineUsers[b.id] : false} />
                                    {b.id === user ? ( <span style={{fontWeight: 'bold', color: styles.colors.golden, fontFamily: "'Oswald', sans-serif", letterSpacing: '1px', fontSize: '1.1rem'}}>{b.equipo}</span> ) : (
                                        isSecreto ? <span style={styles.secrecyBadge}>Secreta 🤫</span> : <span style={{fontWeight: '600', color: styles.colors.silver, fontFamily: "'Oswald', sans-serif", letterSpacing: '1px', fontSize: '1.1rem'}}>{b.equipo} {b.inyectado ? '(Auto)' : ''}</span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : (<p style={{textAlign: 'center', color: styles.colors.silver, fontStyle: 'italic'}}>Aún no hay apuestas.</p>)}
                </div>
            </div>
        </div>
    );
};

const PorraAnualScreen = ({ userProfiles, onlineUsers }) => {
    const [apuestasAnuales, setApuestasAnuales] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, "porraAnual")); 
        const unsubscribe = onSnapshot(q, (snap) => {
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setApuestasAnuales(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    if (loading) return <LoadingSkeleton />;

    return (
        <div>
            <h2 style={styles.title}>PORRA ANUAL</h2>
            <p style={{textAlign: 'center', marginBottom: '25px', color: styles.colors.silver, fontSize: '0.9rem', lineHeight: 1.5}}>
                Apuestas de principio de temporada.<br/>
                <span style={{color: styles.colors.golden, fontWeight: 'bold'}}>+5 Pts Ascenso | +10 Pts Posición Exacta | +20 Pts Pleno</span>
            </p>
            
            {apuestasAnuales.length === 0 ? (
                <div style={styles.placeholder}>Aún no se han cargado los datos o la colección está vacía.</div>
            ) : (
                <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                    {apuestasAnuales.map(apuesta => (
                        <div key={apuesta.id} style={{backgroundColor: 'rgba(0,0,0,0.4)', padding: '20px', borderRadius: '16px', borderLeft: `4px solid ${styles.colors.golden}`, boxShadow: '0 4px 10px rgba(0,0,0,0.2)'}}>
                            <div style={{marginBottom: '10px'}}><PlayerProfileDisplay name={apuesta.id} profile={userProfiles[apuesta.id]} isOnline={onlineUsers ? onlineUsers[apuesta.id] : false} /></div>
                            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', backgroundColor: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '12px'}}>
                                <div>
                                    <p style={{color: styles.colors.silver, fontSize: '0.8rem', textTransform: 'uppercase'}}>Posición Final:</p>
                                    <p style={{color: styles.colors.golden, fontSize: '1.2rem', fontWeight: 'bold', fontFamily: "'Oswald', sans-serif"}}>{apuesta.posicion || '---'}</p>
                                </div>
                                <div>
                                    <p style={{color: styles.colors.silver, fontSize: '0.8rem', textTransform: 'uppercase'}}>¿Asciende?:</p>
                                    <p style={{color: (apuesta.asciende === 'Sí' || apuesta.asciende === true) ? styles.colors.success : styles.colors.danger, fontSize: '1.2rem', fontWeight: 'bold', fontFamily: "'Oswald', sans-serif"}}>{apuesta.asciende !== undefined ? String(apuesta.asciende) : '---'}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
// ============================================================================
// --- PANTALLAS SECUNDARIAS ---
// ============================================================================

const LigaRegularScreen = ({ userProfiles, onlineUsers }) => {
    const [clasificacion, setClasificacion] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const qClasificacion = query(collection(db, "clasificacion"));
        const unsubscribe = onSnapshot(qClasificacion, (snap) => {
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setClasificacion(data.sort((a, b) => (b.puntosTotales || 0) - (a.puntosTotales || 0)));
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    if (loading) return <LoadingSkeleton />;

    return (
        <div>
            <h2 style={styles.title} className="app-title">LIGA REGULAR</h2>
            <p style={{textAlign: 'center', marginBottom: '25px', color: styles.colors.silver, fontSize: '0.9rem', lineHeight: 1.5}}>Clasificación consolidada de la Fase Regular.<br/>Esta es la base de puntos para la batalla del Playoff.</p>
            <div style={{overflowX: 'auto', backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: '20px', border: `1px solid rgba(255,215,0,0.15)`, padding: '10px', backdropFilter: 'blur(5px)'}}>
                <table style={styles.table}>
                    <thead><tr><th style={styles.th}>POS</th><th style={styles.th}>JUGADOR</th><th style={{...styles.th, textAlign: 'center'}}>PUNTOS BASE</th></tr></thead>
                    <tbody>
                        {clasificacion.map((jugador, index) => (
                            <tr key={jugador.id} style={styles.tr}>
                                <td style={styles.tdRank}>{index + 1}º</td>
                                <td style={styles.td}><PlayerProfileDisplay name={jugador.id} profile={userProfiles[jugador.id]} isOnline={onlineUsers ? onlineUsers[jugador.id] : false} /></td>
                                <td style={styles.tdTotalPoints}>{jugador.puntosTotales || 0}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const ClasificacionScreen = ({ currentUser, userProfiles, onlineUsers, pagos }) => {
    const [clasificacion, setClasificacion] = useState([]); 
    const [loading, setLoading] = useState(true); 
    const [campeonInvierno, setCampeonInvierno] = useState(null);
    const [jugadoresInactivosCL, setJugadoresInactivosCL] = useState([]); // para no contar en el bote a quien pagó y luego se retiró

    useEffect(() => { 
        const qClasificacion = query(collection(db, "clasificacion")); 
        const unsubscribe = onSnapshot(qClasificacion, (querySnapshot) => { 
            const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); 
            setClasificacion(data.sort((a,b) => (b.puntosTotales || 0) - (a.puntosTotales || 0))); 
            setLoading(false); 
        }); 
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'configuracion', 'campeonInvierno'), (snap) => {
            setCampeonInvierno(snap.exists() ? snap.data() : null);
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'configuracion', 'jugadoresInactivos'), (snap) => {
            setJugadoresInactivosCL(snap.exists() ? (snap.data().nombres || []) : []);
        });
        return () => unsub();
    }, []);

    if (loading) return <LoadingSkeleton />; 

    // Bote real, calculado a partir de las inscripciones pagadas de verdad —
    // no una cifra fija, porque el nº de jugadores todavía puede cambiar
    // (mínimo 15, objetivo 20). Contamos jugadores únicos, por si alguien
    // pagó la inscripción de varios a la vez, y EXCLUIMOS a quien haya
    // pagado pero luego se haya retirado — antes se seguía contando su
    // inscripción para siempre, inflando el bote con gente que ya no juega.
    const inscritos = Array.from(new Set(
        (pagos || []).filter(function(p) { return p.tipo === 'inscripcion' && p.estado !== 'pendiente_confirmacion' && p.estado !== 'cancelado' && p.estado !== 'rechazado' && p.estado !== 'fallido'; })
            .map(function(p) { return p.jugador; })
    )).filter(function(nombre) { return jugadoresInactivosCL.indexOf(nombre) === -1; });
    const boteActual = inscritos.length * 5;
    const premio1 = Math.round(boteActual * 0.65);
    const premio2 = Math.round(boteActual * 0.25);
    const premio3 = Math.round(boteActual * 0.10);

    return (
        <div>
            <h2 style={styles.title} className="app-title">CLASIFICACIÓN GLOBAL</h2>
            
            <div style={styles.prizeBannerFinal}>
                <h4 style={styles.prizeBannerTitle}>BOTE DE LA PORRA — A REPARTIR ENTRE EL TOP 3</h4>
                <p style={{textAlign:'center',fontFamily:"'Teko',sans-serif",fontSize:32,fontWeight:700,color:'#FFD700',letterSpacing:2,margin:'4px 0 6px'}}>
                    {boteActual}€
                </p>
                <p style={{textAlign:'center',fontFamily:"'Inter',sans-serif",fontSize:11,color:'rgba(255,255,255,0.55)',marginBottom:10}}>
                    Con {inscritos.length} inscritos ahora mismo — mínimo 15 jugadores (75€), objetivo 20 (100€). Este bote sale solo de las inscripciones de la porra — el resto de premios (Estrellas, rifas...) van aparte, de otros botes internos.
                </p>
                <div style={styles.prizeList}>
                    <div style={styles.prizeItem}><span style={{fontSize: '1.5rem'}}>🥇</span> <span><strong>1º CLASIFICADO (65%):</strong> {premio1}€</span></div>
                    <div style={styles.prizeItem}><span style={{fontSize: '1.5rem'}}>🥈</span> <span><strong>2º CLASIFICADO (25%):</strong> {premio2}€</span></div>
                    <div style={styles.prizeItem}><span style={{fontSize: '1.5rem'}}>🥉</span> <span><strong>3º CLASIFICADO (10%):</strong> {premio3}€</span></div>
                </div>
            </div>

            {campeonInvierno && campeonInvierno.top3 && campeonInvierno.top3[0] && (
                <div style={{background:'linear-gradient(135deg,#0091FF,#001F6B)',borderRadius:16,padding:'16px 18px',marginBottom:18,textAlign:'center'}}>
                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:13,letterSpacing:3,color:'rgba(255,255,255,0.6)',textTransform:'uppercase',marginBottom:4}}>❄️ Campeón de Invierno</p>
                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:26,fontWeight:700,color:'#fff',letterSpacing:1}}>{campeonInvierno.top3[0].nombre}</p>
                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(255,255,255,0.7)'}}>{campeonInvierno.top3[0].puntos} puntos a mitad de temporada</p>
                </div>
            )}

            <div style={{background:'rgba(255,215,0,0.06)',border:'1px solid rgba(255,215,0,0.25)',borderRadius:16,padding:'16px 18px',marginBottom:18}}>
                <p style={{fontFamily:"'Teko',sans-serif",fontSize:15,letterSpacing:2,color:'#FFD700',textTransform:'uppercase',marginBottom:8,fontWeight:700}}>
                    🎁 Y todavía hay más en juego
                </p>
                <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(255,255,255,0.7)',lineHeight:1.7,margin:0}}>
                    ❄️ Habrá un <strong>Campeón de Invierno</strong> — quien vaya primero a mitad de temporada tendrá su propio reconocimiento, sin esperar a junio.<br/>
                    🎟️ Durante la temporada se harán <strong>rifas</strong> para todos los jugadores, con sus propios premios.<br/>
                    ⭐ El ganador de la <strong>Liga de Estrellas</strong> también tiene premio aparte — de alto valor, y lo iremos desvelando poco a poco.<br/>
                    ✨ Y habrá más sorpresas según avance la temporada.
                </p>
            </div>

            <div style={{overflowX: 'auto', backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: '20px', border: `1px solid rgba(255,215,0,0.15)`, padding: '10px', backdropFilter: 'blur(5px)'}}>
                <table style={styles.table}>
                    <thead><tr><th style={styles.th}>POS</th><th style={styles.th}>JUGADOR</th><th style={{...styles.th, textAlign: 'center'}}>TOTAL</th><th style={{...styles.th, textAlign: 'center'}}>P. EXACTO</th></tr></thead>
                    <tbody>
                        {clasificacion.map((jugador, index) => { 
                            const rowStyle = jugador.id === currentUser ? {backgroundColor: 'rgba(212, 175, 55, 0.15)', border: `1px solid ${styles.colors.golden}`, transform: 'scale(1.02)'} : styles.tr;
                            return (
                                <tr key={jugador.id} style={rowStyle}>
                                    <td style={styles.tdRank}>{index + 1}º</td>
                                    <td style={styles.td}>
                                        <PlayerProfileDisplay name={jugador.id} profile={userProfiles[jugador.id]} isOnline={onlineUsers ? onlineUsers[jugador.id] : false} />
                                        {jugador.desgloseExtra && <div style={{fontSize: '0.75rem', color: styles.colors.success, marginTop: '5px', fontWeight: 'bold'}}>{jugador.desgloseExtra}</div>}
                                    </td>
                                    <td style={styles.tdTotalPoints}>{jugador.puntosTotales || 0}</td>
                                    <td style={{...styles.td, textAlign: 'center', color: styles.colors.silver, fontFamily: "'Montserrat', sans-serif"}}>{jugador.puntosResultadoExacto || 0}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const PagosScreen = ({ currentUser, contextoPago, onContextoPagoUsado }) => {
    var G = styles.colors;
    var JUGADORES_FUNDADORES = ["Juanma","Lucy","Antonio","Mari","Pedro","Pedrito","Himar","Sarito","Vicky","Carmelo","Laura","Carlos","José","Claudio","Javi"];
    var [jugadoresInactivos, setJugadoresInactivos] = useState([]);
    var [jugadoresAprobados, setJugadoresAprobados] = useState([]);
    var JUGADORES_TODOS = Array.from(new Set(JUGADORES_FUNDADORES.concat(jugadoresAprobados)));
    var JUGADORES_LISTA = JUGADORES_TODOS.filter(function(j) { return jugadoresInactivos.indexOf(j) === -1; });
    var [paso, setPaso] = useState('inicio');
    var [pagos, setPagos] = useState([]);
    var [jornadas, setJornadas] = useState([]);
    var [tipoPago, setTipoPago] = useState('inscripcion');
    var [jornadaSel, setJornadaSel] = useState('');
    var [jugadoresPagando, setJugadoresPagando] = useState([currentUser]);
    var [jugadoresPendientes, setJugadoresPendientes] = useState([]);
    var [error, setError] = useState('');
    var [bizumInfo, setBizumInfo] = useState({ nombre: 'Juanma', telefono: '' });
    var [copiado, setCopiado] = useState(false);
    var [heEnviado, setHeEnviado] = useState(false);

    useEffect(function() {
        var unsub = onSnapshot(doc(db, 'configuracion', 'bizum'), function(snap) {
            if (snap.exists()) setBizumInfo(snap.data());
        });
        return function() { unsub(); };
    }, []);

    // Si llegamos aquí desde el aviso de "falta pagar esta jornada" en Mi
    // Jornada, viene con el tipo y la jornada ya decididos — saltamos
    // directos al paso de selección, ya rellena, en vez de obligar a elegir
    // todo desde cero otra vez.
    useEffect(function() {
        if (!contextoPago) return;
        setTipoPago(contextoPago.tipo);
        setJornadaSel(contextoPago.jornada);
        setJugadoresPagando([currentUser]);
        setPaso('seleccion');
        if (onContextoPagoUsado) onContextoPagoUsado();
    }, [contextoPago, currentUser, onContextoPagoUsado]);

    useEffect(function() {
        var unsub = onSnapshot(doc(db, 'configuracion', 'jugadoresInactivos'), function(snap) {
            setJugadoresInactivos(snap.exists() ? (snap.data().nombres || []) : []);
        });
        return function() { unsub(); };
    }, []);

    useEffect(function() {
        var unsub = onSnapshot(doc(db, 'configuracion', 'jugadoresAprobados'), function(snap) {
            setJugadoresAprobados(snap.exists() ? (snap.data().nombres || []) : []);
        });
        return function() { unsub(); };
    }, []);

    useEffect(function() {
        var unsub = onSnapshot(query(collection(db, 'pagos'), orderBy('creadoEn','desc')),
            function(snap) { setPagos(snap.docs.map(function(d){return{id:d.id,...d.data()};})); }
        );
        return function(){unsub();};
    }, []);

    useEffect(function() {
        var unsub = onSnapshot(query(collection(db,'jornadas'),orderBy('numeroJornada','asc')),
            function(snap){setJornadas(snap.docs.map(function(d){return{id:d.id,...d.data()};}));}
        );
        return function(){unsub();};
    }, []);

    // Calcular jugadores con apuesta sin pagar (para que Laura pueda pagarles)
    useEffect(function() {
        if (tipoPago === 'inscripcion') {
            var sinInscripcion = JUGADORES_LISTA.filter(function(j) {
                return !pagos.some(function(p){ return p.jugador===j && p.tipo==='inscripcion' && p.estado!=='fallido' && p.estado!=='cancelado' && p.estado!=='rechazado'; });
            });
            setJugadoresPendientes(sinInscripcion);
        } else if (jornadaSel) {
            var sinJornada = JUGADORES_LISTA.filter(function(j) {
                return !pagos.some(function(p){ return p.jugador===j && p.jornada===jornadaSel && p.estado!=='fallido' && p.estado!=='cancelado' && p.estado!=='rechazado'; });
            });
            setJugadoresPendientes(sinJornada);
        }
    }, [pagos, tipoPago, jornadaSel]); // eslint-disable-line react-hooks/exhaustive-deps

    var toggleJugadorPagando = function(j) {
        setJugadoresPagando(function(prev) {
            var ya = prev.indexOf(j) > -1;
            if (ya) return prev.filter(function(x){return x!==j;});
            return prev.concat([j]);
        });
    };

    var precioUnitario = tipoPago==='inscripcion' ? 5 : tipoPago==='jornada_normal' ? 1 : 2;
    var total = jugadoresPagando.length * precioUnitario;

    var iniciarPago = function() {
        if (jugadoresPagando.length === 0) { setError('Selecciona al menos un jugador'); return; }
        if (tipoPago !== 'inscripcion' && !jornadaSel) { setError('Selecciona la jornada'); return; }
        setError('');
        setPaso('bizum');
    };

    var confirmarEnvioBizum = async function() {
        setPaso('procesando');
        try {
            var batch = jugadoresPagando.map(function(j) {
                return addDoc(collection(db,'pagos'), {
                    jugador: j,
                    pagoBy: currentUser,
                    tipo: tipoPago,
                    jornada: jornadaSel || null,
                    importe: precioUnitario,
                    descripcion: tipoPago==='inscripcion' ? 'Inscripción 26/27' : ('Jornada '+(tipoPago==='jornada_vip'?'VIP ':'')+ jornadaSel),
                    metodo: 'bizum',
                    estado: 'pendiente_confirmacion', // el admin lo confirma tras verlo en su banco
                    creadoEn: serverTimestamp(),
                });
            });
            await Promise.all(batch);
            setPaso('ok');
        } catch(e) {
            setError('Error: ' + e.message);
            setPaso('bizum');
        }
    };

    var misPagos = pagos.filter(function(p){return p.jugador===currentUser||p.pagoBy===currentUser;});
    var inscripcionPagada = jugadorHaPagado(currentUser, pagos);
    var S = {
        card: {background:'#fff',border:'1px solid rgba(0,31,107,0.1)',borderRadius:16,padding:18,marginBottom:14},
        label: {fontFamily:"'Teko',sans-serif",fontSize:11,letterSpacing:2,color:'rgba(0,31,107,0.5)',textTransform:'uppercase',display:'block',marginBottom:6},
        select: {width:'100%',padding:'11px 14px',border:'1.5px solid rgba(0,31,107,0.15)',borderRadius:12,fontFamily:"'Inter',sans-serif",fontSize:14,color:'#001F6B',outline:'none',marginBottom:14,background:'#f8f9ff'},
        btnPrimary: {width:'100%',fontFamily:"'Teko',sans-serif",fontSize:'1.1rem',letterSpacing:3,background:'#001F6B',color:'#FFD700',border:'none',borderRadius:30,padding:'14px',cursor:'pointer',textTransform:'uppercase',boxShadow:'0 6px 24px rgba(0,31,107,0.2)'},
        btnSec: {width:'100%',fontFamily:"'Teko',sans-serif",fontSize:13,letterSpacing:2,background:'rgba(0,31,107,0.06)',color:'#001F6B',border:'1px solid rgba(0,31,107,0.12)',borderRadius:12,padding:'11px',cursor:'pointer',textTransform:'uppercase',marginTop:10},
        tag: function(c){return{background:c+'20',color:c,border:'1px solid '+c+'40',borderRadius:8,padding:'3px 10px',fontFamily:"'Inter',sans-serif",fontSize:10,fontWeight:600};},
        jugBtn: function(sel){return{padding:'8px 14px',borderRadius:10,border:'none',cursor:'pointer',fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:1,background:sel?'#001F6B':'rgba(0,31,107,0.06)',color:sel?'#FFD700':'#001F6B',transition:'all .15s',fontWeight:sel?700:400};},
    };

    // ── INICIO ─────────────────────────────────────────────────────────────
    if (paso === 'inicio') return (
        <div style={{paddingBottom:40}}>
            <h2 style={{fontFamily:"'Teko',sans-serif",fontSize:22,letterSpacing:3,color:'#001F6B',textTransform:'uppercase',marginBottom:6,fontWeight:700}}>💳 PAGOS</h2>
            <p style={{fontFamily:"'Inter',sans-serif",fontSize:13,color:'rgba(0,31,107,0.5)',marginBottom:20,lineHeight:1.6}}>
                Paga tu inscripción y las jornadas. Puedes pagar por otros jugadores en un solo cobro.
            </p>

            {/* Estado inscripción propia */}
            <div style={{...S.card,border:inscripcionPagada?'1.5px solid #10b981':'1.5px solid rgba(255,215,0,0.5)',background:inscripcionPagada?'rgba(16,185,129,0.04)':'rgba(255,215,0,0.04)'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:inscripcionPagada?0:14}}>
                    <div>
                        <p style={{fontFamily:"'Teko',sans-serif",fontSize:18,letterSpacing:1,color:'#001F6B',marginBottom:2}}>Tu inscripción 26/27</p>
                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,31,107,0.5)'}}>5€ · Pago único para toda la temporada</p>
                    </div>
                    {inscripcionPagada
                        ? <span style={S.tag('#10b981')}>✅ Pagada</span>
                        : <span style={S.tag('#FFD700')}>⚠️ Pendiente</span>}
                </div>
                {!inscripcionPagada && (
                    <button onClick={function(){setTipoPago('inscripcion');setJugadoresPagando([currentUser]);setPaso('seleccion');}} style={S.btnPrimary}>
                        Pagar mi inscripción — 5€ →
                    </button>
                )}
            </div>

            {/* Pagar por otros */}
            <div style={S.card}>
                <p style={{fontFamily:"'Teko',sans-serif",fontSize:18,letterSpacing:1,color:'#001F6B',marginBottom:4}}>Pagar por alguien más</p>
                <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,31,107,0.5)',marginBottom:14,lineHeight:1.5}}>
                    ¿Quieres pagar la inscripción o una jornada de otro jugador? Selecciona aquí y se hace en un solo cobro.
                </p>
                <button onClick={function(){setTipoPago('inscripcion');setJugadoresPagando([]);setPaso('seleccion');}} style={S.btnPrimary}>
                    Pagar por otros →
                </button>
            </div>

            {/* Mis pagos */}
            {misPagos.length > 0 && (
                <div>
                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:12,letterSpacing:2,color:'rgba(0,31,107,0.4)',textTransform:'uppercase',marginBottom:10}}>Mis pagos</p>
                    {misPagos.slice(0,8).map(function(p) {
                        var color = p.estado==='completado'?'#10b981':p.estado==='fallido'?'#e63946':'rgba(0,31,107,0.4)';
                        return (
                            <div key={p.id} style={{...S.card,display:'flex',alignItems:'center',gap:10,padding:'12px 16px',marginBottom:8}}>
                                <div style={{flex:1}}>
                                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:15,color:'#001F6B',letterSpacing:1}}>{p.descripcion}</p>
                                    {p.pagoBy && p.pagoBy!==p.jugador && <p style={{fontFamily:"'Inter',sans-serif",fontSize:10,color:'rgba(0,31,107,0.4)'}}>Pagado por {p.pagoBy}</p>}
                                </div>
                                <span style={{fontFamily:"'Teko',sans-serif",fontSize:18,fontWeight:700,color:'#001F6B'}}>{p.importe}€</span>
                                <span style={S.tag(color)}>{p.estado||'ok'}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );

    // ── SELECCIÓN DE QUIÉN PAGA ─────────────────────────────────────────────
    if (paso === 'seleccion') return (
        <div style={{paddingBottom:40}}>
            <button onClick={function(){setPaso('inicio');}} style={{background:'none',border:'none',fontFamily:"'Teko',sans-serif",fontSize:13,letterSpacing:2,color:'rgba(0,31,107,0.5)',cursor:'pointer',marginBottom:16,textTransform:'uppercase'}}>← Volver</button>
            <h2 style={{fontFamily:"'Teko',sans-serif",fontSize:20,letterSpacing:3,color:'#001F6B',textTransform:'uppercase',marginBottom:20,fontWeight:700}}>¿Qué pagas?</h2>

            <div style={S.card}>
                <label style={S.label}>Tipo de pago</label>
                <select style={S.select} value={tipoPago} onChange={function(e){setTipoPago(e.target.value);setJugadoresPagando([currentUser]);}}>
                    <option value="inscripcion">Inscripción temporada — 5€/persona</option>
                    <option value="jornada_normal">Jornada normal — 1€/persona</option>
                    <option value="jornada_vip">Jornada VIP — 2€/persona</option>
                </select>

                {tipoPago !== 'inscripcion' && (
                    <div>
                        <label style={S.label}>Jornada</label>
                        <select style={S.select} value={jornadaSel} onChange={function(e){setJornadaSel(e.target.value);}}>
                            <option value="">Selecciona jornada...</option>
                            {jornadas.map(function(j){
                                return <option key={j.id} value={'J'+j.numeroJornada}>J{j.numeroJornada} — {j.equipoLocal} vs {j.equipoVisitante}</option>;
                            })}
                        </select>
                    </div>
                )}

                <label style={S.label}>¿Por quién pagas? (Toca para seleccionar)</label>
                <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'rgba(0,31,107,0.4)',marginBottom:10,lineHeight:1.5}}>
                    Solo aparecen los que aún no han pagado esto. Puedes pagar por varios en un solo cobro.
                </p>
                <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:16}}>
                    {jugadoresPendientes.map(function(j) {
                        var sel = jugadoresPagando.indexOf(j) > -1;
                        return (
                            <button key={j} onClick={function(){toggleJugadorPagando(j);}} style={S.jugBtn(sel)}>
                                {sel ? '✓ ' : ''}{j}
                            </button>
                        );
                    })}
                    {jugadoresPendientes.length === 0 && (
                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:13,color:'rgba(0,31,107,0.4)'}}>
                            Todos han pagado esto ✅
                        </p>
                    )}
                </div>

                {/* Resumen del total */}
                {jugadoresPagando.length > 0 && (
                    <div style={{background:'rgba(0,31,107,0.05)',borderRadius:12,padding:'12px 16px',marginBottom:16}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                            <p style={{fontFamily:"'Inter',sans-serif",fontSize:13,color:'rgba(0,31,107,0.7)'}}>
                                {jugadoresPagando.join(', ')}
                            </p>
                            <p style={{fontFamily:"'Teko',sans-serif",fontSize:24,fontWeight:700,color:'#001F6B'}}>
                                {total}€
                            </p>
                        </div>
                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'rgba(0,31,107,0.4)',marginTop:4}}>
                            {jugadoresPagando.length} persona{jugadoresPagando.length>1?'s':''} × {precioUnitario}€
                        </p>
                    </div>
                )}

                {error && <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'#e63946',marginBottom:12,textAlign:'center'}}>{error}</p>}

                <button onClick={iniciarPago} disabled={jugadoresPagando.length===0} style={{...S.btnPrimary,opacity:jugadoresPagando.length===0?0.5:1}}>
                    Continuar — pagar {total}€ →
                </button>
            </div>
        </div>
    );

    // ── BIZUM ─────────────────────────────────────────────────────────────
    if (paso === 'bizum') return (
        <div style={{paddingBottom:40}}>
            <button onClick={function(){setPaso('seleccion');setHeEnviado(false);}} style={{background:'none',border:'none',fontFamily:"'Teko',sans-serif",fontSize:13,letterSpacing:2,color:'rgba(0,31,107,0.5)',cursor:'pointer',marginBottom:16,textTransform:'uppercase'}}>← Volver</button>
            <h2 style={{fontFamily:"'Teko',sans-serif",fontSize:20,letterSpacing:3,color:'#001F6B',textTransform:'uppercase',marginBottom:20,fontWeight:700}}>Pagar {total}€ por Bizum</h2>

            <div style={S.card}>
                <div style={{background:'rgba(0,31,107,0.04)',borderRadius:10,padding:'10px 14px',marginBottom:16}}>
                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:1,color:'#001F6B',marginBottom:2}}>
                        {tipoPago==='inscripcion'?'Inscripción 26/27':'Jornada '+(tipoPago==='jornada_vip'?'VIP ':'')+jornadaSel}
                    </p>
                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'rgba(0,31,107,0.5)'}}>
                        Para: {jugadoresPagando.join(', ')}
                    </p>
                </div>

                {/* Paso 1: enviar el Bizum */}
                <div style={{background:'rgba(0,145,255,0.05)',border:'1px solid rgba(0,145,255,0.15)',borderRadius:14,padding:18,marginBottom:16,textAlign:'center'}}>
                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:13,letterSpacing:2,color:'#0091FF',textTransform:'uppercase',marginBottom:10}}>
                        1 · Envía {total}€ por Bizum a
                    </p>
                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:28,fontWeight:700,color:'#001F6B',letterSpacing:1,marginBottom:4}}>
                        {bizumInfo.telefono || '(número pendiente de configurar)'}
                    </p>
                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,31,107,0.5)',marginBottom:14}}>
                        {bizumInfo.nombre}
                    </p>
                    {bizumInfo.telefono && (
                        <button onClick={function() {
                            navigator.clipboard.writeText(bizumInfo.telefono);
                            setCopiado(true); setTimeout(function(){setCopiado(false);}, 2000);
                        }} style={{fontFamily:"'Teko',sans-serif",fontSize:13,letterSpacing:2,background:'#0091FF',color:'#fff',
                            border:'none',borderRadius:20,padding:'8px 20px',cursor:'pointer',textTransform:'uppercase'}}>
                            {copiado ? '✓ Copiado' : '📋 Copiar número'}
                        </button>
                    )}
                </div>

                {/* Paso 2: confirmar que se ha enviado */}
                <div style={{marginBottom:16}}>
                    <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',padding:'10px 4px'}}>
                        <input type="checkbox" checked={heEnviado} onChange={function(e){setHeEnviado(e.target.checked);}}
                            style={{width:20,height:20,accentColor:'#001F6B'}} />
                        <span style={{fontFamily:"'Inter',sans-serif",fontSize:13,color:'#001F6B'}}>
                            Ya he enviado el Bizum de {total}€
                        </span>
                    </label>
                </div>

                {error && <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'#e63946',marginBottom:12,textAlign:'center'}}>{error}</p>}

                <button onClick={confirmarEnvioBizum} disabled={!heEnviado} style={{...S.btnPrimary,opacity:heEnviado?1:0.5}}>
                    Confirmar pago →
                </button>

                <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'rgba(0,31,107,0.4)',textAlign:'center',marginTop:12,lineHeight:1.5}}>
                    Tu pago quedará "pendiente" hasta que {bizumInfo.nombre} lo confirme al verlo en el banco — normalmente el mismo día.
                </p>
            </div>
        </div>
    );

    // ── PROCESANDO ────────────────────────────────────────────────────────────
    if (paso === 'procesando') return (
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:60,textAlign:'center'}}>
            <div style={{fontSize:52,marginBottom:16}}>⏳</div>
            <p style={{fontFamily:"'Teko',sans-serif",fontSize:20,letterSpacing:3,color:'#001F6B',textTransform:'uppercase'}}>Guardando confirmación...</p>
        </div>
    );

    // ── OK ─────────────────────────────────────────────────────────────────
    if (paso === 'ok') return (
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:40,textAlign:'center'}}>
            <div style={{fontSize:64,marginBottom:16}}>✅</div>
            <p style={{fontFamily:"'Teko',sans-serif",fontSize:24,letterSpacing:3,color:'#001F6B',textTransform:'uppercase',marginBottom:8}}>¡Pago confirmado!</p>
            <p style={{fontFamily:"'Inter',sans-serif",fontSize:14,color:'rgba(0,31,107,0.6)',marginBottom:8,lineHeight:1.7}}>
                {total}€ pagados por {currentUser}
            </p>
            <p style={{fontFamily:"'Inter',sans-serif",fontSize:13,color:'rgba(0,31,107,0.5)',marginBottom:24,lineHeight:1.6}}>
                Para: <strong>{jugadoresPagando.join(', ')}</strong>
            </p>
            <button onClick={function(){setPaso('inicio');setJugadoresPagando([currentUser]);setJornadaSel('');}} style={{fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:2,background:'#001F6B',color:'#FFD700',border:'none',borderRadius:12,padding:'12px 28px',cursor:'pointer',textTransform:'uppercase'}}>
                Volver a pagos
            </button>
        </div>
    );

    return null;
};

// ============================================================================
// --- ESTADÍSTICAS ───────────────────────────────────────────────────────────
// ============================================================================
const EstadisticasScreen = ({ userProfiles, onlineUsers }) => {
    var G = styles.colors;
    var [clasificacion, setClasificacion] = useState([]);
    var [jornadas, setJornadas] = useState([]);
    var [historico, setHistorico] = useState(false);
    var [jugadoresInactivosEst, setJugadoresInactivosEst] = useState([]);

    useEffect(function() {
        var unsub = onSnapshot(collection(db, 'clasificacion'), function(snap) {
            var data = snap.docs.map(function(d) { return { id: d.id, ...d.data() }; });
            data.sort(function(a,b) { return (b.puntos||0)-(a.puntos||0); });
            setClasificacion(data);
        });
        return function(){unsub();};
    }, []);

    useEffect(function() {
        var unsub = onSnapshot(query(collection(db,'jornadas'),orderBy('numeroJornada','asc')),
            function(snap){setJornadas(snap.docs.map(function(d){return{id:d.id,...d.data()};}));});
        return function(){unsub();};
    }, []);

    useEffect(function() {
        var unsub = onSnapshot(doc(db, 'configuracion', 'jugadoresInactivos'), function(snap) {
            setJugadoresInactivosEst(snap.exists() ? (snap.data().nombres || []) : []);
        });
        return function(){unsub();};
    }, []);

    // Filtra a los que se han dado de baja — no deben aparecer en las
    // estadísticas de la temporada actual, solo ensucian la lista.
    var clasificacionActiva = clasificacion.filter(function(j) {
        return jugadoresInactivosEst.indexOf(j.id) === -1;
    });

    var medallaColor = ['#FFD700','#C0C0C0','#CD7F32'];

    return (
        <div style={{paddingBottom:40}}>
            <h2 style={{fontFamily:"'Teko',sans-serif",fontSize:22,letterSpacing:3,color:G.deepBlue,textTransform:'uppercase',marginBottom:16,fontWeight:700}}>
                📊 ESTADÍSTICAS
            </h2>
            <p style={{fontFamily:"'Teko',sans-serif",fontSize:12,letterSpacing:3,color:'rgba(0,31,107,0.4)',textTransform:'uppercase',marginBottom:10}}>
                Clasificación 26/27
            </p>
            <div style={{background:'#fff',border:'1px solid rgba(0,31,107,0.1)',borderRadius:16,overflow:'hidden',marginBottom:18}}>
                {clasificacion.length === 0 ? (
                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:13,color:'rgba(0,31,107,0.4)',padding:20,textAlign:'center'}}>
                        La clasificación se actualizará al cerrar la primera jornada
                    </p>
                ) : clasificacionActiva.map(function(j, idx) {
                    var online = onlineUsers && onlineUsers[j.id];
                    var perfil = userProfiles && userProfiles[j.id];
                    return (
                        <div key={j.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',
                            borderBottom:idx<clasificacion.length-1?'1px solid rgba(0,31,107,0.06)':'none',
                            background:idx===0?'rgba(255,215,0,0.04)':'#fff'}}>
                            <span style={{fontFamily:"'Teko',sans-serif",fontSize:20,fontWeight:700,
                                color:idx<3?medallaColor[idx]:'rgba(0,31,107,0.25)',minWidth:24,textAlign:'center'}}>
                                {idx<3?['🥇','🥈','🥉'][idx]:idx+1}
                            </span>
                            <div style={{width:34,height:34,borderRadius:'50%',background:'rgba(0,31,107,0.08)',
                                display:'flex',alignItems:'center',justifyContent:'center',
                                fontFamily:"'Teko',sans-serif",fontSize:16,color:G.deepBlue,flexShrink:0,
                                border:online?'2px solid #10b981':'2px solid transparent'}}>
                                {perfil&&perfil.emoji?perfil.emoji:(j.id||'?')[0].toUpperCase()}
                            </div>
                            <span style={{fontFamily:"'Teko',sans-serif",fontSize:18,color:G.deepBlue,letterSpacing:1,flex:1}}>{j.id}</span>
                            <div style={{textAlign:'right'}}>
                                <span style={{fontFamily:"'Teko',sans-serif",fontSize:22,fontWeight:700,color:G.deepBlue}}>{j.puntos||0}</span>
                                <span style={{fontFamily:"'Inter',sans-serif",fontSize:10,color:'rgba(0,31,107,0.4)',marginLeft:4}}>pts</span>
                            </div>
                        </div>
                    );
                })}
            </div>
            <button onClick={function(){setHistorico(function(h){return !h;});}}
                style={{width:'100%',background:'rgba(0,31,107,0.06)',border:'1px solid rgba(0,31,107,0.12)',
                    borderRadius:12,padding:'11px',fontFamily:"'Teko',sans-serif",fontSize:14,
                    letterSpacing:2,color:G.deepBlue,cursor:'pointer',textTransform:'uppercase',marginBottom:14}}>
                {historico?'▲ Ocultar':'▼ Ver'} historial de jornadas
            </button>
            {historico && jornadas.filter(function(j){return j.estado==='Finalizada';}).map(function(j) {
                return (
                    <div key={j.id} style={{background:'#fff',border:'1px solid rgba(0,31,107,0.1)',borderRadius:14,padding:'14px 16px',marginBottom:8}}>
                        <div style={{display:'flex',alignItems:'center',gap:10}}>
                            <span style={{fontFamily:"'Teko',sans-serif",fontSize:16,fontWeight:700,color:G.deepBlue,minWidth:28}}>J{j.numeroJornada}</span>
                            <span style={{fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:1,color:G.deepBlue,flex:1,textTransform:'uppercase'}}>{j.equipoLocal} {j.resultadoFinal||''} {j.equipoVisitante}</span>
                            {j.esVip&&<span style={{background:'rgba(255,215,0,0.15)',color:'#001F6B',border:'1px solid rgba(255,215,0,0.3)',borderRadius:8,padding:'2px 8px',fontFamily:"'Teko',sans-serif",fontSize:11}}>VIP</span>}
                        </div>
                        {j.ganadorBote&&<p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'#10b981',marginTop:4}}>🏆 Bote ganado por {j.ganadorBote}</p>}
                    </div>
                );
            })}
            {historico&&jornadas.filter(function(j){return j.estado==='Finalizada';}).length===0&&(
                <p style={{fontFamily:"'Inter',sans-serif",fontSize:13,color:'rgba(0,31,107,0.4)',textAlign:'center',padding:16}}>Aún no hay jornadas finalizadas</p>
            )}
        </div>
    );
};

// ============================================================================
// --- CALENDARIO ─────────────────────────────────────────────────────────────
// ============================================================================
const CalendarioScreen = ({ teamLogos }) => {
    var G = styles.colors;
    var [jornadas, setJornadas] = useState([]);
    var [loading, setLoading] = useState(true);

    useEffect(function() { 
        var q = query(collection(db, "jornadas"), orderBy("numeroJornada")); 
        var unsub = onSnapshot(q, function(snap) {
            setJornadas(snap.docs.map(function(d) { return { id: d.id, ...d.data() }; }));
            setLoading(false);
        }); 
        return function() { unsub(); };
    }, []);

    if (loading) return <LoadingSkeleton />;

    var estadoColor = function(estado) {
        if (estado === 'Abierta') return '#10b981';
        if (estado === 'En vivo') return '#e63946';
        if (estado === 'Finalizada') return G.deepBlue;
        return 'rgba(0,31,107,0.25)';
    };

    return (
        <div>
            <h2 style={styles.title}>CALENDARIO 26/27</h2>
            <div style={{display:'flex', flexDirection:'column', gap:8}}>
                {jornadas.map(function(j) {
                    var live = j.liveData;
                    var esFinalizada = j.estado === 'Finalizada';
                    var esVivo = j.estado === 'En vivo' || (live && live.isLive);
                    var tieneResultado = esFinalizada || (live && live.golesLocal !== null && live.golesLocal !== undefined);
                    var gLocal = esFinalizada ? j.resultadoLocal : (live ? live.golesLocal : null);
                    var gVis   = esFinalizada ? j.resultadoVisitante : (live ? live.golesVisitante : null);

                    return (
                        <div key={j.id} style={{
                            background: esVivo ? '#001F6B' : '#fff',
                            borderRadius: 14,
                            border: '1px solid ' + (esVivo ? 'transparent' : 'rgba(0,31,107,0.08)'),
                            padding: '14px 16px',
                            boxShadow: esVivo ? '0 4px 20px rgba(0,31,107,0.2)' : 'none',
                        }}>
                            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:tieneResultado?8:0}}>
                                <span style={{fontFamily:"'Teko',sans-serif",fontSize:13,fontWeight:700,
                                    color: esVivo ? 'rgba(255,255,255,0.4)' : 'rgba(0,31,107,0.35)',
                                    letterSpacing:2, minWidth:30}}>J{j.numeroJornada}</span>
                                <span style={{flex:1, fontFamily:"'Teko',sans-serif", fontSize:15, fontWeight:600,
                                    letterSpacing:1, textTransform:'uppercase',
                                    color: esVivo ? '#fff' : G.deepBlue}}>
                                    {j.equipoLocal} vs {j.equipoVisitante}
                                    {j.derbi && ' 🔥'}
                                </span>
                                {esVivo ? (
                                    <span style={{fontFamily:"'Teko',sans-serif",fontSize:12,letterSpacing:2,
                                        color:'#e63946',background:'rgba(230,57,70,0.15)',padding:'3px 10px',borderRadius:10,
                                        animation:'blink-live 1.5s infinite'}}>EN VIVO</span>
                                ) : (
                                    <span style={{fontFamily:"'Inter',sans-serif",fontSize:10,
                                        color: estadoColor(j.estado), background: estadoColor(j.estado) + '15',
                                        padding:'3px 10px',borderRadius:10}}>{j.estado}</span>
                                )}
                            </div>
                            <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,
                                color: esVivo ? 'rgba(255,255,255,0.35)' : 'rgba(0,31,107,0.4)',
                                marginBottom: tieneResultado ? 8 : 0}}>
                                {j.fecha} · {j.estadio}
                            </p>
                            {tieneResultado && (
                                <div style={{display:'flex', alignItems:'center', gap:12, marginTop:6}}>
                                    <span style={{fontFamily:"'Teko',sans-serif", fontSize:28, fontWeight:700,
                                        color: esVivo ? '#FFD700' : G.deepBlue, letterSpacing:2}}>
                                        {gLocal} — {gVis}
                                    </span>
                                    {(live && live.primerGoleador) && (
                                        <span style={{fontFamily:"'Inter',sans-serif",fontSize:11,
                                            color: esVivo ? 'rgba(255,255,255,0.5)' : 'rgba(0,31,107,0.4)'}}>
                                            ⚽ {live.primerGoleador}
                                        </span>
                                    )}
                                    {esFinalizada && j.ganadores && j.ganadores.length > 0 && (
                                        <span style={{fontFamily:"'Inter',sans-serif",fontSize:11,
                                            color:'#10b981', marginLeft:'auto'}}>
                                            🏆 {j.ganadores.join(', ')}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ============================================================================
// --- ADMINISTRADOR Y CIERRE ---
// ============================================================================
const AdminCierreTemporada = () => {
    // ─── DATOS REALES CONFIRMADOS EN FIREBASE ─────────────────────────────────
    // porraAnualPronosticos → campo "ascenso": "NO"/"SI", campo "posicion": "8" etc.
    // apuestasExtra         → campo "equipo": "Málaga CF" / "CD Castellón" etc.
    // UDLP acabó 5ª y NO ascendió. Málaga CF ascendió por playoff.
    // ──────────────────────────────────────────────────────────────────────────
    const UDLP_POSICION_FINAL = '5';
    const UDLP_ASCENDIO = false;   // UDLP NO ascendió

    // Lista de equipos que se consideran "Málaga" en cualquier formato de Firebase
    const esMalaga = (equipo) => {
        const e = (equipo || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        return e.includes('MALAGA') || e.includes('MLAGA');
    };

    const [procesando, setProcesando] = useState(false);
    const [diagnostico, setDiagnostico] = useState(null);
    const [cargandoDiag, setCargandoDiag] = useState(false);

    // ── PASO 1: DIAGNÓSTICO ───────────────────────────────────────────────────
    const handleDiagnostico = async () => {
        setCargandoDiag(true);
        try {
            // A. Clasificación actual (puntos acumulados hasta ahora en Firebase)
            const clasifSnap = await getDocs(collection(db, "clasificacion"));
            const clasifActual = {};
            clasifSnap.forEach(d => { clasifActual[d.id] = d.data(); });

            // B. Última jornada finalizada y sus pronósticos
            const jornadasSnap = await getDocs(query(
                collection(db, "jornadas"),
                where("estado", "==", "Finalizada"),
                orderBy("numeroJornada", "desc"),
                limit(1)
            ));
            let ultimaJornada = null;
            let pronosticosUltima = {};
            if (!jornadasSnap.empty) {
                ultimaJornada = { id: jornadasSnap.docs[0].id, ...jornadasSnap.docs[0].data() };
                const pSnap = await getDocs(collection(db, "pronosticos", ultimaJornada.id, "jugadores"));
                pSnap.forEach(d => { pronosticosUltima[d.id] = d.data(); });
            }

            // C. Porra Anual — colección CONFIRMADA: "porraAnualPronosticos"
            const anualSnap = await getDocs(collection(db, "porraAnualPronosticos"));
            const apuestasAnuales = {};
            anualSnap.forEach(d => { apuestasAnuales[d.id] = d.data(); });

            // D. El Camino — colección: "apuestasExtra"
            const extraSnap = await getDocs(collection(db, "apuestasExtra"));
            const apuestasExtra = {};
            extraSnap.forEach(d => { apuestasExtra[d.id] = d.data(); });
            // Jugadores sin doc en apuestasExtra pero que sabemos apostaron Málaga
            ['Carlos', 'Carmelo', 'José'].forEach(n => {
                if (!apuestasExtra[n]) apuestasExtra[n] = { equipo: 'Málaga CF' };
            });

            // E. Preparar datos de la última jornada para calcular puntos
            const resL = parseInt(ultimaJornada?.resultadoLocal);
            const resV = parseInt(ultimaJornada?.resultadoVisitante);
            const golReal = (ultimaJornada?.goleador || '').trim().toLowerCase();
            const esVipU = ultimaJornada?.esVip || false;
            let rReal = '';
            if (ultimaJornada) {
                if (ultimaJornada.equipoLocal === "UD Las Palmas")
                    rReal = resL > resV ? 'gana' : (resL < resV ? 'pierde' : 'empate');
                else if (ultimaJornada.equipoVisitante === "UD Las Palmas")
                    rReal = resV > resL ? 'gana' : (resV < resL ? 'pierde' : 'empate');
                else
                    rReal = resL > resV ? 'gana' : (resL < resV ? 'pierde' : 'empate');
            }

            // F. Calcular para cada jugador qué puntos EXTRA faltan sumar
            //    IMPORTANTE: los puntos de la última jornada ya están en clasificación
            //    según me confirmas. Los detectamos comparando puntosObtenidos en el pronóstico.
            const filas = JUGADORES_BASE.map(userId => {
                const clasif = clasifActual[userId] || {};
                const totalActual = clasif.puntosTotales || 0;

                // ── F1. ¿Los puntos de la última jornada ya están sumados? ──
                // Los pronósticos guardan puntosObtenidos. Si > 0, ya se sumaron a clasificación.
                // Si = 0, hay que calcularlos y sumarlos.
                const pronU = pronosticosUltima[userId];
                const ptosJornadaEnPron = Number(pronU?.puntosObtenidos) || 0;
                let ptosJornada = 0; let ptosExacto = 0; let ptosGol = 0;
                let jornadaYaSumada = ptosJornadaEnPron > 0;

                if (ultimaJornada && pronU && !jornadaYaSumada) {
                    // Calcular desde cero
                    if (parseInt(pronU.golesLocal) === resL && parseInt(pronU.golesVisitante) === resV) {
                        ptosExacto = esVipU ? 6 : 3;
                    }
                    ptosJornada += ptosExacto;
                    if (check1x2(pronU.resultado1x2, rReal, ultimaJornada.tipoPartido, ultimaJornada.desenlace))
                        ptosJornada += esVipU ? 2 : 1;
                    const golAp = (pronU.goleador || '').trim().toLowerCase();
                    if (resL > 0 || resV > 0 || golReal === 'sg') {
                        if (pronU.sinGoleador && golReal === 'sg') ptosGol += 1;
                        else if (!pronU.sinGoleador && golAp !== '' && golAp === golReal && golReal !== 'sg')
                            ptosGol += esVipU ? 4 : 2;
                    }
                    ptosJornada += ptosGol;
                }

                // ── F2. El Camino (+5): ¿apostó por Málaga (el ascendido)? ──
                // INDEPENDIENTE de puntosExtraSumados — calculamos siempre si lo merece
                // y luego en handleAplicarCierre solo sumamos si no está ya en desgloseExtra
                let ptsCamino = 0;
                const equipoExtra = apuestasExtra[userId]?.equipo || '';
                if (esMalaga(equipoExtra)) ptsCamino = 5;

                // ── F3. Porra Anual ──
                // Campos reales: "ascenso" = "NO"/"SI", "posicion" = "8" etc.
                let ptsAnual = 0;
                let motivoAnual = '';
                const ap = apuestasAnuales[userId];
                if (ap) {
                    const ascRaw = String(ap.ascenso || ap.asciende || '').toUpperCase().trim();
                    const jugadorDijoSube = ascRaw === 'SI' || ascRaw === 'SÍ' || ascRaw === 'YES' || ascRaw === 'TRUE';
                    const aciertoAsciende = jugadorDijoSube === UDLP_ASCENDIO; // ambos false = correcto
                    const posRaw = String(ap.posicion || '').trim();
                    const aciertoPosicion = posRaw === UDLP_POSICION_FINAL;
                    if (aciertoAsciende && aciertoPosicion) {
                        ptsAnual = 20; motivoAnual = `+20 Pleno (pos.${posRaw} + No asciende ✓)`;
                    } else if (aciertoPosicion) {
                        ptsAnual = 10; motivoAnual = `+10 Posición ${posRaw}ª ✓`;
                    } else if (aciertoAsciende) {
                        ptsAnual = 5; motivoAnual = `+5 Ascenso (apostó ${jugadorDijoSube ? 'Sí' : 'No'} ✓)`;
                    }
                }

                // ── F4. ¿Qué está ya sumado en Firebase (desgloseExtra)? ──
                const desgloseActual = clasif.desgloseExtra || '';
                const caminoYaSumado = desgloseActual.includes('Camino') || desgloseActual.includes('camino');
                const anualYaSumado = desgloseActual.includes('Anual') || desgloseActual.includes('anual') || desgloseActual.includes('Pleno');

                // ── F5. Total real a añadir ahora ──
                let ptsAñadir = 0;
                let desglose = [];

                if (!jornadaYaSumada && ptosJornada > 0) {
                    ptsAñadir += ptosJornada;
                    desglose.push(`+${ptosJornada} pts jornada final`);
                } else if (jornadaYaSumada) {
                    desglose.push(`✓ Jornada (${ptosJornadaEnPron} pts ya sumados)`);
                }

                if (!caminoYaSumado && ptsCamino > 0) {
                    ptsAñadir += ptsCamino;
                    desglose.push(`+5 El Camino (${equipoExtra} ✓)`);
                } else if (caminoYaSumado) {
                    desglose.push(`✓ Camino ya sumado`);
                }

                if (!anualYaSumado && ptsAnual > 0) {
                    ptsAñadir += ptsAnual;
                    desglose.push(motivoAnual);
                } else if (anualYaSumado) {
                    desglose.push(`✓ Anual ya sumado`);
                }

                return {
                    userId, totalActual, ptsAñadir,
                    totalFinal: totalActual + ptsAñadir,
                    desglose,
                    // Para aplicar cierre:
                    ptosJornada, ptosExacto, ptosGol, jornadaYaSumada,
                    ptsCamino, caminoYaSumado,
                    ptsAnual, anualYaSumado, motivoAnual,
                    // Para mostrar en tabla:
                    apuestaAnual: ap || null,
                    apuestaExtra: apuestasExtra[userId] || null,
                    pronU,
                };
            });

            setDiagnostico({ filas, ultimaJornada, resL, resV });
        } catch(e) {
            console.error(e);
            alert("Error al cargar diagnóstico: " + e.message);
        }
        setCargandoDiag(false);
    };

    // ── PASO 2: APLICAR CIERRE ────────────────────────────────────────────────
    const handleAplicarCierre = async () => {
        if (!diagnostico) return;
        const hayPendientes = diagnostico.filas.some(f => f.ptsAñadir > 0);
        if (!hayPendientes) { alert("No hay puntos pendientes de sumar según el diagnóstico."); return; }

        const resumen = diagnostico.filas.filter(f => f.ptsAñadir > 0).map(f =>
            `${f.userId}: +${f.ptsAñadir} pts → ${f.desglose.filter(d => !d.includes('✓ Jornada') && !d.includes('ya sumado')).join(', ')}`
        ).join('\n');

        if (!window.confirm(`¿Confirmas aplicar los siguientes puntos en Firebase?\n\n${resumen}\n\nSolo se suman los que faltan. Los ya sumados no se tocan.`)) return;

        setProcesando(true);
        try {
            const batch = writeBatch(db);
            const { filas, ultimaJornada } = diagnostico;

            for (const f of filas) {
                if (f.ptsAñadir === 0) continue;

                const clasifRef = doc(db, "clasificacion", f.userId);
                let nuevosDesgloses = [];

                // Solo sumar jornada si no estaba ya
                if (!f.jornadaYaSumada && f.ptosJornada > 0) {
                    batch.update(doc(db, "pronosticos", ultimaJornada.id, "jugadores", f.userId), {
                        puntosObtenidos: f.ptosJornada,
                        puntosResultadoExacto: f.ptosExacto,
                        puntosGoleador: f.ptosGol,
                    });
                }

                // Construir desglose de extras (Camino + Anual) para guardar
                if (!f.caminoYaSumado && f.ptsCamino > 0) nuevosDesgloses.push(`+${f.ptsCamino} El Camino`);
                if (!f.anualYaSumado && f.ptsAnual > 0) nuevosDesgloses.push(f.motivoAnual);

                // Actualizar clasificación: sumar lo que falta al total actual
                const updateData = { puntosTotales: f.totalFinal };
                if (nuevosDesgloses.length > 0) {
                    updateData.desgloseExtra = nuevosDesgloses.join(' | ');
                    updateData.puntosExtraSumados = (f.ptsCamino || 0) + (f.ptsAnual || 0);
                }
                batch.update(clasifRef, updateData);
            }

            if (ultimaJornada) {
                batch.update(doc(db, "jornadas", ultimaJornada.id), { puntosCalculados: true });
            }

            await batch.commit();
            await handleDiagnostico(); // Recargar para confirmar
            alert("✅ ¡CIERRE COMPLETADO! Todos los puntos han sido guardados en Firebase.\n\nRecarga el diagnóstico para confirmar que todo está en '✓ ya sumado'.");
        } catch(e) {
            console.error(e);
            alert("Error al aplicar el cierre: " + e.message);
        }
        setProcesando(false);
    };

    // ── RESET TOTAL ───────────────────────────────────────────────────────────
    const handleResetTotal = async () => {
        if (!window.confirm("⚠️ PELIGRO: Esto borrará desgloseExtra y puntosExtraSumados de la clasificación, y pondrá a 0 los puntos de la última jornada en los pronósticos. Úsalo solo si algo salió mal.")) return;
        setProcesando(true);
        try {
            const batch = writeBatch(db);
            const clasifSnap = await getDocs(collection(db, "clasificacion"));
            clasifSnap.forEach(d => {
                const data = d.data();
                const extra = data.puntosExtraSumados || 0;
                if (extra > 0 || data.desgloseExtra) {
                    batch.update(doc(db, "clasificacion", d.id), {
                        puntosTotales: Math.max(0, (data.puntosTotales || 0) - extra),
                        puntosExtraSumados: 0,
                        desgloseExtra: '',
                    });
                }
            });
            if (diagnostico?.ultimaJornada) {
                const pSnap = await getDocs(collection(db, "pronosticos", diagnostico.ultimaJornada.id, "jugadores"));
                pSnap.forEach(d => {
                    batch.update(doc(db, "pronosticos", diagnostico.ultimaJornada.id, "jugadores", d.id), {
                        puntosObtenidos: 0, puntosResultadoExacto: 0, puntosGoleador: 0,
                    });
                });
                batch.update(doc(db, "jornadas", diagnostico.ultimaJornada.id), { puntosCalculados: false });
            }
            await batch.commit();
            setDiagnostico(null);
            alert("✅ Reset completo. Recarga el diagnóstico para empezar de cero.");
        } catch(e) {
            console.error(e);
            alert("Error al resetear: " + e.message);
        }
        setProcesando(false);
    };

    const hayPendientes = diagnostico?.filas?.some(f => f.ptsAñadir > 0);

    return (
        <div style={{padding: '25px', backgroundColor: 'rgba(230,57,70,0.08)', border: `1px solid ${styles.colors.danger}`, borderRadius: '16px', marginBottom: '30px'}}>
            <h3 style={{fontFamily: "'Oswald', sans-serif", color: styles.colors.danger, marginBottom: '5px', fontSize: '1.3rem'}}>🚨 CIERRE DE TEMPORADA DEFINITIVO</h3>
            <p style={{color: styles.colors.silver, fontSize: '0.85rem', marginBottom: '20px'}}>
                Datos fijos: <strong style={{color: styles.colors.golden}}>UDLP no ascendió · Posición 5ª · Campeón playoff: Málaga CF</strong>
            </p>

            {/* PASO 1 */}
            <button onClick={handleDiagnostico} disabled={cargandoDiag || procesando} style={{...styles.secondaryButton, width: '100%', marginBottom: '20px', padding: '14px'}}>
                {cargandoDiag ? '⏳ LEYENDO FIREBASE...' : '🔍 PASO 1: CARGAR DIAGNÓSTICO DESDE FIREBASE'}
            </button>

            {/* TABLA DE DIAGNÓSTICO */}
            {diagnostico && (
                <div style={{marginBottom: '20px'}}>
                    <p style={{color: styles.colors.silver, fontSize: '0.8rem', marginBottom: '10px'}}>
                        Última jornada detectada: <strong style={{color: '#fff'}}>{diagnostico.ultimaJornada?.equipoLocal} vs {diagnostico.ultimaJornada?.equipoVisitante}</strong> — Resultado: <strong style={{color: styles.colors.golden}}>{diagnostico.resL}-{diagnostico.resV}</strong> — Goleador: <strong style={{color: styles.colors.golden}}>{diagnostico.ultimaJornada?.goleador || 'SG'}</strong>
                    </p>
                    <div style={{overflowX: 'auto'}}>
                        <table style={{...styles.table, marginTop: '5px', fontSize: '0.82rem'}}>
                            <thead>
                                <tr>
                                    <th style={{...styles.th, fontSize: '0.75rem'}}>JUGADOR</th>
                                    <th style={{...styles.th, fontSize: '0.75rem', textAlign:'center'}}>PTS AHORA</th>
                                    <th style={{...styles.th, fontSize: '0.75rem', textAlign:'center'}}>A SUMAR</th>
                                    <th style={{...styles.th, fontSize: '0.75rem', textAlign:'center'}}>TOTAL FINAL</th>
                                    <th style={{...styles.th, fontSize: '0.75rem'}}>DESGLOSE</th>
                                </tr>
                            </thead>
                            <tbody>
                                {diagnostico.filas
                                    .sort((a,b) => b.totalFinal - a.totalFinal)
                                    .map(f => (
                                    <tr key={f.userId} style={{...styles.tr, backgroundColor: f.ptsAñadir > 0 ? 'rgba(212,175,55,0.08)' : 'rgba(0,0,0,0.2)'}}>
                                        <td style={styles.td}><strong style={{color: f.ptsAñadir > 0 ? styles.colors.golden : styles.colors.silver}}>{f.userId}</strong></td>
                                        <td style={{...styles.td, textAlign:'center', color: styles.colors.silver}}>{f.totalActual}</td>
                                        <td style={{...styles.td, textAlign:'center', fontWeight:'bold', color: f.ptsAñadir > 0 ? styles.colors.success : styles.colors.silver}}>
                                            {f.ptsAñadir > 0 ? `+${f.ptsAñadir}` : '—'}
                                        </td>
                                        <td style={{...styles.td, textAlign:'center', fontFamily:"'Oswald', sans-serif", fontSize:'1.1rem', color: styles.colors.golden, fontWeight:'bold'}}>{f.totalFinal}</td>
                                        <td style={{...styles.td, fontSize:'0.75rem', color: styles.colors.silver}}>
                                            {f.desglose.length > 0 ? f.desglose.join(' · ') : (f.extraYaSumado > 0 ? '✅ Ya sumado' : 'Sin puntos extra')}
                                            {f.apuestaAnual && <span style={{display:'block', color:'rgba(255,255,255,0.4)', marginTop:'3px'}}>
                                                Anuales: pos.{f.apuestaAnual.posicion} / ascenso: {String(f.apuestaAnual.ascenso || f.apuestaAnual.asciende || '?')}
                                            </span>}
                                            {f.apuestaExtra && <span style={{display:'block', color:'rgba(255,255,255,0.4)', marginTop:'2px'}}>
                                                Camino: {f.apuestaExtra.equipo}
                                            </span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* PASO 2 */}
                    {hayPendientes ? (
                        <button onClick={handleAplicarCierre} disabled={procesando} style={{...styles.mainButton, width: '100%', marginTop: '20px', background: `linear-gradient(135deg, #c0392b, #e74c3c)`}}>
                            {procesando ? '⏳ APLICANDO PUNTOS EN FIREBASE...' : '✅ PASO 2: APLICAR CIERRE Y GUARDAR EN FIREBASE'}
                        </button>
                    ) : (
                        <div style={{marginTop: '20px', padding: '15px', backgroundColor: 'rgba(16,185,129,0.1)', border: `1px solid ${styles.colors.success}`, borderRadius: '12px', textAlign: 'center'}}>
                            <p style={{color: styles.colors.success, fontWeight: 'bold'}}>✅ Todos los puntos ya están sumados correctamente. No hay nada pendiente.</p>
                        </div>
                    )}

                    {/* RESET */}
                    <div style={{marginTop: '15px', textAlign: 'center'}}>
                        <button onClick={handleResetTotal} disabled={procesando} style={{...styles.secondaryButton, fontSize: '0.75rem', borderColor: styles.colors.danger, color: styles.colors.danger}}>
                            ↩ DESHACER TODO EL CIERRE (solo si algo salió mal)
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================================================
// --- CÁLCULO AUTOMÁTICO DE ESTRELLAS — vía API-Football (fixtures/players) ---
// Se dispara al finalizar una jornada desde el panel admin. Aislado del
// cálculo de puntos de la porra principal: si falla, no afecta a esos puntos.
// ============================================================================
// Función pura: calcula los puntos de Estrellas de toda la plantilla a partir
// de las estadísticas de la API para un fixture, en cualquier momento (en vivo
// o finalizado). Reutilizada tanto por el cálculo definitivo (admin, al cerrar
// la jornada) como por la estimación en directo durante el partido.
function calcularPuntosPlantillaDesdeStats(statsPorApiId, plantilla, porteriaACero) {
    var jugadoresSinApiId = [];
    var puntosPorNombre = {};

    plantilla.forEach(function(jug) {
        if (!jug.apiId) { jugadoresSinApiId.push(jug.nombre); puntosPorNombre[jug.nombre] = 0; return; }
        var st = statsPorApiId[jug.apiId];
        if (!st) { puntosPorNombre[jug.nombre] = 0; return; } // no convocado / no jugó (todavía)

        var pts = 0;
        var minutos = (st.games && st.games.minutes) || 0;
        var titular = !!(st.games && st.games.substitute === false && minutos > 0);
        var suplenteJugo = !!(st.games && st.games.substitute === true && minutos > 0);

        if (titular) pts += 2;
        else if (suplenteJugo) pts += 1;

        var goles = (st.goals && st.goals.total) || 0;
        if (goles > 0) {
            var ptsPorGol = (jug.posicion === 'Portero' || jug.posicion === 'Defensa') ? 8
                : (jug.posicion === 'Centrocampista' || jug.posicion === 'Mediapunta') ? 6 : 5;
            pts += goles * ptsPorGol;
        }

        var asistencias = (st.goals && st.goals.assists) || 0;
        pts += asistencias * 3;

        var amarillas = (st.cards && st.cards.yellow) || 0;
        var rojas = (st.cards && st.cards.red) || 0;
        pts -= amarillas * 1;
        pts -= rojas * 3;

        var penFallado = (st.penalty && st.penalty.missed) || 0;
        pts -= penFallado * 2;

        if (jug.posicion === 'Portero') {
            var penParado = (st.penalty && st.penalty.saved) || 0;
            pts += penParado * 5;
            var paradas = (st.goals && st.goals.saves) || 0;
            pts += paradas * 1;
        }

        if (porteriaACero && minutos > 0) {
            if (jug.posicion === 'Portero') pts += 4;
            else if (jug.posicion === 'Defensa') pts += 2;
        }

        // Nota: robo de balón al último hombre, recuperaciones y pases interceptados
        // no vienen en la API — no se pueden calcular automáticamente.

        puntosPorNombre[jug.nombre] = pts;
    });

    return { puntosPorNombre: puntosPorNombre, jugadoresSinApiId: jugadoresSinApiId };
}

async function calcularEstrellasJornada(jornadaId, fixtureId, plantilla, jornadaInfo) {
    if (!fixtureId) throw new Error('Esta jornada no tiene fixtureId guardado. Sincroniza con la API (botón de sincronización) mientras el partido está en juego o recién acabado, y vuelve a intentarlo.');
    if (!API_FOOTBALL_KEY) throw new Error('Falta configurar REACT_APP_API_FOOTBALL_KEY en el entorno.');

    var url = 'https://v3.football.api-sports.io/fixtures/players?fixture=' + fixtureId;
    var res = await fetch(url, { headers: { 'x-apisports-key': API_FOOTBALL_KEY } });
    var data = await res.json();
    if (!data.response || data.response.length === 0) {
        throw new Error('La API no tiene todavía las estadísticas de jugadores de este partido. Suele tardar unos minutos tras el pitido final — reinténtalo con "Recalcular Estrellas".');
    }

    // Mapa apiId -> estadísticas del jugador en este partido concreto
    var statsPorApiId = {};
    data.response.forEach(function(equipo) {
        (equipo.players || []).forEach(function(p) {
            statsPorApiId[p.player.id] = (p.statistics && p.statistics[0]) || {};
        });
    });

    // ¿Portería a 0 de la UDLP en este partido? (Solo tiene sentido para nuestra plantilla)
    var udlpEsLocal = jornadaInfo.equipoLocal === 'UD Las Palmas';
    var golesEncajados = parseInt(udlpEsLocal ? jornadaInfo.resultadoVisitante : jornadaInfo.resultadoLocal);
    var porteriaACero = golesEncajados === 0;

    var calculo = calcularPuntosPlantillaDesdeStats(statsPorApiId, plantilla, porteriaACero);
    var puntosPorNombre = calculo.puntosPorNombre;
    var jugadoresSinApiId = calculo.jugadoresSinApiId;

    // Leer la selección de 5 estrellas de cada jugador y sumar sus puntos
    var seleccionesSnap = await getDocs(collection(db, "estrellas_seleccion", jornadaId, "jugadores"));
    var batch = writeBatch(db);
    var resumen = [];

    seleccionesSnap.forEach(function(docSnap) {
        var userId = docSnap.id;
        var sel = docSnap.data().jugadores || [];
        var total = 0;
        var detalle = sel.map(function(j) {
            var pts = puntosPorNombre[j.nombre] || 0;
            total += pts;
            return { nombre: j.nombre, puntos: pts };
        });

        batch.set(doc(db, "clasificacion_estrellas", userId), {
            puntosEstrellas: increment(total)
        }, { merge: true });

        batch.set(doc(db, "estrellas_resultados", jornadaId, "jugadores", userId), {
            puntosJornada: total, detalle: detalle, calculadoEn: serverTimestamp()
        });

        resumen.push({ userId: userId, total: total });
    });

    await batch.commit();

    if (jugadoresSinApiId.length > 0) {
        console.warn('Estrellas: estos jugadores no tienen apiId y no se pudieron calcular automáticamente:', jugadoresSinApiId);
    }
    return { resumen: resumen, jugadoresSinApiId: jugadoresSinApiId };
}

const JornadaAdminItem = ({ jornada, plantilla = [] }) => {
    const [estado, setEstado] = useState(jornada.estado);
    const [resultadoLocal, setResultadoLocal] = useState(jornada.resultadoLocal === undefined ? '' : jornada.resultadoLocal);
    const [resultadoVisitante, setResultadoVisitante] = useState(jornada.resultadoVisitante === undefined ? '' : jornada.resultadoVisitante);
    const [esVip, setEsVip] = useState(jornada.esVip || false);
    const [tipoPartido, setTipoPartido] = useState(jornada.tipoPartido || 'ida');
    const [h2hInfo, setH2hInfo] = useState(jornada.h2hInfo || '');
    const [goleador, setGoleador] = useState(jornada.goleador || '');
    const [bote, setBote] = useState(jornada.bote || 0);
    const [desenlace, setDesenlace] = useState(jornada.desenlace || '');
    // FIX: estado local para puntosCalculados, se actualiza correctamente tras reset y tras guardar
    const [puntosYaCalculados, setPuntosYaCalculados] = useState(jornada.puntosCalculados || false);
    
    const toInputFormat = (date) => { if (!date || !date.seconds) return ''; const d = new Date(date.seconds * 1000); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
    
    const [fechaApertura, setFechaApertura] = useState(toInputFormat(jornada.fechaApertura));
    const [fechaCierre, setFechaCierre] = useState(toInputFormat(jornada.fechaCierre));
    const [fechaPartido, setFechaPartido] = useState(toInputFormat(jornada.fechaPartido));

    const [isUnlocked, setIsUnlocked] = useState(jornada.estado !== 'Finalizada');
    const [liveData, setLiveData] = useState({ golesLocal: 0, golesVisitante: 0, primerGoleador: '', isLive: false });

    useEffect(() => { if (jornada.liveData) { setLiveData({ ...jornada.liveData }); } }, [jornada.liveData]);

    // --- NUEVO: FUNCIÓN PARA DESHACER EL CÁLCULO DE PUNTOS DE LA JORNADA ---
    const handleResetPuntos = async () => {
        if (!puntosYaCalculados) { alert("Esta jornada no ha sumado puntos en la clasificación, no hay nada que resetear."); return; }
        if (!window.confirm("⚠️ PELIGRO: Esto RESTARÁ a la Clasificación General los puntos exactos que se dieron en esta jornada y la abrirá de nuevo. ¿Continuar?")) return;
        
        try {
            const batch = writeBatch(db);
            const pSnap = await getDocs(collection(db, "pronosticos", jornada.id, "jugadores"));
            const clasifSnap = await getDocs(collection(db, "clasificacion"));
            let clasifActual = {};
            clasifSnap.forEach(d => clasifActual[d.id] = d.data());

            pSnap.forEach(docSnap => {
                const p = docSnap.data();
                const userId = docSnap.id;
                
                const ptsASustraer = p.puntosObtenidos || 0;
                const exactosASustraer = p.puntosResultadoExacto || 0;

                if (ptsASustraer > 0 || exactosASustraer > 0) {
                    const cTotal = clasifActual[userId]?.puntosTotales || 0;
                    const cExactos = clasifActual[userId]?.puntosResultadoExacto || 0;
                    batch.update(doc(db, "clasificacion", userId), { 
                        puntosTotales: Math.max(0, cTotal - ptsASustraer), 
                        puntosResultadoExacto: Math.max(0, cExactos - exactosASustraer) 
                    });
                }
                
                batch.update(doc(db, "pronosticos", jornada.id, "jugadores", userId), { puntosObtenidos: 0, puntosResultadoExacto: 0, puntosGoleador: 0 });
            });

            batch.update(doc(db, "jornadas", jornada.id), { puntosCalculados: false });
            await batch.commit();
            setPuntosYaCalculados(false); // FIX: actualizar estado local para que handleSaveChanges funcione bien
            alert("✅ PUNTOS BORRADOS DE LA GENERAL. La jornada ya no está calculada. Modifica lo que necesites y vuelve a 'Guardar Todos Los Cambios'.");
            setIsUnlocked(true);
        } catch(error) { console.error(error); alert("Error al resetear."); }
    };

    const handleSaveChanges = async () => {
        const jornadaRef = doc(db, "jornadas", jornada.id);
        let ganadoresArray = [];
        
        // --- INYECCIÓN AUTOMÁTICA CLAUDIO (Jornada 44) ---
        if (jornada.numeroJornada === 44) {
            const claudioRef = doc(db, "pronosticos", jornada.id, "jugadores", "Claudio");
            const claudioDoc = await getDoc(claudioRef);
            if (!claudioDoc.exists()) {
                await setDoc(claudioRef, { 
                    golesLocal: 3, 
                    golesVisitante: 2, 
                    resultado1x2: "No Pasa UD Las Palmas", 
                    sinGoleador: true, 
                    goleador: "", 
                    lastUpdated: serverTimestamp() 
                });
            }
        }

        const batch = writeBatch(db);
        
        if (estado === 'Finalizada' && resultadoLocal !== '' && resultadoVisitante !== '') {
            
            if (puntosYaCalculados) {
                if (!window.confirm("Los puntos de esta jornada ya fueron repartidos. Si vas a corregir algo, pulsa 'CANCELAR', dale al botón rojo de 'RESETEAR PUNTOS' y luego vuelve a guardar.")) return;
            }

            const resL = parseInt(resultadoLocal);
            const resV = parseInt(resultadoVisitante);
            
            let rReal = '';
            if (jornada.equipoLocal === "UD Las Palmas") { rReal = resL > resV ? 'gana' : (resL < resV ? 'pierde' : 'empate'); } 
            else if (jornada.equipoVisitante === "UD Las Palmas") { rReal = resV > resL ? 'gana' : (resV < resL ? 'pierde' : 'empate'); } 
            else { rReal = resL > resV ? 'gana' : (resL < resV ? 'pierde' : 'empate'); }

            const golReal = (goleador || '').trim().toLowerCase();

            const pSnap = await getDocs(collection(db, "pronosticos", jornada.id, "jugadores"));
            const clasifSnap = await getDocs(collection(db, "clasificacion"));
            let clasifActual = {};
            clasifSnap.forEach(d => clasifActual[d.id] = d.data());

            // --- PAGO POR JORNADA: quién ha pagado ESTA jornada en concreto.
            // Sin pagar, su resultado no cuenta al cerrar — se le avisa en su
            // pantalla, pero la comprobación real de verdad pasa por aquí.
            const jornadaCodigoActual = 'J' + jornada.numeroJornada;
            const pagosSnap = await getDocs(collection(db, "pagos"));
            var jugadoresQueHanPagadoEstaJornada = {};
            pagosSnap.forEach(function(d) {
                var pg = d.data();
                if (pg.jornada === jornadaCodigoActual &&
                    (pg.tipo === 'jornada_normal' || pg.tipo === 'jornada_vip') &&
                    pg.estado !== 'cancelado' && pg.estado !== 'rechazado' && pg.estado !== 'fallido') {
                    jugadoresQueHanPagadoEstaJornada[pg.jugador] = true;
                }
            });

            // --- EL OTRO EQUIPO: precargar resultados de los partidos activados ---
            // Aislado del resto — si la API falla aquí, los puntos normales de la
            // porra se calculan igual, solo que sin el efecto de El Otro.
            var fixtureIdsUnicos = [];
            pSnap.forEach(function(d) {
                var pd = d.data();
                if (pd.elOtroActivado && pd.elOtroFixtureId && fixtureIdsUnicos.indexOf(pd.elOtroFixtureId) === -1) {
                    fixtureIdsUnicos.push(pd.elOtroFixtureId);
                }
            });
            var resultadosFixtureOtro = {}; // fixtureId -> {finalizado, golesLocal, golesVisitante, nombreLocal, nombreVisitante}
            for (var fi = 0; fi < fixtureIdsUnicos.length; fi++) {
                try {
                    var resF = await fetch('https://v3.football.api-sports.io/fixtures?id=' + fixtureIdsUnicos[fi],
                        { headers: { 'x-apisports-key': API_FOOTBALL_KEY } });
                    var dataF = await resF.json();
                    if (dataF.response && dataF.response[0]) {
                        var fx = dataF.response[0];
                        var estCorto = fx.fixture.status.short;
                        resultadosFixtureOtro[fixtureIdsUnicos[fi]] = {
                            finalizado: estCorto === 'FT' || estCorto === 'AET' || estCorto === 'PEN',
                            golesLocal: fx.goals.home, golesVisitante: fx.goals.away,
                            nombreLocal: fx.teams.home.name, nombreVisitante: fx.teams.away.name,
                        };
                    }
                } catch (eF) { console.warn('Error obteniendo resultado de El Otro, fixture', fixtureIdsUnicos[fi], eF.message); }
            }
            // Activaciones actuales de cada jugador que activó El Otro esta jornada,
            // para saber qué multiplicador (×2 / ×2.5 / ×3) le corresponde ANTES de sumar esta.
            var elOtroDataUsuarios = {};
            var usuariosConOtroActivado = [];
            pSnap.forEach(function(d) {
                var pd = d.data();
                if (pd.elOtroActivado && pd.elOtroFixtureId) usuariosConOtroActivado.push(d.id);
            });
            for (var ui = 0; ui < usuariosConOtroActivado.length; ui++) {
                try {
                    var snapU = await getDoc(doc(db, "elOtro", usuariosConOtroActivado[ui]));
                    if (snapU.exists()) elOtroDataUsuarios[usuariosConOtroActivado[ui]] = snapU.data();
                } catch (eU) { console.warn('Error leyendo elOtro de', usuariosConOtroActivado[ui], eU.message); }
            }

            // --- NUEVA NORMA: el multiplicador acumulado decae si te saltas
            // una jornada sin activar El Otro. No decae por perder, solo por
            // no activar — así no se castiga doblemente a quien tiene un
            // equipo flojo (ya arriesga más al activar; si además decayera
            // al perder, sería un castigo extra injusto). Se comprueba para
            // TODOS los que ya tienen equipo elegido, no solo los que
            // apostaron esta jornada, para pillar también a quien ni
            // siquiera entró a la app.
            if (!puntosYaCalculados) {
                try {
                    var todosConEquipoSnap = await getDocs(collection(db, "elOtro"));
                    todosConEquipoSnap.forEach(function(d) {
                        var datosJ = d.data();
                        if (!datosJ.equipo) return; // sin equipo elegido, no aplica
                        var activoEstaJornada = usuariosConOtroActivado.indexOf(d.id) !== -1;
                        if (!activoEstaJornada && (datosJ.activaciones || 0) > 0) {
                            batch.set(doc(db, "elOtro", d.id), {
                                activaciones: 0,
                                historial: arrayUnion({
                                    jornada: jornada.numeroJornada, tipo: 'decaido',
                                    motivo: 'No activó esta jornada — el multiplicador acumulado vuelve a ×2',
                                }),
                            }, { merge: true });
                        }
                    });
                } catch (eDecay) { console.warn('Error aplicando la norma de decaimiento del multiplicador:', eDecay.message); }
            }

            pSnap.forEach(docSnap => {
                const p = docSnap.data();
                const userId = docSnap.id;
                let isWinner = false;
                let ptosJornada = 0; let ptosExacto = 0; let ptosGol = 0;

                // PAGO POR JORNADA: si no ha pagado esta jornada en concreto,
                // su resultado no cuenta — se guarda a 0 puntos con el motivo,
                // para que quede claro en el historial por qué no puntuó.
                const haPagadoEstaJornada = !!jugadoresQueHanPagadoEstaJornada[userId];
                if (!haPagadoEstaJornada) {
                    if (!puntosYaCalculados) {
                        batch.update(doc(db, "pronosticos", jornada.id, "jugadores", userId), {
                            puntosObtenidos: 0, puntosResultadoExacto: 0, puntosGoleador: 0,
                            noContabilizado: true, motivoNoContabilizado: 'Jornada no pagada por Bizum',
                        });
                    }
                    return; // no suma nada a clasificación, no entra en ganadores
                }

                // 1. EXACTO
                if (parseInt(p.golesLocal) === resL && parseInt(p.golesVisitante) === resV) {
                    isWinner = true; ptosExacto += esVip ? 6 : 3;
                }
                if (isWinner) ganadoresArray.push(userId);
                ptosJornada += ptosExacto;

                // 2. SOLUCIÓN PASA/NO PASA Y GANA/PIERDE CON EL COMPROBADOR FLEXIBLE
                if (check1x2(p.resultado1x2, rReal, tipoPartido, desenlace)) {
                    ptosJornada += esVip ? 2 : 1;
                }

                // 3. GOLEADOR
                const golAp = (p.goleador || '').trim().toLowerCase();
                if (resL > 0 || resV > 0 || golReal === "sg") {
                    if (p.sinGoleador && golReal === "sg") { ptosGol += 1; } 
                    else if (!p.sinGoleador && golAp !== "" && golAp === golReal && golReal !== "sg") { ptosGol += esVip ? 4 : 2; }
                }
                ptosJornada += ptosGol;

                // 4. EL OTRO EQUIPO — multiplica o divide el total de ESTA jornada
                // según el resultado real de su partido. Solo si se activó, con
                // fixture guardado, y ese partido ya ha terminado de verdad.
                if (p.elOtroActivado && p.elOtroFixtureId && p.elOtroEquipoUsado && !puntosYaCalculados) {
                    var resFx = resultadosFixtureOtro[p.elOtroFixtureId];
                    if (resFx && resFx.finalizado) {
                        var esLocalOtro = nombresSonSimilares(resFx.nombreLocal, p.elOtroEquipoUsado);
                        var golesFavor = esLocalOtro ? resFx.golesLocal : resFx.golesVisitante;
                        var golesContra = esLocalOtro ? resFx.golesVisitante : resFx.golesLocal;
                        var resultadoOtro = golesFavor > golesContra ? 'gana' : (golesFavor < golesContra ? 'pierde' : 'empate');
                        var activacionesPrevias = (elOtroDataUsuarios[userId] && elOtroDataUsuarios[userId].activaciones) || 0;
                        var multOtro = getMultiplicadorOtro(activacionesPrevias);
                        var ptosAntesOtro = ptosJornada;
                        ptosJornada = aplicarMultiplicadorOtro(ptosJornada, resultadoOtro, multOtro);

                        batch.set(doc(db, "elOtro", userId), {
                            activaciones: increment(1),
                            historial: arrayUnion({
                                jornada: jornada.numeroJornada, equipo: p.elOtroEquipoUsado,
                                resultado: resultadoOtro, multiplicador: multOtro,
                                ptosAntes: ptosAntesOtro, ptosDespues: ptosJornada,
                            }),
                        }, { merge: true });
                    }
                }

                if (!puntosYaCalculados) {
                    batch.update(doc(db, "pronosticos", jornada.id, "jugadores", userId), { puntosObtenidos: ptosJornada, puntosResultadoExacto: ptosExacto, puntosGoleador: ptosGol });
                    const cTotal = clasifActual[userId]?.puntosTotales || 0;
                    const cExactos = clasifActual[userId]?.puntosResultadoExacto || 0;
                    batch.update(doc(db, "clasificacion", userId), { puntosTotales: cTotal + ptosJornada, puntosResultadoExacto: cExactos + ptosExacto });
                }
            });
        }

        const updateData = { 
            estado, resultadoLocal, resultadoVisitante, esVip, tipoPartido, h2hInfo, goleador, desenlace, bote: parseFloat(bote) || 0,
            fechaApertura: fechaApertura ? new Date(fechaApertura) : null, fechaCierre: fechaCierre ? new Date(fechaCierre) : null, fechaPartido: fechaPartido ? new Date(fechaPartido) : null 
        };

        if (estado === 'Finalizada') {
            updateData.ganadores = ganadoresArray;
            if (!puntosYaCalculados) { updateData.puntosCalculados = true; setPuntosYaCalculados(true); } // FIX: actualizar estado local
        }

        batch.update(jornadaRef, updateData);
        await batch.commit();

        // --- Estrellas: cálculo automático vía API-Football, aislado del flujo principal ---
        // Si algo falla aquí (API caída, jugador sin apiId, etc.) NO debe tocar los puntos
        // de la porra principal, que ya se guardaron arriba.
        if (estado === 'Finalizada' && !puntosYaCalculados) {
            try {
                await calcularEstrellasJornada(jornada.id, jornada.fixtureId, plantilla, {
                    equipoLocal: jornada.equipoLocal, equipoVisitante: jornada.equipoVisitante,
                    resultadoLocal: resultadoLocal, resultadoVisitante: resultadoVisitante
                });
            } catch(e) {
                console.error('Error calculando Estrellas:', e);
                alert('⚠️ Los puntos de la porra se guardaron bien, pero hubo un error calculando las Estrellas: ' + e.message + '\n\nPuedes reintentarlo con el botón "Recalcular Estrellas".');
            }
        }

        if (estado === 'Finalizada' && !puntosYaCalculados) alert('¡JORNADA FINALIZADA! Puntos sumados.'); else alert('Jornada guardada.');
    };

    // Recalcula solo las Estrellas de esta jornada (botón manual, por si la API
    // no estaba lista al finalizar, o para corregir tras un ajuste).
    const handleRecalcularEstrellas = async () => {
        if (!jornada.fixtureId) { alert('Esta jornada no tiene fixtureId guardado — sincroniza primero con la API mientras el partido esté en juego o recién acabado.'); return; }
        if (!window.confirm('Esto va a sumar (otra vez) los puntos de Estrellas de esta jornada a la clasificación. Si ya se calcularon antes, se duplicarán. ¿Seguro que no se han calculado todavía?')) return;
        try {
            await calcularEstrellasJornada(jornada.id, jornada.fixtureId, plantilla, {
                equipoLocal: jornada.equipoLocal, equipoVisitante: jornada.equipoVisitante,
                resultadoLocal: jornada.resultadoLocal, resultadoVisitante: jornada.resultadoVisitante
            });
            alert('✅ Estrellas recalculadas.');
        } catch(e) {
            alert('❌ Error: ' + e.message);
        }
    };

    const handleUpdateLiveState = async () => {
        const jornadaRef = doc(db, "jornadas", jornada.id);
        await updateDoc(jornadaRef, { estado: 'En vivo', desenlace: desenlace, liveData: { golesLocal: parseInt(liveData.golesLocal) || 0, golesVisitante: parseInt(liveData.golesVisitante) || 0, primerGoleador: liveData.primerGoleador, isLive: true } });
        alert('Marcador en vivo actualizado');
    };

    if (!isUnlocked) {
        return (
            <div style={{...styles.adminJornadaItem, display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.05)', borderColor: 'rgba(16,185,129,0.3)'}}>
                <div><span style={{fontWeight: 'bold', color: styles.colors.success, fontFamily: "'Oswald', sans-serif", letterSpacing: '1px'}}>✓ {getNombreJornada(jornada.numeroJornada)}: {jornada.equipoLocal} vs {jornada.equipoVisitante}</span> <span style={{color: styles.colors.silver, fontSize: '0.8rem'}}>(Finalizada)</span></div>
                <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
                    <button onClick={handleRecalcularEstrellas} style={{...styles.secondaryButton, padding: '6px 12px', fontSize: '0.75rem', borderColor: '#d4a017', color: '#d4a017'}}>⭐ RECALCULAR ESTRELLAS</button>
                    <button onClick={handleResetPuntos} style={{...styles.secondaryButton, padding: '6px 12px', fontSize: '0.75rem', borderColor: styles.colors.danger, color: styles.colors.danger}}>RESETEAR PUNTOS</button>
                    <button onClick={() => setIsUnlocked(true)} style={{...styles.secondaryButton, padding: '6px 12px', fontSize: '0.75rem'}}>Desbloquear</button>
                </div>
            </div>
        )
    }

    return (
        <div style={styles.adminJornadaItem}>
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '20px', borderBottom: `1px solid rgba(255,215,0,0.2)`, paddingBottom: '15px'}}>
                <p style={{fontSize: '1.3rem', color: styles.colors.golden, fontFamily: "'Oswald', sans-serif", letterSpacing: '1px', textTransform: 'uppercase'}}><strong>{getNombreJornada(jornada.numeroJornada)}: {jornada.equipoLocal} vs {jornada.equipoVisitante}</strong></p>
                <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}><label style={{color: styles.colors.silver, fontWeight: 'bold', fontSize: '0.9rem'}}>⭐ VIP</label><input type="checkbox" checked={esVip} onChange={(e) => setEsVip(e.target.checked)} style={styles.checkbox}/></div>
            </div>
            
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px'}}>
                <div><label style={styles.label}>Estado:</label><select value={estado} onChange={(e) => setEstado(e.target.value)} style={styles.adminSelect}><option value="Próximamente">Próximamente</option><option value="Pre-apertura">Pre-apertura</option><option value="Abierta">Abierta</option><option value="Cerrada">Cerrada</option><option value="En vivo">En vivo</option><option value="Finalizada">Finalizada</option></select></div>
                <div><label style={styles.label}>Tipo Eliminatoria:</label><select value={tipoPartido} onChange={(e) => setTipoPartido(e.target.value)} style={styles.adminSelect}><option value="ida">Liga / Ida (1X2)</option><option value="vuelta_semi">Vuelta Semi (Pasa/No pasa)</option><option value="vuelta_final">Vuelta Final (Asciende)</option></select></div>
                
                {(tipoPartido === 'vuelta_semi' || tipoPartido === 'vuelta_final') && (
                    <div><label style={styles.label}>NUEVO: Desenlace Real (Para puntuar):</label><select value={desenlace} onChange={(e) => setDesenlace(e.target.value)} style={{...styles.adminSelect, borderColor: styles.colors.warning}}><option value="">-- Elige qué pasó --</option><option value="Pasa UD Las Palmas">Pasa UDLP</option><option value="No Pasa UD Las Palmas">No Pasa UDLP</option><option value="Asciende UD Las Palmas">Asciende UDLP</option><option value="No Asciende UD Las Palmas">No Asciende</option></select></div>
                )}

                <div><label style={styles.label}>Apertura Apuestas:</label><input type="datetime-local" value={fechaApertura} onChange={(e) => setFechaApertura(e.target.value)} style={styles.input} /></div>
                <div><label style={styles.label}>Cierre Apuestas:</label><input type="datetime-local" value={fechaCierre} onChange={(e) => setFechaCierre(e.target.value)} style={styles.input} />
                    <button type="button" onClick={async function() {
                        if (!jornada.fecha) { alert('Pon primero la fecha del partido en el campo de arriba.'); return; }
                        try {
                            var fmt2 = function(d) { return d.toISOString().slice(0,10); };
                            var url = 'https://v3.football.api-sports.io/fixtures?league=141&season=2026&date=' + fmt2(new Date(jornada.fecha)) + '&team=' + API_TEAM_ID_UDLP;
                            var res = await fetch(url, { headers: { 'x-apisports-key': API_FOOTBALL_KEY } });
                            var data = await res.json();
                            if (data.response && data.response.length > 0) {
                                var kickoff = new Date(data.response[0].fixture.date);
                                kickoff.setMinutes(kickoff.getMinutes() - 5);
                                setFechaCierre(toInputFormat(kickoff));
                                alert('✅ Cierre establecido 5 min antes del kickoff: ' + kickoff.toLocaleString('es-ES', {timeZone:'Atlantic/Canary'}));
                            } else {
                                alert('No se encontró partido de la UDLP ese día en la API.');
                            }
                        } catch(e) { alert('Error consultando API: ' + e.message); }
                    }} style={{fontFamily:"'Teko',sans-serif",fontSize:11,letterSpacing:1,background:'rgba(0,31,107,0.06)',color:'#001F6B',border:'1px solid rgba(0,31,107,0.15)',borderRadius:8,padding:'4px 10px',cursor:'pointer',marginLeft:6}}>
                        ⏱️ Auto (API)
                    </button>
                </div>
                <div><label style={styles.label}>Fecha Partido (H.Canaria):</label><input type="datetime-local" value={fechaPartido} onChange={(e) => setFechaPartido(e.target.value)} style={styles.input} /></div>
                
                <div style={{gridColumn: '1 / -1'}}><label style={styles.label}>Historial vs Rival (Info Previa):</label><input type="text" value={h2hInfo} onChange={(e) => setH2hInfo(e.target.value)} placeholder="Ej: UDLP 2-1 Málaga" style={styles.input} /></div>
                <div><label style={styles.label}>BOTE INICIAL (€):</label><input type="number" value={bote} onChange={(e) => setBote(e.target.value)} style={styles.input} /></div>

                <div style={{backgroundColor: 'rgba(0,0,0,0.4)', padding: '15px', borderRadius: '12px', border: `1px solid rgba(255,255,255,0.05)`}}>
                    <label style={{...styles.label, color: styles.colors.golden}}>Resultado Final (Oficial):</label>
                    <div style={{display: 'flex', gap: '15px', alignItems: 'center'}}>
                        <input type="number" value={resultadoLocal} onChange={(e) => setResultadoLocal(e.target.value)} style={{...styles.input, width: '70px', textAlign: 'center', fontSize: '1.2rem', fontFamily: "'Oswald', sans-serif"}} placeholder="L" />
                        <span style={styles.separator}>-</span>
                        <input type="number" value={resultadoVisitante} onChange={(e) => setResultadoVisitante(e.target.value)} style={{...styles.input, width: '70px', textAlign: 'center', fontSize: '1.2rem', fontFamily: "'Oswald', sans-serif"}} placeholder="V" />
                    </div>
                </div>
                <div style={{backgroundColor: 'rgba(0,0,0,0.4)', padding: '15px', borderRadius: '12px', border: `1px solid rgba(255,255,255,0.05)`}}>
                    <label style={{...styles.label, color: styles.colors.golden}}>Primer Goleador (Final):</label>
                    <select value={goleador} onChange={(e) => setGoleador(e.target.value)} style={styles.adminSelect}><option value="">-- Elige --</option><option value="SG">Sin Goleador (SG)</option>{plantilla.sort((a,b)=>a.nombre.localeCompare(b.nombre)).map(j => <option key={j.nombre} value={j.nombre}>{j.nombre}</option>)}</select>
                </div>
            </div>
            
            <button onClick={handleSaveChanges} style={{...styles.saveButton, width: '100%', marginTop: '25px'}}>GUARDAR TODOS LOS CAMBIOS</button>

            {(estado === 'Cerrada' || estado === 'En vivo') && (
                <div style={styles.liveAdminContainer}>
                    <h4 style={{color: styles.colors.danger, textTransform: 'uppercase', marginBottom: '20px', fontFamily: "'Oswald', sans-serif", letterSpacing: '1px'}}>🔴 Control de Partido En Vivo</h4>
                    <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '20px', alignItems: 'end'}}>
                        <div><label style={{color: styles.colors.silver, fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '8px', display: 'block'}}>Goles Local</label><input type="number" value={liveData.golesLocal} onChange={e => setLiveData({...liveData, golesLocal: parseInt(e.target.value) || 0})} style={{...styles.input, textAlign: 'center', fontSize: '1.2rem', fontFamily: "'Oswald', sans-serif"}} /></div>
                        <div><label style={{color: styles.colors.silver, fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '8px', display: 'block'}}>Goles Visitante</label><input type="number" value={liveData.golesVisitante} onChange={e => setLiveData({...liveData, golesVisitante: parseInt(e.target.value) || 0})} style={{...styles.input, textAlign: 'center', fontSize: '1.2rem', fontFamily: "'Oswald', sans-serif"}} /></div>
                        <div style={{gridColumn: '1 / -1'}}><label style={{color: styles.colors.silver, fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '8px', display: 'block'}}>Primer Goleador</label><select value={liveData.primerGoleador} onChange={e => setLiveData({...liveData, primerGoleador: e.target.value})} style={styles.adminSelect}><option value="">-</option><option value="SG">SG</option>{plantilla.map(j => <option key={j.nombre} value={j.nombre}>{j.nombre}</option>)}</select></div>
                        <button onClick={handleUpdateLiveState} style={{...styles.saveButton, backgroundColor: styles.colors.danger, gridColumn: '1 / -1'}}>ACTUALIZAR MARCADOR VIVO</button>
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================================================
// --- ADMIN PANEL SCREEN — Panel de control completo 26/27 ---
// ============================================================================
// (STRIPE_PK eliminada — se sustituyó Stripe por Bizum, ver configuración en el panel admin)

// Herramienta admin: una sola llamada a API-Football para listar los IDs
// reales de toda la plantilla del UDLP — para rellenar los apiId:0 que faltan
// en PLANTILLA_FALLBACK y que el cálculo automático de Estrellas les alcance.
const ADMIN_STYLES = {
    card: { background:'#fff', border:'1px solid rgba(0,31,107,0.1)', borderRadius:14, padding:16, marginBottom:12 },
    btnPrimary: { background:'#001F6B', color:'#FFD700', border:'none', borderRadius:10, padding:'11px 20px', fontFamily:"'Teko',sans-serif", fontSize:14, letterSpacing:2, cursor:'pointer', textTransform:'uppercase' },
    btnSuccess: { background:'#10b981', color:'#fff', border:'none', borderRadius:8, padding:'6px 12px', fontFamily:"'Teko',sans-serif", fontSize:12, letterSpacing:1, cursor:'pointer' },
    btnDanger: { background:'#e63946', color:'#fff', border:'none', borderRadius:8, padding:'6px 12px', fontFamily:"'Teko',sans-serif", fontSize:12, letterSpacing:1, cursor:'pointer' },
};

const BuscadorApiIdsPlantilla = ({ plantilla }) => {
    var [resultado, setResultado] = useState(null);
    var [buscando, setBuscando] = useState(false);
    var [errorMsg, setErrorMsg] = useState('');

    var consultarPlantillaActual = async function() {
        // /players/squads da la plantilla REGISTRADA actual directamente — a
        // diferencia de /players?season=, que solo devuelve algo si el
        // jugador ya tiene estadísticas de partidos jugados esa temporada
        // (por eso fallaba justo ahora, con la liga recién empezada).
        var url = 'https://v3.football.api-sports.io/players/squads?team=' + API_TEAM_ID_UDLP;
        var res = await fetch(url, { headers: { 'x-apisports-key': API_FOOTBALL_KEY } });
        var data = await res.json();
        var response = data.response || [];
        if (response.length === 0) return [];
        return (response[0].players || []).map(function(p) {
            return { nombre: p.name, id: p.id, foto: p.photo };
        });
    };

    var buscar = async function() {
        if (!API_FOOTBALL_KEY) { setErrorMsg('Falta configurar REACT_APP_API_FOOTBALL_KEY.'); return; }
        setBuscando(true); setErrorMsg(''); setResultado(null);
        try {
            var apiPorNombre = await consultarPlantillaActual();
            if (apiPorNombre.length === 0) {
                setErrorMsg('La API no devolvió la plantilla. Puede que el equipo aún no esté vinculado correctamente en API-Football para esta temporada.');
                setBuscando(false); return;
            }
            // Cruce con nuestra plantilla, tolerante a acentos/mayúsculas —
            // antes "José" con tilde no cruzaba contra un "Jose" sin tilde
            // que a veces devuelve la API.
            var cruce = plantilla.map(function(jug) {
                var match = apiPorNombre.find(function(a) {
                    return nombresSonSimilares(a.nombre, jug.nombre);
                });
                var fotoActual = jug.apiId ? ('https://media.api-sports.io/football/players/' + jug.apiId + '.png') : null;
                return {
                    nombre: jug.nombre, apiIdActual: jug.apiId, fotoActual: fotoActual,
                    apiIdEncontrado: match ? match.id : null, nombreApi: match ? match.nombre : null,
                    fotoEncontrada: match ? match.foto : null,
                    posibleConflicto: !!(jug.apiId && match && match.id !== jug.apiId),
                };
            });
            setResultado(cruce);
        } catch(e) {
            setErrorMsg('Error consultando la API: ' + e.message);
        }
        setBuscando(false);
    };

    return (
        <div style={ADMIN_STYLES.card}>
            <p style={{fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:2,color:'#001F6B',textTransform:'uppercase',marginBottom:4,fontWeight:600}}>
                🔍 Buscar y verificar IDs de API-Football (para Estrellas)
            </p>
            <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,31,107,0.5)',marginBottom:12,lineHeight:1.5}}>
                Comprueba TODOS los jugadores, no solo los que faltan — así puedes ver con tus propios ojos si alguna foto o ID de sesiones anteriores está mal asignado. Compara "Tienes ahora" con "La API dice" antes de copiar nada.
            </p>
            <button onClick={buscar} disabled={buscando} style={ADMIN_STYLES.btnPrimary}>
                {buscando ? 'Consultando API...' : 'Buscar y verificar ahora'}
            </button>
            {errorMsg && <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'#e63946',marginTop:10}}>{errorMsg}</p>}
            {resultado && (
                <div style={{marginTop:14,background:'rgba(0,31,107,0.03)',borderRadius:8,overflow:'hidden'}}>
                    {resultado.map(function(r) {
                        var sinIdAntes = !r.apiIdActual || r.apiIdActual === 0;
                        return (
                            <div key={r.nombre} style={{padding:'10px 12px',borderBottom:'1px solid rgba(0,31,107,0.06)',
                                background: r.posibleConflicto ? 'rgba(230,57,70,0.06)' : (sinIdAntes && r.apiIdEncontrado ? 'rgba(16,185,129,0.06)' : 'transparent')}}>
                                <p style={{fontFamily:"'Teko',sans-serif",fontSize:14,color:'#001F6B',marginBottom:6,fontWeight:600}}>
                                    {r.nombre} {r.posibleConflicto && <span style={{color:'#e63946',fontSize:11}}>⚠️ ID distinto al que tienes — revisar</span>}
                                </p>
                                <div style={{display:'flex',gap:16,alignItems:'center'}}>
                                    <div style={{textAlign:'center'}}>
                                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:9,color:'rgba(0,31,107,0.4)',marginBottom:3,textTransform:'uppercase'}}>Tienes ahora</p>
                                        {r.fotoActual ? (
                                            <img src={r.fotoActual} alt="" style={{width:44,height:44,borderRadius:'50%',objectFit:'cover',border:'2px solid rgba(0,31,107,0.15)'}}
                                                onError={function(e){e.target.style.opacity=0.2;}} />
                                        ) : (
                                            <div style={{width:44,height:44,borderRadius:'50%',background:'rgba(0,31,107,0.06)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:'rgba(0,31,107,0.3)'}}>sin ID</div>
                                        )}
                                    </div>
                                    <span style={{color:'rgba(0,31,107,0.25)',fontSize:16}}>→</span>
                                    <div style={{textAlign:'center'}}>
                                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:9,color:'rgba(0,31,107,0.4)',marginBottom:3,textTransform:'uppercase'}}>La API dice</p>
                                        {r.fotoEncontrada ? (
                                            <img src={r.fotoEncontrada} alt="" style={{width:44,height:44,borderRadius:'50%',objectFit:'cover',border: r.posibleConflicto ? '2px solid #e63946' : '2px solid #10b981'}} />
                                        ) : (
                                            <div style={{width:44,height:44,borderRadius:'50%',background:'rgba(230,57,70,0.08)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:'#e63946'}}>?</div>
                                        )}
                                    </div>
                                    <div style={{flex:1}}>
                                        {r.apiIdEncontrado ? (
                                            <span style={{fontFamily:"'Teko',sans-serif",fontSize:13,color: sinIdAntes ? '#10b981' : (r.posibleConflicto ? '#e63946' : 'rgba(0,31,107,0.4)')}}>
                                                apiId: {r.apiIdEncontrado}<br/>
                                                <span style={{fontSize:11,opacity:.7}}>{r.nombreApi}</span>
                                            </span>
                                        ) : (
                                            <span style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'#e63946'}}>No encontrado en la API — revisar manualmente</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'rgba(0,31,107,0.4)',padding:'8px 12px'}}>
                        Compara las dos fotos de cada fila. Si la de "La API dice" es la persona correcta, copia ese apiId a PLANTILLA_FALLBACK en el código. La coincidencia de nombre es automática por apellido — puede fallar con apodos o nombres compuestos, así que la foto es la comprobación real.
                    </p>
                </div>
            )}
        </div>
    );
};

// Admin: gestiona los huecos de bajas voluntarias en El Otro Equipo — cada
// baja es su PROPIO registro independiente y permanente (antes era un único
// documento que se pisaba con cada baja nueva: si Pedro se iba y Óscar lo
// sustituía, y luego se marcaba la baja de Carmelo, la sustitución de Óscar
// se perdía y Pedro "reaparecía". Ahora cada baja vive en su propio
// documento — Óscar queda fijo en el puesto de Pedro para siempre, y
// Carmelo es un hueco totalmente aparte, sin tocar lo de Pedro/Óscar.
// Admin: rastrea en tiempo real quién tiene el turno activo en El Otro
// Equipo y cuánto tiempo efectivo le queda (respetando la pausa nocturna,
// igual que el cronómetro real de la app) — para tener visibilidad sin
// tener que entrar a la pantalla de El Otro Equipo como jugador.
// Admin: botón de "desatasco" manual para El Otro Equipo. Si el sistema se
// queda parado (por ejemplo, porque a nadie se le ha ocurrido abrir la app
// para que el cronómetro de alguien arranque o se compruebe), esto salta al
// jugador actual y ARRANCA YA MISMO el cronómetro de 60 minutos del
// siguiente — sin esperar a que esa persona abra la app para que empiece a
// contar. Usa el mismo cálculo de orden que la pantalla del jugador
// (calcularOrdenElOtro / calcularTurnoElOtro), así nunca se contradicen.
// Admin: muestra la jornada completa de Primera División de un vistazo —
// todos los partidos con fecha y hora, para verificar visualmente que la
// información que usa El Otro Equipo (el partido de cada jugador, según su
// equipo elegido) es correcta, sin tener que consultar equipo por equipo.
// Esto afecta a todos los jugadores que tengan equipo elegido en El Otro —
// cuantos más elijan, más falta hace poder verlo todo junto.
// Admin: verificación real y visual de si los apiId de la plantilla
// realmente enlazan con la API — en vez de fiarnos de palabra, esto pide un
// partido concreto (el fixtureId, autodetectado de la última jornada si ya
// se sincronizó) y cruza cada jugador de la plantilla contra las
// estadísticas reales de ESE partido, mostrando encontrado/no encontrado
// con datos de verdad, no una suposición.
const VerificarEstadisticasJugadoresAdmin = ({ plantilla }) => {
    var [fixtureIdInput, setFixtureIdInput] = useState('');
    var [resultado, setResultado] = useState(null);
    var [cargando, setCargando] = useState(false);
    var [errorMsg, setErrorMsg] = useState('');

    useEffect(function() {
        var cargarJornadaReciente = async function() {
            try {
                var q = query(collection(db, 'jornadas'), orderBy('numeroJornada', 'desc'), limit(1));
                var snap = await getDocs(q);
                if (!snap.empty) {
                    var j = snap.docs[0].data();
                    if (j.fixtureId) setFixtureIdInput(String(j.fixtureId));
                }
            } catch (e) { console.warn('No se pudo autodetectar el fixtureId:', e.message); }
        };
        cargarJornadaReciente();
    }, []);

    var verificar = async function() {
        if (!fixtureIdInput.trim()) { setErrorMsg('Escribe o autodetecta un fixtureId antes de comprobar.'); return; }
        if (!API_FOOTBALL_KEY) { setErrorMsg('Falta configurar REACT_APP_API_FOOTBALL_KEY.'); return; }
        setCargando(true); setErrorMsg(''); setResultado(null);
        try {
            var url = 'https://v3.football.api-sports.io/fixtures/players?fixture=' + fixtureIdInput.trim();
            var res = await fetch(url, { headers: { 'x-apisports-key': API_FOOTBALL_KEY } });
            var data = await res.json();
            var response = data.response || [];
            if (response.length === 0) {
                setErrorMsg('La API no devolvió estadísticas para ese partido — normal si todavía no se ha jugado. Si ya terminó y sigue vacío, comprueba el fixtureId.');
                setCargando(false); return;
            }
            var bloqueUdlp = response.find(function(eq) { return eq.team && eq.team.id === API_TEAM_ID_UDLP; });
            var jugadoresApi = bloqueUdlp ? bloqueUdlp.players : [];

            var cruce = plantilla.map(function(jug) {
                var match = jugadoresApi.find(function(pj) { return pj.player.id === jug.apiId; });
                var stats = match && match.statistics && match.statistics[0];
                return {
                    nombre: jug.nombre, apiId: jug.apiId,
                    encontrado: !!match,
                    nombreApi: match ? match.player.name : null,
                    minutos: stats ? stats.games.minutes : null,
                    goles: stats ? stats.goals.total : null,
                };
            });

            setResultado({ totalJugadoresApi: jugadoresApi.length, cruce: cruce, equipoEncontrado: !!bloqueUdlp, nombreEquipoApi: bloqueUdlp ? bloqueUdlp.team.name : null });
        } catch (e) {
            setErrorMsg('Error consultando la API: ' + e.message);
        }
        setCargando(false);
    };

    return (
        <div style={ADMIN_STYLES.card}>
            <p style={{fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:2,color:'#001F6B',textTransform:'uppercase',marginBottom:4,fontWeight:600}}>
                🔬 Verificar enlace real: plantilla ↔ estadísticas API
            </p>
            <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,31,107,0.5)',marginBottom:14,lineHeight:1.5}}>
                Prueba de verdad, con un partido real: pega el ID de un partido ya jugado (o deja el autodetectado de la última jornada) y te enseño, jugador por jugador, si tu plantilla encuentra sus estadísticas reales en la API o no. Esto es justo lo que usa el cálculo de Estrellas por debajo.
            </p>

            <div style={{display:'flex',gap:8,marginBottom:14}}>
                <input value={fixtureIdInput} onChange={function(e){setFixtureIdInput(e.target.value);}} placeholder="fixtureId (ej: 1569878)"
                    style={{flex:1,padding:'8px 12px',border:'1px solid rgba(0,31,107,0.15)',borderRadius:8,fontFamily:"'Inter',sans-serif",fontSize:12}} />
                <button onClick={verificar} disabled={cargando} style={ADMIN_STYLES.btnPrimary}>
                    {cargando ? 'Consultando...' : 'Verificar'}
                </button>
            </div>

            {errorMsg && <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'#e63946',marginBottom:12}}>{errorMsg}</p>}

            {resultado && (
                <div>
                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color: resultado.equipoEncontrado ? '#10b981' : '#e63946',marginBottom:10}}>
                        {resultado.equipoEncontrado
                            ? '✅ Encontrado el equipo en ese partido: "' + resultado.nombreEquipoApi + '" con ' + resultado.totalJugadoresApi + ' jugadores con estadísticas.'
                            : '❌ En ese partido no aparece ningún equipo con el ID ' + API_TEAM_ID_UDLP + ' — revisa el fixtureId.'}
                    </p>
                    <div style={{display:'flex',flexDirection:'column',gap:6}}>
                        {resultado.cruce.map(function(r) {
                            return (
                                <div key={r.nombre} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',
                                    background: r.encontrado ? 'rgba(16,185,129,0.06)' : 'rgba(230,57,70,0.06)',borderRadius:8,flexWrap:'wrap'}}>
                                    <span style={{fontSize:14}}>{r.encontrado ? '✅' : '❌'}</span>
                                    <span style={{fontFamily:"'Teko',sans-serif",fontSize:13,color:'#001F6B',width:130,flexShrink:0}}>{r.nombre}</span>
                                    <span style={{fontFamily:"'Inter',sans-serif",fontSize:10,color:'rgba(0,31,107,0.4)'}}>apiId: {r.apiId || '(sin poner)'}</span>
                                    {r.encontrado && (
                                        <span style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'rgba(0,31,107,0.6)'}}>
                                            {r.nombreApi} · {r.minutos ?? 0}' jugados · {r.goles || 0} goles
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'rgba(0,31,107,0.4)',marginTop:10}}>
                        Los que salgan en rojo o sin apiId no van a puntuar en Estrellas hasta que les pongas su ID real desde "Buscar y verificar IDs" más abajo.
                    </p>
                </div>
            )}
        </div>
    );
};

const InfoJornadaPrimeraAdmin = () => {
    var [partidos, setPartidos] = useState([]);
    var [cargando, setCargando] = useState(false);
    var [errorMsg, setErrorMsg] = useState('');
    var [ultimaConsulta, setUltimaConsulta] = useState(null);

    var cargar = async function() {
        setCargando(true);
        setErrorMsg('');
        try {
            var resultado = await buscarJornadaCompletaPrimera(new Date().toISOString(), 5);
            if (resultado.length === 0) {
                setErrorMsg('No se encontraron partidos de Primera en esta ventana de fechas (±5 días). Puede que no haya jornada esta semana, o que la temporada aún no esté cargada en la API.');
            }
            setPartidos(resultado);
            setUltimaConsulta(new Date());
        } catch (e) {
            setErrorMsg('Error consultando la API: ' + e.message);
        }
        setCargando(false);
    };

    useEffect(function() { cargar(); }, []);

    return (
        <div style={ADMIN_STYLES.card}>
            <p style={{fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:2,color:'#001F6B',textTransform:'uppercase',marginBottom:4,fontWeight:600}}>
                🗓️ Jornada de Primera División
            </p>
            <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,31,107,0.5)',marginBottom:14,lineHeight:1.5}}>
                Todos los partidos de Primera en los próximos días — esto es lo que usa la app para saber cuándo tiene que activarse El Otro Equipo de cada jugador (antes de que empiece el partido de SU equipo, no de una fecha genérica).
            </p>

            <button onClick={cargar} disabled={cargando} style={{...ADMIN_STYLES.btnPrimary, marginBottom: 14}}>
                {cargando ? 'Consultando API...' : '↻ Actualizar'}
            </button>

            {errorMsg && <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'#e63946',marginBottom:12}}>{errorMsg}</p>}

            {partidos.length > 0 && (
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                    {partidos.map(function(p) {
                        var fechaObj = new Date(p.fecha);
                        var fechaTexto = fechaObj.toLocaleString('es-ES', {weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit', timeZone:'Atlantic/Canary'});
                        return (
                            <div key={p.fixtureId} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:'rgba(0,31,107,0.02)',borderRadius:8,flexWrap:'wrap'}}>
                                <span style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'rgba(0,31,107,0.5)',minWidth:110}}>{fechaTexto}</span>
                                <span style={{fontFamily:"'Teko',sans-serif",fontSize:14,color:'#001F6B',flex:1}}>{p.local} vs {p.visitante}</span>
                                {(p.estadoCorto === 'FT' || p.estadoCorto === 'AET' || p.estadoCorto === 'PEN') && (
                                    <span style={{fontFamily:"'Teko',sans-serif",fontSize:13,fontWeight:700,color:'#10b981'}}>{p.golesLocal}-{p.golesVisitante}</span>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
            {ultimaConsulta && (
                <p style={{fontFamily:"'Inter',sans-serif",fontSize:10,color:'rgba(0,31,107,0.3)',marginTop:10}}>
                    Última consulta: {ultimaConsulta.toLocaleTimeString('es-ES')}
                </p>
            )}
        </div>
    );
};

const SaltarTurnoAdmin = () => {
    var [todosElOtro, setTodosElOtro] = useState({});
    var [vacantes, setVacantes] = useState([]);
    var [jugadoresAprobados, setJugadoresAprobados] = useState([]);
    var [jugadoresInactivos, setJugadoresInactivos] = useState([]);
    var [procesando, setProcesando] = useState(false);
    var [msg, setMsg] = useState('');

    useEffect(function() {
        var unsub = onSnapshot(collection(db, 'elOtro'), function(snap) {
            var datos = {};
            snap.forEach(function(d) { datos[d.id] = d.data(); });
            setTodosElOtro(datos);
        });
        return function() { unsub(); };
    }, []);
    useEffect(function() {
        var unsub = onSnapshot(collection(db, 'elOtroVacantes'), function(snap) {
            var lista = [];
            snap.forEach(function(d) { lista.push({ id: d.id, ...d.data() }); });
            setVacantes(lista);
        });
        return function() { unsub(); };
    }, []);
    useEffect(function() {
        var unsub = onSnapshot(doc(db, 'configuracion', 'jugadoresAprobados'), function(snap) {
            setJugadoresAprobados(snap.exists() ? (snap.data().nombres || []) : []);
        });
        return function() { unsub(); };
    }, []);
    useEffect(function() {
        var unsub = onSnapshot(doc(db, 'configuracion', 'jugadoresInactivos'), function(snap) {
            setJugadoresInactivos(snap.exists() ? (snap.data().nombres || []) : []);
        });
        return function() { unsub(); };
    }, []);

    var ordenConf = calcularOrdenElOtro(todosElOtro, vacantes, jugadoresAprobados, jugadoresInactivos);
    var turnoCalculado = calcularTurnoElOtro(ordenConf, todosElOtro, jugadoresInactivos);
    var datosDelTurno = turnoCalculado ? (todosElOtro[turnoCalculado] || {}) : null;
    var cronometroActivo = !!(datosDelTurno && datosDelTurno.turnoIniciadoEn && !datosDelTurno.saltado);

    var handleSaltarSiguiente = async function() {
        if (!turnoCalculado) return;
        if (!window.confirm('¿Saltar a ' + turnoCalculado + ' y arrancar ya el cronómetro del siguiente jugador?\n\nEsto es para desatascar el sistema — normalmente el cronómetro corre solo.')) return;
        setProcesando(true);
        setMsg('');
        try {
            // 1. Saltar al que tiene el turno ahora mismo, contando cuántas
            // veces lleva saltado. A la 3ª vez sin elegir, se le asigna un
            // equipo al azar entre los libres, para que no bloquee la cola
            // para siempre (el caso de Claudio).
            var vecesSaltadoPrevias = (datosDelTurno && datosDelTurno.vecesSaltado) || 0;
            var vecesSaltadoNuevo = vecesSaltadoPrevias + 1;
            var datosSimulados = { ...todosElOtro };
            if (vecesSaltadoNuevo >= 3) {
                var equipoAzar = elegirEquipoAleatorioDisponible(todosElOtro);
                await setDoc(doc(db, 'elOtro', turnoCalculado), {
                    saltado: false, vecesSaltado: vecesSaltadoNuevo,
                    equipo: equipoAzar, elegidoEn: serverTimestamp(), revelado: false,
                    asignadoAlAzarPor3Saltos: true,
                }, { merge: true });
                datosSimulados[turnoCalculado] = { ...(datosSimulados[turnoCalculado] || {}), equipo: equipoAzar, saltado: false };
                setMsg('✅ ' + turnoCalculado + ' llevaba 3 turnos saltados sin elegir — se le ha asignado ' + (equipoAzar || '(sin equipos libres)') + ' al azar, y pasa al siguiente jugador.');
            } else {
                await setDoc(doc(db, 'elOtro', turnoCalculado), { saltado: true, vecesSaltado: vecesSaltadoNuevo }, { merge: true });
                datosSimulados[turnoCalculado] = { ...(datosSimulados[turnoCalculado] || {}), saltado: true };
            }

            // 2. Simular el estado ya actualizado (sin esperar al listener) para
            // saber quién es el siguiente de verdad, ahora mismo.
            var ordenSimulado = calcularOrdenElOtro(datosSimulados, vacantes, jugadoresAprobados, jugadoresInactivos);
            var siguienteTurno = calcularTurnoElOtro(ordenSimulado, datosSimulados, jugadoresInactivos);

            if (siguienteTurno) {
                // 3. Arrancar el cronómetro del siguiente YA MISMO — no espera
                // a que esa persona abra la app para empezar a contar.
                await setDoc(doc(db, 'elOtro', siguienteTurno), {
                    turnoIniciadoEn: serverTimestamp(), saltado: false,
                }, { merge: true });
                if (vecesSaltadoNuevo < 3) {
                    setMsg('✅ ' + turnoCalculado + ' saltado (van ' + vecesSaltadoNuevo + ' de 3). ' + siguienteTurno + ' ya tiene sus 60 minutos corriendo.');
                }
            } else if (vecesSaltadoNuevo < 3) {
                setMsg('✅ ' + turnoCalculado + ' saltado (van ' + vecesSaltadoNuevo + ' de 3). No queda nadie más pendiente de elegir ahora mismo.');
            }
        } catch (e) {
            console.error(e);
            setMsg('❌ Error: ' + e.message);
        }
        setProcesando(false);
    };

    return (
        <div style={ADMIN_STYLES.card}>
            <p style={{fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:2,color:'#001F6B',textTransform:'uppercase',marginBottom:4,fontWeight:600}}>
                ⏭️ Saltar al siguiente jugador
            </p>
            <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,31,107,0.5)',marginBottom:14,lineHeight:1.5}}>
                Botón de emergencia, solo para cuando el sistema se quede atascado. Salta a quien le toca ahora y arranca de inmediato el cronómetro del siguiente — no hace falta que esa persona abra la app para que empiece a correr.
            </p>
            {msg && <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color: msg.startsWith('✅') ? '#10b981' : '#e63946',marginBottom:12}}>{msg}</p>}

            {!turnoCalculado ? (
                <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,31,107,0.4)',textAlign:'center',padding:10}}>
                    Nadie está pendiente de turno ahora mismo (el draft puede estar cerrado, en pausa nocturna, o ya sin nadie por elegir).
                </p>
            ) : (
                <div style={{background: cronometroActivo ? 'rgba(255,215,0,0.08)' : 'rgba(230,57,70,0.06)',border: cronometroActivo ? '1px solid rgba(212,175,55,0.3)' : '1px solid rgba(230,57,70,0.25)',borderRadius:10,padding:14,marginBottom:12}}>
                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'rgba(0,31,107,0.5)',textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Turno actual (calculado)</p>
                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:20,fontWeight:700,color:'#001F6B',marginBottom:6}}>{turnoCalculado}</p>
                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color: cronometroActivo ? '#8a6a00' : '#e63946'}}>
                        {cronometroActivo ? '🟡 Su cronómetro está corriendo con normalidad.' : '🔴 Su cronómetro NO ha arrancado todavía — esto es probablemente lo que está atascando el sistema.'}
                    </p>
                </div>
            )}

            <button onClick={handleSaltarSiguiente} disabled={!turnoCalculado || procesando} style={{
                ...ADMIN_STYLES.btnPrimary, opacity: (!turnoCalculado || procesando) ? 0.5 : 1,
                background:'rgba(230,57,70,0.1)', color:'#e63946', border:'1px solid rgba(230,57,70,0.2)',
            }}>
                {procesando ? 'Procesando...' : '⏭️ Saltar a ' + (turnoCalculado || '—') + ' y activar el siguiente'}
            </button>
        </div>
    );
};

const RastreadorTiemposElOtro = ({ jugadoresLista }) => {
    var [todosElOtro, setTodosElOtro] = useState({});
    var [ahora, setAhora] = useState(new Date());

    useEffect(function() {
        var unsub = onSnapshot(collection(db, 'elOtro'), function(snap) {
            var datos = {};
            snap.forEach(function(d) { datos[d.id] = d.data(); });
            setTodosElOtro(datos);
        });
        return function() { unsub(); };
    }, []);

    useEffect(function() {
        var t = setInterval(function() { setAhora(new Date()); }, 1000);
        return function() { clearInterval(t); };
    }, []);

    // Quién tiene el turno activo ahora mismo: ya empezó su cronómetro, no
    // tiene equipo todavía, y no ha sido saltado.
    var turnoActivo = null;
    Object.keys(todosElOtro).forEach(function(nombre) {
        var d = todosElOtro[nombre];
        if (d.turnoIniciadoEn && !d.equipo && !d.saltado) turnoActivo = nombre;
    });

    var minutosRestantes = null;
    if (turnoActivo) {
        var d = todosElOtro[turnoActivo];
        var inicio = d.turnoIniciadoEn.toDate ? d.turnoIniciadoEn.toDate() : new Date(d.turnoIniciadoEn);
        var transcurrido = minutosEfectivosTranscurridos(inicio, ahora);
        minutosRestantes = Math.max(0, TIMEOUT_TURNO_MINUTOS - transcurrido);
    }

    // El resto de jugadores que todavía no han elegido equipo — sin
    // cronómetro corriendo aún, solo para tener el contexto completo.
    var pendientesSinTurno = jugadoresLista.filter(function(j) {
        var d = todosElOtro[j];
        return (!d || !d.equipo) && j !== turnoActivo;
    });

    var pad = function(n) { return String(Math.floor(n)).padStart(2, '0'); };

    return (
        <div style={ADMIN_STYLES.card}>
            <p style={{fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:2,color:'#001F6B',textTransform:'uppercase',marginBottom:4,fontWeight:600}}>
                ⏱️ Tiempos de El Otro Equipo
            </p>
            <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,31,107,0.5)',marginBottom:14,lineHeight:1.5}}>
                Quién tiene el turno activo ahora mismo y cuánto le queda — con el mismo cálculo que ve el jugador (descuenta la pausa nocturna 01:00-09:00 automáticamente).
            </p>

            {estaEnPausaNocturna(ahora) ? (
                <div style={{background:'rgba(0,31,107,0.05)',borderRadius:10,padding:14,textAlign:'center'}}>
                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,31,107,0.5)'}}>
                        🌙 En pausa nocturna ahora mismo — los cronómetros están congelados hasta las 09:00.
                    </p>
                </div>
            ) : turnoActivo ? (
                <div style={{background:'rgba(255,215,0,0.1)',border:'1px solid rgba(212,175,55,0.3)',borderRadius:10,padding:14,marginBottom:14,textAlign:'center'}}>
                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'#8a6a00',textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Turno activo</p>
                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:22,fontWeight:700,color:'#001F6B'}}>{turnoActivo}</p>
                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:32,fontWeight:700,color: minutosRestantes < 10 ? '#e63946' : '#8a6a00'}}>
                        {pad(minutosRestantes)}:{pad((minutosRestantes % 1) * 60)} restantes
                    </p>
                </div>
            ) : (
                <div style={{background:'rgba(0,31,107,0.05)',borderRadius:10,padding:14,textAlign:'center',marginBottom:14}}>
                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,31,107,0.5)'}}>
                        Nadie tiene el turno activo ahora mismo.
                    </p>
                </div>
            )}

            {pendientesSinTurno.length > 0 && (
                <div>
                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'rgba(0,31,107,0.4)',textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>
                        Todavía sin elegir ({pendientesSinTurno.length})
                    </p>
                    <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                        {pendientesSinTurno.map(function(j) {
                            return (
                                <span key={j} style={{fontFamily:"'Inter',sans-serif",fontSize:11,background:'rgba(0,31,107,0.05)',color:'rgba(0,31,107,0.6)',padding:'4px 10px',borderRadius:10}}>
                                    {j}
                                </span>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

const GestionHuecoVacante = () => {
    var [vacantes, setVacantes] = useState([]);
    var [nombreOriginal, setNombreOriginal] = useState('');
    var [asignaciones, setAsignaciones] = useState({}); // original -> nombre en edición
    var [msg, setMsg] = useState('');

    useEffect(function() {
        var unsub = onSnapshot(collection(db, 'elOtroVacantes'), function(snap) {
            var lista = [];
            snap.forEach(function(d) { lista.push({ id: d.id, ...d.data() }); });
            lista.sort(function(a,b) {
                var ta = a.marcadoEn && a.marcadoEn.toMillis ? a.marcadoEn.toMillis() : 0;
                var tb = b.marcadoEn && b.marcadoEn.toMillis ? b.marcadoEn.toMillis() : 0;
                return ta - tb;
            });
            setVacantes(lista);
        });
        return function() { unsub(); };
    }, []);

    var marcarBaja = async function() {
        if (!nombreOriginal.trim()) { setMsg('Escribe el nombre exacto de quien se da de baja.'); return; }
        var nombre = nombreOriginal.trim();
        var yaExiste = vacantes.some(function(v) { return v.id === nombre; });
        if (yaExiste) { setMsg('Ya hay un hueco registrado para ese nombre — mira la lista de abajo.'); return; }

        // Si ya había elegido equipo antes de irse, se pregunta qué hacer —
        // ya no es una regla fija: puede que quieras dejar su plaza cerrada
        // sin más, o puede que quieras dejarla abierta para que alguien pague
        // por saltarse la cola y elegir antes que el resto. Tú decides cada
        // vez, caso por caso.
        var elOtroSnap = await getDoc(doc(db, 'elOtro', nombre));
        var yaTeniaEquipo = elOtroSnap.exists() && elOtroSnap.data().equipo;
        if (yaTeniaEquipo) {
            var dejarComprable = window.confirm(
                nombre + ' ya había elegido equipo (' + elOtroSnap.data().equipo + ').\n\n' +
                'Pulsa ACEPTAR si quieres dejar su plaza pendiente para que alguien la pague (2€) y se salte la cola, eligiendo antes que el resto.\n\n' +
                'Pulsa CANCELAR si solo quieres liberar su equipo, sin ofrecer la plaza a nadie.'
            );
            if (dejarComprable) {
                await setDoc(doc(db, 'elOtro', nombre), {
                    equipoAbandonado: elOtroSnap.data().equipo, equipo: null,
                }, { merge: true });
                await setDoc(doc(db, 'elOtroVacantes', nombre), {
                    original: nombre, nuevo: null, marcadoEn: serverTimestamp(), resueltoEn: null,
                });
                setMsg('✅ ' + nombre + ' — equipo liberado y plaza pendiente de comprar, saltándose la cola.');
            } else {
                await setDoc(doc(db, 'elOtro', nombre), {
                    equipoAbandonado: elOtroSnap.data().equipo, equipo: null,
                }, { merge: true });
                setMsg('✅ ' + nombre + ' — equipo liberado, sin ofrecer la plaza a nadie.');
            }
            setNombreOriginal('');
            return;
        }

        await setDoc(doc(db, 'elOtroVacantes', nombre), {
            original: nombre, nuevo: null, marcadoEn: serverTimestamp(), resueltoEn: null,
        });
        setMsg('✅ Hueco de ' + nombre + ' registrado, pendiente de asignar (no había elegido equipo todavía).');
        setNombreOriginal('');
    };

    var asignarSustituto = async function(v) {
        var nombreNuevo = (asignaciones[v.id] || '').trim();
        if (!nombreNuevo) { setMsg('Escribe el nombre de quien va a ocupar el hueco de ' + v.original + '.'); return; }
        await setDoc(doc(db, 'elOtroVacantes', v.id), {
            nuevo: nombreNuevo, resueltoEn: serverTimestamp(),
        }, { merge: true });
        setMsg('✅ ' + nombreNuevo + ' hereda el turno de ' + v.original + ' — esto ya no se vuelve a mover.');
        setAsignaciones(function(p) { var c = { ...p }; delete c[v.id]; return c; });
    };

    var borrarRegistro = async function(v) {
        if (!window.confirm('¿Borrar por completo el registro de baja de ' + v.original + (v.nuevo ? (' (ya asignado a ' + v.nuevo + ')') : '') + '?\n\nSolo hazlo si fue un error al crearlo — esto no es para "deshacer" una sustitución ya confirmada.')) return;
        await deleteDoc(doc(db, 'elOtroVacantes', v.id));
        setMsg('Registro de ' + v.original + ' borrado.');
    };

    return (
        <div style={ADMIN_STYLES.card}>
            <p style={{fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:2,color:'#001F6B',textTransform:'uppercase',marginBottom:4,fontWeight:600}}>
                🎟️ Huecos por baja voluntaria
            </p>
            <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,31,107,0.5)',marginBottom:12,lineHeight:1.5}}>
                Cada baja es un registro independiente y permanente. Cuando asignas un sustituto, hereda ese puesto en la cola para siempre — marcar una baja nueva de otra persona no toca esta asignación.
            </p>
            {msg && <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'#10b981',marginBottom:10}}>{msg}</p>}

            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}}>
                <input value={nombreOriginal} onChange={function(e){setNombreOriginal(e.target.value);}} placeholder="Nombre de quien se da de baja"
                    style={{flex:1,minWidth:160,padding:'8px 12px',border:'1px solid rgba(0,31,107,0.15)',borderRadius:8,fontFamily:"'Inter',sans-serif",fontSize:12}} />
                <button onClick={marcarBaja} style={{...ADMIN_STYLES.btnPrimary,padding:'8px 14px',fontSize:12}}>Marcar hueco nuevo</button>
            </div>

            {vacantes.length === 0 ? (
                <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,31,107,0.4)',textAlign:'center'}}>Ningún hueco registrado todavía.</p>
            ) : (
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {vacantes.map(function(v) {
                        return (
                            <div key={v.id} style={{background: v.nuevo ? 'rgba(16,185,129,0.06)' : 'rgba(255,215,0,0.08)',borderRadius:8,padding:'10px 14px'}}>
                                <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'#001F6B',marginBottom:6}}>
                                    <strong>{v.original}</strong> {v.nuevo ? ('→ ✅ ' + v.nuevo + ' (fijo, no se vuelve a mover)') : '(sin asignar todavía)'}
                                </p>
                                {!v.nuevo && (
                                    <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:6}}>
                                        <input value={asignaciones[v.id] || ''} onChange={function(e){setAsignaciones(function(p){var c={...p};c[v.id]=e.target.value;return c;});}}
                                            placeholder="Nombre de quien lo ocupa"
                                            style={{flex:1,minWidth:140,padding:'6px 10px',border:'1px solid rgba(0,31,107,0.15)',borderRadius:8,fontFamily:"'Inter',sans-serif",fontSize:11}} />
                                        <button onClick={function(){asignarSustituto(v);}} style={{...ADMIN_STYLES.btnSuccess,padding:'6px 12px',fontSize:11}}>Asignar</button>
                                    </div>
                                )}
                                <button onClick={function(){borrarRegistro(v);}} style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'#e63946',background:'none',border:'none',cursor:'pointer'}}>
                                    Borrar este registro (solo si fue un error)
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// Estilos reutilizables para tarjetas/botones del panel admin — usados también
// por componentes fuera de AdminPanelScreen (que antes solo tenía su copia local).

// Admin: configura el número de Bizum que se muestra a los jugadores al pagar.
// Admin: congela el Campeón de Invierno cuando termine la primera vuelta.
// Antes esto era solo un anuncio de texto sin ninguna función real detrás —
// ahora sí guarda una foto fija de la clasificación de ese momento exacto.
// Admin: añadir o quitar jugadores de la plantilla de Estrellas sin tocar
// código — fichajes y bajas van a pasar durante la temporada, y hasta ahora
// esto solo se podía cambiar editando el código fuente. Guarda en el mismo
// sitio que ya carga la app al iniciar sesión (configuracion/plantilla_udlp).
// Admin: pone o cambia el apodo de un jugador — para cuando alguien se
// registró con nombre y apellido y ahora aparece así por toda la app en vez
// de solo su nombre de pila. Al guardar el apodo, se aplica al instante en
// avatares y clasificación (los componentes ya priorizan el apodo).
// Admin: interruptor global para mostrar u ocultar apellidos en toda la app.
// Por defecto están ocultos (recorte automático) — esto permite desactivarlo
// sin tocar código, por si algún día se quiere volver a mostrar completo.
const MostrarApellidosAdmin = () => {
    var [activo, setActivo] = useState(false);
    var [guardando, setGuardando] = useState(false);

    useEffect(function() {
        var unsub = onSnapshot(doc(db, 'configuracion', 'mostrarApellidos'), function(snap) {
            setActivo(!!(snap.exists() && snap.data().activo));
        });
        return function() { unsub(); };
    }, []);

    var toggle = async function() {
        setGuardando(true);
        try {
            await setDoc(doc(db, 'configuracion', 'mostrarApellidos'), { activo: !activo }, { merge: true });
        } catch(e) {
            console.error(e);
            alert('Error: ' + e.message);
        }
        setGuardando(false);
    };

    return (
        <div style={{...ADMIN_STYLES.card,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div>
                <p style={{fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:2,color:'#001F6B',textTransform:'uppercase',marginBottom:2,fontWeight:600}}>
                    🏷️ Mostrar apellidos en la app
                </p>
                <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'rgba(0,31,107,0.5)'}}>
                    {activo ? 'Activado — se ve el nombre completo de todos' : 'Desactivado — se recorta automáticamente al nombre de pila'}
                </p>
            </div>
            <button onClick={toggle} disabled={guardando} style={{
                width:52,height:28,borderRadius:16,border:'none',cursor:'pointer',flexShrink:0,
                background: activo ? '#001F6B' : 'rgba(0,31,107,0.15)', position:'relative'}}>
                <div style={{width:22,height:22,borderRadius:'50%',background:'#fff',position:'absolute',
                    top:3, left: activo ? 27 : 3, transition:'left .2s ease'}} />
            </button>
        </div>
    );
};

const PonerApodoAdmin = ({ jugadoresLista }) => {
    var [nombreSeleccionado, setNombreSeleccionado] = useState('');
    var [apodo, setApodo] = useState('');
    var [guardando, setGuardando] = useState(false);
    var [msg, setMsg] = useState('');

    var guardar = async function() {
        if (!nombreSeleccionado || !apodo.trim()) { setMsg('Elige un jugador y escribe el apodo.'); return; }
        setGuardando(true);
        try {
            await setDoc(doc(db, 'perfiles', nombreSeleccionado), { apodo: apodo.trim() }, { merge: true });
            setMsg('✅ ' + nombreSeleccionado + ' ahora se mostrará como "' + apodo.trim() + '" en toda la app.');
            setApodo('');
        } catch(e) {
            console.error(e);
            setMsg('❌ Error: ' + e.message);
        }
        setGuardando(false);
    };

    return (
        <div style={ADMIN_STYLES.card}>
            <p style={{fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:2,color:'#001F6B',textTransform:'uppercase',marginBottom:4,fontWeight:600}}>
                🏷️ Poner apodo a un jugador
            </p>
            <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,31,107,0.5)',marginBottom:12,lineHeight:1.5}}>
                Si alguien se registró con nombre y apellido y aparece así en avatares o clasificación, ponle aquí su apodo (normalmente solo el nombre de pila) — se aplica al instante en toda la app.
            </p>
            {msg && <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color: msg.startsWith('✅') ? '#10b981' : '#e63946',marginBottom:10}}>{msg}</p>}
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                <select value={nombreSeleccionado} onChange={function(e){setNombreSeleccionado(e.target.value);}}
                    style={{flex:1,minWidth:140,padding:'8px 10px',border:'1px solid rgba(0,31,107,0.15)',borderRadius:8,fontFamily:"'Inter',sans-serif",fontSize:12}}>
                    <option value="">Elige jugador...</option>
                    {jugadoresLista.map(function(j) { return <option key={j} value={j}>{j}</option>; })}
                </select>
                <input value={apodo} onChange={function(e){setApodo(e.target.value);}} placeholder="Apodo a mostrar"
                    style={{flex:1,minWidth:120,padding:'8px 10px',border:'1px solid rgba(0,31,107,0.15)',borderRadius:8,fontFamily:"'Inter',sans-serif",fontSize:12}} />
                <button onClick={guardar} disabled={guardando} style={{...ADMIN_STYLES.btnPrimary,padding:'8px 16px'}}>
                    Guardar
                </button>
            </div>
        </div>
    );
};

const GestionPlantillaAdmin = ({ plantilla }) => {
    var [nombre, setNombre] = useState('');
    var [dorsal, setDorsal] = useState('');
    var [posicion, setPosicion] = useState('Delantero');
    var [guardando, setGuardando] = useState(false);
    var [msg, setMsg] = useState('');

    var añadirJugador = async function() {
        if (!nombre.trim()) { setMsg('Escribe el nombre del jugador.'); return; }
        if (plantilla.some(function(j) { return j.nombre.toLowerCase() === nombre.trim().toLowerCase(); })) {
            setMsg('Ya hay un jugador con ese nombre en la plantilla.'); return;
        }
        setGuardando(true);
        try {
            var nuevoJugador = { dorsal: dorsal.trim() || '?', nombre: nombre.trim(), posicion: posicion, apiId: 0, wikiImg: '' };
            var plantillaNueva = plantilla.concat([nuevoJugador]);
            await setDoc(doc(db, 'configuracion', 'plantilla_udlp'), { jugadores: plantillaNueva });
            setMsg('✅ ' + nombre.trim() + ' añadido a la plantilla. Búscale el apiId en "Buscar y verificar IDs" para que sus Estrellas se calculen solas.');
            setNombre(''); setDorsal('');
        } catch(e) {
            console.error(e);
            setMsg('❌ Error: ' + e.message);
        }
        setGuardando(false);
    };

    var quitarJugador = async function(jug) {
        if (!window.confirm('¿Quitar a ' + jug.nombre + ' de la plantilla de Estrellas? (Por baja, cesión, etc. — no afecta a la porra ni a su cuenta si es jugador de la app)')) return;
        setGuardando(true);
        try {
            var plantillaNueva = plantilla.filter(function(j) { return j.nombre !== jug.nombre; });
            await setDoc(doc(db, 'configuracion', 'plantilla_udlp'), { jugadores: plantillaNueva });
            setMsg('✅ ' + jug.nombre + ' quitado de la plantilla.');
        } catch(e) {
            console.error(e);
            setMsg('❌ Error: ' + e.message);
        }
        setGuardando(false);
    };

    return (
        <div style={ADMIN_STYLES.card}>
            <p style={{fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:2,color:'#001F6B',textTransform:'uppercase',marginBottom:4,fontWeight:600}}>
                👥 Gestionar plantilla de Estrellas
            </p>
            <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,31,107,0.5)',marginBottom:14,lineHeight:1.5}}>
                Fichajes nuevos y bajas — añade o quita jugadores aquí mismo, sin esperar a que yo cambie código. Se aplica al instante en toda la app.
            </p>
            {msg && <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color: msg.startsWith('✅') ? '#10b981' : '#e63946',marginBottom:12}}>{msg}</p>}

            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16,alignItems:'flex-end'}}>
                <div style={{flex:1,minWidth:120}}>
                    <label style={{fontFamily:"'Inter',sans-serif",fontSize:10,color:'rgba(0,31,107,0.5)',display:'block',marginBottom:3}}>Nombre</label>
                    <input value={nombre} onChange={function(e){setNombre(e.target.value);}} placeholder="Ej: Nuevo Fichaje"
                        style={{width:'100%',padding:'8px 10px',border:'1px solid rgba(0,31,107,0.15)',borderRadius:8,fontFamily:"'Inter',sans-serif",fontSize:12}} />
                </div>
                <div style={{width:70}}>
                    <label style={{fontFamily:"'Inter',sans-serif",fontSize:10,color:'rgba(0,31,107,0.5)',display:'block',marginBottom:3}}>Dorsal</label>
                    <input value={dorsal} onChange={function(e){setDorsal(e.target.value);}} placeholder="9"
                        style={{width:'100%',padding:'8px 10px',border:'1px solid rgba(0,31,107,0.15)',borderRadius:8,fontFamily:"'Inter',sans-serif",fontSize:12}} />
                </div>
                <div style={{width:150}}>
                    <label style={{fontFamily:"'Inter',sans-serif",fontSize:10,color:'rgba(0,31,107,0.5)',display:'block',marginBottom:3}}>Posición</label>
                    <select value={posicion} onChange={function(e){setPosicion(e.target.value);}}
                        style={{width:'100%',padding:'8px 10px',border:'1px solid rgba(0,31,107,0.15)',borderRadius:8,fontFamily:"'Inter',sans-serif",fontSize:12}}>
                        <option>Portero</option><option>Defensa</option><option>Centrocampista</option><option>Mediapunta</option><option>Delantero</option>
                    </select>
                </div>
                <button onClick={añadirJugador} disabled={guardando} style={{...ADMIN_STYLES.btnPrimary,padding:'8px 16px'}}>
                    + Añadir
                </button>
            </div>

            <div style={{display:'flex',flexDirection:'column',gap:6,maxHeight:280,overflowY:'auto'}}>
                {plantilla.map(function(jug) {
                    return (
                        <div key={jug.nombre} style={{display:'flex',alignItems:'center',gap:10,padding:'6px 10px',background:'rgba(0,31,107,0.02)',borderRadius:8}}>
                            <span style={{fontFamily:"'Teko',sans-serif",fontSize:13,color:'rgba(0,31,107,0.4)',width:24}}>{jug.dorsal}</span>
                            <span style={{fontFamily:"'Teko',sans-serif",fontSize:13,color:'#001F6B',flex:1}}>{jug.nombre}</span>
                            <span style={{fontFamily:"'Inter',sans-serif",fontSize:10,color:'rgba(0,31,107,0.4)'}}>{jug.posicion}</span>
                            <button onClick={function(){quitarJugador(jug);}} disabled={guardando}
                                style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'#e63946',background:'none',border:'none',cursor:'pointer'}}>
                                Quitar
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Admin: resetea la clasificación general a cero para arrancar temporada
// nueva de verdad — borra los puntos acumulados de la temporada anterior de
// TODOS los jugadores, sin tocar sus pagos, perfiles ni el resto de datos.
const ResetearClasificacionAdmin = () => {
    var [confirmando, setConfirmando] = useState(false);
    var [procesando, setProcesando] = useState(false);
    var [msg, setMsg] = useState('');

    var ejecutar = async function() {
        setProcesando(true);
        setMsg('');
        try {
            var snap = await getDocs(collection(db, 'clasificacion'));
            var batch = writeBatch(db);
            var n = 0;
            snap.forEach(function(d) {
                batch.set(doc(db, 'clasificacion', d.id), {
                    puntosTotales: 0, puntosResultadoExacto: 0,
                }, { merge: true });
                n++;
            });
            await batch.commit();
            setMsg('✅ Clasificación reseteada a 0 para ' + n + ' jugadores. Temporada nueva, empieza limpia.');
            setConfirmando(false);
        } catch (e) {
            console.error(e);
            setMsg('❌ Error: ' + e.message);
        }
        setProcesando(false);
    };

    return (
        <div style={ADMIN_STYLES.card}>
            <p style={{fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:2,color:'#001F6B',textTransform:'uppercase',marginBottom:4,fontWeight:600}}>
                🔄 Resetear clasificación general
            </p>
            <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,31,107,0.5)',marginBottom:14,lineHeight:1.5}}>
                Pone a 0 los puntos de todos los jugadores en la clasificación general — para arrancar la temporada nueva sin arrastrar nada de la anterior. No toca pagos, perfiles, ni El Otro Equipo.
            </p>
            {msg && <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color: msg.startsWith('✅') ? '#10b981' : '#e63946',marginBottom:12}}>{msg}</p>}
            {!confirmando ? (
                <button onClick={function(){setConfirmando(true);}} style={{...ADMIN_STYLES.btnPrimary,background:'rgba(230,57,70,0.1)',color:'#e63946',border:'1px solid rgba(230,57,70,0.2)'}}>
                    🔄 Resetear clasificación
                </button>
            ) : (
                <div>
                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'#e63946',marginBottom:10,fontWeight:600}}>
                        ¿Seguro? Esto borra los puntos de TODOS, sin poder deshacerlo.
                    </p>
                    <div style={{display:'flex',gap:8}}>
                        <button onClick={ejecutar} disabled={procesando} style={{...ADMIN_STYLES.btnPrimary,background:'#e63946',color:'#fff'}}>
                            {procesando ? 'Reseteando...' : 'Sí, resetear ya'}
                        </button>
                        <button onClick={function(){setConfirmando(false);}} style={{fontFamily:"'Inter',sans-serif",fontSize:12,background:'none',border:'none',color:'rgba(0,31,107,0.5)',cursor:'pointer'}}>Cancelar</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const CampeonInviernoAdmin = () => {
    var [actual, setActual] = useState(null);
    var [guardando, setGuardando] = useState(false);
    var [msg, setMsg] = useState('');

    useEffect(function() {
        var unsub = onSnapshot(doc(db, 'configuracion', 'campeonInvierno'), function(snap) {
            setActual(snap.exists() ? snap.data() : null);
        });
        return function() { unsub(); };
    }, []);

    var congelar = async function() {
        if (actual && !window.confirm('Ya hay un Campeón de Invierno guardado (' + actual.top3[0].nombre + '). ¿Sobrescribirlo con la clasificación de ahora mismo?')) return;
        setGuardando(true);
        try {
            var snap = await getDocs(collection(db, 'clasificacion'));
            var todos = snap.docs.map(function(d) { return { id: d.id, ...d.data() }; })
                .sort(function(a,b) { return (b.puntosTotales||0) - (a.puntosTotales||0); });
            var top3 = todos.slice(0,3).map(function(j) { return { nombre: j.id, puntos: j.puntosTotales || 0 }; });
            await setDoc(doc(db, 'configuracion', 'campeonInvierno'), { top3: top3, guardadoEn: serverTimestamp() });
            setMsg('✅ Campeón de Invierno guardado: ' + (top3[0] ? top3[0].nombre : '—'));
        } catch(e) {
            console.error(e);
            setMsg('❌ Error: ' + e.message);
        }
        setGuardando(false);
    };

    return (
        <div style={ADMIN_STYLES.card}>
            <p style={{fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:2,color:'#001F6B',textTransform:'uppercase',marginBottom:4,fontWeight:600}}>
                ❄️ Campeón de Invierno
            </p>
            <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,31,107,0.5)',marginBottom:12,lineHeight:1.5}}>
                Cuando termine la primera vuelta, pulsa esto para congelar la clasificación de ese momento. Se guarda el top 3 tal cual esté en ese instante, y se muestra a todos en Clasificación — sin que los cambios de después lo toquen.
            </p>
            {actual && (
                <div style={{background:'rgba(0,145,255,0.06)',borderRadius:8,padding:'10px 14px',marginBottom:12}}>
                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'#001F6B'}}>
                        Ya guardado: <strong>{actual.top3[0] ? actual.top3[0].nombre : '—'}</strong> con {actual.top3[0] ? actual.top3[0].puntos : 0} puntos
                    </p>
                </div>
            )}
            <button onClick={congelar} disabled={guardando} style={ADMIN_STYLES.btnPrimary}>
                {guardando ? 'Guardando...' : actual ? 'Volver a congelar ahora' : 'Congelar Campeón de Invierno ahora'}
            </button>
            {msg && <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color: msg.startsWith('✅') ? '#10b981' : '#e63946',marginTop:10}}>{msg}</p>}
        </div>
    );
};

const ConfiguracionBizum = () => {
    var [nombre, setNombre] = useState('');
    var [telefono, setTelefono] = useState('');
    var [guardado, setGuardado] = useState(false);

    useEffect(function() {
        var unsub = onSnapshot(doc(db, 'configuracion', 'bizum'), function(snap) {
            if (snap.exists()) {
                setNombre(snap.data().nombre || '');
                setTelefono(snap.data().telefono || '');
            }
        });
        return function() { unsub(); };
    }, []);

    var guardar = async function() {
        await setDoc(doc(db, 'configuracion', 'bizum'), { nombre: nombre, telefono: telefono }, { merge: true });
        setGuardado(true);
        setTimeout(function(){setGuardado(false);}, 2000);
    };

    return (
        <div style={ADMIN_STYLES.card}>
            <p style={{fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:2,color:'#001F6B',textTransform:'uppercase',marginBottom:12,fontWeight:600}}>
                📲 Configurar Bizum
            </p>
            <p style={{fontFamily:"'Inter',sans-serif",fontSize:13,color:'rgba(0,31,107,0.6)',marginBottom:14,lineHeight:1.6}}>
                Este número es el que verán todos los jugadores al pagar. Confirma cada pago manualmente en el historial de abajo, cuando lo veas llegar a tu banco.
            </p>
            <label style={{fontFamily:"'Teko',sans-serif",fontSize:11,letterSpacing:2,color:'rgba(0,31,107,0.5)',textTransform:'uppercase',display:'block',marginBottom:4}}>Tu nombre (como lo verán)</label>
            <input value={nombre} onChange={function(e){setNombre(e.target.value);}} placeholder="Juanma"
                style={{width:'100%',padding:'10px 12px',border:'1.5px solid rgba(0,31,107,0.15)',borderRadius:10,fontFamily:"'Inter',sans-serif",fontSize:14,marginBottom:12,background:'#f8f9ff'}} />
            <label style={{fontFamily:"'Teko',sans-serif",fontSize:11,letterSpacing:2,color:'rgba(0,31,107,0.5)',textTransform:'uppercase',display:'block',marginBottom:4}}>Número de teléfono (Bizum)</label>
            <input value={telefono} onChange={function(e){setTelefono(e.target.value);}} placeholder="600 123 456"
                style={{width:'100%',padding:'10px 12px',border:'1.5px solid rgba(0,31,107,0.15)',borderRadius:10,fontFamily:"'Inter',sans-serif",fontSize:14,marginBottom:14,background:'#f8f9ff'}} />
            <button onClick={guardar} style={ADMIN_STYLES.btnPrimary}>
                {guardado ? '✅ Guardado' : 'Guardar número de Bizum'}
            </button>
        </div>
    );
};

// Admin: verifica visualmente la foto de cada jugador y permite fijarla a
// mano si la automática (por apiId) no es la persona correcta. Guarda la
// plantilla completa en Firestore (configuracion/plantilla_udlp), el mismo
// sitio que ya usa la app para cargar la plantilla al iniciar sesión — así
// el cambio se aplica en toda la app sin tocar código.
// Admin: verificar y corregir el escudo de cada equipo de Primera División
// (El Otro Equipo) sin tocar código. Usa el mismo mecanismo que ya existe
// (configuracion/escudos → teamLogos), que YA tiene prioridad sobre el mapa
// fijo del código — no hacía falta construir nada nuevo por debajo, solo
// esta pantalla para editarlo.
const VerificarEscudosPrimera = ({ teamLogos }) => {
    var [ediciones, setEdiciones] = useState({});
    var [guardandoEquipo, setGuardandoEquipo] = useState('');
    var [msg, setMsg] = useState('');

    var valorActual = function(equipo) {
        if (ediciones[equipo] !== undefined) return ediciones[equipo];
        return (teamLogos && teamLogos[equipo]) || '';
    };

    var guardar = async function(equipo) {
        var url = valorActual(equipo).trim();
        if (!url) { setMsg('Pega una URL de imagen para ' + equipo + ' antes de guardar.'); return; }
        setGuardandoEquipo(equipo);
        try {
            var campo = {};
            campo[equipo] = url;
            await setDoc(doc(db, 'configuracion', 'escudos'), campo, { merge: true });
            setMsg('✅ Escudo de ' + equipo + ' actualizado en toda la app.');
        } catch(e) {
            console.error(e);
            setMsg('❌ Error guardando ' + equipo + ': ' + e.message);
        }
        setGuardandoEquipo('');
    };

    return (
        <div style={ADMIN_STYLES.card}>
            <p style={{fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:2,color:'#001F6B',textTransform:'uppercase',marginBottom:4,fontWeight:600}}>
                🛡️ Verificar escudos de Primera (El Otro Equipo)
            </p>
            <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,31,107,0.5)',marginBottom:14,lineHeight:1.5}}>
                Si el escudo de algún equipo no carga o no es el correcto, pega aquí una URL de imagen (Wikipedia, web oficial, donde sea) y guarda — se aplica al instante en toda la app, sin esperar a que yo toque código.
            </p>
            {msg && <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color: msg.startsWith('✅') ? '#10b981' : '#e63946',marginBottom:12}}>{msg}</p>}
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {EQUIPOS_PRIMERA_DIVISION.map(function(equipo) {
                    var url = valorActual(equipo);
                    return (
                        <div key={equipo} style={{display:'flex',gap:8,alignItems:'center',padding:'6px 8px',background:'rgba(0,31,107,0.02)',borderRadius:8,flexWrap:'wrap'}}>
                            {url ? (
                                <img src={url} alt="" style={{width:32,height:32,objectFit:'contain',flexShrink:0}}
                                    onError={function(e){e.target.style.opacity=0.15;}} />
                            ) : (
                                <div style={{width:32,height:32,borderRadius:'50%',background:'rgba(0,31,107,0.08)',flexShrink:0}} />
                            )}
                            <span style={{fontFamily:"'Teko',sans-serif",fontSize:13,color:'#001F6B',width:130,flexShrink:0}}>{equipo}</span>
                            <input value={url} onChange={function(e){setEdiciones(function(p){var c={...p};c[equipo]=e.target.value;return c;});}}
                                placeholder="URL del escudo"
                                style={{flex:1,minWidth:140,padding:'6px 10px',border:'1px solid rgba(0,31,107,0.15)',borderRadius:8,fontFamily:"'Inter',sans-serif",fontSize:11}} />
                            <button onClick={function(){guardar(equipo);}} disabled={guardandoEquipo===equipo}
                                style={{...ADMIN_STYLES.btnSuccess,padding:'6px 12px',fontSize:11}}>
                                {guardandoEquipo===equipo ? '...' : 'Guardar'}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const VerificarFotosPlantilla = ({ plantilla }) => {
    var [ediciones, setEdiciones] = useState({}); // nombre -> {apiId, fotoManual} en edición (sin guardar aún)
    var [guardados, setGuardados] = useState({}); // nombre -> {apiId, fotoManual} — lo que YA hay en Firestore, en vivo
    var [guardandoNombre, setGuardandoNombre] = useState('');
    var [msg, setMsg] = useState('');

    // Escucha en vivo la colección — cada jugador es un documento
    // independiente, así que guardar a uno nunca puede pisar a otro.
    useEffect(function() {
        var unsub = onSnapshot(collection(db, 'fotosJugadores'), function(snap) {
            var mapa = {};
            snap.forEach(function(d) { mapa[d.id] = d.data(); });
            setGuardados(mapa);
        });
        return function() { unsub(); };
    }, []);

    var valorActual = function(jug, campo) {
        if (ediciones[jug.nombre] && ediciones[jug.nombre][campo] !== undefined) return ediciones[jug.nombre][campo];
        if (guardados[jug.nombre] && guardados[jug.nombre][campo] !== undefined) return guardados[jug.nombre][campo];
        return jug[campo] || '';
    };

    var cambiar = function(nombre, campo, valor) {
        setEdiciones(function(prev) {
            var copia = { ...prev };
            copia[nombre] = { ...(copia[nombre] || {}), [campo]: valor };
            return copia;
        });
    };

    // Cada jugador se guarda en SU PROPIO documento (fotosJugadores/{nombre}),
    // con merge:true — así guardar a Fulano nunca toca ni borra lo de Mengano,
    // aunque los guardes uno detrás de otro sin recargar la página.
    var guardarJugador = async function(jug) {
        setGuardandoNombre(jug.nombre);
        try {
            var apiIdNuevo = valorActual(jug, 'apiId');
            var fotoManualNueva = valorActual(jug, 'fotoManual');
            await setDoc(doc(db, 'fotosJugadores', jug.nombre), {
                apiId: apiIdNuevo ? parseInt(apiIdNuevo) || 0 : 0,
                fotoManual: fotoManualNueva || '',
                actualizadoEn: serverTimestamp(),
            }, { merge: true });
            setMsg('✅ Foto de ' + jug.nombre + ' actualizada en toda la app.');
        } catch(e) {
            console.error(e);
            setMsg('❌ Error guardando ' + jug.nombre + ': ' + e.message);
        }
        setGuardandoNombre('');
    };

    var quitarFotoManual = function(jug) {
        cambiar(jug.nombre, 'fotoManual', '');
    };

    return (
        <div style={ADMIN_STYLES.card}>
            <p style={{fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:2,color:'#001F6B',textTransform:'uppercase',marginBottom:4,fontWeight:600}}>
                🖼️ Verificar fotos de la plantilla
            </p>
            <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,31,107,0.5)',marginBottom:14,lineHeight:1.5}}>
                Si la foto de alguien no es la suya, pega aquí la URL de una foto correcta (de Wikipedia, Sofascore, o donde sea) — se guarda para toda la app y gana siempre a la foto automática. Puedes guardar uno detrás de otro sin problema, cada uno es independiente.
            </p>
            {msg && <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color: msg.startsWith('✅') ? '#10b981' : '#e63946',marginBottom:12}}>{msg}</p>}
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {plantilla.map(function(jug) {
                    var fotoManual = valorActual(jug, 'fotoManual');
                    var apiIdVal = valorActual(jug, 'apiId');
                    var fotoPreview = fotoManual || (apiIdVal ? 'https://media.api-sports.io/football/players/' + apiIdVal + '.png' : '');
                    return (
                        <div key={jug.nombre} style={{display:'flex',gap:10,alignItems:'center',padding:'8px 10px',background:'rgba(0,31,107,0.02)',borderRadius:10,flexWrap:'wrap'}}>
                            {fotoPreview ? (
                                <img src={fotoPreview} alt="" style={{width:40,height:40,borderRadius:'50%',objectFit:'cover',border:'2px solid rgba(0,31,107,0.1)',flexShrink:0}}
                                    onError={function(e){e.target.style.opacity=0.15;}} />
                            ) : (
                                <div style={{width:40,height:40,borderRadius:'50%',background:'rgba(0,31,107,0.06)',flexShrink:0}} />
                            )}
                            <span style={{fontFamily:"'Teko',sans-serif",fontSize:14,color:'#001F6B',width:110,flexShrink:0}}>{jug.nombre}</span>
                            <input value={fotoManual} onChange={function(e){cambiar(jug.nombre,'fotoManual',e.target.value);}}
                                placeholder="URL de foto manual (opcional)"
                                style={{flex:1,minWidth:160,padding:'6px 10px',border:'1px solid rgba(0,31,107,0.15)',borderRadius:8,fontFamily:"'Inter',sans-serif",fontSize:11}} />
                            {fotoManual && (
                                <button onClick={function(){quitarFotoManual(jug);}} style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'#e63946',background:'none',border:'none',cursor:'pointer'}}>Quitar</button>
                            )}
                            <button onClick={function(){guardarJugador(jug);}} disabled={guardandoNombre===jug.nombre}
                                style={{...ADMIN_STYLES.btnSuccess,padding:'6px 12px',fontSize:11}}>
                                {guardandoNombre===jug.nombre ? '...' : 'Guardar'}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Pantalla de Normativa — toda la reglas de la temporada, por apartado,
// en burbujas desplegables (mismo componente que ya usan El Otro y Estrellas).
const NormativaScreen = () => {
    var G = styles.colors;
    return (
        <div style={{padding:'20px 16px'}}>
            <h2 style={styles.title}>NORMATIVA</h2>
            <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:G.deepBlue,opacity:.5,textAlign:'center',marginBottom:18,lineHeight:1.6}}>
                Todas las reglas de la temporada 26/27, por apartado. Toca cada título para desplegarlo.
            </p>

            <AcordeonAyuda icono="⚽" titulo="La Porra" abiertoPorDefecto={true}>
                <div style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,31,107,0.75)',lineHeight:1.8}}>
                    <p style={{marginBottom:8}}>Cada jornada de la UDLP, adivinas el <strong>marcador exacto</strong> y el <strong>1X2</strong> (quién gana, pierde o empata).</p>
                    <p style={{marginBottom:8}}><strong>Puntos:</strong> marcador exacto +3 (jornada VIP +6) · 1X2 acertado +1 (VIP +2).</p>
                    <p style={{marginBottom:8}}><strong>Cierre:</strong> las apuestas se cierran <strong>5 minutos antes</strong> del partido de la UDLP. Puedes cambiar tu apuesta cuantas veces quieras hasta ese momento.</p>
                    <p style={{marginBottom:8}}><strong>Secreto hasta el cierre:</strong> nadie ve el resultado de nadie mientras la jornada está abierta. Solo se ven estadísticas agregadas (qué marcadores se repiten, cuántos Local/Empate/Visitante) — y solo a partir de <strong>5 apuestas guardadas</strong>, para que nunca se pueda intuir quién puso qué con pocos datos.</p>
                    <p style={{margin:0}}><strong>⚠️ Pago obligatorio por jornada:</strong> el sistema te deja apostar siempre, pero tu resultado <strong>solo cuenta si pagas esa jornada por Bizum</strong> antes del cierre. Pagar no bloquea que sigas cambiando tu apuesta — solo confirma tu participación. Si no pagas, tu apuesta se guarda pero no puntúa.</p>
                </div>
            </AcordeonAyuda>

            <AcordeonAyuda icono="🛡️" titulo="El Otro Equipo">
                <div style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,31,107,0.75)',lineHeight:1.8}}>
                    <p style={{marginBottom:8}}>Eliges un equipo de Primera División para <strong>toda la temporada</strong> — una vez elegido, no se puede cambiar.</p>
                    <p style={{marginBottom:8}}><strong>Orden de elección:</strong> según la clasificación de la liga paralela de la temporada 25/26. Los jugadores nuevos entran al final, por orden de aprobación de su solicitud.</p>
                    <p style={{marginBottom:8}}><strong>Turnos:</strong> cuando te toca, tienes <strong>60 minutos</strong> para elegir. Si se agota el tiempo, pasas al final de la cola — no pierdes el turno del todo, solo se retrasa.</p>
                    <p style={{marginBottom:8}}><strong>Pausa nocturna:</strong> de <strong>01:00 a 09:00</strong> (hora canaria) el draft se pausa cada noche, por igualdad de condiciones ya que hay gente durmiendo. Se retoma exactamente donde se quedó, sin que esas horas cuenten contra el cronómetro de nadie.</p>
                    <p style={{marginBottom:8}}><strong>Secreto:</strong> tu equipo es secreto durante tus <strong>3 primeras activaciones</strong>. A partir de la 4ª (cuando llegas a ×2.5) se hace público para todos, automáticamente.</p>
                    <p style={{marginBottom:8}}><strong>Activación por jornada:</strong> decides si lo activas o no, y tienes que hacerlo <strong>antes de que empiece el partido de Primera de tu equipo</strong> — no después.</p>
                    <p style={{marginBottom:8}}><strong>Efecto:</strong> si tu equipo gana, tus puntos de esa jornada se <strong>multiplican</strong> (redondeo al alza). Si empata, no cambian. Si pierde, se <strong>dividen</strong> (redondeo a la baja). El multiplicador sube con el uso: <strong>×2</strong> al principio, <strong>×2.5</strong> desde la 3ª activación, <strong>×3</strong> desde la 5ª.</p>
                    <p style={{margin:0}}><strong>Plaza vacante:</strong> si alguien se da de baja, cualquiera puede pagar <strong>2€</strong> para ocupar su hueco en la cola, en la misma posición que tenía.</p>
                </div>
            </AcordeonAyuda>

            <AcordeonAyuda icono="⭐" titulo="Mis 5 Estrellas">
                <div style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,31,107,0.75)',lineHeight:1.8}}>
                    <p style={{marginBottom:8}}>Eliges hasta <strong>5 jugadores de la UDLP</strong> antes de cada partido. Sus goles, asistencias, paradas y tarjetas generan estrellas según una tabla de puntos fija.</p>
                    <p style={{marginBottom:8}}><strong>Cierre:</strong> se cierra a la vez que la porra — 5 minutos antes del partido de la UDLP. Editable libremente hasta ese momento.</p>
                    <p style={{marginBottom:8}}><strong>Cálculo:</strong> automático, tras el partido, con estadísticas oficiales de la API. Algunas acciones (robo de balón, recuperaciones) no se pueden calcular automáticamente y no puntúan.</p>
                    <p style={{margin:0}}>Las estrellas acumuladas forman una <strong>clasificación paralela</strong>, con su propio premio.</p>
                </div>
            </AcordeonAyuda>

            <AcordeonAyuda icono="💳" titulo="Pagos">
                <div style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,31,107,0.75)',lineHeight:1.8}}>
                    <p style={{marginBottom:8}}><strong>Inscripción:</strong> 5€, una vez por temporada. Sin pagarla, no se puede usar la app (ni apostar, ni Estrellas, ni El Otro Equipo).</p>
                    <p style={{marginBottom:8}}><strong>Jornada:</strong> 1€ normal, 2€ si es jornada VIP. Obligatorio para que tu resultado de esa jornada cuente.</p>
                    <p style={{marginBottom:8}}><strong>Método:</strong> solo Bizum, directo desde tu banco, sin comisión.</p>
                    <p style={{marginBottom:8}}><strong>Confirmación:</strong> manual — el admin marca el pago como confirmado al verlo llegar. Queda "pendiente" hasta entonces.</p>
                    <p style={{margin:0}}><strong>Pagar por otro jugador:</strong> puedes pagar la inscripción o una jornada de otra persona en la misma pantalla, en un solo cobro. Eso queda bajo la responsabilidad de cada uno — la app no media en esos acuerdos entre jugadores.</p>
                </div>
            </AcordeonAyuda>

            <AcordeonAyuda icono="🏆" titulo="Premios">
                <div style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,31,107,0.75)',lineHeight:1.8}}>
                    <p style={{marginBottom:8}}><strong>Bote de la porra</strong> (solo de las inscripciones, 5€ × jugadores): se reparte <strong>65%</strong> para el 1º, <strong>25%</strong> para el 2º, <strong>10%</strong> para el 3º.</p>
                    <p style={{marginBottom:8}}><strong>Campeón de Invierno:</strong> reconocimiento propio para quien vaya primero al terminar la primera vuelta.</p>
                    <p style={{marginBottom:8}}><strong>Rifas:</strong> durante toda la temporada, con premios propios, para todos los jugadores.</p>
                    <p style={{margin:0}}><strong>Liga de Estrellas:</strong> premio aparte, de alto valor — todavía sin desvelar del todo. Este y el resto de premios (Campeón de Invierno, rifas) salen de <strong>botes internos</strong>, no del bote de la porra.</p>
                </div>
            </AcordeonAyuda>
        </div>
    );
};

const AdminPanelScreen = ({ plantilla, teamLogos }) => {
    var [jornadas, setJornadas] = useState([]);
    var [expandida, setExpandida] = useState(null);
    var [sincronizando, setSincronizando] = useState(false);
    var [msgSync, setMsgSync] = useState('');
    var [seccion, setSeccion] = useState('jornadas');
    var [solicitudes, setSolicitudes] = useState([]);
    var [errorSolicitudes, setErrorSolicitudes] = useState('');
    var [pagos, setPagos] = useState([]);
    var [msgAdmin, setMsgAdmin] = useState('');
    var [rifas, setRifas] = useState([]);
    var [nuevaRifa, setNuevaRifa] = useState({ titulo:'', descripcion:'', precio:'', fecha:'' });

    var JUGADORES_FUNDADORES = ["Juanma","Lucy","Antonio","Mari","Pedro","Pedrito","Himar","Sarito","Vicky","Carmelo","Laura","Carlos","José","Claudio","Javi"];
    var [jugadoresInactivos, setJugadoresInactivos] = useState([]);
    var [jugadoresAprobados, setJugadoresAprobados] = useState([]);
    var JUGADORES_TODOS = Array.from(new Set(JUGADORES_FUNDADORES.concat(jugadoresAprobados)));
    var JUGADORES_LISTA = JUGADORES_TODOS.filter(function(j) { return jugadoresInactivos.indexOf(j) === -1; });

    useEffect(function() {
        var unsub = onSnapshot(doc(db, 'configuracion', 'jugadoresInactivos'), function(snap) {
            setJugadoresInactivos(snap.exists() ? (snap.data().nombres || []) : []);
        });
        return function() { unsub(); };
    }, []);

    useEffect(function() {
        var unsub = onSnapshot(doc(db, 'configuracion', 'jugadoresAprobados'), function(snap) {
            setJugadoresAprobados(snap.exists() ? (snap.data().nombres || []) : []);
        });
        return function() { unsub(); };
    }, []);

    useEffect(function() {
        var unsub = onSnapshot(
            query(collection(db, "jornadas"), orderBy("numeroJornada", "asc")),
            function(snap) {
                var data = snap.docs.map(function(d) { return { id: d.id, ...d.data() }; });
                setJornadas(data);
                setExpandida(function(actual) {
                    if (actual !== null) return actual;
                    var activa = snap.docs.find(function(d) { return d.data().estado === 'Abierta' || d.data().estado === 'En vivo'; });
                    return activa ? activa.id : null;
                });
            }
        );
        return function() { unsub(); };
    }, []);

    useEffect(function() {
        if (seccion !== 'solicitudes') return;
        setErrorSolicitudes('');
        var unsub = onSnapshot(
            query(collection(db, 'solicitudes_ingreso'), orderBy('creadoEn', 'asc')),
            function(snap) { setSolicitudes(snap.docs.map(function(d) { return { id: d.id, ...d.data() }; })); },
            function(err) {
                console.error('Error leyendo solicitudes:', err);
                setErrorSolicitudes('No se pudieron cargar las solicitudes: ' + err.message + ' (revisa las reglas de Firestore para la colección "solicitudes_ingreso")');
            }
        );
        return function() { unsub(); };
    }, [seccion]);

    useEffect(function() {
        if (seccion !== 'pagos') return;
        var unsub = onSnapshot(
            query(collection(db, 'pagos'), orderBy('creadoEn', 'desc')),
            function(snap) { setPagos(snap.docs.map(function(d) { return { id: d.id, ...d.data() }; })); }
        );
        return function() { unsub(); };
    }, [seccion]);

    useEffect(function() {
        if (seccion !== 'rifas') return;
        var unsub = onSnapshot(
            query(collection(db, 'rifas'), orderBy('creadoEn', 'desc')),
            function(snap) { setRifas(snap.docs.map(function(d) { return { id: d.id, ...d.data() }; })); }
        );
        return function() { unsub(); };
    }, [seccion]);

    var sincronizarConAPI = async function(jornada) {
        if (!API_FOOTBALL_KEY) { setMsgSync('⚠️ Configura REACT_APP_API_FOOTBALL_KEY en .env'); return; }
        setSincronizando(true); setMsgSync('Consultando API-Football...');
        try {
            // season=2026 confirmado directamente en el panel de API-Football.
            var url = 'https://v3.football.api-sports.io/fixtures?league=141&season=2026&date=' + jornada.fecha + '&team=' + API_TEAM_ID_UDLP;
            var res = await fetch(url, { headers: { 'x-apisports-key': API_FOOTBALL_KEY } });
            var data = await res.json();
            if (data.response && data.response.length > 0) {
                var fixture = data.response[0];
                var golesLocal = fixture.goals.home;
                var golesVisitante = fixture.goals.away;
                var isLive = ['LIVE','1H','2H','HT'].includes(fixture.fixture.status.short);
                var eventos = fixture.events || [];
                var primerGol = eventos.find(function(e) { return e.type === 'Goal' && e.detail !== 'Missed Penalty'; });
                var primerGoleador = primerGol ? primerGol.player.name : '';
                await setDoc(doc(db, "jornadas", jornada.id), {
                    fixtureId: fixture.fixture.id,
                    liveData: { golesLocal, golesVisitante, primerGoleador, isLive, actualizadoEn: new Date().toISOString() }
                }, { merge: true });
                setMsgSync('✅ ' + golesLocal + '-' + golesVisitante + (isLive ? ' (EN VIVO)' : ' (Final)'));
            } else { setMsgSync('ℹ️ No se encontró partido.'); }
        } catch(e) { setMsgSync('❌ Error: ' + e.message); }
        setSincronizando(false);
    };

    var resetearTutorial = async function(jugador) {
        if (!jugador) { setMsgAdmin('Selecciona un jugador'); return; }
        try {
            // El tutorial se guarda en localStorage del dispositivo del jugador.
            // Desde admin guardamos un flag en Firestore que la app SÍ lee ahora
            // al iniciar sesión (handleLoginSuccess), y lo consume automáticamente.
            await setDoc(doc(db, 'perfiles', jugador), { resetTutorial: true }, { merge: true });
            setMsgAdmin('✅ Tutorial de ' + jugador + ' se mostrará de nuevo la próxima vez que entre');
            alert('✅ Listo. La próxima vez que ' + jugador + ' inicie sesión, verá el tutorial de nuevo.');
        } catch(e) {
            console.error('Error reseteando tutorial:', e);
            alert('❌ No se pudo resetear el tutorial de ' + jugador + '.\n\nError: ' + e.message);
        }
    };

    // Aprobar de verdad activa el acceso: crea su PIN (con el que ya eligió
    // en el formulario de invitación), su perfil, y lo añade a la lista de
    // jugadores activos — sin esto, "aprobar" no dejaba entrar a nadie.
    var aprobarSolicitud = async function(sol) {
        if (!sol.pinHash) {
            alert('Esta solicitud es de antes de que existiera el PIN en el formulario de invitación.\n\nPídele que rellene el formulario de nuevo desde el enlace de invitación — así su PIN queda guardado y puede entrar directamente al aprobarla.');
            return;
        }
        try {
            await setDoc(doc(db, 'pines', sol.nombre), { hash: sol.pinHash, creadoEn: serverTimestamp() });
            await setDoc(doc(db, 'perfiles', sol.nombre), { nombre: sol.nombre, telefono: sol.telefono || '' }, { merge: true });
            await setDoc(doc(db, 'configuracion', 'jugadoresAprobados'), { nombres: arrayUnion(sol.nombre) }, { merge: true });
            await setDoc(doc(db, 'solicitudes_ingreso', sol.id), { estado: 'aprobada' }, { merge: true });
            alert('✅ ' + sol.nombre + ' ya puede entrar a la app con su nombre y el PIN que creó al solicitar la plaza.');
        } catch(e) {
            console.error(e);
            alert('❌ Error al aprobar: ' + e.message);
        }
    };

    // Repara una solicitud que ya figura como "aprobada" pero que en realidad
    // nunca llegó a activarse de verdad (aprobada con la versión antigua del
    // panel, que solo cambiaba la palabra de estado sin crear PIN/perfil/
    // acceso). Cubre los dos casos: si ya tenía PIN guardado, lo reactiva tal
    // cual; si no lo tenía (solicitudes muy antiguas, de antes de que el
    // formulario pidiera PIN), te deja ponerle uno nuevo aquí mismo.
    var repararActivacion = async function(sol) {
        try {
            var pinHash = sol.pinHash;
            if (!pinHash) {
                var pinNuevo = window.prompt('Esta solicitud no tiene PIN guardado (es de antes de que el formulario lo pidiera).\n\nEscribe un PIN de 4 dígitos para ' + sol.nombre + ' — dáselo tú directamente por WhatsApp para que pueda entrar:');
                if (!pinNuevo || !/^\d{4}$/.test(pinNuevo)) {
                    if (pinNuevo !== null) alert('El PIN debe ser exactamente 4 números.');
                    return;
                }
                pinHash = await hashPin(sol.nombre, pinNuevo);
            }
            await setDoc(doc(db, 'pines', sol.nombre), { hash: pinHash, creadoEn: serverTimestamp() });
            await setDoc(doc(db, 'perfiles', sol.nombre), { nombre: sol.nombre, telefono: sol.telefono || '' }, { merge: true });
            await setDoc(doc(db, 'configuracion', 'jugadoresAprobados'), { nombres: arrayUnion(sol.nombre) }, { merge: true });
            alert('✅ Reparado. ' + sol.nombre + ' ya puede entrar a la app con su nombre' + (sol.pinHash ? ' y el PIN que había creado.' : ' y el PIN que le acabas de dar por WhatsApp.'));
        } catch(e) {
            console.error(e);
            alert('❌ Error al reparar: ' + e.message);
        }
    };

    var rechazarSolicitud = async function(sol) {
        await setDoc(doc(db, 'solicitudes_ingreso', sol.id), { estado: 'rechazada' }, { merge: true });
    };

    var crearRifa = async function() {
        if (!nuevaRifa.titulo || !nuevaRifa.fecha) { setMsgAdmin('Rellena título y fecha de la rifa'); return; }
        await addDoc(collection(db, 'rifas'), {
            ...nuevaRifa,
            estado: 'activa',
            creadoEn: serverTimestamp(),
        });
        setNuevaRifa({ titulo:'', descripcion:'', precio:'', fecha:'' });
        setMsgAdmin('✅ Rifa creada');
    };

    // ── ESTILOS INTERNOS DEL ADMIN ──────────────────────────────────────────
    var A = {
        secBtn: function(id) {
            return {
                padding:'10px 16px', borderRadius:10, border:'none', cursor:'pointer',
                fontFamily:"'Teko',sans-serif", fontSize:14, letterSpacing:2, textTransform:'uppercase',
                background: seccion===id ? '#001F6B' : 'rgba(0,31,107,0.06)',
                color: seccion===id ? '#FFD700' : '#001F6B',
                fontWeight: seccion===id ? 700 : 400,
                flexShrink:0,
            };
        },
        card: { background:'#fff', border:'1px solid rgba(0,31,107,0.1)', borderRadius:14, padding:16, marginBottom:12 },
        label: { fontFamily:"'Teko',sans-serif", fontSize:12, letterSpacing:2, color:'rgba(0,31,107,0.5)', textTransform:'uppercase', display:'block', marginBottom:4 },
        input: { width:'100%', padding:'10px 12px', border:'1.5px solid rgba(0,31,107,0.15)', borderRadius:10, fontFamily:"'Inter',sans-serif", fontSize:14, color:'#001F6B', outline:'none', marginBottom:10, background:'#f8f9ff' },
        btnPrimary: { background:'#001F6B', color:'#FFD700', border:'none', borderRadius:10, padding:'11px 20px', fontFamily:"'Teko',sans-serif", fontSize:14, letterSpacing:2, cursor:'pointer', textTransform:'uppercase' },
        btnSuccess: { background:'#10b981', color:'#fff', border:'none', borderRadius:8, padding:'6px 12px', fontFamily:"'Teko',sans-serif", fontSize:12, letterSpacing:1, cursor:'pointer' },
        btnDanger: { background:'#e63946', color:'#fff', border:'none', borderRadius:8, padding:'6px 12px', fontFamily:"'Teko',sans-serif", fontSize:12, letterSpacing:1, cursor:'pointer' },
        tag: function(color) { return { background: color+'20', color: color, border:'1px solid '+color+'40', borderRadius:8, padding:'3px 10px', fontFamily:"'Inter',sans-serif", fontSize:10, fontWeight:600 }; },
    };

    var jornadaActiva = jornadas.find(function(j) { return j.estado === 'Abierta' || j.estado === 'En vivo'; });

    return (
        <div style={{paddingBottom:60}}>
            <h2 style={{fontFamily:"'Teko',sans-serif",fontSize:22,letterSpacing:3,color:'#001F6B',textTransform:'uppercase',marginBottom:16,fontWeight:700}}>
                ⚙️ PANEL DE CONTROL
            </h2>

            {/* Mensaje de estado global */}
            {msgAdmin && (
                <div style={{background:'rgba(0,31,107,0.08)',border:'1px solid rgba(0,31,107,0.15)',borderRadius:10,padding:'10px 14px',marginBottom:14}}>
                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:13,color:'#001F6B'}}>{msgAdmin}</p>
                </div>
            )}

            {/* Navegación por secciones */}
            <div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:4,marginBottom:20}}>
                {[
                    ['jornadas','⚽ Jornadas', 0],
                    ['pagos','💰 Pagos', pagos.filter(function(p){return p.estado==='pendiente_confirmacion';}).length],
                    ['solicitudes','👥 Solicitudes', solicitudes.filter(function(s){return !s.estado || s.estado==='pendiente';}).length],
                    ['clasificacion','🏆 Clasificación', 0],
                    ['herramientas','🔧 Herramientas', 0],
                    ['rifas','🎟️ Rifas', 0],
                ].map(function(s) {
                    return (
                        <button key={s[0]} onClick={function(){setSeccion(s[0]);setMsgAdmin('');}} style={{...A.secBtn(s[0]),position:'relative'}}>
                            {s[1]}
                            {s[2] > 0 && <span style={{position:'absolute',top:-4,right:-4,fontFamily:"'Teko',sans-serif",fontSize:11,fontWeight:700,background:'#e63946',color:'#fff',padding:'1px 6px',borderRadius:8,minWidth:16,textAlign:'center'}}>{s[2]}</span>}
                        </button>
                    );
                })}
            </div>

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                JORNADAS
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {seccion === 'jornadas' && (
                <div>
                    {/* Sync API */}
                    {jornadaActiva && (
                        <div style={A.card}>
                            <p style={{fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:2,color:'#001F6B',textTransform:'uppercase',marginBottom:10,fontWeight:600}}>
                                API-Football — J{jornadaActiva.numeroJornada}
                            </p>
                            <button onClick={function(){sincronizarConAPI(jornadaActiva);}} disabled={sincronizando} style={A.btnPrimary}>
                                {sincronizando ? 'Sincronizando...' : '↻ Sincronizar resultado en directo'}
                            </button>
                            {msgSync && <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'#001F6B',marginTop:8,opacity:.7}}>{msgSync}</p>}
                        </div>
                    )}
                    <AdminCierreTemporada />
                    <div style={{marginTop:12}}>
                        {jornadas.map(function(j) {
                            var abierta = expandida === j.id;
                            var estadoColor = j.estado==='Abierta'?'#10b981':j.estado==='En vivo'?'#e63946':j.estado==='Finalizada'?'#001F6B':'rgba(0,31,107,0.3)';
                            return (
                                <div key={j.id} style={{marginBottom:6,border:'1px solid rgba(0,31,107,0.1)',borderRadius:12,overflow:'hidden'}}>
                                    <button onClick={function(){setExpandida(abierta?null:j.id);}}
                                        style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'12px 16px',
                                            background:abierta?'#001F6B':'#fff',border:'none',cursor:'pointer',textAlign:'left'}}>
                                        <span style={{fontFamily:"'Teko',sans-serif",fontSize:18,fontWeight:700,color:abierta?'#FFD700':'#001F6B',minWidth:28}}>J{j.numeroJornada}</span>
                                        <span style={{fontFamily:"'Teko',sans-serif",fontSize:15,letterSpacing:1,color:abierta?'rgba(255,255,255,0.8)':'#001F6B',flex:1,textTransform:'uppercase'}}>{j.equipoLocal} vs {j.equipoVisitante}</span>
                                        <span style={{...A.tag(estadoColor)}}>{j.estado}</span>
                                        {j.derbi && <span style={{fontSize:14}}>🔥</span>}
                                        <span style={{color:abierta?'#FFD700':'rgba(0,31,107,0.4)',fontSize:16}}>{abierta?'▲':'▼'}</span>
                                    </button>
                                    {abierta && <div style={{padding:'0 0 8px'}}><JornadaAdminItem jornada={j} plantilla={plantilla} /></div>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                PAGOS
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {seccion === 'pagos' && (
                <div>
                    <ConfiguracionBizum />

                    <ResetearClasificacionAdmin />

                    <CampeonInviernoAdmin />

                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:13,letterSpacing:2,color:'rgba(0,31,107,0.5)',textTransform:'uppercase',marginBottom:10}}>
                        Registro de pagos en la app
                    </p>

                    {/* Resumen por jugador */}
                    <div style={A.card}>
                        <p style={{fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:2,color:'#001F6B',marginBottom:12,textTransform:'uppercase'}}>Estado de inscripciones</p>
                        <div style={{display:'flex',flexDirection:'column',gap:8}}>
                            {JUGADORES_LISTA.map(function(j) {
                                var pago = pagos.find(function(p) { return p.jugador === j && p.tipo === 'inscripcion' && p.estado !== 'cancelado' && p.estado !== 'rechazado' && p.estado !== 'fallido'; });
                                return (
                                    <div key={j} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px solid rgba(0,31,107,0.06)'}}>
                                        <span style={{fontFamily:"'Teko',sans-serif",fontSize:16,color:'#001F6B',flex:1,letterSpacing:1}}>{j}</span>
                                        {pago ? (
                                            <span style={A.tag('#10b981')}>✅ Pagado {pago.pagoBy && pago.pagoBy!==j ? '(por '+pago.pagoBy+')' : ''}</span>
                                        ) : (
                                            <span style={A.tag('rgba(0,31,107,0.4)')}>Pendiente</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Historial de pagos */}
                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:13,letterSpacing:2,color:'rgba(0,31,107,0.5)',textTransform:'uppercase',marginBottom:10,marginTop:8}}>Historial de pagos</p>
                    {pagos.length === 0 ? (
                        <div style={{...A.card,textAlign:'center',color:'rgba(0,31,107,0.4)',fontFamily:"'Inter',sans-serif",fontSize:13}}>
                            Aún no hay pagos registrados
                        </div>
                    ) : pagos.map(function(p) {
                        var pendiente = p.estado === 'pendiente_confirmacion';
                        return (
                            <div key={p.id} style={{...A.card,display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                                <div style={{flex:1,minWidth:120}}>
                                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:16,color:'#001F6B',letterSpacing:1}}>{p.jugador}</p>
                                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'rgba(0,31,107,0.5)'}}>{p.tipo} {p.metodo==='bizum'?'· Bizum':''} {p.pagoBy && p.pagoBy!==p.jugador ? '· pagado por '+p.pagoBy : ''}</p>
                                </div>
                                <span style={{fontFamily:"'Teko',sans-serif",fontSize:18,fontWeight:700,color:'#10b981'}}>{p.importe}€</span>
                                {pendiente ? (
                                    <div style={{display:'flex',gap:6}}>
                                        <button onClick={async function() {
                                            await updateDoc(doc(db,'pagos',p.id), { estado: 'completado', confirmadoEn: serverTimestamp() });
                                            // Si es una compra de plaza vacante en El Otro Equipo, se asigna al
                                            // hueco EXACTO que el jugador eligió al pedirlo (p.vacanteId) — cada
                                            // baja es su propio registro independiente y permanente, así que esto
                                            // nunca toca sustituciones de otras bajas ya resueltas. Si la solicitud
                                            // es de antes de que existiera este campo, se usa el pendiente más
                                            // antiguo como respaldo.
                                            if (p.tipo === 'plaza_otro') {
                                                var vacanteObjetivo = null;
                                                if (p.vacanteId) {
                                                    var vSnap = await getDoc(doc(db, 'elOtroVacantes', p.vacanteId));
                                                    if (vSnap.exists() && !vSnap.data().nuevo) vacanteObjetivo = { id: vSnap.id, ...vSnap.data() };
                                                } else {
                                                    var vacantesSnap = await getDocs(collection(db, 'elOtroVacantes'));
                                                    var pendientes = [];
                                                    vacantesSnap.forEach(function(d) { var v = d.data(); if (!v.nuevo) pendientes.push({ id: d.id, ...v }); });
                                                    pendientes.sort(function(a,b) {
                                                        var ta = a.marcadoEn && a.marcadoEn.toMillis ? a.marcadoEn.toMillis() : 0;
                                                        var tb = b.marcadoEn && b.marcadoEn.toMillis ? b.marcadoEn.toMillis() : 0;
                                                        return ta - tb;
                                                    });
                                                    if (pendientes.length > 0) vacanteObjetivo = pendientes[0];
                                                }
                                                if (vacanteObjetivo) {
                                                    await setDoc(doc(db, 'elOtroVacantes', vacanteObjetivo.id), { nuevo: p.jugador, resueltoEn: serverTimestamp() }, { merge: true });
                                                    alert('✅ Pago confirmado. ' + p.jugador + ' ya tiene el hueco de ' + vacanteObjetivo.original + ' asignado — fijo, no se vuelve a mover.');
                                                } else {
                                                    alert('✅ Pago confirmado, pero ese hueco ya no está disponible (puede que otro pago se confirmara antes). Revísalo en El Otro Equipo.');
                                                }
                                            }
                                        }} style={{...A.btnSuccess,padding:'6px 14px'}}>
                                            ✅ Confirmar
                                        </button>
                                        <button onClick={async function() {
                                            var motivo = window.prompt('¿Por qué cancelas esta petición de ' + p.jugador + ' (' + p.importe + '€)?\n\nEjemplos: no llegó el Bizum, duplicado, se equivocó de importe, se ha dado de baja...');
                                            if (motivo === null) return; // canceló el propio prompt, no hacemos nada
                                            if (!motivo.trim()) { alert('Escribe un motivo, aunque sea breve — queda guardado para el historial.'); return; }
                                            await updateDoc(doc(db,'pagos',p.id), {
                                                estado: 'cancelado', motivoCancelacion: motivo.trim(), canceladoEn: serverTimestamp()
                                            });
                                        }} style={{...A.btnPrimary,padding:'6px 14px',fontSize:12,background:'rgba(230,57,70,0.1)',color:'#e63946',border:'1px solid rgba(230,57,70,0.2)'}}>
                                            ❌ Cancelar
                                        </button>
                                    </div>
                                ) : p.estado === 'cancelado' ? (
                                    <span style={{...A.tag('#e63946'), cursor: p.motivoCancelacion ? 'help' : 'default'}}
                                        title={p.motivoCancelacion || ''}>
                                        ❌ Cancelado{p.motivoCancelacion ? ': ' + p.motivoCancelacion : ''}
                                    </span>
                                ) : (
                                    <span style={A.tag('#10b981')}>{p.estado || 'ok'}</span>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                SOLICITUDES DE INGRESO
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {seccion === 'solicitudes' && (
                <div>
                    {errorSolicitudes && (
                        <div style={{...A.card,background:'rgba(230,57,70,0.08)',border:'1px solid rgba(230,57,70,0.25)',color:'#e63946',fontFamily:"'Inter',sans-serif",fontSize:12,padding:16,marginBottom:12}}>
                            ⚠️ {errorSolicitudes}
                        </div>
                    )}
                    {solicitudes.length === 0 && !errorSolicitudes ? (
                        <div style={{...A.card,textAlign:'center',color:'rgba(0,31,107,0.4)',fontFamily:"'Inter',sans-serif",fontSize:13,padding:24}}>
                            No hay solicitudes de ingreso todavía
                        </div>
                    ) : solicitudes.map(function(s, idx) {
                        var estadoColor = s.estado==='aprobada'?'#10b981':s.estado==='rechazada'?'#e63946':'#FFD700';
                        return (
                            <div key={s.id} style={A.card}>
                                <div style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:8}}>
                                    <div style={{width:28,height:28,borderRadius:'50%',background:'rgba(0,31,107,0.08)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Teko',sans-serif",fontSize:14,color:'#001F6B',flexShrink:0}}>
                                        {idx+1}
                                    </div>
                                    <div style={{flex:1}}>
                                        <p style={{fontFamily:"'Teko',sans-serif",fontSize:18,letterSpacing:1,color:'#001F6B',marginBottom:2}}>{s.nombre}</p>
                                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,31,107,0.6)'}}>{s.telefono}</p>
                                        {s.invitadoPor && <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'rgba(0,31,107,0.4)',marginTop:2}}>Invitado por: {s.invitadoPor}</p>}
                                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,marginTop:4,color: s.pinHash ? '#10b981' : '#e63946'}}>
                                            {s.pinHash ? '🔑 PIN listo — al aprobar entra directo' : '⚠️ Sin PIN (solicitud antigua) — pídele que rellene el formulario de nuevo'}
                                        </p>
                                    </div>
                                    <span style={A.tag(estadoColor)}>{s.estado || 'pendiente'}</span>
                                </div>
                                {(!s.estado || s.estado === 'pendiente') && (
                                    <div style={{display:'flex',gap:8}}>
                                        <button onClick={function(){aprobarSolicitud(s);}} style={A.btnSuccess}>✅ Aprobar</button>
                                        <button onClick={function(){rechazarSolicitud(s);}} style={A.btnDanger}>❌ Rechazar</button>
                                        <a href={'https://wa.me/34'+s.telefono.replace(/\s/g,'')}
                                            target="_blank" rel="noopener noreferrer"
                                            style={{...A.btnPrimary,textDecoration:'none',display:'inline-block',padding:'6px 12px',fontSize:12}}>
                                            WhatsApp →
                                        </a>
                                    </div>
                                )}
                                {s.estado === 'aprobada' && (
                                    <div style={{marginTop:8}}>
                                        <button onClick={function(){repararActivacion(s);}} style={{...A.btnPrimary,background:'rgba(0,31,107,0.08)',color:'#001F6B',fontSize:12,padding:'6px 12px'}}>
                                            🔧 Reparar activación (por si aprobó con la versión antigua y no puede entrar)
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                CLASIFICACIÓN GENERAL
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {seccion === 'clasificacion' && (
                <div>
                    <div style={A.card}>
                        <p style={{fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:2,color:'#001F6B',textTransform:'uppercase',marginBottom:12,fontWeight:600}}>
                            Gestión de clasificación
                        </p>
                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:13,color:'rgba(0,31,107,0.6)',marginBottom:16,lineHeight:1.6}}>
                            La clasificación se calcula automáticamente con cada jornada cerrada. Desde aquí puedes corregir puntos manualmente si hay algún error.
                        </p>
                        {JUGADORES_LISTA.map(function(j) {
                            return (
                                <div key={j} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px solid rgba(0,31,107,0.06)'}}>
                                    <span style={{fontFamily:"'Teko',sans-serif",fontSize:16,color:'#001F6B',flex:1,letterSpacing:1}}>{j}</span>
                                    <button onClick={async function() {
                                        var pts = prompt('Puntos manuales para ' + j + ' (+ para sumar, - para restar):');
                                        if (!pts || isNaN(Number(pts))) return;
                                        var snap = await getDoc(doc(db, 'clasificacion', j));
                                        var actual = snap.exists() ? (snap.data().puntos || 0) : 0;
                                        await setDoc(doc(db, 'clasificacion', j), { puntos: actual + Number(pts), nombre: j }, { merge: true });
                                        setMsgAdmin('✅ Puntos de ' + j + ' actualizados');
                                    }} style={{...A.btnPrimary,padding:'6px 12px',fontSize:12}}>
                                        ✏️ Ajustar
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    <div style={A.card}>
                        <p style={{fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:2,color:'#001F6B',textTransform:'uppercase',marginBottom:10,fontWeight:600}}>
                            Porra Anual 26/27
                        </p>
                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:13,color:'rgba(0,31,107,0.6)',marginBottom:12,lineHeight:1.6}}>
                            Gestiona las predicciones de ascenso (activas en J1-J5). Cierra el plazo cuando empiece la J6.
                        </p>
                        <button onClick={async function() {
                            await setDoc(doc(db, 'configuracion', 'porraAnual'), { abierta: false, cerradaEn: serverTimestamp() }, { merge: true });
                            setMsgAdmin('✅ Porra Anual cerrada — ya no se pueden hacer predicciones');
                        }} style={{...A.btnPrimary,background:'#e63946',color:'#fff'}}>
                            Cerrar Porra Anual
                        </button>
                    </div>
                </div>
            )}

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                HERRAMIENTAS
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {seccion === 'herramientas' && (
                <div>
                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:15,letterSpacing:3,color:'rgba(0,31,107,0.35)',textTransform:'uppercase',marginTop:28,marginBottom:10,fontWeight:700,borderBottom:'1px solid rgba(0,31,107,0.1)',paddingBottom:6}}>👤 Gestión de jugadores</p>
                    {/* Resetear tutorial */}
                    <div style={A.card}>
                        <p style={{fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:2,color:'#001F6B',textTransform:'uppercase',marginBottom:4,fontWeight:600}}>
                            🎓 Resetear tutorial
                        </p>
                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,31,107,0.5)',marginBottom:12,lineHeight:1.5}}>
                            Si un jugador saltó el tutorial y quiere verlo, selecciónalo aquí. La próxima vez que entre le aparecerá de nuevo.
                        </p>
                        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                            {JUGADORES_LISTA.map(function(j) {
                                return (
                                    <button key={j} onClick={function(){resetearTutorial(j);}} style={{...A.btnPrimary,padding:'6px 12px',fontSize:12,background:'rgba(0,31,107,0.08)',color:'#001F6B'}}>
                                        {j}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Resetear PIN */}
                    <div style={A.card}>
                        <p style={{fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:2,color:'#001F6B',textTransform:'uppercase',marginBottom:4,fontWeight:600}}>
                            🔑 Resetear PIN de jugador
                        </p>
                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,31,107,0.5)',marginBottom:12,lineHeight:1.5}}>
                            Si un jugador ha olvidado su PIN, bórralo aquí. La próxima vez que entre podrá crear uno nuevo.
                        </p>
                        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                            {JUGADORES_LISTA.map(function(j) {
                                return (
                                    <button key={j} onClick={async function() {
                                        if (!window.confirm('¿Borrar el PIN de ' + j + '? Tendrá que crear uno nuevo.')) return;
                                        await deleteDoc(doc(db, 'pines', j));
                                        setMsgAdmin('✅ PIN de ' + j + ' eliminado');
                                    }} style={{...A.btnPrimary,padding:'6px 12px',fontSize:12,background:'rgba(230,57,70,0.08)',color:'#e63946'}}>
                                        {j}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Eliminar jugador — baja definitiva */}
                    <div style={A.card}>
                        <p style={{fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:2,color:'#e63946',textTransform:'uppercase',marginBottom:4,fontWeight:600}}>
                            🗑️ Eliminar jugador
                        </p>
                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,31,107,0.5)',marginBottom:12,lineHeight:1.5}}>
                            Si alguien deja la porra definitivamente: desaparece de la pantalla de login (ya no puede entrar), se borra su PIN, y su hueco en El Otro Equipo se marca automáticamente como "disponible" — sin que tengas que hacerlo aparte.
                        </p>
                        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                            {JUGADORES_LISTA.map(function(j) {
                                return (
                                    <button key={j} onClick={async function() {
                                        if (!window.confirm('¿Eliminar a ' + j + ' definitivamente?\n\n· Ya no podrá entrar a la app\n· Si aún no había elegido equipo en El Otro, su hueco en la cola quedará "disponible"\n· Si YA había elegido equipo, se te preguntará si quieres dejar su plaza pendiente de comprar o cerrarla del todo\n\nEsto no borra su historial de puntos ni pagos pasados.')) return;
                                        try {
                                            await setDoc(doc(db, 'configuracion', 'jugadoresInactivos'), { nombres: arrayUnion(j) }, { merge: true });
                                            await deleteDoc(doc(db, 'pines', j));

                                            // ¿Ya había elegido equipo en El Otro? Si sí, se pregunta qué
                                            // hacer con la plaza — dejarla pendiente de comprar (se salta la
                                            // cola quien la pague) o cerrarla sin ofrecerla a nadie. Ya no es
                                            // una regla fija, se decide caso por caso.
                                            var elOtroSnap = await getDoc(doc(db, 'elOtro', j));
                                            var yaTeniaEquipo = elOtroSnap.exists() && elOtroSnap.data().equipo;
                                            if (yaTeniaEquipo) {
                                                var dejarComprable = window.confirm(
                                                    j + ' ya había elegido equipo (' + elOtroSnap.data().equipo + ').\n\n' +
                                                    'Pulsa ACEPTAR si quieres dejar su plaza pendiente para que alguien la pague (2€) y se salte la cola.\n\n' +
                                                    'Pulsa CANCELAR si solo quieres liberar su equipo, sin ofrecer la plaza a nadie.'
                                                );
                                                await setDoc(doc(db, 'elOtro', j), {
                                                    equipoAbandonado: elOtroSnap.data().equipo, // se guarda para el historial
                                                    equipo: null, // libera el equipo para que otro lo pueda elegir
                                                }, { merge: true });
                                                if (dejarComprable) {
                                                    await setDoc(doc(db, 'elOtroVacantes', j), { original: j, nuevo: null, marcadoEn: serverTimestamp(), resueltoEn: null });
                                                    setMsgAdmin('✅ ' + j + ' eliminado. Equipo liberado y plaza pendiente de comprar.');
                                                    alert('✅ ' + j + ' eliminado correctamente.\n\nSu equipo (' + elOtroSnap.data().equipo + ') está libre, y además su plaza queda pendiente de que alguien la pague para saltarse la cola.');
                                                } else {
                                                    setMsgAdmin('✅ ' + j + ' eliminado. Su equipo (' + elOtroSnap.data().equipo + ') ya está libre para otro jugador.');
                                                    alert('✅ ' + j + ' eliminado correctamente.\n\nYa no podrá entrar a la app. Su equipo de El Otro (' + elOtroSnap.data().equipo + ') ya está libre — cualquiera puede elegirlo ahora, sin que a ' + j + ' se le vuelva a asignar turno.');
                                                }
                                            } else {
                                                await setDoc(doc(db, 'elOtroVacantes', j), { original: j, nuevo: null, marcadoEn: serverTimestamp(), resueltoEn: null });
                                                setMsgAdmin('✅ ' + j + ' eliminado. Su hueco en El Otro Equipo ya está disponible.');
                                                alert('✅ ' + j + ' eliminado correctamente.\n\nYa no podrá entrar a la app, y su hueco en El Otro Equipo está marcado como disponible.');
                                            }
                                        } catch(e) {
                                            console.error('Error eliminando jugador:', e);
                                            alert('❌ No se pudo eliminar a ' + j + '.\n\nError: ' + e.message + '\n\nProbablemente sea un problema de permisos en las reglas de Firestore — revisa que la colección "configuracion" permita escritura.');
                                        }
                                    }} style={{...A.btnPrimary,padding:'6px 12px',fontSize:12,background:'rgba(230,57,70,0.1)',color:'#e63946',border:'1px solid rgba(230,57,70,0.2)'}}>
                                        🗑️ {j}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <PonerApodoAdmin jugadoresLista={JUGADORES_LISTA} />

                    <MostrarApellidosAdmin />

                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:15,letterSpacing:3,color:'rgba(0,31,107,0.35)',textTransform:'uppercase',marginTop:28,marginBottom:10,fontWeight:700,borderBottom:'1px solid rgba(0,31,107,0.1)',paddingBottom:6}}>🛡️ El Otro Equipo</p>
                    {/* El Otro Equipo — gestión de turnos */}
                    <div style={A.card}>
                        <p style={{fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:2,color:'#001F6B',textTransform:'uppercase',marginBottom:4,fontWeight:600}}>
                            🛡️ El Otro Equipo — control de plazos
                        </p>
                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,31,107,0.5)',marginBottom:12,lineHeight:1.5}}>
                            El plazo de elección abre el 11 agosto 12:00 y cierra el 14 agosto 18:00 (hora canaria). Desde aquí puedes forzar el cierre o reabrir el plazo.
                        </p>
                        <div style={{display:'flex',gap:8}}>
                            <button onClick={async function() {
                                await setDoc(doc(db, 'configuracion', 'elOtro'), { plazoAbierto: true }, { merge: true });
                                setMsgAdmin('✅ Plazo de El Otro Equipo abierto');
                            }} style={A.btnSuccess}>Abrir plazo</button>
                            <button onClick={async function() {
                                await setDoc(doc(db, 'configuracion', 'elOtro'), { plazoAbierto: false, cerradoEn: serverTimestamp() }, { merge: true });
                                setMsgAdmin('✅ Plazo de El Otro Equipo cerrado');
                            }} style={A.btnDanger}>Cerrar plazo</button>
                        </div>
                    </div>

                    {/* Rastreador de tiempos en vivo */}
                    <RastreadorTiemposElOtro jugadoresLista={JUGADORES_LISTA} />

                    <InfoJornadaPrimeraAdmin />

                    {/* Botón de emergencia — saltar y arrancar el siguiente cronómetro ya mismo */}
                    <SaltarTurnoAdmin />

                    {/* El Otro Equipo — hueco simbólico por baja */}
                    <GestionHuecoVacante />

                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:15,letterSpacing:3,color:'rgba(0,31,107,0.35)',textTransform:'uppercase',marginTop:28,marginBottom:10,fontWeight:700,borderBottom:'1px solid rgba(0,31,107,0.1)',paddingBottom:6}}>⭐ Plantilla y Estrellas</p>
                    {/* Buscador de IDs de API-Football para la plantilla */}
                    {/* Verificación real del enlace plantilla ↔ estadísticas */}
                    <VerificarEstadisticasJugadoresAdmin plantilla={plantilla} />

                    <BuscadorApiIdsPlantilla plantilla={plantilla} />

                    {/* Verificación visual de fotos */}
                    <VerificarEscudosPrimera teamLogos={teamLogos} />

                    <VerificarFotosPlantilla plantilla={plantilla} />

                    <GestionPlantillaAdmin plantilla={plantilla} />

                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:15,letterSpacing:3,color:'rgba(0,31,107,0.35)',textTransform:'uppercase',marginTop:28,marginBottom:10,fontWeight:700,borderBottom:'1px solid rgba(0,31,107,0.1)',paddingBottom:6}}>⚙️ General</p>
                    {/* App lanzada al público */}
                    <div style={A.card}>
                        <p style={{fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:2,color:'#001F6B',textTransform:'uppercase',marginBottom:4,fontWeight:600}}>
                            ✅ App lanzada
                        </p>
                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,31,107,0.5)',marginBottom:12,lineHeight:1.5}}>
                            El modo construcción está desactivado — la app es pública desde el 11 de agosto de 2026. Todos los jugadores ven la presentación de bienvenida la primera vez que entran.
                        </p>
                    </div>

                    {/* Enlace de invitación */}
                    <div style={A.card}>
                        <p style={{fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:2,color:'#001F6B',textTransform:'uppercase',marginBottom:4,fontWeight:600}}>
                            🔗 Enlace de invitación
                        </p>
                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,31,107,0.5)',marginBottom:12,lineHeight:1.5}}>
                            Este es el enlace base de invitación. Cuando un jugador pulsa "Invitar" en el menú, se genera con su nombre automáticamente.
                        </p>
                        <div style={{background:'rgba(0,31,107,0.06)',borderRadius:8,padding:'10px 14px',wordBreak:'break-all'}}>
                            <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'#001F6B'}}>{window.location.origin}/invitacion.html</p>
                        </div>
                    </div>
                </div>
            )}

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                RIFAS Y EVENTOS (recordatorio privado)
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {seccion === 'rifas' && (
                <div>
                    {/* Recordatorio privado */}
                    <div style={{background:'rgba(255,215,0,0.1)',border:'1px solid rgba(255,215,0,0.3)',borderRadius:14,padding:16,marginBottom:16}}>
                        <p style={{fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:2,color:'#001F6B',textTransform:'uppercase',marginBottom:6,fontWeight:600}}>
                            🎟️ Recordatorio privado — Rifas y eventos
                        </p>
                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:13,color:'rgba(0,0,0,0.6)',lineHeight:1.6}}>
                            Las rifas de navidad y eventos a lo largo de la temporada son la forma de generar ingresos adicionales para reinvertir en la app y en premios (con Bizum ya no hay comisiones que compensar). <strong>Esta sección es solo visible para ti.</strong> Los jugadores no ven nada de esto.
                        </p>
                    </div>

                    {/* Crear nueva rifa/evento */}
                    <div style={A.card}>
                        <p style={{fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:2,color:'#001F6B',textTransform:'uppercase',marginBottom:12,fontWeight:600}}>
                            Nueva rifa o evento
                        </p>
                        <label style={A.label}>Título</label>
                        <input style={A.input} value={nuevaRifa.titulo}
                            onChange={function(e){setNuevaRifa(function(r){return {...r,titulo:e.target.value};});}}
                            placeholder="Ej: Rifa de Navidad 2026" />
                        <label style={A.label}>Descripción del premio</label>
                        <input style={A.input} value={nuevaRifa.descripcion}
                            onChange={function(e){setNuevaRifa(function(r){return {...r,descripcion:e.target.value};});}}
                            placeholder="Ej: Pack merchandising UDLP + entrada al estadio" />
                        <label style={A.label}>Precio del ticket (€)</label>
                        <input style={{...A.input,width:'50%'}} type="number" value={nuevaRifa.precio}
                            onChange={function(e){setNuevaRifa(function(r){return {...r,precio:e.target.value};});}}
                            placeholder="2" />
                        <label style={A.label}>Fecha del sorteo</label>
                        <input style={{...A.input,width:'60%'}} type="date" value={nuevaRifa.fecha}
                            onChange={function(e){setNuevaRifa(function(r){return {...r,fecha:e.target.value};});}} />
                        <button onClick={crearRifa} style={A.btnPrimary}>Crear rifa →</button>
                    </div>

                    {/* Lista de rifas */}
                    {rifas.length > 0 && (
                        <div>
                            <p style={{fontFamily:"'Teko',sans-serif",fontSize:13,letterSpacing:2,color:'rgba(0,31,107,0.5)',textTransform:'uppercase',marginBottom:10}}>Rifas creadas</p>
                            {rifas.map(function(r) {
                                return (
                                    <div key={r.id} style={A.card}>
                                        <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
                                            <div style={{flex:1}}>
                                                <p style={{fontFamily:"'Teko',sans-serif",fontSize:18,color:'#001F6B',letterSpacing:1,marginBottom:2}}>{r.titulo}</p>
                                                <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,31,107,0.5)'}}>{r.descripcion}</p>
                                                <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'rgba(0,31,107,0.4)',marginTop:4}}>Sorteo: {r.fecha} · {r.precio}€/ticket</p>
                                            </div>
                                            <span style={A.tag(r.estado==='activa'?'#10b981':'rgba(0,31,107,0.4)')}>{r.estado}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};


// ============================================================================
// --- EL OTRO — Pantalla de selección y gestión del equipo de Primera ---
// ============================================================================
// Orden de elección de El Otro — basado en clasificación temporada 25/26
// El primero de la clasificación elige primero
// Los nuevos jugadores van al final (después de los 15 originales)
// Orden de elección basado en clasificación REAL temporada 25/26
// Fuente: captura Firestore 10/08/2026
const ORDEN_ELECCION_EL_OTRO = [
    "Pedrito",  // 1º
    "Sarito",   // 2º
    "Carmelo",  // 3º
    "Himar",    // 4º
    "Javi",     // 5º
    "Pedro",    // 6º
    "Juanma",   // 7º
    "José",     // 8º
    "Vicky",    // 9º
    "Mari",     // 10º
    "Lucy",     // 11º
    "Claudio",  // 12º
    "Laura",    // 13º
    "Carlos",   // 14º (IC en clasificación)
    "Antonio",  // 15º
];
// Plazo límite para elegir El Otro: jueves 13 de agosto 2026 a las 23:59
// Hora canaria = UTC+1 en verano
// Apertura: lunes 11 agosto 12:00 WEST = 11:00 UTC
// Cierre: viernes 14 agosto 18:00 WEST = 17:00 UTC
// (PLAZO_APERTURA_EL_OTRO, PLAZO_EL_OTRO, TIMEOUT_TURNO_MINUTOS,
// estaEnPausaNocturna, minutosPausaEnRango y minutosEfectivosTranscurridos
// se movieron arriba del todo del archivo, junto a CuentaAtrasElOtro, que
// es quien primero los necesita — antes estaban aquí abajo y el propio
// build de Netlify lo bloqueaba por "usado antes de definirse".)

// Multiplicador de El Otro según nº de activaciones acumuladas en la
// temporada — a partir de la 3ª (×2.5) el equipo deja de ser secreto.
function getMultiplicadorOtro(activaciones) {
    if (activaciones >= 5) return 3;
    if (activaciones >= 3) return 2.5;
    return 2;
}

// Redondeo oficial de El Otro: al multiplicar (tu equipo gana), redondeo
// AL ALZA; al dividir (tu equipo pierde), redondeo A LA BAJA. Un empate deja
// los puntos exactamente igual. PENDIENTE de conectar con el resultado real
// del partido de El Otro — ver nota en la auditoría de esta sesión.
function aplicarMultiplicadorOtro(puntos, resultado, mult) {
    if (resultado === 'empate') return puntos;
    if (resultado === 'gana') return Math.ceil(puntos * mult);
    if (resultado === 'pierde') return Math.floor(puntos / mult);
    return puntos;
}

// Calcula el orden completo de la cola de El Otro Equipo — usado tanto por
// la pantalla del jugador como por la herramienta de admin, para que las
// dos calculen SIEMPRE lo mismo y nunca se lleven la contraria entre sí.
// Reglas: cada hueco vacante sustituye su posición original (con el
// registro nuevo o con un marcador si sigue sin asignar); los aprobados por
// invitación se añaden al final por orden real de entrada; y quien ha sido
// saltado por agotar el tiempo pasa al final de la cola, con una segunda
// oportunidad, en vez de quedar bloqueado para siempre.
function esMarcadorVacanteEO(j) { return typeof j === 'string' && j.indexOf('__VACANTE_') === 0; }

function calcularOrdenElOtro(datos, vacantes, jugadoresAprobados, jugadoresInactivos) {
    var baseOrden = ORDEN_ELECCION_EL_OTRO.slice();
    vacantes.forEach(function(v) {
        var idxVac = baseOrden.indexOf(v.original);
        if (idxVac !== -1) baseOrden[idxVac] = v.nuevo || ('__VACANTE_' + v.id + '__');
    });

    var nuevosAprobados = jugadoresAprobados.filter(function(j) {
        return jugadoresInactivos.indexOf(j) === -1 && baseOrden.indexOf(j) === -1;
    });
    var otrosConDocumento = Object.keys(datos).filter(function(j) {
        return baseOrden.indexOf(j) === -1 && nuevosAprobados.indexOf(j) === -1;
    });
    var nuevos = [].concat(nuevosAprobados, otrosConDocumento).filter(function(j) {
        return !datos[j] || !datos[j].equipo;
    });
    var ordenCompleto = [].concat(baseOrden, nuevos);

    var pendientesNormales = ordenCompleto.filter(function(j) {
        return esMarcadorVacanteEO(j) || !datos[j] || (!datos[j].equipo && !datos[j].saltado);
    });
    var saltadosSinEquipo = ordenCompleto.filter(function(j) {
        return !esMarcadorVacanteEO(j) && datos[j] && datos[j].saltado && !datos[j].equipo;
    });
    return [].concat(pendientesNormales, saltadosSinEquipo);
}

// A quién le toca de esa cola — el primero que no tenga equipo todavía,
// saltándose marcadores de hueco vacante y jugadores eliminados (nunca
// vuelven a recibir turno, aunque su equipo se haya quedado libre).
function calcularTurnoElOtro(ordenConf, datos, jugadoresInactivos) {
    for (var i = 0; i < ordenConf.length; i++) {
        var j = ordenConf[i];
        if (esMarcadorVacanteEO(j)) continue;
        if (jugadoresInactivos.indexOf(j) !== -1) continue;
        if (!datos[j] || !datos[j].equipo) return j;
    }
    return null;
}

// Si alguien lleva 3 turnos saltados sin elegir (por lo que sea — se olvida,
// no se entera, lo que sea), se le asigna un equipo al azar entre los que
// sigan libres, para que no bloquee la cola indefinidamente. Es el caso que
// pasó con Claudio.
function elegirEquipoAleatorioDisponible(datosElOtro) {
    var tomados = Object.values(datosElOtro).map(function(d) { return d.equipo; }).filter(Boolean);
    var disponibles = EQUIPOS_PRIMERA_DIVISION.filter(function(e) { return tomados.indexOf(e) === -1; });
    if (disponibles.length === 0) return null;
    return disponibles[Math.floor(Math.random() * disponibles.length)];
}

const ElOtroScreen = ({ currentUser, userProfiles, pagos, onIrAPagos, teamLogos }) => {
    var G = styles.colors;
    var [miElOtro, setMiElOtro] = useState(null);
    var [todosElOtro, setTodosElOtro] = useState({});
    var [ordenFinal, setOrdenFinal] = useState([]);
    var [turnoActual, setTurnoActual] = useState(null);
    var [tiempoRestante, setTiempoRestante] = useState(null);
    var [guardando, setGuardando] = useState(false);
    var [loading, setLoading] = useState(true);
    var [equiposDisponibles, setEquiposDisponibles] = useState(EQUIPOS_PRIMERA_DIVISION);
    var [enPausaNocturna, setEnPausaNocturna] = useState(false);
    var [vacantes, setVacantes] = useState([]); // lista de { id, original, nuevo, marcadoEn, resueltoEn } — cada baja es su propio registro permanente
    var [comprandoPlazaId, setComprandoPlazaId] = useState(null); // id de la vacante que se está comprando ahora mismo
    var [bizumInfo, setBizumInfo] = useState({ nombre: 'Juanma', telefono: '' });
    var [copiadoPlaza, setCopiadoPlaza] = useState(false);
    var [heEnviadoPlaza, setHeEnviadoPlaza] = useState(false);
    var [enviandoPlaza, setEnviandoPlaza] = useState(false);
    var [jugadoresAprobados, setJugadoresAprobados] = useState([]); // nuevos por invitación, en orden real de entrada
    var [jugadoresInactivos, setJugadoresInactivos] = useState([]);

    useEffect(function() {
        var unsub = onSnapshot(doc(db, 'configuracion', 'jugadoresAprobados'), function(snap) {
            setJugadoresAprobados(snap.exists() ? (snap.data().nombres || []) : []);
        });
        return function() { unsub(); };
    }, []);

    useEffect(function() {
        var unsub = onSnapshot(doc(db, 'configuracion', 'jugadoresInactivos'), function(snap) {
            setJugadoresInactivos(snap.exists() ? (snap.data().nombres || []) : []);
        });
        return function() { unsub(); };
    }, []);

    useEffect(function() {
        var unsub = onSnapshot(doc(db, 'configuracion', 'bizum'), function(snap) {
            if (snap.exists()) setBizumInfo(snap.data());
        });
        return function() { unsub(); };
    }, []);

    useEffect(function() {
        var unsub = onSnapshot(collection(db, 'elOtroVacantes'), function(snap) {
            var lista = [];
            snap.forEach(function(d) { lista.push({ id: d.id, ...d.data() }); });
            lista.sort(function(a,b) {
                var ta = a.marcadoEn && a.marcadoEn.toMillis ? a.marcadoEn.toMillis() : 0;
                var tb = b.marcadoEn && b.marcadoEn.toMillis ? b.marcadoEn.toMillis() : 0;
                return ta - tb;
            });
            setVacantes(lista);
        });
        return function() { unsub(); };
    }, []);

    useEffect(function() {
        if (!currentUser) return;
        var unsub = onSnapshot(collection(db, "elOtro"), function(snap) {
            var datos = {};
            snap.forEach(function(d) { datos[d.id] = d.data(); });
            setTodosElOtro(datos);
            // Mi dato
            if (datos[currentUser]) setMiElOtro(datos[currentUser]);
            else setMiElOtro(null);
            setLoading(false);
        });
        return function() { unsub(); };
    }, [currentUser]);

    // Recalcula orden, turno y equipos disponibles cada vez que cambian los
    // datos de elección O el hueco vacante — así el "privilegio" del hueco
    // se aplica al instante en cuanto el admin asigna un nuevo nombre.
    // Usa las funciones compartidas (calcularOrdenElOtro / calcularTurnoElOtro)
    // para que esta pantalla y la herramienta de admin de "saltar turno"
    // calculen exactamente lo mismo, siempre.
    useEffect(function() {
        var datos = todosElOtro;
        var ordenConf = calcularOrdenElOtro(datos, vacantes, jugadoresAprobados, jugadoresInactivos);
        setOrdenFinal(ordenConf);

        // Los equipos de jugadores ELIMINADOS no cuentan como "cogidos" — si
        // alguien abandona tras haber elegido, su equipo vuelve a estar libre
        // para el resto (el campo equipo se limpia al eliminarlo, más abajo).
        var equiposTomados = Object.keys(datos)
            .filter(function(j) { return jugadoresInactivos.indexOf(j) === -1; })
            .map(function(j) { return datos[j].equipo; })
            .filter(Boolean);
        setEquiposDisponibles(EQUIPOS_PRIMERA_DIVISION.filter(function(e) { return equiposTomados.indexOf(e) === -1; }));

        // El turno es del primer jugador en el orden (ya sin bloquear a los
        // saltados — reaparecen al final, con su cronómetro reiniciado).
        // El draft no arranca hasta PLAZO_APERTURA_EL_OTRO, y se pausa cada
        // noche de 01:00 a 09:00 — nadie recibe turno nuevo en ese tramo.
        var ahoraCheck = new Date();
        var draftAbierto = ahoraCheck >= PLAZO_APERTURA_EL_OTRO && !estaEnPausaNocturna(ahoraCheck);
        setEnPausaNocturna(ahoraCheck >= PLAZO_APERTURA_EL_OTRO && estaEnPausaNocturna(ahoraCheck));
        var turno = draftAbierto ? calcularTurnoElOtro(ordenConf, datos, jugadoresInactivos) : null;
        setTurnoActual(turno);

        // En cuanto alguien pasa a ser "el turno actual", le arrancamos el
        // cronómetro de 60 minutos si aún no lo tenía (primera vez que le toca,
        // o le toca de nuevo tras haber sido saltado). Solo el propio dueño del
        // turno escribe su marca de tiempo, para evitar carreras entre clientes.
        if (turno && turno === currentUser) {
            var miDato = datos[turno];
            var necesitaArranque = !miDato || !miDato.turnoIniciadoEn || miDato.saltado;
            if (necesitaArranque) {
                setDoc(doc(db, "elOtro", turno), {
                    turnoIniciadoEn: serverTimestamp(), saltado: false
                }, { merge: true }).catch(function(){});
            }
        }
    }, [todosElOtro, vacantes, currentUser, jugadoresAprobados, jugadoresInactivos]);

    // Temporizador: cuenta atrás de 60 minutos del turno ACTUAL (sea de quien
    // sea) — antes solo corría en el móvil de la propia persona a la que le
    // tocaba, así que si cerraba la app o se dormía, nadie más comprobaba su
    // tiempo y el salto automático nunca llegaba a dispararse. Ahora corre en
    // CUALQUIER dispositivo que tenga esta pantalla abierta — basta con que
    // una sola persona del grupo tenga la app abierta en algún momento para
    // que el salto se aplique a quien corresponda, sea quien sea.
    useEffect(function() {
        if (!turnoActual) { setTiempoRestante(null); return; }
        var datos = todosElOtro[turnoActual];
        if (!datos || !datos.turnoIniciadoEn) { setTiempoRestante(null); return; }

        var intervalo = setInterval(function() {
            var ahora = new Date();
            var inicio = datos.turnoIniciadoEn.toDate ? datos.turnoIniciadoEn.toDate() : new Date(datos.turnoIniciadoEn);
            var transcurrido = minutosEfectivosTranscurridos(inicio, ahora); // descuenta la pausa nocturna
            var restante = TIMEOUT_TURNO_MINUTOS - transcurrido;
            if (restante <= 0) {
                if (turnoActual === currentUser) setTiempoRestante(0);
                clearInterval(intervalo);
                // Cualquiera que tenga la pantalla abierta puede escribir el
                // salto de quien le tocaba — no hace falta que sea la propia
                // persona, así nunca se queda el draft bloqueado esperando a
                // alguien que no está mirando el móvil. A la 3ª vez seguida
                // sin elegir, se le asigna un equipo al azar entre los libres.
                var vecesSaltadoPreviasAuto = (datos.vecesSaltado || 0);
                var vecesSaltadoNuevoAuto = vecesSaltadoPreviasAuto + 1;
                if (vecesSaltadoNuevoAuto >= 3) {
                    var equipoAzarAuto = elegirEquipoAleatorioDisponible(todosElOtro);
                    setDoc(doc(db, "elOtro", turnoActual), {
                        saltado: false, vecesSaltado: vecesSaltadoNuevoAuto,
                        equipo: equipoAzarAuto, elegidoEn: serverTimestamp(), revelado: false,
                        asignadoAlAzarPor3Saltos: true,
                    }, { merge: true }).catch(function(){});
                } else {
                    setDoc(doc(db, "elOtro", turnoActual), { saltado: true, vecesSaltado: vecesSaltadoNuevoAuto }, { merge: true }).catch(function(){});
                }
            } else if (turnoActual === currentUser) {
                setTiempoRestante(Math.ceil(restante));
            }
        }, 10000);
        return function() { clearInterval(intervalo); };
    }, [turnoActual, currentUser, todosElOtro]);

    var elegirEquipo = function(equipo) {
        if (guardando) return;
        if (turnoActual !== currentUser) return;
        if (miElOtro && miElOtro.equipo) return;

        var confirmado = window.confirm(
            '¿Elegir ' + equipo + ' como tu Otro Equipo?\n\n' +
            '⚠️ Es DEFINITIVO — no podrás cambiarlo en toda la temporada.\n\n' +
            'Recuerda las condiciones:\n' +
            '· Será SECRETO durante tus 3 primeras activaciones.\n' +
            '· A partir de la 4ª activación (×2.5) se hace público para todos.\n' +
            '· Si ' + equipo + ' gana su partido → multiplicas tus puntos de la jornada (redondeo al alza).\n' +
            '· Si empata → tus puntos se quedan igual.\n' +
            '· Si pierde → tus puntos se dividen (redondeo a la baja).\n' +
            '· El multiplicador sube con el uso: ×2 al principio, ×2.5 desde la 3ª activación, ×3 desde la 5ª.\n\n' +
            '¿Confirmas ' + equipo + '?'
        );
        if (!confirmado) return;

        setGuardando(true);
        setDoc(doc(db, "elOtro", currentUser), {
            equipo: equipo,
            activaciones: 0,
            historial: [],
            elegidoEn: serverTimestamp(),
            revelado: false,
        }, { merge: true }).then(function() {
            setGuardando(false);
        }).catch(function(e) {
            console.error(e);
            setGuardando(false);
            alert('❌ No se pudo guardar tu equipo: ' + e.message + '\n\nVuelve a intentarlo. Si sigue fallando, avisa a Juanma — puede ser un permiso de Firestore sin actualizar.');
        });
    };

    // Comprar un hueco vacante por 2€ — no obligatorio, cualquiera que aún no
    // haya elegido equipo puede pedirlo. Usa el mismo circuito de Bizum +
    // aprobación manual que el resto de pagos. Cuando el admin confirma este
    // pago concreto, la app asigna automáticamente ESE hueco (por su id) a
    // este jugador — nunca toca ningún otro hueco, aunque haya varios a la vez.
    var yaSolicitePlaza = function(vacanteId) {
        return (pagos || []).some(function(p) {
            return p.tipo === 'plaza_otro' && p.jugador === currentUser && p.estado !== 'fallido' &&
                (p.vacanteId === vacanteId || (!p.vacanteId && !vacanteId));
        });
    };

    var confirmarCompraPlaza = async function(vacanteId, nombreOriginal) {
        setEnviandoPlaza(true);
        try {
            await addDoc(collection(db, 'pagos'), {
                jugador: currentUser,
                pagoBy: currentUser,
                tipo: 'plaza_otro',
                vacanteId: vacanteId,
                importe: 2,
                descripcion: 'Plaza en El Otro Equipo (hueco de ' + nombreOriginal + ')',
                metodo: 'bizum',
                estado: 'pendiente_confirmacion',
                creadoEn: serverTimestamp(),
            });
            setComprandoPlazaId(null);
            setHeEnviadoPlaza(false);
        } catch(e) {
            console.error(e);
            alert('No se pudo registrar la solicitud. Inténtalo de nuevo.');
        }
        setEnviandoPlaza(false);
    };

    var revelarEquipo = function() {
        if (!miElOtro || !miElOtro.equipo) return;
        if (miElOtro.revelado) return;
        if (!window.confirm('¿Seguro que quieres revelar tu equipo? Esta acción no se puede deshacer.')) return;
        setDoc(doc(db, "elOtro", currentUser), { revelado: true }, { merge: true });
    };

    var esMiTurno = turnoActual === currentUser;
    var yoElegí = miElOtro && miElOtro.equipo;
    var plazoSuperado = new Date() > PLAZO_EL_OTRO;

    // Aviso de "ya te toca" — vibra el móvil una sola vez en cuanto pasa a
    // ser tu turno (no repite en cada repintado). No hace falta ningún
    // permiso nuevo para esto, funciona directo en cualquier navegador móvil
    // que lo soporte.
    useEffect(function() {
        if (esMiTurno && !yoElegí && navigator.vibrate) {
            navigator.vibrate([200, 100, 200, 100, 200]);
        }
    }, [esMiTurno, yoElegí]);

    if (loading) return <div style={{padding:40,textAlign:'center',color:G.deepBlue,fontFamily:"'Teko',sans-serif",fontSize:20,letterSpacing:2}}>CARGANDO...</div>;

    // Bloqueo hasta que pague
    if (!jugadorHaPagado(currentUser, pagos || [])) {
        return (
            <div style={{paddingBottom:40}}>
                <h2 style={styles.title}>EL OTRO EQUIPO</h2>
                <BannerPagoPendiente onIrAPagos={onIrAPagos} />
            </div>
        );
    }

    return (
        <div style={{padding:'16px 0'}}>
            <h2 style={styles.title}>EL OTRO</h2>

            {/* Todo el contenido va en tarjeta blanca — así el texto azul oscuro
                se lee bien tanto en tono claro como en tono oscuro de la app */}
            <div style={{background:'#fff',borderRadius:20,padding:18,boxShadow:'0 4px 20px rgba(0,0,0,0.15)'}}>

            {/* Reglas — en burbujas desplegables */}
            <AcordeonAyuda icono="📖" titulo="Cómo funciona" abiertoPorDefecto={false}>
                <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:G.deepBlue,opacity:.7,lineHeight:1.7,margin:0}}>
                    Cada jugador tiene un equipo de Primera División asignado para <strong>la primera vuelta</strong>. Cada jornada decides si lo activas o no — actívalo antes de que empiece la jornada de Primera de tu equipo. Si <strong>gana</strong> → multiplicas tus puntos de esa jornada (redondeo al alza). Si <strong>empata</strong> → tus puntos se quedan igual. Si <strong>pierde</strong> → tus puntos se dividen (redondeo a la baja). El multiplicador sube con el <strong>uso consecutivo</strong>: <strong>×2</strong> al principio, <strong>×2.5</strong> desde tu 3ª activación consecutiva, <strong>×3</strong> desde la 5ª consecutiva. Tu equipo es <strong>secreto durante las 3 primeras activaciones</strong> — a partir de ahí (×2.5) se hace público para todos. <strong>Si te saltas una jornada sin activar, el acumulado se pierde y vuelves a ×2</strong> — perder una jornada activada NO te hace decaer, solo el no activar. <strong>En la mitad de temporada</strong>, los comodines de El Otro Equipo serán desactivados y se volverá a elegir equipo <strong>en orden inverso</strong>: los últimos de la primera ronda elegirán primero en la segunda.
                </p>
            </AcordeonAyuda>

            <AcordeonAyuda icono="⏱️" titulo="Cómo van los turnos" abiertoPorDefecto={false}>
                <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:G.deepBlue,opacity:.7,lineHeight:1.7,margin:0}}>
                    El draft empieza esta noche a las <strong>00:00</strong>. Cuando te toca, tienes <strong>60 minutos</strong> para elegir tu equipo. Si se acaba el tiempo, pasas automáticamente al <strong>final de la cola</strong> — no pierdes tu turno del todo, solo se retrasa hasta que todos los demás hayan elegido.
                </p>
            </AcordeonAyuda>

            {/* Cuenta atrás — apertura de temporada, o pausa nocturna */}
            <CuentaAtrasElOtro />

            {/* Aviso: pausa nocturna — por igualdad de condiciones, ya que hay gente durmiendo */}
            {enPausaNocturna && (
                <div style={{background:'rgba(0,31,107,0.06)',borderRadius:14,padding:18,marginBottom:16,textAlign:'center',border:'1px dashed rgba(0,31,107,0.2)'}}>
                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:16,letterSpacing:1,color:G.deepBlue,marginBottom:4}}>
                        🌙 El draft está en pausa
                    </p>
                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:G.deepBlue,opacity:.6}}>
                        De 01:00 a 09:00 nadie elige — por igualdad de condiciones, ya que hay gente durmiendo. Se retoma a las 09:00 exactamente donde se quedó, sin que nadie pierda su turno por esto.
                    </p>
                </div>
            )}

            {/* Plazo */}
            <div style={{background: plazoSuperado ? 'rgba(230,57,70,0.08)' : 'rgba(255,215,0,0.1)', borderRadius:12, padding:'10px 16px', marginBottom:20, border:`1px solid ${plazoSuperado ? 'rgba(230,57,70,0.3)' : 'rgba(255,215,0,0.3)'}`, display:'flex', alignItems:'center', gap:10}}>
                <i className="ti ti-clock" style={{fontSize:18, color: plazoSuperado ? G.danger : G.golden}} aria-hidden="true" />
                <span style={{fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:1,color: plazoSuperado ? G.danger : G.deepBlue}}>
                    {plazoSuperado ? 'PLAZO CERRADO' : 'Plazo límite: ' + PLAZO_EL_OTRO.toLocaleDateString('es-ES', {weekday:'long', day:'numeric', month:'short', timeZone:'Atlantic/Canary'}) + ' · ' + PLAZO_EL_OTRO.toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit', timeZone:'Atlantic/Canary'}) + 'h'}
                </span>
            </div>

            {/* Mi equipo elegido */}
            {yoElegí && (
                <div style={{background:'#001F6B',borderRadius:18,padding:24,textAlign:'center',marginBottom:24}}>
                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:11,letterSpacing:4,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',marginBottom:6}}>Tu equipo secreto</p>
                    {miElOtro.revelado ? (
                        <p style={{fontFamily:"'Teko',sans-serif",fontSize:32,fontWeight:700,color:'#FFD700',letterSpacing:2}}>{miElOtro.equipo}</p>
                    ) : (
                        <div>
                            <p style={{fontFamily:"'Teko',sans-serif",fontSize:28,color:'rgba(255,255,255,0.2)',letterSpacing:4}}>??? ??? ???</p>
                            <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'rgba(255,255,255,0.3)',marginTop:4}}>Solo tú sabes cuál es</p>
                            <button onClick={revelarEquipo} style={{marginTop:12,background:'rgba(255,215,0,0.1)',border:'1px solid rgba(255,215,0,0.3)',color:'#FFD700',fontFamily:"'Teko',sans-serif",fontSize:13,letterSpacing:2,padding:'8px 20px',borderRadius:20,cursor:'pointer',textTransform:'uppercase'}}>
                                Revelar mi equipo
                            </button>
                        </div>
                    )}
                    <div style={{display:'flex',justifyContent:'center',gap:32,marginTop:20}}>
                        <div style={{textAlign:'center'}}>
                            <p style={{fontFamily:"'Teko',sans-serif",fontSize:28,fontWeight:700,color:'#FFD700'}}>{miElOtro.activaciones || 0}</p>
                            <p style={{fontFamily:"'Inter',sans-serif",fontSize:10,color:'rgba(255,255,255,0.35)',letterSpacing:2,textTransform:'uppercase'}}>Activaciones</p>
                        </div>
                        <div style={{textAlign:'center'}}>
                            <p style={{fontFamily:"'Teko',sans-serif",fontSize:28,fontWeight:700,color:(miElOtro.activaciones||0) >= MIN_ACTIVACIONES_EL_OTRO ? '#FFD700' : G.danger}}>
                                {Math.max(0, MIN_ACTIVACIONES_EL_OTRO - (miElOtro.activaciones || 0))}
                            </p>
                            <p style={{fontFamily:"'Inter',sans-serif",fontSize:10,color:'rgba(255,255,255,0.35)',letterSpacing:2,textTransform:'uppercase'}}>Restantes</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Es mi turno — elegir equipo */}
            {!yoElegí && esMiTurno && !plazoSuperado && (
                <div>
                    <div style={{background:'rgba(255,215,0,0.12)',border:'1.5px solid #FFD700',borderRadius:14,padding:'12px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:10}}>
                        <i className="ti ti-star-filled" style={{fontSize:20,color:'#FFD700'}} aria-hidden="true" />
                        <div>
                            <p style={{fontFamily:"'Teko',sans-serif",fontSize:16,fontWeight:700,color:G.deepBlue,letterSpacing:1}}>¡ES TU TURNO!</p>
                            {tiempoRestante !== null && <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:G.deepBlue,opacity:.6}}>Tienes {tiempoRestante} min para elegir antes de que pase al siguiente</p>}
                        </div>
                    </div>
                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:G.deepBlue,opacity:.6,textAlign:'center',marginBottom:16}}>
                        Elige tu equipo de Primera División — una vez elegido no se puede cambiar y será secreto
                    </p>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(110px,1fr))',gap:10}}>
                        {equiposDisponibles.map(function(equipo) {
                            return (
                                <button key={equipo} onClick={function() { elegirEquipo(equipo); }} disabled={guardando}
                                    style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6,
                                        padding:'14px 8px',borderRadius:14,border:'1.5px solid rgba(0,31,107,0.12)',
                                        background:'#fff',cursor:'pointer',textAlign:'center',boxShadow:'0 1px 4px rgba(0,31,107,0.06)'}}>
                                    <img src={getLogoEquipo(equipo, teamLogos)} alt={equipo}
                                        style={{width:40,height:40,objectFit:'contain'}}
                                        onError={function(e){e.target.src='https://placehold.co/60x60/001F6B/FFD700?text=' + encodeURIComponent(equipo.substring(0,3));}} />
                                    <span style={{fontFamily:"'Teko',sans-serif",fontSize:13,fontWeight:600,letterSpacing:0.5,color:G.deepBlue,textTransform:'uppercase',lineHeight:1.15}}>
                                        {equipo}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Esperando turno */}
            {!yoElegí && !esMiTurno && !plazoSuperado && (
                <div style={{background:'rgba(0,31,107,0.04)',borderRadius:14,padding:20,textAlign:'center',marginBottom:20,border:'1px solid rgba(0,31,107,0.08)'}}>
                    <i className="ti ti-hourglass" style={{fontSize:32,color:G.deepBlue,opacity:.3}} aria-hidden="true" />
                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:18,color:G.deepBlue,letterSpacing:2,marginTop:8}}>ESPERANDO TU TURNO</p>
                    {turnoActual && <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:G.deepBlue,opacity:.5,marginTop:4}}>Ahora está eligiendo: <strong>{nombreVisible(turnoActual, userProfiles[turnoActual])}</strong></p>}
                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:G.deepBlue,opacity:.4,marginTop:8}}>Recibirás acceso automáticamente cuando te toque</p>
                </div>
            )}

            {/* La compra de hueco vacante ya no vive aquí como tarjeta aparte —
                ahora aparece integrada en su sitio exacto dentro de la lista
                de "Estado del draft" justo abajo, para que quede claro en
                qué posición de la cola está cada hueco disponible. */}

            {/* Estado del draft — quién ha elegido ya. Los que se han dado de
                baja (activos o no) no se muestran — ni como "baja" ni como
                "hueco libre": simplemente desaparecen de la lista, y su
                posición la ocupa quien corresponda de forma natural. */}
            <div style={{marginTop:24}}>
                <p style={{fontFamily:"'Teko',sans-serif",fontSize:13,letterSpacing:3,color:G.deepBlue,opacity:.4,textTransform:'uppercase',marginBottom:12}}>Estado del draft</p>
                {ordenFinal.filter(function(jugador) {
                    return jugadoresInactivos.indexOf(jugador) === -1;
                }).map(function(jugador, i) {
                    // Hueco vacante en esta posición — cada uno con su propio
                    // marcador (__VACANTE_<id>__), así que nunca se confunden
                    // entre sí. Si está sin asignar, aquí mismo se puede pagar
                    // 2€ para ocuparlo — ligado a ESTE hueco en concreto.
                    if (typeof jugador === 'string' && jugador.indexOf('__VACANTE_') === 0) {
                        var vacanteId = jugador.slice('__VACANTE_'.length, -2);
                        var v = vacantes.find(function(vv) { return vv.id === vacanteId; });
                        if (!v) return null;
                        var puedoComprar = !(miElOtro && miElOtro.equipo);
                        var yaPedida = yaSolicitePlaza(v.id);
                        var comprandoEste = comprandoPlazaId === v.id;
                        return (
                            <div key={'vac-'+v.id} style={{padding:'10px 0',borderBottom:'1px dashed rgba(255,215,0,0.35)'}}>
                                <div style={{display:'flex',alignItems:'center',gap:12}}>
                                    <span style={{fontFamily:"'Teko',sans-serif",fontSize:16,color:'rgba(0,31,107,0.25)',width:24,textAlign:'center',fontWeight:700}}>{i+1}</span>
                                    <span style={{width:26,height:26,borderRadius:'50%',background:'rgba(255,215,0,0.12)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:13}}>🎟️</span>
                                    <span style={{flex:1,fontFamily:"'Teko',sans-serif",fontSize:16,letterSpacing:1,color:'rgba(0,31,107,0.4)',fontStyle:'italic',textTransform:'uppercase'}}>Hueco disponible</span>
                                    {puedoComprar && !yaPedida && !comprandoEste && (
                                        <button onClick={function(){ setComprandoPlazaId(v.id); }} style={{
                                            fontFamily:"'Teko',sans-serif",fontSize:12,letterSpacing:1,background:'#001F6B',color:'#FFD700',
                                            border:'none',borderRadius:16,padding:'6px 14px',cursor:'pointer'}}>
                                            Comprar — 2€
                                        </button>
                                    )}
                                    {yaPedida && !comprandoEste && (
                                        <span style={{fontFamily:"'Inter',sans-serif",fontSize:11,background:'rgba(255,215,0,0.15)',color:'#b8860b',padding:'3px 10px',borderRadius:10}}>⏳ Pendiente de pago</span>
                                    )}
                                </div>
                                {comprandoEste && (
                                    <div style={{marginTop:10,marginLeft:38,background:'rgba(255,215,0,0.06)',border:'1px dashed rgba(255,215,0,0.35)',borderRadius:12,padding:14}}>
                                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:G.deepBlue,opacity:.7,marginBottom:10,lineHeight:1.5}}>
                                            Págalo por <strong>2€</strong> y pasas a ocupar esa posición en la cola — eliges tu equipo antes que el resto de gente por detrás tuya. No es obligatorio.
                                        </p>
                                        <p style={{fontFamily:"'Teko',sans-serif",fontSize:13,letterSpacing:1,color:G.deepBlue,marginBottom:6}}>1 · Envía 2€ por Bizum a</p>
                                        <p style={{fontFamily:"'Teko',sans-serif",fontSize:20,fontWeight:700,color:G.deepBlue,marginBottom:2}}>
                                            {bizumInfo.telefono || '(número pendiente de configurar)'}
                                        </p>
                                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:G.deepBlue,opacity:.5,marginBottom:10}}>{bizumInfo.nombre}</p>
                                        {bizumInfo.telefono && (
                                            <button onClick={function() {
                                                navigator.clipboard.writeText(bizumInfo.telefono);
                                                setCopiadoPlaza(true); setTimeout(function(){setCopiadoPlaza(false);}, 2000);
                                            }} style={{fontFamily:"'Teko',sans-serif",fontSize:12,letterSpacing:1,background:'#0091FF',color:'#fff',
                                                border:'none',borderRadius:20,padding:'6px 16px',cursor:'pointer',marginBottom:14}}>
                                                {copiadoPlaza ? '✓ Copiado' : '📋 Copiar número'}
                                            </button>
                                        )}
                                        <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',marginBottom:12}}>
                                            <input type="checkbox" checked={heEnviadoPlaza} onChange={function(e){setHeEnviadoPlaza(e.target.checked);}}
                                                style={{width:18,height:18,accentColor:G.deepBlue}} />
                                            <span style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:G.deepBlue}}>Ya he enviado los 2€</span>
                                        </label>
                                        <div style={{display:'flex',gap:8}}>
                                            <button onClick={function(){ confirmarCompraPlaza(v.id, v.original); }} disabled={!heEnviadoPlaza || enviandoPlaza} style={{
                                                fontFamily:"'Teko',sans-serif",fontSize:13,letterSpacing:1,background:G.deepBlue,color:'#FFD700',
                                                border:'none',borderRadius:20,padding:'8px 18px',cursor:'pointer',opacity:heEnviadoPlaza?1:0.5}}>
                                                {enviandoPlaza ? 'Enviando...' : 'Confirmar solicitud'}
                                            </button>
                                            <button onClick={function(){setComprandoPlazaId(null);}} style={{
                                                fontFamily:"'Inter',sans-serif",fontSize:12,background:'none',color:'rgba(0,31,107,0.5)',
                                                border:'none',cursor:'pointer'}}>Cancelar</button>
                                        </div>
                                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:G.deepBlue,opacity:.4,marginTop:10}}>
                                            Tu solicitud queda pendiente hasta que {bizumInfo.nombre} confirme el pago — entonces pasarás a ocupar el hueco automáticamente.
                                        </p>
                                    </div>
                                )}
                            </div>
                        );
                    }
                    var datos = todosElOtro[jugador] || {};
                    var eligió = !!datos.equipo;
                    var esTurno = turnoActual === jugador;
                    var esSaltado = !!datos.saltado;
                    // Secretismo: solo se ve el escudo real a partir de la 3ª
                    // activación (cuando el multiplicador llega a ×2.5). Antes
                    // de eso, un icono de persona genérico — nadie sabe qué
                    // equipo es, solo que ya lo tiene elegido.
                    var revelablePorUso = (datos.activaciones || 0) >= 3;
                    var muestraEscudo = eligió && (datos.revelado || revelablePorUso);
                    return (
                        <div key={jugador} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:'1px solid rgba(0,31,107,0.05)'}}>
                            <span style={{fontFamily:"'Teko',sans-serif",fontSize:16,color:esTurno ? '#FFD700' : 'rgba(0,31,107,0.3)',width:24,textAlign:'center',fontWeight:700}}>{i+1}</span>
                            {eligió ? (
                                muestraEscudo ? (
                                    <img src={getLogoEquipo(datos.equipo, teamLogos)} alt={datos.equipo} style={{width:26,height:26,objectFit:'contain',flexShrink:0}}
                                        onError={function(e){e.target.style.display='none';}} />
                                ) : (
                                    <span style={{width:26,height:26,borderRadius:'50%',background:'rgba(0,31,107,0.08)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:14}}>👤</span>
                                )
                            ) : (
                                <span style={{width:26,flexShrink:0}} />
                            )}
                            <span style={{flex:1,fontFamily:"'Teko',sans-serif",fontSize:16,letterSpacing:1,color: eligió ? G.deepBlue : esTurno ? G.deepBlue : 'rgba(0,31,107,0.4)',textTransform:'uppercase'}}>{nombreVisible(jugador, userProfiles[jugador])}</span>
                            {eligió ? (
                                <span style={{fontFamily:"'Inter',sans-serif",fontSize:11,background:'rgba(16,185,129,0.1)',color:'#10b981',padding:'3px 10px',borderRadius:10}}>{muestraEscudo ? '✓ '+datos.equipo : '✓ Equipo elegido'}</span>
                            ) : esTurno && !esSaltado ? (
                                <span style={{fontFamily:"'Inter',sans-serif",fontSize:11,background:'rgba(255,215,0,0.15)',color:'#d4af37',padding:'3px 10px',borderRadius:10}}>← Turno</span>
                            ) : esSaltado ? (
                                <span style={{fontFamily:"'Inter',sans-serif",fontSize:11,background:'rgba(230,57,70,0.1)',color:G.danger,padding:'3px 10px',borderRadius:10}}>Saltado</span>
                            ) : (
                                <span style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'rgba(0,31,107,0.25)'}}>Pendiente</span>
                            )}
                        </div>
                    );
                })}
            </div>
            </div>
        </div>
    );
};

// ============================================================================
// --- MIS 5 ESTRELLAS — Selección de jugadores UDLP por jornada ---
// ============================================================================
const MisEstrellasScreen = ({ currentUser, plantilla, userProfiles, pagos, onIrAPagos }) => {
    const G = styles.colors;
    const [jornadaActual, setJornadaActual] = useState(null);
    const [seleccion, setSeleccion] = useState([]);
    const [miBeneficio, setMiBeneficio] = useState(null);
    const [clasificacionEstrellas, setClasificacionEstrellas] = useState([]);
    const [guardando, setGuardando] = useState(false);
    const [yaGuardado, setYaGuardado] = useState(false);
    const [loading, setLoading] = useState(true);
    const [posicionFiltro, setPosicionFiltro] = useState('Todos');

    useEffect(() => {
        if (!currentUser) return;
        const unsubJornada = onSnapshot(
            query(collection(db, "jornadas"), where("estado", "in", ["Abierta","En vivo"]), limit(1)),
            (snap) => {
                if (!snap.empty) setJornadaActual({ id: snap.docs[0].id, ...snap.docs[0].data() });
                setLoading(false);
            }
        );
        // Clasificación de estrellas
        const unsubClasif = onSnapshot(collection(db, "clasificacion_estrellas"), (snap) => {
            const datos = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.puntosEstrellas||0)-(a.puntosEstrellas||0));
            setClasificacionEstrellas(datos);
            // Beneficio del jugador actual según su posición
            const miPos = datos.findIndex(d => d.id === currentUser);
            if (miPos === 0) setMiBeneficio('ver_apuestas');
            else if (miPos === 1) setMiBeneficio('bloquear');
            else if (miPos === 2) setMiBeneficio('sexta_estrella');
            else setMiBeneficio(null);
        });
        return () => { unsubJornada(); unsubClasif(); };
    }, [currentUser]);

    useEffect(() => {
        if (!jornadaActual || !currentUser) return;
        const unsubSel = onSnapshot(doc(db, "estrellas_seleccion", jornadaActual.id, "jugadores", currentUser), (snap) => {
            if (snap.exists()) { setSeleccion(snap.data().jugadores || []); setYaGuardado(true); }
            else { setSeleccion([]); setYaGuardado(false); }
        });
        return () => unsubSel();
    }, [jornadaActual, currentUser]);

    const toggleJugador = (jugador) => {
        if (jornadaActual.estado !== 'Abierta') return; // solo bloqueado cuando la jornada realmente cierra
        const maxEstrellas = miBeneficio === 'sexta_estrella' ? 6 : 5;
        if (seleccion.find(j => j.nombre === jugador.nombre)) {
            setSeleccion(seleccion.filter(j => j.nombre !== jugador.nombre));
        } else if (seleccion.length < maxEstrellas) {
            setSeleccion([...seleccion, jugador]);
        }
    };

    const guardarSeleccion = async () => {
        if (!jornadaActual || seleccion.length === 0) return;
        setGuardando(true);
        try {
            await setDoc(doc(db, "estrellas_seleccion", jornadaActual.id, "jugadores", currentUser), {
                jugadores: seleccion, guardadoEn: serverTimestamp(), usuario: currentUser
            }, { merge: true });
            setYaGuardado(true);
        } catch (e) { console.error(e); alert('Error al guardar. Inténtalo de nuevo.'); }
        setGuardando(false);
    };

    const posiciones = ['Todos', 'Portero', 'Defensa', 'Centrocampista', 'Mediapunta', 'Delantero'];
    const plantillaFiltrada = posicionFiltro === 'Todos' ? plantilla : plantilla.filter(j => j.posicion === posicionFiltro);
    const maxEstrellas = miBeneficio === 'sexta_estrella' ? 6 : 5;

    if (loading) return <div style={{padding:40,textAlign:'center',color:G.deepBlue}}>Cargando...</div>;

    // Bloqueo hasta que pague
    if (!jugadorHaPagado(currentUser, pagos || [])) {
        return (
            <div style={{paddingBottom:40}}>
                <h2 style={styles.title}>MIS 5 ESTRELLAS</h2>
                <BannerPagoPendiente onIrAPagos={onIrAPagos} />
            </div>
        );
    }

    return (
        <div style={{padding:'20px 16px'}}>
            <h2 style={styles.title}>MIS 5 ESTRELLAS</h2>

            {/* Premio de la Liga de Estrellas — teaser, sin desvelar todavía */}
            <div style={{background:'linear-gradient(135deg,#001F6B,#003a9e)',borderRadius:16,padding:'16px 18px',marginBottom:16,border:'1px solid rgba(255,215,0,0.3)'}}>
                <p style={{fontFamily:"'Teko',sans-serif",fontSize:15,letterSpacing:2,color:'#FFD700',textTransform:'uppercase',marginBottom:6,fontWeight:700}}>
                    🏆 Premio Liga de Estrellas
                </p>
                <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(255,255,255,0.8)',lineHeight:1.6,margin:0}}>
                    El ganador de la Liga de Estrellas se llevará un premio <strong>a la altura de las Estrellas</strong> — de alto valor. Todavía no lo desvelamos del todo: iremos soltando pistas durante la temporada. 👀
                </p>
            </div>

            {/* Carta de puntuación — misma burbuja desplegable que en El Otro Equipo */}
            <AcordeonAyuda icono="⭐" titulo="Tabla de puntuación" abiertoPorDefecto={false}>
                <div style={{background:'#fff',border:'1px solid rgba(0,31,107,0.1)',borderRadius:10,overflow:'hidden'}}>
                    {[
                        ['⚽','Gol portero / defensa','+8⭐',false],
                        ['⚽','Gol centrocampista','+6⭐',false],
                        ['⚽','Gol delantero','+5⭐',false],
                        ['🧤','Parada de penalti','+5⭐',false],
                        ['🅰️','Asistencia','+3⭐',false],
                        ['🧤','Portería a 0 — portero','+4⭐',false],
                        ['🧤','Portería a 0 — defensa','+2⭐',false],
                        ['👟','Titular (+60 min)','+2⭐',false],
                        ['👟','Suplente (entra)','+1⭐',false],
                        ['🧤','Parada genérica (portero)','+1⭐',false],
                        ['🟨','Tarjeta amarilla','-1⭐',true],
                        ['❌','Penalti fallado','-2⭐',true],
                        ['🟥','Tarjeta roja','-3⭐',true],
                    ].map(function(r,i){return(
                        <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 14px',borderBottom:'1px solid rgba(0,31,107,0.05)'}}>
                            <span style={{fontSize:14,flexShrink:0}}>{r[0]}</span>
                            <span style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(0,0,0,0.6)',flex:1}}>{r[1]}</span>
                            <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:r[3]?'#e63946':'#001F6B',flexShrink:0}}>{r[2]}</span>
                        </div>
                    );})}
                    <div style={{padding:'10px 14px',background:'rgba(0,31,107,0.03)'}}>
                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'rgba(0,31,107,0.6)',lineHeight:1.6,textAlign:'center'}}>
                            Las estrellas acumuladas determinan tu posición en la jornada.<br/>
                            🥇 +5 pts · 🥈 +4 pts · 🥉 +3 pts · 4º +2 pts · 5º +1 pt<br/>
                            Los puntos también cuentan en la <strong>clasificación general</strong>.
                        </p>
                    </div>
                </div>
            </AcordeonAyuda>

            {/* Beneficio activo */}
            {miBeneficio && (
                <div style={{background:`linear-gradient(135deg,${G.deepBlue},#0035b8)`,borderRadius:14,padding:14,marginBottom:20,textAlign:'center'}}>
                    <p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'0.9rem',color:G.golden,letterSpacing:3}}>
                        {miBeneficio === 'ver_apuestas' && '👁 PUEDES VER LAS APUESTAS DEL RESTO ANTES DEL CIERRE'}
                        {miBeneficio === 'bloquear' && '🔒 PUEDES BLOQUEAR A UN JUGADOR EN EL OTRO O EN ESTRELLAS'}
                        {miBeneficio === 'sexta_estrella' && '⭐ PUEDES ELEGIR UNA 6ª ESTRELLA COMODÍN ESTA JORNADA'}
                    </p>
                </div>
            )}

            {!jornadaActual ? (
                <p style={{textAlign:'center',color:G.deepBlue,opacity:.5,fontFamily:"'Inter',sans-serif",padding:40}}>
                    No hay jornada activa en este momento.
                </p>
            ) : (
                <>
                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:G.deepBlue,opacity:.6,textAlign:'center',marginBottom:16}}>
                        Jornada {jornadaActual.numeroJornada} — Elige entre 1 y {maxEstrellas} jugadores
                        {jornadaActual.estado === 'Abierta' && yaGuardado ? ' · puedes seguir cambiando hasta el cierre' : ''}
                    </p>

                    {/* Selección actual — con foto */}
                    <div style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'center',marginBottom:20,minHeight:44}}>
                        {seleccion.map((j,i) => (
                            <span key={i} onClick={() => toggleJugador(j)} style={{
                                display:'inline-flex',alignItems:'center',gap:6,
                                background:G.golden,color:'#0a0a0a',borderRadius:20,padding:'4px 14px 4px 4px',
                                fontFamily:"'Inter',sans-serif",fontSize:12,fontWeight:600,
                                cursor: jornadaActual.estado==='Abierta' ? 'pointer' : 'default'
                            }}>
                                {getFotoJugador(j) ? (
                                    <img src={getFotoJugador(j)} alt="" style={{width:22,height:22,borderRadius:'50%',objectFit:'cover',background:'#fff'}}
                                        onError={function(e){e.target.style.display='none';}} />
                                ) : <span>⭐</span>}
                                {j.nombre}
                            </span>
                        ))}
                        {seleccion.length === 0 && (
                            <span style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:G.deepBlue,opacity:.4}}>Ningún jugador seleccionado</span>
                        )}
                    </div>

                    {/* Filtro de posición */}
                    <div style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'center',marginBottom:16}}>
                        {posiciones.map(p => (
                            <button key={p} onClick={() => setPosicionFiltro(p)} style={{
                                padding:'6px 14px',borderRadius:20,border:'none',cursor:'pointer',
                                fontFamily:"'Inter',sans-serif",fontSize:11,fontWeight:600,
                                background: posicionFiltro===p ? G.deepBlue : '#f0f0f0',
                                color: posicionFiltro===p ? G.golden : G.deepBlue,
                            }}>{p}</button>
                        ))}
                    </div>

                    {/* Plantilla visual — solo bloqueada cuando la jornada realmente cierra */}
                    {jornadaActual.estado === 'Abierta' && (
                        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(96px,1fr))',gap:12,marginBottom:20}}>
                            {plantillaFiltrada.map((j,i) => {
                                const seleccionado = seleccion.find(s => s.nombre === j.nombre);
                                const lleno = seleccion.length >= maxEstrellas && !seleccionado;
                                const foto = getFotoJugador(j);
                                return (
                                    <button key={i} onClick={() => toggleJugador(j)} disabled={lleno}
                                        style={{
                                            display:'flex',flexDirection:'column',alignItems:'center',gap:6,
                                            padding:'12px 6px 10px',borderRadius:16,cursor:lleno?'not-allowed':'pointer',
                                            border:`2px solid ${seleccionado?G.golden:'rgba(0,31,107,0.1)'}`,
                                            background: seleccionado?'linear-gradient(180deg,rgba(255,215,0,0.12),rgba(255,215,0,0.03))':'#fff',
                                            opacity:lleno?0.35:1, position:'relative', boxShadow: seleccionado?'0 4px 14px rgba(255,215,0,0.25)':'0 1px 4px rgba(0,31,107,0.06)'
                                        }}>
                                        {seleccionado && (
                                            <span style={{position:'absolute',top:-6,right:-6,fontSize:18,filter:'drop-shadow(0 1px 2px rgba(0,0,0,0.3))'}}>⭐</span>
                                        )}
                                        <div style={{position:'relative'}}>
                                            {foto ? (
                                                <img src={foto} alt={j.nombre}
                                                    style={{width:56,height:56,borderRadius:'50%',objectFit:'cover',
                                                        border: seleccionado?'2.5px solid #FFD700':'2px solid rgba(0,31,107,0.1)',background:'#f0f0f0'}}
                                                    onError={function(e){e.target.style.display='none';e.target.nextSibling.style.display='flex';}} />
                                            ) : null}
                                            <div style={{width:56,height:56,borderRadius:'50%',
                                                display: foto ? 'none' : 'flex',alignItems:'center',justifyContent:'center',
                                                background: seleccionado?'rgba(255,215,0,0.15)':'rgba(0,31,107,0.06)',
                                                border: seleccionado?'2.5px solid #FFD700':'2px solid rgba(0,31,107,0.1)',
                                                fontFamily:"'Teko',sans-serif",fontSize:20,fontWeight:700,color:G.deepBlue}}>
                                                {j.dorsal}
                                            </div>
                                        </div>
                                        <span style={{fontFamily:"'Inter',sans-serif",fontSize:10,fontWeight:700,color:'rgba(0,31,107,0.35)',
                                            background:'rgba(0,31,107,0.06)',borderRadius:6,padding:'1px 6px'}}>{j.posicion}</span>
                                        <span style={{fontFamily:"'Inter',sans-serif",fontSize:12,fontWeight:600,
                                            color:seleccionado?G.deepBlue:'rgba(0,31,107,0.7)',textAlign:'center',lineHeight:1.2}}>{j.nombre}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {jornadaActual.estado !== 'Abierta' ? (
                        <div style={{background:'rgba(0,31,107,0.05)',border:'1px solid rgba(0,31,107,0.12)',borderRadius:12,padding:16,textAlign:'center'}}>
                            <p style={{fontFamily:"'Inter',sans-serif",fontSize:13,color:G.deepBlue,fontWeight:600}}>🔒 Jornada cerrada</p>
                            <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:G.deepBlue,opacity:.5,marginTop:4}}>Tu selección quedó fijada al cerrarse la jornada.</p>
                        </div>
                    ) : (
                        <button onClick={guardarSeleccion} disabled={guardando || seleccion.length===0} style={{
                            width:'100%',fontFamily:"'Bebas Neue',sans-serif",fontSize:'1.1rem',letterSpacing:2,
                            background: yaGuardado ? '#10b981' : G.deepBlue, color: yaGuardado ? '#fff' : G.golden,
                            border:'none',borderRadius:30,padding:14,cursor:'pointer',boxShadow:'0 6px 20px rgba(0,31,107,0.25)',
                            opacity: seleccion.length===0 ? 0.5 : 1
                        }}>
                            {guardando ? 'GUARDANDO...' : yaGuardado ? '✅ GUARDADO — ACTUALIZAR SELECCIÓN' : 'GUARDAR MIS ESTRELLAS'}
                        </button>
                    )}
                </>
            )}

            {/* Clasificación de estrellas */}
            <div style={{marginTop:32}}>
                <h3 style={{...styles.title,fontSize:'1.1rem',marginBottom:16}}>CLASIFICACIÓN ESTRELLAS</h3>
                {clasificacionEstrellas.map((j,i) => (
                    <div key={j.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:'1px solid rgba(0,31,107,0.06)'}}>
                        <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'1.2rem',color:i<3?G.golden:G.deepBlue,width:24,textAlign:'center'}}>{i+1}</span>
                        <span style={{flex:1,fontFamily:"'Inter',sans-serif",fontSize:13,fontWeight:600,color:G.deepBlue}}>{j.id}</span>
                        <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'1.1rem',color:G.deepBlue}}>{j.puntosEstrellas||0} pts</span>
                        {i===0&&<span style={{fontSize:16}}>👁</span>}
                        {i===1&&<span style={{fontSize:16}}>🔒</span>}
                        {i===2&&<span style={{fontSize:16}}>⭐</span>}
                    </div>
                ))}
            </div>
        </div>
    );
};

// ============================================================================
// ============================================================================
// --- LOGIN SCREEN — VERSIÓN SIMPLE (lista de nombres) ---
// ============================================================================
// ============================================================================
// --- LOGIN SCREEN CON PIN — sin Cloud Functions, validación en cliente ---
// El PIN se guarda hasheado en Firestore. Funciona desde cualquier dispositivo
// siempre que sepas el código. Si Mari le dice su PIN a Pedro, Pedro puede entrar.
// ============================================================================


const LoginScreen = ({ onLoginSuccess }) => {
    var G = styles.colors;
    var [nombreSeleccionado, setNombreSeleccionado] = useState('');
    var [pin, setPin] = useState('');
    var [pinConfirm, setPinConfirm] = useState('');
    var [paso, setPaso] = useState('nombre'); // nombre | pin_nuevo | pin_existente | confirmando
    var [error, setError] = useState('');
    var [cargando, setCargando] = useState(false);
    var [esNuevo, setEsNuevo] = useState(false);
    var [avisoReinstalar, setAvisoReinstalar] = useState(function() {
        if (typeof window === 'undefined') return false;
        return !localStorage.getItem('aviso_reinstalar_2627_visto');
    });

    var JUGADORES_FUNDADORES = ["Juanma","Lucy","Antonio","Mari","Pedro","Pedrito","Himar","Sarito","Vicky","Carmelo","Laura","Carlos","José","Claudio","Javi"];
    var [jugadoresInactivos, setJugadoresInactivos] = useState([]);
    var [jugadoresAprobados, setJugadoresAprobados] = useState([]); // nuevos, entrados por invitación aprobada
    var JUGADORES_TODOS = Array.from(new Set(JUGADORES_FUNDADORES.concat(jugadoresAprobados)));
    var JUGADORES = JUGADORES_TODOS.filter(function(j) { return jugadoresInactivos.indexOf(j) === -1; });

    useEffect(function() {
        var unsub = onSnapshot(doc(db, 'configuracion', 'jugadoresInactivos'), function(snap) {
            setJugadoresInactivos(snap.exists() ? (snap.data().nombres || []) : []);
        });
        return function() { unsub(); };
    }, []);

    useEffect(function() {
        var unsub = onSnapshot(doc(db, 'configuracion', 'jugadoresAprobados'), function(snap) {
            setJugadoresAprobados(snap.exists() ? (snap.data().nombres || []) : []);
        });
        return function() { unsub(); };
    }, []);

    // Autenticamos anónimamente en cuanto se monta la pantalla, ANTES de que
    // el usuario toque nada. Así, cuando pulse su nombre, la sesión ya está
    // lista y las reglas de Firestore (que exigen auth) no bloquean la lectura.
    var garantizarSesion = async function() {
        if (!auth.currentUser) {
            await signInAnonymously(auth);
        }
    };
    useEffect(function() { garantizarSesion(); }, []);

    var seleccionarNombre = async function(nombre) {
        setCargando(true);
        setError('');
        setNombreSeleccionado(nombre);
        try {
            await garantizarSesion(); // por si el useEffect aún no había terminado
            var snap = await getDoc(doc(db, "pines", nombre));
            if (snap.exists()) {
                setEsNuevo(false);
                setPaso('pin_existente');
            } else {
                setEsNuevo(true);
                setPaso('pin_nuevo');
            }
        } catch(e) {
            console.error(e);
            setError('Error de conexión. Inténtalo de nuevo.');
        }
        setCargando(false);
    };

    var verificarNuevoPin = async function(confirmado) {
        if (confirmado !== pin) {
            setError('Los PINs no coinciden. Inténtalo de nuevo.');
            setPin(''); setPinConfirm(''); setPaso('pin_nuevo'); return;
        }
        setCargando(true);
        try {
            await garantizarSesion();
            var hash = await hashPin(nombreSeleccionado, pin);
            await setDoc(doc(db, "pines", nombreSeleccionado), { hash: hash, creadoEn: serverTimestamp() });
            await setDoc(doc(db, "perfiles", nombreSeleccionado), { nombre: nombreSeleccionado }, { merge: true });
            onLoginSuccess(nombreSeleccionado);
        } catch(e) {
            console.error(e);
            setError('Error al guardar. Inténtalo de nuevo.'); setCargando(false);
        }
    };

    var validarPin = async function(pinIntento) {
        setCargando(true);
        setError('');
        try {
            await garantizarSesion();
            var snap = await getDoc(doc(db, "pines", nombreSeleccionado));
            if (!snap.exists()) { setError('No hay PIN registrado.'); setCargando(false); return; }
            var hash = await hashPin(nombreSeleccionado, pinIntento);
            if (hash === snap.data().hash) {
                onLoginSuccess(nombreSeleccionado);
            } else {
                setError('PIN incorrecto. Inténtalo de nuevo.');
                setPin(''); setCargando(false);
            }
        } catch(e) {
            console.error(e);
            setError('Error de conexión.'); setCargando(false);
        }
    };

    var pulsarDigito = function(d) {
        if (cargando) return;
        if (paso === 'pin_nuevo') {
            if (pin.length < 4) {
                var nuevo = pin + d;
                setPin(nuevo);
                if (nuevo.length === 4) setPaso('confirmando');
            }
        } else if (paso === 'confirmando') {
            if (pinConfirm.length < 4) {
                var nc = pinConfirm + d;
                setPinConfirm(nc);
                if (nc.length === 4) verificarNuevoPin(nc);
            }
        } else if (paso === 'pin_existente') {
            if (pin.length < 4) {
                var np = pin + d;
                setPin(np);
                if (np.length === 4) validarPin(np);
            }
        }
    };

    var borrar = function() {
        if (paso === 'confirmando') setPinConfirm(function(p) { return p.slice(0,-1); });
        else setPin(function(p) { return p.slice(0,-1); });
    };


    var pinActivo = paso === 'confirmando' ? pinConfirm : pin;
    var tituloPaso = {
        nombre: 'Elige tu nombre',
        pin_nuevo: 'Crea tu PIN de 4 dígitos',
        confirmando: 'Confírmalo',
        pin_existente: 'Introduce tu PIN',
    }[paso];

    return (
        <div style={{position:'fixed',inset:0,background:'#fff',display:'flex',flexDirection:'column',
            alignItems:'center',justifyContent:'center',fontFamily:"'Montserrat',sans-serif",padding:24,overflow:'hidden'}}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Teko:wght@400;600;700&family=Inter:wght@300;400;600&display=swap');
                .login-btn{transition:transform .12s ease,box-shadow .12s ease;}
                .login-btn:hover{transform:scale(1.04);box-shadow:0 4px 16px rgba(0,31,107,0.15);}
                .pin-key{transition:transform .1s ease,background .1s ease;}
                .pin-key:active{transform:scale(0.94);background:rgba(0,31,107,0.08);}
                @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
                .fade-up{animation:fadeUp .25s ease both;}
            `}</style>

            {/* Pizarra fondo */}
            <svg style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}} viewBox="0 0 400 600" fill="none" preserveAspectRatio="xMidYMid slice">
                <rect x="55" y="55" width="290" height="490" stroke="#001F6B" strokeWidth="0.7" opacity="0.04"/>
                <line x1="55" y1="300" x2="345" y2="300" stroke="#001F6B" strokeWidth="0.6" opacity="0.04"/>
                <circle cx="200" cy="300" r="46" stroke="#001F6B" strokeWidth="0.6" opacity="0.04"/>
            </svg>

            {/* Logo */}
            <div style={{position:'relative',zIndex:5,textAlign:'center',marginBottom:24}}>
                <img src="/escudo.png" alt="UDLP" style={{width:52,height:62,objectFit:'contain',filter:'drop-shadow(0 2px 8px rgba(0,20,80,.12))',marginBottom:12}}
                    onError={function(e){e.target.style.display='none';}} />
                <div style={{display:'flex',alignItems:'baseline',justifyContent:'center',gap:4}}>
                    <span style={{fontFamily:"'Teko',sans-serif",fontSize:'clamp(2rem,8vw,2.8rem)',fontWeight:700,color:'#0a0a0a',letterSpacing:2}}>PORRA</span>
                    <span style={{fontFamily:"'Teko',sans-serif",fontSize:'clamp(2rem,8vw,2.8rem)',fontWeight:700,color:'transparent',WebkitTextStroke:'1.5px #0a0a0a',letterSpacing:2}}>UDLP</span>
                </div>
                <p style={{fontFamily:"'Inter',sans-serif",fontSize:10,fontWeight:300,letterSpacing:5,color:'#0a0a0a',opacity:.3,textTransform:'uppercase',marginTop:2}}>
                    {tituloPaso}
                </p>
            </div>

            {/* Aviso técnico: cómo reinstalar la app si no se ven los cambios nuevos */}
            {avisoReinstalar && (
                <div style={{position:'relative',zIndex:5,maxWidth:340,width:'100%',background:'rgba(0,31,107,0.04)',
                    border:'1px solid rgba(0,31,107,0.1)',borderRadius:14,padding:'12px 16px',marginBottom:20,fontFamily:"'Inter',sans-serif"}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
                        <p style={{fontSize:11,fontWeight:600,color:'#001F6B',letterSpacing:0.5}}>
                            📲 ¿No ves los cambios nuevos?
                        </p>
                        <button onClick={function() { localStorage.setItem('aviso_reinstalar_2627_visto','1'); setAvisoReinstalar(false); }}
                            style={{background:'none',border:'none',color:'rgba(0,31,107,0.4)',fontSize:14,cursor:'pointer',lineHeight:1,padding:0}}>✕</button>
                    </div>
                    <p style={{fontSize:11,color:'rgba(0,31,107,0.65)',lineHeight:1.5,marginTop:6}}>
                        <strong>Android:</strong> mantén pulsado el icono de la app → Desinstalar → vuelve a entrar desde el enlace y "Añadir a inicio".<br/>
                        <strong>iPhone:</strong> mantén pulsado el icono → Eliminar app → abre el enlace en Safari → compartir → "Añadir a pantalla de inicio".
                    </p>
                </div>
            )}

            {/* Pantalla de selección de nombre */}
            {paso === 'nombre' && (
                <div className="fade-up" style={{width:'100%',maxWidth:340,position:'relative',zIndex:5}}>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
                        {JUGADORES.map(function(j) {
                            return (
                                <button key={j} className="login-btn" onClick={function(){seleccionarNombre(j);}} disabled={cargando}
                                    style={{padding:'14px 8px',borderRadius:14,border:'1.5px solid rgba(0,31,107,0.12)',
                                        background:'#f8f8f8',fontFamily:"'Inter',sans-serif",fontSize:13,fontWeight:600,
                                        color:'#001F6B',cursor:'pointer',textAlign:'center'}}>
                                    {j}
                                </button>
                            );
                        })}
                    </div>
                    {error && <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'#e63946',textAlign:'center',marginTop:12}}>{error}</p>}
                </div>
            )}

            {/* Modal PIN */}
            {paso !== 'nombre' && (
                <div className="fade-up" style={{width:'100%',maxWidth:300,position:'relative',zIndex:5}}>
                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'rgba(0,31,107,0.5)',
                        letterSpacing:2,textTransform:'uppercase',textAlign:'center',marginBottom:4}}>{nombreSeleccionado}</p>

                    {/* Dots del PIN */}
                    <div style={{display:'flex',justifyContent:'center',gap:14,marginBottom:20}}>
                        {[0,1,2,3].map(function(i) {
                            return (
                                <div key={i} style={{width:14,height:14,borderRadius:'50%',
                                    background: pinActivo.length>i ? '#001F6B' : 'transparent',
                                    border:'2px solid '+(pinActivo.length>i?'#001F6B':'rgba(0,31,107,0.2)')}} />
                            );
                        })}
                    </div>

                    {error && <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'#e63946',textAlign:'center',marginBottom:12}}>{error}</p>}

                    {cargando ? (
                        <p style={{textAlign:'center',fontFamily:"'Inter',sans-serif",fontSize:13,color:'rgba(0,31,107,0.5)',padding:'20px 0'}}>Verificando...</p>
                    ) : (
                        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
                            {['1','2','3','4','5','6','7','8','9','←','0','✓'].map(function(k,i) {
                                if (k==='←') return (
                                    <button key={i} className="pin-key" onClick={borrar}
                                        style={{padding:'16px 0',borderRadius:14,border:'none',background:'#f5f5f5',
                                            fontSize:18,color:'#001F6B',cursor:'pointer'}}>⌫</button>
                                );
                                if (k==='✓') return <div key={i} />;
                                return (
                                    <button key={i} className="pin-key" onClick={function(){pulsarDigito(k);}}
                                        style={{padding:'16px 0',borderRadius:14,border:'none',background:'#f5f5f5',
                                            fontFamily:"'Teko',sans-serif",fontSize:22,fontWeight:700,color:'#0a0a0a',cursor:'pointer'}}>
                                        {k}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {esNuevo && paso === 'pin_nuevo' && (
                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:10,color:'rgba(0,31,107,0.35)',textAlign:'center',marginTop:14,lineHeight:1.5}}>
                            Primera vez que entras. Crea un PIN de 4 dígitos.<br/>Guárdalo bien — lo necesitarás siempre.
                        </p>
                    )}

                    <button onClick={function(){setPaso('nombre');setPin('');setPinConfirm('');setError('');}}
                        style={{width:'100%',marginTop:16,background:'none',border:'none',fontFamily:"'Inter',sans-serif",
                            fontSize:11,color:'rgba(0,31,107,0.35)',cursor:'pointer',textDecoration:'underline'}}>
                        ← Cambiar de jugador
                    </button>
                </div>
            )}
        </div>
    );
};



// ============================================================================
// --- INTRO CINEMÁTICA — pantalla negra + música + presentación oficial ---
// Se muestra la PRIMERA VEZ QUE CADA JUGADOR entra (por nombre, no por
// dispositivo) — igual que el tutorial, justo antes de él. Así, si varios
// jugadores comparten móvil u ordenador, cada uno la ve en su primer login,
// y no depende de si "ese navegador" ya la vio con otro nombre antes.
// Requiere que presentacion_porra.html esté en /public/presentacion_porra.html
// ============================================================================
const AUDIO_INTRO_URL = '/intro.mp3?v=2'; // el ?v=2 evita que el navegador sirva en caché la canción anterior

// ¿Ya vio ESTE jugador la presentación? Comprueba local (rápido) + Firestore
// (por si entra desde otro dispositivo, o el admin se la reseteó).
async function yaVioPresentacion(user) {
    if (localStorage.getItem('presentacion_2627_' + user)) return true;
    try {
        var snap = await getDoc(doc(db, 'perfiles', user));
        return !!(snap.exists() && snap.data().presentacionVista === true);
    } catch(e) { return false; }
}

const IntroPresentacionGate = ({ onFinish, user }) => {
    var [fase, setFase] = useState('negro'); // negro -> esperandoGesto -> presentacion
    var [necesitaGesto, setNecesitaGesto] = useState(false);
    var [errorCarga, setErrorCarga] = useState(''); // mensaje si el archivo no carga
    var audioRef = useRef(null);
    var timerRef = useRef(null);
    var yaArrancado = useRef(false); // evita que se dispare dos veces (StrictMode / re-render)

    var arrancar = function() {
        if (yaArrancado.current) return;
        yaArrancado.current = true;

        var audio = audioRef.current;
        if (audio) {
            audio.currentTime = 0;
            var p = audio.play();
            if (p && p.catch) {
                p.catch(function() { setNecesitaGesto(true); });
            }
        }
        timerRef.current = setTimeout(function() { setFase('presentacion'); }, 2000);
    };

    useEffect(function() {
        arrancar();
        var audioEl = audioRef.current; // copia local — evita el warning de ref en cleanup
        return function() {
            if (timerRef.current) clearTimeout(timerRef.current);
            if (audioEl) { audioEl.pause(); }
        };
    }, []);

    // Al llegar a la fase de presentación, comprobamos que el archivo existe
    // de verdad antes de confiar en que el iframe lo va a mostrar. Si no está
    // en /presentacion_porra.html (falta subirlo, 404, o una regla de Netlify
    // lo está redirigiendo a index.html) lo decimos claramente en pantalla.
    useEffect(function() {
        if (fase !== 'presentacion') return;
        fetch('/presentacion_porra.html', { cache: 'no-store' })
            .then(function(res) {
                if (!res.ok) {
                    setErrorCarga('El archivo /presentacion_porra.html no se encuentra (error ' + res.status + '). Súbelo a la carpeta public/ del proyecto y vuelve a desplegar.');
                    return;
                }
                return res.text().then(function(texto) {
                    // Si Netlify está redirigiendo todo a index.html, el contenido
                    // que llega es el de la app React, no el de la presentación.
                    if (texto.indexOf('id="s0"') === -1 && texto.indexOf('SLIDE_IDS') === -1) {
                        setErrorCarga('En esa ruta no está la presentación (parece que está devolviendo otra página). Revisa que public/presentacion_porra.html exista y que no haya una regla de redirección en netlify.toml que la intercepte.');
                    }
                });
            })
            .catch(function() {
                setErrorCarga('No se pudo comprobar el archivo de la presentación. Revisa la conexión o el despliegue.');
            });
    }, [fase]);

    var tocarParaActivar = function() {
        setNecesitaGesto(false);
        var audio = audioRef.current;
        if (audio) { audio.play().catch(function() {}); }
    };

    var finalizar = function() {
        if (user) {
            localStorage.setItem('presentacion_2627_' + user, '1');
            setDoc(doc(db, 'perfiles', user), { presentacionVista: true }, { merge: true }).catch(function(){});
        }
        onFinish();
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <audio ref={audioRef} src={AUDIO_INTRO_URL} preload="auto" />

            {fase !== 'presentacion' && necesitaGesto && (
                <button onClick={tocarParaActivar} style={{
                    position: 'absolute', inset: 0, width: '100%', height: '100%',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <span style={{ fontFamily: "'Teko',sans-serif", fontSize: 18, letterSpacing: 3,
                        color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: 30, padding: '12px 28px' }}>
                        Toca para empezar
                    </span>
                </button>
            )}

            {fase === 'presentacion' && !errorCarga && (
                <div style={{ position: 'absolute', inset: 0, animation: 'fadeIn 0.6s ease both' }}>
                    <iframe
                        title="Presentación Porra UDLP 26/27"
                        src="/presentacion_porra.html"
                        style={{ width: '100%', height: '100%', border: 'none' }}
                    />
                    <button onClick={finalizar} style={{
                        position: 'absolute', top: 16, right: 16, zIndex: 10,
                        fontFamily: "'Teko',sans-serif", fontSize: 13, letterSpacing: 2,
                        background: 'rgba(0,0,0,0.5)', color: 'rgba(255,255,255,0.7)',
                        border: '1px solid rgba(255,255,255,0.2)', borderRadius: 20,
                        padding: '8px 16px', cursor: 'pointer', textTransform: 'uppercase' }}>
                        Saltar ✕
                    </button>
                </div>
            )}

            {fase === 'presentacion' && errorCarga && (
                <div style={{ maxWidth: 380, padding: 24, textAlign: 'center' }}>
                    <p style={{ fontFamily: "'Teko',sans-serif", fontSize: 15, letterSpacing: 2,
                        color: '#e63946', textTransform: 'uppercase', marginBottom: 12 }}>
                        No se pudo cargar la presentación
                    </p>
                    <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                        {errorCarga}
                    </p>
                    <button onClick={finalizar} style={{
                        marginTop: 20, fontFamily: "'Teko',sans-serif", fontSize: 14, letterSpacing: 2,
                        background: '#001F6B', color: '#FFD700', border: 'none', borderRadius: 20,
                        padding: '10px 24px', cursor: 'pointer', textTransform: 'uppercase' }}>
                        Continuar a la app
                    </button>
                </div>
            )}
        </div>
    );
};

function App() {
    const [screen, setScreen] = useState('login');
    const [activeTab, setActiveTab] = useState('miJornada');
    const [contextoPago, setContextoPago] = useState(null); // { tipo, jornada } — para llegar a Pagos ya con todo relleno
    const [drawerOpen, setDrawerOpen] = useState(true);
    const [drawerHintShown, setDrawerHintShown] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [teamLogos, setTeamLogos] = useState({});
    const [plantilla, setPlantilla] = useState(PLANTILLA_FALLBACK);
    const [fotosJugadores, setFotosJugadores] = useState({}); // nombre -> {apiId, fotoManual}, en vivo desde Firestore
    const [, forzarRepintadoNombres] = useState(0); // fuerza re-render cuando cambia MOSTRAR_APELLIDOS (var de módulo, no estado)

    // Plantilla combinada: la base + las fotos verificadas a mano en Admin.
    // Se usa en TODAS las pantallas en vez de "plantilla" a secas, para que
    // una foto guardada se vea al instante en toda la app.
    const plantillaConFotos = plantilla.map(function(j) {
        var override = fotosJugadores[j.nombre];
        if (!override) return j;
        return { ...j, ...override };
    });
    const [userProfiles, setUserProfiles] = useState({});
    const [onlineUsers, setOnlineUsers] = useState({});
    const [clasificacionData, setClasificacionData] = useState([]);
    const [showTutorial, setShowTutorial] = useState(false);
    const [pagosGlobal, setPagosGlobal] = useState([]);
    const [solicitudesGlobal, setSolicitudesGlobal] = useState([]); // para el aviso de solicitudes pendientes en el menú
    const [mostrarPresentacion, setMostrarPresentacion] = useState(false);

    // ── Tema visual — pizarra oscura / pizarra clara. Por defecto oscuro. ──
    const [tema, setTema] = useState(function() {
        if (typeof window === 'undefined') return 'oscuro';
        return localStorage.getItem('tema_udlp_2627') || 'oscuro';
    });
    const cambiarTema = function() {
        setTema(function(t) {
            var nuevo = t === 'oscuro' ? 'claro' : 'oscuro';
            localStorage.setItem('tema_udlp_2627', nuevo);
            return nuevo;
        });
    };
    const TEMA = tema === 'oscuro'
        ? { fondoApp: 'linear-gradient(160deg,#080e24 0%,#0a1228 100%)', fondoTop: 'rgba(10,15,35,0.75)',
            textoTop: '#f0f0f0', hairline: 'rgba(255,255,255,0.08)', iconoMenu: '#FFD700' }
        : { fondoApp: 'linear-gradient(160deg,#f8f9ff 0%,#eef1fa 100%)', fondoTop: 'rgba(255,255,255,0.7)',
            textoTop: '#001F6B', hairline: 'rgba(0,31,107,0.08)', iconoMenu: '#001F6B' };

    // ── Estilos globales y estado RTDB público al arrancar ──────────────
    useEffect(() => {
        document.title = "PORRA UDLP 26/27";
        const styleSheet = document.createElement("style");
        styleSheet.innerText = `
            @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Montserrat:wght@400;600;700&family=Oswald:wght@400;600;700&family=Inter:wght@300;400;600&display=swap');
            * { margin: 0; padding: 0; box-sizing: border-box; }
            html { font-size: 16px !important; -webkit-text-size-adjust: 100%; }
            body, #root { width: 100%; min-width: 100%; overflow-x: hidden; background-color: #f0f0f0; }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes slideInFromRight { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
            .content-enter-active { animation: slideInFromRight 0.4s ease-out; }
            @keyframes blink-live { 50% { background-color: #5a0000; } }
        `;
        document.head.appendChild(styleSheet);
        const unsubStatus = onValue(ref(rtdb, 'status/'), (snap) => { setOnlineUsers(snap.val() || {}); });
        return () => { document.head.removeChild(styleSheet); unsubStatus(); };
    }, []);

    // Comprueba si hay que mostrar el tutorial — separado para poder llamarlo
    // tanto justo tras el login (si ya vio la presentación antes) como al
    // cerrar la presentación (si es la primera vez y acaba de verla).
    const comprobarTutorial = async (user) => {
        var yaVistoLocal = !!localStorage.getItem('tutorial_2627_' + user);
        var perfilSnap = await getDoc(doc(db, 'perfiles', user));
        var forzadoPorAdmin = perfilSnap.exists() && perfilSnap.data().resetTutorial === true;
        if (!yaVistoLocal || forzadoPorAdmin) {
            setShowTutorial(true);
            if (forzadoPorAdmin) {
                await setDoc(doc(db, 'perfiles', user), { resetTutorial: false }, { merge: true });
            }
        }
    };

    // ── Tras login: cargar datos privados y plantilla vía API ───────────
    const handleLoginSuccess = async (user) => {
        try {
            setCurrentUser(user);
            set(ref(rtdb, 'status/' + user), true);
            onDisconnect(ref(rtdb, 'status/' + user)).set(false);

            // Admin identificado por nombre mientras usamos login simple
            setIsAdmin(user === 'Juanma');

            // Notificaciones push — se registra en segundo plano, sin
            // bloquear el login si el navegador no las soporta o el
            // jugador no da permiso.
            registrarNotificacionesPush(user);

            // Listeners de Firestore post-login
            onSnapshot(collection(db, 'pagos'), function(snap) {
                setPagosGlobal(snap.docs.map(function(d){return{id:d.id,...d.data()};}));
            });
            // Solo hace falta cargarlas para el admin (que es quien las gestiona),
            // pero no hace daño mantenerlo simple y cargarlas siempre — el coste
            // es mínimo y así el badge del menú funciona sin condiciones raras.
            onSnapshot(collection(db, 'solicitudes_ingreso'), function(snap) {
                setSolicitudesGlobal(snap.docs.map(function(d){return{id:d.id,...d.data()};}));
            });
            onSnapshot(doc(db, "configuracion", "escudos"), function(snap) {
                if (snap.exists()) setTeamLogos(snap.data());
            });
            onSnapshot(collection(db, "clasificacion"), function(snap) {
                var clasif = [];
                snap.forEach(function(d) { clasif.push({ id: d.id, ...d.data() }); });
                setClasificacionData(clasif);
                // Fusiona los puntos dentro de userProfiles sin borrar lo que
                // ya hubiera (fotos, apodo, emoji) — antes esto SOBRESCRIBÍA
                // userProfiles entero solo con puntos, y la colección real de
                // perfiles (fotos) nunca se llegaba a leer en ningún sitio.
                setUserProfiles(function(prev) {
                    var copia = { ...prev };
                    snap.forEach(function(d) {
                        copia[d.id] = { ...(copia[d.id] || {}), ...d.data() };
                    });
                    return copia;
                });
            });
            // Perfiles reales — foto, apodo, emoji. Antes nunca se leía esta
            // colección para el resto de la app, solo la usaba cada uno en su
            // propia pantalla de Perfil — por eso las fotos no se veían en
            // ningún otro sitio (avatares, clasificación, quién ha apostado).
            onSnapshot(collection(db, "perfiles"), function(snap) {
                setUserProfiles(function(prev) {
                    var copia = { ...prev };
                    snap.forEach(function(d) {
                        copia[d.id] = { ...(copia[d.id] || {}), ...d.data() };
                    });
                    return copia;
                });
            });
            // Fotos verificadas a mano desde Admin — un documento por jugador,
            // en vivo, para que un cambio se vea al instante en toda la app.
            onSnapshot(collection(db, "fotosJugadores"), function(snap) {
                var mapa = {};
                snap.forEach(function(d) { mapa[d.id] = d.data(); });
                setFotosJugadores(mapa);
            });
            // Interruptor de admin: mostrar apellidos sí/no en toda la app.
            // Se guarda en una var de módulo (MOSTRAR_APELLIDOS) para que
            // nombreVisible() lo lea sin tener que pasarlo como prop por
            // todos lados — se actualiza en vivo con este listener.
            onSnapshot(doc(db, "configuracion", "mostrarApellidos"), function(snap) {
                MOSTRAR_APELLIDOS = !!(snap.exists() && snap.data().activo);
                forzarRepintadoNombres(function(n) { return n + 1; }); // repinta la app entera con el nuevo valor
            });

            // Cargar plantilla desde Firestore si existe
            getDoc(doc(db, "configuracion", "plantilla_udlp")).then(function(plantillaSnap) {
                if (plantillaSnap.exists() && plantillaSnap.data().jugadores?.length > 0) {
                    setPlantilla(plantillaSnap.data().jugadores);
                }
            });

            setScreen('app');

            // PRIMERO la presentación con el storytelling (si es la primera vez
            // de ESTE jugador), y solo cuando termine, el tutorial de cómo jugar.
            var vioPresentacion = await yaVioPresentacion(user);
            if (!vioPresentacion) {
                setMostrarPresentacion(true); // el tutorial se comprueba al cerrarla (onFinish)
            } else {
                await comprobarTutorial(user);
            }
        } catch (error) {
            console.error('Error en handleLoginSuccess:', error);
            alert("Error al iniciar sesión. Inténtalo de nuevo.");
        }
    };

    const handleLogout = async () => {
        if (currentUser) set(ref(rtdb, 'status/' + currentUser), false);
        setCurrentUser(null);
        setIsAdmin(false);
        setScreen('login');
        try { await signOut(auth); } catch (e) { console.error(e); }
    };

    if (APP_EN_CONSTRUCCION) return <ModoConstruccion />;
    if (mostrarPresentacion) return <IntroPresentacionGate user={currentUser} onFinish={function() { setMostrarPresentacion(false); comprobarTutorial(currentUser); }} />;
    if (screen === 'login') return <LoginScreen onLoginSuccess={handleLoginSuccess} />;

    var renderContent = function() {
        switch (activeTab) {
            case 'miJornada':    return <MiJornadaScreen user={currentUser} teamLogos={teamLogos} plantilla={plantillaConFotos} userProfiles={userProfiles} onlineUsers={onlineUsers} pagos={pagosGlobal} onIrAPagos={function(jornadaCodigo, esVip){ setContextoPago({ tipo: esVip ? 'jornada_vip' : 'jornada_normal', jornada: jornadaCodigo }); setActiveTab('pagos'); }} />;
            case 'laJornada':   return <LaJornadaScreen userProfiles={userProfiles} onlineUsers={onlineUsers} teamLogos={teamLogos} />;
            case 'elOtro':      return <ElOtroScreen currentUser={currentUser} userProfiles={userProfiles} pagos={pagosGlobal} teamLogos={teamLogos} onIrAPagos={function(){setActiveTab('pagos');}} />;
            case 'estrellas':   return <MisEstrellasScreen currentUser={currentUser} plantilla={plantillaConFotos} userProfiles={userProfiles} pagos={pagosGlobal} onIrAPagos={function(){setActiveTab('pagos');}} />;
            case 'clasificacion': return <ClasificacionScreen currentUser={currentUser} userProfiles={userProfiles} onlineUsers={onlineUsers} pagos={pagosGlobal} />;
            case 'normativa':     return <NormativaScreen />;
            case 'calendario':  return <CalendarioScreen teamLogos={teamLogos} />;
            case 'estadisticas': return <EstadisticasScreen userProfiles={userProfiles} onlineUsers={onlineUsers} />;
            case 'pagos':       return <PagosScreen currentUser={currentUser} contextoPago={contextoPago} onContextoPagoUsado={function(){setContextoPago(null);}} />;
            case 'perfil':      return <PerfilScreen currentUser={currentUser} tema={tema} cambiarTema={cambiarTema} teamLogos={teamLogos} />;
            case 'admin':       return isAdmin ? <AdminPanelScreen plantilla={plantillaConFotos} teamLogos={teamLogos} /> : null;
            default:            return null;
        }
    };

    var TABS = [
        { id: 'miJornada', label: 'Mi Jornada', icon: 'ti-calendar-event' },
        { id: 'laJornada', label: 'La Jornada', icon: 'ti-trophy' },
        { id: 'elOtro', label: 'El Otro Equipo', icon: 'ti-shield-half' },
        { id: 'estrellas', label: '5 Estrellas', icon: 'ti-star' },
        { id: 'clasificacion', label: 'Clasificación', icon: 'ti-chart-bar' },
        { id: 'normativa', label: 'Normativa', icon: 'ti-gavel' },
        { id: 'calendario', label: 'Calendario', icon: 'ti-calendar' },
        { id: 'estadisticas', label: 'Estadísticas', icon: 'ti-chart-dots' },
        { id: 'pagos', label: 'Pagos', icon: 'ti-wallet' },
        { id: 'perfil', label: 'Mi Perfil', icon: 'ti-user-circle' },
    ];
    // Aviso para el admin: cuántas solicitudes y pagos están pendientes de
    // gestionar, para que se vea de un vistazo en el menú sin tener que
    // entrar a comprobarlo cada vez.
    var solicitudesPendientesCount = solicitudesGlobal.filter(function(s) { return !s.estado || s.estado === 'pendiente'; }).length;
    var pagosPendientesCount = pagosGlobal.filter(function(p) { return p.estado === 'pendiente_confirmacion'; }).length;
    var avisosAdminCount = solicitudesPendientesCount + pagosPendientesCount;
    if (isAdmin) TABS.push({ id: 'admin', label: 'Admin', icon: 'ti-settings', badge: avisosAdminCount > 0 ? avisosAdminCount : null });

    return (
        <div style={{ position: 'fixed', inset: 0, background: TEMA.fondoApp, overflow: 'hidden', fontFamily: "'Teko', sans-serif" }}>

            {/* Tutorial épico — primera vez en la temporada */}
            {showTutorial && <TutorialEpico user={currentUser} plantilla={plantillaConFotos} onClose={function() { setShowTutorial(false); setActiveTab('perfil'); }} />}

            {/* ── TOPBAR ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: TEMA.fondoTop, backdropFilter: 'blur(10px)', borderBottom: '0.5px solid ' + TEMA.hairline, position: 'relative', zIndex: 10 }}>
                <button
                    onClick={function() { setDrawerOpen(true); }}
                    style={{ width: 40, height: 40, background: 'rgba(0,31,107,0.07)', border: 'none', borderRadius: 10, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 5, padding: '0 10px', animation: drawerHintShown ? 'none' : 'menuPulse 1.5s ease 0.8s 3', position: 'relative' }}
                    aria-label="Abrir menú"
                >
                    <div style={{ width: 20, height: 2, background: TEMA.iconoMenu, borderRadius: 2 }} />
                    <div style={{ width: 14, height: 2, background: TEMA.iconoMenu, borderRadius: 2, marginLeft: 3 }} />
                    <div style={{ width: 20, height: 2, background: TEMA.iconoMenu, borderRadius: 2 }} />
                </button>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontFamily: "'Teko',sans-serif", fontSize: 22, fontWeight: 700, color: TEMA.textoTop, letterSpacing: 1, lineHeight: 1 }}>PORRA</span>
                    <span style={{ fontFamily: "'Teko',sans-serif", fontSize: 22, fontWeight: 700, color: 'transparent', WebkitTextStroke: '1.5px ' + TEMA.textoTop, letterSpacing: 1, lineHeight: 1 }}>UDLP</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* Botón discreto de tema oscuro/claro */}
                    <button onClick={cambiarTema} aria-label="Cambiar tema"
                        style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid ' + TEMA.hairline,
                            background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', opacity: 0.55 }}>
                        <i className={'ti ' + (tema === 'oscuro' ? 'ti-sun' : 'ti-moon')} style={{ fontSize: 15, color: TEMA.textoTop }} aria-hidden="true" />
                    </button>
                    <div style={{ width: 38, height: 38, background: '#FFD700', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Teko',sans-serif", fontSize: 18, fontWeight: 700, color: '#001F6B', cursor: 'pointer' }}
                        onClick={function() { setActiveTab('perfil'); setDrawerOpen(false); }}>
                        {(currentUser || 'U')[0].toUpperCase()}
                    </div>
                </div>
            </div>

            {/* ── CONTENIDO PRINCIPAL ── */}
            <div style={{ position: 'absolute', top: 62, bottom: 0, left: 0, right: 0, overflowY: 'auto', padding: '16px' }}>
                <div key={activeTab} style={{ animation: 'slideIn .22s ease both' }}>
                    {renderContent()}
                </div>
            </div>

            {/* ── DRAWER OVERLAY ── */}
            {drawerOpen && (
                <div
                    onClick={function() { setDrawerOpen(false); setDrawerHintShown(true); }}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,15,60,0.45)', zIndex: 40, backdropFilter: 'blur(3px)', animation: 'fadeInOverlay .2s ease' }}
                />
            )}

            {/* ── DRAWER PANEL ── */}
            <div style={{
                position: 'fixed', top: 0, left: 0, bottom: 0, width: 240,
                background: '#001F6B', zIndex: 50, display: 'flex', flexDirection: 'column',
                transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
                transition: 'transform .28s cubic-bezier(.4,0,.2,1)',
                boxShadow: drawerOpen ? '4px 0 40px rgba(0,0,0,0.3)' : 'none',
            }}>
                <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontFamily: "'Teko',sans-serif", fontSize: 26, fontWeight: 700, color: '#FFD700', letterSpacing: 2, lineHeight: 1 }}>PORRA UDLP</div>
                    <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 3, textTransform: 'uppercase', marginTop: 3 }}>Temporada 26/27</div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
                    {TABS.map(function(tab, i) {
                        var active = activeTab === tab.id;
                        return (
                            <button key={tab.id} onClick={function() { setActiveTab(tab.id); setDrawerOpen(false); setDrawerHintShown(true); }}
                                style={{
                                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                                    padding: '11px 20px', border: 'none', background: active ? 'rgba(255,215,0,0.1)' : 'transparent',
                                    borderRight: active ? '3px solid #FFD700' : '3px solid transparent',
                                    cursor: 'pointer', textAlign: 'left',
                                    animation: drawerOpen ? ('drawerItem .2s ease ' + (i * 0.04) + 's both') : 'none',
                                }}>
                                <i className={'ti ' + tab.icon} style={{ fontSize: 18, color: active ? '#FFD700' : 'rgba(255,255,255,0.3)', width: 20 }} aria-hidden="true" />
                                <span style={{ fontFamily: "'Teko',sans-serif", fontSize: 17, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: active ? '#FFD700' : 'rgba(255,255,255,0.4)' }}>
                                    {tab.label}
                                </span>
                                {tab.id === 'elOtro' && <span style={{ marginLeft: 'auto', fontFamily: "'Teko',sans-serif", fontSize: 13, background: 'rgba(255,215,0,0.15)', color: '#FFD700', padding: '2px 8px', borderRadius: 10 }}>?</span>}
                                {tab.badge != null && <span style={{ marginLeft: 'auto', fontFamily: "'Teko',sans-serif", fontSize: 12, fontWeight: 700, background: '#e63946', color: '#fff', padding: '1px 8px', borderRadius: 10, minWidth: 18, textAlign: 'center' }}>{tab.badge}</span>}
                            </button>
                        );
                    })}
                </div>

                <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    {/* Ver presentación de nuevo — modo prueba, o siempre para el admin */}
                    {typeof window !== 'undefined' && (sessionStorage.getItem('porra_prueba') === '1' || isAdmin) && (
                        <button onClick={function() { setDrawerOpen(false); setMostrarPresentacion(true); }}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                padding: '10px 14px', marginBottom: 10, border: '1px solid rgba(255,215,0,0.3)', borderRadius: 12,
                                background: 'rgba(255,215,0,0.08)', color: '#FFD700', cursor: 'pointer' }}>
                            <i className="ti ti-player-play" style={{ fontSize: 14 }} aria-hidden="true" />
                            <span style={{ fontFamily: "'Teko',sans-serif", fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' }}>
                                Ver presentación
                            </span>
                        </button>
                    )}
                    {/* Botón Invita a Amigos */}
                    <button onClick={function() {
                        var baseUrl = window.location.origin + '/invitacion.html';
                        var enlace = baseUrl + '?ref=' + encodeURIComponent(currentUser);
                        var msg = '🐥 ¡Te invito a la Porra UDLP 26/27!\n\nSoy ' + currentUser + ' y te he reservado una plaza en nuestra liga familiar de la UD Las Palmas.\n\n👉 Entra aquí para ver cómo funciona y apuntarte:\n' + enlace;
                        if (navigator.share) {
                            navigator.share({ title: 'Porra UDLP 26/27 — Invitación', text: msg, url: enlace });
                        } else if (navigator.clipboard) {
                            navigator.clipboard.writeText(msg);
                            alert('¡Enlace copiado! Pégalo en WhatsApp.');
                        }
                        setDrawerOpen(false);
                    }}
                        style={{width:'100%',background:'rgba(255,215,0,0.12)',border:'1px solid rgba(255,215,0,0.3)',
                            borderRadius:12,padding:'11px 0',cursor:'pointer',marginBottom:10,
                            fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:2,
                            color:'#FFD700',textTransform:'uppercase',display:'flex',alignItems:'center',
                            justifyContent:'center',gap:8}}>
                        👥 INVITAR A ALGUIEN
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <div style={{ width: 34, height: 34, background: '#FFD700', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Teko',sans-serif", fontSize: 18, fontWeight: 700, color: '#001F6B' }}>
                            {(currentUser || 'U')[0].toUpperCase()}
                        </div>
                        <span style={{ fontFamily: "'Teko',sans-serif", fontSize: 15, color: 'rgba(255,255,255,0.6)', letterSpacing: 1, textTransform: 'uppercase' }}>{currentUser}</span>
                    </div>
                    <button onClick={handleLogout} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: 'none', color: 'rgba(255,255,255,0.35)', fontFamily: "'Teko',sans-serif", fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', padding: '8px 0', borderRadius: 8, cursor: 'pointer', textAlign: 'left', paddingLeft: 12 }}>
                        Salir
                    </button>
                </div>
            </div>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Teko:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap');
                @import url('https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css');
                @keyframes slideIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
                @keyframes fadeInOverlay { from { opacity:0; } to { opacity:1; } }
                @keyframes menuPulse { 0%,100% { box-shadow:0 0 0 0 rgba(0,31,107,0); } 50% { box-shadow:0 0 0 8px rgba(0,31,107,0.15); } }
                @keyframes drawerItem { from { opacity:0; transform:translateX(-12px); } to { opacity:1; transform:translateX(0); } }
                * { box-sizing: border-box; }
                body { margin:0; overflow:hidden; }
                ::-webkit-scrollbar { width:3px; } ::-webkit-scrollbar-track { background:transparent; } ::-webkit-scrollbar-thumb { background:rgba(0,31,107,0.15); border-radius:2px; }
            `}</style>
        </div>
    );
}

export default App;
