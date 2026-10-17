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
};

export function DataTable<T>({ caption, columns, rows, rowKey, emptyTitle, emptyHint }: DataTableProps<T>) {
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
          <Tr key={rowKey(row)}>
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
