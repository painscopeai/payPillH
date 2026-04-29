/**
 * Non-diagnostic UK-themed preventive reminders (RULE-PREV-001).
 */

export function buildPreventiveGaps(facts) {
	const age = facts.ageYears;
	const gaps = [];

	if (age != null && age >= 40 && age <= 74) {
		gaps.push({
			id: 'nhs_health_check',
			label: 'NHS Health Check',
			status: 'due',
			detail:
				'Adults 40–74 may be eligible in England — ask your GP surgery about booking.',
		});
	}

	gaps.push({
		id: 'flu_vaccine',
		label: 'Annual flu vaccination',
		status: 'due',
		detail: 'Seasonal reminder — check eligibility with your GP or pharmacy.',
	});

	const lipidStatus =
		facts.lipidsKnown ? 'scheduled' : 'overdue';
	gaps.push({
		id: 'lipid_review',
		label: 'Cholesterol (lipid) review',
		status: lipidStatus,
		detail:
			'Important for cardiovascular health; often included in an NHS Health Check or GP review.',
	});

	return gaps;
}
