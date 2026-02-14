from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
import models
from pydantic import BaseModel, EmailStr
from core.security import hash_password, verify_password 

# 1. 라우터 정의
router = APIRouter(prefix="/users", tags=["users"])

# 2. Pydantic 스키마 정의
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: str # 'patient', 'protector'

class UserLogin(BaseModel):
    email: EmailStr
    password: str

# ⭐️ 새롭게 추가된 친구 추가 요청 스키마
class AddProtectorRequest(BaseModel):
    patient_id: int      # 내(환자) ID
    protector_email: str # 추가하고 싶은 보호자의 이메일
    relation_name: str   # 관계 (예: 큰딸, 배우자 등)

# 3. API 기능 구현

# [회원가입]
@router.post("/signup")
async def signup(user_data: UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(models.User).filter(models.User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="이미 등록된 이메일입니다.")
    
    secure_password = hash_password(user_data.password)
    new_user = models.User(
        email=user_data.email,
        password=secure_password,
        role=user_data.role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "보안 회원가입 성공!", "user_id": new_user.ID}

# [로그인]
@router.post("/login")
async def login(login_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == login_data.email).first()
    if not user or not verify_password(login_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="이메일 또는 비밀번호가 올바르지 않습니다."
        )
    return {
        "message": "보안 로그인 성공!",
        "user_id": user.ID,
        "email": user.email,
        "role": user.role
    }

# [보호자 친구 추가] ⭐️ 환자가 보호자 이메일을 쳐서 관계 맺기
@router.post("/add-protector")
async def add_protector(data: AddProtectorRequest, db: Session = Depends(get_db)):
    # 1. 보호자 존재 확인
    protector = db.query(models.User).filter(models.User.email == data.protector_email).first()
    if not protector:
        raise HTTPException(status_code=404, detail="해당 이메일의 보호자를 찾을 수 없습니다.")
    
    # 2. 본인 추가 방지
    if data.patient_id == protector.ID:
        raise HTTPException(status_code=400, detail="자기 자신을 보호자로 등록할 수 없습니다.")

    # 3. 중복 연결 확인
    existing = db.query(models.ProtectorRelation).filter(
        models.ProtectorRelation.patient_id == data.patient_id,
        models.ProtectorRelation.protector_id == protector.ID
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="이미 연결된 보호자입니다.")
    
    # 4. 관계 저장
    new_relation = models.ProtectorRelation(
        patient_id=data.patient_id,
        protector_id=protector.ID,
        relation_name=data.relation_name
    )
    db.add(new_relation)
    db.commit()
    return {"message": f"{protector.email} 님을 보호자로 추가했습니다!"}

# [내 보호자 목록 조회] ⭐️ 환자가 자기가 추가한 보호자들 확인하기
@router.get("/my-protectors/{patient_id}")
async def get_my_protectors(patient_id: int, db: Session = Depends(get_db)):
    protectors = db.query(models.ProtectorRelation).filter(
        models.ProtectorRelation.patient_id == patient_id
    ).all()
    return protectors

# [사용자 상세 조회]
@router.get("/{user_id}")
async def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.ID == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    return user