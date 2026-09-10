from datetime import datetime, timezone
import re
import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, RefreshSession
from app.schemas import Token, UserCreate
from app.core.security import (
    SECRET_KEY,
    ALGORITHM,
    verify_password,
    hash_password,
    create_access_token,
    create_refresh_token,
    save_refresh_session,
    hash_refresh_token,
)


router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"],
)


@router.post(
    "/register",
    response_model=Token,
    status_code=status.HTTP_201_CREATED,
)
def register(
    user_data: UserCreate,
    db: Session = Depends(get_db),
):
    password = user_data.password

    if len(password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters",
        )

    if not re.search(r"[A-Za-z]", password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one letter",
        )

    if not re.search(r"[0-9]", password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one number",
        )

    if password.lower() == user_data.username.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password cannot be the same as username",
        )
    
    existing_username = (
        db.query(User)
        .filter(User.username == user_data.username)
        .first()
    )
    if existing_username is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already taken",
        )

    existing_email = (
        db.query(User)
        .filter(User.email == user_data.email)
        .first()
    )
    if existing_email is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    new_user = User(
        username=user_data.username,
        email=str(user_data.email),
        password_hash=hash_password(user_data.password),
        display_name=user_data.username,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    access_token = create_access_token(str(new_user.id))
    refresh_token = create_refresh_token(str(new_user.id))

    save_refresh_session(
        db=db,
        user_id=new_user.id,
        refresh_token=refresh_token,
    )

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
    )


@router.post(
    "/login",
    response_model=Token,
)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = (
        db.query(User)
        .filter(User.username == form_data.username)
        .first()
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    now = datetime.now(timezone.utc)

    db.query(RefreshSession).filter(
        RefreshSession.user_id == user.id,
        RefreshSession.revoked_at.is_(None),
    ).update(
        {RefreshSession.revoked_at: now},
        synchronize_session=False,
    )

    db.commit()

    access_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))

    save_refresh_session(
        db=db,
        user_id=user.id,
        refresh_token=refresh_token,
    )

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
    )


@router.post(
    "/refresh",
    response_model=Token,
)
def refresh_access_token(
    refresh_token: str,
    db: Session = Depends(get_db),
):
    try:
        payload = jwt.decode(
            refresh_token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
        )

        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
            )

        user_id = payload.get("sub")

        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
            )

    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    token_hash = hash_refresh_token(refresh_token)

    refresh_session = (
        db.query(RefreshSession)
        .filter(RefreshSession.token_hash == token_hash)
        .first()
    )

    if refresh_session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh session not found",
        )

    if refresh_session.revoked_at is not None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh session has been revoked",
        )

    if refresh_session.expires_at <= datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh session has expired",
        )

    user = db.query(User).filter(User.id == user_id).first()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    new_access_token = create_access_token(str(user.id))
    new_refresh_token = create_refresh_token(str(user.id))

    save_refresh_session(
        db=db,
        user_id=user.id,
        refresh_token=new_refresh_token,
    )

    refresh_session.revoked_at = datetime.now(timezone.utc)
    db.commit()

    return Token(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
    )
