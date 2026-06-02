import { describe, expect, it } from "vitest";
import { runDetection, generateMarkdownReport } from "./detectionEngine";

describe("detectionEngine.runDetection", () => {
  it("returns results for encrypted_backup scan type", async () => {
    const { results } = await runDetection("encrypted_backup");
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  it("returns results for filesystem_dump scan type", async () => {
    const { results } = await runDetection("filesystem_dump");
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  it("returns results for sysdiagnose scan type", async () => {
    const { results } = await runDetection("sysdiagnose");
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  it("covers at least 5 object types", async () => {
    const { results } = await runDetection("filesystem_dump");
    const objectTypes = new Set(results.map((r) => r.objectType));
    expect(objectTypes.size).toBeGreaterThanOrEqual(5);
  });

  it("includes expected object types: firmware, filesystem, process, network, memory_runtime_artifact", async () => {
    const { results } = await runDetection("filesystem_dump");
    const objectTypes = new Set(results.map((r) => r.objectType));
    expect(objectTypes.has("firmware")).toBe(true);
    expect(objectTypes.has("filesystem")).toBe(true);
    expect(objectTypes.has("process")).toBe(true);
    expect(objectTypes.has("network")).toBe(true);
    expect(objectTypes.has("memory_runtime_artifact")).toBe(true);
  });

  it("detects Pegasus-related indicators", async () => {
    const { results } = await runDetection("filesystem_dump");
    const pegasusResults = results.filter(
      (r) =>
        r.isDetected &&
        (r.description?.toLowerCase().includes("pegasus") ||
          r.matchedIndicator?.toLowerCase().includes("pegasus") ||
          r.value?.toLowerCase().includes("pegasus"))
    );
    expect(pegasusResults.length).toBeGreaterThan(0);
  });

  it("includes both IOC and heuristic source types", async () => {
    const { results } = await runDetection("filesystem_dump");
    const sources = new Set(results.map((r) => r.source));
    expect(sources.has("ioc")).toBe(true);
    expect(sources.has("heuristic")).toBe(true);
  });

  it("includes multiple severity levels", async () => {
    const { results } = await runDetection("filesystem_dump");
    const severities = new Set(results.map((r) => r.severity));
    expect(severities.size).toBeGreaterThan(1);
  });

  it("marks some results as detected", async () => {
    const { results } = await runDetection("filesystem_dump");
    const detected = results.filter((r) => r.isDetected);
    expect(detected.length).toBeGreaterThan(0);
  });

  it("returns summary with correct structure", async () => {
    const { summary } = await runDetection("encrypted_backup");
    expect(typeof summary.total).toBe("number");
    expect(typeof summary.detected).toBe("number");
    expect(typeof summary.byObjectType).toBe("object");
    expect(typeof summary.bySeverity).toBe("object");
    expect(summary.total).toBeGreaterThan(0);
  });
});

describe("detectionEngine.generateMarkdownReport", () => {
  it("generates a markdown report with required sections", async () => {
    const { results, summary } = await runDetection("encrypted_backup");
    const report = generateMarkdownReport(
      "Test Task",
      "测试设备 (iPhone 15 Pro, iOS 17.4)",
      "加密备份",
      results,
      summary
    );
    expect(typeof report).toBe("string");
    expect(report.length).toBeGreaterThan(100);
    expect(report).toContain("iOS SpyGuard");
    expect(report).toContain("摘要");
    expect(report).toContain("对象类别");
  });

  it("includes threat count in report", async () => {
    const { results, summary } = await runDetection("sysdiagnose");
    const report = generateMarkdownReport(
      "Sysdiagnose Test",
      "未知设备",
      "Sysdiagnose",
      results,
      summary
    );
    expect(report).toContain(String(summary.detected));
  });

  it("includes all severity levels that have results", async () => {
    const { results, summary } = await runDetection("filesystem_dump");
    const report = generateMarkdownReport(
      "FS Dump Test",
      "iPhone 15 Pro",
      "文件系统转储",
      results,
      summary
    );
    for (const [sev, count] of Object.entries(summary.bySeverity)) {
      if (count > 0) {
        expect(report).toContain(sev);
      }
    }
  });
});
