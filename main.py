import os
import shutil
import uuid
from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException, Body, Header, Depends
from fastapi.responses import JSONResponse
from routes.auth import router as auth_router
from routes.admin import router as admin_router
from fastapi.middleware.cors import CORSMiddleware
from core.database import system_mongodb, db_instance
from services.ingestion import IngestionService
from services.intelligence import IntelligenceService
from services.storage import StorageService
from services.rag_pipeline import RAGEngine
from services.audit import AuditService
from core.security import get_current_user

app = FastAPI(title="Document Understanding and Summarization")

app.include_router(auth_router)
app.include_router(admin_router)

# Enable CORS for your Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000",
                    "https://document-understanding-and-summariz.vercel.app/"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ingestion_service = IngestionService()
intel_service = IntelligenceService()
audit_service = AuditService(system_mongodb)
# storage_service = StorageService(mongodb)
# rag_engine = RAGEngine(mongodb["chunks"], mongodb['documents'])

processing_status = {}

@app.get("/")
async def root():
    return {"message": "AlphaDoc API is running", "status": "healthy"}

@app.get("/history")
async def get_history_list(user: dict = Depends(get_current_user)):
    """
    Returns a lightweight list of all processed documents.
    Used to populate the 'Individual Bars' in the Archive tab.
    """

    tenant_db, _ = db_instance.get_tenant_db(user["workspace_id"])
    storage_service = StorageService(tenant_db)

    try:
        return storage_service.get_all_documents()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch history: {str(e)}")
    

@app.get("/history/{doc_id}")
async def get_history_detail(doc_id: str, user: dict = Depends(get_current_user)):
    """
    Retrieves the full reconstructed report for a specific document.
    Assembles summaries from 'documents' and insights from 'chunks'.
    """

    tenant_db, _ = db_instance.get_tenant_db(user["workspace_id"])
    storage_service = StorageService(tenant_db)

    try:
        data = storage_service.get_document_full_history(doc_id)
        if not data:
            raise HTTPException(status_code=404, detail="Document not found")
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve document details: {str(e)}")
    

