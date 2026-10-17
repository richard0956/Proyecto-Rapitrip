import { getSessionInfo } from "@rapitrip/supabase";
import { Avatar, Button, buttonStyles, Logo } from "@rapitrip/ui";
import { LogOut } from "lucide-react";
import Link from "next/link";
import { signOut } from "@/lib/actions";
import { serverSupabase } from "@/lib/supabase";

export async function SiteHeader() {
  const session = await getSessionInfo(await serverSupabase());
  return (
    <header className="sticky top-0 z-30 border-b border-borde bg-papel/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-[1176px] items-center justify-between gap-3 px-4 sm:px-8">
        <Link href="/" aria-label="Rapitrip, inicio" className="rounded-campo focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-hoja">
          <Logo tone="light" />
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-2">
          <Link href="/vende" className="hidden min-h-11 items-center rounded-boton px-3 text-[13.5px] font-bold text-tinta transition-colors duration-200 hover:bg-menta focus-visible:outline-2 focus-visible:outline-hoja md:inline-flex">
            Vende en Rapitrip
          </Link>
          {session.signedIn ? (
            <>
              <Link href="/perfil" aria-label="Mi perfil" className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja">
                <Avatar name={session.email} />
              </Link>
              <form action={signOut}>
                <Button variant="ghost" type="submit" className="px-3">
                  <LogOut className="size-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Salir</span>
                  <span className="sr-only sm:hidden">Salir</span>
                </Button>
              </form>
            </>
          ) : (
            <>
              <Link href="/ingresar" className={buttonStyles({ variant: "secondary" })}>
                Ingresar
              </Link>
              <Link href="/registro" className={buttonStyles({ variant: "primary", className: "hidden sm:inline-flex" })}>
                Crear cuenta
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
