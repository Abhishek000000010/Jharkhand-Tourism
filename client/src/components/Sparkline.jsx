/**
 * A tiny trend line for a KPI tile.
 *
 * Hand-rolled SVG rather than a chart library: at this size axes, tooltips and
 * responsiveness are all noise, and six points do not justify mounting Recharts
 * six times on one screen.
 */
const Sparkline = ({ values = [], width = 96, height = 28, color = '#15803d' }) => {
  if (values.length < 2) return null;

  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;

  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    // Inset by 2px top and bottom so the stroke is never clipped at the extremes.
    const y = height - 2 - ((value - min) / span) * (height - 4);
    return [x, y];
  });

  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} ${width},${height} 0,${height}`;
  const id = `spark-${values.join('-').slice(0, 24)}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${id})`} />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
};

export default Sparkline;
