import React, { useState, useEffect, useMemo, useRef } from 'react';
// Importamos las funciones necesarias de Firebase
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, collection, doc, getDocs, onSnapshot, query, where, limit, writeBatch, updateDoc, orderBy, setDoc, getDoc, increment, deleteDoc, runTransaction } from "firebase/firestore";
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
const API_FOOTBALL_KEY = "8984843ec9df5109e0bc0ddb700f3848";


// --- DATOS DE LA APLICACIÓN ---
const JUGADORES = ["Juanma", "Lucy", "Antonio", "Mari", "Pedro", "Pedrito", "Himar", "Sarito", "Vicky", "Carmelo", "Laura", "Carlos", "José", "Claudio", "Javi"];
const APUESTA_NORMAL = 1;
const APUESTA_VIP = 2;
const SECRET_MESSAGES = [
    "Pronóstico Secreto 🤫", "Aquí huele a BOTE...", "Voy a ganar yo 😎", "Top Secret",
    "Clasificado ⭐", "Me lo guardo para mí", "Jugada Maestra en proceso...", "Ni el VAR lo sabe",
    "Consultando con el Oráculo", "Shhh... es un secreto", "Apuesta Fantasma 👻",
    "Resultado 'Confidencial'", "Cargando... 99%", "El que lo sabe, lo sabe", "Mejor no digo nada..."
];
const STAT_REACTION_EMOJIS = ['👍', '🔥', '🤯', '😂', '😥', '👏'];
const GOAL_REACTION_EMOJIS = ['🙌', '⚽', '🎉', '🤩', '🤯'];

