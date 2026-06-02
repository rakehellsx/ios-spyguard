/**
 * iOS SpyGuard Detection Engine
 * Simulates MVT SpywareObjects multi-object detection logic.
 * Covers 5+ object classes: firmware, filesystem, process, network, memory_runtime_artifact,
 * application, permission, configuration_profile, log_cache
 */

export interface DetectionResult {
  objectType: string;
  indicatorType: string;
  value: string;
  path: string;
  matchedText: string;
  severity: "critical" | "high" | "medium" | "low" | "informational";
  confidence: "high" | "medium" | "low";
  description: string;
  source: "ioc" | "heuristic";
  matchedIndicator: string;
  isDetected: boolean;
  timestamp: string;
}

export interface DetectionSummary {
  total: number;
  detected: number;
  byObjectType: Record<string, number>;
  bySeverity: Record<string, number>;
}

// ─── IOC Indicators (representative set) ─────────────────────────────────────
const IOC_DOMAINS = [
  // Pegasus NSO Group infrastructure
  "samsungtechwin.com", "osxperfectapps.com", "mobiletechvideos.com",
  "phonereviewsite.com", "appleupdate.net", "icloudbackup.net",
  "cdn.cloudfront-apple.com", "apple-icloud.net", "icloud-update.com",
  // Predator / Cytrox
  "intellexagroup.com", "cytrox.com", "predatorspyware.net",
  "alienvault-update.com", "nexaspy.net",
  // Stalkerware
  "mspy.com", "flexispy.com", "spyzie.com", "cocospy.com",
  "hoverwatch.com", "xnspy.com", "eyezy.com",
];

const IOC_PROCESSES = [
  "bh", "pcsd", "IMTranscodeAgent", "falafel", "msgacntd",
  "natgaserd", "launchafd", "rolldice", "aggregated",
  "com.apple.private.alloy.stickies",
];

const IOC_FILE_PATHS = [
  "/private/var/db/com.apple.xpc.roleaccountd.staging",
  "/private/var/tmp/com.apple.appstored",
  "/private/var/mobile/Library/Preferences/com.apple.Preferences.plist.bak",
  "/usr/lib/TweakInject",
  "/usr/lib/substitute-inserter.dylib",
  "/private/var/mobile/Library/Caches/.com.apple.mobile.installation.plist",
];

const IOC_BUNDLE_IDS = [
  "com.mspy.agent", "com.flexispy.agent", "com.spyzie.tracker",
  "com.hoverwatch.monitor", "com.cocospy.tracker",
  "com.apple.private.alloy.stickies",
];

const IOC_PROFILE_IDS = [
  "com.mdm.enterprise.profile", "com.vpn.proxy.config",
  "com.rootca.install", "com.mdm.supervision.profile",
];

// ─── Heuristic Keywords ───────────────────────────────────────────────────────
const SPYWARE_KEYWORDS = [
  "pegasus", "predator", "cytrox", "stalkerware", "spyware",
  "surveillance", "keylogger", "stealth", "payload", "exploit",
  "webkit", "imtranscoderagent", "bh", "pcsd",
];

const SUSPICIOUS_PERMISSIONS = [
  "kTCCServiceMicrophone", "kTCCServiceCamera", "kTCCServiceLocation",
  "kTCCServiceAccessibility", "kTCCServiceSystemPolicyAllFiles",
  "kTCCServiceListenEvent",
];

// ─── Mock File System Structure (for simulation) ──────────────────────────────
function generateMockFilesystem(scanType: string): string[] {
  const base = [
    "System/Library/CoreServices/SystemVersion.plist",
    "private/var/mobile/Library/Safari/History.db",
    "private/var/mobile/Library/Safari/Bookmarks.db",
    "private/var/networkd/netusage.sqlite",
    "private/var/mobile/Library/TCC/TCC.db",
    "private/var/mobile/Library/Preferences/com.apple.mobilesafari.plist",
    "private/var/mobile/Library/Caches/com.apple.WebKit/",
    "private/var/mobile/Library/Logs/CrashReporter/",
    "private/var/mobile/Library/Analytics/",
    "private/var/db/diagnostics/",
    "private/var/containers/Bundle/Application/",
    "private/var/mobile/Library/ConfigurationProfiles/",
  ];

  if (scanType === "sysdiagnose") {
    return [
      ...base,
      "sysdiagnose/system_logs/",
      "sysdiagnose/crashes/",
      "sysdiagnose/jetsam/",
      "sysdiagnose/runningboard/",
      "sysdiagnose/panic/",
      "sysdiagnose/tracev3/",
    ];
  }

  if (scanType === "filesystem_dump") {
    return [
      ...base,
      "private/var/db/com.apple.xpc.roleaccountd.staging",
      "private/var/tmp/com.apple.appstored",
      "private/var/mobile/Library/Preferences/com.apple.Preferences.plist.bak",
      "usr/lib/TweakInject",
      "private/var/mobile/Library/ConfigurationProfiles/MDM.mobileconfig",
    ];
  }

  return base;
}

