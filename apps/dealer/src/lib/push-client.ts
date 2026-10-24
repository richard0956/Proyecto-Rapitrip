"use client";

import { arrayBufferToBase64Url, detectEnvironment, pushSupport, urlBase64ToUint8Array } from "./push";
import { friendlyError } from "./api-error";
import { getSupabase } from "./client";

export type PushStatus = "cargando" | "activo" | "inactivo" | "bloqueado" | "instalar-ios" | "no-soportado" | "sin-clave";

/** Estado de los avisos en ESTE dispositivo: si el navegador los permite y si ya hay una suscripción. */
export async function readPushStatus(): Promise<PushStatus> {
  const support = pushSupport(detectEnvironment());
  if (!support.ok) return support.reason === "instalar-ios" ? "instalar-ios" : support.reason === "sin-clave" ? "sin-clave" : "no-soportado";
  if (Notification.permission === "denied") return "bloqueado";
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription && Notification.permission === "granted" ? "activo" : "inactivo";
  } catch {
    return "inactivo";
  }
}

export type PushResult = { ok: true } | { ok: false; message: string };

/** Pide el permiso, suscribe este navegador y lo registra en el servidor. Debe llamarse desde un toque del usuario (iPhone lo exige). */
export async function enablePush(): Promise<PushResult> {
  const support = pushSupport(detectEnvironment());
  if (!support.ok) return { ok: false, message: "Este dispositivo no permite avisos." };
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, message: "No diste permiso para los avisos. Puedes activarlos en los ajustes del navegador." };
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""),
      }));
    const p256dh = arrayBufferToBase64Url(subscription.getKey("p256dh"));
    const auth = arrayBufferToBase64Url(subscription.getKey("auth"));
    const { error } = await getSupabase().rpc("register_push_subscription", {
      p_endpoint: subscription.endpoint,
      p_p256dh: p256dh,
      p_auth: auth,
      p_user_agent: navigator.userAgent.slice(0, 200),
    });
    if (error) return { ok: false, message: friendlyError(error, "No pudimos activar los avisos. Inténtalo de nuevo.") };
    return { ok: true };
  } catch {
    return { ok: false, message: "No pudimos activar los avisos en este dispositivo." };
  }
}

export async function disablePush(): Promise<PushResult> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await getSupabase().rpc("unregister_push_subscription", { p_endpoint: subscription.endpoint });
      await subscription.unsubscribe();
    }
    return { ok: true };
  } catch {
    return { ok: false, message: "No pudimos desactivar los avisos." };
  }
}
