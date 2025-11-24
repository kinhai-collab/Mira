import os
import asyncio

from memory_autopilot import MemoryAutopilot, get_autopilot


def test_autopilot_disabled_by_default():
    # Ensure env var is not set
    os.environ.pop("MEMORY_AUTOPILOT_ENABLED", None)
    ap = get_autopilot()
    assert ap is not None
    # By default, the autopilot should be disabled
    assert ap.enabled is False


async def _run_disabled_check():
    ap = get_autopilot()
    res = await ap.run_autopilot_for_conversation(user_id="test", user_message="hi", assistant_response="hello")
    assert res is None


def test_autopilot_noop_when_disabled():
    asyncio.get_event_loop().run_until_complete(_run_disabled_check())
