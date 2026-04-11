import json
import logging
from services.title_generator import get_client

logger = logging.getLogger(__name__)


def generate_timestamps(datetime_transcript: str, total_duration: float) -> list[dict]:
    """Use Claude to generate contextual time-of-day timestamps from transcript + clip datetimes."""
    client = get_client()

    truncated = datetime_transcript[:12000]
    if len(datetime_transcript) > 12000:
        truncated += "\n\n[transcript truncated]"

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        system=(
            "You are a video editor assistant. Given a vlog transcript with timeline positions "
            "and the real-world recording timestamps of each clip, generate contextual time markers "
            "that help viewers follow the chronological flow of the vlog.\n\n"
            "Rules:\n"
            "- Generate 2-6 time markers depending on video length and how much time passes\n"
            "- Use natural, casual labels like: \"monday morning\", \"later that afternoon\", "
            "\"the next day\", \"that evening\", \"tuesday\", \"day 3\"\n"
            "- Only place a marker when there's a meaningful time jump or at the start of a new day/period\n"
            "- The first marker should establish when the vlog starts (e.g. \"saturday morning\")\n"
            "- Each marker should display for 4 seconds\n"
            "- Place markers at the start of the clip where the time change occurs\n"
            "- Return lowercase text\n"
            "- start_time and end_time are in seconds (timeline position, not real-world time)\n"
            "- Do not place markers beyond the total video duration\n"
            f"- Total video duration is {total_duration:.1f} seconds\n\n"
            "Return ONLY a JSON array like:\n"
            '[{"text": "saturday morning", "start_time": 0.0, "end_time": 4.0}, ...]'
        ),
        messages=[{"role": "user", "content": truncated}],
    )

    raw = response.content[0].text.strip()

    if raw.startswith("```"):
        lines = raw.split("\n")
        raw = "\n".join(lines[1:-1])

    timestamps = json.loads(raw)

    validated = []
    for t in timestamps:
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

    logger.info("Generated %d timestamp markers for %.1fs video", len(validated), total_duration)
    return validated
