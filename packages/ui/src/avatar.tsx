import { cn } from "./cn";

const sizes = { sm: "size-9 text-xs", md: "size-10 text-sm" } as const;

export function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "·";
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase();
}

export function Avatar({ name, size = "md", tone = "light", className }: { name: string | null | undefined; size?: keyof typeof sizes; tone?: "light" | "dark"; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("flex shrink-0 items-center justify-center rounded-full font-bold", sizes[size], tone === "dark" ? "bg-esmeralda text-selva" : "bg-menta text-hoja", className)}
    >
      {initials(name)}
    </span>
  );
}
