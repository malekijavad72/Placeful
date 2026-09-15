from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routers import experiences

from app.routers import auth

from app.routers import users

from app.routers import places
import os
app = FastAPI()


app.mount(
    "/uploads",
    StaticFiles(directory="uploads"),
    name="uploads"
)

# ============================================================
# CORS
# ============================================================



# Comma-separated list in env, e.g.
# CORS_ORIGINS=http://127.0.0.1:5500,http://localhost:5500,http://127.0.0.1:3000
_cors_origins = os.getenv(
    "CORS_ORIGINS",
    "http://127.0.0.1:5500,http://localhost:5500,http://127.0.0.1:3000,http://localhost:3000",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in _cors_origins.split(",")
        if origin.strip()
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {
        "message": "Places Project API is running"
    }


# ============================================================
# ROUTERS
# ============================================================

app.include_router(experiences.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(places.router)
