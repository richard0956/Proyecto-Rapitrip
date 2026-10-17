"""
Genera las variantes del logo de Rapitrip a partir de los originales en brand/source/.

  python3 scripts/build-brand-assets.py

Requiere Pillow. Escribe en apps/console/public y apps/store/public (los dos sitios sirven los mismos archivos)
y los iconos de aplicación en apps/*/src/app.
"""
from pathlib import Path

from PIL import Image, ImageDraw
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "brand" / "source"
APPS = [ROOT / "apps" / "console", ROOT / "apps" / "store"]

CREMA = (255, 247, 237)
TINTA = (11, 29, 36)  # el trazo oscuro del propio logo
BLANCO = (255, 255, 255)


def load(name: str) -> Image.Image:
    return Image.open(SRC / name).convert("RGBA")


def crop_to_content(im: Image.Image, pad: int = 0) -> Image.Image:
    box = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    im = im.crop(box)
    if pad:
        out = Image.new("RGBA", (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0))
        out.paste(im, (pad, pad))
        return out
    return im


def tint(im: Image.Image, rgb: tuple[int, int, int]) -> Image.Image:
    """Mismo contorno (canal alfa) con un solo color: sirve para pasar un logo negro a blanco o a tinta."""
    a = np.array(im)
    a[..., 0], a[..., 1], a[..., 2] = rgb
    return Image.fromarray(a, "RGBA")


def fit_width(im: Image.Image, width: int) -> Image.Image:
    return im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)


def fit_height(im: Image.Image, height: int) -> Image.Image:
    return im.resize((round(im.width * height / im.height), height), Image.LANCZOS)


def save_webp(im: Image.Image, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "WEBP", quality=92, method=6)


def on_square(mark: Image.Image, size: int, bg: tuple[int, int, int] | None, scale: float, radius: float = 0.0) -> Image.Image:
    """Emblema centrado en un cuadrado. `scale` es la fracción del lado que ocupa el emblema (0.6 deja margen de seguridad)."""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    if bg is not None:
        base = Image.new("RGBA", (size, size), bg + (255,))
        if radius:
            mask = Image.new("L", (size * 4, size * 4), 0)
            ImageDraw.Draw(mask).rounded_rectangle((0, 0, size * 4 - 1, size * 4 - 1), radius=int(size * 4 * radius), fill=255)
            base.putalpha(mask.resize((size, size), Image.LANCZOS))
        canvas = base
    m = fit_height(mark, round(size * scale))
    if m.width > size * scale:
        m = fit_width(mark, round(size * scale))
    canvas.alpha_composite(m, ((size - m.width) // 2, (size - m.height) // 2))
    return canvas


def main():
    emblem = crop_to_content(load("emblema.webp"))
    wordmark = crop_to_content(load("wordmark-negro.png"))
    tagline = crop_to_content(load("lema.webp"))
    lockup = crop_to_content(load("logo-completo.webp"))

    for app in APPS:
        brand = app / "public" / "brand"
        save_webp(fit_height(emblem, 192), brand / "emblema-192.webp")
        save_webp(fit_height(emblem, 768), brand / "emblema-768.webp")
        save_webp(fit_width(tint(wordmark, TINTA), 720), brand / "wordmark-tinta.webp")
        save_webp(fit_width(tint(wordmark, BLANCO), 720), brand / "wordmark-blanco.webp")
        save_webp(fit_width(lockup, 960), brand / "logo-completo.webp")
        save_webp(fit_width(tagline, 720), brand / "lema-tinta.webp")
        save_webp(fit_width(tint(tagline, BLANCO), 720), brand / "lema-blanco.webp")

        icons = app / "public" / "icons"
        icons.mkdir(parents=True, exist_ok=True)
        on_square(emblem, 192, CREMA, 0.66, radius=0.22).save(icons / "icon-192.png")
        on_square(emblem, 512, CREMA, 0.66, radius=0.22).save(icons / "icon-512.png")
        on_square(emblem, 512, CREMA, 0.52).save(icons / "maskable-512.png")  # a sangre; el margen lo recorta el sistema
        appdir = app / "src" / "app"
        on_square(emblem, 180, CREMA, 0.6).save(appdir / "apple-icon.png")
        on_square(emblem, 64, None, 0.92).save(appdir / "icon.png")

    # Imagen para compartir el enlace (Open Graph, 1200x630) en la tienda.
    og = Image.new("RGBA", (1200, 630), CREMA + (255,))
    mark = fit_width(lockup, 640)
    og.alpha_composite(mark, ((1200 - mark.width) // 2, 175))
    tag = fit_width(tagline, 360)
    og.alpha_composite(tag, ((1200 - tag.width) // 2, 175 + mark.height + 36))
    og.convert("RGB").save(ROOT / "apps" / "store" / "src" / "app" / "opengraph-image.png", optimize=True)

    print("Listo:", ", ".join(sorted(p.name for p in (APPS[1] / "public" / "brand").iterdir())))


if __name__ == "__main__":
    main()
