import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { MessageCircle, X, MapPin, Star, Send } from 'lucide-react';

/**
 * Site-wide assistant.
 *
 * It used to live inside the itinerary planner, so a tourist reading a
 * destination page had no way to ask anything. It is mounted once at the app
 * root instead.
 *
 * The listing and destination cards under each answer are not decoration. The
 * server returns the exact rows the answer was retrieved from, and a small
 * local model demonstrably garbles names in prose — it has called a Betla guide
 * a "Latehar" one. The cards carry the authoritative name, price and rating,
 * and they are the only clickable path onward.
 */

/** Matches the server's own window, so we never send history it will discard. */
const MAX_HISTORY = 6;

/**
 * Both borrowed from the tourist sidebar in index.css — the drawer sits under
 * the same sticky header and slides on the same curve, so the two read as one
 * shell instead of a panel bolted on top of the page.
 */
const HEADER_H = '61px';
const DURATION = '0.3s cubic-bezier(0.4, 0, 0.2, 1)';

const GREETING = {
  role: 'assistant',
  content: "Namaste! I'm the Jharkhand Tourism assistant. Ask me about destinations, homestays, guides, crafts, or how booking works — in Hindi or English.",
};

const SUGGESTIONS = [
  'Which homestay is good?',
  'Best waterfalls near Ranchi',
  'How do I book and pay?',
];

