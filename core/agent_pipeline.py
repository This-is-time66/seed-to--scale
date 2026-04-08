import os
import json
from typing import TypedDict, Dict
from langgraph.graph import StateGraph, END
from langchain_groq import ChatGroq

# ============================================================
# LLM SETUP
# ============================================================
llm = ChatGroq(model_name="llama-3.3-70b-versatile", temperature=0.7)

# ============================================================
# AGENT STATE
# ============================================================
class AgentState(TypedDict):
    concept: str
    research_data: Dict
    visionary_plan: Dict
    audit_passed: bool
    audit_feedback: str
    final_manifesto: str
    iteration_count: int

# ============================================================
# AGENT NODES
# ============================================================
def research_node(state: AgentState):
    prompt = f"""You are a senior market research analyst with 20 years of experience evaluating startups.
The founder has this startup concept: "{state['concept']}"

Your job is to produce a DEEP, SPECIFIC, REALISTIC market analysis using your knowledge base.
All market size and growth figures are YOUR BEST ESTIMATES based on your training knowledge — label them as "estimated".
Return ONLY a valid JSON object with this exact structure (no extra text, no markdown):
{{
  "market_size": "Your estimated TAM with specific number and labeled as estimated (e.g. $4.2B by 2027)",
  "growth_rate": "Your estimated market CAGR percentage, labeled as estimated",
  "competitors": [
    {{"name": "Competitor 1", "weakness": "their main weakness"}},
    {{"name": "Competitor 2", "weakness": "their main weakness"}},
    {{"name": "Competitor 3", "weakness": "their main weakness"}}
  ],
  "market_gap": "one critical unaddressed need in 1-2 sentences",
  "target_customer": "specific ICP: role, company size, pain point",
  "key_insight": "the single most important market insight that validates this idea"
}}"""

    res = llm.invoke(prompt)
    content = res.content.strip()
    if "```json" in content:
        content = content.split("```json")[1].split("```")[0].strip()
    elif "```" in content:
        content = content.split("```")[1].split("```")[0].strip()
    try:
        research = json.loads(content)
    except:
        research = {
            "market_size": "Market size data unavailable",
            "growth_rate": "N/A",
            "competitors": [
                {"name": "Incumbent A", "weakness": "Poor UX"},
                {"name": "Incumbent B", "weakness": "High pricing"},
                {"name": "Incumbent C", "weakness": "No AI integration"}
            ],
            "market_gap": "No AI-native, scalable solution exists for this problem.",
            "target_customer": "Mid-market SaaS companies, 50-500 employees",
            "key_insight": "The market is ready for a software-first disruption."
        }
    return {"research_data": research}


def visionary_node(state: AgentState):
    feedback = state.get('audit_feedback', 'None')
    research = state.get('research_data', {})

    prompt = f"""You are a world-class CTO and startup architect who has built and scaled 10+ startups from zero to Series B.
The founder needs a complete detailed technical strategy for their startup.

Startup Concept: {state['concept']}
Market Gap: {research.get('market_gap', 'N/A')}
Target Customer: {research.get('target_customer', 'N/A')}
Previous Audit Feedback: {feedback}

RULES:
- If feedback mentions hardware, IoT, or sensors — propose a pure SOFTWARE solution instead
- Be capital-efficient — this must work with a 3-5 person team and seed-stage budget
- Be VERY specific — name exact services and tools with reasons, no vague answers
- tech_stack must list 6-8 specific technologies with their exact purpose

Return ONLY a valid JSON object (no extra text, no markdown):
{{
  "pivot_title": "A catchy, memorable name for this technical strategy (4-6 words)",
  "technical_hook": "The core technical differentiator — what makes the engineering approach unique (2-3 sentences)",
  "value_proposition": "Single sentence: Who it helps, what problem it solves, how it's different",
  "revenue_model": "Primary monetization: SaaS tiers, usage-based, marketplace cut, etc.",
  "moat": "The defensible competitive advantage that is hard to copy",
  "tech_stack": ["Technology 1— purpose", "Technology 2— purpose", "Technology 3— purpose", "Technology 4— purpose","Technology 5 — purpose", "Technology 6 — purpose"],
  "time_to_mvp_weeks": 8
}}"""

    res = llm.invoke(prompt)
    content = res.content.strip()
    if "```json" in content:
        content = content.split("```json")[1].split("```")[0].strip()
    elif "```" in content:
        content = content.split("```")[1].split("```")[0].strip()
    try:
        plan = json.loads(content)
    except:
        plan = {
            "pivot_title": "AI Orchestration Platform",
            "technical_hook": "Event-driven serverless architecture with real-time AI inference.",
            "value_proposition": "Helps growth-stage startups automate operations with zero infrastructure overhead.",
            "revenue_model": "Usage-based SaaS: $0.01 per API call + $299/mo enterprise tier",
            "moat": "Proprietary training data flywheel from customer interactions",
            "tech_stack": ["Python FastAPI", "LangGraph", "Neon PostgreSQL", "React"],
            "time_to_mvp_weeks": "realistic number between 6 and 20 based on complexity"
        }

    return {
        "visionary_plan": plan,
        "iteration_count": state.get('iteration_count', 0) + 1
    }


