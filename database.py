from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 개발 편의를 위해 일단 SQLite 로 사용
# (파일 하나로 동작하고, 별도 MySQL 설정이 필요 없음)
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

# SQLite 에서는 check_same_thread 옵션이 필요
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# DB 세션을 가져오는 함수 (FastAPI에서 사용)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()