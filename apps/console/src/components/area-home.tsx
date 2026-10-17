import type { ConsoleArea } from "@rapitrip/supabase";
import { Button, Card } from "@rapitrip/ui";
import { requireConsoleAccess } from "@/lib/guard";
import { signOut } from "@/lib/actions";
import { SessionActivity } from "./session-activity";

const titles: Record<ConsoleArea, string> = {
  admin: "Administración",
  operations: "Operaciones",
  comercio: "Mi comercio",
};

export async function AreaHome({ area }: { area: ConsoleArea }) {
  const session = await requireConsoleAccess(area);
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-6">
      <SessionActivity />
      <header className="flex items-center justify-between gap-4">
        <h1 className="font-titulo text-3xl text-selva">{titles[area]}</h1>
        <form action={signOut}>
          <Button variant="ghost" type="submit">
            Cerrar sesión
          </Button>
        </form>
      </header>
      <Card>
        <p className="text-tinta">
          Sesión iniciada como <strong>{session.email}</strong> ({session.role}).
        </p>
        <p className="mt-2 text-tinta-suave">Las pantallas de esta área se construyen en los siguientes pasos.</p>
      </Card>
    </main>
  );
}
