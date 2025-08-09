import React, { useState, useEffect, useMemo, useRef } from 'react';
// Importamos las funciones necesarias de Firebase
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, doc, getDocs, onSnapshot, query, where, limit, writeBatch, updateDoc, orderBy, setDoc, getDoc, increment, deleteDoc } from "firebase/firestore";

// --- CONFIGURACIÓN DE FIREBASE (sin cambios) ---
const firebaseConfig = {
    apiKey: "AIzaSyDyxwLEkH36_7uXNeBYayIwZYI8IuAsDm4",
    authDomain: "porra-udlp-2026-v2.firebaseapp.com",
    projectId: "porra-udlp-2026-v2",
    storageBucket: "porra-udlp-2026-v2.appspot.com",
    messagingSenderId: "611441868159",
    appId: "1:611441868159:web:13008731a05c4321946e4a",
    measurementId: "G-J9T3S8SZT6"
};

// --- INICIALIZACIÓN DE FIREBASE ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- DATOS DE LA APLICACIÓN ---
const JUGADORES = ["Juanma", "Lucy", "Antonio", "Mari", "Pedro", "Pedrito", "Himar", "Sarito", "Vicky", "Carmelo", "Laura", "Carlos", "José", "Claudio", "Javi"];
const ADMIN_PASSWORD = "porra2026lpa";
const APUESTA_NORMAL = 1;
const APUESTA_VIP = 2;
const SECRET_MESSAGES = [
    "Pronóstico Secreto 🤫", "Aquí huele a BOTE...", "Voy a ganar yo 😎", "Top Secret",
    "Clasificado ⭐", "Me lo guardo para mí", "Jugada Maestra en proceso...", "Ni el VAR lo sabe",
    "Consultando con el Oráculo", "Shhh... es un secreto", "Apuesta Fantasma 👻",
    "Resultado 'Confidencial'", "Cargando... 99%", "El que lo sabe, lo sabe", "Mejor no digo nada..."
];

const EQUIPOS_LIGA = [
    "UD Las Palmas", "FC Andorra", "Córdoba CF", "Málaga CF", "Burgos CF", 
    "Real Sociedad B", "CD Leganés", "UD Almería", "Cádiz CF", "Granada CF", 
    "SD Eibar", "SD Huesca", "Real Sporting de Gijón", "Real Racing Club", 
    "Real Valladolid CF", "Albacete Balompié", "CD Castellón", "CD Mirandés", 
    "AD Ceuta FC", "CyD Leonesa", "Real Zaragoza", "RC Deportivo"
];

