from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from auth import router as auth_router 
from greetings import router as greetings_router
from voice.voice_generation import router as voice_router
app = FastAPI()

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Include routes
app.include_router(auth_router)
app.include_router(greetings_router)
app.include_router(voice_router, prefix="/api")

# Simple HTML Page for manual testing

@app.get("/envcheck")
async def env_check():
    import os
    return {
        "ELEVENLABS_API_KEY": bool(os.getenv("ELEVENLABS_API_KEY")),
        "ELEVENLABS_VOICE_ID": os.getenv("ELEVENLABS_VOICE_ID")
    }
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
