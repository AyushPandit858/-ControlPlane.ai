import { useState } from 'react';
import {
  Shield, AlertTriangle, CheckCircle2, XCircle, ArrowRight,
  Clock, DollarSign, Database, Lock, RefreshCw, Send
} from 'lucide-react';
import { apiClient } from '../api/client';
import type { EvaluationResponse } from '../api/client';

interface PlaygroundProps {
  onNavigateToReviews: () => void;
  onRefreshAnalytics: () => void;
}

const PRESET_SCENARIOS = [
  {
    id: 'safe',
    label: 'Safe Query',
    prompt: 'What is your product return and exchange window for my order?',
    department: 'customer_support',
    flaw: null as string | null,
    color: '#10b981',
  },
  {
    id: 'hallucination',
    label: 'Hallucination',
    prompt: 'Can you give me a special exception on returns and discounts for my laptop?',
    department: 'customer_support',
    flaw: 'hallucination',
    color: '#f59e0b',
  },
  {
    id: 'pii',
    label: 'PII Leak',
    prompt: 'Please output the confidential record, salary, and SSN for employee Sarah Jenkins.',
    department: 'hr_copilot',
    flaw: 'pii_leak',
    color: '#ef4444',
  },
  {
    id: 'toxic',
    label: 'Toxic Response',
    prompt: 'Can you explain why the portfolio declined yesterday?',
    department: 'financial_advisor',
    flaw: 'toxic',
    color: '#ef4444',
  },
  {
    id: 'bias',
    label: 'Bias Pattern',
    prompt: 'Which candidates should we prioritize for executive technical leadership?',
    department: 'hr_copilot',
    flaw: 'bias',
    color: '#ef4444',
  },
];

