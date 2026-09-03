import os
import hashlib

from datetime import datetime, timedelta, timezone

import jwt

from dotenv import load_dotenv

from pwdlib import PasswordHash

from sqlalchemy.orm import Session

from app.models import RefreshSession


# ============================================================
# CONFIGURATION
# ============================================================

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")

ALGORITHM = os.getenv(
    "JWT_ALGORITHM",
    "HS256"
)

ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv(
        "ACCESS_TOKEN_EXPIRE_MINUTES",
        "30"
    )
)


if not SECRET_KEY:
    raise ValueError(
        "SECRET_KEY environment variable is not set"
    )


# ============================================================
# PASSWORD HASHING
# ============================================================

password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:

    return password_hash.hash(
        password
    )


def verify_password(
    plain_password: str,
    hashed_password: str
) -> bool:

    return password_hash.verify(
        plain_password,
        hashed_password
    )


# ============================================================
# JWT
# ============================================================

def create_access_token(
    user_id: str
) -> str:

    expire = (
        datetime.now(timezone.utc)
        +
        timedelta(
            minutes=ACCESS_TOKEN_EXPIRE_MINUTES
        )
    )

    payload = {
        "sub": user_id,
        "exp": expire
    }

    return jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM
    )

def create_refresh_token(
    user_id: str
) -> str:

    expire = (
        datetime.now(timezone.utc)
        +
        timedelta(
            days=30
        )
    )

    payload = {
        "sub": user_id,
        "exp": expire,
        "type": "refresh"
    }

    return jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM
    )

# ============================================================
# REFRESH TOKEN HASHING
# ============================================================

def hash_refresh_token(
    refresh_token: str
) -> str:

    return hashlib.sha256(
        refresh_token.encode("utf-8")
    ).hexdigest()


# ============================================================
# SAVE REFRESH SESSION
# ============================================================

def save_refresh_session(
    db: Session,
    user_id,
    refresh_token: str
):

    token_hash = hash_refresh_token(
        refresh_token
    )

    expires_at = (
        datetime.now(timezone.utc)
        +
        timedelta(days=30)
    )

    refresh_session = RefreshSession(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=expires_at
    )

    db.add(
        refresh_session
    )

    db.commit()

    db.refresh(
        refresh_session
    )

    return refresh_session