from sqlalchemy import Column, Integer, String, DateTime, Enum
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String(255), nullable=False, unique=True)
    password = Column(String(255), nullable=False)
    role = Column(Enum("patient", "guardian"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

from sqlalchemy import ForeignKey, Text
from sqlalchemy.orm import relationship

# 앨범 테이블
class Album(Base):
    __tablename__ = "albums"

    id = Column(Integer, primary_key=True)
    title = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


# 앨범 멤버 테이블
class AlbumMember(Base):
    __tablename__ = "album_members"

    id = Column(Integer, primary_key=True)
    album_id = Column(Integer, ForeignKey("albums.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(Enum("patient", "guardian"), nullable=False)
    joined_at = Column(DateTime, default=datetime.utcnow)


# 미디어 테이블
class Media(Base):
    __tablename__ = "media"

    id = Column(Integer, primary_key=True)
    album_id = Column(Integer, ForeignKey("albums.id"), nullable=False)
    uploader_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    type = Column(Enum("image", "video", "audio"), nullable=False)
    s3_url = Column(Text, nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
