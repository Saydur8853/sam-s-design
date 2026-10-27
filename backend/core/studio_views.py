import datetime
import decimal
import io
import os
import shutil
import subprocess
import uuid
import zipfile

from django.conf import settings
from django.contrib.admin.views.decorators import staff_member_required
from django.core.management import call_command
from django.db import connection
from django.db.models import Count
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from catalog.models import Product
from custom_requests.models import CustomDesignRequest
from messaging.models import Conversation
from orders.models import Order

from .permissions import IsDesigner


def _sql_literal(val) -> str:
    if val is None:
        return "NULL"
    if isinstance(val, bool):
        return "TRUE" if val else "FALSE"
    if isinstance(val, (int, float, decimal.Decimal)):
        return str(val)
    if isinstance(val, (datetime.datetime, datetime.date, datetime.time)):
        return "'" + val.isoformat().replace("'", "''") + "'"
    if isinstance(val, uuid.UUID):
        return f"'{val}'"
    text = str(val).replace("'", "''")
    return f"'{text}'"


def _build_postgresql_sql_dump() -> str:
    """
    Uses pg_dump when running on PostgreSQL with pg_dump installed; otherwise builds
    a clean PostgreSQL-compatible SQL dump (postgres_backup.sql) directly from active tables.
    """
    db_cfg = settings.DATABASES.get("default", {})
    engine = db_cfg.get("ENGINE", "")
    if "postgresql" in engine and shutil.which("pg_dump"):
        env = os.environ.copy()
        if db_cfg.get("PASSWORD"):
            env["PGPASSWORD"] = str(db_cfg["PASSWORD"])
        cmd = [
            "pg_dump",
            "--no-owner",
            "--no-privileges",
            "--clean",
            "--if-exists",
            "-h",
            str(db_cfg.get("HOST") or "localhost"),
            "-p",
            str(db_cfg.get("PORT") or "5432"),
            "-U",
            str(db_cfg.get("USER") or "postgres"),
            str(db_cfg.get("NAME") or "sameulshajid"),
        ]
        try:
            proc = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=60, check=True)
            if proc.stdout.strip():
                return proc.stdout
        except Exception:
            pass

    lines = [
        "-- sameulshajid.art PostgreSQL Database Backup",
        f"-- Generated at (UTC): {timezone.now().isoformat()}",
        "BEGIN;",
        "",
    ]
    skip_tables = {"django_migrations", "django_session", "django_content_type", "auth_permission"}
    with connection.cursor() as cursor:
        table_names = [t for t in connection.introspection.table_names(cursor) if t not in skip_tables]
        for table in table_names:
            cursor.execute(f'SELECT * FROM "{table}"')
            rows = cursor.fetchall()
            if not rows:
                continue
            cols = [col[0] for col in cursor.description]
            col_list = ", ".join(f'"{c}"' for c in cols)
            lines.append(f'-- Table: "{table}" ({len(rows)} rows)')
            for row in rows:
                vals = ", ".join(_sql_literal(v) for v in row)
                lines.append(f'INSERT INTO "{table}" ({col_list}) VALUES ({vals}) ON CONFLICT DO NOTHING;')
            lines.append("")
    lines.append("COMMIT;")
    return "\n".join(lines)


def generate_database_backup_response() -> HttpResponse:
    """
    Creates a PostgreSQL backup archive containing:
      1. postgres_backup.sql (PostgreSQL SQL dump via pg_dump / SQL INSERTs)
      2. database_dump.json (Django fixture dump for `python manage.py loaddata`)
    """
    timestamp = timezone.now().strftime("%Y%m%d-%H%M%S")
    filename = f"sameulshajid-postgres-backup-{timestamp}.zip"
    zip_buffer = io.BytesIO()

    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        sql_dump = _build_postgresql_sql_dump()
        zf.writestr("postgres_backup.sql", sql_dump.encode("utf-8"))

        json_out = io.StringIO()
        call_command(
            "dumpdata",
            exclude=["contenttypes", "auth.permission", "sessions.session"],
            natural_foreign=True,
            natural_primary=True,
            indent=2,
            stdout=json_out,
        )
        zf.writestr("database_dump.json", json_out.getvalue().encode("utf-8"))

    zip_buffer.seek(0)
    response = HttpResponse(zip_buffer.getvalue(), content_type="application/zip")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


class StudioDashboardView(APIView):
    permission_classes = (IsDesigner,)

    def get(self, request):
        unread_messages = 0
        for custom_request in CustomDesignRequest.objects.select_related("conversation"):
            try:
                last_read = custom_request.conversation.designer_last_read_at
            except Conversation.DoesNotExist:
                continue
            messages = custom_request.conversation.messages.exclude(sender=request.user)
            if last_read:
                messages = messages.filter(created_at__gt=last_read)
            unread_messages += messages.count()

        return Response({
            "products": Product.objects.count(),
            "published_products": Product.objects.filter(is_active=True).count(),
            "active_projects": CustomDesignRequest.objects.exclude(
                status__in=(CustomDesignRequest.Status.COMPLETED, CustomDesignRequest.Status.CANCELLED)
            ).count(),
            "new_projects": CustomDesignRequest.objects.filter(status=CustomDesignRequest.Status.SUBMITTED).count(),
            "unread_messages": unread_messages,
            "paid_orders": Order.objects.filter(status=Order.Status.PAID).count(),
            "recent_projects": list(
                CustomDesignRequest.objects.select_related("customer")
                .annotate(message_count=Count("conversation__messages"))
                .values("id", "title", "status", "customer__email", "updated_at", "message_count")[:5]
            ),
        })


class StudioDatabaseBackupView(APIView):
    permission_classes = (IsDesigner,)

    def get(self, request):
        return generate_database_backup_response()


@staff_member_required
def admin_database_backup_view(request):
    return generate_database_backup_response()
