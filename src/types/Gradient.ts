import type { ColorStop } from "./ColorStop";

export type Gradient = {
	bgColor: string;
	dir?: string;
	colorStops: ColorStop[];
};
