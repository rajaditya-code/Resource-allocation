'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useFetch } from '@/hooks/useFetch';
import { formatDateTime } from '@/lib/utils';
import { FileText, ArrowLeft, Shield } from 'lucide-react';

export default function EntityAuditLogsPage() {
  const { entityType, entityId } = useParams();
  
  const { data: logs, loading } = useFetch(`/audit/entity/${entityType}/${entityId}`);
  const logList = Array.isArray(logs) ? logs : logs?.items || logs?.data || [];

  return (
    <div className="page-content" style={{ maxWidth: 800 }}>
      <button onClick={() => window.history.back()} className="btn btn-ghost" style={{ marginBottom: 'var(--space-4)', padding: 0 }}>
        <ArrowLeft size={16} /> Back
      </button>

      <div className="page-header">
        <div>
          <h1 className="page-title"><FileText size={28} /> Entity Audit Logs</h1>
          <p className="page-subtitle">
            Activity trail for {entityType} <code>{entityId}</code>
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 48 }} />)}
        </div>
      ) : logList.length > 0 ? (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>User</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logList.map((log) => (
                <tr key={log.id || log._id}>
                  <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                    {formatDateTime(log.timestamp || log.created_at)}
                  </td>
                  <td>
                    <span className={`badge ${
                      log.action?.includes('create') ? 'badge-success' :
                      log.action?.includes('delete') ? 'badge-danger' :
                      log.action?.includes('approve') ? 'badge-info' : 'badge-neutral'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td style={{ fontSize: 'var(--text-sm)' }}>
                    <div style={{ fontWeight: 600 }}>{log.user_name || 'System'}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                      {log.admin_email || log.user_email || log.user_id || '—'}
                    </div>
                  </td>
                  <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', maxWidth: 400 }}>
                    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '1.4' }}>
                      {log.description || log.details || log.notes || '—'}
                      
                      {entityType === 'asset' && (log.asset_name || log.category) && (
                        <div style={{ marginTop: 'var(--space-2)', padding: 'var(--space-2)', background: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-sm)' }}>
                          {log.asset_name && <div><strong>Asset:</strong> {log.asset_name}</div>}
                          {log.category && <div><strong>Category:</strong> {log.category}</div>}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon"><Shield size={32} /></div>
          <h3 className="empty-state-title">No audit logs</h3>
          <p className="empty-state-desc">No log entries found for this specific entity.</p>
        </div>
      )}
    </div>
  );
}
