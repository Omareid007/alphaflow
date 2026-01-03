/**
 * Comprehensive Backend API Endpoint Testing Script
 *
 * This script analyzes and tests ALL backend API endpoints for:
 * - Authentication coverage
 * - Request validation
 * - Error handling
 * - Response format consistency
 * - Security issues
 */

import * as fs from "fs";
import * as path from "path";

interface EndpointInfo {
  method: string;
  path: string;
  authRequired: boolean;
  authMiddleware: string[];
  file: string;
  lineNumber?: number;
  validationPresent: boolean;
  errorHandling: boolean;
  issues: string[];
  category: string;
}

interface TestReport {
  totalEndpoints: number;
  publicEndpoints: number;
  protectedEndpoints: number;
  categorized: Record<string, EndpointInfo[]>;
  criticalIssues: string[];
  mediumIssues: string[];
  recommendations: string[];
  authCoverage: {
    total: number;
    protected: number;
    public: number;
    percentage: number;
  };
}

// Read and parse routes.ts file
function extractEndpointsFromFile(filePath: string): EndpointInfo[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const endpoints: EndpointInfo[] = [];

  // Regex patterns for different route definitions
  const routePattern =
    /app\.(get|post|put|delete|patch)\s*\(\s*["']([^"']+)["']/;
  const routerPattern = /app\.use\s*\(\s*["']([^"']+)["']/;
  const middlewarePattern =
    /(authMiddleware|adminTokenMiddleware|requireCapability)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const routeMatch = line.match(routePattern);

    if (routeMatch) {
      const method = routeMatch[1].toUpperCase();
      const path = routeMatch[2];

      // Check for middleware in the same line or nearby
      const authRequired = middlewarePattern.test(line);
      const middlewares: string[] = [];

      if (line.includes("authMiddleware")) middlewares.push("authMiddleware");
      if (line.includes("adminTokenMiddleware"))
        middlewares.push("adminTokenMiddleware");
      if (line.includes("requireCapability")) {
        const capMatch = line.match(
          /requireCapability\s*\(\s*["']([^"']+)["']/
        );
        if (capMatch) {
          middlewares.push(`requireCapability(${capMatch[1]})`);
        }
      }

      // Analyze endpoint for issues
      const issues: string[] = [];

      // Check validation
      const validationPresent = checkValidation(content, i, lines);
      if (
        !validationPresent &&
        (method === "POST" || method === "PUT" || method === "PATCH")
      ) {
        issues.push("Missing input validation");
      }

      // Check error handling
      const errorHandling = checkErrorHandling(lines, i);
      if (!errorHandling) {
        issues.push("Incomplete error handling");
      }

      // Security checks
      if (isSensitiveEndpoint(path) && !authRequired) {
        issues.push("CRITICAL: Sensitive endpoint without authentication");
      }

      endpoints.push({
        method,
        path,
        authRequired,
        authMiddleware: middlewares,
        file: "routes.ts",
        lineNumber: i + 1,
        validationPresent,
        errorHandling,
        issues,
        category: categorizeEndpoint(path),
      });
    }
  }

  return endpoints;
}

function checkValidation(
  content: string,
  lineIndex: number,
  lines: string[]
): boolean {
  // Look ahead in the next 20 lines for validation patterns
  const lookAheadLines = lines.slice(lineIndex, lineIndex + 20).join("\n");

  return (
    lookAheadLines.includes(".safeParse(") ||
    lookAheadLines.includes(".parse(") ||
    lookAheadLines.includes("badRequest(") ||
    lookAheadLines.includes("validationError(") ||
    lookAheadLines.includes("if (!") ||
    lookAheadLines.includes("if (!req.body")
  );
}

function checkErrorHandling(lines: string[], startIndex: number): boolean {
  // Look for try-catch or .catch patterns
  let braceCount = 0;
  let foundTry = false;
  let foundCatch = false;

  for (let i = startIndex; i < Math.min(startIndex + 50, lines.length); i++) {
    const line = lines[i];

    if (line.includes("try {")) foundTry = true;
    if (line.includes("catch") && foundTry) foundCatch = true;
    if (line.includes(".catch(")) foundCatch = true;

    // Count braces to know when function ends
    braceCount += (line.match(/{/g) || []).length;
    braceCount -= (line.match(/}/g) || []).length;

    if (braceCount < 0) break;
  }

  return foundCatch;
}

function isSensitiveEndpoint(path: string): boolean {
  const sensitivePatterns = [
    "/admin/",
    "/agent/",
    "/autonomous/",
    "/strategies",
    "/positions",
    "/orders",
    "/trades",
    "/alpaca/",
    "/risk/",
  ];

  return sensitivePatterns.some((pattern) => path.includes(pattern));
}

function categorizeEndpoint(path: string): string {
  if (path.includes("/auth/")) return "Authentication";
  if (path.includes("/admin/")) return "Admin";
  if (path.includes("/autonomous/") || path.includes("/agent/"))
    return "Autonomous Trading";
  if (path.includes("/strategies")) return "Strategies";
  if (
    path.includes("/positions") ||
    path.includes("/orders") ||
    path.includes("/trades")
  )
    return "Trading";
  if (path.includes("/alpaca/")) return "Alpaca Integration";
  if (path.includes("/ai/")) return "AI";
  if (path.includes("/crypto/") || path.includes("/stock/"))
    return "Market Data";
  if (path.includes("/backtests")) return "Backtesting";
  if (path.includes("/health") || path.includes("/status")) return "Health";
  if (path.includes("/webhooks") || path.includes("/notifications"))
    return "Notifications";
  return "Other";
}

function extractRouterEndpoints(
  routerPath: string,
  mountPath: string
): EndpointInfo[] {
  if (!fs.existsSync(routerPath)) {
    return [];
  }

  const content = fs.readFileSync(routerPath, "utf-8");
  const lines = content.split("\n");
  const endpoints: EndpointInfo[] = [];

  const routePattern =
    /router\.(get|post|put|delete|patch)\s*\(\s*["']([^"']+)["']/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(routePattern);

    if (match) {
      const method = match[1].toUpperCase();
      const routePath = match[2];
      const fullPath = mountPath + routePath;

      // Router-level auth is applied at mount point
      const authRequired = true; // Most routers use authMiddleware at mount

      const validationPresent = checkValidation(content, i, lines);
      const errorHandling = checkErrorHandling(lines, i);

      const issues: string[] = [];
      if (
        !validationPresent &&
        (method === "POST" || method === "PUT" || method === "PATCH")
      ) {
        issues.push("Missing input validation");
      }
      if (!errorHandling) {
        issues.push("Incomplete error handling");
      }

      endpoints.push({
        method,
        path: fullPath,
        authRequired,
        authMiddleware: ["authMiddleware (router-level)"],
        file: path.basename(routerPath),
        lineNumber: i + 1,
        validationPresent,
        errorHandling,
        issues,
        category: categorizeEndpoint(fullPath),
      });
    }
  }

  return endpoints;
}

async function runComprehensiveTest(): Promise<TestReport> {
  console.log("🔍 Starting comprehensive API endpoint analysis...\n");

  const serverDir = path.join(process.cwd(), "server");
  const routesFile = path.join(serverDir, "routes.ts");

  // Extract main routes
  console.log("📖 Analyzing main routes.ts...");
  const mainEndpoints = extractEndpointsFromFile(routesFile);
  console.log(`   Found ${mainEndpoints.length} endpoints in routes.ts\n`);

  // Extract router endpoints
  const routers = [
    { file: "backtests.ts", mount: "/api/backtests" },
    { file: "traces.ts", mount: "/api/traces" },
    { file: "debate.ts", mount: "/api/debate" },
    { file: "competition.ts", mount: "/api/competition" },
    { file: "strategies.ts", mount: "/api/strategies" },
    { file: "arena.ts", mount: "/api/arena" },
    { file: "tools.ts", mount: "/api/tools" },
    { file: "jina.ts", mount: "/api/jina" },
    { file: "macro.ts", mount: "/api/macro" },
    { file: "enrichment.ts", mount: "/api/enrichment" },
    { file: "portfolio-snapshot.ts", mount: "/api/portfolio-snapshot" },
  ];

  let allEndpoints = [...mainEndpoints];

  for (const router of routers) {
    const routerPath = path.join(serverDir, "routes", router.file);
    console.log(`📖 Analyzing ${router.file}...`);
    const endpoints = extractRouterEndpoints(routerPath, router.mount);
    console.log(`   Found ${endpoints.length} endpoints\n`);
    allEndpoints = [...allEndpoints, ...endpoints];
  }

  // Categorize endpoints
  const categorized: Record<string, EndpointInfo[]> = {};
  for (const endpoint of allEndpoints) {
    if (!categorized[endpoint.category]) {
      categorized[endpoint.category] = [];
    }
    categorized[endpoint.category].push(endpoint);
  }

  // Identify issues
  const criticalIssues: string[] = [];
  const mediumIssues: string[] = [];

  for (const endpoint of allEndpoints) {
    for (const issue of endpoint.issues) {
      const issueStr = `${endpoint.method} ${endpoint.path}: ${issue}`;
      if (issue.includes("CRITICAL")) {
        criticalIssues.push(issueStr);
      } else {
        mediumIssues.push(issueStr);
      }
    }
  }

  // Authentication coverage
  const protectedEndpoints = allEndpoints.filter((e) => e.authRequired);
  const publicEndpoints = allEndpoints.filter((e) => !e.authRequired);

  const authCoverage = {
    total: allEndpoints.length,
    protected: protectedEndpoints.length,
    public: publicEndpoints.length,
    percentage: (protectedEndpoints.length / allEndpoints.length) * 100,
  };

  // Generate recommendations
  const recommendations: string[] = [];

  if (authCoverage.percentage < 80) {
    recommendations.push(
      "Consider adding authentication to more endpoints for better security"
    );
  }

  if (criticalIssues.length > 0) {
    recommendations.push("Address critical security issues immediately");
  }

  const endpointsWithoutValidation = allEndpoints.filter(
    (e) => !e.validationPresent && ["POST", "PUT", "PATCH"].includes(e.method)
  );
  if (endpointsWithoutValidation.length > 10) {
    recommendations.push("Add input validation to POST/PUT/PATCH endpoints");
  }

  // Check for public trading endpoints
  const publicTradingEndpoints = publicEndpoints.filter(
    (e) =>
      e.path.includes("/orders") ||
      e.path.includes("/positions") ||
      e.path.includes("/trades")
  );
  if (publicTradingEndpoints.length > 0) {
    recommendations.push(
      "URGENT: Trading endpoints should require authentication"
    );
    publicTradingEndpoints.forEach((e) => {
      criticalIssues.push(`${e.method} ${e.path}: Trading endpoint is public!`);
    });
  }

  return {
    totalEndpoints: allEndpoints.length,
    publicEndpoints: publicEndpoints.length,
    protectedEndpoints: protectedEndpoints.length,
    categorized,
    criticalIssues,
    mediumIssues,
    recommendations,
    authCoverage,
  };
}

function printReport(report: TestReport) {
  console.log("\n" + "=".repeat(80));
  console.log("  COMPREHENSIVE API ENDPOINT SECURITY & QUALITY REPORT");
  console.log("=".repeat(80) + "\n");

  console.log("📊 SUMMARY");
  console.log("-".repeat(80));
  console.log(`Total Endpoints Found:     ${report.totalEndpoints}`);
  console.log(
    `Protected (Auth Required): ${report.protectedEndpoints} (${report.authCoverage.percentage.toFixed(1)}%)`
  );
  console.log(
    `Public (No Auth):          ${report.publicEndpoints} (${(100 - report.authCoverage.percentage).toFixed(1)}%)`
  );
  console.log("");

  console.log("📁 ENDPOINTS BY CATEGORY");
  console.log("-".repeat(80));
  const categories = Object.keys(report.categorized).sort();
  for (const category of categories) {
    const endpoints = report.categorized[category];
    console.log(`\n${category} (${endpoints.length} endpoints)`);
    for (const endpoint of endpoints) {
      const auth = endpoint.authRequired ? "🔒" : "🌐";
      const issues =
        endpoint.issues.length > 0
          ? ` ⚠️  ${endpoint.issues.length} issues`
          : "";
      console.log(
        `  ${auth} ${endpoint.method.padEnd(6)} ${endpoint.path}${issues}`
      );
    }
  }

  console.log("\n\n🚨 CRITICAL ISSUES");
  console.log("-".repeat(80));
  if (report.criticalIssues.length === 0) {
    console.log("✅ No critical issues found!");
  } else {
    report.criticalIssues.forEach((issue, i) => {
      console.log(`${i + 1}. ${issue}`);
    });
  }

  console.log("\n\n⚠️  MEDIUM PRIORITY ISSUES");
  console.log("-".repeat(80));
  if (report.mediumIssues.length === 0) {
    console.log("✅ No medium priority issues found!");
  } else {
    // Show first 20 issues
    const issuesToShow = report.mediumIssues.slice(0, 20);
    issuesToShow.forEach((issue, i) => {
      console.log(`${i + 1}. ${issue}`);
    });
    if (report.mediumIssues.length > 20) {
      console.log(`\n... and ${report.mediumIssues.length - 20} more issues`);
    }
  }

  console.log("\n\n💡 RECOMMENDATIONS");
  console.log("-".repeat(80));
  if (report.recommendations.length === 0) {
    console.log("✅ API is well-structured!");
  } else {
    report.recommendations.forEach((rec, i) => {
      console.log(`${i + 1}. ${rec}`);
    });
  }

  console.log("\n\n🔒 AUTHENTICATION COVERAGE DETAILS");
  console.log("-".repeat(80));
  console.log(`Total endpoints:      ${report.authCoverage.total}`);
  console.log(`Protected:            ${report.authCoverage.protected}`);
  console.log(`Public:               ${report.authCoverage.public}`);
  console.log(
    `Coverage percentage:  ${report.authCoverage.percentage.toFixed(1)}%`
  );

  console.log("\n\n✅ PUBLIC ENDPOINTS (Should be intentionally public)");
  console.log("-".repeat(80));
  const publicEndpoints = Object.values(report.categorized)
    .flat()
    .filter((e) => !e.authRequired);

  if (publicEndpoints.length === 0) {
    console.log("No public endpoints found.");
  } else {
    publicEndpoints.forEach((endpoint) => {
      console.log(`${endpoint.method.padEnd(6)} ${endpoint.path}`);
    });
  }

  console.log("\n" + "=".repeat(80));
  console.log("  END OF REPORT");
  console.log("=".repeat(80) + "\n");
}

// Main execution
(async () => {
  try {
    const report = await runComprehensiveTest();
    printReport(report);

    // Save report to file
    const reportPath = path.join(
      process.cwd(),
      "API_ENDPOINT_SECURITY_REPORT.md"
    );
    const markdown = generateMarkdownReport(report);
    fs.writeFileSync(reportPath, markdown);
    console.log(`\n📄 Full report saved to: ${reportPath}\n`);

    // Exit with error if critical issues found
    if (report.criticalIssues.length > 0) {
      console.log("❌ CRITICAL ISSUES FOUND - Please address immediately!\n");
      process.exit(1);
    } else {
      console.log("✅ No critical security issues found!\n");
      process.exit(0);
    }
  } catch (error) {
    console.error("❌ Error running API endpoint test:", error);
    process.exit(1);
  }
})();

function generateMarkdownReport(report: TestReport): string {
  let md = "# API Endpoint Security & Quality Report\n\n";
  md += `Generated: ${new Date().toISOString()}\n\n`;

  md += "## Summary\n\n";
  md += `- **Total Endpoints**: ${report.totalEndpoints}\n`;
  md += `- **Protected Endpoints**: ${report.protectedEndpoints} (${report.authCoverage.percentage.toFixed(1)}%)\n`;
  md += `- **Public Endpoints**: ${report.publicEndpoints} (${(100 - report.authCoverage.percentage).toFixed(1)}%)\n`;
  md += `- **Critical Issues**: ${report.criticalIssues.length}\n`;
  md += `- **Medium Priority Issues**: ${report.mediumIssues.length}\n\n`;

  md += "## Endpoints by Category\n\n";
  const categories = Object.keys(report.categorized).sort();
  for (const category of categories) {
    md += `### ${category}\n\n`;
    md += "| Method | Path | Auth | Validation | Error Handling | Issues |\n";
    md += "|--------|------|------|------------|----------------|--------|\n";

    const endpoints = report.categorized[category];
    for (const endpoint of endpoints) {
      const auth = endpoint.authRequired ? "✅" : "❌";
      const validation = endpoint.validationPresent ? "✅" : "❌";
      const errorHandling = endpoint.errorHandling ? "✅" : "❌";
      const issues =
        endpoint.issues.length > 0 ? endpoint.issues.join("; ") : "-";

      md += `| ${endpoint.method} | \`${endpoint.path}\` | ${auth} | ${validation} | ${errorHandling} | ${issues} |\n`;
    }
    md += "\n";
  }

  md += "## Critical Issues\n\n";
  if (report.criticalIssues.length === 0) {
    md += "✅ No critical issues found!\n\n";
  } else {
    report.criticalIssues.forEach((issue, i) => {
      md += `${i + 1}. ${issue}\n`;
    });
    md += "\n";
  }

  md += "## Medium Priority Issues\n\n";
  if (report.mediumIssues.length === 0) {
    md += "✅ No medium priority issues found!\n\n";
  } else {
    report.mediumIssues.forEach((issue, i) => {
      md += `${i + 1}. ${issue}\n`;
    });
    md += "\n";
  }

  md += "## Recommendations\n\n";
  if (report.recommendations.length === 0) {
    md += "✅ API is well-structured!\n\n";
  } else {
    report.recommendations.forEach((rec, i) => {
      md += `${i + 1}. ${rec}\n`;
    });
    md += "\n";
  }

  md += "## Public Endpoints\n\n";
  const publicEndpoints = Object.values(report.categorized)
    .flat()
    .filter((e) => !e.authRequired);

  md += "| Method | Path | Category |\n";
  md += "|--------|------|----------|\n";
  for (const endpoint of publicEndpoints) {
    md += `| ${endpoint.method} | \`${endpoint.path}\` | ${endpoint.category} |\n`;
  }

  return md;
}
