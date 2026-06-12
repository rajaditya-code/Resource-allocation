'use client';

import { useEffect } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { timeAgo } from '@/lib/utils';
import { Bell, CheckCheck, Mail, MailOpen } from 'lucide-react';

export default function NotificationsPage() {
  const { notifications, loading, fetchNotifications, markAsRead, markAllAsRead, unreadCount } = useNotifications();

  useEffect(() => { fetchNotifications(); }, []);

  const notifList = Array.isArray(notifications) ? notifications : notifications?.items || [];

  return (
    <div className="page-content" style={{ maxWidth: 700 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title"><Bell size={28} /> Notifications</h1>
          <p className="page-subtitle">{unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}</p>
        </div>
        {unreadCount > 0 && (
          <button className="btn btn-secondary btn-sm" onClick={markAllAsRead}>
            <CheckCheck size={14} /> Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 72 }} />)}
        </div>
      ) : notifList.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Bell size={32} /></div>
          <h3 className="empty-state-title">No notifications</h3>
          <p className="empty-state-desc">You&apos;re all caught up! 🎉</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {notifList.map((notif) => (
            <div
              key={notif.id}
              className={`notification-item ${!notif.is_read ? 'unread' : ''}`}
              onClick={() => !notif.is_read && markAsRead(notif.id)}
            >
              <div style={{ marginTop: 2 }}>
                {notif.is_read ? (
                  <MailOpen size={18} style={{ color: 'var(--text-tertiary)' }} />
                ) : (
                  <Mail size={18} style={{ color: 'var(--color-primary)' }} />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: notif.is_read ? 400 : 600 }}>
                  {notif.message || notif.title || 'Notification'}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {timeAgo(notif.created_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
