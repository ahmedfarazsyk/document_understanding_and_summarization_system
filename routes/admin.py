from fastapi import APIRouter, Header, HTTPException, Body, Depends
from core.database import system_mongodb
from services.audit import AuditService
from datetime import datetime
import os
from pymongo import MongoClient
from core.security import get_current_user


router = APIRouter(prefix="/admin", tags=["Admin Operations"])
audit_service = AuditService(system_mongodb)


@router.get("/audit-logs")
async def get_audit_logs(
    user: dict = Depends(get_current_user)
):
    # Security: Only Admins can see the audit trail
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Forbidden: Researcher cannot access logs.")
    
    logs = audit_service.get_workspace_logs(user["workspace_id"])
    return logs


@router.post("/config/gemini-key")
async def update_gemini_key(
    payload: dict = Body(...),
    user: dict = Depends(get_current_user)
):
    """
    Sets the Google API Key for the workspace. 
    This allows the Admin to configure the environment after login.
    """
    if user['role'].lower() != "admin":
        raise HTTPException(status_code=403, detail="Only admins can modify system configurations.")

    new_key = payload.get("api_key")
    if not new_key:
        raise HTTPException(status_code=400, detail="API Key is required.")

    # 1. Update the workspace record in the system database
    system_mongodb.workspaces.update_one(
        {"workspace_id": user["workspace_id"]},
        {"$set": {
            "google_api_key": new_key,
        }},
        upsert=True
    )
    
    return {"message": "Google API Key successfully set for the workspace."}


@router.post("/config/mongodb-uri")
async def update_mongodb_config(
    payload: dict = Body(...),
    user: dict = Depends(get_current_user)
):
    """Allows permanent storage and RAG search by setting the User's MongoDB URI."""
    if user['role'].lower() != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")

    uri = payload.get("mongodb_uri")
    index_name = payload.get("vector_index", "vector_index")

    if not uri:
        raise HTTPException(status_code=400, detail="MongoDB URI is required.")

    # Validate connection before saving
    try:
        test_client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        test_client.admin.command('ping')
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Database Connection Failed: {str(e)}")

    # Update System DB
    system_mongodb.workspaces.update_one(
        {"workspace_id": user['workspace_id']},
        {"$set": {
            "user_mongodb_uri": uri, 
            "vector_index_name": index_name,
        }},
        upsert=True
    )
    return {"status": "success", "message": "Storage Engine configured. Repository and Search are now active."}