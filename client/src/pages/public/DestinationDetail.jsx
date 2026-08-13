import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { MapPin, CalendarDays, Route, ArrowLeft, ExternalLink } from 'lucide-react';
import SafeImage from '../../components/SafeImage';
import DestinationMap from '../../components/DestinationMap';
import { useAuth } from '../../context/AuthContext';
import TouristLayout from '../../components/TouristLayout';

const TYPE_LABELS = {
  waterfall: 'Waterfall', temple: 'Temple & shrine', dam: 'Dam & reservoir',
  park: 'Park & garden', wildlife: 'Wildlife & nature', hill: 'Hill & valley',
  lake: 'Lake', fort: 'Fort & palace', museum: 'Museum & memorial',
  heritage: 'Heritage site', city: 'Town & city', other: 'Place of interest',
};

const UNIT = { homestay: '/ night', guide: '/ day', artisan: '' };

const DestinationDetail = () => {
  const { slug } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    axios.get(`/api/public/destinations/${slug}`)
      .then(res => { setData(res.data); setError(null); })
      .catch(() => setError('That destination could not be found.'))
      .finally(() => setLoading(false));
  }, [slug]);

  let content;
  if (loading) {
    content = <div className="page page--mid"><div className="loading">Loading destination…</div></div>;
  } else if (error) {
    content = (
      <div className="page page--mid">
        <div className="empty">
          <h3>Not found</h3>
          <p className="muted" style={{ marginBottom: '1.25rem' }}>{error}</p>
          <Link to="/explore" className="btn btn-secondary">Back to Explore</Link>
        </div>
      </div>
    );
  } else {
    const { destination: d, nearbyListings = [] } = data;
    content = (
      <div className="page page--mid">
        <Link to="/explore" className="btn btn-ghost btn-sm" style={{ marginBottom: '1rem' }}>
          <ArrowLeft size={15} /> All destinations
        </Link>

        <div className="thumb" style={{ borderRadius: 'var(--radius-lg)', aspectRatio: '16 / 9', marginBottom: '1.5rem' }}>
          <SafeImage src={d.images?.[0]} alt={d.name} label={d.name} />
        </div>

        <span className="chip">{TYPE_LABELS[d.type] || d.type}</span>
        <h1 className="page-title" style={{ marginTop: '0.6rem' }}>{d.name}</h1>
        <div className="row small muted" style={{ gap: '0.35rem', marginBottom: '1.5rem' }}>
          <MapPin size={15} /> {d.district} district, Jharkhand
        </div>

        <div className="card stack" style={{ marginBottom: '1.5rem' }}>
          <p style={{ lineHeight: 1.65 }}>{d.description}</p>
          <hr className="divider" />
          <div className="row small" style={{ gap: '0.45rem' }}>
            <CalendarDays size={15} /> <strong>Best time:</strong> {d.bestSeason}
          </div>
          <div className="row small" style={{ gap: '0.45rem', alignItems: 'flex-start' }}>
            <Route size={15} style={{ marginTop: '2px', flexShrink: 0 }} />
            <span><strong>Getting there:</strong> {d.howToReach}</span>
          </div>
          {d.sourceUrl && (
            <a className="small muted" href={d.sourceUrl} target="_blank" rel="noreferrer noopener">
              Source: Wikipedia <ExternalLink size={12} style={{ display: 'inline' }} />
            </a>
          )}
        </div>

        {d.coordinates?.lat && (
          <div style={{ height: '320px', marginBottom: '2rem' }}>
            <DestinationMap items={[d]} kind="destination" />
          </div>
        )}

        <h2 style={{ marginBottom: '0.4rem' }}>Where to stay and who to go with</h2>
        <p className="page-sub" style={{ marginBottom: '1.25rem' }}>
          Verified operators in {d.district}.
        </p>

        {nearbyListings.length === 0 ? (
          <div className="empty">
            <h3>No verified operators here yet</h3>
            <p className="muted">
              We are onboarding homestays and guides in {d.district}. Browse listings elsewhere in the state meanwhile.
            </p>
          </div>
        ) : (
          <div className="grid-cards">
            {nearbyListings.map(l => (
              <Link to={`/explore/${l._id}`} key={l._id} className="dest-card">
                <div className="thumb">
                  <SafeImage src={l.images?.[0]} alt={l.title} label={l.title} />
                </div>
                <div className="card-body">
                  <span className="chip" style={{ alignSelf: 'flex-start', marginBottom: '0.5rem' }}>{l.category}</span>
                  <h3>{l.title}</h3>
                  <span className="price" style={{ marginTop: '0.5rem' }}>
                    ₹{l.price?.toLocaleString('en-IN')}
                    <span className="price-unit"> {UNIT[l.category]}</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return user?.role === 'tourist' ? <TouristLayout>{content}</TouristLayout> : content;
};

export default DestinationDetail;
