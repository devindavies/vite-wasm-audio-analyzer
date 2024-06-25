export const CANVAS_BACKGROUND_COLOR = "#000";
export const CHANNEL_COMBINED = "dual-combined";
export const CHANNEL_HORIZONTAL = "dual-horizontal";
export const CHANNEL_SINGLE = "single";
export const CHANNEL_VERTICAL = "dual-vertical";
export const COLOR_BAR_INDEX = "bar-index";
export const COLOR_BAR_LEVEL = "bar-level";
export const COLOR_GRADIENT = "gradient";
export const DEBOUNCE_TIMEOUT = 60;
export const EVENT_CLICK = "click";
export const EVENT_FULLSCREENCHANGE = "fullscreenchange";
export const EVENT_RESIZE = "resize";
export const GRADIENT_DEFAULT_BGCOLOR = "#111";
export const FILTER_NONE = "";
export const FILTER_A = "A";
export const FILTER_B = "B";
export const FILTER_C = "C";
export const FILTER_D = "D";
export const FILTER_468 = "468";
export const FONT_FAMILY = "sans-serif";
export const FPS_COLOR = "#0f0";
export const LEDS_UNLIT_COLOR = "#7f7f7f22";
export const MODE_GRAPH = 10;
export const REASON_CREATE = "create";
export const REASON_FSCHANGE = "fschange";
export const REASON_LORES = "lores";
export const REASON_RESIZE = EVENT_RESIZE;
export const REASON_USER = "user";
export const SCALEX_BACKGROUND_COLOR = "#000c";
export const SCALEX_LABEL_COLOR = "#fff";
export const SCALEX_HIGHLIGHT_COLOR = "#4f4";
export const SCALEY_LABEL_COLOR = "#888";
export const SCALEY_MIDLINE_COLOR = "#555";
export const SCALE_BARK = "bark";
export const SCALE_LINEAR = "linear";
export const SCALE_LOG = "log";
export const SCALE_MEL = "mel";

export enum CHANNEL_LAYOUT {
	SINGLE = "single",
	DUAL_COMBINED = "dual-combined",
	DUAL_HORIZONTAL = "dual-horizontal",
	DUAL_VERTICAL = "dual-vertical",
}

export enum DOM_EVENT {
	CLICK = "click",
	FULLSCREENCHANGE = "fullscreenchange",
	RESIZE = "resize",
}

export enum REASON {
	CREATE = "create",
	FSCHANGE = "fschange",
	LORES = "lores",
	RESIZE = "resize",
	USER = "user",
}

export enum FILTER {
	NONE = "",
	A = "A",
	B = "B",
	C = "C",
	D = "D",
	FOUR_SIX_EIGHT = "468",
}

export type FrequencyScale =
	| typeof SCALE_LOG
	| typeof SCALE_BARK
	| typeof SCALE_MEL
	| typeof SCALE_LINEAR;
