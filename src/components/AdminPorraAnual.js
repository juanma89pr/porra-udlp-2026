import React, { useState, useEffect, useMemo } from 'react';
import { db, doc, getDoc, setDoc, updateDoc, writeBatch, collection, getDocs, increment } from '../firebaseConfig';
import styles, { colors } from '../styles';
import { APUESTA_NORMAL, APUESTA_VIP } from '../constants';
import { LoadingSkeleton } from '../reusableComponents';

const AdminPorraAnual = ({ onBack }) => {
    const [config, setConfig] = useState({ estado: '', ascensoFinal: '', posicionFinal: '' });
    const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [calculating, setCalculating] = useState(false); const [message, setMessage] = useState('');
    const configRef = useMemo(() => doc(db, "configuracion", "porraAnual"), []);

    useEffect(() => { setLoading(true); getDoc(configRef).then((docSnap) => { if (docSnap.exists()) { setConfig(docSnap.data()); } setLoading(false); }).catch(error => { console.error("Error al cargar config anual: ", error); setLoading(false); }); }, [configRef]);

    const handleSaveConfig = async () => {
        setSaving(true);
        try { await setDoc(configRef, config, { merge: true }); setMessage('¡Configuración guardada!'); }
        catch (error) { console.error("Error guardando config anual", error); setMessage('Error al guardar.'); }
        finally { setSaving(false); setTimeout(() => setMessage(''), 3000); }
    };

    const handleCalcularPuntosAnual = async () => {
        if (!config.ascensoFinal || !config.posicionFinal) { alert("Debes establecer el resultado de Ascenso y la Posición Final antes de calcular."); return; }
        if (!window.confirm("¿Seguro que quieres calcular y repartir los puntos de la Porra Anual? Esta acción es irreversible.")) { return; }
        setCalculating(true);
        const pronosticosRef = collection(db, "porraAnualPronosticos");
        const pronosticosSnap = await getDocs(pronosticosRef);
        const pronosticos = pronosticosSnap.docs.map(p => ({ id: p.id, ...p.data() }));
        const batch = writeBatch(db);
        for (const p of pronosticos) {
            let puntosObtenidos = 0;
            const aciertoAscenso = p.ascenso === config.ascensoFinal;
            const aciertoPosicion = parseInt(p.posicion) === parseInt(config.posicionFinal);
            if (aciertoAscenso && aciertoPosicion) { puntosObtenidos = 20; } else if (aciertoAscenso) { puntosObtenidos = 5; } else if (aciertoPosicion) { puntosObtenidos = 10; }
            if (puntosObtenidos > 0) { const clasificacionRef = doc(db, "clasificacion", p.id); batch.update(clasificacionRef, { puntosTotales: increment(puntosObtenidos) }); }
            const pronosticoAnualRef = doc(db, "porraAnualPronosticos", p.id);
            batch.update(pronosticoAnualRef, { puntosObtenidos });
        }
        batch.update(configRef, { estado: "Finalizada" });
        try { await batch.commit(); setMessage("¡Puntos de la Porra Anual calculados y repartidos con éxito!"); }
        catch (error) { console.error("Error al calcular puntos anuales:", error); setMessage("Error al calcular los puntos."); }
        finally { setCalculating(false); }
    };

    if (loading) return <LoadingSkeleton />;

    return (
        <div style={styles.adminJornadaItem}>
            <button onClick={onBack} style={styles.backButton}>&larr; Volver al Panel</button>
            <h3 style={styles.formSectionTitle}>Gestión Porra Anual</h3>
            <div style={styles.adminControls}>
                <div><label style={styles.label}>Estado de la Porra</label><select value={config.estado || ''} onChange={(e) => setConfig(c => ({ ...c, estado: e.target.value }))} style={styles.adminSelect}><option value="Inactiva">Inactiva</option><option value="Abierta">Abierta</option><option value="Cerrada">Cerrada</option><option value="Finalizada">Finalizada</option></select></div>
                <div><label style={styles.label}>Resultado Ascenso</label><select value={config.ascensoFinal || ''} onChange={(e) => setConfig(c => ({ ...c, ascensoFinal: e.target.value }))} style={styles.adminSelect}><option value="">-- Pendiente --</option><option value="SI">SI</option><option value="NO">NO</option></select></div>
                <div><label style={styles.label}>Posición Final</label><input type="number" min="1" max="22" value={config.posicionFinal || ''} onChange={(e) => setConfig(c => ({ ...c, posicionFinal: e.target.value }))} style={styles.adminInput} /></div>
            </div>
            <div style={{ marginTop: '20px' }}>
                <button onClick={handleSaveConfig} disabled={saving} style={styles.saveButton}>{saving ? 'Guardando...' : 'Guardar Configuración'}</button>
                <button onClick={handleCalcularPuntosAnual} disabled={calculating || config.estado !== 'Cerrada'} style={{ ...styles.saveButton, backgroundColor: styles.colors.gold, color: styles.colors.deepBlue }}>{calculating ? 'Calculando...' : 'Calcular Puntos Finales'}</button>
            </div>
            {message && <p style={{ ...styles.message, marginTop: '15px' }}>{message}</p>}
        </div>
    );
};

export default AdminPorraAnual;
