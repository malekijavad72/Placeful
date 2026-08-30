import json
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from geoalchemy2 import WKTElement
from datetime import datetime, timezone

from app.database import get_db 
from app.models import (
    Experience,
    Emotion,
    ExperienceEmotion,
    User,
    Like,
    Comment
)
from app.schemas import (
    ExperienceCreate,
    GeoJSONFeatureCollection,
    ExperienceResponse,
    CommentCreate,
    CommentResponse,
    CommentUpdate
)

from app.core.exceptions import (
    bad_request,
    internal_server_error
)

from app.services.experience_service import create_experience as create_experience_service

from app.dependencies import get_current_user


router = APIRouter(
    prefix="/api/experiences",
    tags=["Experiences"]
)


# ============================================================
# GET ALL EXPERIENCES
# ============================================================

@router.get(
    "/",
    response_model=GeoJSONFeatureCollection
)
def get_experiences(
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)  # Added dependency
):

    experiences = (
        db.query(
            Experience.id,
            Experience.title,
            Experience.story,
            func.ST_AsGeoJSON(
                Experience.location
            ).label("location"),
            Experience.visibility,
            Experience.is_anonymous,
            Emotion.name.label("emotion_name"),
            Emotion.slug.label("emotion_slug")
        )
        .outerjoin(
            ExperienceEmotion,
            Experience.id ==
            ExperienceEmotion.experience_id
        )
        .outerjoin(
            Emotion,
            ExperienceEmotion.emotion_id ==
            Emotion.id
        )
        .offset(offset)
        .limit(limit)
        .all()
    )

    features = []

    for experience in experiences:

        geometry = json.loads(
            experience.location
        )

        feature = {
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
            }
        }

        features.append(feature)

    return {
        "type": "FeatureCollection",
        "features": features
    }

# ============================================================
# GET EXPERIENCES NEAR A LOCATION
# ============================================================

@router.get(
    "/nearby",
    response_model=GeoJSONFeatureCollection
)
def get_nearby_experiences(
    latitude: float,
    longitude: float,
    radius: float = Query(
        1000,
        gt=0
    ),
    db: Session = Depends(get_db)
):

    point = func.ST_SetSRID(
        func.ST_MakePoint(
            longitude,
            latitude
        ),
        4326
    )

    distance = func.ST_Distance(
        func.Geography(Experience.location),
        func.Geography(point)
    )

    experiences = (
        db.query(
            Experience.id,
            Experience.title,
            Experience.story,
            func.ST_AsGeoJSON(
                Experience.location
            ).label("location"),
            Experience.visibility,
            Experience.is_anonymous,
            distance.label("distance"),
            Emotion.name.label("emotion_name"),
            Emotion.slug.label("emotion_slug")
        )
        .outerjoin(
            ExperienceEmotion,
            Experience.id ==
            ExperienceEmotion.experience_id
        )
        .outerjoin(
            Emotion,
            ExperienceEmotion.emotion_id ==
            Emotion.id
        )
        .filter(
            func.ST_DWithin(
                func.Geography(Experience.location),
                func.Geography(point),
                radius
            )
        )
        .order_by(distance)
        .all()
    )

    features = []

    for experience in experiences:

        geometry = json.loads(
            experience.location
        )

        features.append({
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
                "distance_meters": round(
                    float(experience.distance),
                    2
                )
            }
        })

    return {
        "type": "FeatureCollection",
        "features": features
    }
# ============================================================
# CREATE EXPERIENCE
# ============================================================

