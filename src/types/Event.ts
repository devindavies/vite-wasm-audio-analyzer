import type setCanvas from "../utils/canvas/setCanvas";

export type WasmAudioEvent =
	| {
			type: "send-wasm-module";
			data: ArrayBuffer;
	  }
	| {
			type: "wasm-module-loaded";
			data: never;
	  }
	| {
			type: "init-detector";
			data: {
				sampleRate: number;
				numAudioSamplesPerAnalysis: number;
			};
	  }
	| {
			type: "signal";
			data: Float32Array;
	  }
	| {
			type: "setMinFreq";
			data: number;
	  }
	| {
			type: "setMaxFreq";
			data: number;
	  };

export type WasmCanvasEvent =
	| {
			type: "transferCanvas";
			data: {
				canvas: OffscreenCanvas;
				scaleX: OffscreenCanvas;
				scaleR: OffscreenCanvas;
			};
	  }
	| {
			type: "startAnimation";
			data: Float32Array;
	  }
	| {
			type: "setCanvas";
			data: Omit<
				Parameters<typeof setCanvas>[0],
				"ctx" | "canvas" | "scaleX" | "fsEl" | "container"
			>;
	  };
