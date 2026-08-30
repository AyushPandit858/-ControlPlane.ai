import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.database import Base

class EvaluationLog(Base):
    __tablename__ = "evaluation_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    use_case = Column(String(50), index=True, default="general")
    prompt = Column(Text, nullable=False)
    raw_response = Column(Text, nullable=False)
    sanitized_response = Column(Text, nullable=True)
    
    # 3 Pillar Scores (0 - 100)
    perf_score = Column(Float, nullable=False)
    cost_score = Column(Float, nullable=False)
    resp_score = Column(Float, nullable=False)
    overall_score = Column(Float, nullable=False)
    
    # Routing decision: LOW, MEDIUM, HIGH
    risk_tier = Column(String(20), index=True, nullable=False)
    # Action taken: PASS, AUTO_CORRECT, BLOCK
    action_taken = Column(String(20), index=True, nullable=False)
    
    # Telemetry
    latency_ms = Column(Float, default=0.0)
    llm_latency_ms = Column(Float, default=0.0)
    overhead_ms = Column(Float, default=0.0)
    tokens_used = Column(Integer, default=0)
    estimated_cost = Column(Float, default=0.0) # in USD
    
    # Diagnostics & Flags
    hard_floor_triggered = Column(Boolean, default=False)
    hard_floor_reason = Column(String(255), nullable=True)
    flags_json = Column(Text, default="[]") # Detailed array of triggered rules/findings
    metrics_json = Column(Text, default="{}") # Breakdown per dimension

    # Relationships
    hitl_review = relationship("HITLReview", back_populates="log", uselist=False)


class HITLReview(Base):
    __tablename__ = "hitl_reviews"

    id = Column(Integer, primary_key=True, index=True)
    log_id = Column(Integer, ForeignKey("evaluation_logs.id"), unique=True, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    status = Column(String(20), default="PENDING", index=True) # PENDING, APPROVED, MODIFIED, REJECTED
    original_prompt = Column(Text, nullable=False)
    original_response = Column(Text, nullable=False)
    corrected_response = Column(Text, nullable=True)
    reviewer_notes = Column(Text, nullable=True)
    risk_reasons = Column(Text, nullable=True)
    resolved_at = Column(DateTime, nullable=True)

    log = relationship("EvaluationLog", back_populates="hitl_review")


class PolicyRule(Base):
    __tablename__ = "policy_rules"

    id = Column(Integer, primary_key=True, index=True)
    use_case = Column(String(50), unique=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    
    # Custom Thresholds
    min_pass_score = Column(Float, default=85.0)
    min_autocorrect_score = Column(Float, default=50.0)
    
    # Dimension Weights (Total = 1.0)
    perf_weight = Column(Float, default=0.40)
    cost_weight = Column(Float, default=0.20)
    resp_weight = Column(Float, default=0.40)
    
    # Rule Toggles
    block_on_pii = Column(Boolean, default=False) # If false, auto-redacts (Medium), if true blocks (High)
    block_on_toxicity = Column(Boolean, default=True)
    block_on_hallucination = Column(Boolean, default=True)
    max_latency_budget_ms = Column(Float, default=1500.0)
    max_token_budget = Column(Integer, default=1000)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class KnowledgeDocument(Base):
    __tablename__ = "knowledge_documents"

    id = Column(Integer, primary_key=True, index=True)
    department = Column(String(50), index=True) # e.g., "customer_support", "hr", "finance", "medical"
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    key_facts_json = Column(Text, default="[]") # Verified ground truth facts
    tags_json = Column(Text, default="[]")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class PolicyFeedback(Base):
    __tablename__ = "policy_feedback"

    id = Column(Integer, primary_key=True, index=True)
    use_case = Column(String(50), index=True)
    incident_type = Column(String(50)) # HALLUCINATION, PII_LEAK, TOXICITY, COST_OVERRUN
    original_text = Column(Text)
    corrected_text = Column(Text)
    human_verdict = Column(String(50))
    learned_pattern = Column(Text)
    rule_update_suggested = Column(Text)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
