import { Button } from "@rapitrip/ui";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="font-titulo text-4xl text-selva">Rapitrip · Consola</h1>
      <p className="text-tinta-suave">Gestión interna de Rapitrip.</p>
      <Button variant="primary">Iniciar sesión</Button>
    </main>
  );
}
