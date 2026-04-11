import { useEffect, useRef, useState } from "react";
import { useTimelineStore } from "../stores/timelineStore";

export function YouTubeUpload() {
  const project = useTimelineStore((s) => s.project);
  const selectedTitle = useTimelineStore((s) => s.selectedTitle);
  const description = useTimelineStore((s) => s.videoDescription);
  const tags = useTimelineStore((s) => s.videoTags);
  const category = useTimelineStore((s) => s.videoCategory);
  const visibility = useTimelineStore((s) => s.videoVisibility);
  const thumbnailIndices = useTimelineStore((s) => s.selectedThumbnailIndices);
  const renderStage = useTimelineStore((s) => s.renderStage);

  const auth = useTimelineStore((s) => s.youtubeAuth);
  const setAuth = useTimelineStore((s) => s.setYoutubeAuth);
  const uploadProgress = useTimelineStore((s) => s.youtubeUploadProgress);
  const setUploadProgress = useTimelineStore((s) => s.setYoutubeUploadProgress);
  const uploadResult = useTimelineStore((s) => s.youtubeUploadResult);
  const setUploadResult = useTimelineStore((s) => s.setYoutubeUploadResult);
  const uploadError = useTimelineStore((s) => s.youtubeUploadError);
  const setUploadError = useTimelineStore((s) => s.setYoutubeUploadError);

  const thumbnailUrls = useTimelineStore((s) => s.thumbnailUrls);

  const [connecting, setConnecting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const CATEGORY_LABELS: Record<string, string> = {
    "1": "Film & Animation", "2": "Autos & Vehicles", "10": "Music",
    "15": "Pets & Animals", "17": "Sports", "20": "Gaming",
    "22": "People & Blogs", "23": "Comedy", "24": "Entertainment",
    "25": "News & Politics", "26": "Howto & Style", "27": "Education",
    "28": "Science & Technology",
  };

  // Check auth status on mount
  useEffect(() => {
    checkAuth();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch("/api/youtube/status");
      if (res.ok) {
        const data = await res.json();
        setAuth({
          authenticated: data.authenticated,
          channelName: data.channel_name,
        });
      }
    } catch {}
  };

  const connect = async () => {
    setConnecting(true);
    try {
      const res = await fetch("/api/youtube/auth");
      if (!res.ok) throw new Error("Failed to start auth");
      const data = await res.json();

      // Open OAuth popup
      window.open(data.auth_url, "_blank", "width=600,height=700");

      // Poll for auth completion
      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch("/api/youtube/status");
          if (statusRes.ok) {
            const status = await statusRes.json();
            if (status.authenticated) {
              if (pollRef.current) clearInterval(pollRef.current);
              pollRef.current = null;
              setAuth({
                authenticated: true,
                channelName: status.channel_name,
              });
              setConnecting(false);
            }
          }
        } catch {}
      }, 2000);

      // Stop polling after 5 minutes
      setTimeout(() => {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setConnecting(false);
        }
      }, 300000);
    } catch {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    await fetch("/api/youtube/disconnect", { method: "POST" });
    setAuth({ authenticated: false, channelName: null });
  };

  const upload = async () => {
    if (!project || !selectedTitle) return;
    setUploading(true);
    setUploadProgress(null);
    setUploadResult(null);
    setUploadError(null);
    try {
      const res = await fetch(`/api/youtube/upload/${project.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: selectedTitle,
          description,
          tags,
          category_id: category,
          privacy_status: visibility,
          thumbnail_index: thumbnailIndices[0] ?? null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Upload failed");
      }
      // Progress comes via WebSocket
    } catch (e: any) {
      setUploadError(e.message);
      setUploading(false);
    }
  };

  // Reset uploading state when done or error
  useEffect(() => {
    if (uploadResult || uploadError) {
      setUploading(false);
    }
  }, [uploadResult, uploadError]);

  const hasRender = renderStage === "done" || !!project?.render_path;

  const canUpload =
    auth.authenticated &&
    hasRender &&
    selectedTitle &&
    !uploading &&
    !uploadResult;

  if (!selectedTitle) return null;

  return (
    <div className="youtube-upload">
      <h3>Publish</h3>

      {/* Auth Section */}
      <div className="youtube-auth">
        {auth.authenticated ? (
          <div className="youtube-connected">
            <span className="youtube-channel">
              <span className="youtube-dot connected" />
              Connected as <strong>{auth.channelName}</strong>
            </span>
            <button className="btn btn-ghost btn-sm" onClick={disconnect}>
              Disconnect
            </button>
          </div>
        ) : (
          <button
            className="btn btn-primary"
            onClick={connect}
            disabled={connecting}
          >
            {connecting ? "Waiting for authorization..." : "Connect YouTube"}
          </button>
        )}
      </div>

      {/* Upload Section */}
      {auth.authenticated && (
        <div className="youtube-upload-section">
          {!hasRender ? (
            <p className="youtube-hint">Export your video first before publishing.</p>
          ) : (
            <>
              <button
                className="btn btn-primary youtube-upload-btn"
                onClick={() => setShowConfirm(true)}
                disabled={!canUpload}
              >
                {uploading ? "Publishing..." : "Publish to YouTube"}
              </button>

              {uploadProgress !== null && !uploadResult && (
                <div className="youtube-progress">
                  <div className="render-bar-bg">
                    <div
                      className="render-bar-fill"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <span className="render-status">{uploadProgress}% uploaded</span>
                </div>
              )}

              {uploadResult && (
                <div className="youtube-success">
                  <span>Published!</span>
                  <a
                    href={uploadResult.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="youtube-link"
                  >
                    {uploadResult.videoUrl}
                  </a>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => navigator.clipboard.writeText(uploadResult.videoUrl)}
                  >
                    Copy Link
                  </button>
                </div>
              )}

              {uploadError && (
                <div className="youtube-error">
                  <span className="error">{uploadError}</span>
                  <button className="btn btn-ghost btn-sm" onClick={upload}>
                    Retry
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Confirm Publish to YouTube</h3>

            <div className="modal-field">
              <video
                className="modal-video-preview"
                src={`/api/render/${project!.id}/download`}
                controls
              />
            </div>

            <div className="modal-field">
              <label>Title</label>
              <p>{selectedTitle}</p>
            </div>

            {thumbnailIndices.length > 0 && (
              <div className="modal-field">
                <label>Thumbnail</label>
                <div className="modal-thumbnails">
                  {thumbnailIndices.map((idx) =>
                    thumbnailUrls[idx] ? (
                      <img
                        key={idx}
                        src={thumbnailUrls[idx]}
                        alt={`Thumbnail ${idx + 1}`}
                        className="modal-thumbnail"
                      />
                    ) : null
                  )}
                </div>
              </div>
            )}

            <div className="modal-field">
              <label>Description</label>
              <p className="modal-description">{description || "(none)"}</p>
            </div>

            <div className="modal-field">
              <label>Tags</label>
              <p>{tags.length ? tags.join(", ") : "(none)"}</p>
            </div>

            <div className="modal-row">
              <div className="modal-field">
                <label>Category</label>
                <p>{CATEGORY_LABELS[category] || category}</p>
              </div>
              <div className="modal-field">
                <label>Visibility</label>
                <p>{visibility.charAt(0).toUpperCase() + visibility.slice(1)}</p>
              </div>
            </div>

            <div className="modal-field">
              <label>Channel</label>
              <p>{auth.channelName}</p>
            </div>

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowConfirm(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setShowConfirm(false);
                  upload();
                }}
              >
                Publish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
