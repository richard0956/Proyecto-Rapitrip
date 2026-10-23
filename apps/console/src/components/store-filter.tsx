/** Selector de tienda sin JavaScript: un formulario GET que conserva el periodo elegido. */
type Extra = { name: string; label: string; allLabel: string; options: { id: string; name: string }[]; current: string | undefined };

export function StoreFilter({ basePath, stores, current, keep, extra }: { basePath: string; stores: { id: string; name: string }[]; current: string | undefined; keep?: Record<string, string | undefined>; extra?: Extra }) {
  return (
    <form action={basePath} method="get" className="flex items-center gap-2">
      {Object.entries(keep ?? {}).map(([name, value]) => (value ? <input key={name} type="hidden" name={name} value={value} /> : null))}
      <label htmlFor="tienda" className="sr-only">
        Tienda
      </label>
      <select id="tienda" name="tienda" defaultValue={current ?? ""} className="min-h-10 rounded-full border border-borde-campo bg-papel px-3.5 text-[13px] font-bold text-tinta">
        <option value="">Todas las tiendas</option>
        {stores.map((store) => (
          <option key={store.id} value={store.id}>
            {store.name}
          </option>
        ))}
      </select>
      {extra ? (
        <>
          <label htmlFor={extra.name} className="sr-only">
            {extra.label}
          </label>
          <select id={extra.name} name={extra.name} defaultValue={extra.current ?? ""} className="min-h-10 rounded-full border border-borde-campo bg-papel px-3.5 text-[13px] font-bold text-tinta">
            <option value="">{extra.allLabel}</option>
            {extra.options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </>
      ) : null}
      <button type="submit" className="min-h-10 rounded-full border border-hoja px-3.5 text-[13px] font-bold text-hoja hover:bg-menta/70">
        Aplicar
      </button>
    </form>
  );
}
