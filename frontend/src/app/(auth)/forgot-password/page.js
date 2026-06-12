'use client';

import { useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { isValidEmail } from '@/lib/utils';
import { Mail, ArrowRight, Loader2, CheckCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!isValidEmail(email)) return setError('Please enter a valid email address');

    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send reset code');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="auth-form-container animate-fade-in" style={{ textAlign: 'center' }}>
        <div style={{
          width: 64, height: 64, borderRadius: 'var(--radius-xl)',
          background: 'var(--color-success-light)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-4)',
        }}>
          <CheckCircle size={32} style={{ color: 'var(--color-success)' }} />
        </div>
        <h2 className="auth-form-title">Reset Code Sent!</h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 'var(--space-2) 0 var(--space-6)', lineHeight: 'var(--leading-relaxed)' }}>
          We&apos;ve sent a password reset code to <strong>{email}</strong>. Check your inbox and use the code to set a new password.
        </p>
        <Link href={`/reset-password?email=${encodeURIComponent(email)}`} className="btn btn-primary btn-lg" style={{ display: 'inline-flex' }}>
          Enter Reset Code <ArrowRight size={18} />
        </Link>
        <p className="auth-link" style={{ marginTop: 'var(--space-4)' }}>
          <Link href="/login">← Back to Sign In</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="auth-form-container animate-fade-in">
      <h2 className="auth-form-title">Forgot your password?</h2>
      <p className="auth-form-subtitle">No worries! Enter your email and we&apos;ll send you a reset code.</p>

      {error && (
        <div style={{
          padding: 'var(--space-3) var(--space-4)', background: 'var(--color-danger-light)',
          color: 'var(--color-danger)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)',
        }}>{error}</div>
      )}

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="input-group">
          <label className="input-label" htmlFor="forgot-email">Email Address</label>
          <div style={{ position: 'relative' }}>
            <Mail size={18} style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--text-tertiary)', pointerEvents: 'none',
            }} />
            <input
              id="forgot-email"
              type="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              style={{ paddingLeft: 42 }}
              required
            />
          </div>
        </div>
        <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
          {loading ? (
            <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Sending...</>
          ) : (
            <>Send Reset Code <ArrowRight size={18} /></>
          )}
        </button>
      </form>

      <p className="auth-link">
        Remember your password? <Link href="/login">Sign in</Link>
      </p>
    </div>
  );
}
