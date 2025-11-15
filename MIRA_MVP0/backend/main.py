from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from auth import router as auth_router 
from greetings import router as greetings_router
from tts_server import router as tts_router
from gmail_events import router as gmail_events
# DISABLED: Outlook integration temporarily disabled due to authentication issues
# from outlook_events import router as outlook_events
from voice.voice_generation import router as voice_router
from settings import router as settings
from gmail_reader import router as gmail_reader
from payments import router as stripe_router
from morning_brief_api import router as morning_brief_router
from temp import router as weather_router
from Google_Calendar_API import register_google_calendar
from dashboard_api import router as dashboard_router

app = FastAPI()

# Middleware
import os
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
allowed_origins = [
    "http://localhost:3000",
    FRONTEND_URL
]
# Remove duplicates
allowed_origins = list(set(allowed_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Include routes
app.include_router(auth_router)
app.include_router(greetings_router)
app.include_router(tts_router)
app.include_router(gmail_events)
app.include_router(voice_router, prefix="/api")
app.include_router(settings)
app.include_router(stripe_router, prefix="/api")
app.include_router(weather_router)
# Simple HTML Page for manual testing
register_google_calendar(app)
# DISABLED: Outlook integration temporarily disabled due to authentication issues
# app.include_router(outlook_events)
app.include_router(gmail_reader)
app.include_router(morning_brief_router)
app.include_router(dashboard_router)


@app.get("/envcheck")
async def env_check():
    import os
    return {
        "ELEVENLABS_API_KEY": bool(os.getenv("ELEVENLABS_API_KEY")),
        "ELEVENLABS_VOICE_ID": os.getenv("ELEVENLABS_VOICE_ID")
    }


@app.get("/payments-test", response_class=HTMLResponse)
async def payments_test_page():
    html = """
<!doctype html>
<html>
  <head>
    <meta charset=\"utf-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
    <title>MIRA Payments Test</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 720px; margin: 24px auto; padding: 0 12px; }
      h1 { font-size: 20px; }
      section { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0; }
      label { display: block; margin: 8px 0 4px; font-weight: 600; }
      input[type=text], input[type=url], select { width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; }
      button { margin-top: 12px; padding: 10px 14px; background: #111827; color: white; border: none; border-radius: 6px; cursor: pointer; }
      button.secondary { background: #374151; }
      .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      pre { background: #f9fafb; padding: 12px; border-radius: 6px; overflow: auto; }
    </style>
  </head>
  <body>
    <h1>MIRA Payments Test</h1>
    <div id=\"uidNotice\" style=\"background:#FEF2F2;color:#991B1B;border:1px solid #FECACA;padding:10px;border-radius:8px;margin:12px 0;display:none;\">UID is required. Enter your Supabase user id to use Portal, Status, or Cancel.</div>

    <section>
      <div class=\"row\">
        <div>
          <label style=\"font-size:14px\">UID (required, Supabase auth user id)</label>
          <input id=\"uid\" type=\"text\" placeholder=\"e.g. 8a1b2c3d-...\" style=\"font-weight:600\" />
        </div>
        <div>
          <label>Plan</label>
          <select id=\"plan_key\">
            <option value=\"advanced\">Advanced</option>
            <option value=\"premium\">Premium</option>
          </select>
        </div>
      </div>
      <div class=\"row\" style=\"margin-top:8px\">
        <div>
          <label>Email (for profile init)</label>
          <input id=\"email\" type=\"text\" placeholder=\"you@example.com\" />
        </div>
        <div></div>
      </div>
      <div class=\"row\" style=\"margin-top:8px\">
        <div>
          <label>Success URL</label>
          <input id=\"success_url\" type=\"url\" placeholder=\"success URL\" />
        </div>
        <div>
          <label>Cancel URL</label>
          <input id=\"cancel_url\" type=\"url\" placeholder=\"cancel URL\" />
        </div>
      </div>
      <div style=\"display:flex; gap:12px; flex-wrap:wrap;\">
        <button id=\"startCheckout\">Start Checkout (Subscription)</button>
        <button id=\"useThisPageUrls\" class=\"secondary\" type=\"button\">Use this page URLs</button>
      </div>
    </section>

    <section>
      <div class=\"row\">
        <div>
          <label>Return URL</label>
          <input id=\"return_url\" type=\"url\" placeholder=\"return URL\" />
        </div>
        <div></div>
      </div>
      <button id=\"openPortal\" class=\"secondary\">Open Billing Portal</button>
    </section>

    <section>
      <button id=\"getStatus\" class=\"secondary\">Get Subscription Status</button>
      <pre id=\"statusOut\"></pre>
    </section>

    <section>
      <label><input id=\"cancelAtPeriodEnd\" type=\"checkbox\" checked /> Cancel at period end</label>
      <div class=\"row\">
        <div>
          <label>Subscription ID (optional)</label>
          <input id=\"subscription_id\" type=\"text\" placeholder=\"sub_... (if known)\" />
        </div>
        <div></div>
      </div>
      <button id=\"cancelSub\" class=\"secondary\">Cancel Subscription</button>
      <pre id=\"cancelOut\"></pre>
    </section>

    <script>
      async function postJson(url, body) {
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      }

      (function initUrls() {
        const origin = window.location.origin;
        const here = origin + '/payments-test';
        const success = here + '?status=success';
        const cancel = here + '?status=cancel';
        const ret = here + '?status=portal-return';
        const successEl = document.getElementById('success_url');
        const cancelEl = document.getElementById('cancel_url');
        const returnEl = document.getElementById('return_url');
        if (successEl && !successEl.value) successEl.value = success;
        if (cancelEl && !cancelEl.value) cancelEl.value = cancel;
        if (returnEl && !returnEl.value) returnEl.value = ret;
      })();

      (function initUid() {
        try {
          const uidEl = document.getElementById('uid');
          const notice = document.getElementById('uidNotice');
          const params = new URLSearchParams(window.location.search);
          const urlUid = params.get('uid');
          const storedUid = localStorage.getItem('mira_uid') || '';
          const value = urlUid || storedUid || '';
          if (value) {
            uidEl.value = value;
            localStorage.setItem('mira_uid', value);
            if (notice) notice.style.display = 'none';
          } else {
            if (notice) notice.style.display = 'block';
          }
          uidEl.addEventListener('change', () => {
            const v = uidEl.value.trim();
            if (v) {
              localStorage.setItem('mira_uid', v);
              if (notice) notice.style.display = 'none';
            } else {
              if (notice) notice.style.display = 'block';
            }
          });
        } catch (_) {}
      })();

      document.getElementById('useThisPageUrls').onclick = () => {
        const origin = window.location.origin;
        const base = origin + '/payments-test';
        document.getElementById('success_url').value = base + '?status=success';
        document.getElementById('cancel_url').value = base + '?status=cancel';
        document.getElementById('return_url').value = base + '?status=portal-return';
      };

      

      document.getElementById('startCheckout').onclick = async () => {
        const uid = document.getElementById('uid').value.trim();
        const plan_key = document.getElementById('plan_key').value;
        const success_url = document.getElementById('success_url').value.trim();
        const cancel_url = document.getElementById('cancel_url').value.trim();
        try {
          const body = { uid, plan_key, success_url, cancel_url };
          const data = await postJson('/api/create-checkout-session', body);
          if (data.url) window.location.href = data.url; else alert('No url returned');
        } catch (e) {
          alert('Error: ' + e.message);
        }
      };

      document.getElementById('openPortal').onclick = async () => {
        const uid = document.getElementById('uid').value.trim();
        const return_url = document.getElementById('return_url').value.trim();
        if (!uid) { alert('Please enter UID'); return; }
        try {
          const data = await postJson('/api/create-portal-session', { uid, return_url });
          if (data.url) window.location.href = data.url; else alert('No url returned');
        } catch (e) {
          alert('Error: ' + e.message);
        }
      };

      document.getElementById('getStatus').onclick = async () => {
        const uid = document.getElementById('uid').value.trim();
        if (!uid) { alert('Please enter UID'); return; }
        try {
          const res = await fetch('/api/subscription-status?uid=' + encodeURIComponent(uid));
          const data = await res.json();
          document.getElementById('statusOut').textContent = JSON.stringify(data, null, 2);
        } catch (e) {
          document.getElementById('statusOut').textContent = 'Error: ' + e.message;
        }
      };

      document.getElementById('cancelSub').onclick = async () => {
        const uid = document.getElementById('uid').value.trim();
        const cancel_at_period_end = document.getElementById('cancelAtPeriodEnd').checked;
        const subscription_id = document.getElementById('subscription_id').value.trim();
        if (!uid && !subscription_id) { alert('Enter UID or Subscription ID'); return; }
        try {
          const data = await postJson('/api/cancel-subscription', { uid: uid || undefined, subscription_id: subscription_id || undefined, cancel_at_period_end });
          document.getElementById('cancelOut').textContent = JSON.stringify(data, null, 2);
        } catch (e) {
          document.getElementById('cancelOut').textContent = 'Error: ' + e.message;
        }
      };

      (function showStatusParam(){
        const params = new URLSearchParams(window.location.search);
        const s = params.get('status');
        if (s) {
          const el = document.getElementById('statusOut');
          if (el) el.textContent = JSON.stringify({ redirected_status: s }, null, 2);
        }
      })();
    </script>
  </body>
  </html>
"""
    return HTMLResponse(content=html)
