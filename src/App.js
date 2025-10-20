import React, { useState, useEffect, useMemo } from 'react';
// Importamos las funciones necesarias de Firebase
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, collection, doc, getDocs, onSnapshot, query, writeBatch, updateDoc, orderBy, setDoc, getDoc, increment, serverTimestamp, addDoc } from "firebase/firestore";
import { getDatabase, ref, onValue, onDisconnect, set } from "firebase/database";

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

// --- DATOS DE LA APLICACIÓN ---
const JUGADORES = ["Juanma", "Lucy", "Antonio", "Mari", "Pedro", "Pedrito", "Himar", "Sarito", "Vicky", "Carmelo", "Laura", "Carlos", "José", "Claudio", "Javi"];
const APUESTA_NORMAL = 1;
const APUESTA_VIP = 2;
const EQUIPOS_LIGA = [
    "UD Las Palmas", "FC Andorra", "Córdoba CF", "Málaga CF", "Burgos CF",
    "Real Sociedad B", "CD Leganes", "UD Almería", "Cádiz CF", "Granada CF",
    "SD Eibar", "SD Huesca", "Real Sporting de Gijón", "Real Racing Club",
    "Real Valladolid CF", "Albacete Balompié", "CD Castellón", "CD Mirandés",
    "AD Ceuta FC", "CyD Leonesa", "Real Zaragoza", "RC Deportivo"
];

const PLANTILLA_UDLP = [
    "Álvaro Valles", "Aarón Escandell", "Sergi Cardona", "Mika Mármol", "Eric Curbelo",
    "Álex Suárez", "Julián Araujo", "Daley Sinkgraven", "Saúl Coco", "Enzo Loiodice",
    "Máximo Perrone", "Kirian Rodríguez", "Jonathan Viera", "Alberto Moleiro",
    "Javier Muñoz", "Benito Ramírez", "Pejiño", "Cristian Herrera", "Marc Cardona",
    "Munir El Haddadi", "Sandro Ramírez", "Sory Kaba", "Marvin Park"
];

const PROFILE_COLORS = ['#FFC72C', '#0055A4', '#FFFFFF', '#fca311', '#52b788', '#e63946', '#9b59b6', 'linear-gradient(45deg, #FFC72C, #0055A4)', 'linear-gradient(45deg, #e63946, #fca311)', 'linear-gradient(45deg, #52b788, #9b59b6)'];
const PROFILE_ICONS = ['🐥', '🇮🇨', '⚽️', '🥅', '🏆', '🥇', '🎉', '🔥', '💪', '😎', '🎯', '🧠', '⭐', '🐐', '👑'];

// ============================================================================
// --- ESTILOS (CSS-in-JS) ---
// Se mantiene una estructura de estilos simplificada.
// ============================================================================
const colors = {
    deepBlue: '#001d3d', blue: '#0055A4', yellow: '#FFC72C', gold: '#FFD700',
    lightText: '#f0f0f0', darkText: '#0a0a0a', danger: '#e63946', success: '#52b788',
    warning: '#fca311', darkUI: 'rgba(10, 25, 47, 0.85)', darkUIAlt: 'rgba(23, 42, 69, 0.85)',
    status: {
        'Próximamente': '#6c757d', 'Pre-apertura': '#fca311', 'Abierta': '#52b788',
        'Cerrada': '#e63946', 'En vivo': '#dc3545', 'Finalizada': '#0055A4',
        'Puntos Aplicados': '#9b59b6' // Nuevo estado
    }
};

