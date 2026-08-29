from fastapi import HTTPException


def bad_request(message: str):

    return HTTPException(
        status_code=400,
        detail=message
    )


def internal_server_error():

    return HTTPException(
        status_code=500,
        detail="Internal server error"
    )