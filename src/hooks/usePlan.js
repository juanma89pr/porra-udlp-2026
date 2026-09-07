/**
 * usePlan.js — Derivacion del plan nutricional desde configuracion.
 *
 * NO carga de Firebase (eso lo hace App.jsx en onAuthStateChanged, fiel al
 * flujo existente). Aqui solo se DERIVAN flags y valores a partir de la
 * configuracion ya cargada. Respeta los 4 tipos de plan reales guardados
 * en Firestore: 'flexible' | 'flexible_alimentos' | 'estricto_alimentos' |
 * 'estricto_diario'.
 */

import { useMemo } from 'react';

export function construirCesta(planData) {
  var mapa = {};
  if (planData && planData.dias) {
    Object.keys(planData.dias).forEach(function(dia) {
      (planData.dias[dia] || []).forEach(function(comida) {
        if (comida.esComidaLibre) return;
        (comida.ingredientes || []).forEach(function(ing) {
          if (!ing.alimento) return;
          var n = ing.alimento.trim().toUpperCase();
          if (!mapa[n]) mapa[n] = 0;
          mapa[n] += ing.cantidad || 0;
        });
      });
    });
  }
  return mapa;
}

var DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export function diaHoyNombre() {
  return DIAS[new Date().getDay()];
}

export default function usePlan(config) {
  return useMemo(function() {
    var cfg = config || {};
    // El día elegido por el cliente (menuElegido en HoyScreen) siempre debe
    // respetarse — el día real del calendario solo manda cuando el plan es
    // "estricto_diario" DE FORMA EXPLÍCITA. Si tipoPlan no está guardado
    // (planes antiguos, huecos de datos), el valor por defecto de Admin es
    // 'flexible' — este fallback debe coincidir, nunca caer en 'estricto_diario'.
    var tipoPlan = cfg.tipoPlan || (cfg.planFlexible === false ? 'estricto_diario' : 'flexible');

    var modulosActivos = cfg.modulosActivos || { food: false, moov: false };
    var comidasCfg = cfg.comidasConfig || { mediaManana: false, merienda: false, recena: false };

    var planData = cfg.planData || null;
    var dias = (planData && planData.dias) ? Object.keys(planData.dias) : [];

    var hoyNombre = diaHoyNombre();
    var diaControl = cfg.diaControl || '';
    var hoyEsDiaControl = false;
    if (diaControl) {
      hoyEsDiaControl = hoyNombre.toLowerCase().indexOf(diaControl.toLowerCase()) !== -1;
    }

    return {
      tipoPlan: tipoPlan,
      // Suscripción tal como la fija Juan en el admin (plan contratado,
      // periodo, fecha de fin). La pantalla "Tu plan" la necesita para saber
      // qué tiene el cliente y qué paso siguiente sugerirle.
      configuracion: { suscripcion: cfg.suscripcion || {}, objetivoReferencia: cfg.objetivoReferencia || null },
      // Permisos derivados (misma logica que la app actual)
      puedeModificar: tipoPlan === 'flexible',
      puedeModificarAlimentos: tipoPlan === 'flexible' || tipoPlan === 'flexible_alimentos',
      puedeModificarDias: tipoPlan === 'flexible' || tipoPlan === 'estricto_alimentos',
      esPlanEstricto: tipoPlan === 'estricto_diario',

      modulosActivos: modulosActivos,
      tieneFood: modulosActivos.food === true,
      tieneMoov: modulosActivos.moov === true,
      tieneMindfulness: true, // incluido gratis para todos hasta nuevo aviso

      comidasCfg: comidasCfg,

      objetivoKcal: cfg.objetivoKcal || (planData && planData.objetivoKcal) || 0,
      objetivoProt: cfg.objetivoProt || (planData && planData.objetivoProt) || 0,
      objetivoCarb: cfg.objetivoCarb || (planData && planData.objetivoCarb) || 0,
      objetivoGrasa: cfg.objetivoGrasa || (planData && planData.objetivoGrasa) || 0,
      objetivoPasos: cfg.objetivoPasos || 0,
      objetivoSueno: cfg.objetivoSueno || 0,

      // Campos de objetivo ampliados
      objetivoTipo: cfg.objetivoTipo || '',
      pesoActual: cfg.pesoActual || '',
      pesoMeta: cfg.pesoMeta || '',
      grasaActual: cfg.grasaActual || '',
      grasaMeta: cfg.grasaMeta || '',
      objetivoPlazo: cfg.objetivoPlazo || '',
      objetivoFechaMeta: cfg.objetivoFechaMeta || '',
      objetivoDiasEntreno: cfg.objetivoDiasEntreno || '',
      objetivoHorasEntreno: cfg.objetivoHorasEntreno || '',
      objetivoNota: cfg.objetivoNota || '',
      nombre: cfg.nombre || (cfg.configuracion && cfg.configuracion.nombre) || '',

      planData: planData,
      dias: dias,
      diaHoy: hoyNombre,
      diaControl: diaControl,
      hoyEsDiaControl: hoyEsDiaControl,
      suplementosPlan: (function() {
        var lista = [];
        if (cfg.suplProteina) {
          lista.push({
            nombre: 'Proteína en polvo',
            dosis: cfg.suplProteinaScoops ? cfg.suplProteinaScoops + ' scoop(s)' : '',
            momento: cfg.suplProteinaCuando || ''
          });
        }
        if (cfg.suplCreatina) {
          lista.push({
            nombre: 'Creatina',
            dosis: cfg.suplCreatinaGramos ? cfg.suplCreatinaGramos + ' g' : '',
            momento: cfg.suplCreatinaCuando || ''
          });
        }
        var si;
        for (si = 0; si < 5; si++) {
          if (cfg['suplExtra' + si + 'Activo'] && cfg['suplExtra' + si + 'Nombre']) {
            lista.push({
              nombre: cfg['suplExtra' + si + 'Nombre'],
              dosis: cfg['suplExtra' + si + 'Dosis'] || '',
              momento: cfg['suplExtra' + si + 'Cuando'] || ''
            });
          }
        }
        return lista;
      })(),
      carbCyclingActivo: cfg.carbCyclingActivo === true,
      carbCycling: cfg.carbCycling || null,
      faseActual: cfg.faseActual || '',
      pilotoTarjetasV2: cfg.pilotoTarjetasV2 !== false, // ya no es piloto — activo para todos salvo que se desactive a propósito
      suscripcion: cfg.suscripcion || null,
      tienePlan: !!(planData && planData.dias && dias.length > 0)
    };
  }, [config]);
}
