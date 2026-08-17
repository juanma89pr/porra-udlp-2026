/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useRef } from 'react';

var API_FOOTBALL_KEY = process.env.REACT_APP_API_FOOTBALL_KEY;

function App() {
    var [fase, setFase] = useState('intro');
    var [videoOpacity, setVideoOpacity] = useState(0);
    var [statsOpacity, setStatsOpacity] = useState(0);
    var [stats, setStats] = useState([]);
    var [cargandoStats, setCargandoStats] = useState(true);
    var [infoPartido, setInfoPartido] = useState(null);
    var [statsVisibles, setStatsVisibles] = useState(0);
    var videoRef = useRef(null);

    useEffect(function() {
        var t = setTimeout(function() {
            setFase('video');
            setTimeout(function() { setVideoOpacity(1); }, 100);
        }, 1500);
        return function() { clearTimeout(t); };
    }, []);

    var handleVideoEnd = function() {
        setVideoOpacity(0);
        setTimeout(function() {
            setFase('stats');
            setTimeout(function() { setStatsOpacity(1); }, 300);
        }, 1200);
    };

    // Animación escalonada de las estadísticas
    useEffect(function() {
        if (fase !== 'stats' || stats.length === 0) return;
        var i = 0;
        var t = setInterval(function() {
            i++;
            setStatsVisibles(i);
            if (i >= stats.length) clearInterval(t);
        }, 150);
        return function() { clearInterval(t); };
    }, [fase, stats.length]);

    useEffect(function() {
        if (!API_FOOTBALL_KEY) { setStats(statsFallback()); setCargandoStats(false); return; }
        (async function() {
            try {
                var url = 'https://v3.football.api-sports.io/fixtures?team=534&season=2026&last=1';
                var res = await fetch(url, { headers: { 'x-apisports-key': API_FOOTBALL_KEY } });
                var data = await res.json();
                if (data.response && data.response.length > 0) {
                    var f = data.response[0];
                    setInfoPartido({
                        local: f.teams.home.name, visitante: f.teams.away.name,
                        golesLocal: f.goals.home, golesVisitante: f.goals.away,
                        logoLocal: f.teams.home.logo, logoVisitante: f.teams.away.logo,
                        fecha: new Date(f.fixture.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Atlantic/Canary' }),
                        estadio: f.fixture.venue ? f.fixture.venue.name : 'Estadio de Gran Canaria',
                    });
                    var urlS = 'https://v3.football.api-sports.io/fixtures/statistics?fixture=' + f.fixture.id;
                    var resS = await fetch(urlS, { headers: { 'x-apisports-key': API_FOOTBALL_KEY } });
                    var dataS = await resS.json();
                    if (dataS.response && dataS.response.length > 0) {
                        var eq = dataS.response.find(function(e) { return e.team && e.team.id === 534; });
                        if (eq && eq.statistics) {
                            var lista = eq.statistics.filter(function(s) { return s.value !== null && s.value !== 0 && s.value !== '0%'; })
                                .map(function(s) { return { label: traducirStat(s.type), value: s.value }; }).slice(0, 12);
                            setStats(lista.length > 0 ? lista : statsFallback());
                        } else { setStats(statsFallback()); }
                    } else { setStats(statsFallback()); }
                } else { setStats(statsFallback()); }
            } catch (e) { setStats(statsFallback()); }
            setCargandoStats(false);
        })();
    }, []);

    function traducirStat(tipo) {
        var mapa = {
            'Ball Possession': 'Posesión del balón',
            'Total Shots': 'Tiros totales',
            'Shots on Goal': 'Tiros a puerta',
            'Shots off Goal': 'Tiros fuera',
            'Blocked Shots': 'Tiros bloqueados',
            'Shots insidebox': 'Tiros dentro del área',
            'Shots outsidebox': 'Tiros fuera del área',
            'Corner Kicks': 'Córners',
            'Fouls': 'Faltas cometidas',
            'Offsides': 'Fueras de juego',
            'Yellow Cards': 'Tarjetas amarillas',
            'Red Cards': 'Tarjetas rojas',
            'Goalkeeper Saves': 'Paradas del portero',
            'Total passes': 'Pases totales',
            'Passes accurate': 'Pases completados',
            'Passes %': 'Precisión de pases',
            'expected_goals': 'Goles esperados (xG)',
        };
        return mapa[tipo] || tipo;
    }

    function statsFallback() {
        return [
            { label: 'Posesión del balón', value: '54%' },
            { label: 'Tiros totales', value: 14 },
            { label: 'Tiros a puerta', value: 6 },
            { label: 'Córners', value: 7 },
            { label: 'Pases completados', value: 387 },
            { label: 'Precisión de pases', value: '82%' },
            { label: 'Faltas cometidas', value: 11 },
            { label: 'Tarjetas amarillas', value: 3 },
            { label: 'Paradas del portero', value: 4 },
            { label: 'Pases totales', value: 472 },
            { label: 'Fueras de juego', value: 2 },
            { label: 'Tiros fuera', value: 5 },
        ];
    }

    var iconosStat = {
        'Posesión del balón': '⚽', 'Tiros totales': '🎯', 'Tiros a puerta': '🥅',
        'Tiros fuera': '↗️', 'Tiros bloqueados': '🛡️', 'Tiros dentro del área': '📦',
        'Tiros fuera del área': '🏹', 'Córners': '📐', 'Faltas cometidas': '⚠️',
        'Fueras de juego': '🚩', 'Tarjetas amarillas': '🟨', 'Tarjetas rojas': '🟥',
        'Paradas del portero': '🧤', 'Pases totales': '📊', 'Pases completados': '✅',
        'Precisión de pases': '🎯', 'Goles esperados (xG)': '📈',
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: '#0a0a0f',
            fontFamily: "'Inter', -apple-system, sans-serif",
            overflow: 'hidden',
        }}>
            <link href="https://fonts.googleapis.com/css2?family=Teko:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
            <style>{"\
                @keyframes pulseGold { 0%,100%{opacity:.6} 50%{opacity:1} }\
                @keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }\
            "}</style>

            {/* FASE 1: Video */}
            {(fase === 'intro' || fase === 'video') && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: '#000', zIndex: 100,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <video ref={videoRef} src="/promo_udlp.mp4"
                        autoPlay playsInline
                        onEnded={handleVideoEnd} onError={handleVideoEnd}
                        style={{
                            width: '100%', height: '100%', objectFit: 'cover',
                            opacity: videoOpacity, transition: 'opacity 1.5s ease',
                        }}
                    />
                </div>
            )}

            {/* FASE 2: Pantalla premium de mantenimiento */}
            {fase === 'stats' && (
                <div style={{
                    opacity: statsOpacity, transition: 'opacity 1.2s ease',
                    padding: '50px 20px 70px', maxWidth: 440, margin: '0 auto',
                }}>
                    {/* Cabecera con línea dorada */}
                    <div style={{ textAlign: 'center', marginBottom: 40 }}>
                        <p style={{
                            fontFamily: "'Teko', sans-serif",
                            fontSize: 36, fontWeight: 700, letterSpacing: 8,
                            background: 'linear-gradient(135deg, #FFD700, #DAA520, #FFD700)',
                            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                            marginBottom: 6,
                        }}>PORRA UDLP</p>
                        <p style={{
                            fontFamily: "'Teko', sans-serif",
                            fontSize: 12, letterSpacing: 6, color: 'rgba(255,215,0,0.35)',
                            textTransform: 'uppercase',
                        }}>TEMPORADA 26/27</p>
                        <div style={{
                            width: 80, height: 1,
                            background: 'linear-gradient(90deg, transparent, #FFD700, transparent)',
                            margin: '20px auto',
                        }} />
                    </div>

                    {/* Mensaje de mantenimiento */}
                    <div style={{
                        background: 'linear-gradient(135deg, rgba(255,215,0,0.06), rgba(255,215,0,0.02))',
                        border: '1px solid rgba(255,215,0,0.12)',
                        borderRadius: 24, padding: '24px 20px',
                        marginBottom: 32, position: 'relative', overflow: 'hidden',
                    }}>
                        <div style={{
                            position: 'absolute', top: -30, right: -30, width: 100, height: 100,
                            background: 'radial-gradient(circle, rgba(255,215,0,0.08), transparent 70%)',
                        }} />
                        <p style={{
                            fontFamily: "'Teko', sans-serif",
                            fontSize: 20, fontWeight: 600, letterSpacing: 3,
                            color: '#FFD700', textTransform: 'uppercase', marginBottom: 10,
                        }}>Estamos mejorando la app</p>
                        <p style={{
                            fontFamily: "'Inter', sans-serif",
                            fontSize: 13, color: 'rgba(255,255,255,0.55)',
                            lineHeight: 1.8,
                        }}>
                            Volveremos muy pronto con novedades y todo listo para la temporada.
                            Mientras tanto, repasa los datos del último partido. 💛💙
                        </p>
                    </div>

                    {/* Resultado del partido */}
                    {infoPartido && (
                        <div style={{
                            background: 'linear-gradient(135deg, #0d1b3e, #162955)',
                            border: '1px solid rgba(255,215,0,0.1)',
                            borderRadius: 24, padding: '24px 20px', textAlign: 'center',
                            marginBottom: 28, position: 'relative', overflow: 'hidden',
                            boxShadow: '0 12px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,215,0,0.08)',
                        }}>
                            <div style={{
                                position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                                background: 'linear-gradient(90deg, transparent 10%, #FFD700 50%, transparent 90%)',
                                opacity: 0.4,
                            }} />
                            <p style={{
                                fontFamily: "'Inter', sans-serif",
                                fontSize: 10, letterSpacing: 3, color: 'rgba(255,255,255,0.3)',
                                textTransform: 'uppercase', marginBottom: 16,
                            }}>{infoPartido.fecha}</p>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 8 }}>
                                {infoPartido.logoLocal && <img src={infoPartido.logoLocal} alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} />}
                                <p style={{
                                    fontFamily: "'Teko', sans-serif",
                                    fontSize: 52, fontWeight: 700, color: '#fff',
                                    letterSpacing: 10, lineHeight: 1,
                                    textShadow: '0 0 40px rgba(255,215,0,0.15)',
                                }}>{infoPartido.golesLocal} — {infoPartido.golesVisitante}</p>
                                {infoPartido.logoVisitante && <img src={infoPartido.logoVisitante} alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} />}
                            </div>
                            <p style={{
                                fontFamily: "'Inter', sans-serif",
                                fontSize: 12, color: 'rgba(255,255,255,0.45)',
                            }}>{infoPartido.local} vs {infoPartido.visitante}</p>
                            <p style={{
                                fontFamily: "'Inter', sans-serif",
                                fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 6,
                            }}>{infoPartido.estadio}</p>
                        </div>
                    )}

                    {/* Estadísticas — en español, animadas */}
                    <div style={{ marginBottom: 40 }}>
                        <p style={{
                            fontFamily: "'Teko', sans-serif",
                            fontSize: 13, letterSpacing: 5, color: 'rgba(255,215,0,0.35)',
                            textTransform: 'uppercase', marginBottom: 16, textAlign: 'center',
                        }}>Estadísticas del partido</p>

                        {cargandoStats ? (
                            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 12, animation: 'pulseGold 2s infinite' }}>Consultando datos...</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                {stats.map(function(s, i) {
                                    var icono = iconosStat[s.label] || '📊';
                                    var visible = i < statsVisibles;
                                    return (
                                        <div key={i} style={{
                                            display: 'flex', alignItems: 'center', gap: 12,
                                            padding: '11px 16px',
                                            background: visible ? 'rgba(255,255,255,0.025)' : 'transparent',
                                            border: '1px solid ' + (visible ? 'rgba(255,215,0,0.06)' : 'transparent'),
                                            borderRadius: 14,
                                            opacity: visible ? 1 : 0,
                                            transform: visible ? 'translateY(0)' : 'translateY(12px)',
                                            transition: 'all 0.4s ease',
                                        }}>
                                            <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{icono}</span>
                                            <span style={{
                                                flex: 1, fontFamily: "'Inter', sans-serif",
                                                fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 400,
                                            }}>{s.label}</span>
                                            <span style={{
                                                fontFamily: "'Teko', sans-serif",
                                                fontSize: 22, fontWeight: 700,
                                                background: 'linear-gradient(135deg, #FFD700, #DAA520)',
                                                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                                                minWidth: 40, textAlign: 'right',
                                            }}>{s.value}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer premium */}
                    <div style={{ textAlign: 'center' }}>
                        <div style={{
                            width: 50, height: 1,
                            background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.2), transparent)',
                            margin: '0 auto 20px',
                        }} />
                        <p style={{
                            fontFamily: "'Teko', sans-serif",
                            fontSize: 11, letterSpacing: 4, color: 'rgba(255,215,0,0.2)',
                            textTransform: 'uppercase',
                        }}>Porra UDLP · 2ª Temporada</p>
                        <p style={{
                            fontFamily: "'Inter', sans-serif",
                            fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 8,
                        }}>
                            Volvemos pronto con todo. Gracias por la paciencia 💛
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
