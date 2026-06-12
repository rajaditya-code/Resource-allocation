'use client';

import { useState } from 'react';
import { useFetch } from '@/hooks/useFetch';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';
import { ShieldCheck, CheckCircle, Loader2, Search } from 'lucide-react';

export default function AdminApprovalsPage() {
  const [searchEmail, setSearchEmail] = useState('');
  const { data: admins, loading, refetch } = useFetch('/auth/pending-admins', {
    params: searchEmail ? { email: searchEmail } : {},
    deps: [searchEmail],
  });
  const [processingId, setProcessingId] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(null);
  const [password, setPassword] = useState('');

  const adminList = Array.isArray(admins) ? admins : admins?.items || [];

  const handleApprove = async (id) => {
    if (!password.trim()) return toast.error('Please enter your password to confirm');
    setProcessingId(id);
    try {
      await api.post(`/auth/approve-admin/${id}`, { password });
      toast.success('Admin approved! 🎉');
      setShowPasswordModal(null);
      setPassword('');
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Approval failed');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="page-content" style={{ maxWidth: 800 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title"><ShieldCheck size={28} /> Admin Approvals</h1>
          <p className="page-subtitle">Review pending administrator registration requests</p>
        </div>
      </div>

      {/* Search by email */}
      <div className="card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)' }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-tertiary)', pointerEvents: 'none',
          }} />
          <input
            type="text"
            className="input"
            placeholder="Search by email..."
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
            style={{ paddingLeft: 40, height: 38 }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 80 }} />)}
        </div>
      ) : adminList.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><ShieldCheck size={32} /></div>
          <h3 className="empty-state-title">No pending requests</h3>
          <p className="empty-state-desc">There are no pending admin registrations to review.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {adminList.map((admin, idx) => (
            <div key={admin.id} className="card animate-fade-in" style={{ animationDelay: `${idx * 60}ms` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                <div>
                  <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-1)' }}>
                    {admin.full_name}
                  </h3>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                    {admin.email}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-1)' }}>
                    Requested on {formatDate(admin.created_at)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button className="btn btn-success btn-sm"
                    onClick={() => { setShowPasswordModal(admin.id); setPassword(''); }}
                    disabled={processingId === admin.id}>
                    {processingId === admin.id ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={14} />}
                    Approve
                  </button>
                </div>
              </div>

              {/* Password confirmation modal inline */}
              {showPasswordModal === admin.id && (
                <div className="animate-fade-in" style={{
                  marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)',
                  borderTop: '1px solid var(--border-color)',
                }}>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
                    Enter your admin password to confirm this approval:
                  </p>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <input
                      type="password"
                      className="input"
                      placeholder="Your password..."
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={{ flex: 1 }}
                      onKeyDown={(e) => e.key === 'Enter' && handleApprove(admin.id)}
                    />
                    <button className="btn btn-success btn-sm" onClick={() => handleApprove(admin.id)}
                      disabled={processingId === admin.id}>
                      Confirm
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setShowPasswordModal(null); setPassword(''); }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
