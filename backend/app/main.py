import asyncio
import time
import json
import datetime
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func

from backend.app.config import settings
from backend.app.database import engine, Base, get_db
from backend.app.models import EvaluationLog, HITLReview, PolicyRule, KnowledgeDocument, PolicyFeedback
from backend.app.schemas import (
    EvaluateRequest, EvaluationResponse, FlagItem,
    HITLReviewResponse, ReviewResolveRequest,
    PolicyRuleResponse, PolicyRuleUpdate,
    KnowledgeDocResponse, KnowledgeDocCreate,
    AnalyticsSummary
)
from backend.app.services.llm_client import LLMClient
from backend.app.services.knowledge_service import KnowledgeService
from backend.app.services.evaluators.performance import PerformanceEvaluator
from backend.app.services.evaluators.cost import CostEvaluator
from backend.app.services.evaluators.responsibility import ResponsibilityEvaluator
from backend.app.services.scoring import ScoringEngine
from backend.app.services.mitigation import MitigationService
from backend.app.seed_data import seed_database

app = FastAPI(title=settings.APP_NAME, version="2.0.0")

# Enable CORS for frontend Vite app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "ControlPlane.ai API is running. Visit /docs for the API documentation."}

def validate_policy_values(values: dict) -> None:
    """Keep policy edits mathematically and operationally safe."""
    weights = [values["perf_weight"], values["cost_weight"], values["resp_weight"]]
    if any(weight < 0 or weight > 1 for weight in weights):
        raise HTTPException(status_code=422, detail="Each pillar weight must be between 0 and 1.")
    if abs(sum(weights) - 1.0) > 0.001:
        raise HTTPException(status_code=422, detail="Performance, cost, and responsibility weights must total 1.0.")
    if not 0 <= values["min_autocorrect_score"] < values["min_pass_score"] <= 100:
        raise HTTPException(status_code=422, detail="Thresholds must satisfy 0 <= auto-correct < pass <= 100.")
    if values["max_latency_budget_ms"] <= 0 or values["max_token_budget"] <= 0:
        raise HTTPException(status_code=422, detail="Latency and token budgets must be positive.")

@app.on_event("startup")
async def startup_event():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Run seed script
    from backend.app.database import AsyncSessionLocal
    async with AsyncSessionLocal() as session:
        await seed_database(session)

