// Importa los módulos necesarios de Firebase Functions v2
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp, increment } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const logger = require("firebase-functions/logger");

// Inicializa Firebase Admin SDK
initializeApp();

const db = getFirestore();
const messaging = getMessaging();

// ===============================================================
// FUNCIÓN MANUAL (Versión actualizada)
// ===============================================================
exports.sendGlobalNotification = onCall(async (request) => {
  // Verificación de que solo un admin (tú) puede llamar a esta función
  if (request.auth?.token?.name !== "Juanma") {
    logger.warn("Intento de envío de notificación no autorizado.", { auth: request.auth });
    throw new HttpsError(
      "permission-denied",
      "Solo el administrador puede enviar notificaciones."
    );
  }

  const messageText = request.data.message;
  if (!messageText) {
    throw new HttpsError(
      "invalid-argument",
      "El mensaje no puede estar vacío."
    );
  }

  // 1. Obtener todos los tokens de los dispositivos
  const tokensSnapshot = await db.collection("notification_tokens").get();
  if (tokensSnapshot.empty) {
    logger.info("No hay tokens a los que enviar notificación.");
    return { success: true, message: "No hay usuarios para notificar." };
  }
  const tokens = tokensSnapshot.docs.map((doc) => doc.id);

  // 2. Crear el payload de la notificación
  const payload = {
    notification: {
      title: "Porra UDLP 2026 🐥",
      body: messageText,
      icon: "/favicon.ico",
    },
  };

  // 3. Enviar el mensaje a todos los tokens
  try {
    const response = await messaging.sendToDevice(tokens, payload);
    logger.info("Notificación enviada con éxito:", response);
    
    // Opcional: Limpiar tokens que ya no son válidos
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
    throw new HttpsError(
      "internal",
      "No se pudo enviar la notificación."
    );
  }
});


// ===============================================================
// ¡NUEVO! FUNCIONES AUTOMÁTICAS (Versión actualizada)
// ===============================================================

// Función auxiliar para enviar notificaciones (para no repetir código)
const sendNotificationToAll = async (messageBody) => {
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


/**
 * Se dispara CADA VEZ que se actualiza una jornada.
 * Envía notificaciones cuando el estado cambia a "Abierta" o "Finalizada".
 */
exports.onJornadaStateChange = onDocumentUpdated("jornadas/{jornadaId}", async (event) => {
    const dataAntes = event.data.before.data();
    const dataDespues = event.data.after.data();

    // 1. Notificación de JORNADA ABIERTA
    if (dataAntes.estado !== "Abierta" && dataDespues.estado === "Abierta") {
      const message = `¡Ya está abierta la Jornada ${dataDespues.numeroJornada}! Haz tu pronóstico para el ${dataDespues.equipoLocal} vs ${dataDespues.equipoVisitante}.`;
      await sendNotificationToAll(message);
    }

    // 2. Notificación de JORNADA FINALIZADA
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


/**
 * Se dispara CADA MINUTO para comprobar si alguna jornada está a punto de cerrar.
 */
exports.checkJornadaClosingSoon = onSchedule("every 1 minutes", async (event) => {
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
