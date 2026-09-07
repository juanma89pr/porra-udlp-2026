import React from 'react';
import Icono from '../components/Icono';
import { Cabecera, Etiqueta, Titulo, Tarjeta, Boton, Nota } from '../components/UI';

/**
 * MiPlanScreen — lo que ve un cliente activo sobre su plan.
 *
 * Sustituye a la tabla de cinco planes con descuentos, que a alguien que ya
 * paga no le sirve y puede jugar en contra: si ve un plan más barato que el
 * suyo pide bajar; si paga una condición especial y ve otro precio, se siente
 * engañado. Aquí solo hay tres cosas: qué tiene, hasta cuándo, y UNA
 * sugerencia de ampliación con su precio. El resto de precios viven en el shop,
 * para quien todavía no es cliente.
 *
 * Los precios son los fijados en agosto de 2026. Si cambian, se tocan en
 * PRECIOS y en ninguna otra parte.
 */

var PRECIOS = {
  food:      { nombre: 'Food',                          precio: 99.99,  desc: 'Plan nutricional personalizado con seguimiento diario.' },
  moov:      { nombre: 'Moov',                          precio: 79.99,  desc: 'Tabla de entrenamiento personalizada.' },
  food_moov: { nombre: 'Food + Moov',                   precio: 120,    desc: 'Nutrición y entrenamiento. La combinación completa.' },
  moov_acomp:{ nombre: 'Moov + Acompañamiento',         precio: 159.99, desc: 'Entrenamiento con 4 sesiones presenciales al mes.' },
  full:      { nombre: 'Food + Moov + Acompañamiento',  precio: 219.99, desc: 'Todo: nutrición, entreno y 4 sesiones al mes.' }
};

// Descuentos por periodo, solo para planes que incluyen dieta
var DESCUENTO = { mensual: 0, trimestral: 0.10, semestral: 0.15, anual: 0.20 };

// Oferta de apertura de Mind: hasta el 31 de diciembre de 2026
var FIN_OFERTA_MIND = new Date('2026-12-31T23:59:59');

// Qué le sugerimos según lo que ya tiene: un solo paso, no toda la tabla
var SIGUIENTE = {
  food:       { a: 'food_moov',  por: 'Añade el entrenamiento y cierra el círculo: dieta y entreno pensados a la vez.' },
  moov:       { a: 'food_moov',  por: 'Añade la dieta. Entrenar sin comer para ello es dejar la mitad del resultado en la mesa.' },
  food_moov:  { a: 'full',       por: 'Añade 4 sesiones presenciales al mes para corregir técnica y afinar cargas.' },
  moov_acomp: { a: 'full',       por: 'Añade la dieta y aprovecha de verdad las sesiones que ya haces.' },
  full:       null
};

function fmt(n) { return (Math.round(n * 100) / 100).toLocaleString('es-ES', { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 }); }

function precioPeriodo(clave, periodo) {
  var base = PRECIOS[clave] ? PRECIOS[clave].precio : 0;
  var tieneDieta = clave === 'food' || clave === 'food_moov' || clave === 'full';
  var d = tieneDieta ? (DESCUENTO[periodo] || 0) : 0;
  return base * (1 - d);
}

