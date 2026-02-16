import os
import shutil
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

# 씩씩이님의 프로젝트 구조에 맞춘 import
from database import get_db 
import models

router = APIRouter(prefix="/media", tags=["media"])

# 파일이 저장될 경로 설정
UPLOAD_DIR = "./static/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# --- 공유앨범 생성 API (ERD 기준 수정본) ---

from pydantic import BaseModel

class SharedAlbumCreate(BaseModel):
    title: str
    patient_id: int


@router.post("/shared-albums")
def create_shared_album(data: SharedAlbumCreate, db: Session = Depends(get_db)):

    # 1️⃣ 환자 존재 확인
    patient = db.query(models.User)\
        .filter(models.User.ID == data.patient_id)\
        .first()

    if not patient:
        raise HTTPException(status_code=404, detail="해당 환자를 찾을 수 없습니다.")

    # 2️⃣ 환자(role = 0) 인지 확인
    if patient.role != 0:
        raise HTTPException(status_code=400, detail="공유앨범은 환자 계정만 생성할 수 있습니다.")

    # 3️⃣ 앨범 생성 (created_at은 DB에서 자동 생성)
    new_album = models.Album(
        title=data.title,
        patient_id=data.patient_id
    )

    db.add(new_album)
    db.commit()
    db.refresh(new_album)

    return {
        "message": "공유앨범 생성 성공",
        "album_id": new_album.ID,
        "title": new_album.title,
        "patient_id": new_album.patient_id
    }


# --- 1. 앨범 목록 조회 (추가됨) ---
@router.get("/albums")
def get_album_list(patient_id: int, db: Session = Depends(get_db)):
    # 씩씩이님 모델(models.Album)을 사용하여 조회
    albums = db.query(models.Album)\
        .filter(models.Album.patient_id == patient_id)\
        .all()
    return albums

# --- 2. 앨범 삭제 (추가 및 씩씩이님 구조로 수정됨) ---
@router.delete("/albums/{album_id}")
def delete_album(album_id: int, db: Session = Depends(get_db)):
    # 1. 앨범 존재 확인 (models.Album.ID 확인!)
    album = db.query(models.Album).filter(models.Album.ID == album_id).first()

    if not album:
        raise HTTPException(status_code=404, detail="삭제할 앨범을 찾을 수 없습니다.")

    # 2. 해당 앨범에 속한 모든 미디어 파일 찾기
    medias = db.query(models.Media)\
        .filter(models.Media.album_id == album_id)\
        .all()

    # 3. 실제 서버 컴퓨터에 저장된 파일 삭제 후 DB 삭제
    for media in medias:
        # DB에 저장된 /static/uploads/... 경로를 실제 시스템 경로로 변환
        # s3_url이 '/static/uploads/test.jpg' 라면 '.'을 붙여 './static/uploads/test.jpg'로 찾음
        file_system_path = f".{media.s3_url}" 
        
        if os.path.exists(file_system_path):
            os.remove(file_system_path)
            
        db.delete(media)

    # 4. 앨범 데이터 삭제
    db.delete(album)
    db.commit()

    return {"message": "앨범과 포함된 모든 미디어가 씩씩하게 삭제되었습니다."}

# --- 3. 미디어 업로드 (기존 씩씩이님 코드 유지) ---
@router.post("/upload")
async def upload_media(
    album_id: int = Form(...),
    uploader_id: int = Form(...),
    description: str = Form(None),
    files: List[UploadFile] = File(...), 
    db: Session = Depends(get_db)
):
    saved_media_info = []

    try:
        for file in files:
            file_path = os.path.join(UPLOAD_DIR, file.filename)
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            new_media = models.Media(
                type=1 if file.content_type and "image" in file.content_type else 2, # 숫자로 관리 추천
                s3_url=f"/static/uploads/{file.filename}",
                description=description,
                album_id=album_id,
                uploader_id=uploader_id
            )

            db.add(new_media)
            db.flush() 
            
            saved_media_info.append({
                "id": new_media.ID,
                "path": new_media.s3_url,
                "filename": file.filename
            })

        db.commit()

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"DB 저장 실패: {str(e)}")

    return {
        "message": f"{len(saved_media_info)}개의 파일 및 DB 저장 완료!",
        "results": saved_media_info
    }