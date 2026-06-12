'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useFetch } from '@/hooks/useFetch';
import { usePagination } from '@/hooks/usePagination';
import { formatDate, timeAgo } from '@/lib/utils';
import { BOOKING_STATUS } from '@/lib/constants';
import { CalendarRange, Search, ChevronLeft, ChevronRight } from 'lucide-react';

export default function AllBookingsPage() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const { page, pageSize, totalPages, setPage, updateFromResponse } = usePagination();
  const [status, setStatus] = useState('');

  const { data: bookings, loading } = useFetch('/bookings', {
    params: { status, page, page_size: pageSize },
    deps: [status, page],
  });

  useEffect(() => {
    if (bookings) updateFromResponse(bookings);
  }, [bookings]);

  const bookingList = bookings?.items || bookings?.data || (Array.isArray(bookings) ? bookings : []);

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title"><CalendarRange size={28} /> All Bookings</h1>
          <p className="page-subtitle">View and manage all booking records</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        {['', 'pending', 'approved', 'active', 'returned', 'overdue', 'cancelled', 'rejected'].map((s) => (
          <button key={s} className={`btn ${status === s ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => { setStatus(s); setPage(1); }}>
            {s ? BOOKING_STATUS[s]?.label || s : 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 56 }} />)}
        </div>
      ) : bookingList.length > 0 ? (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>User</th>
                <th>Qty</th>
                <th>Period</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {bookingList.map((b) => (
                <tr key={b.booking_id || b.id} onClick={() => router.push(`/bookings/${b.booking_id || b.id}`)} style={{ cursor: 'pointer' }}>
                  <td style={{ fontWeight: 600 }}>{b.asset_model_name || b.asset_name || 'Asset'}</td>
                  <td>{b.user_name || b.user_email || '—'}</td>
                  <td>{b.quantity}</td>
                  <td style={{ fontSize: 'var(--text-xs)' }}>
                    {formatDate(b.start_date)} — {formatDate(b.end_date)}
                  </td>
                  <td>
                    <span className={`badge ${BOOKING_STATUS[b.status]?.color || 'badge-neutral'}`}>
                      {BOOKING_STATUS[b.status]?.label || b.status}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>
                    {timeAgo(b.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon"><CalendarRange size={32} /></div>
          <h3 className="empty-state-title">No bookings found</h3>
          <p className="empty-state-desc">No bookings match your current filters.</p>
        </div>
      )}

      {totalPages > 1 && (
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
