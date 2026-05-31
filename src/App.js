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

// NUEVO: Historial H2H para el Playoff (Sustituye a la API)
const HISTORICO_LIGA = {
    "Málaga CF": "Málaga 0-0 UDLP | UDLP 2-1 Málaga",
    "UD Almería": "Almería 2-0 UDLP | UDLP 1-1 Almería",
    "CD Castellón": "UDLP 3-1 Castellón | Castellón 1-1 UDLP",
    "Burgos CF": "UDLP 0-0 Burgos | Burgos 1-2 UDLP"
};

const SECRET_MESSAGES = [
    "Pronóstico Secreto 🤫", "Aquí huele a BOTE...", "Voy a ganar yo 😎", "Top Secret",
    "Clasificado ⭐", "Me lo guardo para mí", "Jugada Maestra en proceso...", "Ni el VAR lo sabe",
    "Consultando con el Oráculo", "Shhh... es un secreto", "Apuesta Fantasma 👻",
    "Resultado 'Confidencial'", "Cargando... 99%", "El que lo sabe, lo sabe", "Mejor no digo nada..."
];
const STAT_REACTION_EMOJIS = ['👍', '🔥', '🤯', '😂', '😥', '👏'];
const GOAL_REACTION_EMOJIS = ['🙌', '⚽', '🎉', '🤩', '🤯'];

const BADGE_DEFINITIONS = {
    lider_general: { icon: '👑', name: 'Líder General', priority: 1, style: 'leader-glow' },
    campeon_jornada: { icon: '🏆', name: 'Campeón de la Jornada', priority: 2, style: 'champion-glow' },
    pleno_jornada: { icon: '🎯', name: 'Pleno en la Jornada', priority: 3, style: 'pleno-flash' },
    en_racha: { icon: '🔥', name: 'En Racha', priority: 4, style: 'fire-streak' },
    mala_racha: { icon: '🥶', name: 'Mala Racha', priority: 5, style: 'cold-streak' },
};

const FAME_STATS_DEFINITIONS = {
    rey_midas: { icon: '🤑', name: 'El Rey Midas', description: 'Jugador que más dinero ha ganado sumando todos los premios.' },
    pelotazo: { icon: '💣', name: 'El Pelotazo', description: 'Jugador que ha conseguido la mayor cantidad de puntos en una sola jornada.' },
    atrevido: { icon: '😎', name: 'El Atrevido', description: 'Jugador que más veces ha acertado un resultado exacto que nadie más pronosticó.' },
    mr_regularidad: { icon: '📈', name: 'Mr. Regularidad', description: 'Jugador que ha puntuado (>0 puntos) en el mayor número de jornadas.' },
    profeta: { icon: '🎯', name: 'El Visionario', description: 'Jugador con más aciertos de primer goleador.' }, // Cambiado a Visionario
    visionario: { icon: '🔥', name: 'En Llamas', description: 'Jugador con la racha más larga de jornadas consecutivas puntuando.' }, // Cambiado a En Llamas
    cenizo: { icon: '🥶', name: 'El Cenizo', description: 'Jugador con la racha más larga de jornadas consecutivas participando y obteniendo 0 puntos.' },
    obstinado: { icon: '🔁', name: 'El Obstinado', description: 'Jugador que más veces ha repetido el mismo pronóstico de resultado exacto.' },
};

const EQUIPOS_LIGA = [
    "UD Las Palmas", "UD Almería", "Málaga CF", "CD Castellón", "Burgos CF",
    "Real Zaragoza", "SD Eibar", "Real Sporting de Gijón", "Real Racing Club"
];

const PLANTILLA_ACTUALIZADA = [
    { dorsal: "1", nombre: "Dinko Horkas", imageUrl: "" },
    { dorsal: "13", nombre: "José Antonio Caro", imageUrl: "" },
    { dorsal: "35", nombre: "Adri Suárez", imageUrl: "" },
    { dorsal: "3", nombre: "Mika Mármol", imageUrl: "" },
    { dorsal: "15", nombre: "Juanma Herzog", imageUrl: "" },
    { dorsal: "4", nombre: "Álex Suárez", imageUrl: "" },
    { dorsal: "5", nombre: "Enrique Clemente", imageUrl: "" },
    { dorsal: "6", nombre: "Sergio Barcia", imageUrl: "" },
    { dorsal: "23", nombre: "Cristian Gutiérrez", imageUrl: "" },
    { dorsal: "17", nombre: "Viti Rozada", imageUrl: "" },
    { dorsal: "2", nombre: "Marvin Park", imageUrl: "" },
    { dorsal: "16", nombre: "Lorenzo Amatucci", imageUrl: "" },
    { dorsal: "18", nombre: "Edward Cedeño", imageUrl: "" },
    { dorsal: "12", nombre: "Enzo Loiodice", imageUrl: "" },
    { dorsal: "20", nombre: "Kirian Rodríguez", imageUrl: "" },
    { dorsal: "8", nombre: "Iván Gil", imageUrl: "" },
    { dorsal: "21", nombre: "Jonathan Viera", imageUrl: "" },
    { dorsal: "9", nombre: "Jeremía Recoba", imageUrl: "" },
    { dorsal: "14", nombre: "Manu Fuster", imageUrl: "" },
    { dorsal: "10", nombre: "Jesé", imageUrl: "" },
    { dorsal: "24", nombre: "Pejiño", imageUrl: "" },
    { dorsal: "22", nombre: "Ale García", imageUrl: "" },
    { dorsal: "29", nombre: "Adam Arvelo", imageUrl: "" },
    { dorsal: "25", nombre: "Milos Lukovic", imageUrl: "" },
    { dorsal: "19", nombre: "Sandro Ramírez", imageUrl: "" },
    { dorsal: "11", nombre: "Marc Cardona", imageUrl: "" },
    { dorsal: "7", nombre: "Jaime Mata", imageUrl: "" }
];

const PROFILE_COLORS = ['#FFD700', '#0055A4', '#FFFFFF', '#fca311', '#52b788', '#e63946', '#9b59b6', 'linear-gradient(45deg, #FFC72C, #0055A4)', 'linear-gradient(45deg, #e63946, #fca311)', 'linear-gradient(45deg, #52b788, #9b59b6)'];
const PROFILE_ICONS = ['🐥', '🇮🇨', '⚽️', '🥅', '🏆', '🥇', '🎉', '🔥', '💪', '😎', '🎯', '🧠', '⭐', '🐐', '👑', '🎮', '🏎️', '😂', '🤯', '🤔', '🤫', '💸', '💣', '🚀', '👽', '🤖', '👻', '🎱', '🍀', '🏃‍♂️', '🏃🏾‍♂️', '1️⃣', '7️⃣', '🔟', '🤑', '😈'];

// ============================================================================
// --- ESTILOS "GOLDEN PLAYOFF" (CSS-in-JS) ---
// ============================================================================
const colors = {
    deepBlue: '#0f0c05', // Tono fondo muy oscuro dorado
    blue: '#d4af37',     // Dorado reemplaza al azul primario
    yellow: '#FFD700',   // Dorado brillante
    gold: '#FFD700', 
    silver: '#C0C0C0', 
    bronze: '#CD7F32', 
    lightText: '#fdfbf7', 
    darkText: '#0a0a0a', 
    danger: '#e63946', 
    success: '#52b788', 
    warning: '#fca311', 
    darkUI: 'rgba(15, 12, 5, 0.90)', 
    darkUIAlt: 'rgba(30, 25, 10, 0.85)',
    status: { 'Próximamente': '#6c757d', 'Pre-apertura': '#fca311', 'Abierta': '#52b788', 'Cerrada': '#e63946', 'En vivo': '#dc3545', 'Finalizada': '#d4af37' }
};

