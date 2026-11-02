import type { Key, ReactNode } from "react";
import { EmptyState } from "./empty-state";
import { Table, Td, Th, THead, Tr } from "./table";

export type Column<T> = { header: string; cell: (row: T) => ReactNode; className?: string };

export type DataTableProps<T> = {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => Key;
  emptyTitle: string;
  emptyHint?: string;
  /**
   * Toda la fila abre el detalle con un clic (solo desde componentes de cliente). Es un atajo para el ratón: la fila debe seguir
   * teniendo un enlace o botón propio para el teclado y los lectores de pantalla, y un clic sobre ese control no se repite aquí.
   */
  onRowClick?: (row: T) => void;
};

const interactive = "a, button, input, select, textarea, label, [role='button']";

export function DataTable<T>({ caption, columns, rows, rowKey, emptyTitle, emptyHint, onRowClick }: DataTableProps<T>) {
  if (rows.length === 0) return <EmptyState title={emptyTitle}>{emptyHint}</EmptyState>;
  return (
    <Table caption={caption}>
      <THead>
        <tr>
          {columns.map((column) => (
            <Th key={column.header} className={column.className}>
              {column.header}
            </Th>
          ))}
        </tr>
      </THead>
      <tbody>
        {rows.map((row) => (
          <Tr
            key={rowKey(row)}
            className={onRowClick ? "cursor-pointer transition-colors duration-200 hover:bg-calido/60" : undefined}
            onClick={onRowClick ? (event) => { if (!(event.target as HTMLElement).closest(interactive)) onRowClick(row); } : undefined}
          >
            {columns.map((column) => (
              <Td key={column.header} className={column.className}>
                {column.cell(row)}
              </Td>
            ))}
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}
