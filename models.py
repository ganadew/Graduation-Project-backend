from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Date, Boolean, Float, DECIMAL
from sqlalchemy.sql import func  # 현재 시간을 가져오기 위해 필요합니다
from database import Base
from sqlalchemy.orm import relationship

class User(Base):
    __tablename__ = "users"
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
    patient_id = Column(Integer, ForeignKey("users.ID"))
    # 2. 앨범 생성 시간 추가
    created_at = Column(DateTime, server_default=func.now())

class Media(Base):
    __tablename__ = "media"
    ID = Column(Integer, primary_key=True, index=True)
    type = Column(String(20), nullable=False) # img/video
    s3_url = Column(String(255), nullable=False) # 저장 경로
    description = Column(Text, nullable=True)
    album_id = Column(Integer, ForeignKey("albums.ID"))
    uploader_id = Column(Integer, ForeignKey("users.ID"))
    # 3. 미디어 업로드 시간 (이미 있던 부분)
    created_at = Column(DateTime, server_default=func.now())


class Medication(Base):
    __tablename__ = "medications"
    ID = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.ID"), nullable=False)
    name = Column(String(100), nullable=False)
    dose = Column(String(100), nullable=False)  # 용량 정보 (예: "1알", "10mg")
    image_url = Column(String(255), nullable=True)  # 약 사진 경로 (옵션)
    created_at = Column(DateTime, server_default=func.now())


class MedicationSchedule(Base):
    __tablename__ = "medication_schedules"
    ID = Column(Integer, primary_key=True, index=True)
    medication_id = Column(Integer, ForeignKey("medications.ID"), nullable=False)
    weekday = Column(Integer, nullable=False)  # 0~6 (예: 0=월, 6=일) 또는 0=일
    time = Column(String(5), nullable=False)  # "HH:MM" 형식 문자열
    created_at = Column(DateTime, server_default=func.now())


class MedicationLog(Base):
    __tablename__ = "medication_logs"
    ID = Column(Integer, primary_key=True, index=True)
    medication_id = Column(Integer, ForeignKey("medications.ID"), nullable=False)
    schedule_id = Column(Integer, ForeignKey("medication_schedules.ID"), nullable=False)
    taken_time = Column(DateTime, server_default=func.now())


class NotificationSetting(Base):
    """알림 설정 (유저당 1개)"""
    __tablename__ = "notification_settings"
    ID = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.ID"), nullable=False, unique=True)
    display_mode = Column(String(20), nullable=True)   # 예: "full", "compact"
    sound_type = Column(String(20), nullable=True)    # 예: "default", "custom"
    sound_volume = Column(Integer, nullable=True)     # 0~100
    photo_enabled = Column(Boolean, default=False)
    photo_url = Column(String(255), nullable=True)    # 알림용 사진 URL
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Notification(Base):
    """스케줄 기준 생성되는 알림 (복약 알림)"""
    __tablename__ = "notifications"
    ID = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey("medication_schedules.ID"), nullable=False)
    target_date = Column(Date, nullable=False)        # 알림 대상 날짜
    status = Column(Integer, nullable=False, default=0)  # 0=대기, 1=완료, 2=스킵
    confirmed_at = Column(DateTime, nullable=True)    # 완료/스킵 시각
    created_at = Column(DateTime, server_default=func.now())

class Meal(Base):
    __tablename__ = "meals"

    ID = Column(Integer, primary_key=True, index=True)
    uploader_ID = Column(Integer, ForeignKey("users.ID", ondelete="CASCADE"), nullable=False)

    meal_type = Column(Integer, nullable=False)        # ✅ 0/1/2/3
    memo = Column(Text, nullable=True)
    image_url = Column(String(255), nullable=True)
    meal_date = Column(DateTime, nullable=False)       # ✅ DATETIME
    created_at = Column(DateTime, server_default=func.now())

    # ✅ 1:N 관계
    items = relationship(
        "MealItem",
        back_populates="meal",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class MealItem(Base):
    __tablename__ = "meal_items"

    ID = Column(Integer, primary_key=True, index=True)
    meal_ID = Column(Integer, ForeignKey("meals.ID", ondelete="CASCADE"), nullable=False)

    name = Column(String(255), nullable=False)
    qty = Column(DECIMAL(6, 2), nullable=True)  # ✅ 너가 OK한 DECIMAL(6,2)
    unit = Column(String(50), nullable=True)
    memo = Column(Text, nullable=True)

    meal = relationship("Meal", back_populates="items")