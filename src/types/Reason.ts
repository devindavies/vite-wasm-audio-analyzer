import type {
	REASON_CREATE,
	REASON_FSCHANGE,
	REASON_LORES,
	REASON_RESIZE,
	REASON_USER,
} from "../constants/strings";
export type Reason =
	| typeof REASON_CREATE
	| typeof REASON_FSCHANGE
	| typeof REASON_LORES
	| typeof REASON_RESIZE
	| typeof REASON_USER;
