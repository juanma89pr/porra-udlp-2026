import React, { useState, useEffect, useMemo, useRef } from 'react';
// Importamos las funciones necesarias de Firebase
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
// MODIFICADO: Se añade 'runTransaction' y 'serverTimestamp'
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

// --- INICIALIZACIÓN DE FIREBASE ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const messaging = getMessaging(app);
const rtdb = getDatabase(app);
const functions = getFunctions(app);

// --- CLAVES DE APIs EXTERNAS ---
const VAPID_KEY = "AQUÍ_VA_LA_CLAVE_LARGA_QUE_COPIASTE";
// API Key para API-Football
const API_FOOTBALL_KEY = "8984843ec9df5109e0bc0ddb700f3848";


// --- DATOS DE LA APLICACIÓN ---
const JUGADORES = ["Juanma", "Lucy", "Antonio", "Mari", "Pedro", "Pedrito", "Himar", "Sarito", "Vicky", "Carmelo", "Laura", "Carlos", "José", "Claudio", "Javi"];
const APUESTA_NORMAL = 1;
const APUESTA_VIP = 2;

// NUEVO: Tesoreros autorizados y grupos de pago
const TESOREROS_AUTORIZADOS = ['Juanma', 'Laura', 'Mari'];
const GRUPOS_PAGOS = {
    'Juanma': ["Juanma", "Lucy", "Antonio"],
    'Laura': ["Laura", "Carlos", "José", "Javi", "Vicky", "Carmelo"],
    'Mari': ["Pedrito", "Himar", "Sarito", "Claudio", "Pedro", "Mari"]
};

const SECRET_MESSAGES = [
    "Pronóstico Secreto 🤫", "Aquí huele a BOTE...", "Voy a ganar yo 😎", "Top Secret",
    "Clasificado ⭐", "Me lo guardo para mí", "Jugada Maestra en proceso...", "Ni el VAR lo sabe",
    "Consultando con el Oráculo", "Shhh... es un secreto", "Apuesta Fantasma 👻",
    "Resultado 'Confidencial'", "Cargando... 99%", "El que lo sabe, lo sabe", "Mejor no digo nada..."
];
const STAT_REACTION_EMOJIS = ['👍', '🔥', '🤯', '😂', '😥', '👏'];
const GOAL_REACTION_EMOJIS = ['🙌', '⚽', '🎉', '🤩', '🤯'];

// MODIFICADO: Se añaden todas las insignias con su lógica de prioridad y estilo
const BADGE_DEFINITIONS = {
    lider_general: { icon: '👑', name: 'Líder General', priority: 1, style: 'leader-glow' },
    campeon_jornada: { icon: '🏆', name: 'Campeón de la Jornada', priority: 2, style: 'champion-glow' },
    pleno_jornada: { icon: '🎯', name: 'Pleno en la Jornada', priority: 3, style: 'pleno-flash' },
    en_racha: { icon: '🔥', name: 'En Racha', priority: 4, style: 'fire-streak' },
    mala_racha: { icon: '🥶', name: 'Mala Racha', priority: 5, style: 'cold-streak' },
};

// NUEVO: Definiciones para las estadísticas del Paseo de la Fama
const FAME_STATS_DEFINITIONS = {
    rey_midas: { icon: '🤑', name: 'El Rey Midas', description: 'Jugador que más dinero ha ganado sumando todos los premios.' },
    pelotazo: { icon: '💣', name: 'El Pelotazo', description: 'Jugador que ha conseguido la mayor cantidad de puntos en una sola jornada.' },
    atrevido: { icon: '😎', name: 'El Atrevido', description: 'Jugador que más veces ha acertado un resultado exacto que nadie más pronosticó.' },
    mr_regularidad: { icon: '📈', name: 'Mr. Regularidad', description: 'Jugador que ha puntuado (>0 puntos) en el mayor número de jornadas.' },
    profeta: { icon: '🎯', name: 'El Profeta', description: 'Jugador con más aciertos de primer goleador.' },
    visionario: { icon: '🔮', name: 'El Visionario', description: 'Jugador con la racha más larga de jornadas consecutivas puntuando.' },
    cenizo: { icon: '👻', name: 'El Cenizo', description: 'Jugador con la racha más larga de jornadas consecutivas participando y obteniendo 0 puntos.' },
    obstinado: { icon: '🔁', name: 'El Obstinado', description: 'Jugador que más veces ha repetido el mismo pronóstico de resultado exacto.' },
};


