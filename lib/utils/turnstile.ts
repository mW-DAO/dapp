const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;

export async function verifyTurnstile(token: string, ip?: string): Promise<boolean> {
  if (!token) return false;
  // 如果没有配置 Secret Key，默认放行（开发环境可能没配）
  // 但为了安全，生产环境必须配。
  if (!TURNSTILE_SECRET_KEY) {
    if (process.env.NODE_ENV === 'development') {
        console.warn('Turnstile secret key missing, skipping verify in dev');
        return true;
    }
    console.error('Turnstile secret key is missing!');
    return false;
  }

  try {
    const formData = new FormData();
    formData.append('secret', TURNSTILE_SECRET_KEY);
    formData.append('response', token);
    if (ip) {
      formData.append('remoteip', ip);
    }

    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      body: formData,
      method: 'POST',
    });

    const outcome = await result.json();
    if (!outcome.success) {
        console.error('Turnstile verify failed:', outcome);
    }
    return outcome.success;
  } catch (err) {
    console.error('Turnstile error:', err);
    return false;
  }
}
