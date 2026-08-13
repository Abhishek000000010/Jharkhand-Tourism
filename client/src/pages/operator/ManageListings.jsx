import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Plus, Pencil, Trash2, Eye, EyeOff, CalendarDays } from 'lucide-react';
import SafeImage from '../../components/SafeImage';
import OperatorLayout from '../../components/OperatorLayout';

const UNIT = { homestay: '/ night', guide: '/ day', artisan: '' };

const ManageListings = () => {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [opStatus, setOpStatus] = useState(null);
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const profileRes = await axios.get('/api/operator/profile');
      setOpStatus(profileRes.data.profile.status);
    } catch (err) {
      // No profile yet means onboarding is incomplete
      if (err.response?.status === 404) {
        navigate('/operator/onboarding');
        return;
      }
    }

    try {
      const res = await axios.get('/api/operator/listings');
      setListings(res.data.listings);
    } catch {
      setListings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleActive = async (id, current) => {
    try {
      await axios.put(`/api/operator/listings/${id}`, { isActive: !current });
      fetchData();
    } catch {
      alert('Could not update listing');
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this listing permanently?')) return;
    try {
      await axios.delete(`/api/operator/listings/${id}`);
      fetchData();
    } catch {
      alert('Could not delete listing');
    }
  };

  if (loading) return (
    <OperatorLayout>
      <div className="page page--mid"><div className="muted">Loading...</div></div>
    </OperatorLayout>
  );

  return (
    <OperatorLayout>
      <div className="page">
        <div className="row-between" style={{ alignItems: 'flex-start', marginBottom: '2rem' }}>
          <div>
          <h1 className="page-title">My listings</h1>
          <p className="page-sub">What you offer on the platform.</p>
        </div>
        <Link to="/operator/listings/new" className="btn btn-primary">
          <Plus size={16} /> New listing
        </Link>
      </div>

      {opStatus && opStatus !== 'approved' && (
        <div className="alert alert-warning" style={{ marginBottom: '1.75rem' }}>
          <div>
            Your operator profile is <strong>{opStatus}</strong>. You can build listings now,
            but they stay hidden from travellers until the tourism department approves you.
          </div>
        </div>
      )}

      {listings.length === 0 ? (
        <div className="empty">
          <h3>Nothing listed yet</h3>
          <p className="muted" style={{ marginBottom: '1.25rem' }}>Add your first homestay, guiding service or craft.</p>
          <Link to="/operator/listings/new" className="btn btn-primary"><Plus size={16} /> New listing</Link>
        </div>
      ) : (
        <div className="grid-cards">
          {listings.map(l => (
            <div className="card card--flush" key={l._id} style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="thumb">
                {l.images?.length > 0
                  ? <SafeImage src={l.images[0]} alt={l.title} label={l.title} />
                  : <div className="thumb-empty">No photo</div>}
              </div>

              <div style={{ padding: '1.1rem 1.15rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div className="row-between" style={{ marginBottom: '0.6rem' }}>
                  <span className="chip">{l.category}</span>
                  <span className={`badge ${l.isActive ? 'badge-success' : 'badge-neutral'}`}>
                    {l.isActive ? 'Visible' : 'Hidden'}
                  </span>
                </div>

                <h3 style={{ marginBottom: '0.25rem' }}>{l.title}</h3>
                <p className="small muted" style={{ marginBottom: '0.85rem' }}>{l.district}</p>

                <div className="price" style={{ fontSize: '1.05rem', marginBottom: '1rem' }}>
                  ₹{l.price.toLocaleString('en-IN')}
                  <span className="price-unit"> {UNIT[l.category]}</span>
                </div>

                <div className="row-between" style={{ marginTop: 'auto', paddingTop: '0.9rem', borderTop: '1px solid var(--border)' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(l._id, l.isActive)}>
                    {l.isActive ? <><EyeOff size={15} /> Hide</> : <><Eye size={15} /> Show</>}
                  </button>

                  <div className="row" style={{ gap: '0.35rem' }}>
                    {l.category !== 'artisan' && (
                      <Link to={`/operator/listings/${l._id}/calendar`} className="btn-icon" title="Availability calendar">
                        <CalendarDays size={15} />
                      </Link>
                    )}
                    <Link to={`/operator/listings/${l._id}/edit`} className="btn-icon" title="Edit listing">
                      <Pencil size={15} />
                    </Link>
                    <button className="btn-icon btn-icon--danger" onClick={() => remove(l._id)} title="Delete listing">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </OperatorLayout>
  );
};

export default ManageListings;
