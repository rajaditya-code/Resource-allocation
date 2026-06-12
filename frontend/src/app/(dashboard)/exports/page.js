'use client';

import { useState } from 'react';
import { downloadFile } from '@/lib/api';
import { EXPORT_TYPES } from '@/lib/constants';
import toast from 'react-hot-toast';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';

export default function ExportsPage() {
  const [downloadingKey, setDownloadingKey] = useState('');

  const handleDownload = async (key, format) => {
    const id = `${key}-${format}`;
    setDownloadingKey(id);
    try {
      await downloadFile(`export/${key}`, `${key}-report`, format);
      toast.success('Report downloaded! 📥');
    } catch (err) {
      const msg = err.message || 'Download failed';
      toast.error(msg);
    } finally {
      setDownloadingKey('');
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title"><Download size={28} /> Export Reports</h1>
          <p className="page-subtitle">Download data reports in CSV or PDF format</p>
        </div>
      </div>

      <div className="grid-auto">
        {EXPORT_TYPES.map((type, idx) => (
          <div key={type.key} className="card animate-fade-in-up" style={{ animationDelay: `${idx * 60}ms` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
              <div style={{
                width: 44, height: 44, borderRadius: 'var(--radius-md)',
                background: 'var(--color-primary-light)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <FileText size={22} style={{ color: 'var(--color-primary)' }} />
              </div>
              <div>
                <h3 style={{ fontWeight: 700, fontSize: 'var(--text-base)' }}>{type.label}</h3>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{type.desc}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                className="btn btn-secondary btn-sm"
                style={{ flex: 1 }}
                onClick={() => handleDownload(type.key, 'csv')}
                disabled={downloadingKey === `${type.key}-csv`}
              >
                {downloadingKey === `${type.key}-csv` ? (
                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <FileSpreadsheet size={14} />
                )}
                CSV
              </button>
              <button
                className="btn btn-secondary btn-sm"
                style={{ flex: 1 }}
                onClick={() => handleDownload(type.key, 'pdf')}
                disabled={downloadingKey === `${type.key}-pdf`}
              >
                {downloadingKey === `${type.key}-pdf` ? (
                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <FileText size={14} />
                )}
                PDF
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
