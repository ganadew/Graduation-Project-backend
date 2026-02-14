import os
import shutil
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

# database.py에서 DB 세션 관리 함수를 가져옵니다
from database import get_db 
import models

router = APIRouter(prefix="/media", tags=["media"])

# 파일이 저장될 경로 설정
UPLOAD_DIR = "./static/uploads"

# 서버 실행 시 업로드 폴더가 없으면 자동으로 생성
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload")
async def upload_media(
    album_id: int = Form(...),
    uploader_id: int = Form(...),
    description: str = Form(None),
    # [중요] List[UploadFile]을 사용해야 여러 장을 한 번에 받습니다.
    files: List[UploadFile] = File(...), 
    db: Session = Depends(get_db)
):
    saved_media_info = []

    try:
        for file in files:
            # 1. 파일 시스템에 파일 저장
            # 한글 파일명 에러 방지를 위해 간단한 처리나 경로 확인이 필요할 수 있습니다.
            file_path = os.path.join(UPLOAD_DIR, file.filename)
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            # 2. DB 객체 생성
            new_media = models.Media(
                # 이미지인지 비디오인지 구분
                type="img" if file.content_type and "image" in file.content_type else "video",
                s3_url=f"/static/uploads/{file.filename}",
                description=description,
                album_id=album_id,
                uploader_id=uploader_id
            )

            # 3. DB에 추가
            db.add(new_media)
            # flush를 해줘야 commit 전에도 각 데이터의 ID(PK)가 생성됩니다.
            db.flush() 
            
            saved_media_info.append({
                "id": new_media.ID,
                "path": new_media.s3_url,
                "filename": file.filename
            })

        # 모든 파일 처리가 성공하면 한꺼번에 DB에 확정 저장!
        db.commit()

    except Exception as e:
        # 하나라도 실패하면 작업 전 상태로 되돌림
        db.rollback()
        raise HTTPException(status_code=500, detail=f"DB 저장 실패: {str(e)}")

    return {
        "message": f"{len(saved_media_info)}개의 파일 및 DB 저장 완료!",
        "results": saved_media_info
    }