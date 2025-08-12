import React, { useState, useEffect, useMemo, useRef } from 'react';
// Importaciones de Firebase directamente de sus módulos
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, doc, query, where, limit, orderBy, getDocs, setDoc, onSnapshot } from "firebase/firestore";
import { getMessaging, getToken } from "firebase/messaging";
import { getDatabase, ref, onValue, onDisconnect, set } from "firebase/database";
import { getFunctions, httpsCallable } from "firebase/functions";
// Importaciones de tus archivos de configuración
import { JUGADORES, ADMIN_PASSWORD, APUESTA_NORMAL, APUESTA_VIP, PLANTILLA_INICIAL } from './config/constants';
import styles, { colors } from './styles';
import { LiveBanner, WinnerAnimation, InstallGuideModal, NotificationPermissionModal, PlayerProfileDisplay, AnimatedPoints } from './reusableComponents';
import { app, db, auth, rtdb, messaging, functions } from './firebaseConfig';

// Importación de los nuevos componentes de pantalla
import InitialSplashScreen from './components/InitialSplashScreen';
import SplashScreen from './components/SplashScreen';
import LoginScreen from './components/LoginScreen';
import ProfileCustomizationScreen from './components/ProfileCustomizationScreen';
import MiJornadaScreen from './components/MiJornadaScreen';
import LaJornadaScreen from './components/LaJornadaScreen';
import CalendarioScreen from './components/CalendarioScreen';
import ClasificacionScreen from './components/ClasificacionScreen';
import PagosScreen from './components/PagosScreen';
import AdminPanelScreen from './components/AdminPanelScreen';
import JornadaDetalleScreen from './components/JornadaDetalleScreen';
import PorraAnualScreen from './components/PorraAnualScreen';
import ProfileScreen from './components/ProfileScreen';
import AdminLoginModal from './components/AdminLoginModal';

