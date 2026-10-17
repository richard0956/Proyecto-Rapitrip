import { Button } from "@rapitrip/ui";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="font-titulo text-4xl text-selva">Rapitrip</h1>
      <p className="text-tinta-suave">Tu tienda, rápido y cerca.</p>
      <Button variant="primary">Ingresar</Button>
    </main>
  );
}
