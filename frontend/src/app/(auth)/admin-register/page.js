'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { isValidEmail } from '@/lib/utils';
import { Mail, Lock, Eye, EyeOff, UserIcon, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';

export default function AdminRegisterPage() {
  const { adminRegister } = useAuth();
  const [form, setForm] = useState({ full_name: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.full_name.trim()) return setError('Please enter your full name');
    if (!isValidEmail(form.email)) return setError('Please enter a valid email');
    if (form.password.length < 8) return setError('Password must be at least 8 characters');

    setLoading(true);
    const result = await adminRegister({
      full_name: form.full_name.trim(),
      email: form.email.trim(),
      password: form.password,
    });
    setLoading(false);

    if (result.success) {
      setSuccess(true);
    } else {
      setError(result.error);
    }
  };

  if (success) {
    return (
      <div className="auth-form-container animate-fade-in" style={{ textAlign: 'center' }}>
        <div style={{
          width: 80, height: 80, borderRadius: 'var(--radius-xl)',
          background: 'var(--color-primary-light)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-6)',
        }}>
          <ShieldCheck size={40} style={{ color: 'var(--color-primary)' }} />
        </div>
        <h2 className="auth-form-title">Registration Submitted! 🎉</h2>
        <p style={{
          fontSize: 'var(--text-sm)', color: 'var(--text-secondary)',
          marginTop: 'var(--space-3)', lineHeight: 'var(--leading-relaxed)',
          maxWidth: 360, margin: 'var(--space-3) auto 0',
        }}>
          Your admin registration has been received! An existing administrator will review and approve your account shortly.
          We&apos;ll send you an email once you&apos;re all set. Hang tight! ✨
        </p>
        <Link href="/login" className="btn btn-secondary" style={{ marginTop: 'var(--space-8)', display: 'inline-flex' }}>
          Back to Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="auth-form-container animate-fade-in">
      <h2 className="auth-form-title">Admin Registration</h2>
      <p className="auth-form-subtitle">Request administrator access to the platform</p>

      <div style={{
        padding: 'var(--space-3) var(--space-4)',
        background: 'var(--color-info-light)',
        color: 'var(--color-info)',
        borderRadius: 'var(--radius-md)',
        fontSize: 'var(--text-xs)',
        marginBottom: 'var(--space-4)',
        lineHeight: 'var(--leading-relaxed)',
      }}>
        💡 Admin accounts require approval from an existing administrator before access is granted.
      </div>

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

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="input-group">
          <label className="input-label" htmlFor="admin-name">Full Name</label>
          <input id="admin-name" type="text" className="input" placeholder="Enter your full name"
            value={form.full_name} onChange={handleChange('full_name')} required />
        </div>
        <div className="input-group">
          <label className="input-label" htmlFor="admin-email">Email Address</label>
          <input id="admin-email" type="email" className="input" placeholder="you@example.com"
            value={form.email} onChange={handleChange('email')} required />
        </div>
        <div className="input-group">
          <label className="input-label" htmlFor="admin-password">Password</label>
          <div style={{ position: 'relative' }}>
            <input
              id="admin-password"
              type={showPassword ? 'text' : 'password'}
              className="input"
              placeholder="Min. 8 characters"
              value={form.password}
              onChange={handleChange('password')}
              style={{ paddingRight: 42 }}
              required
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4,
              }}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
          {loading ? (
            <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Submitting...</>
          ) : (
            <>Submit Registration <ArrowRight size={18} /></>
          )}
        </button>
      </form>

      <p className="auth-link">
        Regular user? <Link href="/register">Create a standard account</Link>
      </p>
      <p className="auth-link" style={{ marginTop: 'var(--space-2)' }}>
        <Link href="/login">← Back to Sign In</Link>
      </p>
    </div>
  );
}
