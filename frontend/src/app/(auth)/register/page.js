'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { isValidEmail, getPasswordStrength } from '@/lib/utils';
import { Mail, Lock, Eye, EyeOff, User as UserIcon, Building2, ArrowRight, Loader2 } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    confirmPassword: '',
    club: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const passwordStrength = getPasswordStrength(form.password);

  const handleChange = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.full_name.trim()) return setError('Please enter your full name');
    if (!isValidEmail(form.email)) return setError('Please enter a valid email address');
    if (form.password.length < 8) return setError('Password must be at least 8 characters');
    if (passwordStrength.score < 4) return setError('Password must include uppercase, lowercase, number, and special character');
    if (form.password !== form.confirmPassword) return setError('Passwords do not match');

    setLoading(true);
    const result = await register({
      full_name: form.full_name.trim(),
      email: form.email.trim(),
      password: form.password,
      club: form.club.trim() || undefined,
    });
    setLoading(false);

    if (result.success) {
      // Redirect to OTP verification
      router.push(`/verify-email?email=${encodeURIComponent(form.email)}`);
    } else {
      setError(result.error);
    }
  };

  const renderInput = (id, label, field, type, icon, placeholder, extra = {}) => {
    const Icon = icon;
    const isPassword = type === 'password';
    return (
      <div className="input-group">
        <label className="input-label" htmlFor={id}>{label}</label>
        <div style={{ position: 'relative' }}>
          <Icon size={18} style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-tertiary)', pointerEvents: 'none',
          }} />
          <input
            id={id}
            type={isPassword ? (showPassword ? 'text' : 'password') : type}
            className="input"
            placeholder={placeholder}
            value={form[field]}
            onChange={handleChange(field)}
            style={{ paddingLeft: 42, ...(isPassword ? { paddingRight: 42 } : {}) }}
            {...extra}
          />
          {isPassword && field === 'password' && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4,
              }}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="auth-form-container animate-fade-in">
      <h2 className="auth-form-title">Create your account</h2>
      <p className="auth-form-subtitle">Start managing resources effortlessly</p>

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
        {renderInput('reg-name', 'Full Name', 'full_name', 'text', UserIcon, 'Enter your full name', { required: true })}
        {renderInput('reg-email', 'Email Address', 'email', 'email', Mail, 'you@example.com', { required: true, autoComplete: 'email' })}
        {renderInput('reg-password', 'Password', 'password', 'password', Lock, 'Min. 8 characters', { required: true })}

        {/* Password strength bar */}
        {form.password && (
          <div style={{ marginTop: '-0.5rem' }}>
            <div style={{
              display: 'flex', gap: 4, marginBottom: 4,
            }}>
              {[1, 2, 3, 4, 5].map((level) => (
                <div key={level} style={{
                  flex: 1,
                  height: 3,
                  borderRadius: 2,
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

        {renderInput('reg-confirm', 'Confirm Password', 'confirmPassword', 'password', Lock, 'Re-enter your password', { required: true })}
        {renderInput('reg-club', 'Club / Department (Optional)', 'club', 'text', Building2, 'e.g. Engineering Club')}

        <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
          {loading ? (
            <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Creating account...</>
          ) : (
            <>Create Account <ArrowRight size={18} /></>
          )}
        </button>
      </form>

      <p className="auth-link">
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </div>
  );
}
