/**
 * Preferencia «Reducir animaciones» de las tres apps (tienda, repartidor y consola). Vive en el navegador de cada app y se
 * aplica antes del primer pintado con `data-motion="reducido"` en <html>; `motion.css` apaga entonces la introducción, las
 * entradas de página, las apariciones al hacer scroll y las transiciones.
 */
export const MOTION_KEY = "rapitrip:movimiento";
/** Clave que usaba la consola antes de compartir la preferencia: se sigue leyendo para no perder la elección. */
const LEGACY_KEYS = ["rapitrip:consola:movimiento"];
/** Aviso interno de que cambió la elección (el almacenamiento no avisa a la propia pestaña). */
export const MOTION_CHANGE_EVENT = "rapitrip:movimiento-cambio";

/**
 * Script del <head>: si la preferencia está guardada, marca `data-motion="reducido"` antes de pintar y apaga la introducción de
 * esta sesión, para que no aparezca ni un cuadro animado. Va antes de `introScript`.
 */
export const motionScript = `try{var k=${JSON.stringify([MOTION_KEY, ...LEGACY_KEYS])};for(var i=0;i<k.length;i++){if(localStorage.getItem(k[i])==="reducido"){document.documentElement.dataset.motion="reducido";sessionStorage.setItem("rapitrip:intro","1");break}}}catch(e){}`;

/** Si se eligió «Reducir animaciones» en esta app. */
export function motionReducedByChoice(): boolean {
  return typeof document !== "undefined" && document.documentElement.dataset.motion === "reducido";
}

/** Si hay que evitar animar: por la elección en la app o porque el sistema pide reducir el movimiento. */
export function prefersLessMotion(): boolean {
  if (motionReducedByChoice()) return true;
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** `behavior` para `scrollTo`/`scrollBy`: suave solo si no se pidió reducir el movimiento. */
export function scrollBehavior(): ScrollBehavior {
  return prefersLessMotion() ? "auto" : "smooth";
}

/** Guarda la elección en este navegador y la aplica al instante. */
export function setMotionReduced(reduced: boolean) {
  try {
    for (const key of LEGACY_KEYS) localStorage.removeItem(key);
    if (reduced) localStorage.setItem(MOTION_KEY, "reducido");
    else localStorage.removeItem(MOTION_KEY);
  } catch {
    // Sin almacenamiento (ventana privada): se aplica solo mientras dure esta página.
  }
  if (reduced) document.documentElement.dataset.motion = "reducido";
  else delete document.documentElement.dataset.motion;
  window.dispatchEvent(new Event(MOTION_CHANGE_EVENT));
}
