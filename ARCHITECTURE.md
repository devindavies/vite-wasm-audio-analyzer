# Architecture Overview

This document serves as a critical, living reference designed to equip agents and engineers with a rapid and comprehensive understanding of the codebase's architecture. Update this document as the codebase evolves.

## 1. Project Structure

```
vite-wasm-audio-analyzer/
├── src/                       # Application source code
│   ├── components/            # React UI components (AudioAnalyzer, AudioController)
│   ├── audio-processing/      # AudioWorklet processor (FFT + WASM integration)
│   ├── canvas-rendering/      # Canvas Web Worker infrastructure (built, not yet wired in)
│   ├── utils/                 # Audio setup, canvas setup, frequency mapping utilities
│   ├── constants/             # Band presets, gradients, default settings, math constants
│   ├── types/                 # TypeScript type definitions for audio, events, and display
│   └── assets/                # Static image assets
├── public/                    # Statically served files
├── .github/
│   ├── workflows/             # GitHub Actions CI (CodeQL security scan)
│   └── dependabot.yml         # Weekly npm dependency updates
├── biome.json                 # Linter and formatter configuration
├── vite.config.ts             # Vite build config (Rolldown, WASM copy, Tailwind)
├── tsconfig.json              # TypeScript strict mode config
├── index.html                 # SPA entry point
└── ARCHITECTURE.md            # This document
```

## 2. High-Level System Diagram

```
[User Input: Microphone / HTMLMediaElement]
            |
            v
    [Web Audio API (AudioContext)]
            |
            v
  ┌─────────────────────────────┐
  │     AudioWorklet Thread     │
  │     FFTProcessor.ts         │
  │     WASM FFT Analyzer       │  ──── Float32Array ────▶  [RTANode callback]
  │     Circular Buffer         │                                  |
  └─────────────────────────────┘                                  v
                                                    [Main Thread — React App]
                                                    AudioAnalyzer.tsx
                                                    requestAnimationFrame(draw)
                                                    HTMLCanvasElement.getContext("2d")
                                                          |
                                                          v
                                                    [Display / Screen]
```

## 3. Core Components

### 3.1. Frontend Application

**Name:** AudioAnalyzer (active entry point)

**Description:** A browser-only single-page application that performs real-time audio frequency analysis and visualization. The user grants microphone access or connects an `HTMLMediaElement`; the app captures and routes audio through the Web Audio API, processes it via a WASM FFT AudioWorklet, and renders a live spectrum display on a main-thread canvas using `requestAnimationFrame`.

**Technologies:** React 19, TypeScript 5.8.3, Vite (Rolldown 7), Tailwind CSS 4, Web Audio API, WebAssembly, Web Workers

**Key Entry Point:** `App.tsx` → `AudioAnalyzer.tsx` (the sole mounted component)

**Deployment:** Static SPA — no server required. Likely Vercel based on `@vercel/analytics` and `@vercel/speed-insights` dependencies.

---

### 3.2. Audio Processing Layer

#### 3.2.1. FFTProcessor (AudioWorklet)

**Name:** FFTProcessor AudioWorklet

**Description:** Runs inside a dedicated AudioWorklet thread, isolated from the main UI thread. Accumulates raw PCM samples from the Web Audio graph into a circular buffer; when the buffer is full (power-of-2 size), invokes the WASM FFT analyzer to produce a frequency bin array and posts it back to the main thread via the `RTANode` callback, which drives the `requestAnimationFrame` render loop in `AudioAnalyzer.tsx`.

**Technologies:** AudioWorkletProcessor API, `@devinmdavies/wasm-fft-analyzer` (WASM), TypeScript

**Key Files:** `src/audio-processing/FFTProcessor.ts`, `src/utils/RTANode.ts`, `src/utils/setupAudio.ts`

---

### 3.3. Canvas Rendering (Main Thread)

**Name:** AudioAnalyzer canvas rendering loop

**Description:** All canvas drawing currently executes on the main thread inside `AudioAnalyzer.tsx`. On each RTANode signal callback, `requestAnimationFrame(draw)` is queued. The `draw` function calls `HTMLCanvasElement.getContext("2d")` and renders frequency bars with gradient color mapping, LED overlays, peak hold, scale axes, and FPS display.

**Key Files:** `src/components/AudioAnalyzer.tsx`, `src/utils/canvas/setCanvas.ts`, `src/utils/frequencyToXAxis.ts`, `src/utils/findY.ts`

> **Note:** `src/canvas-rendering/canvas-worker.ts` and `src/utils/setupCanvas.ts` contain infrastructure for moving rendering into a Web Worker (with `transferControlToOffscreen()`). This code is built and tested but is not wired into the active app — `AudioController.tsx`, which uses it, is not mounted anywhere. It represents in-progress work for future off-thread rendering.

---

### 3.4. React State & Settings Layer

**Name:** AudioAnalyzer component state

**Description:** `AudioAnalyzer.tsx` manages the full visualization configuration: visualization mode (0–8, 10), channel layout (single / dual-horizontal / dual-vertical / dual-combined), gradient preset, color mode (gradient / bar-index / bar-level), frequency scale (linear / log / mel / bark), LED bars, alpha transparency, peak hold, gravity decay, audio filters (A/B/C/D/468), and FPS monitoring.

---

## 4. Data Stores

