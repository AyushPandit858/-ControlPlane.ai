import { useState, useEffect } from 'react';
import { UserCheck, CheckCircle, XCircle, Edit3, ShieldAlert, Sparkles, MessageSquare, RefreshCw } from 'lucide-react';
import { apiClient } from '../api/client';
import type { HITLReviewItem } from '../api/client';

interface ReviewConsoleProps {
  onRefreshStats: () => void;
}

export const ReviewConsole: React.FC<ReviewConsoleProps> = ({ onRefreshStats }) => {
  const [reviews, setReviews] = useState<HITLReviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('PENDING');
  const [selectedReview, setSelectedReview] = useState<HITLReviewItem | null>(null);
  
  // Resolution form state
  const [editedResponse, setEditedResponse] = useState('');
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const maskSensitiveText = (text: string) => text
    .replace(/\b\d{3}-\d{2}-(\d{4})\b/g, '***-**-$1')
    .replace(/\b([A-Za-z])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g, '$1***@$2')
    .replace(/\bEMP-\d{4,6}\b/g, '[REDACTED_EMPLOYEE_ID]');

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getReviews(filterStatus);
      setReviews(data);
      if (data.length > 0 && (!selectedReview || !data.some(r => r.id === selectedReview.id))) {
        setSelectedReview(data[0]);
        setEditedResponse(data[0].original_response);
      } else if (data.length === 0) {
        setSelectedReview(null);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [filterStatus]);

  const handleSelectReview = (item: HITLReviewItem) => {
    setSelectedReview(item);
    setEditedResponse(item.corrected_response || item.original_response);
    setReviewerNotes(item.reviewer_notes || '');
    setFormError('');
  };

  const handleResolve = async (action: 'APPROVED' | 'MODIFIED' | 'REJECTED') => {
    if (!selectedReview) return;
    if (action === 'APPROVED' && !reviewerNotes.trim()) {
      setFormError('Document a reviewer rationale before releasing an intercepted response.');
      return;
    }
    if (action === 'MODIFIED' && !editedResponse.trim()) {
      setFormError('Provide a corrected response before releasing it.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      await apiClient.resolveReview(selectedReview.id, {
        status: action,
        corrected_response: action === 'MODIFIED' ? editedResponse : undefined,
        reviewer_notes: reviewerNotes || `Action: ${action} by reviewer`,
        feed_back_to_policy: true
      });

      await fetchReviews();
      onRefreshStats();
    } catch (err: any) {
      setFormError(err.message || 'Unable to resolve this review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-shell">
      
      {/* Header with Explanatory Pitch Ribbon */}
      <div className="card section-header" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <UserCheck size={20} color="var(--primary)" />
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)' }}>Human-in-the-Loop (HITL) Triage Console</h2>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            High-risk responses intercepted by ControlPlane are held here. Review, correct, or approve overrides to train the feedback loop.
          </p>
        </div>

        {/* Filter Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {['PENDING', 'APPROVED', 'MODIFIED', 'REJECTED', 'ALL'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: filterStatus === st ? '1px solid var(--border-active)' : '1px solid var(--border-card)',
                background: filterStatus === st ? 'var(--bg-card-hover)' : 'transparent',
                color: filterStatus === st ? 'var(--text-main)' : 'var(--text-muted)',
                transition: 'all 0.15s ease'
              }}
            >
              {st}
            </button>
          ))}
          <button onClick={fetchReviews} className="btn-secondary" style={{ padding: '6px 10px', marginLeft: '4px' }} title="Refresh">
            <RefreshCw size={14} className={loading ? 'pulse-animation' : ''} />
          </button>
        </div>
      </div>

      {/* Main Review Workspace */}
      <div className="review-layout">
        
        {/* Left: Queue List */}
        <div className="card" style={{ padding: '20px', maxHeight: '720px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            Incident Queue ({reviews.length})
          </div>

          {reviews.length === 0 && !loading && (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <CheckCircle size={32} color="var(--risk-low)" style={{ marginBottom: '12px' }} />
              <p style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '1rem' }}>Queue Clean</p>
              <p style={{ fontSize: '0.85rem', marginTop: '6px' }}>No high-risk items pending review for filter '{filterStatus}'.</p>
            </div>
          )}

          {reviews.map((item) => {
            const isSelected = selectedReview?.id === item.id;
            return (
              <div
                key={item.id}
                onClick={() => handleSelectReview(item)}
                className="card"
                style={{
                  padding: '16px',
                  cursor: 'pointer',
                  border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-card)',
                  background: isSelected ? 'var(--bg-card-hover)' : 'var(--bg-card)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-blue)' }}>
                    Incident #{item.id}
                  </span>
                  <span className={`badge ${item.status === 'PENDING' ? 'badge-high' : 'badge-low'}`} style={{ fontSize: '0.65rem' }}>
                    {item.status}
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  "{item.original_prompt}"
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--risk-high)', marginTop: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                  ⚠️ {item.risk_reasons || 'High risk violation'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Inspection & Action Workspace */}
        {selectedReview ? (
          <div className="card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-card)', paddingBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>INCIDENT DETAILS</span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>
                  Review Case #{selectedReview.id} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({selectedReview.use_case})</span>
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="badge badge-high">{selectedReview.status}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Logged: {new Date(selectedReview.created_at).toLocaleTimeString()}
                </span>
              </div>
            </div>

            {/* Violation Alert Box */}
            <div style={{
              background: 'var(--risk-high-bg)',
              border: '1px solid var(--risk-high-border)',
              borderRadius: '8px',
              padding: '16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px'
            }}>
              <ShieldAlert size={20} color="var(--risk-high)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--risk-high)' }}>
                  Reason For Interception
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginTop: '4px' }}>
                  {selectedReview.risk_reasons || 'Blocked due to policy breach or safety hard-floor condition.'}
                </div>
              </div>
            </div>

            {/* Prompt & Original Response Grid */}
            <div className="two-column-grid">
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
                  End-User Prompt:
                </label>
                <div style={{
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-card)',
                  padding: '16px',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  color: 'var(--text-main)',
                  minHeight: '100px'
                }}>
                  {selectedReview.original_prompt}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
                  Intercepted Raw Response (Blocked):
                </label>
                <div style={{
                  background: 'var(--bg-main)',
                  border: '1px solid var(--risk-high-border)',
                  padding: '16px',
                  borderRadius: '6px',
                  fontFamily: 'JetBrains Mono',
                  fontSize: '0.85rem',
                  color: 'var(--risk-high)',
                  minHeight: '100px',
                  whiteSpace: 'pre-wrap'
                }}>
                  {maskSensitiveText(selectedReview.original_response)}
                </div>
              </div>
            </div>

            {/* Editable Response for Sanitization */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Edit3 size={16} /> Corrected / Sanitized Response (For 'Modify & Approve'):
                </label>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sanitize PII or correct hallucinated claims</span>
              </div>
              <textarea
                rows={4}
                value={editedResponse}
                onChange={(e) => setEditedResponse(e.target.value)}
                style={{ width: '100%', fontFamily: 'JetBrains Mono', fontSize: '0.85rem' }}
                placeholder="Type the corrected, safe response..."
              />
            </div>

            {formError && <div className="status-message" role="alert">{formError}</div>}

            {/* Reviewer Feedback Notes */}
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MessageSquare size={16} /> Reviewer Rationale (Feeds into Policy Learning Loop):
              </label>
              <input
                type="text"
                value={reviewerNotes}
                onChange={(e) => setReviewerNotes(e.target.value)}
                placeholder="e.g., Redacted sensitive SSN and verified 30-day return policy..."
                style={{ width: '100%' }}
              />
            </div>

            {/* Action Buttons */}
            {selectedReview.status === 'PENDING' && (
              <div style={{ display: 'flex', gap: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-card)' }}>
                <button
                  onClick={() => handleResolve('MODIFIED')}
                  disabled={submitting}
                  className="btn-success"
                  style={{ flex: 1, padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.9rem' }}
                >
                  <Edit3 size={16} />
                  <span>Sanitize & Release to User</span>
                </button>

                <button
                  onClick={() => handleResolve('APPROVED')}
                  disabled={submitting}
                  className="btn-secondary"
                  style={{ flex: 1, padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.9rem' }}
                >
                  <CheckCircle size={16} color="var(--risk-low)" />
                  <span>Approve Raw (Override)</span>
                </button>

                <button
                  onClick={() => handleResolve('REJECTED')}
                  disabled={submitting}
                  className="btn-danger"
                  style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.9rem' }}
                >
                  <XCircle size={16} />
                  <span>Permanent Block</span>
                </button>
              </div>
            )}

            {selectedReview.status !== 'PENDING' && (
              <div style={{
                background: 'var(--risk-low-bg)',
                border: '1px solid var(--risk-low-border)',
                borderRadius: '8px',
                padding: '16px',
                fontSize: '0.9rem',
                color: 'var(--risk-low)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontWeight: 500
              }}>
                <CheckCircle size={20} />
                <span>This incident was resolved with status <strong>{selectedReview.status}</strong> on {selectedReview.resolved_at ? new Date(selectedReview.resolved_at).toLocaleString() : 'recently'}.</span>
              </div>
            )}

            {/* Closed Loop Notice */}
            <div style={{
              fontSize: '0.85rem',
              color: 'var(--primary)',
              background: 'var(--primary-glow)',
              border: '1px solid var(--border-active)',
              borderRadius: '8px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <Sparkles size={18} />
              <span><strong>Auditable feedback:</strong> Resolving this incident records the reviewer rationale and a suggested guardrail update for governance review.</span>
            </div>

          </div>
        ) : (
          <div className="card" style={{ padding: '64px', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
             <UserCheck size={48} color="var(--border-card)" style={{ marginBottom: '16px' }} />
            <p style={{ fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: 500 }}>Select an incident from the queue to review and resolve.</p>
          </div>
        )}

      </div>

    </div>
  );
};
