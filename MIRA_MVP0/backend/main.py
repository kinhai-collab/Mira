from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from auth import router as auth_router 

app = FastAPI()

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(auth_router)

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
