import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Bell, CalendarCheck, CalendarX, XCircle, CheckCircle2, UserX,
  IndianRupee, MessageSquare, Star, BadgeCheck, CheckCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const POLL_MS = 20000;

// Icon and tone per event, so the bell is scannable without reading every line.
const LOOK = {
  booking_confirmed: { icon: CalendarCheck, tone: 'good' },
  booking_cancelled: { icon: CalendarX, tone: 'warn' },
  booking_rejected: { icon: XCircle, tone: 'bad' },
  booking_completed: { icon: CheckCircle2, tone: 'good' },
  booking_no_show: { icon: UserX, tone: 'bad' },
  refund_issued: { icon: IndianRupee, tone: 'good' },
  message_received: { icon: MessageSquare, tone: 'neutral' },
  review_received: { icon: Star, tone: 'good' },
  review_replied: { icon: MessageSquare, tone: 'neutral' },
  operator_approved: { icon: BadgeCheck, tone: 'good' },
  operator_rejected: { icon: XCircle, tone: 'bad' },
};

const ago = (value) => {
  const seconds = Math.round((Date.now() - new Date(value)) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

/**
 * The notification bell, shared by travellers and hosts.
 *
 * The two sides see the same component because they see the same events from
 * opposite ends — one person's "booking confirmed" is the other's "new booking" —
 * and the link each notification carries was already resolved for the recipient's
 * role when it was written.
 */
const NotificationBell = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const wrapRef = useRef(null);

  const userId = user?._id || user?.id || null;

  const load = useCallback(async () => {
    try {
      const res = await axios.get('/api/notifications');
      setItems(res.data.notifications || []);
      setUnread(res.data.unread || 0);
    } catch {
      // The bell is ambient. A failed poll should never interrupt the page.
    }
  }, []);

  // Keyed on the signed-in user, not just on mount: the header survives a
  // sign-out and sign-in, so without this the bell would go on showing the
  // previous account's notifications until the next poll came round.
  useEffect(() => {
    setItems([]);
    setUnread(0);
    setOpen(false);

    if (!userId) return;

    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [userId, load]);

  // Click-away and Escape, so the panel behaves like every other dropdown.
  useEffect(() => {
    if (!open) return;

    const onDown = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };

    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openItem = async (item) => {
    setOpen(false);

    if (!item.readAt) {
      setUnread(n => Math.max(0, n - 1));
      setItems(list => list.map(i => (i._id === item._id ? { ...i, readAt: new Date().toISOString() } : i)));
      axios.post(`/api/notifications/${item._id}/read`).catch(() => load());
    }

    if (item.link) navigate(item.link);
  };

  const readAll = async () => {
    setUnread(0);
    setItems(list => list.map(i => (i.readAt ? i : { ...i, readAt: new Date().toISOString() })));
    try {
      await axios.post('/api/notifications/read-all');
    } catch {
      load();
    }
  };

  return (
    <div className="bell-wrap" ref={wrapRef}>
      <button
        className="bell-btn"
        onClick={() => setOpen(o => !o)}
        aria-label={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
        aria-expanded={open}
      >
        <Bell size={18} />
        {unread > 0 && <span className="bell-count">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="bell-panel" role="dialog" aria-label="Notifications">
          <div className="bell-head">
            <strong className="small">Notifications</strong>
            {unread > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={readAll}>
                <CheckCheck size={13} /> Mark all read
              </button>
            )}
          </div>

          <div className="bell-body">
            {items.length === 0 ? (
              <div className="bell-blank">
                <Bell size={22} style={{ color: 'var(--text-faint)' }} />
                <p className="small muted" style={{ marginTop: '0.5rem' }}>Nothing yet.</p>
                <p className="tiny faint">Bookings, messages and reviews will show up here.</p>
              </div>
            ) : (
              items.map(item => {
                const look = LOOK[item.type] || { icon: Bell, tone: 'neutral' };
                const Icon = look.icon;

                return (
                  <button
                    key={item._id}
                    className={`bell-item ${item.readAt ? '' : 'bell-item--unread'}`}
                    onClick={() => openItem(item)}
                  >
                    <span className={`bell-icon bell-icon--${look.tone}`}><Icon size={14} /></span>
                    <span style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                      <span className="row-between" style={{ gap: '0.5rem', alignItems: 'baseline' }}>
                        <span className="small strong">{item.title}</span>
                        <span className="tiny faint" style={{ flexShrink: 0 }}>{ago(item.createdAt)}</span>
                      </span>
                      {item.body && <span className="tiny muted bell-text">{item.body}</span>}
                    </span>
                    {!item.readAt && <span className="bell-pip" aria-hidden="true" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
