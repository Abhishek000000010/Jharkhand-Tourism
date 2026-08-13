import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Briefcase, CheckCircle2, MapPin, Star, Wallet, Moon, Compass, ArrowRight,
  CreditCard, CalendarClock, MessageSquare, PenLine, Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUnreadMessages } from '../../hooks/useUnreadMessages';
import SafeImage from '../../components/SafeImage';

// Recharts writes colours straight into SVG, so these must be literals — the
// same reason the operator analytics page keeps its own palette.
const CHART = { line: '#15803d', grid: '#e8e8ea', axis: '#9ca3af' };

const rupees = (paise) => `₹${Math.round((paise || 0) / 100).toLocaleString('en-IN')}`;

const short = (paise) => {
  const value = (paise || 0) / 100;
  if (Math.abs(value) >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (Math.abs(value) >= 1000) return `₹${(value / 1000).toFixed(1)}k`;
  return `₹${Math.round(value)}`;
};

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

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

const ATTENTION_ICON = {
  payment: CreditCard,
  soon: CalendarClock,
  review: PenLine,
  messages: MessageSquare,
};

const CATEGORY_LABEL = { homestay: 'Homestays', guide: 'Guides', artisan: 'Crafts' };

const TouristDashboard = () => {
  const { user } = useAuth();
  const unread = useUnreadMessages();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios.get('/api/tourist/dashboard')
      .then(res => setData(res.data))
      .catch(err => setError(err.response?.data?.message || 'Could not load your dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="muted">Loading your dashboard…</div>;
  if (error || !data) return <div className="alert alert-error">{error || 'Could not load your dashboard'}</div>;

  const { summary, nextTrip, attention, upcomingTrips, series, spendByCategory, districts, recommendations } = data;

  // Unread messages are already served to the header bell, so the count comes
  // from that hook rather than being recomputed on the dashboard endpoint.
  const todos = [
    ...attention,
    ...(unread > 0
      ? [{ key: 'messages', label: `${unread} unread message${unread > 1 ? 's' : ''}`, count: unread, link: '/messages' }]
      : []),
  ];

  const chartData = series.map(s => ({ name: s.label, Spend: Math.round(s.paise / 100) }));
  const hasSpend = series.some(s => s.paise > 0);

  const spendTotal = spendByCategory.reduce((sum, c) => sum + c.paise, 0);
  const explorePercent = summary.districtsTotal
    ? Math.round((summary.districtsVisited / summary.districtsTotal) * 100)
    : 0;

  return (
    <>
      <div className="section-head" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: '0.35rem' }}>
            Hello, {user?.name?.split(' ')[0] || 'traveller'}!
          </h1>
          <p className="page-sub" style={{ margin: 0 }}>Ready for your next adventure in Jharkhand?</p>
        </div>
        <div className="row" style={{ gap: '0.5rem' }}>
          <Link to="/planner" className="btn btn-secondary"><Sparkles size={14} /> Plan a trip</Link>
          <Link to="/explore" className="btn btn-primary">Explore</Link>
        </div>
      </div>

      {nextTrip ? (
        <div className="widget-hero">
          <div style={{ position: 'relative', zIndex: 10 }}>
            <span className="badge badge-success" style={{ background: 'white', color: 'var(--accent)', marginBottom: '1rem', border: 'none' }}>
              {nextTrip.daysUntil === 0 ? 'Starts today' : `In ${nextTrip.daysUntil} day${nextTrip.daysUntil > 1 ? 's' : ''}`}
            </span>
            <h2>{nextTrip.title}</h2>
            <p>
              {nextTrip.district} · {fmtDate(nextTrip.checkIn)}
              {nextTrip.nights > 0 && ` · ${nextTrip.nights} night${nextTrip.nights > 1 ? 's' : ''}`}
              {nextTrip.bookingRef && ` · ${nextTrip.bookingRef}`}
            </p>
            <div className="row" style={{ marginTop: '1.5rem', gap: '0.5rem' }}>
              <Link to="/bookings" className="btn" style={{ background: 'white', color: 'var(--accent)' }}>View booking</Link>
              {nextTrip.listingId && (
                <Link to={`/explore/${nextTrip.listingId}`} className="btn btn-ghost" style={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)' }}>
                  See the listing
                </Link>
              )}
            </div>
          </div>
          {nextTrip.image && <img src={nextTrip.image} alt="" className="widget-hero-image" />}
        </div>
      ) : (
        <div className="widget-hero" style={{ background: 'var(--surface)', color: 'var(--text)' }}>
          <div style={{ position: 'relative', zIndex: 10 }}>
            <h2 style={{ color: 'var(--text)' }}>No upcoming trips</h2>
            <p style={{ color: 'var(--text-muted)' }}>
              Let the AI planner build you a day-by-day itinerary, or browse verified homestays,
              guides and artisans across Jharkhand.
            </p>
            <div className="row" style={{ marginTop: '1.5rem', gap: '0.5rem' }}>
              <Link to="/planner" className="btn btn-primary"><Sparkles size={14} /> Plan my trip</Link>
              <Link to="/explore" className="btn btn-secondary">Explore destinations</Link>
            </div>
          </div>
        </div>
      )}

      {/* ---- Headline ---- */}
      <div className="kpi-row kpi-row--six" style={{ marginTop: '1.25rem' }}>
        <Kpi label="Upcoming trips" value={summary.upcoming} icon={<Briefcase size={16} />}
          foot={summary.upcoming ? 'Paid and confirmed' : 'Nothing booked yet'} />
        <Kpi label="Completed trips" value={summary.completed} icon={<CheckCircle2 size={16} />}
          foot={`${summary.totalBookings} booking${summary.totalBookings === 1 ? '' : 's'} in total`} />
        <Kpi label="Total spent" value={short(summary.spentPaise)} icon={<Wallet size={16} />}
          foot="Across paid bookings" />
        <Kpi label="Nights away" value={summary.nights} icon={<Moon size={16} />}
          foot="Stays and guided days" />
        <Kpi label="Districts explored" value={`${summary.districtsVisited}/${summary.districtsTotal}`}
          icon={<Compass size={16} />} foot={`${explorePercent}% of Jharkhand`} />
        <Kpi label="Reviews written" value={summary.reviewsWritten} icon={<Star size={16} />}
          foot={summary.reviewsPending ? `${summary.reviewsPending} still to write` : 'All caught up'} />
      </div>

      {/* ---- Spend + what needs doing ---- */}
      <div className="bento-grid" style={{ marginBottom: '1.25rem' }}>
        <div className="bento-card bento-span-8" style={{ padding: '1.5rem' }}>
          <div className="row-between" style={{ alignItems: 'flex-start', marginBottom: '1.1rem' }}>
            <div>
              <div className="spec-label">Travel spending</div>
              <div className="kpi-value" style={{ marginTop: '0.3rem' }}>{rupees(summary.spentPaise)}</div>
              <div className="tiny muted">Last 6 months</div>
            </div>
          </div>

          {hasSpend ? (
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 8, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fillSpend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART.line} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={CHART.line} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: CHART.axis, fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: CHART.axis, fontSize: 12 }}
                    tickFormatter={(v) => (v >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`)} />
                  <Tooltip formatter={(v) => `₹${v.toLocaleString('en-IN')}`}
                    contentStyle={{ borderRadius: 10, border: '1px solid #e8e8ea', fontSize: 13 }} />
                  <Area type="monotone" dataKey="Spend" stroke={CHART.line} strokeWidth={2.5} fill="url(#fillSpend)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            // An axis with a flat zero line reads as a broken chart. Say plainly
            // that there is nothing to plot yet.
            <div className="center" style={{ height: 220, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <Wallet size={26} style={{ color: 'var(--text-faint)' }} />
              <p className="small muted" style={{ marginTop: '0.6rem' }}>
                Your spending will chart here once you book your first trip.
              </p>
            </div>
          )}

          <div className="mini-stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {spendByCategory.map(c => (
              <div key={c.category}>
                <div className="tiny faint">{CATEGORY_LABEL[c.category]}</div>
                <div className="row" style={{ gap: '0.35rem', alignItems: 'baseline' }}>
                  <span className="strong">{short(c.paise)}</span>
                  <span className="tiny muted">({c.count})</span>
                </div>
                <div className="meter" style={{ marginTop: '0.4rem' }}>
                  <div className="meter-fill" style={{ width: `${spendTotal ? (c.paise / spendTotal) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bento-card bento-span-4" style={{ padding: '1.5rem' }}>
          <div className="spec-label" style={{ marginBottom: '0.9rem' }}>Needs your attention</div>

          {todos.length === 0 ? (
            <div className="center" style={{ padding: '2rem 0' }}>
              <CheckCircle2 size={26} style={{ color: 'var(--accent)' }} />
              <p className="small muted" style={{ marginTop: '0.6rem' }}>All caught up. Nothing waiting on you.</p>
            </div>
          ) : (
            <div className="stack-sm">
              {todos.map(item => {
                const Icon = ATTENTION_ICON[item.key] || CalendarClock;
                return (
                  <Link key={item.key} to={item.link} className="todo-row">
                    <span className="todo-icon"><Icon size={14} /></span>
                    <span className="small" style={{ flex: 1 }}>{item.label}</span>
                    <span className="todo-count">{item.count}</span>
                    <ArrowRight size={13} style={{ color: 'var(--text-faint)' }} />
                  </Link>
                );
              })}
            </div>
          )}

          <div className="mini-stats" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div>
              <div className="tiny faint">Reviews written</div>
              <div className="strong">{summary.reviewsWritten}</div>
            </div>
            <div>
              <div className="tiny faint">Still to review</div>
              <div className="strong">{summary.reviewsPending}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Trips + the explorer map ---- */}
      <div className="bento-grid" style={{ marginBottom: '1.25rem' }}>
        <div className="bento-card bento-span-4" style={{ padding: '1.5rem' }}>
          <div className="row-between" style={{ marginBottom: '1rem' }}>
            <div className="spec-label" style={{ margin: 0 }}>Your next trips</div>
            <Link to="/bookings" className="tiny link-quiet">All bookings <ArrowRight size={12} /></Link>
          </div>

          {upcomingTrips.length === 0 ? (
            <p className="small muted">Nothing booked yet. Your confirmed trips will appear here.</p>
          ) : (
            <div className="stack-sm">
              {upcomingTrips.map(t => (
                <Link key={t.id} to="/bookings" className="arrival" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="arrival-date">
                    <span className="arrival-day">{new Date(t.checkIn).getDate()}</span>
                    <span className="arrival-mon">
                      {new Date(t.checkIn).toLocaleString('en-IN', { month: 'short' })}
                    </span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="small strong ellipsis">{t.title}</div>
                    <div className="tiny muted ellipsis">
                      {t.district}{t.nights > 0 && ` · ${t.nights} night${t.nights > 1 ? 's' : ''}`}
                    </div>
                  </div>
                  <div className="small strong" style={{ marginLeft: 'auto' }}>{rupees(t.amountPaise)}</div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Every district on the platform, lit where they have actually stayed.
            It gives a traveller with no bookings something true to look at, and
            it doubles as a way into districts they have never visited. */}
        <div className="bento-card bento-span-8" style={{ padding: '1.5rem' }}>
          <div className="row-between" style={{ marginBottom: '0.35rem' }}>
            <div className="spec-label" style={{ margin: 0 }}>Your Jharkhand map</div>
            <Link to="/explore" className="tiny link-quiet">Browse all <ArrowRight size={12} /></Link>
          </div>
          <p className="tiny muted" style={{ marginBottom: '1rem' }}>
            {summary.districtsVisited} of {summary.districtsTotal} districts explored. Tap any district to see what is bookable there.
          </p>

          <div className="meter" style={{ marginBottom: '1rem' }}>
            <div className="meter-fill" style={{ width: `${explorePercent}%` }} />
          </div>

          <div className="row-wrap" style={{ gap: '0.4rem' }}>
            {districts.map(d => (
              <Link
                key={d.name}
                to={`/explore?district=${encodeURIComponent(d.name)}`}
                className="chip"
                style={{
                  textDecoration: 'none',
                  background: d.visits ? 'var(--accent)' : undefined,
                  color: d.visits ? 'white' : undefined,
                  borderColor: d.visits ? 'var(--accent)' : undefined,
                }}
                title={d.visits ? `${d.visits} booking${d.visits > 1 ? 's' : ''}` : 'Not visited yet'}
              >
                <MapPin size={11} style={{ marginRight: '3px' }} />{d.name}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ---- Recommendations ---- */}
      <div className="row-between" style={{ marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>Top rated in Jharkhand</h3>
        <Link to="/explore" className="tiny link-quiet">See all <ArrowRight size={12} /></Link>
      </div>

      {recommendations.length === 0 ? (
        <p className="small muted">Nothing to recommend yet — check back once more operators are verified.</p>
      ) : (
        <div className="grid-cards">
          {recommendations.map(l => (
            <Link key={l.id} to={`/explore/${l.id}`} className="card card--flush card-link">
              <div className="thumb">
                <SafeImage src={l.image} alt={l.title} label={l.title} />
              </div>
              <div style={{ padding: '1.25rem' }}>
                <div className="row-between" style={{ alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                  <h3 style={{ fontSize: '1.05rem', lineHeight: '1.3' }}>{l.title}</h3>
                  <span className="badge badge-neutral" style={{ flexShrink: 0, textTransform: 'capitalize' }}>
                    {l.category}
                  </span>
                </div>
                <p className="muted small row" style={{ marginBottom: '1rem', gap: '0.35rem' }}>
                  <MapPin size={13} /> {l.district}
                </p>

                <div className="row-between">
                  <div>
                    <span className="strong">₹{l.price?.toLocaleString('en-IN')}</span>
                    <span className="tiny faint"> / {l.category === 'artisan' ? 'item' : l.category === 'guide' ? 'day' : 'night'}</span>
                  </div>
                  <div className="row small strong" style={{ gap: '0.2rem' }}>
                    <Star size={14} color="#f59e0b" fill="#f59e0b" />
                    {l.rating ?? 'New'}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
};

export default TouristDashboard;
