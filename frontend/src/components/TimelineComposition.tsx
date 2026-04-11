import React, { useCallback, useMemo } from "react";
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, useCurrentFrame } from "remotion";
import { secondsToFrames, interpolateEnvelope, FPS } from "../lib/remotion";
import { useTimelineStore } from "../stores/timelineStore";
import type { TimelineItem } from "../types";

const PREMOUNT_FRAMES = 30;
const BROLL_AUDIO_VOLUME = 0.15;

interface Props {
  items: TimelineItem[];
}

interface ClipLayout {
  item: TimelineItem;
  startFrame: number;
  durationInFrames: number;
}

export const TimelineComposition: React.FC<Props> = React.memo(({ items }) => {
  const frame = useCurrentFrame();
  const musicItems = useTimelineStore((s) => s.musicItems);
  const hasMusic = musicItems.length > 0;

  const layout = useMemo(() => {
    let cursor = 0;
    const result: ClipLayout[] = [];
    for (const item of items) {
      if (item.duration < 0.034) continue;
      const dur = Math.max(secondsToFrames(item.duration), 1);
      result.push({ item, startFrame: cursor, durationInFrames: dur });
      cursor += dur;
    }
    return result;
  }, [items]);

  let activeIdx = -1;
  for (let i = 0; i < layout.length; i++) {
    const clip = layout[i];
    if (frame >= clip.startFrame && frame < clip.startFrame + clip.durationInFrames) {
      activeIdx = i;
      break;
    }
  }
  if (activeIdx === -1 && layout.length > 0) {
    activeIdx = layout.length - 1;
  }

  const toMount = [activeIdx - 1, activeIdx, activeIdx + 1].filter(
    (i) => i >= 0 && i < layout.length
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <MusicLayer />
      {toMount.map((i) => {
        const clip = layout[i];
        const videoStartFrame = secondsToFrames(clip.item.start_time);

        return (
          <Sequence
            key={`${clip.item.id}-${clip.item.position}`}
            from={clip.startFrame}
            durationInFrames={clip.durationInFrames}
            premountFor={PREMOUNT_FRAMES}
          >
            <AbsoluteFill>
              <OffthreadVideo
                src={clip.item.video_url}
                startFrom={videoStartFrame}
                endAt={videoStartFrame + clip.durationInFrames}
                pauseWhenBuffering
                volume={hasMusic && clip.item.clip_type === "broll" ? BROLL_AUDIO_VOLUME : 1}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            </AbsoluteFill>
          </Sequence>
        );
      })}
      <TitleLayer />
      <CaptionLayer />
      <TimestampLayer />
    </AbsoluteFill>
  );
});

const TitleOverlay: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const opacity = Math.min(frame / 10, 1);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: "8%",
      }}
    >
      <div
        style={{
          color: "white",
          fontSize: 72,
          fontFamily: "'Inter', sans-serif",
          fontWeight: 800,
          letterSpacing: "-0.04em",
          textShadow: "0 0 20px rgba(0,0,0,0.9), 0 0 40px rgba(0,0,0,0.6), 0 2px 6px rgba(0,0,0,0.8)",
          opacity,
          textAlign: "center",
          padding: "12px 24px",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

const TITLE_SFX_VOLUME = 0.5;
const TITLE_SFX_DURATION_FRAMES = Math.round(0.15 * FPS); // ~5 frames

const TitleLayer: React.FC = () => {
  const titleItems = useTimelineStore((s) => s.titleItems);

  return (
    <>
      {titleItems.map((ti) => {
        const startFrame = secondsToFrames(ti.start_time);
        const durationInFrames = secondsToFrames(ti.end_time - ti.start_time);
        if (durationInFrames <= 0) return null;

        const endFrame = startFrame + durationInFrames;

        return (
          <React.Fragment key={`title-${ti.id}`}>
            <Sequence from={startFrame} durationInFrames={durationInFrames}>
              <TitleOverlay text={ti.text} />
            </Sequence>
            {/* Title in SFX */}
            <Sequence from={startFrame} durationInFrames={TITLE_SFX_DURATION_FRAMES}>
              <Audio src="/api/sfx/title-in" volume={TITLE_SFX_VOLUME} />
            </Sequence>
            {/* Title out SFX */}
            <Sequence from={endFrame} durationInFrames={TITLE_SFX_DURATION_FRAMES}>
              <Audio src="/api/sfx/title-out" volume={TITLE_SFX_VOLUME} />
            </Sequence>
          </React.Fragment>
        );
      })}
    </>
  );
};

const CaptionOverlay: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const opacity = Math.min(frame / 5, 1);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: "3%",
      }}
    >
      <div
        style={{
          color: "white",
          fontSize: 36,
          fontFamily: "'Inter', sans-serif",
          fontWeight: 600,
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          padding: "8px 20px",
          borderRadius: 6,
          opacity,
          textAlign: "center",
          maxWidth: "80%",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

const CaptionLayer: React.FC = () => {
  const captionItems = useTimelineStore((s) => s.captionItems);

  return (
    <>
      {captionItems.map((ci) => {
        const startFrame = secondsToFrames(ci.start_time);
        const durationInFrames = secondsToFrames(ci.end_time - ci.start_time);
        if (durationInFrames <= 0) return null;

        return (
          <Sequence
            key={`caption-${ci.id}`}
            from={startFrame}
            durationInFrames={durationInFrames}
          >
            <CaptionOverlay text={ci.text} />
          </Sequence>
        );
      })}
    </>
  );
};

const TimestampOverlay: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const opacity = Math.min(frame / 10, 1);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-start",
        alignItems: "flex-start",
        padding: "4% 4%",
      }}
    >
      <div
        style={{
          color: "white",
          fontSize: 36,
          fontFamily: "'Inter', sans-serif",
          fontWeight: 600,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          padding: "8px 18px",
          borderRadius: 8,
          opacity,
          letterSpacing: "0.02em",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

const TimestampLayer: React.FC = () => {
  const timestampItems = useTimelineStore((s) => s.timestampItems);

  return (
    <>
      {timestampItems.map((ts) => {
        const startFrame = secondsToFrames(ts.start_time);
        const durationInFrames = secondsToFrames(ts.end_time - ts.start_time);
        if (durationInFrames <= 0) return null;

        return (
          <Sequence
            key={`timestamp-${ts.id}`}
            from={startFrame}
            durationInFrames={durationInFrames}
          >
            <TimestampOverlay text={ts.text} />
          </Sequence>
        );
      })}
    </>
  );
};

const MusicLayer: React.FC = () => {
  const musicItems = useTimelineStore((s) => s.musicItems);
  const volumeEnvelope = useTimelineStore((s) => s.volumeEnvelope);

  const makeVolumeCallback = useCallback(
    (musicStartTime: number) => {
      return (frame: number) => {
        const timeInMusic = frame / FPS;
        const timelineTime = musicStartTime + timeInMusic;
        return interpolateEnvelope(volumeEnvelope, timelineTime);
      };
    },
    [volumeEnvelope],
  );

  return (
    <>
      {musicItems.map((mi) => {
        const startFrame = secondsToFrames(mi.start_time);
        const durationInFrames = secondsToFrames(mi.end_time - mi.start_time);
        if (durationInFrames <= 0) return null;

        return (
          <Sequence
            key={`music-${mi.id}`}
            from={startFrame}
            durationInFrames={durationInFrames}
          >
            <Audio
              src={`/api/assets/${mi.asset_id}/file`}
              volume={makeVolumeCallback(mi.start_time)}
            />
          </Sequence>
        );
      })}
    </>
  );
};
