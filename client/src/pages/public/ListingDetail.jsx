import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { MapPin, ArrowLeft, Star, MessageSquare } from 'lucide-react';
import BookingWidget from '../../components/BookingWidget';
import SafeImage from '../../components/SafeImage';
import { useAuth } from '../../context/AuthContext';
import TouristLayout from '../../components/TouristLayout';

const Spec = ({ label, children }) => (
  <div>
    <div className="spec-label">{label}</div>
    <div className="spec-value">{children}</div>
  </div>
);

const ListingDetail = () => {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contacting, setContacting] = useState(false);
  const [contactError, setContactError] = useState(null);

  // The endpoint is an upsert, so coming back here later reopens the same thread
  // rather than starting a second one alongside it.
  const startEnquiry = async () => {
    setContacting(true);
    setContactError(null);
    try {
      const res = await axios.post('/api/messages/conversations', { listingId: id });
      navigate(`/messages/${res.data.conversation._id}`);
    } catch (err) {
      setContactError(err.response?.data?.message || 'Could not open a conversation');
      setContacting(false);
    }
  };

  useEffect(() => {
    Promise.all([
      axios.get(`/api/public/listings/${id}`),
      axios.get(`/api/reviews/listing/${id}`).catch(() => ({ data: { reviews: [] } }))
    ])
      .then(([listingRes, reviewsRes]) => {
        setListing(listingRes.data.listing);
        setReviews(reviewsRes.data.reviews || []);
      })
      .catch(err => setError(err.response?.data?.message || 'Failed to load listing'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="loading">Loading…</div>;

  if (error) {
    return (
      <div className="page page--mid">
        <div className="empty">
          <h3>Listing unavailable</h3>
          <p className="muted" style={{ marginBottom: '1.25rem' }}>{error}</p>
          <Link to="/explore" className="btn btn-secondary">Back to explore</Link>
        </div>
      </div>
    );
  }

  if (!listing) return null;

  const images = listing.images || [];
  
  const avgRating = listing.ratingCount > 0 ? (listing.ratingSum / listing.ratingCount).toFixed(1) : null;

  const renderStars = (rating) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <Star key={i} size={14} fill={i < Math.round(rating) ? '#FFD700' : 'none'} color={i < Math.round(rating) ? '#FFD700' : '#ccc'} />
    ));
  };

  const content = (
    <div className="page">
      <Link to="/explore" className="link-back"><ArrowLeft size={15} /> All listings</Link>

      <div style={{ marginBottom: '1.75rem' }}>
        <div className="row" style={{ marginBottom: '0.6rem' }}>
          <span className="chip">{listing.category}</span>
          <span className="row small muted" style={{ gap: '0.3rem' }}>
            <MapPin size={14} /> {listing.district}
          </span>
          {avgRating && (
            <span className="row small strong" style={{ gap: '0.3rem', marginLeft: '0.5rem' }}>
              <Star size={14} fill="#FFD700" color="#FFD700" /> {avgRating} ({listing.ratingCount} {listing.ratingCount === 1 ? 'review' : 'reviews'})
            </span>
          )}
        </div>
        <h1 style={{ marginBottom: '0.35rem' }}>{listing.title}</h1>
        <p className="muted">Operated by {listing.operatorDetails?.businessName}</p>
      </div>

      {images.length > 0 && (
        <div className="gallery">
          <div><SafeImage src={images[0]} alt={listing.title} label={listing.title} /></div>
          {images.length > 1 && (
            <div className="gallery-side" style={{ background: 'transparent' }}>
              {images.slice(1, 3).map((img, i) => (
                <div key={i}><SafeImage src={img} alt={`View ${i + 2}`} /></div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="detail-grid">
        <div className="stack-lg">
          <section>
            <h2 style={{ marginBottom: '0.75rem' }}>About</h2>
            <p className="muted" style={{ whiteSpace: 'pre-line' }}>{listing.description}</p>
          </section>

          <section>
            <h2 style={{ marginBottom: '1rem' }}>Details</h2>
            <div className="card spec-grid">
              {listing.category === 'homestay' && (
                <>
                  <Spec label="Rooms">{listing.rooms} available</Spec>
                  <Spec label="Amenities">
                    <div className="tag-list">
                      {listing.amenities?.length
                        ? listing.amenities.map((a, i) => <span className="chip" key={i}>{a}</span>)
                        : <span className="muted">Not listed</span>}
                    </div>
                  </Spec>
                </>
              )}

              {listing.category === 'guide' && (
                <>
                  <Spec label="Service area">{listing.serviceArea || 'Not listed'}</Spec>
                  <Spec label="Languages">
                    <div className="tag-list">
                      {listing.languages?.map((l, i) => <span className="chip" key={i}>{l}</span>)}
                    </div>
                  </Spec>
                  <Spec label="Specialities">
                    <div className="tag-list">
                      {listing.specialities?.length
                        ? listing.specialities.map((s, i) => <span className="chip" key={i}>{s}</span>)
                        : <span className="muted">Not listed</span>}
                    </div>
                  </Spec>
                </>
              )}

              {listing.category === 'artisan' && (
                <>
                  <Spec label="Craft">{listing.craftType}</Spec>
                  <Spec label="In stock">{listing.stockQuantity} items</Spec>
                </>
              )}
            </div>
          </section>

          <section>
            <h2 style={{ marginBottom: '1rem' }}>Operator</h2>
            <div className="card">
              <div className="strong">{listing.operatorDetails?.businessName}</div>
              <div className="muted small">{listing.operatorDetails?.district} district</div>
              <hr className="divider" />
              <p className="small muted">
                Verified by the Jharkhand Department of Tourism. Contact details are shared
                once your booking is confirmed.
              </p>

              {/* Asking before booking is the whole point — a traveller should not
                  have to pay first to find out whether there is parking. */}
              <div style={{ marginTop: '1rem' }}>
                {user?.role === 'tourist' ? (
                  <>
                    <button className="btn btn-secondary btn-block" onClick={startEnquiry} disabled={contacting}>
                      <MessageSquare size={15} /> {contacting ? 'Opening…' : 'Message host'}
                    </button>
                    {contactError && (
                      <p className="tiny" style={{ color: 'var(--danger)', marginTop: '0.5rem' }}>{contactError}</p>
                    )}
                  </>
                ) : !user ? (
                  <Link to="/login" className="btn btn-secondary btn-block">
                    <MessageSquare size={15} /> Sign in to message the host
                  </Link>
                ) : null}
              </div>
            </div>
          </section>

          <section>
            <h2 style={{ marginBottom: '1rem' }}>Reviews</h2>
            {reviews.length === 0 ? (
              <div className="card card--muted">
                <p>No reviews yet.</p>
              </div>
            ) : (
              <div className="stack">
                {reviews.map(review => (
                  <div key={review._id} className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <div className="strong">{review.tourist?.name}</div>
                      <span className="muted tiny">• {new Date(review.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div style={{ display: 'flex', marginBottom: '0.5rem' }}>
                      {renderStars(review.rating)}
                    </div>
                    <p style={{ margin: 0 }}>{review.comment}</p>
                    
                    {review.operatorReply && (
                      <div style={{ marginTop: '1rem', backgroundColor: '#f8f9fa', padding: '0.75rem', borderRadius: '4px', borderLeft: '3px solid var(--color-primary)' }}>
                        <div className="small strong" style={{ marginBottom: '0.25rem' }}>Response from {listing.operatorDetails?.businessName}</div>
                        <p className="small" style={{ margin: 0 }}>{review.operatorReply}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="sticky-panel">
          <BookingWidget listing={listing} />
        </div>
      </div>
    </div>
  );

  return user?.role === 'tourist' ? <TouristLayout>{content}</TouristLayout> : content;
};

export default ListingDetail;
