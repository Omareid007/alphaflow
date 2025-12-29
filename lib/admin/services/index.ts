export * from "./provider-service";
export * from "./llm-router-service";
export * from "./orchestrator-service";
export * from "./api-discovery-service";

export const adminServices = {
  providers: require("./provider-service").providerService,
  llmRouter: require("./llm-router-service").llmRouterService,
  orchestrator: require("./orchestrator-service").orchestratorService,
  apiDiscovery: require("./api-discovery-service").apiDiscoveryService,
};