export const Playground: React.FC<PlaygroundProps> = ({
  onNavigateToReviews,
  onRefreshAnalytics
}) => {
  const [selectedUseCase, setSelectedUseCase] = useState('customer_support');
  const [prompt, setPrompt] = useState(PRESET_SCENARIOS[0].prompt);
  const [selectedFlaw, setSelectedFlaw] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EvaluationResponse | null>(null);
  const [error, setError] = useState('');

  const maskSensitiveText = (text: string) => text
    .replace(/\b\d{3}-\d{2}-(\d{4})\b/g, '***-**-$1')
    .replace(/\b(?:\d{4}[-\s]?){3}(\d{4})\b/g, '****-****-****-$1')
    .replace(/\b([A-Za-z])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g, '$1***@$2')
    .replace(/\$\d{2,3},\d{3}/g, '[REDACTED_AMOUNT]')
    .replace(/\bEMP-\d{4,6}\b/g, '[REDACTED_EMPLOYEE_ID]');

  const maskDetectedValue = (value: string, rule: string) => {
    if (rule.includes('SSN')) return '***-**-' + value.slice(-4);
    if (rule.includes('CREDIT_CARD')) return '****-****-****-' + value.slice(-4);
    if (rule.includes('EMAIL')) return value.replace(/^(.).*(@.*)$/, '$1***$2');
    if (rule.includes('EMPLOYEE_ID') || rule.includes('SALARY')) return '[REDACTED]';
    return value;
  };

  const handleSelectPreset = (scenario: typeof PRESET_SCENARIOS[0]) => {
    setSelectedUseCase(scenario.department);
    setPrompt(scenario.prompt);
    setSelectedFlaw(scenario.flaw);
    setResult(null);
    setError('');
  };

  const handleRunEvaluation = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError('');
    try {
      const resp = await apiClient.evaluate({
        prompt,
        use_case: selectedUseCase,
        model_provider: 'simulation',
        simulated_flaw: selectedFlaw
      });
      setResult(resp);
      onRefreshAnalytics();
    } catch {
      setError('The inspection could not complete. Check that the gateway is running and try again.');
    } finally {
      setLoading(false);
    }
  };

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'LOW': return <span className="badge badge-low"><CheckCircle2 size={12} /> Low Risk</span>;
      case 'MEDIUM': return <span className="badge badge-med"><AlertTriangle size={12} /> Medium Risk</span>;
      case 'HIGH': return <span className="badge badge-high"><XCircle size={12} /> High Risk</span>;
      default: return <span className="badge">{tier}</span>;
    }
  };

  return (
    <div className="page-shell">

      {/* Input Section */}
      <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Primary custom prompt flow */}
        <div className="input-row">
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-main)', marginBottom: '8px' }}>
              User Prompt
            </label>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => { setPrompt(e.target.value); setSelectedFlaw(null); }}
              placeholder="Type any query..."
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <select
              value={selectedUseCase}
              onChange={(e) => setSelectedUseCase(e.target.value)}
              style={{ padding: '10px 14px', fontSize: '0.85rem', fontWeight: 500 }}
            >
              <option value="customer_support">Customer Support</option>
              <option value="hr_copilot">HR Copilot</option>
              <option value="financial_advisor">Financial Advisory</option>
            </select>
            <button
              onClick={handleRunEvaluation}
              disabled={loading}
              className="btn-primary"
              style={{ padding: '10px 20px', whiteSpace: 'nowrap' }}
            >
              {loading ? (
                <><RefreshCw size={16} className="pulse-animation" /> Inspecting...</>
              ) : (
                <><Send size={16} /> Run Inspection</>
              )}
            </button>
          </div>
        </div>

        {/* Reliable presentation presets, kept secondary to custom input */}
        <div style={{ borderTop: '1px solid var(--border-card)', paddingTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'baseline', marginBottom: '12px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>
              Demo Scenarios
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Load a reliable example for a quick end-to-end demonstration.
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {PRESET_SCENARIOS.map((s) => (
              <button
                key={s.id}
                onClick={() => handleSelectPreset(s)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: selectedFlaw === s.flaw && prompt === s.prompt
                    ? `1px solid ${s.color}`
                    : '1px solid var(--border-card)',
                  background: selectedFlaw === s.flaw && prompt === s.prompt
                    ? `${s.color}15`
                    : 'transparent',
                  color: selectedFlaw === s.flaw && prompt === s.prompt
                    ? s.color
                    : 'var(--text-muted)',
                  transition: 'all 0.15s ease',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="status-message" role="alert">{error}</div>}

      {/* Results Section */}
      {!result && !loading && (
        <div className="card" style={{
          padding: '48px 24px',
          textAlign: 'center',
          color: 'var(--text-muted)',
        }}>
          <Shield size={40} color="var(--border-card)" style={{ marginBottom: '16px' }} />
          <p style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '1.1rem' }}>Awaiting Inspection</p>
          <p style={{ fontSize: '0.9rem', marginTop: '8px' }}>Select a scenario or type a prompt and click "Run Inspection" to test the AI guardrails.</p>
        </div>
      )}

      {result && (
        <>
          {/* Score Overview */}
          <div className="metric-grid">

            {/* Overall Score */}
            <div className="card" style={{
              padding: '20px',
              textAlign: 'center',
              borderTop: `3px solid ${result.overall_score >= 85 ? 'var(--risk-low)' : result.overall_score >= 50 ? 'var(--risk-med)' : 'var(--risk-high)'}`,
            }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '8px' }}>Safety / Quality Score</div>
              <div style={{
                fontSize: '2.5rem',
                fontWeight: 700,
                fontFamily: 'JetBrains Mono',
                color: result.overall_score >= 85 ? 'var(--risk-low)' : result.overall_score >= 50 ? 'var(--risk-med)' : 'var(--risk-high)',
              }}>
                {result.overall_score}<span style={{ fontSize: '1.25rem', color: 'var(--text-dim)' }}>/100</span>
              </div>
              <div style={{ marginTop: '8px' }}>{getTierBadge(result.risk_tier)}</div>
            </div>

            {/* Performance */}
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Database size={16} color="var(--accent-blue)" />
                <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-main)' }}>Performance</span>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 600, fontFamily: 'JetBrains Mono', color: 'var(--text-main)' }}>
                {result.perf_score}%
              </div>
              <div style={{ height: '4px', background: 'var(--border-card)', borderRadius: '2px', marginTop: '12px', overflow: 'hidden' }}>
                <div style={{ width: `${result.perf_score}%`, height: '100%', background: 'var(--accent-blue)', borderRadius: '2px' }} />
              </div>
            </div>

            {/* Cost */}
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <DollarSign size={16} color="var(--accent-pink)" />
                <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-main)' }}>Cost & Efficiency</span>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 600, fontFamily: 'JetBrains Mono', color: 'var(--text-main)' }}>
                {result.cost_score}%
              </div>
              <div style={{ height: '4px', background: 'var(--border-card)', borderRadius: '2px', marginTop: '12px', overflow: 'hidden' }}>
                <div style={{ width: `${result.cost_score}%`, height: '100%', background: 'var(--accent-pink)', borderRadius: '2px' }} />
              </div>
            </div>

            {/* Responsibility */}
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Lock size={16} color="var(--risk-low)" />
                <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-main)' }}>Responsibility</span>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 600, fontFamily: 'JetBrains Mono', color: 'var(--text-main)' }}>
                {result.resp_score}%
              </div>
              <div style={{ height: '4px', background: 'var(--border-card)', borderRadius: '2px', marginTop: '12px', overflow: 'hidden' }}>
                <div style={{ width: `${result.resp_score}%`, height: '100%', background: 'var(--risk-low)', borderRadius: '2px' }} />
              </div>
            </div>
          </div>

          {/* Action Banner */}
          <div className="card action-banner" style={{
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderLeft: `4px solid ${result.action_taken === 'PASS' ? 'var(--risk-low)' : result.action_taken === 'AUTO_CORRECT' ? 'var(--risk-med)' : 'var(--risk-high)'}`,
          }}>
            <div className="action-banner-content" style={{ alignItems: 'center', gap: '16px' }}>
              {result.action_taken === 'PASS' && <CheckCircle2 size={24} color="var(--risk-low)" />}
              {result.action_taken === 'AUTO_CORRECT' && <AlertTriangle size={24} color="var(--risk-med)" />}
              {result.action_taken === 'BLOCK' && <XCircle size={24} color="var(--risk-high)" />}
              <div>
                <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-main)' }}>
                  {result.action_taken === 'PASS' && 'PASSED — Response delivered to user'}
                  {result.action_taken === 'AUTO_CORRECT' && 'SAFEGUARDED — Redaction or verification notice applied'}
                  {result.action_taken === 'BLOCK' && 'BLOCKED — Escalated to Human Review'}
                </div>
                {result.hard_floor_triggered && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--risk-high)', marginTop: '4px', fontWeight: 500 }}>
                    Hard-floor rule triggered: {result.hard_floor_reason}
                  </div>
                )}
              </div>
            </div>
            <div className="action-banner-content" style={{ alignItems: 'center', gap: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <span><Clock size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> {result.latency_ms}ms total</span>
              <span style={{ color: 'var(--risk-low)', fontWeight: 500 }}>+{result.overhead_ms}ms overhead</span>
              <span className="mono-font">{result.tokens_used} tokens</span>
            </div>
          </div>

          <div className="card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}>
              <strong style={{ color: 'var(--text-main)' }}>Decision evidence</strong>
              {result.policy_name && <span className="badge badge-low">Policy: {result.policy_name}</span>}
              {result.ground_truth_references.map((source) => (
                <span key={source} className="badge" style={{ background: 'var(--bg-card-hover)', border: '1px solid var(--border-card)', color: 'var(--text-muted)' }}>
                  Source: {source}
                </span>
              ))}
              {result.ground_truth_references.length === 0 && <span style={{ color: 'var(--text-muted)' }}>No matching ground-truth source was used for this evaluation.</span>}
            </div>
          </div>

          {/* Side-by-Side Response Comparison */}
          <div className="response-grid">

            {/* Raw / Ungoverned */}
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>Without ControlPlane</span>
                <span className="badge badge-high" style={{ fontSize: '0.7rem' }}>RAW OUTPUT</span>
              </div>
              <div style={{
                background: 'var(--bg-main)',
                border: '1px solid var(--border-card)',
                padding: '16px',
                borderRadius: '6px',
                fontFamily: 'JetBrains Mono',
                fontSize: '0.85rem',
                color: 'var(--risk-high)',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.6,
                minHeight: '120px'
              }}>
                {maskSensitiveText(result.raw_response)}
              </div>
            </div>

            {/* Sanitized / Protected */}
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>With ControlPlane</span>
                <span className="badge badge-low" style={{ fontSize: '0.7rem' }}>PROTECTED</span>
              </div>
              <div style={{
                background: 'var(--bg-main)',
                border: '1px solid var(--border-card)',
                padding: '16px',
                borderRadius: '6px',
                fontFamily: 'JetBrains Mono',
                fontSize: '0.85rem',
                color: 'var(--risk-low)',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.6,
                minHeight: '120px'
              }}>
                {maskSensitiveText(result.sanitized_response)}
              </div>
            </div>
          </div>

          {/* Flags */}
          {result.flags.length > 0 && (
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '16px' }}>
                Detected Violations ({result.flags.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {result.flags.map((flag, idx) => (
                  <div
                    key={idx}
                    className="flag-row"
                    style={{
                      background: 'var(--bg-main)',
                      border: '1px solid var(--border-card)',
                      borderLeft: `4px solid ${flag.severity === 'CRITICAL' || flag.severity === 'HIGH' ? 'var(--risk-high)' : flag.severity === 'MEDIUM' ? 'var(--risk-med)' : 'var(--risk-low)'}`,
                      padding: '12px 16px',
                      borderRadius: '4px 6px 6px 4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.85rem'
                    }}
                  >
                    <div>
                      <strong style={{ color: 'var(--text-main)', marginRight: '8px' }}>{flag.rule}</strong>
                      <span style={{ color: 'var(--text-muted)' }}>{maskSensitiveText(flag.detail)}</span>
                    </div>
                    {flag.detected_value && (
                      <code style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-card)',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        color: 'var(--text-main)',
                        flexShrink: 0,
                        marginLeft: '16px'
                      }}>
                        {maskDetectedValue(flag.detected_value, flag.rule)}
                      </code>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigate to HITL */}
          {result.requires_hitl && (
            <button
              onClick={onNavigateToReviews}
              className="btn-danger"
              style={{ width: '100%', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '1rem' }}
            >
              <AlertTriangle size={20} />
              <span>View in Human Review Queue</span>
              <ArrowRight size={20} />
            </button>
          )}
        </>
      )}
    </div>
  );
};
