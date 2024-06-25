import type { default as RTANodeType } from "./RTANode";
import { getWebAudioMediaStream } from "./getWebAudioMediaStream";
import FFTProcessorUrl from "../audio-processing/FFTProcessor.js?worker&url";

export async function setupAudio(
	onSignalDetectedCallback: (signal: Float32Array) => void,
	//port: MessagePort,
	source?: AudioNode | HTMLMediaElement,
) {
	let mediaStream: MediaStream | null = null;
	let context: AudioContext;
	let audioSource: AudioNode;

	if (source) {
		if (source instanceof HTMLMediaElement) {
			// Get the audio from the HTMLMediaElement.
			context = new (window.AudioContext || window.webkitAudioContext)({
				sampleRate: 48000,
			});
			audioSource = context.createMediaElementSource(source);
		} else {
			// Get the audio from the AudioNode.
			context = source.context as AudioContext;
			audioSource = source;
		}
	} else {
		// Get the browser audio. Awaits user "allowing" it for the current tab.
		mediaStream = await getWebAudioMediaStream();
		context = new window.AudioContext();
		audioSource = context.createMediaStreamSource(mediaStream);
	}

	let node: RTANodeType;

	try {
		// Fetch the WebAssembly module that performs signal detection.
		const response = await fetch("wasm_audio_bg.wasm");

		const wasmBytes = await response.arrayBuffer();
		// Add our audio processor worklet to the context.
		const processorUrl = FFTProcessorUrl;
		try {
			await context.audioWorklet.addModule(processorUrl);
		} catch (e) {
			throw new Error(
				`Failed to load audio analyzer worklet at url: ${processorUrl}. Further info: ${
					(e as Error).message
				}`,
			);
		}

		node = await import("./RTANode").then(({ default: RTANode }) => {
			return new RTANode(context, "FFTProcessor");
		});

		// Create the AudioWorkletNode which enables the main JavaScript thread to
		// communicate with the audio processor (which runs in a Worklet).

		// numAudioSamplesPerAnalysis specifies the number of consecutive audio samples that
		// the signal detection algorithm calculates for each unit of work. Larger values tend
		// to produce slightly more accurate results but are more expensive to compute and
		// can lead to notes being missed in faster passages i.e. where the music note is
		// changing rapidly. 1024 is usually a good balance between efficiency and accuracy
		// for music analysis.
		const numAudioSamplesPerAnalysis = 8192;

		// Send the Wasm module to the audio node which in turn passes it to the
		// processor running in the Worklet thread. Also, pass any configuration
		// parameters for the Wasm detection algorithm.
		node.init(wasmBytes, onSignalDetectedCallback, numAudioSamplesPerAnalysis);

		// Connect the audio source (microphone output) to our analysis node.
		audioSource.connect(node);

		// Connect our analysis node to the output. Required even though we do not
		// output any audio. Allows further downstream audio processing or output to
		// occur.

		node.connect(context.destination);
	} catch (err) {
		throw new Error(
			`Failed to load audio analyzer WASM module. Further info: ${
				(err as Error).message
			}`,
		);
	}

	return { context, node };
}
