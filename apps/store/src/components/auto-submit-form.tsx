"use client";

import type { FormHTMLAttributes } from "react";

/**
 * Formulario GET que se envía solo al cambiar un selector o una casilla (ordenar, tienda, «con descuento»…). Los campos de
 * texto y de precio esperan a «Aplicar» o a Enter. Al enviar deja fuera los campos vacíos y el orden por omisión, para que la
 * dirección quede limpia (`?abiertas=1` en vez de `?q=&tienda=&abiertas=1`). Sin JavaScript sigue funcionando con el botón.
 */
export function AutoSubmitForm(props: FormHTMLAttributes<HTMLFormElement>) {
  return (
    <form
      {...props}
      onChange={(event) => {
        const target = event.target as HTMLElement;
        if (target instanceof HTMLSelectElement || (target instanceof HTMLInputElement && target.type === "checkbox")) event.currentTarget.requestSubmit();
      }}
      onSubmit={(event) => {
        for (const field of Array.from(event.currentTarget.elements)) {
          if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement) || !field.name) continue;
          const empty = field.value.trim() === "" || (field.name === "orden" && field.value === "nombre");
          // Un campo deshabilitado no viaja en el envío; la página se recarga con la nueva dirección.
          if (empty) field.disabled = true;
        }
      }}
    />
  );
}
