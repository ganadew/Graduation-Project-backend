import models
from database import engine
from fastapi import FastAPI
from controller import medications, notifications

models.Base.metadata.create_all(bind=engine)
app = FastAPI()

app.include_router(medications.router)
app.include_router(notifications.router)


@app.get("/")
def read_root():
    return {"Hello": "World"}
