# vite-wasm-audio-analyzer

Real-time audio frequency analyzer and spectrum visualizer powered by WebAssembly FFT, React, and the Web Audio API.

## Table of Contents

- [What is this?](#what-is-this)
- [Features](#features)
- [Local Development](#local-development)
- [Browser Requirements](#browser-requirements)
- [Architecture & Development Guides](#architecture--development-guides)

---

## What is this?

vite-wasm-audio-analyzer is a browser-based spectrum analyzer that captures audio from a microphone or any `HTMLMediaElement` and renders a live frequency display. The FFT computation runs in a dedicated AudioWorklet thread using a WebAssembly module, keeping the UI thread free for smooth canvas rendering via `requestAnimationFrame`.

It ships as a static single-page app — no server, no backend, no database.

---

## Features

### Visualization Modes

| Mode | Description |
|------|-------------|
| 0 | Discrete frequencies |
| 1 | 1/24th octave (240 bands) |
| 2 | 1/12th octave (120 bands) |
| 3 | 1/8th octave (80 bands) |
| 4 | 1/6th octave (60 bands) |
| 5 | 1/4th octave (40 bands) |
| 6 | 1/3rd octave (30 bands) |
| 7 | Half octave (20 bands) |
| 8 | Full octave (10 bands) |
| 10 | Line / area graph |

**Bar rendering variants** (modes 1–8):

- **LED bars** — segmented LED-style display
- **Luminosity bars** — full-height bars with opacity mapped to amplitude
- **Alpha bars** — bar opacity corresponds to bar value
- **Outline bars** — hollow bars rendered as strokes
- **Round bars** — bars with rounded end caps

### Frequency Scales

- **Log** (default) — logarithmic base-2 spacing, best for music
- **Linear** — even Hz spacing across the range
- **Bark** — perceptual scale (0–24 bark units)
- **Mel** — pitch-based perceptual scale

Frequency range is configurable: 20 Hz–20 kHz by default, with presets from 10 Hz up to 24 kHz.

### Color Modes

- **Gradient** — applies a linear or radial canvas gradient across bars
- **Bar Index** — colors each bar sequentially across gradient color stops
- **Bar Level** — colors bars based on their amplitude level

### Built-in Gradient Presets

| Name | Direction |
|------|-----------|
| Classic | Vertical |
| Prism | Vertical |
| Rainbow | Horizontal |
| OrangeRed | Vertical |
| SteelBlue | Vertical |

### Channel Layouts

- **Single** — mono visualization
- **Dual Horizontal** — left and right channels side by side
- **Dual Vertical** — left and right channels stacked
- **Dual Combined** — both channels overlaid on the same canvas

Mirror mode is available for radial and horizontal layouts.

### Audio Filters (Frequency Weighting)

Apply standardized frequency weightings before analysis: **A**, **B**, **C**, **D**, or **468**. Useful for matching psychoacoustic measurement standards.

### Other Options

- Peak hold with configurable gravity decay
- Note labels (musical note names instead of Hz values on the X axis)
- FPS display
- Transparent overlay mode

---

## Local Development

```bash
npm install
npm run dev
```

The dev server starts at `http://localhost:4000`. Microphone access requires a browser permission prompt on first use.

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server on port 4000 |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run Biome linter |

### Tech Stack

- **React 19** + **TypeScript 5.8**
- **Vite** (Rolldown 7) for bundling
- **Tailwind CSS 4** for styling
- **Web Audio API** + **AudioWorklet** for audio capture and routing
- **WebAssembly** (`@devinmdavies/wasm-fft-analyzer`) for FFT computation
- **Biome** for linting and formatting

---

## Browser Requirements

The app uses AudioWorklet, WebAssembly, and `getUserMedia`, all of which require a secure context (HTTPS or `localhost`).

| Requirement | Minimum Version |
|-------------|-----------------|
| Chrome | 66+ |
| Firefox | 76+ |
| Safari | 14.1+ |

Microphone access requires the user to grant browser permission. The app surfaces clear error messages if permission is denied or no audio device is found.

---

## Architecture & Development Guides

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — Component breakdown, audio processing pipeline, data flow, and deployment details.
- **[AGENTS.md](./AGENTS.md)** — Workflow procedures, commit conventions, guardrails, and tool preferences for agent-driven development.
