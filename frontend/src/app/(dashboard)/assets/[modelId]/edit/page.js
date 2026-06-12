'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useFetch } from '@/hooks/useFetch';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Loader2, Package } from 'lucide-react';
import { getErrorMessage } from '@/lib/utils';

export default function EditAssetPage() {
  const { modelId } = useParams();
  const router = useRouter();
  const { data: asset, loading: fetchLoading } = useFetch(`/assets/${modelId}`);
  const [form, setForm] = useState({
    name: '', category: '', description: '', location: '',
    purchase_date: '', status: 'Available',
  });
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (asset && !initialized) {
      setForm({
        name: asset.name || '',
        category: asset.category || '',
        description: asset.description || '',
        location: asset.location || '',
        purchase_date: asset.purchase_date?.split('T')[0] || '',
        status: asset.status || 'Available',
      });
      setInitialized(true);
    }
  }, [asset, initialized]);

  const handleChange = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Name is required');
    if (!form.category.trim()) return toast.error('Category is required');

    setLoading(true);
    try {
      await api.put(`/assets/${modelId}`, {
        ...form,
        name: form.name.trim(),
        category: form.category.trim(),
        description: form.description.trim(),
        location: form.location.trim(),
        purchase_date: form.purchase_date || undefined,
      });
      toast.success('Asset updated successfully! ✅');
      router.push(`/assets/${modelId}`);
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to update asset');
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) {
    return (
      <div className="page-content" style={{ maxWidth: 640 }}>
        <div className="skeleton" style={{ height: 24, width: 120, marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 36, width: '60%', marginBottom: 32 }} />
        <div className="skeleton" style={{ height: 400, borderRadius: 'var(--radius-lg)' }} />
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="page-content" style={{ maxWidth: 640 }}>
        <div className="empty-state">
          <div className="empty-state-icon"><Package size={32} /></div>
          <h3 className="empty-state-title">Asset not found</h3>
          <Link href="/assets" className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }}>
            <ArrowLeft size={16} /> Back to Assets
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content" style={{ maxWidth: 640 }}>
      <Link href={`/assets/${modelId}`} style={{
        display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
        fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)',
        textDecoration: 'none',
      }}>
        <ArrowLeft size={16} /> Back to {asset.name}
      </Link>

      <h1 className="page-title" style={{ marginBottom: 'var(--space-6)' }}>
        <Save size={28} /> Edit Asset
      </h1>

      <form onSubmit={handleSubmit} className="card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="input-group">
            <label className="input-label">Asset Name *</label>
            <input type="text" className="input" placeholder="e.g. Canon EOS R5"
              value={form.name} onChange={handleChange('name')} required />
          </div>
          <div className="grid-cols-2">
            <div className="input-group">
              <label className="input-label">Category *</label>
              <input type="text" className="input" placeholder="e.g. Camera"
                value={form.category} onChange={handleChange('category')} required />
            </div>
            <div className="input-group">
              <label className="input-label">Status</label>
              <select className="input" value={form.status} onChange={handleChange('status')}>
                <option value="Available">Available</option>
                <option value="Unavailable">Unavailable</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Damaged">Damaged</option>
              </select>
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Description</label>
            <textarea className="input" placeholder="Describe the asset..."
              value={form.description} onChange={handleChange('description')} rows={4} />
          </div>
          <div className="grid-cols-2">
            <div className="input-group">
              <label className="input-label">Location</label>
              <input type="text" className="input" placeholder="e.g. Storage Room B"
                value={form.location} onChange={handleChange('location')} />
            </div>
            <div className="input-group">
              <label className="input-label">Purchase Date</label>
              <input type="date" className="input"
                value={form.purchase_date} onChange={handleChange('purchase_date')} />
            </div>
          </div>
          <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ marginTop: 'var(--space-2)' }}>
            {loading ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</> : <><Save size={18} /> Save Changes</>}
          </button>
        </div>
      </form>
    </div>
  );
}