const EQUIPOS_LIGA = [
    "UD Las Palmas", "FC Andorra", "Córdoba CF", "Málaga CF", "Burgos CF",
    "Real Sociedad B", "CD Leganes", "UD Almería", "Cádiz CF", "Granada CF",
    "SD Eibar", "SD Huesca", "Real Sporting de Gijón", "Real Racing Club",
    "Real Valladolid CF", "Albacete Balompié", "CD Castellón", "CD Mirandés",
    "AD Ceuta FC", "CyD Leonesa", "Real Zaragoza", "RC Deportivo"
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


const PROFILE_COLORS = ['#FFC72C', '#0055A4', '#FFFFFF', '#fca311', '#52b788', '#e63946', '#9b59b6', 'linear-gradient(45deg, #FFC72C, #0055A4)', 'linear-gradient(45deg, #e63946, #fca311)', 'linear-gradient(45deg, #52b788, #9b59b6)'];
const PROFILE_ICONS = ['🐥', '🇮🇨', '⚽️', '🥅', '🏆', '🥇', '🎉', '🔥', '💪', '😎', '🎯', '🧠', '⭐', '🐐', '👑', '🎮', '🏎️', '😂', '🤯', '🤔', '🤫', '💸', '💣', '🚀', '👽', '🤖', '👻', '🎱', '🍀', '🏃‍♂️', '🏃🏾‍♂️', '1️⃣', '7️⃣', '🔟', '🤑', '😈'];

// ============================================================================
// --- ESTILOS (CSS-in-JS) ---
// ============================================================================
// ACCIÓN: Constantes de colores y estilos movidas a la parte superior.
const colors = {
    deepBlue: '#001d3d', blue: '#0055A4', yellow: '#FFC72C', gold: '#FFD700', silver: '#C0C0C0', bronze: '#CD7F32', lightText: '#f0f0f0', darkText: '#0a0a0a', danger: '#e63946', success: '#52b788', warning: '#fca311', darkUI: 'rgba(10, 25, 47, 0.85)', darkUIAlt: 'rgba(23, 42, 69, 0.85)',
    // MODIFICADO: Se añade el estado "En vivo"
    status: { 'Próximamente': '#6c757d', 'Pre-apertura': '#fca311', 'Abierta': '#52b788', 'Cerrada': '#e63946', 'En vivo': '#dc3545', 'Finalizada': '#0055A4' }
};

const styles = {
    colors,
    container: { display: 'flex', justifyContent: 'center', alignItems: 'flex-start', width: '100%', minHeight: '100dvh', background: `linear-gradient(145deg, ${colors.deepBlue} 0%, #000 100%)`, padding: '15px', fontFamily: "'Exo 2', sans-serif" },
    card: { width: '100%', maxWidth: '900px', backgroundColor: colors.darkUI, color: colors.lightText, padding: '25px', borderRadius: '16px', boxShadow: `0 0 25px ${colors.blue}30, 0 10px 30px rgba(0, 0, 0, 0.5)`, minHeight: 'calc(100dvh - 30px)', border: `1px solid ${colors.blue}80`, backdropFilter: 'blur(10px)', transition: 'border-color 0.5s ease, box-shadow 0.5s ease' },
    title: { fontFamily: "'Orbitron', sans-serif", color: colors.yellow, textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center', borderBottom: `2px solid ${colors.yellow}`, paddingBottom: '10px', marginBottom: '25px', textShadow: `0 0 10px ${colors.yellow}90`, fontSize: 'clamp(1.5rem, 5vw, 1.8rem)', transition: 'all 0.5s ease' },
    mainButton: { fontFamily: "'Orbitron', sans-serif", padding: '10px 25px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', border: `2px solid ${colors.yellow}`, borderRadius: '8px', backgroundColor: colors.yellow, color: colors.darkText, marginTop: '20px', transition: 'all 0.3s ease', textTransform: 'uppercase', letterSpacing: '1px', boxShadow: `0 0 15px ${colors.yellow}50` },
    secondaryButton: { fontFamily: "'Exo 2', sans-serif", padding: '8px 15px', fontSize: '0.9rem', cursor: 'pointer', border: `1px solid ${colors.blue}`, borderRadius: '8px', backgroundColor: 'transparent', color: colors.lightText, transition: 'all 0.3s ease', textTransform: 'uppercase' },
    placeholder: { padding: '40px 20px', backgroundColor: 'rgba(0,0,0,0.2)', border: `2px dashed ${colors.blue}`, borderRadius: '12px', textAlign: 'center', color: colors.lightText },
    initialSplashContainer: { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100%', backgroundColor: colors.deepBlue, animation: 'fadeIn 0.5s ease', transition: 'opacity 0.5s ease' },
    fadeOut: { opacity: 0 },
    fadeIn: { animation: 'fadeIn 0.5s ease' },
    loadingMessage: { marginTop: '30px', animation: 'fadeIn 2s ease-in-out', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', fontFamily: "'Exo 2', sans-serif" },
    splashContainer: { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', textAlign: 'center', width: '100%' },
    splashLogoContainer: { marginBottom: '20px', },
    splashLogo: { width: '120px', height: '120px', marginBottom: '10px', objectFit: 'contain' },
    splashTitleContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 0.8 },
    splashTitle: { fontFamily: "'Teko', sans-serif", fontSize: 'clamp(3.5rem, 15vw, 5.5rem)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', background: `linear-gradient(90deg, ${colors.silver}, ${colors.lightText}, ${colors.yellow}, ${colors.lightText}, ${colors.silver})`, backgroundSize: '200% auto', color: 'transparent', backgroundClip: 'text', WebkitBackgroundClip: 'text', animation: 'title-shine 5s linear infinite', textShadow: `0 2px 4px rgba(0,0,0,0.5)` },
    splashYear: { fontFamily: "'Russo One', sans-serif", fontSize: 'clamp(2rem, 9vw, 3rem)', background: `linear-gradient(45deg, ${colors.gold}, ${colors.yellow})`, color: 'transparent', backgroundClip: 'text', WebkitBackgroundClip: 'text', textShadow: `0 2px 5px rgba(0,0,0,0.5)`, animation: 'title-shine 4s linear infinite', marginTop: '-15px' },
    splashInfoBox: { border: `2px solid ${colors.yellow}80`, padding: '20px', borderRadius: '10px', marginTop: '30px', backgroundColor: 'rgba(0,0,0,0.3)', width: '90%', minHeight: '220px', display: 'flex', flexDirection: 'column', justifyContent: 'center' },
    splashInfoTitle: { margin: '0 0 15px 0', fontFamily: "'Orbitron', sans-serif", color: colors.yellow, textTransform: 'uppercase', fontSize: '1.2rem' },
    splashMatch: { fontSize: '1.3rem', fontWeight: 'bold' },
    splashAdminMessage: { fontStyle: 'italic', marginTop: '15px', borderTop: `1px solid ${colors.blue}`, paddingTop: '15px', color: colors.silver },
    splashBote: { color: colors.success, fontWeight: 'bold', fontSize: '1.1rem' },
    loginContainer: { textAlign: 'center' },
    userList: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '15px', marginTop: '30px' },
    userButton: { position: 'relative', width: '100%', padding: '15px 10px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', border: `2px solid ${colors.blue}`, borderRadius: '8px', backgroundColor: 'transparent', color: colors.lightText, transition: 'all 0.3s ease', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', fontFamily: "'Exo 2', sans-serif", textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' },
    userButtonHover: { borderColor: colors.yellow, color: colors.yellow, transform: 'translateY(-5px)', boxShadow: `0 0 20px ${colors.yellow}50` },
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
    navButtonActive: { padding: '8px 12px', fontSize: '0.9rem', border: 'none', borderBottom: `3px solid ${colors.yellow}`, borderRadius: '6px 6px 0 0', backgroundColor: colors.darkUIAlt, color: colors.yellow, cursor: 'pointer', textTransform: 'uppercase', fontWeight: '600', position: 'relative' },
    profileNavButton: { marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' },
    logoutButton: { padding: '8px 12px', fontSize: '0.9rem', border: `1px solid ${colors.danger}`, borderRadius: '8px', backgroundColor: 'transparent', color: colors.danger, cursor: 'pointer', marginLeft: '10px', transition: 'all 0.2s', fontWeight: '600', textTransform: 'uppercase' },
    content: { padding: '10px 0' },
    form: { backgroundColor: 'rgba(0,0,0,0.2)', padding: '25px', borderRadius: '12px', marginTop: '20px', border: `1px solid ${colors.blue}50` },
    formSectionTitle: { fontFamily: "'Orbitron', sans-serif", color: colors.lightText, fontSize: '1.3rem', textAlign: 'center', marginBottom: '20px' },
    formGroup: { marginBottom: '25px' },
    label: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginBottom: '10px', color: colors.yellow, fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.9rem', letterSpacing: '1px' },
    pointsReminder: { color: colors.silver, fontWeight: 'normal', fontSize: '0.8rem', textTransform: 'none' },
    input: { width: 'calc(100% - 24px)', padding: '12px', border: `1px solid ${colors.blue}`, borderRadius: '6px', backgroundColor: colors.deepBlue, color: colors.lightText, fontSize: '1rem', transition: 'all 0.3s ease' },
    resultInputContainer: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', justifyContent: 'center' },
    resultInput: { width: '50px', textAlign: 'center', padding: '10px', border: `1px solid ${colors.blue}`, borderRadius: '6px', backgroundColor: colors.deepBlue, color: colors.lightText, fontSize: '1.3rem', fontFamily: "'Orbitron', sans-serif", },
    separator: { fontSize: '1.3rem', fontWeight: 'bold', color: colors.yellow },
    checkbox: { width: '20px', height: '20px', accentColor: colors.yellow },
    message: { marginTop: '20px', padding: '12px', borderRadius: '8px', backgroundColor: colors.darkUIAlt, color: colors.lightText, textAlign: 'center', fontWeight: 'bold' },
    table: { width: '100%', marginTop: '20px', borderCollapse: 'separate', borderSpacing: '0 5px', color: colors.lightText },
    th: { backgroundColor: 'transparent', color: colors.yellow, padding: '12px', borderBottom: `2px solid ${colors.yellow}`, textAlign: 'left', textTransform: 'uppercase', fontFamily: "'Orbitron', sans-serif", fontSize: '0.8rem' },
    tr: { backgroundColor: colors.darkUIAlt, transition: 'background-color 0.3s ease' },
    td: { padding: '12px', border: 'none', borderBottom: `1px solid ${colors.deepBlue}`, fontSize: '0.9rem' },
    tdRank: { padding: '12px', border: 'none', borderBottom: `1px solid ${colors.deepBlue}`, fontFamily: "'Orbitron', sans-serif", fontWeight: 'bold', fontSize: '1rem', textAlign: 'center' },
    tdTotalPoints: { padding: '12px', border: 'none', borderBottom: `1px solid ${colors.deepBlue}`, fontFamily: "'Orbitron', sans-serif", fontWeight: 'bold', fontSize: '1.2rem', textAlign: 'center', color: colors.yellow },
    leaderRow: { animation: 'leader-glow 2s infinite alternate' },
    secondPlaceRow: { animation: 'silver-glow 2s infinite alternate' },
    thirdPlaceRow: { animation: 'bronze-glow 2s infinite alternate' },
    currentUserRow: { animation: 'user-highlight-glow 2s infinite alternate' },
    laJornadaContainer: { textAlign: 'center', padding: '20px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '12px', backgroundSize: 'cover', backgroundPosition: 'center' },
    matchInfo: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'clamp(5px, 2vw, 10px)', fontSize: '1.5rem', fontWeight: 'bold', margin: '20px 0', fontFamily: "'Orbitron', sans-serif", flexWrap: 'nowrap' },
    matchDetails: { display: 'flex', justifyContent: 'center', gap: '20px', color: colors.silver, marginBottom: '20px', flexWrap: 'wrap' },
    matchInfoLogo: { width: 'clamp(50px, 12vw, 60px)', height: 'clamp(50px, 12vw, 60px)' },
    vs: { color: colors.yellow, textShadow: `0 0 10px ${colors.yellow}`, fontSize: 'clamp(1.2rem, 4vw, 1.8rem)' },
    countdownContainer: { margin: '20px 0' },
    countdown: { fontFamily: "'Orbitron', sans-serif", fontSize: 'clamp(1.3rem, 5vw, 1.8rem)', fontWeight: 'bold', color: colors.yellow, backgroundColor: colors.deepBlue, padding: '8px 15px', borderRadius: '8px', display: 'inline-block', border: `1px solid ${colors.blue}` },
    callToAction: { fontSize: '1.2rem', fontStyle: 'italic', color: colors.lightText, marginTop: '20px' },
    apostadoresContainer: { marginTop: '30px', borderTop: `1px solid ${colors.blue}`, paddingTop: '20px' },
    apostadoresGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '8px', marginTop: '10px' },
    apostadorHecho: { padding: '8px', fontSize: '0.9rem', backgroundColor: colors.success, color: colors.darkText, borderRadius: '5px', textAlign: 'center', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' },
    apostadorPendiente: { padding: '8px', fontSize: '0.9rem', backgroundColor: colors.darkUIAlt, color: colors.lightText, borderRadius: '5px', textAlign: 'center', opacity: 0.6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' },
    onlineIndicatorDot: { width: '10px', height: '10px', backgroundColor: '#0f0', borderRadius: '50%', boxShadow: '0 0 5px #0f0, 0 0 10px #0f0' },
    jokerContainer: { marginTop: '30px', padding: '20px', borderTop: `2px solid ${colors.blue}`, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '8px' },
    jokerButton: { padding: '10px 20px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', border: `2px solid ${colors.gold}`, borderRadius: '8px', backgroundColor: 'transparent', color: colors.gold, transition: 'all 0.3s ease', textTransform: 'uppercase' },
    dangerButton: { borderColor: colors.danger, color: colors.danger },
    vipBanner: { background: `linear-gradient(45deg, ${colors.gold}, ${colors.yellow})`, color: colors.darkText, fontWeight: 'bold', padding: '15px', borderRadius: '8px', textAlign: 'center', marginBottom: '20px', fontSize: '1.1rem', fontFamily: "'Orbitron', sans-serif", boxShadow: `0 0 20px ${colors.gold}70` },
    jackpotBanner: { background: `linear-gradient(45deg, ${colors.success}, #2a9d8f)`, color: colors.lightText, fontWeight: 'bold', padding: '15px', borderRadius: '8px', textAlign: 'center', marginBottom: '20px', fontSize: '1.1rem', fontFamily: "'Orbitron', sans-serif", boxShadow: `0 0 20px ${colors.success}70`, textShadow: '1px 1px 2px #000' },
    jokerGrid: { display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center' },
    jokerBetRow: { marginBottom: '10px', width: '100%', maxWidth: '300px' },
    jornadaList: { display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' },
    jornadaItem: { cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', border: '1px solid transparent', borderLeft: `5px solid ${colors.blue}`, borderRadius: '8px', backgroundColor: colors.darkUIAlt, transition: 'all 0.3s ease', backgroundSize: 'cover', backgroundPosition: 'center' },
    jornadaVip: { borderLeft: `5px solid ${colors.yellow}`, boxShadow: `0 0 15px ${colors.yellow}30` },
    jornadaInfo: { display: 'flex', flexDirection: 'column', color: colors.lightText, fontSize: '0.9rem', gap: '5px' },
    jornadaTeams: { display: 'flex', alignItems: 'center' },
    statusBadge: { color: 'white', padding: '5px 12px', borderRadius: '15px', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase' },
    adminJornadaItem: { padding: '20px', backgroundColor: 'rgba(0,0,0,0.2)', border: `1px solid ${colors.blue}`, borderRadius: '12px', marginBottom: '20px' },
    testJornadaAdminItem: { border: `2px dashed ${colors.success}` },
    adminControls: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', margin: '15px 0' },
    adminInput: { width: '90%', padding: '10px', border: `1px solid ${colors.blue}`, borderRadius: '6px', backgroundColor: colors.deepBlue, color: colors.lightText },
    adminSelect: { width: '95%', padding: '10px', border: `1px solid ${colors.blue}`, borderRadius: '6px', backgroundColor: colors.deepBlue, color: colors.lightText },
    saveButton: { padding: '10px 18px', border: 'none', borderRadius: '5px', backgroundColor: colors.success, color: 'white', cursor: 'pointer', textTransform: 'uppercase', fontWeight: 'bold' },
    vipToggleContainer: { display: 'flex', alignItems: 'center', gap: '10px' },
    backButton: { padding: '10px 15px', fontSize: '1rem', border: `1px solid ${colors.blue}`, borderRadius: '8px', backgroundColor: 'transparent', color: colors.lightText, cursor: 'pointer', transition: 'all 0.2s', marginBottom: '20px' },
    finalResult: { fontSize: '2rem', fontWeight: 'bold', color: colors.yellow, textAlign: 'center', margin: '20px 0', fontFamily: "'Orbitron', sans-serif", },
    winnerBanner: { background: `linear-gradient(45deg, ${colors.gold}, ${colors.yellow})`, color: colors.darkText, fontWeight: 'bold', padding: '15px', borderRadius: '8px', textAlign: 'center', margin: '20px 0', fontSize: '1.2rem', boxShadow: `0 0 20px ${colors.gold}70` },
    boteBanner: { backgroundColor: colors.danger, color: 'white', fontWeight: 'bold', padding: '15px', borderRadius: '8px', textAlign: 'center', margin: '20px 0', fontSize: '1.2rem' },
    winnerRow: { backgroundColor: `${colors.gold}30` },
    jokerDetailRow: { backgroundColor: `${colors.deepBlue}99` },
    jokerDetailChip: { backgroundColor: colors.blue, padding: '5px 10px', borderRadius: '15px', fontSize: '0.9rem', fontFamily: "'Orbitron', sans-serif", },
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(5px)' },
    modalContent: { backgroundColor: colors.darkUI, padding: '30px', borderRadius: '12px', width: '90%', maxWidth: '700px', border: `1px solid ${colors.yellow}` },
    resumenContainer: { display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' },
    resumenJugador: { backgroundColor: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '12px', borderLeft: `4px solid ${colors.blue}` },
    resumenJugadorTitle: { margin: '0 0 10px 0', paddingBottom: '10px', borderBottom: `1px solid ${colors.blue}80`, fontFamily: "'Orbitron', sans-serif", display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    resumenJugadorBets: { fontSize: '0.95rem' },
    jokerChipsContainer: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' },
    pinReminder: { display: 'block', fontSize: '0.8rem', color: colors.warning, marginTop: '10px', fontStyle: 'italic' },
    statsIndicator: { display: 'block', textAlign: 'center', marginTop: '10px', fontWeight: 'bold' },
    jokerAnimationOverlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', overflow: 'hidden', zIndex: 9999, pointerEvents: 'none', backdropFilter: 'blur(3px) brightness(0.7)', transition: 'backdrop-filter 0.5s ease' },
    jokerIcon: { position: 'absolute', top: '-50px', animationName: 'fall', animationTimingFunction: 'linear', animationIterationCount: '1' },
    porraAnualBanner: { background: `linear-gradient(45deg, ${colors.gold}, ${colors.yellow})`, color: colors.darkText, fontWeight: 'bold', padding: '15px', borderRadius: '8px', textAlign: 'center', marginBottom: '20px', fontSize: '1rem', fontFamily: "'Orbitron', sans-serif", boxShadow: `0 0 20px ${colors.gold}70`, cursor: 'pointer' },
    porraAnualContainer: { marginTop: '30px', padding: '20px', borderTop: `2px solid ${colors.yellow}`, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '8px' },
    porraAnualInfoBox: { backgroundColor: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px', textAlign: 'center', marginBottom: '15px', border: `1px solid ${colors.blue}` },
    porraAnualCountdown: { color: colors.yellow, fontWeight: 'bold', fontFamily: "'Orbitron', sans-serif" },
    ascensoButtonsContainer: { display: 'flex', gap: '10px', justifyContent: 'center' },
    ascensoButton: { flex: 1, padding: '20px', fontSize: '1.5rem', fontWeight: 'bold', cursor: 'pointer', border: `2px solid ${colors.blue}`, borderRadius: '8px', backgroundColor: 'transparent', color: colors.lightText, transition: 'all 0.3s ease' },
    ascensoButtonActive: { flex: 1, padding: '20px', fontSize: '1.5rem', fontWeight: 'bold', cursor: 'pointer', border: `2px solid ${colors.yellow}`, borderRadius: '8px', backgroundColor: colors.yellow, color: colors.deepBlue, transition: 'all 0.3s ease' },
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
    escudosGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px', marginTop: '20px', marginBottom: '20px' },
    escudoCard: { backgroundColor: colors.darkUIAlt, padding: '10px', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' },
    escudoCardImg: { width: '80px', height: '80px', objectFit: 'contain' },
    escudoCardName: { fontSize: '0.9rem', color: colors.lightText, textAlign: 'center', margin: 0, fontWeight: 'bold' },
    escudoInput: { width: '90%', padding: '8px', borderRadius: '4px', border: '1px solid #0055A4', backgroundColor: '#001d3d', color: '#f0f0f0', fontSize: '0.8rem' },
    escudoSaveButton: { padding: '5px 10px', fontSize: '0.8rem', backgroundColor: colors.success, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '5px' },
    matchHeader: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', marginBottom: '20px' },
    liveBanner: { position: 'sticky', top: 0, left: 0, width: '100%', backgroundColor: colors.danger, color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: '15px', padding: '10px', zIndex: 100, fontFamily: "'Orbitron', sans-serif", animation: 'blink-live 1.5s infinite' },
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
    statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', marginTop: '30px' },
    statCard: { backgroundColor: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', textAlign: 'center', border: `1px solid ${colors.blue}50`, display: 'flex', flexDirection: 'column', justifyContent: 'center' },
    statValue: { fontFamily: "'Orbitron', sans-serif", fontSize: 'clamp(1.5rem, 4vw, 2rem)', color: colors.yellow, marginBottom: '10px' },
    statLabel: { fontSize: '0.9rem', color: colors.silver },
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
    preMatchContainer: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '20px', margin: '20px 0', border: `1px solid ${colors.blue}`, transition: 'border-color 0.5s ease, box-shadow 0.5s ease' },
    preMatchTitleContainer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${colors.blue}`, paddingBottom: '10px', marginBottom: '15px' },
    preMatchTitle: { textAlign: 'left', color: colors.yellow, margin: 0, fontSize: '1.3rem', fontFamily: "'Orbitron', sans-serif" },
    lastUpdatedContainer: { display: 'flex', alignItems: 'center', gap: '8px', color: colors.silver, fontSize: '0.8rem' },
    liveDot: { width: '10px', height: '10px', backgroundColor: colors.success, borderRadius: '50%', boxShadow: `0 0 8px ${colors.success}` },
    preMatchComparison: { display: 'flex', justifyContent: 'space-around', alignItems: 'flex-start', gap: '15px' },
    preMatchTeamContainer: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' },
    preMatchTeamHeader: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginBottom: '10px' },
    preMatchTeamLogo: { width: '60px', height: '60px', objectFit: 'contain' },
    preMatchTeamName: { color: colors.lightText, fontWeight: 'bold', fontSize: '1.1rem', textAlign: 'center' },
    preMatchStatsBody: { width: '100%', backgroundColor: colors.darkUIAlt, padding: '10px', borderRadius: '8px' },
    preMatchStatItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: colors.lightText, fontSize: '1rem', marginBottom: '8px', paddingBottom: '5px', borderBottom: `1px solid ${colors.deepBlue}` },
    preMatchFormContainer: { display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '10px' },
    preMatchFormIndicator: { width: '25px', height: '25px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '0.9rem', boxShadow: 'inset 0 0 5px rgba(0,0,0,0.4)' },
    preMatchVS: { color: colors.yellow, fontWeight: 'bold', fontSize: '2rem', alignSelf: 'center', fontFamily: "'Orbitron', sans-serif" },
    modalComparison: { display: 'flex', justifyContent: 'space-around', alignItems: 'flex-start', gap: '15px' },
    modalTeamColumn: { flex: 1 },
    modalStatSection: { marginTop: '20px', paddingTop: '15px', borderTop: `1px solid ${colors.blue}`, '& h4': { color: colors.yellow, marginBottom: '10px', textAlign: 'center' } },
    topScorersList: { listStyle: 'none', padding: 0, '& li': { display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${colors.deepBlue}` } },
    // --- NUEVO: Estilos para paneles "En Vivo" ---
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
    // ---
    renderedPronosticoContainer: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '15px', margin: '20px 0', border: `1px solid ${colors.blue}` },
    renderedPronosticoTitle: { color: colors.yellow, textAlign: 'center', marginBottom: '10px', fontFamily: "'Orbitron', sans-serif" },
    recalculatorContainer: { padding: '20px', border: `1px dashed ${colors.warning}`, borderRadius: '8px', backgroundColor: 'rgba(252, 163, 23, 0.1)' },
    // --- NUEVOS ESTILOS PARA HISTORIAL Y CONFIRMACIÓN ---
    confirmacionResumen: { backgroundColor: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px', borderLeft: `4px solid ${colors.yellow}`, marginBottom: '20px' },
    historyButton: { backgroundColor: 'transparent', border: `1px solid ${colors.blue}`, color: colors.lightText, padding: '4px 8px', borderRadius: '5px', cursor: 'pointer', fontSize: '0.8rem', marginLeft: '10px' },
    historyContainer: { maxHeight: '400px', overflowY: 'auto', paddingRight: '10px' },
    historyEntry: { backgroundColor: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', marginBottom: '10px', borderLeft: `3px solid ${colors.blue}` },
    historyTimestamp: { fontSize: '0.9rem', color: colors.silver, paddingBottom: '8px', borderBottom: `1px solid ${colors.blue}80`, marginBottom: '8px'},
    historyDetails: { fontSize: '0.95rem' },
    // NUEVO: Estilo para la etiqueta del tesorero
    tesoreroTag: { fontSize: '0.75rem', color: colors.darkText, backgroundColor: colors.yellow, padding: '2px 6px', borderRadius: '10px', marginLeft: '8px', fontWeight: 'bold' },
    // --- NUEVO: Estilos para Paseo de la Fama ---
    fameGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginTop: '20px' },
    fameCard: { backgroundColor: colors.darkUIAlt, padding: '20px', borderRadius: '12px', border: `1px solid ${colors.blue}`, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' },
    fameIcon: { fontSize: '3rem', marginBottom: '10px' },
    fameTitle: { fontFamily: "'Orbitron', sans-serif", color: colors.yellow, fontSize: '1.2rem', marginBottom: '10px' },
    fameWinner: { fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '5px' },
    fameValue: { fontSize: '1.1rem', color: colors.silver },
    // --- NUEVO: Estilos para el filtro del admin ---
    adminFilterContainer: { display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', alignItems: 'center', padding: '15px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '8px', marginBottom: '20px' },
    adminFilterInput: { padding: '8px', borderRadius: '6px', border: `1px solid ${colors.blue}`, backgroundColor: colors.deepBlue, color: colors.lightText, width: '150px' },
    adminFilterButton: { padding: '8px 12px', borderRadius: '6px', border: `1px solid ${colors.blue}`, backgroundColor: 'transparent', color: colors.lightText, cursor: 'pointer' },
    adminFilterButtonActive: { backgroundColor: colors.blue, color: 'white' },
};

// ============================================================================
// --- LÓGICA DE CÁLCULO Y FORMATO ---
// ============================================================================

// NUEVO: Función para obtener el tesorero responsable de un jugador
const getTesoreroResponsable = (jugador) => {
    for (const tesorero in GRUPOS_PAGOS) {
        if (GRUPOS_PAGOS[tesorero].includes(jugador)) {
            return tesorero;
        }
    }
    return null; // O un valor por defecto si es necesario
};

const formatFullDateTime = (firebaseDate) => {
    if (!firebaseDate || typeof firebaseDate.seconds !== 'number') return 'Fecha por confirmar';
    try {
        const date = new Date(firebaseDate.seconds * 1000);
        const options = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false };
        return new Intl.DateTimeFormat('es-ES', options).format(date).replace(',', ' a las');
    } catch (error) {
        console.error("Error formatting date:", error);
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
        console.error("Error formatting last seen:", error);
        return null;
    }
};

const calculateProvisionalPoints = (pronostico, liveData, jornada) => {
    // MODIFICADO: Ahora comprueba el estado "En vivo"
    if (!pronostico || !liveData || !jornada || jornada.estado !== 'En vivo') return 0;
    let puntosJornada = 0;
    const esVip = jornada.esVip || false;
    const { golesLocal, golesVisitante } = liveData;

    // Acierto Resultado Exacto
    const aciertoExacto = pronostico.golesLocal !== '' && pronostico.golesVisitante !== '' && parseInt(pronostico.golesLocal) === golesLocal && parseInt(pronostico.golesVisitante) === golesVisitante;
    if (aciertoExacto) {
        puntosJornada += esVip ? 6 : 3;
    }

    // Acierto 1X2
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

    // Acierto Goleador
    const goleadorReal = (liveData.ultimoGoleador || '').trim().toLowerCase();
    const goleadorApostado = (pronostico.goleador || '').trim().toLowerCase();
    if (pronostico.sinGoleador && (goleadorReal === "sg" || goleadorReal === "")) {
        puntosJornada += 1;
    } else if (!pronostico.sinGoleador && goleadorApostado !== "" && goleadorApostado === goleadorReal) {
        puntosJornada += esVip ? 4 : 2;
    }

    // Acierto Joker
    if (pronostico.jokerActivo && pronostico.jokerPronosticos?.length > 0) {
        for (const jokerP of pronostico.jokerPronosticos) {
            if (jokerP.golesLocal !== '' && jokerP.golesVisitante !== '' && parseInt(jokerP.golesLocal) === golesLocal && parseInt(jokerP.golesVisitante) === golesVisitante) {
                puntosJornada += esVip ? 6 : 3;
                break;
            }
        }
    }
    return puntosJornada;
};


// ============================================================================
// --- COMPONENTES REUTILIZABLES Y DE ANIMACIÓN (ORDENADOS POR DEPENDENCIA) ---
// ============================================================================

// CORRECCIÓN: Componente AnimatedCount movido aquí para ser accesible globalmente.
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

// CORRECCIÓN: Componente AnimatedPoints movido aquí y renombrado para evitar conflictos.
const AnimatedPoints = ({ value }) => {
    const [displayValue, setDisplayValue] = useState(value);
    const prevValueRef = useRef(value);

    useEffect(() => {
        if (value !== prevValueRef.current) {
            const element = document.getElementById(`animated-points-${value}`);
            if (element) {
                element.style.transform = 'scale(1.3)';
                element.style.transition = 'transform 0.2s ease-out';
                setTimeout(() => {
                    element.style.transform = 'scale(1)';
                }, 200);
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
    
    // MODIFICADO: La lógica de insignias ahora siempre ordena por prioridad
    const badgesToDisplay = useMemo(() => {
        if (!finalProfile.badges || finalProfile.badges.length === 0) return [];
        return finalProfile.badges
            .map(badgeKey => ({ key: badgeKey, ...BADGE_DEFINITIONS[badgeKey] }))
            .filter(b => b.name && b.icon) 
            .sort((a, b) => (a.priority || 99) - (b.priority || 99));
    }, [finalProfile.badges]);
    
    // Asigna la animación correspondiente a la insignia de mayor prioridad
    const badgeStyle = useMemo(() => {
        if (!finalProfile.badges || finalProfile.badges.length === 0) return {};
        const highestPriorityBadgeWithStyle = finalProfile.badges
            .map(badgeKey => ({ key: badgeKey, ...BADGE_DEFINITIONS[badgeKey] }))
            .filter(b => b.name && b.style)
            .sort((a, b) => (a.priority || 99) - (b.priority || 99))[0];
        
        if (highestPriorityBadgeWithStyle) {
            const animationName = `${highestPriorityBadgeWithStyle.style}-animation`;
            let animationProps = '2s infinite alternate';
            if(highestPriorityBadgeWithStyle.style === 'pleno-flash') {
                animationProps = '0.5s ease-in-out 3';
            }
            if(highestPriorityBadgeWithStyle.style === 'cold-streak'){
                animationProps = '1.5s infinite';
            }
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
    // MODIFICADO: Ahora comprueba el estado "En vivo"
    if (!jornada || !liveData || jornada.estado !== 'En vivo') return null;
    return (<div style={styles.liveBanner}><span style={styles.liveIndicator}>🔴 EN VIVO</span><span style={styles.liveMatchInfo}>{jornada.equipoLocal} <strong>{liveData.golesLocal} - {liveData.golesVisitante}</strong> {jornada.equipoVisitante}</span>{liveData.ultimoGoleador && <span style={styles.liveGoalScorer}>Último Gol: {liveData.ultimoGoleador}</span>}</div>);
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
    return (<div style={styles.winnerAnimationOverlay}><Confetti /><div style={styles.winnerModal}><div style={styles.trophy}>🏆</div><h2 style={styles.winnerTitle}>¡FELICIDADES, {pronostico.id}!</h2><p style={styles.winnerText}>¡Has ganado la porra de la jornada!</p><div style={styles.winnerStats}><span>Puntos Obtenidos: <strong><AnimatedCount endValue={pronostico.puntosObtenidos} duration={1500} /></strong></span><span>Premio: <strong><AnimatedCount endValue={prize} duration={1500} decimals={2} />€</strong></span></div><button onClick={onClose} style={{...styles.mainButton, marginTop: '30px'}}>CERRAR</button></div></div>);
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
                <ul style={{listStyle: 'none', padding: 0, marginBottom: '30px', textAlign: 'center'}}>
                    <li style={{marginBottom: '10px'}}>✅ Avisos de nuevas jornadas</li>
                    <li style={{marginBottom: '10px'}}>⏳ Recordatorios de cierre</li>
                    <li style={{marginBottom: '10px'}}>🏆 Resultados y ganadores</li>
                </ul>
                <div style={{display: 'flex', justifyContent: 'space-around', gap: '10px'}}>
                    <button onClick={onDeny} style={{...styles.mainButton, backgroundColor: 'transparent', color: styles.colors.lightText, borderColor: styles.colors.lightText}}>Ahora no</button>
                    <button onClick={onAllow} style={styles.mainButton}>Reactivar</button>
                </div>
            </div>
        </div>
    );
};

// --- NUEVO COMPONENTE: Modal para confirmar el pago ---
const LiquidarPagoModal = ({ onClose, onConfirm }) => {
    const [isChecked, setIsChecked] = useState(false);

    const handleConfirm = () => {
        if (isChecked) {
            onConfirm();
        }
    };

    return (
        <div style={styles.modalOverlay}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <h3 style={styles.title}>CONFIRMAR PAGO</h3>
                <p style={{textAlign: 'center', marginBottom: '20px', lineHeight: 1.5}}>
                    Estás a punto de marcar tu apuesta como pagada. Esto sirve como un aviso para el administrador.
                </p>
                <p style={{textAlign: 'center', marginBottom: '20px', lineHeight: 1.5, fontWeight: 'bold', color: styles.colors.warning}}>
                    Recuerda que el administrador debe validar el pago manualmente después de tu confirmación.
                </p>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '30px'}}>
                    <input 
                        type="checkbox" 
                        id="confirm-pago-check" 
                        checked={isChecked} 
                        onChange={() => setIsChecked(!isChecked)}
                        style={styles.checkbox}
                    />
                    <label htmlFor="confirm-pago-check" style={{marginLeft: '10px', color: styles.colors.lightText}}>
                        Confirmo que he realizado el pago de esta jornada.
                    </label>
                </div>
                <div style={{display: 'flex', justifyContent: 'space-around', gap: '10px'}}>
                    <button onClick={onClose} style={{...styles.mainButton, backgroundColor: 'transparent', color: styles.colors.lightText, borderColor: styles.colors.lightText}}>Cancelar</button>
                    <button onClick={handleConfirm} style={styles.mainButton} disabled={!isChecked}>
                        Confirmar Pago
                    </button>
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
                            <circle
                                key={index}
                                cx="60"
                                cy="60"
                                r={radius}
                                fill="transparent"
                                stroke={segment.color}
                                strokeWidth="20"
                                strokeDasharray={circumference}
                                strokeDashoffset={circumference}
                                style={{
                                    '--stroke-dasharray': strokeDasharray,
                                    '--rotation': `${rotation}deg`,
                                    animationDelay: `${index * 0.2}s`
                                }}
                                className="pie-chart-segment-new"
                            />
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

// ============================================================================
// --- COMPONENTES DE LAS PANTALLAS (ORDENADOS POR DEPENDENCIA) ---
// ============================================================================

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
        // MODIFICADO: Se añade "Pre-apertura" y "En vivo" a la lógica
        const qJornadas = query(collection(db, "jornadas"), orderBy("numeroJornada"));
        const unsubscribe = onSnapshot(qJornadas, (snap) => {
            const todasLasJornadas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            // Prioridad 1: Jornada En vivo
            let jornadaActiva = todasLasJornadas.find(j => j.estado === 'En vivo');
            
            // Prioridad 2: Jornada Abierta o en Pre-apertura
            if (!jornadaActiva) {
                jornadaActiva = todasLasJornadas.find(j => j.estado === 'Abierta' || j.estado === 'Pre-apertura');
            }

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
                } else {
                    setJornadaStats(null);
                }
            } else {
                setJornadaStats(null);
                let jornadaCerrada = todasLasJornadas.find(j => j.estado === 'Cerrada');
                if (jornadaCerrada) { setJornadaInfo(jornadaCerrada); }
                else {
                    const ultimasFinalizadas = todasLasJornadas.filter(j => j.estado === 'Finalizada').sort((a,b) => b.numeroJornada - a.numeroJornada);
                    if (ultimasFinalizadas.length > 0) { setJornadaInfo(ultimasFinalizadas[0]); }
                    else {
                        const proximas = todasLasJornadas.filter(j => j.estado === 'Próximamente').sort((a,b) => a.numeroJornada - b.numeroJornada);
                        if (proximas.length > 0) setJornadaInfo(proximas[0]);
                        else setJornadaInfo(null);
                    }
                }
            }
            setLoading(false);
        }, (error) => { console.error("Error fetching jornada: ", error); setLoading(false); });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!jornadaInfo) return;
        // MODIFICADO: La cuenta atrás apunta a fechaApertura si el estado es 'Pre-apertura'
        const targetDate = (jornadaInfo.estado === 'Abierta') ? jornadaInfo.fechaCierre?.toDate() : (jornadaInfo.estado === 'Próximamente' || jornadaInfo.estado === 'Pre-apertura' ? jornadaInfo.fechaApertura?.toDate() : null);
        if (!targetDate) { setCountdown(''); return; }

        const interval = setInterval(() => {
            const diff = targetDate - new Date();
            if (diff <= 0) {
                let message = "¡PARTIDO EN JUEGO!";
                if (jornadaInfo.estado === 'Abierta') message = "¡APUESTAS CERRADAS!";
                if (jornadaInfo.estado === 'Próximamente' || jornadaInfo.estado === 'Pre-apertura') message = "¡APUESTAS ABIERTAS!";
                setCountdown(message);
                clearInterval(interval);
                return;
            }
            const d = Math.floor(diff / 86400000);
            const h = Math.floor((diff % 86400000) / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setCountdown(`${d}d ${h}h ${m}m ${s}s`);
        }, 1000);
        return () => clearInterval(interval);
    }, [jornadaInfo]);

    const statCards = useMemo(() => {
        if (jornadaInfo?.estado === 'Abierta' && jornadaStats) {
            return [
                <div key="apostado" style={styles.statCard}><div style={styles.statValue}>{jornadaStats.apostadoCount}/{JUGADORES.length}</div><div style={styles.statLabel}>Han apostado</div><div style={styles.splashStatDescription}>{jornadaStats.sinApostar} jugador(es) pendiente(s)</div></div>,
                <div key="goleador" style={styles.statCard}><img src={plantilla.find(j => j.nombre === jornadaStats.goleadorMasVotado)?.imageUrl || 'https://placehold.co/60x60/1b263b/e0e1dd?text=?'} alt={jornadaStats.goleadorMasVotado} style={styles.splashStatImage} onError={(e) => { e.target.src = 'https://placehold.co/60x60/1b263b/e0e1dd?text=?'; }} /><div style={styles.statValue}>{jornadaStats.goleadorMasVotado || '-'}</div><div style={styles.statLabel}>Goleador más elegido</div><div style={styles.splashStatDescription}>{jornadaStats.goleadorMasVotadoCount} voto(s)</div></div>,
                <div key="resultado" style={styles.statCard}><div style={styles.statValue}>{jornadaStats.resultadoMasVotado || '-'}</div><div style={styles.statLabel}>Resultado más común</div><div style={styles.splashStatDescription}>{jornadaStats.resultadoMasVotadoCount} vez/veces</div></div>,
                <div key="joker" style={styles.statCard}><div style={styles.statValue}>🃏 {jornadaStats.jokersActivos}</div><div style={styles.statLabel}>Jokers Activados</div><div style={styles.splashStatDescription}>¡Apuestas extra en juego!</div></div>
            ];
        } 
        if (fameStats) {
            // NUEVO: Carrusel de noticias con stats globales
            const fameKeys = ['rey_midas', 'pelotazo', 'mr_regularidad', 'profeta'];
            return fameKeys.map(key => {
                const stat = fameStats[key];
                const def = FAME_STATS_DEFINITIONS[key];
                if (!stat || !def) return null;
                return (
                    <div key={key} style={styles.statCard}>
                        <div style={{...styles.fameIcon, fontSize: '2rem'}}>{def.icon}</div>
                        <div style={{...styles.fameTitle, fontSize: '1rem'}}>{def.name}</div>
                        <div style={{...styles.fameWinner, fontSize: '1.2rem'}}>{stat.jugador || '-'}</div>
                        <div style={styles.splashStatDescription}>{stat.valor || '-'}</div>
                    </div>
                );
            }).filter(Boolean);
        }
        return [];
    }, [jornadaInfo, jornadaStats, fameStats, plantilla]);

    // Carrusel de estadísticas
    useEffect(() => {
        if (statCards.length > 0) {
            const timer = setInterval(() => {
                setCurrentStatIndex(prevIndex => (prevIndex + 1) % statCards.length);
            }, 4000);
            return () => clearInterval(timer);
        }
    }, [statCards]);

    const renderJornadaInfo = () => {
        if (!jornadaInfo) return (<div style={styles.splashInfoBox}><h3 style={styles.splashInfoTitle}>TEMPORADA EN PAUSA</h3><p>El administrador aún no ha configurado la próxima jornada.</p></div>);
        
        const fechaMostrada = jornadaInfo.fechaPartido || jornadaInfo.fechaCierre;
        let infoContent;
        // MODIFICADO: Añadidos los nuevos estados
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
    
    useEffect(() => {
        const storedUsers = localStorage.getItem('recentPorraUsers');
        if (storedUsers) setRecentUsers(JSON.parse(storedUsers));
    }, []);

    const handleSelectUser = (jugador) => {
        const updatedRecentUsers = [jugador, ...recentUsers.filter(u => u !== jugador)].slice(0, 3);
        setRecentUsers(updatedRecentUsers);
        localStorage.setItem('recentPorraUsers', JSON.stringify(updatedRecentUsers));
        onLogin(jugador);
    };

    const sortedJugadores = useMemo(() => {
        const remainingJugadores = JUGADORES.filter(j => !recentUsers.includes(j));
        return [...recentUsers, ...remainingJugadores];
    }, [recentUsers]);

    const getBadgeStyle = (profile) => {
        if (!profile?.badges?.length) return {};
        const highestPriorityBadge = profile.badges
            .map(key => ({ key, ...BADGE_DEFINITIONS[key] }))
            .filter(b => b.name && b.style)
            .sort((a, b) => (a.priority || 99) - (b.priority || 99))[0];
        
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
                    const profile = userProfiles[jugador] || {};
                    const isOnline = onlineUsers[jugador];
                    const isRecent = recentUsers.includes(jugador);
                    const isGradient = typeof profile.color === 'string' && profile.color.startsWith('linear-gradient');
                    const lastSeenText = !isOnline ? formatLastSeen(profile.ultimaConexion) : null;
                    const badgeStyle = getBadgeStyle(profile);
                    const buttonStyle = { ...styles.userButton, ...(hoveredUser === jugador && styles.userButtonHover), ...(isOnline && styles.userButtonOnline), ...badgeStyle };
                    const circleStyle = { ...styles.loginProfileIconCircle, ...(isGradient ? { background: profile.color } : { backgroundColor: profile.color || styles.colors.blue }) };

                    return (
                        <button key={jugador} onClick={() => handleSelectUser(jugador)} style={buttonStyle} onMouseEnter={() => setHoveredUser(jugador)} onMouseLeave={() => setHoveredUser(null)}>
                            {isRecent && <div style={styles.recentUserIndicator}>★</div>}
                            <div style={circleStyle}>{profile.icon || '?'}</div>
                            <div style={styles.loginUserInfo}>
                                <span>{jugador}</span>
                                {isOnline && <span style={styles.onlineStatusText}>Online</span>}
                                {lastSeenText && <span style={styles.lastSeenText}>{lastSeenText}</span>}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};


const initialPronosticoState = { 
    golesLocal: '', 
    golesVisitante: '', 
    resultado1x2: '', 
    goleador: '', 
    sinGoleador: false, 
    pin: '', 
    pinConfirm: '', 
    jokerActivo: false, 
    jokerPronosticos: Array(10).fill({golesLocal: '', golesVisitante: ''}) 
};

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

const AnimatedStat = ({ value, duration = 800 }) => {
    const [displayValue, setDisplayValue] = useState(0);
    const valueRef = useRef(0);

    useEffect(() => {
        const startValue = valueRef.current;
        const endValue = parseInt(value) || 0;
        let startTime = null;

        const animation = (currentTime) => {
            if (!startTime) startTime = currentTime;
            const progress = Math.min((currentTime - startTime) / duration, 1);
            const newDisplayValue = Math.floor(progress * (endValue - startValue) + startValue);
            setDisplayValue(newDisplayValue);
            if (progress < 1) {
                requestAnimationFrame(animation);
            } else {
                valueRef.current = endValue;
            }
        };
        requestAnimationFrame(animation);
        return () => { valueRef.current = parseInt(value) || 0; };
    }, [value, duration]);

    return <span className="stat-value-animation">{displayValue}</span>;
};

const FullStatsModal = ({ stats, onClose }) => {
    if (!stats) return null;

    const renderTeamDetails = (teamData, homeOrAway) => {
        if (!teamData) return <p>Datos no disponibles</p>;
        const formString = (teamData.form || '').slice(-5);
        return (
            <div style={styles.modalTeamColumn}>
                <div style={styles.preMatchTeamHeader}>
                    <img src={teamData.logo} alt={teamData.name} style={styles.preMatchTeamLogo} onError={(e) => { e.target.src = 'https://placehold.co/60x60/1b263b/e0e1dd?text=?'; }} />
                    <span style={styles.preMatchTeamName}>{teamData.name}</span>
                </div>
                <div style={styles.modalStatSection}>
                    <h4>Últimos 5 Partidos</h4>
                    <div style={styles.preMatchFormContainer}>
                        {formString.split('').map((result, index) => {
                            let backgroundColor = styles.colors.darkUIAlt;
                            let letter = '?';
                            if (result.toLowerCase() === 'w') { backgroundColor = styles.colors.success; letter = 'V'; }
                            else if (result.toLowerCase() === 'd') { backgroundColor = styles.colors.warning; letter = 'E'; }
                            else if (result.toLowerCase() === 'l') { backgroundColor = styles.colors.danger; letter = 'D'; }
                            return (<span key={index} style={{ ...styles.preMatchFormIndicator, backgroundColor }}>{letter}</span>);
                        })}
                    </div>
                </div>
                <div style={styles.modalStatSection}>
                    <h4>Estadísticas ({homeOrAway})</h4>
                    <div style={styles.preMatchStatItem}><span>Partidos Jugados</span> <strong>{teamData.statsHomeOrAway?.played || 'N/A'}</strong></div>
                    <div style={styles.preMatchStatItem}><span>Victorias</span> <strong>{teamData.statsHomeOrAway?.win || 'N/A'}</strong></div>
                    <div style={styles.preMatchStatItem}><span>Empates</span> <strong>{teamData.statsHomeOrAway?.draw || 'N/A'}</strong></div>
                    <div style={styles.preMatchStatItem}><span>Derrotas</span> <strong>{teamData.statsHomeOrAway?.lose || 'N/A'}</strong></div>
                    <div style={styles.preMatchStatItem}><span>Goles</span> <strong>{teamData.statsHomeOrAway?.goals?.for || 'N/A'}:{teamData.statsHomeOrAway?.goals?.against || 'N/A'}</strong></div>
                </div>
                <div style={styles.modalStatSection}>
                    <h4>Máximos Goleadores</h4>
                    {teamData.topScorers && teamData.topScorers.length > 0 ? (
                        <ul style={styles.topScorersList}>
                            {teamData.topScorers.slice(0, 3).map((scorer, index) => (
                                <li key={index}>
                                    <span>{scorer.player.name}</span>
                                    <strong>{scorer.statistics[0].goals.total} Goles</strong>
                                </li>
                            ))}
                        </ul>
                    ) : <p>No disponible</p>}
                </div>
            </div>
        );
    };

    return (
        <div style={styles.modalOverlay} onClick={onClose}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <h3 style={styles.title}>COMPARADOR COMPLETO</h3>
                <div style={styles.modalComparison}>
                    {renderTeamDetails(stats.local, 'Local')}
                    <div style={styles.preMatchVS}>VS</div>
                    {renderTeamDetails(stats.visitante, 'Visitante')}
                </div>
                <button onClick={onClose} style={{...styles.mainButton, marginTop: '30px'}}>CERRAR</button>
            </div>
        </div>
    );
};


const PreMatchStats = ({ stats, lastUpdated, onOpenModal }) => {
    const [pulsing, setPulsing] = useState(false);

    useEffect(() => {
        if (lastUpdated) {
            setPulsing(true);
            const timer = setTimeout(() => setPulsing(false), 1000);
            return () => clearTimeout(timer);
        }
    }, [lastUpdated]);

    if (!stats) return null;

    const renderTeamStats = (teamData) => {
        const logo = teamData?.logo || 'https://placehold.co/60x60/1b263b/e0e1dd?text=?';
        if (!teamData) return <div style={styles.preMatchTeamContainer}><p>Datos no disponibles</p></div>;

        return (
            <div style={styles.preMatchTeamContainer}>
                <img src={logo} alt={teamData.name} style={styles.preMatchTeamLogo} onError={(e) => { e.target.src = 'https://placehold.co/60x60/1b263b/e0e1dd?text=?'; }} />
                <div style={styles.preMatchStatsBody}>
                    <div style={styles.preMatchStatItem}><span>Posición</span> <strong><AnimatedStat value={teamData.rank} />º</strong></div>
                    <div style={styles.preMatchStatItem}><span>Puntos</span> <strong><AnimatedStat value={teamData.points} /></strong></div>
                    <div style={styles.preMatchStatItem}><span>Goles</span> <strong><AnimatedStat value={teamData.golesFavor} />:<AnimatedStat value={teamData.golesContra} /></strong></div>
                </div>
            </div>
        );
    };

    return (
        <div className={pulsing ? 'pulse-animation' : ''} style={styles.preMatchContainer}>
            <div style={styles.preMatchTitleContainer}>
                <h4 style={styles.preMatchTitle} className="app-title">ESTADÍSTICAS</h4>
                <div style={styles.lastUpdatedContainer}>
                    <span className="live-dot-animation" style={styles.liveDot}></span>
                    <span>Actualizado: {new Date(lastUpdated).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            </div>
            <div style={styles.preMatchComparison}>
                {renderTeamStats(stats.local)}
                <div style={styles.preMatchVS}>VS</div>
                {renderTeamStats(stats.visitante)}
            </div>
            <button onClick={onOpenModal} style={{...styles.secondaryButton, width: '100%', marginTop: '15px'}}>Ver Comparador Completo</button>
        </div>
    );
};


// --- NUEVO: Modal de Confirmación de Pronóstico ---
const ConfirmacionPronosticoModal = ({ pronostico, onConfirm, onCancel }) => {
    return (
        <div style={styles.modalOverlay}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <h3 style={styles.title}>CONFIRMAR PRONÓSTICO</h3>
                <p style={{textAlign: 'center', marginBottom: '20px'}}>Por favor, revisa que tu pronóstico es correcto antes de guardarlo:</p>
                <div style={styles.confirmacionResumen}>
                    <p><strong>Resultado:</strong> {pronostico.golesLocal} - {pronostico.golesVisitante}</p>
                    <p><strong>1X2:</strong> {pronostico.resultado1x2 || 'No seleccionado'}</p>
                    <p><strong>Goleador:</strong> {pronostico.sinGoleador ? 'Sin Goleador' : (pronostico.goleador || 'No seleccionado')}</p>
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

// --- NUEVO: Modal para ver el Historial de Cambios ---
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
                                        <p><strong>Goleador:</strong> {entrada.pronostico.sinGoleador ? 'SG' : (entrada.pronostico.goleador || 'N/A')}</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p>No hay historial de cambios para este pronóstico.</p>
                        )
                    )}
                </div>
                <button onClick={onClose} style={{...styles.mainButton, marginTop: '20px'}}>Cerrar</button>
            </div>
        </div>
    );
};

// --- NUEVO: Componente para los paneles de análisis en vivo ---
const LiveAnalysisPanels = ({ jornada, liveData, participantes, userProfiles, clasificacionData }) => {
    
    // Panel 1: Ganador Provisional y Simulaciones
    const liveWinnerPanelData = useMemo(() => {
        if (!liveData || !jornada || participantes.length === 0) {
            return { currentWinner: "Nadie", simulationLocal: "Nadie", simulationVisitor: "Nadie", impacto: "" };
        }
        
        const findWinner = (simulatedLiveData) => {
            const ranking = participantes.map(p => ({
                id: p.id,
                puntos: calculateProvisionalPoints(p, simulatedLiveData, jornada)
            })).sort((a, b) => b.puntos - a.puntos);

            if (ranking.length > 0 && ranking[0].puntos > 0) {
                const topScore = ranking[0].puntos;
                const winners = ranking.filter(p => p.puntos === topScore);
                return {
                    name: winners.length > 1 ? "Empate" : winners[0].id,
                    points: topScore,
                    winnerData: winners.length === 1 ? winners[0] : null
                };
            }
            return { name: "Nadie", points: 0, winnerData: null };
        };

        const { name: currentWinner, winnerData: currentWinnerData } = findWinner(liveData);
        
        // Cálculo del impacto en la clasificación (simplificado)
        let impacto = "";
        if (currentWinnerData && clasificacionData.length > 0) {
            const currentPointsInGeneral = clasificacionData.find(j => j.id === currentWinnerData.id)?.puntosTotales || 0;
            const newTotalPoints = currentPointsInGeneral + currentWinnerData.points;
            
            const currentRank = clasificacionData.findIndex(j => j.id === currentWinnerData.id) + 1;
            
            // Simular nueva clasificación
            const simulatedClasificacion = clasificacionData.map(j => {
                if (j.id === currentWinnerData.id) {
                    return { ...j, puntosTotales: newTotalPoints };
                }
                return j;
            }).sort((a, b) => b.puntosTotales - a.puntosTotales);

            const newRank = simulatedClasificacion.findIndex(j => j.id === currentWinnerData.id) + 1;
            
            if (newRank < currentRank) {
                impacto = `(subiría al ${newRank}º)`;
            }
        }

        const localGoalLiveData = { ...liveData, golesLocal: liveData.golesLocal + 1, ultimoGoleador: '' };
        const { name: simulationLocal } = findWinner(localGoalLiveData);

        const visitorGoalLiveData = { ...liveData, golesVisitante: liveData.golesVisitante + 1, ultimoGoleador: '' };
        const { name: simulationVisitor } = findWinner(visitorGoalLiveData);

        return { currentWinner, simulationLocal, simulationVisitor, impacto };

    }, [liveData, jornada, participantes, clasificacionData]);

    // Panel 2: Acierto de Goleador
    const acertantesGoleador = useMemo(() => {
        if (!liveData.ultimoGoleador || liveData.ultimoGoleador === 'SG') return [];
        return participantes.filter(p => p.goleador && p.goleador.trim().toLowerCase() === liveData.ultimoGoleador.trim().toLowerCase());
    }, [liveData.ultimoGoleador, participantes]);

    // Panel 3: Descartados
    const descartados = useMemo(() => {
        return participantes.filter(p => {
            const pLocal = parseInt(p.golesLocal);
            const pVisitante = parseInt(p.golesVisitante);
            if (isNaN(pLocal) || isNaN(pVisitante)) return false;
            return pLocal < liveData.golesLocal || pVisitante < liveData.golesVisitante;
        });
    }, [liveData.golesLocal, liveData.golesVisitante, participantes]);

    return (
        <div style={styles.liveAnalysisContainer}>
            {/* Panel de Ganador Provisional */}
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
                    <div style={styles.liveWinnerSimulationItem}>
                        <span style={styles.liveWinnerLabel}>Si marca {jornada.equipoLocal}...</span>
                        <div style={styles.liveWinnerName}>
                             <PlayerProfileDisplay name={liveWinnerPanelData.simulationLocal} profile={userProfiles[liveWinnerPanelData.simulationLocal]} />
                        </div>
                    </div>
                    <div style={styles.liveWinnerSimulationItem}>
                        <span style={styles.liveWinnerLabel}>Si marca {jornada.equipoVisitante}...</span>
                        <div style={styles.liveWinnerName}>
                             <PlayerProfileDisplay name={liveWinnerPanelData.simulationVisitor} profile={userProfiles[liveWinnerPanelData.simulationVisitor]} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Panel Acierto Goleador */}
            <div style={styles.liveAnalysisCard}>
                <h4 style={styles.liveAnalysisTitle}>🎯 Acierto Último Goleador</h4>
                {acertantesGoleador.length > 0 ? (
                     <ul style={styles.liveAnalysisList}>
                        {acertantesGoleador.map(p => (
                            <li key={p.id} style={styles.liveAnalysisListItem}><PlayerProfileDisplay name={p.id} profile={userProfiles[p.id]} /></li>
                        ))}
                    </ul>
                ) : <p style={{textAlign: 'center', color: colors.silver}}>Nadie ha acertado el último goleador.</p>}
            </div>

            {/* Panel Descartados */}
            <div style={styles.liveAnalysisCard}>
                <h4 style={styles.liveAnalysisTitle}>❌ Descartados</h4>
                 {descartados.length > 0 ? (
                     <ul style={styles.liveAnalysisList}>
                        {descartados.map(p => (
                            <li key={p.id} style={styles.liveAnalysisListItem}><PlayerProfileDisplay name={p.id} profile={userProfiles[p.id]} /></li>
                        ))}
                    </ul>
                ) : <p style={{textAlign: 'center', color: colors.silver}}>Nadie ha sido descartado aún.</p>}
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
    
    // --- MODIFICACIÓN: Estados para la nueva lógica de API ---
    const [preMatchStats, setPreMatchStats] = useState(null);
    const [fullPreMatchStats, setFullPreMatchStats] = useState(null); // Para el modal
    const [showStatsModal, setShowStatsModal] = useState(false);
    const [loadingPreMatch, setLoadingPreMatch] = useState(false);
    const [lastApiUpdate, setLastApiUpdate] = useState(null);
    const apiTimerRef = useRef(null);
    const lastApiCallDay = useRef(null); // Formato YYYY-MM-DD
    
    // --- NUEVO: Estados para confirmación e historial ---
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
            // MODIFICADO: Nueva lógica para encontrar la jornada relevante
            const todasLasJornadas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            let jornadaActiva = todasLasJornadas.find(j => ['En vivo', 'Abierta', 'Pre-apertura', 'Cerrada'].includes(j.estado));
            
            if (!jornadaActiva) {
                const finalizadas = todasLasJornadas.filter(j => j.estado === 'Finalizada').sort((a, b) => b.numeroJornada - a.numeroJornada);
                if (finalizadas.length > 0) { jornadaActiva = finalizadas[0]; }
            }

            if(jornadaActiva){
                setCurrentJornada(prevJornada => {
                    if (prevJornada && prevJornada.id !== jornadaActiva.id) {
                        setPreMatchStats(null); setFullPreMatchStats(null); lastApiCallDay.current = null;
                    }
                    return jornadaActiva;
                });

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
                setCurrentJornada(null); setLoading(false); setPreMatchStats(null); setFullPreMatchStats(null);
                const ultimaFinalizada = todasLasJornadas.filter(j => j.estado === 'Finalizada' && j.id !== 'jornada_test').sort((a, b) => b.numeroJornada - a.numeroJornada)[0];
                if (ultimaFinalizada) {
                    getDoc(doc(db, "pronosticos", ultimaFinalizada.id, "jugadores", user)).then(pronosticoSnap => {
                        if (pronosticoSnap.exists()) {
                            setInterJornadaStatus({ status: pronosticoSnap.data().pagado ? 'pagado' : 'debe', jornada: ultimaFinalizada });
                        } else {
                            setInterJornadaStatus({ status: 'no_participo', jornada: ultimaFinalizada });
                        }
                    });
                } else {
                    const proximaJornada = todasLasJornadas.find(j => j.estado === 'Próximamente');
                    setInterJornadaStatus({ status: 'sin_finalizadas', proxima: proximaJornada });
                }
            }
        }, (error) => { console.error("Error: ", error); setLoading(false); });
        return () => unsubscribe();
    }, [user]);

    // CORRECCIÓN: Se añade preMatchStats al array de dependencias.
    useEffect(() => {
        if (apiTimerRef.current) { clearInterval(apiTimerRef.current); apiTimerRef.current = null; }
        // MODIFICADO: La lógica de API se activa también en Pre-apertura
        if (!currentJornada || !currentJornada.fechaPartido || !currentJornada.apiLeagueId || !currentJornada.apiLocalTeamId || !currentJornada.apiVisitorTeamId || !['Abierta', 'Pre-apertura', 'Cerrada', 'En vivo'].includes(currentJornada.estado)) { return; }
        const fetchHeaders = { "x-rapidapi-host": "v3.football.api-sports.io", "x-rapidapi-key": API_FOOTBALL_KEY };
        const fetchTeamStats = async (leagueId, teamId, season) => {
            try {
                const response = await fetch(`https://v3.football.api-sports.io/standings?league=${leagueId}&season=${season}&team=${teamId}`, { headers: fetchHeaders });
                if (!response.ok) throw new Error(`API call failed: ${response.status}`);
                const data = await response.json();
                if (data.results === 0 || !data.response[0]) { console.warn(`No data for team ${teamId}`); return null; }
                const teamStanding = data.response[0]?.league?.standings[0]?.[0];
                return { name: teamStanding?.team?.name || 'N/A', logo: teamStanding?.team?.logo || '', rank: teamStanding?.rank || 'N/A', points: teamStanding?.points || 'N/A', form: teamStanding?.form || '-----', golesFavor: teamStanding?.all?.goals?.for || 0, golesContra: teamStanding?.all?.goals?.against || 0, statsHomeOrAway: teamStanding?.home?.team?.id === teamId ? teamStanding.home : teamStanding.away, };
            } catch (error) { console.error(`Error fetching stats for team ${teamId}:`, error); return null; }
        };
        const fetchTopScorers = async (leagueId, teamId, season) => {
             try {
                const response = await fetch(`https://v3.football.api-sports.io/players/topscorers?league=${leagueId}&season=${season}&team=${teamId}`, { headers: fetchHeaders });
                 if (!response.ok) throw new Error(`API call failed: ${response.status}`);
                 const data = await response.json(); return data.response || [];
             } catch (error) { console.error(`Error fetching top scorers for team ${teamId}:`, error); return []; }
        };
        const fetchData = async () => {
            console.log(`[${new Date().toLocaleTimeString()}] Fetching API data...`);
            setLoadingPreMatch(true);
            const season = new Date(currentJornada.fechaPartido.seconds * 1000).getFullYear();
            const [localStats, visitorStats, localScorers, visitorScorers] = await Promise.all([
                fetchTeamStats(currentJornada.apiLeagueId, currentJornada.apiLocalTeamId, season),
                fetchTeamStats(currentJornada.apiLeagueId, currentJornada.apiVisitorTeamId, season),
                fetchTopScorers(currentJornada.apiLeagueId, currentJornada.apiLocalTeamId, season),
                fetchTopScorers(currentJornada.apiLeagueId, currentJornada.apiVisitorTeamId, season)
            ]);
            if (localStats && visitorStats) {
                const statsData = { local: {...localStats, topScorers: localScorers}, visitante: {...visitorStats, topScorers: visitorScorers} };
                setPreMatchStats(statsData); setFullPreMatchStats(statsData); setLastApiUpdate(Date.now());
            }
            setLoadingPreMatch(false);
        };
        const manageUpdates = () => {
            const now = new Date();
            const matchTime = currentJornada.fechaPartido.toDate();
            const oneHourBefore = new Date(matchTime.getTime() - 60 * 60 * 1000);
            const isMatchDay = now.toDateString() === matchTime.toDateString();
            const isPreMatchWindow = isMatchDay && now >= oneHourBefore && now < matchTime;
            if (apiTimerRef.current) clearInterval(apiTimerRef.current);
            if (isPreMatchWindow) {
                console.log("Entering PRE-MATCH update mode (every 5 minutes).");
                if(!preMatchStats) fetchData();
                apiTimerRef.current = setInterval(fetchData, 5 * 60 * 1000);
            } else {
                const todayStr = now.toISOString().split('T')[0];
                if (now.getHours() >= 22 && lastApiCallDay.current !== todayStr) {
                    console.log("Performing DAILY update (after 22:00).");
                    fetchData(); lastApiCallDay.current = todayStr;
                }
                apiTimerRef.current = setInterval(manageUpdates, 60 * 1000);
            }
        };
        if (!preMatchStats) { fetchData(); }
        manageUpdates();
        return () => { if (apiTimerRef.current) { clearInterval(apiTimerRef.current); apiTimerRef.current = null; } };
    }, [currentJornada, preMatchStats]);
    
    useEffect(() => {
        // MODIFICADO: Se activa con estado "En vivo"
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
             setMessage({text: 'Debes rellenar todos los campos: Resultado, 1X2 y Goleador (o marcar Sin Goleador).', type: 'error'});
             return;
        }
        if (pronostico.pin && pronostico.pin !== pronostico.pinConfirm) { setMessage({text: 'Los PIN no coinciden. Por favor, revísalos.', type: 'error'}); return; }
        const cleanJokerPronosticos = pronostico.jokerPronosticos.filter(p => p.golesLocal !== '' || p.golesVisitante !== '');
        if (pronostico.jokerActivo && cleanJokerPronosticos.length === 0) { setMessage({text: 'Has activado el Joker. Debes rellenar al menos una apuesta Joker o usar el Botón del Pánico.', type: 'error'}); return; }
        
        setPronosticoParaConfirmar(pronostico);
        setShowConfirmacionModal(true);
    };

    const handleGuardarPronostico = async () => {
        setShowConfirmacionModal(false);
        setIsSaving(true); 
        setMessage({text: '', type: 'info'});
        
        const pronosticoRef = doc(db, "pronosticos", currentJornada.id, "jugadores", user);
        const historialRef = collection(pronosticoRef, "historial");
        const userJokerRef = doc(db, "clasificacion", user);
        
        const jokerJustActivated = pronostico.jokerActivo && !initialJokerStatus.current;
        const cleanJokerPronosticos = pronostico.jokerPronosticos.filter(p => p.golesLocal !== '' || p.golesVisitante !== '');
        
        try {
            const batch = writeBatch(db);
            const { pinConfirm, ...pronosticoToSave } = pronostico;
            
            batch.set(pronosticoRef, { ...pronosticoToSave, jokerPronosticos: cleanJokerPronosticos, lastUpdated: serverTimestamp() });
            
            const historialData = {
                pronostico: { golesLocal: pronostico.golesLocal, golesVisitante: pronostico.golesVisitante, resultado1x2: pronostico.resultado1x2, goleador: pronostico.goleador, sinGoleador: pronostico.sinGoleador, },
                timestamp: serverTimestamp()
            };
            await addDoc(historialRef, historialData);

            if (jokerJustActivated) {
                batch.update(userJokerRef, { jokersRestantes: increment(-1) });
            }
            
            await batch.commit();
            
            if (jokerJustActivated) { 
                setJokersRestantes(prev => prev - 1); 
                initialJokerStatus.current = true; 
            }
            
            setMessage({text: '¡Pronóstico guardado y secreto!', type: 'success'});
            setHasSubmitted(true); 
            setIsLocked(!!pronostico.pin);
            
        } catch (error) { 
            console.error("Error al guardar: ", error); 
            setMessage({text: 'Error al guardar el pronóstico.', type: 'error'}); 
        }
        
        setIsSaving(false);
    };


    const handleUnlock = () => { if (pinInput === pronostico.pin) { setIsLocked(false); setHasSubmitted(false); setMessage({text: 'Pronóstico desbloqueado. Puedes hacer cambios.', type: 'info'}); } else { alert('PIN incorrecto'); } };
    
    const handleActivarJoker = () => {
        if (jokersRestantes <= 0) { alert("No te quedan Jokers esta temporada."); return; }
        if (window.confirm("¿Seguro que quieres usar un JOKER? Se añadirán 10 casillas de apuesta. El Joker se descontará cuando guardes el pronóstico.")) {
            setShowJokerAnimation(true);
            setTimeout(() => setShowJokerAnimation(false), 7000);
            setHasSubmitted(false); setIsLocked(false);
            setPronostico(prev => ({ ...prev, jokerActivo: true, jokerPronosticos: Array(10).fill({golesLocal: '', golesVisitante: ''}) }));
            setMessage({ text: '¡Joker activado! Rellena tus 10 apuestas extra y no olvides Guardar.', type: 'success' });
        }
    };

    const handleBotonDelPanico = async () => { if (window.confirm("¿Seguro que quieres cancelar tus apuestas JOKER? No recuperarás el JOKER gastado, pero tus 10 apuestas adicionales se borrarán.")) { setPronostico(prev => ({ ...prev, jokerPronosticos: Array(10).fill({golesLocal: '', golesVisitante: ''}) })); setMessage({text: 'Apuestas JOKER eliminadas. Recuerda guardar para confirmar los cambios.', type: 'info'}); } };
    
    const handleMarcarComoPagado = async () => {
        if (!currentJornada) return;
        setShowLiquidarPagoModal(false);
        try {
            await updateDoc(doc(db, "pronosticos", currentJornada.id, "jugadores", user), { pagoConfirmadoPorUsuario: true });
            setPronostico(prev => ({...prev, pagoConfirmadoPorUsuario: true}));
            setMessage({text: '¡Confirmación de pago enviada al admin!', type: 'success'});
        } catch (error) { 
            console.error("Error al confirmar pago: ", error); 
            setMessage({text: 'Error al enviar la confirmación.', type: 'error'}); 
        }
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
        if (!pronosticoData) {
            return <p>No participaste en esta jornada.</p>;
        }
        return (
            <div style={styles.renderedPronosticoContainer}>
                <h4 style={styles.renderedPronosticoTitle} className="app-title">Tu Apuesta Realizada</h4>
                <div style={styles.resumenJugadorBets}>
                    <p><strong>Resultado:</strong> {pronosticoData.golesLocal}-{pronosticoData.golesVisitante}</p>
                    <p><strong>1X2:</strong> {pronosticoData.resultado1x2}</p>
                    <p><strong>Goleador:</strong> {pronosticoData.sinGoleador ? 'Sin Goleador' : (pronosticoData.goleador || 'N/A')}</p>
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
            return (
                <form onSubmit={handleValidationAndConfirm} style={styles.form}>
                    {currentJornada.bote > 0 && <div style={styles.jackpotBanner}>💰 JACKPOT: ¡{currentJornada.bote}€ DE BOTE! 💰</div>}
                    {isVip && (<div style={styles.vipBanner}>⭐ JORNADA VIP ⭐ (Apuesta: 2€ - Puntos Dobles)</div>)}
                    <h3 style={styles.formSectionTitle} className="app-title">{currentJornada.id === 'jornada_test' ? 'Jornada de Prueba' : `Jornada ${currentJornada.numeroJornada}`}: {currentJornada.equipoLocal} vs {currentJornada.equipoVisitante}</h3>
                    
                    {!hasSubmitted && <button type="button" onClick={handleCopyLastBet} style={styles.secondaryButton}>Copiar mi última apuesta</button>}

                    {hasSubmitted && isLocked ? (
                        <div style={styles.placeholder}><h3>¡Pronóstico guardado y secreto!</h3><p>Tu apuesta está protegida con PIN. Podrás ver los pronósticos de todos cuando la jornada se cierre.</p><div style={{marginTop: '20px'}}><input type="password" maxLength="4" value={pinInput} onChange={(e) => setPinInput(e.target.value)} style={styles.input} placeholder="PIN de 4 dígitos" /><button type="button" onClick={handleUnlock} style={styles.mainButton}>Desbloquear</button></div></div>
                    ) : hasSubmitted && !isLocked ? (
                         <div style={styles.placeholder}><h3>¡Pronóstico guardado!</h3><p>Tu apuesta no está protegida con PIN. Cualquiera podría modificarla si accede con tu perfil. Puedes añadir un PIN y volver a guardar.</p><button type="button" onClick={() => { setIsLocked(false); setHasSubmitted(false); }} style={styles.mainButton}>Modificar Apuesta</button></div>
                    ) : (
                        <fieldset style={{border: 'none', padding: 0, margin: 0}}>
                            <fieldset style={{border: 'none', padding: 0, margin: 0}} >
                                <div style={styles.formGroup}><label style={styles.label}>RESULTADO EXACTO <span style={styles.pointsReminder}>( {isVip ? '6' : '3'} Puntos )</span></label><div style={styles.miJornadaMatchInfo}><TeamDisplay teamLogos={teamLogos} teamName={currentJornada.equipoLocal} shortName={true} imgStyle={styles.miJornadaTeamLogo} /><div style={styles.miJornadaScoreInputs}><input type="tel" inputMode="numeric" pattern="[0-9]*" name="golesLocal" value={pronostico.golesLocal} onChange={handlePronosticoChange} style={styles.resultInput} /><span style={styles.separator}>-</span><input type="tel" inputMode="numeric" pattern="[0-9]*" name="golesVisitante" value={pronostico.golesVisitante} onChange={handlePronosticoChange} style={styles.resultInput} /></div><TeamDisplay teamLogos={teamLogos} teamName={currentJornada.equipoVisitante} shortName={true} imgStyle={styles.miJornadaTeamLogo} /></div>{(pronostico.golesLocal !== '' && pronostico.golesVisitante !== '') && <small key={stats.count} className="stats-indicator" style={{...styles.statsIndicator, color: stats.color}}>{stats.count > 0 ? `Otros ${stats.count} jugador(es) han pronosticado este resultado.` : '¡Eres el único con este resultado por ahora!'}</small>}</div>
                                <div style={styles.formGroup}><label style={styles.label}>RESULTADO 1X2 <span style={styles.pointsReminder}>( {isVip ? '2' : '1'} Puntos )</span></label><select name="resultado1x2" value={pronostico.resultado1x2} onChange={handlePronosticoChange} style={styles.input}><option value="">-- Elige --</option><option value="Gana UD Las Palmas">Gana UDLP</option><option value="Empate">Empate</option><option value="Pierde UD Las Palmas">Pierde UDLP</option></select></div>
                                
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>PRIMER GOLEADOR <span style={styles.pointsReminder}>( {isVip ? '4' : '2'} Puntos )</span></label>
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
                                        <p style={{textAlign: 'center', marginBottom: '15px'}}>Añade hasta 10 resultados exactos adicionales. Cada uno cuenta como una apuesta para el bote.</p>
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

        // --- NUEVO: Lógica para el estado "Pre-apertura" ---
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
                     <p style={{marginTop: '20px'}}>Puedes consultar las estadísticas pre-partido mientras esperas.</p>
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
        {showStatsModal && <FullStatsModal stats={fullPreMatchStats} onClose={() => setShowStatsModal(false)} />}
        {showLiquidarPagoModal && <LiquidarPagoModal onClose={() => setShowLiquidarPagoModal(false)} onConfirm={handleMarcarComoPagado} />}
        {showConfirmacionModal && <ConfirmacionPronosticoModal pronostico={pronosticoParaConfirmar} onConfirm={handleGuardarPronostico} onCancel={() => setShowConfirmacionModal(false)} />}
        {tieneDeuda && !interJornadaStatus && (<div style={styles.debtBanner}>⚠️ Tienes pendiente el pago de la jornada anterior. Por favor, ve a la sección de "Pagos" para regularizarlo.</div>)}
        <h2 style={styles.title} className="app-title">MI JORNADA</h2>
        <p style={{color: styles.colors.lightText, textAlign: 'center', fontSize: '1.1rem'}}>Bienvenido, <PlayerProfileDisplay name={user} profile={userProfile} defaultColor={styles.colors.yellow} style={{fontWeight: 'bold'}} /></p>
        
        {currentJornada && (['Abierta', 'Pre-apertura', 'Cerrada', 'En vivo'].includes(currentJornada.estado)) && (
            <>
                {loadingPreMatch && !preMatchStats && <div style={{textAlign: 'center', padding: '20px'}}><p>Cargando estadísticas pre-partido...</p></div>}
                {preMatchStats && <PreMatchStats stats={preMatchStats} lastUpdated={lastApiUpdate} onOpenModal={() => setShowStatsModal(true)} />}
            </>
        )}

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
    const [porraAnualConfig, setPorraAnualConfig] = useState(null);
    const [pronosticosAnuales, setPronosticosAnuales] = useState([]);
    const [provisionalRanking, setProvisionalRanking] = useState([]);
    const [jornadaStats, setJornadaStats] = useState(null);
    const [ultimaJornada, setUltimaJornada] = useState(null);
    const [proximaJornada, setProximaJornada] = useState(null);
    const [reactions, setReactions] = useState({}); 
    const [userReactions, setUserReactions] = useState({}); 
    const [animatingReaction, setAnimatingReaction] = useState(null); 
    const [isSubmittingReaction, setIsSubmittingReaction] = useState({});

    // --- NUEVO: Estados para el historial ---
    const [showHistorialModal, setShowHistorialModal] = useState(false);
    const [historialSeleccionado, setHistorialSeleccionado] = useState([]);
    const [loadingHistorial, setLoadingHistorial] = useState(false);


    useEffect(() => {
        // MODIFICADO: La query ahora busca también el estado "En vivo"
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
                setJornadaActual(null);
                setParticipantes([]);
                const qUltima = query(collection(db, "jornadas"), where("estado", "==", "Finalizada"), orderBy("numeroJornada", "desc"), limit(1));
                getDocs(qUltima).then(snap => { if (!snap.empty) { setUltimaJornada({ id: snap.docs[0].id, ...snap.docs[0].data() }); } });
                const qProxima = query(collection(db, "jornadas"), where("estado", "==", "Próximamente"), orderBy("numeroJornada", "asc"), limit(1));
                getDocs(qProxima).then(snap => { if (!snap.empty) { setProximaJornada({ id: snap.docs[0].id, ...snap.docs[0].data() }); } });
            }
            setLoading(false);
        });
        const configRef = doc(db, "configuracion", "porraAnual"); const unsubConfig = onSnapshot(configRef, (doc) => { setPorraAnualConfig(doc.exists() ? doc.data() : null); });
        const pronAnualesRef = collection(db, "porraAnualPronosticos"); const unsubPronAnuales = onSnapshot(pronAnualesRef, (snap) => { setPronosticosAnuales(snap.docs.map(d => ({ id: d.id, ...d.data() }))); });
        return () => { unsubscribeJornada(); unsubConfig(); unsubPronAnuales(); };
    }, []);
    
    useEffect(() => {
        if (jornadaActual) {
            setUserReactions({});
            setReactions({});
            const reactionsRef = doc(db, "reactions", jornadaActual.id);
            const unsubscribeReactions = onSnapshot(reactionsRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setReactions(data.stats || {});
                    if (data.users && data.users[user]) { setUserReactions(data.users[user]); } 
                    else { setUserReactions({}); }
                } else { setReactions({}); setUserReactions({}); }
            });
            return () => unsubscribeReactions();
        }
    }, [jornadaActual, user]);

    useEffect(() => {
        // MODIFICADO: Se activa con estado "En vivo"
        if (jornadaActual?.estado === 'En vivo' && liveData && participantes.length > 0) {
            const ranking = participantes.map(p => {
                const puntos = calculateProvisionalPoints(p, liveData, jornadaActual);
                const aciertoExacto = p.golesLocal !== '' && p.golesVisitante !== '' && parseInt(p.golesLocal) === liveData.golesLocal && parseInt(p.golesVisitante) === liveData.golesVisitante;
                return { id: p.id, puntos, aciertoExacto };
            }).sort((a, b) => {
                if (a.puntos !== b.puntos) { return b.puntos - a.puntos; }
                return (b.aciertoExacto ? 1 : 0) - (a.aciertoExacto ? 1 : 0);
            });
            setProvisionalRanking(ranking);
        } else { setProvisionalRanking([]); }
    }, [liveData, jornadaActual, participantes]);

    useEffect(() => {
        if (!jornadaActual || !jornadaActual.fechaCierre) { setCountdown(''); return; }
        // MODIFICADO: La cuenta atrás depende del estado de la jornada
        const targetDate = jornadaActual.estado === 'Pre-apertura' ? jornadaActual.fechaApertura?.toDate() : jornadaActual.fechaCierre.toDate();
        if (!targetDate) return;

        const interval = setInterval(() => {
            const diff = targetDate - new Date();
            if (diff <= 0) {
                let message = "¡PLAZO FINALIZADO!";
                if (jornadaActual.estado === 'Pre-apertura') message = "¡APUESTAS ABIERTAS!";
                setCountdown(message); clearInterval(interval); return;
            }
            const d = Math.floor(diff / 86400000);
            const h = Math.floor((diff % 86400000) / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setCountdown(`${d}d ${h}h ${m}m ${s}s`);
        }, 1000);
        return () => clearInterval(interval);
    }, [jornadaActual]);

    
    // --- NUEVO: Función para cargar y mostrar el historial de un jugador ---
    const handleVerHistorial = async (jugadorId) => {
        if (!jornadaActual) return;
        setLoadingHistorial(true);
        setShowHistorialModal(true);
        const historialRef = collection(db, "pronosticos", jornadaActual.id, "jugadores", jugadorId, "historial");
        const q = query(historialRef, orderBy("timestamp", "desc"));
        const historialSnap = await getDocs(q);
        const historialData = historialSnap.docs.map(d => d.data());
        setHistorialSeleccionado(historialData);
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
                if (userPreviousReaction && !isSameEmoji) {
                    cardStats[userPreviousReaction] = Math.max(0, (cardStats[userPreviousReaction] || 1) - 1);
                }
                if (isSameEmoji) {
                    cardStats[emoji] = Math.max(0, (cardStats[emoji] || 1) - 1);
                } else {
                    cardStats[emoji] = (cardStats[emoji] || 0) + 1;
                }
                const newUsersData = { ...currentData.users, [user]: { ...currentData.users?.[user], [cardId]: newUserReactionsForCard } };
                const newStatsData = { ...currentData.stats, [cardId]: cardStats };
                transaction.set(reactionRef, { users: newUsersData, stats: newStatsData }, { merge: true });
            });
        } catch (error) {
            console.error("Error al registrar la reacción:", error);
        } finally {
            setIsSubmittingReaction(prev => ({ ...prev, [cardId]: false }));
        }
    };

    if (loading) return <LoadingSkeleton />;
    // MODIFICADO: isLiveView ahora comprueba el estado 'En vivo'
    const isLiveView = jornadaActual?.estado === 'En vivo' && liveData;

    const renderContent = () => {
        if (jornadaActual) {
            const fechaMostrada = jornadaActual.fechaPartido || jornadaActual.fechaCierre;
            const finalScore = jornadaActual.estado === 'Finalizada' 
                ? `${jornadaActual.resultadoLocal} - ${jornadaActual.resultadoVisitante}`
                : (isLiveView ? `${liveData.golesLocal} - ${liveData.golesVisitante}` : 'VS');

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
                            <LiveAnalysisPanels
                                jornada={jornadaActual}
                                liveData={liveData}
                                participantes={participantes}
                                userProfiles={userProfiles}
                                clasificacionData={clasificacionData}
                            />
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
                    
                    {jornadaActual.estado === 'Cerrada' && !isLiveView && (<div><p style={{textAlign: 'center', marginTop: '20px'}}>Las apuestas están cerradas. ¡Estos son los pronósticos!</p><div style={styles.resumenContainer}>{participantes.sort((a, b) => a.id.localeCompare(b.id)).map(p => { const profile = userProfiles[p.id] || {}; return (<div key={p.id} style={styles.resumenJugador}><h4 style={styles.resumenJugadorTitle}><PlayerProfileDisplay name={p.id} profile={profile} defaultColor={styles.colors.yellow} /> <div>{p.jokerActivo && '🃏'} <button onClick={() => handleVerHistorial(p.id)} style={styles.historyButton}>Ver Historial</button></div></h4><div style={styles.resumenJugadorBets}><p><strong>Principal:</strong> {p.golesLocal}-{p.golesVisitante} &nbsp;|&nbsp; <strong>1X2:</strong> {p.resultado1x2} &nbsp;|&nbsp; <strong>Goleador:</strong> {p.sinGoleador ? 'Sin Goleador' : (p.goleador || 'N/A')}</p>{p.jokerActivo && p.jokerPronosticos?.length > 0 && (<div style={{marginTop: '10px'}}><strong>Apuestas Joker:</strong><div style={styles.jokerChipsContainer}>{p.jokerPronosticos.map((jp, index) => (<span key={index} style={styles.jokerDetailChip}>{jp.golesLocal}-{jp.golesVisitante}</span>))}</div></div>)}</div></div>)})}</div></div>)}
                    
                    {isLiveView && (<div><h3 style={styles.provisionalTitle}>Clasificación Provisional</h3><table style={{...styles.table, backgroundColor: 'rgba(0,0,0,0.3)'}}><thead><tr><th style={styles.th}>POS</th><th style={styles.th}>Jugador</th><th style={styles.th}>Puntos</th></tr></thead><tbody>{provisionalRanking.map((jugador, index) => { const profile = userProfiles[jugador.id] || {}; return (<tr key={jugador.id} style={jugador.puntos > 0 && provisionalRanking[0].puntos === jugador.puntos ? styles.provisionalWinnerRow : styles.tr}><td style={styles.tdRank}>{index + 1}º</td><td style={styles.td}><PlayerProfileDisplay name={jugador.id} profile={profile} /> {jugador.aciertoExacto && '🎯'}</td><td style={styles.td}><AnimatedPoints value={jugador.puntos} /></td></tr>)})}</tbody></table></div>)}
                    
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
            <div style={styles.porraAnualContainer}>
                <h3 style={styles.formSectionTitle} className="app-title">⭐ PORRA ANUAL ⭐</h3>
                {porraAnualConfig?.estado === 'Abierta' && <p style={{textAlign: 'center'}}>Las apuestas de los demás serán secretas hasta la Jornada 5. ¡Haz la tuya desde el banner superior!</p>}
                {(porraAnualConfig?.estado === 'Cerrada' || porraAnualConfig?.estado === 'Finalizada') && (
                    <div>
                        <p style={{textAlign: 'center'}}>Apuestas cerradas. Estos son los pronósticos para final de temporada:</p>
                        <div style={styles.resumenContainer}>
                            {pronosticosAnuales.sort((a, b) => a.id.localeCompare(b.id)).map(p => { 
                                const profile = userProfiles[p.id] || {}; 
                                const puntosStyle = {
                                    fontWeight: 'bold',
                                    color: p.puntosObtenidos === 20 ? colors.gold : (p.puntosObtenidos > 0 ? colors.success : colors.lightText)
                                };
                                return (
                                    <div key={p.id} style={styles.resumenJugador}>
                                        <h4 style={styles.resumenJugadorTitle}><PlayerProfileDisplay name={p.id} profile={profile} defaultColor={styles.colors.yellow} /></h4>
                                        <div style={styles.resumenJugadorBets}>
                                            <p><strong>¿Asciende?:</strong> <span style={{color: p.ascenso === 'SI' ? styles.colors.success : styles.colors.danger, fontWeight: 'bold'}}>{p.ascenso}</span></p>
                                            <p><strong>Posición Final:</strong> <span style={{color: styles.colors.yellow, fontWeight: 'bold'}}>{p.posicion}º</span></p>
                                            {porraAnualConfig.estado === 'Finalizada' && <p><strong>Puntos Obtenidos:</strong> <span style={puntosStyle}>{p.puntosObtenidos || 0}</span></p>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
                {porraAnualConfig?.estado !== 'Abierta' && porraAnualConfig?.estado !== 'Cerrada' && porraAnualConfig?.estado !== 'Finalizada' && <p style={{textAlign: 'center'}}>El administrador no ha abierto la porra anual todavía.</p>}
            </div>
        </div>
    );
};

const CalendarioScreen = ({ onViewJornada, teamLogos }) => {
    const [jornadas, setJornadas] = useState([]); const [loading, setLoading] = useState(true);
    useEffect(() => { const q = query(collection(db, "jornadas"), orderBy("numeroJornada")); const unsubscribe = onSnapshot(q, (querySnapshot) => { setJornadas(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); setLoading(false); }, (error) => { console.error("Error cargando calendario: ", error); setLoading(false); }); return () => unsubscribe(); }, []);
    if (loading) return <LoadingSkeleton />;
    return (<div><h2 style={styles.title} className="app-title">CALENDARIO</h2><div style={styles.jornadaList}>{jornadas.map(jornada => {
        const fechaMostrada = jornada.fechaPartido || jornada.fechaCierre;
        return (<div key={jornada.id} style={jornada.esVip ? {...styles.jornadaItem, ...styles.jornadaVip, backgroundImage: `linear-gradient(to right, rgba(23, 42, 69, 0.95), rgba(23, 42, 69, 0.7)), url(${jornada.estadioImageUrl})`} : {...styles.jornadaItem, backgroundImage: `linear-gradient(to right, rgba(23, 42, 69, 0.95), rgba(23, 42, 69, 0.7)), url(${jornada.estadioImageUrl})`}} onClick={() => onViewJornada(jornada.id)}><div style={styles.jornadaInfo}><div style={styles.jornadaTeams}><TeamDisplay teamLogos={teamLogos} teamName={jornada.equipoLocal} imgStyle={{width: 25, height: 25}} /><span style={{color: styles.colors.yellow, margin: '0 10px'}}>vs</span><TeamDisplay teamLogos={teamLogos} teamName={jornada.equipoVisitante} imgStyle={{width: 25, height: 25}} /></div><strong>{jornada.esVip && '⭐ '}{jornada.id === 'jornada_test' ? 'Jornada de Prueba' : `Jornada ${jornada.numeroJornada || 'Copa'}`}</strong>
    <small>{formatFullDateTime(fechaMostrada)} - {jornada.estadio || 'Estadio por confirmar'}</small>
    </div><div style={{...styles.statusBadge, backgroundColor: styles.colors.status[jornada.estado]}}>{jornada.estado}</div></div>)
    })}</div></div>);
};

const AnimatedPointsClasificacion = ({ value }) => {
    const [currentValue, setCurrentValue] = useState(0); const [flash, setFlash] = useState(null); const prevValueRef = useRef(0);
    useEffect(() => { const startValue = prevValueRef.current; const endValue = value || 0; let startTime = null; if (endValue > startValue) { setFlash('up'); } else if (endValue < startValue) { setFlash('down'); }
        const animation = (currentTime) => { if (!startTime) startTime = currentTime; const progress = Math.min((currentTime - startTime) / 1000, 1); const newDisplayValue = Math.floor(progress * (endValue - startValue) + startValue); setCurrentValue(newDisplayValue); if (progress < 1) { requestAnimationFrame(animation); } else { prevValueRef.current = endValue; setTimeout(() => setFlash(null), 700); } };
        requestAnimationFrame(animation); return () => { prevValueRef.current = value || 0; };
    }, [value]);
    const getFlashClass = () => { if (flash === 'up') return 'point-jump-up'; if (flash === 'down') return 'point-jump-down'; return ''; };
    return <span className={getFlashClass()}>{currentValue}</span>;
};

const ClasificacionScreen = ({ currentUser, liveData, liveJornada, userProfiles }) => {
    const [clasificacion, setClasificacion] = useState([]); 
    const [loading, setLoading] = useState(true); 
    const [livePronosticos, setLivePronosticos] = useState([]);

    useEffect(() => { 
        const qClasificacion = query(collection(db, "clasificacion")); 
        const unsubscribe = onSnapshot(qClasificacion, (querySnapshot) => { 
            const clasificacionData = {}; 
            querySnapshot.forEach((doc) => { 
                clasificacionData[doc.id] = { id: doc.id, ...doc.data() }; 
            }); 
            const processedData = JUGADORES.map(jugadorId => { 
                return clasificacionData[jugadorId] || { 
                    id: jugadorId, 
                    jugador: jugadorId, 
                    puntosTotales: 0,
                    puntosResultadoExacto: 0,
                    puntosGoleador: 0,
                    puntos1x2: 0,
                    plenos: 0,
                    jokersRestantes: 2, 
                    badges: [] 
                }; 
            }); 
            setClasificacion(processedData); 
            setLoading(false); 
        }, (error) => { 
            console.error("Error al cargar la clasificación: ", error); 
            setLoading(false); 
        }); 
        return () => unsubscribe();
    }, []);

    useEffect(() => { 
        if (liveJornada) { 
            const pronosticosRef = collection(db, "pronosticos", liveJornada.id, "jugadores"); 
            const unsubscribe = onSnapshot(pronosticosRef, (snapshot) => { 
                setLivePronosticos(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))); 
            }); 
            return () => unsubscribe(); 
        } else { 
            setLivePronosticos([]); 
        } 
    }, [liveJornada]);

    const liveClasificacion = useMemo(() => { 
        const isLive = liveData && liveJornada && liveJornada.estado === 'En vivo';
        const liveScores = new Map(); 
        if (isLive) { 
            livePronosticos.forEach(p => { 
                const puntosProvisionales = calculateProvisionalPoints(p, liveData, liveJornada); 
                liveScores.set(p.id, puntosProvisionales); 
            }); 
        } 
        const sorted = [...clasificacion].map(jugador => ({ 
            ...jugador, 
            puntosEnVivo: (jugador.puntosTotales || 0) + (liveScores.get(jugador.id) || 0) 
        })).sort((a, b) => { 
            const pointsA = isLive ? a.puntosEnVivo : (a.puntosTotales || 0); 
            const pointsB = isLive ? b.puntosEnVivo : (b.puntosTotales || 0); 
            return pointsB - pointsA; 
        }); 
        return sorted; 
    }, [clasificacion, liveData, liveJornada, livePronosticos]);

    if (loading) return <LoadingSkeleton type="table" />; 
    
    const isLive = liveData && liveJornada && liveJornada.estado === 'En vivo';

    const getRankStyle = (index, jugador) => { 
        let style = {};
        if (index === 0) style = styles.leaderRow;
        else if (index === 1) style = styles.secondPlaceRow;
        else if (index === 2) style = styles.thirdPlaceRow;
        
        if (jugador.id === currentUser) {
            style = {...style, ...styles.currentUserRow}; 
        }
        return style; 
    };

    return (
        <div>
            <h2 style={styles.title} className="app-title">CLASIFICACIÓN</h2>
            <div style={{overflowX: 'auto'}}>
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={{...styles.th, width: '5%'}}>POS</th>
                            <th style={{...styles.th, width: '30%'}}>JUGADOR</th>
                            <th style={{...styles.th, width: '15%', textAlign: 'center'}}>TOTAL {isLive && '(VIVO)'}</th>
                            <th style={{...styles.th, width: '12.5%', textAlign: 'center'}}>P. EXACTO</th>
                            <th style={{...styles.th, width: '12.5%', textAlign: 'center'}}>P. GOLEADOR</th>
                            <th style={{...styles.th, width: '12.5%', textAlign: 'center'}}>P. 1X2</th>
                            <th style={{...styles.th, width: '12.5%', textAlign: 'center'}}>PLENOS 🎯</th>
                        </tr>
                    </thead>
                    <tbody>
                        {liveClasificacion.map((jugador, index) => { 
                            const profile = {...(userProfiles[jugador.id] || {}), badges: jugador.badges || []}; 
                            const puntosAMostrar = isLive ? jugador.puntosEnVivo : jugador.puntosTotales;

                            return (
                                <tr key={jugador.id} style={{...styles.tr, ...getRankStyle(index, jugador)}}>
                                    <td style={styles.tdRank}>{index + 1}º</td>
                                    <td style={styles.td}>
                                        <PlayerProfileDisplay name={jugador.jugador || jugador.id} profile={profile} />
                                    </td>
                                    <td style={styles.tdTotalPoints}>
                                        <AnimatedPointsClasificacion value={puntosAMostrar} />
                                    </td>
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

const PagosScreen = ({ user, userProfiles }) => {
    const [jornadas, setJornadas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [financialSummary, setFinancialSummary] = useState({ boteActual: 0, totalRecaudado: 0, totalRepartido: 0 });
    const [debtSummary, setDebtSummary] = useState({});

    useEffect(() => {
        const q = query(collection(db, "jornadas"), orderBy("numeroJornada"));
        const unsubscribe = onSnapshot(q, (jornadasSnap) => {
            const jornadasData = jornadasSnap.docs.map(jornadaDoc => ({ id: jornadaDoc.id, ...jornadaDoc.data() }));
            const promises = jornadasData.map(jornada => getDocs(collection(db, "pronosticos", jornada.id, "jugadores")));
            Promise.all(promises).then(pronosticosSnaps => {
                let totalRecaudado = 0; let totalRepartido = 0;
                const newDebtSummary = {};
                JUGADORES.forEach(j => newDebtSummary[j] = 0);

                const jornadasConPronosticos = jornadasData.map((jornada, index) => {
                    const pronosticos = pronosticosSnaps[index].docs.map(doc => ({id: doc.id, ...doc.data()}));
                    const costeApuesta = jornada.esVip ? APUESTA_VIP : APUESTA_NORMAL;
                    const recaudadoJornada = pronosticos.length * costeApuesta;
                    const premioTotal = (jornada.bote || 0) + recaudadoJornada;
                    
                    if (jornada.estado === 'Finalizada') {
                        totalRecaudado += recaudadoJornada;
                        if (jornada.ganadores && jornada.ganadores.length > 0) { totalRepartido += premioTotal; }
                        pronosticos.forEach(p => { if (!p.pagado) { newDebtSummary[p.id] += costeApuesta; } });
                    }
                    return { ...jornada, pronosticos, recaudadoJornada, premioTotal };
                });

                const ultimaJornadaFinalizada = jornadasConPronosticos.slice().reverse().find(j => j.estado === 'Finalizada');
                let boteActual = 0;
                if (ultimaJornadaFinalizada && (!ultimaJornadaFinalizada.ganadores || ultimaJornadaFinalizada.ganadores.length === 0)) {
                    const proximaJornada = jornadasConPronosticos.find(j => j.numeroJornada > ultimaJornadaFinalizada.numeroJornada);
                    if (proximaJornada) { boteActual = proximaJornada.bote || 0; }
                }
                
                setFinancialSummary({ boteActual, totalRecaudado, totalRepartido });
                setJornadas(jornadasConPronosticos);
                setDebtSummary(newDebtSummary);
                setLoading(false);
            });
        });
        return () => unsubscribe();
    }, []);

    const handlePagoChange = async (jornadaId, jugadorId, haPagado) => { const pronosticoRef = doc(db, "pronosticos", jornadaId, "jugadores", jugadorId); await updateDoc(pronosticoRef, { pagado: haPagado }); };
    const handlePremioCobradoChange = async (jornadaId, jugadorId, haCobrado) => { const pronosticoRef = doc(db, "pronosticos", jornadaId, "jugadores", jugadorId); await updateDoc(pronosticoRef, { premioCobrado: haCobrado }); };
    if (loading) return <LoadingSkeleton type="table" />;
    
    // NUEVO: Lógica para determinar si el usuario actual es un tesorero autorizado
    const isTesorero = TESOREROS_AUTORIZADOS.includes(user);

    return (<div><h2 style={styles.title} className="app-title">LIBRO DE CUENTAS</h2><div style={styles.statsGrid}><div style={styles.statCard}><div style={styles.statValue}>💰 {financialSummary.boteActual.toFixed(2)}€</div><div style={styles.statLabel}>Bote Actual</div></div><div style={styles.statCard}><div style={styles.statValue}>📥 {financialSummary.totalRecaudado.toFixed(2)}€</div><div style={styles.statLabel}>Total Recaudado</div></div><div style={styles.statCard}><div style={styles.statValue}>📤 {financialSummary.totalRepartido.toFixed(2)}€</div><div style={styles.statLabel}>Total Repartido</div></div></div>
    
    <div style={styles.debtSummaryContainer}>
        <h3 style={styles.formSectionTitle} className="app-title">Estado de Cuentas por Jugador</h3>
        <div style={styles.debtGrid}>
            {Object.entries(debtSummary).map(([jugador, deuda]) => (
                <div key={jugador} style={deuda > 0 ? styles.debtItemOwes : styles.debtItemPaid}>
                    <PlayerProfileDisplay name={jugador} profile={userProfiles[jugador]} />
                    <span>{deuda.toFixed(2)}€</span>
                </div>
            ))}
        </div>
    </div>

    <div style={{marginTop: '40px'}}>{jornadas.filter(j => j.estado === 'Finalizada').reverse().map(jornada => (<div key={jornada.id} style={styles.pagoCard}><h4 style={styles.pagoCardTitle} className="app-title">Jornada {jornada.numeroJornada}: {jornada.equipoLocal} vs {jornada.equipoVisitante}</h4><div style={styles.pagoCardDetails}><span><strong>Recaudado:</strong> {jornada.recaudadoJornada}€</span><span><strong>Bote Anterior:</strong> {jornada.bote || 0}€</span><span><strong>Premio Total:</strong> {jornada.premioTotal}€</span></div>{jornada.ganadores && jornada.ganadores.length > 0 ? (<div style={styles.pagoCardWinnerInfo}><p><strong>🏆 Ganador(es):</strong> {jornada.ganadores.join(', ')}</p><p><strong>Premio por ganador:</strong> {(jornada.premioTotal / jornada.ganadores.length).toFixed(2)}€</p></div>) : (<div style={styles.pagoCardBoteInfo}>¡BOTE! El premio se acumula para la siguiente jornada.</div>)}<table style={{...styles.table, marginTop: '15px'}}><thead><tr><th style={styles.th}>Jugador</th><th style={styles.th}>Aportación</th>{jornada.ganadores && jornada.ganadores.length > 0 && <th style={styles.th}>Premio Cobrado</th>}</tr></thead><tbody>{jornada.pronosticos.map(p => { const esGanador = jornada.ganadores?.includes(p.id); const tesoreroResponsable = getTesoreroResponsable(p.id); return (<tr key={p.id} style={styles.tr}><td style={styles.td}><PlayerProfileDisplay name={p.id} profile={userProfiles[p.id]} />{tesoreroResponsable && <span style={styles.tesoreroTag}>Paga a: {tesoreroResponsable}</span>}</td><td style={styles.td}><input type="checkbox" checked={p.pagado || false} onChange={(e) => handlePagoChange(jornada.id, p.id, e.target.checked)} disabled={!isTesorero} style={styles.checkbox}/></td>{esGanador && (<td style={styles.td}><input type="checkbox" checked={p.premioCobrado || false} onChange={(e) => handlePremioCobradoChange(jornada.id, p.id, e.target.checked)} disabled={!isTesorero} style={styles.checkbox}/></td>)}</tr>); })}</tbody></table></div>))}</div></div>);
};

const PorraAnualScreen = ({ user, onBack, config }) => {
    const [pronostico, setPronostico] = useState({ ascenso: '', posicion: '' });
    const [miPronostico, setMiPronostico] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [countdown, setCountdown] = useState('');

    useEffect(() => {
        const pronosticoRef = doc(db, "porraAnualPronosticos", user);
        getDoc(pronosticoRef).then(docSnap => {
            if (docSnap.exists()) {
                setMiPronostico(docSnap.data());
                setPronostico(docSnap.data());
            }
            setLoading(false);
        });
    }, [user]);

    useEffect(() => {
        if (!config || !config.fechaCierre) return;
        const targetDate = config.fechaCierre.toDate();
        const interval = setInterval(() => {
            const now = new Date();
            const diff = targetDate - now;
            if (diff <= 0) {
                setCountdown("PLAZO FINALIZADO");
                clearInterval(interval);
                return;
            }
            const d = Math.floor(diff / (1000 * 60 * 60 * 24));
            const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            setCountdown(`${d}d ${h}h ${m}m para el cierre`);
        }, 1000);
        return () => clearInterval(interval);
    }, [config]);

    const handleGuardar = async (e) => {
        e.preventDefault();
        if (!pronostico.ascenso || !pronostico.posicion) {
            setMessage("Debes rellenar ambos campos.");
            return;
        }
        setIsSaving(true);
        const pronosticoRef = doc(db, "porraAnualPronosticos", user);
        try {
            const isFirstTime = !miPronostico;
            const changesLeft = miPronostico?.cambiosRestantes ?? 2;
            
            if (!isFirstTime && changesLeft <= 0) {
                setMessage("No te quedan más cambios.");
                setIsSaving(false);
                return;
            }

            const dataToSave = {
                ...pronostico,
                jugador: user,
                lastUpdated: new Date(),
                cambiosRestantes: isFirstTime ? 2 : changesLeft - 1,
            };

            await setDoc(pronosticoRef, dataToSave);
            setMessage(isFirstTime ? "¡Tu pronóstico anual ha sido guardado!" : "¡Cambio guardado con éxito!");
            setMiPronostico(dataToSave);

        } catch (error) {
            console.error("Error al guardar pronóstico anual:", error);
            setMessage("Hubo un error al guardar tu pronóstico.");
        }
        setIsSaving(false);
    };

    if (loading) return <LoadingSkeleton />;

    const isClosed = config?.estado !== 'Abierta' || (config?.fechaCierre && new Date() > config.fechaCierre.toDate());
    const noChangesLeft = miPronostico && miPronostico.cambiosRestantes <= 0;

    if (isClosed || noChangesLeft) {
        return (
            <div>
                <button onClick={onBack} style={styles.backButton}>&larr; Volver</button>
                <h2 style={styles.title} className="app-title">⭐ PORRA ANUAL ⭐</h2>
                <div style={styles.placeholder}>
                    {miPronostico ? (
                        <>
                            <h3>Tu apuesta final está guardada</h3>
                            <p><strong>¿Asciende?:</strong> {miPronostico.ascenso}</p>
                            <p><strong>Posición Final:</strong> {miPronostico.posicion}º</p>
                            <p style={{ marginTop: '20px', fontStyle: 'italic' }}>
                                {isClosed ? "El plazo para modificar ha terminado. ¡Suerte!" : "Has usado todos tus cambios. ¡Suerte!"}
                            </p>
                        </>
                    ) : (
                        <h3>Las apuestas para la Porra Anual están cerradas.</h3>
                    )}
                </div>
            </div>
        );
    }
    
    return (
        <div>
            <button onClick={onBack} style={styles.backButton}>&larr; Volver</button>
            <h2 style={styles.title} className="app-title">⭐ PORRA ANUAL ⭐</h2>
            <form onSubmit={handleGuardar} style={styles.form}>
                <div style={styles.porraAnualInfoBox}>
                    <p>
                        {miPronostico ? `Te quedan ${miPronostico.cambiosRestantes || 0} cambios.` : 'Tienes 2 cambios disponibles.'}
                    </p>
                    {countdown && <p style={styles.porraAnualCountdown}>{countdown}</p>}
                </div>
                <p style={{ textAlign: 'center', marginBottom: '30px', fontSize: '1.1rem' }}>
                    {miPronostico ? 'Puedes modificar tu pronóstico si te quedan cambios.' : 'Haz tu pronóstico para el final de la temporada.'}
                </p>
                <div style={styles.formGroup}>
                    <label style={styles.label}>1. ¿Asciende la UD Las Palmas? <span style={styles.pointsReminder}>(5 Puntos)</span></label>
                    <div style={styles.ascensoButtonsContainer}>
                        <button type="button" onClick={() => setPronostico(p => ({ ...p, ascenso: 'SI' }))} style={pronostico.ascenso === 'SI' ? styles.ascensoButtonActive : styles.ascensoButton}>SÍ</button>
                        <button type="button" onClick={() => setPronostico(p => ({ ...p, ascenso: 'NO' }))} style={pronostico.ascenso === 'NO' ? styles.ascensoButtonActive : styles.ascensoButton}>NO</button>
                    </div>
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label}>2. ¿En qué posición terminará? <span style={styles.pointsReminder}>(10 Puntos)</span></label>
                    <input type="number" min="1" max="22" name="posicion" value={pronostico.posicion} onChange={(e) => setPronostico(p => ({ ...p, posicion: e.target.value }))} style={{ ...styles.input, textAlign: 'center', fontSize: '2rem', fontFamily: "'Orbitron', sans-serif" }} placeholder="1-22" />
                </div>
                <p style={{ textAlign: 'center', color: styles.colors.gold, fontWeight: 'bold', fontStyle: 'italic' }}>⭐ ¡Si aciertas las dos preguntas ganarás 20 PUNTOS! ⭐</p>
                <button type="submit" disabled={isSaving} style={styles.mainButton}>
                    {isSaving ? 'GUARDANDO...' : (miPronostico ? 'USAR 1 CAMBIO Y GUARDAR' : 'GUARDAR PRONÓSTICO')}
                </button>
                {message && <p style={{ ...styles.message, backgroundColor: styles.colors.success }}>{message}</p>}
            </form>
        </div>
    );
};

const ProfileCustomizationScreen = ({ user, onSave, userProfile }) => {
    const [selectedColor, setSelectedColor] = useState(userProfile.color || PROFILE_COLORS[0]); const [selectedIcon, setSelectedIcon] = useState(userProfile.icon || PROFILE_ICONS[0]); const [isSaving, setIsSaving] = useState(false);
    const handleSave = async () => { setIsSaving(true); await onSave(user, { color: selectedColor, icon: selectedIcon }); };
    return (<div style={styles.profileCustomizationContainer}><h2 style={styles.title} className="app-title">¡BIENVENIDO, {user}!</h2><p style={{textAlign: 'center', marginBottom: '30px', fontSize: '1.1rem'}}>Personaliza tu perfil para que todos te reconozcan.</p><div style={styles.formGroup}><label style={styles.label}>1. ELIGE TU COLOR</label><div style={styles.colorGrid}>{PROFILE_COLORS.map(color => { const isGradient = typeof color === 'string' && color.startsWith('linear-gradient'); const style = { ...styles.colorOption, ...(isGradient ? { background: color } : { backgroundColor: color }), ...(selectedColor === color ? styles.colorOptionSelected : {}) }; return (<div key={color} style={style} onClick={() => setSelectedColor(color)} />); })}</div></div><div style={styles.formGroup}><label style={styles.label}>2. ELIGE TU ICONO</label><div style={styles.iconGrid}>{PROFILE_ICONS.map(icon => (<div key={icon} style={{...styles.iconOption, ...(selectedIcon === icon ? styles.iconOptionSelected : {})}} onClick={() => setSelectedIcon(icon)}>{icon}</div>))}</div></div><div style={{textAlign: 'center', marginTop: '40px'}}><p style={{fontSize: '1.2rem', marginBottom: '10px'}}>Así se verá tu perfil:</p><PlayerProfileDisplay name={user} profile={{ color: selectedColor, icon: selectedIcon }} style={styles.profilePreview} /></div><button onClick={handleSave} disabled={isSaving} style={{...styles.mainButton, width: '100%'}}>{isSaving ? 'GUARDANDO...' : 'GUARDAR Y ENTRAR'}</button></div>);
};

const ProfileScreen = ({ user, userProfile, onEdit, onBack }) => {
    const [stats, setStats] = useState(null);
    const [loadingStats, setLoadingStats] = useState(true);

    useEffect(() => {
        const calculateStats = async () => {
            setLoadingStats(true);
            const qJornadas = query(collection(db, "jornadas"), where("estado", "==", "Finalizada"));
            const jornadasSnap = await getDocs(qJornadas);
            const jornadas = jornadasSnap.docs.map(d => ({id: d.id, ...d.data()}));

            const pronosticosPromises = jornadas.map(j => getDoc(doc(db, "pronosticos", j.id, "jugadores", user)));
            const pronosticosSnaps = await Promise.all(pronosticosPromises);
            const pronosticos = pronosticosSnaps.map((snap, i) => snap.exists() ? { ...snap.data(), jornadaId: jornadas[i].id, jornadaResult: {local: jornadas[i].resultadoLocal, visitante: jornadas[i].resultadoVisitante}, numeroJornada: jornadas[i].numeroJornada } : null).filter(Boolean);

            if (pronosticos.length === 0) {
                setStats({ porrasGanadas: 0, plenos: 0, goleadorFavorito: '-', rachaPuntuando: 0 });
                setLoadingStats(false);
                return;
            }

            const porrasGanadas = jornadas.filter(j => j.ganadores?.includes(user)).length;
            const plenos = pronosticos.filter(p => p.puntosObtenidos >= 3).length;
            
            const goleadores = pronosticos.map(p => p.goleador).filter(Boolean);
            const goleadorCounts = goleadores.reduce((acc, val) => ({...acc, [val]: (acc[val] || 0) + 1}), {});
            const goleadorFavorito = Object.keys(goleadorCounts).length > 0 ? Object.entries(goleadorCounts).sort((a,b) => b[1] - a[1])[0][0] : '-';

            let rachaPuntuando = 0;
            const pronosticosOrdenados = pronosticos.sort((a,b) => b.numeroJornada - a.numeroJornada);
            for (const p of pronosticosOrdenados) {
                if (p.puntosObtenidos > 0) { rachaPuntuando++; } else { break; }
            }

            setStats({ porrasGanadas, plenos, goleadorFavorito, rachaPuntuando });
            setLoadingStats(false);
        };
        calculateStats();
    }, [user]);

    const finalStats = {
        jokersUsados: userProfile.jokersRestantes !== undefined ? 2 - userProfile.jokersRestantes : 0,
        ...(stats || {})
    };

    return (<div><button onClick={onBack} style={styles.backButton}>&larr; Volver</button><h2 style={styles.title}><PlayerProfileDisplay name={user} profile={userProfile} style={{fontSize: '2rem'}} /></h2>
    {loadingStats ? <LoadingSkeleton /> : (
        <div style={styles.statsGrid}>
            <div style={styles.statCard}><div style={styles.statValue}>🏆 {finalStats.porrasGanadas}</div><div style={styles.statLabel}>Porras Ganadas</div></div>
            <div style={styles.statCard}><div style={styles.statValue}>🎯 {finalStats.plenos}</div><div style={styles.statLabel}>Plenos Conseguidos</div></div>
            <div style={styles.statCard}><div style={styles.statValue}>⚽️ {finalStats.goleadorFavorito}</div><div style={styles.statLabel}>Goleador Favorito</div></div>
            <div style={styles.statCard}><div style={styles.statValue}>🔥 {finalStats.rachaPuntuando}</div><div style={styles.statLabel}>Racha Puntuando</div></div>
            <div style={styles.statCard}><div style={styles.statValue}>🃏 {finalStats.jokersUsados} / 2</div><div style={styles.statLabel}>Jokers Usados</div></div>
        </div>
    )}
    <button onClick={onEdit} style={{...styles.mainButton, width: '100%', marginTop: '40px'}}>Editar Perfil (Icono y Color)</button></div>);
};

// --- NUEVA PANTALLA: Paseo de la Fama ---
const PaseoDeLaFamaScreen = ({ userProfiles, fameStats }) => {
    if (!fameStats) return <LoadingSkeleton type="table" />;

    return (
        <div>
            <h2 style={styles.title} className="app-title">🏆 PASEO DE LA FAMA 🏆</h2>
            <p style={{textAlign: 'center', marginBottom: '20px'}}>Los récords y hazañas de la historia de nuestra porra.</p>
            <div style={styles.fameGrid}>
                {Object.entries(FAME_STATS_DEFINITIONS).map(([key, def]) => (
                    <div key={key} style={styles.fameCard}>
                        <div style={styles.fameIcon}>{def.icon}</div>
                        <h3 style={styles.fameTitle}>{def.name}</h3>
                        <div style={styles.fameWinner}>
                            <PlayerProfileDisplay name={fameStats[key]?.jugador || '-'} profile={userProfiles[fameStats[key]?.jugador]} />
                        </div>
                        <div style={styles.fameValue}>{fameStats[key]?.valor || '-'}</div>
                        <p style={{fontSize: '0.8rem', color: colors.silver, marginTop: 'auto', paddingTop: '10px'}}>{def.description}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ============================================================================
// --- COMPONENTE PRINCIPAL APP ---
// ============================================================================

function App() {
  const [showInitialSplash, setShowInitialSplash] = useState(true);
  const [screen, setScreen] = useState('splash');
  const [activeTab, setActiveTab] = useState('miJornada');
  const [currentUser, setCurrentUser] = useState(null);
  const [viewingJornadaId, setViewingJornadaId] = useState(null);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [teamLogos, setTeamLogos] = useState({});
  const [porraAnualConfig, setPorraAnualConfig] = useState(null);
  const [viewingPorraAnual, setViewingPorraAnual] = useState(false);
  const [winnerData, setWinnerData] = useState(null);
  const [liveJornada, setLiveJornada] = useState(null);
  const [plantilla, setPlantilla] = useState(PLANTILLA_ACTUALIZADA);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [userProfiles, setUserProfiles] = useState({});
  const [onlineUsers, setOnlineUsers] = useState({});
  const [isVipActive, setIsVipActive] = useState(false);
  const [clasificacionData, setClasificacionData] = useState([]); // NUEVO: Para pasar a componentes hijos
  const [fameStats, setFameStats] = useState(null); // NUEVO: Para estadísticas globales
  const anonymousUserRef = useRef(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => { 
        if (user && !user.isAnonymous) setIsAdminAuthenticated(true);
        else if (user && user.isAnonymous) { anonymousUserRef.current = user; setIsAdminAuthenticated(false); }
        else signInAnonymously(auth).catch((error) => console.error("Error de autenticación anónima:", error));
    });
    const styleSheet = document.createElement("style"); 
    const colors = styles.colors;
    // --- NUEVO: Se añaden las animaciones @keyframes ---
    styleSheet.innerText = `
        @import url('https://fonts.googleapis.com/css2?family=Teko:wght@700&family=Orbitron&family=Exo+2&family=Russo+One&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { font-size: 16px !important; -webkit-text-size-adjust: 100%; }
        body, #root { width: 100%; min-width: 100%; overflow-x: hidden; }
        .vip-active { --glow-color: ${colors.gold}; --main-color: ${colors.gold}; --secondary-color: ${colors.yellow}; }
        .vip-active #app-container { border-color: var(--glow-color); box-shadow: 0 0 25px var(--glow-color), inset 0 0 15px var(--glow-color); }
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
        @keyframes highlight { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
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
        @keyframes blink-live { 50% { background-color: #a11d27; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes point-jump-up { 0% { transform: translateY(0); color: ${colors.lightText}; } 50% { transform: translateY(-10px) scale(1.2); color: ${colors.success}; } 100% { transform: translateY(0); color: ${colors.lightText}; } }
        .point-jump-up { animation: point-jump-up 0.7s ease-out; }
        .stat-fade-in { animation: fadeIn 0.5s ease-in-out; }
        @keyframes bounce-in { 0% { transform: scale(0); opacity: 0; } 60% { transform: scale(1.2); opacity: 1; } 100% { transform: scale(1); } }
        @keyframes pulse-once { 0% { transform: scale(1); } 50% { transform: scale(1.3); } 100% { transform: scale(1); } }
        .pulsed { animation: pulse-once 0.4s ease-in-out; }
        @keyframes pie-draw { to { stroke-dashoffset: 0; } }
        .pie-chart-segment-new { transform-origin: 60px 60px; stroke-dasharray: var(--stroke-dasharray); stroke-dashoffset: var(--stroke-dasharray); transform: rotate(var(--rotation)); animation: pie-draw 1s ease-out forwards; }
        @keyframes reaction-fade-out { to { opacity: 0; transform: scale(0.5); } }
        .fade-out { animation: reaction-fade-out 0.5s forwards; }
        @keyframes reaction-fly { 0% { transform: translate(0, 0) scale(1.2); opacity: 1; } 100% { transform: translate(80px, -80px) scale(0); opacity: 0; } }
        .fly-away { display: inline-block; animation: reaction-fly 1s cubic-bezier(0.5, -0.5, 1, 1) forwards; position: absolute; z-index: 10; pointer-events: none; }
        @keyframes status-blink-red { 0%, 100% { background-color: ${colors.danger}; box-shadow: 0 0 8px ${colors.danger}; } 50% { background-color: #a11d27; box-shadow: 0 0 15px ${colors.danger}; } }
        @keyframes status-pulse-green { 0%, 100% { background-color: ${colors.success}; box-shadow: 0 0 5px ${colors.success}; } 50% { background-color: #3a9a6a; box-shadow: 0 0 10px ${colors.success}; } }
        .stat-value-animation { animation: pop-in 0.5s ease-out; }
        @keyframes pulse-animation-kf { 0% { box-shadow: 0 0 0 0 rgba(255, 200, 44, 0.7); } 70% { box-shadow: 0 0 10px 15px rgba(255, 200, 44, 0); } 100% { box-shadow: 0 0 0 0 rgba(255, 200, 44, 0); } }
        .pulse-animation { border-color: ${colors.yellow}; animation: pulse-animation-kf 1s ease-out; }
        @keyframes live-dot-kf { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .live-dot-animation { animation: live-dot-kf 1.5s infinite; }
        @keyframes silver-glow { 0%, 100% { background-color: rgba(192, 192, 192, 0.15); box-shadow: inset 0 0 15px rgba(192, 192, 192, 0.5), 0 0 10px rgba(192, 192, 192, 0.3); } 50% { background-color: rgba(192, 192, 192, 0.25); box-shadow: inset 0 0 20px rgba(192, 192, 192, 0.7), 0 0 15px rgba(192, 192, 192, 0.5); } }
        @keyframes bronze-glow { 0%, 100% { background-color: rgba(205, 127, 50, 0.15); box-shadow: inset 0 0 15px rgba(205, 127, 50, 0.5), 0 0 10px rgba(205, 127, 50, 0.3); } 50% { background-color: rgba(205, 127, 50, 0.25); box-shadow: inset 0 0 20px rgba(205, 127, 50, 0.7), 0 0 15px rgba(205, 127, 50, 0.5); } }
        @keyframes user-highlight-glow { 0%, 100% { background-color: rgba(0, 85, 164, 0.5); box-shadow: inset 0 0 15px rgba(0, 85, 164, 1), 0 0 10px rgba(0, 85, 164, 0.7); } 50% { background-color: rgba(0, 85, 164, 0.7); box-shadow: inset 0 0 20px rgba(0, 85, 164, 1), 0 0 15px rgba(0, 85, 164, 1); } }
    `;
    document.head.appendChild(styleSheet);
    const configRef = doc(db, "configuracion", "porraAnual"); const unsubscribeConfig = onSnapshot(configRef, (doc) => { setPorraAnualConfig(doc.exists() ? doc.data() : null); });
    const escudosRef = doc(db, "configuracion", "escudos"); const unsubscribeEscudos = onSnapshot(escudosRef, (docSnap) => { if (docSnap.exists()) { setTeamLogos(docSnap.data()); } });
    const qLive = query(collection(db, "jornadas"), where("estado", "==", "En vivo"), limit(1)); 
    const unsubscribeLive = onSnapshot(qLive, (snapshot) => { 
        if (!snapshot.empty) { 
            const jornada = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() }; 
            setLiveJornada(jornada); 
            setIsVipActive(jornada.esVip || false);
        } else { 
            setLiveJornada(null); 
            const qAbierta = query(collection(db, "jornadas"), where("estado", "in", ["Abierta", "Pre-apertura"]), limit(1));
            onSnapshot(qAbierta, (snapAbierta) => {
                if(!snapAbierta.empty){ setIsVipActive(snapAbierta.docs[0].data().esVip || false); } 
                else { setIsVipActive(false); }
            });
        } 
    });

    const plantillaRef = doc(db, "configuracion", "plantilla"); const unsubscribePlantilla = onSnapshot(plantillaRef, (docSnap) => { if (docSnap.exists() && docSnap.data().jugadores?.length > 0) { setPlantilla(docSnap.data().jugadores); } else { console.log("Plantilla no encontrada en Firebase, usando respaldo local."); } });
    const clasificacionRef = collection(db, "clasificacion"); 
    const unsubscribeClasificacion = onSnapshot(clasificacionRef, (snapshot) => { 
        const profiles = {}; 
        const clasificacion = [];
        snapshot.forEach(doc => { 
            const data = doc.data();
            profiles[doc.id] = data; 
            clasificacion.push({id: doc.id, ...data});
        }); 
        setUserProfiles(profiles); 
        setClasificacionData(clasificacion.sort((a,b) => (b.puntosTotales || 0) - (a.puntosTotales || 0)));
    });
    const statusRef = ref(rtdb, 'status/'); const unsubscribeStatus = onValue(statusRef, (snapshot) => { const data = snapshot.val(); setOnlineUsers(data || {}); });
    
    // NUEVO: Listener para estadísticas globales
    const fameStatsRef = doc(db, "estadisticas", "globales");
    const unsubscribeFameStats = onSnapshot(fameStatsRef, (docSnap) => {
        if (docSnap.exists()) {
            setFameStats(docSnap.data());
        }
    });

    return () => { document.head.removeChild(styleSheet); unsubscribeConfig(); unsubscribeAuth(); unsubscribeEscudos(); unsubscribeLive(); unsubscribePlantilla(); unsubscribeClasificacion(); unsubscribeStatus(); unsubscribeFameStats(); }
  }, []);
  
  const handleRequestPermission = async (user) => {
      setShowNotificationModal(false);
      localStorage.setItem('notificationPrompt_v3_seen', 'true'); 
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
      await set(userStatusRef, true);
      onDisconnect(userStatusRef).set(false);
      const userProfileRef = doc(db, "clasificacion", user);
      await setDoc(userProfileRef, { ultimaConexion: new Date() }, { merge: true });

      const docSnap = await getDoc(userProfileRef);
      if (docSnap.exists() && docSnap.data().icon && docSnap.data().color) setScreen('app');
      else setScreen('customizeProfile');
      
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
    } catch (error) {
        console.error("Error crítico durante el inicio de sesión:", error);
        alert("Ha ocurrido un error al iniciar sesión. Por favor, inténtalo de nuevo.");
    }
  };


  const handleLogout = async () => {
    if (currentUser) set(ref(rtdb, 'status/' + currentUser), false);
    if (isAdminAuthenticated) { await signOut(auth); await signInAnonymously(auth); }
    setCurrentUser(null); setScreen('login'); setIsAdminAuthenticated(false);
  };

  const handleSaveProfile = async (user, profileData) => { await setDoc(doc(db, "clasificacion", user), profileData, { merge: true }); setScreen('app'); setActiveTab('miJornada'); };
  const handleNavClick = (tab) => { setViewingJornadaId(null); setViewingPorraAnual(false); setActiveTab(tab); if (tab !== 'admin' && isAdminAuthenticated) { signOut(auth).then(() => signInAnonymously(auth)); } };
  const handleAdminClick = () => { if (isAdminAuthenticated) setActiveTab('admin'); else setShowAdminLogin(true); };
  const handleAdminLoginSuccess = () => { setIsAdminAuthenticated(true); setShowAdminLogin(false); setActiveTab('admin'); };

  const renderContent = () => {
    if (showInitialSplash) return <InitialSplashScreen onFinish={() => setShowInitialSplash(false)} />;
    if (screen === 'splash') return <SplashScreen onEnter={() => setScreen('login')} teamLogos={teamLogos} plantilla={plantilla} fameStats={fameStats} />;
    if (screen === 'login') return <LoginScreen onLogin={handleLogin} userProfiles={userProfiles} onlineUsers={onlineUsers} />;
    if (screen === 'customizeProfile') return <ProfileCustomizationScreen user={currentUser} onSave={handleSaveProfile} userProfile={userProfiles[currentUser] || {}} />;
    if (screen === 'app') {
        const isLive = liveJornada?.liveData?.isLive;
        const onlineCount = Object.values(onlineUsers).filter(Boolean).length;
        const showGreenStatus = !isLive && onlineCount > 1;

        const CurrentScreen = () => {
            if (viewingJornadaId) return <JornadaDetalleScreen jornadaId={viewingJornadaId} onBack={() => setViewingJornadaId(null)} teamLogos={teamLogos} userProfiles={userProfiles} />;
            if (viewingPorraAnual) return <PorraAnualScreen user={currentUser} onBack={() => setViewingPorraAnual(false)} config={porraAnualConfig} />;
            if (activeTab === 'profile') return <ProfileScreen user={currentUser} userProfile={userProfiles[currentUser]} onEdit={() => setScreen('customizeProfile')} onBack={() => setActiveTab('miJornada')} />;
            switch (activeTab) {
                case 'miJornada': return <MiJornadaScreen user={currentUser} setActiveTab={handleNavClick} teamLogos={teamLogos} liveData={liveJornada?.liveData} plantilla={plantilla} userProfiles={userProfiles} />;
                case 'laJornada': return <LaJornadaScreen user={currentUser} teamLogos={teamLogos} liveData={liveJornada?.liveData} userProfiles={userProfiles} onlineUsers={onlineUsers} clasificacionData={clasificacionData} />;
                case 'calendario': return <CalendarioScreen onViewJornada={setViewingJornadaId} teamLogos={teamLogos} />;
                case 'clasificacion': return <ClasificacionScreen currentUser={currentUser} liveData={liveJornada?.liveData} liveJornada={liveJornada} userProfiles={userProfiles} />;
                case 'pagos': return <PagosScreen user={currentUser} userProfiles={userProfiles} />;
                // NUEVO: Se añade la pantalla "Paseo de la Fama"
                case 'fama': return <PaseoDeLaFamaScreen userProfiles={userProfiles} fameStats={fameStats} />;
                case 'admin': return isAdminAuthenticated ? <AdminPanelScreen teamLogos={teamLogos} plantilla={plantilla} setPlantilla={setPlantilla} /> : null;
                default: return null;
            }
        };
      return (<>{showAdminLogin && <AdminLoginModal onClose={() => setShowAdminLogin(false)} onSuccess={handleAdminLoginSuccess} />}{showNotificationModal && <NotificationPermissionModal onAllow={() => handleRequestPermission(currentUser)} onDeny={() => {setShowNotificationModal(false); localStorage.setItem('notificationPrompt_v3_seen', 'true');}} />}{porraAnualConfig?.estado === 'Abierta' && !viewingPorraAnual && (!porraAnualConfig?.fechaCierre || new Date() < porraAnualConfig.fechaCierre.toDate()) && (<div style={styles.porraAnualBanner} onClick={() => setViewingPorraAnual(true)}>⭐ ¡PORRA ANUAL ABIERTA! ⭐ Haz o modifica tu pronóstico. ¡Pincha aquí!</div>)}<LiveBanner liveData={liveJornada?.liveData} jornada={liveJornada} />
      <nav style={styles.navbar} className="navbar">
        <button onClick={() => handleNavClick('miJornada')} style={activeTab === 'miJornada' ? styles.navButtonActive : styles.navButton} className={activeTab === 'miJornada' ? 'nav-button-active' : ''}>Mi Jornada</button>
        <button onClick={() => handleNavClick('laJornada')} style={activeTab === 'laJornada' ? styles.navButtonActive : styles.navButton} className={activeTab === 'laJornada' ? 'nav-button-active' : ''}>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                {isLive && <span style={styles.statusIndicatorRed}></span>}
                {showGreenStatus && <span style={styles.statusIndicatorGreen}></span>}
                La Jornada
            </div>
        </button>
        <button onClick={() => handleNavClick('clasificacion')} style={activeTab === 'clasificacion' ? styles.navButtonActive : styles.navButton} className={activeTab === 'clasificacion' ? 'nav-button-active' : ''}>Clasificación</button>
        {/* NUEVO: Botón para el Paseo de la Fama */}
        <button onClick={() => handleNavClick('fama')} style={activeTab === 'fama' ? styles.navButtonActive : styles.navButton} className={activeTab === 'fama' ? 'nav-button-active' : ''}>🏆 Fama</button>
        <button onClick={() => handleNavClick('pagos')} style={activeTab === 'pagos' ? styles.navButtonActive : styles.navButton} className={activeTab === 'pagos' ? 'nav-button-active' : ''}>Pagos</button>
        {currentUser === 'Juanma' && (<button onClick={handleAdminClick} style={activeTab === 'admin' ? styles.navButtonActive : styles.navButton} className={activeTab === 'admin' ? 'nav-button-active' : ''}>Admin</button>)}
        <button onClick={() => handleNavClick('profile')} style={styles.profileNavButton}><PlayerProfileDisplay name={currentUser} profile={userProfiles[currentUser]} /></button>
        <button onClick={handleLogout} style={styles.logoutButton}>Salir</button>
      </nav>
      <div key={activeTab} className="content-enter-active" style={styles.content}><CurrentScreen /></div></>);
    }
  };
  return (<>{winnerData && <WinnerAnimation winnerData={winnerData} onClose={() => setWinnerData(null)} />}<div id="app-container" className={isVipActive ? 'vip-active' : ''} style={styles.container}><div style={styles.card} id="app-card">{renderContent()}</div></div></>);
}

export default App;

