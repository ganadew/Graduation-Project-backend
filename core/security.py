from passlib.context import CryptContext
from datetime import datetime, timedelta
from jose import jwt # 👈 토큰 발행을 위해 필요해요

# 1. 암호화 설정
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# 2. JWT 토큰 설정 (졸업 작품용 30일 설정!)
SECRET_KEY = "sik-sik-als-project-secret-key" # 보안을 위해 복잡한 문자열로!
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30 

# 비밀번호 암호화 함수
def hash_password(password: str):
    return pwd_context.hash(password)

# 비밀번호 확인 함수
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

# ⭐️ 씩씩이님이 필요했던 '그 함수' (토큰 생성)
def create_access_token(data: dict):
    to_encode = data.copy()
    # 현재 시간 + 30일로 만료 시간 설정
    expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    
    # 설정값들을 모아 토큰 한 줄로 만들기
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt