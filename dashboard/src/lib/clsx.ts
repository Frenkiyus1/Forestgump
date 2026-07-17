type ClassValue = string | false | null | undefined;

/** Join truthy class fragments with a single space. */
export function clsx(...parts: ClassValue[]): string {
	return parts.filter(Boolean).join(' ');
}
