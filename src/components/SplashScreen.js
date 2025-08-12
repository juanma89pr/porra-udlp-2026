import React, { useState, useEffect, useMemo } from 'react';
import { db, doc, onSnapshot, runTransaction } from '../firebaseConfig';
import styles from '../styles';
import { REACTION_EMOJIS, JUGADORES } from '../constants';
import { LoadingSkeleton, TeamDisplay, InstallGuideModal } from '../reusableComponents';

const SplashScreen = ({ onEnter, teamLogos, currentUser, jornadaInfo }) => {
    const [countdown, setCountdown] = useState('');
    const [loading, setLoading] = useState(true);
    const [showInstallGuide, setShowInstallGuide] = useState(false);
    const isMobile = useMemo(() => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent), []);
    const [reactions, setReactions] = useState({});

    useEffect(() => {
        if (!jornadaInfo || !jornadaInfo.id) {
            setLoading(!jornadaInfo);
            return;
        }
        setLoading(false);
        const reactionsRef = doc(db, "jornadas", jornadaInfo.id);
        const unsubscribe = onSnapshot(reactionsRef, (docSnap) => {
            if (docSnap.exists() && docSnap.data().reactions) {
                setReactions(docSnap.data().reactions);
            } else {
                setReactions({});
            }
        });
        return () => unsubscribe();
    }, [jornadaInfo]);


    useEffect(() => {
        if (!jornadaInfo) return;
        
        let targetDate;
        if (jornadaInfo.estado === 'Abierta') {
            targetDate = jornadaInfo.fechaCierre?.toDate();
        } else if (jornadaInfo.estado === 'Próximamente') {
            targetDate = jornadaInfo.fechaApertura?.toDate();
        } else {
            setCountdown('');
            return;
        }

        if (!targetDate) { setCountdown(''); return; }

        const interval = setInterval(() => {
            const now = new Date();
            const diff = targetDate - now;
            if (diff <= 0) { 
                setCountdown(jornadaInfo.estado === 'Abierta' ? "¡APUESTAS CERRADAS!" : "¡PARTIDO EN JUEGO!"); 
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
    
    const handleReaction = async (emoji) => {
        if (!currentUser || !jornadaInfo) return;
        const reactionRef = doc(db, "jornadas", jornadaInfo.id);

        try {
            await runTransaction(db, async (transaction) => {
                const reactionDoc = await transaction.get(reactionRef);
                if (!reactionDoc.exists()) { 
                    throw new Error("Document does not exist!"); 
                }
                
                const currentReactions = reactionDoc.data().reactions || { counts: {}, userReactions: {} };
                const currentUserReaction = currentReactions.userReactions?.[currentUser];

                if (currentUserReaction === emoji) {
                    delete currentReactions.userReactions[currentUser];
                    currentReactions.counts[emoji] = (currentReactions.counts[emoji] || 1) - 1;
                    if (currentReactions.counts[emoji] === 0) {
                        delete currentReactions.counts[emoji];
                    }
                } else {
                    if (currentUserReaction) {
                         currentReactions.counts[currentUserReaction] = (currentReactions.counts[currentUserReaction] || 1) - 1;
                         if (currentReactions.counts[currentUserReaction] === 0) {
                            delete currentReactions.counts[currentUserReaction];
                         }
                    }
                    currentReactions.userReactions[currentUser] = emoji;
                    currentReactions.counts[emoji] = (currentReactions.counts[emoji] || 0) + 1;
                }
                transaction.update(reactionRef, { reactions: currentReactions });
            });
        } catch (e) {
            console.error("Transaction failed: ", e);
        }
    };

    const renderJornadaInfo = () => {
        if (!jornadaInfo) { return (<div style={styles.splashInfoBox}><h3 style={styles.splashInfoTitle}>TEMPORADA EN PAUSA</h3><p>El administrador aún no ha configurado la próxima jornada.</p></div>); }
        let infoContent;
        switch (jornadaInfo.estado) {
            case 'Abierta': infoContent = (<><h3 style={styles.splashInfoTitle}>¡APUESTAS ABIERTAS!</h3><p style={styles.splashMatch}>{jornadaInfo.equipoLocal} <span style={{ color: styles.colors.yellow }}>vs</span> {jornadaInfo.equipoVisitante}</p><div style={styles.countdownContainer}><p>CIERRE DE APUESTAS</p><div style={styles.countdown}>{countdown}</div></div></>); break;
            case 'Cerrada': infoContent = (<><h3 style={styles.splashInfoTitle}>¡APUESTAS CERRADAS!</h3><p style={styles.splashMatch}>{jornadaInfo.equipoLocal} <span style={{ color: styles.colors.yellow }}>vs</span> {jornadaInfo.equipoVisitante}</p><p>Esperando el resultado del partido...</p></>); break;
            case 'Finalizada': infoContent = (<><h3 style={styles.splashInfoTitle}>ÚLTIMA JORNADA FINALIZADA</h3><p style={styles.splashMatch}>{jornadaInfo.equipoLocal} <span style={{ color: styles.colors.yellow }}>vs</span> {jornadaInfo.equipoVisitante}</p><p style={styles.finalResult}>Resultado: {jornadaInfo.resultadoLocal} - {jornadaInfo.resultadoVisitante}</p></>); break;
            case 'Próximamente': infoContent = (<><h3 style={styles.splashInfoTitle}>PRÓXIMA JORNADA</h3><p style={styles.splashMatch}>{jornadaInfo.equipoLocal} <span style={{ color: styles.colors.yellow }}>vs</span> {jornadaInfo.equipoVisitante}</p>{jornadaInfo.bote > 0 && <p style={styles.splashBote}>¡BOTE DE {jornadaInfo.bote}€ EN JUEGO!</p>}{countdown && <div style={styles.countdownContainer}><p>EL PARTIDO COMIENZA EN</p><div style={styles.countdown}>{countdown}</div></div>}</>); break;
            default: infoContent = null;
        }

        const userReaction = reactions.userReactions?.[currentUser];

        return (
            <div style={styles.splashInfoBox}>
                {infoContent}
                {jornadaInfo.splashMessage && <p style={styles.splashAdminMessage}>"{jornadaInfo.splashMessage}"</p>}
                <div style={styles.reactionContainer}>
                    <div style={styles.reactionEmojis}>
                        {REACTION_EMOJIS.map(emoji => (
                            <button key={emoji} onClick={() => handleReaction(emoji)} style={userReaction === emoji ? { ...styles.reactionButton, ...styles.reactionButtonSelected } : styles.reactionButton}>
                                {emoji}
                            </button>
                        ))}
                    </div>
                    <div style={styles.reactionCounts}>
                        {Object.entries(reactions.counts || {}).map(([emoji, count]) => (
                            count > 0 && <span key={emoji} style={styles.reactionCountChip}>{emoji} {count}</span>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    return (<>{showInstallGuide && <InstallGuideModal onClose={() => setShowInstallGuide(false)} />}<div style={styles.splashContainer}><div style={styles.splashLogoContainer}><img src="https://upload.wikimedia.org/wikipedia/en/thumb/2/20/UD_Las_Palmas_logo.svg/1200px-UD_Las_Palmas_logo.svg.png" alt="UD Las Palmas Logo" style={styles.splashLogo} /><div style={styles.splashTitleContainer}><span style={styles.splashTitle}>PORRA UDLP</span><span style={styles.splashYear}>2026</span></div></div>{loading ? (<LoadingSkeleton />) : renderJornadaInfo()}<button onClick={onEnter} style={styles.mainButton}>ENTRAR</button>{isMobile && (<button onClick={() => setShowInstallGuide(true)} style={styles.installButton}>¿Cómo instalar la App?</button>)}</div></>);
};

export default SplashScreen;
