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

				// #region agent log
				fetch('http://127.0.0.1:7835/ingest/ac6048b3-2d29-4ab3-ac92-730ceeebf184', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'a604a1' },
					body: JSON.stringify({
						sessionId: 'a604a1',
						location: 'useAnalyticsSync.js:load',
						message: 'analytics_fetch_start',
						data: { endpoint, showLoading: !!showLoading },
						timestamp: Date.now(),
						hypothesisId: 'H2',
					}),
				}).catch(() => {});
				// #endregion

				const response = await apiServerClient.fetch(`${endpoint}${queryString}`);

				if (!response.ok) {
					throw new Error(`Analytics fetch failed: ${response.statusText}`);
				}

				const result = await response.json();
				if (cancelled) return;
				setData(result);
				setLastUpdated(new Date());

				// #region agent log
				fetch('http://127.0.0.1:7835/ingest/ac6048b3-2d29-4ab3-ac92-730ceeebf184', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'a604a1' },
					body: JSON.stringify({
						sessionId: 'a604a1',
						location: 'useAnalyticsSync.js:load',
						message: 'analytics_fetch_ok',
						data: { endpoint },
						timestamp: Date.now(),
						hypothesisId: 'H2',
					}),
				}).catch(() => {});
				// #endregion
			} catch (err) {
				if (cancelled) return;
				if (err?.name === 'AbortError') {
					// #region agent log
					fetch('http://127.0.0.1:7835/ingest/ac6048b3-2d29-4ab3-ac92-730ceeebf184', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'a604a1' },
						body: JSON.stringify({
							sessionId: 'a604a1',
							location: 'useAnalyticsSync.js:load',
							message: 'analytics_fetch_abort',
							data: { endpoint },
							timestamp: Date.now(),
							hypothesisId: 'H2',
						}),
					}).catch(() => {});
					// #endregion
					return;
				}
				console.error(`Error fetching analytics from ${endpoint}:`, err);
				setError(err.message);
				toast.error('Failed to sync analytics data');
			} finally {
				if (!cancelled) setIsLoading(false);
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
