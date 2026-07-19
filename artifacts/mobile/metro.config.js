const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// ─── Web: stub CSS imports ────────────────────────────────────────────────────
// @rnmapbox/maps pulls in `mapbox-gl/dist/mapbox-gl.css` when Metro targets
// web. Metro cannot resolve CSS as a JS module, so we intercept every .css
// request on web and return an empty virtual module instead.
const originalResolver = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName.endsWith('.css')) {
    return { type: 'empty' };
  }
  if (originalResolver) {
    return originalResolver(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
