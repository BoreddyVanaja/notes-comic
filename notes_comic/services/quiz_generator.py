import os
import json
from dotenv import load_dotenv
from google import genai

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

TEXT_MODEL = "gemini-flash-latest"


def generate_quiz(notes, question_count):
    """
    Generates a quiz + mind map based on the given notes.
    Returns: {
      "mindMap": {"mainTopic": str, "keyConcepts": [{"title": str, "details": [str, ...]}, ...]},
      "questions": [{"question": str, "options": [str, str, str, str], "correctIndex": int}, ...]
    }
    """
    prompt = f"""
You are an educational assistant. Based on the study notes below, generate:

1. A mind map summarizing the material.
2. A {question_count}-question multiple-choice quiz that tests understanding
   of the material (not just recall of exact wording).

Notes:
\"\"\"
{notes}
\"\"\"

Return ONLY valid JSON (no markdown, no code fences, no explanation) in
EXACTLY this structure:

{{
  "mindMap": {{
    "mainTopic": "string - the overall topic of the notes",
    "keyConcepts": [
      {{
        "title": "string - a key concept name",
        "details": ["short supporting detail", "another detail"]
      }}
    ]
  }},
  "questions": [
    {{
      "question": "string - the question text",
      "options": ["option A", "option B", "option C", "option D"],
      "correctIndex": 0
    }}
  ]
}}

Rules:
- Generate exactly {question_count} questions.
- Each question must have exactly 4 options.
- "correctIndex" must be an integer 0-3 pointing to the correct option.
- Questions must be based only on the content of the notes provided.
- Do not repeat the same question twice.
"""

    response = client.models.generate_content(
        model=TEXT_MODEL,
        contents=prompt
    )

    raw = response.text.strip()
    raw = raw.replace("```json", "").replace("```", "").strip()

    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        raise ValueError(f"Model did not return valid JSON: {raw[:300]}")

    # ---- Validate structure before handing back to Flask ----
    if "questions" not in result or not isinstance(result["questions"], list):
        raise ValueError("Model response missing a valid 'questions' list.")

    if len(result["questions"]) == 0:
        raise ValueError("Model returned zero questions.")

    for q in result["questions"]:
        if "question" not in q or "options" not in q or "correctIndex" not in q:
            raise ValueError("A question is missing required fields.")
        if not isinstance(q["options"], list) or len(q["options"]) != 4:
            raise ValueError("A question does not have exactly 4 options.")
        if not isinstance(q["correctIndex"], int) or not (0 <= q["correctIndex"] <= 3):
            raise ValueError("A question has an invalid correctIndex.")

    if "mindMap" not in result or "mainTopic" not in result["mindMap"]:
        # Not fatal — fall back to a minimal mind map rather than failing the whole quiz
        result["mindMap"] = {
            "mainTopic": "Your Notes",
            "keyConcepts": []
        }

    return result