@router.post(
    "/",
    response_model=ExperienceResponse
)
def create_experience(
    experience: ExperienceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    return create_experience_service(
        experience,
        db,
        current_user.id
    )

# ============================================================
# LIKE EXPERIENCE
# ============================================================

@router.post(
    "/{experience_id}/like",
    status_code=201
)
def like_experience(
    experience_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    # --------------------------------------------------------
    # Check that the experience exists
    # --------------------------------------------------------

    experience = (
        db.query(Experience)
        .filter(
            Experience.id == experience_id
        )
        .first()
    )

    if experience is None:

        raise HTTPException(
            status_code=404,
            detail="Experience not found"
        )


    # --------------------------------------------------------
    # Check whether the user already liked it
    # --------------------------------------------------------

    existing_like = (
        db.query(Like)
        .filter(
            Like.user_id == current_user.id,
            Like.experience_id == experience_id
        )
        .first()
    )

    if existing_like is not None:

        raise HTTPException(
            status_code=409,
            detail="Experience already liked"
        )


    # --------------------------------------------------------
    # Create like
    # --------------------------------------------------------

    new_like = Like(
        user_id=current_user.id,
        experience_id=experience_id
    )

    db.add(new_like)

    db.commit()


    return {
        "message": "Experience liked successfully"
    }


# ============================================================
# UNLIKE EXPERIENCE
# ============================================================

@router.delete(
    "/{experience_id}/like"
)
def unlike_experience(
    experience_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    # --------------------------------------------------------
    # Check that the experience exists
    # --------------------------------------------------------

    experience = (
        db.query(Experience)
        .filter(
            Experience.id == experience_id
        )
        .first()
    )

    if experience is None:

        raise HTTPException(
            status_code=404,
            detail="Experience not found"
        )

    # --------------------------------------------------------
    # Find the user's like
    # --------------------------------------------------------

    existing_like = (
        db.query(Like)
        .filter(
            Like.user_id == current_user.id,
            Like.experience_id == experience_id
        )
        .first()
    )

    if existing_like is None:

        raise HTTPException(
            status_code=404,
            detail="Experience not liked"
        )

    # --------------------------------------------------------
    # Delete the like
    # --------------------------------------------------------

    db.delete(existing_like)

    db.commit()

    return {
        "message": "Experience unliked successfully"
    }


# ============================================================
# GET LIKE STATUS
# ============================================================

@router.get(
    "/{experience_id}/like-status"
)
def get_like_status(
    experience_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    # --------------------------------------------------------
    # Check that the experience exists
    # --------------------------------------------------------

    experience = (
        db.query(Experience)
        .filter(
            Experience.id == experience_id
        )
        .first()
    )

    if experience is None:

        raise HTTPException(
            status_code=404,
            detail="Experience not found"
        )

    # --------------------------------------------------------
    # Check whether the current user liked it
    # --------------------------------------------------------

    existing_like = (
        db.query(Like)
        .filter(
            Like.user_id == current_user.id,
            Like.experience_id == experience_id
        )
        .first()
    )

    return {
        "liked": existing_like is not None
    }


# ============================================================
# GET LIKE COUNT
# ============================================================

@router.get(
    "/{experience_id}/like-count"
)
def get_like_count(
    experience_id: uuid.UUID,
    db: Session = Depends(get_db)
):

    # --------------------------------------------------------
    # Check that the experience exists
    # --------------------------------------------------------

    experience = (
        db.query(Experience)
        .filter(
            Experience.id == experience_id
        )
        .first()
    )

    if experience is None:

        raise HTTPException(
            status_code=404,
            detail="Experience not found"
        )

    # --------------------------------------------------------
    # Count likes
    # --------------------------------------------------------

    like_count = (
        db.query(Like)
        .filter(
            Like.experience_id == experience_id
        )
        .count()
    )

    return {
        "like_count": like_count
    }


# ============================================================
# CREATE COMMENT
# ============================================================

@router.post(
    "/{experience_id}/comments",
    response_model=CommentResponse,
    status_code=201
)
def create_comment(
    experience_id: uuid.UUID,
    comment: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    # --------------------------------------------------------
    # Check that the experience exists
    # --------------------------------------------------------

    experience = (
        db.query(Experience)
        .filter(
            Experience.id == experience_id
        )
        .first()
    )

    if experience is None:

        raise HTTPException(
            status_code=404,
            detail="Experience not found"
        )

    # --------------------------------------------------------
    # Check parent comment if this is a reply
    # --------------------------------------------------------

    parent_comment = None

    if comment.parent_comment_id is not None:

        parent_comment = (
            db.query(Comment)
            .filter(
                Comment.id == comment.parent_comment_id
            )
            .first()
        )

        if parent_comment is None:

            raise HTTPException(
                status_code=404,
                detail="Parent comment not found"
            )

        if parent_comment.experience_id != experience_id:

            raise HTTPException(
                status_code=400,
                detail="Parent comment belongs to another experience"
            )


    # --------------------------------------------------------
    # Create comment
    # --------------------------------------------------------

    new_comment = Comment(
        user_id=current_user.id,
        experience_id=experience_id,
        parent_comment_id=comment.parent_comment_id,
        content=comment.content
    )

    db.add(new_comment)

    db.commit()
    db.refresh(new_comment)

    return new_comment


# ============================================================
# GET COMMENTS FOR AN EXPERIENCE
# ============================================================

@router.get(
    "/{experience_id}/comments",
    response_model=list[CommentResponse]
)
def get_comments(
    experience_id: uuid.UUID,
    db: Session = Depends(get_db)
):

    # --------------------------------------------------------
    # Check that the experience exists
    # --------------------------------------------------------

    experience = (
        db.query(Experience)
        .filter(
            Experience.id == experience_id
        )
        .first()
    )

    if experience is None:

        raise HTTPException(
            status_code=404,
            detail="Experience not found"
        )

    # --------------------------------------------------------
    # Get comments
    # --------------------------------------------------------

    comments = (
        db.query(Comment)
        .filter(
            Comment.experience_id == experience_id
        )
        .order_by(
            Comment.created_at.asc()
        )
        .all()
    )

    return comments


# ============================================================
# UPDATE COMMENT
# ============================================================

@router.patch(
    "/comments/{comment_id}",
    response_model=CommentResponse
)
def update_comment(
    comment_id: uuid.UUID,
    comment: CommentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    # --------------------------------------------------------
    # Find comment
    # --------------------------------------------------------

    existing_comment = (
        db.query(Comment)
        .filter(
            Comment.id == comment_id
        )
        .first()
    )

    if existing_comment is None:

        raise HTTPException(
            status_code=404,
            detail="Comment not found"
        )

    # --------------------------------------------------------
    # Check ownership
    # --------------------------------------------------------

    if existing_comment.user_id != current_user.id:

        raise HTTPException(
            status_code=403,
            detail="You can only edit your own comments"
        )

    # --------------------------------------------------------
    # Update content
    # --------------------------------------------------------

    existing_comment.content = comment.content

    existing_comment.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(existing_comment)

    return existing_comment


# ============================================================
# DELETE COMMENT
# ============================================================

@router.delete(
    "/comments/{comment_id}"
)
def delete_comment(
    comment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    # --------------------------------------------------------
    # Find comment
    # --------------------------------------------------------

    existing_comment = (
        db.query(Comment)
        .filter(
            Comment.id == comment_id
        )
        .first()
    )

    if existing_comment is None:

        raise HTTPException(
            status_code=404,
            detail="Comment not found"
        )

    # --------------------------------------------------------
    # Check ownership
    # --------------------------------------------------------

    if existing_comment.user_id != current_user.id:

        raise HTTPException(
            status_code=403,
            detail="You can only delete your own comments"
        )

    # --------------------------------------------------------
    # Delete comment
    # --------------------------------------------------------

    db.delete(existing_comment)

    db.commit()

    return {
        "message": "Comment deleted successfully"
    }