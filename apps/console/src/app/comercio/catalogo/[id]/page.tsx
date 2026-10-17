import { Alert, buttonStyles } from "@rapitrip/ui";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/shell";
import { requireConsoleAccess } from "@/lib/guard";
import { productImageUrl } from "@/lib/money";
import { serverSupabase } from "@/lib/supabase";
import { addProductImage, createVariant, removeProductImage, setProductStatus, setVariantStatus, updateProduct, updateVariant } from "../actions";
import { ProductEditor } from "./product-editor";

export default async function ProductoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  await requireConsoleAccess("comercio");
  const supabase = await serverSupabase();
  const [product, variants, images, master] = await Promise.all([
    supabase.from("products_list").select("*").eq("id", id).maybeSingle(),
    supabase.from("product_variants_list").select("id, name, sku, price, status").eq("product_id", id).order("name"),
    supabase.from("product_images_list").select("id, path, position").eq("product_id", id).order("position"),
    supabase.from("master_items_list").select("id, kind, name, parent_name").eq("status", "activo").order("name"),
  ]);
  if (!product.data || !product.data.id || !product.data.name || !product.data.store_id) notFound();
  const failed = variants.error || images.error || master.error;
  if (failed) console.error("[producto]", variants.error?.message, images.error?.message, master.error?.message);
  const status = product.data.status === "publicado" || product.data.status === "archivado" ? product.data.status : "borrador";

  return (
    <>
      <PageHeader
        title={product.data.name}
        description={`Tienda: ${product.data.store_name ?? "—"}`}
        actions={
          <Link href={`/comercio/catalogo?tienda=${product.data.store_id}`} className={buttonStyles({ variant: "ghost" })}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Catálogo
          </Link>
        }
      />
      {failed ? <Alert tone="error" className="mb-5">No pudimos cargar todo el producto. Recarga la página antes de editar.</Alert> : null}
      <ProductEditor
        product={{
          id: product.data.id,
          storeId: product.data.store_id,
          name: product.data.name,
          description: product.data.description,
          categoryId: product.data.category_id,
          brandId: product.data.brand_id,
          typeId: product.data.product_type_id,
          status,
        }}
        variants={(variants.data ?? []).flatMap((row) => (row.id && row.name && row.sku ? [{ id: row.id, name: row.name, sku: row.sku, price: Number(row.price ?? 0), active: row.status !== "inactiva" }] : []))}
        images={(images.data ?? []).flatMap((row) => (row.id && row.path ? [{ id: row.id, url: productImageUrl(row.path) ?? "" }] : []))}
        master={(master.data ?? []).flatMap((row) => (row.id && row.name && (row.kind === "categoria" || row.kind === "marca" || row.kind === "tipo_producto") ? [{ id: row.id, kind: row.kind, name: row.parent_name ? `${row.parent_name} › ${row.name}` : row.name }] : []))}
        disabled={Boolean(failed)}
        actions={{ updateProduct, setProductStatus, createVariant, updateVariant, setVariantStatus, addProductImage, removeProductImage }}
      />
    </>
  );
}
