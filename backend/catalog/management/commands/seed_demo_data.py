from decimal import Decimal
from pathlib import Path
import shutil

from django.conf import settings
from django.core.management.base import BaseCommand

from catalog.models import Category, Product, ProductFile


class Command(BaseCommand):
    help = "Create idempotent demo categories and products for local development"

    def add_arguments(self, parser):
        parser.add_argument(
            "--if-empty",
            action="store_true",
            help="Only seed when the catalog has no products, preserving later admin edits.",
        )

    def handle(self, *args, **options):
        if options["if_empty"] and Product.objects.exists():
            self.stdout.write("Catalog already contains products; demo seed skipped.")
            return

        category_data = {
            "posters": ("Posters", "Bold artwork for walls, events, and campaigns."),
            "social-media": ("Social Media", "Flexible packs for a consistent online presence."),
            "templates": ("Templates", "Editable design systems ready for your content."),
            "print-ready": ("Print Ready", "Production-ready artwork with professional specifications."),
        }
        categories = {}
        for slug, (name, description) in category_data.items():
            categories[slug], _ = Category.objects.update_or_create(
                slug=slug, defaults={"name": name, "description": description, "is_active": True}
            )

        products = [
            ("form-follows-feeling", "Form Follows Feeling", "posters", "POSTER", "A typographic statement poster for creative spaces.", "48.00", "/demo/form-follows-feeling.svg", ["PDF", "JPG", "TIFF"], "18 × 24 in", True),
            ("stay-curious", "Stay Curious", "posters", "POSTER", "Editorial-inspired art print with expressive type.", "42.00", "/demo/stay-curious.svg", ["PDF", "PNG"], "A2 / A3", True),
            ("make-noise-social-pack", "Make Noise Social Pack", "social-media", "SOCIAL_PACK", "Twelve energetic layouts for launches and announcements.", "64.00", "/demo/make-noise.svg", ["PSD", "PNG"], "1080 × 1350 px", True),
            ("bauhaus-exhibition", "Bauhaus Exhibition", "posters", "POSTER", "Geometric exhibition poster with a modernist rhythm.", "36.00", "/demo/bauhaus.svg", ["AI", "PDF", "JPG"], "24 × 36 in", False),
            ("quiet-luxury-brand-kit", "Quiet Luxury Brand Kit", "templates", "TEMPLATE", "A refined mini identity system for thoughtful brands.", "89.00", "/demo/quiet-luxury.svg", ["AI", "PDF", "FIG"], "Brand kit", True),
            ("botanical-menu-set", "Botanical Menu Set", "print-ready", "PRINT_ART", "Elegant menu and table-card artwork for intimate events.", "52.00", "/demo/botanical.svg", ["INDD", "PDF"], "A4 / A5", False),
            ("brutalist-carousel", "Brutalist Carousel", "social-media", "SOCIAL_PACK", "Ten high-impact carousel slides for strong opinions.", "58.00", "/demo/brutalist.svg", ["PSD", "FIG", "PNG"], "1080 × 1080 px", False),
            ("after-dark-event-poster", "After Dark Event Poster", "print-ready", "PRINT_ART", "Nightlife artwork prepared for digital and offset printing.", "44.00", "/demo/after-dark.svg", ["AI", "PDF", "TIFF"], "A2", False),
            ("creative-minds-poster", "Creative Minds Poster", "posters", "POSTER", "A vivid typographic poster for studios and creative events.", "39.00", "/demo/form-follows-feeling.svg", ["PDF", "JPG"], "18 × 24 in", False),
            ("editorial-launch-pack", "Editorial Launch Pack", "social-media", "SOCIAL_PACK", "A polished twelve-slide campaign for product and brand launches.", "72.00", "/demo/quiet-luxury.svg", ["FIG", "PSD", "PNG"], "1080 × 1350 px", False),
            ("modern-gallery-poster", "Modern Gallery Poster", "posters", "POSTER", "A structured modernist poster for exhibitions and cultural events.", "34.00", "/demo/bauhaus.svg", ["AI", "PDF"], "A2 / A3", False),
            ("night-shift-flyer", "Night Shift Flyer", "print-ready", "PRINT_ART", "Atmospheric club flyer artwork supplied in print and social sizes.", "46.00", "/demo/after-dark.svg", ["PSD", "PDF", "JPG"], "A5 + Story", False),
            ("minimal-portfolio-template", "Minimal Portfolio Template", "templates", "TEMPLATE", "A calm editorial portfolio system for independent creatives.", "78.00", "/demo/quiet-luxury.svg", ["INDD", "PDF", "FIG"], "24 pages", False),
            ("bold-opinion-carousel", "Bold Opinion Carousel", "social-media", "SOCIAL_PACK", "A high-contrast carousel kit built for educational content.", "55.00", "/demo/brutalist.svg", ["FIG", "PSD"], "1080 × 1080 px", False),
            ("slow-living-art-print", "Slow Living Art Print", "posters", "POSTER", "An expressive art print with warm colour and thoughtful typography.", "41.00", "/demo/stay-curious.svg", ["PDF", "PNG", "TIFF"], "A2 / A3 / A4", False),
            ("seasonal-menu-collection", "Seasonal Menu Collection", "print-ready", "PRINT_ART", "Botanical menu, place card, and table-number templates for events.", "67.00", "/demo/botanical.svg", ["INDD", "PDF", "DOCX"], "A4 / A5", False),
            ("startup-social-toolkit", "Startup Social Toolkit", "social-media", "SOCIAL_PACK", "Twenty adaptable posts for announcements, features, and testimonials.", "84.00", "/demo/make-noise.svg", ["FIG", "PSD", "PNG"], "1080 × 1350 px", False),
            ("type-led-brand-board", "Type-led Brand Board", "templates", "TEMPLATE", "An editable one-page brand direction template for client presentations.", "49.00", "/demo/form-follows-feeling.svg", ["AI", "FIG", "PDF"], "1920 × 1080 px", False),
        ]
        for slug, title, category, product_type, summary, price, preview, formats, dimensions, featured in products:
            product, _ = Product.objects.update_or_create(
                slug=slug,
                defaults={
                    "title": title,
                    "category": categories[category],
                    "product_type": product_type,
                    "short_description": summary,
                    "description": f"{summary} Includes carefully organized, production-ready files and a commercial license for one end product.",
                    "price": Decimal(price),
                    "currency": "USD",
                    "license_type": Product.LicenseType.COMMERCIAL,
                    "preview_url": preview,
                    "file_formats": formats,
                    "dimensions": dimensions,
                    "resolution": "300 DPI",
                    "color_mode": "CMYK + RGB",
                    "is_featured": featured,
                    "is_active": True,
                },
            )
            source = settings.BASE_DIR.parent / "frontend" / "public" / preview.lstrip("/")
            relative_private_path = Path("products") / f"{slug}.svg"
            destination = settings.PRIVATE_MEDIA_ROOT / relative_private_path
            destination.parent.mkdir(parents=True, exist_ok=True)
            if source.exists():
                shutil.copyfile(source, destination)
                ProductFile.objects.update_or_create(
                    product=product,
                    private_path=str(relative_private_path).replace("\\", "/"),
                    defaults={
                        "display_name": f"{title} — Original.svg",
                        "mime_type": "image/svg+xml",
                        "file_size": destination.stat().st_size,
                        "is_active": True,
                    },
                )
        self.stdout.write(self.style.SUCCESS(f"Demo catalog ready: {len(categories)} categories and {len(products)} products."))

