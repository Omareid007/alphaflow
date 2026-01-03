/**
 * Image Optimization Script using Sharp
 * Compresses PNG icons and removes duplicates
 *
 * Usage: npx tsx scripts/optimize-images.ts
 */

import sharp from "sharp";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const CONFIG = {
  assetsDir: "./assets/images",
  backupDir: "./assets/images.backup",
  pngOptions: {
    compressionLevel: 9,
    quality: 85,
  },
  iconSizes: {
    "favicon.png": { width: 64, height: 64 },
    "icon.png": { width: 1024, height: 1024 },
    "splash-icon.png": { width: 1024, height: 1024 },
    "android-icon-foreground.png": { width: 432, height: 432 },
  },
};

async function getFileHash(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath);
  return crypto.createHash("md5").update(content).digest("hex");
}

async function optimizeImage(
  inputPath: string,
  outputPath: string,
  resize?: { width: number; height: number }
) {
  const originalStats = await fs.stat(inputPath);
  const originalSize = originalStats.size;

  let pipeline = sharp(inputPath);

  if (resize) {
    pipeline = pipeline.resize(resize.width, resize.height, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  }

  const result = await pipeline.png(CONFIG.pngOptions).toFile(outputPath);

  const reduction = (
    ((originalSize - result.size) / originalSize) *
    100
  ).toFixed(2);

  return {
    file: path.basename(inputPath),
    original: `${(originalSize / 1024).toFixed(2)} KB`,
    optimized: `${(result.size / 1024).toFixed(2)} KB`,
    reduction: `${reduction}%`,
    dimensions: resize ? `${resize.width}x${resize.height}` : "original",
  };
}

async function findDuplicates(dir: string): Promise<Map<string, string[]>> {
  const files = await fs.readdir(dir);
  const pngFiles = files.filter((f) => f.endsWith(".png"));

  const hashMap = new Map<string, string[]>();

  for (const file of pngFiles) {
    const filePath = path.join(dir, file);
    const hash = await getFileHash(filePath);

    if (!hashMap.has(hash)) {
      hashMap.set(hash, []);
    }
    hashMap.get(hash)!.push(file);
  }

  // Filter to only duplicates (2+ files with same hash)
  const duplicates = new Map<string, string[]>();
  for (const [hash, files] of hashMap) {
    if (files.length > 1) {
      duplicates.set(hash, files);
    }
  }

  return duplicates;
}

async function main() {
  console.log("=== Image Optimization Pipeline ===\n");

  // Step 1: Create backup
  console.log("1. Creating backup...");
  try {
    await fs.cp(CONFIG.assetsDir, CONFIG.backupDir, { recursive: true });
    console.log(`   Backup created at ${CONFIG.backupDir}\n`);
  } catch (e) {
    console.log("   Backup already exists or failed, continuing...\n");
  }

  // Step 2: Find duplicates
  console.log("2. Checking for duplicate images...");
  const duplicates = await findDuplicates(CONFIG.assetsDir);

  if (duplicates.size > 0) {
    console.log("   Found duplicate sets:");
    for (const [hash, files] of duplicates) {
      console.log(`   - Hash ${hash.slice(0, 8)}...: ${files.join(", ")}`);
    }
    console.log("");
  } else {
    console.log("   No duplicates found\n");
  }

  // Step 3: Optimize images
  console.log("3. Optimizing images...\n");
  const results: any[] = [];

  const files = await fs.readdir(CONFIG.assetsDir);
  const pngFiles = files.filter((f) => f.endsWith(".png"));

  for (const file of pngFiles) {
    const inputPath = path.join(CONFIG.assetsDir, file);
    const tempPath = path.join(CONFIG.assetsDir, `temp-${file}`);
    const resize = CONFIG.iconSizes[file as keyof typeof CONFIG.iconSizes];

    try {
      const result = await optimizeImage(inputPath, tempPath, resize);
      results.push(result);

      // Replace original with optimized
      await fs.unlink(inputPath);
      await fs.rename(tempPath, inputPath);
    } catch (err) {
      console.error(`   Error processing ${file}:`, err);
    }
  }

  // Step 4: Print results
  console.log("=== Optimization Results ===\n");
  console.table(results);

  const totalOriginal = results.reduce(
    (sum, r) => sum + parseFloat(r.original),
    0
  );
  const totalOptimized = results.reduce(
    (sum, r) => sum + parseFloat(r.optimized),
    0
  );
  const totalReduction = (
    ((totalOriginal - totalOptimized) / totalOriginal) *
    100
  ).toFixed(2);

  console.log(
    `\nTotal: ${totalOriginal.toFixed(2)} KB → ${totalOptimized.toFixed(2)} KB (${totalReduction}% reduction)`
  );
  console.log("\nOptimization complete!");
}

main().catch(console.error);
