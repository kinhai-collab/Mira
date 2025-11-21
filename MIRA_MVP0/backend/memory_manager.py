"""
Internal Memory Manager - Efficient interface for internal memory operations.
This avoids API overhead for internal operations while providing the same functionality.
"""

from memory_service import get_memory_service
from typing import List, Dict, Any, Optional
import asyncio

class MemoryManager:
    """Efficient internal interface for memory operations."""

    def __init__(self):
        self.memory_service = get_memory_service()

    async def store_conversation(self, user_id: str, user_message: str, assistant_response: str) -> None:
        """Store a conversation turn asynchronously (fire and forget).

        Per the facts-only policy, conversation turns are not persisted. We keep
        this method as a compatibility no-op that still calls the memory service
        async method (which itself is a no-op) to avoid breaking older callers.
        """
        try:
            await self.memory_service.store_conversation_memory_async(
                user_id=user_id,
                user_message=user_message,
                assistant_response=assistant_response
            )
        except Exception:
            # swallow errors to keep fire-and-forget semantics
            return None

    def get_relevant_context(self, user_id: str, query: str, max_memories: int = 3) -> str:
        """Get relevant context for a query using stored facts (synchronous).

        Conversations are not persisted; this returns facts relevant to the
        query to be included in prompts or system messages.
        """
        try:
            facts = self.memory_service.retrieve_relevant_memories(
                user_id=user_id,
                query=query,
                limit=max_memories,
                memory_type="fact"
            )

            if facts:
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
        except Exception as e:
            print(f"Error retrieving memory context: {e}")

        return ""

    def add_user_fact(self, user_id: str, fact: str, category: str = "general", importance: int = 1) -> bool:
        """Add an important fact about the user."""
        try:
            self.memory_service.store_fact_memory(
                user_id=user_id,
                fact=fact,
                category=category,
                importance=importance
            )
            return True
        except Exception as e:
            print(f"Error storing user fact: {e}")
            return False

    def search_user_facts(self, user_id: str, query: str, limit: int = 3) -> List[str]:
        """Search for relevant user facts."""
        try:
            facts = self.memory_service.retrieve_relevant_memories(
                user_id=user_id,
                query=query,
                limit=limit,
                memory_type="fact"
            )
            return [fact.get("content", "") for fact in facts if fact.get("content")]
        except Exception as e:
            print(f"Error searching user facts: {e}")
            return []

# Global instance
_memory_manager = None

def get_memory_manager() -> MemoryManager:
    """Get the global memory manager instance."""
    global _memory_manager
    if _memory_manager is None:
        _memory_manager = MemoryManager()
    return _memory_manager
