from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
from database import get_db_connection

app = FastAPI(title="공유앨범 API")


# ============================================
# Pydantic 모델 (요청 데이터 구조 정의)
# ============================================

class UserCreate(BaseModel):
    email: str
    password: str
    role: str  # '환자' 또는 '보호자'
    
class AlbumCreate(BaseModel):
    title: str
    patient_id: int


# ============================================
# API 1: 사용자 생성
# ============================================
@app.post("/users")
def create_user(user: UserCreate):
    """
    사용자 생성 API
    - email: 이메일 (아이디)
    - password: 비밀번호
    - role: 환자 또는 보호자
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # 1. 이메일 중복 체크
        cursor.execute("SELECT ID FROM user WHERE email = %s", (user.email,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="이미 존재하는 이메일입니다")
        
        # 2. role 값 검증
        if user.role not in ['환자', '보호자']:
            raise HTTPException(status_code=400, detail="role은 '환자' 또는 '보호자'만 가능합니다")
        
        # 3. 사용자 DB에 저장
        query = """
        INSERT INTO user (email, password, role)
        VALUES (%s, %s, %s)
        """
        cursor.execute(query, (user.email, user.password, user.role))
        conn.commit()
        user_id = cursor.lastrowid
        
        return {
            "success": True,
            "message": "사용자 생성 성공",
            "data": {
                "user_id": user_id,
                "email": user.email,
                "role": user.role
            }
        }
    
    except HTTPException as he:
        raise he
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"서버 오류: {str(e)}")
    
    finally:
        cursor.close()
        conn.close()


# ============================================
# API 2: 공유앨범 생성
# ============================================
@app.post("/albums")
def create_album(album: AlbumCreate):
    """
    공유앨범 생성 API
    - title: 앨범 이름
    - patient_id: 환자 user ID
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # 1. 환자 존재 여부 확인
        cursor.execute("SELECT ID, role FROM user WHERE ID = %s", (album.patient_id,))
        user = cursor.fetchone()
        
        if not user:
            raise HTTPException(status_code=404, detail="해당 사용자를 찾을 수 없습니다")
        
        # 2. 환자인지 확인
        if user[1] != '환자':
            raise HTTPException(status_code=400, detail="앨범은 환자만 생성할 수 있습니다")
        
        # 3. 앨범 DB에 저장
        query = """
        INSERT INTO albums (title, patient_id)
        VALUES (%s, %s)
        """
        cursor.execute(query, (album.title, album.patient_id))
        conn.commit()
        album_id = cursor.lastrowid
        
        return {
            "success": True,
            "message": "공유앨범 생성 성공",
            "data": {
                "album_id": album_id,
                "title": album.title,
                "patient_id": album.patient_id
            }
        }
    
    except HTTPException as he:
        raise he
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"서버 오류: {str(e)}")
    
    finally:
        cursor.close()
        conn.close()


# ============================================
# 헬스체크 API (서버 상태 확인용)
# ============================================
@app.get("/")
def health_check():
    return {"status": "ok", "message": "공유앨범 API 서버 정상 작동 중"}


