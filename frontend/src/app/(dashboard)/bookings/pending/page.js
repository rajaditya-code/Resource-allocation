'use client';

import { useRouter } from 'next/navigation';
import { useFetch } from '@/hooks/useFetch';
import api from '@/lib/api';
import { formatDate, timeAgo } from '@/lib/utils';
import toast from 'react-hot-toast';
import { ClipboardCheck, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';

export default function PendingBookingsPage() {
  const router = useRouter();
  const { data: bookings, loading, refetch } = useFetch('/bookings/pending');
  const [processingId, setProcessingId] = useState(null);

  const bookingList = Array.isArray(bookings) ? bookings : bookings?.items || [];

  const handleAction = async (id, action, body = {}) => {
    setProcessingId(id);
    try {
      await api.put(`/bookings/${id}/${action}`, body);
      toast.success(`Booking ${action}d!`);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Action failed');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title"><ClipboardCheck size={28} /> Pending Approvals</h1>
          <p className="page-subtitle">{bookingList.length} booking{bookingList.length !== 1 ? 's' : ''} awaiting your review</p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 100 }} />)}
        </div>
      ) : bookingList.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><ClipboardCheck size={32} /></div>
          <h3 className="empty-state-title">All caught up! 🎉</h3>
          <p className="empty-state-desc">No pending booking requests at the moment.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {bookingList.map((booking, idx) => (
            <div key={booking.booking_id || booking.id} className="card animate-fade-in" style={{ animationDelay: `${idx * 60}ms` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-1)', cursor: 'pointer' }}
                    onClick={() => router.push(`/bookings/${booking.booking_id || booking.id}`)}>
                    {booking.asset_model_name || booking.asset_name || 'Asset'}
                  </h3>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-1)' }}>
                    Requested by <strong>{booking.user_name || booking.user_email}</strong> · Qty: {booking.quantity}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                    {formatDate(booking.start_date)} → {formatDate(booking.end_date)} · {timeAgo(booking.created_at)}
                  </div>
                  {booking.purpose && (
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 'var(--space-2)', fontStyle: 'italic' }}>
                      "{booking.purpose}"
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button className="btn btn-success btn-sm"
                    onClick={() => handleAction(booking.booking_id || booking.id, 'approve')}
                    disabled={processingId === (booking.booking_id || booking.id)}>
                    {processingId === (booking.booking_id || booking.id) ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={14} />}
                    Approve
                  </button>
                  <button className="btn btn-danger btn-sm"
                    onClick={() => {
                      const reason = prompt('Reason for rejection:');
                      if (reason) handleAction(booking.booking_id || booking.id, 'reject', { approval_notes: reason });
                    }}
                    disabled={processingId === (booking.booking_id || booking.id)}>
                    <XCircle size={14} /> Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
