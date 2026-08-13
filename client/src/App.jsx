import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, NavLink } from 'react-router-dom';
import axios from 'axios';
import { Mountain, LogOut } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import NotificationBell from './components/NotificationBell';
import ChatbotWidget from './components/ChatbotWidget';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Onboarding from './pages/operator/Onboarding';
import Status from './pages/operator/Status';
import ManageListings from './pages/operator/ManageListings';
import ListingForm from './pages/operator/ListingForm';
import ListingCalendar from './pages/operator/ListingCalendar';
import OperatorBookings from './pages/operator/Bookings';
import OperatorReviews from './pages/operator/Reviews';
import OperatorAnalytics from './pages/operator/Analytics';
import VerificationQueue from './pages/admin/VerificationQueue';
import Settings from './pages/admin/Settings';
import EmailQueue from './pages/admin/EmailQueue';
import AdminAnalytics from './pages/admin/Analytics';
import Explore from './pages/public/Explore';
import ListingDetail from './pages/public/ListingDetail';
import DestinationDetail from './pages/public/DestinationDetail';
import ItineraryPlanner from './pages/public/ItineraryPlanner';
import Home from './pages/public/Home';
import MyBookings from './pages/tourist/MyBookings';
import TouristMessages from './pages/tourist/Messages';
import OperatorMessages from './pages/operator/Messages';
import './index.css';

// Phase 0 connectivity check — kept as a small diagnostics page at /system
const SystemStatus = () => {
  const [health, setHealth] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    axios.get('/api/health')
      .then(res => setHealth({ loading: false, data: res.data, error: null }))
      .catch(err => setHealth({ loading: false, data: null, error: err.message || 'Failed to connect' }));
  }, []);

  const rows = [
    { label: 'Frontend', ok: true, text: 'Online' },
    { label: 'Backend API', ok: !health.error, text: health.error ? 'Offline' : 'Connected' },
    { label: 'Database', ok: health.data?.dbConnection === 'Connected', text: health.data?.dbConnection || 'Unknown' },
  ];

  return (
    <div className="page page--mid">
      <h1 className="page-title">System status</h1>
      <p className="page-sub" style={{ marginBottom: '1.75rem' }}>Connectivity between the client, the API and MongoDB.</p>

      <div className="card stack">
        {rows.map((r, i) => (
          <div key={r.label}>
            {i > 0 && <hr className="divider" />}
            <div className="row-between">
              <span className="strong">{r.label}</span>
              {health.loading
                ? <span className="badge badge-neutral">Checking…</span>
                : <span className={`badge ${r.ok ? 'badge-success' : 'badge-danger'}`}>{r.text}</span>}
            </div>
          </div>
        ))}
      </div>

      {health.error && (
        <div className="alert alert-error" style={{ marginTop: '1.25rem' }}>
          {health.error}. Make sure the backend is running on port 5000.
        </div>
      )}
    </div>
  );
};

const Navigation = () => {
  const { user, logout } = useAuth();

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link to="/" className="brand">
          <span className="brand-mark"><Mountain size={15} /></span>
          Jharkhand Tourism
        </Link>

        <div className="nav-links">
          {/* Explore and the planner are traveller tools. Operators have no use
              for them, and tourists reach them from their own sidebar. */}
          {user?.role !== 'operator' && user?.role !== 'tourist' && (
            <>
              <NavLink to="/explore" className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}>Explore</NavLink>
              <NavLink to="/planner" className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}>AI Planner</NavLink>
            </>
          )}

          {user ? (
            <>
              {/* The bell lives in the shared header rather than in either sidebar,
                  so both sides of the marketplace see it on every page. */}
              <NotificationBell />

              {/* Tourists and operators navigate from their own sidebar, so the
                  same links are deliberately not repeated up here. Admin has no
                  sidebar yet and still needs them. */}
              {user.role === 'admin' && (
                <>
                  <NavLink to="/admin/verification" className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}>Verification</NavLink>
                  <NavLink to="/admin/emails" className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}>Emails</NavLink>
                  <NavLink to="/admin/analytics" className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}>Analytics</NavLink>
                  <NavLink to="/admin/settings" className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}>Settings</NavLink>
                </>
              )}
              {/* Account and sign-out live in the sidebar for tourists and
                  operators; admin gets them here. */}
              {user.role === 'admin' && (
                <>
                  <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}>Account</NavLink>
                  <button onClick={logout} className="btn btn-ghost btn-sm" title="Sign out">
                    <LogOut size={15} />
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <NavLink to="/login" className="nav-link">Sign in</NavLink>
              <Link to="/register" className="btn btn-primary btn-sm">Get started</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};



