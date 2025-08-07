import React, { useState, useEffect } from 'react';
// Importamos las funciones necesarias de Firebase, incluyendo 'increment' para sumar puntos
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDocs, onSnapshot, query, where, limit, writeBatch, updateDoc, orderBy, setDoc, getDoc, increment } from "firebase/firestore";

// --- CONFIGURACIÓN DE FIREBASE ---
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

// --- DATOS DE LA APLICACIÓN ---
const JUGADORES = ["Juanma", "Lucy", "Antonio", "Mari", "Pedro", "Pedrito", "Himar", "Sarito", "Vicky", "Carmelo", "Laura", "Carlos", "José", "Claudio", "Javi"];
const ADMIN_PASSWORD = "porra2026lpa";
const APUESTA_NORMAL = 1;
const APUESTA_VIP = 2;

// --- URLs de los escudos de los equipos ---
// NOTA: Las claves (ej: "UD Las Palmas") deben coincidir EXACTAMENTE con los nombres de los equipos en la base de datos.
const teamLogos = {
    "UD Las Palmas": "https://upload.wikimedia.org/wikipedia/en/thumb/2/20/UD_Las_Palmas_logo.svg/1200px-UD_Las_Palmas_logo.svg.png",
    "FC Andorra": "https://upload.wikimedia.org/wikipedia/en/thumb/0/02/FC_Andorra_logo.svg/1200px-FC_Andorra_logo.svg.png",
    "Córdoba CF": "https://upload.wikimedia.org/wikipedia/en/thumb/7/7a/Cordoba_CF_logo.svg/1200px-Cordoba_CF_logo.svg.png",
    "Málaga CF": "https://upload.wikimedia.org/wikipedia/en/thumb/5/53/M%C3%A1laga_CF_logo.svg/1200px-M%C3%A1laga_CF_logo.svg.png",
    "Burgos CF": "https://upload.wikimedia.org/wikipedia/en/thumb/e/e5/Burgos_CF_logo.svg/1200px-Burgos_CF_logo.svg.png",
    "Real Sociedad B": "https://upload.wikimedia.org/wikipedia/en/thumb/f/f1/Real_Sociedad_logo.svg/1200px-Real_Sociedad_logo.svg.png",
    "CD Leganés": "https://upload.wikimedia.org/wikipedia/en/thumb/0/02/Club_Deportivo_Legan%C3%A9s_logo.svg/1200px-Club_Deportivo_Legan%C3%A9s_logo.svg.png",
    "UD Almería": "https://upload.wikimedia.org/wikipedia/en/thumb/8/82/UD_Almer%C3%ADa_logo.svg/1200px-UD_Almer%C3%ADa_logo.svg.png",
    "Cádiz CF": "https://upload.wikimedia.org/wikipedia/en/thumb/5/5e/C%C3%A1diz_CF_logo.svg/1200px-C%C3%A1diz_CF_logo.svg.png",
    "Granada CF": "https://upload.wikimedia.org/wikipedia/en/thumb/c/c3/Granada_CF_logotipo.svg/1200px-Granada_CF_logotipo.svg.png",
    "SD Eibar": "https://upload.wikimedia.org/wikipedia/en/thumb/e/e1/SD_Eibar_logo.svg/1200px-SD_Eibar_logo.svg.png",
    "SD Huesca": "https://upload.wikimedia.org/wikipedia/en/thumb/8/8e/SD_Huesca_logo.svg/1200px-SD_Huesca_logo.svg.png",
    "Real Sporting de Gijón": "https://upload.wikimedia.org/wikipedia/en/thumb/4/4c/Real_Sporting_de_Gij%C3%B3n_logo.svg/1200px-Real_Sporting_de_Gij%C3%B3n_logo.svg.png",
    "Real Racing Club": "https://upload.wikimedia.org/wikipedia/en/thumb/1/12/Real_Racing_Club_de_Santander_logo.svg/1200px-Real_Racing_Club_de_Santander_logo.svg.png",
    "Real Valladolid CF": "https://upload.wikimedia.org/wikipedia/en/thumb/6/6e/Real_Valladolid_logo.svg/1200px-Real_Valladolid_logo.svg.png",
    "Albacete Balompié": "https://upload.wikimedia.org/wikipedia/en/thumb/2/2a/Albacete_Balompi%C3%A9_logo.svg/1200px-Albacete_Balompi%C3%A9_logo.svg.png",
    "CD Castellón": "https://upload.wikimedia.org/wikipedia/en/thumb/e/e5/CD_Castell%C3%B3n_logo.svg/1200px-CD_Castell%C3%B3n_logo.svg.png",
    "CD Mirandés": "https://upload.wikimedia.org/wikipedia/en/thumb/b/b3/CD_Mirand%C3%A9s_logo.svg/1200px-CD_Mirand%C3%A9s_logo.svg.png",
    "AD Ceuta FC": "https://upload.wikimedia.org/wikipedia/en/d/d4/AD_Ceuta_FC_logo.png",
    "CyD Leonesa": "https://upload.wikimedia.org/wikipedia/en/thumb/b/b2/Cultural_y_Deportiva_Leonesa_logo.svg/1200px-Cultural_y_Deportiva_Leonesa_logo.svg.png",
    "Real Zaragoza": "https://upload.wikimedia.org/wikipedia/en/thumb/1/15/Real_Zaragoza_logo.svg/1200px-Real_Zaragoza_logo.svg.png",
    "RC Deportivo": "https://upload.wikimedia.org/wikipedia/en/thumb/4/4e/RC_Deportivo_La_Coru%C3%B1a_logo.svg/1200px-RC_Deportivo_La_Coru%C3%B1a_logo.svg.png"
};

// ============================================================================
// --- COMPONENTES REUTILIZABLES ---
// ============================================================================

const TeamDisplay = ({ teamName }) => (
    <div style={styles.teamDisplay}>
        <img 
            src={teamLogos[teamName]} 
            style={styles.teamLogo} 
            alt={`${teamName} logo`}
            onError={(e) => { e.target.src = 'https://placehold.co/50x50/1b263b/e0e1dd?text=?'; }} // Fallback image
        />
        <span>{teamName}</span>
    </div>
);


// ============================================================================
// --- COMPONENTES DE LAS PANTALLAS ---
// ============================================================================

