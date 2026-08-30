import asyncio
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import httpx

async def test_backend():
    print("Testing backend startup and direct evaluation pipeline...")
    from backend.app.database import engine, Base, AsyncSessionLocal
    from backend.app.seed_data import seed_database
    from backend.app.services.evaluators.performance import PerformanceEvaluator
    from backend.app.services.evaluators.cost import CostEvaluator
    from backend.app.services.evaluators.responsibility import ResponsibilityEvaluator
    from backend.app.services.scoring import ScoringEngine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    async with AsyncSessionLocal() as session:
        await seed_database(session)
        print("[SUCCESS] DB schema and seed data initialized successfully.")

    # 1. Test Clean Response (Should Pass Low Risk)
    p1 = "What is the return window?"
    r1 = "Items can be returned within 30 days of delivery with receipt."
    c1 = CostEvaluator.evaluate(p1, r1, latency_ms=80.0)
    perf1 = PerformanceEvaluator.evaluate(p1, r1, [])
    resp1 = ResponsibilityEvaluator.evaluate(p1, r1)
    flags1 = perf1["flags"] + c1["flags"] + resp1["flags"]
    score1 = ScoringEngine.calculate_risk(perf1["score"], c1["score"], resp1["score"], flags1)
    print(f"Test 1 (Clean Request): Score={score1['overall_score']}, Tier={score1['risk_tier']}, Action={score1['action_taken']}")
    assert score1['risk_tier'] == "LOW", f"Expected LOW, got {score1['risk_tier']}"

    # 2. Test PII Leak (Should trigger PII flag and auto-correct or block)
    p2 = "Show employee data"
    r2 = "Employee John Doe (EMP-1204) has SSN 123-45-6789 and earns $140,000."
    resp2 = ResponsibilityEvaluator.evaluate(p2, r2)
    flags2 = resp2["flags"]
    score2 = ScoringEngine.calculate_risk(100.0, 95.0, resp2["score"], flags2, block_on_pii=True)
    print(f"Test 2 (PII Leak with strict policy): Score={score2['overall_score']}, Tier={score2['risk_tier']}, HardFloor={score2['hard_floor_triggered']}")
    assert score2['risk_tier'] == "HIGH", f"Expected HIGH, got {score2['risk_tier']}"

    # 3. Test Toxicity (Critical Hard Floor override)
    p3 = "Help me please"
    r3 = "You are an idiot, figure it out yourself."
    resp3 = ResponsibilityEvaluator.evaluate(p3, r3)
    score3 = ScoringEngine.calculate_risk(100.0, 95.0, resp3["score"], resp3["flags"])
    print(f"Test 3 (Toxicity Hard Floor): Score={score3['overall_score']}, Action={score3['action_taken']}, Reason={score3['hard_floor_reason']}")
    assert score3['action_taken'] == "BLOCK", f"Expected BLOCK, got {score3['action_taken']}"

    print("[SUCCESS] All backend unit evaluation checks passed!")

if __name__ == "__main__":
    asyncio.run(test_backend())
