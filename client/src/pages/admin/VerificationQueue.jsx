import { useState, useEffect } from 'react';
import axios from 'axios';
import { Check, X, FileText } from 'lucide-react';

const VerificationQueue = () => {
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [kycUrl, setKycUrl] = useState('');
  const [kycLoading, setKycLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const fetchPending = async () => {
    try {
      const res = await axios.get('/api/admin/operators/pending');
      setOperators(res.data.operators);
    } catch {
      setOperators([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPending(); }, []);

  const openOperator = async (op) => {
    setSelected(op);
    setRejectionReason('');
    setError(null);
    setKycLoading(true);
    setKycUrl('');
    try {
      const res = await axios.get(`/api/admin/operators/${op._id}/kyc-url`);
      setKycUrl(res.data.url);
    } catch {
      setKycUrl('');
    } finally {
      setKycLoading(false);
    }
  };

  const decide = async (status) => {
    if (status === 'rejected' && !rejectionReason.trim()) {
      setError('Give the operator a reason so they can correct and resubmit.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await axios.put(`/api/admin/operators/${selected._id}/verify`, {
        status,
        rejectionReason: status === 'rejected' ? rejectionReason : '',
      });
      setSelected(null);
      fetchPending();
    } catch (err) {
      setError(err.response?.data?.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="loading">Loading queue…</div>;

  return (
    <div className="page">
      <h1 className="page-title">Verification queue</h1>
      <p className="page-sub" style={{ marginBottom: '1.75rem' }}>
        {operators.length} operator{operators.length === 1 ? '' : 's'} awaiting review.
      </p>

      {operators.length === 0 ? (
        <div className="empty">
          <h3>Queue is clear</h3>
          <p className="muted">No operators are waiting for verification.</p>
        </div>
      ) : (
        <div className="split">
          <div className="stack-sm">
            {operators.map(op => (
              <div key={op._id}
                className={`queue-item ${selected?._id === op._id ? 'is-selected' : ''}`}
                onClick={() => openOperator(op)}>
                <div className="strong">{op.businessName}</div>
                <div className="small muted">{op.district} · {op.contactPhone}</div>
                <div className="tiny faint" style={{ marginTop: '0.3rem' }}>
                  {op.user?.name} — {op.user?.email}
                </div>
              </div>
            ))}
          </div>

          {selected ? (
            <div className="card stack">
              <div>
                <h2>{selected.businessName}</h2>
                <p className="small muted">{selected.district} · {selected.contactPhone}</p>
              </div>

              <div>
                <div className="spec-label" style={{ marginBottom: '0.5rem' }}>KYC document</div>
                <div className="doc-frame">
                  {kycLoading ? (
                    <span className="small muted">Generating secure link…</span>
                  ) : !kycUrl ? (
                    <span className="small" style={{ color: 'var(--danger)' }}>Could not load document</span>
                  ) : kycUrl.includes('.pdf') ? (
                    <a href={kycUrl} target="_blank" rel="noreferrer" className="btn btn-secondary">
                      <FileText size={16} /> Open PDF
                    </a>
                  ) : (
                    <img src={kycUrl} alt="KYC document" />
                  )}
                </div>
                <p className="hint" style={{ marginTop: '0.5rem' }}>
                  Private document. This link is signed and expires in one hour.
                </p>
              </div>

              {error && <div className="alert alert-error">{error}</div>}

              <div className="field">
                <label className="label" htmlFor="reason">Rejection reason</label>
                <textarea id="reason" className="textarea" value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Required only if rejecting — the operator sees this and can resubmit." />
              </div>

              <div className="row" style={{ gap: '0.6rem' }}>
                <button className="btn btn-primary grow" onClick={() => decide('approved')} disabled={busy}>
                  <Check size={16} /> Approve
                </button>
                <button className="btn btn-secondary grow" onClick={() => decide('rejected')} disabled={busy}>
                  <X size={16} /> Reject
                </button>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="empty" style={{ padding: '2.5rem 1rem' }}>
                <p className="muted">Select an operator to review their documents.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VerificationQueue;
