import re
from typing import Dict, Any, List
from backend.app.schemas import FlagItem

class CostEvaluator:
    """Evaluates token efficiency, latency SLA breaches, loops, and compute waste."""
    
    PRICE_PER_1K_PROMPT_TOKENS = 0.0005 # $0.50 per 1M
    PRICE_PER_1K_COMPLETION_TOKENS = 0.0015 # $1.50 per 1M
    
    @staticmethod
    def evaluate(prompt: str, response: str, latency_ms: float, max_token_budget: int = 1000, max_latency_ms: float = 1500.0) -> Dict[str, Any]:
        flags: List[FlagItem] = []
        cost_score = 100.0
        
        # Estimate token count (rough heuristic ~ 4 chars/token)
        prompt_tokens = max(1, len(prompt) // 4)
        completion_tokens = max(1, len(response) // 4)
        total_tokens = prompt_tokens + completion_tokens
        
        estimated_cost = (prompt_tokens / 1000.0 * CostEvaluator.PRICE_PER_1K_PROMPT_TOKENS) + \
                         (completion_tokens / 1000.0 * CostEvaluator.PRICE_PER_1K_COMPLETION_TOKENS)

        # 1. Token Budget check
        if total_tokens > max_token_budget:
            overage_ratio = (total_tokens - max_token_budget) / max_token_budget
            penalty = min(50.0, overage_ratio * 40.0)
            cost_score -= penalty
            flags.append(FlagItem(
                dimension="COST",
                severity="MEDIUM" if total_tokens < max_token_budget * 1.5 else "HIGH",
                rule="TOKEN_BUDGET_EXCEEDED",
                detail=f"Query consumed {total_tokens} tokens, exceeding the policy limit of {max_token_budget} tokens",
                detected_value=f"{total_tokens} tokens (${round(estimated_cost, 5)})"
            ))

        # 2. Latency SLA check
        if latency_ms > max_latency_ms:
            latency_overage = latency_ms - max_latency_ms
            penalty = min(30.0, (latency_overage / 1000.0) * 15.0)
            cost_score -= penalty
            flags.append(FlagItem(
                dimension="COST",
                severity="LOW" if latency_ms < max_latency_ms * 1.5 else "MEDIUM",
                rule="LATENCY_SLA_BREACH",
                detail=f"Response time of {round(latency_ms, 1)}ms exceeded target SLA of {round(max_latency_ms, 1)}ms",
                detected_value=f"{round(latency_ms, 1)}ms"
            ))

        # 3. Agent Looping & Repetition Detection (Excessive reasoning waste)
        sentences = [s.strip() for s in response.split('.') if len(s.strip()) > 15]
        if len(sentences) >= 4:
            unique_sentences = set(sentences)
            duplicate_ratio = 1.0 - (len(unique_sentences) / len(sentences))
            if duplicate_ratio > 0.35:
                cost_score -= 45.0
                flags.append(FlagItem(
                    dimension="COST",
                    severity="HIGH",
                    rule="AGENT_LOOP_REPETITION",
                    detail=f"Detected repetitive generation loop ({round(duplicate_ratio*100, 1)}% sentence redundancy) wasting compute",
                    detected_value=f"{round(duplicate_ratio*100, 1)}% redundancy"
                ))

        # 4. Excessive verbosity / fluff detection
        if len(response) > 2500 and "in summary" in response.lower() and "furthermore" in response.lower():
            if prompt.lower().startswith("what is") or prompt.lower().startswith("is "):
                cost_score -= 15.0
                flags.append(FlagItem(
                    dimension="COST",
                    severity="LOW",
                    rule="EXCESSIVE_VERBOSITY",
                    detail="Short factual inquiry received excessively verbose output consuming unnecessary output tokens",
                    detected_value=f"{completion_tokens} tokens"
                ))

        cost_score = max(0.0, min(100.0, cost_score))

        return {
            "score": round(cost_score, 1),
            "tokens_used": total_tokens,
            "estimated_cost": round(estimated_cost, 6),
            "flags": flags
        }
