import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { LogIn, LogOut, Users, Lock, Phone } from 'lucide-react';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const RANGES = [7, 14, 30];

const parse = (iso) => new Date(`${iso}T00:00:00Z`);

/**
 * The operating view of a homestay.
 *
 * The bookings list answers "what have I sold"; this answers the question an owner
 * actually asks every morning — who is arriving today, who is leaving, and how many
 * rooms are free tonight. Same records, completely different shape.
 */
const BookingTimeline = () => {
  const [days, setDays] = useState(14);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/operator/timeline', { params: { days } });
      setData(res.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load your timeline');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="muted" style={{ padding: '2rem 0' }}>Loading timeline…</div>;
  if (error) return <div className="alert alert-error">{error}</div>;

  const todayKey = new Date().toISOString().slice(0, 10);

  const Guest = ({ entry, kind }) => (
    <div className="tl-guest">
      <span className={`tl-dot tl-dot--${kind}`} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="small strong ellipsis">{entry.guestName}</div>
        <div className="tiny muted ellipsis">
          {entry.listingTitle} · {entry.units} room{entry.units > 1 ? 's' : ''}
          {entry.nights ? ` · ${entry.nights} night${entry.nights > 1 ? 's' : ''}` : ''}
        </div>
      </div>
      {kind === 'in' && entry.guestPhone && (
        <a className="tiny link-quiet" href={`tel:${entry.guestPhone}`} title={entry.guestPhone}>
          <Phone size={12} />
        </a>
      )}
    </div>
  );

  return (
    <div>
      <div className="row-between" style={{ marginBottom: '1.1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <span className="small muted">
          {data.capacity} rooms across your listings. Arrivals, departures and who is in the house.
        </span>
        <div className="tabs">
          {RANGES.map(n => (
            <button key={n} className={`tab ${days === n ? 'tab--on' : ''}`} onClick={() => setDays(n)}>
              {n} days
            </button>
          ))}
        </div>
      </div>

      <div className="tl">
        {data.timeline.map(day => {
          const date = parse(day.date);
          const quiet = day.arrivals.length === 0 && day.departures.length === 0 && day.staying.length === 0;
          const fill = day.capacity ? Math.round((day.occupied / day.capacity) * 100) : 0;

          return (
            <div key={day.date} className={`tl-day ${day.date === todayKey ? 'tl-day--today' : ''} ${quiet ? 'tl-day--quiet' : ''}`}>
              <div className="tl-date">
                <span className="tl-dow">{WEEKDAYS[date.getUTCDay()]}</span>
                <span className="tl-num">{date.getUTCDate()}</span>
                <span className="tl-mon">{MONTHS[date.getUTCMonth()]}</span>
                {day.date === todayKey && <span className="tl-today">Today</span>}
              </div>

              <div className="tl-body">
                <div className="row-between" style={{ marginBottom: quiet ? 0 : '0.7rem', gap: '1rem' }}>
                  <div className="row" style={{ gap: '0.85rem', flexWrap: 'wrap' }}>
                    {day.arrivals.length > 0 && (
                      <span className="tl-stat tl-stat--in"><LogIn size={13} /> {day.arrivals.length} in</span>
                    )}
                    {day.departures.length > 0 && (
                      <span className="tl-stat tl-stat--out"><LogOut size={13} /> {day.departures.length} out</span>
                    )}
                    {day.staying.length > 0 && (
                      <span className="tl-stat"><Users size={13} /> {day.staying.length} staying</span>
                    )}
                    {day.closed.length > 0 && (
                      <span className="tl-stat tl-stat--closed"><Lock size={13} /> {day.closed.length} closed</span>
                    )}
                    {quiet && <span className="tiny faint">Nothing scheduled</span>}
                  </div>

                  <div className="row" style={{ gap: '0.5rem', flexShrink: 0 }}>
                    <div className="meter" style={{ width: 70, margin: 0 }}>
                      <div className="meter-fill" style={{ width: `${fill}%` }} />
                    </div>
                    <span className="tiny muted" style={{ whiteSpace: 'nowrap' }}>
                      {day.free} of {day.capacity} free
                    </span>
                  </div>
                </div>

                {!quiet && (
                  <div className="tl-groups">
                    {day.arrivals.length > 0 && (
                      <div>
                        <div className="tiny faint tl-label">Arriving</div>
                        {day.arrivals.map(a => <Guest key={`in-${a.id}`} entry={a} kind="in" />)}
                      </div>
                    )}
                    {day.departures.length > 0 && (
                      <div>
                        <div className="tiny faint tl-label">Leaving</div>
                        {day.departures.map(d => <Guest key={`out-${d.id}`} entry={d} kind="out" />)}
                      </div>
                    )}
                    {day.closed.length > 0 && (
                      <div>
                        <div className="tiny faint tl-label">Closed</div>
                        {day.closed.map(c => (
                          <div key={c.id} className="tl-guest">
                            <span className="tl-dot tl-dot--closed" />
                            <div className="small ellipsis">{c.listingTitle}{c.reason ? ` — ${c.reason}` : ''}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BookingTimeline;
