// helper function - validate a given value with an array of strings (by default, all lowercase)
// returns the validated value, or the first element of `list` if `value` is not found in the array
export const validateFromList = <T extends string>(
	value: T | undefined,
	list: T[],
) => (value && list.includes(value) ? value : list[0]);
