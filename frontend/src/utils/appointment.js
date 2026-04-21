/**
 * Verifica se un appuntamento è effettivamente impostato.
 *
 * Supporta sia il nuovo schema a oggetto `{ datetime, location, lat?, lng? }`,
 * sia il vecchio schema a stringa (compatibilità durante la migrazione).
 *
 * @param {null|undefined|string|{datetime?: string, location?: string, lat?: number, lng?: number}} appointment
 *        L'appuntamento da verificare.
 * @returns {boolean} `true` se l'appuntamento è presente e significativo,
 *                    `false` se è `null`/`undefined`, stringa vuota, oppure oggetto
 *                    senza `datetime` o con `datetime` non parsabile.
 */
export function isAppointmentSet(appointment) {
  if (appointment == null) return false;
  if (typeof appointment === "string") return appointment.trim().length > 0;
  if (typeof appointment === "object") {
    if (typeof appointment.datetime !== "string" || appointment.datetime.trim().length === 0) return false;
    return !Number.isNaN(new Date(appointment.datetime).getTime());
  }
  return false;
}

/**
 * Formatta un appuntamento in una stringa leggibile in italiano, tipo
 * `"Mar 23/04 · 09:30 · Marina di Pisa pontile B"`.
 *
 * - Se `appointment` è già una stringa (vecchio schema) la ritorna invariata.
 * - Se è un oggetto con `datetime` valido, formatta data/ora con locale `it-IT`
 *   (weekday short, day numeric, month short, hour/minute a 2 cifre) e
 *   concatena la `location` se presente.
 * - Se è `null`/`undefined` o manca `datetime`, ritorna `fallback`.
 *
 * @param {null|undefined|string|{datetime?: string, location?: string, lat?: number, lng?: number}} appointment
 *        L'appuntamento da formattare.
 * @param {string} [fallback="Da concordare"] Stringa restituita quando l'appuntamento non è impostato.
 * @returns {string} Stringa formattata oppure `fallback`.
 */
export function formatAppointment(appointment, fallback = "Da concordare") {
  if (appointment == null) return fallback;

  if (typeof appointment === "string") {
    return appointment.trim().length > 0 ? appointment : fallback;
  }

  if (typeof appointment !== "object") return fallback;

  const { datetime, location } = appointment;
  if (typeof datetime !== "string" || datetime.trim().length === 0) return fallback;

  const date = new Date(datetime);
  if (Number.isNaN(date.getTime())) return fallback;

  const dateLabel = date.toLocaleDateString("it-IT", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const timeLabel = date.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const parts = [dateLabel, timeLabel];
  if (typeof location === "string" && location.trim().length > 0) {
    parts.push(location.trim());
  }
  return parts.join(" · ");
}
