"""
알림 설정 API + 알림(Notification) API + 스케줄 기반 알림 생성 로직
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import date, datetime

from database import get_db
from models import (
    NotificationSetting,
    Notification,
    MedicationSchedule,
    Medication,
)

router = APIRouter(tags=["notifications"])


# ---------- 1) 알림 설정 (Notification Settings) ----------


@router.get("/notification-settings")
def get_notification_settings(
    user_id: int,
    db: Session = Depends(get_db),
):
    """로그인한 사용자의 알림 설정 조회"""
    setting = (
        db.query(NotificationSetting)
        .filter(NotificationSetting.user_id == user_id)
        .first()
    )
    if not setting:
        raise HTTPException(status_code=404, detail="Notification settings not found")
    return setting


@router.post("/notification-settings")
def create_notification_settings(
    user_id: int,
    display_mode: Optional[str] = None,
    sound_type: Optional[str] = None,
    sound_volume: Optional[int] = None,
    photo_enabled: Optional[bool] = None,
    photo_url: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """알림 설정 최초 생성 (유저당 1개)"""
    existing = (
        db.query(NotificationSetting)
        .filter(NotificationSetting.user_id == user_id)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Notification settings already exist for this user. Use PUT to update.",
        )
    if sound_volume is not None and (sound_volume < 0 or sound_volume > 100):
        raise HTTPException(status_code=400, detail="sound_volume must be 0-100")

    setting = NotificationSetting(
        user_id=user_id,
        display_mode=display_mode,
        sound_type=sound_type,
        sound_volume=sound_volume,
        photo_enabled=photo_enabled if photo_enabled is not None else False,
        photo_url=photo_url,
    )
    db.add(setting)
    db.commit()
    db.refresh(setting)
    return setting


@router.put("/notification-settings")
def update_notification_settings(
    user_id: int,
    display_mode: Optional[str] = None,
    sound_type: Optional[str] = None,
    sound_volume: Optional[int] = None,
    photo_enabled: Optional[bool] = None,
    photo_url: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """알림 설정 수정"""
    setting = (
        db.query(NotificationSetting)
        .filter(NotificationSetting.user_id == user_id)
        .first()
    )
    if not setting:
        raise HTTPException(status_code=404, detail="Notification settings not found")
    if sound_volume is not None and (sound_volume < 0 or sound_volume > 100):
        raise HTTPException(status_code=400, detail="sound_volume must be 0-100")

    if display_mode is not None:
        setting.display_mode = display_mode
    if sound_type is not None:
        setting.sound_type = sound_type
    if sound_volume is not None:
        setting.sound_volume = sound_volume
    if photo_enabled is not None:
        setting.photo_enabled = photo_enabled
    if photo_url is not None:
        setting.photo_url = photo_url

    db.commit()
    db.refresh(setting)
    return setting


# ---------- 2) 알림 (Notifications) ----------


@router.get("/notifications")
def list_notifications(
    user_id: int,
    target_date: Optional[date] = Query(None, description="조회할 날짜 (없으면 오늘)"),
    status: Optional[int] = Query(None, description="0=대기, 1=완료, 2=스킵"),
    db: Session = Depends(get_db),
):
    """특정 날짜 또는 오늘의 알림 목록 조회 (status 필터 가능)"""
    if target_date is None:
        target_date = date.today()

    # 해당 유저의 medication id 목록
    med_ids = [m.ID for m in db.query(Medication.ID).filter(Medication.user_id == user_id).all()]
    if not med_ids:
        return []

    # 해당 약들의 schedule id 목록
    schedule_ids = [
        s.ID
        for s in db.query(MedicationSchedule.ID)
        .filter(MedicationSchedule.medication_id.in_(med_ids))
        .all()
    ]
    if not schedule_ids:
        return []

    q = (
        db.query(Notification)
        .filter(
            Notification.schedule_id.in_(schedule_ids),
            Notification.target_date == target_date,
        )
    )
    if status is not None:
        q = q.filter(Notification.status == status)
    notifications = q.order_by(Notification.ID).all()
    return notifications


@router.put("/notifications/{notification_id}/confirm")
def confirm_notification(
    notification_id: int,
    db: Session = Depends(get_db),
):
    """복약 완료 처리 (status=1, confirmed_at 저장)"""
    notification = (
        db.query(Notification)
        .filter(Notification.ID == notification_id)
        .first()
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.status = 1
    notification.confirmed_at = datetime.now()
    db.commit()
    db.refresh(notification)
    return notification


@router.put("/notifications/{notification_id}/skip")
def skip_notification(
    notification_id: int,
    db: Session = Depends(get_db),
):
    """복약 안 함 처리 (status=2)"""
    notification = (
        db.query(Notification)
        .filter(Notification.ID == notification_id)
        .first()
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.status = 2
    notification.confirmed_at = datetime.now()
    db.commit()
    db.refresh(notification)
    return notification


# ---------- 3) 내부 로직: 스케줄 기반 알림 생성 ----------


def create_notifications_for_date(target_date: date, db: Session) -> List[Notification]:
    """
    schedule.time 기준으로 해당 target_date에 대한 notifications row 생성.
    이미 같은 (schedule_id, target_date) 알림이 있으면 건너뜀.
    cron 또는 주기적 검사에서 호출용.
    """
    # target_date의 요일 (0=월 ~ 6=일, Python weekday: 0=월)
    weekday = target_date.weekday()  # 0=월, 6=일

    schedules = (
        db.query(MedicationSchedule)
        .filter(MedicationSchedule.weekday == weekday)
        .all()
    )
    created = []
    for schedule in schedules:
        existing = (
            db.query(Notification)
            .filter(
                Notification.schedule_id == schedule.ID,
                Notification.target_date == target_date,
            )
            .first()
        )
        if existing:
            continue
        notification = Notification(
            schedule_id=schedule.ID,
            target_date=target_date,
            status=0,
        )
        db.add(notification)
        created.append(notification)
    db.commit()
    for n in created:
        db.refresh(n)
    return created


@router.post("/internal/create-notifications")
def api_create_notifications_for_date(
    target_date: Optional[date] = Query(None, description="대상 날짜 (없으면 오늘)"),
    db: Session = Depends(get_db),
):
    """
    스케줄 기반 알림 생성 (cron 등에서 호출용).
    예: GET /internal/create-notifications?target_date=2025-02-14
    """
    if target_date is None:
        target_date = date.today()
    created = create_notifications_for_date(target_date, db)
    return {"created": len(created), "target_date": str(target_date), "items": created}
