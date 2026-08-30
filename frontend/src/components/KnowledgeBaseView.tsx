import { useState, useEffect } from 'react';
import { Database, Plus, CheckCircle, RefreshCw } from 'lucide-react';
import { apiClient } from '../api/client';
import type { KnowledgeDocument } from '../api/client';

export const KnowledgeBaseView: React.FC = () => {
  const [docs, setDocs] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDept, setSelectedDept] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // New Doc Form
  const [newTitle, setNewTitle] = useState('');
  const [newDept, setNewDept] = useState('customer_support');
  const [newContent, setNewContent] = useState('');
  const [newFacts, setNewFacts] = useState('');
  const [newTags, setNewTags] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getKnowledge(selectedDept === 'all' ? undefined : selectedDept);
      setDocs(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, [selectedDept]);

  const handleCreateDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;
    setSaving(true);
    try {
      await apiClient.createKnowledge({
        department: newDept,
        title: newTitle,
        content: newContent,
        key_facts: newFacts.split('\n').filter(f => f.trim().length > 0),
        tags: newTags.split(',').map(t => t.trim()).filter(t => t.length > 0)
      });
      setShowAddModal(false);
      setNewTitle('');
      setNewContent('');
      setNewFacts('');
      setNewTags('');
      fetchDocs();
    } catch (err: any) {
      alert(`Error creating document: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-shell">
      
      {/* Top Header */}
      <div className="card section-header" style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Database size={24} color="var(--risk-low)" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>Enterprise Ground-Truth Knowledge Base</h2>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Source-of-truth documents used by the Performance Evaluator to catch ungrounded claims and hallucinations in real time.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            style={{ fontSize: '0.85rem', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-card)', background: 'var(--bg-main)', color: 'var(--text-main)', outline: 'none' }}
          >
            <option value="all">All Departments</option>
            <option value="customer_support">Customer Support</option>
            <option value="hr_copilot">HR Copilot</option>
            <option value="financial_advisor">Financial Advisory</option>
          </select>

          <button onClick={fetchDocs} className="btn-secondary" style={{ padding: '8px 12px' }} title="Refresh">
            <RefreshCw size={16} className={loading ? 'pulse-animation' : ''} />
          </button>

          <button onClick={() => setShowAddModal(true)} className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={16} />
            <span style={{ fontWeight: 600 }}>Add Ground Truth Doc</span>
          </button>
        </div>
      </div>

      {/* Documents Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        {docs.map((doc) => (
          <div key={doc.id} className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                  {doc.department}
                </span>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>
                  {doc.title}
                </h3>
              </div>
              <span className="badge badge-low" style={{ fontSize: '0.7rem' }}>
                VERIFIED
              </span>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.6, background: 'var(--bg-main)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-card)' }}>
              {doc.content}
            </p>

            {/* Key Facts list */}
            {doc.key_facts && doc.key_facts.length > 0 && (
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle size={14} /> Key Deterministic Ground-Truth Facts:
                </div>
                <ul style={{ paddingLeft: '20px', fontSize: '0.8rem', color: 'var(--text-main)', lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {doc.key_facts.map((fact, idx) => (
                    <li key={idx}>{fact}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Tags */}
            {doc.tags && doc.tags.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: 'auto', paddingTop: '12px' }}>
                {doc.tags.map((tag, idx) => (
                  <span key={idx} style={{
                    fontSize: '0.75rem',
                    background: 'var(--bg-card-hover)',
                    border: '1px solid var(--border-card)',
                    padding: '4px 10px',
                    borderRadius: '16px',
                    color: 'var(--text-dim)',
                    fontWeight: 500
                  }}>
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Document Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '600px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>Add Ground-Truth Policy Document</h3>

            <form onSubmit={handleCreateDoc} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-main)', marginBottom: '8px' }}>Department / Use Case:</label>
                <select value={newDept} onChange={(e) => setNewDept(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-card)', background: 'var(--bg-main)', color: 'var(--text-main)', outline: 'none' }}>
                  <option value="customer_support">Customer Support</option>
                  <option value="hr_copilot">HR Copilot</option>
                  <option value="financial_advisor">Financial Advisory</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-main)', marginBottom: '8px' }}>Document Title:</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g., Enterprise Data Retention & GDPR Standards"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-card)', background: 'var(--bg-main)', color: 'var(--text-main)', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-main)', marginBottom: '8px' }}>Summary Content:</label>
                <textarea
                  rows={4}
                  required
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Official policy summary..."
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-card)', background: 'var(--bg-main)', color: 'var(--text-main)', outline: 'none', resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-main)', marginBottom: '8px' }}>Key Factual Rules (one per line):</label>
                <textarea
                  rows={4}
                  value={newFacts}
                  onChange={(e) => setNewFacts(e.target.value)}
                  placeholder="e.g. Standard return window is strictly 30 days"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-card)', background: 'var(--bg-main)', color: 'var(--text-main)', outline: 'none', resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-main)', marginBottom: '8px' }}>Tags (comma-separated):</label>
                <input
                  type="text"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  placeholder="e.g. policy, returns, refunds"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-card)', background: 'var(--bg-main)', color: 'var(--text-main)', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary" style={{ padding: '10px 20px' }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary" style={{ padding: '10px 20px', fontWeight: 600 }}>
                  {saving ? 'Saving...' : 'Save Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
