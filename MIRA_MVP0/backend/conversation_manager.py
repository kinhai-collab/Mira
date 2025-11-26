import os
import asyncio
from typing import Any, Dict, List, Optional
from openai import OpenAI
from memory_extractor import get_memory_extractor
try:
    from memory_autopilot import get_autopilot
except Exception:
    # Autopilot may not be present or may be disabled; keep graceful fallback
    def get_autopilot():
        return None

# Hard-coded defaults (do not rely on environment variables)
# These control whether we store full conversation turns and whether to use LLMs
STORE_ALL_CONVERSATIONS_DEFAULT = False  # do not persist every turn by default
SALIENT_USE_LLM_DEFAULT = True           # use LLM to decide salience by default
SUMMARY_USE_LLM_DEFAULT = True          # use LLM to summarize user messages by default
# Fallback heuristic tuning for when the MemoryExtractor is unavailable.
# We prefer a conservative, robust heuristic: reject questions, match preference
# keywords with word-boundaries, and accept slightly shorter meaningful
# statements (e.g. "I prefer tea").
SALIENT_MIN_WORDS_DEFAULT = 4
SALIENT_KEYWORDS_DEFAULT = [
    "prefer", "like", "want", "remind", "remember", "always", "never",
    "my preference", "need", "should", "plan", "schedule", "birthday",
    "anniversary", "favorite", "favourite"
]
SUMMARY_MODEL_DEFAULT = "gpt-4o-mini"


def _build_system_prompt(base: str, memory_context: str = "", personalization: str = "") -> str:
    prompt = base
    if personalization:
        prompt += f"\n\nPersonalization notes:\n{personalization}"
    if memory_context:
        prompt += f"\n\nRelevant facts:\n{memory_context}"
    return prompt


