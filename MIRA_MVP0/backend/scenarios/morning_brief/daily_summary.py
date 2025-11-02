# backend/scenarios/morning_brief/daily_summary.py
import requests
from datetime import datetime
import os

OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")


def get_weather_and_commute(user_id: str, events: list):
    """
    Returns (weather_summary, commute_summary).
    FR-1.5.1 – FR-1.5.9 compliant.
    """
    weather_summary = _get_weather_summary()
    commute_summary = _get_commute_summary(events)
    return weather_summary, commute_summary


# --------------------------------------------------------------------------- #
# Weather
# --------------------------------------------------------------------------- #

def _get_weather_summary():
    """Fetches current and daily forecast using OpenWeatherMap API."""
    # Placeholder coordinates; replace with device location later.
    lat, lon = 40.4406, -79.9959  # Pittsburgh

    if not OPENWEATHER_API_KEY:
        return "Weather data unavailable right now."

    try:
        res = requests.get(
            f"https://api.openweathermap.org/data/2.5/forecast",
            params={"lat": lat, "lon": lon, "appid": OPENWEATHER_API_KEY, "units": "imperial"},
            timeout=5,
        )
        data = res.json()

        current = data["list"][0]
        temp = round(current["main"]["temp"])
        weather = current["weather"][0]["description"].capitalize()
        high = round(max(item["main"]["temp_max"] for item in data["list"][:8]))
        low = round(min(item["main"]["temp_min"] for item in data["list"][:8]))

        # Generate conversational output
        summary = f"It’s {temp}° and {weather.lower()}. The high today is {high} and the low is {low}."
        if "rain" in weather.lower():
            summary += " Don’t forget your umbrella!"
        elif "snow" in weather.lower():
            summary += " Dress warm — snow expected."
        return summary

    except Exception as e:
        print("Weather API error:", e)
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
