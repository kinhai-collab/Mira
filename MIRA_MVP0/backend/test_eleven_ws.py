# test_eleven_ws.py
import asyncio, os
try:
    # Ensure .env is loaded when running the script locally
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

import websockets

async def try_connect(url, headers=None):
    try:
        # In websockets 10.0+, use additional_headers instead of extra_headers
        async with websockets.connect(url, additional_headers=headers) as ws:
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=5)
                print("Received:", msg)
            except asyncio.TimeoutError:
                print("No immediate message (connect ok).")
    except Exception as e:
        print("Connect failed:", repr(e))

async def test_basic_connection():
    print("Testing basic WebSocket connection...")
    try:
        async with websockets.connect("wss://echo.websocket.org") as ws:
            print("Basic WebSocket connection works")
    except Exception as e:
        print(f"Basic connection failed: {e}")

async def main():
    await test_basic_connection()
    
    key = os.getenv("ELEVENLABS_API_KEY")
    if not key:
        print("No ELEVENLABS_API_KEY in environment of this shell.")
        return
    
    key = key.strip()
    print(f"API Key found: length={len(key)}, preview={key[:10]}...{key[-4:] if len(key) > 14 else '***'}")
    
    model_id = os.getenv("ELEVENLABS_MODEL_ID", "scribe_v2_realtime")
    print(f"Using model_id: {model_id}")
    
    base = os.getenv("ELEVENLABS_REALTIME_URL", "wss://api.elevenlabs.io/v1/speech-to-text/realtime")
    
    print("\nTrying connect with xi-api-key header and model_id query parameter...")
    import urllib.parse
    encoded_model_id = urllib.parse.quote(model_id, safe='')
    headers = {
        "xi-api-key": key
    }
    await try_connect(f"{base}?model_id={encoded_model_id}", headers=headers)

if __name__ == '__main__':
    asyncio.run(main())