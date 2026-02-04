from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# MySQL 정보 (비밀번호 부분만 본인 것으로 바꾸세요!)
# 주소: mysql+pymysql://사용자명:비밀번호@호스트:포트/데이터베이스이름
SQLALCHEMY_DATABASE_URL = "mysql+pymysql://root:너네 비번@localhost:3306/fapi_db"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# DB 세션을 가져오는 함수 (FastAPI에서 사용)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()