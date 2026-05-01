import { useState, useEffect, useCallback, useRef } from 'react';
import apiServerClient from '@/lib/apiServerClient';
import { toast } from 'sonner';

export function useAnalyticsSync(endpoint, options = {}) {
	const { refreshInterval = 300000, startDate, endDate } = options;
	const [data, setData] = useState(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState(null);
	const [lastUpdated, setLastUpdated] = useState(null);
	const mountedRef = useRef(true);

	const fetchData = useCallback(
		async (showLoading = false, signal) => {
			if (showLoading) setIsLoading(true);
			setError(null);

			try {
				const queryParams = new URLSearchParams();
				if (startDate) queryParams.append('startDate', startDate);
				if (endDate) queryParams.append('endDate', endDate);

				const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
				// #region agent log
				fetch('http://127.0.0.1:7835/ingest/ac6048b3-2d29-4ab3-ac92-730ceeebf184',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a604a1'},body:JSON.stringify({sessionId:'a604a1',location:'useAnalyticsSync.js:fetchData',message:'analytics_fetch_start',data:{endpoint,showLoading:!!showLoading},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
				// #endregion
				const response = await apiServerClient.fetch(`${endpoint}${queryString}`, signal ? { signal } : {});

				if (!response.ok) {
					throw new Error(`Analytics fetch failed: ${response.statusText}`);
				}

				const result = await response.json();
				if (!mountedRef.current) return;
				setData(result);
				setLastUpdated(new Date());
				// #region agent log
				fetch('http://127.0.0.1:7835/ingest/ac6048b3-2d29-4ab3-ac92-730ceeebf184',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a604a1'},body:JSON.stringify({sessionId:'a604a1',location:'useAnalyticsSync.js:fetchData',message:'analytics_fetch_ok',data:{endpoint},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
				// #endregion
			} catch (err) {
				if (err?.name === 'AbortError') {
					// #region agent log
					fetch('http://127.0.0.1:7835/ingest/ac6048b3-2d29-4ab3-ac92-730ceeebf184',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a604a1'},body:JSON.stringify({sessionId:'a604a1',location:'useAnalyticsSync.js:fetchData',message:'analytics_fetch_abort',data:{endpoint},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
					// #endregion
					return;
				}
				console.error(`Error fetching analytics from ${endpoint}:`, err);
				if (!mountedRef.current) return;
				setError(err.message);
				toast.error('Failed to sync analytics data');
			} finally {
				if (mountedRef.current) setIsLoading(false);
			}
		},
		[endpoint, startDate, endDate]
	);

	useEffect(() => {
		mountedRef.current = true;
		const ac = new AbortController();
		void fetchData(true, ac.signal);

		const intervalId = setInterval(() => {
			void fetchData(false);
		}, refreshInterval);

		return () => {
			mountedRef.current = false;
			ac.abort();
			clearInterval(intervalId);
		};
	}, [fetchData, refreshInterval]);

	return {
		data,
		isLoading,
		error,
		lastUpdated,
		reconnect: () => fetchData(true),
	};
}
