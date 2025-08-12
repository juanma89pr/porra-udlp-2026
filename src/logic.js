const calculateProvisionalPoints = (pronostico, liveData, jornada) => {
    if (!pronostico || !liveData || !jornada) return 0;
    let puntosJornada = 0;
    const esVip = jornada.esVip || false;
    const resultadoLocal = liveData.golesLocal;
    const resultadoVisitante = liveData.golesVisitante;
    if (pronostico.golesLocal !== '' && pronostico.golesVisitante !== '' && parseInt(pronostico.golesLocal) === resultadoLocal && parseInt(pronostico.golesVisitante) === resultadoVisitante) {
        puntosJornada += esVip ? 6 : 3;
    }
    let resultado1x2Real = '';
    if (jornada.equipoLocal === "UD Las Palmas") {
        if (resultadoLocal > resultadoVisitante) resultado1x2Real = 'Gana UD Las Palmas';
        else if (resultadoLocal < resultadoVisitante) resultado1x2Real = 'Pierde UD Las Palmas';
        else resultado1x2Real = 'Empate';
    } else {
        if (resultadoVisitante > resultadoLocal) resultado1x2Real = 'Gana UD Las Palmas';
        else if (resultadoVisitante < resultadoLocal) resultado1x2Real = 'Pierde UD Las Palmas';
        else resultado1x2Real = 'Empate';
    }
    if (pronostico.resultado1x2 === resultado1x2Real) {
        puntosJornada += esVip ? 2 : 1;
    }
    const goleadorReal = (liveData.ultimoGoleador || '').trim().toLowerCase();
    const goleadorApostado = (pronostico.goleador || '').trim().toLowerCase();
    if (pronostico.sinGoleador && (goleadorReal === "sg" || goleadorReal === "")) {
        puntosJornada += 1;
    } else if (!pronostico.sinGoleador && goleadorApostado !== "" && goleadorApostado === goleadorReal) {
        puntosJornada += esVip ? 4 : 2;
    }
    if (pronostico.jokerActivo && pronostico.jokerPronosticos && pronostico.jokerPronosticos.length > 0) {
        for (const jokerP of pronostico.jokerPronosticos) {
            if (jokerP.golesLocal !== '' && jokerP.golesVisitante !== '' && parseInt(jokerP.golesLocal) === resultadoLocal && parseInt(jokerP.golesVisitante) === resultadoVisitante) {
                puntosJornada += esVip ? 6 : 3;
                break;
            }
        }
    }
    return puntosJornada;
};

export { calculateProvisionalPoints };
