# backend/rate_limit.py
import time
from collections import deque
from typing import Deque, Dict, Tuple

class PerUserSlidingWindowLimiter:
    """
    Enforces N requests per WINDOW seconds, per user key.
    Sliding-window with timestamp deque. O(1) amortized per request.
    """
    def __init__(self, limit: int, window_seconds: int):
        self.limit = limit
        self.window = window_seconds
        self._buckets: Dict[str, Deque[float]] = {}

    def allow(self, user_key: str) -> Tuple[bool, float]:
        """
        Returns (allowed, retry_after_seconds).
        If not allowed, retry_after_seconds indicates how long to wait.
        """
        now = time.monotonic()
        dq = self._buckets.setdefault(user_key, deque())

        # Drop timestamps older than window
        cutoff = now - self.window
        while dq and dq[0] <= cutoff:
            dq.popleft()

        if len(dq) < self.limit:
            dq.append(now)
            return True, 0.0

        # not allowed; compute when the oldest within window expires
        oldest = dq[0]
        retry_after = max(0.0, oldest + self.window - now)
        return False, retry_after