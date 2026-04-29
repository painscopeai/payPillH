import Pocketbase from 'pocketbase';

const POCKETBASE_API_URL = '/hcgi/platform';

const pocketbaseClient = await (async () => {
	const useMocks = import.meta.env.DEV && import.meta.env.VITE_DEV_MOCKS === 'true';
	if (useMocks) {
		const { createDevMockPocketBase } = await import('@/lib/devPocketBaseMock.js');
		return createDevMockPocketBase();
	}
	return new Pocketbase(POCKETBASE_API_URL);
})();

export default pocketbaseClient;

export { pocketbaseClient };
