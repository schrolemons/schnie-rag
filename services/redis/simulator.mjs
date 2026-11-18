/** Single-process Redis-like coordination. No Redis server or distributed guarantees. */
export function createRedisSimulator({ key, now = Date.now, requestsPerMinute = 6, maxConcurrent = 1, dailyRequests = 300, dailyBudget = 3000000 } = {}) {
  const seen = new Map(), rates = new Map(), active = new Map();
  let day, usedRequests = 0, usedBudget = 0;
  return {
    simulated: true,
    acquire({ client, requestId, reservation }) {
      if (!key) throw new Error('REDIS_SIMULATOR_NOT_CONFIGURED');
      const time = now(), today = new Date(time).toISOString().slice(0,10);
      if (day !== today) { day = today; usedRequests = 0; usedBudget = 0; }
      for (const [id, deadline] of seen) if (deadline <= time) seen.delete(id);
      for (const [id, bucket] of rates) if (bucket.expires <= time) rates.delete(id);
      if (seen.has(requestId)) throw new Error('DUPLICATE_REQUEST');
      const bucket = rates.get(client);
      const recent = bucket && bucket.expires > time ? bucket : { count: 0, expires: time+60000 };
      if (recent.count >= requestsPerMinute) throw new Error('RATE_LIMITED');
      if ((active.get(client)?.size || 0) >= maxConcurrent) throw new Error('CONCURRENT_REQUEST');
      if (usedRequests >= dailyRequests || usedBudget+reservation > dailyBudget) throw new Error('BUDGET_EXHAUSTED');
      if (!Number.isSafeInteger(reservation) || reservation < 0) throw new Error('INVALID_RESERVATION');
      seen.set(requestId,time+120000); recent.count++; rates.set(client,recent);
      usedRequests++; usedBudget += reservation;
      const running = active.get(client) || new Set(); running.add(requestId); active.set(client,running);
      let released = false;
      return () => { if (released) return; released = true; running.delete(requestId); if (!running.size) active.delete(client); };
    },
    forget(requestId) { seen.delete(requestId); },
    snapshot() { return { simulated: true, requests: usedRequests, reservedBudget: usedBudget, active: [...active.values()].reduce((n,s)=>n+s.size,0) }; },
  };
}