// ============================================================================
// --- LÓGICA DE CÁLCULO DE PUNTOS PROVISIONALES ---
// ============================================================================
const calculateProvisionalPoints = (pronostico, liveData, jornada) => {
    if (!pronostico || !liveData || !jornada) return 0;

    let puntosJornada = 0;
    const esVip = jornada.esVip || false;
    const resultadoLocal = liveData.golesLocal;
    const resultadoVisitante = liveData.golesVisitante;

    // Acierto Resultado Exacto
    if (pronostico.golesLocal !== '' && pronostico.golesVisitante !== '' && parseInt(pronostico.golesLocal) === resultadoLocal && parseInt(pronostico.golesVisitante) === resultadoVisitante) {
        puntosJornada += esVip ? 6 : 3;
    }

    // Acierto 1X2
    let resultado1x2Real = '';
    if (jornada.equipoLocal === "UD Las Palmas") {
        if (resultadoLocal > resultadoVisitante) resultado1x2Real = 'Gana UD Las Palmas';
        else if (resultadoLocal < resultadoVisitante) resultado1x2Real = 'Pierde UD Las Palmas';
        else resultado1x2Real = 'Empate';
    } else { // UD Las Palmas es visitante
        if (resultadoVisitante > resultadoLocal) resultado1x2Real = 'Gana UD Las Palmas';
        else if (resultadoVisitante < resultadoLocal) resultado1x2Real = 'Pierde UD Las Palmas';
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
    if (pronostico.jokerActivo && pronostico.jokerPronosticos && pronostico.jokerPronosticos.length > 0) {
        for (const jokerP of pronostico.jokerPronosticos) {
            if (jokerP.golesLocal !== '' && jokerP.golesVisitante !== '' && parseInt(jokerP.golesLocal) === resultadoLocal && parseInt(jokerP.golesVisitante) === resultadoVisitante) {
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

const LiveBanner = ({ liveData, jornada }) => {
    if (!jornada || !liveData || !liveData.isLive) return null;
    return (
        <div style={styles.liveBanner}>
            <span style={styles.liveIndicator}>🔴 EN VIVO</span>
            <span style={styles.liveMatchInfo}>
                {jornada.equipoLocal} <strong>{liveData.golesLocal} - {liveData.golesVisitante}</strong> {jornada.equipoVisitante}
            </span>
            {liveData.ultimoGoleador && <span style={styles.liveGoalScorer}>Último Gol: {liveData.ultimoGoleador}</span>}
        </div>
    );
};

const TeamDisplay = ({ teamLogos, teamName, shortName = false, imgStyle }) => (
    <div style={styles.teamDisplay}>
        <img src={teamLogos[teamName] || 'https://placehold.co/50x50/1b263b/e0e1dd?text=?'} style={{...styles.teamLogo, ...imgStyle}} alt={`${teamName} logo`} onError={(e) => { e.target.src = 'https://placehold.co/50x50/1b263b/e0e1dd?text=?'; }} />
        <span style={styles.teamNameText}>{shortName && teamName === "UD Las Palmas" ? "UDLP" : teamName}</span>
    </div>
);

const JokerAnimation = () => {
    const [exploded, setExploded] = useState(false);
    useEffect(() => {
        const timer = setTimeout(() => setExploded(true), 5500);
        return () => clearTimeout(timer);
    }, []);
    const jokers = Array.from({ length: 80 });
    return (
        <div style={styles.jokerAnimationOverlay}>
            {jokers.map((_, i) => (
                <span key={i} className={exploded ? 'exploded' : ''} style={{
                    ...styles.jokerIcon, left: `${Math.random() * 100}vw`, animationDelay: `${Math.random() * 4}s`, animationDuration: `${3 + Math.random() * 3}s`,
                    transform: exploded ? `translate(${Math.random() * 800 - 400}px, ${Math.random() * 800 - 400}px) rotate(720deg)` : 'translateY(-100px) rotate(0deg)',
                    opacity: exploded ? 0 : 1
                }}>🃏</span>
            ))}
        </div>
    );
};

const Confetti = () => {
    const particles = Array.from({ length: 150 });
    return (
        <div style={styles.confettiOverlay}>
            {particles.map((_, i) => (
                <div key={i} className="confetti-particle" style={{
                    '--x': `${Math.random() * 100}vw`,
                    '--angle': `${Math.random() * 360}deg`,
                    '--delay': `${Math.random() * 5}s`,
                    '--color': i % 2 === 0 ? styles.colors.yellow : styles.colors.blue,
                }} />
            ))}
        </div>
    );
};

const WinnerAnimation = ({ winnerData, onClose }) => {
    const { pronostico, prize } = winnerData;
    return (
        <div style={styles.winnerAnimationOverlay}>
            <Confetti />
            <div style={styles.winnerModal}>
                <div style={styles.trophy}>🏆</div>
                <h2 style={styles.winnerTitle}>¡FELICIDADES, {pronostico.id}!</h2>
                <p style={styles.winnerText}>¡Has ganado la porra de la jornada!</p>
                <div style={styles.winnerStats}>
                    <span>Puntos Obtenidos: <strong>{pronostico.puntosObtenidos}</strong></span>
                    <span>Premio: <strong>{prize.toFixed(2)}€</strong></span>
                </div>
                <button onClick={onClose} style={{...styles.mainButton, marginTop: '30px'}}>CERRAR</button>
            </div>
        </div>
    );
};

const InstallGuideModal = ({ onClose }) => {
    return (
        <div style={styles.modalOverlay} onClick={onClose}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <h3 style={styles.title}>Instalar App</h3>
                <div style={styles.installInstructions}>
                    <div style={styles.installSection}>
                        <h4>iPhone (Safari)</h4>
                        <ol>
                            <li>Pulsa el botón de <strong>Compartir</strong> (un cuadrado con una flecha hacia arriba).</li>
                            <li>Busca y pulsa en <strong>"Añadir a pantalla de inicio"</strong>.</li>
                            <li>¡Listo! Ya tienes la app en tu móvil.</li>
                        </ol>
                    </div>
                    <div style={styles.installSection}>
                        <h4>Android (Chrome)</h4>
                        <ol>
                            <li>Pulsa el botón de <strong>Menú</strong> (tres puntos verticales).</li>
                            <li>Busca y pulsa en <strong>"Instalar aplicación"</strong> o "Añadir a pantalla de inicio".</li>
                            <li>¡Listo! Ya tienes la app en tu móvil.</li>
                        </ol>
                    </div>
                </div>
                <button onClick={onClose} style={styles.mainButton}>Entendido</button>
            </div>
        </div>
    );
};

// ============================================================================
// --- COMPONENTES DE LAS PANTALLAS ---
// ============================================================================

const InitialSplashScreen = ({ onFinish, teamLogos }) => {
    const [isPortrait, setIsPortrait] = useState(window.matchMedia("(orientation: portrait)").matches);

    useEffect(() => {
        const timer = setTimeout(() => onFinish(), 4000);
        const mediaQuery = window.matchMedia("(orientation: portrait)");
        const handleChange = (e) => setIsPortrait(e.matches);
        mediaQuery.addEventListener('change', handleChange);
        return () => {
            clearTimeout(timer);
            mediaQuery.removeEventListener('change', handleChange);
        };
    }, [onFinish]);

    return (
        <div style={styles.initialSplashContainer}>
            <img src={teamLogos["UD Las Palmas"]} alt="UD Las Palmas Logo" style={styles.splashLogo} />
            <h1 style={styles.splashTitle}>PORRA UDLP 2026</h1>
            {isPortrait ? (
                <div style={styles.rotateMessage}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: styles.colors.yellow}}><path d="M16.4 3.6a9 9 0 0 1 0 16.8M3.6 7.6a9 9 0 0 1 16.8 0"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4 12H2"/><path d="M22 12h-2"/><path d="m15 5-3 3-3-3"/></svg>
                    <p>Para una mejor experiencia, gira tu dispositivo.</p>
                </div>
            ) : (
                <div style={styles.loadingMessage}>
                     <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="spinner">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                    <p>Cargando apuestas...</p>
                </div>
            )}
        </div>
    );
};

const OrientationLock = () => (
    <div id="orientation-lock" style={styles.orientationLock}>
        <div style={styles.rotateMessage}>
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: styles.colors.yellow}}><path d="M16.4 3.6a9 9 0 0 1 0 16.8M3.6 7.6a9 9 0 0 1 16.8 0"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4 12H2"/><path d="M22 12h-2"/><path d="m15 5-3 3-3-3"/></svg>
            <p style={{fontSize: '1.2rem', marginTop: '20px'}}>Por favor, gira tu dispositivo a modo horizontal.</p>
        </div>
    </div>
);

const SplashScreen = ({ onEnter, teamLogos }) => {
    const [jornadaInfo, setJornadaInfo] = useState(null);
    const [countdown, setCountdown] = useState('');
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState([]);
    const [currentStatIndex, setCurrentStatIndex] = useState(0);
    const [showInstallGuide, setShowInstallGuide] = useState(false);
    const isMobile = useMemo(() => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent), []);

    useEffect(() => {
        setLoading(true);
        const qActiva = query(collection(db, "jornadas"), where("estado", "==", "Abierta"), limit(1));
        const unsubscribeActiva = onSnapshot(qActiva, (activaSnap) => {
            if (!activaSnap.empty) {
                const jornada = { id: activaSnap.docs[0].id, ...activaSnap.docs[0].data(), type: 'activa' };
                setJornadaInfo(jornada);
                const pronosticosRef = collection(db, "pronosticos", jornada.id, "jugadores");
                const unsubscribePronosticos = onSnapshot(pronosticosRef, (pronosticosSnap) => {
                    const pronosticos = pronosticosSnap.docs.map(d => ({id: d.id, ...d.data()}));
                    const hanApostado = pronosticos.map(p => p.id);
                    const faltan = JUGADORES.filter(j => !hanApostado.includes(j));
                    const jokerUsers = pronosticos.filter(p => p.jokerActivo).map(p => p.id);
                    const resultados = pronosticos.map(p => `${p.golesLocal}-${p.golesVisitante}`);
                    const counts = resultados.reduce((acc, value) => ({...acc, [value]: (acc[value] || 0) + 1}), {});
                    const resultadosMasPuestos = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([res, count]) => `${res} (${count})`).join(', ');
                    const dynamicStats = [];
                    if (jornada.bote > 0) dynamicStats.push({ label: 'Bote Acumulado', value: `${jornada.bote}€`, color: styles.colors.success });
                    if (hanApostado.length > 0) dynamicStats.push({ label: 'Han Apostado', value: hanApostado.join(', ') });
                    if (faltan.length > 0) dynamicStats.push({ label: 'Faltan por Apostar', value: faltan.join(', '), color: styles.colors.warning });
                    if (jokerUsers.length > 0) dynamicStats.push({ label: 'Jokers Activados', value: jokerUsers.join(', '), color: styles.colors.gold });
                    if (pronosticos.length >= 5 && resultadosMasPuestos) {
                        dynamicStats.push({ label: 'Resultados Populares', value: resultadosMasPuestos, color: styles.colors.silver });
                    }
                    
                    const configDocRef = doc(db, "configuracion", "porraAnual");
                    getDoc(configDocRef).then(configSnap => {
                        if (configSnap.exists() && configSnap.data().estado === 'Abierta' && jornada.numeroJornada <= 5) {
                            const pronosticosAnualRef = collection(db, "porraAnualPronosticos");
                            getDocs(pronosticosAnualRef).then(pronosticosAnualSnap => {
                                const pronosticosAnual = pronosticosAnualSnap.docs.map(d => d.data());
                                const hanApostadoAnual = pronosticosAnualSnap.docs.map(d => d.id);
                                const siCount = pronosticosAnual.filter(p => p.ascenso === 'SI').length;
                                const noCount = pronosticosAnual.filter(p => p.ascenso === 'NO').length;
                                const posCounts = pronosticosAnual.reduce((acc, p) => ({...acc, [p.posicion]: (acc[p.posicion] || 0) + 1}), {});
                                const posMasPuestas = Object.entries(posCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([pos, count]) => `${pos}º (${count})`).join(', ');

                                const anualStats = [];
                                if (hanApostadoAnual.length > 0) anualStats.push({ label: 'Porra Anual: Han apostado', value: hanApostadoAnual.join(', ') });
                                if (siCount > 0 || noCount > 0) anualStats.push({ label: 'Porra Anual: Ascenso', value: `SI: ${siCount} - NO: ${noCount}` });
                                if (posMasPuestas) anualStats.push({ label: 'Porra Anual: Posición Popular', value: posMasPuestas });
                                
                                setStats([...dynamicStats, ...anualStats]);
                            });
                        } else {
                            setStats(dynamicStats.length > 0 ? dynamicStats : [{ label: 'Info', value: '¡Sé el primero en apostar!', color: styles.colors.yellow }]);
                        }
                    });
                    setLoading(false);
                });
                return () => unsubscribePronosticos();
            } else {
                const qCerrada = query(collection(db, "jornadas"), where("estado", "==", "Cerrada"), orderBy("numeroJornada", "desc"), limit(1));
                getDocs(qCerrada).then(cerradaSnap => {
                    if (!cerradaSnap.empty) {
                        const jornada = { id: cerradaSnap.docs[0].id, ...cerradaSnap.docs[0].data(), type: 'cerrada' };
                        setJornadaInfo(jornada);
                        const pronosticosRef = collection(db, "pronosticos", jornada.id, "jugadores");
                        getDocs(pronosticosRef).then(pronosticosSnap => {
                            const pronosticosCount = pronosticosSnap.size;
                            const costeApuesta = jornada.esVip ? APUESTA_VIP : APUESTA_NORMAL;
                            const dineroEnJuego = (jornada.bote || 0) + (pronosticosCount * costeApuesta);
                            setStats([{ label: 'Dinero Total en Juego', value: `${dineroEnJuego}€`, color: styles.colors.success }]);
                            setLoading(false);
                        });
                    } else {
                        const qFinalizada = query(collection(db, "jornadas"), where("estado", "==", "Finalizada"), orderBy("numeroJornada", "desc"), limit(1));
                        getDocs(qFinalizada).then(finalizadaSnap => {
                            if (!finalizadaSnap.empty) {
                                const jornada = { id: finalizadaSnap.docs[0].id, ...finalizadaSnap.docs[0].data(), type: 'finalizada' };
                                setJornadaInfo(jornada);
                                const pronosticosRef = collection(db, "pronosticos", jornada.id, "jugadores");
                                getDocs(pronosticosRef).then(pronosticosSnap => {
                                    const pronosticos = pronosticosSnap.docs.map(d => ({id: d.id, ...d.data()}));
                                    const jokersUsados = pronosticos.filter(p => p.jokerActivo).length;
                                    const ganadoresPuntos = pronosticos.filter(p => p.puntosObtenidos > 0).map(p => `${p.id} (${p.puntosObtenidos} pts)`).join(', ');
                                    const dynamicStats = [];
                                    if (jornada.ganadores && jornada.ganadores.length > 0) {
                                        dynamicStats.push({ label: `Ganador(es) del Bote`, value: jornada.ganadores.join(', '), color: styles.colors.gold });
                                    } else {
                                        dynamicStats.push({ label: 'Resultado del Bote', value: '¡BOTE ACUMULADO!', color: styles.colors.danger });
                                    }
                                    if (ganadoresPuntos) {
                                        dynamicStats.push({ label: 'Sumaron Puntos', value: ganadoresPuntos, color: styles.colors.silver });
                                    }
                                    dynamicStats.push({ label: 'Jokers Usados', value: `${jokersUsados} jugador(es)` });
                                    setStats(dynamicStats);
                                    setLoading(false);
                                });
                            } else {
                                const qProxima = query(collection(db, "jornadas"), where("estado", "==", "Próximamente"), orderBy("numeroJornada"), limit(1));
                                getDocs(qProxima).then(proximaSnap => {
                                    if (!proximaSnap.empty) {
                                        const jornada = { id: proximaSnap.docs[0].id, ...proximaSnap.docs[0].data(), type: 'proxima' };
                                        setJornadaInfo(jornada);
                                        setStats([]); 
                                    } else {
                                        setJornadaInfo(null);
                                        setStats([]);
                                    }
                                    setLoading(false);
                                });
                            }
                        });
                    }
                });
            }
        }, (error) => {
            console.error("Error fetching jornada: ", error);
            setJornadaInfo(null);
            setLoading(false);
        });
        return () => unsubscribeActiva();
    }, []);

    useEffect(() => {
        if (stats.length > 1) {
            const statInterval = setInterval(() => {
                setCurrentStatIndex(prevIndex => (prevIndex + 1) % stats.length);
            }, 4000);
            return () => clearInterval(statInterval);
        }
    }, [stats]);

    useEffect(() => {
        if (!jornadaInfo) return;
        const targetDate = jornadaInfo.type === 'activa' ? jornadaInfo.fechaCierre?.toDate() : jornadaInfo.fechaApertura?.toDate();
        if (!targetDate) return;
        const interval = setInterval(() => {
            const now = new Date();
            const diff = targetDate - now;
            if (diff <= 0) { 
                setCountdown(jornadaInfo.type === 'activa' ? "¡APUESTAS CERRADAS!" : "¡PARTIDO EN JUEGO!"); 
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
    }, [jornadaInfo]);

    const currentStat = stats[currentStatIndex];

    const renderJornadaInfo = () => {
        if (!jornadaInfo) {
            return (
                <div style={styles.splashInfoBox}>
                    <h3 style={styles.splashInfoTitle}>TEMPORADA EN PAUSA</h3>
                    <p>El administrador aún no ha configurado la próxima jornada.</p>
                </div>
            );
        }
        switch (jornadaInfo.type) {
            case 'activa':
                return (<><h3 style={styles.splashInfoTitle}>¡APUESTAS ABIERTAS!</h3><p style={styles.splashMatch}>{jornadaInfo.equipoLocal} <span style={{color: styles.colors.yellow}}>vs</span> {jornadaInfo.equipoVisitante}</p><div style={styles.countdownContainer}><p>CIERRE DE APUESTAS</p><div style={styles.countdown}>{countdown}</div></div></>);
            case 'cerrada':
                return (<><h3 style={styles.splashInfoTitle}>¡APUESTAS CERRADAS!</h3><p style={styles.splashMatch}>{jornadaInfo.equipoLocal} <span style={{color: styles.colors.yellow}}>vs</span> {jornadaInfo.equipoVisitante}</p><p>Esperando el resultado del partido...</p></>);
            case 'finalizada':
                 return (<><h3 style={styles.splashInfoTitle}>ÚLTIMA JORNADA FINALIZADA</h3><p style={styles.splashMatch}>{jornadaInfo.equipoLocal} <span style={{color: styles.colors.yellow}}>vs</span> {jornadaInfo.equipoVisitante}</p><p style={styles.finalResult}>Resultado: {jornadaInfo.resultadoLocal} - {jornadaInfo.resultadoVisitante}</p></>);
            case 'proxima':
                return (<><h3 style={styles.splashInfoTitle}>PRÓXIMA JORNADA</h3><p style={styles.splashMatch}>{jornadaInfo.equipoLocal} <span style={{color: styles.colors.yellow}}>vs</span> {jornadaInfo.equipoVisitante}</p>{jornadaInfo.bote > 0 && <p style={styles.splashBote}>¡BOTE DE {jornadaInfo.bote}€ EN JUEGO!</p>}{countdown && <div style={styles.countdownContainer}><p>EL PARTIDO COMIENZA EN</p><div style={styles.countdown}>{countdown}</div></div>}</>);
            default:
                return null;
        }
    };

    return (
        <>
            {showInstallGuide && <InstallGuideModal onClose={() => setShowInstallGuide(false)} />}
            <div style={styles.splashContainer}>
                <div style={styles.splashLogoContainer}>
                    <img src={teamLogos["UD Las Palmas"]} alt="UD Las Palmas Logo" style={styles.splashLogo} />
                    <h1 style={styles.splashTitle}>PORRA UDLP 2026</h1>
                </div>
                {loading ? (<p style={{color: styles.colors.lightText}}>Cargando información de la jornada...</p>) : (<div style={styles.splashInfoBox}>{renderJornadaInfo()}{currentStat && (<div style={styles.carouselStat}><span style={{color: currentStat.color || styles.colors.lightText, fontWeight: 'bold'}}>{currentStat.label}: </span><span style={{color: styles.colors.lightText}}>{currentStat.value}</span></div>)}{jornadaInfo && jornadaInfo.splashMessage && <p style={styles.splashAdminMessage}>"{jornadaInfo.splashMessage}"</p>}</div>)}
                <button onClick={onEnter} style={styles.mainButton}>ENTRAR</button>
                {isMobile && (
                    <button onClick={() => setShowInstallGuide(true)} style={styles.installButton}>
                        ¿Cómo instalar la App?
                    </button>
                )}
            </div>
        </>
    );
};

const LoginScreen = ({ onLogin }) => {
    const [hoveredUser, setHoveredUser] = useState(null);
    return (
        <div style={styles.loginContainer}>
            <h2 style={styles.title}>SELECCIONA TU PERFIL</h2>
            <div style={styles.userList}>
                {JUGADORES.map(jugador => (<button key={jugador} onClick={() => onLogin(jugador)} style={hoveredUser === jugador ? {...styles.userButton, ...styles.userButtonHover} : styles.userButton} onMouseEnter={() => setHoveredUser(jugador)} onMouseLeave={() => setHoveredUser(null)}>{jugador}</button>))}
            </div>
        </div>
    );
};

const MiJornadaScreen = ({ user, setActiveTab, teamLogos, liveData }) => {
    const [currentJornada, setCurrentJornada] = useState(null);
    const [loading, setLoading] = useState(true);
    const [pronostico, setPronostico] = useState({ golesLocal: '', golesVisitante: '', resultado1x2: '', goleador: '', sinGoleador: false, pin: '', jokerActivo: false, jokerPronosticos: Array(10).fill({golesLocal: '', golesVisitante: ''}) });
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const [isLocked, setIsLocked] = useState(true);
    const [pinInput, setPinInput] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [stats, setStats] = useState({ count: 0, color: styles.colors.success });
    const [jokersRestantes, setJokersRestantes] = useState(2);
    const [panicButtonDisabled, setPanicButtonDisabled] = useState(false);
    const [allPronosticos, setAllPronosticos] = useState([]);
    const [jokerStats, setJokerStats] = useState(Array(10).fill(null));
    const [showJokerAnimation, setShowJokerAnimation] = useState(false);
    const [provisionalData, setProvisionalData] = useState({ puntos: 0, posicion: '-' });

    useEffect(() => {
        setLoading(true);
        const userJokerRef = doc(db, "clasificacion", user);
        getDoc(userJokerRef).then(docSnap => {
            if (docSnap.exists() && docSnap.data().jokersRestantes !== undefined) {
                setJokersRestantes(docSnap.data().jokersRestantes);
            } else {
                setJokersRestantes(2);
            }
        });

        const qJornada = query(collection(db, "jornadas"), where("estado", "in", ["Abierta", "Cerrada"]), orderBy("numeroJornada", "desc"), limit(1));
        const unsubscribe = onSnapshot(qJornada, (querySnapshot) => {
            if (!querySnapshot.empty) {
                const jornadaData = { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
                setCurrentJornada(jornadaData);

                if (jornadaData.estado === "Abierta" && jornadaData.fechaCierre) {
                    const deadline = jornadaData.fechaCierre.toDate();
                    const oneHourBefore = deadline.getTime() - (3600 * 1000);
                    setPanicButtonDisabled(new Date().getTime() > oneHourBefore);
                }

                const pronosticoRef = doc(db, "pronosticos", jornadaData.id, "jugadores", user);
                getDoc(pronosticoRef).then(pronosticoSnap => {
                    if (pronosticoSnap.exists()) {
                        const data = pronosticoSnap.data();
                        const filledJokerPronosticos = data.jokerPronosticos ? [...data.jokerPronosticos, ...Array(10 - data.jokerPronosticos.length).fill({golesLocal: '', golesVisitante: ''})] : Array(10).fill({golesLocal: '', golesVisitante: ''});
                        setPronostico({...data, jokerPronosticos: filledJokerPronosticos});
                        setIsLocked(!!data.pin);
                        setHasSubmitted(true);
                    } else {
                        setPronostico({ golesLocal: '', golesVisitante: '', resultado1x2: '', goleador: '', sinGoleador: false, pin: '', jokerActivo: false, jokerPronosticos: Array(10).fill({golesLocal: '', golesVisitante: ''}) });
                        setIsLocked(false);
                        setHasSubmitted(false);
                    }
                    setLoading(false);
                });
                
                const allPronosticosRef = collection(db, "pronosticos", jornadaData.id, "jugadores");
                onSnapshot(allPronosticosRef, (snapshot) => {
                    setAllPronosticos(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
                });

            } else {
                const qProxima = query(collection(db, "jornadas"), where("estado", "==", "Próximamente"), orderBy("numeroJornada"), limit(1));
                getDocs(qProxima).then(proximaSnap => {
                    if (!proximaSnap.empty) setCurrentJornada({ id: proximaSnap.docs[0].id, ...proximaSnap.docs[0].data() });
                    else setCurrentJornada(null);
                    setLoading(false);
                });
            }
        }, (error) => { console.error("Error: ", error); setLoading(false); });
        
        return () => unsubscribe();
    }, [user]);
    
    useEffect(() => {
        if (currentJornada && currentJornada.estado === 'Cerrada' && liveData && liveData.isLive && allPronosticos.length > 0) {
            const ranking = allPronosticos.map(p => {
                const puntos = calculateProvisionalPoints(p, liveData, currentJornada);
                return { id: p.id, puntos };
            }).sort((a, b) => b.puntos - a.puntos);

            const miRanking = ranking.find(r => r.id === user);
            const miPosicion = ranking.findIndex(r => r.id === user) + 1;

            setProvisionalData({
                puntos: miRanking ? miRanking.puntos : 0,
                posicion: miRanking ? `${miPosicion}º` : '-'
            });
        } else {
            setProvisionalData({ puntos: 0, posicion: '-' });
        }
    }, [liveData, currentJornada, allPronosticos, user]);

    useEffect(() => {
        if (currentJornada && currentJornada.estado === 'Abierta' && pronostico.golesLocal !== '' && pronostico.golesVisitante !== '') {
            const otherPlayersPronosticos = allPronosticos.filter(p => p.id !== user);
            const count = otherPlayersPronosticos.filter(p => p.golesLocal === pronostico.golesLocal && p.golesVisitante === pronostico.golesVisitante).length;
            let color = styles.colors.success;
            if (count >= 1 && count <= 2) color = styles.colors.warning;
            if (count >= 3) color = styles.colors.danger;
            setStats({ count, color });
        } else {
            setStats({ count: 0, color: styles.colors.success });
        }
    }, [pronostico.golesLocal, pronostico.golesVisitante, allPronosticos, user, currentJornada]);

    useEffect(() => {
        if (!pronostico.jokerActivo || allPronosticos.length === 0) {
            setJokerStats(Array(10).fill(null));
            return;
        }
        const otherPlayersPronosticos = allPronosticos.filter(p => p.id !== user);
        const newJokerStats = pronostico.jokerPronosticos.map(jokerBet => {
            if (jokerBet.golesLocal === '' || jokerBet.golesVisitante === '') {
                return null;
            }
            const count = otherPlayersPronosticos.filter(p => p.golesLocal === jokerBet.golesLocal && p.golesVisitante === jokerBet.golesVisitante).length;
            let color = styles.colors.success;
            if (count >= 1 && count <= 2) color = styles.colors.warning;
            if (count >= 3) color = styles.colors.danger;
            const text = count > 0 ? `Repetido ${count} vece(s)` : '¡Único!';
            return { count, color, text };
        });
        setJokerStats(newJokerStats);
    }, [pronostico.jokerPronosticos, allPronosticos, user, pronostico.jokerActivo]);
    
    const handlePronosticoChange = (e) => {
        const { name, value, type, checked } = e.target;
        setPronostico(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value, ...(name === 'sinGoleador' && checked && { goleador: '' }) }));
    };

    const handleJokerPronosticoChange = (index, field, value) => {
        const newJokerPronosticos = [...pronostico.jokerPronosticos];
        newJokerPronosticos[index] = { ...newJokerPronosticos[index], [field]: value };
        setPronostico(prev => ({ ...prev, jokerPronosticos: newJokerPronosticos }));
    };
    
    const handleGuardarPronostico = async (e) => {
        e.preventDefault();
        if (!currentJornada) return;
        setIsSaving(true); setMessage('');
        const pronosticoRef = doc(db, "pronosticos", currentJornada.id, "jugadores", user);
        try {
            const cleanJokerPronosticos = pronostico.jokerPronosticos.filter(p => p.golesLocal !== '' || p.golesVisitante !== '');
            await setDoc(pronosticoRef, { ...pronostico, jokerPronosticos: cleanJokerPronosticos, lastUpdated: new Date() });
            setMessage('¡Pronóstico guardado y secreto!');
            setIsLocked(!!pronostico.pin);
            setHasSubmitted(true);
        } catch (error) { console.error("Error al guardar: ", error); setMessage('Error al guardar.'); }
        setIsSaving(false);
    };

    const handleUnlock = () => {
        if (pinInput === pronostico.pin) {
            setIsLocked(false);
            setMessage('Pronóstico desbloqueado. Puedes hacer cambios.');
        } else {
            alert('PIN incorrecto');
        }
    };

    const handleActivarJoker = async () => {
        if (jokersRestantes <= 0) {
            alert("No te quedan Jokers esta temporada.");
            return;
        }
        if (window.confirm("¿Seguro que quieres usar un JOKER para esta jornada? Esta acción no se puede deshacer y se descontará de tu total.")) {
            setShowJokerAnimation(true);
            setTimeout(() => setShowJokerAnimation(false), 7000);

            const userJokerRef = doc(db, "clasificacion", user);
            const userDoc = await getDoc(userJokerRef);
            if (!userDoc.exists()) {
                await setDoc(userJokerRef, { jokersRestantes: 1, puntosTotales: 0, jugador: user });
                setJokersRestantes(1);
            } else {
                await updateDoc(userJokerRef, { jokersRestantes: increment(-1) });
                setJokersRestantes(prev => prev - 1);
            }
            setPronostico(prev => ({ ...prev, jokerActivo: true }));
        }
    };

    const handleBotonDelPanico = async () => {
        if (window.confirm("¿Seguro que quieres cancelar tus apuestas JOKER? No recuperarás el JOKER gastado.")) {
            setPronostico(prev => ({ ...prev, jokerPronosticos: Array(10).fill({golesLocal: '', golesVisitante: ''}) }));
            const pronosticoRef = doc(db, "pronosticos", currentJornada.id, "jugadores", user);
            await updateDoc(pronosticoRef, { jokerPronosticos: [] });
            setMessage('Apuestas JOKER eliminadas.');
        }
    };

    const handleMarcarComoPagado = async () => {
        if (!currentJornada) return;
        const pronosticoRef = doc(db, "pronosticos", currentJornada.id, "jugadores", user);
        try {
            await updateDoc(pronosticoRef, { pagado: true });
            setPronostico(prev => ({...prev, pagado: true}));
            setMessage('¡Pago registrado con éxito!');
        } catch (error) {
            console.error("Error al marcar como pagado: ", error);
            setMessage('Error al registrar el pago.');
        }
    };

    if (loading) return <p style={{color: styles.colors.lightText}}>Buscando jornada...</p>;

    const renderContent = () => {
        if (!currentJornada) {
            return <div style={styles.placeholder}><h3>No hay jornadas disponibles.</h3><p>El administrador añadirá nuevas jornadas próximamente.</p></div>;
        }

        switch (currentJornada.estado) {
            case 'Abierta':
                const isVip = currentJornada.esVip;
                return (
                    <form onSubmit={handleGuardarPronostico} style={styles.form}>
                        {currentJornada.bote > 0 && <div style={styles.jackpotBanner}>💰 JACKPOT: ¡{currentJornada.bote}€ DE BOTE! 💰</div>}
                        {isVip && (<div style={styles.vipBanner}>⭐ JORNADA VIP ⭐ (Apuesta: 2€ - Puntos Dobles)</div>)}
                        <h3 style={styles.formSectionTitle}>Jornada {currentJornada.numeroJornada}: {currentJornada.equipoLocal} vs {currentJornada.equipoVisitante}</h3>
                        {isLocked && pronostico.pin && (<div style={styles.pinLockContainer}><p>🔒 Tu pronóstico está bloqueado. Introduce tu PIN para modificarlo.</p><input type="password" maxLength="4" value={pinInput} onChange={(e) => setPinInput(e.target.value)} style={styles.input} placeholder="PIN de 4 dígitos" /><button type="button" onClick={handleUnlock} style={styles.mainButton}>Desbloquear</button></div>)}
                        
                        {hasSubmitted && isLocked ? (
                            <div style={styles.placeholder}>
                                <h3>¡Pronóstico guardado y secreto!</h3>
                                <p>Podrás ver los pronósticos de todos cuando la jornada se cierre.</p>
                            </div>
                        ) : (
                            <fieldset disabled={isLocked} style={{border: 'none', padding: 0, margin: 0}}>
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>RESULTADO EXACTO <span style={styles.pointsReminder}>( {isVip ? '6' : '3'} Puntos )</span></label>
                                    <div style={styles.resultInputContainer}>
                                        <TeamDisplay teamLogos={teamLogos} teamName={currentJornada.equipoLocal} />
                                        <input type="tel" inputMode="numeric" pattern="[0-9]*" name="golesLocal" value={pronostico.golesLocal} onChange={handlePronosticoChange} style={styles.resultInput} />
                                        <span style={styles.separator}>-</span>
                                        <input type="tel" inputMode="numeric" pattern="[0-9]*" name="golesVisitante" value={pronostico.golesVisitante} onChange={handlePronosticoChange} style={styles.resultInput} />
                                        <TeamDisplay teamLogos={teamLogos} teamName={currentJornada.equipoVisitante} />
                                    </div>
                                    {(pronostico.golesLocal !== '' && pronostico.golesVisitante !== '') && <small key={stats.count} className="stats-indicator" style={{...styles.statsIndicator, color: stats.color}}>{stats.count > 0 ? `Otros ${stats.count} jugador(es) han pronosticado este resultado.` : '¡Eres el único con este resultado por ahora!'}</small>}
                                </div>
                                <div style={styles.formGroup}><label style={styles.label}>RESULTADO 1X2 <span style={styles.pointsReminder}>( {isVip ? '2' : '1'} Puntos )</span></label><select name="resultado1x2" value={pronostico.resultado1x2} onChange={handlePronosticoChange} style={styles.input}><option value="">-- Elige --</option><option value="Gana UD Las Palmas">Gana UDLP</option><option value="Empate">Empate</option><option value="Pierde UD Las Palmas">Pierde UDLP</option></select></div>
                                <div style={styles.formGroup}><label style={styles.label}>PRIMER GOLEADOR <span style={styles.pointsReminder}>( {isVip ? '4' : '2'} Puntos )</span></label><input type="text" name="goleador" value={pronostico.goleador} onChange={handlePronosticoChange} style={styles.input} disabled={pronostico.sinGoleador} /><div style={{marginTop: '10px'}}><input type="checkbox" name="sinGoleador" id="sinGoleador" checked={pronostico.sinGoleador} onChange={handlePronosticoChange} style={styles.checkbox} /><label htmlFor="sinGoleador" style={{marginLeft: '8px', color: styles.colors.lightText}}>Sin Goleador (SG) <span style={styles.pointsReminder}>(1 Punto)</span></label></div></div>
                                <div style={styles.formGroup}><label style={styles.label}>PIN DE SEGURIDAD (4 dígitos, opcional)</label><input type="password" name="pin" value={pronostico.pin} onChange={handlePronosticoChange} maxLength="4" style={styles.input} placeholder="Deja en blanco para no bloquear" /></div>
                                
                                <div style={styles.jokerContainer}>
                                    {!pronostico.jokerActivo ? (<><button type="button" onClick={handleActivarJoker} style={styles.jokerButton} disabled={isLocked || jokersRestantes <= 0}>🃏 Activar JOKER</button><span style={{marginLeft: '15px', color: styles.colors.lightText}}>Te quedan: <span style={{color: styles.colors.yellow, fontWeight: 'bold'}}>{jokersRestantes}</span></span></>) : (<div><h3 style={styles.formSectionTitle}>Apuestas JOKER</h3><p>Añade hasta 10 resultados exactos adicionales.</p><div style={styles.jokerGrid}>{pronostico.jokerPronosticos.map((p, index) => (<div key={index} style={styles.jokerBetRow}><div style={styles.resultInputContainer}><input type="tel" inputMode="numeric" pattern="[0-9]*" value={p.golesLocal} onChange={(e) => handleJokerPronosticoChange(index, 'golesLocal', e.target.value)} style={{...styles.resultInput, fontSize: '1.2rem'}} disabled={isLocked} /><span style={styles.separator}>-</span><input type="tel" inputMode="numeric" pattern="[0-9]*" value={p.golesVisitante} onChange={(e) => handleJokerPronosticoChange(index, 'golesVisitante', e.target.value)} style={{...styles.resultInput, fontSize: '1.2rem'}} disabled={isLocked} /></div>{jokerStats[index] && (<small style={{...styles.statsIndicator, color: jokerStats[index].color, fontSize: '0.8rem', textAlign: 'center', display: 'block', marginTop: '5px'}}>{jokerStats[index].text}</small>)}</div>))}</div><button type="button" onClick={handleBotonDelPanico} style={{...styles.jokerButton, ...styles.dangerButton, marginTop: '20px'}} disabled={isLocked || panicButtonDisabled}>BOTÓN DEL PÁNICO</button>{panicButtonDisabled && <small style={{display: 'block', color: styles.colors.danger, marginTop: '5px'}}>El botón del pánico se ha desactivado (menos de 1h para el cierre).</small>}</div>)}
                                </div>
                                <button type="submit" disabled={isSaving || isLocked} style={styles.mainButton}>{isSaving ? 'GUARDANDO...' : 'GUARDAR Y BLOQUEAR'}</button>
                            </fieldset>
                        )}
                        {message && <p style={styles.message}>{message}</p>}
                    </form>
                );
            case 'Cerrada':
                return (
                    <div style={styles.placeholder}>
                        <h3>Jornada {currentJornada.numeroJornada} Cerrada</h3>
                        <p>Las apuestas para este partido han finalizado.</p>
                        <p>Tu pronóstico guardado: <strong>{pronostico.golesLocal}-{pronostico.golesVisitante}</strong></p>
                        <button onClick={() => setActiveTab('laJornada')} style={{...styles.mainButton, backgroundColor: styles.colors.blue}}>Ver Resumen y Datos en Vivo</button>
                    </div>
                );
            case 'Finalizada':
                return (
                    <div style={styles.placeholder}>
                        <h3>Jornada {currentJornada.numeroJornada} Finalizada</h3>
                        <p>Tu pronóstico fue: <strong>{pronostico.golesLocal}-{pronostico.golesVisitante}</strong></p>
                        {currentJornada.ganadores && currentJornada.ganadores.length === 0 && <div style={styles.boteBanner}>¡BOTE! Nadie acertó el resultado.</div>}
                        <button onClick={handleMarcarComoPagado} disabled={pronostico.pagado} style={styles.mainButton}>{pronostico.pagado ? 'PAGO REGISTRADO ✓' : 'MARCAR COMO PAGADO'}</button>
                        <button onClick={() => setActiveTab('laJornada')} style={{...styles.mainButton, marginLeft: '10px', backgroundColor: styles.colors.blue}}>Ver Resumen de Apuestas</button>
                        {message && <p style={styles.message}>{message}</p>}
                    </div>
                );
            case 'Próximamente':
                 return (
                    <div style={styles.placeholder}>
                        <h3>No hay jornada de apuestas abierta</h3>
                        <h4>Próximo Partido: Jornada {currentJornada.numeroJornada}</h4>
                        <p style={{fontSize: '1.2rem', fontWeight: 'bold'}}>{currentJornada.equipoLocal} vs {currentJornada.equipoVisitante}</p>
                        {currentJornada.bote > 0 && <div style={styles.jackpotBanner}>💰 JACKPOT: ¡{currentJornada.bote}€ DE BOTE! 💰</div>}
                        {currentJornada.fechaStr && <p>🗓️ {currentJornada.fechaStr}</p>}
                        {currentJornada.estadio && <p>📍 {currentJornada.estadio}</p>}
                    </div>
                );
            default:
                return <div style={styles.placeholder}><h3>Cargando...</h3></div>;
        }
    };

    return (
        <div>
            {showJokerAnimation && <JokerAnimation />}
            <h2 style={styles.title}>MI JORNADA</h2>
            <p style={{color: styles.colors.lightText, textAlign: 'center', fontSize: '1.1rem'}}>Bienvenido, <strong style={{color: styles.colors.yellow}}>{user}</strong>.</p>
            
            {liveData && liveData.isLive && currentJornada?.estado === 'Cerrada' && (
                <div style={styles.liveInfoBox}>
                    <div style={styles.liveInfoItem}>
                        <span style={styles.liveInfoLabel}>Puntos Provisionales</span>
                        <span style={styles.liveInfoValue}>{provisionalData.puntos}</span>
                    </div>
                    <div style={styles.liveInfoItem}>
                        <span style={styles.liveInfoLabel}>Posición Provisional</span>
                        <span style={styles.liveInfoValue}>{provisionalData.posicion}</span>
                    </div>
                </div>
            )}
            {renderContent()}
        </div>
    );
};

const LaJornadaScreen = ({ teamLogos, liveData }) => {
    const [jornadaActual, setJornadaActual] = useState(null);
    const [participantes, setParticipantes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [countdown, setCountdown] = useState('');
    const [porraAnualConfig, setPorraAnualConfig] = useState(null);
    const [pronosticosAnuales, setPronosticosAnuales] = useState([]);
    const [provisionalRanking, setProvisionalRanking] = useState([]);

    useEffect(() => {
        const q = query(collection(db, "jornadas"), where("estado", "in", ["Abierta", "Cerrada"]), orderBy("numeroJornada", "desc"), limit(1));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const jornada = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
                setJornadaActual(jornada);
                const pronosticosRef = collection(db, "pronosticos", jornada.id, "jugadores");
                onSnapshot(pronosticosRef, (pronosticosSnap) => {
                    const pronosticosData = pronosticosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    setParticipantes(pronosticosData);
                });
            } else {
                setJornadaActual(null);
                setParticipantes([]);
            }
            setLoading(false);
        });
        
        const configRef = doc(db, "configuracion", "porraAnual");
        const unsubConfig = onSnapshot(configRef, (doc) => {
            setPorraAnualConfig(doc.exists() ? doc.data() : null);
        });

        const pronosticosAnualesRef = collection(db, "porraAnualPronosticos");
        const unsubPronosticos = onSnapshot(pronosticosAnualesRef, (snapshot) => {
            setPronosticosAnuales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => {
            unsubscribe();
            unsubConfig();
            unsubPronosticos();
        };
    }, []);
    
    useEffect(() => {
        if (jornadaActual && jornadaActual.estado === 'Cerrada' && liveData && liveData.isLive && participantes.length > 0) {
            const ranking = participantes.map(p => {
                const puntos = calculateProvisionalPoints(p, liveData, jornadaActual);
                return { id: p.id, puntos };
            }).sort((a, b) => b.puntos - a.puntos);
            setProvisionalRanking(ranking);
        } else {
            setProvisionalRanking([]);
        }
    }, [liveData, jornadaActual, participantes]);

    useEffect(() => {
        if (jornadaActual && jornadaActual.estado === 'Abierta' && jornadaActual.fechaCierre) {
            const interval = setInterval(() => {
                const now = new Date();
                const deadline = jornadaActual.fechaCierre.toDate();
                const diff = deadline - now;
                if (diff <= 0) { setCountdown("¡APUESTAS CERRADAS!"); clearInterval(interval); return; }
                const d = Math.floor(diff / (1000 * 60 * 60 * 24));
                const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const s = Math.floor((diff % (1000 * 60)) / 1000);
                setCountdown(`${d}d ${h}h ${m}m ${s}s`);
            }, 1000);
            return () => clearInterval(interval);
        } else {
            setCountdown('');
        }
    }, [jornadaActual]);

    if (loading) return <p style={{color: styles.colors.lightText}}>Buscando jornada...</p>;
    
    const isLiveView = jornadaActual?.estado === 'Cerrada' && liveData && liveData.isLive;

    return (
        <div>
            <h2 style={styles.title}>LA JORNADA</h2>
            {jornadaActual ? (
                <div style={{...styles.laJornadaContainer, backgroundImage: `linear-gradient(rgba(10, 25, 47, 0.85), rgba(10, 25, 47, 0.85)), url(${jornadaActual.estadioImageUrl})`}}>
                    <h3>Jornada {jornadaActual.numeroJornada}</h3>
                    <div style={styles.matchInfo}>
                        <TeamDisplay teamLogos={teamLogos} teamName={jornadaActual.equipoLocal} shortName={true} imgStyle={styles.matchInfoLogo} />
                        {isLiveView ? (
                            <span style={styles.liveScoreInPage}>{liveData.golesLocal} - {liveData.golesVisitante}</span>
                        ) : (
                            <span style={styles.vs}>VS</span>
                        )}
                        <TeamDisplay teamLogos={teamLogos} teamName={jornadaActual.equipoVisitante} imgStyle={styles.matchInfoLogo} />
                    </div>
                    <div style={styles.matchDetails}>
                        <span>📍 {jornadaActual.estadio || 'Estadio por confirmar'}</span>
                        <span>🗓️ {jornadaActual.fechaStr || 'Fecha por confirmar'}</span>
                    </div>

                    {jornadaActual.estado === 'Abierta' && (
                        <>
                            <div style={styles.countdownContainer}><p>CIERRE DE APUESTAS EN:</p><div style={styles.countdown}>{countdown}</div></div>
                            <h3 style={styles.callToAction}>¡Hagan sus porras!</h3>
                            <div style={styles.apostadoresContainer}><h4>APUESTAS REALIZADAS ({participantes.length}/{JUGADORES.length})</h4><div style={styles.apostadoresGrid}>{JUGADORES.map(jugador => {const participante = participantes.find(p => p.id === jugador); const haApostado = !!participante; const usoJoker = haApostado && participante.jokerActivo; return (<span key={jugador} style={haApostado ? styles.apostadorHecho : styles.apostadorPendiente}>{jugador} {usoJoker ? '🃏' : (haApostado ? '✓' : '')}</span>);})}</div></div>
                        </>
                    )}
                    
                    {jornadaActual.estado === 'Cerrada' && !isLiveView && (
                        <div>
                            <p style={{textAlign: 'center', marginTop: '20px'}}>Las apuestas están cerradas. ¡Estos son los pronósticos!</p>
                            <div style={styles.resumenContainer}>{participantes.sort((a, b) => a.id.localeCompare(b.id)).map(p => (<div key={p.id} style={styles.resumenJugador}><h4 style={styles.resumenJugadorTitle}>{p.id} {p.jokerActivo && '🃏'}</h4><div style={styles.resumenJugadorBets}><p><strong>Principal:</strong> {p.golesLocal}-{p.golesVisitante} &nbsp;|&nbsp; <strong>1X2:</strong> {p.resultado1x2} &nbsp;|&nbsp; <strong>Goleador:</strong> {p.sinGoleador ? 'Sin Goleador' : (p.goleador || 'N/A')}</p>{p.jokerActivo && p.jokerPronosticos?.length > 0 && (<div style={{marginTop: '10px'}}><strong>Apuestas Joker:</strong><div style={styles.jokerChipsContainer}>{p.jokerPronosticos.map((jp, index) => (<span key={index} style={styles.jokerDetailChip}>{jp.golesLocal}-{jp.golesVisitante}</span>))}</div></div>)}</div></div>))}</div>
                        </div>
                    )}
                    
                    {isLiveView && (
                        <div>
                            <h3 style={styles.provisionalTitle}>Clasificación Provisional</h3>
                            <table style={{...styles.table, backgroundColor: 'rgba(0,0,0,0.3)'}}>
                                <thead>
                                    <tr>
                                        <th style={styles.th}>POS</th>
                                        <th style={styles.th}>Jugador</th>
                                        <th style={styles.th}>Puntos</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {provisionalRanking.map((jugador, index) => (
                                        <tr key={jugador.id} style={jugador.puntos > 0 && provisionalRanking[0].puntos === jugador.puntos ? styles.provisionalWinnerRow : styles.tr}>
                                            <td style={styles.tdRank}>{index + 1}º</td>
                                            <td style={styles.td}>{jugador.id}</td>
                                            <td style={styles.td}>{jugador.puntos}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ) : (
                <div style={styles.placeholder}><h3>No hay ninguna jornada activa o cerrada en este momento.</h3></div>
            )}
            
            <div style={styles.porraAnualContainer}>
                <h3 style={styles.formSectionTitle}>⭐ PORRA ANUAL ⭐</h3>
                {porraAnualConfig?.estado === 'Abierta' && <p style={{textAlign: 'center'}}>Las apuestas de los demás serán secretas hasta la Jornada 5. ¡Haz la tuya desde el banner superior!</p>}
                {(porraAnualConfig?.estado === 'Cerrada' || porraAnualConfig?.estado === 'Finalizada') && (
                    <div>
                        <p style={{textAlign: 'center'}}>Apuestas cerradas. Estos son los pronósticos para final de temporada:</p>
                        <div style={styles.resumenContainer}>
                            {pronosticosAnuales.sort((a, b) => a.id.localeCompare(b.id)).map(p => (
                                <div key={p.id} style={styles.resumenJugador}>
                                    <h4 style={styles.resumenJugadorTitle}>{p.id}</h4>
                                    <div style={styles.resumenJugadorBets}>
                                        <p><strong>¿Asciende?:</strong> <span style={{color: p.ascenso === 'SI' ? styles.colors.success : styles.colors.danger, fontWeight: 'bold'}}>{p.ascenso}</span></p>
                                        <p><strong>Posición Final:</strong> <span style={{color: styles.colors.yellow, fontWeight: 'bold'}}>{p.posicion}º</span></p>
                                        {porraAnualConfig.estado === 'Finalizada' && <p><strong>Puntos Obtenidos:</strong> <span style={{fontWeight: 'bold', color: styles.colors.gold}}>{p.puntosObtenidos || 0}</span></p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                 {porraAnualConfig?.estado !== 'Abierta' && porraAnualConfig?.estado !== 'Cerrada' && porraAnualConfig?.estado !== 'Finalizada' && <p style={{textAlign: 'center'}}>El administrador no ha abierto la porra anual todavía.</p>}
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
            const jornadasData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setJornadas(jornadasData);
            setLoading(false);
        }, (error) => { console.error("Error cargando calendario: ", error); setLoading(false); });
        return () => unsubscribe();
    }, []);

    if (loading) return <p style={{color: styles.colors.lightText}}>Cargando calendario...</p>;

    return (
        <div>
            <h2 style={styles.title}>CALENDARIO</h2>
            <div style={styles.jornadaList}>
                {jornadas.map(jornada => (
                    <div 
                        key={jornada.id} 
                        style={jornada.esVip ? {...styles.jornadaItem, ...styles.jornadaVip, backgroundImage: `linear-gradient(to right, rgba(23, 42, 69, 0.95), rgba(23, 42, 69, 0.7)), url(${jornada.estadioImageUrl})`} : {...styles.jornadaItem, backgroundImage: `linear-gradient(to right, rgba(23, 42, 69, 0.95), rgba(23, 42, 69, 0.7)), url(${jornada.estadioImageUrl})`}} 
                        onClick={() => onViewJornada(jornada.id)}
                    >
                        <div style={styles.jornadaInfo}>
                            <div style={styles.jornadaTeams}>
                                <TeamDisplay teamLogos={teamLogos} teamName={jornada.equipoLocal} imgStyle={{width: 25, height: 25}} />
                                <span style={{color: styles.colors.yellow, margin: '0 10px'}}>vs</span>
                                <TeamDisplay teamLogos={teamLogos} teamName={jornada.equipoVisitante} imgStyle={{width: 25, height: 25}} />
                            </div>
                            <strong>{jornada.esVip && '⭐ '}{jornada.id === 'jornada_test' ? 'Jornada de Prueba' : `Jornada ${jornada.numeroJornada || 'Copa'}`}</strong>
                            <small>{jornada.fechaStr || 'Fecha por confirmar'} - {jornada.estadio || 'Estadio por confirmar'}</small>
                        </div>
                        <div style={{...styles.statusBadge, backgroundColor: styles.colors.status[jornada.estado]}}>{jornada.estado}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const AnimatedPoints = ({ value }) => {
    const [currentValue, setCurrentValue] = useState(0);
    const prevValueRef = useRef(0);

    useEffect(() => {
        const startValue = prevValueRef.current;
        const endValue = value || 0;
        let startTime = null;

        const animation = (currentTime) => {
            if (!startTime) startTime = currentTime;
            const progress = Math.min((currentTime - startTime) / 1000, 1); // 1 segundo de animación
            const newDisplayValue = Math.floor(progress * (endValue - startValue) + startValue);
            setCurrentValue(newDisplayValue);

            if (progress < 1) {
                requestAnimationFrame(animation);
            } else {
                 prevValueRef.current = endValue;
            }
        };
        
        requestAnimationFrame(animation);

        return () => { prevValueRef.current = value || 0; };
    }, [value]);

    return <span>{currentValue}</span>;
};

const ClasificacionScreen = ({ currentUser, liveData, liveJornada }) => {
    const [clasificacion, setClasificacion] = useState([]);
    const [loading, setLoading] = useState(true);
    const [rachas, setRachas] = useState({});
    const [livePronosticos, setLivePronosticos] = useState([]);

    useEffect(() => {
        const fetchRachas = async () => {
            const q = query(collection(db, "jornadas"), where("estado", "==", "Finalizada"), orderBy("numeroJornada", "desc"), limit(2));
            const jornadasSnap = await getDocs(q);
            if (jornadasSnap.docs.length < 2) return;

            const [jornada1, jornada2] = jornadasSnap.docs.map(d => ({id: d.id, ...d.data()}));
            
            const [pronosticos1Snap, pronosticos2Snap] = await Promise.all([
                getDocs(collection(db, "pronosticos", jornada1.id, "jugadores")),
                getDocs(collection(db, "pronosticos", jornada2.id, "jugadores"))
            ]);
            
            const pronosticos1 = Object.fromEntries(pronosticos1Snap.docs.map(d => [d.id, d.data()]));
            const pronosticos2 = Object.fromEntries(pronosticos2Snap.docs.map(d => [d.id, d.data()]));

            const newRachas = {};
            JUGADORES.forEach(jugador => {
                const p1 = pronosticos1[jugador];
                const p2 = pronosticos2[jugador];
                const aciertoExacto1 = p1 && parseInt(p1.golesLocal) === jornada1.resultadoLocal && parseInt(p1.golesVisitante) === jornada1.resultadoVisitante;
                const aciertoExacto2 = p2 && parseInt(p2.golesLocal) === jornada2.resultadoLocal && parseInt(p2.golesVisitante) === jornada2.resultadoVisitante;
                
                if (aciertoExacto1 && aciertoExacto2) {
                    newRachas[jugador] = '🔥';
                } else if ((p1?.puntosObtenidos === 0 || !p1) && (p2?.puntosObtenidos === 0 || !p2)) {
                    newRachas[jugador] = '🥶';
                }
            });
            setRachas(newRachas);
        };

        fetchRachas();

        const qClasificacion = query(collection(db, "clasificacion"));
        const unsubscribe = onSnapshot(qClasificacion, (querySnapshot) => {
            const clasificacionData = {};
            querySnapshot.forEach((doc) => {
                clasificacionData[doc.id] = { id: doc.id, ...doc.data() };
            });

            const processedData = JUGADORES.map(jugadorId => {
                return clasificacionData[jugadorId] || { id: jugadorId, jugador: jugadorId, puntosTotales: 0, jokersRestantes: 2 };
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
        
        return sorted;

    }, [clasificacion, liveData, liveJornada, livePronosticos]);


    if (loading) return <p style={{color: styles.colors.lightText}}>Cargando clasificación...</p>;
    
    const isLive = liveData && liveData.isLive;
    
    const getRankStyle = (index, jugadorId) => {
        let style = {};
        if (index === 0) style = styles.top1Row;
        else if (index === 1) style = styles.top2Row;
        else if (index === 2) style = styles.top3Row;
        else style = styles.tr;
        if (jugadorId === currentUser) style = {...style, ...styles.currentUserRow};
        return style;
    };
    
    const getRankIcon = (index) => {
        if (index === 0) return '🥇';
        if (index === 1) return '🥈';
        if (index === 2) return '🥉';
        return `${index + 1}º`;
    };

    return (
        <div>
            <h2 style={styles.title}>CLASIFICACIÓN</h2>
            <div style={{overflowX: 'auto'}}>
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>POS</th>
                            <th style={styles.th}>JUGADOR</th>
                            {isLive && <th style={styles.th}>PUNTOS (EN VIVO)</th>}
                            <th style={styles.th}>PUNTOS TOTALES</th>
                            <th style={{...styles.th, textAlign: 'center'}}>JOKERS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {liveClasificacion.map((jugador, index) => (
                            <tr key={jugador.id} style={getRankStyle(index, jugador.id)}>
                                <td style={styles.tdRank}>{getRankIcon(index)}</td>
                                <td style={styles.td}>{jugador.jugador || jugador.id} {rachas[jugador.id]}</td>
                                {isLive && <td style={{...styles.td, color: styles.colors.gold, fontWeight: 'bold'}}><AnimatedPoints value={jugador.puntosEnVivo} /></td>}
                                <td style={styles.td}><AnimatedPoints value={jugador.puntosTotales} /></td>
                                <td style={{...styles.td, ...styles.tdIcon, textAlign: 'center'}}>
                                    {jugador.jokersRestantes !== undefined ? jugador.jokersRestantes : 2} 🃏
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const JornadaAdminItem = ({ jornada }) => {
    const [estado, setEstado] = useState(jornada.estado);
    const [resultadoLocal, setResultadoLocal] = useState(jornada.resultadoLocal === undefined ? '' : jornada.resultadoLocal);
    const [resultadoVisitante, setResultadoVisitante] = useState(jornada.resultadoVisitante === undefined ? '' : jornada.resultadoVisitante);
    const [goleador, setGoleador] = useState(jornada.goleador || '');
    const [resultado1x2, setResultado1x2] = useState(jornada.resultado1x2 || '');
    const [esVip, setEsVip] = useState(jornada.esVip || false);
    const [splashMessage, setSplashMessage] = useState(jornada.splashMessage || '');
    const toInputFormat = (date) => date && date.seconds ? new Date(date.seconds * 1000).toISOString().slice(0, 16) : '';
    const [fechaApertura, setFechaApertura] = useState(toInputFormat(jornada.fechaApertura));
    const [fechaCierre, setFechaCierre] = useState(toInputFormat(jornada.fechaCierre));
    const [estadioImageUrl, setEstadioImageUrl] = useState(jornada.estadioImageUrl || '');
    const [isSaving, setIsSaving] = useState(false);
    const [isCalculating, setIsCalculating] = useState(false);
    const [message, setMessage] = useState('');
    const [liveData, setLiveData] = useState({ golesLocal: 0, golesVisitante: 0, ultimoGoleador: '', isLive: false });

    useEffect(() => {
        if (jornada.liveData) {
            setLiveData(jornada.liveData);
        }
    }, [jornada.liveData]);

    const handleSaveChanges = async () => {
        setIsSaving(true); setMessage('');
        const jornadaRef = doc(db, "jornadas", jornada.id);
        try {
            await updateDoc(jornadaRef, {
                estado, resultadoLocal, resultadoVisitante, goleador: goleador.trim(), resultado1x2, esVip, splashMessage,
                fechaApertura: fechaApertura ? new Date(fechaApertura) : null,
                fechaCierre: fechaCierre ? new Date(fechaCierre) : null,
                estadioImageUrl
            });
            setMessage('¡Guardado!');
            setTimeout(() => setMessage(''), 2000);
        } catch (error) { console.error("Error al actualizar: ", error); setMessage('Error al guardar.'); }
        setIsSaving(false);
    };

    const handleUpdateLiveScore = async () => {
        setIsSaving(true);
        const jornadaRef = doc(db, "jornadas", jornada.id);
        try {
            await updateDoc(jornadaRef, { liveData: { ...liveData, isLive: true } });
            setMessage('¡Marcador en vivo actualizado!');
            setTimeout(() => setMessage(''), 2000);
        } catch (error) {
            console.error("Error actualizando marcador en vivo:", error);
            setMessage('Error al actualizar.');
        }
        setIsSaving(false);
    };

    const handleCalcularPuntos = async () => {
        if (resultadoLocal === '' || resultadoVisitante === '' || !resultado1x2) { alert("Introduce los goles de ambos equipos y el Resultado 1X2."); return; }
        setIsCalculating(true);
        const pronosticosRef = collection(db, "pronosticos", jornada.id, "jugadores");
        const pronosticosSnap = await getDocs(pronosticosRef);
        const pronosticos = pronosticosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const batch = writeBatch(db);
        const ganadores = [];
        for (const p of pronosticos) {
            let puntosJornada = 0;
            const esVip = jornada.esVip || false;
            // Acierto Resultado Exacto
            if (p.golesLocal !== '' && p.golesVisitante !== '' && parseInt(p.golesLocal) === parseInt(resultadoLocal) && parseInt(p.golesVisitante) === parseInt(resultadoVisitante)) {
                puntosJornada += esVip ? 6 : 3;
                if (!ganadores.includes(p.id)) ganadores.push(p.id);
            }
            // Acierto 1X2
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
            if (p.resultado1x2 === resultado1x2Real) { puntosJornada += esVip ? 2 : 1; }
            // Acierto Goleador
            const goleadorReal = goleador.trim().toLowerCase();
            const goleadorApostado = p.goleador ? p.goleador.trim().toLowerCase() : '';
            if (p.sinGoleador && (goleadorReal === "sg" || goleadorReal === "")) { 
                puntosJornada += 1;
            } 
            else if (!p.sinGoleador && goleadorApostado === goleadorReal && goleadorReal !== "") { 
                puntosJornada += esVip ? 4 : 2; 
            }
            // Acierto Joker
            if (p.jokerActivo && p.jokerPronosticos && p.jokerPronosticos.length > 0) {
                for (const jokerP of p.jokerPronosticos) {
                    if (jokerP.golesLocal !== '' && jokerP.golesVisitante !== '' && parseInt(jokerP.golesLocal) === parseInt(resultadoLocal) && parseInt(jokerP.golesVisitante) === parseInt(resultadoVisitante)) {
                        puntosJornada += esVip ? 6 : 3;
                        if (!ganadores.includes(p.id)) ganadores.push(p.id);
                        break; 
                    }
                }
            }
            const pronosticoDocRef = doc(db, "pronosticos", jornada.id, "jugadores", p.id);
            batch.update(pronosticoDocRef, { puntosObtenidos: puntosJornada });
            const clasificacionDocRef = doc(db, "clasificacion", p.id);
            batch.set(clasificacionDocRef, { puntosTotales: increment(puntosJornada), jugador: p.id }, { merge: true });
        }
        const jornadaRef = doc(db, "jornadas", jornada.id);
        batch.update(jornadaRef, { estado: "Finalizada", ganadores, "liveData.isLive": false });
        if (ganadores.length === 0 && jornada.id !== 'jornada_test') {
            const boteActual = jornada.bote || 0;
            const costeApuesta = jornada.esVip ? APUESTA_VIP : APUESTA_NORMAL;
            const nuevoBote = boteActual + (pronosticos.length * costeApuesta);
            const qProxima = query(collection(db, "jornadas"), where("numeroJornada", ">", jornada.numeroJornada), orderBy("numeroJornada"), limit(1));
            const proximaJornadaSnap = await getDocs(qProxima);
            if (!proximaJornadaSnap.empty) {
                const proximaJornadaRef = doc(db, "jornadas", proximaJornadaSnap.docs[0].id);
                batch.update(proximaJornadaRef, { bote: increment(nuevoBote) });
            }
        }
        try { await batch.commit(); alert("¡Puntos calculados y jornada cerrada!"); } 
        catch (error) { console.error("Error al calcular: ", error); alert("Error al calcular puntos."); }
        setIsCalculating(false);
    };

    return (
        <div style={jornada.id === 'jornada_test' ? {...styles.adminJornadaItem, ...styles.testJornadaAdminItem} : (jornada.esVip ? {...styles.adminJornadaItem, ...styles.jornadaVip} : styles.adminJornadaItem)}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap'}}><p><strong>{jornada.id === 'jornada_test' ? 'Jornada de Prueba' : `Jornada ${jornada.numeroJornada || 'Copa'}`}:</strong> {jornada.equipoLocal} vs {jornada.equipoVisitante}</p><div style={styles.vipToggleContainer}><label htmlFor={`vip-toggle-${jornada.id}`}>⭐ VIP</label><input id={`vip-toggle-${jornada.id}`} type="checkbox" checked={esVip} onChange={(e) => setEsVip(e.target.checked)} style={styles.checkbox}/></div></div>
            <div style={styles.adminControls}>
                <div><label style={styles.label}>Estado:</label><select value={estado} onChange={(e) => setEstado(e.target.value)} style={styles.adminSelect}><option value="Próximamente">Próximamente</option><option value="Abierta">Abierta</option><option value="Cerrada">Cerrada</option><option value="Finalizada">Finalizada</option></select></div>
                <div><label style={styles.label}>Resultado Final:</label><div style={styles.resultInputContainer}><input type="number" min="0" value={resultadoLocal} onChange={(e) => setResultadoLocal(e.target.value)} style={styles.resultInput} /><span style={styles.separator}>-</span><input type="number" min="0" value={resultadoVisitante} onChange={(e) => setResultadoVisitante(e.target.value)} style={styles.resultInput} /></div></div>
                <div><label style={styles.label}>Primer Goleador:</label><input type="text" value={goleador} onChange={(e) => setGoleador(e.target.value)} style={styles.adminInput} /></div>
                <div><label style={styles.label}>Resultado 1X2:</label><select value={resultado1x2} onChange={(e) => setResultado1x2(e.target.value)} style={styles.adminSelect}><option value="">-- Elige --</option><option value="Gana UD Las Palmas">Gana UDLP</option><option value="Empate">Empate</option><option value="Pierde UD Las Palmas">Pierde UDLP</option></select></div>
                <div><label style={styles.label}>Apertura Apuestas:</label><input type="datetime-local" value={fechaApertura} onChange={(e) => setFechaApertura(e.target.value)} style={styles.adminInput} /></div>
                <div><label style={styles.label}>Cierre Apuestas:</label><input type="datetime-local" value={fechaCierre} onChange={(e) => setFechaCierre(e.target.value)} style={styles.adminInput} /></div>
            </div>
            <div style={{marginTop: '10px'}}><label style={styles.label}>Mensaje para la Pantalla Principal:</label><textarea value={splashMessage} onChange={(e) => setSplashMessage(e.target.value)} style={{...styles.input, width: '95%', height: '50px'}} /></div>
            <div style={{marginTop: '10px'}}><label style={styles.label}>URL Imagen del Estadio:</label><input type="text" value={estadioImageUrl} onChange={(e) => setEstadioImageUrl(e.target.value)} style={{...styles.input, width: '95%'}} /></div>
            <div style={{marginTop: '20px'}}><button onClick={handleSaveChanges} disabled={isSaving} style={styles.saveButton}>{isSaving ? 'Guardando...' : 'Guardar Cambios'}</button><button onClick={handleCalcularPuntos} disabled={isCalculating || jornada.estado === 'Finalizada'} style={styles.saveButton}>{isCalculating ? 'Calculando...' : 'Calcular Puntos y Cerrar'}</button>{message && <span style={{marginLeft: '10px', color: styles.colors.success}}>{message}</span>}</div>
            
            {jornada.estado === 'Cerrada' && (
                <div style={styles.liveAdminContainer}>
                    <h4 style={styles.liveAdminTitle}>🔴 Control del Partido en Vivo</h4>
                    <div style={styles.adminControls}>
                        <div>
                            <label style={styles.label}>Marcador en Vivo:</label>
                            <div style={styles.resultInputContainer}>
                                <input type="number" min="0" value={liveData.golesLocal} onChange={(e) => setLiveData(d => ({ ...d, golesLocal: parseInt(e.target.value) || 0 }))} style={styles.resultInput} />
                                <span style={styles.separator}>-</span>
                                <input type="number" min="0" value={liveData.golesVisitante} onChange={(e) => setLiveData(d => ({ ...d, golesVisitante: parseInt(e.target.value) || 0 }))} style={styles.resultInput} />
                            </div>
                        </div>
                        <div>
                            <label style={styles.label}>Último Goleador:</label>
                            <input type="text" value={liveData.ultimoGoleador} onChange={(e) => setLiveData(d => ({...d, ultimoGoleador: e.target.value}))} style={styles.adminInput} placeholder="Nombre o 'SG'"/>
                        </div>
                    </div>
                    <button onClick={handleUpdateLiveScore} disabled={isSaving} style={{...styles.saveButton, backgroundColor: colors.danger, marginTop: '15px'}}>
                        {isSaving ? 'Actualizando...' : 'Actualizar Marcador en Vivo'}
                    </button>
                </div>
            )}
        </div>
    );
};

const AdminTestJornada = () => {
    const [isActive, setIsActive] = useState(false);
    const [loading, setLoading] = useState(true);
    const [populating, setPopulating] = useState(false);
    const testJornadaRef = useMemo(() => doc(db, "jornadas", "jornada_test"), []);

    useEffect(() => {
        const checkStatus = async () => {
            const docSnap = await getDoc(testJornadaRef);
            setIsActive(docSnap.exists());
            setLoading(false);
        }
        checkStatus();
    }, [testJornadaRef]);

    const handleToggleTestJornada = async () => {
        setLoading(true);
        if (isActive) {
            await deleteDoc(testJornadaRef);
            // Opcional: borrar también los pronósticos de prueba
            const pronosticosRef = collection(db, "pronosticos", "jornada_test", "jugadores");
            const pronosticosSnap = await getDocs(pronosticosRef);
            const batch = writeBatch(db);
            pronosticosSnap.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();

            setIsActive(false);
            alert("Jornada de prueba desactivada y apuestas borradas.");
        } else {
            const testJornadaData = {
                numeroJornada: 99,
                equipoLocal: "Real Zaragoza",
                equipoVisitante: "RC Deportivo",
                estado: "Cerrada",
                esVip: false,
                bote: 0,
                fechaStr: "Partido de Prueba",
                estadio: "Estadio de Pruebas",
                liveData: { isLive: false, golesLocal: 0, golesVisitante: 0, ultimoGoleador: '' }
            };
            await setDoc(testJornadaRef, testJornadaData);
            setIsActive(true);
            alert("Jornada de prueba activada. Ahora está en estado 'Cerrada' y visible en el panel. Puedes generar apuestas falsas.");
        }
        setLoading(false);
    };

    const handlePopulateBets = async () => {
        setPopulating(true);
        const batch = writeBatch(db);
        const resultados1x2 = ["Gana UD Las Palmas", "Empate", "Pierde UD Las Palmas"];

        JUGADORES.forEach(jugador => {
            const pronosticoRef = doc(db, "pronosticos", "jornada_test", "jugadores", jugador);
            const fakePronostico = {
                golesLocal: Math.floor(Math.random() * 4),
                golesVisitante: Math.floor(Math.random() * 4),
                resultado1x2: resultados1x2[Math.floor(Math.random() * 3)],
                goleador: `Jugador ${Math.floor(Math.random() * 10)}`,
                sinGoleador: false,
                jokerActivo: false,
                pagado: true,
            };
            batch.set(pronosticoRef, fakePronostico);
        });

        try {
            await batch.commit();
            alert("¡Apuestas falsas generadas para todos los jugadores en la jornada de prueba!");
        } catch (error) {
            console.error("Error al generar apuestas falsas:", error);
            alert("Error al generar apuestas.");
        }
        setPopulating(false);
    };

    return (
        <div style={{...styles.adminJornadaItem, ...styles.testJornadaAdminItem}}>
            <h3 style={styles.formSectionTitle}>🧪 Jornada de Prueba</h3>
            <p style={{textAlign: 'center', margin: '10px 0'}}>Usa esta opción para crear una jornada falsa en estado "Cerrada" y probar la funcionalidad del marcador en vivo sin afectar a las jornadas reales.</p>
            <div style={{display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap'}}>
                <button 
                    onClick={handleToggleTestJornada} 
                    disabled={loading} 
                    style={{...styles.mainButton, backgroundColor: isActive ? colors.danger : colors.success, borderColor: isActive ? colors.danger : colors.success, margin: '10px 0'}}
                >
                    {loading ? 'Cargando...' : (isActive ? 'Desactivar Jornada' : 'Activar Jornada')}
                </button>
                {isActive && (
                    <button
                        onClick={handlePopulateBets}
                        disabled={populating}
                        style={{...styles.mainButton, backgroundColor: colors.blue, borderColor: colors.blue, margin: '10px 0'}}
                    >
                        {populating ? 'Generando...' : 'Generar Apuestas Falsas'}
                    </button>
                )}
            </div>
        </div>
    );
}

const AdminEscudosManager = ({ onBack, teamLogos }) => {
    const [urls, setUrls] = useState(teamLogos || {});
    const [saving, setSaving] = useState({});

    useEffect(() => {
        setUrls(teamLogos || {});
    }, [teamLogos]);

    const handleUrlChange = (teamName, value) => {
        setUrls(prev => ({ ...prev, [teamName]: value }));
    };

    const handleSave = async (teamName) => {
        setSaving(prev => ({ ...prev, [teamName]: true }));
        const docRef = doc(db, "configuracion", "escudos");
        try {
            await setDoc(docRef, { [teamName]: urls[teamName] }, { merge: true });
        } catch (error) {
            console.error("Error al guardar el escudo:", error);
            alert("Error al guardar el escudo.");
        } finally {
            setSaving(prev => ({ ...prev, [teamName]: false }));
        }
    };

    return (
        <div style={styles.adminJornadaItem}>
            <h3 style={styles.formSectionTitle}>Gestión de Escudos de Equipos</h3>
            <p style={{textAlign: 'center', marginBottom: '20px'}}>Pega la URL de la imagen del escudo para cada equipo y pulsa "Guardar".</p>
            <div style={styles.escudosGrid}>
                {EQUIPOS_LIGA.map(teamName => (
                    <div key={teamName} style={styles.escudoCard}>
                        <img 
                            src={urls[teamName] || 'https://placehold.co/80x80/1b263b/e0e1dd?text=?'} 
                            style={styles.escudoCardImg} 
                            alt={teamName} 
                            onError={(e) => { e.target.src = 'https://placehold.co/80x80/e63946/ffffff?text=Error'; }}
                        />
                        <p style={styles.escudoCardName}>{teamName}</p>
                        <input
                            type="text"
                            value={urls[teamName] || ''}
                            onChange={(e) => handleUrlChange(teamName, e.target.value)}
                            placeholder="Pega la URL del escudo aquí"
                            style={styles.escudoInput}
                        />
                        <button onClick={() => handleSave(teamName)} disabled={saving[teamName]} style={styles.escudoSaveButton}>
                            {saving[teamName] ? '...' : 'Guardar'}
                        </button>
                    </div>
                ))}
            </div>
            <button onClick={onBack} style={{...styles.mainButton, backgroundColor: styles.colors.blue, borderColor: styles.colors.blue}}>Volver al Panel</button>
        </div>
    );
};

const AdminPorraAnual = () => {
    const [config, setConfig] = useState({ estado: '', ascensoFinal: '', posicionFinal: '' });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [calculating, setCalculating] = useState(false);
    const [message, setMessage] = useState('');

    const configRef = useMemo(() => doc(db, "configuracion", "porraAnual"), []);

    useEffect(() => {
        setLoading(true);
        getDoc(configRef).then((docSnap) => {
            if (docSnap.exists()) {
                setConfig(docSnap.data());
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
            await setDoc(configRef, config, { merge: true });
            setMessage('¡Configuración guardada!');
        } catch (error) {
            console.error("Error guardando config anual", error);
            setMessage('Error al guardar.');
        } finally {
            setSaving(false);
            setTimeout(() => setMessage(''), 3000);
        }
    };

    const handleCalcularPuntosAnual = async () => {
        if (!config.ascensoFinal || !config.posicionFinal) {
            alert("Debes establecer el resultado de Ascenso y la Posición Final antes de calcular.");
            return;
        }
        if (!window.confirm("¿Seguro que quieres calcular y repartir los puntos de la Porra Anual? Esta acción es irreversible.")) {
            return;
        }

        setCalculating(true);
        const pronosticosRef = collection(db, "porraAnualPronosticos");
        const pronosticosSnap = await getDocs(pronosticosRef);
        const pronosticos = pronosticosSnap.docs.map(p => ({ id: p.id, ...p.data() }));
        const batch = writeBatch(db);

        for (const p of pronosticos) {
            let puntosObtenidos = 0;
            const aciertoAscenso = p.ascenso === config.ascensoFinal;
            const aciertoPosicion = parseInt(p.posicion) === parseInt(config.posicionFinal);

            if (aciertoAscenso && aciertoPosicion) {
                puntosObtenidos = 20;
            } else if (aciertoAscenso) {
                puntosObtenidos = 5;
            } else if (aciertoPosicion) {
                puntosObtenidos = 10;
            }

            if (puntosObtenidos > 0) {
                const clasificacionRef = doc(db, "clasificacion", p.id);
                batch.update(clasificacionRef, { puntosTotales: increment(puntosObtenidos) });
            }
            
            const pronosticoAnualRef = doc(db, "porraAnualPronosticos", p.id);
            batch.update(pronosticoAnualRef, { puntosObtenidos });
        }
        
        batch.update(configRef, { estado: "Finalizada" });

        try {
            await batch.commit();
            setMessage("¡Puntos de la Porra Anual calculados y repartidos con éxito!");
        } catch (error) {
            console.error("Error al calcular puntos anuales:", error);
            setMessage("Error al calcular los puntos.");
        } finally {
            setCalculating(false);
        }
    };

    if (loading) return <p>Cargando configuración de la Porra Anual...</p>;

    return (
        <div style={styles.adminJornadaItem}>
            <h3 style={styles.formSectionTitle}>Gestión Porra Anual</h3>
            <div style={styles.adminControls}>
                <div>
                    <label style={styles.label}>Estado de la Porra</label>
                    <select 
                        value={config.estado || ''} 
                        onChange={(e) => setConfig(c => ({ ...c, estado: e.target.value }))}
                        style={styles.adminSelect}
                    >
                        <option value="Inactiva">Inactiva</option>
                        <option value="Abierta">Abierta</option>
                        <option value="Cerrada">Cerrada</option>
                        <option value="Finalizada">Finalizada</option>
                    </select>
                </div>
                 <div>
                    <label style={styles.label}>Resultado Ascenso</label>
                    <select 
                        value={config.ascensoFinal || ''} 
                        onChange={(e) => setConfig(c => ({ ...c, ascensoFinal: e.target.value }))}
                        style={styles.adminSelect}
                    >
                        <option value="">-- Pendiente --</option>
                        <option value="SI">SI</option>
                        <option value="NO">NO</option>
                    </select>
                </div>
                 <div>
                    <label style={styles.label}>Posición Final</label>
                    <input 
                        type="number"
                        min="1"
                        max="22"
                        value={config.posicionFinal || ''}
                        onChange={(e) => setConfig(c => ({ ...c, posicionFinal: e.target.value }))}
                        style={styles.adminInput}
                    />
                </div>
            </div>
            <div style={{marginTop: '20px'}}>
                <button onClick={handleSaveConfig} disabled={saving} style={styles.saveButton}>
                    {saving ? 'Guardando...' : 'Guardar Configuración'}
                </button>
                <button 
                    onClick={handleCalcularPuntosAnual} 
                    disabled={calculating || config.estado !== 'Cerrada'} 
                    style={{...styles.saveButton, backgroundColor: styles.colors.gold, color: styles.colors.deepBlue}}
                >
                    {calculating ? 'Calculando...' : 'Calcular Puntos Finales'}
                </button>
            </div>
             {message && <p style={{...styles.message, marginTop: '15px'}}>{message}</p>}
        </div>
    );
};

const AdminPanelScreen = ({ teamLogos }) => {
    const [jornadas, setJornadas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('main'); // 'main' o 'escudos'

    useEffect(() => {
        const q = query(collection(db, "jornadas"), orderBy("numeroJornada"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const jornadasData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setJornadas(jornadasData);
            setLoading(false);
        }, (error) => {
            console.error("Error al cargar jornadas: ", error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    if (loading) return <p style={{color: styles.colors.lightText}}>Cargando datos de administración...</p>;

    if (view === 'escudos') {
        return <AdminEscudosManager onBack={() => setView('main')} teamLogos={teamLogos} />;
    }

    return (
        <div>
            <h2 style={styles.title}>PANEL DE ADMINISTRADOR</h2>
            <AdminTestJornada />
            <button onClick={() => setView('escudos')} style={{...styles.mainButton, marginBottom: '20px'}}>Gestionar Escudos de Equipos</button>
            <AdminPorraAnual />
            <h3 style={{...styles.title, fontSize: '1.5rem', marginTop: '40px'}}>Gestión de Jornadas</h3>
            <div style={styles.jornadaList}>
                {jornadas.map(jornada => (<JornadaAdminItem key={jornada.id} jornada={jornada} />))}
            </div>
        </div>
    );
};

const JornadaDetalleScreen = ({ jornadaId, onBack, teamLogos }) => {
    const [jornada, setJornada] = useState(null);
    const [pronosticos, setPronosticos] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        const jornadaRef = doc(db, "jornadas", jornadaId);
        const unsubJornada = onSnapshot(jornadaRef, (docSnap) => {
            if (docSnap.exists()) {
                setJornada({ id: docSnap.id, ...docSnap.data() });
            }
        });
        const pronosticosRef = collection(db, "pronosticos", jornadaId, "jugadores");
        const unsubPronosticos = onSnapshot(pronosticosRef, (snapshot) => {
            const pronosticosData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPronosticos(pronosticosData);
            setLoading(false);
        });
        return () => { unsubJornada(); unsubPronosticos(); };
    }, [jornadaId]);

    const pronosticosMap = useMemo(() =>
        pronosticos.reduce((acc, p) => {
            acc[p.id] = p;
            return acc;
        }, {}),
    [pronosticos]);

    if (loading) return <p style={{color: styles.colors.lightText}}>Cargando detalles...</p>;

    const showPronosticos = jornada?.estado === 'Cerrada' || jornada?.estado === 'Finalizada';

    return (
        <div>
            <button onClick={onBack} style={styles.backButton}>&larr; Volver al Calendario</button>
            {jornada && (
                <>
                    <h2 style={styles.title}>DETALLE JORNADA {jornada.numeroJornada}</h2>
                    <div style={styles.matchHeader}>
                        <TeamDisplay teamLogos={teamLogos} teamName={jornada.equipoLocal} imgStyle={{width: 40, height: 40}} />
                        <h3 style={styles.formSectionTitle}>{jornada.equipoLocal} vs {jornada.equipoVisitante}</h3>
                        <TeamDisplay teamLogos={teamLogos} teamName={jornada.equipoVisitante} imgStyle={{width: 40, height: 40}} />
                    </div>
                    
                    {jornada.estado === 'Finalizada' && (
                        <p style={styles.finalResult}>Resultado Final: {jornada.resultadoLocal} - {jornada.resultadoVisitante}</p>
                    )}
                    
                    {showPronosticos && jornada.ganadores && jornada.ganadores.length > 0 && (
                        <div style={styles.winnerBanner}>🏆 Ganador(es): {jornada.ganadores.join(', ')}</div>
                    )}
                    
                    {showPronosticos && jornada.ganadores && jornada.ganadores.length === 0 && (
                         <div style={styles.boteBanner}>💰 ¡BOTE! Nadie acertó el resultado.</div>
                    )}

                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>Jugador</th>
                                <th style={styles.th}>Pronóstico</th>
                                <th style={styles.th}>Puntos</th>
                                <th style={styles.th}>Pagado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {JUGADORES.map((jugadorId, index) => {
                                const p = pronosticosMap[jugadorId];

                                if (!p) {
                                    return (
                                        <tr key={jugadorId} style={styles.tr}>
                                            <td style={styles.td}>{jugadorId}</td>
                                            <td colSpan="3" style={{...styles.td, fontStyle: 'italic', opacity: 0.6, textAlign: 'center' }}>
                                                No ha realizado pronóstico
                                            </td>
                                        </tr>
                                    );
                                }

                                if (showPronosticos) {
                                    const esGanador = jornada.ganadores?.includes(p.id);
                                    return (
                                        <React.Fragment key={p.id}>
                                            <tr style={esGanador ? styles.winnerRow : styles.tr}>
                                                <td style={styles.td}>{p.id} {p.jokerActivo && '🃏'}</td>
                                                <td style={styles.td}>{p.golesLocal}-{p.golesVisitante} ({p.resultado1x2 || 'N/A'}) {p.goleador && `- ${p.goleador}`} {!p.goleador && p.sinGoleador && '- SG'}</td>
                                                <td style={styles.td}>{p.puntosObtenidos === undefined ? '-' : p.puntosObtenidos}</td>
                                                <td style={styles.td}>{p.pagado ? '✅' : '❌'}</td>
                                            </tr>
                                            {p.jokerActivo && p.jokerPronosticos && p.jokerPronosticos.length > 0 && (
                                                <tr style={styles.jokerDetailRow}>
                                                    <td style={styles.td} colSpan="4">
                                                        <div style={{paddingLeft: '20px'}}>
                                                            <strong>Apuestas JOKER:</strong>
                                                            <div style={{display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '5px'}}>
                                                                {p.jokerPronosticos.map((jp, index) => (
                                                                    <span key={index} style={styles.jokerDetailChip}>{jp.golesLocal}-{jp.golesVisitante}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                } else {
                                    const secretMessage = SECRET_MESSAGES[index % SECRET_MESSAGES.length];
                                    return (
                                         <tr key={p.id} style={styles.tr}>
                                            <td style={styles.td}>{p.id} {p.jokerActivo && '🃏'}</td>
                                            <td style={styles.td}>{secretMessage}</td>
                                            <td style={styles.td}>-</td>
                                            <td style={styles.td}>-</td>
                                        </tr>
                                    );
                                }
                            })}
                        </tbody>
                    </table>
                </>
            )}
        </div>
    );
};

const AdminLoginModal = ({ onClose, onSuccess }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (password === ADMIN_PASSWORD) {
            onSuccess();
        } else {
            setError('Contraseña incorrecta');
        }
    };

    return (
        <div style={styles.modalOverlay}>
            <div style={styles.modalContent}>
                <h3 style={styles.title}>ACCESO ADMIN</h3>
                <form onSubmit={handleSubmit}>
                    <label style={styles.label}>Contraseña:</label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={styles.input}/>
                    {error && <p style={{color: styles.colors.danger}}>{error}</p>}
                    <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '20px'}}>
                        <button type="button" onClick={onClose} style={{...styles.mainButton, backgroundColor: styles.colors.blue}}>CANCELAR</button>
                        <button type="submit" style={styles.mainButton}>ENTRAR</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const PagosScreen = ({ user }) => {
    const [jornadas, setJornadas] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, "jornadas"), where("estado", "==", "Finalizada"), orderBy("numeroJornada", "desc"));
        const unsubscribe = onSnapshot(q, (jornadasSnap) => {
            const jornadasData = jornadasSnap.docs.map(jornadaDoc => ({ id: jornadaDoc.id, ...jornadaDoc.data(), pronosticos: [] }));
            const promises = jornadasData.map(jornada => getDocs(collection(db, "pronosticos", jornada.id, "jugadores")));
            Promise.all(promises).then(pronosticosSnaps => {
                pronosticosSnaps.forEach((pronosticosSnap, index) => {
                    jornadasData[index].pronosticos = pronosticosSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
                });
                setJornadas(jornadasData);
                setLoading(false);
            });
        });
        return () => unsubscribe();
    }, []);

    const handlePagoChange = async (jornadaId, jugadorId, haPagado) => {
        const pronosticoRef = doc(db, "pronosticos", jornadaId, "jugadores", jugadorId);
        await updateDoc(pronosticoRef, { pagado: haPagado });
    };

    const handleVerificacionChange = async (jornadaId, jugadorId, verificado) => {
        const pronosticoRef = doc(db, "pronosticos", jornadaId, "jugadores", jugadorId);
        await updateDoc(pronosticoRef, { verificado: verificado });
    };

    if (loading) return <p style={{color: styles.colors.lightText}}>Cargando historial de pagos...</p>;

    return (
        <div>
            <h2 style={styles.title}>GESTIÓN DE PAGOS</h2>
            {jornadas.map(jornada => (
                <div key={jornada.id} style={styles.adminJornadaItem}>
                    <h4 style={styles.formSectionTitle}>Jornada {jornada.numeroJornada}: {jornada.equipoLocal} vs {jornada.equipoVisitante}</h4>
                    <table style={styles.table}>
                        <thead><tr><th style={styles.th}>Jugador</th><th style={styles.th}>Pagado</th><th style={styles.th}>Verificado (Admin)</th></tr></thead>
                        <tbody>
                            {JUGADORES.map(jugadorId => {
                                const pronostico = jornada.pronosticos.find(p => p.id === jugadorId);
                                if (!pronostico) return null;
                                return (
                                    <tr key={jugadorId} style={styles.tr}>
                                        <td style={styles.td}>{jugadorId}</td>
                                        <td style={styles.td}><input type="checkbox" checked={pronostico.pagado || false} onChange={(e) => handlePagoChange(jornada.id, jugadorId, e.target.checked)} disabled={user !== jugadorId} style={styles.checkbox}/></td>
                                        <td style={styles.td}><input type="checkbox" checked={pronostico.verificado || false} onChange={(e) => handleVerificacionChange(jornada.id, jugadorId, e.target.checked)} disabled={user !== 'Juanma'} style={styles.checkbox}/></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ))}
        </div>
    );
};

const PorraAnualScreen = ({ user, onBack, config }) => {
    const [pronostico, setPronostico] = useState({ ascenso: '', posicion: '' });
    const [miPronostico, setMiPronostico] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);

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

    const handleGuardar = async (e) => {
        e.preventDefault();
        if (!pronostico.ascenso || !pronostico.posicion) {
            setMessage("Debes rellenar ambos campos.");
            return;
        }
        setIsSaving(true);
        const pronosticoRef = doc(db, "porraAnualPronosticos", user);
        try {
            await setDoc(pronosticoRef, { 
                ...pronostico, 
                jugador: user,
                lastUpdated: new Date()
            });
            setMessage("¡Tu pronóstico anual ha sido guardado! Suerte al final de la liga.");
            setMiPronostico(pronostico);
            setTimeout(() => {
                onBack();
            }, 4000);
        } catch (error) {
            console.error("Error al guardar pronóstico anual:", error);
            setMessage("Hubo un error al guardar tu pronóstico.");
        }
        setIsSaving(false);
    };

    if (loading) {
        return <p style={{color: styles.colors.lightText}}>Cargando tu pronóstico...</p>;
    }

    if (config?.estado !== 'Abierta' || miPronostico) {
        return (
            <div>
                <button onClick={onBack} style={styles.backButton}>&larr; Volver</button>
                <h2 style={styles.title}>⭐ PORRA ANUAL ⭐</h2>
                <div style={styles.placeholder}>
                    {miPronostico ? (
                        <>
                            <h3>Ya has hecho tu apuesta especial</h3>
                            <p>Tu pronóstico guardado es:</p>
                            <p><strong>¿Asciende?:</strong> {miPronostico.ascenso}</p>
                            <p><strong>Posición Final:</strong> {miPronostico.posicion}º</p>
                            <p style={{marginTop: '20px', fontStyle: 'italic'}}>¡Suerte al final de la liga!</p>
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
            <h2 style={styles.title}>⭐ PORRA ANUAL ⭐</h2>
            <form onSubmit={handleGuardar} style={styles.form}>
                <p style={{textAlign: 'center', marginBottom: '30px', fontSize: '1.1rem'}}>
                    Haz tu pronóstico para el final de la temporada. ¡Solo puedes hacerlo una vez!
                </p>
                <div style={styles.formGroup}>
                    <label style={styles.label}>1. ¿Asciende la UD Las Palmas? <span style={styles.pointsReminder}>(5 Puntos)</span></label>
                    <div style={styles.ascensoButtonsContainer}>
                         <button type="button" onClick={() => setPronostico(p => ({...p, ascenso: 'SI'}))} style={pronostico.ascenso === 'SI' ? styles.ascensoButtonActive : styles.ascensoButton}>SÍ</button>
                         <button type="button" onClick={() => setPronostico(p => ({...p, ascenso: 'NO'}))} style={pronostico.ascenso === 'NO' ? styles.ascensoButtonActive : styles.ascensoButton}>NO</button>
                    </div>
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label}>2. ¿En qué posición terminará? <span style={styles.pointsReminder}>(10 Puntos)</span></label>
                    <input 
                        type="number" 
                        min="1" 
                        max="22" 
                        name="posicion"
                        value={pronostico.posicion}
                        onChange={(e) => setPronostico(p => ({...p, posicion: e.target.value}))}
                        style={{...styles.input, textAlign: 'center', fontSize: '2rem', fontFamily: "'Orbitron', sans-serif"}}
                        placeholder="1-22"
                    />
                </div>
                <p style={{textAlign: 'center', color: styles.colors.gold, fontWeight: 'bold', fontStyle: 'italic'}}>
                    ⭐ ¡Si aciertas las dos preguntas ganarás 20 PUNTOS! ⭐
                </p>
                <button type="submit" disabled={isSaving} style={styles.mainButton}>
                    {isSaving ? 'GUARDANDO...' : 'GUARDAR PRONÓSTICO ANUAL'}
                </button>
                {message && <p style={{...styles.message, backgroundColor: styles.colors.success}}>{message}</p>}
            </form>
        </div>
    );
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

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
        if (!user) {
            signInAnonymously(auth).catch((error) => console.error("Error de autenticación anónima:", error));
        }
    });

    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = `
      @import url('https://fonts.googleapis.com/css2?family=Teko:wght@700&display=swap');
      @keyframes fall { 0% { transform: translateY(-100px) rotate(0deg); opacity: 1; } 100% { transform: translateY(100vh) rotate(360deg); opacity: 0; } }
      .exploded { transition: transform 1s ease-out, opacity 1s ease-out; }
      @keyframes trophy-grow { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      @keyframes text-fade-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes highlight { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
      .content-enter-active { animation: fadeIn 0.3s ease-in-out; }
      @keyframes pop-in { 0% { opacity: 0; transform: scale(0.8); } 100% { opacity: 1; transform: scale(1); } }
      .stats-indicator { animation: pop-in 0.5s cubic-bezier(0.25, 1, 0.5, 1) forwards; }
      @keyframes confetti-fall { 0% { transform: translateY(-100vh) rotate(0deg); } 100% { transform: translateY(100vh) rotate(720deg); } }
      .confetti-particle { position: absolute; width: 10px; height: 10px; background-color: var(--color); top: 0; left: var(--x); animation: confetti-fall 5s linear var(--delay) infinite; }
      @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      .spinner { animation: spin 1.5s linear infinite; }
      @keyframes title-shine { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
      #orientation-lock { display: none; }
      @media (orientation: portrait) {
        #app-container { display: none !important; }
        #orientation-lock { display: flex; justify-content: center; align-items: center; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: ${styles.colors.deepBlue}; color: ${styles.colors.lightText}; z-index: 9999; }
      }
      @keyframes blink-live { 50% { background-color: #a11d27; } }
    `;
    document.head.appendChild(styleSheet);
    
    const configRef = doc(db, "configuracion", "porraAnual");
    const unsubscribeConfig = onSnapshot(configRef, (doc) => {
        setPorraAnualConfig(doc.exists() ? doc.data() : null);
    });

    const escudosRef = doc(db, "configuracion", "escudos");
    const unsubscribeEscudos = onSnapshot(escudosRef, (docSnap) => {
        if (docSnap.exists()) {
            setTeamLogos(docSnap.data());
        }
    });
    
    const qLive = query(collection(db, "jornadas"), where("liveData.isLive", "==", true), limit(1));
    const unsubscribeLive = onSnapshot(qLive, (snapshot) => {
        if (!snapshot.empty) {
            const jornada = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
            setLiveJornada(jornada);
        } else {
            setLiveJornada(null);
        }
    });


    return () => {
        document.head.removeChild(styleSheet);
        unsubscribeConfig();
        unsubscribeAuth();
        unsubscribeEscudos();
        unsubscribeLive();
    }
  }, []);

  const handleLogin = async (user) => {
      setCurrentUser(user);
      setScreen('app');
      const q = query(collection(db, "jornadas"), where("estado", "==", "Finalizada"), orderBy("numeroJornada", "desc"), limit(1));
      const jornadaSnap = await getDocs(q);
      if (!jornadaSnap.empty) {
          const jornadaDoc = jornadaSnap.docs[0];
          const jornada = { id: jornadaDoc.id, ...jornadaDoc.data() };
          const lastSeenWinnerJornada = sessionStorage.getItem('lastSeenWinnerJornada');
          if (jornada.id !== lastSeenWinnerJornada && jornada.ganadores?.includes(user)) {
              const pronosticoRef = doc(db, "pronosticos", jornada.id, "jugadores", user);
              const pronosticoSnap = await getDoc(pronosticoRef);
              const allPronosticosSnap = await getDocs(collection(db, "pronosticos", jornada.id, "jugadores"));
              const prize = (allPronosticosSnap.size * (jornada.esVip ? APUESTA_VIP : APUESTA_NORMAL)) + (jornada.bote || 0);
              if (pronosticoSnap.exists()) {
                  setWinnerData({
                      pronostico: { id: user, ...pronosticoSnap.data() },
                      prize: prize / jornada.ganadores.length
                  });
                  sessionStorage.setItem('lastSeenWinnerJornada', jornada.id);
              }
          }
      }
  };

  const handleNavClick = (tab) => { setViewingJornadaId(null); setViewingPorraAnual(false); setActiveTab(tab); if (tab !== 'admin') { setIsAdminAuthenticated(false); } };
  const handleAdminClick = () => { if (isAdminAuthenticated) { setActiveTab('admin'); } else { setShowAdminLogin(true); } };
  const handleAdminLoginSuccess = () => { setIsAdminAuthenticated(true); setShowAdminLogin(false); setActiveTab('admin'); };

  const renderContent = () => {
    if (showInitialSplash) return <InitialSplashScreen onFinish={() => setShowInitialSplash(false)} teamLogos={teamLogos} />;
    if (screen === 'splash') return <SplashScreen onEnter={() => setScreen('login')} teamLogos={teamLogos} />;
    if (screen === 'login') return <LoginScreen onLogin={handleLogin} />;
    if (screen === 'app') {
        const CurrentScreen = () => {
            if (viewingJornadaId) return <JornadaDetalleScreen jornadaId={viewingJornadaId} onBack={() => setViewingJornadaId(null)} teamLogos={teamLogos} />;
            if (viewingPorraAnual) return <PorraAnualScreen user={currentUser} onBack={() => setViewingPorraAnual(false)} config={porraAnualConfig} />;
            switch (activeTab) {
                case 'miJornada': return <MiJornadaScreen user={currentUser} setActiveTab={handleNavClick} teamLogos={teamLogos} liveData={liveJornada?.liveData} />;
                case 'laJornada': return <LaJornadaScreen teamLogos={teamLogos} liveData={liveJornada?.liveData} />;
                case 'calendario': return <CalendarioScreen onViewJornada={setViewingJornadaId} teamLogos={teamLogos} />;
                case 'clasificacion': return <ClasificacionScreen currentUser={currentUser} liveData={liveJornada?.liveData} liveJornada={liveJornada} />;
                case 'pagos': return <PagosScreen user={currentUser} />;
                case 'admin': return isAdminAuthenticated ? <AdminPanelScreen teamLogos={teamLogos} /> : null;
                default: return null;
            }
        };
      return (
        <>
          {showAdminLogin && <AdminLoginModal onClose={() => setShowAdminLogin(false)} onSuccess={handleAdminLoginSuccess} />}
          {porraAnualConfig?.estado === 'Abierta' && !viewingPorraAnual && (
            <div style={styles.porraAnualBanner} onClick={() => setViewingPorraAnual(true)}>
                ⭐ ¡PORRA ANUAL ABIERTA! ⭐ Haz tu pronóstico antes de la Jornada 5. ¡Pincha aquí!
            </div>
          )}
          <LiveBanner liveData={liveJornada?.liveData} jornada={liveJornada} />
          <nav style={styles.navbar}>
            <button onClick={() => handleNavClick('miJornada')} style={activeTab === 'miJornada' ? styles.navButtonActive : styles.navButton}>Mi Jornada</button>
            <button onClick={() => handleNavClick('laJornada')} style={activeTab === 'laJornada' ? styles.navButtonActive : styles.navButton}>La Jornada</button>
            <button onClick={() => handleNavClick('calendario')} style={activeTab === 'calendario' ? styles.navButtonActive : styles.navButton}>Calendario</button>
            <button onClick={() => handleNavClick('clasificacion')} style={activeTab === 'clasificacion' ? styles.navButtonActive : styles.navButton}>Clasificación</button>
            <button onClick={() => handleNavClick('pagos')} style={activeTab === 'pagos' ? styles.navButtonActive : styles.navButton}>Pagos</button>
            {currentUser === 'Juanma' && (<button onClick={handleAdminClick} style={activeTab === 'admin' ? styles.navButtonActive : styles.navButton}>Admin</button>)}
            <button onClick={() => { setCurrentUser(null); setScreen('login'); setIsAdminAuthenticated(false); }} style={styles.logoutButton}>Salir</button>
          </nav>
          <div key={activeTab} className="content-enter-active" style={styles.content}>
            <CurrentScreen />
          </div>
        </>
      );
    }
  };
  return (
    <>
        <OrientationLock />
        {winnerData && <WinnerAnimation winnerData={winnerData} onClose={() => setWinnerData(null)} />}
        <div id="app-container" style={styles.container}>
            <div style={styles.card}>{renderContent()}</div>
        </div>
    </>
  );
}

// ============================================================================
// --- ESTILOS (CSS-in-JS) ---
// ============================================================================

const colors = {
    deepBlue: '#001d3d', blue: '#0055A4', yellow: '#FFC72C', gold: '#FFD700', silver: '#C0C0C0', bronze: '#CD7F32', lightText: '#f0f0f0', darkText: '#0a0a0a', danger: '#e63946', success: '#52b788', warning: '#fca311', darkUI: 'rgba(10, 25, 47, 0.85)', darkUIAlt: 'rgba(23, 42, 69, 0.85)', status: { 'Próximamente': '#6c757d', 'Abierta': '#52b788', 'Cerrada': '#e63946', 'Finalizada': '#0055A4' }
};

const styles = {
    colors,
    container: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: `linear-gradient(145deg, ${colors.deepBlue} 0%, #000 100%)`, padding: '20px', fontFamily: "'Exo 2', sans-serif" },
    card: { width: '100%', maxWidth: '850px', backgroundColor: colors.darkUI, color: colors.lightText, padding: '25px', borderRadius: '16px', boxShadow: `0 0 25px ${colors.blue}30, 0 10px 30px rgba(0, 0, 0, 0.5)`, minHeight: '80vh', border: `1px solid ${colors.blue}80`, backdropFilter: 'blur(10px)', },
    title: { fontFamily: "'Orbitron', sans-serif", color: colors.yellow, textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center', borderBottom: `2px solid ${colors.yellow}`, paddingBottom: '10px', marginBottom: '25px', textShadow: `0 0 10px ${colors.yellow}90`, fontSize: '1.8rem' },
    mainButton: { fontFamily: "'Orbitron', sans-serif", padding: '10px 25px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', border: `2px solid ${colors.yellow}`, borderRadius: '8px', backgroundColor: colors.yellow, color: colors.darkText, marginTop: '20px', transition: 'all 0.3s ease', textTransform: 'uppercase', letterSpacing: '1px', boxShadow: `0 0 15px ${colors.yellow}50`, ':hover': { backgroundColor: 'transparent', color: colors.yellow, transform: 'scale(1.05)' } },
    placeholder: { padding: '40px 20px', backgroundColor: 'rgba(0,0,0,0.2)', border: `2px dashed ${colors.blue}`, borderRadius: '12px', textAlign: 'center', color: colors.lightText },
    initialSplashContainer: { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: colors.deepBlue, animation: 'fadeIn 1s ease' },
    orientationLock: { textAlign: 'center' },
    rotateMessage: { marginTop: '30px', animation: 'fadeIn 2s ease-in-out', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' },
    loadingMessage: { marginTop: '30px', animation: 'fadeIn 2s ease-in-out', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' },
    splashContainer: { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', textAlign: 'center' },
    splashLogoContainer: { marginBottom: '20px', },
    splashLogo: { width: '120px', height: '120px', marginBottom: '10px', objectFit: 'contain' },
    splashTitle: { 
        fontFamily: "'Teko', sans-serif", 
        fontSize: '4.5rem', 
        fontWeight: '700', 
        textTransform: 'uppercase', 
        letterSpacing: '2px',
        background: `linear-gradient(90deg, ${colors.silver}, ${colors.lightText}, ${colors.yellow}, ${colors.lightText}, ${colors.silver})`,
        backgroundSize: '200% auto',
        color: 'transparent',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        animation: 'title-shine 5s linear infinite',
        textShadow: `0 2px 4px rgba(0,0,0,0.5)`
    },
    splashInfoBox: { border: `2px solid ${colors.yellow}80`, padding: '20px', borderRadius: '10px', marginTop: '30px', backgroundColor: 'rgba(0,0,0,0.3)', width: '90%', minHeight: '220px', display: 'flex', flexDirection: 'column', justifyContent: 'center' },
    splashInfoTitle: { margin: '0 0 15px 0', fontFamily: "'Orbitron', sans-serif", color: colors.yellow, textTransform: 'uppercase', fontSize: '1.2rem' },
    splashMatch: { fontSize: '1.3rem', fontWeight: 'bold' },
    splashAdminMessage: { fontStyle: 'italic', marginTop: '15px', borderTop: `1px solid ${colors.blue}`, paddingTop: '15px', color: colors.silver },
    splashBote: { color: colors.success, fontWeight: 'bold', fontSize: '1.1rem' },
    carouselStat: { padding: '10px', fontSize: '1rem', minHeight: '50px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' },
    loginContainer: { textAlign: 'center' },
    userList: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginTop: '30px' },
    userButton: { width: '100%', padding: '15px 10px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', border: `2px solid ${colors.blue}`, borderRadius: '8px', backgroundColor: 'transparent', color: colors.lightText, transition: 'all 0.3s ease', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', fontFamily: "'Exo 2', sans-serif", textTransform: 'uppercase', letterSpacing: '1px' },
    userButtonHover: { borderColor: colors.yellow, color: colors.yellow, transform: 'translateY(-5px)', boxShadow: `0 0 20px ${colors.yellow}50` },
    navbar: { display: 'flex', flexWrap: 'wrap', gap: '5px', borderBottom: `2px solid ${colors.blue}`, paddingBottom: '15px', marginBottom: '20px' },
    navButton: { padding: '8px 12px', fontSize: '0.9rem', border: 'none', borderBottom: '3px solid transparent', borderRadius: '6px 6px 0 0', backgroundColor: 'transparent', color: colors.lightText, cursor: 'pointer', transition: 'all 0.3s', textTransform: 'uppercase', fontWeight: '600' },
    navButtonActive: { padding: '8px 12px', fontSize: '0.9rem', border: 'none', borderBottom: `3px solid ${colors.yellow}`, borderRadius: '6px 6px 0 0', backgroundColor: colors.darkUIAlt, color: colors.yellow, cursor: 'pointer', textTransform: 'uppercase', fontWeight: '600' },
    logoutButton: { padding: '8px 12px', fontSize: '0.9rem', border: `1px solid ${colors.danger}`, borderRadius: '8px', backgroundColor: 'transparent', color: colors.danger, cursor: 'pointer', marginLeft: 'auto', transition: 'all 0.2s', fontWeight: '600', textTransform: 'uppercase' },
    content: { padding: '10px 0', animation: 'fadeIn 0.5s' },
    form: { backgroundColor: 'rgba(0,0,0,0.2)', padding: '25px', borderRadius: '12px', marginTop: '20px', border: `1px solid ${colors.blue}50` },
    formSectionTitle: { fontFamily: "'Orbitron', sans-serif", color: colors.lightText, fontSize: '1.3rem', textAlign: 'center', marginBottom: '20px' },
    formGroup: { marginBottom: '25px' },
    label: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginBottom: '10px', color: colors.yellow, fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.9rem', letterSpacing: '1px' },
    pointsReminder: { color: colors.silver, fontWeight: 'normal', fontSize: '0.8rem', textTransform: 'none' },
    input: { width: 'calc(100% - 24px)', padding: '12px', border: `1px solid ${colors.blue}`, borderRadius: '6px', backgroundColor: colors.deepBlue, color: colors.lightText, fontSize: '1rem', transition: 'all 0.3s ease' },
    resultInputContainer: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', justifyContent: 'center' },
    resultInput: { width: '50px', textAlign: 'center', padding: '10px', border: `1px solid ${colors.blue}`, borderRadius: '6px', backgroundColor: colors.deepBlue, color: colors.lightText, fontSize: '1.3rem', fontFamily: "'Orbitron', sans-serif", },
    betTeamContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', flex: 1, minWidth: '80px' },
    betTeamLogo: { width: '30px', height: '30px', objectFit: 'contain' },
    betTeamName: { fontSize: '0.9rem', fontWeight: '600', textAlign: 'center' },
    separator: { fontSize: '1.3rem', fontWeight: 'bold', color: colors.yellow },
    checkbox: { width: '20px', height: '20px', accentColor: colors.yellow },
    message: { marginTop: '20px', padding: '12px', borderRadius: '8px', backgroundColor: colors.darkUIAlt, color: colors.lightText, textAlign: 'center', fontWeight: 'bold' },
    table: { width: '100%', marginTop: '20px', borderCollapse: 'separate', borderSpacing: '0 5px', color: colors.lightText },
    th: { backgroundColor: 'transparent', color: colors.yellow, padding: '12px', borderBottom: `2px solid ${colors.yellow}`, textAlign: 'left', textTransform: 'uppercase', fontFamily: "'Orbitron', sans-serif", fontSize: '0.9rem' },
    tr: { backgroundColor: colors.darkUIAlt, transition: 'background-color 0.3s ease' },
    td: { padding: '12px', border: 'none', borderBottom: `1px solid ${colors.deepBlue}`, fontSize: '0.9rem' },
    tdRank: { padding: '12px', border: 'none', borderBottom: `1px solid ${colors.deepBlue}`, fontFamily: "'Orbitron', sans-serif", fontWeight: 'bold', fontSize: '1rem', textAlign: 'center' },
    top1Row: { background: `linear-gradient(90deg, ${colors.gold}90, ${colors.darkUIAlt} 80%)` },
    top2Row: { background: `linear-gradient(90deg, ${colors.silver}70, ${colors.darkUIAlt} 80%)` },
    top3Row: { background: `linear-gradient(90deg, ${colors.bronze}70, ${colors.darkUIAlt} 80%)` },
    currentUserRow: { animation: 'highlight 4s ease infinite', backgroundSize: '400% 400%', backgroundImage: `linear-gradient(to right, ${colors.blue}, ${colors.darkUIAlt}, ${colors.blue})` },
    tdIcon: { width: '40px', textAlign: 'center' },
    laJornadaContainer: { textAlign: 'center', padding: '20px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '12px', backgroundSize: 'cover', backgroundPosition: 'center' },
    matchInfo: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', fontSize: '1.5rem', fontWeight: 'bold', margin: '20px 0', fontFamily: "'Orbitron', sans-serif", flexWrap: 'wrap' },
    matchDetails: { display: 'flex', justifyContent: 'center', gap: '20px', color: colors.silver, marginBottom: '20px' },
    matchInfoLogo: { width: '80px', height: '80px' },
    vs: { color: colors.yellow, textShadow: `0 0 10px ${colors.yellow}`, fontSize: '2rem' },
    countdownContainer: { margin: '20px 0' },
    countdown: { fontFamily: "'Orbitron', sans-serif", fontSize: '2rem', fontWeight: 'bold', color: colors.yellow, backgroundColor: colors.deepBlue, padding: '10px 20px', borderRadius: '8px', display: 'inline-block', border: `1px solid ${colors.blue}` },
    callToAction: { fontSize: '1.2rem', fontStyle: 'italic', color: colors.lightText, marginTop: '20px' },
    apostadoresContainer: { marginTop: '30px', borderTop: `1px solid ${colors.blue}`, paddingTop: '20px' },
    apostadoresGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '8px', marginTop: '10px' },
    apostadorHecho: { padding: '8px', fontSize: '0.9rem', backgroundColor: colors.success, color: colors.darkText, borderRadius: '5px', textAlign: 'center', fontWeight: 'bold' },
    apostadorPendiente: { padding: '8px', fontSize: '0.9rem', backgroundColor: colors.darkUIAlt, color: colors.lightText, borderRadius: '5px', textAlign: 'center', opacity: 0.6 },
    jokerContainer: { marginTop: '30px', padding: '20px', borderTop: `2px solid ${colors.blue}`, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '8px' },
    jokerButton: { padding: '10px 20px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', border: `2px solid ${colors.gold}`, borderRadius: '8px', backgroundColor: 'transparent', color: colors.gold, transition: 'all 0.3s ease', textTransform: 'uppercase' },
    dangerButton: { borderColor: colors.danger, color: colors.danger },
    vipBanner: { background: `linear-gradient(45deg, ${colors.gold}, ${colors.yellow})`, color: colors.darkText, fontWeight: 'bold', padding: '15px', borderRadius: '8px', textAlign: 'center', marginBottom: '20px', fontSize: '1.1rem', fontFamily: "'Orbitron', sans-serif", boxShadow: `0 0 20px ${colors.gold}70` },
    jackpotBanner: { background: `linear-gradient(45deg, ${colors.success}, #2a9d8f)`, color: colors.lightText, fontWeight: 'bold', padding: '15px', borderRadius: '8px', textAlign: 'center', marginBottom: '20px', fontSize: '1.1rem', fontFamily: "'Orbitron', sans-serif", boxShadow: `0 0 20px ${colors.success}70`, textShadow: '1px 1px 2px #000' },
    jokerGrid: { display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center' },
    jokerBetRow: { marginBottom: '10px', width: '100%', maxWidth: '250px' },
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
    saveButton: { padding: '10px 18px', border: 'none', borderRadius: '5px', backgroundColor: colors.success, color: 'white', cursor: 'pointer', marginRight: '10px', textTransform: 'uppercase', fontWeight: 'bold' },
    vipToggleContainer: { display: 'flex', alignItems: 'center', gap: '10px' },
    backButton: { padding: '10px 15px', fontSize: '1rem', border: `1px solid ${colors.blue}`, borderRadius: '8px', backgroundColor: 'transparent', color: colors.lightText, cursor: 'pointer', transition: 'all 0.2s', marginBottom: '20px' },
    finalResult: { fontSize: '2rem', fontWeight: 'bold', color: colors.yellow, textAlign: 'center', margin: '20px 0', fontFamily: "'Orbitron', sans-serif", },
    winnerBanner: { background: `linear-gradient(45deg, ${colors.gold}, ${colors.yellow})`, color: colors.darkText, fontWeight: 'bold', padding: '15px', borderRadius: '8px', textAlign: 'center', margin: '20px 0', fontSize: '1.2rem', boxShadow: `0 0 20px ${colors.gold}70` },
    boteBanner: { backgroundColor: colors.danger, color: 'white', fontWeight: 'bold', padding: '15px', borderRadius: '8px', textAlign: 'center', margin: '20px 0', fontSize: '1.2rem' },
    winnerRow: { backgroundColor: `${colors.gold}30` },
    jokerDetailRow: { backgroundColor: `${colors.deepBlue}99` },
    jokerDetailChip: { backgroundColor: colors.blue, padding: '5px 10px', borderRadius: '15px', fontSize: '0.9rem', fontFamily: "'Orbitron', sans-serif", },
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(5px)' },
    modalContent: { backgroundColor: colors.darkUI, padding: '30px', borderRadius: '12px', width: '90%', maxWidth: '500px', border: `1px solid ${colors.yellow}` },
    resumenContainer: { display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' },
    resumenJugador: { backgroundColor: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '12px', borderLeft: `4px solid ${colors.blue}` },
    resumenJugadorTitle: { margin: '0 0 10px 0', paddingBottom: '10px', borderBottom: `1px solid ${colors.blue}80`, color: colors.yellow, fontFamily: "'Orbitron', sans-serif", },
    resumenJugadorBets: { fontSize: '0.95rem' },
    jokerChipsContainer: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' },
    pinLockContainer: { backgroundColor: 'rgba(0,0,0,0.3)', padding: '20px', borderRadius: '12px', marginBottom: '20px', border: `1px solid ${colors.yellow}` },
    statsIndicator: { display: 'block', textAlign: 'center', marginTop: '10px', fontWeight: 'bold' },
    jokerAnimationOverlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', overflow: 'hidden', zIndex: 9999, pointerEvents: 'none' },
    jokerIcon: { position: 'absolute', top: '-50px', fontSize: '3rem', animationName: 'fall', animationTimingFunction: 'linear', animationIterationCount: '1' },
    porraAnualBanner: { background: `linear-gradient(45deg, ${colors.gold}, ${colors.yellow})`, color: colors.darkText, fontWeight: 'bold', padding: '15px', borderRadius: '8px', textAlign: 'center', marginBottom: '20px', fontSize: '1rem', fontFamily: "'Orbitron', sans-serif", boxShadow: `0 0 20px ${colors.gold}70`, cursor: 'pointer' },
    porraAnualContainer: { marginTop: '30px', padding: '20px', borderTop: `2px solid ${colors.yellow}`, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '8px' },
    ascensoButtonsContainer: { display: 'flex', gap: '10px', justifyContent: 'center' },
    ascensoButton: { flex: 1, padding: '20px', fontSize: '1.5rem', fontWeight: 'bold', cursor: 'pointer', border: `2px solid ${colors.blue}`, borderRadius: '8px', backgroundColor: 'transparent', color: colors.lightText, transition: 'all 0.3s ease' },
    ascensoButtonActive: { flex: 1, padding: '20px', fontSize: '1.5rem', fontWeight: 'bold', cursor: 'pointer', border: `2px solid ${colors.yellow}`, borderRadius: '8px', backgroundColor: colors.yellow, color: colors.deepBlue, transition: 'all 0.3s ease' },
    teamDisplay: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' },
    teamLogo: { width: '40px', height: '40px', objectFit: 'contain' },
    teamNameText: { fontSize: '0.9rem', fontWeight: 'bold' },
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
};

export default App;
