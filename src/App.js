import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, collection, doc, getDocs, onSnapshot, query, where, limit, writeBatch, updateDoc, orderBy, setDoc, getDoc, increment, deleteDoc, runTransaction, serverTimestamp, addDoc } from "firebase/firestore";
import { getMessaging, getToken } from "firebase/messaging";
import { getDatabase, ref, onValue, onDisconnect, set } from "firebase/database";
import { getFunctions, httpsCallable } from "firebase/functions";

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
const rtdb = getDatabase(app);
const functions = getFunctions(app);

const VAPID_KEY = "AQUÍ_VA_LA_CLAVE_LARGA_QUE_COPIASTE";

// --- DATOS DE LA APLICACIÓN ---
const JUGADORES = ["Juanma", "Lucy", "Antonio", "Mari", "Pedro", "Pedrito", "Himar", "Sarito", "Vicky", "Carmelo", "Laura", "Carlos", "José", "Claudio", "Javi"];
const APUESTA_NORMAL = 1;
const APUESTA_VIP = 2;

const TESOREROS_AUTORIZADOS = ['Juanma', 'Laura', 'Mari'];
const GRUPOS_PAGOS = {
    'Juanma': ["Juanma", "Lucy", "Antonio"],
    'Laura': ["Laura", "Carlos", "José", "Javi", "Vicky", "Carmelo"],
    'Mari': ["Pedrito", "Himar", "Sarito", "Claudio", "Pedro", "Mari"]
};

const SECRET_MESSAGES = ["Pronóstico Secreto 🤫", "Aquí huele a BOTE...", "Voy a ganar yo 😎", "Top Secret", "Clasificado ⭐", "Me lo guardo para mí", "Jugada Maestra en proceso...", "Ni el VAR lo sabe"];
const STAT_REACTION_EMOJIS = ['👍', '🔥', '🤯', '😂', '😥', '👏'];
const GOAL_REACTION_EMOJIS = ['🙌', '⚽', '🎉', '🤩', '🤯'];

const BADGE_DEFINITIONS = {
    lider_general: { icon: '👑', name: 'Líder General', priority: 1, style: 'leader-glow' },
    campeon_jornada: { icon: '🏆', name: 'Campeón de la Jornada', priority: 2, style: 'champion-glow' },
    pleno_jornada: { icon: '🎯', name: 'Pleno en la Jornada', priority: 3, style: 'pleno-flash' },
    en_racha: { icon: '🔥', name: 'En Racha', priority: 4, style: 'fire-streak' },
    mala_racha: { icon: '🥶', name: 'Mala Racha', priority: 5, style: 'cold-streak' },
};

const EQUIPOS_LIGA = ["UD Las Palmas", "UD Almería", "Málaga CF", "CD Castellón", "Burgos CF", "Real Zaragoza", "SD Eibar", "Real Sporting de Gijón", "Real Racing Club"];

const PLANTILLA_ACTUALIZADA = [
    { dorsal: "1", nombre: "Dinko Horkas", imageUrl: "" }, { dorsal: "13", nombre: "José Antonio Caro", imageUrl: "" }, { dorsal: "35", nombre: "Adri Suárez", imageUrl: "" },
    { dorsal: "3", nombre: "Mika Mármol", imageUrl: "" }, { dorsal: "15", nombre: "Juanma Herzog", imageUrl: "" }, { dorsal: "4", nombre: "Álex Suárez", imageUrl: "" },
    { dorsal: "5", nombre: "Enrique Clemente", imageUrl: "" }, { dorsal: "6", nombre: "Sergio Barcia", imageUrl: "" }, { dorsal: "23", nombre: "Cristian Gutiérrez", imageUrl: "" },
    { dorsal: "17", nombre: "Viti Rozada", imageUrl: "" }, { dorsal: "2", nombre: "Marvin Park", imageUrl: "" }, { dorsal: "16", nombre: "Lorenzo Amatucci", imageUrl: "" },
    { dorsal: "18", nombre: "Edward Cedeño", imageUrl: "" }, { dorsal: "12", nombre: "Enzo Loiodice", imageUrl: "" }, { dorsal: "20", nombre: "Kirian Rodríguez", imageUrl: "" },
    { dorsal: "8", nombre: "Iván Gil", imageUrl: "" }, { dorsal: "21", nombre: "Jonathan Viera", imageUrl: "" }, { dorsal: "9", nombre: "Jeremía Recoba", imageUrl: "" },
    { dorsal: "14", nombre: "Manu Fuster", imageUrl: "" }, { dorsal: "10", nombre: "Jesé", imageUrl: "" }, { dorsal: "24", nombre: "Pejiño", imageUrl: "" },
    { dorsal: "22", nombre: "Ale García", imageUrl: "" }, { dorsal: "29", nombre: "Adam Arvelo", imageUrl: "" }, { dorsal: "25", nombre: "Milos Lukovic", imageUrl: "" },
    { dorsal: "19", nombre: "Sandro Ramírez", imageUrl: "" }, { dorsal: "11", nombre: "Marc Cardona", imageUrl: "" }, { dorsal: "7", nombre: "Jaime Mata", imageUrl: "" }
];

const PROFILE_COLORS = ['#FFD700', '#0055A4', '#FFFFFF', '#fca311', '#52b788', '#e63946', '#9b59b6', 'linear-gradient(45deg, #FFC72C, #0055A4)', 'linear-gradient(45deg, #e63946, #fca311)', 'linear-gradient(45deg, #52b788, #9b59b6)'];
const PROFILE_ICONS = ['🐥', '🇮🇨', '⚽️', '🥅', '🏆', '🥇', '🎉', '🔥', '💪', '😎', '🎯', '🧠', '⭐', '🐐', '👑', '💸', '💣', '🚀'];

// ============================================================================
// --- ESTILOS "GAMBLING / GOLDEN PLAYOFF" ---
// ============================================================================
const colors = {
    deepBlue: '#001d3d', // Fondo original
    blue: '#003366',     // Azul más oscuro para paneles
    golden: '#FFD700',   // Dorado brillante principal
    goldenDark: '#d4af37', // Dorado oscuro para bordes
    yellow: '#FFD700',   // Alias retrocompatibilidad
    gold: '#FFD700', 
    silver: '#C0C0C0', 
    bronze: '#CD7F32', 
    lightText: '#fdfbf7', 
    darkText: '#0a0a0a', 
    danger: '#e63946', 
    success: '#10b981',  // Verde casa de apuestas (más vibrante)
    warning: '#fca311', 
    darkUI: 'rgba(0, 15, 35, 0.95)', // Fondo tarjetas casi sólido
    darkUIAlt: 'rgba(0, 25, 50, 0.90)', // Filas tablas
    status: { 'Próximamente': '#6c757d', 'Pre-apertura': '#fca311', 'Abierta': '#10b981', 'Cerrada': '#e63946', 'En vivo': '#dc3545', 'Finalizada': '#d4af37' }
};

