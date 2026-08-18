# Changelog

## 4.5.0

### Added

- AI expression-control setup section in the settings panel.
- One-click **Copy expression instructions** helper with a concise WhiteDragon marker prompt.
- One-click **Copy test prompt** helper for checking multi-expression switching.
- **Copy avatar generation prompt** beside avatar import for creating a 10-expression set from a user's own character reference image.
- Token/usage disclosure explaining that each marker adds a small amount of output/context text.

### Notes

- WhiteDragon still does not inject instructions into prompts automatically.
- WhiteDragon still does not ship a character art pack; users provide their own avatar images.
- The unstable `Ask ChatGPT` composer-placeholder override remains intentionally removed.

## 4.4.2

### Fixed

- Detect expression markers appended to normal paragraphs, not only short standalone marker lines.
- Switch to an inline marker immediately during streaming.
- Remove only the marker text while preserving surrounding paragraph content.
- Handle inline markers even when ChatGPT splits the marker across nested span/text nodes.

## 4.4.1

### Fixed

- Keep the avatar visible during very long Pro-thinking and tool-execution turns.
- Remove the unstable `Ask ChatGPT` composer-placeholder override.
- Avoid the severe MutationObserver/React feedback loop caused by composer branding.

## 4.4.0

First public WhiteDragon release.

### Highlights

- Real-time streaming expression switching
- Robust marker detection across split DOM/text nodes
- Marker hiding during streaming
- Sticky long-message avatar
- Single-visible-avatar behavior
- Default and per-Project avatar packs
- High-quality local image storage
- Custom ChatGPT header naming, font, and color
- Live avatar size/position controls
- Draggable settings panel
