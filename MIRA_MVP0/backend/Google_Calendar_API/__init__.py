from fastapi import FastAPI
from .oauth_router import router as _oauth_router
from .api_router import router as _api_router

def register_google_calendar(app: FastAPI):
    """
    One-call registration that leaves the rest of your backend untouched.
    """
    app.include_router(_oauth_router)
    app.include_router(_api_router)