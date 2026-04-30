import { Router } from 'express';
import logger from '../utils/logger.js';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

const router = Router();

function calculateDistance(lat1, lon1, lat2, lon2) {
	const R = 6371;
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLon = ((lon2 - lon1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}

/**
 * GET /pharmacies
 */
router.get('/', async (req, res) => {
	if (!supabaseAdmin) {
		return res.status(503).json({ error: 'Server misconfigured' });
	}

	const { location, latitude, longitude, type } = req.query;

	let q = supabaseAdmin.from('pharmacies').select('*');

	const { data: pharmacies, error } = await q;
	if (error) {
		logger.error('[pharmacies] list', error);
		return res.status(500).json({ error: 'list_failed' });
	}

	let list = pharmacies || [];

	if (type) {
		list = list.filter((p) => (p.inventory && typeof p.inventory === 'object' && p.inventory.type === type) || true);
	}

	const normalizeCoord = (p) => ({
		...p,
		latitude: p.lat ?? p.latitude,
		longitude: p.lng ?? p.longitude,
	});

	list = list.map(normalizeCoord);

	if (latitude && longitude) {
		const lat = parseFloat(latitude);
		const lon = parseFloat(longitude);

		if (Number.isNaN(lat) || Number.isNaN(lon)) {
			return res.status(400).json({
				error: 'Invalid latitude or longitude values',
			});
		}

		const pharmaciesWithDistance = list
			.filter((pharmacy) => pharmacy.latitude != null && pharmacy.longitude != null)
			.map((pharmacy) => ({
				...pharmacy,
				distance_km: calculateDistance(lat, lon, pharmacy.latitude, pharmacy.longitude),
			}))
			.sort((a, b) => a.distance_km - b.distance_km);

		logger.info(`Found ${pharmaciesWithDistance.length} pharmacies (distance sorted)`);
		return res.json(pharmaciesWithDistance);
	}

	if (location) {
		const filteredPharmacies = list.filter(
			(p) =>
				p.address?.toLowerCase().includes(String(location).toLowerCase()) ||
				String(p.address || '').includes(String(location))
		);

		logger.info(`Found ${filteredPharmacies.length} pharmacies for location: ${location}`);
		return res.json(filteredPharmacies);
	}

	logger.info(`Found ${list.length} pharmacies`);
	res.json(list);
});

export default router;
