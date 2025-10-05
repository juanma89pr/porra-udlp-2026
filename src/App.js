import React, { useState, useEffect, useMemo, useRef } from 'react';
// Importamos las funciones necesarias de Firebase
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
// MODIFICADO: Se añade 'runTransaction' y 'serverTimestamp'
import { getFirestore, collection, doc, getDocs, onSnapshot, query, where, limit, writeBatch, updateDoc, orderBy, setDoc, getDoc, increment, deleteDoc, runTransaction, serverTimestamp, addDoc } from "firebase/firestore";
import { getDatabase, ref, onDisconnect, set } from "firebase/database";

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
const rtdb = getDatabase(app);

// --- CLAVES DE APIs EXTERNAS ---
const API_FOOTBALL_KEY = "8984843ec9df5109e0bc0ddb700f3848";

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

const SECRET_MESSAGES = [
    "Pronóstico Secreto 🤫", "Aquí huele a BOTE...", "Voy a ganar yo 😎", "Top Secret",
    "Clasificado ⭐", "Me lo guardo para mí", "Jugada Maestra en proceso...", "Ni el VAR lo sabe",
    "Consultando con el Oráculo", "Shhh... es un secreto", "Apuesta Fantasma 👻",
    "Resultado 'Confidencial'", "Cargando... 99%", "El que lo sabe, lo sabe", "Mejor no digo nada..."
];

// MODIFICADO: Se añaden propiedades 'style' para las animaciones y se ajustan prioridades
const BADGE_DEFINITIONS = {
    lider_general: { icon: '👑', name: 'Líder General', priority: 1, style: 'leader-glow' },
    campeon_jornada: { icon: '🏆', name: 'Campeón de la Jornada', priority: 2, style: 'champion-glow' },
    pleno_jornada: { icon: '🎯', name: 'Pleno en la Jornada', priority: 3, style: 'pleno-flash' },
    en_racha: { icon: '🔥', name: 'En Racha (3+ jornadas puntuando)', priority: 4, style: 'fire-streak' },
    mala_racha: { icon: '🥶', name: 'Mala Racha (3+ jornadas sin puntuar)', priority: 5, style: 'cold-streak' },
    // NUEVO: Insignias para estadísticas
    mas_monetary: { icon: '💸', name: 'El Monetary', priority: 6, style: 'money-glow' },
    mas_atrevido: { icon: '💣', name: 'El Atrevido', priority: 7 },
    mas_conversador: { icon: '💬', name: 'El Conversador', priority: 8 },
    pelotazo: { icon: '🚀', name: 'El Pelotazo', priority: 9 },
    mas_goleador_acertado: { icon: '⚽', name: 'Olfato de Gol', priority: 10 }
};

const PLANTILLA_ACTUALIZADA = [
    { dorsal: "1", nombre: "Dinko Horkas", imageUrl: "" }, { dorsal: "13", nombre: "José Antonio Caro", imageUrl: "" }, { dorsal: "35", nombre: "Adri Suárez", imageUrl: "" }, { dorsal: "3", nombre: "Mika Mármol", imageUrl: "" }, { dorsal: "15", nombre: "Juanma Herzog", imageUrl: "" }, { dorsal: "4", nombre: "Álex Suárez", imageUrl: "" }, { dorsal: "5", nombre: "Enrique Clemente", imageUrl: "" }, { dorsal: "6", nombre: "Sergio Barcia", imageUrl: "" }, { dorsal: "23", nombre: "Cristian Gutiérrez", imageUrl: "" }, { dorsal: "17", nombre: "Viti Rozada", imageUrl: "" }, { dorsal: "2", nombre: "Marvin Park", imageUrl: "" }, { dorsal: "16", nombre: "Lorenzo Amatucci", imageUrl: "" }, { dorsal: "18", nombre: "Edward Cedeño", imageUrl: "" }, { dorsal: "12", nombre: "Enzo Loiodice", imageUrl: "" }, { dorsal: "20", nombre: "Kirian Rodríguez", imageUrl: "" }, { dorsal: "8", nombre: "Iván Gil", imageUrl: "" }, { dorsal: "21", nombre: "Jonathan Viera", imageUrl: "" }, { dorsal: "9", nombre: "Jeremía Recoba", imageUrl: "" }, { dorsal: "14", nombre: "Manu Fuster", imageUrl: "" }, { dorsal: "10", nombre: "Jesé", imageUrl: "" }, { dorsal: "24", nombre: "Pejiño", imageUrl: "" }, { dorsal: "22", nombre: "Ale García", imageUrl: "" }, { dorsal: "29", nombre: "Adam Arvelo", imageUrl: "" }, { dorsal: "25", nombre: "Milos Lukovic", imageUrl: "" }, { dorsal: "19", nombre: "Sandro Ramírez", imageUrl: "" }, { dorsal: "11", nombre: "Marc Cardona", imageUrl: "" }, { dorsal: "7", nombre: "Jaime Mata", imageUrl: "" }
];

const PROFILE_COLORS = ['#FFC72C', '#0055A4', '#FFFFFF', '#fca311', '#52b788', '#e63946', '#9b59b6', 'linear-gradient(45deg, #FFC72C, #0055A4)', 'linear-gradient(45deg, #e63946, #fca311)', 'linear-gradient(45deg, #52b788, #9b59b6)'];
const PROFILE_ICONS = ['🐥', '🇮🇨', '⚽️', '🥅', '🏆', '🥇', '🎉', '🔥', '💪', '😎', '🎯', '🧠', '⭐', '🐐', '👑', '🎮', '🏎️', '😂', '🤯', '🤔', '🤫', '💸', '💣', '🚀', '👽', '🤖', '👻', '🎱', '🍀', '🏃‍♂️', '🏃🏾‍♂️', '1️⃣', '7️⃣', '🔟', '🤑', '😈'];

// ============================================================================
// --- ESTILOS (CSS-in-JS) ---
// ============================================================================
const colors = {
    deepBlue: '#001d3d', blue: '#0055A4', yellow: '#FFC72C', gold: '#FFD700', silver: '#C0C0C0', bronze: '#CD7F32', lightText: '#f0f0f0', darkText: '#0a0a0a', danger: '#e63946', success: '#52b788', warning: '#fca311', darkUI: 'rgba(10, 25, 47, 0.85)', darkUIAlt: 'rgba(23, 42, 69, 0.85)', status: { 'Próximamente': '#6c757d', 'Pre-apertura': '#fca311', 'Abierta': '#52b788', 'Cerrada': '#e63946', 'Finalizada': '#0055A4' }
};

const styles = {
    // ... (Se mantiene la misma estructura de estilos para no alterar el diseño)
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
    userButton: { position: 'relative', width: '100%', padding: '15px 10px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', border: `2px solid ${colors.blue}`, borderRadius: '8px', backgroundColor: 'transparent', color: colors.lightText, transition: 'all 0.3s ease', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', fontFamily: "'Exo 2', sans-serif", textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', overflow: 'hidden' },
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
    adminControls: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginTop: '15px' },
    adminInput: { width: '90%', padding: '10px', border: `1px solid ${colors.blue}`, borderRadius: '6px', backgroundColor: colors.deepBlue, color: colors.lightText },
    adminSelect: { width: '95%', padding: '10px', border: `1px solid ${colors.blue}`, borderRadius: '6px', backgroundColor: colors.deepBlue, color: colors.lightText },
    saveButton: { padding: '10px 18px', border: 'none', borderRadius: '5px', backgroundColor: colors.success, color: 'white', cursor: 'pointer', textTransform: 'uppercase', fontWeight: 'bold' },
    recalculateButton: { padding: '10px 18px', border: 'none', borderRadius: '5px', backgroundColor: colors.warning, color: colors.deepBlue, cursor: 'pointer', textTransform: 'uppercase', fontWeight: 'bold' },
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
    // NUEVO: Estilos para el carrusel de noticias
    statsCarouselContainer: {
        position: 'fixed',
        bottom: 0,
        left: 0,
        width: '100%',
        backgroundColor: 'rgba(0, 29, 61, 0.9)',
        color: colors.lightText,
        zIndex: 100,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        borderTop: `2px solid ${colors.yellow}`,
        display: 'flex',
        alignItems: 'center',
    },
    statsCarouselTicker: {
        display: 'inline-block',
        padding: '10px 0',
        animation: 'ticker-scroll 40s linear infinite',
    },
    statsCarouselItem: {
        display: 'inline-block',
        padding: '0 25px',
        fontSize: '0.9rem',
        color: colors.silver,
    },
    statsCarouselItemIcon: {
        color: colors.yellow,
        marginRight: '8px',
    },
    // NUEVO: Estilos para el Paseo de los Ganadores
    winnersWalkContainer: {
        padding: '20px 0',
    },
    winnersWalkJornada: {
        backgroundColor: colors.darkUIAlt,
        borderRadius: '12px',
        marginBottom: '20px',
        padding: '20px',
        borderLeft: `5px solid ${colors.blue}`,
        transition: 'all 0.3s ease',
    },
    winnersWalkHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: `1px solid ${colors.blue}`,
        paddingBottom: '15px',
        marginBottom: '15px',
    },
    winnersWalkTitle: {
        margin: 0,
        fontFamily: "'Orbitron', sans-serif",
        fontSize: '1.2rem',
    },
    winnersWalkResult: {
        fontWeight: 'bold',
        fontSize: '1.1rem',
    },
    winnersWalkWinnerList: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '15px',
        justifyContent: 'center',
    },
    winnersWalkWinnerCard: {
        backgroundColor: 'rgba(0,0,0,0.3)',
        padding: '15px',
        borderRadius: '8px',
        textAlign: 'center',
        border: `1px solid ${colors.gold}80`,
        boxShadow: `0 0 10px ${colors.gold}40`,
        width: '150px',
    },
    winnersWalkWinnerName: {
        fontWeight: 'bold',
        fontSize: '1.1rem',
        color: colors.gold,
    },
    winnersWalkWinnerPoints: {
        fontSize: '1rem',
        color: colors.silver,
    },
    statsDashboard: {
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: '12px',
        padding: '20px',
        marginTop: '30px'
    },
    confirmacionResumen: { backgroundColor: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px', borderLeft: `4px solid ${colors.yellow}`, marginBottom: '20px' },
    historyButton: { backgroundColor: 'transparent', border: `1px solid ${colors.blue}`, color: colors.lightText, padding: '4px 8px', borderRadius: '5px', cursor: 'pointer', fontSize: '0.8rem', marginLeft: '10px' },
    historyContainer: { maxHeight: '400px', overflowY: 'auto', paddingRight: '10px' },
    historyEntry: { backgroundColor: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', marginBottom: '10px', borderLeft: `3px solid ${colors.blue}` },
    historyTimestamp: { fontSize: '0.9rem', color: colors.silver, paddingBottom: '8px', borderBottom: `1px solid ${colors.blue}80`, marginBottom: '8px'},
    historyDetails: { fontSize: '0.95rem' },
    settlementCard: { backgroundColor: colors.darkUIAlt, padding: '20px', borderRadius: '12px', marginBottom: '20px', borderLeft: `5px solid ${colors.blue}` },
    settlementHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' },
    settlementTitle: { margin: 0, fontFamily: "'Orbitron', sans-serif" },
    settlementWinner: { textAlign: 'center', padding: '10px', backgroundColor: `${colors.gold}20`, borderRadius: '8px', margin: '15px 0' },
    settlementList: { display: 'flex', flexDirection: 'column', gap: '10px' },
    settlementItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '8px' },
    settlementPaid: { backgroundColor: `${colors.success}20`, borderLeft: `3px solid ${colors.success}` },
    settlementPending: { borderLeft: `3px solid ${colors.warning}` },
    adminJornadaFilter: { display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }
};

