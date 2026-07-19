import os
import json
import base64
import requests
from dotenv import load_dotenv
from google import genai

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

TEXT_MODEL = "gemini-flash-latest"

# Free, no-API-key image generation service (used because Gemini image
# generation requires billing / has zero free quota on this project).
POLLINATIONS_BASE = "https://image.pollinations.ai/prompt/"


def _get_panel_captions(notes, panel_count):
    prompt = f"""
You are converting study notes into a {panel_count}-panel comic strip.

Notes:
{notes}

Return ONLY valid JSON (no markdown, no code fences) as a list of exactly
{panel_count} objects, each with a single key "caption" containing a short,
vivid one-sentence visual description of that panel's scene.
"""

    response = client.models.generate_content(
        model=TEXT_MODEL,
        contents=prompt
    )

    raw = response.text.strip()
    raw = raw.replace("```json", "").replace("```", "").strip()

    try:
        panel_captions = json.loads(raw)
    except json.JSONDecodeError:
        raise ValueError(f"Model did not return valid JSON: {raw[:200]}")

    if not isinstance(panel_captions, list) or len(panel_captions) == 0:
        raise ValueError("Model returned an empty or invalid panel list.")

    return panel_captions


def _generate_panel_image(caption):
    """
    Generate a single comic-style image for a caption using Pollinations.ai
    (free, no API key needed). Returns (image_data_uri_or_None, error_or_None).
    """
    prompt = f"colorful comic book panel illustration, no text, no speech bubbles: {caption}"

    try:
        import urllib.parse
        encoded_prompt = urllib.parse.quote(prompt)
        url = f"{POLLINATIONS_BASE}{encoded_prompt}?width=768&height=512&nologo=true&model=flux"

        resp = requests.get(url, timeout=60)
        resp.raise_for_status()

        b64_data = base64.b64encode(resp.content).decode("utf-8")
        return f"data:image/jpeg;base64,{b64_data}", None

    except requests.RequestException as e:
        return None, str(e)


def generate_comic(notes, panel_count):
    """
    Turns `notes` into `panel_count` comic panels.
    Returns a list of dicts: [{"caption": str, "imageBase64": str}, ...]
    """
    panel_captions = _get_panel_captions(notes, panel_count)

    panels = []
    for p in panel_captions:
        caption = p.get("caption", "")
        image_data_uri, error = _generate_panel_image(caption)

        panels.append({
            "caption": caption,
            "imageBase64": image_data_uri or ""
        })

    if all(p["imageBase64"] == "" for p in panels):
        raise ValueError("Image generation failed for all panels. The image service may be temporarily unavailable — please try again.")

    return panels