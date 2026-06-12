'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { getPasswordStrength } from '@/lib/utils';
import { Lock, KeyRound, ArrowRight, Loader2, CheckCircle } from 'lucide-react';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailFromQuery = searchParams.get('email') || '';

  const [form, setForm] = useState({
    email: emailFromQuery,
    otp_code: '',
    new_password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const passwordStrength = getPasswordStrength(form.new_password);

  const handleChange = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.otp_code.trim()) return setError('Please enter the reset code');
    if (form.new_password.length < 8) return setError('Password must be at least 8 characters');
    if (passwordStrength.score < 4) return setError('Password must include uppercase, lowercase, number, and special character');
    if (form.new_password !== form.confirmPassword) return setError('Passwords do not match');

    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        email: form.email.trim(),
        otp_code: form.otp_code.trim(),
        new_password: form.new_password,
      });
      setSuccess(true);
      setTimeout(() => router.push('/login'), 2500);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to reset password. Invalid or expired code.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-form-container animate-fade-in" style={{ textAlign: 'center' }}>
        <div style={{
          width: 80, height: 80, borderRadius: 'var(--radius-xl)',
          background: 'var(--color-success-light)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-6)',
        }}>
          <CheckCircle size={40} style={{ color: 'var(--color-success)' }} />
        </div>
        <h2 className="auth-form-title">Password Reset! 🔒</h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 'var(--space-2)' }}>
          Your password has been updated. Redirecting to sign in...
        </p>
      </div>
    );
  }

  return (
    <div className="auth-form-container animate-fade-in">
      <h2 className="auth-form-title">Reset your password</h2>
      <p className="auth-form-subtitle">Enter the code from your email and choose a new password</p>

      {error && (
        <div style={{
          padding: 'var(--space-3) var(--space-4)', background: 'var(--color-danger-light)',
          color: 'var(--color-danger)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)',
        }}>{error}</div>
      )}

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="input-group">
          <label className="input-label" htmlFor="reset-code">Reset Code</label>
          <div style={{ position: 'relative' }}>
            <KeyRound size={18} style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--text-tertiary)', pointerEvents: 'none',
            }} />
            <input
              id="reset-code"
              type="text"
              className="input"
              placeholder="Enter 6-digit code"
              value={form.otp_code}
              onChange={handleChange('otp_code')}
              style={{ paddingLeft: 42, letterSpacing: '0.2em', fontWeight: 600 }}
              maxLength={6}
              required
            />
          </div>
        </div>

        <div className="input-group">
          <label className="input-label" htmlFor="reset-password">New Password</label>
          <div style={{ position: 'relative' }}>
            <Lock size={18} style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--text-tertiary)', pointerEvents: 'none',
            }} />
            <input
              id="reset-password"
              type="password"
              className="input"
              placeholder="Min. 8 characters"
              value={form.new_password}
              onChange={handleChange('new_password')}
              style={{ paddingLeft: 42 }}
              required
            />
          </div>
        </div>

        {form.new_password && (
          <div style={{ marginTop: '-0.5rem' }}>
            <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
              {[1, 2, 3, 4, 5].map((level) => (
                <div key={level} style={{
                  flex: 1, height: 3, borderRadius: 2,
                  background: level <= passwordStrength.score ? passwordStrength.color : 'var(--border-color)',
                  transition: 'background 0.3s',
                }} />
              ))}
            </div>
            <span style={{ fontSize: 'var(--text-xs)', color: passwordStrength.color }}>
              {passwordStrength.label}
            </span>
          </div>
        )}

        <div className="input-group">
          <label className="input-label" htmlFor="reset-confirm">Confirm Password</label>
          <input
            id="reset-confirm"
            type="password"
            className="input"
            placeholder="Re-enter your password"
            value={form.confirmPassword}
            onChange={handleChange('confirmPassword')}
            required
          />
        </div>

        <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
          {loading ? (
            <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Resetting...</>
          ) : (
            <>Reset Password <ArrowRight size={18} /></>
          )}
        </button>
      </form>

      <p className="auth-link">
        <Link href="/login">← Back to Sign In</Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="auth-form-container" style={{ textAlign: 'center' }}>
        <div className="spinner spinner-lg" style={{ margin: '0 auto' }} />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
