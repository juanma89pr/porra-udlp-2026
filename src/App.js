/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword, signInWithCustomToken, signOut } from "firebase/auth";
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
    "RCD Espanyol", "Valencia CF", "Leganés", "CA Osasuna",
    "Real Valladolid", "Racing de Santander", "RC Deportivo", "Málaga CF"
];

// API Football config
const API_FOOTBALL_KEY = process.env.REACT_APP_API_FOOTBALL_KEY || "";
const LEAGUE_ID_SEGUNDA = 141;
const LEAGUE_ID_PRIMERA = 140;
const SEASON = 2025; // temporada 2025-26 en API-Football = 26/27 real

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
// Team ID en API-Football: 275 (UD Las Palmas)
const API_TEAM_ID_UDLP = 275;
// Plantilla oficial UD Las Palmas 26/27
// Fuente: pretemporada Marbella (22/07/2026) + dorsales Transfermarkt 26/27
// Solo jugadores con dorsal de primera plantilla confirmado
// Cristian Gutiérrez cedido al Cádiz (09/08/2026) — excluido
const PLANTILLA_FALLBACK = [
    // PORTEROS
    { dorsal:"1",  nombre:"Dinko Horkas",       posicion:"Portero",        apiId:430567 },
    { dorsal:"13", nombre:"José Antonio Caro",  posicion:"Portero",        apiId:0 },
    { dorsal:"33", nombre:"Adri Suárez",        posicion:"Portero",        apiId:0 },
    // DEFENSAS
    { dorsal:"2",  nombre:"Marvin Park",        posicion:"Defensa",        apiId:324219 },
    { dorsal:"5",  nombre:"Viti Rozada",        posicion:"Defensa",        apiId:0 },
    { dorsal:"4",  nombre:"Álex Suárez",        posicion:"Defensa",        apiId:289254 },
    { dorsal:"15", nombre:"Juanma Herzog",      posicion:"Defensa",        apiId:284516 },
    { dorsal:"23", nombre:"Valentín Pezzolesi", posicion:"Defensa",        apiId:0 },
    { dorsal:"17", nombre:"Enrique Clemente",   posicion:"Defensa",        apiId:0 },
    // CENTROCAMPISTAS
    { dorsal:"12", nombre:"Sergio Ruiz",        posicion:"Centrocampista", apiId:0 },
    { dorsal:"20", nombre:"Kirian Rodríguez",   posicion:"Centrocampista", apiId:37073 },
    { dorsal:"26", nombre:"Enzo Loiodice",      posicion:"Centrocampista", apiId:290060 },
    { dorsal:"8",  nombre:"Mateo Acimovic",     posicion:"Centrocampista", apiId:0 },
    { dorsal:"11", nombre:"Iñaki González",     posicion:"Centrocampista", apiId:286026 },
    { dorsal:"16", nombre:"Edward Cedeño",      posicion:"Centrocampista", apiId:0 },
    // ATACANTES / MEDIAPUNTA
    { dorsal:"14", nombre:"Manu Fuster",        posicion:"Mediapunta",     apiId:289255 },
    { dorsal:"22", nombre:"Taisei Miyashiro",   posicion:"Mediapunta",     apiId:320742 },
    { dorsal:"10", nombre:"Ale García",         posicion:"Mediapunta",     apiId:0 },
    // DELANTEROS
    { dorsal:"9",  nombre:"Jeremía Recoba",     posicion:"Delantero",      apiId:366988 },
    { dorsal:"19", nombre:"Jesé Rodríguez",     posicion:"Delantero",      apiId:1831 },
    { dorsal:"14", nombre:"Sandro Ramírez",     posicion:"Delantero",      apiId:18892 },
    { dorsal:"41", nombre:"Elías Romero",       posicion:"Delantero",      apiId:0 },
].map(function(j) {
    return {
        ...j,
        imageUrl: j.apiId > 0
            ? 'https://media.api-sports.io/football/players/' + j.apiId + '.png'
            : 'https://ui-avatars.com/api/?name=' + encodeURIComponent(j.nombre) + '&background=001F6B&color=FFD700&size=80&bold=true&font-size=0.4'
    };
});

// ============================================================================
// --- ESTILOS PREMIUM ---
// ============================================================================
const colors = {
    deepBlue: '#001F6B', blue: '#001F6B', golden: '#FFD700', goldenDark: '#d4af37', yellow: '#FFD700', gold: '#FFD700', silver: '#555555',
    lightText: '#0a0a0a', darkText: '#0a0a0a', danger: '#e63946', success: '#10b981', warning: '#d4af37',
    darkUI: '#ffffff', darkUIAlt: '#f5f5f5',
    status: { 'Próximamente': '#6c757d', 'Pre-apertura': '#d4af37', 'Abierta': '#10b981', 'Cerrada': '#e63946', 'En vivo': '#dc3545', 'Finalizada': '#d4af37' }
};

const styles = {
    colors,
    container: { display: 'flex', flexDirection: 'column', width: '100%', minHeight: '100dvh', background: 'linear-gradient(160deg,#f8f9ff 0%,#eef1fa 100%)', fontFamily: "'Teko', sans-serif" },
    card: { width: '100%', flex: 1, backgroundColor: 'transparent', color: '#0a0a0a', padding: '0', minHeight: '100dvh' },
    title: { fontFamily: "'Teko', sans-serif", color: colors.deepBlue, textTransform: 'uppercase', letterSpacing: '2px', textAlign: 'center', borderBottom: `2px solid ${colors.golden}`, paddingBottom: '10px', marginBottom: '20px', fontSize: 'clamp(1.6rem, 5vw, 2.2rem)', fontWeight: 700 },
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
    jokerInput: { width: '45px', textAlign: 'center', padding: '10px', border: `1px solid ${colors.golden}`, borderRadius: '8px', backgroundColor: '#fff', color: '#0a0a0a', fontSize: '1.2rem', fontFamily: "'Oswald', sans-serif" },
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
    
    if (!exactoAcertado && pronostico.jokerActivo && pronostico.jokerPronosticos) {
        for (let jp of pronostico.jokerPronosticos) {
            if (jp.local !== '' && jp.visitante !== '') {
                const jpL = parseInt(jp.local); const jpV = parseInt(jp.visitante);
                if (gL === jpL && gV === jpV) { exactoAcertado = true; break; }
            }
        }
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
const EMOJIS_PERFIL = {
    "Animales": ["🦁","🐯","🦊","🐺","🦅","🦆","🐬","🦋","🦖","🦁"],
    "Deportes": ["⚽","🏆","🎯","🥊","🎱","🏇","🎳","⛷️","🏄","🤺"],
    "Astros":   ["🌟","⭐","🌙","☀️","🌈","⚡","❄️","🔥","💫","🌊"],
    "Caras":    ["😎","🤩","😤","🥶","🤯","😈","👑","🎭","🧠","💪"],
    "Símbolos": ["🔵","🟡","🔴","⚫","🟠","🟢","🟣","🔶","🔷","♾️"],
};

// Componente de avatar de jugador con burbuja de El Otro
const PlayerAvatar = ({ name, perfil, elOtroData, size = 40, showElOtro = false }) => {
    var emoji = (perfil && perfil.emoji) || '❓';
    var elOtroEquipo = elOtroData && elOtroData.equipo;
    var elOtroRevelado = elOtroData && elOtroData.revelado;
    
    return (
        <div style={{position:'relative', display:'inline-flex', flexDirection:'column', alignItems:'center', gap:4}}>
            <div style={{position:'relative'}}>
                <div style={{
                    width: size, height: size, borderRadius: '50%',
                    background: '#FFD700', display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize: size * 0.45, border: '2px solid rgba(0,31,107,0.15)',
                    boxShadow: '0 2px 8px rgba(0,31,107,0.12)'
                }}>
                    {emoji}
                </div>
                {/* Burbuja de El Otro */}
                {showElOtro && elOtroEquipo && (
                    <div style={{
                        position: 'absolute', top: -6, right: -6,
                        width: size * 0.45, height: size * 0.45, borderRadius: '50%',
                        background: '#001F6B', border: '1.5px solid #FFD700',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: size * 0.18,
                    }}>
                        {elOtroRevelado ? '🛡️' : '❓'}
                    </div>
                )}
            </div>
            <span style={{
                fontFamily:"'Teko',sans-serif", fontSize: size * 0.28,
                letterSpacing: 1, color:'#001F6B', textTransform:'uppercase',
                maxWidth: size * 2.5, textAlign:'center', lineHeight: 1
            }}>{name}</span>
        </div>
    );
};

const PlayerProfileDisplay = ({ name, profile, defaultColor = styles.colors.lightText, isOnline = false }) => {
    const p = profile || {}; const color = p.color || defaultColor; const isG = typeof color === 'string' && color.startsWith('linear-gradient');
    const nStyle = { ...(isG ? { background: color, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } : { color }), fontWeight: 'bold' };
    return (<span style={{display: 'inline-flex', alignItems: 'center', gap: '8px' }}>{p.icon && <span>{p.icon}</span>}<span style={nStyle}>{name}</span>{isOnline && <span style={{width: '8px', height: '8px', backgroundColor: styles.colors.success, borderRadius: '50%', boxShadow: `0 0 8px ${styles.colors.success}`}}></span>}</span>);
};

// ============================================================================
// --- PERFIL — Edición de emoji y apodo ---
// ============================================================================
const PerfilScreen = ({ currentUser }) => {
    var G = styles.colors;
    var [perfil, setPerfil] = useState({ emoji: '❓', apodo: '' });
    var [guardado, setGuardado] = useState(false);
    var [guardando, setGuardando] = useState(false);
    var [categoriaActiva, setCategoriaActiva] = useState('Animales');
    var [paso, setPaso] = useState(1); // 1=emoji, 2=apodo, 3=confirmado

    useEffect(function() {
        if (!currentUser) return;
        getDoc(doc(db, "perfiles", currentUser)).then(function(snap) {
            if (snap.exists() && snap.data().emoji) {
                setPerfil(snap.data());
                setPaso(3);
                setGuardado(true);
            }
        });
    }, [currentUser]);

    var guardar = async function() {
        if (!perfil.emoji || perfil.emoji === '❓') return;
        setGuardando(true);
        try {
            await setDoc(doc(db, "perfiles", currentUser), {
                nombre: currentUser,
                emoji: perfil.emoji,
                apodo: perfil.apodo || currentUser,
                actualizadoEn: serverTimestamp()
            }, { merge: true });
            setGuardado(true);
            setPaso(3);
        } catch(e) { console.error(e); }
        setGuardando(false);
    };

    return (
        <div style={{paddingBottom:40}}>
            <h2 style={styles.title}>MI PERFIL</h2>

            {/* Vista previa del avatar */}
            <div style={{textAlign:'center',marginBottom:28}}>
                <div style={{display:'inline-flex',flexDirection:'column',alignItems:'center',gap:8,
                    background:'#fff',borderRadius:20,padding:24,border:'1px solid rgba(0,31,107,0.08)'}}>
                    <div style={{width:80,height:80,borderRadius:'50%',background:'#FFD700',
                        display:'flex',alignItems:'center',justifyContent:'center',
                        fontSize:42,border:'3px solid rgba(0,31,107,0.15)',
                        boxShadow:'0 4px 16px rgba(0,31,107,0.15)'}}>
                        {perfil.emoji}
                    </div>
                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:20,fontWeight:700,color:G.deepBlue,letterSpacing:2,textTransform:'uppercase'}}>
                        {perfil.apodo || currentUser}
                    </p>
                    {guardado && <span style={{fontFamily:"'Inter',sans-serif",fontSize:10,color:'#10b981',letterSpacing:2,textTransform:'uppercase'}}>✓ Guardado</span>}
                </div>
            </div>

            {/* Paso 1: Elegir emoji */}
            <div style={{background:'#fff',borderRadius:16,padding:20,border:'1px solid rgba(0,31,107,0.08)',marginBottom:16}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
                    <div style={{width:28,height:28,borderRadius:'50%',background: paso>=1?'#001F6B':'rgba(0,31,107,0.1)',
                        display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        <span style={{fontFamily:"'Teko',sans-serif",fontSize:14,color: paso>=1?'#FFD700':'rgba(0,31,107,0.3)',fontWeight:700}}>1</span>
                    </div>
                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:16,letterSpacing:2,color:G.deepBlue,textTransform:'uppercase',fontWeight:700}}>
                        Elige tu emoji
                    </p>
                </div>

                {/* Categorías */}
                <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:14}}>
                    {Object.keys(EMOJIS_PERFIL).map(function(cat) {
                        return (
                            <button key={cat} onClick={function() { setCategoriaActiva(cat); }}
                                style={{padding:'6px 14px',borderRadius:20,border:'none',cursor:'pointer',
                                    fontFamily:"'Inter',sans-serif",fontSize:11,fontWeight:600,
                                    background: categoriaActiva===cat ? G.deepBlue : '#f0f0f0',
                                    color: categoriaActiva===cat ? '#FFD700' : G.deepBlue}}>
                                {cat}
                            </button>
                        );
                    })}
                </div>

                {/* Grid de emojis */}
                <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10}}>
                    {EMOJIS_PERFIL[categoriaActiva].map(function(em, i) {
                        var sel = perfil.emoji === em;
                        return (
                            <button key={i} onClick={function() { setPerfil(function(p) { return {...p, emoji: em}; }); if(paso<2) setPaso(2); setGuardado(false); }}
                                style={{padding:12,borderRadius:14,border: sel?'2.5px solid #001F6B':'1.5px solid rgba(0,31,107,0.1)',
                                    background: sel?'rgba(0,31,107,0.06)':'#f8f8f8',
                                    fontSize:28,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
                                    boxShadow: sel?'0 0 0 3px rgba(0,31,107,0.1)':'none'}}>
                                {em}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Paso 2: Apodo */}
            {paso >= 2 && (
                <div style={{background:'#fff',borderRadius:16,padding:20,border:'1px solid rgba(0,31,107,0.08)',marginBottom:16}}>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
                        <div style={{width:28,height:28,borderRadius:'50%',background:'#001F6B',
                            display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                            <span style={{fontFamily:"'Teko',sans-serif",fontSize:14,color:'#FFD700',fontWeight:700}}>2</span>
                        </div>
                        <p style={{fontFamily:"'Teko',sans-serif",fontSize:16,letterSpacing:2,color:G.deepBlue,textTransform:'uppercase',fontWeight:700}}>
                            Tu apodo (opcional)
                        </p>
                    </div>
                    <input
                        type="text"
                        value={perfil.apodo || ''}
                        onChange={function(e) { setPerfil(function(p) { return {...p, apodo: e.target.value}; }); setGuardado(false); }}
                        placeholder={currentUser}
                        maxLength={20}
                        style={{width:'100%',padding:'14px 16px',border:'1.5px solid rgba(0,31,107,0.15)',borderRadius:12,
                            fontFamily:"'Teko',sans-serif",fontSize:20,letterSpacing:2,color:G.deepBlue,
                            background:'#f8f9ff',textTransform:'uppercase'}}
                    />
                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:G.deepBlue,opacity:.4,marginTop:8}}>
                        Si lo dejas vacío, usaremos tu nombre real.
                    </p>
                </div>
            )}

            {/* Botón guardar */}
            {paso >= 2 && (
                <button onClick={guardar} disabled={guardando || perfil.emoji === '❓'}
                    style={{width:'100%',fontFamily:"'Teko',sans-serif",fontSize:'1.1rem',letterSpacing:2,
                        background: guardado ? '#10b981' : G.deepBlue,
                        color: guardado ? '#fff' : '#FFD700',
                        border:'none',borderRadius:30,padding:16,cursor:'pointer',
                        opacity: perfil.emoji==='❓'?0.5:1}}>
                    {guardando ? 'GUARDANDO...' : guardado ? '✅ PERFIL GUARDADO' : 'GUARDAR MI PERFIL'}
                </button>
            )}

            {paso >= 2 && !guardado && (
                <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:G.deepBlue,opacity:.4,textAlign:'center',marginTop:8}}>
                    Puedes cambiar tu perfil cuando quieras volviendo a esta pantalla.
                </p>
            )}
        </div>
    );
};




