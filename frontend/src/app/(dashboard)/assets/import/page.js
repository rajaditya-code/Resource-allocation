'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { uploadFile } from '@/lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { getErrorMessage } from '@/lib/utils';

export default function BulkImportPage() {
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith('.csv')) setFile(f);
    else toast.error('Please upload a CSV file');
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const { data } = await uploadFile('/assets/bulk-import', file);
      setResult(data);
      toast.success('Import completed! 🎉');
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Import failed');
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

      <h1 className="page-title" style={{ marginBottom: 'var(--space-2)' }}>
        <Upload size={28} /> Bulk Import Assets
      </h1>
      <p className="page-subtitle" style={{ marginBottom: 'var(--space-6)' }}>
        Upload a CSV file to add multiple assets at once
      </p>

      {/* CSV Format Info */}
      <div className="card" style={{ marginBottom: 'var(--space-4)', background: 'var(--color-info-light)', border: 'none' }}>
        <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-2)', color: 'var(--color-info)' }}>
          📋 CSV Format Required
        </p>
        <code style={{
          fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)',
          color: 'var(--text-secondary)', display: 'block',
        }}>
          name, category, quantity, location, description
        </code>
      </div>

      {/* Upload Zone */}
      <div
        className={`file-upload-zone ${dragActive ? 'active' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept=".csv" hidden
          onChange={(e) => e.target.files[0] && setFile(e.target.files[0])} />
        {file ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <FileSpreadsheet size={24} style={{ color: 'var(--color-success)' }} />
            <div>
              <div style={{ fontWeight: 600 }}>{file.name}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                {(file.size / 1024).toFixed(1)} KB
              </div>
            </div>
          </div>
        ) : (
          <>
            <Upload size={32} style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-2)' }} />
            <p style={{ fontWeight: 600 }}>Drop your CSV file here</p>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
              or click to browse files
            </p>
          </>
        )}
      </div>

      {file && (
        <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 'var(--space-4)' }}
          onClick={handleUpload} disabled={loading}>
          {loading ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Importing...</> : <><Upload size={18} /> Import Assets</>}
        </button>
      )}

      {result && (
        <div className="card animate-fade-in" style={{ marginTop: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
            <CheckCircle size={20} style={{ color: 'var(--color-success)' }} />
            <h3 style={{ fontWeight: 700 }}>Import Results</h3>
          </div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            {JSON.stringify(result)}
          </p>
        </div>
      )}
    </div>
  );
}
