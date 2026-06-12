'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useFetch } from '@/hooks/useFetch';
import { formatDateTime } from '@/lib/utils';
import { ListOrdered, ArrowLeft, Clock, User, ShieldAlert } from 'lucide-react';

export default function QueueModelPage() {
  const { modelId } = useParams();
  const { isAdmin } = useAuth();
  
  const { data: queueItems, loading } = useFetch(`/queue/${modelId}`);
  const list = Array.isArray(queueItems) ? queueItems : queueItems?.items || queueItems?.data || [];

  if (!isAdmin) {
    return (
      <div className="page-content" style={{ maxWidth: 800 }}>
        <div className="empty-state">
          <ShieldAlert size={48} style={{ color: 'var(--color-danger)', marginBottom: 'var(--space-4)' }} />
          <h3 className="empty-state-title">Access Denied</h3>
          <p className="empty-state-desc">Only administrators can view the full waitlist for an asset.</p>
          <Link href="/queue" className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }}>
            <ArrowLeft size={16} /> Back to My Queue
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content" style={{ maxWidth: 800 }}>
      <Link href={`/assets/${modelId}`} style={{
        display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
        fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)',
        textDecoration: 'none',
      }}>
        <ArrowLeft size={16} /> Back to Asset
      </Link>

      <div className="page-header">
        <div>
          <h1 className="page-title"><ListOrdered size={28} /> Waitlist Details</h1>
          <p className="page-subtitle">Current queue for model <code>{modelId}</code></p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 64 }} />)}
        </div>
      ) : list.length > 0 ? (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 80 }}>Position</th>
                <th>User</th>
                <th>Reliability Score</th>
                <th>Joined At</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((item, idx) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 800, fontSize: 'var(--text-lg)', color: 'var(--color-primary)' }}>
                    #{item.position || idx + 1}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <User size={14} /> {item.user_name || item.user_email || 'User'}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${item.reliability_score >= 80 ? 'badge-success' : item.reliability_score >= 50 ? 'badge-warning' : 'badge-danger'}`}>
                      {item.reliability_score || 'N/A'}
                    </span>
                  </td>
                  <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock size={14} /> {formatDateTime(item.joined_at || item.created_at)}
                  </td>
                  <td>
                    <span className={`badge ${item.status === 'active' ? 'badge-info' : 'badge-neutral'}`}>
                      {item.status || 'Active'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon"><ListOrdered size={32} /></div>
          <h3 className="empty-state-title">Waitlist is empty</h3>
          <p className="empty-state-desc">No users are currently waiting for this asset.</p>
        </div>
      )}
    </div>
  );
}
