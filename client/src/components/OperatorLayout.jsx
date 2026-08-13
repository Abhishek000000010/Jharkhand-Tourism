import { NavLink } from 'react-router-dom';
import { Home, List, Calendar, Star, BarChart2, MessageSquare, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUnreadMessages } from '../hooks/useUnreadMessages';

const OperatorLayout = ({ children, fluid = false }) => {
  const { logout } = useAuth();
  const unread = useUnreadMessages();

  return (
    <div className="tourist-layout">
      <aside className="tourist-sidebar">
        <div className="sidebar-links">
          <NavLink to="/operator/analytics" className={({ isActive }) => `side-link ${isActive ? 'is-active' : ''}`}>
            <BarChart2 size={20} /> <span className="side-label">Analytics</span>
          </NavLink>
          <NavLink to="/operator/listings" className={({ isActive }) => `side-link ${isActive ? 'is-active' : ''}`}>
            <List size={20} /> <span className="side-label">Listings</span>
          </NavLink>
          <NavLink to="/operator/bookings" className={({ isActive }) => `side-link ${isActive ? 'is-active' : ''}`}>
            <Calendar size={20} /> <span className="side-label">Bookings</span>
          </NavLink>
          <NavLink to="/operator/messages" className={({ isActive }) => `side-link ${isActive ? 'is-active' : ''}`}>
            <MessageSquare size={20} /> <span className="side-label">Messages</span>
            {unread > 0 && <span className="side-badge">{unread}</span>}
          </NavLink>
          <NavLink to="/operator/reviews" className={({ isActive }) => `side-link ${isActive ? 'is-active' : ''}`}>
            <Star size={20} /> <span className="side-label">Reviews</span>
          </NavLink>
          <NavLink to="/dashboard" end className={({ isActive }) => `side-link ${isActive ? 'is-active' : ''}`}>
            <Home size={20} /> <span className="side-label">Account</span>
          </NavLink>
        </div>
        
        <div className="sidebar-footer">
          <button onClick={logout} className="side-link btn-ghost">
            <LogOut size={20} /> <span className="side-label">Sign out</span>
          </button>
        </div>
      </aside>
      
      <main className="tourist-main" style={fluid ? { padding: 0 } : {}}>
        <div style={fluid ? { maxWidth: '100%', margin: '0 auto' } : { maxWidth: '1000px', margin: '0 auto' }}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default OperatorLayout;
