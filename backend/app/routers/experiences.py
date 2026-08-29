import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from geoalchemy2 import WKTElement

from app.database import get_db 
from app.models import (
    Experience,
    Emotion,
    ExperienceEmotion,
    User
)
from app.schemas import (
    ExperienceCreate,
    GeoJSONFeatureCollection,
    ExperienceResponse
)

from app.core.exceptions import (
    bad_request,
    internal_server_error
)

from app.services.experience_service import create_experience as create_experience_service

from app.models import User
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
                "is_anonymous": experience.is_anonymous
            }
        }

        features.append(feature)

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