const styles = {
    colors,
    container: { display: 'flex', justifyContent: 'center', alignItems: 'flex-start', width: '100%', minHeight: '100dvh', background: `linear-gradient(145deg, ${colors.deepBlue} 0%, #000 100%)`, padding: '15px', fontFamily: "'Exo 2', sans-serif" },
    card: { width: '100%', maxWidth: '900px', backgroundColor: colors.darkUI, color: colors.lightText, padding: '25px', borderRadius: '16px', boxShadow: `0 0 40px rgba(212, 175, 55, 0.15), 0 10px 30px rgba(0, 0, 0, 0.8)`, minHeight: 'calc(100dvh - 30px)', border: `1px solid ${colors.goldenDark}60`, backdropFilter: 'blur(10px)' },
    title: { fontFamily: "'Orbitron', sans-serif", color: colors.golden, textTransform: 'uppercase', letterSpacing: '2px', textAlign: 'center', borderBottom: `2px solid ${colors.golden}`, paddingBottom: '10px', marginBottom: '25px', textShadow: `0 0 15px ${colors.golden}90`, fontSize: 'clamp(1.5rem, 5vw, 1.8rem)' },
    
    // Gambling Style Buttons
    mainButton: { fontFamily: "'Orbitron', sans-serif", padding: '12px 25px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', border: 'none', borderRadius: '25px', background: `linear-gradient(90deg, ${colors.goldenDark}, ${colors.golden})`, color: colors.deepBlue, marginTop: '20px', transition: 'all 0.3s ease', textTransform: 'uppercase', letterSpacing: '1px', boxShadow: `0 4px 15px ${colors.golden}50` },
    secondaryButton: { fontFamily: "'Exo 2', sans-serif", padding: '10px 20px', fontSize: '0.9rem', cursor: 'pointer', border: `1px solid ${colors.goldenDark}`, borderRadius: '20px', backgroundColor: 'rgba(212,175,55,0.1)', color: colors.golden, transition: 'all 0.3s ease', textTransform: 'uppercase', fontWeight: 'bold' },
    
    placeholder: { padding: '40px 20px', backgroundColor: 'rgba(0,0,0,0.4)', border: `2px dashed ${colors.goldenDark}`, borderRadius: '12px', textAlign: 'center', color: colors.lightText },
    initialSplashContainer: { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100%', backgroundColor: colors.deepBlue, animation: 'fadeIn 0.5s ease', transition: 'opacity 0.5s ease' },
    fadeOut: { opacity: 0 },
    loadingMessage: { marginTop: '30px', animation: 'fadeIn 2s ease-in-out', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', fontFamily: "'Exo 2', sans-serif", color: colors.golden },
    splashContainer: { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', textAlign: 'center', width: '100%' },
    splashLogo: { width: '120px', height: '120px', marginBottom: '10px', objectFit: 'contain' },
    splashTitleContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 0.8 },
    splashTitle: { fontFamily: "'Teko', sans-serif", fontSize: 'clamp(3.5rem, 15vw, 5.5rem)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', background: `linear-gradient(90deg, ${colors.golden}, #FFF, ${colors.goldenDark}, #FFF, ${colors.golden})`, backgroundSize: '200% auto', color: 'transparent', backgroundClip: 'text', WebkitBackgroundClip: 'text', animation: 'title-shine 4s linear infinite', textShadow: `0 4px 10px rgba(212, 175, 55, 0.4)` },
    splashYear: { fontFamily: "'Russo One', sans-serif", fontSize: 'clamp(1.5rem, 6vw, 2rem)', color: colors.silver, textShadow: `0 2px 5px rgba(0,0,0,0.5)`, marginTop: '5px', letterSpacing: '4px' },
    
    // Navegación Reorganizada
    navbar: { display: 'flex', flexWrap: 'wrap', gap: '5px', borderBottom: `2px solid ${colors.goldenDark}`, paddingBottom: '15px', marginBottom: '20px', alignItems: 'center', justifyContent: 'center' },
    navButton: { padding: '8px 12px', fontSize: '0.9rem', border: 'none', borderBottom: '3px solid transparent', borderRadius: '6px 6px 0 0', backgroundColor: 'transparent', color: colors.lightText, cursor: 'pointer', transition: 'all 0.3s', textTransform: 'uppercase', fontWeight: '600' },
    navButtonActive: { padding: '8px 12px', fontSize: '0.9rem', border: 'none', borderBottom: `3px solid ${colors.golden}`, borderRadius: '6px 6px 0 0', backgroundColor: 'rgba(212, 175, 55, 0.15)', color: colors.golden, cursor: 'pointer', textTransform: 'uppercase', fontWeight: 'bold', boxShadow: `inset 0 -5px 10px -5px ${colors.golden}` },
    profileNavButton: { background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold', marginLeft: 'auto' },
    logoutButton: { padding: '8px 12px', fontSize: '0.9rem', border: `1px solid ${colors.danger}`, borderRadius: '8px', backgroundColor: 'transparent', color: colors.danger, cursor: 'pointer', marginLeft: '10px', textTransform: 'uppercase' },
    
    // Formularios Estilo Apuestas
    form: { backgroundColor: colors.blue, padding: '25px', borderRadius: '12px', marginTop: '20px', border: `1px solid ${colors.goldenDark}80`, boxShadow: `inset 0 0 30px rgba(0,0,0,0.5)` },
    formSectionTitle: { fontFamily: "'Orbitron', sans-serif", color: colors.golden, fontSize: '1.3rem', textAlign: 'center', marginBottom: '20px', textTransform: 'uppercase' },
    formGroup: { marginBottom: '25px', backgroundColor: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '10px', border: `1px solid rgba(255,215,0,0.1)` },
    label: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginBottom: '10px', color: colors.golden, fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.9rem', letterSpacing: '1px' },
    oddsBadge: { backgroundColor: colors.goldenDark, color: colors.deepBlue, padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold', fontFamily: "'Orbitron', sans-serif" },
    input: { width: 'calc(100% - 24px)', padding: '12px', border: `1px solid ${colors.goldenDark}`, borderRadius: '8px', backgroundColor: colors.deepBlue, color: colors.lightText, fontSize: '1rem' },
    resultInputContainer: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '15px', justifyContent: 'center' },
    resultInput: { width: '70px', height: '70px', textAlign: 'center', padding: '10px', border: `2px solid ${colors.golden}`, borderRadius: '12px', backgroundColor: colors.deepBlue, color: colors.golden, fontSize: '2rem', fontFamily: "'Orbitron', sans-serif", fontWeight: 'bold', boxShadow: `inset 0 0 15px rgba(0,0,0,0.8)`},
    separator: { fontSize: '1.8rem', fontWeight: 'bold', color: colors.golden },
    checkbox: { width: '20px', height: '20px', accentColor: colors.golden },
    message: { marginTop: '20px', padding: '12px', borderRadius: '8px', backgroundColor: colors.darkUIAlt, color: colors.lightText, textAlign: 'center', fontWeight: 'bold', border: `1px solid ${colors.goldenDark}` },
    
    // Tablas
    table: { width: '100%', marginTop: '20px', borderCollapse: 'separate', borderSpacing: '0 5px', color: colors.lightText },
    th: { backgroundColor: 'transparent', color: colors.golden, padding: '12px', borderBottom: `2px solid ${colors.golden}`, textAlign: 'left', textTransform: 'uppercase', fontFamily: "'Orbitron', sans-serif", fontSize: '0.8rem' },
    tr: { backgroundColor: colors.darkUIAlt, transition: 'background-color 0.3s ease' },
    td: { padding: '12px', border: 'none', borderBottom: `1px solid ${colors.goldenDark}40`, fontSize: '0.9rem' },
    tdRank: { padding: '12px', border: 'none', borderBottom: `1px solid ${colors.goldenDark}40`, fontFamily: "'Orbitron', sans-serif", fontWeight: 'bold', fontSize: '1rem', textAlign: 'center', color: colors.golden },
    tdTotalPoints: { padding: '12px', border: 'none', borderBottom: `1px solid ${colors.goldenDark}40`, fontFamily: "'Orbitron', sans-serif", fontWeight: 'bold', fontSize: '1.2rem', textAlign: 'center', color: colors.golden },
    
    // Banners y Contenedores
    vipBanner: { background: `linear-gradient(45deg, #FFD700, #FFF, #d4af37)`, color: colors.darkText, fontWeight: 'bold', padding: '15px', borderRadius: '8px', textAlign: 'center', marginBottom: '20px', fontSize: '1.1rem', fontFamily: "'Orbitron', sans-serif", boxShadow: `0 0 20px rgba(255,215,0,0.7)` },
    prizeBannerFinal: { background: `linear-gradient(90deg, ${colors.goldenDark}, ${colors.golden}, ${colors.goldenDark})`, color: colors.deepBlue, fontWeight: 'bold', padding: '15px', borderRadius: '10px', textAlign: 'center', marginBottom: '25px', fontSize: '1.1rem', fontFamily: "'Orbitron', sans-serif", boxShadow: `0 0 25px rgba(255, 215, 0, 0.5)` },
    h2hContainer: { backgroundColor: 'rgba(212, 175, 55, 0.1)', border: `1px solid ${colors.golden}`, borderRadius: '8px', padding: '15px', marginBottom: '25px', textAlign: 'center', boxShadow: `inset 0 0 20px rgba(0,0,0,0.5)` },
    h2hTitle: { color: colors.golden, fontFamily: "'Orbitron', sans-serif", fontSize: '1.1rem', marginBottom: '8px', textTransform: 'uppercase' },
    h2hText: { color: colors.lightText, fontWeight: 'bold', letterSpacing: '1px', fontSize: '1.1rem' },
    
    // Botones Eliminatorias (Gambling Pasa/Asciende)
    pasaButtonActive: { flex: 1, padding: '15px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', border: `2px solid ${colors.golden}`, borderRadius: '10px', backgroundColor: colors.golden, color: colors.deepBlue, transition: 'all 0.3s ease', boxShadow: `0 0 15px ${colors.golden}50`, textTransform: 'uppercase' },
    pasaButtonInactive: { flex: 1, padding: '15px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', border: `2px solid ${colors.goldenDark}80`, borderRadius: '10px', backgroundColor: 'rgba(0,0,0,0.3)', color: colors.lightText, transition: 'all 0.3s ease', textTransform: 'uppercase' },
    
    // Escudos Gigantes
    giantLogoContainer: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', margin: '30px 0', padding: '20px', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '15px', border: `1px solid ${colors.goldenDark}50` },
    giantLogoWrapper: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' },
    giantLogo: { width: '120px', height: '120px', objectFit: 'contain', filter: 'drop-shadow(0 0 15px rgba(255, 215, 0, 0.4))' },
    
    // Modal Instructivo
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000, backdropFilter: 'blur(8px)' },
    modalContent: { backgroundColor: colors.blue, padding: '30px', borderRadius: '16px', width: '90%', maxWidth: '600px', border: `2px solid ${colors.golden}`, boxShadow: `0 0 40px ${colors.golden}60` },
    modalDots: { display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '20px', marginBottom: '20px' },
    modalDotActive: { width: '12px', height: '12px', borderRadius: '50%', backgroundColor: colors.golden, boxShadow: `0 0 8px ${colors.golden}` },
    modalDotInactive: { width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.3)' },
    
    // El Camino
    bracketContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', margin: '30px 0', padding: '20px', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: '12px', border: `1px solid ${colors.goldenDark}` },
    bracketMatchup: { display: 'flex', justifyContent: 'space-around', width: '100%', gap: '10px', alignItems: 'center', borderBottom: `1px dashed ${colors.goldenDark}50`, paddingBottom: '15px' },
    bracketTeam: { flex: 1, textAlign: 'center', padding: '12px', backgroundColor: colors.darkUIAlt, border: `1px solid ${colors.goldenDark}`, borderRadius: '8px', fontWeight: 'bold', fontSize: '1.1rem' },
    bracketWinner: { backgroundColor: 'rgba(212, 175, 55, 0.2)', borderColor: colors.golden, color: colors.golden, boxShadow: `0 0 10px rgba(255,215,0,0.3)` },
    bracketFinal: { marginTop: '20px', textAlign: 'center', padding: '20px', backgroundColor: 'rgba(212, 175, 55, 0.15)', border: `2px solid ${colors.golden}`, borderRadius: '12px', width: '80%', boxShadow: `0 0 20px rgba(255,215,0,0.2)` },
    secrecyBadge: { display: 'inline-block', backgroundColor: colors.danger, color: '#fff', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold', marginLeft: '10px' },
    
    // Login y Utils
    userList: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '15px', marginTop: '30px' },
    userButton: { position: 'relative', width: '100%', padding: '15px 10px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', border: `2px solid ${colors.goldenDark}50`, borderRadius: '12px', backgroundColor: 'rgba(0,0,0,0.4)', color: colors.lightText, transition: 'all 0.3s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' },
    userButtonHover: { borderColor: colors.golden, color: colors.golden, transform: 'translateY(-5px)', boxShadow: `0 0 20px ${colors.golden}50`, backgroundColor: 'rgba(212, 175, 55, 0.1)' },
    loginProfileIconCircle: { width: '45px', height: '45px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.8rem', color: colors.darkText, backgroundColor: colors.golden },
    liveBanner: { position: 'sticky', top: 0, left: 0, width: '100%', background: `linear-gradient(90deg, ${colors.danger}, #8b0000)`, color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: '15px', padding: '10px', zIndex: 100, fontFamily: "'Orbitron', sans-serif", animation: 'blink-live 1.5s infinite', boxShadow: '0 4px 10px rgba(0,0,0,0.5)' },
};

// ============================================================================
// --- LÓGICA DE CÁLCULO ---
// ============================================================================
const formatFullDateTime = (firebaseDate) => { if (!firebaseDate || !firebaseDate.seconds) return 'Fecha por confirmar'; return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(firebaseDate.seconds * 1000)).replace(',', ' a las'); };

const calculateProvisionalPoints = (pronostico, liveData, jornada) => {
    if (!pronostico || !liveData || !jornada || jornada.estado !== 'En vivo') return 0;
    let ptos = 0; const esVip = jornada.esVip || false; const { golesLocal, golesVisitante } = liveData;
    if (pronostico.golesLocal !== '' && pronostico.golesVisitante !== '') {
        const pL = parseInt(pronostico.golesLocal), pV = parseInt(pronostico.golesVisitante);
        if (!(golesLocal > pL || golesVisitante > pV) && golesLocal === pL && golesVisitante === pV) ptos += esVip ? 6 : 3;
    }
    if (jornada.tipoPartido !== 'vuelta_semi' && jornada.tipoPartido !== 'vuelta_final') {
        let rReal = '';
        if (jornada.equipoLocal === "UD Las Palmas") rReal = golesLocal > golesVisitante ? 'Gana UD Las Palmas' : (golesLocal < golesVisitante ? 'Pierde UD Las Palmas' : 'Empate');
        else rReal = golesVisitante > golesLocal ? 'Gana UD Las Palmas' : (golesVisitante < golesLocal ? 'Pierde UD Las Palmas' : 'Empate');
        if (pronostico.resultado1x2 === rReal) ptos += esVip ? 2 : 1;
    }
    const golReal = (liveData.primerGoleador || '').trim().toLowerCase(), golAp = (pronostico.goleador || '').trim().toLowerCase();
    if (golesLocal > 0 || golesVisitante > 0 || golReal === "sg") {
        if (pronostico.sinGoleador && golReal === "sg") ptos += 1;
        else if (!pronostico.sinGoleador && golAp !== "" && golAp === golReal && golReal !== "sg") ptos += esVip ? 4 : 2;
    }
    if (pronostico.jokerActivo && pronostico.jokerPronosticos?.length > 0) {
        for (const jp of pronostico.jokerPronosticos) {
            if (jp.golesLocal !== '' && jp.golesVisitante !== '') {
                const jpL = parseInt(jp.golesLocal), jpV = parseInt(jp.golesVisitante);
                if (!(golesLocal > jpL || golesVisitante > jpV) && jpL === golesLocal && jpV === golesVisitante) { ptos += esVip ? 6 : 3; break; }
            }
        }
    }
    return ptos;
};

// ============================================================================
// --- COMPONENTES UI Y MODALES ---
// ============================================================================
const PlayerProfileDisplay = ({ name, profile, defaultColor = styles.colors.lightText }) => {
    const p = profile || {}; const color = p.color || defaultColor; const isG = typeof color === 'string' && color.startsWith('linear-gradient');
    const nStyle = { ...(isG ? { background: color, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } : { color }), fontWeight: 'bold' };
    return (<span style={{display: 'inline-flex', alignItems: 'center', gap: '5px' }}>{p.icon && <span>{p.icon}</span>}<span style={nStyle}>{name}</span></span>);
};

const AnimatedPoints = ({ value }) => <span>{value}</span>;
const LoadingSkeleton = () => (<div style={{padding:'40px', textAlign:'center', color:styles.colors.golden}}>Cargando datos del Playoff...</div>);

// --- MODAL DE BIENVENIDA (3 PANTALLAS) ---
const PlayoffWelcomeModal = ({ onClose }) => {
    const [step, setStep] = useState(1);
    const nextStep = () => setStep(prev => Math.min(prev + 1, 3));
    const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

    return (
        <div style={styles.modalOverlay}>
            <div style={styles.modalContent}>
                <h2 style={{...styles.title, fontSize: '2rem', marginBottom: '5px'}}>
                    {step === 1 && "¡ESTAMOS EN PLAYOFF!"}
                    {step === 2 && "NUEVAS REGLAS"}
                    {step === 3 && "EL GRAN BOTÍN"}
                </h2>
                <div style={styles.modalDots}>
                    <div style={step === 1 ? styles.modalDotActive : styles.modalDotInactive} />
                    <div style={step === 2 ? styles.modalDotActive : styles.modalDotInactive} />
                    <div style={step === 3 ? styles.modalDotActive : styles.modalDotInactive} />
                </div>

                <div style={{minHeight: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
                    {step === 1 && (
                        <>
                            <p style={{fontSize: '1.2rem', marginBottom: '15px'}}>La liga regular ha concluido. La <strong>UD Las Palmas ha quedado 5ª</strong> en la clasificación oficial.</p>
                            <div style={{backgroundColor: 'rgba(255,215,0,0.1)', padding: '15px', borderRadius: '8px', border: `1px solid ${styles.colors.goldenDark}`}}>
                                <p style={{color: styles.colors.golden, fontStyle: 'italic', fontWeight: 'bold'}}>El reparto de puntos y premios de la Porra Anual queda CONGELADO a la espera de saber si logramos el ascenso a Primera División.</p>
                            </div>
                        </>
                    )}
                    {step === 2 && (
                        <div style={{textAlign: 'left', lineHeight: 1.6}}>
                            <p style={{marginBottom: '10px'}}><strong>1. Mi Jornada:</strong> El clásico bloque de 1X2 cambiará en las eliminatorias de vuelta por los botones <em>"PASA / NO PASA"</em> o <em>"ASCIENDE / NO ASCIENDE"</em>.</p>
                            <p style={{marginBottom: '10px'}}><strong>2. El Camino (+5 Puntos):</strong> Nueva pestaña para seguir los cruces. Haz una apuesta única al equipo que crees que ascenderá. Será 🤫 secreta hasta que empiece el playoff.</p>
                            <p><strong>3. Ojo al crono:</strong> El resultado exacto siempre incluye la PRÓRROGA, pero excluye los penaltis.</p>
                        </div>
                    )}
                    {step === 3 && (
                        <>
                            <p style={{fontSize: '1.1rem', marginBottom: '15px'}}>Las cuentas y deudas anteriores han sido liquidadas fuera de la app.</p>
                            <div style={{backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '15px', borderRadius: '8px', border: `1px solid ${styles.colors.success}`}}>
                                <h4 style={{color: styles.colors.success, marginBottom: '10px', textTransform: 'uppercase'}}>Premio Final Acumulado</h4>
                                <p style={{fontSize: '0.9rem', marginBottom: '10px'}}>El bote de las 2 últimas jornadas VIPs se ha reservado para el podio final del Playoff.</p>
                                <ul style={{listStyle: 'none', padding: 0, fontWeight: 'bold'}}>
                                    <li>🥇 1º Clasificado: Premio valorado en 40€</li>
                                    <li>🥈 2º Clasificado: Premio valorado en 15€</li>
                                    <li>🥉 3º Clasificado: Premio valorado en 5€</li>
                                </ul>
                            </div>
                        </>
                    )}
                </div>

                <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '20px'}}>
                    {step > 1 ? <button onClick={prevStep} style={styles.secondaryButton}>Atrás</button> : <div></div>}
                    {step < 3 ? <button onClick={nextStep} style={{...styles.mainButton, marginTop: 0}}>Siguiente</button> : <button onClick={() => { localStorage.setItem('playoffWelcomeSeen', 'true'); onClose(); }} style={{...styles.mainButton, marginTop: 0}}>¡A JUGAR!</button>}
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// --- PANTALLAS PRINCIPALES ---
// ============================================================================

const MiJornadaScreen = ({ user, teamLogos, plantilla, userProfiles }) => {
    const [currentJornada, setCurrentJornada] = useState(null);
    const [loading, setLoading] = useState(true);
    const [pronostico, setPronostico] = useState({ golesLocal: '', golesVisitante: '', resultado1x2: '', goleador: '', sinGoleador: false, jokerActivo: false, jokerPronosticos: [] });
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        const qJornadas = query(collection(db, "jornadas"), orderBy("numeroJornada"));
        const unsub = onSnapshot(qJornadas, (snap) => {
            const jornadas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            let activa = jornadas.find(j => ['En vivo', 'Abierta', 'Pre-apertura', 'Cerrada'].includes(j.estado)) || jornadas.filter(j => j.estado === 'Finalizada').pop();
            
            if (activa) {
                setCurrentJornada(activa);
                getDoc(doc(db, "pronosticos", activa.id, "jugadores", user)).then(pSnap => {
                    if (pSnap.exists()) { setPronostico(pSnap.data()); setHasSubmitted(true); } 
                    else { setHasSubmitted(false); }
                    setLoading(false);
                });
            } else setLoading(false);
        });
        return () => unsub();
    }, [user]);

    const handleChange = (e) => { const { name, value, type, checked } = e.target; setPronostico(p => ({ ...p, [name]: type === 'checkbox' ? checked : value, ...(name === 'sinGoleador' && checked && { goleador: '' }) })); };
    
    const handleGuardar = async (e) => {
        e.preventDefault();
        if (pronostico.golesLocal === '' || pronostico.golesVisitante === '' || pronostico.resultado1x2 === '' || (!pronostico.goleador && !pronostico.sinGoleador)) { setMessage('Rellena todos los campos.'); return; }
        try {
            await setDoc(doc(db, "pronosticos", currentJornada.id, "jugadores", user), { ...pronostico, lastUpdated: serverTimestamp() });
            setHasSubmitted(true); setMessage('¡Pronóstico Guardado!');
        } catch (err) { setMessage('Error al guardar.'); }
    };

    if (loading) return <LoadingSkeleton />;
    if (!currentJornada) return <div style={styles.placeholder}>No hay jornadas activas.</div>;

    const isIda = currentJornada.tipoPartido === 'ida' || !currentJornada.tipoPartido;
    const isVSemi = currentJornada.tipoPartido === 'vuelta_semi';
    const isVFinal = currentJornada.tipoPartido === 'vuelta_final';

    return (
        <div>
            {currentJornada.estado === 'Abierta' ? (
                <form onSubmit={handleGuardar} style={styles.form}>
                    {currentJornada.esVip && <div style={styles.vipBanner}>⭐ JORNADA VIP ⭐ (Puntos Dobles)</div>}
                    
                    {currentJornada.h2hInfo && (
                        <div style={styles.h2hContainer}>
                            <h4 style={styles.h2hTitle}>⚔️ Historial Fase Regular ⚔️</h4>
                            <p style={styles.h2hText}>{currentJornada.h2hInfo}</p>
                        </div>
                    )}

                    <div style={styles.giantLogoContainer}>
                        <div style={styles.giantLogoWrapper}>
                            <img src={teamLogos[currentJornada.equipoLocal] || 'https://placehold.co/120x120'} style={styles.giantLogo} alt="Local" />
                            <span style={{fontWeight: 'bold', fontSize: '1.2rem', textAlign: 'center'}}>{currentJornada.equipoLocal}</span>
                        </div>
                        <span style={{fontSize: '2.5rem', color: styles.colors.golden, fontWeight: 'bold', textShadow: `0 0 15px ${styles.colors.goldenDark}`}}>VS</span>
                        <div style={styles.giantLogoWrapper}>
                            <img src={teamLogos[currentJornada.equipoVisitante] || 'https://placehold.co/120x120'} style={styles.giantLogo} alt="Visitante" />
                            <span style={{fontWeight: 'bold', fontSize: '1.2rem', textAlign: 'center'}}>{currentJornada.equipoVisitante}</span>
                        </div>
                    </div>

                    <div style={styles.formGroup}>
                        <label style={styles.label}>RESULTADO EXACTO <span style={styles.oddsBadge}>{currentJornada.esVip ? '6 PTS' : '3 PTS'}</span></label>
                        <div style={styles.resultInputContainer}>
                            <input type="number" name="golesLocal" value={pronostico.golesLocal} onChange={handleChange} style={styles.resultInput} min="0" placeholder="L" />
                            <span style={styles.separator}>-</span>
                            <input type="number" name="golesVisitante" value={pronostico.golesVisitante} onChange={handleChange} style={styles.resultInput} min="0" placeholder="V" />
                        </div>
                        <p style={{color: styles.colors.warning, fontSize: '0.85rem', textAlign: 'center', marginTop: '15px', fontStyle: 'italic'}}>
                            ⚠️ El resultado incluye Prórroga (Excluye Penaltis)
                        </p>
                    </div>

                    <div style={styles.formGroup}>
                        <label style={styles.label}>{isIda ? "RESULTADO 1X2" : "DESENLACE ELIMINATORIA"} <span style={styles.oddsBadge}>{currentJornada.esVip ? '2 PTS' : '1 PT'}</span></label>
                        {isIda && (<select name="resultado1x2" value={pronostico.resultado1x2} onChange={handleChange} style={styles.input}><option value="">-- Elige --</option><option value="Gana UD Las Palmas">Gana UD Las Palmas</option><option value="Empate">Empate</option><option value="Pierde UD Las Palmas">Pierde UD Las Palmas</option></select>)}
                        {isVSemi && (<div style={{display: 'flex', gap: '10px'}}><button type="button" onClick={() => handleChange({target: {name: 'resultado1x2', value: 'Pasa UD Las Palmas'}})} style={pronostico.resultado1x2 === 'Pasa UD Las Palmas' ? styles.pasaButtonActive : styles.pasaButtonInactive}>PASA UDLP</button><button type="button" onClick={() => handleChange({target: {name: 'resultado1x2', value: 'No Pasa UD Las Palmas'}})} style={pronostico.resultado1x2 === 'No Pasa UD Las Palmas' ? styles.pasaButtonActive : styles.pasaButtonInactive}>NO PASA</button></div>)}
                        {isVFinal && (<div style={{display: 'flex', gap: '10px'}}><button type="button" onClick={() => handleChange({target: {name: 'resultado1x2', value: 'Asciende UD Las Palmas'}})} style={pronostico.resultado1x2 === 'Asciende UD Las Palmas' ? styles.pasaButtonActive : styles.pasaButtonInactive}>ASCIENDE UDLP</button><button type="button" onClick={() => handleChange({target: {name: 'resultado1x2', value: 'No Asciende UD Las Palmas'}})} style={pronostico.resultado1x2 === 'No Asciende UD Las Palmas' ? styles.pasaButtonActive : styles.pasaButtonInactive}>NO ASCIENDE</button></div>)}
                    </div>

                    <div style={styles.formGroup}>
                        <label style={styles.label}>PRIMER GOLEADOR UDLP <span style={styles.oddsBadge}>{currentJornada.esVip ? '4 PTS' : '2 PTS'}</span></label>
                        <select name="goleador" value={pronostico.goleador} onChange={handleChange} style={styles.input} disabled={pronostico.sinGoleador}><option value="">-- Elige --</option>{plantilla.sort((a,b)=>a.nombre.localeCompare(b.nombre)).map(j => <option key={j.nombre} value={j.nombre}>{j.nombre}</option>)}</select>
                        <div style={{marginTop: '15px', textAlign: 'center'}}><input type="checkbox" name="sinGoleador" id="sgCheck" checked={pronostico.sinGoleador} onChange={handleChange} style={styles.checkbox} /><label htmlFor="sgCheck" style={{marginLeft: '10px', color: styles.colors.lightText, fontWeight: 'bold'}}>Sin Goleador (SG) <span style={styles.oddsBadge}>1 PT</span></label></div>
                    </div>

                    <button type="submit" style={{...styles.mainButton, width: '100%', fontSize: '1.2rem', padding: '15px'}}>GUARDAR APUESTA</button>
                    {message && <p style={{...styles.message, backgroundColor: styles.colors.success}}>{message}</p>}
                </form>
            ) : (<div style={styles.placeholder}><h3>Jornada {currentJornada.estado}</h3>{hasSubmitted ? <p>Tu apuesta: {pronostico.golesLocal}-{pronostico.golesVisitante} | {pronostico.resultado1x2}</p> : <p>No has apostado.</p>}</div>)}
        </div>
    );
};

const ElCaminoScreen = ({ user, userProfiles }) => {
    const [config, setConfig] = useState(null); 
    const [apuesta, setApuesta] = useState(''); 
    const [hasBet, setHasBet] = useState(false);
    const [allBets, setAllBets] = useState([]);
    
    useEffect(() => { 
        onSnapshot(doc(db, "configuracion", "playoff"), (d) => { if(d.exists()) setConfig(d.data()); }); 
        getDoc(doc(db, "apuestasExtra", user)).then(d => { if(d.exists()){ setApuesta(d.data().equipo); setHasBet(true); }}); 
        onSnapshot(collection(db, "apuestasExtra"), (snap) => { setAllBets(snap.docs.map(d => ({id: d.id, ...d.data()}))); });
    }, [user]);

    const handleBet = async (eq) => { 
        if(hasBet || config?.bloqueado) return; 
        if(window.confirm(`¿Apostar por ${eq}? Sumarás +5 puntos si asciende.`)) { 
            await setDoc(doc(db, "apuestasExtra", user), { equipo: eq }); setApuesta(eq); setHasBet(true); 
        }
    };

    const isSecreto = config?.fechaCierreApuestaExtra && new Date() < new Date(config.fechaCierreApuestaExtra.seconds * 1000);

    return (
        <div>
            <h2 style={styles.title}>EL CAMINO AL ASCENSO</h2>
            <div style={styles.bracketContainer}>
                <div style={styles.bracketMatchup}><div style={{...styles.bracketTeam, ...(config?.semi1_ganador === 'UD Almería' ? styles.bracketWinner : {})}}>UD Almería</div><span style={{color: styles.colors.golden}}>VS</span><div style={{...styles.bracketTeam, ...(config?.semi1_ganador === 'CD Castellón' ? styles.bracketWinner : {})}}>CD Castellón</div></div>
                <div style={styles.bracketMatchup}><div style={{...styles.bracketTeam, ...(config?.semi2_ganador === 'Málaga CF' ? styles.bracketWinner : {})}}>Málaga CF</div><span style={{color: styles.colors.golden}}>VS</span><div style={{...styles.bracketTeam, ...(config?.semi2_ganador === 'UD Las Palmas' ? styles.bracketWinner : {})}}>UD Las Palmas</div></div>
                <div style={styles.bracketFinal}><h4 style={{color: styles.colors.yellow, marginBottom: '10px'}}>GRAN FINAL</h4><p style={{fontSize: '1.2rem', fontWeight: 'bold'}}>{config?.semi1_ganador || '???'} vs {config?.semi2_ganador || '???'}</p>{config?.ascendido && <h3 style={{color: styles.colors.success, marginTop: '15px'}}>🎉 ASCIENDE: {config.ascendido} 🎉</h3>}</div>
            </div>
            
            <div style={{...styles.form, textAlign: 'center'}}>
                <h3 style={{color: styles.colors.yellow, marginBottom: '10px'}}>APUESTA EXTRA <span style={styles.oddsBadge}>+5 PTS</span></h3>
                <p style={{marginBottom: '15px', color: styles.colors.silver}}>¿Qué equipo logrará el ascenso a Primera División?</p>
                {!hasBet && (!config || !config.bloqueado) ? (
                    <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center'}}>
                        {["UD Almería", "Málaga CF", "UD Las Palmas", "CD Castellón"].map(eq => (<button key={eq} onClick={() => handleBet(eq)} style={styles.secondaryButton}>{eq}</button>))}
                    </div>
                ) : (
                    <div style={{padding: '15px', backgroundColor: 'rgba(212,175,55,0.1)', borderRadius: '8px', border: `1px solid ${styles.colors.gold}`}}>
                        <p style={{fontWeight: 'bold', fontSize: '1.2rem'}}>Tu apuesta: <span style={{color: styles.colors.golden}}>{apuesta}</span></p>
                        {config?.ascendido && <p style={{marginTop: '10px', fontWeight: 'bold', color: config.ascendido === apuesta ? styles.colors.success : styles.colors.danger}}>{config.ascendido === apuesta ? '¡HAS GANADO +5 PUNTOS!' : 'Apuesta Fallada'}</p>}
                    </div>
                )}
            </div>

            <div style={{marginTop: '30px'}}>
                <h4 style={styles.formSectionTitle}>APUESTAS DE LOS JUGADORES</h4>
                <div style={{backgroundColor: styles.colors.darkUIAlt, padding: '15px', borderRadius: '12px', border: `1px solid ${styles.colors.goldenDark}50`}}>
                    {allBets.length > 0 ? (
                        <ul style={{listStyle: 'none', padding: 0}}>
                            {allBets.map(b => (
                                <li key={b.id} style={{padding: '10px 0', borderBottom: `1px dashed ${styles.colors.goldenDark}50`, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                    <PlayerProfileDisplay name={b.id} profile={userProfiles[b.id]} />
                                    {b.id === user ? ( <span style={{fontWeight: 'bold', color: styles.colors.golden}}>{b.equipo}</span> ) : (
                                        isSecreto ? <span style={styles.secrecyBadge}>Secreta 🤫</span> : <span style={{fontWeight: 'bold', color: styles.colors.silver}}>{b.equipo}</span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : (<p style={{textAlign: 'center', color: styles.colors.silver}}>Aún no hay apuestas.</p>)}
                </div>
            </div>
        </div>
    );
};
const LaJornadaScreen = ({ user, teamLogos, liveData, userProfiles, onlineUsers, clasificacionData }) => {
    const [jornadaActual, setJornadaActual] = useState(null);
    const [participantes, setParticipantes] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, "jornadas"), where("estado", "in", ["Abierta", "Cerrada", "Finalizada", "Pre-apertura", "En vivo"]), orderBy("numeroJornada", "desc"), limit(1));
        const unsubscribeJornada = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const jornada = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
                setJornadaActual(jornada);
                const pronosticosRef = collection(db, "pronosticos", jornada.id, "jugadores");
                onSnapshot(pronosticosRef, (pronosticosSnap) => {
                    setParticipantes(pronosticosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                });
            } else { setJornadaActual(null); setParticipantes([]); }
            setLoading(false);
        });
        return () => unsubscribeJornada();
    }, []);

    if (loading) return <LoadingSkeleton />;
    if (!jornadaActual) return <div style={styles.placeholder}>No hay datos de jornada disponibles.</div>;

    const isLiveView = jornadaActual.estado === 'En vivo' && liveData;

    return (
        <div>
            <h2 style={styles.title} className="app-title">LA JORNADA</h2>
            <div style={styles.laJornadaContainer}>
                <h3 className="app-title" style={{color: styles.colors.golden}}>
                    {jornadaActual.id === 'jornada_test' ? 'Jornada de Prueba' : `Jornada ${jornadaActual.numeroJornada}`}
                </h3>
                
                <div style={styles.giantLogoContainer}>
                    <div style={styles.giantLogoWrapper}>
                        <img src={teamLogos[jornadaActual.equipoLocal] || 'https://placehold.co/120x120'} style={styles.giantLogo} alt="Local" />
                    </div>
                    <span style={{fontSize: '2.5rem', color: styles.colors.golden, fontWeight: 'bold'}}>
                        {isLiveView ? `${liveData.golesLocal} - ${liveData.golesVisitante}` : (jornadaActual.estado === 'Finalizada' ? `${jornadaActual.resultadoLocal} - ${jornadaActual.resultadoVisitante}` : 'VS')}
                    </span>
                    <div style={styles.giantLogoWrapper}>
                        <img src={teamLogos[jornadaActual.equipoVisitante] || 'https://placehold.co/120x120'} style={styles.giantLogo} alt="Visitante" />
                    </div>
                </div>

                <div style={{marginTop: '30px'}}>
                    <h4 style={styles.formSectionTitle}>PRONÓSTICOS DE LOS JUGADORES</h4>
                    {jornadaActual.estado === 'Abierta' || jornadaActual.estado === 'Pre-apertura' ? (
                        <div style={{padding: '20px', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: '12px', border: `1px dashed ${styles.colors.goldenDark}`}}>
                            <p style={{color: styles.colors.silver}}>Las apuestas son secretas hasta el cierre.</p>
                            <p style={{marginTop: '10px', fontSize: '1.2rem', color: styles.colors.golden}}>Han apostado: {participantes.length} / {JUGADORES.length}</p>
                        </div>
                    ) : (
                        <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                            {participantes.sort((a,b) => (b.puntosObtenidos || 0) - (a.puntosObtenidos || 0)).map(p => (
                                <div key={p.id} style={{backgroundColor: styles.colors.darkUIAlt, padding: '15px', borderRadius: '12px', borderLeft: `4px solid ${styles.colors.golden}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                    <div>
                                        <PlayerProfileDisplay name={p.id} profile={userProfiles[p.id]} />
                                        <div style={{fontSize: '0.9rem', color: styles.colors.lightText, marginTop: '5px'}}>
                                            {p.golesLocal}-{p.golesVisitante} ({p.resultado1x2}) | {p.sinGoleador ? 'SG' : p.goleador}
                                        </div>
                                    </div>
                                    {jornadaActual.estado === 'Finalizada' && (
                                        <div style={{fontSize: '1.5rem', fontWeight: 'bold', color: styles.colors.golden}}>{p.puntosObtenidos || 0} pts</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- LIGA REGULAR (Estática) ---
const LigaRegularScreen = ({ userProfiles }) => {
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
            <p style={{textAlign: 'center', marginBottom: '20px'}}>Clasificación acumulada de las 42 jornadas (Base para la final).</p>
            <div style={{overflowX: 'auto'}}>
                <table style={styles.table}>
                    <thead>
                        <tr><th style={styles.th}>POS</th><th style={styles.th}>JUGADOR</th><th style={styles.th}>PUNTOS</th></tr>
                    </thead>
                    <tbody>
                        {clasificacion.map((jugador, index) => {
                            const profile = userProfiles[jugador.id] || {};
                            return (
                                <tr key={jugador.id} style={styles.tr}>
                                    <td style={styles.tdRank}>{index + 1}º</td>
                                    <td style={styles.td}><PlayerProfileDisplay name={jugador.id} profile={profile} /></td>
                                    <td style={styles.tdTotalPoints}>{jugador.puntosTotales || 0}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- CLASIFICACIÓN ---
const ClasificacionScreen = ({ currentUser, liveData, liveJornada, userProfiles }) => {
    const [clasificacion, setClasificacion] = useState([]); 
    const [loading, setLoading] = useState(true); 

    useEffect(() => { 
        const qClasificacion = query(collection(db, "clasificacion")); 
        const unsubscribe = onSnapshot(qClasificacion, (querySnapshot) => { 
            const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); 
            setClasificacion(data.sort((a,b) => (b.puntosTotales || 0) - (a.puntosTotales || 0))); 
            setLoading(false); 
        }); 
        return () => unsubscribe();
    }, []);

    if (loading) return <LoadingSkeleton />; 

    return (
        <div>
            <h2 style={styles.title} className="app-title">CLASIFICACIÓN PLAYOFF</h2>
            
            {/* BANNER DE PREMIOS */}
            <div style={styles.prizeBannerFinal}>
                🏆 PREMIO FINAL ACUMULADO (2 Últimas Jornadas VIPs) 🏆<br/>
                <span style={{fontSize: '0.85rem', fontWeight: 'normal', display: 'block', marginTop: '5px'}}>
                    1º Clasificado: Premio valorado en 40€ | 2º Clasificado: Premio valorado en 15€ | 3º Clasificado: Premio valorado en 5€
                </span>
            </div>

            <div style={{overflowX: 'auto'}}>
                <table style={styles.table}>
                    <thead>
                        <tr><th style={styles.th}>POS</th><th style={styles.th}>JUGADOR</th><th style={{...styles.th, textAlign: 'center'}}>TOTAL</th><th style={{...styles.th, textAlign: 'center'}}>P. EXACTO</th><th style={{...styles.th, textAlign: 'center'}}>PLENOS 🎯</th></tr>
                    </thead>
                    <tbody>
                        {clasificacion.map((jugador, index) => { 
                            const profile = {...(userProfiles[jugador.id] || {}), badges: jugador.badges || []}; 
                            const rowStyle = jugador.id === currentUser ? {backgroundColor: 'rgba(212, 175, 55, 0.2)', border: `1px solid ${styles.colors.golden}`} : styles.tr;
                            return (
                                <tr key={jugador.id} style={rowStyle}>
                                    <td style={styles.tdRank}>{index + 1}º</td>
                                    <td style={styles.td}><PlayerProfileDisplay name={jugador.id} profile={profile} /></td>
                                    <td style={styles.tdTotalPoints}>{jugador.puntosTotales || 0}</td>
                                    <td style={{...styles.td, textAlign: 'center'}}>{jugador.puntosResultadoExacto || 0}</td>
                                    <td style={{...styles.td, textAlign: 'center'}}>{jugador.plenos || 0}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- PAGOS (Eliminada la tabla de Morosos) ---
const PagosScreen = ({ userProfiles }) => {
    const [jornadas, setJornadas] = useState([]); 
    const [loading, setLoading] = useState(true); 
    
    useEffect(() => {
        const unsub = onSnapshot(query(collection(db, "jornadas"), orderBy("numeroJornada")), (jornadasSnap) => {
            const jornadasData = jornadasSnap.docs.map(jDoc => ({ id: jDoc.id, ...jDoc.data() }));
            const promises = jornadasData.map(j => getDocs(collection(db, "pronosticos", j.id, "jugadores")));
            Promise.all(promises).then(pSnaps => {
                const jConP = jornadasData.map((j, index) => {
                    const pronosticos = pSnaps[index].docs.map(doc => ({id: doc.id, ...doc.data()}));
                    const coste = j.esVip ? APUESTA_VIP : APUESTA_NORMAL;
                    const rec = pronosticos.length * coste; const premio = (j.bote || 0) + rec;
                    return { ...j, pronosticos, recaudadoJornada: rec, premioTotal: premio };
                });
                setJornadas(jConP); setLoading(false);
            });
        }); return () => unsub();
    }, []);

    if (loading) return <LoadingSkeleton />;

    return (
        <div>
            <h2 style={styles.title} className="app-title">LIBRO DE CUENTAS</h2>
            
            {/* BANNER DE PREMIOS REPETIDO AQUÍ */}
            <div style={styles.prizeBannerFinal}>
                🏆 PREMIO FINAL ACUMULADO (2 Últimas Jornadas VIPs) 🏆<br/>
                <span style={{fontSize: '0.85rem', fontWeight: 'normal', display: 'block', marginTop: '5px'}}>
                    1º Clasificado: Premio valorado en 40€ | 2º Clasificado: Premio valorado en 15€ | 3º Clasificado: Premio valorado en 5€
                </span>
            </div>

            <div style={{marginTop: '20px'}}>
                {jornadas.filter(j => j.estado === 'Finalizada').reverse().map(j => {
                    const jConBote = j.ganadores?.length === 0;
                    return (
                        <div key={j.id} style={{backgroundColor: styles.colors.darkUIAlt, padding: '20px', borderRadius: '12px', marginBottom: '20px', border: `1px solid ${styles.colors.goldenDark}50`}}>
                            <h4 style={{...styles.formSectionTitle, color: styles.colors.lightText}} className="app-title">Jornada {j.numeroJornada}: {j.equipoLocal} vs {j.equipoVisitante}</h4>
                            <div style={{display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '15px', marginBottom: '15px', color: styles.colors.golden}}>
                                <span><strong>Recaudado:</strong> {j.recaudadoJornada}€</span>
                                <span><strong>Bote:</strong> {j.bote || 0}€</span>
                                <span><strong>Premio Total:</strong> {j.premioTotal}€</span>
                            </div>
                            {jConBote ? (
                                <div style={{textAlign: 'center', padding: '10px', backgroundColor: 'rgba(230, 57, 70, 0.2)', borderRadius: '8px', color: styles.colors.danger, fontWeight: 'bold'}}>
                                    💰 BOTE ACUMULADO. El premio pasa a la siguiente jornada.
                                </div>
                            ) : (
                                <div style={{textAlign: 'center', padding: '10px', backgroundColor: 'rgba(212, 175, 55, 0.1)', borderRadius: '8px', border: `1px solid ${styles.colors.golden}`}}>
                                    <p><strong>🏆 Ganador(es):</strong> {j.ganadores.join(', ')}</p>
                                    <p style={{color: styles.colors.success, fontWeight: 'bold'}}>Premio por ganador: {(j.premioTotal / j.ganadores.length).toFixed(2)}€</p>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    );
};

// --- PESTAÑA ESTADÍSTICAS ---
const EstadisticasScreen = ({ userProfiles }) => {
    const [stats, setStats] = useState(null);

    useEffect(() => {
        const fetchStats = async () => {
            const jSnap = await getDocs(query(collection(db, "jornadas"), where("estado", "==", "Finalizada")));
            const jornadas = jSnap.docs.map(d => ({id: d.id, ...d.data()}));
            
            const st = {};
            JUGADORES.forEach(j => st[j] = { maxPuntosJornada: 0, golesAcertados: 0, rachaPuntos: 0, rachaCeros: 0, aRP: 0, aRC: 0 });

            for (const j of jornadas) {
                const pSnap = await getDocs(collection(db, "pronosticos", j.id, "jugadores"));
                pSnap.forEach(p => {
                    const data = p.data();
                    const s = st[p.id];
                    if(!s) return;
                    
                    if (data.puntosObtenidos > s.maxPuntosJornada) s.maxPuntosJornada = data.puntosObtenidos;
                    if (data.puntosGoleador > 0) s.golesAcertados++;
                    if (data.puntosObtenidos > 0) { s.aRP++; s.aRC = 0; } else { s.aRC++; s.aRP = 0; }
                    if (s.aRP > s.rachaPuntos) s.rachaPuntos = s.aRP;
                    if (s.aRC > s.rachaCeros) s.rachaCeros = s.aRC;
                });
            }
            setStats(st);
        };
        fetchStats();
    }, []);

    if (!stats) return <LoadingSkeleton />;

    const getTop = (f) => Object.entries(stats).sort((a,b) => b[1][f] - a[1][f])[0];
    const tG = getTop('golesAcertados'); const tP = getTop('maxPuntosJornada'); const tR = getTop('rachaPuntos'); const tC = getTop('rachaCeros');

    return (
        <div>
            <h2 style={styles.title} className="app-title">SALÓN DE LA FAMA</h2>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', marginTop: '30px'}}>
                <div style={{backgroundColor: 'rgba(0,0,0,0.4)', padding: '20px', borderRadius: '12px', textAlign: 'center', border: `1px solid ${styles.colors.goldenDark}50`}}>
                    <h3 style={{color: styles.colors.silver, fontSize: '1rem', textTransform: 'uppercase'}}>⚽ El Visionario</h3>
                    <p style={{fontSize:'1.5rem', margin:'10px 0', color: styles.colors.golden}}><PlayerProfileDisplay name={tG[0]} profile={userProfiles ? userProfiles[tG[0]] : {}} /></p>
                    <p style={{color: styles.colors.lightText}}>{tG[1].golesAcertados} aciertos goleador</p>
                </div>
                <div style={{backgroundColor: 'rgba(0,0,0,0.4)', padding: '20px', borderRadius: '12px', textAlign: 'center', border: `1px solid ${styles.colors.goldenDark}50`}}>
                    <h3 style={{color: styles.colors.silver, fontSize: '1rem', textTransform: 'uppercase'}}>💣 El Pelotazo</h3>
                    <p style={{fontSize:'1.5rem', margin:'10px 0', color: styles.colors.golden}}><PlayerProfileDisplay name={tP[0]} profile={userProfiles ? userProfiles[tP[0]] : {}} /></p>
                    <p style={{color: styles.colors.lightText}}>{tP[1].maxPuntosJornada} pts en 1 jornada</p>
                </div>
                <div style={{backgroundColor: 'rgba(0,0,0,0.4)', padding: '20px', borderRadius: '12px', textAlign: 'center', border: `1px solid ${styles.colors.goldenDark}50`}}>
                    <h3 style={{color: styles.colors.silver, fontSize: '1rem', textTransform: 'uppercase'}}>🔥 En Llamas</h3>
                    <p style={{fontSize:'1.5rem', margin:'10px 0', color: styles.colors.golden}}><PlayerProfileDisplay name={tR[0]} profile={userProfiles ? userProfiles[tR[0]] : {}} /></p>
                    <p style={{color: styles.colors.lightText}}>{tR[1].rachaPuntos} jornadas seguidas</p>
                </div>
                <div style={{backgroundColor: 'rgba(0,0,0,0.4)', padding: '20px', borderRadius: '12px', textAlign: 'center', border: `1px solid ${styles.colors.goldenDark}50`}}>
                    <h3 style={{color: styles.colors.silver, fontSize: '1rem', textTransform: 'uppercase'}}>🥶 El Cenizo</h3>
                    <p style={{fontSize:'1.5rem', margin:'10px 0', color: styles.colors.golden}}><PlayerProfileDisplay name={tC[0]} profile={userProfiles ? userProfiles[tC[0]] : {}} /></p>
                    <p style={{color: styles.colors.lightText}}>{tC[1].rachaCeros} jornadas a cero</p>
                </div>
            </div>
        </div>
    );
};

const CalendarioScreen = ({ onViewJornada, teamLogos }) => {
    const [jornadas, setJornadas] = useState([]); const [loading, setLoading] = useState(true);
    useEffect(() => { 
        const q = query(collection(db, "jornadas"), orderBy("numeroJornada")); 
        const unsubscribe = onSnapshot(q, (querySnapshot) => { setJornadas(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); setLoading(false); }); 
        return () => unsubscribe(); 
    }, []);
    if (loading) return <LoadingSkeleton />;
    return (
        <div>
            <h2 style={styles.title} className="app-title">CALENDARIO PLAYOFF</h2>
            <div style={styles.jornadaList}>
                {jornadas.map(jornada => (
                    <div key={jornada.id} style={styles.jornadaItem}>
                        <div style={{display: 'flex', flexDirection: 'column', gap: '5px'}}>
                            <strong>{jornada.esVip && '⭐ '}{jornada.equipoLocal} vs {jornada.equipoVisitante}</strong>
                            <small style={{color: styles.colors.silver}}>{formatFullDateTime(jornada.fechaPartido)}</small>
                        </div>
                        <div style={{backgroundColor: styles.colors.status[jornada.estado] || styles.colors.silver, padding: '5px 12px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold', color: '#fff'}}>{jornada.estado}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ============================================================================
// --- ADMINISTRADOR ---
// ============================================================================
const JornadaAdminItem = ({ jornada }) => {
    const [estado, setEstado] = useState(jornada.estado);
    const [resultadoLocal, setResultadoLocal] = useState(jornada.resultadoLocal === undefined ? '' : jornada.resultadoLocal);
    const [resultadoVisitante, setResultadoVisitante] = useState(jornada.resultadoVisitante === undefined ? '' : jornada.resultadoVisitante);
    const [esVip, setEsVip] = useState(jornada.esVip || false);
    const [tipoPartido, setTipoPartido] = useState(jornada.tipoPartido || 'ida');
    const [h2hInfo, setH2hInfo] = useState(jornada.h2hInfo || ''); // NUEVO: CAMPO HISTORIAL

    const handleSaveChanges = async () => {
        const jornadaRef = doc(db, "jornadas", jornada.id);
        await updateDoc(jornadaRef, { estado, resultadoLocal, resultadoVisitante, esVip, tipoPartido, h2hInfo });
        alert('Guardado');
    };

    return (
        <div style={styles.adminJornadaItem}>
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '15px'}}>
                <p><strong>{jornada.equipoLocal} vs {jornada.equipoVisitante}</strong></p>
                <div><label>⭐ VIP</label><input type="checkbox" checked={esVip} onChange={(e) => setEsVip(e.target.checked)} style={styles.checkbox}/></div>
            </div>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px'}}>
                <div><label style={styles.label}>Estado:</label><select value={estado} onChange={(e) => setEstado(e.target.value)} style={styles.adminSelect}><option value="Próximamente">Próximamente</option><option value="Pre-apertura">Pre-apertura</option><option value="Abierta">Abierta</option><option value="Cerrada">Cerrada</option><option value="En vivo">En vivo</option><option value="Finalizada">Finalizada</option></select></div>
                <div><label style={styles.label}>Tipo Eliminatoria:</label><select value={tipoPartido} onChange={(e) => setTipoPartido(e.target.value)} style={styles.adminSelect}><option value="ida">Liga / Ida (1X2)</option><option value="vuelta_semi">Vuelta Semi (Pasa/No pasa)</option><option value="vuelta_final">Vuelta Final (Asciende)</option></select></div>
                <div style={{gridColumn: '1 / -1'}}><label style={styles.label}>Historial vs Rival (Opcional - Se mostrará a los usuarios):</label><input type="text" value={h2hInfo} onChange={(e) => setH2hInfo(e.target.value)} placeholder="Ej: UDLP 2-1 Málaga | Málaga 0-0 UDLP" style={styles.input} /></div>
            </div>
            <button onClick={handleSaveChanges} style={{...styles.saveButton, marginTop: '15px'}}>Guardar Cambios</button>
        </div>
    );
};

const AdminPlayoffPanel = () => {
    const [config, setConfig] = useState({ semi1_ganador: '', semi2_ganador: '', ascendido: '', bloqueado: false, fechaCierreApuestaExtra: '' });
    
    useEffect(() => { 
        onSnapshot(doc(db, "configuracion", "playoff"), d => { 
            if(d.exists()) {
                const data = d.data();
                if(data.fechaCierreApuestaExtra && data.fechaCierreApuestaExtra.seconds) {
                    const date = new Date(data.fechaCierreApuestaExtra.seconds * 1000);
                    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
                    data.fechaCierreApuestaExtra = date.toISOString().slice(0, 16);
                }
                setConfig(data); 
            }
        }); 
    }, []);

    const handleSave = async () => { 
        const saveConfig = {...config};
        if(saveConfig.fechaCierreApuestaExtra) saveConfig.fechaCierreApuestaExtra = new Date(saveConfig.fechaCierreApuestaExtra);
        else saveConfig.fechaCierreApuestaExtra = null;
        await setDoc(doc(db, "configuracion", "playoff"), saveConfig); 
        alert("Configuración Guardada"); 
    };

    return (
        <div style={styles.adminJornadaItem}>
            <h3 style={styles.formSectionTitle}>Gestión "El Camino"</h3>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px'}}>
                <div><label style={styles.label}>Ganador Semi 1:</label><select value={config.semi1_ganador} onChange={e=>setConfig({...config, semi1_ganador: e.target.value})} style={styles.adminSelect}><option value="">--</option><option value="UD Almería">Almería</option><option value="CD Castellón">Castellón</option></select></div>
                <div><label style={styles.label}>Ganador Semi 2:</label><select value={config.semi2_ganador} onChange={e=>setConfig({...config, semi2_ganador: e.target.value})} style={styles.adminSelect}><option value="">--</option><option value="Málaga CF">Málaga</option><option value="UD Las Palmas">UDLP</option></select></div>
                <div><label style={styles.label}>¡EQUIPO ASCENDIDO!:</label><input type="text" value={config.ascendido || ''} onChange={e=>setConfig({...config, ascendido: e.target.value})} style={styles.input} /></div>
                <div><label style={styles.label}>Fecha Cierre Apuestas Extras (+5):</label><input type="datetime-local" value={config.fechaCierreApuestaExtra || ''} onChange={e=>setConfig({...config, fechaCierreApuestaExtra: e.target.value})} style={styles.input} /></div>
            </div>
            <div style={{marginTop: '15px'}}><input type="checkbox" checked={config.bloqueado} onChange={e=>setConfig({...config, bloqueado: e.target.checked})} style={styles.checkbox} /> <span style={{color:colors.lightText, marginLeft:'10px'}}>Bloquear Apuestas Extra (Botones)</span></div>
            <button onClick={handleSave} style={{...styles.saveButton, marginTop:'15px'}}>Guardar Cuadro Playoff</button>
        </div>
    );
};

const AdminPanelScreen = () => {
    const [jornadas, setJornadas] = useState([]);
    useEffect(() => { const unsub = onSnapshot(query(collection(db, "jornadas"), orderBy("numeroJornada")), (snap) => { setJornadas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); }); return () => unsub(); }, []);
    return (<div><h2 style={styles.title}>PANEL DE ADMINISTRADOR</h2><AdminPlayoffPanel />{jornadas.map(j => (<JornadaAdminItem key={j.id} jornada={j} />))}</div>);
};

// ============================================================================
// --- COMPONENTE PRINCIPAL APP ---
// ============================================================================
function App() {
    const [screen, setScreen] = useState('login');
    const [activeTab, setActiveTab] = useState('miJornada');
    const [currentUser, setCurrentUser] = useState(null);
    const [teamLogos, setTeamLogos] = useState({});
    const [plantilla, setPlantilla] = useState(PLANTILLA_ACTUALIZADA);
    const [userProfiles, setUserProfiles] = useState({});
    const [onlineUsers, setOnlineUsers] = useState({});
    const [clasificacionData, setClasificacionData] = useState([]);
    const [showWelcomeModal, setShowWelcomeModal] = useState(false);

    useEffect(() => {
        const styleSheet = document.createElement("style"); 
        styleSheet.innerText = `
            @import url('https://fonts.googleapis.com/css2?family=Teko:wght@700&family=Orbitron&family=Exo+2&family=Russo+One&display=swap');
            * { margin: 0; padding: 0; box-sizing: border-box; }
            html { font-size: 16px !important; -webkit-text-size-adjust: 100%; }
            body, #root { width: 100%; min-width: 100%; overflow-x: hidden; background-color: ${colors.deepBlue}; }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes slideInFromRight { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
            .content-enter-active { animation: slideInFromRight 0.4s ease-out; }
            @keyframes title-shine { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        `;
        document.head.appendChild(styleSheet);
        
        signInAnonymously(auth);
        
        const unsubEscudos = onSnapshot(doc(db, "configuracion", "escudos"), (docSnap) => { if (docSnap.exists()) setTeamLogos(docSnap.data()); });
        const unsubClasificacion = onSnapshot(collection(db, "clasificacion"), (snapshot) => { 
            const profiles = {}; const clasificacion = []; 
            snapshot.forEach(doc => { const data = doc.data(); profiles[doc.id] = data; clasificacion.push({id: doc.id, ...data}); }); 
            setUserProfiles(profiles); setClasificacionData(clasificacion);
        });
        const unsubStatus = onValue(ref(rtdb, 'status/'), (snapshot) => { setOnlineUsers(snapshot.val() || {}); });

        return () => { document.head.removeChild(styleSheet); unsubEscudos(); unsubClasificacion(); unsubStatus(); }
    }, []);

    const handleLogin = async (user) => {
        try {
            setCurrentUser(user);
            set(ref(rtdb, 'status/' + user), true); onDisconnect(ref(rtdb, 'status/' + user)).set(false);
            setScreen('app');
            
            // Comprobación de primera vez en Playoff
            if (!localStorage.getItem('playoffWelcomeSeen')) { setShowWelcomeModal(true); }
        } catch (error) { alert("Error al iniciar sesión."); }
    };

    const handleLogout = async () => { if (currentUser) set(ref(rtdb, 'status/' + currentUser), false); setCurrentUser(null); setScreen('login'); };

    if (screen === 'login') return <div style={styles.container}><div style={styles.card}><div style={styles.loginContainer}><h2 style={styles.title}>ACCESO PLAYOFF</h2><div style={styles.userList}>{JUGADORES.map(j => <button key={j} onClick={() => handleLogin(j)} style={styles.userButton}>{userProfiles[j]?.icon || '❓'} {j}</button>)}</div></div></div></div>;

    const renderContent = () => {
        switch (activeTab) {
            case 'miJornada': return <MiJornadaScreen user={currentUser} teamLogos={teamLogos} plantilla={plantilla} userProfiles={userProfiles} />;
            case 'elCamino': return <ElCaminoScreen user={currentUser} userProfiles={userProfiles} />;
            case 'laJornada': return <LaJornadaScreen user={currentUser} teamLogos={teamLogos} userProfiles={userProfiles} onlineUsers={onlineUsers} clasificacionData={clasificacionData} />;
            case 'clasificacion': return <ClasificacionScreen currentUser={currentUser} userProfiles={userProfiles} />;
            case 'ligaRegular': return <LigaRegularScreen userProfiles={userProfiles} />;
            case 'estadisticas': return <EstadisticasScreen userProfiles={userProfiles} />;
            case 'pagos': return <PagosScreen userProfiles={userProfiles} />;
            case 'calendario': return <CalendarioScreen teamLogos={teamLogos} />;
            case 'admin': return currentUser === 'Juanma' ? <AdminPanelScreen /> : null;
            default: return null;
        }
    };

    return (
        <>
            {showWelcomeModal && <PlayoffWelcomeModal onClose={() => setShowWelcomeModal(false)} />}
            <div style={styles.container}>
                <div style={styles.card}>
                    <nav style={styles.navbar}>
                        <button onClick={() => setActiveTab('miJornada')} style={activeTab === 'miJornada' ? styles.navButtonActive : styles.navButton}>⭐ Mi Jornada</button>
                        <button onClick={() => setActiveTab('elCamino')} style={activeTab === 'elCamino' ? styles.navButtonActive : styles.navButton}>🏆 El Camino</button>
                        <button onClick={() => setActiveTab('laJornada')} style={activeTab === 'laJornada' ? styles.navButtonActive : styles.navButton}>La Jornada</button>
                        <button onClick={() => setActiveTab('clasificacion')} style={activeTab === 'clasificacion' ? styles.navButtonActive : styles.navButton}>Clasificación</button>
                        <button onClick={() => setActiveTab('ligaRegular')} style={activeTab === 'ligaRegular' ? styles.navButtonActive : styles.navButton}>Liga Reg.</button>
                        <button onClick={() => setActiveTab('estadisticas')} style={activeTab === 'estadisticas' ? styles.navButtonActive : styles.navButton}>Estadísticas</button>
                        <button onClick={() => setActiveTab('pagos')} style={activeTab === 'pagos' ? styles.navButtonActive : styles.navButton}>Pagos</button>
                        <button onClick={() => setActiveTab('calendario')} style={activeTab === 'calendario' ? styles.navButtonActive : styles.navButton}>Calendario</button>
                        {currentUser === 'Juanma' && (<button onClick={() => setActiveTab('admin')} style={activeTab === 'admin' ? styles.navButtonActive : styles.navButton}>Admin</button>)}
                        <button onClick={handleLogout} style={styles.logoutButton}>Salir</button>
                    </nav>
                    <div key={activeTab} className="content-enter-active" style={{paddingTop: '15px'}}>{renderContent()}</div>
                </div>
            </div>
        </>
    );
}

export default App;