### 4.1. In-Memory Audio Buffer

**Name:** FFT Circular Buffer

**Type:** In-memory `Float32Array` (AudioWorklet thread)

**Purpose:** Holds the most recent N PCM samples (power-of-2 size) for FFT analysis. New 128-sample chunks from the Web Audio graph shift out old samples and append new ones, ensuring the WASM analyzer always operates on the latest ordered samples.

### 4.2. Frequency Bin Array

**Name:** FFT Output Buffer

**Type:** In-memory `Float32Array` (passed via RTANode MessagePort callback)

**Purpose:** The output of WASM FFT analysis — an array of frequency bin magnitudes. Posted from the AudioWorklet to the main thread on each analysis cycle, triggering a `requestAnimationFrame` draw call.

> **No persistent data stores.** This application holds no databases, local storage, cookies, or session state. All data is transient and lives in memory for the duration of an audio session.

---

## 5. External Integrations / APIs

| Service | Purpose | Integration Method |
|---------|---------|-------------------|
| `@devinmdavies/wasm-fft-analyzer` | WebAssembly FFT computation | npm package — WASM binary copied to dist root at build time via `vite-plugin-static-copy` |
| Web Audio API | PCM audio capture, AudioContext routing, AudioWorklet execution | Browser native API |
| Vercel Analytics | Page view and interaction analytics | `@vercel/analytics` npm package |
| Vercel Speed Insights | Core Web Vitals monitoring | `@vercel/speed-insights` npm package |

---

## 6. Deployment & Infrastructure

**Cloud Provider:** Vercel (inferred from `@vercel/analytics` and `@vercel/speed-insights` dependencies)

**Key Services Used:** <!-- TODO: fill in — confirm Vercel project name and domain -->

**CI/CD Pipeline:** GitHub Actions — `.github/workflows/codeql.yml` runs CodeQL security analysis on push/PR to `main` and on a weekly schedule (Wednesdays)

**Dependency Management:** Dependabot — weekly npm updates targeting the repo root

**Monitoring & Logging:** Vercel Analytics (page metrics) + Vercel Speed Insights (Core Web Vitals). No server-side logging — this is a purely client-side app.

---

## 7. Security Considerations

**Authentication:** None — this is a public client-side application with no user accounts or protected routes.

**Authorization:** Not applicable.

**Data Encryption:** All traffic served over HTTPS (Vercel default). No sensitive user data is collected or transmitted.

**Browser Permissions:** Microphone access via `getUserMedia()` — requires explicit user permission grant. Permission errors (`NotAllowedError`, `NotFoundError`) are caught and surfaced with user-friendly messages in `src/utils/getWebAudioMediaStream.ts`.

**Key Security Tools / Practices:** CodeQL static analysis via GitHub Actions (JavaScript/TypeScript). Dependabot for weekly npm vulnerability patching.

---

## 8. Development & Testing Environment

**Local Setup:**
```bash
npm install
npm run dev        # Dev server on http://localhost:4000
npm run build      # Production build → dist/
npm run preview    # Preview production build locally
npm run lint       # Biome linter
```

**Testing Frameworks:** None — no automated test suite is currently configured.

**Code Quality Tools:** [Biome 2.1.2](biome.json) — combined linter and formatter with VCS integration. Key rules enforce: no barrel files, no re-export-all, top-level regex, exhaustive React hook dependencies, and JSX key in iterables. `canvas-rendering/` and `AudioController.tsx` are excluded from linting (in-progress code).

---

## 9. Future Considerations / Roadmap

- <!-- TODO: fill in planned architectural changes -->
- <!-- TODO: fill in known technical debt affecting architecture -->

---

## System Architecture

For agent behavior rules (workflow, guardrails, commit conventions, tool preferences), see [AGENTS.md](./AGENTS.md).

---

## 10. Project Identification

**Project Name:** vite-wasm-audio-analyzer

**Repository URL:** https://github.com/devindavies/vite-wasm-audio-analyzer

**Primary Contact / Team:** devindavies

**Date of Last Update:** 2026-07-15

---

## 11. Glossary / Acronyms

| Term | Definition |
|------|-----------|
| **FFT** | Fast Fourier Transform — algorithm that converts time-domain audio samples into frequency-domain magnitude data |
| **WASM** | WebAssembly — binary instruction format enabling near-native performance in the browser; used here for FFT computation |
| **AudioWorklet** | Web Audio API mechanism for running audio processing code in a dedicated, high-priority thread separate from the main UI thread |
| **RTA** | Real-Time Analyzer — a device or software that displays a live frequency spectrum of an audio signal |
| **PCM** | Pulse-Code Modulation — the raw digital audio sample format produced by Web Audio API graph nodes |
| **dB** | Decibels — logarithmic unit for measuring audio signal level; used to map FFT magnitudes to bar heights in the visualization |
| **Bin** | A single frequency bucket output by the FFT; each bin represents the magnitude of a frequency range |
| **MessagePort** | Web API for direct bi-directional communication between Workers and the main thread; used in the AudioWorklet → RTANode callback path |
| **DSP** | Digital Signal Processing — manipulation of digital audio signals; the FFT + frequency mapping pipeline in this project |
| **OffscreenCanvas** | Browser API that allows canvas rendering in a Web Worker (zero-copy transfer via `transferControlToOffscreen()`); built but not yet active in this app |
