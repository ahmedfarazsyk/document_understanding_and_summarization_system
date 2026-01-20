import os
from pymongo import MongoClient
from pymongo.server_api import ServerApi
from dotenv import load_dotenv
from fastapi.exceptions import HTTPException


load_dotenv()

class Database:
    def __init__(self):
        # The URI is pulled from your .env file for security
        self.uri = os.getenv("MONGODB_URI")
        self.mongo_client = MongoClient(self.uri, server_api=ServerApi('1'))

        self.system_db = self.mongo_client["alphadoc_system"]

    def get_system_db(self):
        return self.system_db
    

    def get_tenant_db(self, workspace_id: str):

        workspace = self.system_db.workspaces.find_one({"workspace_id": workspace_id})
        if not workspace or "user_mongodb_uri" not in workspace:
            # Raise 428 so the frontend shows the 'Configuration Required' popup
            raise HTTPException(status_code=428, detail="STORAGE_CONFIG_MISSING")
        
        user_uri = workspace["user_mongodb_uri"]
        index_name = workspace.get("vector_index_name", "vector_index")

        tenant_client = MongoClient(user_uri, serverSelectionTimeoutMS=5000)

        tenant_db = tenant_client[f"workspace_{workspace_id}"]
        
        return tenant_db, index_name

# Create a singleton instance
db_instance = Database()
system_mongodb = db_instance.get_system_db()