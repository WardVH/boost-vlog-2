"""Generate subtle title in/out sound effects using FFmpeg synthesis."""

import asyncio
import logging
from pathlib import Path

from config import ASSETS_DIR

logger = logging.getLogger(__name__)

SFX_DIR = ASSETS_DIR / "sfx"
TITLE_IN_PATH = SFX_DIR / "title_in.wav"
TITLE_OUT_PATH = SFX_DIR / "title_out.wav"


async def _generate_tone(output_path: Path, frequencies: list[tuple[float, float]], duration: float = 0.15) -> None:
    """Generate a short multi-tone sound effect.

    Each entry in frequencies is (freq_hz, tone_duration).
    The result is normalized and faded.
    """
    filter_parts = []
    for i, (freq, dur) in enumerate(frequencies):
        # Generate sine tone with quick fade in/out for smoothness
        filter_parts.append(
            f"sine=frequency={freq}:duration={dur}:sample_rate=48000,"
            f"afade=t=in:st=0:d=0.01,afade=t=out:st={dur - 0.02}:d=0.02[t{i}]"
        )

    # Concatenate tones
    labels = "".join(f"[t{i}]" for i in range(len(frequencies)))
    filter_parts.append(f"{labels}concat=n={len(frequencies)}:v=0:a=1[out]")

    filter_complex = ";".join(filter_parts)

    cmd = [
        "ffmpeg", "-y",
        "-filter_complex", filter_complex,
        "-map", "[out]",
        "-ac", "1", "-ar", "48000",
        str(output_path),
    ]
    proc = await asyncio.create_subprocess_exec(
        *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(f"SFX generation failed: {stderr.decode()[-300:]}")


async def ensure_title_sfx() -> tuple[str, str]:
    """Ensure title in/out SFX files exist, generating them if needed.

    Returns (title_in_path, title_out_path).
    """
    SFX_DIR.mkdir(parents=True, exist_ok=True)

    if not TITLE_IN_PATH.exists():
        logger.info("Generating title-in SFX: %s", TITLE_IN_PATH)
        # Rising two-tone "boop" — like a subtle text message notification
        await _generate_tone(TITLE_IN_PATH, [
            (880, 0.06),   # A5
            (1320, 0.08),  # E6
        ])

    if not TITLE_OUT_PATH.exists():
        logger.info("Generating title-out SFX: %s", TITLE_OUT_PATH)
        # Falling two-tone — subtle dismiss sound
        await _generate_tone(TITLE_OUT_PATH, [
            (1320, 0.06),  # E6
            (880, 0.08),   # A5
        ])

    return str(TITLE_IN_PATH), str(TITLE_OUT_PATH)
