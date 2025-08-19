// Importa los módulos necesarios de Firebase Functions v2
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const logger = require("firebase-functions/logger");

// Inicializa Firebase Admin SDK (esto es rápido y se puede quedar aquí)
initializeApp();

// ===============================================================
// FUNCIÓN MANUAL
// ===============================================================
exports.sendGlobalNotification = onCall(async (request) => {
  const db = getFirestore();
  const messaging = getMessaging();

  // La verificación de admin sigue comentada como la tenías
  /*
  if (request.auth?.token?.name !== "Juanma") {
    logger.warn("Intento de envío de notificación no autorizado.", { auth: request.auth });
    throw new HttpsError("permission-denied", "Solo el administrador puede enviar notificaciones.");
  }
  */

  const messageText = request.data.message;
  if (!messageText) {
    throw new HttpsError("invalid-argument", "El mensaje no puede estar vacío.");
  }

  const tokensSnapshot = await db.collection("notification_tokens").get();
  if (tokensSnapshot.empty) {
    logger.info("No hay tokens a los que enviar notificación.");
    return { success: true, message: "No hay usuarios para notificar." };
  }
  const tokens = tokensSnapshot.docs.map((doc) => doc.id);

  const payload = {
    notification: {
      title: "Porra UDLP 2026 🐥",
      body: messageText,
      icon: "/favicon.ico",
    },
  };

  try {
    const response = await messaging.sendToDevice(tokens, payload);
    logger.info("Notificación enviada con éxito:", response);
    
    const tokensToDelete = [];
    response.results.forEach((result, index) => {
      const error = result.error;
      if (error) {
        logger.error("Fallo al enviar al token:", tokens[index], error);
        if (
          error.code === "messaging/invalid-registration-token" ||
          error.code === "messaging/registration-token-not-registered"
        ) {
          tokensToDelete.push(db.collection("notification_tokens").doc(tokens[index]).delete());
        }
      }
    });
    await Promise.all(tokensToDelete);

    return { success: true, message: `Notificación enviada a ${response.successCount} dispositivos.` };
  } catch (error) {
    logger.error("Error al enviar la notificación:", error);
    throw new HttpsError("internal", "No se pudo enviar la notificación.");
  }
});

// ===============================================================
// FUNCIONES AUTOMÁTICAS
// ===============================================================

// Función auxiliar para enviar notificaciones
const sendNotificationToAll = async (messageBody) => {
    const db = getFirestore();
    const messaging = getMessaging();
    const tokensSnapshot = await db.collection("notification_tokens").get();
    if (tokensSnapshot.empty) {
        logger.info("No hay tokens para notificar.");
        return;
    }
    const tokens = tokensSnapshot.docs.map(doc => doc.id);
    const payload = {
        notification: {
            title: "Porra UDLP 2026 🐥",
            body: messageBody,
            icon: "/favicon.ico",
        },
    };
    await messaging.sendToDevice(tokens, payload);
    logger.info(`Notificación automática enviada: "${messageBody}"`);
};

exports.onJornadaStateChange = onDocumentUpdated("jornadas/{jornadaId}", async (event) => {
    const dataAntes = event.data.before.data();
    const dataDespues = event.data.after.data();

    if (dataAntes.estado !== "Abierta" && dataDespues.estado === "Abierta") {
      const message = `¡Ya está abierta la Jornada ${dataDespues.numeroJornada}! Haz tu pronóstico para el ${dataDespues.equipoLocal} vs ${dataDespues.equipoVisitante}.`;
      await sendNotificationToAll(message);
    }

    if (dataAntes.estado !== "Finalizada" && dataDespues.estado === "Finalizada") {
      let message = `¡Jornada ${dataDespues.numeroJornada} finalizada! Resultado: ${dataDespues.resultadoLocal} - ${dataDespues.resultadoVisitante}.`;
      
      if (dataDespues.ganadores && dataDespues.ganadores.length > 0) {
        const ganadoresStr = dataDespues.ganadores.join(", ");
        message += ` ¡Felicidades a los ganadores: ${ganadoresStr}! 🏆`;
      } else {
        message += " ¡El bote se acumula! 💰";
      }
      await sendNotificationToAll(message);
    }

    return null;
});

exports.checkJornadaClosingSoon = onSchedule("every 1 minutes", async (event) => {
    const db = getFirestore();
    const ahora = Timestamp.now();
    const unaHoraDespues = Timestamp.fromMillis(ahora.toMillis() + 60 * 60 * 1000);

    const q = db.collection("jornadas")
      .where("estado", "==", "Abierta")
      .where("fechaCierre", ">=", ahora)
      .where("fechaCierre", "<=", unaHoraDespues);
      
    const jornadasACerrarSnap = await q.get();

    if (jornadasACerrarSnap.empty) {
      logger.info("No hay jornadas cerrando en la próxima hora.");
      return null;
    }

    for (const doc of jornadasACerrarSnap.docs) {
      const jornada = doc.data();
      
      if (jornada.notificacionCierreEnviada) {
        continue;
      }

      const message = `⏳ ¡ÚLTIMA HORA para la Jornada ${jornada.numeroJornada}! Las apuestas para el ${jornada.equipoLocal} vs ${jornada.equipoVisitante} cierran pronto.`;
      await sendNotificationToAll(message);

      await doc.ref.update({ notificacionCierreEnviada: true });
    }

    return null;
});

exports.cerrarJornadasAutomaticamente = onSchedule({
    schedule: "every 5 minutes",
    region: "europe-west1",
  }, async (event) => {
    const db = getFirestore();
    const ahora = Timestamp.now();
    const jornadasRef = db.collection("jornadas");

    logger.info("Iniciando tarea programada: Verificando jornadas para cerrar.");

    try {
      const consulta = jornadasRef.where("estado", "==", "Abierta");
      const snapshot = await consulta.get();

      if (snapshot.empty) {
        logger.info("No se encontraron jornadas abiertas. Tarea finalizada.");
        return null;
      }

      const batch = db.batch();
      let jornadasACerrar = 0;

      snapshot.forEach(doc => {
        const jornada = doc.data();
        if (jornada.fechaCierre && jornada.fechaCierre.toDate() < ahora.toDate()) {
          logger.info(`La jornada ${doc.id} (${jornada.equipoLocal} vs ${jornada.equipoVisitante}) ha caducado. Cerrando...`);
          const jornadaParaActualizarRef = jornadasRef.doc(doc.id);
          batch.update(jornadaParaActualizarRef, { estado: "Cerrada" });
          jornadasACerrar++;
        }
      });

      if (jornadasACerrar > 0) {
        await batch.commit();
        logger.info(`¡Éxito! Se han cerrado ${jornadasACerrar} jornada(s) automáticamente.`);
      } else {
        logger.info("Ninguna jornada abierta ha alcanzado su fecha de cierre. Tarea finalizada.");
      }
    } catch (error) {
      logger.error("Error al ejecutar la función de cierre automático:", error);
    }
    
    return null;
});
