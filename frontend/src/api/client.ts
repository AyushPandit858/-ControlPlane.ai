export interface FlagItem {
  dimension: 'PERFORMANCE' | 'COST' | 'RESPONSIBILITY';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  rule: string;
  detail: string;
  detected_value?: string;
}

export interface EvaluationResponse {
  id: number;
  timestamp: string;
  use_case: string;
  prompt: string;
  raw_response: string;
  sanitized_response: string;
  perf_score: number;
  cost_score: number;
  resp_score: number;
  overall_score: number;
  risk_tier: 'LOW' | 'MEDIUM' | 'HIGH';
  action_taken: 'PASS' | 'AUTO_CORRECT' | 'BLOCK' | 'HUMAN_OVERRIDDEN';
  hard_floor_triggered: boolean;
  hard_floor_reason?: string;
  flags: FlagItem[];
  latency_ms: number;
  llm_latency_ms: number;
  overhead_ms: number;
  tokens_used: number;
  estimated_cost: number;
  ground_truth_references: string[];
  policy_name?: string;
  policy_snapshot: Record<string, unknown>;
  requires_hitl: boolean;
}

export interface HITLReviewItem {
  id: number;
  log_id: number;
  created_at: string;
  status: 'PENDING' | 'APPROVED' | 'MODIFIED' | 'REJECTED';
  original_prompt: string;
  original_response: string;
  corrected_response?: string;
  reviewer_notes?: string;
  risk_reasons?: string;
  resolved_at?: string;
  risk_tier?: 'LOW' | 'MEDIUM' | 'HIGH';
  use_case?: string;
  overall_score?: number;
}

export interface PolicyRule {
  id: number;
  use_case: string;
  name: string;
  description?: string;
  min_pass_score: number;
  min_autocorrect_score: number;
  perf_weight: number;
  cost_weight: number;
  resp_weight: number;
  block_on_pii: boolean;
  block_on_toxicity: boolean;
  block_on_hallucination: boolean;
  max_latency_budget_ms: number;
  max_token_budget: number;
  updated_at: string;
}

export interface AnalyticsSummary {
  total_evaluations: number;
  pass_count: number;
  autocorrect_count: number;
  blocked_count: number;
  pass_rate: number;
  avg_score: number;
  avg_latency_ms: number;
  avg_overhead_ms: number;
  total_cost_spent: number;
  cost_saved_estimated: number;
  pending_reviews: number;
  approved_by_human: number;
  modified_by_human: number;
  rejected_by_human: number;
  feedback_records: number;
  risk_distribution: { [key: string]: number };
  dimension_averages: { [key: string]: number };
  use_case_stats: Array<{
    use_case: string;
    count: number;
    pass_rate: number;
    avg_score: number;
  }>;
  recent_trend: Array<{
    id: number;
    time: string;
    score: number;
    latency: number;
    action: string;
    tier: string;
  }>;
}

export interface KnowledgeDocument {
  id: number;
  department: string;
  title: string;
  content: string;
  key_facts: string[];
  tags: string[];
  created_at: string;
}

const API_BASE = '/api';

export const apiClient = {
  async evaluate(data: {
    prompt: string;
    use_case: string;
    model_provider?: string;
    simulated_flaw?: string | null;
    custom_policy_override?: Record<string, any>;
  }): Promise<EvaluationResponse> {
    const res = await fetch(`${API_BASE}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(`Evaluation failed: ${res.statusText}`);
    return res.json();
  },

  async getReviews(status?: string): Promise<HITLReviewItem[]> {
    const url = status ? `${API_BASE}/reviews?status=${status}` : `${API_BASE}/reviews`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch review queue');
    return res.json();
  },

  async resolveReview(
    reviewId: number,
    resolution: {
      status: 'APPROVED' | 'MODIFIED' | 'REJECTED';
      corrected_response?: string;
      reviewer_notes?: string;
      feed_back_to_policy?: boolean;
    }
  ): Promise<any> {
    const res = await fetch(`${API_BASE}/reviews/${reviewId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resolution)
    });
    if (!res.ok) throw new Error('Failed to resolve review');
    return res.json();
  },

  async getPolicies(): Promise<PolicyRule[]> {
    const res = await fetch(`${API_BASE}/policies`);
    if (!res.ok) throw new Error('Failed to fetch policies');
    return res.json();
  },

  async updatePolicy(policyId: number, data: Partial<PolicyRule>): Promise<PolicyRule> {
    const res = await fetch(`${API_BASE}/policies/${policyId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update policy');
    return res.json();
  },

  async getAnalytics(): Promise<AnalyticsSummary> {
    const res = await fetch(`${API_BASE}/analytics`);
    if (!res.ok) throw new Error('Failed to fetch analytics');
    return res.json();
  },

  async getKnowledge(department?: string): Promise<KnowledgeDocument[]> {
    const url = department ? `${API_BASE}/knowledge?department=${department}` : `${API_BASE}/knowledge`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch knowledge base');
    return res.json();
  },

  async createKnowledge(data: {
    department: string;
    title: string;
    content: string;
    key_facts: string[];
    tags: string[];
  }): Promise<KnowledgeDocument> {
    const res = await fetch(`${API_BASE}/knowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create knowledge document');
    return res.json();
  },

  async getLogs(limit: number = 30): Promise<any[]> {
    const res = await fetch(`${API_BASE}/logs?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch logs');
    return res.json();
  }
};
