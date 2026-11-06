import type { CatalogReport, CatalogReviewEntry, Recurrence, StaleCatalog } from "@/components/catalog-control";
import { formatDate, formatDateTime } from "./format";
import type { serverSupabase } from "./supabase";

type Client = Awaited<ReturnType<typeof serverSupabase>>;

/** Lo que muestra el control de catálogos. Las reincidencias solo las carga la administración. */
export async function loadCatalogControl(supabase: Client, { withRecurrences }: { withRecurrences: boolean }) {
  const [reports, stale, status, reviews, recurrences] = await Promise.all([
    supabase.rpc("catalog_reports_for_ops"),
    supabase.rpc("stale_catalogs"),
    supabase.rpc("catalog_review_status"),
    supabase.rpc("catalog_reviews"),
    withRecurrences ? supabase.rpc("catalog_recurrences") : Promise.resolve({ data: null, error: null }),
  ]);
  const errors = [reports, stale, status, reviews, recurrences].flatMap((r) => (r.error ? [r.error.message] : []));
  if (errors.length > 0) console.error("[control-catalogo]", errors.join(" | "));

  const reviewStatus = (status.data ?? {}) as { last_at?: string | null; due_at?: string; overdue?: boolean };
  return {
    failed: errors.length > 0,
    reports: (reports.data ?? []).map(
      (r): CatalogReport => ({
        id: r.id,
        commerce: r.commerce_name,
        store: r.store_name,
        product: r.product_name,
        source: r.source === "equipo" ? "equipo" : "cliente",
        kind: r.kind,
        description: r.description,
        status: r.status as CatalogReport["status"],
        createdAt: formatDateTime(r.created_at),
        createdIso: r.created_at,
        reviewNote: r.review_note,
        fixDueIso: r.fix_due_at,
        correctionNote: r.correction_note,
      }),
    ),
    stale: (stale.data ?? []).map((r): StaleCatalog => ({ commerceId: r.commerce_id, name: r.name, lastUpdate: r.last_update ? formatDate(r.last_update) : null, days: r.days })),
    history: (reviews.data ?? []).map(
      (r): CatalogReviewEntry => ({ id: r.id, reviewedAt: formatDateTime(r.reviewed_at), reviewer: r.reviewer_name ?? "Equipo", found: Array.isArray(r.stale) ? r.stale.length : 0, notes: r.notes }),
    ),
    reviewStatus: { lastAt: reviewStatus.last_at ? formatDateTime(reviewStatus.last_at) : null, dueAt: formatDate(reviewStatus.due_at), overdue: reviewStatus.overdue ?? true },
    recurrences: recurrences.data
      ? recurrences.data.map((r): Recurrence => ({ commerceId: r.commerce_id, commerce: r.commerce_name, confirmed: r.confirmed, flaggedIso: r.flagged_at, lastMeasure: r.last_measure }))
      : null,
  };
}
