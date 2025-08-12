import React, { useState, useEffect } from 'react';
import { db, doc, updateDoc, writeBatch, collection, getDocs, setDoc, increment } from '../firebaseConfig';
import styles, { colors } from '../styles';
import { calculateProvisionalPoints } from '../logic';
import { JUGADORES, APUESTA_NORMAL, APUESTA_VIP } from '../constants';

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

    useEffect(() => { if (jornada.liveData) { setLiveData(jornada.liveData); } }, [jornada.liveData]);

    const handleSaveChanges = async () => {
        setIsSaving(true); setMessage('');
        const jornadaRef = doc(db, "jornadas", jornada.id);
        try {
            await updateDoc(jornadaRef, { estado, resultadoLocal, resultadoVisitante, goleador: goleador.trim(), resultado1x2, esVip, splashMessage, fechaApertura: fechaApertura ? new Date(fechaApertura) : null, fechaCierre: fechaCierre ? new Date(fechaCierre) : null, estadioImageUrl });
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
            if (p.sinGoleador && (goleadorReal === "sg" || goleadorReal === "")) { puntosJornada += 1; }
            else if (!p.sinGoleador && goleadorApostado === goleadorReal && goleadorReal !== "") { puntosJornada += esVip ? 4 : 2; }
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
        <div style={jornada.id === 'jornada_test' ? { ...styles.adminJornadaItem, ...styles.testJornadaAdminItem } : (jornada.esVip ? { ...styles.adminJornadaItem, ...styles.jornadaVip } : styles.adminJornadaItem)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}><p><strong>{jornada.id === 'jornada_test' ? 'Jornada de Prueba' : `Jornada ${jornada.numeroJornada || 'Copa'}`}:</strong> {jornada.equipoLocal} vs {jornada.equipoVisitante}</p><div style={styles.vipToggleContainer}><label htmlFor={`vip-toggle-${jornada.id}`}>⭐ VIP</label><input id={`vip-toggle-${jornada.id}`} type="checkbox" checked={esVip} onChange={(e) => setEsVip(e.target.checked)} style={styles.checkbox} /></div></div>
            <div style={styles.adminControls}>
                <div><label style={styles.label}>Estado:</label><select value={estado} onChange={(e) => setEstado(e.target.value)} style={styles.adminSelect}><option value="Próximamente">Próximamente</option><option value="Abierta">Abierta</option><option value="Cerrada">Cerrada</option><option value="Finalizada">Finalizada</option></select></div>
                <div><label style={styles.label}>Resultado Final:</label><div style={styles.resultInputContainer}><input type="number" min="0" value={resultadoLocal} onChange={(e) => setResultadoLocal(e.target.value)} style={styles.resultInput} /><span style={styles.separator}>-</span><input type="number" min="0" value={resultadoVisitante} onChange={(e) => setResultadoVisitante(e.target.value)} style={styles.resultInput} /></div></div>
                <div><label style={styles.label}>Primer Goleador:</label><input type="text" value={goleador} onChange={(e) => setGoleador(e.target.value)} style={styles.adminInput} /></div>
                <div><label style={styles.label}>Resultado 1X2:</label><select value={resultado1x2} onChange={(e) => setResultado1x2(e.target.value)} style={styles.adminSelect}><option value="">-- Elige --</option><option value="Gana UD Las Palmas">Gana UDLP</option><option value="Empate">Empate</option><option value="Pierde UD Las Palmas">Pierde UDLP</option></select></div>
                <div><label style={styles.label}>Apertura Apuestas:</label><input type="datetime-local" value={fechaApertura} onChange={(e) => setFechaApertura(e.target.value)} style={styles.adminInput} /></div>
                <div><label style={styles.label}>Cierre Apuestas:</label><input type="datetime-local" value={fechaCierre} onChange={(e) => setFechaCierre(e.target.value)} style={styles.adminInput} /></div>
            </div>
            <div style={{ marginTop: '10px' }}><label style={styles.label}>Mensaje para la Pantalla Principal:</label><textarea value={splashMessage} onChange={(e) => setSplashMessage(e.target.value)} style={{ ...styles.input, width: '95%', height: '50px' }} /></div>
            <div style={{ marginTop: '10px' }}><label style={styles.label}>URL Imagen del Estadio:</label><input type="text" value={estadioImageUrl} onChange={(e) => setEstadioImageUrl(e.target.value)} style={{ ...styles.input, width: '95%' }} /></div>
            <div style={{ marginTop: '20px' }}><button onClick={handleSaveChanges} disabled={isSaving} style={styles.saveButton}>{isSaving ? 'Guardando...' : 'Guardar Cambios'}</button><button onClick={handleCalcularPuntos} disabled={isCalculating || jornada.estado === 'Finalizada'} style={styles.saveButton}>{isCalculating ? 'Calculando...' : 'Calcular Puntos y Cerrar'}</button>{message && <span style={{ marginLeft: '10px', color: styles.colors.success }}>{message}</span>}</div>

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
                            <input type="text" value={liveData.ultimoGoleador} onChange={(e) => setLiveData(d => ({ ...d, ultimoGoleador: e.target.value }))} style={styles.adminInput} placeholder="Nombre o 'SG'" />
                        </div>
                    </div>
                    <button onClick={handleUpdateLiveScore} disabled={isSaving} style={{ ...styles.saveButton, backgroundColor: colors.danger, marginTop: '15px' }}>
                        {isSaving ? 'Actualizando...' : 'Actualizar Marcador en Vivo'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default JornadaAdminItem;
