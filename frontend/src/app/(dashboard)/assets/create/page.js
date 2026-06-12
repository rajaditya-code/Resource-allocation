'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Package, Plus, Loader2, Image as ImageIcon } from 'lucide-react';
import { getErrorMessage } from '@/lib/utils';

export default function CreateAssetPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '', category: '', description: '', location: '',
    purchase_date: '', status: 'Available',
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Name is required');
    if (!form.category.trim()) return toast.error('Category is required');

    setLoading(true);
    try {
      const { data } = await api.post('/assets', {
        ...form,
        name: form.name.trim(),
        category: form.category.trim(),
        description: form.description.trim(),
        location: form.location.trim(),
        purchase_date: form.purchase_date || undefined,
      });
      toast.success('Asset created successfully! 🎉');
      router.push(`/assets/${data.id}`);
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to create asset');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-content" style={{ maxWidth: 640 }}>
      <Link href="/assets" style={{
        display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
        fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)',
        textDecoration: 'none',
      }}>
        <ArrowLeft size={16} /> Back to Assets
      </Link>

      <h1 className="page-title" style={{ marginBottom: 'var(--space-6)' }}>
        <Plus size={28} /> Create New Asset
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
            {loading ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Creating...</> : <><Package size={18} /> Create Asset</>}
          </button>
        </div>
      </form>
    </div>
  );
}
