// node build.mjs (npm run art:iso, through tsx): writes the figurine SVG sources under art-src/iso/. raster.mjs turns them
// into public/assets/iso/fig/*.png and figurines.json. The board itself is built by blocks.mjs, props.mjs, frame.mjs,
// snakes/ and bridges/ (T42); `npm run art:all` chains every builder.
import { buildFigurines } from './figurines/index.mjs';

buildFigurines('art-src/iso'); // sources, not shipped
