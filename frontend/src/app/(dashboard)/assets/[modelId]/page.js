'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useFetch } from '@/hooks/useFetch';
import api, { uploadFile, uploadFiles } from '@/lib/api';
import { formatDate, formatNumber, getErrorMessage } from '@/lib/utils';
import { UNIT_STATUS, CONDITION_MAP } from '@/lib/constants';
import toast from 'react-hot-toast';
import {
  Package, ArrowLeft, Edit3, Trash2, Plus, Camera, Calendar,
  MapPin, Hash, AlertTriangle, X, Loader2, QrCode,
  CheckCircle, Save, Image as ImageIcon, Clock, Wrench, FileText, ListOrdered, History,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function AssetDetailPage() {
  const { modelId } = useParams();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const { data: asset, loading, refetch } = useFetch(`/assets/${modelId}`);
  const { data: units, refetch: refetchUnits } = useFetch(`/assets/${modelId}/units`);
  const { data: availability } = useFetch(`/assets/${modelId}/availability`);

  const [selectedImage, setSelectedImage] = useState(0);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    quantity: 1, purpose: '', start_date: '', end_date: '', asset_unit_id: '',
  });
  const [bookingLoading, setBookingLoading] = useState(false);

  // Add Units modal
  const [showAddUnits, setShowAddUnits] = useState(false);
  const [newUnits, setNewUnits] = useState([{ unit_code: '', serial_number: '', condition: 'Excellent' }]);
  const [addingUnits, setAddingUnits] = useState(false);

  // Edit Unit inline
  const [editingUnitId, setEditingUnitId] = useState(null);
  const [editUnitForm, setEditUnitForm] = useState({});

  // Damage report modal
  const [showDamageReport, setShowDamageReport] = useState(false);
  const [damageForm, setDamageForm] = useState({ asset_unit_id: '', remarks: '' });
  const [damagePhotos, setDamagePhotos] = useState([]);
  const [reportingDamage, setReportingDamage] = useState(false);

  // Image History modal
  const [showImageHistory, setShowImageHistory] = useState(false);
  const [imageHistoryData, setImageHistoryData] = useState([]);
  const [loadingImageHistory, setLoadingImageHistory] = useState(false);

  // Unit History modal
  const [viewingHistoryUnitId, setViewingHistoryUnitId] = useState(null);
  const [unitHistoryData, setUnitHistoryData] = useState([]);
  const [loadingUnitHistory, setLoadingUnitHistory] = useState(false);

  // Unit Details modal
  const [viewingUnit, setViewingUnit] = useState(null);

  const images = asset?.images || [];
  const unitList = Array.isArray(units) ? units : units?.items || [];

  // ─── Booking ───
  const handleBooking = async (e) => {
    e.preventDefault();
    setBookingLoading(true);
    try {
      await api.post('/bookings', {
        asset_model_id: modelId,
        quantity: parseInt(bookingForm.quantity),
        purpose: bookingForm.purpose,
        start_date: bookingForm.start_date,
        end_date: bookingForm.end_date,
        asset_unit_id: bookingForm.asset_unit_id || null,
      });
      toast.success('Booking request submitted! 🎉');
      setShowBookingForm(false);
      setBookingForm({ quantity: 1, purpose: '', start_date: '', end_date: '', asset_unit_id: '' });
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to create booking');
    } finally {
      setBookingLoading(false);
    }
  };

  // ─── Delete Model ───
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this asset? All units will be retired.')) return;
    try {
      await api.delete(`/assets/${modelId}`);
      toast.success('Asset deleted');
      router.push('/assets');
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to delete');
    }
  };

  // ─── Image Upload ───
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('is_primary', images.length === 0);
      await api.post(`/assets/${modelId}/images`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Image uploaded! 📸');
      refetch();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to upload image');
    }
  };

  // ─── Image Delete ───
  const handleImageDelete = async (imageId) => {
    if (!confirm('Delete this image?')) return;
    try {
      await api.delete(`/assets/${modelId}/images/${imageId}`);
      toast.success('Image deleted');
      setSelectedImage(0);
      refetch();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to delete image');
    }
  };

  // ─── Image History ───
  const openImageHistory = async () => {
    setShowImageHistory(true);
    setLoadingImageHistory(true);
    try {
      const { data } = await api.get(`/assets/${modelId}/images/history`);
      setImageHistoryData(Array.isArray(data) ? data : data.items || []);
    } catch (err) {
      toast.error('Failed to load image history');
    } finally {
      setLoadingImageHistory(false);
    }
  };

  // ─── Unit History ───
  const openUnitHistory = async (unitId) => {
    setViewingHistoryUnitId(unitId);
    setLoadingUnitHistory(true);
    try {
      const { data } = await api.get(`/bookings/units/${unitId}/history`);
      setUnitHistoryData(Array.isArray(data) ? data : data.items || []);
    } catch (err) {
      toast.error('Failed to load unit history');
    } finally {
      setLoadingUnitHistory(false);
    }
  };

  // ─── Add Units ───
  const addUnitRow = () => setNewUnits([...newUnits, { unit_code: '', serial_number: '', condition: 'Excellent' }]);
  const removeUnitRow = (idx) => setNewUnits(newUnits.filter((_, i) => i !== idx));
  const updateNewUnit = (idx, field, value) => {
    setNewUnits(prev => prev.map((u, i) => i === idx ? { ...u, [field]: value } : u));
  };

  const handleAddUnits = async () => {
    const valid = newUnits.filter(u => u.unit_code.trim());
    if (valid.length === 0) return toast.error('Please add at least one unit with a code');
    setAddingUnits(true);
    try {
      await api.post(`/assets/${modelId}/units`, { units: valid });
      toast.success(`${valid.length} unit(s) added! 📦`);
      setShowAddUnits(false);
      setNewUnits([{ unit_code: '', serial_number: '', condition: 'Excellent' }]);
      refetchUnits();
      refetch();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to add units');
    } finally {
      setAddingUnits(false);
    }
  };

  // ─── Edit Unit ───
  const startEditUnit = (unit) => {
    setEditingUnitId(unit.id);
    setEditUnitForm({
      serial_number: unit.serial_number || '',
      condition: unit.condition || 'Good',
      status: unit.status || 'available',
    });
  };

  const handleUpdateUnit = async (unitId) => {
    try {
      await api.put(`/assets/units/${unitId}`, editUnitForm);
      toast.success('Unit updated');
      setEditingUnitId(null);
      refetchUnits();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to update unit');
    }
  };

  // ─── Retire Unit ───
  const handleRetireUnit = async (unitId) => {
    if (!confirm('Retire this unit? This action is irreversible.')) return;
    try {
      await api.delete(`/assets/units/${unitId}`);
      toast.success('Unit retired');
      refetchUnits();
      refetch();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to retire unit');
    }
  };

  // ─── Damage Report ───
  const handleDamageReport = async (e) => {
    e.preventDefault();
    if (!damageForm.asset_unit_id || !damageForm.remarks) return toast.error('Fill all required fields');
    setReportingDamage(true);
    try {
      const formData = new FormData();
      formData.append('asset_unit_id', damageForm.asset_unit_id);
      formData.append('remarks', damageForm.remarks);
      damagePhotos.forEach(file => formData.append('photos', file));

      await api.post('/assets/report-damage', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Damage reported! Admin has been notified. 🚨');
      setShowDamageReport(false);
      setDamageForm({ asset_unit_id: '', remarks: '' });
      setDamagePhotos([]);
      refetchUnits();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to report damage');
    } finally {
      setReportingDamage(false);
    }
  };

  // ─── Parse availability ───
  const bookedDates = availability?.booked_dates || [];
  const maintenanceDates = availability?.maintenance_dates || [];
  const queueReservations = availability?.queue_reservations || [];

  if (loading) {
    return (
      <div className="page-content">
        <div className="skeleton" style={{ height: 32, width: 200, marginBottom: 24 }} />
        <div className="grid-cols-2" style={{ gap: 'var(--space-6)' }}>
          <div className="skeleton" style={{ height: 400, borderRadius: 'var(--radius-lg)' }} />
          <div>
            <div className="skeleton" style={{ height: 36, width: '60%', marginBottom: 16 }} />
            <div className="skeleton" style={{ height: 20, width: '40%', marginBottom: 24 }} />
            <div className="skeleton" style={{ height: 120, marginBottom: 16 }} />
            <div className="skeleton" style={{ height: 44 }} />
          </div>
        </div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="page-content">
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
    <div className="page-content">
      {/* Back */}
      <Link href="/assets" style={{
        display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
        fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)',
        textDecoration: 'none',
      }}>
        <ArrowLeft size={16} /> Back to Assets
      </Link>

      <div className="grid-cols-2" style={{ gap: 'var(--space-8)', alignItems: 'start' }}>
        {/* Image Gallery */}
        <div className="animate-fade-in">
          <div style={{
            borderRadius: 'var(--radius-lg)', overflow: 'hidden',
            background: 'var(--bg-surface-hover)', aspectRatio: '16/10',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid var(--border-color)',
            position: 'relative'
          }}>
            {images.length > 0 ? (
              <img
                src={images[selectedImage]?.url || images[selectedImage]?.image_url}
                alt={asset.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <Package size={64} style={{ color: 'var(--text-tertiary)', opacity: 0.3 }} />
            )}
            {isAdmin && (
              <div style={{ position: 'absolute', bottom: 16, right: 16, display: 'flex', gap: 'var(--space-2)' }}>
                {images[selectedImage] && (
                  <button
                    onClick={() => handleImageDelete(images[selectedImage].id)}
                    style={{
                      background: 'var(--bg-surface)', padding: 'var(--space-2) var(--space-3)',
                      borderRadius: 'var(--radius-full)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                      boxShadow: 'var(--shadow-md)', fontSize: 'var(--text-sm)',
                      fontWeight: 600, border: '1px solid var(--border-color)',
                      color: 'var(--color-danger)',
                    }}>
                    <Trash2 size={14} /> Delete
                  </button>
                )}
                <label style={{
                  background: 'var(--bg-surface)', padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-full)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                  boxShadow: 'var(--shadow-md)', fontSize: 'var(--text-sm)',
                  fontWeight: 600, border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)'
                }}>
                  <Camera size={16} />
                  <span>Upload</span>
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
                </label>
                <button
                  onClick={openImageHistory}
                  style={{
                    background: 'var(--bg-surface)', padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-full)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                    boxShadow: 'var(--shadow-md)', fontSize: 'var(--text-sm)',
                    fontWeight: 600, border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)'
                  }}>
                  <History size={16} />
                </button>
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="gallery-thumbs" style={{ marginTop: 'var(--space-3)' }}>
              {images.map((img, idx) => (
                <img
                  key={img.id || idx}
                  src={img.url || img.image_url}
                  alt=""
                  className={`gallery-thumb ${idx === selectedImage ? 'active' : ''}`}
                  onClick={() => setSelectedImage(idx)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="animate-slide-in-right">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, marginBottom: 'var(--space-1)' }}>
                {asset.name}
              </h1>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {asset.category || 'Uncategorized'}
              </div>
            </div>
            {isAdmin && (
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Link href={`/assets/${modelId}/edit`} className="btn btn-ghost btn-icon btn-sm">
                  <Edit3 size={16} />
                </Link>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={handleDelete} style={{ color: 'var(--color-danger)' }}>
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </div>

          {/* Meta */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', margin: 'var(--space-4) 0', fontSize: 'var(--text-sm)' }}>
            {asset.location && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                <MapPin size={14} /> {asset.location}
              </span>
            )}
            {asset.purchase_date && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                <Calendar size={14} /> Purchased {formatDate(asset.purchase_date)}
              </span>
            )}
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
              <Hash size={14} /> {unitList.length} unit{unitList.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Description */}
          {asset.description && (
            <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 'var(--leading-relaxed)' }}>
                {asset.description}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={() => setShowBookingForm(!showBookingForm)}>
              <Calendar size={18} />
              {showBookingForm ? 'Cancel' : 'Book This Asset'}
            </button>
            <button className="btn btn-danger btn-lg" onClick={() => {
              setDamageForm({ asset_unit_id: '', remarks: '' });
              setDamagePhotos([]);
              setShowDamageReport(true);
            }}>
              <AlertTriangle size={18} /> Report Damage
            </button>
            {isAdmin && (
              <>
                <Link href={`/audit/entity/asset/${modelId}`} className="btn btn-secondary btn-lg" title="View Audit Logs">
                  <FileText size={18} /> Logs
                </Link>
                <Link href={`/queue/${modelId}`} className="btn btn-secondary btn-lg" title="View Waitlist">
                  <ListOrdered size={18} /> Waitlist
                </Link>
              </>
            )}
          </div>

          {/* Booking Form */}
          {showBookingForm && (
            <form onSubmit={handleBooking} className="card animate-fade-in" style={{ marginTop: 'var(--space-4)' }}>
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
                Request Booking
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div className="grid-cols-2">
                  <div className="input-group">
                    <label className="input-label">Quantity</label>
                    <input type="number" className="input" min={1} value={bookingForm.quantity}
                      onChange={(e) => setBookingForm({ ...bookingForm, quantity: e.target.value })} required />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Preferred Unit (Optional)</label>
                    <select className="input" value={bookingForm.asset_unit_id}
                      onChange={(e) => setBookingForm({ ...bookingForm, asset_unit_id: e.target.value })}>
                      <option value="">Any Available Unit</option>
                      {unitList.filter(u => u.status === 'Available' || u.status === 'available').map(u => (
                        <option key={u.id} value={u.id}>{u.unit_code} {u.serial_number ? `(${u.serial_number})` : ''}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid-cols-2">
                  <div className="input-group">
                    <label className="input-label">Start Date</label>
                    <input type="date" className="input" value={bookingForm.start_date}
                      onChange={(e) => setBookingForm({ ...bookingForm, start_date: e.target.value })} required />
                  </div>
                  <div className="input-group">
                    <label className="input-label">End Date</label>
                    <input type="date" className="input" value={bookingForm.end_date}
                      onChange={(e) => setBookingForm({ ...bookingForm, end_date: e.target.value })} required />
                  </div>
                </div>
                <div className="input-group">
                  <label className="input-label">Purpose</label>
                  <textarea className="input" placeholder="Describe why you need this asset..."
                    value={bookingForm.purpose}
                    onChange={(e) => setBookingForm({ ...bookingForm, purpose: e.target.value })}
                    rows={3} required />
                </div>
                <button type="submit" className="btn btn-success btn-lg" disabled={bookingLoading}>
                  {bookingLoading ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Availability Calendar */}
      {(bookedDates.length > 0 || maintenanceDates.length > 0 || queueReservations.length > 0) && (
        <div className="card" style={{ marginTop: 'var(--space-6)' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
            <Calendar size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} />
            Availability
          </h2>
          <div className="grid-cols-3" style={{ gap: 'var(--space-4)' }}>
            {bookedDates.length > 0 && (
              <div>
                <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={14} style={{ color: 'var(--color-warning)' }} /> Booked Periods
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                  {bookedDates.slice(0, 8).map((d, i) => (
                    <div key={i} style={{ fontSize: 'var(--text-xs)', padding: 'var(--space-1) var(--space-2)', background: 'var(--color-warning-light)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)' }}>
                      {formatDate(d.start_date || d.start)} → {formatDate(d.end_date || d.end)}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {maintenanceDates.length > 0 && (
              <div>
                <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Wrench size={14} style={{ color: 'var(--color-danger)' }} /> Maintenance
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                  {maintenanceDates.slice(0, 8).map((d, i) => (
                    <div key={i} style={{ fontSize: 'var(--text-xs)', padding: 'var(--space-1) var(--space-2)', background: 'var(--color-danger-light)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)' }}>
                      {formatDate(d.start_date || d.date || d.start)} {d.end_date ? `→ ${formatDate(d.end_date)}` : ''}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {queueReservations.length > 0 && (
              <div>
                <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Hash size={14} style={{ color: 'var(--color-info)' }} /> Queue Reservations
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                  {queueReservations.slice(0, 8).map((d, i) => (
                    <div key={i} style={{ fontSize: 'var(--text-xs)', padding: 'var(--space-1) var(--space-2)', background: 'var(--color-info-light)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)' }}>
                      {d.user_name || d.user_email || 'User'} — Position #{d.position || i + 1}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Units Table */}
      <div className="card" style={{ marginTop: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>Inventory Units</h2>
          {isAdmin && (
            <button className="btn btn-secondary btn-sm" onClick={() => setShowAddUnits(true)}>
              <Plus size={14} /> Add Units
            </button>
          )}
        </div>

        {unitList.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Unit Code</th>
                  <th>Serial Number</th>
                  <th>Condition</th>
                  <th>Status</th>
                  <th>QR Code</th>
                  {isAdmin && <th style={{ width: 120 }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {unitList.map((unit) => (
                  <tr key={unit.id} className="hover-row" style={{ cursor: 'pointer' }} onClick={(e) => {
                    // Don't trigger if clicking on an input or action button
                    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.closest('button')) return;
                    setViewingUnit(unit);
                  }}>
                    <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
                      {unit.unit_code}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
                      {editingUnitId === unit.id ? (
                        <input type="text" className="input" value={editUnitForm.serial_number}
                          onChange={(e) => setEditUnitForm({ ...editUnitForm, serial_number: e.target.value })}
                          style={{ height: 30, fontSize: 'var(--text-xs)' }} />
                      ) : (
                        unit.serial_number || '—'
                      )}
                    </td>
                    <td>
                      {editingUnitId === unit.id ? (
                        <select className="input" value={editUnitForm.condition}
                          onChange={(e) => setEditUnitForm({ ...editUnitForm, condition: e.target.value })}
                          style={{ height: 30, fontSize: 'var(--text-xs)' }}>
                          {Object.keys(CONDITION_MAP).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      ) : (
                        <span className={`badge ${CONDITION_MAP[unit.condition]?.color || 'badge-neutral'}`}>
                          {unit.condition || 'Unknown'}
                        </span>
                      )}
                    </td>
                    <td>
                      {editingUnitId === unit.id ? (
                        <select className="input" value={editUnitForm.status}
                          onChange={(e) => setEditUnitForm({ ...editUnitForm, status: e.target.value })}
                          style={{ height: 30, fontSize: 'var(--text-xs)' }}>
                          {Object.keys(UNIT_STATUS).map(s => <option key={s} value={s}>{UNIT_STATUS[s].label}</option>)}
                        </select>
                      ) : (
                        <span className={`badge ${UNIT_STATUS[unit.status]?.color || 'badge-neutral'}`}>
                          {UNIT_STATUS[unit.status]?.label || unit.status || 'Available'}
                        </span>
                      )}
                    </td>
                    <td>
                      {unit.qr_code_url ? (
                        <a href={unit.qr_code_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ padding: '2px 8px', color: 'var(--color-primary)' }} title="View QR Code">
                          <QrCode size={16} />
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>None</span>
                      )}
                    </td>
                    {isAdmin && (
                      <td>
                        {editingUnitId === unit.id ? (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-success btn-sm" style={{ padding: '2px 8px' }} onClick={() => handleUpdateUnit(unit.id)}>
                              <Save size={12} />
                            </button>
                            <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px' }} onClick={() => setEditingUnitId(null)}>
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px' }} onClick={() => startEditUnit(unit)} title="Edit Unit">
                              <Edit3 size={12} />
                            </button>
                            <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px' }} onClick={() => openUnitHistory(unit.id)} title="View Assignment History">
                              <History size={12} />
                            </button>
                            <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px', color: 'var(--color-danger)' }}
                              onClick={() => handleRetireUnit(unit.id)} title="Retire Unit">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
            <p className="empty-state-desc">No units registered for this asset</p>
          </div>
        )}
      </div>

      {/* ─── Add Units Modal ─── */}
      {showAddUnits && (
        <>
          <div className="modal-overlay" onClick={() => setShowAddUnits(false)} />
          <div className="modal animate-fade-in" style={{ maxWidth: 600 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 800 }}>Add Units</h2>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowAddUnits(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ maxHeight: 400, overflowY: 'auto', marginBottom: 'var(--space-4)' }}>
              {newUnits.map((unit, idx) => (
                <div key={idx} style={{
                  display: 'flex', gap: 'var(--space-2)', alignItems: 'center',
                  padding: 'var(--space-2) 0',
                  borderBottom: idx < newUnits.length - 1 ? '1px solid var(--border-color)' : 'none',
                }}>
                  <input type="text" className="input" placeholder="Unit Code *"
                    value={unit.unit_code}
                    onChange={(e) => updateNewUnit(idx, 'unit_code', e.target.value)}
                    style={{ flex: 1, height: 36 }} />
                  <input type="text" className="input" placeholder="Serial Number"
                    value={unit.serial_number}
                    onChange={(e) => updateNewUnit(idx, 'serial_number', e.target.value)}
                    style={{ flex: 1, height: 36 }} />
                  <select className="input" value={unit.condition}
                    onChange={(e) => updateNewUnit(idx, 'condition', e.target.value)}
                    style={{ width: 100, height: 36 }}>
                    {Object.keys(CONDITION_MAP).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {newUnits.length > 1 && (
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => removeUnitRow(idx)}
                      style={{ color: 'var(--color-danger)', flexShrink: 0 }}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button className="btn btn-ghost btn-sm" onClick={addUnitRow} style={{ marginBottom: 'var(--space-4)' }}>
              <Plus size={14} /> Add Another Unit
            </button>

            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowAddUnits(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddUnits} disabled={addingUnits}>
                {addingUnits ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={16} />}
                Add {newUnits.filter(u => u.unit_code.trim()).length} Unit(s)
              </button>
            </div>
          </div>
        </>
      )}

      {/* ─── Damage Report Modal ─── */}
      {showDamageReport && (
        <>
          <div className="modal-overlay" onClick={() => setShowDamageReport(false)} />
          <div className="modal animate-fade-in" style={{ maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--color-danger)' }}>
                <AlertTriangle size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} />
                Report Damage
              </h2>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowDamageReport(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleDamageReport}>
              <div className="input-group">
                <label className="input-label">Affected Unit *</label>
                <select className="input" value={damageForm.asset_unit_id}
                  onChange={(e) => setDamageForm({ ...damageForm, asset_unit_id: e.target.value })} required>
                  <option value="">Select a unit...</option>
                  {unitList.map(u => (
                    <option key={u.id} value={u.id}>{u.unit_code} — {u.serial_number || 'No S/N'}</option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Damage Description *</label>
                <textarea className="input" placeholder="Describe the damage in detail..."
                  value={damageForm.remarks}
                  onChange={(e) => setDamageForm({ ...damageForm, remarks: e.target.value })}
                  rows={4} required />
              </div>
              <div className="input-group">
                <label className="input-label">
                  <Camera size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                  Photos (optional)
                </label>
                <input type="file" accept="image/*" multiple className="input"
                  onChange={(e) => setDamagePhotos(Array.from(e.target.files || []))}
                  style={{ padding: 'var(--space-2)' }} />
                {damagePhotos.length > 0 && (
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>
                    {damagePhotos.length} photo(s) attached
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowDamageReport(false)}>Cancel</button>
                <button type="submit" className="btn btn-danger" disabled={reportingDamage}>
                  {reportingDamage ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <AlertTriangle size={16} />}
                  Submit Report
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* ─── Image History Modal ─── */}
      {showImageHistory && (
        <>
          <div className="modal-overlay" onClick={() => setShowImageHistory(false)} />
          <div className="modal animate-fade-in" style={{ maxWidth: 600 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 800 }}>Image History</h2>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowImageHistory(false)}>
                <X size={18} />
              </button>
            </div>
            
            {loadingImageHistory ? (
              <div className="skeleton" style={{ height: 200 }} />
            ) : imageHistoryData.length > 0 ? (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Image</th>
                      <th>Status</th>
                      <th>Uploaded At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {imageHistoryData.map((img) => (
                      <tr key={img.id}>
                        <td>
                          <img src={img.url || img.image_url} alt="Asset" style={{ width: 60, height: 40, objectFit: 'cover', borderRadius: 4 }} />
                        </td>
                        <td>
                          <span className={`badge ${img.is_deleted ? 'badge-danger' : 'badge-success'}`}>
                            {img.is_deleted ? 'Deleted' : 'Active'}
                          </span>
                        </td>
                        <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                          {formatDateTime(img.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <ImageIcon size={32} style={{ color: 'var(--text-tertiary)', marginBottom: 8 }} />
                <p>No image history found.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── Unit Assignment History Modal ─── */}
      {viewingHistoryUnitId && (
        <>
          <div className="modal-overlay" onClick={() => setViewingHistoryUnitId(null)} />
          <div className="modal animate-fade-in" style={{ maxWidth: 640 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 800 }}>Unit Assignment History</h2>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setViewingHistoryUnitId(null)}>
                <X size={18} />
              </button>
            </div>

            {loadingUnitHistory ? (
              <div className="skeleton" style={{ height: 200 }} />
            ) : unitHistoryData.length > 0 ? (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Booking ID</th>
                      <th>User</th>
                      <th>Condition After</th>
                      <th>Returned At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unitHistoryData.map((history) => (
                      <tr key={history.id || history.booking_id}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
                          <Link href={`/bookings/${history.booking_id}`} className="hover:underline text-primary">
                            {history.booking_id?.substring(0, 8)}...
                          </Link>
                        </td>
                        <td style={{ fontSize: 'var(--text-xs)' }}>{history.user_name || history.user_email || '—'}</td>
                        <td>
                          <span className={`badge ${CONDITION_MAP[history.condition_after]?.color || 'badge-neutral'}`}>
                            {history.condition_after || 'N/A'}
                          </span>
                        </td>
                        <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                          {history.returned_at ? formatDateTime(history.returned_at) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <History size={32} style={{ color: 'var(--text-tertiary)', marginBottom: 8 }} />
                <p>This unit has no assignment history.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── Unit Details Modal ─── */}
      {viewingUnit && (
        <>
          <div className="modal-overlay" onClick={() => setViewingUnit(null)} />
          <div className="modal animate-fade-in" style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 800 }}>Unit Details</h2>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setViewingUnit(null)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 'var(--space-6)', padding: 'var(--space-4)', background: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ background: '#fff', padding: 'var(--space-2)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-3)' }}>
                <QRCodeSVG value={viewingUnit.id} size={150} />
              </div>
              <h3 style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'var(--text-lg)' }}>
                {viewingUnit.unit_code}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginTop: 4 }}>
                Scan to manage this unit
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>Status</span>
                <span className={`badge ${UNIT_STATUS[viewingUnit.status]?.color || 'badge-neutral'}`} style={{ alignSelf: 'flex-start' }}>
                  {UNIT_STATUS[viewingUnit.status]?.label || viewingUnit.status || 'Available'}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>Condition</span>
                <span className={`badge ${CONDITION_MAP[viewingUnit.condition]?.color || 'badge-neutral'}`} style={{ alignSelf: 'flex-start' }}>
                  {viewingUnit.condition || 'Unknown'}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>Serial Number</span>
                <span style={{ fontWeight: 500, fontFamily: 'var(--font-mono)' }}>{viewingUnit.serial_number || '—'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>Added On</span>
                <span style={{ fontWeight: 500 }}>{formatDate(viewingUnit.created_at)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              {isAdmin && (
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => {
                  setViewingUnit(null);
                  startEditUnit(viewingUnit);
                }}>
                  <Edit3 size={16} /> Edit Unit
                </button>
              )}
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => {
                setViewingUnit(null);
                openUnitHistory(viewingUnit.id);
              }}>
                <History size={16} /> View History
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
