import json
import os
import urllib.parse
import urllib.request
from dotenv import load_dotenv
from django.conf import settings
from django.core.mail import EmailMultiAlternatives, get_connection
from django.http import HttpResponse, HttpResponseRedirect
from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.utils.html import escape
from drf_spectacular.utils import extend_schema
from rest_framework import generics, parsers, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .models import CustomerProfile, EmailVerificationToken, User
from .serializers import (
    ChangePasswordSerializer,
    RegisterSerializer,
    RegistrationResponseSerializer,
    UserSerializer,
)


def build_email_box_html(user_email: str, approve_url: str, remaining_minutes: int = 10) -> str:
    safe_email = escape(user_email)
    return f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Approve your sign-up — sameulshajid.art</title>
</head>
<body style="margin:0;padding:36px 16px;background:#11110f;color:#f2efe8;font-family:'DM Sans',Arial,sans-serif;">
  <div style="max-width:460px;margin:0 auto;padding:36px 32px;background:#1a1a17;border:1px solid rgba(242,239,232,.16);border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.6);">
    <div style="display:inline-block;padding:4px 9px;background:#c8f257;color:#171714;font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;border-radius:4px;">
      EMAIL VERIFICATION
    </div>
    <h1 style="margin:18px 0 10px;font-size:28px;line-height:1.1;color:#f2efe8;">Approve your account</h1>
    <p style="margin:0 0 22px;color:#a6a298;font-size:14px;line-height:1.6;">
      Confirm sign-up for <strong style="color:#f2efe8;">{safe_email}</strong> on <strong>sameulshajid.art</strong>. Press the approve button below to automatically authenticate and sign in.
    </p>
    <div style="padding:22px;background:#11110f;border:1px solid rgba(200,242,87,.3);border-radius:12px;text-align:center;margin-bottom:22px;">
      <div style="font-size:11px;color:#c8f257;text-transform:uppercase;letter-spacing:.12em;font-weight:700;margin-bottom:14px;">
        One-click instant sign-in
      </div>
      <a href="{approve_url}" style="display:inline-block;width:100%;box-sizing:border-box;padding:15px 22px;background:#ff5b35;color:#ffffff;text-decoration:none;font-weight:800;font-size:15px;border-radius:8px;">
        ✓ Approve &amp; Sign In
      </a>
    </div>
    <p style="margin:0;color:#8d897f;font-size:12px;line-height:1.5;text-align:center;">
      ⏱ This approval link expires in <strong style="color:#f2efe8;">{remaining_minutes} minutes</strong>.
    </p>
  </div>
