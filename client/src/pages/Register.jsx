import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Register = () => {
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'tourist' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register(formData);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to register');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div 
        className="auth-image-wrapper" 
        style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1511497584788-876760111969?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80")' }}
      >
        <div className="auth-quote">
          <p>"Join the community of explorers and hosts showcasing the beauty of Jharkhand."</p>
          <span>— Experience the Magic</span>
        </div>
      </div>
      <div className="auth-form-wrapper">
        <h1 className="page-title">Create an account</h1>
        <p className="page-sub" style={{ marginBottom: '1.75rem' }}>Book trips, or list your homestay, guiding or craft.</p>

        {error && <div className="alert alert-error" style={{ marginBottom: '1.25rem' }}>{error}</div>}

        <form onSubmit={handleSubmit} className="stack">
          <div className="field">
            <label className="label" htmlFor="name">Full name</label>
            <input id="name" className="input" type="text" name="name" value={formData.name}
              onChange={handleChange} required autoComplete="name" placeholder="John Doe" />
          </div>

          <div className="field">
            <label className="label" htmlFor="email">Email</label>
            <input id="email" className="input" type="email" name="email" value={formData.email}
              onChange={handleChange} required autoComplete="email" placeholder="you@example.com" />
          </div>

          <div className="field">
            <label className="label" htmlFor="password">Password</label>
            <input id="password" className="input" type="password" name="password" value={formData.password}
              onChange={handleChange} required minLength="6" autoComplete="new-password" placeholder="••••••••" />
            <span className="hint">At least 6 characters.</span>
          </div>

          <div className="field">
            <label className="label" htmlFor="role">I am a</label>
            <select id="role" className="select" name="role" value={formData.role} onChange={handleChange}>
              <option value="tourist">Tourist — booking trips</option>
              <option value="operator">Operator — hosting, guiding or selling crafts</option>
            </select>
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={busy} style={{ marginTop: '0.25rem' }}>
            {busy ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="small muted center" style={{ marginTop: '1.5rem' }}>
          Already registered? <Link to="/login" className="link-accent">Sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
