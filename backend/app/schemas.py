import uuid

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


# ============================================================
# INPUT: data required to create an experience
# ============================================================

class ExperienceCreate(BaseModel):
    place_id: uuid.UUID | None = None
    title: str
    story: str
    emotion: str
    latitude: float
    longitude: float
    visibility: str = "public"
    is_anonymous: bool = False

# ============================================================
# PLACE
# ============================================================

class PlaceCreate(BaseModel):

    name: str
    description: str | None = None
    category: str | None = None
    latitude: float
    longitude: float
    address: str | None = None
    city: str | None = None
    country: str | None = None
    osm_type: str | None = None
    osm_id: str | None = None

class PlaceResponse(BaseModel):

    id: uuid.UUID
    name: str | None
    description: str | None
    category: str | None
    latitude: float | None
    longitude: float | None
    address: str | None
    city: str | None
    country: str | None
    osm_type: str | None
    osm_id: str | None
    created_at: datetime
    updated_at: datetime

class PlaceCandidate(BaseModel):

    name: str | None
    category: str | None
    address: str | None
    city: str | None
    country: str | None
    latitude: float
    longitude: float
    distance: float
    osm_type: str | None
    osm_id: str | None
    display_name: str | None


class PlaceIdentificationResponse(BaseModel):

    candidates: list[PlaceCandidate]

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
    refresh_token: str
    token_type: str


class TokenData(BaseModel):
    user_id: str | None = None


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        import re

        if len(value) < 8:
            raise ValueError("Password must be at least 8 characters")

        if not re.search(r"[A-Za-z]", value):
            raise ValueError("Password must contain at least one letter")

        if not re.search(r"[0-9]", value):
            raise ValueError("Password must contain at least one number")

        return value

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

    username: str | None = None
    display_name: str | None = None
    profile_image_url: str | None = None

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


class MediaResponse(BaseModel):
    id: uuid.UUID
    experience_id: uuid.UUID
    media_type: str
    mime_type: str
    original_filename: str
    file_size: int
    url: str
    created_at: datetime