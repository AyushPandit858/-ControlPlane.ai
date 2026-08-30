import re
from typing import List, Tuple

class MitigationService:
    """Applies auto-correction strategies: PII masking, disclaimer injection, and text refinement."""
    
    @staticmethod
    def auto_redact_pii(text: str, pii_matches: List[Tuple[str, str, str]]) -> str:
        sanitized = text
        for pii_type, raw_val, _ in pii_matches:
            # Replace exact substring
            placeholder = f" [REDACTED_{pii_type}] "
            sanitized = sanitized.replace(raw_val, placeholder)
        return sanitized

    @staticmethod
    def append_disclaimer(text: str, reason: str = "AI-generated content - verified by ControlPlane.ai") -> str:
        disclaimer = f"\n\n---\nℹ️ *Policy Notice: {reason}*"
        return text + disclaimer

    @staticmethod
    def generate_safe_fallback(use_case: str, issue_reason: str) -> str:
        return (
            f"⚠️ **Response Intercepted by ControlPlane.ai Governance**\n\n"
            f"The generated response for `{use_case}` was flagged for **{issue_reason}** and has been held for Human Review before release.\n\n"
            f"*An authorized compliance reviewer has been notified in the HITL triage console.*"
        )
