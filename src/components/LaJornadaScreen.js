import React, { useState, useEffect, useMemo } from 'react';
import { db, collection, doc, onSnapshot, query, where, getDoc } from '../firebaseConfig';
import styles, { colors } from '../styles';
import { JUGADORES, APUESTA_NORMAL, APUESTA_VIP, SECRET_MESSAGES } from '../constants';
import { LoadingSkeleton, PlayerProfileDisplay, TeamDisplay, AnimatedPoints } from '../reusableComponents';
import { calculateProvisionalPoints } from '../logic';

const LaJornadaScreen = ({ teamLogos, liveData, userProfiles, onlineUsers, jornadaActual }) => {
    const [participantes, setParticipantes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [countdown, setCountdown] = useState('');
    const [porraAnualConfig, setPorraAnualConfig] = useState(null);
    const [pronosticosAnuales, setPronosticosAnuales] = useState([]);
    const [provisionalRanking, setProvisionalRanking] = useState([]);
    const [jornadaStats, setJornadaStats] = useState(null);

    useEffect(() => {
        if (jornadaActual) {
            setLoading(false);
            const pronosticosRef = collection(db, "pronosticos", jornadaActual.id, "jugadores");
            const unsubPronosticos = onSnapshot(pronosticosRef, (pronosticosSnap) => {
                const pronosticosData = pronosticosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setParticipantes(pronosticosData);
                if (pronosticosData.length > 0) {
                    const resultados = pronosticosData.map(p => `${p.golesLocal}-${p.golesVisitante}`);
                    const counts = resultados.reduce((acc, val) => ({ ...acc, [val]: (acc[val] || 0) + 1 }), {});
                    const resultadoMasComun = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];

                    const total = pronosticosData.length;
                    const ganaLocalCount = pronosticosData.filter(p => p.resultado1x2 === 'Gana UD Las Palmas').length;
                    const empateCount = pronosticosData.filter(p => p.resultado1x2 === 'Empate').length;
                    const pierdeLocalCount = pronosticosData.filter(p => p.resultado1x2 === 'Pierde UD Las Palmas').length;

                    setJornadaStats({
                        resultadoMasComun: `${resultadoMasComun[0]} (${resultadoMasComun[1]} veces)`,
                        porcentajeGana: ((ganaLocalCount / total) * 100).toFixed(0),
                        porcentajeEmpate: ((empateCount / total) * 100).toFixed(0),
                        porcentajePierde: ((pierdeLocalCount / total) * 100).toFixed(0),
                    });
                } else {
                    setJornadaStats(null);
                }
            });
            return () => unsubPronosticos();
        } else {
            setLoading(true);
        }
    }, [jornadaActual]);

    useEffect(() => {
        const configRef = doc(db, "configuracion", "porraAnual"); const unsubConfig = onSnapshot(configRef, (doc) => { setPorraAnualConfig(doc.exists() ? doc.data() : null); });
        const pronosticosAnualesRef = collection(db, "porraAnualPronosticos"); const unsubPronosticos = onSnapshot(pronosticosAnualesRef, (snapshot) => { setPronosticosAnuales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); });
        return () => { unsubConfig(); unsubPronosticos(); };
    }, []);

    useEffect(() => {
        if (jornadaActual && jornadaActual.estado === 'Cerrada' && liveData && liveData.isLive && participantes.length > 0) {
            const ranking = participantes.map(p => ({ id: p.id, puntos: calculateProvisionalPoints(p, liveData, jornadaActual) })).sort((a, b) => b.puntos - a.puntos); setProvisionalRanking(ranking);
        } else { setProvisionalRanking([]); }
    }, [liveData, jornadaActual, participantes]);

    useEffect(() => {
        if (jornadaActual && jornadaActual.estado === 'Abierta' && jornadaActual.fechaCierre) {
            const interval = setInterval(() => {
                const now = new Date(); const deadline = jornadaActual.fechaCierre.toDate(); const diff = deadline - now;
                if (diff <= 0) { setCountdown("¡APUESTAS CERRADAS!"); clearInterval(interval); return; }
                const d = Math.floor(diff / (1000 * 60 * 60 * 24)); const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)); const s = Math.floor((diff % (1000 * 60)) / 1000);
                setCountdown(`${d}d ${h}h ${m}m ${s}s`);
            }, 1000); return () => clearInterval(interval);
        } else { setCountdown(''); }
    }, [jornadaActual]);

    if (loading) return <LoadingSkeleton />;
    const isLiveView = jornadaActual?.estado === 'Cerrada' && liveData && liveData.isLive;

    return (<div><h2 style={styles.title}>LA JORNADA</h2>{jornadaActual ? (<div style={{ ...styles.laJornadaContainer, backgroundImage: `linear-gradient(rgba(10, 25, 47, 0.85), rgba(10, 25, 47, 0.85)), url(${jornadaActual.estadioImageUrl})` }}><h3>{jornadaActual.id === 'jornada_test' ? 'Jornada de Prueba' : `Jornada ${jornadaActual.numeroJornada}`}</h3><div style={styles.matchInfo}><TeamDisplay teamLogos={teamLogos} teamName={jornadaActual.equipoLocal} shortName={true} imgStyle={styles.matchInfoLogo} />{isLiveView ? (<span style={styles.liveScoreInPage}>{liveData.golesLocal} - {liveData.golesVisitante}</span>) : (<span style={styles.vs}>VS</span>)}<TeamDisplay teamLogos={teamLogos} teamName={jornadaActual.equipoVisitante} imgStyle={styles.matchInfoLogo} /></div><div style={styles.matchDetails}><span>📍 {jornadaActual.estadio || 'Estadio por confirmar'}</span><span>🗓️ {jornadaActual.fechaStr || 'Fecha por confirmar'}</span></div>

        {jornadaStats && !isLiveView && (
            <div style={styles.statsGrid}>
                <div style={styles.statCard}><div style={styles.statValue}>📊 {jornadaStats.resultadoMasComun}</div><div style={styles.statLabel}>Resultado más apostado</div></div>
                <div style={styles.statCard}><div style={styles.statValue}>{jornadaStats.porcentajeGana}%</div><div style={styles.statLabel}>Cree en la victoria</div></div>
                <div style={styles.statCard}><div style={styles.statValue}>{jornadaStats.porcentajeEmpate}%</div><div style={styles.statLabel}>Apuesta por el empate</div></div>
                <div style={styles.statCard}><div style={styles.statValue}>{jornadaStats.porcentajePierde}%</div><div style={styles.statLabel}>Piensa que se pierde</div></div>
            </div>
        )}

        {jornadaActual.estado === 'Abierta' && (<><div style={styles.countdownContainer}><p>CIERRE DE APUESTAS EN:</p><div style={styles.countdown}>{countdown}</div></div><h3 style={styles.callToAction}>¡Hagan sus porras!</h3><div style={styles.apostadoresContainer}><h4>APUESTAS REALIZADAS ({participantes.length}/{JUGADORES.length})</h4><div style={styles.apostadoresGrid}>{JUGADORES.map(jugador => { const participante = participantes.find(p => p.id === jugador); const haApostado = !!participante; const usoJoker = haApostado && participante.jokerActivo; const profile = userProfiles[jugador] || {}; const isOnline = onlineUsers[jugador]; return (<span key={jugador} style={haApostado ? styles.apostadorHecho : styles.apostadorPendiente}>{isOnline && <div style={styles.onlineIndicatorDot} />}<PlayerProfileDisplay name={jugador} profile={profile} /> {usoJoker ? '🃏' : (haApostado ? '✓' : '')}</span>); })}</div></div></>)}
        {jornadaActual.estado === 'Cerrada' && !isLiveView && (<div><p style={{ textAlign: 'center', marginTop: '20px' }}>Las apuestas están cerradas. ¡Estos son los pronósticos!</p><div style={styles.resumenContainer}>{participantes.sort((a, b) => a.id.localeCompare(b.id)).map(p => { const profile = userProfiles[p.id] || {}; return (<div key={p.id} style={styles.resumenJugador}><h4 style={styles.resumenJugadorTitle}><PlayerProfileDisplay name={p.id} profile={profile} defaultColor={styles.colors.yellow} /> {p.jokerActivo && '🃏'}</h4><div style={styles.resumenJugadorBets}><p><strong>Principal:</strong> {p.golesLocal}-{p.golesVisitante} &nbsp;|&nbsp; <strong>1X2:</strong> {p.resultado1x2} &nbsp;|&nbsp; <strong>Goleador:</strong> {p.sinGoleador ? 'Sin Goleador' : (p.goleador || 'N/A')}</p>{p.jokerActivo && p.jokerPronosticos?.length > 0 && (<div style={{ marginTop: '10px' }}><strong>Apuestas Joker:</strong><div style={styles.jokerChipsContainer}>{p.jokerPronosticos.map((jp, index) => (<span key={index} style={styles.jokerDetailChip}>{jp.golesLocal}-{jp.golesVisitante}</span>))}</div></div>)}</div></div>) })}</div></div>)}
        {isLiveView && (<div><h3 style={styles.provisionalTitle}>Clasificación Provisional</h3><table style={{ ...styles.table, backgroundColor: 'rgba(0,0,0,0.3)' }}><thead><tr><th style={styles.th}>POS</th><th style={styles.th}>Jugador</th><th style={styles.th}>PUNTOS (EN VIVO)</th></tr></thead><tbody>{provisionalRanking.map((jugador, index) => { const profile = userProfiles[jugador.id] || {}; return (<tr key={jugador.id} style={jugador.puntos > 0 && provisionalRanking[0].puntos === jugador.puntos ? styles.provisionalWinnerRow : styles.tr}><td style={styles.tdRank}>{index + 1}º</td><td style={styles.td}><PlayerProfileDisplay name={jugador.id} profile={profile} /></td><td style={styles.td}><AnimatedPoints value={jugador.puntos} /></td></tr>) })}</tbody></table></div>)}</div>) : (<div style={styles.placeholder}><h3>No hay ninguna jornada activa o cerrada en este momento.</h3></div>)}<div style={styles.porraAnualContainer}><h3 style={styles.formSectionTitle}>⭐ PORRA ANUAL ⭐</h3>{porraAnualConfig?.estado === 'Abierta' && <p style={{ textAlign: 'center' }}>Las apuestas de los demás serán secretas hasta la Jornada 5. ¡Haz la tuya desde el banner superior!</p>}{(porraAnualConfig?.estado === 'Cerrada' || porraAnualConfig?.estado === 'Finalizada') && (<div><p style={{ textAlign: 'center' }}>Apuestas cerradas. Estos son los pronósticos para final de temporada:</p><div style={styles.resumenContainer}>{pronosticosAnuales.sort((a, b) => a.id.localeCompare(b.id)).map(p => { const profile = userProfiles[p.id] || {}; return (<div key={p.id} style={styles.resumenJugador}><h4 style={styles.resumenJugadorTitle}><PlayerProfileDisplay name={p.id} profile={profile} defaultColor={styles.colors.yellow} /></h4><div style={styles.resumenJugadorBets}><p><strong>¿Asciende?:</strong> <span style={{ color: p.ascenso === 'SI' ? styles.colors.success : styles.colors.danger, fontWeight: 'bold' }}>{p.ascenso}</span></p><p><strong>Posición Final:</strong> <span style={{ color: styles.colors.yellow, fontWeight: 'bold' }}>{p.posicion}º</span></p>{porraAnualConfig.estado === 'Finalizada' && <p><strong>Puntos Obtenidos:</strong> <span style={{ fontWeight: 'bold', color: styles.colors.gold }}>{p.puntosObtenidos || 0}</span></p>}</div></div>) })}</div></div>)}{porraAnualConfig?.estado !== 'Abierta' && porraAnualConfig?.estado !== 'Cerrada' && porraAnualConfig?.estado !== 'Finalizada' && <p style={{ textAlign: 'center' }}>El administrador no ha abierto la porra anual todavía.</p>}</div></div>);
};

export default LaJornadaScreen;
