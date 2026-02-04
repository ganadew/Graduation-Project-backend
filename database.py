import mysql.connector
from mysql.connector import pooling

# MySQL 연결 정보 (본인 환경에 맞게 수정)
db_config = {
    "host": "localhost",
    "user": "root",  # 본인 MySQL 사용자명
    "password": "bderewqacnht1@",  # 본인 MySQL 비밀번호
    "database": "media_upload_api"  # 본인 데이터베이스명
}

# 커넥션 풀 생성
connection_pool = pooling.MySQLConnectionPool(
    pool_name="mypool",
    pool_size=5,
    **db_config
)

def get_db_connection():
    """DB 커넥션 가져오기"""
    return connection_pool.get_connection()