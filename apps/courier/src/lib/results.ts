/** Resultado de `courier_pick_up` y `courier_deliver`. */
export type ActionResult = "ok" | "falta_foto" | "incorrecto" | "bloqueado" | "sin_codigo" | string;

/** Mensaje para el repartidor según lo que respondió la base de datos; nulo si salió bien. */
export function actionMessage(result: ActionResult | null | undefined): string | null {
  switch (result) {
    case "ok":
      return null;
    case "incorrecto":
      return "Código incorrecto. Pídelo de nuevo y revisa los 4 dígitos.";
    case "bloqueado":
      return "El código se bloqueó por demasiados intentos. Avisa a coordinación para que lo libere.";
    case "falta_foto":
      return "Falta la foto. Tómala primero y vuelve a confirmar.";
    case "sin_codigo":
      return "Este pedido no tiene código. Avisa a coordinación.";
    default:
      return "No pudimos completar la acción. Inténtalo de nuevo.";
  }
}

/** `differs` también viene cuando falla solo por falta de explicación: la pantalla lo necesita para pedir la nota. */
export type CashCheck = { ok: true; amount: number; differs: boolean } | { ok: false; message: string; differs: boolean };

/** Valida el monto que escribió el repartidor contra el total del pedido. Si no coincide, hace falta explicar la diferencia. */
export function checkCash(text: string, total: number | null, note: string, parse: (text: string) => number | null): CashCheck {
  const amount = parse(text);
  if (amount === null) return { ok: false, message: "Escribe el monto que cobraste (por ejemplo 350 o 350.50).", differs: false };
  const differs = total !== null && Math.round(amount * 100) !== Math.round(total * 100);
  if (differs && note.trim().length < 3) return { ok: false, message: "El monto no coincide con el total. Explica la diferencia.", differs: true };
  return { ok: true, amount, differs };
}
