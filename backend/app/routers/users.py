from fastapi import APIRouter, Depends, HTTPException, status
from uuid import UUID
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, UserFollow
from app.schemas import UserResponse
from app.dependencies import get_current_user

from app.schemas import (
    UserResponse,
    UserProfileUpdate
)


router = APIRouter(
    prefix="/api/users",
    tags=["Users"]
)


# ============================================================
# GET CURRENT USER PROFILE
# ============================================================

@router.get(
    "/me",
    response_model=UserResponse
)
def get_my_profile(
    current_user: User = Depends(get_current_user)
):

    return current_user


# ============================================================
# GET PUBLIC USER PROFILE
# ============================================================

@router.get(
    "/{user_id}",
    response_model=UserResponse
)
def get_user_profile(
    user_id: str,
    db: Session = Depends(get_db)
):

    user = (
        db.query(User)
        .filter(
            User.id == user_id
        )
        .first()
    )

    if user is None:

        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    return user

@router.patch(
    "/me",
    response_model=UserResponse
)
def update_my_profile(
    profile: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    if profile.display_name is not None:
        current_user.display_name = profile.display_name

    if profile.bio is not None:
        current_user.bio = profile.bio

    if profile.profile_image_url is not None:
        current_user.profile_image_url = profile.profile_image_url

    db.commit()
    db.refresh(current_user)

    return current_user


# ============================================================
# FOLLOW USER
# ============================================================

@router.post(
    "/{user_id}/follow",
    status_code=status.HTTP_201_CREATED
)
def follow_user(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    # --------------------------------------------------------
    # Check that the target user exists
    # --------------------------------------------------------

    target_user = (
        db.query(User)
        .filter(
            User.id == user_id
        )
        .first()
    )

    if target_user is None:

        raise HTTPException(
            status_code=404,
            detail="User not found"
        )


    # --------------------------------------------------------
    # Prevent following yourself
    # --------------------------------------------------------

    if current_user.id == target_user.id:

        raise HTTPException(
            status_code=400,
            detail="You cannot follow yourself"
        )


    # --------------------------------------------------------
    # Check whether the follow already exists
    # --------------------------------------------------------

    existing_follow = (
        db.query(UserFollow)
        .filter(
            UserFollow.follower_id == current_user.id,
            UserFollow.following_id == target_user.id
        )
        .first()
    )

    if existing_follow is not None:

        raise HTTPException(
            status_code=409,
            detail="You are already following this user"
        )


    # --------------------------------------------------------
    # Create the follow relationship
    # --------------------------------------------------------

    new_follow = UserFollow(
        follower_id=current_user.id,
        following_id=target_user.id
    )

    db.add(new_follow)

    db.commit()


    return {
        "message": "User followed successfully"
    }


# ============================================================
# UNFOLLOW USER
# ============================================================

@router.delete(
    "/{user_id}/follow"
)
def unfollow_user(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    # --------------------------------------------------------
    # Find the follow relationship
    # --------------------------------------------------------

    existing_follow = (
        db.query(UserFollow)
        .filter(
            UserFollow.follower_id == current_user.id,
            UserFollow.following_id == user_id
        )
        .first()
    )

    # --------------------------------------------------------
    # Relationship does not exist
    # --------------------------------------------------------

    if existing_follow is None:

        raise HTTPException(
            status_code=404,
            detail="You are not following this user"
        )

    # --------------------------------------------------------
    # Delete the relationship
    # --------------------------------------------------------

    db.delete(existing_follow)

    db.commit()

    return {
        "message": "User unfollowed successfully"
    }


# ============================================================
# GET USER FOLLOWERS
# ============================================================

@router.get(
    "/{user_id}/followers",
    response_model=list[UserResponse]
)
def get_followers(
    user_id: UUID,
    db: Session = Depends(get_db)
):

    # --------------------------------------------------------
    # Check that the target user exists
    # --------------------------------------------------------

    user = (
        db.query(User)
        .filter(
            User.id == user_id
        )
        .first()
    )

    if user is None:

        raise HTTPException(
            status_code=404,
            detail="User not found"
        )


    # --------------------------------------------------------
    # Get users who follow this user
    # --------------------------------------------------------

    followers = (
        db.query(User)
        .join(
            UserFollow,
            UserFollow.follower_id == User.id
        )
        .filter(
            UserFollow.following_id == user_id
        )
        .all()
    )

    return followers

# ============================================================
# GET USERS THIS USER FOLLOWS
# ============================================================

@router.get(
    "/{user_id}/following",
    response_model=list[UserResponse]
)
def get_following(
    user_id: UUID,
    db: Session = Depends(get_db)
):

    # --------------------------------------------------------
    # Check that the target user exists
    # --------------------------------------------------------

    user = (
        db.query(User)
        .filter(
            User.id == user_id
        )
        .first()
    )

    if user is None:

        raise HTTPException(
            status_code=404,
            detail="User not found"
        )


    # --------------------------------------------------------
    # Get users this user follows
    # --------------------------------------------------------

    following = (
        db.query(User)
        .join(
            UserFollow,
            UserFollow.following_id == User.id
        )
        .filter(
            UserFollow.follower_id == user_id
        )
        .all()
    )

    return following

# ============================================================
# GET FOLLOW STATUS
# ============================================================

@router.get(
    "/{user_id}/follow-status"
)
def get_follow_status(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    # --------------------------------------------------------
    # Check that the target user exists
    # --------------------------------------------------------

    target_user = (
        db.query(User)
        .filter(
            User.id == user_id
        )
        .first()
    )

    if target_user is None:

        raise HTTPException(
            status_code=404,
            detail="User not found"
        )


    # --------------------------------------------------------
    # Check whether current user follows target user
    # --------------------------------------------------------

    existing_follow = (
        db.query(UserFollow)
        .filter(
            UserFollow.follower_id == current_user.id,
            UserFollow.following_id == user_id
        )
        .first()
    )


    # --------------------------------------------------------
    # Return follow status
    # --------------------------------------------------------

    return {
        "following": existing_follow is not None
    }