
import asyncio
from typing import Callable, Any, Dict, Optional
import httpx

async def with_backoff_request(
    request_fn: Callable[[], Any],
    *,
    max_attempts: int = 5,
    base_delay: float = 0.5,  # seconds
    max_delay: float = 8.0
) -> httpx.Response:
    """
    Generic retry wrapper for httpx requests.
    Retries on 429 and 'rateLimitExceeded' 403s, honoring Retry-After.
    """
    attempt = 0
    delay = base_delay

    while True:
        attempt += 1
        try:
            resp = await request_fn()
        except httpx.RequestError as e:
            # network flake: retry with backoff
            if attempt >= max_attempts:
                raise
            await asyncio.sleep(delay)
            delay = min(max_delay, delay * 2)
            continue

        # Happy path
        if resp.status_code < 400:
            return resp

        # Check Retry-After
        if resp.status_code in (429, 503):
            ra = resp.headers.get("Retry-After")
            if ra:
                try:
                    await asyncio.sleep(float(ra))
                except ValueError:
                    await asyncio.sleep(delay)
                    delay = min(max_delay, delay * 2)
            else:
                await asyncio.sleep(delay)
                delay = min(max_delay, delay * 2)

            if attempt < max_attempts:
                continue
            return resp

        # Google sometimes returns 403 with 'rateLimitExceeded'
        if resp.status_code == 403:
            try:
                j = resp.json()
                errs = j.get("error", {}).get("errors", [])
                if any(e.get("reason") == "rateLimitExceeded" for e in errs):
                    if attempt >= max_attempts:
                        return resp
                    await asyncio.sleep(delay)
                    delay = min(max_delay, delay * 2)
                    continue
            except Exception:
                pass

        # Other errors: give up
        return resp