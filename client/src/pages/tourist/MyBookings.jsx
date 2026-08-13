import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  Clock, MapPin, Download, CreditCard, AlertTriangle, Star, Search,
  Wallet, CalendarCheck, CheckCircle2, RotateCcw, PenLine, XCircle, ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { loadRazorpayCheckout } from '../../lib/razorpay';
import TouristLayout from '../../components/TouristLayout';
import { fmtDay } from '../../utils/dates';

const rupees = (paise) => `₹${((paise || 0) / 100).toLocaleString('en-IN')}`;

const short = (paise) => {
  const value = (paise || 0) / 100;
  if (Math.abs(value) >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (Math.abs(value) >= 1000) return `₹${(value / 1000).toFixed(1)}k`;
  return `₹${Math.round(value)}`;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const STATUS = {
  pending_payment: { label: 'Awaiting payment', cls: 'badge-warning' },
  confirmed: { label: 'Confirmed', cls: 'badge-success' },
  cancelled: { label: 'Cancelled', cls: 'badge-neutral' },
  rejected: { label: 'Rejected', cls: 'badge-danger' },
  expired: { label: 'Hold expired', cls: 'badge-neutral' },
  completed: { label: 'Completed', cls: 'badge-success' },
  no_show: { label: 'No show', cls: 'badge-danger' },
};

/** Which tab a booking belongs to. One booking, exactly one bucket. */
const bucketOf = (b) => {
  if (b.status === 'pending_payment') return 'action';
  if (b.status === 'confirmed') return 'upcoming';
  if (b.status === 'completed') return 'completed';
  return 'cancelled';
};

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'action', label: 'Awaiting payment' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const Kpi = ({ label, value, foot, icon }) => (
  <div className="kpi">
    <div className="row-between" style={{ alignItems: 'flex-start' }}>
      <div className="spec-label">{label}</div>
      <div className="kpi-icon">{icon}</div>
    </div>
    <div className="kpi-value" style={{ margin: '0.35rem 0 0.5rem' }}>{value}</div>
    <span className="tiny muted">{foot}</span>
  </div>
);

const Countdown = ({ expiresAt, onLapse }) => {
  const [left, setLeft] = useState(() => new Date(expiresAt) - Date.now());

  useEffect(() => {
    const t = setInterval(() => {
      const remaining = new Date(expiresAt) - Date.now();
      setLeft(remaining);
      if (remaining <= 0) { clearInterval(t); onLapse?.(); }
    }, 1000);
    return () => clearInterval(t);
  }, [expiresAt, onLapse]);

  if (left <= 0) return <span className="muted">Hold expired</span>;

  const mins = Math.floor(left / 60000);
  const secs = Math.floor((left % 60000) / 1000);
  return <span className="mono-num">{mins}:{String(secs).padStart(2, '0')} left to pay</span>;
};

/** Click-to-set stars. The old form made people pick one of five radio buttons. */
const StarPicker = ({ value, onChange }) => (
  <div className="row" style={{ gap: '0.25rem' }}>
    {[1, 2, 3, 4, 5].map(n => (
      <button
        key={n}
        type="button"
        onClick={() => onChange(n)}
        aria-label={`${n} star${n > 1 ? 's' : ''}`}
        style={{ background: 'none', border: 'none', padding: '0.15rem', cursor: 'pointer', lineHeight: 0 }}
      >
        <Star
          size={26}
          color={n <= value ? '#f59e0b' : 'var(--border-strong)'}
          fill={n <= value ? '#f59e0b' : 'none'}
        />
      </button>
    ))}
  </div>
);

const MyBookings = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [cancelling, setCancelling] = useState(null); // { bookingId, quote }
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState(null); // booking object
  const [rating, setRating] = useState(0);

  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');

  const load = async () => {
    try {
      const res = await axios.get('/api/bookings/mine');
      setBookings(res.data.bookings);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const release = async (id) => {
    if (!window.confirm('Release this hold?')) return;
    try {
      await axios.delete(`/api/bookings/${id}`);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not release hold');
    }
  };

  const pay = async (booking) => {
    setPaying(booking._id);
    setError(null);

    try {
      const { data: order } = await axios.post('/api/payments/order', { bookingId: booking._id });

      // No Razorpay keys configured — settle through the local mock gateway instead
      if (order.mock) {
        await axios.post('/api/payments/mock-confirm', { bookingId: booking._id });
        await load();
        return;
      }

      const ready = await loadRazorpayCheckout();
      if (!ready) throw new Error('Could not reach Razorpay. Check your connection.');

      await new Promise((resolve) => {
        const rzp = new window.Razorpay({
          key: order.keyId,
          amount: order.amountPaise,
          currency: order.currency,
          order_id: order.orderId,
          name: 'Jharkhand Tourism',
          description: booking.listing?.title,
          prefill: { name: user?.name, email: user?.email },
          theme: { color: '#15803d' },
          handler: async (response) => {
            try {
              await axios.post('/api/payments/verify', response);
            } catch (err) {
              // The webhook is the source of truth, so a failed browser callback is
              // not necessarily a failed payment — reload and show the real status.
              setError(err.response?.data?.message || 'Payment is being confirmed…');
            }
            await load();
            resolve();
          },
          modal: { ondismiss: () => resolve() },
        });

        rzp.on('payment.failed', (resp) => {
          setError(resp.error?.description || 'Payment failed');
          resolve();
        });

        rzp.open();
      });

      await load();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not start payment');
      load();
    } finally {
      setPaying(null);
    }
  };

  const downloadVoucher = async (booking) => {
    try {
      const res = await axios.get(`/api/bookings/${booking._id}/voucher`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `voucher-${booking.bookingRef || booking._id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Could not download the voucher');
    }
  };

  // Fetch what the refund would actually be, then show it before asking to confirm.
  // A browser confirm() could not tell them how much money they would get back.
  const startCancel = async (booking) => {
    setError(null);
    try {
      const { data } = await axios.get(`/api/bookings/${booking._id}/cancellation-quote`);
      setCancelling({ bookingId: booking._id, quote: data });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not work out your refund');
    }
  };

  const confirmCancel = async () => {
    setBusy(true);
    try {
      await axios.post(`/api/bookings/${cancelling.bookingId}/cancel`);
      setCancelling(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not cancel this booking');
    } finally {
      setBusy(false);
    }
  };

  const describe = (b) => {
    if (b.category === 'artisan') return `${b.units} item${b.units > 1 ? 's' : ''}`;
    if (b.category === 'guide') return fmtDay(b.checkIn);
    return `${fmtDay(b.checkIn)} → ${fmtDay(b.checkOut)} · ${b.units} room${b.units > 1 ? 's' : ''}`;
  };

  const openReview = (b) => { setReviewing(b); setRating(0); setError(null); };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!rating) { setError('Pick a rating first'); return; }

    setBusy(true);
    try {
      await axios.post('/api/reviews', {
        bookingId: reviewing._id,
        rating,
        comment: e.target.comment.value,
      });
      setReviewing(null);
      // An alert() box interrupted the page and said nothing the page could not
      // show itself; the list now just updates with the rating in place.
      setNotice('Thanks — your review is live on the listing.');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not submit review');
    } finally {
      setBusy(false);
    }
  };

  // --- Derived views -------------------------------------------------------
  const stats = useMemo(() => {
    const paid = bookings.filter(b => ['confirmed', 'completed'].includes(b.status));
    return {
      upcoming: bookings.filter(b => b.status === 'confirmed').length,
      awaiting: bookings.filter(b => b.status === 'pending_payment').length,
      completed: bookings.filter(b => b.status === 'completed').length,
      cancelled: bookings.filter(b => ['cancelled', 'rejected', 'expired', 'no_show'].includes(b.status)).length,
      paidPaise: paid.reduce((s, b) => s + (b.amountPaise || 0) - (b.refundedPaise || 0), 0),
      refundedPaise: bookings.reduce((s, b) => s + (b.refundedPaise || 0), 0),
      toReview: bookings.filter(b => b.status === 'completed' && !b.hasReview).length,
    };
  }, [bookings]);

  const counts = useMemo(() => {
    const c = { all: bookings.length, action: 0, upcoming: 0, completed: 0, cancelled: 0 };
    for (const b of bookings) c[bucketOf(b)] += 1;
    return c;
  }, [bookings]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bookings.filter(b => {
      if (tab !== 'all' && bucketOf(b) !== tab) return false;
      if (!q) return true;
      return [b.listing?.title, b.listing?.district, b.bookingRef, b.category]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(q));
    });
  }, [bookings, tab, query]);

  const nextTrip = useMemo(() => {
    const now = Date.now();
    return bookings
      .filter(b => b.status === 'confirmed' && b.checkIn && new Date(b.checkIn) >= now)
      .sort((a, b) => new Date(a.checkIn) - new Date(b.checkIn))[0] || null;
  }, [bookings]);

  const toReview = useMemo(
    () => bookings.filter(b => b.status === 'completed' && !b.hasReview).slice(0, 4),
    [bookings]
  );

  return (
    <TouristLayout fluid>
      <div className="page-fluid">
        <div className="section-head" style={{ marginBottom: '1.5rem' }}>
          <div>
            <h1 className="page-title" style={{ marginBottom: '0.35rem' }}>My bookings</h1>
            <p className="page-sub" style={{ margin: 0 }}>Your holds, confirmations and past trips.</p>
          </div>
          <Link to="/explore" className="btn btn-primary">Book something new</Link>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: '1.25rem' }}>{error}</div>}
        {notice && (
          <div className="alert alert-success" style={{ marginBottom: '1.25rem' }}>
            <CheckCircle2 size={16} /> {notice}
          </div>
        )}

        {loading ? (
          <div className="muted">Loading bookings…</div>
        ) : bookings.length === 0 ? (
          <div className="empty">
            <h3>No bookings yet</h3>
            <p className="muted" style={{ marginBottom: '1.25rem' }}>Find a homestay, guide or craft to get started.</p>
            <Link to="/explore" className="btn btn-primary">Explore Jharkhand</Link>
          </div>
        ) : (
          <>
            <div className="kpi-row kpi-row--six">
              <Kpi label="Upcoming" value={stats.upcoming} icon={<CalendarCheck size={16} />}
                foot="Paid and confirmed" />
              <Kpi label="Awaiting payment" value={stats.awaiting} icon={<Clock size={16} />}
                foot={stats.awaiting ? 'Holds expire in minutes' : 'Nothing on hold'} />
              <Kpi label="Completed" value={stats.completed} icon={<CheckCircle2 size={16} />}
                foot="Trips you have taken" />
              <Kpi label="Total paid" value={short(stats.paidPaise)} icon={<Wallet size={16} />}
                foot="Net of refunds" />
              <Kpi label="Refunded" value={short(stats.refundedPaise)} icon={<RotateCcw size={16} />}
                foot="Back to your account" />
              <Kpi label="To review" value={stats.toReview} icon={<PenLine size={16} />}
                foot={stats.toReview ? 'Help other travellers' : 'All reviewed'} />
            </div>

            <div className="bento-grid">
              {/* ---- The list ---- */}
              <div className="bento-span-8" style={{ minWidth: 0 }}>
                <div className="row-between" style={{ gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <div className="row-wrap" style={{ gap: '0.35rem' }}>
                    {TABS.map(t => (
                      <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`chip ${tab === t.key ? 'is-active' : ''}`}
                        style={{
                          cursor: 'pointer',
                          background: tab === t.key ? 'var(--accent)' : undefined,
                          color: tab === t.key ? 'white' : undefined,
                          borderColor: tab === t.key ? 'var(--accent)' : undefined,
                        }}
                      >
                        {t.label} <span style={{ opacity: 0.75 }}>{counts[t.key]}</span>
                      </button>
                    ))}
                  </div>

                  <div className="row" style={{ gap: '0.35rem', alignItems: 'center' }}>
                    <Search size={14} style={{ color: 'var(--text-faint)' }} />
                    <input
                      className="input"
                      style={{ width: '200px' }}
                      placeholder="Search title, ref, district"
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                    />
                  </div>
                </div>

                {visible.length === 0 ? (
                  <div className="bento-card center" style={{ padding: '2.5rem 1.5rem' }}>
                    <XCircle size={26} style={{ color: 'var(--text-faint)' }} />
                    <p className="small muted" style={{ marginTop: '0.6rem' }}>
                      Nothing matches this filter.
                    </p>
                  </div>
                ) : (
                  <div className="stack">
                    {visible.map(b => {
                      const s = STATUS[b.status] || { label: b.status, cls: 'badge-neutral' };
                      const isHold = b.status === 'pending_payment' && new Date(b.holdExpiresAt) > Date.now();

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
                              <div className="strong">
                                <Link to={`/explore/${b.listing?._id}`} className="link-quiet">
                                  {b.listing?.title || 'Listing removed'}
                                </Link>
                              </div>
                              <div className="small" style={{ marginTop: '0.15rem' }}>
                                {describe(b)}
                              </div>
                              <div className="row small muted" style={{ gap: '0.3rem', marginTop: '0.3rem' }}>
                                <MapPin size={13} /> {b.listing?.district} · {b.category}
                              </div>
                              {b.bookingRef && <div className="tiny faint" style={{ marginTop: '0.25rem' }}>Ref {b.bookingRef}</div>}
                            </div>

                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <span className={`badge ${s.cls}`}>{s.label}</span>
                              <div className="price" style={{ fontSize: '1.1rem', marginTop: '0.5rem' }}>{rupees(b.amountPaise)}</div>
                              {b.refundedPaise > 0 && (
                                <div className="tiny" style={{ color: 'var(--accent)' }}>{rupees(b.refundedPaise)} refunded</div>
                              )}
                            </div>
                          </div>

                          {isHold && (
                            <div className="booking-foot">
                              <span className="row small" style={{ gap: '0.35rem', color: 'var(--warning)' }}>
                                <Clock size={14} /> <Countdown expiresAt={b.holdExpiresAt} onLapse={load} />
                              </span>
                              <div className="row" style={{ gap: '0.5rem' }}>
                                <button className="btn btn-danger-ghost btn-sm" onClick={() => release(b._id)}>Release</button>
                                <button className="btn btn-primary btn-sm" onClick={() => pay(b)} disabled={paying === b._id}>
                                  <CreditCard size={14} /> {paying === b._id ? 'Opening…' : 'Pay now'}
                                </button>
                              </div>
                            </div>
                          )}

                          {b.status === 'confirmed' && (
                            <>
                              <div className="booking-foot">
                                <span className="small muted">
                                  Paid {b.paidAt ? fmtDay(b.paidAt) : ''}
                                  {b.checkIn && new Date(b.checkIn) >= Date.now() && (
                                    <> · starts in {Math.max(0, Math.ceil((new Date(b.checkIn) - Date.now()) / DAY_MS))} days</>
                                  )}
                                </span>
                                <div className="row" style={{ gap: '0.5rem' }}>
                                  <button className="btn btn-danger-ghost btn-sm" onClick={() => startCancel(b)}>
                                    Cancel booking
                                  </button>
                                  <button className="btn btn-secondary btn-sm" onClick={() => downloadVoucher(b)}>
                                    <Download size={14} /> E-voucher
                                  </button>
                                </div>
                              </div>

                              {cancelling?.bookingId === b._id && (
                                <div className="confirm-panel">
                                  <div className="row" style={{ gap: '0.5rem', marginBottom: '0.6rem' }}>
                                    <AlertTriangle size={16} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                                    <strong>Cancel this booking?</strong>
                                  </div>

                                  <div className="row-between small" style={{ padding: '0.3rem 0' }}>
                                    <span className="muted">You paid</span>
                                    <span>{rupees(cancelling.quote.amountPaise)}</span>
                                  </div>
                                  <div className="row-between small" style={{ padding: '0.3rem 0' }}>
                                    <span className="muted">{cancelling.quote.band}</span>
                                    <span>{cancelling.quote.refundPercent}% refund</span>
                                  </div>
                                  <div className="row-between" style={{ padding: '0.5rem 0 0.85rem', borderTop: '1px solid var(--border)', marginTop: '0.4rem' }}>
                                    <span className="strong">You get back</span>
                                    <span className="strong" style={{ color: cancelling.quote.refundPaise > 0 ? 'var(--accent)' : 'var(--danger)' }}>
                                      {rupees(cancelling.quote.refundPaise)}
                                    </span>
                                  </div>

                                  {cancelling.quote.refundPaise === 0 && (
                                    <p className="tiny muted" style={{ marginBottom: '0.85rem' }}>
                                      You are inside the no-refund window, so cancelling returns nothing.
                                    </p>
                                  )}

                                  <div className="row" style={{ gap: '0.5rem' }}>
                                    <button className="btn btn-secondary btn-sm grow" onClick={() => setCancelling(null)} disabled={busy}>
                                      Keep booking
                                    </button>
                                    <button className="btn btn-primary btn-sm grow" onClick={confirmCancel} disabled={busy}>
                                      {busy ? 'Cancelling…' : 'Confirm cancellation'}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </>
                          )}

                          {['cancelled', 'rejected'].includes(b.status) && b.refundedPaise > 0 && (
                            <div className="booking-foot">
                              <span className="small muted">
                                {b.status === 'rejected' ? 'Cancelled by the operator' : 'Cancelled'}
                                {b.cancellationReason ? ` — ${b.cancellationReason}` : ''}
                              </span>
                              <span className="small strong" style={{ color: 'var(--accent)' }}>
                                {rupees(b.refundedPaise)} refunded
                              </span>
                            </div>
                          )}

                          {b.status === 'no_show' && (
                            <div className="booking-foot">
                              <span className="small muted">Recorded as a no-show by the operator. No refund was due.</span>
                            </div>
                          )}

                          {b.status === 'expired' && (
                            <div className="booking-foot">
                              <span className="small muted">The hold lapsed before payment.</span>
                              <Link to={`/explore/${b.listing?._id}`} className="btn btn-secondary btn-sm">Try again</Link>
                            </div>
                          )}

                          {b.status === 'completed' && (
                            <div className="booking-foot">
                              {b.hasReview ? (
                                <>
                                  <span className="small muted">Stay completed.</span>
                                  <span className="row small strong" style={{ gap: '0.25rem' }}>
                                    <Star size={14} color="#f59e0b" fill="#f59e0b" /> You rated {b.myReviewRating}/5
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="small muted">Stay completed. How was it?</span>
                                  <button className="btn btn-secondary btn-sm" onClick={() => openReview(b)}>
                                    <PenLine size={14} /> Leave a review
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ---- Side rail ---- */}
              <div className="bento-span-4" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 0 }}>
                {nextTrip && (
                  <div className="bento-card" style={{ padding: '1.5rem' }}>
                    <div className="spec-label" style={{ marginBottom: '0.75rem' }}>Your next trip</div>
                    <div className="kpi-value">
                      {Math.max(0, Math.ceil((new Date(nextTrip.checkIn) - Date.now()) / DAY_MS))}
                      <span className="tiny muted" style={{ marginLeft: '0.35rem' }}>days to go</span>
                    </div>
                    <div className="strong ellipsis" style={{ marginTop: '0.6rem' }}>{nextTrip.listing?.title}</div>
                    <div className="tiny muted">{nextTrip.listing?.district} · {fmtDay(nextTrip.checkIn)}</div>
                    <button className="btn btn-secondary btn-sm" style={{ marginTop: '1rem', width: '100%' }}
                      onClick={() => downloadVoucher(nextTrip)}>
                      <Download size={14} /> Download e-voucher
                    </button>
                  </div>
                )}

                <div className="bento-card" style={{ padding: '1.5rem' }}>
                  <div className="spec-label" style={{ marginBottom: '0.9rem' }}>Money</div>
                  <div className="row-between small" style={{ padding: '0.35rem 0' }}>
                    <span className="muted">Paid, net of refunds</span>
                    <span className="strong">{rupees(stats.paidPaise)}</span>
                  </div>
                  <div className="row-between small" style={{ padding: '0.35rem 0' }}>
                    <span className="muted">Refunded to you</span>
                    <span className="strong" style={{ color: 'var(--accent)' }}>{rupees(stats.refundedPaise)}</span>
                  </div>
                  <div className="row-between small" style={{ padding: '0.35rem 0', borderTop: '1px solid var(--border)', marginTop: '0.35rem' }}>
                    <span className="muted">On hold, unpaid</span>
                    <span className="strong">
                      {rupees(bookings.filter(b => b.status === 'pending_payment')
                        .reduce((s, b) => s + (b.amountPaise || 0), 0))}
                    </span>
                  </div>
                  <p className="tiny muted" style={{ marginTop: '0.85rem', marginBottom: 0 }}>
                    Refund amounts follow the cancellation window shown before you confirm.
                  </p>
                </div>

                {toReview.length > 0 && (
                  <div className="bento-card" style={{ padding: '1.5rem' }}>
                    <div className="spec-label" style={{ marginBottom: '0.9rem' }}>Ready to review</div>
                    <div className="stack-sm">
                      {toReview.map(b => (
                        <button key={b._id} onClick={() => openReview(b)} className="todo-row"
                          style={{ width: '100%', textAlign: 'left', cursor: 'pointer', background: 'none' }}>
                          <span className="todo-icon"><PenLine size={14} /></span>
                          <span className="small ellipsis" style={{ flex: 1 }}>{b.listing?.title}</span>
                          <ArrowRight size={13} style={{ color: 'var(--text-faint)' }} />
                        </button>
                      ))}
                    </div>
                    <p className="tiny muted" style={{ marginTop: '0.85rem', marginBottom: 0 }}>
                      Only travellers who completed a stay can review it — that is what keeps the ratings honest.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {reviewing && (
          <div className="modal-overlay" onClick={() => !busy && setReviewing(null)}>
            {/* The old dialog used a `modal-content` class that does not exist in
                the stylesheet, so it rendered unstyled on top of the page. */}
            <div className="modal" style={{ maxWidth: '460px' }} onClick={e => e.stopPropagation()}>
              <form onSubmit={handleReviewSubmit}>
                <div className="modal-head">
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ margin: 0 }}>Review {reviewing.listing?.title}</h3>
                    <p className="small muted" style={{ margin: '0.2rem 0 0' }}>
                      {reviewing.listing?.district} · {describe(reviewing)}
                    </p>
                  </div>
                </div>

                <div className="modal-body">
                  {/* The page-level banner sits behind the overlay, so a failed
                      submission has to report itself inside the dialog. */}
                  {error && (
                    <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                      <AlertTriangle size={16} /> {error}
                    </div>
                  )}

                  <label className="label">Your rating</label>
                  <StarPicker value={rating} onChange={setRating} />

                  <label className="label" style={{ marginTop: '1.25rem' }}>Comment</label>
                  <textarea name="comment" className="textarea" rows="4" required
                    placeholder="What stood out? Food, hosts, the room, getting there…" />
                </div>

                <div className="modal-foot">
                  <div className="row" style={{ gap: '0.75rem', justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setReviewing(null)} disabled={busy}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={busy || !rating}>
                      {busy ? 'Submitting…' : 'Submit review'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </TouristLayout>
  );
};

export default MyBookings;
