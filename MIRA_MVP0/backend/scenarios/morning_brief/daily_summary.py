# backend/scenarios/morning_brief/daily_summary.py
import requests
from datetime import datetime
import os

WEATHERAPI_KEY = os.getenv("WEATHERAPI_KEY")
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")


def get_weather_and_commute(user_id: str, events, lat=None, lon=None):

    """
    Returns (weather_summary, commute_summary).
    FR-1.5.1 – FR-1.5.9 compliant.
    """
    weather_summary = _get_weather_summary(lat=lat, lon=lon)
    commute_summary = _get_commute_summary(events)
    return weather_summary, commute_summary

# --------------------------------------------------------------------------- #
# Weather
# --------------------------------------------------------------------------- #

def _get_weather_summary(lat=None, lon=None):
    if lat is None or lon is None:
        lat, lon = 40.4406, -79.9959

    try:
        url = (
            f"https://api.open-meteo.com/v1/forecast?"
            f"latitude={lat}&longitude={lon}&current_weather=true&temperature_unit=celsius"
        )
        res = requests.get(url, timeout=5)
        data = res.json()

        temp_raw = data["current_weather"]["temperature"]
        temp = round(temp_raw)
        code = int(data["current_weather"]["weathercode"])

        # SAME mapping as dashboard
        def desc(code):
            if code == 0:
                return "Clear"
            if code in [1, 2, 3]:
                return "Partly cloudy"
            if code in [45, 48]:
                return "Fog"
            if code in [51, 53, 55]:
                return "Drizzle"
            if code in [61, 63, 65]:
                return "Rain"
            if code in [71, 73, 75]:
                return "Snow"
            if code in [80, 81, 82]:
                return "Showers"
            if code in [95, 96, 99]:
                return "Thunderstorm"
            return "Unknown"

        condition = desc(code)

        return f"It’s {temp}°C with {condition.lower()} right now."

    except Exception as e:
        print("Weather error:", e)
        return "Couldn’t fetch the weather right now."

# --------------------------------------------------------------------------- #
# Commute
# --------------------------------------------------------------------------- #

def _get_commute_summary(events: list):
    """
    Estimates commute time to first in-person event with a location.
    FR-1.5.4 – FR-1.5.9 compliant.
    """
    first_event = next((e for e in events if e.get("location")), None)
    if not first_event:
        return ""

    destination = first_event["location"]
    start_time = first_event["start_dt"].strftime("%I:%M %p").lstrip("0")

    if not GOOGLE_MAPS_API_KEY:
        return f"Your first meeting is at {destination} around {start_time}."

    try:
        # Example origin: user's home/office; can be dynamic later.
        origin = "Pittsburgh, PA"
        res = requests.get(
            "https://maps.googleapis.com/maps/api/distancematrix/json",
            params={"origins": origin, "destinations": destination, "key": GOOGLE_MAPS_API_KEY},
            timeout=5,
        )
        data = res.json()
        element = data["rows"][0]["elements"][0]
        duration_text = element["duration"]["text"]
        traffic_phrase = _get_traffic_phrase(element["duration"]["value"])
        return f"Your first meeting is at {destination}. With {traffic_phrase} traffic, that’s about {duration_text}."
    except Exception as e:
        print("Commute API error:", e)
        return f"Your first meeting is at {destination} around {start_time}."


def _get_traffic_phrase(duration_seconds):
    """Simple mapping to traffic conditions."""
    minutes = duration_seconds / 60
    if minutes < 20:
        return "light"
    elif minutes < 40:
        return "moderate"
    else:
        return "heavy"
