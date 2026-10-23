"use client";

import { createBrowserSupabase } from "@rapitrip/supabase/browser";
import { productImageRules, type ExpressLimits } from "@rapitrip/validation";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Field, SelectField, TextareaField } from "@rapitrip/ui";
import { Check, ImagePlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { ReasonDialog } from "@/components/reason-dialog";
import type { ActionResult } from "@/lib/action-error";
import { discountAfterChange } from "@/lib/discount";
import { formatMoney } from "@/lib/money";
import { ProductDeliveryCard, type DeliveryProduct } from "./product-delivery-card";

type Status = "borrador" | "publicado" | "archivado";
type Product = { id: string; storeId: string; name: string; description: string | null; categoryId: string | null; brandId: string | null; typeId: string | null; status: Status };
type Variant = { id: string; name: string; sku: string; price: number; compareAt: number | null; discountPct: number; active: boolean };
type Image = { id: string; url: string };
type Master = { id: string; kind: "categoria" | "marca" | "tipo_producto"; name: string };

type Actions = {
  setProductDelivery: (id: string, input: unknown) => Promise<ActionResult>;
  removeVariantDiscount: (productId: string, variantId: string) => Promise<ActionResult>;
  updateProduct: (id: string, input: unknown) => Promise<ActionResult>;
  setProductStatus: (id: string, input: { status: Status; reason?: string }) => Promise<ActionResult>;
  createVariant: (productId: string, input: unknown) => Promise<ActionResult>;
  updateVariant: (productId: string, variantId: string, input: unknown) => Promise<ActionResult>;
  setVariantStatus: (productId: string, variantId: string, status: "activa" | "inactiva") => Promise<ActionResult>;
  addProductImage: (productId: string, path: string) => Promise<ActionResult>;
  removeProductImage: (productId: string, imageId: string) => Promise<ActionResult>;
};

type Message = { ok: boolean; text: string } | null;
const Feedback = ({ message }: { message: Message }) => (message ? <Alert tone={message.ok ? "info" : "error"}>{message.text}</Alert> : null);

const statusLabel = { borrador: "Borrador", publicado: "Publicado", archivado: "Archivado" } as const;
const statusTone = { borrador: "neutral", publicado: "positive", archivado: "warning" } as const;

export function ProductEditor({ product, delivery, limits, variants, images, master, disabled, actions }: { product: Product; delivery: DeliveryProduct; limits: ExpressLimits; variants: Variant[]; images: Image[]; master: Master[]; disabled: boolean; actions: Actions }) {
  const locked = product.status === "archivado";
  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex flex-col gap-5">
        <DetailsCard product={product} master={master} locked={locked || disabled} update={actions.updateProduct} />
        <ProductDeliveryCard product={delivery} limits={limits} locked={locked || disabled} save={actions.setProductDelivery} />
        <VariantsCard product={product} variants={variants} locked={locked || disabled} actions={actions} />
      </div>
      <div className="flex flex-col gap-5">
        <StatusCard product={product} hasVariant={variants.some((v) => v.active)} setStatus={actions.setProductStatus} />
        <ImagesCard product={product} images={images} locked={locked || disabled} add={actions.addProductImage} remove={actions.removeProductImage} />
      </div>
    </div>
  );
}

