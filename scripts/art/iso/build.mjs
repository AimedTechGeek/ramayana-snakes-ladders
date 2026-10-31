// node build.mjs (npm run art:iso, through tsx): writes the Hanuman sheet `hanuman-s` (61 frames) under public/assets/iso and the
// T40 standalone figurine SVG sources under art-src/iso/. raster.mjs turns those into public/assets/iso/fig/*.png and
// figurines.json. The board itself is built by blocks.mjs, props.mjs, frame.mjs, snakes/ and bridges/ (T42);
// `npm run art:all` chains every builder.
//   --audit        anatomy audit on the key frames (exit 1 on any problem)
//   --svg <dir>    also write the 61 frame SVGs (for the line check and review)
//   FIG_ONLY=a,b   only those frames (names as in the sheet); no sheet or legacy files are written
import { buildLegacy, buildSheet, renderSheetFrames } from './figurines/index.mjs';

const { frames, failed } = renderSheetFrames();
if (failed) process.exitCode = 1;
if (!process.env.FIG_ONLY) {
  const sheet = await buildSheet(frames, 'public/assets/iso');
  const mb = (sheet.width * sheet.height * 4) / 1048576;
  console.log(
    `wrote ${sheet.png} ${sheet.width}x${sheet.height} (${frames.length} frames, ${mb.toFixed(1)} MB uncompressed)`,
  );
  buildLegacy('art-src/iso'); // sources, not shipped
}
