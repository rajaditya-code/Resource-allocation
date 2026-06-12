'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { useNotifications } from '@/hooks/useNotifications';
import { getInitials } from '@/lib/utils';
import {
  Search, Bell, Sun, Moon, Monitor, Menu, User,
  Settings, LogOut, ChevronRight,
} from 'lucide-react';

export default function Topbar({ collapsed, onMobileMenuToggle }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { unreadCount } = useNotifications();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Generate breadcrumb from pathname
  const getBreadcrumbs = () => {
    const parts = pathname.split('/').filter(Boolean);
    return parts.map((part, idx) => ({
      label: part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, ' '),
      isLast: idx === parts.length - 1,
    }));
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/assets?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  const themeIcon = () => {
    if (theme === 'dark') return <Moon size={18} />;
    if (theme === 'light') return <Sun size={18} />;
    return <Monitor size={18} />;
  };

  return (
    <header className={`topbar ${collapsed ? 'collapsed' : ''}`}>
      <div className="topbar-left">
        {/* Mobile menu button */}
        <button
          className="btn btn-ghost btn-icon"
          onClick={onMobileMenuToggle}
          style={{ display: 'none' }}
          id="mobile-menu-btn"
        >
          <Menu size={20} />
        </button>

        {/* Breadcrumb */}
        <div className="topbar-breadcrumb">
          {getBreadcrumbs().map((crumb, idx) => (
            <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {idx > 0 && <ChevronRight size={14} style={{ color: 'var(--text-tertiary)' }} />}
              {crumb.isLast ? (
                <span>{crumb.label}</span>
              ) : (
                <span style={{ color: 'var(--text-tertiary)' }}>{crumb.label}</span>
              )}
            </span>
          ))}
        </div>
      </div>

      <div className="topbar-right">
        {/* Search */}
        <form className="topbar-search" onSubmit={handleSearch}>
          <Search size={16} className="topbar-search-icon" />
          <input
            type="text"
            className="input"
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>

        {/* Theme Toggle */}
        <button
          className="theme-toggle tooltip"
          onClick={toggleTheme}
          data-tooltip={`Theme: ${theme}`}
          aria-label="Toggle theme"
        >
          {themeIcon()}
        </button>

        {/* Notifications */}
        <Link href="/notifications" className="notification-btn" aria-label="Notifications">
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="notification-badge">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>

        {/* User Menu */}
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <button
            className="user-menu"
            onClick={() => setShowUserMenu(!showUserMenu)}
            aria-label="User menu"
          >
            <div className="user-menu-avatar">
              {user?.profile_image ? (
                <img src={user.profile_image} alt={user.full_name} />
              ) : (
                getInitials(user?.full_name)
              )}
            </div>
          </button>

          {showUserMenu && (
            <div className="dropdown">
              <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{user?.full_name}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{user?.email}</div>
              </div>
              <Link href="/profile" className="dropdown-item" onClick={() => setShowUserMenu(false)}>
                <User size={16} /> Profile
              </Link>
              <Link href="/reliability" className="dropdown-item" onClick={() => setShowUserMenu(false)}>
                <Settings size={16} /> Reliability Score
              </Link>
              <div className="dropdown-divider" />
              <button className="dropdown-item" onClick={handleLogout} style={{ color: 'var(--color-danger)' }}>
                <LogOut size={16} /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
