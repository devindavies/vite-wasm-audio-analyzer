export const frequencyToXAxis = (frequency: number) => {
	const minF = Math.log(20) / Math.log(10);
	const maxF = Math.log(20000) / Math.log(10);

	const range = maxF - minF;
	const xAxis = ((Math.log(frequency) / Math.log(10) - minF) / range) * 945;
	return xAxis;
};
