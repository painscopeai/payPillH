import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * GET /health-goals
 */
router.get('/', async (req, res) => {
	const { user_id } = req.query;

	if (!user_id) {
		return res.status(400).json({
			error: 'Missing required query parameter: user_id',
		});
	}

	if (!supabaseAdmin) {
		return res.status(503).json({ error: 'Database unavailable' });
	}

	const { data: healthGoals, error } = await supabaseAdmin
		.from('health_goals')
		.select('*')
		.eq('user_id', user_id)
		.order('created_at', { ascending: false });

	if (error) {
		return res.status(500).json({ error: error.message });
	}

	const goalsWithProgress = (healthGoals || []).map((goal) => {
		const target = goal.target && typeof goal.target === 'object' ? goal.target : {};
		const targetDateStr = target.target_date ?? target.date;
		const targetDate = targetDateStr ? new Date(targetDateStr) : null;
		const createdAt = goal.created_at ? new Date(goal.created_at) : new Date();
		let progressPercentage = 0;
		if (targetDate && targetDate > createdAt) {
			const totalDays = targetDate.getTime() - createdAt.getTime();
			const elapsedDays = Date.now() - createdAt.getTime();
			progressPercentage = Math.min(100, Math.round((elapsedDays / totalDays) * 100));
		}

		return {
			...goal,
			goal_name: goal.title,
			target_date: targetDateStr,
			target_value: target.target_value,
			created: goal.created_at,
			progress_percentage: progressPercentage,
		};
	});

	logger.info(`Fetched ${goalsWithProgress.length} health goals for user ${user_id}`);

	res.json(goalsWithProgress);
});

/**
 * POST /health-goals
 */
router.post('/', async (req, res) => {
	const { user_id, goal_name, goal_type, target_value, target_date } = req.body;

	if (!user_id || !goal_name || !goal_type || !target_date) {
		return res.status(400).json({
			error: 'Missing required fields: user_id, goal_name, goal_type, target_date',
		});
	}

	const targetDateTime = new Date(target_date);
	const now = new Date();
	if (targetDateTime <= now) {
		return res.status(400).json({
			error: 'Target date must be in the future',
		});
	}

	if (!supabaseAdmin) {
		return res.status(503).json({ error: 'Database unavailable' });
	}

	const { data: healthGoal, error } = await supabaseAdmin
		.from('health_goals')
		.insert({
			user_id,
			goal_type,
			title: goal_name,
			status: 'active',
			target: {
				target_value: target_value || '',
				target_date,
			},
		})
		.select('id')
		.single();

	if (error) {
		return res.status(500).json({ error: error.message });
	}

	logger.info(`Health goal created: ${healthGoal.id}`);

	res.status(201).json({
		id: healthGoal.id,
		status: 'active',
	});
});

export default router;
