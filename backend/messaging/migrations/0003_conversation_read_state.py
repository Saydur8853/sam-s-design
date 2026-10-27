from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("messaging", "0002_messageattachment_alter_message_body")]
    operations = [
        migrations.AddField(
            model_name="conversation",
            name="customer_last_read_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="conversation",
            name="designer_last_read_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
