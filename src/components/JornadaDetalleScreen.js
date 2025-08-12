import React, { useState, useEffect, useMemo } from 'react';
import { db, doc, onSnapshot, collection } from '../firebaseConfig';
import styles from '../styles';
import { JUGADORES } from '../constants';
import { LoadingSkeleton, PlayerProfileDisplay, TeamDisplay } from '../reusableComponents';

const JornadaDetalleScreen = ({ jornadaId, onBack, teamLogos, userProfiles }) => {
    const [jornada, setJornada] = useState(null); const [pronosticos, setPronosticos] = useState([]); const [loading, setLoading] = useState(true);
    useEffect(() => {
        setLoading(true);
        const jornadaRef = doc(db, "jornadas", jornadaId);
        const unsubJornada = onSnapshot(jornadaRef, (docSnap) => { if (docSnap.exists()) { setJornada({ id: docSnap.id, ...docSnap.data() }); } });
        const pronosticosRef = collection(db, "pronosticos", jornadaId, "jugadores");
        const unsubPronosticos = onSnapshot(pronosticosRef, (snapshot) => { setPronosticos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); setLoading(false); });
        return () => { unsubJornada(); unsubPronosticos(); };
    }, [jornadaId]);
    const pronosticosMap = useMemo(() => pronosticos.reduce((acc, p) => { acc[p.id] = p; return acc; }, {}), [pronosticos]);
    if (loading) return <LoadingSkeleton type="table" />;
    const showPronosticos = jornada?.estado === 'Cerrada' || jornada?.estado === 'Finalizada'; const isFinalizada = jornada?.estado === 'Finalizada';
    return (<div><button onClick={onBack} style={styles.backButton}>&larr; Volver al Calendario</button>{jornada && (<>
        <h2 style={styles.title}>DETALLE {jornada.id === 'jornada_test' ? 'JORNADA DE PRUEBA' : `JORNADA ${jornada.numeroJornada}`}</h2>
        <div style={styles.matchHeader}><TeamDisplay teamLogos={teamLogos} teamName={jornada.equipoLocal} imgStyle={{ width: 40, height: 40 }} /><h3 style={styles.formSectionTitle}>{jornada.equipoLocal} vs {jornada.equipoVisitante}</h3><TeamDisplay teamLogos={teamLogos} teamName={jornada.equipoVisitante} imgStyle={{ width: 40, height: 40 }} /></div>
        {isFinalizada && (<p style={styles.finalResult}>Resultado Final: {jornada.resultadoLocal} - {jornada.resultadoVisitante}</p>)}
        {showPronosticos && jornada.ganadores && jornada.ganadores.length > 0 && (<div style={styles.winnerBanner}>🏆 Ganador(es): {jornada.ganadores.join(', ')}</div>)}
        {showPronosticos && jornada.ganadores && jornada.ganadores.length === 0 && (<div style={styles.boteBanner}>💰 ¡BOTE! Nadie acertó el resultado.</div>)}
        <table style={styles.table}><thead><tr><th style={styles.th}>Jugador</th><th style={styles.th}>Pronóstico</th>{isFinalizada && <th style={styles.th}>Puntos</th>}{isFinalizada && <th style={styles.th}>Pagado</th>}</tr></thead><tbody>{JUGADORES.map((jugadorId, index) => { const p = pronosticosMap[jugadorId]; const profile = userProfiles[jugadorId] || {}; if (!p) { return (<tr key={jugadorId} style={styles.tr}><td style={styles.td}><PlayerProfileDisplay name={jugadorId} profile={profile} /></td><td colSpan={isFinalizada ? 3 : 1} style={{ ...styles.td, fontStyle: 'italic', opacity: 0.6, textAlign: 'center' }}>SP</td></tr>); } if (showPronosticos) { const esGanador = jornada.ganadores?.includes(p.id); return (<React.Fragment key={p.id}><tr style={esGanador ? styles.winnerRow : styles.tr}><td style={styles.td}><PlayerProfileDisplay name={p.id} profile={profile} /> {p.jokerActivo && '🃏'}</td><td style={styles.td}>{p.golesLocal}-{p.golesVisitante} ({p.resultado1x2 || 'N/A'}) {p.goleador && `- ${p.goleador}`} {!p.goleador && p.sinGoleador && '- SG'}</td>{isFinalizada && <td style={styles.td}>{p.puntosObtenidos === undefined ? '-' : p.puntosObtenidos}</td>}{isFinalizada && <td style={styles.td}>{p.pagado ? '✅' : '❌'}</td>}</tr>{p.jokerActivo && p.jokerPronosticos && p.jokerPronosticos.length > 0 && (<tr style={styles.jokerDetailRow}><td style={styles.td} colSpan={isFinalizada ? 4 : 2}><div style={{ paddingLeft: '20px' }}><strong>Apuestas JOKER:</strong><div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '5px' }}>{p.jokerPronosticos.map((jp, index) => (<span key={index} style={styles.jokerDetailChip}>{jp.golesLocal}-{jp.golesVisitante}</span>))}</div></div></td></tr>)}</React.Fragment>); } else { const secretMessage = SECRET_MESSAGES[index % SECRET_MESSAGES.length]; return (<tr key={p.id} style={styles.tr}><td style={styles.td}><PlayerProfileDisplay name={p.id} profile={profile} /> {p.jokerActivo && '🃏'}</td><td style={styles.td}>{secretMessage}</td></tr>); } })}</tbody></table>
        <div style={styles.legendContainer}><span style={styles.legendItem}>SP: Sin Pronóstico</span><span style={styles.legendItem}>🃏: Joker Activado</span>{isFinalizada && <span style={styles.legendItem}>✅: Pagado</span>}{isFinalizada && <span style={styles.legendItem}>❌: Pendiente</span>}</div>
    </>)}</div>);
};

export default JornadaDetalleScreen;
