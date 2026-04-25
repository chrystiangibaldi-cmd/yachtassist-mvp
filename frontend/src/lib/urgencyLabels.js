// Centralized urgency labels for ticket display.
// Maps storage values (Ticket.urgency Literal: alta|media|bassa|emergenza)
// to user-facing labels. Used in all post-creation display surfaces
// (detail views, dashboards, badges).
//
// NOT used in wizard input (RequestIntervention.jsx), which uses
// the input vocabulary normale|urgente|emergenza of CreateTicketRequest.

export const URGENCY_LABEL = {
  alta: "Urgente (4h)",
  media: "Normale (48h)",
  bassa: "Bassa",
  emergenza: "EMERGENZA",
};

export const URGENCY_BADGE_VARIANT = {
  alta: "warning",
  media: "secondary",
  bassa: "outline",
  emergenza: "destructive",
};

export function getUrgencyLabel(value) {
  return URGENCY_LABEL[value] ?? value ?? "—";
}

export function getUrgencyBadgeVariant(value) {
  return URGENCY_BADGE_VARIANT[value] ?? "outline";
}
