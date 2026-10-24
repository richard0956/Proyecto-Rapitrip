import { redirect } from "next/navigation";

/** La pantalla pasó a /coordinacion/efectivo; esta ruta se conserva para los marcadores guardados. */
export default function RepartidorRedirect() {
  redirect("/coordinacion/efectivo");
}
