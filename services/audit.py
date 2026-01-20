from datetime import datetime
import uuid

class AuditService:
    def __init__(self, system_db):
        self.db = system_db # Points to alphadoc_system

    def log_event(self, user_id: str, username: str, role: str, workspace_id: str, action: str, details: dict):
        """
        Records a security or operational event.
        Actions: LOGIN, DOC_UPLOAD, DOC_STORE, RAG_SEARCH, DASHBOARD_REFRESH
        """
        log_entry = {
            "log_id": str(uuid.uuid4()),
            "timestamp": datetime.utcnow(),
            "user_id": user_id,
            "username": username,
            "role":role,
            "workspace_id": workspace_id,
            "action": action,
            "details": details  # e.g. {"filename": "report.pdf"} or {"query": "How to..."}
        }
        self.db.audit_logs.insert_one(log_entry)


    def get_workspace_logs(self, workspace_id: str, limit: int = 50):
        """Retrieves the latest logs for a specific workspace (Admin view)."""
        return list(self.db.audit_logs.find(
            {"workspace_id": workspace_id}, 
            {"_id": 0}
        ).sort("timestamp", -1).limit(limit))