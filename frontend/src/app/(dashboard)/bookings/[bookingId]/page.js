'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useFetch } from '@/hooks/useFetch';
import api, { uploadFiles } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/utils';
import { BOOKING_STATUS, CONDITION_MAP } from '@/lib/constants';
import toast from 'react-hot-toast';
import {
  ArrowLeft, CheckCircle, XCircle, Package as PackageIcon, Send, RotateCcw,
  Loader2, Calendar, User, Hash, FileText, Clock, Camera, X,
} from 'lucide-react';

export default function BookingDetailPage() {
  const { bookingId } = useParams();
  const router = useRouter();
  const { isAdmin, user } = useAuth();
  const { data: booking, loading, refetch } = useFetch(`/bookings/${bookingId}`);

  const [actionLoading, setActionLoading] = useState('');
  const [notes, setNotes] = useState('');

  // Issue Units state
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [availableUnits, setAvailableUnits] = useState([]);
  const [selectedUnitIds, setSelectedUnitIds] = useState([]);
  const [unitsLoading, setUnitsLoading] = useState(false);

  // Return state
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [unitReturns, setUnitReturns] = useState([]);
  const [returnPhotos, setReturnPhotos] = useState([]);

  const handleAction = async (action, body = {}) => {
    setActionLoading(action);
    try {
      await api.put(`/bookings/${bookingId}/${action}`, body);
      toast.success(`Booking ${action}${action.endsWith('e') ? 'd' : 'ed'} successfully`);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.detail || `Failed to ${action} booking`);
    } finally {
      setActionLoading('');
    }
  };

  // Load available units when issue modal opens
  const openIssueModal = async () => {
    if (!booking?.asset_model_id) return toast.error('Missing asset model ID');
    setShowIssueModal(true);
    setUnitsLoading(true);
    try {
      const { data } = await api.get(`/assets/${booking.asset_model_id}/units`);
      const unitList = Array.isArray(data) ? data : data?.items || [];
      // Only show available units
      const available = unitList.filter(u => u.status === 'available');
      setAvailableUnits(available);
    } catch (err) {
      toast.error('Failed to load units');
    } finally {
      setUnitsLoading(false);
    }
  };

  const toggleUnitSelection = (unitId) => {
    setSelectedUnitIds(prev =>
      prev.includes(unitId) ? prev.filter(id => id !== unitId) : [...prev, unitId]
    );
  };

  const handleIssueUnits = async () => {
    if (selectedUnitIds.length === 0) return toast.error('Please select at least one unit');
    if (selectedUnitIds.length !== booking.quantity) {
      const proceed = confirm(`You selected ${selectedUnitIds.length} unit(s) but the booking requests ${booking.quantity}. Proceed anyway?`);
      if (!proceed) return;
    }
    setActionLoading('issue');
    try {
      await api.put(`/bookings/${bookingId}/issue`, {
        unit_assignments: selectedUnitIds.map(id => ({ asset_unit_id: id })),
      });
      toast.success('Units issued successfully! 📦');
      setShowIssueModal(false);
      setSelectedUnitIds([]);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to issue units');
    } finally {
      setActionLoading('');
    }
  };

  // Return modal
  const openReturnModal = () => {
    const assignments = booking?.unit_assignments || booking?.assigned_units || [];
    setUnitReturns(
      assignments.map(a => ({
        asset_unit_id: a.asset_unit_id || a.unit_id || a.id,
        unit_code: a.unit_code || a.asset_unit?.unit_code || '—',
        condition_after: 'Good',
        return_remarks: '',
      }))
    );
    setReturnPhotos([]);
    setShowReturnModal(true);
  };

  const updateUnitReturn = (index, field, value) => {
    setUnitReturns(prev => prev.map((ur, i) => i === index ? { ...ur, [field]: value } : ur));
  };

  const handleReturn = async () => {
    if (unitReturns.length === 0) return toast.error('No units to return');
    setActionLoading('return');
    try {
      await api.put(`/bookings/${bookingId}/return`, {
        unit_returns: unitReturns.map(({ asset_unit_id, condition_after, return_remarks }) => ({
          asset_unit_id,
          condition_after,
          return_remarks: return_remarks || undefined,
        })),
      });

      // Upload return photos if any
      if (returnPhotos.length > 0) {
        try {
          await uploadFiles(
            `/bookings/${bookingId}/return-photos`,
            returnPhotos,
            'files',
          );
        } catch {
          toast.error('Return processed but photo upload failed');
        }
      }

      toast.success('Return processed successfully! ✅');
      setShowReturnModal(false);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to process return');
    } finally {
      setActionLoading('');
    }
  };

  if (loading) {
    return (
      <div className="page-content">
        <div className="skeleton" style={{ height: 24, width: 120, marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 200, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 120 }} />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="page-content">
        <div className="empty-state">
          <h3 className="empty-state-title">Booking not found</h3>
          <Link href="/bookings/my" className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }}>
            <ArrowLeft size={16} /> Back to Bookings
          </Link>
        </div>
      </div>
    );
  }

  const isOwner = (booking.user_id || booking.booked_by) === user?.id;
  const statusInfo = BOOKING_STATUS[booking.status] || { label: booking.status, color: 'badge-neutral' };
  const assignedUnits = booking?.unit_assignments || booking?.assigned_units || [];

  return (
    <div className="page-content" style={{ maxWidth: 800 }}>
      <Link href={isAdmin ? '/bookings' : '/bookings/my'} style={{
        display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
        fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)',
        textDecoration: 'none',
      }}>
        <ArrowLeft size={16} /> Back to Bookings
      </Link>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, marginBottom: 'var(--space-2)' }}>
            {booking.asset_model_name || booking.asset_name || 'Booking Details'}
          </h1>
          <span className={`badge ${statusInfo.color}`} style={{ fontSize: 'var(--text-sm)', padding: '4px 16px' }}>
            {statusInfo.label}
          </span>
        </div>
      </div>

      {/* Info Grid */}
      <div className="card animate-fade-in" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="grid-cols-2" style={{ gap: 'var(--space-4)' }}>
          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 2 }}>Requested By</div>
            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <User size={14} /> {booking.user_name || booking.user_email || 'User'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 2 }}>Quantity</div>
            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Hash size={14} /> {booking.quantity} unit{booking.quantity !== 1 ? 's' : ''}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 2 }}>Start Date</div>
            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={14} /> {formatDate(booking.start_date)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 2 }}>End Date</div>
            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={14} /> {formatDate(booking.end_date)}
            </div>
          </div>
        </div>
        {booking.purpose && (
          <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 4 }}>Purpose</div>
            <p style={{ fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>{booking.purpose}</p>
          </div>
        )}
        {booking.approval_notes && (
          <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 4 }}>Admin Notes</div>
            <p style={{ fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>{booking.approval_notes}</p>
          </div>
        )}
      </div>

      {/* Assigned Units (visible when issued/active/returned) */}
      {assignedUnits.length > 0 && (
        <div className="card animate-fade-in" style={{ marginBottom: 'var(--space-4)' }}>
          <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-3)' }}>Assigned Units</h3>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Unit Code</th>
                  <th>Serial Number</th>
                  <th>Condition</th>
                </tr>
              </thead>
              <tbody>
                {assignedUnits.map((unit) => (
                  <tr key={unit.asset_unit_id || unit.unit_id || unit.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                      {unit.unit_code || unit.asset_unit?.unit_code || '—'}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
                      {unit.serial_number || unit.asset_unit?.serial_number || '—'}
                    </td>
                    <td>
                      <span className={`badge ${CONDITION_MAP[unit.condition_after || unit.condition]?.color || 'badge-neutral'}`}>
                        {unit.condition_after || unit.condition || 'N/A'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="card animate-fade-in" style={{ animationDelay: '100ms' }}>
        <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-4)' }}>Actions</h3>

        {/* User: Cancel pending booking */}
        {isOwner && booking.status === 'pending' && (
          <button className="btn btn-danger"
            onClick={() => handleAction('cancel')}
            disabled={actionLoading === 'cancel'}>
            {actionLoading === 'cancel' ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <XCircle size={16} />}
            Cancel Booking
          </button>
        )}

        {/* Admin actions */}
        {isAdmin && booking.status === 'pending' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div className="input-group">
              <label className="input-label">Notes (optional for approval, required for rejection)</label>
              <textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this decision..." rows={3} />
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button className="btn btn-success" style={{ flex: 1 }}
                onClick={() => handleAction('approve', { approval_notes: notes })}
                disabled={!!actionLoading}>
                {actionLoading === 'approve' ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={16} />}
                Approve
              </button>
              <button className="btn btn-danger" style={{ flex: 1 }}
                onClick={() => {
                  if (!notes) return toast.error('Please add a reason for rejection');
                  handleAction('reject', { approval_notes: notes });
                }}
                disabled={!!actionLoading}>
                {actionLoading === 'reject' ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <XCircle size={16} />}
                Reject
              </button>
            </div>
          </div>
        )}

        {/* Issue Units */}
        {isAdmin && booking.status === 'approved' && (
          <button className="btn btn-primary" onClick={openIssueModal}>
            <Send size={16} /> Issue Units
          </button>
        )}

        {/* Process Return */}
        {isAdmin && (booking.status === 'active' || booking.status === 'overdue') && (
          <button className="btn btn-secondary" onClick={openReturnModal}>
            <RotateCcw size={16} /> Process Return
          </button>
        )}

        {/* View Audit Logs */}
        {isAdmin && (
          <Link href={`/audit/entity/booking/${bookingId}`} className="btn btn-secondary">
            <FileText size={16} /> View Audit Logs
          </Link>
        )}

        {!isOwner && !isAdmin && !['pending'].includes(booking.status) && (
          <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
            No actions available for this booking.
          </p>
        )}
      </div>

      {/* Timeline */}
      <div className="card animate-fade-in" style={{ marginTop: 'var(--space-4)', animationDelay: '200ms' }}>
        <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-4)' }}>Timeline</h3>
        <div className="timeline">
          <div className="timeline-item">
            <div className="timeline-dot completed" />
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Booking Created</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{formatDateTime(booking.created_at)}</div>
          </div>
          {booking.approved_at && (
            <div className="timeline-item">
              <div className="timeline-dot completed" />
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Approved</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{formatDateTime(booking.approved_at)}</div>
            </div>
          )}
          {booking.issued_at && (
            <div className="timeline-item">
              <div className="timeline-dot completed" />
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Units Issued</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{formatDateTime(booking.issued_at)}</div>
            </div>
          )}
          {booking.returned_at && (
            <div className="timeline-item">
              <div className="timeline-dot completed" />
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Returned</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{formatDateTime(booking.returned_at)}</div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Issue Units Modal ─── */}
      {showIssueModal && (
        <>
          <div className="modal-overlay" onClick={() => setShowIssueModal(false)} />
          <div className="modal animate-fade-in" style={{ maxWidth: 560 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 800 }}>Issue Units</h2>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowIssueModal(false)}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
              Select <strong>{booking.quantity}</strong> unit{booking.quantity !== 1 ? 's' : ''} to assign to this booking.
              {selectedUnitIds.length > 0 && (
                <span className="badge badge-info" style={{ marginLeft: 'var(--space-2)' }}>
                  {selectedUnitIds.length} selected
                </span>
              )}
            </p>

            {unitsLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 48 }} />)}
              </div>
            ) : availableUnits.length === 0 ? (
              <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                <p className="empty-state-desc">No available units for this asset model.</p>
              </div>
            ) : (
              <div style={{ maxHeight: 320, overflowY: 'auto', marginBottom: 'var(--space-4)' }}>
                {availableUnits.map((unit) => {
                  const isSelected = selectedUnitIds.includes(unit.id);
                  return (
                    <div
                      key={unit.id}
                      onClick={() => toggleUnitSelection(unit.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                        padding: 'var(--space-3) var(--space-4)',
                        borderRadius: 'var(--radius-md)',
                        border: `2px solid ${isSelected ? 'var(--color-primary)' : 'var(--border-color)'}`,
                        background: isSelected ? 'var(--color-primary-light)' : 'var(--bg-surface)',
                        cursor: 'pointer', marginBottom: 'var(--space-2)',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{
                        width: 20, height: 20, borderRadius: 4,
                        border: `2px solid ${isSelected ? 'var(--color-primary)' : 'var(--border-color)'}`,
                        background: isSelected ? 'var(--color-primary)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, transition: 'all 0.2s ease',
                      }}>
                        {isSelected && <CheckCircle size={14} style={{ color: '#fff' }} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>
                          {unit.unit_code}
                        </div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                          S/N: {unit.serial_number || '—'} · {unit.condition || 'Good'}
                        </div>
                      </div>
                      <span className={`badge ${CONDITION_MAP[unit.condition]?.color || 'badge-neutral'}`}>
                        {unit.condition || 'N/A'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowIssueModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleIssueUnits}
                disabled={selectedUnitIds.length === 0 || actionLoading === 'issue'}>
                {actionLoading === 'issue' ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
                Issue {selectedUnitIds.length} Unit{selectedUnitIds.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ─── Return Processing Modal ─── */}
      {showReturnModal && (
        <>
          <div className="modal-overlay" onClick={() => setShowReturnModal(false)} />
          <div className="modal animate-fade-in" style={{ maxWidth: 640 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 800 }}>Process Return</h2>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowReturnModal(false)}>
                <X size={18} />
              </button>
            </div>

            {unitReturns.length === 0 ? (
              <div className="empty-state" style={{ padding: 'var(--space-6)' }}>
                <p className="empty-state-desc">No assigned units found for this booking. The units may not have been assigned yet.</p>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
                  Record the condition of each returned unit.
                </p>

                <div style={{ maxHeight: 360, overflowY: 'auto', marginBottom: 'var(--space-4)' }}>
                  {unitReturns.map((ur, idx) => (
                    <div key={ur.asset_unit_id} className="card" style={{
                      marginBottom: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)',
                      background: 'var(--bg-surface-hover)',
                    }}>
                      <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>
                        {ur.unit_code}
                      </div>
                      <div className="grid-cols-2" style={{ gap: 'var(--space-3)' }}>
                        <div className="input-group" style={{ marginBottom: 0 }}>
                          <label className="input-label" style={{ fontSize: 'var(--text-xs)' }}>Condition After</label>
                          <select className="input" value={ur.condition_after}
                            onChange={(e) => updateUnitReturn(idx, 'condition_after', e.target.value)}
                            style={{ height: 36 }}>
                            <option value="New">New</option>
                            <option value="Good">Good</option>
                            <option value="Fair">Fair</option>
                            <option value="Poor">Poor</option>
                            <option value="Damaged">Damaged</option>
                          </select>
                        </div>
                        <div className="input-group" style={{ marginBottom: 0 }}>
                          <label className="input-label" style={{ fontSize: 'var(--text-xs)' }}>Remarks</label>
                          <input type="text" className="input" placeholder="Optional notes..."
                            value={ur.return_remarks}
                            onChange={(e) => updateUnitReturn(idx, 'return_remarks', e.target.value)}
                            style={{ height: 36 }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Return Photos */}
                <div style={{ marginBottom: 'var(--space-4)' }}>
                  <label className="input-label" style={{ marginBottom: 'var(--space-2)' }}>
                    <Camera size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                    Return Photos (optional evidence)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => setReturnPhotos(Array.from(e.target.files || []))}
                    className="input"
                    style={{ padding: 'var(--space-2)' }}
                  />
                  {returnPhotos.length > 0 && (
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>
                      {returnPhotos.length} photo{returnPhotos.length !== 1 ? 's' : ''} selected
                    </div>
                  )}
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowReturnModal(false)}>Cancel</button>
              <button className="btn btn-success" onClick={handleReturn}
                disabled={unitReturns.length === 0 || actionLoading === 'return'}>
                {actionLoading === 'return' ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <RotateCcw size={16} />}
                Confirm Return
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
