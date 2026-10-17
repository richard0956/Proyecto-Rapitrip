import { createServerSupabase } from "@rapitrip/supabase/server";
import { cookies } from "next/headers";

export async function serverSupabase() {
  const store = await cookies();
  return createServerSupabase({
    getAll: () => store.getAll().map(({ name, value }) => ({ name, value })),
    setAll: (list) => {
      try {
        for (const { name, value, options } of list) store.set(name, value, options);
      } catch {
        // En Server Components las cookies son de solo lectura; el proxy ya renueva la sesión.
      }
    },
  });
}