function DetailsCard({ product, master, locked, update }: { product: Product; master: Master[]; locked: boolean; update: Actions["updateProduct"] }) {
  const router = useRouter();
  const [values, setValues] = useState({ name: product.name, description: product.description ?? "", category_id: product.categoryId ?? "", brand_id: product.brandId ?? "", product_type_id: product.typeId ?? "" });
  const [message, setMessage] = useState<Message>(null);
  const [pending, start] = useTransition();
  const set = (key: keyof typeof values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }));
  const of = (kind: Master["kind"]) => master.filter((item) => item.kind === kind);

  function save(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    start(async () => {
      const result = await update(product.id, values);
      setMessage(result.ok ? { ok: true, text: "Datos guardados." } : { ok: false, text: result.error });
      if (result.ok) router.refresh();
    });
  }

  return (
    <Card className="p-5">
      <CardHeader title="Datos del producto" subtitle="La clasificación es opcional: ayuda a ordenar el catálogo, pero no es obligatoria para publicar." />
      <form onSubmit={save} className="flex flex-col gap-3.5" noValidate>
        <fieldset disabled={locked} className="flex flex-col gap-3.5">
          <Field label="Nombre" value={values.name} onChange={set("name")} maxLength={120} required />
          <TextareaField label="Descripción" value={values.description} onChange={set("description")} maxLength={1000} rows={3} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SelectField label="Categoría" value={values.category_id} onChange={set("category_id")}>
              <option value="">Sin categoría</option>
              {of("categoria").map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </SelectField>
            <SelectField label="Marca" value={values.brand_id} onChange={set("brand_id")}>
              <option value="">Sin marca</option>
              {of("marca").map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </SelectField>
            <SelectField label="Tipo de producto" value={values.product_type_id} onChange={set("product_type_id")}>
              <option value="">Sin tipo</option>
              {of("tipo_producto").map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </SelectField>
          </div>
        </fieldset>
        <Feedback message={message} />
        <Button variant="primary" type="submit" disabled={pending || locked || values.name.trim().length < 2} className="self-start">
          <Check className="size-4" aria-hidden="true" />
          {pending ? "Guardando…" : "Guardar datos"}
        </Button>
      </form>
    </Card>
  );
}

function StatusCard({ product, hasVariant, setStatus }: { product: Product; hasVariant: boolean; setStatus: Actions["setProductStatus"] }) {
  const router = useRouter();
  const [message, setMessage] = useState<Message>(null);
  const [archive, setArchive] = useState(false);
  const [pending, start] = useTransition();

  function change(status: Status) {
    setMessage(null);
    start(async () => {
      const result = await setStatus(product.id, { status });
      setMessage(result.ok ? { ok: true, text: status === "publicado" ? "Producto publicado." : "Producto en borrador." } : { ok: false, text: result.error });
      if (result.ok) router.refresh();
    });
  }

  return (
    <Card className="p-5">
      <CardHeader title="Publicación" actions={<Badge tone={statusTone[product.status]}>{statusLabel[product.status]}</Badge>} />
      <div className="flex flex-col gap-3">
        {product.status === "borrador" ? (
          <>
            <p className="text-[12.5px] text-tinta-suave">{hasVariant ? "Listo para publicar: tiene al menos una variante activa." : "Agrega al menos una variante activa para poder publicar."}</p>
            <Button variant="primary" onClick={() => change("publicado")} disabled={pending || !hasVariant} className="self-start">
              Publicar
            </Button>
          </>
        ) : null}
        {product.status === "publicado" ? (
          <>
            <p className="text-[12.5px] text-tinta-suave">Visible para los clientes cuando la tienda esté abierta.</p>
            <Button variant="secondary" onClick={() => change("borrador")} disabled={pending} className="self-start">
              Pasar a borrador
            </Button>
          </>
        ) : null}
        {product.status === "archivado" ? <p className="text-[12.5px] text-tinta-suave">Archivado: no se edita ni vuelve a publicarse. Crea un producto nuevo si lo necesitas.</p> : null}
        <Feedback message={message} />
        {product.status !== "archivado" ? (
          <>
            <hr className="border-borde" />
            <Button variant="danger" onClick={() => setArchive(true)} disabled={pending} className="self-start">
              Archivar producto
            </Button>
          </>
        ) : null}
      </div>
      <ReasonDialog
        open={archive}
        onClose={() => setArchive(false)}
        title="Archivar producto"
        description={`«${product.name}» dejará de mostrarse y no podrá volver a publicarse.`}
        confirmLabel="Archivar"
        danger
        onConfirm={(reason) => setStatus(product.id, { status: "archivado", reason })}
      />
    </Card>
  );
}

function VariantsCard({ product, variants, locked, actions }: { product: Product; variants: Variant[]; locked: boolean; actions: Actions }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [message, setMessage] = useState<Message>(null);
  const [pending, start] = useTransition();

  function add(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    start(async () => {
      const result = await actions.createVariant(product.id, { name, sku, price: Number(price) });
      if (!result.ok) return setMessage({ ok: false, text: result.error });
      setName("");
      setSku("");
      setPrice("");
      setMessage({ ok: true, text: "Variante agregada." });
      router.refresh();
    });
  }

  return (
    <Card className="p-5">
      <CardHeader title="Variantes" subtitle="Cada variante tiene su precio y su SKU (único en la tienda). Un producto sin variantes no se puede publicar." />
      {variants.length === 0 ? (
        <EmptyState title="Sin variantes">Agrega la primera abajo: por ejemplo «Bolsa 500 g».</EmptyState>
      ) : (
        <ul className="mb-4 flex flex-col divide-y divide-borde">
          {variants.map((variant) => (
            <VariantRow key={variant.id} productId={product.id} variant={variant} locked={locked} actions={actions} />
          ))}
        </ul>
      )}
      {!locked ? (
        <form onSubmit={add} className="flex flex-col gap-3 rounded-panel bg-calido/50 p-4" noValidate>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <Field label="Nombre de la variante" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            <Field label="SKU" value={sku} onChange={(e) => setSku(e.target.value)} maxLength={40} />
            <Field label="Precio" type="number" inputMode="decimal" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <Feedback message={message} />
          <Button variant="secondary" type="submit" disabled={pending || !name.trim() || sku.trim().length < 2 || price === ""} className="self-start">
            <Plus className="size-4" aria-hidden="true" />
            Agregar variante
          </Button>
        </form>
      ) : null}
    </Card>
  );
}

function VariantRow({ productId, variant, locked, actions }: { productId: string; variant: Variant; locked: boolean; actions: Actions }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState({ name: variant.name, sku: variant.sku, price: String(variant.price) });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Avisa antes de guardar si el precio nuevo activa, cambia o quita un descuento (la base de datos aplica la misma regla).
  const typed = values.price.trim() === "" ? NaN : Number(values.price);
  const next = Number.isFinite(typed) && typed >= 0 ? discountAfterChange({ price: variant.price, compareAt: variant.compareAt }, typed) : null;
  const preview = next && (next.pct > 0 || variant.discountPct > 0) && (next.compareAt !== variant.compareAt || next.pct !== variant.discountPct) ? next : null;

  function dropDiscount() {
    setError(null);
    start(async () => {
      const result = await actions.removeVariantDiscount(productId, variant.id);
      if (!result.ok) return setError(result.error);
      router.refresh();
    });
  }

  function save(event: FormEvent) {
    event.preventDefault();
    setError(null);
    start(async () => {
      const result = await actions.updateVariant(productId, variant.id, { name: values.name, sku: values.sku, price: Number(values.price) });
      if (!result.ok) return setError(result.error);
      setEditing(false);
      router.refresh();
    });
  }

  function toggle() {
    setError(null);
    start(async () => {
      const result = await actions.setVariantStatus(productId, variant.id, variant.active ? "inactiva" : "activa");
      if (!result.ok) return setError(result.error);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <li className="py-3">
        <form onSubmit={save} className="flex flex-col gap-3" noValidate>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <Field label="Nombre" value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} maxLength={80} />
            <Field label="SKU" value={values.sku} onChange={(e) => setValues((v) => ({ ...v, sku: e.target.value }))} maxLength={40} />
            <Field label="Precio" type="number" inputMode="decimal" min="0" step="0.01" value={values.price} onChange={(e) => setValues((v) => ({ ...v, price: e.target.value }))} />
          </div>
          {preview ? (
            <Alert tone="info">
              {preview.pct > 0
                ? `Con este precio la presentación queda en descuento: -${preview.pct} % (antes ${formatMoney(preview.compareAt ?? 0)}). Se mostrará en el catálogo como producto con descuento.`
                : "Con este precio se quita el descuento de la presentación."}
            </Alert>
          ) : null}
          {error ? <Alert tone="error">{error}</Alert> : null}
          <div className="flex gap-2">
            <Button variant="primary" type="submit" disabled={pending}>
              <Check className="size-4" aria-hidden="true" />
              Guardar
            </Button>
            <Button variant="ghost" onClick={() => { setEditing(false); setError(null); setValues({ name: variant.name, sku: variant.sku, price: String(variant.price) }); }}>
              <X className="size-4" aria-hidden="true" />
              Cancelar
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-bold text-tinta">
            <span className="truncate">{variant.name}</span>
            {!variant.active ? <Badge tone="warning">Inactiva</Badge> : null}
          </p>
          <p className="text-xs text-tinta-suave">SKU {variant.sku}</p>
        </div>
        <div className="flex items-center gap-2">
          {variant.discountPct > 0 && variant.compareAt !== null ? (
            <>
              <span className="text-xs tabular-nums text-tinta-suave line-through">{formatMoney(variant.compareAt)}</span>
              <Badge tone="positive">-{variant.discountPct} %</Badge>
            </>
          ) : null}
          <span className="text-sm font-bold tabular-nums text-tinta">{formatMoney(variant.price)}</span>
          {!locked ? (
            <>
              {variant.discountPct > 0 ? (
                <Button variant="ghost" onClick={dropDiscount} disabled={pending} className="min-h-10 px-3">
                  Quitar descuento
                </Button>
              ) : null}
              <Button variant="ghost" onClick={() => setEditing(true)} aria-label={`Editar ${variant.name}`} className="min-h-10 px-3">
                <Pencil className="size-4" aria-hidden="true" />
              </Button>
              <Button variant="ghost" onClick={toggle} disabled={pending} className="min-h-10 px-3">
                {variant.active ? "Desactivar" : "Activar"}
              </Button>
            </>
          ) : null}
        </div>
      </div>
      {error ? <Alert tone="error" className="mt-2">{error}</Alert> : null}
    </li>
  );
}

function ImagesCard({ product, images, locked, add, remove }: { product: Product; images: Image[]; locked: boolean; add: Actions["addProductImage"]; remove: Actions["removeProductImage"] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<Message>(null);
  const [pending, start] = useTransition();
  const full = images.length >= productImageRules.maxCount;
  const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

  function upload(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    if (!(productImageRules.types as readonly string[]).includes(file.type)) return setMessage({ ok: false, text: "Usa una imagen JPEG, PNG o WebP." });
    if (file.size > productImageRules.maxBytes) return setMessage({ ok: false, text: "La imagen pesa más de 2 MB." });
    start(async () => {
      const supabase = createBrowserSupabase();
      const path = `${product.storeId}/${product.id}/${crypto.randomUUID()}.${extensions[file.type]}`;
      const uploaded = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type, cacheControl: "3600", upsert: false });
      if (uploaded.error) return setMessage({ ok: false, text: "No pudimos subir la imagen. Revisa tu sesión e inténtalo de nuevo." });
      const result = await add(product.id, path);
      if (!result.ok) {
        await supabase.storage.from("product-images").remove([path]);
        return setMessage({ ok: false, text: result.error });
      }
      setMessage({ ok: true, text: "Imagen agregada." });
      router.refresh();
    });
  }

  function drop(image: Image) {
    setMessage(null);
    start(async () => {
      const result = await remove(product.id, image.id);
      setMessage(result.ok ? { ok: true, text: "Imagen eliminada." } : { ok: false, text: result.error });
      if (result.ok) router.refresh();
    });
  }

  return (
    <Card className="p-5">
      <CardHeader title="Imágenes" subtitle={`Hasta ${productImageRules.maxCount}, JPEG, PNG o WebP de máximo 2 MB. La primera es la portada.`} />
      {images.length > 0 ? (
        <ul className="mb-4 grid grid-cols-3 gap-2.5">
          {images.map((image, index) => (
            <li key={image.id} className="group relative aspect-square overflow-hidden rounded-2xl bg-calido ring-1 ring-borde">
              <img src={image.url} alt={`Imagen ${index + 1} de ${product.name}`} className="size-full object-cover" loading="lazy" />
              {index === 0 ? <span className="absolute left-1.5 top-1.5 rounded-full bg-selva/80 px-2 py-0.5 text-[10px] font-bold text-white">Portada</span> : null}
              {!locked ? (
                <button type="button" onClick={() => drop(image)} disabled={pending} aria-label={`Eliminar imagen ${index + 1}`} className="absolute bottom-1.5 right-1.5 flex size-8 items-center justify-center rounded-full bg-papel text-rojo shadow-suave transition-transform duration-500 ease-fluido active:scale-95 focus-visible:outline-2 focus-visible:outline-hoja">
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-[13px] text-tinta-suave">Todavía no hay imágenes.</p>
      )}
      <input ref={input} type="file" accept={productImageRules.types.join(",")} className="sr-only" tabIndex={-1} aria-label="Elegir imagen" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
      <Feedback message={message} />
      {!locked ? (
        <Button variant="secondary" onClick={() => input.current?.click()} disabled={pending || full} className="mt-3 self-start">
          <ImagePlus className="size-4" aria-hidden="true" />
          {pending ? "Subiendo…" : full ? "Límite alcanzado" : "Agregar imagen"}
        </Button>
      ) : null}
    </Card>
  );
}
