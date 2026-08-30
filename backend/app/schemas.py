import uuid

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ============================================================
# INPUT: data required to create an experience
# ============================================================

class ExperienceCreate(BaseModel):
    title: str
    story: str
    emotion: str
    latitude: float
    longitude: float
    visibility: str = "public"
    is_anonymous: bool = False


# ============================================================
# GEOJSON
# ============================================================

class GeoJSONPoint(BaseModel):
    type: str
    coordinates: list[float]


class GeoJSONFeature(BaseModel):
    type: str
    geometry: GeoJSONPoint
    properties: dict


class GeoJSONFeatureCollection(BaseModel):
    type: str
    features: list[GeoJSONFeature]

# ============================================================
# OUTPUT: response after creating an experience
# ============================================================

class ExperienceResponse(BaseModel):

    message: str

    id: str

    title: str

    emotion: str


# ============================================================
# AUTHENTICATION
# ============================================================

class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    user_id: str | None = None


class UserCreate(BaseModel):
    username: str
    email: str
    password: str


class UserProfileUpdate(BaseModel):
    display_name: str | None = None
    bio: str | None = None
    profile_image_url: str | None = None


class UserResponse(BaseModel):
    id: uuid.UUID
    username: str
    email: str
    display_name: str | None = None
    bio: str | None = None
    profile_image_url: str | None = None


class CommentCreate(BaseModel):
    content: str = Field(
        min_length=1,
        max_length=5000
    )

    parent_comment_id: uuid.UUID | None = None

    @field_validator("content")
    @classmethod
    def validate_content(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError("Comment cannot be empty")

        return value


class CommentResponse(BaseModel):

    id: uuid.UUID
    user_id: uuid.UUID
    experience_id: uuid.UUID
    parent_comment_id: uuid.UUID | None
    content: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )


class CommentUpdate(BaseModel):
    content: str = Field(
        min_length=1,
        max_length=5000
    )

    @field_validator("content")
    @classmethod
    def validate_content(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError("Comment cannot be empty")

        return value