const SplashScreen = ({ onEnter }) => {
    const [jornadaInfo, setJornadaInfo] = useState(null);
    const [countdown, setCountdown] = useState('');
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState([]);
    const [currentStatIndex, setCurrentStatIndex] = useState(0);

    useEffect(() => {
        const qActiva = query(collection(db, "jornadas"), where("estado", "==", "Abierta"), limit(1));
        const unsubscribe = onSnapshot(qActiva, (snapshot) => {
            if (!snapshot.empty) {
                const jornada = { id: snapshot.docs[0].id, ...snapshot.docs[0].data(), type: 'activa' };
                setJornadaInfo(jornada);

                const pronosticosRef = collection(db, "pronosticos", jornada.id, "jugadores");
                onSnapshot(pronosticosRef, (pronosticosSnap) => {
                    const pronosticos = pronosticosSnap.docs.map(d => ({id: d.id, ...d.data()}));
                    const faltan = JUGADORES.length - pronosticosSnap.size;
                    
                    const resultados = pronosticos.map(p => `${p.golesLocal}-${p.golesVisitante}`);
                    const counts = resultados.reduce((acc, value) => ({...acc, [value]: (acc[value] || 0) + 1}), {});
                    const resultadoMasPuesto = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b, 'N/A');

                    const jokerUsers = pronosticos.filter(p => p.jokerActivo).map(p => p.id);
                    
                    const dynamicStats = [];
                    if (jornada.bote > 0) dynamicStats.push({ label: 'Bote en Juego', value: `${jornada.bote}€`, color: styles.colors.success });
                    if (jokerUsers.length > 0) dynamicStats.push({ label: '¡JOKER ACTIVADO!', value: jokerUsers.join(', '), color: styles.colors.gold });
                    if (resultadoMasPuesto !== 'N/A') dynamicStats.push({ label: 'Resultado más repetido', value: resultadoMasPuesto, color: styles.colors.danger });
                    dynamicStats.push({ label: 'Faltan por apostar', value: faltan });
                    
                    setStats(dynamicStats);
                });
                setLoading(false);
            } else {
                const qProxima = query(collection(db, "jornadas"), where("estado", "==", "Próximamente"), orderBy("numeroJornada"), limit(1));
                getDocs(qProxima).then(proximaSnap => {
                    if (!proximaSnap.empty) {
                        const data = { id: proximaSnap.docs[0].id, ...proximaSnap.docs[0].data(), type: 'proxima' };
                        setJornadaInfo(data);
                    } else {
                        setJornadaInfo(null);
                    }
                    setLoading(false);
                }).catch(error => {
                    console.error("Error fetching próxima jornada: ", error);
                    setJornadaInfo(null);
                    setLoading(false);
                });
            }
        }, (error) => {
            console.error("Error fetching jornada activa: ", error);
            setJornadaInfo(null);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (stats.length > 1) {
            const statInterval = setInterval(() => {
                setCurrentStatIndex(prevIndex => (prevIndex + 1) % stats.length);
            }, 4000); // Cambia cada 4 segundos
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
            if (diff <= 0) { setCountdown("¡Tiempo finalizado!"); clearInterval(interval); return; }
            const d = Math.floor(diff / (1000 * 60 * 60 * 24));
            const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);
            setCountdown(`${d}d ${h}h ${m}m ${s}s`);
        }, 1000);
        return () => clearInterval(interval);
    }, [jornadaInfo]);

    const currentStat = stats[currentStatIndex];

    return (
        <div style={styles.splashContainer}>
            <h1 style={styles.splashTitle}>PORRA UDLP 2026</h1>
            {loading ? (
                <p style={{color: styles.colors.lightText}}>Cargando información...</p>
            ) : jornadaInfo ? (
                <div style={styles.splashInfoBox}>
                    {jornadaInfo.type === 'activa' ? (
                        <>
                            <h3 style={styles.splashInfoTitle}>Apuestas Abiertas</h3>
                            <p>{jornadaInfo.equipoLocal} vs {jornadaInfo.equipoVisitante}</p>
                            <div style={styles.countdownContainer}><p>Cierre en:</p><div style={styles.countdown}>{countdown}</div></div>
                            {currentStat && (
                                <div style={styles.carouselStat}>
                                    <span style={{color: currentStat.color || styles.colors.lightText}}>{currentStat.label}: </span>
                                    <strong style={{color: currentStat.color || styles.colors.gold}}>{currentStat.value}</strong>
                                </div>
                            )}
                            {jornadaInfo.splashMessage && <p style={styles.splashAdminMessage}>"{jornadaInfo.splashMessage}"</p>}
                        </>
                    ) : (
                         <>
                            <h3 style={styles.splashInfoTitle}>Próxima Jornada</h3>
                            <p>{jornadaInfo.equipoLocal} vs {jornadaInfo.equipoVisitante}</p>
                            {jornadaInfo.bote > 0 && <p style={styles.splashBote}>¡BOTE DE {jornadaInfo.bote}€ EN JUEGO!</p>}
                            {countdown && <div style={styles.countdownContainer}><p>El partido comienza en:</p><div style={styles.countdown}>{countdown}</div></div>}
                        </>
                    )}
                </div>
            ) : (
                <div style={styles.splashInfoBox}>
                    <h3 style={styles.splashInfoTitle}>Temporada en Pausa</h3>
                    <p>El administrador aún no ha configurado la próxima jornada.</p>
                </div>
            )}
            <button onClick={onEnter} style={styles.mainButton}>Entrar</button>
        </div>
    );
};

const LoginScreen = ({ onLogin }) => {
    const [hoveredUser, setHoveredUser] = useState(null);

    return (
        <div style={styles.loginContainer}>
            <h2 style={styles.title}>Selecciona tu Perfil</h2>
            <div style={styles.userList}>
                {JUGADORES.map(jugador => (
                    <button 
                        key={jugador} 
                        onClick={() => onLogin(jugador)} 
                        style={hoveredUser === jugador ? {...styles.userButton, ...styles.userButtonHover} : styles.userButton}
                        onMouseEnter={() => setHoveredUser(jugador)}
                        onMouseLeave={() => setHoveredUser(null)}
                    >
                        {jugador.toUpperCase()}
                    </button>
                ))}
            </div>
        </div>
    );
};

