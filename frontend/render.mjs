import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const [,, propsJsonPath, outputPath] = process.argv;

if (!propsJsonPath || !outputPath) {
  console.error("Usage: node render.mjs <props.json> <output.mp4>");
  process.exit(1);
}

function elapsed(start) {
  return ((performance.now() - start) / 1000).toFixed(1) + "s";
}

const totalStart = performance.now();
const props = JSON.parse(readFileSync(propsJsonPath, "utf-8"));

// Log the URLs that will be used
console.error("=== INPUT PROPS ===");
console.error(`  clips: ${props.items?.length}, music: ${props.musicItems?.length}, titles: ${props.titleItems?.length}`);
console.error(`  captions: ${props.captionItems?.length}, timestamps: ${props.timestampItems?.length}`);
console.error(`  durationInFrames: ${props.durationInFrames} (${(props.durationInFrames / 30).toFixed(1)}s)`);
console.error(`  baseUrl: ${props.baseUrl}`);
console.error(`  first video src: ${props.baseUrl}${props.items?.[0]?.video_url?.substring(0, 80)}`);
console.error("===================");

// Step 1: Bundle
let stepStart = performance.now();
console.error(`[bundle] Starting...`);
const bundled = await bundle({
  entryPoint: path.join(__dirname, "src/remotion/index.tsx"),
  webpackOverride: (config) => config,
});
console.error(`[bundle] Done in ${elapsed(stepStart)}`);

// Step 2: Select composition
stepStart = performance.now();
console.error(`[select] Selecting composition...`);
const composition = await selectComposition({
  serveUrl: bundled,
  id: "Timeline",
  inputProps: props,
  timeoutInMilliseconds: 120000,
});
console.error(`[select] Done in ${elapsed(stepStart)}`);

// Step 3: Render
stepStart = performance.now();
console.error(`[render] Starting ${props.durationInFrames} frames with concurrency=2...`);

let lastLoggedPct = -1;
let lastLogTime = performance.now();

await renderMedia({
  composition: {
    ...composition,
    durationInFrames: props.durationInFrames,
    fps: 30,
    width: 1920,
    height: 1080,
  },
  serveUrl: bundled,
  codec: "h264",
  outputLocation: outputPath,
  inputProps: props,
  timeoutInMilliseconds: 240000,
  concurrency: 2,
  logLevel: "verbose",
  chromiumOptions: {
    disableWebSecurity: true,
  },
  onProgress: ({ progress, renderedFrames, renderedDoneIn, encodedFrames, encodedDoneIn, stitchStage }) => {
    const pct = Math.round(progress * 100);
    // Write JSON for Python to read
    process.stdout.write(JSON.stringify({ percent: pct }) + "\n");

    // Log every 5% or every 30s
    const now = performance.now();
    if (pct >= lastLoggedPct + 5 || (now - lastLogTime > 30000 && pct > lastLoggedPct)) {
      const rate = renderedFrames > 0 ? (renderedFrames / ((now - stepStart) / 1000)).toFixed(1) : "?";
      console.error(`[render] ${pct}% | ${renderedFrames}/${props.durationInFrames} frames rendered | ${rate} fps | ${elapsed(stepStart)} elapsed | stitch: ${stitchStage || "n/a"}`);
      lastLoggedPct = pct;
      lastLogTime = now;
    }
  },
  onDownload: (src) => {
    const short = src.length > 100 ? src.substring(0, 100) + "..." : src;
    console.error(`[download] Starting: ${short}`);
    return ({ percent, downloaded, totalSize }) => {
      if (percent !== null && percent % 25 === 0 && percent > 0) {
        console.error(`[download] ${percent}% (${(downloaded / 1024 / 1024).toFixed(1)}MB / ${totalSize ? (totalSize / 1024 / 1024).toFixed(1) + "MB" : "?"})`);
      }
    };
  },
});

console.error(`[render] Done in ${elapsed(stepStart)}`);
console.error(`[total] Entire render took ${elapsed(totalStart)}`);
