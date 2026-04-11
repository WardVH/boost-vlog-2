import { useEffect, useRef, useState } from "react";
import { useTimelineStore } from "../stores/timelineStore";

export function ThumbnailGenerator() {
  const project = useTimelineStore((s) => s.project);
  const selectedTitle = useTimelineStore((s) => s.selectedTitle);

  const thumbnailText = useTimelineStore((s) => s.thumbnailText);
  const setThumbnailText = useTimelineStore((s) => s.setThumbnailText);
  const thumbnailUrls = useTimelineStore((s) => s.thumbnailUrls);
  const setThumbnailUrls = useTimelineStore((s) => s.setThumbnailUrls);
  const selectedIndices = useTimelineStore((s) => s.selectedThumbnailIndices);
  const setSelectedIndices = useTimelineStore((s) => s.setSelectedThumbnailIndices);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const prevTitleRef = useRef<string | null>(null);
  const isFirstMount = useRef(true);

  // Sync thumbnail text when a new title is selected (not on restore)
  const [lastTitle, setLastTitle] = useState<string | null>(null);
  if (selectedTitle && selectedTitle !== lastTitle) {
    if (!isFirstMount.current) {
      setThumbnailText(selectedTitle);
    }
    setLastTitle(selectedTitle);
  }

  const selectedSet = new Set(selectedIndices);

  const toggleSelect = (idx: number) => {
    if (selectedSet.has(idx)) {
      setSelectedIndices([]);
    } else {
      setSelectedIndices([idx]);
    }
  };

  const doGenerate = async (title: string) => {
    if (!project || !title.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${project.id}/generate-thumbnails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), skip_indices: [] }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to generate thumbnails");
      }
      const data = await res.json();
      const t = Date.now();
      setThumbnailUrls(data.thumbnail_urls.map((u: string) => u + "?t=" + t));
      setSelectedIndices([]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const regenerate = async () => {
    if (!project || !thumbnailText.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${project.id}/generate-thumbnails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: thumbnailText.trim(),
          skip_indices: selectedIndices,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to generate thumbnails");
      }
      const data = await res.json();
      const t = Date.now();
      setThumbnailUrls(
        data.thumbnail_urls.map((u: string, i: number) =>
          selectedSet.has(i)
            ? (thumbnailUrls[i] || u + "?t=" + t)
            : u + "?t=" + t
        )
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Auto-generate when title is selected (skip on restore)
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      prevTitleRef.current = selectedTitle;
      return;
    }
    if (!selectedTitle || selectedTitle === prevTitleRef.current) return;
    prevTitleRef.current = selectedTitle;
    doGenerate(selectedTitle);
  }, [selectedTitle, project]);

  if (!selectedTitle) return null;

  return (
    <div className="thumbnail-generator">
      <div className="thumbnail-generator-header">
        <h3>Thumbnails</h3>
        <span className="thumbnail-count">{selectedIndices.length ? "1 selected" : "None selected"}</span>
        <button
          className="btn btn-primary"
          onClick={regenerate}
          disabled={loading || !thumbnailText.trim()}
        >
          {loading ? "Generating..." : thumbnailUrls.length ? "Regenerate" : "Generate Thumbnails"}
        </button>
      </div>
      <div className="thumbnail-text-edit">
        <label>Thumbnail text</label>
        <input
          type="text"
          className="custom-title-input"
          value={thumbnailText}
          onChange={(e) => setThumbnailText(e.target.value)}
          placeholder="Text to display on thumbnail..."
        />
      </div>
      {error && <span className="error">{error}</span>}
      {thumbnailUrls.length > 0 && (
        <div className="thumbnail-grid">
          {thumbnailUrls.map((url, i) => {
            const isSelected = selectedSet.has(i);
            return (
              <div
                key={i}
                className={`thumbnail-preview ${isSelected ? "selected" : ""}`}
                onClick={() => toggleSelect(i)}
              >
                <img src={url} alt={`Thumbnail option ${i + 1}`} />
                <div className={`thumbnail-checkbox ${isSelected ? "checked" : ""}`}>
                  {isSelected && (
                    <>
                      <span className="thumbnail-check-icon">{"\u2713"}</span>
                      <span className="thumbnail-lock-icon">{"\u{1F512}"}</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