// ============================================================================
// --- LÓGICA DE CÁLCULO Y FORMATO ---
// ============================================================================

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

const calculateFinalPoints = (pronostico, resultadoFinal, esVip) => {
    if (!pronostico || !resultadoFinal) return 0;

    let puntos = 0;
    const { golesLocal, golesVisitante, primerGoleador, equipoLocal } = resultadoFinal;
    const pronGolesLocal = parseInt(pronostico.golesLocal);
    const pronGolesVisitante = parseInt(pronostico.golesVisitante);

    // 1. ACIERTO DE RESULTADO EXACTO (3 PUNTOS / 6 VIP)
    const aciertoExacto = pronGolesLocal === golesLocal && pronGolesVisitante === golesVisitante;
    if (aciertoExacto) {
        puntos += esVip ? 6 : 3;
    }

    // 2. ACIERTO DE 1X2 (1 PUNTO / 2 VIP)
    let resultado1x2Real = 'Empate';
    if (golesLocal > golesVisitante) resultado1x2Real = 'Gana Local';
    else if (golesLocal < golesVisitante) resultado1x2Real = 'Gana Visitante';

    let pronostico1x2 = 'Empate';
    if (pronGolesLocal > pronGolesVisitante) pronostico1x2 = 'Gana Local';
    else if (pronGolesLocal < pronGolesVisitante) pronostico1x2 = 'Gana Visitante';
    
    // Convertir a formato 'Gana/Pierde UDLP'
    let resultado1x2UDLP = 'Empate';
    if (equipoLocal === "UD Las Palmas") {
        if (resultado1x2Real === 'Gana Local') resultado1x2UDLP = 'Gana UD Las Palmas';
        else if (resultado1x2Real === 'Gana Visitante') resultado1x2UDLP = 'Pierde UD Las Palmas';
    } else { // UD Las Palmas es visitante
        if (resultado1x2Real === 'Gana Visitante') resultado1x2UDLP = 'Gana UD Las Palmas';
        else if (resultado1x2Real === 'Gana Local') resultado1x2UDLP = 'Pierde UD Las Palmas';
    }

    if (pronostico.resultado1x2 === resultado1x2UDLP) {
        puntos += esVip ? 2 : 1;
    }

    // 3. ACIERTO DE GOLEADOR (2 PUNTOS / 4 VIP) O SIN GOLEADOR (1 PUNTO)
    const goleadorApostado = (pronostico.goleador || '').trim().toLowerCase();
    const goleadorReal = (primerGoleador || '').trim().toLowerCase();

    if (pronostico.sinGoleador && (goleadorReal === "" || goleadorReal === "sg" || goleadorReal === 'sin gol')) {
        puntos += 1; // Sin goleador no es VIP
    } else if (!pronostico.sinGoleador && goleadorApostado !== "" && goleadorApostado === goleadorReal) {
        puntos += esVip ? 4 : 2;
    }

    // 4. ACIERTO DE JOKER (3 PUNTOS / 6 VIP por cada acierto)
    if (pronostico.jokerActivo && pronostico.jokerPronosticos?.length > 0) {
        for (const jokerP of pronostico.jokerPronosticos) {
            if (parseInt(jokerP.golesLocal) === golesLocal && parseInt(jokerP.golesVisitante) === golesVisitante) {
                puntos += esVip ? 6 : 3;
                break; 
            }
        }
    }

    return puntos;
};

const calculateProvisionalPoints = (pronostico, liveData, jornada) => {
    if (!pronostico || !liveData || !jornada || !liveData.isLive) return 0;
    
    const esVip = jornada.esVip || false;
    const resultadoFinal = {
        golesLocal: liveData.golesLocal,
        golesVisitante: liveData.golesVisitante,
        primerGoleador: (liveData.ultimoGoleador || '').trim().toLowerCase(),
        equipoLocal: jornada.equipoLocal,
    };

    return calculateFinalPoints(pronostico, resultadoFinal, esVip);
};

// ==================================================================================
// --- NUEVO: Lógica Centralizada para el Cálculo y Actualización de Insignias ---
// ==================================================================================
const updateAllPlayerBadges = async () => {
    console.log("Iniciando la actualización de todas las insignias de los jugadores.");
    const batch = writeBatch(db);

    try {
        // 1. Obtener todos los datos necesarios
        const qJornadas = query(collection(db, "jornadas"), where("estado", "==", "Finalizada"), orderBy("numeroJornada", "asc"));
        const jornadasSnap = await getDocs(qJornadas);
        const jornadasFinalizadas = jornadasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const qClasificacion = query(collection(db, "clasificacion"), orderBy("totalPuntos", "desc"));
        const clasificacionSnap = await getDocs(qClasificacion);
        const clasificacion = clasificacionSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const allPronosticos = {};
        for (const jornada of jornadasFinalizadas) {
            const pronosticosSnap = await getDocs(collection(db, "pronosticos", jornada.id, "jugadores"));
            allPronosticos[jornada.numeroJornada] = pronosticosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }

        // 2. Procesar cada jugador
        for (const jugador of JUGADORES) {
            const jugadorProfileRef = doc(db, "profiles", jugador);
            let newBadges = [];

            // Insignia: LIDER GENERAL
            if (clasificacion.length > 0 && clasificacion[0].id === jugador && clasificacion[0].totalPuntos > 0) {
                newBadges.push('lider_general');
            }

            // Insignias por jornada (Campeón, Pleno, Rachas)
            let rachaPuntuando = 0;
            let rachaSinPuntuar = 0;
            let maxPuntosRacha = 3; // mínimo de jornadas para considerar una racha

            for (const jornada of jornadasFinalizadas) {
                const pronosticosDeJornada = allPronosticos[jornada.numeroJornada] || [];
                const pronosticoJugador = pronosticosDeJornada.find(p => p.id === jugador);

                // Si el jugador participó en la jornada
                if (pronosticoJugador) {
                    const puntosObtenidos = pronosticoJugador.puntosObtenidos || 0;

                    // Rachas
                    if (puntosObtenidos > 0) {
                        rachaPuntuando++;
                        rachaSinPuntuar = 0;
                    } else {
                        rachaSinPuntuar++;
                        rachaPuntuando = 0;
                    }

                    // Campeón y Pleno (solo para la última jornada finalizada)
                    if (jornada.numeroJornada === jornadasFinalizadas[jornadasFinalizadas.length - 1].numeroJornada) {
                        const maxPuntosJornada = Math.max(...pronosticosDeJornada.map(p => p.puntosObtenidos || 0));
                        if (maxPuntosJornada > 0 && puntosObtenidos === maxPuntosJornada) {
                            newBadges.push('campeon_jornada');
                        }

                        // Pleno: Acertar resultado exacto + goleador
                        const resultadoFinal = { golesLocal: jornada.resultadoLocal, golesVisitante: jornada.resultadoVisitante, primerGoleador: jornada.primerGoleador };
                        const aciertoExacto = parseInt(pronosticoJugador.golesLocal) === resultadoFinal.golesLocal && parseInt(pronosticoJugador.golesVisitante) === resultadoFinal.golesVisitante;
                        const aciertoGoleador = (pronosticoJugador.goleador || '').trim().toLowerCase() === (resultadoFinal.primerGoleador || '').trim().toLowerCase();
                        if (aciertoExacto && aciertoGoleador) {
                            newBadges.push('pleno_jornada');
                        }
                    }
                } else {
                    // Si no participó, se rompen las rachas
                    rachaPuntuando = 0;
                    rachaSinPuntuar = 0;
                }
            }

            if (rachaPuntuando >= maxPuntosRacha) newBadges.push('en_racha');
            if (rachaSinPuntuar >= maxPuntosRacha) newBadges.push('mala_racha');
            
            // 3. Eliminar duplicados y actualizar perfil en el batch
            const finalBadges = [...new Set(newBadges)];
            batch.update(jugadorProfileRef, { badges: finalBadges });
        }

        // 4. Ejecutar todas las actualizaciones
        await batch.commit();
        console.log("¡Todas las insignias han sido actualizadas correctamente!");
        return true; // Indicar éxito
    } catch (error) {
        console.error("Error masivo al actualizar insignias:", error);
        return false; // Indicar fallo
    }
};

