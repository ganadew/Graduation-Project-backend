from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
import models
from pydantic import BaseModel, EmailStr
# 로그인 유효기간을 위한 create_access_token 추가 (security.py에 정의)
from core.security import hash_password, verify_password, create_access_token 

router = APIRouter(prefix="/users", tags=["users"])

# 2. Pydantic 스키마 정의 (Int형 반영)
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    # ⭐️ 0: 환자, 1: 보호자 
    role: int 

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class AddProtectorRequest(BaseModel):
    patient_id: int
    protector_email: str
    # ⭐️ 0: 배우자, 1: 자녀, 2: 부모, 3: 형제/자매, 4: 기타
    relation_type: int 

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
        role=user_data.role # 숫자로 저장됨
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "보안 회원가입 성공!", "user_id": new_user.ID}

# [로그인] - 30일 유지 토큰 발행 로직 추가
@router.post("/login")
async def login(login_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == login_data.email).first()
    if not user or not verify_password(login_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="이메일 또는 비밀번호가 올바르지 않습니다."
        )
    
    # ⭐️ 로그인 성공 시 Access Token 발행 (유효기간은 security.py에서 설정)
    access_token = create_access_token(data={"sub": user.email})
    
    return {
        "message": "보안 로그인 성공!",
        "access_token": access_token, # 👈 앱/웹에서 이걸 저장해서 30일 동안 사용
        "token_type": "bearer",
        "user_id": user.ID,
        "role": user.role
    }

# [보호자 친구 추가]
@router.post("/add-protector")
async def add_protector(data: AddProtectorRequest, db: Session = Depends(get_db)):
    protector = db.query(models.User).filter(models.User.email == data.protector_email).first()
    if not protector:
        raise HTTPException(status_code=404, detail="해당 이메일의 보호자를 찾을 수 없습니다.")
    
    if data.patient_id == protector.ID:
        raise HTTPException(status_code=400, detail="자기 자신을 보호자로 등록할 수 없습니다.")

    existing = db.query(models.ProtectorRelation).filter(
        models.ProtectorRelation.patient_id == data.patient_id,
        models.ProtectorRelation.protector_id == protector.ID
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="이미 연결된 보호자입니다.")
    
    new_relation = models.ProtectorRelation(
        patient_id=data.patient_id,
        protector_id=protector.ID,
        relation_type=data.relation_type,
    )
    db.add(new_relation)
    db.commit()
    return {"message": f"{protector.email} 님을 보호자로 추가했습니다!"}