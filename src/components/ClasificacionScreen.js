import React, { useState, useEffect, useMemo } from 'react';
import { db, collection, doc, onSnapshot, query, where, limit, updateDoc, orderBy, setDoc, getDocs } from '../firebaseConfig';
import styles, { colors } from '../styles';
import { JUGADORES } from '../constants';
import { calculateProvisionalPoints } from '../logic';
import { LoadingSkeleton, PlayerProfileDisplay, AnimatedPoints } from '../reusableComponents';

const ClasificacionScreen = ({ currentUser, liveData, liveJornada, userProfiles }) => {
    const [clasificacion, setClasificacion] = useState([]); const [loading, setLoading] = useState(true); const [rachas, setRachas] = useState({}); const [livePronosticos, setLivePronosticos] = useState([]);
    useEffect(() => {
        const fetchRachas = async () => {
            const q = query(collection(db, "jornadas"), where("estado", "==", "Finalizada"), orderBy("numeroJornada", "desc"), limit(2));
            const jornadasSnap = await getDocs(q);
            if (jornadasSnap.docs.length < 2) return;
            const [jornada1, jornada2] = jornadasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            const [pronosticos1Snap, pronosticos2Snap] = await Promise.all([getDocs(collection(db, "pronosticos", jornada1.id, "jugadores")), getDocs(collection(db, "pronosticos", jornada2.id, "jugadores"))]);
            const pronosticos1 = Object.fromEntries(pronosticos1Snap.docs.map(d => [d.id, d.data()]));
            const pronosticos2 = Object.fromEntries(pronosticos2Snap.docs.map(d => [d.id, d.data()]));
            const newRachas = {};
            JUGADORES.forEach(jugador => {
                const p1 = pronosticos1[jugador];
                const p2 = pronosticos2[jugador];
                const aciertoExacto1 = p1 && parseInt(p1.golesLocal) === jornada1.resultadoLocal && parseInt(p1.golesVisitante) === jornada1.resultadoVisitante;
                const aciertoExacto2 = p2 && parseInt(p2.golesLocal) === jornada2.resultadoLocal && parseInt(p2.golesVisitante) === jornada2.resultadoVisitante;
                if (aciertoExacto1 && aciertoExacto2) { newRachas[jugador] = '🔥'; }
                else if ((p1?.puntosObtenidos === 0 || !p1) && (p2?.puntosObtenidos === 0 || !p2)) { newRachas[jugador] = '🥶'; }
            });
            setRachas(newRachas);
        };
        fetchRachas();
        const qClasificacion = query(collection(db, "clasificacion"));
        const unsubscribe = onSnapshot(qClasificacion, (querySnapshot) => {
            const clasificacionData = {};
            querySnapshot.forEach((doc) => { clasificacionData[doc.id] = { id: doc.id, ...doc.data() }; });
            const processedData = JUGADORES.map(jugadorId => { return clasificacionData[jugadorId] || { id: jugadorId, jugador: jugadorId, puntosTotales: 0, jokersRestantes: 2 }; });
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
            const unsubscribe = onSnapshot(pronosticosRef, (snapshot) => { setLivePronosticos(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))); });
            return () => unsubscribe();
        } else {
            setLivePronosticos([]);
        }
    }, [liveJornada]);
    const liveClasificacion = useMemo(() => {
        const isLive = liveData && liveData.isLive && liveJornada;
        const liveScores = new Map();
        if (isLive) {
            livePronosticos.forEach(p => { const puntosProvisionales = calculateProvisionalPoints(p, liveData, liveJornada); liveScores.set(p.id, puntosProvisionales); });
        }
        const sorted = [...clasificacion].map(jugador => ({ ...jugador, puntosEnVivo: (jugador.puntosTotales || 0) + (liveScores.get(jugador.id) || 0) })).sort((a, b) => {
            const pointsA = isLive ? a.puntosEnVivo : (a.puntosTotales || 0);
            const pointsB = isLive ? b.puntosEnVivo : (b.puntosTotales || 0);
            return pointsB - pointsA;
        });
        return sorted;
    }, [clasificacion, liveData, liveJornada, livePronosticos]);
    if (loading) return <LoadingSkeleton type="table" />;
    const isLive = liveData && liveData.isLive;
    const getRankStyle = (index, jugadorId) => {
        let style = {};
        if (index === 0) style = styles.top1Row;
        else if (index === 1) style = styles.top2Row;
        else if (index === 2) style = styles.top3Row;
        else style = styles.tr;
        if (jugadorId === currentUser) style = { ...style, ...styles.currentUserRow };
        return style;
    };
    const getRankIcon = (index) => { if (index === 0) return '🥇'; if (index === 1) return '🥈'; if (index === 2) return '🥉'; return `${index + 1}º`; };
    return (<div><h2 style={styles.title}>CLASIFICACIÓN</h2><div style={{ overflowX: 'auto' }}><table style={styles.table}><thead><tr><th style={styles.th}>POS</th><th style={styles.th}>JUGADOR</th>{isLive && <th style={styles.th}>PUNTOS (EN VIVO)</th>}<th style={styles.th}>PUNTOS TOTALES</th><th style={{ ...styles.th, textAlign: 'center' }}>JOKERS</th></tr></thead><tbody>{liveClasificacion.map((jugador, index) => {
        const profile = userProfiles[jugador.id] || {};
        return (<tr key={jugador.id} style={getRankStyle(index, jugador.id)}><td style={styles.tdRank}>{getRankIcon(index)}</td><td style={styles.td}><PlayerProfileDisplay name={jugador.jugador || jugador.id} profile={profile} />{rachas[jugador.id]}</td>{isLive && <td style={{ ...styles.td, color: styles.colors.gold, fontWeight: 'bold' }}><AnimatedPoints value={jugador.puntosEnVivo} /></td>}<td style={styles.td}><AnimatedPoints value={jugador.puntosTotales} /></td><td style={{ ...styles.td, ...styles.tdIcon, textAlign: 'center' }}>{jugador.jokersRestantes !== undefined ? jugador.jokersRestantes : 2} 🃏</td></tr>)
    })}</tbody></table></div></div>);
};

export default ClasificacionScreen;
