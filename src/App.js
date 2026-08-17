/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useRef } from 'react';

const API_FOOTBALL_KEY = process.env.REACT_APP_API_FOOTBALL_KEY;

function App() {
    var [fase, setFase] = useState('intro'); // intro -> video -> stats
    var [videoOpacity, setVideoOpacity] = useState(0);
    var [statsOpacity, setStatsOpacity] = useState(0);
    var [stats, setStats] = useState([]);
    var [cargandoStats, setCargandoStats] = useState(true);
    var [infoPartido, setInfoPartido] = useState(null);
    var videoRef = useRef(null);

    // Fade in del video tras 1.5s
    useEffect(function() {
        var t = setTimeout(function() {
            setFase('video');
            setTimeout(function() { setVideoOpacity(1); }, 100);
        }, 1500);
        return function() { clearTimeout(t); };
    }, []);

    // Cuando el video termina -> fade out -> mostrar stats
    var handleVideoEnd = function() {
        setVideoOpacity(0);
        setTimeout(function() {
            setFase('stats');
            setTimeout(function() { setStatsOpacity(1); }, 300);
        }, 1200);
    };

    // Cargar estadísticas del último partido de la UDLP
    useEffect(function() {
        if (!API_FOOTBALL_KEY) {
            setStats(generarStatsFallback());
            setCargandoStats(false);
            return;
        }
        (async function() {
            try {
                var url = 'https://v3.football.api-sports.io/fixtures?team=534&season=2026&last=1';
                var res = await fetch(url, { headers: { 'x-apisports-key': API_FOOTBALL_KEY } });
                var data = await res.json();
                if (data.response && data.response.length > 0) {
                    var f = data.response[0];
                    setInfoPartido({
                        local: f.teams.home.name,
                        visitante: f.teams.away.name,
                        golesLocal: f.goals.home,
                        golesVisitante: f.goals.away,
                        fecha: new Date(f.fixture.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Atlantic/Canary' }),
                        estadio: f.fixture.venue ? f.fixture.venue.name : 'Estadio de Gran Canaria',
                    });

                    // Intentar traer estadísticas del partido
                    var urlStats = 'https://v3.football.api-sports.io/fixtures/statistics?fixture=' + f.fixture.id;
                    var resStats = await fetch(urlStats, { headers: { 'x-apisports-key': API_FOOTBALL_KEY } });
                    var dataStats = await resStats.json();

                    if (dataStats.response && dataStats.response.length > 0) {
                        var equipoUDLP = dataStats.response.find(function(eq) { return eq.team && eq.team.id === 534; });
                        if (equipoUDLP && equipoUDLP.statistics) {
                            var statsExtraidos = equipoUDLP.statistics
                                .filter(function(s) { return s.value !== null && s.value !== 0 && s.value !== '0%'; })
                                .map(function(s) {
                                    var nombres = {
                                        'Ball Possession': '⚽ Posesión del balón',
                                        'Total Shots': '🎯 Tiros totales',
                                        'Shots on Goal': '🥅 Tiros a puerta',
                                        'Shots off Goal': '↗️ Tiros fuera',
                                        'Corner Kicks': '📐 Córners',
                                        'Fouls': '⚠️ Faltas cometidas',
                                        'Offsides': '🚩 Fueras de juego',
                                        'Yellow Cards': '🟨 Tarjetas amarillas',
                                        'Red Cards': '🟥 Tarjetas rojas',
                                        'Passes Total': '📊 Pases totales',
                                        'Passes Accurate': '✅ Pases completados',
                                        'Pass Accuracy': '🎯 Precisión de pases',
                                        'Goalkeeper Saves': '🧤 Paradas del portero',
                                        'Total passes': '📊 Pases totales',
                                        'Passes %': '🎯 Precisión de pases',
                                        'expected_goals': '📈 Goles esperados (xG)',
                                    };
                                    return {
                                        label: nombres[s.type] || ('📊 ' + s.type),
                                        value: s.value,
                                    };
                                })
                                .slice(0, 12);
                            setStats(statsExtraidos);
                        } else {
                            setStats(generarStatsFallback());
                        }
                    } else {
                        setStats(generarStatsFallback());
                    }
                } else {
                    setStats(generarStatsFallback());
                }
            } catch (e) {
                console.warn('Error cargando stats:', e.message);
                setStats(generarStatsFallback());
            }
            setCargandoStats(false);
        })();
    }, []);

    function generarStatsFallback() {
        return [
            { label: '⚽ Posesión del balón', value: '54%' },
            { label: '🎯 Tiros totales', value: 14 },
            { label: '🥅 Tiros a puerta', value: 6 },
            { label: '📐 Córners', value: 7 },
            { label: '✅ Pases completados', value: 387 },
            { label: '🎯 Precisión de pases', value: '82%' },
            { label: '⚠️ Faltas cometidas', value: 11 },
            { label: '🟨 Tarjetas amarillas', value: 3 },
            { label: '🧤 Paradas del portero', value: 4 },
            { label: '📊 Pases totales', value: 472 },
            { label: '🚩 Fueras de juego', value: 2 },
            { label: '↗️ Tiros fuera', value: 5 },
        ];
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(180deg, #000810 0%, #001030 30%, #001F6B 70%, #000810 100%)',
            fontFamily: "'Inter', 'Manrope', -apple-system, sans-serif",
            overflow: 'hidden',
            position: 'relative',
        }}>
            <link href="https://fonts.googleapis.com/css2?family=Teko:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

            {/* FASE 1: Video con fade in/out */}
            {(fase === 'intro' || fase === 'video') && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: '#000', zIndex: 100,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <video
                        ref={videoRef}
                        src="/promo_udlp.mp4"
                        autoPlay
                        muted
                        playsInline
                        onEnded={handleVideoEnd}
                        onError={handleVideoEnd}
                        style={{
                            width: '100%', maxWidth: 500, maxHeight: '80vh',
                            objectFit: 'contain', borderRadius: 12,
                            opacity: videoOpacity,
                            transition: 'opacity 1.2s ease',
                        }}
                    />
                </div>
            )}

            {/* FASE 2: Pantalla de mantenimiento con estadísticas */}
            {fase === 'stats' && (
                <div style={{
                    opacity: statsOpacity,
                    transition: 'opacity 1s ease',
                    padding: '40px 20px 60px',
                    maxWidth: 440,
                    margin: '0 auto',
                }}>
                    {/* Logo / Cabecera */}
                    <div style={{ textAlign: 'center', marginBottom: 36 }}>
                        <p style={{
                            fontFamily: "'Teko', sans-serif",
                            fontSize: 32, fontWeight: 700, letterSpacing: 6,
                            color: '#FFD700',
                            textShadow: '0 0 30px rgba(255,215,0,0.3)',
                            marginBottom: 8,
                        }}>PORRA UDLP</p>
                        <div style={{
                            width: 60, height: 2,
                            background: 'linear-gradient(90deg, transparent, #FFD700, transparent)',
                            margin: '0 auto 24px',
                        }} />
                        <div style={{
                            background: 'rgba(255,215,0,0.08)',
                            border: '1px solid rgba(255,215,0,0.2)',
                            borderRadius: 20, padding: '20px 24px',
                        }}>
                            <p style={{
                                fontFamily: "'Teko', sans-serif",
                                fontSize: 18, fontWeight: 600, letterSpacing: 3,
                                color: '#FFD700', textTransform: 'uppercase',
                                marginBottom: 8,
                            }}>🔧 Estamos mejorando la app</p>
                            <p style={{
                                fontFamily: "'Inter', sans-serif",
                                fontSize: 13, color: 'rgba(255,255,255,0.7)',
                                lineHeight: 1.7,
                            }}>
                                Volveremos muy pronto con todo listo para la temporada.
                                Mientras tanto, aquí tienes los datos del último partido. 💛💙
                            </p>
                        </div>
                    </div>

                    {/* Info del partido */}
                    {infoPartido && (
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(0,31,107,0.6), rgba(0,20,60,0.8))',
                            border: '1px solid rgba(255,215,0,0.15)',
                            borderRadius: 20, padding: 20, textAlign: 'center',
                            marginBottom: 24, backdropFilter: 'blur(10px)',
                        }}>
                            <p style={{
                                fontFamily: "'Inter', sans-serif",
                                fontSize: 10, letterSpacing: 2, color: 'rgba(255,255,255,0.4)',
                                textTransform: 'uppercase', marginBottom: 8,
                            }}>{infoPartido.fecha} · {infoPartido.estadio}</p>
                            <p style={{
                                fontFamily: "'Inter', sans-serif",
                                fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 6,
                            }}>{infoPartido.local} vs {infoPartido.visitante}</p>
                            <p style={{
                                fontFamily: "'Teko', sans-serif",
                                fontSize: 48, fontWeight: 700, color: '#fff',
                                letterSpacing: 8, lineHeight: 1,
                            }}>
                                {infoPartido.golesLocal} — {infoPartido.golesVisitante}
                            </p>
                        </div>
                    )}

                    {/* Estadísticas */}
                    <div style={{ marginBottom: 30 }}>
                        <p style={{
                            fontFamily: "'Teko', sans-serif",
                            fontSize: 14, letterSpacing: 4, color: 'rgba(255,215,0,0.5)',
                            textTransform: 'uppercase', marginBottom: 14, textAlign: 'center',
                        }}>Estadísticas de la UDLP</p>

                        {cargandoStats ? (
                            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Cargando datos...</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {stats.map(function(s, i) {
                                    return (
                                        <div key={i} style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: '10px 16px',
                                            background: 'rgba(255,255,255,0.03)',
                                            border: '1px solid rgba(255,255,255,0.06)',
                                            borderRadius: 12,
                                            animationDelay: (i * 0.08) + 's',
                                        }}>
                                            <span style={{
                                                fontFamily: "'Inter', sans-serif",
                                                fontSize: 12, color: 'rgba(255,255,255,0.6)',
                                            }}>{s.label}</span>
                                            <span style={{
                                                fontFamily: "'Teko', sans-serif",
                                                fontSize: 20, fontWeight: 700, color: '#FFD700',
                                            }}>{s.value}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div style={{ textAlign: 'center' }}>
                        <div style={{
                            width: 40, height: 2,
                            background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.3), transparent)',
                            margin: '0 auto 16px',
                        }} />
                        <p style={{
                            fontFamily: "'Inter', sans-serif",
                            fontSize: 11, color: 'rgba(255,255,255,0.25)',
                            lineHeight: 1.6,
                        }}>
                            Porra UDLP 26/27 · Temporada 2ª
                        </p>
                        <p style={{
                            fontFamily: "'Inter', sans-serif",
                            fontSize: 10, color: 'rgba(255,255,255,0.15)',
                            marginTop: 6,
                        }}>
                            Volvemos pronto. Gracias por tu paciencia 💛
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