const styles = {
    colors,
    container: { display: 'flex', justifyContent: 'center', alignItems: 'flex-start', width: '100%', minHeight: '100dvh', background: `linear-gradient(145deg, ${colors.deepBlue} 0%, #000 100%)`, padding: '15px', fontFamily: "'Exo 2', sans-serif" },
    card: { width: '100%', maxWidth: '900px', backgroundColor: colors.darkUI, color: colors.lightText, padding: '25px', borderRadius: '16px', boxShadow: `0 0 25px ${colors.blue}30`, minHeight: 'calc(100dvh - 30px)', border: `1px solid ${colors.blue}80`, backdropFilter: 'blur(10px)' },
    title: { fontFamily: "'Orbitron', sans-serif", color: colors.yellow, textTransform: 'uppercase', textAlign: 'center', borderBottom: `2px solid ${colors.yellow}`, paddingBottom: '10px', marginBottom: '25px', fontSize: 'clamp(1.5rem, 5vw, 1.8rem)' },
    mainButton: { fontFamily: "'Orbitron', sans-serif", padding: '10px 25px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', border: `2px solid ${colors.yellow}`, borderRadius: '8px', backgroundColor: colors.yellow, color: colors.darkText, marginTop: '20px', textTransform: 'uppercase' },
    secondaryButton: { fontFamily: "'Exo 2', sans-serif", padding: '8px 15px', fontSize: '0.9rem', cursor: 'pointer', border: `1px solid ${colors.blue}`, borderRadius: '8px', backgroundColor: 'transparent', color: colors.lightText, textTransform: 'uppercase' },
    placeholder: { padding: '40px 20px', backgroundColor: 'rgba(0,0,0,0.2)', border: `2px dashed ${colors.blue}`, borderRadius: '12px', textAlign: 'center', color: colors.lightText },
    loginContainer: { textAlign: 'center' },
    userList: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '15px', marginTop: '30px' },
    userButton: { position: 'relative', width: '100%', padding: '15px 10px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', border: `2px solid ${colors.blue}`, borderRadius: '8px', backgroundColor: 'transparent', color: colors.lightText', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' },
    loginProfileIconCircle: { width: '40px', height: '40px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.5rem', color: colors.darkText },
    navbar: { display: 'flex', flexWrap: 'wrap', gap: '5px', borderBottom: `2px solid ${colors.blue}`, paddingBottom: '15px', marginBottom: '20px', alignItems: 'center' },
    navButton: { padding: '8px 12px', fontSize: '0.9rem', border: 'none', borderBottom: '3px solid transparent', borderRadius: '6px 6px 0 0', backgroundColor: 'transparent', color: colors.lightText, cursor: 'pointer', textTransform: 'uppercase', fontWeight: '600' },
    navButtonActive: { padding: '8px 12px', fontSize: '0.9rem', border: 'none', borderBottom: `3px solid ${colors.yellow}`, borderRadius: '6px 6px 0 0', backgroundColor: colors.darkUIAlt, color: colors.yellow, cursor: 'pointer', textTransform: 'uppercase', fontWeight: '600' },
    profileNavButton: { marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' },
    logoutButton: { padding: '8px 12px', fontSize: '0.9rem', border: `1px solid ${colors.danger}`, borderRadius: '8px', backgroundColor: 'transparent', color: colors.danger, cursor: 'pointer', marginLeft: '10px', fontWeight: '600', textTransform: 'uppercase' },
    content: { padding: '10px 0' },
    form: { backgroundColor: 'rgba(0,0,0,0.2)', padding: '25px', borderRadius: '12px', marginTop: '20px', border: `1px solid ${colors.blue}50` },
    formSectionTitle: { fontFamily: "'Orbitron', sans-serif", color: colors.lightText, fontSize: '1.3rem', textAlign: 'center', marginBottom: '20px' },
    formGroup: { marginBottom: '25px' },
    label: { display: 'block', marginBottom: '10px', color: colors.yellow, fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.9rem' },
    input: { width: 'calc(100% - 24px)', padding: '12px', border: `1px solid ${colors.blue}`, borderRadius: '6px', backgroundColor: colors.deepBlue, color: colors.lightText, fontSize: '1rem' },
    resultInputContainer: { display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' },
    resultInput: { width: '50px', textAlign: 'center', padding: '10px', border: `1px solid ${colors.blue}`, borderRadius: '6px', backgroundColor: colors.deepBlue, color: colors.lightText, fontSize: '1.3rem', fontFamily: "'Orbitron', sans-serif" },
    separator: { fontSize: '1.3rem', fontWeight: 'bold', color: colors.yellow },
    checkbox: { width: '20px', height: '20px', accentColor: colors.yellow },
    message: { marginTop: '20px', padding: '12px', borderRadius: '8px', backgroundColor: colors.darkUIAlt, color: colors.lightText, textAlign: 'center', fontWeight: 'bold' },
    table: { width: '100%', marginTop: '20px', borderCollapse: 'separate', borderSpacing: '0 5px', color: colors.lightText },
    th: { backgroundColor: 'transparent', color: colors.yellow, padding: '12px', borderBottom: `2px solid ${colors.yellow}`, textAlign: 'left', textTransform: 'uppercase', fontFamily: "'Orbitron', sans-serif", fontSize: '0.8rem' },
    tr: { backgroundColor: colors.darkUIAlt },
    td: { padding: '12px', border: 'none', borderBottom: `1px solid ${colors.deepBlue}`, fontSize: '0.9rem' },
    tdRank: { fontFamily: "'Orbitron', sans-serif", fontWeight: 'bold', fontSize: '1rem', textAlign: 'center' },
    tdTotalPoints: { fontFamily: "'Orbitron', sans-serif", fontWeight: 'bold', fontSize: '1.2rem', textAlign: 'center', color: colors.yellow },
    currentUserRow: { backgroundColor: `${colors.blue}50`, boxShadow: `0 0 10px ${colors.blue}` },
    laJornadaContainer: { textAlign: 'center', padding: '20px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '12px' },
    matchInfo: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', fontSize: '1.5rem', fontWeight: 'bold', margin: '20px 0', fontFamily: "'Orbitron', sans-serif' },
    matchDetails: { display: 'flex', justifyContent: 'center', gap: '20px', color: '#ccc', marginBottom: '20px' },
    countdownContainer: { margin: '20px 0' },
    countdown: { fontFamily: "'Orbitron', sans-serif", fontSize: 'clamp(1.3rem, 5vw, 1.8rem)', fontWeight: 'bold', color: colors.yellow, backgroundColor: colors.deepBlue, padding: '8px 15px', borderRadius: '8px', display: 'inline-block' },
    apostadoresContainer: { marginTop: '30px', borderTop: `1px solid ${colors.blue}`, paddingTop: '20px' },
    apostadoresGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '8px', marginTop: '10px' },
    apostadorHecho: { padding: '8px', fontSize: '0.9rem', backgroundColor: colors.success, color: colors.darkText, borderRadius: '5px', textAlign: 'center', fontWeight: 'bold' },
    apostadorPendiente: { padding: '8px', fontSize: '0.9rem', backgroundColor: colors.darkUIAlt, color: colors.lightText, borderRadius: '5px', textAlign: 'center', opacity: 0.6 },
    jornadaList: { display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' },
    jornadaItem: { cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', borderLeft: `5px solid ${colors.blue}`, borderRadius: '8px', backgroundColor: colors.darkUIAlt },
    statusBadge: { color: 'white', padding: '5px 12px', borderRadius: '15px', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase' },
    adminJornadaItem: { padding: '20px', backgroundColor: 'rgba(0,0,0,0.2)', border: `1px solid ${colors.blue}`, borderRadius: '12px', marginBottom: '20px' },
    adminControls: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', margin: '15px 0' },
    adminInput: { width: '90%', padding: '10px', border: `1px solid ${colors.blue}`, borderRadius: '6px', backgroundColor: colors.deepBlue, color: colors.lightText },
    adminSelect: { width: '95%', padding: '10px', border: `1px solid ${colors.blue}`, borderRadius: '6px', backgroundColor: colors.deepBlue, color: colors.lightText },
    saveButton: { padding: '10px 18px', border: 'none', borderRadius: '5px', backgroundColor: colors.success, color: 'white', cursor: 'pointer', textTransform: 'uppercase', fontWeight: 'bold' },
    backButton: { padding: '10px 15px', fontSize: '1rem', border: `1px solid ${colors.blue}`, borderRadius: '8px', backgroundColor: 'transparent', color: colors.lightText, cursor: 'pointer', marginBottom: '20px' },
    finalResult: { fontSize: '2rem', fontWeight: 'bold', color: colors.yellow, textAlign: 'center', margin: '20px 0', fontFamily: "'Orbitron', sans-serif'" },
    winnerBanner: { background: `linear-gradient(45deg, ${colors.gold}, ${colors.yellow})`, color: colors.darkText, fontWeight: 'bold', padding: '15px', borderRadius: '8px', textAlign: 'center', margin: '20px 0', fontSize: '1.2rem' },
    boteBanner: { backgroundColor: colors.danger, color: 'white', fontWeight: 'bold', padding: '15px', borderRadius: '8px', textAlign: 'center', margin: '20px 0', fontSize: '1.2rem' },
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(5px)' },
    modalContent: { backgroundColor: colors.darkUI, padding: '30px', borderRadius: '12px', width: '90%', maxWidth: '700px', border: `1px solid ${colors.yellow}` },
    resumenContainer: { display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' },
    resumenJugador: { backgroundColor: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '12px', borderLeft: `4px solid ${colors.blue}` },
    resumenJugadorTitle: { margin: '0 0 10px 0', paddingBottom: '10px', borderBottom: `1px solid ${colors.blue}80`, fontFamily: "'Orbitron', sans-serif'" },
    liveBanner: { position: 'sticky', top: 0, left: 0, width: '100%', backgroundColor: colors.danger, color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', padding: '10px', zIndex: 100, fontFamily: "'Orbitron', sans-serif'" },
    liveAdminContainer: { marginTop: '25px', paddingTop: '20px', borderTop: `2px dashed ${colors.danger}` },
    liveAdminTitle: { color: colors.danger, textAlign: 'center', fontFamily: "'Orbitron', sans-serif'" },
    provisionalTitle: { color: colors.yellow, textAlign: 'center', fontFamily: "'Orbitron', sans-serif'", marginTop: '30px' },
    liveInfoBox: { display: 'flex', justifyContent: 'space-around', backgroundColor: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '12px', marginBottom: '20px', border: `1px solid ${colors.blue}` },
    liveInfoItem: { textAlign: 'center' },
    liveInfoLabel: { display: 'block', fontSize: '0.9rem', color: colors.silver, textTransform: 'uppercase' },
    liveInfoValue: { display: 'block', fontSize: '1.8rem', color: colors.yellow, fontWeight: 'bold', fontFamily: "'Orbitron', sans-serif'" },
    porraAnualContainer: { marginTop: '30px', padding: '20px', borderTop: `2px solid ${colors.yellow}`, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '8px' },
    colorGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(50px, 1fr))', gap: '15px', marginTop: '10px' },
    colorOption: { width: '50px', height: '50px', borderRadius: '50%', cursor: 'pointer', border: '2px solid transparent' },
    iconGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(50px, 1fr))', gap: '15px', marginTop: '10px' },
    iconOption: { width: '50px', height: '50px', borderRadius: '10px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '2rem', backgroundColor: 'rgba(0,0,0,0.2)' },
};

// ============================================================================
// --- LÓGICA DE CÁLCULO Y FORMATO ---
// ============================================================================

const formatFullDateTime = (firebaseDate) => {
    if (!firebaseDate || typeof firebaseDate.seconds !== 'number') return 'Fecha por confirmar';
    try {
        const date = new Date(firebaseDate.seconds * 1000);
        return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
    } catch (error) {
        console.error("Error formatting date:", error);
        return 'Fecha inválida';
    }
};

const calculateProvisionalPoints = (pronostico, liveData, jornada) => {
    if (!pronostico || !liveData || !jornada || jornada.estado !== 'En vivo') return 0;
    let puntosJornada = 0;
    const esVip = jornada.esVip || false;
    const { golesLocal, golesVisitante, primerGoleador } = liveData;

    // Acierto Resultado Exacto
    if (parseInt(pronostico.golesLocal) === golesLocal && parseInt(pronostico.golesVisitante) === golesVisitante) {
        puntosJornada += esVip ? 6 : 3;
    }

    // Acierto 1X2
    let resultado1x2Real = '';
    if (jornada.equipoLocal === "UD Las Palmas") {
        if (golesLocal > golesVisitante) resultado1x2Real = '1';
        else if (golesLocal < golesVisitante) resultado1x2Real = '2';
        else resultado1x2Real = 'X';
    } else {
        if (golesVisitante > golesLocal) resultado1x2Real = '1';
        else if (golesVisitante < golesLocal) resultado1x2Real = '2';
        else resultado1x2Real = 'X';
    }
    if (pronostico.resultado1x2 === resultado1x2Real) {
        puntosJornada += esVip ? 2 : 1;
    }

    // Acierto Goleador
    const goleadorReal = (primerGoleador || '').trim().toLowerCase();
    const goleadorApostado = (pronostico.goleador || '').trim().toLowerCase();
    if (pronostico.sinGoleador && (goleadorReal === "" || goleadorReal === "sin gol")) {
        puntosJornada += 1;
    } else if (!pronostico.sinGoleador && goleadorApostado !== "" && goleadorApostado === goleadorReal) {
        puntosJornada += esVip ? 4 : 2;
    }

    return puntosJornada;
};


// ============================================================================
// --- COMPONENTES REUTILIZABLES ---
// ============================================================================

const PlayerProfileDisplay = ({ name, profile, style: customStyle = {} }) => {
    const finalProfile = profile || {};
    const color = finalProfile.color || colors.lightText;
    const icon = finalProfile.icon || '';
    const isGradient = typeof color === 'string' && color.startsWith('linear-gradient');
    const nameStyle = { ...(isGradient ? { background: color, WebkitBackgroundClip: 'text', color: 'transparent' } : { color: color }) };

    return (
        <span style={{ ...customStyle, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            {icon && <span>{icon}</span>}
            <span style={nameStyle}>{name}</span>
        </span>
    );
};

const LiveBanner = ({ liveData, jornada }) => {
    if (!jornada || !liveData || jornada.estado !== 'En vivo') return null;
    return (
        <div style={styles.liveBanner}>
            <span>🔴 EN VIVO</span>
            <span>{jornada.equipoLocal} <strong>{liveData.golesLocal} - {liveData.golesVisitante}</strong> {jornada.equipoVisitante}</span>
            {liveData.primerGoleador && <span>1er Gol: {liveData.primerGoleador}</span>}
        </div>
    );
};

const LoadingSkeleton = ({ type = 'list' }) => {
    // Componente simplificado para mostrar carga
    return <div style={styles.placeholder}>Cargando...</div>;
};

// ============================================================================
// --- COMPONENTES DE LAS PANTALLAS ---
// ============================================================================

const SplashScreen = ({ onEnter }) => {
    const [jornadaInfo, setJornadaInfo] = useState(null);
    const [countdown, setCountdown] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const qJornadas = query(collection(db, "jornadas"), orderBy("numeroJornada"));
        const unsubscribe = onSnapshot(qJornadas, (snap) => {
            const todas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const activa = todas.find(j => ['En vivo', 'Abierta', 'Pre-apertura'].includes(j.estado)) ||
                todas.find(j => j.estado === 'Cerrada') ||
                todas.filter(j => j.estado === 'Finalizada').sort((a, b) => b.numeroJornada - a.numeroJornada)[0] ||
                todas.find(j => j.estado === 'Próximamente');
            setJornadaInfo(activa);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!jornadaInfo) return;
        const targetDate = (jornadaInfo.estado === 'Abierta') ? jornadaInfo.fechaCierre?.toDate() :
            (jornadaInfo.estado === 'Pre-apertura' ? jornadaInfo.fechaApertura?.toDate() : null);

        if (!targetDate) { setCountdown(''); return; }

        const interval = setInterval(() => {
            const diff = targetDate - new Date();
            if (diff <= 0) {
                setCountdown(jornadaInfo.estado === 'Abierta' ? "¡APUESTAS CERRADAS!" : "¡APUESTAS ABIERTAS!");
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
        if (loading) return <LoadingSkeleton />;
        if (!jornadaInfo) return <div style={styles.placeholder}>Temporada en pausa.</div>;

        return (
            <div style={styles.laJornadaContainer}>
                <h3>{jornadaInfo.estado === 'Finalizada' ? 'Última Jornada' : 'Próxima Jornada'}</h3>
                <div style={styles.matchInfo}>
                    <span>{jornadaInfo.equipoLocal}</span>
                    <span style={{ color: colors.yellow }}>vs</span>
                    <span>{jornadaInfo.equipoVisitante}</span>
                </div>
                <p>{formatFullDateTime(jornadaInfo.fechaPartido)}</p>
                {jornadaInfo.bote > 0 && <p style={{ color: colors.success, fontWeight: 'bold' }}>¡BOTE DE {jornadaInfo.bote}€!</p>}
                {countdown && (
                    <div style={styles.countdownContainer}>
                        <p>{jornadaInfo.estado === 'Abierta' ? 'Cierre de apuestas en:' : 'Apertura en:'}</p>
                        <div style={styles.countdown}>{countdown}</div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div style={{ textAlign: 'center' }}>
            <img src="https://upload.wikimedia.org/wikipedia/en/thumb/2/20/UD_Las_Palmas_logo.svg/1200px-UD_Las_Palmas_logo.svg.png" alt="UD Las Palmas Logo" style={{ width: '120px', marginBottom: '20px' }} />
            <h1 style={{ ...styles.title, border: 'none' }}>PORRA UDLP</h1>
            {renderJornadaInfo()}
            <button onClick={onEnter} style={styles.mainButton}>ENTRAR</button>
        </div>
    );
};

const LoginScreen = ({ onLogin, userProfiles }) => {

    const handleSelectUser = (jugador) => {
        onLogin(jugador);
    };

    return (
        <div style={styles.loginContainer}>
            <h2 style={styles.title}>SELECCIONA TU PERFIL</h2>
            <div style={styles.userList}>
                {JUGADORES.map(jugador => {
                    const profile = userProfiles[jugador] || {};
                    const isGradient = typeof profile.color === 'string' && profile.color.startsWith('linear-gradient');
                    const circleStyle = { ...styles.loginProfileIconCircle, ...(isGradient ? { background: profile.color } : { backgroundColor: profile.color || colors.blue }) };

                    return (
                        <button key={jugador} onClick={() => handleSelectUser(jugador)} style={styles.userButton}>
                            <div style={circleStyle}>{profile.icon || '?'}</div>
                            <span>{jugador}</span>
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
    sinGoleador: false
};

const MiJornadaScreen = ({ user, userProfiles }) => {
    const [currentJornada, setCurrentJornada] = useState(null);
    const [loading, setLoading] = useState(true);
    const [pronostico, setPronostico] = useState(initialPronosticoState);
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState({ text: '', type: 'info' });
    const [provisionalData, setProvisionalData] = useState({ puntos: 0, posicion: '-' });
    const userProfile = userProfiles[user] || {};

    useEffect(() => {
        setLoading(true);
        const qJornadas = query(collection(db, "jornadas"), orderBy("numeroJornada"));
        const unsubscribe = onSnapshot(qJornadas, (snap) => {
            const todas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const jornadaActiva = todas.find(j => ['En vivo', 'Abierta', 'Pre-apertura', 'Cerrada'].includes(j.estado)) ||
                todas.filter(j => j.estado === 'Finalizada' || j.estado === 'Puntos Aplicados').sort((a, b) => b.numeroJornada - a.numeroJornada)[0];

            if (jornadaActiva) {
                setCurrentJornada(jornadaActiva);
                const pronosticoRef = doc(db, "pronosticos", jornadaActiva.id, "jugadores", user);
                getDoc(pronosticoRef).then(pronosticoSnap => {
                    if (pronosticoSnap.exists()) {
                        setPronostico({ ...initialPronosticoState, ...pronosticoSnap.data() });
                        setHasSubmitted(true);
                    } else {
                        setPronostico(initialPronosticoState);
                        setHasSubmitted(false);
                    }
                    setLoading(false);
                });
            } else {
                setCurrentJornada(null);
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, [user]);

    const handlePronosticoChange = (e) => {
        const { name, value, type, checked } = e.target;
        setPronostico(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleGuardarPronostico = async (e) => {
        e.preventDefault();
        if (!currentJornada) return;
        if (pronostico.golesLocal === '' || pronostico.golesVisitante === '' || pronostico.resultado1x2 === '' || (!pronostico.goleador && !pronostico.sinGoleador)) {
            setMessage({ text: 'Debes rellenar todos los campos.', type: 'error' });
            return;
        }
        setIsSaving(true);
        const pronosticoRef = doc(db, "pronosticos", currentJornada.id, "jugadores", user);
        try {
            await setDoc(pronosticoRef, { ...pronostico, lastUpdated: serverTimestamp() });
            setMessage({ text: '¡Pronóstico guardado!', type: 'success' });
            setHasSubmitted(true);
        } catch (error) {
            console.error("Error al guardar: ", error);
            setMessage({ text: 'Error al guardar.', type: 'error' });
        }
        setIsSaving(false);
    };

    if (loading) return <LoadingSkeleton />;

    const renderContent = () => {
        if (!currentJornada || !['Abierta', 'Pre-apertura'].includes(currentJornada.estado)) {
             return (
                 <div style={styles.placeholder}>
                     <h3>{currentJornada ? `Jornada ${currentJornada.estado}` : 'No hay jornada activa'}</h3>
                     {hasSubmitted && currentJornada && (
                         <div>
                             <h4>Tu Apuesta Enviada:</h4>
                             <p>Resultado: {pronostico.golesLocal}-{pronostico.golesVisitante}</p>
                             <p>1X2: {pronostico.resultado1x2 === '1' ? 'Gana UDLP' : pronostico.resultado1x2 === 'X' ? 'Empate' : 'Pierde UDLP'}</p>
                             <p>Goleador: {pronostico.sinGoleador ? 'Sin Goleador' : pronostico.goleador}</p>
                         </div>
                     )}
                 </div>
             );
        }

        const isVip = currentJornada.esVip;
        return (
            <form onSubmit={handleGuardarPronostico} style={styles.form}>
                <h3 style={styles.formSectionTitle}>{`Jornada ${currentJornada.numeroJornada}: ${currentJornada.equipoLocal} vs ${currentJornada.equipoVisitante}`}</h3>
                {hasSubmitted && <p style={{textAlign: 'center', color: colors.success, marginBottom: '15px'}}>Ya has enviado tu pronóstico. Puedes modificarlo hasta la hora de cierre.</p>}

                <div style={styles.formGroup}>
                    <label style={styles.label}>Resultado Exacto ({isVip ? 6 : 3} Pts)</label>
                    <div style={styles.resultInputContainer}>
                        <input type="tel" name="golesLocal" value={pronostico.golesLocal} onChange={handlePronosticoChange} style={styles.resultInput} />
                        <span style={styles.separator}>-</span>
                        <input type="tel" name="golesVisitante" value={pronostico.golesVisitante} onChange={handlePronosticoChange} style={styles.resultInput} />
                    </div>
                </div>

                <div style={styles.formGroup}>
                    <label style={styles.label}>Resultado 1X2 ({isVip ? 2 : 1} Pts)</label>
                    <select name="resultado1x2" value={pronostico.resultado1x2} onChange={handlePronosticoChange} style={styles.input}>
                        <option value="">-- Elige --</option>
                        <option value="1">Gana UD Las Palmas</option>
                        <option value="X">Empate</option>
                        <option value="2">Pierde UD Las Palmas</option>
                    </select>
                </div>

                <div style={styles.formGroup}>
                    <label style={styles.label}>Primer Goleador UDLP ({isVip ? 4 : 2} Pts)</label>
                    <select name="goleador" value={pronostico.goleador} onChange={handlePronosticoChange} style={styles.input} disabled={pronostico.sinGoleador}>
                        <option value="">-- Elige un jugador --</option>
                        {PLANTILLA_UDLP.sort().map(jugador => (<option key={jugador} value={jugador}>{jugador}</option>))}
                    </select>
                    <div style={{ marginTop: '10px' }}>
                        <input type="checkbox" name="sinGoleador" id="sinGoleador" checked={pronostico.sinGoleador} onChange={handlePronosticoChange} style={styles.checkbox} />
                        <label htmlFor="sinGoleador" style={{ marginLeft: '8px' }}>Sin Goleador (1 Pto)</label>
                    </div>
                </div>

                <button type="submit" disabled={isSaving} style={styles.mainButton}>{isSaving ? 'GUARDANDO...' : 'GUARDAR PRONÓSTICO'}</button>
                {message.text && <p style={{ ...styles.message, backgroundColor: message.type === 'success' ? colors.success : colors.danger }}>{message.text}</p>}
            </form>
        );
    };

    return (
        <div>
            <h2 style={styles.title}>MI JORNADA</h2>
            <p style={{ color: colors.lightText, textAlign: 'center', fontSize: '1.1rem' }}>
                Bienvenido, <PlayerProfileDisplay name={user} profile={userProfile} style={{ fontWeight: 'bold' }} />
            </p>
            {currentJornada?.estado === 'En vivo' && (
                <div style={styles.liveInfoBox}>
                    <div style={styles.liveInfoItem}><span style={styles.liveInfoLabel}>Puntos Provisionales</span><span style={styles.liveInfoValue}>{provisionalData.puntos}</span></div>
                    <div style={styles.liveInfoItem}><span style={styles.liveInfoLabel}>Posición Provisional</span><span style={styles.liveInfoValue}>{provisionalData.posicion}</span></div>
                </div>
            )}
            {renderContent()}
        </div>
    );
};


const LaJornadaScreen = ({ user, liveData, userProfiles }) => {
    const [jornada, setJornada] = useState(null);
    const [pronosticos, setPronosticos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [provisionalWinners, setProvisionalWinners] = useState([]);

    useEffect(() => {
        const qJornadas = query(collection(db, "jornadas"), orderBy("numeroJornada"));
        const unsubscribe = onSnapshot(qJornadas, (snap) => {
            const todas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const jornadaActiva = todas.find(j => ['En vivo', 'Abierta', 'Pre-apertura', 'Cerrada'].includes(j.estado)) ||
                                 todas.filter(j => ['Finalizada', 'Puntos Aplicados'].includes(j.estado)).sort((a,b) => b.numeroJornada - a.numeroJornada)[0];

            if (jornadaActiva) {
                setJornada(jornadaActiva);
                const pronosticosRef = collection(db, "pronosticos", jornadaActiva.id, "jugadores");
                onSnapshot(pronosticosRef, (snapshot) => {
                    setPronosticos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                    setLoading(false);
                });
            } else {
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (jornada?.estado === 'En vivo' && liveData && pronosticos.length > 0) {
            const ranking = pronosticos.map(p => ({
                id: p.id,
                puntos: calculateProvisionalPoints(p, liveData, jornada)
            })).sort((a, b) => b.puntos - a.puntos);

            if (ranking.length > 0 && ranking[0].puntos > 0) {
                const maxPuntos = ranking[0].puntos;
                setProvisionalWinners(ranking.filter(p => p.puntos === maxPuntos).map(p => p.id));
            } else {
                setProvisionalWinners([]);
            }
        }
    }, [liveData, jornada, pronosticos]);

    if (loading) return <LoadingSkeleton />;
    if (!jornada) return <div style={styles.placeholder}>No hay jornada activa para mostrar.</div>;

    const showPronosticos = ['Cerrada', 'En vivo', 'Finalizada', 'Puntos Aplicados'].includes(jornada.estado);

    return (
        <div>
            <h2 style={styles.title}>LA JORNADA</h2>
            <div style={styles.laJornadaContainer}>
                 <h3>{`Jornada ${jornada.numeroJornada}: ${jornada.equipoLocal} vs ${jornada.equipoVisitante}`}</h3>
                 <p>{formatFullDateTime(jornada.fechaPartido)}</p>
                 {jornada.estado === 'Finalizada' && (
                     <p style={styles.finalResult}>{jornada.resultadoLocal} - {jornada.resultadoVisitante}</p>
                 )}
                 {jornada.ganadores && jornada.ganadores.length > 0 && (
                     <div style={styles.winnerBanner}>🏆 Ganador(es): {jornada.ganadores.join(', ')}</div>
                 )}
                 {jornada.ganadores && jornada.ganadores.length === 0 && (
                     <div style={styles.boteBanner}>💰 ¡BOTE! Nadie acertó.</div>
                 )}
                 {jornada.estado === 'En vivo' && (
                     provisionalWinners.length > 0
                        ? <div style={{...styles.winnerBanner, backgroundColor: colors.warning}}>👑 Ganador(es) Provisional(es): {provisionalWinners.join(', ')}</div>
                        : <div style={{...styles.boteBanner, backgroundColor: colors.warning}}>Nadie gana de momento.</div>
                 )}
            </div>

            <div style={styles.resumenContainer}>
                {JUGADORES.map(jugador => {
                    const pronostico = pronosticos.find(p => p.id === jugador);
                    return (
                        <div key={jugador} style={styles.resumenJugador}>
                            <h4 style={styles.resumenJugadorTitle}>
                                <PlayerProfileDisplay name={jugador} profile={userProfiles[jugador]} />
                            </h4>
                            {pronostico ? (
                                showPronosticos ? (
                                    <div>
                                        <p><strong>Resultado:</strong> {pronostico.golesLocal}-{pronostico.golesVisitante}</p>
                                        <p><strong>1X2:</strong> {pronostico.resultado1x2 === '1' ? 'Gana UDLP' : pronostico.resultado1x2 === 'X' ? 'Empate' : 'Pierde UDLP'}</p>
                                        <p><strong>Goleador:</strong> {pronostico.sinGoleador ? 'Sin Goleador' : pronostico.goleador}</p>
                                        {jornada.estado === 'Finalizada' && <p><strong>Puntos: {pronostico.puntosObtenidos || 0}</strong></p>}
                                    </div>
                                ) : <p><i>Pronóstico oculto hasta el cierre.</i></p>
                            ) : <p><i>Sin pronóstico.</i></p>}
                        </div>
                    )
                })}
            </div>
        </div>
    );
};
const ClasificacionScreen = ({ currentUser, userProfiles, liveData, liveJornada }) => {
    const [clasificacion, setClasificacion] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, "clasificacion"), orderBy("puntosTotales", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Si hay una jornada en vivo, calcula los puntos provisionales
            if (liveJornada?.estado === 'En vivo' && liveData) {
                const pronosticosPromise = getDocs(collection(db, "pronosticos", liveJornada.id, "jugadores"));
                pronosticosPromise.then(pronosticosSnap => {
                    const pronosticos = {};
                    pronosticosSnap.forEach(doc => {
                        pronosticos[doc.id] = doc.data();
                    });

                    data = data.map(jugador => {
                        const pronostico = pronosticos[jugador.id];
                        const puntosProvisionales = pronostico ? calculateProvisionalPoints(pronostico, liveData, liveJornada) : 0;
                        return {
                            ...jugador,
                            puntosTotales: (jugador.puntosTotales || 0) + puntosProvisionales
                        };
                    });
                    setClasificacion(data.sort((a, b) => b.puntosTotales - a.puntosTotales));
                    setLoading(false);
                });
            } else {
                setClasificacion(data);
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, [liveData, liveJornada]);


    if (loading) return <LoadingSkeleton />;

    return (
        <div>
            <h2 style={styles.title}>CLASIFICACIÓN GENERAL</h2>
            {liveJornada?.estado === 'En vivo' && <p style={{textAlign: 'center', color: colors.warning, marginBottom: '15px'}}>La clasificación se actualiza en tiempo real con los resultados del partido.</p>}
            <table style={styles.table}>
                <thead>
                    <tr>
                        <th style={styles.th}>#</th>
                        <th style={styles.th}>Jugador</th>
                        <th style={styles.th} style={{ textAlign: 'center' }}>Puntos</th>
                    </tr>
                </thead>
                <tbody>
                    {clasificacion.map((jugador, index) => (
                        <tr key={jugador.id} style={jugador.id === currentUser ? styles.currentUserRow : styles.tr}>
                            <td style={styles.tdRank}>{index + 1}</td>
                            <td style={styles.td}>
                                <PlayerProfileDisplay name={jugador.id} profile={userProfiles[jugador.id]} />
                            </td>
                            <td style={styles.tdTotalPoints}>{jugador.puntosTotales || 0}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const CalendarioScreen = ({ onViewJornada }) => {
    const [jornadas, setJornadas] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, "jornadas"), orderBy("numeroJornada", "asc"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            setJornadas(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    if (loading) return <LoadingSkeleton />;

    return (
        <div>
            <h2 style={styles.title}>CALENDARIO</h2>
            <div style={styles.jornadaList}>
                {jornadas.map(jornada => (
                    <div key={jornada.id} onClick={() => onViewJornada(jornada.id)} style={{ ...styles.jornadaItem, borderLeftColor: styles.colors.status[jornada.estado] || colors.blue }}>
                        <div>
                            <p><strong>Jornada {jornada.numeroJornada}</strong></p>
                            <p>{jornada.equipoLocal} vs {jornada.equipoVisitante}</p>
                            <p style={{ fontSize: '0.8rem', color: '#ccc' }}>{formatFullDateTime(jornada.fechaPartido)}</p>
                        </div>
                        <span style={{ ...styles.statusBadge, backgroundColor: styles.colors.status[jornada.estado] || colors.blue }}>
                            {jornada.estado}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const JornadaDetalleScreen = ({ jornadaId, onBack, userProfiles }) => {
    const [jornada, setJornada] = useState(null);
    const [pronosticos, setPronosticos] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const jornadaRef = doc(db, "jornadas", jornadaId);
        const unsubJornada = onSnapshot(jornadaRef, (docSnap) => {
            if (docSnap.exists()) setJornada({ id: docSnap.id, ...docSnap.data() });
        });
        const pronosticosRef = collection(db, "pronosticos", jornadaId, "jugadores");
        const unsubPronosticos = onSnapshot(pronosticosRef, (snapshot) => {
            setPronosticos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });
        return () => { unsubJornada(); unsubPronosticos(); };
    }, [jornadaId]);

    if (loading) return <LoadingSkeleton />;
    if (!jornada) return <div style={styles.placeholder}>Jornada no encontrada.</div>;

    const showPronosticos = ['Cerrada', 'En vivo', 'Finalizada', 'Puntos Aplicados'].includes(jornada.estado);

    return (
        <div>
            <button onClick={onBack} style={styles.backButton}>&larr; Volver al Calendario</button>
            <h2 style={styles.title}>DETALLE JORNADA {jornada.numeroJornada}</h2>
            <div style={styles.laJornadaContainer}>
                <h3>{jornada.equipoLocal} vs {jornada.equipoVisitante}</h3>
                {['Finalizada', 'Puntos Aplicados'].includes(jornada.estado) && (
                    <p style={styles.finalResult}>{jornada.resultadoLocal} - {jornada.resultadoVisitante}</p>
                )}
                {jornada.ganadores?.length > 0 && <div style={styles.winnerBanner}>🏆 Ganador(es): {jornada.ganadores.join(', ')}</div>}
                {jornada.ganadores?.length === 0 && jornada.estado === 'Finalizada' && <div style={styles.boteBanner}>💰 ¡BOTE!</div>}
            </div>

            <table style={styles.table}>
                <thead>
                    <tr>
                        <th style={styles.th}>Jugador</th>
                        <th style={styles.th}>Pronóstico</th>
                        {['Finalizada', 'Puntos Aplicados'].includes(jornada.estado) && <th style={styles.th}>Puntos</th>}
                    </tr>
                </thead>
                <tbody>
                    {JUGADORES.map((jugadorId) => {
                        const p = pronosticos.find(pr => pr.id === jugadorId);
                        return (
                            <tr key={jugadorId}>
                                <td style={styles.td}><PlayerProfileDisplay name={jugadorId} profile={userProfiles[jugadorId]} /></td>
                                {p ? (
                                    showPronosticos ? (
                                        <>
                                            <td style={styles.td}>{`${p.golesLocal}-${p.golesVisitante} (${p.resultado1x2}) - ${p.sinGoleador ? 'SG' : p.goleador}`}</td>
                                            {['Finalizada', 'Puntos Aplicados'].includes(jornada.estado) && <td style={styles.td}>{p.puntosObtenidos ?? '-'}</td>}
                                        </>
                                    ) : <td style={styles.td} colSpan={2}><i>Pronóstico Oculto</i></td>
                                ) : <td style={styles.td} colSpan={2}><i>Sin Pronóstico</i></td>}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

const PorraAnualScreen = ({ user, onBack }) => {
    const [config, setConfig] = useState(null);
    const [pronostico, setPronostico] = useState({ ascenso: '', posicion: '' });
    const [miPronostico, setMiPronostico] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const configRef = doc(db, "configuracion", "porraAnual");
        const unsubConfig = onSnapshot(configRef, (doc) => setConfig(doc.exists() ? doc.data() : null));

        const pronosticoRef = doc(db, "porraAnualPronosticos", user);
        const unsubPronostico = onSnapshot(pronosticoRef, (doc) => {
            if (doc.exists()) setMiPronostico(doc.data());
            setLoading(false);
        });

        return () => { unsubConfig(); unsubPronostico(); };
    }, [user]);

    if (loading) return <LoadingSkeleton />;
    if (!config || config.estado !== 'Abierta') {
        return (
            <div>
                 <button onClick={onBack} style={styles.backButton}>&larr; Volver</button>
                 <h2 style={styles.title}>PORRA ANUAL</h2>
                 <div style={styles.placeholder}>
                    <p>La porra anual no está disponible en este momento.</p>
                    {miPronostico && (
                        <div style={{marginTop: '20px'}}>
                            <h4>Tu Apuesta Guardada:</h4>
                            <p>¿Asciende?: <strong>{miPronostico.ascenso}</strong></p>
                            <p>Posición Final: <strong>{miPronostico.posicion}º</strong></p>
                        </div>
                    )}
                 </div>
            </div>
        )
    }

    // Formulario para apostar (simplificado, sin lógica de guardado para brevedad)
    return (
        <div>
            <button onClick={onBack} style={styles.backButton}>&larr; Volver</button>
            <h2 style={styles.title}>PORRA ANUAL</h2>
            <div style={styles.porraAnualContainer}>
                <p style={{textAlign: 'center'}}>Haz tu pronóstico para el final de la temporada.</p>
                {/* Aquí iría el formulario para la porra anual */}
                <div style={styles.placeholder}>Formulario de Porra Anual Deshabilitado en esta versión.</div>
            </div>
        </div>
    );
}

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
        }
    };

    return (
        <div style={styles.modalOverlay}>
            <div style={styles.modalContent}>
                <h3 style={styles.title}>ACCESO ADMIN</h3>
                <form onSubmit={handleSubmit}>
                    <div style={styles.formGroup}><label style={styles.label}>Email:</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={styles.input} required /></div>
                    <div style={styles.formGroup}><label style={styles.label}>Contraseña:</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={styles.input} required /></div>
                    {error && <p style={{ color: colors.danger, textAlign: 'center' }}>{error}</p>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                        <button type="button" onClick={onClose} style={{ ...styles.mainButton, backgroundColor: 'transparent', color: colors.lightText }}>CANCELAR</button>
                        <button type="submit" style={styles.mainButton}>ENTRAR</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const AdminPanelScreen = () => {
    const [jornadas, setJornadas] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, "jornadas"), orderBy("numeroJornada", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setJornadas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    if (loading) return <LoadingSkeleton />;

    return (
        <div>
            <h2 style={styles.title}>PANEL DE ADMINISTRADOR</h2>
            <div>{jornadas.map(j => <JornadaAdminItem key={j.id} jornada={j} />)}</div>
        </div>
    );
};

const JornadaAdminItem = ({ jornada }) => {
    const [estado, setEstado] = useState(jornada.estado);
    const [resultadoLocal, setResultadoLocal] = useState(jornada.resultadoLocal ?? '');
    const [resultadoVisitante, setResultadoVisitante] = useState(jornada.resultadoVisitante ?? '');
    const [goleador, setGoleador] = useState(jornada.goleador || '');
    const [liveData, setLiveData] = useState(jornada.liveData || { golesLocal: 0, golesVisitante: 0, primerGoleador: '' });
    const [message, setMessage] = useState('');

    const handleSaveChanges = async () => {
        const jornadaRef = doc(db, "jornadas", jornada.id);
        await updateDoc(jornadaRef, { estado });
        setMessage('Estado actualizado.');
        setTimeout(() => setMessage(''), 2000);
    };

    const handleUpdateLive = async () => {
        const jornadaRef = doc(db, "jornadas", jornada.id);
        await updateDoc(jornadaRef, { liveData });
        setMessage('Datos en vivo actualizados.');
        setTimeout(() => setMessage(''), 2000);
    };
    
    // Nueva función para el estado "Puntos Aplicados"
    const handleAplicarPuntos = async () => {
        if (resultadoLocal === '' || resultadoVisitante === '' || goleador === '') {
            alert("Completa el resultado final y el goleador para aplicar puntos.");
            return;
        }

        const batch = writeBatch(db);
        const pronosticosRef = collection(db, "pronosticos", jornada.id, "jugadores");
        const pronosticosSnap = await getDocs(pronosticosRef);

        let ganadores = [];
        let maxPuntos = -1;

        pronosticosSnap.forEach(pronosticoDoc => {
            const p = pronosticoDoc.data();
            // Lógica de cálculo de puntos simplificada
            let puntosJornada = 0;
            const esVipJornada = jornada.esVip || false;

            if (parseInt(p.golesLocal) === parseInt(resultadoLocal) && parseInt(p.golesVisitante) === parseInt(resultadoVisitante)) puntosJornada += esVipJornada ? 6 : 3;
            if (p.resultado1x2 === (resultadoLocal > resultadoVisitante ? '1' : resultadoLocal < resultadoVisitante ? '2' : 'X')) puntosJornada += esVipJornada ? 2 : 1;
            if ((p.sinGoleador && goleador.toLowerCase() === 'sin gol') || p.goleador.toLowerCase() === goleador.toLowerCase()) puntosJornada += esVipJornada ? (p.sinGoleador ? 1 : 4) : (p.sinGoleador ? 1 : 2);
            
            if (puntosJornada > maxPuntos) {
                maxPuntos = puntosJornada;
                ganadores = [pronosticoDoc.id];
            } else if (puntosJornada === maxPuntos) {
                ganadores.push(pronosticoDoc.id);
            }
            
            batch.update(pronosticoDoc.ref, { puntosObtenidos: puntosJornada });
            batch.update(doc(db, "clasificacion", pronosticoDoc.id), { puntosTotales: increment(puntosJornada) });
        });
        
        const jornadaRef = doc(db, "jornadas", jornada.id);
        batch.update(jornadaRef, {
            estado: 'Finalizada',
            resultadoLocal,
            resultadoVisitante,
            goleador,
            ganadores: maxPuntos > 0 ? ganadores : [],
            "liveData.isLive": false
        });

        await batch.commit();
        setMessage('Puntos aplicados y jornada finalizada.');
    };

    return (
        <div style={styles.adminJornadaItem}>
            <p><strong>Jornada {jornada.numeroJornada}:</strong> {jornada.equipoLocal} vs {jornada.equipoVisitante}</p>
            <div style={styles.adminControls}>
                <select value={estado} onChange={(e) => setEstado(e.target.value)} style={styles.adminSelect}>
                    <option>Próximamente</option><option>Pre-apertura</option><option>Abierta</option>
                    <option>Cerrada</option><option>En vivo</option><option>Puntos Aplicados</option><option>Finalizada</option>
                </select>
                <button onClick={handleSaveChanges} style={styles.saveButton}>Guardar Estado</button>
            </div>

            {estado === 'En vivo' && (
                <div style={styles.liveAdminContainer}>
                     <h4 style={styles.liveAdminTitle}>Control En Vivo</h4>
                     <input type="number" value={liveData.golesLocal} onChange={e => setLiveData({...liveData, golesLocal: parseInt(e.target.value)})} placeholder="Goles Local" style={styles.adminInput} />
                     <input type="number" value={liveData.golesVisitante} onChange={e => setLiveData({...liveData, golesVisitante: parseInt(e.target.value)})} placeholder="Goles Visitante" style={styles.adminInput} />
                     <input type="text" value={liveData.primerGoleador} onChange={e => setLiveData({...liveData, primerGoleador: e.target.value})} placeholder="Primer Goleador" style={styles.adminInput} />
                     <button onClick={handleUpdateLive} style={styles.saveButton}>Actualizar En Vivo</button>
                </div>
            )}
            
            {estado === 'Puntos Aplicados' && (
                 <div style={{...styles.liveAdminContainer, borderTop: `2px dashed ${colors.success}`}}>
                     <h4 style={{...styles.liveAdminTitle, color: colors.success}}>Aplicar Puntos Finales</h4>
                     <input type="number" value={resultadoLocal} onChange={e => setResultadoLocal(e.target.value)} placeholder="Resultado Local Final" style={styles.adminInput} />
                     <input type="number" value={resultadoVisitante} onChange={e => setResultadoVisitante(e.target.value)} placeholder="Resultado Visitante Final" style={styles.adminInput} />
                     <input type="text" value={goleador} onChange={e => setGoleador(e.target.value)} placeholder="Primer Goleador Final" style={styles.adminInput} />
                     <button onClick={handleAplicarPuntos} style={{...styles.saveButton, backgroundColor: colors.success}}>Finalizar y Aplicar Puntos</button>
                </div>
            )}
            {message && <p style={{color: colors.success, marginTop: '10px'}}>{message}</p>}
        </div>
    );
};

const ProfileCustomizationScreen = ({ user, onSave, userProfile }) => {
    const [selectedColor, setSelectedColor] = useState(userProfile.color || PROFILE_COLORS[0]);
    const [selectedIcon, setSelectedIcon] = useState(userProfile.icon || PROFILE_ICONS[0]);

    const handleSave = () => onSave(user, { color: selectedColor, icon: selectedIcon });

    return (
        <div style={{textAlign: 'center'}}>
            <h2 style={styles.title}>PERSONALIZA TU PERFIL</h2>
            <div style={styles.formGroup}>
                <label style={styles.label}>Elige tu Color</label>
                <div style={styles.colorGrid}>
                    {PROFILE_COLORS.map(color => (
                        <div key={color} onClick={() => setSelectedColor(color)}
                             style={{...styles.colorOption, background: color, border: selectedColor === color ? '3px solid white' : '3px solid transparent' }}/>
                    ))}
                </div>
            </div>
            <div style={styles.formGroup}>
                <label style={styles.label}>Elige tu Icono</label>
                 <div style={styles.iconGrid}>
                    {PROFILE_ICONS.map(icon => (
                        <div key={icon} onClick={() => setSelectedIcon(icon)}
                             style={{...styles.iconOption, background: selectedIcon === icon ? colors.blue : 'rgba(0,0,0,0.2)'}}>
                            {icon}
                        </div>
                    ))}
                </div>
            </div>
            <button onClick={handleSave} style={styles.mainButton}>GUARDAR Y ENTRAR</button>
        </div>
    );
};

const ProfileScreen = ({ user, userProfile, onEdit, onBack }) => (
    <div>
        <button onClick={onBack} style={styles.backButton}>&larr; Volver</button>
        <h2 style={styles.title}><PlayerProfileDisplay name={user} profile={userProfile} style={{ fontSize: '2rem' }} /></h2>
        <div style={styles.placeholder}>
            Aquí se mostrarán tus datos personales de la porra.
        </div>
        <button onClick={onEdit} style={{ ...styles.mainButton, width: '100%' }}>Editar Perfil</button>
    </div>
);

// ============================================================================
// --- COMPONENTE PRINCIPAL APP ---
// ============================================================================

function App() {
    const [screen, setScreen] = useState('splash');
    const [activeTab, setActiveTab] = useState('miJornada');
    const [currentUser, setCurrentUser] = useState(null);
    const [viewingJornadaId, setViewingJornadaId] = useState(null);
    const [showAdminLogin, setShowAdminLogin] = useState(false);
    const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
    const [userProfiles, setUserProfiles] = useState({});
    const [liveJornada, setLiveJornada] = useState(null);

    useEffect(() => {
        onAuthStateChanged(auth, (user) => {
            if (user && !user.isAnonymous) setIsAdminAuthenticated(true);
            else {
                setIsAdminAuthenticated(false);
                if (!auth.currentUser) signInAnonymously(auth);
            }
        });
        
        const styleSheet = document.createElement("style");
        styleSheet.innerText = `@import url('https://fonts.googleapis.com/css2?family=Orbitron&family=Exo+2&display=swap'); * { box-sizing: border-box; }`;
        document.head.appendChild(styleSheet);
        
        const unsubProfiles = onSnapshot(collection(db, "clasificacion"), (snap) => {
            const profiles = {};
            snap.forEach(doc => profiles[doc.id] = doc.data());
            setUserProfiles(profiles);
        });

        const qLive = query(collection(db, "jornadas"), where("estado", "==", "En vivo"));
        const unsubLive = onSnapshot(qLive, (snap) => {
            setLiveJornada(snap.empty ? null : {id: snap.docs[0].id, ...snap.docs[0].data()});
        });

        return () => { unsubProfiles(); unsubLive(); };
    }, []);

    const handleLogin = (user) => {
        setCurrentUser(user);
        set(ref(rtdb, 'status/' + user), true);
        onDisconnect(ref(rtdb, 'status/' + user)).set(false);
        updateDoc(doc(db, "clasificacion", user), { ultimaConexion: serverTimestamp() });

        if (userProfiles[user]?.icon && userProfiles[user]?.color) {
            setScreen('app');
        } else {
            setScreen('customizeProfile');
        }
    };

    const handleLogout = () => {
        if (currentUser) set(ref(rtdb, 'status/' + currentUser), false);
        if (isAdminAuthenticated) signOut(auth);
        setCurrentUser(null);
        setScreen('login');
    };

    const handleSaveProfile = async (user, profileData) => {
        await setDoc(doc(db, "clasificacion", user), profileData, { merge: true });
        setScreen('app');
    };
    
    const handleNavClick = (tab) => {
        setViewingJornadaId(null);
        setActiveTab(tab);
    };

    const renderContent = () => {
        if (screen === 'splash') return <SplashScreen onEnter={() => setScreen('login')} />;
        if (screen === 'login') return <LoginScreen onLogin={handleLogin} userProfiles={userProfiles} />;
        if (screen === 'customizeProfile') return <ProfileCustomizationScreen user={currentUser} onSave={handleSaveProfile} userProfile={userProfiles[currentUser] || {}} />;
        if (screen === 'app') {
            const CurrentScreen = () => {
                if (viewingJornadaId) return <JornadaDetalleScreen jornadaId={viewingJornadaId} onBack={() => setViewingJornadaId(null)} userProfiles={userProfiles} />;
                if (activeTab === 'porraAnual') return <PorraAnualScreen user={currentUser} onBack={() => setActiveTab('miJornada')} />;
                if (activeTab === 'profile') return <ProfileScreen user={currentUser} userProfile={userProfiles[currentUser]} onEdit={() => setScreen('customizeProfile')} onBack={() => setActiveTab('miJornada')} />;
                switch (activeTab) {
                    case 'miJornada': return <MiJornadaScreen user={currentUser} userProfiles={userProfiles} />;
                    case 'laJornada': return <LaJornadaScreen user={currentUser} liveData={liveJornada?.liveData} userProfiles={userProfiles} />;
                    case 'calendario': return <CalendarioScreen onViewJornada={setViewingJornadaId} />;
                    case 'clasificacion': return <ClasificacionScreen currentUser={currentUser} userProfiles={userProfiles} liveData={liveJornada?.liveData} liveJornada={liveJornada} />;
                    case 'admin': return isAdminAuthenticated ? <AdminPanelScreen /> : null;
                    default: return null;
                }
            };
            return (
                <>
                    {showAdminLogin && <AdminLoginModal onClose={() => setShowAdminLogin(false)} onSuccess={() => { setIsAdminAuthenticated(true); setShowAdminLogin(false); setActiveTab('admin');}} />}
                    <LiveBanner liveData={liveJornada?.liveData} jornada={liveJornada} />
                    <nav style={styles.navbar}>
                        <button onClick={() => handleNavClick('miJornada')} style={activeTab === 'miJornada' ? styles.navButtonActive : styles.navButton}>Mi Jornada</button>
                        <button onClick={() => handleNavClick('laJornada')} style={activeTab === 'laJornada' ? styles.navButtonActive : styles.navButton}>La Jornada</button>
                        <button onClick={() => handleNavClick('clasificacion')} style={activeTab === 'clasificacion' ? styles.navButtonActive : styles.navButton}>Clasificación</button>
                        <button onClick={() => handleNavClick('calendario')} style={activeTab === 'calendario' ? styles.navButtonActive : styles.navButton}>Calendario</button>
                        <button onClick={() => handleNavClick('porraAnual')} style={activeTab === 'porraAnual' ? styles.navButtonActive : styles.navButton}>Porra Anual</button>
                        {currentUser === 'Juanma' && <button onClick={() => isAdminAuthenticated ? setActiveTab('admin') : setShowAdminLogin(true)} style={activeTab === 'admin' ? styles.navButtonActive : styles.navButton}>Admin</button>}
                        <button onClick={() => handleNavClick('profile')} style={styles.profileNavButton}><PlayerProfileDisplay name={currentUser} profile={userProfiles[currentUser]} /></button>
                        <button onClick={handleLogout} style={styles.logoutButton}>Salir</button>
                    </nav>
                    <div style={styles.content}><CurrentScreen /></div>
                </>
            );
        }
    };
    return (<div style={styles.container}><div style={styles.card}>{renderContent()}</div></div>);
}

export default App;

