"""
SkyGuard AI Authentication Engine.
Implements secure password hashing with PBKDF2-HMAC-SHA256 and cryptographic HMAC-SHA256 session tokens.
"""
import os
import hmac
import hashlib
import json
import base64
import time
from typing import Optional, Dict, Any
from fastapi import Header, HTTPException, Depends, status

# Configuration & Secrets
SECRET_KEY = os.environ.get("SKYGUARD_SECRET_KEY", "skyguard_secure_auth_key_2026_sih_aws_secret")
ADMIN_USERNAME = os.environ.get("SKYGUARD_ADMIN_USER", "admin")
ADMIN_PASSWORD = os.environ.get("SKYGUARD_ADMIN_PASS", "SkyGuard@2026")
STATION_ID = os.environ.get("SKYGUARD_STATION_ID", "AWS-001")

# Helper: PBKDF2 Hashing
def hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
    if salt is None:
        salt = base64.b64encode(os.urandom(16)).decode("utf-8")
    pwd_bytes = password.encode("utf-8")
    salt_bytes = salt.encode("utf-8")
    derived = hashlib.pbkdf2_hmac("sha256", pwd_bytes, salt_bytes, 100_000)
    hash_hex = derived.hex()
    return hash_hex, salt

# Generate default admin password hash in memory
_ADMIN_HASH, _ADMIN_SALT = hash_password(ADMIN_PASSWORD, salt="skyguard_static_salt_v1")

def verify_password(plain_password: str, expected_hash: str, salt: str) -> bool:
    pwd_bytes = plain_password.encode("utf-8")
    salt_bytes = salt.encode("utf-8")
    derived = hashlib.pbkdf2_hmac("sha256", pwd_bytes, salt_bytes, 100_000)
    return hmac.compare_digest(derived.hex(), expected_hash)

def b64_url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")

def b64_url_decode(data: str) -> bytes:
    padding = 4 - (len(data) % 4)
    if padding and padding < 4:
        data += "=" * padding
    return base64.urlsafe_b64decode(data)

def create_session_token(payload: Dict[str, Any], expires_delta_seconds: int = 86400) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    now = int(time.time())
    full_payload = {
        **payload,
        "iat": now,
        "exp": now + expires_delta_seconds,
    }
    
    header_b64 = b64_url_encode(json.dumps(header).encode("utf-8"))
    payload_b64 = b64_url_encode(json.dumps(full_payload).encode("utf-8"))
    
    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
    signature = hmac.new(SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256).digest()
    sig_b64 = b64_url_encode(signature)
    
    return f"{header_b64}.{payload_b64}.{sig_b64}"

def verify_session_token(token: str) -> Optional[Dict[str, Any]]:
    if not token or not isinstance(token, str):
        return None
    
    parts = token.split(".")
    if len(parts) != 3:
        return None
    
    header_b64, payload_b64, sig_b64 = parts
    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
    expected_sig = hmac.new(SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256).digest()
    
    try:
        actual_sig = b64_url_decode(sig_b64)
        if not hmac.compare_digest(expected_sig, actual_sig):
            return None
        
        payload_bytes = b64_url_decode(payload_b64)
        payload = json.loads(payload_bytes.decode("utf-8"))
        
        # Check expiry
        exp = payload.get("exp", 0)
        if time.time() > exp:
            return None
        
        return payload
    except Exception:
        return None

def authenticate_user(username: str, plain_password: str) -> Optional[Dict[str, Any]]:
    clean_user = username.strip().lower()
    expected_user = ADMIN_USERNAME.strip().lower()
    
    if clean_user == expected_user:
        # Verify password
        if verify_password(plain_password, _ADMIN_HASH, _ADMIN_SALT):
            return {
                "username": ADMIN_USERNAME,
                "role": "ADMIN_OPERATOR",
                "station_id": STATION_ID,
                "full_name": "SkyGuard Lead Operator",
            }
    return None

def get_current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="MISSING_OR_INVALID_TOKEN",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.split(" ", 1)[1]
    payload = verify_session_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="SESSION_EXPIRED",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload
