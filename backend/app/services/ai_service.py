# app/services/ai_service.py
# --------------------------------------------------------------------------------
# Integrates Google Gemini model to analyze feature descriptions and returns
# structured JSON task lists to help Project Managers perform planning.
# --------------------------------------------------------------------------------

import json
import logging
from fastapi import HTTPException
from google import genai
from app.core.config import settings

logger = logging.getLogger(__name__)


class AIService:

    @staticmethod
    def generate_task_breakdown(
        title: str,
        description: str,
        expected_output: str | None = None,
    ) -> dict:
        """
        Calls Gemini to break a requirement description into structured tasks.
        
        Returns:
            dict: { "summary": "...", "tasks": [...] }
        """
        # 1. Structure the prompt context
        requirement_block = (
            f"Requirement Title: {title}\n"
            f"Requirement Description: {description}"
        )
        # Append expected output context if supplied
        if expected_output:
            requirement_block += f"\nExpected Output: {expected_output}"

        # Combine text instructions with formatting rules
        prompt = (
            "You are a software project planning assistant. "
            "Break the following software requirement into development tasks.\n\n"
            f"{requirement_block}\n\n"
            "CRITICAL RULES:\n"
            "- Logical task order: (1) Requirement analysis/planning, (2) Backend, (3) Database, (4) Frontend UI, (5) API integration, (6) Validation/testing.\n"
            "- Do not repeat similar tasks. Merge similar backend/API tasks into a single task where possible. Each task must be distinct and necessary.\n"
            "- Return ONLY a valid JSON object. No markdown. No explanation outside JSON.\n\n"
            "For each task return: title, description, task_type "
            "(one of: development, testing, bug, documentation), "
            "priority (one of: low, medium, high, critical), "
            "effort_points (integer 1-13, Fibonacci scale: 1,2,3,5,8,13), "
            "acceptance_criteria (1-2 sentences defining when task is done), "
            "possible_risks (1 sentence about what could go wrong), "
            "and order (integer reflecting its position in the development flow).\n\n"
            'Exact format: { "summary": "...", "tasks": [ { "title": "...", '
            '"description": "...", "task_type": "...", "priority": "...", '
            '"effort_points": 3, "acceptance_criteria": "...", '
            '"possible_risks": "...", "order": 1 } ] }'
        )

        # 2. Call Google Gemini API using the official client library
        try:
            # Initialize client with key loaded from .env config
            client = genai.Client(api_key=settings.GEMINI_API_KEY)

            # Generate response from Gemini model
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
            )

            result_text = response.text

        except Exception as exc:
            # Log exact exception parameters for diagnostic review
            logger.error("Gemini API call failed: %s — %s", type(exc).__name__, str(exc))
            raise HTTPException(
                status_code=503,
                detail="AI service is currently unavailable. Please try again later or add tasks manually.",
            )

        # 3. Clean raw output to guarantee valid JSON string
        try:
            cleaned = result_text.strip()

            # Remove markdown backticks (e.g. ```json ... ```) if returned
            if cleaned.startswith("```"):
                lines = cleaned.split("\n")
                lines = [l for l in lines if not l.strip().startswith("```")]
                cleaned = "\n".join(lines).strip()

            # Parse string payload to standard Python dictionary
            parsed = json.loads(cleaned)

        except json.JSONDecodeError:
            # Raise exception if Gemini returns unparseable text
            logger.error("Gemini returned unparseable JSON: %s", result_text[:200])
            raise HTTPException(
                status_code=503,
                detail="AI returned a malformed response. Please try again or add tasks manually.",
            )

        # 4. Enforce expected keys exist in parsed results
        if not isinstance(parsed, dict) or "tasks" not in parsed:
            logger.error("Gemini JSON missing 'tasks' key. Got: %s", list(parsed.keys()))
            raise HTTPException(
                status_code=503,
                detail="AI returned an unexpected format. Please try again or add tasks manually.",
            )

        # 5. Sanitize and validate every task field to match schemas
        valid_task_types = {"development", "testing", "bug", "documentation"}
        valid_priorities = {"low", "medium", "high", "critical"}

        sanitized_tasks = []
        for task in parsed["tasks"]:
            sanitized_tasks.append({
                # Fallback to default name if missing
                "title": task.get("title", "Untitled Task"),
                "description": task.get("description", ""),
                # Fallback to development task_type if invalid
                "task_type": (
                    task.get("task_type", "development")
                    if task.get("task_type") in valid_task_types
                    else "development"
                ),
                # Fallback to medium priority if invalid
                "priority": (
                    task.get("priority", "medium")
                    if task.get("priority") in valid_priorities
                    else "medium"
                ),
                # Enforce Fibonacci scale bounds
                "effort_points": min(max(int(task.get("effort_points", 3)), 1), 13),
                "acceptance_criteria": task.get("acceptance_criteria", ""),
                "possible_risks": task.get("possible_risks", ""),
                # Order indexing falls back to end of queue if missing
                "order": int(task.get("order", 999))
            })

        # 6. Deduplicate suggestions with identical normalized titles
        import string
        unique_tasks = {}
        for task in sanitized_tasks:
            # Strip punctuation and convert to lower to normalize comparison keys
            title_norm = task["title"].lower().translate(str.maketrans('', '', string.punctuation)).strip()
            
            if title_norm in unique_tasks:
                existing = unique_tasks[title_norm]
                # Combine criteria text from both duplicate tasks
                if task["acceptance_criteria"]:
                    existing["acceptance_criteria"] += " | " + task["acceptance_criteria"]
            else:
                unique_tasks[title_norm] = task

        # Sort tasks by their logical order number
        final_tasks = list(unique_tasks.values())
        final_tasks.sort(key=lambda t: t.get("order", 999))

        # 7. Return clean result payload
        return {
            "summary": parsed.get("summary", "AI-generated task breakdown"),
            "tasks": final_tasks,
        }