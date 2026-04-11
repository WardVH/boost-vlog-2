import { useState } from "react";
import { useTimelineStore } from "../stores/timelineStore";

export function TitleSuggestions() {
  const project = useTimelineStore((s) => s.project);
  const clips = useTimelineStore((s) => s.clips);
  const selectedTitle = useTimelineStore((s) => s.selectedTitle);
  const setSelectedTitle = useTimelineStore((s) => s.setSelectedTitle);

  const [titles, setTitles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [customTitle, setCustomTitle] = useState(selectedTitle || "");

  const hasTranscripts = clips.some((c) => c.transcript);

  const generate = async () => {
    if (!project) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${project.id}/generate-titles`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to generate titles");
      }
      const data = await res.json();
      setTitles(data.titles);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!hasTranscripts) return null;

  return (
    <div className="title-suggestions">
      <div className="title-suggestions-header">
        <h3>Title Suggestions</h3>
        <button
          className="btn btn-primary"
          onClick={generate}
          disabled={loading}
        >
          {loading ? "Generating..." : titles.length ? "Regenerate" : "Generate Titles"}
        </button>
      </div>
      <div className="custom-title-row">
        <input
          type="text"
          className="custom-title-input"
          placeholder="Or type your own title..."
          value={customTitle}
          onChange={(e) => setCustomTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && customTitle.trim()) {
              setSelectedTitle(customTitle.trim());
            }
          }}
        />
        <button
          className="btn btn-ghost"
          disabled={!customTitle.trim()}
          onClick={() => setSelectedTitle(customTitle.trim())}
        >
          Use
        </button>
      </div>
      {error && <span className="error">{error}</span>}
      {titles.length > 0 && (
        <div className="title-list">
          {titles.map((title, i) => (
            <div
              key={i}
              className={`title-item ${selectedTitle === title ? "selected" : ""}`}
              onClick={() => setSelectedTitle(title)}
            >
              {title}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
