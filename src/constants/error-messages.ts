export const ERR_AUDIO_CONTEXT_FAIL: [string, string] = [
	"ERR_AUDIO_CONTEXT_FAIL",
	"Could not create audio context. Web Audio API not supported?",
];
export const ERR_INVALID_AUDIO_CONTEXT: [string, string] = [
	"ERR_INVALID_AUDIO_CONTEXT",
	"Provided audio context is not valid",
];
export const ERR_UNKNOWN_GRADIENT: [string, string] = [
	"ERR_UNKNOWN_GRADIENT",
	"Unknown gradient",
];
export const ERR_FREQUENCY_TOO_LOW: [string, string] = [
	"ERR_FREQUENCY_TOO_LOW",
	"Frequency values must be >= 1",
];
export const ERR_INVALID_MODE: [string, string] = [
	"ERR_INVALID_MODE",
	"Invalid mode",
];
export const ERR_REFLEX_OUT_OF_RANGE: [string, string] = [
	"ERR_REFLEX_OUT_OF_RANGE",
	"Reflex ratio must be >= 0 and < 1",
];
export const ERR_INVALID_AUDIO_SOURCE: [string, string] = [
	"ERR_INVALID_AUDIO_SOURCE",
	"Audio source must be an instance of HTMLMediaElement or AudioNode",
];
export const ERR_GRADIENT_INVALID_NAME: [string, string] = [
	"ERR_GRADIENT_INVALID_NAME",
	"Gradient name must be a non-empty string",
];
export const ERR_GRADIENT_NOT_AN_OBJECT: [string, string] = [
	"ERR_GRADIENT_NOT_AN_OBJECT",
	"Gradient options must be an object",
];
export const ERR_GRADIENT_MISSING_COLOR: [string, string] = [
	"ERR_GRADIENT_MISSING_COLOR",
	"Gradient colorStops must be a non-empty array",
];

export class AudioMotionError extends Error {
	code: string;
	constructor(error: [string, string], value?: unknown) {
		const [code, message] = error;
		super(message + (value !== undefined ? `: ${value}` : ""));
		this.name = "AudioMotionError";
		this.code = code;
		this.message = message;
	}
}
