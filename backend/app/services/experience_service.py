from sqlalchemy.orm import Session
from geoalchemy2 import WKTElement

from app.models import (
    Experience,
    Emotion,
    ExperienceEmotion
)

from app.schemas import ExperienceCreate

from app.core.exceptions import (
    bad_request,
    internal_server_error
)


def create_experience(
    experience: ExperienceCreate,
    db: Session,
    user_id
):

    try:

        # Find the selected emotion
        emotion = (
            db.query(Emotion)
            .filter(
                Emotion.slug == experience.emotion
            )
            .first()
        )

        if emotion is None:

            raise bad_request(
                f"Emotion '{experience.emotion}' does not exist."
            )

        # Create the experience
        new_experience = Experience(
            user_id=user_id,
            title=experience.title,
            story=experience.story,
            location=WKTElement(
                f"POINT("
                f"{experience.longitude} "
                f"{experience.latitude}"
                f")",
                srid=4326
            ),
            visibility=experience.visibility,
            is_anonymous=experience.is_anonymous
        )

        db.add(new_experience)

        # Generate the experience UUID
        db.flush()

        # Create the experience-emotion relationship
        experience_emotion = ExperienceEmotion(
            experience_id=new_experience.id,
            emotion_id=emotion.id
        )

        db.add(experience_emotion)

        # Save everything
        db.commit()

        db.refresh(new_experience)

        return {
            "message": "Experience created successfully",
            "id": str(new_experience.id),
            "title": new_experience.title,
            "emotion": emotion.slug
        }

    except Exception:

        db.rollback()

        raise internal_server_error()