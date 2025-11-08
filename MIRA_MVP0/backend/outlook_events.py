from fastapi import APIRouter, Query, HTTPException
import requests, base64
from bs4 import BeautifulSoup
from icalendar import Calendar
from dateutil import parser
from typing import List, Optional, Tuple, Dict
from pydantic import BaseModel
from datetime import datetime, timezone, date


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

# Email flow additions (summary + read)
GRAPH_BASE = "https://graph.microsoft.com/v1.0"

class ReadRequest(BaseModel):
    message_id: Optional[str] = None
    sender: Optional[str] = None
    subject_hint: Optional[str] = None

def _today_bounds_iso() -> Tuple[str, str]:
    today = date.today()
    start = datetime(today.year, today.month, today.day, tzinfo=timezone.utc)
    end = datetime(today.year, today.month, today.day, 23, 59, 59, tzinfo=timezone.utc)
    # Graph likes Z-suffixed UTC
    return start.isoformat().replace('+00:00','Z'), end.isoformat().replace('+00:00','Z')

def _headers(token: str, search: bool = False) -> Dict[str,str]:
    h = {"Authorization": f"Bearer {token}"}
    if search:
        # required for $search queries
        h["ConsistencyLevel"] = "eventual"
    return h

def _short_email(m: dict) -> dict:
    sender = ((m.get("sender") or {}).get("emailAddress") or {})
    return {
        "id": m.get("id"),
        "from_name": sender.get("name") or sender.get("address") or "Unknown",
        "subject": m.get("subject") or "(no subject)",
        "received_at": m.get("receivedDateTime"),
        "is_read": m.get("isRead", False),
        "importance": m.get("importance", "normal"),
    }

@router.get("/outlook/email/summary")
def outlook_email_summary(access_token: str = Query(...)):
    """
    Matches the UI flow: returns a compact list and a voice summary.
    Edge case: no new emails today -> 'You have no new emails today, but X unread ones.'
    """
    # unread count
    ur = requests.get(
        f"{GRAPH_BASE}/me/mailFolders/inbox?$select=unreadItemCount",
        headers=_headers(access_token)
    )
    if ur.status_code >= 400:
        raise HTTPException(status_code=503, detail="I’m having trouble connecting to Outlook right now. Please try again later.")
    unread_count = ur.json().get("unreadItemCount", 0)

    # latest (for scrollable UI list)
    r = requests.get(
        f"{GRAPH_BASE}/me/mailFolders/inbox/messages"
        f"?$top=12&$select=id,subject,receivedDateTime,isRead,importance,sender"
        f"&$orderby=receivedDateTime desc",
        headers=_headers(access_token)
    )
    if r.status_code >= 400:
        raise HTTPException(status_code=503, detail="I’m having trouble connecting to Outlook right now. Please try again later.")
    latest = r.json().get("value", [])
    important = []
    for m in latest:
        if (not m.get("isRead")) or (m.get("importance") == "high"):
            important.append(_short_email(m))

    # today's new mail
    start, end = _today_bounds_iso()
    r2 = requests.get(
        f"{GRAPH_BASE}/me/mailFolders/inbox/messages"
        f"?$top=50&$select=id,subject,receivedDateTime,isRead,importance,sender"
        f"&$orderby=receivedDateTime desc"
        f"&$filter=receivedDateTime ge {start} and receivedDateTime le {end}",
        headers=_headers(access_token)
    )
    if r2.status_code >= 400:
        raise HTTPException(status_code=503, detail="I’m having trouble connecting to Outlook right now. Please try again later.")
    todays = r2.json().get("value", [])
    today_count = len(todays)

    # voice summary
    if today_count == 0:
        voice = f"You have no new emails today, but {unread_count} unread ones."
    else:
        exemplars = []
        for m in todays[:3]:
            s = ((m.get("sender") or {}).get("emailAddress") or {})
            exemplars.append(s.get("name") or s.get("address") or "someone")
        if len(exemplars) == 1:
            voice = f"You have one new email today — from {exemplars[0]}."
        elif len(exemplars) == 2:
            voice = f"You have two new emails — from {exemplars[0]} and {exemplars[1]}."
        else:
            voice = f"You have {today_count} new emails. For example: from {exemplars[0]}, {exemplars[1]}, and {exemplars[2]}."

    return {
        "important_emails": important[:12],    # UI tiles
        "today_count": today_count,
        "unread_count": unread_count,
        "voice_summary": voice,                # read this line aloud
        "list_for_ui": [_short_email(m) for m in latest],  # optional 'See more'
    }

