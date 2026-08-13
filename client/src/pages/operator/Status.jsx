import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import OperatorLayout from '../../components/OperatorLayout';

const Status = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get('/api/operator/profile')
      .then(res => setProfile(res.data.profile))
      .catch(err => { if (err.response?.status === 404) navigate('/operator/onboarding'); })
      .finally(() => setLoading(false));
  }, [navigate]);

  if (loading) return (
    <OperatorLayout>
      <div className="page page--mid"><div className="muted">Loading...</div></div>
    </OperatorLayout>
  );
  if (!profile) return null;

  const views = {
    pending: {
      icon: <Clock size={22} />, badge: 'badge-warning', label: 'Under review',
      title: 'Application under review',
      body: 'Your documents are with the tourism department. This usually takes 1–2 working days. You can start building listings now — they stay hidden until you are approved.',
      action: <Link to="/operator/listings" className="btn btn-secondary">Prepare listings</Link>,
    },
    approved: {
      icon: <CheckCircle2 size={22} />, badge: 'badge-success', label: 'Approved',
      title: 'You are verified',
      body: 'Your listings are now visible to travellers across the platform.',
      action: <Link to="/operator/listings" className="btn btn-primary">Manage listings</Link>,
    },
    rejected: {
      icon: <AlertCircle size={22} />, badge: 'badge-danger', label: 'Rejected',
      title: 'Application not approved',
      body: profile.rejectionReason,
      action: <Link to="/operator/onboarding" className="btn btn-primary">Update and resubmit</Link>,
    },
  };

  const v = views[profile.status];

  return (
    <OperatorLayout>
      <div className="page page--mid">
        <h1 className="page-title">Verification status</h1>
        <p className="page-sub" style={{ marginBottom: '1.75rem' }}>Your standing with the Department of Tourism.</p>

      <div className="card">
        <div className="row-between" style={{ marginBottom: '1rem' }}>
          <div className="row" style={{ color: 'var(--text-muted)' }}>{v.icon}<h2>{v.title}</h2></div>
          <span className={`badge ${v.badge}`}>{v.label}</span>
        </div>

        <p className="muted">{v.body}</p>

        <hr className="divider" />

        <div className="spec-grid">
          <div><div className="spec-label">Business</div><div className="spec-value">{profile.businessName}</div></div>
          <div><div className="spec-label">Phone</div><div className="spec-value">{profile.contactPhone}</div></div>
          <div><div className="spec-label">District</div><div className="spec-value">{profile.district}</div></div>
        </div>

        <div style={{ marginTop: '1.5rem' }}>{v.action}</div>
      </div>
      </div>
    </OperatorLayout>
  );
};

export default Status;
