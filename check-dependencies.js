#!/usr/bin/env node

/**
 * Dependency Checker for Expo/React Native Build
 * Verifies all required packages are installed
 */

const fs = require("fs");
const path = require("path");

const REQUIRED_DEPS = {
  dependencies: [
    "expo",
    "react-native",
    "react-native-web",
    "react-native-gesture-handler",
    "react-native-reanimated",
    "react-native-safe-area-context",
    "react-native-screens",
    "@react-navigation/native",
    "@react-navigation/native-stack",
    "@expo/vector-icons",
    "expo-status-bar",
    "expo-splash-screen",
  ],
  devDependencies: [
    "@babel/core",
    "babel-preset-expo",
    "babel-plugin-module-resolver",
    "react-native-svg-transformer",
  ],
};

const OPTIONAL_DEPS = {
  dependencies: [
    "react-native-svg",
    "expo-blur",
    "expo-constants",
    "expo-font",
    "expo-haptics",
    "expo-linking",
    "expo-web-browser",
    "@react-navigation/bottom-tabs",
  ],
  devDependencies: ["eslint-config-expo"],
};

function checkDependencies() {
  console.log("🔍 Checking Expo/React Native dependencies...\n");

  const packageJsonPath = path.join(process.cwd(), "package.json");

  if (!fs.existsSync(packageJsonPath)) {
    console.error("❌ package.json not found!");
    process.exit(1);
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const deps = packageJson.dependencies || {};
  const devDeps = packageJson.devDependencies || {};

  let missingRequired = [];
  let missingOptional = [];

  // Check required dependencies
  console.log("📦 Required Dependencies:");
  REQUIRED_DEPS.dependencies.forEach((dep) => {
    if (deps[dep]) {
      console.log(`  ✅ ${dep} (${deps[dep]})`);
    } else {
      console.log(`  ❌ ${dep} - MISSING`);
      missingRequired.push(dep);
    }
  });

  console.log("\n🛠️  Required Dev Dependencies:");
  REQUIRED_DEPS.devDependencies.forEach((dep) => {
    if (devDeps[dep]) {
      console.log(`  ✅ ${dep} (${devDeps[dep]})`);
    } else {
      console.log(`  ❌ ${dep} - MISSING`);
      missingRequired.push(`${dep} --save-dev`);
    }
  });

  // Check optional dependencies
  console.log("\n🎨 Optional Dependencies:");
  OPTIONAL_DEPS.dependencies.forEach((dep) => {
    if (deps[dep]) {
      console.log(`  ✅ ${dep} (${deps[dep]})`);
    } else {
      console.log(`  ⚠️  ${dep} - Not installed (optional)`);
      missingOptional.push(dep);
    }
  });

  console.log("\n🔧 Optional Dev Dependencies:");
  OPTIONAL_DEPS.devDependencies.forEach((dep) => {
    if (devDeps[dep]) {
      console.log(`  ✅ ${dep} (${devDeps[dep]})`);
    } else {
      console.log(`  ⚠️  ${dep} - Not installed (optional)`);
      missingOptional.push(`${dep} --save-dev`);
    }
  });

  // Summary
  console.log("\n" + "=".repeat(60));
  if (missingRequired.length > 0) {
    console.log("\n❌ Missing Required Dependencies!");
    console.log("\nTo install missing required dependencies, run:");
    console.log(`\nnpm install ${missingRequired.join(" ")}\n`);
    process.exit(1);
  } else {
    console.log("\n✅ All required dependencies are installed!");
  }

  if (missingOptional.length > 0) {
    console.log("\n⚠️  Missing Optional Dependencies");
    console.log("These are not required but recommended for full functionality:");
    console.log(`\nnpm install ${missingOptional.join(" ")}\n`);
  } else {
    console.log("✅ All optional dependencies are installed!");
  }

  console.log("=".repeat(60) + "\n");

  // Check configuration files
  console.log("📋 Configuration Files:");
  const configFiles = [
    "babel.config.js",
    "metro.config.js",
    "app.json",
    "tsconfig.json",
    ".eslintrc.json",
    ".prettierrc",
  ];

  let missingConfigs = [];
  configFiles.forEach((file) => {
    const exists = fs.existsSync(path.join(process.cwd(), file));
    if (exists) {
      console.log(`  ✅ ${file}`);
    } else {
      console.log(`  ❌ ${file} - MISSING`);
      missingConfigs.push(file);
    }
  });

  if (missingConfigs.length > 0) {
    console.log(
      "\n⚠️  Some configuration files are missing. The build may not work correctly."
    );
  }

  console.log("\n" + "=".repeat(60));
  console.log("\n💡 Next Steps:");
  console.log("  1. Run: npm install");
  console.log("  2. Run: npm run dev:server (in terminal 1)");
  console.log("  3. Run: npm run dev:mobile (in terminal 2)");
  console.log("  4. Read: SETUP_GUIDE.md for detailed instructions\n");
}

// Run the check
checkDependencies();
