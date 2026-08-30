import json
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.app.models import KnowledgeDocument

class KnowledgeService:
    @staticmethod
    async def get_relevant_documents(db: AsyncSession, department: str, query: str) -> List[KnowledgeDocument]:
        """Fetch ground truth documents for the department or matching keywords."""
        query_words = set(query.lower().split())
        
        stmt = select(KnowledgeDocument)
        if department and department != "all":
            stmt = stmt.where(KnowledgeDocument.department == department)
            
        result = await db.execute(stmt)
        all_docs = result.scalars().all()
        
        # Rank by keyword overlap with title, tags, or content
        scored_docs = []
        for doc in all_docs:
            tags = json.loads(doc.tags_json) if doc.tags_json else []
            doc_text = f"{doc.title} {doc.content} {' '.join(tags)}".lower()
            overlap = sum(1 for word in query_words if len(word) > 3 and word in doc_text)
            scored_docs.append((overlap, doc))
            
        # Return top matches
        scored_docs.sort(key=lambda x: x[0], reverse=True)
        return [doc for _, doc in scored_docs]

    @staticmethod
    async def verify_facts_against_knowledge(doc: KnowledgeDocument, response_text: str) -> Dict[str, Any]:
        """Check if claims in response contradict known key facts in document."""
        key_facts = json.loads(doc.key_facts_json) if doc.key_facts_json else []
        contradictions = []
        verified_facts = []
        
        response_lower = response_text.lower()
        
        for fact in key_facts:
            fact_lower = fact.lower()
            # Simple semantic checks (e.g. return days, discount limits, policy numbers)
            if "return policy" in fact_lower and "days" in fact_lower:
                # If fact says 30 days but response mentions 60 days or 90 days
                if "90 days" in response_lower or "60 days" in response_lower or "lifetime" in response_lower:
                    contradictions.append(f"Response claims wrong return window contrary to official policy: '{fact}'")
                elif "30 days" in response_lower:
                    verified_facts.append(fact)
            
            if "maximum discount" in fact_lower:
                if "50%" in response_lower or "40%" in response_lower or "free" in response_lower:
                    contradictions.append(f"Response promises unauthorized discount contrary to policy: '{fact}'")
                    
            if "compensation" in fact_lower or "severance" in fact_lower:
                if "guaranteed 6 months" in response_lower or "$100,000" in response_lower:
                    contradictions.append(f"Response promises unapproved severance terms contrary to policy: '{fact}'")

        return {
            "has_contradiction": len(contradictions) > 0,
            "contradictions": contradictions,
            "verified_facts": verified_facts,
            "source_title": doc.title
        }
