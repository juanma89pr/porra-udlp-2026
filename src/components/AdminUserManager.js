import React, { useState } from 'react';
import { db, collection, doc, updateDoc, setDoc } from '../firebaseConfig';
import styles, { colors } from '../styles';
import { JUGADORES } from '../constants';

const AdminUserManager = ({ onBack }) => {
    const [selectedUser, setSelectedUser] = useState('');
    const [message, setMessage] = useState('');

    const handleResetJokers = async () => {
        if (!selectedUser) { alert("Por favor, selecciona un jugador."); return; }
        if (window.confirm(`¿Seguro que quieres reiniciar los Jokers de ${selectedUser} a 2?`)) {
            const userRef = doc(db, "clasificacion", selectedUser);
            try {
                await setDoc(userRef, { jokersRestantes: 2 }, { merge: true });
                setMessage(`Jokers de ${selectedUser} reiniciados con éxito.`);
            } catch (error) {
                console.error("Error reiniciando jokers:", error);
                setMessage(`Error al reiniciar los jokers de ${selectedUser}.`);
            }
        }
    };

    const handleResetPin = async () => {
        if (!selectedUser) { alert("Por favor, selecciona un jugador."); return; }
        const jornadaId = prompt("Introduce el ID de la jornada para la que quieres reiniciar el PIN (ej: jornada_1):");
        if (!jornadaId) return;

        if (window.confirm(`¿Seguro que quieres borrar el PIN de ${selectedUser} para la ${jornadaId}? El jugador podrá editar su apuesta.`)) {
            const pronosticoRef = doc(db, "pronosticos", jornadaId, "jugadores", selectedUser);
            try {
                await updateDoc(pronosticoRef, { pin: "" });
                setMessage(`PIN de ${selectedUser} para la ${jornadaId} borrado.`);
            } catch (error) {
                console.error("Error borrando PIN:", error);
                setMessage(`Error al borrar el PIN. Verifica que el ID de la jornada es correcto y que el jugador tiene un pronóstico guardado.`);
            }
        }
    };

    return (
        <div style={styles.adminJornadaItem}>
            <button onClick={onBack} style={styles.backButton}>&larr; Volver al Panel</button>
            <h3 style={styles.formSectionTitle}>🔧 Gestión de Jugadores</h3>
            <div style={styles.adminControls}>
                <div>
                    <label style={styles.label}>Seleccionar Jugador</label>
                    <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} style={styles.adminSelect}>
                        <option value="">-- Elige un jugador --</option>
                        {JUGADORES.map(j => <option key={j} value={j}>{j}</option>)}
                    </select>
                </div>
            </div>
            <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button onClick={handleResetJokers} disabled={!selectedUser} style={styles.saveButton}>Reiniciar Jokers</button>
                <button onClick={handleResetPin} disabled={!selectedUser} style={{ ...styles.saveButton, backgroundColor: styles.colors.warning }}>Borrar PIN de Jornada</button>
            </div>
            {message && <p style={{ ...styles.message, marginTop: '15px' }}>{message}</p>}
        </div>
    );
};

export default AdminUserManager;
