/** Tema claro u oscuro de la tienda. La elección del cliente se guarda en el navegador; sin elección, sigue al sistema. */
export type Theme = "light" | "dark";

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
