import os
import json
import logging
from datetime import datetime
import hashlib
import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import List, Dict, Any, Optional, Union
from openai import OpenAI
from settings import supabase


class MemoryService:
    """Memory service backed by Supabase (Postgres).

    Embeddings are generated via OpenAI and stored as JSON arrays in the
    `embedding` column of the `facts` table. Similarity searches fetch candidate
    rows for a user and compute embedding similarity in Python. This keeps the
    implementation compatible with Supabase's REST client and avoids direct
    SQL/pgvector usage in this code.
    """

    def __init__(self, persist_directory: str = "./data/chroma_db"):
        self.persist_directory = persist_directory
        os.makedirs(persist_directory, exist_ok=True)

        # Supabase client (configured in settings.py)
        try:
            self.supabase = supabase
            # quick non-fatal check
            try:
                _ = self.supabase.table("facts").select("id").limit(1).execute()
            except Exception:
                logging.info("Supabase client initialized but `facts` table may not exist or is inaccessible yet")
            # Developer-friendly visibility (do not print keys)
            try:
                sb_url = os.environ.get("SUPABASE_URL")
                print(f"MemoryService initialized. Supabase client present={bool(self.supabase)} SUPABASE_URL_set={bool(sb_url)}")
            except Exception:
                pass
        except Exception:
            logging.exception("Failed to initialize Supabase client; memory operations will be no-ops")
            self.supabase = None

        # OpenAI client for embeddings
        openai_key = os.getenv("OPENAI_API_KEY")
        if not openai_key:
            raise RuntimeError("OPENAI_API_KEY must be set to use embeddings")
        try:
            self.openai = OpenAI(api_key=openai_key)
        except Exception as e:
            logging.exception("Failed to initialize OpenAI client: %s", e)
            raise

        self.embedding_model = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")

        # Thread pool for offloading sync operations
        self.executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="memory")

        # In-memory caches
        self.cache: Dict[str, Any] = {}
        self.cache_max_size = 100
        self.embedding_cache: Dict[str, List[float]] = {}

    # --- utility helpers ---
    def _generate_id(self, content: str, user_id: str) -> str:
        content_hash = hashlib.md5(f"{user_id}:{content}".encode()).hexdigest()
        return f"{user_id}_{content_hash}"

    def _get_cache_key(self, operation: str, user_id: str, **kwargs) -> str:
        params = f"{user_id}:{json.dumps(kwargs, sort_keys=True)}"
        return f"{operation}:{hashlib.md5(params.encode()).hexdigest()[:8]}"

    def _cache_result(self, key: str, result: Any):
        if len(self.cache) < self.cache_max_size:
            self.cache[key] = result

    def _get_cached_result(self, key: str) -> Optional[Any]:
        return self.cache.get(key)

    def _embed(self, texts: List[str]) -> List[List[float]]:
        # small batch wrapper with cache
        to_compute = []
        to_compute_idx = []
        results: List[Optional[List[float]]] = [None] * len(texts)

        for i, t in enumerate(texts):
            key = hashlib.md5(t.encode()).hexdigest()
            cached = self.embedding_cache.get(key)
            if cached is not None:
                results[i] = cached
            else:
                to_compute.append(t)
                to_compute_idx.append(i)

        if to_compute:
            try:
                logging.info(f"💾 MemoryService: Creating {len(to_compute)} embedding(s) via OpenAI")
                resp = self.openai.embeddings.create(model=self.embedding_model, input=to_compute)
                computed = [d.embedding for d in resp.data]
            except Exception as e:
                logging.exception("OpenAI embeddings call failed: %s", e)
                raise

            for j, emb in enumerate(computed):
                idx = to_compute_idx[j]
                results[idx] = emb
                self.embedding_cache[hashlib.md5(texts[idx].encode()).hexdigest()] = emb

        return [r if r is not None else [] for r in results]

    # --- storage operations (Supabase table based) ---
    def store_conversation_memory(self, user_id: str, user_message: str, assistant_response: str,
                                  timestamp: Optional[datetime] = None) -> str:
        # Conversations are no longer persisted per the facts-only policy.
        # Keep a lightweight no-op so older call sites don't break.
        if timestamp is None:
            timestamp = datetime.now()
        combined_text = f"User: {user_message}\nAssistant: {assistant_response}"
        # Generate embedding (cached / batched) but do not store conversation rows
        try:
            _ = self._embed([combined_text])[0]
        except Exception:
            pass
        # Return a deterministic id but do not persist
        return self._generate_id(combined_text, user_id)

    async def store_conversation_memory_async(self, user_id: str, user_message: str, assistant_response: str,
                                              timestamp: Optional[datetime] = None) -> str:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self.executor, self.store_conversation_memory,
                                          user_id, user_message, assistant_response, timestamp)

    def store_fact_memory(self, user_id: str, fact: Union[str, Dict[str, Any]], category: str = "general",
                          importance: int = 1) -> str:
        """Store a fact for a user.

        Accepts either a simple fact string or a fact dict with keys like
        `content`/`fact` and optional `metadata` fields. This makes the API
        tolerant to callers that pass a dict-shaped fact object.
        """

        # Normalize fact input to a string content and metadata dict
        if isinstance(fact, dict):
            # Support both {"content": ...} and {"fact": ...} shapes
            content = fact.get("content") or fact.get("fact") or ""
            meta_in = fact.get("metadata") or {}
            # allow category/importance overrides in the dict
            category = meta_in.get("category", category)
            importance = int(meta_in.get("importance", importance))
        else:
            content = str(fact)
            meta_in = {}

        if not content:
            logging.warning("store_fact_memory called with empty content for user_id=%s", user_id)
            content = ""

        embedding = self._embed([content])[0]

        metadata = {
            "user_id": user_id,
            "fact": content,
            "category": category,
            "importance": importance,
            "timestamp": datetime.now().isoformat(),
            "type": "fact",
        }

        # Merge any incoming metadata fields (without overwriting essential keys)
        try:
            for k, v in (meta_in or {}).items():
                if k not in metadata:
                    metadata[k] = v
        except Exception:
            pass

        memory_id = self._generate_id(content, user_id)

        # Debug: make it explicit when the Supabase client is not available
        if not self.supabase:
            logging.warning("Supabase client not initialized; skipping insert for memory_id=%s user_id=%s", memory_id, user_id)
            return memory_id

        try:
            row = {
                "id": memory_id,
                "user_id": user_id,
                "content": fact,
                "metadata": metadata,
                "embedding": embedding,
                "importance": importance,
                "timestamp": datetime.now().isoformat(),
            }
            # Visibility: print row summary so devs can see attempts in console
            try:
                summary = (fact[:120] + '...') if len(fact) > 120 else fact
            except Exception:
                summary = "<unprintable>"
            print(f"MemoryService: inserting fact for user_id={user_id} id={memory_id} content_preview={summary}")
            try:
                resp = self.supabase.table("facts").insert(row).execute()
            except Exception as e:
                logging.exception("Supabase insert raised exception: %s", e)
                print(f"MemoryService: Supabase insert raised exception: {e}")
                return memory_id

            # Log supabase response for visibility in debugging (data and error fields vary by client)
            try:
                # Try to surface the most useful details for debugging
                data = getattr(resp, 'data', None)
                error = getattr(resp, 'error', None)
                status = getattr(resp, 'status_code', None) or getattr(resp, 'status', None)
                print(f"MemoryService: Supabase insert response: status={status} data_len={(len(data) if data is not None else 0)} error={error}")
                if error:
                    logging.warning("Supabase reported an error inserting fact: %s", error)
            except Exception:
                # Fallback: print the raw response object
                try:
                    print(f"MemoryService: Supabase insert raw response: {repr(resp)}")
                except Exception:
                    logging.info("Supabase insert executed (raw response could not be repr())")
        except Exception:
            logging.exception("Failed to prepare/insert fact into Supabase for user_id=%s id=%s", user_id, memory_id)

        # After inserting a new fact, run autopilot in background to allow merge/update/delete decisions.
        try:
            # Local import to avoid circular imports at module import time
            from memory_autopilot import run_autopilot_debug
            import threading

            def _run_autopilot():
                try:
                    # Use the fact text as the conversation input so autopilot can compare and decide
                    run_autopilot_debug(user_id=user_id, user_message=content if isinstance(content, str) else str(content), assistant_response="(autopilot-run)")
                except Exception as _e:
                    logging.debug(f"Autopilot background run failed: {_e}")

            t = threading.Thread(target=_run_autopilot, daemon=True)
            t.start()
        except Exception:
            # Don't let autopilot failures affect normal flow
            logging.debug("Autopilot scheduling skipped or failed")

        return memory_id

    def _cosine_distance(self, a: List[float], b: List[float]) -> float:
        # return 1 - cosine_similarity (lower = more similar)
        try:
            dot = sum(x * y for x, y in zip(a, b))
            norm_a = sum(x * x for x in a) ** 0.5
            norm_b = sum(y * y for y in b) ** 0.5
            if norm_a == 0 or norm_b == 0:
                return 1.0
            cos_sim = dot / (norm_a * norm_b)
            return 1.0 - cos_sim
        except Exception:
            return 1.0

    def retrieve_relevant_memories(self, user_id: str, query: str, limit: int = 5,
                                  memory_type: str = "fact") -> List[Dict[str, Any]]:
        """Retrieve relevant facts for the user based on semantic similarity.

        The service now only supports fact memories; conversation memories are
        intentionally not persisted.
        """
        query_emb = self._embed([query])[0]
        if not self.supabase:
            return []

        try:
            print(f"MemoryService: retrieving facts for user_id={user_id} (limit=200)")
            resp = self.supabase.table("facts").select("id, content, metadata, embedding").eq("user_id", user_id).limit(200).execute()
            try:
                rows = getattr(resp, 'data', None) or []
            except Exception:
                rows = resp.data if hasattr(resp, 'data') else []
            try:
                logging.debug(f"Supabase retrieve relevant facts response: data_count={len(rows)} error={getattr(resp, 'error', None)}")
                print(f"MemoryService: retrieve_relevant_memories returned {len(rows)} rows for user_id={user_id}")
            except Exception:
                logging.debug(f"Supabase retrieve response: {repr(resp)}")
                try:
                    print(f"MemoryService: retrieve_relevant_memories raw response: {repr(resp)}")
                except Exception:
                    pass
        except Exception:
            logging.exception("Supabase query failed when retrieving relevant facts")
            return []

        scored = []
        for r in rows:
            emb = r.get("embedding") or r.get("metadata", {}).get("embedding")
            if not emb:
                continue
            dist = self._cosine_distance(query_emb, emb)
            scored.append({"content": r.get("content"), "metadata": r.get("metadata"), "distance": dist})

        scored.sort(key=lambda x: x["distance"])
        return scored[:limit]

    def retrieve_similar_facts(self, user_id: str, text: str, limit: int = 3) -> List[Dict[str, Any]]:
        emb = self._embed([text])[0]
        if not self.supabase:
            return []
        try:
            print(f"MemoryService: retrieve_similar_facts query for user_id={user_id} limit=200")
            resp = self.supabase.table("facts").select("id, content, metadata, embedding").eq("user_id", user_id).limit(200).execute()
            rows = getattr(resp, 'data', None) or []
            logging.debug(f"Supabase retrieve_similar_facts response: data_count={len(rows)} error={getattr(resp, 'error', None)}")
            print(f"MemoryService: retrieve_similar_facts returned {len(rows)} rows for user_id={user_id}")
        except Exception:
            logging.exception("Supabase query failed when retrieving similar facts")
            return []
        out = []
        for r in rows:
            candidate_emb = r.get("embedding") or r.get("metadata", {}).get("embedding")
            if not candidate_emb:
                continue
            dist = self._cosine_distance(emb, candidate_emb)
            out.append({"id": r.get("id"), "content": r.get("content"), "metadata": r.get("metadata"), "distance": dist})

        out.sort(key=lambda x: x.get("distance", 1.0))
        return out[:limit]

    def upsert_fact_memory(self, user_id: str, fact: Union[str, Dict[str, Any]], category: str = "general", importance: int = 1,
                           dedupe_distance_threshold: float = None) -> str:
        if dedupe_distance_threshold is None:
            try:
                dedupe_distance_threshold = float(os.getenv("DEDUP_DISTANCE_THRESHOLD", "0.2"))
            except Exception:
                dedupe_distance_threshold = 0.2

        # Normalize fact input to plain text for embedding/lookup
        if isinstance(fact, dict):
            fact_text = fact.get("content") or fact.get("fact") or ""
        else:
            fact_text = str(fact)

        # Small normalization to improve similarity matching
        try:
            fact_text_for_search = fact_text.strip()
        except Exception:
            fact_text_for_search = fact_text

        candidates = self.retrieve_similar_facts(user_id=user_id, text=fact_text_for_search, limit=3)
        if candidates:

            best = candidates[0]
            dist = best.get("distance")
            # If best candidate is similar enough, merge into it
            if dist is not None and dist < dedupe_distance_threshold and best.get("id"):
                existing_id = best.get("id")
                existing_meta = best.get("metadata", {}) or {}
                existing_importance = int(existing_meta.get("importance", 1))
                new_importance = max(existing_importance, int(importance))
                existing_meta.update({"importance": new_importance})
                hist = existing_meta.get("history", [])
                hist.append({"merged_at": datetime.now().isoformat(), "source": "upsert", "content": fact_text_for_search})
                existing_meta["history"] = hist

                if self.supabase:
                    try:
                        self.supabase.table("facts").update({"metadata": existing_meta}).eq("id", existing_id).execute()
                        print(f"MemoryService.upsert: merged into existing_id={existing_id} dist={dist:.4f}")
                        # After merging, run autopilot in background to allow further maintenance decisions
                        try:
                            from memory_autopilot import run_autopilot_debug
                            import threading

                            def _run_autopilot_merge():
                                try:
                                    run_autopilot_debug(user_id=user_id, user_message=fact_text_for_search, assistant_response="(autopilot-merge)")
                                except Exception as _e:
                                    logging.debug(f"Autopilot (merge) background run failed: {_e}")

                            tm = threading.Thread(target=_run_autopilot_merge, daemon=True)
                            tm.start()
                        except Exception:
                            logging.debug("Autopilot (merge) scheduling skipped or failed")
                    except Exception:
                        logging.exception("Failed to update existing fact metadata in Supabase")
                return existing_id

        return self.store_fact_memory(user_id=user_id, fact=fact, category=category, importance=importance)

    # Convenience helpers
    def add_user_fact(self, user_id: str, fact: str, category: str = "general", importance: int = 1) -> str:
        return self.store_fact_memory(user_id=user_id, fact=fact, category=category, importance=importance)

    def search_facts(self, user_id: str, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        return self.retrieve_relevant_memories(user_id=user_id, query=query, limit=limit, memory_type="fact")

    def get_relevant_context(self, user_id: str, query: str, max_memories: int = 3) -> str:
        try:
            facts = self.retrieve_relevant_memories(user_id=user_id, query=query, limit=max_memories, memory_type="fact")

            parts = []
            for mem in facts[:max_memories]:
                content = mem.get("content", "")
                meta = mem.get("metadata", {}) or {}
                category = meta.get("category")
                if category:
                    parts.append(f"Fact ({category}): {content}")
                else:
                    parts.append(content)

            return "\n".join(parts)
        except Exception:
            return ""

    def get_user_memories(self, user_id: str, memory_type: str = "all") -> List[Dict[str, Any]]:
        if not self.supabase:
            return []
        out = []
        try:
            resp = self.supabase.table("facts").select("content, metadata").eq("user_id", user_id).execute()
            rows = getattr(resp, 'data', None) or []
            logging.debug(f"Supabase get_user_memories response: data_count={len(rows)} error={getattr(resp, 'error', None)}")
            for r in rows:
                out.append({"content": r.get("content"), "metadata": r.get("metadata")})
            return out
        except Exception:
            logging.exception("Failed to fetch user facts from Supabase")
            return []

    def export_user_memories(self, user_id: str, filepath: str) -> bool:
        try:
            mems = self.get_user_memories(user_id)
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(mems, f, ensure_ascii=False, indent=2)
            return True
        except Exception:
            return False

    async def retrieve_relevant_memories_async(self, user_id: str, query: str, limit: int = 5,
                                               memory_type: str = "fact") -> List[Dict[str, Any]]:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self.executor, self.retrieve_relevant_memories, user_id, query, limit, memory_type)

    def get_recent_conversations(self, user_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        # Conversations are intentionally not persisted. Return empty list.
        return []

    def delete_memory(self, memory_id: str, memory_type: str = "fact") -> bool:
        if not self.supabase:
            return False
        try:
            # Only allow deletion of facts
            self.supabase.table("facts").delete().eq("id", memory_id).execute()
            return True
        except Exception:
            return False

    def clear_user_memories(self, user_id: str) -> bool:
        if not self.supabase:
            return False
        try:
            # Only clear facts per the facts-only policy
            self.supabase.table("facts").delete().eq("user_id", user_id).execute()
            return True
        except Exception:
            logging.exception("Failed to clear user facts in Supabase")
            return False

# Global instance
_memory_service = None

def get_memory_service() -> MemoryService:
    """Get the global memory service instance."""
    global _memory_service
    if _memory_service is None:
        # In Lambda, use /tmp (read-write). Otherwise use local data directory
        if os.getenv("AWS_LAMBDA_FUNCTION_NAME"):
            persist_dir = "/tmp/chroma_db"
        else:
            persist_dir = os.path.join(os.getcwd(), "data", "chroma_db")
        os.makedirs(persist_dir, exist_ok=True)
        _memory_service = MemoryService(persist_directory=persist_dir)
    return _memory_service