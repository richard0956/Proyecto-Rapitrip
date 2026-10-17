import type { Key, ReactNode } from "react";
import { cn } from "./cn";
import { EmptyState } from "./empty-state";

export type Column<T> = { header: string; cell: (row: T) => ReactNode; className?: string };

export type DataTableProps<T> = {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => Key;
  emptyTitle: string;
  emptyHint?: string;
};

/** Tabla densa (filas de 40 px). El título va como `caption` para lectores de pantalla. */
export function DataTable<T>({ caption, columns, rows, rowKey, emptyTitle, emptyHint }: DataTableProps<T>) {
  if (rows.length === 0) return <EmptyState title={emptyTitle}>{emptyHint}</EmptyState>;
  return (
    <div className="overflow-x-auto rounded-tarjeta border border-borde bg-papel">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-borde bg-calido">
            {columns.map((column) => (
              <th key={column.header} scope="col" className={cn("h-10 px-4 font-extrabold text-tinta", column.className)}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="h-10 border-b border-borde last:border-b-0">
              {columns.map((column) => (
                <td key={column.header} className={cn("px-4 py-1.5 text-tinta", column.className)}>
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
