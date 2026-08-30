import json
import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy import func
from sqlalchemy.orm import Session
from geoalchemy2 import WKTElement
from datetime import datetime, timezone
from pathlib import Path

from app.database import get_db 
from app.models import (
    Experience,
    Emotion,
    ExperienceEmotion,
    User,
    Like,
    Comment,
    ExperienceMedia
)
from app.schemas import (
    ExperienceCreate,
    GeoJSONFeatureCollection,
    ExperienceResponse,
    CommentCreate,
    CommentResponse,
    CommentUpdate,
    MediaResponse
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

UPLOAD_DIR = Path("uploads/experiences")

ALLOWED_IMAGE_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp"
}

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_IMAGES_PER_EXPERIENCE = 10
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
# UPLOAD EXPERIENCE MEDIA
# ============================================================

@router.post(
    "/{experience_id}/media",
    status_code=201
)
async def upload_experience_media(
    experience_id: uuid.UUID,
    file: UploadFile = File(...),
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
    # Check ownership
    # --------------------------------------------------------

    if experience.user_id != current_user.id:

        raise HTTPException(
            status_code=403,
            detail="You can only add media to your own experiences"
        )

    # --------------------------------------------------------
    # Check number of existing images
    # --------------------------------------------------------

    media_count = (
        db.query(ExperienceMedia)
        .filter(
            ExperienceMedia.experience_id == experience_id
        )
        .count()
    )

    if media_count >= MAX_IMAGES_PER_EXPERIENCE:

        raise HTTPException(
            status_code=400,
            detail="Maximum number of images reached for this experience"
        )

    # --------------------------------------------------------
    # Check MIME type
    # --------------------------------------------------------

    if file.content_type not in ALLOWED_IMAGE_TYPES:

        raise HTTPException(
            status_code=400,
            detail="Only JPEG, PNG, and WebP images are allowed"
        )

    # --------------------------------------------------------
    # Check filename
    # --------------------------------------------------------

    if not file.filename:

        raise HTTPException(
            status_code=400,
            detail="File must have a filename"
        )

    # --------------------------------------------------------
    # Read file
    # --------------------------------------------------------

    contents = await file.read()

    file_size = len(contents)

    # --------------------------------------------------------
    # Check file size
    # --------------------------------------------------------

    if file_size > MAX_FILE_SIZE:

        raise HTTPException(
            status_code=413,
            detail="File size cannot exceed 10 MB"
        )

    # --------------------------------------------------------
    # Generate storage path
    # --------------------------------------------------------

    experience_directory = (
        UPLOAD_DIR / str(experience_id)
    )

    experience_directory.mkdir(
        parents=True,
        exist_ok=True
    )

    # --------------------------------------------------------
    # Generate safe filename
    # --------------------------------------------------------

    extension = Path(file.filename).suffix.lower()

    generated_filename = (
        f"{uuid.uuid4()}{extension}"
    )

    storage_key = (
        f"experiences/"
        f"{experience_id}/"
        f"{generated_filename}"
    )

    file_path = (
        experience_directory /
        generated_filename
    )

    # --------------------------------------------------------
    # Save file
    # --------------------------------------------------------

    with open(file_path, "wb") as buffer:

        buffer.write(contents)

    # --------------------------------------------------------
    # Create database record
    # --------------------------------------------------------

    new_media = ExperienceMedia(
        experience_id=experience_id,
        user_id=current_user.id,
        storage_key=storage_key,
        media_type="image",
        mime_type=file.content_type,
        original_filename=file.filename,
        file_size=file_size
    )

    db.add(new_media)

    db.commit()
    db.refresh(new_media)

    # --------------------------------------------------------
    # Response
    # --------------------------------------------------------

    return {
        "message": "Media uploaded successfully",
        "id": str(new_media.id),
        "experience_id": str(experience_id),
        "storage_key": storage_key,
        "media_type": new_media.media_type,
        "mime_type": new_media.mime_type,
        "original_filename": new_media.original_filename,
        "file_size": new_media.file_size,
        "created_at": new_media.created_at
    }


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

# ============================================================
# GET EXPERIENCE MEDIA
# ============================================================

@router.get(
    "/{experience_id}/media",
    response_model=list[MediaResponse]
)
def get_experience_media(
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
    # Get media
    # --------------------------------------------------------

    media_items = (
        db.query(ExperienceMedia)
        .filter(
            ExperienceMedia.experience_id == experience_id
        )
        .order_by(
            ExperienceMedia.created_at
        )
        .all()
    )

    # --------------------------------------------------------
    # Build response
    # --------------------------------------------------------

    results = []

    for media in media_items:

        results.append({
            "id": media.id,
            "experience_id": media.experience_id,
            "media_type": media.media_type,
            "mime_type": media.mime_type,
            "original_filename": media.original_filename,
            "file_size": media.file_size,
            "url": f"/uploads/{media.storage_key}",
            "created_at": media.created_at
        })

    return results

# ============================================================
# DELETE EXPERIENCE MEDIA
# ============================================================

@router.delete(
    "/media/{media_id}"
)
def delete_experience_media(
    media_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    # --------------------------------------------------------
    # Find media
    # --------------------------------------------------------

    media = (
        db.query(ExperienceMedia)
        .filter(
            ExperienceMedia.id == media_id
        )
        .first()
    )

    if media is None:

        raise HTTPException(
            status_code=404,
            detail="Media not found"
        )

    # --------------------------------------------------------
    # Check ownership
    # --------------------------------------------------------

    if media.user_id != current_user.id:

        raise HTTPException(
            status_code=403,
            detail="You can only delete your own media"
        )

    # --------------------------------------------------------
    # Delete physical file
    # --------------------------------------------------------

    file_path = Path("uploads") / media.storage_key

    if file_path.exists():

        file_path.unlink()

    # --------------------------------------------------------
    # Delete database record
    # --------------------------------------------------------

    db.delete(media)

    db.commit()

    return {
        "message": "Media deleted successfully"
    }

# ============================================================
# DELETE EXPERIENCE
# ============================================================

@router.delete(
    "/{experience_id}"
)
def delete_experience(
    experience_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    # --------------------------------------------------------
    # Find experience
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
    # Check ownership
    # --------------------------------------------------------

    if experience.user_id != current_user.id:

        raise HTTPException(
            status_code=403,
            detail="You can only delete your own experiences"
        )

    # --------------------------------------------------------
    # Find associated media
    # --------------------------------------------------------

    media_items = (
        db.query(ExperienceMedia)
        .filter(
            ExperienceMedia.experience_id == experience_id
        )
        .all()
    )

    # --------------------------------------------------------
    # Delete physical media files
    # --------------------------------------------------------

    for media in media_items:

        file_path = Path("uploads") / media.storage_key

        if file_path.exists():
            file_path.unlink()

    # --------------------------------------------------------
    # Delete experience
    # --------------------------------------------------------

    db.delete(experience)

    db.commit()

    return {
        "message": "Experience deleted successfully"
    }