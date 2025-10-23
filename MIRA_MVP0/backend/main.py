from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from auth import router as auth_router 
from greetings import router as greetings_router
from google_calendar import router as google_oauth_router
from google_calendar_sync import sync_router
from google_calendar_webhook import router as calendar_webhook_router
app = FastAPI()

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(auth_router)
app.include_router(greetings_router)
app.include_router(google_oauth_router)
app.include_router(sync_router)
app.include_router(calendar_webhook_router)
# Simple HTML Page for manual testing
@app.get("/", response_class=HTMLResponse)
async def root():
    html = """
    <html>
        <head><title>Supabase Auth</title></head>
        <body style="font-family:sans-serif;">
            <h2>Sign up / Sign in Test</h2>
            <form action="/signup" method="post">
                <h3>Sign Up</h3>
                <input name="email" type="email" placeholder="Email" required><br>
                <input name="password" type="password" placeholder="Password" required><br>
                <button type="submit">Sign Up</button>
            </form>
            <br>
            <form action="/signin" method="post">
                <h3>Sign In</h3>
                <input name="email" type="email" placeholder="Email" required><br>
                <input name="password" type="password" placeholder="Password" required><br>
                <button type="submit">Sign In</button>
            </form>
        </body>
    </html>
    """
    return HTMLResponse(content=html)
