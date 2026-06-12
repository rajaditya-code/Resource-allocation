'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { getPasswordStrength } from '@/lib/utils';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { User, Lock, Mail, Building2, Shield, Loader2, Save, Camera, X } from 'lucide-react';

export default function ProfilePage() {
  const { user, isAdmin, updateProfile, uploadProfileImage } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Profile Form
  const [profileForm, setProfileForm] = useState({
    full_name: user?.full_name || '',
    club: user?.club || '',
  });

  // Password Form
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  const passwordStrength = getPasswordStrength(passwordForm.new_password);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateProfile(profileForm);
      toast.success('Profile updated successfully! 🎉');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordForm.new_password.length < 8) return toast.error('Password must be at least 8 characters');
    if (passwordStrength.score < 4) return toast.error('Password must include uppercase, lowercase, number, and special character');
    if (passwordForm.new_password !== passwordForm.confirm_password) return toast.error('New passwords do not match');

    setLoading(true);
    try {
      await api.post('/auth/change-password', {
        old_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      toast.success('Password changed successfully! 🔒');
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return toast.error('Image must be under 3MB');

    setImageUploading(true);
    try {
      await uploadProfileImage(file);
      toast.success('Profile picture updated! 📸');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to upload image');
    } finally {
      setImageUploading(false);
    }
  };

  if (!user) return <div className="page-content"><div className="page-loader"><div className="spinner spinner-lg" /></div></div>;

  const initials = user.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user.email?.[0]?.toUpperCase() || '?';

  return (
    <div className="page-content" style={{ maxWidth: 700 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title"><User size={28} /> Account Settings</h1>
          <p className="page-subtitle">Manage your profile and security preferences</p>
        </div>
      </div>

      {/* Profile Image Upload Area */}
      <div className="card animate-fade-in" style={{ marginBottom: 'var(--space-6)', textAlign: 'center' }}>
        <div style={{
          position: 'relative', width: 100, height: 100,
          margin: '0 auto var(--space-4)', cursor: 'pointer',
        }}
          onClick={() => fileInputRef.current?.click()}
        >
          {user.profile_image || user.avatar_url ? (
            <img
              src={user.profile_image || user.avatar_url}
              alt={user.full_name}
              style={{
                width: 100, height: 100, borderRadius: '50%',
                objectFit: 'cover', border: '3px solid var(--color-primary)',
              }}
            />
          ) : (
            <div style={{
              width: 100, height: 100, borderRadius: '50%',
              background: 'var(--color-primary)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: 'var(--text-2xl)', fontWeight: 800, color: '#fff',
              border: '3px solid var(--color-primary-light)',
            }}>
              {initials}
            </div>
          )}
          <div style={{
            position: 'absolute', bottom: 0, right: 0,
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--bg-surface)', border: '2px solid var(--border-color)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--shadow-sm)',
          }}>
            {imageUploading ? (
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: 'var(--color-primary)' }} />
            ) : (
              <Camera size={14} style={{ color: 'var(--text-secondary)' }} />
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleImageUpload}
          />
        </div>
        <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)' }}>{user.full_name}</div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{user.email}</div>
      </div>

      <div className="tabs" style={{ marginBottom: 'var(--space-6)' }}>
        <button className={`tab ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
          Profile Details
        </button>
        <button className={`tab ${activeTab === 'security' ? 'active' : ''}`} onClick={() => setActiveTab('security')}>
          Security
        </button>
      </div>

      {activeTab === 'profile' && (
        <form onSubmit={handleProfileSubmit} className="card animate-fade-in">
          <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-4)' }}>Personal Information</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="input-group">
              <label className="input-label">Email Address (Read-only)</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                <input type="email" className="input" value={user.email} disabled style={{ paddingLeft: 42, background: 'var(--bg-body)' }} />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Role</label>
              <div style={{ position: 'relative' }}>
                <Shield size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                <input type="text" className="input" value={isAdmin ? 'Administrator' : 'Standard User'} disabled style={{ paddingLeft: 42, background: 'var(--bg-body)', fontWeight: 600, color: isAdmin ? 'var(--color-primary)' : 'var(--text-primary)' }} />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Full Name</label>
              <div style={{ position: 'relative' }}>
                <User size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                <input type="text" className="input" value={profileForm.full_name} onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })} style={{ paddingLeft: 42 }} required />
              </div>
            </div>

            {!isAdmin && (
              <div className="input-group">
                <label className="input-label">Club / Department</label>
                <div style={{ position: 'relative' }}>
                  <Building2 size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                  <input type="text" className="input" value={profileForm.club} onChange={(e) => setProfileForm({ ...profileForm, club: e.target.value })} style={{ paddingLeft: 42 }} />
                </div>
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={loading} style={{ alignSelf: 'flex-start', marginTop: 'var(--space-2)' }}>
              {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
              Save Changes
            </button>
          </div>
        </form>
      )}

      {activeTab === 'security' && (
        <form onSubmit={handlePasswordSubmit} className="card animate-fade-in">
          <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-4)' }}>Change Password</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="input-group">
              <label className="input-label">Current Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                <input type="password" className="input" value={passwordForm.current_password} onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })} style={{ paddingLeft: 42 }} required />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">New Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                <input type="password" className="input" placeholder="Min. 8 characters" value={passwordForm.new_password} onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })} style={{ paddingLeft: 42 }} required />
              </div>
              
              {passwordForm.new_password && (
                <div style={{ marginTop: 'var(--space-2)' }}>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div key={level} style={{
                        flex: 1, height: 4, borderRadius: 2,
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
            </div>

            <div className="input-group">
              <label className="input-label">Confirm New Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                <input type="password" className="input" placeholder="Re-enter your new password" value={passwordForm.confirm_password} onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })} style={{ paddingLeft: 42 }} required />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading} style={{ alignSelf: 'flex-start', marginTop: 'var(--space-2)' }}>
              {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Lock size={16} />}
              Update Password
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
