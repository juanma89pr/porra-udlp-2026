import React, { useState, useEffect } from 'react';
import { db, doc, setDoc } from '../firebaseConfig';
import styles, { colors } from '../styles';
import { EQUIPOS_LIGA } from '../constants';

const AdminEscudosManager = ({ onBack, teamLogos }) => {
    const [urls, setUrls] = useState(teamLogos || {});
    const [saving, setSaving] = useState({});
    useEffect(() => { setUrls(teamLogos || {}); }, [teamLogos]);
    const handleUrlChange = (teamName, value) => { setUrls(prev => ({ ...prev, [teamName]: value })); };
    const handleSave = async (teamName) => {
        setSaving(prev => ({ ...prev, [teamName]: true }));
        const docRef = doc(db, "configuracion", "escudos");
        try { await setDoc(docRef, { [teamName]: urls[teamName] }, { merge: true }); }
        catch (error) { console.error("Error al guardar el escudo:", error); alert("Error al guardar el escudo."); }
        finally { setSaving(prev => ({ ...prev, [teamName]: false })); }
    };

    return (
        <div style={styles.adminJornadaItem}>
            <button onClick={onBack} style={styles.backButton}>&larr; Volver al Panel</button>
            <h3 style={styles.formSectionTitle}>Gestión de Escudos de Equipos</h3>
            <p style={{ textAlign: 'center', marginBottom: '20px' }}>Pega la URL de la imagen del escudo para cada equipo y pulsa "Guardar".</p>
            <div style={styles.escudosGrid}>
                {EQUIPOS_LIGA.map(teamName => (
                    <div key={teamName} style={styles.escudoCard}>
                        <img src={urls[teamName] || 'https://placehold.co/80x80/1b263b/e0e1dd?text=?'} style={styles.escudoCardImg} alt={teamName} onError={(e) => { e.target.src = 'https://placehold.co/80x80/e63946/ffffff?text=Error'; }} />
                        <p style={styles.escudoCardName}>{teamName}</p>
                        <input type="text" value={urls[teamName] || ''} onChange={(e) => handleUrlChange(teamName, e.target.value)} placeholder="Pega la URL del escudo aquí" style={styles.escudoInput} />
                        <button onClick={() => handleSave(teamName)} disabled={saving[teamName]} style={styles.escudoSaveButton}>{saving[teamName] ? '...' : 'Guardar'}</button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AdminEscudosManager;
