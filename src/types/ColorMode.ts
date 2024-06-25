import type {
	COLOR_BAR_INDEX,
	COLOR_BAR_LEVEL,
	COLOR_GRADIENT,
} from "../constants/strings";

export type ColorMode =
	| typeof COLOR_GRADIENT
	| typeof COLOR_BAR_INDEX
	| typeof COLOR_BAR_LEVEL;
