const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const logger = require("firebase-functions/logger");

initializeApp();

// ===============================================================
// AUTENTICACIÓN HÍBRIDA NOMBRE + PIN
// ===============================================================
const authPin = require("./auth-pin");
exports.loginConPin = authPin.loginConPin;
exports.cambiarPin = authPin.cambiarPin;

// ===============================================================
// NOTIFICACIÓN GLOBAL (admin)
// ===============================================================
exports.sendGlobalNotification = onCall(async (request) => {
  const db = getFirestore();
  const messageText = request.data.message;
  if (!messageText) {
    throw new HttpsError("invalid-argument", "El mensaje no puede estar vacío.");
  }

  const tokensSnapshot = await db.collection("notification_tokens").get();
  if (tokensSnapshot.empty) {
    return { success: true, message: "No hay usuarios para notificar." };
  }

  const tokens = tokensSnapshot.docs.map((d) => d.id);
  const messaging = getMessaging();

  // API nueva de FCM (sendEachForMulticast en lugar de sendToDevice)
  const multicastMessage = {
    notification: {
      title: "Porra UDLP 26/27 🐥",
      body: messageText,
    },
    tokens: tokens,
  };

  try {
    const response = await messaging.sendEachForMulticast(multicastMessage);
    logger.info("Notificación enviada:", response.successCount, "OK /", response.failureCount, "fail");

    const deletePromises = [];
    response.responses.forEach((res, i) => {
      if (!res.success) {
        const code = res.error?.code || "";
        if (code.includes("invalid-registration-token") || code.includes("registration-token-not-registered")) {
          deletePromises.push(db.collection("notification_tokens").doc(tokens[i]).delete());
        }
      }
    });
    await Promise.all(deletePromises);

    return { success: true, message: `Notificación enviada a ${response.successCount} dispositivos.` };
  } catch (error) {
    logger.error("Error al enviar notificación:", error);
    throw new HttpsError("internal", "No se pudo enviar la notificación.");
  }
});

// ===============================================================
// HELPER INTERNO: enviar notificación a todos
// ===============================================================
const sendNotificationToAll = async (messageBody) => {
  const db = getFirestore();
  const tokensSnapshot = await db.collection("notification_tokens").get();
  if (tokensSnapshot.empty) return;

  const tokens = tokensSnapshot.docs.map((d) => d.id);
  const messaging = getMessaging();

  await messaging.sendEachForMulticast({
    notification: { title: "Porra UDLP 26/27 🐥", body: messageBody },
    tokens: tokens,
  });
  logger.info(`Notificación automática enviada: "${messageBody}"`);
};

// ===============================================================
// TRIGGER: cambio de estado en jornadas
// ===============================================================
exports.onJornadaStateChange = onDocumentUpdated("jornadas/{jornadaId}", async (event) => {
  const antes = event.data.before.data();
  const despues = event.data.after.data();

  if (antes.estado !== "Abierta" && despues.estado === "Abierta") {
    const msg = `¡Ya está abierta la Jornada ${despues.numeroJornada}! Haz tu pronóstico para el ${despues.equipoLocal} vs ${despues.equipoVisitante}.`;
    await sendNotificationToAll(msg);
  }

  if (antes.estado !== "Finalizada" && despues.estado === "Finalizada") {
    let msg = `¡Jornada ${despues.numeroJornada} finalizada! Resultado: ${despues.resultadoLocal} - ${despues.resultadoVisitante}.`;
    if (despues.ganadores && despues.ganadores.length > 0) {
      msg += ` ¡Felicidades a ${despues.ganadores.join(", ")}! 🏆`;
    } else {
      msg += " ¡El bote se acumula! 💰";
    }
    await sendNotificationToAll(msg);
  }

  return null;
});

// ===============================================================
// SCHEDULED: avisar cuando una jornada cierra pronto
// ===============================================================
exports.checkJornadaClosingSoon = onSchedule("every 1 minutes", async () => {
  const db = getFirestore();
  const ahora = Timestamp.now();
  const unaHoraDespues = Timestamp.fromMillis(ahora.toMillis() + 60 * 60 * 1000);

  const snap = await db.collection("jornadas")
    .where("estado", "==", "Abierta")
    .where("fechaCierre", ">=", ahora)
    .where("fechaCierre", "<=", unaHoraDespues)
    .get();

  if (snap.empty) return null;

  for (const docSnap of snap.docs) {
    const j = docSnap.data();
    if (j.notificacionCierreEnviada) continue;
    const msg = `⏳ ¡ÚLTIMA HORA para la Jornada ${j.numeroJornada}! Las apuestas para ${j.equipoLocal} vs ${j.equipoVisitante} cierran pronto.`;
    await sendNotificationToAll(msg);
    await docSnap.ref.update({ notificacionCierreEnviada: true });
  }

  return null;
});

// ===============================================================
// SCHEDULED: cerrar jornadas automáticamente
// ===============================================================
exports.cerrarJornadasAutomaticamente = onSchedule({
  schedule: "every 5 minutes",
  region: "europe-west1",
}, async () => {
  const db = getFirestore();
  const ahora = Timestamp.now();

  try {
    const snap = await db.collection("jornadas").where("estado", "==", "Abierta").get();
    if (snap.empty) return null;

    const batch = db.batch();
    let n = 0;

    snap.forEach((docSnap) => {
      const j = docSnap.data();
      if (j.fechaCierre && j.fechaCierre.toDate() < ahora.toDate()) {
        batch.update(docSnap.ref, { estado: "Cerrada" });
        n++;
      }
    });

    if (n > 0) {
      await batch.commit();
      logger.info(`Cerradas ${n} jornada(s) automáticamente.`);
    }
  } catch (error) {
    logger.error("Error en cierre automático:", error);
  }

  return null;
});