// ============================================================================
// --- COMPONENTES REUTILIZABLES Y DE ANIMACIÓN ---
// ============================================================================
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
            .filter(b => b && b.name && b.icon) 
            .sort((a, b) => a.priority - b.priority);
    }, [finalProfile.badges]);
    
    const badgeAnimation = useMemo(() => {
        if (!finalProfile.badges || finalProfile.badges.length === 0) return { style: {}, particles: null };
        const highestPriorityBadgeWithStyle = finalProfile.badges
            .map(badgeKey => ({ key: badgeKey, ...BADGE_DEFINITIONS[badgeKey] }))
            .filter(b => b && b.name && b.style)
            .sort((a, b) => a.priority - b.priority)[0];
        
        if (highestPriorityBadgeWithStyle) {
            const animationName = `${highestPriorityBadgeWithStyle.style}-animation`;
            let animationProps = '2s infinite alternate';
            let particles = null;

            if(highestPriorityBadgeWithStyle.style === 'pleno-flash') {
                animationProps = '0.5s ease-in-out 3';
            }
            if(highestPriorityBadgeWithStyle.style === 'cold-streak'){
                particles = <div className="snow-animation"> {Array.from({length: 10}).map((_, i) => <div key={i} className="snowflake"></div>)} </div>;
            }
            if(highestPriorityBadgeWithStyle.style === 'fire-streak'){
                particles = <div className="ember-animation"> {Array.from({length: 10}).map((_, i) => <div key={i} className="ember"></div>)} </div>;
            }
            if(highestPriorityBadgeWithStyle.style === 'money-glow'){
                particles = <div className="money-animation"> {Array.from({length: 10}).map((_, i) => <div key={i} className="money-particle">💸</div>)} </div>;
            }
            return { style: { animation: `${animationName} ${animationProps}` }, particles };
        }
        return { style: {}, particles: null };
    }, [finalProfile.badges]);


    return (
        <span style={{...customStyle, display: 'inline-flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
            {badgeAnimation.particles}
            {badgesToDisplay.map(badge => (
                <span key={badge.key} title={badge.name} style={badgeAnimation.style}>{badge.icon}</span>
            ))}
            {icon && <span>{icon}</span>}
            <span style={nameStyle}>{name}</span>
        </span>
    );
};

const LiveBanner = ({ liveData, jornada }) => {
    if (!jornada || !liveData || !liveData.isLive || jornada.estado !== 'Cerrada') return null;
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

const LoadingSkeleton = ({ type = 'list' }) => {
    if (type === 'table') { return (<div style={styles.skeletonTable}>{Array.from({ length: 5 }).map((_, i) => (<div key={i} style={styles.skeletonRow}><div style={{...styles.skeletonBox, width: '50px', height: '20px'}}></div><div style={{...styles.skeletonBox, width: '120px', height: '20px'}}></div><div style={{...styles.skeletonBox, width: '80px', height: '20px'}}></div><div style={{...styles.skeletonBox, width: '60px', height: '20px'}}></div></div>))}</div>); }
    if (type === 'splash') { return (<div style={styles.skeletonContainer}><div style={{...styles.skeletonBox, height: '40px', width: '80%', marginBottom: '20px'}}></div><div style={{...styles.skeletonBox, height: '150px', width: '100%'}}></div><div style={{...styles.skeletonBox, height: '60px', width: '90%', marginTop: '10px'}}></div></div>); }
    return (<div style={styles.skeletonContainer}><div style={{...styles.skeletonBox, height: '40px', width: '80%', marginBottom: '20px'}}></div><div style={{...styles.skeletonBox, height: '20px', width: '60%'}}></div><div style={{...styles.skeletonBox, height: '20px', width: '70%', marginTop: '10px'}}></div></div>);
};

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


// ============================================================================
// --- COMPONENTES DE LAS PANTALLAS ---
// ============================================================================

const InitialSplashScreen = ({ onFinish }) => {
    const [fadingOut, setFadingOut] = useState(false);
    useEffect(() => { const timer = setTimeout(() => { setFadingOut(true); setTimeout(onFinish, 500); }, 2500); return () => clearTimeout(timer); }, [onFinish]);
    return (<div style={fadingOut ? {...styles.initialSplashContainer, ...styles.fadeOut} : styles.initialSplashContainer}><img src="https://upload.wikimedia.org/wikipedia/en/thumb/2/20/UD_Las_Palmas_logo.svg/1200px-UD_Las_Palmas_logo.svg.png" alt="UD Las Palmas Logo" style={styles.splashLogo} /><div style={styles.splashTitleContainer}><span style={styles.splashTitle}>PORRA UDLP</span><span style={styles.splashYear}>2026</span></div><div style={styles.loadingMessage}><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="spinner"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg><p>Cargando datos...</p></div></div>);
};

const SplashScreen = ({ onEnter, teamLogos, plantilla }) => {
    const [jornadaInfo, setJornadaInfo] = useState(null);
    const [countdown, setCountdown] = useState('');
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        setLoading(true);
        const qJornadas = query(collection(db, "jornadas"), orderBy("numeroJornada"));
        const unsubscribe = onSnapshot(qJornadas, (snap) => {
            const ahora = new Date();
            const todasLasJornadas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            let jornadaActiva = todasLasJornadas.find(j => ['Abierta', 'Pre-apertura', 'Cerrada'].includes(j.estado));

            if (!jornadaActiva) {
                const ultimasFinalizadas = todasLasJornadas.filter(j => j.estado === 'Finalizada').sort((a,b) => b.numeroJornada - a.numeroJornada);
                if (ultimasFinalizadas.length > 0) { setJornadaInfo({ ...ultimasFinalizadas[0], type: 'finalizada' }); }
                else {
                    const proximas = todasLasJornadas.filter(j => j.estado === 'Próximamente').sort((a,b) => a.numeroJornada - b.numeroJornada);
                    if (proximas.length > 0) setJornadaInfo({ ...proximas[0], type: 'proxima' });
                    else setJornadaInfo(null);
                }
            } else {
                 setJornadaInfo({ ...jornadaActiva, type: jornadaActiva.estado.toLowerCase() });
            }
            setLoading(false);
        }, (error) => { console.error("Error fetching jornada: ", error); setLoading(false); });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!jornadaInfo) return;
        const targetDate = (jornadaInfo.type === 'abierta') ? jornadaInfo.fechaCierre?.toDate() : (jornadaInfo.type === 'proxima' || jornadaInfo.type === 'pre-apertura' ? jornadaInfo.fechaApertura?.toDate() : null);
        if (!targetDate) { setCountdown(''); return; }

        const interval = setInterval(() => {
            const diff = targetDate - new Date();
            if (diff <= 0) {
                let message = "¡PARTIDO EN JUEGO!";
                if (jornadaInfo.type === 'abierta') message = "¡APUESTAS CERRADAS!";
                if (jornadaInfo.type === 'proxima' || jornadaInfo.type === 'pre-apertura') message = "¡APUESTAS ABIERTAS!";
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

    const renderJornadaInfo = () => {
        if (!jornadaInfo) return (<div style={styles.splashInfoBox}><h3 style={styles.splashInfoTitle}>TEMPORADA EN PAUSA</h3><p>El administrador aún no ha configurado la próxima jornada.</p></div>);
        
        const fechaMostrada = jornadaInfo.fechaPartido || jornadaInfo.fechaCierre;
        let infoContent;
        switch (jornadaInfo.type) {
            case 'abierta': infoContent = (<><h3 style={styles.splashInfoTitle}>¡APUESTAS ABIERTAS!</h3><p style={styles.splashMatch}>{jornadaInfo.equipoLocal} <span style={{color: styles.colors.yellow}}>vs</span> {jornadaInfo.equipoVisitante}</p><p style={{margin: '10px 0'}}>🗓️ {formatFullDateTime(fechaMostrada)}</p><div style={styles.countdownContainer}><p>CIERRE DE APUESTAS</p><div style={styles.countdown}>{countdown}</div></div></>); break;
            case 'pre-apertura': infoContent = (<><h3 style={styles.splashInfoTitle}>PRÓXIMA JORNADA</h3><p style={styles.splashMatch}>{jornadaInfo.equipoLocal} <span style={{color: styles.colors.yellow}}>vs</span> {jornadaInfo.equipoVisitante}</p><p style={{margin: '10px 0'}}>🗓️ {formatFullDateTime(fechaMostrada)}</p>{jornadaInfo.bote > 0 && <p style={styles.splashBote}>¡BOTE DE {jornadaInfo.bote}€ EN JUEGO!</p>}{countdown && <div style={styles.countdownContainer}><p>LA APERTURA COMIENZA EN</p><div style={styles.countdown}>{countdown}</div></div>}</>); break;
            case 'proxima': infoContent = (<><h3 style={styles.splashInfoTitle}>PRÓXIMA JORNADA</h3><p style={styles.splashMatch}>{jornadaInfo.equipoLocal} <span style={{color: styles.colors.yellow}}>vs</span> {jornadaInfo.equipoVisitante}</p><p style={{margin: '10px 0'}}>🗓️ {formatFullDateTime(fechaMostrada)}</p>{jornadaInfo.bote > 0 && <p style={styles.splashBote}>¡BOTE DE {jornadaInfo.bote}€ EN JUEGO!</p>}{countdown && <div style={styles.countdownContainer}><p>LA APERTURA COMIENZA EN</p><div style={styles.countdown}>{countdown}</div></div>}</>); break;
            case 'cerrada': infoContent = (<><h3 style={styles.splashInfoTitle}>¡APUESTAS CERRADAS!</h3><p style={styles.splashMatch}>{jornadaInfo.equipoLocal} <span style={{color: styles.colors.yellow}}>vs</span> {jornadaInfo.equipoVisitante}</p><p style={{margin: '10px 0'}}>🗓️ {formatFullDateTime(fechaMostrada)}</p><p>Esperando el resultado del partido...</p></>); break;
            case 'finalizada': infoContent = (<><h3 style={styles.splashInfoTitle}>ÚLTIMA JORNADA FINALIZADA</h3><p style={styles.splashMatch}>{jornadaInfo.equipoLocal} <span style={{color: styles.colors.yellow}}>vs</span> {jornadaInfo.equipoVisitante}</p><p style={styles.finalResult}>Resultado: {jornadaInfo.resultadoLocal} - {jornadaInfo.resultadoVisitante}</p></>); break;
            default: infoContent = null;
        }
        
        return (<div style={styles.splashInfoBox}>{infoContent}{jornadaInfo.splashMessage && <p style={styles.splashAdminMessage}>"{jornadaInfo.splashMessage}"</p>}</div>);
    };

    return (<>
        <div style={styles.splashContainer}>
            <div style={styles.splashLogoContainer}><img src="https://upload.wikimedia.org/wikipedia/en/thumb/2/20/UD_Las_Palmas_logo.svg/1200px-UD_Las_Palmas_logo.svg.png" alt="UD Las Palmas Logo" style={styles.splashLogo} /><div style={styles.splashTitleContainer}><span style={styles.splashTitle}>PORRA UDLP</span><span style={styles.splashYear}>2026</span></div></div>
            {loading ? <LoadingSkeleton type="splash" /> : renderJornadaInfo()}
            <button onClick={onEnter} style={styles.mainButton}>ENTRAR</button>
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
        const onlineJugadores = JUGADORES.filter(j => onlineUsers[j]);
        const recentAndNotOnline = recentUsers.filter(j => !onlineUsers[j]);
        const remaining = JUGADORES.filter(j => !onlineUsers[j] && !recentUsers.includes(j));
        
        return [...onlineJugadores, ...recentAndNotOnline, ...remaining];
    }, [recentUsers, onlineUsers]);

    const getBadgeAnimation = (profile) => {
        if (!profile?.badges?.length) return { style: {}, particles: null };
        const highestPriorityBadge = profile.badges
            .map(key => ({ key, ...BADGE_DEFINITIONS[key] }))
            .filter(b => b && b.name && b.style)
            .sort((a, b) => a.priority - b.priority)[0];
        
        if (highestPriorityBadge) {
            if(highestPriorityBadge.style === 'cold-streak'){
                return { style: {}, particles: <div className="snow-animation"> {Array.from({length: 10}).map((_, i) => <div key={i} className="snowflake"></div>)} </div> };
            }
            if(highestPriorityBadge.style === 'fire-streak'){
                 return { style: {}, particles: <div className="ember-animation"> {Array.from({length: 10}).map((_, i) => <div key={i} className="ember"></div>)} </div> };
            }
        }
        return { style: {}, particles: null };
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
                    const { particles } = getBadgeAnimation(profile);
                    const buttonStyle = { ...styles.userButton, ...(hoveredUser === jugador && styles.userButtonHover), ...(isOnline && styles.userButtonOnline) };
                    const circleStyle = { ...styles.loginProfileIconCircle, ...(isGradient ? { background: profile.color } : { backgroundColor: profile.color || styles.colors.blue }) };

                    return (
                        <button key={jugador} onClick={() => handleSelectUser(jugador)} style={buttonStyle} onMouseEnter={() => setHoveredUser(jugador)} onMouseLeave={() => setHoveredUser(null)}>
                            {particles}
                            {isRecent && !isOnline && <div style={styles.recentUserIndicator}>★</div>}
                            <div style={circleStyle}>{profile.icon || '?'}</div>
                            <div style={styles.loginUserInfo}>
                                <PlayerProfileDisplay name={jugador} profile={profile} />
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

// ... (El resto de la primera mitad de componentes, MiJornadaScreen, LaJornadaScreen, etc., se incluirían aquí sin cambios significativos en su estructura inicial, pero ya es mucho código para una sola parte)

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
    const initialJokerStatus = useRef(false);
    const userProfile = userProfiles[user] || {};

    useEffect(() => {
        setLoading(true);
        const userJokerRef = doc(db, "clasificacion", user);
        getDoc(userJokerRef).then(docSnap => { setJokersRestantes(docSnap.exists() && docSnap.data().jokersRestantes !== undefined ? docSnap.data().jokersRestantes : 2); });

        const qJornadas = query(collection(db, "jornadas"), orderBy("numeroJornada"));
        const unsubscribe = onSnapshot(qJornadas, (snap) => {
            const ahora = new Date();
            const todasLasJornadas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            let jornadaActiva = todasLasJornadas.find(j => ['Abierta', 'Pre-apertura', 'Cerrada'].includes(j.estado));
            
            if (!jornadaActiva) {
                const finalizadas = todasLasJornadas
                    .filter(j => j.estado === 'Finalizada')
                    .sort((a, b) => b.numeroJornada - a.numeroJornada);
                if (finalizadas.length > 0) {
                    jornadaActiva = finalizadas[0];
                }
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
                setCurrentJornada(null);
                setLoading(false);
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
    
    useEffect(() => {
        if (currentJornada?.estado === 'Cerrada' && liveData?.isLive && allPronosticos.length > 0) {
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
        const userJokerRef = doc(db, "clasificacion", user);
        
        const jokerJustActivated = pronostico.jokerActivo && !initialJokerStatus.current;
        const cleanJokerPronosticos = pronostico.jokerPronosticos.filter(p => p.golesLocal !== '' || p.golesVisitante !== '');
        
        try {
            const batch = writeBatch(db);
            const { pinConfirm, ...pronosticoToSave } = pronostico;
            
            batch.set(pronosticoRef, { ...pronosticoToSave, jokerPronosticos: cleanJokerPronosticos, lastUpdated: serverTimestamp() });
            
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
            <div style={{backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '15px', margin: '20px 0'}}>
                <h4 style={{color: colors.yellow, textAlign: 'center', marginBottom: '10px'}}>Tu Apuesta Realizada</h4>
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
                    <h3 style={styles.formSectionTitle}>{currentJornada.id === 'jornada_test' ? 'Jornada de Prueba' : `Jornada ${currentJornada.numeroJornada}`}: {currentJornada.equipoLocal} vs {currentJornada.equipoVisitante}</h3>
                    
                    {!hasSubmitted && <button type="button" onClick={handleCopyLastBet} style={styles.secondaryButton}>Copiar mi última apuesta</button>}

                    {hasSubmitted && isLocked ? (
                        <div style={styles.placeholder}><h3>¡Pronóstico guardado y secreto!</h3><p>Tu apuesta está protegida con PIN. Podrás ver los pronósticos de todos cuando la jornada se cierre.</p><div style={{marginTop: '20px'}}><input type="password" maxLength="4" value={pinInput} onChange={(e) => setPinInput(e.target.value)} style={styles.input} placeholder="PIN de 4 dígitos" /><button type="button" onClick={handleUnlock} style={styles.mainButton}>Desbloquear</button></div></div>
                    ) : hasSubmitted && !isLocked ? (
                         <div style={styles.placeholder}><h3>¡Pronóstico guardado!</h3><p>Tu apuesta no está protegida con PIN. Cualquiera podría modificarla si accede con tu perfil. Puedes añadir un PIN y volver a guardar.</p><button type="button" onClick={() => { setIsLocked(false); setHasSubmitted(false); }} style={styles.mainButton}>Modificar Apuesta</button></div>
                    ) : (
                        <fieldset disabled={currentJornada?.estado === 'Pre-apertura'} style={{border: 'none', padding: 0, margin: 0}}>
                            <fieldset style={{border: 'none', padding: 0, margin: 0}} >
                                <div style={styles.formGroup}><label style={styles.label}>RESULTADO EXACTO <span style={styles.pointsReminder}>( {isVip ? '6' : '3'} Puntos )</span></label><div style={styles.miJornadaMatchInfo}><TeamDisplay teamLogos={teamLogos} teamName={currentJornada.equipoLocal} shortName={true} imgStyle={styles.miJornadaTeamLogo} /><div style={styles.miJornadaScoreInputs}><input type="tel" inputMode="numeric" pattern="[0-9]*" name="golesLocal" value={pronostico.golesLocal} onChange={handlePronosticoChange} style={styles.resultInput} /><span style={styles.separator}>-</span><input type="tel" inputMode="numeric" pattern="[0-9]*" name="golesVisitante" value={pronostico.golesVisitante} onChange={handlePronosticoChange} style={styles.resultInput} /></div><TeamDisplay teamLogos={teamLogos} teamName={currentJornada.equipoVisitante} shortName={true} imgStyle={styles.miJornadaTeamLogo} /></div>{(pronostico.golesLocal !== '' && pronostico.golesVisitante !== '') && <small key={stats.count} style={{...styles.statsIndicator, color: stats.color}}>{stats.count > 0 ? `Otros ${stats.count} jugador(es) han pronosticado este resultado.` : '¡Eres el único con este resultado por ahora!'}</small>}</div>
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
                                        <h3 style={styles.formSectionTitle}>Apuestas JOKER (10 Resultados Extra)</h3>
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


        if (currentJornada?.estado === 'Cerrada' || currentJornada?.estado === 'Finalizada') {
            return (
                <div style={styles.placeholder}>
                    <h3>Jornada {currentJornada.numeroJornada} {currentJornada.estado}</h3>
                    <p>
                        {currentJornada.estado === 'Cerrada' ? 'Las apuestas para este partido han finalizado.' : 'Esta jornada ha concluido.'}
                    </p>
                    
                    <RenderedPronostico pronosticoData={pronostico} />
                    
                    <button onClick={() => setActiveTab('laJornada')} style={styles.mainButton}>
                        Ver Resumen
                    </button>
                    {message.text && <p style={{...styles.message, marginTop: '15px'}}>{message.text}</p>}
                </div>
            );
        }

        if (interJornadaStatus?.status === 'pagado') return <div style={styles.placeholder}><h3>Estado de Pagos</h3><p style={{...styles.paymentStatus, color: styles.colors.success, borderColor: styles.colors.success}}>✅ Estás al día con tus pagos. ¡Gracias!</p></div>;
        if (interJornadaStatus?.status === 'debe') return <div style={styles.placeholder}><h3>Estado de Pagos</h3><p style={{...styles.paymentStatus, color: styles.colors.warning, borderColor: styles.colors.warning}}>⚠️ Tienes pendiente el pago de la Jornada {interJornadaStatus.jornada.numeroJornada}.</p><button onClick={() => setActiveTab('pagos')} style={{...styles.mainButton, backgroundColor: styles.colors.blue}}>Ir a Pagos</button></div>;
        if (interJornadaStatus?.status === 'no_participo') return <div style={styles.placeholder}><h3>No hay jornadas disponibles</h3><p>No participaste en la última jornada. ¡Esperamos verte en la siguiente!</p></div>;
        if (interJornadaStatus?.status === 'sin_finalizadas') return <div style={styles.placeholder}><h3>¡Comienza la temporada!</h3><p>Aún no ha finalizado ninguna jornada.</p></div>;
        return <div style={styles.placeholder}><h3>No hay jornadas disponibles.</h3><p>El administrador añadirá nuevas jornadas próximamente.</p></div>;
    };
    return (
      <div>
        {showJokerAnimation && <JokerAnimation />}
        {showConfirmacionModal && <ConfirmacionPronosticoModal pronostico={pronosticoParaConfirmar} onConfirm={handleGuardarPronostico} onCancel={() => setShowConfirmacionModal(false)} />}
        {tieneDeuda && !interJornadaStatus && (<div style={styles.debtBanner}>⚠️ Tienes pendiente el pago de la jornada anterior. Por favor, ve a la sección de "Pagos" para regularizarlo.</div>)}
        <h2 style={styles.title}>MI JORNADA</h2>
        <p style={{color: styles.colors.lightText, textAlign: 'center', fontSize: '1.1rem'}}>Bienvenido, <PlayerProfileDisplay name={user} profile={userProfile} defaultColor={styles.colors.yellow} style={{fontWeight: 'bold'}} /></p>
        
        {liveData?.isLive && currentJornada?.estado === 'Cerrada' && (<div style={styles.liveInfoBox}><div style={styles.liveInfoItem}><span style={styles.liveInfoLabel}>Puntos Provisionales</span><span style={styles.liveInfoValue}><AnimatedPoints value={provisionalData.puntos} /></span></div><div style={styles.liveInfoItem}><span style={styles.liveInfoLabel}>Posición Provisional</span><span style={styles.liveInfoValue}>{provisionalData.posicion}</span></div></div>)}
        {renderContent()}
      </div>
    );
};
// --- CONTINUACIÓN DE App.js ---

// ... (Aquí iría todo el código de la Parte 1)

// ============================================================================
// --- PANTALLAS (Continuación) ---
// ============================================================================

// MODIFICADO: LaJornadaScreen para mostrar resumen de ganadores al finalizar
const LaJornadaScreen = ({ teamLogos, liveData, userProfiles }) => {
    const [jornada, setJornada] = useState(null);
    const [pronosticos, setPronosticos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showWinnerAnimation, setShowWinnerAnimation] = useState(false);
    const [winnerData, setWinnerData] = useState(null);
    const [liveWinnerInfo, setLiveWinnerInfo] = useState({ current: null, simulations: {} });

    useEffect(() => {
        const qJornadas = query(collection(db, "jornadas"), orderBy("numeroJornada", "desc"));
        const unsubscribe = onSnapshot(qJornadas, (snap) => {
            const todas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const jornadaActual = todas.find(j => ['Abierta', 'Cerrada', 'Finalizada', 'Pre-apertura'].includes(j.estado));
            
            if (jornadaActual) {
                setJornada(jornadaActual);
                const pronosticosRef = collection(db, "pronosticos", jornadaActual.id, "jugadores");
                onSnapshot(pronosticosRef, (pronosticosSnap) => {
                    const pronosticosData = pronosticosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    pronosticosData.sort((a, b) => (b.puntosObtenidos || 0) - (a.puntosObtenidos || 0) || a.id.localeCompare(b.id));
                    setPronosticos(pronosticosData);
                    setLoading(false);

                    if (jornadaActual.estado === 'Finalizada' && !localStorage.getItem(`winner_anim_${jornadaActual.id}`)) {
                        const maxPuntos = Math.max(...pronosticosData.map(p => p.puntosObtenidos || 0));
                        if (maxPuntos > 0) {
                            const ganadoresPorra = pronosticosData.filter(p => {
                                const resultadoFinal = { golesLocal: jornadaActual.resultadoLocal, golesVisitante: jornadaActual.resultadoVisitante };
                                return parseInt(p.golesLocal) === resultadoFinal.golesLocal && parseInt(p.golesVisitante) === resultadoFinal.golesVisitante;
                            });
                             if (ganadoresPorra.length > 0) { // Si hay ganador de porra (resultado exacto)
                                const premio = ((pronosticosData.length * (jornadaActual.esVip ? APUESTA_VIP : APUESTA_NORMAL)) + (jornadaActual.bote || 0)) / ganadoresPorra.length;
                                setWinnerData({ pronostico: ganadoresPorra[0], prize: premio, count: ganadoresPorra.length });
                                setShowWinnerAnimation(true);
                                localStorage.setItem(`winner_anim_${jornadaActual.id}`, 'shown');
                            }
                        }
                    }
                });
            } else {
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (jornada?.estado === 'Cerrada' && liveData?.isLive && pronosticos.length > 0) {
            const rankingActual = pronosticos
                .map(p => ({ ...p, puntos: calculateProvisionalPoints(p, liveData, jornada) }))
                .sort((a, b) => b.puntos - a.puntos);
            
            const ganadorActual = rankingActual[0].puntos > 0 ? rankingActual[0] : null;

            const liveDataLocalGoal = { ...liveData, golesLocal: liveData.golesLocal + 1 };
            const rankingLocalGoal = pronosticos
                .map(p => ({ id: p.id, puntos: calculateProvisionalPoints(p, liveDataLocalGoal, jornada) }))
                .sort((a, b) => b.puntos - a.puntos);
            const ganadorLocalGoal = rankingLocalGoal[0].puntos > 0 ? rankingLocalGoal[0] : null;

            const liveDataVisitorGoal = { ...liveData, golesVisitante: liveData.golesVisitante + 1 };
            const rankingVisitorGoal = pronosticos
                .map(p => ({ id: p.id, puntos: calculateProvisionalPoints(p, liveDataVisitorGoal, jornada) }))
                .sort((a, b) => b.puntos - a.puntos);
            const ganadorVisitorGoal = rankingVisitorGoal[0].puntos > 0 ? rankingVisitorGoal[0] : null;

            setLiveWinnerInfo({
                current: ganadorActual,
                simulations: {
                    localGoal: ganadorLocalGoal,
                    visitorGoal: ganadorVisitorGoal,
                }
            });
        }
    }, [jornada, liveData, pronosticos]);

    if (loading) return <LoadingSkeleton />;
    if (!jornada) return <div style={styles.placeholder}>No hay información de jornada disponible.</div>;

    const isJornadaSecreta = jornada.estado === 'Abierta' || jornada.estado === 'Pre-apertura' || (jornada.estado === 'Cerrada' && !liveData?.isLive);
    
    // NUEVO: Lógica para determinar ganadores de la porra (resultado exacto) y del bote
    const ganadoresPorra = jornada.estado === 'Finalizada' ? pronosticos.filter(p => {
        return parseInt(p.golesLocal) === jornada.resultadoLocal && parseInt(p.golesVisitante) === jornada.resultadoVisitante;
    }) : [];
    
    const ganadoresPuntos = jornada.estado === 'Finalizada' && ganadoresPorra.length === 0 ? pronosticos.filter(p => p.puntosObtenidos === Math.max(...pronosticos.map(pr => pr.puntosObtenidos || 0))) : [];


    return (
        <div style={styles.laJornadaContainer}>
             {showWinnerAnimation && winnerData && <WinnerAnimation winnerData={winnerData} onClose={() => setShowWinnerAnimation(false)} />}
            <h2 style={styles.title}>RESUMEN JORNADA {jornada.numeroJornada}</h2>
            <div style={styles.matchHeader}>
                <TeamDisplay teamLogos={teamLogos} teamName={jornada.equipoLocal} />
                <div style={{textAlign: 'center'}}>
                    <span style={styles.liveScoreInPage}>{jornada.estado === 'Finalizada' ? jornada.resultadoLocal : (liveData?.isLive ? liveData.golesLocal : '?')} - {jornada.estado === 'Finalizada' ? jornada.resultadoVisitante : (liveData?.isLive ? liveData.golesVisitante : '?')}</span>
                    <div style={{...styles.statusBadge, backgroundColor: styles.colors.status[jornada.estado], margin: '10px auto'}}>{jornada.estado}</div>
                </div>
                <TeamDisplay teamLogos={teamLogos} teamName={jornada.equipoVisitante} />
            </div>

            {jornada.estado === 'Finalizada' && jornada.primerGoleador && <p><strong>Primer Goleador:</strong> {jornada.primerGoleador}</p>}

            {/* NUEVO: Banner de ganadores mejorado */}
            {jornada.estado === 'Finalizada' && (
                <>
                    {ganadoresPorra.length > 0 && (
                        <div style={styles.winnerBanner}>
                            🏆 Ganador(es) de la Porra: {ganadoresPorra.map(g => <PlayerProfileDisplay key={g.id} name={g.id} profile={userProfiles[g.id]} />).reduce((prev, curr) => [prev, ', ', curr])}
                        </div>
                    )}
                    {ganadoresPorra.length === 0 && ganadoresPuntos.length > 0 && (
                        <div style={{...styles.winnerBanner, backgroundColor: colors.silver}}>
                            🏅 Ganador(es) por Puntos: {ganadoresPuntos.map(g => <PlayerProfileDisplay key={g.id} name={g.id} profile={userProfiles[g.id]} />).reduce((prev, curr) => [prev, ', ', curr])}
                        </div>
                    )}
                     {ganadoresPorra.length === 0 && ganadoresPuntos.length > 0 && pronosticos.every(p => p.puntosObtenidos === 0) && (
                        <div style={styles.boteBanner}>
                            ¡BOTE! Nadie ha puntuado.
                        </div>
                    )}
                </>
            )}
            
            {liveData?.isLive && jornada.estado === 'Cerrada' && liveWinnerInfo.current && (
                 <div style={{...styles.winnerBanner, backgroundColor: 'rgba(0,0,0,0.3)', border: `1px solid ${colors.blue}`}}>
                     <div style={{paddingBottom: '15px', borderBottom: `1px dashed ${colors.blue}`, marginBottom: '15px'}}>
                         <span style={{display: 'block', textTransform: 'uppercase', color: colors.silver, fontSize: '0.9rem'}}>Ganador Provisional (Puntos)</span>
                         <span style={{fontFamily: "'Orbitron', sans-serif", fontSize: '1.5rem'}}><PlayerProfileDisplay name={liveWinnerInfo.current.id} profile={userProfiles[liveWinnerInfo.current.id]} /></span>
                     </div>
                     <div style={{display: 'flex', justifyContent: 'space-around', gap: '15px'}}>
                         <div style={{textAlign: 'center'}}><span style={{display: 'block', textTransform: 'uppercase', color: colors.silver, fontSize: '0.8rem'}}>Si marca {jornada.equipoLocal}</span><span style={{fontFamily: "'Orbitron', sans-serif", fontSize: '1.2rem'}}>{liveWinnerInfo.simulations.localGoal ? <PlayerProfileDisplay name={liveWinnerInfo.simulations.localGoal.id} profile={userProfiles[liveWinnerInfo.simulations.localGoal.id]} /> : 'Bote'}</span></div>
                         <div style={{textAlign: 'center'}}><span style={{display: 'block', textTransform: 'uppercase', color: colors.silver, fontSize: '0.8rem'}}>Si marca {jornada.equipoVisitante}</span><span style={{fontFamily: "'Orbitron', sans-serif", fontSize: '1.2rem'}}>{liveWinnerInfo.simulations.visitorGoal ? <PlayerProfileDisplay name={liveWinnerInfo.simulations.visitorGoal.id} profile={userProfiles[liveWinnerInfo.simulations.visitorGoal.id]} /> : 'Bote'}</span></div>
                     </div>
                 </div>
            )}
            
            <div style={styles.resumenContainer}>
                {pronosticos.map(p => (
                    <div key={p.id} style={{...styles.resumenJugador, borderLeftColor: ganadoresPorra.some(g => g.id === p.id) ? colors.gold : (p.puntosObtenidos > 0 ? colors.success : colors.blue)}}>
                        <h4 style={styles.resumenJugadorTitle}>
                            <PlayerProfileDisplay name={p.id} profile={userProfiles[p.id]} />
                            {jornada.estado === 'Finalizada' && <span><AnimatedCount endValue={p.puntosObtenidos || 0} /> Pts</span>}
                        </h4>
                        <div style={styles.resumenJugadorBets}>
                            {isJornadaSecreta ? <p>{SECRET_MESSAGES[Math.floor(Math.random() * SECRET_MESSAGES.length)]}</p> : (
                                <>
                                    <p><strong>Resultado:</strong> {p.golesLocal}-{p.golesVisitante}</p>
                                    <p><strong>Goleador:</strong> {p.sinGoleador ? 'Sin Goleador' : (p.goleador || 'N/A')}</p>
                                    {p.jokerActivo && (
                                        <div style={{marginTop: '10px'}}>
                                            <strong>Apuestas Joker:</strong>
                                            <div style={styles.jokerChipsContainer}>
                                                {(p.jokerPronosticos || []).map((jp, index) => (
                                                    <span key={index} style={styles.jokerDetailChip}>{jp.golesLocal}-{jp.golesVisitante}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};


const ClasificacionScreen = ({ user, userProfiles }) => {
    const [clasificacion, setClasificacion] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onSnapshot(query(collection(db, "clasificacion"), orderBy("totalPuntos", "desc")), (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setClasificacion(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    if (loading) return <LoadingSkeleton type="table" />;

    return (
        <div>
            <h2 style={styles.title}>CLASIFICACIÓN GENERAL</h2>
            <table style={styles.table}>
                <thead>
                    <tr>
                        <th style={{...styles.th, textAlign: 'center'}}>Pos.</th>
                        <th style={styles.th}>Jugador</th>
                        <th style={{...styles.th, textAlign: 'center'}}>Puntos</th>
                    </tr>
                </thead>
                <tbody>
                    {clasificacion.map((jugador, index) => {
                        const isCurrentUser = jugador.id === user;
                        let rowStyle = {...styles.tr};
                        if (index === 0) rowStyle = {...rowStyle, ...styles.leaderRow};
                        if (index === 1) rowStyle = {...rowStyle, ...styles.secondPlaceRow};
                        if (index === 2) rowStyle = {...rowStyle, ...styles.thirdPlaceRow};
                        if (isCurrentUser) rowStyle = {...rowStyle, ...styles.currentUserRow};

                        return (
                            <tr key={jugador.id} style={rowStyle}>
                                <td style={styles.tdRank}>
                                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                                </td>
                                <td style={styles.td}><PlayerProfileDisplay name={jugador.id} profile={userProfiles[jugador.id]} /></td>
                                <td style={styles.tdTotalPoints}><AnimatedCount endValue={jugador.totalPuntos || 0} /></td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};


// NUEVO: Pantalla para el Paseo de los Ganadores y Estadísticas
const WinnersWalkScreen = ({ userProfiles }) => {
    const [winnersByJornada, setWinnersByJornada] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const qJornadas = query(collection(db, "jornadas"), where("estado", "==", "Finalizada"), orderBy("numeroJornada", "desc"));
            const jornadasSnap = await getDocs(qJornadas);
            const jornadasData = jornadasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const winnersData = [];
            for (const jornada of jornadasData) {
                const pronosticosSnap = await getDocs(collection(db, "pronosticos", jornada.id, "jugadores"));
                const pronosticos = pronosticosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                const ganadoresPorra = pronosticos.filter(p => 
                    parseInt(p.golesLocal) === jornada.resultadoLocal && 
                    parseInt(p.golesVisitante) === jornada.resultadoVisitante
                );

                if (ganadoresPorra.length > 0) {
                    winnersData.push({
                        jornada,
                        ganadores: ganadoresPorra.map(g => ({ id: g.id, puntos: g.puntosObtenidos }))
                    });
                }
            }
            setWinnersByJornada(winnersData);

            // Aquí se calcularían las estadísticas complejas. Por ahora, un placeholder.
            // const calculatedStats = await calculateGlobalStats();
            // setStats(calculatedStats);

            setLoading(false);
        };
        fetchData();
    }, []);

    if (loading) return <LoadingSkeleton />;

    return (
        <div style={styles.winnersWalkContainer}>
            <h2 style={styles.title}>🏆 PASEO DE LOS GANADORES 🏆</h2>
            <p style={{textAlign: 'center', color: colors.silver, marginBottom: '30px'}}>Un recorrido por los campeones de cada jornada que acertaron el resultado exacto.</p>

            {winnersByJornada.map(data => (
                <div key={data.jornada.id} style={styles.winnersWalkJornada}>
                    <div style={styles.winnersWalkHeader}>
                        <h3 style={styles.winnersWalkTitle}>Jornada {data.jornada.numeroJornada}: {data.jornada.equipoLocal} vs {data.jornada.equipoVisitante}</h3>
                        <span style={styles.winnersWalkResult}>{data.jornada.resultadoLocal} - {data.jornada.resultadoVisitante}</span>
                    </div>
                    <div style={styles.winnersWalkWinnerList}>
                        {data.ganadores.map(winner => (
                            <div key={winner.id} style={styles.winnersWalkWinnerCard}>
                                <div style={styles.winnersWalkWinnerName}>
                                    <PlayerProfileDisplay name={winner.id} profile={userProfiles[winner.id]} />
                                </div>
                                <div style={styles.winnersWalkWinnerPoints}>{winner.puntos} Puntos</div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
            
            {/* NUEVO: Dashboard de Estadísticas */}
            <div style={styles.statsDashboard}>
                <h3 style={styles.title}>📊 ESTADÍSTICAS GLOBALES 📊</h3>
                <div style={styles.statsGrid}>
                    {/* Aquí se renderizarían las estadísticas calculadas */}
                    <div style={styles.statCard}><div style={styles.statValue}>-</div><div style={styles.statLabel}>El Monetary</div></div>
                    <div style={styles.statCard}><div style={styles.statValue}>-</div><div style={styles.statLabel}>El Atrevido</div></div>
                    <div style={styles.statCard}><div style={styles.statValue}>-</div><div style={styles.statLabel}>Olfato de Gol</div></div>
                    <div style={styles.statCard}><div style={styles.statValue}>-</div><div style={styles.statLabel}>El Pelotazo</div></div>
                </div>
                 <p style={{textAlign: 'center', color: colors.silver, marginTop: '20px', fontStyle: 'italic'}}>Próximamente más estadísticas detalladas...</p>
            </div>
        </div>
    );
};


// MODIFICADO: AdminScreen para incluir la lógica de finalización y el botón de corrección de insignias
const AdminScreen = ({ user, onBack }) => {
    const [jornadas, setJornadas] = useState([]);
    const [editingJornadaId, setEditingJornadaId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [pronosticosPorJornada, setPronosticosPorJornada] = useState({});
    const [isBadgeUpdating, setIsBadgeUpdating] = useState(false);

    useEffect(() => {
        const q = query(collection(db, "jornadas"), orderBy("numeroJornada", "desc"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const jornadasData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setJornadas(jornadasData);
            setLoading(false);

            jornadasData.forEach(j => {
                const pronosticosRef = collection(db, "pronosticos", j.id, "jugadores");
                onSnapshot(pronosticosRef, (pronosticosSnap) => {
                    setPronosticosPorJornada(prev => ({ ...prev, [j.id]: pronosticosSnap.docs.map(d => ({id: d.id, ...d.data()})) }));
                });
            });
        });
        return () => unsubscribe();
    }, []);
    
    const handleInputChange = (e, jornadaId) => {
        const { name, value, type, checked } = e.target;
        const val = type === 'checkbox' ? checked : (type === 'number' ? Number(value) : value);
        setJornadas(prev => prev.map(j => j.id === jornadaId ? { ...j, [name]: val } : j));
    };
    
    const handleSaveJornada = async (jornadaId) => {
        const jornada = jornadas.find(j => j.id === jornadaId);
        const jornadaData = { ...jornada };
        ['fechaPartido', 'fechaApertura', 'fechaCierre'].forEach(field => {
            if (jornadaData[field] && typeof jornadaData[field] === 'string') {
                jornadaData[field] = new Date(jornadaData[field]);
            }
        });

        try {
            await setDoc(doc(db, "jornadas", jornada.id), jornadaData, { merge: true });
            alert(`Jornada ${jornada.numeroJornada} actualizada.`);
            setEditingJornadaId(null);
        } catch (error) {
            console.error("Error guardando jornada: ", error);
            alert("Error al guardar la jornada.");
        }
    };
    
    // MODIFICADO: handleCerrarJornada y handleFinalizarJornada separados
    const handleCerrarJornadaYCalcular = async (jornada) => {
        if (!jornada.resultadoLocal || !jornada.resultadoVisitante) {
            alert("Introduce el resultado final antes de cerrar y puntuar.");
            return;
        }
        if (!window.confirm(`¿Estás seguro? Esto cerrará la jornada, calculará los puntos y la marcará como 'Finalizada'. Esta acción actualizará la clasificación general.`)) return;

        try {
            // 1. Calcular puntos para cada pronóstico
            const pronosticos = pronosticosPorJornada[jornada.id] || [];
            const resultadoFinal = {
                golesLocal: parseInt(jornada.resultadoLocal),
                golesVisitante: parseInt(jornada.resultadoVisitante),
                primerGoleador: (jornada.primerGoleador || '').trim().toLowerCase(),
                equipoLocal: jornada.equipoLocal,
            };

            for (const pronostico of pronosticos) {
                await runTransaction(db, async (transaction) => {
                    const jugadorClasificacionRef = doc(db, "clasificacion", pronostico.id);
                    const pronosticoRef = doc(db, "pronosticos", jornada.id, "jugadores", pronostico.id);
                    const jugadorClasificacionSnap = await transaction.get(jugadorClasificacionRef);
                    
                    const oldPoints = pronostico.puntosObtenidos || 0;
                    const newPoints = calculateFinalPoints(pronostico, resultadoFinal, jornada.esVip);
                    
                    const currentTotal = jugadorClasificacionSnap.exists() ? jugadorClasificacionSnap.data().totalPuntos || 0 : 0;
                    const newTotal = currentTotal - oldPoints + newPoints;

                    if (!jugadorClasificacionSnap.exists()) {
                        transaction.set(jugadorClasificacionRef, { id: pronostico.id, totalPuntos: newTotal, jokersRestantes: 2 });
                    } else {
                        transaction.update(jugadorClasificacionRef, { totalPuntos: newTotal });
                    }
                    transaction.update(pronosticoRef, { puntosObtenidos: newPoints });
                });
            }
            
            // 2. Marcar jornada como Finalizada
            await updateDoc(doc(db, "jornadas", jornada.id), { estado: 'Finalizada' });

            // 3. Actualizar insignias de todos
            await updateAllPlayerBadges();

            alert(`Jornada ${jornada.numeroJornada} finalizada y puntos calculados.`);

        } catch (error) {
            console.error("Error al finalizar jornada:", error);
            alert("Ocurrió un error al finalizar la jornada.");
        }
    };
    
    const handleCorrectBadges = async () => {
        if (isBadgeUpdating) return;
        if (!window.confirm("¿Seguro que quieres forzar la corrección de todas las insignias? Esto puede tardar unos segundos.")) return;
        setIsBadgeUpdating(true);
        const success = await updateAllPlayerBadges();
        if (success) {
            alert("Insignias corregidas y actualizadas para todos los jugadores.");
        } else {
            alert("Ocurrió un error al corregir las insignias. Revisa la consola.");
        }
        setIsBadgeUpdating(false);
    };

    return (
        <div>
            <button onClick={onBack} style={styles.backButton}>&larr; Volver</button>
            <h2 style={styles.title}>PANEL DE ADMINISTRADOR</h2>
            
            <div style={{...styles.adminJornadaItem, border: `2px solid ${colors.warning}`}}>
                <h4>Acciones Globales</h4>
                <button onClick={handleCorrectBadges} style={styles.recalculateButton} disabled={isBadgeUpdating}>
                    {isBadgeUpdating ? 'Actualizando...' : 'Corregir Insignias'}
                </button>
            </div>

            <h3 style={{...styles.formSectionTitle, marginTop: '40px'}}>Gestionar Jornadas</h3>
            {loading ? <p>Cargando...</p> : (
                jornadas.map(jornada => (
                    <div key={jornada.id} style={styles.adminJornadaItem}>
                        <h4 style={{display: 'flex', justifyContent: 'space-between'}}>
                            Jornada {jornada.numeroJornada}: {jornada.equipoLocal} vs {jornada.equipoVisitante}
                            <span style={{...styles.statusBadge, backgroundColor: styles.colors.status[jornada.estado]}}>{jornada.estado}</span>
                        </h4>
                        
                        {editingJornadaId === jornada.id ? (
                            <div style={styles.adminControls}>
                                {/* Inputs para editar */}
                                <input type="number" name="numeroJornada" value={jornada.numeroJornada} onChange={e => handleInputChange(e, jornada.id)} placeholder="Nº Jornada" style={styles.adminInput} />
                                <input type="text" name="equipoLocal" value={jornada.equipoLocal} onChange={e => handleInputChange(e, jornada.id)} placeholder="Equipo Local" style={styles.adminInput} />
                                <input type="text" name="equipoVisitante" value={jornada.equipoVisitante} onChange={e => handleInputChange(e, jornada.id)} placeholder="Equipo Visitante" style={styles.adminInput} />
                                <input type="datetime-local" name="fechaPartido" value={jornada.fechaPartido ? new Date(jornada.fechaPartido.seconds * 1000).toISOString().slice(0, 16) : ''} onChange={e => handleInputChange(e, jornada.id)} style={styles.adminInput} />
                                <input type="text" name="resultadoLocal" placeholder="Res. Local" value={jornada.resultadoLocal || ''} onChange={e => handleInputChange(e, jornada.id)} style={styles.adminInput} />
                                <input type="text" name="resultadoVisitante" placeholder="Res. Visitante" value={jornada.resultadoVisitante || ''} onChange={e => handleInputChange(e, jornada.id)} style={styles.adminInput} />
                                <input type="text" name="primerGoleador" placeholder="Primer Goleador" value={jornada.primerGoleador || ''} onChange={e => handleInputChange(e, jornada.id)} style={styles.adminInput} />
                                <select name="estado" value={jornada.estado} onChange={e => handleInputChange(e, jornada.id)} style={styles.adminSelect}>
                                    <option value="Próximamente">Próximamente</option>
                                    <option value="Pre-apertura">Pre-apertura</option>
                                    <option value="Abierta">Abierta</option>
                                    <option value="Cerrada">Cerrada</option>
                                    <option value="Finalizada">Finalizada</option>
                                </select>
                                <button onClick={() => handleSaveJornada(jornada.id)} style={styles.saveButton}>Guardar</button>
                                <button onClick={() => setEditingJornadaId(null)} style={{...styles.secondaryButton, borderColor: colors.danger, color: colors.danger}}>Cancelar</button>
                            </div>
                        ) : (
                            <div style={styles.adminControls}>
                                {jornada.estado !== 'Finalizada' && <button onClick={() => setEditingJornadaId(jornada.id)} style={styles.secondaryButton}>Editar</button>}
                                {jornada.estado === 'Cerrada' && <button onClick={() => handleCerrarJornadaYCalcular(jornada)} style={{...styles.saveButton, backgroundColor: colors.danger}}>Cerrar y Puntuar</button>}
                            </div>
                        )}
                    </div>
                ))
            )}
        </div>
    );
};


// NUEVO: Contenedor para el carrusel de noticias
const StatsCarousel = ({ stats, show }) => {
    if (!show || !stats || stats.length === 0) return null;
    
    return (
        <div style={styles.statsCarouselContainer}>
            <div style={styles.statsCarouselTicker}>
                {stats.map((stat, index) => (
                    <span key={index} style={styles.statsCarouselItem}>
                        <span style={styles.statsCarouselItemIcon}>{stat.icon}</span> {stat.text}
                    </span>
                ))}
                 {stats.map((stat, index) => ( // Duplicado para un bucle infinito suave
                    <span key={`dup-${index}`} style={styles.statsCarouselItem}>
                        <span style={styles.statsCarouselItemIcon}>{stat.icon}</span> {stat.text}
                    </span>
                ))}
            </div>
        </div>
    );
}

// MODIFICADO: App principal para incluir las nuevas pantallas y el carrusel
const App = () => {
    const [user, setUser] = useState(null);
    const [screen, setScreen] = useState('initial-splash');
    const [activeTab, setActiveTab] = useState('miJornada');
    const [teamLogos, setTeamLogos] = useState({});
    const [plantilla, setPlantilla] = useState(PLANTILLA_ACTUALIZADA);
    const [userProfiles, setUserProfiles] = useState({});
    const [onlineUsers, setOnlineUsers] = useState({});
    const [liveData, setLiveData] = useState(null);
    const [jornadaParaLive, setJornadaParaLive] = useState(null);
    const [carouselStats, setCarouselStats] = useState([]);

    useEffect(() => {
        onAuthStateChanged(auth, (firebaseUser) => { if (!firebaseUser) { signInAnonymously(auth); } });
        getDoc(doc(db, "config", "teamLogos")).then(docSnap => { if (docSnap.exists()) setTeamLogos(docSnap.data()); });
        getDoc(doc(db, "config", "plantilla")).then(docSnap => { if (docSnap.exists() && docSnap.data().jugadores) setPlantilla(docSnap.data().jugadores); });
        
        onSnapshot(collection(db, "profiles"), (snap) => { const profiles = {}; snap.forEach(doc => { profiles[doc.id] = doc.data(); }); setUserProfiles(profiles); });
        
        const liveRef = doc(db, "live", "matchData");
        const unsubscribeLive = onSnapshot(liveRef, (doc) => { setLiveData(doc.data()); });
        
        const qJornadas = query(collection(db, "jornadas"), where("estado", "in", ["Cerrada", "Abierta"]));
        const unsubscribeJornadas = onSnapshot(qJornadas, (snap) => {
            const jornadaActiva = snap.docs.map(d => d.data())[0];
            setJornadaParaLive(jornadaActiva);
        });

        // Placeholder para cargar las estadísticas del carrusel
        setCarouselStats([
            { icon: '💸', text: 'Juanma es el más "Monetary" con 50€ ganados.' },
            { icon: '🔥', text: 'Laura está "En Racha" con 4 jornadas seguidas puntuando.' },
            { icon: '🎯', text: 'El resultado más repetido es el 1-1.' },
            { icon: '⚽', text: 'Kirian es el goleador más elegido esta temporada.' },
        ]);

        return () => { unsubscribeLive(); unsubscribeJornadas(); };
    }, []);

    const handleLogin = (selectedUser) => {
        setUser(selectedUser);
        setScreen('main');
        const userStatusDatabaseRef = ref(rtdb, '/status/' + selectedUser);
        const userProfileRef = doc(db, "profiles", selectedUser);
        const isOnlineForDatabase = { state: 'online', last_changed: Date.now() };
        set(userStatusDatabaseRef, isOnlineForDatabase);
        setDoc(userProfileRef, { ultimaConexion: serverTimestamp() }, { merge: true });
        onDisconnect(userStatusDatabaseRef).set({ state: 'offline', last_changed: Date.now() });
    };

    const handleLogout = () => { if(user){ const userStatusDatabaseRef = ref(rtdb, '/status/' + user); set(userStatusDatabaseRef, { state: 'offline', last_changed: Date.now() }); } setUser(null); setActiveTab('miJornada'); setScreen('login'); };

    const renderScreen = () => {
        switch(screen) {
            case 'initial-splash': return <InitialSplashScreen onFinish={() => setScreen('splash')} />;
            case 'splash': return <SplashScreen onEnter={() => setScreen('login')} teamLogos={teamLogos} plantilla={plantilla} />;
            case 'login': return <LoginScreen onLogin={handleLogin} userProfiles={userProfiles} onlineUsers={onlineUsers} />;
            case 'main':
                const isAdmin = user === 'Juanma';
                const userProfile = userProfiles[user] || {};
                return (
                    <div style={styles.fadeIn}>
                        <div style={{...styles.navbar, borderColor: activeTab === 'admin' ? colors.danger : colors.blue}}>
                            <button onClick={() => setActiveTab('miJornada')} style={activeTab === 'miJornada' ? styles.navButtonActive : styles.navButton}>Mi Jornada</button>
                            <button onClick={() => setActiveTab('laJornada')} style={activeTab === 'laJornada' ? styles.navButtonActive : styles.navButton}>La Jornada</button>
                            <button onClick={() => setActiveTab('clasificacion')} style={activeTab === 'clasificacion' ? styles.navButtonActive : styles.navButton}>Clasificación</button>
                            {/* NUEVO: Botón para el Paseo de los Ganadores */}
                            <button onClick={() => setActiveTab('winnersWalk')} style={activeTab === 'winnersWalk' ? styles.navButtonActive : styles.navButton}>Ganadores</button>
                            {isAdmin && <button onClick={() => setActiveTab('admin')} style={activeTab === 'admin' ? {...styles.navButtonActive, color: colors.danger, borderBottomColor: colors.danger} : styles.navButton}>Admin</button>}
                            <button onClick={() => setActiveTab('profile')} style={styles.profileNavButton}><PlayerProfileDisplay name={user} profile={userProfile} /></button>
                            <button onClick={handleLogout} style={styles.logoutButton}>Salir</button>
                        </div>
                        <div style={{...styles.content, paddingBottom: '50px' /* Espacio para el carrusel */}}>
                            {activeTab === 'miJornada' && <MiJornadaScreen user={user} setActiveTab={setActiveTab} teamLogos={teamLogos} liveData={liveData} plantilla={plantilla} userProfiles={userProfiles}/>}
                            {activeTab === 'laJornada' && <LaJornadaScreen teamLogos={teamLogos} liveData={liveData} userProfiles={userProfiles} />}
                            {activeTab === 'clasificacion' && <ClasificacionScreen user={user} userProfiles={userProfiles}/>}
                            {activeTab === 'winnersWalk' && <WinnersWalkScreen userProfiles={userProfiles}/>}
                            {activeTab === 'admin' && isAdmin && <AdminScreen user={user} onBack={() => setActiveTab('miJornada')} />}
                        </div>
                    </div>
                );
            default: return null;
        }
    };

    return (
        <div style={styles.container}>
            <div style={{...styles.card, position: 'relative', overflow: 'hidden'}}>
                <LiveBanner liveData={liveData} jornada={jornadaParaLive} />
                {renderScreen()}
                <StatsCarousel stats={carouselStats} show={screen === 'main' && activeTab !== 'winnersWalk'} />
            </div>
        </div>
    );
};

export default App;
