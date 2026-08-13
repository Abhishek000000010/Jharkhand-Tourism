import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/*
 * Month grid driven by the server's per-day availability response.
 *
 * All date maths here is UTC to match the availability engine — using local-time
 * Date methods would shift which night a cell represents either side of the date line.
 */

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

export const toKey = (date) => date.toISOString().slice(0, 10);

export const monthRange = (year, month) => ({
  from: toKey(new Date(Date.UTC(year, month, 1))),
  to: toKey(new Date(Date.UTC(year, month + 1, 1))),
});

const AvailabilityCalendar = ({
  year,
  month,
  days = [],
  onMonthChange,
  onDayClick,
  selectedStart,
  selectedEnd,
  legend = true,
}) => {
  const byDate = useMemo(() => Object.fromEntries(days.map(d => [d.date, d])), [days]);

  const cells = useMemo(() => {
    const leading = new Date(Date.UTC(year, month, 1)).getUTCDay();
    const total = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return [
      ...Array(leading).fill(null),
      ...Array.from({ length: total }, (_, i) => new Date(Date.UTC(year, month, i + 1))),
    ];
  }, [year, month]);

  const classFor = (info, key) => {
    if (!info || info.isPast) return 'cal-day cal-day--past';
    if (info.blocked) return 'cal-day cal-day--blocked';
    if (info.isFull) return 'cal-day cal-day--full';

    // Half-open selection: the checkout day is an endpoint, not a booked night
    const inRange = selectedStart && selectedEnd && key >= selectedStart && key < selectedEnd;
    if (inRange || key === selectedStart || key === selectedEnd) return 'cal-day cal-day--selected';

    return `cal-day cal-day--free${onDayClick ? '' : ' is-static'}`;
  };

  const titleFor = (info) => {
    if (!info) return '';
    if (info.isPast) return 'Past date';
    if (info.blocked) return 'Closed by operator';
    if (info.isFull) return 'Fully booked';
    return `${info.remaining} of ${info.capacity} available`;
  };

  const shift = (delta) => {
    const next = new Date(Date.UTC(year, month + delta, 1));
    onMonthChange?.(next.getUTCFullYear(), next.getUTCMonth());
  };

  return (
    <div>
      <div className="cal-head">
        <button type="button" className="btn-icon" onClick={() => shift(-1)} aria-label="Previous month">
          <ChevronLeft size={16} />
        </button>
        <span className="cal-title">{MONTHS[month]} {year}</span>
        <button type="button" className="btn-icon" onClick={() => shift(1)} aria-label="Next month">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="cal-week">
        {WEEKDAYS.map((w, i) => <span key={i}>{w}</span>)}
      </div>

      <div className="cal-grid">
        {cells.map((date, i) => {
          if (!date) return <div key={`pad-${i}`} />;

          const key = toKey(date);
          const info = byDate[key];
          const clickable = info && !info.isPast && !info.isFull && !info.blocked && onDayClick;

          return (
            <div
              key={key}
              className={classFor(info, key)}
              title={titleFor(info)}
              onClick={clickable ? () => onDayClick(key) : undefined}
            >
              <span>{date.getUTCDate()}</span>
              {info && !info.isPast && !info.isFull && !info.blocked && info.capacity > 1 && (
                <span className="cal-day-left">{info.remaining}</span>
              )}
            </div>
          );
        })}
      </div>

      {legend && (
        <div className="cal-legend">
          <span><i className="swatch" style={{ background: 'var(--bg)' }} /> Available</span>
          <span><i className="swatch" style={{ background: 'var(--surface-2)' }} /> Booked</span>
          <span><i className="swatch" style={{ background: 'var(--danger-soft)', borderColor: '#fecaca' }} /> Closed</span>
        </div>
      )}
    </div>
  );
};

export default AvailabilityCalendar;
