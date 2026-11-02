"use client";

import { createBrowserSupabase } from "@rapitrip/supabase/browser";
import { productImageRules, type ExpressLimits } from "@rapitrip/validation";
import { Alert, Badge, Button, Card, Field, SelectField, TextareaField, buttonStyles, cn } from "@rapitrip/ui";
import { Archive, ArrowLeft, Check, Eye, FileText, ImagePlus, Images, Package, Pencil, Plus, Tags, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { ReasonDialog } from "@/components/reason-dialog";
import type { ActionResult } from "@/lib/action-error";
import { discountAfterChange } from "@/lib/discount";
import { formatMoney } from "@/lib/money";
import { ProductDeliveryCard, type DeliveryProduct } from "./product-delivery-card";
import { SectionHeader } from "./section-header";

type Status = "borrador" | "publicado" | "archivado";
type Product = { id: string; storeId: string; storeName?: string | null; name: string; description: string | null; categoryId: string | null; brandId: string | null; typeId: string | null; status: Status };
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
const statusDot = { borrador: "bg-tinta-suave", publicado: "bg-esmeralda", archivado: "bg-naranja" } as const;

/** Pie de un formulario de la ficha: el aviso a la izquierda y el botón de guardar a la derecha, sobre una línea fina. */
function FormFooter({ message, children }: { message: Message; children: ReactNode }) {
  return (
    <div className="mt-1 flex flex-col gap-3 border-t border-borde pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <Feedback message={message} />
      </div>
      <div className="flex shrink-0 justify-end">{children}</div>
    </div>
  );
}

export function ProductEditor({ product, delivery, limits, variants, images, master, disabled, actions }: { product: Product; delivery: DeliveryProduct; limits: ExpressLimits; variants: Variant[]; images: Image[]; master: Master[]; disabled: boolean; actions: Actions }) {
  const locked = product.status === "archivado";
  return (
    <div className="flex flex-col gap-5">
      <ProductHero product={product} variants={variants} cover={images[0]?.url ?? null} />
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          <DetailsCard product={product} master={master} locked={locked || disabled} update={actions.updateProduct} />
          <VariantsCard product={product} variants={variants} locked={locked || disabled} actions={actions} />
          <ProductDeliveryCard product={delivery} limits={limits} locked={locked || disabled} save={actions.setProductDelivery} />
        </div>
        <div className="flex flex-col gap-5 xl:sticky xl:top-6">
          <StatusCard product={product} hasVariant={variants.some((v) => v.active)} setStatus={actions.setProductStatus} />
          <ImagesCard product={product} images={images} locked={locked || disabled} add={actions.addProductImage} remove={actions.removeProductImage} />
        </div>
      </div>
    </div>
  );
}

/** Cabecera de la ficha: portada, nombre, estado y las cifras que el comercio mira primero (precio y presentaciones). */
function ProductHero({ product, variants, cover }: { product: Product; variants: Variant[]; cover: string | null }) {
  const active = variants.filter((variant) => variant.active);
  const prices = active.map((variant) => variant.price);
  const min = prices.length > 0 ? Math.min(...prices) : null;
  const max = prices.length > 0 ? Math.max(...prices) : null;
  const discounted = active.filter((variant) => variant.discountPct > 0).length;
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-menta to-bruma text-hoja ring-1 ring-borde">
            {cover ? <img src={cover} alt="" className="size-full object-cover" /> : <Package className="size-8" aria-hidden="true" />}
          </span>
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Badge tone={statusTone[product.status]}>{statusLabel[product.status]}</Badge>
              {product.storeName ? <span className="truncate text-[12.5px] text-tinta-suave">{product.storeName}</span> : null}
            </div>
            <h1 className="truncate text-[24px] font-extrabold leading-tight tracking-tight text-tinta">{product.name}</h1>
            {product.description ? <p className="mt-0.5 line-clamp-1 text-[13px] text-tinta-suave">{product.description}</p> : null}
          </div>
        </div>
        <dl className="grid shrink-0 grid-cols-3 gap-2 sm:flex sm:gap-2.5">
          <div className="rounded-2xl bg-crema px-3.5 py-2.5">
            <dt className="text-micro font-bold uppercase text-tinta-suave">Precio</dt>
            <dd className="whitespace-nowrap text-[15px] font-extrabold tabular-nums text-tinta">{min === null ? "—" : min === max ? formatMoney(min) : `desde ${formatMoney(min)}`}</dd>
          </div>
          <div className="rounded-2xl bg-crema px-3.5 py-2.5">
            <dt className="text-micro font-bold uppercase text-tinta-suave">Variantes</dt>
            <dd className="text-[15px] font-extrabold tabular-nums text-tinta">
              {active.length}
              <span className="text-[12px] font-semibold text-tinta-suave"> de {variants.length}</span>
            </dd>
          </div>
          <div className="rounded-2xl bg-crema px-3.5 py-2.5">
            <dt className="text-micro font-bold uppercase text-tinta-suave">En descuento</dt>
            <dd className="text-[15px] font-extrabold tabular-nums text-tinta">{discounted}</dd>
          </div>
        </dl>
      </div>
    </Card>
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
    <Card className="p-5 sm:p-6">
      <SectionHeader icon={<FileText className="size-[18px]" />} title="Datos del producto" subtitle="Lo que el cliente lee en la tienda: un nombre claro y una descripción corta." />
      <form onSubmit={save} className="flex flex-col gap-4" noValidate>
        <fieldset disabled={locked} className="flex flex-col gap-4">
          <Field label="Nombre" value={values.name} onChange={set("name")} maxLength={120} required />
          <TextareaField label="Descripción" value={values.description} onChange={set("description")} maxLength={1000} rows={3} />
          <div className="rounded-panel bg-crema/70 p-4 ring-1 ring-borde">
            <p className="mb-3 flex items-center gap-2 text-[12.5px] font-bold text-tinta">
              Clasificación
              <span className="rounded-full bg-papel px-2 py-0.5 text-[10.5px] font-bold text-tinta-suave ring-1 ring-borde">Opcional</span>
            </p>
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
          </div>
        </fieldset>
        <FormFooter message={message}>
          <Button variant="primary" type="submit" disabled={pending || locked || values.name.trim().length < 2}>
            <Check className="size-4" aria-hidden="true" />
            {pending ? "Guardando…" : "Guardar datos"}
          </Button>
        </FormFooter>
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

  const explanation =
    product.status === "publicado"
      ? "Visible para los clientes cuando la tienda esté abierta."
      : product.status === "archivado"
        ? "Archivado: no se edita ni vuelve a publicarse. Crea un producto nuevo si lo necesitas."
        : hasVariant
          ? "Listo para publicar: tiene al menos una variante activa."
          : "Agrega al menos una variante activa para poder publicar.";

  return (
    <Card className="p-5">
      <SectionHeader icon={<Eye className="size-[18px]" />} tone="lavanda" title="Publicación" />
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3 rounded-panel bg-crema/70 p-3.5 ring-1 ring-borde">
          <span aria-hidden="true" className="relative mt-1 flex size-2.5 shrink-0">
            {product.status === "publicado" ? <span className="absolute inline-flex size-full animate-ping rounded-full bg-esmeralda opacity-60 motion-reduce:hidden" /> : null}
            <span className={cn("relative inline-flex size-2.5 rounded-full", statusDot[product.status])} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-tinta">{statusLabel[product.status]}</p>
            <p className="text-[12.5px] leading-snug text-tinta-suave">{explanation}</p>
          </div>
        </div>
        {product.status === "borrador" ? (
          <Button variant="primary" onClick={() => change("publicado")} disabled={pending || !hasVariant} className="w-full">
            Publicar
          </Button>
        ) : null}
        {product.status === "publicado" ? (
          <Button variant="secondary" onClick={() => change("borrador")} disabled={pending} className="w-full">
            Pasar a borrador
          </Button>
        ) : null}
        <Feedback message={message} />
        {product.status !== "archivado" ? (
          <button
            type="button"
            onClick={() => setArchive(true)}
            disabled={pending}
            className="mt-1 inline-flex items-center justify-center gap-1.5 self-center rounded-full px-3 py-1.5 text-[12.5px] font-bold text-rojo transition-colors hover:bg-rosa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja disabled:opacity-60"
          >
            <Archive className="size-3.5" aria-hidden="true" />
            Archivar producto
          </button>
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
    <Card className="p-5 sm:p-6">
      <SectionHeader
        icon={<Tags className="size-[18px]" />}
        title="Variantes y precios"
        subtitle="Cada presentación tiene su precio y su SKU (único en la tienda). Sin una variante activa no se puede publicar."
        actions={variants.length > 0 ? <span className="rounded-full bg-menta px-2.5 py-1 text-[12px] font-extrabold tabular-nums text-hoja">{variants.length}</span> : null}
      />
      {variants.length === 0 ? (
        <div className="mb-4 rounded-panel border border-dashed border-borde-campo px-4 py-6 text-center">
          <p className="text-sm font-bold text-tinta">Sin variantes</p>
          <p className="text-[12.5px] text-tinta-suave">Agrega la primera abajo: por ejemplo «Bolsa 500 g».</p>
        </div>
      ) : (
        <ul className="mb-4 flex flex-col gap-2">
          {variants.map((variant) => (
            <VariantRow key={variant.id} productId={product.id} variant={variant} locked={locked} actions={actions} />
          ))}
        </ul>
      )}
      {!locked ? (
        <form onSubmit={add} className="flex flex-col gap-3 rounded-panel bg-calido/60 p-4 ring-1 ring-durazno" noValidate>
          <p className="flex items-center gap-2 text-[12.5px] font-bold text-tinta">
            <Plus className="size-4 text-durazno-texto" aria-hidden="true" />
            Nueva variante
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <Field label="Nombre de la variante" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            <Field label="SKU" value={sku} onChange={(e) => setSku(e.target.value)} maxLength={40} />
            <Field label="Precio" type="number" inputMode="decimal" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            <Button variant="secondary" type="submit" disabled={pending || !name.trim() || sku.trim().length < 2 || price === ""}>
              <Plus className="size-4" aria-hidden="true" />
              Agregar variante
            </Button>
          </div>
          <Feedback message={message} />
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
      <li className="rounded-panel bg-papel p-4 ring-2 ring-hoja/30">
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
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setEditing(false); setError(null); setValues({ name: variant.name, sku: variant.sku, price: String(variant.price) }); }}>
              <X className="size-4" aria-hidden="true" />
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={pending}>
              <Check className="size-4" aria-hidden="true" />
              Guardar
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className={cn("rounded-panel bg-papel px-4 py-3 ring-1 ring-borde transition-colors hover:ring-menta-borde", !variant.active && "bg-crema/60")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", variant.active ? "bg-esmeralda" : "bg-borde-campo")} />
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-bold text-tinta">
              <span className={cn("truncate", !variant.active && "text-tinta-suave")}>{variant.name}</span>
              {!variant.active ? <Badge tone="warning">Inactiva</Badge> : null}
            </p>
            <p className="font-mono text-[11.5px] text-tinta-suave">SKU {variant.sku}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="mr-1.5 flex items-center gap-2">
            {variant.discountPct > 0 && variant.compareAt !== null ? (
              <>
                <span className="text-xs tabular-nums text-tinta-suave line-through">{formatMoney(variant.compareAt)}</span>
                <Badge tone="positive">-{variant.discountPct} %</Badge>
              </>
            ) : null}
            <span className="text-[15px] font-extrabold tabular-nums text-tinta">{formatMoney(variant.price)}</span>
          </div>
          {!locked ? (
            <>
              {variant.discountPct > 0 ? (
                <Button variant="ghost" onClick={dropDiscount} disabled={pending} className="min-h-9 px-3 text-[12.5px]">
                  Quitar descuento
                </Button>
              ) : null}
              <Button variant="ghost" onClick={() => setEditing(true)} aria-label={`Editar ${variant.name}`} className="min-h-9 px-2.5">
                <Pencil className="size-4" aria-hidden="true" />
              </Button>
              <Button variant="ghost" onClick={toggle} disabled={pending} className={cn("min-h-9 px-3 text-[12.5px]", variant.active && "text-tinta-suave hover:bg-crema")}>
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
      <SectionHeader
        icon={<Images className="size-[18px]" />}
        tone="durazno"
        title="Imágenes"
        subtitle={`Hasta ${productImageRules.maxCount}, JPEG, PNG o WebP de máximo 2 MB. La primera es la portada.`}
        actions={<span className="text-[12px] font-bold tabular-nums text-tinta-suave">{images.length}/{productImageRules.maxCount}</span>}
      />
      <ul className="grid grid-cols-3 gap-2.5">
        {images.map((image, index) => (
          <li key={image.id} className={cn("group relative aspect-square overflow-hidden rounded-2xl bg-calido ring-1 ring-borde", index === 0 && "col-span-2 row-span-2")}>
            <img src={image.url} alt={`Imagen ${index + 1} de ${product.name}`} className="size-full object-cover" loading="lazy" />
            {index === 0 ? <span className="absolute left-2 top-2 rounded-full bg-selva/80 px-2 py-0.5 text-[10px] font-bold text-white">Portada</span> : null}
            {!locked ? (
              <button type="button" onClick={() => drop(image)} disabled={pending} aria-label={`Eliminar imagen ${index + 1}`} className="absolute bottom-1.5 right-1.5 flex size-8 items-center justify-center rounded-full bg-papel text-rojo shadow-suave transition-transform duration-500 ease-fluido active:scale-95 focus-visible:outline-2 focus-visible:outline-hoja">
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            ) : null}
          </li>
        ))}
        {!locked && !full ? (
          <li className={cn(images.length === 0 ? "col-span-3" : "aspect-square")}>
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={pending}
              className={cn(
                "flex size-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-borde-campo bg-crema/50 text-hoja transition-colors hover:border-hoja hover:bg-menta/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja disabled:opacity-60",
                images.length === 0 && "py-8",
              )}
            >
              <ImagePlus className={images.length === 0 ? "size-7" : "size-5"} aria-hidden="true" />
              <span className="text-[12px] font-bold">{pending ? "Subiendo…" : "Agregar imagen"}</span>
              {images.length === 0 ? <span className="text-[11.5px] font-medium text-tinta-suave">Todavía no hay imágenes</span> : null}
            </button>
          </li>
        ) : null}
      </ul>
      {locked && images.length === 0 ? <p className="text-[13px] text-tinta-suave">Todavía no hay imágenes.</p> : null}
      <input ref={input} type="file" accept={productImageRules.types.join(",")} className="sr-only" tabIndex={-1} aria-label="Elegir imagen" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
      {message ? <div className="mt-3"><Feedback message={message} /></div> : null}
      {full && !locked ? <p className="mt-3 text-[12px] text-tinta-suave">Límite alcanzado: elimina una para subir otra.</p> : null}
    </Card>
  );
}

/** Volver al catálogo de la tienda del producto, encima de la ficha. */
export function BackToCatalog({ storeId }: { storeId: string }) {
  return (
    <Link href={`/comercio/catalogo?tienda=${storeId}`} className={buttonStyles({ variant: "ghost", className: "-ml-3 mb-3 min-h-9 px-3 text-[13px]" })}>
      <ArrowLeft className="size-4" aria-hidden="true" />
      Catálogo
    </Link>
  );
}
