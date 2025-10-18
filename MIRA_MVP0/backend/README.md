# Backend service

Quick start on Windows PowerShell:

1. Create venv (only once):

```powershell
py -3.10 -m venv .venv
```

2. Install dependencies into the venv:

```powershell
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

3. Run the server using the venv interpreter (important):

```powershell
.\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

Notes:
- If you run `uvicorn` without the venv’s Python, Windows may use the global Python (e.g., 3.13) where `python-multipart` isn’t installed, causing: "Form data requires python-multipart".
- The test form is available at http://127.0.0.1:8000/