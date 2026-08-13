import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Send, MessageSquare, ArrowLeft, MapPin, CalendarDays } from 'lucide-react';
import { fmtDay } from '../utils/dates';

// Polling rather than sockets: a homestay enquiry is not a live chat, and this keeps
// the whole feature to plain HTTP with no extra infrastructure to run.
const THREAD_POLL_MS = 6000;
const LIST_POLL_MS = 20000;

const rupees = (paise) => `₹${Math.round((paise || 0) / 100).toLocaleString('en-IN')}`;

const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

/** "14:32" today, "9 Aug" this year, "9 Aug 25" otherwise. */
const stamp = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const now = new Date();

  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }
  if (date.getFullYear() === now.getFullYear()) return fmtDay(date.toISOString());
  return `${fmtDay(date.toISOString())} ${String(date.getFullYear()).slice(2)}`;
};

const BOOKING_LABEL = {
  pending_payment: 'Awaiting payment',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rejected: 'Cancelled by host',
  no_show: 'No show',
  expired: 'Hold expired',
};

/**
 * The inbox, shared by both sides of the marketplace.
 *
 * A traveller and a host see the same thread, the same history and the same booking
 * context — only the sidebar around it differs, which is why this is one component
 * with a `basePath` rather than two that drift apart.
 */
const MessagingCenter = ({ basePath, emptyHint }) => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState([]);
  const [thread, setThread] = useState(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const endRef = useRef(null);
  const lastCountRef = useRef(0);

  const loadList = useCallback(async () => {
    try {
      const res = await axios.get('/api/messages/conversations');
      setConversations(res.data.conversations);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load your messages');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadThread = useCallback(async (threadId) => {
    try {
      const res = await axios.get(`/api/messages/conversations/${threadId}`);
      setThread(res.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not open that conversation');
      setThread(null);
    }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  useEffect(() => {
    const timer = setInterval(loadList, LIST_POLL_MS);
    return () => clearInterval(timer);
  }, [loadList]);

  useEffect(() => {
    if (!id) { setThread(null); return; }

    loadThread(id);
    const timer = setInterval(() => loadThread(id), THREAD_POLL_MS);
    return () => clearInterval(timer);
  }, [id, loadThread]);

  // Jump to the newest message when the thread changes or something arrives, but
  // not on every poll — otherwise reading back through history is impossible.
  useEffect(() => {
    const count = thread?.messages?.length || 0;
    if (count !== lastCountRef.current) {
      lastCountRef.current = count;
      endRef.current?.scrollIntoView({ block: 'end' });
    }
  }, [thread]);

  const send = async (e) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;

    setSending(true);
    setError(null);

    try {
      await axios.post(`/api/messages/conversations/${id}/messages`, { body });
      setDraft('');
      await Promise.all([loadThread(id), loadList()]);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send that message');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="page page--mid"><div className="muted">Loading messages…</div></div>;

  const booking = thread?.booking;

  return (
    <div className="chat-full-bleed">
      {error && <div className="alert alert-error" style={{ margin: '1.25rem' }}>{error}</div>}

      {conversations.length === 0 ? (
        <div className="empty" style={{ margin: '2rem' }}>
          <MessageSquare size={28} style={{ color: 'var(--text-faint)', marginBottom: '0.75rem' }} />
          <h3>No conversations yet</h3>
          <p className="muted">{emptyHint}</p>
        </div>
      ) : (
        <div className={`chat ${id ? 'chat--thread-open' : ''}`}>
          {/* ---- Inbox ---- */}
          <div className="chat-list">
            {conversations.map(c => (
              <Link
                key={c._id}
                to={`${basePath}/${c._id}`}
                className={`chat-row ${String(c._id) === id ? 'chat-row--on' : ''}`}
              >
                <div className="avatar">{initials(c.counterpart?.name)}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="row-between" style={{ gap: '0.5rem' }}>
                    <span className="small strong ellipsis">{c.counterpart?.name}</span>
                    <span className="tiny faint" style={{ flexShrink: 0 }}>{stamp(c.lastMessageAt)}</span>
                  </div>
                  <div className="tiny muted ellipsis">{c.listing?.title}</div>
                  <div className="tiny faint ellipsis">
                    {c.lastMessage || 'No messages yet — say hello.'}
                  </div>
                </div>
                {c.unread > 0 && <span className="unread-dot">{c.unread}</span>}
              </Link>
            ))}
          </div>

          {/* ---- Thread ---- */}
          <div className="chat-thread">
            {!thread ? (
              <div className="chat-blank">
                <MessageSquare size={26} style={{ color: 'var(--text-faint)' }} />
                <p className="small muted" style={{ marginTop: '0.6rem' }}>
                  Pick a conversation to read it.
                </p>
              </div>
            ) : (
              <>
                <div className="chat-head">
                  <button className="btn-icon chat-back" onClick={() => navigate(basePath)} aria-label="Back to inbox">
                    <ArrowLeft size={16} />
                  </button>
                  <div className="avatar">{initials(thread.conversation.counterpart?.name)}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="strong ellipsis">{thread.conversation.counterpart?.name}</div>
                    <Link
                      to={`/explore/${thread.conversation.listing?._id}`}
                      className="row tiny muted link-quiet"
                      style={{ gap: '0.25rem' }}
                    >
                      <MapPin size={12} /> {thread.conversation.listing?.title}
                    </Link>
                  </div>
                </div>

                {/* What the thread is actually about, so neither side has to ask
                    "which booking?" halfway down the conversation. */}
                {booking && (
                  <div className="chat-context">
                    <CalendarDays size={14} style={{ flexShrink: 0 }} />
                    <span className="tiny">
                      {booking.checkIn
                        ? <>{fmtDay(booking.checkIn)} → {fmtDay(booking.checkOut)} · {booking.units} room{booking.units > 1 ? 's' : ''}</>
                        : <>{booking.units} item{booking.units > 1 ? 's' : ''}</>}
                      {' · '}{rupees(booking.amountPaise)}
                      {booking.bookingRef ? ` · ${booking.bookingRef}` : ''}
                    </span>
                    <span className="chip" style={{ marginLeft: 'auto' }}>
                      {BOOKING_LABEL[booking.status] || booking.status}
                    </span>
                  </div>
                )}

                <div className="chat-body">
                  {thread.messages.length === 0 && (
                    <p className="small muted" style={{ textAlign: 'center', padding: '2rem 0' }}>
                      No messages yet. Ask whatever you need to know.
                    </p>
                  )}

                  {thread.messages.map(m => (
                    <div key={m._id} className={`bubble-row ${m.senderRole === thread.side ? 'bubble-row--mine' : ''}`}>
                      <div className="bubble">
                        <div className="bubble-body">{m.body}</div>
                        <div className="bubble-time">{stamp(m.createdAt)}</div>
                      </div>
                    </div>
                  ))}
                  <div ref={endRef} />
                </div>

                <form className="chat-composer" onSubmit={send}>
                  <input
                    className="input"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={thread.side === 'operator'
                      ? 'Reply to your guest…'
                      : 'Ask about parking, check-in time, food…'}
                    maxLength={2000}
                  />
                  <button className="btn btn-primary" type="submit" disabled={!draft.trim() || sending}>
                    <Send size={15} /> {sending ? 'Sending…' : 'Send'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MessagingCenter;
