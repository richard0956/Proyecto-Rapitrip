"use client";

import { Button } from "@rapitrip/ui";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[460px] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-bold text-tinta">Algo salió mal</h1>
      <p className="text-sm text-tinta-suave">No pudimos mostrar esta pantalla. Lo que ya registraste está a salvo.</p>
      <Button variant="primary" onClick={reset}>
        Reintentar
      </Button>
    </main>
  );
}
