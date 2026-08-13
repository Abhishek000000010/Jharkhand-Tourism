import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

import DistrictSelect from '../../components/DistrictSelect';

const Onboarding = () => {
  const [formData, setFormData] = useState({ businessName: '', contactPhone: '', district: 'Ranchi' });
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get('/api/operator/profile')
      .then(res => {
        const profile = res.data.profile;
        if (!profile) return;
        if (profile.status !== 'rejected') {
          navigate('/operator/status');
        } else {
          // Pre-fill so a rejected operator can correct and resubmit
          setFormData({
            businessName: profile.businessName,
            contactPhone: profile.contactPhone,
            district: profile.district,
          });
        }
      })
      .catch(() => { /* 404 simply means no profile yet */ });
  }, [navigate]);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return setError('Please attach a KYC document');

    setLoading(true);
    setError(null);

    const data = new FormData();
    data.append('businessName', formData.businessName);
    data.append('contactPhone', formData.contactPhone);
    data.append('district', formData.district);
    data.append('kycDocument', file);

    try {
      await axios.post('/api/operator/profile', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      navigate('/operator/status');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not submit your profile');
      setLoading(false);
    }
  };

  return (
    <div className="page page--narrow">
      <h1 className="page-title">Operator onboarding</h1>
      <p className="page-sub" style={{ marginBottom: '1.75rem' }}>
        The tourism department verifies every operator before listings go live.
      </p>

      {error && <div className="alert alert-error" style={{ marginBottom: '1.25rem' }}>{error}</div>}

      <form onSubmit={handleSubmit} className="stack">
        <div className="field">
          <label className="label" htmlFor="businessName">Business name</label>
          <input id="businessName" className="input" name="businessName" value={formData.businessName}
            onChange={handleChange} required placeholder="Netarhat Valley Stays" />
        </div>

        <div className="field">
          <label className="label" htmlFor="contactPhone">Contact phone</label>
          <input id="contactPhone" className="input" name="contactPhone" value={formData.contactPhone}
            onChange={handleChange} required placeholder="9835012345" inputMode="numeric" />
          <span className="hint">10-digit Indian mobile number. One number per operator.</span>
        </div>

        <div className="field">
          <label className="label" htmlFor="district">District</label>
          <DistrictSelect id="district" name="district" value={formData.district} onChange={handleChange} />
        </div>

        <div className="field">
          <label className="label">KYC document</label>
          <div className="file-drop">
            <input type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files[0])} />
            <p className="hint" style={{ marginTop: '0.6rem' }}>
              {file ? file.name : 'Aadhaar or trade licence — JPG, PNG or PDF'}
            </p>
          </div>
          <span className="hint">Stored privately. Only the verifying officer can open it.</span>
        </div>

        <button type="submit" className="btn btn-primary btn-block" disabled={loading} style={{ marginTop: '0.25rem' }}>
          {loading ? 'Submitting…' : 'Submit for verification'}
        </button>
      </form>
    </div>
  );
};

export default Onboarding;
