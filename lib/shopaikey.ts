const DEFAULT_BASE_URL = 'https://api.shopaikey.com';

export function getShopAIKeyConfig() {
  const apiKey = process.env.SHOPAIKEY_API_KEY;
  if (!apiKey) {
    throw new Error("Thiếu cấu hình Mai Đức Minh'web API (SHOPAIKEY_API_KEY).");
  }

  const baseUrl = (process.env.SHOPAIKEY_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
  return { apiKey, baseUrl };
}

export async function shopAIKeyFetch(path: string, init: RequestInit) {
  const { apiKey, baseUrl } = getShopAIKeyConfig();
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });
}
