from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import experiences

from app.routers import auth_test

from app.routers import auth

app = FastAPI()


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,

    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500"
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
app.include_router(auth_test.router)
app.include_router(auth.router)
