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

const MONTHS_IT = {
  gennaio: "01", febbraio: "02", marzo: "03", aprile: "04",
  maggio: "05", giugno: "06", luglio: "07", agosto: "08",
  settembre: "09", ottobre: "10", novembre: "11", dicembre: "12",
};

const WEEKDAY_PREFIX = /^(luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato|domenica)\s+/i;
const SLASH_DATE_RE = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s+(?:ore\s+)?(\d{1,2})(?::(\d{2}))?/i;
const ITALIAN_DATE_RE = new RegExp(
  `^(\\d{1,2})\\s+(${Object.keys(MONTHS_IT).join("|")})(?:\\s+(\\d{4}))?\\s+(?:ore\\s+)?(\\d{1,2})(?::(\\d{2}))?`,
  "i",
);

/**
 * Parser best-effort per il testo libero di uno slot proposto dal tecnico.
 * Restituisce `{date, time, location}` se riesce a estrarre almeno data+ora,
 * altrimenti `null` (fallback: l'owner compila manualmente).
 *
 * Formati supportati:
 *   - "28/04 9-12" / "28/04 ore 9-12" / "28/04/2026 9:30"
 *   - "Martedì 28/04 9:30" (il giorno della settimana viene ignorato)
 *   - "28 aprile 2026 14:00" (mese in italiano)
 * Formati non supportati ritornano `null` (es. "09:00-12:00" senza data,
 * "venerdì prossimo pomeriggio").
 *
 * @param {string} text
 * @returns {{date: string, time: string, location: string} | null}
 *          date in formato `YYYY-MM-DD`, time in formato `HH:mm`, location è
 *          ciò che resta dopo la data/ora (senza range `-12` residuo).
 */
export function parseSlotText(text) {
  if (typeof text !== "string") return null;
  const input = text.trim();
  if (!input) return null;

  const stripped = input.replace(WEEKDAY_PREFIX, "");
  const currentYear = new Date().getUTCFullYear();

  let date;
  let time;
  let matchedLength;

  const slashMatch = stripped.match(SLASH_DATE_RE);
  if (slashMatch) {
    const [whole, dd, mm, yy, hh, min] = slashMatch;
    const year = yy ? (yy.length === 2 ? `20${yy}` : yy) : String(currentYear);
    date = `${year}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    time = `${hh.padStart(2, "0")}:${(min || "00").padStart(2, "0")}`;
    matchedLength = whole.length;
  } else {
    const itMatch = stripped.match(ITALIAN_DATE_RE);
    if (!itMatch) return null;
    const [whole, dd, monthName, yy, hh, min] = itMatch;
    const monthKey = monthName.toLowerCase();
    const month = MONTHS_IT[monthKey];
    if (!month) return null;
    const year = yy || String(currentYear);
    date = `${year}-${month}-${dd.padStart(2, "0")}`;
    time = `${hh.padStart(2, "0")}:${(min || "00").padStart(2, "0")}`;
    matchedLength = whole.length;
  }

  if (Number.isNaN(new Date(`${date}T${time}:00`).getTime())) return null;

  let rest = stripped.slice(matchedLength).trim();
  rest = rest.replace(/^[-–]\s*\d{1,2}(?::\d{2})?/, "").trim();
  rest = rest.replace(/^[,;:·\-\s]+/, "").trim();

  return { date, time, location: rest };
}