def auditor_node(state: AgentState):
    plan = state['visionary_plan']
    title = plan.get('pivot_title', '').lower()
    hook = plan.get('technical_hook', '').lower()
    combined = title + " " + hook

    hardware_keywords = ["iot", "sensor", "hardware", "device", "chip", "embedded", "physical", "robot"]
    is_hardware = any(kw in combined for kw in hardware_keywords)

    if is_hardware and state['iteration_count'] < 2:
        return {
            "audit_passed": False,
            "audit_feedback": "REJECTED: Hardware and IoT components require significant capital burn at seed stage. Pivot to a pure software solution — consider Digital Twin simulation, AI analytics platform, or SaaS dashboard instead."
        }

    if not plan.get('revenue_model'):
        return {
            "audit_passed": False,
            "audit_feedback": "REJECTED: No clear revenue model defined. Must include a specific monetization strategy before proceeding."
        }

    return {
        "audit_passed": True,
        "audit_feedback": "APPROVED: Software-first architecture with clear revenue model. Capital-efficient for seed stage."
    }


def investor_node(state: AgentState):
    plan = state['visionary_plan']
    research = state['research_data']

    prompt = f"""You are a entrepreneur, CTO, and startup advisor who has taken 5 startups from idea to $10M ARR.
A first-time founder with ZERO prior experience needs a COMPLETE, DETAILED, ACTIONABLE blueprint to build their startup from scratch.
Every section must be long, specific, and practical. No vague advice. No developer cost estimates like "$15,000 for backend".
All cost figures must be stated as EXPECTED ESTIMATES based on your own knowledge, clearly labeled as estimated.
A first-time founder with no prior experience should finish reading this and know EXACTLY what to do next.

Startup: {state['concept']}
Strategy: {plan.get('pivot_title')} — {plan.get('value_proposition')}
Market: {research.get('market_size')} growing at {research.get('growth_rate')}
Moat: {plan.get('moat')}

Use this EXACT format with these EXACT section headers. Write each section in FULL detail and practical detail:

---

## 🚀 Executive Summary
Write 5-6 sentences covering: what the startup does, who it serves, why now is the right time, what the technical differentiator is, the revenue potential in Year 1 and Year 2, and the single most important reason this will win.

---

## 🏗️ System Design — Complete Architecture
Explain the full system design for this startup in detail:
- Overall architecture pattern to use (monolith vs microservices vs serverless — recommend one with reasoning)
- Which diagramming or system design platform to use for drawing the architecture (e.g. Excalidraw, Lucidchart, draw.io, Miro — recommend one with reasons)
- List every major component of the system: API Gateway, Auth Service, Core App Service, AI/ML Service, Database Layer, Cache Layer, Queue/Worker, CDN, Storage — explain what each does in this specific startup
- How these components communicate (REST, gRPC, message queues — recommend specific ones)
- Data flow: trace a typical user request from frontend to database and back
- Which third-party APIs to integrate and why

---
## 💻 Developer Machine Setup — Hardware Recommendations
Give specific hardware recommendations for a developer building this startup:
- Recommended RAM (minimum and ideal)
- Recommended processor (specific chip families)
- Storage type and size
- GPU requirement
- Operating system recommendation
- Recommended laptop models vs desktop tradeoffs for a solo founder

---

## 🛠️ Development Environment & Coding Platform
- Which code editor or IDE to use
- Essential VS Code extensions or IDE plugins to install
- How to set up a local development environment step by step
- Version control setup: Git, GitHub vs GitLab vs Bitbucket — recommend one

---

## 🖥️ Frontend Development — Complete Guide
- Framework decision with full justification
- UI component library recommendation
- List every MVP screen to build with what each screen does
- State management approach
- How to handle API calls from frontend to backend
- Deployment platform recommendation with expected monthly cost (labeled as estimated)
- Step-by-step deployment instructions

---

## ⚙️ Backend Development — Complete Guide
- Language and framework decision with full reasoning
- REST vs GraphQL decision with justification
- List every core MVP API endpoint with HTTP method, route, and what it does
- Authentication approach
- How to handle background jobs
- Security checklist
- Deployment platform with expected monthly cost (labeled as estimated)

---

## 🤖 AI/ML Integration — Complete Guide
- Which AI model or API to use for this specific startup
- Expected API cost estimate per 1000 users per month (labeled as estimated)
- Prompt engineering strategy specific to this startup's use case with 2 example prompts
- RAG vs fine-tuning vs pure prompt engineering — recommend one approach
- How to reduce latency
- How to prevent hallucinations in AI output for this domain
- How to store and use conversation history

---

## ☁️ Cloud Infrastructure — Complete Guide
- Cloud provider recommendation
- Specific services to use and what each does
- Initial server setup
- CI/CD pipeline setup
- Auto-scaling setup
- Monitoring and alerting stack
- Backup and disaster recovery strategy

---

## 💰 Expected Cost Overview (Estimated)
All figures are expected estimates based on general industry knowledge. Label everything clearly as estimated.
Break down expected monthly infrastructure costs for three phases:
- MVP Phase (0–100 users)
- Growth Phase (100–1,000 users)
- Scale Phase (1,000–10,000 users)
DO NOT include development team salary costs. Only include cloud, API, and tool costs.

---

## 🧪 Testing Strategy — Complete Guide
- What types of testing to do
- Which testing frameworks to use
- How to write your first unit test for the core feature
- How to set up automated testing in the CI/CD pipeline
- How to do manual QA before each release
- Load testing tool recommendation

---

## 🚀 Launch Strategy — How to Go Live
- Step-by-step pre-launch checklist (at least 10 specific items)
- How to do a soft launch vs full public launch
- How to set up error monitoring before going live
- Beta tester recruitment strategy
- How to collect and act on early user feedback

---

## 🌐 Domain & SSL Setup — Complete Guide
- Which domain registrar to use and why
- How to choose the right domain name
- Step-by-step DNS configuration
- How to get a free SSL certificate using Let's Encrypt
- How to set up automatic SSL renewal
- How to connect the domain to the cloud deployment

---

## 📈 Auto-Scaling Setup — Complete Guide
- Horizontal vs vertical scaling explained
- How to configure AWS Auto Scaling Groups or equivalent
- What metrics to use as triggers (specific numbers)
- How load balancers work
- How to make the application stateless
- Database connection pooling during scale events
- Expected cost behavior during scale events

---

## ⚠️ Risk Analysis & Mitigation
List at least 8 specific risks with mitigation strategy for each:
- Technical, Market, Financial, Security, Operational risks
For each risk: describe it, its likelihood, impact, and specific mitigation strategy.

---

## 🗓️ 12-Month Execution Roadmap
Month 1–2, 3–4, 5–6, 7–9, 10–12 with specific, actionable tasks for each period.
Write every section in full. Be opinionated. Be specific.
A first-time founder must finish reading this and know EXACTLY what to do next at every stage.
"""

    res = llm.invoke(prompt)
    return {"final_manifesto": res.content}


# ============================================================
# ROUTING LOGIC
# ============================================================
def should_continue(state: AgentState):
    return "investor" if state["audit_passed"] else "visionary"


# ============================================================
# BUILD & COMPILE GRAPH
# ============================================================
def build_pipeline():
    workflow = StateGraph(AgentState)
    workflow.add_node("researcher", research_node)
    workflow.add_node("visionary", visionary_node)
    workflow.add_node("auditor", auditor_node)
    workflow.add_node("investor", investor_node)
    workflow.set_entry_point("researcher")
    workflow.add_edge("researcher", "visionary")
    workflow.add_edge("visionary", "auditor")
    workflow.add_conditional_edges(
        "auditor",
        should_continue,
        {"visionary": "visionary", "investor": "investor"}
    )
    workflow.add_edge("investor", END)
    return workflow.compile()

# Compiled graph — imported and used by app.py
app_graph = build_pipeline()