// ─── Detection Functions ──────────────────────────────────────────────────────

function detectFirmware(scanType: string): DetectionResult[] {
  const results: DetectionResult[] = [];
  const now = new Date().toISOString();

  // Firmware version check
  results.push({
    objectType: "firmware",
    indicatorType: "system_version",
    value: "iOS 14.8",
    path: "System/Library/CoreServices/SystemVersion.plist",
    matchedText: "ProductVersion: 14.8",
    severity: "medium",
    confidence: "high",
    description: "设备运行 iOS 14.8，该版本存在已知 Pegasus 利用漏洞（CVE-2021-30860 FORCEDENTRY）",
    source: "heuristic",
    matchedIndicator: "",
    isDetected: true,
    timestamp: now,
  });

  if (scanType === "filesystem_dump") {
    results.push({
      objectType: "firmware",
      indicatorType: "suspicious_file",
      value: "com.apple.Preferences.plist.bak",
      path: "private/var/mobile/Library/Preferences/com.apple.Preferences.plist.bak",
      matchedText: "异常备份文件，可能为间谍软件持久化痕迹",
      severity: "high",
      confidence: "medium",
      description: "在系统偏好设置目录发现异常 .bak 文件，与已知 Pegasus 持久化机制相符",
      source: "heuristic",
      matchedIndicator: "",
      isDetected: true,
      timestamp: now,
    });
  }

  return results;
}

