import bcrypt
from datetime import datetime
import uuid


class AuthService:
    def __init__(self, system_db):
        self.db = system_db

    def hash_password(self, password: str):
        """Hashes a password using bcrypt."""
        # Convert password to bytes, generate salt, and hash
        pwd_bytes = password.encode('utf-8')
        salt = bcrypt.gensalt()
        hashed_password = bcrypt.hashpw(pwd_bytes, salt)
        return hashed_password.decode('utf-8')
    
    def verify_password(self, plain_password, hashed_password):
        return bcrypt.checkpw(
                plain_password.encode('utf-8'), 
                hashed_password.encode('utf-8')
            )
    
    def create_admin(self, username, password, workspace_name, google_api_key):
        """Creates a new Admin and registers their workspace."""

        # 1. Check if Username already exists globally
        if self.db.users.find_one({"username": username}):
            return {"error": "Username already taken"}

        # Check if workspace name exists
        if self.db.workspaces.find_one({"workspace_id": workspace_name.lower()}):
            return {"error": "Workspace already exists"}

        workspace_id = workspace_name.lower().replace(" ", "_")
        
        # 1. Register the Workspace
        self.db.workspaces.insert_one({
            "workspace_id": workspace_id,
            "display_name": workspace_name,
            "created_at": datetime.utcnow()
        })

        # 2. Create the Admin User
        user_id = str(uuid.uuid4())
        self.db.users.insert_one({
            "user_id": user_id,
            "username": username,
            "password_hash": self.hash_password(password),
            "role": "admin",
            "workspace_id": workspace_id
        })
        return {"message": "Admin and Workspace created", "workspace_id": workspace_id}
    

    def create_researcher(self, username, password, workspace_id):
        """Links a new Researcher to an existing Admin's workspace."""

        # 1. Check if Username already exists globally
        if self.db.users.find_one({"username": username}):
            return {"error": "Username already taken"}

        # Verify workspace exists
        if not self.db.workspaces.find_one({"workspace_id": workspace_id}):
            return {"error": "Invalid Workspace ID. Please get the correct ID from your Admin."}

        # Create the Researcher User
        user_id = str(uuid.uuid4())
        self.db.users.insert_one({
            "user_id": user_id,
            "username": username,
            "password_hash": self.hash_password(password),
            "role": "researcher",
            "workspace_id": workspace_id
        })
        return {"message": "Researcher registered successfully"}