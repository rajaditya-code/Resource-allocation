'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useFetch } from '@/hooks/useFetch';
import api from '@/lib/api';
import { timeAgo, parseQrCode } from '@/lib/utils';
import { MAINTENANCE_STATUS, PRIORITY_MAP } from '@/lib/constants';
import toast from 'react-hot-toast';
import { Wrench, Plus, Search, Loader2, Camera, Upload, X, Package } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import React, { useRef, useCallback, useEffect } from 'react';

export default function MaintenancePage() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [statusFilter, setStatusFilter] = useState('');
  const { data: tickets, loading, refetch } = useFetch('/maintenance', {
    params: { status: statusFilter },
    deps: [statusFilter],
  });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ asset_unit_id: '', issue: '', priority: 'Medium' });
  const [creating, setCreating] = useState(false);

  // Asset Model Autocomplete Logic
  const { data: allAssetsData } = useFetch('/assets');
  const allAssets = React.useMemo(() => {
    return Array.isArray(allAssetsData) ? allAssetsData : allAssetsData?.items || [];
  }, [allAssetsData]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);

  useEffect(() => {
    if (!searchQuery.trim() || selectedAsset) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    const filtered = allAssets.filter(item => 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.id.includes(searchQuery)
    );
    setSearchResults(filtered);
    setShowResults(true);
  }, [searchQuery, allAssets, selectedAsset]);

  // Unit dropdown for selected model
  const { data: modelUnitsData, loading: unitsLoading } = useFetch(
    selectedAsset ? `/assets/${selectedAsset.id}/units` : null
  );
  const modelUnits = Array.isArray(modelUnitsData) ? modelUnitsData : modelUnitsData?.items || [];

  // QR Scanning state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const scannerRef = useRef(null);
  const fileInputRef = useRef(null);
  const [qrLoading, setQrLoading] = useState(false);

  const stopCamera = useCallback(async () => {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop();
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    } catch (err) {
      console.error('Stop camera error:', err);
    }
    setCameraActive(false);
  }, []);

  const handleScanSuccess = useCallback(async (decodedText) => {
    const unitCode = parseQrCode(decodedText);

    stopCamera();
    
    setQrLoading(true);
    try {
      const { data } = await api.get(`/qr/scan/${unitCode}`);
      // Find asset model
      const foundAsset = allAssets.find(a => a.id === data.asset_model?.id) || { id: data.asset_model?.id, name: data.asset_model?.name || data.model_name || 'Asset Model' };
      setSelectedAsset(foundAsset);
      setSearchQuery(foundAsset.name);
      
      // We automatically select this unit
      setForm(prev => ({ ...prev, asset_unit_id: data.unit_id || data.id }));
      toast.success('Unit scanned and selected! ✅');
    } catch (err) {
      toast.error('Could not load unit from QR code');
    } finally {
      setQrLoading(false);
    }
  }, [stopCamera, allAssets]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      setCameraActive(true);
      await new Promise((resolve) => setTimeout(resolve, 100));
      
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("reader");
      }
      
      await scannerRef.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        handleScanSuccess,
        () => {}
      );
    } catch (err) {
      console.error('Camera error:', err);
      setCameraError('Could not start camera. Try using the image upload instead.');
      setCameraActive(false);
    }
  }, [handleScanSuccess]);

  useEffect(() => {
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, []);

  const handleImageUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setQrLoading(true);
    try {
      const html5QrCode = new Html5Qrcode("hidden-reader");
      const decodedText = await html5QrCode.scanFile(file, true);
      
      const unitCode = parseQrCode(decodedText);

      const { data } = await api.get(`/qr/scan/${unitCode}`);
      // Find asset model
      const foundAsset = allAssets.find(a => a.id === data.asset_model?.id) || { id: data.asset_model?.id, name: data.asset_model?.name || data.model_name || 'Asset Model' };
      setSelectedAsset(foundAsset);
      setSearchQuery(foundAsset.name);
      
      setForm(prev => ({ ...prev, asset_unit_id: data.unit_id || data.id }));
      toast.success('Unit scanned and selected! ✅');
      html5QrCode.clear();
    } catch (err) {
      console.error('Image scan error:', err);
      toast.error('No QR code found in the image. Try a clearer photo.');
    } finally {
      setQrLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [allAssets]);

  const ticketList = Array.isArray(tickets) ? tickets : tickets?.items || [];

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.asset_unit_id || !form.issue) return toast.error('Please fill all required fields');
    setCreating(true);
    try {
      await api.post('/maintenance', form);
      toast.success('Maintenance ticket created! 🔧');
      setShowForm(false);
      setForm({ asset_unit_id: '', issue: '', priority: 'Medium' });
      setSearchQuery('');
      setSelectedAsset(null);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create ticket');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title"><Wrench size={28} /> Maintenance</h1>
          <p className="page-subtitle">Track and manage maintenance tickets</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={16} /> {showForm ? 'Cancel' : 'New Ticket'}
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="card animate-fade-in" style={{ marginBottom: 'var(--space-4)', overflow: 'visible' }}>
          <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-4)' }}>Create Maintenance Ticket</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            
            {/* QR Scanning Controls */}
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button
                type="button"
                className={`btn ${cameraActive ? 'btn-danger' : 'btn-secondary'}`}
                onClick={cameraActive ? stopCamera : startCamera}
                style={{ flex: 1 }}
              >
                {cameraActive ? <X size={16} /> : <Camera size={16} />}
                {cameraActive ? 'Stop Camera' : 'Scan QR'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={qrLoading}
                style={{ flex: 1 }}
              >
                {qrLoading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={16} />}
                Upload QR
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleImageUpload}
              />
            </div>

            {/* Camera View */}
            {(cameraActive || cameraError) && (
              <div className="animate-fade-in">
                {cameraError ? (
                  <div style={{
                    padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)',
                    background: 'var(--color-danger-light)', border: '1px solid var(--color-danger)',
                    color: 'var(--color-danger)', fontSize: 'var(--text-sm)', textAlign: 'center',
                  }}>
                    {cameraError}
                  </div>
                ) : (
                  <div style={{ position: 'relative', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: '#000' }}>
                    <div id="reader" style={{ width: '100%' }}></div>
                  </div>
                )}
              </div>
            )}
            
            {/* Hidden div for image scanning */}
            <div id="hidden-reader" style={{ display: 'none' }}></div>

            <div className="input-group" style={{ position: 'relative' }}>
              <label className="input-label">Asset Model</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Search size={16} style={{ position: 'absolute', left: 12, color: 'var(--text-tertiary)' }} />
                <input
                  type="text"
                  className="input"
                  placeholder="Search Asset Model..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSelectedAsset(null);
                    setForm(prev => ({ ...prev, asset_unit_id: '' }));
                  }}
                  onFocus={() => { if (searchQuery.trim() && !selectedAsset) setShowResults(true); }}
                  onBlur={() => setTimeout(() => setShowResults(false), 200)}
                  style={{ paddingLeft: 36, width: '100%' }}
                />
              </div>
              
              {/* Autocomplete Dropdown */}
              {showResults && searchResults.length > 0 && (
                <div className="card animate-fade-in" style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                  marginTop: 'var(--space-1)', padding: 0, overflow: 'hidden',
                  boxShadow: 'var(--shadow-lg)'
                }}>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 200, overflowY: 'auto' }}>
                    {searchResults.map((asset) => (
                      <li key={asset.id} style={{
                        padding: 'var(--space-2) var(--space-3)', cursor: 'pointer',
                        borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)'
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSearchQuery(asset.name);
                        setSelectedAsset(asset);
                        setShowResults(false);
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <Package size={16} style={{ color: 'var(--text-tertiary)' }} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{asset.name}</div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{asset.id}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            
            {/* Unit Dropdown */}
            {selectedAsset && (
              <div className="input-group animate-fade-in">
                <label className="input-label">Select Unit *</label>
                <select 
                  className="input" 
                  value={form.asset_unit_id} 
                  onChange={(e) => setForm({ ...form, asset_unit_id: e.target.value })}
                  disabled={unitsLoading}
                  required
                >
                  <option value="">{unitsLoading ? 'Loading units...' : 'Select a unit...'}</option>
                  {modelUnits.map(unit => (
                    <option key={unit.id} value={unit.id}>
                      {unit.unit_code} {unit.serial_number ? `(${unit.serial_number})` : ''} - {unit.status}
                    </option>
                  ))}
                </select>
                {modelUnits.length === 0 && !unitsLoading && (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-warning)', marginTop: 4 }}>
                    No units found for this asset model.
                  </p>
                )}
              </div>
            )}


            <div className="input-group">
              <label className="input-label">Issue Description *</label>
              <textarea className="input" placeholder="Describe the issue..."
                value={form.issue} onChange={(e) => setForm({ ...form, issue: e.target.value })} rows={3} required />
            </div>
            <div className="input-group">
              <label className="input-label">Priority</label>
              <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Wrench size={16} />}
              Submit Ticket
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        {['', 'Open', 'In Progress', 'Resolved', 'Closed'].map((s) => (
          <button key={s} className={`btn ${statusFilter === s ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setStatusFilter(s)}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Tickets */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 64 }} />)}
        </div>
      ) : ticketList.length > 0 ? (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Issue</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {ticketList.map((ticket) => (
                <tr key={ticket.id} onClick={() => router.push(`/maintenance/${ticket.id}`)} style={{ cursor: 'pointer' }}>
                  <td style={{ fontWeight: 600, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ticket.issue}
                  </td>
                  <td>
                    <span className={`badge ${PRIORITY_MAP[ticket.priority]?.color || 'badge-neutral'}`}>
                      {ticket.priority}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${MAINTENANCE_STATUS[ticket.status]?.color || 'badge-neutral'}`}>
                      {ticket.status}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>
                    {timeAgo(ticket.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon"><Wrench size={32} /></div>
          <h3 className="empty-state-title">No maintenance tickets</h3>
          <p className="empty-state-desc">Everything looks good! No open tickets at the moment.</p>
        </div>
      )}
    </div>
  );
}
