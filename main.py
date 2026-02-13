import models
from database import engine
from fastapi import FastAPI
from controller import media, albums, medications

models.Base.metadata.create_all(bind=engine)
app = FastAPI()

app.include_router(media.router)
app.include_router(albums.router)
app.include_router(medications.router)


@app.get("/")
def read_root():
    return {"Hello": "World"}
