from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel
import os
import requests
from datetime import datetime

router = APIRouter()


class WeatherRequest(BaseModel):
    lat: float
    lon: float


class WeatherResponse(BaseModel):
    temperatureC: float
    unit: str
    provider: str
    latitude: float
    longitude: float
    retrieved_at: str


def _fetch_weather(lat: float, lon: float) -> dict:
    """Internal: call WeatherAPI and return normalized dict or raise HTTPException."""
    api_key = os.getenv("WEATHERAPI_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="WEATHERAPI_KEY not configured")

    query = f"{lat},{lon}"
    url = "http://api.weatherapi.com/v1/current.json"
    params = {"key": api_key, "q": query}

    try:
        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Error calling weather provider: {e}")

    temp_c = data.get("current", {}).get("temp_c") if isinstance(data, dict) else None
    if temp_c is None:
        raise HTTPException(status_code=502, detail="Unexpected response from weather provider")

    return {
        "temperatureC": float(temp_c),
        "unit": "C",
        "provider": "weatherapi.com",
        "latitude": float(lat),
        "longitude": float(lon),
        "retrieved_at": datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
    }


@router.post("/weather", response_model=WeatherResponse)
def post_weather(payload: WeatherRequest, authorization: str | None = Header(default=None)):
    """POST /weather - accepts JSON body with lat/lon."""
    return _fetch_weather(payload.lat, payload.lon)


@router.get("/weather", response_model=WeatherResponse)
def get_weather(lat: float = Query(...), lon: float = Query(...), authorization: str | None = Header(default=None)):
    """GET /weather?lat=...&lon=... - accepts query params for convenience."""
    return _fetch_weather(lat, lon)
