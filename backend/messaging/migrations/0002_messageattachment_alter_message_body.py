from django.db import migrations, models
import django.db.models.deletion
import messaging.models


class Migration(migrations.Migration):
    dependencies = [("messaging", "0001_initial")]
    operations = [
        migrations.AlterField(model_name="message", name="body", field=models.TextField(blank=True, max_length=4000)),
        migrations.CreateModel(
            name="MessageAttachment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("file", models.FileField(upload_to=messaging.models.attachment_upload_path)),
                ("original_name", models.CharField(max_length=255)),
                ("mime_type", models.CharField(max_length=120)),
                ("file_size", models.PositiveBigIntegerField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("message", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="attachments", to="messaging.message")),
            ],
        ),
    ]
