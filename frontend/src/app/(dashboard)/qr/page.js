'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import api, { downloadFile } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import toast from 'react-hot-toast';
import {
  QrCode, Download, Loader2, Search, Package, Hash,
  Camera, Upload, X, Image as ImageIcon, ScanLine,
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { parseQrCode } from '@/lib/utils';

export default function QRPage() {
  const [scanUnitId, setScanUnitId] = useState('');
  const [scanUnitCode, setScanUnitCode] = useState('');
  const [scanResult, setScanResult] = useState(null);

  const [singleUnitId, setSingleUnitId] = useState('');
  const [singleQrUrl, setSingleQrUrl] = useState(null);

  const [bulkModelId, setBulkModelId] = useState('');

  const [loading, setLoading] = useState('');

  // Camera scanning state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const scannerRef = useRef(null);

  // Image upload state
  const fileInputRef = useRef(null);
  const [uploadPreview, setUploadPreview] = useState(null);

  // ─── Lookup helpers ───────────────────────────────────────
  const lookupUnit = useCallback(async (code) => {
    if (!code) return;
    // Aggressively clean the code of any whitespace, newlines, or invisible characters
    const cleanCode = code.replace(/[\r\n\s]+/g, '').trim();
    if (!cleanCode) return;
    
    setLoading('scan');
    // DEBUG: show the exact URL we are hitting
    toast(`Calling: /qr/scan/${cleanCode}`, { icon: '🔍', duration: 5000 });
    try {
      const { data } = await api.get(`/qr/scan/${cleanCode}`);
      setScanResult(data);
      toast.success('Unit found!');
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Unit not found');
      // DEBUG: Show exactly what the backend responded with
      toast.error(`Backend Response: ${JSON.stringify(err.response?.data)}`, { duration: 10000 });
      setScanResult(null);
    } finally {
      setLoading('');
    }
  }, []);

  const handleScan = async (e) => {
    e.preventDefault();
    lookupUnit(scanUnitId);
  };

  const handleScanCode = async (e) => {
    e.preventDefault();
    lookupUnit(scanUnitCode);
  };

  // ─── Camera scanning ─────────────────────────────────────
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

  const handleScanSuccess = useCallback((decodedText) => {
    const unitCode = parseQrCode(decodedText);

    stopCamera();
    setScanUnitCode(unitCode);
    lookupUnit(unitCode);
  }, [stopCamera, lookupUnit]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      setCameraActive(true);
      // Wait for React to render the div
      await new Promise((resolve) => setTimeout(resolve, 100));
      
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("reader");
      }
      
      await scannerRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        handleScanSuccess,
        (errorMessage) => {
          // Ignored. html5-qrcode calls this on every frame where no QR is found.
        }
      );
    } catch (err) {
      console.error('Camera error:', err);
      setCameraError('Could not start camera. Try using the image upload instead.');
      setCameraActive(false);
    }
  }, [handleScanSuccess]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, []);

  // ─── Image upload QR scanning ──────────────────────────────
  const handleImageUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview
    const previewUrl = URL.createObjectURL(file);
    setUploadPreview(previewUrl);
    setLoading('imageQr');

    try {
      const html5QrCode = new Html5Qrcode("hidden-reader");
      const decodedText = await html5QrCode.scanFile(file, true);
      
      const unitCode = parseQrCode(decodedText);

      setScanUnitCode(unitCode);
      await lookupUnit(unitCode);
      html5QrCode.clear();
    } catch (err) {
      console.error('Image scan error:', err);
      toast.error('No QR code found in the image. Try a clearer photo.');
    } finally {
      setLoading('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [lookupUnit]);

  // ─── QR generation handlers ────────────────────────────────
  const handleGenerateSingle = async (e) => {
    e.preventDefault();
    if (!singleUnitId.trim()) return;
    setLoading('single');
    try {
      const response = await api.post(`/qr/generate/${singleUnitId.trim()}`, {}, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      setSingleQrUrl(url);
      toast.success('QR code generated!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to generate QR code');
      setSingleQrUrl(null);
    } finally {
      setLoading('');
    }
  };

  const handleGenerateBulkModel = async (e) => {
    e.preventDefault();
    if (!bulkModelId.trim()) return;
    setLoading('bulkModel');
    try {
      await downloadFile(`/qr/generate-bulk/${bulkModelId.trim()}`, `model-${bulkModelId.trim()}-qr-codes.pdf`, 'pdf', 'POST');
      toast.success('QR codes downloaded! 📥');
    } catch (err) {
      toast.error(err?.message || 'Failed to generate bulk QR codes');
    } finally {
      setLoading('');
    }
  };

  const handleGenerateAll = async () => {
    setLoading('all');
    try {
      await downloadFile('/qr/generate-all', 'all-qr-codes.pdf', 'pdf', 'POST');
      toast.success('All QR codes downloaded! 📥');
    } catch (err) {
      toast.error(err?.message || 'Failed to generate QR codes');
    } finally {
      setLoading('');
    }
  };

  return (
    <div className="page-content" style={{ maxWidth: 780 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title"><QrCode size={28} /> QR Code Management</h1>
          <p className="page-subtitle">Scan, upload, and generate QR codes for asset units</p>
        </div>
        <button className="btn btn-primary" onClick={handleGenerateAll} disabled={loading === 'all'}>
          {loading === 'all' ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={16} />}
          Download All QR Codes (PDF)
        </button>
      </div>

      {/* ═══ SCAN SECTION ═══ */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
          <ScanLine size={20} style={{ color: 'var(--color-primary)' }} />
          <h3 style={{ fontWeight: 700 }}>Scan / Lookup Unit</h3>
        </div>

        {/* Camera & Image Upload Buttons */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <button
            className={`btn ${cameraActive ? 'btn-danger' : 'btn-primary'}`}
            onClick={cameraActive ? stopCamera : startCamera}
            style={{ flex: 1 }}
          >
            {cameraActive ? <X size={16} /> : <Camera size={16} />}
            {cameraActive ? 'Stop Camera' : 'Scan with Camera'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading === 'imageQr'}
            style={{ flex: 1 }}
          >
            {loading === 'imageQr' ? (
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Upload size={16} />
            )}
            Upload QR Image
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

        {/* Image upload preview */}
        {uploadPreview && (
          <div className="animate-fade-in" style={{
            marginBottom: 'var(--space-4)', position: 'relative',
            textAlign: 'center',
          }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => { setUploadPreview(null); }}
              style={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }}
            >
              <X size={14} />
            </button>
            <img
              src={uploadPreview}
              alt="Uploaded QR"
              style={{
                maxHeight: 200, borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-color)',
              }}
            />
          </div>
        )}

        {/* Hidden canvas for camera frame processing */}
        {/* Manual text lookups */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)',
          paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-color)',
        }}>
          <form onSubmit={handleScan} style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <input
              type="text"
              className="input"
              placeholder="Unit UUID..."
              value={scanUnitId}
              onChange={(e) => setScanUnitId(e.target.value)}
              style={{ flex: 1, minWidth: 0 }}
            />
            <button type="submit" className="btn btn-primary" disabled={loading === 'scan'}>
              {loading === 'scan' ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={16} />}
            </button>
          </form>

          <form onSubmit={handleScanCode} style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <input
              type="text"
              className="input"
              placeholder="Unit code..."
              value={scanUnitCode}
              onChange={(e) => setScanUnitCode(e.target.value)}
              style={{ flex: 1, minWidth: 0 }}
            />
            <button type="submit" className="btn btn-primary" disabled={loading === 'scanCode'}>
              {loading === 'scanCode' ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={16} />}
            </button>
          </form>
        </div>

        {/* Scan Result */}
        {scanResult && (
          <div className="card animate-fade-in" style={{
            marginTop: 'var(--space-4)', background: 'var(--bg-surface-hover)',
            border: '1px solid var(--color-success)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
              <Package size={18} style={{ color: 'var(--color-success)' }} />
              <h4 style={{ fontWeight: 700 }}>
              <h4 style={{ fontWeight: 700 }}>
                {scanResult.asset_model?.name || scanResult.asset_model_name || scanResult.model_name || 'Unit Found'}
              </h4>
              </h4>
            </div>
            <div style={{
              fontSize: 'var(--text-sm)', color: 'var(--text-secondary)',
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)',
            }}>
              <span>Unit Code: <strong>{scanResult.unit_code}</strong></span>
              <span>Serial: <strong>{scanResult.serial_number || '—'}</strong></span>
              <span>Status: <strong style={{
                color: scanResult.status === 'available' ? 'var(--color-success)' :
                  scanResult.status === 'booked' ? 'var(--color-info)' :
                  scanResult.status === 'maintenance' ? 'var(--color-warning)' : 'var(--color-danger)'
              }}>{scanResult.status}</strong></span>
              <span>Condition: <strong>{scanResult.condition}</strong></span>
              {scanResult.current_holder && (
                <span style={{ gridColumn: '1 / -1' }}>
                  Current Holder: <strong>{scanResult.current_holder}</strong>
                </span>
              )}
              {scanResult.ongoing_maintenance_requests !== undefined && (
                <span style={{ gridColumn: '1 / -1' }}>
                  Ongoing Maintenance Requests: <strong style={{ color: scanResult.ongoing_maintenance_requests > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>{scanResult.ongoing_maintenance_requests}</strong>
                </span>
              )}
              {scanResult.last_maintenance_done && (
                <span style={{ gridColumn: '1 / -1' }}>
                  Last Maintenance Done: <strong>{new Date(scanResult.last_maintenance_done).toLocaleDateString()}</strong>
                </span>
              )}
              {scanResult.available !== undefined && (
                <span style={{ gridColumn: '1 / -1' }}>
                  Available: <strong style={{
                    color: scanResult.available ? 'var(--color-success)' : 'var(--color-danger)'
                  }}>{scanResult.available ? 'Yes' : 'No'}</strong>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══ GENERATE SECTION ═══ */}
      <div className="grid-cols-2" style={{ gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        {/* Single Unit Generation */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
            <Hash size={18} style={{ color: 'var(--color-primary)' }} />
            <h3 style={{ fontWeight: 700 }}>Single Unit QR</h3>
          </div>
          <form onSubmit={handleGenerateSingle} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <input
              type="text"
              className="input"
              placeholder="Enter Unit UUID..."
              value={singleUnitId}
              onChange={(e) => setSingleUnitId(e.target.value)}
            />
            <button type="submit" className="btn btn-secondary" disabled={loading === 'single'}>
              {loading === 'single' ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <QrCode size={16} />}
              Generate PNG
            </button>
          </form>
          {singleQrUrl && (
            <div className="animate-fade-in" style={{ marginTop: 'var(--space-4)', textAlign: 'center' }}>
              <img src={singleQrUrl} alt="QR Code" style={{ width: 150, height: 150, margin: '0 auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }} />
              <a href={singleQrUrl} download="qr-code.png" className="btn btn-ghost btn-sm" style={{ marginTop: 'var(--space-2)' }}>
                <Download size={14} /> Download PNG
              </a>
            </div>
          )}
        </div>

        {/* Bulk Model Generation */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
            <Package size={18} style={{ color: 'var(--color-primary)' }} />
            <h3 style={{ fontWeight: 700 }}>Model Bulk QR</h3>
          </div>
          <form onSubmit={handleGenerateBulkModel} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <input
              type="text"
              className="input"
              placeholder="Enter Model UUID..."
              value={bulkModelId}
              onChange={(e) => setBulkModelId(e.target.value)}
            />
            <button type="submit" className="btn btn-secondary" disabled={loading === 'bulkModel'}>
              {loading === 'bulkModel' ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={16} />}
              Generate PDF
            </button>
          </form>
        </div>
      </div>

    </div>
  );
}
