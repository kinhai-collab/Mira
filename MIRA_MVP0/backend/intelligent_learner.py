"""
Intelligent Learning System for Mira
Automatically learns from user interactions to personalize experiences
"""

import os
import re
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
import json
from collections import defaultdict, Counter
import asyncio

from openai import OpenAI
from memory_service import get_memory_service
from memory_manager import get_memory_manager

class IntelligentLearner:
    """
    Automatically learns from user interactions to personalize experiences.
    Analyzes interactions (conversations, emails) and patterns to build user profiles.
    """

    def __init__(self):
        self.memory_service = get_memory_service()
        self.memory_manager = get_memory_manager()
        self.openai = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

        # Learning categories
        self.categories = {
            "preferences": [],  # User likes/dislikes
            "habits": [],       # Behavioral patterns
            "knowledge": [],    # Facts about user
            "relationships": [], # People/connections
            "schedule": [],     # Time preferences
            "communication": [] # Communication style
        }

        # Pattern recognition
        self.conversation_patterns = defaultdict(int)
        self.response_patterns = defaultdict(int)
        self.topic_interests = Counter()

    def _safe_parse_json_array(self, text: str) -> List[Dict[str, Any]]:
        """
        Try to parse a JSON array from model output robustly.
        - If text is valid JSON, return it.
        - Else, attempt to locate the first JSON array ([...] ) substring and parse that.
        - If still failing, return an empty list.
        """
        if not text:
            return []

        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                return parsed
            # If model returned an object, wrap in list
            if isinstance(parsed, dict):
                return [parsed]
        except Exception:
            pass

        # Try to extract a JSON array substring
        try:
            import re
            m = re.search(r"\[.*\]", text, flags=re.DOTALL)
            if m:
                candidate = m.group(0)
                parsed = json.loads(candidate)
                if isinstance(parsed, list):
                    return parsed
        except Exception:
            pass

        # Give up safely
        return []

    async def analyze_conversation(self, user_id: str, user_message: str, assistant_response: str):
        """
        Analyze a conversation turn and extract learnings automatically.
        """
        try:
            # Extract insights from the conversation
            insights = await self._extract_conversation_insights(user_message, assistant_response)

            # Store valuable insights
            for insight in insights:
                await self._store_insight(user_id, insight)

            # Update behavior patterns
            await self._update_behavior_patterns(user_id, user_message, assistant_response)

        except Exception as e:
            print(f"Error in conversation analysis: {e}")

    async def analyze_email(self, user_id: str, email_data: Dict[str, Any]):
        """
        Analyze email content for user insights.
        """
        try:
            subject = email_data.get("subject", "")
            body = email_data.get("body", "")
            sender = email_data.get("sender", "")

            # Extract insights from email
            email_insights = await self._extract_email_insights(subject, body, sender)

            for insight in email_insights:
                await self._store_insight(user_id, insight, source="email")

        except Exception as e:
            print(f"Error in email analysis: {e}")

    async def analyze_calendar_event(self, user_id: str, event_data: Dict[str, Any]):
        """
        Analyze calendar events for scheduling preferences.
        """
        try:
            title = event_data.get("title", "")
            description = event_data.get("description", "")
            attendees = event_data.get("attendees", [])
            duration = event_data.get("duration", 0)

            # Extract scheduling insights
            schedule_insights = await self._extract_schedule_insights(title, description, attendees, duration)

            for insight in schedule_insights:
                await self._store_insight(user_id, insight, source="calendar")

        except Exception as e:
            print(f"Error in calendar analysis: {e}")

    async def _extract_conversation_insights(self, user_message: str, assistant_response: str) -> List[Dict[str, Any]]:
        """
        Use AI to extract valuable insights from conversations.
        """
        prompt = f"""
        Analyze this conversation and extract any valuable user insights:

        User: {user_message}
        Assistant: {assistant_response}

        Extract insights about:
        - User preferences or dislikes
        - Personal information or facts
        - Behavioral patterns
        - Communication style preferences
        - Interests or hobbies
        - Schedule/time preferences

    Return ONLY a JSON array of insights. Each insight should have:
    - "type": category (preferences, habits, knowledge, relationships, schedule, communication)
    - "content": the insight text (a concise factual statement)
    - "evidence": the exact substring from the USER message that supports this insight, or empty string if none
    - "confidence": 1-5 (how certain we are)
    - "importance": 1-5 (how valuable this insight is)

    IMPORTANT: Do NOT infer or speculate. Return ONLY insights that are explicitly stated by the USER in the conversation. If the user did not state the fact explicitly, return an empty array [].
        """

        try:
            response = self.openai.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=500
            )

            insights_text = response.choices[0].message.content.strip()

            # Robust JSON parsing: try direct json.loads, then try to extract a JSON array substring
            insights = self._safe_parse_json_array(insights_text)

            # Filter: only keep dict insights with evidence and sufficient confidence/importance
            valuable_insights = [
                insight for insight in insights
                if (
                    isinstance(insight, dict)
                    and insight.get("confidence", 0) >= 3
                    and insight.get("importance", 0) >= 3
                    and isinstance(insight.get("evidence"), str)
                    and len(insight.get("evidence").strip()) > 0
                )
            ]

            return valuable_insights

        except Exception as e:
            print(f"Error extracting conversation insights: {e}")
            return []

    async def _extract_email_insights(self, subject: str, body: str, sender: str) -> List[Dict[str, Any]]:
        """
        Extract insights from email content.
        """
        prompt = f"""
        Analyze this email and extract user insights:

        Subject: {subject}
        From: {sender}
        Body: {body[:1000]}...  # Truncated for analysis

        Look for:
        - Professional relationships
        - Personal interests mentioned
        - Preferences or opinions
        - Important personal information

        Return JSON array of insights with same format as conversation analysis.
        """

        try:
            response = self.openai.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=400
            )

            insights_text = response.choices[0].message.content.strip()
            insights = self._safe_parse_json_array(insights_text)
            return [
                i for i in insights
                if (
                    isinstance(i, dict)
                    and i.get("confidence", 0) >= 3
                    and isinstance(i.get("evidence"), str)
                    and len(i.get("evidence").strip()) > 0
                )
            ]

        except Exception as e:
            print(f"Error extracting email insights: {e}")
            return []

    async def _extract_schedule_insights(self, title: str, description: str, attendees: List[str], duration: int) -> List[Dict[str, Any]]:
        """
        Extract insights from calendar events.
        """
        prompt = f"""
        Analyze this calendar event for scheduling insights:

        Title: {title}
        Description: {description[:500]}
        Attendees: {len(attendees)} people
        Duration: {duration} minutes

        Look for:
        - Meeting preferences (time of day, duration, frequency)
        - Relationship insights from attendees
        - Activity patterns

        Return JSON array of insights.
        """

        try:
            response = self.openai.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=300
            )

            insights_text = response.choices[0].message.content.strip()
            insights = self._safe_parse_json_array(insights_text)
            return [
                i for i in insights
                if (
                    isinstance(i, dict)
                    and i.get("confidence", 0) >= 3
                    and isinstance(i.get("evidence"), str)
                    and len(i.get("evidence").strip()) > 0
                )
            ]

        except Exception as e:
            print(f"Error extracting schedule insights: {e}")
            return []

    async def _store_insight(self, user_id: str, insight: Dict[str, Any], source: str = "conversation"):
        """
        Store a valuable insight in the memory system.
        """
        insight_type = insight.get("type", "knowledge")
        content = insight.get("content", "")
        evidence = (insight.get("evidence") or "").strip()
        importance = insight.get("importance", 3)

        # Only store insights that have supporting evidence (explicit user text)
        if not content or not evidence:
            print(f"Skipping insight (no content or evidence): {insight}")
            return

        # Store as fact with appropriate category
        success = self.memory_manager.add_user_fact(
            user_id=user_id,
            fact=content,
            category=f"{source}_{insight_type}",
            importance=importance
        )

        if success:
            print(f"✓ Learned: {content} (type: {insight_type}, source: {source})")

    async def _update_behavior_patterns(self, user_id: str, user_message: str, assistant_response: str):
        """
        Update behavior pattern tracking.
        """
        # Track conversation topics
        topics = self._extract_topics(user_message)
        for topic in topics:
            self.topic_interests[topic] += 1

        # Track communication patterns
        self._analyze_communication_style(user_message)

    def _extract_topics(self, message: str) -> List[str]:
        """Simple topic extraction."""
        topics = []

        # Common topic keywords
        topic_keywords = {
            "work": ["work", "job", "project", "meeting", "deadline"],
            "health": ["health", "exercise", "diet", "doctor", "medicine"],
            "family": ["family", "parent", "child", "spouse", "relative"],
            "travel": ["travel", "vacation", "trip", "flight", "hotel"],
            "food": ["food", "restaurant", "recipe", "cooking", "eat"],
            "entertainment": ["movie", "music", "game", "book", "show"],
            "technology": ["computer", "phone", "app", "software", "tech"]
        }

        message_lower = message.lower()
        for topic, keywords in topic_keywords.items():
            if any(keyword in message_lower for keyword in keywords):
                topics.append(topic)

        return topics

    def _analyze_communication_style(self, message: str):
        """Analyze user communication patterns."""
        # Track message length preferences
        length = len(message.split())
        if length < 10:
            self.conversation_patterns["short_messages"] += 1
        elif length > 50:
            self.conversation_patterns["long_messages"] += 1

        # Track question patterns
        if "?" in message:
            self.conversation_patterns["questions"] += 1

        # Track politeness markers
        polite_words = ["please", "thank", "sorry", "excuse", "appreciate"]
        if any(word in message.lower() for word in polite_words):
            self.conversation_patterns["polite"] += 1

    def get_personalization_context(self, user_id: str, current_query: str) -> str:
        """
        Get personalized context for response generation.
        """
        context_parts = []

        try:
            # Get relevant facts
            relevant_facts = self.memory_manager.search_facts(user_id, current_query, limit=3)
            if relevant_facts:
                context_parts.append("User facts: " + "; ".join(relevant_facts))

            # Get recent fact context
            conv_context = self.memory_manager.get_relevant_context(user_id, current_query, max_memories=2)
            if conv_context:
                context_parts.append("Recent facts: " + conv_context)

            # Add behavior insights
            behavior_insights = self._get_behavior_insights(user_id)
            if behavior_insights:
                context_parts.append("User patterns: " + behavior_insights)

        except Exception as e:
            print(f"Error getting personalization context: {e}")

        return "\n".join(context_parts)

    def _get_behavior_insights(self, user_id: str) -> str:
        """Generate behavior insights for personalization."""
        insights = []

        # Communication style
        total_patterns = sum(self.conversation_patterns.values())
        if total_patterns > 10:  # Only if we have enough data
            if self.conversation_patterns["polite"] > total_patterns * 0.7:
                insights.append("prefers polite, formal communication")
            if self.conversation_patterns["questions"] > total_patterns * 0.5:
                insights.append("asks many questions, curious nature")
            if self.conversation_patterns["short_messages"] > total_patterns * 0.6:
                insights.append("prefers concise communication")

        # Interests
        top_interests = self.topic_interests.most_common(3)
        if top_interests:
            interests = [topic for topic, count in top_interests if count > 2]
            if interests:
                insights.append(f"interested in: {', '.join(interests)}")

        return "; ".join(insights)

    async def periodic_learning(self, user_id: str):
        """
        Periodic learning task to analyze patterns and create summaries.
        """
        try:
            # Analyze conversation patterns for deeper insights
            await self._analyze_conversation_patterns(user_id)

            # Create personalized summaries
            await self._create_personalized_summaries(user_id)

        except Exception as e:
            print(f"Error in periodic learning: {e}")

    async def _analyze_conversation_patterns(self, user_id: str):
        """Analyze long-term conversation patterns."""
        # This could identify recurring themes, preferred times, etc.
        pass

    async def _create_personalized_summaries(self, user_id: str):
        """Create summarized versions of user knowledge."""
        # Summarize facts by category
        # Create personality profiles
        # Generate preference summaries
        pass

# Global instance
_intelligent_learner = None

def get_intelligent_learner() -> IntelligentLearner:
    """Get the global intelligent learner instance."""
    global _intelligent_learner
    if _intelligent_learner is None:
        _intelligent_learner = IntelligentLearner()
    return _intelligent_learner