# -------------------------------------------------------------
# 1. CORE PIPELINE: EVALUATE & GUARD
# -------------------------------------------------------------
@app.post(f"{settings.API_PREFIX}/evaluate", response_model=EvaluationResponse)
async def evaluate_interaction(
    req: EvaluateRequest,
    db: AsyncSession = Depends(get_db)
):
    total_start_time = time.time()
    
    # 1. Fetch Policy for the Use Case
    policy_stmt = select(PolicyRule).where(PolicyRule.use_case == req.use_case)
    policy_res = await db.execute(policy_stmt)
    policy = policy_res.scalars().first()
    
    # Default policy parameters if not found
    min_pass = policy.min_pass_score if policy else settings.LOW_RISK_THRESHOLD
    min_auto = policy.min_autocorrect_score if policy else settings.MEDIUM_RISK_THRESHOLD
    w_perf = policy.perf_weight if policy else settings.PERFORMANCE_WEIGHT
    w_cost = policy.cost_weight if policy else settings.COST_WEIGHT
    w_resp = policy.resp_weight if policy else settings.RESPONSIBILITY_WEIGHT
    block_pii = policy.block_on_pii if policy else False
    block_toxicity = policy.block_on_toxicity if policy else True
    block_hallucination = policy.block_on_hallucination if policy else True
    max_tokens = policy.max_token_budget if policy else 1000
    max_latency = policy.max_latency_budget_ms if policy else 1500.0
    
    # Allow dynamic custom override if requested
    if req.custom_policy_override:
        min_pass = req.custom_policy_override.get("min_pass_score", min_pass)
        min_auto = req.custom_policy_override.get("min_autocorrect_score", min_auto)
        w_perf = req.custom_policy_override.get("perf_weight", w_perf)
        w_cost = req.custom_policy_override.get("cost_weight", w_cost)
        w_resp = req.custom_policy_override.get("resp_weight", w_resp)
        block_pii = req.custom_policy_override.get("block_on_pii", block_pii)
        block_toxicity = req.custom_policy_override.get("block_on_toxicity", block_toxicity)
        block_hallucination = req.custom_policy_override.get("block_on_hallucination", block_hallucination)

    active_policy = {
        "name": policy.name if policy else "Default policy",
        "min_pass_score": min_pass,
        "min_autocorrect_score": min_auto,
        "perf_weight": w_perf,
        "cost_weight": w_cost,
        "resp_weight": w_resp,
        "block_on_pii": block_pii,
        "block_on_toxicity": block_toxicity,
        "block_on_hallucination": block_hallucination,
        "max_token_budget": max_tokens,
        "max_latency_budget_ms": max_latency,
    }
    validate_policy_values(active_policy)

    # 2. Fetch Relevant Ground Truth Context
    context_docs = await KnowledgeService.get_relevant_documents(db, req.use_case, req.prompt)

    # 3. Call Primary LLM
    llm_result = await LLMClient.generate_response(
        prompt=req.prompt,
        use_case=req.use_case,
        model_provider=req.model_provider or "simulation",
        simulated_flaw=req.simulated_flaw
    )
    raw_response = llm_result["text"]
    llm_latency_ms = llm_result["llm_latency_ms"]

    # 4. PARALLEL 3-PILLAR EVALUATION
    eval_start_time = time.time()
    
    perf_res, cost_res, resp_res = await asyncio.gather(
        asyncio.to_thread(PerformanceEvaluator.evaluate, req.prompt, raw_response, context_docs),
        asyncio.to_thread(CostEvaluator.evaluate, req.prompt, raw_response, llm_latency_ms, max_tokens, max_latency),
        asyncio.to_thread(ResponsibilityEvaluator.evaluate, req.prompt, raw_response),
    )
    
    all_flags: List[FlagItem] = perf_res["flags"] + cost_res["flags"] + resp_res["flags"]
    
    # 5. Multi-Signal Scoring + Hard Floor Rules
    risk_assessment = ScoringEngine.calculate_risk(
        perf_score=perf_res["score"],
        cost_score=cost_res["score"],
        resp_score=resp_res["score"],
        flags=all_flags,
        perf_weight=w_perf,
        cost_weight=w_cost,
        resp_weight=w_resp,
        min_pass_threshold=min_pass,
        min_autocorrect_threshold=min_auto,
        block_on_pii=block_pii,
        block_on_toxicity=block_toxicity,
        block_on_hallucination=block_hallucination,
    )
    
    # 6. Apply Mitigation / Sanitization
    action_taken = risk_assessment["action_taken"]
    sanitized_response = raw_response
    requires_hitl = False
    
    if action_taken == "BLOCK":
        sanitized_response = MitigationService.generate_safe_fallback(
            req.use_case, 
            risk_assessment["hard_floor_reason"] or f"Risk Score ({risk_assessment['overall_score']}%) below allowable safety threshold"
        )
        requires_hitl = True
    elif action_taken == "AUTO_CORRECT":
        # Apply PII auto-redaction if any PII was detected
        if resp_res.get("pii_matches"):
            sanitized_response = MitigationService.auto_redact_pii(sanitized_response, resp_res["pii_matches"])
        # Append policy disclaimer
        sanitized_response = MitigationService.append_disclaimer(sanitized_response)
    else: # PASS
        # Clean pass-through
        pass

    eval_end_time = time.time()
    overhead_ms = round((eval_end_time - eval_start_time) * 1000.0, 2)
    total_latency_ms = round((eval_end_time - total_start_time) * 1000.0, 2)

    # 7. Persist Evaluation Log in DB
    flags_data = [f.model_dump() for f in all_flags]
    metrics_data = {
        "perf": perf_res["score"],
        "cost": cost_res["score"],
        "resp": resp_res["score"],
        "tokens": cost_res["tokens_used"],
        "estimated_usd": cost_res["estimated_cost"],
        "policy": active_policy,
    }
    
    log_entry = EvaluationLog(
        use_case=req.use_case,
        prompt=req.prompt,
        raw_response=raw_response,
        sanitized_response=sanitized_response,
        perf_score=perf_res["score"],
        cost_score=cost_res["score"],
        resp_score=resp_res["score"],
        overall_score=risk_assessment["overall_score"],
        risk_tier=risk_assessment["risk_tier"],
        action_taken=action_taken,
        latency_ms=total_latency_ms,
        llm_latency_ms=llm_latency_ms,
        overhead_ms=overhead_ms,
        tokens_used=cost_res["tokens_used"],
        estimated_cost=cost_res["estimated_cost"],
        hard_floor_triggered=risk_assessment["hard_floor_triggered"],
        hard_floor_reason=risk_assessment["hard_floor_reason"],
        flags_json=json.dumps(flags_data),
        metrics_json=json.dumps(metrics_data)
    )
    db.add(log_entry)
    await db.flush()

    # 8. Create HITL Review item if blocked
    if requires_hitl:
        hitl_entry = HITLReview(
            log_id=log_entry.id,
            status="PENDING",
            original_prompt=req.prompt,
            original_response=raw_response,
            risk_reasons=risk_assessment["hard_floor_reason"] or f"Overall Score {risk_assessment['overall_score']}% under threshold"
        )
        db.add(hitl_entry)

    await db.commit()

    return EvaluationResponse(
        id=log_entry.id,
        timestamp=log_entry.timestamp,
        use_case=req.use_case,
        prompt=req.prompt,
        raw_response=raw_response,
        sanitized_response=sanitized_response,
        perf_score=perf_res["score"],
        cost_score=cost_res["score"],
        resp_score=resp_res["score"],
        overall_score=risk_assessment["overall_score"],
        risk_tier=risk_assessment["risk_tier"],
        action_taken=action_taken,
        hard_floor_triggered=risk_assessment["hard_floor_triggered"],
        hard_floor_reason=risk_assessment["hard_floor_reason"],
        flags=all_flags,
        latency_ms=total_latency_ms,
        llm_latency_ms=llm_latency_ms,
        overhead_ms=overhead_ms,
        tokens_used=cost_res["tokens_used"],
        estimated_cost=cost_res["estimated_cost"],
        ground_truth_references=perf_res.get("grounded_sources", []),
        policy_name=active_policy["name"],
        policy_snapshot=active_policy,
        requires_hitl=requires_hitl
    )