export default function MiPlanScreen(props) {
  var plan = props.plan || {};
  var onVolver = props.onVolver || function() {};
  var whatsapp = props.whatsapp || '34682498645';

  var cfg = plan.configuracion || {};
  var sus = cfg.suscripcion || {};
  var clave = sus.planContratado || (plan.tieneFood && plan.tieneMoov ? 'food_moov' : plan.tieneFood ? 'food' : plan.tieneMoov ? 'moov' : '');
  var actual = PRECIOS[clave] || null;
  var periodo = sus.periodo || 'mensual';

  var dv = null;
  if (sus.fechaFin) {
    var f = new Date(sus.fechaFin + 'T00:00:00');
    if (!isNaN(f.getTime())) {
      var hoy = new Date(); hoy.setHours(0, 0, 0, 0);
      dv = Math.round((f - hoy) / 86400000);
    }
  }
  var vencido = dv !== null && dv < 0;
  var cerca = dv !== null && dv >= 0 && dv <= 14;

  var sig = SIGUIENTE[clave] || null;
  var ofertaMindViva = new Date() <= FIN_OFERTA_MIND;

  var abrirWA = function(texto) {
    window.open('https://wa.me/' + whatsapp + '?text=' + encodeURIComponent(texto), '_blank');
  };

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', paddingBottom: '40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button onClick={onVolver} aria-label="Volver"
          style={{ width: '38px', height: '38px', borderRadius: '11px', border: '1px solid var(--bt-border)', background: 'var(--bt-card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icono nombre="ArrowLeft" tam={17} color="var(--bt-text-2)" grosor={2.2} />
        </button>
        <p style={{ fontSize: 'var(--bt-f-bloque)', fontWeight: 800, letterSpacing: '-0.015em', margin: 0 }}>Tu plan</p>
      </div>

      {/* ── Lo que tiene ── */}
      <Cabecera>
        <Etiqueta sobreCobalto>{vencido ? 'Plan vencido' : cerca ? 'Renueva pronto' : 'Tu plan actual'}</Etiqueta>
        <div style={{ margin: '4px 0 10px' }}>
          <Titulo sobreCobalto>{actual ? actual.nombre : 'Sin plan activo'}</Titulo>
        </div>
        {actual ? (
          <p style={{ fontSize: '13px', color: 'var(--bt-cabecera-texto-2)', lineHeight: 1.55, margin: 0 }}>{actual.desc}</p>
        ) : (
          <p style={{ fontSize: '13px', color: 'var(--bt-cabecera-texto-2)', lineHeight: 1.55, margin: 0 }}>Escríbele a Juan y lo ponéis en marcha.</p>
        )}

        {sus.fechaFin ? (
          <div style={{ marginTop: '14px', display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1, padding: '11px 12px', borderRadius: '12px', background: 'rgba(255,255,255,0.12)' }}>
              <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--bt-cabecera-texto-2)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Periodo</p>
              <p style={{ fontSize: '14px', fontWeight: 800, margin: '3px 0 0', textTransform: 'capitalize' }}>{periodo}</p>
            </div>
            <div style={{ flex: 1, padding: '11px 12px', borderRadius: '12px', background: vencido ? 'rgba(239,68,68,0.28)' : cerca ? 'rgba(245,158,11,0.28)' : 'rgba(255,255,255,0.12)' }}>
              <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--bt-cabecera-texto-2)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>{vencido ? 'Venció' : 'Hasta el'}</p>
              <p style={{ fontSize: '14px', fontWeight: 800, margin: '3px 0 0' }}>
                {new Date(sus.fechaFin + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                {dv !== null && !vencido ? <span style={{ fontSize: '11px', fontWeight: 600, opacity: 0.8 }}> · {dv} día{dv !== 1 ? 's' : ''}</span> : null}
              </p>
            </div>
          </div>
        ) : null}

        {(vencido || cerca) && actual ? (
          <div style={{ marginTop: '12px' }}>
            <button onClick={function() { abrirWA('Hola Juanma, quiero renovar mi plan ' + actual.nombre + '.'); }}
              style={{ width: '100%', padding: '13px', borderRadius: 'var(--bt-radius-sm)', border: 'none', background: '#ffffff', color: 'var(--bt-cobalto)', fontWeight: 800, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Icono nombre="MessageCircle" tam={16} color="var(--bt-cobalto)" grosor={2.2} />
              {vencido ? 'Renovar ahora' : 'Renovar antes de que venza'}
            </button>
          </div>
        ) : null}
      </Cabecera>

      {/* ── Mind incluido ── */}
      {ofertaMindViva ? (
        <Tarjeta acento="#14b8a6">
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <span style={{ width: '38px', height: '38px', borderRadius: '11px', background: 'color-mix(in srgb, #14b8a6 14%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icono nombre="Waves" tam={18} color="#14b8a6" grosor={2} />
            </span>
            <div>
              <p style={{ fontSize: 'var(--bt-f-tarjeta)', fontWeight: 800, margin: 0 }}>Mind incluido en tu plan</p>
              <p style={{ fontSize: 'var(--bt-f-nota)', color: 'var(--bt-text-2)', lineHeight: 1.55, margin: '4px 0 0' }}>
                Respiración, reflexión y descanso, sin coste. Oferta de apertura válida hasta el 31 de diciembre de 2026.
              </p>
            </div>
          </div>
        </Tarjeta>
      ) : null}

      {/* ── UNA sugerencia, no una tabla ── */}
      {sig && PRECIOS[sig.a] ? (
        <Tarjeta>
          <Etiqueta>Tu siguiente paso</Etiqueta>
          <p style={{ fontSize: 'var(--bt-f-bloque)', fontWeight: 800, letterSpacing: '-0.015em', margin: '6px 0 6px' }}>{PRECIOS[sig.a].nombre}</p>
          <p style={{ fontSize: 'var(--bt-f-texto)', color: 'var(--bt-text-2)', lineHeight: 1.6, margin: '0 0 14px' }}>{sig.por}</p>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '4px' }}>
            <span style={{ fontSize: '30px', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--bt-primary)' }}>{fmt(precioPeriodo(sig.a, periodo))} €</span>
            <span style={{ fontSize: '12px', color: 'var(--bt-text-3)', fontWeight: 700 }}>/mes{periodo !== 'mensual' ? ' · ' + periodo : ''}</span>
          </div>
          {actual ? (
            <Nota>Ahora pagas {fmt(precioPeriodo(clave, periodo))} €/mes. La diferencia son {fmt(precioPeriodo(sig.a, periodo) - precioPeriodo(clave, periodo))} € más al mes.</Nota>
          ) : null}

          <div style={{ marginTop: '14px' }}>
            <Boton ancho icono="MessageCircle"
              onClick={function() { abrirWA('Hola Juanma, me interesa ampliar a ' + PRECIOS[sig.a].nombre + '. ¿Lo hablamos?'); }}>
              Preguntarle a Juan
            </Boton>
          </div>
        </Tarjeta>
      ) : null}

      {clave === 'full' ? (
        <Tarjeta acento="#22c55e">
          <p style={{ fontSize: 'var(--bt-f-tarjeta)', fontWeight: 800, margin: 0 }}>Tienes el plan completo</p>
          <p style={{ fontSize: 'var(--bt-f-nota)', color: 'var(--bt-text-2)', lineHeight: 1.55, margin: '4px 0 0' }}>No hay nada más que añadir. Si quieres una sesión extra fuera de las incluidas, son 15 € por sesión.</p>
        </Tarjeta>
      ) : null}

      {/* ── Sesión suelta, para quien tenga acompañamiento ── */}
      {(clave === 'moov_acomp' || clave === 'full') ? (
        <Tarjeta compacta>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 800, margin: 0 }}>Sesión extra de acompañamiento</p>
              <p style={{ fontSize: '11px', color: 'var(--bt-text-3)', margin: '2px 0 0' }}>Fuera de las 4 incluidas</p>
            </div>
            <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--bt-primary)', flexShrink: 0 }}>15 €</span>
          </div>
        </Tarjeta>
      ) : null}

      <Nota>Cualquier duda sobre tu plan, escríbele a Juan directamente. Los cambios se gestionan siempre con él.</Nota>
    </div>
  );
}
