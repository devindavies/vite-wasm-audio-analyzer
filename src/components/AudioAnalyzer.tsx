import type RTANode from "../utils/RTANode";
import { setupAudio } from "../utils/setupAudio";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import {
	CHANNEL_LAYOUT,
	COLOR_BAR_INDEX,
	COLOR_BAR_LEVEL,
	COLOR_GRADIENT,
	DEBOUNCE_TIMEOUT,
	DOM_EVENT,
	FILTER,
	FONT_FAMILY,
	FPS_COLOR,
	GRADIENT_DEFAULT_BGCOLOR,
	LEDS_UNLIT_COLOR,
	MODE_GRAPH,
	REASON,
	SCALEX_BACKGROUND_COLOR,
	SCALEX_HIGHLIGHT_COLOR,
	SCALEX_LABEL_COLOR,
	SCALEY_LABEL_COLOR,
	SCALEY_MIDLINE_COLOR,
} from "../constants/strings";

import setCanvas from "../utils/canvas/setCanvas";
import { FrequencyScale } from "../types/FrequencyScale";
import { C_1, HALF_PI, PI, TAU } from "../constants/math";
import { type BaseGradient, GRADIENTS } from "../constants/gradients";
import type { Gradient } from "../types/Gradient";
import type { AnalyzerBarData } from "../types/AnalyzerBarData";
import { findY } from "../utils/findY";

type Mode = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 10;

const defaultWidth = 640;
const defaultHeight = 270;
const maxFPS = 60;

