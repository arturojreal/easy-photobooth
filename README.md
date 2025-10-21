# XR Motion Conference Photo Booth

## Overview
The XR Motion Conference Photo Booth is a browser-based capture experience tailored for event installations. It streams a live camera feed, guides attendees through a timed capture sequence, and displays results with QR-code sharing. Operators can fully configure layout, visuals, and timings at runtime through a built-in debug panel, then export those settings to persist as new defaults.

## Core Features
- **Camera Capture Workflow**: Live preview, stompbox trigger simulation, animated countdown (`3 → 2 → 1 → Smile!`), capture flash, and result review with progress timeout.
- **Runtime Layout Controls**: Debug panel sliders update CSS variables to reposition and resize the camera frame, countdown/stompbox overlay, and instructions.
- **Visual Tweaks**: Brightness/contrast/saturation/hue filters applied to the `<video>` element in real time.
- **Instructions & Branding**: Bottom instructions banner and top-right branding badge with visibility toggles.
- **Stompbox Indicator / Countdown**: Single overlay element that shows “Stompbox Activated” before transitioning into the animated countdown sequence.
- **Countdown & Result Flow**: Countdown steps locked to ~2 seconds each for visibility; photo results show QR code and return automatically or via `ESC`.
- **Gallery Management**: Persistent gallery with select/export/clear actions using `localStorage` for storage.
- **Settings Export/Import**: Export current runtime settings as JSON to bake into future defaults.
- **Deployment Ready**: Static bundle; `netlify.toml` already configured for deployment with security headers and share URL redirects.

## Repository Structure
- `index.html` – Single-page application containing markup, inline CSS design system, and the `PhotoBoothApp` class orchestrating state, camera access, UI logic, and debug controls.
- `netlify.toml` – Netlify configuration (no build step, security headers, `/share/:id` redirect).
- `.gitignore` – Standard ignore rules for macOS/Node artifacts.

## Quick Start
1. **Prerequisites**: Modern desktop browser with webcam access (Chrome recommended). No build tooling required.
2. **Local preview**:
   - Option A: Open `index.html` directly in a browser (allow camera permissions).
   - Option B: Serve via a lightweight static server (e.g. `npx serve .`) to mimic production hosting.
3. **Keyboard shortcuts**:
   - `Space` – Simulate stompbox trigger (starts indicator + countdown + capture).
   - `G` – Toggle gallery overlay.
   - `D` – Toggle debug panel overlay.
   - `ESC` – Close overlays; skip result progress bar to return to live view.

## Runtime Controls (Debug Panel)
Open the debug panel (`D`) to inspect and adjust behavior. Key sections:

- **📹 Camera Settings**
  - `Camera Source` select – Switch connected cameras.
  - `Camera Size` slider – Legacy width control (still mapped to container width).
  - `Brightness / Contrast / Saturation / Hue` – Filters applied via CSS to `#videoElement`.

- **📐 Element Positioning**  
  Updates CSS variables applied in `PhotoBoothApp.updateElementPositions()`.
  - `Camera Left / Top / Width` (% vw/vh) – Fixed-position camera container alignment.
  - `Countdown Top / Left / Size` – Controls the combined stompbox/countdown overlay position.
  - `Stompbox Top / Left / Font` – Additional positioning + font sizing for the overlay element.
  - `Instructions Bottom / Width` – Bottom banner offsets and width.

- **⏱️ Timing Settings**
  - `Stompbox Delay` (ms) – Duration “Stompbox Activated” text stays visible before countdown.
  - `Countdown Duration` (s) – Retained for compatibility (currently not used when fixed 2s steps are desired).
  - `Display Duration / Progress Duration` (s) – Timings for result view and progress bar.

- **📸 Photo Settings**
  - `Photo Quality` (JPEG quality factor) and `Resolution` options (ideal constraints passed to `getUserMedia`).

- **🔧 System Status** – Camera/storage/system heartbeat indicators.
- **🧪 Test Controls** – Buttons to fire countdown, capture, QR generation, export settings, and reset defaults.

