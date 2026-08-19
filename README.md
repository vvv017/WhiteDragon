# 白龍 WhiteDragon

A customizable expression-avatar userscript for ChatGPT.

WhiteDragon adds a character portrait beside ChatGPT replies and can switch expressions **while the response is still streaming**. It supports per-Project avatar packs, sticky portraits for long replies, header renaming, live layout controls, and setup helpers for teaching ChatGPT the marker protocol.

> Current release: **4.5.2**

## Quick install

### **[▶ Install WhiteDragon v4.5.2](https://raw.githubusercontent.com/vvv017/WhiteDragon/main/whitedragon.user.js)**

With Tampermonkey or Violentmonkey installed, the link above should open the userscript installation screen directly.

## Features

- 10 expression states: `neutral`, `smile`, `laugh`, `confused`, `annoyed`, `serious`, `surprised`, `sad`, `smug`, `thinking`
- Real-time expression switching during ChatGPT streaming
- Hidden `[[avatar:...]]` control markers
- Robust marker detection across split DOM/text nodes
- Inline markers are supported — `Done. [[avatar:smile]]` switches to `smile` and hides only the marker text
- Per-ChatGPT-Project avatar packs with fallback to the default pack
- Sticky avatar for long replies
- Long Pro-thinking and tool-execution turns keep their avatar
- Only one assistant avatar visible at a time
- Adjustable avatar size, horizontal position, vertical offset, and sticky height
- Saved avatar layout is automatically restored if ChatGPT rewrites page-level style variables during startup
- Draggable settings panel
- Custom ChatGPT **header** name, font, and color
- Local avatar image storage through IndexedDB
- High-quality image import with transparency preserved
- **Copy expression instructions** helper for ChatGPT Custom Instructions / Project Instructions
- **Copy test prompt** helper for checking expression switching
- **Copy avatar generation prompt** beside avatar import, for creating a 10-expression set from your own character reference
- Usage note explaining that markers add a small amount of output/context text
- No OpenAI API key required
- No analytics or telemetry

> The composer placeholder (`Ask ChatGPT`) is intentionally left unchanged. ChatGPT frequently rewrites that UI at runtime, and overriding it previously caused instability and severe performance issues.

## Install

1. Install **Tampermonkey** or **Violentmonkey**.
2. On Chromium-based browsers, make sure the extension is allowed to run userscripts.
3. Click **[Install WhiteDragon](https://raw.githubusercontent.com/vvv017/WhiteDragon/main/whitedragon.user.js)**.
4. Confirm the installation in your userscript manager.
5. Reload ChatGPT.
6. Click the **♥** button in the lower-right corner.
7. Import your avatar images.
8. In **AI expression control**, click **Copy expression instructions** and paste them into ChatGPT Custom Instructions or Project Instructions.

## Required image filenames

```text
neutral.png
smile.png
laugh.png
confused.png
annoyed.png
serious.png
surprised.png
sad.png
smug.png
thinking.png
```

PNG is recommended, especially for transparent character art.

WhiteDragon does **not** ship a character art pack. If an expression is missing, the script uses a simple placeholder. Users can import their own images, or use **Copy avatar generation prompt** with their own character reference image.

## Expression markers

WhiteDragon uses markers such as:

```text
[[avatar:thinking]]
```

A reply can contain multiple markers:

```text
[[avatar:neutral]]

The first part is straightforward.

[[avatar:thinking]]

There is one edge case worth checking.

[[avatar:surprised]]

Oh—this changes the result.

[[avatar:smile]]

With that corrected, everything lines up.
```

Inline markers also work:

```text
Everything is fixed. [[avatar:smile]]
```

The visible marker text is removed while the avatar still switches immediately. Markers inside code blocks are ignored.

## AI expression control

WhiteDragon runs in the browser, so ChatGPT cannot automatically know that the userscript exists.

The settings panel includes **Copy expression instructions**, which copies a short instruction describing the exact `[[avatar:expression]]` marker format and the 10 available expressions. Paste it into:

- ChatGPT Custom Instructions for all chats, or
- Project Instructions for one Project only.

WhiteDragon does not inject these instructions into prompts automatically.

The repository also includes [`CUSTOM_INSTRUCTIONS.md`](CUSTOM_INSTRUCTIONS.md) as a more complete reference.

### Token / usage note

Each expression change adds a short `[[avatar:...]]` marker to the model's reply. That uses a small amount of additional output/context tokens, roughly comparable to a few short words. More frequent switching adds slightly more marker text, but the impact is usually negligible.

## Project-specific characters

Open a conversation inside a ChatGPT Project, click **♥**, and import images there. Missing Project expressions automatically fall back to the default pack.

## Interface customization

The settings panel can customize:

- `ChatGPT Pro` → e.g. `Alice Pro`
- Header font family
- Header text color
- Avatar size and position
- Sticky screen height

The panel can be dragged while previewing changes. Double-click the panel header to re-center it.

## Privacy

WhiteDragon runs locally in your browser.

- Avatar images are stored locally in IndexedDB.
- UI preferences are stored locally.
- No API key, analytics, or telemetry are included.
- The script does not send additional prompts or model requests.
- Marker text is part of the normal assistant reply and therefore contributes a small amount to model output/context usage.

## Compatibility

Targets:

- `https://chatgpt.com/*`
- `https://chat.openai.com/*`

ChatGPT changes frequently. If a UI update breaks WhiteDragon, open an issue with your browser/userscript-manager versions, WhiteDragon version, screenshot, and relevant console errors.

## Development

The installable script is [`whitedragon.user.js`](whitedragon.user.js). A mirrored readable source is split across `src/parts/part-*.part`; concatenating the parts produces the same script.

Syntax check:

```bash
node --check whitedragon.user.js
```

## License

MIT. See [`LICENSE`](LICENSE).

WhiteDragon is an independent community project and is not affiliated with or endorsed by OpenAI.
