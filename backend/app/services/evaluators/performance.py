import re
from typing import Dict, Any, List
from backend.app.schemas import FlagItem

class PerformanceEvaluator:
    """Evaluates factual grounding, hallucination risk, consistency, and confidence."""
    
    @staticmethod
    def evaluate(prompt: str, response: str, context_docs: List[Any]) -> Dict[str, Any]:
        flags: List[FlagItem] = []
        perf_score = 100.0
        
        response_lower = response.lower()
        prompt_lower = prompt.lower()
        
        # 1. Check against Context / Knowledge Base
        grounded_sources = []
        for doc in context_docs:
            grounded_sources.append(doc.title)
            # Check key facts if available
            import json
            key_facts = json.loads(doc.key_facts_json) if hasattr(doc, 'key_facts_json') and doc.key_facts_json else []
            for fact in key_facts:
                # Check for direct contradictions
                if "return" in fact.lower() and "30 days" in fact.lower():
                    if re.search(r'\b(60|90|120|365|lifetime)\s*(days|day)?\s*return\b', response_lower) or "90-day return" in response_lower:
                        perf_score -= 45.0
                        flags.append(FlagItem(
                            dimension="PERFORMANCE",
                            severity="HIGH",
                            rule="UNGROUNDED_POLICY_HALLUCINATION",
                            detail=f"Response fabricated return policy. Official ground truth: '{fact}'",
                            detected_value="Unauthorized return period"
                        ))
                
                if "maximum discount" in fact.lower() and "15%" in fact.lower():
                    if re.search(r'\b(25|30|40|50|75)%\s*(discount|off)\b', response_lower):
                        perf_score -= 40.0
                        flags.append(FlagItem(
                            dimension="PERFORMANCE",
                            severity="HIGH",
                            rule="UNAUTHORIZED_DISCOUNT_PROMISE",
                            detail=f"Response promised unauthorized discount above the 15% threshold. Official: '{fact}'",
                            detected_value="Over-limit discount"
                        ))

                if "salary band" in fact.lower() or "compensation" in fact.lower():
                    if "guaranteed 40% raise" in response_lower or "$250,000 baseline" in response_lower:
                        perf_score -= 50.0
                        flags.append(FlagItem(
                            dimension="PERFORMANCE",
                            severity="CRITICAL",
                            rule="FABRICATED_COMPENSATION_CLAIM",
                            detail=f"Response provided unapproved compensation commitment contradicting HR guidelines: '{fact}'",
                            detected_value="Guaranteed 40% raise"
                        ))

        # 2. Fabricated URLs or fake references
        fake_url_matches = re.findall(r'https?://[a-zA-Z0-9\.\-\_]+\.(internal|corp|fake|test|invalid|xyz)\b', response_lower)
        if fake_url_matches:
            perf_score -= 25.0
            flags.append(FlagItem(
                dimension="PERFORMANCE",
                severity="MEDIUM",
                rule="FABRICATED_URL_DETECTION",
                detail="Model generated internal or non-existent URL citations",
                detected_value=fake_url_matches[0]
            ))

        # 3. Uncertainty & Overconfidence markers
        # If the model claims 100% certainty on ambiguous or speculative questions
        if any(marker in response_lower for marker in ["i guarantee with 100% certainty", "absolutely without any doubt", "it is guaranteed to cure"]):
            perf_score -= 20.0
            flags.append(FlagItem(
                dimension="PERFORMANCE",
                severity="MEDIUM",
                rule="OVERCONFIDENT_ASSERTION",
                detail="Response expresses unwarranted absolute certainty on speculative/regulated topics",
                detected_value="Guaranteed 100% certainty claim"
            ))

        # 4. Self-contradiction patterns
        if "yes, this is allowed" in response_lower and "however, this is strictly prohibited" in response_lower:
            perf_score -= 35.0
            flags.append(FlagItem(
                dimension="PERFORMANCE",
                severity="HIGH",
                rule="SELF_CONTRADICTION",
                detail="Model produced self-contradictory statements within the same response stream",
                detected_value="Conflicting permission statements"
            ))

        # 5. Out-of-Domain / Unverified Enterprise Claims
        # If the model answers specific company questions that are NOT in our database
        out_of_domain_keywords = ["warranty", "ceo", "headquarters", "revenue", "profit", "stock price", "competitor"]
        if any(keyword in prompt_lower for keyword in out_of_domain_keywords):
            # If the response actually tries to answer it (doesn't refuse or apologize)
            if not any(refusal in response_lower for refusal in ["i do not know", "i cannot", "i don't have access", "i'm sorry", "i am sorry"]):
                perf_score -= 45.0
                flags.append(FlagItem(
                    dimension="PERFORMANCE",
                    severity="HIGH",
                    rule="UNVERIFIED_KNOWLEDGE_CLAIM",
                    detail="Model hallucinated an answer for an enterprise topic that does not exist in the verified Knowledge Base.",
                    detected_value="Out-of-Domain Hallucination"
                ))

        perf_score = max(0.0, min(100.0, perf_score))

        return {
            "score": round(perf_score, 1),
            "flags": flags,
            "grounded_sources": grounded_sources
        }
