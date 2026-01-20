from fastapi import APIRouter, Depends, HTTPException, Body
from models.auth import AdminSignupSchema, ResearcherSignupSchema, LoginSchema
from services.auth import AuthService
from core.database import system_mongodb
from typing import Optional
from core.security import create_access_token


router = APIRouter(prefix="/auth", tags=["Authentication"])
auth_service = AuthService(system_mongodb)


@router.post("/signup/admin")
async def signup_admin(data: AdminSignupSchema):
    result = auth_service.create_admin(
        data.username, data.password, data.workspace_name, data.google_api_key
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/signup/researcher")
async def signup_researcher(data: ResearcherSignupSchema):
    result = auth_service.create_researcher(
        data.username, data.password, data.workspace_id
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/login")
async def login(data: LoginSchema):
    # 1. Find user in the system database
    user = system_mongodb.users.find_one({"username": data.username})
    
    if not user or not auth_service.verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    

    token = create_access_token(
    {"username": user["username"],
    "role": user["role"],
    "workspace_id": user["workspace_id"]})

    # 2. Return user info and workspace details
    # In a full production app, you'd return a JWT token here.
    # For now, we return the workspace info so the frontend can store it.
    return {
        "message": "Login successful",
        "access_token": token,
        "token_type": "bearer",
        "username": user["username"],
        "role": user["role"],
        "workspace_id": user["workspace_id"]
    }