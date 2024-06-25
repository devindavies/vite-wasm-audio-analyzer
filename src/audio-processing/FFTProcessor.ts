import type { WasmAudioEvent } from "../types/Event.js";
import "./TextDecoder.js";
import init, { WasmSpectrumAnalyzer } from "../wasm-audio/wasm_audio.js";

export class FFTProcessor extends AudioWorkletProcessor {
	totalSamples: number;
	samples: Float32Array;
	detector: WasmSpectrumAnalyzer | null;
	numAudioSamplesPerAnalysis: number;
	wasmMemory?: WebAssembly.Memory;
	//canvasPort?: MessagePort;

	constructor() {
		super();

		// Initialized to an array holding a buffer of samples for analysis later -
		// once we know how many samples need to be stored. Meanwhile, an empty
		// array is used, so that early calls to process() with empty channels
		// do not break initialization.
		this.samples = new Float32Array(0);
		this.totalSamples = 0;
		this.numAudioSamplesPerAnalysis = 0;

		// Listen to events from the RTANode running on the main thread.
		this.port.onmessage = (event) => this.onmessage(event);

		this.detector = null;
	}

	onmessage(event: MessageEvent<WasmAudioEvent>) {
		const { type, data } = event.data;
		if (type === "send-wasm-module") {
			// RTANode has sent us a message containing the Wasm library to load into
			// our context as well as information about the audio device used for
			// recording.
			init(WebAssembly.compile(data)).then((instance) => {
				this.wasmMemory = instance.memory;
				this.port.postMessage({ type: "wasm-module-loaded" });
			});
			//this.canvasPort = event.ports[0];
		} else if (type === "init-detector") {
			const { sampleRate, numAudioSamplesPerAnalysis } = data;

			// Store this because we use it later to detect when we have enough recorded
			// audio samples for our first analysis.
			this.numAudioSamplesPerAnalysis = numAudioSamplesPerAnalysis;

			this.detector = new WasmSpectrumAnalyzer(
				sampleRate,
				numAudioSamplesPerAnalysis,
			);

			// Holds a buffer of audio sample values that we'll send to the Wasm module
			// for analysis at regular intervals.
			this.samples = new Float32Array(numAudioSamplesPerAnalysis).fill(0);
			this.totalSamples = 0;
		}
	}

	process(inputs: Float32Array[][], outputs: Float32Array[][]) {
		const inputChannels = inputs[0];
		const outputChannels = outputs[0];
		for (let channel = 0; channel < outputChannels.length; ++channel) {
			outputChannels[channel].set(inputChannels[channel]);
		}

		// inputSamples holds an array of new samples to process.
		const inputSamples = inputChannels[0];

		// In the AudioWorklet spec, process() is called whenever exactly 128 new
		// audio samples have arrived. We simplify the logic for filling up the
		// buffer by making an assumption that the analysis size is 128 samples or
		// larger and is a power of 2.
		if (
			this.numAudioSamplesPerAnalysis &&
			this.totalSamples < this.numAudioSamplesPerAnalysis
		) {
			for (const sampleValue of inputSamples) {
				this.samples[this.totalSamples++] = sampleValue;
			}
		} else {
			// Buffer is already full. We do not want the buffer to grow continually,
			// so instead will "cycle" the samples through it so that it always
			// holds the latest ordered samples of length equal to
			// numAudioSamplesPerAnalysis.

			// Shift the existing samples left by the length of new samples (128).
			const numNewSamples = inputSamples.length;
			const numExistingSamples = this.samples.length - numNewSamples;
			for (let i = 0; i < numExistingSamples; i++) {
				this.samples[i] = this.samples[i + numNewSamples];
			}

			// Add the new samples onto the end, into the 128-wide slot vacated by
			// the previous copy.
			for (let i = 0; i < numNewSamples; i++) {
				this.samples[numExistingSamples + i] = inputSamples[i];
			}
			this.totalSamples += inputSamples.length;
		}

		// Once our buffer has enough samples, pass them to the Wasm signal detector.
		if (
			this.numAudioSamplesPerAnalysis &&
			this.totalSamples >= this.numAudioSamplesPerAnalysis &&
			this.detector
		) {
			if (!this.wasmMemory) {
				throw new Error("Wasm memory not initialized");
			}
			const float32Memory = new Float32Array(this.wasmMemory.buffer);
			const result = float32Memory.subarray(ptr / 4, ptr / 4 + len);
			//const result = new Float32Array(this.detector.analyze(this.samples));
			//const result = this.detector.analyze(this.samples);

			if (result.length !== 0) {
				this.port.postMessage({ type: "signal", data: result });
			}
		}

		// Returning true tells the Audio system to keep going.
		return true;
	}
}

registerProcessor("FFTProcessor", FFTProcessor);
