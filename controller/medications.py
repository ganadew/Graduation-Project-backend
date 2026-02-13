from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from database import get_db
from models import Medication, MedicationSchedule, MedicationLog

router = APIRouter(
    prefix="/medications",
    tags=["medications"],
)


# ---------- 1) 약 정보 (medications) ----------

@router.post("", response_model=None)
def create_medication(
    user_id: int,
    name: str,
    dose: str,
    image_url: Optional[str] = None,
    db: Session = Depends(get_db),
):
    medication = Medication(
        user_id=user_id,
        name=name,
        dose=dose,
        image_url=image_url,
    )
    db.add(medication)
    db.commit()
    db.refresh(medication)
    return medication


@router.get("", response_model=None)
def list_medications(user_id: int, db: Session = Depends(get_db)):
    meds = db.query(Medication).filter(Medication.user_id == user_id).all()
    return meds


@router.put("/{medication_id}", response_model=None)
def update_medication(
    medication_id: int,
    name: Optional[str] = None,
    dose: Optional[str] = None,
    image_url: Optional[str] = None,
    db: Session = Depends(get_db),
):
    medication = db.query(Medication).filter(Medication.ID == medication_id).first()
    if not medication:
        raise HTTPException(status_code=404, detail="Medication not found")

    if name is not None:
        medication.name = name
    if dose is not None:
        medication.dose = dose
    if image_url is not None:
        medication.image_url = image_url

    db.commit()
    db.refresh(medication)
    return medication


@router.delete("/{medication_id}")
def delete_medication(medication_id: int, db: Session = Depends(get_db)):
    medication = db.query(Medication).filter(Medication.ID == medication_id).first()
    if not medication:
        raise HTTPException(status_code=404, detail="Medication not found")

    # 이 약과 연결된 schedule, log 같이 삭제
    schedules = (
        db.query(MedicationSchedule)
        .filter(MedicationSchedule.medication_id == medication_id)
        .all()
    )
    schedule_ids = [s.ID for s in schedules]

    if schedule_ids:
        db.query(MedicationLog).filter(
            MedicationLog.schedule_id.in_(schedule_ids)
        ).delete(synchronize_session=False)

    db.query(MedicationSchedule).filter(
        MedicationSchedule.medication_id == medication_id
    ).delete(synchronize_session=False)

    db.delete(medication)
    db.commit()

    return {"message": "Medication and related schedules/logs deleted successfully"}


# ---------- 2) 복약 일정 (schedules) ----------


@router.post("/schedules")
def create_schedule(
    medication_id: int,
    weekday: int,
    time: str,  # "HH:MM"
    db: Session = Depends(get_db),
):
    if weekday < 0 or weekday > 6:
        raise HTTPException(status_code=400, detail="weekday must be between 0 and 6")

    # 간단한 형식 검증 (HH:MM)
    try:
        datetime.strptime(time, "%H:%M")
    except ValueError:
        raise HTTPException(status_code=400, detail="time must be HH:MM format")

    schedule = MedicationSchedule(
        medication_id=medication_id,
        weekday=weekday,
        time=time,
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return schedule


@router.get("/schedules")
def list_schedules(medication_id: int, db: Session = Depends(get_db)):
    schedules = (
        db.query(MedicationSchedule)
        .filter(MedicationSchedule.medication_id == medication_id)
        .all()
    )
    return schedules


@router.delete("/schedules/{schedule_id}")
def delete_schedule(schedule_id: int, db: Session = Depends(get_db)):
    schedule = (
        db.query(MedicationSchedule)
        .filter(MedicationSchedule.ID == schedule_id)
        .first()
    )
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    # 관련 로그 같이 삭제
    db.query(MedicationLog).filter(
        MedicationLog.schedule_id == schedule_id
    ).delete(synchronize_session=False)

    db.delete(schedule)
    db.commit()
    return {"message": "Schedule and related logs deleted successfully"}


# ---------- 3) 복용 완료 및 기록 (logs) ----------


@router.post("/schedules/{schedule_id}/take")
def take_medication(schedule_id: int, db: Session = Depends(get_db)):
    schedule = (
        db.query(MedicationSchedule)
        .filter(MedicationSchedule.ID == schedule_id)
        .first()
    )
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    log = MedicationLog(
        medication_id=schedule.medication_id,
        schedule_id=schedule_id,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


@router.get("/logs")
def list_logs(medication_id: int, db: Session = Depends(get_db)):
    logs = (
        db.query(MedicationLog)
        .filter(MedicationLog.medication_id == medication_id)
        .order_by(MedicationLog.taken_time.desc())
        .all()
    )
    return logs

