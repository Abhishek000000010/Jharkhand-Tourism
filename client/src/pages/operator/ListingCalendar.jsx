import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Trash2 } from 'lucide-react';
import AvailabilityCalendar, { monthRange } from '../../components/AvailabilityCalendar';
import OperatorLayout from '../../components/OperatorLayout';
import ClosureConflictModal from '../../components/ClosureConflictModal';
import { fmtDay } from '../../utils/dates';

const ListingCalendar = () => {
  const { id } = useParams();
  const today = new Date();

  const [year, setYear] = useState(today.getUTCFullYear());
  const [month, setMonth] = useState(today.getUTCMonth());
  const [days, setDays] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [category, setCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`/api/operator/listings/${id}/calendar`, { params: monthRange(year, month) });
      setDays(res.data.days || []);
      setBlocks(res.data.blocks || []);
      setCategory(res.data.category);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load calendar');
    } finally {
      setLoading(false);
    }
  }, [id, year, month]);

  useEffect(() => { load(); }, [load]);

  // Clicking fills whichever end of the block form is empty
  const handleDayClick = (key) => {
    if (!from || (from && to)) { setFrom(key); setTo(''); return; }
    if (key > from) setTo(key); else setFrom(key);
  };

  /**
   * Close the selected range.
   *
   * `skipConflicts` is the operator answering "close the free dates only" — the
   * server then blocks the gaps around the bookings instead of refusing outright.
   * A conflict is not an error here: it's a decision the operator has to make, so
   * it opens the modal rather than turning the page red.
   */
  const closeDates = async ({ skipConflicts = false } = {}) => {
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const res = await axios.post(`/api/operator/listings/${id}/blocks`, {
        startDate: from,
        endDate: to || undefined,
        reason,
        skipConflicts,
      });

      const skipped = res.data.skipped || [];
      if (skipped.length) {
        setNotice(
          `Closed the free dates. ${skipped.map(fmtDay).join(', ')} stayed open — ` +
          `${skipped.length > 1 ? 'those dates are' : 'that date is'} booked.`
        );
      }

      setConflict(null);
      setFrom(''); setTo(''); setReason('');
      await load();
      return true;
    } catch (err) {
      const data = err.response?.data;

      if (data?.code === 'BOOKING_CONFLICT') {
        setConflict(data);
        return false;
      }

      setConflict(null);
      setError(data?.message || 'Could not close those dates');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const submitBlock = (e) => {
    e.preventDefault();
    closeDates();
  };

  const removeBlock = async (blockId) => {
    try {
      await axios.delete(`/api/operator/blocks/${blockId}`);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reopen those dates');
    }
  };

  if (loading) return <div className="loading">Loading calendar…</div>;

  if (category === 'artisan') {
    return (
      <OperatorLayout>
        <div className="page page--mid">
          <Link to="/operator/listings" className="link-back"><ArrowLeft size={15} /> My listings</Link>
          <div className="empty">
            <h3>Crafts have no calendar</h3>
            <p className="muted">
              Craft listings sell from stock rather than dates. To pause sales, edit the listing and set stock to 0.
            </p>
          </div>
        </div>
      </OperatorLayout>
    );
  }

  return (
    <OperatorLayout>
      <div className="page">
        <div style={{ marginBottom: '2.5rem' }}>
          <Link to="/operator/listings" className="btn btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', padding: '0.5rem 0', marginBottom: '1rem', fontWeight: 500 }}>
            <ArrowLeft size={16} /> Back to Listings
          </Link>
          <h1 className="page-title" style={{ fontSize: '2.4rem', letterSpacing: '-0.02em', color: 'var(--text-strong)', marginBottom: '0.5rem' }}>Availability Calendar</h1>
          <p className="page-sub" style={{ fontSize: '1.15rem', color: 'var(--text-muted)', maxWidth: '600px' }}>
            Manage your booking calendar, see reservations, and seamlessly block out dates when you aren't available.
          </p>
        </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>{error}</div>}
      {notice && <div className="alert alert-success" style={{ marginBottom: '1.5rem' }}>{notice}</div>}

      <div className="split" style={{ gap: '2rem', alignItems: 'flex-start' }}>
        <div className="card" style={{ position: 'sticky', top: '2rem', padding: '2rem', background: '#fff', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <AvailabilityCalendar
            year={year} month={month} days={days}
            onMonthChange={(y, m) => { setYear(y); setMonth(m); }}
            onDayClick={handleDayClick}
            selectedStart={from}
            selectedEnd={to}
          />
        </div>

        <div className="stack" style={{ gap: '2rem' }}>
          <div className="card" style={{ background: '#fff', padding: '2rem', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontSize: '1.4rem', marginBottom: '0.5rem', color: 'var(--text-strong)' }}>Close dates</h3>
            <p className="muted" style={{ fontSize: '0.95rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              Click days on the calendar or pick them manually below. Closed dates will prevent new bookings.
            </p>

            <form onSubmit={submitBlock} className="stack">
              <div className="field-row">
                <div className="field">
                  <label className="label" htmlFor="from">From</label>
                  <input id="from" className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} required />
                </div>
                <div className="field">
                  <label className="label" htmlFor="to">Until</label>
                  <input id="to" className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
              </div>
              <span className="hint" style={{ marginTop: '-0.5rem' }}>
                "Until" is the day you reopen. Leave blank to close a single day.
              </span>

              <div className="field">
                <label className="label" htmlFor="reason">Reason (optional)</label>
                <input id="reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)}
                  placeholder="Maintenance, family event…" />
              </div>

              <button type="submit" className="btn btn-primary btn-block" disabled={!from || saving} style={{ marginTop: '1rem', padding: '0.9rem', fontSize: '1.05rem', fontWeight: 600 }}>
                {saving ? 'Closing…' : 'Close these dates'}
              </button>
            </form>
          </div>

          <div className="card" style={{ background: '#fff', padding: '2rem', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontSize: '1.4rem', marginBottom: '1.25rem', color: 'var(--text-strong)' }}>Closed periods</h3>
            {blocks.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px dashed var(--border)' }}>
                <p className="muted" style={{ margin: 0 }}>Nothing closed — your calendar is fully open.</p>
              </div>
            ) : (
              <div className="stack-sm">
                {blocks.map(b => (
                  <div key={b._id} className="row-between hover-lift" style={{
                    padding: '1rem',
                    border: '1px solid var(--border)',
                    borderLeft: '4px solid #ef4444',
                    borderRadius: 'var(--radius)',
                    background: '#fff',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'all 0.2s'
                  }}>
                    <div>
                      <div className="small strong">{b.startDate.slice(0, 10)} → {b.endDate.slice(0, 10)}</div>
                      {b.reason && <div className="tiny muted">{b.reason}</div>}
                    </div>
                    <button className="btn-icon btn-icon--danger" onClick={() => removeBlock(b._id)} title="Reopen these dates">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>

      {conflict && (
        <ClosureConflictModal
          conflict={conflict}
          listingId={id}
          busy={saving}
          onClose={() => setConflict(null)}
          // Rejecting frees the dates, so try the same closure again immediately —
          // the operator should not have to re-enter what they already typed.
          onRejected={() => closeDates()}
          onCloseFreeDates={() => closeDates({ skipConflicts: true })}
        />
      )}
    </OperatorLayout>
  );
};

export default ListingCalendar;
