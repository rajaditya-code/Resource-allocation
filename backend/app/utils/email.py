"""
Email utility — sends transactional emails via SMTP.

Used for OTP verification, password resets, and notification emails.
If SMTP credentials aren't configured, emails are silently skipped
so the app can still run in development without an email provider.
"""

import smtplib
import random
import string
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

from app.config import settings


def generate_otp(length: int = 6) -> str:
    """Generate a random numeric OTP code."""
    return "".join(random.choices(string.digits, k=length))


def send_email(
    to_email: str,
    subject: str,
    html_body: str,
    plain_body: Optional[str] = None,
) -> bool:
    """
    Send an email via SMTP.

    Returns True if the email was sent successfully, False otherwise.
    Silently returns False if SMTP is not configured (dev-friendly).
    """
    # Skip if SMTP isn't configured
    if not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD:
        print(f"[EMAIL SKIPPED] To: {to_email} | Subject: {subject}")
        return False

    try:
        # Build the email
        msg = MIMEMultipart("alternative")
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        msg["To"] = to_email
        msg["Subject"] = subject

        # Attach plain text version (fallback)
        if plain_body:
            msg.attach(MIMEText(plain_body, "plain"))

        # Attach HTML version (primary)
        msg.attach(MIMEText(html_body, "html"))

        # Send it
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.send_message(msg)

        return True

    except Exception as e:
        print(f"[EMAIL ERROR] Failed to send to {to_email}: {e}")
        return False


def send_otp_email(to_email: str, otp_code: str, purpose: str = "verification") -> bool:
    """
    Send an OTP email for verification or password reset.

    Args:
        to_email: Recipient email address
        otp_code: The OTP code to send
        purpose: Either 'verification' or 'password_reset'
    """
    if purpose == "password_reset":
        subject = "Password Reset Code"
        heading = "Reset Your Password"
        instruction = "Use the code below to reset your password. This code expires in 10 minutes."
    else:
        subject = "Email Verification Code"
        heading = "Verify Your Email"
        instruction = "Use the code below to verify your email address. This code expires in 10 minutes."

    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #1a1a2e; margin-bottom: 8px;">{heading}</h2>
        <p style="color: #555; font-size: 14px;">{instruction}</p>
        <div style="background: #f0f4ff; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
            <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1a1a2e;">
                {otp_code}
            </span>
        </div>
        <p style="color: #999; font-size: 12px;">
            If you didn't request this, you can safely ignore this email.
        </p>
    </div>
    """

    plain_body = f"Your {purpose} code is: {otp_code}. It expires in 10 minutes."

    return send_email(to_email, subject, html_body, plain_body)


def send_notification_email(
    to_email: str,
    title: str,
    message: str,
) -> bool:
    """Send a general notification email (booking updates, reminders, etc.)."""
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #1a1a2e; margin-bottom: 8px;">{title}</h2>
        <p style="color: #333; font-size: 14px; line-height: 1.6;">{message}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #999; font-size: 12px;">
            {settings.APP_NAME}
        </p>
    </div>
    """

    return send_email(to_email, title, html_body, message)
