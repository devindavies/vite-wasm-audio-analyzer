import type { WasmCanvasEvent } from "../types/Event";
import type { AnalysisResult } from "../wasm-audio/wasm_audio";
import { frequencyToXAxis } from "../utils/frequencyToXAxis";
import setCanvas from "../utils/canvas/setCanvas";

let canvas: OffscreenCanvas | null = null;
let scaleX: OffscreenCanvas | null = null;
let scaleR: OffscreenCanvas | null = null;
let audioWorkletPort: MessagePort | null = null;
const animate = (signal: AnalysisResult[]) => {
	if (!canvas || !signal) return;

	const height = canvas.height;
	const width = canvas.width;
	const context = canvas.getContext("2d");
	if (!context) return;
	context.clearRect(0, 0, width, height);

	//loop to create the bars so I get to 20k!
	for (const { frequency, frequency_value } of signal) {
		//need to convert db Value because it is -120 to 0
		const barHeight = ((20 * Math.log10(frequency_value)) / 2 + 70) * 10;

		const barWidth = (width / signal.length) * 2.5;

		context.fillStyle = `rgb(${barHeight + 200},100,100)`;
		//finding the x location px from the frequency
		const x = frequencyToXAxis(frequency);
		const h = height - barHeight / 2;
		if (h > 0) {
			context.fillRect(x, h, barWidth, barHeight);
		}
	}
};

const onMessageFromAudioWorklet = (e: MessageEvent<WasmCanvasEvent>) => {
	const { type, data } = e.data;

	switch (type) {
		case "startAnimation": {
			const signal = data;
			if (canvas) {
				animate(signal);
			}
			break;
		}
	}
};

self.onmessage = async (e: MessageEvent<WasmCanvasEvent>) => {
	const { type, data } = e.data;

	switch (type) {
		case "transferCanvas": {
			const {
				canvas: offscreenCanvas,
				scaleX: offscreenScaleX,
				scaleR: offscreenScaleY,
			} = data;
			canvas = offscreenCanvas;
			scaleX = offscreenScaleX;
			scaleR = offscreenScaleY;
			audioWorkletPort = e.ports[0];
			audioWorkletPort.onmessage = onMessageFromAudioWorklet;
			break;
		}
		case "startAnimation": {
			const signal = data;
			if (canvas) {
				animate(signal);
			}
			break;
		}
		case "setCanvas": {
			setCanvas({
				...data,
				ctx: canvas?.getContext("2d")!,
				canvas: canvas!,
				scaleX: scaleX?.getContext("2d")!,
				fsEl: canvas!,
				container: canvas!,
			});
		}
	}
};
