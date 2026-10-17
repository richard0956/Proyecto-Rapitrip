type BrandPageProps = {
  app: string;
  description: string;
};

export function BrandPage({ app, description }: BrandPageProps) {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-4 px-6">
      <p className="text-sm font-bold uppercase tracking-widest text-hoja">{app}</p>
      <h1 className="font-titulo text-5xl font-extrabold text-selva">Rapitrip</h1>
      <p className="text-lg text-tinta-suave">{description}</p>
    </main>
  );
}