function detectFilesystem(scanType: string): DetectionResult[] {
  const results: DetectionResult[] = [];
  const now = new Date().toISOString();
  const files = generateMockFilesystem(scanType);

  // IOC file path matches
  for (const iocPath of IOC_FILE_PATHS) {
    const relPath = iocPath.replace(/^\//, "");
    if (files.some((f) => f.includes(relPath.split("/").pop()!))) {
      results.push({
        objectType: "filesystem",
        indicatorType: "file_path",
        value: iocPath,
        path: relPath,
        matchedText: `IOC 文件路径命中: ${iocPath}`,
        severity: "critical",
        confidence: "high",
        description: `文件路径与已知间谍软件 IOC 完全匹配，强烈建议复核`,
        source: "ioc",
        matchedIndicator: iocPath,
        isDetected: true,
        timestamp: now,
      });
    }
  }

  // Keyword scan in filesystem paths
  for (const kw of ["TweakInject", "substitute-inserter", "Cydia"]) {
    if (files.some((f) => f.toLowerCase().includes(kw.toLowerCase()))) {
      results.push({
        objectType: "filesystem",
        indicatorType: "keyword_match",
        value: kw,
        path: files.find((f) => f.toLowerCase().includes(kw.toLowerCase())) ?? "",
        matchedText: kw,
        severity: "high",
        confidence: "medium",
        description: `文件系统中发现越狱/注入相关路径 "${kw}"，可能为间谍软件注入载体`,
        source: "heuristic",
        matchedIndicator: "",
        isDetected: true,
        timestamp: now,
      });
    }
  }

  // WebKit cache artifacts
  results.push({
    objectType: "filesystem",
    indicatorType: "webkit_artifact",
    value: "WebKit Storage Cache",
    path: "private/var/mobile/Library/Caches/com.apple.WebKit/",
    matchedText: "WebKit 缓存目录存在，包含潜在利用链痕迹",
    severity: "low",
    confidence: "low",
    description: "WebKit 缓存目录存在，Pegasus 等间谍软件常通过 WebKit 漏洞实现零点击攻击",
    source: "heuristic",
    matchedIndicator: "",
    isDetected: false,
    timestamp: now,
  });

  return results;
}

function detectProcess(scanType: string): DetectionResult[] {
  const results: DetectionResult[] = [];
  const now = new Date().toISOString();

  // IOC process matches
  for (const proc of IOC_PROCESSES.slice(0, 3)) {
    results.push({
      objectType: "process",
      indicatorType: "process_name",
      value: proc,
      path: "private/var/networkd/netusage.sqlite",
      matchedText: `process: ${proc}`,
      severity: proc === "bh" || proc === "pcsd" ? "critical" : "high",
      confidence: "high",
      description: `进程名 "${proc}" 与已知 iOS 利用链中出现的可疑进程 IOC 匹配`,
      source: "ioc",
      matchedIndicator: proc,
      isDetected: true,
      timestamp: now,
    });
  }

  // Random process name heuristic
  results.push({
    objectType: "process",
    indicatorType: "random_process_name",
    value: "A3f9Kx2mNpQr7vWz",
    path: "private/var/networkd/netusage.sqlite",
    matchedText: "process: A3f9Kx2mNpQr7vWz (无 Bundle ID，联网进程)",
    severity: "high",
    confidence: "medium",
    description: "发现随机化命名的联网进程（16位字母数字，无 Bundle ID），与 Pegasus 进程混淆手法相符",
    source: "heuristic",
    matchedIndicator: "",
    isDetected: true,
    timestamp: now,
  });

  // No-bundle-id process
  results.push({
    objectType: "process",
    indicatorType: "no_bundle_id_network",
    value: "natgaserd",
    path: "private/var/networkd/netusage.sqlite",
    matchedText: "process: natgaserd (bundle_id: NULL, bytes_in: 2048576)",
    severity: "high",
    confidence: "medium",
    description: "发现无 Bundle ID 的联网进程 natgaserd，与已知 Pegasus 后台通信进程特征相符",
    source: "heuristic",
    matchedIndicator: "",
    isDetected: true,
    timestamp: now,
  });

  if (scanType === "sysdiagnose") {
    results.push({
      objectType: "process",
      indicatorType: "crash_process",
      value: "IMTranscodeAgent",
      path: "sysdiagnose/crashes/IMTranscodeAgent.ips",
      matchedText: "Exception Type: EXC_BAD_ACCESS, process: IMTranscodeAgent",
      severity: "critical",
      confidence: "high",
      description: "IMTranscodeAgent 崩溃日志与 Pegasus FORCEDENTRY 利用链中的进程崩溃模式高度吻合",
      source: "ioc",
      matchedIndicator: "IMTranscodeAgent",
      isDetected: true,
      timestamp: now,
    });
  }

  return results;
}

function detectNetwork(scanType: string): DetectionResult[] {
  const results: DetectionResult[] = [];
  const now = new Date().toISOString();

  // IOC domain matches
  for (const domain of IOC_DOMAINS.slice(0, 4)) {
    const isStalkerware = ["mspy.com", "flexispy.com", "spyzie.com", "cocospy.com"].includes(domain);
    results.push({
      objectType: "network",
      indicatorType: "domain",
      value: domain,
      path: "private/var/mobile/Library/Safari/History.db",
      matchedText: `https://${domain}/`,
      severity: isStalkerware ? "high" : "critical",
      confidence: "high",
      description: `域名 "${domain}" 与已知 ${isStalkerware ? "Stalkerware" : "Pegasus/Predator"} C2 基础设施 IOC 完全匹配`,
      source: "ioc",
      matchedIndicator: domain,
      isDetected: true,
      timestamp: now,
    });
  }

  // Suspicious URL in Safari history
  results.push({
    objectType: "network",
    indicatorType: "url",
    value: "https://samsungtechwin.com/v4/process?id=abc123",
    path: "private/var/mobile/Library/Safari/History.db",
    matchedText: "https://samsungtechwin.com/v4/process?id=abc123",
    severity: "critical",
    confidence: "high",
    description: "Safari 历史记录中发现 Pegasus C2 服务器 URL，包含典型的 /v4/process 路径",
    source: "ioc",
    matchedIndicator: "samsungtechwin.com",
    isDetected: true,
    timestamp: now,
  });

  // WebKit exploitation URL
  results.push({
    objectType: "network",
    indicatorType: "exploit_url",
    value: "https://cdn.cloudfront-apple.com/exploit.js",
    path: "private/var/mobile/Library/Caches/com.apple.WebKit/",
    matchedText: "webkit exploit payload URL",
    severity: "critical",
    confidence: "medium",
    description: "WebKit 缓存中发现伪装成 Apple CDN 的可疑 JavaScript 载荷 URL",
    source: "heuristic",
    matchedIndicator: "",
    isDetected: true,
    timestamp: now,
  });

  return results;
}

function detectMemoryRuntime(scanType: string): DetectionResult[] {
  const results: DetectionResult[] = [];
  const now = new Date().toISOString();

  if (scanType !== "sysdiagnose" && scanType !== "filesystem_dump") {
    results.push({
      objectType: "memory_runtime_artifact",
      indicatorType: "jetsam_snapshot",
      value: "Jetsam snapshot",
      path: "private/var/mobile/Library/Logs/CrashReporter/",
      matchedText: "Jetsam 快照存在，包含运行态进程列表",
      severity: "informational",
      confidence: "low",
      description: "Jetsam 内存压力快照存在，可用于分析运行态进程内存占用",
      source: "heuristic",
      matchedIndicator: "",
      isDetected: false,
      timestamp: now,
    });
    return results;
  }

  // Panic log with exploit keywords
  results.push({
    objectType: "memory_runtime_artifact",
    indicatorType: "panic_log_keyword",
    value: "exploit payload",
    path: "sysdiagnose/panic/panic-full-2024-01-15.ips",
    matchedText: "... payload: 0x00000001 exploit_chain webkit ...",
    severity: "critical",
    confidence: "high",
    description: "Panic 日志中发现 exploit/payload/webkit 关键词组合，与 Pegasus FORCEDENTRY 利用链运行态痕迹高度吻合",
    source: "heuristic",
    matchedIndicator: "",
    isDetected: true,
    timestamp: now,
  });

  // Jetsam with suspicious process
  results.push({
    objectType: "memory_runtime_artifact",
    indicatorType: "jetsam_process",
    value: "bh",
    path: "sysdiagnose/jetsam/jetsam-2024-01-15.json",
    matchedText: '{"name":"bh","pid":1234,"reason":"per-process-limit"}',
    severity: "critical",
    confidence: "high",
    description: "Jetsam 快照中发现可疑进程 'bh'，与历史 iOS 利用链中出现的 Pegasus 进程名 IOC 匹配",
    source: "ioc",
    matchedIndicator: "bh",
    isDetected: true,
    timestamp: now,
  });

  // RunningBoard trace
  results.push({
    objectType: "memory_runtime_artifact",
    indicatorType: "runningboard_trace",
    value: "IMTranscodeAgent crash",
    path: "sysdiagnose/runningboard/runningboard.txt",
    matchedText: "process IMTranscodeAgent terminated: signal 11 (SIGSEGV)",
    severity: "high",
    confidence: "medium",
    description: "RunningBoard 追踪日志显示 IMTranscodeAgent 异常终止，与 Pegasus 利用链中的进程崩溃序列相符",
    source: "heuristic",
    matchedIndicator: "",
    isDetected: true,
    timestamp: now,
  });

  // CrashReporter WebKit
  results.push({
    objectType: "memory_runtime_artifact",
    indicatorType: "webkit_crash",
    value: "WebContent crash",
    path: "sysdiagnose/crashes/WebContent-2024-01-15.ips",
    matchedText: "Exception Type: EXC_BAD_ACCESS KERN_INVALID_ADDRESS, process: WebContent",
    severity: "high",
    confidence: "medium",
    description: "WebContent 进程崩溃日志，崩溃地址模式与 WebKit 漏洞利用（CVE-2021-30860）相符",
    source: "heuristic",
    matchedIndicator: "",
    isDetected: true,
    timestamp: now,
  });

  return results;
}

function detectApplication(scanType: string): DetectionResult[] {
  const results: DetectionResult[] = [];
  const now = new Date().toISOString();

  // IOC Bundle ID matches
  for (const bundleId of IOC_BUNDLE_IDS.slice(0, 2)) {
    results.push({
      objectType: "application",
      indicatorType: "bundle_id",
      value: bundleId,
      path: `private/var/containers/Bundle/Application/${bundleId}`,
      matchedText: `CFBundleIdentifier: ${bundleId}`,
      severity: "critical",
      confidence: "high",
      description: `应用 Bundle ID "${bundleId}" 与已知 Stalkerware 应用 IOC 完全匹配`,
      source: "ioc",
      matchedIndicator: bundleId,
      isDetected: true,
      timestamp: now,
    });
  }

  // Suspicious app name heuristic
  results.push({
    objectType: "application",
    indicatorType: "suspicious_app_name",
    value: "System Service",
    path: "private/var/containers/Bundle/Application/ABCD1234/Info.plist",
    matchedText: 'CFBundleDisplayName: "System Service", CFBundleIdentifier: "com.system.service.agent"',
    severity: "high",
    confidence: "medium",
    description: "发现伪装成系统服务的应用，使用通用名称和非官方 Bundle ID，与 Stalkerware 伪装手法相符",
    source: "heuristic",
    matchedIndicator: "",
    isDetected: true,
    timestamp: now,
  });

  return results;
}

function detectPermission(scanType: string): DetectionResult[] {
  const results: DetectionResult[] = [];
  const now = new Date().toISOString();

  // Suspicious permission grants
  const suspiciousGrants = [
    {
      service: "kTCCServiceAccessibility",
      label: "辅助功能",
      app: "com.system.service.agent",
      severity: "critical" as const,
    },
    {
      service: "kTCCServiceMicrophone",
      label: "麦克风",
      app: "com.mspy.agent",
      severity: "critical" as const,
    },
    {
      service: "kTCCServiceCamera",
      label: "摄像头",
      app: "com.mspy.agent",
      severity: "high" as const,
    },
    {
      service: "kTCCServiceSystemPolicyAllFiles",
      label: "完整磁盘访问",
      app: "com.system.service.agent",
      severity: "critical" as const,
    },
    {
      service: "kTCCServiceListenEvent",
      label: "输入监控",
      app: "com.flexispy.agent",
      severity: "critical" as const,
    },
  ];

  for (const grant of suspiciousGrants) {
    results.push({
      objectType: "permission",
      indicatorType: "sensitive_permission",
      value: `${grant.service} → ${grant.app}`,
      path: "private/var/mobile/Library/TCC/TCC.db",
      matchedText: `service: ${grant.service}, client: ${grant.app}, allowed: 1`,
      severity: grant.severity,
      confidence: "high",
      description: `应用 "${grant.app}" 被授予 ${grant.label} 权限（${grant.service}），与间谍软件监控能力需求高度匹配`,
      source: "heuristic",
      matchedIndicator: "",
      isDetected: true,
      timestamp: now,
    });
  }

  return results;
}

function detectConfigurationProfile(scanType: string): DetectionResult[] {
  const results: DetectionResult[] = [];
  const now = new Date().toISOString();

  // IOC profile ID
  results.push({
    objectType: "configuration_profile",
    indicatorType: "profile_uuid",
    value: "com.mdm.enterprise.profile",
    path: "private/var/mobile/Library/ConfigurationProfiles/MDM.mobileconfig",
    matchedText: "PayloadIdentifier: com.mdm.enterprise.profile",
    severity: "high",
    confidence: "high",
    description: "配置文件 UUID 与已知恶意 MDM 配置文件 IOC 匹配，可能用于远程设备控制",
    source: "ioc",
    matchedIndicator: "com.mdm.enterprise.profile",
    isDetected: true,
    timestamp: now,
  });

  // VPN/Proxy profile
  results.push({
    objectType: "configuration_profile",
    indicatorType: "vpn_proxy_profile",
    value: "com.vpn.proxy.config",
    path: "private/var/mobile/Library/ConfigurationProfiles/VPN.mobileconfig",
    matchedText: "PayloadType: com.apple.vpn.managed, ProxyServer: 185.220.101.x",
    severity: "high",
    confidence: "medium",
    description: "发现 VPN/代理配置文件，代理服务器 IP 属于已知 Tor 出口节点范围，可能用于 C2 流量隐藏",
    source: "heuristic",
    matchedIndicator: "",
    isDetected: true,
    timestamp: now,
  });

  // Root CA profile
  results.push({
    objectType: "configuration_profile",
    indicatorType: "root_ca",
    value: "Untrusted Root CA",
    path: "private/var/mobile/Library/ConfigurationProfiles/RootCA.mobileconfig",
    matchedText: "PayloadType: com.apple.security.root, Subject: CN=Enterprise Root CA",
    severity: "high",
    confidence: "medium",
    description: "发现非官方根证书配置文件，可能用于 HTTPS 流量拦截（中间人攻击）",
    source: "heuristic",
    matchedIndicator: "",
    isDetected: true,
    timestamp: now,
  });

  return results;
}

function detectLogCache(scanType: string): DetectionResult[] {
  const results: DetectionResult[] = [];
  const now = new Date().toISOString();

  // Analytics log keyword
  results.push({
    objectType: "log_cache",
    indicatorType: "analytics_keyword",
    value: "pegasus",
    path: "private/var/mobile/Library/Analytics/analytics-2024-01-15.ips",
    matchedText: "... pegasus_agent_init: 0x1 ...",
    severity: "critical",
    confidence: "high",
    description: "Analytics 日志中发现 'pegasus' 关键词，与 Pegasus 间谍软件初始化日志痕迹相符",
    source: "heuristic",
    matchedIndicator: "",
    isDetected: true,
    timestamp: now,
  });

  // CrashReporter payload keyword
  results.push({
    objectType: "log_cache",
    indicatorType: "crash_keyword",
    value: "exploit payload",
    path: "private/var/mobile/Library/Logs/CrashReporter/WebContent.ips",
    matchedText: "... exploit_payload_load: addr=0xdeadbeef ...",
    severity: "critical",
    confidence: "medium",
    description: "崩溃日志中发现 exploit/payload 关键词组合，与漏洞利用载荷加载痕迹相符",
    source: "heuristic",
    matchedIndicator: "",
    isDetected: true,
    timestamp: now,
  });

  // WebKit storage artifact
  results.push({
    objectType: "log_cache",
    indicatorType: "webkit_storage",
    value: "WebKit Storage",
    path: "private/var/mobile/Library/Caches/com.apple.WebKit/",
    matchedText: "WebKit LocalStorage 包含可疑 base64 编码数据",
    severity: "medium",
    confidence: "low",
    description: "WebKit 本地存储中发现大量 base64 编码数据，可能为间谍软件数据外传的中间缓存",
    source: "heuristic",
    matchedIndicator: "",
    isDetected: false,
    timestamp: now,
  });

  return results;
}

// ─── Main Detection Function ──────────────────────────────────────────────────
export async function runDetection(
  scanType: string,
  iocEnabled: boolean = true,
  progressCallback?: (progress: number, message: string) => void
): Promise<{ results: DetectionResult[]; summary: DetectionSummary }> {
  const allResults: DetectionResult[] = [];

  const steps = [
    { fn: detectFirmware, label: "固件与系统版本检测", weight: 10 },
    { fn: detectFilesystem, label: "文件系统扫描", weight: 20 },
    { fn: detectProcess, label: "进程分析", weight: 15 },
    { fn: detectNetwork, label: "网络痕迹检测", weight: 20 },
    { fn: detectMemoryRuntime, label: "内存/运行态痕迹分析", weight: 15 },
    { fn: detectApplication, label: "应用检测", weight: 10 },
    { fn: detectPermission, label: "权限分析", weight: 5 },
    { fn: detectConfigurationProfile, label: "配置文件检测", weight: 3 },
    { fn: detectLogCache, label: "日志与缓存扫描", weight: 2 },
  ];

  let cumulativeProgress = 0;
  for (const step of steps) {
    progressCallback?.(cumulativeProgress, step.label);
    // Simulate async detection delay
    await new Promise((r) => setTimeout(r, 200));
    const stepResults = step.fn(scanType);
    allResults.push(...stepResults);
    cumulativeProgress += step.weight;
    progressCallback?.(cumulativeProgress, `${step.label} 完成`);
  }

  // Build summary
  const byObjectType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  let detected = 0;

  for (const r of allResults) {
    byObjectType[r.objectType] = (byObjectType[r.objectType] ?? 0) + 1;
    bySeverity[r.severity] = (bySeverity[r.severity] ?? 0) + 1;
    if (r.isDetected) detected++;
  }

  const summary: DetectionSummary = {
    total: allResults.length,
    detected,
    byObjectType,
    bySeverity,
  };

  return { results: allResults, summary };
}

// ─── Report Generator ─────────────────────────────────────────────────────────
export function generateMarkdownReport(
  taskName: string,
  deviceInfo: string,
  scanType: string,
  results: DetectionResult[],
  summary: DetectionSummary
): string {
  const now = new Date().toLocaleString("zh-CN");
  const severityOrder = ["critical", "high", "medium", "low", "informational"];

  const lines: string[] = [];

  lines.push(`# iOS 间谍软件对象检测报告`);
  lines.push(``);
  lines.push(`> 本报告由 iOS SpyGuard 平台自动生成，基于 MVT SpywareObjects 检测引擎`);
  lines.push(``);
  lines.push(`## 基本信息`);
  lines.push(``);
  lines.push(`| 项目 | 内容 |`);
  lines.push(`|---|---|`);
  lines.push(`| 任务名称 | ${taskName} |`);
  lines.push(`| 检测设备 | ${deviceInfo} |`);
  lines.push(`| 采集方式 | ${scanType} |`);
  lines.push(`| 报告生成时间 | ${now} |`);
  lines.push(``);
  lines.push(`## 摘要`);
  lines.push(``);
  lines.push(
    `本报告覆盖固件、文件系统、进程、网络、内存/运行态痕迹、应用、权限、配置文件、日志/缓存等 ${Object.keys(summary.byObjectType).length} 类对象的检测结果。`
  );
  lines.push(``);
  lines.push(`| 指标 | 数量 |`);
  lines.push(`|---|---:|`);
  lines.push(`| 结构化结果总数 | ${summary.total} |`);
  lines.push(`| 告警级命中 | ${summary.detected} |`);
  lines.push(`| 涉及对象类别 | ${Object.keys(summary.byObjectType).length} |`);
  lines.push(``);
  lines.push(`## 按严重性统计`);
  lines.push(``);
  lines.push(`| 严重性 | 数量 |`);
  lines.push(`|---|---:|`);
  for (const sev of severityOrder) {
    if (summary.bySeverity[sev]) {
      lines.push(`| ${sev} | ${summary.bySeverity[sev]} |`);
    }
  }
  lines.push(``);
  lines.push(`## 按对象类别统计`);
  lines.push(``);
  lines.push(`| 对象类别 | 数量 |`);
  lines.push(`|---|---:|`);
  for (const [type, count] of Object.entries(summary.byObjectType).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${type} | ${count} |`);
  }
  lines.push(``);
  lines.push(`## 重点发现`);
  lines.push(``);
  lines.push(`| 对象 | 严重性 | 来源 | 指标类型 | 值 | 说明 |`);
  lines.push(`|---|---|---|---|---|---|`);
  const sorted = [...results].sort(
    (a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity)
  );
  for (const r of sorted.slice(0, 50)) {
    lines.push(
      `| ${r.objectType} | ${r.severity} | ${r.source} | ${r.indicatorType} | ${(r.value ?? "").slice(0, 60)} | ${(r.description ?? "").slice(0, 80)} |`
    );
  }
  lines.push(``);
  lines.push(`## 判读建议`);
  lines.push(``);
  lines.push(
    `IOC 命中比启发式命中具有更高证据价值。如果 \`matchedIndicator\` 字段不为空，说明结果与加载的 STIX2 IOC 命中，应优先复核 IOC 来源、时间线、路径和上下文。若仅出现关键词、无 Bundle ID 进程、敏感权限或 MDM/VPN 配置文件等启发式命中，则应作为调查线索，而不是感染结论。`
  );
  lines.push(``);
  lines.push(
    `Pegasus、Predator 等高级间谍软件可能会快速更换基础设施并清除痕迹；Stalkerware 也可能使用合法签名、家长控制、MDM 或 VPN 伪装。建议将本工具结果与设备所有者访谈、系统版本、备份时间、网络日志、崩溃日志、应用安装记录和配置文件记录综合分析。`
  );
  lines.push(``);
  lines.push(`---`);
  lines.push(`*本报告由 iOS SpyGuard Web 平台自动生成，仅供专业安全研究人员参考使用*`);

  return lines.join("\n");
}
