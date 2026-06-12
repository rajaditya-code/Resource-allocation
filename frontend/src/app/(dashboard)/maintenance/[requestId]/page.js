'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useFetch } from '@/hooks/useFetch';
import api from '@/lib/api';
import { formatDateTime, formatDate } from '@/lib/utils';
import { MAINTENANCE_STATUS, PRIORITY_MAP } from '@/lib/constants';
import toast from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { ArrowLeft, Wrench, Loader2, HeartPulse, FileText } from 'lucide-react';

export default function MaintenanceDetailPage() {
  const { requestId } = useParams();
  const { isAdmin } = useAuth();
  const { data: ticket, loading, refetch } = useFetch(`/maintenance/${requestId}`);
  const [updating, setUpdating] = useState(false);
  const [updateForm, setUpdateForm] = useState({ status: '', priority: '' });
  
  const [healthData, setHealthData] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(false);

  useEffect(() => {
    if (ticket?.asset_unit_id) {
      const fetchHealth = async () => {
        setLoadingHealth(true);
        try {
          const { data } = await api.get(`/maintenance/units/${ticket.asset_unit_id}/health`);
          setHealthData(data);
        } catch (err) {
          console.error("Failed to fetch health log", err);
        } finally {
          setLoadingHealth(false);
        }
      };
      fetchHealth();
    }
  }, [ticket?.asset_unit_id]);

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      const body = {};
      if (updateForm.status) body.status = updateForm.status;
      if (updateForm.priority) body.priority = updateForm.priority;
      await api.put(`/maintenance/${requestId}`, body);
      toast.success('Ticket updated!');
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Update failed');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <div className="page-content"><div className="page-loader"><div className="spinner spinner-lg" /></div></div>;

  if (!ticket) return (
    <div className="page-content">
      <div className="empty-state">
        <h3 className="empty-state-title">Ticket not found</h3>
        <Link href="/maintenance" className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }}>
          <ArrowLeft size={16} /> Back
        </Link>
      </div>
    </div>
  );

  return (
    <div className="page-content" style={{ maxWidth: 700 }}>
      <Link href="/maintenance" style={{
        display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
        fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)', textDecoration: 'none',
      }}>
        <ArrowLeft size={16} /> Back to Maintenance
      </Link>

      <h1 className="page-title" style={{ marginBottom: 'var(--space-2)' }}>
        <Wrench size={28} /> Maintenance Ticket
      </h1>

      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
        <span className={`badge ${PRIORITY_MAP[ticket.priority]?.color || 'badge-neutral'}`}>{ticket.priority}</span>
        <span className={`badge ${MAINTENANCE_STATUS[ticket.status]?.color || 'badge-neutral'}`}>{ticket.status}</span>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-3)' }}>Issue</h3>
        <p style={{ fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>{ticket.issue}</p>
        <div style={{ marginTop: 'var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
          Created {formatDateTime(ticket.created_at)}
        </div>
      </div>

      {healthData && (
        <div className="card animate-fade-in" style={{ marginBottom: 'var(--space-4)' }}>
          <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <HeartPulse size={18} style={{ color: 'var(--color-danger)' }} /> Unit Health Log
          </h3>
          <div className="grid-cols-3" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div style={{ padding: 'var(--space-3)', background: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Total Tickets</div>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800 }}>{healthData.total_tickets || 0}</div>
            </div>
            <div style={{ padding: 'var(--space-3)', background: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Condition</div>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800 }}>{healthData.current_condition || 'N/A'}</div>
            </div>
            <div style={{ padding: 'var(--space-3)', background: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Health Score</div>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800 }}>{healthData.health_score || '100'}%</div>
            </div>
          </div>
          
          {healthData.history && healthData.history.length > 0 && (
            <div>
              <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>Recent History</h4>
              <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {healthData.history.map((h, i) => (
                  <div key={i} style={{ padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontWeight: 600 }}>{h.issue}</span>
                      <span style={{ color: 'var(--text-tertiary)' }}>{formatDate(h.created_at)}</span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)' }}>Status: {h.status}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {isAdmin && (
        <div className="card">
          <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-4)' }}>Update Ticket</h3>
          <div className="grid-cols-2" style={{ gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            <div className="input-group">
              <label className="input-label">Status</label>
              <select className="input" value={updateForm.status} onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}>
                <option value="">No change</option>
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Priority</label>
              <select className="input" value={updateForm.priority} onChange={(e) => setUpdateForm({ ...updateForm, priority: e.target.value })}>
                <option value="">No change</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
          </div>
          <button className="btn btn-primary" onClick={handleUpdate} disabled={updating}>
            {updating ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : null}
            Update Ticket
          </button>
          
          <Link href={`/audit/entity/maintenance/${requestId}`} className="btn btn-secondary" style={{ marginLeft: 'var(--space-3)' }}>
            <FileText size={16} /> View Audit Logs
          </Link>
        </div>
      )}
    </div>
  );
}
