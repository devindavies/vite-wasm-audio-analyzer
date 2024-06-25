import CanvasWorker from "../canvas-rendering/canvas-worker.ts?worker";

export function setupCanvas(
	canvas: HTMLCanvasElement,
	scaleX: HTMLCanvasElement,
	scaleR: HTMLCanvasElement,
	port: MessagePort,
) {
	const offscreenCanvas = canvas.transferControlToOffscreen();
	const offscreenScaleX = scaleX.transferControlToOffscreen();
	const offscreenScaleR = scaleR.transferControlToOffscreen();
	const worker = new CanvasWorker();
	worker.postMessage(
		{
			type: "transferCanvas",
			data: {
				canvas: offscreenCanvas,
				scaleX: offscreenScaleX,
				scaleR: offscreenScaleR,
			},
		},
		[offscreenCanvas, offscreenScaleX, offscreenScaleR, port],
	);

	return worker;
}
