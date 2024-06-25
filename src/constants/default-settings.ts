import type { ChannelLayout } from "../types/ChannelLayout";
import type { ColorMode } from "../types/ColorMode";
import type { AudioAnalyzer } from "../utils/AudioAnalyzer";
import type { NewAudioAnalyzer } from "../utils/NewAudioAnalyzer";
import { type BaseGradient, GRADIENTS } from "./gradients";
import type {
	CHANNEL_SINGLE,
	COLOR_GRADIENT,
	FILTER_NONE,
	FrequencyScale,
	SCALE_LOG,
} from "./strings";

export type Options = {
	alphaBars?: boolean;
	ansiBands?: boolean;
	audioCtx?: AudioContext; // constructor only
	barSpace?: number;
	bgAlpha?: number;
	canvas?: HTMLCanvasElement; // constructor only
	channelLayout?: ChannelLayout;
	colorMode?: ColorMode;
	connectSpeakers?: boolean;
	fadePeaks?: boolean;
	fftSize?: number;
	fillAlpha?: number;
	frequencyScale?: FrequencyScale;
	fsElement?: Element; // constructor only
	gradient?: BaseGradient[0];
	gradientLeft?: string;
	gradientRight?: string;
	gravity?: number;
	height?: number;
	ledBars?: boolean;
	linearAmplitude?: boolean;
	linearBoost?: number;
	lineWidth?: number;
	loRes?: boolean;
	lumiBars?: boolean;
	maxDecibels?: number;
	maxFPS?: number;
	maxFreq?: number;
	minDecibels?: number;
	minFreq?: number;
	mirror?: number;
	mode?: number;
	noteLabels?: boolean;
	onCanvasDraw?: (
		instance: NewAudioAnalyzer,
		params: {
			timestamp: DOMHighResTimeStamp;
			canvasGradients: CanvasGradient[];
		},
	) => void;
	onCanvasResize?: (reason: string, instance: NewAudioAnalyzer) => void;
	outlineBars?: boolean;
	overlay?: boolean;
	peakFadeTime?: number;
	peakHoldTime?: number;
	peakLine?: boolean;
	radial?: boolean;
	radialInvert?: boolean;
	radius?: number;
	reflexAlpha?: number;
	reflexBright?: number;
	reflexFit?: boolean;
	reflexRatio?: number;
	roundBars?: boolean;
	showBgColor?: boolean;
	showFPS?: boolean;
	showPeaks?: boolean;
	showScaleX?: boolean;
	showScaleY?: boolean;
	smoothing?: number;
	source?: HTMLMediaElement | AudioNode; // constructor only
	spinSpeed?: number;
	splitGradient?: boolean;
	start?: boolean;
	trueLeds?: boolean;
	useCanvas?: boolean;
	volume?: number;
	weightingFilter?: string;
	width?: number;
};

export const DEFAULT_SETTINGS = {
	alphaBars: false,
	ansiBands: false,
	barSpace: 0.1,
	bgAlpha: 0.7,
	channelLayout: CHANNEL_SINGLE,
	colorMode: COLOR_GRADIENT,
	fadePeaks: false,
	fftSize: 8192,
	fillAlpha: 1,
	frequencyScale: SCALE_LOG,
	gradient: GRADIENTS[0][0],
	gravity: 3.8,
	height: undefined,
	ledBars: false,
	linearAmplitude: false,
	linearBoost: 1,
	lineWidth: 0,
	loRes: false,
	lumiBars: false,
	maxDecibels: -25,
	maxFPS: 0,
	maxFreq: 22000,
	minDecibels: -85,
	minFreq: 20,
	mirror: 0,
	mode: 0,
	noteLabels: false,
	outlineBars: false,
	overlay: false,
	peakFadeTime: 750,
	peakHoldTime: 500,
	peakLine: false,
	radial: false,
	radialInvert: false,
	radius: 0.3,
	reflexAlpha: 0.15,
	reflexBright: 1,
	reflexFit: true,
	reflexRatio: 0,
	roundBars: false,
	showBgColor: true,
	showFPS: false,
	showPeaks: true,
	showScaleX: true,
	showScaleY: false,
	smoothing: 0.5,
	spinSpeed: 0,
	splitGradient: false,
	start: true,
	trueLeds: false,
	useCanvas: true,
	volume: 1,
	weightingFilter: FILTER_NONE,
	width: undefined,
} as const satisfies Options;