/**
 * The assistant answers traveller questions — destinations, listings, booking.
 * Operators and admins work in their own portals and would only have a chat
 * bubble sitting on top of their calendar and verification queue, so it follows
 * the same rule the nav already uses for Explore and the planner.
 */
const Assistant = () => {
  const { user } = useAuth();
  if (user?.role === 'operator' || user?.role === 'admin') return null;
  return <ChatbotWidget />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Navigation />

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/explore/:id" element={<ListingDetail />} />
          <Route path="/destinations/:slug" element={<DestinationDetail />} />
          <Route path="/planner" element={<ItineraryPlanner />} />
          <Route path="/system" element={<SystemStatus />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/dashboard" element={
            <ProtectedRoute><Dashboard /></ProtectedRoute>
          } />

          <Route path="/bookings" element={
            <ProtectedRoute allowedRoles={['tourist']}><MyBookings /></ProtectedRoute>
          } />

          <Route path="/messages" element={
            <ProtectedRoute allowedRoles={['tourist']}><TouristMessages /></ProtectedRoute>
          } />
          <Route path="/messages/:id" element={
            <ProtectedRoute allowedRoles={['tourist']}><TouristMessages /></ProtectedRoute>
          } />

          <Route path="/operator/onboarding" element={
            <ProtectedRoute allowedRoles={['operator']}><Onboarding /></ProtectedRoute>
          } />
          <Route path="/operator/status" element={
            <ProtectedRoute allowedRoles={['operator']}><Status /></ProtectedRoute>
          } />
          <Route path="/operator/listings" element={
            <ProtectedRoute allowedRoles={['operator']}><ManageListings /></ProtectedRoute>
          } />
          <Route path="/operator/listings/new" element={
            <ProtectedRoute allowedRoles={['operator']}><ListingForm /></ProtectedRoute>
          } />
          <Route path="/operator/listings/:id/edit" element={
            <ProtectedRoute allowedRoles={['operator']}><ListingForm /></ProtectedRoute>
          } />
          <Route path="/operator/listings/:id/calendar" element={
            <ProtectedRoute allowedRoles={['operator']}><ListingCalendar /></ProtectedRoute>
          } />

          <Route path="/operator/bookings" element={
            <ProtectedRoute allowedRoles={['operator']}><OperatorBookings /></ProtectedRoute>
          } />
          <Route path="/operator/messages" element={
            <ProtectedRoute allowedRoles={['operator']}><OperatorMessages /></ProtectedRoute>
          } />
          <Route path="/operator/messages/:id" element={
            <ProtectedRoute allowedRoles={['operator']}><OperatorMessages /></ProtectedRoute>
          } />
          <Route path="/operator/reviews" element={
            <ProtectedRoute allowedRoles={['operator']}><OperatorReviews /></ProtectedRoute>
          } />
          <Route path="/operator/analytics" element={
            <ProtectedRoute allowedRoles={['operator']}><OperatorAnalytics /></ProtectedRoute>
          } />

          <Route path="/admin/verification" element={
            <ProtectedRoute allowedRoles={['admin']}><VerificationQueue /></ProtectedRoute>
          } />
          <Route path="/admin/emails" element={
            <ProtectedRoute allowedRoles={['admin']}><EmailQueue /></ProtectedRoute>
          } />
          <Route path="/admin/analytics" element={
            <ProtectedRoute allowedRoles={['admin']}><AdminAnalytics /></ProtectedRoute>
          } />
          <Route path="/admin/settings" element={
            <ProtectedRoute allowedRoles={['admin']}><Settings /></ProtectedRoute>
          } />
        </Routes>

        <Assistant />
      </Router>
    </AuthProvider>
  );
}

export default App;
