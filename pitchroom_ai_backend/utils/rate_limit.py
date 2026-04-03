from collections import defaultdict, deque
from time import time


class SlidingWindowRateLimiter:
    def __init__(self, limit: int, window_seconds: int) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self._events: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str) -> bool:
        now = time()
        events = self._events[key]
        cutoff = now - self.window_seconds

        while events and events[0] < cutoff:
            events.popleft()

        if len(events) >= self.limit:
            return False

        events.append(now)
        return True