const AudioAnalyzer: React.FC = () => {
	const [audio, setAudio] = useState<
		{ context: AudioContext; node: RTANode } | undefined
	>(undefined);
	const audioCtx = useRef<AudioContext | undefined>(undefined);
	const audioNode = useRef<RTANode | undefined>(undefined);

	const [running, setRunning] = useState(false);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [overlay, setOverlay] = useState(false);
	const latestSignal = useRef<Float32Array | number[]>([]);

	const canvasRef = useRef<HTMLCanvasElement>(null);
	const canvasXRef = useRef<HTMLCanvasElement>(null);
	const canvasRRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const audioRef = useRef<HTMLAudioElement>(null);

	const fsTimeout = useRef<number | null>(null); // Fullscreen timeout
	const fsChanging = useRef(false); // Fullscreen changing
	const pixelRatio = useRef(window.devicePixelRatio / 1);
	const runId = useRef<number | null>(null);
	const time = useRef(performance.now());
	const last = useRef(0);
	const frames = useRef(0);
	const fps = useRef(0);
	const energy = useRef({ val: 0, peak: 0, hold: 0 });
	const spinAngle = useRef(-HALF_PI);

	const aux = useRef({
		analyzerWidth: 0,
		analyzerHeight: 0,
		centerX: 0,
		centerY: 0,
		channelCoords: [
			{
				channelTop: 0,
				channelBottom: 0,
				analyzerBottom: 0,
			},
		],
		channelHeight: 0,
		channelGap: 0,
		initialX: 0,
		innerRadius: 0,
		outerRadius: 0,
		scaleMin: 0,
		unitWidth: 0,
	});
	const flg = useRef({
		isAlpha: false,
		isBands: false,
		isLeds: false,
		isLumi: false,
		isOctaves: false,
		isOutline: false,
		isRound: false,
		noLedGap: false,
	});

	const minFreqRef = useRef<HTMLSelectElement | null>(null);
	const maxFreqRef = useRef<HTMLSelectElement | null>(null);

	const frequencyScaleRef = useRef<HTMLSelectElement | null>(null);
	const [channelLayout, setChannelLayout] = useState<CHANNEL_LAYOUT>(
		CHANNEL_LAYOUT.SINGLE,
	);
	const [noteLabels, setNoteLabels] = useState(false);
	const [ansiBands, setAnsiBands] = useState(false);
	const [mirror, setMirror] = useState<1 | 0 | -1>(0);
	const [radial, setRadial] = useState(false);
	const modeInputRef = useRef<HTMLSelectElement | null>(null);
	const [showLeds, setShowLeds] = useState(false);
	const [lumiBars, setLumiBars] = useState(false);
	const [alphaBars, setAlphaBars] = useState(false);
	const [outlineBars, setOutlineBars] = useState(false);
	const [roundBars, setRoundBars] = useState(false);
	const [ledGap, setLedGap] = useState(false);
	const [reflexRatio, setReflexRatio] = useState(0);
	const [radialInvert, setRadialInvert] = useState(false);
	const [radius, setRadius] = useState(0.3);
	const [barSpace, setBarSpace] = useState(0.1);
	const [fftSize, setFftSize] = useState(8192); //TODO: make this configurable
	const [peakFadeTime, setPeakFadeTime] = useState(750);
	const [peakHoldTime, setPeakHoldTime] = useState(500);
	const [peakLine, setPeakLine] = useState(false);
	const [showPeaks, setShowPeaks] = useState(true);
	const [showScaleX, setShowScaleX] = useState(true);
	const [showScaleY, setShowScaleY] = useState(false);
	const [smoothing, setSmoothing] = useState(0.5);
	const [spinSpeed, setSpinSpeed] = useState(0);
	const [splitGradient, setSplitGradient] = useState(false);
	const [trueLeds, setTrueLeds] = useState(false);
	const colorModeSelectRef = useRef<HTMLSelectElement | null>(null);
	const [maxDecibels, setMaxDecibels] = useState(-25);
	const [minDecibels, setMinDecibels] = useState(-85);
	const [linearAmplitude, setLinearAmplitude] = useState(false);
	const [linearBoost, setLinearBoost] = useState(1);
	const [lineWidth, setLineWidth] = useState(0);
	const [loRes, setLoRes] = useState(false);
	const [fadePeaks, setFadePeaks] = useState(false);
	const [fillAlpha, setFillAlpha] = useState(1);
	const [bgAlpha, setBgAlpha] = useState(0.7);
	const [reflexAlpha, setReflexAlpha] = useState(0.15);
	const [reflexBright, setReflexBright] = useState(1);
	const [reflexFit, setReflexFit] = useState(true);
	const [height, setHeight] = useState<number | undefined>();
	const [width, setWidth] = useState<number | undefined>();
	const [weightingFilter, setWeightingFilter] = useState(FILTER.NONE);
	const gradientSelectRef = useRef<HTMLSelectElement | null>(null);
	const [showBgColor, setShowBgColor] = useState(true);
	const [showFPS, setShowFPS] = useState(false);

	const [useCanvas, setUseCanvas] = useState(true);

	const bars = useRef<AnalyzerBarData[]>([]);
	const leds = useRef<[number, number, number, number]>([0, 0, 0, 0]);
	const canvasGradients = useRef<CanvasGradient[]>([]);

	const gradients = useMemo(() => {
		const gradients: Record<string, Gradient> = {};
		const selectedGrads = gradientSelectRef.current?.value.split(",") || [];
		const registerGradient = (name: string, options: BaseGradient[1]) => {
			const { colorStops } = options;

			const count = colorStops.length;
			const isInvalid = (val: number | undefined) =>
				val === undefined || val < 0 || val > 1;

			let newColorStops: {
				pos: number;
				color: string;
				level: number;
			}[] = [];

			// normalize all colorStops as objects with `pos`, `color` and `level` properties
			newColorStops = colorStops.map((colorStop, index) => ({
				pos:
					typeof colorStop === "string" ||
					isInvalid(colorStop.pos) ||
					colorStop.pos === undefined
						? index / Math.max(1, count - 1)
						: colorStop.pos,
				color: typeof colorStop === "string" ? colorStop : colorStop.color,
				level:
					typeof colorStop === "string" || isInvalid(colorStop.level)
						? 1 - index / count
						: colorStop.level,
			}));

			// make sure colorStops is in descending `level` order and that the first one has `level == 1`
			// this is crucial for proper operation of 'bar-level' colorMode!
			newColorStops.sort((a, b) =>
				a.level < b.level ? 1 : a.level > b.level ? -1 : 0,
			);
			newColorStops[0].level = 1;

			gradients[name] = {
				bgColor: options.bgColor || GRADIENT_DEFAULT_BGCOLOR,
				dir: options.dir,
				colorStops: newColorStops,
			};
		};
		// Register built-in gradients
		for (const [name, options] of GRADIENTS) registerGradient(name, options);

		return gradients;
	}, []);

	const makeGrad = useCallback(() => {
		const canvas = canvasRef.current;
		const ctx = canvas?.getContext("2d");
		if (!(canvas && ctx)) return;

		const {
			analyzerWidth,
			centerX,
			centerY,
			initialX,
			innerRadius,
			outerRadius,
		} = aux.current;
		const { isLumi } = flg.current;
		const isDualVertical = channelLayout === CHANNEL_LAYOUT.DUAL_VERTICAL;
		const analyzerRatio = 1 - reflexRatio;
		const gradientHeight = isLumi
			? canvas.height
			: (canvas.height * (1 - reflexRatio * Number(!isDualVertical))) | 0;
		// for vertical stereo we keep the full canvas height and handle the reflex areas while generating the color stops
		const selectedGrads = gradientSelectRef.current?.value.split(",") || [];

		for (const channel of [0, 1]) {
			const currGradient = gradients[selectedGrads[channel]];
			const colorStops = currGradient.colorStops;
			const isHorizontal = currGradient.dir === "h";

			let grad: CanvasGradient;

			if (radial)
				grad = ctx.createRadialGradient(
					centerX,
					centerY,
					outerRadius,
					centerX,
					centerY,
					innerRadius - (outerRadius - innerRadius) * Number(isDualVertical),
				);
			else
				grad = ctx.createLinearGradient(
					...(isHorizontal
						? ([initialX, 0, initialX + analyzerWidth, 0] as [
								number,
								number,
								number,
								number,
							])
						: ([0, 0, 0, gradientHeight] as [number, number, number, number])),
				);

			if (colorStops) {
				const dual =
					isDualVertical && !splitGradient && (!isHorizontal || radial);

				for (
					let channelArea = 0;
					channelArea < 1 + Number(dual);
					channelArea++
				) {
					const maxIndex = colorStops.length - 1;

					colorStops.forEach((item, index) => {
						let colorStop = item;
						let offset = colorStop.pos;

						// in dual mode (not split), use half the original offset for each channel
						if (dual) offset /= 2;

						// constrain the offset within the useful analyzer areas (avoid reflex areas)
						if (isDualVertical && !isLumi && !radial && !isHorizontal) {
							offset *= analyzerRatio;
							// skip the first reflex area in split mode
							if (!dual && offset > 0.5 * analyzerRatio)
								offset += 0.5 * reflexRatio;
						}

						// only for dual-vertical non-split gradient (creates full gradient on both halves of the canvas)
						if (channelArea === 1) {
							// add colors in reverse order if radial or lumi are active
							if (radial || isLumi) {
								const revIndex = maxIndex - index;
								colorStop = colorStops[revIndex];
								offset = 1 - colorStop.pos / 2;
							} else {
								// if the first offset is not 0, create an additional color stop to prevent bleeding from the first channel
								if (index === 0 && offset > 0)
									grad.addColorStop(0.5, colorStop.color);
								// bump the offset to the second half of the gradient
								offset += 0.5;
							}
						}

						// add gradient color stop
						grad.addColorStop(offset, colorStop.color);

						// create additional color stop at the end of first channel to prevent bleeding
						if (isDualVertical && index === maxIndex && offset < 0.5)
							grad.addColorStop(0.5, colorStop.color);
					});
				} // for ( let channelArea = 0; channelArea < 1 + dual; channelArea++ )
			}

			canvasGradients.current[channel] = grad;
		} // for ( const channel of [0,1] )
	}, [channelLayout, radial, reflexRatio, splitGradient, gradients]);

	const freqScaling = useCallback((freq: number) => {
		switch (frequencyScaleRef.current?.value as FrequencyScale) {
			case FrequencyScale.LOG:
				return Math.log2(freq);
			case FrequencyScale.BARK:
				return (26.81 * freq) / (1960 + freq) - 0.53;
			case FrequencyScale.MEL:
				return Math.log2(1 + freq / 700);
			case FrequencyScale.LINEAR:
				return freq;
		}
	}, []);

	const freqToBin = useCallback(
		(freq: number, method: "floor" | "round" = "round") => {
			const max = fftSize / 2 - 1;
			const bin = Math[method](
				(freq * fftSize) / (audioCtx.current?.sampleRate || 48000),
			);
			return bin < max ? bin : max;
		},
		[fftSize],
	);

	const binToFreq = useCallback(
		(bin: number) => {
			return (bin * (audioCtx.current?.sampleRate || 48000)) / fftSize || 1; // returns 1 for bin 0
		},
		[fftSize],
	);

	const createScales = useCallback(() => {
		if (!(canvasRef.current && canvasXRef.current && canvasRRef.current))
			return;

		const { analyzerWidth, initialX, innerRadius, scaleMin, unitWidth } =
			aux.current;

		const canvasX = canvasXRef.current;
		const scaleX = canvasX.getContext("2d");
		const canvasR = canvasRRef.current;
		const scaleR = canvasR.getContext("2d");
		const canvas = canvasRef.current;
		if (!(scaleX && scaleR)) return;

		const freqLabels: (number | [number, string])[] = [];
		const isDualHorizontal = channelLayout === CHANNEL_LAYOUT.DUAL_HORIZONTAL;
		const isDualVertical = channelLayout === CHANNEL_LAYOUT.DUAL_VERTICAL;
		const minDimension = Math.min(canvas.width, canvas.height);
		const scale = [
			"C",
			undefined,
			"D",
			undefined,
			"E",
			"F",
			undefined,
			"G",
			undefined,
			"A",
			undefined,
			"B",
		]; // for note labels (no sharp notes)
		const scaleHeight = (minDimension / 34) | 0; // circular scale height (radial mode)
		const fontSizeX = canvasX.height >> 1;
		const fontSizeR = scaleHeight >> 1;
		const labelWidthX = fontSizeX * (noteLabels ? 0.7 : 1.5);
		const labelWidthR = fontSizeR * (noteLabels ? 1 : 2);
		const root12 = 2 ** (1 / 12);
		const minFreq = Number(minFreqRef.current?.value) || 20;
		const maxFreq = Number(maxFreqRef.current?.value) || 20000;
		const frequencyScale = frequencyScaleRef.current?.value as FrequencyScale;

		if (!noteLabels && (ansiBands || frequencyScale !== FrequencyScale.LOG)) {
			freqLabels.push(16, 31.5, 63, 125, 250, 500, 1e3, 2e3, 4e3);
			if (frequencyScale === FrequencyScale.LINEAR)
				freqLabels.push(6e3, 8e3, 10e3, 12e3, 14e3, 16e3, 18e3, 20e3, 22e3);
			else freqLabels.push(8e3, 16e3);
		} else {
			let freq = C_1;
			for (let octave = -1; octave < 11; octave++) {
				for (let note = 0; note < 12; note++) {
					if (freq >= minFreq && freq <= maxFreq) {
						const pitch = scale[note];
						const isC = pitch === "C";
						if ((pitch && noteLabels && !mirror && !isDualHorizontal) || isC)
							freqLabels.push(
								noteLabels ? [freq, pitch + (isC ? octave : "")] : freq,
							);
					}
					freq *= root12;
				}
			}
		}

		// in radial dual-vertical layout, the scale is positioned exactly between both channels, by making the canvas a bit larger than the inner diameter
		canvasR.width = canvasR.height = Math.max(
			minDimension * 0.15,
			(innerRadius << 1) + Number(isDualVertical) * scaleHeight,
		);

		const centerR = canvasR.width >> 1;
		const radialY = centerR - scaleHeight * 0.7; // vertical position of text labels in the circular scale

		// helper function
		const radialLabel = (x: number, label: string | number) => {
			const angle = TAU * (x / canvas.width);
			const adjAng = angle - HALF_PI; // rotate angles so 0 is at the top
			const posX = radialY * Math.cos(adjAng);
			const posY = radialY * Math.sin(adjAng);

			scaleR.save();
			scaleR.translate(centerR + posX, centerR + posY);
			scaleR.rotate(angle);
			scaleR.fillText(label.toString(), 0, 0);
			scaleR.restore();
		};

		// clear scale canvas
		canvasX.width |= 0;

		scaleX.fillStyle = scaleR.strokeStyle = SCALEX_BACKGROUND_COLOR;
		scaleX.fillRect(0, 0, canvasX.width, canvasX.height);

		scaleR.arc(centerR, centerR, centerR - scaleHeight / 2, 0, TAU);
		scaleR.lineWidth = scaleHeight;
		scaleR.stroke();

		scaleX.fillStyle = scaleR.fillStyle = SCALEX_LABEL_COLOR;
		scaleX.font = `${fontSizeX}px ${FONT_FAMILY}`;
		scaleR.font = `${fontSizeR}px ${FONT_FAMILY}`;
		scaleX.textAlign = scaleR.textAlign = "center";

		let prevX = -labelWidthX / 4;
		let prevR = -labelWidthR;

		for (const item of freqLabels) {
			const [freq, label] = Array.isArray(item)
				? item
				: [item, item < 1e3 ? item | 0 : `${((item / 100) | 0) / 10}k`];
			const x = unitWidth * (freqScaling(freq) - scaleMin);
			const y = canvasX.height * 0.75;
			const isC = typeof label === "string" && label[0] === "C";
			const maxW =
				fontSizeX *
				(noteLabels && !mirror && !isDualHorizontal ? (isC ? 1.2 : 0.6) : 3);

			// set label color - no highlight when mirror effect is active (only Cs displayed)
			scaleX.fillStyle = scaleR.fillStyle =
				isC && !mirror && !isDualHorizontal
					? SCALEX_HIGHLIGHT_COLOR
					: SCALEX_LABEL_COLOR;

			// prioritizes which note labels are displayed, due to the restricted space on some ranges/scales
			if (noteLabels) {
				const isLog = frequencyScale === FrequencyScale.LOG;
				const isLinear = frequencyScale === FrequencyScale.LINEAR;

				const allowedLabels = ["C"];

				if (
					isLog ||
					freq > 2e3 ||
					(!isLinear && freq > 250) ||
					((!radial || isDualVertical) &&
						((!isLinear && freq > 125) || freq > 1e3))
				)
					allowedLabels.push("G");
				if (
					isLog ||
					freq > 4e3 ||
					(!isLinear && freq > 500) ||
					((!radial || isDualVertical) &&
						((!isLinear && freq > 250) || freq > 2e3))
				)
					allowedLabels.push("E");
				if (
					(isLinear && freq > 4e3) ||
					((!radial || isDualVertical) &&
						(isLog || freq > 2e3 || (!isLinear && freq > 500)))
				)
					allowedLabels.push("D", "F", "A", "B");
				if (!allowedLabels.includes((label as string)[0])) continue; // skip this label
			}

			// linear scale
			if (x >= prevX + labelWidthX / 2 && x <= analyzerWidth) {
				scaleX.fillText(
					label.toString(),
					isDualHorizontal && mirror === -1 ? analyzerWidth - x : initialX + x,
					y,
					maxW,
				);
				if (isDualHorizontal || (mirror && (x > labelWidthX || mirror === 1)))
					scaleX.fillText(
						label.toString(),
						isDualHorizontal && mirror !== 1
							? analyzerWidth + x
							: (initialX || canvas.width) - x,
						y,
						maxW,
					);
				prevX =
					x + Math.min(maxW, scaleX.measureText(label.toString()).width) / 2;
			}

			// radial scale
			if (x >= prevR + labelWidthR && x < analyzerWidth - labelWidthR) {
				// avoid overlapping the last label over the first one
				radialLabel(
					isDualHorizontal && mirror === 1 ? analyzerWidth - x : x,
					label,
				);
				if (isDualHorizontal || (mirror && (x > labelWidthR || mirror === 1)))
					// avoid overlapping of first labels on mirror mode
					radialLabel(
						isDualHorizontal && mirror !== -1 ? analyzerWidth + x : -x,
						label,
					);
				prevR = x;
			}
		}
	}, [mirror, noteLabels, channelLayout, radial, ansiBands, freqScaling]);

	const calcBars = useCallback(() => {
		if (!canvasRef.current) return;
		const canvas = canvasRef.current;
		bars.current = [];
		let newBars: AnalyzerBarData[] = bars.current; // initialize object property

		//TODO: check if needed

		/**
		if (!this._ready) {
			this._flg = {
				isAlpha: false,
				isBands: false,
				isLeds: false,
				isLumi: false,
				isOctaves: false,
				isOutline: false,
				isRound: false,
				noLedGap: false,
			};
			return;
		}
			*/

		const centerX = canvas.width >> 1;
		const centerY = canvas.height >> 1;
		const isDualVertical =
			channelLayout === CHANNEL_LAYOUT.DUAL_VERTICAL && !radial;
		const isDualHorizontal = channelLayout === CHANNEL_LAYOUT.DUAL_HORIZONTAL;
		// COMPUTE FLAGS
		const mode = Number(modeInputRef.current?.value) as Mode;
		const minFreq = Number(minFreqRef.current?.value) || 20;
		const maxFreq = Number(maxFreqRef.current?.value) || 20000;
		const frequencyScale = frequencyScaleRef.current?.value as FrequencyScale;
		const isBands = mode % 10 !== 0; // true for modes 1 to 9

		const isOctaves = isBands && frequencyScale === FrequencyScale.LOG;
		const isLeds = showLeds && isBands && !radial;
		const isLumi = lumiBars && isBands && !radial;
		const isAlpha = alphaBars && !isLumi && mode !== MODE_GRAPH;
		const isOutline = outlineBars && isBands && !isLumi && !isLeds;
		const isRound = roundBars && isBands && !isLumi && !isLeds;
		const noLedGap =
			channelLayout !== CHANNEL_LAYOUT.DUAL_VERTICAL ||
			(reflexRatio > 0 && !isLumi);
		// COMPUTE AUXILIARY VALUES
		// channelHeight is the total canvas height dedicated to each channel, including the reflex area, if any)
		const channelHeight =
			(canvas.height - (isDualVertical && !isLeds ? 0.5 : 0)) >>
			Number(isDualVertical);
		// analyzerHeight is the effective height used to render the analyzer, excluding the reflex area
		const analyzerHeight =
			(channelHeight * (isLumi || radial ? 1 : 1 - reflexRatio)) | 0;
		const analyzerWidth =
			canvas.width - centerX * Number(isDualHorizontal || mirror !== 0);
		// channelGap is **0** if isLedDisplay == true (LEDs already have spacing); **1** if canvas height is odd (windowed); **2** if it's even
		// TODO: improve this, make it configurable?
		const channelGap = isDualVertical ? canvas.height - channelHeight * 2 : 0;
		const initialX =
			centerX * Number(mirror === -1 && !isDualHorizontal && !radial);

		let innerRadius =
			(Math.min(canvas.width, canvas.height) *
				0.375 *
				(channelLayout === CHANNEL_LAYOUT.DUAL_VERTICAL ? 1 : radius)) |
			0;
		let outerRadius = Math.min(centerX, centerY);

		if (radialInvert && channelLayout !== CHANNEL_LAYOUT.DUAL_VERTICAL)
			[innerRadius, outerRadius] = [outerRadius, innerRadius];

		/**
		 *	CREATE ANALYZER BANDS
		 *
		 *	USES:
		 *		analyzerWidth
		 *		initialX
		 *		isBands
		 *		isOctaves
		 *
		 *	GENERATES:
		 *		bars (populates this.bars.current)
		 *		bardWidth
		 *		scaleMin
		 *		unitWidth
		 */

		// helper function to add a bar to the bars array
		// bar object format:
		// {
		//	 posX,
		//   freq,
		//   freqLo,
		//   freqHi,
		//   binLo,
		//   binHi,
		//   ratioLo,
		//   ratioHi,
		//   peak,    // peak value
		//   hold,    // peak hold frames (negative value indicates peak falling / fading)
		//   alpha,   // peak alpha (used by fadePeaks)
		//   value    // current bar value
		// }
		const barsPush = (
			args: Omit<
				AnalyzerBarData,
				"peak" | "hold" | "alpha" | "value" | "width" | "barCenter"
			>,
		) =>
			newBars.push({
				...args,
				peak: [0, 0],
				hold: [0, 0],
				alpha: [0, 0],
				value: [0, 0],
				width: 0,
				barCenter: 0,
			});

		/*
			A simple interpolation is used to obtain an approximate amplitude value for any given frequency,
			from the available FFT data. We find the FFT bin which closer matches the desired frequency	and
			interpolate its value with that of the next adjacent bin, like so:

				v = v0 + ( v1 - v0 ) * ( log2( f / f0 ) / log2( f1 / f0 ) )
				                       \__________________________________/
				                                        |
				                                      ratio
				where:

				f  - desired frequency
				v  - amplitude (volume) of desired frequency
				f0 - frequency represented by the lower FFT bin
				f1 - frequency represented by the upper FFT bin
				v0 - amplitude of f0
				v1 - amplitude of f1

			ratio is calculated in advance here, to reduce computational complexity during real-time rendering.
		*/

		// helper function to calculate FFT bin and interpolation ratio for a given frequency
		const calcRatio = (freq: number) => {
			const bin = freqToBin(freq, "floor"); // find closest FFT bin
			const lower = binToFreq(bin);
			const upper = binToFreq(bin + 1);

			const ratio = Math.log2(freq / lower) / Math.log2(upper / lower);

			return [bin, ratio];
		};

		let barWidth: number;
		let scaleMin: number;
		let unitWidth: number;

		if (isOctaves) {
			// helper function to round a value to a given number of significant digits
			// `atLeast` set to true prevents reducing the number of integer significant digits
			const roundSD = (value: number, digits: number, atLeast?: boolean) =>
				+value.toPrecision(
					atLeast ? Math.max(digits, (1 + Math.log10(value)) | 0) : digits,
				);

			// helper function to find the nearest preferred number (Renard series) for a given value
			const nearestPreferred = (value: number) => {
				// R20 series is used here, as it provides closer approximations for 1/2 octave bands (non-standard)
				const preferred = [
					1, 1.12, 1.25, 1.4, 1.6, 1.8, 2, 2.24, 2.5, 2.8, 3.15, 3.55, 4, 4.5,
					5, 5.6, 6.3, 7.1, 8, 9, 10,
				];
				const power = Math.log10(value) | 0;
				const normalized = value / 10 ** power;

				let i = 1;
				while (i < preferred.length && normalized > preferred[i]) i++;

				if (normalized - preferred[i - 1] < preferred[i] - normalized) i--;

				return ((preferred[i] * 10 ** (power + 5)) | 0) / 1e5; // keep 5 significant digits
			};

			// ANSI standard octave bands use the base-10 frequency ratio, as preferred by [ANSI S1.11-2004, p.2]
			// The equal-tempered scale uses the base-2 ratio
			const bands = [0, 24, 12, 8, 6, 4, 3, 2, 1][mode];
			const bandWidth = ansiBands ? 10 ** (3 / (bands * 10)) : 2 ** (1 / bands); // 10^(3/10N) or 2^(1/N)
			const halfBand = bandWidth ** 0.5;

			let currFreq = ansiBands ? 7.94328235 / (bands % 2 ? 1 : halfBand) : C_1;
			// For ANSI bands with even denominators (all except 1/1 and 1/3), the reference frequency (1 kHz)
			// must fall on the edges of a pair of adjacent bands, instead of midband [ANSI S1.11-2004, p.2]
			// In the equal-tempered scale, all midband frequencies represent a musical note or quarter-tone.

			do {
				let freq = currFreq; // midband frequency

				const freqLo = roundSD(freq / halfBand, 4, true); // lower edge frequency
				const freqHi = roundSD(freq * halfBand, 4, true); // upper edge frequency
				const [binLo, ratioLo] = calcRatio(freqLo);
				const [binHi, ratioHi] = calcRatio(freqHi);

				// for 1/1, 1/2 and 1/3 ANSI bands, use the preferred numbers to find the nominal midband frequency
				// for 1/4 to 1/24, round to 2 or 3 significant digits, according to the MSD [ANSI S1.11-2004, p.12]
				if (ansiBands)
					freq =
						bands < 4
							? nearestPreferred(freq)
							: roundSD(freq, Number.parseInt(freq.toString()[0]) < 5 ? 3 : 2);
				else freq = roundSD(freq, 4, true);

				if (freq >= minFreq)
					barsPush({
						posX: 0,
						freq,
						freqLo,
						freqHi,
						binLo,
						binHi,
						ratioLo,
						ratioHi,
					});

				currFreq *= bandWidth;
			} while (currFreq <= maxFreq);

			barWidth = analyzerWidth / newBars.length;

			newBars = newBars.map((bar, index) => ({
				...bar,
				posX: initialX + index * barWidth,
			}));

			const firstBar = newBars[0];
			const lastBar = newBars[newBars.length - 1];

			scaleMin = freqScaling(firstBar.freqLo);
			unitWidth = analyzerWidth / (freqScaling(lastBar.freqHi) - scaleMin);

			// clamp edge frequencies to minFreq / maxFreq, if necessary
			// this is done after computing scaleMin and unitWidth, for the proper positioning of labels on the X-axis
			if (firstBar.freqLo && firstBar.freqLo < minFreq) {
				firstBar.freqLo = minFreq;
				[firstBar.binLo, firstBar.ratioLo] = calcRatio(minFreq);
			}

			if (lastBar.freqHi && lastBar.freqHi > maxFreq) {
				lastBar.freqHi = maxFreq;
				[lastBar.binHi, lastBar.ratioHi] = calcRatio(maxFreq);
			}
		} else if (isBands) {
			// a bands mode is selected, but frequency scale is not logarithmic

			const bands = [0, 24, 12, 8, 6, 4, 3, 2, 1][mode] * 10;

			const invFreqScaling = (x: number) => {
				switch (frequencyScale) {
					case FrequencyScale.BARK:
						return 1960 / (26.81 / (x + 0.53) - 1);
					case FrequencyScale.MEL:
						return 700 * (2 ** x - 1);
					case FrequencyScale.LINEAR:
						return x;
					case FrequencyScale.LOG:
						return 10 ** x;
				}
			};

			barWidth = analyzerWidth / bands;

			scaleMin = freqScaling(minFreq);
			unitWidth = analyzerWidth / (freqScaling(maxFreq) - scaleMin);

			for (let i = 0, posX = 0; i < bands; i++, posX += barWidth) {
				const freqLo = invFreqScaling(scaleMin + posX / unitWidth);
				const freq = invFreqScaling(
					scaleMin + (posX + barWidth / 2) / unitWidth,
				);
				const freqHi = invFreqScaling(scaleMin + (posX + barWidth) / unitWidth);
				const [binLo, ratioLo] = calcRatio(freqLo);
				const [binHi, ratioHi] = calcRatio(freqHi);

				barsPush({
					posX: initialX + posX,
					freq,
					freqLo,
					freqHi,
					binLo,
					binHi,
					ratioLo,
					ratioHi,
				});
			}
		} else {
			// Discrete frequencies modes
			barWidth = 1;

			scaleMin = freqScaling(minFreq);
			unitWidth = analyzerWidth / (freqScaling(maxFreq) - scaleMin);

			const minIndex = freqToBin(minFreq, "floor");
			const maxIndex = freqToBin(maxFreq);

			let lastPos = -999;

			for (let i = minIndex; i <= maxIndex; i++) {
				const freq = binToFreq(i); // frequency represented by this index
				const posX =
					initialX + Math.round(unitWidth * (freqScaling(freq) - scaleMin)); // avoid fractionary pixel values

				// if it's on a different X-coordinate, create a new bar for this frequency
				if (posX > lastPos) {
					barsPush({
						posX,
						freq,
						freqLo: freq,
						freqHi: freq,
						binLo: i,
						binHi: i,
						ratioLo: 0,
						ratioHi: 0,
					});
					lastPos = posX;
				} // otherwise, add this frequency to the last bar's range
				else if (newBars.length) {
					const lastBar = newBars[newBars.length - 1];
					lastBar.binHi = i;
					lastBar.freqHi = freq;
					lastBar.freq = (lastBar.freqLo * freq) ** 0.5; // compute center frequency (geometric mean)
				}
			}
		}

		/**
		 *  COMPUTE ATTRIBUTES FOR THE LED BARS
		 *
		 *	USES:
		 *		analyzerHeight
		 *		barWidth
		 *		noLedGap
		 *
		 *	GENERATES:
		 * 		spaceH
		 * 		spaceV
		 *		this._leds
		 */

		let spaceH = 0;
		let spaceV = 0;

		if (isLeds) {
			// adjustment for high pixel-ratio values on low-resolution screens (Android TV)
			const dPR =
				pixelRatio.current /
				(window.devicePixelRatio > 1 && window.screen.height <= 540 ? 2 : 1);

			const ledParams = [
				[],
				[128, 3, 0.45], // mode 1
				[128, 4, 0.225], // mode 2
				[96, 6, 0.225], // mode 3
				[80, 6, 0.225], // mode 4
				[80, 6, 0.125], // mode 5
				[64, 6, 0.125], // mode 6
				[48, 8, 0.125], // mode 7
				[24, 16, 0.125], // mode 8
			][mode];

			const [maxLeds, spaceVRatio, spaceHRatio] = ledParams;

			let ledCount = 0;
			let maxHeight = analyzerHeight;

			// calculate vertical spacing - aim for the reference ratio, but make sure it's at least 2px
			const refRatio = 540 / spaceVRatio;
			spaceV = Math.min(
				spaceVRatio * dPR,
				Math.max(2, (maxHeight / refRatio + 0.1) | 0),
			);
			/**
			if (customParams) {
				const minHeight = 2 * dPR;
				let blockHeight: number;
				ledCount = maxLeds + 1;
				do {
					ledCount--;
					blockHeight = maxHeight / ledCount / (1 + spaceVRatio);
					spaceV = blockHeight * spaceVRatio;
				} while (
					(blockHeight < minHeight || spaceV < minHeight) &&
					ledCount > 1
				);
			} else {
				// calculate vertical spacing - aim for the reference ratio, but make sure it's at least 2px
				const refRatio = 540 / spaceVRatio;
				spaceV = Math.min(
					spaceVRatio * dPR,
					Math.max(2, (maxHeight / refRatio + 0.1) | 0),
				);
			}
			*/

			// remove the extra spacing below the last line of LEDs
			if (noLedGap) maxHeight += spaceV;

			// recalculate the number of leds, considering the effective spaceV
			//if (!customParams)
			ledCount = Math.min(maxLeds, (maxHeight / (spaceV * 2)) | 0);

			spaceH = spaceHRatio >= 1 ? spaceHRatio : barWidth * spaceHRatio;

			leds.current = [
				ledCount,
				spaceH,
				spaceV,
				maxHeight / ledCount - spaceV, // ledHeight
			];
		}

		// COMPUTE ADDITIONAL BAR POSITIONING, ACCORDING TO THE CURRENT SETTINGS
		// uses: bars.currentpace, barWidth, spaceH

		const barSpacePx = Math.min(
			barWidth - 1,
			barSpace * (barSpace > 0 && barSpace < 1 ? barWidth : 1),
		);

		if (isBands) barWidth -= Math.max(isLeds ? spaceH : 0, barSpacePx);

		newBars.forEach((bar, index) => {
			let posX = bar.posX;
			let width = barWidth;

			// in bands modes we need to update bar.posX to account for bar/led spacing

			if (isBands) {
				if (barSpace === 0 && !isLeds) {
					// when barSpace == 0 use integer values for perfect gapless positioning
					posX |= 0;
					width |= 0;
					if (
						index > 0 &&
						posX > newBars[index - 1].posX + newBars[index - 1].width
					) {
						posX--;
						width++;
					}
				} else posX += Math.max(isLeds ? spaceH : 0, barSpacePx) / 2;

				bar.posX = posX; // update
			}

			bar.barCenter = posX + (barWidth === 1 ? 0 : width / 2);
			bar.width = width;
		});
		bars.current = newBars;

		// COMPUTE CHANNEL COORDINATES (uses spaceV)

		const channelCoords: {
			channelTop: number;
			channelBottom: number;
			analyzerBottom: number;
		}[] = [];
		for (const channel of [0, 1]) {
			const channelTop =
				channelLayout === CHANNEL_LAYOUT.DUAL_VERTICAL
					? (channelHeight + channelGap) * channel
					: 0;
			const channelBottom = channelTop + channelHeight;
			const analyzerBottom =
				channelTop + analyzerHeight - (!isLeds || noLedGap ? 0 : spaceV);

			channelCoords.push({ channelTop, channelBottom, analyzerBottom });
		}

		// SAVE INTERNAL PROPERTIES

		aux.current = {
			analyzerHeight,
			analyzerWidth,
			centerX,
			centerY,
			channelCoords,
			channelHeight,
			channelGap,
			initialX,
			innerRadius,
			outerRadius,
			scaleMin,
			unitWidth,
		};
		flg.current = {
			isAlpha,
			isBands,
			isLeds,
			isLumi,
			isOctaves,
			isOutline,
			isRound,
			noLedGap,
		};

		// generate the X-axis and radial scales
		createScales();
	}, [
		alphaBars,
		ansiBands,
		barSpace,
		channelLayout,
		lumiBars,
		radial,
		radialInvert,
		roundBars,
		showLeds,
		freqScaling,
		freqToBin,
		mirror,
		outlineBars,
		radius,
		createScales,
		reflexRatio,
		binToFreq,
	]);

	// Update canvas size on container / window resize and fullscreen events

	// Fullscreen changes are handled quite differently across browsers:
	// 1. Chromium browsers will trigger a `resize` event followed by a `fullscreenchange`
	// 2. Firefox triggers the `fullscreenchange` first and then the `resize`
	// 3. Chrome on Android (TV) won't trigger a `resize` event, only `fullscreenchange`
	// 4. Safari won't trigger `fullscreenchange` events at all, and on iPadOS the `resize`
	//    event is triggered **on the window** only (last tested on iPadOS 14)

	// helper function for resize events

	const onResize = useCallback(() => {
		if (!fsTimeout.current) {
			// delay the resize to prioritize a possible following `fullscreenchange` event
			fsTimeout.current = window.setTimeout(() => {
				if (canvasRef.current && canvasXRef.current && containerRef.current) {
					const scaleX = canvasXRef.current.getContext("2d");
					const ctx = canvasRef.current.getContext("2d");
					if (scaleX && ctx && !fsChanging.current) {
						setCanvas({
							reason: REASON.RESIZE,
							ready: true,
							isFullscreen: isFullscreen,
							fsEl: canvasRef.current,
							container: containerRef.current,
							canvas: canvasRef.current,
							scaleX: scaleX,
							loRes: false,
							ctx: ctx,
							setPixelRatio: (ratio: number) => {
								pixelRatio.current = ratio;
							},
							defaultHeight,
							defaultWidth,
							overlay,
							calcBars,
							height,
							width,
						});
						makeGrad();
						fsTimeout.current = 0;
					}
				}
			}, DEBOUNCE_TIMEOUT);
		}
	}, [calcBars, isFullscreen, overlay, makeGrad, height, width]);

	const toggleFullscreen = () => {
		if (isFullscreen) {
			if (document.exitFullscreen) document.exitFullscreen();
			else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
		} else {
			const fsEl = canvasRef.current;
			if (!fsEl) return;
			if (fsEl.requestFullscreen) fsEl.requestFullscreen();
			else if (fsEl.webkitRequestFullscreen) fsEl.webkitRequestFullscreen();
		}
	};

	const normalizedB = (value: number) => {
		const isLinear = linearAmplitude;
		const boost = isLinear ? 1 / linearBoost : 1;
		const clamp = (val: number, min: number, max: number) =>
			val <= min ? min : val >= max ? max : val;
		const dBToLinear = (val: number) => 10 ** (val / 20);

		let maxValue = maxDecibels;
		let minValue = minDecibels;
		let newValue = value;

		if (isLinear) {
			maxValue = dBToLinear(maxValue);
			minValue = dBToLinear(minValue);
			newValue = dBToLinear(value) ** boost;
		}

		return clamp((newValue - minValue) / (maxValue - minValue) ** boost, 0, 1);
	};

	const draw = (timestamp: number) => {
		const signal = latestSignal.current;
		runId.current = requestAnimationFrame(draw);
		const elapsed = timestamp - time.current; // time since last FPS computation
		const frameTime = timestamp - last.current; // time since last rendered frame
		const targetInterval = maxFPS ? 975 / maxFPS : 0; // small tolerance for best results

		if (frameTime < targetInterval) return;

		last.current =
			timestamp - (targetInterval ? frameTime % targetInterval : 0);
		frames.current++;

		if (elapsed >= 1000) {
			// update FPS every second
			fps.current = (frames.current / elapsed) * 1000;
			frames.current = 0;
			time.current = timestamp;
		}
		// initialize local constants

		const {
			isAlpha,
			isBands,
			isLeds,
			isLumi,
			isOctaves,
			isOutline,
			isRound,
			noLedGap,
		} = flg.current;
		const {
			analyzerHeight,
			centerX,
			centerY,
			channelCoords,
			channelHeight,
			channelGap,
			initialX,
			innerRadius,
			outerRadius,
		} = aux.current;

		const canvasX = canvasXRef.current;
		const canvasR = canvasRRef.current;
		const canvas = canvasRef.current;
		if (!(canvasX && canvasR && canvas)) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const fadeFrames = (fps.current * peakFadeTime) / 1e3;
		const fpsSquared = fps.current ** 2;
		const gravity = 3.8 * 1e3; // make configurable
		const holdFrames = (fps.current * peakHoldTime) / 1e3;
		const isDualCombined = channelLayout === CHANNEL_LAYOUT.DUAL_COMBINED;
		const isDualHorizontal = channelLayout === CHANNEL_LAYOUT.DUAL_HORIZONTAL;
		const isDualVertical = channelLayout === CHANNEL_LAYOUT.DUAL_VERTICAL;
		const isSingle = channelLayout === CHANNEL_LAYOUT.SINGLE;
		const colorMode = colorModeSelectRef.current?.value;
		const isTrueLeds = isLeds && trueLeds && colorMode === COLOR_GRADIENT;
		const analyzerWidth = radial ? canvas.width : aux.current.analyzerWidth;
		const finalX = initialX + analyzerWidth;
		const mode = Number(modeInputRef.current?.value) as Mode;
		const showPeakLine = showPeaks && peakLine && mode === MODE_GRAPH;
		const maxBarHeight = radial ? outerRadius - innerRadius : analyzerHeight;
		const nominalMaxHeight = maxBarHeight / pixelRatio.current; // for consistent gravity on lo-res or hi-dpi
		const dbRange = maxDecibels - minDecibels;
		const [ledCount, ledSpaceH, ledSpaceV, ledHeight] = leds.current || [];

		if (energy.current.val > 0 && fps.current > 0)
			spinAngle.current += (spinSpeed * TAU) / 60 / fps.current; // spinSpeed * angle increment per frame for 1 RPM

		/* HELPER FUNCTIONS */

		// create Reflex effect
		const doReflex = (channel: number) => {
			if (reflexRatio > 0 && !isLumi && !radial) {
				let posY: number;
				let height: number;
				if (reflexFit || isDualVertical) {
					// always fit reflex in vertical stereo mode
					posY =
						isDualVertical && channel === 0 ? channelHeight + channelGap : 0;
					height = channelHeight - analyzerHeight;
				} else {
					posY = canvas.height - analyzerHeight * 2;
					height = analyzerHeight;
				}

				ctx.save();

				// set alpha and brightness for the reflection
				ctx.globalAlpha = reflexAlpha;
				if (reflexBright !== 1) ctx.filter = `brightness(${reflexBright})`;

				// create the reflection
				ctx.setTransform(1, 0, 0, -1, 0, canvas.height);
				ctx.drawImage(
					canvas,
					0,
					channelCoords[channel].channelTop,
					canvas.width,
					analyzerHeight,
					0,
					posY,
					canvas.width,
					height,
				);

				ctx.restore();
			}
		};

		// draw scale on X-axis
		const drawScaleX = () => {
			if (showScaleX) {
				if (radial) {
					ctx.save();
					ctx.translate(centerX, centerY);
					if (spinSpeed) ctx.rotate(spinAngle.current + HALF_PI);
					ctx.drawImage(canvasR, -canvasR.width >> 1, -canvasR.width >> 1);
					ctx.restore();
				} else ctx.drawImage(canvasX, 0, canvas.height - canvasX.height);
			}
		};

		// returns the gain (in dB) for a given frequency, considering the currently selected weighting filter
		const weightingdB = (freq: number) => {
			const f2 = freq ** 2;
			const SQ20_6 = 424.36;
			const SQ107_7 = 11599.29;
			const SQ158_5 = 25122.25;
			const SQ737_9 = 544496.41;
			const SQ12194 = 148693636;
			const linearTodB = (value: number) => 20 * Math.log10(value);

			switch (weightingFilter) {
				case FILTER.A: {
					// A-weighting https://en.wikipedia.org/wiki/A-weighting
					const rA =
						(SQ12194 * f2 ** 2) /
						((f2 + SQ20_6) *
							Math.sqrt((f2 + SQ107_7) * (f2 + SQ737_9)) *
							(f2 + SQ12194));
					return 2 + linearTodB(rA);
				}

				case FILTER.B: {
					const rB =
						(SQ12194 * f2 * freq) /
						((f2 + SQ20_6) * Math.sqrt(f2 + SQ158_5) * (f2 + SQ12194));
					return 0.17 + linearTodB(rB);
				}

				case FILTER.C: {
					const rC = (SQ12194 * f2) / ((f2 + SQ20_6) * (f2 + SQ12194));
					return 0.06 + linearTodB(rC);
				}

				case FILTER.D: {
					const h =
						((1037918.48 - f2) ** 2 + 1080768.16 * f2) /
						((9837328 - f2) ** 2 + 11723776 * f2);
					const rD =
						(freq / 6.8966888496476e-5) *
						Math.sqrt(h / ((f2 + 79919.29) * (f2 + 1345600)));
					return linearTodB(rD);
				}

				case FILTER.FOUR_SIX_EIGHT: {
					// ITU-R 468 https://en.wikipedia.org/wiki/ITU-R_468_noise_weighting
					const h1 =
						-4.737338981378384e-24 * freq ** 6 +
						2.043828333606125e-15 * freq ** 4 -
						1.363894795463638e-7 * f2 +
						1;
					const h2 =
						1.306612257412824e-19 * freq ** 5 -
						2.118150887518656e-11 * freq ** 3 +
						5.559488023498642e-4 * freq;
					const rI = (1.246332637532143e-4 * freq) / Math.hypot(h1, h2);
					return 18.2 + linearTodB(rI);
				}
			}

			return 0; // unknown filter
		};

		// draws (stroke) a bar from x,y1 to x,y2
		const strokeBar = (x: number, y1: number, y2: number) => {
			ctx.beginPath();
			ctx.moveTo(x, y1);
			ctx.lineTo(x, y2);
			ctx.stroke();
		};

		// conditionally strokes current path on canvas
		const strokeIf = (flag?: boolean) => {
			if (flag && lineWidth) {
				const alpha = ctx.globalAlpha;
				ctx.globalAlpha = 1;
				ctx.stroke();
				ctx.globalAlpha = alpha;
			}
		};

		// converts a value in [0;1] range to a height in pixels that fits into the current LED elements
		const ledPosY = (value: number) =>
			Math.max(
				0,
				((value * ledCount) | 0) * (ledHeight + ledSpaceV) - ledSpaceV,
			);

		// update energy information
		const updateEnergy = (newVal: number) => {
			energy.current.val = newVal;
			if (energy.current.peak > 0) {
				energy.current.hold--;
				if (energy.current.hold < 0)
					energy.current.peak +=
						((energy.current.hold * gravity) / fpsSquared / canvas.height) *
						pixelRatio.current;
				// TO-DO: replace `canvas.height * this._pixelRatio` with `maxNominalHeight` when implementing dual-channel energy
			}
			if (newVal >= energy.current.peak) {
				energy.current.peak = newVal;
				energy.current.hold = holdFrames;
			}
		};

		/* MAIN FUNCTION */

		if (overlay) ctx.clearRect(0, 0, canvas.width, canvas.height);

		let currentEnergy = 0;

		const nBars = bars.current.length;
		const nChannels = isSingle ? 1 : 2;
		if (!gradientSelectRef.current) return;
		const selectedGrads = gradientSelectRef.current?.value.split(",");

		for (let channel = 0; channel < nChannels; channel++) {
			const { channelTop, channelBottom, analyzerBottom } =
				channelCoords[channel];
			const channelGradient = gradients[selectedGrads[channel]];
			const colorStops = channelGradient.colorStops;
			const colorCount = colorStops.length;
			const bgColor =
				!showBgColor || (isLeds && !overlay) ? "#000" : channelGradient.bgColor;
			const radialDirection = isDualVertical && radial && channel ? -1 : 1; // 1 = outwards, -1 = inwards
			const invertedChannel =
				(!channel && mirror === -1) || (channel && mirror === 1);
			const radialOffsetX =
				!isDualHorizontal || (channel && mirror !== 1)
					? 0
					: analyzerWidth >> Number(channel || !invertedChannel);
			const angularDirection = isDualHorizontal && invertedChannel ? -1 : 1; // 1 = clockwise, -1 = counterclockwise
			/*
				Expanded logic for radialOffsetX and angularDirection:
	
				let radialOffsetX = 0,
					angularDirection = 1;
	
				if ( isDualHorizontal ) {
					if ( channel == 0 ) { // LEFT channel
						if ( mirror == -1 ) {
							radialOffsetX = analyzerWidth;
							angularDirection = -1;
						}
						else
							radialOffsetX = analyzerWidth >> 1;
					}
					else {                // RIGHT channel
						if ( mirror == 1 ) {
							radialOffsetX = analyzerWidth >> 1;
							angularDirection = -1;
						}
					}
				}
	*/
			// draw scale on Y-axis (uses: channel, channelTop)
			const drawScaleY = () => {
				const scaleWidth = canvasX.height;
				const fontSize = scaleWidth >> 1;
				const max = linearAmplitude ? 100 : maxDecibels;
				const min = linearAmplitude ? 0 : minDecibels;
				const incr = linearAmplitude ? 20 : 5;
				const interval = analyzerHeight / (max - min);
				const atStart =
					mirror !== -1 && (!isDualHorizontal || channel === 0 || mirror === 1);
				const atEnd = mirror !== 1 && (!isDualHorizontal || channel !== mirror);

				ctx.save();
				ctx.fillStyle = SCALEY_LABEL_COLOR;
				ctx.font = `${fontSize}px ${FONT_FAMILY}`;
				ctx.textAlign = "right";
				ctx.lineWidth = 1;

				for (let val = max; val > min; val -= incr) {
					const posY = channelTop + (max - val) * interval;
					const even = Number(val % 2 === 0) | 0;

					if (even) {
						const labelY = posY + fontSize * (posY === channelTop ? 0.8 : 0.35);
						if (atStart)
							ctx.fillText(val.toString(), scaleWidth * 0.85, labelY);
						if (atEnd)
							ctx.fillText(
								val.toString(),
								(isDualHorizontal ? analyzerWidth : canvas.width) -
									scaleWidth * 0.1,
								labelY,
							);
						ctx.strokeStyle = SCALEY_LABEL_COLOR;
						ctx.setLineDash([2, 4]);
						ctx.lineDashOffset = 0;
					} else {
						ctx.strokeStyle = SCALEY_MIDLINE_COLOR;
						ctx.setLineDash([2, 8]);
						ctx.lineDashOffset = 1;
					}

					ctx.beginPath();
					ctx.moveTo(
						initialX + scaleWidth * even * Number(atStart),
						~~posY + 0.5,
					); // for sharp 1px line (https://stackoverflow.com/a/13879402/2370385)
					ctx.lineTo(finalX - scaleWidth * even * Number(atEnd), ~~posY + 0.5);
					ctx.stroke();
				}
				ctx.restore();
			};

			// FFT bin data interpolation (uses fftData)
			const interpolate = (bin: number, ratio: number) => {
				const value =
					fftData[bin] +
					(bin < fftData.length - 1
						? (fftData[bin + 1] - fftData[bin]) * ratio
						: 0);
				return Number.isNaN(value) ? Number.NEGATIVE_INFINITY : value;
			};

			// converts a given X-coordinate to its corresponding angle in radial mode (uses angularDirection)
			const getAngle = (x: number, dir = angularDirection) =>
				dir * TAU * ((x + radialOffsetX) / canvas.width) + spinAngle.current;

			// converts planar X,Y coordinates to radial coordinates (uses: getAngle(), radialDirection)
			const radialXY = (
				x: number,
				y: number,
				dir?: number,
			): [number, number] => {
				const height = innerRadius + y * radialDirection;
				const angle = getAngle(x, dir);
				return [
					centerX + height * Math.cos(angle),
					centerY + height * Math.sin(angle),
				];
			};

			// draws a polygon of width `w` and height `h` at (x,y) in radial mode (uses: angularDirection, radialDirection)
			const radialPoly = (
				x: number,
				y: number,
				w: number,
				h: number,
				stroke?: boolean,
			) => {
				ctx.beginPath();
				for (const dir of mirror && !isDualHorizontal
					? [1, -1]
					: [angularDirection]) {
					const [startAngle, endAngle] = isRound
						? [getAngle(x, dir), getAngle(x + w, dir)]
						: [];
					ctx.moveTo(...radialXY(x, y, dir));
					ctx.lineTo(...radialXY(x, y + h, dir));
					if (isRound)
						ctx.arc(
							centerX,
							centerY,
							innerRadius + (y + h) * radialDirection,
							startAngle as number,
							endAngle as number,
							dir !== 1,
						);
					else ctx.lineTo(...radialXY(x + w, y + h, dir));
					ctx.lineTo(...radialXY(x + w, y, dir));
					if (isRound && !stroke)
						// close the bottom line only when not in outline mode
						ctx.arc(
							centerX,
							centerY,
							innerRadius + y * radialDirection,
							endAngle as number,
							startAngle as number,
							dir === 1,
						);
				}
				strokeIf(stroke);
				ctx.fill();
			};

			// set fillStyle and strokeStyle according to current colorMode (uses: channel, colorStops, colorCount)
			const setBarColor = (value = 0, barIndex = 0) => {
				let color: CanvasGradient | string;
				// for graph mode, always use the channel gradient (ignore colorMode)
				if (
					(colorMode === COLOR_GRADIENT && !isTrueLeds) ||
					mode === MODE_GRAPH
				)
					color = canvasGradients.current[channel];
				else {
					const selectedIndex =
						colorMode === COLOR_BAR_INDEX
							? barIndex % colorCount
							: colorStops.findLastIndex((item) =>
									isLeds
										? ledPosY(value) <= ledPosY(item.level)
										: value <= item.level,
								);
					color = colorStops[selectedIndex].color;
				}
				ctx.fillStyle = ctx.strokeStyle = color;
			};

			// CHANNEL START

			if (useCanvas) {
				// set transform (horizontal flip and translation) for dual-horizontal layout
				if (isDualHorizontal && !radial) {
					const translateX =
						analyzerWidth * (channel + Number(invertedChannel));
					const flipX = invertedChannel ? -1 : 1;

					ctx.setTransform(flipX, 0, 0, 1, translateX, 0);
				}

				// fill the analyzer background if needed (not overlay or overlay + showBgColor)
				if (!overlay || showBgColor) {
					if (overlay) ctx.globalAlpha = bgAlpha;

					ctx.fillStyle = bgColor;

					// exclude the reflection area when overlay is true and reflexAlpha == 1 (avoids alpha over alpha difference, in case bgAlpha < 1)
					if (channel === 0 || !(radial || isDualCombined))
						ctx.fillRect(
							initialX,
							channelTop - channelGap,
							analyzerWidth,
							(overlay && reflexAlpha === 1 ? analyzerHeight : channelHeight) +
								channelGap,
						);

					ctx.globalAlpha = 1;
				}

				// draw dB scale (Y-axis) - avoid drawing it twice on 'dual-combined' channel layout
				if (
					showScaleY &&
					!isLumi &&
					!radial &&
					(channel === 0 || !isDualCombined)
				)
					drawScaleY();

				// set line width and dash for LEDs effect
				if (isLeds) {
					ctx.setLineDash([ledHeight, ledSpaceV]);
					ctx.lineWidth = bars.current[0].width;
				} // for outline effect ensure linewidth is not greater than half the bar width
				else
					ctx.lineWidth = isOutline
						? Math.min(lineWidth, bars.current[0].width / 2)
						: lineWidth;

				// set clipping region
				ctx.save();
				if (!radial) {
					const region = new Path2D();
					region.rect(0, channelTop, canvas.width, analyzerHeight);
					ctx.clip(region);
				}
			} // if ( useCanvas )

			// get a new array of data from the FFT
			let fftData = signal;

			// apply weighting
			if (weightingFilter)
				fftData = fftData.map((val, idx) => val + weightingdB(binToFreq(idx)));

			// start drawing path (for graph mode)
			ctx.beginPath();

			// store line graph points to create mirror effect in radial mode
			let points: number[][] = [];

			// draw bars / lines

			for (let barIndex = 0; barIndex < nBars; barIndex++) {
				const bar = bars.current[barIndex];
				const { posX, barCenter, width, freq, binLo, binHi, ratioLo, ratioHi } =
					bar;

				let barValue = Math.max(
					interpolate(binLo, ratioLo),
					interpolate(binHi, ratioHi),
				);

				// check additional bins (if any) for this bar and keep the highest value
				for (let j = binLo + 1; j < binHi; j++) {
					if (fftData[j] > barValue) barValue = fftData[j];
				}

				// normalize bar amplitude in [0;1] range
				barValue = normalizedB(barValue);

				bar.value[channel] = barValue;
				currentEnergy += barValue;

				// update bar peak
				if (bar.peak[channel] > 0 && bar.alpha[channel] > 0) {
					bar.hold[channel]--;
					// if hold is negative, start peak drop or fade out
					if (bar.hold[channel] < 0) {
						if (fadePeaks && !showPeakLine) {
							const initialAlpha =
								!isAlpha || (isOutline && lineWidth > 0)
									? 1
									: isAlpha
										? bar.peak[channel]
										: fillAlpha;
							bar.alpha[channel] =
								initialAlpha * (1 + bar.hold[channel] / fadeFrames); // hold is negative, so this is <= 1
						} else
							bar.peak[channel] +=
								(bar.hold[channel] * gravity) / fpsSquared / nominalMaxHeight;
						// make sure the peak value is reset when using fadePeaks
						if (bar.alpha[channel] <= 0) bar.peak[channel] = 0;
					}
				}

				// check if it's a new peak for this bar
				if (barValue >= bar.peak[channel]) {
					bar.peak[channel] = barValue;
					bar.hold[channel] = holdFrames;
					// check whether isAlpha or isOutline are active to start the peak alpha with the proper value
					bar.alpha[channel] =
						!isAlpha || (isOutline && lineWidth > 0)
							? 1
							: isAlpha
								? barValue
								: fillAlpha;
				}

				// if not using the canvas, move earlier to the next bar
				if (!useCanvas) continue;

				// set opacity for bar effects
				ctx.globalAlpha =
					isLumi || isAlpha ? barValue : isOutline ? fillAlpha : 1;

				// set fillStyle and strokeStyle for the current bar
				setBarColor(barValue, barIndex);

				// compute actual bar height on screen
				const barHeight = isLumi
					? maxBarHeight
					: isLeds
						? ledPosY(barValue)
						: (barValue * maxBarHeight) | 0;

				// Draw current bar or line segment

				if (mode === MODE_GRAPH) {
					// compute the average between the initial bar (barIndex==0) and the next one
					// used to smooth the curve when the initial posX is off the screen, in mirror and radial modes
					const nextBarAvg = barIndex
						? 0
						: (normalizedB(fftData[bars.current[1].binLo]) * maxBarHeight +
								barHeight) /
							2;

					if (radial) {
						if (barIndex === 0) {
							if (isDualHorizontal) ctx.moveTo(...radialXY(0, 0));
							ctx.lineTo(...radialXY(0, posX < 0 ? nextBarAvg : barHeight));
						}
						// draw line to the current point, avoiding overlapping wrap-around frequencies
						if (posX >= 0) {
							const point: [number, number] = [posX, barHeight];
							ctx.lineTo(...radialXY(...point));
							points.push(point);
						}
					} else {
						// Linear
						if (barIndex === 0) {
							// start the line off-screen using the previous FFT bin value as the initial amplitude
							if (mirror === -1 && !isDualHorizontal)
								ctx.moveTo(
									initialX,
									analyzerBottom - (posX < initialX ? nextBarAvg : barHeight),
								);
							else {
								const prevFFTData = binLo
									? normalizedB(fftData[binLo - 1]) * maxBarHeight
									: barHeight; // use previous FFT bin value, when available
								ctx.moveTo(initialX - lineWidth, analyzerBottom - prevFFTData);
							}
						}
						// draw line to the current point
						// avoid X values lower than the origin when mirroring left, otherwise draw them for best graph accuracy
						if (isDualHorizontal || mirror !== -1 || posX >= initialX)
							ctx.lineTo(posX, analyzerBottom - barHeight);
					}
				} else {
					if (isLeds) {
						// draw "unlit" leds - avoid drawing it twice on 'dual-combined' channel layout
						if (showBgColor && !overlay && (channel === 0 || !isDualCombined)) {
							const alpha = ctx.globalAlpha;
							ctx.strokeStyle = LEDS_UNLIT_COLOR;
							ctx.globalAlpha = 1;
							strokeBar(barCenter, channelTop, analyzerBottom);
							// restore properties
							ctx.strokeStyle = ctx.fillStyle;
							ctx.globalAlpha = alpha;
						}
						if (isTrueLeds) {
							// ledPosY() is used below to fit one entire led height into the selected range
							const colorIndex = isLumi
								? 0
								: colorStops.findLastIndex(
										(item) => ledPosY(barValue) <= ledPosY(item.level),
									);
							let last = analyzerBottom;
							for (let i = colorCount - 1; i >= colorIndex; i--) {
								ctx.strokeStyle = colorStops[i].color;
								const y =
									analyzerBottom -
									(i === colorIndex ? barHeight : ledPosY(colorStops[i].level));
								strokeBar(barCenter, last, y);
								last = y - ledSpaceV;
							}
						} else
							strokeBar(barCenter, analyzerBottom, analyzerBottom - barHeight);
					} else if (posX >= initialX) {
						if (radial) radialPoly(posX, 0, width, barHeight, isOutline);
						else if (isRound) {
							const halfWidth = width / 2;
							const y = analyzerBottom + halfWidth; // round caps have an additional height of half bar width

							ctx.beginPath();
							ctx.moveTo(posX, y);
							ctx.lineTo(posX, y - barHeight);
							ctx.arc(barCenter, y - barHeight, halfWidth, PI, TAU);
							ctx.lineTo(posX + width, y);
							strokeIf(isOutline);
							ctx.fill();
						} else {
							const offset = isOutline ? ctx.lineWidth : 0;
							ctx.beginPath();
							ctx.rect(
								posX,
								analyzerBottom + offset,
								width,
								-barHeight - offset,
							);
							strokeIf(isOutline);
							ctx.fill();
						}
					}
				}

				// Draw peak
				const peakValue = bar.peak[channel];
				const peakAlpha = bar.alpha[channel];

				if (
					peakValue > 0 &&
					peakAlpha > 0 &&
					showPeaks &&
					!showPeakLine &&
					!isLumi &&
					posX >= initialX &&
					posX < finalX
				) {
					// set opacity for peak
					if (fadePeaks) ctx.globalAlpha = peakAlpha;
					else if (isOutline && lineWidth > 0)
						// when lineWidth == 0 ctx.globalAlpha remains set to `fillAlpha`
						ctx.globalAlpha = 1;
					else if (isAlpha)
						// isAlpha (alpha based on peak value) supersedes fillAlpha if lineWidth == 0
						ctx.globalAlpha = peakValue;

					// select the peak color for 'bar-level' colorMode or 'trueLeds'
					if (colorMode === COLOR_BAR_LEVEL || isTrueLeds)
						setBarColor(peakValue);

					// render peak according to current mode / effect
					if (isLeds) {
						const ledPeak = ledPosY(peakValue);
						if (ledPeak >= ledSpaceV)
							// avoid peak below first led
							ctx.fillRect(posX, analyzerBottom - ledPeak, width, ledHeight);
					} else if (!radial)
						ctx.fillRect(
							posX,
							analyzerBottom - peakValue * maxBarHeight,
							width,
							2,
						);
					else if (mode !== MODE_GRAPH) {
						// radial (peaks for graph mode are done by the peakLine code)
						const y = peakValue * maxBarHeight;
						radialPoly(
							posX,
							y,
							width,
							!radialInvert || isDualVertical || y + innerRadius >= 2 ? -2 : 2,
						);
					}
				}
			} // for ( let barIndex = 0; barIndex < nBars; barIndex++ )

			// if not using the canvas, move earlier to the next channel
			if (!useCanvas) continue;

			// restore global alpha
			ctx.globalAlpha = 1;

			// Fill/stroke drawing path for graph mode
			if (mode === MODE_GRAPH) {
				setBarColor(); // select channel gradient

				if (radial && !isDualHorizontal) {
					if (mirror) {
						let p: number[] | undefined;
						while (points.length > 0) {
							p = points.pop();
							ctx.lineTo(...radialXY(...(p as [number, number]), -1));
						}
					}
					ctx.closePath();
				}

				if (lineWidth > 0) ctx.stroke();

				if (fillAlpha > 0) {
					if (radial) {
						// exclude the center circle from the fill area
						const start = isDualHorizontal ? getAngle(analyzerWidth >> 1) : 0;
						const end = isDualHorizontal ? getAngle(analyzerWidth) : TAU;
						ctx.moveTo(
							...radialXY(isDualHorizontal ? analyzerWidth >> 1 : 0, 0),
						);
						ctx.arc(
							centerX,
							centerY,
							innerRadius,
							start,
							end,
							isDualHorizontal ? !invertedChannel : true,
						);
					} else {
						// close the fill area
						ctx.lineTo(finalX, analyzerBottom);
						ctx.lineTo(initialX, analyzerBottom);
					}

					ctx.globalAlpha = fillAlpha;
					ctx.fill();
					ctx.globalAlpha = 1;
				}

				// draw peak line (and standard peaks on radial)
				if (showPeakLine || (radial && showPeaks)) {
					points = []; // for mirror line on radial
					ctx.beginPath();
					bars.current.forEach((b, i) => {
						let x = b.posX;
						let h = b.peak[channel];
						const m = i ? "lineTo" : "moveTo";
						if (radial && x < 0) {
							const nextBar = bars.current[i + 1];
							h = findY(x, h, nextBar.posX, nextBar.peak[channel], 0);
							x = 0;
						}
						h *= maxBarHeight;
						if (showPeakLine) {
							ctx[m](
								...((radial ? radialXY(x, h) : [x, analyzerBottom - h]) as [
									number,
									number,
								]),
							);
							if (radial && mirror && !isDualHorizontal) points.push([x, h]);
						} else if (h > 0) radialPoly(x, h, 1, -2); // standard peaks (also does mirror)
					});
					if (showPeakLine) {
						let p: number[] | undefined;
						while (points.length > 0) {
							p = points.pop();
							ctx.lineTo(...radialXY(...(p as [number, number]), -1));
						} // mirror line points
						ctx.lineWidth = 1;
						ctx.stroke(); // stroke peak line
					}
				}
			}

			ctx.restore(); // restore clip region

			if (isDualHorizontal && !radial) ctx.setTransform(1, 0, 0, 1, 0, 0);

			// create Reflex effect - for dual-combined and dual-horizontal do it only once, after channel 1
			if (!(isDualHorizontal || isDualCombined) || channel) doReflex(channel);
		} // for ( let channel = 0; channel < nChannels; channel++ ) {

		updateEnergy(currentEnergy / (nBars << (nChannels - 1)));

		if (useCanvas) {
			// Mirror effect
			if (mirror && !radial && !isDualHorizontal) {
				ctx.setTransform(-1, 0, 0, 1, canvas.width - initialX, 0);
				ctx.drawImage(
					canvas,
					initialX,
					0,
					centerX,
					canvas.height,
					0,
					0,
					centerX,
					canvas.height,
				);
				ctx.setTransform(1, 0, 0, 1, 0, 0);
			}

			// restore solid lines
			ctx.setLineDash([]);

			// draw frequency scale (X-axis)
			drawScaleX();
		}

		// display current frame rate
		if (showFPS) {
			const size = canvasX.height;
			ctx.font = `bold ${size}px ${FONT_FAMILY}`;
			ctx.fillStyle = FPS_COLOR;
			ctx.textAlign = "right";
			ctx.fillText(
				Math.round(fps.current).toString(),
				canvas.width - size,
				size * 2,
			);
		}
	};

	useLayoutEffect(() => {
		if (canvasRef.current && canvasXRef.current && containerRef.current) {
			const scaleX = canvasXRef.current.getContext("2d");
			const ctx = canvasRef.current.getContext("2d");
			if (scaleX && ctx) {
				setCanvas({
					reason: REASON.CREATE,
					ready: true,
					isFullscreen: isFullscreen,
					fsEl: canvasRef.current,
					container: containerRef.current,
					canvas: canvasRef.current,
					scaleX: scaleX,
					loRes: false,
					ctx: ctx,
					setPixelRatio: (ratio: number) => {
						pixelRatio.current = ratio;
					},
					defaultHeight,
					defaultWidth,
					overlay,
					calcBars,
					height,
					width,
				});
			}
		}
	}, [isFullscreen, overlay, calcBars, height, width]);

	useEffect(() => {
		const observer = new ResizeObserver(onResize);
		observer.observe(document.body);

		window.addEventListener(DOM_EVENT.RESIZE, onResize);

		canvasRef.current?.addEventListener(DOM_EVENT.FULLSCREENCHANGE, () => {
			fsChanging.current = true;
			if (fsTimeout.current) {
				clearTimeout(fsTimeout.current);
				fsTimeout.current = 0;
			}
			if (canvasRef.current && canvasXRef.current && containerRef.current) {
				const scaleX = canvasXRef.current.getContext("2d");
				const ctx = canvasRef.current.getContext("2d");
				if (scaleX && ctx) {
					setCanvas({
						reason: REASON.FSCHANGE,
						ready: true,
						isFullscreen: isFullscreen,
						fsEl: canvasRef.current,
						container: containerRef.current,
						canvas: canvasRef.current,
						scaleX: scaleX,
						loRes: false,
						ctx: ctx,
						setPixelRatio: (ratio: number) => {
							pixelRatio.current = ratio;
						},
						defaultHeight,
						defaultWidth,
						overlay,
						calcBars,
						height,
						width,
					});
				}
			}
			fsChanging.current = false;
		});

		return () => {
			window.removeEventListener(DOM_EVENT.RESIZE, onResize);
			observer.disconnect();
		};
	}, [onResize, overlay, isFullscreen, calcBars, height, width]);

	return (
		<div>
			<div id="container" className="mb-4" ref={containerRef}>
				<canvas id="wasm-canvas" ref={canvasRef} />
				<canvas id="scaleX" hidden ref={canvasXRef} />
				<canvas id="scaleR" hidden ref={canvasRRef} />
			</div>
			{/* biome-ignore lint/a11y/useMediaCaption: <explanation> */}
			<audio
				src="https://audio-edge-qse4n.yyz.g.radiomast.io/8a384ff3-6fd1-4e5d-b47d-0cbefeffe8d7"
				className="w-full mb-4"
				controls
				crossOrigin="anonymous"
				ref={audioRef}
			/>
			{!audio ? (
				<button
					type="button"
					onClick={async () => {
						if (audioRef.current) {
							const newAudio = await setupAudio((signal) => {
								latestSignal.current = signal;
							}, audioRef.current);
							setAudio(newAudio);
							audioCtx.current = newAudio.context;
							audioNode.current = newAudio.node;

							runId.current = requestAnimationFrame(draw);

							setRunning(true);
						}
					}}
				>
					Start listening
				</button>
			) : (
				<button
					type="button"
					onClick={async () => {
						if (running) {
							await audio.context.suspend();
							setRunning(audio.context.state === "running");
						} else {
							await audio.context.resume();
							setRunning(audio.context.state === "running");
						}
					}}
					disabled={
						audio.context.state !== "running" &&
						audio.context.state !== "suspended"
					}
				>
					{running ? "Pause" : "Resume"}
				</button>
			)}
			<div className="flex container mb-4 mx-auto items-center justify-center gap-4">
				<input
					type="file"
					id="uploadFile"
					accept="audio/*"
					onChange={(e) => {
						const file = e.target.files?.[0];
						if (file) {
							const url = URL.createObjectURL(file);
							audioRef.current?.setAttribute("src", url);
						}
					}}
				/>
				<button type="button" title="Microphone ON/OFF">
					🎙️
				</button>
			</div>
			<div className="container mx-auto flex justify-center items-center border rounded-md p-2 gap-2">
				<div className="flex flex-col items-center gap-1">
					<label htmlFor="mode" className="mr-2">
						Mode
					</label>
					<select
						id="mode"
						defaultValue={10}
						ref={modeInputRef}
						onChange={() => calcBars()}
					>
						<option value="0">Discrete Frequencies</option>
						<option value="1">1/24th octave / 240 bands</option>
						<option value="2">1/12th octave / 120 bands</option>
						<option value="3">1/8th octave / 80 bands</option>
						<option value="4">1/6th octave / 60 bands</option>
						<option value="5">1/4th octave / 40 bands</option>
						<option value="6">1/3th octave / 30 bands</option>
						<option value="7">Half octave / 20 bands</option>
						<option value="8">Full octave / 10 bands</option>
						<option value="10">Line/Area Graph</option>
					</select>
				</div>
				<div className="flex flex-col items-center gap-1">
					<label htmlFor="colorMode" className="mr-2">
						Color Mode
					</label>
					<select
						id="colorMode"
						defaultValue={COLOR_GRADIENT}
						ref={colorModeSelectRef}
					>
						<option value="gradient">Gradient</option>
						<option value="bar-index">Bar Index</option>
						<option value="bar-level">Bar Level</option>
					</select>
				</div>
				<div className="flex flex-col items-center gap-1">
					<label htmlFor="gradient" className="mr-2">
						Gradient
					</label>
					<select
						id="gradient"
						defaultValue={`${GRADIENTS[0][0]},${GRADIENTS[0][0]}`}
						ref={gradientSelectRef}
						onChange={() => makeGrad()}
					>
						<option value={`${GRADIENTS[0][0]},${GRADIENTS[0][0]}`}>
							Classic
						</option>
						<option value={`${GRADIENTS[1][0]},${GRADIENTS[1][0]}`}>
							Prism
						</option>
						<option value={`${GRADIENTS[2][0]},${GRADIENTS[2][0]}`}>
							Rainbow
						</option>
						<option value={`${GRADIENTS[3][0]},${GRADIENTS[3][0]}`}>
							Orange-Red
						</option>
						<option value={`${GRADIENTS[4][0]},${GRADIENTS[4][0]}`}>
							Steel Blue
						</option>
					</select>
				</div>
				<div className="flex flex-col items-center gap-1">
					<label htmlFor="minFreq" className="mr-2">
						Min Frequency
					</label>
					<select
						id="minFreq"
						defaultValue={20}
						ref={minFreqRef}
						onChange={(e) => {
							audioNode.current?.port.postMessage({
								type: "setMinFreq",
								data: Number.parseInt(e.target.value),
							});
							calcBars();
						}}
					>
						<option value={0}>0 Hz</option>
						<option value={10}>10 Hz</option>
						<option value={20}>20 Hz</option>
						<option value={25}>25 Hz</option>
						<option value={30}>30 Hz</option>
						<option value={40}>40 Hz</option>
						<option value={60}>60 Hz</option>
						<option value={100}>100 Hz</option>
						<option value={500}>500 Hz</option>
						<option value={1000}>1000 Hz</option>
					</select>
				</div>
				<div className="flex flex-col items-center gap-1">
					<label htmlFor="maxFreq" className="mr-2">
						Max Frequency
					</label>
					<select
						id="maxFreq"
						defaultValue={20000}
						ref={maxFreqRef}
						onChange={(e) => {
							audioNode.current?.port.postMessage({
								type: "setMaxFreq",
								data: Number.parseInt(e.target.value),
							});
							calcBars();
						}}
					>
						<option value={8000}>8000 Hz</option>
						<option value={10000}>10000 Hz</option>
						<option value={12000}>12000 Hz</option>
						<option value={16000}>16000 Hz</option>
						<option value={20000}>20000 Hz</option>
						<option value={22000}>22000 Hz</option>
						<option value={24000}>24000 Hz</option>
					</select>
				</div>
				<div className="flex flex-col items-center gap-1">
					<label htmlFor="frequencyScale" className="mr-2">
						Frequency Scale
					</label>
					<select
						id="frequencyScale"
						defaultValue={FrequencyScale.LOG}
						ref={frequencyScaleRef}
						onChange={() => calcBars()}
					>
						<option value={FrequencyScale.LOG}>Log</option>
						<option value={FrequencyScale.LINEAR}>Linear</option>
						<option value={FrequencyScale.BARK}>Bark</option>
						<option value={FrequencyScale.MEL}>Mel</option>
					</select>
				</div>
			</div>
		</div>
	);
};

export default AudioAnalyzer;
