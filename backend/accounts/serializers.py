from django.contrib.auth.password_validation import validate_password
from django.db import transaction
import re
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import CustomerProfile, EmailVerificationToken, User


class ProfileSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = CustomerProfile
        fields = ("display_name", "phone", "country", "avatar_url")

    def get_avatar_url(self, obj):
        if obj and obj.avatar:
            return obj.avatar.url
        return None


class UserSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(source="customer_profile", required=False)
    display_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    phone = serializers.CharField(write_only=True, required=False, allow_blank=True)
    country = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=2)
    avatar = serializers.FileField(write_only=True, required=False, allow_null=True)
    remove_avatar = serializers.BooleanField(write_only=True, required=False, default=False)
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "role",
            "avatar_url",
            "profile",
            "display_name",
            "phone",
            "country",
            "avatar",
            "remove_avatar",
        )
        read_only_fields = ("id", "role", "avatar_url")

    def get_avatar_url(self, obj):
        profile = getattr(obj, "customer_profile", None)
        if profile and profile.avatar:
            return profile.avatar.url
        return None

    def validate_email(self, value):
        normalized = value.strip().lower()
        qs = User.objects.filter(email=normalized)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return normalized

    @transaction.atomic
    def update(self, instance, validated_data):
        profile_data = validated_data.pop("customer_profile", {}) or {}
        for key in ("display_name", "phone", "country"):
            if key in validated_data:
                profile_data[key] = validated_data.pop(key)
        avatar = validated_data.pop("avatar", serializers.empty)
        remove_avatar = validated_data.pop("remove_avatar", False)

        instance = super().update(instance, validated_data)
        profile, _ = CustomerProfile.objects.get_or_create(user=instance)
        for field, value in profile_data.items():
            setattr(profile, field, value)
        if remove_avatar and profile.avatar:
            try:
                profile.avatar.delete(save=False)
            except OSError:
                pass
            profile.avatar = None
        elif avatar is not serializers.empty and avatar is not None:
            if profile.avatar:
                try:
                    profile.avatar.delete(save=False)
                except OSError:
                    pass
            profile.avatar = avatar
        profile.save()
        return instance


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, validators=[validate_password])
    new_password_confirm = serializers.CharField(write_only=True)

    def validate_current_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError({"new_password_confirm": "New passwords do not match."})
        password = attrs["new_password"]
        missing = []
        if not re.search(r"[a-z]", password):
            missing.append("a lowercase letter")
        if not re.search(r"[A-Z]", password):
            missing.append("an uppercase letter")
        if not re.search(r"\d", password):
            missing.append("a number")
        if missing:
            raise serializers.ValidationError({"new_password": f"Password must include {', '.join(missing)}."})
        return attrs


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)
    first_name = serializers.CharField(required=False, allow_blank=True, default="")
    last_name = serializers.CharField(required=False, allow_blank=True, default="")
    human_verified = serializers.BooleanField(write_only=True, required=False, default=True)
    website = serializers.CharField(write_only=True, required=False, allow_blank=True, default="")

    def validate_email(self, value):
        normalized = value.strip().lower()
        existing = User.objects.filter(email=normalized).first()
        if existing and existing.is_active:
            raise serializers.ValidationError("An account with this email already exists.")
        return normalized

    def validate(self, attrs):
        if attrs.get("website"):
            raise serializers.ValidationError({"detail": "Bot activity detected."})
        if not attrs.get("human_verified", True):
            raise serializers.ValidationError({"human_verified": "Please complete the human verification check."})
        if attrs["password"] != attrs.pop("password_confirm"):
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        password = attrs["password"]
        missing = []
        if not re.search(r"[a-z]", password):
            missing.append("a lowercase letter")
        if not re.search(r"[A-Z]", password):
            missing.append("an uppercase letter")
        if not re.search(r"\d", password):
            missing.append("a number")
        if missing:
            raise serializers.ValidationError({"password": f"Password must include {', '.join(missing)}."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        validated_data.pop("human_verified", None)
        validated_data.pop("website", None)
        email = validated_data.pop("email")
        password = validated_data.pop("password")
        first_name = validated_data.get("first_name", "")
        last_name = validated_data.get("last_name", "")

        user = User.objects.filter(email=email, is_active=False).first()
        if user:
            user.first_name = first_name
            user.last_name = last_name
            user.set_password(password)
            user.save()
        else:
            user = User.objects.create_user(
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                role=User.Role.CUSTOMER,
                is_active=False,
            )
            CustomerProfile.objects.get_or_create(user=user)
        return user


class RegistrationResponseSerializer(serializers.Serializer):
    user = UserSerializer(required=False)
    access = serializers.CharField(required=False)
    refresh = serializers.CharField(required=False)
    verification_required = serializers.BooleanField(required=False)
    verification_id = serializers.CharField(required=False)
    email = serializers.EmailField(required=False)
    expires_in_seconds = serializers.IntegerField(required=False)
    demo_email_url = serializers.CharField(required=False)

    @staticmethod
    def for_user(user):
        refresh = RefreshToken.for_user(user)
        return {"user": UserSerializer(user).data, "access": str(refresh.access_token), "refresh": str(refresh)}
