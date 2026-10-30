/** Tema claro u oscuro de la tienda. La elección del cliente se guarda en el navegador; sin elección, sigue al sistema. */
export type Theme = "light" | "dark";
/** Lo que elige el cliente en Preferencias: un tema fijo o seguir al sistema. */
export type ThemeChoice = Theme | "system";

export const THEME_KEY = "rapitrip:tema";

/**
 * Script del <head>: fija `data-theme` en <html> antes del primer pintado, así no hay destello claro al cargar en oscuro.
 * Si el navegador no deja leer el almacenamiento, sigue la preferencia del sistema.
 */
export const themeScript = `try{var t=null;try{t=localStorage.getItem("${THEME_KEY}")}catch(e){}if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){}`;

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/** Aplica el tema y, si es una elección del cliente, la recuerda. */
export function applyTheme(theme: Theme, remember: boolean) {
  document.documentElement.dataset.theme = theme;
  if (!remember) return;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Sin almacenamiento (modo privado estricto): el tema vale solo para esta visita.
  }
}

export function savedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

export function systemTheme(): Theme {
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** La elección guardada; sin elección, «system». */
export function savedChoice(): ThemeChoice {
  return savedTheme() ?? "system";
}

/** Aviso interno de que cambió la elección (el almacenamiento no avisa a la propia pestaña). */
export const CHOICE_EVENT = "rapitrip:tema-elegido";

/** Curva del sistema (`--ease-fluido`): arranca rápido y se asienta con suavidad. */
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

/** Funde colores y fondos de toda la página durante el cambio (la clase solo vive mientras dura). */
function fadeColors(change: () => void) {
  const root = document.documentElement;
  root.classList.add("cambiando-tema");
  change();
  window.setTimeout(() => root.classList.remove("cambiando-tema"), 550);
}

/**
 * Cambia de tema con una transición: el nuevo tema se expande en un círculo desde `origin` (el botón de luna o sol) con la
 * API de transiciones de vista. Sin esa API, los colores se funden; con «reducir movimiento», el cambio es inmediato.
 */
export function switchTheme(choice: ThemeChoice, origin?: { x: number; y: number }) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const theme = choice === "system" ? systemTheme() : choice;
  const change = () => {
    if (choice === "system") {
      try {
        localStorage.removeItem(THEME_KEY);
      } catch {
        // Sin almacenamiento no hay elección guardada que borrar.
      }
      applyTheme(theme, false);
    } else applyTheme(theme, true);
    window.dispatchEvent(new Event(CHOICE_EVENT));
  };
  if (reduce) return change();
  if (!("startViewTransition" in document) || !origin) return fadeColors(change);

  const { x, y } = origin;
  // Radio hasta la esquina más lejana: el círculo termina cubriendo toda la pantalla.
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const transition = document.startViewTransition(change);
  transition.ready
    .then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 700, easing: EASE, pseudoElement: "::view-transition-new(root)" },
      );
    })
    .catch(() => {
      // Si la transición se interrumpe, el tema ya quedó aplicado: no hay nada que deshacer.
    });
}
