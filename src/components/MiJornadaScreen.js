import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db, collection, doc, getDoc, onSnapshot, query, where, limit, updateDoc, orderBy, setDoc, increment, runTransaction } from '../firebaseConfig';
import styles, { colors } from '../styles';
import { calculateProvisionalPoints } from '../logic';
import { JUGADORES, APUESTA_NORMAL, APUESTA_VIP, PLANTILLA_INICIAL, SECRET_MESSAGES } from '../constants';
import { LoadingSkeleton, PlayerProfileDisplay, TeamDisplay, JokerAnimation } from '../reusableComponents';

const initialPronosticoState = {
    golesLocal: '',
    golesVisitante: '',
    resultado1x2: '',
    goleador: '',
    sinGoleador: false,
    pin: '',
    pinConfirm: '',
    jokerActivo: false,
    jokerPronosticos: Array(10).fill({ golesLocal: '', golesVisitante: '' })
};

const MiJornadaScreen = ({ user, setActiveTab, teamLogos, liveData, plantilla, userProfiles, currentJornada }) => {
    const [loading, setLoading] = useState(true);
    const [pronostico, setPronostico] = useState(initialPronosticoState);
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const [isLocked, setIsLocked] = useState(true);
    const [pinInput, setPinInput] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState({ text: '', type: 'info' });
    const [stats, setStats] = useState({ count: 0, color: styles.colors.success });
    const [jokersRestantes, setJokersRestantes] = useState(2);
    const [panicButtonDisabled, setPanicButtonDisabled] = useState(false);
    const [allPronosticos, setAllPronosticos] = useState([]);
    const [jokerStats, setJokerStats] = useState(Array(10).fill(null));
    const [showJokerAnimation, setShowJokerAnimation] = useState(false);
    const [provisionalData, setProvisionalData] = useState({ puntos: 0, posicion: '-' });

    const userProfile = userProfiles[user] || {};

    useEffect(() => {
        setLoading(true);
        const userJokerRef = doc(db, "clasificacion", user);
        getDoc(userJokerRef).then(docSnap => { setJokersRestantes(docSnap.exists() && docSnap.data().jokersRestantes !== undefined ? docSnap.data().jokersRestantes : 2); });

        if (currentJornada) {
            if (currentJornada.estado === "Abierta" && currentJornada.fechaCierre) {
                setPanicButtonDisabled(new Date().getTime() > (currentJornada.fechaCierre.toDate().getTime() - 3600 * 1000));
            }
            const pronosticoRef = doc(db, "pronosticos", currentJornada.id, "jugadores", user);
            const unsubPronostico = onSnapshot(pronosticoRef, (pronosticoSnap) => {
                if (pronosticoSnap.exists()) {
                    const data = pronosticoSnap.data();
                    const filledJokerPronosticos = data.jokerPronosticos ? [...data.jokerPronosticos, ...Array(10 - data.jokerPronosticos.length).fill({ golesLocal: '', golesVisitante: '' })] : Array(10).fill({ golesLocal: '', golesVisitante: '' });
                    setPronostico({ ...initialPronosticoState, ...data, jokerPronosticos: filledJokerPronosticos });
                    setIsLocked(!!data.pin); setHasSubmitted(true);
                } else {
                    setPronostico(initialPronosticoState); setIsLocked(false); setHasSubmitted(false);
                } setLoading(false);
            });

            const allPronosticosRef = collection(db, "pronosticos", currentJornada.id, "jugadores");
            const unsubAllPronosticos = onSnapshot(allPronosticosRef, (snapshot) => {
                setAllPronosticos(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            });

            return () => {
                unsubPronostico();
                unsubAllPronosticos();
            };
        } else {
            setLoading(false);
        }
    }, [user, currentJornada]);

    useEffect(() => {
        if (currentJornada && currentJornada.estado === 'Cerrada' && liveData && liveData.isLive && allPronosticos.length > 0) {
            const ranking = allPronosticos.map(p => ({ id: p.id, puntos: calculateProvisionalPoints(p, liveData, currentJornada) })).sort((a, b) => b.puntos - a.puntos);
            const miRanking = ranking.find(r => r.id === user);
            const miPosicion = ranking.findIndex(r => r.id === user) + 1;
            setProvisionalData({ puntos: miRanking ? miRanking.puntos : 0, posicion: miRanking ? `${miPosicion}º` : '-' });
        } else { setProvisionalData({ puntos: 0, posicion: '-' }); }
    }, [liveData, currentJornada, allPronosticos, user]);

    useEffect(() => {
        if (currentJornada && currentJornada.estado === 'Abierta' && pronostico.golesLocal !== '' && pronostico.golesVisitante !== '') {
            const otherPlayersPronosticos = allPronosticos.filter(p => p.id !== user);
            const count = otherPlayersPronosticos.filter(p => p.golesLocal === pronostico.golesLocal && p.golesVisitante === pronostico.golesVisitante).length;
            let color = styles.colors.success; if (count >= 1 && count <= 2) color = styles.colors.warning; if (count >= 3) color = styles.colors.danger; setStats({ count, color });
        } else { setStats({ count: 0, color: styles.colors.success }); }
    }, [pronostico.golesLocal, pronostico.golesVisitante, allPronosticos, user, currentJornada]);

    useEffect(() => {
        if (!pronostico.jokerActivo || allPronosticos.length === 0) { setJokerStats(Array(10).fill(null)); return; }
        const otherPlayersPronosticos = allPronosticos.filter(p => p.id !== user);
        const newJokerStats = pronostico.jokerPronosticos.map(jokerBet => {
            if (jokerBet.golesLocal === '' || jokerBet.golesVisitante === '') { return null; }
            const count = otherPlayersPronosticos.filter(p => p.golesLocal === jokerBet.golesLocal && p.golesVisitante === jokerBet.golesVisitante).length;
            let color = styles.colors.success; if (count >= 1 && count <= 2) color = styles.colors.warning; if (count >= 3) color = styles.colors.danger;
            const text = count > 0 ? `Repetido ${count} vece(s)` : '¡Único!'; return { count, color, text };
        }); setJokerStats(newJokerStats);
    }, [pronostico.jokerPronosticos, allPronosticos, user, pronostico.jokerActivo]);

    const handlePronosticoChange = (e) => { const { name, value, type, checked } = e.target; setPronostico(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value, ...(name === 'sinGoleador' && checked && { goleador: '' }) })); };
    const handleJokerPronosticoChange = (index, field, value) => { const newJokerPronosticos = [...pronostico.jokerPronosticos]; newJokerPronosticos[index] = { ...newJokerPronosticos[index], [field]: value }; setPronostico(prev => ({ ...prev, jokerPronosticos: newJokerPronosticos })); };

    const handleGuardarPronostico = async (e) => {
        e.preventDefault();
        if (!currentJornada) return;
        if (pronostico.pin && pronostico.pin !== pronostico.pinConfirm) {
            setMessage({ text: 'Los PIN no coinciden. Por favor, revísalos.', type: 'error' });
            return;
        }
        setIsSaving(true); setMessage({ text: '', type: 'info' });
        const pronosticoRef = doc(db, "pronosticos", currentJornada.id, "jugadores", user);
        try {
            const { pinConfirm, ...pronosticoToSave } = pronostico;
            const cleanJokerPronosticos = pronosticoToSave.jokerPronosticos.filter(p => p.golesLocal !== '' || p.golesVisitante !== '');
            await setDoc(pronosticoRef, { ...pronosticoToSave, jokerPronosticos: cleanJokerPronosticos, lastUpdated: new Date() });
            setMessage({ text: '¡Pronóstico guardado y secreto!', type: 'success' });
            setHasSubmitted(true);
        } catch (error) { console.error("Error al guardar: ", error); setMessage({ text: 'Error al guardar.', type: 'error' }); }
        setIsSaving(false);
    };

    const handleUnlock = () => { if (pinInput === pronostico.pin) { setIsLocked(false); setHasSubmitted(false); setMessage({ text: 'Pronóstico desbloqueado. Puedes hacer cambios.', type: 'info' }); } else { alert('PIN incorrecto'); } };
    const handleActivarJoker = async () => {
        if (jokersRestantes <= 0) { alert("No te quedan Jokers esta temporada."); return; }
        if (window.confirm("¿Seguro que quieres usar un JOKER para esta jornada? Esta acción no se puede deshacer y se descontará de tu total.")) {
            setShowJokerAnimation(true); setTimeout(() => setShowJokerAnimation(false), 7000);
            const userJokerRef = doc(db, "clasificacion", user); const userDoc = await getDoc(userJokerRef);
            if (!userDoc.exists()) { await setDoc(userJokerRef, { jokersRestantes: 1, puntosTotales: 0, jugador: user }); setJokersRestantes(1); }
            else { await updateDoc(userJokerRef, { jokersRestantes: increment(-1) }); setJokersRestantes(prev => prev - 1); }
            setPronostico(prev => ({ ...prev, jokerActivo: true }));
        }
    };
    const handleBotonDelPanico = async () => { if (window.confirm("¿Seguro que quieres cancelar tus apuestas JOKER? No recuperarás el JOKER gastado.")) { setPronostico(prev => ({ ...prev, jokerPronosticos: Array(10).fill({ golesLocal: '', golesVisitante: '' }) })); const pronosticoRef = doc(db, "pronosticos", currentJornada.id, "jugadores", user); await updateDoc(pronosticoRef, { jokerPronosticos: [] }); setMessage({ text: 'Apuestas JOKER eliminadas.', type: 'info' }); } };
    const handleMarcarComoPagado = async () => { if (!currentJornada) return; const pronosticoRef = doc(db, "pronosticos", currentJornada.id, "jugadores", user); try { await updateDoc(pronosticoRef, { pagado: true }); setPronostico(prev => ({ ...prev, pagado: true })); setMessage({ text: '¡Pago registrado con éxito!', type: 'success' }); } catch (error) { console.error("Error al marcar como pagado: ", error); setMessage({ text: 'Error al registrar el pago.', type: 'error' }); } };

    const handleCopyLastBet = async () => {
        setMessage({ text: 'Buscando tu última apuesta...', type: 'info' });
        const qLastJornada = query(collection(db, "jornadas"), where("estado", "==", "Finalizada"), orderBy("numeroJornada", "desc"), limit(1));
        const lastJornadaSnap = await getDocs(qLastJornada);

        if (lastJornadaSnap.empty) {
            setMessage({ text: 'No se encontraron jornadas anteriores para copiar.', type: 'error' });
            return;
        }

        const lastJornadaId = lastJornadaSnap.docs[0].id;
        const lastPronosticoRef = doc(db, "pronosticos", lastJornadaId, "jugadores", user);
        const lastPronosticoSnap = await getDoc(lastPronosticoRef);

        if (lastPronosticoSnap.exists()) {
            const lastData = lastPronosticoSnap.data();
            setPronostico(prev => ({
                ...prev,
                golesLocal: lastData.golesLocal,
                golesVisitante: lastData.golesVisitante,
                resultado1x2: lastData.resultado1x2,
                goleador: lastData.goleador,
                sinGoleador: lastData.sinGoleador,
            }));
            setMessage({ text: 'Última apuesta cargada. ¡No olvides guardarla!', type: 'success' });
        } else {
            setMessage({ text: 'No participaste en la última jornada.', type: 'error' });
        }
    };

    if (loading) return <LoadingSkeleton />;

    const renderContent = () => {
        if (!currentJornada) { return <div style={styles.placeholder}><h3>No hay jornadas disponibles.</h3><p>El administrador añadirá nuevas jornadas próximamente.</p></div>; }
        switch (currentJornada.estado) {
            case 'Abierta':
                const isVip = currentJornada.esVip;
                return (
                    <form onSubmit={handleGuardarPronostico} style={styles.form}>
                        {currentJornada.bote > 0 && <div style={styles.jackpotBanner}>💰 JACKPOT: ¡{currentJornada.bote}€ DE BOTE! 💰</div>}
                        {isVip && (<div style={styles.vipBanner}>⭐ JORNADA VIP ⭐ (Apuesta: 2€ - Puntos Dobles)</div>)}
                        <h3 style={styles.formSectionTitle}>{currentJornada.id === 'jornada_test' ? 'Jornada de Prueba' : `Jornada ${currentJornada.numeroJornada}`}: {currentJornada.equipoLocal} vs {currentJornada.equipoVisitante}</h3>
                        
                        {!hasSubmitted && <button type="button" onClick={handleCopyLastBet} style={styles.secondaryButton}>Copiar mi última apuesta</button>}

                        {hasSubmitted && isLocked ? (
                            <div style={styles.placeholder}><h3>¡Pronóstico guardado y secreto!</h3><p>Tu apuesta está protegida con PIN. Podrás ver los pronósticos de todos cuando la jornada se cierre.</p><div style={{ marginTop: '20px' }}><input type="password" maxLength="4" value={pinInput} onChange={(e) => setPinInput(e.target.value)} style={styles.input} placeholder="PIN de 4 dígitos" /><button type="button" onClick={handleUnlock} style={styles.mainButton}>Desbloquear</button></div></div>
                        ) : hasSubmitted && !isLocked ? (
                            <div style={styles.placeholder}><h3>¡Pronóstico guardado!</h3><p>Tu apuesta no está protegida con PIN. Cualquiera podría modificarla si accede con tu perfil.</p><button type="button" onClick={() => { setIsLocked(false); setHasSubmitted(false); }} style={styles.mainButton}>Modificar Apuesta</button></div>
                        ) : (
                            <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
                                <div style={styles.formGroup}><label style={styles.label}>RESULTADO EXACTO <span style={styles.pointsReminder}>( {isVip ? '6' : '3'} Puntos )</span></label><div style={styles.miJornadaMatchInfo}><TeamDisplay teamLogos={teamLogos} teamName={currentJornada.equipoLocal} shortName={true} imgStyle={styles.miJornadaTeamLogo} /><div style={styles.miJornadaScoreInputs}><input type="tel" inputMode="numeric" pattern="[0-9]*" name="golesLocal" value={pronostico.golesLocal} onChange={handlePronosticoChange} style={styles.resultInput} /><span style={styles.separator}>-</span><input type="tel" inputMode="numeric" pattern="[0-9]*" name="golesVisitante" value={pronostico.golesVisitante} onChange={handlePronosticoChange} style={styles.resultInput} /></div><TeamDisplay teamLogos={teamLogos} teamName={currentJornada.equipoVisitante} shortName={true} imgStyle={styles.miJornadaTeamLogo} /></div>{(pronostico.golesLocal !== '' && pronostico.golesVisitante !== '') && <small key={stats.count} className="stats-indicator" style={{ ...styles.statsIndicator, color: stats.color }}>{stats.count > 0 ? `Otros ${stats.count} jugador(es) han pronosticado este resultado.` : '¡Eres el único con este resultado por ahora!'}</small>}</div>
                                <div style={styles.formGroup}><label style={styles.label}>RESULTADO 1X2 <span style={styles.pointsReminder}>( {isVip ? '2' : '1'} Puntos )</span></label><select name="resultado1x2" value={pronostico.resultado1x2} onChange={handlePronosticoChange} style={styles.input}><option value="">-- Elige --</option><option value="Gana UD Las Palmas">Gana UDLP</option><option value="Empate">Empate</option><option value="Pierde UD Las Palmas">Pierde UDLP</option></select></div>
                                <div style={styles.formGroup}><label style={styles.label}>PRIMER GOLEADOR <span style={styles.pointsReminder}>( {isVip ? '4' : '2'} Puntos )</span></label><select name="goleador" value={pronostico.goleador} onChange={handlePronosticoChange} style={styles.input} disabled={pronostico.sinGoleador}><option value="">-- Elige un jugador --</option>{plantilla.sort((a, b) => a.nombre.localeCompare(b.nombre)).map(jugador => (<option key={jugador.nombre} value={jugador.nombre}>{jugador.dorsal ? `${jugador.dorsal} - ${jugador.nombre}` : jugador.nombre}</option>))}</select><div style={{ marginTop: '10px' }}><input type="checkbox" name="sinGoleador" id="sinGoleador" checked={pronostico.sinGoleador} onChange={handlePronosticoChange} style={styles.checkbox} /><label htmlFor="sinGoleador" style={{ marginLeft: '8px', color: styles.colors.lightText }}>Sin Goleador (SG) <span style={styles.pointsReminder}>(1 Punto)</span></label></div></div>

                                <div style={styles.formGroup}><label style={styles.label}>PIN DE SEGURIDAD (4 dígitos, opcional)</label><input type="password" name="pin" value={pronostico.pin} onChange={handlePronosticoChange} maxLength="4" style={styles.input} placeholder="Crea un PIN para proteger tu apuesta" /><input type="password" name="pinConfirm" value={pronostico.pinConfirm} onChange={handlePronosticoChange} maxLength="4" style={{ ...styles.input, marginTop: '10px' }} placeholder="Confirma tu PIN" /><small style={styles.pinReminder}>¡Ojo! Si no usas PIN, tu apuesta no será secreta y cualquiera podrá verla o modificarla si accede con tu perfil.</small></div>

                                <div style={styles.jokerContainer}>{!pronostico.jokerActivo ? (<><button type="button" onClick={handleActivarJoker} style={styles.jokerButton} disabled={jokersRestantes <= 0}>🃏 Activar JOKER</button><span style={{ marginLeft: '15px', color: styles.colors.lightText }}>Te quedan: <span style={{ color: styles.colors.yellow, fontWeight: 'bold' }}>{jokersRestantes}</span></span></>) : (<div><h3 style={styles.formSectionTitle}>Apuestas JOKER</h3><p>Añade hasta 10 resultados exactos adicionales.</p><div style={styles.jokerGrid}>{pronostico.jokerPronosticos.map((p, index) => (<div key={index} style={styles.jokerBetRow}><div style={styles.resultInputContainer}><input type="tel" inputMode="numeric" pattern="[0-9]*" value={p.golesLocal} onChange={(e) => handleJokerPronosticoChange(index, 'golesLocal', e.target.value)} style={{ ...styles.resultInput, fontSize: '1.2rem' }} /><span style={styles.separator}>-</span><input type="tel" inputMode="numeric" pattern="[0-9]*" value={p.golesVisitante} onChange={(e) => handleJokerPronosticoChange(index, 'golesVisitante', e.target.value)} style={{ ...styles.resultInput, fontSize: '1.2rem' }} /></div>{jokerStats[index] && (<small style={{ ...styles.statsIndicator, color: jokerStats[index].color, fontSize: '0.8rem', textAlign: 'center', display: 'block', marginTop: '5px' }}>{jokerStats[index].text}</small>)}</div>))}</div><button type="button" onClick={handleBotonDelPanico} style={{ ...styles.jokerButton, ...styles.dangerButton, marginTop: '20px' }} disabled={panicButtonDisabled}>BOTÓN DEL PÁNICO</button>{panicButtonDisabled && <small style={{ display: 'block', color: styles.colors.danger, marginTop: '5px' }}>El botón del pánico se ha desactivado (menos de 1h para el cierre).</small>}</div>)}</div>
                                <button type="submit" disabled={isSaving} style={styles.mainButton}>{isSaving ? 'GUARDANDO...' : 'GUARDAR Y BLOQUEAR'}</button>
                            </fieldset>
                        )}
                        {message.text && <p style={{ ...styles.message, backgroundColor: message.type === 'success' ? styles.colors.success : styles.colors.danger }}>{message.text}</p>}
                    </form>
                );
            case 'Cerrada': return (<div style={styles.placeholder}><h3>Jornada {currentJornada.numeroJornada} Cerrada</h3><p>Las apuestas para este partido han finalizado.</p><p>Tu pronóstico está guardado y secreto.</p><button onClick={() => setActiveTab('laJornada')} style={{ ...styles.mainButton, backgroundColor: styles.colors.blue }}>Ver Resumen y Datos en Vivo</button></div>);
            case 'Finalizada': return (<div style={styles.placeholder}><h3>Jornada {currentJornada.numeroJornada} Finalizada</h3><p>Esta jornada ha concluido.</p>{currentJornada.ganadores && currentJornada.ganadores.length === 0 && <div style={styles.boteBanner}>¡BOTE! Nadie acertó el resultado.</div>}<button onClick={handleMarcarComoPagado} disabled={pronostico.pagado} style={styles.mainButton}>{pronostico.pagado ? 'PAGO REGISTRADO ✓' : 'MARCAR COMO PAGADO'}</button><button onClick={() => setActiveTab('laJornada')} style={{ ...styles.mainButton, marginLeft: '10px', backgroundColor: styles.colors.blue }}>Ver Resumen de Apuestas</button>{message.text && <p style={styles.message}>{message.text}</p>}</div>);
            case 'Próximamente': return (<div style={styles.placeholder}><h3>No hay jornada de apuestas abierta</h3><h4>Próximo Partido: Jornada {currentJornada.numeroJornada}</h4><p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{currentJornada.equipoLocal} vs {currentJornada.equipoVisitante}</p>{currentJornada.bote > 0 && <div style={styles.jackpotBanner}>💰 JACKPOT: ¡{currentJornada.bote}€ DE BOTE! 💰</div>}{currentJornada.fechaStr && <p>🗓️ {currentJornada.fechaStr}</p>}{currentJornada.estadio && <p>📍 {currentJornada.estadio}</p>}</div>);
            default: return <div style={styles.placeholder}><h3>Cargando...</h3></div>;
        }
    };
    return (<div>{showJokerAnimation && <JokerAnimation />}<h2 style={styles.title}>MI JORNADA</h2><p style={{ color: styles.colors.lightText, textAlign: 'center', fontSize: '1.1rem' }}>Bienvenido, <PlayerProfileDisplay name={user} profile={userProfile} defaultColor={styles.colors.yellow} style={{ fontWeight: 'bold' }} /></p>{liveData && liveData.isLive && currentJornada?.estado === 'Cerrada' && (<div style={styles.liveInfoBox}><div style={styles.liveInfoItem}><span style={styles.liveInfoLabel}>Puntos Provisionales</span><span style={styles.liveInfoValue}><AnimatedPoints value={provisionalData.puntos} /></span></div><div style={styles.liveInfoItem}><span style={styles.liveInfoLabel}>Posición Provisional</span><span style={styles.liveInfoValue}>{provisionalData.posicion}</span></div></div>)}{renderContent()}</div>);
};

export default MiJornadaScreen;
