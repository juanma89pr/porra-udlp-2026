import React, { useState } from 'react';
import { functions, httpsCallable } from '../firebaseConfig';
import styles, { colors } from '../styles';

const AdminNotifications = ({ onBack }) => {
    const [message, setMessage] = useState('');
    const [customMessage, setCustomMessage] = useState('');
    const [sending, setSending] = useState(false);

    const PRESET_MESSAGES = [
        "¡Nueva jornada abierta! ¡Haz tu pronóstico!",
        "¡Últimas horas para hacer tu porra! ⏳",
        "Las apuestas se han cerrado. ¡Suerte a todos!",
        "¡Ya están los resultados! Comprueba si has ganado. 🏆"
    ];

    const handleSendNotification = async (msgToSend) => {
        if (!msgToSend) {
            alert("El mensaje no puede estar vacío.");
            return;
        }
        setSending(true);
        setMessage(`Enviando: "${msgToSend}"...`);

        try {
            const sendGlobalNotification = httpsCallable(functions, 'sendGlobalNotification');
            const result = await sendGlobalNotification({ message: msgToSend });
            
            console.log("Respuesta de la función:", result.data);
            setMessage(`✅ ${result.data.message}`);
            
        } catch (error) {
            console.error("Error al llamar a la Cloud Function:", error);
            setMessage(`❌ Error: ${error.message}`);
        } finally {
            setSending(false);
        }
    };

    return (
        <div style={styles.adminJornadaItem}>
            <button onClick={onBack} style={styles.backButton}>&larr; Volver al Panel</button>
            <h3 style={styles.formSectionTitle}>📣 Comunicaciones y Notificaciones</h3>
            <p style={{ textAlign: 'center', marginBottom: '20px' }}>Envía notificaciones push a todos los jugadores que las tengan activadas.</p>
            
            <div style={styles.presetMessagesContainer}>
                <label style={styles.label}>Mensajes predefinidos</label>
                {PRESET_MESSAGES.map((msg, i) => (
                    <button key={i} onClick={() => handleSendNotification(msg)} disabled={sending} style={styles.presetMessageButton}>
                        {msg}
                    </button>
                ))}
            </div>

            <div style={{ marginTop: '20px' }}>
                <label style={styles.label}>Mensaje personalizado</label>
                <textarea 
                    value={customMessage} 
                    onChange={(e) => setCustomMessage(e.target.value)} 
                    style={{ ...styles.input, width: '95%', height: '60px' }} 
                    placeholder="Escribe un mensaje corto..."
                />
                <button onClick={() => handleSendNotification(customMessage)} disabled={sending || !customMessage} style={{ ...styles.saveButton, marginTop: '10px' }}>
                    {sending ? 'Enviando...' : 'Enviar Mensaje Personalizado'}
                </button>
            </div>

            {message && <p style={{ ...styles.message, marginTop: '15px' }}>{message}</p>}
        </div>
    );
};

export default AdminNotifications;
