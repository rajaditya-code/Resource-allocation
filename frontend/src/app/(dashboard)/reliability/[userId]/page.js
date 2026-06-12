'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useFetch } from '@/hooks/useFetch';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Shield, TrendingUp, TrendingDown, Clock, CheckCircle, AlertTriangle, ArrowLeft, Loader2 } from 'lucide-react';

export default function UserReliabilityPage() {
  const { userId } = useParams();
  const { isAdmin } = useAuth();
  
  const { data: score, loading, refetch: refetchScore } = useFetch(`/bookings/users/${userId}/reliability`);
  const { data: history, refetch: refetchHistory } = useFetch(`/bookings/users/${userId}/reliability/history`);

  const [adjusting, setAdjusting] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ amount: '', reason: '' });

  const historyList = Array.isArray(history) ? history : history?.items || [];

  const getScoreColor = (s) => {
    if (s >= 80) return 'var(--color-success)';
    if (s >= 50) return 'var(--color-warning)';
    return 'var(--color-danger)';
  };

  const scoreValue = score?.score ?? score?.reliability_score ?? 0;

  const handleAdjust = async (e) => {
    e.preventDefault();
    if (!adjustForm.amount || !adjustForm.reason) return toast.error('Both amount and reason are required');
    
    setAdjusting(true);
    try {
      await api.put(`/bookings/users/${userId}/reliability/adjust`, {
        adjustment: parseFloat(adjustForm.amount),
        reason: adjustForm.reason
      });
      toast.success('Reliability score adjusted successfully');
      setAdjustForm({ amount: '', reason: '' });
      refetchScore();
      refetchHistory();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to adjust score');
    } finally {
      setAdjusting(false);
    }
  };

  return (
    <div className="page-content" style={{ maxWidth: 700 }}>
      <Link href="/audit" style={{
        display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
        fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)',
        textDecoration: 'none',
      }}>
        <ArrowLeft size={16} /> Back
      </Link>

      <div className="page-header">
        <div>
          <h1 className="page-title"><Shield size={28} /> User Reliability</h1>
          <p className="page-subtitle">Trustworthiness and borrowing track record for user <code>{userId}</code></p>
        </div>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 200, marginBottom: 'var(--space-6)' }} />
      ) : (
        <>
          {/* Score Gauge */}
          <div className="card animate-fade-in" style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
            <div style={{
              width: 140, height: 140, borderRadius: '50%',
              border: `6px solid ${getScoreColor(scoreValue)}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto var(--space-4)',
              position: 'relative',
            }}>
              <div>
                <div style={{ fontSize: 'var(--text-4xl)', fontWeight: 900, lineHeight: 1, color: getScoreColor(scoreValue) }}>
                  {Math.round(scoreValue)}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>/ 100</div>
              </div>
            </div>

            <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-4)' }}>
              {scoreValue >= 80 ? '🌟 Excellent' : scoreValue >= 50 ? '👍 Good' : '⚠️ Needs Improvement'}
            </h3>

            {/* Breakdown */}
            {score && (
              <div className="grid-cols-3" style={{ gap: 'var(--space-4)' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, color: 'var(--color-success)', marginBottom: 4 }}>
                    <CheckCircle size={16} />
                  </div>
                  <div style={{ fontWeight: 700 }}>{score.on_time_returns ?? 0}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>On Time</div>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, color: 'var(--color-warning)', marginBottom: 4 }}>
                    <Clock size={16} />
                  </div>
                  <div style={{ fontWeight: 700 }}>{score.late_returns ?? 0}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Late</div>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, color: 'var(--color-danger)', marginBottom: 4 }}>
                    <AlertTriangle size={16} />
                  </div>
                  <div style={{ fontWeight: 700 }}>{score.damaged_returns ?? 0}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Damaged</div>
                </div>
              </div>
            )}
          </div>

          {/* Admin Adjust Form */}
          {isAdmin && (
            <div className="card animate-fade-in" style={{ marginBottom: 'var(--space-6)' }}>
              <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-4)' }}>Manual Adjustment</h3>
              <form onSubmit={handleAdjust} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
                <div className="input-group" style={{ width: 120 }}>
                  <label className="input-label">Adjustment (+/-)</label>
                  <input type="number" step="0.1" className="input" placeholder="e.g. -5.0"
                    value={adjustForm.amount} onChange={(e) => setAdjustForm({ ...adjustForm, amount: e.target.value })} required />
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">Reason</label>
                  <input type="text" className="input" placeholder="Explain why the score is being adjusted"
                    value={adjustForm.reason} onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })} required />
                </div>
                <button type="submit" className="btn btn-primary" disabled={adjusting} style={{ marginTop: 24 }}>
                  {adjusting ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Apply'}
                </button>
              </form>
            </div>
          )}

          {/* History */}
          {historyList.length > 0 && (
            <div className="card animate-fade-in" style={{ animationDelay: '100ms' }}>
              <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-4)' }}>Score History</h3>
              <div className="timeline">
                {historyList.slice(0, 15).map((item, idx) => (
                  <div key={idx} className="timeline-item">
                    <div className="timeline-dot completed" />
                    <div style={{ fontSize: 'var(--text-sm)' }}>
                      <span style={{ fontWeight: 600 }}>
                        {item.new_score > item.old_score ? (
                          <span style={{ color: 'var(--color-success)' }}><TrendingUp size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> +{(item.new_score - item.old_score).toFixed(1)}</span>
                        ) : (
                          <span style={{ color: 'var(--color-danger)' }}><TrendingDown size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> {(item.new_score - item.old_score).toFixed(1)}</span>
                        )}
                      </span>
                      {item.reason && <span style={{ color: 'var(--text-secondary)', marginLeft: 'var(--space-2)' }}>— {item.reason}</span>}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{formatDate(item.timestamp || item.created_at)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
