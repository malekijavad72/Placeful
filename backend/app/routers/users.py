from fastapi import APIRouter, Depends, HTTPException, status, Query
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_
import json

from app.database import get_db
from app.models import (
    User,
    UserFollow,
    Experience,
    Emotion,
    ExperienceEmotion,
    Place,
)
from app.schemas import (
    UserResponse,
    UserProfileUpdate,
    GeoJSONFeatureCollection,
)
from app.dependencies import (
    get_current_user,
    get_optional_current_user,
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

@router.get(
    "/{user_id}/experiences",
    response_model=GeoJSONFeatureCollection,
)
def get_user_experiences(
    user_id: str,
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_current_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    experiences = (
        db.query(
            Experience.id,
            Experience.title,
            Experience.story,
            Experience.user_id,
            func.ST_AsGeoJSON(Experience.location).label("location"),
            Experience.visibility,
            Experience.is_anonymous,
            Emotion.name.label("emotion_name"),
            Emotion.slug.label("emotion_slug"),
            User.username.label("username"),
            User.display_name.label("display_name"),
            User.profile_image_url.label("profile_image_url"),
            Experience.created_at,
            Experience.updated_at,
            Experience.place_id,
            Place.name.label("place_name"),
        )
        .outerjoin(
            ExperienceEmotion,
            Experience.id == ExperienceEmotion.experience_id,
        )
        .outerjoin(
            Emotion,
            ExperienceEmotion.emotion_id == Emotion.id,
        )
        .outerjoin(User, Experience.user_id == User.id)
        .outerjoin(Place, Experience.place_id == Place.id)
        .filter(Experience.user_id == user_id)
        .filter(Experience.is_anonymous.is_(False))
    )

    # Same visibility rules as the main feed
    if current_user is None:
        experiences = experiences.filter(Experience.visibility == "public")
    else:
        followed_ids = (
            db.query(UserFollow.following_id)
            .filter(UserFollow.follower_id == current_user.id)
        )
        experiences = experiences.filter(
            or_(
                Experience.visibility == "public",
                Experience.user_id == current_user.id,
                and_(
                    Experience.visibility == "followers",
                    Experience.user_id.in_(followed_ids),
                ),
            )
        )

    rows = (
        experiences
        .order_by(Experience.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    features = []
    for experience in rows:
        geometry = json.loads(experience.location)
        features.append(
            {
                "type": "Feature",
                "geometry": geometry,
                "properties": {
                    "id": str(experience.id),
                    "title": experience.title,
                    "story": experience.story,
                    "emotion": experience.emotion_slug,
                    "emotion_name": experience.emotion_name,
                    "visibility": experience.visibility,
                    "is_anonymous": experience.is_anonymous,
                    "user_id": str(experience.user_id) if experience.user_id else None,
                    "username": experience.username,
                    "display_name": experience.display_name,
                    "profile_image_url": experience.profile_image_url,
                    "created_at": (
                        experience.created_at.isoformat()
                        if experience.created_at else None
                    ),
                    "updated_at": (
                        experience.updated_at.isoformat()
                        if experience.updated_at else None
                    ),
                    "place_id": (
                        str(experience.place_id) if experience.place_id else None
                    ),
                    "place_name": experience.place_name,
                },
            }
        )

    return {"type": "FeatureCollection", "features": features}

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