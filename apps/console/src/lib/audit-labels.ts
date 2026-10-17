/** Textos legibles de las acciones que registra el backend (`private.write_audit`). Lo desconocido se muestra tal cual. */
export const auditLabels: Record<string, string> = {
  "role.granted": "Asignó un rol",
  "role.suspended": "Suspendió un rol",
  "role.reactivated": "Reactivó un rol",
  "role.revoked": "Revocó un rol",
  "invitation.created": "Creó una invitación",
  "invitation.accepted": "Aceptó una invitación",
  "invitation.cancelled": "Canceló una invitación",
  "commerce_request.submitted": "Envió una solicitud de comercio",
  "commerce_request.approved": "Aprobó una solicitud de comercio",
  "commerce_request.rejected": "Rechazó una solicitud de comercio",
  "courier.created": "Creó un repartidor",
  "courier.updated": "Actualizó un repartidor",
  "courier.status_changed": "Cambió el estado de un repartidor",
  "incident.created": "Registró un incidente de TI",
  "incident.status_changed": "Cambió el estado de un incidente",
  "mfa.reset": "Restableció el segundo factor",
  "profile.updated": "Actualizó su perfil",
  "account.anonymization_candidates_marked": "Marcó cuentas candidatas a anonimizar",
  "account.anonymized": "Anonimizó una cuenta",
  export: "Exportó datos cifrados",
  read_sensitive: "Consultó información sensible",
};

const resources: Record<string, string> = {
  audit_events: "la auditoría",
  login_events: "los inicios de sesión",
  courier_document: "el documento de un repartidor",
  client_detail: "el detalle de un cliente",
};

export function auditLabel(action: string, metadata?: Record<string, unknown> | null): string {
  const base = auditLabels[action] ?? action;
  const resource = typeof metadata?.resource === "string" ? resources[metadata.resource] : undefined;
  return action === "read_sensitive" && resource ? `Consultó ${resource}` : base;
}
