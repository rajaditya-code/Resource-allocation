'use client';

import Link from 'next/link';
import { useFetch } from '@/hooks/useFetch';
import { formatDate, timeAgo } from '@/lib/utils';
import { BOOKING_STATUS } from '@/lib/constants';
import { CalendarCheck, Calendar, Clock, ArrowRight } from 'lucide-react';

export default function MyBookingsPage() {
  const { data: bookings, loading } = useFetch('/bookings/my');
  const bookingList = Array.isArray(bookings) ? bookings : bookings?.items || [];

  const groupedBookings = {
    active: bookingList.filter((b) => ['active', 'approved', 'pending'].includes((b.status || '').toLowerCase())),
    past: bookingList.filter((b) => ['returned', 'cancelled', 'rejected', 'overdue'].includes((b.status || '').toLowerCase())),
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title"><CalendarCheck size={28} /> My Bookings</h1>
          <p className="page-subtitle">Track all your resource requests</p>
        </div>
        <Link href="/assets" className="btn btn-primary">
          <Calendar size={16} /> Book an Asset
        </Link>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 80 }} />)}
        </div>
      ) : bookingList.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><CalendarCheck size={32} /></div>
          <h3 className="empty-state-title">No bookings yet</h3>
          <p className="empty-state-desc">Browse the asset catalog and request your first booking.</p>
          <Link href="/assets" className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }}>
            Browse Assets
          </Link>
        </div>
      ) : (
        <>
          {/* Active Bookings */}
          {groupedBookings.active.length > 0 && (
            <div style={{ marginBottom: 'var(--space-8)' }}>
              <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Clock size={18} style={{ color: 'var(--color-primary)' }} /> Active & Pending
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {groupedBookings.active.map((booking, idx) => (
                  <Link href={`/bookings/${booking.booking_id || booking.id}`} key={booking.booking_id || booking.id} style={{ textDecoration: 'none' }}>
                    <div className="card card-interactive animate-fade-in" style={{ animationDelay: `${idx * 60}ms` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-1)' }}>
                            {booking.asset_model_name || booking.asset_name || 'Asset Booking'}
                          </h3>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', display: 'flex', gap: 'var(--space-3)' }}>
                            <span>Qty: {booking.quantity}</span>
                            <span>{formatDate(booking.start_date)} → {formatDate(booking.end_date)}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                          <span className={`badge ${BOOKING_STATUS[(booking.status || '').toLowerCase()]?.color || 'badge-neutral'}`}>
                            {BOOKING_STATUS[(booking.status || '').toLowerCase()]?.label || booking.status}
                          </span>
                          <ArrowRight size={16} style={{ color: 'var(--text-tertiary)' }} />
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Past Bookings */}
          {groupedBookings.past.length > 0 && (
            <div>
              <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: 'var(--space-3)', color: 'var(--text-secondary)' }}>
                Past Bookings
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {groupedBookings.past.map((booking) => (
                  <Link href={`/bookings/${booking.booking_id || booking.id}`} key={booking.booking_id || booking.id} style={{ textDecoration: 'none' }}>
                    <div className="card" style={{ padding: 'var(--space-3) var(--space-4)', opacity: 0.75 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                          <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                            {booking.asset_model_name || booking.asset_name || 'Asset'}
                          </span>
                          <span className={`badge ${BOOKING_STATUS[(booking.status || '').toLowerCase()]?.color || 'badge-neutral'}`}>
                            {BOOKING_STATUS[(booking.status || '').toLowerCase()]?.label || booking.status}
                          </span>
                        </div>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                          {timeAgo(booking.created_at)}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
