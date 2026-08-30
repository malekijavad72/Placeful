from pydantic import BaseModel
from uuid import UUID


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
    id: UUID
    username: str
    email: str
    display_name: str | None = None
    bio: str | None = None
    profile_image_url: str | None = None