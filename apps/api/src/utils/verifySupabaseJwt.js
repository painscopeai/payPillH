import jwt from 'jsonwebtoken';

/**
 * Verifies the Supabase access token locally using the project JWT secret (no network).
 * Secret: Dashboard → Project Settings → API → JWT Settings → JWT Secret.
 *
 * @param {string} accessToken
 * @returns {{ id: string, email?: string } | null}
 */
export function getUserFromAccessToken(accessToken) {
	const secret = process.env.SUPABASE_JWT_SECRET;
	if (!secret || !accessToken) return null;

	try {
		/** @type {import('jsonwebtoken').JwtPayload} */
		const payload = jwt.verify(accessToken, secret, {
			algorithms: ['HS256'],
		});
		const id = typeof payload.sub === 'string' ? payload.sub : null;
		if (!id) return null;
		const email = typeof payload.email === 'string' ? payload.email : undefined;
		return { id, email };
	} catch {
		return null;
	}
}
