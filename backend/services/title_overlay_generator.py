import json
import logging
from services.title_generator import get_client

logger = logging.getLogger(__name__)


def generate_title_overlays(timestamped_transcript: str, total_duration: float) -> list[dict]:
    """Use Claude to generate section title overlays from a timestamped transcript."""
    client = get_client()

    # Truncate very long transcripts
    truncated = timestamped_transcript[:12000]
    if len(timestamped_transcript) > 12000:
        truncated += "\n\n[transcript truncated]"

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        system=(
            "You are a video editor assistant. Given a timestamped vlog transcript, identify "
            "3-7 natural chapter breaks where a title overlay would help viewers follow along. "
            "For each chapter, generate a short title (3-5 words) and specify when it should "
            "appear and disappear.\n\n"
            "Rules:\n"
            "- Titles should mark topic transitions, not every sentence\n"
            "- Each title should display for 5 seconds\n"
            "- Place titles near the start of each new section/topic\n"
            "- First title can be an intro/hook title\n"
            "- Keep titles concise and engaging (like YouTube chapter titles)\n"
            "- Return lowercase\n"
            "- start_time and end_time are in seconds\n"
            "- Do not place titles beyond the total video duration\n"
            f"- Total video duration is {total_duration:.1f} seconds\n\n"
            "Return ONLY a JSON array like:\n"
            '[{"text": "The Setup", "start_time": 0.0, "end_time": 4.0}, ...]'
        ),
        messages=[{"role": "user", "content": truncated}],
    )

    raw = response.content[0].text.strip()

    # Extract JSON array from response (handle markdown code blocks)
    if raw.startswith("```"):
        lines = raw.split("\n")
        raw = "\n".join(lines[1:-1])

    titles = json.loads(raw)

    # Validate and clamp to duration
    validated = []
    for t in titles:
        if not isinstance(t, dict) or "text" not in t or "start_time" not in t or "end_time" not in t:
            continue
        start = max(0.0, float(t["start_time"]))
        end = min(float(t["end_time"]), total_duration)
        if end <= start:
            continue
        validated.append({
            "text": str(t["text"]),
            "start_time": round(start, 2),
            "end_time": round(end, 2),
        })

    logger.info("Generated %d title overlays for %.1fs video", len(validated), total_duration)
    return validated
