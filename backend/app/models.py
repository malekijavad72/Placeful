import uuid

from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    SmallInteger,
    BigInteger,
    String,
    Text,
    text,
    func
)

from sqlalchemy.dialects.postgresql import UUID

from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    mapped_column
)

from geoalchemy2 import Geometry


# ============================================================
# BASE
# ============================================================

class Base(DeclarativeBase):
    pass


class Place(Base):

    __tablename__ = "places"


    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()")
    )


    name: Mapped[str | None] = mapped_column(
        String,
        nullable=True
    )

    osm_type: Mapped[str | None] = mapped_column(
        String,
        nullable=True
    )

    osm_id: Mapped[str | None] = mapped_column(
        String,
        nullable=True
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )


    category: Mapped[str | None] = mapped_column(
        String,
        nullable=True
    )


    location: Mapped[object | None] = mapped_column(
        Geometry(
            geometry_type="POINT",
            srid=4326
        ),
        nullable=True
    )


    address: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )


    city: Mapped[str | None] = mapped_column(
        String,
        nullable=True
    )


    country: Mapped[str | None] = mapped_column(
        String,
        nullable=True
    )


    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()")
    )


    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()")
    )

# ============================================================
# EXPERIENCE
# ============================================================

class Experience(Base):

    __tablename__ = "experiences"

    __table_args__ = (
        Index(
            "idx_experiences_location",
            "location",
            postgresql_using="gist"
        ),
    )


    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()")
    )


    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "users.id",
            ondelete="CASCADE"
        ),
        nullable=True
    )


    place_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "places.id",
            ondelete="SET NULL"
        ),
        nullable=True
    )


    title: Mapped[str] = mapped_column(
        String,
        nullable=False
    )


    story: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )


    visited_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )


    location: Mapped[object] = mapped_column(
        Geometry(
            geometry_type="POINT",
            srid=4326
        ),
        nullable=False
    )


    visibility: Mapped[str] = mapped_column(
        String,
        nullable=False,
        server_default=text("'public'")
    )


    is_anonymous: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("false")
    )


    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()")
    )


    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()")
    )


# ============================================================
# EMOTION
# ============================================================

class Emotion(Base):

    __tablename__ = "emotions"


    id: Mapped[int] = mapped_column(
        SmallInteger,
        primary_key=True
    )


    name: Mapped[str] = mapped_column(
        String,
        nullable=False
    )


    slug: Mapped[str] = mapped_column(
        String,
        nullable=False
    )


    icon: Mapped[str | None] = mapped_column(
        String,
        nullable=True
    )

    description: Mapped[str | None] = mapped_column(
        "description",
        Text,
        nullable=True
    )


# ============================================================
# EXPERIENCE EMOTION
# ============================================================

class ExperienceEmotion(Base):

    __tablename__ = "experience_emotions"

    __table_args__ = (
        Index(
            "idx_experience_emotions_emotion_id",
            "emotion_id"
        ),
    )

    experience_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "experiences.id",
            ondelete="CASCADE"
        ),
        primary_key=True
    )


    emotion_id: Mapped[int] = mapped_column(
        SmallInteger,
        ForeignKey(
            "emotions.id",
            ondelete="RESTRICT"
        ),
        primary_key=True
    )


    intensity: Mapped[int | None] = mapped_column(
        SmallInteger,
        nullable=True
    )

# ============================================================
# COMMENT
# ============================================================

class Comment(Base):

    __tablename__ = "comments"

    __table_args__ = (
        Index(
            "idx_comments_experience_id",
            "experience_id"
        ),

        Index(
            "idx_comments_parent_comment_id",
            "parent_comment_id"
        ),
    )


    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()")
    )


    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "users.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )


    experience_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "experiences.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )


    parent_comment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "comments.id",
            ondelete="SET NULL"
        ),
        nullable=True
    )


    content: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )


    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()")
    )


    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()")
    )

# ============================================================
# LIKE
# ============================================================

class Like(Base):

    __tablename__ = "likes"


    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        primary_key=True
    )


    experience_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("experiences.id"),
        primary_key=True
    )


    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()")
    )

class User(Base):

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()")
    )

    username: Mapped[str] = mapped_column(
        String,
        nullable=False,
        unique=True
    )

    email: Mapped[str] = mapped_column(
        String,
        nullable=False,
        unique=True
    )

    password_hash: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )

    display_name: Mapped[str | None] = mapped_column(
        String,
        nullable=True
    )
    

    bio: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    profile_image_url: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()")
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()")
    )

    # ============================================================
# USER FOLLOWS
# ============================================================

class UserFollow(Base):

    __tablename__ = "user_follows"

    follower_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        primary_key=True
    )

    following_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        primary_key=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()")
    )

class ExperienceMedia(Base):

    __tablename__ = "experience_media"


    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()")
    )


    experience_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "experiences.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )


    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )


    storage_key: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )


    media_type: Mapped[str] = mapped_column(
        String,
        nullable=False,
        server_default=text("'image'")
    )


    mime_type: Mapped[str] = mapped_column(
        String,
        nullable=False
    )


    original_filename: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )


    file_size: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False
    )


    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()")
    )
# ============================================================
# REFRESH SESSION
# ============================================================

class RefreshSession(Base):

    __tablename__ = "refresh_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()")
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "users.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    token_hash: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        unique=True
    )

    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()")
    )

    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )