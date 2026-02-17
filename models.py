from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users" # 테이블 이름 변경
    
    ID = Column(Integer, primary_key=True, index=True)
    email = Column(String(100), nullable=False)
    password = Column(String(255), nullable=False)
    role = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, server_default=func.now())
    

class ProtectorRelation(Base):
    __tablename__ = "protector_relations"

    ID = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.ID", ondelete="CASCADE"))
    protector_id = Column(Integer, ForeignKey("users.ID", ondelete="CASCADE"))
    relation_type = Column(Integer, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

class Album(Base):
    __tablename__ = "albums"
    
    ID = Column(Integer, primary_key=True, index=True)
    title = Column(String(100), nullable=False)
    patient_id = Column(Integer, ForeignKey("users.ID")) 
    created_at = Column(DateTime, server_default=func.now())

class Media(Base):
    __tablename__ = "media"
    
    ID = Column(Integer, primary_key=True, index=True)
    type = Column(String(20), nullable=False)
    s3_url = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    album_id = Column(Integer, ForeignKey("albums.ID"))
    uploader_id = Column(Integer, ForeignKey("users.ID")) 
    created_at = Column(DateTime, server_default=func.now())