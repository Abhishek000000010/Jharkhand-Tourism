import { fmtDay } from '../utils/dates';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Five bands rather than a continuous gradient — the eye reads steps far faster. */
const band = (percent) => {
  if (percent <= 0) return 0;
  if (percent < 25) return 1;
  if (percent < 50) return 2;
  if (percent < 75) return 3;
  return 4;
};

/**
 * Sixty nights of occupancy as a grid of squares.
 *
 * This is the one widget that reads well on thin data: even three bookings make a
 * visible pattern, where a table of the same three bookings looks empty.
 */
const OccupancyHeatmap = ({ days = [] }) => {
  if (days.length === 0) return <p className="small muted">No date-based listings to show.</p>;

  // Label each month once, at the first cell that falls inside it.
  const seen = new Set();
  const cells = days.map((day) => {
    const month = day.date.slice(0, 7);
    const first = !seen.has(month);
    seen.add(month);
    return { ...day, monthLabel: first ? MONTHS[Number(day.date.slice(5, 7)) - 1] : null };
  });

  const full = days.filter(d => d.percent >= 75).length;
  const empty = days.filter(d => d.percent <= 0).length;

  return (
    <div>
      <div className="heat-grid">
        {cells.map(day => (
          <div
            key={day.date}
            className={`heat-cell heat-${band(day.percent)}`}
            title={`${fmtDay(day.date)} · ${day.booked} of ${day.capacity} rooms booked`
              + (day.closed ? ` · ${day.closed} closed` : '')
              + ` · ${day.percent}% full`}
          >
            {day.monthLabel && <span className="heat-month">{day.monthLabel}</span>}
          </div>
        ))}
      </div>

      <div className="heat-legend">
        <span className="tiny muted">{empty} nights completely free · {full} nights nearly full</span>
        <span className="row" style={{ gap: '0.3rem' }}>
          <span className="tiny faint">Empty</span>
          {[0, 1, 2, 3, 4].map(n => <i key={n} className={`heat-key heat-${n}`} />)}
          <span className="tiny faint">Full</span>
        </span>
      </div>
    </div>
  );
};

export default OccupancyHeatmap;
