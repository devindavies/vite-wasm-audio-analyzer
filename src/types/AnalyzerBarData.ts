export type AnalyzerBarData = {
	width: number;
	alpha: [number, number];
	binHi: number;
	binLo: number;
	posX: number;
	freq: number;
	freqLo: number;
	freqHi: number;
	ratioLo: number;
	ratioHi: number;
	hold: [number, number] | [number];
	peak: [number, number];
	value: [number, number] | [number];
	barCenter: number;
};
