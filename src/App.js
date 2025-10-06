import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
// Importamos las funciones necesarias de Firebase
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

const BADGE_DEFINITIONS = {
    lider_general: { icon: '👑', name: 'Líder General', priority: 1, style: 'leader-glow' },
    campeon_jornada: { icon: '🏆', name: 'Campeón de la Jornada', priority: 2, style: 'champion-glow' },
    pleno_jornada: { icon: '🎯', name: 'Pleno en la Jornada', priority: 3, style: 'pleno-flash' },
    en_racha: { icon: '🔥', name: 'En Racha', priority: 4, style: 'fire-streak' },
    mala_racha: { icon: '🥶', name: 'Mala Racha', priority: 5, style: 'cold-streak' },
};


const EQUIPOS_LIGA = [
    "UD Las Palmas", "FC Andorra", "Córdoba CF", "Málaga CF", "Burgos CF",
    "Real Sociedad B", "CD Leganes", "UD Almería", "Cádiz CF", "Granada CF",
    "SD Eibar", "SD Huesca", "Real Sporting de Gijón", "Real Racing Club",
    "Real Valladolid CF", "Albacete Balompié", "CD Castellón", "CD Mirandés",
    "AD Ceuta FC", "CyD Leonesa", "Real Zaragoza", "RC Deportivo"
];

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
    liveWinnerPanel: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '20px', margin: '20px 0', border: `2px solid ${colors.yellow}`, boxShadow: `0 0 15px ${colors.yellow}50` },
    liveWinnerCurrent: { textAlign: 'center', paddingBottom: '15px', borderBottom: `1px dashed ${colors.blue}`, marginBottom: '15px' },
    liveWinnerLabel: { display: 'block', textTransform: 'uppercase', color: colors.silver, fontSize: '0.9rem', marginBottom: '8px' },
    liveWinnerName: { fontFamily: "'Orbitron', sans-serif", fontSize: '1.5rem', fontWeight: 'bold' },
    liveWinnerSimulations: { display: 'flex', justifyContent: 'space-around', gap: '15px' },
    liveWinnerSimulationItem: { textAlign: 'center', flex: 1 },
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
    fameContainer: { display: 'flex', flexDirection: 'column', gap: '20px' },
    fameCard: { backgroundColor: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', border: `1px solid ${colors.blue}80` },
    fameCardTitle: { fontFamily: "'Orbitron', sans-serif", color: colors.yellow, marginBottom: '15px', borderBottom: `1px solid ${colors.blue}`, paddingBottom: '10px', fontSize: '1.2rem' },
    fameWinnerList: { listStyle: 'none', padding: 0, textAlign: 'center', margin: '10px 0' },
    fameWinnerItem: { display: 'inline-block', margin: '0 10px', fontSize: '1.2rem' },
    fameJornadaGrid: { display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' },
    fameJornadaEntry: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' },
    newsTickerContainer: { position: 'fixed', bottom: 0, left: 0, width: '100%', backgroundColor: `rgba(10, 25, 47, 0.9)`, borderTop: `2px solid ${colors.yellow}`, overflow: 'hidden', whiteSpace: 'nowrap', zIndex: 500, backdropFilter: 'blur(5px)' },
    newsTickerContent: { display: 'inline-block', padding: '10px 0', color: colors.lightText, animation: 'ticker-scroll 45s linear infinite' },
    newsTickerItem: { display: 'inline-block', padding: '0 25px', fontSize: '0.9rem', color: colors.silver, '& strong': { color: colors.yellow } },
};

// ============================================================================
// --- LÓGICA DE CÁLCULO Y FORMATO ---
// ============================================================================

const getTesoreroResponsable = (jugador) => {
    for (const tesorero in GRUPOS_PAGOS) { if (GRUPOS_PAGOS[tesorero].includes(jugador)) { return tesorero; } }
    return null;
};

const formatFullDateTime = (firebaseDate) => {
    if (!firebaseDate || typeof firebaseDate.seconds !== 'number') return 'Fecha por confirmar';
    try {
        const date = new Date(firebaseDate.seconds * 1000);
        const options = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false };
        return new Intl.DateTimeFormat('es-ES', options).format(date).replace(',', ' a las');
    } catch (error) { console.error("Error formatting date:", error); return 'Fecha inválida'; }
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
        if (diffSeconds < 60) return "hace un momento"; if (diffMinutes < 60) return `hace ${diffMinutes} min`; if (diffHours < 24) return `hace ${diffHours} h`; if (diffDays === 1) return `ayer a las ${lastSeenDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`; if (diffDays < 7) return `hace ${diffDays} días`;
        return `el ${lastSeenDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}`;
    } catch (error) { console.error("Error formatting last seen:", error); return null; }
};

const calculateProvisionalPoints = (pronostico, liveData, jornada) => {
    if (!pronostico || !liveData || !jornada || !liveData.isLive) return 0;
    let puntosJornada = 0; const esVip = jornada.esVip || false; const { golesLocal, golesVisitante } = liveData;
    const aciertoExacto = pronostico.golesLocal !== '' && pronostico.golesVisitante !== '' && parseInt(pronostico.golesLocal) === golesLocal && parseInt(pronostico.golesVisitante) === golesVisitante;
    if (aciertoExacto) { puntosJornada += esVip ? 6 : 3; }
    let resultado1x2Real = '';
    if (jornada.equipoLocal === "UD Las Palmas") { if (golesLocal > golesVisitante) resultado1x2Real = 'Gana UD Las Palmas'; else if (golesLocal < golesVisitante) resultado1x2Real = 'Pierde UD Las Palmas'; else resultado1x2Real = 'Empate'; }
    else { if (golesVisitante > golesLocal) resultado1x2Real = 'Gana UD Las Palmas'; else if (golesVisitante < golesLocal) resultado1x2Real = 'Pierde UD Las Palmas'; else resultado1x2Real = 'Empate'; }
    if (pronostico.resultado1x2 === resultado1x2Real) { puntosJornada += esVip ? 2 : 1; }
    const goleadorReal = (liveData.ultimoGoleador || '').trim().toLowerCase(); const goleadorApostado = (pronostico.goleador || '').trim().toLowerCase();
    if (pronostico.sinGoleador && (goleadorReal === "sg" || goleadorReal === "")) { puntosJornada += 1; }
    else if (!pronostico.sinGoleador && goleadorApostado !== "" && goleadorApostado === goleadorReal) { puntosJornada += esVip ? 4 : 2; }
    if (pronostico.jokerActivo && pronostico.jokerPronosticos?.length > 0) { for (const jokerP of pronostico.jokerPronosticos) { if (jokerP.golesLocal !== '' && jokerP.golesVisitante !== '' && parseInt(jokerP.golesLocal) === golesLocal && parseInt(jokerP.golesVisitante) === golesVisitante) { puntosJornada += esVip ? 6 : 3; break; } } }
    return puntosJornada;
};


// ============================================================================
// --- COMPONENTES REUTILIZABLES Y DE ANIMACIÓN ---
// ============================================================================