def respond_with_memory(
    user_id: Optional[str],
    user_input: str,
    history: Optional[List[Dict[str, Any]]],
    memory_manager,
    intelligent_learner,
    model: str = "gpt-4o-mini",
    max_memories: int = 3,
    temperature: float = 0.8,
    max_tokens: int = 300,
) -> Dict[str, Any]:
    """
    Orchestrate retrieval of personalization + relevant memories, build a compact prompt,
    call the LLM, and schedule async storage & learning.

    Returns a dict with keys: response_text, used_context, messages
    """
    # Base system prompt
    system_base = "You are Mira, a warm, helpful assistant. Keep answers concise and friendly."

    # Retrieve contexts (best-effort)
    memory_context = ""
    personalization_context = ""
    try:
        if user_id and user_id != "anonymous":
            try:
                memory_context = memory_manager.get_relevant_context(user_id=user_id, query=user_input, max_memories=max_memories)
            except Exception as e:
                memory_context = ""
            try:
                personalization_context = intelligent_learner.get_personalization_context(user_id=user_id, current_query=user_input)
            except Exception as e:
                personalization_context = ""
    except Exception as e:
        memory_context = ""
        personalization_context = ""

    system_prompt = _build_system_prompt(system_base, memory_context=memory_context, personalization=personalization_context)

    # Build messages array (include recent history if provided)
    messages: List[Dict[str, Any]] = [{"role": "system", "content": system_prompt}]
    if isinstance(history, list):
        for msg in history[-10:]:
            if isinstance(msg, dict) and "role" in msg and "content" in msg:
                messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": user_input})

    # Call OpenAI (synchronous here to match existing usage)
    response_text = """
    Sorry, something went wrong while generating my response.
    """
    try:
        oa = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        comp = oa.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        response_text = (comp.choices[0].message.content or response_text).strip()
    except Exception as e:
        # Keep the fallback message
        print(f"LLM call failed: {e}")

    # Schedule async storage + learning if we have a valid user
    try:
        if user_id and user_id != "anonymous" and response_text and "sorry" not in response_text.lower():
            # Decide whether this user message is salient and should be stored.
            # Rules: short heuristics plus optional LLM classification controlled by env var.
            def is_salient(text: str) -> bool:
                """Use the MemoryExtractor to decide whether to save this user message.

                Falls back to conservative heuristics if the extractor isn't available.
                We treat short first-person identity/preference statements as salient
                (e.g. "I'm a programmer", "I prefer tea") even if under the
                minimum word threshold.
                """
                try:
                    extractor = get_memory_extractor()
                    decision = extractor.analyze(text)
                    # decision['save'] may be True/False or None. If the extractor
                    # explicitly returns True/False, obey it. If it returns None
                    # (undecided) we fall through to the local heuristics below
                    # rather than conservatively treating None as False.
                    save_flag = decision.get("save", None)
                    if save_flag is True:
                        return True
                    if save_flag is False:
                        return False
                    # If save_flag is None, fall back to heuristics below.
                except Exception:
                    # Fallback heuristics in case the MemoryExtractor fails or is
                    # not available. Rules (conservative):
                    #  - Empty/very short text -> not salient
                    #  - Questions (ending with '?' or starting with an
                    #    interrogative) -> not salient
                    #  - Preference/identity short patterns -> salient
                    #  - Preference keywords (word-boundary regex) -> salient
                    #  - Otherwise accept if the text is reasonably long
                    if not text or len(text.strip()) < 2:
                        return False

                    t = text.strip()

                    # New rule: treat common short first-person identity or
                    # preference statements as salient even if they're short.
                    # Examples: "I'm a programmer", "I am a designer",
                    # "I prefer tea", "I like jazz".
                    try:
                        import re
                        identity_patterns = [
                            r"\bI('?|’)?m (a|an) \S.{0,60}\b",
                            r"\bI am (a|an) \S.{0,60}\b",
                            r"\bI work as\b",
                            r"\bI (prefer|like|love|hate|enjoy|need|want) \S.{0,60}\b",
                        ]
                        for p in identity_patterns:
                            if re.search(p, t, flags=re.IGNORECASE):
                                return True
                    except Exception:
                        pass

                    # Quick question detection: trailing ? or interrogative start
                    first_word = t.split()[0].lower() if t.split() else ""
                    interrogatives = (
                        "who", "what", "where", "when", "why", "how",
                        "did", "do", "does", "is", "are", "was", "were"
                    )
                    if t.endswith("?") or first_word in interrogatives:
                        return False

                    # Preference keyword regex (word boundaries) - case insensitive
                    try:
                        import re
                        pattern = r"\b(" + "|".join([re.escape(k) for k in SALIENT_KEYWORDS_DEFAULT]) + r")\b"
                        if re.search(pattern, t, flags=re.IGNORECASE):
                            return True
                    except Exception:
                        # If regex building/search fails for any reason, fall back
                        # to the simpler length-based rule below.
                        pass

                    # Accept longer statements as potentially salient
                    return len(t.split()) >= SALIENT_MIN_WORDS_DEFAULT

            def summarize_text(text: str) -> str:
                """Return a short 1-2 sentence summary of the user text. Uses LLM if enabled, otherwise truncates."""
                # Default: enable LLM summarization
                use_llm = SUMMARY_USE_LLM_DEFAULT
                if use_llm:
                    try:
                        oa = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
                        prompt = f"Summarize this user statement in one short sentence (10-20 words):\n\n{text}"
                        comp = oa.chat.completions.create(model=SUMMARY_MODEL_DEFAULT, messages=[{"role":"user","content":prompt}], max_tokens=60, temperature=0.2)
                        return (comp.choices[0].message.content or text).strip()
                    except Exception:
                        return (text[:240] + "...") if len(text) > 240 else text
                else:
                    return (text[:240] + "...") if len(text) > 240 else text
            # Control storing full conversation turns via env var to avoid storing every message by default.
            # If STORE_ALL_CONVERSATIONS is set to "false" (case-insensitive), we will NOT persist the full
            # user/assistant turn. Instead we still run the IntelligentLearner to extract high-value facts.
            # Default: do NOT store every conversation turn; store only salient user messages
            store_all = STORE_ALL_CONVERSATIONS_DEFAULT

            if store_all:
                # memory_manager.store_conversation is async
                try:
                    asyncio.create_task(memory_manager.store_conversation(user_id=user_id, user_message=user_input, assistant_response=response_text))
                except Exception:
                    # Fallback: call memory service directly if needed
                    try:
                        memory_manager.memory_service.store_conversation_memory_async(user_id=user_id, user_message=user_input, assistant_response=response_text)
                    except Exception:
                        pass
            else:
                # Store only salient user messages as short summaries (facts), not raw turns
                try:
                    salient = False
                    try:
                        salient = is_salient(user_input)
                    except Exception as e:
                        salient = False
                    if salient:
                        summary = summarize_text(user_input)
                        # upsert as a fact (dedupe inside the memory service)
                        try:
                            # Developer-visible pre-upsert log
                            try:
                                preview = (summary[:180] + '...') if len(summary) > 180 else summary
                            except Exception:
                                preview = "<unprintable>"
                            print(f"MemoryUpsert: attempting upsert user_id={user_id} preview={preview}")

                            upserted_id = memory_manager.memory_service.upsert_fact_memory(user_id=user_id, fact=summary, category="salient", importance=3)

                            try:
                                print(f"MemoryUpsert: upsert succeeded user_id={user_id} id={upserted_id} preview={preview}")
                            except Exception:
                                pass
                        except Exception as e:
                            # fallback: store raw user message as fact
                            try:
                                print(f"MemoryUpsert: upsert raised exception, falling back to store_fact_memory user_id={user_id} error={e}")
                                memory_manager.memory_service.store_fact_memory(user_id=user_id, fact=summary, category="salient", importance=2)
                                print(f"MemoryUpsert: fallback store_fact_memory invoked for user_id={user_id}")
                            except Exception as ex:
                                print(f"MemoryUpsert: fallback store_fact_memory failed for user_id={user_id} error={ex}")
                                pass
                    else:
                        # Not salient - developer-visible log for debugging
                        try:
                            preview = (user_input[:180] + '...') if len(user_input) > 180 else user_input
                        except Exception:
                            preview = "<unprintable>"
                        print(f"MemoryUpsert: message not salient; skipping save for user_id={user_id} preview={preview}")
                except Exception:
                    pass

            # Run the intelligent learner analysis (still useful even if we're not storing full turns)
            try:
                asyncio.create_task(intelligent_learner.analyze_conversation(user_id=user_id, user_message=user_input, assistant_response=response_text))
            except Exception:
                pass

            # Autopilot decisioner (opt-in) — still run regardless, it may choose to create/merge facts
            try:
                autopilot = get_autopilot()
                if autopilot:
                    # run in background
                    asyncio.create_task(autopilot.run_autopilot_for_conversation(user_id=user_id, user_message=user_input, assistant_response=response_text))
            except Exception:
                pass
    except Exception:
        pass

    return {"response_text": response_text, "used_context": {"memory": memory_context, "personalization": personalization_context}, "messages": messages}


_cm_instance = None


def get_conversation_manager():
    global _cm_instance
    if _cm_instance is None:
        _cm_instance = True  # placeholder: stateless functions used
    return get_conversation_manager
