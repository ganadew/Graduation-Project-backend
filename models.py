from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.sql import func # 현재 시간을 가져오기 위해 필요합니다
from database import Base

class User(Base):
    __tablename__ = "user"
    ID = Column(Integer, primary_key=True, index=True)
    email = Column(String(100), nullable=False)
    password = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False)
    # 1. 유저 생성 시간 추가
    created_at = Column(DateTime, server_default=func.now())

class Album(Base):
    __tablename__ = "albums"
    ID = Column(Integer, primary_key=True, index=True)
    title = Column(String(100), nullable=False)
    patient_id = Column(Integer, ForeignKey("user.ID"))
    # 2. 앨범 생성 시간 추가
    created_at = Column(DateTime, server_default=func.now())

class Media(Base):
    __tablename__ = "media"
    ID = Column(Integer, primary_key=True, index=True)
    type = Column(String(20), nullable=False) # img/video
    s3_url = Column(String(255), nullable=False) # 저장 경로
    description = Column(Text, nullable=True)
    album_id = Column(Integer, ForeignKey("albums.ID"))
    uploader_id = Column(Integer, ForeignKey("user.ID"))
    # 3. 미디어 업로드 시간 (이미 있던 부분)
    created_at = Column(DateTime, server_default=func.now())