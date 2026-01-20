from pydantic import BaseModel

class AdminSignupSchema(BaseModel):
    username: str
    password: str
    workspace_name: str
    google_api_key: str

class ResearcherSignupSchema(BaseModel):
    username: str
    password: str
    workspace_id: str

class LoginSchema(BaseModel):
    username: str
    password: str