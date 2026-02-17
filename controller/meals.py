from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import datetime

from pydantic import BaseModel, Field

from database import get_db
from models import Meal, MealItem

router = APIRouter(
    prefix="/meals",
    tags=["meals"],
)


# =========================
# ✅ Pydantic Schemas (파일 안에 같이 둬서 바로 복붙 가능)
# =========================

class MealItemCreate(BaseModel):
    name: str
    qty: Optional[float] = None
    unit: Optional[str] = None
    memo: Optional[str] = None


class MealCreate(BaseModel):
    uploader_ID: int
    meal_type: int = Field(..., description="0=아침,1=점심,2=저녁,3=간식")
    meal_date: datetime
    memo: Optional[str] = None
    image_url: Optional[str] = None
    items: List[MealItemCreate] = []


class MealUpdate(BaseModel):
    meal_type: Optional[int] = Field(None, description="0=아침,1=점심,2=저녁,3=간식")
    meal_date: Optional[datetime] = None
    memo: Optional[str] = None
    image_url: Optional[str] = None
    # MVP에서는 통째 교체 방식 추천
    items: Optional[List[MealItemCreate]] = None


class MealItemOut(BaseModel):
    ID: int
    name: str
    qty: Optional[float] = None
    unit: Optional[str] = None
    memo: Optional[str] = None

    class Config:
        from_attributes = True


class MealOut(BaseModel):
    ID: int
    uploader_ID: int
    meal_type: int
    meal_date: datetime
    memo: Optional[str] = None
    image_url: Optional[str] = None
    created_at: Optional[datetime] = None
    items: List[MealItemOut] = []

    class Config:
        from_attributes = True


def _validate_meal_type(meal_type: int):
    if meal_type not in (0, 1, 2, 3):
        raise HTTPException(status_code=400, detail="meal_type must be one of 0,1,2,3")


# =========================
# 1) 식단 기록 생성 (meal + items)
# =========================

@router.post("", response_model=MealOut)
def create_meal(payload: MealCreate, db: Session = Depends(get_db)):
    _validate_meal_type(payload.meal_type)

    meal = Meal(
        uploader_ID=payload.uploader_ID,
        meal_type=payload.meal_type,
        meal_date=payload.meal_date,
        memo=payload.memo,
        image_url=payload.image_url,
    )
    db.add(meal)
    db.flush()  # ✅ meal.ID 확보

    for item in payload.items:
        db.add(
            MealItem(
                meal_ID=meal.ID,
                name=item.name,
                qty=item.qty,
                unit=item.unit,
                memo=item.memo,
            )
        )

    db.commit()

    meal = (
        db.query(Meal)
        .options(joinedload(Meal.items))
        .filter(Meal.ID == meal.ID)
        .first()
    )
    return meal


# =========================
# 2) 식단 기록 전체 조회 (날짜 필터 옵션)
# =========================

@router.get("", response_model=List[MealOut])
def list_meals(
    uploader_ID: int,
    date: Optional[str] = None,  # "YYYY-MM-DD"
    db: Session = Depends(get_db),
):
    query = (
        db.query(Meal)
        .options(joinedload(Meal.items))
        .filter(Meal.uploader_ID == uploader_ID)
    )

    if date:
        try:
            target_date = datetime.strptime(date, "%Y-%m-%d").date()
            start_dt = datetime.combine(target_date, datetime.min.time())
            end_dt = datetime.combine(target_date, datetime.max.time())
            query = query.filter(Meal.meal_date >= start_dt, Meal.meal_date <= end_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="date must be in YYYY-MM-DD format")

    meals = query.order_by(Meal.meal_date.desc()).all()
    return meals


# =========================
# 3) 식단 상세 조회
# =========================

@router.get("/{meal_id}", response_model=MealOut)
def get_meal(meal_id: int, db: Session = Depends(get_db)):
    meal = (
        db.query(Meal)
        .options(joinedload(Meal.items))
        .filter(Meal.ID == meal_id)
        .first()
    )
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")
    return meal


# =========================
# 4) 식단 수정 (MVP: items는 통째 교체)
# =========================

@router.put("/{meal_id}", response_model=MealOut)
def update_meal(meal_id: int, payload: MealUpdate, db: Session = Depends(get_db)):
    meal = db.query(Meal).filter(Meal.ID == meal_id).first()
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")

    if payload.meal_type is not None:
        _validate_meal_type(payload.meal_type)
        meal.meal_type = payload.meal_type

    if payload.meal_date is not None:
        meal.meal_date = payload.meal_date

    if payload.memo is not None:
        meal.memo = payload.memo

    if payload.image_url is not None:
        meal.image_url = payload.image_url

    # items 통째 교체 (payload.items가 None이면 그대로 둠)
    if payload.items is not None:
        # 기존 items 삭제
        db.query(MealItem).filter(MealItem.meal_ID == meal.ID).delete()
        # 새 items 추가
        for item in payload.items:
            db.add(
                MealItem(
                    meal_ID=meal.ID,
                    name=item.name,
                    qty=item.qty,
                    unit=item.unit,
                    memo=item.memo,
                )
            )

    db.commit()

    meal = (
        db.query(Meal)
        .options(joinedload(Meal.items))
        .filter(Meal.ID == meal_id)
        .first()
    )
    return meal


# =========================
# 5) 식단 삭제
# =========================

@router.delete("/{meal_id}")
def delete_meal(meal_id: int, db: Session = Depends(get_db)):
    meal = db.query(Meal).filter(Meal.ID == meal_id).first()
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")

    db.delete(meal)
    db.commit()
    return {"message": "Meal deleted successfully"}
