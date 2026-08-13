import { useState, useEffect } from 'react';
import axios from 'axios';
import { Star, MessageCircle } from 'lucide-react';
import OperatorLayout from '../../components/OperatorLayout';

const OperatorReviews = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      const res = await axios.get('/api/reviews/operator');
      setReviews(res.data.reviews);
    } catch (err) {
      setError('Could not load reviews.');
    } finally {
      setLoading(false);
    }
  };

  const handleReplySubmit = async (e, reviewId) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    try {
      const res = await axios.post(`/api/reviews/${reviewId}/reply`, { reply: replyText });
      setReviews(prev => prev.map(r => r._id === reviewId ? { ...r, operatorReply: res.data.review.operatorReply } : r));
      setReplyingTo(null);
      setReplyText('');
    } catch (err) {
      alert(err.response?.data?.message || 'Could not send reply');
    }
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <Star key={i} size={16} fill={i < rating ? '#FFD700' : 'none'} color={i < rating ? '#FFD700' : '#ccc'} />
    ));
  };

  if (loading) return (
    <OperatorLayout>
      <div className="page page--mid"><div className="muted">Loading reviews...</div></div>
    </OperatorLayout>
  );
  
  if (error) return (
    <OperatorLayout>
      <div className="page page--mid"><div className="alert alert-error">{error}</div></div>
    </OperatorLayout>
  );

  return (
    <OperatorLayout>
      <div className="page page--mid">
        <h1 className="page-title">Reviews on your listings</h1>
      <p className="page-sub" style={{ marginBottom: '2rem' }}>
        See what tourists are saying and reply to their feedback.
      </p>

      {reviews.length === 0 ? (
        <div className="card card--muted">
          <p>You don't have any reviews yet. Complete some bookings to get feedback!</p>
        </div>
      ) : (
        <div className="stack">
          {reviews.map(review => (
            <div key={review._id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: '0 0 0.5rem 0' }}>{review.listing?.title}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex' }}>{renderStars(review.rating)}</div>
                    <span className="hint">by {review.tourist?.name} on {new Date(review.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p style={{ fontStyle: 'italic', margin: '0 0 1rem 0' }}>"{review.comment}"</p>
                </div>
              </div>

              {review.operatorReply ? (
                <div style={{ backgroundColor: '#f8f9fa', padding: '1rem', borderRadius: '4px', borderLeft: '3px solid var(--color-primary)' }}>
                  <p style={{ margin: '0 0 0.5rem 0', fontWeight: '600', fontSize: '0.9rem' }}>Your Reply:</p>
                  <p style={{ margin: 0, fontSize: '0.9rem' }}>{review.operatorReply}</p>
                </div>
              ) : (
                replyingTo === review._id ? (
                  <form onSubmit={(e) => handleReplySubmit(e, review._id)} style={{ marginTop: '1rem' }}>
                    <textarea 
                      className="textarea" 
                      rows="3" 
                      placeholder="Write your public reply..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      required
                      autoFocus
                    />
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                      <button type="submit" className="btn btn-primary btn-sm">Post Reply</button>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => { setReplyingTo(null); setReplyText(''); }}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <button onClick={() => setReplyingTo(review._id)} className="btn btn-outline btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <MessageCircle size={14} /> Reply
                  </button>
                )
              )}
            </div>
          ))}
        </div>
      )}
      </div>
    </OperatorLayout>
  );
};

export default OperatorReviews;
