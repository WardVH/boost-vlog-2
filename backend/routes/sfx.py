import asyncio

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path

from services.sfx_generator import ensure_title_sfx, TITLE_IN_PATH, TITLE_OUT_PATH

router = APIRouter()


@router.get("/title-in")
async def get_title_in_sfx():
    await ensure_title_sfx()
    if not TITLE_IN_PATH.exists():
        raise HTTPException(500, "Failed to generate title-in SFX")
    return FileResponse(str(TITLE_IN_PATH), media_type="audio/wav")


@router.get("/title-out")
async def get_title_out_sfx():
    await ensure_title_sfx()
    if not TITLE_OUT_PATH.exists():
        raise HTTPException(500, "Failed to generate title-out SFX")
    return FileResponse(str(TITLE_OUT_PATH), media_type="audio/wav")
