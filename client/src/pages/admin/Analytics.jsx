import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer 
} from 'recharts';
import { TrendingUp, Users, DollarSign, Map as MapIcon } from 'lucide-react';

const COLORS = ['#2e7d32', '#1565c0', '#e65100', '#d32f2f', '#6a1b9a'];

const AdminAnalytics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await axios.get('/api/admin/analytics');
        setData(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) return <div className="page"><p>Loading analytics...</p></div>;
  if (!data) return <div className="page"><p>Failed to load analytics.</p></div>;

  const { summary, districtChartData, operatorChartData } = data;

  return (
    <div className="page">
      <h1 className="page-title" style={{ marginBottom: '1.5rem' }}>Platform Analytics</h1>

      <div className="grid-cards" style={{ marginBottom: '2rem' }}>
        <div className="card">
          <div className="row-wrap">
            <DollarSign size={24} style={{ color: 'var(--success)' }} />
            <div>
              <h3 style={{ margin: 0 }}>₹{summary.totalRevenue.toLocaleString('en-IN')}</h3>
              <p className="muted small" style={{ margin: 0 }}>Total Platform Gross</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="row-wrap">
            <TrendingUp size={24} style={{ color: 'var(--primary)' }} />
            <div>
              <h3 style={{ margin: 0 }}>₹{summary.totalCommission.toLocaleString('en-IN')}</h3>
              <p className="muted small" style={{ margin: 0 }}>Total Commission Retained</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="row-wrap">
            <MapIcon size={24} style={{ color: 'var(--info)' }} />
            <div>
              <h3 style={{ margin: 0 }}>{summary.totalBookings}</h3>
              <p className="muted small" style={{ margin: 0 }}>Total Bookings</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: '2rem' }}>
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Bookings by District</h3>
          {districtChartData.length === 0 ? (
            <p className="muted">No bookings yet.</p>
          ) : (
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={districtChartData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {districtChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Operators by Status</h3>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={operatorChartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'var(--muted)' }} />
                <YAxis tick={{ fill: 'var(--muted)' }} allowDecimals={false} />
                <RechartsTooltip />
                <Bar dataKey="count" fill="var(--primary)">
                  {operatorChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={
                      entry.name === 'Approved' ? 'var(--success)' : 
                      entry.name === 'Pending' ? 'var(--warning)' : 
                      'var(--danger)'
                    } />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalytics;
