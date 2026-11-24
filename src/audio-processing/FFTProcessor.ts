import init, { WasmSpectrumAnalyzer } from "@devinmdavies/wasm-fft-analyzer";
import type { WasmAudioEvent } from "../types/Event.js";

// ~62 analyses per second at 48 kHz. Multiple of the 128-sample render quantum.
const ANALYSIS_HOP_SAMPLES = 768;

export class FFTProcessor extends AudioWorkletProcessor {
	totalSamples: number;
	/** Time-ordered copy of the latest samples, handed to the WASM analyzer. */
	samples: Float32Array;
	/** Circular buffer the audio graph writes into. */
	ring: Float32Array;
	writeIndex: number;
	samplesSinceAnalysis: number;
	/** Number of new samples between two analyses. */
	hopSamples: number;
	detector: WasmSpectrumAnalyzer | null;
	numAudioSamplesPerAnalysis: number;
	maxFreq: number;
	minFreq: number;
	memory: WebAssembly.Memory | null;
	//canvasPort?: MessagePort;

	constructor() {
		super();

		// Initialized to an array holding a buffer of samples for analysis later -
		// once we know how many samples need to be stored. Meanwhile, an empty
		// array is used, so that early calls to process() with empty channels
		// do not break initialization.
		this.samples = new Float32Array(0);
		this.ring = new Float32Array(0);
		this.writeIndex = 0;
		this.samplesSinceAnalysis = 0;
		this.hopSamples = ANALYSIS_HOP_SAMPLES;
		this.totalSamples = 0;
		this.numAudioSamplesPerAnalysis = 0;

		// Listen to events from the RTANode running on the main thread.
		this.port.onmessage = (event) => this.onmessage(event);

		this.detector = null;
		this.minFreq = 20;
		this.maxFreq = 20000;
		this.memory = null;
	}

	onmessage(event: MessageEvent<WasmAudioEvent>) {
		const { type, data } = event.data;
		switch (type) {
			case "send-wasm-module": {
				// RTANode has sent us a message containing the Wasm library to load into
				// our context as well as information about the audio device used for
				// recording.
				void init({ module_or_path: WebAssembly.compile(data) }).then(
					(initOuput) => {
						this.port.postMessage({ type: "wasm-module-loaded" });
						this.memory = initOuput.memory;
					},
				);
				//this.canvasPort = event.ports[0];
				break;
			}
			case "init-detector": {
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
				this.samples = new Float32Array(numAudioSamplesPerAnalysis);
				this.ring = new Float32Array(numAudioSamplesPerAnalysis);
				this.writeIndex = 0;
				this.samplesSinceAnalysis = 0;
				this.totalSamples = 0;
				break;
			}
			case "setMinFreq": {
				this.minFreq = data;
				break;
			}
			case "setMaxFreq": {
				this.maxFreq = data;
				break;
			}
		}
	}

	process(inputs: Float32Array[][], outputs: Float32Array[][]) {
		const inputChannels = inputs[0];
		const outputChannels = outputs[0];
		// An unconnected or paused source delivers no input channels.
		const inputSamples = inputChannels?.[0];
		if (!inputSamples) {
			return true;
		}
		for (let channel = 0; channel < outputChannels.length; ++channel) {
			const input = inputChannels[channel];
			if (input) {
				outputChannels[channel].set(input);
			}
		}

		const size = this.numAudioSamplesPerAnalysis;
		if (!size) {
			return true;
		}

		// Append the new samples (normally 128) to the ring buffer. `size` is a
		// power of 2, so wrapping the write index is a mask.
		const mask = size - 1;
		let writeIndex = this.writeIndex;
		for (let i = 0; i < inputSamples.length; i++) {
			this.ring[writeIndex] = inputSamples[i];
			writeIndex = (writeIndex + 1) & mask;
		}
		this.writeIndex = writeIndex;
		this.totalSamples += inputSamples.length;
		this.samplesSinceAnalysis += inputSamples.length;

		// A display only needs ~60 updates per second, so analyze once per hop
		// instead of once per 128-sample quantum.
		if (
			this.totalSamples < size ||
			this.samplesSinceAnalysis < this.hopSamples ||
			!this.detector ||
			!this.memory
		) {
			return true;
		}
		this.samplesSinceAnalysis = 0;

		// Unroll the ring buffer into time order (oldest sample first).
		this.samples.set(this.ring.subarray(writeIndex), 0);
		this.samples.set(this.ring.subarray(0, writeIndex), size - writeIndex);

		this.detector.analyze(this.samples, this.minFreq, this.maxFreq);

		const outputPtr = this.detector.output();
		// The analyzer outputs fftSize / 2 bins. Copy them out of wasm memory so
		// only the bins (not the whole wasm memory) are sent to the main thread.
		const output = new Float32Array(
			this.memory.buffer,
			outputPtr,
			size / 2,
		).slice();

		if (output.length !== 0) {
			this.port.postMessage({ type: "signal", data: output }, [output.buffer]);
		}
		// Returning true tells the Audio system to keep going.
		return true;
	}
}
registerProcessor("FFTProcessor", FFTProcessor);
