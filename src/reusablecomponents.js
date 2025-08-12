import React, { useState, useEffect, useRef } from 'react';
import styles, { colors } from './styles';
import { SECRET_MESSAGES, ADMIN_PASSWORD } from './config/constants';

const PlayerProfileDisplay = ({ name, profile, defaultColor = styles.colors.lightText, style: customStyle = {} }) => {
    const finalProfile = profile || {};
    const color = finalProfile.color || defaultColor;
    const icon = finalProfile.icon || '';
    const isGradient = typeof color === 'string' && color.startsWith('linear-gradient');
    const nameStyle = { ...(isGradient ? { background: color, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } : { color: color }) };
    return (<span style={{ ...customStyle, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>{icon && <span>{icon}</span>}<span style={nameStyle}>{name}</span></span>);
};

const LiveBanner = ({ liveData, jornada }) => {
    if (!jornada || !liveData || !liveData.isLive) return null;
    return (<div style={styles.liveBanner}><span style={styles.liveIndicator}>🔴 EN VIVO</span><span style={styles.liveMatchInfo}>{jornada.equipoLocal} <strong>{liveData.golesLocal} - {liveData.golesVisitante}</strong> {jornada.equipoVisitante}</span>{liveData.ultimoGoleador && <span style={styles.liveGoalScorer}>Último Gol: {liveData.ultimoGoleador}</span>}</div>);
};

const TeamDisplay = ({ teamLogos, teamName, shortName = false, imgStyle }) => (<div style={styles.teamDisplay}><img src={teamLogos[teamName] || 'https://placehold.co/50x50/1b263b/e0e1dd?text=?'} style={{ ...styles.teamLogo, ...imgStyle }} alt={`${teamName} logo`} onError={(e) => { e.target.src = 'https://placehold.co/50x50/1b263b/e0e1dd?text=?'; }} /><span style={styles.teamNameText}>{shortName && teamName === "UD Las Palmas" ? "UDLP" : teamName}</span></div>);

const JokerAnimation = () => {
    const [exploded, setExploded] = useState(false);
    useEffect(() => { const timer = setTimeout(() => setExploded(true), 5500); return () => clearTimeout(timer); }, []);
    const jokers = Array.from({ length: 80 });
    return (<div style={styles.jokerAnimationOverlay}>{jokers.map((_, i) => (<span key={i} className={exploded ? 'exploded' : ''} style={{ ...styles.jokerIcon, left: `${Math.random() * 100}vw`, animationDelay: `${Math.random() * 4}s`, animationDuration: `${3 + Math.random() * 3}s`, transform: exploded ? `translate(${Math.random() * 800 - 400}px, ${Math.random() * 800 - 400}px) rotate(720deg)` : 'translateY(-100px) rotate(0deg)', opacity: exploded ? 0 : 1 }}>🃏</span>))}</div>);
};

const Confetti = () => {
    const particles = Array.from({ length: 150 });
    return (<div style={styles.confettiOverlay}>{particles.map((_, i) => (<div key={i} className="confetti-particle" style={{ '--x': `${Math.random() * 100}vw`, '--angle': `${Math.random() * 360}deg`, '--delay': `${Math.random() * 5}s`, '--color': i % 2 === 0 ? styles.colors.yellow : styles.colors.blue, }} />))}</div>);
};

const WinnerAnimation = ({ winnerData, onClose }) => {
    const { pronostico, prize } = winnerData;
    return (<div style={styles.winnerAnimationOverlay}><Confetti /><div style={styles.winnerModal}><div style={styles.trophy}>🏆</div><h2 style={styles.winnerTitle}>¡FELICIDADES, {pronostico.id}!</h2><p style={styles.winnerText}>¡Has ganado la porra de la jornada!</p><div style={styles.winnerStats}><span>Puntos Obtenidos: <strong>{pronostico.puntosObtenidos}</strong></span><span>Premio: <strong>{prize.toFixed(2)}€</strong></span></div><button onClick={onClose} style={{ ...styles.mainButton, marginTop: '30px' }}>CERRAR</button></div></div>);
};

const InstallGuideModal = ({ onClose }) => {
    return (<div style={styles.modalOverlay} onClick={onClose}><div style={styles.modalContent} onClick={(e) => e.stopPropagation()}><h3 style={styles.title}>Instalar App</h3><div style={styles.installInstructions}><h4>iPhone (Safari)</h4><ol><li>Pulsa el botón de <strong>Compartir</strong> (un cuadrado con una flecha hacia arriba).</li><li>Busca y pulsa en <strong>"Añadir a pantalla de inicio"</strong>.</li><li>¡Listo! Ya tienes la app en tu móvil.</li></ol></div><div style={styles.installInstructions}><h4>Android (Chrome)</h4><ol><li>Pulsa el botón de <strong>Menú</strong> (tres puntos verticales).</li><li>Busca y pulsa en <strong>"Instalar aplicación"</strong> o "Añadir a pantalla de inicio".</li><li>¡Listo! Ya tienes la app en tu móvil.</li></ol></div></div><button onClick={onClose} style={styles.mainButton}>Entendido</button></div></div>);
};

const NotificationPermissionModal = ({ onAllow, onDeny }) => {
    return (<div style={styles.modalOverlay}><div style={styles.modalContent} onClick={(e) => e.stopPropagation()}><div style={{ textAlign: 'center', marginBottom: '20px' }}><span style={{ fontSize: '4rem' }}>🔔</span></div><h3 style={styles.title}>ACTIVAR NOTIFICACIONES</h3><p style={{ textAlign: 'center', marginBottom: '20px', lineHeight: 1.5 }}>¿Quieres recibir avisos importantes sobre la porra? Te notificaremos cuando:</p><ul style={{ listStyle: 'none', padding: 0, marginBottom: '30px', textAlign: 'center' }}><li style={{ marginBottom: '10px' }}>✅ Se abra una nueva jornada</li><li style={{ marginBottom: '10px' }}>⏳ Estén a punto de cerrar las apuestas</li><li style={{ marginBottom: '10px' }}>🏆 Se publiquen los resultados y ganadores</li></ul><div style={{ display: 'flex', justifyContent: 'space-around', gap: '10px' }}><button onClick={onDeny} style={{ ...styles.mainButton, backgroundColor: 'transparent', color: styles.colors.lightText, borderColor: styles.colors.lightText }}>Ahora no</button><button onClick={onAllow} style={styles.mainButton}>Activar</button></div></div></div>);
};

const LoadingSkeleton = ({ type = 'list' }) => {
    if (type === 'table') { return (<div style={styles.skeletonTable}>{Array.from({ length: 5 }).map((_, i) => (<div key={i} style={styles.skeletonRow}><div style={{ ...styles.skeletonBox, width: '50px', height: '20px' }}></div><div style={{ ...styles.skeletonBox, width: '120px', height: '20px' }}></div><div style={{ ...styles.skeletonBox, width: '80px', height: '20px' }}></div><div style={{ ...styles.skeletonBox, width: '60px', height: '20px' }}></div></div>))}</div>); }
    return (<div style={styles.skeletonContainer}><div style={{ ...styles.skeletonBox, height: '40px', width: '80%', marginBottom: '20px' }}></div><div style={{ ...styles.skeletonBox, height: '20px', width: '60%' }}></div><div style={{ ...styles.skeletonBox, height: '20px', width: '70%', marginTop: '10px' }}></div></div>);
};

const AnimatedPoints = ({ value }) => {
    const [currentValue, setCurrentValue] = useState(0); const [flash, setFlash] = useState(null); const prevValueRef = useRef(0);
    useEffect(() => {
        const startValue = prevValueRef.current; const endValue = value || 0; let startTime = null;
        if (endValue > startValue) { setFlash('up'); } else if (endValue < startValue) { setFlash('down'); }
        const animation = (currentTime) => {
            if (!startTime) startTime = currentTime; const progress = Math.min((currentTime - startTime) / 1000, 1);
            const newDisplayValue = Math.floor(progress * (endValue - startValue) + startValue); setCurrentValue(newDisplayValue);
            if (progress < 1) { requestAnimationFrame(animation); } else { prevValueRef.current = endValue; setTimeout(() => setFlash(null), 700); }
        };
        requestAnimationFrame(animation); return () => { prevValueRef.current = value || 0; };
    }, [value]);
    const getFlashClass = () => { if (flash === 'up') return 'point-jump-up'; if (flash === 'down') return 'point-jump-down'; return ''; };
    return <span className={getFlashClass()}>{currentValue}</span>;
};

const AdminLoginModal = ({ onClose, onSuccess }) => {
    const [password, setPassword] = useState(''); const [error, setError] = useState('');
    const handleSubmit = (e) => { e.preventDefault(); if (password === ADMIN_PASSWORD) { onSuccess(); } else { setError('Contraseña incorrecta'); } };
    return (<div style={styles.modalOverlay}><div style={styles.modalContent}><h3 style={styles.title}>ACCESO ADMIN</h3><form onSubmit={handleSubmit}><label style={styles.label}>Contraseña:</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={styles.input} />{error && <p style={{ color: styles.colors.danger }}>{error}</p>}<div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}><button type="button" onClick={onClose} style={{ ...styles.mainButton, backgroundColor: styles.colors.blue }}>CANCELAR</button><button type="submit" style={styles.mainButton}>ENTRAR</button></div></form></div></div>);
};

export {
    PlayerProfileDisplay,
    LiveBanner,
    TeamDisplay,
    JokerAnimation,
    Confetti,
    WinnerAnimation,
    InstallGuideModal,
    NotificationPermissionModal,
    LoadingSkeleton,
    AnimatedPoints,
    AdminLoginModal
};