const MiJornadaScreen = ({ user, setActiveTab }) => {
    const [jornadaActiva, setJornadaActiva] = useState(null);
    const [jornadaCerrada, setJornadaCerrada] = useState(null);
    const [proximaJornada, setProximaJornada] = useState(null);
    const [loading, setLoading] = useState(true);
    const [pronostico, setPronostico] = useState({ golesLocal: '', golesVisitante: '', resultado1x2: '', goleador: '', sinGoleador: false, pin: '', jokerActivo: false, jokerPronosticos: Array(10).fill({golesLocal: '', golesVisitante: ''}) });
    const [isLocked, setIsLocked] = useState(true);
    const [pinInput, setPinInput] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [stats, setStats] = useState({ count: 0, color: styles.colors.success });
    const [jokersRestantes, setJokersRestantes] = useState(2);
    const [panicButtonDisabled, setPanicButtonDisabled] = useState(false);

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

        const qActiva = query(collection(db, "jornadas"), where("estado", "==", "Abierta"), limit(1));
        const unsubscribe = onSnapshot(qActiva, (querySnapshot) => {
            if (!querySnapshot.empty) {
                const jornadaData = { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
                setJornadaActiva(jornadaData);
                setJornadaCerrada(null);
                setProximaJornada(null);
                if (jornadaData.fechaCierre) {
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
                    } else {
                        setPronostico({ golesLocal: '', golesVisitante: '', resultado1x2: '', goleador: '', sinGoleador: false, pin: '', jokerActivo: false, jokerPronosticos: Array(10).fill({golesLocal: '', golesVisitante: ''}) });
                        setIsLocked(false);
                    }
                    setLoading(false);
                });
            } else {
                setJornadaActiva(null);
                const qCerrada = query(collection(db, "jornadas"), where("estado", "==", "Cerrada"), limit(1));
                getDocs(qCerrada).then(cerradaSnap => {
                    if (!cerradaSnap.empty) {
                        const jornadaData = { id: cerradaSnap.docs[0].id, ...cerradaSnap.docs[0].data() };
                        setJornadaCerrada(jornadaData);
                        const pronosticoRef = doc(db, "pronosticos", jornadaData.id, "jugadores", user);
                        getDoc(pronosticoRef).then(pronosticoSnap => {
                            if (pronosticoSnap.exists()) {
                                setPronostico(pronosticoSnap.data());
                            }
                        });
                        setLoading(false);
                    } else {
                        setJornadaCerrada(null);
                        const qProxima = query(collection(db, "jornadas"), where("estado", "==", "Próximamente"), orderBy("numeroJornada"), limit(1));
                        getDocs(qProxima).then(proximaSnap => {
                            if (!proximaSnap.empty) setProximaJornada({ id: proximaSnap.docs[0].id, ...proximaSnap.docs[0].data() });
                            else setProximaJornada(null);
                            setLoading(false);
                        });
                    }
                });
            }
        }, (error) => { console.error("Error: ", error); setLoading(false); });
        return () => unsubscribe();
    }, [user]);

    useEffect(() => {
        if (jornadaActiva && pronostico.golesLocal !== '' && pronostico.golesVisitante !== '') {
            const q = query(collection(db, "pronosticos", jornadaActiva.id, "jugadores"), 
                where("golesLocal", "==", pronostico.golesLocal), 
                where("golesVisitante", "==", pronostico.golesVisitante)
            );
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const count = snapshot.docs.some(doc => doc.id === user) ? snapshot.size - 1 : snapshot.size;
                let color = styles.colors.success;
                if (count >= 1 && count <= 2) color = styles.colors.warning;
                if (count >= 3) color = styles.colors.danger;
                setStats({ count, color });
            });
            return () => unsubscribe();
        } else {
            setStats({ count: 0, color: styles.colors.success });
        }
    }, [jornadaActiva, pronostico.golesLocal, pronostico.golesVisitante, user]);
    
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
        if (!jornadaActiva) return;
        setIsSaving(true); setMessage('');
        const pronosticoRef = doc(db, "pronosticos", jornadaActiva.id, "jugadores", user);
        try {
            const cleanJokerPronosticos = pronostico.jokerPronosticos.filter(p => p.golesLocal !== '' || p.golesVisitante !== '');
            await setDoc(pronosticoRef, { ...pronostico, jokerPronosticos: cleanJokerPronosticos, lastUpdated: new Date() });
            setMessage('¡Pronóstico guardado y bloqueado!');
            setIsLocked(!!pronostico.pin);
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
            const pronosticoRef = doc(db, "pronosticos", jornadaActiva.id, "jugadores", user);
            await updateDoc(pronosticoRef, { jokerPronosticos: [] });
            setMessage('Apuestas JOKER eliminadas.');
        }
    };

    const handleMarcarComoPagado = async () => {
        if (!jornadaCerrada) return;
        const pronosticoRef = doc(db, "pronosticos", jornadaCerrada.id, "jugadores", user);
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

    return (
        <div>
            <h2 style={styles.title}>Mi Jornada</h2>
            <p style={{color: styles.colors.lightText}}>Bienvenido, <strong>{user}</strong>.</p>
            {jornadaActiva ? (
                <form onSubmit={handleGuardarPronostico} style={styles.form}>
                    {jornadaActiva.esVip && (
                        <div style={styles.vipBanner}>
                            ⭐ JORNADA VIP ⭐ (Apuesta: 2€ - Puntos Dobles)
                        </div>
                    )}
                    <h3>Jornada {jornadaActiva.numeroJornada}: {jornadaActiva.equipoLocal} vs {jornadaActiva.equipoVisitante}</h3>
                    {isLocked && pronostico.pin && (
                        <div style={styles.pinLockContainer}>
                            <p>🔒 Tu pronóstico está bloqueado. Introduce tu PIN para modificarlo.</p>
                            <input type="password" maxLength="4" value={pinInput} onChange={(e) => setPinInput(e.target.value)} style={styles.input} placeholder="PIN de 4 dígitos" />
                            <button type="button" onClick={handleUnlock} style={styles.mainButton}>Desbloquear</button>
                        </div>
                    )}
                    <fieldset disabled={isLocked} style={{border: 'none', padding: 0, margin: 0}}>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Resultado Exacto</label>
                            <div style={styles.resultInputContainer}>
                                <span style={styles.teamName}>{jornadaActiva.equipoLocal}</span>
                                <input type="number" min="0" name="golesLocal" value={pronostico.golesLocal} onChange={handlePronosticoChange} style={styles.resultInput} />
                                <span style={styles.separator}>-</span>
                                <input type="number" min="0" name="golesVisitante" value={pronostico.golesVisitante} onChange={handlePronosticoChange} style={styles.resultInput} />
                                <span style={styles.teamName}>{jornadaActiva.equipoVisitante}</span>
                            </div>
                            {(pronostico.golesLocal !== '' && pronostico.golesVisitante !== '') && 
                                <small style={{...styles.statsIndicator, color: stats.color}}>
                                    {stats.count > 0 ? `Otros ${stats.count} jugador(es) han pronosticado este resultado.` : '¡Eres el único con este resultado por ahora!'}
                                </small>
                            }
                        </div>
                        <div style={styles.formGroup}><label style={styles.label}>Resultado 1X2</label><select name="resultado1x2" value={pronostico.resultado1x2} onChange={handlePronosticoChange} style={styles.input}><option value="">-- Elige --</option><option value="Gana UD Las Palmas">Gana UDLP</option><option value="Empate">Empate</option><option value="Pierde UD Las Palmas">Pierde UDLP</option></select></div>
                        <div style={styles.formGroup}><label style={styles.label}>Primer Goleador</label><input type="text" name="goleador" value={pronostico.goleador} onChange={handlePronosticoChange} style={styles.input} disabled={pronostico.sinGoleador} /><div style={{marginTop: '10px'}}><input type="checkbox" name="sinGoleador" id="sinGoleador" checked={pronostico.sinGoleador} onChange={handlePronosticoChange} /><label htmlFor="sinGoleador" style={{marginLeft: '8px', color: styles.colors.lightText}}>Sin Goleador (SG)</label></div></div>
                        <div style={styles.formGroup}><label style={styles.label}>PIN de Seguridad (4 dígitos, opcional)</label><input type="password" name="pin" value={pronostico.pin} onChange={handlePronosticoChange} maxLength="4" style={styles.input} placeholder="Deja en blanco para no bloquear" /></div>
                        
                        <div style={styles.jokerContainer}>
                            {!pronostico.jokerActivo ? (
                                <>
                                    <button type="button" onClick={handleActivarJoker} style={styles.jokerButton} disabled={isLocked || jokersRestantes <= 0}>
                                        🃏 Activar JOKER
                                    </button>
                                    <span style={{marginLeft: '15px'}}>Te quedan: {jokersRestantes}</span>
                                </>
                            ) : (
                                <div>
                                    <h3 style={styles.title}>Apuestas JOKER</h3>
                                    <p>Añade hasta 10 resultados exactos adicionales.</p>
                                    {pronostico.jokerPronosticos.map((p, index) => (
                                        <div key={index} style={{...styles.resultInputContainer, marginBottom: '10px'}}>
                                            <span style={styles.teamName}>{jornadaActiva.equipoLocal}</span>
                                            <input type="number" min="0" value={p.golesLocal} onChange={(e) => handleJokerPronosticoChange(index, 'golesLocal', e.target.value)} style={styles.resultInput} disabled={isLocked} />
                                            <span style={styles.separator}>-</span>
                                            <input type="number" min="0" value={p.golesVisitante} onChange={(e) => handleJokerPronosticoChange(index, 'golesVisitante', e.target.value)} style={styles.resultInput} disabled={isLocked} />
                                            <span style={styles.teamName}>{jornadaActiva.equipoVisitante}</span>
                                        </div>
                                    ))}
                                    <button type="button" onClick={handleBotonDelPanico} style={{...styles.jokerButton, backgroundColor: styles.colors.danger}} disabled={isLocked || panicButtonDisabled}>
                                        BOTÓN DEL PÁNICO
                                    </button>
                                    {panicButtonDisabled && <small style={{display: 'block', color: styles.colors.danger, marginTop: '5px'}}>El botón del pánico se ha desactivado (menos de 1h para el cierre).</small>}
                                </div>
                            )}
                        </div>
                        <button type="submit" disabled={isSaving || isLocked} style={styles.mainButton}>{isSaving ? 'Guardando...' : 'Guardar y Bloquear'}</button>
                    </fieldset>
                    {message && <p style={styles.message}>{message}</p>}
                </form>
            ) : jornadaCerrada ? (
                <div style={styles.placeholder}>
                    <h3>Jornada {jornadaCerrada.numeroJornada} Cerrada</h3>
                    <p>Las apuestas para este partido han finalizado. Esperando resultados.</p>
                    <p>Tu pronóstico fue: {pronostico.golesLocal}-{pronostico.golesVisitante}</p>
                    <button onClick={handleMarcarComoPagado} disabled={pronostico.pagado} style={styles.mainButton}>
                        {pronostico.pagado ? 'Pago Registrado ✓' : 'Marcar como Pagado'}
                    </button>
                    <button onClick={() => setActiveTab('laJornada')} style={{...styles.mainButton, marginLeft: '10px', backgroundColor: styles.colors.lightBlue}}>
                        Ver Resumen de Apuestas
                    </button>
                    {message && <p style={styles.message}>{message}</p>}
                </div>
            ) : proximaJornada ? (
                <div style={styles.placeholder}><h3>No hay jornada de apuestas abierta</h3><h4>Próximo Partido: Jornada {proximaJornada.numeroJornada}</h4><p style={{fontSize: '1.2rem', fontWeight: 'bold'}}>{proximaJornada.equipoLocal} vs {proximaJornada.equipoVisitante}</p>{proximaJornada.fechaStr && <p>🗓️ {proximaJornada.fechaStr}</p>}{proximaJornada.estadio && <p>📍 {proximaJornada.estadio}</p>}</div>
            ) : (
                <div style={styles.placeholder}><h3>No hay jornadas disponibles.</h3><p>El administrador añadirá nuevas jornadas próximamente.</p></div>
            )}
        </div>
    );
};

