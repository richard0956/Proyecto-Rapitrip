/** Estado de carga de las páginas de la tienda: bloques que ocupan el lugar del contenido mientras llega. */
export default function Loading() {
  return (
    <main className="mx-auto max-w-[1180px]" aria-busy="true">
      <p role="status" className="sr-only">
        Cargando…
      </p>
      <div className="h-9 w-48 animate-pulse rounded-xl bg-tinta/10 motion-reduce:animate-none" aria-hidden="true" />
      <div className="mt-3 h-4 w-72 max-w-full animate-pulse rounded-lg bg-tinta/10 motion-reduce:animate-none" aria-hidden="true" />
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-3xl bg-tinta/10 motion-reduce:animate-none" />
        ))}
      </div>
    </main>
  );
}