const ChatbotWidget = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [tier, setTier] = useState(null);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Pin to the newest message, otherwise a long answer leaves the user staring
  // at the top of a reply they have already read.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // A drawer that covers a third of the screen needs a keyboard way out.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const send = async (text) => {
    const question = (text ?? input).trim();
    if (!question || loading) return;

    // Snapshot the history BEFORE adding this turn — the server takes the
    // question separately and would otherwise see it twice.
    const history = messages
      .filter(m => m !== GREETING)
      .slice(-MAX_HISTORY)
      .map(({ role, content }) => ({ role, content }));

    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setInput('');
    setLoading(true);

    try {
      const res = await axios.post('/api/ai/chat', { message: question, history });
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.data.response,
        sources: res.data.sources,
      }]);
      setTier(res.data.tier);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I could not reach the assistant. You can still browse everything on the Explore page.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const Sources = ({ sources }) => {
    const listings = sources?.listings || [];
    const destinations = sources?.destinations || [];
    if (!listings.length && !destinations.length) return null;

    return (
      <div style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {listings.map(l => (
          <Link
            key={l.id}
            to={`/explore/${l.id}`}
            style={{
              display: 'block', textDecoration: 'none', color: 'inherit',
              border: '1px solid var(--border)', borderRadius: '8px',
              padding: '0.45rem 0.6rem', fontSize: '0.78rem', background: 'var(--bg)',
            }}
          >
            <span style={{ fontWeight: 600 }}>{l.title}</span>
            <span style={{ display: 'block', opacity: 0.7, marginTop: '2px' }}>
              {l.category} · {l.district} · ₹{l.price?.toLocaleString('en-IN')}
              {l.rating != null && (
                <> · <Star size={10} style={{ display: 'inline', verticalAlign: '-1px' }} /> {l.rating} ({l.ratingCount})</>
              )}
            </span>
          </Link>
        ))}

        {destinations.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
            {destinations.map(d => (
              <Link
                key={d.slug}
                to={`/destinations/${d.slug}`}
                style={{
                  fontSize: '0.72rem', textDecoration: 'none', color: 'inherit',
                  border: '1px solid var(--border)', borderRadius: '999px',
                  padding: '0.2rem 0.5rem', background: 'var(--bg)',
                }}
              >
                <MapPin size={10} style={{ verticalAlign: '-1px', marginRight: '2px' }} />{d.name}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Open the tourism assistant"
        aria-expanded={open}
        style={{
          position: 'fixed', bottom: '1.5rem', right: '1.5rem',
          width: '56px', height: '56px', borderRadius: '50%',
          backgroundColor: 'var(--accent)', color: 'white',
          border: 'none', cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(0,0,0,0.18)', zIndex: 1000,
          // The drawer covers this corner, so the launcher gets out of the way
          // rather than sitting under it. Closing is the X in the drawer header.
          transform: open ? 'scale(0.6)' : 'scale(1)',
          opacity: open ? 0 : 1,
          pointerEvents: open ? 'none' : 'auto',
          transition: `transform ${DURATION}, opacity ${DURATION}`,
        }}
      >
        <MessageCircle size={26} />
      </button>

      {/* Dimmer. Starts below the header so the top nav stays legible and the
          drawer reads as part of the same shell as the sidebar. */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden="true"
        style={{
          position: 'fixed', top: HEADER_H, left: 0, right: 0, bottom: 0,
          background: 'rgba(16, 24, 40, 0.28)', zIndex: 998,
          opacity: open ? 1 : 0,
          visibility: open ? 'visible' : 'hidden',
          transition: `opacity ${DURATION}, visibility 0s linear ${open ? '0s' : '0.3s'}`,
        }}
      />

      {/* The panel stays mounted so it animates out as well as in — unmounting
          on close would make it vanish instantly. `visibility` is what keeps a
          closed drawer out of the tab order. */}
      <aside
        role="complementary"
        aria-label="Jharkhand Tourism assistant"
        aria-hidden={!open}
        style={{
          position: 'fixed', top: HEADER_H, right: 0, bottom: 0,
          width: 'min(400px, 100vw)',
          backgroundColor: 'var(--bg)',
          borderLeft: '1px solid var(--border)',
          boxShadow: open ? '-8px 0 28px rgba(16, 24, 40, 0.10)' : 'none',
          display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 999,
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          visibility: open ? 'visible' : 'hidden',
          // Same duration and easing as .tourist-sidebar, so the two panels
          // feel like one piece of furniture rather than two widgets.
          transition: `transform ${DURATION}, visibility 0s linear ${open ? '0s' : '0.3s'}`,
        }}
      >
        <div style={{
          padding: '0.85rem 1rem', backgroundColor: 'var(--accent)', color: 'white',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem',
          flexShrink: 0,
        }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Jharkhand Tourism assistant</h3>
            <span style={{ fontSize: '0.68rem', opacity: 0.85 }}>Answers from our real listings</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            {tier && (
              <span style={{ fontSize: '0.65rem', backgroundColor: 'rgba(255,255,255,0.22)', padding: '2px 7px', borderRadius: '999px' }}>
                {tier}
              </span>
            )}
            <button
              onClick={() => setOpen(false)}
              aria-label="Close the tourism assistant"
              style={{
                background: 'none', border: 'none', color: 'white',
                cursor: 'pointer', padding: '0.2rem', display: 'flex',
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

          <div
            ref={scrollRef}
            style={{
              flex: 1, overflowY: 'auto', padding: '0.9rem',
              display: 'flex', flexDirection: 'column', gap: '0.7rem',
              backgroundColor: 'var(--surface-2)',
            }}
          >
            {messages.map((msg, i) => (
              <div key={i} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%' }}>
                <div style={{
                  backgroundColor: msg.role === 'user' ? 'var(--accent)' : 'var(--bg)',
                  color: msg.role === 'user' ? 'white' : 'var(--text)',
                  padding: '0.6rem 0.8rem', borderRadius: '12px',
                  borderBottomRightRadius: msg.role === 'user' ? '2px' : '12px',
                  borderBottomLeftRadius: msg.role === 'assistant' ? '2px' : '12px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                  fontSize: '0.85rem', lineHeight: 1.45, whiteSpace: 'pre-wrap',
                }}>
                  {msg.content}
                </div>
                {msg.role === 'assistant' && <Sources sources={msg.sources} />}
              </div>
            ))}

            {/* Only before the first question — once a conversation is going,
                canned prompts are in the way rather than helpful. */}
            {messages.length === 1 && !loading && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.2rem' }}>
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    style={{
                      fontSize: '0.74rem', padding: '0.3rem 0.6rem', cursor: 'pointer',
                      border: '1px solid var(--border)', borderRadius: '999px',
                      background: 'var(--bg)', color: 'inherit',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {loading && (
              <div style={{
                alignSelf: 'flex-start', backgroundColor: 'var(--bg)',
                padding: '0.6rem 0.8rem', borderRadius: '12px', borderBottomLeftRadius: '2px',
                opacity: 0.7, fontSize: '0.85rem',
              }}>
                {/* The offline model runs on CPU and can take ten seconds or
                    more. An unqualified "Typing..." reads as a hang. */}
                Thinking… this can take a few seconds offline.
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderTop: '1px solid var(--border)', padding: '0.5rem 0.6rem', background: 'var(--bg)' }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask in Hindi or English…"
              style={{ flex: 1, border: 'none', padding: '0.45rem', outline: 'none', fontSize: '0.85rem', background: 'transparent', color: 'inherit' }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Send"
              style={{
                background: 'none', border: 'none', padding: '0.35rem',
                color: 'var(--accent)', cursor: loading || !input.trim() ? 'default' : 'pointer',
                opacity: loading || !input.trim() ? 0.4 : 1,
              }}
            >
              <Send size={18} />
            </button>
          </form>
      </aside>
    </>
  );
};

export default ChatbotWidget;
