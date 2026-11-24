import { getWebAudioMediaStream } from "./getWebAudioMediaStream";

/**
 * PROTOTYPE: same contract as `setupAudio`, but the FFT is done by the browser's
 * native `AnalyserNode` instead of WASM inside an AudioWorklet. There is no
 * worklet, no WASM and no message passing: the spectrum is pulled once per
 * animation frame.
 *
 * Differences from the WASM path that matter when comparing output:
 * - the window is the AnalyserNode's fixed Blackman window,
 * - `smoothingTimeConstant` is 0 so the app's own gravity/peak logic applies,
 * - min/max frequency are applied by zeroing bins outside the range, which is
 *   assumed (not verified) to match what the WASM analyzer does.
 */
export async function setupAudioAnalyser(
	onSignalDetectedCallback: (signal: Float32Array) => void,
	source?: AudioNode | HTMLMediaElement,
	fftSize = 8192,
) {
	let context: AudioContext;
	let audioSource: AudioNode;

	if (source instanceof HTMLMediaElement) {
		context = new (window.AudioContext || window.webkitAudioContext)({
			sampleRate: 48000,
		});
		audioSource = context.createMediaElementSource(source);
	} else if (source) {
		context = source.context as AudioContext;
		audioSource = source;
	} else {
		const mediaStream = await getWebAudioMediaStream();
		context = new window.AudioContext();
		audioSource = context.createMediaStreamSource(mediaStream);
	}

	const analyser = context.createAnalyser();
	analyser.fftSize = fftSize;
	analyser.smoothingTimeConstant = 0;
	// Keep the real floor so silence does not clamp the dB range.
	analyser.minDecibels = -200;
	audioSource.connect(analyser);
	// Playback must still reach the speakers, as with the worklet path.
	analyser.connect(context.destination);

	let minFreq = 20;
	let maxFreq = 20000;
	const db = new Float32Array(analyser.frequencyBinCount);
	const magnitudes = new Float32Array(analyser.frequencyBinCount);

	const tick = () => {
		if (context.state === "closed") {
			return;
		}
		if (context.state === "running") {
			analyser.getFloatFrequencyData(db);
			const binHz = context.sampleRate / fftSize;
			for (let i = 0; i < db.length; i++) {
				const hz = i * binHz;
				// AnalyserNode output is dB of |X| / N. The app expects |X| (it
				// multiplies by 2 / N), so scale back up by N.
				magnitudes[i] =
					hz < minFreq || hz > maxFreq ? 0 : 10 ** (db[i] / 20) * fftSize;
			}
			// Hand out a copy: the app keeps the latest array between frames.
			onSignalDetectedCallback(magnitudes.slice());
		}
		requestAnimationFrame(tick);
	};
	requestAnimationFrame(tick);

	// Stands in for RTANode: the UI only posts frequency-range updates to it.
	const node = {
		port: {
			postMessage(message: { type: string; data: number }) {
				if (message.type === "setMinFreq") {
					minFreq = message.data;
				} else if (message.type === "setMaxFreq") {
					maxFreq = message.data;
				}
			},
		},
	};

	return { context, node };
}