// ============================================================================
// LOGOS DE EQUIPOS — URLs públicas de Wikipedia (sin API key, sin seed)
// Funcionan siempre desde cualquier dispositivo
// ============================================================================
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
const APP_EN_CONSTRUCCION = typeof window !== 'undefined' && sessionStorage.getItem('porra_prueba') === '1' ? false : true; // Código: udlp2027

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

const MiJornadaScreen = ({ user, teamLogos, plantilla, userProfiles, onlineUsers }) => {
    var G = styles.colors;
    var [jornada, setJornada] = useState(null);
    var [loading, setLoading] = useState(true);
    var [pronostico, setPronostico] = useState({ golesLocal: '', golesVisitante: '', resultado1x2: '' });
    var [elOtroActivado, setElOtroActivado] = useState(false);
    var [miElOtro, setMiElOtro] = useState(null);
    var [guardado, setGuardado] = useState(false);
    var [mensaje, setMensaje] = useState('');
    var [participantes, setParticipantes] = useState([]);
    var [timeLeft, setTimeLeft] = useState('');
    var [showPorraAnual, setShowPorraAnual] = useState(false);
    var [showEstrellas, setShowEstrellas] = useState(false);

    // Sincronización automática con API cada 5 minutos cuando hay jornada en vivo
    useEffect(function() {
        if (!jornada || (jornada.estado !== 'En vivo' && jornada.estado !== 'Abierta')) return;
        if (!API_FOOTBALL_KEY) return;
        var sincronizar = async function() {
            try {
                var url = 'https://v3.football.api-sports.io/fixtures?league=141&season=2025&date=' + jornada.fecha + '&team=' + API_TEAM_ID_UDLP;
                var res = await fetch(url, { headers: { 'x-apisports-key': API_FOOTBALL_KEY } });
                var data = await res.json();
                if (data.response && data.response.length > 0) {
                    var f = data.response[0];
                    var isLive = ['LIVE','1H','2H','HT','ET'].includes(f.fixture.status.short);
                    var primerGol = (f.events||[]).find(function(e) { return e.type==='Goal' && e.detail!=='Missed Penalty'; });
                    await setDoc(doc(db, "jornadas", jornada.id), {
                        liveData: {
                            golesLocal: f.goals.home,
                            golesVisitante: f.goals.away,
                            primerGoleador: primerGol ? primerGol.player.name : '',
                            isLive: isLive,
                            actualizadoEn: new Date().toISOString()
                        },
                        estado: isLive ? 'En vivo' : jornada.estado
                    }, { merge: true });
                }
            } catch(e) { console.warn('API sync error:', e.message); }
        };
        sincronizar(); // Primera vez inmediata
        var intervalo = setInterval(sincronizar, 5 * 60 * 1000); // Cada 5 min
        return function() { clearInterval(intervalo); };
    }, [jornada]); // eslint-disable-line react-hooks/exhaustive-deps

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
                // Participantes que ya apostaron
                onSnapshot(collection(db, "pronosticos", snap.docs[0].id, "jugadores"), function(ps) {
                    setParticipantes(ps.docs.map(function(d) { return d.id; }));
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

    var guardar = async function() {
        if (pronostico.golesLocal === '' || pronostico.golesVisitante === '' || !pronostico.resultado1x2) {
            setMensaje('Rellena el marcador y el 1X2 antes de guardar.'); return;
        }
        try {
            await setDoc(doc(db, "pronosticos", jornada.id, "jugadores", user), {
                golesLocal: Number(pronostico.golesLocal),
                golesVisitante: Number(pronostico.golesVisitante),
                resultado1x2: pronostico.resultado1x2,
                elOtroActivado: elOtroActivado,
                guardadoEn: serverTimestamp(),
                usuario: user,
                puntosObtenidos: 0,
            }, { merge: true });
            setGuardado(true);
            setMensaje('✅ Apuesta guardada correctamente.');
        } catch(e) { setMensaje('❌ Error al guardar: ' + e.message); }
    };

    // Multiplicador de El Otro según activaciones
    var getMultiplicador = function(activaciones) {
        if (activaciones >= 5) return 3;
        if (activaciones >= 3) return 2.5;
        return 2;
    };

    if (loading) return <LoadingSkeleton />;

    var cerrado = jornada && jornada.estado !== 'Abierta';
    var finalizada = jornada && jornada.estado === 'Finalizada';
    var mult = miElOtro ? getMultiplicador(miElOtro.activaciones || 0) : 2;

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
                    <img src={'/escudo.png'} alt="UDLP" style={{width:32,height:32,objectFit:'contain',flexShrink:0}}
                        onError={function(e){e.target.style.display='none';}} />
                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:22,fontWeight:700,color:'#FFD700',letterSpacing:1,flex:1}}>
                        {jornada.equipoLocal} vs {jornada.equipoVisitante}
                    </p>
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

            {/* Banner VIP */}
            {jornada.esVip && (
                <div style={{background:'rgba(255,215,0,0.1)',border:'1px solid rgba(255,215,0,0.3)',borderRadius:12,padding:12,marginBottom:16,textAlign:'center'}}>
                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:16,letterSpacing:3,color:G.golden,textTransform:'uppercase'}}>⭐ Jornada VIP — Puntos dobles en resultado y 1X2 · Cuesta 2€</p>
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
                    {miElOtro && miElOtro.equipo && (
                        <div style={{marginBottom:20,background: elOtroActivado ? 'rgba(0,31,107,0.05)' : '#f8f8f8',
                            borderRadius:14,padding:16,border: elOtroActivado ? '1.5px solid #001F6B' : '1.5px solid rgba(0,31,107,0.1)'}}>
                            <div style={{display:'flex',alignItems:'center',gap:12}}>
                                <div style={{flex:1}}>
                                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:2,color:G.deepBlue,textTransform:'uppercase',marginBottom:2}}>
                                        El Otro Equipo · {miElOtro.revelado ? miElOtro.equipo : '???'}
                                    </p>
                                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:G.deepBlue,opacity:.5}}>
                                        {elOtroActivado ? 'Activado — multiplica ×' + mult + ' si tu equipo gana' : 'Activar para multiplicar puntos de esta jornada'}
                                    </p>
                                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:10,color:G.deepBlue,opacity:.35,marginTop:2}}>
                                        Activaciones: {miElOtro.activaciones || 0} · Multiplicador actual: ×{mult}
                                    </p>
                                </div>
                                <button onClick={function() { setElOtroActivado(function(v) { return !v; }); setGuardado(false); }}
                                    style={{width:50,height:28,borderRadius:14,border:'none',cursor:'pointer',transition:'all .2s',
                                        background: elOtroActivado ? '#001F6B' : 'rgba(0,31,107,0.15)',position:'relative'}}>
                                    <div style={{width:22,height:22,borderRadius:'50%',background:'#fff',position:'absolute',
                                        top:3, left: elOtroActivado ? 25 : 3,transition:'left .2s'}} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Botón guardar */}
                    {mensaje && <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color: mensaje.startsWith('✅') ? '#10b981' : G.danger,marginBottom:12,textAlign:'center'}}>{mensaje}</p>}
                    <button onClick={guardar}
                        style={{width:'100%',fontFamily:"'Teko',sans-serif",fontSize:'1.1rem',letterSpacing:2,
                            background: guardado ? '#10b981' : G.deepBlue, color: guardado ? '#fff' : '#FFD700',
                            border:'none',borderRadius:30,padding:14,cursor:'pointer',textTransform:'uppercase'}}>
                        {guardado ? '✅ GUARDADO — Puedes modificar hasta el cierre' : 'GUARDAR MI APUESTA'}
                    </button>
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
    var [multDemo, setMultDemo] = useState(0); // 0=×2, 1=×2.5, 2=×3

    var EQUIPOS_PRIMERA = [
        "FC Barcelona","Real Madrid","Atlético de Madrid","Villarreal CF",
        "Real Betis","Celta de Vigo","Real Sociedad","Getafe CF",
        "Athletic Club","Sevilla FC","Rayo Vallecano","Deportivo Alavés",
        "RCD Espanyol","Valencia CF","Leganés","CA Osasuna",
        "Real Valladolid","Racing Santander","RC Deportivo","Málaga CF"
    ];

    var JUGADORES_TUTORIAL = (plantilla || []).filter(function(j) { return j.apiId > 0; }).slice(0, 8);

    // Cascada de escudos en slide 9
    useEffect(function() {
        if (slide !== 9) return;
        var t = setInterval(function() {
            setEscudoActivo(function(v) { return (v + 1) % EQUIPOS_PRIMERA.length; });
        }, 160);
        return function() { clearInterval(t); };
    }, [slide]); // eslint-disable-line react-hooks/exhaustive-deps

    // Animación jugadores en slide 11
    useEffect(function() {
        if (slide !== 11) return;
        var t = setInterval(function() {
            setJugadorActivo(function(v) { return (v + 1) % Math.max(1, JUGADORES_TUTORIAL.length); });
        }, 700);
        return function() { clearInterval(t); };
    }, [slide]); // eslint-disable-line react-hooks/exhaustive-deps

    // Demo multiplicador en slide 10
    useEffect(function() {
        if (slide !== 10) return;
        var t = setInterval(function() {
            setMultDemo(function(v) { return (v + 1) % 3; });
        }, 1800);
        return function() { clearInterval(t); };
    }, [slide]);

    // 16 slides en total
    var TOTAL_SLIDES = 17;

    var siguiente = function() {
        if (slide < TOTAL_SLIDES - 1) setSlide(function(v) { return v + 1; });
        else cerrar();
    };

    var cerrar = function() {
        setSaliendo(true);
        setTimeout(function() {
            localStorage.setItem('tutorial_2627_' + user, '1');
            onClose();
        }, 400);
    };

    var toggleJugador = function(j) {
        var ya = jugadoresElegidos.find(function(x) { return x.nombre === j.nombre; });
        if (ya) { setJugadoresElegidos(jugadoresElegidos.filter(function(x) { return x.nombre !== j.nombre; })); }
        else if (jugadoresElegidos.length < 5) { setJugadoresElegidos([...jugadoresElegidos, j]); }
    };

    // Estilos base reutilizables
    var S = {
        eyebrow: { fontFamily:"'Teko',sans-serif", fontSize:11, letterSpacing:5, color:'rgba(255,215,0,0.5)', textTransform:'uppercase', marginBottom:10 },
        titulo: { fontFamily:"'Teko',sans-serif", fontWeight:700, color:'#FFD700', letterSpacing:3, lineHeight:1, textAlign:'center', marginBottom:18, fontSize:'clamp(2.6rem,11vw,4rem)' },
        tituloMega: { fontFamily:"'Teko',sans-serif", fontWeight:700, color:'#FFD700', letterSpacing:3, lineHeight:1, textAlign:'center', marginBottom:18, fontSize:'clamp(3.2rem,13vw,5rem)' },
        cuerpo: { fontFamily:"'Inter',sans-serif", fontSize:'clamp(14px,4vw,16px)', color:'rgba(255,255,255,0.65)', lineHeight:1.8, textAlign:'center', maxWidth:340, margin:'0 auto 20px' },
        infoBox: { background:'rgba(255,215,0,0.08)', border:'1px solid rgba(255,215,0,0.2)', borderRadius:14, padding:'14px 20px', maxWidth:360, width:'100%' },
        card: { background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:'14px 12px' },
        cardGold: { background:'rgba(255,215,0,0.07)', border:'1px solid rgba(255,215,0,0.2)', borderRadius:14, padding:'14px 12px' },
        tag: { display:'inline-block', background:'rgba(255,215,0,0.1)', border:'1px solid rgba(255,215,0,0.25)', borderRadius:20, padding:'8px 22px', marginBottom:18 },
        sep: { width:40, height:2, background:'rgba(255,215,0,0.25)', borderRadius:1, margin:'14px auto' },
        iconBig: { fontSize:'clamp(58px,14vw,78px)', display:'block', marginBottom:18, animation:'floatIcon 3s ease-in-out infinite' },
        ptoRow: { display:'flex', alignItems:'center', gap:12, background:'rgba(255,255,255,0.04)', borderRadius:10, padding:'10px 14px', width:'100%', maxWidth:360 },
    };

    var renderSlide = function() {
        switch(slide) {

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // SLIDE 0: PORTADA
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        case 0: return (
            <div style={{textAlign:'center'}}>
                <div style={{width:90,height:108,margin:'0 auto 24px',position:'relative'}}>
                    <img src="/escudo.png" alt="UDLP"
                        style={{width:'100%',height:'100%',objectFit:'contain',
                            filter:'drop-shadow(0 0 40px rgba(255,215,0,0.45))',
                            animation:'floatIcon 3s ease-in-out infinite'}}
                        onError={function(e){e.target.style.display='none';}} />
                </div>
                <p style={S.eyebrow}>Temporada 26/27</p>
                <h1 style={S.tituloMega}>BIENVENIDO{user ? <>,<br/>{user.toUpperCase()}</> : ''}</h1>
                <p style={S.cuerpo}>
                    La porra más épica de la familia arranca una nueva temporada.
                    Nuevas reglas, nuevo sistema, misma pasión por los colores.
                </p>
                <div style={S.tag}><span style={{fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:3,color:'#FFD700',textTransform:'uppercase'}}>
                    Desliza para descubrir las novedades
                </span></div>
            </div>
        );

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // SLIDE 1: LA UDLP
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        case 1: return (
            <div style={{textAlign:'center'}}>
                <span style={S.iconBig}>🏟️</span>
                <p style={S.eyebrow}>UD Las Palmas · 2º año en Segunda</p>
                <h1 style={S.titulo}>EL AÑO<br/>DEL ASCENSO</h1>
                <p style={S.cuerpo}>
                    El año pasado estuvimos <strong style={{color:'#FFD700'}}>a las puertas del ascenso</strong>.
                    El playoff nos dejó a un paso. Esta temporada la UDLP va a por todas con Rubén de la Barrera al mando —
                    y ustedes estarán en cada partido.
                </p>
                <div style={{display:'flex',justifyContent:'center',gap:0,background:'rgba(255,255,255,0.04)',borderRadius:14,overflow:'hidden',maxWidth:340,width:'100%'}}>
                    {[['42','Jornadas'],['15 AGO','Primer partido'],['20','Jugadores']].map(function(s,i) {
                        return (
                            <div key={i} style={{flex:1,padding:'16px 8px',textAlign:'center',borderRight:i<2?'1px solid rgba(255,255,255,0.06)':'none'}}>
                                <p style={{fontFamily:"'Teko',sans-serif",fontSize:26,fontWeight:700,color:'#FFD700'}}>{s[0]}</p>
                                <p style={{fontFamily:"'Inter',sans-serif",fontSize:9,color:'rgba(255,255,255,0.3)',letterSpacing:2,textTransform:'uppercase',marginTop:2}}>{s[1]}</p>
                            </div>
                        );
                    })}
                </div>
            </div>
        );

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // SLIDE 2: LA PORRA — QUÉ ES
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        case 2: return (
            <div style={{textAlign:'center'}}>
                <span style={S.iconBig}>⚽</span>
                <p style={S.eyebrow}>El juego central de siempre</p>
                <h1 style={S.titulo}>LA PORRA</h1>
                <p style={S.cuerpo}>
                    Cada semana, antes del partido de la UDLP, haces tu apuesta.
                    Adivinas el <strong style={{color:'#FFD700'}}>marcador exacto</strong> y, si aciertas,
                    te llevas el <strong style={{color:'#FFD700'}}>bote de la jornada</strong>.
                    Si nadie acierta, el bote se acumula para la siguiente semana.
                </p>
                <div style={{display:'flex',gap:10,justifyContent:'center',maxWidth:360,width:'100%'}}>
                    <div style={{...S.cardGold,flex:1,textAlign:'center'}}>
                        <div style={{fontSize:28,marginBottom:8}}>🎯</div>
                        <p style={{fontFamily:"'Teko',sans-serif",fontSize:13,letterSpacing:2,color:'rgba(255,215,0,0.7)',marginBottom:4,textTransform:'uppercase'}}>Marcador exacto</p>
                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'rgba(255,255,255,0.4)',lineHeight:1.5}}>Ganas el bote acumulado</p>
                    </div>
                    <div style={{...S.card,flex:1,textAlign:'center'}}>
                        <div style={{fontSize:28,marginBottom:8}}>💰</div>
                        <p style={{fontFamily:"'Teko',sans-serif",fontSize:13,letterSpacing:2,color:'rgba(255,255,255,0.5)',marginBottom:4,textTransform:'uppercase'}}>Bote acumulado</p>
                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'rgba(255,255,255,0.35)',lineHeight:1.5}}>Si nadie acierta, crece</p>
                    </div>
                </div>
            </div>
        );

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // SLIDE 3: LA PORRA — CÓMO SE APUESTA
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        case 3: return (
            <div style={{textAlign:'center'}}>
                <p style={S.eyebrow}>Tu apuesta semanal</p>
                <h1 style={S.titulo}>¿CÓMO SE<br/>APUESTA?</h1>
                <p style={{...S.cuerpo, fontSize:14}}>Cada jornada rellenas el marcador y el 1X2 por separado — puedes contradecirte, eso es estrategia.</p>
                <div style={{display:'flex',flexDirection:'column',gap:10,width:'100%',maxWidth:360}}>
                    <div style={{...S.cardGold,display:'flex',alignItems:'center',gap:14,padding:'16px 18px',textAlign:'left'}}>
                        <span style={{fontSize:32,flexShrink:0}}>⚽</span>
                        <div>
                            <p style={{fontFamily:"'Teko',sans-serif",fontSize:20,letterSpacing:1,color:'#FFD700',marginBottom:3}}>Marcador exacto</p>
                            <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(255,255,255,0.5)',lineHeight:1.5}}>Eliges el resultado: 2-1, 0-0, 3-2...{'\n'}Si aciertas, ganas el bote + puntos</p>
                        </div>
                    </div>
                    <div style={{...S.card,display:'flex',alignItems:'center',gap:14,padding:'16px 18px',textAlign:'left'}}>
                        <span style={{fontSize:32,flexShrink:0}}>1️⃣</span>
                        <div>
                            <p style={{fontFamily:"'Teko',sans-serif",fontSize:20,letterSpacing:1,color:'#FFD700',marginBottom:3}}>1X2 — Independiente</p>
                            <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(255,255,255,0.5)',lineHeight:1.5}}>Eliges: Gana / Empata / Pierde{'\n'}Puede diferir del marcador — tu estrategia</p>
                        </div>
                    </div>
                </div>
            </div>
        );

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // SLIDE 4: PUNTOS RESULTADO Y 1X2
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        case 4: return (
            <div style={{textAlign:'center'}}>
                <p style={S.eyebrow}>¿Cuánto vale acertar?</p>
                <h1 style={S.titulo}>RESULTADO<br/>Y 1X2</h1>
                <div style={{display:'flex',flexDirection:'column',gap:8,width:'100%',maxWidth:360,marginBottom:16}}>
                    <div style={S.ptoRow}>
                        <span style={{fontFamily:"'Inter',sans-serif",fontSize:13,color:'rgba(255,255,255,0.65)',flex:1}}>⚽ Resultado exacto</span>
                        <span style={{fontFamily:"'Teko',sans-serif",fontSize:24,fontWeight:700,color:'#FFD700',minWidth:50,textAlign:'right'}}>3 pts</span>
                        <span style={{fontFamily:"'Teko',sans-serif",fontSize:14,color:'rgba(255,215,0,0.45)',minWidth:56,textAlign:'right'}}>6 VIP</span>
                    </div>
                    <div style={S.ptoRow}>
                        <span style={{fontFamily:"'Inter',sans-serif",fontSize:13,color:'rgba(255,255,255,0.65)',flex:1}}>1️⃣ 1X2 acertado</span>
                        <span style={{fontFamily:"'Teko',sans-serif",fontSize:24,fontWeight:700,color:'#FFD700',minWidth:50,textAlign:'right'}}>2 pts</span>
                        <span style={{fontFamily:"'Teko',sans-serif",fontSize:14,color:'rgba(255,215,0,0.45)',minWidth:56,textAlign:'right'}}>4 VIP</span>
                    </div>
                </div>
                <div style={S.infoBox}>
                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:13,color:'rgba(255,215,0,0.8)',lineHeight:1.7,textAlign:'center'}}>
                        🏆 Las jornadas <strong>VIP</strong> doblan los puntos de resultado y 1X2, y cuestan <strong>2€</strong> en vez de 1€.<br/>
                        El bote solo lo gana quien acierta el <strong>marcador exacto</strong>.
                    </p>
                </div>
            </div>
        );

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // SLIDE 5: NORMAS GENERALES
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        case 5: return (
            <div style={{textAlign:'center'}}>
                <span style={S.iconBig}>📋</span>
                <p style={S.eyebrow}>Las reglas del juego</p>
                <h1 style={S.titulo}>NORMAS<br/>BÁSICAS</h1>
                <div style={{display:'flex',flexDirection:'column',gap:8,width:'100%',maxWidth:360}}>
                    {[
                        ['⏰','Plazo de apuesta','Hasta 1 hora antes del partido — hora canaria siempre'],
                        ['🔒','Apuestas secretas','Nadie ve el pronóstico de los demás hasta que cierra la jornada'],
                        ['✏️','Editable','Puedes cambiar tu apuesta hasta que cierre el plazo'],
                        ['💸','Coste','1€ por jornada normal · 2€ jornada VIP'],
                        ['🏆','Porra Anual','¿Asciende la UDLP? ¿En qué puesto? Hasta 20 pts extra (J1-J5)'],
                    ].map(function(r,i) {
                        return (
                            <div key={i} style={{...S.card,display:'flex',alignItems:'flex-start',gap:12,padding:'12px 16px',textAlign:'left'}}>
                                <span style={{fontSize:20,flexShrink:0}}>{r[0]}</span>
                                <div>
                                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:16,letterSpacing:1,color:'#FFD700',marginBottom:2}}>{r[1]}</p>
                                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'rgba(255,255,255,0.45)',lineHeight:1.5}}>{r[2]}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // SLIDE 6: CLASIFICACIÓN GENERAL
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        case 6: return (
            <div style={{textAlign:'center'}}>
                <span style={S.iconBig}>📊</span>
                <p style={S.eyebrow}>A lo largo de la temporada</p>
                <h1 style={S.titulo}>LA CLASIFICACIÓN<br/>GENERAL</h1>
                <p style={S.cuerpo}>
                    Todos los puntos de cada jornada — resultado, 1X2, estrellas y el multiplicador —
                    se acumulan en una <strong style={{color:'#FFD700'}}>clasificación general</strong> durante las 42 jornadas.
                    Al final de temporada, el que más puntos tenga, gana.
                </p>
                <div style={{display:'flex',gap:8,width:'100%',maxWidth:360}}>
                    <div style={{...S.cardGold,flex:1,textAlign:'center'}}>
                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:10,color:'rgba(255,215,0,0.5)',letterSpacing:2,textTransform:'uppercase',marginBottom:6}}>Jornada</p>
                        <p style={{fontFamily:"'Teko',sans-serif",fontSize:36,fontWeight:700,color:'#FFD700',lineHeight:1}}>10</p>
                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:10,color:'rgba(255,255,255,0.35)',marginTop:4}}>puntos máx/j</p>
                    </div>
                    <div style={{...S.card,flex:1,textAlign:'center'}}>
                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:10,color:'rgba(255,255,255,0.3)',letterSpacing:2,textTransform:'uppercase',marginBottom:6}}>Temporada</p>
                        <p style={{fontFamily:"'Teko',sans-serif",fontSize:36,fontWeight:700,color:'rgba(255,215,0,0.6)',lineHeight:1}}>42</p>
                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:10,color:'rgba(255,255,255,0.25)',marginTop:4}}>jornadas</p>
                    </div>
                    <div style={{...S.card,flex:1,textAlign:'center'}}>
                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:10,color:'rgba(255,255,255,0.3)',letterSpacing:2,textTransform:'uppercase',marginBottom:6}}>Extra anual</p>
                        <p style={{fontFamily:"'Teko',sans-serif",fontSize:36,fontWeight:700,color:'rgba(255,215,0,0.6)',lineHeight:1}}>+20</p>
                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:10,color:'rgba(255,255,255,0.25)',marginTop:4}}>porra anual</p>
                    </div>
                </div>
            </div>
        );

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // SLIDE 7: ESTRELLAS — INTRO
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        case 7: return (
            <div style={{textAlign:'center'}}>
                <span style={S.iconBig}>⭐</span>
                <p style={S.eyebrow}>Novedad 26/27</p>
                <h1 style={S.titulo}>LAS ESTRELLAS<br/>DE TU EQUIPO</h1>
                <p style={S.cuerpo}>
                    Antes de cada partido, eliges hasta <strong style={{color:'#FFD700'}}>5 jugadores de la UDLP</strong>.
                    Durante el partido, la API oficial registra sus actuaciones —
                    goles, asistencias, paradas, tarjetas...
                    Cada acción genera <strong style={{color:'#FFD700'}}>estrellas</strong>.
                </p>
                <div style={S.infoBox}>
                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:13,color:'rgba(255,215,0,0.8)',lineHeight:1.7,textAlign:'center'}}>
                        El que mejor elija sus jugadores cada semana acumula más estrellas y sube en la <strong>clasificación de estrellas</strong> — una liga paralela con sus propios premios al final de temporada.
                    </p>
                </div>
            </div>
        );

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // SLIDE 8: ESTRELLAS — CÓMO SE PUNTÚA
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        case 8: return (
            <div style={{textAlign:'center'}}>
                <p style={S.eyebrow}>Qué acciones valen estrellas</p>
                <h1 style={S.titulo}>TABLA DE<br/>ESTRELLAS</h1>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,width:'100%',maxWidth:360,marginBottom:14}}>
                    {[
                        ['⚽ Gol delantero','+5⭐','#FFD700'],
                        ['⚽ Gol centrocampista','+6⭐','#FFD700'],
                        ['⚽ Gol portero/defensa','+8⭐','#FFD700'],
                        ['🅰️ Asistencia','+3⭐','#FFD700'],
                        ['🧤 Portería a 0 (portero)','+4⭐','#FFD700'],
                        ['🧤 Portería a 0 (defensa)','+2⭐','#FFD700'],
                        ['👟 Titular (>60 min)','+2⭐','rgba(255,215,0,0.6)'],
                        ['👟 Suplente','+1⭐','rgba(255,215,0,0.5)'],
                        ['🟨 Tarjeta amarilla','-1⭐','#e63946'],
                        ['🟥 Tarjeta roja','-3⭐','#e63946'],
                        ['❌ Penalti fallado','-2⭐','#e63946'],
                        ['🤦 Gol en propia','-2⭐','#e63946'],
                    ].map(function(r,i) {
                        return (
                            <div key={i} style={{...S.card,display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 12px'}}>
                                <span style={{fontFamily:"'Inter',sans-serif",fontSize:10,color:'rgba(255,255,255,0.5)'}}>{r[0]}</span>
                                <span style={{fontFamily:"'Teko',sans-serif",fontSize:17,fontWeight:700,color:r[2],flexShrink:0,marginLeft:6}}>{r[1]}</span>
                            </div>
                        );
                    })}
                </div>
                <div style={S.infoBox}>
                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(255,215,0,0.7)',textAlign:'center',lineHeight:1.6}}>
                        La clave está en <strong>saber elegir</strong> — un delantero con muchos partidos jugados vale más que una estrella que no sale del banquillo
                    </p>
                </div>
            </div>
        );

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // SLIDE 9: ESTRELLAS — ELEGIR JUGADORES (con fotos)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        case 9: return (
            <div style={{textAlign:'center'}}>
                <p style={S.eyebrow}>Así se juega cada semana</p>
                <h1 style={S.titulo}>ELIGE TUS<br/>5 ESTRELLAS</h1>
                <p style={{fontFamily:"'Inter',sans-serif",fontSize:13,color:'rgba(255,255,255,0.5)',marginBottom:16,maxWidth:320,margin:'0 auto 16px',lineHeight:1.6}}>
                    Antes de cada partido seleccionas hasta 5 jugadores. Sus estrellas se suman —
                    quien consiga más en la jornada se lleva los puntos extra para la clasificación general.
                </p>
                <div style={{display:'flex',flexWrap:'wrap',gap:12,justifyContent:'center',maxWidth:340,margin:'0 auto 16px'}}>
                    {JUGADORES_TUTORIAL.map(function(j,i) {
                        var sel = !!jugadoresElegidos.find(function(x) { return x.nombre===j.nombre; });
                        var dest = i === jugadorActivo;
                        return (
                            <div key={j.nombre} onClick={function(){toggleJugador(j);}}
                                style={{display:'flex',flexDirection:'column',alignItems:'center',gap:5,cursor:'pointer',
                                    transition:'all .3s ease',
                                    transform: dest?'scale(1.18) translateY(-5px)':sel?'scale(1.05)':'scale(1)',
                                    opacity: dest||sel?1:0.55}}>
                                <div style={{width:52,height:52,borderRadius:'50%',overflow:'hidden',
                                    border: sel?'2.5px solid #FFD700':dest?'2px solid rgba(255,215,0,0.5)':'2px solid rgba(255,255,255,0.12)',
                                    background:'rgba(255,255,255,0.08)',transition:'all .3s ease'}}>
                                    <img src={j.imageUrl} alt={j.nombre}
                                        style={{width:'100%',height:'100%',objectFit:'cover'}}
                                        onError={function(e){e.target.outerHTML='<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-family:Teko,sans-serif;font-size:16px;color:rgba(255,255,255,0.5)">'+j.dorsal+'</div>';}} />
                                </div>
                                <p style={{fontFamily:"'Inter',sans-serif",fontSize:9,color:sel?'#FFD700':dest?'rgba(255,215,0,0.6)':'rgba(255,255,255,0.3)',maxWidth:56,textAlign:'center',lineHeight:1.2}}>
                                    {j.nombre.split(' ')[0]}
                                </p>
                                {sel && <span style={{fontSize:10}}>⭐</span>}
                            </div>
                        );
                    })}
                </div>
                <div style={{display:'flex',gap:8,justifyContent:'center',marginBottom:8}}>
                    {[['1º','5 pts'],['2º','4 pts'],['3º','3 pts'],['4º','2 pts'],['5º','1 pt']].map(function(r,i) {
                        return (
                            <div key={i} style={{...S.cardGold,textAlign:'center',padding:'8px 8px',minWidth:50}}>
                                <p style={{fontFamily:"'Teko',sans-serif",fontSize:12,color:'rgba(255,215,0,0.6)'}}>{r[0]}</p>
                                <p style={{fontFamily:"'Teko',sans-serif",fontSize:17,fontWeight:700,color:'#FFD700'}}>{r[1]}</p>
                            </div>
                        );
                    })}
                </div>
                <p style={{fontFamily:"'Inter',sans-serif",fontSize:10,color:'rgba(255,255,255,0.2)'}}>Toca los jugadores · {jugadoresElegidos.length}/5 seleccionados</p>
            </div>
        );

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // SLIDE 10: EL OTRO EQUIPO — INTRO (sin revelar el nombre)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        case 10: return (
            <div style={{textAlign:'center'}}>
                <div style={{width:80,height:80,borderRadius:'50%',background:'rgba(255,215,0,0.1)',
                    border:'2px solid rgba(255,215,0,0.3)',display:'flex',alignItems:'center',
                    justifyContent:'center',margin:'0 auto 20px',animation:'floatIcon 3s ease-in-out infinite',
                    fontSize:40}}>🛡️</div>
                <p style={S.eyebrow}>La novedad más grande de 26/27</p>
                <h1 style={S.titulo}>EL OTRO<br/>EQUIPO</h1>
                <p style={S.cuerpo}>
                    Cada jugador tiene asignado <strong style={{color:'#FFD700'}}>un equipo de Primera División</strong> para toda la temporada.
                    Un equipo que convive con la UDLP durante las 42 jornadas.
                </p>
                <p style={{fontFamily:"'Inter',sans-serif",fontSize:14,color:'rgba(255,255,255,0.45)',lineHeight:1.7,maxWidth:320,margin:'0 auto 20px',textAlign:'center'}}>
                    Cada jornada decides si activarlo o no. Esa decisión puede
                    <strong style={{color:'#FFD700'}}> multiplicar tus puntos</strong> o hacerte perder la mitad.
                    El riesgo es parte del juego.
                </p>
                <div style={{display:'flex',justifyContent:'center',gap:12,maxWidth:360,width:'100%'}}>
                    {[['Tu equipo gana','×2 tus puntos','#10b981'],['Tu equipo empata','×1 sin efecto','rgba(255,255,255,0.4)'],['Tu equipo pierde','÷2 tus puntos','#e63946']].map(function(r,i) {
                        return (
                            <div key={i} style={{...S.card,flex:1,textAlign:'center',padding:'12px 8px'}}>
                                <p style={{fontFamily:"'Inter',sans-serif",fontSize:9,color:'rgba(255,255,255,0.4)',marginBottom:6,lineHeight:1.3}}>{r[0]}</p>
                                <p style={{fontFamily:"'Teko',sans-serif",fontSize:20,fontWeight:700,color:r[2]}}>{r[1]}</p>
                            </div>
                        );
                    })}
                </div>
            </div>
        );

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // SLIDE 11: LOS 20 EQUIPOS — CASCADA
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        case 11: return (
            <div style={{textAlign:'center'}}>
                <p style={S.eyebrow}>Primera División 26/27</p>
                <h1 style={S.titulo}>20 EQUIPOS<br/>20 JUGADORES</h1>
                <p style={{fontFamily:"'Inter',sans-serif",fontSize:13,color:'rgba(255,255,255,0.5)',marginBottom:16,lineHeight:1.6,maxWidth:320,margin:'0 auto 16px'}}>
                    Uno por jugador. Sin repetición. Elegidos por orden según la clasificación del año pasado.
                    Pedrito eligió primero. Sarito después. Y así hasta llegar al último.
                </p>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6,width:'100%',maxWidth:340,margin:'0 auto 16px'}}>
                    {EQUIPOS_PRIMERA.map(function(eq,i) {
                        var activo = i===escudoActivo;
                        return (
                            <div key={eq} style={{background:activo?'rgba(255,215,0,0.15)':'rgba(255,255,255,0.04)',
                                border:activo?'1px solid rgba(255,215,0,0.5)':'1px solid rgba(255,255,255,0.06)',
                                borderRadius:8,padding:'8px 4px',textAlign:'center',
                                transition:'all .18s ease',transform:activo?'scale(1.1)':'scale(1)'}}>
                                <p style={{fontFamily:"'Teko',sans-serif",fontSize:9,color:activo?'#FFD700':'rgba(255,255,255,0.3)',letterSpacing:0.5,lineHeight:1.2}}>
                                    {eq.replace(/FC |CD |SD |CF |RCD |RC |CA |UD /g,'').split(' ')[0]}
                                </p>
                            </div>
                        );
                    })}
                </div>
                <div style={S.infoBox}>
                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(255,215,0,0.7)',textAlign:'center',lineHeight:1.6}}>
                        📅 El plazo de elección es del <strong>11 de agosto a las 12:00</strong> al <strong>14 de agosto a las 18:00</strong> (hora canaria)<br/>
                        ⏱️ Cada jugador tiene <strong>60 minutos</strong> desde que le toca — si no elige, pasa al final
                    </p>
                </div>
            </div>
        );

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // SLIDE 12: EL MULTIPLICADOR
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        case 12: return (
            <div style={{textAlign:'center'}}>
                <span style={S.iconBig}>⚡</span>
                <p style={S.eyebrow}>Cuanto más lo usas, más potente</p>
                <h1 style={S.titulo}>EL<br/>MULTIPLICADOR</h1>
                <p style={{fontFamily:"'Inter',sans-serif",fontSize:14,color:'rgba(255,255,255,0.55)',lineHeight:1.7,maxWidth:320,margin:'0 auto 20px',textAlign:'center'}}>
                    El multiplicador <strong style={{color:'#FFD700'}}>crece con el uso</strong>. Empieza en ×2 y puede llegar a ×3 si lo activas con constancia.
                    Recuerda: también puede dividir tus puntos si tu equipo pierde.
                </p>
                <div style={{display:'flex',gap:10,width:'100%',maxWidth:360,marginBottom:16}}>
                    {[['1ª-2ª\nactivación','×2',multDemo===0],['3ª-4ª\nactivación','×2.5',multDemo===1],['5ª+\nactivación','×3',multDemo===2]].map(function(r,i) {
                        return (
                            <div key={i} style={{flex:1,background:r[2]?'rgba(255,215,0,0.15)':'rgba(255,215,0,0.06)',
                                border:r[2]?'1.5px solid rgba(255,215,0,0.5)':'1px solid rgba(255,215,0,0.15)',
                                borderRadius:14,padding:'16px 8px',textAlign:'center',
                                transition:'all .4s ease',transform:r[2]?'scale(1.06)':'scale(1)'}}>
                                <p style={{fontFamily:"'Inter',sans-serif",fontSize:10,color:'rgba(255,255,255,0.35)',marginBottom:8,lineHeight:1.4}}>{r[0]}</p>
                                <p style={{fontFamily:"'Teko',sans-serif",fontSize:32,fontWeight:700,color:r[2]?'#FFD700':'rgba(255,215,0,0.4)',transition:'color .4s'}}>{r[1]}</p>
                            </div>
                        );
                    })}
                </div>
                <div style={S.infoBox}>
                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(255,215,0,0.7)',textAlign:'center',lineHeight:1.6}}>
                        ⚠️ Mínimo <strong>3 activaciones</strong> durante la temporada para mantener el multiplicador máximo.<br/>
                        🔍 El equipo de cada jugador es <strong>público y visible</strong> para todos desde el principio.
                    </p>
                </div>
            </div>
        );

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // SLIDE 13: RESUMEN DE PUNTOS TOTAL
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        case 13: return (
            <div style={{textAlign:'center'}}>
                <p style={S.eyebrow}>Todo junto</p>
                <h1 style={S.titulo}>RESUMEN DE<br/>PUNTOS</h1>
                <div style={{display:'flex',flexDirection:'column',gap:8,width:'100%',maxWidth:360,marginBottom:14}}>
                    {[
                        ['⚽','Resultado exacto','3 pts','6 VIP'],
                        ['1️⃣','1X2 acertado','2 pts','4 VIP'],
                        ['⭐','1º en Estrellas','5 pts','5 VIP'],
                        ['⭐','2º en Estrellas','4 pts','4 VIP'],
                        ['⭐','3º / 4º / 5º','3-1 pts','igual'],
                        ['🛡️','El Otro Equipo gana','×2-3','todo'],
                        ['🛡️','El Otro Equipo pierde','÷2','todo'],
                        ['📅','Porra Anual (bonus)','hasta 20 pts','una vez'],
                    ].map(function(r,i) {
                        return (
                            <div key={i} style={S.ptoRow}>
                                <span style={{fontSize:16,flexShrink:0}}>{r[0]}</span>
                                <span style={{fontFamily:"'Inter',sans-serif",fontSize:13,color:'rgba(255,255,255,0.65)',flex:1}}>{r[1]}</span>
                                <span style={{fontFamily:"'Teko',sans-serif",fontSize:20,fontWeight:700,color:'#FFD700',minWidth:50,textAlign:'right'}}>{r[2]}</span>
                                <span style={{fontFamily:"'Teko',sans-serif",fontSize:12,color:'rgba(255,215,0,0.4)',minWidth:46,textAlign:'right'}}>{r[3]}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // SLIDE 14: INVITA A AMIGOS
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        case 14: return (
            <div style={{textAlign:'center'}}>
                <span style={S.iconBig}>👥</span>
                <p style={S.eyebrow}>Quedan 5 huecos libres</p>
                <h1 style={S.titulo}>INVITA A<br/>UN AMIGO</h1>
                <div style={{display:'flex',gap:5,flexWrap:'wrap',justifyContent:'center',maxWidth:320,margin:'0 auto 16px'}}>
                    {Array.from({length:20},function(_,i) {
                        return <div key={i} style={{width:16,height:16,borderRadius:'50%',
                            background:i<15?'rgba(255,215,0,0.65)':'transparent',
                            border:i<15?'1.5px solid rgba(255,215,0,0.4)':'1.5px dashed rgba(255,215,0,0.25)'}}/>;
                    })}
                </div>
                <p style={{fontFamily:"'Teko',sans-serif",fontSize:12,letterSpacing:3,color:'rgba(255,215,0,0.4)',textTransform:'uppercase',marginBottom:16}}>
                    15/20 plazas · quedan 5
                </p>
                <p style={{...S.cuerpo, fontSize:14}}>
                    La liga admite hasta <strong style={{color:'#FFD700'}}>20 jugadores</strong>, uno por cada equipo de Primera División.
                    Si traes a alguien, <strong style={{color:'#FFD700'}}>la próxima temporada tendrás tu propia liga</strong>.
                </p>
                <div style={S.infoBox}>
                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'rgba(255,215,0,0.7)',textAlign:'center',lineHeight:1.7}}>
                        🏆 Más jugadores = más bote semanal<br/>
                        🚀 Quien llene plazas, <strong>gestiona su propia liga</strong> la próxima temporada<br/>
                        📲 Usa el botón de invitar en el menú de la app
                    </p>
                </div>
            </div>
        );

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // SLIDE 15: PRECIO E INSCRIPCIÓN
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        case 15: return (
            <div style={{textAlign:'center'}}>
                <div style={{fontSize:70,marginBottom:18,animation:'floatIcon 3s ease-in-out infinite'}}>💰</div>
                <p style={S.eyebrow}>Antes de empezar</p>
                <h1 style={S.titulo}>INSCRIPCIÓN<br/>5€ ESTA TEMPORADA</h1>
                <p style={S.cuerpo}>
                    Este año la porra tiene un precio de entrada de <strong style={{color:'#FFD700'}}>5€ por jugador</strong>.
                    Un único pago para toda la temporada — 42 jornadas, sin cuotas adicionales.
                </p>
                <div style={{...S.infoBox,marginBottom:16}}>
                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:13,color:'rgba(255,215,0,0.8)',lineHeight:1.7,textAlign:'center'}}>
                        🏆 Todo el dinero va a premios — <strong>entre 75€ y 100€</strong> para el top 3, dependiendo de cuántos jugadores participen.<br/>
                        🎁 A lo largo de la temporada: experiencias, merchandising UDLP y muchas sorpresas más.
                    </p>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:8,width:'100%',maxWidth:360}}>
                    {[
                        ['💸','Pago','5€ único · gestión por Splitwise o Bizum'],
                        ['📅','Cuándo','Antes del primer partido — 15 de agosto'],
                        ['🚫','Norma','Sin pago confirmado, no hay acceso a la app'],
                        ['👥','Nuevos','Los jugadores invitados también pagan 5€'],
                    ].map(function(r,i) {
                        return (
                            <div key={i} style={{...S.card,display:'flex',alignItems:'flex-start',gap:12,padding:'11px 14px',textAlign:'left'}}>
                                <span style={{fontSize:18,flexShrink:0}}>{r[0]}</span>
                                <div>
                                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:15,letterSpacing:1,color:'#FFD700',marginBottom:2}}>{r[1]}</p>
                                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'rgba(255,255,255,0.45)',lineHeight:1.5}}>{r[2]}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // SLIDE 16: CIERRE ÉPICO
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        case 16: return (
            <div style={{textAlign:'center'}}>
                <img src="/escudo.png" alt="UDLP"
                    style={{width:86,height:103,objectFit:'contain',marginBottom:20,
                        filter:'drop-shadow(0 0 40px rgba(255,215,0,0.55))',
                        animation:'floatIcon 3s ease-in-out infinite'}}
                    onError={function(e){e.target.style.display='none';}} />
                <p style={S.eyebrow}>Todo listo</p>
                <h1 style={S.tituloMega}>¿ESTÁN<br/>LISTOS?</h1>
                <p style={S.cuerpo}>
                    La liga empieza el <strong style={{color:'#FFD700'}}>15 de agosto</strong>.
                    El Otro Equipo se elige antes del <strong style={{color:'#FFD700'}}>14 de agosto a las 18:00</strong> (hora canaria).
                </p>
                <div style={{display:'flex',gap:10,width:'100%',maxWidth:360,marginBottom:20}}>
                    {[['⚽','Porra','42 jornadas'],['🛡️','El Otro Equipo','×2 hasta ×3'],['⭐','Estrellas','Liga paralela'],['👥','Amigos','5 plazas']].map(function(r,i) {
                        return (
                            <div key={i} style={{...S.cardGold,flex:1,textAlign:'center',padding:'12px 6px'}}>
                                <span style={{fontSize:20,display:'block',marginBottom:6}}>{r[0]}</span>
                                <p style={{fontFamily:"'Teko',sans-serif",fontSize:12,color:'#FFD700',letterSpacing:1,textTransform:'uppercase',lineHeight:1.2}}>{r[1]}</p>
                                <p style={{fontFamily:"'Inter',sans-serif",fontSize:9,color:'rgba(255,255,255,0.3)',marginTop:4}}>{r[2]}</p>
                            </div>
                        );
                    })}
                </div>
                <p style={{fontFamily:"'Inter',sans-serif",fontSize:13,color:'rgba(255,255,255,0.4)',lineHeight:1.7,maxWidth:300,margin:'0 auto'}}>
                    A continuación crearás tu perfil con tu emoji personal. Solo un momento — y ya estarás dentro.
                </p>
            </div>
        );

        default: return null;
        }
    };

    var fondos = [
        '#001F6B','#0a0a0a','#001F6B','#0a0a0a','#001F6B',
        '#0a0a0a','#001F6B','#0a0a0a','#001F6B','#0a0a0a',
        '#001F6B','#0a0a0a','#001F6B','#0a0a0a','#001F6B','#0a0a0a'
    ];

    return (
        <div style={{
            position:'fixed', inset:0, zIndex:500,
            background: fondos[slide] || '#001F6B',
            display:'flex', flexDirection:'column',
            transition:'background .5s ease',
            animation: saliendo ? 'fadeOut .4s ease forwards' : 'fadeIn .4s ease',
            overflow:'hidden',
        }}>
            <style>{`
                @keyframes fadeOut{to{opacity:0;transform:scale(.96)}}
                @keyframes floatIcon{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
                @keyframes slideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
                @keyframes fadeIn{from{opacity:0}to{opacity:1}}
            `}</style>

            {/* Decoración */}
            <div style={{position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none'}}>
                <div style={{position:'absolute',top:'-20%',right:'-20%',width:'60vw',height:'60vw',
                    borderRadius:'50%',background:'rgba(255,215,0,0.03)'}} />
                <svg style={{position:'absolute',inset:0,width:'100%',height:'100%'}} viewBox="0 0 400 700" fill="none" preserveAspectRatio="xMidYMid slice">
                    <rect x="40" y="40" width="320" height="620" stroke="#FFD700" strokeWidth="0.4" opacity="0.05" rx="2"/>
                    <line x1="40" y1="350" x2="360" y2="350" stroke="#FFD700" strokeWidth="0.4" opacity="0.04"/>
                    <circle cx="200" cy="350" r="60" stroke="#FFD700" strokeWidth="0.4" opacity="0.04"/>
                </svg>
            </div>

            {/* Contenido scrollable */}
            <div key={slide} style={{
                flex:1, overflowY:'auto', display:'flex', flexDirection:'column',
                alignItems:'center', justifyContent:'center',
                padding:'24px 28px 100px', position:'relative', zIndex:2,
                animation:'slideUp .35s ease both',
            }}>
                {renderSlide()}
            </div>

            {/* Barra inferior fija */}
            <div style={{
                position:'absolute', bottom:0, left:0, right:0, zIndex:10,
                display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'14px 20px 28px',
                background:'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)',
            }}>
                <button onClick={function() { if(slide>0) setSlide(function(v){return v-1;}); }}
                    style={{fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:2,
                        background:'rgba(255,255,255,0.08)',color:'rgba(255,255,255,0.5)',
                        border:'none',borderRadius:24,padding:'11px 20px',cursor:'pointer',
                        opacity:slide===0?0.2:1,textTransform:'uppercase'}}>← Atrás</button>

                {/* Dots */}
                <div style={{display:'flex',gap:5,alignItems:'center'}}>
                    {Array.from({length:TOTAL_SLIDES},function(_,i) {
                        return <div key={i} onClick={function(){setSlide(i);}}
                            style={{width:i===slide?18:5,height:5,borderRadius:3,cursor:'pointer',
                                background:i===slide?'#FFD700':'rgba(255,215,0,0.2)',
                                transition:'all .3s ease'}} />;
                    })}
                </div>

                <button onClick={siguiente}
                    style={{fontFamily:"'Teko',sans-serif",fontSize:slide===TOTAL_SLIDES-1?13:15,letterSpacing:2,
                        background:slide===TOTAL_SLIDES-1?'#FFD700':'rgba(255,215,0,0.15)',
                        color:slide===TOTAL_SLIDES-1?'#001F6B':'#FFD700',
                        border:slide===TOTAL_SLIDES-1?'none':'1px solid rgba(255,215,0,0.3)',
                        borderRadius:24,padding:'11px 20px',cursor:'pointer',textTransform:'uppercase',
                        boxShadow:slide===TOTAL_SLIDES-1?'0 6px 28px rgba(255,215,0,0.35)':'none'}}>
                    {slide===TOTAL_SLIDES-1?'¡CREAR MI PERFIL!':'Siguiente →'}
                </button>
            </div>

            {/* Botón saltar */}
            {slide < TOTAL_SLIDES-1 && (
                <button onClick={cerrar}
                    style={{position:'absolute',top:16,right:16,zIndex:20,
                        background:'none',border:'none',fontFamily:"'Inter',sans-serif",
                        fontSize:11,color:'rgba(255,255,255,0.2)',cursor:'pointer',letterSpacing:1}}>
                    Saltar
                </button>
            )}

            {/* Contador */}
            <div style={{position:'absolute',top:16,left:16,zIndex:20,
                fontFamily:"'Teko',sans-serif",fontSize:12,letterSpacing:3,
                color:'rgba(255,215,0,0.25)',textTransform:'uppercase'}}>
                {slide+1} / {TOTAL_SLIDES}
            </div>
        </div>
    );
};


// ============================================================================
// --- MIS 5 ESTRELLAS MODAL — acceso flotante desde Mi Jornada ---
// ============================================================================
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
        if (guardado) return;
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
                            {/* Selección actual */}
                            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16,minHeight:36}}>
                                {seleccion.map(function(j,i) {
                                    return (
                                        <span key={i} onClick={function() { if (!guardado) toggle(j); }}
                                            style={{background:G.golden,color:'#001F6B',borderRadius:20,padding:'5px 12px',
                                                fontFamily:"'Inter',sans-serif",fontSize:12,fontWeight:600,cursor: guardado?'default':'pointer'}}>
                                            ⭐ {j.nombre}
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
                            {!guardado && (
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
                                                {j.imageUrl ? (
                                                    <img src={j.imageUrl} alt={j.nombre}
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

                            {guardado ? (
                                <div style={{background:'rgba(16,185,129,0.08)',border:'1px solid rgba(16,185,129,0.2)',borderRadius:12,padding:16,textAlign:'center'}}>
                                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:16,color:'#10b981',letterSpacing:2}}>✅ ESTRELLAS GUARDADAS</p>
                                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:G.deepBlue,opacity:.5,marginTop:4}}>Editables hasta 45 min antes del partido</p>
                                    <button onClick={function() { setGuardado(false); }}
                                        style={{marginTop:10,background:'none',border:'1px solid rgba(0,31,107,0.2)',borderRadius:20,
                                            padding:'6px 16px',cursor:'pointer',fontFamily:"'Inter',sans-serif",fontSize:11,color:G.deepBlue}}>
                                        Modificar selección
                                    </button>
                                </div>
                            ) : seleccion.length > 0 && (
                                <button onClick={guardar} disabled={guardando}
                                    style={{width:'100%',fontFamily:"'Teko',sans-serif",fontSize:'1.1rem',letterSpacing:2,
                                        background:G.deepBlue,color:'#FFD700',border:'none',borderRadius:30,padding:14,cursor:'pointer'}}>
                                    {guardando ? 'GUARDANDO...' : 'CONFIRMAR ' + seleccion.length + ' ESTRELLA' + (seleccion.length>1?'S':'')}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// --- PORRA ANUAL MODAL ---
// ============================================================================
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


const LaJornadaScreen = ({ userProfiles, onlineUsers, teamLogos }) => {
    var G = styles.colors;
    var [jornada, setJornada] = useState(null);
    var [participantes, setParticipantes] = useState([]);
    var [elOtroTodos, setElOtroTodos] = useState({});
    var [loading, setLoading] = useState(true);

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
                        <img src={'/escudo.png'} alt="UDLP"
                            style={{width:52,height:52,objectFit:'contain',filter:'drop-shadow(0 2px 8px rgba(0,0,0,0.3))'}}
                            onError={function(e){e.target.style.display='none';}} />
                        <span style={{fontFamily:"'Teko',sans-serif",fontSize:13,color:'rgba(255,255,255,0.6)',letterSpacing:1,textTransform:'uppercase'}}>
                            {jornada.udlpEsLocal ? 'UD Las Palmas' : jornada.equipoLocal}
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
                        <div style={{width:52,height:52,background:'rgba(255,255,255,0.08)',borderRadius:'50%',
                            display:'flex',alignItems:'center',justifyContent:'center',
                            fontFamily:"'Teko',sans-serif",fontSize:11,color:'rgba(255,255,255,0.4)',textAlign:'center',letterSpacing:0.5}}>
                            {jornada.udlpEsLocal ? jornada.equipoVisitante.split(' ').slice(-1)[0] : 'UDLP'}
                        </div>
                        <span style={{fontFamily:"'Teko',sans-serif",fontSize:13,color:'rgba(255,255,255,0.6)',letterSpacing:1,textTransform:'uppercase'}}>
                            {jornada.udlpEsLocal ? jornada.equipoVisitante : 'UD Las Palmas'}
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
                        {/* Avatares de quién ha apostado ya */}
                        <div style={{display:'flex',flexWrap:'wrap',gap:12,justifyContent:'center',marginTop:20}}>
                            {participantes.map(function(p) {
                                var perf = userProfiles[p.id] || {};
                                var otro = elOtroTodos[p.id];
                                return (
                                    <PlayerAvatar key={p.id} name={p.id} perfil={perf} elOtroData={otro} size={44} showElOtro={true} />
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div style={{padding:'8px 0'}}>
                        {participantes.sort(function(a,b) { return (b.puntosObtenidos||0)-(a.puntosObtenidos||0); }).map(function(p) {
                            var ganador = ganadoresExactos.find(function(g) { return g.id === p.id; });
                            var perf = userProfiles[p.id] || {};
                            var otro = elOtroTodos[p.id];
                            var elOtroActivado = p.elOtroActivado;
                            return (
                                <div key={p.id} style={{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',
                                    borderBottom:'1px solid rgba(0,31,107,0.05)',
                                    background: ganador ? 'rgba(255,215,0,0.06)' : 'transparent'}}>
                                    {/* Avatar con burbuja El Otro Equipo */}
                                    <PlayerAvatar name={p.id} perfil={perf} elOtroData={otro} size={40} showElOtro={true} />
                                    <div style={{flex:1}}>
                                        {/* Marcador apostado */}
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
                                            {elOtroActivado && otro && (
                                                <span style={{fontFamily:"'Inter',sans-serif",fontSize:10,
                                                    background:'rgba(0,31,107,0.08)',color:G.deepBlue,
                                                    padding:'2px 8px',borderRadius:10}}>
                                                    El Otro {otro.revelado ? '· ' + otro.equipo : '🛡️'}
                                                </span>
                                            )}
                                            {ganador && <span style={{fontSize:14}}>🏆</span>}
                                        </div>
                                    </div>
                                    {/* Puntos */}
                                    {(jornada.estado==='Finalizada' || isLive) && (
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

const ClasificacionScreen = ({ currentUser, userProfiles, onlineUsers }) => {
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
            <h2 style={styles.title} className="app-title">CLASIFICACIÓN GLOBAL</h2>
            
            <div style={styles.prizeBannerFinal}>
                <h4 style={styles.prizeBannerTitle}>PREMIO FINAL ACUMULADO</h4>
                <div style={styles.prizeList}>
                    <div style={styles.prizeItem}><span style={{fontSize: '1.5rem'}}>🥇</span> <span><strong>1º CLASIFICADO:</strong> Premio a elegir valorado en 40€</span></div>
                    <div style={styles.prizeItem}><span style={{fontSize: '1.5rem'}}>🥈</span> <span><strong>2º CLASIFICADO:</strong> Premio a elegir valorado en 15€</span></div>
                    <div style={styles.prizeItem}><span style={{fontSize: '1.5rem'}}>🥉</span> <span><strong>3º CLASIFICADO:</strong> Premio a elegir valorado en 5€</span></div>
                </div>
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

const PagosScreen = () => {
    const [jornadas, setJornadas] = useState([]); 
    const [loading, setLoading] = useState(true); 
    
    useEffect(() => {
        const unsub = onSnapshot(query(collection(db, "jornadas"), orderBy("numeroJornada")), (jornadasSnap) => {
            const jornadasData = jornadasSnap.docs.map(jDoc => ({ id: jDoc.id, ...jDoc.data() }));
            const promises = jornadasData.map(j => getDocs(collection(db, "pronosticos", j.id, "jugadores")));
            Promise.all(promises).then(pSnaps => {
                const jConP = jornadasData.map((j, index) => {
                    const pronosticos = pSnaps[index].docs.map(doc => ({id: doc.id, ...doc.data()}));
                    const costeBase = j.esVip ? APUESTA_VIP : APUESTA_NORMAL;
                    
                    let rec = 0;
                    pronosticos.forEach(p => {
                        rec += costeBase;
                        if (p.jokerActivo && p.jokerPronosticos) {
                            const huecosRellenos = p.jokerPronosticos.filter(jp => jp.local !== '' && jp.visitante !== '').length;
                            rec += huecosRellenos * costeBase;
                        }
                    });
                    
                    const premio = (parseFloat(j.bote) || 0) + rec;
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
            
            <div style={styles.prizeBannerFinal}>
                <h4 style={styles.prizeBannerTitle}>PREMIO FINAL ACUMULADO</h4>
                <div style={styles.prizeList}>
                    <div style={styles.prizeItem}><span style={{fontSize: '1.5rem'}}>🥇</span> <span><strong>1º CLASIFICADO:</strong> Premio a elegir valorado en 40€</span></div>
                    <div style={styles.prizeItem}><span style={{fontSize: '1.5rem'}}>🥈</span> <span><strong>2º CLASIFICADO:</strong> Premio a elegir valorado en 15€</span></div>
                    <div style={styles.prizeItem}><span style={{fontSize: '1.5rem'}}>🥉</span> <span><strong>3º CLASIFICADO:</strong> Premio a elegir valorado en 5€</span></div>
                </div>
            </div>

            <div style={{marginTop: '30px'}}>
                {jornadas.filter(j => j.estado === 'Finalizada').reverse().map(j => {
                    const jConBote = !j.ganadores || j.ganadores.length === 0;
                    return (
                        <div key={j.id} style={{backgroundColor: 'rgba(0,0,0,0.3)', padding: '25px', borderRadius: '16px', marginBottom: '25px', border: `1px solid rgba(255,215,0,0.15)`, boxShadow: '0 5px 15px rgba(0,0,0,0.2)'}}>
                            <h4 style={{fontFamily: "'Oswald', sans-serif", color: styles.colors.lightText, fontSize: '1.3rem', marginBottom: '15px', letterSpacing: '1px', textTransform: 'uppercase'}}>{getNombreJornada(j.numeroJornada)}: {j.equipoLocal} vs {j.equipoVisitante}</h4>
                            <div style={{display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '15px', marginBottom: '20px', color: styles.colors.golden, fontSize: '0.9rem', backgroundColor: 'rgba(0,0,0,0.4)', padding: '15px', borderRadius: '12px'}}>
                                <span><strong style={{color: styles.colors.silver}}>Recaudado:</strong> {j.recaudadoJornada}€</span>
                                <span><strong style={{color: styles.colors.silver}}>Bote Ini:</strong> {j.bote || 0}€</span>
                                <span><strong style={{color: styles.colors.silver}}>Total Juego:</strong> {j.premioTotal}€</span>
                            </div>
                            {jConBote ? (
                                <div style={{textAlign: 'center', padding: '15px', backgroundColor: 'rgba(230, 57, 70, 0.1)', borderRadius: '12px', border: `1px solid rgba(230,57,70,0.3)`, color: styles.colors.danger, fontWeight: 'bold', letterSpacing: '1px'}}>💰 BOTE ACUMULADO. EL PREMIO PASA A LA SIGUIENTE JORNADA.</div>
                            ) : (
                                <div style={{textAlign: 'center', padding: '15px', backgroundColor: 'rgba(212, 175, 55, 0.05)', borderRadius: '12px', border: `1px solid rgba(212,175,55,0.4)`}}>
                                    <p style={{marginBottom: '10px', fontSize: '1.05rem'}}><strong>🏆 Ganador(es) Resultado Exacto:</strong> {j.ganadores.join(', ')}</p>
                                    <p style={{color: styles.colors.success, fontWeight: 'bold', fontSize: '1.1rem', fontFamily: "'Oswald', sans-serif", letterSpacing: '1px'}}>Premio por ganador: {(j.premioTotal / j.ganadores.length).toFixed(2)}€</p>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    );
};

const EstadisticasScreen = ({ userProfiles, onlineUsers }) => {
    var G = styles.colors;
    var [clasificacion, setClasificacion] = useState([]);
    var [loading, setLoading] = useState(true);
    var [mostrarHistorico, setMostrarHistorico] = useState(false);

    // Clasificación histórica 25/26 (conservada para referencia del orden de El Otro)
    var HISTORICO_2526 = [
        { pos:1, nombre:'Pedrito',  pts:62, nota:'Orden 1 — El Otro Equipo 26/27' },
        { pos:2, nombre:'Sarito',   pts:58, nota:'Orden 2 — El Otro Equipo 26/27' },
        { pos:3, nombre:'Carmelo',  pts:55, nota:'Orden 3 — El Otro Equipo 26/27' },
        { pos:4, nombre:'Himar',    pts:52, nota:'Orden 4 — El Otro Equipo 26/27' },
        { pos:5, nombre:'Javi',     pts:49, nota:'Orden 5 — El Otro Equipo 26/27' },
        { pos:6, nombre:'Pedro',    pts:46, nota:'Orden 6 — El Otro Equipo 26/27' },
        { pos:7, nombre:'Juanma',   pts:43, nota:'Orden 7 — El Otro Equipo 26/27' },
        { pos:8, nombre:'José',     pts:40, nota:'Orden 8 — El Otro Equipo 26/27' },
        { pos:9, nombre:'Vicky',    pts:37, nota:'Orden 9 — El Otro Equipo 26/27' },
        { pos:10,nombre:'Mari',     pts:34, nota:'Orden 10 — El Otro Equipo 26/27' },
        { pos:11,nombre:'Lucy',     pts:31, nota:'Orden 11 — El Otro Equipo 26/27' },
        { pos:12,nombre:'Claudio',  pts:28, nota:'Orden 12 — El Otro Equipo 26/27' },
        { pos:13,nombre:'Laura',    pts:25, nota:'Orden 13 — El Otro Equipo 26/27' },
        { pos:14,nombre:'Carlos',   pts:22, nota:'Orden 14 — El Otro Equipo 26/27' },
        { pos:15,nombre:'Antonio',  pts:19, nota:'Orden 15 — El Otro Equipo 26/27' },
    ];

    useEffect(function() {
        var unsub = onSnapshot(collection(db, "clasificacion"), function(snap) {
            var datos = snap.docs.map(function(d) { return { id: d.id, ...d.data() }; })
                .sort(function(a,b) { return (b.puntosTotales||0) - (a.puntosTotales||0); });
            setClasificacion(datos);
            setLoading(false);
        });
        return function() { unsub(); };
    }, []);

    if (loading) return <LoadingSkeleton />;

    return (
        <div style={{paddingBottom:40}}>
            <h2 style={styles.title}>ESTADÍSTICAS 26/27</h2>

            {/* Clasificación actual */}
            <div style={{background:'#fff',borderRadius:16,border:'1px solid rgba(0,31,107,0.08)',overflow:'hidden',marginBottom:20}}>
                <div style={{background:'#001F6B',padding:'14px 16px'}}>
                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:3,color:'rgba(255,255,255,0.5)',textTransform:'uppercase'}}>
                        Clasificación general — Temporada 26/27
                    </p>
                </div>
                {clasificacion.length === 0 ? (
                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:13,color:G.deepBlue,opacity:.5,padding:24,textAlign:'center'}}>
                        La temporada acaba de empezar. Los puntos aparecerán aquí tras la primera jornada.
                    </p>
                ) : clasificacion.map(function(j, i) {
                    var online = onlineUsers && onlineUsers[j.id];
                    return (
                        <div key={j.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',
                            borderBottom:'1px solid rgba(0,31,107,0.05)',
                            background: i === 0 ? 'rgba(255,215,0,0.06)' : 'transparent'}}>
                            <span style={{fontFamily:"'Teko',sans-serif",fontSize:20,fontWeight:700,
                                color: i===0?'#FFD700':i===1?'rgba(0,31,107,0.5)':i===2?'rgba(0,31,107,0.4)':'rgba(0,31,107,0.25)',
                                width:28,textAlign:'center'}}>{i+1}</span>
                            <div style={{width:8,height:8,borderRadius:'50%',flexShrink:0,
                                background: online ? '#10b981' : 'rgba(0,31,107,0.15)'}} />
                            <span style={{flex:1,fontFamily:"'Teko',sans-serif",fontSize:17,letterSpacing:1,
                                textTransform:'uppercase',color:G.deepBlue}}>{j.id}</span>
                            <span style={{fontFamily:"'Teko',sans-serif",fontSize:20,fontWeight:700,color:G.deepBlue}}>
                                {j.puntosTotales||0} <span style={{fontSize:12,opacity:.4,fontWeight:400}}>pts</span>
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Botón para ver histórico */}
            <button onClick={function() { setMostrarHistorico(function(v) { return !v; }); }}
                style={{width:'100%',background:'rgba(0,31,107,0.05)',border:'1px solid rgba(0,31,107,0.1)',
                    borderRadius:12,padding:'12px 16px',cursor:'pointer',display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
                <i className="ti ti-history" style={{fontSize:18,color:G.deepBlue,opacity:.5}} aria-hidden="true" />
                <span style={{fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:2,color:G.deepBlue,textTransform:'uppercase',flex:1,textAlign:'left'}}>
                    Ver clasificación 25/26 (orden de El Otro)
                </span>
                <span style={{color:G.deepBlue,opacity:.4}}>{mostrarHistorico?'▲':'▼'}</span>
            </button>

            {mostrarHistorico && (
                <div style={{background:'rgba(0,31,107,0.03)',borderRadius:14,border:'1px solid rgba(0,31,107,0.08)',overflow:'hidden',marginBottom:20}}>
                    <div style={{padding:'12px 16px',borderBottom:'1px solid rgba(0,31,107,0.06)'}}>
                        <p style={{fontFamily:"'Teko',sans-serif",fontSize:13,letterSpacing:2,color:G.deepBlue,opacity:.5,textTransform:'uppercase'}}>
                            Temporada 25/26 — Solo informativo
                        </p>
                        <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:G.deepBlue,opacity:.4,marginTop:4}}>
                            Este orden determina quién elige primero en El Otro 26/27. Cada jugador tiene 60 minutos para elegir antes de que pase al siguiente.
                        </p>
                    </div>
                    {HISTORICO_2526.map(function(j) {
                        return (
                            <div key={j.pos} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 16px',
                                borderBottom:'1px solid rgba(0,31,107,0.04)'}}>
                                <span style={{fontFamily:"'Teko',sans-serif",fontSize:18,fontWeight:700,
                                    color:'rgba(0,31,107,0.3)',width:28,textAlign:'center'}}>{j.pos}</span>
                                <span style={{flex:1,fontFamily:"'Teko',sans-serif",fontSize:16,letterSpacing:1,
                                    textTransform:'uppercase',color:G.deepBlue,opacity:.7}}>{j.nombre}</span>
                                <span style={{fontFamily:"'Inter',sans-serif",fontSize:10,
                                    color:G.deepBlue,opacity:.35}}>{j.nota}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};


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
                    } else if (pronU.jokerActivo && pronU.jokerPronosticos) {
                        for (let jp of pronU.jokerPronosticos) {
                            if (jp.local !== '' && jp.visitante !== '' &&
                                parseInt(jp.local) === resL && parseInt(jp.visitante) === resV) {
                                ptosExacto = esVipU ? 6 : 3; break;
                            }
                        }
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
                    jokerActivo: false,
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

            pSnap.forEach(docSnap => {
                const p = docSnap.data();
                const userId = docSnap.id;
                let isWinner = false;
                let ptosJornada = 0; let ptosExacto = 0; let ptosGol = 0;

                // 1. EXACTO Y JOKER
                if (parseInt(p.golesLocal) === resL && parseInt(p.golesVisitante) === resV) {
                    isWinner = true; ptosExacto += esVip ? 6 : 3;
                } else if (p.jokerActivo && p.jokerPronosticos) {
                    for (let jp of p.jokerPronosticos) {
                        if (jp.local !== '' && jp.visitante !== '' && parseInt(jp.local) === resL && parseInt(jp.visitante) === resV) {
                            isWinner = true; ptosExacto += esVip ? 6 : 3; break;
                        }
                    }
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
        if (estado === 'Finalizada' && !puntosYaCalculados) alert('¡JORNADA FINALIZADA! Puntos sumados.'); else alert('Jornada guardada.');
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
                <div style={{display: 'flex', gap: '10px'}}>
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
                <div><label style={styles.label}>Cierre Apuestas:</label><input type="datetime-local" value={fechaCierre} onChange={(e) => setFechaCierre(e.target.value)} style={styles.input} /></div>
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

const AdminPanelScreen = ({ plantilla, jugadores }) => {
    var [jornadas, setJornadas] = useState([]);
    var [expandida, setExpandida] = useState(null); // ID de la jornada expandida
    var [sincronizando, setSincronizando] = useState(false);
    var [msgSync, setMsgSync] = useState('');

    useEffect(function() { 
        var unsub = onSnapshot(
            query(collection(db, "jornadas"), orderBy("numeroJornada", "asc")), // J1 primero
            function(snap) { 
                var jornadasData = snap.docs.map(function(d) { return { id: d.id, ...d.data() }; });
                setJornadas(jornadasData);
                // Auto-expandir la primera jornada abierta o en vivo (solo si no hay ninguna expandida)
                setExpandida(function(actual) {
                    if (actual !== null) return actual;
                    var activa = snap.docs.find(function(d) {
                        return d.data().estado === 'Abierta' || d.data().estado === 'En vivo';
                    });
                    return activa ? activa.id : null;
                });
            }
        ); 
        return function() { unsub(); }; 
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Sincronizar resultado en directo desde API-Football
    var sincronizarConAPI = async function(jornada) {
        if (!API_FOOTBALL_KEY) { setMsgSync('⚠️ Configura REACT_APP_API_FOOTBALL_KEY en .env'); return; }
        setSincronizando(true);
        setMsgSync('Consultando API-Football...');
        try {
            var fecha = jornada.fecha; // formato YYYY-MM-DD
            var url = 'https://v3.football.api-sports.io/fixtures?league=141&season=2025&date=' + fecha + '&team=275';
            var res = await fetch(url, { headers: { 'x-apisports-key': API_FOOTBALL_KEY } });
            var data = await res.json();
            if (data.response && data.response.length > 0) {
                var fixture = data.response[0];
                var golesLocal = fixture.goals.home;
                var golesVisitante = fixture.goals.away;
                var isLive = fixture.fixture.status.short === 'LIVE' || fixture.fixture.status.short === '1H' || fixture.fixture.status.short === '2H' || fixture.fixture.status.short === 'HT';
                // Buscar primer goleador
                var primerGoleador = '';
                var eventos = fixture.events || [];
                var primerGol = eventos.find(function(e) { return e.type === 'Goal' && e.detail !== 'Missed Penalty'; });
                if (primerGol) primerGoleador = primerGol.player.name;

                await setDoc(doc(db, "jornadas", jornada.id), {
                    liveData: { golesLocal, golesVisitante, primerGoleador, isLive, actualizadoEn: new Date().toISOString() }
                }, { merge: true });
                setMsgSync('✅ Datos actualizados: ' + golesLocal + '-' + golesVisitante + (isLive ? ' (EN VIVO)' : ''));
            } else {
                setMsgSync('ℹ️ No se encontró partido en esta fecha en la API.');
            }
        } catch(e) {
            setMsgSync('❌ Error: ' + e.message);
        }
        setSincronizando(false);
    };

    var jornadaActiva = jornadas.find(function(j) { return j.estado === 'Abierta' || j.estado === 'En vivo'; });

    return (
        <div style={{paddingBottom: 40}}>
            <h2 style={styles.title}>PANEL DE CONTROL 26/27</h2>

            {/* Botón de sincronización con API */}
            {jornadaActiva && (
                <div style={{background:'rgba(0,31,107,0.05)',borderRadius:14,padding:16,marginBottom:20,border:'1px solid rgba(0,31,107,0.1)'}}>
                    <p style={{fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:2,color:'#001F6B',textTransform:'uppercase',marginBottom:10,fontWeight:600}}>
                        API-Football — J{jornadaActiva.numeroJornada}
                    </p>
                    <button onClick={function() { sincronizarConAPI(jornadaActiva); }} disabled={sincronizando}
                        style={{background:'#001F6B',color:'#FFD700',border:'none',borderRadius:10,padding:'10px 20px',
                            fontFamily:"'Teko',sans-serif",fontSize:15,letterSpacing:2,cursor:'pointer',textTransform:'uppercase'}}>
                        {sincronizando ? 'Sincronizando...' : '↻ Sincronizar resultado en directo'}
                    </button>
                    {msgSync && <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'#001F6B',marginTop:8,opacity:.7}}>{msgSync}</p>}
                </div>
            )}

            <AdminCierreTemporada />

            {/* Lista de jornadas en acordeón — J1 primero */}
            <div style={{marginTop:16}}>
                {jornadas.map(function(j) {
                    var abierta = expandida === j.id;
                    var estadoColor = j.estado === 'Abierta' ? '#10b981' : j.estado === 'En vivo' ? '#e63946' : j.estado === 'Finalizada' ? '#001F6B' : 'rgba(0,31,107,0.3)';
                    return (
                        <div key={j.id} style={{marginBottom:6,border:'1px solid rgba(0,31,107,0.1)',borderRadius:12,overflow:'hidden'}}>
                            {/* Cabecera colapsable */}
                            <button onClick={function() { setExpandida(abierta ? null : j.id); }}
                                style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'12px 16px',
                                    background: abierta ? '#001F6B' : '#fff',border:'none',cursor:'pointer',textAlign:'left'}}>
                                <span style={{fontFamily:"'Teko',sans-serif",fontSize:18,fontWeight:700,color: abierta ? '#FFD700' : '#001F6B',minWidth:28}}>
                                    J{j.numeroJornada}
                                </span>
                                <span style={{fontFamily:"'Teko',sans-serif",fontSize:15,letterSpacing:1,
                                    color: abierta ? 'rgba(255,255,255,0.8)' : '#001F6B',flex:1,textTransform:'uppercase'}}>
                                    {j.equipoLocal} vs {j.equipoVisitante}
                                </span>
                                <span style={{fontFamily:"'Inter',sans-serif",fontSize:10,background: estadoColor + '20',
                                    color: estadoColor, padding:'3px 10px',borderRadius:10,border:'1px solid ' + estadoColor + '40'}}>
                                    {j.estado}
                                </span>
                                {j.derbi && <span style={{fontSize:14}}>🔥</span>}
                                <span style={{color: abierta ? '#FFD700' : 'rgba(0,31,107,0.4)',fontSize:16}}>{abierta ? '▲' : '▼'}</span>
                            </button>
                            {/* Contenido expandido */}
                            {abierta && (
                                <div style={{padding:'0 0 8px'}}>
                                    <JornadaAdminItem jornada={j} plantilla={plantilla} />
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
const PLAZO_APERTURA_EL_OTRO = new Date('2026-08-11T11:00:00Z');
const PLAZO_EL_OTRO = new Date('2026-08-14T17:00:00Z');
// Tiempo máximo por turno antes de saltarlo: 60 minutos
const TIMEOUT_TURNO_MINUTOS = 60;

const ElOtroScreen = ({ currentUser, userProfiles }) => {
    var G = styles.colors;
    var [miElOtro, setMiElOtro] = useState(null);
    var [todosElOtro, setTodosElOtro] = useState({});
    var [ordenFinal, setOrdenFinal] = useState([]);
    var [turnoActual, setTurnoActual] = useState(null);
    var [tiempoRestante, setTiempoRestante] = useState(null);
    var [guardando, setGuardando] = useState(false);
    var [loading, setLoading] = useState(true);
    var [equiposDisponibles, setEquiposDisponibles] = useState(EQUIPOS_PRIMERA_DIVISION);

    useEffect(function() {
        if (!currentUser) return;
        var unsub = onSnapshot(collection(db, "elOtro"), function(snap) {
            var datos = {};
            snap.forEach(function(d) { datos[d.id] = d.data(); });
            setTodosElOtro(datos);

            // Construir orden final: base + jugadores nuevos no en la lista base
            var nuevos = Object.keys(datos).filter(function(j) {
                return ORDEN_ELECCION_EL_OTRO.indexOf(j) === -1 && !datos[j].equipo;
            });
            var ordenConf = [].concat(ORDEN_ELECCION_EL_OTRO, nuevos);
            setOrdenFinal(ordenConf);

            // Calcular quién tiene el turno ahora mismo
            var equiposTomados = Object.values(datos).map(function(d) { return d.equipo; }).filter(Boolean);
            setEquiposDisponibles(EQUIPOS_PRIMERA_DIVISION.filter(function(e) { return equiposTomados.indexOf(e) === -1; }));

            // El turno es del primer jugador en el orden que aún no ha elegido
            var turno = null;
            for (var i = 0; i < ordenConf.length; i++) {
                var j = ordenConf[i];
                if (!datos[j] || !datos[j].equipo) {
                    // Verificar si este jugador ha sobrepasado su tiempo (saltado)
                    var saltado = datos[j] && datos[j].saltado;
                    if (!saltado) { turno = j; break; }
                }
            }
            setTurnoActual(turno);

            // Mi dato
            if (datos[currentUser]) setMiElOtro(datos[currentUser]);
            else setMiElOtro(null);
            setLoading(false);
        });
        return function() { unsub(); };
    }, [currentUser]);

    // Temporizador: si es mi turno, mostrar cuenta atrás de 60 minutos
    useEffect(function() {
        if (turnoActual !== currentUser) { setTiempoRestante(null); return; }
        var datos = todosElOtro[currentUser];
        if (!datos || !datos.turnoIniciadoEn) return;

        var intervalo = setInterval(function() {
            var ahora = new Date();
            var inicio = datos.turnoIniciadoEn.toDate ? datos.turnoIniciadoEn.toDate() : new Date(datos.turnoIniciadoEn);
            var transcurrido = (ahora - inicio) / 1000 / 60;
            var restante = TIMEOUT_TURNO_MINUTOS - transcurrido;
            if (restante <= 0) {
                setTiempoRestante(0);
                clearInterval(intervalo);
            } else {
                setTiempoRestante(Math.ceil(restante));
            }
        }, 10000);
        return function() { clearInterval(intervalo); };
    }, [turnoActual, currentUser, todosElOtro]);

    var elegirEquipo = function(equipo) {
        if (guardando) return;
        if (turnoActual !== currentUser) return;
        if (miElOtro && miElOtro.equipo) return;
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
        });
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

    if (loading) return <div style={{padding:40,textAlign:'center',color:G.deepBlue,fontFamily:"'Teko',sans-serif",fontSize:20,letterSpacing:2}}>CARGANDO...</div>;

    return (
        <div style={{padding:'16px 0'}}>
            <h2 style={styles.title}>EL OTRO</h2>

            {/* Reglas */}
            <div style={{background:'rgba(0,31,107,0.04)',borderRadius:14,padding:16,marginBottom:20,border:'1px solid rgba(0,31,107,0.08)'}}>
                <p style={{fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:2,color:G.deepBlue,textTransform:'uppercase',marginBottom:8,fontWeight:600}}>Cómo funciona</p>
                <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:G.deepBlue,opacity:.7,lineHeight:1.7,margin:0}}>
                    Cada jugador tiene un equipo de Primera División asignado para <strong>toda la temporada</strong>, de forma pública. Cada jornada decides si activarlo o no. Si tu equipo <strong>gana</strong> → ×2 puntos. Si <strong>empata</strong> → sin efecto. Si <strong>pierde</strong> → ÷2 (redondeo a la baja). Mínimo <strong>3 activaciones</strong> en la temporada. El equipo es secreto hasta que decidas revelarlo — y no podrás ocultarlo de nuevo.
                </p>
            </div>

            {/* Plazo */}
            <div style={{background: plazoSuperado ? 'rgba(230,57,70,0.08)' : 'rgba(255,215,0,0.1)', borderRadius:12, padding:'10px 16px', marginBottom:20, border:`1px solid ${plazoSuperado ? 'rgba(230,57,70,0.3)' : 'rgba(255,215,0,0.3)'}`, display:'flex', alignItems:'center', gap:10}}>
                <i className="ti ti-clock" style={{fontSize:18, color: plazoSuperado ? G.danger : G.golden}} aria-hidden="true" />
                <span style={{fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:1,color: plazoSuperado ? G.danger : G.deepBlue}}>
                    {plazoSuperado ? 'PLAZO CERRADO' : 'Plazo límite: Jueves 13 Ago · 23:59h'}
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
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:8}}>
                        {equiposDisponibles.map(function(equipo) {
                            return (
                                <button key={equipo} onClick={function() { elegirEquipo(equipo); }} disabled={guardando}
                                    style={{padding:'14px 8px',borderRadius:12,border:'1.5px solid rgba(0,31,107,0.15)',
                                        background:'#fff',fontFamily:"'Teko',sans-serif",fontSize:15,fontWeight:600,letterSpacing:1,
                                        color:G.deepBlue,cursor:'pointer',textAlign:'center',transition:'all .2s',textTransform:'uppercase'}}>
                                    {equipo}
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
                    {turnoActual && <p style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:G.deepBlue,opacity:.5,marginTop:4}}>Ahora está eligiendo: <strong>{turnoActual}</strong></p>}
                    <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:G.deepBlue,opacity:.4,marginTop:8}}>Recibirás acceso automáticamente cuando te toque</p>
                </div>
            )}

            {/* Estado del draft — quién ha elegido ya */}
            <div style={{marginTop:24}}>
                <p style={{fontFamily:"'Teko',sans-serif",fontSize:13,letterSpacing:3,color:G.deepBlue,opacity:.4,textTransform:'uppercase',marginBottom:12}}>Estado del draft</p>
                {ordenFinal.map(function(jugador, i) {
                    var datos = todosElOtro[jugador] || {};
                    var eligió = !!datos.equipo;
                    var esTurno = turnoActual === jugador;
                    var esSaltado = !!datos.saltado;
                    return (
                        <div key={jugador} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:'1px solid rgba(0,31,107,0.05)'}}>
                            <span style={{fontFamily:"'Teko',sans-serif",fontSize:16,color:esTurno ? '#FFD700' : 'rgba(0,31,107,0.3)',width:24,textAlign:'center',fontWeight:700}}>{i+1}</span>
                            <span style={{flex:1,fontFamily:"'Teko',sans-serif",fontSize:16,letterSpacing:1,color: eligió ? G.deepBlue : esTurno ? G.deepBlue : 'rgba(0,31,107,0.4)',textTransform:'uppercase'}}>{jugador}</span>
                            {eligió && <span style={{fontFamily:"'Inter',sans-serif",fontSize:11,background:'rgba(16,185,129,0.1)',color:'#10b981',padding:'3px 10px',borderRadius:10}}>✓ Elegido</span>}
                            {!eligió && esTurno && !esSaltado && <span style={{fontFamily:"'Inter',sans-serif",fontSize:11,background:'rgba(255,215,0,0.15)',color:'#d4af37',padding:'3px 10px',borderRadius:10}}>← Turno</span>}
                            {esSaltado && <span style={{fontFamily:"'Inter',sans-serif",fontSize:11,background:'rgba(230,57,70,0.1)',color:G.danger,padding:'3px 10px',borderRadius:10}}>Saltado</span>}
                            {!eligió && !esTurno && !esSaltado && <span style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:'rgba(0,31,107,0.25)'}}>Pendiente</span>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ============================================================================
// --- MIS 5 ESTRELLAS — Selección de jugadores UDLP por jornada ---
// ============================================================================
const MisEstrellasScreen = ({ currentUser, plantilla, userProfiles }) => {
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
        if (yaGuardado) return;
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

    const posiciones = ['Todos', 'Portero', 'Defensa', 'Centrocampista', 'Delantero'];
    const plantillaFiltrada = posicionFiltro === 'Todos' ? plantilla : plantilla.filter(j => j.posicion === posicionFiltro);
    const maxEstrellas = miBeneficio === 'sexta_estrella' ? 6 : 5;

    if (loading) return <div style={{padding:40,textAlign:'center',color:G.deepBlue}}>Cargando...</div>;

    return (
        <div style={{padding:'20px 16px'}}>
            <h2 style={styles.title}>MIS 5 ESTRELLAS</h2>

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
                    </p>

                    {/* Selección actual */}
                    <div style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'center',marginBottom:20,minHeight:44}}>
                        {seleccion.map((j,i) => (
                            <span key={i} onClick={() => toggleJugador(j)} style={{
                                background:G.golden,color:'#0a0a0a',borderRadius:20,padding:'6px 14px',
                                fontFamily:"'Inter',sans-serif",fontSize:12,fontWeight:600,cursor:yaGuardado?'default':'pointer'
                            }}>⭐ {j.nombre}</span>
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

                    {/* Lista de jugadores */}
                    {!yaGuardado && (
                        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:8,marginBottom:20}}>
                            {plantillaFiltrada.map((j,i) => {
                                const seleccionado = seleccion.find(s => s.nombre === j.nombre);
                                const lleno = seleccion.length >= maxEstrellas && !seleccionado;
                                return (
                                    <button key={i} onClick={() => toggleJugador(j)} disabled={lleno}
                                        style={{
                                            padding:'10px 8px',borderRadius:12,cursor:lleno?'not-allowed':'pointer',
                                            border:`2px solid ${seleccionado?G.golden:'rgba(0,31,107,0.12)'}`,
                                            background: seleccionado?'rgba(255,215,0,0.1)':'#f8f8f8',
                                            fontFamily:"'Inter',sans-serif",fontSize:11,fontWeight:600,
                                            color:seleccionado?G.deepBlue:'rgba(0,31,107,0.6)',
                                            opacity:lleno?0.4:1,textAlign:'center'
                                        }}>
                                        <span style={{fontSize:9,display:'block',opacity:.5,marginBottom:2}}>{j.posicion}</span>
                                        {j.nombre}
                                        {seleccionado && <span style={{display:'block',fontSize:14,marginTop:2}}>⭐</span>}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {yaGuardado ? (
                        <div style={{background:'rgba(16,185,129,0.1)',border:'1px solid rgba(16,185,129,0.3)',borderRadius:12,padding:16,textAlign:'center'}}>
                            <p style={{fontFamily:"'Inter',sans-serif",fontSize:13,color:G.success,fontWeight:600}}>✅ Selección guardada para esta jornada</p>
                            <p style={{fontFamily:"'Inter',sans-serif",fontSize:11,color:G.deepBlue,opacity:.5,marginTop:4}}>Los puntos se calcularán automáticamente tras el partido</p>
                        </div>
                    ) : seleccion.length > 0 && (
                        <button onClick={guardarSeleccion} disabled={guardando} style={{
                            width:'100%',fontFamily:"'Bebas Neue',sans-serif",fontSize:'1.1rem',letterSpacing:2,
                            background:G.deepBlue,color:G.golden,border:'none',borderRadius:30,
                            padding:14,cursor:'pointer',boxShadow:'0 6px 20px rgba(0,31,107,0.25)'
                        }}>{guardando ? 'GUARDANDO...' : `CONFIRMAR ${seleccion.length} ESTRELLA${seleccion.length>1?'S':''}`}</button>
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

var hashPin = async function(nombre, pin) {
    var str = nombre.toLowerCase().trim() + ':' + pin;
    var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(function(b) { return b.toString(16).padStart(2,'0'); }).join('');
};

const LoginScreen = ({ onLoginSuccess }) => {
    var G = styles.colors;
    var [nombreSeleccionado, setNombreSeleccionado] = useState('');
    var [pin, setPin] = useState('');
    var [pinConfirm, setPinConfirm] = useState('');
    var [paso, setPaso] = useState('nombre'); // nombre | pin_nuevo | pin_existente | confirmando
    var [error, setError] = useState('');
    var [cargando, setCargando] = useState(false);
    var [esNuevo, setEsNuevo] = useState(false);

    var JUGADORES = ["Juanma","Lucy","Antonio","Mari","Pedro","Pedrito","Himar","Sarito","Vicky","Carmelo","Laura","Carlos","José","Claudio","Javi"];

    var seleccionarNombre = async function(nombre) {
        setCargando(true);
        setError('');
        setNombreSeleccionado(nombre);
        // Comprobar si ya tiene PIN en Firestore
        try {
            var snap = await getDoc(doc(db, "pines", nombre));
            if (snap.exists()) {
                setEsNuevo(false);
                setPaso('pin_existente');
            } else {
                setEsNuevo(true);
                setPaso('pin_nuevo');
            }
        } catch(e) {
            setError('Error de conexión. Inténtalo de nuevo.');
        }
        setCargando(false);
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

    var verificarNuevoPin = async function(confirmado) {
        if (confirmado !== pin) {
            setError('Los PINs no coinciden. Inténtalo de nuevo.');
            setPin(''); setPinConfirm(''); setPaso('pin_nuevo'); return;
        }
        setCargando(true);
        try {
            var hash = await hashPin(nombreSeleccionado, pin);
            await setDoc(doc(db, "pines", nombreSeleccionado), { hash: hash, creadoEn: serverTimestamp() });
            await setDoc(doc(db, "perfiles", nombreSeleccionado), { nombre: nombreSeleccionado }, { merge: true });
            await signInAnonymously(auth);
            onLoginSuccess(nombreSeleccionado);
        } catch(e) {
            setError('Error al guardar. Inténtalo de nuevo.'); setCargando(false);
        }
    };

    var validarPin = async function(pinIntento) {
        setCargando(true);
        setError('');
        try {
            var snap = await getDoc(doc(db, "pines", nombreSeleccionado));
            if (!snap.exists()) { setError('No hay PIN registrado.'); setCargando(false); return; }
            var hash = await hashPin(nombreSeleccionado, pinIntento);
            if (hash === snap.data().hash) {
                await signInAnonymously(auth);
                onLoginSuccess(nombreSeleccionado);
            } else {
                setError('PIN incorrecto. Inténtalo de nuevo.');
                setPin(''); setCargando(false);
            }
        } catch(e) {
            setError('Error de conexión.'); setCargando(false);
        }
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



function App() {
    const [screen, setScreen] = useState('login');
    const [activeTab, setActiveTab] = useState('miJornada');
    const [drawerOpen, setDrawerOpen] = useState(true);
    const [drawerHintShown, setDrawerHintShown] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [teamLogos, setTeamLogos] = useState({});
    const [plantilla, setPlantilla] = useState(PLANTILLA_FALLBACK);
    const [userProfiles, setUserProfiles] = useState({});
    const [onlineUsers, setOnlineUsers] = useState({});
    const [clasificacionData, setClasificacionData] = useState([]);
    const [showTutorial, setShowTutorial] = useState(false);

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

    // ── Tras login: cargar datos privados y plantilla vía API ───────────
    const handleLoginSuccess = async (user) => {
        try {
            setCurrentUser(user);
            set(ref(rtdb, 'status/' + user), true);
            onDisconnect(ref(rtdb, 'status/' + user)).set(false);

            // Admin identificado por nombre mientras usamos login simple
            setIsAdmin(user === 'Juanma');

            // Listeners de Firestore post-login
            onSnapshot(doc(db, "configuracion", "escudos"), function(snap) {
                if (snap.exists()) setTeamLogos(snap.data());
            });
            onSnapshot(collection(db, "clasificacion"), function(snap) {
                var profiles = {};
                var clasif = [];
                snap.forEach(function(d) { profiles[d.id] = d.data(); clasif.push({ id: d.id, ...d.data() }); });
                setUserProfiles(profiles);
                setClasificacionData(clasif);
            });

            // Cargar plantilla desde Firestore si existe
            getDoc(doc(db, "configuracion", "plantilla_udlp")).then(function(plantillaSnap) {
                if (plantillaSnap.exists() && plantillaSnap.data().jugadores?.length > 0) {
                    setPlantilla(plantillaSnap.data().jugadores);
                }
            });

            setScreen('app');

            // Mostrar tutorial épico si es la primera vez en la temporada 26/27
            if (!localStorage.getItem('tutorial_2627_' + user)) {
                setShowTutorial(true);
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
    if (screen === 'login') return <LoginScreen onLoginSuccess={handleLoginSuccess} />;

    var renderContent = function() {
        switch (activeTab) {
            case 'miJornada':    return <MiJornadaScreen user={currentUser} teamLogos={teamLogos} plantilla={plantilla} userProfiles={userProfiles} onlineUsers={onlineUsers} />;
            case 'laJornada':   return <LaJornadaScreen userProfiles={userProfiles} onlineUsers={onlineUsers} teamLogos={teamLogos} />;
            case 'elOtro':      return <ElOtroScreen currentUser={currentUser} userProfiles={userProfiles} />;
            case 'estrellas':   return <MisEstrellasScreen currentUser={currentUser} plantilla={plantilla} userProfiles={userProfiles} />;
            case 'clasificacion': return <ClasificacionScreen currentUser={currentUser} userProfiles={userProfiles} onlineUsers={onlineUsers} />;
            case 'calendario':  return <CalendarioScreen teamLogos={teamLogos} />;
            case 'estadisticas': return <EstadisticasScreen userProfiles={userProfiles} onlineUsers={onlineUsers} />;
            case 'pagos':       return <PagosScreen />;
            case 'perfil':      return <PerfilScreen currentUser={currentUser} />;
            case 'admin':       return isAdmin ? <AdminPanelScreen plantilla={plantilla} /> : null;
            default:            return null;
        }
    };

    var TABS = [
        { id: 'miJornada', label: 'Mi Jornada', icon: 'ti-calendar-event' },
        { id: 'laJornada', label: 'La Jornada', icon: 'ti-trophy' },
        { id: 'elOtro', label: 'El Otro Equipo', icon: 'ti-shield-half' },
        { id: 'estrellas', label: '5 Estrellas', icon: 'ti-star' },
        { id: 'clasificacion', label: 'Clasificación', icon: 'ti-chart-bar' },
        { id: 'calendario', label: 'Calendario', icon: 'ti-calendar' },
        { id: 'estadisticas', label: 'Estadísticas', icon: 'ti-chart-dots' },
        { id: 'pagos', label: 'Pagos', icon: 'ti-wallet' },
        { id: 'perfil', label: 'Mi Perfil', icon: 'ti-user-circle' },
    ];
    if (isAdmin) TABS.push({ id: 'admin', label: 'Admin', icon: 'ti-settings' });

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(160deg,#f8f9ff 0%,#eef1fa 100%)', overflow: 'hidden', fontFamily: "'Teko', sans-serif" }}>

            {/* Tutorial épico — primera vez en la temporada */}
            {showTutorial && <TutorialEpico user={currentUser} plantilla={plantilla} onClose={function() { setShowTutorial(false); setActiveTab('perfil'); }} />}

            {/* ── TOPBAR ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(10px)', borderBottom: '0.5px solid rgba(0,31,107,0.08)', position: 'relative', zIndex: 10 }}>
                <button
                    onClick={function() { setDrawerOpen(true); }}
                    style={{ width: 40, height: 40, background: 'rgba(0,31,107,0.07)', border: 'none', borderRadius: 10, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 5, padding: '0 10px', animation: drawerHintShown ? 'none' : 'menuPulse 1.5s ease 0.8s 3', position: 'relative' }}
                    aria-label="Abrir menú"
                >
                    <div style={{ width: 20, height: 2, background: '#001F6B', borderRadius: 2 }} />
                    <div style={{ width: 14, height: 2, background: '#001F6B', borderRadius: 2, marginLeft: 3 }} />
                    <div style={{ width: 20, height: 2, background: '#001F6B', borderRadius: 2 }} />
                </button>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontFamily: "'Teko',sans-serif", fontSize: 22, fontWeight: 700, color: '#001F6B', letterSpacing: 1, lineHeight: 1 }}>PORRA</span>
                    <span style={{ fontFamily: "'Teko',sans-serif", fontSize: 22, fontWeight: 700, color: 'transparent', WebkitTextStroke: '1.5px #001F6B', letterSpacing: 1, lineHeight: 1 }}>UDLP</span>
                </div>
                <div style={{ width: 38, height: 38, background: '#FFD700', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Teko',sans-serif", fontSize: 18, fontWeight: 700, color: '#001F6B', cursor: 'pointer' }}
                    onClick={function() { setActiveTab('perfil'); setDrawerOpen(false); }}>
                    {(currentUser || 'U')[0].toUpperCase()}
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
                            </button>
                        );
                    })}
                </div>

                <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    {/* Botón Invita a Amigos */}
                    <button onClick={function() {
                        var msg = '¡Únete a la Porra UDLP 26/27! Quedan 5 plazas. Escríbeme y te apunto 🐥⚽';
                        if (navigator.share) {
                            navigator.share({ title: 'Porra UDLP 26/27', text: msg });
                        } else if (navigator.clipboard) {
                            navigator.clipboard.writeText(msg);
                            alert('Mensaje copiado — pégalo en WhatsApp');
                        }
                        setDrawerOpen(false);
                    }}
                        style={{width:'100%',background:'rgba(255,215,0,0.12)',border:'1px solid rgba(255,215,0,0.3)',
                            borderRadius:12,padding:'11px 0',cursor:'pointer',marginBottom:10,
                            fontFamily:"'Teko',sans-serif",fontSize:14,letterSpacing:2,
                            color:'#FFD700',textTransform:'uppercase',display:'flex',alignItems:'center',
                            justifyContent:'center',gap:8}}>
                        👥 INVITA A AMIGOS
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
