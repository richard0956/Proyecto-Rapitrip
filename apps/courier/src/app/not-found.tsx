import { buttonStyles } from "@rapitrip/ui";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[460px] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-bold text-tinta">No encontramos esa página</h1>
      <Link href="/" className={buttonStyles({ variant: "primary" })}>
        Volver al inicio
      </Link>
    </main>
  );
}