const PlayerProfileDisplay = ({ name, profile, defaultColor = styles.colors.lightText, style: customStyle = {} }) => {
    const finalProfile = profile || {}; const color = finalProfile.color || defaultColor; const icon = finalProfile.icon || ''; const isGradient = typeof color === 'string' && color.startsWith('linear-gradient');
    const nameStyle = { ...(isGradient ? { background: color, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } : { color: color }) };
    const badgesToDisplay = useMemo(() => {
        if (!finalProfile.badges || finalProfile.badges.length === 0) return [];
        return finalProfile.badges.map(badgeKey => ({ key: badgeKey, ...BADGE_DEFINITIONS[badgeKey] })).filter(b => b.name && b.icon).sort((a, b) => a.priority - b.priority);
    }, [finalProfile.badges]);
    const badgeStyle = useMemo(() => {
        if (!finalProfile.badges || finalProfile.badges.length === 0) return {};
        const highestPriorityBadgeWithStyle = finalProfile.badges.map(badgeKey => ({ key: badgeKey, ...BADGE_DEFINITIONS[badgeKey] })).filter(b => b.name && b.style).sort((a, b) => a.priority - b.priority)[0];
        if (highestPriorityBadgeWithStyle) {
            const animationName = `${highestPriorityBadgeWithStyle.style}-animation`; let animationProps = '2s infinite alternate';
            if(highestPriorityBadgeWithStyle.style === 'pleno-flash') animationProps = '0.5s ease-in-out 3';
            if(highestPriorityBadgeWithStyle.style === 'cold-streak') animationProps = '1.5s infinite';
            return { animation: `${animationName} ${animationProps}` };
        }
        return {};
    }, [finalProfile.badges]);
    return (<span style={{...customStyle, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>{badgesToDisplay.map(badge => (<span key={badge.key} title={badge.name} style={badgeStyle}>{badge.icon}</span>))}{icon && <span>{icon}</span>}<span style={nameStyle}>{name}</span></span>);
};

const LiveBanner = ({ liveData, jornada }) => {
    if (!jornada || !liveData || !liveData.isLive) return null;
    return (<div style={styles.liveBanner}><span style={styles.liveIndicator}>🔴 EN VIVO</span><span style={styles.liveMatchInfo}>{jornada.equipoLocal} <strong>{liveData.golesLocal} - {liveData.golesVisitante}</strong> {jornada.equipoVisitante}</span>{liveData.ultimoGoleador && <span style={styles.liveGoalScorer}>Último Gol: {liveData.ultimoGoleador}</span>}</div>);
};

const TeamDisplay = ({ teamLogos, teamName, shortName = false, imgStyle }) => (<div style={styles.teamDisplay}><img src={teamLogos[teamName] || 'https://placehold.co/50x50/1b263b/e0e1dd?text=?'} style={{...styles.teamLogo, ...imgStyle}} alt={`${teamName} logo`} onError={(e) => { e.target.src = 'https://placehold.co/50x50/1b263b/e0e1dd?text=?'; }} /><span style={styles.teamNameText}>{shortName && teamName === "UD Las Palmas" ? "UDLP" : teamName}</span></div>);

const JokerAnimation = () => {
    const [exploded, setExploded] = useState(false); useEffect(() => { const timer = setTimeout(() => setExploded(true), 5500); return () => clearTimeout(timer); }, []); const jokers = Array.from({ length: 100 });
    return (<div style={styles.jokerAnimationOverlay}>{jokers.map((_, i) => (<span key={i} className={exploded ? 'exploded' : ''} style={{...styles.jokerIcon, left: `${Math.random() * 100}vw`, fontSize: `${1.5 + Math.random() * 2}rem`, animationDelay: `${Math.random() * 4}s`, animationDuration: `${4 + Math.random() * 4}s`, transform: exploded ? `translate(${Math.random() * 800 - 400}px, ${Math.random() * 800 - 400}px) rotate(720deg)` : 'translateY(-100px) rotate(0deg)', opacity: exploded ? 0 : 1 }}>🃏</span>))}</div>);
};

const Confetti = () => {
    const particles = Array.from({ length: 200 });
    return (<div style={styles.confettiOverlay}>{particles.map((_, i) => (<div key={i} className="confetti-particle" style={{ '--x': `${Math.random() * 100}vw`, '--angle': `${Math.random() * 360}deg`, '--delay': `${Math.random() * 5}s`, '--color': i % 3 === 0 ? styles.colors.yellow : (i % 3 === 1 ? styles.colors.blue : styles.colors.lightText), '--size': `${5 + Math.random() * 10}px` }} />))}</div>);
};

const AnimatedCount = ({ endValue, duration = 1000, decimals = 0 }) => {
    const [currentValue, setCurrentValue] = useState(0); const prevValueRef = useRef(0);
    useEffect(() => {
        const startValue = prevValueRef.current; let startTime = null;
        const animation = (currentTime) => {
            if (!startTime) startTime = currentTime;
            const progress = Math.min((currentTime - startTime) / duration, 1);
            setCurrentValue(progress * (endValue - startValue) + startValue);
            if (progress < 1) requestAnimationFrame(animation); else prevValueRef.current = endValue;
        };
        requestAnimationFrame(animation);
        return () => { prevValueRef.current = endValue; };
    }, [endValue, duration]);
    return <span>{currentValue.toFixed(decimals)}</span>;
};

const WinnerAnimation = ({ winnerData, onClose }) => {
    const { pronostico, prize } = winnerData;
    return (<div style={styles.winnerAnimationOverlay}><Confetti /><div style={styles.winnerModal}><div style={styles.trophy}>🏆</div><h2 style={styles.winnerTitle}>¡FELICIDADES, {pronostico.id}!</h2><p style={styles.winnerText}>¡Has ganado la porra de la jornada!</p><div style={styles.winnerStats}><span>Puntos Obtenidos: <strong><AnimatedCount endValue={pronostico.puntosObtenidos} duration={1500} /></strong></span><span>Premio: <strong><AnimatedCount endValue={prize} duration={1500} decimals={2} />€</strong></span></div><button onClick={onClose} style={{...styles.mainButton, marginTop: '30px'}}>CERRAR</button></div></div>);
};

const InstallGuideModal = ({ onClose }) => (<div style={styles.modalOverlay} onClick={onClose}><div style={styles.modalContent} onClick={(e) => e.stopPropagation()}><h3 style={styles.title}>Instalar App</h3><div style={styles.installInstructions}><div style={styles.installSection}><h4>iPhone (Safari)</h4><ol><li>Pulsa el botón de <strong>Compartir</strong> (un cuadrado con una flecha hacia arriba).</li><li>Busca y pulsa en <strong>"Añadir a pantalla de inicio"</strong>.</li><li>¡Listo! Ya tienes la app en tu móvil.</li></ol></div><div style={styles.installSection}><h4>Android (Chrome)</h4><ol><li>Pulsa el botón de <strong>Menú</strong> (tres puntos verticales).</li><li>Busca y pulsa en <strong>"Instalar aplicación"</strong> o "Añadir a pantalla de inicio".</li><li>¡Listo! Ya tienes la app en tu móvil.</li></ol></div></div><button onClick={onClose} style={styles.mainButton}>Entendido</button></div></div>);
const NotificationPermissionModal = ({ onAllow, onDeny }) => (<div style={styles.modalOverlay}><div style={styles.modalContent} onClick={(e) => e.stopPropagation()}><div style={{textAlign: 'center', marginBottom: '20px'}}><span style={{fontSize: '4rem'}}>🔔</span></div><h3 style={styles.title}>REACTIVAR NOTIFICACIONES</h3><p style={{textAlign: 'center', marginBottom: '20px', lineHeight: 1.5}}>¡Hemos mejorado nuestro sistema de avisos! Para asegurarte de que sigues recibiendo las notificaciones importantes, necesitamos que vuelvas a aceptar el permiso. ¡Gracias!</p><ul style={{listStyle: 'none', padding: 0, marginBottom: '30px', textAlign: 'center'}}><li style={{marginBottom: '10px'}}>✅ Avisos de nuevas jornadas</li><li style={{marginBottom: '10px'}}>⏳ Recordatorios de cierre</li><li style={{marginBottom: '10px'}}>🏆 Resultados y ganadores</li></ul><div style={{display: 'flex', justifyContent: 'space-around', gap: '10px'}}><button onClick={onDeny} style={{...styles.mainButton, backgroundColor: 'transparent', color: styles.colors.lightText, borderColor: styles.colors.lightText}}>Ahora no</button><button onClick={onAllow} style={styles.mainButton}>Reactivar</button></div></div></div>);

const LiquidarPagoModal = ({ onClose, onConfirm }) => {
    const [isChecked, setIsChecked] = useState(false); const handleConfirm = () => { if (isChecked) onConfirm(); };
    return (<div style={styles.modalOverlay}><div style={styles.modalContent} onClick={(e) => e.stopPropagation()}><h3 style={styles.title}>CONFIRMAR PAGO</h3><p style={{textAlign: 'center', marginBottom: '20px', lineHeight: 1.5}}>Estás a punto de marcar tu apuesta como pagada. Esto sirve como un aviso para el administrador.</p><p style={{textAlign: 'center', marginBottom: '20px', lineHeight: 1.5, fontWeight: 'bold', color: styles.colors.warning}}>Recuerda que el administrador debe validar el pago manualmente después de tu confirmación.</p><div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '30px'}}><input type="checkbox" id="confirm-pago-check" checked={isChecked} onChange={() => setIsChecked(!isChecked)} style={styles.checkbox}/><label htmlFor="confirm-pago-check" style={{marginLeft: '10px', color: styles.colors.lightText}}>Confirmo que he realizado el pago de esta jornada.</label></div><div style={{display: 'flex', justifyContent: 'space-around', gap: '10px'}}><button onClick={onClose} style={{...styles.mainButton, backgroundColor: 'transparent', color: styles.colors.lightText, borderColor: styles.colors.lightText}}>Cancelar</button><button onClick={handleConfirm} style={styles.mainButton} disabled={!isChecked}>Confirmar Pago</button></div></div></div>);
};

