import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  MapPin, Sparkles, AlertCircle, Sunrise, Sun, Moon, Printer, Copy, Check,
  CalendarDays, Compass, Layers, Wallet, Database,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import TouristLayout from '../../components/TouristLayout';
import DestinationMap from '../../components/DestinationMap';

const SLOTS = [
  { key: 'morning', label: 'Morning', Icon: Sunrise },
  { key: 'afternoon', label: 'Afternoon', Icon: Sun },
  { key: 'evening', label: 'Evening', Icon: Moon },
];

const TYPE_LABELS = {
  waterfall: 'Waterfall', temple: 'Temple', dam: 'Dam', park: 'Park',
  wildlife: 'Wildlife', hill: 'Hill', lake: 'Lake', fort: 'Fort',
  museum: 'Museum', heritage: 'Heritage', city: 'Town',
};

const UNIT = { homestay: 'per night', guide: 'per day', artisan: 'per item' };

const rupees = (n) => `₹${(n || 0).toLocaleString('en-IN')}`;

const Stat = ({ label, value, foot, icon }) => (
  <div className="kpi">
    <div className="row-between" style={{ alignItems: 'flex-start' }}>
      <div className="spec-label">{label}</div>
      <div className="kpi-icon">{icon}</div>
    </div>
    <div className="kpi-value" style={{ margin: '0.35rem 0 0.5rem' }}>{value}</div>
    <span className="tiny muted">{foot}</span>
  </div>
);

