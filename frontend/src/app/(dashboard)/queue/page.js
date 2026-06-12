'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useFetch } from '@/hooks/useFetch';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { ListOrdered, LogIn, LogOut as LogOutIcon, Loader2, Camera, Upload, X, Search, Package } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import React, { useRef, useCallback, useEffect } from 'react';
import { parseQrCode } from '@/lib/utils';

export default function QueuePage() {
  const { user } = useAuth();
  const { data: myQueues, loading, refetch } = useFetch('/queue/my');
  const [joinModelId, setJoinModelId] = useState('');
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState('');

  const queueList = Array.isArray(myQueues) ? myQueues : myQueues?.items || [];
  const { data: allAssetsData } = useFetch('/assets');
  
  // Fix infinite loop: wrap derived array in useMemo
  const allAssets = React.useMemo(() => {
    return Array.isArray(allAssetsData) ? allAssetsData : allAssetsData?.items || [];
  }, [allAssetsData]);

  // Autocomplete state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);

  // QR Scanning state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const scannerRef = useRef(null);
  const fileInputRef = useRef(null);
  const [qrLoading, setQrLoading] = useState(false);

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

  // QR Logics
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
    try {
      const { data } = await api.get(`/qr/scan/${unitCode}`);
      const modelId = data.asset_model?.id || data.asset_model_id;
      const found = allAssets.find(a => a.id === modelId);
      
      setJoinModelId(modelId || unitCode);
      setSearchQuery(found ? found.name : (data.asset_model?.name || unitCode));
      setSelectedAsset(found || { id: modelId || unitCode, name: data.asset_model?.name || unitCode });
      toast.success('QR Code scanned and asset identified!');
    } catch (err) {
      toast.error('Could not identify the asset from this QR code');
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
      const modelId = data.asset_model?.id || data.asset_model_id;
      const found = allAssets.find(a => a.id === modelId);
      
      setJoinModelId(modelId || unitCode);
      setSearchQuery(found ? found.name : (data.asset_model?.name || unitCode));
      setSelectedAsset(found || { id: modelId || unitCode, name: data.asset_model?.name || unitCode });
      toast.success('QR Code extracted from image and asset identified!');
      html5QrCode.clear();
    } catch (err) {
      console.error('Image scan error:', err);
      toast.error('Could not identify the asset from this QR code image.');
    } finally {
      setQrLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [allAssets]);

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!joinModelId.trim()) return;
    setJoining(true);
    try {
      await api.post('/queue/join', { asset_model_id: joinModelId.trim() });
      toast.success('Joined the waitlist! 🎉');
      setJoinModelId('');
      setSearchQuery('');
      setSelectedAsset(null);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to join waitlist');
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async (queueId) => {
    setLeaving(queueId);
    try {
      await api.post(`/queue/leave/${queueId}`);
      toast.success('Left the waitlist');
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to leave');
    } finally {
      setLeaving('');
    }
  };

  return (
    <div className="page-content" style={{ maxWidth: 700 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title"><ListOrdered size={28} /> My Waitlist</h1>
          <p className="page-subtitle">Manage your position in asset waitlists</p>
        </div>
      </div>

      {/* Join Form */}
      <div className="card" style={{ marginBottom: 'var(--space-6)', overflow: 'visible' }}>
        <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-3)' }}>Join a Waitlist</h3>
        
        {/* QR Scanning Controls */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
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
          <div className="animate-fade-in" style={{ marginBottom: 'var(--space-4)' }}>
            {cameraError ? (
              <div style={{
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--color-danger-light)',
                border: '1px solid var(--color-danger)',
                color: 'var(--color-danger)',
                fontSize: 'var(--text-sm)',
                textAlign: 'center',
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

        <form onSubmit={handleJoin} style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, color: 'var(--text-tertiary)' }} />
              <input
                type="text"
                className="input"
                placeholder="Search Asset Name or Paste ID..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setJoinModelId(e.target.value);
                  setSelectedAsset(null);
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
                      padding: 'var(--space-2) var(--space-3)',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border-color)',
                      display: 'flex', alignItems: 'center', gap: 'var(--space-2)'
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSearchQuery(asset.name);
                      setJoinModelId(asset.id);
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
          <button type="submit" className="btn btn-primary" disabled={joining}>
            {joining ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <LogIn size={16} />}
            Join
          </button>
        </form>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-2)' }}>
          ⚠️ Requires a reliability score of 50 or higher
        </p>
      </div>

      {/* Active Waitlists */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 64 }} />)}
        </div>
      ) : queueList.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><ListOrdered size={32} /></div>
          <h3 className="empty-state-title">No active waitlists</h3>
          <p className="empty-state-desc">You&apos;re not currently on any waitlists.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {queueList.map((queue, idx) => (
            <div key={queue.id} className="card animate-fade-in" style={{ animationDelay: `${idx * 60}ms` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ fontWeight: 700, marginBottom: 'var(--space-1)' }}>
                    {queue.asset_model_name || 'Asset Waitlist'}
                  </h4>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                    Position: <strong>#{queue.position || '—'}</strong>
                  </div>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--color-danger)' }}
                  onClick={() => handleLeave(queue.id)}
                  disabled={leaving === queue.id}
                >
                  {leaving === queue.id ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <LogOutIcon size={14} />}
                  Leave
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
