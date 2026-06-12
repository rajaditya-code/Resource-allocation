'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { isValidEmail } from '@/lib/utils';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);
    const result = await login(email, password);
    setLoading(false);

    if (result.success) {
      router.push('/dashboard');
    } else {
      // If 403, could be unverified email or pending admin
      if (result.status === 403) {
        const msg = (result.error || '').toLowerCase();
        if (msg.includes('verify') || msg.includes('email') || msg.includes('unverified')) {
          // Redirect to verify email — auto-send OTP
          router.push(`/verify-email?email=${encodeURIComponent(email)}&auto=true`);
          return;
        }
        if (msg.includes('pending') || msg.includes('approval') || msg.includes('admin')) {
          setError('Your admin account is awaiting approval. You\'ll be notified once an administrator approves your access. Thanks for your patience! 🙏');
          return;
        }
      }
      setError(result.error || 'Invalid credentials. Please try again.');
    }
  };

  return (
    <div className="auth-form-container animate-fade-in">
      <h2 className="auth-form-title">Welcome back</h2>
      <p className="auth-form-subtitle">Sign in to your account to continue</p>

      {error && (
        <div style={{
          padding: 'var(--space-3) var(--space-4)',
          background: 'var(--color-danger-light)',
          color: 'var(--color-danger)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-sm)',
          marginBottom: 'var(--space-4)',
          animation: 'fadeIn 0.3s ease-out',
        }}>
          {error}
        </div>
      )}

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="input-group">
          <label className="input-label" htmlFor="login-email">Email Address</label>
          <div style={{ position: 'relative' }}>
            <Mail size={18} style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--text-tertiary)', pointerEvents: 'none',
            }} />
            <input
              id="login-email"
              type="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ paddingLeft: 42 }}
              autoComplete="email"
              required
            />
          </div>
        </div>

        <div className="input-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="input-label" htmlFor="login-password">Password</label>
            <Link href="/forgot-password" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-primary)' }}>
              Forgot password?
            </Link>
          </div>
          <div style={{ position: 'relative' }}>
            <Lock size={18} style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--text-tertiary)', pointerEvents: 'none',
            }} />
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              className="input"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ paddingLeft: 42, paddingRight: 42 }}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)',
                padding: 4,
              }}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ marginTop: 'var(--space-2)' }}>
          {loading ? (
            <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Signing in...</>
          ) : (
            <>Sign In <ArrowRight size={18} /></>
          )}
        </button>
      </form>

      <p className="auth-link">
        Don&apos;t have an account?{' '}
        <Link href="/register">Create one</Link>
      </p>
      <p className="auth-link" style={{ marginTop: 'var(--space-2)' }}>
        <Link href="/admin-register" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
          Register as Administrator →
        </Link>
      </p>
    </div>
  );
}
