import os
import json
import uuid
from dotenv import load_dotenv

# Load env FIRST before anything else imports os.environ
load_dotenv()

# Set GROQ key for LangChain before importing agent pipeline
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
if GROQ_API_KEY:
    os.environ["GROQ_API_KEY"] = GROQ_API_KEY

from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from passlib.context import CryptContext

from core.database import (
    db_fetch_one, db_fetch_all, db_execute,
    create_access_token, decode_token, pwd_context
)
from core.models import AuthRequest, IdeaRequest
from core.agent_pipeline import app_graph

# ============================================================
# APP INIT
# ============================================================
app = FastAPI(title="Seed to Scale — Venture Architecture")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

security = HTTPBearer()

# ============================================================
# AUTH DEPENDENCY
# ============================================================
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token. Please log in again.")
    user = db_fetch_one("SELECT * FROM users WHERE id = %s", (payload.get("sub"),))
    if not user:
        raise HTTPException(status_code=401, detail="User not found.")
    return user

# ============================================================
# FRONTEND ROUTE
# ============================================================
@app.get("/")
def read_root(request: Request):
    return templates.TemplateResponse(request=request, name="index.html")

# ============================================================
# AUTH ROUTES
# ============================================================
@app.post("/signup")
def signup(req: AuthRequest):
    existing = db_fetch_one("SELECT id FROM users WHERE email = %s", (req.email,))
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")
    hashed = pwd_context.hash(req.password[:72])
    user_id = str(uuid.uuid4())
    db_execute(
        "INSERT INTO users (id, name, email, password_hash) VALUES (%s, %s, %s, %s)",
        (user_id, req.name, req.email, hashed)
    )
    return {"message": "Account created! You can now log in.", "email": req.email}


@app.post("/login")
def login(req: AuthRequest):
    user = db_fetch_one("SELECT * FROM users WHERE email = %s", (req.email,))
    if not user or not pwd_context.verify(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    token = create_access_token({"sub": str(user["id"])})
    return {
        "access_token": token,
        "email": user["email"],
        "name": user["name"] or ""
    }

# ============================================================
# PROFILE ROUTE
# ============================================================
@app.get("/profile")
def get_profile(user=Depends(get_current_user)):
    count_row = db_fetch_one(
        "SELECT COUNT(*) as cnt FROM chat_history WHERE user_id = %s",
        (str(user["id"]),)
    )
    return {
        "name": user["name"] or "",
        "email": user["email"],
        "analysis_count": count_row["cnt"] if count_row else 0,
        "member_since": user["created_at"].isoformat() if user["created_at"] else None
    }

# ============================================================
# PIPELINE ROUTE
# ============================================================
@app.post("/run")
def run_pipeline(req: IdeaRequest, user=Depends(get_current_user)):
    initial_state = {
        "concept": req.concept,
        "iteration_count": 0,
        "audit_passed": False,
        "research_data": {},
        "visionary_plan": {},
        "audit_feedback": "",
        "final_manifesto": ""
    }
    result = app_graph.invoke(initial_state)

    db_execute(
        """INSERT INTO chat_history
           (user_id, concept, research_data, visionary_plan, audit_feedback, iteration_count, final_manifesto)
           VALUES (%s, %s, %s, %s, %s, %s, %s)""",
        (
            str(user["id"]),
            req.concept,
            json.dumps(result["research_data"]),
            json.dumps(result["visionary_plan"]),
            result["audit_feedback"],
            result["iteration_count"],
            result["final_manifesto"]
        )
    )

    return {
        "research_data": result["research_data"],
        "visionary_plan": result["visionary_plan"],
        "audit_feedback": result["audit_feedback"],
        "iteration_count": result["iteration_count"],
        "final_manifesto": result["final_manifesto"]
    }

# ============================================================
# HISTORY ROUTES
# ============================================================
@app.get("/history")
def get_history(user=Depends(get_current_user)):
    rows = db_fetch_all(
        """SELECT id, concept, iteration_count, created_at,
                  visionary_plan, final_manifesto, research_data, audit_feedback
           FROM chat_history
           WHERE user_id = %s
           ORDER BY created_at DESC""",
        (str(user["id"]),)
    )
    history = []
    for row in rows:
        item = dict(row)
        item["id"] = str(item["id"])
        item["created_at"] = item["created_at"].isoformat() if item["created_at"] else None
        history.append(item)
    return {"history": history}


@app.delete("/history/{item_id}")
def delete_history_item(item_id: str, user=Depends(get_current_user)):
    db_execute(
        "DELETE FROM chat_history WHERE id = %s AND user_id = %s",
        (item_id, str(user["id"]))
    )
    return {"message": "History item deleted successfully"}

# ============================================================
# ACCOUNT ROUTE
# ============================================================
@app.delete("/account")
def delete_account(user=Depends(get_current_user)):
    user_id = str(user["id"])
    db_execute("DELETE FROM chat_history WHERE user_id = %s", (user_id,))
    db_execute("DELETE FROM users WHERE id = %s", (user_id,))
    return {"message": "Account deleted successfully"}

# ============================================================
# ENTRY POINT
# ============================================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=7860, reload=True)