const styles = {
    colors,
    container: { display: 'flex', justifyContent: 'center', alignItems: 'flex-start', width: '100%', minHeight: '100dvh', background: `linear-gradient(145deg, ${colors.deepBlue} 0%, #000 100%)`, padding: '15px', fontFamily: "'Exo 2', sans-serif" },
    card: { width: '100%', maxWidth: '900px', backgroundColor: colors.darkUI, color: colors.lightText, padding: '25px', borderRadius: '16px', boxShadow: `0 0 30px rgba(212, 175, 55, 0.2), 0 10px 30px rgba(0, 0, 0, 0.8)`, minHeight: 'calc(100dvh - 30px)', border: `1px solid ${colors.blue}80`, backdropFilter: 'blur(10px)', transition: 'border-color 0.5s ease, box-shadow 0.5s ease' },
    title: { fontFamily: "'Orbitron', sans-serif", color: colors.yellow, textTransform: 'uppercase', letterSpacing: '2px', textAlign: 'center', borderBottom: `2px solid ${colors.yellow}`, paddingBottom: '10px', marginBottom: '25px', textShadow: `0 0 15px ${colors.yellow}90`, fontSize: 'clamp(1.5rem, 5vw, 1.8rem)', transition: 'all 0.5s ease' },
    mainButton: { fontFamily: "'Orbitron', sans-serif", padding: '10px 25px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', border: `2px solid ${colors.yellow}`, borderRadius: '8px', backgroundColor: colors.yellow, color: colors.darkText, marginTop: '20px', transition: 'all 0.3s ease', textTransform: 'uppercase', letterSpacing: '1px', boxShadow: `0 0 15px ${colors.yellow}50` },
    secondaryButton: { fontFamily: "'Exo 2', sans-serif", padding: '8px 15px', fontSize: '0.9rem', cursor: 'pointer', border: `1px solid ${colors.blue}`, borderRadius: '8px', backgroundColor: 'transparent', color: colors.yellow, transition: 'all 0.3s ease', textTransform: 'uppercase' },
    placeholder: { padding: '40px 20px', backgroundColor: 'rgba(0,0,0,0.4)', border: `2px dashed ${colors.blue}`, borderRadius: '12px', textAlign: 'center', color: colors.lightText },
    initialSplashContainer: { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100%', backgroundColor: colors.deepBlue, animation: 'fadeIn 0.5s ease', transition: 'opacity 0.5s ease' },
    fadeOut: { opacity: 0 },
    fadeIn: { animation: 'fadeIn 0.5s ease' },
    loadingMessage: { marginTop: '30px', animation: 'fadeIn 2s ease-in-out', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', fontFamily: "'Exo 2', sans-serif", color: colors.yellow },
    splashContainer: { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', textAlign: 'center', width: '100%' },
    splashLogoContainer: { marginBottom: '20px', },
    splashLogo: { width: '120px', height: '120px', marginBottom: '10px', objectFit: 'contain' },
    splashTitleContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 0.8 },
    splashTitle: { fontFamily: "'Teko', sans-serif", fontSize: 'clamp(3.5rem, 15vw, 5.5rem)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', background: `linear-gradient(90deg, ${colors.gold}, #FFF, ${colors.yellow}, #FFF, ${colors.gold})`, backgroundSize: '200% auto', color: 'transparent', backgroundClip: 'text', WebkitBackgroundClip: 'text', animation: 'title-shine 4s linear infinite', textShadow: `0 4px 10px rgba(212, 175, 55, 0.4)` },
    splashYear: { fontFamily: "'Russo One', sans-serif", fontSize: 'clamp(2rem, 9vw, 3rem)', background: `linear-gradient(45deg, ${colors.gold}, ${colors.yellow})`, color: 'transparent', backgroundClip: 'text', WebkitBackgroundClip: 'text', textShadow: `0 2px 5px rgba(0,0,0,0.5)`, animation: 'title-shine 4s linear infinite', marginTop: '-15px' },
    splashInfoBox: { border: `2px solid ${colors.yellow}80`, padding: '20px', borderRadius: '10px', marginTop: '30px', backgroundColor: 'rgba(0,0,0,0.5)', width: '90%', minHeight: '220px', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxShadow: `inset 0 0 20px ${colors.blue}20` },
    splashInfoTitle: { margin: '0 0 15px 0', fontFamily: "'Orbitron', sans-serif", color: colors.yellow, textTransform: 'uppercase', fontSize: '1.2rem' },
    splashMatch: { fontSize: '1.3rem', fontWeight: 'bold' },
    splashAdminMessage: { fontStyle: 'italic', marginTop: '15px', borderTop: `1px solid ${colors.blue}`, paddingTop: '15px', color: colors.silver },
    splashBote: { color: colors.success, fontWeight: 'bold', fontSize: '1.1rem' },
    loginContainer: { textAlign: 'center' },
    userList: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '15px', marginTop: '30px' },
    userButton: { position: 'relative', width: '100%', padding: '15px 10px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', border: `2px solid ${colors.blue}`, borderRadius: '8px', backgroundColor: 'transparent', color: colors.lightText, transition: 'all 0.3s ease', boxShadow: '0 4px 15px rgba(0,0,0,0.4)', fontFamily: "'Exo 2', sans-serif", textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' },
    userButtonHover: { borderColor: colors.yellow, color: colors.yellow, transform: 'translateY(-5px)', boxShadow: `0 0 20px ${colors.yellow}50`, backgroundColor: 'rgba(212, 175, 55, 0.1)' },
    userButtonSelected: { borderColor: colors.yellow, color: colors.yellow, transform: 'translateY(-5px)', boxShadow: `0 0 20px ${colors.yellow}50` },
    userButtonOnline: { borderColor: '#0f0' },
    userButtonRecent: { borderColor: colors.silver },
    recentUserIndicator: { position: 'absolute', top: '5px', right: '10px', color: colors.yellow, fontSize: '1.2rem' },
    loginProfileIconCircle: { width: '40px', height: '40px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.5rem', color: colors.darkText },
    loginUserInfo: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' },
    onlineStatusText: { color: '#0f0', fontSize: '0.8rem', fontWeight: 'bold' },
    lastSeenText: { color: colors.silver, fontSize: '0.75rem', fontStyle: 'italic' },
    navbar: { display: 'flex', flexWrap: 'wrap', gap: '5px', borderBottom: `2px solid ${colors.blue}`, paddingBottom: '15px', marginBottom: '20px', alignItems: 'center', transition: 'border-color 0.5s ease' },
    navButton: { padding: '8px 12px', fontSize: '0.9rem', border: 'none', borderBottom: '3px solid transparent', borderRadius: '6px 6px 0 0', backgroundColor: 'transparent', color: colors.lightText, cursor: 'pointer', transition: 'all 0.3s', textTransform: 'uppercase', fontWeight: '600', position: 'relative' },
    navButtonActive: { padding: '8px 12px', fontSize: '0.9rem', border: 'none', borderBottom: `3px solid ${colors.yellow}`, borderRadius: '6px 6px 0 0', backgroundColor: colors.darkUIAlt, color: colors.yellow, cursor: 'pointer', textTransform: 'uppercase', fontWeight: '600', position: 'relative', boxShadow: `inset 0 -5px 10px -5px ${colors.yellow}` },
    profileNavButton: { marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' },
    logoutButton: { padding: '8px 12px', fontSize: '0.9rem', border: `1px solid ${colors.danger}`, borderRadius: '8px', backgroundColor: 'transparent', color: colors.danger, cursor: 'pointer', marginLeft: '10px', transition: 'all 0.2s', fontWeight: '600', textTransform: 'uppercase' },
    content: { padding: '10px 0' },
    form: { backgroundColor: 'rgba(0,0,0,0.4)', padding: '25px', borderRadius: '12px', marginTop: '20px', border: `1px solid ${colors.blue}50`, boxShadow: `inset 0 0 20px ${colors.blue}10` },
    formSectionTitle: { fontFamily: "'Orbitron', sans-serif", color: colors.yellow, fontSize: '1.3rem', textAlign: 'center', marginBottom: '20px' },
    formGroup: { marginBottom: '25px' },
    label: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginBottom: '10px', color: colors.yellow, fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.9rem', letterSpacing: '1px' },
    pointsReminder: { color: colors.silver, fontWeight: 'normal', fontSize: '0.8rem', textTransform: 'none' },
    input: { width: 'calc(100% - 24px)', padding: '12px', border: `1px solid ${colors.blue}`, borderRadius: '6px', backgroundColor: colors.deepBlue, color: colors.lightText, fontSize: '1rem', transition: 'all 0.3s ease' },
    resultInputContainer: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', justifyContent: 'center' },
    resultInput: { width: '50px', textAlign: 'center', padding: '10px', border: `1px solid ${colors.blue}`, borderRadius: '6px', backgroundColor: colors.deepBlue, color: colors.yellow, fontSize: '1.5rem', fontFamily: "'Orbitron', sans-serif", fontWeight: 'bold'},
    separator: { fontSize: '1.3rem', fontWeight: 'bold', color: colors.yellow },
    checkbox: { width: '20px', height: '20px', accentColor: colors.yellow },
    message: { marginTop: '20px', padding: '12px', borderRadius: '8px', backgroundColor: colors.darkUIAlt, color: colors.lightText, textAlign: 'center', fontWeight: 'bold', border: `1px solid ${colors.blue}` },
    table: { width: '100%', marginTop: '20px', borderCollapse: 'separate', borderSpacing: '0 5px', color: colors.lightText },
    th: { backgroundColor: 'transparent', color: colors.yellow, padding: '12px', borderBottom: `2px solid ${colors.yellow}`, textAlign: 'left', textTransform: 'uppercase', fontFamily: "'Orbitron', sans-serif", fontSize: '0.8rem' },
    tr: { backgroundColor: colors.darkUIAlt, transition: 'background-color 0.3s ease' },
    td: { padding: '12px', border: 'none', borderBottom: `1px solid ${colors.blue}40`, fontSize: '0.9rem' },
    tdRank: { padding: '12px', border: 'none', borderBottom: `1px solid ${colors.blue}40`, fontFamily: "'Orbitron', sans-serif", fontWeight: 'bold', fontSize: '1rem', textAlign: 'center', color: colors.yellow },
    tdTotalPoints: { padding: '12px', border: 'none', borderBottom: `1px solid ${colors.blue}40`, fontFamily: "'Orbitron', sans-serif", fontWeight: 'bold', fontSize: '1.2rem', textAlign: 'center', color: colors.yellow },
    leaderRow: { animation: 'leader-glow 2s infinite alternate' },
    secondPlaceRow: { animation: 'silver-glow 2s infinite alternate' },
    thirdPlaceRow: { animation: 'bronze-glow 2s infinite alternate' },
    currentUserRow: { backgroundColor: 'rgba(212, 175, 55, 0.15)', border: `1px solid ${colors.yellow}` },
    laJornadaContainer: { textAlign: 'center', padding: '20px', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: '12px', backgroundSize: 'cover', backgroundPosition: 'center', border: `1px solid ${colors.blue}50` },
    matchInfo: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'clamp(5px, 2vw, 10px)', fontSize: '1.5rem', fontWeight: 'bold', margin: '20px 0', fontFamily: "'Orbitron', sans-serif", flexWrap: 'nowrap' },
    matchDetails: { display: 'flex', justifyContent: 'center', gap: '20px', color: colors.silver, marginBottom: '20px', flexWrap: 'wrap' },
    matchInfoLogo: { width: 'clamp(50px, 12vw, 60px)', height: 'clamp(50px, 12vw, 60px)' },
    vs: { color: colors.yellow, textShadow: `0 0 10px ${colors.yellow}`, fontSize: 'clamp(1.2rem, 4vw, 1.8rem)' },
    countdownContainer: { margin: '20px 0' },
    countdown: { fontFamily: "'Orbitron', sans-serif", fontSize: 'clamp(1.3rem, 5vw, 1.8rem)', fontWeight: 'bold', color: colors.yellow, backgroundColor: colors.deepBlue, padding: '10px 20px', borderRadius: '8px', display: 'inline-block', border: `1px solid ${colors.blue}`, boxShadow: `0 0 15px ${colors.blue}30` },
    callToAction: { fontSize: '1.2rem', fontStyle: 'italic', color: colors.lightText, marginTop: '20px' },
    apostadoresContainer: { marginTop: '30px', borderTop: `1px solid ${colors.blue}`, paddingTop: '20px' },
    apostadoresGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '8px', marginTop: '10px' },
    apostadorHecho: { padding: '8px', fontSize: '0.9rem', backgroundColor: colors.success, color: colors.darkText, borderRadius: '5px', textAlign: 'center', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' },
    apostadorPendiente: { padding: '8px', fontSize: '0.9rem', backgroundColor: colors.darkUIAlt, color: colors.lightText, borderRadius: '5px', textAlign: 'center', opacity: 0.6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' },
    onlineIndicatorDot: { width: '10px', height: '10px', backgroundColor: '#0f0', borderRadius: '50%', boxShadow: '0 0 5px #0f0, 0 0 10px #0f0' },
    jokerContainer: { marginTop: '30px', padding: '20px', borderTop: `2px solid ${colors.blue}`, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '8px' },
    jokerButton: { padding: '10px 20px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', border: `2px solid ${colors.gold}`, borderRadius: '8px', backgroundColor: 'transparent', color: colors.gold, transition: 'all 0.3s ease', textTransform: 'uppercase' },
    dangerButton: { borderColor: colors.danger, color: colors.danger },
    vipBanner: { background: `linear-gradient(45deg, ${colors.gold}, #fff, ${colors.yellow})`, color: colors.darkText, fontWeight: 'bold', padding: '15px', borderRadius: '8px', textAlign: 'center', marginBottom: '20px', fontSize: '1.1rem', fontFamily: "'Orbitron', sans-serif", boxShadow: `0 0 20px ${colors.gold}70` },
    jackpotBanner: { background: `linear-gradient(45deg, ${colors.success}, #2a9d8f)`, color: colors.lightText, fontWeight: 'bold', padding: '15px', borderRadius: '8px', textAlign: 'center', marginBottom: '20px', fontSize: '1.1rem', fontFamily: "'Orbitron', sans-serif", boxShadow: `0 0 20px ${colors.success}70`, textShadow: '1px 1px 2px #000' },
    jokerGrid: { display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center' },
    jokerBetRow: { marginBottom: '10px', width: '100%', maxWidth: '300px' },
    jornadaList: { display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' },
    jornadaItem: { cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', border: `1px solid ${colors.blue}50`, borderLeft: `5px solid ${colors.blue}`, borderRadius: '8px', backgroundColor: colors.darkUIAlt, transition: 'all 0.3s ease', backgroundSize: 'cover', backgroundPosition: 'center' },
    jornadaVip: { borderLeft: `5px solid ${colors.yellow}`, boxShadow: `0 0 15px ${colors.yellow}30`, borderColor: colors.yellow },
    jornadaInfo: { display: 'flex', flexDirection: 'column', color: colors.lightText, fontSize: '0.9rem', gap: '5px' },
    jornadaTeams: { display: 'flex', alignItems: 'center' },
    statusBadge: { color: 'white', padding: '5px 12px', borderRadius: '15px', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase' },
    adminJornadaItem: { padding: '20px', backgroundColor: 'rgba(0,0,0,0.4)', border: `1px solid ${colors.blue}`, borderRadius: '12px', marginBottom: '20px' },
    testJornadaAdminItem: { border: `2px dashed ${colors.success}` },
    adminControls: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', margin: '15px 0' },
    adminInput: { width: '90%', padding: '10px', border: `1px solid ${colors.blue}`, borderRadius: '6px', backgroundColor: colors.deepBlue, color: colors.lightText, fontSize: '1rem', transition: 'all 0.3s ease' },
    adminSelect: { width: '95%', padding: '10px', border: `1px solid ${colors.blue}`, borderRadius: '6px', backgroundColor: colors.deepBlue, color: colors.yellow, fontWeight: 'bold' },
    saveButton: { padding: '10px 18px', border: 'none', borderRadius: '5px', backgroundColor: colors.success, color: 'white', cursor: 'pointer', textTransform: 'uppercase', fontWeight: 'bold' },
    vipToggleContainer: { display: 'flex', alignItems: 'center', gap: '10px' },
    backButton: { padding: '10px 15px', fontSize: '1rem', border: `1px solid ${colors.blue}`, borderRadius: '8px', backgroundColor: 'transparent', color: colors.lightText, cursor: 'pointer', transition: 'all 0.2s', marginBottom: '20px' },
    finalResult: { fontSize: '2rem', fontWeight: 'bold', color: colors.yellow, textAlign: 'center', margin: '20px 0', fontFamily: "'Orbitron', sans-serif", textShadow: `0 0 15px ${colors.yellow}` },
    winnerBanner: { background: `linear-gradient(45deg, ${colors.gold}, ${colors.yellow})`, color: colors.darkText, fontWeight: 'bold', padding: '15px', borderRadius: '8px', textAlign: 'center', margin: '20px 0', fontSize: '1.2rem', boxShadow: `0 0 20px ${colors.gold}70` },
    boteBanner: { backgroundColor: colors.danger, color: 'white', fontWeight: 'bold', padding: '15px', borderRadius: '8px', textAlign: 'center', margin: '20px 0', fontSize: '1.2rem' },
    winnerRow: { backgroundColor: `${colors.gold}30` },
    jokerDetailRow: { backgroundColor: `${colors.deepBlue}99` },
    jokerDetailChip: { backgroundColor: colors.blue, padding: '5px 10px', borderRadius: '15px', fontSize: '0.9rem', fontFamily: "'Orbitron', sans-serif", },
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(5px)' },
    modalContent: { backgroundColor: colors.darkUI, padding: '30px', borderRadius: '12px', width: '90%', maxWidth: '700px', border: `2px solid ${colors.yellow}`, boxShadow: `0 0 30px ${colors.yellow}40` },
    resumenContainer: { display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' },
    resumenJugador: { backgroundColor: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '12px', borderLeft: `4px solid ${colors.blue}` },
    resumenJugadorTitle: { margin: '0 0 10px 0', paddingBottom: '10px', borderBottom: `1px solid ${colors.blue}50`, fontFamily: "'Orbitron', sans-serif", display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    resumenJugadorBets: { fontSize: '0.95rem' },
    jokerChipsContainer: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' },
    pinReminder: { display: 'block', fontSize: '0.8rem', color: colors.warning, marginTop: '10px', fontStyle: 'italic' },
    statsIndicator: { display: 'block', textAlign: 'center', marginTop: '10px', fontWeight: 'bold' },
    jokerAnimationOverlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', overflow: 'hidden', zIndex: 9999, pointerEvents: 'none', backdropFilter: 'blur(3px) brightness(0.7)', transition: 'backdrop-filter 0.5s ease' },
    jokerIcon: { position: 'absolute', top: '-50px', animationName: 'fall', animationTimingFunction: 'linear', animationIterationCount: '1' },
    
    // --- ESTILOS DE EL CAMINO / BRACKET ---
    bracketContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', margin: '30px 0', padding: '20px', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: '12px', border: `1px solid ${colors.blue}` },
    bracketMatchup: { display: 'flex', justifyContent: 'space-around', width: '100%', gap: '10px', alignItems: 'center', borderBottom: `1px dashed ${colors.blue}50`, paddingBottom: '15px' },
    bracketTeam: { flex: 1, textAlign: 'center', padding: '10px', backgroundColor: colors.darkUIAlt, border: `1px solid ${colors.blue}`, borderRadius: '8px', fontWeight: 'bold' },
    bracketWinner: { backgroundColor: 'rgba(212, 175, 55, 0.2)', borderColor: colors.yellow, color: colors.yellow },
    bracketFinal: { marginTop: '20px', textAlign: 'center', padding: '20px', backgroundColor: 'rgba(212, 175, 55, 0.15)', border: `2px solid ${colors.yellow}`, borderRadius: '12px', width: '80%' },
    
    // --- BOTONES PASA / ASCIENDE ---
    ascensoButtonsContainer: { display: 'flex', gap: '10px', justifyContent: 'center' },
    pasaButtonActive: { flex: 1, padding: '15px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', border: `2px solid ${colors.yellow}`, borderRadius: '8px', backgroundColor: colors.yellow, color: colors.deepBlue, transition: 'all 0.3s ease' },
    pasaButtonInactive: { flex: 1, padding: '15px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', border: `2px solid ${colors.blue}`, borderRadius: '8px', backgroundColor: 'transparent', color: colors.lightText, transition: 'all 0.3s ease' },
    
    teamDisplay: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', flex: '1', minWidth: '0' },
    teamLogo: { width: '40px', height: '40px', objectFit: 'contain' },
    teamNameText: { fontSize: 'clamp(0.8rem, 2.5vw, 0.9rem)', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    winnerAnimationOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000, backdropFilter: 'blur(8px)', animation: 'fadeIn 0.5s ease' },
    winnerModal: { backgroundColor: colors.darkUI, padding: '40px', borderRadius: '20px', textAlign: 'center', border: `2px solid ${colors.gold}`, boxShadow: `0 0 40px ${colors.gold}80` },
    trophy: { fontSize: '100px', animation: 'trophy-grow 1s cubic-bezier(0.25, 1, 0.5, 1) forwards' },
    winnerTitle: { fontFamily: "'Orbitron', sans-serif", color: colors.gold, fontSize: '2.5rem', margin: '10px 0', animation: 'text-fade-in 1s ease 0.5s forwards', opacity: 0 },
    winnerText: { fontSize: '1.2rem', color: colors.lightText, animation: 'text-fade-in 1s ease 0.8s forwards', opacity: 0 },
    winnerStats: { display: 'flex', justifyContent: 'center', gap: '30px', marginTop: '25px', fontSize: '1.3rem', animation: 'text-fade-in 1s ease 1.1s forwards', opacity: 0 },
    confettiOverlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'hidden', pointerEvents: 'none' },
    installButton: { background: 'none', border: 'none', color: colors.silver, textDecoration: 'underline', cursor: 'pointer', marginTop: '15px', fontSize: '0.9rem' },
    installInstructions: { display: 'flex', gap: '20px', textAlign: 'left', marginBottom: '20px' },
    installSection: { flex: 1, '& h4': { color: colors.yellow, borderBottom: `1px solid ${colors.blue}`, paddingBottom: '5px' }, '& ol': { paddingLeft: '20px' }, '& li': { marginBottom: '10px' } },
    escudosGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginTop: '20px', marginBottom: '20px' },
    escudoCard: { backgroundColor: colors.darkUIAlt, padding: '10px', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' },
    escudoCardImg: { width: '80px', height: '80px', objectFit: 'contain' },
    escudoCardName: { fontSize: '0.9rem', color: colors.lightText, textAlign: 'center', margin: 0, fontWeight: 'bold' },
    escudoInput: { width: '90%', padding: '8px', borderRadius: '4px', border: '1px solid #0055A4', backgroundColor: '#001d3d', color: '#f0f0f0', fontSize: '0.8rem' },
    escudoSaveButton: { padding: '5px 10px', fontSize: '0.8rem', backgroundColor: colors.success, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '5px' },
    matchHeader: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', marginBottom: '20px' },
    liveBanner: { position: 'sticky', top: 0, left: 0, width: '100%', background: `linear-gradient(90deg, ${colors.danger}, #8b0000)`, color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: '15px', padding: '10px', zIndex: 100, fontFamily: "'Orbitron', sans-serif", animation: 'blink-live 1.5s infinite', boxShadow: '0 4px 10px rgba(0,0,0,0.5)' },
    liveIndicator: { fontWeight: 'bold', backgroundColor: 'rgba(255,255,255,0.2)', padding: '3px 8px', borderRadius: '5px' },
    liveMatchInfo: { fontSize: '1.2rem' },
    liveGoalScorer: { fontStyle: 'italic', fontSize: '0.9rem' },
    liveAdminContainer: { marginTop: '25px', paddingTop: '20px', borderTop: `2px dashed ${colors.danger}` },
    liveAdminTitle: { color: colors.danger, textAlign: 'center', fontFamily: "'Orbitron', sans-serif" },
    provisionalTitle: { color: colors.yellow, textAlign: 'center', fontFamily: "'Orbitron', sans-serif", marginTop: '30px' },
    provisionalWinnerRow: { background: `linear-gradient(90deg, ${colors.gold}99, ${colors.darkUIAlt} 80%)` },
    liveScoreInPage: { color: colors.yellow, textShadow: `0 0 10px ${colors.yellow}`, fontSize: '2.5rem', fontFamily: "'Orbitron', sans-serif" },
    liveInfoBox: { display: 'flex', justifyContent: 'space-around', backgroundColor: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '12px', marginBottom: '20px', border: `1px solid ${colors.blue}` },
    liveInfoItem: { textAlign: 'center' },
    liveInfoLabel: { display: 'block', fontSize: '0.9rem', color: colors.silver, textTransform: 'uppercase' },
    liveInfoValue: { display: 'block', fontSize: '1.8rem', color: colors.yellow, fontWeight: 'bold', fontFamily: "'Orbitron', sans-serif" },
    miJornadaMatchInfo: { display: 'flex', justifyContent: 'space-around', alignItems: 'center', gap: '10px', marginBottom: '20px' },
    miJornadaTeamLogo: { width: '60px', height: '60px' },
    miJornadaScoreInputs: { display: 'flex', alignItems: 'center', gap: '10px' },
    profileCustomizationContainer: { display: 'flex', flexDirection: 'column', height: '100%' },
    colorGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(50px, 1fr))', gap: '15px', marginTop: '10px' },
    colorOption: { width: '50px', height: '50px', borderRadius: '50%', cursor: 'pointer', transition: 'transform 0.2s ease, box-shadow 0.2s ease', border: '2px solid transparent' },
    colorOptionSelected: { transform: 'scale(1.1)', boxShadow: `0 0 15px #fff`, border: '2px solid white' },
    iconGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(50px, 1fr))', gap: '15px', marginTop: '10px' },
    iconOption: { width: '50px', height: '50px', borderRadius: '10px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '2rem', backgroundColor: 'rgba(0,0,0,0.2)', transition: 'background-color 0.2s ease' },
    iconOptionSelected: { backgroundColor: colors.blue },
    profilePreview: { fontSize: '2rem', fontWeight: 'bold', fontFamily: "'Orbitron', sans-serif", padding: '10px 20px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.3)', display: 'inline-block' },
    
    // --- ESTADÍSTICAS ---
    statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', marginTop: '30px' },
    statCard: { backgroundColor: 'rgba(0,0,0,0.4)', padding: '20px', borderRadius: '12px', textAlign: 'center', border: `1px solid ${colors.blue}50`, display: 'flex', flexDirection: 'column', justifyContent: 'center' },
    statValue: { fontFamily: "'Orbitron', sans-serif", fontSize: 'clamp(1.5rem, 4vw, 2rem)', color: colors.yellow, marginBottom: '10px', textShadow: `0 0 10px ${colors.yellow}50` },
    statLabel: { fontSize: '0.9rem', color: colors.silver, textTransform: 'uppercase' },
    
    legendContainer: { marginTop: '20px', paddingTop: '15px', borderTop: `1px solid ${colors.blue}`, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '20px', fontSize: '0.9rem', color: colors.silver },
    pagoCard: { backgroundColor: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', marginBottom: '20px', border: `1px solid ${colors.blue}80` },
    pagoCardTitle: { fontFamily: "'Orbitron', sans-serif", color: colors.yellow, borderBottom: `1px solid ${colors.blue}`, paddingBottom: '10px', marginBottom: '15px' },
    pagoCardDetails: { display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '15px', marginBottom: '15px' },
    pagoCardWinnerInfo: { textAlign: 'center', padding: '10px', backgroundColor: `${colors.gold}20`, borderRadius: '8px', margin: '10px 0' },
    pagoCardBoteInfo: { textAlign: 'center', padding: '10px', backgroundColor: `${colors.danger}20`, borderRadius: '8px', margin: '10px 0', fontWeight: 'bold' },
    skeletonContainer: { padding: '20px' },
    skeletonBox: { backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px', animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite' },
    skeletonTable: { display: 'flex', flexDirection: 'column', gap: '10px', padding: '20px' },
    skeletonRow: { display: 'flex', justifyContent: 'space-between', gap: '10px' },
    reactionContainer: { borderTop: `1px solid ${colors.blue}`, marginTop: '15px', paddingTop: '10px' },
    reactionEmojis: { display: 'flex', justifyContent: 'center', gap: '5px', flexWrap: 'wrap' },
    reactionButton: { position: 'relative', background: 'rgba(255,255,255,0.1)', border: '1px solid transparent', borderRadius: '50%', width: '40px', height: '40px', fontSize: '1.5rem', cursor: 'pointer', transition: 'all 0.2s ease' },
    reactionButtonSelected: { borderColor: colors.yellow, transform: 'scale(1.15)', boxShadow: `0 0 10px ${colors.yellow}` },
    reactionCounts: { display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' },
    reactionCountChip: { backgroundColor: colors.blue, padding: '3px 8px', borderRadius: '12px', fontSize: '0.8rem' },
    debtSummaryContainer: { marginTop: '40px', padding: '20px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '12px' },
    debtGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' },
    debtItemPaid: { display: 'flex', justifyContent: 'space-between', padding: '8px', borderRadius: '6px', backgroundColor: `${colors.success}20` },
    debtItemOwes: { display: 'flex', justifyContent: 'space-between', padding: '8px', borderRadius: '6px', backgroundColor: `${colors.danger}20`, fontWeight: 'bold' },
    adminNav: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '20px' },
    adminNavButton: { padding: '15px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', border: `2px solid ${colors.blue}`, borderRadius: '8px', backgroundColor: 'transparent', color: colors.lightText, transition: 'all 0.3s ease' },
    presetMessagesContainer: { display: 'flex', flexDirection: 'column', gap: '10px' },
    presetMessageButton: { padding: '12px', textAlign: 'left', backgroundColor: colors.darkUIAlt, color: colors.lightText, border: `1px solid ${colors.blue}`, borderRadius: '6px', cursor: 'pointer' },
    debtBanner: { backgroundColor: colors.warning, color: colors.deepBlue, fontWeight: 'bold', padding: '15px', borderRadius: '8px', textAlign: 'center', marginBottom: '20px', fontSize: '1rem' },
    interJornadaContainer: { display: 'flex', flexDirection: 'column', gap: '20px' },
    interJornadaBox: { backgroundColor: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', border: `1px solid ${colors.blue}80`, textAlign: 'center' },
    interJornadaTitle: { fontFamily: "'Orbitron', sans-serif", color: colors.yellow, marginBottom: '15px' },
    interJornadaTeams: { fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '10px' },
    interJornadaWinner: { color: colors.gold, fontWeight: 'bold', marginTop: '10px' },
    interJornadaBote: { color: colors.success, fontWeight: 'bold', marginTop: '10px' },
    paymentStatus: { fontSize: '1.1rem', fontWeight: 'bold', margin: '20px 0', padding: '15px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.3)', border: `2px solid` },
    paymentStatusPending: { fontSize: '1rem', fontStyle: 'italic', margin: '10px 0', padding: '10px', borderRadius: '8px', backgroundColor: `${colors.warning}20`, color: colors.warning },
    paymentStatusConfirmed: { fontSize: '1rem', fontWeight: 'bold', margin: '10px 0', padding: '10px', borderRadius: '8px', backgroundColor: `${colors.success}20`, color: colors.success },
    plantillaList: { display: 'flex', flexDirection: 'column', gap: '10px' },
    plantillaItem: { display: 'flex', gap: '10px', alignItems: 'center' },
    plantillaInput: { flex: 1, padding: '8px', fontSize: '0.9rem', backgroundColor: colors.deepBlue, color: colors.lightText, border: `1px solid ${colors.blue}`, borderRadius: '4px' },
    plantillaRemoveBtn: { backgroundColor: colors.danger, color: 'white', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', fontWeight: 'bold' },
    plantillaAddBtn: { backgroundColor: colors.success, color: 'white', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', fontWeight: 'bold' },
    goleadorSelectorContainer: { position: 'relative' },
    goleadorPreview: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', backgroundColor: 'rgba(0,0,0,0.2)', padding: '5px', borderRadius: '8px' },
    goleadorPreviewImg: { width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' },
    statsCarouselContainer: { width: '90%', maxWidth: '400px', overflow: 'hidden', marginTop: '20px' },
    statsCarouselTrack: { display: 'flex', transition: 'transform 0.5s ease-in-out', width: '400%' },
    'statsCarouselTrack.stat-card-0': { transform: 'translateX(0%)' },
    'statsCarouselTrack.stat-card-1': { transform: 'translateX(-25%)' },
    'statsCarouselTrack.stat-card-2': { transform: 'translateX(-50%)' },
    'statsCarouselTrack.stat-card-3': { transform: 'translateX(-75%)' },
    statCardWrapper: { width: '25%', padding: '0 5px' },
    splashStatImage: { width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover', margin: '5px auto', border: `2px solid ${colors.yellow}` },
    splashStatDescription: { color: colors.silver, fontSize: '0.9rem' },
    verificationResultsContainer: { marginTop: '20px', padding: '15px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: `1px solid ${colors.blue}` },
    verificationList: { listStyleType: 'none', padding: 0, columns: 2, columnGap: '20px' },
    pieChartContainer: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', marginTop: '15px' },
    pieChartSvg: { width: '120px', height: '120px' },
    pieChartLegend: { display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' },
    pieChartLegendItem: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' },
    pieChartLegendColor: { width: '15px', height: '15px', borderRadius: '50%' },
    liveReactionsPanel: { display: 'flex', justifyContent: 'center', gap: '10px', padding: '15px', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '12px', margin: '20px 0', position: 'relative' },
    reactionCountCorner: { position: 'absolute', top: '10px', right: '10px', display: 'flex', flexDirection: 'column', gap: '5px', background: 'rgba(0,0,0,0.5)', padding: '5px', borderRadius: '8px', fontSize: '0.8rem' },
    statusIndicatorRed: { width: '10px', height: '10px', backgroundColor: colors.danger, borderRadius: '50%', animation: 'status-blink-red 1.5s infinite' },
    statusIndicatorGreen: { width: '10px', height: '10px', backgroundColor: colors.success, borderRadius: '50%', animation: 'status-pulse-green 2s infinite' },
    
    // --- ESTILOS DE H2H ---
    h2hContainer: { backgroundColor: 'rgba(212, 175, 55, 0.1)', border: `1px solid ${colors.yellow}`, borderRadius: '8px', padding: '15px', marginBottom: '25px', textAlign: 'center' },
    h2hTitle: { color: colors.yellow, fontFamily: "'Orbitron', sans-serif", fontSize: '1.1rem', marginBottom: '5px' },
    h2hText: { color: colors.lightText, fontWeight: 'bold', letterSpacing: '1px' },
    
    liveAnalysisContainer: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px', marginTop: '20px' },
    liveAnalysisCard: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '15px', border: `1px solid ${colors.blue}` },
    liveAnalysisTitle: { color: colors.yellow, fontFamily: "'Orbitron', sans-serif", marginBottom: '10px', textAlign: 'center', fontSize: '1.1rem' },
    liveWinnerPanel: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '20px', margin: '20px 0', border: `2px solid ${colors.yellow}`, boxShadow: `0 0 15px ${colors.yellow}50` },
    liveWinnerCurrent: { textAlign: 'center', paddingBottom: '15px', borderBottom: `1px dashed ${colors.blue}`, marginBottom: '15px' },
    liveWinnerLabel: { display: 'block', textTransform: 'uppercase', color: colors.silver, fontSize: '0.9rem', marginBottom: '8px' },
    liveWinnerName: { fontFamily: "'Orbitron', sans-serif", fontSize: '1.5rem', fontWeight: 'bold' },
    liveWinnerSimulations: { display: 'flex', justifyContent: 'space-around', gap: '15px' },
    liveWinnerSimulationItem: { textAlign: 'center', flex: 1 },
    liveAnalysisList: { listStyle: 'none', padding: '0 10px', maxHeight: '150px', overflowY: 'auto' },
    liveAnalysisListItem: { padding: '5px 0', borderBottom: `1px solid ${colors.deepBlue}80` },
    renderedPronosticoContainer: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '15px', margin: '20px 0', border: `1px solid ${colors.blue}` },
    renderedPronosticoTitle: { color: colors.yellow, textAlign: 'center', marginBottom: '10px', fontFamily: "'Orbitron', sans-serif" },
    recalculatorContainer: { padding: '20px', border: `1px dashed ${colors.warning}`, borderRadius: '8px', backgroundColor: 'rgba(252, 163, 23, 0.1)' },
    confirmacionResumen: { backgroundColor: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px', borderLeft: `4px solid ${colors.yellow}`, marginBottom: '20px' },
    historyButton: { backgroundColor: 'transparent', border: `1px solid ${colors.blue}`, color: colors.lightText, padding: '4px 8px', borderRadius: '5px', cursor: 'pointer', fontSize: '0.8rem', marginLeft: '10px' },
    historyContainer: { maxHeight: '400px', overflowY: 'auto', paddingRight: '10px' },
    historyEntry: { backgroundColor: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', marginBottom: '10px', borderLeft: `3px solid ${colors.blue}` },
    historyTimestamp: { fontSize: '0.9rem', color: colors.silver, paddingBottom: '8px', borderBottom: `1px solid ${colors.blue}80`, marginBottom: '8px'},
    historyDetails: { fontSize: '0.95rem' },
    tesoreroTag: { fontSize: '0.75rem', color: colors.darkText, backgroundColor: colors.yellow, padding: '2px 6px', borderRadius: '10px', marginLeft: '8px', fontWeight: 'bold' },
    fameGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginTop: '20px' },
    fameCard: { backgroundColor: colors.darkUIAlt, padding: '20px', borderRadius: '12px', border: `1px solid ${colors.blue}`, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' },
    fameIcon: { fontSize: '3rem', marginBottom: '10px' },
    fameTitle: { fontFamily: "'Orbitron', sans-serif", color: colors.yellow, fontSize: '1.2rem', marginBottom: '10px' },
    fameWinner: { fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '5px' },
    fameValue: { fontSize: '1.1rem', color: colors.silver },
    historialTabla: { width: '100%', marginTop: '15px', borderCollapse: 'collapse' },
    historialTh: { backgroundColor: colors.deepBlue, color: colors.yellow, padding: '10px', borderBottom: `1px solid ${colors.yellow}`, textAlign: 'center', fontSize: '0.8rem' },
    historialTd: { padding: '8px', borderBottom: `1px dashed ${colors.blue}`, fontSize: '0.9rem', textAlign: 'center' },
};

// ============================================================================
// --- LÓGICA DE CÁLCULO Y FORMATO ---
// ============================================================================

const getTesoreroResponsable = (jugador) => {
    for (const tesorero in GRUPOS_PAGOS) {
        if (GRUPOS_PAGOS[tesorero].includes(jugador)) {
            return tesorero;
        }
    }
    return null; 
};

const formatFullDateTime = (firebaseDate) => {
    if (!firebaseDate || typeof firebaseDate.seconds !== 'number') return 'Fecha por confirmar';
    try {
        const date = new Date(firebaseDate.seconds * 1000);
        const options = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false };
        return new Intl.DateTimeFormat('es-ES', options).format(date).replace(',', ' a las');
    } catch (error) {
        return 'Fecha inválida';
    }
};

const formatLastSeen = (firebaseDate) => {
    if (!firebaseDate || typeof firebaseDate.seconds !== 'number') return null;
    try {
        const now = new Date();
        const lastSeenDate = new Date(firebaseDate.seconds * 1000);
        const diffSeconds = Math.floor((now - lastSeenDate) / 1000);
        const diffMinutes = Math.floor(diffSeconds / 60);
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffSeconds < 60) return "hace un momento";
        if (diffMinutes < 60) return `hace ${diffMinutes} min`;
        if (diffHours < 24) return `hace ${diffHours} h`;
        if (diffDays === 1) return `ayer a las ${lastSeenDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
        if (diffDays < 7) return `hace ${diffDays} días`;
        
        return `el ${lastSeenDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}`;
    } catch (error) {
        return null;
    }
};

const calculateProvisionalPoints = (pronostico, liveData, jornada) => {
    if (!pronostico || !liveData || !jornada || jornada.estado !== 'En vivo') return 0;
    let puntosJornada = 0;
    const esVip = jornada.esVip || false;
    const { golesLocal, golesVisitante } = liveData;

    if (pronostico.golesLocal !== '' && pronostico.golesVisitante !== '') {
        const pLocal = parseInt(pronostico.golesLocal);
        const pVisitante = parseInt(pronostico.golesVisitante);
        
        if (golesLocal > pLocal || golesVisitante > pVisitante) {
        } else if (golesLocal === pLocal && golesVisitante === pVisitante) {
            puntosJornada += esVip ? 6 : 3;
        }
    }

    if (jornada.tipoPartido !== 'vuelta_semi' && jornada.tipoPartido !== 'vuelta_final') {
        let resultado1x2Real = '';
        if (jornada.equipoLocal === "UD Las Palmas") {
            if (golesLocal > golesVisitante) resultado1x2Real = 'Gana UD Las Palmas';
            else if (golesLocal < golesVisitante) resultado1x2Real = 'Pierde UD Las Palmas';
            else resultado1x2Real = 'Empate';
        } else {
            if (golesVisitante > golesLocal) resultado1x2Real = 'Gana UD Las Palmas';
            else if (golesVisitante < golesLocal) resultado1x2Real = 'Pierde UD Las Palmas';
            else resultado1x2Real = 'Empate';
        }
        if (pronostico.resultado1x2 === resultado1x2Real) {
            puntosJornada += esVip ? 2 : 1;
        }
    }

    const goleadorReal = (liveData.primerGoleador || '').trim().toLowerCase();
    const goleadorApostado = (pronostico.goleador || '').trim().toLowerCase();
    
    if (liveData.golesLocal > 0 || liveData.golesVisitante > 0 || goleadorReal === "sg") {
        if (pronostico.sinGoleador && goleadorReal === "sg") {
            puntosJornada += 1;
        } else if (!pronostico.sinGoleador && goleadorApostado !== "" && goleadorApostado === goleadorReal && goleadorReal !== "sg") {
            puntosJornada += esVip ? 4 : 2; 
        }
    }
    
    if (pronostico.jokerActivo && pronostico.jokerPronosticos?.length > 0) {
        for (const jokerP of pronostico.jokerPronosticos) {
            if (jokerP.golesLocal !== '' && jokerP.golesVisitante !== '') {
                const jpLocal = parseInt(jokerP.golesLocal);
                const jpVisitante = parseInt(jokerP.golesVisitante);
                if (golesLocal > jpLocal || golesVisitante > jpVisitante) {
                } else if (jpLocal === golesLocal && jpVisitante === golesVisitante) {
                    puntosJornada += esVip ? 6 : 3;
                    break; 
                }
            }
        }
    }
    return puntosJornada;
};


// ============================================================================
// --- COMPONENTES REUTILIZABLES Y DE ANIMACIÓN ---
// ============================================================================

const AnimatedCount = ({ endValue, duration = 1000, decimals = 0 }) => {
    const [currentValue, setCurrentValue] = useState(0);
    const prevValueRef = useRef(0);

    useEffect(() => {
        const startValue = prevValueRef.current;
        let startTime = null;
        const animation = (currentTime) => {
            if (!startTime) startTime = currentTime;
            const progress = Math.min((currentTime - startTime) / duration, 1);
            setCurrentValue(progress * (endValue - startValue) + startValue);
            if (progress < 1) requestAnimationFrame(animation);
            else prevValueRef.current = endValue;
        };
        requestAnimationFrame(animation);
        return () => { prevValueRef.current = endValue; };
    }, [endValue, duration]);

    return <span>{currentValue.toFixed(decimals)}</span>;
};

const AnimatedPoints = ({ value }) => {
    const [displayValue, setDisplayValue] = useState(value);
    const prevValueRef = useRef(value);

    useEffect(() => {
        if (value !== prevValueRef.current) {
            const element = document.getElementById(`animated-points-${value}`);
            if (element) {
                element.style.transform = 'scale(1.3)';
                element.style.transition = 'transform 0.2s ease-out';
                setTimeout(() => { element.style.transform = 'scale(1)'; }, 200);
            }
            setDisplayValue(value);
            prevValueRef.current = value;
        }
    }, [value]);

    return <span id={`animated-points-${value}`}>{displayValue}</span>;
};

const PlayerProfileDisplay = ({ name, profile, defaultColor = styles.colors.lightText, style: customStyle = {} }) => {
    const finalProfile = profile || {};
    const color = finalProfile.color || defaultColor;
    const icon = finalProfile.icon || '';
    const isGradient = typeof color === 'string' && color.startsWith('linear-gradient');
    const nameStyle = { ...(isGradient ? { background: color, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } : { color: color }) };
    
    const badgesToDisplay = useMemo(() => {
        if (!finalProfile.badges || finalProfile.badges.length === 0) return [];
        return finalProfile.badges
            .map(badgeKey => ({ key: badgeKey, ...BADGE_DEFINITIONS[badgeKey] }))
            .filter(b => b.name && b.icon) 
            .sort((a, b) => (a.priority || 99) - (b.priority || 99));
    }, [finalProfile.badges]);
    
    const badgeStyle = useMemo(() => {
        if (!finalProfile.badges || finalProfile.badges.length === 0) return {};
        const highestPriorityBadgeWithStyle = finalProfile.badges
            .map(badgeKey => ({ key: badgeKey, ...BADGE_DEFINITIONS[badgeKey] }))
            .filter(b => b.name && b.style)
            .sort((a, b) => (a.priority || 99) - (b.priority || 99))[0];
        
        if (highestPriorityBadgeWithStyle) {
            const animationName = `${highestPriorityBadgeWithStyle.style}-animation`;
            let animationProps = '2s infinite alternate';
            if(highestPriorityBadgeWithStyle.style === 'pleno-flash') { animationProps = '0.5s ease-in-out 3'; }
            if(highestPriorityBadgeWithStyle.style === 'cold-streak'){ animationProps = '1.5s infinite'; }
            return { animation: `${animationName} ${animationProps}` };
        }
        return {};
    }, [finalProfile.badges]);

    return (
        <span style={{...customStyle, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            {badgesToDisplay.map(badge => (
                <span key={badge.key} title={badge.name} style={badgeStyle}>{badge.icon}</span>
            ))}
            {icon && <span>{icon}</span>}
            <span style={nameStyle}>{name}</span>
        </span>
    );
};

const LiveBanner = ({ liveData, jornada }) => {
    if (!jornada || !liveData || jornada.estado !== 'En vivo') return null;
    return (<div style={styles.liveBanner}><span style={styles.liveIndicator}>🔴 EN VIVO</span><span style={styles.liveMatchInfo}>{jornada.equipoLocal} <strong>{liveData.golesLocal} - {liveData.golesVisitante}</strong> {jornada.equipoVisitante}</span>{liveData.primerGoleador && <span style={styles.liveGoalScorer}>Primer Gol: {liveData.primerGoleador}</span>}</div>);
};

const TeamDisplay = ({ teamLogos, teamName, shortName = false, imgStyle }) => (<div style={styles.teamDisplay}><img src={teamLogos[teamName] || 'https://placehold.co/50x50/1b263b/e0e1dd?text=?'} style={{...styles.teamLogo, ...imgStyle}} alt={`${teamName} logo`} onError={(e) => { e.target.src = 'https://placehold.co/50x50/1b263b/e0e1dd?text=?'; }} /><span style={styles.teamNameText}>{shortName && teamName === "UD Las Palmas" ? "UDLP" : teamName}</span></div>);

const JokerAnimation = () => {
    const [exploded, setExploded] = useState(false);
    useEffect(() => { const timer = setTimeout(() => setExploded(true), 5500); return () => clearTimeout(timer); }, []);
    const jokers = Array.from({ length: 100 });
    return (<div style={styles.jokerAnimationOverlay}>{jokers.map((_, i) => (<span key={i} className={exploded ? 'exploded' : ''} style={{...styles.jokerIcon, left: `${Math.random() * 100}vw`, fontSize: `${1.5 + Math.random() * 2}rem`, animationDelay: `${Math.random() * 4}s`, animationDuration: `${4 + Math.random() * 4}s`, transform: exploded ? `translate(${Math.random() * 800 - 400}px, ${Math.random() * 800 - 400}px) rotate(720deg)` : 'translateY(-100px) rotate(0deg)', opacity: exploded ? 0 : 1 }}>🃏</span>))}</div>);
};

const Confetti = () => {
    const particles = Array.from({ length: 200 });
    return (<div style={styles.confettiOverlay}>{particles.map((_, i) => (<div key={i} className="confetti-particle" style={{ '--x': `${Math.random() * 100}vw`, '--angle': `${Math.random() * 360}deg`, '--delay': `${Math.random() * 5}s`, '--color': i % 3 === 0 ? styles.colors.yellow : (i % 3 === 1 ? styles.colors.blue : styles.colors.lightText), '--size': `${5 + Math.random() * 10}px` }} />))}</div>);
};

const WinnerAnimation = ({ winnerData, onClose }) => {
    const { pronostico, prize } = winnerData;
    return (<div style={styles.winnerAnimationOverlay}><Confetti /><div style={styles.winnerModal}><h2 style={styles.winnerTitle}>¡FELICIDADES, {pronostico.id}!</h2><p style={styles.winnerText}>¡Has ganado la porra de la jornada!</p><div style={styles.winnerStats}><span>Puntos Obtenidos: <strong><AnimatedCount endValue={pronostico.puntosObtenidos} duration={1500} /></strong></span><span>Premio: <strong><AnimatedCount endValue={prize} duration={1500} decimals={2} />€</strong></span></div><button onClick={onClose} style={{...styles.mainButton, marginTop: '30px'}}>CERRAR</button></div></div>);
};

const InstallGuideModal = ({ onClose }) => {
    return (<div style={styles.modalOverlay} onClick={onClose}><div style={styles.modalContent} onClick={(e) => e.stopPropagation()}><h3 style={styles.title}>Instalar App</h3><div style={styles.installInstructions}><div style={styles.installSection}><h4>iPhone (Safari)</h4><ol><li>Pulsa el botón de <strong>Compartir</strong> (un cuadrado con una flecha hacia arriba).</li><li>Busca y pulsa en <strong>"Añadir a pantalla de inicio"</strong>.</li><li>¡Listo! Ya tienes la app en tu móvil.</li></ol></div><div style={styles.installSection}><h4>Android (Chrome)</h4><ol><li>Pulsa el botón de <strong>Menú</strong> (tres puntos verticales).</li><li>Busca y pulsa en <strong>"Instalar aplicación"</strong> o "Añadir a pantalla de inicio".</li><li>¡Listo! Ya tienes la app en tu móvil.</li></ol></div></div><button onClick={onClose} style={styles.mainButton}>Entendido</button></div></div>);
};

const NotificationPermissionModal = ({ onAllow, onDeny }) => {
    return (
        <div style={styles.modalOverlay}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <div style={{textAlign: 'center', marginBottom: '20px'}}><span style={{fontSize: '4rem'}}>🔔</span></div>
                <h3 style={styles.title}>REACTIVAR NOTIFICACIONES</h3>
                <p style={{textAlign: 'center', marginBottom: '20px', lineHeight: 1.5}}>
                    ¡Hemos mejorado nuestro sistema de avisos! Para asegurarte de que sigues recibiendo las notificaciones importantes, necesitamos que vuelvas a aceptar el permiso. ¡Gracias!
                </p>
                <div style={{display: 'flex', justifyContent: 'space-around', gap: '10px'}}>
                    <button onClick={onDeny} style={{...styles.mainButton, backgroundColor: 'transparent', color: styles.colors.lightText, borderColor: styles.colors.lightText}}>Ahora no</button>
                    <button onClick={onAllow} style={styles.mainButton}>Reactivar</button>
                </div>
            </div>
        </div>
    );
};

const LiquidarPagoModal = ({ onClose, onConfirm }) => {
    const [isChecked, setIsChecked] = useState(false);
    return (
        <div style={styles.modalOverlay}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <h3 style={styles.title}>CONFIRMAR PAGO</h3>
                <p style={{textAlign: 'center', marginBottom: '20px', lineHeight: 1.5}}>Estás a punto de marcar tu apuesta como pagada. Esto sirve como un aviso para el administrador.</p>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '30px'}}>
                    <input type="checkbox" id="confirm-pago-check" checked={isChecked} onChange={() => setIsChecked(!isChecked)} style={styles.checkbox} />
                    <label htmlFor="confirm-pago-check" style={{marginLeft: '10px', color: styles.colors.lightText}}>Confirmo que he realizado el pago.</label>
                </div>
                <div style={{display: 'flex', justifyContent: 'space-around', gap: '10px'}}>
                    <button onClick={onClose} style={{...styles.mainButton, backgroundColor: 'transparent', color: styles.colors.lightText, borderColor: styles.colors.lightText}}>Cancelar</button>
                    <button onClick={() => { if(isChecked) onConfirm(); }} style={styles.mainButton} disabled={!isChecked}>Confirmar Pago</button>
                </div>
            </div>
        </div>
    );
};

const LoadingSkeleton = ({ type = 'list' }) => {
    if (type === 'table') { return (<div style={styles.skeletonTable}>{Array.from({ length: 5 }).map((_, i) => (<div key={i} style={styles.skeletonRow}><div style={{...styles.skeletonBox, width: '50px', height: '20px'}}></div><div style={{...styles.skeletonBox, width: '120px', height: '20px'}}></div><div style={{...styles.skeletonBox, width: '80px', height: '20px'}}></div><div style={{...styles.skeletonBox, width: '60px', height: '20px'}}></div></div>))}</div>); }
    if (type === 'splash') { return (<div style={styles.skeletonContainer}><div style={{...styles.skeletonBox, height: '40px', width: '80%', marginBottom: '20px'}}></div><div style={{...styles.skeletonBox, height: '150px', width: '100%'}}></div><div style={{...styles.skeletonBox, height: '60px', width: '90%', marginTop: '10px'}}></div></div>); }
    return (<div style={styles.skeletonContainer}><div style={{...styles.skeletonBox, height: '40px', width: '80%', marginBottom: '20px'}}></div><div style={{...styles.skeletonBox, height: '20px', width: '60%'}}></div><div style={{...styles.skeletonBox, height: '20px', width: '70%', marginTop: '10px'}}></div></div>);
};

const PieChart = ({ data }) => {
    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    let accumulatedRotation = 0;

    return (
        <div style={styles.pieChartContainer}>
            <svg viewBox="0 0 120 120" style={styles.pieChartSvg}>
                <g transform="rotate(-90 60 60)">
                    {data.map((segment, index) => {
                        const percentage = parseFloat(segment.percentage);
                        if (isNaN(percentage) || percentage === 0) return null;
                        const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
                        const rotation = accumulatedRotation;
                        accumulatedRotation += (percentage / 100) * 360;

                        return (
                            <circle key={index} cx="60" cy="60" r={radius} fill="transparent" stroke={segment.color} strokeWidth="20" strokeDasharray={circumference} strokeDashoffset={circumference} style={{ '--stroke-dasharray': strokeDasharray, '--rotation': `${rotation}deg`, animationDelay: `${index * 0.2}s` }} className="pie-chart-segment-new" />
                        );
                    })}
                </g>
            </svg>
            <div style={styles.pieChartLegend}>
                {data.map((segment, index) => (
                    <div key={index} style={styles.pieChartLegendItem}>
                        <span style={{...styles.pieChartLegendColor, backgroundColor: segment.color}}></span>
                        <span>{segment.label} ({segment.percentage}%)</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const LiveAnalysisPanels = ({ jornada, liveData, participantes, userProfiles, clasificacionData }) => {
    const liveWinnerPanelData = useMemo(() => {
        if (!liveData || !jornada || participantes.length === 0) {
            return { currentWinner: "Nadie", simulationLocal: "Nadie", simulationVisitor: "Nadie", impacto: "" };
        }
        const findWinner = (simulatedLiveData) => {
            const ranking = participantes.map(p => ({
                id: p.id,
                puntos: calculateProvisionalPoints(p, simulatedLiveData, jornada),
                isDiscarded: p.golesLocal !== '' && p.golesVisitante !== '' && (simulatedLiveData.golesLocal > parseInt(p.golesLocal) || simulatedLiveData.golesVisitante > parseInt(p.golesVisitante))
            })).filter(p => !p.isDiscarded).sort((a, b) => b.puntos - a.puntos);

            if (ranking.length > 0 && ranking[0].puntos > 0) {
                const topScore = ranking[0].puntos;
                const winners = ranking.filter(p => p.puntos === topScore);
                return { name: winners.length > 1 ? "Empate" : winners[0].id, points: topScore, winnerData: winners.length === 1 ? winners[0] : null };
            }
            return { name: "Nadie", points: 0, winnerData: null };
        };

        const { name: currentWinner, winnerData: currentWinnerData } = findWinner(liveData);
        let impacto = "";
        if (currentWinnerData && clasificacionData.length > 0) {
            const currentPointsInGeneral = clasificacionData.find(j => j.id === currentWinnerData.id)?.puntosTotales || 0;
            const newTotalPoints = currentPointsInGeneral + currentWinnerData.points;
            const currentRank = clasificacionData.findIndex(j => j.id === currentWinnerData.id) + 1;
            const simulatedClasificacion = clasificacionData.map(j => {
                if (j.id === currentWinnerData.id) return { ...j, puntosTotales: newTotalPoints };
                return j;
            }).sort((a, b) => b.puntosTotales - a.puntosTotales);
            const newRank = simulatedClasificacion.findIndex(j => j.id === currentWinnerData.id) + 1;
            if (newRank < currentRank) impacto = `(subiría al ${newRank}º)`;
        }

        const localGoalLiveData = { ...liveData, golesLocal: liveData.golesLocal + 1, primerGoleador: '' };
        const { name: simulationLocal } = findWinner(localGoalLiveData);
        const visitorGoalLiveData = { ...liveData, golesVisitante: liveData.golesVisitante + 1, primerGoleador: '' };
        const { name: simulationVisitor } = findWinner(visitorGoalLiveData);

        return { currentWinner, simulationLocal, simulationVisitor, impacto };
    }, [liveData, jornada, participantes, clasificacionData]);

    const acertantesGoleador = useMemo(() => {
        if (!liveData.primerGoleador || liveData.primerGoleador === 'SG') return [];
        return participantes.filter(p => p.goleador && p.goleador.trim().toLowerCase() === liveData.primerGoleador.trim().toLowerCase());
    }, [liveData.primerGoleador, participantes]);

    const descartados = useMemo(() => {
        return participantes.filter(p => {
            const pLocal = parseInt(p.golesLocal);
            const pVisitante = parseInt(p.golesVisitante);
            if (isNaN(pLocal) || isNaN(pVisitante)) return false;
            return liveData.golesLocal > pLocal || liveData.golesVisitante > pVisitante;
        });
    }, [liveData.golesLocal, liveData.golesVisitante, participantes]);

    return (
        <div style={styles.liveAnalysisContainer}>
            <div style={{...styles.liveAnalysisCard, gridColumn: '1 / -1', border: `2px solid ${colors.yellow}`, boxShadow: `0 0 15px ${colors.yellow}50`}}>
                 <div style={styles.liveWinnerCurrent}>
                    <span style={styles.liveWinnerLabel}>Ganador(es) Provisional(es)</span>
                    <div style={styles.liveWinnerName}>
                        {liveWinnerPanelData.currentWinner ? (
                            <PlayerProfileDisplay name={liveWinnerPanelData.currentWinner} profile={userProfiles[liveWinnerPanelData.currentWinner]} />
                        ) : 'Nadie'}
                        <span style={{fontSize: '1rem', color: colors.silver, marginLeft: '10px'}}>{liveWinnerPanelData.impacto}</span>
                    </div>
                </div>
                <div style={styles.liveWinnerSimulations}>
                    <div style={styles.liveWinnerSimulationItem}><span style={styles.liveWinnerLabel}>Si marca {jornada.equipoLocal}...</span><div style={styles.liveWinnerName}><PlayerProfileDisplay name={liveWinnerPanelData.simulationLocal} profile={userProfiles[liveWinnerPanelData.simulationLocal]} /></div></div>
                    <div style={styles.liveWinnerSimulationItem}><span style={styles.liveWinnerLabel}>Si marca {jornada.equipoVisitante}...</span><div style={styles.liveWinnerName}><PlayerProfileDisplay name={liveWinnerPanelData.simulationVisitor} profile={userProfiles[liveWinnerPanelData.simulationVisitor]} /></div></div>
                </div>
            </div>
            <div style={styles.liveAnalysisCard}><h4 style={styles.liveAnalysisTitle}>🎯 Acierto Primer Goleador</h4>{acertantesGoleador.length > 0 ? (<ul style={styles.liveAnalysisList}>{acertantesGoleador.map(p => (<li key={p.id} style={styles.liveAnalysisListItem}><PlayerProfileDisplay name={p.id} profile={userProfiles[p.id]} /></li>))}</ul>) : <p style={{textAlign: 'center', color: colors.silver}}>Nadie ha acertado el primer goleador.</p>}</div>
            <div style={styles.liveAnalysisCard}><h4 style={styles.liveAnalysisTitle}>❌ Descartados</h4>{descartados.length > 0 ? (<ul style={styles.liveAnalysisList}>{descartados.map(p => (<li key={p.id} style={styles.liveAnalysisListItem}><PlayerProfileDisplay name={p.id} profile={userProfiles[p.id]} /></li>))}</ul>) : <p style={{textAlign: 'center', color: colors.silver}}>Nadie ha sido descartado aún.</p>}</div>
        </div>
    );
};

const InitialSplashScreen = ({ onFinish }) => {
    const [fadingOut, setFadingOut] = useState(false);
    useEffect(() => { const timer = setTimeout(() => { setFadingOut(true); setTimeout(onFinish, 500); }, 2500); return () => clearTimeout(timer); }, [onFinish]);
    return (<div style={fadingOut ? {...styles.initialSplashContainer, ...styles.fadeOut} : styles.initialSplashContainer}><img src="https://upload.wikimedia.org/wikipedia/en/thumb/2/20/UD_Las_Palmas_logo.svg/1200px-UD_Las_Palmas_logo.svg.png" alt="UD Las Palmas Logo" style={styles.splashLogo} /><div style={styles.splashTitleContainer}><span style={styles.splashTitle}>PORRA UDLP</span><span style={styles.splashYear}>2026</span></div><div style={styles.loadingMessage}><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="spinner"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg><p>Cargando apuestas...</p></div></div>);
};

const SplashScreen = ({ onEnter, teamLogos, plantilla, fameStats }) => {
    const [jornadaInfo, setJornadaInfo] = useState(null);
    const [countdown, setCountdown] = useState('');
    const [loading, setLoading] = useState(true);
    const [showInstallGuide, setShowInstallGuide] = useState(false);
    const [jornadaStats, setJornadaStats] = useState(null);
    const [currentStatIndex, setCurrentStatIndex] = useState(0);
    const isMobile = useMemo(() => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent), []);
    
    useEffect(() => {
        setLoading(true);
        const qJornadas = query(collection(db, "jornadas"), orderBy("numeroJornada"));
        const unsubscribe = onSnapshot(qJornadas, (snap) => {
            const todasLasJornadas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            let jornadaActiva = todasLasJornadas.find(j => j.estado === 'En vivo') || todasLasJornadas.find(j => j.estado === 'Abierta' || j.estado === 'Pre-apertura');

            if (jornadaActiva) {
                 setJornadaInfo(jornadaActiva);
                if (jornadaActiva.estado === 'Abierta') {
                    const pronosticosRef = collection(db, "pronosticos", jornadaActiva.id, "jugadores");
                    onSnapshot(pronosticosRef, (pronosticosSnap) => {
                        const pronosticos = pronosticosSnap.docs.map(doc => doc.data());
                        if (pronosticos.length > 0) {
                            const apostadoCount = pronosticos.length;
                            const sinApostar = JUGADORES.length - apostadoCount;
                            const goleadorCounts = pronosticos.reduce((acc, p) => { if(p.goleador) acc[p.goleador] = (acc[p.goleador] || 0) + 1; return acc; }, {});
                            const goleadorMasVotado = Object.keys(goleadorCounts).length > 0 ? Object.entries(goleadorCounts).sort((a,b) => b[1] - a[1])[0][0] : null;
                            const resultadoCounts = pronosticos.reduce((acc, p) => { const res = `${p.golesLocal}-${p.golesVisitante}`; acc[res] = (acc[res] || 0) + 1; return acc; }, {});
                            const resultadoMasVotado = Object.keys(resultadoCounts).length > 0 ? Object.entries(resultadoCounts).sort((a,b) => b[1] - a[1])[0][0] : null;
                            const jokersActivos = pronosticos.filter(p => p.jokerActivo).length;
                            
                            setJornadaStats({ apostadoCount, sinApostar, goleadorMasVotado, goleadorMasVotadoCount: goleadorMasVotado ? goleadorCounts[goleadorMasVotado] : 0, resultadoMasVotado, resultadoMasVotadoCount: resultadoMasVotado ? resultadoCounts[resultadoMasVotado] : 0, jokersActivos });
                        } else { setJornadaStats(null); }
                    });
                } else { setJornadaStats(null); }
            } else {
                setJornadaStats(null);
                let jornadaCerrada = todasLasJornadas.find(j => j.estado === 'Cerrada');
                if (jornadaCerrada) { setJornadaInfo(jornadaCerrada); }
                else {
                    const ultimasFinalizadas = todasLasJornadas.filter(j => j.estado === 'Finalizada').sort((a,b) => b.numeroJornada - a.numeroJornada);
                    if (ultimasFinalizadas.length > 0) { setJornadaInfo(ultimasFinalizadas[0]); }
                    else {
                        const proximas = todasLasJornadas.filter(j => j.estado === 'Próximamente').sort((a,b) => a.numeroJornada - b.numeroJornada);
                        if (proximas.length > 0) setJornadaInfo(proximas[0]); else setJornadaInfo(null);
                    }
                }
            }
            setLoading(false);
        }, (error) => { console.error("Error fetching jornada: ", error); setLoading(false); });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!jornadaInfo) return;
        const targetDate = (jornadaInfo.estado === 'Abierta') ? jornadaInfo.fechaCierre?.toDate() : (jornadaInfo.estado === 'Próximamente' || jornadaInfo.estado === 'Pre-apertura' ? jornadaInfo.fechaApertura?.toDate() : null);
        if (!targetDate) { setCountdown(''); return; }

        const interval = setInterval(() => {
            const diff = targetDate - new Date();
            if (diff <= 0) {
                let message = "¡PARTIDO EN JUEGO!";
                if (jornadaInfo.estado === 'Abierta') message = "¡APUESTAS CERRADAS!";
                if (jornadaInfo.estado === 'Próximamente' || jornadaInfo.estado === 'Pre-apertura') message = "¡APUESTAS ABIERTAS!";
                setCountdown(message); clearInterval(interval); return;
            }
            const d = Math.floor(diff / 86400000); const h = Math.floor((diff % 86400000) / 3600000); const m = Math.floor((diff % 3600000) / 60000); const s = Math.floor((diff % 60000) / 1000);
            setCountdown(`${d}d ${h}h ${m}m ${s}s`);
        }, 1000);
        return () => clearInterval(interval);
    }, [jornadaInfo]);

    const statCards = useMemo(() => {
        if (jornadaInfo?.estado === 'Abierta' && jornadaStats) {
            return [
                <div key="apostado" style={styles.statCard}><div style={styles.statValue}>{jornadaStats.apostadoCount}/{JUGADORES.length}</div><div style={styles.statLabel}>Han apostado</div><div style={styles.splashStatDescription}>{jornadaStats.sinApostar} jugador(es) pendiente(s)</div></div>,
                <div key="goleador" style={styles.statCard}><img src={plantilla.find(j => j.nombre === jornadaStats.goleadorMasVotado)?.imageUrl || 'https://placehold.co/60x60/1b263b/e0e1dd?text=?'} alt={jornadaStats.goleadorMasVotado} style={styles.splashStatImage} onError={(e) => { e.target.src = 'https://placehold.co/60x60/1b263b/e0e1dd?text=?'; }} /><div style={styles.statValue}>{jornadaStats.goleadorMasVotado || '-'}</div><div style={styles.statLabel}>Primer Goleador más elegido</div><div style={styles.splashStatDescription}>{jornadaStats.goleadorMasVotadoCount} voto(s)</div></div>,
                <div key="resultado" style={styles.statCard}><div style={styles.statValue}>{jornadaStats.resultadoMasVotado || '-'}</div><div style={styles.statLabel}>Resultado más común</div><div style={styles.splashStatDescription}>{jornadaStats.resultadoMasVotadoCount} vez/veces</div></div>,
                <div key="joker" style={styles.statCard}><div style={styles.statValue}>🃏 {jornadaStats.jokersActivos}</div><div style={styles.statLabel}>Jokers Activados</div><div style={styles.splashStatDescription}>¡Apuestas extra en juego!</div></div>
            ];
        } 
        if (fameStats) {
            const fameKeys = ['rey_midas', 'pelotazo', 'mr_regularidad', 'profeta'];
            return fameKeys.map(key => {
                const stat = fameStats[key]; const def = FAME_STATS_DEFINITIONS[key];
                if (!stat || !def) return null;
                return (
                    <div key={key} style={styles.statCard}><div style={{...styles.fameIcon, fontSize: '2rem'}}>{def.icon}</div><div style={{...styles.fameTitle, fontSize: '1rem'}}>{def.name}</div><div style={{...styles.fameWinner, fontSize: '1.2rem'}}>{stat.jugador || '-'}</div><div style={styles.splashStatDescription}>{stat.valor || '-'}</div></div>
                );
            }).filter(Boolean);
        }
        return [];
    }, [jornadaInfo, jornadaStats, fameStats, plantilla]);

    useEffect(() => {
        if (statCards.length > 0) { const timer = setInterval(() => { setCurrentStatIndex(prevIndex => (prevIndex + 1) % statCards.length); }, 4000); return () => clearInterval(timer); }
    }, [statCards]);

    const renderJornadaInfo = () => {
        if (!jornadaInfo) return (<div style={styles.splashInfoBox}><h3 style={styles.splashInfoTitle}>TEMPORADA EN PAUSA</h3><p>El administrador aún no ha configurado la próxima jornada.</p></div>);
        const fechaMostrada = jornadaInfo.fechaPartido || jornadaInfo.fechaCierre;
        let infoContent;
        switch (jornadaInfo.estado) {
            case 'Abierta': infoContent = (<><h3 style={styles.splashInfoTitle}>¡APUESTAS ABIERTAS!</h3><p style={styles.splashMatch}>{jornadaInfo.equipoLocal} <span style={{color: styles.colors.yellow}}>vs</span> {jornadaInfo.equipoVisitante}</p><p style={{margin: '10px 0'}}>🗓️ {formatFullDateTime(fechaMostrada)}</p><div style={styles.countdownContainer}><p>CIERRE DE APUESTAS</p><div style={styles.countdown}>{countdown}</div></div></>); break;
            case 'Pre-apertura': infoContent = (<><h3 style={styles.splashInfoTitle}>PRÓXIMA JORNADA</h3><p style={styles.splashMatch}>{jornadaInfo.equipoLocal} <span style={{color: styles.colors.yellow}}>vs</span> {jornadaInfo.equipoVisitante}</p><p style={{margin: '10px 0'}}>🗓️ {formatFullDateTime(fechaMostrada)}</p>{jornadaInfo.bote > 0 && <p style={styles.splashBote}>¡BOTE DE {jornadaInfo.bote}€ EN JUEGO!</p>}{countdown && <div style={styles.countdownContainer}><p>LA APERTURA COMIENZA EN</p><div style={styles.countdown}>{countdown}</div></div>}</>); break;
            case 'En vivo': infoContent = (<><h3 style={{...styles.splashInfoTitle, color: colors.danger}}>¡PARTIDO EN VIVO!</h3><p style={styles.splashMatch}>{jornadaInfo.equipoLocal} <span style={{color: styles.colors.yellow}}>{jornadaInfo.liveData?.golesLocal ?? '0'} - {jornadaInfo.liveData?.golesVisitante ?? '0'}</span> {jornadaInfo.equipoVisitante}</p><p>Sigue los resultados en la sección "La Jornada".</p></>); break;
            case 'Próximamente': infoContent = (<><h3 style={styles.splashInfoTitle}>PRÓXIMA JORNADA</h3><p style={styles.splashMatch}>{jornadaInfo.equipoLocal} <span style={{color: styles.colors.yellow}}>vs</span> {jornadaInfo.equipoVisitante}</p><p style={{margin: '10px 0'}}>🗓️ {formatFullDateTime(fechaMostrada)}</p>{jornadaInfo.bote > 0 && <p style={styles.splashBote}>¡BOTE DE {jornadaInfo.bote}€ EN JUEGO!</p>}{countdown && <div style={styles.countdownContainer}><p>LA APERTURA COMIENZA EN</p><div style={styles.countdown}>{countdown}</div></div>}</>); break;
            case 'Cerrada': infoContent = (<><h3 style={styles.splashInfoTitle}>¡APUESTAS CERRADAS!</h3><p style={styles.splashMatch}>{jornadaInfo.equipoLocal} <span style={{color: styles.colors.yellow}}>vs</span> {jornadaInfo.equipoVisitante}</p><p style={{margin: '10px 0'}}>🗓️ {formatFullDateTime(fechaMostrada)}</p><p>Esperando el comienzo del partido...</p></>); break;
            case 'Finalizada': infoContent = (<><h3 style={styles.splashInfoTitle}>ÚLTIMA JORNADA FINALIZADA</h3><p style={styles.splashMatch}>{jornadaInfo.equipoLocal} <span style={{color: styles.colors.yellow}}>vs</span> {jornadaInfo.equipoVisitante}</p><p style={styles.finalResult}>Resultado: {jornadaInfo.resultadoLocal} - {jornadaInfo.resultadoVisitante}</p></>); break;
            default: infoContent = null;
        }
        return (<div style={styles.splashInfoBox}>{infoContent}{jornadaInfo.splashMessage && <p style={styles.splashAdminMessage}>"{jornadaInfo.splashMessage}"</p>}</div>);
    };

    return (<>
        {showInstallGuide && <InstallGuideModal onClose={() => setShowInstallGuide(false)} />}
        <div style={styles.splashContainer}>
            <div style={styles.splashLogoContainer}><img src="https://upload.wikimedia.org/wikipedia/en/thumb/2/20/UD_Las_Palmas_logo.svg/1200px-UD_Las_Palmas_logo.svg.png" alt="UD Las Palmas Logo" style={styles.splashLogo} /><div style={styles.splashTitleContainer}><span style={styles.splashTitle}>PORRA UDLP</span><span style={styles.splashYear}>2026</span></div></div>
            {loading ? <LoadingSkeleton type="splash" /> : renderJornadaInfo()}
            {statCards.length > 0 && (
                <div style={styles.statsCarouselContainer}>
                    <div style={{...styles.statsCarouselTrack, transform: `translateX(-${currentStatIndex * (100 / statCards.length)}%)`, width: `${statCards.length * 100}%`}}>
                        {statCards.map((card, index) => <div key={index} style={{...styles.statCardWrapper, width: `${100 / statCards.length}%`}}>{card}</div>)}
                    </div>
                </div>
            )}
            <button onClick={onEnter} style={styles.mainButton}>ENTRAR</button>
            {isMobile && (<button onClick={() => setShowInstallGuide(true)} style={styles.installButton}>¿Cómo instalar la App?</button>)}
        </div>
    </>);
};

const LoginScreen = ({ onLogin, userProfiles, onlineUsers }) => {
    const [hoveredUser, setHoveredUser] = useState(null);
    const [recentUsers, setRecentUsers] = useState([]);
    
    useEffect(() => { const storedUsers = localStorage.getItem('recentPorraUsers'); if (storedUsers) setRecentUsers(JSON.parse(storedUsers)); }, []);

    const handleSelectUser = (jugador) => {
        const updatedRecentUsers = [jugador, ...recentUsers.filter(u => u !== jugador)].slice(0, 3);
        setRecentUsers(updatedRecentUsers); localStorage.setItem('recentPorraUsers', JSON.stringify(updatedRecentUsers)); onLogin(jugador);
    };

    const sortedJugadores = useMemo(() => { const remainingJugadores = JUGADORES.filter(j => !recentUsers.includes(j)); return [...recentUsers, ...remainingJugadores]; }, [recentUsers]);

    const getBadgeStyle = (profile) => {
        if (!profile?.badges?.length) return {};
        const highestPriorityBadge = profile.badges.map(key => ({ key, ...BADGE_DEFINITIONS[key] })).filter(b => b.name && b.style).sort((a, b) => (a.priority || 99) - (b.priority || 99))[0];
        if (highestPriorityBadge) {
            let animationProps = '2s infinite alternate';
            if(highestPriorityBadge.style === 'pleno-flash') animationProps = '0.5s ease-in-out 3';
            if(highestPriorityBadge.style === 'cold-streak') animationProps = '1.5s infinite';
            return { animation: `${highestPriorityBadge.style}-animation ${animationProps}` };
        }
        return {};
    };

    return (
        <div style={styles.loginContainer}>
            <h2 style={styles.title}>SELECCIONA TU PERFIL</h2>
            <div style={styles.userList}>
                {sortedJugadores.map(jugador => {
                    const profile = userProfiles[jugador] || {}; const isOnline = onlineUsers[jugador]; const isRecent = recentUsers.includes(jugador); const isGradient = typeof profile.color === 'string' && profile.color.startsWith('linear-gradient'); const lastSeenText = !isOnline ? formatLastSeen(profile.ultimaConexion) : null; const badgeStyle = getBadgeStyle(profile); const buttonStyle = { ...styles.userButton, ...(hoveredUser === jugador && styles.userButtonHover), ...(isOnline && styles.userButtonOnline), ...badgeStyle }; const circleStyle = { ...styles.loginProfileIconCircle, ...(isGradient ? { background: profile.color } : { backgroundColor: profile.color || styles.colors.blue }) };
                    return (
                        <button key={jugador} onClick={() => handleSelectUser(jugador)} style={buttonStyle} onMouseEnter={() => setHoveredUser(jugador)} onMouseLeave={() => setHoveredUser(null)}>
                            {isRecent && <div style={styles.recentUserIndicator}>★</div>}
                            <div style={circleStyle}>{profile.icon || '?'}</div>
                            <div style={styles.loginUserInfo}><span>{jugador}</span>{isOnline && <span style={styles.onlineStatusText}>Online</span>}{lastSeenText && <span style={styles.lastSeenText}>{lastSeenText}</span>}</div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

const initialPronosticoState = { golesLocal: '', golesVisitante: '', resultado1x2: '', goleador: '', sinGoleador: false, pin: '', pinConfirm: '', jokerActivo: false, jokerPronosticos: Array(10).fill({golesLocal: '', golesVisitante: ''}) };

const ProximaJornadaInfo = ({ jornada }) => {
    if (!jornada) return null;
    const fechaMostrada = jornada.fechaPartido || jornada.fechaCierre;
    return (
        <div style={{marginTop: '30px', borderTop: `1px solid ${styles.colors.blue}`, paddingTop: '20px'}}>
            <h4 style={{...styles.formSectionTitle, fontSize: '1.2rem'}}>Próximo Partido: Jornada {jornada.numeroJornada}</h4>
            <p style={{fontSize: '1.2rem', fontWeight: 'bold', textAlign: 'center'}}>{jornada.equipoLocal} vs {jornada.equipoVisitante}</p>
            {jornada.bote > 0 && <div style={{...styles.jackpotBanner, marginTop: '15px'}}>💰 JACKPOT: ¡{jornada.bote}€ DE BOTE! 💰</div>}
            <p style={{textAlign: 'center'}}>🗓️ {formatFullDateTime(fechaMostrada)}</p>
            {jornada.estadio && <p style={{textAlign: 'center'}}>📍 {jornada.estadio}</p>}
        </div>
    );
};

const ConfirmacionPronosticoModal = ({ pronostico, onConfirm, onCancel }) => {
    return (
        <div style={styles.modalOverlay}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <h3 style={styles.title}>CONFIRMAR PRONÓSTICO</h3>
                <p style={{textAlign: 'center', marginBottom: '20px'}}>Por favor, revisa que tu pronóstico es correcto antes de guardarlo:</p>
                <div style={styles.confirmacionResumen}>
                    <p><strong>Resultado:</strong> {pronostico.golesLocal} - {pronostico.golesVisitante}</p>
                    <p><strong>1X2:</strong> {pronostico.resultado1x2 || 'No seleccionado'}</p>
                    <p><strong>Primer Goleador:</strong> {pronostico.sinGoleador ? 'Sin Goleador' : (pronostico.goleador || 'No seleccionado')}</p>
                    {pronostico.jokerActivo && <p><strong>Joker:</strong> <span style={{color: styles.colors.success}}>ACTIVADO</span></p>}
                    {pronostico.pin && <p><strong>PIN:</strong> <span style={{color: styles.colors.success}}>PROTEGIDO</span></p>}
                </div>
                <div style={{display: 'flex', justifyContent: 'space-around', gap: '10px'}}>
                    <button onClick={onCancel} style={{...styles.mainButton, backgroundColor: 'transparent', color: styles.colors.lightText, borderColor: styles.colors.lightText}}>Cancelar</button>
                    <button onClick={onConfirm} style={styles.mainButton}>Guardar Apuesta</button>
                </div>
            </div>
        </div>
    );
};

const HistorialCambiosModal = ({ historial, loading, onClose }) => {
    return (
        <div style={styles.modalOverlay} onClick={onClose}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <h3 style={styles.title}>HISTORIAL DE CAMBIOS</h3>
                <div style={styles.historyContainer}>
                    {loading ? <p>Cargando historial...</p> : (
                        historial.length > 0 ? (
                            historial.map((entrada, index) => (
                                <div key={index} style={styles.historyEntry}>
                                    <p style={styles.historyTimestamp}><strong>Fecha:</strong> {formatFullDateTime(entrada.timestamp)}</p>
                                    <div style={styles.historyDetails}>
                                        <p><strong>Resultado:</strong> {entrada.pronostico.golesLocal}-{entrada.pronostico.golesVisitante}</p>
                                        <p><strong>1X2:</strong> {entrada.pronostico.resultado1x2}</p>
                                        <p><strong>Primer Goleador:</strong> {entrada.pronostico.sinGoleador ? 'SG' : (entrada.pronostico.goleador || 'N/A')}</p>
                                    </div>
                                </div>
                            ))
                        ) : (<p>No hay historial de cambios para este pronóstico.</p>)
                    )}
                </div>
                <button onClick={onClose} style={{...styles.mainButton, marginTop: '20px'}}>Cerrar</button>
            </div>
        </div>
    );
};

const HistorialCompletoModal = ({ user, allJornadas, userProfiles, onClose }) => {
    const [historial, setHistorial] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistorial = async () => {
            setLoading(true);
            const finalizadas = allJornadas.filter(j => j.estado === 'Finalizada').sort((a, b) => b.numeroJornada - a.numeroJornada);
            
            const promises = finalizadas.map(async (jornada) => {
                const pronosticoSnap = await getDoc(doc(db, "pronosticos", jornada.id, "jugadores", user));
                const p = pronosticoSnap.exists() ? pronosticoSnap.data() : null;
                
                if (!p || !p.puntosObtenidos) return null;

                let aciertos = [];
                if (p.puntosResultadoExacto > 0) aciertos.push('Resultado Exacto');
                if (p.puntos1x2 > 0) aciertos.push('1X2');
                if (p.puntosGoleador > 0) aciertos.push('Primer Goleador');
                if (p.jokerActivo && p.jokerPronosticos?.some(jp => parseInt(jp.golesLocal) === jornada.resultadoLocal && parseInt(jp.golesVisitante) === jornada.resultadoVisitante)) aciertos.push('Joker');
                
                return {
                    numeroJornada: jornada.numeroJornada,
                    ganadores: jornada.ganadores || [],
                    bote: jornada.ganadores?.length === 0,
                    resultadoFinal: `${jornada.resultadoLocal}-${jornada.resultadoVisitante}`,
                    miPronostico: `${p.golesLocal}-${p.golesVisitante}`,
                    puntos: p.puntosObtenidos || 0,
                    aciertos: aciertos,
                    participo: true
                };
            });

            const resultados = (await Promise.all(promises)).filter(Boolean).sort((a, b) => b.numeroJornada - a.numeroJornada);
            setHistorial(resultados); setLoading(false);
        };
        fetchHistorial();
    }, [user, allJornadas]);

    return (
        <div style={styles.modalOverlay} onClick={onClose}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <h3 style={styles.title}>HISTORIAL DE PUNTOS</h3>
                <p style={{textAlign: 'center', color: styles.colors.yellow, marginBottom: '20px'}}>
                    <PlayerProfileDisplay name={user} profile={userProfiles[user]} /> - {historial.length} Jornadas Finalizadas
                </p>
                <div style={styles.historyContainer}>
                    {loading ? <p>Cargando historial completo...</p> : (
                        historial.length > 0 ? (
                            <table style={styles.historialTabla}>
                                <thead><tr><th style={styles.historialTh}>Jornada</th><th style={styles.historialTh}>Res. Final</th><th style={styles.historialTh}>Mi Pron.</th><th style={styles.historialTh}>Aciertos</th><th style={styles.historialTh}>Pts</th><th style={styles.historialTh}>Premio</th></tr></thead>
                                <tbody>
                                    {historial.map((h, index) => (
                                        <tr key={index} style={h.bote ? {backgroundColor: 'rgba(230, 57, 70, 0.1)'} : (h.ganadores.includes(user) ? {backgroundColor: 'rgba(255, 215, 0, 0.15)'} : {})}>
                                            <td style={styles.historialTd}>J{h.numeroJornada}</td>
                                            <td style={styles.historialTd}>{h.resultadoFinal}</td>
                                            <td style={styles.historialTd}>{h.miPronostico}</td>
                                            <td style={{...styles.historialTd, textAlign: 'left', fontSize: '0.8rem', opacity: 0.9}}>{h.aciertos.length > 0 ? h.aciertos.join(' | ') : 'Sin Aciertos'}</td>
                                            <td style={{...styles.historialTd, fontWeight: 'bold', color: h.puntos > 0 ? styles.colors.success : styles.colors.lightText}}>{h.puntos}</td>
                                            <td style={{...styles.historialTd, fontWeight: 'bold', color: h.bote ? styles.colors.danger : (h.ganadores.includes(user) ? styles.colors.gold : styles.colors.silver)}}>{h.bote ? 'BOTE' : (h.ganadores.includes(user) ? '🏆' : '-')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (<p>No se encontraron participaciones en jornadas finalizadas.</p>)
                    )}
                </div>
                <button onClick={onClose} style={{...styles.mainButton, marginTop: '30px'}}>CERRAR</button>
            </div>
        </div>
    );
};

const MiJornadaScreen = ({ user, setActiveTab, teamLogos, liveData, plantilla, userProfiles }) => {
    const [currentJornada, setCurrentJornada] = useState(null);
    const [loading, setLoading] = useState(true);
    const [pronostico, setPronostico] = useState(initialPronosticoState);
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const [isLocked, setIsLocked] = useState(true);
    const [pinInput, setPinInput] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState({text: '', type: 'info'});
    const [stats, setStats] = useState({ count: 0, color: styles.colors.success });
    const [jokersRestantes, setJokersRestantes] = useState(2);
    const [panicButtonDisabled, setPanicButtonDisabled] = useState(false);
    const [allPronosticos, setAllPronosticos] = useState([]);
    const [jokerStats, setJokerStats] = useState(Array(10).fill(null));
    const [showJokerAnimation, setShowJokerAnimation] = useState(false);
    const [provisionalData, setProvisionalData] = useState({ puntos: 0, posicion: '-' });
    const [tieneDeuda, setTieneDeuda] = useState(false);
    const [interJornadaStatus, setInterJornadaStatus] = useState(null);
    const [showConfirmacionModal, setShowConfirmacionModal] = useState(false);
    const [pronosticoParaConfirmar, setPronosticoParaConfirmar] = useState(null);
    const [showLiquidarPagoModal, setShowLiquidarPagoModal] = useState(false);
    const initialJokerStatus = useRef(false);
    const userProfile = userProfiles[user] || {};

    useEffect(() => {
        setLoading(true);
        const userJokerRef = doc(db, "clasificacion", user);
        getDoc(userJokerRef).then(docSnap => { setJokersRestantes(docSnap.exists() && docSnap.data().jokersRestantes !== undefined ? docSnap.data().jokersRestantes : 2); });

        const qJornadas = query(collection(db, "jornadas"), orderBy("numeroJornada"));
        const unsubscribe = onSnapshot(qJornadas, (snap) => {
            const todasLasJornadas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            let jornadaActiva = todasLasJornadas.find(j => ['En vivo', 'Abierta', 'Pre-apertura', 'Cerrada'].includes(j.estado));
            
            if (!jornadaActiva) {
                const finalizadas = todasLasJornadas.filter(j => j.estado === 'Finalizada').sort((a, b) => b.numeroJornada - a.numeroJornada);
                if (finalizadas.length > 0) { jornadaActiva = finalizadas[0]; }
            }

            if(jornadaActiva){
                setCurrentJornada(jornadaActiva);
                setInterJornadaStatus(null); 
                if (jornadaActiva.fechaCierre) { setPanicButtonDisabled(new Date().getTime() > (jornadaActiva.fechaCierre.toDate().getTime() - 3600 * 1000)); }
                const pronosticoRef = doc(db, "pronosticos", jornadaActiva.id, "jugadores", user);
                getDoc(pronosticoRef).then(pronosticoSnap => {
                    if (pronosticoSnap.exists()) {
                        const data = pronosticoSnap.data();
                        const filledJokerPronosticos = data.jokerPronosticos ? [...data.jokerPronosticos, ...Array(10 - data.jokerPronosticos.length).fill({golesLocal: '', golesVisitante: ''})] : Array(10).fill({golesLocal: '', golesVisitante: ''});
                        setPronostico({...initialPronosticoState, ...data, jokerPronosticos: filledJokerPronosticos});
                        setIsLocked(!!data.pin); setHasSubmitted(true);
                        initialJokerStatus.current = data.jokerActivo || false;
                    } else {
                        setPronostico(initialPronosticoState); setIsLocked(false); setHasSubmitted(false);
                        initialJokerStatus.current = false;
                    } setLoading(false);
                });
                const allPronosticosRef = collection(db, "pronosticos", jornadaActiva.id, "jugadores");
                onSnapshot(allPronosticosRef, (snapshot) => { setAllPronosticos(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))); });

                if (jornadaActiva.numeroJornada > 1) {
                    const jornadaAnterior = todasLasJornadas.find(j => j.numeroJornada === jornadaActiva.numeroJornada - 1);
                    if (jornadaAnterior?.estado === 'Finalizada') {
                        getDoc(doc(db, "pronosticos", jornadaAnterior.id, "jugadores", user)).then(pronosticoAnteriorSnap => {
                            setTieneDeuda(pronosticoAnteriorSnap.exists() && !pronosticoAnteriorSnap.data().pagado);
                        });
                    } else { setTieneDeuda(false); }
                } else { setTieneDeuda(false); }
            } else {
                setCurrentJornada(null); setLoading(false);
                const ultimaFinalizada = todasLasJornadas.filter(j => j.estado === 'Finalizada' && j.id !== 'jornada_test').sort((a, b) => b.numeroJornada - a.numeroJornada)[0];
                if (ultimaFinalizada) {
                    getDoc(doc(db, "pronosticos", ultimaFinalizada.id, "jugadores", user)).then(pronosticoSnap => {
                        if (pronosticoSnap.exists()) { setInterJornadaStatus({ status: pronosticoSnap.data().pagado ? 'pagado' : 'debe', jornada: ultimaFinalizada }); } 
                        else { setInterJornadaStatus({ status: 'no_participo', jornada: ultimaFinalizada }); }
                    });
                } else {
                    const proximaJornada = todasLasJornadas.find(j => j.estado === 'Próximamente');
                    setInterJornadaStatus({ status: 'sin_finalizadas', proxima: proximaJornada });
                }
            }
        }, (error) => { console.error("Error: ", error); setLoading(false); });
        return () => unsubscribe();
    }, [user]);

    useEffect(() => {
        if (currentJornada?.estado === 'En vivo' && liveData && allPronosticos.length > 0) {
            const ranking = allPronosticos.map(p => ({ id: p.id, puntos: calculateProvisionalPoints(p, liveData, currentJornada) })).sort((a, b) => b.puntos - a.puntos);
            const miRanking = ranking.find(r => r.id === user);
            const miPosicion = ranking.findIndex(r => r.id === user) + 1;
            setProvisionalData({ puntos: miRanking?.puntos || 0, posicion: miRanking ? `${miPosicion}º` : '-' });
        } else { setProvisionalData({ puntos: 0, posicion: '-' }); }
    }, [liveData, currentJornada, allPronosticos, user]);

    useEffect(() => {
        if (currentJornada?.estado === 'Abierta' && pronostico.golesLocal !== '' && pronostico.golesVisitante !== '') {
            const count = allPronosticos.filter(p => p.id !== user && p.golesLocal === pronostico.golesLocal && p.golesVisitante === pronostico.golesVisitante).length;
            let color = styles.colors.success; if (count >= 1 && count <= 2) color = styles.colors.warning; if (count >= 3) color = styles.colors.danger; setStats({ count, color });
        } else { setStats({ count: 0, color: styles.colors.success }); }
    }, [pronostico.golesLocal, pronostico.golesVisitante, allPronosticos, user, currentJornada]);

    useEffect(() => {
        if (!pronostico.jokerActivo || allPronosticos.length === 0) { setJokerStats(Array(10).fill(null)); return; }
        const allOtherBets = allPronosticos.filter(p => p.id !== user).flatMap(p => [`${p.golesLocal}-${p.golesVisitante}`, ...(p.jokerPronosticos || []).map(jp => `${jp.golesLocal}-${jp.golesVisitante}`)]);
        const newJokerStats = pronostico.jokerPronosticos.map(jokerBet => {
            if (jokerBet.golesLocal === '' || jokerBet.golesVisitante === '') return null;
            const betString = `${jokerBet.golesLocal}-${jokerBet.golesVisitante}`;
            const count = allOtherBets.filter(b => b === betString).length;
            let color = styles.colors.success; if (count >= 1 && count <= 2) color = styles.colors.warning; if (count >= 3) color = styles.colors.danger;
            return { count, color, text: count > 0 ? `Repetido ${count} vez/veces` : '¡Pronóstico Único!' };
        });
        setJokerStats(newJokerStats);
    }, [pronostico.jokerPronosticos, allPronosticos, user, pronostico.jokerActivo]);
    
    const handlePronosticoChange = (e) => { const { name, value, type, checked } = e.target; setPronostico(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value, ...(name === 'sinGoleador' && checked && { goleador: '' }) })); };
    const handleJokerPronosticoChange = (index, field, value) => { const newJokerPronosticos = [...pronostico.jokerPronosticos]; newJokerPronosticos[index] = { ...newJokerPronosticos[index], [field]: value }; setPronostico(prev => ({ ...prev, jokerPronosticos: newJokerPronosticos })); };
    
    const handleValidationAndConfirm = (e) => {
        e.preventDefault();
        if (!currentJornada) return;
        if (pronostico.golesLocal === '' || pronostico.golesVisitante === '' || pronostico.resultado1x2 === '' || (!pronostico.goleador && !pronostico.sinGoleador)) {
             setMessage({text: 'Debes rellenar todos los campos.', type: 'error'}); return;
        }
        if (pronostico.pin && pronostico.pin !== pronostico.pinConfirm) { setMessage({text: 'Los PIN no coinciden. Por favor, revísalos.', type: 'error'}); return; }
        const cleanJokerPronosticos = pronostico.jokerPronosticos.filter(p => p.golesLocal !== '' || p.golesVisitante !== '');
        if (pronostico.jokerActivo && cleanJokerPronosticos.length === 0) { setMessage({text: 'Has activado el Joker. Debes rellenar al menos una apuesta.', type: 'error'}); return; }
        
        setPronosticoParaConfirmar(pronostico);
        setShowConfirmacionModal(true);
    };

    const handleGuardarPronostico = async () => {
        setShowConfirmacionModal(false); setIsSaving(true); setMessage({text: '', type: 'info'});
        
        const pronosticoRef = doc(db, "pronosticos", currentJornada.id, "jugadores", user);
        const historialRef = collection(pronosticoRef, "historial");
        const userJokerRef = doc(db, "clasificacion", user);
        
        const jokerJustActivated = pronostico.jokerActivo && !initialJokerStatus.current;
        const cleanJokerPronosticos = pronostico.jokerPronosticos.filter(p => p.golesLocal !== '' || p.golesVisitante !== '');
        
        try {
            const batch = writeBatch(db);
            const { pinConfirm, ...pronosticoToSave } = pronostico;
            
            const pronosticoWithDefaults = { puntosResultadoExacto: 0, puntos1x2: 0, puntosGoleador: 0, puntosObtenidos: 0, ...pronosticoToSave, jokerPronosticos: cleanJokerPronosticos, lastUpdated: serverTimestamp() };
            batch.set(pronosticoRef, pronosticoWithDefaults);
            
            const historialData = { pronostico: { golesLocal: pronostico.golesLocal, golesVisitante: pronostico.golesVisitante, resultado1x2: pronostico.resultado1x2, goleador: pronostico.goleador, sinGoleador: pronostico.sinGoleador, }, timestamp: serverTimestamp() };
            await addDoc(historialRef, historialData);

            if (jokerJustActivated) { batch.update(userJokerRef, { jokersRestantes: increment(-1) }); }
            
            await batch.commit();
            
            if (jokerJustActivated) { setJokersRestantes(prev => prev - 1); initialJokerStatus.current = true; }
            
            setMessage({text: '¡Pronóstico guardado y secreto!', type: 'success'}); setHasSubmitted(true); setIsLocked(!!pronostico.pin);
            
        } catch (error) { 
            console.error("Error al guardar: ", error); setMessage({text: 'Error al guardar el pronóstico.', type: 'error'}); 
        }
        setIsSaving(false);
    };

    const handleUnlock = () => { if (pinInput === pronostico.pin) { setIsLocked(false); setHasSubmitted(false); setMessage({text: 'Pronóstico desbloqueado.', type: 'info'}); } else { alert('PIN incorrecto'); } };
    
    const handleActivarJoker = () => {
        if (jokersRestantes <= 0) { alert("No te quedan Jokers esta temporada."); return; }
        if (window.confirm("¿Seguro que quieres usar un JOKER? Se descontará al guardar.")) {
            setShowJokerAnimation(true); setTimeout(() => setShowJokerAnimation(false), 7000); setHasSubmitted(false); setIsLocked(false);
            setPronostico(prev => ({ ...prev, jokerActivo: true, jokerPronosticos: Array(10).fill({golesLocal: '', golesVisitante: ''}) }));
            setMessage({ text: '¡Joker activado! Rellena tus 10 apuestas extra.', type: 'success' });
        }
    };

    const handleBotonDelPanico = async () => { if (window.confirm("¿Seguro que quieres cancelar tus apuestas JOKER? No recuperarás el JOKER gastado.")) { setPronostico(prev => ({ ...prev, jokerPronosticos: Array(10).fill({golesLocal: '', golesVisitante: ''}) })); setMessage({text: 'Apuestas JOKER eliminadas. Recuerda guardar.', type: 'info'}); } };
    
    const handleMarcarComoPagado = async () => {
        if (!currentJornada) return;
        setShowLiquidarPagoModal(false);
        try {
            await updateDoc(doc(db, "pronosticos", currentJornada.id, "jugadores", user), { pagoConfirmadoPorUsuario: true });
            setPronostico(prev => ({...prev, pagoConfirmadoPorUsuario: true}));
            setMessage({text: '¡Confirmación de pago enviada al admin!', type: 'success'});
        } catch (error) { console.error("Error al confirmar pago: ", error); setMessage({text: 'Error al enviar la confirmación.', type: 'error'}); }
    };

    const handleCopyLastBet = async () => {
        setMessage({text: 'Buscando tu última apuesta...', type: 'info'});
        const qLastJornada = query(collection(db, "jornadas"), where("estado", "==", "Finalizada"), orderBy("numeroJornada", "desc"), limit(1));
        const lastJornadaSnap = await getDocs(qLastJornada);
        if (lastJornadaSnap.empty) { setMessage({text: 'No se encontraron jornadas anteriores para copiar.', type: 'error'}); return; }
        const lastJornadaId = lastJornadaSnap.docs[0].id;
        const lastPronosticoSnap = await getDoc(doc(db, "pronosticos", lastJornadaId, "jugadores", user));
        if (lastPronosticoSnap.exists()) {
            const lastData = lastPronosticoSnap.data();
            setPronostico(prev => ({ ...prev, ...lastData, pin: '', pinConfirm: '', jokerActivo: false, jokerPronosticos: initialPronosticoState.jokerPronosticos }));
            setMessage({text: 'Última apuesta cargada. ¡No olvides guardarla!', type: 'success'});
        } else { setMessage({text: 'No participaste en la última jornada.', type: 'error'}); }
    };

    if (loading) return <LoadingSkeleton />;
    
    const RenderedPronostico = ({ pronosticoData }) => {
        if (!pronosticoData) { return <p>No participaste en esta jornada.</p>; }
        return (
            <div style={styles.renderedPronosticoContainer}>
                <h4 style={styles.renderedPronosticoTitle} className="app-title">Tu Apuesta Realizada</h4>
                <div style={styles.resumenJugadorBets}>
                    <p><strong>Resultado:</strong> {pronosticoData.golesLocal}-{pronosticoData.golesVisitante}</p>
                    <p><strong>1X2:</strong> {pronosticoData.resultado1x2}</p>
                    <p><strong>Primer Goleador:</strong> {pronosticoData.sinGoleador ? 'Sin Goleador' : (pronosticoData.goleador || 'N/A')}</p>
                    {pronosticoData.jokerActivo && (
                        <div style={{marginTop: '10px'}}>
                            <strong>Apuestas Joker:</strong>
                            <div style={styles.jokerChipsContainer}>
                                {(pronosticoData.jokerPronosticos || []).map((jp, index) => (
                                    <span key={index} style={styles.jokerDetailChip}>{jp.golesLocal}-{jp.golesVisitante}</span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderContent = () => {
        const ahora = new Date();
        const apertura = currentJornada?.fechaApertura?.toDate();
        const isBettingOpen = currentJornada && currentJornada.estado === 'Abierta';
        
        if (isBettingOpen) {
            const isVip = currentJornada.esVip;
            const isIda = currentJornada.tipoPartido === 'ida' || !currentJornada.tipoPartido; 
            const isVueltaSemi = currentJornada.tipoPartido === 'vuelta_semi'; 
            const isVueltaFinal = currentJornada.tipoPartido === 'vuelta_final'; 
            const rival = currentJornada.equipoLocal === "UD Las Palmas" ? currentJornada.equipoVisitante : currentJornada.equipoLocal; 
            const h2hData = HISTORICO_LIGA[rival];

            return (
                <form onSubmit={handleValidationAndConfirm} style={styles.form}>
                    <div style={{textAlign: 'center', marginBottom: '20px', backgroundColor: 'rgba(212, 175, 55, 0.1)', padding: '10px', borderRadius: '8px', border: `1px solid ${colors.gold}`}}>
                        <h2 style={{color: colors.gold, fontFamily: "'Orbitron', sans-serif", margin: 0, letterSpacing: '2px'}}>🏆 PLAYOFF DE ASCENSO 🏆</h2>
                    </div>
                    {currentJornada.bote > 0 && <div style={styles.jackpotBanner}>💰 JACKPOT: ¡{currentJornada.bote}€ DE BOTE! 💰</div>}
                    {isVip && (<div style={styles.vipBanner}>⭐ JORNADA VIP ⭐ (Apuesta: 2€ - Puntos Dobles)</div>)}
                    <h3 style={styles.formSectionTitle} className="app-title">{currentJornada.id === 'jornada_test' ? 'Jornada de Prueba' : `Jornada ${currentJornada.numeroJornada}`}: {currentJornada.equipoLocal} vs {currentJornada.equipoVisitante}</h3>
                    
                    {h2hData && (
                        <div style={styles.h2hContainer}>
                            <h4 style={styles.h2hTitle}>⚔️ Historial Fase Regular ⚔️</h4>
                            <p style={styles.h2hText}>{h2hData}</p>
                        </div>
                    )}

                    {!hasSubmitted && <button type="button" onClick={handleCopyLastBet} style={styles.secondaryButton}>Copiar mi última apuesta</button>}

                    {hasSubmitted && isLocked ? (
                        <div style={styles.placeholder}><h3>¡Pronóstico guardado y secreto!</h3><p>Tu apuesta está protegida con PIN.</p><div style={{marginTop: '20px'}}><input type="password" maxLength="4" value={pinInput} onChange={(e) => setPinInput(e.target.value)} style={styles.input} placeholder="PIN de 4 dígitos" /><button type="button" onClick={handleUnlock} style={styles.mainButton}>Desbloquear</button></div></div>
                    ) : hasSubmitted && !isLocked ? (
                         <div style={styles.placeholder}><h3>¡Pronóstico guardado!</h3><p>Tu apuesta no está protegida con PIN. Puedes añadir un PIN y volver a guardar.</p><button type="button" onClick={() => { setIsLocked(false); setHasSubmitted(false); }} style={styles.mainButton}>Modificar Apuesta</button></div>
                    ) : (
                        <fieldset style={{border: 'none', padding: 0, margin: 0}}>
                            <fieldset style={{border: 'none', padding: 0, margin: 0}} >
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>RESULTADO EXACTO <span style={styles.pointsReminder}>( {isVip ? '6' : '3'} Puntos )</span></label>
                                    <div style={styles.miJornadaMatchInfo}>
                                        <TeamDisplay teamLogos={teamLogos} teamName={currentJornada.equipoLocal} shortName={true} imgStyle={styles.miJornadaTeamLogo} />
                                        <div style={styles.miJornadaScoreInputs}><input type="tel" inputMode="numeric" pattern="[0-9]*" name="golesLocal" value={pronostico.golesLocal} onChange={handlePronosticoChange} style={styles.resultInput} /><span style={styles.separator}>-</span><input type="tel" inputMode="numeric" pattern="[0-9]*" name="golesVisitante" value={pronostico.golesVisitante} onChange={handlePronosticoChange} style={styles.resultInput} /></div>
                                        <TeamDisplay teamLogos={teamLogos} teamName={currentJornada.equipoVisitante} shortName={true} imgStyle={styles.miJornadaTeamLogo} />
                                    </div>
                                    <p style={{color: colors.warning, fontSize: '0.85rem', textAlign: 'center', marginTop: '10px'}}>⚠️ El resultado numérico incluye los 90 min + Prórroga (Excluye Penaltis)</p>
                                    {(pronostico.golesLocal !== '' && pronostico.golesVisitante !== '') && <small key={stats.count} className="stats-indicator" style={{...styles.statsIndicator, color: stats.color}}>{stats.count > 0 ? `Otros ${stats.count} jugador(es) han pronosticado este resultado.` : '¡Eres el único con este resultado por ahora!'}</small>}
                                </div>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>{isIda ? "RESULTADO 1X2" : "DESENLACE ELIMINATORIA"} <span style={styles.pointsReminder}>( {isVip ? '2' : '1'} Puntos )</span></label>
                                    {isIda && (
                                        <select name="resultado1x2" value={pronostico.resultado1x2} onChange={handlePronosticoChange} style={styles.input}>
                                            <option value="">-- Elige --</option>
                                            <option value="Gana UD Las Palmas">Gana UDLP</option>
                                            <option value="Empate">Empate</option>
                                            <option value="Pierde UD Las Palmas">Pierde UDLP</option>
                                        </select>
                                    )}
                                    {isVueltaSemi && (
                                        <div style={{display: 'flex', gap: '10px'}}>
                                            <button type="button" onClick={() => handlePronosticoChange({target: {name: 'resultado1x2', value: 'Pasa UD Las Palmas'}})} style={pronostico.resultado1x2 === 'Pasa UD Las Palmas' ? styles.pasaButtonActive : styles.pasaButtonInactive}>PASA UDLP</button>
                                            <button type="button" onClick={() => handlePronosticoChange({target: {name: 'resultado1x2', value: 'No Pasa UD Las Palmas'}})} style={pronostico.resultado1x2 === 'No Pasa UD Las Palmas' ? styles.pasaButtonActive : styles.pasaButtonInactive}>NO PASA</button>
                                        </div>
                                    )}
                                    {isVueltaFinal && (
                                        <div style={{display: 'flex', gap: '10px'}}>
                                            <button type="button" onClick={() => handlePronosticoChange({target: {name: 'resultado1x2', value: 'Asciende UD Las Palmas'}})} style={pronostico.resultado1x2 === 'Asciende UD Las Palmas' ? styles.pasaButtonActive : styles.pasaButtonInactive}>ASCIENDE UDLP</button>
                                            <button type="button" onClick={() => handlePronosticoChange({target: {name: 'resultado1x2', value: 'No Asciende UD Las Palmas'}})} style={pronostico.resultado1x2 === 'No Asciende UD Las Palmas' ? styles.pasaButtonActive : styles.pasaButtonInactive}>NO ASCIENDE</button>
                                        </div>
                                    )}
                                </div>
                                
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>PRIMER GOLEADOR UDLP <span style={styles.pointsReminder}>( {isVip ? '4' : '2'} Puntos )</span></label>
                                    <div style={styles.goleadorSelectorContainer}>
                                        {pronostico.goleador && !pronostico.sinGoleador && (<div style={styles.goleadorPreview}><img src={plantilla.find(j => j.nombre === pronostico.goleador)?.imageUrl || 'https://placehold.co/60x60/1b263b/e0e1dd?text=?'} alt={pronostico.goleador} style={styles.goleadorPreviewImg} onError={(e) => { e.target.src = 'https://placehold.co/60x60/1b263b/e0e1dd?text=?'; }}/><span>{pronostico.goleador}</span></div>)}
                                        <select name="goleador" value={pronostico.goleador} onChange={handlePronosticoChange} style={styles.input} disabled={pronostico.sinGoleador}>
                                            <option value="">-- Elige un jugador --</option>
                                            {plantilla.sort((a, b) => a.nombre.localeCompare(b.nombre)).map(jugador => (<option key={jugador.nombre} value={jugador.nombre}>{jugador.dorsal ? `${jugador.dorsal} - ${jugador.nombre}` : jugador.nombre}</option>))}
                                        </select>
                                    </div>
                                    <div style={{marginTop: '10px'}}><input type="checkbox" name="sinGoleador" id="sinGoleador" checked={pronostico.sinGoleador} onChange={handlePronosticoChange} style={styles.checkbox} /><label htmlFor="sinGoleador" style={{marginLeft: '8px', color: styles.colors.lightText}}>Sin Goleador (SG) <span style={styles.pointsReminder}>(1 Punto)</span></label></div>
                                </div>
                            </fieldset>
                            
                            <div style={styles.jokerContainer}>
                                {!pronostico.jokerActivo ? (<><button type="button" onClick={handleActivarJoker} style={styles.jokerButton} disabled={jokersRestantes <= 0}>🃏 Activar JOKER</button><span style={{marginLeft: '15px', color: styles.colors.lightText}}>Te quedan: <span style={{color: styles.colors.yellow, fontWeight: 'bold'}}>{jokersRestantes}</span></span></>) : (
                                    <div>
                                        <h3 style={styles.formSectionTitle} className="app-title">Apuestas JOKER (10 Resultados Extra)</h3>
                                        <p style={{textAlign: 'center', marginBottom: '15px'}}>Añade hasta 10 resultados exactos adicionales.</p>
                                        <div style={styles.jokerGrid}>
                                            {pronostico.jokerPronosticos.map((p, index) => (
                                                <div key={index} style={styles.jokerBetRow}>
                                                    <label style={{...styles.label, justifyContent: 'center', fontSize: '0.8rem'}}>Apuesta Joker {index + 1}</label>
                                                    <div style={styles.resultInputContainer}><input type="tel" inputMode="numeric" pattern="[0-9]*" value={p.golesLocal} onChange={(e) => handleJokerPronosticoChange(index, 'golesLocal', e.target.value)} style={{...styles.resultInput, fontSize: '1.2rem'}} placeholder="L" /><span style={styles.separator}>-</span><input type="tel" inputMode="numeric" pattern="[0-9]*" value={p.golesVisitante} onChange={(e) => handleJokerPronosticoChange(index, 'golesVisitante', e.target.value)} style={{...styles.resultInput, fontSize: '1.2rem'}} placeholder="V"/></div>
                                                    {jokerStats[index] && (<small style={{...styles.statsIndicator, color: jokerStats[index].color, fontSize: '0.8rem', textAlign: 'center', display: 'block', marginTop: '5px'}}>{jokerStats[index].text}</small>)}
                                                </div>
                                            ))}
                                        </div>
                                        <button type="button" onClick={handleBotonDelPanico} style={{...styles.jokerButton, ...styles.dangerButton, marginTop: '20px'}} disabled={panicButtonDisabled}>BOTÓN DEL PÁNICO</button>
                                        {panicButtonDisabled && <small style={{display: 'block', color: styles.colors.danger, marginTop: '5px'}}>El botón del pánico se ha desactivado (menos de 1h para el cierre).</small>}
                                    </div>
                                )}
                            </div>
                             <div style={{...styles.formGroup, marginTop: '30px', borderTop: `1px solid ${styles.colors.blue}`, paddingTop: '20px'}}>
                                <label style={styles.label}>PIN DE SEGURIDAD (4 dígitos, opcional)</label>
                                <input type="password" name="pin" value={pronostico.pin} onChange={handlePronosticoChange} maxLength="4" style={styles.input} placeholder="Crea un PIN para proteger tu apuesta" />
                                <input type="password" name="pinConfirm" value={pronostico.pinConfirm} onChange={handlePronosticoChange} maxLength="4" style={{...styles.input, marginTop: '10px'}} placeholder="Confirma tu PIN" />
                            </div>
                            <button type="submit" disabled={isSaving} style={styles.mainButton}>{isSaving ? 'GUARDANDO...' : 'GUARDAR Y BLOQUEAR'}</button>
                        </fieldset>
                    )}
                    {message.text && <p style={{...styles.message, backgroundColor: message.type === 'success' ? styles.colors.success : colors.danger}}>{message.text}</p>}
                </form>
            );
        }

        if (currentJornada?.estado === 'Pre-apertura') {
            const tiempoRestante = apertura ? apertura - ahora : 0;
            return (
                <div style={styles.placeholder}>
                    <h3 style={{...styles.formSectionTitle, color: colors.warning}}>JORNADA EN PRE-APERTURA</h3>
                    <p style={{margin: '10px 0'}}>Las apuestas para este partido aún no están abiertas.</p>
                    <div style={styles.countdownContainer}>
                        <p>APERTURA DE APUESTAS EN:</p>
                        <div style={styles.countdown}>
                            {tiempoRestante > 0 ? (
                                `${Math.floor(tiempoRestante / 86400000)}d ${Math.floor((tiempoRestante % 86400000) / 3600000)}h ${Math.floor((tiempoRestante % 3600000) / 60000)}m`
                            ) : (
                                "¡Abriendo!"
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        if (currentJornada?.estado === 'Cerrada' || currentJornada?.estado === 'Finalizada' || currentJornada?.estado === 'En vivo') {
            const showLiquidarButton = !pronostico.pagado && !pronostico.pagoConfirmadoPorUsuario;
            return (
                <div style={styles.placeholder}>
                    <h3>Jornada {currentJornada.numeroJornada} {currentJornada.estado}</h3>
                    <p>
                        {currentJornada.estado === 'Cerrada' && 'Las apuestas para este partido han finalizado.'}
                        {currentJornada.estado === 'En vivo' && '¡El partido está en juego!'}
                        {currentJornada.estado === 'Finalizada' && 'Esta jornada ha concluido.'}
                    </p>
                    
                    <RenderedPronostico pronosticoData={pronostico} />
                    
                    <div style={{marginTop: '20px'}}>
                        {showLiquidarButton && (
                            <button onClick={() => setShowLiquidarPagoModal(true)} style={styles.mainButton}>
                                Liquidar Pagos
                            </button>
                        )}
                        {pronostico.pagoConfirmadoPorUsuario && !pronostico.pagado && (
                            <p style={styles.paymentStatusPending}>Pendiente de validación por el admin</p>
                        )}
                        {pronostico.pagado && (
                            <p style={styles.paymentStatusConfirmed}>PAGO REGISTRADO ✓</p>
                        )}
                        <button onClick={() => setActiveTab('laJornada')} style={{...styles.mainButton, marginLeft: '10px', backgroundColor: styles.colors.blue}}>
                            Ver Resumen
                        </button>
                    </div>
                    {message.text && <p style={{...styles.message, marginTop: '15px'}}>{message.text}</p>}
                </div>
            );
        }

        if (interJornadaStatus?.status === 'pagado') return <div style={styles.placeholder}><h3>Estado de Pagos</h3><p style={{...styles.paymentStatus, color: styles.colors.success, borderColor: styles.colors.success}}>✅ Estás al día con tus pagos. ¡Gracias!</p><ProximaJornadaInfo jornada={interJornadaStatus.proxima} /></div>;
        if (interJornadaStatus?.status === 'debe') return <div style={styles.placeholder}><h3>Estado de Pagos</h3><p style={{...styles.paymentStatus, color: styles.colors.warning, borderColor: styles.colors.warning}}>⚠️ Tienes pendiente el pago de la Jornada {interJornadaStatus.jornada.numeroJornada}.</p><button onClick={() => setActiveTab('pagos')} style={{...styles.mainButton, backgroundColor: styles.colors.blue}}>Ir a Pagos</button><ProximaJornadaInfo jornada={interJornadaStatus.proxima} /></div>;
        if (interJornadaStatus?.status === 'no_participo') return <div style={styles.placeholder}><h3>No hay jornadas disponibles</h3><p>No participaste en la última jornada. ¡Esperamos verte en la siguiente!</p><ProximaJornadaInfo jornada={interJornadaStatus.proxima} /></div>;
        if (interJornadaStatus?.status === 'sin_finalizadas') return <div style={styles.placeholder}><h3>¡Comienza la temporada!</h3><p>Aún no ha finalizado ninguna jornada.</p><ProximaJornadaInfo jornada={interJornadaStatus.proxima} /></div>;
        return <div style={styles.placeholder}><h3>No hay jornadas disponibles.</h3><p>El administrador añadirá nuevas jornadas próximamente.</p></div>;
    };
    return (
      <div>
        {showJokerAnimation && <JokerAnimation />}
        {showLiquidarPagoModal && <LiquidarPagoModal onClose={() => setShowLiquidarPagoModal(false)} onConfirm={handleMarcarComoPagado} />}
        {showConfirmacionModal && <ConfirmacionPronosticoModal pronostico={pronosticoParaConfirmar} onConfirm={handleGuardarPronostico} onCancel={() => setShowConfirmacionModal(false)} />}
        {tieneDeuda && !interJornadaStatus && (<div style={styles.debtBanner}>⚠️ Tienes pendiente el pago de la jornada anterior. Por favor, ve a la sección de "Pagos" para regularizarlo.</div>)}
        <h2 style={styles.title} className="app-title">MI JORNADA</h2>
        <p style={{color: styles.colors.lightText, textAlign: 'center', fontSize: '1.1rem'}}>Bienvenido, <PlayerProfileDisplay name={user} profile={userProfile} defaultColor={styles.colors.yellow} style={{fontWeight: 'bold'}} /></p>
        
        {liveData && currentJornada?.estado === 'En vivo' && (<div style={styles.liveInfoBox}><div style={styles.liveInfoItem}><span style={styles.liveInfoLabel}>Puntos Provisionales</span><span style={styles.liveInfoValue}><AnimatedPoints value={provisionalData.puntos} /></span></div><div style={styles.liveInfoItem}><span style={styles.liveInfoLabel}>Posición Provisional</span><span style={styles.liveInfoValue}>{provisionalData.posicion}</span></div></div>)}
        {renderContent()}
      </div>
    );
};

const LaJornadaScreen = ({ user, teamLogos, liveData, userProfiles, onlineUsers, clasificacionData }) => {
    const [jornadaActual, setJornadaActual] = useState(null);
    const [participantes, setParticipantes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [countdown, setCountdown] = useState('');
    const [provisionalRanking, setProvisionalRanking] = useState([]);
    const [jornadaStats, setJornadaStats] = useState(null);
    const [ultimaJornada, setUltimaJornada] = useState(null);
    const [proximaJornada, setProximaJornada] = useState(null);
    const [reactions, setReactions] = useState({}); 
    const [userReactions, setUserReactions] = useState({}); 
    const [animatingReaction, setAnimatingReaction] = useState(null); 
    const [isSubmittingReaction, setIsSubmittingReaction] = useState({});
    const [showHistorialModal, setShowHistorialModal] = useState(false);
    const [historialSeleccionado, setHistorialSeleccionado] = useState([]);
    const [loadingHistorial, setLoadingHistorial] = useState(false);

    useEffect(() => {
        const q = query(collection(db, "jornadas"), where("estado", "in", ["Abierta", "Cerrada", "Finalizada", "Pre-apertura", "En vivo"]), orderBy("numeroJornada", "desc"), limit(1));
        const unsubscribeJornada = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const jornada = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
                setJornadaActual(jornada);
                setUltimaJornada(null); 
                setProximaJornada(null);
                const pronosticosRef = collection(db, "pronosticos", jornada.id, "jugadores");
                onSnapshot(pronosticosRef, (pronosticosSnap) => {
                    const pronosticosData = pronosticosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    setParticipantes(pronosticosData);
                    if (pronosticosData.length > 0 && jornada.estado !== 'Finalizada') {
                        const total = pronosticosData.length;
                        const ganaLocalCount = pronosticosData.filter(p => p.resultado1x2 === 'Gana UD Las Palmas').length;
                        const empateCount = pronosticosData.filter(p => p.resultado1x2 === 'Empate').length;
                        const pierdeLocalCount = pronosticosData.filter(p => p.resultado1x2 === 'Pierde UD Las Palmas').length;
                        setJornadaStats({
                            porcentajeGana: ((ganaLocalCount / total) * 100).toFixed(0),
                            porcentajeEmpate: ((empateCount / total) * 100).toFixed(0),
                            porcentajePierde: ((pierdeLocalCount / total) * 100).toFixed(0),
                        });
                    } else { setJornadaStats(null); }
                });
            } else {
                setJornadaActual(null); setParticipantes([]);
                const qUltima = query(collection(db, "jornadas"), where("estado", "==", "Finalizada"), orderBy("numeroJornada", "desc"), limit(1));
                getDocs(qUltima).then(snap => { if (!snap.empty) { setUltimaJornada({ id: snap.docs[0].id, ...snap.docs[0].data() }); } });
                const qProxima = query(collection(db, "jornadas"), where("estado", "==", "Próximamente"), orderBy("numeroJornada", "asc"), limit(1));
                getDocs(qProxima).then(snap => { if (!snap.empty) { setProximaJornada({ id: snap.docs[0].id, ...snap.docs[0].data() }); } });
            }
            setLoading(false);
        });
        return () => unsubscribeJornada();
    }, []);
    
    useEffect(() => {
        if (jornadaActual) {
            setUserReactions({}); setReactions({});
            const reactionsRef = doc(db, "reactions", jornadaActual.id);
            const unsubscribeReactions = onSnapshot(reactionsRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data(); setReactions(data.stats || {});
                    if (data.users && data.users[user]) { setUserReactions(data.users[user]); } else { setUserReactions({}); }
                } else { setReactions({}); setUserReactions({}); }
            });
            return () => unsubscribeReactions();
        }
    }, [jornadaActual, user]);

    useEffect(() => {
        if (jornadaActual?.estado === 'En vivo' && liveData && participantes.length > 0) {
            const ranking = participantes.map(p => {
                const puntos = calculateProvisionalPoints(p, liveData, jornadaActual);
                const aciertoExactoProvisional = p.golesLocal !== '' && p.golesVisitante !== '' && parseInt(p.golesLocal) === liveData.golesLocal && parseInt(p.golesVisitante) === liveData.golesVisitante;
                const isDiscarded = p.golesLocal !== '' && p.golesVisitante !== '' && (liveData.golesLocal > parseInt(p.golesLocal) || liveData.golesVisitante > parseInt(p.golesVisitante));
                return { id: p.id, puntos, aciertoExactoProvisional, isDiscarded };
            }).filter(p => !p.isDiscarded).sort((a, b) => {
                if (a.puntos !== b.puntos) { return b.puntos - a.puntos; }
                return (b.aciertoExactoProvisional ? 1 : 0) - (a.aciertoExactoProvisional ? 1 : 0);
            });
            setProvisionalRanking(ranking);
        } else { setProvisionalRanking([]); }
    }, [liveData, jornadaActual, participantes]);

    useEffect(() => {
        if (!jornadaActual || !jornadaActual.fechaCierre) { setCountdown(''); return; }
        const targetDate = jornadaActual.estado === 'Pre-apertura' ? jornadaActual.fechaApertura?.toDate() : jornadaActual.fechaCierre.toDate();
        if (!targetDate) return;

        const interval = setInterval(() => {
            const diff = targetDate - new Date();
            if (diff <= 0) {
                let message = "¡PLAZO FINALIZADO!";
                if (jornadaActual.estado === 'Pre-apertura') message = "¡APUESTAS ABIERTAS!";
                setCountdown(message); clearInterval(interval); return;
            }
            const d = Math.floor(diff / 86400000); const h = Math.floor((diff % 86400000) / 3600000); const m = Math.floor((diff % 3600000) / 60000); const s = Math.floor((diff % 60000) / 1000);
            setCountdown(`${d}d ${h}h ${m}m ${s}s`);
        }, 1000);
        return () => clearInterval(interval);
    }, [jornadaActual]);

    const handleVerHistorial = async (jugadorId) => {
        if (!jornadaActual) return;
        setLoadingHistorial(true); setShowHistorialModal(true);
        const historialRef = collection(db, "pronosticos", jornadaActual.id, "jugadores", jugadorId, "historial");
        const q = query(historialRef, orderBy("timestamp", "desc"));
        const historialSnap = await getDocs(q);
        setHistorialSeleccionado(historialSnap.docs.map(d => d.data()));
        setLoadingHistorial(false);
    };

    const handleReaction = async (cardId, emoji) => {
        if (!jornadaActual || !user || isSubmittingReaction[cardId]) return;
        setIsSubmittingReaction(prev => ({ ...prev, [cardId]: true }));
        setAnimatingReaction({ cardId, emoji });
        setTimeout(() => setAnimatingReaction(null), 1500);
        const reactionRef = doc(db, "reactions", jornadaActual.id);
        try {
            await runTransaction(db, async (transaction) => {
                const reactionDoc = await transaction.get(reactionRef);
                const currentData = reactionDoc.exists() ? reactionDoc.data() : { users: {}, stats: {} };
                const userPreviousReaction = currentData.users?.[user]?.[cardId];
                const isSameEmoji = userPreviousReaction === emoji;
                const newUserReactionsForCard = isSameEmoji ? null : emoji;
                const cardStats = { ...(currentData.stats?.[cardId] || {}) };
                if (userPreviousReaction && !isSameEmoji) { cardStats[userPreviousReaction] = Math.max(0, (cardStats[userPreviousReaction] || 1) - 1); }
                if (isSameEmoji) { cardStats[emoji] = Math.max(0, (cardStats[emoji] || 1) - 1); } else { cardStats[emoji] = (cardStats[emoji] || 0) + 1; }
                const newUsersData = { ...currentData.users, [user]: { ...currentData.users?.[user], [cardId]: newUserReactionsForCard } };
                const newStatsData = { ...currentData.stats, [cardId]: cardStats };
                transaction.set(reactionRef, { users: newUsersData, stats: newStatsData }, { merge: true });
            });
        } catch (error) { console.error("Error al registrar la reacción:", error); } finally { setIsSubmittingReaction(prev => ({ ...prev, [cardId]: false })); }
    };

    if (loading) return <LoadingSkeleton />;
    const isLiveView = jornadaActual?.estado === 'En vivo' && liveData;

    const renderContent = () => {
        if (jornadaActual) {
            const fechaMostrada = jornadaActual.fechaPartido || jornadaActual.fechaCierre;
            const finalScore = jornadaActual.estado === 'Finalizada' ? `${jornadaActual.resultadoLocal} - ${jornadaActual.resultadoVisitante}` : (isLiveView ? `${liveData.golesLocal} - ${liveData.golesVisitante}` : 'VS');

            return (
                <div style={{...styles.laJornadaContainer, backgroundImage: `linear-gradient(rgba(10, 25, 47, 0.85), rgba(10, 25, 47, 0.85)), url(${jornadaActual.estadioImageUrl})`}}>
                    <h3 className="app-title">{jornadaActual.id === 'jornada_test' ? 'Jornada de Prueba' : `Jornada ${jornadaActual.numeroJornada}`}</h3>
                    <div style={styles.matchInfo}>
                        <TeamDisplay teamLogos={teamLogos} teamName={jornadaActual.equipoLocal} shortName={true} imgStyle={styles.matchInfoLogo} />
                        <span style={styles.liveScoreInPage}>{finalScore}</span>
                        <TeamDisplay teamLogos={teamLogos} teamName={jornadaActual.equipoVisitante} imgStyle={styles.matchInfoLogo} />
                    </div>
                    <div style={styles.matchDetails}><span>📍 {jornadaActual.estadio || 'Estadio por confirmar'}</span><span>🗓️ {formatFullDateTime(fechaMostrada)}</span></div>
                    
                    {isLiveView && (
                        <>
                            <LiveAnalysisPanels jornada={jornadaActual} liveData={liveData} participantes={participantes} userProfiles={userProfiles} clasificacionData={clasificacionData} />
                            <div style={styles.liveReactionsPanel}>
                                 <div style={styles.reactionEmojis}>
                                    {GOAL_REACTION_EMOJIS.map(emoji => (
                                        <button key={emoji} onClick={() => handleReaction('liveEvents', emoji)} disabled={isSubmittingReaction['liveEvents']} className={animatingReaction?.cardId === 'liveEvents' && animatingReaction.emoji !== emoji ? 'fade-out' : ''} style={{...styles.reactionButton, ...(userReactions['liveEvents'] === emoji ? styles.reactionButtonSelected : {})}}>
                                            {animatingReaction?.cardId === 'liveEvents' && animatingReaction.emoji === emoji ? <span className="fly-away">{emoji}</span> : emoji}
                                        </button>
                                    ))}
                                </div>
                                <div style={styles.reactionCountCorner}>{GOAL_REACTION_EMOJIS.map(emoji => reactions?.liveEvents?.[emoji] > 0 && <span key={emoji}>{emoji} {reactions.liveEvents[emoji]}</span>)}</div>
                            </div>
                        </>
                    )}

                    {jornadaStats && !isLiveView && jornadaActual.estado !== 'Finalizada' && (
                        <div style={styles.statsGrid}>
                            <div style={{...styles.statCard, position: 'relative', overflow: 'hidden'}}>
                                <div style={styles.statValue}>{participantes.length >= 5 ? `📊 ${Object.entries(participantes.reduce((acc, p) => { const res = `${p.golesLocal}-${p.golesVisitante}`; acc[res] = (acc[res] || 0) + 1; return acc; }, {})).sort((a,b) => b[1] - a[1])[0][0]}` : '🤫'}</div>
                                <div style={styles.statLabel}>{participantes.length >= 5 ? 'Resultado más apostado' : 'Secreto hasta 5 apuestas'}</div>
                                <div style={styles.reactionContainer}><div style={styles.reactionEmojis}>{STAT_REACTION_EMOJIS.map(emoji => (<button key={emoji} onClick={() => handleReaction('resultadoComun', emoji)} disabled={isSubmittingReaction['resultadoComun']} className={animatingReaction?.cardId === 'resultadoComun' && animatingReaction.emoji !== emoji ? 'fade-out' : ''} style={{...styles.reactionButton, ...(userReactions['resultadoComun'] === emoji ? styles.reactionButtonSelected : {})}}>{animatingReaction?.cardId === 'resultadoComun' && animatingReaction.emoji === emoji ? <span className="fly-away">{emoji}</span> : emoji}</button>))}</div></div>
                                <div style={styles.reactionCountCorner}>{STAT_REACTION_EMOJIS.map(emoji => reactions?.resultadoComun?.[emoji] > 0 && <span key={emoji}>{emoji} {reactions.resultadoComun[emoji]}</span>)}</div>
                            </div>
                            <div style={{...styles.statCard, position: 'relative', overflow: 'hidden'}}>
                                <PieChart data={[{label: 'Victoria', percentage: jornadaStats.porcentajeGana, color: styles.colors.success}, {label: 'Empate', percentage: jornadaStats.porcentajeEmpate, color: styles.colors.warning}, {label: 'Derrota', percentage: jornadaStats.porcentajePierde, color: styles.colors.danger}]} />
                                <div style={styles.statLabel}>La Fe de la Afición</div>
                                <div style={styles.reactionContainer}><div style={styles.reactionEmojis}>{STAT_REACTION_EMOJIS.map(emoji => (<button key={emoji} onClick={() => handleReaction('feAficion', emoji)} disabled={isSubmittingReaction['feAficion']} className={animatingReaction?.cardId === 'feAficion' && animatingReaction.emoji !== emoji ? 'fade-out' : ''} style={{...styles.reactionButton, ...(userReactions['feAficion'] === emoji ? styles.reactionButtonSelected : {})}}>{animatingReaction?.cardId === 'feAficion' && animatingReaction.emoji === emoji ? <span className="fly-away">{emoji}</span> : emoji}</button>))}</div></div>
                                <div style={styles.reactionCountCorner}>{STAT_REACTION_EMOJIS.map(emoji => reactions?.feAficion?.[emoji] > 0 && <span key={emoji}>{emoji} {reactions.feAficion[emoji]}</span>)}</div>
                            </div>
                        </div>
                    )}

                    {(jornadaActual.estado === 'Abierta' || jornadaActual.estado === 'Pre-apertura') && (<><div style={styles.countdownContainer}><p>{jornadaActual.estado === 'Abierta' ? 'CIERRE DE APUESTAS EN:' : 'APERTURA DE APUESTAS EN:'}</p><div style={styles.countdown}>{countdown}</div></div><h3 style={styles.callToAction}>¡Hagan sus porras!</h3><div style={styles.apostadoresContainer}><h4>APUESTAS REALIZADAS ({participantes.length}/{JUGADORES.length})</h4><div style={styles.apostadoresGrid}>{JUGADORES.map(jugador => {const participante = participantes.find(p => p.id === jugador); const haApostado = !!participante; const usoJoker = haApostado && participante.jokerActivo; const profile = userProfiles[jugador] || {}; const isOnline = onlineUsers[jugador]; return (<span key={jugador} style={haApostado ? styles.apostadorHecho : styles.apostadorPendiente}>{isOnline && <div style={styles.onlineIndicatorDot} />}<PlayerProfileDisplay name={jugador} profile={profile} /> {usoJoker ? '🃏' : (haApostado ? '✓' : '')}</span>);})}</div></div></>)}
                    
                    {jornadaActual.estado === 'Cerrada' && !isLiveView && (<div><p style={{textAlign: 'center', marginTop: '20px'}}>Las apuestas están cerradas. ¡Estos son los pronósticos!</p><div style={styles.resumenContainer}>{participantes.sort((a, b) => a.id.localeCompare(b.id)).map(p => { const profile = userProfiles[p.id] || {}; return (<div key={p.id} style={styles.resumenJugador}><h4 style={styles.resumenJugadorTitle}><PlayerProfileDisplay name={p.id} profile={profile} defaultColor={styles.colors.yellow} /> <div>{p.jokerActivo && '🃏'} <button onClick={() => handleVerHistorial(p.id)} style={styles.historyButton}>Ver Historial</button></div></h4><div style={styles.resumenJugadorBets}><p><strong>Principal:</strong> {p.golesLocal}-{p.golesVisitante} &nbsp;|&nbsp; <strong>1X2:</strong> {p.resultado1x2} &nbsp;|&nbsp; <strong>Primer Goleador:</strong> {p.sinGoleador ? 'Sin Goleador' : (p.goleador || 'N/A')}</p>{p.jokerActivo && p.jokerPronosticos?.length > 0 && (<div style={{marginTop: '10px'}}><strong>Apuestas Joker:</strong><div style={styles.jokerChipsContainer}>{p.jokerPronosticos.map((jp, index) => (<span key={index} style={styles.jokerDetailChip}>{jp.golesLocal}-{jp.golesVisitante}</span>))}</div></div>)}</div></div>)})}</div></div>)}
                    
                    {isLiveView && (<div><h3 style={styles.provisionalTitle}>Clasificación Provisional</h3><table style={{...styles.table, backgroundColor: 'rgba(0,0,0,0.3)'}}><thead><tr><th style={styles.th}>POS</th><th style={styles.th}>Jugador</th><th style={styles.th}>Puntos</th></tr></thead><tbody>{provisionalRanking.map((jugador, index) => { const profile = userProfiles[jugador.id] || {}; return (<tr key={jugador.id} style={jugador.puntos > 0 && provisionalRanking[0].puntos === jugador.puntos ? styles.provisionalWinnerRow : styles.tr}><td style={styles.tdRank}>{index + 1}º</td><td style={styles.td}><PlayerProfileDisplay name={jugador.id} profile={profile} /> {jugador.aciertoExactoProvisional && '🎯'}</td><td style={styles.td}><AnimatedPoints value={jugador.puntos} /></td></tr>)})}</tbody></table></div>)}
                    
                    {jornadaActual.estado === 'Finalizada' && (
                        <div>
                            <h3 style={styles.provisionalTitle}>Resumen de la Jornada</h3>
                            <p style={{textAlign: 'center', marginBottom: '20px'}}>Así quedaron las apuestas y los puntos repartidos.</p>
                            <div style={styles.resumenContainer}>
                                {participantes.sort((a,b) => (b.puntosObtenidos || 0) - (a.puntosObtenidos || 0)).map(p => {
                                    const profile = userProfiles[p.id] || {};
                                    return (
                                        <div key={p.id} style={styles.resumenJugador}>
                                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                                <h4 style={{...styles.resumenJugadorTitle, borderBottom: 'none', paddingBottom: 0, marginBottom: 0}}>
                                                    <PlayerProfileDisplay name={p.id} profile={profile} defaultColor={styles.colors.yellow} /> 
                                                    <div>{p.jokerActivo && '🃏'} <button onClick={() => handleVerHistorial(p.id)} style={styles.historyButton}>Ver Historial</button></div>
                                                </h4>
                                                <span style={{fontFamily: "'Orbitron', sans-serif", fontSize: '1.5rem', color: styles.colors.gold, fontWeight: 'bold'}}>
                                                    {p.puntosObtenidos || 0} pts
                                                </span>
                                            </div>
                                            <div style={{...styles.resumenJugadorBets, marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${styles.colors.blue}50`}}>
                                                <p><strong>Pronóstico:</strong> {p.golesLocal}-{p.golesVisitante} ({p.resultado1x2}) | {p.sinGoleador ? 'SG' : (p.goleador || 'N/A')}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        return (
            <div style={styles.interJornadaContainer}>
                {ultimaJornada ? (<div style={styles.interJornadaBox}><h3 style={styles.interJornadaTitle}>Última Jornada Finalizada</h3><p style={styles.interJornadaTeams}>{ultimaJornada.equipoLocal} vs {ultimaJornada.equipoVisitante}</p><p style={styles.finalResult}>{ultimaJornada.resultadoLocal} - {ultimaJornada.resultadoVisitante}</p>{ultimaJornada.ganadores?.length > 0 ? (<p style={styles.interJornadaWinner}>🏆 Ganador(es): {ultimaJornada.ganadores.join(', ')}</p>) : (<p style={styles.interJornadaBote}>💰 ¡BOTE!</p>)}</div>) : <div style={styles.interJornadaBox}><p>Aún no ha finalizado ninguna jornada.</p></div>}
                {proximaJornada ? (<div style={styles.interJornadaBox}><h3 style={styles.interJornadaTitle}>Próxima Jornada</h3><p style={styles.interJornadaTeams}>{proximaJornada.equipoLocal} vs {proximaJornada.equipoVisitante}</p><p>{formatFullDateTime(proximaJornada.fechaPartido || proximaJornada.fechaCierre)}</p>{proximaJornada.bote > 0 && <p style={styles.interJornadaBote}>¡Bote de {proximaJornada.bote}€ en juego!</p>}</div>) : <div style={styles.interJornadaBox}><p>El administrador no ha configurado la próxima jornada.</p></div>}
            </div>
        );
    };

    return (
        <div>
            <h2 style={styles.title} className="app-title">LA JORNADA</h2>
            {showHistorialModal && <HistorialCambiosModal historial={historialSeleccionado} loading={loadingHistorial} onClose={() => setShowHistorialModal(false)} />}
            {renderContent()}
        </div>
    );
};

const JornadaHistoricoScreen = ({ jornadaId, onBack, teamLogos, userProfiles }) => {
    const [jornada, setJornada] = useState(null); const [pronosticos, setPronosticos] = useState([]); const [loading, setLoading] = useState(true);

    useEffect(() => { 
        setLoading(true); 
        const jornadaRef = doc(db, "jornadas", jornadaId); 
        const unsubJornada = onSnapshot(jornadaRef, (docSnap) => { if (docSnap.exists()) { setJornada({ id: docSnap.id, ...docSnap.data() }); } }); 
        const pronosticosRef = collection(db, "pronosticos", jornadaId, "jugadores"); 
        const unsubPronosticos = onSnapshot(pronosticosRef, (snapshot) => { setPronosticos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); setLoading(false); }); 
        return () => { unsubJornada(); unsubPronosticos(); }; 
    }, [jornadaId]);

    const finalResult = jornada ? `${jornada.resultadoLocal} - ${jornada.resultadoVisitante}` : 'N/A';
    const esFinalizada = jornada?.estado === 'Finalizada';
    const bote = esFinalizada && jornada.ganadores?.length === 0;
    const premioPorGanador = esFinalizada && jornada.ganadores?.length > 0 ? ((pronosticos.length * (jornada.esVip ? APUESTA_VIP : APUESTA_NORMAL) + (jornada.bote || 0)) / jornada.ganadores.length).toFixed(2) : '-';

    if (loading) return <LoadingSkeleton />;
    
    const getAciertos = (p) => {
        if (!p.puntosObtenidos) return [];
        let aciertos = [];
        if (p.puntosResultadoExacto > 0) aciertos.push('Exacto');
        if (p.puntos1x2 > 0) aciertos.push('1X2');
        if (p.puntosGoleador > 0) aciertos.push('Primer Goleador');
        if (p.jokerActivo && p.puntosObtenidos > (p.puntosResultadoExacto + p.puntos1x2 + p.puntosGoleador)) aciertos.push('Joker');
        return aciertos;
    };

    return (
        <div>
            <button onClick={onBack} style={styles.backButton}>&larr; Volver al Calendario</button>
            <h2 style={styles.title} className="app-title">TRANSPARENCIA JORNADA {jornada?.numeroJornada}</h2>

            <div style={{textAlign: 'center', marginBottom: '20px'}}>
                <h3 style={styles.formSectionTitle}>{jornada?.equipoLocal} vs {jornada?.equipoVisitante}</h3>
                <p style={styles.finalResult}>Resultado Final: {finalResult}</p>
                {esFinalizada && (
                    <div style={{marginBottom: '20px'}}>
                        {bote && <div style={styles.boteBanner}>💰 ¡BOTE! Se acumulan {(jornada.bote || 0).toFixed(2)}€</div>}
                        {jornada.ganadores?.length > 0 && <div style={styles.winnerBanner}>🏆 Ganador(es): {jornada.ganadores.join(', ')} (Premio: {premioPorGanador}€ c/u)</div>}
                    </div>
                )}
            </div>

            <h4 style={{color: styles.yellow, marginBottom: '15px'}}>Puntos y Aciertos:</h4>
            <div style={{overflowX: 'auto'}}>
                <table style={styles.table}>
                    <thead><tr><th style={styles.th}>Jugador</th><th style={styles.th}>Pronóstico</th><th style={styles.th}>1X2</th><th style={styles.th}>Goleador</th><th style={styles.th}>Puntos</th></tr></thead>
                    <tbody>
                        {pronosticos.sort((a,b) => (b.puntosObtenidos || 0) - (a.puntosObtenidos || 0)).map(p => {
                            const profile = userProfiles[p.id] || {}; const aciertos = getAciertos(p); const esGanador = esFinalizada && jornada.ganadores?.includes(p.id);
                            return (
                                <tr key={p.id} style={esGanador ? styles.winnerRow : styles.tr}>
                                    <td style={styles.td}><PlayerProfileDisplay name={p.id} profile={profile} /></td>
                                    <td style={styles.td}>{p.golesLocal}-{p.golesVisitante} {p.jokerActivo && '🃏'}</td>
                                    <td style={styles.td}><span style={{color: aciertos.includes('1X2') ? styles.colors.success : styles.colors.danger}}>{p.resultado1x2 || 'N/A'}</span></td>
                                    <td style={styles.td}><span style={{color: aciertos.includes('Primer Goleador') ? styles.colors.success : styles.colors.danger}}>{p.sinGoleador ? 'SG' : (p.goleador || 'N/A')}</span></td>
                                    <td style={styles.tdTotalPoints}><AnimatedPoints value={p.puntosObtenidos || 0} /></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- NUEVA PESTAÑA: EL CAMINO (Cuadro Eliminatorio Playoff) ---
const ElCaminoScreen = ({ user, userProfiles }) => {
    const [config, setConfig] = useState(null);
    const [apuesta, setApuesta] = useState('');
    const [hasBet, setHasBet] = useState(false);
    
    useEffect(() => {
        onSnapshot(doc(db, "configuracion", "playoff"), (d) => { if(d.exists()) setConfig(d.data()); });
        getDoc(doc(db, "apuestasExtra", user)).then(d => { if(d.exists()){ setApuesta(d.data().equipo); setHasBet(true); }});
    }, [user]);

    const handleBet = async (equipo) => {
        if(hasBet || config?.bloqueado) return;
        if(window.confirm(`¿Seguro que quieres apostar por ${equipo}? Sumarás +5 puntos si asciende.`)) {
            await setDoc(doc(db, "apuestasExtra", user), { equipo });
            setApuesta(equipo); setHasBet(true);
        }
    };

    return (
        <div>
            <h2 style={styles.title}>EL CAMINO AL ASCENSO</h2>
            <div style={styles.bracketContainer}>
                <div style={styles.bracketMatchup}>
                    <div style={{...styles.bracketTeam, ...(config?.semi1_ganador === 'UD Almería' ? styles.bracketWinner : {})}}>UD Almería (3º)</div>
                    <span style={{color: colors.gold, fontWeight: 'bold'}}>VS</span>
                    <div style={{...styles.bracketTeam, ...(config?.semi1_ganador === 'CD Castellón' ? styles.bracketWinner : {})}}>CD Castellón (6º)</div>
                </div>
                <div style={styles.bracketMatchup}>
                    <div style={{...styles.bracketTeam, ...(config?.semi2_ganador === 'Málaga CF' ? styles.bracketWinner : {})}}>Málaga CF (4º)</div>
                    <span style={{color: colors.gold, fontWeight: 'bold'}}>VS</span>
                    <div style={{...styles.bracketTeam, ...(config?.semi2_ganador === 'UD Las Palmas' ? styles.bracketWinner : {})}}>UD Las Palmas (5º)</div>
                </div>
                <div style={styles.bracketFinal}>
                    <h4 style={{color: colors.yellow, marginBottom: '10px'}}>GRAN FINAL</h4>
                    <p style={{fontSize: '1.2rem', fontWeight: 'bold'}}>{config?.semi1_ganador || '???'} vs {config?.semi2_ganador || '???'}</p>
                    {config?.ascendido && <h3 style={{color: colors.success, marginTop: '15px'}}>🎉 ASCIENDE: {config.ascendido} 🎉</h3>}
                </div>
            </div>

            <div style={{...styles.form, textAlign: 'center'}}>
                <h3 style={{color: colors.yellow}}>APUESTA EXTRA (+5 Puntos)</h3>
                <p style={{marginBottom: '15px'}}>¿Qué equipo logrará el ascenso a Primera División?</p>
                {!hasBet && !config?.bloqueado ? (
                    <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center'}}>
                        {["UD Almería", "Málaga CF", "UD Las Palmas", "CD Castellón"].map(eq => (
                            <button key={eq} onClick={() => handleBet(eq)} style={styles.secondaryButton}>{eq}</button>
                        ))}
                    </div>
                ) : (
                    <div style={{padding: '15px', backgroundColor: 'rgba(212,175,55,0.2)', borderRadius: '8px', border: `1px solid ${colors.gold}`}}>
                        <p style={{fontWeight: 'bold', fontSize: '1.2rem'}}>Tu apuesta: {apuesta}</p>
                        {config?.ascendido && <p style={{marginTop: '10px', color: config.ascendido === apuesta ? colors.success : colors.danger}}>{config.ascendido === apuesta ? '¡+5 PUNTOS!' : 'Fallaste'}</p>}
                    </div>
                )}
            </div>
        </div>
    );
};

const CalendarioScreen = ({ onViewJornada, teamLogos }) => {
    const [jornadas, setJornadas] = useState([]); 
    const [loading, setLoading] = useState(true);

    useEffect(() => { 
        const q = query(collection(db, "jornadas"), orderBy("numeroJornada")); 
        const unsubscribe = onSnapshot(q, (querySnapshot) => { 
            setJornadas(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); 
            setLoading(false); 
        }, (error) => { console.error("Error cargando calendario: ", error); setLoading(false); }); 
        return () => unsubscribe(); 
    }, []);

    if (loading) return <LoadingSkeleton />;
    
    return (
        <div>
            <h2 style={styles.title} className="app-title">CALENDARIO PLAYOFF</h2>
            <div style={styles.jornadaList}>
                {jornadas.map(jornada => {
                    const fechaMostrada = jornada.fechaPartido || jornada.fechaCierre;
                    const targetScreen = jornada.estado === 'Finalizada' ? 'historico' : 'detalle';
                    return (
                        <div key={jornada.id} style={jornada.esVip ? {...styles.jornadaItem, ...styles.jornadaVip, backgroundImage: `linear-gradient(to right, rgba(15, 12, 5, 0.95), rgba(15, 12, 5, 0.7)), url(${jornada.estadioImageUrl})`} : {...styles.jornadaItem, backgroundImage: `linear-gradient(to right, rgba(15, 12, 5, 0.95), rgba(15, 12, 5, 0.7)), url(${jornada.estadioImageUrl})`}} onClick={() => onViewJornada(jornada.id, targetScreen)}>
                            <div style={styles.jornadaInfo}>
                                <div style={styles.jornadaTeams}>
                                    <TeamDisplay teamLogos={teamLogos} teamName={jornada.equipoLocal} imgStyle={{width: 25, height: 25}} />
                                    <span style={{color: styles.colors.yellow, margin: '0 10px'}}>vs</span>
                                    <TeamDisplay teamLogos={teamLogos} teamName={jornada.equipoVisitante} imgStyle={{width: 25, height: 25}} />
                                </div>
                                <strong>{jornada.esVip && '⭐ '}{jornada.id === 'jornada_test' ? 'Jornada de Prueba' : `Jornada ${jornada.numeroJornada || 'Playoff'}`}</strong>
                                <small>{formatFullDateTime(fechaMostrada)}</small>
                            </div>
                            <div style={{...styles.statusBadge, backgroundColor: styles.colors.status[jornada.estado]}}>{jornada.estado}</div>
                        </div>
                    )
                })}
            </div>
        </div>
    );
};

const AnimatedPointsClasificacion = ({ value }) => {
    const [currentValue, setCurrentValue] = useState(0); const [flash, setFlash] = useState(null); const prevValueRef = useRef(0);
    useEffect(() => { 
        const startValue = prevValueRef.current; const endValue = value || 0; let startTime = null; 
        if (endValue > startValue) { setFlash('up'); } else if (endValue < startValue) { setFlash('down'); }
        const animation = (currentTime) => { if (!startTime) startTime = currentTime; const progress = Math.min((currentTime - startTime) / 1000, 1); const newDisplayValue = Math.floor(progress * (endValue - startValue) + startValue); setCurrentValue(newDisplayValue); if (progress < 1) { requestAnimationFrame(animation); } else { prevValueRef.current = endValue; setTimeout(() => setFlash(null), 700); } };
        requestAnimationFrame(animation); return () => { prevValueRef.current = value || 0; };
    }, [value]);
    return <span className={flash === 'up' ? 'point-jump-up' : (flash === 'down' ? 'point-jump-down' : '')}>{currentValue}</span>;
};

// --- NUEVA PESTAÑA: LIGA REGULAR (Estática) ---
const LigaRegularScreen = ({ userProfiles }) => {
    const [clasificacion, setClasificacion] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // En un caso real, esto leería de una colección congelada. 
        // Como no tenemos eso en los requisitos explícitos, mostramos la clasificación general base.
        const qClasificacion = query(collection(db, "clasificacion"));
        const unsubscribe = onSnapshot(qClasificacion, (snap) => {
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setClasificacion(data.sort((a, b) => (b.puntosTotales || 0) - (a.puntosTotales || 0)));
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    if (loading) return <LoadingSkeleton type="table" />;

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

const ClasificacionScreen = ({ currentUser, liveData, liveJornada, userProfiles }) => {
    const [clasificacion, setClasificacion] = useState([]); 
    const [loading, setLoading] = useState(true); 
    const [livePronosticos, setLivePronosticos] = useState([]);

    useEffect(() => { 
        const qClasificacion = query(collection(db, "clasificacion")); 
        const unsubscribe = onSnapshot(qClasificacion, (querySnapshot) => { 
            const clasificacionData = {}; 
            querySnapshot.forEach((doc) => { clasificacionData[doc.id] = { id: doc.id, ...doc.data() }; }); 
            const processedData = JUGADORES.map(jugadorId => { return clasificacionData[jugadorId] || { id: jugadorId, jugador: jugadorId, puntosTotales: 0, puntosResultadoExacto: 0, puntosGoleador: 0, puntos1x2: 0, plenos: 0, jokersRestantes: 2, badges: [] }; }); 
            setClasificacion(processedData); setLoading(false); 
        }); 
        return () => unsubscribe();
    }, []);

    useEffect(() => { 
        if (liveJornada) { 
            const pronosticosRef = collection(db, "pronosticos", liveJornada.id, "jugadores"); 
            const unsubscribe = onSnapshot(pronosticosRef, (snapshot) => { setLivePronosticos(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))); }); 
            return () => unsubscribe(); 
        } else { setLivePronosticos([]); } 
    }, [liveJornada]);

    const liveClasificacion = useMemo(() => { 
        const isLive = liveData && liveJornada && liveJornada.estado === 'En vivo';
        const liveScores = new Map(); 
        if (isLive) { livePronosticos.forEach(p => { const puntosProvisionales = calculateProvisionalPoints(p, liveData, liveJornada); liveScores.set(p.id, puntosProvisionales); }); } 
        const sorted = [...clasificacion].map(jugador => ({ ...jugador, puntosEnVivo: (jugador.puntosTotales || 0) + (liveScores.get(jugador.id) || 0) })).sort((a, b) => { const pointsA = isLive ? a.puntosEnVivo : (a.puntosTotales || 0); const pointsB = isLive ? b.puntosEnVivo : (b.puntosTotales || 0); return pointsB - pointsA; }); 
        return sorted; 
    }, [clasificacion, liveData, liveJornada, livePronosticos]);

    if (loading) return <LoadingSkeleton type="table" />; 
    const isLive = liveData && liveJornada && liveJornada.estado === 'En vivo';

    const getRankStyle = (index, jugador) => { 
        let style = {};
        if (index === 0) style = styles.leaderRow; else if (index === 1) style = styles.secondPlaceRow; else if (index === 2) style = styles.thirdPlaceRow;
        if (jugador.id === currentUser) { style = {...style, ...styles.currentUserRow}; }
        return style; 
    };

    return (
        <div>
            <h2 style={styles.title} className="app-title">CLASIFICACIÓN PLAYOFF</h2>
            <div style={{overflowX: 'auto'}}>
                <table style={styles.table}>
                    <thead>
                        <tr><th style={{...styles.th, width: '5%'}}>POS</th><th style={{...styles.th, width: '30%'}}>JUGADOR</th><th style={{...styles.th, width: '15%', textAlign: 'center'}}>TOTAL {isLive && '(VIVO)'}</th><th style={{...styles.th, width: '12.5%', textAlign: 'center'}}>P. EXACTO</th><th style={{...styles.th, width: '12.5%', textAlign: 'center'}}>P. GOLEADOR</th><th style={{...styles.th, width: '12.5%', textAlign: 'center'}}>P. 1X2</th><th style={{...styles.th, width: '12.5%', textAlign: 'center'}}>PLENOS 🎯</th></tr>
                    </thead>
                    <tbody>
                        {liveClasificacion.map((jugador, index) => { 
                            const profile = {...(userProfiles[jugador.id] || {}), badges: jugador.badges || []}; 
                            const puntosAMostrar = isLive ? jugador.puntosEnVivo : jugador.puntosTotales;
                            return (
                                <tr key={jugador.id} style={{...styles.tr, ...getRankStyle(index, jugador)}}>
                                    <td style={styles.tdRank}>{index + 1}º</td>
                                    <td style={styles.td}><PlayerProfileDisplay name={jugador.jugador || jugador.id} profile={profile} /></td>
                                    <td style={styles.tdTotalPoints}><AnimatedPointsClasificacion value={puntosAMostrar} /></td>
                                    <td style={{...styles.td, textAlign: 'center'}}>{jugador.puntosResultadoExacto || 0}</td>
                                    <td style={{...styles.td, textAlign: 'center'}}>{jugador.puntosGoleador || 0}</td>
                                    <td style={{...styles.td, textAlign: 'center'}}>{jugador.puntos1x2 || 0}</td>
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

// ============================================================================
// --- COMPONENTES DE ADMINISTRACIÓN ---
// ============================================================================

const JornadaAdminItem = ({ jornada, plantilla }) => {
    const [estado, setEstado] = useState(jornada.estado);
    const [resultadoLocal, setResultadoLocal] = useState(jornada.resultadoLocal === undefined ? '' : jornada.resultadoLocal);
    const [resultadoVisitante, setResultadoVisitante] = useState(jornada.resultadoVisitante === undefined ? '' : jornada.resultadoVisitante);
    const [goleador, setGoleador] = useState(jornada.goleador || '');
    const [esVip, setEsVip] = useState(jornada.esVip || false);
    const [splashMessage, setSplashMessage] = useState(jornada.splashMessage || '');
    const [tipoPartido, setTipoPartido] = useState(jornada.tipoPartido || 'ida'); // NUEVO: Tipo de partido
    
    const toInputFormat = (date) => {
        if (!date || !date.seconds) return '';
        const d = new Date(date.seconds * 1000);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().slice(0, 16);
    };

    const [fechaApertura, setFechaApertura] = useState(toInputFormat(jornada.fechaApertura));
    const [fechaCierre, setFechaCierre] = useState(toInputFormat(jornada.fechaCierre));
    const [fechaPartido, setFechaPartido] = useState(toInputFormat(jornada.fechaPartido));
    
    const [estadioImageUrl, setEstadioImageUrl] = useState(jornada.estadioImageUrl || '');
    const [boteAjuste, setBoteAjuste] = useState(jornada.bote || 0);

    const [isSaving, setIsSaving] = useState(false);
    const [isCalculating, setIsCalculating] = useState(false);
    const [message, setMessage] = useState('');
    const [liveData, setLiveData] = useState({ golesLocal: 0, golesVisitante: 0, primerGoleador: '', isLive: false });

    useEffect(() => { 
        if (jornada.liveData) { setLiveData({ ...jornada.liveData, primerGoleador: jornada.liveData.primerGoleador || jornada.liveData.ultimoGoleador || '' }); } 
    }, [jornada.liveData]);

    const handleSaveChanges = async () => {
        setIsSaving(true); setMessage('');
        const jornadaRef = doc(db, "jornadas", jornada.id);
        try {
            await updateDoc(jornadaRef, { 
                estado, resultadoLocal, resultadoVisitante, goleador: goleador.trim(), esVip, splashMessage, tipoPartido, // Se guarda el tipo
                fechaApertura: fechaApertura ? new Date(fechaApertura) : null, fechaCierre: fechaCierre ? new Date(fechaCierre) : null, fechaPartido: fechaPartido ? new Date(fechaPartido) : null,
                estadioImageUrl, bote: boteAjuste 
            });
            setMessage('¡Guardado!'); setTimeout(() => setMessage(''), 2000);
        } catch (error) { console.error("Error al actualizar: ", error); setMessage('Error al guardar.'); }
        setIsSaving(false);
    };

    const handleUpdateLiveState = async () => {
        setIsSaving(true);
        const jornadaRef = doc(db, "jornadas", jornada.id);
        try {
            await updateDoc(jornadaRef, { estado: 'En vivo', liveData: { golesLocal: liveData.golesLocal, golesVisitante: liveData.golesVisitante, primerGoleador: liveData.primerGoleador, isLive: true } });
            setMessage('¡Jornada EN VIVO y actualizada!'); setTimeout(() => setMessage(''), 2000);
        } catch (error) { setMessage('Error al activar.'); }
        setIsSaving(false);
    };
    
    const handleCalcularPuntos = async () => {
        if (resultadoLocal === '' || resultadoVisitante === '') { alert("Debes introducir el resultado final (goles) para finalizar la jornada."); return; }
        if (!window.confirm("¿Seguro que quieres finalizar/recalcular esta jornada?")) return;

        setIsCalculating(true); setMessage('Calculando puntos y asignando insignias...');

        try {
            const pronosticosRef = collection(db, "pronosticos", jornada.id, "jugadores");
            const pronosticosSnap = await getDocs(pronosticosRef);
            const pronosticos = pronosticosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const batch = writeBatch(db);
            let ganadores = [];
            const puntosPorJugador = {};
            let hayAciertoExacto = false; 
            const boteInicial = jornada.bote || 0; 

            for (const p of pronosticos) {
                const puntosPrevios = p.puntosObtenidos || 0;
                const puntosResultadoExactoPrevios = p.puntosResultadoExacto || 0;
                const puntos1x2Previos = p.puntos1x2 || 0;
                const puntosGoleadorPrevios = p.puntosGoleador || 0;

                const clasificacionDocRef = doc(db, "clasificacion", p.id);
                if (puntosPrevios > 0) {
                     batch.update(clasificacionDocRef, { puntosTotales: increment(-puntosPrevios), puntosResultadoExacto: increment(-puntosResultadoExactoPrevios), puntos1x2: increment(-puntos1x2Previos), puntosGoleador: increment(-puntosGoleadorPrevios) });
                }
            }
            await batch.commit();

            const batchFinal = writeBatch(db);
            const costeApuesta = jornada.esVip ? APUESTA_VIP : APUESTA_NORMAL;
            const recaudadoJornada = pronosticos.length * costeApuesta; 
            
            for (const p of pronosticos) {
                let puntosJornada = 0; let esPleno = false; const esVipJornada = jornada.esVip || false;
                let puntosResultadoExacto = 0; let puntos1x2 = 0; let puntosGoleador = 0;
                
                const aciertoExactoPrincipal = p.golesLocal !== '' && p.golesVisitante !== '' && parseInt(p.golesLocal) === parseInt(resultadoLocal) && parseInt(p.golesVisitante) === parseInt(resultadoVisitante);
                let aciertoExactoJoker = false;
                if (p.jokerActivo && p.jokerPronosticos?.length > 0) {
                    for (const jokerP of p.jokerPronosticos) {
                        if (jokerP.golesLocal !== '' && jokerP.golesVisitante !== '' && parseInt(jokerP.golesLocal) === parseInt(resultadoLocal) && parseInt(jokerP.golesVisitante) === parseInt(resultadoVisitante)) { aciertoExactoJoker = true; break; }
                    }
                }
                
                const aciertoExacto = aciertoExactoPrincipal || aciertoExactoJoker;
                if (aciertoExacto) { puntosResultadoExacto = esVipJornada ? 6 : 3; puntosJornada += puntosResultadoExacto; hayAciertoExacto = true; }

                if (jornada.tipoPartido !== 'vuelta_semi' && jornada.tipoPartido !== 'vuelta_final') {
                    let resultado1x2Real = '';
                    if (jornada.equipoLocal === "UD Las Palmas") {
                        if (parseInt(resultadoLocal) > parseInt(resultadoVisitante)) resultado1x2Real = 'Gana UD Las Palmas';
                        else if (parseInt(resultadoLocal) < parseInt(resultadoVisitante)) resultado1x2Real = 'Pierde UD Las Palmas';
                        else resultado1x2Real = 'Empate';
                    } else {
                        if (parseInt(resultadoVisitante) > parseInt(resultadoLocal)) resultado1x2Real = 'Gana UD Las Palmas';
                        else if (parseInt(resultadoVisitante) < parseInt(resultadoLocal)) resultado1x2Real = 'Pierde UD Las Palmas';
                        else resultado1x2Real = 'Empate';
                    }
                    const acierto1x2 = p.resultado1x2 === resultado1x2Real;
                    if (acierto1x2) { puntos1x2 = esVipJornada ? 2 : 1; puntosJornada += puntos1x2; }
                }

                const goleadorReal = (goleador || '').trim().toLowerCase();
                const goleadorApostado = p.goleador ? p.goleador.trim().toLowerCase() : '';
                if (p.sinGoleador && goleadorReal === "sg") { puntosGoleador = 1; puntosJornada += puntosGoleador; } 
                else if (!p.sinGoleador && goleadorApostado === goleadorReal && goleadorReal !== "" && goleadorReal !== "sg") { puntosGoleador = esVipJornada ? 4 : 2; puntosJornada += puntosGoleador; }

                if (aciertoExacto && (jornada.tipoPartido === 'vuelta_semi' || jornada.tipoPartido === 'vuelta_final' || p.resultado1x2) && puntosGoleador > 0) esPleno = true;
                
                puntosPorJugador[p.id] = { puntosJornada, esPleno, aciertoExacto };
                
                const pronosticoDocRef = doc(db, "pronosticos", jornada.id, "jugadores", p.id);
                batchFinal.update(pronosticoDocRef, { puntosObtenidos: puntosJornada, puntosResultadoExacto, puntos1x2, puntosGoleador });
                
                const clasificacionDocRef = doc(db, "clasificacion", p.id);
                batchFinal.update(clasificacionDocRef, { puntosTotales: increment(puntosJornada), puntosResultadoExacto: increment(puntosResultadoExacto), puntos1x2: increment(puntos1x2), puntosGoleador: increment(puntosGoleador) });
            }
            
            if (hayAciertoExacto) {
                const candidatos = Object.entries(puntosPorJugador).filter(([, data]) => data.aciertoExacto);
                const maxPuntosGeneral = candidatos.length > 0 ? Math.max(...candidatos.map(([, data]) => data.puntosJornada)) : 0;
                if (maxPuntosGeneral > 0) { ganadores = candidatos.filter(([, data]) => data.puntosJornada === maxPuntosGeneral).map(([id]) => id); } else { ganadores = []; }
            } else { ganadores = []; }
            
            const clasificacionDocs = await getDocs(collection(db, "clasificacion"));
            for (const docSnap of clasificacionDocs.docs) {
                const jugadorId = docSnap.id; const jugadorRef = doc(db, "clasificacion", jugadorId);
                const currentBadges = new Set(docSnap.data().badges || []);
                ['campeon_jornada', 'pleno_jornada'].forEach(b => currentBadges.delete(b));
                if (ganadores.includes(jugadorId)) currentBadges.add('campeon_jornada');
                if (puntosPorJugador[jugadorId]?.esPleno) currentBadges.add('pleno_jornada');
                batchFinal.update(jugadorRef, { badges: Array.from(currentBadges) });
            }
            
            if (ganadores.length === 0 && jornada.id !== 'jornada_test') {
                const nuevoBoteAcumulado = boteInicial + recaudadoJornada; 
                const qProxima = query(collection(db, "jornadas"), where("numeroJornada", ">", jornada.numeroJornada), orderBy("numeroJornada"), limit(1));
                const proximaJornadaSnap = await getDocs(qProxima);
                if (!proximaJornadaSnap.empty) { batchFinal.update(proximaJornadaSnap.docs[0].ref, { bote: nuevoBoteAcumulado }); }
                batchFinal.update(doc(db, "jornadas", jornada.id), { bote: 0 });
            }
            
            const jornadaRef = doc(db, "jornadas", jornada.id);
            batchFinal.update(jornadaRef, { estado: "Finalizada", ganadores, "liveData.isLive": false });
            await batchFinal.commit();
            setMessage('¡Puntos calculados y jornada cerrada con éxito!');

        } catch (error) { console.error("Error masivo: ", error); setMessage(`Error: ${error.message}`); }
        setIsCalculating(false);
    };

    return (
        <div style={jornada.id === 'jornada_test' ? {...styles.adminJornadaItem, ...styles.testJornadaAdminItem} : (jornada.esVip ? {...styles.adminJornadaItem, ...styles.jornadaVip} : styles.adminJornadaItem)}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap'}}><p><strong>{jornada.id === 'jornada_test' ? 'Jornada de Prueba' : `Jornada ${jornada.numeroJornada || 'Playoff'}`}:</strong> {jornada.equipoLocal} vs {jornada.equipoVisitante}</p><div style={styles.vipToggleContainer}><label htmlFor={`vip-toggle-${jornada.id}`}>⭐ VIP</label><input id={`vip-toggle-${jornada.id}`} type="checkbox" checked={esVip} onChange={(e) => setEsVip(e.target.checked)} style={styles.checkbox}/></div></div>
            <div style={styles.adminControls}>
                <div><label style={styles.label}>Estado:</label><select value={estado} onChange={(e) => setEstado(e.target.value)} style={styles.adminSelect}><option value="Próximamente">Próximamente</option><option value="Pre-apertura">Pre-apertura</option><option value="Abierta">Abierta</option><option value="Cerrada">Cerrada</option><option value="En vivo">En vivo</option><option value="Finalizada">Finalizada</option></select></div>
                <div><label style={styles.label}>Tipo Eliminatoria:</label><select value={tipoPartido} onChange={(e) => setTipoPartido(e.target.value)} style={styles.adminSelect}><option value="ida">Liga / Ida (1X2)</option><option value="vuelta_semi">Vuelta Semifinal (Pasa/No pasa)</option><option value="vuelta_final">Vuelta Final (Asciende/No asciende)</option></select></div>
                <div><label style={styles.label}>Resultado Final (Oficial):</label><div style={styles.resultInputContainer}><input type="number" min="0" value={resultadoLocal} onChange={(e) => setResultadoLocal(e.target.value)} style={styles.resultInput} /><span style={styles.separator}>-</span><input type="number" min="0" value={resultadoVisitante} onChange={(e) => setResultadoVisitante(e.target.value)} style={styles.resultInput} /></div></div>
                <div><label style={styles.label}>Primer Goleador (Final):</label><select value={goleador} onChange={(e) => setGoleador(e.target.value)} style={styles.adminSelect}><option value="">-- Elige --</option><option value="SG">Sin Goleador (SG)</option>{plantilla.sort((a, b) => a.nombre.localeCompare(b.nombre)).map(jugador => (<option key={jugador.nombre} value={jugador.nombre}>{jugador.dorsal ? `${jugador.dorsal} - ${jugador.nombre}` : jugador.nombre}</option>))}</select></div>
                <div><label style={styles.label}>Apertura Apuestas:</label><input type="datetime-local" value={fechaApertura} onChange={(e) => setFechaApertura(e.target.value)} style={styles.adminInput} /></div>
                <div><label style={styles.label}>Cierre Apuestas:</label><input type="datetime-local" value={fechaCierre} onChange={(e) => setFechaCierre(e.target.value)} style={styles.adminInput} /></div>
                <div><label style={styles.label}>Fecha del Partido:</label><input type="datetime-local" value={fechaPartido} onChange={(e) => setFechaPartido(e.target.value)} style={styles.adminInput} /></div>
            </div>
            <div style={{marginTop: '10px'}}><label style={styles.label}>Mensaje Principal:</label><textarea value={splashMessage} onChange={(e) => setSplashMessage(e.target.value)} style={{...styles.input, width: '95%', height: '50px'}} /></div>
            <div style={{marginTop: '10px'}}><label style={styles.label}>URL Imagen Estadio:</label><input type="text" value={estadioImageUrl} onChange={(e) => setEstadioImageUrl(e.target.value)} style={{...styles.input, width: '95%'}} /></div>
            <div style={{marginTop: '20px', padding: '15px', border: `1px solid ${styles.colors.danger}`, borderRadius: '8px', textAlign: 'center'}}><h4 style={{color: styles.colors.danger, marginBottom: '15px', fontFamily: "'Orbitron', sans-serif"}}>Ajuste de Bote Acumulado (Manual)</h4><div style={{display: 'flex', justifyContent: 'center', gap: '15px', alignItems: 'center'}}><label style={{...styles.label, marginBottom: 0}}>Valor del Bote:</label><input type="number" min="0" value={boteAjuste} onChange={(e) => setBoteAjuste(parseFloat(e.target.value) || 0)} style={{...styles.resultInput, width: '100px'}} /></div></div>
            <div style={{marginTop: '20px', display: 'flex', flexWrap: 'wrap', gap: '10px'}}><button onClick={handleSaveChanges} disabled={isSaving} style={styles.saveButton}>{isSaving ? 'Guardando...' : 'Guardar Cambios'}</button>{jornada.estado === 'Finalizada' && (<button onClick={handleCalcularPuntos} disabled={isCalculating} style={{...styles.saveButton, backgroundColor: styles.colors.gold, color: colors.deepBlue}}>{isCalculating ? 'Calculando...' : 'Calcular Puntos y Cerrar'}</button>)}{message && <span style={{marginLeft: '10px', color: styles.colors.success, alignSelf: 'center'}}>{message}</span>}</div>
            {(jornada.estado === 'Cerrada' || jornada.estado === 'En vivo') && (<div style={styles.liveAdminContainer}><h4 style={styles.liveAdminTitle}>🔴 Control del Partido en Vivo</h4><div style={styles.adminControls}><div><label style={styles.label}>Marcador en Vivo:</label><div style={styles.resultInputContainer}><input type="number" min="0" value={liveData.golesLocal} onChange={(e) => setLiveData(d => ({ ...d, golesLocal: parseInt(e.target.value) || 0 }))} style={styles.resultInput} /><span style={styles.separator}>-</span><input type="number" min="0" value={liveData.golesVisitante} onChange={(e) => setLiveData(d => ({ ...d, golesVisitante: parseInt(e.target.value) || 0 }))} style={styles.resultInput} /></div></div><div><label style={styles.label}>Primer Goleador:</label><select value={liveData.primerGoleador} onChange={(e) => setLiveData(d => ({...d, primerGoleador: e.target.value}))} style={styles.adminSelect}><option value="">-- Elige --</option><option value="SG">Sin Goleador (SG)</option>{plantilla.sort((a, b) => a.nombre.localeCompare(b.nombre)).map(jugador => (<option key={jugador.nombre} value={jugador.nombre}>{jugador.dorsal ? `${jugador.dorsal} - ${jugador.nombre}` : jugador.nombre}</option>))}</select></div></div><button onClick={handleUpdateLiveState} disabled={isSaving} style={{...styles.saveButton, backgroundColor: styles.colors.danger, marginTop: '15px'}}>{isSaving ? 'Actualizando...' : 'Activar / Actualizar Marcador EN VIVO'}</button></div>)}
        </div>
    );
};

const AdminTestJornada = () => {
    const [isActive, setIsActive] = useState(false); const [loading, setLoading] = useState(true);
    const testJornadaRef = useMemo(() => doc(db, "jornadas", "jornada_test"), []);
    useEffect(() => { const checkStatus = async () => { setLoading(true); const docSnap = await getDoc(testJornadaRef); setIsActive(docSnap.exists()); setLoading(false); }; const unsubscribe = onSnapshot(testJornadaRef, (doc) => { setIsActive(doc.exists()); }); checkStatus(); return () => unsubscribe(); }, [testJornadaRef]);
    const handleToggleTestJornada = async () => {
        setLoading(true);
        if (isActive) {
            if (window.confirm("¿Seguro que quieres DESACTIVAR y BORRAR la jornada de prueba? Todos los pronósticos asociados se eliminarán permanentemente.")) { await deleteDoc(testJornadaRef); const pronosticosRef = collection(db, "pronosticos", "jornada_test", "jugadores"); const pronosticosSnap = await getDocs(pronosticosRef); const batch = writeBatch(db); pronosticosSnap.docs.forEach(d => batch.delete(d.ref)); await batch.commit(); alert("Jornada de prueba desactivada."); }
        } else {
            const testJornadaData = { numeroJornada: 99, equipoLocal: "UD Las Palmas", equipoVisitante: "Real Zaragoza", estado: "Abierta", esVip: false, bote: 0, fechaStr: "Partido de Prueba", estadio: "Estadio de Pruebas", estadioImageUrl: "https://as01.epimg.net/img/comunes/fotos/fichas/estadios/g/grc.jpg", tipoPartido: 'ida', liveData: { isLive: false, golesLocal: 0, golesVisitante: 0, primerGoleador: '' }, fechaApertura: new Date(), fechaCierre: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000), fechaPartido: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000) };
            await setDoc(testJornadaRef, testJornadaData); alert("Jornada de prueba ACTIVADA.");
        }
        setLoading(false);
    };
    return (<div style={{...styles.adminJornadaItem, ...styles.testJornadaAdminItem}}><h3 style={styles.formSectionTitle}>🧪 Gestión de Jornada de Prueba</h3><div style={{display: 'flex', justifyContent: 'center', gap: '10px'}}><button onClick={handleToggleTestJornada} disabled={loading} style={{...styles.mainButton, backgroundColor: isActive ? styles.colors.danger : styles.colors.success, borderColor: isActive ? styles.colors.danger : styles.colors.success, margin: '10px 0'}}>{loading ? 'Cargando...' : (isActive ? 'Desactivar y Borrar Jornada' : 'Activar Jornada de Prueba')}</button></div></div>);
};

const AdminEscudosManager = ({ onBack, teamLogos }) => {
    const [urls, setUrls] = useState(teamLogos || {}); const [saving, setSaving] = useState({});
    useEffect(() => { setUrls(teamLogos || {}); }, [teamLogos]);
    const handleUrlChange = (teamName, value) => { setUrls(prev => ({ ...prev, [teamName]: value })); };
    const handleSave = async (teamName) => { setSaving(prev => ({ ...prev, [teamName]: true })); const docRef = doc(db, "configuracion", "escudos"); try { await setDoc(docRef, { [teamName]: urls[teamName] }, { merge: true }); } catch (error) { alert("Error al guardar."); } finally { setSaving(prev => ({ ...prev, [teamName]: false })); } };
    return (<div style={styles.adminJornadaItem}><button onClick={onBack} style={styles.backButton}>&larr; Volver</button><h3 style={styles.formSectionTitle}>Gestión de Escudos</h3><div style={styles.escudosGrid}>{EQUIPOS_LIGA.map(teamName => (<div key={teamName} style={styles.escudoCard}><img src={urls[teamName] || 'https://placehold.co/80x80/1b263b/e0e1dd?text=?'} style={styles.escudoCardImg} alt={teamName} /><p style={styles.escudoCardName}>{teamName}</p><input type="text" value={urls[teamName] || ''} onChange={(e) => handleUrlChange(teamName, e.target.value)} placeholder="URL" style={styles.escudoInput}/><button onClick={() => handleSave(teamName)} disabled={saving[teamName]} style={styles.escudoSaveButton}>{saving[teamName] ? '...' : 'Guardar'}</button></div>))}</div></div>);
};

const AdminPlantillaManager = ({ onBack, plantilla, setPlantilla }) => {
    const [jugadores, setJugadores] = useState(plantilla); const [newJugador, setNewJugador] = useState({ dorsal: '', nombre: '', imageUrl: '' }); const [saving, setSaving] = useState(false); const [message, setMessage] = useState('');
    const handleInputChange = (index, field, value) => { const updatedJugadores = [...jugadores]; updatedJugadores[index][field] = value; setJugadores(updatedJugadores); };
    const handleAddJugador = () => { if (!newJugador.nombre) return; setJugadores([...jugadores, { ...newJugador, id: Date.now() }]); setNewJugador({ dorsal: '', nombre: '', imageUrl: '' }); };
    const handleRemoveJugador = (index) => { if (window.confirm(`¿Eliminar?`)) { const updatedJugadores = jugadores.filter((_, i) => i !== index); setJugadores(updatedJugadores); } };
    const handleSaveChanges = async () => { setSaving(true); setMessage(''); const plantillaRef = doc(db, "configuracion", "plantilla"); try { const jugadoresToSave = jugadores.map(({ id, ...rest }) => rest); await setDoc(plantillaRef, { jugadores: jugadoresToSave }); setPlantilla(jugadores); setMessage('¡Guardado!'); } catch (error) { setMessage('Error.'); } setSaving(false); };
    return (<div style={styles.adminJornadaItem}><button onClick={onBack} style={styles.backButton}>&larr; Volver</button><h3 style={styles.formSectionTitle}>Gestión de Plantilla</h3><div style={styles.plantillaList}>{jugadores.map((jugador, index) => (<div key={jugador.id || index} style={styles.plantillaItem}><input type="text" value={jugador.dorsal} onChange={(e) => handleInputChange(index, 'dorsal', e.target.value)} placeholder="Dorsal" style={styles.plantillaInput} /><input type="text" value={jugador.nombre} onChange={(e) => handleInputChange(index, 'nombre', e.target.value)} placeholder="Nombre" style={{...styles.plantillaInput, flex: 2}} /><input type="text" value={jugador.imageUrl} onChange={(e) => handleInputChange(index, 'imageUrl', e.target.value)} placeholder="URL" style={{...styles.plantillaInput, flex: 3}} /><button onClick={() => handleRemoveJugador(index)} style={styles.plantillaRemoveBtn}>-</button></div>))}</div><div style={{...styles.plantillaItem, marginTop: '20px', borderTop: `2px dashed ${styles.colors.blue}`, paddingTop: '20px'}}><input type="text" value={newJugador.dorsal} onChange={(e) => setNewJugador(prev => ({...prev, dorsal: e.target.value}))} placeholder="Dorsal" style={styles.plantillaInput} /><input type="text" value={newJugador.nombre} onChange={(e) => setNewJugador(prev => ({...prev, nombre: e.target.value}))} placeholder="Nombre" style={{...styles.plantillaInput, flex: 2}} /><input type="text" value={newJugador.imageUrl} onChange={(e) => setNewJugador(prev => ({...prev, imageUrl: e.target.value}))} placeholder="URL" style={{...styles.plantillaInput, flex: 3}} /><button onClick={handleAddJugador} style={styles.plantillaAddBtn}>+</button></div><button onClick={handleSaveChanges} disabled={saving} style={{...styles.saveButton, marginTop: '20px'}}>{saving ? 'Guardando...' : 'Guardar Cambios'}</button>{message && <p style={{...styles.message}}>{message}</p>}</div>);
};

const AdminPlayoffPanel = ({ onBack }) => {
    const [config, setConfig] = useState({ semi1_ganador: '', semi2_ganador: '', ascendido: '', bloqueado: false });
    useEffect(() => { onSnapshot(doc(db, "configuracion", "playoff"), d => { if(d.exists()) setConfig(d.data()); }); }, []);
    const handleSave = async () => { await setDoc(doc(db, "configuracion", "playoff"), config); alert("Configuración del Playoff Guardada"); };
    return (
        <div style={styles.adminJornadaItem}>
            <button onClick={onBack} style={styles.backButton}>&larr; Volver</button>
            <h3 style={styles.formSectionTitle}>Gestión "El Camino" (Playoff)</h3>
            <div style={styles.adminControls}>
                <div><label style={styles.label}>Ganador Semi 1 (Alm vs Cas):</label><select value={config.semi1_ganador} onChange={e=>setConfig({...config, semi1_ganador: e.target.value})} style={styles.adminSelect}><option value="">--</option><option value="UD Almería">Almería</option><option value="CD Castellón">Castellón</option></select></div>
                <div><label style={styles.label}>Ganador Semi 2 (Mal vs UDLP):</label><select value={config.semi2_ganador} onChange={e=>setConfig({...config, semi2_ganador: e.target.value})} style={styles.adminSelect}><option value="">--</option><option value="Málaga CF">Málaga</option><option value="UD Las Palmas">UDLP</option></select></div>
                <div><label style={styles.label}>¡EQUIPO ASCENDIDO!:</label><input type="text" value={config.ascendido} onChange={e=>setConfig({...config, ascendido: e.target.value})} style={styles.adminInput} placeholder="Ej: UD Las Palmas" /></div>
            </div>
            <div style={{marginTop: '10px'}}><input type="checkbox" checked={config.bloqueado} onChange={e=>setConfig({...config, bloqueado: e.target.checked})} style={styles.checkbox} /> <span style={{color:colors.lightText, marginLeft:'10px'}}>Bloquear Apuestas Extra (+5 Pts)</span></div>
            <button onClick={handleSave} style={{...styles.saveButton, marginTop:'20px'}}>Guardar Cuadro Playoff</button>
            <button onClick={async () => {
                if(!config.ascendido) { alert("Especifica el equipo ascendido primero"); return; }
                if(!window.confirm("¿Seguro que quieres repartir los 5 puntos a los acertantes?")) return;
                const snap = await getDocs(collection(db, "apuestasExtra"));
                const batch = writeBatch(db);
                snap.forEach(d => { if(d.data().equipo === config.ascendido) batch.update(doc(db, "clasificacion", d.id), {puntosTotales: increment(5)}); });
                await batch.commit(); alert("Puntos repartidos.");
            }} style={{...styles.saveButton, backgroundColor: colors.gold, color: colors.deepBlue, marginTop:'20px', marginLeft:'10px'}}>Repartir +5 Pts Ascenso</button>
        </div>
    );
};

const AdminUserManager = ({ onBack }) => {
    const [selectedUser, setSelectedUser] = useState(''); const [message, setMessage] = useState('');
    const handleResetJokers = async () => { if (!selectedUser) return; if (window.confirm(`¿Reiniciar Jokers a ${selectedUser}?`)) { try { await setDoc(doc(db, "clasificacion", selectedUser), { jokersRestantes: 2 }, { merge: true }); setMessage(`Jokers reiniciados.`); } catch (error) { setMessage(`Error.`); } } };
    const handleResetPin = async () => { if (!selectedUser) return; const jId = prompt("ID de la jornada (ej: jornada_1):"); if (!jId) return; if (window.confirm(`¿Borrar PIN para ${jId}?`)) { try { await updateDoc(doc(db, "pronosticos", jId, "jugadores", selectedUser), { pin: "" }); setMessage(`PIN borrado.`); } catch (error) { setMessage(`Error.`); } } };
    return (<div style={styles.adminJornadaItem}><button onClick={onBack} style={styles.backButton}>&larr; Volver</button><h3 style={styles.formSectionTitle}>🔧 Gestión de Jugadores</h3><div style={styles.adminControls}><div><label style={styles.label}>Seleccionar Jugador</label><select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} style={styles.adminSelect}><option value="">-- Elige --</option>{JUGADORES.map(j => <option key={j} value={j}>{j}</option>)}</select></div></div><div style={{marginTop: '20px', display: 'flex', gap: '10px'}}><button onClick={handleResetJokers} disabled={!selectedUser} style={styles.saveButton}>Reiniciar Jokers</button><button onClick={handleResetPin} disabled={!selectedUser} style={{...styles.saveButton, backgroundColor: styles.colors.warning}}>Borrar PIN</button></div>{message && <p style={{...styles.message}}>{message}</p>}</div>);
};

const AdminNotifications = ({ onBack }) => {
    const [message, setMessage] = useState(''); const [customMessage, setCustomMessage] = useState(''); const [sending, setSending] = useState(false);
    const PRESET_MESSAGES = ["¡Nueva eliminatoria abierta! ¡Haz tu pronóstico!", "¡Últimas horas para apostar en el Playoff! ⏳", "Las apuestas se han cerrado. ¡Suerte a todos!", "¡Ya están los resultados! Comprueba si has ganado. 🏆"];
    const handleSendNotification = async (msgToSend) => { if (!msgToSend) return; setSending(true); setMessage(`Enviando...`); try { const sendGlobalNotification = httpsCallable(functions, 'sendGlobalNotification'); const result = await sendGlobalNotification({ message: msgToSend }); setMessage(`✅ ${result.data.message}`); } catch (error) { setMessage(`❌ Error: ${error.message}`); } finally { setSending(false); } };
    return (<div style={styles.adminJornadaItem}><button onClick={onBack} style={styles.backButton}>&larr; Volver</button><h3 style={styles.formSectionTitle}>📣 Notificaciones</h3><div style={styles.presetMessagesContainer}><label style={styles.label}>Mensajes predefinidos</label>{PRESET_MESSAGES.map((msg, i) => (<button key={i} onClick={() => handleSendNotification(msg)} disabled={sending} style={styles.presetMessageButton}>{msg}</button>))}</div><div style={{marginTop: '20px'}}><label style={styles.label}>Mensaje personalizado</label><textarea value={customMessage} onChange={(e) => setCustomMessage(e.target.value)} style={{...styles.input, width: '95%', height: '60px'}} /><button onClick={() => handleSendNotification(customMessage)} disabled={sending || !customMessage} style={{...styles.saveButton, marginTop: '10px'}}>{sending ? 'Enviando...' : 'Enviar'}</button></div>{message && <p style={{...styles.message}}>{message}</p>}</div>);
};

const AdminStatsRecalculator = ({ onBack }) => {
    const [isRecalculating, setIsRecalculating] = useState(false); const [message, setMessage] = useState('');
    const handleRecalculateBadges = async () => {
        if (!window.confirm("¿Recalcular insignias de LÍDER y RACHAS para todos?")) return;
        setIsRecalculating(true); setMessage("Recalculando...");
        try {
            const batch = writeBatch(db);
            const clasificacionSnap = await getDocs(query(collection(db, "clasificacion"), orderBy("puntosTotales", "desc")));
            const clasificacionData = clasificacionSnap.docs.map(d => ({id: d.id, ...d.data()}));
            const qJornadas = query(collection(db, "jornadas"), where("estado", "==", "Finalizada"), orderBy("numeroJornada", "desc"), limit(3));
            const jornadasSnap = await getDocs(qJornadas); const ultimasJornadasIds = jornadasSnap.docs.map(d => d.id);
            const limpiezaBatch = writeBatch(db);
            for(const jugador of clasificacionData) { const jugadorRef = doc(db, "clasificacion", jugador.id); const currentBadges = new Set(jugador.badges || []); ['lider_general', 'en_racha', 'mala_racha'].forEach(b => currentBadges.delete(b)); limpiezaBatch.update(jugadorRef, { badges: Array.from(currentBadges) }); }
            await limpiezaBatch.commit();
            for (let i = 0; i < clasificacionData.length; i++) {
                const jugador = clasificacionData[i]; const jugadorRef = doc(db, "clasificacion", jugador.id); const jugadorSnap = await getDoc(jugadorRef); const currentBadges = new Set(jugadorSnap.exists() ? jugadorSnap.data().badges : []);
                if (i === 0 && clasificacionData.length > 0) { if(jugador.puntosTotales === clasificacionData[0].puntosTotales) currentBadges.add('lider_general'); }
                if (ultimasJornadasIds.length === 3) {
                    const pronosticosPromises = ultimasJornadasIds.map(jId => getDoc(doc(db, "pronosticos", jId, "jugadores", jugador.id)));
                    const pronosticosSnaps = await Promise.all(pronosticosPromises);
                    if (pronosticosSnaps.every(snap => snap.exists())) { const puntosRacha = pronosticosSnaps.map(snap => snap.data().puntosObtenidos || 0); if (puntosRacha.every(p => p > 0)) currentBadges.add('en_racha'); if (puntosRacha.every(p => p === 0)) currentBadges.add('mala_racha'); }
                }
                batch.update(jugadorRef, { badges: Array.from(currentBadges) });
            }
            await batch.commit(); setMessage("¡Insignias recalculadas!");
        } catch (error) { setMessage("Error al recalcular."); } setIsRecalculating(false);
    };
    return (<div style={styles.adminJornadaItem}><button onClick={onBack} style={styles.backButton}>&larr; Volver</button><h3 style={styles.formSectionTitle}>⚙️ Herramientas de Datos</h3><div style={{...styles.recalculatorContainer, textAlign: 'center', marginBottom: '20px'}}><h4>Recalcular Insignias</h4><button onClick={handleRecalculateBadges} disabled={isRecalculating} style={{...styles.saveButton, backgroundColor: styles.colors.blue}}>{isRecalculating ? 'Calculando...' : 'Recalcular Insignias'}</button></div>{message && <p style={{...styles.message}}>{message}</p>}</div>);
};

const AdminPanelScreen = ({ teamLogos, plantilla, setPlantilla }) => {
    const [jornadas, setJornadas] = useState([]); const [loading, setLoading] = useState(true); const [adminView, setAdminView] = useState('jornadas');
    useEffect(() => { const unsub = onSnapshot(query(collection(db, "jornadas"), orderBy("numeroJornada")), (snap) => { setJornadas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); setLoading(false); }); return () => unsub(); }, []);
    const renderAdminContent = () => {
        switch (adminView) {
            case 'jornadas': return (<div><AdminTestJornada /><h3 style={{...styles.title, fontSize: '1.5rem', marginTop: '40px'}}>Gestión de Eliminatorias</h3><div style={styles.jornadaList}>{jornadas.map(j => (<JornadaAdminItem key={j.id} jornada={j} plantilla={plantilla} />))}</div></div>);
            case 'escudos': return <AdminEscudosManager onBack={() => setAdminView('jornadas')} teamLogos={teamLogos} />;
            case 'plantilla': return <AdminPlantillaManager onBack={() => setAdminView('jornadas')} plantilla={plantilla} setPlantilla={setPlantilla} />;
            case 'playoff': return <AdminPlayoffPanel onBack={() => setAdminView('jornadas')} />;
            case 'usuarios': return <AdminUserManager onBack={() => setAdminView('jornadas')} />;
            case 'notificaciones': return <AdminNotifications onBack={() => setAdminView('jornadas')} />;
            case 'herramientas': return <AdminStatsRecalculator onBack={() => setAdminView('jornadas')} />;
            default: return null;
        }
    };
    if (loading) return <LoadingSkeleton />;
    return (<div><h2 style={styles.title} className="app-title">PANEL DE ADMINISTRADOR</h2><div style={styles.adminNav}><button onClick={() => setAdminView('jornadas')} style={styles.adminNavButton}>Jornadas</button><button onClick={() => setAdminView('plantilla')} style={styles.adminNavButton}>Plantilla</button><button onClick={() => setAdminView('escudos')} style={styles.adminNavButton}>Escudos</button><button onClick={() => setAdminView('playoff')} style={styles.adminNavButton}>El Camino (Cuadro)</button><button onClick={() => setAdminView('usuarios')} style={styles.adminNavButton}>Usuarios</button><button onClick={() => setAdminView('notificaciones')} style={styles.adminNavButton}>Notificaciones</button><button onClick={() => setAdminView('herramientas')} style={styles.adminNavButton}>Herramientas</button></div>{renderAdminContent()}</div>);
};

const AdminLoginModal = ({ onClose, onSuccess }) => {
    const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState('');
    const handleSubmit = async (e) => { e.preventDefault(); setError(''); try { await signInWithEmailAndPassword(auth, email, password); onSuccess(); } catch (err) { setError('Error de acceso.'); } };
    return (<div style={styles.modalOverlay}><div style={styles.modalContent}><h3 style={styles.title}>ACCESO ADMIN</h3><form onSubmit={handleSubmit}><div style={styles.formGroup}><label style={styles.label}>Email:</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={styles.input} required /></div><div style={styles.formGroup}><label style={styles.label}>Contraseña:</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={styles.input} required /></div>{error && <p style={{color: styles.colors.danger, textAlign: 'center'}}>{error}</p>}<div style={{display: 'flex', justifyContent: 'space-between', marginTop: '20px'}}><button type="button" onClick={onClose} style={{...styles.mainButton, backgroundColor: styles.colors.blue}}>CANCELAR</button><button type="submit" style={styles.mainButton}>ENTRAR</button></div></form></div></div>);
};

const PagosScreen = ({ user, userProfiles }) => {
    const [jornadas, setJornadas] = useState([]); const [loading, setLoading] = useState(true); const [financialSummary, setFinancialSummary] = useState({ boteActual: 0, totalRecaudado: 0, totalRepartido: 0 }); const [debtSummary, setDebtSummary] = useState({});
    useEffect(() => {
        const unsub = onSnapshot(query(collection(db, "jornadas"), orderBy("numeroJornada")), (jornadasSnap) => {
            const jornadasData = jornadasSnap.docs.map(jDoc => ({ id: jDoc.id, ...jDoc.data() }));
            const promises = jornadasData.map(j => getDocs(collection(db, "pronosticos", j.id, "jugadores")));
            Promise.all(promises).then(pSnaps => {
                let totalRec = 0; let totalRep = 0; const newDebt = {}; JUGADORES.forEach(j => newDebt[j] = 0);
                const jConP = jornadasData.map((j, index) => {
                    const pronosticos = pSnaps[index].docs.map(doc => ({id: doc.id, ...doc.data()}));
                    const coste = j.esVip ? APUESTA_VIP : APUESTA_NORMAL;
                    const rec = pronosticos.length * coste; const premio = (j.bote || 0) + rec;
                    if (j.estado === 'Finalizada') {
                        totalRec += rec; if (j.ganadores && j.ganadores.length > 0) totalRep += premio;
                        pronosticos.forEach(p => { if (!p.pagado) newDebt[p.id] += coste; });
                    }
                    return { ...j, pronosticos, recaudadoJornada: rec, premioTotal: premio };
                });
                const ultBote = jConP.slice().reverse().find(j => j.bote > 0);
                setFinancialSummary({ boteActual: ultBote ? ultBote.bote : 0, totalRecaudado: totalRec, totalRepartido: totalRep });
                setJornadas(jConP); setDebtSummary(newDebt); setLoading(false);
            });
        }); return () => unsub();
    }, []);

    if (loading) return <LoadingSkeleton type="table" />;
    const isTesorero = TESOREROS_AUTORIZADOS.includes(user);

    return (<div><h2 style={styles.title} className="app-title">LIBRO DE CUENTAS</h2><div style={styles.statsGrid}><div style={styles.statCard}><div style={styles.statValue}>💰 {financialSummary.boteActual.toFixed(2)}€</div><div style={styles.statLabel}>Bote Acumulado</div></div><div style={styles.statCard}><div style={styles.statValue}>📥 {financialSummary.totalRecaudado.toFixed(2)}€</div><div style={styles.statLabel}>Total Recaudado</div></div><div style={styles.statCard}><div style={styles.statValue}>📤 {financialSummary.totalRepartido.toFixed(2)}€</div><div style={styles.statLabel}>Total Repartido</div></div></div>
    <div style={styles.debtSummaryContainer}><h3 style={styles.formSectionTitle} className="app-title">Estado de Cuentas por Jugador</h3><div style={styles.debtGrid}>{Object.entries(debtSummary).map(([jugador, deuda]) => (<div key={jugador} style={deuda > 0 ? styles.debtItemOwes : styles.debtItemPaid}><PlayerProfileDisplay name={jugador} profile={userProfiles[jugador]} /><span>{deuda.toFixed(2)}€</span></div>))}</div></div>
    <div style={{marginTop: '40px'}}>{jornadas.filter(j => j.estado === 'Finalizada').reverse().map(j => {
        const jConBote = j.ganadores?.length === 0;
        return (<div key={j.id} style={styles.pagoCard}><h4 style={styles.pagoCardTitle} className="app-title">Jornada {j.numeroJornada}: {j.equipoLocal} vs {j.equipoVisitante}</h4><div style={styles.pagoCardDetails}><span><strong>Recaudado:</strong> {j.recaudadoJornada}€</span><span><strong>Bote Anterior:</strong> {j.bote || 0}€</span><span><strong>Premio Total:</strong> {j.premioTotal}€</span></div>{jConBote ? (<div style={styles.pagoCardBoteInfo}>💰 BOTE ACUMULADO. El premio pasa a la siguiente jornada.</div>) : (<div style={styles.pagoCardWinnerInfo}><p><strong>🏆 Ganador(es):</strong> {j.ganadores.join(', ')}</p><p><strong>Premio por ganador:</strong> {(j.premioTotal / j.ganadores.length).toFixed(2)}€</p></div>)}<table style={{...styles.table, marginTop: '15px'}}><thead><tr><th style={styles.th}>Jugador</th><th style={styles.th}>Aportación</th>{jConBote ? null : j.ganadores && j.ganadores.length > 0 && <th style={styles.th}>Premio Cobrado</th>}</tr></thead><tbody>{j.pronosticos.map(p => { const esG = j.ganadores?.includes(p.id); const tRes = getTesoreroResponsable(p.id); return (<tr key={p.id} style={styles.tr}><td style={styles.td}><PlayerProfileDisplay name={p.id} profile={userProfiles[p.id]} />{jConBote ? null : tRes && <span style={styles.tesoreroTag}>Paga a: {tRes}</span>}</td><td style={styles.td}>{jConBote ? <span style={{fontWeight: 'bold', color: styles.colors.danger}}>ACUMULA</span> : <input type="checkbox" checked={p.pagado || false} onChange={(e) => updateDoc(doc(db,"pronosticos",j.id,"jugadores",p.id),{pagado:e.target.checked})} disabled={!isTesorero} style={styles.checkbox}/>}</td>{esG && (<td style={styles.td}><input type="checkbox" checked={p.premioCobrado || false} onChange={(e) => updateDoc(doc(db,"pronosticos",j.id,"jugadores",p.id),{premioCobrado:e.target.checked})} disabled={!isTesorero} style={styles.checkbox}/></td>)}</tr>); })}</tbody></table></div>)})}</div></div>);
};

const ProfileCustomizationScreen = ({ user, onSave, userProfile }) => {
    const [selectedColor, setSelectedColor] = useState(userProfile.color || PROFILE_COLORS[0]); const [selectedIcon, setSelectedIcon] = useState(userProfile.icon || PROFILE_ICONS[0]); const [isSaving, setIsSaving] = useState(false);
    const handleSave = async () => { setIsSaving(true); await onSave(user, { color: selectedColor, icon: selectedIcon }); };
    return (<div style={styles.profileCustomizationContainer}><h2 style={styles.title} className="app-title">¡BIENVENIDO, {user}!</h2><p style={{textAlign: 'center', marginBottom: '30px', fontSize: '1.1rem'}}>Personaliza tu perfil para que todos te reconozcan.</p><div style={styles.formGroup}><label style={styles.label}>1. ELIGE TU COLOR</label><div style={styles.colorGrid}>{PROFILE_COLORS.map(color => { const isGradient = typeof color === 'string' && color.startsWith('linear-gradient'); const style = { ...styles.colorOption, ...(isGradient ? { background: color } : { backgroundColor: color }), ...(selectedColor === color ? styles.colorOptionSelected : {}) }; return (<div key={color} style={style} onClick={() => setSelectedColor(color)} />); })}</div></div><div style={styles.formGroup}><label style={styles.label}>2. ELIGE TU ICONO</label><div style={styles.iconGrid}>{PROFILE_ICONS.map(icon => (<div key={icon} style={{...styles.iconOption, ...(selectedIcon === icon ? styles.iconOptionSelected : {})}} onClick={() => setSelectedIcon(icon)}>{icon}</div>))}</div></div><div style={{textAlign: 'center', marginTop: '40px'}}><p style={{fontSize: '1.2rem', marginBottom: '10px'}}>Así se verá tu perfil:</p><PlayerProfileDisplay name={user} profile={{ color: selectedColor, icon: selectedIcon }} style={styles.profilePreview} /></div><button onClick={handleSave} disabled={isSaving} style={{...styles.mainButton, width: '100%'}}>{isSaving ? 'GUARDANDO...' : 'GUARDAR Y ENTRAR'}</button></div>);
};

const ProfileScreen = ({ user, userProfile, onEdit, onBack, allJornadas, userProfiles }) => {
    const [stats, setStats] = useState(null); const [loadingStats, setLoadingStats] = useState(true); const [showHistorial, setShowHistorial] = useState(false);
    useEffect(() => {
        const calculateStats = async () => {
            setLoadingStats(true);
            const jornadasSnap = await getDocs(query(collection(db, "jornadas"), where("estado", "==", "Finalizada")));
            const jornadas = jornadasSnap.docs.map(d => ({id: d.id, ...d.data()}));
            const pPromises = jornadas.map(j => getDoc(doc(db, "pronosticos", j.id, "jugadores", user)));
            const pSnaps = await Promise.all(pPromises);
            const pronosticos = pSnaps.map((snap, i) => snap.exists() ? { ...snap.data(), jornadaId: jornadas[i].id, numeroJornada: jornadas[i].numeroJornada } : null).filter(Boolean);
            if (pronosticos.length === 0) { setStats({ porrasGanadas: 0, plenos: 0, goleadorFavorito: '-', rachaPuntuando: 0 }); setLoadingStats(false); return; }
            const porrasGanadas = jornadas.filter(j => j.ganadores?.includes(user)).length;
            const plenos = pronosticos.filter(p => p.puntosObtenidos >= 3).length;
            const goleadores = pronosticos.map(p => p.goleador).filter(Boolean);
            const gCounts = goleadores.reduce((acc, val) => ({...acc, [val]: (acc[val] || 0) + 1}), {});
            const goleadorFavorito = Object.keys(gCounts).length > 0 ? Object.entries(gCounts).sort((a,b) => b[1] - a[1])[0][0] : '-';
            let rachaPuntuando = 0;
            const pOrd = pronosticos.sort((a,b) => b.numeroJornada - a.numeroJornada);
            for (const p of pOrd) { if (p.puntosObtenidos > 0) { rachaPuntuando++; } else { break; } }
            setStats({ porrasGanadas, plenos, goleadorFavorito, rachaPuntuando }); setLoadingStats(false);
        }; calculateStats();
    }, [user]);

    const finalStats = { jokersUsados: userProfile.jokersRestantes !== undefined ? 2 - userProfile.jokersRestantes : 0, ...(stats || {}) };
    return (<div>{showHistorial && <HistorialCompletoModal user={user} allJornadas={allJornadas} userProfiles={userProfiles} onClose={() => setShowHistorial(false)} />}<button onClick={onBack} style={styles.backButton}>&larr; Volver</button><h2 style={styles.title}><PlayerProfileDisplay name={user} profile={userProfile} style={{fontSize: '2rem'}} /></h2>{loadingStats ? <LoadingSkeleton /> : (<div style={styles.statsGrid}><div style={styles.statCard}><div style={styles.statValue}>🏆 {finalStats.porrasGanadas}</div><div style={styles.statLabel}>Porras Ganadas</div></div><div style={styles.statCard}><div style={styles.statValue}>🎯 {finalStats.plenos}</div><div style={styles.statLabel}>Plenos Conseguidos</div></div><div style={styles.statCard}><div style={styles.statValue}>⚽️ {finalStats.goleadorFavorito}</div><div style={styles.statLabel}>Goleador Favorito</div></div><div style={styles.statCard}><div style={styles.statValue}>🔥 {finalStats.rachaPuntuando}</div><div style={styles.statLabel}>Racha Puntuando</div></div><div style={styles.statCard}><div style={styles.statValue}>🃏 {finalStats.jokersUsados} / 2</div><div style={styles.statLabel}>Jokers Usados</div></div></div>)}<div style={{display: 'flex', gap: '10px', marginTop: '40px'}}><button onClick={onEdit} style={{...styles.mainButton, flex: 1}}>Editar Perfil</button><button onClick={() => setShowHistorial(true)} style={{...styles.mainButton, flex: 1, backgroundColor: styles.colors.blue, borderColor: styles.colors.blue}}>Ver Historial de Puntos</button></div></div>);
};

// ============================================================================
// --- COMPONENTE PRINCIPAL APP ---
// ============================================================================

function App() {
  const [showInitialSplash, setShowInitialSplash] = useState(true);
  const [screen, setScreen] = useState('splash');
  const [activeTab, setActiveTab] = useState('miJornada');
  const [currentUser, setCurrentUser] = useState(null);
  const [viewingJornada, setViewingJornada] = useState({ id: null, type: null }); 
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [teamLogos, setTeamLogos] = useState({});
  const [winnerData, setWinnerData] = useState(null);
  const [liveJornada, setLiveJornada] = useState(null);
  const [plantilla, setPlantilla] = useState(PLANTILLA_ACTUALIZADA);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [userProfiles, setUserProfiles] = useState({});
  const [onlineUsers, setOnlineUsers] = useState({});
  const [isVipActive, setIsVipActive] = useState(false);
  const [clasificacionData, setClasificacionData] = useState([]); 
  const [fameStats, setFameStats] = useState(null); 
  const [allJornadas, setAllJornadas] = useState([]); 
  const anonymousUserRef = useRef(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => { 
        if (user && !user.isAnonymous) setIsAdminAuthenticated(true);
        else if (user && user.isAnonymous) { anonymousUserRef.current = user; setIsAdminAuthenticated(false); }
        else signInAnonymously(auth).catch((error) => console.error("Error Auth:", error));
    });
    const styleSheet = document.createElement("style"); 
    styleSheet.innerText = `
        @import url('https://fonts.googleapis.com/css2?family=Teko:wght@700&family=Orbitron&family=Exo+2&family=Russo+One&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { font-size: 16px !important; -webkit-text-size-adjust: 100%; }
        body, #root { width: 100%; min-width: 100%; overflow-x: hidden; background-color: ${colors.deepBlue}; }
        .vip-active { --glow-color: ${colors.gold}; --main-color: ${colors.gold}; --secondary-color: ${colors.yellow}; }
        .vip-active #app-container { border-color: var(--glow-color); box-shadow: 0 0 30px var(--glow-color), inset 0 0 15px var(--glow-color); }
        .vip-active .app-title, .vip-active h3, .vip-active h4 { color: var(--main-color); text-shadow: 0 0 8px var(--glow-color); }
        .vip-active .navbar { border-bottom-color: var(--main-color); }
        .vip-active .nav-button-active { border-bottom-color: var(--secondary-color); color: var(--secondary-color); }
        .vip-active .main-button { background-color: var(--main-color); border-color: var(--secondary-color); box-shadow: 0 0 20px var(--glow-color); animation: vip-pulse 2s infinite; }
        @keyframes vip-pulse { 0% { box-shadow: 0 0 15px ${colors.gold}50; } 50% { box-shadow: 0 0 25px ${colors.gold}90; } 100% { box-shadow: 0 0 15px ${colors.gold}50; } }
        @keyframes champion-glow { 0%, 100% { text-shadow: 0 0 8px ${colors.gold}, 0 0 15px ${colors.gold}; } 50% { text-shadow: 0 0 12px ${colors.gold}, 0 0 25px ${colors.gold}; } }
        @keyframes pleno-flash { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.15); } }
        @keyframes leader-glow { 0%, 100% { background-color: rgba(255, 215, 0, 0.15); box-shadow: inset 0 0 15px rgba(255, 215, 0, 0.5), 0 0 10px rgba(255, 215, 0, 0.3); } 50% { background-color: rgba(255, 215, 0, 0.25); box-shadow: inset 0 0 20px rgba(255, 215, 0, 0.7), 0 0 15px rgba(255, 215, 0, 0.5); } }
        @keyframes fire-streak-animation { 0%, 100% { text-shadow: 0 0 5px #fca311, 0 0 10px #e63946; } 50% { text-shadow: 0 0 10px #fca311, 0 0 20px #e63946; } }
        @keyframes cold-streak-animation { 0%, 100% { text-shadow: 0 0 8px #00aaff, 0 0 15px #00aaff, 0 0 20px #00aaff80; } 50% { text-shadow: 0 0 12px #00aaff, 0 0 25px #00aaff, 0 0 30px #00aaff80; } }
        @keyframes fall { 0% { transform: translateY(-100px) rotate(0deg); opacity: 1; } 100% { transform: translateY(100vh) rotate(360deg); opacity: 0; } }
        .exploded { transition: transform 1s ease-out, opacity 1s ease-out; }
        @keyframes trophy-grow { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes text-fade-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes slideInFromRight { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        .content-enter-active { animation: slideInFromRight 0.4s ease-out; }
        @keyframes pop-in { 0% { opacity: 0; transform: scale(0.8); } 100% { opacity: 1; transform: scale(1); } }
        .stats-indicator { animation: pop-in 0.5s cubic-bezier(0.25, 1, 0.5, 1) forwards; }
        @keyframes confetti-fall { 0% { transform: translateY(-100vh) rotate(0deg); } 100% { transform: translateY(100vh) rotate(var(--angle)); } }
        .confetti-particle { position: absolute; width: var(--size); height: var(--size); background-color: var(--color); top: 0; left: var(--x); animation: confetti-fall 5s linear var(--delay) infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spinner { animation: spin 1.5s linear infinite; }
        @keyframes title-shine { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        @keyframes blink-live { 50% { background-color: #8b0000; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes point-jump-up { 0% { transform: translateY(0); color: ${colors.lightText}; } 50% { transform: translateY(-10px) scale(1.2); color: ${colors.success}; } 100% { transform: translateY(0); color: ${colors.lightText}; } }
        .point-jump-up { animation: point-jump-up 0.7s ease-out; }
        @keyframes pie-draw { to { stroke-dashoffset: 0; } }
        .pie-chart-segment-new { transform-origin: 60px 60px; stroke-dasharray: var(--stroke-dasharray); stroke-dashoffset: var(--stroke-dasharray); transform: rotate(var(--rotation)); animation: pie-draw 1s ease-out forwards; }
        @keyframes reaction-fade-out { to { opacity: 0; transform: scale(0.5); } }
        .fade-out { animation: reaction-fade-out 0.5s forwards; }
        @keyframes reaction-fly { 0% { transform: translate(0, 0) scale(1.2); opacity: 1; } 100% { transform: translate(80px, -80px) scale(0); opacity: 0; } }
        .fly-away { display: inline-block; animation: reaction-fly 1s cubic-bezier(0.5, -0.5, 1, 1) forwards; position: absolute; z-index: 10; pointer-events: none; }
        @keyframes status-blink-red { 0%, 100% { background-color: ${colors.danger}; box-shadow: 0 0 8px ${colors.danger}; } 50% { background-color: #a11d27; box-shadow: 0 0 15px ${colors.danger}; } }
        @keyframes status-pulse-green { 0%, 100% { background-color: ${colors.success}; box-shadow: 0 0 5px ${colors.success}; } 50% { background-color: #3a9a6a; box-shadow: 0 0 10px ${colors.success}; } }
        @keyframes silver-glow { 0%, 100% { background-color: rgba(192, 192, 192, 0.15); box-shadow: inset 0 0 15px rgba(192, 192, 192, 0.5), 0 0 10px rgba(192, 192, 192, 0.3); } 50% { background-color: rgba(192, 192, 192, 0.25); box-shadow: inset 0 0 20px rgba(192, 192, 192, 0.7), 0 0 15px rgba(192, 192, 192, 0.5); } }
        @keyframes bronze-glow { 0%, 100% { background-color: rgba(205, 127, 50, 0.15); box-shadow: inset 0 0 15px rgba(205, 127, 50, 0.5), 0 0 10px rgba(205, 127, 50, 0.3); } 50% { background-color: rgba(205, 127, 50, 0.25); box-shadow: inset 0 0 20px rgba(205, 127, 50, 0.7), 0 0 15px rgba(205, 127, 50, 0.5); } }
    `;
    document.head.appendChild(styleSheet);
    
    const unsubEscudos = onSnapshot(doc(db, "configuracion", "escudos"), (docSnap) => { if (docSnap.exists()) { setTeamLogos(docSnap.data()); } });
    const unsubLive = onSnapshot(query(collection(db, "jornadas"), where("estado", "==", "En vivo"), limit(1)), (snapshot) => { 
        if (!snapshot.empty) { const jornada = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() }; setLiveJornada(jornada); setIsVipActive(jornada.esVip || false); } 
        else { setLiveJornada(null); onSnapshot(query(collection(db, "jornadas"), where("estado", "in", ["Abierta", "Pre-apertura"]), limit(1)), (snapAbierta) => { if(!snapAbierta.empty) setIsVipActive(snapAbierta.docs[0].data().esVip || false); else setIsVipActive(false); }); } 
    });
    const unsubPlantilla = onSnapshot(doc(db, "configuracion", "plantilla"), (docSnap) => { if (docSnap.exists() && docSnap.data().jugadores?.length > 0) { setPlantilla(docSnap.data().jugadores); } });
    const unsubClasificacion = onSnapshot(collection(db, "clasificacion"), (snapshot) => { 
        const profiles = {}; const clasificacion = []; snapshot.forEach(doc => { const data = doc.data(); profiles[doc.id] = data; clasificacion.push({id: doc.id, ...data}); }); setUserProfiles(profiles); setClasificacionData(clasificacion.sort((a,b) => (b.puntosTotales || 0) - (a.puntosTotales || 0)));
    });
    const unsubStatus = onValue(ref(rtdb, 'status/'), (snapshot) => { setOnlineUsers(snapshot.val() || {}); });
    const unsubFameStats = onSnapshot(doc(db, "estadisticas", "globales"), (docSnap) => { if (docSnap.exists()) { setFameStats(docSnap.data()); } });
    const unsubAllJornadas = onSnapshot(query(collection(db, "jornadas"), orderBy("numeroJornada")), (snapshot) => { setAllJornadas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); });

    return () => { document.head.removeChild(styleSheet); unsubscribeAuth(); unsubEscudos(); unsubLive(); unsubPlantilla(); unsubClasificacion(); unsubStatus(); unsubFameStats(); unsubAllJornadas(); }
  }, []);
  
  const handleRequestPermission = async (user) => {
      setShowNotificationModal(false); localStorage.setItem('notificationPrompt_v3_seen', 'true'); 
      try {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
              const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
              if (currentToken) await setDoc(doc(db, "notification_tokens", currentToken), { user: user, createdAt: new Date() });
          }
      } catch (error) { console.error('Error al obtener token de notificación.', error); }
  };
  
  const handleLogin = async (user) => {
    try {
      setCurrentUser(user);
      const userStatusRef = ref(rtdb, 'status/' + user);
      await set(userStatusRef, true); onDisconnect(userStatusRef).set(false);
      const userProfileRef = doc(db, "clasificacion", user);
      await setDoc(userProfileRef, { ultimaConexion: new Date() }, { merge: true });

      const docSnap = await getDoc(userProfileRef);
      if (docSnap.exists() && docSnap.data().icon && docSnap.data().color) setScreen('app'); else setScreen('customizeProfile');
      
      if ('Notification' in window && Notification.permission !== 'granted' && !localStorage.getItem('notificationPrompt_v3_seen')) setShowNotificationModal(true);
      
      const q = query(collection(db, "jornadas"), where("estado", "==", "Finalizada"), orderBy("numeroJornada", "desc"), limit(1));
      const jornadaSnap = await getDocs(q);
      if (!jornadaSnap.empty) {
          const jornadaDoc = jornadaSnap.docs[0]; const jornada = { id: jornadaDoc.id, ...jornadaDoc.data() };
          if (jornada.id !== sessionStorage.getItem('lastSeenWinnerJornada') && jornada.ganadores?.includes(user)) {
              const pronosticoSnap = await getDoc(doc(db, "pronosticos", jornada.id, "jugadores", user));
              const allPronosticosSnap = await getDocs(collection(db, "pronosticos", jornada.id, "jugadores"));
              const prize = (allPronosticosSnap.size * (jornada.esVip ? APUESTA_VIP : APUESTA_NORMAL)) + (jornada.bote || 0);
              if (pronosticoSnap.exists()) { setWinnerData({ pronostico: { id: user, ...pronosticoSnap.data() }, prize: prize / jornada.ganadores.length }); sessionStorage.setItem('lastSeenWinnerJornada', jornada.id); }
          }
      }
    } catch (error) { alert("Error al iniciar sesión."); }
  };

  const handleLogout = async () => { if (currentUser) set(ref(rtdb, 'status/' + currentUser), false); if (isAdminAuthenticated) { await signOut(auth); await signInAnonymously(auth); } setCurrentUser(null); setScreen('login'); setIsAdminAuthenticated(false); };
  const handleSaveProfile = async (user, profileData) => { await setDoc(doc(db, "clasificacion", user), profileData, { merge: true }); setScreen('app'); setActiveTab('miJornada'); };
  const handleNavClick = (tab) => { setViewingJornada({ id: null, type: null }); setActiveTab(tab); if (tab !== 'admin' && isAdminAuthenticated) { signOut(auth).then(() => signInAnonymously(auth)); } };
  const handleAdminClick = () => { if (isAdminAuthenticated) setActiveTab('admin'); else setShowAdminLogin(true); };
  const handleAdminLoginSuccess = () => { setIsAdminAuthenticated(true); setShowAdminLogin(false); setActiveTab('admin'); };
  const handleViewJornada = (jornadaId, type) => { if (type === 'historico') { setViewingJornada({ id: jornadaId, type: 'historico' }); } else { setViewingJornada({ id: jornadaId, type: 'detalle' }); } };

  const renderContent = () => {
    if (showInitialSplash) return <InitialSplashScreen onFinish={() => setShowInitialSplash(false)} />;
    if (screen === 'splash') return <SplashScreen onEnter={() => setScreen('login')} teamLogos={teamLogos} plantilla={plantilla} fameStats={fameStats} />;
    if (screen === 'login') return <LoginScreen onLogin={handleLogin} userProfiles={userProfiles} onlineUsers={onlineUsers} />;
    if (screen === 'customizeProfile') return <ProfileCustomizationScreen user={currentUser} onSave={handleSaveProfile} userProfile={userProfiles[currentUser] || {}} />;
    if (screen === 'app') {
        const isLive = liveJornada?.liveData?.isLive; const onlineCount = Object.values(onlineUsers).filter(Boolean).length; const showGreenStatus = !isLive && onlineCount > 1;

        const CurrentScreen = () => {
            if (viewingJornada.id) {
                if (viewingJornada.type === 'historico') return <JornadaHistoricoScreen jornadaId={viewingJornada.id} onBack={() => setViewingJornada({ id: null, type: null })} teamLogos={teamLogos} userProfiles={userProfiles} />;
                return <LaJornadaScreen jornadaId={viewingJornada.id} onBack={() => setViewingJornada({ id: null, type: null })} teamLogos={teamLogos} userProfiles={userProfiles} />; // Reuso de LaJornada o el Detalle
            }
            if (activeTab === 'profile') return <ProfileScreen user={currentUser} userProfile={userProfiles[currentUser]} onEdit={() => setScreen('customizeProfile')} onBack={() => setActiveTab('miJornada')} allJornadas={allJornadas} userProfiles={userProfiles} />;
            
            switch (activeTab) {
                case 'miJornada': return <MiJornadaScreen user={currentUser} setActiveTab={handleNavClick} teamLogos={teamLogos} liveData={liveJornada?.liveData} plantilla={plantilla} userProfiles={userProfiles} />;
                case 'laJornada': return <LaJornadaScreen user={currentUser} teamLogos={teamLogos} liveData={liveJornada?.liveData} userProfiles={userProfiles} onlineUsers={onlineUsers} clasificacionData={clasificacionData} />;
                case 'elCamino': return <ElCaminoScreen user={currentUser} userProfiles={userProfiles} />;
                case 'calendario': return <CalendarioScreen onViewJornada={handleViewJornada} teamLogos={teamLogos} />;
                case 'clasificacion': return <ClasificacionScreen currentUser={currentUser} liveData={liveJornada?.liveData} liveJornada={liveJornada} userProfiles={userProfiles} />;
                case 'ligaRegular': return <LigaRegularScreen userProfiles={userProfiles} />;
                case 'pagos': return <PagosScreen user={currentUser} userProfiles={userProfiles} />;
                case 'estadisticas': return <EstadisticasScreen />;
                case 'admin': return isAdminAuthenticated ? <AdminPanelScreen teamLogos={teamLogos} plantilla={plantilla} setPlantilla={setPlantilla} /> : null;
                default: return null;
            }
        };
      return (<>{showAdminLogin && <AdminLoginModal onClose={() => setShowAdminLogin(false)} onSuccess={handleAdminLoginSuccess} />}{showNotificationModal && <NotificationPermissionModal onAllow={() => handleRequestPermission(currentUser)} onDeny={() => {setShowNotificationModal(false); localStorage.setItem('notificationPrompt_v3_seen', 'true');}} />}<LiveBanner liveData={liveJornada?.liveData} jornada={liveJornada} />
      <nav style={styles.navbar} className="navbar">
        <button onClick={() => handleNavClick('miJornada')} style={activeTab === 'miJornada' ? styles.navButtonActive : styles.navButton}>Mi Jornada</button>
        <button onClick={() => handleNavClick('laJornada')} style={activeTab === 'laJornada' ? styles.navButtonActive : styles.navButton}><div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>{isLive && <span style={styles.statusIndicatorRed}></span>}{showGreenStatus && <span style={styles.statusIndicatorGreen}></span>}La Jornada</div></button>
        <button onClick={() => handleNavClick('elCamino')} style={activeTab === 'elCamino' ? styles.navButtonActive : styles.navButton}>El Camino</button>
        <button onClick={() => handleNavClick('calendario')} style={activeTab === 'calendario' ? styles.navButtonActive : styles.navButton}>Calendario</button>
        <button onClick={() => handleNavClick('clasificacion')} style={activeTab === 'clasificacion' ? styles.navButtonActive : styles.navButton}>Clasificación</button>
        <button onClick={() => handleNavClick('ligaRegular')} style={activeTab === 'ligaRegular' ? styles.navButtonActive : styles.navButton}>Liga Reg.</button>
        <button onClick={() => handleNavClick('pagos')} style={activeTab === 'pagos' ? styles.navButtonActive : styles.navButton}>Pagos</button>
        <button onClick={() => handleNavClick('estadisticas')} style={activeTab === 'estadisticas' ? styles.navButtonActive : styles.navButton}>Stats</button>
        {currentUser === 'Juanma' && (<button onClick={handleAdminClick} style={activeTab === 'admin' ? styles.navButtonActive : styles.navButton}>Admin</button>)}
        <button onClick={() => handleNavClick('profile')} style={styles.profileNavButton}><PlayerProfileDisplay name={currentUser} profile={userProfiles[currentUser]} /></button>
        <button onClick={handleLogout} style={styles.logoutButton}>Salir</button>
      </nav>
      <div key={activeTab} className="content-enter-active" style={styles.content}><CurrentScreen /></div></>);
    }
  };
  return (<>{winnerData && <WinnerAnimation winnerData={winnerData} onClose={() => setWinnerData(null)} />}<div id="app-container" className={isVipActive ? 'vip-active' : ''} style={styles.container}><div style={styles.card} id="app-card">{renderContent()}</div></div></>);
}

export default App;