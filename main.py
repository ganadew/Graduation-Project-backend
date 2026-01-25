from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Album, AlbumMember

app = FastAPI()


# DB 세션 관리 함수
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# 기본 확인용
@app.get("/")
def home():
    return {"message": "FastAPI 살아있음"}


# DB 연결 테스트
@app.get("/db-test")
def db_test(db: Session = Depends(get_db)):
    return {"result": "MySQL 연결 성공"}


# 앨범 생성 API
@app.post("/albums")
def create_album(title: str, db: Session = Depends(get_db)):
    # 1. 앨범 생성
    album = Album(title=title)
    db.add(album)
    db.commit()
    db.refresh(album)

    # 2. 만든 사람을 앨범 멤버로 자동 등록
    album_member = AlbumMember(
        album_id=album.id,
        user_id=1,          # 로그인 전 임시값
        role="patient"
    )
    db.add(album_member)
    db.commit()

    return {
        "album_id": album.id,
        "title": album.title
    }
