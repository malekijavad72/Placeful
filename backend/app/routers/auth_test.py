from fastapi import APIRouter, Depends

from app.dependencies import get_current_user
from app.models import User


router = APIRouter(
    prefix="/api/auth-test",
    tags=["Auth Test"]
)


@router.get("/me")
def get_me(
    current_user: User = Depends(get_current_user)
):

    return {
        "id": str(current_user.id),
        "username": current_user.username,
        "email": current_user.email
    }