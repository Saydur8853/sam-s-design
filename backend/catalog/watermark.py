import io
import zipfile
from pathlib import Path

from django.conf import settings
from django.core.files.base import ContentFile
from PIL import Image, ImageDraw, ImageFont

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def apply_burned_watermark(uploaded_file, max_edge: int = 1000, burn_visible_stamps: bool = False) -> tuple[ContentFile, str]:
    """
    Opens an uploaded preview image, strips EXIF/metadata, downscales to max_edge (72 DPI),
    and returns (ContentFile, '.webp'). Visible watermarks are rendered on the detail page canvas.
    """
    content, ext, _dims = process_image_to_preview(uploaded_file, max_edge=max_edge, burn_visible_stamps=burn_visible_stamps)
    return content, ext


def process_image_to_preview(
    uploaded_file, max_edge: int = 1000, burn_visible_stamps: bool = False
) -> tuple[ContentFile, str, str]:
    """
    Converts a raw image file (or BytesIO) into a 72-DPI stripped WebP preview
    and returns (ContentFile, '.webp', 'WIDTH × HEIGHT px').
    """
    uploaded_file.seek(0)
    with Image.open(uploaded_file) as raw_img:
        orig_w, orig_h = raw_img.size
        base = raw_img.convert("RGBA")

    dimensions_str = f"{orig_w} × {orig_h} px"
    width, height = base.size
    if max(width, height) > max_edge:
        scale = max_edge / float(max(width, height))
        width = max(1, int(round(width * scale)))
        height = max(1, int(round(height * scale)))
        base = base.resize((width, height), Image.Resampling.LANCZOS)

    # Create a fresh RGBA image so all original EXIF/ICC/XMP metadata is stripped
    clean_base = Image.new("RGBA", (width, height))
    clean_base.paste(base, (0, 0))

    if not burn_visible_stamps:
        final_img = clean_base.convert("RGB")
        buffer = io.BytesIO()
        final_img.save(buffer, format="WEBP", quality=82, dpi=(72, 72))
        return ContentFile(buffer.getvalue()), ".webp", dimensions_str

    overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))

    logo_path = Path(settings.BASE_DIR).parent / "frontend" / "public" / "brand" / "samis-design-watermark.png"
    logo_img = None
    if logo_path.is_file():
        try:
            with Image.open(logo_path) as raw_logo:
                logo_img = raw_logo.convert("RGBA")
        except Exception:
            logo_img = None

    stamp_w = max(180, int(width * 0.36))
    stamp_h = max(90, int(stamp_w * 0.48))
    stamp = Image.new("RGBA", (stamp_w, stamp_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(stamp)

    text_y = int(stamp_h * 0.68)
    if logo_img is not None:
        target_lw = int(stamp_w * 0.68)
        ratio = target_lw / float(max(1, logo_img.width))
        target_lh = max(1, int(logo_img.height * ratio))
        if target_lh > int(stamp_h * 0.56):
            target_lh = int(stamp_h * 0.56)
            target_lw = max(1, int(logo_img.width * (target_lh / float(max(1, logo_img.height)))))
        resized_logo = logo_img.resize((target_lw, target_lh), Image.Resampling.LANCZOS)
        r, g, b, a = resized_logo.split()
        a = a.point(lambda p: int(p * 0.32))
        resized_logo = Image.merge("RGBA", (r, g, b, a))
        lx = (stamp_w - target_lw) // 2
        ly = max(4, (text_y - target_lh) // 2)
        stamp.alpha_composite(resized_logo, (lx, ly))

    font_size = max(12, int(stamp_w * 0.075))
    try:
        font = ImageFont.truetype("arialbd.ttf", font_size)
    except Exception:
        try:
            font = ImageFont.truetype("DejaVuSans-Bold.ttf", font_size)
        except Exception:
            font = ImageFont.load_default()

    label = "sameulshajid.art"
    bbox = draw.textbbox((0, 0), label, font=font)
    tw = bbox[2] - bbox[0]
    tx = (stamp_w - tw) // 2
    draw.text((tx + 1, text_y + 1), label, font=font, fill=(0, 0, 0, 95))
    draw.text((tx, text_y), label, font=font, fill=(242, 239, 232, 92))

    rotated_stamp = stamp.rotate(24, expand=True, resample=Image.Resampling.BICUBIC)
    rw, rh = rotated_stamp.size

    positions = [
        (int(width * 0.27) - rw // 2, int(height * 0.26) - rh // 2),
        (int(width * 0.73) - rw // 2, int(height * 0.30) - rh // 2),
        (int(width * 0.27) - rw // 2, int(height * 0.72) - rh // 2),
        (int(width * 0.73) - rw // 2, int(height * 0.76) - rh // 2),
    ]
    for px, py in positions:
        overlay.alpha_composite(rotated_stamp, (px, py))

    watermarked = Image.alpha_composite(clean_base, overlay).convert("RGB")
    buffer = io.BytesIO()
    watermarked.save(buffer, format="WEBP", quality=82, dpi=(72, 72))
    return ContentFile(buffer.getvalue()), ".webp", dimensions_str


def extract_preview_from_source(source_file) -> tuple[ContentFile | None, str | None, str | None]:
    """
    Given a main source_file (JPG, PNG, WebP, or ZIP containing an image),
    automatically generates a low-res preview ContentFile and detects original dimensions.
    """
    suffix = Path(source_file.name).suffix.lower()
    if suffix in IMAGE_EXTENSIONS:
        try:
            content, ext, dims = process_image_to_preview(source_file)
            source_file.seek(0)
            return content, ext, dims
        except Exception:
            source_file.seek(0)
            return None, None, None

    if suffix == ".zip":
        try:
            source_file.seek(0)
            with zipfile.ZipFile(source_file, "r") as zf:
                for info in zf.infolist():
                    if info.is_dir():
                        continue
                    inner_ext = Path(info.filename).suffix.lower()
                    if inner_ext in IMAGE_EXTENSIONS and not Path(info.filename).name.startswith("."):
                        img_bytes = io.BytesIO(zf.read(info.filename))
                        content, ext, dims = process_image_to_preview(img_bytes)
                        source_file.seek(0)
                        return content, ext, dims
        except Exception:
            pass
        finally:
            source_file.seek(0)

    return None, None, None
