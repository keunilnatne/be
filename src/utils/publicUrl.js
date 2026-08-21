function normalizeFrontendOrigin(value, nodeEnv) {
  const origin = String(value || '').trim().replace(/\/+$/, '');
  if (nodeEnv !== 'production' || !origin) return origin;

  try {
    const parsed = new URL(origin);
    const isLocal = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
    if (parsed.protocol === 'http:' && !isLocal) {
      return origin.replace(/^http:\/\//i, 'https://');
    }
  } catch {
    return origin;
  }

  return origin;
}

module.exports = { normalizeFrontendOrigin };
