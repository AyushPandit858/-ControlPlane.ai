from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
import datetime

# --- Knowledge Schemas ---
class KnowledgeDocCreate(BaseModel):
    department: str
    title: str
    content: str
    key_facts: List[str] = []
    tags: List[str] = []

class KnowledgeDocResponse(BaseModel):
    id: int
    department: str
    title: str
    content: str
    key_facts: List[str]
    tags: List[str]
    created_at: datetime.datetime

    class Config:
        from_attributes = True


# --- Policy Schemas ---
class PolicyRuleCreate(BaseModel):
    use_case: str
    name: str
    description: Optional[str] = None
    min_pass_score: float = 85.0
    min_autocorrect_score: float = 50.0
    perf_weight: float = 0.40
    cost_weight: float = 0.20
    resp_weight: float = 0.40
    block_on_pii: bool = False
    block_on_toxicity: bool = True
    block_on_hallucination: bool = True
    max_latency_budget_ms: float = 1500.0
    max_token_budget: int = 1000

class PolicyRuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    min_pass_score: Optional[float] = None
    min_autocorrect_score: Optional[float] = None
    perf_weight: Optional[float] = None
    cost_weight: Optional[float] = None
    resp_weight: Optional[float] = None
    block_on_pii: Optional[bool] = None
    block_on_toxicity: Optional[bool] = None
    block_on_hallucination: Optional[bool] = None
    max_latency_budget_ms: Optional[float] = None
    max_token_budget: Optional[int] = None

class PolicyRuleResponse(BaseModel):
    id: int
    use_case: str
    name: str
    description: Optional[str]
    min_pass_score: float
    min_autocorrect_score: float
    perf_weight: float
    cost_weight: float
    resp_weight: float
    block_on_pii: bool
    block_on_toxicity: bool
    block_on_hallucination: bool
    max_latency_budget_ms: float
    max_token_budget: int
    updated_at: datetime.datetime

    class Config:
        from_attributes = True


# --- Evaluation & Middleware Schemas ---
class EvaluateRequest(BaseModel):
    prompt: str
    use_case: str = Field(default="customer_support", description="e.g. customer_support, hr_copilot, financial_advisor")
    model_provider: Optional[str] = "simulation" # or "gemini", "openai"
    simulated_flaw: Optional[str] = None # None, "hallucination", "pii_leak", "toxic", "cost_loop", "mixed"
    custom_policy_override: Optional[Dict[str, Any]] = None

class FlagItem(BaseModel):
    dimension: str # PERFORMANCE, COST, RESPONSIBILITY
    severity: str # LOW, MEDIUM, HIGH, CRITICAL
    rule: str
    detail: str
    detected_value: Optional[str] = None

class EvaluationResponse(BaseModel):
    id: int
    timestamp: datetime.datetime
    use_case: str
    prompt: str
    raw_response: str
    sanitized_response: str
    
    # 3 Pillar Scores & Overall
    perf_score: float
    cost_score: float
    resp_score: float
    overall_score: float
    
    # Action & Routing
    risk_tier: str # LOW, MEDIUM, HIGH
    action_taken: str # PASS, AUTO_CORRECT, BLOCK
    
    # Diagnostics
    hard_floor_triggered: bool
    hard_floor_reason: Optional[str] = None
    flags: List[FlagItem] = []
    
    # Telemetry
    latency_ms: float
    llm_latency_ms: float
    overhead_ms: float
    tokens_used: int
    estimated_cost: float
    
    # Context
    ground_truth_references: List[str] = []
    policy_name: Optional[str] = None
    policy_snapshot: Dict[str, Any] = {}
    requires_hitl: bool = False


# --- HITL Review Schemas ---
class ReviewResolveRequest(BaseModel):
    status: str = Field(..., description="APPROVED, MODIFIED, REJECTED")
    corrected_response: Optional[str] = None
    reviewer_notes: Optional[str] = None
    feed_back_to_policy: bool = True

class HITLReviewResponse(BaseModel):
    id: int
    log_id: int
    created_at: datetime.datetime
    status: str
    original_prompt: str
    original_response: str
    corrected_response: Optional[str]
    reviewer_notes: Optional[str]
    risk_reasons: Optional[str]
    resolved_at: Optional[datetime.datetime]
    
    # Parent log details for UI preview
    risk_tier: Optional[str] = None
    use_case: Optional[str] = None
    overall_score: Optional[float] = None

    class Config:
        from_attributes = True


# --- Analytics Schemas ---
class AnalyticsSummary(BaseModel):
    total_evaluations: int
    pass_count: int
    autocorrect_count: int
    blocked_count: int
    pass_rate: float
    avg_score: float
    avg_latency_ms: float
    avg_overhead_ms: float
    total_cost_spent: float
    cost_saved_estimated: float
    pending_reviews: int
    approved_by_human: int = 0
    modified_by_human: int = 0
    rejected_by_human: int = 0
    feedback_records: int = 0
    risk_distribution: Dict[str, int]
    dimension_averages: Dict[str, float]
    use_case_stats: List[Dict[str, Any]]
    recent_trend: List[Dict[str, Any]]