const LoadingSkeleton = ({ type = 'list' }) => {
    if (type === 'table') { return (<div style={styles.skeletonTable}>{Array.from({ length: 5 }).map((_, i) => (<div key={i} style={styles.skeletonRow}><div style={{...styles.skeletonBox, width: '50px', height: '20px'}}></div><div style={{...styles.skeletonBox, width: '120px', height: '20px'}}></div><div style={{...styles.skeletonBox, width: '80px', height: '20px'}}></div><div style={{...styles.skeletonBox, width: '60px', height: '20px'}}></div></div>))}</div>); }
    if (type === 'splash') { return (<div style={styles.skeletonContainer}><div style={{...styles.skeletonBox, height: '40px', width: '80%', marginBottom: '20px'}}></div><div style={{...styles.skeletonBox, height: '150px', width: '100%'}}></div><div style={{...styles.skeletonBox, height: '60px', width: '90%', marginTop: '10px'}}></div></div>); }
    return (<div style={styles.skeletonContainer}><div style={{...styles.skeletonBox, height: '40px', width: '80%', marginBottom: '20px'}}></div><div style={{...styles.skeletonBox, height: '20px', width: '60%'}}></div><div style={{...styles.skeletonBox, height: '20px', width: '70%', marginTop: '10px'}}></div></div>);
};

const AnimatedPoints = ({ value }) => {
    const [displayValue, setDisplayValue] = useState(value); const prevValueRef = useRef(value);
    useEffect(() => { if (value !== prevValueRef.current) { const element = document.getElementById(`animated-points-${value}`); if (element) { element.style.transform = 'scale(1.3)'; element.style.transition = 'transform 0.2s ease-out'; setTimeout(() => { element.style.transform = 'scale(1)'; }, 200); } setDisplayValue(value); prevValueRef.current = value; } }, [value]);
    return <span id={`animated-points-${value}`}>{displayValue}</span>;
};

