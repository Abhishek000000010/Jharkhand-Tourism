import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to sign in');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div 
        className="auth-image-wrapper" 
        style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1448375240586-882707db888b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80")' }}
      >
        <div className="auth-quote">
          <p>"The journey of a thousand miles begins with a single step into the lush forests of Jharkhand."</p>
          <span>— Explore the Unexplored</span>
        </div>
      </div>
      <div className="auth-form-wrapper">
        <h1 className="page-title">Welcome back</h1>
        <p className="page-sub" style={{ marginBottom: '1.75rem' }}>Sign in to manage your trips and listings.</p>

        {error && <div className="alert alert-error" style={{ marginBottom: '1.25rem' }}>{error}</div>}

        <form onSubmit={handleSubmit} className="stack">
          <div className="field">
            <label className="label" htmlFor="email">Email</label>
            <input id="email" className="input" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" />
          </div>

          <div className="field">
            <label className="label" htmlFor="password">Password</label>
            <input id="password" className="input" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" placeholder="••••••••" />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={busy} style={{ marginTop: '0.25rem' }}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="small muted center" style={{ marginTop: '1.5rem' }}>
          Don't have an account? <Link to="/register" className="link-accent">Create one</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