# -------------------------------------------------------------
# 2. HITL (HUMAN IN THE LOOP) REVIEWS
# -------------------------------------------------------------
@app.get(f"{settings.API_PREFIX}/reviews", response_model=List[HITLReviewResponse])
async def get_reviews(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(HITLReview, EvaluationLog).join(EvaluationLog, HITLReview.log_id == EvaluationLog.id).order_by(desc(HITLReview.created_at))
    if status and status != "ALL":
        stmt = stmt.where(HITLReview.status == status)
        
    result = await db.execute(stmt)
    rows = result.all()
    
    reviews = []
    for hitl, log in rows:
        reviews.append(HITLReviewResponse(
            id=hitl.id,
            log_id=hitl.log_id,
            created_at=hitl.created_at,
            status=hitl.status,
            original_prompt=hitl.original_prompt,
            original_response=hitl.original_response,
            corrected_response=hitl.corrected_response,
            reviewer_notes=hitl.reviewer_notes,
            risk_reasons=hitl.risk_reasons,
            resolved_at=hitl.resolved_at,
            risk_tier=log.risk_tier,
            use_case=log.use_case,
            overall_score=log.overall_score
        ))
    return reviews

@app.post(f"{settings.API_PREFIX}/reviews/{{review_id}}/resolve")
async def resolve_review(
    review_id: int,
    req: ReviewResolveRequest,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(HITLReview, EvaluationLog).join(EvaluationLog, HITLReview.log_id == EvaluationLog.id).where(HITLReview.id == review_id)
    res = await db.execute(stmt)
    row = res.first()
    if not row:
        raise HTTPException(status_code=404, detail="Review not found")
        
    hitl, log = row
    if req.status not in ["APPROVED", "MODIFIED", "REJECTED"]:
        raise HTTPException(status_code=422, detail="Review status must be APPROVED, MODIFIED, or REJECTED.")
    if req.status == "APPROVED" and not (req.reviewer_notes or "").strip():
        raise HTTPException(status_code=422, detail="A reviewer rationale is required before releasing a blocked response.")
    if req.status == "MODIFIED" and not (req.corrected_response or "").strip():
        raise HTTPException(status_code=422, detail="A corrected response is required for a modified release.")
    hitl.status = req.status
    hitl.corrected_response = req.corrected_response
    hitl.reviewer_notes = req.reviewer_notes
    hitl.resolved_at = datetime.datetime.utcnow()
    
    if req.status in ["APPROVED", "MODIFIED"]:
        log.sanitized_response = req.corrected_response or hitl.original_response
        log.action_taken = "HUMAN_OVERRIDDEN"

    # Feedback log: reviewers create an auditable suggestion for later policy review.
    if req.feed_back_to_policy:
        feedback = PolicyFeedback(
            use_case=log.use_case,
            incident_type="HITL_RESOLUTION",
            original_text=hitl.original_response,
            corrected_text=req.corrected_response or "",
            human_verdict=req.status,
            learned_pattern=req.reviewer_notes or f"Reviewer resolved issue with status {req.status}",
            rule_update_suggested=f"Review guardrails for {log.use_case} based on human verdict: {req.status}"
        )
        db.add(feedback)

    await db.commit()
    return {"message": "Review resolved successfully", "review_id": review_id, "status": req.status}

# -------------------------------------------------------------
# 3. POLICIES & GOVERNANCE RULES
# -------------------------------------------------------------
@app.get(f"{settings.API_PREFIX}/policies", response_model=List[PolicyRuleResponse])
async def list_policies(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PolicyRule))
    return result.scalars().all()

@app.put(f"{settings.API_PREFIX}/policies/{{policy_id}}", response_model=PolicyRuleResponse)
async def update_policy(
    policy_id: int,
    update_data: PolicyRuleUpdate,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(PolicyRule).where(PolicyRule.id == policy_id)
    res = await db.execute(stmt)
    policy = res.scalars().first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")

    candidate = {
        field: getattr(policy, field)
        for field in [
            "min_pass_score", "min_autocorrect_score", "perf_weight", "cost_weight",
            "resp_weight", "max_latency_budget_ms", "max_token_budget"
        ]
    }
    candidate.update(update_data.model_dump(exclude_unset=True))
    validate_policy_values(candidate)

    for field, val in update_data.model_dump(exclude_unset=True).items():
        setattr(policy, field, val)

    await db.commit()
    await db.refresh(policy)
    return policy

# -------------------------------------------------------------
# 4. KNOWLEDGE BASE (GROUND TRUTH)
# -------------------------------------------------------------
@app.get(f"{settings.API_PREFIX}/knowledge", response_model=List[KnowledgeDocResponse])
async def get_knowledge(
    department: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(KnowledgeDocument)
    if department:
        stmt = stmt.where(KnowledgeDocument.department == department)
    result = await db.execute(stmt)
    docs = result.scalars().all()
    
    response = []
    for d in docs:
        response.append(KnowledgeDocResponse(
            id=d.id,
            department=d.department,
            title=d.title,
            content=d.content,
            key_facts=json.loads(d.key_facts_json) if d.key_facts_json else [],
            tags=json.loads(d.tags_json) if d.tags_json else [],
            created_at=d.created_at
        ))
    return response

@app.post(f"{settings.API_PREFIX}/knowledge", response_model=KnowledgeDocResponse)
async def create_knowledge(
    req: KnowledgeDocCreate,
    db: AsyncSession = Depends(get_db)
):
    doc = KnowledgeDocument(
        department=req.department,
        title=req.title,
        content=req.content,
        key_facts_json=json.dumps(req.key_facts),
        tags_json=json.dumps(req.tags)
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return KnowledgeDocResponse(
        id=doc.id,
        department=doc.department,
        title=doc.title,
        content=doc.content,
        key_facts=req.key_facts,
        tags=req.tags,
        created_at=doc.created_at
    )

# -------------------------------------------------------------
# 5. ANALYTICS & EXECUTIVE DASHBOARD
# -------------------------------------------------------------
@app.get(f"{settings.API_PREFIX}/analytics", response_model=AnalyticsSummary)
async def get_analytics(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(EvaluationLog).order_by(desc(EvaluationLog.timestamp)))
    logs = result.scalars().all()
    
    total = len(logs)
    if total == 0:
        return AnalyticsSummary(
            total_evaluations=0, pass_count=0, autocorrect_count=0, blocked_count=0,
            pass_rate=100.0, avg_score=100.0, avg_latency_ms=0.0, avg_overhead_ms=0.0,
            total_cost_spent=0.0, cost_saved_estimated=0.0, pending_reviews=0,
            approved_by_human=0, modified_by_human=0, rejected_by_human=0, feedback_records=0,
            risk_distribution={"LOW": 0, "MEDIUM": 0, "HIGH": 0},
            dimension_averages={"perf": 100.0, "cost": 100.0, "resp": 100.0},
            use_case_stats=[], recent_trend=[]
        )

    pass_count = sum(1 for l in logs if l.action_taken == "PASS")
    autocorrect_count = sum(1 for l in logs if l.action_taken == "AUTO_CORRECT")
    blocked_count = sum(1 for l in logs if l.action_taken == "BLOCK")
    
    avg_score = round(sum(l.overall_score for l in logs) / total, 1)
    avg_latency = round(sum(l.latency_ms for l in logs) / total, 1)
    avg_overhead = round(sum(l.overhead_ms for l in logs) / total, 1)
    total_cost = round(sum(l.estimated_cost for l in logs), 5)
    
    # Actual generated-model cost on interactions that required intervention.
    # This is deliberately not labelled as a business saving.
    cost_saved = round(
        sum(l.estimated_cost for l in logs if l.action_taken in ["BLOCK", "AUTO_CORRECT"]),
        6
    )

    # Pending HITL reviews
    reviews_res = await db.execute(select(func.count(HITLReview.id)).where(HITLReview.status == "PENDING"))
    pending_reviews = reviews_res.scalar() or 0
    review_status_rows = await db.execute(
        select(HITLReview.status, func.count(HITLReview.id)).group_by(HITLReview.status)
    )
    review_status_counts = dict(review_status_rows.all())
    feedback_res = await db.execute(select(func.count(PolicyFeedback.id)))
    feedback_records = feedback_res.scalar() or 0

    risk_dist = {
        "LOW": sum(1 for l in logs if l.risk_tier == "LOW"),
        "MEDIUM": sum(1 for l in logs if l.risk_tier == "MEDIUM"),
        "HIGH": sum(1 for l in logs if l.risk_tier == "HIGH"),
    }
    
    dim_avg = {
        "perf": round(sum(l.perf_score for l in logs) / total, 1),
        "cost": round(sum(l.cost_score for l in logs) / total, 1),
        "resp": round(sum(l.resp_score for l in logs) / total, 1),
    }

    # Breakdown by use case
    use_cases = set(l.use_case for l in logs)
    use_case_stats = []
    for uc in use_cases:
        uc_logs = [l for l in logs if l.use_case == uc]
        use_case_stats.append({
            "use_case": uc,
            "count": len(uc_logs),
            "pass_rate": round(sum(1 for l in uc_logs if l.action_taken == "PASS") / len(uc_logs) * 100, 1),
            "avg_score": round(sum(l.overall_score for l in uc_logs) / len(uc_logs), 1)
        })

    # Recent 10 queries trend
    recent_trend = []
    for l in logs[:10]:
        recent_trend.append({
            "id": l.id,
            "time": l.timestamp.strftime("%H:%M:%S"),
            "score": l.overall_score,
            "latency": l.latency_ms,
            "action": l.action_taken,
            "tier": l.risk_tier
        })

    return AnalyticsSummary(
        total_evaluations=total,
        pass_count=pass_count,
        autocorrect_count=autocorrect_count,
        blocked_count=blocked_count,
        pass_rate=round((pass_count / total) * 100.0, 1),
        avg_score=avg_score,
        avg_latency_ms=avg_latency,
        avg_overhead_ms=avg_overhead,
        total_cost_spent=total_cost,
        cost_saved_estimated=cost_saved,
        pending_reviews=pending_reviews,
        approved_by_human=review_status_counts.get("APPROVED", 0),
        modified_by_human=review_status_counts.get("MODIFIED", 0),
        rejected_by_human=review_status_counts.get("REJECTED", 0),
        feedback_records=feedback_records,
        risk_distribution=risk_dist,
        dimension_averages=dim_avg,
        use_case_stats=use_case_stats,
        recent_trend=recent_trend
    )

# -------------------------------------------------------------
# 6. RECENT EVALUATION LOGS
# -------------------------------------------------------------
@app.get(f"{settings.API_PREFIX}/logs")
async def get_logs(
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(EvaluationLog).order_by(desc(EvaluationLog.timestamp)).limit(limit)
    res = await db.execute(stmt)
    logs = res.scalars().all()
    
    result = []
    for l in logs:
        result.append({
            "id": l.id,
            "timestamp": l.timestamp,
            "use_case": l.use_case,
            "prompt": l.prompt,
            "raw_response": l.raw_response,
            "sanitized_response": l.sanitized_response,
            "perf_score": l.perf_score,
            "cost_score": l.cost_score,
            "resp_score": l.resp_score,
            "overall_score": l.overall_score,
            "risk_tier": l.risk_tier,
            "action_taken": l.action_taken,
            "latency_ms": l.latency_ms,
            "overhead_ms": l.overhead_ms,
            "tokens_used": l.tokens_used,
            "hard_floor_triggered": l.hard_floor_triggered,
            "hard_floor_reason": l.hard_floor_reason,
            "flags": json.loads(l.flags_json) if l.flags_json else []
        })
    return result
