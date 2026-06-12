'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';

export function useNotifications() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications/unread-count');
      setUnreadCount(data.unread_count || 0);
    } catch (err) {
      // Silently fail
    }
  }, []);

  const fetchNotifications = useCallback(async (page = 1, pageSize = 20) => {
    try {
      setLoading(true);
      const { data } = await api.get('/notifications', {
        params: { page, page_size: pageSize },
      });
      setNotifications(data);
      return data;
    } catch (err) {
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (notificationId) => {
    try {
      await api.put(`/notifications/${notificationId}/read`);
      window.dispatchEvent(new CustomEvent('notification-read', { detail: { id: notificationId } }));
    } catch (err) {
      // Silently fail
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await api.put('/notifications/read-all');
      window.dispatchEvent(new CustomEvent('notifications-read-all'));
    } catch (err) {
      // Silently fail
    }
  }, []);

  // Listen to cross-component sync events
  useEffect(() => {
    const handleRead = (e) => {
      const id = e.detail.id;
      setNotifications((prev) => {
        if (Array.isArray(prev)) {
          return prev.map((n) => (n.id === id ? { ...n, is_read: true } : n));
        } else if (prev?.items) {
          return { ...prev, items: prev.items.map((n) => (n.id === id ? { ...n, is_read: true } : n)) };
        }
        return prev;
      });
      setUnreadCount((prev) => Math.max(0, prev - 1));
    };

    const handleReadAll = () => {
      setNotifications((prev) => {
        if (Array.isArray(prev)) {
          return prev.map((n) => ({ ...n, is_read: true }));
        } else if (prev?.items) {
          return { ...prev, items: prev.items.map((n) => ({ ...n, is_read: true })) };
        }
        return prev;
      });
      setUnreadCount(0);
    };

    window.addEventListener('notification-read', handleRead);
    window.addEventListener('notifications-read-all', handleReadAll);
    
    return () => {
      window.removeEventListener('notification-read', handleRead);
      window.removeEventListener('notifications-read-all', handleReadAll);
    };
  }, []);

  // Poll every 30 seconds
  useEffect(() => {
    fetchUnreadCount();
    intervalRef.current = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(intervalRef.current);
  }, [fetchUnreadCount]);

  return {
    unreadCount,
    notifications,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    refreshCount: fetchUnreadCount,
  };
}

export default useNotifications;
