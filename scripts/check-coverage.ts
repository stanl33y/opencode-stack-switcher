#!/usr/bin/env bun
/**
 * Coverage threshold checker for Bun test coverage
 * Exits with non-zero code if any file falls below 80% coverage
 */

import { spawn } from "node:child_process";

const MIN_COVERAGE_THRESHOLD = 0.8; // 80%

// Run bun test --coverage and capture output
const child = spawn("bun", ["test", "--coverage"], {
  stdio: ["pipe", "pipe", "pipe"],
  shell: true,
});

let stdout = "";
let stderr = "";

child.stdout.on("data", (data) => {
  stdout += data.toString();
});

child.stderr.on("data", (data) => {
  stderr += data.toString();
});

child.on("close", (code) => {
  try {
    // Simple approach: look for coverage percentage lines
    const lines = stdout.split("\n");
    let hasFailedFiles = false;

    console.log("📊 Coverage Analysis:");

    // Look for the coverage table separator line
    const separatorLine = lines.findIndex((line) =>
      line.includes("|---------|---------|-------------------"),
    );
    if (separatorLine === -1) {
      console.error("Error: Could not find coverage table separator");
      process.exit(1);
    }

    console.log(`DEBUG: Found separator at line ${separatorLine}: ${lines[separatorLine]}`);

    // Parse coverage data from the table (skip All files row)
    for (let i = separatorLine + 2; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes("---------------------------")) break; // End of table
      if (line.includes("All files")) continue; // Skip summary row

      // Match format: "  tests\file.ts      |  100.00 |  100.00 |"
      const coverageMatch = line.match(/^(\s+.+?)\s*\|\s*(\d+\.\d+)\s*\|\s*(\d+\.\d+)\s*/);

      if (coverageMatch) {
        const filePath = coverageMatch[1].trim();
        const funcsPercent = Number.parseFloat(coverageMatch[2]) / 100;
        const linesPercent = Number.parseFloat(coverageMatch[3]) / 100;

        if (funcsPercent < MIN_COVERAGE_THRESHOLD || linesPercent < MIN_COVERAGE_THRESHOLD) {
          console.error(
            `❌ Coverage below ${Math.round(MIN_COVERAGE_THRESHOLD * 100)}% for ${filePath}:`,
          );
          console.error(
            `   Functions: ${Math.round(funcsPercent * 100)}% (threshold: ${Math.round(MIN_COVERAGE_THRESHOLD * 100)}%)`,
          );
          console.error(
            `   Lines: ${Math.round(linesPercent * 100)}% (threshold: ${Math.round(MIN_COVERAGE_THRESHOLD * 100)}%)`,
          );
          hasFailedFiles = true;
        } else {
          console.log(
            `✅ ${filePath}: ${Math.round(funcsPercent * 100)}% functions, ${Math.round(linesPercent * 100)}% lines`,
          );
        }
      }
    }

    // Check if tests passed by looking for pass/fail summary
    // Check if tests passed by looking for pass/fail summary
    const testResults = stdout.match(/(\d+) pass\s*\n\s*(\d+) fail/i);
    if (testResults && testResults[2] === "0") {
      console.log(`\n✅ All tests passed (${testResults[1]} pass, 0 fail)`);

      if (hasFailedFiles) {
        console.error(
          `\n❌ Coverage check failed: Some files are below ${Math.round(MIN_COVERAGE_THRESHOLD * 100)}% threshold`,
        );
        process.exit(1);
      } else {
        console.log(
          `\n✅ All files meet minimum coverage threshold of ${Math.round(MIN_COVERAGE_THRESHOLD * 100)}%`,
        );
        process.exit(0);
      }
    } else if (testResults) {
      console.error(`\n❌ Some tests failed (${testResults[2]} fail) - coverage check aborted`);
      process.exit(1);
    } else {
      // If we can't find test results but bun test succeeded, assume tests passed
      if (hasFailedFiles) {
        console.error(
          `\n❌ Coverage check failed: Some files are below ${Math.round(MIN_COVERAGE_THRESHOLD * 100)}% threshold`,
        );
        process.exit(1);
      } else {
        console.log(
          `\n✅ All files meet minimum coverage threshold of ${Math.round(MIN_COVERAGE_THRESHOLD * 100)}%`,
        );
        process.exit(0);
      }
    }
  } catch (error) {
    console.error("Error parsing coverage output:", error);
    process.exit(1);
  }
});

child.on("error", (error) => {
  console.error("Error running bun test:", error);
  process.exit(1);
});
