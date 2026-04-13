import React from "react";
import { registerRoot, Composition } from "remotion";
import { TimelineComposition } from "../components/TimelineComposition";
import { FPS } from "../lib/remotion";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Comp = TimelineComposition as React.FC<any>;

const RemotionRoot: React.FC = () => (
  <Composition
    id="Timeline"
    component={Comp}
    fps={FPS}
    width={1920}
    height={1080}
    durationInFrames={1}
    defaultProps={{ items: [] }}
  />
);

registerRoot(RemotionRoot);
