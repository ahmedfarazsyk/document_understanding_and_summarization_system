import jwt
from datetime import datetime, timedelta
from fastapi import Header, HTTPException, Depends
import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv('SECRET_KEY')
# This key must be kept secret. Anyone with this key can fake your tokens.
SECRET_KEY = os.getenv('SECRET_KEY')
ALGORITHM = "HS256"


def create_access_token(data: dict):
    to_encode = data.copy()
    # Token valid for 24 hours
    expire = datetime.utcnow() + timedelta(hours=24)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)



async def get_current_user(authorization: str = Header(None)):
    """
    This is the gatekeeper. It checks the signature before 
    allowing any data to leave the backend.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication token required")
    
    try:
        token = authorization.split(" ")[1]
        # This re-runs the math using the SECRET_KEY
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload 
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token signature")