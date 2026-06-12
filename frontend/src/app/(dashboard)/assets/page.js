'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useFetch } from '@/hooks/useFetch';
import { usePagination } from '@/hooks/usePagination';
import { formatDate, truncate } from '@/lib/utils';
import { ASSET_STATUS } from '@/lib/constants';
import {
  Package, Search, Filter, Plus, Upload, Grid3x3, List,
  ChevronLeft, ChevronRight, MapPin,
} from 'lucide-react';

function AssetsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAdmin } = useAuth();
  const { page, pageSize, totalPages, setPage, updateFromResponse } = usePagination(1, 12);

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [viewMode, setViewMode] = useState('grid');

  const { data: assets, loading, refetch } = useFetch('/assets', {
    params: { search, category, status, page, page_size: pageSize },
    deps: [search, category, status, page],
  });
  const { data: categories } = useFetch('/assets/categories');

  useEffect(() => {
    if (assets) updateFromResponse(assets);
  }, [assets]);

  const assetList = assets?.items || assets?.data || (Array.isArray(assets) ? assets : []);

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title"><Package size={28} /> Asset Catalog</h1>
          <p className="page-subtitle">Browse and manage all available resources</p>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Link href="/assets/import" className="btn btn-secondary">
              <Upload size={16} /> Bulk Import
            </Link>
            <Link href="/assets/create" className="btn btn-primary">
              <Plus size={16} /> Add Asset
            </Link>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-4)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 280px' }}>
            <Search size={16} style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--text-tertiary)', pointerEvents: 'none',
            }} />
            <input
              type="text"
              className="input"
              placeholder="Search assets..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              style={{ paddingLeft: 40, height: 38 }}
            />
          </div>
          <select
            className="input"
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            style={{ height: 38, width: 'auto', minWidth: 160 }}
          >
            <option value="">All Categories</option>
            {Array.isArray(categories) && categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <select
            className="input"
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            style={{ height: 38, width: 'auto', minWidth: 140 }}
          >
            <option value="">All Statuses</option>
            <option value="Available">Available</option>
            <option value="Unavailable">Unavailable</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Damaged">Damaged</option>
          </select>
          <div style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
            <button
              className={`btn btn-ghost btn-icon btn-sm ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              style={viewMode === 'grid' ? { background: 'var(--color-primary-light)', color: 'var(--color-primary)' } : {}}
            >
              <Grid3x3 size={16} />
            </button>
            <button
              className={`btn btn-ghost btn-icon btn-sm ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              style={viewMode === 'list' ? { background: 'var(--color-primary-light)', color: 'var(--color-primary)' } : {}}
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid-auto">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="skeleton" style={{ height: 180, borderRadius: 0 }} />
              <div style={{ padding: 'var(--space-4)' }}>
                <div className="skeleton" style={{ height: 18, width: '70%', marginBottom: 8 }} />
                <div className="skeleton" style={{ height: 14, width: '40%' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Asset Grid */}
      {!loading && assetList.length > 0 && viewMode === 'grid' && (
        <div className="grid-auto">
          {assetList.map((asset, idx) => (
            <Link href={`/assets/${asset.id}`} key={asset.id} style={{ textDecoration: 'none' }}>
              <div className="asset-card animate-fade-in-up" style={{ animationDelay: `${idx * 50}ms` }}>
                <div style={{
                  height: 180, background: 'var(--bg-surface-hover)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden',
                }}>
                  {asset.primary_image || asset.image_url ? (
                    <img
                      src={asset.primary_image || asset.image_url}
                      alt={asset.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <Package size={48} style={{ color: 'var(--text-tertiary)', opacity: 0.3 }} />
                  )}
                </div>
                <div className="asset-card-body">
                  <h3 className="asset-card-name">{asset.name}</h3>
                  <div className="asset-card-category">{asset.category || 'Uncategorized'}</div>
                  <div className="asset-card-footer">
                    <span className={`badge ${
                      ASSET_STATUS[asset.status]?.color || 'badge-neutral'
                    }`}>
                      {ASSET_STATUS[asset.status]?.label || asset.status || 'Active'}
                    </span>
                    {asset.location && (
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={12} /> {truncate(asset.location, 20)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Asset List View */}
      {!loading && assetList.length > 0 && viewMode === 'list' && (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Location</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {assetList.map((asset) => (
                <tr key={asset.id} onClick={() => router.push(`/assets/${asset.id}`)} style={{ cursor: 'pointer' }}>
                  <td style={{ fontWeight: 600 }}>{asset.name}</td>
                  <td>{asset.category || '—'}</td>
                  <td>{asset.location || '—'}</td>
                  <td><span className={`badge ${ASSET_STATUS[asset.status]?.color || 'badge-neutral'}`}>
                    {ASSET_STATUS[asset.status]?.label || asset.status}
                  </span></td>
                  <td style={{ color: 'var(--text-tertiary)' }}>{formatDate(asset.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {!loading && assetList.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon"><Package size={32} /></div>
          <h3 className="empty-state-title">No assets found</h3>
          <p className="empty-state-desc">
            {search || category || status
              ? 'Try adjusting your filters to find what you\'re looking for.'
              : 'Get started by adding your first asset.'}
          </p>
          {isAdmin && !search && (
            <Link href="/assets/create" className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }}>
              <Plus size={16} /> Add First Asset
            </Link>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button className="pagination-btn" onClick={() => setPage(page - 1)} disabled={page <= 1}>
            <ChevronLeft size={16} />
          </button>
          {[...Array(Math.min(totalPages, 7))].map((_, i) => {
            const p = i + 1;
            return (
              <button key={p} className={`pagination-btn ${page === p ? 'active' : ''}`} onClick={() => setPage(p)}>
                {p}
              </button>
            );
          })}
          <button className="pagination-btn" onClick={() => setPage(page + 1)} disabled={page >= totalPages}>
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function AssetsPage() {
  return (
    <Suspense fallback={<div className="page-loader"><div className="spinner spinner-lg" /></div>}>
      <AssetsContent />
    </Suspense>
  );
}
