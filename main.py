import models
from database import engine
from fastapi import FastAPI
from controller import items,users,media
from typing import Union


app = FastAPI()

app.include_router(items.router)
app.include_router(users.router)
app.include_router(media.router)

@app.get("/")
def read_root():
    return{"Hello" : "World"}