## Default Settings
Default state is defined in the `PhotoBoothApp` constructor and mirrored in `resetToDefaults()`:
```json
{
  "stompDelay": 1000,
  "countdownDuration": 3,
  "displayDuration": 12000,
  "progressDuration": 15000,
  "photoQuality": 0.92,
  "resolution": "1920x1080",
  "brightness": 0,
  "contrast": 100,
  "saturation": 100,
  "hue": 0,
  "cameraSize": 60,
  "cameraLeft": 50,
  "cameraTop": 50,
  "cameraWidth": 60,
  "showInstructions": true,
  "showBranding": true,
  "showKeyHints": true,
  "showStompboxIndicator": true,
  "countdownTopVH": 70,
  "countdownLeftVW": 50,
  "countdownSizeVW": 8,
  "stompboxTopVH": 75,
  "stompboxLeftVW": 40,
  "stompboxFontPX": 25,
  "instructionsBottomPX": 100,
  "instructionsWidthPercent": 20
}
```
These values are immediately applied to CSS variables via `updateElementPositions()` on app initialization.

## Settings Export/Import workflow
1. Tune layout and preferences in the debug panel.
2. Click **Export Settings**. A JSON file downloads with the current `this.settings` snapshot plus timestamp/version.
3. To make these the new defaults, replace the constructor/defaults block in `index.html` with the exported values and keep `resetToDefaults()` in sync.

## Capture Flow Summary
1. Operator presses stompbox or hits `Space`.
2. Stompbox overlay displays “📸 Stompbox Activated – Get Ready!” for `stompDelay` milliseconds.
3. Same overlay animates through `3`, `2`, `1`, `Smile!` (each ~2 seconds, with Anime.js scaling/opacity effect).
4. Camera frame captured via `<canvas>` (respecting filters/resolution); flash overlay pulses.
5. Result screen slides in with the photo preview and generated QR code.
6. Progress bar counts down for `progressDuration`; `ESC` skips immediately.
7. Returning to live view restores camera container visibility and resets progress bar.

## Gallery & Storage
- Photos are persisted in `localStorage` with metadata: ID, data URL, timestamp, and settings snapshot.
- Gallery overlay supports select all, clear selection, export selected (downloads JPEGs), and clearing storage.
- `getSelectedPhotos()`, `selectAllPhotos()`, `clearSelection()`, and `savePhotosToStorage()` manage gallery state.

## Deployment Notes
- Project is static; no build step. Netlify command is noop (`echo 'No build required for static HTML'`).
- Security headers set via `netlify.toml`.
- Redirect `/share/:id → /index.html` ensures QR links load the SPA and `handleUrlHash()` opens the viewer.
- For other hosting providers, ensure equivalent headers/caching rules are applied.

## Development Tips
- The CSS design system at the top of `index.html` defines global look/feel. Update tokens or root variables before adjusting per-element styles.
- Layout is driven by CSS variables, so any new UI element should follow the same pattern for runtime tuning.
- Countdown/stompbox share the same DOM node (`#stompboxIndicator`); adjust copy or animation in `startCountdown()` / `triggerPhotoCapture()`.
- `updateCameraSize()` keeps the legacy `cameraSize` slider mapped to the newer `cameraWidth` var. If redundant, remove the old control.
- Keep constructor defaults, debug sliders, and `resetToDefaults()` in sync whenever adding a new setting.
- All keyboard shortcuts are centralized in `setupEventListeners()`—expand there for new developer tools or operator shortcuts.

## Next Steps (if further work is planned)
- Persist exported settings server-side or allow importing JSON through the UI.
- Add responsive presets for different display resolutions.
- Integrate analytics for stomp/capture counts.
- Harden storage by swapping `localStorage` with remote persistence.

## Support
For handoff questions: review `PhotoBoothApp` methods in `index.html`—they fully describe the runtime behavior. The project is self-contained, so changes only require editing that file and re-deploying the static site.