const ItineraryPlanner = () => {
  const { user } = useAuth();
  // "" means anywhere in Jharkhand. The list is loaded from the data rather
  // than hardcoded, so every option has real destinations behind it.
  const [districts, setDistricts] = useState([]);
  const [district, setDistrict] = useState('');
  const [duration, setDuration] = useState('3');
  const [interests, setInterests] = useState('nature, tribal culture, food');

  const [itinerary, setItinerary] = useState(null);
  const [tier, setTier] = useState(null);
  const [area, setArea] = useState('');
  const [grounding, setGrounding] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    axios.get('/api/public/destinations/facets')
      .then(res => setDistricts(res.data.allDistricts || []))
      .catch(() => setDistricts([]));
  }, []);

  const generateItinerary = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setItinerary(null);
    setTier(null);

    try {
      const res = await axios.post('/api/ai/itinerary', { district, duration, interests });
      setItinerary(res.data.itinerary);
      setTier(res.data.tier);
      setArea(res.data.area);
      setGrounding(res.data.grounding);
    } catch (err) {
      setError('Failed to generate itinerary. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // --- Derived trip facts. All of it comes from the plan the API already
  // returned; nothing here asks the model for anything extra.
  const trip = useMemo(() => {
    if (!itinerary) return null;

    const places = [];
    const seen = new Set();
    for (const day of itinerary) {
      for (const d of day.destinations || []) {
        if (!seen.has(d.slug)) { seen.add(d.slug); places.push(d); }
      }
    }

    const districtsCovered = [...new Set(places.map(p => p.district).filter(Boolean))];

    // Deliberately per-day, not per-unique-listing: a homestay recommended on
    // three days is three nights of cost, which is what a traveller budgets for.
    const nights = itinerary.filter(d => d.suggestedListing).length;
    const estimate = itinerary.reduce((sum, d) => sum + (d.suggestedListing?.price || 0), 0);

    return { places, districtsCovered, nights, estimate };
  }, [itinerary]);

  const asText = () => {
    if (!itinerary) return '';
    const lines = [`Trip to ${area || 'Jharkhand'} — ${itinerary.length} days`, ''];
    for (const day of itinerary) {
      lines.push(`Day ${day.day}${day.title ? ` — ${day.title}` : ''}`);
      for (const { key, label } of SLOTS) if (day[key]) lines.push(`  ${label}: ${day[key]}`);
      if (day.destinations?.length) lines.push(`  Places: ${day.destinations.map(d => d.name).join(', ')}`);
      if (day.suggestedListing) {
        lines.push(`  Booking: ${day.suggestedListing.title} — ${rupees(day.suggestedListing.price)}`);
      }
      lines.push('');
    }
    return lines.join('\n');
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(asText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy to the clipboard');
    }
  };

  const TierBadge = () => {
    if (!tier) return null;
    const tone = tier === 'Rules' ? 'badge-warning' : 'badge-success';
    return (
      <span className={`badge ${tone}`}>
        <Sparkles size={12} style={{ marginRight: '4px' }} />
        {tier === 'Rules' ? 'Built from our data' : `Powered by ${tier}`}
      </span>
    );
  };

  const content = (
    <div className="page-fluid">
      <div className="section-head" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: '0.35rem' }}>AI itinerary planner</h1>
          <p className="page-sub" style={{ margin: 0 }}>
            A day-by-day trip built only from real places and verified operators — never invented.
          </p>
        </div>
      </div>

      <form onSubmit={generateItinerary} className="bento-card no-print" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div className="filter-bar" style={{ margin: 0 }}>
          <select className="select" value={district} onChange={(e) => setDistrict(e.target.value)}>
            <option value="">Anywhere in Jharkhand</option>
            {districts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>

          <input
            className="input" type="number" min="1" max="7" value={duration}
            onChange={(e) => setDuration(e.target.value)} placeholder="Days"
          />

          <input
            className="input" placeholder="waterfalls, tribal art, spicy food…"
            value={interests} onChange={(e) => setInterests(e.target.value)}
          />

          <button type="submit" className="btn btn-primary" disabled={loading}>
            <Sparkles size={16} /> {loading ? 'Building…' : 'Generate'}
          </button>
        </div>
      </form>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading && (
        <div className="bento-card center" style={{ padding: '3rem 1.5rem' }}>
          <Sparkles className="spin" size={30} style={{ color: 'var(--accent)' }} />
          <p className="small muted" style={{ marginTop: '0.75rem' }}>
            Reading our destinations and listings, then writing your plan.
          </p>
          <p className="tiny faint">On the offline model this takes a few seconds per day.</p>
        </div>
      )}

      {itinerary && !loading && trip && (
        <>
          <div className="section-head" style={{ marginBottom: '1rem' }}>
            <div>
              <h2 style={{ margin: 0 }}>Your trip to {area || 'Jharkhand'}</h2>
              {grounding && (
                <p className="small muted" style={{ margin: '0.25rem 0 0' }}>
                  Planned from {grounding.destinations} real destinations and {grounding.listings} verified listings.
                </p>
              )}
            </div>
            <div className="row no-print" style={{ gap: '0.5rem', alignItems: 'center' }}>
              <TierBadge />
              <button className="btn btn-secondary btn-sm" onClick={copy}>
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>
                <Printer size={14} /> Print
              </button>
            </div>
          </div>

          {tier === 'Rules' && (
            <div className="alert alert-warning" style={{ marginBottom: '1.25rem' }}>
              <AlertCircle size={16} /> Both AI models were unreachable, so this plan was
              assembled directly from our destination data. The places are real; the wording is templated.
            </div>
          )}

          <div className="kpi-row">
            <Stat label="Length" value={`${itinerary.length} days`} icon={<CalendarDays size={16} />}
              foot={`${SLOTS.length * itinerary.length} planned slots`} />
            <Stat label="Places" value={trip.places.length} icon={<Compass size={16} />}
              foot="All from our own database" />
            <Stat label="Districts" value={trip.districtsCovered.length} icon={<Layers size={16} />}
              foot={trip.districtsCovered.slice(0, 3).join(', ') || '—'} />
            <Stat label="Estimated stay" value={rupees(trip.estimate)} icon={<Wallet size={16} />}
              foot={trip.nights ? `${trip.nights} recommended booking${trip.nights > 1 ? 's' : ''}` : 'No bookings suggested'} />
          </div>

          <div className="bento-grid">
            {/* ---- The days ---- */}
            <div className="bento-span-8" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 0 }}>
              {itinerary.map((day, idx) => (
                <div key={idx} className="bento-card" style={{ padding: '1.35rem' }}>
                  <div className="itin-day">
                    <div className="itin-rail">
                      <div className="itin-daynum"><span>DAY</span>{day.day}</div>
                      <div className="itin-rail-line" />
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ margin: '0 0 0.6rem' }}>{day.title || `Day ${day.day}`}</h3>

                      {SLOTS.map(({ key, label, Icon }) => (
                        day[key] ? (
                          <div key={key} className="itin-slot">
                            <div className="itin-slot-icon"><Icon size={16} /></div>
                            <div style={{ minWidth: 0 }}>
                              <div className="itin-slot-when">{label}</div>
                              <div className="small" style={{ marginTop: '0.15rem' }}>{day[key]}</div>
                            </div>
                          </div>
                        ) : null
                      ))}

                      {day.destinations?.length > 0 && (
                        <div style={{ marginTop: '1rem' }}>
                          <div className="tiny faint" style={{ marginBottom: '0.4rem' }}>
                            Places on this day
                          </div>
                          <div className="row-wrap" style={{ gap: '0.4rem' }}>
                            {day.destinations.map(d => (
                              <Link key={d.slug} to={`/destinations/${d.slug}`} className="chip" style={{ textDecoration: 'none' }}>
                                <MapPin size={11} style={{ marginRight: '3px' }} />
                                {d.name}
                                {d.type && <span className="faint"> · {TYPE_LABELS[d.type] || d.type}</span>}
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}

                      {day.suggestedListing && (
                        <Link
                          to={`/explore/${day.suggestedListing.id}`}
                          className="todo-row"
                          style={{ marginTop: '1rem', textDecoration: 'none', color: 'inherit' }}
                        >
                          <span className="todo-icon"><Sparkles size={14} /></span>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span className="small strong ellipsis" style={{ display: 'block' }}>
                              {day.suggestedListing.title}
                            </span>
                            <span className="tiny muted" style={{ textTransform: 'capitalize' }}>
                              Recommended {day.suggestedListing.category}
                            </span>
                          </span>
                          <span className="small strong">
                            {rupees(day.suggestedListing.price)}
                            <span className="tiny faint"> {UNIT[day.suggestedListing.category] || ''}</span>
                          </span>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ---- Map + the places list ---- */}
            <div className="bento-span-4" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 0 }}>
              {trip.places.length > 0 && (
                <div className="bento-card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '1.1rem 1.25rem 0.75rem' }}>
                    <div className="spec-label">Your route</div>
                    <div className="tiny muted" style={{ marginTop: '0.2rem' }}>
                      Every place in the plan, on one map.
                    </div>
                  </div>
                  <div style={{ height: 300 }}>
                    <DestinationMap items={trip.places} kind="destination" />
                  </div>
                </div>
              )}

              <div className="bento-card" style={{ padding: '1.35rem' }}>
                <div className="spec-label" style={{ marginBottom: '0.75rem' }}>
                  Everywhere you will go
                </div>
                {trip.places.length === 0 ? (
                  <p className="small muted" style={{ margin: 0 }}>No places resolved for this plan.</p>
                ) : (
                  <div className="stack-sm">
                    {trip.places.map(p => (
                      <Link key={p.slug} to={`/destinations/${p.slug}`} className="todo-row"
                        style={{ textDecoration: 'none', color: 'inherit' }}>
                        <span className="todo-icon"><MapPin size={13} /></span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span className="small ellipsis" style={{ display: 'block' }}>{p.name}</span>
                          <span className="tiny faint">{TYPE_LABELS[p.type] || p.type} · {p.district}</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div className="bento-card no-print" style={{ padding: '1.35rem' }}>
                <div className="row" style={{ gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <Database size={14} style={{ color: 'var(--text-faint)' }} />
                  <div className="spec-label" style={{ margin: 0 }}>How this was built</div>
                </div>
                <p className="tiny muted" style={{ margin: 0 }}>
                  The model may only pick from places and listings that exist in our database,
                  and every chip and card above links to the real record. If a model is
                  unreachable the plan falls back to the next tier, so the planner still answers offline.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  return user?.role === 'tourist' ? <TouristLayout fluid>{content}</TouristLayout> : content;
};

export default ItineraryPlanner;
