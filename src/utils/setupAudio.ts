import wasmUrl from "@devinmdavies/wasm-fft-analyzer/wasm_fft_analyzer_bg.wasm?url";
import FFTProcessorUrl from "../audio-processing/FFTProcessor.ts?worker&url";
import { getWebAudioMediaStream } from "./getWebAudioMediaStream";
import RTANode from "./RTANode";

// numAudioSamplesPerAnalysis specifies the number of consecutive audio samples that
// the signal detection algorithm calculates for each unit of work. Larger values tend
// to produce slightly more accurate results but are more expensive to compute and
// can lead to notes being missed in faster passages i.e. where the music note is
// changing rapidly. 8192 is a good balance between efficiency and accuracy for music analysis.
const FFT_SAMPLE_SIZE = 8192;
const MEDIA_ELEMENT_SAMPLE_RATE = 48000;

// Normalize AudioContext across browsers (Safari requires webkitAudioContext).
const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;

export async function setupAudio(
	onSignalDetectedCallback: (signal: Float32Array) => void,
	source?: AudioNode | HTMLMediaElement,
) {
	let mediaStream: MediaStream | null = null;
	let ownsContext = false;
	let context: AudioContext;
	let audioSource: AudioNode;

	if (source) {
		if (source instanceof HTMLMediaElement) {
			// Get the audio from the HTMLMediaElement.
			context = new AudioContextClass({ sampleRate: MEDIA_ELEMENT_SAMPLE_RATE });
			ownsContext = true;
			audioSource = context.createMediaElementSource(source);
		} else {
			// Borrowing an existing context — do not close it on error.
			context = source.context as AudioContext;
			audioSource = source;
		}
	} else {
		// Get the browser audio. Awaits user "allowing" it for the current tab.
		mediaStream = await getWebAudioMediaStream();
		context = new AudioContextClass();
		ownsContext = true;
		audioSource = context.createMediaStreamSource(mediaStream);
	}

	try {
		// Fetch the WebAssembly module and register the audio processor worklet in
		// parallel — they are independent operations.
		const [wasmBytes] = await Promise.all([
			fetch(wasmUrl).then((response) => {
				if (!response.ok) {
					throw new Error(
						`Failed to fetch WASM module: ${response.status} ${response.statusText}`,
					);
				}
				return response.arrayBuffer();
			}),
			context.audioWorklet.addModule(FFTProcessorUrl).catch((e) => {
				throw new Error(
					`Failed to load audio analyzer worklet at url: ${FFTProcessorUrl}. Further info: ${
						e instanceof Error ? e.message : String(e)
					}`,
				);
			}),
		]);

		const node = new RTANode(context, "FFTProcessor");

		// Send the Wasm module to the audio node which in turn passes it to the
		// processor running in the Worklet thread. Also, pass any configuration
		// parameters for the Wasm detection algorithm.
		node.init(wasmBytes, onSignalDetectedCallback, FFT_SAMPLE_SIZE);

		// Connect the audio source (microphone output) to our analysis node.
		audioSource.connect(node);

		// Connect our analysis node to the output. Required even though we do not
		// output any audio. Allows further downstream audio processing or output to
		// occur.
		node.connect(context.destination);

		return { context, node };
	} catch (err) {
		// Stop the microphone stream so the browser recording indicator is cleared.
		for (const track of mediaStream?.getTracks() ?? []) {
			track.stop();
		}
		// Only close contexts we created — do not close a caller-owned AudioNode context.
		if (ownsContext && context.state !== "closed") {
			await context.close();
		}
		// Re-throw specific errors as-is; wrap only truly unknown throws.
		if (err instanceof Error) throw err;
		throw new Error(`Unexpected error in audio setup: ${String(err)}`);
	}
}
