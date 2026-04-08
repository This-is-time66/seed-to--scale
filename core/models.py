from pydantic import BaseModel

class AuthRequest(BaseModel):
    email: str
    password: str
    name: str = ""

class IdeaRequest(BaseModel):
    concept: str