export type DirectoryStatus = "activo" | "suspendido";
export type StatusFilter = "todos" | DirectoryStatus;

export type DirectoryRow = { id: string; name: string; ruc: string | null; status: DirectoryStatus; stores: number; accounts: number; createdAt: string };

/** Minúsculas y sin acentos: «Núñez» se encuentra escribiendo «nunez». */
export function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

/** Busca en el nombre y en el RUC, y filtra por estado. Una búsqueda vacía no filtra. */
export function filterDirectory(rows: DirectoryRow[], { query, status }: { query: string; status: StatusFilter }): DirectoryRow[] {
  const needle = normalizeText(query);
  return rows.filter((row) => {
    if (status !== "todos" && row.status !== status) return false;
    if (needle === "") return true;
    return normalizeText(row.name).includes(needle) || (row.ruc !== null && normalizeText(row.ruc).includes(needle));
  });
}

export function statusCounts(rows: DirectoryRow[]): Record<StatusFilter, number> {
  return { todos: rows.length, activo: rows.filter((row) => row.status === "activo").length, suspendido: rows.filter((row) => row.status === "suspendido").length };
}
