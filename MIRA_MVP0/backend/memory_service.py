import os
import json
import logging
from datetime import datetime
import hashlib
import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import List, Dict, Any, Optional
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

    def store_fact_memory(self, user_id: str, fact: str, category: str = "general",
                          importance: int = 1) -> str:
        embedding = self._embed([fact])[0]

        metadata = {
            "user_id": user_id,
            "fact": fact,
            "category": category,
            "importance": importance,
            "timestamp": datetime.now().isoformat(),
            "type": "fact",
        }

        memory_id = self._generate_id(fact, user_id)

        if self.supabase:
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
                self.supabase.table("facts").insert(row).execute()
            except Exception:
                logging.exception("Failed to insert fact into Supabase")

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
            resp = self.supabase.table("facts").select("id, content, metadata, embedding").eq("user_id", user_id).limit(200).execute()
            rows = resp.data or []
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
            resp = self.supabase.table("facts").select("id, content, metadata, embedding").eq("user_id", user_id).limit(200).execute()
            rows = resp.data or []
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

    def upsert_fact_memory(self, user_id: str, fact: str, category: str = "general", importance: int = 1,
                           dedupe_distance_threshold: float = None) -> str:
        if dedupe_distance_threshold is None:
            try:
                dedupe_distance_threshold = float(os.getenv("DEDUP_DISTANCE_THRESHOLD", "0.2"))
            except Exception:
                dedupe_distance_threshold = 0.2

        candidates = self.retrieve_similar_facts(user_id=user_id, text=fact, limit=3)
        if candidates:
            best = candidates[0]
            dist = best.get("distance")
            if dist is not None and dist < dedupe_distance_threshold and best.get("id"):
                existing_id = best.get("id")
                existing_meta = best.get("metadata", {}) or {}
                existing_importance = int(existing_meta.get("importance", 1))
                new_importance = max(existing_importance, int(importance))
                existing_meta.update({"importance": new_importance})
                hist = existing_meta.get("history", [])
                hist.append({"merged_at": datetime.now().isoformat(), "source": "upsert", "content": fact})
                existing_meta["history"] = hist

                if self.supabase:
                    try:
                        self.supabase.table("facts").update({"metadata": existing_meta}).eq("id", existing_id).execute()
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
            rows = resp.data or []
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
        # Create persist directory if it doesn't exist
        persist_dir = os.path.join(os.getcwd(), "data", "chroma_db")
        os.makedirs(persist_dir, exist_ok=True)
        _memory_service = MemoryService(persist_directory=persist_dir)
    return _memory_service