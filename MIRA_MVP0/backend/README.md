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
## Debug UI (memory-debug)

This project includes a developer debug page for exercising the memory system and autopilot. The debug UI is gated by an environment variable to avoid exposing it in production.

- To enable the debug UI set `MEMORY_DEBUG_ENABLED=true` in your environment (or in a local `.env`).
- When enabled, visit `http://127.0.0.1:8000/memory-debug` to access the page.
- The debug page includes a "Debug User ID" input so you can specify an explicit `user_id` for debug requests without bypassing normal auth flows.

Important: Do NOT enable `MEMORY_DEBUG_ENABLED` in production environments. It's intended for local development and safe testing only.

Example `.env` keys (see `.env.example`):

- OPENAI_API_KEY=...
- MEMORY_DEBUG_ENABLED=false