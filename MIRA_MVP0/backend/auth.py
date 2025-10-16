from fastapi import FastAPI, Form, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
import firebase_admin
from firebase_admin import credentials, auth
import requests
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Firebase using service account credentials
FIREBASE_KEY_PATH = os.getenv("FIREBASE_KEY_PATH")
FIREBASE_API_KEY = os.getenv("FIREBASE_API_KEY")
print(FIREBASE_KEY_PATH)

# Initialize Firebase app only once
if not firebase_admin._apps:
    cred = credentials.Certificate(FIREBASE_KEY_PATH)
    firebase_admin.initialize_app(cred)

app = FastAPI()

# User Signup 
@app.post("/signup")
async def sign_up(email: str = Form(...), password: str = Form(...)):
    """
    Create a new user in Firebase Authentication using email and password.
    """
    try:
        user = auth.create_user(email=email, password=password)
        return JSONResponse(content={
            "status": "success",
            "message": "User created successfully.",
            "uid": user.uid
        })
    except Exception as e:
        error_msg = str(e).lower()

        # Handle specific Firebase errors
        if "email already exists" in error_msg:
            detail = "This email is already registered."
        elif "invalid password" in error_msg:
            detail = "Password must be at least 6 characters."
        elif "invalid email" in error_msg:
            detail = "Invalid email format."
        else:
            detail = "Failed to create user. Please check your input and try again."

        # Return error response with proper HTTP status code
        raise HTTPException(status_code=400, detail={"status": "error", "message": detail})


# User Sign-in 
@app.post("/signin")
async def sign_in(email: str = Form(...), password: str = Form(...)):
    """
    Sign in an existing user using Firebase Authentication REST API.
    """
    # Check if Firebase API key is available
    if not FIREBASE_API_KEY:
        raise HTTPException(status_code=500, detail={"status": "error", "message": "Firebase API key not found."})

    # Firebase REST API endpoint for sign-in
    url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
    payload = {"email": email, "password": password, "returnSecureToken": True}

    try:
        res = requests.post(url, json=payload)
        data = res.json()

        # Successful sign-in
        if res.status_code == 200:
            return JSONResponse(content={
                "status": "success",
                "message": "Sign in successful.",
                "idToken": data.get("idToken"),
                "email": data.get("email")
            })
        else:
            # Handle Firebase authentication errors
            firebase_error = data.get("error", {}).get("message", "")
            if firebase_error == "EMAIL_NOT_FOUND":
                detail = "This email is not registered."
            elif firebase_error == "INVALID_PASSWORD":
                detail = "Incorrect password. Please try again."
            elif firebase_error == "USER_DISABLED":
                detail = "This user account has been disabled."
            else:
                detail = "Sign in failed. Please check your credentials."

            # Raise HTTP error with the appropriate message
            raise HTTPException(status_code=res.status_code, detail={"status": "error", "message": detail})

    except Exception as e:
        # Catch any unexpected errors
        raise HTTPException(status_code=500, detail={"status": "error", "message": f"Error during sign-in: {e}"})


# Simple HTML Page for Manual Testing
@app.get("/", response_class=HTMLResponse)
async def root():
    """
    A simple HTML form to manually test signup and signin routes.
    """
    html = """
    <html>
        <head><title>Firebase Auth</title></head>
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
