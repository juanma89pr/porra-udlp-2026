// ============================================================================
// AUTENTICACIÓN HÍBRIDA: NOMBRE + PIN — PORRA UDLP 26/27
// ============================================================================
// Sustituye el login anónimo puro por un sistema donde:
//   1. El jugador pulsa su nombre (como siempre)
//   2. Introduce un PIN de 4 dígitos
//   3. Si es la primera vez, ese PIN se registra (hasheado, nunca en claro)
//   4. Si ya existe, se valida contra el hash guardado
//   5. En cualquier caso, se devuelve un Firebase Custom Token con un UID
//      ESTABLE y determinista (no cambia entre sesiones), lo que permite
//      que las reglas de Firestore confíen en request.auth.uid
//
// El UID se genera de forma determinista a partir del nombre del jugador,
// normalizado (minúsculas, sin tildes, sin espacios), para que sea siempre
// el mismo sin tener que guardar un mapeo aparte.
// ============================================================================

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const crypto = require("crypto");
const logger = require("firebase-functions/logger");

// Email del admin general — se usa solo para marcar el documento /admins/{uid}
// la primera vez que ese jugador inicia sesión. Ajustar si el nombre de
// admin cambia en el futuro.
const NOMBRE_ADMIN = "Juanma";

// ── Helpers ──────────────────────────────────────────────────────────────

function normalizarNombre(nombre) {
  return nombre
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // quita tildes
}

// UID determinista: mismo nombre → mismo UID siempre. Prefijo "jugador_"
// para que sea reconocible en los logs y en la consola de Firebase Auth.
function generarUidEstable(nombreNormalizado) {
  const hash = crypto.createHash("sha256").update(nombreNormalizado).digest("hex");
  return `jugador_${hash.substring(0, 28)}`;
}

function hashPin(pin, salt) {
  return crypto.createHash("sha256").update(`${salt}:${pin}`).digest("hex");
}

function generarSalt() {
  return crypto.randomBytes(16).toString("hex");
}

function validarFormatoPin(pin) {
  return typeof pin === "string" && /^[0-9]{4}$/.test(pin);
}

// ============================================================================
// FUNCIÓN PRINCIPAL: loginConPin
// ============================================================================
// Body esperado: { nombre: "Juanma", pin: "1234" }
// Devuelve: { token: "<custom-token>", esNuevoPin: true|false }
exports.loginConPin = onCall(
  { region: "europe-west1" },
  async (request) => {
    const db = getFirestore();
    const auth = getAuth();

    const nombreOriginal = request.data?.nombre;
    const pin = request.data?.pin;

    if (!nombreOriginal || typeof nombreOriginal !== "string") {
      throw new HttpsError("invalid-argument", "Falta el nombre del jugador.");
    }
    if (!validarFormatoPin(pin)) {
      throw new HttpsError("invalid-argument", "El PIN debe tener exactamente 4 dígitos.");
    }

    const nombreNormalizado = normalizarNombre(nombreOriginal);
    const uid = generarUidEstable(nombreNormalizado);

    const credencialRef = db.collection("credenciales_pin").doc(uid);
    const credencialSnap = await credencialRef.get();

    let esNuevoPin = false;

    if (!credencialSnap.exists) {
      // Primera vez que este jugador inicia sesión: registramos su PIN
      esNuevoPin = true;
      const salt = generarSalt();
      const pinHasheado = hashPin(pin, salt);

      await credencialRef.set({
        nombreOriginal: nombreOriginal,
        nombreNormalizado: nombreNormalizado,
        salt: salt,
        pinHash: pinHasheado,
        creadoEn: FieldValue.serverTimestamp(),
        ultimoAcceso: FieldValue.serverTimestamp(),
        intentosFallidos: 0,
      });

      logger.info(`Nuevo PIN registrado para "${nombreOriginal}" (uid: ${uid})`);
    } else {
      // Ya existe: validar el PIN
      const credencial = credencialSnap.data();

      // Bloqueo simple anti fuerza-bruta: tras 5 intentos fallidos seguidos,
      // exige esperar (no bloquea permanentemente, solo frena).
      if ((credencial.intentosFallidos || 0) >= 5) {
        logger.warn(`Demasiados intentos fallidos para "${nombreOriginal}" (uid: ${uid})`);
        throw new HttpsError(
          "resource-exhausted",
          "Demasiados intentos fallidos. Inténtalo de nuevo más tarde o contacta con el admin."
        );
      }

      const pinHasheadoIntento = hashPin(pin, credencial.salt);

      if (pinHasheadoIntento !== credencial.pinHash) {
        await credencialRef.update({
          intentosFallidos: FieldValue.increment(1),
        });
        throw new HttpsError("permission-denied", "PIN incorrecto.");
      }

      // PIN correcto: resetear contador de fallos y actualizar último acceso
      await credencialRef.update({
        ultimoAcceso: FieldValue.serverTimestamp(),
        intentosFallidos: 0,
      });
    }

    // Asegurar que el usuario existe en Firebase Auth con ese UID estable
    try {
      await auth.getUser(uid);
    } catch (error) {
      if (error.code === "auth/user-not-found") {
        await auth.createUser({
          uid: uid,
          displayName: nombreOriginal,
        });
      } else {
        throw error;
      }
    }

    // Si este jugador es el admin general, aseguramos su documento /admins/{uid}
    if (nombreNormalizado === normalizarNombre(NOMBRE_ADMIN)) {
      await db.collection("admins").doc(uid).set(
        { nombre: nombreOriginal, asignadoEn: FieldValue.serverTimestamp() },
        { merge: true }
      );
    }

    // Asegurar/crear el documento de perfil básico (nombre legible, vínculo uid↔nombre)
    await db.collection("perfiles").doc(uid).set(
      {
        nombre: nombreOriginal,
        uid: uid,
      },
      { merge: true }
    );

    const customToken = await auth.createCustomToken(uid, {
      nombre: nombreOriginal,
    });

    return { token: customToken, esNuevoPin, uid };
  }
);

// ============================================================================
// FUNCIÓN AUXILIAR: cambiarPin
// ============================================================================
// Permite a un jugador YA AUTENTICADO cambiar su propio PIN.
// Body esperado: { pinActual: "1234", pinNuevo: "5678" }
exports.cambiarPin = onCall(
  { region: "europe-west1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión primero.");
    }

    const { pinActual, pinNuevo } = request.data || {};
    if (!validarFormatoPin(pinActual) || !validarFormatoPin(pinNuevo)) {
      throw new HttpsError("invalid-argument", "Ambos PINs deben tener 4 dígitos.");
    }

    const db = getFirestore();
    const uid = request.auth.uid;
    const credencialRef = db.collection("credenciales_pin").doc(uid);
    const credencialSnap = await credencialRef.get();

    if (!credencialSnap.exists) {
      throw new HttpsError("not-found", "No se encontró tu credencial.");
    }

    const credencial = credencialSnap.data();
    const hashActualIntento = hashPin(pinActual, credencial.salt);

    if (hashActualIntento !== credencial.pinHash) {
      throw new HttpsError("permission-denied", "El PIN actual no es correcto.");
    }

    const nuevoSalt = generarSalt();
    const nuevoHash = hashPin(pinNuevo, nuevoSalt);

    await credencialRef.update({
      salt: nuevoSalt,
      pinHash: nuevoHash,
      intentosFallidos: 0,
    });

    logger.info(`PIN actualizado para uid: ${uid}`);
    return { success: true };
  }
);
