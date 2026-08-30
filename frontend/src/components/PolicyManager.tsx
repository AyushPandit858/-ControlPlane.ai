import { useState, useEffect } from 'react';
import { Sliders, Save, CheckCircle } from 'lucide-react';
import { apiClient } from '../api/client';
import type { PolicyRule } from '../api/client';

export const PolicyManager: React.FC = () => {
  const [policies, setPolicies] = useState<PolicyRule[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Partial<PolicyRule>>({});
  const [loading, setLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [formError, setFormError] = useState('');

  const weightTotal = (formData.perf_weight || 0) + (formData.cost_weight || 0) + (formData.resp_weight || 0);
  const hasValidWeights = Math.abs(weightTotal - 1) < 0.001;

  const fetchPolicies = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getPolicies();
      setPolicies(data);
      if (data.length > 0 && !selectedPolicyId) {
        setSelectedPolicyId(data[0].id);
        setFormData(data[0]);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const handleSelectPolicy = (p: PolicyRule) => {
    setSelectedPolicyId(p.id);
    setFormData(p);
    setSavedSuccess(false);
    setFormError('');
  };

  const handleSave = async () => {
    if (!selectedPolicyId) return;
    if (!hasValidWeights) {
      setFormError('Pillar weights must total exactly 100% before the policy can be saved.');
      return;
    }
    if ((formData.min_autocorrect_score || 0) >= (formData.min_pass_score || 0)) {
      setFormError('The auto-correct threshold must be lower than the pass threshold.');
      return;
    }
    setLoading(true);
    setFormError('');
    try {
      const updated = await apiClient.updatePolicy(selectedPolicyId, formData);
      setSavedSuccess(true);
      setPolicies(policies.map(p => p.id === updated.id ? updated : p));
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      setFormError(err.message || 'Unable to update the policy.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell">
      
      {/* Top Header */}
      <div className="card section-header" style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sliders size={24} color="var(--primary)" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>Department Policy & Governance Engine</h2>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Customize risk thresholds, 3-pillar weights, and hard-floor safety rules by enterprise use case.
          </p>
        </div>
      </div>

      <div className="policy-layout">
        
        {/* Policy Selector Column */}
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Department Policies ({policies.length})
          </div>

          {policies.map((p) => {
            const isSelected = selectedPolicyId === p.id;
            return (
              <div
                key={p.id}
                onClick={() => handleSelectPolicy(p)}
                className="card"
                style={{
                  padding: '16px',
                  cursor: 'pointer',
                  border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-card)',
                  background: isSelected ? 'var(--bg-card-hover)' : 'var(--bg-card)',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '4px' }}>
                  {p.name}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--accent-blue)', marginBottom: '8px', fontWeight: 500 }}>
                  use_case: {p.use_case}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Pass: &ge;{p.min_pass_score}% | Redact: &ge;{p.min_autocorrect_score}%
                </div>
              </div>
            );
          })}
        </div>

        {/* Policy Editor Form */}
        {selectedPolicyId && (
          <div className="card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-card)', paddingBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  Editing Policy: <span style={{ color: 'var(--primary)' }}>{formData.name}</span>
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>{formData.description}</p>
              </div>

              <button onClick={handleSave} disabled={loading || !hasValidWeights} className="btn-primary" style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Save size={16} />
                <span style={{ fontWeight: 600 }}>Save Policy Changes</span>
              </button>
            </div>

            {savedSuccess && (
              <div style={{
                background: 'var(--risk-low-bg)',
                border: '1px solid var(--risk-low-border)',
                padding: '12px 16px',
                borderRadius: '8px',
                color: 'var(--risk-low)',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontWeight: 500
              }}>
                <CheckCircle size={18} />
                <span>Policy parameters successfully updated in live gateway!</span>
              </div>
            )}

            {formError && <div className="status-message" role="alert">{formError}</div>}

            {/* Threshold Sliders */}
            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '16px' }}>
                1. Risk Routing Thresholds
              </h4>
              <div className="two-column-grid">
                
                {/* Min Pass Score */}
                <div className="card" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-main)' }}>
                    <span>Low Risk Pass Threshold (Pass Straight Through):</span>
                    <strong style={{ color: 'var(--risk-low)', fontFamily: 'JetBrains Mono' }}>{formData.min_pass_score}%</strong>
                  </div>
                  <input
                    type="range"
                    min="60"
                    max="95"
                    step="1"
                    value={formData.min_pass_score || 85}
                    onChange={(e) => setFormData({ ...formData, min_pass_score: parseFloat(e.target.value) })}
                    style={{ width: '100%', accentColor: 'var(--risk-low)' }}
                  />
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>Responses at or above this score pass with no human delay.</div>
                </div>

                {/* Min Auto-correct Score */}
                <div className="card" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-main)' }}>
                    <span>Medium Risk Threshold (Auto-Correct / Redact):</span>
                    <strong style={{ color: 'var(--risk-med)', fontFamily: 'JetBrains Mono' }}>{formData.min_autocorrect_score}%</strong>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="75"
                    step="1"
                    value={formData.min_autocorrect_score || 50}
                    onChange={(e) => setFormData({ ...formData, min_autocorrect_score: parseFloat(e.target.value) })}
                    style={{ width: '100%', accentColor: 'var(--risk-med)' }}
                  />
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>Below this threshold triggers immediate High Risk blocking.</div>
                </div>

              </div>
            </div>

            {/* Pillar Weights */}
            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '16px' }}>
                2. Multi-Signal Pillar Weights (Sum: <span style={{ color: hasValidWeights ? 'var(--risk-low)' : 'var(--risk-high)' }}>{Math.round(weightTotal * 100)}%</span>)
              </h4>
              
              <div className="policy-weight-grid">
                <div className="card" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-main)' }}>
                    <span>Performance Weight:</span>
                    <strong style={{ color: 'var(--accent-blue)', fontFamily: 'JetBrains Mono' }}>{Math.round((formData.perf_weight || 0.4) * 100)}%</strong>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="0.8"
                    step="0.05"
                    value={formData.perf_weight || 0.4}
                    onChange={(e) => setFormData({ ...formData, perf_weight: parseFloat(e.target.value) })}
                    style={{ width: '100%', accentColor: 'var(--accent-blue)' }}
                  />
                </div>

                <div className="card" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-main)' }}>
                    <span>Cost Weight:</span>
                    <strong style={{ color: 'var(--accent-pink)', fontFamily: 'JetBrains Mono' }}>{Math.round((formData.cost_weight || 0.2) * 100)}%</strong>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="0.6"
                    step="0.05"
                    value={formData.cost_weight || 0.2}
                    onChange={(e) => setFormData({ ...formData, cost_weight: parseFloat(e.target.value) })}
                    style={{ width: '100%', accentColor: 'var(--accent-pink)' }}
                  />
                </div>

                <div className="card" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-main)' }}>
                    <span>Responsibility Weight:</span>
                    <strong style={{ color: 'var(--risk-low)', fontFamily: 'JetBrains Mono' }}>{Math.round((formData.resp_weight || 0.4) * 100)}%</strong>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="0.8"
                    step="0.05"
                    value={formData.resp_weight || 0.4}
                    onChange={(e) => setFormData({ ...formData, resp_weight: parseFloat(e.target.value) })}
                    style={{ width: '100%', accentColor: 'var(--risk-low)' }}
                  />
                </div>
              </div>
            </div>

            {/* Hard Floor & Strict Governance Toggles */}
            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '16px' }}>
                3. Safety Hard Floor Rules & SLA Budgets
              </h4>

              <div className="policy-toggle-grid">
                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-main)', padding: '16px', borderRadius: '8px', cursor: 'pointer', border: '1px solid var(--border-card)' }}>
                  <input
                    type="checkbox"
                    checked={formData.block_on_pii || false}
                    onChange={(e) => setFormData({ ...formData, block_on_pii: e.target.checked })}
                    style={{ width: '20px', height: '20px', accentColor: 'var(--risk-high)' }}
                  />
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>Strict PII Blocking (Hard Floor)</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>If enabled, sensitive PII immediately blocks instead of auto-redacting.</div>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-main)', padding: '16px', borderRadius: '8px', cursor: 'pointer', border: '1px solid var(--border-card)' }}>
                  <input
                    type="checkbox"
                    checked={formData.block_on_hallucination || false}
                    onChange={(e) => setFormData({ ...formData, block_on_hallucination: e.target.checked })}
                    style={{ width: '20px', height: '20px', accentColor: 'var(--risk-med)' }}
                  />
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>Strict Hallucination Blocking</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>Blocks severe ungrounded claims instead of routing them for correction.</div>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-main)', padding: '16px', borderRadius: '8px', cursor: 'pointer', border: '1px solid var(--border-card)' }}>
                  <input
                    type="checkbox"
                    checked={formData.block_on_toxicity || false}
                    onChange={(e) => setFormData({ ...formData, block_on_toxicity: e.target.checked })}
                    style={{ width: '20px', height: '20px', accentColor: 'var(--risk-high)' }}
                  />
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>Zero-Tolerance Toxicity Trigger</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>Blocks abusive, hateful, or security-exploiting outputs immediately.</div>
                  </div>
                </label>
              </div>

              <div className="two-column-grid" style={{ marginTop: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-main)', marginBottom: '8px' }}>
                    Max Latency Budget (SLA):
                  </label>
                  <input
                    type="number"
                    value={formData.max_latency_budget_ms || 1500}
                    onChange={(e) => setFormData({ ...formData, max_latency_budget_ms: parseFloat(e.target.value) })}
                    style={{ width: '100%', padding: '10px 14px', fontSize: '0.9rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-main)', marginBottom: '8px' }}>
                    Max Token Budget:
                  </label>
                  <input
                    type="number"
                    value={formData.max_token_budget || 1000}
                    onChange={(e) => setFormData({ ...formData, max_token_budget: parseInt(e.target.value) })}
                    style={{ width: '100%', padding: '10px 14px', fontSize: '0.9rem' }}
                  />
                </div>
              </div>
            </div>

          </div>
        )}

      </div>

    </div>
  );
};
