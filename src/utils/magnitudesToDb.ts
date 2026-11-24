// Floor for silent bins: keeps results finite so interpolation and weighting never produce NaN from -Infinity.
const MIN_MAGNITUDE = 1e-12;

// The wasm analyzer outputs linear FFT magnitudes. Scaling by 2 / fftSize makes a full-scale sine read about -6 dB.
export const magnitudesToDb = (
	magnitudes: ArrayLike<number>,
	fftSize: number,
	out: Float32Array,
) => {
	const scale = 2 / fftSize;
	for (let i = 0; i < out.length; i++) {
		out[i] = 20 * Math.log10(Math.max(magnitudes[i] * scale, MIN_MAGNITUDE));
	}
	return out;
};
