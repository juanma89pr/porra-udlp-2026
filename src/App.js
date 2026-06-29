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

// --- DATOS DE LA APLICACIÓN ---
const JUGADORES = ["Juanma", "Lucy", "Antonio", "Mari", "Pedro", "Pedrito", "Himar", "Sarito", "Vicky", "Carmelo", "Laura", "Carlos", "José", "Claudio", "Javi"];
const APUESTA_NORMAL = 1;
const APUESTA_VIP = 2;

const EQUIPOS_LIGA = ["UD Las Palmas", "UD Almería", "Málaga CF", "CD Castellón", "Burgos CF", "Real Zaragoza", "SD Eibar", "Real Sporting de Gijón", "Real Racing Club"];

const PLANTILLA_ACTUALIZADA = [
    { dorsal: "1", nombre: "Dinko Horkas", imageUrl: "" }, { dorsal: "13", nombre: "José Antonio Caro", imageUrl: "" },
    { dorsal: "30", nombre: "Álvaro Killane", imageUrl: "" }, { dorsal: "35", nombre: "Adri Suárez", imageUrl: "" },
    { dorsal: "2", nombre: "Marvin Park", imageUrl: "" }, { dorsal: "3", nombre: "Mika Mármol", imageUrl: "" },
    { dorsal: "4", nombre: "Álex Suárez", imageUrl: "" }, { dorsal: "5", nombre: "Enrique Clemente", imageUrl: "" },
    { dorsal: "6", nombre: "Sergio Barcia", imageUrl: "" }, { dorsal: "15", nombre: "Juanma Herzog", imageUrl: "" },
    { dorsal: "23", nombre: "Cristian Gutiérrez", imageUrl: "" }, { dorsal: "27", nombre: "Valentín Pezzolesi", imageUrl: "" },
    { dorsal: "31", nombre: "Carlos Navarro", imageUrl: "" }, { dorsal: "42", nombre: "Víctor Villote", imageUrl: "" },
    { dorsal: "7", nombre: "Nicolás Benedetti", imageUrl: "" }, { dorsal: "8", nombre: "Iván Gil", imageUrl: "" },
    { dorsal: "9", nombre: "Jeremía Recoba", imageUrl: "" }, { dorsal: "12", nombre: "Enzo Loiodice", imageUrl: "" },
    { dorsal: "14", nombre: "Manu Fuster", imageUrl: "" }, { dorsal: "16", nombre: "Lorenzo Amatucci", imageUrl: "" },
    { dorsal: "17", nombre: "Viti Rozada", imageUrl: "" }, { dorsal: "20", nombre: "Kirian Rodríguez", imageUrl: "" },
    { dorsal: "21", nombre: "Jonathan Viera", imageUrl: "" }, { dorsal: "22", nombre: "Ale García", imageUrl: "" },
    { dorsal: "26", nombre: "Iñaki González", imageUrl: "" }, { dorsal: "36", nombre: "José Carlos González", imageUrl: "" },
    { dorsal: "10", nombre: "Jesé", imageUrl: "" }, { dorsal: "18", nombre: "Taisei Miyashiro", imageUrl: "" },
    { dorsal: "19", nombre: "Sandro Ramírez", imageUrl: "" }, { dorsal: "24", nombre: "Pejiño", imageUrl: "" },
    { dorsal: "34", nombre: "Diego Martín", imageUrl: "" }, { dorsal: "37", nombre: "Arturo Rodríguez", imageUrl: "" },
    { dorsal: "38", nombre: "Iván Medina", imageUrl: "" }, { dorsal: "39", nombre: "Estanis Pedrola", imageUrl: "" },
    { dorsal: "41", nombre: "Elías Romero", imageUrl: "" }, { dorsal: "44", nombre: "Rafa Cruz", imageUrl: "" },
    { dorsal: "49", nombre: "Iker Bravo", imageUrl: "" }
];

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
    container: { display: 'flex', justifyContent: 'center', alignItems: 'flex-start', width: '100%', minHeight: '100dvh', background: '#f0f0f0', padding: '15px', fontFamily: "'Montserrat', sans-serif" },
    card: { width: '100%', maxWidth: '900px', backgroundColor: '#ffffff', color: '#0a0a0a', padding: '25px', borderRadius: '20px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', minHeight: 'calc(100dvh - 30px)', border: '1px solid rgba(0,0,0,0.08)' },
    title: { fontFamily: "'Oswald', sans-serif", color: colors.deepBlue, textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center', borderBottom: `2px solid ${colors.golden}`, paddingBottom: '15px', marginBottom: '25px', fontSize: 'clamp(1.5rem, 5vw, 2rem)' },
    mainButton: { fontFamily: "'Oswald', sans-serif", padding: '14px 28px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', border: 'none', borderRadius: '30px', background: `linear-gradient(135deg, ${colors.goldenDark}, ${colors.golden})`, color: '#000', marginTop: '20px', transition: 'all 0.3s ease', textTransform: 'uppercase', letterSpacing: '1px', boxShadow: '0 4px 12px rgba(212,175,55,0.35)' },
    secondaryButton: { fontFamily: "'Montserrat', sans-serif", padding: '10px 20px', fontSize: '0.9rem', cursor: 'pointer', border: `1px solid ${colors.deepBlue}`, borderRadius: '20px', backgroundColor: 'rgba(0,31,107,0.05)', color: colors.deepBlue, transition: 'all 0.3s ease', textTransform: 'uppercase', fontWeight: 'bold' },
    placeholder: { padding: '40px 20px', backgroundColor: '#f9f9f9', border: `1px dashed ${colors.goldenDark}`, borderRadius: '16px', textAlign: 'center', color: '#555' },
    epicSplashContainer: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: '#001F6B', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', zIndex: 9999, animation: 'fadeOut 0.5s ease 2.5s forwards' },
    epicSplashSubtitle: { fontFamily: "'Montserrat', sans-serif", fontSize: 'clamp(1rem, 4vw, 1.5rem)', fontWeight: '600', color: '#FFD700', letterSpacing: '5px', marginBottom: '10px', textTransform: 'uppercase' },
    epicSplashTitle: { fontFamily: "'Oswald', sans-serif", fontSize: 'clamp(3rem, 10vw, 5.5rem)', fontWeight: 'bold', color: '#ffffff', textTransform: 'uppercase', textAlign: 'center', animation: 'pulse 1.5s infinite alternate', lineHeight: 1.1 },
    navbar: { display: 'flex', flexWrap: 'wrap', gap: '8px', borderBottom: `2px solid ${colors.golden}`, paddingBottom: '15px', marginBottom: '25px', alignItems: 'center', justifyContent: 'center' },
    navButton: { fontFamily: "'Montserrat', sans-serif", padding: '8px 14px', fontSize: '0.85rem', border: 'none', borderRadius: '8px', backgroundColor: 'transparent', color: '#555', cursor: 'pointer', transition: 'all 0.3s', textTransform: 'uppercase', fontWeight: '600' },
    navButtonActive: { fontFamily: "'Montserrat', sans-serif", padding: '8px 14px', fontSize: '0.85rem', border: `1px solid ${colors.deepBlue}`, borderRadius: '8px', backgroundColor: colors.deepBlue, color: '#FFD700', cursor: 'pointer', textTransform: 'uppercase', fontWeight: 'bold' },
    logoutButton: { fontFamily: "'Montserrat', sans-serif", padding: '8px 14px', fontSize: '0.85rem', border: `1px solid ${colors.danger}`, borderRadius: '8px', backgroundColor: 'rgba(230,57,70,0.08)', color: colors.danger, cursor: 'pointer', marginLeft: '10px', textTransform: 'uppercase', fontWeight: '600' },
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
const PlayerProfileDisplay = ({ name, profile, defaultColor = styles.colors.lightText, isOnline = false }) => {
    const p = profile || {}; const color = p.color || defaultColor; const isG = typeof color === 'string' && color.startsWith('linear-gradient');
    const nStyle = { ...(isG ? { background: color, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } : { color }), fontWeight: 'bold' };
    return (<span style={{display: 'inline-flex', alignItems: 'center', gap: '8px' }}>{p.icon && <span>{p.icon}</span>}<span style={nStyle}>{name}</span>{isOnline && <span style={{width: '8px', height: '8px', backgroundColor: styles.colors.success, borderRadius: '50%', boxShadow: `0 0 8px ${styles.colors.success}`}}></span>}</span>);
};

const TeamDisplay = ({ teamLogos, teamName, shortName = false, imgStyle }) => (<div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:'8px', flex: '0 0 auto'}}><img src={teamLogos[teamName] || 'https://placehold.co/80x80/1b263b/e0e1dd?text=?'} style={imgStyle} alt={teamName} /><span style={{fontSize:'clamp(0.85rem, 2.5vw, 1rem)', fontWeight:'600', color:styles.colors.lightText, fontFamily:"'Montserrat', sans-serif"}}>{shortName && teamName === "UD Las Palmas" ? "UDLP" : teamName}</span></div>);

