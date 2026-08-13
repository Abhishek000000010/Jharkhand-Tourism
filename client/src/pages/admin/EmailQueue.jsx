import { useState, useEffect } from 'react';
import axios from 'axios';
import { Mail, RefreshCw, AlertCircle, CheckCircle, Clock } from 'lucide-react';

const EmailQueue = () => {
  const [data, setData] = useState({ counts: null, jobs: [], delivery: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const url = filter === 'all' ? '/api/admin/emails' : `/api/admin/emails?status=${filter}`;
      const res = await axios.get(url);
      setData(res.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch email queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  if (loading && !data.counts) {
    return <div className="page page--mid"><div className="loader" /></div>;
  }

  const { counts, jobs, delivery } = data;

  return (
    <div className="page page--mid">
      <div className="row-between" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title">Transactional Email</h1>
          <p className="page-sub">
            Monitor the outbound mail queue. System is running in: <strong>{delivery}</strong>
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchQueue} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>{error}</div>}

      <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '2rem' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <h3 className="muted small">Pending</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{counts?.pending || 0}</p>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <h3 className="muted small">Sent</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)' }}>{counts?.sent || 0}</p>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <h3 className="muted small">Failed</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--error)' }}>{counts?.failed || 0}</p>
        </div>
      </div>

      <div className="card stack">
        <div className="row-between" style={{ marginBottom: '1rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Mail size={18} /> Recent Messages</h3>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="input" style={{ width: 'auto', padding: '0.25rem 0.5rem' }}>
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        {jobs.length === 0 ? (
          <p className="muted">No emails found.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--panel-border)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.75rem 0', fontWeight: 'normal' }}>Status</th>
                  <th style={{ padding: '0.75rem 0', fontWeight: 'normal' }}>Type & Subject</th>
                  <th style={{ padding: '0.75rem 0', fontWeight: 'normal' }}>Recipient</th>
                  <th style={{ padding: '0.75rem 0', fontWeight: 'normal' }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job._id} style={{ borderBottom: '1px solid var(--panel-border)' }}>
                    <td style={{ padding: '1rem 0' }}>
                      {job.status === 'sent' && <span className="badge badge-success"><CheckCircle size={12} style={{marginRight:'4px', verticalAlign:'middle'}}/>Sent</span>}
                      {job.status === 'pending' && <span className="badge badge-neutral"><Clock size={12} style={{marginRight:'4px', verticalAlign:'middle'}}/>Pending</span>}
                      {job.status === 'failed' && <span className="badge badge-danger"><AlertCircle size={12} style={{marginRight:'4px', verticalAlign:'middle'}}/>Failed</span>}
                    </td>
                    <td style={{ padding: '1rem 0' }}>
                      <div className="strong" style={{ fontSize: '0.9rem' }}>{job.subject}</div>
                      <div className="muted small" style={{ marginTop: '0.25rem' }}>{job.type} {job.attempts > 0 && `(Attempt ${job.attempts})`}</div>
                      {job.lastError && (
                        <div style={{ marginTop: '0.5rem', color: 'var(--error)', fontSize: '0.8rem', background: 'rgba(231,76,60,0.1)', padding: '0.5rem', borderRadius: '4px' }}>
                          {job.lastError}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '1rem 0', fontSize: '0.9rem' }}>{job.to}</td>
                    <td style={{ padding: '1rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      {new Date(job.sentAt || job.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailQueue;
