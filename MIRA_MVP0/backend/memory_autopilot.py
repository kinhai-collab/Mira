import os
import json
import asyncio
from datetime import datetime
from typing import List, Dict, Any, Optional
from openai import OpenAI

from memory_service import get_memory_service


class MemoryAutopilot:
    """Manual autopilot decisioner for memory maintenance.

    This lightweight module uses the configured OpenAI model to decide whether
    to keep, merge, delete, or summarize candidate memories after a new
    conversation. It's intentionally conservative: it returns structured
    decisions and writes an audit entry. The autopilot is opt-in via
    the MEMORY_AUTOPILOT_ENABLED env var (default: false).
    """

    def __init__(self):
        # Default: enable autopilot by default (run after every message)
        self.enabled = True
        self.openai_key = os.getenv("OPENAI_API_KEY")
        self.model = os.getenv("MEMORY_AUTOPILOT_MODEL", "gpt-4o-mini")
        self.memory_service = get_memory_service()
        # Audit log file (append-only JSONL)
        audit_dir = os.path.join(os.getcwd(), "data", "autopilot")
        try:
            os.makedirs(audit_dir, exist_ok=True)
        except Exception:
            audit_dir = os.path.join(os.getcwd(), "data")
        self.audit_path = os.path.join(audit_dir, "autopilot_audit.jsonl")

    async def run_autopilot_for_conversation(self, user_id: str, user_message: str, assistant_response: str) -> Optional[Dict[str, Any]]:
        """Run decisioner for a single conversation turn.

        Returns parsed decision dict or None on error / disabled.
        """
        if not self.enabled:
            return None

        if not self.openai_key:
            # No key configured; can't run autopilot
            return None

        # Fetch candidate similar facts
        try:
            candidates = self.memory_service.retrieve_relevant_memories(user_id=user_id, query=user_message, limit=6, memory_type="fact")
        except Exception:
            candidates = []

        # Build the decision prompt
        system_prompt = (
            "You are a cautious assistant that manages a user's long-term memory. "
            "Given a new conversation turn and a list of candidate prior memories, "
            "decide whether to store the new information permanently, merge it with an existing memory, "
            "delete outdated duplicates, or ignore it. Return ONLY JSON matching the schema described.")

        schema = {
            "decisions": [
                {
                    "id": "<existing_memory_id_or_new>",
                    "action": "keep|merge|delete|ignore|create_fact",
                    "reason": "short explanation",
                    "merge_with": "<memory_id_if_action_is_merge_or_null>",
                    "summary": "optional short summary for stored/merged memory",
                }
            ]
        }

        # Prepare user content
        payload = {
            "new_conversation": {
                "user_message": user_message,
                "assistant_response": assistant_response
            },
            "candidates": [
                {"id": c.get("metadata", {}).get("user_id", "") + "_" + str(i), "content": c.get("content", ""), "metadata": c.get("metadata", {})}
                for i, c in enumerate(candidates)
            ],
            "instructions": "Return a JSON object following the schema in the system message. Be conservative: prefer ignore unless there's clear durable info."
        }

        # Call OpenAI (use sync IO inside executor to avoid blocking)
        try:
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(None, self._call_openai_chat, system_prompt, json.dumps(payload))
            parsed = self._parse_json_from_text(result)
        except Exception as e:
            parsed = None
            self._write_audit(user_id, user_message, assistant_response, candidates, None, str(e))
            return None

        # Apply decisions conservatively (only actions we support)
        try:
            if parsed and isinstance(parsed.get("decisions"), list):
                await loop.run_in_executor(None, self._apply_decisions, user_id, parsed.get("decisions"))
        except Exception as e:
            # Still write audit and continue
            self._write_audit(user_id, user_message, assistant_response, candidates, parsed, str(e))
            return parsed

        # Audit and return
        self._write_audit(user_id, user_message, assistant_response, candidates, parsed, None)
        return parsed

    def _call_openai_chat(self, system_prompt: str, user_content: str) -> str:
        oa = OpenAI(api_key=self.openai_key)
        # Keep prompt short; pass payload as single user message
        comp = oa.chat.completions.create(
            model=self.model,
            messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_content}],
            temperature=0.0,
            max_tokens=500,
        )
        return (comp.choices[0].message.content or "").strip()

    def _parse_json_from_text(self, text: str) -> Optional[Dict[str, Any]]:
        # Try to find the first JSON object in the text
        text = text.strip()
        try:
            # Direct parse first
            return json.loads(text)
        except Exception:
            # Fallback: attempt to extract substring between first { and last }
            try:
                start = text.find("{")
                end = text.rfind("}")
                if start != -1 and end != -1 and end > start:
                    return json.loads(text[start:end+1])
            except Exception:
                return None
        return None

    def _apply_decisions(self, user_id: str, decisions: List[Dict[str, Any]]):
        """Apply a list of decision dicts to the MemoryService synchronously.
        Actions supported: create_fact (store fact), merge (merge into existing fact or create new fact), delete (delete existing memory), keep (store as fact), ignore (no-op).
        """
        for d in decisions:
            action = d.get("action")
            mid = d.get("id")
            summary = d.get("summary")
            merge_with = d.get("merge_with")
            if action == "delete" and mid:
                try:
                    # Only delete facts per facts-only policy
                    self.memory_service.delete_memory(memory_id=mid, memory_type="fact")
                except Exception:
                    pass
            elif action in ("create_fact", "keep"):
                # create_fact or keep -> store a fact (we do not persist full conversations)
                fact_text = summary or d.get("reason") or ""
                if fact_text:
                    try:
                        # prefer upsert to dedupe
                        self.memory_service.upsert_fact_memory(user_id=user_id, fact=fact_text, category="autopilot", importance=2)
                    except Exception:
                        try:
                            self.memory_service.store_fact_memory(user_id=user_id, fact=fact_text, category="autopilot", importance=1)
                        except Exception:
                            pass
            elif action == "merge" and merge_with:
                # Merge: delete the identified old memory and store merged summary as a fact
                try:
                    # delete any existing fact memory with id mid (if provided)
                    if mid:
                        self.memory_service.delete_memory(memory_id=mid, memory_type="fact")
                except Exception:
                    pass
                if summary:
                    try:
                        self.memory_service.upsert_fact_memory(user_id=user_id, fact=summary, category="autopilot", importance=3)
                    except Exception:
                        try:
                            self.memory_service.store_fact_memory(user_id=user_id, fact=summary, category="autopilot", importance=2)
                        except Exception:
                            pass
            # ignore -> nothing

    def _write_audit(self, user_id: str, user_message: str, assistant_response: str, candidates: List[Dict[str, Any]], parsed: Optional[Dict[str, Any]], error: Optional[str]):
        entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
            "user_message": user_message,
            "assistant_response": assistant_response,
            "candidates": [{"content": c.get("content"), "metadata": c.get("metadata")} for c in candidates],
            "decision": parsed,
            "error": error
        }
        try:
            with open(self.audit_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        except Exception:
            # best-effort logging only
            pass


_autopilot_instance: Optional[MemoryAutopilot] = None


def get_autopilot() -> MemoryAutopilot:
    global _autopilot_instance
    if _autopilot_instance is None:
        _autopilot_instance = MemoryAutopilot()
    return _autopilot_instance


def run_autopilot_debug(user_id: str, user_message: str, assistant_response: str) -> Optional[Dict[str, Any]]:
    """Run autopilot logic synchronously for debugging, bypassing the enabled flag.

    This is intended for dev/test endpoints only.
    """
    ap = MemoryAutopilot()
    # Force execution even if ap.enabled is False
    try:
        # Use run_autopilot_for_conversation but execute synchronously via event loop
        loop = asyncio.get_event_loop()
        return loop.run_until_complete(ap.run_autopilot_for_conversation(user_id=user_id, user_message=user_message, assistant_response=assistant_response))
    except RuntimeError:
        # No running loop; create a new one
        new_loop = asyncio.new_event_loop()
        try:
            return new_loop.run_until_complete(ap.run_autopilot_for_conversation(user_id=user_id, user_message=user_message, assistant_response=assistant_response))
        finally:
            try:
                new_loop.close()
            except Exception:
                pass