const LoadingSkeleton = () => (<div style={{padding:'60px', textAlign:'center', color:styles.colors.golden, fontFamily:"'Oswald', sans-serif", fontSize:'1.2rem', letterSpacing:'2px'}}>CARGANDO DATOS...</div>);

// ─── MODO CONSTRUCCIÓN ────────────────────────────────────────────────────────
// Cambia a false para desbloquear la app cuando esté lista
const APP_EN_CONSTRUCCION = true;

const ModoConstruccion = () => {
    const [fase, setFase] = useState(0); // 0=azul, 1=presentacion, 2=pizarra

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
                    <div className="mcfi4" style={{display:'flex',gap:6}}>
                        {[0,1,2].map(i=>(<div key={i} className="mcd" style={{width:4,height:4,borderRadius:'50%',background:'#001F6B',animationDelay:`${i*0.25}s`}}/>))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const EpicSplashScreen = () => (
    <div style={styles.epicSplashContainer}>
        <p style={styles.epicSplashSubtitle}>PORRA UDLP 2026</p>
        <h1 style={styles.epicSplashTitle}>FIN DE LA<br/>HAZAÑA</h1>
    </div>
);

// --- MODAL ÉPICO DE BIENVENIDA V13 (MENSAJE FINAL Y CORRECCIONES) ---
const PlayoffWelcomeModal = ({ onClose }) => {
    const [step, setStep] = useState(1);

    return (
        <div style={styles.modalOverlay}>
            <div style={styles.modalContent}>
                <h2 style={{...styles.title, fontSize: '1.8rem', marginBottom: '0', borderBottom: 'none', letterSpacing: '2px', lineHeight: 1.2}}>
                    {step === 1 && "🏁 HASTA AQUÍ HEMOS LLEGADO"}{step === 2 && "🔄 PUNTOS CORREGIDOS"}{step === 3 && "📅 PORRA ANUAL"}
                </h2>
                <div style={styles.modalDots}>
                    <div style={step === 1 ? styles.modalDotActive : styles.modalDotInactive} /><div style={step === 2 ? styles.modalDotActive : styles.modalDotInactive} /><div style={step === 3 ? styles.modalDotActive : styles.modalDotInactive} />
                </div>
                
                <div style={{minHeight: '220px', display: 'flex', flexDirection: 'column', justifyContent: 'center', width: '100%', fontFamily: "'Montserrat', sans-serif"}}>
                    {step === 1 && (
                        <>
                            <p style={{fontSize: '1.1rem', marginBottom: '15px', color: styles.colors.lightText, lineHeight: 1.5, fontWeight: '600'}}>La UD Las Palmas se ha quedado a las puertas.</p>
                            <p style={{color: styles.colors.silver, fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '10px'}}>La temporada se ha terminado, pero la competición por los premios sigue viva. Ya solo nos queda saber qué equipo ascenderá a Primera.</p>
                        </>
                    )}
                    {step === 2 && (
                        <div style={{textAlign: 'left', lineHeight: 1.6, color: styles.colors.silver}}>
                            <p style={{marginBottom: '15px'}}><span style={{color: styles.colors.success, fontWeight: 'bold'}}>ERRORES SOLUCIONADOS:</span> Se ha corregido el error matemático que no sumaba los puntos de "No Pasa" o "Pierde". Además, hemos inyectado automáticamente la apuesta de Claudio para que conste en el marcador de la jornada de vuelta.</p>
                        </div>
                    )}
                    {step === 3 && (
                        <div style={{textAlign: 'left', lineHeight: 1.6, color: styles.colors.silver}}>
                            <p style={{marginBottom: '15px'}}><span style={{color: styles.colors.golden, fontWeight: 'bold'}}>PORRA ANUAL Y REPARTO FINAL:</span> Ya pueden consultar la pestaña "Porra Anual" en el menú para ver qué apostaron en agosto.</p>
                            <div style={{backgroundColor: 'rgba(212,175,55,0.05)', padding: '15px', borderRadius: '12px', border: `1px solid rgba(212,175,55,0.3)`}}>
                                <p style={{color: styles.colors.golden, fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '5px'}}>PUNTOS EXTRA A REPARTIR AL FINAL:</p>
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
                    {step < 3 ? <button onClick={() => setStep(prev => prev + 1)} style={{...styles.mainButton, marginTop: 0}}>Siguiente</button> : <button onClick={() => { localStorage.setItem('playoffWelcomeSeenV13', 'true'); onClose(); }} style={{...styles.mainButton, marginTop: 0}}>¡ENTENDIDO!</button>}
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
                        {/* --- SECCIÓN PRE-APERTURA --- */}
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

                        {/* --- FORMULARIO DE APUESTAS --- */}
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

                        {/* --- TU PRONÓSTICO (ESTILO FICHAS) --- */}
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
    
    // Función para saber si un resultado exacto concreto es el ganador
    const isExactResultWinner = (pL, pV) => {
        if (!isLiveView && jornadaActual.estado !== 'Finalizada') return false;
        const gL = isLiveView ? liveData.golesLocal : jornadaActual.resultadoLocal;
        const gV = isLiveView ? liveData.golesVisitante : jornadaActual.resultadoVisitante;
        if (gL === undefined || gV === undefined || gL === '' || gV === '') return false;
        return parseInt(pL) === parseInt(gL) && parseInt(pV) === parseInt(gV);
    };

    // --- CÁLCULO ECONÓMICO EN VIVO ---
    const costeBase = jornadaActual.esVip ? APUESTA_VIP : APUESTA_NORMAL;
    let recaudacionApuestas = 0;
    let ganadoresExactos = [];

    participantes.forEach(p => {
        recaudacionApuestas += costeBase; // Apuesta normal
        let esGanador = false;
        
        if (isExactResultWinner(p.golesLocal, p.golesVisitante)) { esGanador = true; }

        if (p.jokerActivo && p.jokerPronosticos) {
            const huecosRellenos = p.jokerPronosticos.filter(jp => jp.local !== '' && jp.visitante !== '');
            recaudacionApuestas += (huecosRellenos.length * costeBase);
            for (let jp of huecosRellenos) {
                if (isExactResultWinner(jp.local, jp.visitante)) { esGanador = true; }
            }
        }
        if (esGanador) ganadoresExactos.push(p.id);
    });

    const boteInicial = parseFloat(jornadaActual.bote || 0);
    const premioTotal = boteInicial + recaudacionApuestas;
    const premioPorPersona = ganadoresExactos.length > 0 ? (premioTotal / ganadoresExactos.length).toFixed(2) : 0;

    return (
        <div>
            {isLiveView && <div style={styles.liveBanner}>🔴 PARTIDO EN VIVO 🔴</div>}
            <h2 style={styles.title} className="app-title">LA JORNADA</h2>
            <div style={{...styles.form, padding: '30px 20px', textAlign: 'center'}}>
                <h3 style={{fontFamily: "'Oswald', sans-serif", color: styles.colors.golden, marginBottom: '25px', fontSize: '1.8rem', textTransform: 'uppercase', letterSpacing: '2px'}}>{getNombreJornada(jornadaActual.numeroJornada)}</h3>
                
                <div style={styles.miJornadaMatchInfo}>
                    <TeamDisplay teamLogos={teamLogos} teamName={jornadaActual.equipoLocal} shortName={true} imgStyle={styles.miJornadaTeamLogo} />
                    <div style={styles.miJornadaScoreInputs}>
                        <div style={{...styles.resultInput, display: 'flex', justifyContent: 'center', alignItems: 'center'}}>{isLiveView ? liveData.golesLocal : (jornadaActual.estado === 'Finalizada' ? jornadaActual.resultadoLocal : '-')}</div>
                        <span style={styles.separator}>-</span>
                        <div style={{...styles.resultInput, display: 'flex', justifyContent: 'center', alignItems: 'center'}}>{isLiveView ? liveData.golesVisitante : (jornadaActual.estado === 'Finalizada' ? jornadaActual.resultadoVisitante : '-')}</div>
                    </div>
                    <TeamDisplay teamLogos={teamLogos} teamName={jornadaActual.equipoVisitante} shortName={true} imgStyle={styles.miJornadaTeamLogo} />
                </div>
                
                {isLiveView && liveData.primerGoleador && <p style={{color: styles.colors.golden, marginTop: '15px', fontWeight: 'bold', fontSize: '1.3rem', fontFamily: "'Oswald', sans-serif", letterSpacing: '1px'}}>⚽ {liveData.primerGoleador}</p>}

                {/* --- PANEL ECONÓMICO --- */}
                <div style={{backgroundColor: 'rgba(0,0,0,0.4)', padding: '20px', borderRadius: '16px', border: `1px solid ${styles.colors.goldenDark}`, marginBottom: '35px', marginTop: '30px', boxShadow: `0 8px 20px rgba(0,0,0,0.3)`}}>
                    <h4 style={{color: styles.colors.golden, fontFamily: "'Oswald', sans-serif", fontSize: '1.2rem', marginBottom: '15px', textTransform: 'uppercase'}}>💰 Resumen Económico</h4>
                    <div style={{display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '15px', fontSize: '0.95rem'}}>
                        <span style={{color: styles.colors.silver}}>Bote Previo: <strong style={{color: '#fff'}}>{boteInicial}€</strong></span>
                        <span style={{color: styles.colors.silver}}>Apuestas/Jokers: <strong style={{color: '#fff'}}>{recaudacionApuestas}€</strong></span>
                        <span style={{color: styles.colors.golden, fontWeight: 'bold', fontSize: '1.1rem'}}>Total en Juego: {premioTotal}€</span>
                    </div>
                    
                    {(jornadaActual.estado === 'Finalizada' || isLiveView) ? (
                        ganadoresExactos.length > 0 ? (
                            <div style={{backgroundColor: 'rgba(16,185,129,0.1)', padding: '15px', borderRadius: '12px', border: `1px solid rgba(16,185,129,0.3)`}}>
                                <p style={{color: styles.colors.success, fontWeight: 'bold', marginBottom: '5px'}}>🏆 ¡POSIBLES GANADORES!</p>
                                <p style={{color: '#fff', fontSize: '0.9rem', marginBottom: '5px'}}>Acertantes ({ganadoresExactos.length}): {ganadoresExactos.join(', ')}</p>
                                <p style={{color: styles.colors.golden, fontSize: '1.2rem', fontFamily: "'Oswald', sans-serif"}}>{premioPorPersona}€ / ganador</p>
                            </div>
                        ) : (
                            <div style={{backgroundColor: 'rgba(230,57,70,0.1)', padding: '15px', borderRadius: '12px', border: `1px solid rgba(230,57,70,0.3)`}}>
                                <p style={{color: styles.colors.danger, fontWeight: 'bold'}}>❌ SIN ACERTANTES EXACTOS</p>
                                <p style={{color: '#fff', fontSize: '0.9rem'}}>Los {premioTotal}€ pasarían al Bote de la próxima jornada.</p>
                            </div>
                        )
                    ) : (
                        <div style={{backgroundColor: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '10px', textAlign: 'center'}}>
                            <span style={{color: styles.colors.silver, fontSize: '0.85rem'}}>El resultado del premio se calculará en vivo durante el partido.</span>
                        </div>
                    )}
                </div>

                <div style={{marginTop: '40px'}}>
                    <h4 style={styles.formSectionTitle}>PRONÓSTICOS</h4>
                    {jornadaActual.estado === 'Abierta' || jornadaActual.estado === 'Pre-apertura' ? (
                        <div style={{padding: '25px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '16px', border: `1px dashed rgba(255,215,0,0.2)`}}>
                            <p style={{color: styles.colors.silver, fontSize: '0.9rem', fontStyle: 'italic'}}>Las apuestas son secretas hasta el inicio del encuentro.</p>
                            <p style={{marginTop: '15px', fontSize: '1.2rem', color: styles.colors.golden, fontFamily: "'Oswald', sans-serif", letterSpacing: '1px'}}>HAN APOSTADO: {participantes.length} / {JUGADORES.length}</p>
                        </div>
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
                                    <div key={p.id} style={{backgroundColor: 'rgba(0,0,0,0.4)', padding: '18px', borderRadius: '16px', borderLeft: `4px solid ${styles.colors.golden}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.2)'}}>
                                        <div style={{textAlign: 'left', flex: 1}}>
                                            <PlayerProfileDisplay name={p.id} profile={userProfiles[p.id]} isOnline={onlineUsers ? onlineUsers[p.id] : false} />
                                            <div style={{marginTop: '10px'}}>
                                                <span style={principalWin ? styles.betPillWin : styles.betPill}>{p.golesLocal}-{p.golesVisitante}</span>
                                                {p.jokerActivo && p.jokerPronosticos && p.jokerPronosticos.map((jp, idx) => {
                                                    if (jp.local === '' || jp.visitante === '') return null;
                                                    const isJokerWin = isExactResultWinner(jp.local, jp.visitante);
                                                    return <span key={idx} style={isJokerWin ? styles.betPillWin : {...styles.betPill, borderColor: styles.colors.warning, color: styles.colors.warning}}>🃏 {jp.local}-{jp.visitante}</span>
                                                })}
                                            </div>
                                            <div style={{fontSize: '0.85rem', color: styles.colors.silver, marginTop: '8px'}}>
                                                <strong style={{color: styles.colors.lightText}}>{p.resultado1x2}</strong><br/>⚽ {p.sinGoleador ? 'Sin Goleador' : p.goleador}
                                            </div>
                                        </div>
                                        {(jornadaActual.estado === 'Finalizada' || isLiveView) && (
                                            <div style={{fontSize: '1.6rem', fontWeight: 'bold', fontFamily: "'Oswald', sans-serif", color: isLiveView ? styles.colors.success : styles.colors.golden, textShadow: '0 2px 5px rgba(0,0,0,0.5)', paddingLeft: '15px'}}>{ptsDisplay}</div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
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
            const filas = JUGADORES.map(userId => {
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

    useEffect(() => { 
        const unsub = onSnapshot(query(collection(db, "jornadas"), orderBy("numeroJornada", "desc")), (snap) => { setJornadas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); }); 
        return () => unsub(); 
    }, []);

    return (
        <div>
            <h2 style={styles.title}>PANEL DE CONTROL</h2>
            <AdminPlayoffPanel />
            <AdminCierreTemporada />
            {jornadas.map(j => (<JornadaAdminItem key={j.id} jornada={j} plantilla={plantilla} />))}
        </div>
    );
};

// ============================================================================
// --- GALA FIN DE TEMPORADA ---
// ============================================================================
const GalaFinTemporada = ({ currentUser, userProfiles, onClose }) => {
    const [slide, setSlide] = useState(0);
    const [data, setData] = useState(null);
    const [clasifRevealed, setClasifRevealed] = useState(0);
    const [showPodium, setShowPodium] = useState(false);
    const TOTAL = 4;
    const esMalaga = eq => (eq||'').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").includes('MALAGA');

    useEffect(() => {
        const load = async () => {
            try {
                // Última jornada finalizada
                const jornadasSnap = await getDocs(query(collection(db,"jornadas"),where("estado","==","Finalizada"),orderBy("numeroJornada","desc"),limit(1)));
                let ultimaJ = null; let pronosticos = [];
                if(!jornadasSnap.empty){
                    ultimaJ = {id:jornadasSnap.docs[0].id,...jornadasSnap.docs[0].data()};
                    const pSnap = await getDocs(collection(db,"pronosticos",ultimaJ.id,"jugadores"));
                    pronosticos = pSnap.docs.map(d=>({id:d.id,...d.data()}));
                }
                // Calcular premio jornada
                let ganadores = ultimaJ?.ganadores || [];
                const coste = ultimaJ?.esVip ? 2 : 1;
                let rec = 0;
                pronosticos.forEach(p=>{ rec+=coste; if(p.jokerActivo&&p.jokerPronosticos){ rec+=p.jokerPronosticos.filter(jp=>jp.local!==''&&jp.visitante!=='').length*coste; }});
                const bote = parseFloat(ultimaJ?.bote||0);
                const totalBote = bote + rec;
                const premioPorGanador = ganadores.length > 0 ? (totalBote/ganadores.length).toFixed(2) : 0;

                // El Camino
                const playoffSnap = await getDoc(doc(db,"configuracion","playoff"));
                const playoff = playoffSnap.exists() ? playoffSnap.data() : {};
                const extraSnap = await getDocs(collection(db,"apuestasExtra"));
                const apuestasExtra = {};
                extraSnap.forEach(d=>{apuestasExtra[d.id]=d.data();});
                ['Carlos','Carmelo','José'].forEach(n=>{if(!apuestasExtra[n])apuestasExtra[n]={equipo:'Málaga CF'};});
                const caminoGanadores = Object.entries(apuestasExtra).filter(([,v])=>esMalaga(v.equipo||'')).map(([k])=>k);

                // Porra anual
                const anualSnap = await getDocs(collection(db,"porraAnualPronosticos"));
                const apuestasAnuales = {};
                anualSnap.forEach(d=>{apuestasAnuales[d.id]=d.data();});
                const g5=[],g10=[],g20=[];
                Object.entries(apuestasAnuales).forEach(([userId,ap])=>{
                    const ascRaw = String(ap.ascenso||ap.asciende||'').toUpperCase().trim();
                    const dijoSube = ascRaw==='SI'||ascRaw==='SÍ'||ascRaw==='TRUE';
                    const aciertoAsc = dijoSube===false;
                    const posRaw = String(ap.posicion||'').trim();
                    const aciertoPosicion = posRaw==='5';
                    if(aciertoAsc&&aciertoPosicion) g20.push(userId);
                    else if(aciertoPosicion) g10.push(userId);
                    else if(aciertoAsc) g5.push(userId);
                });

                // Clasificación
                const clasifSnap = await getDocs(collection(db,"clasificacion"));
                const clasif = clasifSnap.docs.map(d=>({id:d.id,...d.data()}))
                    .filter(d=>d.puntosTotales!==undefined)
                    .sort((a,b)=>(b.puntosTotales||0)-(a.puntosTotales||0));

                setData({ ultimaJ, ganadores, totalBote, premioPorGanador, playoff, caminoGanadores, g5, g10, g20, clasif });
                setSlide(1);
            } catch(e){ console.error(e); setSlide(1); }
        };
        load();
    }, []);

    const goNext = () => { if(slide < TOTAL) setSlide(s=>s+1); };
    const goPrev = () => { if(slide > 1) setSlide(s=>s-1); };

    const revealNext = () => {
        if(!data) return;
        const total = data.clasif.length;
        if(clasifRevealed < total){ setClasifRevealed(r=>r+1); }
        else { setShowPodium(true); }
    };

    const G = colors;

    const slideStyle = (n) => ({
        display: slide === n ? 'flex' : 'none',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', padding: '30px 20px', textAlign: 'center',
        animation: 'slideIn 0.5s ease',
    });

    const bigTitle = { fontFamily:"'Oswald',sans-serif", fontSize:'clamp(2rem,7vw,3rem)', fontWeight:700, color:G.golden, letterSpacing:'2px', lineHeight:1.1, textTransform:'uppercase', textShadow:`0 0 30px rgba(255,215,0,0.4)` };
    const subTitle = { fontFamily:"'Montserrat',sans-serif", fontSize:'11px', letterSpacing:'4px', color:'rgba(255,255,255,0.5)', textTransform:'uppercase', marginBottom:'12px' };
    const divider = { width:'50px', height:'2px', background:`linear-gradient(90deg,transparent,${G.goldenDark},transparent)`, margin:'16px auto' };
    const btn = { fontFamily:"'Oswald',sans-serif", background:`linear-gradient(135deg,${G.goldenDark},${G.golden},#FFF7A1,${G.golden})`, color:'#000', border:'none', borderRadius:'30px', padding:'13px 36px', fontSize:'1rem', fontWeight:700, cursor:'pointer', letterSpacing:'2px', textTransform:'uppercase', boxShadow:`0 8px 25px rgba(212,175,55,0.4)`, width:'100%', maxWidth:'300px', marginTop:'20px' };
    const btnSecondary = { ...btn, background:'transparent', color:G.golden, border:`1px solid ${G.goldenDark}`, boxShadow:'none', maxWidth:'140px', fontSize:'0.8rem', padding:'10px 20px' };
    const card = { background:'rgba(0,0,0,0.4)', border:`1px solid rgba(255,215,0,0.2)`, borderRadius:'16px', padding:'20px', width:'100%', marginBottom:'12px' };
    const progressDots = (
        <div style={{display:'flex',gap:'6px',marginBottom:'24px'}}>
            {[1,2,3,4].map(i=>(
                <div key={i} style={{flex:1,height:'3px',borderRadius:'2px',background: i<=slide ? G.goldenDark : 'rgba(255,255,255,0.12)',transition:'background .3s'}}/>
            ))}
        </div>
    );
    const winnerPill = (name, pts) => (
        <span key={name} style={{display:'inline-flex',alignItems:'center',gap:'6px',background:'rgba(16,185,129,0.15)',border:`1px solid ${G.success}`,color:G.success,borderRadius:'20px',padding:'5px 14px',fontSize:'12px',fontWeight:700,margin:'4px',letterSpacing:'1px'}}>
            {userProfiles[name]?.icon || '⭐'} {name} {pts && <span style={{background:G.success,color:'#000',borderRadius:'10px',padding:'1px 7px',fontSize:'10px',fontWeight:700,marginLeft:'4px'}}>{pts}</span>}
        </span>
    );
    const playerChip = (name, color='rgba(255,215,0,0.7)', pts=null) => (
        <span key={name} style={{display:'inline-flex',alignItems:'center',gap:'5px',background:'rgba(0,0,0,0.4)',border:`1px solid ${color}55`,color,borderRadius:'20px',padding:'5px 14px',fontSize:'12px',fontWeight:700,margin:'4px'}}>
            {userProfiles[name]?.icon || '⭐'} {name} {pts && <span style={{background:color,color:'#000',borderRadius:'10px',padding:'1px 8px',fontSize:'10px',fontWeight:800,marginLeft:'2px'}}>{pts}</span>}
        </span>
    );

    const overallStyle = { position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:9000, background:`linear-gradient(160deg,#000510 0%,#001230 50%,#000 100%)`, color:'#fdfbf7', overflowY:'auto', fontFamily:"'Montserrat',sans-serif" };

    if(!data && slide === 0) return (
        <div style={{...overallStyle,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
            <div style={{...bigTitle,fontSize:'1.5rem',animation:'pulse 1.5s infinite alternate'}}>⚡ CARGANDO GALA...</div>
        </div>
    );

    return (
        <div style={overallStyle}>
            <style>{`
                @keyframes slideIn { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
                @keyframes shimmer { 0%,100% { text-shadow: 0 0 20px rgba(255,215,0,0.3); } 50% { text-shadow: 0 0 40px rgba(255,215,0,0.8), 0 0 80px rgba(255,215,0,0.3); } }
                @keyframes floatUp { from { opacity:0; transform:translateY(30px) scale(.9); } to { opacity:1; transform:translateY(0) scale(1); } }
                @keyframes pulse { 0% { transform:scale(1); } 100% { transform:scale(1.05); } }
                .gala-reveal { animation: floatUp .5s ease both; }
            `}</style>

            {/* SLIDE 1: JORNADA FINAL */}
            <div style={slideStyle(1)}>
                {progressDots}
                <p style={subTitle}>Jornada Final del Playoff · 1 / 4</p>
                <p style={{...bigTitle,fontSize:'clamp(1.6rem,5vw,2.2rem)',marginBottom:'4px'}}>UDLP vs Málaga CF</p>
                <p style={{...bigTitle,fontSize:'clamp(.85rem,2.5vw,1rem)',color:'rgba(255,255,255,0.5)',letterSpacing:'3px'}}>VUELTA · PLAYOFF ASCENSO</p>
                <div style={divider}/>

                {/* Marcador */}
                <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'20px',margin:'20px 0'}}>
                    <div style={{textAlign:'center'}}>
                        <div style={{fontSize:'clamp(3rem,10vw,4.5rem)',fontFamily:"'Oswald',sans-serif",fontWeight:700,color:G.golden,background:'rgba(0,0,0,0.5)',border:`2px solid ${G.goldenDark}`,borderRadius:'16px',width:'80px',height:'80px',display:'flex',alignItems:'center',justifyContent:'center',textShadow:`0 0 20px rgba(255,215,0,0.5)`}}>
                            {data?.ultimaJ?.resultadoLocal ?? '?'}
                        </div>
                        <p style={{fontSize:'11px',color:'rgba(255,255,255,0.5)',marginTop:'8px',letterSpacing:'1px'}}>UDLP</p>
                    </div>
                    <div style={{fontFamily:"'Oswald',sans-serif",fontSize:'1.8rem',color:'rgba(255,255,255,0.3)'}}>—</div>
                    <div style={{textAlign:'center'}}>
                        <div style={{fontSize:'clamp(3rem,10vw,4.5rem)',fontFamily:"'Oswald',sans-serif",fontWeight:700,color:G.silver,background:'rgba(0,0,0,0.5)',border:`2px solid rgba(192,192,192,0.3)`,borderRadius:'16px',width:'80px',height:'80px',display:'flex',alignItems:'center',justifyContent:'center'}}>
                            {data?.ultimaJ?.resultadoVisitante ?? '?'}
                        </div>
                        <p style={{fontSize:'11px',color:'rgba(255,255,255,0.5)',marginTop:'8px',letterSpacing:'1px'}}>MÁL</p>
                    </div>
                </div>

                <div style={{...card,textAlign:'left'}}>
                    {[
                        ['⚽ Goleador UDLP', data?.ultimaJ?.goleador || 'Sin Goleador', G.golden],
                        ['💰 Total en juego', data ? `${data.totalBote.toFixed(2)}€` : '—', G.golden],
                        ['🏆 Premio por ganador', data?.ganadores?.length > 0 ? `${data.premioPorGanador}€` : 'Sin ganadores', G.success],
                    ].map(([label, val, col]) => (
                        <div key={label} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:`1px solid rgba(255,255,255,0.06)`}}>
                            <span style={{fontSize:'12px',color:'rgba(255,255,255,0.5)'}}>{label}</span>
                            <span style={{fontFamily:"'Oswald',sans-serif",fontSize:'1.05rem',color:col,fontWeight:700}}>{val}</span>
                        </div>
                    ))}
                    <div style={{paddingTop:'14px'}}>
                        <p style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',letterSpacing:'1px',textTransform:'uppercase',marginBottom:'8px'}}>Ganadores del exacto</p>
                        <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>
                            {data?.ganadores?.length > 0 ? data.ganadores.map(g=>winnerPill(g)) : <span style={{color:'rgba(255,255,255,0.4)',fontSize:'13px',fontStyle:'italic'}}>Nadie acertó el exacto</span>}
                        </div>
                    </div>
                </div>
                <button style={btn} onClick={goNext}>El Camino →</button>
                <button style={{...btnSecondary,marginTop:'12px',fontSize:'0.75rem'}} onClick={onClose}>Saltar presentación</button>
            </div>

            {/* SLIDE 2: EL CAMINO */}
            <div style={slideStyle(2)}>
                {progressDots}
                <p style={subTitle}>El Camino al Ascenso · 2 / 4</p>
                <div style={{fontSize:'3rem',marginBottom:'8px',animation:'shimmer 2s infinite'}}>🏆</div>
                <p style={bigTitle}>El Camino</p>
                <div style={divider}/>
                <div style={{display:'flex',gap:'10px',width:'100%',margin:'16px 0'}}>
                    {['UD Almería','Málaga CF'].map(eq=>(
                        <div key={eq} style={{flex:1,padding:'14px 8px',background:esMalaga(eq)?'rgba(212,175,55,0.12)':'rgba(0,0,0,0.4)',border:`1px solid ${esMalaga(eq)?G.goldenDark:'rgba(255,255,255,0.1)'}`,borderRadius:'12px',fontSize:'13px',fontWeight:700,color:esMalaga(eq)?G.golden:G.silver,textAlign:'center',boxShadow:esMalaga(eq)?`0 0 20px rgba(212,175,55,0.15)`:''}}>{eq}</div>
                    ))}
                </div>
                <div style={{padding:'20px',background:`linear-gradient(135deg,rgba(212,175,55,0.1),rgba(0,0,0,0.4))`,border:`1px solid ${G.goldenDark}`,borderRadius:'16px',width:'100%',marginBottom:'20px'}}>
                    <p style={{fontFamily:"'Oswald',sans-serif",fontSize:'clamp(1.5rem,5vw,2rem)',color:G.success,letterSpacing:'2px',textShadow:`0 0 20px rgba(16,185,129,0.5)`}}>
                        🎉 Asciende: {data?.playoff?.ascendido || 'Málaga CF'}
                    </p>
                </div>
                <p style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',letterSpacing:'2px',textTransform:'uppercase',marginBottom:'10px'}}>+5 puntos para</p>
                <div style={{display:'flex',flexWrap:'wrap',justifyContent:'center',gap:'6px',marginBottom:'8px'}}>
                    {data?.caminoGanadores?.length > 0 ? data.caminoGanadores.map(n=>playerChip(n,G.golden,'+5')) : <span style={{color:'rgba(255,255,255,0.4)',fontSize:'13px'}}>Nadie acertó</span>}
                </div>
                <div style={{display:'flex',gap:'10px',marginTop:'20px',justifyContent:'center',width:'100%',maxWidth:'300px'}}>
                    <button style={btnSecondary} onClick={goPrev}>← Atrás</button>
                    <button style={{...btn,maxWidth:'none',flex:1}} onClick={goNext}>Porra Anual →</button>
                </div>
            </div>

            {/* SLIDE 3: PORRA ANUAL */}
            <div style={slideStyle(3)}>
                {progressDots}
                <p style={subTitle}>Porra Anual · 3 / 4</p>
                <div style={{fontSize:'3rem',marginBottom:'8px'}}>📅</div>
                <p style={bigTitle}>Porra Anual</p>
                <div style={divider}/>
                <div style={{...card,textAlign:'left'}}>
                    {[['📍 Posición final UDLP','5ª',G.golden],['⬆️ ¿Ascendió?','No',colors.danger]].map(([l,v,c])=>(
                        <div key={l} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:`1px solid rgba(255,255,255,0.06)`}}>
                            <span style={{fontSize:'12px',color:'rgba(255,255,255,0.5)'}}>{l}</span>
                            <span style={{fontFamily:"'Oswald',sans-serif",fontSize:'1.1rem',color:c,fontWeight:700}}>{v}</span>
                        </div>
                    ))}
                </div>
                {data?.g20?.length > 0 && (
                    <div style={{width:'100%',marginBottom:'12px'}}>
                        <p style={{fontFamily:"'Oswald',sans-serif",fontSize:'0.75rem',letterSpacing:'3px',color:'rgba(255,215,0,0.6)',textTransform:'uppercase',marginBottom:'8px'}}>Pleno — +20 puntos</p>
                        <div style={{display:'flex',flexWrap:'wrap',justifyContent:'center'}}>{data.g20.map(n=>playerChip(n,G.golden,'+20'))}</div>
                    </div>
                )}
                {data?.g10?.length > 0 && (
                    <div style={{width:'100%',marginBottom:'12px'}}>
                        <p style={{fontFamily:"'Oswald',sans-serif",fontSize:'0.75rem',letterSpacing:'3px',color:'rgba(192,192,192,0.6)',textTransform:'uppercase',marginBottom:'8px'}}>Posición exacta — +10 puntos</p>
                        <div style={{display:'flex',flexWrap:'wrap',justifyContent:'center'}}>{data.g10.map(n=>playerChip(n,G.silver,'+10'))}</div>
                    </div>
                )}
                {data?.g5?.length > 0 && (
                    <div style={{width:'100%',marginBottom:'12px'}}>
                        <p style={{fontFamily:"'Oswald',sans-serif",fontSize:'0.75rem',letterSpacing:'3px',color:'rgba(205,127,50,0.7)',textTransform:'uppercase',marginBottom:'8px'}}>Ascenso — +5 puntos</p>
                        <div style={{display:'flex',flexWrap:'wrap',justifyContent:'center'}}>{data.g5.map(n=>playerChip(n,'#CD7F32','+5'))}</div>
                    </div>
                )}
                {!data?.g5?.length && !data?.g10?.length && !data?.g20?.length && (
                    <p style={{color:'rgba(255,255,255,0.4)',fontSize:'13px',fontStyle:'italic'}}>Nadie acertó posición ni ascenso</p>
                )}
                <div style={{display:'flex',gap:'10px',marginTop:'20px',justifyContent:'center',width:'100%',maxWidth:'300px'}}>
                    <button style={btnSecondary} onClick={goPrev}>← Atrás</button>
                    <button style={{...btn,maxWidth:'none',flex:1}} onClick={()=>{ setSlide(4); setClasifRevealed(0); setShowPodium(false); }}>Clasificación →</button>
                </div>
            </div>

            {/* SLIDE 4: CLASIFICACIÓN */}
            <div style={slideStyle(4)}>
                {progressDots}
                <p style={subTitle}>Clasificación Final · 4 / 4</p>
                <p style={bigTitle}>Clasificación</p>
                <p style={{fontFamily:"'Oswald',sans-serif",fontSize:'1rem',color:'rgba(255,255,255,0.4)',letterSpacing:'3px',marginBottom:'4px'}}>FIN DE TEMPORADA</p>
                <div style={divider}/>

                {/* Lista: empieza en orden alfabético, cada toque coloca al siguiente desde el último */}
                {(() => {
                    if(!data?.clasif) return null;
                    const total = data.clasif.length;
                    const maxPts = data.clasif[0]?.puntosTotales || 1;

                    // Orden alfabético inicial (todos los jugadores mezclados)
                    const alfaOrder = [...data.clasif].sort((a,b)=>a.id.localeCompare(b.id));

                    // Los revelados son los últimos `clasifRevealed` de la clasificación real (peores primero)
                    // revealedIds = set de ids ya revelados con su posición real
                    const revealedMap = {}; // id → posición real (1=primero)
                    for(let i = 0; i < clasifRevealed && i < total; i++) {
                        const posReal = total - i; // empieza por el último
                        revealedMap[data.clasif[posReal - 1].id] = posReal;
                    }

                    // Los revelados se muestran en orden de posición real (peor arriba, mejor abajo)
                    // Los no revelados se muestran en orden alfabético debajo de los revelados
                    // En realidad mostramos la lista de posiciones ya asignadas arriba,
                    // y los pendientes en espera abajo
                    const revealed = data.clasif
                        .map((j,i)=>({...j, posReal: i+1}))
                        .filter(j=>revealedMap[j.id] !== undefined)
                        .sort((a,b)=>b.posReal-a.posReal); // peor posición arriba

                    const pending = alfaOrder.filter(j=>revealedMap[j.id] === undefined);

                    const renderRevealed = (j) => {
                        const pos = j.posReal;
                        const pct = Math.round(((j.puntosTotales||0)/maxPts)*100);
                        const isTop = pos<=3;
                        const posLabel = pos===1?'🥇':pos===2?'🥈':pos===3?'🥉':`${pos}º`;
                        const nameColor = pos===1?G.golden:pos===2?G.silver:pos===3?'#CD7F32':'rgba(255,255,255,0.85)';
                        const barColor = pos===1?G.goldenDark:pos===2?G.silver:pos===3?'#CD7F32':'rgba(255,215,0,0.45)';
                        return (
                            <div key={j.id} className="gala-reveal" style={{
                                display:'flex',alignItems:'center',gap:'10px',
                                padding:`${isTop?'13px':'9px'} 10px`,
                                marginBottom:'5px',borderRadius:'12px',
                                background: pos===1?'rgba(212,175,55,0.13)':pos===2?'rgba(192,192,192,0.07)':pos===3?'rgba(205,127,50,0.07)':'rgba(0,0,0,0.3)',
                                border:`1px solid ${isTop?barColor+'55':'rgba(255,255,255,0.05)'}`,
                                boxShadow: isTop ? `0 0 16px ${barColor}22` : 'none',
                            }}>
                                <div style={{fontFamily:"'Oswald',sans-serif",fontSize:isTop?'1.35rem':'1rem',minWidth:'38px',textAlign:'center',color:nameColor,fontWeight:700}}>{posLabel}</div>
                                <div style={{flex:1,textAlign:'left'}}>
                                    <div style={{fontSize:isTop?'15px':'12px',fontWeight:700,color:nameColor,letterSpacing:'0.5px'}}>
                                        {userProfiles[j.id]?.icon || '⭐'} {j.id}
                                    </div>
                                    <div style={{height:'4px',background:'rgba(255,255,255,0.07)',borderRadius:'2px',marginTop:'5px',overflow:'hidden'}}>
                                        <div style={{height:'100%',width:`${pct}%`,background:barColor,borderRadius:'2px',transition:'width .9s ease .1s'}}/>
                                    </div>
                                </div>
                                <div style={{fontFamily:"'Oswald',sans-serif",fontSize:isTop?'1.35rem':'1rem',fontWeight:700,color:nameColor,minWidth:'42px',textAlign:'right'}}>{j.puntosTotales||0} <span style={{fontSize:'10px',color:`${nameColor}88`}}>pts</span></div>
                            </div>
                        );
                    };

                    const renderPending = (j) => (
                        <div key={j.id} style={{
                            display:'flex',alignItems:'center',gap:'10px',
                            padding:'9px 10px',marginBottom:'5px',borderRadius:'12px',
                            background:'rgba(255,255,255,0.03)',
                            border:'1px solid rgba(255,255,255,0.07)',
                            opacity:0.5,
                        }}>
                            <div style={{fontFamily:"'Oswald',sans-serif",fontSize:'1rem',minWidth:'38px',textAlign:'center',color:'rgba(255,255,255,0.25)'}}>—</div>
                            <div style={{flex:1,textAlign:'left',fontSize:'12px',fontWeight:600,color:'rgba(255,255,255,0.4)',letterSpacing:'0.5px'}}>
                                {userProfiles[j.id]?.icon || '⭐'} {j.id}
                            </div>
                            <div style={{fontFamily:"'Oswald',sans-serif",fontSize:'1rem',fontWeight:700,color:'rgba(255,255,255,0.2)',minWidth:'42px',textAlign:'right'}}>?</div>
                        </div>
                    );

                    return (
                        <div style={{width:'100%',marginBottom:'8px'}}>
                            {revealed.map(renderRevealed)}
                            {revealed.length > 0 && pending.length > 0 && (
                                <div style={{borderTop:'1px dashed rgba(255,255,255,0.08)',margin:'8px 0 8px'}}/>
                            )}
                            {pending.map(renderPending)}
                        </div>
                    );
                })()}

                {!showPodium && (
                    <button style={btn} onClick={revealNext}>
                        {clasifRevealed === 0
                            ? '▶ Revelar clasificación'
                            : clasifRevealed >= (data?.clasif?.length||99)
                                ? '🎉 Ver podio final'
                                : `▶ Siguiente — ${(data?.clasif?.length||0) - clasifRevealed} restantes`}
                    </button>
                )}
                {showPodium && (
                    <div style={{width:'100%',padding:'22px',background:`linear-gradient(135deg,rgba(212,175,55,0.15),rgba(0,0,0,0.5))`,border:`1px solid ${G.goldenDark}`,borderRadius:'16px',marginTop:'8px',animation:'slideIn .5s ease',textAlign:'center'}}>
                        <p style={{fontFamily:"'Oswald',sans-serif",fontSize:'1.8rem',color:G.golden,letterSpacing:'2px',marginBottom:'6px',textShadow:`0 0 25px rgba(255,215,0,0.6)`}}>🎉 FIN DE TEMPORADA</p>
                        <p style={{fontSize:'12px',color:'rgba(255,255,255,0.5)',marginBottom:'18px',lineHeight:1.6}}>Los tres primeros se llevan el premio.<br/>¡Enhorabuena a toda la peña!</p>
                        <button style={btn} onClick={onClose}>Entrar a la app →</button>
                    </div>
                )}
                <button style={{...btnSecondary,marginTop:'12px',fontSize:'0.75rem'}} onClick={goPrev}>← Atrás</button>
            </div>
        </div>
    );
};

// ============================================================================
// --- COMPONENTE PRINCIPAL APP ---
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
    const [showGala, setShowGala] = useState(false);

    useEffect(() => {
        document.title = "🏆 PLAYOFF 2026";
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
        }
        link.href = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">⭐</text></svg>';

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
            // Mostrar gala de fin de temporada si no la ha visto ya
            const galaKey = 'galaFinTemporada2026_' + user;
            if (!localStorage.getItem(galaKey)) { setShowGala(true); }
        } catch (error) { alert("Error al iniciar sesión."); }
    };

    const handleLogout = async () => { if (currentUser) set(ref(rtdb, 'status/' + currentUser), false); setCurrentUser(null); setScreen('login'); };

    if (APP_EN_CONSTRUCCION) return <ModoConstruccion />;
    if (screen === 'splash') return <EpicSplashScreen />;
    if (screen === 'login') return <div style={styles.container}><div style={styles.card}><div style={{textAlign: 'center'}}><h2 style={styles.title}>ACCESO PLAYOFF</h2><div style={styles.userList}>{JUGADORES.map(j => <button key={j} onClick={() => handleLogin(j)} style={styles.userButton}><div style={{position: 'relative'}}><div style={styles.loginProfileIconCircle}>{userProfiles[j]?.icon || '❓'}</div>{onlineUsers[j] && <div style={{position: 'absolute', bottom: '0', right: '-5px', width: '14px', height: '14px', backgroundColor: styles.colors.success, borderRadius: '50%', border: `2px solid ${styles.colors.deepBlue}`, boxShadow: `0 0 8px ${styles.colors.success}`}}></div>}</div> {j}</button>)}</div></div></div></div>;

    const renderContent = () => {
        switch (activeTab) {
            case 'miJornada': return <MiJornadaScreen user={currentUser} teamLogos={teamLogos} plantilla={plantilla} userProfiles={userProfiles} onlineUsers={onlineUsers} />;
            case 'elCamino': return <ElCaminoScreen user={currentUser} userProfiles={userProfiles} onlineUsers={onlineUsers} />;
            case 'laJornada': return <LaJornadaScreen userProfiles={userProfiles} onlineUsers={onlineUsers} teamLogos={teamLogos} />;
            case 'clasificacion': return <ClasificacionScreen currentUser={currentUser} userProfiles={userProfiles} onlineUsers={onlineUsers} />;
            case 'ligaRegular': return <LigaRegularScreen userProfiles={userProfiles} onlineUsers={onlineUsers} />;
            case 'estadisticas': return <EstadisticasScreen userProfiles={userProfiles} onlineUsers={onlineUsers} />;
            case 'pagos': return <PagosScreen />;
            case 'calendario': return <CalendarioScreen teamLogos={teamLogos} />;
            case 'porraAnual': return <PorraAnualScreen userProfiles={userProfiles} onlineUsers={onlineUsers} />;
            case 'admin': return currentUser === 'Juanma' ? <AdminPanelScreen plantilla={plantilla} /> : null;
            default: return null;
        }
    };

    return (
        <>
            {showGala && currentUser && (
                <GalaFinTemporada 
                    currentUser={currentUser}
                    userProfiles={userProfiles}
                    onClose={() => {
                        setShowGala(false);
                        localStorage.setItem('galaFinTemporada2026_' + currentUser, '1');
                    }}
                />
            )}
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
                        <button onClick={() => setActiveTab('porraAnual')} style={activeTab === 'porraAnual' ? styles.navButtonActive : styles.navButton}>📅 Porra Anual</button>
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
