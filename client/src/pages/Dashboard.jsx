import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import TouristLayout from '../components/TouristLayout';
import TouristDashboard from './tourist/TouristDashboard';
import OperatorLayout from '../components/OperatorLayout';

const LINKS = {
  operator: [
    { to: '/operator/listings', title: 'My listings', desc: 'Create and manage what you offer' },
    { to: '/operator/bookings', title: 'Bookings & earnings', desc: 'Reservations, commission and payouts' },
    { to: '/operator/status', title: 'Verification status', desc: 'Track your approval with the department' },
  ],
  admin: [
    { to: '/admin/verification', title: 'Verification queue', desc: 'Review and approve operator applications' },
    { to: '/admin/settings', title: 'Platform settings', desc: 'Commission the department retains' },
  ],
};

const Dashboard = () => {
  const { user } = useAuth();
  
  if (user?.role === 'tourist') {
    // Fluid, like the operator analytics page — a six-tile KPI row and a 12
    // column bento grid do not fit the 1000px reading column the other tourist
    // pages use.
    return (
      <TouristLayout fluid>
        <div className="page-fluid">
          <TouristDashboard />
        </div>
      </TouristLayout>
    );
  }

  const links = LINKS[user?.role] || [];

  const dashboardContent = (
    <div className="page page--mid">
      <h1 className="page-title">Hello, {user?.name}</h1>
      <p className="page-sub">{user?.email}</p>

      <div className="card card--muted" style={{ margin: '1.75rem 0' }}>
        <div className="row-between">
          <div>
            <div className="spec-label">Account type</div>
            <div className="spec-value strong" style={{ textTransform: 'capitalize' }}>{user?.role}</div>
          </div>
          <span className="badge badge-success">Active</span>
        </div>
      </div>

      <div className="stack">
        {links.map(l => (
          <Link key={l.to} to={l.to} className="card card-link" style={{ padding: '1.1rem 1.25rem' }}>
            <div className="row-between">
              <div>
                <div className="strong">{l.title}</div>
                <div className="muted small">{l.desc}</div>
              </div>
              <ArrowRight size={17} className="faint" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );

  if (user?.role === 'operator') {
    return (
      <OperatorLayout>
        {dashboardContent}
      </OperatorLayout>
    );
  }

  return dashboardContent;
};

export default Dashboard;
