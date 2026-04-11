import logging
import anthropic
from config import ANTHROPIC_API_KEY

logger = logging.getLogger(__name__)

_client: anthropic.Anthropic | None = None


def get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        if not ANTHROPIC_API_KEY:
            raise RuntimeError("ANTHROPIC_API_KEY environment variable is not set")
        _client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    return _client


def generate_titles(transcript: str, count: int = 5) -> list[str]:
    client = get_client()

    # Truncate long transcripts to stay within reasonable token limits
    truncated = transcript[:8000]
    if len(transcript) > 8000:
        truncated += "\n\n[transcript truncated]"

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=512,
        system=(
            f"You are a YouTube title expert. Generate exactly {count} engaging, "
            "clickable video titles based on the transcript provided. "
            "Return only the titles, one per line, no numbering or bullet points."
        ),
        messages=[{"role": "user", "content": truncated}],
    )

    raw = response.content[0].text
    titles = [line.strip() for line in raw.strip().splitlines() if line.strip()]

    logger.info(f"Generated {len(titles)} title suggestions")
    return titles


DEFAULT_DESCRIPTION_PROMPT = (
    "You are a YouTube description writer. Write a compelling video description "
    "based on the transcript and title provided. Include:\n"
    "- A hook/summary in the first 2 lines (this shows in search results)\n"
    "- Key topics covered\n"
    "- A call to action (like, subscribe, comment)\n\n"
    "Keep it under 300 words. Do not include timestamps or hashtags."
)


def generate_description(transcript: str, title: str, system_prompt: str | None = None) -> str:
    client = get_client()

    truncated = transcript[:8000]
    if len(transcript) > 8000:
        truncated += "\n\n[transcript truncated]"

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        system=system_prompt or DEFAULT_DESCRIPTION_PROMPT,
        messages=[{"role": "user", "content": f"Title: {title}\n\nTranscript:\n{truncated}"}],
    )

    logger.info("Generated video description")
    return response.content[0].text.strip()


def generate_tags(transcript: str, title: str, count: int = 10) -> list[str]:
    client = get_client()

    truncated = transcript[:4000]
    if len(transcript) > 4000:
        truncated += "\n\n[transcript truncated]"

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=256,
        system=(
            f"You are a YouTube SEO expert. Generate exactly {count} relevant tags/keywords "
            "for this video based on the title and transcript. "
            "Return only the tags, one per line, no numbering. "
            "Mix broad and specific terms for best discoverability."
        ),
        messages=[{"role": "user", "content": f"Title: {title}\n\nTranscript:\n{truncated}"}],
    )

    raw = response.content[0].text
    tags = [line.strip() for line in raw.strip().splitlines() if line.strip()]

    logger.info(f"Generated {len(tags)} tags")
    return tags
