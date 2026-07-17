// Tiny client-side CSV helpers — no dependency, works offline.

type Cell = string | number;

/** Serialise rows to a CSV string, quoting cells that need it (RFC 4180-ish). */
export function toCsv(rows: Cell[][]): string {
	const escape = (cell: Cell): string => {
		const s = String(cell);
		return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
	};
	return rows.map((row) => row.map(escape).join(',')).join('\r\n');
}

/** Trigger a browser download of the given CSV text. Browser-only. */
export function downloadCsv(filename: string, csv: string): void {
	// Prepend a BOM so Excel reads UTF-8 (Vietnamese names) correctly.
	const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}
