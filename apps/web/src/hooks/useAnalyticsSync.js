import { useState, useEffect, useCallback, useRef } from 'react';
import apiServerClient from '@/lib/apiServerClient';
import { formatAdminApiFailure, formatAdminNetworkError } from '@/lib/adminApiErrors.js';
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
			let pathForError = endpoint;
			try {
				const queryParams = new URLSearchParams();
				if (startDate) queryParams.append('startDate', startDate);
				if (endDate) queryParams.append('endDate', endDate);
				const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
				pathForError = `${endpoint}${queryString}`;

				const response = await apiServerClient.fetch(`${endpoint}${queryString}`);

				if (!response.ok) {
					throw new Error(await formatAdminApiFailure(response, { path: pathForError }));
				}

				const result = await response.json();
				if (cancelled) return;
				setData(result);
				setLastUpdated(new Date());
			} catch (err) {
				if (cancelled) return;
				const msg =
					err?.name === 'AbortError'
						? formatAdminNetworkError(err, { path: pathForError })
						: err?.message || formatAdminNetworkError(err, { path: pathForError });
				if (err?.name !== 'AbortError') {
					console.error(`Error fetching analytics from ${endpoint}:`, err);
				}
				setError(msg);
				if (showLoading) toast.error(msg.split('\n')[0]);
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
