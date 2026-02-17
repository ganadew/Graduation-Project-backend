"""
식단기록 API 테스트 파일
SQLite를 사용하여 로컬에서 빠르게 테스트
"""

from fastapi import FastAPI
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import models
from controller import meals

# SQLite 데이터베이스 (test.db 파일로 생성)
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_meals.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False}  # SQLite 전용 설정
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 테이블 생성
models.Base.metadata.create_all(bind=engine)

# FastAPI 앱 생성
app = FastAPI(title="식단기록 API 테스트")

# meals 라우터만 추가
app.include_router(meals.router)

# 테스트용 DB 세션
def get_test_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# database.py의 get_db를 오버라이드
from database import get_db
app.dependency_overrides[get_db] = get_test_db

@app.get("/")
def read_root():
    return {"message": "식단기록 API 테스트 서버", "status": "running"}


if __name__ == "__main__":
    import uvicorn
    print("=" * 50)
    print("식단기록 API 테스트 서버 시작")
    print("Swagger UI: http://localhost:8000/docs")
    print("=" * 50)
    uvicorn.run(app, host="0.0.0.0", port=8000)