import time
from collections import defaultdict
from typing import Dict, Tuple
from . import settings

# Simple per-user token bucket (in-memory)
_buckets: Dict[str, Tuple[float, float]] = defaultdict(lambda: (settings.RATE_LIMIT_MAX, time.time()))

def acquire(uid: str, cost: int = 1) -> None:
    tokens, last = _buckets[uid]
    now = time.time()
    refill = (now - last) * (settings.RATE_LIMIT_MAX / settings.RATE_LIMIT_WINDOW_SEC)
    tokens = min(settings.RATE_LIMIT_MAX, tokens + refill)
    if tokens < cost:
        wait = (cost - tokens) / (settings.RATE_LIMIT_MAX / settings.RATE_LIMIT_WINDOW_SEC)
        time.sleep(max(0.0, wait))
        now = time.time()
        refill = (now - last) * (settings.RATE_LIMIT_MAX / settings.RATE_LIMIT_WINDOW_SEC)
        tokens = min(settings.RATE_LIMIT_MAX, tokens + refill)
    _buckets[uid] = (tokens - cost, now)