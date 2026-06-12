'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { NAV_ITEMS, APP_NAME } from '@/lib/constants';
import { getInitials } from '@/lib/utils';
import {
  LayoutDashboard, Package, CalendarCheck, Wrench, ListOrdered, Bell,
  CalendarRange, ClipboardCheck, AlertTriangle, BarChart3, QrCode,
  Download, FileText, ShieldCheck, ChevronLeft, ChevronRight, LogOut,
  User, Settings,
} from 'lucide-react';

const iconMap = {
  LayoutDashboard, Package, CalendarCheck, Wrench, ListOrdered, Bell,
  CalendarRange, ClipboardCheck, AlertTriangle, BarChart3, QrCode,
  Download, FileText, ShieldCheck,
};

export default function Sidebar({ collapsed, setCollapsed }) {
  const pathname = usePathname();
  const { user, isAdmin, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const renderNavItem = (item) => {
    const Icon = iconMap[item.icon] || Package;
    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

    return (
      <Link
        key={item.href}
        href={item.href}
        className={`sidebar-link ${isActive ? 'active' : ''}`}
        title={collapsed ? item.label : undefined}
      >
        <Icon size={20} className="sidebar-link-icon" />
        {!collapsed && <span>{item.label}</span>}
      </Link>
    );
  };

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="modal-overlay"
          style={{ zIndex: 'var(--z-overlay)' }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        {/* Header */}
        <div className="sidebar-header">
          <img src="/logo.png" alt={APP_NAME} className="sidebar-logo" />
          {!collapsed && <span className="sidebar-brand gradient-text">{APP_NAME}</span>}
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {/* Main Navigation */}
          <div className="sidebar-section">
            {!collapsed && <div className="sidebar-section-label">Navigation</div>}
            {NAV_ITEMS.main.map(renderNavItem)}
          </div>

          {/* Admin Navigation */}
          {isAdmin && (
            <div className="sidebar-section">
              {!collapsed && <div className="sidebar-section-label">Administration</div>}
              {NAV_ITEMS.admin.map(renderNavItem)}
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          {/* Collapse Toggle */}
          <button
            className="sidebar-link"
            onClick={() => setCollapsed(!collapsed)}
            style={{ marginBottom: 'var(--space-2)' }}
          >
            {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            {!collapsed && <span>Collapse</span>}
          </button>

          {/* User Info */}
          <Link href="/profile" className="sidebar-user" style={{ textDecoration: 'none' }}>
            <div className="sidebar-avatar">
              {user?.profile_image ? (
                <img src={user.profile_image} alt={user.full_name} />
              ) : (
                getInitials(user?.full_name)
              )}
            </div>
            {!collapsed && (
              <div className="sidebar-user-info">
                <div className="sidebar-user-name">{user?.full_name || 'User'}</div>
                <div className="sidebar-user-role">{user?.role || 'user'}</div>
              </div>
            )}
          </Link>
        </div>
      </aside>

      {/* Mobile hamburger button (rendered in Topbar) */}
    </>
  );
}
