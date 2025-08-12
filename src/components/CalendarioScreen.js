import React, { useState, useEffect } from 'react';
import styles from '../styles';
import { LoadingSkeleton, TeamDisplay } from '../reusableComponents';

const CalendarioScreen = ({ onViewJornada, teamLogos, jornadas }) => {
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        if (jornadas && jornadas.length > 0) {
            setLoading(false);
        }
    }, [jornadas]);

    if (loading) return <LoadingSkeleton />;
    return (<div><h2 style={styles.title}>CALENDARIO</h2><div style={styles.jornadaList}>{jornadas.map(jornada => (<div key={jornada.id} style={jornada.esVip ? { ...styles.jornadaItem, ...styles.jornadaVip, backgroundImage: `linear-gradient(to right, rgba(23, 42, 69, 0.95), rgba(23, 42, 69, 0.7)), url(${jornada.estadioImageUrl})` } : { ...styles.jornadaItem, backgroundImage: `linear-gradient(to right, rgba(23, 42, 69, 0.95), rgba(23, 42, 69, 0.7)), url(${jornada.estadioImageUrl})` }} onClick={() => onViewJornada(jornada.id)}><div style={styles.jornadaInfo}><div style={styles.jornadaTeams}><TeamDisplay teamLogos={teamLogos} teamName={jornada.equipoLocal} imgStyle={{ width: 25, height: 25 }} /><span style={{ color: styles.colors.yellow, margin: '0 10px' }}>vs</span><TeamDisplay teamLogos={teamLogos} teamName={jornada.equipoVisitante} imgStyle={{ width: 25, height: 25 }} /></div><strong>{jornada.esVip && '⭐ '}{jornada.id === 'jornada_test' ? 'Jornada de Prueba' : `Jornada ${jornada.numeroJornada || 'Copa'}`}</strong><small>{jornada.fechaStr || 'Fecha por confirmar'} - {jornada.estadio || 'Estadio por confirmar'}</small></div><div style={{ ...styles.statusBadge, backgroundColor: styles.colors.status[jornada.estado] }}>{jornada.estado}</div></div>))}</div></div>);
};

export default CalendarioScreen;
