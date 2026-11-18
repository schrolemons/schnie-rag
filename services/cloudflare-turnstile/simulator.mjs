import { timingSafeEqual } from 'node:crypto';
/** A configured fixture, not a CAPTCHA or Cloudflare verification service. */
export function createTurnstileSimulator({ siteKey, secretKey, demoToken } = {}) {
  return {
    simulated: true,
    verify(token) {
      if (!siteKey || !secretKey || !demoToken) throw new Error('TURNSTILE_SIMULATOR_NOT_CONFIGURED');
      const expected = Buffer.from(demoToken), actual = Buffer.from(String(token || ''));
      return { success: actual.length === expected.length && timingSafeEqual(actual, expected), simulated: true };
    },
    // CLI/DSH reference calls have no browser challenge widget. This fixture is
    // deliberately supplied by the simulator; it never proves a human is present.
    fixtureToken() { return demoToken; },
  };
}
