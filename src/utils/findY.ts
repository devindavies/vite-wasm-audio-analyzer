// helper function - find the Y-coordinate of a point located between two other points, given its X-coordinate
export const findY = (
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	x: number,
) => y1 + ((y2 - y1) * (x - x1)) / (x2 - x1);
