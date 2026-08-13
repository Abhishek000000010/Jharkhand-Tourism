import { NavLink } from 'react-router-dom';
import { Home, Briefcase, Heart, Map, MessageSquare, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUnreadMessages } from '../hooks/useUnreadMessages';

const TouristLayout = ({ children, fluid = false }) => {
  const { logout } = useAuth();
  const unread = useUnreadMessages();

  return (
    <div className="tourist-layout">
      <aside className="tourist-sidebar">
        <div className="sidebar-links">
          <NavLink to="/dashboard" end className={({ isActive }) => `side-link ${isActive ? 'is-active' : ''}`}>
            <Home size={20} /> <span className="side-label">Overview</span>
          </NavLink>
          <NavLink to="/bookings" className={({ isActive }) => `side-link ${isActive ? 'is-active' : ''}`}>
            <Briefcase size={20} /> <span className="side-label">My Bookings</span>
          </NavLink>
          <NavLink to="/messages" className={({ isActive }) => `side-link ${isActive ? 'is-active' : ''}`}>
            <MessageSquare size={20} /> <span className="side-label">Messages</span>
            {unread > 0 && <span className="side-badge">{unread}</span>}
          </NavLink>
          {/* Favorites/Settings not yet implemented, link to explore and planner as placeholders */}
          <NavLink to="/explore" className={({ isActive }) => `side-link ${isActive ? 'is-active' : ''}`}>
            <Map size={20} /> <span className="side-label">Explore Jharkhand</span>
          </NavLink>
          <NavLink to="/planner" className={({ isActive }) => `side-link ${isActive ? 'is-active' : ''}`}>
            <Heart size={20} /> <span className="side-label">AI Planner</span>
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

export default TouristLayout;
