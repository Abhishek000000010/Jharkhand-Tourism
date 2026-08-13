const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-08-17" (or a full ISO timestamp) → "17 Aug" */
export const fmtDay = (value) => {
  if (!value) return '';
  const [, month, day] = value.slice(0, 10).split('-').map(Number);
  return `${day} ${MONTHS[month - 1]}`;
};

export const dayBefore = (value) => {
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
};

/**
 * Date ranges are half-open everywhere in this app — [17th, 19th) is two nights,
 * not three — but "17 – 18 Aug" is what an operator expects to read, so the end
 * is pulled back a day for display.
 */
export const fmtRange = (startIso, endExclusiveIso) => {
  if (!startIso) return '';
  if (!endExclusiveIso) return fmtDay(startIso);

  const last = dayBefore(endExclusiveIso);
  return last <= startIso.slice(0, 10) ? fmtDay(startIso) : `${fmtDay(startIso)} – ${fmtDay(last)}`;
};

export const fmtTime = (value) =>
  new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
