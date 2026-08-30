from typing import Dict, Any, List, Optional
from backend.app.schemas import FlagItem

class ScoringEngine:
    """Aggregates multi-pillar signals, checks Hard Floor overrides, and computes routing decision."""
    
    @staticmethod
    def calculate_risk(
        perf_score: float,
        cost_score: float,
        resp_score: float,
        flags: List[FlagItem],
        perf_weight: float = 0.40,
        cost_weight: float = 0.20,
        resp_weight: float = 0.40,
        min_pass_threshold: float = 85.0,
        min_autocorrect_threshold: float = 50.0,
        block_on_pii: bool = False,
        block_on_toxicity: bool = True,
        block_on_hallucination: bool = True,
    ) -> Dict[str, Any]:
        
        # 1. Calculate Weighted Overall Quality/Safety Score (0 - 100)
        overall_score = (perf_score * perf_weight) + (cost_score * cost_weight) + (resp_score * resp_weight)
        overall_score = round(max(0.0, min(100.0, overall_score)), 1)
        
        # 2. Evaluate Hard Floor Critical Violations
        hard_floor_triggered = False
        hard_floor_reason: Optional[str] = None
        
        for flag in flags:
            # Payment-card exposure remains a non-negotiable safety floor.
            if flag.rule == "PII_LEAK_CREDIT_CARD":
                hard_floor_triggered = True
                hard_floor_reason = f"Critical violation: {flag.rule} ({flag.detail})"
                break

            if flag.rule == "TOXIC_CONTENT_DETECTED" and block_on_toxicity:
                hard_floor_triggered = True
                hard_floor_reason = f"Toxicity policy violation: {flag.detail}"
                break
            
            # Policy toggle: if block_on_pii is strict and high severity PII is found
            if block_on_pii and "PII_LEAK" in flag.rule and flag.severity in ["HIGH", "CRITICAL"]:
                hard_floor_triggered = True
                hard_floor_reason = f"Strict PII Policy violation: {flag.rule}"
                break

            # Use cases can decide whether severe factual violations must stop
            # the response or can be routed for correction.
            if (
                block_on_hallucination
                and flag.dimension == "PERFORMANCE"
                and flag.severity in ["HIGH", "CRITICAL"]
                and perf_score < 40.0
            ):
                hard_floor_triggered = True
                hard_floor_reason = f"Severe ungrounded hallucination detected: {flag.detail}"
                break

        # 3. Determine Risk Tier & Action
        if hard_floor_triggered or overall_score < min_autocorrect_threshold:
            risk_tier = "HIGH"
            action_taken = "BLOCK"
        elif overall_score >= min_pass_threshold:
            risk_tier = "LOW"
            action_taken = "PASS"
        else: # 50% - 84.9%
            risk_tier = "MEDIUM"
            action_taken = "AUTO_CORRECT"

        return {
            "overall_score": overall_score,
            "risk_tier": risk_tier,
            "action_taken": action_taken,
            "hard_floor_triggered": hard_floor_triggered,
            "hard_floor_reason": hard_floor_reason
        }
