import { useState, useEffect } from 'react';
import axios from 'axios';

const Settings = () => {
  const [percent, setPercent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios.get('/api/admin/settings')
      .then(res => setPercent(String(res.data.settings.commissionPercent)))
      .catch(() => setError('Could not load settings'))
      .finally(() => setLoading(false));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await axios.put('/api/admin/settings', { commissionPercent: Number(percent) });
      setMessage(`Commission set to ${res.data.settings.commissionPercent}%.`);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading">Loading settings…</div>;

  const pct = Number(percent) || 0;
  const example = 200000; // ₹2,000 booking, in paise
  const commission = Math.round((example * pct) / 100);

  return (
    <div className="page page--mid">
      <h1 className="page-title">Platform settings</h1>
      <p className="page-sub" style={{ marginBottom: '1.75rem' }}>
        Commission the department retains on each booking.
      </p>

      {error && <div className="alert alert-error" style={{ marginBottom: '1.25rem' }}>{error}</div>}
      {message && <div className="alert alert-success" style={{ marginBottom: '1.25rem' }}>{message}</div>}

      <form onSubmit={save} className="card stack">
        <div className="field">
          <label className="label" htmlFor="commission">Commission rate (%)</label>
          <input id="commission" className="input" type="number" min="0" max="50" step="0.5"
            value={percent} onChange={(e) => setPercent(e.target.value)} required />
          <span className="hint">Between 0 and 50 percent.</span>
        </div>

        <div className="card card--muted">
          <div className="spec-label" style={{ marginBottom: '0.6rem' }}>On a ₹2,000 booking</div>
          <div className="row-between small">
            <span className="muted">Platform commission</span>
            <span className="strong">₹{(commission / 100).toLocaleString('en-IN')}</span>
          </div>
          <div className="row-between small" style={{ marginTop: '0.35rem' }}>
            <span className="muted">Operator receives</span>
            <span className="strong">₹{((example - commission) / 100).toLocaleString('en-IN')}</span>
          </div>
        </div>

        <div className="alert alert-info">
          Changing this only affects future bookings. Every booking stores the rate it was
          created under, so operators are never paid differently from what they agreed.
        </div>

        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </form>
    </div>
  );
};

export default Settings;
