from fastapi import FastAPI, Form, HTTPException, Header
from fastapi.responses import HTMLResponse, JSONResponse
import asyncpg
import os
from dotenv import load_dotenv
from passlib.context import CryptContext
from backend.utils.jwt_utils import create_access_token, verify_token

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Load environment variables
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
app = FastAPI()

# ---------- Database Connection ---------- #
async def get_db_connection():
    return await asyncpg.connect(DATABASE_URL)

# ---------- Signup Route ---------- #
@app.post("/signup")
async def sign_up(email: str = Form(...), name: str = Form(...), password: str = Form(...)):
    """
    Create a new user and return an id token
    """
    conn = await get_db_connection()
    try:
        existing = await conn.fetchrow("SELECT * FROM Mira_db WHERE LOWER(email)=LOWER($1);", email)
        if existing:
            raise HTTPException(status_code=400, detail={"status": "error", "message": "Email already registered."})

        password_hash = pwd_context.hash(password[:72])

        await conn.execute("""
            INSERT INTO Mira_db (email, name, password_hash, provider, email_verified, is_active)
            VALUES ($1, $2, $3, 'local', FALSE, TRUE);
        """, email, name, password_hash)

        # Fetch the new user's ID
        new_user = await conn.fetchrow("SELECT id FROM Mira_db WHERE email=$1;", email)
        id_token = create_access_token(data={"user_id": str(new_user["id"]), "email": email})

        return JSONResponse(content={"status": "success", "message": "User created successfully.", "id_token": id_token})
    except Exception as e:
        print("Signup Error:", e)
        raise HTTPException(status_code=500, detail={"status": "error", "message": "Failed to create user."})
    finally:
        await conn.close()

# ---------- Signin Route ---------- #
@app.post("/signin")
async def sign_in(email: str = Form(...), password: str = Form(...)):
    """
    Sign in existing user and return an id token
    """
    conn = await get_db_connection()
    try:
        user = await conn.fetchrow("SELECT * FROM Mira_db WHERE LOWER(email)=LOWER($1);", email)
        if not user or not pwd_context.verify(password, user["password_hash"]):
            raise HTTPException(status_code=400, detail={"status": "error", "message": "Incorrect email or password."})

        # Update last login time
        await conn.execute("UPDATE Mira_db SET last_login_at = NOW() WHERE id = $1;", user["id"])

        id_token = create_access_token(data={"user_id": str(user["id"]), "email": email})

        return JSONResponse(content={"status": "success", "message": "Sign in successful.", "id_token": id_token})
    except Exception as e:
        print("Signin Error:", e)
        raise HTTPException(status_code=500, detail={"status": "error", "message": "Error during sign-in."})
    finally:
        await conn.close()

# ---------- Refresh Token Route ---------- #
@app.post("/refresh-token")
async def refresh_token(Authorization: str = Header(...)):
    """
    Refresh id token using existing valid token
    """
    token = Authorization.replace("Bearer ", "")
    try:
        payload = verify_token(token)
        # Remove old expiry and create new token
        new_id_token = create_access_token(data={"user_id": payload["user_id"], "email": payload["email"]})
        return {"status": "success", "id_token": new_id_token}
    except Exception as e:
        raise HTTPException(status_code=401, detail={"status": "error", "message": str(e)})

# ---------- Simple HTML Page for Testing ---------- #
@app.get("/", response_class=HTMLResponse)
async def root():
    html = """
    <html>
        <head><title>Postgres Auth</title></head>
        <body style="font-family:sans-serif;">
            <h2>Sign up / Sign in Test</h2>

            <form action="/signup" method="post">
                <h3>Sign Up</h3>
                <input name="email" type="email" placeholder="Email" required><br>
                <input name="name" type="text" placeholder="Name" required><br>
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
