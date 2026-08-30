import { useState, useEffect } from 'react';
import {
  Activity, CheckCircle2, AlertTriangle, XCircle, DollarSign,
  Clock, Shield, Layers, Search, RefreshCw, ArrowUpRight
} from 'lucide-react';
import { apiClient } from '../api/client';
import type { AnalyticsSummary } from '../api/client';

export const AnalyticsDashboard: React.FC = () => {
  const [stats, setStats] = useState<AnalyticsSummary | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [analyticsData, logsData] = await Promise.all([
        apiClient.getAnalytics(),
        apiClient.getLogs(40)
      ]);
      setStats(analyticsData);
      setLogs(logsData);
      setLastUpdated(new Date());
    } catch {
      setError('Metrics could not be refreshed. Check that the gateway is running, then try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredLogs = logs.filter(l => 
    l.prompt.toLowerCase().includes(searchFilter.toLowerCase()) ||
    l.use_case.toLowerCase().includes(searchFilter.toLowerCase()) ||
    l.action_taken.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="page-shell">
      
      {/* Top Header */}
      <div className="card section-header" style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity size={24} color="var(--accent-blue)" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>Executive AI Governance Analytics</h2>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Real-time telemetry for routed interactions, intervention rate, gateway latency, and auditable review outcomes.
          </p>
        </div>

        <div className="header-actions" style={{ alignItems: 'center', gap: '12px' }}>
          {lastUpdated && (
            <span style={{ fontSize: '0.8rem', color: 'var(--risk-low)', fontWeight: 500 }} aria-live="polite">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button onClick={fetchData} disabled={loading} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px' }}>
          <RefreshCw size={16} className={loading ? 'pulse-animation' : ''} />
          <span style={{ fontWeight: 600 }}>{loading ? 'Refreshing...' : 'Refresh Metrics'}</span>
          </button>
        </div>
      </div>

      {error && <div className="status-message" role="alert">{error}</div>}

      {/* KPI Cards Ribbon */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          
          {/* Card 1: Total Queries */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500 }}>
              <span>Total Interactions</span>
              <Layers size={18} color="var(--primary)" />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'JetBrains Mono', marginTop: '12px', color: 'var(--text-main)' }}>
              {stats.total_evaluations}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--risk-low)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
              <ArrowUpRight size={14} /> 100% In-Line Inspection
            </div>
          </div>

          {/* Card 2: Pass Rate */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500 }}>
              <span>Pass Rate (Low Risk)</span>
              <CheckCircle2 size={18} color="var(--risk-low)" />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'JetBrains Mono', marginTop: '12px', color: 'var(--text-main)' }}>
              {stats.pass_rate}%
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>
              {stats.pass_count} passed cleanly
            </div>
          </div>

          {/* Card 3: Intercepted Violations */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500 }}>
              <span>Mitigated / Blocked</span>
              <Shield size={18} color="var(--risk-high)" />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'JetBrains Mono', marginTop: '12px', color: 'var(--text-main)' }}>
              {stats.autocorrect_count + stats.blocked_count}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>
              {stats.autocorrect_count} auto-redacted, {stats.blocked_count} blocked
            </div>
          </div>

          {/* Card 4: Estimated Cost Saved */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500 }}>
              <span>Intervention Compute Cost</span>
              <DollarSign size={18} color="var(--risk-med)" />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'JetBrains Mono', marginTop: '12px', color: 'var(--text-main)' }}>
              ${stats.cost_saved_estimated}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>
              generated cost on blocked or safeguarded responses
            </div>
          </div>

          {/* Card 5: Mean Overhead */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500 }}>
              <span>Avg Gateway Overhead</span>
              <Clock size={18} color="var(--accent-blue)" />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'JetBrains Mono', marginTop: '12px', color: 'var(--text-main)' }}>
              {stats.avg_overhead_ms}ms
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--risk-low)', marginTop: '8px', fontWeight: 500 }}>
              ⚡ Ultra low latency
            </div>
          </div>

        </div>
      )}

      {/* Pillar Breakdown & Risk Tier Distribution */}
      {stats && (
        <div className="two-column-grid" style={{ gap: '24px' }}>
          
          {/* Pillar Performance Scores */}
          <div className="card" style={{ padding: '32px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '24px', color: 'var(--text-main)' }}>
              3-Pillar Fleet Quality Averages
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Performance */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-main)', marginBottom: '8px' }}>
                  <span>1. Performance (Grounding & Factuality)</span>
                  <span style={{ fontWeight: 700, fontFamily: 'JetBrains Mono', color: 'var(--accent-blue)' }}>{stats.dimension_averages.perf}%</span>
                </div>
                <div style={{ height: '8px', background: 'var(--border-card)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${stats.dimension_averages.perf}%`, height: '100%', background: 'var(--accent-blue)' }} />
                </div>
              </div>

              {/* Cost & Efficiency */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-main)', marginBottom: '8px' }}>
                  <span>2. Cost & Efficiency (Token & SLA Control)</span>
                  <span style={{ fontWeight: 700, fontFamily: 'JetBrains Mono', color: 'var(--accent-pink)' }}>{stats.dimension_averages.cost}%</span>
                </div>
                <div style={{ height: '8px', background: 'var(--border-card)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${stats.dimension_averages.cost}%`, height: '100%', background: 'var(--accent-pink)' }} />
                </div>
              </div>

              {/* Responsibility */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-main)', marginBottom: '8px' }}>
                  <span>3. Responsibility (PII, Toxicity, Bias)</span>
                  <span style={{ fontWeight: 700, fontFamily: 'JetBrains Mono', color: 'var(--risk-low)' }}>{stats.dimension_averages.resp}%</span>
                </div>
                <div style={{ height: '8px', background: 'var(--border-card)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${stats.dimension_averages.resp}%`, height: '100%', background: 'var(--risk-low)' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Risk Tier Distribution */}
          <div className="card" style={{ padding: '32px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '24px', color: 'var(--text-main)' }}>
              Risk Tier Routing Breakdown
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Low Risk */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'var(--risk-low-bg)', borderRadius: '8px', border: '1px solid var(--risk-low-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <CheckCircle2 size={24} color="var(--risk-low)" />
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--risk-low)' }}>LOW RISK (&ge;85%)</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', fontWeight: 500, marginTop: '2px' }}>Direct Pass-Through</div>
                  </div>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'JetBrains Mono', color: 'var(--risk-low)' }}>
                  {stats.risk_distribution.LOW || 0}
                </div>
              </div>

              {/* Medium Risk */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'var(--risk-med-bg)', borderRadius: '8px', border: '1px solid var(--risk-med-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <AlertTriangle size={24} color="var(--risk-med)" />
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--risk-med)' }}>MEDIUM RISK (50-84%)</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', fontWeight: 500, marginTop: '2px' }}>Auto-Correct / Redaction</div>
                  </div>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'JetBrains Mono', color: 'var(--risk-med)' }}>
                  {stats.risk_distribution.MEDIUM || 0}
                </div>
              </div>

              {/* High Risk */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'var(--risk-high-bg)', borderRadius: '8px', border: '1px solid var(--risk-high-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <XCircle size={24} color="var(--risk-high)" />
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--risk-high)' }}>HIGH RISK (&lt;50% / Critical)</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', fontWeight: 500, marginTop: '2px' }}>Block & Human Triage</div>
                  </div>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'JetBrains Mono', color: 'var(--risk-high)' }}>
                  {stats.risk_distribution.HIGH || 0}
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Live Audit Stream Table */}
      <div className="card" style={{ padding: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)' }}>Continuous Telemetry & Audit Stream</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>Live immutable log of all evaluated enterprise LLM responses</p>
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', width: '320px' }}>
            <Search size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '14px' }} />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search prompt, use case, or action..."
              style={{ width: '100%', paddingLeft: '40px', padding: '12px 12px 12px 36px', fontSize: '0.85rem' }}
            />
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-card)', color: 'var(--text-muted)', fontWeight: 600 }}>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>ID / Time</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Use Case</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Prompt</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Pillar Breakdown</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Overall Score</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Decision</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Overhead</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid var(--border-card)', transition: 'background 0.2s' }}>
                  <td style={{ padding: '16px', fontFamily: 'JetBrains Mono', color: 'var(--text-dim)' }}>
                    #{log.id} <br />
                    <span style={{ fontSize: '0.75rem' }}>{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{
                      padding: '4px 10px',
                      background: 'var(--bg-card-hover)',
                      border: '1px solid var(--border-card)',
                      borderRadius: '16px',
                      fontSize: '0.75rem',
                      color: 'var(--text-main)',
                      fontWeight: 500
                    }}>
                      {log.use_case}
                    </span>
                  </td>
                  <td style={{ padding: '16px', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-main)', fontWeight: 500 }}>
                    {log.prompt}
                  </td>
                  <td style={{ padding: '16px', fontFamily: 'JetBrains Mono', fontSize: '0.8rem', fontWeight: 500 }}>
                    <span style={{ color: 'var(--accent-blue)' }}>P:{log.perf_score}%</span> | <span style={{ color: 'var(--accent-pink)' }}>C:{log.cost_score}%</span> | <span style={{ color: 'var(--risk-low)' }}>R:{log.resp_score}%</span>
                  </td>
                  <td style={{ padding: '16px', fontFamily: 'JetBrains Mono', fontWeight: 700, color: log.overall_score >= 85 ? 'var(--risk-low)' : log.overall_score >= 50 ? 'var(--risk-med)' : 'var(--risk-high)' }}>
                    {log.overall_score}%
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span className={`badge ${log.risk_tier === 'LOW' ? 'badge-low' : log.risk_tier === 'MEDIUM' ? 'badge-med' : 'badge-high'}`}>
                      {log.action_taken}
                    </span>
                  </td>
                  <td style={{ padding: '16px', fontFamily: 'JetBrains Mono', color: 'var(--risk-low)', fontWeight: 500 }}>
                    +{log.overhead_ms}ms
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
};
