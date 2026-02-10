from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import os

from database import get_db
from models import Album, Media

router = APIRouter(
    prefix="/albums",
    tags=["albums"]
)

# 앨범 목록 조회
@router.get("")
def get_album_list(patient_id: int, db: Session = Depends(get_db)):
    albums = db.query(Album)\
        .filter(Album.patient_id == patient_id)\
        .all()
    return albums


# 앨범 삭제 (앨범 + 미디어 + 실제 파일 삭제)
@router.delete("/{album_id}")
def delete_album(album_id: int, db: Session = Depends(get_db)):
    album = db.query(Album).filter(Album.id == album_id).first()

    if not album:
        raise HTTPException(status_code=404, detail="Album not found")

    medias = db.query(Media)\
        .filter(Media.album_id == album_id)\
        .all()

    for media in medias:
        if media.s3_url and os.path.isfile(media.s3_url):
            os.remove(media.s3_url)
        db.delete(media)

    db.delete(album)
    db.commit()

    return {"message": "Album deleted successfully"}
