import React, { useState, useEffect, useMemo, useRef } from 'react';
// Importamos las funciones necesarias de Firebase
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
// MODIFICADO: Se añade 'runTransaction', 'serverTimestamp' y 'arrayUnion'
import { getFirestore, collection, doc, getDocs, onSnapshot, query, where, limit, writeBatch, updateDoc, orderBy, setDoc, getDoc, increment, deleteDoc, runTransaction, serverTimestamp, addDoc, arrayUnion } from "firebase/firestore";
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
    // --- NUEVO: Estilos para Filtros de Admin ---
    adminFilterContainer: { display: 'flex', gap: '15px', marginBottom: '20px', padding: '10px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '8px', alignItems: 'center' },
    adminSearchInput: { flex: 1, padding: '8px 12px', fontSize: '0.9rem', backgroundColor: colors.deepBlue, color: colors.lightText, border: `1px solid ${colors.blue}`, borderRadius: '6px' },
    // --- NUEVO: Estilos para el Ticker de Noticias ---
    newsTickerContainer: {
        position: 'fixed',
        bottom: 0,
        left: 0,
        width: '100%',
        backgroundColor: 'rgba(0, 29, 61, 0.9)',
        color: colors.lightText,
        padding: '10px 0',
        overflow: 'hidden',
        borderTop: `1px solid ${colors.blue}`,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
    },
    newsTickerLabel: {
        backgroundColor: colors.yellow,
        color: colors.deepBlue,
        padding: '10px 15px',
        fontWeight: 'bold',
        fontFamily: "'Orbitron', sans-serif",
        textTransform: 'uppercase',
    },
    newsTickerTrack: {
        display: 'inline-block',
        whiteSpace: 'nowrap',
        paddingLeft: '100%',
        animation: 'ticker-scroll 40s linear infinite',
    },
    newsTickerItem: {
        display: 'inline-block',
        padding: '0 25px',
        fontSize: '0.95rem',
    },
    // --- NUEVO: Estilos para el Modal de Resultados ---
    resultModalContent: {
        textAlign: 'center',
        animation: 'fadeIn 0.5s ease',
    },
    resultModalTitle: {
        fontFamily: "'Orbitron', sans-serif",
        fontSize: '2.5rem',
        color: colors.yellow,
        textShadow: `0 0 15px ${colors.yellow}`,
        marginBottom: '15px',
    },
    resultModalBody: {
        fontSize: '1.2rem',
        lineHeight: 1.6,
    },
    resultModalWinner: {
        color: colors.gold,
        fontWeight: 'bold',
        fontSize: '1.5rem',
    },
    resultModalBoteAmount: {
        color: colors.success,
        fontWeight: 'bold',
        fontSize: '1.8rem',
    },
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

// --- NUEVO: Modal de anuncio de resultados ---
const ResultAnnouncementModal = ({ result, onClose }) => {
    if (!result) return null;

    const { winners, prizePerWinner, boteAmount } = result;

    return (
        <div style={styles.modalOverlay} onClick={onClose}>
            <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
                <div style={styles.resultModalContent}>
                    {winners && winners.length > 0 ? (
                        <>
                            <Confetti />
                            <h3 style={styles.resultModalTitle}>¡TENEMOS GANADORES!</h3>
                            <div style={styles.resultModalBody}>
                                <p>¡Felicidades a los campeones de la jornada!</p>
                                <div style={{margin: '20px 0'}}>
                                    {winners.map(winner => (
                                        <p key={winner} style={styles.resultModalWinner}>🏆 {winner} 🏆</p>
                                    ))}
                                </div>
                                <p>Se han llevado un premio de <strong>{prizePerWinner.toFixed(2)}€</strong> cada uno.</p>
                            </div>
                        </>
                    ) : (
                        <>
                            <h3 style={styles.resultModalTitle}>¡BOTE!</h3>
                            <div style={styles.resultModalBody}>
                                <p>Nadie ha acertado el resultado exacto en esta jornada.</p>
                                <p style={{marginTop: '15px'}}>¡El bote se acumula para la siguiente jornada y asciende a:</p>
                                <p style={styles.resultModalBoteAmount}>{boteAmount.toFixed(2)}€</p>
                            </div>
                        </>
                    )}
                    <button onClick={onClose} style={{...styles.mainButton, marginTop: '30px'}}>Entendido</button>
                </div>
            </div>
        </div>
    );
};

// --- NUEVO: Componente Ticker de Noticias ---
const NewsTicker = ({ stats, userProfiles }) => {
    const tickerItems = useMemo(() => {
        if (!stats) return [];
        const items = [];
        
        Object.entries(FAME_STATS_DEFINITIONS).forEach(([key, def]) => {
            const statData = stats[key];
            if (statData && statData.jugador) {
                items.push(
                    <span key={key} style={styles.newsTickerItem}>
                        <strong>{def.icon} {def.name}: </strong>
                        <PlayerProfileDisplay name={statData.jugador} profile={userProfiles[statData.jugador]} />
                        <span style={{color: colors.yellow, marginLeft: '8px'}}>({statData.valor})</span>
                    </span>
                );
            }
        });

        return items;
    }, [stats, userProfiles]);
    
    if (tickerItems.length === 0) return null;

    return (
        <div style={styles.newsTickerContainer}>
            <span style={styles.newsTickerLabel}>Paseo de la Fama</span>
            <div style={styles.newsTickerTrack}>
                {tickerItems}
                {tickerItems} 
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
// ============================================================================
// --- FIN DE LA PRIMERA PARTE ---
// POR FAVOR, COPIA TODO EL CÓDIGO HASTA ESTE PUNTO.
// CUANDO ME CONFIRMES QUE LO HAS HECHO, TE ENTREGARÉ LA SEGUNDA PARTE.
// NO INTENTES COMPILAR ESTE ARCHIVO SOLO, NECESITAS AMBAS PARTES.
// ============================================================================

const JornadaAdminItem = ({ jornada, plantilla, searchTerm, filterRange, onForceRecalculate }) => {
    const [estado, setEstado] = useState(jornada.estado);
    const [resultadoLocal, setResultadoLocal] = useState(jornada.resultadoLocal === undefined ? '' : jornada.resultadoLocal);
    const [resultadoVisitante, setResultadoVisitante] = useState(jornada.resultadoVisitante === undefined ? '' : jornada.resultadoVisitante);
    const [goleador, setGoleador] = useState(jornada.goleador || '');
    const [esVip, setEsVip] = useState(jornada.esVip || false);
    const [splashMessage, setSplashMessage] = useState(jornada.splashMessage || '');
    
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
    const [apiLeagueId, setApiLeagueId] = useState(jornada.apiLeagueId || '');
    const [apiLocalTeamId, setApiLocalTeamId] = useState(jornada.apiLocalTeamId || '');
    const [apiVisitorTeamId, setApiVisitorTeamId] = useState(jornada.apiVisitorTeamId || '');

    const [isSaving, setIsSaving] = useState(false);
    const [isCalculating, setIsCalculating] = useState(false);
    const [message, setMessage] = useState('');
    const [liveData, setLiveData] = useState({ golesLocal: 0, golesVisitante: 0, ultimoGoleador: '', isLive: false });

    useEffect(() => { if (jornada.liveData) { setLiveData(jornada.liveData); } }, [jornada.liveData]);

    const handleSaveChanges = async () => {
        setIsSaving(true); setMessage('');
        const jornadaRef = doc(db, "jornadas", jornada.id);
        try {
            await updateDoc(jornadaRef, { 
                estado, 
                resultadoLocal, 
                resultadoVisitante, 
                goleador: goleador.trim(), 
                esVip, 
                splashMessage, 
                fechaApertura: fechaApertura ? new Date(fechaApertura) : null, 
                fechaCierre: fechaCierre ? new Date(fechaCierre) : null, 
                fechaPartido: fechaPartido ? new Date(fechaPartido) : null,
                estadioImageUrl,
                apiLeagueId,
                apiLocalTeamId,
                apiVisitorTeamId
            });
            setMessage('¡Guardado!'); setTimeout(() => setMessage(''), 2000);
        } catch (error) { console.error("Error al actualizar: ", error); setMessage('Error al guardar.'); }
        setIsSaving(false);
    };

    const handleUpdateLiveState = async (activate = true) => {
        setIsSaving(true);
        const jornadaRef = doc(db, "jornadas", jornada.id);
        try {
            if (activate) {
                await updateDoc(jornadaRef, { 
                    estado: 'En vivo',
                    liveData: { ...liveData, isLive: true } 
                });
                 setEstado('En vivo');
                setMessage('¡Jornada EN VIVO!');
            } else {
                 await updateDoc(jornadaRef, { 
                    liveData: { ...liveData, isLive: false } 
                });
                setMessage('Datos en vivo actualizados.');
            }
            setTimeout(() => setMessage(''), 2000);
        } catch (error) { console.error("Error actualizando modo en vivo:", error); setMessage('Error al actualizar.'); }
        setIsSaving(false);
    };
    
    const handleSetFinalState = async () => {
        if (!window.confirm("¿Estás seguro de que quieres marcar la jornada como 'Finalizada'? Esto sella el resultado, pero no calcula los puntos.")) {
            return;
        }
        setIsSaving(true);
        const jornadaRef = doc(db, "jornadas", jornada.id);
        try {
            await updateDoc(jornadaRef, { 
                estado: 'Finalizada',
                resultadoLocal: parseInt(resultadoLocal),
                resultadoVisitante: parseInt(resultadoVisitante),
                goleador: goleador.trim(),
                "liveData.isLive": false 
            });
            setEstado('Finalizada');
            setMessage('Jornada marcada como Finalizada.');
        } catch (error) {
            console.error("Error finalizando jornada:", error);
            setMessage('Error al finalizar.');
        }
        setIsSaving(false);
    };


    const handleCalcularPuntosYCerrar = async () => {
        if (resultadoLocal === '' || resultadoVisitante === '') {
             alert("Debes introducir el resultado final (goles) para finalizar la jornada.");
             return;
        }
        if (!window.confirm("ACCIÓN DEFINITIVA: ¿Calcular puntos, asignar insignias, gestionar bote y cerrar esta jornada?")) {
            return;
        }

        setIsCalculating(true);
        setMessage('Procesando jornada... Esto puede tardar unos segundos.');
        
        try {
            const calcularPuntosFn = httpsCallable(functions, 'calcularPuntosYCerrarJornada');
            const result = await calcularPuntosFn({ jornadaId: jornada.id });

            if (result.data.success) {
                setMessage(`¡Éxito! ${result.data.message}`);
                onForceRecalculate(); // Forza la recarga de datos en el panel de admin
            } else {
                throw new Error(result.data.error || 'Error desconocido en la Cloud Function.');
            }
        } catch (error) {
            console.error("Error masivo al calcular puntos: ", error);
            setMessage(`Error crítico: ${error.message}`);
        }
        setIsCalculating(false);
    };


    if (
        (searchTerm && !jornada.equipoLocal.toLowerCase().includes(searchTerm) && !jornada.equipoVisitante.toLowerCase().includes(searchTerm)) ||
        (filterRange && (jornada.numeroJornada < filterRange[0] || jornada.numeroJornada > filterRange[1]))
    ) {
        return null;
    }


    return (
        <div style={jornada.id === 'jornada_test' ? {...styles.adminJornadaItem, ...styles.testJornadaAdminItem} : (jornada.esVip ? {...styles.adminJornadaItem, ...styles.jornadaVip} : styles.adminJornadaItem)}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap'}}><p><strong>{jornada.id === 'jornada_test' ? 'Jornada de Prueba' : `Jornada ${jornada.numeroJornada || 'Copa'}`}:</strong> {jornada.equipoLocal} vs {jornada.equipoVisitante}</p><div style={styles.vipToggleContainer}><label htmlFor={`vip-toggle-${jornada.id}`}>⭐ VIP</label><input id={`vip-toggle-${jornada.id}`} type="checkbox" checked={esVip} onChange={(e) => setEsVip(e.target.checked)} style={styles.checkbox}/></div></div>
            <div style={styles.adminControls}>
                <select value={estado} onChange={(e) => setEstado(e.target.value)} style={styles.adminSelect}><option value="Próximamente">Próximamente</option><option value="Pre-apertura">Pre-apertura</option><option value="Abierta">Abierta</option><option value="Cerrada">Cerrada</option><option value="En vivo">En vivo</option><option value="Finalizada">Finalizada</option></select>
                <div style={styles.resultInputContainer}><input type="number" min="0" value={resultadoLocal} onChange={(e) => setResultadoLocal(e.target.value)} style={styles.resultInput} placeholder="L" /><span style={styles.separator}>-</span><input type="number" min="0" value={resultadoVisitante} onChange={(e) => setResultadoVisitante(e.target.value)} style={styles.resultInput} placeholder="V"/></div>
                <select value={goleador} onChange={(e) => setGoleador(e.target.value)} style={styles.adminSelect}><option value="">-- Goleador Final --</option><option value="SG">Sin Goleador (SG)</option>{plantilla.sort((a, b) => a.nombre.localeCompare(b.nombre)).map(jugador => (<option key={jugador.nombre} value={jugador.nombre}>{jugador.dorsal ? `${jugador.dorsal} - ${jugador.nombre}` : jugador.nombre}</option>))}</select>
                <input type="datetime-local" value={fechaApertura} onChange={(e) => setFechaApertura(e.target.value)} style={styles.adminInput} />
                <input type="datetime-local" value={fechaCierre} onChange={(e) => setFechaCierre(e.target.value)} style={styles.adminInput} />
                <input type="datetime-local" value={fechaPartido} onChange={(e) => setFechaPartido(e.target.value)} style={styles.adminInput} />
            </div>
            <div style={{marginTop: '10px'}}><textarea value={splashMessage} onChange={(e) => setSplashMessage(e.target.value)} style={{...styles.input, width: '95%', height: '50px'}} placeholder="Mensaje para la pantalla principal..." /></div>
            <div style={{marginTop: '10px'}}><input type="text" value={estadioImageUrl} onChange={(e) => setEstadioImageUrl(e.target.value)} style={{...styles.input, width: '95%'}} placeholder="URL Imagen del Estadio..." /></div>
            <div style={{marginTop: '20px', paddingTop: '15px', borderTop: `1px dashed ${styles.colors.blue}`}}><h4 style={{color: styles.colors.yellow, marginBottom: '15px', textAlign: 'center'}}>Configuración API-Football</h4><div style={styles.adminControls}><input type="text" value={apiLeagueId} onChange={(e) => setApiLeagueId(e.target.value)} style={styles.adminInput} placeholder="ID Liga (Ej: 140)" /><input type="text" value={apiLocalTeamId} onChange={(e) => setApiLocalTeamId(e.target.value)} style={styles.adminInput} placeholder="ID Equipo Local (Ej: 720)" /><input type="text" value={apiVisitorTeamId} onChange={(e) => setApiVisitorTeamId(e.target.value)} style={styles.adminInput} placeholder="ID Equipo Visitante (Ej: 727)" /></div></div>

            <div style={{marginTop: '20px', display: 'flex', flexWrap: 'wrap', gap: '10px'}}>
                <button onClick={handleSaveChanges} disabled={isSaving} style={styles.saveButton}>{isSaving ? 'Guardando...' : 'Guardar Cambios'}</button>
                {jornada.estado === 'Finalizada' && (<button onClick={handleCalcularPuntosYCerrar} disabled={isCalculating} style={{...styles.saveButton, backgroundColor: styles.colors.gold, color: colors.deepBlue}}>{isCalculating ? 'Procesando...' : 'Calcular Puntos y Cerrar Jornada'}</button>)}
                {message && <span style={{marginLeft: '10px', color: styles.colors.success, alignSelf: 'center'}}>{message}</span>}
            </div>
            
            {(jornada.estado === 'Cerrada' || jornada.estado === 'En vivo') && (
                <div style={styles.liveAdminContainer}>
                    <h4 style={styles.liveAdminTitle}>🔴 Control del Partido en Vivo</h4>
                    <div style={styles.adminControls}>
                        <div style={styles.resultInputContainer}><input type="number" min="0" value={liveData.golesLocal} onChange={(e) => setLiveData(d => ({ ...d, golesLocal: parseInt(e.target.value) || 0 }))} style={styles.resultInput} /><span style={styles.separator}>-</span><input type="number" min="0" value={liveData.golesVisitante} onChange={(e) => setLiveData(d => ({ ...d, golesVisitante: parseInt(e.target.value) || 0 }))} style={styles.resultInput} /></div>
                        <select value={liveData.ultimoGoleador} onChange={(e) => setLiveData(d => ({...d, ultimoGoleador: e.target.value}))} style={styles.adminSelect}><option value="">-- Último Goleador --</option><option value="SG">Sin Goleador (SG)</option>{plantilla.sort((a, b) => a.nombre.localeCompare(b.nombre)).map(jugador => (<option key={jugador.nombre} value={jugador.nombre}>{jugador.dorsal ? `${jugador.dorsal} - ${jugador.nombre}` : jugador.nombre}</option>))}</select>
                    </div>
                     <button onClick={() => handleUpdateLiveState(jornada.estado !== 'En vivo')} disabled={isSaving} style={{...styles.saveButton, backgroundColor: styles.colors.danger, marginTop: '15px'}}>
                        {isSaving ? 'Actualizando...' : (jornada.estado === 'En vivo' ? 'Actualizar Marcador EN VIVO' : 'Activar Modo EN VIVO')}
                    </button>
                    <button onClick={handleSetFinalState} disabled={isSaving} style={{...styles.saveButton, backgroundColor: styles.colors.blue, marginTop: '15px', marginLeft: '10px'}}>
                        Marcar como FINALIZADA
                    </button>
                </div>
            )}
        </div>
    );
};

const AdminTestJornada = () => {
    const [isActive, setIsActive] = useState(false);
    const [loading, setLoading] = useState(true);
    const testJornadaRef = useMemo(() => doc(db, "jornadas", "jornada_test"), []);

    useEffect(() => {
        const checkStatus = async () => { setLoading(true); const docSnap = await getDoc(testJornadaRef); setIsActive(docSnap.exists()); setLoading(false); }
        const unsubscribe = onSnapshot(testJornadaRef, (doc) => { setIsActive(doc.exists()); });
        checkStatus(); return () => unsubscribe();
    }, [testJornadaRef]);

    const handleToggleTestJornada = async () => {
        setLoading(true);
        if (isActive) {
            if (window.confirm("¿Seguro que quieres DESACTIVAR y BORRAR la jornada de prueba? Todos los pronósticos asociados se eliminarán permanentemente.")) {
                await deleteDoc(testJornadaRef);
                const pronosticosRef = collection(db, "pronosticos", "jornada_test", "jugadores");
                const pronosticosSnap = await getDocs(pronosticosRef);
                const batch = writeBatch(db);
                pronosticosSnap.docs.forEach(d => batch.delete(d.ref));
                await batch.commit();
                alert("Jornada de prueba desactivada y todos sus datos han sido borrados.");
            }
        } else {
            const testJornadaData = { numeroJornada: 99, equipoLocal: "UD Las Palmas", equipoVisitante: "Real Zaragoza", estado: "Abierta", esVip: false, bote: 0, fechaStr: "Partido de Prueba", estadio: "Estadio de Pruebas", estadioImageUrl: "https://as01.epimg.net/img/comunes/fotos/fichas/estadios/g/grc.jpg", liveData: { isLive: false, golesLocal: 0, golesVisitante: 0, ultimoGoleador: '' }, fechaApertura: new Date(), fechaCierre: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000), fechaPartido: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000) };
            await setDoc(testJornadaRef, testJornadaData);
            alert("Jornada de prueba ACTIVADA. Ahora es visible para todos y puedes gestionarla en la lista de jornadas de abajo.");
        }
        setLoading(false);
    };

    return (
        <div style={{...styles.adminJornadaItem, ...styles.testJornadaAdminItem}}>
            <h3 style={styles.formSectionTitle}>🧪 Gestión de Jornada de Prueba</h3>
            <p style={{textAlign: 'center', margin: '10px 0', lineHeight: 1.5}}>Usa esta opción para crear una jornada de prueba. Una vez activada, aparecerá en la lista de abajo y podrás gestionarla como cualquier otra jornada.</p>
            <div style={{display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap'}}>
                <button onClick={handleToggleTestJornada} disabled={loading} style={{...styles.mainButton, backgroundColor: isActive ? styles.colors.danger : styles.colors.success, borderColor: isActive ? styles.colors.danger : styles.colors.success, margin: '10px 0'}}>
                    {loading ? 'Cargando...' : (isActive ? 'Desactivar y Borrar Jornada' : 'Activar Jornada de Prueba')}
                </button>
            </div>
        </div>
    );
}

const AdminEscudosManager = ({ onBack, teamLogos }) => {
    const [urls, setUrls] = useState(teamLogos || {});
    const [saving, setSaving] = useState({});
    useEffect(() => { setUrls(teamLogos || {}); }, [teamLogos]);
    const handleUrlChange = (teamName, value) => { setUrls(prev => ({ ...prev, [teamName]: value })); };
    const handleSave = async (teamName) => {
        setSaving(prev => ({ ...prev, [teamName]: true }));
        const docRef = doc(db, "configuracion", "escudos");
        try { await setDoc(docRef, { [teamName]: urls[teamName] }, { merge: true }); } 
        catch (error) { console.error("Error al guardar el escudo:", error); alert("Error al guardar el escudo."); } 
        finally { setSaving(prev => ({ ...prev, [teamName]: false })); }
    };

    return (
        <div style={styles.adminJornadaItem}>
            <button onClick={onBack} style={styles.backButton}>&larr; Volver al Panel</button>
            <h3 style={styles.formSectionTitle}>Gestión de Escudos de Equipos</h3>
            <p style={{textAlign: 'center', marginBottom: '20px'}}>Pega la URL de la imagen del escudo para cada equipo y pulsa "Guardar".</p>
            <div style={styles.escudosGrid}>
                {EQUIPOS_LIGA.map(teamName => (
                    <div key={teamName} style={styles.escudoCard}>
                        <img src={urls[teamName] || 'https://placehold.co/80x80/1b263b/e0e1dd?text=?'} style={styles.escudoCardImg} alt={teamName} onError={(e) => { e.target.src = 'https://placehold.co/80x80/e63946/ffffff?text=Error'; }}/>
                        <p style={styles.escudoCardName}>{teamName}</p>
                        <input type="text" value={urls[teamName] || ''} onChange={(e) => handleUrlChange(teamName, e.target.value)} placeholder="Pega la URL del escudo aquí" style={styles.escudoInput}/>
                        <button onClick={() => handleSave(teamName)} disabled={saving[teamName]} style={styles.escudoSaveButton}>{saving[teamName] ? '...' : 'Guardar'}</button>
                    </div>
                ))}
            </div>
        </div>
    );
};

const AdminPlantillaManager = ({ onBack, plantilla, setPlantilla }) => {
    const [jugadores, setJugadores] = useState(plantilla);
    const [newJugador, setNewJugador] = useState({ dorsal: '', nombre: '', imageUrl: '' });
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [verificationResults, setVerificationResults] = useState(null);

    const handleInputChange = (index, field, value) => {
        const updatedJugadores = [...jugadores];
        updatedJugadores[index][field] = value;
        setJugadores(updatedJugadores);
    };

    const handleNewJugadorChange = (field, value) => {
        setNewJugador(prev => ({ ...prev, [field]: value }));
    };

    const handleAddJugador = () => {
        if (!newJugador.nombre) {
            alert("El nombre del jugador no puede estar vacío.");
            return;
        }
        setJugadores([...jugadores, { ...newJugador, id: Date.now() }]); // Usamos un id temporal
        setNewJugador({ dorsal: '', nombre: '', imageUrl: '' });
    };

    const handleRemoveJugador = (index) => {
        if (window.confirm(`¿Seguro que quieres eliminar a ${jugadores[index].nombre}?`)) {
            const updatedJugadores = jugadores.filter((_, i) => i !== index);
            setJugadores(updatedJugadores);
        }
    };

    const handleSaveChanges = async () => {
        setSaving(true);
        setMessage('');
        const plantillaRef = doc(db, "configuracion", "plantilla");
        try {
            const jugadoresToSave = jugadores.map(({ id, ...rest }) => rest);
            await setDoc(plantillaRef, { jugadores: jugadoresToSave });
            setPlantilla(jugadores);
            setMessage('¡Plantilla guardada con éxito!');
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error("Error al guardar la plantilla:", error);
            setMessage('Error al guardar la plantilla.');
        }
        setSaving(false);
    };

    const handleVerifyImages = async () => {
        setVerifying(true);
        setVerificationResults(null);
        setMessage('Verificando imágenes, por favor espera...');

        const results = { ok: [], failed: [] };
        const checkImage = (jugador) => {
            return new Promise((resolve) => {
                if (!jugador.imageUrl || jugador.imageUrl.trim() === '') {
                    results.failed.push({ nombre: jugador.nombre, reason: 'URL vacía' });
                    resolve();
                    return;
                }
                const img = new Image();
                img.onload = () => { results.ok.push(jugador.nombre); resolve(); };
                img.onerror = () => { results.failed.push({ nombre: jugador.nombre, reason: 'No se pudo cargar' }); resolve(); };
                img.src = jugador.imageUrl;
            });
        };

        await Promise.all(jugadores.map(checkImage));
        setVerificationResults(results);
        setVerifying(false);
        setMessage('Verificación completada.');
    };

    return (
        <div style={styles.adminJornadaItem}>
            <button onClick={onBack} style={styles.backButton}>&larr; Volver al Panel</button>
            <h3 style={styles.formSectionTitle}>Gestión de Plantilla</h3>
            <p style={{textAlign: 'center', marginBottom: '20px'}}>Añade, edita o elimina jugadores de la plantilla.</p>
            
            <div style={styles.plantillaList}>
                {jugadores.map((jugador, index) => (
                    <div key={jugador.id || index} style={styles.plantillaItem}>
                        <input type="text" value={jugador.dorsal} onChange={(e) => handleInputChange(index, 'dorsal', e.target.value)} placeholder="Dorsal" style={styles.plantillaInput} />
                        <input type="text" value={jugador.nombre} onChange={(e) => handleInputChange(index, 'nombre', e.target.value)} placeholder="Nombre" style={{...styles.plantillaInput, flex: 2}} />
                        <input type="text" value={jugador.imageUrl} onChange={(e) => handleInputChange(index, 'imageUrl', e.target.value)} placeholder="URL Imagen (PNG)" style={{...styles.plantillaInput, flex: 3}} />
                        <button onClick={() => handleRemoveJugador(index)} style={styles.plantillaRemoveBtn}>-</button>
                    </div>
                ))}
            </div>

            <div style={{...styles.plantillaItem, marginTop: '20px', borderTop: `2px dashed ${styles.colors.blue}`, paddingTop: '20px'}}>
                <input type="text" value={newJugador.dorsal} onChange={(e) => handleNewJugadorChange('dorsal', e.target.value)} placeholder="Dorsal" style={styles.plantillaInput} />
                <input type="text" value={newJugador.nombre} onChange={(e) => handleNewJugadorChange('nombre', e.target.value)} placeholder="Nombre" style={{...styles.plantillaInput, flex: 2}} />
                <input type="text" value={newJugador.imageUrl} onChange={(e) => handleNewJugadorChange('imageUrl', e.target.value)} placeholder="URL Imagen (PNG)" style={{...styles.plantillaInput, flex: 3}} />
                <button onClick={handleAddJugador} style={styles.plantillaAddBtn}>+</button>
            </div>
            
            <div style={{display: 'flex', gap: '10px', marginTop: '30px'}}>
                <button onClick={handleSaveChanges} disabled={saving || verifying} style={{...styles.saveButton}}>
                    {saving ? 'Guardando...' : 'Guardar Cambios en la Plantilla'}
                </button>
                <button onClick={handleVerifyImages} disabled={verifying || saving} style={{...styles.saveButton, backgroundColor: styles.colors.blue}}>
                    {verifying ? 'Verificando...' : 'Verificar Fotos de Jugadores'}
                </button>
            </div>
            {message && <p style={{...styles.message, marginTop: '15px'}}>{message}</p>}

            {verificationResults && (
                <div style={styles.verificationResultsContainer}>
                    <h4>Resultados de la Verificación:</h4>
                    <p style={{color: styles.colors.success}}><strong>{verificationResults.ok.length} imágenes OK</strong></p>
                    {verificationResults.failed.length > 0 && (
                        <div>
                            <p style={{color: styles.colors.danger}}><strong>{verificationResults.failed.length} imágenes fallidas:</strong></p>
                            <ul style={styles.verificationList}>
                                {verificationResults.failed.map(fail => (
                                    <li key={fail.nombre}>{fail.nombre} ({fail.reason})</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const AdminPorraAnual = ({ onBack }) => {
    const [config, setConfig] = useState({ estado: '', ascensoFinal: '', posicionFinal: '', fechaCierre: '' });
    const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [calculating, setCalculating] = useState(false); const [message, setMessage] = useState('');
    const configRef = useMemo(() => doc(db, "configuracion", "porraAnual"), []);

    const toInputFormat = (date) => {
        if (!date || !date.seconds) return '';
        const d = new Date(date.seconds * 1000);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().slice(0, 16);
    };

    useEffect(() => {
        setLoading(true);
        getDoc(configRef).then((docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setConfig({ ...data, fechaCierre: toInputFormat(data.fechaCierre) });
            }
            setLoading(false);
        }).catch(error => {
            console.error("Error al cargar config anual: ", error);
            setLoading(false);
        });
    }, [configRef]);

    const handleSaveConfig = async () => {
        setSaving(true);
        try {
            const configToSave = {
                ...config,
                fechaCierre: config.fechaCierre ? new Date(config.fechaCierre) : null,
            };
            await setDoc(configRef, configToSave, { merge: true });
            setMessage('¡Configuración guardada!');
        }
        catch (error) { console.error("Error guardando config anual", error); setMessage('Error al guardar.'); }
        finally { setSaving(false); setTimeout(() => setMessage(''), 3000); }
    };
    
    // --- NUEVO: Lógica para calcular puntos de la Porra Anual ---
    const handleCalcularPuntosAnual = async () => {
        if (!config.ascensoFinal || !config.posicionFinal) { alert("Debes establecer el resultado de Ascenso y la Posición Final antes de calcular."); return; }
        if (!window.confirm("¿Seguro que quieres calcular y repartir los puntos de la Porra Anual? Esta acción es irreversible.")) { return; }
        setCalculating(true);
        try {
            const pronosticosRef = collection(db, "porraAnualPronosticos");
            const pronosticosSnap = await getDocs(pronosticosRef);
            const pronosticos = pronosticosSnap.docs.map(p => ({ id: p.id, ...p.data() }));
            
            const batch = writeBatch(db);

            for (const p of pronosticos) {
                let puntosObtenidos = 0;
                const aciertoAscenso = p.ascenso === config.ascensoFinal;
                const aciertoPosicion = parseInt(p.posicion) === parseInt(config.posicionFinal);
                
                if (aciertoAscenso && aciertoPosicion) { puntosObtenidos = 20; } 
                else if (aciertoPosicion) { puntosObtenidos = 10; }
                else if (aciertoAscenso) { puntosObtenidos = 5; }
                
                if (puntosObtenidos > 0) { 
                    const clasificacionRef = doc(db, "clasificacion", p.id); 
                    batch.update(clasificacionRef, { puntosTotales: increment(puntosObtenidos) }); 
                }
                
                const pronosticoAnualRef = doc(db, "porraAnualPronosticos", p.id);
                batch.update(pronosticoAnualRef, { puntosObtenidos });
            }
            
            batch.update(configRef, { estado: "Finalizada" });
            
            await batch.commit(); 
            setMessage("¡Puntos de la Porra Anual calculados y repartidos con éxito!"); 

        } catch (error) { 
            console.error("Error al calcular puntos anuales:", error); 
            setMessage("Error al calcular los puntos."); 
        } finally { 
            setCalculating(false); 
        }
    };


    if (loading) return <LoadingSkeleton />;

    return (
        <div style={styles.adminJornadaItem}>
            <button onClick={onBack} style={styles.backButton}>&larr; Volver al Panel</button>
            <h3 style={styles.formSectionTitle}>Gestión Porra Anual</h3>
            <div style={styles.adminControls}>
                <div><label style={styles.label}>Estado de la Porra</label><select value={config.estado || ''} onChange={(e) => setConfig(c => ({ ...c, estado: e.target.value }))} style={styles.adminSelect}><option value="Inactiva">Inactiva</option><option value="Abierta">Abierta</option><option value="Cerrada">Cerrada</option><option value="Finalizada">Finalizada</option></select></div>
                <div><label style={styles.label}>Fecha Cierre Apuestas</label><input type="datetime-local" value={config.fechaCierre || ''} onChange={(e) => setConfig(c => ({ ...c, fechaCierre: e.target.value }))} style={styles.adminInput} /></div>
                {/* --- NUEVO: Campos para resultado final --- */}
                <div><label style={styles.label}>Resultado Ascenso</label><select value={config.ascensoFinal || ''} onChange={(e) => setConfig(c => ({ ...c, ascensoFinal: e.target.value }))} style={styles.adminSelect}><option value="">-- Pendiente --</option><option value="SI">SI</option><option value="NO">NO</option></select></div>
                <div><label style={styles.label}>Posición Final</label><input type="number" min="1" max="22" value={config.posicionFinal || ''} onChange={(e) => setConfig(c => ({ ...c, posicionFinal: e.target.value }))} style={styles.adminInput}/></div>
            </div>
            <div style={{marginTop: '20px'}}>
                <button onClick={handleSaveConfig} disabled={saving} style={styles.saveButton}>{saving ? 'Guardando...' : 'Guardar Configuración'}</button>
                <button onClick={handleCalcularPuntosAnual} disabled={calculating || config.estado !== 'Cerrada'} style={{...styles.saveButton, backgroundColor: styles.colors.gold, color: styles.colors.deepBlue}}>{calculating ? 'Calculando...' : 'Calcular Puntos Finales'}</button>
            </div>
             {message && <p style={{...styles.message, marginTop: '15px'}}>{message}</p>}
        </div>
    );
};

const AdminUserManager = ({ onBack }) => {
    const [selectedUser, setSelectedUser] = useState('');
    const [message, setMessage] = useState('');

    const handleResetJokers = async () => {
        if (!selectedUser) { alert("Por favor, selecciona un jugador."); return; }
        if (window.confirm(`¿Seguro que quieres reiniciar los Jokers de ${selectedUser} a 2?`)) {
            const userRef = doc(db, "clasificacion", selectedUser);
            try {
                await setDoc(userRef, { jokersRestantes: 2 }, { merge: true });
                setMessage(`Jokers de ${selectedUser} reiniciados con éxito.`);
            } catch (error) {
                console.error("Error reiniciando jokers:", error);
                setMessage(`Error al reiniciar los jokers de ${selectedUser}.`);
            }
        }
    };

    const handleResetPin = async () => {
        if (!selectedUser) { alert("Por favor, selecciona un jugador."); return; }
        const jornadaId = prompt("Introduce el ID de la jornada para la que quieres reiniciar el PIN (ej: jornada_1):");
        if (!jornadaId) return;

        if (window.confirm(`¿Seguro que quieres borrar el PIN de ${selectedUser} para la ${jornadaId}? El jugador podrá editar su apuesta.`)) {
            const pronosticoRef = doc(db, "pronosticos", jornadaId, "jugadores", selectedUser);
            try {
                await updateDoc(pronosticoRef, { pin: "" });
                setMessage(`PIN de ${selectedUser} para la ${jornadaId} borrado.`);
            } catch (error) {
                console.error("Error borrando PIN:", error);
                setMessage(`Error al borrar el PIN. Verifica que el ID de la jornada es correcto y que el jugador tiene un pronóstico guardado.`);
            }
        }
    };

    return (
        <div style={styles.adminJornadaItem}>
            <button onClick={onBack} style={styles.backButton}>&larr; Volver al Panel</button>
            <h3 style={styles.formSectionTitle}>🔧 Gestión de Jugadores</h3>
            <div style={styles.adminControls}>
                <div>
                    <label style={styles.label}>Seleccionar Jugador</label>
                    <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} style={styles.adminSelect}>
                        <option value="">-- Elige un jugador --</option>
                        {JUGADORES.map(j => <option key={j} value={j}>{j}</option>)}
                    </select>
                </div>
            </div>
            <div style={{marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center'}}>
                <button onClick={handleResetJokers} disabled={!selectedUser} style={styles.saveButton}>Reiniciar Jokers</button>
                <button onClick={handleResetPin} disabled={!selectedUser} style={{...styles.saveButton, backgroundColor: styles.colors.warning}}>Borrar PIN de Jornada</button>
            </div>
            {message && <p style={{...styles.message, marginTop: '15px'}}>{message}</p>}
        </div>
    );
};

const AdminNotifications = ({ onBack }) => {
    const [message, setMessage] = useState('');
    const [customMessage, setCustomMessage] = useState('');
    const [sending, setSending] = useState(false);

    const PRESET_MESSAGES = [
        "¡Nueva jornada abierta! ¡Haz tu pronóstico!",
        "¡Últimas horas para hacer tu porra! ⏳",
        "Las apuestas se han cerrado. ¡Suerte a todos!",
        "¡Ya están los resultados! Comprueba si has ganado. 🏆"
    ];

    const handleSendNotification = async (msgToSend) => {
        if (!msgToSend) {
            alert("El mensaje no puede estar vacío.");
            return;
        }
        setSending(true);
        setMessage(`Enviando: "${msgToSend}"...`);

        try {
            const sendGlobalNotification = httpsCallable(functions, 'sendGlobalNotification');
            const result = await sendGlobalNotification({ message: msgToSend });
            
            console.log("Respuesta de la función:", result.data);
            setMessage(`✅ ${result.data.message}`);
            
        } catch (error) {
            console.error("Error al llamar a la Cloud Function:", error);
            setMessage(`❌ Error: ${error.message}`);
        } finally {
            setSending(false);
        }
    };

    return (
        <div style={styles.adminJornadaItem}>
            <button onClick={onBack} style={styles.backButton}>&larr; Volver al Panel</button>
            <h3 style={styles.formSectionTitle}>📣 Comunicaciones y Notificaciones</h3>
            <p style={{textAlign: 'center', marginBottom: '20px'}}>Envía notificaciones push a todos los jugadores que las tengan activadas.</p>
            
            <div style={styles.presetMessagesContainer}>
                <label style={styles.label}>Mensajes predefinidos</label>
                {PRESET_MESSAGES.map((msg, i) => (
                    <button key={i} onClick={() => handleSendNotification(msg)} disabled={sending} style={styles.presetMessageButton}>
                        {msg}
                    </button>
                ))}
            </div>

            <div style={{marginTop: '20px'}}>
                <label style={styles.label}>Mensaje personalizado</label>
                <textarea 
                    value={customMessage} 
                    onChange={(e) => setCustomMessage(e.target.value)} 
                    style={{...styles.input, width: '95%', height: '60px'}} 
                    placeholder="Escribe un mensaje corto..."
                />
                <button onClick={() => handleSendNotification(customMessage)} disabled={sending || !customMessage} style={{...styles.saveButton, marginTop: '10px'}}>
                    {sending ? 'Enviando...' : 'Enviar Mensaje Personalizado'}
                </button>
            </div>

            {message && <p style={{...styles.message, marginTop: '15px'}}>{message}</p>}
        </div>
    );
};

const AdminTools = ({ onBack }) => {
    const [isRecalculating, setIsRecalculating] = useState(false);
    const [isFameCalculating, setIsFameCalculating] = useState(false);
    const [message, setMessage] = useState('');
    const [fameMessage, setFameMessage] = useState('');

    const handleRecalculateAllStats = async () => {
        if (!window.confirm("ADVERTENCIA: Esta acción borrará y recalculará TODAS las estadísticas de la clasificación (Puntos Totales, Desglose, Plenos) basándose en las jornadas finalizadas. Es un proceso intensivo y solo debe usarse para corregir datos históricos. ¿Continuar?")) {
            return;
        }
        setIsRecalculating(true);
        setMessage('Iniciando re-cálculo... Este proceso puede tardar unos segundos.');

        try {
            setMessage('Paso 1/4: Reseteando clasificación actual...');
            const clasificacionRef = collection(db, "clasificacion");
            const clasificacionSnap = await getDocs(clasificacionRef);
            const resetBatch = writeBatch(db);
            clasificacionSnap.forEach(doc => {
                resetBatch.set(doc.ref, {
                    puntosTotales: 0,
                    puntosResultadoExacto: 0,
                    puntos1x2: 0,
                    puntosGoleador: 0,
                    plenos: 0,
                }, { merge: true });
            });
            await resetBatch.commit();

            setMessage('Paso 2/4: Obteniendo jornadas finalizadas...');
            const qJornadas = query(collection(db, "jornadas"), where("estado", "==", "Finalizada"), orderBy("numeroJornada"));
            const jornadasSnap = await getDocs(qJornadas);
            const jornadasFinalizadas = jornadasSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            const statsAccumulator = {};
            JUGADORES.forEach(j => {
                statsAccumulator[j] = { puntosTotales: 0, puntosResultadoExacto: 0, puntos1x2: 0, puntosGoleador: 0, plenos: 0 };
            });

            for (const jornada of jornadasFinalizadas) {
                setMessage(`Paso 3/4: Procesando Jornada ${jornada.numeroJornada}...`);
                const pronosticosSnap = await getDocs(collection(db, "pronosticos", jornada.id, "jugadores"));
                
                pronosticosSnap.forEach(pronosticoDoc => {
                    const p = { id: pronosticoDoc.id, ...pronosticoDoc.data() };
                    const esVipJornada = jornada.esVip || false;
                    let puntosExacto = 0, puntos1X2 = 0, puntosGoleadorCat = 0;
                    
                    const aciertoExacto = p.golesLocal !== '' && p.golesVisitante !== '' && parseInt(p.golesLocal) === parseInt(jornada.resultadoLocal) && parseInt(p.golesVisitante) === parseInt(jornada.resultadoVisitante);
                    if (aciertoExacto) puntosExacto = esVipJornada ? 6 : 3;

                    let resultado1x2Real = '';
                    if (jornada.equipoLocal === "UD Las Palmas") {
                        if (parseInt(jornada.resultadoLocal) > parseInt(jornada.resultadoVisitante)) resultado1x2Real = 'Gana UD Las Palmas';
                        else if (parseInt(jornada.resultadoLocal) < parseInt(jornada.resultadoVisitante)) resultado1x2Real = 'Pierde UD Las Palmas';
                        else resultado1x2Real = 'Empate';
                    } else {
                        if (parseInt(jornada.resultadoVisitante) > parseInt(jornada.resultadoLocal)) resultado1x2Real = 'Gana UD Las Palmas';
                        else if (parseInt(jornada.resultadoVisitante) < parseInt(jornada.resultadoLocal)) resultado1x2Real = 'Pierde UD Las Palmas';
                        else resultado1x2Real = 'Empate';
                    }
                    const acierto1x2 = p.resultado1x2 === resultado1x2Real;
                    if (acierto1x2) puntos1X2 = esVipJornada ? 2 : 1;
                    
                    const goleadorReal = (jornada.goleador || '').trim().toLowerCase();
                    const goleadorApostado = p.goleador ? p.goleador.trim().toLowerCase() : '';
                    let aciertoGoleador = false;
                    if (p.sinGoleador && (goleadorReal === "sg" || goleadorReal === "")) { puntosGoleadorCat = 1; aciertoGoleador = true; }
                    else if (!p.sinGoleador && goleadorApostado === goleadorReal && goleadorReal !== "") { puntosGoleadorCat = esVipJornada ? 4 : 2; aciertoGoleador = true; }

                    if (p.jokerActivo && p.jokerPronosticos && p.jokerPronosticos.length > 0) {
                        for (const jokerP of p.jokerPronosticos) {
                            if (jokerP.golesLocal !== '' && jokerP.golesVisitante !== '' && parseInt(jokerP.golesLocal) === parseInt(jornada.resultadoLocal) && parseInt(jokerP.golesVisitante) === parseInt(jornada.resultadoVisitante)) {
                                puntosExacto += esVipJornada ? 6 : 3;
                                break;
                            }
                        }
                    }

                    if (statsAccumulator[p.id]) {
                        statsAccumulator[p.id].puntosTotales += (puntosExacto + puntos1X2 + puntosGoleadorCat);
                        statsAccumulator[p.id].puntosResultadoExacto += puntosExacto;
                        statsAccumulator[p.id].puntos1x2 += puntos1X2;
                        statsAccumulator[p.id].puntosGoleador += puntosGoleadorCat;
                        if (aciertoExacto && acierto1x2 && aciertoGoleador) {
                            statsAccumulator[p.id].plenos += 1;
                        }
                    }
                });
            }

            setMessage('Paso 4/4: Guardando nuevos totales...');
            const finalBatch = writeBatch(db);
            for (const jugadorId in statsAccumulator) {
                const userRef = doc(db, "clasificacion", jugadorId);
                finalBatch.update(userRef, statsAccumulator[jugadorId]);
            }
            await finalBatch.commit();
            setMessage('¡Re-cálculo completado con éxito! Los datos de la clasificación han sido actualizados.');

        } catch (error) {
            console.error("Error durante el re-cálculo:", error);
            setMessage(`Error: ${error.message}`);
        } finally {
            setIsRecalculating(false);
        }
    };
    
    // PASEO DE LA FAMA: Lógica de cálculo completa
    const handleUpdateFameStats = async () => {
        if (!window.confirm("Esta acción recalculará todas las estadísticas del Paseo de la Fama. Puede tardar un momento. ¿Continuar?")) return;
        
        setIsFameCalculating(true);
        setFameMessage('Iniciando cálculo del Paseo de la Fama...');

        try {
            const qJornadas = query(collection(db, "jornadas"), where("estado", "==", "Finalizada"), orderBy("numeroJornada"));
            const jornadasSnap = await getDocs(qJornadas);
            const jornadas = jornadasSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            const pronosticosPorJornada = {};
            for(const j of jornadas) {
                const pronosSnap = await getDocs(collection(db, "pronosticos", j.id, "jugadores"));
                pronosticosPorJornada[j.id] = pronosSnap.docs.map(d => ({id: d.id, ...d.data()}));
            }
            
            const newFameStats = {};

            // 1. Rey Midas (Más dinero ganado) - CORREGIDO
            setFameMessage('Calculando: Rey Midas...');
            const premiosPorJugador = JUGADORES.reduce((acc, j) => ({ ...acc, [j]: 0 }), {});
            for(const j of jornadas) {
                if(j.ganadores && j.ganadores.length > 0 && j.premioTotal) {
                    const premioPorGanador = j.premioTotal / j.ganadores.length;
                    j.ganadores.forEach(g => {
                        if(premiosPorJugador[g] !== undefined) {
                            premiosPorJugador[g] += premioPorGanador;
                        }
                    });
                }
            }
            const midasEntry = Object.entries(premiosPorJugador).sort((a, b) => b[1] - a[1])[0];
            newFameStats.rey_midas = { jugador: midasEntry[0], valor: `${midasEntry[1].toFixed(2)}€` };

            // 2. Pelotazo (Más puntos en una jornada)
            setFameMessage('Calculando: El Pelotazo...');
            let pelotazo = { jugador: null, valor: 0 };
            for(const j of jornadas) {
                pronosticosPorJornada[j.id].forEach(p => {
                    if ((p.puntosObtenidos || 0) > pelotazo.valor) {
                        pelotazo = { jugador: p.id, valor: p.puntosObtenidos };
                    }
                });
            }
            newFameStats.pelotazo = { ...pelotazo, valor: `${pelotazo.valor} puntos` };

            // Resto de estadísticas
            setFameMessage('Calculando más estadísticas...');
            const atrevidoCounts = JUGADORES.reduce((acc, j) => ({ ...acc, [j]: 0 }), {});
            const regularidadCounts = JUGADORES.reduce((acc, j) => ({ ...acc, [j]: 0 }), {});
            const profetaCounts = JUGADORES.reduce((acc, j) => ({ ...acc, [j]: 0 }), {});
            const rachasPuntuando = JUGADORES.reduce((acc, j) => ({ ...acc, [j]: { max: 0, actual: 0 } }), {});
            const rachasCenizo = JUGADORES.reduce((acc, j) => ({ ...acc, [j]: { max: 0, actual: 0 } }), {});
            const obstinadoCounts = {}; // { '1-0': { 'Juanma': 5, 'Laura': 2 } }

            for (const j of jornadas) {
                const pronosJornada = pronosticosPorJornada[j.id];
                const resultadoJornada = `${j.resultadoLocal}-${j.resultadoVisitante}`;
                
                pronosJornada.forEach(p => {
                    // Atrevido
                    const miResultado = `${p.golesLocal}-${p.golesVisitante}`;
                    if(miResultado === resultadoJornada) {
                        const otrosConMismoResultado = pronosJornada.filter(otro => otro.id !== p.id && `${otro.golesLocal}-${otro.golesVisitante}` === miResultado).length;
                        if(otrosConMismoResultado === 0) atrevidoCounts[p.id]++;
                    }
                    // Mr. Regularidad
                    if(p.puntosObtenidos > 0) regularidadCounts[p.id]++;
                    // Profeta
                    if (p.goleador && p.goleador.trim().toLowerCase() === (j.goleador || '').trim().toLowerCase()) profetaCounts[p.id]++;
                    // Rachas
                    if(p.puntosObtenidos > 0) {
                        rachasPuntuando[p.id].actual++;
                        rachasPuntuando[p.id].max = Math.max(rachasPuntuando[p.id].max, rachasPuntuando[p.id].actual);
                        rachasCenizo[p.id].actual = 0;
                    } else {
                        rachasPuntuando[p.id].actual = 0;
                        rachasCenizo[p.id].actual++;
                        rachasCenizo[p.id].max = Math.max(rachasCenizo[p.id].max, rachasCenizo[p.id].actual);
                    }
                    // Obstinado
                    if (!obstinadoCounts[miResultado]) obstinadoCounts[miResultado] = {};
                    obstinadoCounts[miResultado][p.id] = (obstinadoCounts[miResultado][p.id] || 0) + 1;
                });
            }

            const atrevidoEntry = Object.entries(atrevidoCounts).sort((a,b) => b[1] - a[1])[0];
            newFameStats.atrevido = { jugador: atrevidoEntry[0], valor: `${atrevidoEntry[1]} veces` };

            const regularidadEntry = Object.entries(regularidadCounts).sort((a,b) => b[1] - a[1])[0];
            newFameStats.mr_regularidad = { jugador: regularidadEntry[0], valor: `${regularidadEntry[1]} jornadas` };

            const profetaEntry = Object.entries(profetaCounts).sort((a,b) => b[1] - a[1])[0];
            newFameStats.profeta = { jugador: profetaEntry[0], valor: `${profetaEntry[1]} aciertos` };

            const visionarioEntry = Object.entries(rachasPuntuando).sort((a,b) => b[1].max - a[1].max)[0];
            newFameStats.visionario = { jugador: visionarioEntry[0], valor: `${visionarioEntry[1].max} jornadas` };

            const cenizoEntry = Object.entries(rachasCenizo).sort((a,b) => b[1].max - a[1].max)[0];
            newFameStats.cenizo = { jugador: cenizoEntry[0], valor: `${cenizoEntry[1].max} jornadas` };

            let obstinado = { jugador: null, valor: 0, resultado: '' };
            for(const resultado in obstinadoCounts) {
                for(const jugador in obstinadoCounts[resultado]) {
                    if (obstinadoCounts[resultado][jugador] > obstinado.valor) {
                        obstinado = { jugador, valor: obstinadoCounts[resultado][jugador], resultado };
                    }
                }
            }
            newFameStats.obstinado = { jugador: obstinado.jugador, valor: `${obstinado.valor} veces (${obstinado.resultado})` };

            setFameMessage('Guardando estadísticas...');
            await setDoc(doc(db, "estadisticas", "globales"), newFameStats);
            setFameMessage('¡Paseo de la Fama actualizado con éxito!');

        } catch (error) {
            console.error("Error al calcular estadísticas del Paseo de la Fama:", error);
            setFameMessage(`Error: ${error.message}`);
        } finally {
            setIsFameCalculating(false);
        }
    };


    return (
        <div style={styles.adminJornadaItem}>
            <button onClick={onBack} style={styles.backButton}>&larr; Volver al Panel</button>
            <h3 style={styles.formSectionTitle}>⚙️ Herramientas de Datos</h3>
            <div style={{...styles.recalculatorContainer, textAlign: 'center'}}>
                <h4>Recalcular Clasificación General</h4>
                <p style={{margin: '10px 0', lineHeight: 1.5}}>
                    Recalcula los puntos totales y desglosados para todos los jugadores. Úsalo para corregir datos históricos en la tabla de clasificación.
                </p>
                <button onClick={handleRecalculateAllStats} disabled={isRecalculating} style={{...styles.saveButton, backgroundColor: styles.colors.danger}}>
                    {isRecalculating ? 'Recalculando...' : 'Recalcular Clasificación'}
                </button>
                {message && <p style={{...styles.message, marginTop: '15px'}}>{message}</p>}
            </div>

            <div style={{...styles.recalculatorContainer, textAlign: 'center', marginTop: '20px', borderColor: colors.gold}}>
                <h4>Actualizar Paseo de la Fama</h4>
                <p style={{margin: '10px 0', lineHeight: 1.5}}>
                    Esta herramienta calcula de nuevo todas las estadísticas históricas para el Paseo de la Fama (Rey Midas, Pelotazo, etc.).
                </p>
                <button onClick={handleUpdateFameStats} disabled={isFameCalculating} style={{...styles.saveButton, backgroundColor: colors.gold, color: colors.deepBlue}}>
                    {isFameCalculating ? 'Calculando...' : 'Actualizar Paseo de la Fama'}
                </button>
                {fameMessage && <p style={{...styles.message, marginTop: '15px'}}>{fameMessage}</p>}
            </div>
        </div>
    );
};


const AdminPanelScreen = ({ teamLogos, plantilla, setPlantilla }) => {
    const [jornadas, setJornadas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [adminView, setAdminView] = useState('jornadas');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRange, setFilterRange] = useState(null);

    const fetchJornadas = () => {
        setLoading(true);
        const q = query(collection(db, "jornadas"), orderBy("numeroJornada", "desc"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            setJornadas(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); setLoading(false);
        }, (error) => { console.error("Error al cargar jornadas: ", error); setLoading(false); });
        return unsubscribe;
    };

    useEffect(() => {
        const unsubscribe = fetchJornadas();
        return () => unsubscribe();
    }, []);

    const maxJornada = useMemo(() => {
        if (jornadas.length === 0) return 0;
        return Math.max(...jornadas.map(j => j.numeroJornada || 0).filter(n => n < 99));
    }, [jornadas]);

    const handleFilterClick = (start) => {
        const end = start + 9;
        setFilterRange([start, end]);
    };
    
    const renderAdminContent = () => {
        switch (adminView) {
            case 'jornadas': return (
                <div>
                    <AdminTestJornada />
                    <h3 style={{...styles.title, fontSize: '1.5rem', marginTop: '40px'}}>Gestión de Jornadas</h3>
                    <div style={styles.adminFilterContainer}>
                        <input type="text" placeholder="Buscar por equipo..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value.toLowerCase())} style={styles.adminSearchInput} />
                        <div style={{display: 'flex', gap: '5px'}}>
                            {Array.from({ length: Math.ceil(maxJornada / 10) }).map((_, i) => {
                                const start = i * 10 + 1;
                                const end = start + 9;
                                return <button key={start} onClick={() => handleFilterClick(start)} style={styles.secondaryButton}>{`${start}-${end}`}</button>;
                            })}
                        </div>
                        <button onClick={() => { setFilterRange(null); setSearchTerm(''); }} style={{...styles.secondaryButton, borderColor: colors.danger}}>Limpiar</button>
                    </div>
                    <div style={styles.jornadaList}>{jornadas.map(jornada => (<JornadaAdminItem key={jornada.id} jornada={jornada} plantilla={plantilla} searchTerm={searchTerm} filterRange={filterRange} onForceRecalculate={fetchJornadas} />))}</div>
                </div>
            );
            case 'escudos': return <AdminEscudosManager onBack={() => setAdminView('jornadas')} teamLogos={teamLogos} />;
            case 'plantilla': return <AdminPlantillaManager onBack={() => setAdminView('jornadas')} plantilla={plantilla} setPlantilla={setPlantilla} />;
            case 'porraAnual': return <AdminPorraAnual onBack={() => setAdminView('jornadas')} />;
            case 'usuarios': return <AdminUserManager onBack={() => setAdminView('jornadas')} />;
            case 'notificaciones': return <AdminNotifications onBack={() => setAdminView('jornadas')} />;
            case 'herramientas': return <AdminTools onBack={() => setAdminView('jornadas')} />;
            default: return null;
        }
    };

    if (loading) return <LoadingSkeleton />;

    return (
        <div>
            <h2 style={styles.title} className="app-title">PANEL DE ADMINISTRADOR</h2>
            <div style={styles.adminNav}>
                <button onClick={() => setAdminView('jornadas')} style={styles.adminNavButton}>Jornadas</button>
                <button onClick={() => setAdminView('plantilla')} style={styles.adminNavButton}>Plantilla</button>
                <button onClick={() => setAdminView('escudos')} style={styles.adminNavButton}>Escudos</button>
                <button onClick={() => setAdminView('porraAnual')} style={styles.adminNavButton}>Porra Anual</button>
                <button onClick={() => setAdminView('usuarios')} style={styles.adminNavButton}>Usuarios</button>
                <button onClick={() => setAdminView('notificaciones')} style={styles.adminNavButton}>Notificaciones</button>
                <button onClick={() => setAdminView('herramientas')} style={styles.adminNavButton}>Herramientas</button>
            </div>
            {renderAdminContent()}
        </div>
    );
};

const JornadaDetalleScreen = ({ jornadaId, onBack, teamLogos, userProfiles }) => {
    const [jornada, setJornada] = useState(null); const [pronosticos, setPronosticos] = useState([]); const [loading, setLoading] = useState(true);
    useEffect(() => { setLoading(true); const jornadaRef = doc(db, "jornadas", jornadaId); const unsubJornada = onSnapshot(jornadaRef, (docSnap) => { if (docSnap.exists()) { setJornada({ id: docSnap.id, ...docSnap.data() }); } }); const pronosticosRef = collection(db, "pronosticos", jornadaId, "jugadores"); const unsubPronosticos = onSnapshot(pronosticosRef, (snapshot) => { setPronosticos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); setLoading(false); }); return () => { unsubJornada(); unsubPronosticos(); }; }, [jornadaId]);
    const pronosticosMap = useMemo(() => pronosticos.reduce((acc, p) => { acc[p.id] = p; return acc; }, {}), [pronosticos]);
    if (loading) return <LoadingSkeleton type="table" />;
    const showPronosticos = jornada?.estado === 'Cerrada' || jornada?.estado === 'Finalizada' || jornada?.estado === 'En vivo';
    const isFinalizada = jornada?.estado === 'Finalizada';
    return (<div><button onClick={onBack} style={styles.backButton}>&larr; Volver al Calendario</button>{jornada && (<>
        <h2 style={styles.title} className="app-title">DETALLE {jornada.id === 'jornada_test' ? 'JORNADA DE PRUEBA' : `JORNADA ${jornada.numeroJornada}`}</h2>
        <div style={styles.matchHeader}><TeamDisplay teamLogos={teamLogos} teamName={jornada.equipoLocal} imgStyle={{width: 40, height: 40}} /><h3 style={styles.formSectionTitle}>{jornada.equipoLocal} vs {jornada.equipoVisitante}</h3><TeamDisplay teamLogos={teamLogos} teamName={jornada.equipoVisitante} imgStyle={{width: 40, height: 40}} /></div>
        {isFinalizada && (<p style={styles.finalResult}>Resultado Final: {jornada.resultadoLocal} - {jornada.resultadoVisitante}</p>)}
        {showPronosticos && jornada.ganadores && jornada.ganadores.length > 0 && (<div style={styles.winnerBanner}>🏆 Ganador(es): {jornada.ganadores.join(', ')}</div>)}
        {showPronosticos && jornada.ganadores?.length === 0 && (<div style={styles.boteBanner}>💰 ¡BOTE! Nadie acertó el resultado.</div>)}
        <table style={styles.table}><thead><tr><th style={styles.th}>Jugador</th><th style={styles.th}>Pronóstico</th>{isFinalizada && <th style={styles.th}>Puntos</th>}{isFinalizada && <th style={styles.th}>Pagado</th>}</tr></thead><tbody>{JUGADORES.map((jugadorId) => { const p = pronosticosMap[jugadorId]; const profile = userProfiles[jugadorId] || {}; if (!p) { return (<tr key={jugadorId} style={styles.tr}><td style={styles.td}><PlayerProfileDisplay name={jugadorId} profile={profile} /></td><td colSpan={isFinalizada ? 3 : 1} style={{...styles.td, fontStyle: 'italic', opacity: 0.6, textAlign: 'center' }}>SP</td></tr>); } if (showPronosticos) { const esGanador = jornada.ganadores?.includes(p.id); return (<React.Fragment key={p.id}><tr style={esGanador ? styles.winnerRow : styles.tr}><td style={styles.td}><PlayerProfileDisplay name={p.id} profile={profile} /> {p.jokerActivo && '🃏'}</td><td style={styles.td}>{p.golesLocal}-{p.golesVisitante} ({p.resultado1x2 || 'N/A'}) {p.goleador && `- ${p.goleador}`} {!p.goleador && p.sinGoleador && '- SG'}</td>{isFinalizada && <td style={styles.td}>{p.puntosObtenidos === undefined ? '-' : p.puntosObtenidos}</td>}{isFinalizada && <td style={styles.td}>{p.pagado ? '✅' : '❌'}</td>}</tr>{p.jokerActivo && p.jokerPronosticos?.length > 0 && (<tr style={styles.jokerDetailRow}><td style={styles.td} colSpan={isFinalizada ? 4 : 2}><div style={{paddingLeft: '20px'}}><strong>Apuestas JOKER:</strong><div style={{display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '5px'}}>{p.jokerPronosticos.map((jp, index) => (<span key={index} style={styles.jokerDetailChip}>{jp.golesLocal}-{jp.golesVisitante}</span>))}</div></div></td></tr>)}</React.Fragment>); } else { const secretMessage = SECRET_MESSAGES[JUGADORES.indexOf(jugadorId) % SECRET_MESSAGES.length]; return (<tr key={p.id} style={styles.tr}><td style={styles.td}><PlayerProfileDisplay name={p.id} profile={profile} /> {p.jokerActivo && '🃏'}</td><td style={styles.td}>{secretMessage}</td></tr>); } })}</tbody></table>
        <div style={styles.legendContainer}><span style={styles.legendItem}>SP: Sin Pronóstico</span><span style={styles.legendItem}>🃏: Joker Activado</span>{isFinalizada && <span style={styles.legendItem}>✅: Pagado</span>}{isFinalizada && <span style={styles.legendItem}>❌: Pendiente</span>}</div>
    </>)}</div>);
};

const AdminLoginModal = ({ onClose, onSuccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            await signInWithEmailAndPassword(auth, email, password);
            onSuccess();
        } catch (err) {
            setError('Error: Email o contraseña incorrectos.');
            console.error("Error de login de admin:", err);
        }
    };

    return (
        <div style={styles.modalOverlay}>
            <div style={styles.modalContent}>
                <h3 style={styles.title}>ACCESO ADMIN</h3>
                <form onSubmit={handleSubmit}>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>Email:</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={styles.input} required />
                    </div>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>Contraseña:</label>
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={styles.input} required />
                    </div>
                    {error && <p style={{color: styles.colors.danger, textAlign: 'center'}}>{error}</p>}
                    <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '20px'}}>
                        <button type="button" onClick={onClose} style={{...styles.mainButton, backgroundColor: styles.colors.blue}}>CANCELAR</button>
                        <button type="submit" style={styles.mainButton}>ENTRAR</button>
                    </div>
                </form>
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
  const [resultAnnouncement, setResultAnnouncement] = useState(null); // NUEVO: Para el modal de resultados
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
        @keyframes ticker-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
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
            const jornadaDoc = jornadaSnap.docs[0];
            const jornada = { id: jornadaDoc.id, ...jornadaDoc.data() };
            const viewedResultsKey = `viewed_result_${jornada.id}`;

            if (!sessionStorage.getItem(viewedResultsKey)) {
                const pronosticosSnap = await getDocs(collection(db, "pronosticos", jornada.id, "jugadores"));
                const numParticipantes = pronosticosSnap.size;
                const costeApuesta = jornada.esVip ? APUESTA_VIP : APUESTA_NORMAL;
                const recaudado = numParticipantes * costeApuesta;
                const boteAnterior = jornada.bote || 0;
                
                if (jornada.ganadores && jornada.ganadores.length > 0) {
                    const premioTotal = boteAnterior + recaudado;
                    setResultAnnouncement({
                        winners: jornada.ganadores,
                        prizePerWinner: premioTotal / jornada.ganadores.length,
                    });
                } else {
                     const qProxima = query(collection(db, "jornadas"), where("numeroJornada", "==", jornada.numeroJornada + 1), limit(1));
                     const proximaJornadaSnap = await getDocs(qProxima);
                     let boteAcumulado = 0;
                     if(!proximaJornadaSnap.empty){
                        boteAcumulado = proximaJornadaSnap.docs[0].data().bote || (boteAnterior + recaudado);
                     } else {
                        boteAcumulado = boteAnterior + recaudado;
                     }
                    
                    setResultAnnouncement({
                        boteAmount: boteAcumulado,
                    });
                }
                sessionStorage.setItem(viewedResultsKey, 'true');
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
                case 'fama': return <PaseoDeLaFamaScreen userProfiles={userProfiles} fameStats={fameStats} />;
                case 'admin': return isAdminAuthenticated ? <AdminPanelScreen teamLogos={teamLogos} plantilla={plantilla} setPlantilla={setPlantilla} /> : null;
                default: return null;
            }
        };
      return (<>{showAdminLogin && <AdminLoginModal onClose={() => setShowAdminLogin(false)} onSuccess={handleAdminLoginSuccess} />}{showNotificationModal && <NotificationPermissionModal onAllow={() => handleRequestPermission(currentUser)} onDeny={() => {setShowNotificationModal(false); localStorage.setItem('notificationPrompt_v3_seen', 'true');}} />}{resultAnnouncement && <ResultAnnouncementModal result={resultAnnouncement} onClose={() => setResultAnnouncement(null)} />}{porraAnualConfig?.estado === 'Abierta' && !viewingPorraAnual && (!porraAnualConfig?.fechaCierre || new Date() < porraAnualConfig.fechaCierre.toDate()) && (<div style={styles.porraAnualBanner} onClick={() => setViewingPorraAnual(true)}>⭐ ¡PORRA ANUAL ABIERTA! ⭐ Haz o modifica tu pronóstico. ¡Pincha aquí!</div>)}<LiveBanner liveData={liveJornada?.liveData} jornada={liveJornada} />
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
        <button onClick={() => handleNavClick('fama')} style={activeTab === 'fama' ? styles.navButtonActive : styles.navButton} className={activeTab === 'fama' ? 'nav-button-active' : ''}>🏆 Fama</button>
        <button onClick={() => handleNavClick('pagos')} style={activeTab === 'pagos' ? styles.navButtonActive : styles.navButton} className={activeTab === 'pagos' ? 'nav-button-active' : ''}>Pagos</button>
        {currentUser === 'Juanma' && (<button onClick={handleAdminClick} style={activeTab === 'admin' ? styles.navButtonActive : styles.navButton} className={activeTab === 'admin' ? 'nav-button-active' : ''}>Admin</button>)}
        <button onClick={() => handleNavClick('profile')} style={styles.profileNavButton}><PlayerProfileDisplay name={currentUser} profile={userProfiles[currentUser]} /></button>
        <button onClick={handleLogout} style={styles.logoutButton}>Salir</button>
      </nav>
      <div key={activeTab} className="content-enter-active" style={styles.content}><CurrentScreen /></div></>);
    }
  };
  return (
    <>
      {winnerData && <WinnerAnimation winnerData={winnerData} onClose={() => setWinnerData(null)} />}
      <div id="app-container" className={isVipActive ? 'vip-active' : ''} style={styles.container}>
        <div style={styles.card} id="app-card">
          {renderContent()}
        </div>
      </div>
      {screen === 'app' && <NewsTicker stats={fameStats} userProfiles={userProfiles} />}
    </>
  );
}

export default App;

