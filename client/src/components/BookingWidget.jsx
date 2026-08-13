import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AvailabilityCalendar, { monthRange } from './AvailabilityCalendar';

const rupees = (paise) => `₹${(paise / 100).toLocaleString('en-IN')}`;

const UNIT = { homestay: '/ night', guide: '/ day', artisan: '/ item' };

const BookingWidget = ({ listing }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const today = new Date();
  const [year, setYear] = useState(today.getUTCFullYear());
  const [month, setMonth] = useState(today.getUTCMonth());
  const [days, setDays] = useState([]);

  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);
  const [units, setUnits] = useState(1);

  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);
  const [holding, setHolding] = useState(false);

  const isArtisan = listing.category === 'artisan';
  const isGuide = listing.category === 'guide';

  const loadCalendar = useCallback(async () => {
    if (isArtisan) return;
    try {
      const res = await axios.get(`/api/bookings/calendar/${listing._id}`, { params: monthRange(year, month) });
      setDays(res.data.days || []);
    } catch {
      setDays([]);
    }
  }, [listing._id, year, month, isArtisan]);

  useEffect(() => { loadCalendar(); }, [loadCalendar]);

  // Clicking builds a half-open range: first click sets check-in, second sets
  // check-out. Clicking on or before the current start restarts the selection.
  const handleDayClick = (key) => {
    setResult(null);
    if (isGuide) { setStart(key); setEnd(null); return; }
    if (!start || end || key <= start) { setStart(key); setEnd(null); return; }
    setEnd(key);
  };

  const payload = () => (
    isArtisan
      ? { listingId: listing._id, units: Number(units) }
      : isGuide
        ? { listingId: listing._id, date: start, units: 1 }
        : { listingId: listing._id, checkIn: start, checkOut: end, units: Number(units) }
  );

  const ready = isArtisan ? Number(units) > 0 : isGuide ? Boolean(start) : Boolean(start && end);

  const check = async () => {
    setChecking(true);
    setResult(null);
    try {
      const res = await axios.post('/api/bookings/check', payload());
      setResult(res.data);
    } catch (err) {
      setResult({ available: false, reason: err.response?.data?.message || 'Could not check availability' });
    } finally {
      setChecking(false);
    }
  };

  const reserve = async () => {
    if (!user) return navigate('/login');
    if (user.role !== 'tourist') {
      setResult({ available: false, reason: 'Only tourist accounts can make bookings' });
      return;
    }

    setHolding(true);
    try {
      await axios.post('/api/bookings/hold', payload());
      navigate('/bookings');
    } catch (err) {
      setResult({ available: false, reason: err.response?.data?.message || 'Could not reserve' });
      loadCalendar();
    } finally {
      setHolding(false);
    }
  };

  return (
    <div className="card stack">
      <div>
        <span className="price">₹{listing.price.toLocaleString('en-IN')}</span>
        <span className="price-unit"> {UNIT[listing.category]}</span>
      </div>

      {isArtisan ? (
        <div className="field">
          <label className="label" htmlFor="qty">Quantity</label>
          <input id="qty" className="input" type="number" min="1" value={units}
            onChange={(e) => { setUnits(e.target.value); setResult(null); }} />
          <span className="hint">{listing.stockQuantity} in stock</span>
        </div>
      ) : (
        <>
          <AvailabilityCalendar
            year={year} month={month} days={days}
            onMonthChange={(y, m) => { setYear(y); setMonth(m); }}
            onDayClick={handleDayClick}
            selectedStart={start}
            selectedEnd={isGuide && start ? start : end}
          />

          <div className="date-summary">
            <div className="date-box">
              <div className="spec-label">{isGuide ? 'Date' : 'Check-in'}</div>
              <div className="small">{start || '—'}</div>
            </div>
            {!isGuide && (
              <div className="date-box">
                <div className="spec-label">Check-out</div>
                <div className="small">{end || '—'}</div>
              </div>
            )}
          </div>

          {listing.category === 'homestay' && listing.rooms > 1 && (
            <div className="field">
              <label className="label" htmlFor="rooms">Rooms</label>
              <input id="rooms" className="input" type="number" min="1" max={listing.rooms} value={units}
                onChange={(e) => { setUnits(e.target.value); setResult(null); }} />
            </div>
          )}
        </>
      )}

      <button className="btn btn-secondary btn-block" onClick={check} disabled={!ready || checking}>
        {checking ? 'Checking…' : 'Check availability'}
      </button>

      {result && (
        <div className={`alert ${result.available ? 'alert-success' : 'alert-error'}`}>
          {result.available ? <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            : <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />}
          <div>
            {result.available ? (
              <>
                <div className="strong">Available</div>
                {result.quote && (
                  <div className="small" style={{ color: 'var(--text-muted)' }}>
                    {result.quote.nights
                      ? `${result.quote.nights} night${result.quote.nights > 1 ? 's' : ''} × ${result.quote.units}`
                      : `${result.quote.units} item${result.quote.units > 1 ? 's' : ''}`}
                    {' — '}
                    <span className="strong" style={{ color: 'var(--text)' }}>{rupees(result.quote.amountPaise)}</span>
                  </div>
                )}
              </>
            ) : result.reason}
          </div>
        </div>
      )}

      {/* Cancellation terms are shown BEFORE payment, never discovered afterwards */}
      {result?.available && result.cancellationPolicy?.bands && (
        <div className="policy-box">
          <div className="spec-label" style={{ marginBottom: '0.5rem' }}>Cancellation policy</div>
          {result.cancellationPolicy.bands.map((b, i) => (
            <div className="row-between tiny" key={i} style={{ padding: '0.2rem 0' }}>
              <span className="muted">{b.label}</span>
              <span className="strong">{b.summary}</span>
            </div>
          ))}
        </div>
      )}

      {result?.available && (
        <button className="btn btn-primary btn-block" onClick={reserve} disabled={holding}>
          {holding ? 'Reserving…' : 'Reserve'}
        </button>
      )}

      <p className="tiny faint center">Reserving holds your slot for 10 minutes while you pay.</p>
    </div>
  );
};

export default BookingWidget;
