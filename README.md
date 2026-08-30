# ControlPlane.ai — Real-Time Responsible AI Guardrail & Efficiency Middleware

> **Accenture Innovation Challenge 2026 — Round 2 Prototype Development**  
> **Problem Track 1:** ControlPlane.ai  
> **Team:** Ghee Khatam (*Ayush Pandit, Ayush Kumar Bansal, Tabrez Alam — IIT Guwahati*)

---

## 🌟 Overview & Problem Statement

Enterprises run Generative AI across diverse mission-critical workloads (customer-facing chatbots, internal employee copilots, and regulated financial/decision-support assistants). Every deployment carries three compounding risks:
1. **Performance Risk**: Confidently wrong hallucinations and ungrounded policy deviations.
2. **Cost Risk**: Silent token leakage, latency SLA overruns, and repetitive agent reasoning loops.
3. **Responsibility Risk**: PII disclosures (SSNs, salaries), toxic outbursts, and demographic bias patterns.

**ControlPlane.ai** is a latency-aware middleware prototype that intercepts LLM responses before they reach the end user. It evaluates responses across **Performance, Cost, and Responsibility**, computes a multi-signal risk score with policy-controlled **Hard-Floor safety overrides**, and routes actions according to the **Check $\rightarrow$ Score $\rightarrow$ Act** paradigm.

---

## 🚀 Key Features

### 1. 3-Pillar Parallel Inspection Engine
- **Performance Evaluator**: Factual grounding check against an enterprise Ground-Truth Knowledge DB, hallucination detection (e.g. fabricated return windows or unauthorized discount promises), and uncertainty calibration.
- **Cost & Efficiency Evaluator**: Token expenditure tracking, latency budget SLA monitoring, and repetitive agent loop / compute waste detection.
- **Responsibility Evaluator**: Deterministic regex & entity classifier for PII (SSNs, credit cards, emails, employee IDs, salary figures), zero-tolerance toxicity filter, and corporate bias pattern detection.

### 2. Multi-Signal Scoring & Hard-Floor Safety Override
- **Weighted Quality Score**: $S = w_{\text{perf}} S_{\text{perf}} + w_{\text{cost}} S_{\text{cost}} + w_{\text{resp}} S_{\text{resp}}$
- **Hard Floor Rules**: Use-case policies can enforce immediate blocks for severe PII, toxicity, and hallucination breaches.

### 3. Risk-Based Action Routing (Check $\rightarrow$ Score $\rightarrow$ Act)
| Tier | Score Range | Action | Description |
| :--- | :--- | :--- | :--- |
| 🟢 **Low Risk** | $\ge 85\%$ | **PASS INSTANTLY** | Passes straight through to the user. Logged silently for background telemetry. No delay or overhead. |
| 🟡 **Medium Risk** | $50\% - 84\%$ | **AUTO-CORRECT & REDACT** | Auto-redacts detected PII, appends policy notices, or refines output without blocking user workflow. |
| 🔴 **High Risk** | $< 50\%$ or Hard Floor | **BLOCK & ESCALATE** | Raw response is blocked and held in the **Human-in-the-Loop (HITL)** triage console. |

### 4. Human-in-the-Loop (HITL) Triage Console & Auditable Feedback
- Real-time incident queue displaying blocked responses with risk rationale.
- Reviewer actions: **Sanitize & Release**, **Release with documented exception**, or **Confirm Block**.
- **Auditable Feedback**: Reviewer corrections and policy-review suggestions are stored for governance teams to assess.

### 5. Enterprise Governance & Executive Analytics
- **Executive Dashboard**: Fleet-wide pass rate, intervention count, review outcomes, inspected-model cost, and mean gateway overhead.
- **Department Policy Engine**: Configurable thresholds, weights, and SLA budgets for Customer Support, HR, and Financial Advisory.
- **Ground-Truth Knowledge Base**: Managed repository of verified facts for grounding verification.

---

## 🛠️ Architecture

```
[ Enterprise App / User Query ]
               │
               ▼
   [ ControlPlane Gateway API ] ───────► [ Ground-Truth DB ]
               │
   ┌───────────┴───────────┐
   ▼                       ▼
[ Primary LLM ]   [ Evaluator Fleet (Parallel) ]
(Gemini / OpenAI /  ├── 1. Performance (Grounding vs DB)
 Simulation Engine) ├── 2. Cost & Efficiency (Tokens, Loops)
   │               └── 3. Responsibility (PII, Toxicity)
   │                       │
   └───────────┬───────────┘
               ▼
     [ Multi-Signal Scorer ]
   (Weighted + Hard Floor Rules)
               │
       ┌───────┴───────┐
       ▼               ▼               ▼
 🟢 LOW RISK     🟡 MEDIUM RISK   🔴 HIGH RISK
 (Pass Through)  (Auto-Redact)    (Block & Route)
                                       │
                                       ▼
                             [ HITL Review Queue ]
                                       │
                                       ▼
                           [ Closed-Loop Feedback ]
```

---

## 💻 Tech Stack

- **Backend**: Python 3.14, FastAPI, SQLAlchemy (Async), SQLite/aiosqlite, Pydantic v2, Uvicorn, HTTPX.
- **Frontend**: Vite 8, React 19, TypeScript, Lucide Icons, and a responsive enterprise dashboard UI.
- **Evaluation**: Parallel deterministic entity classifiers, pattern engines, and semantic fact cross-checkers.

---

## ⚡ Quickstart & Running Locally

### 1. Backend Setup
```bash
# Navigate to project root
cd -ControlPlane.ai

# Install python dependencies
pip install -r backend/requirements.txt

# Start FastAPI Gateway Server (port 8000)
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

### 2. Frontend Setup
```bash
# In a second terminal, navigate to frontend/
cd frontend

# Install npm dependencies
npm install

# Start Vite Development Server (port 5173)
npm run dev
```

Open `http://localhost:5173` in your browser to interact with the full ControlPlane.ai portal.

---

## 🧪 Test Scenarios Included in Prototype

1. **Customer Support — Standard Valid Return**: Valid 30-day return inquiry $\rightarrow$ **🟢 PASS** ($100\%$ score, &lt;12ms overhead).
2. **Customer Support — Severe Hallucination**: Model invents unauthorized 90-day return & 50% discount $\rightarrow$ **🔴 BLOCKED** (Ungrounded factual violation).
3. **HR Copilot — Critical PII Leak**: Model leaks employee salary ($185k) and SSN (412-88-9021) $\rightarrow$ **🔴 BLOCKED via Hard-Floor Override**.
4. **Financial Advisory — Toxic Outburst**: Model outputs abusive language $\rightarrow$ **🔴 BLOCKED** (Zero-tolerance safety trigger).
5. **Agent Loop — Excessive Reasoning Waste**: Model runs in duplicate sentence loops $\rightarrow$ **🟡 AUTO-CORRECTED / FLAGGED**.
6. **HR Screening — Bias Pattern**: Discriminatory hiring assertion $\rightarrow$ **🔴 BLOCKED** (Compliance violation).

---

## 👥 Team Details

- **Ayush Pandit** — IIT Guwahati (ECE)
- **Ayush Kumar Bansal** — IIT Guwahati (Chemical)
- **Tabrez Alam** — IIT Guwahati (Chemical)
- **Team Name**: Ghee Khatam
