import os
import shutil
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db # DB 세션을 가져오는 함수
import models # 우리가 만든 테이블 모델

router = APIRouter(prefix="/media", tags=["media"])
UPLOAD_DIR = "./static/uploads"

@router.post("/upload")
async def upload_single_media(
    album_id: int = Form(...),
    uploader_id: int = Form(...),
    description: str = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db) # DB 연결 세션 주입
):
    # 1. 파일 시스템에 실제 파일 저장
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # 2. DB에 저장할 데이터 객체 생성
    # ERD의 's3_url' 자리에 실제 저장 경로를 넣습니다.
    new_media = models.Media(
        type="img" if "image" in file.content_type else "video",
        s3_url=f"/static/uploads/{file.filename}",
        description=description,
        album_id=album_id,
        uploader_id=uploader_id
    )

    # 3. DB에 진짜로 집어넣기 (Insert)
    try:
        db.add(new_media) # 데이터 추가
        db.commit()       # 확정 (저장)
        db.refresh(new_media) # 새로고침해서 ID 등 정보 가져오기
    except Exception as e:
        db.rollback() # 에러 나면 되돌리기
        raise HTTPException(status_code=500, detail=f"DB 저장 실패: {str(e)}")

    return {
        "message": "파일 및 DB 저장 완료!",
        "id": new_media.ID,
        "path": new_media.s3_url
    }