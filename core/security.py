from passlib.context import CryptContext

# bcrypt 알고리즘을 사용해서 비번을 암호화하겠다는 설정
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)