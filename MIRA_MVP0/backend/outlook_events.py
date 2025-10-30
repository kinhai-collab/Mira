from fastapi import APIRouter, Query, HTTPException
import requests, base64
from bs4 import BeautifulSoup
from icalendar import Calendar
from dateutil import parser

router = APIRouter()

# Parse ICS bytes into event dicts
def parse_ics(ics_bytes):
    cal = Calendar.from_ical(ics_bytes)
    return [{
        "organizer": str(c.get("ORGANIZER","")),
        "subject": str(c.get("SUMMARY","")),
        "start": str(c.get("DTSTART").dt),
        "end": str(c.get("DTEND").dt),
        "location": str(c.get("LOCATION","")),
        "description": " ".join([l.strip() for l in BeautifulSoup(str(c.get("DESCRIPTION","")), "html.parser").get_text().splitlines() if "Join" in l or "http" in l]),
        "source": "ics"
    } for c in cal.walk() if c.name=="VEVENT"]

# Remove duplicate events
def remove_duplicates(events):
    seen, unique = set(), []
    for e in events:
        key = (e.get("subject","").strip().lower(), e.get("start"), e.get("end"))
        if key not in seen: seen.add(key); unique.append(e)
    return unique

# Find event ID by subject and date
def find_event_id(token, subject, start_time):
    res = requests.get("https://graph.microsoft.com/v1.0/me/events?$orderby=start/dateTime desc&$top=20",
                       headers={"Authorization": f"Bearer {token}"})
    if res.status_code != 200: raise HTTPException(status_code=res.status_code, detail=res.text)
    
    start_dt = parser.parse(start_time).date()
    for e in res.json().get("value",[]):
        try: start_date = parser.parse(e.get("start",{}).get("dateTime","")).date()
        except: continue
        if e.get("subject","").strip().lower()==subject.strip().lower() and start_date==start_dt:
            return e.get("id")
    raise HTTPException(status_code=404, detail="Event not found")

# Fetch ICS events from email attachments
@router.get("/outlook/emails")
def fetch_mail_ics_events(access_token: str = Query(...), limit: int = 20):
    res = requests.get(f"https://graph.microsoft.com/v1.0/me/messages?$top={limit}&$orderby=receivedDateTime desc",
                       headers={"Authorization": f"Bearer {access_token}"})
    if res.status_code != 200: raise HTTPException(status_code=res.status_code, detail=res.text)

    events=[]
    for msg in res.json().get("value",[]):
        # Get attachments for each message
        att_res = requests.get(f"https://graph.microsoft.com/v1.0/me/messages/{msg['id']}/attachments",
                               headers={"Authorization": f"Bearer {access_token}"}).json().get("value",[])
        for a in att_res:
            if "text/calendar" in a.get("contentType","").lower() or a.get("name","").endswith(".ics"):
                # Decode or fetch attachment content
                ics = base64.b64decode(a["contentBytes"]) if "contentBytes" in a else requests.get(
                    f"https://graph.microsoft.com/v1.0/me/messages/{msg['id']}/attachments/{a.get('id')}/$value",
                    headers={"Authorization": f"Bearer {access_token}"}
                ).content
                events.extend(parse_ics(ics))
    return {"status": "success", "events": remove_duplicates(events)}


# Fetch Outlook calendar events
@router.get("/outlook/calendar")
def fetch_calendar_events(access_token: str = Query(...), limit: int = 20):
    res = requests.get(f"https://graph.microsoft.com/v1.0/me/events?$top={limit}&$orderby=start/dateTime desc",
                       headers={"Authorization": f"Bearer {access_token}"})
    if res.status_code != 200: raise HTTPException(status_code=res.status_code, detail=res.text)
    
    # Extract relevant fields
    events = [{
        "id": e["id"],
        "subject": e.get("subject",""),
        "organizer": e.get("organizer", {}).get("emailAddress", {}).get("name",""),
        "start": e.get("start", {}).get("dateTime",""),
        "end": e.get("end", {}).get("dateTime",""),
        "location": e.get("location", {}).get("displayName",""),
        "bodyPreview": e.get("bodyPreview",""),
        "source": "calendar"
    } for e in res.json().get("value",[])]
    return {"status": "success", "events": remove_duplicates(events)}


# RSVP to Outlook event
@router.post("/outlook/events/rsvp")
def rsvp_outlook_event(access_token: str = Query(...), subject: str = Query(...),
                       start_time: str = Query(...), response_status: str = Query("accept")):
    eid = find_event_id(access_token, subject, start_time)
    endpoints = {
        "accept": f"https://graph.microsoft.com/v1.0/me/events/{eid}/accept",
        "decline": f"https://graph.microsoft.com/v1.0/me/events/{eid}/decline",
        "tentative": f"https://graph.microsoft.com/v1.0/me/events/{eid}/tentativelyAccept"
    }
    url = endpoints.get(response_status.lower())
    if not url: raise HTTPException(status_code=400, detail="Invalid response_status")
    
    res = requests.post(url, headers={"Authorization": f"Bearer {access_token}"})
    if res.status_code not in [200,202,204]: raise HTTPException(status_code=res.status_code, detail=res.text)
    return {"status":"success","event_id":eid,"response_status":response_status,
            "message":f"RSVP '{response_status}' sent successfully for event '{subject}'"}
