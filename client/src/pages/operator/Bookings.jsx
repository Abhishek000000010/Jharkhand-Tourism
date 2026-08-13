import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import {
  Download, MapPin, AlertTriangle, Filter, X, Search, Phone, Mail, RefreshCw,
  List, CalendarRange,
} from 'lucide-react';
import OperatorLayout from '../../components/OperatorLayout';
import RejectBookingForm from '../../components/RejectBookingForm';
import BookingTimeline from '../../components/BookingTimeline';
import { fmtDay, fmtRange } from '../../utils/dates';

const rupees = (paise) => `₹${Math.round((paise || 0) / 100).toLocaleString('en-IN')}`;

// Filters the availability calendar deep-links with when it sends an operator here
// to deal with the bookings standing in the way of closing dates.
const FILTER_KEYS = ['listing', 'from', 'to', 'status'];

const STATUS = {
  pending_payment: { label: 'Awaiting payment', cls: 'badge-warning' },
  confirmed: { label: 'Confirmed', cls: 'badge-success' },
  cancelled: { label: 'Cancelled', cls: 'badge-neutral' },
  rejected: { label: 'You cancelled', cls: 'badge-danger' },
  expired: { label: 'Hold expired', cls: 'badge-neutral' },
  completed: { label: 'Completed', cls: 'badge-success' },
  no_show: { label: 'No show', cls: 'badge-danger' },
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const started = (b) => b.category === 'artisan' || (b.checkIn || '').slice(0, 10) <= todayIso();
const ended = (b) => b.category === 'artisan' || (b.checkOut || '').slice(0, 10) <= todayIso();

/**
 * Buckets an operator actually thinks in. "Needs you" is first because it is the
 * only one carrying work — a stay that has finished sits there until it is marked
 * completed, and nothing else on the page tells them that.
 */
const TABS = [
  { key: 'action', label: 'Needs you', match: (b) => b.status === 'confirmed' && started(b) },
  { key: 'upcoming', label: 'Upcoming', match: (b) => b.status === 'confirmed' && !started(b) },
  { key: 'holds', label: 'Holds', match: (b) => b.status === 'pending_payment' },
  { key: 'past', label: 'Past', match: (b) => ['completed', 'no_show'].includes(b.status) },
  { key: 'cancelled', label: 'Cancelled', match: (b) => ['cancelled', 'rejected', 'expired'].includes(b.status) },
  { key: 'all', label: 'All', match: () => true },
];

const OperatorBookings = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [bookings, setBookings] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rejecting, setRejecting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(null);
  const [search, setSearch] = useState('');
  // Deep-linkable so the analytics page can send an operator straight to the agenda.
  const [view, setView] = useState(searchParams.get('view') === 'timeline' ? 'timeline' : 'list');

  const params = {};
  for (const key of FILTER_KEYS) {
    const value = searchParams.get(key);
    if (value) params[key] = value;
  }
  const filtered = Object.keys(params).length > 0;

  const load = useCallback(async () => {
    try {
      const [b, p] = await Promise.all([
        axios.get('/api/operator/bookings', { params }),
        axios.get('/api/operator/profile').catch(() => null),
      ]);
      setBookings(b.data.bookings);
      if (p) setProfile(p.data.profile);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load your bookings');
      setBookings([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const out = {};
    for (const t of TABS) out[t.key] = bookings.filter(t.match).length;
    return out;
  }, [bookings]);

  // Land on the first bucket that actually holds something. Opening on an empty
  // "Needs you" tab reads as a broken page even when everything is fine.
  // Arriving from the calendar is different: the operator wants that whole window,
  // whatever state it is in, so show them all of it.
  useEffect(() => {
    // Wait for the first fetch, otherwise every count is 0 and this locks onto the
    // fallback before the real data has a chance to decide.
    if (tab !== null || loading) return;
    if (filtered) return setTab('all');
    setTab(TABS.find(t => counts[t.key] > 0)?.key || 'action');
  }, [counts, filtered, tab, loading]);

  const act = async (id, action) => {
    setBusy(true);
    setError(null);
    try {
      await axios.post(`/api/operator/bookings/${id}/${action}`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update this booking');
    } finally {
      setBusy(false);
    }
  };

  const openVoucher = async (b) => {
    try {
      const res = await axios.get(`/api/bookings/${b._id}/voucher`, { responseType: 'blob' });
      window.open(URL.createObjectURL(res.data), '_blank');
    } catch {
      setError('Could not open the voucher');
    }
  };

  if (loading) return (
    <OperatorLayout>
      <div className="page page--mid"><div className="muted">Loading bookings…</div></div>
    </OperatorLayout>
  );

  // Every booking that was actually paid for counts — including cancelled ones, because
  // a late cancellation refunds only part of the money and the operator keeps the rest.
  // `operatorPayoutPaise` is already net of refunds, so the ledger balances:
  //   gross − refunded === commission + net
  const paid = bookings.filter(b => b.paidAt);
  const gross = paid.reduce((s, b) => s + b.amountPaise, 0);
  const refunded = paid.reduce((s, b) => s + (b.refundedPaise || 0), 0);
  const commission = paid.reduce((s, b) => s + (b.commissionPaise || 0), 0);
  const net = paid.reduce((s, b) => s + (b.operatorPayoutPaise || 0), 0);

  const term = search.trim().toLowerCase();
  const visible = bookings
    .filter((TABS.find(t => t.key === tab) || TABS[TABS.length - 1]).match)
    .filter(b => !term
      || (b.guestName || b.tourist?.name || '').toLowerCase().includes(term)
      || (b.bookingRef || '').toLowerCase().includes(term)
      || (b.listing?.title || '').toLowerCase().includes(term));

  const describe = (b) => {
    if (b.category === 'artisan') return `${b.units} item${b.units > 1 ? 's' : ''}`;
    if (b.category === 'guide') return fmtDay(b.checkIn);
    return `${fmtDay(b.checkIn)} → ${fmtDay(b.checkOut)} · ${b.units} room${b.units > 1 ? 's' : ''}`;
  };

  const nights = (b) => {
    if (!b.checkIn || !b.checkOut) return null;
    return Math.round((new Date(b.checkOut) - new Date(b.checkIn)) / 86400000);
  };

  return (
    <OperatorLayout>
      <div className="page">
        <div className="section-head">
          <div>
            <h1 className="page-title" style={{ marginBottom: '0.25rem' }}>Bookings</h1>
            <p className="page-sub" style={{ margin: 0 }}>
              Reservations across all your listings, and what each one earns you.
            </p>
          </div>
          <div className="row" style={{ gap: '0.5rem' }}>
            {/* Two ways to read the same reservations: as a ledger, or as an agenda. */}
            <div className="tabs">
              <button className={`tab ${view === 'list' ? 'tab--on' : ''}`} onClick={() => setView('list')}>
                <List size={14} /> List
              </button>
              <button className={`tab ${view === 'timeline' ? 'tab--on' : ''}`} onClick={() => setView('timeline')}>
                <CalendarRange size={14} /> Timeline
              </button>
            </div>
            <button className="btn btn-secondary btn-sm" disabled={refreshing}
              onClick={() => { setRefreshing(true); load(); }}>
              <RefreshCw size={14} className={refreshing ? 'spin' : undefined} /> Refresh
            </button>
          </div>
        </div>

        {filtered && (
          <div className="filter-note" style={{ marginBottom: '1.5rem' }}>
            <Filter size={14} style={{ flexShrink: 0 }} />
            <span className="small">
              Showing <strong>{bookings[0]?.listing?.title || 'one listing'}</strong>
              {params.from && params.to && <> · <strong>{fmtRange(params.from, params.to)}</strong></>}
            </span>
            <button className="btn btn-secondary btn-sm" onClick={() => setSearchParams({})}>
              <X size={13} /> Clear
            </button>
          </div>
        )}

        {error && <div className="alert alert-error" style={{ marginBottom: '1.25rem' }}>{error}</div>}

        {profile?.strikes > 0 && (
          <div className="alert alert-warning" style={{ marginBottom: '1.5rem' }}>
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>{profile.strikes} strike{profile.strikes > 1 ? 's' : ''} on your account.</strong>{' '}
              Strikes are recorded when you cancel a booking a traveller already paid for. The
              tourism department reviews operators who accumulate them.
            </div>
          </div>
        )}

        {filtered && (
          <p className="tiny muted" style={{ marginBottom: '0.55rem' }}>
            Totals cover the filtered bookings only.
          </p>
        )}

        <div className="kpi-row">
          <div className="kpi">
            <div className="spec-label">Gross</div>
            <div className="kpi-value" style={{ marginTop: '0.35rem' }}>{rupees(gross)}</div>
            <div className="tiny muted">{paid.length} paid booking{paid.length === 1 ? '' : 's'}</div>
          </div>
          <div className="kpi">
            <div className="spec-label">Refunded</div>
            <div className="kpi-value" style={{ marginTop: '0.35rem', color: 'var(--text-muted)' }}>
              −{rupees(refunded)}
            </div>
            <div className="tiny muted">Returned to travellers</div>
          </div>
          <div className="kpi">
            <div className="spec-label">Commission</div>
            <div className="kpi-value" style={{ marginTop: '0.35rem', color: 'var(--text-muted)' }}>
              −{rupees(commission)}
            </div>
            <div className="tiny muted">Platform share, frozen per booking</div>
          </div>
          <div className="kpi">
            <div className="spec-label">Your earnings</div>
            <div className="kpi-value" style={{ marginTop: '0.35rem', color: 'var(--accent)' }}>
              {rupees(net)}
            </div>
            <div className="tiny muted">Settled after each checkout</div>
          </div>
        </div>

        <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
          Settlement to your bank account is simulated in this build — the ledger above is
          accurate, but no payout is actually transferred.
        </div>

        {view === 'timeline' ? <BookingTimeline /> : (
        <>
        <div className="toolbar">
          <div className="tabs">
            {TABS.map(t => (
              <button
                key={t.key}
                className={`tab ${tab === t.key ? 'tab--on' : ''}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
                <span className="tab-count">{counts[t.key]}</span>
              </button>
            ))}
          </div>

          <div className="search-inline">
            <Search size={14} />
            <input
              className="search-inline-input"
              placeholder="Guest, ref or listing"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="empty">
            <h3>
              {term ? 'Nothing matches that search'
                : filtered ? 'Nothing matches this filter'
                : tab === 'action' ? 'Nothing needs you right now'
                : 'No bookings here yet'}
            </h3>
            <p className="muted">
              {filtered
                ? 'Those dates are clear now — you can go back and close them.'
                : tab === 'action'
                  ? 'Stays that have finished will appear here to be marked completed.'
                  : 'Reservations will appear here as travellers book.'}
            </p>
          </div>
        ) : (
          <div className="stack">
            {visible.map(b => {
              const s = STATUS[b.status] || { label: b.status, cls: 'badge-neutral' };
              const nightCount = nights(b);

              return (
                <div key={b._id} className="booking-item">
                  <div className="booking-main">
                    {b.category !== 'artisan' && b.checkIn && (
                      <div className="arrival-date">
                        <span className="arrival-day">{fmtDay(b.checkIn).split(' ')[0]}</span>
                        <span className="arrival-mon">{fmtDay(b.checkIn).split(' ')[1]}</span>
                      </div>
                    )}

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="strong">{b.guestName || b.tourist?.name}</div>
                      <div className="small" style={{ marginTop: '0.15rem' }}>
                        {describe(b)}
                        {nightCount ? ` · ${nightCount} night${nightCount > 1 ? 's' : ''}` : ''}
                      </div>
                      <div className="row small muted" style={{ gap: '0.3rem', marginTop: '0.3rem' }}>
                        <MapPin size={13} /> {b.listing?.title} · {b.listing?.district}
                      </div>
                      {b.bookingRef && <div className="tiny faint" style={{ marginTop: '0.25rem' }}>Ref {b.bookingRef}</div>}
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span className={`badge ${s.cls}`}>{s.label}</span>
                      <div className="price" style={{ fontSize: '1.1rem', marginTop: '0.5rem' }}>{rupees(b.amountPaise)}</div>
                      {['confirmed', 'completed', 'no_show'].includes(b.status) && (
                        <div className="tiny muted">You receive {rupees(b.operatorPayoutPaise || 0)}</div>
                      )}
                      {b.refundedPaise > 0 && (
                        <div className="tiny" style={{ color: 'var(--danger)' }}>{rupees(b.refundedPaise)} refunded</div>
                      )}
                    </div>
                  </div>

                  {b.status === 'confirmed' && (
                    <>
                      <div className="booking-foot">
                        <div className="row" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => openVoucher(b)}>
                            <Download size={14} /> Voucher
                          </button>
                          {/* The operator has no in-app channel to the guest yet, so hand them
                              the details rather than leaving them to hunt for a phone number. */}
                          {b.guestPhone && (
                            <a className="btn btn-secondary btn-sm" href={`tel:${b.guestPhone}`}>
                              <Phone size={14} /> {b.guestPhone}
                            </a>
                          )}
                          {b.tourist?.email && (
                            <a className="btn btn-secondary btn-sm"
                              href={`mailto:${b.tourist.email}?subject=${encodeURIComponent(`Your stay at ${b.listing?.title || 'our homestay'}`)}`}>
                              <Mail size={14} /> Email
                            </a>
                          )}
                        </div>

                        <div className="row" style={{ gap: '0.5rem' }}>
                          {!started(b) && (
                            <button className="btn btn-danger-ghost btn-sm" disabled={busy}
                              onClick={() => { setRejecting(b._id); setError(null); }}>
                              Can't host this
                            </button>
                          )}
                          {started(b) && !ended(b) && (
                            <button className="btn btn-secondary btn-sm" disabled={busy}
                              onClick={() => act(b._id, 'no-show')}>
                              No show
                            </button>
                          )}
                          {ended(b) && (
                            <>
                              <button className="btn btn-secondary btn-sm" disabled={busy}
                                onClick={() => act(b._id, 'no-show')}>
                                No show
                              </button>
                              <button className="btn btn-primary btn-sm" disabled={busy}
                                onClick={() => act(b._id, 'complete')}>
                                Mark completed
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {rejecting === b._id && (
                        <div style={{ padding: '0 1.25rem 1.25rem' }}>
                          <RejectBookingForm
                            booking={b}
                            onCancel={() => setRejecting(null)}
                            onDone={async () => { setRejecting(null); await load(); }}
                          />
                        </div>
                      )}
                    </>
                  )}

                  {b.status === 'pending_payment' && b.holdExpiresAt && (
                    <div className="booking-foot">
                      <span className="small muted">
                        Hold expires {new Date(b.holdExpiresAt).toLocaleString('en-IN', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                        })} — the dates reopen on their own if they don't pay.
                      </span>
                    </div>
                  )}

                  {b.status === 'rejected' && b.cancellationReason && (
                    <div className="booking-foot">
                      <span className="small muted">You cancelled: {b.cancellationReason}</span>
                    </div>
                  )}

                  {b.status === 'cancelled' && (
                    <div className="booking-foot">
                      <span className="small muted">Cancelled by the traveller.</span>
                      {b.operatorPayoutPaise > 0 && (
                        <span className="small">You keep {rupees(b.operatorPayoutPaise)}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        </>
        )}
      </div>
    </OperatorLayout>
  );
};

export default OperatorBookings;
