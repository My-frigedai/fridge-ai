// lib/rateLimiter.ts
// 簡易レートリミッター（メモリベース）

const requests = new Map<string, { count: number; timestamp: number }>();

/**
 * rateLimit
 * @param key 識別キー (例: ipアドレス)
 * @param limit 制限回数
 * @param windowSeconds 窓口秒数
 * @returns { ok: boolean, remaining: number }
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ ok: boolean; remaining: number }> {
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;

  const entry = requests.get(key);

  if (!entry || entry.timestamp < windowStart) {
    // 新しいウィンドウ
    requests.set(key, { count: 1, timestamp: now });
    return { ok: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return { ok: false, remaining: 0 };
  }

  entry.count++;
  entry.timestamp = now;
  requests.set(key, entry);

  return { ok: true, remaining: limit - entry.count };
}
