import { log } from "../utils/logger";

class OrchestratorController {
  private orchestratorControlEnabled: boolean = false;

  enableOrchestratorControl(): void {
    this.orchestratorControlEnabled = true;
    log.info("OrchestratorController", "Orchestrator control ENABLED - autonomous trading disabled");
  }

  disableOrchestratorControl(): void {
    this.orchestratorControlEnabled = false;
    log.info("OrchestratorController", "Orchestrator control DISABLED - autonomous trading allowed");
  }

  isOrchestratorControlEnabled(): boolean {
    return this.orchestratorControlEnabled;
  }
}

export const orchestratorController = new OrchestratorController();
