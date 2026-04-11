import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Timeline as TimelineEditor, type TimelineState } from "@xzdarcy/react-timeline-editor";
import "@xzdarcy/react-timeline-editor/dist/react-timeline-editor.css";
import { useTimelineStore } from "../stores/timelineStore";
import { toEditorData, timelineSecondsToFrame, type VideoAction, type MusicAction, type TitleAction } from "../lib/remotion";

const effects = {
  video: {
    id: "video",
    name: "Video",
  },
  music: {
    id: "music",
    name: "Music",
  },
  title: {
    id: "title",
    name: "Title",
  },
};

const SCALE = 5; // seconds per tick
const MIN_SCALE_WIDTH = 20;
const MAX_SCALE_WIDTH = 500;
const DEFAULT_SCALE_WIDTH = 160;

export function Timeline() {
  const {
    project, timelineItems, musicItems, playerRef,
    setMusicItems, setVolumeEnvelope, musicLoading, setMusicLoading,
    titleItems, setTitleItems, titleLoading, setTitleLoading, updateTitleItem,
  } = useTimelineStore();
  const timelineRef = useRef<TimelineState>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const syncingFromPlayer = useRef(false);
  const [scaleWidth, setScaleWidth] = useState(DEFAULT_SCALE_WIDTH);
  const [autoFit, setAutoFit] = useState(true);

  const [editingTitleId, setEditingTitleId] = useState<number | null>(null);
  const [editingTitleText, setEditingTitleText] = useState("");

  const { rows, totalDuration } = useMemo(
    () => toEditorData(timelineItems, musicItems, titleItems),
    [timelineItems, musicItems, titleItems]
  );

  // Auto-fit: calculate scaleWidth so all clips fit in the container
  useEffect(() => {
    if (!autoFit || totalDuration === 0 || !wrapperRef.current) return;
    const containerWidth = wrapperRef.current.clientWidth - 40; // padding
    const numTicks = totalDuration / SCALE;
    if (numTicks > 0) {
      const fitted = Math.max(MIN_SCALE_WIDTH, Math.min(MAX_SCALE_WIDTH, containerWidth / numTicks));
      setScaleWidth(fitted);
    }
  }, [autoFit, totalDuration]);

  // Option + scroll wheel to zoom
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (!e.altKey) return;
      e.preventDefault();
      setAutoFit(false);
      setScaleWidth((prev) => {
        const delta = e.deltaY > 0 ? -10 : 10;
        return Math.max(MIN_SCALE_WIDTH, Math.min(MAX_SCALE_WIDTH, prev + delta));
      });
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  // Sync Remotion Player frame -> timeline cursor
  useEffect(() => {
    const player = playerRef?.current;
    if (!player) return;

    const handler = () => {
      if (syncingFromPlayer.current) return;
      const frame = player.getCurrentFrame();
      let cursor = 0;
      let frameCursor = 0;
      for (const item of timelineItems) {
        if (item.duration < 0.034) continue;
        const frames = Math.max(Math.round(item.duration * 30), 1);
        if (frame < frameCursor + frames) {
          const offset = (frame - frameCursor) / 30;
          const time = cursor + offset;
          timelineRef.current?.setTime(time);
          return;
        }
        cursor += item.duration;
        frameCursor += frames;
      }
      timelineRef.current?.setTime(cursor);
    };

    player.addEventListener("frameupdate", handler);
    return () => player.removeEventListener("frameupdate", handler);
  }, [playerRef, timelineItems]);

  const handleCursorDrag = useCallback((time: number) => {
    syncingFromPlayer.current = true;
    const frame = timelineSecondsToFrame(time, timelineItems);
    playerRef?.current?.seekTo(frame);
    requestAnimationFrame(() => {
      syncingFromPlayer.current = false;
    });
  }, [playerRef, timelineItems]);

  const handleClickTimeArea = useCallback((time: number) => {
    handleCursorDrag(time);
    return true;
  }, [handleCursorDrag]);

  const handleAddMusic = async () => {
    if (!project) return;
    setMusicLoading(true);
    try {
      const res = await fetch(`/api/music/${project.id}/auto`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setMusicItems(data.items);
        setVolumeEnvelope(data.volume_envelope);
      }
    } finally {
      setMusicLoading(false);
    }
  };

  const handleClearMusic = async () => {
    if (!project) return;
    await fetch(`/api/music/${project.id}`, { method: "DELETE" });
    setMusicItems([]);
    setVolumeEnvelope([]);
  };

  const handleAddTitles = async () => {
    if (!project) return;
    setTitleLoading(true);
    try {
      const res = await fetch(`/api/titles/${project.id}/auto`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setTitleItems(data.items);
      }
    } finally {
      setTitleLoading(false);
    }
  };

  const handleClearTitles = async () => {
    if (!project) return;
    await fetch(`/api/titles/${project.id}`, { method: "DELETE" });
    setTitleItems([]);
  };

  const handleSaveTitle = async (titleId: number, text: string) => {
    if (!project) return;
    updateTitleItem(titleId, { text });
    setEditingTitleId(null);
    await fetch(`/api/titles/${project.id}/items/${titleId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  };

  if (!project) return null;

  return (
    <div className="timeline-container">
      <div className="timeline-header">
        <h3>Timeline</h3>
        <div className="timeline-controls">
          <label className="timeline-autofit">
            <input
              type="checkbox"
              checked={autoFit}
              onChange={(e) => {
                setAutoFit(e.target.checked);
                if (e.target.checked && totalDuration > 0 && wrapperRef.current) {
                  const containerWidth = wrapperRef.current.clientWidth - 40;
                  const numTicks = totalDuration / SCALE;
                  if (numTicks > 0) {
                    setScaleWidth(Math.max(MIN_SCALE_WIDTH, Math.min(MAX_SCALE_WIDTH, containerWidth / numTicks)));
                  }
                }
              }}
            />
            Fit all
          </label>
          <span className="timeline-duration">{totalDuration.toFixed(1)}s</span>
          <div className="music-controls">
            <button
              className="btn btn-sm"
              onClick={handleAddMusic}
              disabled={musicLoading || timelineItems.length === 0}
            >
              {musicLoading ? "Adding..." : "Add Music"}
            </button>
            {musicItems.length > 0 && (
              <>
                <button className="btn btn-sm btn-ghost" onClick={handleClearMusic}>
                  Clear Music
                </button>
                <span className="music-info">
                  {musicItems.length} song{musicItems.length !== 1 ? "s" : ""}
                </span>
              </>
            )}
          </div>
          <div className="title-controls">
            <button
              className="btn btn-sm"
              onClick={handleAddTitles}
              disabled={titleLoading || timelineItems.length === 0}
            >
              {titleLoading ? "Adding..." : "Add Titles"}
            </button>
            {titleItems.length > 0 && (
              <>
                <button className="btn btn-sm btn-ghost" onClick={handleClearTitles}>
                  Clear Titles
                </button>
                <span className="title-info">
                  {titleItems.length} title{titleItems.length !== 1 ? "s" : ""}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      {rows[0]?.actions.length === 0 ? (
        <p className="timeline-empty">Timeline is empty. Process some clips to get started.</p>
      ) : (
        <div className="timeline-editor-wrapper" ref={wrapperRef}>
          <TimelineEditor
            ref={timelineRef}
            editorData={rows}
            effects={effects}
            scale={SCALE}
            scaleWidth={scaleWidth}
            rowHeight={50}
            style={{ height: 52 + rows.length * 50 }}
            hideCursor={false}
            autoScroll={true}
            autoReRender={false}
            onCursorDrag={handleCursorDrag}
            onClickTimeArea={handleClickTimeArea}
            getActionRender={(action) => {
              if (action.effectId === "title") {
                const t = action as unknown as TitleAction;
                if (editingTitleId === t.titleId) {
                  return (
                    <div className="tl-action-render title editing">
                      <input
                        className="title-edit-input"
                        autoFocus
                        value={editingTitleText}
                        onChange={(e) => setEditingTitleText(e.target.value)}
                        onBlur={() => handleSaveTitle(t.titleId, editingTitleText)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveTitle(t.titleId, editingTitleText);
                          if (e.key === "Escape") setEditingTitleId(null);
                        }}
                      />
                    </div>
                  );
                }
                return (
                  <div
                    className="tl-action-render title"
                    title="Double-click to edit"
                    onDoubleClick={() => {
                      setEditingTitleId(t.titleId);
                      setEditingTitleText(t.titleText);
                    }}
                  >
                    <span className="tl-action-label">{t.titleText}</span>
                  </div>
                );
              }
              if (action.effectId === "music") {
                const m = action as MusicAction;
                return (
                  <div className="tl-action-render music" title={m.assetName}>
                    <span className="tl-action-label">{m.assetName}</span>
                    <span className="tl-action-dur">
                      {(m.end - m.start).toFixed(1)}s
                    </span>
                  </div>
                );
              }
              const a = action as VideoAction;
              const isBroll = a.clipType === "broll";
              return (
                <div
                  className={`tl-action-render ${isBroll ? "broll" : "talking"}`}
                  title={a.label}
                >
                  <span className="tl-action-label">{a.label}</span>
                  <span className="tl-action-dur">
                    {(a.end - a.start).toFixed(1)}s
                  </span>
                </div>
              );
            }}
          />
        </div>
      )}
    </div>
  );
}
