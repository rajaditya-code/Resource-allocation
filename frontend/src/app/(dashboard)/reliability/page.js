'use client';

import { useAuth } from '@/lib/auth';
import { useFetch } from '@/hooks/useFetch';
import { formatDate, formatNumber } from '@/lib/utils';
import { Shield, TrendingUp, TrendingDown, Clock, CheckCircle, AlertTriangle } from 'lucide-react';

export default function ReliabilityPage() {
  const { user } = useAuth();
  const { data: score, loading } = useFetch(user?.id ? `/bookings/users/${user.id}/reliability` : null, { immediate: !!user?.id });
  const { data: history } = useFetch(user?.id ? `/bookings/users/${user.id}/reliability/history` : null, { immediate: !!user?.id });

  const historyList = Array.isArray(history) ? history : history?.items || [];

  const getScoreColor = (s) => {
    if (s >= 80) return 'var(--color-success)';
    if (s >= 50) return 'var(--color-warning)';
    return 'var(--color-danger)';
  };

  const scoreValue = score?.score ?? score?.reliability_score ?? 0;

  return (
    <div className="page-content" style={{ maxWidth: 700 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title"><Shield size={28} /> Reliability Score</h1>
          <p className="page-subtitle">Your trustworthiness and borrowing track record</p>
        </div>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 200 }} />
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

          {/* History */}
          {historyList.length > 0 && (
            <div className="card animate-fade-in" style={{ animationDelay: '100ms' }}>
              <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-4)' }}>Score History</h3>
              <div className="timeline">
                {historyList.slice(0, 10).map((item, idx) => (
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