@router.post("/outlook/email/read")
def outlook_email_read(req: ReadRequest, access_token: str = Query(...)):
    """
    Step 3 of the flow: 'Mira, read the one from <sender>.'
    Edge-cases implemented:
      - Multiple matches -> multiple_matches=True with top choices
      - 0 matches       -> 404
      - API/network     -> 503 with friendly copy
    """
    try:
        # Direct read by explicit ID
        if req.message_id:
            res = requests.get(
                f"{GRAPH_BASE}/me/messages/{req.message_id}"
                f"?$select=id,subject,receivedDateTime,from,body,bodyPreview",
                headers=_headers(access_token)
            )
            if res.status_code >= 400:
                raise HTTPException(status_code=503, detail="I’m having trouble connecting to Outlook right now. Please try again later.")
            msg = res.json()
            f = ((msg.get("from") or {}).get("emailAddress") or {})
            return {
                "subject": msg.get("subject") or "(no subject)",
                "from_name": f.get("name") or f.get("address") or "Unknown",
                "body_html": (msg.get("body") or {}).get("content","") or "",
                "body_text_preview": msg.get("bodyPreview","") or "",
                "multiple_matches": False
            }

        if not req.sender:
            raise HTTPException(status_code=400, detail="Provide message_id or sender")

        q = req.sender.replace('"','\\"')
        url = (
            f"{GRAPH_BASE}/me/messages"
            f"?$search=\"from:{q}\""
            f"&$select=id,subject,receivedDateTime,from,bodyPreview"
            f"&$orderby=receivedDateTime desc"
            f"&$top=15"
        )
        r = requests.get(url, headers=_headers(access_token, search=True))
        if r.status_code >= 400:
            raise HTTPException(status_code=503, detail="I’m having trouble connecting to Outlook right now. Please try again later.")
        matches = r.json().get("value", [])

        # Optional subject narrowing
        if req.subject_hint:
            hint = req.subject_hint.lower()
            matches = [m for m in matches if (m.get("subject") or "").lower().find(hint) >= 0]

        if len(matches) == 0:
            raise HTTPException(status_code=404, detail="No email found from that sender.")

        if len(matches) > 1:
            choices = [{
                "id": m["id"],
                "subject": m.get("subject") or "(no subject)",
                "received_at": m.get("receivedDateTime"),
                "preview": m.get("bodyPreview") or ""
            } for m in matches[:5]]
            return {
                "subject": "",
                "from_name": "",
                "body_html": "",
                "body_text_preview": "",
                "multiple_matches": True,
                "choices": choices
            }

        single = matches[0]
        res = requests.get(
            f"{GRAPH_BASE}/me/messages/{single['id']}"
            f"?$select=id,subject,receivedDateTime,from,body,bodyPreview",
            headers=_headers(access_token)
        )
        if res.status_code >= 400:
            raise HTTPException(status_code=503, detail="I’m having trouble connecting to Outlook right now. Please try again later.")
        msg = res.json()
        f = ((msg.get("from") or {}).get("emailAddress") or {})
        return {
            "subject": msg.get("subject") or "(no subject)",
            "from_name": f.get("name") or f.get("address") or "Unknown",
            "body_html": (msg.get("body") or {}).get("content","") or "",
            "body_text_preview": msg.get("bodyPreview","") or "",
            "multiple_matches": False
        }
    except HTTPException:
        raise
    except Exception:
        # Friendly error copy per your spec
        raise HTTPException(status_code=503, detail="I’m having trouble connecting to Outlook right now. Please try again later.")
