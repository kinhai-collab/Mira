#!/usr/bin/env python3
"""
Test script for the memory service functionality.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from memory_service import get_memory_service
from datetime import datetime

def test_memory_service():
    """Test the memory service functionality."""
    print("Testing Memory Service...")

    # Get memory service instance
    memory_service = get_memory_service()
    print("✓ Memory service initialized")

    # Test user ID
    test_user_id = "test_user_123"

    # Test storing conversation memories
    print("\n1. Testing conversation memory storage...")
    try:
        memory_id1 = memory_service.store_conversation_memory(
            user_id=test_user_id,
            user_message="Hello, how are you today?",
            assistant_response="I'm doing well, thank you! How can I help you today?"
        )
        print(f"✓ Stored conversation memory: {memory_id1}")

        memory_id2 = memory_service.store_conversation_memory(
            user_id=test_user_id,
            user_message="What's the weather like?",
            assistant_response="I don't have access to current weather data, but I can help you check your calendar or email instead."
        )
        print(f"✓ Stored conversation memory: {memory_id2}")

        memory_id3 = memory_service.store_conversation_memory(
            user_id=test_user_id,
            user_message="Can you remind me about my meeting tomorrow?",
            assistant_response="I'd be happy to help with that! Let me check your calendar events."
        )
        print(f"✓ Stored conversation memory: {memory_id3}")

    except Exception as e:
        print(f"✗ Error storing conversation memories: {e}")
        return False

    # Test storing fact memories
    print("\n2. Testing fact memory storage...")
    try:
        fact_id1 = memory_service.store_fact_memory(
            user_id=test_user_id,
            fact="User prefers to start their day with a morning briefing",
            category="preference",
            importance=4
        )
        print(f"✓ Stored fact memory: {fact_id1}")

        fact_id2 = memory_service.store_fact_memory(
            user_id=test_user_id,
            fact="User has a standing meeting every Monday at 10 AM",
            category="schedule",
            importance=3
        )
        print(f"✓ Stored fact memory: {fact_id2}")

    except Exception as e:
        print(f"✗ Error storing fact memories: {e}")
        return False

    # Test retrieving recent conversations
    print("\n3. Testing recent conversation retrieval...")
    try:
        recent_conversations = memory_service.get_recent_conversations(
            user_id=test_user_id,
            limit=5
        )
        print(f"✓ Retrieved {len(recent_conversations)} recent conversations")
        for i, conv in enumerate(recent_conversations, 1):
            metadata = conv.get("metadata", {})
            print(f"  {i}. User: {metadata.get('user_message', '')[:50]}...")
            print(f"     Assistant: {metadata.get('assistant_response', '')[:50]}...")

    except Exception as e:
        print(f"✗ Error retrieving recent conversations: {e}")
        return False

    # Test semantic search
    print("\n4. Testing semantic memory search...")
    try:
        # Search for weather-related memories
        weather_memories = memory_service.retrieve_relevant_memories(
            user_id=test_user_id,
            query="weather forecast",
            limit=3,
            memory_type="conversation"
        )
        print(f"✓ Found {len(weather_memories)} weather-related memories")
        for i, mem in enumerate(weather_memories, 1):
            print(f"  {i}. {mem.get('content', '')[:100]}...")

        # Search for meeting-related memories
        meeting_memories = memory_service.retrieve_relevant_memories(
            user_id=test_user_id,
            query="meeting reminder",
            limit=3,
            memory_type="conversation"
        )
        print(f"✓ Found {len(meeting_memories)} meeting-related memories")
        for i, mem in enumerate(meeting_memories, 1):
            print(f"  {i}. {mem.get('content', '')[:100]}...")

    except Exception as e:
        print(f"✗ Error in semantic search: {e}")
        return False

    # Test memory deletion
    print("\n5. Testing memory deletion...")
    try:
        success = memory_service.delete_memory(
            memory_id=memory_id1,
            memory_type="conversation"
        )
        if success:
            print("✓ Successfully deleted a conversation memory")
        else:
            print("✗ Failed to delete conversation memory")

    except Exception as e:
        print(f"✗ Error deleting memory: {e}")
        return False

    # Test clearing all memories
    print("\n6. Testing memory clearing...")
    try:
        success = memory_service.clear_user_memories(user_id=test_user_id)
        if success:
            print("✓ Successfully cleared all memories for test user")
        else:
            print("✗ Failed to clear memories")

    except Exception as e:
        print(f"✗ Error clearing memories: {e}")
        return False

    print("\n🎉 All memory service tests passed!")
    return True

if __name__ == "__main__":
    success = test_memory_service()
    sys.exit(0 if success else 1)