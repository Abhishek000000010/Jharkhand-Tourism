import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import { DISTRICT_OPTIONS } from '../utils/districts';

/**
 * District picker.
 *
 * A native <select> was opening its list upwards whenever the field sat low in
 * the viewport — that placement is decided by the browser and cannot be styled,
 * so the only fix is to stop using a native popup. This panel always opens
 * downward and scrolls itself into view if there is not enough room, and with
 * 24 districts the type-to-filter box earns its place too.
 */
const DistrictSelect = ({ value, onChange, name = 'district', id, required }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const searchRef = useRef(null);

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DISTRICT_OPTIONS;
    return DISTRICT_OPTIONS.filter(o => o.label.toLowerCase().includes(q));
  }, [query]);

  const selected = DISTRICT_OPTIONS.find(o => o.value === value);

  // Close when the click lands outside the component.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  // On opening: focus the filter, and make room below if the panel would be
  // clipped by the bottom of the window.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(Math.max(0, DISTRICT_OPTIONS.findIndex(o => o.value === value)));
    searchRef.current?.focus();

    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    const overflow = rect.bottom - window.innerHeight + 16;
    if (overflow > 0) window.scrollBy({ top: overflow, behavior: 'smooth' });
  }, [open, value]);

  // Keep the highlighted row visible while arrowing through the list.
  useEffect(() => {
    if (!open) return;
    panelRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const pick = (option) => {
    // Shaped like a DOM event so callers can keep their existing handleChange.
    onChange({ target: { name, value: option.value } });
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (!open) {
      if (['Enter', ' ', 'ArrowDown'].includes(e.key)) { e.preventDefault(); setOpen(true); }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, options.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (options[activeIndex]) pick(options[activeIndex]);
    }
  };

  return (
    <div className="combo" ref={rootRef} onKeyDown={onKeyDown}>
      {/* The real value still travels with the form on submit. */}
      <input type="hidden" name={name} value={value || ''} required={required} />

      <button
        type="button"
        id={id}
        className={`select combo-trigger ${open ? 'is-open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selected ? '' : 'faint'}>{selected ? selected.label : 'Select a district'}</span>
        <ChevronDown size={16} className="combo-caret" />
      </button>

      {open && (
        <div className="combo-panel" ref={panelRef} role="listbox">
          <div className="combo-search">
            <Search size={14} />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
              placeholder="Type to filter…"
            />
          </div>

          <div className="combo-list">
            {options.length === 0 ? (
              <div className="combo-empty">No district matches “{query}”</div>
            ) : options.map((o, i) => (
              <button
                type="button"
                key={o.value}
                data-index={i}
                role="option"
                aria-selected={o.value === value}
                className={`combo-option ${i === activeIndex ? 'is-active' : ''}`}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => pick(o)}
              >
                <span>{o.label}</span>
                {o.value === value && <Check size={15} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DistrictSelect;
