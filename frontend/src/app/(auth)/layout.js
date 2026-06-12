'use client';

import { ThemeProvider } from '@/lib/theme';
import { AuthProvider } from '@/lib/auth';
import { APP_NAME, APP_DESCRIPTION } from '@/lib/constants';

export default function AuthLayout({ children }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <div className="auth-layout">
          <div className="auth-brand">
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <img
                src="/logo.png"
                alt={APP_NAME}
                style={{ width: 72, height: 72, marginBottom: '1.5rem', borderRadius: '16px' }}
              />
              <h1 className="auth-brand-title">{APP_NAME}</h1>
              <p className="auth-brand-subtitle">{APP_DESCRIPTION}</p>
            </div>

            {/* Decorative floating elements */}
            <div style={{
              position: 'absolute',
              width: 200,
              height: 200,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)',
              top: '10%',
              right: '-5%',
              animation: 'float 6s ease-in-out infinite',
            }} />
            <div style={{
              position: 'absolute',
              width: 120,
              height: 120,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.04)',
              bottom: '15%',
              left: '5%',
              animation: 'float 8s ease-in-out infinite',
              animationDelay: '2s',
            }} />
            <div style={{
              position: 'absolute',
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.05)',
              top: '40%',
              left: '15%',
              animation: 'float 5s ease-in-out infinite',
              animationDelay: '1s',
            }} />
          </div>
          <div className="auth-form-side">
            {children}
          </div>
        </div>
      </AuthProvider>
    </ThemeProvider>
  );
}
