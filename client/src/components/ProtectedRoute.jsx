import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading">Loading…</div>;

  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="page page--mid">
        <div className="empty">
          <h3>Access denied</h3>
          <p className="muted">Your account is a {user.role} account, which cannot view this page.</p>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
