"use client";

import { CodeInput } from "@rapitrip/ui";

/** Código de 4 dígitos que da el comercio (recogida) o el cliente (entrega). */
export function CodeField({ label, value, onChange, error }: { label: string; value: string; onChange: (value: string) => void; error?: string }) {
  return <CodeInput label={label} value={value} onChange={onChange} length={4} error={error} />;
}
