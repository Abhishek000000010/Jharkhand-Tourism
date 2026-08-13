import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  TrendingUp, TrendingDown, Wallet, CalendarCheck, Percent, Star, Moon,
  RefreshCw, ArrowRight, AlertTriangle, MessageSquare, CheckCircle2, Clock,
} from 'lucide-react';
import OperatorLayout from '../../components/OperatorLayout';
import Sparkline from '../../components/Sparkline';
import OccupancyHeatmap from '../../components/OccupancyHeatmap';
import { fmtDay } from '../../utils/dates';

// Recharts writes these straight into SVG, so they must be literal values — CSS
// variables that don't exist resolve to black, which is how the old page broke.
const CHART = { net: '#15803d', gross: '#86efac', grid: '#e8e8ea', axis: '#9ca3af' };

const rupees = (paise) => `₹${Math.round((paise || 0) / 100).toLocaleString('en-IN')}`;

const short = (paise) => {
  const value = (paise || 0) / 100;
  if (Math.abs(value) >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (Math.abs(value) >= 1000) return `₹${(value / 1000).toFixed(1)}k`;
  return `₹${Math.round(value)}`;
};

const Delta = ({ percent }) => {
  // Null means there is no comparable previous period. Saying "—" is honest;
  // the old page printed "New" on every tile, which read as a bug.
  if (percent === null || percent === undefined) return <span className="delta delta-flat">—</span>;
  if (percent === 0) return <span className="delta delta-flat">0%</span>;

  const up = percent > 0;
  return (
    <span className={`delta ${up ? 'delta-up' : 'delta-down'}`}>
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {Math.abs(percent) > 999 ? '999+' : Math.abs(percent)}%
    </span>
  );
};

const Kpi = ({ label, value, delta, foot, icon, spark }) => (
  <div className="kpi">
    <div className="row-between" style={{ alignItems: 'flex-start' }}>
      <div className="spec-label">{label}</div>
      <div className="kpi-icon">{icon}</div>
    </div>
    <div className="row" style={{ gap: '0.5rem', alignItems: 'center', margin: '0.35rem 0 0.5rem' }}>
      <div className="kpi-value">{value}</div>
      {delta !== undefined && <Delta percent={delta} />}
    </div>
    <div className="row-between" style={{ gap: '0.5rem' }}>
      <span className="tiny muted">{foot}</span>
      {spark && spark.length > 1 && <Sparkline values={spark} />}
    </div>
  </div>
);

const ATTENTION_ICON = {
  complete: CheckCircle2,
  messages: MessageSquare,
  reviews: Star,
  verification: AlertTriangle,
};

const OperatorAnalytics = () => {
  const [data, setData] = useState(null);
  const [range, setRange] = useState('6m');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const res = await axios.get('/api/operator/analytics', { params: { range } });
      setData(res.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load your analytics');
    } finally {
      setLoading(false);
      setBusy(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <OperatorLayout fluid>
      <div className="page-fluid"><div className="muted">Loading analytics…</div></div>
    </OperatorLayout>
  );

  if (error || !data) return (
    <OperatorLayout fluid>
      <div className="page-fluid"><div className="alert alert-error">{error || 'Could not load your analytics'}</div></div>
    </OperatorLayout>
  );

  const { summary, deltas, changes, series, heatmap, attention, conversion, listings, upcoming, settlements } = data;

  const chartData = series.map(s => ({
    name: s.label,
    Gross: Math.round(s.grossPaise / 100),
    Earnings: Math.round(s.netPaise / 100),
  }));

  const sparkNet = series.map(s => s.netPaise);
  const sparkGross = series.map(s => s.grossPaise);
  const sparkBookings = series.map(s => s.bookings);

  const signed = (paise) => `${paise >= 0 ? '+' : '−'}${rupees(Math.abs(paise))}`;
  const top = listings.slice(0, 3);

  return (
    <OperatorLayout fluid>
      <div className="page-fluid">
        <div className="section-head" style={{ marginBottom: '1.5rem' }}>
          <div>
            <h1 className="page-title" style={{ fontSize: '2.2rem', marginBottom: '0.35rem' }}>
              Earnings &amp; analytics
            </h1>
            <p className="page-sub" style={{ margin: 0 }}>
              How your homestays are performing, and what you are owed.
            </p>
          </div>

          <div className="row" style={{ gap: '0.5rem' }}>
            <select className="input" style={{ width: 'auto' }} value={range} onChange={(e) => setRange(e.target.value)}>
              {data.range.options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
            <button className="btn btn-secondary" disabled={busy} onClick={load}>
              <RefreshCw size={14} className={busy ? 'spin' : undefined} /> Refresh
            </button>
          </div>
        </div>

        {summary.strikes > 0 && (
          <div className="alert alert-warning" style={{ marginBottom: '1.25rem' }}>
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <div><strong>{summary.strikes} strike{summary.strikes > 1 ? 's' : ''} on your account.</strong>{' '}
              Recorded when you cancel a booking a traveller already paid for.</div>
          </div>
        )}

        {/* ---- Headline ---- */}
        <div className="kpi-row kpi-row--six">
          <Kpi label="Your earnings" value={short(summary.netPaise)} delta={deltas.netPaise}
            foot={`${signed(changes.netPaise)} vs previous`} icon={<Wallet size={16} />} spark={sparkNet} />
          <Kpi label="Gross revenue" value={short(summary.grossPaise)} delta={deltas.grossPaise}
            foot={`${rupees(summary.commissionPaise)} commission`} icon={<TrendingUp size={16} />} spark={sparkGross} />
          <Kpi label="Bookings" value={summary.bookingsTotal} delta={deltas.bookings}
            foot={`${changes.bookings >= 0 ? '+' : '−'}${Math.abs(changes.bookings)} vs previous`}
            icon={<CalendarCheck size={16} />} spark={sparkBookings} />
          <Kpi label="Occupancy · 30 days" value={`${summary.occupancyPercent}%`} delta={summary.occupancyDelta}
            foot={`${summary.nightsSold} of ${summary.capacityNights} room-nights`} icon={<Percent size={16} />} />
          <Kpi label="Avg nightly rate" value={short(summary.avgNightlyPaise)} delta={deltas.avgNightlyPaise}
            foot="Gross per room-night sold" icon={<Moon size={16} />} />
          <Kpi label="Guest rating" value={summary.ratingAvg ?? '—'}
            foot={`${summary.ratingCount} review${summary.ratingCount === 1 ? '' : 's'} · ${summary.honourRate}% honoured`}
            icon={<Star size={16} />} />
        </div>

        {/* ---- Chart + what to do ---- */}
        <div className="bento-grid" style={{ marginBottom: '1.25rem' }}>
          <div className="bento-card bento-span-8" style={{ padding: '1.5rem' }}>
            <div className="row-between" style={{ alignItems: 'flex-start', marginBottom: '1.1rem' }}>
              <div>
                <div className="spec-label">Earnings over time</div>
                <div className="row" style={{ gap: '0.5rem', alignItems: 'center', marginTop: '0.3rem' }}>
                  <div className="kpi-value">{rupees(summary.netPaise)}</div>
                  <Delta percent={deltas.netPaise} />
                </div>
                <div className="tiny muted">{data.range.label} · after commission</div>
              </div>
              <div className="legend">
                <span><i style={{ background: CHART.gross }} /> Gross</span>
                <span><i style={{ background: CHART.net }} /> Your earnings</span>
              </div>
            </div>

            <div style={{ height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 8, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fillNet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART.net} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={CHART.net} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="fillGross" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART.gross} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={CHART.gross} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: CHART.axis, fontSize: 12 }}
                    interval="preserveStartEnd" minTickGap={16} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: CHART.axis, fontSize: 12 }}
                    tickFormatter={(v) => (v >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`)} />
                  <Tooltip formatter={(v) => `₹${v.toLocaleString('en-IN')}`}
                    contentStyle={{ borderRadius: 10, border: '1px solid #e8e8ea', fontSize: 13 }} />
                  <Area type="monotone" dataKey="Gross" stroke={CHART.gross} strokeWidth={2} fill="url(#fillGross)" />
                  <Area type="monotone" dataKey="Earnings" stroke={CHART.net} strokeWidth={2.5} fill="url(#fillNet)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* The only panel on the page that asks the operator to DO something. */}
          <div className="bento-card bento-span-4" style={{ padding: '1.5rem' }}>
            <div className="spec-label" style={{ marginBottom: '0.9rem' }}>Needs your attention</div>

            {attention.length === 0 ? (
              <div className="center" style={{ padding: '2rem 0' }}>
                <CheckCircle2 size={26} style={{ color: 'var(--accent)' }} />
                <p className="small muted" style={{ marginTop: '0.6rem' }}>All caught up. Nothing waiting on you.</p>
              </div>
            ) : (
              <div className="stack-sm">
                {attention.map(item => {
                  const Icon = ATTENTION_ICON[item.key] || AlertTriangle;
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
                <div className="tiny faint">Enquiries</div>
                <div className="strong">{conversion.enquiries}</div>
              </div>
              <div>
                <div className="tiny faint">Turned into stays</div>
                <div className="row" style={{ gap: '0.35rem', alignItems: 'baseline' }}>
                  <span className="strong">{conversion.rate}%</span>
                  <span className="tiny muted">({conversion.converted})</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ---- Heatmap ---- */}
        <div className="bento-card" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
          <div className="row-between" style={{ marginBottom: '1rem' }}>
            <div>
              <div className="spec-label">Occupancy · next 60 nights</div>
              <div className="tiny muted" style={{ marginTop: '0.2rem' }}>
                Every square is one night across all {summary.totalListings} listings. Hover for the detail.
              </div>
            </div>
            <Link to="/operator/listings" className="tiny link-quiet">Manage calendars <ArrowRight size={12} /></Link>
          </div>
          <OccupancyHeatmap days={heatmap} />
        </div>

        {/* ---- Top listings + arrivals ---- */}
        <div className="bento-grid" style={{ marginBottom: '1.25rem' }}>
          <div className="bento-card bento-span-8" style={{ padding: '1.5rem' }}>
            <div className="row-between" style={{ marginBottom: '1rem' }}>
              <div className="spec-label" style={{ margin: 0 }}>Top performing listings</div>
              <Link to="/operator/listings" className="tiny link-quiet">All {listings.length} <ArrowRight size={12} /></Link>
            </div>

            <div className="perf-grid">
              {top.map((l, i) => (
                <Link key={l.id} to={`/operator/listings/${l.id}/calendar`} className="perf-card">
                  <div className="row-between">
                    <span className="perf-rank">#{i + 1}</span>
                    {l.ratingAvg && (
                      <span className="row tiny" style={{ gap: '0.2rem', color: 'var(--warning)' }}>
                        <Star size={12} /> {l.ratingAvg}
                      </span>
                    )}
                  </div>
                  <div className="strong ellipsis" style={{ marginTop: '0.4rem' }}>{l.title}</div>
                  <div className="tiny faint">{l.district} · {l.rooms} rooms</div>
                  <div className="price" style={{ fontSize: '1.15rem', marginTop: '0.6rem' }}>{rupees(l.netPaise)}</div>
                  <div className="tiny muted">{l.bookings} bookings</div>
                  <div className="meter" style={{ marginTop: '0.6rem' }}>
                    <div className="meter-fill" style={{ width: `${Math.min(100, l.occupancyPercent)}%` }} />
                  </div>
                  <div className="tiny faint">{l.occupancyPercent}% booked next 30 days</div>
                </Link>
              ))}
            </div>
          </div>

          <div className="bento-card bento-span-4" style={{ padding: '1.5rem' }}>
            <div className="row-between" style={{ marginBottom: '1rem' }}>
              <div className="spec-label" style={{ margin: 0 }}>Next arrivals</div>
              <Link to="/operator/bookings?view=timeline" className="tiny link-quiet">Timeline <ArrowRight size={12} /></Link>
            </div>

            {upcoming.length === 0 ? (
              <p className="small muted">Nobody is due to arrive yet.</p>
            ) : (
              <div className="stack-sm">
                {upcoming.map(b => (
                  <div key={b.id} className="arrival">
                    <div className="arrival-date">
                      <span className="arrival-day">{fmtDay(b.checkIn).split(' ')[0]}</span>
                      <span className="arrival-mon">{fmtDay(b.checkIn).split(' ')[1]}</span>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="small strong ellipsis">{b.guestName}</div>
                      <div className="tiny muted ellipsis">{b.listingTitle}</div>
                    </div>
                    <div className="small strong" style={{ marginLeft: 'auto' }}>{rupees(b.payoutPaise)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ---- Ledger ---- */}
        <div className="bento-card" style={{ padding: '1.5rem' }}>
          <div className="row-between" style={{ marginBottom: '0.35rem' }}>
            <div className="spec-label" style={{ margin: 0 }}>Settlement ledger</div>
            <span className="row tiny muted" style={{ gap: '0.3rem' }}>
              <Clock size={12} /> Paid out after checkout
            </span>
          </div>
          <p className="tiny muted" style={{ marginBottom: '1rem' }}>
            Commission is frozen per booking, so a later rate change never rewrites what you were
            promised. Bank transfer is simulated in this build.
          </p>

          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference</th><th>Listing</th><th>Due</th>
                  <th className="num">Amount</th><th className="num">Status</th>
                </tr>
              </thead>
              <tbody>
                {settlements.map(s => (
                  <tr key={s.reference}>
                    <td className="mono">{s.reference}</td>
                    <td className="ellipsis">{s.listingTitle}</td>
                    <td>{fmtDay(s.date)}</td>
                    <td className="num strong">{rupees(s.amountPaise)}</td>
                    <td className="num">
                      <span className={`badge ${s.status === 'Settled' ? 'badge-success' : 'badge-neutral'}`}>
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </OperatorLayout>
  );
};

export default OperatorAnalytics;