const BADGE_DEFINITIONS = {
    lider_general: { name: 'Líder General', priority: 1, style: 'gold-leader' },
    campeon_jornada: { icon: '🏆', name: 'Campeón de la Jornada', priority: 2, style: 'gold-leader' },
    pleno_jornada: { icon: '🎯', name: 'Pleno en la Jornada', priority: 3 },
    en_racha: { icon: '🔥', name: 'En Racha (3+ jornadas puntuando)', priority: 4, style: 'fire-streak' },
    mala_racha: { icon: '🥶', name: 'Mala Racha (3+ jornadas sin puntuar)', priority: 5, style: 'cold-streak' },
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

const calculateProvisionalPoints = (pronostico, liveData, jornada) => {
    if (!pronostico || !liveData || !jornada || !liveData.isLive) return 0;
    let puntosJornada = 0;
    const esVip = jornada.esVip || false;
    const { golesLocal, golesVisitante } = liveData;

    const pronosticoLocalNum = parseInt(pronostico.golesLocal, 10);
    const pronosticoVisitanteNum = parseInt(pronostico.golesVisitante, 10);
    const aciertoExacto = !isNaN(pronosticoLocalNum) && !isNaN(pronosticoVisitanteNum) && pronosticoLocalNum === golesLocal && pronosticoVisitanteNum === golesVisitante;
    
    if (aciertoExacto) {
        puntosJornada += esVip ? 6 : 3;
    }

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

    const goleadorReal = (liveData.ultimoGoleador || '').trim().toLowerCase();
    const goleadorApostado = (pronostico.goleador || '').trim().toLowerCase();
    if (pronostico.sinGoleador && (goleadorReal === "sg" || goleadorReal === "")) {
        puntosJornada += 1;
    } else if (!pronostico.sinGoleador && goleadorApostado !== "" && goleadorApostado === goleadorReal) {
        puntosJornada += esVip ? 4 : 2;
    }

    if (pronostico.jokerActivo && pronostico.jokerPronosticos?.length > 0) {
        for (const jokerP of pronostico.jokerPronosticos) {
            const jokerLocalNum = parseInt(jokerP.golesLocal, 10);
            const jokerVisitanteNum = parseInt(jokerP.golesVisitante, 10);
            if (!isNaN(jokerLocalNum) && !isNaN(jokerVisitanteNum) && jokerLocalNum === golesLocal && jokerVisitanteNum === golesVisitante) {
                puntosJornada += esVip ? 6 : 3;
                break;
            }
        }
    }
    return puntosJornada;
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
            .filter(b => b.name && b.icon)
            .sort((a, b) => a.priority - b.priority);
    }, [finalProfile.badges]);

    return (
        <span style={{...customStyle, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            {badgesToDisplay.map(badge => (
                <span key={badge.key} title={badge.name}>{badge.icon}</span>
            ))}
            {icon && <span>{icon}</span>}
            <span style={nameStyle}>{name}</span>
        </span>
    );
};


const LiveBanner = ({ liveData, jornada }) => {
    if (!jornada || !liveData || !liveData.isLive) return null;
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
// --- COMPONENTES DE LAS PANTALLAS ---
// ============================================================================

const InitialSplashScreen = ({ onFinish }) => {
    const [fadingOut, setFadingOut] = useState(false);
    useEffect(() => { const timer = setTimeout(() => { setFadingOut(true); setTimeout(onFinish, 500); }, 2500); return () => clearTimeout(timer); }, [onFinish]);
    return (<div style={fadingOut ? {...styles.initialSplashContainer, ...styles.fadeOut} : styles.initialSplashContainer}><img src="https://upload.wikimedia.org/wikipedia/en/thumb/2/20/UD_Las_Palmas_logo.svg/1200px-UD_Las_Palmas_logo.svg.png" alt="UD Las Palmas Logo" style={styles.splashLogo} /><div style={styles.splashTitleContainer}><span style={styles.splashTitle}>PORRA UDLP</span><span style={styles.splashYear}>2026</span></div><div style={styles.loadingMessage}><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="spinner"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg><p>Cargando apuestas...</p></div></div>);
};

const SplashScreen = ({ onEnter, teamLogos, plantilla }) => {
    const [jornadaInfo, setJornadaInfo] = useState(null);
    const [countdown, setCountdown] = useState('');
    const [loading, setLoading] = useState(true);
    const [showInstallGuide, setShowInstallGuide] = useState(false);
    const [stats, setStats] = useState(null);
    const [currentStatIndex, setCurrentStatIndex] = useState(0);
    const isMobile = useMemo(() => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent), []);
    
    useEffect(() => {
        setLoading(true);
        const qJornadas = query(collection(db, "jornadas"), orderBy("numeroJornada"));
        const unsubscribe = onSnapshot(qJornadas, (snap) => {
            const ahora = new Date();
            const todasLasJornadas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            let jornadaActiva = todasLasJornadas.find(j => j.estado === 'Abierta' || j.estado === 'Pre-apertura' || (j.estado === 'Próximamente' && j.fechaApertura?.toDate() <= ahora && ahora < j.fechaCierre?.toDate()));

            if (jornadaActiva) {
                const type = jornadaActiva.estado === 'Pre-apertura' ? 'pre-apertura' : 'activa';
                setJornadaInfo({ ...jornadaActiva, type });

                if (type === 'activa') {
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
                            
                            setStats({
                                apostadoCount,
                                sinApostar,
                                goleadorMasVotado,
                                goleadorMasVotadoCount: goleadorMasVotado ? goleadorCounts[goleadorMasVotado] : 0,
                                resultadoMasVotado,
                                resultadoMasVotadoCount: resultadoMasVotado ? resultadoCounts[resultadoMasVotado] : 0,
                                jokersActivos,
                            });
                        } else {
                            setStats(null);
                        }
                    });
                } else {
                    setStats(null);
                }
            } else {
                setStats(null);
                let jornadaCerrada = todasLasJornadas.find(j => j.estado === 'Cerrada');
                if (jornadaCerrada) { setJornadaInfo({ ...jornadaCerrada, type: 'cerrada' }); }
                else {
                    const ultimasFinalizadas = todasLasJornadas.filter(j => j.estado === 'Finalizada').sort((a,b) => b.numeroJornada - a.numeroJornada);
                    if (ultimasFinalizadas.length > 0) { setJornadaInfo({ ...ultimasFinalizadas[0], type: 'finalizada' }); }
                    else {
                        const proximas = todasLasJornadas.filter(j => j.estado === 'Próximamente').sort((a,b) => a.numeroJornada - b.numeroJornada);
                        if (proximas.length > 0) setJornadaInfo({ ...proximas[0], type: 'proxima' });
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
        const targetDate = jornadaInfo.type === 'activa' ? jornadaInfo.fechaCierre?.toDate() : (jornadaInfo.type === 'proxima' || jornadaInfo.type === 'pre-apertura' ? jornadaInfo.fechaApertura?.toDate() : null);
        if (!targetDate) { setCountdown(''); return; }

        const interval = setInterval(() => {
            const diff = targetDate - new Date();
            if (diff <= 0) {
                let message = "¡PARTIDO EN JUEGO!";
                if (jornadaInfo.type === 'activa') message = "¡APUESTAS CERRADAS!";
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

    useEffect(() => {
        if (stats) {
            const timer = setInterval(() => {
                setCurrentStatIndex(prevIndex => (prevIndex + 1) % 4);
            }, 4000);
            return () => clearInterval(timer);
        }
    }, [stats]);

    const renderJornadaInfo = () => {
        if (!jornadaInfo) return (<div style={styles.splashInfoBox}><h3 style={styles.splashInfoTitle}>TEMPORADA EN PAUSA</h3><p>El administrador aún no ha configurado la próxima jornada.</p></div>);
        
        const fechaMostrada = jornadaInfo.fechaPartido || jornadaInfo.fechaCierre;
        let infoContent;

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
        <div key="goleador" style={styles.statCard}><img src={plantilla.find(j => j.nombre === stats.goleadorMasVotado)?.imageUrl || 'https://placehold.co/60x60/1b263b/e0e1dd?text=?'} alt={stats.goleadorMasVotado} style={styles.splashStatImage} onError={(e) => { e.target.src = 'https://placehold.co/60x60/1b263b/e0e1dd?text=?'; }} /><div style={styles.statValue}>{stats.goleadorMasVotado || '-'}</div><div style={styles.statLabel}>Goleador más elegido</div><div style={styles.splashStatDescription}>{stats.goleadorMasVotadoCount} voto(s)</div></div>,
        <div key="resultado" style={styles.statCard}><div style={styles.statValue}>{stats.resultadoMasVotado || '-'}</div><div style={styles.statLabel}>Resultado más común</div><div style={styles.splashStatDescription}>{stats.resultadoMasVotadoCount} vez/veces</div></div>,
        <div key="joker" style={styles.statCard}><div style={styles.statValue}>🃏 {stats.jokersActivos}</div><div style={styles.statLabel}>Jokers Activados</div><div style={styles.splashStatDescription}>¡Apuestas extra en juego!</div></div>
    ] : [];

    return (<>
        {showInstallGuide && <InstallGuideModal onClose={() => setShowInstallGuide(false)} />}
        <div style={styles.splashContainer}>
            <div style={styles.splashLogoContainer}><img src="https://upload.wikimedia.org/wikipedia/en/thumb/2/20/UD_Las_Palmas_logo.svg/1200px-UD_Las_Palmas_logo.svg.png" alt="UD Las Palmas Logo" style={styles.splashLogo} /><div style={styles.splashTitleContainer}><span style={styles.splashTitle}>PORRA UDLP</span><span style={styles.splashYear}>2026</span></div></div>
            {loading ? <LoadingSkeleton type="splash" /> : renderJornadaInfo()}
            {jornadaInfo?.type === 'activa' && stats && (
                <div style={styles.statsCarouselContainer}>
                    <div style={{...styles.statsCarouselTrack, transform: `translateX(-${currentStatIndex * 25}%)`}}>
                        {statCards.map((card, index) => <div key={index} style={styles.statCardWrapper}>{card}</div>)}
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
            .filter(b => b.name)
            .sort((a, b) => a.priority - b.priority)[0];
        if (highestPriorityBadge?.style) return { animation: `${highestPriorityBadge.style}-animation 2s infinite alternate` };
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
                <h4 style={styles.preMatchTitle}>ESTADÍSTICAS</h4>
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
    const [preMatchStats, setPreMatchStats] = useState(null);
    const [fullPreMatchStats, setFullPreMatchStats] = useState(null);
    const [showStatsModal, setShowStatsModal] = useState(false);
    const [loadingPreMatch, setLoadingPreMatch] = useState(false);
    const [lastApiUpdate, setLastApiUpdate] = useState(null);
    const apiTimerRef = useRef(null);
    const lastApiCallDay = useRef(null);
    const [showLiquidarPagoModal, setShowLiquidarPagoModal] = useState(false);
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
            
            let jornadaActiva = todasLasJornadas.find(j => ['Abierta', 'Pre-apertura', 'Cerrada'].includes(j.estado) || (j.estado === 'Próximamente' && j.fechaApertura?.toDate() <= ahora && ahora < j.fechaCierre?.toDate()));
            
            if (!jornadaActiva) {
                const finalizadas = todasLasJornadas
                    .filter(j => j.estado === 'Finalizada')
                    .sort((a, b) => b.numeroJornada - a.numeroJornada);
                if (finalizadas.length > 0) {
                    jornadaActiva = finalizadas[0];
                }
            }

            if(jornadaActiva){
                setCurrentJornada(prevJornada => {
                    if (prevJornada && prevJornada.id !== jornadaActiva.id) {
                        setPreMatchStats(null);
                        setFullPreMatchStats(null);
                        lastApiCallDay.current = null;
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
                setCurrentJornada(null);
                setLoading(false);
                setPreMatchStats(null);
                setFullPreMatchStats(null);
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
        if (apiTimerRef.current) {
            clearInterval(apiTimerRef.current);
            apiTimerRef.current = null;
        }

        if (!currentJornada || !currentJornada.fechaPartido || !currentJornada.apiLeagueId || !currentJornada.apiLocalTeamId || !currentJornada.apiVisitorTeamId) {
            return;
        }

        const fetchHeaders = {
            "x-rapidapi-host": "v3.football.api-sports.io",
            "x-rapidapi-key": API_FOOTBALL_KEY
        };

        const fetchTeamStats = async (leagueId, teamId, season) => {
            try {
                const response = await fetch(`https://v3.football.api-sports.io/standings?league=${leagueId}&season=${season}&team=${teamId}`, { headers: fetchHeaders });
                if (!response.ok) throw new Error(`API call failed: ${response.status}`);
                const data = await response.json();
                
                if (data.results === 0 || !data.response[0]) {
                    console.warn(`No data for team ${teamId}`);
                    return null;
                }
                const teamStanding = data.response[0]?.league?.standings[0]?.[0];
                return {
                    name: teamStanding?.team?.name || 'N/A',
                    logo: teamStanding?.team?.logo || '',
                    rank: teamStanding?.rank || 'N/A',
                    points: teamStanding?.points || 'N/A',
                    form: teamStanding?.form || '-----',
                    golesFavor: teamStanding?.all?.goals?.for || 0,
                    golesContra: teamStanding?.all?.goals?.against || 0,
                    statsHomeOrAway: teamStanding?.home?.team?.id === teamId ? teamStanding.home : teamStanding.away,
                };
            } catch (error) {
                console.error(`Error fetching stats for team ${teamId}:`, error);
                return null;
            }
        };
        
        const fetchTopScorers = async (leagueId, teamId, season) => {
             try {
                const response = await fetch(`https://v3.football.api-sports.io/players/topscorers?league=${leagueId}&season=${season}&team=${teamId}`, { headers: fetchHeaders });
                 if (!response.ok) throw new Error(`API call failed: ${response.status}`);
                 const data = await response.json();
                 return data.response || [];
             } catch (error) {
                 console.error(`Error fetching top scorers for team ${teamId}:`, error);
                 return [];
             }
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
                const statsData = { 
                    local: {...localStats, topScorers: localScorers}, 
                    visitante: {...visitorStats, topScorers: visitorScorers} 
                };
                setPreMatchStats(statsData);
                setFullPreMatchStats(statsData);
                setLastApiUpdate(Date.now());
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
                if(!preMatchStats) fetchData();
                apiTimerRef.current = setInterval(fetchData, 5 * 60 * 1000);
            } else {
                const todayStr = now.toISOString().split('T')[0];
                if (now.getHours() >= 22 && lastApiCallDay.current !== todayStr) {
                    fetchData();
                    lastApiCallDay.current = todayStr;
                }
                apiTimerRef.current = setInterval(manageUpdates, 60 * 1000);
            }
        };
        
        if (!preMatchStats) {
            fetchData();
        }
        manageUpdates();

        return () => {
            if (apiTimerRef.current) {
                clearInterval(apiTimerRef.current);
                apiTimerRef.current = null;
            }
        };
    }, [currentJornada, preMatchStats]);
    
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
    
    const handleGuardarPronostico = async (e) => {
        e.preventDefault();
        if (!currentJornada) return;
        if (pronostico.pin && pronostico.pin !== pronostico.pinConfirm) { setMessage({text: 'Los PIN no coinciden. Por favor, revísalos.', type: 'error'}); return; }
        const cleanJokerPronosticos = pronostico.jokerPronosticos.filter(p => p.golesLocal !== '' || p.golesVisitante !== '');
        if (pronostico.jokerActivo && cleanJokerPronosticos.length === 0) { setMessage({text: 'Has activado el Joker. Debes rellenar al menos una apuesta Joker o usar el Botón del Pánico.', type: 'error'}); return; }
        
        setIsSaving(true); setMessage({text: '', type: 'info'});
        const pronosticoRef = doc(db, "pronosticos", currentJornada.id, "jugadores", user);
        const userJokerRef = doc(db, "clasificacion", user);
        const jokerJustActivated = pronostico.jokerActivo && !initialJokerStatus.current;

        try {
            const batch = writeBatch(db);
            const { pinConfirm, ...pronosticoToSave } = pronostico;
            batch.set(pronosticoRef, { ...pronosticoToSave, jokerPronosticos: cleanJokerPronosticos, lastUpdated: new Date() });
            if (jokerJustActivated) batch.update(userJokerRef, { jokersRestantes: increment(-1) });
            await batch.commit();
            
            if (jokerJustActivated) { setJokersRestantes(prev => prev - 1); initialJokerStatus.current = true; }
            setMessage({text: '¡Pronóstico guardado y secreto!', type: 'success'});
            setHasSubmitted(true); setIsLocked(!!pronostico.pin);
        } catch (error) { console.error("Error al guardar: ", error); setMessage({text: 'Error al guardar el pronóstico.', type: 'error'}); }
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

    const AnimatedPoints = ({ value }) => {
        const [displayValue, setDisplayValue] = useState(value);
        const prevValueRef = useRef(value);

        useEffect(() => {
            if (value !== prevValueRef.current) {
                const element = document.getElementById('animated-points');
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

        return <span id="animated-points">{displayValue}</span>;
    };
    
    const RenderedPronostico = ({ pronosticoData, jornadaData, teamLogos }) => {
        const costeApuesta = jornadaData.esVip ? APUESTA_VIP : APUESTA_NORMAL;
        const recaudado = allPronosticos.length * costeApuesta;
        const premioTotal = (jornadaData.bote || 0) + recaudado;
        const hayGanadores = jornadaData.ganadores && jornadaData.ganadores.length > 0;
        const premioIndividual = hayGanadores ? (premioTotal / jornadaData.ganadores.length).toFixed(2) : 0;

        return (
            <div style={styles.renderedPronosticoContainer}>
                <h4 style={styles.renderedPronosticoTitle}>Tu Apuesta Realizada</h4>
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
                {jornadaData.estado === 'Finalizada' && (
                    <div style={styles.winnerInfoBox}>
                        {hayGanadores ? (
                            <>
                                <p><strong>🏆 Ganador(es): {jornadaData.ganadores.join(', ')}</strong></p>
                                <p><strong>Premio por ganador:</strong> {premioIndividual}€</p>
                                <p><small>Contacta con Juanma para gestionar el pago/cobro.</small></p>
                            </>
                        ) : (
                            <p><strong>💰 ¡BOTE!</strong> El premio de {premioTotal}€ se acumula.</p>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const renderContent = () => {
        const ahora = new Date();
        const apertura = currentJornada?.fechaApertura?.toDate();
        const cierre = currentJornada?.fechaCierre?.toDate();
        const isBettingOpen = currentJornada && (currentJornada.estado === 'Abierta' || currentJornada.estado === 'Pre-apertura' || (currentJornada.estado === 'Próximamente' && apertura && cierre && ahora >= apertura && ahora < cierre));
        
        if (isBettingOpen) {
            const isVip = currentJornada.esVip;
            return (
                <form onSubmit={handleGuardarPronostico} style={styles.form}>
                    {currentJornada.bote > 0 && <div style={styles.jackpotBanner}>💰 JACKPOT: ¡{currentJornada.bote}€ DE BOTE! 💰</div>}
                    {isVip && (<div style={styles.vipBanner}>⭐ JORNADA VIP ⭐ (Apuesta: 2€ - Puntos Dobles)</div>)}
                    <h3 style={styles.formSectionTitle}>{currentJornada.id === 'jornada_test' ? 'Jornada de Prueba' : `Jornada ${currentJornada.numeroJornada}`}: {currentJornada.equipoLocal} vs {currentJornada.equipoVisitante}</h3>
                    
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
                    {message.text && <p style={{...styles.message, backgroundColor: message.type === 'success' ? styles.colors.success : colors.colors.danger}}>{message.text}</p>}
                </form>
            );
        }

        if (currentJornada?.estado === 'Cerrada' || currentJornada?.estado === 'Finalizada') {
            const showLiquidarButton = !pronostico.pagado && !pronostico.pagoConfirmadoPorUsuario;
            return (
                <div style={styles.placeholder}>
                    <h3>Jornada {currentJornada.numeroJornada} {currentJornada.estado}</h3>
                    <p>
                        {currentJornada.estado === 'Cerrada' ? 'Las apuestas para este partido han finalizado.' : 'Esta jornada ha concluido.'}
                    </p>
                    
                    <RenderedPronostico pronosticoData={pronostico} jornadaData={currentJornada} teamLogos={teamLogos} />
                    
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
        {tieneDeuda && !interJornadaStatus && (<div style={styles.debtBanner}>⚠️ Tienes pendiente el pago de la jornada anterior. Por favor, ve a la sección de "Pagos" para regularizarlo.</div>)}
        <h2 style={styles.title}>MI JORNADA</h2>
        <p style={{color: styles.colors.lightText, textAlign: 'center', fontSize: '1.1rem'}}>Bienvenido, <PlayerProfileDisplay name={user} profile={userProfile} defaultColor={styles.colors.yellow} style={{fontWeight: 'bold'}} /></p>
        
        {currentJornada && (currentJornada.estado === 'Abierta' || currentJornada.estado === 'Cerrada') && (
            <>
                {loadingPreMatch && !preMatchStats && <div style={{textAlign: 'center', padding: '20px'}}><p>Cargando estadísticas pre-partido...</p></div>}
                {preMatchStats && <PreMatchStats stats={preMatchStats} lastUpdated={lastApiUpdate} onOpenModal={() => setShowStatsModal(true)} />}
            </>
        )}

        {liveData?.isLive && currentJornada?.estado === 'Cerrada' && (<div style={styles.liveInfoBox}><div style={styles.liveInfoItem}><span style={styles.liveInfoLabel}>Puntos Provisionales</span><span style={styles.liveInfoValue}><AnimatedPoints value={provisionalData.puntos} /></span></div><div style={styles.liveInfoItem}><span style={styles.liveInfoLabel}>Posición Provisional</span><span style={styles.liveInfoValue}>{provisionalData.posicion}</span></div></div>)}
        {renderContent()}
      </div>
    );
};

// --- INICIO DE LA SEGUNDA PARTE ---
const LaJornadaScreen = ({ user, teamLogos, liveData, userProfiles, onlineUsers }) => {
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

    useEffect(() => {
        const q = query(collection(db, "jornadas"), where("estado", "in", ["Abierta", "Cerrada", "Finalizada", "Pre-apertura"]), orderBy("numeroJornada", "desc"), limit(1));
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
                getDocs(qUltima).then(snap => { if (!snap.empty) setUltimaJornada({ id: snap.docs[0].id, ...snap.docs[0].data() }); });
                const qProxima = query(collection(db, "jornadas"), where("estado", "==", "Próximamente"), orderBy("numeroJornada", "asc"), limit(1));
                getDocs(qProxima).then(snap => { if (!snap.empty) setProximaJornada({ id: snap.docs[0].id, ...snap.docs[0].data() }); });
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
                    if (data.users && data.users[user]) {
                        setUserReactions(data.users[user]);
                    } else {
                        setUserReactions({});
                    }
                } else {
                    setReactions({});
                    setUserReactions({});
                }
            });
            return () => unsubscribeReactions();
        }
    }, [jornadaActual, user]);

    useEffect(() => {
        if (jornadaActual?.estado === 'Cerrada' && liveData?.isLive && participantes.length > 0) {
            const ranking = participantes.map(p => {
                const puntos = calculateProvisionalPoints(p, liveData, jornadaActual);
                const aciertoExacto = p.golesLocal !== '' && p.golesVisitante !== '' && parseInt(p.golesLocal) === liveData.golesLocal && parseInt(p.golesVisitante) === liveData.golesVisitante;
                return { id: p.id, puntos, aciertoExacto };
            }).sort((a, b) => {
                if (a.puntos !== b.puntos) {
                    return b.puntos - a.puntos;
                }
                return (b.aciertoExacto ? 1 : 0) - (a.aciertoExacto ? 1 : 0);
            });
            setProvisionalRanking(ranking);
        } else { setProvisionalRanking([]); }
    }, [liveData, jornadaActual, participantes]);

    useEffect(() => {
        if ((jornadaActual?.estado === 'Abierta' || jornadaActual?.estado === 'Pre-apertura') && jornadaActual.fechaCierre) {
            const targetDate = jornadaActual.estado === 'Abierta' ? jornadaActual.fechaCierre.toDate() : jornadaActual.fechaApertura.toDate();
            const interval = setInterval(() => {
                const diff = targetDate - new Date();
                if (diff <= 0) { setCountdown("¡PLAZO FINALIZADO!"); clearInterval(interval); return; }
                const d = Math.floor(diff / 86400000); const h = Math.floor((diff % 86400000) / 3600000);
                const m = Math.floor((diff % 3600000) / 60000); const s = Math.floor((diff % 60000) / 1000);
                setCountdown(`${d}d ${h}h ${m}m ${s}s`);
            }, 1000); return () => clearInterval(interval);
        } else { setCountdown(''); }
    }, [jornadaActual]);

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

    const liveWinnerPanelData = useMemo(() => {
        if (!liveData || !liveData.isLive || !jornadaActual || participantes.length === 0) {
            return { currentWinner: null, simulationLocal: null, simulationVisitor: null };
        }
        const findWinner = (simulatedLiveData) => {
            const ranking = participantes.map(p => ({
                id: p.id,
                puntos: calculateProvisionalPoints(p, simulatedLiveData, jornadaActual)
            })).sort((a, b) => b.puntos - a.puntos);
            if (ranking.length > 0 && ranking[0].puntos > 0) {
                const topScore = ranking[0].puntos;
                const winners = ranking.filter(p => p.puntos === topScore);
                return winners.length > 1 ? "Empate" : winners[0].id;
            }
            return "Nadie";
        };
        const currentWinner = findWinner(liveData);
        const localGoalLiveData = { ...liveData, golesLocal: liveData.golesLocal + 1 };
        const simulationLocal = findWinner(localGoalLiveData);
        const visitorGoalLiveData = { ...liveData, golesVisitante: liveData.golesVisitante + 1 };
        const simulationVisitor = findWinner(visitorGoalLiveData);
        return { currentWinner, simulationLocal, simulationVisitor };
    }, [liveData, jornadaActual, participantes]);


    if (loading) return <LoadingSkeleton />;
    const isLiveView = jornadaActual?.estado === 'Cerrada' && liveData?.isLive;

    const renderContent = () => {
        if (jornadaActual) {
            const fechaMostrada = jornadaActual.fechaPartido || jornadaActual.fechaCierre;
            const finalScore = jornadaActual.estado === 'Finalizada'
                ? `${jornadaActual.resultadoLocal} - ${jornadaActual.resultadoVisitante}`
                : (isLiveView ? `${liveData.golesLocal} - ${liveData.golesVisitante}` : 'VS');

            const showBoteMessage = jornadaActual.estado === 'Finalizada' && (!jornadaActual.ganadores || jornadaActual.ganadores.length === 0);

            const costeApuesta = jornadaActual.esVip ? APUESTA_VIP : APUESTA_NORMAL;
            const recaudado = participantes.length * costeApuesta;
            const premioTotal = (jornadaActual.bote || 0) + recaudado;
            const hayGanadores = jornadaActual.ganadores && jornadaActual.ganadores.length > 0;
            const premioIndividual = hayGanadores ? (premioTotal / jornadaActual.ganadores.length).toFixed(2) : 0;

            return (
                <div style={{...styles.laJornadaContainer, backgroundImage: `linear-gradient(rgba(10, 25, 47, 0.85), rgba(10, 25, 47, 0.85)), url(${jornadaActual.estadioImageUrl})`}}>
                    <h3>{jornadaActual.id === 'jornada_test' ? 'Jornada de Prueba' : `Jornada ${jornadaActual.numeroJornada}`}</h3>
                    <div style={styles.matchInfo}>
                        <TeamDisplay teamLogos={teamLogos} teamName={jornadaActual.equipoLocal} shortName={true} imgStyle={styles.matchInfoLogo} />
                        <span style={styles.liveScoreInPage}>{finalScore}</span>
                        <TeamDisplay teamLogos={teamLogos} teamName={jornadaActual.equipoVisitante} imgStyle={styles.matchInfoLogo} />
                    </div>
                    <div style={styles.matchDetails}><span>📍 {jornadaActual.estadio || 'Estadio por confirmar'}</span><span>🗓️ {formatFullDateTime(fechaMostrada)}</span></div>
                    
                    {jornadaActual.estado === 'Finalizada' && (
                         <div style={styles.winnerInfoBox}>
                            {hayGanadores ? (
                                <>
                                    <p><strong>🏆 Ganador(es): {jornadaActual.ganadores.join(', ')}</strong></p>
                                    <p><strong>Premio por ganador:</strong> {premioIndividual}€</p>
                                    <p><small>Contacta con Juanma para gestionar el pago/cobro.</small></p>
                                </>
                            ) : (
                                <p><strong>💰 ¡BOTE!</strong> El premio de {premioTotal}€ se acumula.</p>
                            )}
                        </div>
                    )}

                    {isLiveView && (
                        <>
                            <div style={styles.liveWinnerPanel}>
                                <div style={styles.liveWinnerCurrent}>
                                    <span style={styles.liveWinnerLabel}>Ganador Actual</span>
                                    <div style={styles.liveWinnerName}>
                                        {liveWinnerPanelData.currentWinner ? (
                                            <PlayerProfileDisplay name={liveWinnerPanelData.currentWinner} profile={userProfiles[liveWinnerPanelData.currentWinner]} />
                                        ) : 'Nadie'}
                                    </div>
                                </div>
                                <div style={styles.liveWinnerSimulations}>
                                    <div style={styles.liveWinnerSimulationItem}>
                                        <span style={styles.liveWinnerLabel}>Si marca {jornadaActual.equipoLocal}...</span>
                                        <div style={styles.liveWinnerName}>
                                            {liveWinnerPanelData.simulationLocal ? (
                                                <PlayerProfileDisplay name={liveWinnerPanelData.simulationLocal} profile={userProfiles[liveWinnerPanelData.simulationLocal]} />
                                            ) : 'Nadie'}
                                        </div>
                                    </div>
                                    <div style={styles.liveWinnerSimulationItem}>
                                        <span style={styles.liveWinnerLabel}>Si marca {jornadaActual.equipoVisitante}...</span>
                                        <div style={styles.liveWinnerName}>
                                            {liveWinnerPanelData.simulationVisitor ? (
                                                <PlayerProfileDisplay name={liveWinnerPanelData.simulationVisitor} profile={userProfiles[liveWinnerPanelData.simulationVisitor]} />
                                            ) : 'Nadie'}
                                        </div>
                                    </div>
                                </div>
                            </div>
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
                    {jornadaActual.estado === 'Cerrada' && !isLiveView && (<div><p style={{textAlign: 'center', marginTop: '20px'}}>Las apuestas están cerradas. ¡Estos son los pronósticos!</p><div style={styles.resumenContainer}>{participantes.sort((a, b) => a.id.localeCompare(b.id)).map(p => { const profile = userProfiles[p.id] || {}; return (<div key={p.id} style={styles.resumenJugador}><h4 style={styles.resumenJugadorTitle}><PlayerProfileDisplay name={p.id} profile={profile} defaultColor={styles.colors.yellow} /> {p.jokerActivo && '🃏'}</h4><div style={styles.resumenJugadorBets}><p><strong>Principal:</strong> {p.golesLocal}-{p.golesVisitante} &nbsp;|&nbsp; <strong>1X2:</strong> {p.resultado1x2} &nbsp;|&nbsp; <strong>Goleador:</strong> {p.sinGoleador ? 'Sin Goleador' : (p.goleador || 'N/A')}</p>{p.jokerActivo && p.jokerPronosticos?.length > 0 && (<div style={{marginTop: '10px'}}><strong>Apuestas Joker:</strong><div style={styles.jokerChipsContainer}>{p.jokerPronosticos.map((jp, index) => (<span key={index} style={styles.jokerDetailChip}>{jp.golesLocal}-{jp.golesVisitante}</span>))}</div></div>)}</div></div>)})}</div></div>)}
                    {isLiveView && (<div><h3 style={styles.provisionalTitle}>Clasificación Provisional</h3><table style={{...styles.table, backgroundColor: 'rgba(0,0,0,0.3)'}}><thead><tr><th style={styles.th}>POS</th><th style={styles.th}>Jugador</th><th style={styles.th}>Puntos</th></tr></thead><tbody>{provisionalRanking.map((jugador, index) => { const profile = userProfiles[jugador.id] || {}; return (<tr key={jugador.id} style={jugador.puntos > 0 && provisionalRanking[0].puntos === jugador.puntos ? styles.provisionalWinnerRow : styles.tr}><td style={styles.tdRank}>{index + 1}º</td><td style={styles.td}><PlayerProfileDisplay name={jugador.id} profile={profile} /> {jugador.aciertoExacto && '🎯'}</td><td style={styles.td}><AnimatedPoints value={jugador.puntos} /></td></tr>)})}</tbody></table></div>)}

                    {jornadaActual.estado === 'Finalizada' && (
                        <div>
                            <h3 style={styles.provisionalTitle}>Resumen de la Jornada</h3>
                            {showBoteMessage && (
                                <div style={styles.boteBanner}>💰 ¡BOTE ACUMULADO! Nadie acertó el resultado.</div>
                            )}
                            <div style={styles.resumenContainer}>
                                {participantes.sort((a,b) => (b.puntosObtenidos || 0) - (a.puntosObtenidos || 0)).map(p => {
                                    const profile = userProfiles[p.id] || {};
                                    return (
                                        <div key={p.id} style={styles.resumenJugador}>
                                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                                <h4 style={{...styles.resumenJugadorTitle, borderBottom: 'none', paddingBottom: 0, marginBottom: 0}}>
                                                    <PlayerProfileDisplay name={p.id} profile={profile} defaultColor={styles.colors.yellow} /> {p.jokerActivo && '🃏'}
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
        } else if(ultimaJornada || proximaJornada) {
            return (
                <div style={styles.interJornadaContainer}>
                    {ultimaJornada ? (<div style={styles.interJornadaBox}><h3 style={styles.interJornadaTitle}>Última Jornada Finalizada</h3><p style={styles.interJornadaTeams}>{ultimaJornada.equipoLocal} vs {ultimaJornada.equipoVisitante}</p><p style={styles.finalResult}>{ultimaJornada.resultadoLocal} - {ultimaJornada.resultadoVisitante}</p>{(ultimaJornada.ganadores?.length > 0) ? (<p style={styles.interJornadaWinner}>🏆 Ganador(es): {ultimaJornada.ganadores.join(', ')}</p>) : (<p style={styles.interJornadaBote}>💰 ¡BOTE ACUMULADO!</p>)}</div>) : <div style={styles.interJornadaBox}><p>Aún no ha finalizado ninguna jornada.</p></div>}
                    {proximaJornada ? (<div style={styles.interJornadaBox}><h3 style={styles.interJornadaTitle}>Próxima Jornada</h3><p style={styles.interJornadaTeams}>{proximaJornada.equipoLocal} vs {proximaJornada.equipoVisitante}</p><p>{formatFullDateTime(proximaJornada.fechaPartido || proximaJornada.fechaCierre)}</p>{proximaJornada.bote > 0 && <p style={styles.interJornadaBote}>¡Bote de {proximaJornada.bote}€ en juego!</p>}</div>) : <div style={styles.interJornadaBox}><p>El administrador no ha configurado la próxima jornada.</p></div>}
                </div>
            );
        } else {
             return <div style={styles.placeholder}><h3>No hay jornadas disponibles.</h3><p>El administrador añadirá nuevas jornadas próximamente.</p></div>;
        }
    };

    return (
        <div>
            <h2 style={styles.title}>LA JORNADA</h2>
            {renderContent()}
            <div style={styles.porraAnualContainer}>
                <h3 style={styles.formSectionTitle}>⭐ PORRA ANUAL ⭐</h3>
                {porraAnualConfig?.estado === 'Abierta' && <p style={{textAlign: 'center'}}>Las apuestas de los demás serán secretas hasta la Jornada 5. ¡Haz la tuya desde el banner superior!</p>}
                {(porraAnualConfig?.estado === 'Cerrada' || porraAnualConfig?.estado === 'Finalizada') && (
                    <div>
                        <p style={{textAlign: 'center'}}>Apuestas cerradas. Estos son los pronósticos para final de temporada:</p>
                        <div style={styles.resumenContainer}>
                            {pronosticosAnuales.sort((a, b) => a.id.localeCompare(b.id)).map(p => {
                                const profile = userProfiles[p.id] || {};
                                return (
                                    <div key={p.id} style={styles.resumenJugador}>
                                        <h4 style={styles.resumenJugadorTitle}><PlayerProfileDisplay name={p.id} profile={profile} defaultColor={styles.colors.yellow} /></h4>
                                        <div style={styles.resumenJugadorBets}>
                                            <p><strong>¿Asciende?:</strong> <span style={{color: p.ascenso === 'SI' ? styles.colors.success : styles.colors.danger, fontWeight: 'bold'}}>{p.ascenso}</span></p>
                                            <p><strong>Posición Final:</strong> <span style={{color: styles.colors.yellow, fontWeight: 'bold'}}>{p.posicion}º</span></p>
                                            {porraAnualConfig.estado === 'Finalizada' && <p><strong>Puntos Obtenidos:</strong> <span style={{fontWeight: 'bold', color: styles.colors.gold}}>{p.puntosObtenidos || 0}</span></p>}
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
    return (<div><h2 style={styles.title}>CALENDARIO</h2><div style={styles.jornadaList}>{jornadas.map(jornada => {
        const fechaMostrada = jornada.fechaPartido || jornada.fechaCierre;
        return (<div key={jornada.id} style={jornada.esVip ? {...styles.jornadaItem, ...styles.jornadaVip, backgroundImage: `linear-gradient(to right, rgba(23, 42, 69, 0.95), rgba(23, 42, 69, 0.7)), url(${jornada.estadioImageUrl})`} : {...styles.jornadaItem, backgroundImage: `linear-gradient(to right, rgba(23, 42, 69, 0.95), rgba(23, 42, 69, 0.7)), url(${jornada.estadioImageUrl})`}} onClick={() => onViewJornada(jornada.id)}><div style={styles.jornadaInfo}><div style={styles.jornadaTeams}><TeamDisplay teamLogos={teamLogos} teamName={jornada.equipoLocal} imgStyle={{width: 25, height: 25}} /><span style={{color: styles.colors.yellow, margin: '0 10px'}}>vs</span><TeamDisplay teamLogos={teamLogos} teamName={jornada.equipoVisitante} imgStyle={{width: 25, height: 25}} /></div><strong>{jornada.esVip && '⭐ '}{jornada.id === 'jornada_test' ? 'Jornada de Prueba' : `Jornada ${jornada.numeroJornada || 'Copa'}`}</strong>
    <small>{formatFullDateTime(fechaMostrada)} - {jornada.estadio || 'Estadio por confirmar'}</small>
    </div><div style={{...styles.statusBadge, backgroundColor: styles.colors.status[jornada.estado]}}>{jornada.estado}</div></div>)
    })}</div></div>);
};

const AnimatedPoints = ({ value }) => {
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
    const [posicionesAnteriores, setPosicionesAnteriores] = useState({});

    useEffect(() => {
        const fetchClasificacionData = async () => {
            setLoading(true);
            
            const clasificacionSnap = await getDocs(query(collection(db, "clasificacion")));
            const clasificacionData = {};
            clasificacionSnap.forEach((doc) => {
                clasificacionData[doc.id] = { id: doc.id, ...doc.data() };
            });
            const processedData = JUGADORES.map(jugadorId => clasificacionData[jugadorId] || {
                id: jugadorId, jugador: jugadorId, puntosTotales: 0, puntosResultadoExacto: 0, puntosGoleador: 0, puntos1x2: 0, plenos: 0, jokersRestantes: 2, badges: []
            });
            setClasificacion(processedData);

            const qUltimaJornada = query(collection(db, "jornadas"), where("estado", "==", "Finalizada"), orderBy("numeroJornada", "desc"), limit(1));
            const ultimaJornadaSnap = await getDocs(qUltimaJornada);

            if (!ultimaJornadaSnap.empty) {
                const pronosticosSnap = await getDocs(collection(db, "pronosticos", ultimaJornadaSnap.docs[0].id, "jugadores"));
                
                const puntosUltimaJornada = {};
                pronosticosSnap.forEach(doc => {
                    puntosUltimaJornada[doc.id] = doc.data().puntosObtenidos || 0;
                });

                const clasificacionAnterior = processedData.map(jugador => ({
                    ...jugador,
                    puntosAnteriores: (jugador.puntosTotales || 0) - (puntosUltimaJornada[jugador.id] || 0)
                })).sort((a, b) => b.puntosAnteriores - a.puntosAnteriores);

                const posiciones = {};
                clasificacionAnterior.forEach((jugador, index) => {
                    posiciones[jugador.id] = index + 1;
                });
                setPosicionesAnteriores(posiciones);
            }
            setLoading(false);
        };

        const unsubscribe = onSnapshot(query(collection(db, "clasificacion")), () => {
             fetchClasificacionData();
        });

        fetchClasificacionData();
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
        const isLive = liveData && liveData.isLive && liveJornada;
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

        return sorted.map((jugador, index) => {
            const posAnterior = posicionesAnteriores[jugador.id];
            const posActual = index + 1;
            let cambio = '–';
            if (posAnterior) {
                if (posActual < posAnterior) cambio = '▲';
                else if (posActual > posAnterior) cambio = '▼';
            }
            return { ...jugador, cambio };
        });
    }, [clasificacion, liveData, liveJornada, livePronosticos, posicionesAnteriores]);

    if (loading) return <LoadingSkeleton type="table" />;
    
    const isLive = liveData && liveData.isLive;

    const getRankStyle = (index, jugador) => {
        let style = styles.tr;
        if (index === 0) style = styles.leaderRow;
        else if (index === 1) style = styles.secondPlaceRow;
        else if (index === 2) style = styles.thirdPlaceRow;
        
        if (jugador.id === currentUser) {
            style = {...style, ...styles.currentUserRow};
        }
        return style;
    };
    
    const getCambioStyle = (cambio) => {
        if (cambio === '▲') return { color: styles.colors.success, textShadow: `0 0 5px ${styles.colors.success}` };
        if (cambio === '▼') return { color: styles.colors.danger, textShadow: `0 0 5px ${styles.colors.danger}` };
        return { color: styles.colors.silver };
    };

    return (
        <div>
            <h2 style={styles.title}>CLASIFICACIÓN</h2>
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
                            const profile = userProfiles[jugador.id] || {};
                            const puntosAMostrar = isLive ? jugador.puntosEnVivo : jugador.puntosTotales;

                            return (
                                <tr key={jugador.id} style={getRankStyle(index, jugador)}>
                                    <td style={styles.tdRank}>{index + 1}º</td>
                                    <td style={styles.td}>
                                        <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                                           <span style={{...getCambioStyle(jugador.cambio), fontSize: '1.2rem', width: '15px'}}>{jugador.cambio}</span>
                                           <PlayerProfileDisplay name={jugador.jugador || jugador.id} profile={profile} />
                                        </div>
                                    </td>
                                    <td style={styles.tdTotalPoints}>
                                        <AnimatedPoints value={puntosAMostrar} />
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

// --- INICIO DE LA TERCERA PARTE ---
const JornadaAdminItem = ({ jornada, plantilla }) => {
    const [estado, setEstado] = useState(jornada.estado);
    const [resultadoLocal, setResultadoLocal] = useState(jornada.resultadoLocal === undefined ? '' : jornada.resultadoLocal);
    const [resultadoVisitante, setResultadoVisitante] = useState(jornada.resultadoVisitante === undefined ? '' : jornada.resultadoVisitante);
    const [goleador, setGoleador] = useState(jornada.goleador || '');
    const [resultado1x2, setResultado1x2] = useState(jornada.resultado1x2 || '');
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
                resultadoLocal: resultadoLocal === '' ? null : Number(resultadoLocal),
                resultadoVisitante: resultadoVisitante === '' ? null : Number(resultadoVisitante), 
                goleador: goleador.trim(), 
                resultado1x2, 
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

    const handleUpdateLiveScore = async () => {
        setIsSaving(true);
        const jornadaRef = doc(db, "jornadas", jornada.id);
        try {
            await updateDoc(jornadaRef, { liveData: { ...liveData, isLive: true } });
            setMessage('¡Marcador en vivo actualizado!'); setTimeout(() => setMessage(''), 2000);
        } catch (error) { console.error("Error actualizando marcador en vivo:", error); setMessage('Error al actualizar.'); }
        setIsSaving(false);
    };
    
    const runPointsAndBadgesLogic = async () => {
        const pronosticosRef = collection(db, "pronosticos", jornada.id, "jugadores");
        const pronosticosSnap = await getDocs(pronosticosRef);
        if (pronosticosSnap.empty) {
            console.log(`No hay pronósticos para la jornada ${jornada.numeroJornada}.`);
            const jornadaRef = doc(db, "jornadas", jornada.id);
            await updateDoc(jornadaRef, { estado: "Finalizada", ganadores: [], "liveData.isLive": false });
            return;
        }

        const batch = writeBatch(db);
        let ganadoresJornada = [];

        for (const pDoc of pronosticosSnap.docs) {
            const p = pDoc.data();
            const { puntosJornada } = calculatePointsForPlayer(p, jornada);
            batch.update(pDoc.ref, { puntosObtenidos: puntosJornada });

            let esGanador = false;
            const pLocal = parseInt(p.golesLocal, 10);
            const pVisitante = parseInt(p.golesVisitante, 10);
            const rLocal = parseInt(jornada.resultadoLocal, 10);
            const rVisitante = parseInt(jornada.resultadoVisitante, 10);
            if (!isNaN(pLocal) && !isNaN(pVisitante) && pLocal === rLocal && pVisitante === rVisitante) {
                esGanador = true;
            }
             if (!esGanador && p.jokerActivo && p.jokerPronosticos?.length > 0) {
                for (const jokerP of p.jokerPronosticos) {
                    const jLocal = parseInt(jokerP.golesLocal, 10);
                    const jVisitante = parseInt(jokerP.golesVisitante, 10);
                    if (!isNaN(jLocal) && !isNaN(jVisitante) && jLocal === rLocal && jVisitante === rVisitante) {
                        esGanador = true;
                        break;
                    }
                }
            }
            if(esGanador) ganadoresJornada.push(pDoc.id);
        }

        const jornadaRef = doc(db, "jornadas", jornada.id);
        batch.update(jornadaRef, { estado: "Finalizada", ganadores: ganadoresJornada, "liveData.isLive": false });
        
        if (ganadoresJornada.length === 0 && jornada.id !== 'jornada_test') {
            const costeApuesta = jornada.esVip ? APUESTA_VIP : APUESTA_NORMAL;
            const boteGenerado = (jornada.bote || 0) + (pronosticosSnap.size * costeApuesta);
            const qProxima = query(collection(db, "jornadas"), where("numeroJornada", ">", jornada.numeroJornada), orderBy("numeroJornada"), limit(1));
            const proximaJornadaSnap = await getDocs(qProxima);
            if (!proximaJornadaSnap.empty) {
                const proximaJornadaRef = proximaJornadaSnap.docs[0].ref;
                batch.update(proximaJornadaRef, { bote: increment(boteGenerado) });
            }
        }
        await batch.commit();
    };

    const handleCalcularPuntos = async () => {
        if (jornada.estado === 'Finalizada') {
            alert("ERROR: Esta jornada ya ha sido finalizada. Usa el botón de RECALCULAR INSIGNIAS si es necesario.");
            return;
        }
        if (resultadoLocal === '' || resultadoVisitante === '' || !resultado1x2) { alert("Introduce los goles de ambos equipos y el Resultado 1X2."); return; }
        setIsCalculating(true);
        try {
            await runPointsAndBadgesLogic();
            alert("¡Puntos calculados y jornada cerrada! Ahora debes usar la herramienta 'Recalcular Estadísticas Globales' para actualizar todo.");
        } catch (error) { console.error("Error al calcular: ", error); alert("Error al calcular puntos."); }
        setIsCalculating(false);
    };

    const handleRecalcularInsignias = async () => {
        if (jornada.estado !== 'Finalizada') { alert("Esta función es solo para jornadas ya finalizadas."); return; }
        if (!window.confirm("Esta acción recalculará las insignias de esta jornada para todos los jugadores. ¿Continuar?")) return;

        setIsCalculating(true); setMessage('Recalculando insignias...');
        try {
            const allJornadasSnap = await getDocs(query(collection(db, "jornadas"), orderBy("numeroJornada")));
            const allJornadas = allJornadasSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            const clasificacionHistorica = {};
            JUGADORES.forEach(j => clasificacionHistorica[j] = { puntosTotales: 0 });
            for (const j of allJornadas) {
                if (j.numeroJornada < jornada.numeroJornada && j.estado === 'Finalizada') {
                    const pronosPasadosSnap = await getDocs(collection(db, "pronosticos", j.id, "jugadores"));
                    pronosPasadosSnap.forEach(pSnap => {
                        const pData = pSnap.data();
                        if (clasificacionHistorica[pSnap.id] && pData.puntosObtenidos) {
                            clasificacionHistorica[pSnap.id].puntosTotales += pData.puntosObtenidos;
                        }
                    });
                }
            }

            const pronosticosJornadaSnap = await getDocs(collection(db, "pronosticos", jornada.id, "jugadores"));
            pronosticosJornadaSnap.forEach(doc => {
                 clasificacionHistorica[doc.id].puntosTotales += doc.data().puntosObtenidos || 0;
            });

            const sortedClasificacion = Object.entries(clasificacionHistorica).sort(([, a], [, b]) => b.puntosTotales - a.puntosTotales);
            const lider = sortedClasificacion[0] ? sortedClasificacion[0][0] : null;

            const finalizadasAnteriores = allJornadas.filter(j => j.estado === 'Finalizada' && j.numeroJornada < jornada.numeroJornada).slice(-2);
            const jornadasParaRacha = [...finalizadasAnteriores, jornada].sort((a,b) => a.numeroJornada - b.numeroJornada);

            const pronosticosParaRacha = {};
             for(const j of jornadasParaRacha) {
                const pronosSnap = await getDocs(collection(db, "pronosticos", j.id, "jugadores"));
                pronosticosParaRacha[j.id] = {};
                pronosSnap.forEach(doc => pronosticosParaRacha[j.id][doc.id] = doc.data());
            }

            const batch = writeBatch(db);
            for (const jugadorId of JUGADORES) {
                const jugadorRef = doc(db, "clasificacion", jugadorId);
                const jugadorSnap = await getDoc(jugadorRef);
                let newBadges = new Set(jugadorSnap.exists() ? jugadorSnap.data().badges || [] : []);

                ['campeon_jornada', 'lider_general', 'pleno_jornada', 'mala_racha', 'en_racha'].forEach(b => newBadges.delete(b));
                
                if (jornada.ganadores?.includes(jugadorId)) newBadges.add('campeon_jornada');
                if (lider && jugadorId === lider) newBadges.add('lider_general');

                if (jornadasParaRacha.length >= 3) {
                    let rachaSinPuntos = 0, rachaPuntuando = 0;
                    for (const j of jornadasParaRacha) {
                        const p = pronosticosParaRacha[j.id]?.[jugadorId];
                        if (p) {
                            if ((p.puntosObtenidos || 0) > 0) { rachaPuntuando++; rachaSinPuntos = 0; } 
                            else { rachaSinPuntos++; rachaPuntuando = 0; }
                        } else { rachaPuntuando = 0; rachaSinPuntos = 0; }
                    }
                    if (rachaSinPuntos >= 3) newBadges.add('mala_racha');
                    if (rachaPuntuando >= 3) newBadges.add('en_racha');
                }
                batch.set(jugadorRef, { badges: Array.from(newBadges) }, { merge: true });
            }
            await batch.commit();
            setMessage('¡Insignias recalculadas con éxito!');
        } catch (error) {
            console.error("Error recalculando insignias:", error);
            setMessage(`Error: ${error.message}`);
        }
        setIsCalculating(false);
    };

    const calculatePointsForPlayer = (pronostico, jornadaData) => {
        let puntosJornada = 0, esPleno = false;
        const esVipJornada = jornadaData.esVip || false;
        const rLocal = parseInt(jornadaData.resultadoLocal, 10);
        const rVisitante = parseInt(jornadaData.resultadoVisitante, 10);
        const pLocal = parseInt(pronostico.golesLocal, 10);
        const pVisitante = parseInt(pronostico.golesVisitante, 10);

        const aciertoExacto = !isNaN(pLocal) && !isNaN(pVisitante) && pLocal === rLocal && pVisitante === rVisitante;
        if (aciertoExacto) puntosJornada += esVipJornada ? 6 : 3;

        const acierto1x2 = pronostico.resultado1x2 === jornadaData.resultado1x2;
        if (acierto1x2) puntosJornada += esVipJornada ? 2 : 1;

        const goleadorReal = (jornadaData.goleador || '').trim().toLowerCase();
        const goleadorApostado = (pronostico.goleador || '').trim().toLowerCase();
        let aciertoGoleador = false;
        if (pronostico.sinGoleador && (goleadorReal === "sg" || goleadorReal === "")) {
            puntosJornada += 1; aciertoGoleador = true;
        } else if (!pronostico.sinGoleador && goleadorApostado === goleadorReal && goleadorReal !== "") {
            puntosJornada += esVipJornada ? 4 : 2; aciertoGoleador = true;
        }

        if (pronostico.jokerActivo && pronostico.jokerPronosticos?.length > 0) {
            for (const jokerP of pronostico.jokerPronosticos) {
                const jLocal = parseInt(jokerP.golesLocal, 10);
                const jVisitante = parseInt(jokerP.golesVisitante, 10);
                if (!isNaN(jLocal) && !isNaN(jVisitante) && jLocal === rLocal && jVisitante === rVisitante) {
                    puntosJornada += esVipJornada ? 6 : 3; break;
                }
            }
        }
        if (aciertoExacto && acierto1x2 && aciertoGoleador) esPleno = true;
        return { puntosJornada, esPleno };
    };

    const handleResetBote = async () => {
        if (window.confirm(`¿Seguro que quieres resetear el bote de la Jornada ${jornada.numeroJornada} a 0€? Esta acción es irreversible.`)) {
            setIsSaving(true);
            const jornadaRef = doc(db, "jornadas", jornada.id);
            try {
                await updateDoc(jornadaRef, { bote: 0 });
                setMessage('¡Bote reseteado a 0€!');
                setTimeout(() => setMessage(''), 3000);
            } catch (error) {
                console.error("Error reseteando el bote:", error);
                setMessage('Error al resetear el bote.');
            }
            setIsSaving(false);
        }
    };

    return (
        <div style={jornada.id === 'jornada_test' ? {...styles.adminJornadaItem, ...styles.testJornadaAdminItem} : (jornada.esVip ? {...styles.adminJornadaItem, ...styles.jornadaVip} : styles.adminJornadaItem)}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap'}}><p><strong>{jornada.id === 'jornada_test' ? 'Jornada de Prueba' : `Jornada ${jornada.numeroJornada || 'Copa'}`}:</strong> {jornada.equipoLocal} vs {jornada.equipoVisitante}</p><div style={styles.vipToggleContainer}><label htmlFor={`vip-toggle-${jornada.id}`}>⭐ VIP</label><input id={`vip-toggle-${jornada.id}`} type="checkbox" checked={esVip} onChange={(e) => setEsVip(e.target.checked)} style={styles.checkbox}/></div></div>
            <div style={styles.adminControls}>
                <select value={estado} onChange={(e) => setEstado(e.target.value)} style={styles.adminSelect}><option value="Próximamente">Próximamente</option><option value="Pre-apertura">Pre-apertura</option><option value="Abierta">Abierta</option><option value="Cerrada">Cerrada</option><option value="Finalizada">Finalizada</option></select>
                <div style={styles.resultInputContainer}><input type="number" min="0" value={resultadoLocal} onChange={(e) => setResultadoLocal(e.target.value)} style={styles.resultInput} placeholder="L" /><span style={styles.separator}>-</span><input type="number" min="0" value={resultadoVisitante} onChange={(e) => setResultadoVisitante(e.target.value)} style={styles.resultInput} placeholder="V"/></div>
                <select value={goleador} onChange={(e) => setGoleador(e.target.value)} style={styles.adminSelect}><option value="">-- Goleador --</option><option value="SG">Sin Goleador (SG)</option>{plantilla.sort((a, b) => a.nombre.localeCompare(b.nombre)).map(jugador => (<option key={jugador.nombre} value={jugador.nombre}>{jugador.dorsal ? `${jugador.dorsal} - ${jugador.nombre}` : jugador.nombre}</option>))}</select>
                <select value={resultado1x2} onChange={(e) => setResultado1x2(e.target.value)} style={styles.adminSelect}><option value="">-- 1X2 --</option><option value="Gana UD Las Palmas">Gana UDLP</option><option value="Empate">Empate</option><option value="Pierde UD Las Palmas">Pierde UDLP</option></select>
                <div><label style={styles.label}>Apertura:</label><input type="datetime-local" value={fechaApertura} onChange={(e) => setFechaApertura(e.target.value)} style={styles.adminInput} /></div>
                <div><label style={styles.label}>Cierre:</label><input type="datetime-local" value={fechaCierre} onChange={(e) => setFechaCierre(e.target.value)} style={styles.adminInput} /></div>
                <div><label style={styles.label}>Partido:</label><input type="datetime-local" value={fechaPartido} onChange={(e) => setFechaPartido(e.target.value)} style={styles.adminInput} /></div>
            </div>
            <div style={{marginTop: '10px'}}><label style={styles.label}>Mensaje Principal:</label><textarea value={splashMessage} onChange={(e) => setSplashMessage(e.target.value)} style={{...styles.input, width: '95%', height: '50px'}} /></div>
            <div style={{marginTop: '10px'}}><label style={styles.label}>URL Imagen Estadio:</label><input type="text" value={estadioImageUrl} onChange={(e) => setEstadioImageUrl(e.target.value)} style={{...styles.input, width: '95%'}} /></div>
            
            <div style={{marginTop: '20px', paddingTop: '15px', borderTop: `1px dashed ${styles.colors.blue}`}}>
                <h4 style={{color: styles.colors.yellow, marginBottom: '15px', textAlign: 'center'}}>Configuración API-Football</h4>
                <div style={styles.adminControls}>
                    <input type="text" value={apiLeagueId} onChange={(e) => setApiLeagueId(e.target.value)} style={styles.adminInput} placeholder="ID Liga" />
                    <input type="text" value={apiLocalTeamId} onChange={(e) => setApiLocalTeamId(e.target.value)} style={styles.adminInput} placeholder="ID Equipo Local" />
                    <input type="text" value={apiVisitorTeamId} onChange={(e) => setApiVisitorTeamId(e.target.value)} style={styles.adminInput} placeholder="ID Equipo Visitante" />
                </div>
            </div>

            <div style={{marginTop: '20px', display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center'}}>
                <button onClick={handleSaveChanges} disabled={isSaving} style={styles.saveButton}>{isSaving ? 'Guardando...' : 'Guardar Cambios'}</button>
                <button onClick={handleCalcularPuntos} disabled={isCalculating || jornada.estado === 'Finalizada'} style={styles.saveButton}>
                    {isCalculating ? 'Calculando...' : 'Calcular Puntos y Cerrar'}
                </button>
                {jornada.estado === 'Finalizada' && (
                    <button onClick={handleRecalcularInsignias} disabled={isCalculating} style={{...styles.saveButton, backgroundColor: styles.colors.blue, color: 'white'}}>
                        {isCalculating ? 'Calculando...' : 'Recalcular Insignias'}
                    </button>
                )}
                <button onClick={handleResetBote} disabled={isSaving} style={{...styles.saveButton, backgroundColor: styles.colors.danger}}>
                    Resetear Bote a 0€
                </button>
            </div>
            {message && <p style={{...styles.message, marginTop: '15px'}}>{message}</p>}
            
            {jornada.estado === 'Cerrada' && (
                <div style={styles.liveAdminContainer}>
                    <h4 style={styles.liveAdminTitle}>🔴 Control del Partido en Vivo</h4>
                    <div style={styles.adminControls}>
                        <div style={styles.resultInputContainer}><input type="number" min="0" value={liveData.golesLocal} onChange={(e) => setLiveData(d => ({ ...d, golesLocal: parseInt(e.target.value) || 0 }))} style={styles.resultInput} /><span style={styles.separator}>-</span><input type="number" min="0" value={liveData.golesVisitante} onChange={(e) => setLiveData(d => ({ ...d, golesVisitante: parseInt(e.target.value) || 0 }))} style={styles.resultInput} /></div>
                        <select value={liveData.ultimoGoleador} onChange={(e) => setLiveData(d => ({...d, ultimoGoleador: e.target.value}))} style={styles.adminSelect}><option value="">-- Goleador en vivo --</option><option value="SG">Sin Goleador (SG)</option>{plantilla.sort((a, b) => a.nombre.localeCompare(b.nombre)).map(jugador => (<option key={jugador.nombre} value={jugador.nombre}>{jugador.dorsal ? `${jugador.dorsal} - ${jugador.nombre}` : jugador.nombre}</option>))}</select>
                    </div>
                    <button onClick={handleUpdateLiveScore} disabled={isSaving} style={{...styles.saveButton, backgroundColor: styles.colors.danger, marginTop: '15px'}}>Actualizar Marcador en Vivo</button>
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
        setJugadores([...jugadores, { ...newJugador, id: Date.now() }]);
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

    const handleCalcularPuntosAnual = async () => {
        if (!config.ascensoFinal || !config.posicionFinal) { alert("Debes establecer el resultado de Ascenso y la Posición Final antes de calcular."); return; }
        if (!window.confirm("¿Seguro que quieres calcular y repartir los puntos de la Porra Anual? Esta acción es irreversible.")) { return; }
        setCalculating(true);
        const pronosticosRef = collection(db, "porraAnualPronosticos");
        const pronosticosSnap = await getDocs(pronosticosRef);
        const pronosticos = pronosticosSnap.docs.map(p => ({ id: p.id, ...p.data() }));
        const batch = writeBatch(db);
        for (const p of pronosticos) {
            let puntosObtenidos = 0;
            const aciertoAscenso = p.ascenso === config.ascensoFinal;
            const aciertoPosicion = parseInt(p.posicion) === parseInt(config.posicionFinal);
            if (aciertoAscenso && aciertoPosicion) { puntosObtenidos = 20; } else if (aciertoAscenso) { puntosObtenidos = 5; } else if (aciertoPosicion) { puntosObtenidos = 10; }
            if (puntosObtenidos > 0) { const clasificacionRef = doc(db, "clasificacion", p.id); batch.update(clasificacionRef, { puntosTotales: increment(puntosObtenidos) }); }
            const pronosticoAnualRef = doc(db, "porraAnualPronosticos", p.id);
            batch.update(pronosticoAnualRef, { puntosObtenidos });
        }
        batch.update(configRef, { estado: "Finalizada" });
        try { await batch.commit(); setMessage("¡Puntos de la Porra Anual calculados y repartidos con éxito!"); } 
        catch (error) { console.error("Error al calcular puntos anuales:", error); setMessage("Error al calcular los puntos."); } 
        finally { setCalculating(false); }
    };

    if (loading) return <LoadingSkeleton />;

    return (
        <div style={styles.adminJornadaItem}>
            <button onClick={onBack} style={styles.backButton}>&larr; Volver al Panel</button>
            <h3 style={styles.formSectionTitle}>Gestión Porra Anual</h3>
            <div style={styles.adminControls}>
                <div><label style={styles.label}>Estado de la Porra</label><select value={config.estado || ''} onChange={(e) => setConfig(c => ({ ...c, estado: e.target.value }))} style={styles.adminSelect}><option value="Inactiva">Inactiva</option><option value="Abierta">Abierta</option><option value="Cerrada">Cerrada</option><option value="Finalizada">Finalizada</option></select></div>
                <div><label style={styles.label}>Fecha Cierre Apuestas</label><input type="datetime-local" value={config.fechaCierre || ''} onChange={(e) => setConfig(c => ({ ...c, fechaCierre: e.target.value }))} style={styles.adminInput} /></div>
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

const AdminStatsRecalculator = ({ onBack }) => {
    const [isRecalculating, setIsRecalculating] = useState(false);
    const [message, setMessage] = useState('');

    const handleRecalculateAllStats = async () => {
        if (!window.confirm("ADVERTENCIA: Esta acción borrará y recalculará TODAS las estadísticas de la clasificación (Puntos Totales, Desglose, Plenos) basándose en las jornadas finalizadas. Es un proceso intensivo y solo debe usarse para corregir datos históricos. ¿Continuar?")) {
            return;
        }
        setIsRecalculating(true);
        setMessage('Iniciando re-cálculo... Este proceso puede tardar.');

        try {
            setMessage('Paso 1/4: Reseteando clasificación...');
            const resetBatch = writeBatch(db);
            for(const player of JUGADORES) {
                const playerRef = doc(db, "clasificacion", player);
                resetBatch.set(playerRef, {
                    puntosTotales: 0, puntosResultadoExacto: 0, puntos1x2: 0, puntosGoleador: 0, plenos: 0,
                }, { merge: true });
            }
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
                
                for(const pronosticoDoc of pronosticosSnap.docs){
                    const p = pronosticoDoc.data();
                    const esVipJornada = jornada.esVip || false;
                    let puntosExacto = 0, puntos1X2 = 0, puntosGoleadorCat = 0;
                    
                    const pLocal = parseInt(p.golesLocal, 10);
                    const pVisitante = parseInt(p.golesVisitante, 10);
                    const rLocal = parseInt(jornada.resultadoLocal, 10);
                    const rVisitante = parseInt(jornada.resultadoVisitante, 10);

                    const aciertoExacto = !isNaN(pLocal) && !isNaN(pVisitante) && pLocal === rLocal && pVisitante === rVisitante;
                    if (aciertoExacto) puntosExacto = esVipJornada ? 6 : 3;

                    const acierto1x2 = p.resultado1x2 === jornada.resultado1x2;
                    if (acierto1x2) puntos1X2 = esVipJornada ? 2 : 1;
                    
                    const goleadorReal = (jornada.goleador || '').trim().toLowerCase();
                    const goleadorApostado = (p.goleador || '').trim().toLowerCase();
                    let aciertoGoleador = false;
                    if (p.sinGoleador && (goleadorReal === "sg" || goleadorReal === "")) { puntosGoleadorCat = 1; aciertoGoleador = true; }
                    else if (!p.sinGoleador && goleadorApostado === goleadorReal && goleadorReal !== "") { puntosGoleadorCat = esVipJornada ? 4 : 2; aciertoGoleador = true; }

                    if (p.jokerActivo && p.jokerPronosticos?.length > 0) {
                        for (const jokerP of p.jokerPronosticos) {
                            if (!isNaN(parseInt(jokerP.golesLocal,10)) && !isNaN(parseInt(jokerP.golesVisitante,10)) && parseInt(jokerP.golesLocal,10) === rLocal && parseInt(jokerP.golesVisitante,10) === rVisitante) {
                                puntosExacto += esVipJornada ? 6 : 3; break;
                            }
                        }
                    }

                    if (statsAccumulator[pronosticoDoc.id]) {
                        statsAccumulator[pronosticoDoc.id].puntosTotales += (puntosExacto + puntos1X2 + puntosGoleadorCat);
                        statsAccumulator[pronosticoDoc.id].puntosResultadoExacto += puntosExacto;
                        statsAccumulator[pronosticoDoc.id].puntos1x2 += puntos1X2;
                        statsAccumulator[pronosticoDoc.id].puntosGoleador += puntosGoleadorCat;
                        if (aciertoExacto && acierto1x2 && aciertoGoleador) {
                            statsAccumulator[pronosticoDoc.id].plenos += 1;
                        }
                    }
                }
            }

            setMessage('Paso 4/4: Guardando nuevos totales...');
            const finalBatch = writeBatch(db);
            for (const jugadorId in statsAccumulator) {
                const userRef = doc(db, "clasificacion", jugadorId);
                finalBatch.update(userRef, statsAccumulator[jugadorId]);
            }
            await finalBatch.commit();
            setMessage('¡Re-cálculo completado con éxito!');

        } catch (error) {
            console.error("Error durante el re-cálculo:", error);
            setMessage(`Error: ${error.message}`);
        } finally {
            setIsRecalculating(false);
        }
    };

    return (
        <div style={styles.adminJornadaItem}>
            <button onClick={onBack} style={styles.backButton}>&larr; Volver al Panel</button>
            <h3 style={styles.formSectionTitle}>⚙️ Herramientas de Datos</h3>
            <div style={{...styles.recalculatorContainer, textAlign: 'center'}}>
                <h4>Recalcular Estadísticas Globales</h4>
                <p style={{margin: '10px 0', lineHeight: 1.5}}>
                    Esta herramienta recalcula todos los puntos (totales y desglosados) y plenos para todos los jugadores basándose en las jornadas ya finalizadas. Úsala si has hecho cambios en la lógica de puntos y necesitas actualizar los datos históricos.
                </p>
                <button onClick={handleRecalculateAllStats} disabled={isRecalculating} style={{...styles.saveButton, backgroundColor: styles.colors.danger}}>
                    {isRecalculating ? 'Recalculando...' : 'Iniciar Re-cálculo Total'}
                </button>
                {message && <p style={{...styles.message, marginTop: '15px'}}>{message}</p>}
            </div>
        </div>
    );
};

const AdminPanelScreen = ({ teamLogos, plantilla, setPlantilla }) => {
    const [jornadas, setJornadas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [adminView, setAdminView] = useState('jornadas');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const q = query(collection(db, "jornadas"), orderBy("numeroJornada", "desc"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            setJornadas(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); setLoading(false);
        }, (error) => { console.error("Error al cargar jornadas: ", error); setLoading(false); });
        return () => unsubscribe();
    }, []);

    const filteredJornadas = useMemo(() => {
        if (!searchTerm) {
            return jornadas;
        }
        return jornadas.filter(j => 
            j.numeroJornada?.toString().includes(searchTerm)
        );
    }, [jornadas, searchTerm]);
    
    const renderAdminContent = () => {
        switch (adminView) {
            case 'jornadas': return (
                <div>
                    <AdminTestJornada />
                    <h3 style={{...styles.title, fontSize: '1.5rem', marginTop: '40px'}}>Gestión de Jornadas</h3>
                    <div style={styles.adminSearchContainer}>
                        <input
                            type="number"
                            placeholder="Buscar por nº de jornada..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={styles.adminSearchInput}
                        />
                    </div>
                    <div style={styles.jornadaList}>
                        {filteredJornadas.length > 0 ? (
                            filteredJornadas.map(jornada => (<JornadaAdminItem key={jornada.id} jornada={jornada} plantilla={plantilla} />))
                        ) : (
                            <p style={{textAlign: 'center'}}>No se encontraron jornadas con ese número.</p>
                        )}
                    </div>
                </div>
            );
            case 'escudos': return <AdminEscudosManager onBack={() => setAdminView('jornadas')} teamLogos={teamLogos} />;
            case 'plantilla': return <AdminPlantillaManager onBack={() => setAdminView('jornadas')} plantilla={plantilla} setPlantilla={setPlantilla} />;
            case 'porraAnual': return <AdminPorraAnual onBack={() => setAdminView('jornadas')} />;
            case 'usuarios': return <AdminUserManager onBack={() => setAdminView('jornadas')} />;
            case 'notificaciones': return <AdminNotifications onBack={() => setAdminView('jornadas')} />;
            case 'herramientas': return <AdminStatsRecalculator onBack={() => setAdminView('jornadas')} />;
            default: return null;
        }
    };

    if (loading) return <LoadingSkeleton />;

    return (
        <div>
            <h2 style={styles.title}>PANEL DE ADMINISTRADOR</h2>
            <div style={styles.adminNav}>
                <button onClick={() => setAdminView('jornadas')} style={adminView === 'jornadas' ? styles.adminNavButtonActive : styles.adminNavButton}>Jornadas</button>
                <button onClick={() => setAdminView('plantilla')} style={adminView === 'plantilla' ? styles.adminNavButtonActive : styles.adminNavButton}>Plantilla</button>
                <button onClick={() => setAdminView('escudos')} style={adminView === 'escudos' ? styles.adminNavButtonActive : styles.adminNavButton}>Escudos</button>
                <button onClick={() => setAdminView('porraAnual')} style={adminView === 'porraAnual' ? styles.adminNavButtonActive : styles.adminNavButton}>Porra Anual</button>
                <button onClick={() => setAdminView('usuarios')} style={adminView === 'usuarios' ? styles.adminNavButtonActive : styles.adminNavButton}>Usuarios</button>
                <button onClick={() => setAdminView('notificaciones')} style={adminView === 'notificaciones' ? styles.adminNavButtonActive : styles.adminNavButton}>Notificaciones</button>
                <button onClick={() => setAdminView('herramientas')} style={adminView === 'herramientas' ? styles.adminNavButtonActive : styles.adminNavButton}>Herramientas</button>
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
    
    const showPronosticos = jornada?.estado === 'Cerrada' || jornada?.estado === 'Finalizada'; 
    const isFinalizada = jornada?.estado === 'Finalizada';
    
    const costeApuesta = jornada?.esVip ? APUESTA_VIP : APUESTA_NORMAL;
    const recaudado = pronosticos.length * costeApuesta;
    const premioTotal = (jornada?.bote || 0) + recaudado;
    const hayGanadores = jornada?.ganadores && jornada.ganadores.length > 0;
    const premioIndividual = hayGanadores ? (premioTotal / jornada.ganadores.length).toFixed(2) : 0;

    return (<div><button onClick={onBack} style={styles.backButton}>&larr; Volver al Calendario</button>{jornada && (<>
        <h2 style={styles.title}>DETALLE {jornada.id === 'jornada_test' ? 'JORNADA DE PRUEBA' : `JORNADA ${jornada.numeroJornada}`}</h2>
        <div style={styles.matchHeader}><TeamDisplay teamLogos={teamLogos} teamName={jornada.equipoLocal} imgStyle={{width: 40, height: 40}} /><h3 style={styles.formSectionTitle}>{jornada.equipoLocal} vs {jornada.equipoVisitante}</h3><TeamDisplay teamLogos={teamLogos} teamName={jornada.equipoVisitante} imgStyle={{width: 40, height: 40}} /></div>
        
        {isFinalizada && (
            <>
                <p style={styles.finalResult}>Resultado Final: {jornada.resultadoLocal} - {jornada.resultadoVisitante}</p>
                 <div style={styles.winnerInfoBox}>
                    {hayGanadores ? (
                        <>
                            <p><strong>🏆 Ganador(es): {jornada.ganadores.join(', ')}</strong></p>
                            <p><strong>Premio por ganador:</strong> {premioIndividual}€</p>
                        </>
                    ) : (
                        <p><strong>💰 ¡BOTE!</strong> El premio de {premioTotal}€ se acumula.</p>
                    )}
                </div>
            </>
        )}
        
        <table style={styles.table}><thead><tr><th style={styles.th}>Jugador</th><th style={styles.th}>Pronóstico</th>{isFinalizada && <th style={styles.th}>Puntos</th>}{isFinalizada && <th style={styles.th}>Pagado</th>}</tr></thead><tbody>{JUGADORES.map((jugadorId, index) => { const p = pronosticosMap[jugadorId]; const profile = userProfiles[jugadorId] || {}; if (!p) { return (<tr key={jugadorId} style={styles.tr}><td style={styles.td}><PlayerProfileDisplay name={jugadorId} profile={profile} /></td><td colSpan={isFinalizada ? 3 : 1} style={{...styles.td, fontStyle: 'italic', opacity: 0.6, textAlign: 'center' }}>SP</td></tr>); } if (showPronosticos) { const esGanador = jornada.ganadores?.includes(p.id); return (<React.Fragment key={p.id}><tr style={esGanador ? styles.winnerRow : styles.tr}><td style={styles.td}><PlayerProfileDisplay name={p.id} profile={profile} /> {p.jokerActivo && '🃏'}</td><td style={styles.td}>{p.golesLocal}-{p.golesVisitante} ({p.resultado1x2 || 'N/A'}) {p.goleador && `- ${p.goleador}`} {!p.goleador && p.sinGoleador && '- SG'}</td>{isFinalizada && <td style={styles.td}>{p.puntosObtenidos === undefined ? '-' : p.puntosObtenidos}</td>}{isFinalizada && <td style={styles.td}>{p.pagado ? '✅' : '❌'}</td>}</tr>{p.jokerActivo && p.jokerPronosticos?.length > 0 && (<tr style={styles.jokerDetailRow}><td style={styles.td} colSpan={isFinalizada ? 4 : 2}><div style={{paddingLeft: '20px'}}><strong>Apuestas JOKER:</strong><div style={{display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '5px'}}>{p.jokerPronosticos.map((jp, index) => (<span key={index} style={styles.jokerDetailChip}>{jp.golesLocal}-{jp.golesVisitante}</span>))}</div></div></td></tr>)}</React.Fragment>); } else { const secretMessage = SECRET_MESSAGES[index % SECRET_MESSAGES.length]; return (<tr key={p.id} style={styles.tr}><td style={styles.td}><PlayerProfileDisplay name={p.id} profile={profile} /> {p.jokerActivo && '🃏'}</td><td style={styles.td}>{secretMessage}</td></tr>); } })}</tbody></table>
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

                const proximaJornadaAbierta = jornadasConPronosticos.find(j => j.estado === 'Abierta' || j.estado === 'Pre-apertura');
                const boteActual = proximaJornadaAbierta?.bote || 0;
                
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

    return (<div><h2 style={styles.title}>LIBRO DE CUENTAS</h2><div style={styles.statsGrid}><div style={styles.statCard}><div style={styles.statValue}>💰 {financialSummary.boteActual.toFixed(2)}€</div><div style={styles.statLabel}>Bote Actual</div></div><div style={styles.statCard}><div style={styles.statValue}>📥 {financialSummary.totalRecaudado.toFixed(2)}€</div><div style={styles.statLabel}>Total Recaudado</div></div><div style={styles.statCard}><div style={styles.statValue}>📤 {financialSummary.totalRepartido.toFixed(2)}€</div><div style={styles.statLabel}>Total Repartido</div></div></div>
    
    <div style={styles.debtSummaryContainer}>
        <h3 style={styles.formSectionTitle}>Estado de Cuentas por Jugador</h3>
        <div style={styles.debtGrid}>
            {Object.entries(debtSummary).sort(([,a],[,b]) => b-a).map(([jugador, deuda]) => (
                <div key={jugador} style={deuda > 0 ? styles.debtItemOwes : styles.debtItemPaid}>
                    <PlayerProfileDisplay name={jugador} profile={userProfiles[jugador]} />
                    <span>{deuda.toFixed(2)}€</span>
                </div>
            ))}
        </div>
    </div>

    <div style={{marginTop: '40px'}}>{jornadas.filter(j => j.pronosticos && j.pronosticos.length > 0).reverse().map(jornada => (<div key={jornada.id} style={styles.pagoCard}><h4 style={styles.pagoCardTitle}>Jornada {jornada.numeroJornada}: {jornada.equipoLocal} vs {jornada.equipoVisitante}</h4><div style={styles.pagoCardDetails}><span><strong>Recaudado:</strong> {jornada.recaudadoJornada}€</span><span><strong>Bote Anterior:</strong> {jornada.bote || 0}€</span><span><strong>Premio Total:</strong> {jornada.premioTotal}€</span></div>{jornada.ganadores && jornada.ganadores.length > 0 ? (<div style={styles.pagoCardWinnerInfo}><p><strong>🏆 Ganador(es):</strong> {jornada.ganadores.join(', ')}</p><p><strong>Premio por ganador:</strong> {(jornada.premioTotal / jornada.ganadores.length).toFixed(2)}€</p></div>) : (<div style={styles.pagoCardBoteInfo}>{jornada.estado === 'Finalizada' ? '¡BOTE! El premio se acumula' : 'Premio por determinar'}</div>)}<table style={{...styles.table, marginTop: '15px'}}><thead><tr><th style={styles.th}>Jugador</th><th style={styles.th}>Aportación</th>{jornada.ganadores && jornada.ganadores.length > 0 && <th style={styles.th}>Premio Cobrado</th>}</tr></thead><tbody>{jornada.pronosticos.map(p => { const esGanador = jornada.ganadores?.includes(p.id); return (<tr key={p.id} style={styles.tr}><td style={styles.td}><PlayerProfileDisplay name={p.id} profile={userProfiles[p.id]} /></td><td style={styles.td}><input type="checkbox" checked={p.pagado || false} onChange={(e) => handlePagoChange(jornada.id, p.id, e.target.checked)} disabled={user !== 'Juanma'} style={styles.checkbox}/></td>{esGanador && (<td style={styles.td}><input type="checkbox" checked={p.premioCobrado || false} onChange={(e) => handlePremioCobradoChange(jornada.id, p.id, e.target.checked)} disabled={user !== 'Juanma'} style={styles.checkbox}/></td>)}</tr>); })}</tbody></table></div>))}</div></div>);
};

const PorraAnualScreen = ({ user, onBack, config }) => {
    const [pronostico, setPronostico] = useState({ ascenso: '', posicion: '' });
    const [miPronostico, setMiPronostico] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState({text: '', type: 'info'});
    const [loading, setLoading] = useState(true);
    const [countdown, setCountdown] = useState('');

    const fechaCierrePorraAnual = useMemo(() => {
        return new Date('2025-09-15T21:00:00');
    }, []);

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
        if (!config) return;
        const targetDate = fechaCierrePorraAnual;
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
            const s = Math.floor((diff % (1000 * 60)) / 1000);
            setCountdown(`${d}d ${h}h ${m}m ${s}s`);
        }, 1000);
        return () => clearInterval(interval);
    }, [config, fechaCierrePorraAnual]);

    const handleGuardar = async (e) => {
        e.preventDefault();
        if (!pronostico.ascenso || !pronostico.posicion) {
            setMessage({text: "Debes rellenar ambos campos.", type: 'error'});
            return;
        }
        setIsSaving(true);
        const pronosticoRef = doc(db, "porraAnualPronosticos", user);
        try {
            const dataToSave = { ...pronostico, jugador: user, lastUpdated: new Date() };
            await setDoc(pronosticoRef, dataToSave);
            setMessage({text: "¡Tu pronóstico anual ha sido guardado!", type: 'success'});
            setMiPronostico(dataToSave);

        } catch (error) {
            console.error("Error al guardar pronóstico anual:", error);
            setMessage({text: "Hubo un error al guardar tu pronóstico.", type: 'error'});
        }
        setIsSaving(false);
    };

    if (loading) return <LoadingSkeleton />;

    const isClosed = new Date() > fechaCierrePorraAnual;

    if (isClosed) {
        return (
            <div>
                <button onClick={onBack} style={styles.backButton}>&larr; Volver</button>
                <h2 style={styles.title}>⭐ PORRA ANUAL ⭐</h2>
                <div style={styles.placeholder}>
                    <h3>Las apuestas para la Porra Anual están CERRADAS.</h3>
                    {miPronostico ? (
                        <div style={{marginTop: '20px'}}>
                            <h4>Tu Apuesta Final Guardada:</h4>
                            <p><strong>¿Asciende?:</strong> {miPronostico.ascenso}</p>
                            <p><strong>Posición Final:</strong> {miPronostico.posicion}º</p>
                        </div>
                    ) : (
                       <p style={{marginTop: '20px'}}>No realizaste ninguna apuesta para la porra anual.</p>
                    )}
                     <p style={{ marginTop: '20px', fontStyle: 'italic' }}>¡Mucha suerte a todos!</p>
                </div>
            </div>
        );
    }
    
    return (
        <div>
            <button onClick={onBack} style={styles.backButton}>&larr; Volver</button>
            <h2 style={styles.title}>⭐ PORRA ANUAL ⭐</h2>
            <form onSubmit={handleGuardar} style={styles.form}>
                <div style={styles.porraAnualInfoBox}>
                    <p style={{fontWeight: 'bold', color: styles.colors.warning}}>¡ÚLTIMA OPORTUNIDAD!</p>
                    <p style={styles.porraAnualCountdown}>El plazo termina en: {countdown}</p>
                </div>

                {miPronostico && (
                     <div style={styles.currentBetReminder}>
                        <h4>Tu apuesta actual:</h4>
                        <p><strong>¿Asciende?:</strong> {miPronostico.ascenso} | <strong>Posición:</strong> {miPronostico.posicion}º</p>
                        <small>Puedes cambiarla hasta la fecha de cierre.</small>
                    </div>
                )}
               
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
                    {isSaving ? 'GUARDANDO...' : 'GUARDAR PRONÓSTICO'}
                </button>
                {message.text && <p style={{...styles.message, backgroundColor: message.type === 'success' ? styles.colors.success : colors.colors.danger}}>{message.text}</p>}
            </form>
        </div>
    );
};

const ProfileCustomizationScreen = ({ user, onSave, userProfile }) => {
    const [selectedColor, setSelectedColor] = useState(userProfile.color || PROFILE_COLORS[0]); const [selectedIcon, setSelectedIcon] = useState(userProfile.icon || PROFILE_ICONS[0]); const [isSaving, setIsSaving] = useState(false);
    const handleSave = async () => { setIsSaving(true); await onSave(user, { color: selectedColor, icon: selectedIcon }); };
    return (<div style={styles.profileCustomizationContainer}><h2 style={styles.title}>¡BIENVENIDO, {user}!</h2><p style={{textAlign: 'center', marginBottom: '30px', fontSize: '1.1rem'}}>Personaliza tu perfil para que todos te reconozcan.</p><div style={styles.formGroup}><label style={styles.label}>1. ELIGE TU COLOR</label><div style={styles.colorGrid}>{PROFILE_COLORS.map(color => { const isGradient = typeof color === 'string' && color.startsWith('linear-gradient'); const style = { ...styles.colorOption, ...(isGradient ? { background: color } : { backgroundColor: color }), ...(selectedColor === color ? styles.colorOptionSelected : {}) }; return (<div key={color} style={style} onClick={() => setSelectedColor(color)} />); })}</div></div><div style={styles.formGroup}><label style={styles.label}>2. ELIGE TU ICONO</label><div style={styles.iconGrid}>{PROFILE_ICONS.map(icon => (<div key={icon} style={{...styles.iconOption, ...(selectedIcon === icon ? styles.iconOptionSelected : {})}} onClick={() => setSelectedIcon(icon)}>{icon}</div>))}</div></div><div style={{textAlign: 'center', marginTop: '40px'}}><p style={{fontSize: '1.2rem', marginBottom: '10px'}}>Así se verá tu perfil:</p><PlayerProfileDisplay name={user} profile={{ color: selectedColor, icon: selectedIcon }} style={styles.profilePreview} /></div><button onClick={handleSave} disabled={isSaving} style={{...styles.mainButton, width: '100%'}}>{isSaving ? 'GUARDANDO...' : 'GUARDAR Y ENTRAR'}</button></div>);
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
            
            const goleadores = pronosticos.map(p => p.goleador).filter(Boolean);
            const goleadorCounts = goleadores.reduce((acc, val) => ({...acc, [val]: (acc[val] || 0) + 1}), {});
            const goleadorFavorito = Object.keys(goleadorCounts).length > 0 ? Object.entries(goleadorCounts).sort((a,b) => b[1] - a[1])[0][0] : '-';

            let rachaPuntuando = 0;
            const pronosticosOrdenados = pronosticos.sort((a,b) => b.numeroJornada - a.numeroJornada);
            for (const p of pronosticosOrdenados) {
                if (p.puntosObtenidos > 0) { rachaPuntuando++; } else { break; }
            }
            
            const userStats = await getDoc(doc(db, "clasificacion", user));
            const plenos = userStats.exists() ? userStats.data().plenos || 0 : 0;

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
  const anonymousUserRef = useRef(null);
  
  const fechaCierrePorraAnual = useMemo(() => new Date('2025-09-15T21:00:00'), []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => { 
        if (user && !user.isAnonymous) setIsAdminAuthenticated(true);
        else if (user && user.isAnonymous) { anonymousUserRef.current = user; setIsAdminAuthenticated(false); }
        else signInAnonymously(auth).catch((error) => console.error("Error de autenticación anónima:", error));
    });
    const styleSheet = document.createElement("style"); 
    const colors = styles.colors;
    styleSheet.innerText = `
        @import url('https://fonts.googleapis.com/css2?family=Teko:wght@700&family=Orbitron&family=Exo+2&family=Russo+One&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { font-size: 16px !important; -webkit-text-size-adjust: 100%; }
        body, #root { width: 100%; min-width: 100%; overflow-x: hidden; }
        @keyframes gold-leader-animation { 0%, 100% { box-shadow: 0 0 8px ${colors.gold}, 0 0 15px ${colors.gold}, 0 0 25px ${colors.gold}80; } 50% { box-shadow: 0 0 15px ${colors.gold}, 0 0 30px ${colors.gold}, 0 0 45px ${colors.gold}80; } }
        @keyframes fire-streak-animation { 0%, 100% { box-shadow: 0 0 8px #fca311, 0 0 15px #e63946, 0 0 25px #fca31180; } 50% { box-shadow: 0 0 15px #fca311, 0 0 30px #e63946, 0 0 45px #fca31180; } }
        @keyframes cold-streak-animation { 0%, 100% { box-shadow: 0 0 8px #00aaff, 0 0 15px #00aaff, 0 0 20px #00aaff80; } }
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
        @keyframes leader-glow { 0%, 100% { background-color: rgba(255, 215, 0, 0.15); box-shadow: inset 0 0 15px rgba(255, 215, 0, 0.5), 0 0 10px rgba(255, 215, 0, 0.3); } 50% { background-color: rgba(255, 215, 0, 0.25); box-shadow: inset 0 0 20px rgba(255, 215, 0, 0.7), 0 0 15px rgba(255, 215, 0, 0.5); } }
        @keyframes silver-glow { 0%, 100% { background-color: rgba(192, 192, 192, 0.15); box-shadow: inset 0 0 15px rgba(192, 192, 192, 0.5), 0 0 10px rgba(192, 192, 192, 0.3); } 50% { background-color: rgba(192, 192, 192, 0.25); box-shadow: inset 0 0 20px rgba(192, 192, 192, 0.7), 0 0 15px rgba(192, 192, 192, 0.5); } }
        @keyframes bronze-glow { 0%, 100% { background-color: rgba(205, 127, 50, 0.15); box-shadow: inset 0 0 15px rgba(205, 127, 50, 0.5), 0 0 10px rgba(205, 127, 50, 0.3); } 50% { background-color: rgba(205, 127, 50, 0.25); box-shadow: inset 0 0 20px rgba(205, 127, 50, 0.7), 0 0 15px rgba(205, 127, 50, 0.5); } }
        @keyframes user-highlight-glow { 0%, 100% { background-color: rgba(0, 85, 164, 0.5); box-shadow: inset 0 0 15px rgba(0, 85, 164, 1), 0 0 10px rgba(0, 85, 164, 0.7); } 50% { background-color: rgba(0, 85, 164, 0.7); box-shadow: inset 0 0 20px rgba(0, 85, 164, 1), 0 0 15px rgba(0, 85, 164, 1); } }
        @keyframes last-chance-glow { 0%, 100% { box-shadow: 0 0 15px ${colors.danger}, 0 0 25px ${colors.danger}; background-color: ${colors.danger};} 50% { box-shadow: 0 0 25px ${colors.danger}80, 0 0 40px ${colors.danger}80; background-color: #a11d27;} }
    `;
    document.head.appendChild(styleSheet);
    const configRef = doc(db, "configuracion", "porraAnual"); const unsubscribeConfig = onSnapshot(configRef, (doc) => { setPorraAnualConfig(doc.exists() ? doc.data() : null); });
    const escudosRef = doc(db, "configuracion", "escudos"); const unsubscribeEscudos = onSnapshot(escudosRef, (docSnap) => { if (docSnap.exists()) { setTeamLogos(docSnap.data()); } });
    const qLive = query(collection(db, "jornadas"), where("liveData.isLive", "==", true), limit(1)); const unsubscribeLive = onSnapshot(qLive, (snapshot) => { if (!snapshot.empty) { const jornada = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() }; setLiveJornada(jornada); } else { setLiveJornada(null); } });
    const plantillaRef = doc(db, "configuracion", "plantilla"); const unsubscribePlantilla = onSnapshot(plantillaRef, (docSnap) => { if (docSnap.exists() && docSnap.data().jugadores?.length > 0) { setPlantilla(docSnap.data().jugadores); } else { console.log("Plantilla no encontrada en Firebase, usando respaldo local."); } });
    
    const unsubscribeProfiles = onSnapshot(collection(db, "clasificacion"), (snapshot) => {
        const profiles = {};
        snapshot.forEach(doc => {
            profiles[doc.id] = doc.data();
        });
        setUserProfiles(profiles);
    });

    const statusRef = ref(rtdb, 'status/'); const unsubscribeStatus = onValue(statusRef, (snapshot) => { const data = snapshot.val(); setOnlineUsers(data || {}); });
    return () => { document.head.removeChild(styleSheet); unsubscribeConfig(); unsubscribeAuth(); unsubscribeEscudos(); unsubscribeLive(); unsubscribePlantilla(); unsubscribeProfiles(); unsubscribeStatus(); }
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
    if (screen === 'splash') return <SplashScreen onEnter={() => setScreen('login')} teamLogos={teamLogos} plantilla={plantilla} />;
    if (screen === 'login') return <LoginScreen onLogin={handleLogin} userProfiles={userProfiles} onlineUsers={onlineUsers} />;
    if (screen === 'customizeProfile') return <ProfileCustomizationScreen user={currentUser} onSave={handleSaveProfile} userProfile={userProfiles[currentUser] || {}} />;
    if (screen === 'app') {
        const isLive = liveJornada?.liveData?.isLive;
        const onlineCount = Object.values(onlineUsers).filter(Boolean).length;
        const showGreenStatus = !isLive && onlineCount > 1;

        const isPorraAnualOpen = porraAnualConfig?.estado === 'Abierta' && new Date() < fechaCierrePorraAnual;

        const CurrentScreen = () => {
            if (viewingJornadaId) return <JornadaDetalleScreen jornadaId={viewingJornadaId} onBack={() => setViewingJornadaId(null)} teamLogos={teamLogos} userProfiles={userProfiles} />;
            if (viewingPorraAnual) return <PorraAnualScreen user={currentUser} onBack={() => setViewingPorraAnual(false)} config={porraAnualConfig} />;
            if (activeTab === 'profile') return <ProfileScreen user={currentUser} userProfile={userProfiles[currentUser]} onEdit={() => setScreen('customizeProfile')} onBack={() => setActiveTab('miJornada')} />;
            switch (activeTab) {
                case 'miJornada': return <MiJornadaScreen user={currentUser} setActiveTab={handleNavClick} teamLogos={teamLogos} liveData={liveJornada?.liveData} plantilla={plantilla} userProfiles={userProfiles} />;
                case 'laJornada': return <LaJornadaScreen user={currentUser} teamLogos={teamLogos} liveData={liveJornada?.liveData} userProfiles={userProfiles} onlineUsers={onlineUsers} />;
                case 'calendario': return <CalendarioScreen onViewJornada={setViewingJornadaId} teamLogos={teamLogos} />;
                case 'clasificacion': return <ClasificacionScreen currentUser={currentUser} liveData={liveJornada?.liveData} liveJornada={liveJornada} userProfiles={userProfiles} />;
                case 'pagos': return <PagosScreen user={currentUser} userProfiles={userProfiles} />;
                case 'admin': return isAdminAuthenticated ? <AdminPanelScreen teamLogos={teamLogos} plantilla={plantilla} setPlantilla={setPlantilla} /> : null;
                default: return null;
            }
        };
      return (<>{showAdminLogin && <AdminLoginModal onClose={() => setShowAdminLogin(false)} onSuccess={handleAdminLoginSuccess} />}{showNotificationModal && <NotificationPermissionModal onAllow={() => handleRequestPermission(currentUser)} onDeny={() => {setShowNotificationModal(false); localStorage.setItem('notificationPrompt_v3_seen', 'true');}} />}
      {isPorraAnualOpen && !viewingPorraAnual && (<div style={styles.porraAnualBannerLastChance} onClick={() => setViewingPorraAnual(true)}>⭐ ¡ÚLTIMA OPORTUNIDAD PORRA ANUAL! ⭐ ¡El plazo termina pronto!</div>)}
      <LiveBanner liveData={liveJornada?.liveData} jornada={liveJornada} />
      <nav style={styles.navbar}>
        <button onClick={() => handleNavClick('miJornada')} style={activeTab === 'miJornada' ? styles.navButtonActive : styles.navButton}>Mi Jornada</button>
        <button onClick={() => handleNavClick('laJornada')} style={activeTab === 'laJornada' ? styles.navButtonActive : styles.navButton}>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                {isLive && <span style={styles.statusIndicatorRed}></span>}
                {showGreenStatus && <span style={styles.statusIndicatorGreen}></span>}
                La Jornada
            </div>
        </button>
        <button onClick={() => handleNavClick('calendario')} style={activeTab === 'calendario' ? styles.navButtonActive : styles.navButton}>Calendario</button>
        <button onClick={() => handleNavClick('clasificacion')} style={activeTab === 'clasificacion' ? styles.navButtonActive : styles.navButton}>Clasificación</button>
        <button onClick={() => handleNavClick('pagos')} style={activeTab === 'pagos' ? styles.navButtonActive : styles.navButton}>Pagos</button>
        {currentUser === 'Juanma' && (<button onClick={handleAdminClick} style={activeTab === 'admin' ? styles.navButtonActive : styles.navButton}>Admin</button>)}
        <button onClick={() => handleNavClick('profile')} style={styles.profileNavButton}><PlayerProfileDisplay name={currentUser} profile={userProfiles[currentUser]} /></button>
        <button onClick={handleLogout} style={styles.logoutButton}>Salir</button>
      </nav>
      <div key={activeTab} className="content-enter-active" style={styles.content}><CurrentScreen /></div></>);
    }
  };
  return (<>{winnerData && <WinnerAnimation winnerData={winnerData} onClose={() => setWinnerData(null)} />}<div id="app-container" style={styles.container}><div style={styles.card}>{renderContent()}</div></div></>);
}

const colors = {
    deepBlue: '#001d3d', blue: '#0055A4', yellow: '#FFC72C', gold: '#FFD700', silver: '#C0C0C0', bronze: '#CD7F32', lightText: '#f0f0f0', darkText: '#0a0a0a', danger: '#e63946', success: '#52b788', warning: '#fca311', darkUI: 'rgba(10, 25, 47, 0.85)', darkUIAlt: 'rgba(23, 42, 69, 0.85)', status: { 'Próximamente': '#6c757d', 'Pre-apertura': '#fca311', 'Abierta': '#52b788', 'Cerrada': '#e63946', 'Finalizada': '#0055A4' }
};

const styles = {
    colors,
    container: { display: 'flex', justifyContent: 'center', alignItems: 'flex-start', width: '100%', minHeight: '100dvh', background: `linear-gradient(145deg, ${colors.deepBlue} 0%, #000 100%)`, padding: '15px', fontFamily: "'Exo 2', sans-serif" },
    card: { width: '100%', maxWidth: '900px', backgroundColor: colors.darkUI, color: colors.lightText, padding: '25px', borderRadius: '16px', boxShadow: `0 0 25px ${colors.blue}30, 0 10px 30px rgba(0, 0, 0, 0.5)`, minHeight: 'calc(100dvh - 30px)', border: `1px solid ${colors.blue}80`, backdropFilter: 'blur(10px)', },
    title: { fontFamily: "'Orbitron', sans-serif", color: colors.yellow, textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center', borderBottom: `2px solid ${colors.yellow}`, paddingBottom: '10px', marginBottom: '25px', textShadow: `0 0 10px ${colors.yellow}90`, fontSize: 'clamp(1.5rem, 5vw, 1.8rem)' },
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
    navbar: { display: 'flex', flexWrap: 'wrap', gap: '5px', borderBottom: `2px solid ${colors.blue}`, paddingBottom: '15px', marginBottom: '20px', alignItems: 'center' },
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
    adminControls: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', margin: '15px 0', alignItems: 'center' },
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
    resumenJugadorTitle: { margin: '0 0 10px 0', paddingBottom: '10px', borderBottom: `1px solid ${colors.blue}80`, fontFamily: "'Orbitron', sans-serif", },
    resumenJugadorBets: { fontSize: '0.95rem' },
    jokerChipsContainer: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' },
    pinReminder: { display: 'block', fontSize: '0.8rem', color: colors.warning, marginTop: '10px', fontStyle: 'italic' },
    statsIndicator: { display: 'block', textAlign: 'center', marginTop: '10px', fontWeight: 'bold' },
    jokerAnimationOverlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', overflow: 'hidden', zIndex: 9999, pointerEvents: 'none', backdropFilter: 'blur(3px) brightness(0.7)', transition: 'backdrop-filter 0.5s ease' },
    jokerIcon: { position: 'absolute', top: '-50px', animationName: 'fall', animationTimingFunction: 'linear', animationIterationCount: '1' },
    porraAnualBannerLastChance: { background: `linear-gradient(45deg, ${colors.danger}, ${colors.warning})`, color: colors.lightText, fontWeight: 'bold', padding: '15px', borderRadius: '8px', textAlign: 'center', marginBottom: '20px', fontSize: '1rem', fontFamily: "'Orbitron', sans-serif", cursor: 'pointer', animation: 'last-chance-glow 2s infinite' },
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
    legendItem: { display: 'flex', alignItems: 'center', gap: '8px' },
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
    adminNavButtonActive: { backgroundColor: colors.blue, color: colors.lightText, border: `2px solid ${colors.yellow}` },
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
    adminSearchContainer: { marginBottom: '20px' },
    adminSearchInput: { width: '100%', padding: '12px', border: `1px solid ${colors.blue}`, borderRadius: '6px', backgroundColor: colors.deepBlue, color: colors.lightText, fontSize: '1rem' },
    currentBetReminder: { backgroundColor: 'rgba(0, 85, 164, 0.3)', padding: '15px', borderRadius: '8px', margin: '20px 0', textAlign: 'center', border: `1px solid ${colors.blue}` },
    winnerInfoBox: {
        backgroundColor: `${colors.gold}20`,
        border: `1px solid ${colors.gold}`,
        borderRadius: '8px',
        padding: '15px',
        margin: '20px 0',
        textAlign: 'center',
        lineHeight: 1.6
    }
};

export default App;