const PieChart = ({ data }) => {
    const radius = 50; const circumference = 2 * Math.PI * radius; let accumulatedRotation = 0;
    return (
        <div style={styles.pieChartContainer}>
            <svg viewBox="0 0 120 120" style={styles.pieChartSvg}>
                <g transform="rotate(-90 60 60)">
                    {data.map((segment, index) => {
                        const percentage = parseFloat(segment.percentage); if (isNaN(percentage) || percentage === 0) return null;
                        const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`; const rotation = accumulatedRotation; accumulatedRotation += (percentage / 100) * 360;
                        return (<circle key={index} cx="60" cy="60" r={radius} fill="transparent" stroke={segment.color} strokeWidth="20" strokeDasharray={circumference} strokeDashoffset={circumference} style={{ '--stroke-dasharray': strokeDasharray, '--rotation': `${rotation}deg`, animationDelay: `${index * 0.2}s` }} className="pie-chart-segment-new"/>);
                    })}
                </g>
            </svg>
            <div style={styles.pieChartLegend}>{data.map((segment, index) => (<div key={index} style={styles.pieChartLegendItem}><span style={{...styles.pieChartLegendColor, backgroundColor: segment.color}}></span><span>{segment.label} ({segment.percentage}%)</span></div>))}</div>
        </div>
    );
};

const ResumenModal = ({ data, onClose, userProfiles }) => {
    if (!data || !data.stats) return null;
    const { resultadoCounts, goleadorCounts, pieChartData } = data.stats;
    const sortedResultados = Object.entries(resultadoCounts).sort((a, b) => b[1] - a[1]);
    const sortedGoleadores = Object.entries(goleadorCounts).sort((a, b) => b[1] - a[1]);
    return (
        <div style={styles.modalOverlay} onClick={onClose}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <h3 style={styles.title}>Resumen de la Jornada</h3>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px'}}>
                    <div><h4>Resultados Más Votados</h4><ul>{sortedResultados.map(([res, count]) => <li key={res}>{res}: {count} voto(s)</li>)}</ul></div>
                    <div><h4>Goleadores Más Votados</h4><ul>{sortedGoleadores.map(([g, count]) => <li key={g}>{g}: {count} voto(s)</li>)}</ul></div>
                </div>
                <div style={{marginTop: '20px'}}><h4>Distribución de Resultados</h4><PieChart data={pieChartData.map((d, i) => ({...d, color: PROFILE_COLORS[i % PROFILE_COLORS.length]}))} /></div>
                <button onClick={onClose} style={{...styles.mainButton, marginTop: '20px'}}>Cerrar</button>
            </div>
        </div>
    );
};

const NewsTicker = ({ stats, onHoverChange }) => {
    if (!stats || stats.length === 0) return null;
    return (
        <div style={styles.newsTickerContainer} onMouseEnter={() => onHoverChange(true)} onMouseLeave={() => onHoverChange(false)}>
            <div style={styles.newsTickerContent}>
                {stats.map((stat, index) => (<span key={index} style={styles.newsTickerItem}>{stat.emoji} <strong>{stat.titulo}:</strong> {stat.jugador} ({stat.valor} {stat.unidad})</span>))}
                {stats.map((stat, index) => (<span key={`dup-${index}`} style={styles.newsTickerItem}>{stat.emoji} <strong>{stat.titulo}:</strong> {stat.jugador} ({stat.valor} {stat.unidad})</span>))}
            </div>
        </div>
    );
};

// ============================================================================
// --- COMPONENTES DE LAS PANTALLAS (DEFINIDOS ANTES DE APP) ---
// ============================================================================

const InitialSplashScreen = ({ onFinish }) => {
    const [fadingOut, setFadingOut] = useState(false); useEffect(() => { const timer = setTimeout(() => { setFadingOut(true); setTimeout(onFinish, 500); }, 2500); return () => clearTimeout(timer); }, [onFinish]);
    return (<div style={fadingOut ? {...styles.initialSplashContainer, ...styles.fadeOut} : styles.initialSplashContainer}><img src="https://upload.wikimedia.org/wikipedia/en/thumb/2/20/UD_Las_Palmas_logo.svg/1200px-UD_Las_Palmas_logo.svg.png" alt="UD Las Palmas Logo" style={styles.splashLogo} /><div style={styles.splashTitleContainer}><span style={styles.splashTitle}>PORRA UDLP</span><span style={styles.splashYear}>2026</span></div><div style={styles.loadingMessage}><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="spinner"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg><p>Cargando datos...</p></div></div>);
};

const SplashScreen = ({ onEnter, teamLogos, plantilla }) => {
    const [jornadaInfo, setJornadaInfo] = useState(null); const [countdown, setCountdown] = useState(''); const [loading, setLoading] = useState(true); const [showInstallGuide, setShowInstallGuide] = useState(false); const [stats, setStats] = useState(null); const [currentStatIndex, setCurrentStatIndex] = useState(0); const isMobile = useMemo(() => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent), []);
    useEffect(() => {
        setLoading(true); const qJornadas = query(collection(db, "jornadas"), orderBy("numeroJornada"));
        const unsubscribe = onSnapshot(qJornadas, (snap) => {
            const ahora = new Date(); const todasLasJornadas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            let jornadaActiva = todasLasJornadas.find(j => j.estado === 'Abierta' || j.estado === 'Pre-apertura') || todasLasJornadas.find(j => j.estado === 'Próximamente' && j.fechaApertura?.toDate() <= ahora && ahora < j.fechaCierre?.toDate());
            if (jornadaActiva) {
                const type = jornadaActiva.estado === 'Pre-apertura' ? 'pre-apertura' : 'activa'; setJornadaInfo({ ...jornadaActiva, type });
                if (type === 'activa') { onSnapshot(collection(db, "pronosticos", jornadaActiva.id, "jugadores"), (pronosticosSnap) => { const pronosticos = pronosticosSnap.docs.map(doc => doc.data()); if (pronosticos.length > 0) { const goleadorCounts = pronosticos.reduce((acc, p) => { if(p.goleador) acc[p.goleador] = (acc[p.goleador] || 0) + 1; return acc; }, {}); const resultadoCounts = pronosticos.reduce((acc, p) => { const res = `${p.golesLocal}-${p.golesVisitante}`; acc[res] = (acc[res] || 0) + 1; return acc; }, {}); setStats({ apostadoCount: pronosticos.length, sinApostar: JUGADORES.length - pronosticos.length, goleadorMasVotado: Object.keys(goleadorCounts).length > 0 ? Object.entries(goleadorCounts).sort((a,b) => b[1] - a[1])[0][0] : null, resultadoMasVotado: Object.keys(resultadoCounts).length > 0 ? Object.entries(resultadoCounts).sort((a,b) => b[1] - a[1])[0][0] : null, jokersActivos: pronosticos.filter(p => p.jokerActivo).length }); } else setStats(null); }); } else setStats(null);
            } else {
                setStats(null); let jornadaCerrada = todasLasJornadas.find(j => j.estado === 'Cerrada'); if (jornadaCerrada) { setJornadaInfo({ ...jornadaCerrada, type: 'cerrada' }); }
                else { const ultimasFinalizadas = todasLasJornadas.filter(j => j.estado === 'Finalizada').sort((a,b) => b.numeroJornada - a.numeroJornada); if (ultimasFinalizadas.length > 0) { setJornadaInfo({ ...ultimasFinalizadas[0], type: 'finalizada' }); } else { const proximas = todasLasJornadas.filter(j => j.estado === 'Próximamente').sort((a,b) => a.numeroJornada - b.numeroJornada); if (proximas.length > 0) setJornadaInfo({ ...proximas[0], type: 'proxima' }); else setJornadaInfo(null); } }
            }
            setLoading(false);
        }, (error) => { console.error("Error fetching jornada: ", error); setLoading(false); });
        return () => unsubscribe();
    }, []);
    useEffect(() => {
        if (!jornadaInfo) return;
        const targetDate = (jornadaInfo.type === 'activa' || jornadaInfo.estado === 'Abierta') ? jornadaInfo.fechaCierre?.toDate() : (jornadaInfo.type === 'proxima' || jornadaInfo.type === 'pre-apertura' ? jornadaInfo.fechaApertura?.toDate() : null); if (!targetDate) { setCountdown(''); return; }
        const interval = setInterval(() => {
            const diff = targetDate - new Date();
            if (diff <= 0) { let message = "¡PARTIDO EN JUEGO!"; if (jornadaInfo.type === 'activa') message = "¡APUESTAS CERRADAS!"; if (jornadaInfo.type === 'proxima' || jornadaInfo.type === 'pre-apertura') message = "¡APUESTAS ABIERTAS!"; setCountdown(message); clearInterval(interval); return; }
            const d = Math.floor(diff / 86400000); const h = Math.floor((diff % 86400000) / 3600000); const m = Math.floor((diff % 3600000) / 60000); const s = Math.floor((diff % 60000) / 1000); setCountdown(`${d}d ${h}h ${m}m ${s}s`);
        }, 1000);
        return () => clearInterval(interval);
    }, [jornadaInfo]);
    useEffect(() => { if (stats) { const timer = setInterval(() => { setCurrentStatIndex(prevIndex => (prevIndex + 1) % 4); }, 4000); return () => clearInterval(timer); } }, [stats]);
    const renderJornadaInfo = () => {
        if (!jornadaInfo) return (<div style={styles.splashInfoBox}><h3 style={styles.splashInfoTitle}>TEMPORADA EN PAUSA</h3><p>El administrador aún no ha configurado la próxima jornada.</p></div>);
        const fechaMostrada = jornadaInfo.fechaPartido || jornadaInfo.fechaCierre; let infoContent;
        switch (jornadaInfo.type) {
            case 'activa': infoContent = (<><h3 style={styles.splashInfoTitle}>¡APUESTAS ABIERTAS!</h3><p style={styles.splashMatch}>{jornadaInfo.equipoLocal} <span style={{color: styles.colors.yellow}}>vs</span> {jornadaInfo.equipoVisitante}</p><p style={{margin: '10px 0'}}>🗓️ {formatFullDateTime(fechaMostrada)}</p><div style={styles.countdownContainer}><p>CIERRE DE APUESTAS</p><div style={styles.countdown}>{countdown}</div></div></>); break;
            case 'pre-apertura': infoContent = (<><h3 style={styles.splashInfoTitle}>PRÓXIMA JORNADA</h3><p style={styles.splashMatch}>{jornadaInfo.equipoLocal} <span style={{color: styles.colors.yellow}}>vs</span> {jornadaInfo.equipoVisitante}</p><p style={{margin: '10px 0'}}>🗓️ {formatFullDateTime(fechaMostrada)}</p>{jornadaInfo.bote > 0 && <p style={styles.splashBote}>¡BOTE DE {jornadaInfo.bote}€ EN JUEGO!</p>}{countdown && <div style={styles.countdownContainer}><p>LA APERTURA COMIENZA EN</p><div style={styles.countdown}>{countdown}</div></div>}</>); break;
            case 'proxima': infoContent = (<><h3 style={styles.splashInfoTitle}>PRÓXIMA JORNADA</h3><p style={styles.splashMatch}>{jornadaInfo.equipoLocal} <span style={{color: styles.colors.yellow}}>vs</span> {jornadaInfo.equipoVisitante}</p><p style={{margin: '10px 0'}}>🗓️ {formatFullDateTime(fechaMostrada)}</p>{jornadaInfo.bote > 0 && <p style={styles.splashBote}>¡BOTE DE {jornadaInfo.bote}€ EN JUEGO!</p>}{countdown && <div style={styles.countdownContainer}><p>LA APERTURA COMIENZA EN</p><div style={styles.countdown}>{countdown}</div></div>}</>); break;
            case 'cerrada': infoContent = (<><h3 style={styles.splashInfoTitle}>¡APUESTAS CERRADAS!</h3><p style={styles.splashMatch}>{jornadaInfo.equipoLocal} <span style={{color: styles.colors.yellow}}>vs</span> {jornadaInfo.equipoVisitante}</p><p style={{margin: '10px 0'}}>🗓️ {formatFullDateTime(fechaMostrada)}</p><p>Esperando el resultado del partido...</p></>); break;
            case 'finalizada': infoContent = (<><h3 style={styles.splashInfoTitle}>ÚLTIMA JORNADA FINALIZADA</h3><p style={styles.splashMatch}>{jornadaInfo.equipoLocal} <span style={{color: styles.colors.yellow}}>vs</span> {jornadaInfo.equipoVisitante}</p><p style={styles.finalResult}>Resultado: {jornadaInfo.resultadoLocal} - {jornadaInfo.resultadoVisitante}</p></>); break;
            default: infoContent = null;
        }
        return (<div style={styles.splashInfoBox}>{infoContent}{jornadaInfo.splashMessage && <p style={styles.splashAdminMessage}>"{jornadaInfo.splashMessage}"</p>}</div>);
    };
    const statCards = stats ? [
        <div key="apostado" style={styles.statCard}><div style={styles.statValue}>{stats.apostadoCount}/{JUGADORES.length}</div><div style={styles.statLabel}>Han apostado</div><div style={styles.splashStatDescription}>{stats.sinApostar} jugador(es) pendiente(s)</div></div>,
        <div key="goleador" style={styles.statCard}><img src={plantilla.find(j => j.nombre === stats.goleadorMasVotado)?.imageUrl || 'https://placehold.co/60x60/1b263b/e0e1dd?text=?'} alt={stats.goleadorMasVotado} style={styles.splashStatImage} onError={(e) => { e.target.src = 'https://placehold.co/60x60/1b263b/e0e1dd?text=?'; }} /><div style={styles.statValue}>{stats.goleadorMasVotado || '-'}</div><div style={styles.statLabel}>Goleador más elegido</div></div>,
        <div key="resultado" style={styles.statCard}><div style={styles.statValue}>{stats.resultadoMasVotado || '-'}</div><div style={styles.statLabel}>Resultado más común</div></div>,
        <div key="joker" style={styles.statCard}><div style={styles.statValue}>🃏 {stats.jokersActivos}</div><div style={styles.statLabel}>Jokers Activados</div><div style={styles.splashStatDescription}>¡Apuestas extra en juego!</div></div>
    ] : [];
    return (<><div style={styles.splashContainer}><div style={styles.splashLogoContainer}><img src="https://upload.wikimedia.org/wikipedia/en/thumb/2/20/UD_Las_Palmas_logo.svg/1200px-UD_Las_Palmas_logo.svg.png" alt="UD Las Palmas Logo" style={styles.splashLogo} /><div style={styles.splashTitleContainer}><span style={styles.splashTitle}>PORRA UDLP</span><span style={styles.splashYear}>2026</span></div></div>{loading ? <LoadingSkeleton type="splash" /> : renderJornadaInfo()}{jornadaInfo?.type === 'activa' && stats && (<div style={styles.statsCarouselContainer}><div style={{...styles.statsCarouselTrack, transform: `translateX(-${currentStatIndex * 25}%)`}}>{statCards.map((card, index) => <div key={index} style={styles.statCardWrapper}>{card}</div>)}</div></div>)}<button onClick={onEnter} style={styles.mainButton}>ENTRAR</button>{isMobile && (<button onClick={() => setShowInstallGuide(true)} style={styles.installButton}>¿Cómo instalar la App?</button>)}</div>{showInstallGuide && <InstallGuideModal onClose={() => setShowInstallGuide(false)} />}</>);
};

const LoginScreen = ({ onLogin, userProfiles, onlineUsers }) => {
    const [hoveredUser, setHoveredUser] = useState(null); const [recentUsers, setRecentUsers] = useState([]);
    useEffect(() => { const storedUsers = localStorage.getItem('recentPorraUsers'); if (storedUsers) setRecentUsers(JSON.parse(storedUsers)); }, []);
    const handleSelectUser = (jugador) => { const updatedRecentUsers = [jugador, ...recentUsers.filter(u => u !== jugador)].slice(0, 3); setRecentUsers(updatedRecentUsers); localStorage.setItem('recentPorraUsers', JSON.stringify(updatedRecentUsers)); onLogin(jugador); };
    const sortedJugadores = useMemo(() => { const remainingJugadores = JUGADORES.filter(j => !recentUsers.includes(j)); return [...recentUsers, ...remainingJugadores]; }, [recentUsers]);
    const getBadgeStyle = (profile) => {
        if (!profile?.badges?.length) return {}; const highestPriorityBadge = profile.badges.map(key => ({ key, ...BADGE_DEFINITIONS[key] })).filter(b => b.name && b.style).sort((a, b) => a.priority - b.priority)[0];
        if (highestPriorityBadge) { let animationProps = '2s infinite alternate'; if(highestPriorityBadge.style === 'pleno-flash') animationProps = '0.5s ease-in-out 3'; if(highestPriorityBadge.style === 'cold-streak') animationProps = '1.5s infinite'; return { animation: `${highestPriorityBadge.style}-animation ${animationProps}` }; }
        return {};
    };
    return (<div style={styles.loginContainer}><h2 style={styles.title}>SELECCIONA TU PERFIL</h2><div style={styles.userList}>{sortedJugadores.map(jugador => { const profile = userProfiles[jugador] || {}; const isOnline = onlineUsers[jugador]; const isRecent = recentUsers.includes(jugador); const isGradient = typeof profile.color === 'string' && profile.color.startsWith('linear-gradient'); const lastSeenText = !isOnline ? formatLastSeen(profile.ultimaConexion) : null; const badgeStyle = getBadgeStyle(profile); const buttonStyle = { ...styles.userButton, ...(hoveredUser === jugador && styles.userButtonHover), ...(isOnline && styles.userButtonOnline), ...badgeStyle }; const circleStyle = { ...styles.loginProfileIconCircle, ...(isGradient ? { background: profile.color } : { backgroundColor: profile.color || styles.colors.blue }) };
        return (<button key={jugador} onClick={() => handleSelectUser(jugador)} style={buttonStyle} onMouseEnter={() => setHoveredUser(jugador)} onMouseLeave={() => setHoveredUser(null)}>{isRecent && <div style={styles.recentUserIndicator}>★</div>}<div style={circleStyle}>{profile.icon || '?'}</div><div style={styles.loginUserInfo}><span>{jugador}</span>{isOnline && <span style={styles.onlineStatusText}>Online</span>}{lastSeenText && <span style={styles.lastSeenText}>{lastSeenText}</span>}</div></button>);
    })}</div></div>);
};

// ... ALL OTHER SCREEN AND HELPER COMPONENTS MUST BE DEFINED HERE ...

// ============================================================================
// --- PANTALLA PRINCIPAL Y ROUTING (COMPONENTE APP AL FINAL) ---
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
    const anonymousUserRef = useRef(null);

    const [globalStats, setGlobalStats] = useState(null);
    const [tickerStats, setTickerStats] = useState([]);
    const [isTickerPaused, setIsTickerPaused] = useState(false);

    const calculateAndSaveGlobalStats = useCallback(async () => {
        console.log("Iniciando cálculo de estadísticas globales...");
        const qJornadas = query(collection(db, "jornadas"), where("estado", "==", "Finalizada"));
        const jornadasSnap = await getDocs(qJornadas);
        const jornadas = jornadasSnap.docs.map(j => ({ id: j.id, ...j.data() }));
        if (jornadas.length === 0) { console.log("No hay jornadas finalizadas."); return; }
        const allPronosticos = {};
        for (const j of jornadas) { const pronosSnap = await getDocs(collection(db, "pronosticos", j.id, "jugadores")); allPronosticos[j.id] = pronosSnap.docs.map(d => ({ ...d.data(), id: d.id })); }
        let stats = { reyMidas: { jugador: null, valor: 0 }, elPelotazo: { jugador: null, valor: 0, jornada: null }, elAtrevido: { jugador: null, valor: 0 }, mrRegularidad: { jugador: null, valor: 0 }, elProfeta: { jugador: null, valor: 0 }, elVisionario: { jugador: null, valor: 0 }, elCenizo: { jugador: null, valor: 0 }, elObstinado: { jugador: null, valor: 0, resultado: '' }, };
        const playerStats = {}; JUGADORES.forEach(j => { playerStats[j] = { money: 0, atrevidoCount: 0, jornadasPuntuando: 0, goleadorCount: 0, rachaActual: 0, rachaMaxima: 0, malaRachaActual: 0, malaRachaMaxima: 0, resultados: {} }; });
        const sortedJornadas = [...jornadas].sort((a, b) => a.numeroJornada - b.numeroJornada);
        for (const j of sortedJornadas) {
            const pronosJornada = allPronosticos[j.id] || []; const coste = j.esVip ? APUESTA_VIP : APUESTA_NORMAL; const premio = j.ganadores?.length > 0 ? (((j.bote || 0) + (pronosJornada.length * coste)) / j.ganadores.length) : 0;
            for (const jugador of JUGADORES) {
                const p = pronosJornada.find(pr => pr.id === jugador);
                if (!p) { playerStats[jugador].rachaActual = 0; playerStats[jugador].malaRachaActual = 0; continue; }
                if (j.ganadores?.includes(jugador)) playerStats[jugador].money += premio;
                const puntos = p.puntosObtenidos || 0; if (puntos > (stats.elPelotazo.valor || 0)) { stats.elPelotazo = { jugador, valor: puntos, jornada: j.numeroJornada }; }
                if (j.ganadores?.includes(jugador)) { const miResultado = `${p.golesLocal}-${p.golesVisitante}`; const esUnico = pronosJornada.filter(pr => `${pr.golesLocal}-${pr.golesVisitante}` === miResultado).length === 1; if (esUnico) playerStats[jugador].atrevidoCount++; }
                if (puntos > 0) { playerStats[jugador].jornadasPuntuando++; playerStats[jugador].rachaActual++; playerStats[jugador].malaRachaActual = 0; } else { playerStats[jugador].rachaActual = 0; playerStats[jugador].malaRachaActual++; }
                if (playerStats[jugador].rachaActual > playerStats[jugador].rachaMaxima) playerStats[jugador].rachaMaxima = playerStats[jugador].rachaActual; if (playerStats[jugador].malaRachaActual > playerStats[jugador].malaRachaMaxima) playerStats[jugador].malaRachaMaxima = playerStats[jugador].malaRachaActual;
                const goleadorReal = (j.goleador || '').trim().toLowerCase(); const goleadorApostado = (p.goleador || '').trim().toLowerCase(); if ((p.sinGoleador && (goleadorReal === "sg" || goleadorReal === "")) || (!p.sinGoleador && goleadorApostado !== "" && goleadorApostado === goleadorReal)) { playerStats[jugador].goleadorCount++; }
                const resultadoStr = `${p.golesLocal}-${p.golesVisitante}`; playerStats[jugador].resultados[resultadoStr] = (playerStats[jugador].resultados[resultadoStr] || 0) + 1;
            }
        }
        JUGADORES.forEach(jugador => {
            if (playerStats[jugador].money > stats.reyMidas.valor) stats.reyMidas = { jugador, valor: playerStats[jugador].money.toFixed(2) }; if (playerStats[jugador].atrevidoCount > stats.elAtrevido.valor) stats.elAtrevido = { jugador, valor: playerStats[jugador].atrevidoCount }; if (playerStats[jugador].jornadasPuntuando > stats.mrRegularidad.valor) stats.mrRegularidad = { jugador, valor: playerStats[jugador].jornadasPuntuando }; if (playerStats[jugador].goleadorCount > stats.elProfeta.valor) stats.elProfeta = { jugador, valor: playerStats[jugador].goleadorCount }; if (playerStats[jugador].rachaMaxima > stats.elVisionario.valor) stats.elVisionario = { jugador, valor: playerStats[jugador].rachaMaxima }; if (playerStats[jugador].malaRachaMaxima > stats.elCenizo.valor) stats.elCenizo = { jugador, valor: playerStats[jugador].malaRachaMaxima };
            const [resultado, count] = Object.entries(playerStats[jugador].resultados).sort((a, b) => b[1] - a[1])[0] || [null, 0]; if (count > stats.elObstinado.valor) stats.elObstinado = { jugador, valor: count, resultado };
        });
        const finalStats = { ...stats, elObstinado: { ...stats.elObstinado, valor: `${stats.elObstinado.resultado} (${stats.elObstinado.valor} veces)` } };
        await setDoc(doc(db, "configuracion", "globalStats"), finalStats); setGlobalStats(finalStats); console.log("Estadísticas globales actualizadas.", finalStats);
    }, []);

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => { if (user && !user.isAnonymous) setIsAdminAuthenticated(true); else if (user && user.isAnonymous) { anonymousUserRef.current = user; setIsAdminAuthenticated(false); } else signInAnonymously(auth).catch((error) => console.error("Error de autenticación anónima:", error)); });
        const styleSheet = document.createElement("style"); styleSheet.innerText = `@import url('https://fonts.googleapis.com/css2?family=Teko:wght@700&family=Orbitron&family=Exo+2&family=Russo+One&display=swap'); * { margin: 0; padding: 0; box-sizing: border-box; } html { font-size: 16px !important; -webkit-text-size-adjust: 100%; } body, #root { width: 100%; min-width: 100%; overflow-x: hidden; } .vip-active { --glow-color: ${colors.gold}; --main-color: ${colors.gold}; --secondary-color: ${colors.yellow}; } .vip-active #app-container { border-color: var(--glow-color); box-shadow: 0 0 25px var(--glow-color), inset 0 0 15px var(--glow-color); } .vip-active .app-title, .vip-active h3, .vip-active h4 { color: var(--main-color); text-shadow: 0 0 8px var(--glow-color); } .vip-active .navbar { border-bottom-color: var(--main-color); } .vip-active .nav-button-active { border-bottom-color: var(--secondary-color); color: var(--secondary-color); } .vip-active .main-button { background-color: var(--main-color); border-color: var(--secondary-color); box-shadow: 0 0 20px var(--glow-color); animation: vip-pulse 2s infinite; } @keyframes vip-pulse { 0% { box-shadow: 0 0 15px ${colors.gold}50; } 50% { box-shadow: 0 0 25px ${colors.gold}90; } 100% { box-shadow: 0 0 15px ${colors.gold}50; } } @keyframes champion-glow-animation { 0%, 100% { text-shadow: 0 0 8px ${colors.gold}, 0 0 15px ${colors.gold}; } 50% { text-shadow: 0 0 12px ${colors.gold}, 0 0 25px ${colors.gold}; } } @keyframes pleno-flash-animation { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.15); } } @keyframes leader-glow-animation { 0%, 100% { background-color: rgba(255, 215, 0, 0.15); box-shadow: inset 0 0 15px rgba(255, 215, 0, 0.5), 0 0 10px rgba(255, 215, 0, 0.3); } 50% { background-color: rgba(255, 215, 0, 0.25); box-shadow: inset 0 0 20px rgba(255, 215, 0, 0.7), 0 0 15px rgba(255, 215, 0, 0.5); } } @keyframes fire-streak-animation { 0%, 100% { text-shadow: 0 0 5px #fca311, 0 0 10px #e63946; } 50% { text-shadow: 0 0 10px #fca311, 0 0 20px #e63946; } } @keyframes cold-streak-animation { 0%, 100% { text-shadow: 0 0 8px #00aaff, 0 0 15px #00aaff, 0 0 20px #00aaff80; } 50% { text-shadow: 0 0 12px #00aaff, 0 0 25px #00aaff, 0 0 30px #00aaff80; } } @keyframes fall { 0% { transform: translateY(-100px) rotate(0deg); opacity: 1; } 100% { transform: translateY(100vh) rotate(360deg); opacity: 0; } } .exploded { transition: transform 1s ease-out, opacity 1s ease-out; } @keyframes trophy-grow { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } } @keyframes text-fade-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } } @keyframes highlight { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } } @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } } @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } } @keyframes slideInFromRight { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } } .content-enter-active { animation: slideInFromRight 0.4s ease-out; } @keyframes pop-in { 0% { opacity: 0; transform: scale(0.8); } 100% { opacity: 1; transform: scale(1); } } .stats-indicator { animation: pop-in 0.5s cubic-bezier(0.25, 1, 0.5, 1) forwards; } @keyframes confetti-fall { 0% { transform: translateY(-100vh) rotate(0deg); } 100% { transform: translateY(100vh) rotate(var(--angle)); } } .confetti-particle { position: absolute; width: var(--size); height: var(--size); background-color: var(--color); top: 0; left: var(--x); animation: confetti-fall 5s linear var(--delay) infinite; } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } .spinner { animation: spin 1.5s linear infinite; } @keyframes title-shine { 0% { background-position: -200% center; } 100% { background-position: 200% center; } } @keyframes blink-live { 50% { background-color: #a11d27; } } @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } } @keyframes point-jump-up { 0% { transform: translateY(0); color: ${colors.lightText}; } 50% { transform: translateY(-10px) scale(1.2); color: ${colors.success}; } 100% { transform: translateY(0); color: ${colors.lightText}; } } .point-jump-up { animation: point-jump-up 0.7s ease-out; } .stat-fade-in { animation: fadeIn 0.5s ease-in-out; } @keyframes bounce-in { 0% { transform: scale(0); opacity: 0; } 60% { transform: scale(1.2); opacity: 1; } 100% { transform: scale(1); } } @keyframes pulse-once { 0% { transform: scale(1); } 50% { transform: scale(1.3); } 100% { transform: scale(1); } } .pulsed { animation: pulse-once 0.4s ease-in-out; } @keyframes pie-draw { to { stroke-dashoffset: 0; } } .pie-chart-segment-new { transform-origin: 60px 60px; stroke-dasharray: var(--stroke-dasharray); stroke-dashoffset: var(--stroke-dasharray); transform: rotate(var(--rotation)); animation: pie-draw 1s ease-out forwards; } @keyframes reaction-fade-out { to { opacity: 0; transform: scale(0.5); } } .fade-out { animation: reaction-fade-out 0.5s forwards; } @keyframes reaction-fly { 0% { transform: translate(0, 0) scale(1.2); opacity: 1; } 100% { transform: translate(80px, -80px) scale(0); opacity: 0; } } .fly-away { display: inline-block; animation: reaction-fly 1s cubic-bezier(0.5, -0.5, 1, 1) forwards; position: absolute; z-index: 10; pointer-events: none; } @keyframes status-blink-red { 0%, 100% { background-color: ${colors.danger}; box-shadow: 0 0 8px ${colors.danger}; } 50% { background-color: #a11d27; box-shadow: 0 0 15px ${colors.danger}; } } @keyframes status-pulse-green { 0%, 100% { background-color: ${colors.success}; box-shadow: 0 0 5px ${colors.success}; } 50% { background-color: #3a9a6a; box-shadow: 0 0 10px ${colors.success}; } } .stat-value-animation { animation: pop-in 0.5s ease-out; } @keyframes pulse-animation-kf { 0% { box-shadow: 0 0 0 0 rgba(255, 200, 44, 0.7); } 70% { box-shadow: 0 0 10px 15px rgba(255, 200, 44, 0); } 100% { box-shadow: 0 0 0 0 rgba(255, 200, 44, 0); } } .pulse-animation { border-color: ${colors.yellow}; animation: pulse-animation-kf 1s ease-out; } @keyframes live-dot-kf { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } } .live-dot-animation { animation: live-dot-kf 1.5s infinite; } @keyframes silver-glow { 0%, 100% { background-color: rgba(192, 192, 192, 0.15); box-shadow: inset 0 0 15px rgba(192, 192, 192, 0.5), 0 0 10px rgba(192, 192, 192, 0.3); } 50% { background-color: rgba(192, 192, 192, 0.25); box-shadow: inset 0 0 20px rgba(192, 192, 192, 0.7), 0 0 15px rgba(192, 192, 192, 0.5); } } @keyframes bronze-glow { 0%, 100% { background-color: rgba(205, 127, 50, 0.15); box-shadow: inset 0 0 15px rgba(205, 127, 50, 0.5), 0 0 10px rgba(205, 127, 50, 0.3); } 50% { background-color: rgba(205, 127, 50, 0.25); box-shadow: inset 0 0 20px rgba(205, 127, 50, 0.7), 0 0 15px rgba(205, 127, 50, 0.5); } } @keyframes user-highlight-glow { 0%, 100% { background-color: rgba(0, 85, 164, 0.5); box-shadow: inset 0 0 15px rgba(0, 85, 164, 1), 0 0 10px rgba(0, 85, 164, 0.7); } 50% { background-color: rgba(0, 85, 164, 0.7); box-shadow: inset 0 0 20px rgba(0, 85, 164, 1), 0 0 15px rgba(0, 85, 164, 1); } } @keyframes ticker-scroll { 0% { transform: translateX(0%); } 100% { transform: translateX(-50%); } } .news-ticker-content { animation-play-state: ${isTickerPaused ? 'paused' : 'running'}; }`;
        document.head.appendChild(styleSheet);
        const unsubConfig = onSnapshot(doc(db, "configuracion", "porraAnual"), (doc) => setPorraAnualConfig(doc.exists() ? doc.data() : null));
        const unsubEscudos = onSnapshot(doc(db, "configuracion", "escudos"), (docSnap) => { if (docSnap.exists()) setTeamLogos(docSnap.data()); });
        const unsubPlantilla = onSnapshot(doc(db, "configuracion", "plantilla"), (docSnap) => { if (docSnap.exists() && docSnap.data().jugadores?.length > 0) setPlantilla(docSnap.data().jugadores); });
        const unsubProfiles = onSnapshot(collection(db, "clasificacion"), (snapshot) => { const profiles = {}; snapshot.forEach(doc => { profiles[doc.id] = doc.data(); }); setUserProfiles(profiles); });
        const unsubStatus = onValue(ref(rtdb, 'status/'), (snapshot) => setOnlineUsers(snapshot.val() || {}));
        const unsubLive = onSnapshot(query(collection(db, "jornadas"), where("liveData.isLive", "==", true), limit(1)), (snapshot) => { if (!snapshot.empty) { const j = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() }; setLiveJornada(j); setIsVipActive(j.esVip || false); } else { setLiveJornada(null); onSnapshot(query(collection(db, "jornadas"), where("estado", "in", ["Abierta", "Pre-apertura"]), limit(1)), (snap) => setIsVipActive(!snap.empty && snap.docs[0].data().esVip)); } });
        const unsubJornadasStats = onSnapshot(collection(db, "jornadas"), (snapshot) => { snapshot.docChanges().forEach((change) => { if (change.type === "modified" && change.doc.data().estado === 'Finalizada' && change.doc.data().estado !== snapshot.docChanges().find(c=>c.doc.id === change.doc.id)?.doc.before.data()?.estado) { console.log(`Jornada ${change.doc.id} finalizada. Recalculando stats.`); calculateAndSaveGlobalStats(); } }); });
        getDoc(doc(db, "configuracion", "globalStats")).then(docSnap => { if(docSnap.exists()) setGlobalStats(docSnap.data()); else calculateAndSaveGlobalStats(); });
        return () => { document.head.removeChild(styleSheet); unsubscribeAuth(); unsubConfig(); unsubEscudos(); unsubLive(); unsubPlantilla(); unsubProfiles(); unsubStatus(); unsubJornadasStats(); }
    }, [isTickerPaused, calculateAndSaveGlobalStats]);

    useEffect(() => {
        if (globalStats) {
            const tickerData = [
                { emoji: '🤑', titulo: 'El Rey Midas', jugador: globalStats.reyMidas.jugador, valor: globalStats.reyMidas.valor, unidad: '€' },
                { emoji: '💣', titulo: 'El Pelotazo', jugador: globalStats.elPelotazo.jugador, valor: globalStats.elPelotazo.valor, unidad: 'pts' },
                { emoji: '😎', titulo: 'El Atrevido', jugador: globalStats.elAtrevido.jugador, valor: globalStats.elAtrevido.valor, unidad: 'únicos' },
                { emoji: '📈', titulo: 'Mr. Regularidad', jugador: globalStats.mrRegularidad.jugador, valor: globalStats.mrRegularidad.valor, unidad: 'jornadas' },
                { emoji: '🔮', titulo: 'El Visionario', jugador: globalStats.elVisionario.jugador, valor: globalStats.elVisionario.valor, unidad: 'jornadas' },
                { emoji: '🎯', titulo: 'El Profeta', jugador: globalStats.elProfeta.jugador, valor: globalStats.elProfeta.valor, unidad: 'aciertos' },
                { emoji: '👻', titulo: 'El Cenizo', jugador: globalStats.elCenizo.jugador, valor: globalStats.elCenizo.valor, unidad: 'jornadas' },
                { emoji: '🔁', titulo: 'El Obstinado', jugador: globalStats.elObstinado.jugador, valor: globalStats.elObstinado.valor, unidad: '' },
            ].filter(s => s.jugador);
            setTickerStats(tickerData);
        }
    }, [globalStats]);
  
    const handleRequestPermission = async (user) => {
        setShowNotificationModal(false); localStorage.setItem('notificationPrompt_v3_seen', 'true'); 
        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') { const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY }); if (currentToken) await setDoc(doc(db, "notification_tokens", currentToken), { user: user, createdAt: new Date() }); }
        } catch (error) { console.error('Error al obtener token de notificación.', error); }
    };
  
    const handleLogin = async (user) => {
        try {
            setCurrentUser(user); const userStatusRef = ref(rtdb, 'status/' + user); await set(userStatusRef, true); onDisconnect(userStatusRef).set(false);
            const userProfileRef = doc(db, "clasificacion", user); await setDoc(userProfileRef, { ultimaConexion: serverTimestamp() }, { merge: true });
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
        } catch (error) { console.error("Error crítico durante el inicio de sesión:", error); alert("Ha ocurrido un error al iniciar sesión."); }
    };

    const handleLogout = async () => { if (currentUser) set(ref(rtdb, 'status/' + currentUser), false); if (isAdminAuthenticated) { await signOut(auth); await signInAnonymously(auth); } setCurrentUser(null); setScreen('login'); setIsAdminAuthenticated(false); };
    const handleSaveProfile = async (user, profileData) => { await setDoc(doc(db, "clasificacion", user), profileData, { merge: true }); setScreen('app'); setActiveTab('miJornada'); };
    const handleNavClick = (tab) => { setViewingJornadaId(null); setViewingPorraAnual(false); setActiveTab(tab); if (tab !== 'admin' && isAdminAuthenticated) signOut(auth).then(() => signInAnonymously(auth)); };
    const handleAdminClick = () => { if (isAdminAuthenticated) setActiveTab('admin'); else setShowAdminLogin(true); };
    const handleAdminLoginSuccess = () => { setIsAdminAuthenticated(true); setShowAdminLogin(false); setActiveTab('admin'); };
    const handleViewJornadaFromFame = (jornadaId) => { setViewingJornadaId(jornadaId); setActiveTab('calendario'); };

    const renderContent = () => {
        if (showInitialSplash) return <InitialSplashScreen onFinish={() => setShowInitialSplash(false)} />;
        if (screen === 'splash') return <SplashScreen onEnter={() => setScreen('login')} teamLogos={teamLogos} plantilla={plantilla} />;
        if (screen === 'login') return <LoginScreen onLogin={handleLogin} userProfiles={userProfiles} onlineUsers={onlineUsers} />;
        if (screen === 'customizeProfile') return <ProfileCustomizationScreen user={currentUser} onSave={handleSaveProfile} userProfile={userProfiles[currentUser] || {}} />;
        if (screen === 'app') {
            const isLive = liveJornada?.liveData?.isLive; const onlineCount = Object.values(onlineUsers).filter(Boolean).length; const showGreenStatus = !isLive && onlineCount > 1;
            const CurrentScreenComponent = () => {
                if (viewingJornadaId) return <JornadaDetalleScreen jornadaId={viewingJornadaId} onBack={() => setViewingJornadaId(null)} teamLogos={teamLogos} userProfiles={userProfiles} />;
                if (viewingPorraAnual) return <PorraAnualScreen user={currentUser} onBack={() => setViewingPorraAnual(false)} config={porraAnualConfig} />;
                if (activeTab === 'profile') return <ProfileScreen user={currentUser} userProfile={userProfiles[currentUser]} onEdit={() => setScreen('customizeProfile')} onBack={() => setActiveTab('miJornada')} />;
                switch (activeTab) {
                    case 'miJornada': return <MiJornadaScreen user={currentUser} setActiveTab={handleNavClick} teamLogos={teamLogos} liveData={liveJornada?.liveData} plantilla={plantilla} userProfiles={userProfiles} />;
                    case 'laJornada': return <LaJornadaScreen user={currentUser} teamLogos={teamLogos} liveData={liveJornada?.liveData} userProfiles={userProfiles} onlineUsers={onlineUsers} />;
                    case 'calendario': return <CalendarioScreen onViewJornada={setViewingJornadaId} teamLogos={teamLogos} />;
                    case 'clasificacion': return <ClasificacionScreen currentUser={currentUser} userProfiles={userProfiles} />;
                    case 'pagos': return <PagosScreen user={currentUser} userProfiles={userProfiles} />;
                    case 'paseoFama': return <PaseoDeLaFamaScreen userProfiles={userProfiles} globalStats={globalStats} onViewJornada={handleViewJornadaFromFame} />;
                    case 'admin': return isAdminAuthenticated ? <AdminPanelScreen teamLogos={teamLogos} plantilla={plantilla} setPlantilla={setPlantilla} onRecalculateStats={calculateAndSaveGlobalStats} /> : null;
                    default: return null;
                }
            };
            return (<>
                {showNotificationModal && <NotificationPermissionModal onAllow={() => handleRequestPermission(currentUser)} onDeny={() => {setShowNotificationModal(false); localStorage.setItem('notificationPrompt_v3_seen', 'true');}} />}
                {porraAnualConfig?.estado === 'Abierta' && !viewingPorraAnual && (!porraAnualConfig?.fechaCierre || new Date() < porraAnualConfig.fechaCierre.toDate()) && (<div style={styles.porraAnualBanner} onClick={() => setViewingPorraAnual(true)}>⭐ ¡PORRA ANUAL ABIERTA! ⭐ Haz o modifica tu pronóstico. ¡Pincha aquí!</div>)}
                <LiveBanner liveData={liveJornada?.liveData} jornada={liveJornada} />
                <nav style={styles.navbar} className="navbar"><button onClick={() => handleNavClick('miJornada')} style={activeTab === 'miJornada' ? styles.navButtonActive : styles.navButton} className={activeTab === 'miJornada' ? 'nav-button-active' : ''}>Mi Jornada</button><button onClick={() => handleNavClick('laJornada')} style={activeTab === 'laJornada' ? styles.navButtonActive : styles.navButton} className={activeTab === 'laJornada' ? 'nav-button-active' : ''}><div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>{isLive && <span style={styles.statusIndicatorRed}></span>}{showGreenStatus && <span style={styles.statusIndicatorGreen}></span>}La Jornada</div></button><button onClick={() => handleNavClick('calendario')} style={activeTab === 'calendario' ? styles.navButtonActive : styles.navButton} className={activeTab === 'calendario' ? 'nav-button-active' : ''}>Calendario</button><button onClick={() => handleNavClick('clasificacion')} style={activeTab === 'clasificacion' ? styles.navButtonActive : styles.navButton} className={activeTab === 'clasificacion' ? 'nav-button-active' : ''}>Clasificación</button><button onClick={() => handleNavClick('paseoFama')} style={activeTab === 'paseoFama' ? styles.navButtonActive : styles.navButton} className={activeTab === 'paseoFama' ? 'nav-button-active' : ''}>Paseo de la Fama</button><button onClick={() => handleNavClick('pagos')} style={activeTab === 'pagos' ? styles.navButtonActive : styles.navButton} className={activeTab === 'pagos' ? 'nav-button-active' : ''}>Pagos</button>{currentUser === 'Juanma' && (<button onClick={handleAdminClick} style={activeTab === 'admin' ? styles.navButtonActive : styles.navButton} className={activeTab === 'admin' ? 'nav-button-active' : ''}>Admin</button>)}<button onClick={() => handleNavClick('profile')} style={styles.profileNavButton}><PlayerProfileDisplay name={currentUser} profile={userProfiles[currentUser]} /></button><button onClick={handleLogout} style={styles.logoutButton}>Salir</button></nav>
                <div key={activeTab} className="content-enter-active" style={styles.content}><CurrentScreenComponent /></div>
                {showAdminLogin && <AdminLoginModal onClose={() => setShowAdminLogin(false)} onSuccess={handleAdminLoginSuccess} />}
            </>);
        }
    };
    return (<>{winnerData && <WinnerAnimation winnerData={winnerData} onClose={() => setWinnerData(null)} />}<div id="app-container" className={isVipActive ? 'vip-active' : ''} style={styles.container}><div style={{...styles.card, paddingBottom: activeTab !== 'paseoFama' && tickerStats.length > 0 ? '60px' : '25px'}} id="app-card">{renderContent()}</div>{activeTab !== 'paseoFama' && tickerStats.length > 0 && <NewsTicker stats={tickerStats} onHoverChange={setIsTickerPaused} />}</div></>);
}

export default App;

