'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useFetch } from '@/hooks/useFetch';
import { formatNumber, timeAgo, formatDate } from '@/lib/utils';
import {
  Package, CalendarCheck, Wrench, Clock, TrendingUp, AlertTriangle,
  Plus, BarChart3, ArrowRight, Activity, Zap, QrCode, ClipboardCheck,
} from 'lucide-react';

// Helper to extract a value from summary cards by label
function getCardValue(cards, label) {
  if (!Array.isArray(cards)) return 0;
  const card = cards.find((c) => c.label?.toLowerCase().includes(label.toLowerCase()));
  return card?.value ?? 0;
}

export default function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const { data: summary } = useFetch(isAdmin ? '/analytics/summary' : null, { immediate: !!isAdmin });
  const { data: activityFeed } = useFetch('/audit/activity-feed', { params: { limit: 8 } });
  const { data: myBookings } = useFetch('/bookings/my');
  const { data: pendingBookings } = useFetch(isAdmin ? '/bookings/pending' : null, { immediate: !!isAdmin });

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // Backend returns { cards: [{ label, value, ... }] } — extract named values
  const summaryCards = summary?.cards;

  const statsCards = isAdmin && summaryCards ? [
    {
      label: 'Total Assets',
      value: getCardValue(summaryCards, 'asset'),
      icon: Package,
      color: 'var(--color-primary)',
      bg: 'var(--color-primary-light)',
      href: '/assets',
    },
    {
      label: 'Active Bookings',
      value: getCardValue(summaryCards, 'active') || getCardValue(summaryCards, 'booking'),
      icon: CalendarCheck,
      color: 'var(--color-success)',
      bg: 'var(--color-success-light)',
      href: '/bookings',
    },
    {
      label: 'Open Tickets',
      value: getCardValue(summaryCards, 'maintenance') || getCardValue(summaryCards, 'open') || getCardValue(summaryCards, 'ticket'),
      icon: Wrench,
      color: 'var(--color-warning)',
      bg: 'var(--color-warning-light)',
      href: '/maintenance',
    },
    {
      label: 'Pending Approvals',
      value: getCardValue(summaryCards, 'pending'),
      icon: Clock,
      color: 'var(--color-accent)',
      bg: 'var(--color-accent-light)',
      href: '/bookings/pending',
    },
  ] : [];

  const userStats = !isAdmin ? [
    {
      label: 'My Active Bookings',
      value: Array.isArray(myBookings) ? myBookings.filter(b => (b.status || '').toLowerCase() === 'active' || (b.status || '').toLowerCase() === 'approved').length : 0,
      icon: CalendarCheck,
      color: 'var(--color-success)',
      bg: 'var(--color-success-light)',
      href: '/bookings/my',
    },
    {
      label: 'Pending Requests',
      value: Array.isArray(myBookings) ? myBookings.filter(b => (b.status || '').toLowerCase() === 'pending').length : 0,
      icon: Clock,
      color: 'var(--color-warning)',
      bg: 'var(--color-warning-light)',
      href: '/bookings/my',
    },
  ] : [];

  const displayStats = isAdmin ? statsCards : userStats;

  // Backend returns { items: [...] } for activity feed
  const feedItems = activityFeed?.items || (Array.isArray(activityFeed) ? activityFeed : []);

  return (
    <div className="page-content">
      {/* Welcome */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 800 }}>
          {greeting()}, <span className="gradient-text">{user?.full_name?.split(' ')[0]}</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-base)', marginTop: 'var(--space-1)' }}>
          Here&apos;s what&apos;s happening with your resources today
        </p>
      </div>

      {/* Stats Grid */}
      {displayStats.length > 0 && (
        <div className={isAdmin ? 'grid-cols-4' : 'grid-cols-2'} style={{ marginBottom: 'var(--space-8)' }}>
          {displayStats.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <Link href={stat.href} key={stat.label} style={{ textDecoration: 'none' }}>
                <div className="stats-card animate-fade-in-up" style={{ animationDelay: `${idx * 80}ms` }}>
                  <div className="stats-card-icon" style={{ background: stat.bg }}>
                    <Icon size={22} style={{ color: stat.color }} />
                  </div>
                  <div className="stats-card-value">{formatNumber(stat.value)}</div>
                  <div className="stats-card-label">{stat.label}</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Quick Actions */}
      <div className="card animate-fade-in" style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
          <Zap size={18} style={{ color: 'var(--color-warning)' }} />
          <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>Quick Actions</h2>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <Link href="/assets" className="btn btn-primary">
            <Package size={16} /> Browse Assets
          </Link>
          <Link href="/qr" className="btn btn-secondary">
            <QrCode size={16} /> Scan QR
          </Link>
          <Link href="/maintenance" className="btn btn-secondary">
            <Wrench size={16} /> Report Issue
          </Link>
          {isAdmin && (
            <>
              <Link href="/assets/create" className="btn btn-secondary">
                <Plus size={16} /> Add Asset
              </Link>
              <Link href="/analytics" className="btn btn-secondary">
                <BarChart3 size={16} /> View Analytics
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Activity Feed */}
      <div className="grid-cols-2" style={{ alignItems: 'start' }}>
        <div className="card animate-fade-in" style={{ animationDelay: '100ms' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Activity size={18} style={{ color: 'var(--color-primary)' }} />
              <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>Recent Activity</h2>
            </div>
            <Link href="/audit" style={{ fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', gap: 4 }}>
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {feedItems.length > 0 ? (
              feedItems.map((item, idx) => (
                <div key={item.id || idx} className="activity-item">
                  <div className="activity-dot" style={{
                    background: item.action?.includes('create') ? 'var(--color-success)' :
                      item.action?.includes('delete') ? 'var(--color-danger)' : 'var(--color-primary)'
                  }} />
                  <div>
                    <div className="activity-text">{item.description || item.message || `${item.action} on ${item.entity_type}`}</div>
                    <div className="activity-time">{timeAgo(item.timestamp)}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state" style={{ padding: 'var(--space-8) var(--space-4)' }}>
                <div className="empty-state-icon" style={{ width: 48, height: 48 }}>
                  <Activity size={24} />
                </div>
                <p className="empty-state-desc">No recent activity to show</p>
              </div>
            )}
          </div>
        </div>

        {/* Pending Approvals (admin) or Recent Bookings (user) */}
        {isAdmin ? (
          <div className="card animate-fade-in" style={{ animationDelay: '200ms' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <ClipboardCheck size={18} style={{ color: 'var(--color-warning)' }} />
                <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>Pending Approvals</h2>
              </div>
              <Link href="/bookings/pending" style={{ fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', gap: 4 }}>
                View all <ArrowRight size={12} />
              </Link>
            </div>
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {Array.isArray(pendingBookings) && pendingBookings.length > 0 ? (
                pendingBookings.slice(0, 8).map((booking) => (
                  <Link href={`/bookings/${booking.booking_id || booking.id}`} key={booking.booking_id || booking.id} style={{ textDecoration: 'none' }}>
                    <div className="activity-item" style={{ cursor: 'pointer' }}>
                      <div className="activity-dot" style={{ background: 'var(--color-warning)' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="activity-text" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {booking.asset_model_name || booking.asset_name || 'Asset Booking'}
                          </span>
                          <span className="badge badge-warning" style={{ flexShrink: 0 }}>Pending</span>
                        </div>
                        <div className="activity-time" style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                          <span>by {booking.user_name || booking.user_email || 'User'}</span>
                          <span>{formatDate(booking.start_date)} – {formatDate(booking.end_date)}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="empty-state" style={{ padding: 'var(--space-8) var(--space-4)' }}>
                  <div className="empty-state-icon" style={{ width: 48, height: 48 }}>
                    <ClipboardCheck size={24} />
                  </div>
                  <p className="empty-state-desc">No pending approvals 🎉</p>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>All booking requests have been handled</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="card animate-fade-in" style={{ animationDelay: '200ms' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <CalendarCheck size={18} style={{ color: 'var(--color-success)' }} />
                <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>Recent Bookings</h2>
              </div>
              <Link href="/bookings/my" style={{ fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', gap: 4 }}>
                View all <ArrowRight size={12} />
              </Link>
            </div>
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {Array.isArray(myBookings) && myBookings.length > 0 ? (
                myBookings.slice(0, 6).map((booking) => (
                  <Link href={`/bookings/${booking.booking_id || booking.id}`} key={booking.booking_id || booking.id} style={{ textDecoration: 'none' }}>
                    <div className="activity-item" style={{ cursor: 'pointer' }}>
                      <div>
                        <div className="activity-text">
                          {booking.asset_model_name || booking.asset_name || 'Asset Booking'}
                          <span className={`badge ${(booking.status || '').toLowerCase() === 'active' ? 'badge-success' :
                            (booking.status || '').toLowerCase() === 'pending' ? 'badge-warning' :
                            (booking.status || '').toLowerCase() === 'approved' ? 'badge-info' :
                            (booking.status || '').toLowerCase() === 'returned' ? 'badge-neutral' : 'badge-danger'
                          }`} style={{ marginLeft: 'var(--space-2)' }}>
                            {booking.status}
                          </span>
                        </div>
                        <div className="activity-time">{timeAgo(booking.created_at)}</div>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="empty-state" style={{ padding: 'var(--space-8) var(--space-4)' }}>
                  <div className="empty-state-icon" style={{ width: 48, height: 48 }}>
                    <CalendarCheck size={24} />
                  </div>
                  <p className="empty-state-desc">No bookings yet</p>
                  <Link href="/assets" className="btn btn-primary btn-sm" style={{ marginTop: 'var(--space-3)' }}>
                    Browse Assets
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
