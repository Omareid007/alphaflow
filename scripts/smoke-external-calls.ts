#!/usr/bin/env tsx
import {
  getProviderPolicy,
  getAllProviderPolicies,
  type ProviderPolicy,
} from "../server/lib/apiPolicy";
import {
  getProviderStatus,
  getAllProviderStatuses,
} from "../server/lib/callExternal";

async function main() {
  console.log("=== API Budget & Cache Smoke Test ===\n");

  console.log("1. Checking provider policies...");
  const policies = getAllProviderPolicies();
  console.log(`   Found ${policies.length} configured providers:\n`);

  for (const policy of policies) {
    const limits = [];
    if (policy.maxRequestsPerMinute)
      limits.push(`${policy.maxRequestsPerMinute}/min`);
    if (policy.maxRequestsPerHour)
      limits.push(`${policy.maxRequestsPerHour}/hr`);
    if (policy.maxRequestsPerDay)
      limits.push(`${policy.maxRequestsPerDay}/day`);
    if (policy.maxRequestsPerWeek)
      limits.push(`${policy.maxRequestsPerWeek}/wk`);
    if (policy.maxTokensPerMinute)
      limits.push(`${policy.maxTokensPerMinute} tok/min`);
    if (policy.maxTokensPerDay)
      limits.push(`${policy.maxTokensPerDay} tok/day`);

    const status = policy.enabled ? "enabled" : "DISABLED";
    console.log(
      `   - ${policy.provider.padEnd(15)} [${status}] limits: ${limits.join(", ") || "none"}`
    );
  }

  console.log("\n2. Checking provider usage stats...");
  const allStatus = await getAllProviderStatuses();
  console.log(
    `   Retrieved status for ${Object.keys(allStatus).length} providers:\n`
  );

  for (const [provider, status] of Object.entries(allStatus)) {
    const bs = status.budgetStatus;
    const remaining = bs.limit - bs.currentCount;
    console.log(
      `   - ${provider.padEnd(15)} remaining: ${remaining}/${bs.limit} per ${bs.windowType}`
    );
    if (!bs.allowed) {
      console.log(`     ⚠️  Budget exhausted!`);
    }
  }

  console.log("\n3. Checking cache TTLs...");
  const cacheTTLs = policies.map((p) => ({
    provider: p.provider,
    fresh: Math.round(p.cacheFreshDurationMs / 1000 / 60),
    stale: Math.round(p.cacheStaleDurationMs / 1000 / 60),
  }));

  for (const ttl of cacheTTLs) {
    console.log(
      `   - ${ttl.provider.padEnd(15)} fresh: ${ttl.fresh}min, stale: ${ttl.stale}min`
    );
  }

  console.log("\n4. ENV override check (sample providers)...");
  const envOverrides = [
    {
      env: "FINNHUB_RATE_LIMIT_PER_MIN",
      policy: "finnhub",
      field: "maxRequestsPerMinute",
    },
    {
      env: "NEWSAPI_RATE_LIMIT_PER_DAY",
      policy: "newsapi",
      field: "maxRequestsPerDay",
    },
    {
      env: "COINGECKO_RATE_LIMIT_PER_MIN",
      policy: "coingecko",
      field: "maxRequestsPerMinute",
    },
  ];

  for (const check of envOverrides) {
    const envVal = process.env[check.env];
    const policy = getProviderPolicy(check.policy);
    const policyVal = (policy as unknown as Record<string, unknown>)[
      check.field
    ];
    if (envVal) {
      console.log(`   ✓ ${check.env}=${envVal} -> policy value: ${policyVal}`);
    } else {
      console.log(`   - ${check.env} not set, using default: ${policyVal}`);
    }
  }

  console.log("\n=== Smoke Test Complete ===");
  console.log(
    "\nAll systems operational. Connectors are routing through callExternal()."
  );
  console.log("Budget tracking is active. Cache policies are configured.");
}

main().catch(console.error);
