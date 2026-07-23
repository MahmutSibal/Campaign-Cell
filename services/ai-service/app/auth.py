"""
AI Service kimlik doğrulama yardımcıları.

Nest servisleriyle AYNI JWT_SECRET (HS256) kullanılarak gateway'den iletilen token doğrulanır.
Böylece AI servisine doğrudan (port 8000) erişimde bile hassas abone verisi korunur — savunma derinliği.
"""
import os
from typing import Optional

import jwt
from fastapi import Header, HTTPException, status

JWT_SECRET = os.getenv("JWT_SECRET", "campaigncell-secret-key-change-in-prod")


def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Yetkilendirme tokenı gerekli")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token süresi dolmuş")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Geçersiz veya değiştirilmiş token")
    return {
        "user_id": payload.get("sub") or payload.get("user_id"),
        "role": payload.get("role"),
    }


def assert_subscriber_owner(subscriber_id: str, user: dict) -> None:
    """IDOR koruması: abone yalnızca KENDİ profiline erişir; süpervizör/admin hepsine."""
    if user.get("role") in ("SUPERVISOR", "ADMIN"):
        return
    if user.get("user_id") != subscriber_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Yalnızca kendi profilinize erişebilirsiniz (IDOR koruması).",
        )
