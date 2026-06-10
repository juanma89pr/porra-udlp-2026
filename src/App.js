/* eslint-disable no-unused-vars */
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

// IMPORTANTE: Sustituye esto por tu clave real generada en Firebase Cloud Messaging
const VAPID_KEY = "AQUÍ_VA_LA_CLAVE_LARGA_QUE_COPIASTE";

// --- DATOS DE LA APLICACIÓN ---
const JUGADORES = ["Juanma", "Lucy", "Antonio", "Mari", "Pedro", "Pedrito", "Himar", "Sarito", "Vicky", "Carmelo", "Laura", "Carlos", "José", "Claudio", "Javi"];
const APUESTA_NORMAL = 1;
const APUESTA_VIP = 2;

const EQUIPOS_LIGA = ["UD Las Palmas", "UD Almería", "Málaga CF", "CD Castellón", "Burgos CF", "Real Zaragoza", "SD Eibar", "Real Sporting de Gijón", "Real Racing Club"];

const PLANTILLA_ACTUALIZADA = [
    { dorsal: "1", nombre: "Dinko Horkas", imageUrl: "" },
    { dorsal: "13", nombre: "José Antonio Caro", imageUrl: "" },
    { dorsal: "30", nombre: "Álvaro Killane", imageUrl: "" },
    { dorsal: "35", nombre: "Adri Suárez", imageUrl: "" },
    { dorsal: "2", nombre: "Marvin Park", imageUrl: "" },
    { dorsal: "3", nombre: "Mika Mármol", imageUrl: "" },
    { dorsal: "4", nombre: "Álex Suárez", imageUrl: "" },
    { dorsal: "5", nombre: "Enrique Clemente", imageUrl: "" },
    { dorsal: "6", nombre: "Sergio Barcia", imageUrl: "" },
    { dorsal: "15", nombre: "Juanma Herzog", imageUrl: "" },
    { dorsal: "23", nombre: "Cristian Gutiérrez", imageUrl: "" },
    { dorsal: "27", nombre: "Valent Pezzolesi", imageUrl: "" },
    { dorsal: "31", nombre: "Carlos Navarro", imageUrl: "" },
    { dorsal: "42", nombre: "Víctor Villote", imageUrl: "" },
    { dorsal: "7", nombre: "Nicolás Benedetti", imageUrl: "" },
    { dorsal: "8", nombre: "Iván Gil", imageUrl: "" },
    { dorsal: "9", nombre: "Jeremía Recoba", imageUrl: "" },
    { dorsal: "12", nombre: "Enzo Loiodice", imageUrl: "" },
    { dorsal: "14", nombre: "Manu Fuster", imageUrl: "" },
    { dorsal: "16", nombre: "Lorenzo Amatucci", imageUrl: "" },
    { dorsal: "17", nombre: "Viti Rozada", imageUrl: "" },
    { dorsal: "20", nombre: "Kirian Rodríguez", imageUrl: "" },
    { dorsal: "21", nombre: "Jonathan Viera", imageUrl: "" },
    { dorsal: "22", nombre: "Ale García", imageUrl: "" },
    { dorsal: "26", nombre: "Iñaki González", imageUrl: "" },
    { dorsal: "36", nombre: "José Carlos González", imageUrl: "" },
    { dorsal: "10", nombre: "Jesé", imageUrl: "" },
    { dorsal: "18", nombre: "Taisei Miyashiro", imageUrl: "" },
    { dorsal: "19", nombre: "Sandro Ramírez", imageUrl: "" },
    { dorsal: "24", nombre: "Pejiño", imageUrl: "" },
    { dorsal: "34", nombre: "Diego Martín", imageUrl: "" },
    { dorsal: "37", nombre: "Arturo Rodríguez", imageUrl: "" },
    { dorsal: "38", nombre: "Iván Medina", imageUrl: "" },
    { dorsal: "39", nombre: "Estanis Pedrola", imageUrl: "" },
    { dorsal: "41", nombre: "Elías Romero", imageUrl: "" },
    { dorsal: "44", nombre: "Rafa Cruz", imageUrl: "" },
    { dorsal: "49", nombre: "Iker Bravo", imageUrl: "" }
];

// ============================================================================
// --- ESTILOS "GAMBLING / GOLDEN PLAYOFF" PREMIUM ---
// ============================================================================
const colors = {
    deepBlue: '#001d3d', blue: '#003366', golden: '#FFD700', goldenDark: '#d4af37', yellow: '#FFD700', gold: '#FFD700', silver: '#C0C0C0', 
    lightText: '#fdfbf7', darkText: '#0a0a0a', danger: '#e63946', success: '#10b981', warning: '#fca311', 
    darkUI: 'rgba(0, 29, 61, 0.65)', darkUIAlt: 'rgba(0, 51, 102, 0.45)',
    status: { 'Próximamente': '#6c757d', 'Pre-apertura': '#fca311', 'Abierta': '#10b981', 'Cerrada': '#e63946', 'En vivo': '#dc3545', 'Finalizada': '#d4af37' }
};

const styles = {
    colors,
    container: { display: 'flex', justifyContent: 'center', alignItems: 'flex-start', width: '100%', minHeight: '100dvh', background: `linear-gradient(145deg, ${colors.deepBlue} 0%, #000 100%)`, padding: '15px', fontFamily: "'Montserrat', sans-serif" },
    card: { width: '100%', maxWidth: '900px', backgroundColor: colors.darkUI, color: colors.lightText, padding: '25px', borderRadius: '20px', boxShadow: `0 20px 50px rgba(0, 0, 0, 0.5)`, minHeight: 'calc(100dvh - 30px)', border: `1px solid rgba(255,215,0,0.15)`, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' },
    title: { fontFamily: "'Oswald', sans-serif", color: colors.golden, textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center', borderBottom: `1px solid rgba(255,215,0,0.3)`, paddingBottom: '15px', marginBottom: '25px', textShadow: `0 4px 15px rgba(255,215,0,0.3)`, fontSize: 'clamp(1.5rem, 5vw, 2rem)' },
    
    mainButton: { fontFamily: "'Oswald', sans-serif", padding: '14px 28px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', border: 'none', borderRadius: '30px', background: `linear-gradient(135deg, ${colors.goldenDark}, ${colors.golden}, #FFF7A1, ${colors.golden})`, color: colors.darkText, marginTop: '20px', transition: 'all 0.3s ease', textTransform: 'uppercase', letterSpacing: '1px', boxShadow: `0 8px 20px rgba(212,175,55,0.4)` },
    secondaryButton: { fontFamily: "'Montserrat', sans-serif", padding: '10px 20px', fontSize: '0.9rem', cursor: 'pointer', border: `1px solid ${colors.goldenDark}`, borderRadius: '20px', backgroundColor: 'rgba(212,175,55,0.05)', color: colors.golden, transition: 'all 0.3s ease', textTransform: 'uppercase', fontWeight: 'bold', backdropFilter: 'blur(5px)' },
    
    placeholder: { padding: '40px 20px', backgroundColor: 'rgba(0,0,0,0.2)', border: `1px dashed ${colors.goldenDark}`, borderRadius: '16px', textAlign: 'center', color: colors.lightText },
    
    epicSplashContainer: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: `radial-gradient(circle at center, ${colors.blue} 0%, #000 100%)`, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', zIndex: 9999, animation: 'fadeOut 0.5s ease 2.5s forwards' },
    epicSplashSubtitle: { fontFamily: "'Montserrat', sans-serif", fontSize: 'clamp(1rem, 4vw, 1.5rem)', fontWeight: '600', color: colors.silver, letterSpacing: '5px', marginBottom: '10px', textTransform: 'uppercase' },
    epicSplashTitle: { fontFamily: "'Oswald', sans-serif", fontSize: 'clamp(3rem, 10vw, 5.5rem)', fontWeight: 'bold', color: colors.golden, textShadow: `0 0 30px rgba(255,215,0,0.6)`, textTransform: 'uppercase', textAlign: 'center', animation: 'pulse 1.5s infinite alternate', lineHeight: 1.1 },
    
    navbar: { display: 'flex', flexWrap: 'wrap', gap: '8px', borderBottom: `1px solid rgba(255,215,0,0.2)`, paddingBottom: '15px', marginBottom: '25px', alignItems: 'center', justifyContent: 'center' },
    navButton: { fontFamily: "'Montserrat', sans-serif", padding: '8px 14px', fontSize: '0.85rem', border: 'none', borderRadius: '8px', backgroundColor: 'transparent', color: colors.silver, cursor: 'pointer', transition: 'all 0.3s', textTransform: 'uppercase', fontWeight: '600' },
    navButtonActive: { fontFamily: "'Montserrat', sans-serif", padding: '8px 14px', fontSize: '0.85rem', border: `1px solid ${colors.goldenDark}`, borderRadius: '8px', backgroundColor: 'rgba(212, 175, 55, 0.1)', color: colors.golden, cursor: 'pointer', textTransform: 'uppercase', fontWeight: 'bold', boxShadow: `0 4px 10px rgba(0,0,0,0.3)` },
    logoutButton: { fontFamily: "'Montserrat', sans-serif", padding: '8px 14px', fontSize: '0.85rem', border: `1px solid ${colors.danger}`, borderRadius: '8px', backgroundColor: 'rgba(230,57,70,0.1)', color: colors.danger, cursor: 'pointer', marginLeft: '10px', textTransform: 'uppercase', fontWeight: '600' },
    
    form: { backgroundColor: 'rgba(0,0,0,0.25)', padding: '30px', borderRadius: '20px', marginTop: '20px', border: `1px solid rgba(255,215,0,0.1)`, boxShadow: `inset 0 0 40px rgba(0,0,0,0.3)` },
    formSectionTitle: { fontFamily: "'Oswald', sans-serif", color: colors.golden, fontSize: '1.4rem', textAlign: 'center', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '1px' },
    formGroup: { marginBottom: '25px', backgroundColor: 'rgba(0,0,0,0.3)', padding: '20px', borderRadius: '16px', border: `1px solid rgba(255,215,0,0.05)`, boxShadow: 'inset 0 4px 15px rgba(0,0,0,0.2)' },
    label: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginBottom: '15px', color: colors.silver, fontWeight: '600', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '1px' },
    oddsBadge: { backgroundColor: colors.goldenDark, color: colors.darkText, padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', fontFamily: "'Montserrat', sans-serif", boxShadow: '0 2px 5px rgba(0,0,0,0.5)' },
    input: { width: 'calc(100% - 24px)', padding: '14px', border: `1px solid rgba(255,215,0,0.3)`, borderRadius: '12px', backgroundColor: 'rgba(0,0,0,0.5)', color: colors.lightText, fontSize: '1rem', fontFamily: "'Montserrat', sans-serif", transition: 'border 0.3s' },
    jokerInput: { width: '45px', textAlign: 'center', padding: '10px', border: `1px solid ${colors.warning}`, borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.6)', color: colors.warning, fontSize: '1.2rem', fontFamily: "'Oswald', sans-serif" },
    
    miJornadaMatchInfo: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', width: '100%', margin: '25px 0', flexWrap: 'nowrap' },
    miJornadaScoreInputs: { display: 'flex', alignItems: 'center', gap: '10px', flex: '0 0 auto' },
    miJornadaTeamLogo: { width: 'clamp(60px, 18vw, 90px)', height: 'clamp(60px, 18vw, 90px)', objectFit: 'contain', filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.5))' },
    resultInput: { width: '65px', height: '65px', textAlign: 'center', padding: '10px', border: `1px solid ${colors.goldenDark}`, borderRadius: '16px', backgroundColor: 'rgba(0,0,0,0.6)', color: colors.golden, fontSize: '2rem', fontFamily: "'Oswald', sans-serif", fontWeight: 'bold', boxShadow: `inset 0 5px 15px rgba(0,0,0,0.8)`},
    separator: { fontSize: '1.5rem', fontWeight: 'bold', color: colors.silver },
    checkbox: { width: '22px', height: '22px', accentColor: colors.golden, cursor: 'pointer' },
    message: { marginTop: '20px', padding: '15px', borderRadius: '12px', backgroundColor: colors.success, color: colors.darkText, textAlign: 'center', fontWeight: 'bold', fontFamily: "'Montserrat', sans-serif" },
    
    table: { width: '100%', marginTop: '20px', borderCollapse: 'separate', borderSpacing: '0 8px', color: colors.lightText },
    th: { backgroundColor: 'transparent', color: colors.silver, padding: '12px', borderBottom: `1px solid rgba(255,215,0,0.2)`, textAlign: 'left', textTransform: 'uppercase', fontFamily: "'Oswald', sans-serif", fontSize: '0.9rem', letterSpacing: '1px' },
    tr: { backgroundColor: 'rgba(0,0,0,0.3)', transition: 'transform 0.2s ease', borderRadius: '12px' },
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

    // --- NUEVOS ESTILOS PARA LA GRÁFICA DE EL CAMINO ---
    graphContainer: { margin: '25px 0', padding: '25px', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: '16px', border: `1px solid rgba(255,215,0,0.15)` },
    graphBarWrapper: { marginBottom: '15px', textAlign: 'left' },
    graphBarLabel: { display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', color: colors.silver, marginBottom: '5px', fontWeight: 'bold', fontFamily: "'Montserrat', sans-serif" },
    graphBarBg: { height: '14px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '7px', overflow: 'hidden' },
    graphBarFill: { height: '100%', background: `linear-gradient(90deg, ${colors.goldenDark}, ${colors.golden})`, transition: 'width 1s ease-out' }
};

// ============================================================================
// --- LÓGICA Y HELPERS ---
// ============================================================================
const formatFullDateTime = (firebaseDate) => { 
    if (!firebaseDate || !firebaseDate.seconds) return 'Fecha por confirmar'; 
    return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(firebaseDate.seconds * 1000)).replace(',', ' a las'); 
};

const getNombreJornada = (num) => {
    if (num === 43) return "IDA SEMIFINAL";
    if (num === 44) return "VUELTA SEMIFINAL";
    if (num === 45) return "IDA FINAL";
    if (num === 46) return "VUELTA FINAL";
    return `JORNADA ${num}`;
};

// --- CORRECCIÓN DE BUG: PUNTUACIÓN CON PARSE INT PARA EVITAR ERRORES DE STRING ---
const calculateProvisionalPoints = (pronostico, liveData, jornada) => {
    if (!pronostico || !liveData || !jornada || jornada.estado !== 'En vivo') return 0;
    let ptos = 0; const esVip = jornada.esVip || false; 
    
    // Forzamos que los goles sean numéricos
    const gL = parseInt(liveData.golesLocal) || 0;
    const gV = parseInt(liveData.golesVisitante) || 0;
    
    let exactoAcertado = false;
    
    if (pronostico.golesLocal !== '' && pronostico.golesVisitante !== '') {
        const pL = parseInt(pronostico.golesLocal) || 0;
        const pV = parseInt(pronostico.golesVisitante) || 0;
        if (gL === pL && gV === pV) exactoAcertado = true;
    }
    
    if (!exactoAcertado && pronostico.jokerActivo && pronostico.jokerPronosticos) {
        for (let jp of pronostico.jokerPronosticos) {
            if (jp.local !== '' && jp.visitante !== '') {
                const jpL = parseInt(jp.local) || 0;
                const jpV = parseInt(jp.visitante) || 0;
                if (gL === jpL && gV === jpV) {
                    exactoAcertado = true;
                    break;
                }
            }
        }
    }
    
    if (exactoAcertado) ptos += esVip ? 6 : 3;

    if (jornada.tipoPartido !== 'vuelta_semi' && jornada.tipoPartido !== 'vuelta_final') {
        let rReal = '';
        if (jornada.equipoLocal === "UD Las Palmas") {
            rReal = gL > gV ? 'Gana UD Las Palmas' : (gL < gV ? 'Pierde UD Las Palmas' : 'Empate');
        } else if (jornada.equipoVisitante === "UD Las Palmas") {
            rReal = gV > gL ? 'Gana UD Las Palmas' : (gV < gL ? 'Pierde UD Las Palmas' : 'Empate');
        } else {
            // Fallback por si no juega la UD
            rReal = gL > gV ? 'Gana Local' : (gL < gV ? 'Gana Visitante' : 'Empate');
        }
        if (pronostico.resultado1x2 === rReal) ptos += esVip ? 2 : 1;
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
// --- COMPONENTES UI Y MODALES ---
// ============================================================================
const PlayerProfileDisplay = ({ name, profile, defaultColor = styles.colors.lightText, isOnline = false }) => {
    const p = profile || {}; const color = p.color || defaultColor; const isG = typeof color === 'string' && color.startsWith('linear-gradient');
    const nStyle = { ...(isG ? { background: color, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } : { color }), fontWeight: 'bold' };
    return (<span style={{display: 'inline-flex', alignItems: 'center', gap: '8px' }}>{p.icon && <span>{p.icon}</span>}<span style={nStyle}>{name}</span>{isOnline && <span style={{width: '8px', height: '8px', backgroundColor: styles.colors.success, borderRadius: '50%', boxShadow: `0 0 8px ${styles.colors.success}`}}></span>}</span>);
};

const TeamDisplay = ({ teamLogos, teamName, shortName = false, imgStyle }) => (<div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:'8px', flex: '0 0 auto'}}><img src={teamLogos[teamName] || 'https://placehold.co/80x80/1b263b/e0e1dd?text=?'} style={imgStyle} alt={teamName} /><span style={{fontSize:'clamp(0.85rem, 2.5vw, 1rem)', fontWeight:'600', color:styles.colors.lightText, fontFamily:"'Montserrat', sans-serif"}}>{shortName && teamName === "UD Las Palmas" ? "UDLP" : teamName}</span></div>);

const LoadingSkeleton = () => (<div style={{padding:'60px', textAlign:'center', color:styles.colors.golden, fontFamily:"'Oswald', sans-serif", fontSize:'1.2rem', letterSpacing:'2px'}}>CARGANDO DATOS...</div>);

const EpicSplashScreen = () => (
    <div style={styles.epicSplashContainer}>
        <p style={styles.epicSplashSubtitle}>PORRA UDLP 2026</p>
        <h1 style={styles.epicSplashTitle}>ESTAMOS EN<br/>PLAYOFF</h1>
    </div>
);

// --- MODAL ÉPICO DE BIENVENIDA V12 ---
const PlayoffWelcomeModal = ({ onClose }) => {
    const [step, setStep] = useState(1);

    return (
        <div style={styles.modalOverlay}>
            <div style={styles.modalContent}>
                <h2 style={{...styles.title, fontSize: '1.8rem', marginBottom: '0', borderBottom: 'none', letterSpacing: '2px', lineHeight: 1.2}}>
                    {step === 1 && "🔥 ACTUALIZACIÓN V12"}{step === 2 && "🔒 SEGURIDAD POR PIN"}{step === 3 && "📅 PORRA ANUAL"}
                </h2>
                <div style={styles.modalDots}>
                    <div style={step === 1 ? styles.modalDotActive : styles.modalDotInactive} /><div style={step === 2 ? styles.modalDotActive : styles.modalDotInactive} /><div style={step === 3 ? styles.modalDotActive : styles.modalDotInactive} />
                </div>
                
                <div style={{minHeight: '220px', display: 'flex', flexDirection: 'column', justifyContent: 'center', width: '100%', fontFamily: "'Montserrat', sans-serif"}}>
                    {step === 1 && (
                        <>
                            <p style={{fontSize: '1.1rem', marginBottom: '15px', color: styles.colors.lightText, lineHeight: 1.5, fontWeight: '600'}}>Hemos restaurado el código completo.</p>
                            <p style={{color: styles.colors.silver, fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '10px'}}>Ya tienen disponible la gráfica de favoritos en <strong>El Camino</strong>. ¡Los votos automáticos al Málaga para Carlos, Carmelo y José han sido registrados!</p>
                        </>
                    )}
                    {step === 2 && (
                        <div style={{textAlign: 'left', lineHeight: 1.6, color: styles.colors.silver}}>
                            <p style={{marginBottom: '15px'}}><span style={{color: styles.colors.danger, fontWeight: 'bold'}}>SISTEMA DE PIN BLINDADO:</span> Al guardar o ver tu apuesta, la app te obligará a usar tu propio código PIN de 4 dígitos. Nadie puede espiar.</p>
                        </div>
                    )}
                    {step === 3 && (
                        <div style={{textAlign: 'left', lineHeight: 1.6, color: styles.colors.silver}}>
                            <p style={{marginBottom: '15px'}}><span style={{color: styles.colors.golden, fontWeight: 'bold'}}>PORRA ANUAL RECUPERADA:</span> Ya pueden consultar la pestaña "Porra Anual" en el menú para ver qué apostaron en agosto.</p>
                            <div style={{backgroundColor: 'rgba(212,175,55,0.05)', padding: '15px', borderRadius: '12px', border: `1px solid rgba(212,175,55,0.3)`}}>
                                <p style={{color: styles.colors.golden, fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '5px'}}>PUNTOS A REPARTIR AL FINAL:</p>
                                <ul style={{fontSize: '0.8rem', marginLeft: '20px'}}>
                                    <li>Ascenso o No: <strong>+5 Pts</strong></li>
                                    <li>Posición Exacta: <strong>+10 Pts</strong></li>
                                    <li>Pleno (Ambas): <strong>+20 Pts</strong></li>
                                </ul>
                            </div>
                        </div>
                    )}
                </div>
                
                <div style={{display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: '30px'}}>
                    {step > 1 ? <button onClick={() => setStep(prev => prev - 1)} style={styles.secondaryButton}>Atrás</button> : <div></div>}
                    {step < 3 ? <button onClick={() => setStep(prev => prev + 1)} style={{...styles.mainButton, marginTop: 0}}>Siguiente</button> : <button onClick={() => { localStorage.setItem('playoffWelcomeSeenV12', 'true'); onClose(); }} style={{...styles.mainButton, marginTop: 0}}>¡ENTENDIDO!</button>}
                </div>
            </div>
        </div>
    );
};
// ============================================================================
// --- PANTALLAS DE USUARIO ---
// ============================================================================

const MiJornadaScreen = ({ user, teamLogos, plantilla, userProfiles, onlineUsers }) => {
    const [currentJornada, setCurrentJornada] = useState(null);
    const [loading, setLoading] = useState(true);
    const [pronostico, setPronostico] = useState({ golesLocal: '', golesVisitante: '', resultado1x2: '', goleador: '', sinGoleador: false, jokerActivo: false, jokerPronosticos: [{local:'', visitante:''},{local:'', visitante:''},{local:'', visitante:''},{local:'', visitante:''},{local:'', visitante:''}] });
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const [message, setMessage] = useState('');
    const [participantes, setParticipantes] = useState([]);
    
    // --- ESTADOS PARA LOS CRONÓMETROS Y JOKER ---
    const [timeLeftApertura, setTimeLeftApertura] = useState('');
    const [timeLeftCierre, setTimeLeftCierre] = useState('');
    const [jokerUsadoPreviamente, setJokerUsadoPreviamente] = useState(false);
    const [estadisticasJoker, setEstadisticasJoker] = useState({ usuarios: 0, dineroExtra: 0 });

    // --- ESTADOS DE SEGURIDAD (PIN) ---
    const [pinModal, setPinModal] = useState({ isOpen: false, targetAction: '', mode: 'enter', error: '' });
    const [pinData, setPinData] = useState({ current: '', newPin: '', confirm: '' });
    const [isBetVisible, setIsBetVisible] = useState(false);

    useEffect(() => {
        const fetchJornadaYJoker = async () => {
            const qJornadas = query(collection(db, "jornadas"), orderBy("numeroJornada"));
            const snap = await getDocs(qJornadas);
            const jornadas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            let activa = jornadas.find(j => ['En vivo', 'Abierta', 'Pre-apertura', 'Cerrada'].includes(j.estado)) || jornadas.filter(j => j.estado === 'Finalizada').pop();
            
            if (activa) {
                setCurrentJornada(activa);
                
                let usado = false;
                for (let j of jornadas.filter(jor => jor.numeroJornada >= 43)) {
                    if (j.id === activa.id) continue;
                    const p = await getDoc(doc(db, "pronosticos", j.id, "jugadores", user));
                    if (p.exists() && p.data().jokerActivo) { usado = true; break; }
                }
                setJokerUsadoPreviamente(usado);

                const pSnap = await getDoc(doc(db, "pronosticos", activa.id, "jugadores", user));
                if (pSnap.exists()) { 
                    const data = pSnap.data();
                    if(!data.jokerPronosticos) data.jokerPronosticos = [{local:'', visitante:''},{local:'', visitante:''},{local:'', visitante:''},{local:'', visitante:''},{local:'', visitante:''}];
                    while(data.jokerPronosticos.length < 5) data.jokerPronosticos.push({local:'', visitante:''});
                    setPronostico(data); 
                    setHasSubmitted(true);
                    setIsBetVisible(false); // Apuesta oculta por defecto al entrar
                } else { 
                    setHasSubmitted(false); 
                    setIsBetVisible(true); 
                }

                onSnapshot(collection(db, "pronosticos", activa.id, "jugadores"), (pSnapRealtime) => {
                    const parts = [];
                    let jUsados = 0; let dineroExtra = 0;
                    pSnapRealtime.docs.forEach(d => {
                        parts.push(d.id);
                        const dData = d.data();
                        if(dData.jokerActivo && dData.jokerPronosticos) {
                            jUsados++;
                            const huecosRellenos = dData.jokerPronosticos.filter(jp => jp.local !== '' && jp.visitante !== '').length;
                            dineroExtra += huecosRellenos * (activa.esVip ? APUESTA_VIP : APUESTA_NORMAL);
                        }
                    });
                    setParticipantes(parts);
                    setEstadisticasJoker({ usuarios: jUsados, dineroExtra });
                    setLoading(false);
                });
            } else { setLoading(false); }
        };
        fetchJornadaYJoker();
    }, [user]);

    useEffect(() => {
        if (!currentJornada) return;
        const formatDiff = (diff) => {
            const d = Math.floor(diff / (1000 * 60 * 60 * 24));
            const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
            const m = Math.floor((diff / 1000 / 60) % 60);
            const s = Math.floor((diff / 1000) % 60);
            return `${d > 0 ? d + 'd ' : ''}${h}h ${m}m ${s}s`;
        };
        const timer = setInterval(() => {
            const now = new Date();
            if (currentJornada.estado === 'Pre-apertura' && currentJornada.fechaApertura) {
                const diff = new Date(currentJornada.fechaApertura.seconds * 1000) - now;
                if (diff <= 0) setTimeLeftApertura('¡A PUNTO DE ABRIR!'); else setTimeLeftApertura(formatDiff(diff));
            }
            if (currentJornada.estado === 'Abierta' && currentJornada.fechaCierre) {
                const diff = new Date(currentJornada.fechaCierre.seconds * 1000) - now;
                if (diff <= 0) setTimeLeftCierre('¡CERRANDO APUESTAS!'); else setTimeLeftCierre(formatDiff(diff));
            }
        }, 1000);
        return () => clearInterval(timer);
    }, [currentJornada]);

    const handleChange = (e) => { const { name, value, type, checked } = e.target; setPronostico(p => ({ ...p, [name]: type === 'checkbox' ? checked : value, ...(name === 'sinGoleador' && checked && { goleador: '' }) })); };
    
    const handleJokerChange = (index, field, value) => {
        const newJokers = [...pronostico.jokerPronosticos];
        newJokers[index][field] = value;
        setPronostico({...pronostico, jokerPronosticos: newJokers});
    };

    // --- LÓGICA DE SEGURIDAD (PIN) ---
    const openPinModal = (action) => {
        const userPin = userProfiles[user]?.pin;
        setPinData({ current: '', newPin: '', confirm: '' });
        setPinModal({ isOpen: true, targetAction: action, mode: userPin ? 'enter' : 'create', error: '' });
    };

    const handleGuardarClick = (e) => {
        e.preventDefault();
        if (pronostico.golesLocal === '' || pronostico.golesVisitante === '' || pronostico.resultado1x2 === '' || (!pronostico.goleador && !pronostico.sinGoleador)) { setMessage('Rellena todos los campos principales.'); return; }
        openPinModal('save');
    };

    const executeTargetAction = async () => {
        if (pinModal.targetAction === 'save') {
            try { 
                await setDoc(doc(db, "pronosticos", currentJornada.id, "jugadores", user), { ...pronostico, lastUpdated: serverTimestamp() }); 
                setHasSubmitted(true); setIsBetVisible(true); setMessage('¡Pronóstico Guardado con éxito!'); 
            } catch (err) { setMessage('Error al guardar.'); }
        } else if (pinModal.targetAction === 'view') {
            setIsBetVisible(true);
        }
        setPinModal({ ...pinModal, isOpen: false });
    };

    const handlePinSubmit = async () => {
        const userPin = userProfiles[user]?.pin;
        if (pinModal.mode === 'enter') {
            if (pinData.current !== userPin) { setPinModal(prev => ({ ...prev, error: 'PIN incorrecto.' })); return; }
            executeTargetAction();
        } else if (pinModal.mode === 'create' || pinModal.mode === 'modify') {
            if (pinModal.mode === 'modify' && pinData.current !== userPin) { setPinModal(prev => ({ ...prev, error: 'El PIN actual no es correcto.' })); return; }
            if (pinData.newPin.length !== 4) { setPinModal(prev => ({ ...prev, error: 'El nuevo PIN debe tener 4 dígitos.' })); return; }
            if (pinData.newPin !== pinData.confirm) { setPinModal(prev => ({ ...prev, error: 'Los PINs no coinciden.' })); return; }
            try { await setDoc(doc(db, "clasificacion", user), { pin: pinData.newPin }, { merge: true }); executeTargetAction(); } catch (error) { setPinModal(prev => ({ ...prev, error: 'Error al guardar el PIN.' })); }
        }
    };

    if (loading) return <LoadingSkeleton />;
    if (!currentJornada) return <div style={styles.placeholder}>No hay jornadas activas en este momento.</div>;

    const isIda = currentJornada.tipoPartido === 'ida' || !currentJornada.tipoPartido;
    const isVSemi = currentJornada.tipoPartido === 'vuelta_semi';
    const isVFinal = currentJornada.tipoPartido === 'vuelta_final';
    const liveData = currentJornada.liveData;
    const isLiveView = currentJornada.estado === 'En vivo' && liveData?.isLive;
    const isAbiertaNotSubmitted = currentJornada.estado === 'Abierta';
    const isPartidoAbierto = ['Pre-apertura', 'Abierta'].includes(currentJornada.estado);
    const requireUnlock = isPartidoAbierto && hasSubmitted && !isBetVisible;

    return (
        <div>
            {isLiveView && <div style={styles.liveBanner}>🔴 PARTIDO EN VIVO 🔴</div>}
            
            <div style={{...styles.form, padding: '30px 20px', textAlign: 'center'}}>
                {currentJornada.esVip && <div style={styles.vipBanner}>⭐ PARTIDO VIP ⭐ (Puntos Dobles)</div>}
                
                <h3 style={{fontFamily: "'Oswald', sans-serif", color: styles.colors.golden, marginBottom: '5px', fontSize: '1.8rem', textTransform: 'uppercase', letterSpacing: '2px'}}>{getNombreJornada(currentJornada.numeroJornada)}</h3>
                <p style={{color: styles.colors.silver, fontSize: '0.9rem', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '1px'}}>{currentJornada.estado}</p>

                <div style={styles.miJornadaMatchInfo}>
                    <TeamDisplay teamLogos={teamLogos} teamName={currentJornada.equipoLocal} shortName={true} imgStyle={styles.miJornadaTeamLogo} />
                    <div style={styles.miJornadaScoreInputs}>
                        {isAbiertaNotSubmitted && !requireUnlock ? (
                            <><input type="number" name="golesLocal" value={pronostico.golesLocal} onChange={handleChange} style={styles.resultInput} min="0" placeholder="L" /><span style={styles.separator}>-</span><input type="number" name="golesVisitante" value={pronostico.golesVisitante} onChange={handleChange} style={styles.resultInput} min="0" placeholder="V" /></>
                        ) : (
                            <><div style={{...styles.resultInput, display: 'flex', justifyContent: 'center', alignItems: 'center'}}>{isLiveView ? liveData.golesLocal : (currentJornada.estado === 'Finalizada' ? currentJornada.resultadoLocal : (requireUnlock ? '?' : pronostico.golesLocal))}</div><span style={styles.separator}>-</span><div style={{...styles.resultInput, display: 'flex', justifyContent: 'center', alignItems: 'center'}}>{isLiveView ? liveData.golesVisitante : (currentJornada.estado === 'Finalizada' ? currentJornada.resultadoVisitante : (requireUnlock ? '?' : pronostico.golesVisitante))}</div></>
                        )}
                    </div>
                    <TeamDisplay teamLogos={teamLogos} teamName={currentJornada.equipoVisitante} shortName={true} imgStyle={styles.miJornadaTeamLogo} />
                </div>

                {isLiveView && liveData.primerGoleador && <p style={{color: styles.colors.golden, marginTop: '15px', fontSize: '1.3rem', fontFamily: "'Oswald', sans-serif", letterSpacing: '1px'}}>⚽ {liveData.primerGoleador}</p>}

                {/* --- SECCIÓN BLINDADA (CANDADO) --- */}
                {requireUnlock ? (
                    <div style={{marginTop: '40px', padding: '40px 20px', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: '20px', border: `1px solid rgba(255,215,0,0.2)`, boxShadow: `0 10px 30px rgba(0,0,0,0.5)`}}>
                        <div style={{fontSize: '4rem', marginBottom: '15px'}}>🔒</div>
                        <h4 style={{color: styles.colors.golden, fontFamily: "'Oswald', sans-serif", fontSize: '1.5rem', letterSpacing: '1px', marginBottom: '10px', textTransform: 'uppercase'}}>APUESTA BLINDADA</h4>
                        <p style={{color: styles.colors.silver, fontSize: '0.95rem', marginBottom: '25px', lineHeight: 1.5}}>Tu apuesta se ha guardado y está protegida. Nadie puede verla sin tu código de seguridad.</p>
                        <button onClick={() => openPinModal('view')} style={styles.mainButton}>VER / MODIFICAR APUESTA</button>
                    </div>
                ) : (
                    <>
                        {currentJornada.estado === 'Pre-apertura' && (
                            <div style={{backgroundColor: 'rgba(0,0,0,0.3)', padding: '25px', borderRadius: '16px', marginTop: '30px', border: `1px solid rgba(255,215,0,0.15)`}}>
                                <h4 style={{color: styles.colors.silver, marginBottom: '15px', textTransform: 'uppercase', fontSize: '0.9rem', letterSpacing: '1px', fontFamily: "'Oswald', sans-serif"}}>Historial Fase Regular</h4>
                                <p style={{color: styles.colors.golden, fontSize: '1.1rem', fontWeight: '600'}}>{currentJornada.h2hInfo || 'Sin datos registrados.'}</p>
                                {timeLeftApertura && (
                                    <div style={{marginTop: '25px', padding: '15px', backgroundColor: 'rgba(252, 163, 17, 0.1)', border: `1px solid rgba(252, 163, 17, 0.3)`, borderRadius: '12px'}}>
                                        <p style={{color: styles.colors.silver, fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '1px'}}>Apertura de apuestas en:</p>
                                        <p style={{color: styles.colors.warning, fontSize: '1.8rem', fontWeight: 'bold', fontFamily: "'Oswald', sans-serif", letterSpacing: '2px', marginTop: '5px'}}>{timeLeftApertura}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {isAbiertaNotSubmitted && (
                            <form onSubmit={handleGuardarClick} style={{marginTop: '30px', textAlign: 'left'}}>
                                {currentJornada.h2hInfo && (<div style={styles.h2hContainer}><h4 style={{...styles.formSectionTitle, fontSize: '1rem', color: styles.colors.silver, marginBottom: '10px'}}>⚔️ Historial Regular ⚔️</h4><p style={{color: styles.colors.lightText, fontWeight: 'bold'}}>{currentJornada.h2hInfo}</p></div>)}
                                
                                {timeLeftCierre && (
                                    <div style={{marginBottom: '25px', padding: '12px', backgroundColor: 'rgba(230,57,70,0.1)', border: `1px solid rgba(230,57,70,0.3)`, borderRadius: '12px', textAlign: 'center'}}>
                                        <p style={{color: styles.colors.silver, fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '1px'}}>Cierre de apuestas en:</p>
                                        <p style={{color: styles.colors.danger, fontSize: '1.6rem', fontWeight: 'bold', fontFamily: "'Oswald', sans-serif", letterSpacing: '2px', marginTop: '5px'}}>{timeLeftCierre}</p>
                                    </div>
                                )}
                                
                                <p style={{color: styles.colors.warning, fontSize: '0.85rem', textAlign: 'center', marginBottom: '25px', fontWeight: '600'}}>⚠️ El resultado numérico incluye Prórroga (Excluye Penaltis)</p>

                                <div style={styles.formGroup}>
                                    <label style={styles.label}>{isIda ? "RESULTADO 1X2" : "DESENLACE ELIMINATORIA"} <span style={styles.oddsBadge}>{currentJornada.esVip ? '2 PTS' : '1 PT'}</span></label>
                                    {isIda && (<select name="resultado1x2" value={pronostico.resultado1x2} onChange={handleChange} style={styles.input}><option value="">-- Seleccionar --</option><option value="Gana UD Las Palmas">Gana UD Las Palmas</option><option value="Empate">Empate</option><option value="Pierde UD Las Palmas">Pierde UD Las Palmas</option></select>)}
                                    {isVSemi && (<div style={{display: 'flex', gap: '15px'}}><button type="button" onClick={() => handleChange({target: {name: 'resultado1x2', value: 'Pasa UD Las Palmas'}})} style={pronostico.resultado1x2 === 'Pasa UD Las Palmas' ? styles.pasaButtonActive : styles.pasaButtonInactive}>PASA UDLP</button><button type="button" onClick={() => handleChange({target: {name: 'resultado1x2', value: 'No Pasa UD Las Palmas'}})} style={pronostico.resultado1x2 === 'No Pasa UD Las Palmas' ? styles.pasaButtonActive : styles.pasaButtonInactive}>NO PASA</button></div>)}
                                    {isVFinal && (<div style={{display: 'flex', gap: '15px'}}><button type="button" onClick={() => handleChange({target: {name: 'resultado1x2', value: 'Asciende UD Las Palmas'}})} style={pronostico.resultado1x2 === 'Asciende UD Las Palmas' ? styles.pasaButtonActive : styles.pasaButtonInactive}>ASCIENDE UDLP</button><button type="button" onClick={() => handleChange({target: {name: 'resultado1x2', value: 'No Asciende UD Las Palmas'}})} style={pronostico.resultado1x2 === 'No Asciende UD Las Palmas' ? styles.pasaButtonActive : styles.pasaButtonInactive}>NO ASCIENDE</button></div>)}
                                </div>

                                <div style={styles.formGroup}>
                                    <label style={styles.label}>1º GOLEADOR UDLP <span style={styles.oddsBadge}>{currentJornada.esVip ? '4 PTS' : '2 PTS'}</span></label>
                                    <select name="goleador" value={pronostico.goleador} onChange={handleChange} style={styles.input} disabled={pronostico.sinGoleador}><option value="">-- Seleccionar Jugador --</option>{plantilla.sort((a,b)=>a.nombre.localeCompare(b.nombre)).map(j => <option key={j.nombre} value={j.nombre}>{j.nombre}</option>)}</select>
                                    <div style={{marginTop: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center'}}><input type="checkbox" name="sinGoleador" id="sgCheck" checked={pronostico.sinGoleador} onChange={handleChange} style={styles.checkbox} /><label htmlFor="sgCheck" style={{marginLeft: '10px', color: styles.colors.silver, fontWeight: 'bold', cursor: 'pointer'}}>Sin Goleador (SG) <span style={{...styles.oddsBadge, marginLeft: '5px'}}>1 PT</span></label></div>
                                </div>

                                {/* --- MÓDULO JOKER EXTRA --- */}
                                <div style={{...styles.formGroup, backgroundColor: pronostico.jokerActivo ? 'rgba(252, 163, 17, 0.1)' : 'rgba(0,0,0,0.3)', border: pronostico.jokerActivo ? `1px solid ${styles.colors.warning}` : `1px solid rgba(255,215,0,0.05)`}}>
                                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px'}}>
                                        <label style={{...styles.label, marginBottom: 0, color: pronostico.jokerActivo ? styles.colors.warning : styles.colors.silver}}>🃏 JOKER EXTRA DE PLAYOFF</label>
                                        {jokerUsadoPreviamente ? (
                                            <span style={{color: styles.colors.danger, fontWeight: 'bold', fontSize: '0.85rem'}}>🚫 Ya utilizado</span>
                                        ) : (
                                            <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                                                <span style={{fontSize: '0.8rem', color: styles.colors.silver}}>{currentJornada.esVip ? '2€/hueco' : '1€/hueco'}</span>
                                                <input type="checkbox" name="jokerActivo" checked={pronostico.jokerActivo} onChange={handleChange} style={styles.checkbox} />
                                            </div>
                                        )}
                                    </div>
                                    
                                    {pronostico.jokerActivo && !jokerUsadoPreviamente && (
                                        <div style={{marginTop: '20px'}}>
                                            <p style={{color: styles.colors.silver, fontSize: '0.85rem', marginBottom: '15px', fontStyle: 'italic'}}>Añade hasta 5 resultados exactos extra. Todo acertante de resultado suma el premio.</p>
                                            <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                                                {[0,1,2,3,4].map(i => (
                                                    <div key={i} style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'}}>
                                                        <span style={{color: styles.colors.warning, fontWeight: 'bold', width: '20px'}}>{i+1}.</span>
                                                        <input type="number" value={pronostico.jokerPronosticos[i]?.local || ''} onChange={(e) => handleJokerChange(i, 'local', e.target.value)} style={styles.jokerInput} min="0" placeholder="L" />
                                                        <span style={{color: styles.colors.silver, fontWeight: 'bold'}}>-</span>
                                                        <input type="number" value={pronostico.jokerPronosticos[i]?.visitante || ''} onChange={(e) => handleJokerChange(i, 'visitante', e.target.value)} style={styles.jokerInput} min="0" placeholder="V" />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <button type="submit" style={{...styles.mainButton, width: '100%', fontSize: '1.2rem', padding: '16px'}}>GUARDAR APUESTA</button>
                                {message && <p style={styles.message}>{message}</p>}
                            </form>
                        )}

                        {/* --- TU PRONÓSTICO --- */}
                        {(hasSubmitted && isBetVisible) || (['Cerrada', 'En vivo', 'Finalizada'].includes(currentJornada.estado)) ? (
                            <div style={{marginTop: '35px'}}>
                                <h4 style={styles.formSectionTitle}>TU PRONÓSTICO</h4>
                                <div style={{backgroundColor: 'rgba(212, 175, 55, 0.05)', padding: '20px', borderRadius: '16px', border: `1px solid rgba(212,175,55,0.3)`, display: 'inline-block', minWidth: '85%', backdropFilter: 'blur(5px)'}}>
                                    {hasSubmitted ? (
                                        <>
                                            <div style={{marginBottom: '15px'}}>
                                                <span style={styles.betPill}>{pronostico.golesLocal}-{pronostico.golesVisitante}</span>
                                                {pronostico.jokerActivo && pronostico.jokerPronosticos.map((jp, idx) => (
                                                    jp.local !== '' && jp.visitante !== '' && <span key={idx} style={{...styles.betPill, borderColor: styles.colors.warning, color: styles.colors.warning}}>🃏 {jp.local}-{jp.visitante}</span>
                                                ))}
                                            </div>
                                            <p style={{color: styles.colors.lightText, marginTop: '8px', fontSize: '1.1rem', fontWeight: '600'}}>{pronostico.resultado1x2}</p>
                                            <p style={{color: styles.colors.silver, marginTop: '8px', fontSize: '0.95rem'}}>⚽ {pronostico.sinGoleador ? 'Sin Goleador' : pronostico.goleador}</p>
                                        </>
                                    ) : (<p style={{color: styles.colors.danger, fontWeight: 'bold', fontSize: '1.1rem'}}>No enviaste pronóstico a tiempo.</p>)}
                                </div>
                            </div>
                        ) : null}
                    </>
                )}

                {/* --- ALERTA DE JOKERS / DINERO EXTRA --- */}
                {['Abierta', 'Pre-apertura'].includes(currentJornada.estado) && participantes.length > 0 && (
                    <div style={{marginTop: '40px', backgroundColor: 'rgba(0,0,0,0.2)', padding: '25px', borderRadius: '16px', border: `1px dashed rgba(255,215,0,0.2)`}}>
                        <h4 style={{color: styles.colors.silver, marginBottom: '20px', fontSize: '0.9rem', fontFamily: "'Oswald', sans-serif", letterSpacing: '1px'}}>HAN APOSTADO ({participantes.length}/{JUGADORES.length})</h4>
                        
                        {estadisticasJoker.usuarios > 0 && (
                            <div style={{marginBottom: '20px', padding: '12px', backgroundColor: 'rgba(16,185,129,0.1)', border: `1px solid rgba(16,185,129,0.3)`, borderRadius: '12px'}}>
                                <p style={{color: styles.colors.success, fontWeight: 'bold', fontSize: '0.9rem', textTransform: 'uppercase'}}>💰 {estadisticasJoker.usuarios} Joker(s) activados (+{estadisticasJoker.dineroExtra}€ al bote)</p>
                            </div>
                        )}

                        <div style={{display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center'}}>
                            {participantes.map(pId => (
                                <div key={pId} style={{display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(255,255,255,0.05)', padding: '10px 18px', borderRadius: '25px', border: `1px solid rgba(255,255,255,0.1)`}}><PlayerProfileDisplay name={pId} profile={userProfiles[pId]} isOnline={onlineUsers ? onlineUsers[pId] : false} /><span style={{fontSize: '1.1rem', marginLeft: '5px', opacity: 0.8}}>🤫</span></div>
                            ))}
                        </div>
                        <p style={{fontSize: '0.8rem', color: styles.colors.silver, marginTop: '20px', fontStyle: 'italic'}}>Apuestas secretas hasta el pitido inicial.</p>
                    </div>
                )}
            </div>

            {/* --- MODAL DEL PIN DE SEGURIDAD --- */}
            {pinModal.isOpen && (
                <div style={styles.modalOverlay}>
                    <div style={styles.modalContent}>
                        <div style={{fontSize: '3rem', marginBottom: '10px'}}>🔒</div>
                        <h3 style={{...styles.title, marginBottom: '15px', borderBottom: 'none'}}>SEGURIDAD</h3>
                        
                        {pinModal.mode === 'enter' && (
                            <>
                                <p style={{color: styles.colors.silver, fontSize: '0.95rem', marginBottom: '25px', lineHeight: 1.5}}>Introduce tu PIN de 4 dígitos para confirmar.</p>
                                <input type="password" value={pinData.current} onChange={e => setPinData({...pinData, current: e.target.value})} maxLength="4" placeholder="••••" style={{...styles.input, textAlign: 'center', fontSize: '2.5rem', letterSpacing: '15px', width: '180px', padding: '15px', borderRadius: '16px', backgroundColor: 'rgba(0,0,0,0.6)', border: `2px solid ${styles.colors.goldenDark}`}} autoFocus />
                                
                                <button onClick={() => setPinModal({...pinModal, mode: 'modify', error: ''})} style={{background: 'none', border: 'none', color: styles.colors.golden, textDecoration: 'underline', marginTop: '15px', cursor: 'pointer', fontSize: '0.85rem'}}>¿Modificar PIN actual?</button>
                            </>
                        )}

                        {pinModal.mode === 'create' && (
                            <>
                                <div style={{backgroundColor: 'rgba(230,57,70,0.1)', padding: '15px', borderRadius: '12px', border: `1px solid rgba(230,57,70,0.3)`, marginBottom: '20px'}}>
                                    <p style={{color: styles.colors.danger, fontSize: '0.9rem', fontWeight: 'bold'}}>⚠️ No tienes PIN configurado. Tu apuesta ha podido quedar expuesta.</p>
                                </div>
                                <p style={{color: styles.colors.silver, fontSize: '0.95rem', marginBottom: '20px'}}>Crea un PIN de 4 dígitos para blindar tus pronósticos a partir de ahora.</p>
                                <div style={{display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center'}}>
                                    <input type="password" value={pinData.newPin} onChange={e => setPinData({...pinData, newPin: e.target.value})} maxLength="4" placeholder="NUEVO PIN" style={{...styles.input, textAlign: 'center', fontSize: '1.5rem', letterSpacing: '10px', width: '220px'}} autoFocus />
                                    <input type="password" value={pinData.confirm} onChange={e => setPinData({...pinData, confirm: e.target.value})} maxLength="4" placeholder="CONFIRMAR PIN" style={{...styles.input, textAlign: 'center', fontSize: '1.5rem', letterSpacing: '10px', width: '220px'}} />
                                </div>
                            </>
                        )}

                        {pinModal.mode === 'modify' && (
                            <>
                                <p style={{color: styles.colors.silver, fontSize: '0.95rem', marginBottom: '20px'}}>Introduce tu PIN actual y el nuevo PIN.</p>
                                <div style={{display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center'}}>
                                    <input type="password" value={pinData.current} onChange={e => setPinData({...pinData, current: e.target.value})} maxLength="4" placeholder="PIN ACTUAL" style={{...styles.input, textAlign: 'center', fontSize: '1.2rem', letterSpacing: '10px', width: '220px'}} autoFocus />
                                    <input type="password" value={pinData.newPin} onChange={e => setPinData({...pinData, newPin: e.target.value})} maxLength="4" placeholder="NUEVO PIN" style={{...styles.input, textAlign: 'center', fontSize: '1.2rem', letterSpacing: '10px', width: '220px'}} />
                                    <input type="password" value={pinData.confirm} onChange={e => setPinData({...pinData, confirm: e.target.value})} maxLength="4" placeholder="CONFIRMAR NUEVO" style={{...styles.input, textAlign: 'center', fontSize: '1.2rem', letterSpacing: '10px', width: '220px'}} />
                                </div>
                            </>
                        )}
                        
                        {pinModal.error && <p style={{color: styles.colors.danger, marginTop: '15px', fontWeight: 'bold', backgroundColor: 'rgba(230,57,70,0.1)', padding: '10px', borderRadius: '8px', width: '100%'}}>{pinModal.error}</p>}
                        
                        <div style={{display: 'flex', gap: '15px', marginTop: '30px', width: '100%'}}>
                            <button onClick={() => setPinModal({...pinModal, isOpen: false})} style={{...styles.secondaryButton, flex: 1}}>CANCELAR</button>
                            <button onClick={handlePinSubmit} style={{...styles.mainButton, flex: 1, marginTop: 0}}>{pinModal.mode === 'enter' ? 'CONFIRMAR' : 'GUARDAR PIN'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const LaJornadaScreen = ({ userProfiles, onlineUsers, teamLogos }) => {
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

    const liveData = jornadaActual.liveData;
    const isLiveView = jornadaActual.estado === 'En vivo' && liveData?.isLive;

    // Helper con parseInt para detectar resultados exactos en La Jornada
    const isExactResultWinner = (pL, pV) => {
        if (!isLiveView && jornadaActual.estado !== 'Finalizada') return false;
        const gL = isLiveView ? parseInt(liveData.golesLocal) : parseInt(jornadaActual.resultadoLocal);
        const gV = isLiveView ? parseInt(liveData.golesVisitante) : parseInt(jornadaActual.resultadoVisitante);
        if (isNaN(gL) || isNaN(gV)) return false;
        return parseInt(pL) === gL && parseInt(pV) === gV;
    };

    return (
        <div>
            {isLiveView && <div style={styles.liveBanner}>🔴 PARTIDO EN VIVO 🔴</div>}
            <h2 style={styles.title}>LA JORNADA</h2>
            <div style={{...styles.form, padding: '30px 20px', textAlign: 'center'}}>
                <h3 style={{color: styles.colors.golden, marginBottom: '25px', fontSize: '1.8rem', fontFamily: "'Oswald', sans-serif"}}>{getNombreJornada(jornadaActual.numeroJornada)}</h3>
                <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', marginBottom: '30px'}}>
                    <TeamDisplay teamLogos={teamLogos} teamName={jornadaActual.equipoLocal} shortName={true} imgStyle={{width: '60px', height: '60px', objectFit: 'contain'}} />
                    <div style={{display: 'flex', gap: '10px'}}>
                        <div style={{...styles.input, width: '60px', textAlign: 'center', fontSize: '1.5rem', backgroundColor: 'rgba(0,0,0,0.6)'}}>{isLiveView ? liveData.golesLocal : (jornadaActual.estado === 'Finalizada' ? jornadaActual.resultadoLocal : '-')}</div>
                        <span style={{fontSize: '1.5rem', alignSelf: 'center'}}>-</span>
                        <div style={{...styles.input, width: '60px', textAlign: 'center', fontSize: '1.5rem', backgroundColor: 'rgba(0,0,0,0.6)'}}>{isLiveView ? liveData.golesVisitante : (jornadaActual.estado === 'Finalizada' ? jornadaActual.resultadoVisitante : '-')}</div>
                    </div>
                    <TeamDisplay teamLogos={teamLogos} teamName={jornadaActual.equipoVisitante} shortName={true} imgStyle={{width: '60px', height: '60px', objectFit: 'contain'}} />
                </div>

                {isLiveView && liveData.primerGoleador && <p style={{color: styles.colors.golden, marginTop: '15px', fontWeight: 'bold', fontSize: '1.3rem', fontFamily: "'Oswald', sans-serif", letterSpacing: '1px'}}>⚽ {liveData.primerGoleador}</p>}

                {['Abierta', 'Pre-apertura'].includes(jornadaActual.estado) ? (
                    <div style={styles.placeholder}>Apuestas secretas hasta el pitido inicial. Han apostado: {participantes.length}/{JUGADORES.length}</div>
                ) : (
                    <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                        {participantes.sort((a,b) => {
                                let ptsA = isLiveView ? calculateProvisionalPoints(a, liveData, jornadaActual) : (a.puntosObtenidos || 0);
                                let ptsB = isLiveView ? calculateProvisionalPoints(b, liveData, jornadaActual) : (b.puntosObtenidos || 0);
                                return ptsB - ptsA;
                        }).map(p => {
                            let ptsDisplay = isLiveView ? calculateProvisionalPoints(p, liveData, jornadaActual) : (p.puntosObtenidos || 0);
                            const principalWin = isExactResultWinner(p.golesLocal, p.golesVisitante);

                            return (
                                <div key={p.id} style={{backgroundColor: 'rgba(0,0,0,0.4)', padding: '18px', borderRadius: '16px', borderLeft: `4px solid ${styles.colors.golden}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                    <div style={{textAlign: 'left'}}>
                                        <PlayerProfileDisplay name={p.id} profile={userProfiles[p.id]} isOnline={onlineUsers ? onlineUsers[p.id] : false} />
                                        <div style={{marginTop: '10px'}}>
                                            <span style={principalWin ? styles.betPillWin : styles.betPill}>{p.golesLocal}-{p.golesVisitante}</span>
                                            {p.jokerActivo && p.jokerPronosticos && p.jokerPronosticos.map((jp, idx) => {
                                                if(jp.local === '' || jp.visitante === '') return null;
                                                const isJokerWin = isExactResultWinner(jp.local, jp.visitante);
                                                return <span key={idx} style={isJokerWin ? styles.betPillWin : {...styles.betPill, borderColor: styles.colors.warning, color: styles.colors.warning}}>🃏 {jp.local}-{jp.visitante}</span>
                                            })}
                                        </div>
                                        <div style={{fontSize: '0.85rem', color: styles.colors.silver, marginTop: '8px'}}><strong style={{color: '#fff'}}>{p.resultado1x2}</strong><br/>⚽ {p.sinGoleador ? 'Sin Goleador' : p.goleador}</div>
                                    </div>
                                    {(jornadaActual.estado === 'Finalizada' || isLiveView) && (
                                        <div style={{fontSize: '1.6rem', fontWeight: 'bold', fontFamily: "'Oswald', sans-serif", color: styles.colors.golden}}>{ptsDisplay}</div>
                                    )}
                                </div>
                            )
                        })}
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
            
            <div style={{...styles.form, textAlign: 'center'}}>
                <h3 style={{fontFamily: "'Oswald', sans-serif", color: styles.colors.golden, marginBottom: '10px', fontSize: '1.4rem'}}>APUESTA EXTRA <span style={{...styles.badge, backgroundColor: styles.colors.goldenDark, color: '#000', padding: '4px 8px'}}>+5 PTS</span></h3>
                <p style={{marginBottom: '20px', color: styles.colors.silver, fontSize: '0.9rem'}}>¿Qué equipo logrará el ansiado ascenso a Primera?</p>

                {!hasBet && !config?.bloqueado ? (
                    <div style={{display: 'flex', gap: '15px', flexWrap: 'wrap', justifyContent: 'center'}}>
                        {["UD Almería", "Málaga CF", "UD Las Palmas", "CD Castellón"].map(eq => (<button key={eq} onClick={() => handleBet(eq)} style={styles.secondaryButton}>{eq}</button>))}
                    </div>
                ) : (
                    <div style={{padding: '20px', backgroundColor: 'rgba(212,175,55,0.05)', borderRadius: '16px', border: `1px solid rgba(212,175,55,0.3)`}}>
                        <p style={{fontWeight: '600', fontSize: '1.1rem', color: styles.colors.silver}}>Tu apuesta: <span style={{color: styles.colors.golden, fontFamily: "'Oswald', sans-serif", fontSize: '1.4rem', marginLeft: '10px'}}>{apuesta || 'No apostaste'}</span></p>
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
                                    {isSecreto && b.id !== user && !b.inyectado ? (
                                        <span style={{color: styles.colors.danger, fontWeight: 'bold', fontSize: '0.8rem', backgroundColor: 'rgba(230,57,70,0.1)', padding: '4px 8px', borderRadius: '8px'}}>SECRETA 🤫</span>
                                    ) : (
                                        <span style={{fontWeight: '600', color: b.id === user ? styles.colors.golden : styles.colors.silver, fontFamily: "'Oswald', sans-serif"}}>{b.equipo} {b.inyectado ? '(Auto)' : ''}</span>
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
    const [stats, setStats] = useState(null);

    useEffect(() => {
        const fetchStats = async () => {
            const jSnap = await getDocs(query(collection(db, "jornadas"), where("estado", "==", "Finalizada")));
            const jornadas = jSnap.docs.map(d => ({id: d.id, ...d.data()})).sort((a,b) => a.numeroJornada - b.numeroJornada);
            
            const st = {};
            JUGADORES.forEach(j => st[j] = { maxPtsJornada: 0, golesAcertados: 0, rachaP: 0, rachaC: 0, aRP: 0, aRC: 0, plenos: 0, exactos: 0, segurita: 0, participaciones: 0 });

            for (const j of jornadas) {
                const pSnap = await getDocs(collection(db, "pronosticos", j.id, "jugadores"));
                pSnap.forEach(p => {
                    const data = p.data();
                    const s = st[p.id];
                    if(!s) return;
                    
                    s.participaciones++;
                    const pts = Number(data.puntosObtenidos) || 0;
                    const ptsGoleador = Number(data.puntosGoleador) || 0;
                    const ptsExacto = Number(data.puntosResultadoExacto) || 0;

                    if (pts > s.maxPtsJornada) s.maxPtsJornada = pts;
                    if (ptsGoleador > 0) s.golesAcertados++;
                    if (pts >= 3) s.plenos++;
                    if (ptsExacto > 0) s.exactos++;
                    if (pts > 0 && ptsExacto === 0 && ptsGoleador === 0) s.segurita++;
                    
                    if (pts > 0) { s.aRP++; s.aRC = 0; } else { s.aRC++; s.aRP = 0; }
                    if (s.aRP > s.rachaP) s.rachaP = s.aRP;
                    if (s.aRC > s.rachaC) s.rachaC = s.aRC;
                });
            }
            setStats(st);
        };
        fetchStats();
    }, []);

    if (!stats) return <LoadingSkeleton />;

    const getTop = (f) => {
        const sorted = Object.entries(stats).sort((a,b) => b[1][f] - a[1][f]);
        return sorted[0];
    };
    
    const renderStatValue = (val, field) => {
        if (val[1][field] === 0) return <span style={{color: styles.colors.silver, fontSize: '1rem', fontStyle: 'italic'}}>Nadie aún</span>;
        return <><PlayerProfileDisplay name={val[0]} profile={userProfiles ? userProfiles[val[0]] : {}} isOnline={onlineUsers ? onlineUsers[val[0]] : false} /></>;
    };

    const epicCards = [
        { title: '⚽ El Visionario', value: getTop('golesAcertados'), field: 'golesAcertados', desc: 'Aciertos de goleador' },
        { title: '💣 El Pelotazo', value: getTop('maxPtsJornada'), field: 'maxPtsJornada', desc: 'Puntos en 1 sola jornada' },
        { title: '🔥 En Llamas', value: getTop('rachaP'), field: 'rachaP', desc: 'Jornadas seguidas puntuando' },
        { title: '🥶 El Cenizo', value: getTop('rachaC'), field: 'rachaC', desc: 'Jornadas seguidas a cero' },
        { title: '🎯 Francotirador', value: getTop('exactos'), field: 'exactos', desc: 'Resultados exactos acertados' },
        { title: '🏆 El Maestro', value: getTop('plenos'), field: 'plenos', desc: 'Jornadas de 3 o más puntos' },
        { title: '🛡️ El Segurita', value: getTop('segurita'), field: 'segurita', desc: 'Aciertos logrados solo al 1X2' },
        { title: '🙏 El Fiel', value: getTop('participaciones'), field: 'participaciones', desc: 'Jornadas totales apostadas' },
    ];

    return (
        <div>
            <h2 style={styles.title} className="app-title">SALÓN DE LA FAMA</h2>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px', marginTop: '30px'}}>
                {epicCards.map((card, idx) => (
                    <div key={idx} style={{backgroundColor: 'rgba(0,0,0,0.3)', padding: '25px 15px', borderRadius: '16px', textAlign: 'center', border: `1px solid rgba(255,215,0,0.1)`, boxShadow: `0 8px 20px rgba(0,0,0,0.3)`, transition: 'transform 0.3s ease'}}>
                        <h3 style={{color: styles.colors.silver, fontSize: '0.9rem', textTransform: 'uppercase', height: '40px', fontFamily: "'Oswald', sans-serif", letterSpacing: '1px'}}>{card.title}</h3>
                        <p style={{fontSize:'1.4rem', margin:'15px 0', color: styles.colors.golden}}>{renderStatValue(card.value, card.field)}</p>
                        <p style={{color: styles.colors.lightText, fontSize: '0.85rem'}}><span style={{fontWeight: 'bold', fontSize: '1.2rem', color: styles.colors.success, fontFamily: "'Oswald', sans-serif"}}>{card.value[1][card.field]}</span><br/>{card.desc}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

const CalendarioScreen = ({ teamLogos }) => {
    const [jornadas, setJornadas] = useState([]); const [loading, setLoading] = useState(true);
    useEffect(() => { 
        const q = query(collection(db, "jornadas"), orderBy("numeroJornada")); 
        const unsubscribe = onSnapshot(q, (querySnapshot) => { setJornadas(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); setLoading(false); }); 
        return () => unsubscribe(); 
    }, []);
    if (loading) return <LoadingSkeleton />;
    return (
        <div>
            <h2 style={styles.title} className="app-title">CALENDARIO</h2>
            <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
                {jornadas.map(j => (
                    <div key={j.id} style={{backgroundColor: 'rgba(0,0,0,0.3)', padding: '20px', borderRadius: '16px', border: `1px solid rgba(255,215,0,0.15)`, boxShadow: '0 4px 10px rgba(0,0,0,0.2)'}}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
                            <div style={{display: 'flex', flexDirection: 'column'}}>
                                <strong style={{fontSize: '1.2rem', fontFamily: "'Oswald', sans-serif", letterSpacing: '1px', textTransform: 'uppercase', color: styles.colors.golden}}>{j.esVip && '⭐ '}{getNombreJornada(j.numeroJornada)}: {j.equipoLocal} vs {j.equipoVisitante}</strong>
                                <small style={{color: styles.colors.silver, marginTop: '5px', fontSize: '0.85rem'}}>{formatFullDateTime(j.fechaPartido)}</small>
                            </div>
                            <div style={{backgroundColor: styles.colors.status[j.estado] || styles.colors.silver, padding: '6px 12px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 'bold', color: '#fff', textTransform: 'uppercase', boxShadow: '0 2px 5px rgba(0,0,0,0.3)'}}>{j.estado}</div>
                        </div>
                        {j.estado === 'Finalizada' && (
                            <div style={{marginTop: '15px', backgroundColor: 'rgba(0,0,0,0.4)', padding: '15px', borderRadius: '12px', borderLeft: `4px solid ${styles.colors.golden}`}}>
                                <p style={{color: styles.colors.lightText, fontSize: '1.05rem'}}><strong>Resultado:</strong> <span style={{fontFamily: "'Oswald', sans-serif", fontSize: '1.2rem', marginLeft: '5px'}}>{j.resultadoLocal} - {j.resultadoVisitante}</span></p>
                                <p style={{color: styles.colors.golden, marginTop: '8px', fontSize: '0.95rem'}}><strong>{j.ganadores?.length > 0 ? '🏆 Ganadores Exacto:' : '💰'}</strong> {j.ganadores?.length > 0 ? j.ganadores.join(', ') : 'Bote Acumulado'}</p>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// ============================================================================
// --- ADMINISTRADOR ---
// ============================================================================
const AdminCierreTemporada = () => {
    const [udlpAsciende, setUdlpAsciende] = useState('Sí');
    const [udlpPosicion, setUdlpPosicion] = useState('');
    const [equipoAscendidoPlayoff, setEquipoAscendidoPlayoff] = useState('');
    const [procesando, setProcesando] = useState(false);

    const handleFinalizarTemporada = async () => {
        if (!udlpPosicion || !equipoAscendidoPlayoff) {
            alert('Por favor, rellena todos los campos antes de finalizar.'); return;
        }
        if(!window.confirm("¡ATENCIÓN! Esto calculará todos los puntos extra (+20, +10, +5) de la Porra Anual y El Camino, y los sumará a la Clasificación Global. ¿Seguro que los datos son correctos?")) return;
        
        setProcesando(true);
        try {
            const clasifSnap = await getDocs(collection(db, "clasificacion"));
            const anualSnap = await getDocs(collection(db, "porraAnual"));
            const extraSnap = await getDocs(collection(db, "apuestasExtra"));
            
            const apuestasAnuales = {};
            anualSnap.forEach(d => apuestasAnuales[d.id] = d.data());
            
            const apuestasExtra = {};
            extraSnap.forEach(d => apuestasExtra[d.id] = d.data());

            // Asegurar que Carlos, Carmelo y José tienen el Málaga si no votaron
            ['Carlos', 'Carmelo', 'José'].forEach(nombre => {
                if(!apuestasExtra[nombre]) apuestasExtra[nombre] = { equipo: 'Málaga CF' };
            });

            const batch = writeBatch(db);

            clasifSnap.forEach(docSnap => {
                const userId = docSnap.id;
                let ptsSumar = 0;
                let desglose = [];

                // 1. Calcular "El Camino"
                if(apuestasExtra[userId] && apuestasExtra[userId].equipo === equipoAscendidoPlayoff) {
                    ptsSumar += 5;
                    desglose.push('+5 (El Camino)');
                }

                // 2. Calcular "Porra Anual"
                if(apuestasAnuales[userId]) {
                    const ap = apuestasAnuales[userId];
                    const apAsciende = (ap.asciende === 'Sí' || ap.asciende === true) ? 'Sí' : 'No';
                    const aciertoAsciende = (apAsciende === udlpAsciende);
                    // Comparar strings por si acaso hay espacios
                    const aciertoPosicion = (String(ap.posicion).trim() === String(udlpPosicion).trim());

                    if (aciertoAsciende && aciertoPosicion) {
                        ptsSumar += 20; desglose.push('+20 (Pleno Anual)');
                    } else if (aciertoPosicion) {
                        ptsSumar += 10; desglose.push('+10 (Posición Anual)');
                    } else if (aciertoAsciende) {
                        ptsSumar += 5; desglose.push('+5 (Ascenso Anual)');
                    }
                }

                // 3. Sumar y actualizar base de datos
                if (ptsSumar > 0) {
                    const currentTotal = docSnap.data().puntosTotales || 0;
                    batch.update(doc(db, "clasificacion", userId), {
                        puntosTotales: currentTotal + ptsSumar,
                        puntosExtraSumados: ptsSumar,
                        desgloseExtra: desglose.join(' | ')
                    });
                }
            });

            await batch.commit();
            alert("¡Puntos extra repartidos! La Clasificación Global ha sido actualizada.");
        } catch (error) {
            console.error(error); alert("Error al procesar el cierre de temporada.");
        }
        setProcesando(false);
    };

    return (
        <div style={{padding: '25px', backgroundColor: 'rgba(230,57,70,0.1)', border: `1px solid ${styles.colors.danger}`, borderRadius: '16px', marginBottom: '30px'}}>
            <h3 style={{fontFamily: "'Oswald', sans-serif", color: styles.colors.danger, marginBottom: '15px'}}>🚨 CIERRE DE TEMPORADA DEFINITIVO</h3>
            <p style={{color: styles.colors.silver, fontSize: '0.9rem', marginBottom: '20px'}}>Usa esto SOLO cuando la liga haya terminado. Sumará automáticamente los puntos extra de la Porra Anual y El Camino.</p>
            
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px'}}>
                <div>
                    <label style={styles.label}>¿UDLP Ascendió?</label>
                    <select value={udlpAsciende} onChange={e=>setUdlpAsciende(e.target.value)} style={styles.input}>
                        <option value="Sí">Sí</option>
                        <option value="No">No</option>
                    </select>
                </div>
                <div>
                    <label style={styles.label}>Posición Final Real UDLP:</label>
                    <input type="number" value={udlpPosicion} onChange={e=>setUdlpPosicion(e.target.value)} placeholder="Ej: 3" style={styles.input} />
                </div>
                <div style={{gridColumn: '1 / -1'}}>
                    <label style={styles.label}>Equipo Campeón Playoff (Sube):</label>
                    <select value={equipoAscendidoPlayoff} onChange={e=>setEquipoAscendidoPlayoff(e.target.value)} style={styles.input}>
                        <option value="">-- Selecciona --</option>
                        <option value="UD Las Palmas">UD Las Palmas</option>
                        <option value="Málaga CF">Málaga CF</option>
                        <option value="UD Almería">UD Almería</option>
                        <option value="CD Castellón">CD Castellón</option>
                    </select>
                </div>
            </div>
            
            <button onClick={handleFinalizarTemporada} disabled={procesando} style={{...styles.mainButton, width: '100%', backgroundColor: styles.colors.danger, color: '#fff', border: 'none', background: 'none'}}>
                {procesando ? 'PROCESANDO...' : 'FINALIZAR TEMPORADA Y REPARTIR PUNTOS'}
            </button>
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
    
    const toInputFormat = (date) => { if (!date || !date.seconds) return ''; const d = new Date(date.seconds * 1000); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
    
    const [fechaApertura, setFechaApertura] = useState(toInputFormat(jornada.fechaApertura));
    const [fechaCierre, setFechaCierre] = useState(toInputFormat(jornada.fechaCierre));
    const [fechaPartido, setFechaPartido] = useState(toInputFormat(jornada.fechaPartido));

    const [isUnlocked, setIsUnlocked] = useState(jornada.estado !== 'Finalizada');
    const [liveData, setLiveData] = useState({ golesLocal: 0, golesVisitante: 0, primerGoleador: '', isLive: false });

    useEffect(() => { if (jornada.liveData) { setLiveData({ ...jornada.liveData }); } }, [jornada.liveData]);

    const handleSaveChanges = async () => {
        const jornadaRef = doc(db, "jornadas", jornada.id);
        
        let ganadoresArray = [];
        
        // --- PARSE INT AQUÍ PARA EVITAR ERRORES DE LECTURA AL BUSCAR GANADORES ---
        if (estado === 'Finalizada' && resultadoLocal !== '' && resultadoVisitante !== '') {
            const resL = parseInt(resultadoLocal);
            const resV = parseInt(resultadoVisitante);
            
            const pSnap = await getDocs(collection(db, "pronosticos", jornada.id, "jugadores"));
            pSnap.forEach(docSnap => {
                const p = docSnap.data();
                let isWinner = false;
                
                if (parseInt(p.golesLocal) === resL && parseInt(p.golesVisitante) === resV) {
                    isWinner = true;
                } 
                else if (p.jokerActivo && p.jokerPronosticos) {
                    for (let jp of p.jokerPronosticos) {
                        if (jp.local !== '' && jp.visitante !== '' && parseInt(jp.local) === resL && parseInt(jp.visitante) === resV) {
                            isWinner = true; break;
                        }
                    }
                }
                
                if (isWinner) ganadoresArray.push(docSnap.id);
            });
        }

        const updateData = { 
            estado, resultadoLocal, resultadoVisitante, esVip, tipoPartido, h2hInfo, goleador, bote: parseFloat(bote) || 0,
            fechaApertura: fechaApertura ? new Date(fechaApertura) : null, 
            fechaCierre: fechaCierre ? new Date(fechaCierre) : null, 
            fechaPartido: fechaPartido ? new Date(fechaPartido) : null 
        };

        if (estado === 'Finalizada') {
            updateData.ganadores = ganadoresArray;
        }

        await updateDoc(jornadaRef, updateData);
        alert('Jornada guardada y ganadores calculados automáticamente.');
    };

    const handleUpdateLiveState = async () => {
        const jornadaRef = doc(db, "jornadas", jornada.id);
        await updateDoc(jornadaRef, { estado: 'En vivo', liveData: { golesLocal: parseInt(liveData.golesLocal), golesVisitante: parseInt(liveData.golesVisitante), primerGoleador: liveData.primerGoleador, isLive: true } });
        alert('Marcador en vivo actualizado');
    };

    const handleSendPush1Hora = async () => {
        if(window.confirm("¿Seguro que quieres enviar notificación PUSH: '1 Hora para cierre' a todos los usuarios?")) {
            alert("✅ Notificación PUSH (1 HORA) enviada (simulación).");
        }
    };
    const handleSendPush10Min = async () => {
        if(window.confirm("¿Seguro que quieres enviar notificación PUSH: '10 Minutos para cierre' a todos los usuarios?")) {
            alert("🚨 Notificación PUSH (10 MIN) enviada (simulación).");
        }
    };

    if (!isUnlocked) {
        return (
            <div style={{...styles.adminJornadaItem, display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.05)', borderColor: 'rgba(16,185,129,0.3)'}}>
                <div><span style={{fontWeight: 'bold', color: styles.colors.success, fontFamily: "'Oswald', sans-serif", letterSpacing: '1px'}}>✓ {getNombreJornada(jornada.numeroJornada)}: {jornada.equipoLocal} vs {jornada.equipoVisitante}</span> <span style={{color: styles.colors.silver, fontSize: '0.8rem'}}>(Finalizada)</span></div>
                <button onClick={() => setIsUnlocked(true)} style={{...styles.secondaryButton, padding: '6px 12px', fontSize: '0.75rem'}}>Desbloquear</button>
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
                
                <div><label style={styles.label}>Apertura Apuestas:</label><input type="datetime-local" value={fechaApertura} onChange={(e) => setFechaApertura(e.target.value)} style={styles.input} /></div>
                <div><label style={styles.label}>Cierre Apuestas:</label><input type="datetime-local" value={fechaCierre} onChange={(e) => setFechaCierre(e.target.value)} style={styles.input} /></div>
                <div><label style={styles.label}>Fecha Partido (H.Canaria):</label><input type="datetime-local" value={fechaPartido} onChange={(e) => setFechaPartido(e.target.value)} style={styles.input} /></div>
                
                <div style={{gridColumn: '1 / -1'}}><label style={styles.label}>Historial vs Rival (Info Previa):</label><input type="text" value={h2hInfo} onChange={(e) => setH2hInfo(e.target.value)} placeholder="Ej: UDLP 2-1 Málaga | Málaga 0-0 UDLP" style={styles.input} /></div>
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

            {estado === 'Abierta' && (
                <div style={{marginTop: '25px', padding: '20px', backgroundColor: 'rgba(252, 163, 17, 0.05)', borderRadius: '12px', border: `1px solid rgba(252, 163, 17, 0.3)`}}>
                    <h4 style={{color: styles.colors.warning, textTransform: 'uppercase', marginBottom: '15px', fontFamily: "'Oswald', sans-serif", letterSpacing: '1px'}}>🔔 Gestión de Alarmas (Push)</h4>
                    <div style={{display: 'flex', gap: '15px', flexWrap: 'wrap'}}>
                        <button onClick={handleSendPush1Hora} style={{...styles.secondaryButton, flex: 1, borderColor: styles.colors.warning, color: styles.colors.warning}}>🚨 AVISO 1 HORA</button>
                        <button onClick={handleSendPush10Min} style={{...styles.secondaryButton, flex: 1, borderColor: styles.colors.danger, color: styles.colors.danger}}>🚨 AVISO 10 MIN</button>
                    </div>
                </div>
            )}
            
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
            <h3 style={{...styles.formSectionTitle, fontSize: '1.2rem', borderBottom: `1px solid rgba(255,215,0,0.2)`, paddingBottom: '10px'}}>⚙️ Gestión "El Camino"</h3>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginTop: '20px'}}>
                <div><label style={styles.label}>Ganador Semi 1:</label><select value={config.semi1_ganador} onChange={e=>setConfig({...config, semi1_ganador: e.target.value})} style={styles.adminSelect}><option value="">--</option><option value="UD Almería">Almería</option><option value="CD Castellón">Castellón</option></select></div>
                <div><label style={styles.label}>Ganador Semi 2:</label><select value={config.semi2_ganador} onChange={e=>setConfig({...config, semi2_ganador: e.target.value})} style={styles.adminSelect}><option value="">--</option><option value="Málaga CF">Málaga</option><option value="UD Las Palmas">UDLP</option></select></div>
                <div><label style={styles.label}>¡EQUIPO ASCENDIDO!:</label><input type="text" value={config.ascendido || ''} onChange={e=>setConfig({...config, ascendido: e.target.value})} style={styles.input} /></div>
                <div><label style={styles.label}>Cierre Apuestas Extras (+5):</label><input type="datetime-local" value={config.fechaCierreApuestaExtra || ''} onChange={e=>setConfig({...config, fechaCierreApuestaExtra: e.target.value})} style={styles.input} /></div>
            </div>
            <div style={{marginTop: '25px', padding: '15px', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: '10px', display: 'flex', alignItems: 'center'}}><input type="checkbox" checked={config.bloqueado} onChange={e=>setConfig({...config, bloqueado: e.target.checked})} style={styles.checkbox} /> <span style={{color:styles.colors.lightText, marginLeft:'12px', fontWeight: 'bold', fontSize: '0.9rem', textTransform: 'uppercase'}}>Bloquear Apuestas Extra (Botones)</span></div>
            <button onClick={handleSave} style={{...styles.saveButton, marginTop:'20px', width: '100%'}}>GUARDAR CUADRO PLAYOFF</button>
        </div>
    );
};

const AdminPanelScreen = ({ plantilla }) => {
    const [jornadas, setJornadas] = useState([]);
    const [generando, setGenerando] = useState(false);

    useEffect(() => { 
        const unsub = onSnapshot(query(collection(db, "jornadas"), orderBy("numeroJornada", "desc")), (snap) => { setJornadas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); }); 
        return () => unsub(); 
    }, []);

    const handleGenerarPlayoffs = async () => {
        if(!window.confirm("¿Estás seguro? Esto creará las 4 jornadas del Playoff en la base de datos.")) return;
        setGenerando(true);
        try {
            const batch = writeBatch(db);
            batch.set(doc(db, "jornadas", "jornada_43"), { numeroJornada: 43, equipoLocal: "UD Las Palmas", equipoVisitante: "Málaga CF", estado: "Pre-apertura", esVip: false, tipoPartido: "ida", fechaPartido: new Date("2026-06-07T20:00:00"), fechaApertura: new Date("2026-06-02T12:00:00"), fechaCierre: new Date("2026-06-07T20:00:00"), bote: 0, h2hInfo: "Fase Regular: UDLP 2-1 Málaga | Málaga 0-0 UDLP" });
            batch.set(doc(db, "jornadas", "jornada_44"), { numeroJornada: 44, equipoLocal: "Málaga CF", equipoVisitante: "UD Las Palmas", estado: "Próximamente", esVip: true, tipoPartido: "vuelta_semi", fechaPartido: new Date("2026-06-10T20:00:00"), fechaApertura: new Date("2026-06-08T10:00:00"), fechaCierre: new Date("2026-06-10T20:00:00"), bote: 0, h2hInfo: "Fase Regular: UDLP 2-1 Málaga | Málaga 0-0 UDLP" });
            batch.set(doc(db, "jornadas", "jornada_45"), { numeroJornada: 45, equipoLocal: "Rival Final", equipoVisitante: "UD Las Palmas", estado: "Próximamente", esVip: false, tipoPartido: "ida", fechaPartido: new Date("2026-06-14T20:00:00"), fechaApertura: new Date("2026-06-11T12:00:00"), fechaCierre: new Date("2026-06-14T20:00:00"), bote: 0, h2hInfo: "" });
            batch.set(doc(db, "jornadas", "jornada_46"), { numeroJornada: 46, equipoLocal: "UD Las Palmas", equipoVisitante: "Rival Final", estado: "Próximamente", esVip: true, tipoPartido: "vuelta_final", fechaPartido: new Date("2026-06-20T20:00:00"), fechaApertura: new Date("2026-06-15T12:00:00"), fechaCierre: new Date("2026-06-20T20:00:00"), bote: 0, h2hInfo: "" });
            await batch.commit(); alert("¡Jornadas de Playoff generadas con éxito!");
        } catch (error) { console.error(error); alert("Error al generar las jornadas."); }
        setGenerando(false);
    };

    return (
        <div>
            <h2 style={styles.title}>PANEL DE CONTROL</h2>
            <div style={{textAlign: 'center', marginBottom: '30px'}}>
                <button onClick={handleGenerarPlayoffs} disabled={generando} style={{...styles.mainButton, backgroundColor: 'transparent', background: `linear-gradient(135deg, ${styles.colors.danger}, #8b0000)`, color: 'white', border: `1px solid rgba(255,255,255,0.2)`, boxShadow: '0 8px 20px rgba(230,57,70,0.4)'}}>
                    {generando ? "GENERANDO..." : "⚡ AUTO-GENERAR HORARIOS PLAYOFF"}
                </button>
                <p style={{color: styles.colors.silver, marginTop: '15px', fontSize: '0.85rem', fontStyle: 'italic'}}>Solo usar una vez para inyectar la estructura inicial a la base de datos.</p>
            </div>
            <AdminPlayoffPanel />
            <AdminCierreTemporada />
            {jornadas.map(j => (<JornadaAdminItem key={j.id} jornada={j} plantilla={plantilla} />))}
        </div>
    );
};

// ============================================================================
// --- COMPONENTE PRINCIPAL APP (ROUTER) ---
// ============================================================================
function App() {
    const [screen, setScreen] = useState('splash');
    const [activeTab, setActiveTab] = useState('miJornada');
    const [currentUser, setCurrentUser] = useState(null);
    const [teamLogos, setTeamLogos] = useState({});
    const [plantilla, setPlantilla] = useState(PLANTILLA_ACTUALIZADA);
    const [userProfiles, setUserProfiles] = useState({});
    const [onlineUsers, setOnlineUsers] = useState({});
    const [clasificacionData, setClasificacionData] = useState([]);
    const [showWelcomeModal, setShowWelcomeModal] = useState(false);

    useEffect(() => {
        // --- INYECCIÓN DE TÍTULO E ICONO ÉPICO ---
        document.title = "🏆 PLAYOFF 2026";
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
        }
        link.href = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">⭐</text></svg>';

        // --- ESTILOS CSS BASE PREMIUM ---
        const styleSheet = document.createElement("style"); 
        styleSheet.innerText = `
            @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&family=Oswald:wght@400;600;700&display=swap');
            * { margin: 0; padding: 0; box-sizing: border-box; }
            html { font-size: 16px !important; -webkit-text-size-adjust: 100%; }
            body, #root { width: 100%; min-width: 100%; overflow-x: hidden; background-color: ${colors.deepBlue}; }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; visibility: hidden; } }
            @keyframes slideInFromRight { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
            @keyframes pulse { 0% { transform: scale(1); } 100% { transform: scale(1.05); } }
            .content-enter-active { animation: slideInFromRight 0.4s ease-out; }
            @keyframes blink-live { 50% { background-color: #5a0000; } }
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

        const splashTimer = setTimeout(() => { setScreen('login'); }, 2500);

        return () => { document.head.removeChild(styleSheet); unsubEscudos(); unsubClasificacion(); unsubStatus(); clearTimeout(splashTimer); }
    }, []);

    const handleLogin = async (user) => {
        try {
            setCurrentUser(user);
            set(ref(rtdb, 'status/' + user), true); onDisconnect(ref(rtdb, 'status/' + user)).set(false);
            setScreen('app');
            // MODAL V12: Saltará automáticamente al hacer login
            if (!localStorage.getItem('playoffWelcomeSeenV12')) { setShowWelcomeModal(true); }
        } catch (error) { alert("Error al iniciar sesión."); }
    };

    const handleLogout = async () => { if (currentUser) set(ref(rtdb, 'status/' + currentUser), false); setCurrentUser(null); setScreen('login'); };

    if (screen === 'splash') return <EpicSplashScreen />;
    if (screen === 'login') return <div style={styles.container}><div style={styles.card}><div style={{textAlign: 'center'}}><h2 style={styles.title}>ACCESO PLAYOFF</h2><div style={styles.userList}>{JUGADORES.map(j => <button key={j} onClick={() => handleLogin(j)} style={styles.userButton}><div style={{position: 'relative'}}><div style={styles.loginProfileIconCircle}>{userProfiles[j]?.icon || '❓'}</div>{onlineUsers[j] && <div style={{position: 'absolute', bottom: '0', right: '-5px', width: '14px', height: '14px', backgroundColor: styles.colors.success, borderRadius: '50%', border: `2px solid ${styles.colors.deepBlue}`, boxShadow: `0 0 8px ${styles.colors.success}`}}></div>}</div> {j}</button>)}</div></div></div></div>;

    const renderContent = () => {
        switch (activeTab) {
            case 'miJornada': return <MiJornadaScreen user={currentUser} teamLogos={teamLogos} plantilla={plantilla} userProfiles={userProfiles} onlineUsers={onlineUsers} />;
            case 'elCamino': return <ElCaminoScreen user={currentUser} userProfiles={userProfiles} onlineUsers={onlineUsers} />;
            case 'laJornada': return <LaJornadaScreen userProfiles={userProfiles} onlineUsers={onlineUsers} teamLogos={teamLogos} />;
            case 'porraAnual': return <PorraAnualScreen userProfiles={userProfiles} onlineUsers={onlineUsers} />;
            case 'clasificacion': return <ClasificacionScreen currentUser={currentUser} userProfiles={userProfiles} onlineUsers={onlineUsers} />;
            case 'ligaRegular': return <LigaRegularScreen userProfiles={userProfiles} onlineUsers={onlineUsers} />;
            case 'estadisticas': return <EstadisticasScreen userProfiles={userProfiles} onlineUsers={onlineUsers} />;
            case 'pagos': return <PagosScreen />;
            case 'calendario': return <CalendarioScreen teamLogos={teamLogos} />;
            case 'admin': return currentUser === 'Juanma' ? <AdminPanelScreen plantilla={plantilla} /> : null;
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
                        <button onClick={() => setActiveTab('porraAnual')} style={activeTab === 'porraAnual' ? styles.navButtonActive : styles.navButton}>📅 Porra Anual</button>
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