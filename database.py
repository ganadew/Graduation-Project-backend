from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 1. DB 연결 주소 (charset 설정 포함)
SQLALCHEMY_DATABASE_URL = "mysql+pymysql://root:Fls3579!!!@localhost:3306/fapi_db?charset=utf8mb4"

# 2. 엔진 설정
# 한글 인코딩(utf8mb4)을 확실하게 보장하기 위해 설정을 유지합니다.
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={
        "charset": "utf8mb4",
        "use_unicode": True
    },
    # pool_pre_ping은 DB 연결이 끊어졌는지 미리 체크하는 유용한 옵션이에요!
    pool_pre_ping=True 
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# DB 세션 생성 함수
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()