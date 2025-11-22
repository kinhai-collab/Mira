import os
import json
from typing import Dict, Any
from openai import OpenAI


class MemoryExtractor:
    """Decide whether a user message should be stored as memory and classify its type.

    Strategy:
    - Fast heuristics first (questions, short queries, keywords, personal pronouns).
    - If heuristics are uncertain, call the LLM classifier as a fallback.

    Returns a dict: { save: bool, relevance: int(0-5), preference: bool, stable: bool, reason: str }
    """

    def __init__(self, openai_key: str = None, model: str = "gpt-4o-mini"):
        self.openai_key = openai_key or os.getenv("OPENAI_API_KEY")
        self.model = model

    def _heuristic(self, text: str) -> Dict[str, Any]:
        t = text.strip()
        lower = t.lower()

        # If it's a question, usually not a memory (user asking info)
        if t.endswith("?"):
            return {"save": False, "relevance": 0, "preference": False, "stable": False, "reason": "Question detected"}


        # Personal preference signals and short identity statements should be
        # considered even if short (e.g., "I like pizza", "I'm a programmer").
        prefs = ["prefer", "i like", "i love", "my favorite", "i don't like", "i hate", "i prefer"]
        for p in prefs:
            if p in lower:
                return {"save": True, "relevance": 4, "preference": True, "stable": False, "reason": f"Preference marker '{p}'"}

        # Short first-person identity patterns such as "I'm a X" or "I am a X"
        # should also be considered salient facts.
        try:
            import re
            if re.search(r"\bI('?|’)?m (a|an) \w+", t, flags=re.IGNORECASE) or re.search(r"\bI am (a|an) \w+", t, flags=re.IGNORECASE):
                return {"save": True, "relevance": 4, "preference": False, "stable": True, "reason": "Identity statement"}
        except Exception:
            pass

        # Very short statements (<=3 words) are unlikely to be stable facts
        if len(t.split()) <= 3:
            return {"save": False, "relevance": 0, "preference": False, "stable": False, "reason": "Too short"}

        # First-person possession hints
        if "my " in lower or "i " in lower:
            # If it's a statement of fact e.g., 'I was born in 1990' we may save
            if any(tok.isdigit() for tok in lower.split()):
                return {"save": True, "relevance": 3, "preference": False, "stable": True, "reason": "Personal factual claim"}
            # Otherwise uncertain
            return {"save": False, "relevance": 1, "preference": False, "stable": False, "reason": "Personal but uncertain"}

        # Default to uncertain
        return {"save": None, "relevance": 2, "preference": False, "stable": False, "reason": "uncertain"}

    def _call_llm_classifier(self, text: str) -> Dict[str, Any]:
        if not self.openai_key:
            # No key -> fall back to conservative decision
            return {"save": False, "relevance": 0, "preference": False, "stable": False, "reason": "no-openai-key"}

        prompt = (
            "You are a concise classifier that answers whether a single user message should be stored as a long-term memory.\n"
            "Return ONLY a JSON object on one line with keys: save (true/false), relevance (0-5), preference (true/false), stable (true/false), reason (short).\n\n"
            f"Message:\n" + text
        )

        try:
            oa = OpenAI(api_key=self.openai_key)
            comp = oa.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0,
                max_tokens=80,
            )
            txt = (comp.choices[0].message.content or "").strip()
            # Try to parse JSON from response
            try:
                parsed = json.loads(txt)
                # Normalize keys
                return {
                    "save": bool(parsed.get("save")),
                    "relevance": int(parsed.get("relevance", 0)),
                    "preference": bool(parsed.get("preference", False)),
                    "stable": bool(parsed.get("stable", False)),
                    "reason": str(parsed.get("reason", ""))
                }
            except Exception:
                # As fallback, do a very conservative parse: look for 'true'/'yes'
                low = txt.lower()
                save = "yes" in low or "true" in low
                return {"save": save, "relevance": 2, "preference": False, "stable": False, "reason": txt}
        except Exception:
            return {"save": False, "relevance": 0, "preference": False, "stable": False, "reason": "llm-failed"}

    def analyze(self, text: str) -> Dict[str, Any]:
        h = self._heuristic(text)
        if h.get("save") is not None:
            return h

        # Heuristic left it uncertain -> call LLM classifier
        return self._call_llm_classifier(text)


_extractor_instance: MemoryExtractor = None


def get_memory_extractor() -> MemoryExtractor:
    global _extractor_instance
    if _extractor_instance is None:
        _extractor_instance = MemoryExtractor()
    return _extractor_instance
