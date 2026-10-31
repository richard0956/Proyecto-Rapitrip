"use client";

import { useEffect, type RefObject } from "react";

const MARGIN = 16;

/**
 * Con el teclado del teléfono abierto, el área visible (`visualViewport`) se encoge y puede tapar el botón de enviar. Mientras un
 * campo del formulario tiene el foco, desplaza la página lo justo para que el botón quede encima del teclado, sin subir el campo
 * enfocado por encima del borde de arriba. Funciona igual en iPhone y en Android (ninguno cambia el tamaño de la página).
 */
export function useKeyboardFit(formRef: RefObject<HTMLFormElement | null>) {
  useEffect(() => {
    const form = formRef.current;
    const viewport = window.visualViewport;
    if (!form || !viewport) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const fit = () => {
      const focused = document.activeElement;
      if (!(focused instanceof HTMLElement) || !form.contains(focused)) return;
      const submit = form.querySelector<HTMLElement>('button[type="submit"]');
      if (!submit) return;
      const visibleTop = viewport.offsetTop;
      const visibleBottom = viewport.offsetTop + viewport.height;
      const overflow = submit.getBoundingClientRect().bottom + MARGIN - visibleBottom;
      if (overflow <= 0) return;
      // Nunca más de lo que deja el campo enfocado a la vista.
      const room = focused.getBoundingClientRect().top - visibleTop - MARGIN;
      const by = Math.min(overflow, Math.max(0, room));
      if (by > 0) window.scrollBy({ top: by, behavior: "smooth" });
    };
    // El teclado tarda en abrir: se espera a que termine de cambiar el área visible.
    const later = () => {
      clearTimeout(timer);
      timer = setTimeout(fit, 120);
    };

    viewport.addEventListener("resize", later);
    form.addEventListener("focusin", later);
    return () => {
      clearTimeout(timer);
      viewport.removeEventListener("resize", later);
      form.removeEventListener("focusin", later);
    };
  }, [formRef]);
}
