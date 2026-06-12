'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Mail, CheckCircle, Loader2, RotateCcw } from 'lucide-react';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const autoSend = searchParams.get('auto') === 'true';

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef([]);
  const hasSentAuto = useRef(false);

  // Auto-resend OTP if coming from login with unverified email
  useEffect(() => {
    if (autoSend && email && !hasSentAuto.current) {
      hasSentAuto.current = true;
      handleResend();
    }
  }, [autoSend, email]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    setError('');

    // Auto-focus next
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all filled
    if (newOtp.every((d) => d !== '') && value) {
      verifyOtp(newOtp.join(''));
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData.length === 6) {
      const newOtp = pastedData.split('');
      setOtp(newOtp);
      inputRefs.current[5]?.focus();
      verifyOtp(pastedData);
    }
  };

  const verifyOtp = async (otpCode) => {
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/verify-email', {
        email,
        otp_code: otpCode,
      });
      setSuccess(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid or expired code. Please try again.');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setResendLoading(true);
    try {
      await api.post('/auth/resend-verification-otp', { email });
      setCooldown(60);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to resend code');
    } finally {
      setResendLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-form-container animate-fade-in" style={{ textAlign: 'center' }}>
        <div style={{
          width: 80, height: 80, borderRadius: 'var(--radius-xl)',
          background: 'var(--color-success-light)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-6)',
          animation: 'scaleIn 0.4s ease-out',
        }}>
          <CheckCircle size={40} style={{ color: 'var(--color-success)' }} />
        </div>
        <h2 className="auth-form-title">Email Verified! 🎉</h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 'var(--space-2)' }}>
          Your account is now active. Redirecting you to sign in...
        </p>
      </div>
    );
  }

  return (
    <div className="auth-form-container animate-fade-in" style={{ textAlign: 'center' }}>
      <div style={{
        width: 64, height: 64, borderRadius: 'var(--radius-xl)',
        background: 'var(--color-primary-light)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-4)',
      }}>
        <Mail size={32} style={{ color: 'var(--color-primary)' }} />
      </div>

      <h2 className="auth-form-title">
        {autoSend ? 'Verify your email to continue' : 'Check your email'}
      </h2>
      <p style={{
        fontSize: 'var(--text-sm)', color: 'var(--text-secondary)',
        marginBottom: 'var(--space-8)', lineHeight: 'var(--leading-relaxed)',
      }}>
        {autoSend
          ? `We've sent a fresh verification code to your email. Please enter it below to activate your account.`
          : `We've sent a 6-digit verification code to`}
        {!autoSend && (
          <strong style={{ display: 'block', color: 'var(--text-primary)', marginTop: 'var(--space-1)' }}>
            {email}
          </strong>
        )}
      </p>

      {error && (
        <div style={{
          padding: 'var(--space-3) var(--space-4)',
          background: 'var(--color-danger-light)',
          color: 'var(--color-danger)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-sm)',
          marginBottom: 'var(--space-4)',
        }}>
          {error}
        </div>
      )}

      {/* OTP Input */}
      <div className="otp-container" onPaste={handlePaste}>
        {otp.map((digit, index) => (
          <input
            key={index}
            ref={(el) => (inputRefs.current[index] = el)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            className="otp-input"
            value={digit}
            onChange={(e) => handleOtpChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            autoFocus={index === 0}
            disabled={loading}
          />
        ))}
      </div>

      {loading && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 'var(--space-2)', marginTop: 'var(--space-4)', color: 'var(--text-secondary)',
          fontSize: 'var(--text-sm)',
        }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
          Verifying...
        </div>
      )}

      {/* Resend */}
      <div style={{ marginTop: 'var(--space-8)' }}>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
          Didn&apos;t receive the code?
        </p>
        <button
          className="btn btn-ghost"
          onClick={handleResend}
          disabled={cooldown > 0 || resendLoading}
        >
          {resendLoading ? (
            <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Sending...</>
          ) : cooldown > 0 ? (
            <>Resend in {cooldown}s</>
          ) : (
            <><RotateCcw size={16} /> Resend Code</>
          )}
        </button>
      </div>

      <p className="auth-link" style={{ marginTop: 'var(--space-6)' }}>
        <Link href="/login">← Back to Sign In</Link>
      </p>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="auth-form-container" style={{ textAlign: 'center' }}>
        <div className="spinner spinner-lg" style={{ margin: '0 auto' }} />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
