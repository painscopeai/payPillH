/**
 * Multi-line admin API errors (HTTP status, full URL, hints). Use with whitespace-pre-wrap.
 */
export default function AdminFetchErrorBanner({ message }) {
	if (!message) return null;
	return (
		<div
			role="alert"
			className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive whitespace-pre-wrap"
		>
			{message}
		</div>
	);
}
