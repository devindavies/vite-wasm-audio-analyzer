import type { WasmAudioEvent } from "../types/Event";

export default class RTANode extends AudioWorkletNode {
	numAudioSamplesPerAnalysis?: number;
	onSignalDetectedCallback?: (signal: Float32Array) => void;

	/**
	 * Initialize the Audio processor by sending the fetched WebAssembly module to
	 * the processor worklet.
	 *
	 * @param {ArrayBuffer} wasmBytes Sequence of bytes representing the entire
	 * WASM module that will handle signal detection.
	 * @param {number} numAudioSamplesPerAnalysis Number of audio samples used
	 * for each analysis. Must be a power of 2.
	 */
	init(
		wasmBytes: ArrayBuffer,
		onSignalDetectedCallback: (signal: Float32Array) => void,
		numAudioSamplesPerAnalysis: number,
		//port: MessagePort,
	) {
		this.onSignalDetectedCallback = onSignalDetectedCallback;
		this.numAudioSamplesPerAnalysis = numAudioSamplesPerAnalysis;

		// Listen to messages sent from the audio processor.
		this.port.onmessage = (event) => this.onmessage(event.data);

		this.port.postMessage(
			{
				type: "send-wasm-module",
				data: wasmBytes,
			},
			//[port],
		);
	}

	// Handle an uncaught exception thrown in the FFTProcessor.
	onprocessorerror = (err: Event) => {
		console.log(
			`An error from AudioWorkletProcessor.process() occurred: ${err}`,
		);
	};

	onmessage(event: WasmAudioEvent) {
		if (event.type === "wasm-module-loaded") {
			// The Wasm module was successfully sent to the FFTProcessor running on the
			// AudioWorklet thread and compiled. This is our cue to configure the signal
			// detector.

			this.port.postMessage({
				type: "init-detector",
				data: {
					sampleRate: this.context.sampleRate,
					numAudioSamplesPerAnalysis: this.numAudioSamplesPerAnalysis,
				},
			});
		} else if (event.type === "signal") {
			// A signal was detected. Invoke our callback which will result in the UI updating.
			this.onSignalDetectedCallback?.(event.data);
		}
	}
}
