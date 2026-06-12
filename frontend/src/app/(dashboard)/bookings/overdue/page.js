'use client';

import Link from 'next/link';
import { useFetch } from '@/hooks/useFetch';
import { formatDate, timeAgo } from '@/lib/utils';
import { AlertTriangle, ArrowRight } from 'lucide-react';

export default function OverdueBookingsPage() {
  const { data: bookings, loading } = useFetch('/bookings/overdue');
  const bookingList = Array.isArray(bookings) ? bookings : bookings?.items || [];

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ color: 'var(--color-danger)' }}>
            <AlertTriangle size={28} /> Overdue Returns
          </h1>
          <p className="page-subtitle">{bookingList.length} booking{bookingList.length !== 1 ? 's' : ''} past their return date</p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 80 }} />)}
        </div>
      ) : bookingList.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon" style={{ background: 'var(--color-success-light)' }}>
            <AlertTriangle size={32} style={{ color: 'var(--color-success)' }} />
          </div>
          <h3 className="empty-state-title">No overdue bookings! 🎉</h3>
          <p className="empty-state-desc">All resources have been returned on time.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {bookingList.map((booking, idx) => (
            <Link href={`/bookings/${booking.booking_id || booking.id}`} key={booking.booking_id || booking.id} style={{ textDecoration: 'none' }}>
              <div className="card card-interactive animate-fade-in"
                style={{ animationDelay: `${idx * 60}ms`, borderLeft: '3px solid var(--color-danger)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-1)' }}>
                      {booking.asset_model_name || booking.asset_name || 'Asset'}
                    </h3>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                      <strong>{booking.user_name || booking.user_email}</strong> · Due {formatDate(booking.end_date)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span className="badge badge-danger" style={{ animation: 'glowPulse 2s infinite' }}>
                      Overdue
                    </span>
                    <ArrowRight size={16} style={{ color: 'var(--text-tertiary)' }} />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
