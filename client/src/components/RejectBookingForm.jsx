import { useState } from 'react';
import axios from 'axios';
import { AlertTriangle } from 'lucide-react';

const rupees = (paise) => `₹${(paise / 100).toLocaleString('en-IN')}`;

/**
 * The single place a booking gets rejected.
 *
 * Both the bookings list and the calendar's closure-conflict modal mount this, so
 * the refund amount and the strike warning cannot drift apart between the two —
 * an operator must see the same consequence wherever they cancel from.
 */
const RejectBookingForm = ({ booking, onCancel, onDone, keepLabel = 'Keep the booking' }) => {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const refundable = booking.amountPaise - (booking.refundedPaise || 0);
  const guest = booking.guestName || booking.tourist?.name;

  const submit = async () => {
    if (!reason.trim()) {
      setError('Please give the traveller a reason');
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await axios.post(`/api/operator/bookings/${booking._id}/reject`, { reason });
      await onDone(booking);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not cancel this booking');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="confirm-panel">
      <div className="row" style={{ gap: '0.5rem', marginBottom: '0.6rem' }}>
        <AlertTriangle size={16} style={{ color: 'var(--warning)', flexShrink: 0 }} />
        <strong>Cancel a booking {guest ? `${guest} has` : 'the traveller has'} paid for?</strong>
      </div>

      <p className="small muted" style={{ marginBottom: '0.85rem' }}>
        They will be refunded <strong>{rupees(refundable)}</strong> in full, regardless of how
        close the date is, and a <strong>strike</strong> will be recorded against your account.
      </p>

      {error && <div className="alert alert-error" style={{ marginBottom: '0.85rem' }}>{error}</div>}

      <div className="field" style={{ marginBottom: '0.85rem' }}>
        <label className="label" htmlFor={`reason-${booking._id}`}>Reason for the traveller</label>
        <input
          id={`reason-${booking._id}`}
          className="input"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Burst water pipe, family emergency…"
          autoFocus
        />
      </div>

      <div className="row" style={{ gap: '0.5rem' }}>
        <button type="button" className="btn btn-secondary btn-sm grow" disabled={busy} onClick={onCancel}>
          {keepLabel}
        </button>
        <button type="button" className="btn btn-primary btn-sm grow" disabled={busy} onClick={submit}>
          {busy ? 'Cancelling…' : 'Cancel and refund'}
        </button>
      </div>
    </div>
  );
};

export default RejectBookingForm;