const VAPID_KEY = "AQUÍ_VA_LA_CLAVE_LARGA_QUE_COPIASTE";

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
    const [plantilla, setPlantilla] = useState([]);
    const [showNotificationModal, setShowNotificationModal] = useState(false);
    const [userProfiles, setUserProfiles] = useState({});
    const [onlineUsers, setOnlineUsers] = useState({});
    const [allJornadas, setAllJornadas] = useState([]);
    const [mainJornada, setMainJornada] = useState(null);

    useEffect(() => {
        // La inicialización de Firebase se hace en firebaseConfig.js. Aquí solo se importan las instancias.
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => { if (!user) { signInAnonymously(auth).catch((error) => console.error("Error de autenticación anónima:", error)); } });
        const styleSheet = document.createElement("style"); styleSheet.type = "text/css"; styleSheet.innerText = `@import url('https://fonts.googleapis.com/css2?family=Teko:wght@700&family=Orbitron&family=Exo+2&family=Russo+One&display=swap'); * { margin: 0; padding: 0; box-sizing: border-box; } html { font-size: 16px !important; -webkit-text-size-adjust: 100%; } body, #root { width: 100%; min-width: 100%; overflow-x: hidden; } @keyframes neon-glow { from { box-shadow: 0 0 5px #fff, 0 0 10px #fff, 0 0 15px #0f0, 0 0 20px #0f0, 0 0 25px #0f0; } to { box-shadow: 0 0 10px #fff, 0 0 20px #fff, 0 0 30px #0f0, 0 0 40px #0f0, 0 0 50px #0f0; } } @keyframes fall { 0% { transform: translateY(-100px) rotate(0deg); opacity: 1; } 100% { transform: translateY(100vh) rotate(360deg); opacity: 0; } } .exploded { transition: transform 1s ease-out, opacity 1s ease-out; } @keyframes trophy-grow { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } } @keyframes text-fade-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } } @keyframes highlight { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } } @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } } @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } } @keyframes slideInFromRight { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } } .content-enter-active { animation: slideInFromRight 0.4s ease-out; } @keyframes pop-in { 0% { opacity: 0; transform: scale(0.8); } 100% { opacity: 1; transform: scale(1); } } .stats-indicator { animation: pop-in 0.5s cubic-bezier(0.25, 1, 0.5, 1) forwards; } @keyframes confetti-fall { 0% { transform: translateY(-100vh) rotate(0deg); } 100% { transform: translateY(100vh) rotate(720deg); } } .confetti-particle { position: absolute; width: 10px; height: 10px; background-color: var(--color); top: 0; left: var(--x); animation: confetti-fall 5s linear var(--delay) infinite; } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } .spinner { animation: spin 1.5s linear infinite; } @keyframes title-shine { 0% { background-position: -200% center; } 100% { background-position: 200% center; } } @keyframes blink-live { 50% { background-color: #a11d27; } } @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } } @keyframes point-jump-up { 0% { transform: translateY(0); color: ${colors.lightText}; } 50% { transform: translateY(-10px) scale(1.2); color: ${colors.success}; } 100% { transform: translateY(0); color: ${colors.lightText}; } } .point-jump-up { animation: point-jump-up 0.7s ease-out; }`;
        document.head.appendChild(styleSheet);
        const configRef = doc(db, "configuracion", "porraAnual"); const unsubscribeConfig = onSnapshot(configRef, (doc) => { setPorraAnualConfig(doc.exists() ? doc.data() : null); });
        const escudosRef = doc(db, "configuracion", "escudos"); const unsubscribeEscudos = onSnapshot(escudosRef, (docSnap) => { if (docSnap.exists()) { setTeamLogos(docSnap.data()); } });
        const qLive = query(collection(db, "jornadas"), where("liveData.isLive", "==", true), limit(1)); const unsubscribeLive = onSnapshot(qLive, (snapshot) => { if (!snapshot.empty) { const jornada = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() }; setLiveJornada(jornada); } else { setLiveJornada(null); } });
        const plantillaRef = doc(db, "configuracion", "plantilla"); const unsubscribePlantilla = onSnapshot(plantillaRef, (docSnap) => { if (docSnap.exists() && docSnap.data().jugadores) { setPlantilla(docSnap.data().jugadores); } else { setDoc(plantillaRef, { jugadores: PLANTILLA_INICIAL }); setPlantilla(PLANTILLA_INICIAL); } });
        const clasificacionRef = collection(db, "clasificacion"); const unsubscribeProfiles = onSnapshot(clasificacionRef, (snapshot) => { const profiles = {}; snapshot.forEach(doc => { profiles[doc.id] = doc.data(); }); setUserProfiles(profiles); });
        const statusRef = ref(rtdb, 'status/'); const unsubscribeStatus = onValue(statusRef, (snapshot) => { const data = snapshot.val(); setOnlineUsers(data || {}); });

        const qJornadas = query(collection(db, "jornadas"), orderBy("numeroJornada", "desc"));
        const unsubscribeJornadas = onSnapshot(qJornadas, (snap) => {
            const jornadasData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setAllJornadas(jornadasData);
            let jornadaToShow = null;
            const activas = jornadasData.filter(d => d.estado === 'Abierta');
            const cerradas = jornadasData.filter(d => d.estado === 'Cerrada');
            const finalizadas = jornadasData.filter(d => d.estado === 'Finalizada');
            const proximas = jornadasData.filter(d => d.estado === 'Próximamente').sort((a, b) => a.numeroJornada - b.numeroJornada);

            if (activas.length > 0) {
                jornadaToShow = activas[0];
            } else if (cerradas.length > 0) {
                jornadaToShow = cerradas[0];
            } else if (finalizadas.length > 0) {
                jornadaToShow = finalizadas[0];
            } else if (proximas.length > 0) {
                jornadaToShow = proximas[0];
            }
            setMainJornada(jornadaToShow);
        });

        return () => {
            document.head.removeChild(styleSheet);
            unsubscribeConfig();
            unsubscribeAuth();
            unsubscribeEscudos();
            unsubscribeLive();
            unsubscribePlantilla();
            unsubscribeProfiles();
            unsubscribeStatus();
            unsubscribeJornadas();
        }
    }, []);

    const handleRequestPermission = async (user) => {
        setShowNotificationModal(false);
        localStorage.setItem('notificationPrompt_v2_seen', 'true');
        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                console.log('Notification permission granted.');
                const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
                if (currentToken) {
                    console.log('Token de notificación:', currentToken);
                    const tokenRef = doc(db, "notification_tokens", currentToken);
                    await setDoc(tokenRef, { user: user, createdAt: new Date() });
                } else { console.log('No registration token available. Request permission to generate one.'); }
            } else { console.log('Unable to get permission to notify.'); }
        } catch (error) { console.error('An error occurred while retrieving token. ', error); }
    };

    const handleLogin = async (user) => {
        setCurrentUser(user);
        const userStatusRef = ref(rtdb, 'status/' + user); await set(userStatusRef, true); onDisconnect(userStatusRef).set(false);
        const userProfileRef = doc(db, "clasificacion", user); const docSnap = await getDoc(userProfileRef);
        if (docSnap.exists() && docSnap.data().icon && docSnap.data().color) { setScreen('app'); } else { setScreen('customizeProfile'); }

        const hasSeenPrompt = localStorage.getItem('notificationPrompt_v2_seen');
        if ('Notification' in window && Notification.permission !== 'granted' && !hasSeenPrompt) {
            setShowNotificationModal(true);
        }

        const q = query(collection(db, "jornadas"), where("estado", "==", "Finalizada"), orderBy("numeroJornada", "desc"), limit(1));
        const jornadaSnap = await getDocs(q);
        if (!jornadaSnap.empty) {
            const jornadaDoc = jornadaSnap.docs[0]; const jornada = { id: jornadaDoc.id, ...jornadaDoc.data() };
            const lastSeenWinnerJornada = sessionStorage.getItem('lastSeenWinnerJornada');
            if (jornada.id !== lastSeenWinnerJornada && jornada.ganadores?.includes(user)) {
                const pronosticoRef = doc(db, "pronosticos", jornada.id, "jugadores", user); const pronosticoSnap = await getDoc(pronosticoRef);
                const allPronosticosSnap = await getDocs(collection(db, "pronosticos", jornada.id, "jugadores"));
                const prize = (allPronosticosSnap.size * (jornada.esVip ? APUESTA_VIP : APUESTA_NORMAL)) + (jornada.bote || 0);
                if (pronosticoSnap.exists()) { setWinnerData({ pronostico: { id: user, ...pronosticoSnap.data() }, prize: prize / jornada.ganadores.length }); sessionStorage.setItem('lastSeenWinnerJornada', jornada.id); }
            }
        }
    };

    const handleLogout = () => { if (currentUser) { const userStatusRef = ref(rtdb, 'status/' + currentUser); set(userStatusRef, false); } setCurrentUser(null); setScreen('login'); setIsAdminAuthenticated(false); };
    const handleSaveProfile = async (user, profileData) => { const profileRef = doc(db, "clasificacion", user); await setDoc(profileRef, profileData, { merge: true }); setScreen('app'); setActiveTab('miJornada'); };
    const handleNavClick = (tab) => { setViewingJornadaId(null); setViewingPorraAnual(false); setActiveTab(tab); if (tab !== 'admin') { setIsAdminAuthenticated(false); } };
    const handleAdminClick = () => { if (isAdminAuthenticated) { setActiveTab('admin'); } else { setShowAdminLogin(true); } };
    const handleAdminLoginSuccess = () => { setIsAdminAuthenticated(true); setShowAdminLogin(false); setActiveTab('admin'); };

    const renderContent = () => {
        if (showInitialSplash) return <InitialSplashScreen onFinish={() => { setShowInitialSplash(false); }} />;
        if (screen === 'splash') return <SplashScreen onEnter={() => setScreen('login')} teamLogos={teamLogos} currentUser={currentUser} jornadaInfo={mainJornada} />;
        if (screen === 'login') return <LoginScreen onLogin={handleLogin} userProfiles={userProfiles} onlineUsers={onlineUsers} />;
        if (screen === 'customizeProfile') return <ProfileCustomizationScreen user={currentUser} onSave={handleSaveProfile} userProfile={userProfiles[currentUser] || {}} />;
        if (screen === 'app') {
            const CurrentScreen = () => {
                if (viewingJornadaId) return <JornadaDetalleScreen jornadaId={viewingJornadaId} onBack={() => setViewingJornadaId(null)} teamLogos={teamLogos} userProfiles={userProfiles} />;
                if (viewingPorraAnual) return <PorraAnualScreen user={currentUser} onBack={() => setViewingPorraAnual(false)} config={porraAnualConfig} />;
                if (activeTab === 'profile') return <ProfileScreen user={currentUser} userProfile={userProfiles[currentUser]} onEdit={() => setScreen('customizeProfile')} onBack={() => setActiveTab('miJornada')} />;
                switch (activeTab) {
                    case 'miJornada': return <MiJornadaScreen user={currentUser} setActiveTab={handleNavClick} teamLogos={teamLogos} liveData={liveJornada?.liveData} plantilla={plantilla} userProfiles={userProfiles} currentJornada={mainJornada} />;
                    case 'laJornada': return <LaJornadaScreen teamLogos={teamLogos} liveData={liveJornada?.liveData} userProfiles={userProfiles} onlineUsers={onlineUsers} jornadaActual={mainJornada} />;
                    case 'calendario': return <CalendarioScreen onViewJornada={setViewingJornadaId} teamLogos={teamLogos} jornadas={allJornadas} />;
                    case 'clasificacion': return <ClasificacionScreen currentUser={currentUser} liveData={liveJornada?.liveData} liveJornada={liveJornada} userProfiles={userProfiles} />;
                    case 'pagos': return <PagosScreen user={currentUser} userProfiles={userProfiles} />;
                    case 'admin': return isAdminAuthenticated ? <AdminPanelScreen teamLogos={teamLogos} allJornadas={allJornadas} /> : null;
                    default: return null;
                }
            };
            return (<>{showAdminLogin && <AdminLoginModal onClose={() => setShowAdminLogin(false)} onSuccess={handleAdminLoginSuccess} />}{showNotificationModal && <NotificationPermissionModal onAllow={() => handleRequestPermission(currentUser)} onDeny={() => { setShowNotificationModal(false); localStorage.setItem('notificationPrompt_v2_seen', 'true'); }} />}{porraAnualConfig?.estado === 'Abierta' && !viewingPorraAnual && (<div style={styles.porraAnualBanner} onClick={() => setViewingPorraAnual(true)}>⭐ ¡PORRA ANUAL ABIERTA! ⭐ Haz tu pronóstico antes de la Jornada 5. ¡Pincha aquí!</div>)}<LiveBanner liveData={liveJornada?.liveData} jornada={liveJornada} /><nav style={styles.navbar}><button onClick={() => handleNavClick('miJornada')} style={activeTab === 'miJornada' ? styles.navButtonActive : styles.navButton}>Mi Jornada</button><button onClick={() => handleNavClick('laJornada')} style={activeTab === 'laJornada' ? styles.navButtonActive : styles.navButton}>La Jornada</button><button onClick={() => handleNavClick('calendario')} style={activeTab === 'calendario' ? styles.navButtonActive : styles.navButton}>Calendario</button><button onClick={() => handleNavClick('clasificacion')} style={activeTab === 'clasificacion' ? styles.navButtonActive : styles.navButton}>Clasificación</button><button onClick={() => handleNavClick('pagos')} style={activeTab === 'pagos' ? styles.navButtonActive : styles.navButton}>Pagos</button>{currentUser === 'Juanma' && (<button onClick={handleAdminClick} style={activeTab === 'admin' ? styles.navButtonActive : styles.navButton}>Admin</button>)}<button onClick={() => handleNavClick('profile')} style={styles.profileNavButton}><PlayerProfileDisplay name={currentUser} profile={userProfiles[currentUser]} /></button><button onClick={handleLogout} style={styles.logoutButton}>Salir</button></nav><div key={activeTab} className="content-enter-active" style={styles.content}><CurrentScreen /></div></>);
        }
    };
    return (<>{winnerData && <WinnerAnimation winnerData={winnerData} onClose={() => setWinnerData(null)} />}<div id="app-container" style={styles.container}><div style={styles.card}>{renderContent()}</div></div></>);
}

export default App;