</body>
</html>"""


def send_verification_email(request, user: User, token_obj: EmailVerificationToken) -> tuple[bool, str]:
    load_dotenv(settings.BASE_DIR.parent / ".env", override=True)
    smtp_host = os.getenv("EMAIL_HOST", "").strip() or "smtp.gmail.com"
    smtp_port = int(os.getenv("EMAIL_PORT", "587") or "587")
    smtp_user = os.getenv("EMAIL_HOST_USER", "").strip()
    smtp_pass = os.getenv("EMAIL_HOST_PASSWORD", "").strip().replace(" ", "")
    smtp_tls = os.getenv("EMAIL_USE_TLS", "true").lower() in {"1", "true", "yes", "on"}
    from_email = os.getenv("DEFAULT_FROM_EMAIL", "").strip() or smtp_user or settings.DEFAULT_FROM_EMAIL

    approve_path = reverse("verify-email", args=(token_obj.token,)) + "?approve=1"
    approve_url = request.build_absolute_uri(approve_path)
    subject = "Approve your sign-up — sameulshajid.art (Expires in 10 minutes)"
    text_body = (
        f"Welcome to sameulshajid.art!\n\n"
        f"Approve your account ({user.email}) by visiting this link within 10 minutes:\n"
        f"{approve_url}\n"
    )
    html_body = build_email_box_html(user.email, approve_url, 10)
    sent_real_email = False
    if smtp_user and smtp_pass:
        connection = get_connection(
            backend="django.core.mail.backends.smtp.EmailBackend",
            host=smtp_host,
            port=smtp_port,
            username=smtp_user,
            password=smtp_pass,
            use_tls=smtp_tls,
            timeout=15,
        )
        msg = EmailMultiAlternatives(subject, text_body, from_email, [user.email], connection=connection)
        msg.attach_alternative(html_body, "text/html")
        msg.send(fail_silently=False)
        sent_real_email = True
    demo_path = reverse("demo-email-preview", args=(token_obj.token,))
    return sent_real_email, request.build_absolute_uri(demo_path)


class RegisterView(generics.GenericAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

    @extend_schema(responses={201: RegistrationResponseSerializer})
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        EmailVerificationToken.objects.filter(user=user, is_approved=False).delete()
        token_obj = EmailVerificationToken.objects.create(user=user)
        try:
            sent_real, demo_email_url = send_verification_email(request, user, token_obj)
        except Exception as exc:
            return Response(
                {"detail": f"SMTP email could not be sent: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        payload = {
            "verification_required": True,
            "verification_id": str(token_obj.id),
            "email": user.email,
            "expires_in_seconds": token_obj.remaining_seconds,
        }
        if not sent_real and settings.DEBUG:
            payload["demo_email_url"] = demo_email_url
        return Response(payload, status=status.HTTP_201_CREATED)


class ResendVerificationView(generics.GenericAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, *args, **kwargs):
        email = str(request.data.get("email", "")).strip().lower()
        user = get_object_or_404(User, email=email, is_active=False)
        EmailVerificationToken.objects.filter(user=user, is_approved=False).delete()
        token_obj = EmailVerificationToken.objects.create(user=user)
        try:
            sent_real, demo_email_url = send_verification_email(request, user, token_obj)
        except Exception as exc:
            return Response(
                {"detail": f"SMTP email could not be sent: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        payload = {
            "verification_required": True,
            "verification_id": str(token_obj.id),
            "email": user.email,
            "expires_in_seconds": token_obj.remaining_seconds,
        }
        if not sent_real and settings.DEBUG:
            payload["demo_email_url"] = demo_email_url
        return Response(payload, status=status.HTTP_200_OK)


class DemoEmailPreviewView(generics.GenericAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, token):
        token_obj = get_object_or_404(EmailVerificationToken.objects.select_related("user"), token=token)
        approve_url = reverse("verify-email", args=(token_obj.token,))
        remaining_min = max(1, (token_obj.remaining_seconds + 59) // 60)
        return HttpResponse(build_email_box_html(token_obj.user.email, approve_url, remaining_min))


class VerifyEmailView(generics.GenericAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def _render_expired(self):
        return HttpResponse(
            f"""<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Link Expired</title></head>
            <body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#11110f;color:#f2efe8;font-family:Arial,sans-serif;">
              <main style="width:min(430px,calc(100% - 36px));padding:36px;background:#1a1a17;border:1px solid rgba(255,91,53,.4);border-radius:16px;text-align:center;">
                <div style="display:inline-block;padding:4px 9px;background:rgba(255,91,53,.2);color:#ff7b61;font-size:10px;font-weight:800;letter-spacing:.12em;border-radius:4px;">LINK EXPIRED</div>
                <h1 style="margin:16px 0 10px;font-size:26px;">Verification link expired</h1>
                <p style="color:#a6a298;font-size:14px;line-height:1.6;margin:0 0 24px;">This email verification link exceeded its 10-minute validity window. Please request a new link from the sign-up box.</p>
                <a href="{settings.FRONTEND_URL}" style="display:inline-block;padding:13px 22px;background:#ff5b35;color:#fff;text-decoration:none;font-weight:700;border-radius:8px;">Return to website</a>
              </main>
            </body></html>""",
            status=410,
        )

    def _approve_and_redirect(self, token_obj: EmailVerificationToken):
        user = token_obj.user
        if not user.is_active:
            user.is_active = True
            user.save(update_fields=["is_active"])
        CustomerProfile.objects.get_or_create(user=user)
        if not token_obj.is_approved:
            token_obj.is_approved = True
            token_obj.save(update_fields=["is_approved"])

        refresh = RefreshToken.for_user(user)
        access_str = str(refresh.access_token)
        refresh_str = str(refresh)
        redirect_url = f"{settings.FRONTEND_URL}/?auth_access={access_str}&auth_refresh={refresh_str}"
        return HttpResponse(
            f"""<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Approved — Signing in</title></head>
            <body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#11110f;color:#f2efe8;font-family:Arial,sans-serif;">
              <main style="width:min(420px,calc(100% - 36px));padding:36px;background:#1a1a17;border:1px solid rgba(200,242,87,.35);border-radius:16px;text-align:center;">
                <div style="width:52px;height:52px;margin:0 auto 16px;border-radius:50%;background:#c8f257;color:#171714;display:grid;place-items:center;font-size:24px;font-weight:800;">✓</div>
                <h1 style="margin:0 0 8px;font-size:24px;">Email Approved!</h1>
                <p style="color:#a6a298;font-size:14px;margin:0 0 22px;">You are now signed in as <strong style="color:#f2efe8;">{escape(user.email)}</strong>.</p>
                <a href="{redirect_url}" style="display:inline-block;padding:13px 22px;background:#ff5b35;color:#fff;text-decoration:none;font-weight:700;border-radius:8px;">Continue to studio →</a>
              </main>
              <script>
                (function() {{
                  var payload = {{ type: 'AUTH_TOKENS', access: {json.dumps(access_str)}, refresh: {json.dumps(refresh_str)}, ts: Date.now() }};
                  try {{
                    localStorage.setItem('sameulshajid_oauth_sync', JSON.stringify(payload));
                  }} catch (e) {{}}
                  try {{
                    if (typeof BroadcastChannel !== 'undefined') {{
                      var bc = new BroadcastChannel('sameulshajid_auth_channel');
                      bc.postMessage(payload);
                    }}
                  }} catch (e) {{}}
                  try {{
                    if (window.opener && !window.opener.closed) {{
                      window.opener.postMessage(payload, '*');
                    }}
                  }} catch (e) {{}}
                  setTimeout(function() {{
                    try {{ window.close(); }} catch (e) {{}}
                  }}, 400);
                }})();
              </script>
            </body></html>"""
        )

    def get(self, request, token):
        token_obj = get_object_or_404(EmailVerificationToken.objects.select_related("user"), token=token)
        if token_obj.is_expired and not token_obj.is_approved:
            return self._render_expired()
        if request.GET.get("approve") == "1":
            return self._approve_and_redirect(token_obj)

        action_url = reverse("verify-email", args=(token_obj.token,))
        mins = token_obj.remaining_seconds // 60
        secs = token_obj.remaining_seconds % 60
        return HttpResponse(
            f"""<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Approve Sign-Up</title></head>
            <body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#11110f;color:#f2efe8;font-family:Arial,sans-serif;">
              <main style="width:min(440px,calc(100% - 36px));padding:38px 32px;background:#1a1a17;border:1px solid rgba(242,239,232,.18);border-radius:16px;box-shadow:0 24px 65px rgba(0,0,0,.65);text-align:center;">
                <span style="display:inline-block;padding:4px 10px;background:#c8f257;color:#171714;font-size:10px;font-weight:800;letter-spacing:.14em;border-radius:4px;">APPROVE SIGN-UP</span>
                <h1 style="margin:16px 0 8px;font-size:28px;">Confirm your email</h1>
                <p style="margin:0 0 22px;color:#a6a298;font-size:14px;line-height:1.6;">
                  Press <strong style="color:#f2efe8;">Approve</strong> below to verify <strong style="color:#f2efe8;">{escape(token_obj.user.email)}</strong> and sign in automatically.
                </p>
                <div style="padding:22px;background:#11110f;border:1px solid rgba(200,242,87,.3);border-radius:12px;margin-bottom:18px;">
                  <form method="post" action="{action_url}">
                    <button type="submit" style="width:100%;padding:15px 20px;border:0;border-radius:8px;background:#ff5b35;color:#fff;font-size:15px;font-weight:800;cursor:pointer;">
                      ✓ Approve &amp; Auto Sign In
                    </button>
                  </form>
                </div>
                <small style="color:#8d897f;font-size:12px;">Expires in {mins}m {secs:02d}s (10-minute security window)</small>
              </main>
            </body></html>"""
        )

    def post(self, request, token):
        token_obj = get_object_or_404(EmailVerificationToken.objects.select_related("user"), token=token)
        if token_obj.is_expired and not token_obj.is_approved:
            return self._render_expired()
        return self._approve_and_redirect(token_obj)


class VerifyStatusView(generics.GenericAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, verification_id):
        token_obj = get_object_or_404(EmailVerificationToken.objects.select_related("user"), pk=verification_id)
        if token_obj.is_approved:
            if not token_obj.consumed:
                token_obj.consumed = True
                token_obj.save(update_fields=["consumed"])
            payload = RegistrationResponseSerializer.for_user(token_obj.user)
            payload["status"] = "APPROVED"
            return Response(payload)
        if token_obj.is_expired:
            return Response({"status": "EXPIRED", "remaining_seconds": 0})
        return Response({"status": "PENDING", "remaining_seconds": token_obj.remaining_seconds})


class GoogleAuthPopupView(generics.GenericAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        load_dotenv(settings.BASE_DIR.parent / ".env", override=True)
        client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
        callback_url = f"{settings.FRONTEND_URL}/api/v1/auth/google/callback/"

        if client_id:
            params = urllib.parse.urlencode(
                {
                    "client_id": client_id,
                    "redirect_uri": callback_url,
                    "response_type": "code",
                    "scope": "openid email profile",
                    "access_type": "online",
                    "prompt": "select_account",
                }
            )
            return HttpResponseRedirect(f"https://accounts.google.com/o/oauth2/v2/auth?{params}")

        return HttpResponse(
            f"""<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Google OAuth Setup Needed</title>
            <style>
              body {{ margin:0; min-height:100vh; display:grid; place-items:center; background:#11110f; color:#f2efe8; font-family:'DM Sans',Arial,sans-serif; }}
              main {{ width:min(440px,calc(100% - 32px)); padding:32px 28px; background:#1a1a17; border:1px solid rgba(242,239,232,.16); border-radius:16px; box-shadow:0 24px 60px rgba(0,0,0,.65); }}
              h1 {{ margin:12px 0 8px; font-size:21px; }}
              p, li {{ color:#a6a298; font-size:13px; line-height:1.6; }}
              ol {{ padding-left:18px; margin:12px 0 18px; }}
              code {{ display:block; padding:10px; margin:8px 0; background:#11110f; border:1px solid rgba(200,242,87,.3); border-radius:6px; color:#c8f257; font-size:11.5px; word-break:break-all; }}
            </style></head>
            <body>
              <main>
                <span style="padding:4px 8px;background:#c8f257;color:#171714;font-size:10px;font-weight:800;border-radius:4px;">GOOGLE OAUTH 2.0</span>
                <h1>Connect Real Google Sign-In</h1>
                <p>To open Google’s official account chooser, add your Google OAuth credentials in <strong>.env</strong>:</p>
                <ol>
                  <li>Open <strong>Google Cloud Console → APIs &amp; Services → Credentials</strong></li>
                  <li>Create an <strong>OAuth 2.0 Client ID</strong> (Web application)</li>
                  <li>Add this <strong>Authorized redirect URI</strong>:
                    <code>{escape(callback_url)}</code>
                  </li>
                  <li>Paste <strong>GOOGLE_CLIENT_ID</strong> and <strong>GOOGLE_CLIENT_SECRET</strong> into your <strong>.env</strong> file.</li>
                </ol>
              </main>
            </body></html>"""
        )


class GoogleAuthCallbackView(generics.GenericAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        load_dotenv(settings.BASE_DIR.parent / ".env", override=True)
        code = request.GET.get("code")
        if not code:
            return HttpResponseRedirect(settings.FRONTEND_URL)

        client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
        client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()
        callback_url = f"{settings.FRONTEND_URL}/api/v1/auth/google/callback/"

        try:
            token_data = urllib.parse.urlencode(
                {
                    "code": code,
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "redirect_uri": callback_url,
                    "grant_type": "authorization_code",
                }
            ).encode("utf-8")
            token_req = urllib.request.Request(
                "https://oauth2.googleapis.com/token",
                data=token_data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            with urllib.request.urlopen(token_req, timeout=15) as resp:
                tokens = json.loads(resp.read().decode("utf-8"))

            userinfo_req = urllib.request.Request(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {tokens['access_token']}"},
            )
            with urllib.request.urlopen(userinfo_req, timeout=15) as resp:
                profile = json.loads(resp.read().decode("utf-8"))
        except Exception as exc:
            return HttpResponse(f"Google authentication failed: {escape(str(exc))}", status=400)

        email = str(profile.get("email") or "").strip().lower()
        first_name = str(profile.get("given_name") or "").strip()
        last_name = str(profile.get("family_name") or "").strip()
        if not email:
            return HttpResponse("Google account did not return an email address.", status=400)

        user = User.objects.filter(email=email).first()
        if not user:
            user = User.objects.create_user(
                email=email,
                password=None,
                first_name=first_name,
                last_name=last_name,
                role=User.Role.CUSTOMER,
                is_active=True,
            )
            CustomerProfile.objects.get_or_create(user=user)
        else:
            updated_fields = []
            if not user.is_active:
                user.is_active = True
                updated_fields.append("is_active")
            if first_name and not user.first_name:
                user.first_name = first_name
                updated_fields.append("first_name")
            if last_name and not user.last_name:
                user.last_name = last_name
                updated_fields.append("last_name")
            if updated_fields:
                user.save(update_fields=updated_fields)
            CustomerProfile.objects.get_or_create(user=user)

        refresh = RefreshToken.for_user(user)
        access_str = str(refresh.access_token)
        refresh_str = str(refresh)
        return HttpResponse(
            f"""<!doctype html><html><head><meta charset="utf-8"><title>Google Sign-In Complete</title></head>
            <body style="background:#11110f;color:#f2efe8;display:grid;min-height:100vh;place-items:center;font-family:Arial,sans-serif;margin:0;">
              <div style="text-align:center;padding:28px;">
                <div style="width:44px;height:44px;margin:0 auto 14px;border-radius:50%;background:#c8f257;color:#171714;display:grid;place-items:center;font-size:22px;font-weight:800;">✓</div>
                <p style="margin:0 0 6px;font-size:16px;font-weight:700;">Signed in successfully</p>
                <p style="margin:0;color:#a6a298;font-size:13px;">Returning to sameulshajid.art…</p>
              </div>
              <script>
                (function() {{
                  var payload = {{ type: 'AUTH_TOKENS', access: {json.dumps(access_str)}, refresh: {json.dumps(refresh_str)}, ts: Date.now() }};
                  try {{
                    localStorage.setItem('sameulshajid_oauth_sync', JSON.stringify(payload));
                  }} catch (e) {{}}
                  try {{
                    if (typeof BroadcastChannel !== 'undefined') {{
                      var bc = new BroadcastChannel('sameulshajid_auth_channel');
                      bc.postMessage(payload);
                    }}
                  }} catch (e) {{}}
                  try {{
                    if (window.opener && !window.opener.closed) {{
                      window.opener.postMessage(payload, '*');
                    }}
                  }} catch (e) {{}}
                  try {{
                    window.close();
                  }} catch (e) {{}}
                  setTimeout(function() {{
                    try {{ window.close(); }} catch (e) {{}}
                  }}, 150);
                }})();
              </script>
            </body></html>"""
        )


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = (parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser)

    def get_object(self):
        return self.request.user


class ChangePasswordView(generics.GenericAPIView):
    serializer_class = ChangePasswordSerializer
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        return Response({"detail": "Password updated successfully."}, status=status.HTTP_200_OK)


class LoginView(TokenObtainPairView):
    throttle_scope = "auth_login"


class RefreshView(TokenRefreshView):
    throttle_scope = "auth_refresh"


class LogoutView(generics.GenericAPIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        refresh_value = request.data.get("refresh")
        if refresh_value:
            try:
                RefreshToken(refresh_value).blacklist()
            except TokenError:
                pass
        return Response(status=status.HTTP_204_NO_CONTENT)
