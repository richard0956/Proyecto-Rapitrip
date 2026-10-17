import type { Page } from "@playwright/test";

/** Next añade un anunciador de rutas con `role="alert"`: este selector lo excluye para apuntar solo a los avisos de la interfaz. */
export const alertOf = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');
