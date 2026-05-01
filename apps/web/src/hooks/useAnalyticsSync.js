import { useState, useEffect, useCallback, useRef } from 'react';
import apiServerClient from '@/lib/apiServerClient';
import { toast } from 'sonner';

export function useAnalyticsSync(endpoint, options = {}) {
	const { refreshInterval = 300000, startDate, endDate } = options;
	const [data, setData] = useState(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState(null);
	const [lastUpdated, setLastUpdated] = useState(null);
	const reloadRef = useRef(() => {});

	useEffect(() => {
		let cancelled = false;

		async function load(showLoading) {
			if (showLoading) setIsLoading(true);
			setError(null);
			try {
				const queryParams = new URLSearchParams();
				if (startDate) queryParams.append('startDate', startDate);
				if (endDate) queryParams.append('endDate', endDate);
				const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

				const response = await apiServerClient.fetch(`${endpoint}${queryString}`);

				if (!response.ok) {
					let detail = response.statusText;
					try {
						const body = await response.json();
						detail = body.error || body.message || detail;
					} catch {
						/* ignore */
					}
					throw new Error(detail || `Analytics fetch failed (${response.status})`);
				}

				const result = await response.json();
				if (cancelled) return;
				setData(result);
				setLastUpdated(new Date());
			} catch (err) {
				if (cancelled) return;
				const msg =
					err?.name === 'AbortError'
						? 'Request timed out or was cancelled — try again.'
						: err?.message || 'Failed to load analytics';
				if (err?.name !== 'AbortError') {
					console.error(`Error fetching analytics from ${endpoint}:`, err);
				}
				setError(msg);
				if (showLoading) toast.error(msg);
			} finally {
				/** Always clear loading so tabs never spin forever (AbortError + Strict Mode previously skipped this). */
				setIsLoading(false);
			}
		}

		reloadRef.current = () => {
			void load(true);
		};

		void load(true);
		const intervalId = setInterval(() => {
			void load(false);
		}, refreshInterval);

		return () => {
			cancelled = true;
			clearInterval(intervalId);
		};
	}, [endpoint, refreshInterval, startDate, endDate]);

	const reconnect = useCallback(() => {
		reloadRef.current();
	}, []);

	return {
		data,
		isLoading,
		error,
		lastUpdated,
		reconnect,
	};
}
