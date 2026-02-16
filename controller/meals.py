from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, date

from database import get_db
from models import Meal

router = APIRouter(
    prefix="/meals",
    tags=["meals"],
)


# ---------- 1) 식단 기록 생성 ----------

@router.post("", response_model=None)
def create_meal(
    user_id: int,
    meal_type: str,  # 아침/점심/저녁/간식
    food_items: str,
    meal_date: str,  # "YYYY-MM-DD HH:MM:SS" 형식
    memo: Optional[str] = None,
    image_url: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    식단 기록 생성
    - user_id: 사용자 ID
    - meal_type: 식사 유형 (아침/점심/저녁/간식)
    - food_items: 음식 목록 (예: "밥, 국, 김치, 생선")
    - meal_date: 식사 날짜/시간 (YYYY-MM-DD HH:MM:SS)
    - memo: 메모 (선택)
    - image_url: 식단 사진 URL (선택)
    """
    # 날짜 형식 검증
    try:
        parsed_date = datetime.strptime(meal_date, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        raise HTTPException(
            status_code=400, 
            detail="meal_date must be in YYYY-MM-DD HH:MM:SS format"
        )
    
    # 식사 유형 검증
    valid_meal_types = ["아침", "점심", "저녁", "간식"]
    if meal_type not in valid_meal_types:
        raise HTTPException(
            status_code=400,
            detail=f"meal_type must be one of {valid_meal_types}"
        )
    
    meal = Meal(
        user_id=user_id,
        meal_type=meal_type,
        food_items=food_items,
        meal_date=parsed_date,
        memo=memo,
        image_url=image_url,
    )
    db.add(meal)
    db.commit()
    db.refresh(meal)
    return meal


# ---------- 2) 식단 기록 전체 조회 (날짜별 필터링 포함) ----------

@router.get("", response_model=None)
def list_meals(
    user_id: int,
    date: Optional[str] = None,  # "YYYY-MM-DD" 형식
    db: Session = Depends(get_db)
):
    """
    식단 기록 조회
    - user_id: 사용자 ID
    - date: 특정 날짜 조회 (선택, YYYY-MM-DD 형식)
    
    date가 없으면 해당 사용자의 모든 식단 기록 반환
    date가 있으면 해당 날짜의 식단 기록만 반환
    """
    query = db.query(Meal).filter(Meal.user_id == user_id)
    
    # 날짜별 필터링
    if date:
        try:
            target_date = datetime.strptime(date, "%Y-%m-%d").date()
            # 해당 날짜의 00:00:00 ~ 23:59:59
            start_datetime = datetime.combine(target_date, datetime.min.time())
            end_datetime = datetime.combine(target_date, datetime.max.time())
            
            query = query.filter(
                Meal.meal_date >= start_datetime,
                Meal.meal_date <= end_datetime
            )
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="date must be in YYYY-MM-DD format"
            )
    
    meals = query.order_by(Meal.meal_date.desc()).all()
    return meals


# ---------- 3) 식단 상세 조회 ----------

@router.get("/{meal_id}", response_model=None)
def get_meal(meal_id: int, db: Session = Depends(get_db)):
    """
    특정 식단 기록 상세 조회
    - meal_id: 식단 기록 ID
    """
    meal = db.query(Meal).filter(Meal.ID == meal_id).first()
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")
    
    return meal


# ---------- 4) 식단 수정 ----------

@router.put("/{meal_id}", response_model=None)
def update_meal(
    meal_id: int,
    meal_type: Optional[str] = None,
    food_items: Optional[str] = None,
    meal_date: Optional[str] = None,
    memo: Optional[str] = None,
    image_url: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    식단 기록 수정
    - meal_id: 수정할 식단 기록 ID
    - 나머지 파라미터: 수정할 내용 (선택적)
    """
    meal = db.query(Meal).filter(Meal.ID == meal_id).first()
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")
    
    # 식사 유형 수정
    if meal_type is not None:
        valid_meal_types = ["아침", "점심", "저녁", "간식"]
        if meal_type not in valid_meal_types:
            raise HTTPException(
                status_code=400,
                detail=f"meal_type must be one of {valid_meal_types}"
            )
        meal.meal_type = meal_type
    
    # 음식 목록 수정
    if food_items is not None:
        meal.food_items = food_items
    
    # 식사 날짜 수정
    if meal_date is not None:
        try:
            parsed_date = datetime.strptime(meal_date, "%Y-%m-%d %H:%M:%S")
            meal.meal_date = parsed_date
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="meal_date must be in YYYY-MM-DD HH:MM:SS format"
            )
    
    # 메모 수정
    if memo is not None:
        meal.memo = memo
    
    # 이미지 URL 수정
    if image_url is not None:
        meal.image_url = image_url
    
    db.commit()
    db.refresh(meal)
    return meal


# ---------- 5) 식단 삭제 ----------

@router.delete("/{meal_id}")
def delete_meal(meal_id: int, db: Session = Depends(get_db)):
    """
    식단 기록 삭제
    - meal_id: 삭제할 식단 기록 ID
    """
    meal = db.query(Meal).filter(Meal.ID == meal_id).first()
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")
    
    db.delete(meal)
    db.commit()
    
    return {"message": "Meal deleted successfully"}