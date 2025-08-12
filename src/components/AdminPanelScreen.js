import React, { useState } from 'react';
import styles from '../styles';
import AdminTestJornada from './AdminTestJornada';
import AdminEscudosManager from './AdminEscudosManager';
import AdminUserManager from './AdminUserManager';
import AdminNotifications from './AdminNotifications';
import AdminPorraAnual from './AdminPorraAnual';
import JornadaAdminItem from './JornadaAdminItem';
import { LoadingSkeleton } from '../reusableComponents';

const AdminPanelScreen = ({ teamLogos, allJornadas }) => {
    const [loading, setLoading] = useState(false);
    const [adminView, setAdminView] = useState('main');

    if (loading) return <LoadingSkeleton />;

    if (adminView === 'escudos') return <AdminEscudosManager onBack={() => setAdminView('main')} teamLogos={teamLogos} />;
    if (adminView === 'users') return <AdminUserManager onBack={() => setAdminView('main')} />;
    if (adminView === 'notifications') return <AdminNotifications onBack={() => setAdminView('main')} />;
    if (adminView === 'anual') return <AdminPorraAnual onBack={() => setAdminView('main')} />;
    if (adminView === 'jornadas') {
        return (
            <div>
                <button onClick={() => setAdminView('main')} style={styles.backButton}>&larr; Volver al Panel</button>
                <AdminTestJornada />
                <h3 style={{ ...styles.title, fontSize: '1.5rem', marginTop: '40px' }}>Gestión de Jornadas</h3>
                <div style={styles.jornadaList}>
                    {allJornadas.map(jornada => (<JornadaAdminItem key={jornada.id} jornada={jornada} />))}
                </div>
            </div>
        );
    }

    return (
        <div>
            <h2 style={styles.title}>PANEL DE ADMINISTRADOR</h2>
            <div style={styles.adminNav}>
                <button onClick={() => setAdminView('jornadas')} style={styles.adminNavButton}>Gestionar Jornadas</button>
                <button onClick={() => setAdminView('anual')} style={styles.adminNavButton}>Porra Anual</button>
                <button onClick={() => setAdminView('users')} style={styles.adminNavButton}>Jugadores</button>
                <button onClick={() => setAdminView('notifications')} style={styles.adminNavButton}>Notificaciones</button>
                <button onClick={() => setAdminView('escudos')} style={styles.adminNavButton}>Escudos</button>
            </div>
        </div>
    );
};

export default AdminPanelScreen;
