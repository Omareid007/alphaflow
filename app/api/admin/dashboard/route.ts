import { NextResponse } from "next/server";
import {
  providerService,
  llmRouterService,
  orchestratorService,
} from "@/lib/admin/services";

export async function GET() {
  try {
    const [providers, models, config, jobs] = await Promise.all([
      providerService.listProviders(),
      llmRouterService.listModels(),
      orchestratorService.getConfig(),
      orchestratorService.getRecentRuns(100),
    ]);

    const stats = {
      providers: {
        total: providers.length,
        active: providers.filter((p) => p.status === "active").length,
      },
      models: {
        total: models.length,
        enabled: models.filter((m) => m.enabled).length,
      },
      jobs: {
        running: jobs.filter((j) => j.status === "running").length,
        failed: jobs.filter(
          (j) =>
            j.status === "failed" &&
            new Date(j.startedAt) > new Date(Date.now() - 86400000)
        ).length,
      },
      killSwitch: config.killSwitch,
    };

    return NextResponse.json(stats);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load dashboard" },
      { status: 500 }
    );
  }
}