@app.post("/analyze")
async def analyze_document(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    """
    Step 1: Ingests and analyzes the PDF, returning results to the UI.
    Does NOT store in MongoDB yet.
    """
    if not file.filename.endswith((".pdf", ".docx", ".doc")):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    temp_path = f"temp_{uuid.uuid4()}_{file.filename}"


    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Run AI Intelligence immediately
        chunks = ingestion_service.process_file(temp_path)
        chunk_texts = [c.page_content for c in chunks]
        full_text = "\n--- NEW CHUNK ---\n".join(chunk_texts)

        all_intelligence = intel_service.generate_all_intelligence(full_text, user["workspace_id"])
        all_insights = intel_service.generate_actionable_insights(full_text, len(chunks), user["workspace_id"])
        final_report = intel_service.generate_final_summaries(all_insights, full_text, user["workspace_id"])
        embeddings = intel_service.generate_embedding(chunk_texts, user["workspace_id"])

        # Clean up temp file
        os.remove(temp_path)

        user_record = system_mongodb.users.find_one({"username": user["username"]})
        
        audit_service.log_event(
            user_id= user_record.get("user_id"),
            username=user["username"],
            role=user_record.get("role"),
            workspace_id=user["workspace_id"],
            action="AI_ANALYSIS",
            details={"filename": file.filename}
        )
        # Return everything to the frontend for user review
        return {
            "filename": file.filename,
            "intelligence": all_intelligence.model_dump(),
            "insights": all_insights.model_dump(),  # ActionableInsightList
            "summaries": final_report.model_dump(),   # DocumentSummaries
            "raw_chunks": chunk_texts,
            "embeddings": embeddings
        }
    
    except HTTPException as he:
        # CRITICAL: Re-raise the 428 error so the frontend sees it!
        if os.path.exists(temp_path): os.remove(temp_path)
        raise he

    except Exception as e:
        if os.path.exists(temp_path): os.remove(temp_path)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/store")
async def store_document(payload: dict = Body(...), user: dict = Depends(get_current_user)):
    """
    Step 2: Receives the reviewed data from the UI and commits to MongoDB.
    """
    tenant_db, _ = db_instance.get_tenant_db(user['workspace_id'])
    filename = payload.get("filename")
    
    # Flags sent by frontend after user sees the collision modal
    confirm_update = payload.get("confirm_update", False)
    force_new = payload.get("force_new", False)

    if confirm_update and user['role'].lower() != "admin":
        raise HTTPException(
            status_code=403, 
            detail="Unauthorized: Only Admins can authorize a document version replacement."
        )

    # 1. AUTO-DETECTION LOGIC
    existing_group_id = None
    existing_doc = tenant_db.documents.find_one({"filename": filename, "is_current": True})
    
    if existing_doc:
        existing_group_id = existing_doc.get("parent_group_id")
        
        # If a collision exists but the user hasn't made a choice yet
        if not confirm_update and not force_new:
            return JSONResponse(
                status_code=409, # Conflict
                content={
                    "message": "A document with this name already exists.",
                    "filename": filename
                }
            )


    user_record = system_mongodb.users.find_one({"username": user['username']})
    storage_service = StorageService(tenant_db)


    try:
        doc_id = storage_service.final_storage_logic(
            doc_summaries=payload["summaries"],
            insight_list=payload["insights"],
            intelligence=payload["intelligence"],
            raw_chunks=payload["raw_chunks"],
            embeddings=payload["embeddings"],
            filename=payload["filename"],
            owner=user['username'],
            parent_group_id=existing_group_id if confirm_update else None
        )

        audit_service.log_event(
            user_id= user_record.get("user_id"),
            username=user['username'],
            role=user_record.get("role"),
            workspace_id=user['workspace_id'],
            action="DOCUMENT_STORED",
            details={
                "filename": payload["filename"], 
                "doc_id": doc_id,
                "chunk_count": len(payload.get("raw_chunks", []))
            }
        )

        return {"message": "Success!", "doc_id": doc_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Storage failed: {str(e)}")
    

@app.get("/dashboard/latest")
async def get_dashboard(user: dict = Depends(get_current_user)):

    tenant_db, index_name = db_instance.get_tenant_db(user['workspace_id'])
    latest_doc = tenant_db.documents.find_one(sort=[("upload_date", -1)])
    if not latest_doc:
        raise HTTPException(status_code=404, detail="No documents found")
    
    rag_engine = RAGEngine(tenant_db["chunks"], tenant_db['documents'], index_name=index_name)
    
    query = f"Provide insights for document {latest_doc['_id']}"
    result = rag_engine.generate_intelligence(query, user['workspace_id'], mode="dashboard")

    return {"dashboard_summary": result}


@app.post("/search")
async def search_repository(user_query: str, user: dict = Depends(get_current_user)):

    tenant_db, index_name = db_instance.get_tenant_db(user['workspace_id'])
    rag_engine = RAGEngine(tenant_db["chunks"], tenant_db['documents'], index_name=index_name)
    result = rag_engine.generate_intelligence(user_query, user['workspace_id'], mode="search")

    user_record = system_mongodb.users.find_one({"username": user['username']})
    audit_service.log_event(
            user_id= user_record.get("user_id"),
            username=user['username'],
            role=user_record.get("role"),
            workspace_id=user['workspace_id'],
            action="RAG_QUERY",
            details={"query": user_query}
        )

    return {"answer":result}


@app.delete("/documents/version/{doc_id}")
async def delete_version(doc_id: str, user: dict = Depends(get_current_user)):
    # RBAC: Enforce Admin-only policy
    if user['role'].lower() != "admin":
        raise HTTPException(
            status_code=403, 
            detail="Forbidden: Only administrators can remove document versions."
        )

    tenant_db, _ = db_instance.get_tenant_db(user['workspace_id'])
    storage_service = StorageService(tenant_db)


    user_record = system_mongodb.users.find_one({"username": user['username']})
    try:
        storage_service.soft_delete_document(doc_id)

        # Audit Log: Record exactly which version was removed
        audit_service.log_event(
            user_id=user_record.get("user_id"),
            username=user['username'],
            role=user['role'],
            workspace_id=user['workspace_id'],
            action="VERSION_DEACTIVATED",
            details={"doc_id": doc_id}
        )
        
        return {"message": "Version removed from active repository."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
