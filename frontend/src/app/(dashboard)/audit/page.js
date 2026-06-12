'use client';

import { useState, useEffect } from 'react';
import { useFetch } from '@/hooks/useFetch';
import { usePagination } from '@/hooks/usePagination';
import { formatDateTime } from '@/lib/utils';
import { FileText, ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react';

const getPersonInfo = (log) => {
  const meta = log.metadata_ || log.metadata || log.payload || {};
  
  const adminName = log.admin_name || meta.approving_admin_name || meta.admin_name || meta.granted_by_name || meta.approved_by_name || log.approving_admin_name;
  const adminEmail = log.admin_email || meta.approving_admin_email || meta.admin_email || meta.granted_by_email || meta.approved_by_email || log.approving_admin_email;
  const userName = log.user_name || meta.approved_admin_name || meta.user_name || meta.granted_to_name || meta.booked_by_name || meta.target_user_name || log.approved_admin_name;
  const userEmail = log.user_email || meta.approved_admin_email || meta.user_email || meta.granted_to_email || meta.booked_by_email || meta.target_user_email || log.approved_admin_email;
  
  const adminId = log.user_id || meta.admin_id;
  const userId = log.entity_type === 'user' ? log.entity_id : (meta.user_id || log.target_user_id || log.entity_id);

  return { adminName, adminEmail, userName, userEmail, adminId, userId };
};

const renderDetails = (log, activeTab) => {
  const meta = log.metadata_ || log.metadata || {};
  const action = log.action || '';
  
  if (action === 'ADMIN_PRIVILEGE_GRANTED' || action === 'ADMIN_PRIVILEGE_REVOKED') {
    const pInfo = getPersonInfo(log);
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: 'var(--text-xs)' }}>
        {log.description && <div style={{ marginBottom: '4px' }}>{log.description}</div>}
        <div style={{ padding: '8px', background: 'var(--bg-surface-hover)', borderRadius: '4px' }}>
          <div style={{ marginBottom: '4px' }}>
            <strong>Granted By:</strong> {pInfo.adminName ? `${pInfo.adminName} (${pInfo.adminEmail || '—'})` : (pInfo.adminId ? `Admin ID: ${pInfo.adminId.substring(0,8)}...` : 'System')}
          </div>
          <div>
            <strong>Granted To:</strong> {pInfo.userName ? `${pInfo.userName} (${pInfo.userEmail || '—'})` : (pInfo.userId ? `User ID: ${pInfo.userId.substring(0,8)}...` : 'User')}
          </div>
        </div>
      </div>
    );
  }
  
  if (action.includes('BOOKING')) {
    const assetName = meta.asset_name || log.asset_name;
    const unit = meta.unit || meta.asset_unit || log.unit;
    const userName = meta.user_name || meta.booked_by_name || log.user_name;
    const userEmail = meta.user_email || meta.booked_by_email || log.user_email;
    const adminName = meta.admin_name || meta.approved_by_name || log.admin_name;
    const adminEmail = meta.admin_email || meta.approved_by_email || log.admin_email;
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: 'var(--text-xs)' }}>
        {log.description && <div style={{ marginBottom: '4px' }}>{log.description}</div>}
        <div style={{ padding: '8px', background: 'var(--bg-surface-hover)', borderRadius: '4px' }}>
          <div style={{ marginBottom: '4px' }}><strong>Asset:</strong> {assetName || '—'} {unit ? `(Unit: ${unit})` : ''}</div>
          {userName && <div style={{ marginBottom: '4px' }}><strong>Booked By:</strong> {userName} ({userEmail || '—'})</div>}
          {(action === 'BOOKING_APPROVED' || action === 'BOOKING_REJECTED') && adminName && (
            <div><strong>{action === 'BOOKING_APPROVED' ? 'Approved By:' : 'Rejected By:'}</strong> {adminName} ({adminEmail || '—'})</div>
          )}
          {meta.purpose && <div style={{ marginTop: '4px' }}><strong>Purpose:</strong> {meta.purpose}</div>}
          {meta.quantity && <div><strong>Quantity:</strong> {meta.quantity}</div>}
        </div>
      </div>
    );
  }
  
  const metaEntries = Object.entries(meta).filter(([k, v]) => v !== null && v !== undefined && v !== '' && typeof v !== 'object');
  const formatKey = (k) => k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: 'var(--text-xs)' }}>
      {(log.description || log.details || log.notes) && (
        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '1.4' }}>
          {log.description || log.details || log.notes}
        </div>
      )}
      
      {metaEntries.length > 0 && (
        <div style={{ marginTop: '4px', padding: '8px', background: 'var(--bg-surface-hover)', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {metaEntries.map(([k, v]) => (
            <div key={k}>
              <strong style={{ color: 'var(--text-secondary)' }}>{formatKey(k)}:</strong> {String(v)}
            </div>
          ))}
        </div>
      )}
      
      {metaEntries.length === 0 && activeTab === 'general' && log.entity_type === 'asset' && (log.asset_name || log.category) && (
        <div style={{ marginTop: 'var(--space-2)', padding: 'var(--space-2)', background: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-sm)' }}>
          {log.asset_name && <div><strong>Asset:</strong> {log.asset_name}</div>}
          {log.category && <div><strong>Category:</strong> {log.category}</div>}
        </div>
      )}
    </div>
  );
};

export default function AuditPage() {
  const { page, pageSize, totalPages, setPage, updateFromResponse } = usePagination(1, 20);
  const [activeTab, setActiveTab] = useState('general');
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');

  const { data: logs, loading: loadingLogs } = useFetch('/audit', {
    params: { entity_type: entityType, action, page, page_size: pageSize },
    deps: [entityType, action, page],
    skip: activeTab !== 'general',
  });

  const { data: adminLogs, loading: loadingAdminLogs } = useFetch('/audit/admin-approvals', {
    skip: activeTab !== 'admin_approvals',
  });

  useEffect(() => {
    if (activeTab === 'general' && logs) updateFromResponse(logs);
  }, [logs, activeTab]);

  const logList = logs?.items || logs?.data || (Array.isArray(logs) ? logs : []);
  const adminLogList = adminLogs?.items || adminLogs?.data || (Array.isArray(adminLogs) ? adminLogs : []);

  const loading = activeTab === 'general' ? loadingLogs : loadingAdminLogs;
  const currentLogs = activeTab === 'general' ? logList : adminLogList;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title"><FileText size={28} /> Audit Logs</h1>
          <p className="page-subtitle">System-wide activity trail</p>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 'var(--space-6)' }}>
        <button className={`tab ${activeTab === 'general' ? 'active' : ''}`} onClick={() => { setActiveTab('general'); setPage(1); }}>
          General Activity
        </button>
        <button className={`tab ${activeTab === 'admin_approvals' ? 'active' : ''}`} onClick={() => setActiveTab('admin_approvals')}>
          <ShieldCheck size={16} /> Admin Approvals
        </button>
      </div>

      {/* Filters for general tab */}
      {activeTab === 'general' && (
        <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
          <select className="input" value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(1); }}
            style={{ height: 38, width: 'auto', minWidth: 160 }}>
            <option value="">All Entities</option>
            <option value="asset_model">Assets</option>
            <option value="booking">Bookings</option>
            <option value="user">Users</option>
          </select>
          <select className="input" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}
            style={{ height: 38, width: 'auto', minWidth: 140 }}>
            <option value="">All Actions</option>
            <option value="ASSET_CREATED">Asset Created</option>
            <option value="ASSET_UPDATED">Asset Updated</option>
            <option value="ASSET_DELETED">Asset Deleted</option>
            <option value="BOOKING_CREATED">Booking Created</option>
            <option value="BOOKING_APPROVED">Booking Approved</option>
            <option value="BOOKING_REJECTED">Booking Rejected</option>
            <option value="ADMIN_PRIVILEGE_GRANTED">Admin Privilege Granted</option>
            <option value="ADMIN_PRIVILEGE_REVOKED">Admin Privilege Revoked</option>
          </select>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {[...Array(8)].map((_, i) => <div key={i} className="skeleton" style={{ height: 48 }} />)}
        </div>
      ) : currentLogs.length > 0 ? (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                {activeTab === 'general' && <th>Entity</th>}
                <th>{activeTab === 'admin_approvals' ? 'Admin & User' : 'User / Admin'}</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {currentLogs.map((log) => (
                <tr key={log.id}>
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
                  {activeTab === 'general' && (
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', textTransform: 'capitalize' }}>
                        {log.entity_type}
                      </div>
                      {log.entity_id && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                          ID: {log.entity_id.substring(0, 8)}...
                        </div>
                      )}
                    </td>
                  )}
                  <td style={{ fontSize: 'var(--text-sm)' }}>
                    {(() => {
                      const pInfo = getPersonInfo(log);
                      return activeTab === 'admin_approvals' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                          <div>
                            <span style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 700 }}>Approved By (Admin)</span>
                            <div style={{ fontWeight: 600 }}>{pInfo.adminName || 'System'}</div>
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                              {pInfo.adminEmail || (pInfo.adminId ? `ID: ${pInfo.adminId.substring(0,8)}...` : '—')}
                            </div>
                          </div>
                          <div>
                            <span style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 700 }}>Approved To (User)</span>
                            <div style={{ fontWeight: 600 }}>{pInfo.userName || 'Unknown User'}</div>
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                              {pInfo.userEmail || (pInfo.userId ? `ID: ${pInfo.userId.substring(0,8)}...` : '—')}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={{ fontWeight: 600 }}>{pInfo.userName || pInfo.adminName || 'System'}</div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                            {pInfo.adminEmail || pInfo.userEmail || (log.user_id ? `ID: ${log.user_id.substring(0,8)}...` : '—')}
                          </div>
                        </>
                      );
                    })()}
                  </td>
                  <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', maxWidth: activeTab === 'general' ? 300 : 400 }}>
                    {renderDetails(log, activeTab)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon"><FileText size={32} /></div>
          <h3 className="empty-state-title">No audit logs</h3>
          <p className="empty-state-desc">No matching log entries found.</p>
        </div>
      )}

      {activeTab === 'general' && totalPages > 1 && (
        <div className="pagination">
          <button className="pagination-btn" onClick={() => setPage(page - 1)} disabled={page <= 1}><ChevronLeft size={16} /></button>
          {[...Array(Math.min(totalPages, 7))].map((_, i) => (
            <button key={i + 1} className={`pagination-btn ${page === i + 1 ? 'active' : ''}`} onClick={() => setPage(i + 1)}>{i + 1}</button>
          ))}
          <button className="pagination-btn" onClick={() => setPage(page + 1)} disabled={page >= totalPages}><ChevronRight size={16} /></button>
        </div>
      )}
    </div>
  );
}
