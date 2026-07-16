import init, { WasmSpectrumAnalyzer } from "@devinmdavies/wasm-fft-analyzer";
import type { WasmAudioEvent } from "../types/Event.js";

export class FFTProcessor extends AudioWorkletProcessor {
	totalSamples: number;
	samples: Float32Array;
	detector: WasmSpectrumAnalyzer | null;
	numAudioSamplesPerAnalysis: number;
	maxFreq: number;
	minFreq: number;
	memory: WebAssembly.Memory | null;
	// Reused view into WASM output memory — recreated only when WASM memory grows.
	outputView: Float32Array | null;
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
		this.minFreq = 20;
		this.maxFreq = 20000;
		this.memory = null;
		this.outputView = null;
	}

	onmessage(event: MessageEvent<WasmAudioEvent>) {
		const { type, data } = event.data;
		switch (type) {
			case "send-wasm-module": {
				// RTANode has sent us a message containing the Wasm library to load into
				// our context as well as information about the audio device used for
				// recording.
				init({ module_or_path: WebAssembly.compile(data) }).then(
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
				this.samples = new Float32Array(numAudioSamplesPerAnalysis).fill(0);
				this.totalSamples = 0;
				this.outputView = null;
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
			// set() copies 128 samples in a single native call — no iterator allocation.
			this.samples.set(inputSamples, this.totalSamples);
			this.totalSamples += inputSamples.length;
		} else {
			// Buffer is already full. We do not want the buffer to grow continually,
			// so instead will "cycle" the samples through it so that it always
			// holds the latest ordered samples of length equal to
			// numAudioSamplesPerAnalysis.
			// copyWithin + set are SIMD-accelerated native operations — no element-by-element loop.
			// The AudioWorklet spec guarantees exactly 128 samples per process() call.
			const numNewSamples = 128;
			this.samples.copyWithin(0, numNewSamples);
			this.samples.set(inputSamples, this.samples.length - numNewSamples);
			this.totalSamples += numNewSamples;
		}
		// Once our buffer has enough samples, pass them to the Wasm signal detector.
		if (
			this.numAudioSamplesPerAnalysis &&
			this.totalSamples >= this.numAudioSamplesPerAnalysis &&
			this.detector &&
			this.memory
		) {
			this.detector.analyze(this.samples, this.minFreq, this.maxFreq);

			const outputPtr = this.detector.ouput();
			// Reuse the view into WASM output memory; recreate only when WASM memory
			// grows (which reallocates memory.buffer).
			if (this.outputView?.buffer !== this.memory.buffer) {
				this.outputView = new Float32Array(
					this.memory.buffer,
					outputPtr,
					this.numAudioSamplesPerAnalysis,
				);
			}
			// Copy to a transferable buffer so postMessage uses zero-copy transfer
			// instead of a structured clone across threads.
			const transferBuffer = new Float32Array(this.outputView);
			this.port.postMessage(
				{ type: "signal", data: transferBuffer },
				[transferBuffer.buffer],
			);
		}
		// Returning true tells the Audio system to keep going.
		return true;
	}
}
registerProcessor("FFTProcessor", FFTProcessor);
