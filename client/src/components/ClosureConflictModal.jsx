import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, X, Clock, ExternalLink } from 'lucide-react';
import RejectBookingForm from './RejectBookingForm';
import { fmtDay, fmtRange, fmtTime } from '../utils/dates';

const rupees = (paise) => `₹${(paise / 100).toLocaleString('en-IN')}`;

// Every status that still occupies the calendar can land here, not just confirmed —
// a no-show holds the room until its checkout date just as firmly.
const STATUS = {
  confirmed: { label: 'Confirmed', cls: 'badge-success' },
  pending_payment: { label: 'Awaiting payment', cls: 'badge-warning' },
  completed: { label: 'Completed', cls: 'badge-neutral' },
  no_show: { label: 'No show', cls: 'badge-danger' },
};

/**
 * Shown when an operator tries to close dates that already have reservations on
 * them. The old behaviour was a red banner saying "cancel them first", which named
 * nobody and led nowhere — so this names the guests and offers the three things
 * the operator might actually want: drop a booking, close only the free days, or
 * go and look at the reservations in full.
 */
const ClosureConflictModal = ({ conflict, listingId, onClose, onRejected, onCloseFreeDates, busy }) => {
  const [rejecting, setRejecting] = useState(null);

  // Escape closes, matching every other dialog the operator has ever used.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const { conflicts = [], freeRanges = [], requested } = conflict;

  const freeSummary = freeRanges.map(r => fmtRange(r.startDate, r.endDate)).join(', ');

  // Take the statuses from the conflicts themselves rather than assuming — a no-show
  // or a completed stay can be what's in the way, and hardcoding the usual two would
  // send the operator to an empty list.
  const statuses = [...new Set(conflicts.map(b => b.status))].join(',');

  const bookingsHref = `/operator/bookings?listing=${listingId}`
    + `&from=${requested.startDate}&to=${requested.endDate}`
    + (statuses ? `&status=${statuses}` : '');

  const describe = (booking) => {
    if (booking.category === 'guide') return fmtDay(booking.checkIn);
    return `${fmtDay(booking.checkIn)} → ${fmtDay(booking.checkOut)} · ${booking.units} room${booking.units > 1 ? 's' : ''}`;
  };

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="conflict-title">
        <div className="modal-head">
          <div className="row" style={{ gap: '0.55rem' }}>
            <AlertTriangle size={18} style={{ color: 'var(--warning)', flexShrink: 0 }} />
            <h3 id="conflict-title" style={{ margin: 0 }}>Can't close these dates yet</h3>
          </div>
          <button className="btn-icon" onClick={onClose} title="Close" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          <p className="small muted" style={{ marginBottom: '1.1rem' }}>
            {conflicts.length} booking{conflicts.length > 1 ? 's' : ''} fall
            {conflicts.length > 1 ? '' : 's'} inside{' '}
            <strong>{fmtRange(requested.startDate, requested.endDate)}</strong>.
          </p>

          <div className="stack-sm">
            {conflicts.map(b => (
              <div key={b._id} className="conflict-row">
                <div className="row-between" style={{ alignItems: 'flex-start', gap: '1rem' }}>
                  <div>
                    <div className="strong">{b.guestName}</div>
                    <div className="small" style={{ marginTop: '0.15rem' }}>{describe(b)}</div>
                    <div className="tiny faint" style={{ marginTop: '0.3rem' }}>
                      {b.bookingRef ? `Ref ${b.bookingRef} · ` : ''}{rupees(b.amountPaise)}
                      {b.guestPhone ? ` · ${b.guestPhone}` : ''}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span className={`badge ${(STATUS[b.status] || {}).cls || 'badge-neutral'}`}>
                      {(STATUS[b.status] || {}).label || b.status}
                    </span>
                  </div>
                </div>

                {/* An unpaid hold needs no decision — the sweeper releases it. Saying so
                    stops the operator hunting for a button that cannot exist. */}
                {b.status === 'pending_payment' && (
                  <div className="row small muted" style={{ gap: '0.4rem', marginTop: '0.65rem' }}>
                    <Clock size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>
                      Someone is paying for this right now. The hold expires at{' '}
                      <strong>{fmtTime(b.holdExpiresAt)}</strong> — if they don't pay, these dates
                      free up on their own.
                    </span>
                  </div>
                )}

                {b.status === 'confirmed' && b.canReject && rejecting !== b._id && (
                  <div className="conflict-foot">
                    <span className="tiny muted">Refund {rupees(b.amountPaise - (b.refundedPaise || 0))} · 1 strike</span>
                    <button className="btn btn-danger-ghost btn-sm" disabled={busy}
                      onClick={() => setRejecting(b._id)}>
                      Reject &amp; refund guest
                    </button>
                  </div>
                )}

                {/* Settled or past bookings can't be cancelled, but they still hold the
                    room until checkout — say which, so the refusal isn't a mystery. */}
                {b.status !== 'pending_payment' && !b.canReject && (
                  <div className="small muted" style={{ marginTop: '0.65rem' }}>
                    {b.status === 'confirmed'
                      ? 'This stay has already taken place, so it can no longer be cancelled.'
                      : `Already settled as ${(STATUS[b.status] || {}).label?.toLowerCase() || b.status}.`}
                    {' '}It holds the room until checkout on <strong>{fmtDay(b.checkOut)}</strong>.
                  </div>
                )}

                {rejecting === b._id && (
                  <RejectBookingForm
                    booking={b}
                    keepLabel="Keep it"
                    onCancel={() => setRejecting(null)}
                    onDone={async () => { setRejecting(null); await onRejected(); }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="modal-foot">
          {freeRanges.length > 0 && (
            <button className="btn btn-primary" disabled={busy} onClick={onCloseFreeDates}>
              {busy ? 'Closing…' : `Close the free dates only (${freeSummary})`}
            </button>
          )}

          <div className="row" style={{ gap: '0.5rem' }}>
            <Link className="btn btn-secondary grow" to={bookingsHref}>
              <ExternalLink size={14} /> View in Bookings
            </Link>
            <button className="btn btn-secondary grow" onClick={onClose}>Back</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClosureConflictModal;