const LaJornadaScreen = ({ onViewJornada }) => {
    const [jornadaActiva, setJornadaActiva] = useState(null);
    const [jornadaCerrada, setJornadaCerrada] = useState(null);
    const [participantes, setParticipantes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [countdown, setCountdown] = useState('');

    useEffect(() => {
        const q = query(collection(db, "jornadas"), where("estado", "in", ["Abierta", "Cerrada"]), limit(1));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const jornada = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
                if (jornada.estado === 'Abierta') {
                    setJornadaActiva(jornada);
                    setJornadaCerrada(null);
                } else {
                    setJornadaCerrada(jornada);
                    setJornadaActiva(null);
                }

                const pronosticosRef = collection(db, "pronosticos", jornada.id, "jugadores");
                onSnapshot(pronosticosRef, (pronosticosSnap) => {
                    setParticipantes(pronosticosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                });
            } else {
                setJornadaActiva(null);
                setJornadaCerrada(null);
                setParticipantes([]);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!jornadaActiva || !jornadaActiva.fechaCierre) { setCountdown(''); return; }
        const interval = setInterval(() => {
            const now = new Date();
            const deadline = jornadaActiva.fechaCierre.toDate();
            const diff = deadline - now;
            if (diff <= 0) { setCountdown("¡Apuestas cerradas!"); clearInterval(interval); return; }
            const d = Math.floor(diff / (1000 * 60 * 60 * 24));
            const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);
            setCountdown(`${d}d ${h}h ${m}m ${s}s`);
        }, 1000);
        return () => clearInterval(interval);
    }, [jornadaActiva]);

    const groupPronosticos = (pronosticos, key) => {
        return pronosticos.reduce((acc, p) => {
            const value = key(p);
            if (!acc[value]) acc[value] = [];
            acc[value].push(p);
            return acc;
        }, {});
    };

    const resultadosExactos = jornadaCerrada ? groupPronosticos(participantes, p => `${p.golesLocal}-${p.golesVisitante}`) : {};
    const resultados1x2 = jornadaCerrada ? groupPronosticos(participantes, p => p.resultado1x2) : {};
    const goleadores = jornadaCerrada ? groupPronosticos(participantes, p => p.sinGoleador ? 'Sin Goleador' : (p.goleador || 'N/A')) : {};

    if (loading) return <p style={{color: styles.colors.lightText}}>Buscando jornada...</p>;

    return (
        <div>
            <h2 style={styles.title}>La Jornada</h2>
            {jornadaActiva ? (
                <div style={styles.laJornadaContainer}>
                    <h3>Jornada {jornadaActiva.numeroJornada}</h3>
                    <div style={styles.matchInfo}>
                        <TeamDisplay teamName={jornadaActiva.equipoLocal} />
                        <span style={styles.vs}>VS</span>
                        <TeamDisplay teamName={jornadaActiva.equipoVisitante} />
                    </div>
                    <div style={styles.countdownContainer}><p>Cierre de apuestas en:</p><div style={styles.countdown}>{countdown}</div></div>
                    <h3 style={styles.callToAction}>¡Hagan sus porras!</h3>
                    <div style={styles.apostadoresContainer}>
                        <h4>Apuestas Realizadas ({participantes.length}/{JUGADORES.length})</h4>
                        <div style={styles.apostadoresGrid}>
                            {JUGADORES.map(jugador => {
                                const participante = participantes.find(p => p.id === jugador);
                                const haApostado = !!participante;
                                const usoJoker = haApostado && participante.jokerActivo;
                                return (
                                    <span key={jugador} style={haApostado ? styles.apostadorHecho : styles.apostadorPendiente}>
                                        {jugador} {usoJoker ? '🃏' : (haApostado ? '✓' : '')}
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                </div>
            ) : jornadaCerrada ? (
                <div>
                    <h3>Resumen de Apuestas - Jornada {jornadaCerrada.numeroJornada}</h3>
                    <p>Las apuestas están cerradas. ¡Estos son los pronósticos!</p>
                    <div style={styles.resumenContainer}>
                        <div style={styles.resumenCategoria}>
                            <h4 style={styles.resumenTitle}>Resultados Exactos</h4>
                            {Object.entries(resultadosExactos).map(([resultado, jugadores]) => (
                                <div key={resultado} style={styles.resumenItem}>
                                    <strong>{resultado}:</strong>
                                    <span>{jugadores.map(j => `${j.id} ${j.jokerActivo ? '🃏' : ''}`).join(', ')}</span>
                                </div>
                            ))}
                        </div>
                        <div style={styles.resumenCategoria}>
                            <h4 style={styles.resumenTitle}>1X2</h4>
                            {Object.entries(resultados1x2).map(([resultado, jugadores]) => (
                                <div key={resultado} style={styles.resumenItem}>
                                    <strong>{resultado}:</strong>
                                    <span>{jugadores.map(j => `${j.id} ${j.jokerActivo ? '🃏' : ''}`).join(', ')}</span>
                                </div>
                            ))}
                        </div>
                        <div style={styles.resumenCategoria}>
                            <h4 style={styles.resumenTitle}>Primer Goleador</h4>
                            {Object.entries(goleadores).map(([goleador, jugadores]) => (
                                <div key={goleador} style={styles.resumenItem}>
                                    <strong>{goleador}:</strong>
                                    <span>{jugadores.map(j => `${j.id} ${j.jokerActivo ? '🃏' : ''}`).join(', ')}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div style={styles.placeholder}><h3>No hay ninguna jornada activa o cerrada en este momento.</h3></div>
            )}
        </div>
    );
};

const CalendarioScreen = ({ onViewJornada }) => {
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
            <h2 style={styles.title}>Calendario</h2>
            <div style={styles.jornadaList}>
                {jornadas.map(jornada => (
                    <div key={jornada.id} style={jornada.esVip ? {...styles.jornadaItem, ...styles.jornadaVip} : styles.jornadaItem} onClick={() => onViewJornada(jornada.id)}>
                        <div style={styles.jornadaInfo}>
                            <strong>{jornada.esVip && '⭐ '}Jornada {jornada.numeroJornada || 'Copa'}:</strong> {jornada.equipoLocal} vs {jornada.equipoVisitante}
                            <br/>
                            <small>{jornada.fechaStr || 'Fecha por confirmar'} - {jornada.estadio || 'Estadio por confirmar'}</small>
                        </div>
                        <div style={{...styles.statusBadge, backgroundColor: styles.colors.status[jornada.estado]}}>
                            {jornada.estado}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ClasificacionScreen = () => {
    const [clasificacion, setClasificacion] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, "clasificacion"), orderBy("puntosTotales", "desc"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const clasificacionData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setClasificacion(clasificacionData);
            setLoading(false);
        }, (error) => {
            console.error("Error cargando clasificación: ", error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    if (loading) return <p style={{color: styles.colors.lightText}}>Cargando clasificación...</p>;

    const getRankStyle = (index) => {
        if (index === 0) return styles.top1Row;
        if (index === 1) return styles.top2Row;
        if (index === 2) return styles.top3Row;
        return {};
    };

    return (
        <div>
            <h2 style={styles.title}>Clasificación</h2>
            <table style={styles.table}>
                <thead><tr><th style={styles.th}>Pos.</th><th style={styles.th}>Jugador</th><th style={styles.th}>Puntos</th></tr></thead>
                <tbody>{clasificacion.map((jugador, index) => (
                    <tr key={jugador.id} style={getRankStyle(index)}>
                        <td style={styles.td}>
                            {index === 0 && '🥇 '}
                            {index === 1 && '🥈 '}
                            {index === 2 && '🥉 '}
                            {index + 1}º
                        </td>
                        <td style={styles.td}>{jugador.id}</td>
                        <td style={styles.td}>{jugador.puntosTotales || 0}</td>
                    </tr>
                ))}</tbody>
            </table>
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
    const [isSaving, setIsSaving] = useState(false);
    const [isCalculating, setIsCalculating] = useState(false);
    const [message, setMessage] = useState('');

    const handleSaveChanges = async () => {
        setIsSaving(true); setMessage('');
        const jornadaRef = doc(db, "jornadas", jornada.id);
        try {
            await updateDoc(jornadaRef, {
                estado, resultadoLocal, resultadoVisitante, goleador: goleador.trim(), resultado1x2, esVip, splashMessage,
                fechaApertura: fechaApertura ? new Date(fechaApertura) : null,
                fechaCierre: fechaCierre ? new Date(fechaCierre) : null,
            });
            setMessage('¡Guardado!');
            setTimeout(() => setMessage(''), 2000);
        } catch (error) { console.error("Error al actualizar: ", error); setMessage('Error al guardar.'); }
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
            if (p.golesLocal !== '' && p.golesVisitante !== '' && parseInt(p.golesLocal) === parseInt(resultadoLocal) && parseInt(p.golesVisitante) === parseInt(resultadoVisitante)) {
                puntosJornada += esVip ? 6 : 3;
                ganadores.push(p.id);
            }
            if (p.resultado1x2 === resultado1x2) { puntosJornada += esVip ? 2 : 1; }
            const goleadorReal = goleador.trim().toLowerCase();
            const goleadorApostado = p.goleador ? p.goleador.trim().toLowerCase() : '';
            if (p.sinGoleador && (goleadorReal === "sg" || goleadorReal === "")) { puntosJornada += esVip ? 2 : 1; } 
            else if (!p.sinGoleador && goleadorApostado === goleadorReal && goleadorReal !== "") { puntosJornada += esVip ? 4 : 2; }
            
            if (p.jokerActivo && p.jokerPronosticos && p.jokerPronosticos.length > 0) {
                for (const jokerP of p.jokerPronosticos) {
                    if (jokerP.golesLocal !== '' && jokerP.golesVisitante !== '' && parseInt(jokerP.golesLocal) === parseInt(resultadoLocal) && parseInt(jokerP.golesVisitante) === parseInt(resultadoVisitante)) {
                        puntosJornada += esVip ? 6 : 3;
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
        batch.update(jornadaRef, { estado: "Finalizada", ganadores });

        if (ganadores.length === 0) {
            const boteActual = jornada.bote || 0;
            const costeApuesta = jornada.esVip ? APUESTA_VIP : APUESTA_NORMAL;
            const nuevoBote = boteActual + (pronosticos.length * costeApuesta);

            const qProxima = query(collection(db, "jornadas"), where("numeroJornada", ">", jornada.numeroJornada), orderBy("numeroJornada"), limit(1));
            const proximaJornadaSnap = await getDocs(qProxima);
            if (!proximaJornadaSnap.empty) {
                const proximaJornadaRef = doc(db, "jornadas", proximaJornadaSnap.docs[0].id);
                batch.update(proximaJornadaRef, { bote: nuevoBote });
            }
        }

        try { await batch.commit(); alert("¡Puntos calculados y jornada cerrada!"); } 
        catch (error) { console.error("Error al calcular: ", error); alert("Error al calcular puntos."); }
        setIsCalculating(false);
    };

    return (
        <div style={jornada.esVip ? {...styles.adminJornadaItem, ...styles.jornadaVip} : styles.adminJornadaItem}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap'}}>
                <p><strong>Jornada {jornada.numeroJornada || 'Copa'}:</strong> {jornada.equipoLocal} vs {jornada.equipoVisitante}</p>
                <div style={styles.vipToggleContainer}>
                    <label htmlFor={`vip-toggle-${jornada.id}`}>⭐ VIP</label>
                    <input id={`vip-toggle-${jornada.id}`} type="checkbox" checked={esVip} onChange={(e) => setEsVip(e.target.checked)} />
                </div>
            </div>
            <div style={styles.adminControls}>
                <div><label style={styles.label}>Estado:</label><select value={estado} onChange={(e) => setEstado(e.target.value)} style={styles.adminSelect}><option value="Próximamente">Próximamente</option><option value="Abierta">Abierta</option><option value="Cerrada">Cerrada</option><option value="Finalizada">Finalizada</option></select></div>
                <div><label style={styles.label}>Resultado Final:</label><div style={styles.resultInputContainer}><input type="number" min="0" value={resultadoLocal} onChange={(e) => setResultadoLocal(e.target.value)} style={styles.resultInput} /><span style={styles.separator}>-</span><input type="number" min="0" value={resultadoVisitante} onChange={(e) => setResultadoVisitante(e.target.value)} style={styles.resultInput} /></div></div>
                <div><label style={styles.label}>Primer Goleador:</label><input type="text" value={goleador} onChange={(e) => setGoleador(e.target.value)} style={styles.adminInput} /></div>
                <div><label style={styles.label}>Resultado 1X2:</label><select value={resultado1x2} onChange={(e) => setResultado1x2(e.target.value)} style={styles.adminSelect}><option value="">-- Elige --</option><option value="Gana UD Las Palmas">Gana UDLP</option><option value="Empate">Empate</option><option value="Pierde UD Las Palmas">Pierde UDLP</option></select></div>
                <div><label style={styles.label}>Apertura Apuestas:</label><input type="datetime-local" value={fechaApertura} onChange={(e) => setFechaApertura(e.target.value)} style={styles.adminInput} /></div>
                <div><label style={styles.label}>Cierre Apuestas:</label><input type="datetime-local" value={fechaCierre} onChange={(e) => setFechaCierre(e.target.value)} style={styles.adminInput} /></div>
            </div>
            <div style={{marginTop: '10px'}}>
                <label style={styles.label}>Mensaje para la Pantalla Principal:</label>
                <textarea value={splashMessage} onChange={(e) => setSplashMessage(e.target.value)} style={{...styles.input, width: '95%', height: '50px'}} />
            </div>
            <div style={{marginTop: '20px'}}>
                <button onClick={handleSaveChanges} disabled={isSaving} style={styles.saveButton}>{isSaving ? 'Guardando...' : 'Guardar Cambios'}</button>
                <button onClick={handleCalcularPuntos} disabled={isCalculating || jornada.estado === 'Finalizada'} style={styles.saveButton}>{isCalculating ? 'Calculando...' : 'Calcular Puntos y Cerrar'}</button>
                {message && <span style={{marginLeft: '10px', color: styles.colors.success}}>{message}</span>}
            </div>
        </div>
    );
};

const AdminPanelScreen = () => {
    const [jornadas, setJornadas] = useState([]);
    const [loading, setLoading] = useState(true);

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

    return (
        <div>
            <h2 style={styles.title}>Panel de Administrador</h2>
            <div style={styles.jornadaList}>
                {jornadas.map(jornada => (<JornadaAdminItem key={jornada.id} jornada={jornada} />))}
            </div>
        </div>
    );
};

const JornadaDetalleScreen = ({ jornadaId, onBack }) => {
    const [jornada, setJornada] = useState(null);
    const [pronosticos, setPronosticos] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const jornadaRef = doc(db, "jornadas", jornadaId);
        const unsubJornada = onSnapshot(jornadaRef, (docSnap) => {
            if (docSnap.exists()) {
                setJornada(docSnap.data());
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

    if (loading) return <p style={{color: styles.colors.lightText}}>Cargando detalles...</p>;

    return (
        <div>
            <button onClick={onBack} style={styles.backButton}>&larr; Volver al Calendario</button>
            {jornada && (
                <>
                    <h2 style={styles.title}>Detalle Jornada {jornada.numeroJornada}</h2>
                    <h3>{jornada.equipoLocal} vs {jornada.equipoVisitante}</h3>
                    {jornada.estado === 'Finalizada' ? (
                        <p style={styles.finalResult}>Resultado Final: {jornada.resultadoLocal} - {jornada.resultadoVisitante}</p>
                    ) : ( <p>Esta jornada aún no ha finalizado.</p> )}
                    
                    {jornada.ganadores && jornada.ganadores.length > 0 && (
                        <div style={styles.winnerBanner}>🏆 Ganador(es): {jornada.ganadores.join(', ')}</div>
                    )}
                    {jornada.ganadores && jornada.ganadores.length === 0 && (
                        <div style={styles.boteBanner}>💰 ¡BOTE! Nadie acertó el resultado.</div>
                    )}

                    <table style={styles.table}>
                        <thead><tr><th style={styles.th}>Jugador</th><th style={styles.th}>Pronóstico</th><th style={styles.th}>Puntos</th><th style={styles.th}>Pagado</th></tr></thead>
                        <tbody>
                            {pronosticos.map(p => {
                                const esGanador = jornada.ganadores?.includes(p.id);
                                return (
                                    <React.Fragment key={p.id}>
                                        <tr style={esGanador ? styles.winnerRow : {}}>
                                            <td style={styles.td}>{p.id} {p.jokerActivo && '🃏'}</td>
                                            <td style={styles.td}>{p.golesLocal}-{p.golesVisitante} ({p.resultado1x2}) {p.goleador && `- ${p.goleador}`}</td>
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
                <h3 style={styles.title}>Acceso de Administrador</h3>
                <form onSubmit={handleSubmit}>
                    <label style={styles.label}>Contraseña:</label>
                    <input 
                        type="password" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        style={styles.input}
                    />
                    {error && <p style={{color: styles.colors.danger}}>{error}</p>}
                    <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '20px'}}>
                        <button type="button" onClick={onClose} style={{...styles.mainButton, backgroundColor: styles.colors.lightBlue}}>Cancelar</button>
                        <button type="submit" style={styles.mainButton}>Entrar</button>
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
            const jornadasData = jornadasSnap.docs.map(jornadaDoc => ({
                id: jornadaDoc.id,
                ...jornadaDoc.data(),
                pronosticos: []
            }));
            
            const promises = jornadasData.map(jornada => 
                getDocs(collection(db, "pronosticos", jornada.id, "jugadores"))
            );

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
            <h2 style={styles.title}>Gestión de Pagos</h2>
            {jornadas.map(jornada => (
                <div key={jornada.id} style={styles.adminJornadaItem}>
                    <h4>Jornada {jornada.numeroJornada}: {jornada.equipoLocal} vs {jornada.equipoVisitante}</h4>
                    <table style={styles.table}>
                        <thead><tr><th style={styles.th}>Jugador</th><th style={styles.th}>Pagado</th><th style={styles.th}>Verificado (Admin)</th></tr></thead>
                        <tbody>
                            {JUGADORES.map(jugadorId => {
                                const pronostico = jornada.pronosticos.find(p => p.id === jugadorId);
                                if (!pronostico) return null;
                                return (
                                    <tr key={jugadorId}>
                                        <td style={styles.td}>{jugadorId}</td>
                                        <td style={styles.td}>
                                            <input type="checkbox" checked={pronostico.pagado || false} onChange={(e) => handlePagoChange(jornada.id, jugadorId, e.target.checked)} disabled={user !== jugadorId} />
                                        </td>
                                        <td style={styles.td}>
                                            <input type="checkbox" checked={pronostico.verificado || false} onChange={(e) => handleVerificacionChange(jornada.id, jugadorId, e.target.checked)} disabled={user !== 'Juanma'} />
                                        </td>
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


function App() {
  const [screen, setScreen] = useState('splash');
  const [activeTab, setActiveTab] = useState('miJornada');
  const [currentUser, setCurrentUser] = useState(null);
  const [viewingJornadaId, setViewingJornadaId] = useState(null);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  const handleLogin = (user) => { setCurrentUser(user); setScreen('app'); };

  const handleNavClick = (tab) => {
    setActiveTab(tab);
    if (tab !== 'admin') {
        setIsAdminAuthenticated(false);
    }
  };

  const handleAdminClick = () => {
    if (isAdminAuthenticated) {
        setActiveTab('admin');
    } else {
        setShowAdminLogin(true);
    }
  };

  const handleAdminLoginSuccess = () => {
    setIsAdminAuthenticated(true);
    setShowAdminLogin(false);
    setActiveTab('admin');
  };

  const renderContent = () => {
    if (screen === 'splash') return <SplashScreen onEnter={() => setScreen('login')} />;
    if (screen === 'login') return <LoginScreen onLogin={handleLogin} />;
    if (screen === 'app') {
        if (viewingJornadaId) {
            return <JornadaDetalleScreen jornadaId={viewingJornadaId} onBack={() => setViewingJornadaId(null)} />;
        }
      return (
        <>
          {showAdminLogin && <AdminLoginModal onClose={() => setShowAdminLogin(false)} onSuccess={handleAdminLoginSuccess} />}
          <nav style={styles.navbar}>
            <button onClick={() => handleNavClick('miJornada')} style={activeTab === 'miJornada' ? styles.navButtonActive : styles.navButton}>Mi Jornada</button>
            <button onClick={() => handleNavClick('laJornada')} style={activeTab === 'laJornada' ? styles.navButtonActive : styles.navButton}>La Jornada</button>
            <button onClick={() => handleNavClick('calendario')} style={activeTab === 'calendario' ? styles.navButtonActive : styles.navButton}>Calendario</button>
            <button onClick={() => handleNavClick('clasificacion')} style={activeTab === 'clasificacion' ? styles.navButtonActive : styles.navButton}>Clasificación</button>
            <button onClick={() => handleNavClick('pagos')} style={activeTab === 'pagos' ? styles.navButtonActive : styles.navButton}>Pagos</button>
            {currentUser === 'Juanma' && (<button onClick={handleAdminClick} style={activeTab === 'admin' ? styles.navButtonActive : styles.navButton}>Admin</button>)}
            <button onClick={() => { setCurrentUser(null); setScreen('login'); setIsAdminAuthenticated(false); }} style={styles.logoutButton}>Salir</button>
          </nav>
          <div style={styles.content}>
            {activeTab === 'miJornada' && <MiJornadaScreen user={currentUser} setActiveTab={handleNavClick} />}
            {activeTab === 'laJornada' && <LaJornadaScreen />}
            {activeTab === 'calendario' && <CalendarioScreen onViewJornada={setViewingJornadaId} />}
            {activeTab === 'clasificacion' && <ClasificacionScreen />}
            {activeTab === 'pagos' && <PagosScreen user={currentUser} />}
            {activeTab === 'admin' && isAdminAuthenticated && <AdminPanelScreen />}
          </div>
        </>
      );
    }
  };
  return ( <div style={styles.container}><div style={styles.card}>{renderContent()}</div></div> );
}

// ============================================================================
// --- ESTILOS (CSS-in-JS) ---
// ============================================================================
// NOTA: Para usar las fuentes 'Cinzel' y 'Lato', añádelas a tu archivo public/index.html:
// <link rel="preconnect" href="https://fonts.googleapis.com">
// <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
// <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Lato:wght@400;700&display=swap" rel="stylesheet">
const colors = {
    darkBlue: '#0d1b2a', midBlue: '#1b263b', lightBlue: '#415a77', lightText: '#e0e1dd',
    gold: '#D4AF37',
    danger: '#d00000', success: '#40916c', warning: '#ff9f1c',
    status: { 'Próximamente': '#6c757d', 'Abierta': '#40916c', 'Cerrada': '#d00000', 'Finalizada': '#415a77' }
};

const styles = {
    colors,
    container: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: `linear-gradient(135deg, ${colors.darkBlue} 0%, #000 100%)`, padding: '20px', fontFamily: "'Lato', sans-serif" },
    card: { width: '100%', maxWidth: '800px', backgroundColor: colors.midBlue, color: colors.lightText, padding: '25px', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)', minHeight: '80vh' },
    splashContainer: { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', textAlign: 'center' },
    splashTitle: { color: colors.gold, fontSize: '3.5rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '4px', textShadow: `0 0 15px ${colors.gold}`, fontFamily: "'Cinzel', serif" },
    splashInfoBox: { border: `2px solid ${colors.gold}`, padding: '20px', borderRadius: '10px', marginTop: '30px', backgroundColor: `${colors.darkBlue}80`, width: '90%', minHeight: '150px' },
    splashInfoTitle: { margin: '0 0 10px 0', fontFamily: "'Cinzel', serif", color: colors.gold },
    splashAdminMessage: { fontStyle: 'italic', marginTop: '15px', borderTop: `1px solid ${colors.lightBlue}`, paddingTop: '15px' },
    splashBote: { color: colors.success, fontWeight: 'bold', fontSize: '1.2rem' },
    splashStats: { display: 'flex', justifyContent: 'space-around', marginTop: '10px' },
    carouselStat: { padding: '10px', fontSize: '1.1rem' },
    loginContainer: { textAlign: 'center' },
    userList: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', marginTop: '30px' },
    userButton: { width: '90%', maxWidth: '400px', padding: '15px 10px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', border: `2px solid ${colors.lightBlue}`, borderRadius: '8px', backgroundColor: 'transparent', color: colors.lightText, transition: 'all 0.3s ease', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', fontFamily: "'Cinzel', serif", letterSpacing: '2px' },
    userButtonHover: { borderColor: colors.gold, color: colors.gold, transform: 'scale(1.05)', boxShadow: `0 0 20px ${colors.gold}33` },
    navbar: { display: 'flex', flexWrap: 'wrap', gap: '10px', borderBottom: `2px solid ${colors.lightBlue}`, paddingBottom: '15px', marginBottom: '20px' },
    navButton: { padding: '10px 15px', fontSize: '1rem', border: `1px solid ${colors.lightBlue}`, borderRadius: '8px', backgroundColor: 'transparent', color: colors.lightText, cursor: 'pointer', transition: 'all 0.2s' },
    navButtonActive: { padding: '10px 15px', fontSize: '1rem', border: `1px solid ${colors.gold}`, borderRadius: '8px', backgroundColor: colors.lightBlue, color: colors.gold, cursor: 'pointer' },
    logoutButton: { padding: '10px 15px', fontSize: '1rem', border: `1px solid ${colors.danger}`, borderRadius: '8px', backgroundColor: 'transparent', color: colors.danger, cursor: 'pointer', marginLeft: 'auto', transition: 'all 0.2s' },
    content: { padding: '10px 0' },
    title: { color: colors.gold, borderBottom: `3px solid ${colors.gold}`, paddingBottom: '5px', display: 'inline-block', fontFamily: "'Cinzel', serif" },
    mainButton: { padding: '12px 25px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', border: 'none', borderRadius: '8px', backgroundColor: colors.gold, color: colors.darkBlue, marginTop: '20px', transition: 'transform 0.2s' },
    placeholder: { padding: '20px', backgroundColor: colors.darkBlue, border: '1px dashed #415a77', borderRadius: '8px', textAlign: 'center' },
    jornadaList: { display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' },
    jornadaItem: { cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', border: '1px solid #1b263b', borderRadius: '8px', backgroundColor: colors.lightBlue, transition: 'all 0.2s ease' },
    jornadaVip: { borderColor: colors.gold, borderWidth: '2px', boxShadow: `0 0 10px ${colors.gold}55` },
    jornadaInfo: { display: 'flex', flexDirection: 'column', color: colors.lightText },
    statusBadge: { color: 'white', padding: '5px 10px', borderRadius: '15px', fontSize: '0.8rem', fontWeight: 'bold' },
    adminJornadaItem: { padding: '20px', backgroundColor: colors.darkBlue, border: `1px solid ${colors.lightBlue}`, borderRadius: '8px', marginBottom: '15px' },
    adminControls: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', margin: '15px 0' },
    adminInput: { width: '90%', padding: '8px', border: '1px solid #415a77', borderRadius: '4px', backgroundColor: colors.lightBlue, color: colors.lightText },
    adminSelect: { width: '95%', padding: '8px', border: '1px solid #415a77', borderRadius: '4px', backgroundColor: colors.lightBlue, color: colors.lightText },
    saveButton: { padding: '8px 15px', border: 'none', borderRadius: '5px', backgroundColor: colors.success, color: 'white', cursor: 'pointer', marginRight: '10px' },
    form: { backgroundColor: colors.darkBlue, padding: '20px', borderRadius: '8px', marginTop: '20px' },
    formGroup: { marginBottom: '20px' },
    label: { display: 'block', marginBottom: '8px', color: colors.gold, fontWeight: 'bold' },
    input: { width: 'calc(100% - 22px)', padding: '10px', border: '1px solid #415a77', borderRadius: '4px', backgroundColor: colors.lightBlue, color: colors.lightText, fontSize: '1rem' },
    resultInputContainer: { display: 'flex', alignItems: 'center', gap: '10px' },
    resultInput: { width: '50px', textAlign: 'center', padding: '10px', border: '1px solid #415a77', borderRadius: '4px', backgroundColor: colors.lightBlue, color: colors.lightText, fontSize: '1.2rem' },
    teamName: { flex: 1, textAlign: 'center' },
    separator: { fontSize: '1.2rem', fontWeight: 'bold' },
    message: { marginTop: '15px', padding: '10px', borderRadius: '5px', backgroundColor: colors.lightBlue, color: colors.lightText },
    table: { width: '100%', marginTop: '20px', borderCollapse: 'collapse', color: colors.lightText },
    th: { backgroundColor: colors.lightBlue, color: colors.gold, padding: '12px', border: `1px solid ${colors.darkBlue}`, textAlign: 'left' },
    td: { padding: '10px 12px', border: `1px solid ${colors.lightBlue}` },
    laJornadaContainer: { textAlign: 'center', padding: '30px', backgroundColor: colors.darkBlue, borderRadius: '12px' },
    matchInfo: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', fontSize: '2rem', fontWeight: 'bold', margin: '20px 0' },
    vs: { color: colors.gold },
    countdownContainer: { margin: '30px 0' },
    countdown: { fontSize: '2.5rem', fontWeight: 'bold', color: colors.gold, backgroundColor: colors.lightBlue, padding: '15px', borderRadius: '8px', display: 'inline-block' },
    callToAction: { fontSize: '1.5rem', fontStyle: 'italic', color: colors.lightText },
    pinLockContainer: { backgroundColor: colors.darkBlue, padding: '15px', borderRadius: '8px', marginBottom: '20px', border: `1px solid ${colors.gold}` },
    apostadoresContainer: { marginTop: '30px', borderTop: `1px solid ${colors.lightBlue}`, paddingTop: '20px' },
    apostadoresGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px', marginTop: '10px' },
    apostadorHecho: { padding: '8px', backgroundColor: colors.success, color: 'white', borderRadius: '5px', textAlign: 'center' },
    apostadorPendiente: { padding: '8px', backgroundColor: colors.lightBlue, color: colors.lightText, borderRadius: '5px', textAlign: 'center', opacity: 0.6 },
    jokerContainer: { marginTop: '30px', paddingTop: '20px', borderTop: `1px solid ${colors.lightBlue}` },
    jokerButton: { padding: '10px 20px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', border: 'none', borderRadius: '8px', backgroundColor: colors.gold, color: colors.darkBlue, transition: 'all 0.2s' },
    vipBanner: { backgroundColor: colors.gold, color: colors.darkBlue, fontWeight: 'bold', padding: '15px', borderRadius: '8px', textAlign: 'center', marginBottom: '20px', fontSize: '1.2rem' },
    vipToggleContainer: { display: 'flex', alignItems: 'center', gap: '10px' },
    backButton: { padding: '10px 15px', fontSize: '1rem', border: `1px solid ${colors.lightBlue}`, borderRadius: '8px', backgroundColor: 'transparent', color: colors.lightText, cursor: 'pointer', transition: 'all 0.2s', marginBottom: '20px' },
    finalResult: { fontSize: '1.5rem', fontWeight: 'bold', color: colors.gold, textAlign: 'center', margin: '20px 0' },
    statsIndicator: { display: 'block', textAlign: 'center', marginTop: '10px', fontWeight: 'bold' },
    jokerDetailRow: { backgroundColor: `${colors.darkBlue}99` },
    jokerDetailChip: { backgroundColor: colors.lightBlue, padding: '5px 10px', borderRadius: '5px', fontSize: '0.9rem' },
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
    modalContent: { backgroundColor: colors.midBlue, padding: '30px', borderRadius: '12px', width: '90%', maxWidth: '400px', border: `1px solid ${colors.gold}` },
    winnerBanner: { backgroundColor: colors.gold, color: colors.darkBlue, fontWeight: 'bold', padding: '15px', borderRadius: '8px', textAlign: 'center', margin: '20px 0', fontSize: '1.2rem' },
    boteBanner: { backgroundColor: colors.danger, color: 'white', fontWeight: 'bold', padding: '15px', borderRadius: '8px', textAlign: 'center', margin: '20px 0', fontSize: '1.2rem' },
    winnerRow: { backgroundColor: `${colors.gold}33` },
    top1Row: { backgroundColor: `${colors.gold}4D`, fontWeight: 'bold' },
    top2Row: { backgroundColor: `#C0C0C04D` },
    top3Row: { backgroundColor: `#CD7F324D` },
    resumenContainer: { display: 'flex', flexDirection: 'column', gap: '20px' },
    resumenCategoria: { backgroundColor: colors.darkBlue, padding: '15px', borderRadius: '8px' },
    resumenTitle: { borderBottom: `1px solid ${colors.lightBlue}`, paddingBottom: '10px', marginBottom: '10px' },
    resumenItem: { display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${colors.lightBlue}55` },
    teamDisplay: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', flex: 1 },
    teamLogo: { width: '50px', height: '50px', objectFit: 'contain' }
};

export default App;
