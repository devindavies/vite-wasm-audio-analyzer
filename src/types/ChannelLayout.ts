import type {
	CHANNEL_COMBINED,
	CHANNEL_HORIZONTAL,
	CHANNEL_SINGLE,
	CHANNEL_VERTICAL,
} from "../constants/strings";

export type ChannelLayout =
	| typeof CHANNEL_SINGLE
	| typeof CHANNEL_HORIZONTAL
	| typeof CHANNEL_VERTICAL
	| typeof CHANNEL_COMBINED;
