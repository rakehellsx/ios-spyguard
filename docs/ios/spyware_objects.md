# iOS 间谍软件对象检测扩展（SpywareObjects）

作者：**Manus AI**

## 背景与目标

本扩展基于 [Mobile Verification Toolkit（MVT）](https://github.com/mvt-project/mvt) 的 iOS 文件系统检测流程新增 `SpywareObjects` 模块。MVT 的公开文档说明，其 IOC 检测机制使用 **Structured Threat Information Expression（STIX）** 文件，并可在检查 iPhone 备份或文件系统转储时通过 `--iocs` 参数加载 IOC 文件。[1] MVT 当前支持的 STIX 指标类型包括 `domain-name:value`、`process:name`、`file:name`、`file:path`、`app:id`、`configuration-profile:id` 和 `url:value` 等，因此该扩展在实现时尽量复用这些现有匹配能力。[1]

本模块的目标是在 iOS 文件系统转储、sysdiagnose 解包目录或其他包含 iOS 系统文件的取证目录中，覆盖 **固件、内存/运行态、进程、网络、文件系统、应用、权限、配置文件、日志/缓存** 等对象，发现 Pegasus、Predator、Stalkerware 等间谍软件或商业监控软件的可疑特征。MVT 官方文档也指出，用户可以通过 `mvt-ios download-iocs` 自动下载公开指标，并可多次使用 `--iocs` 加载多个 STIX2 文件。[1]

> MVT 文档说明：“MVT uses Structured Threat Information Expression (STIX) files to identify potential traces of compromise.”[1]

## 检测对象与指标体系

`SpywareObjects` 是一个聚合型 iOS 文件系统模块。它不会替代 MVT 已有的 Safari、WebKit、Analytics、ShutdownLog、Netusage 等专门模块，而是从多对象视角补充输出统一结构的 `spyware_objects.json` 与 `spyware_objects_detected.json`。

| 对象类别 | 输出字段 `object_type` | 主要数据源 | 检测指标 | 价值 |
|---|---|---|---|---|
| 固件/系统版本 | `firmware` | `SystemVersion.plist` | iOS 版本、构建号、过旧版本、异常版本字符串、版本文件解析异常 | 判断暴露面与历史漏洞利用风险 |
| 文件系统 | `filesystem` | 全盘路径、落地文件、可疑目录 | Pegasus、Predator、Cytrox、stalkerware、exploit、payload、WebKit 等路径关键词与 IOC 文件路径 | 发现落地文件、可疑缓存和取证痕迹 |
| 进程 | `process` | `netusage.sqlite`、运行态日志、崩溃日志 | IOC 进程名、无 bundle ID 的联网进程、随机 16 位进程名、进程关键词 | 识别可疑运行组件或历史进程痕迹 |
| 网络 | `network` | Safari/WebKit/Chrome/Firefox 历史、netusage、日志文本 | IOC 域名/URL、提取到的 URL 或域名、商业监控关键词 | 关联 C2、下载链路或利用链入口 |
| 内存/运行态 | `memory_runtime_artifact` | sysdiagnose、Jetsam、panic、CrashReporter、trace 文本化日志 | 运行态片段中的 exploit、payload、WebKit、进程与 URL | 弥补 iOS 取证中通常无法直接获取实时内存镜像的限制 |
| 应用 | `application` | `.app/Info.plist`、Bundle 路径 | Bundle ID IOC、应用名称关键词、商业监控与跟踪类关键词 | 检测 Stalkerware/Watchware 或伪装应用 |
| 权限 | `permission` | `TCC.db` | 麦克风、相机、定位、通讯录、照片、蓝牙、辅助功能、全盘访问等敏感授权 | 识别监控类应用常见权限组合 |
| 配置文件 | `configuration_profile` | `ConfigurationProfiles`、`.mobileconfig`、Managed Preferences | MDM、VPN、代理、根证书、配置文件 UUID IOC | 发现设备管理、代理转发和证书植入风险 |
| 日志/缓存 | `log_cache` | Analytics、CrashReporter、WebKit storage、浏览器缓存 | exploit、payload、WebKit、Pegasus、Predator、Stalkerware 等文本痕迹 | 支持时间线和上下文复核 |

该模块将“内存”实现为 `memory_runtime_artifact`，即对 sysdiagnose、Jetsam、panic、崩溃报告、trace 文本、runningboard 日志等运行态导出物进行检测。这符合 iOS 离线取证的现实边界：普通 MVT 文件系统流程通常无法直接读取实时内存，但可以分析系统诊断与崩溃记录中留下的运行态片段。

## 文件变更

| 文件 | 作用 |
|---|---|
| `src/mvt/ios/modules/fs/spyware_objects.py` | 新增核心检测模块，扫描多类 iOS 对象并复用 MVT IOC 引擎 |
| `src/mvt/ios/modules/fs/__init__.py` | 将 `SpywareObjects` 注册到 `check-fs` 模块列表 |
| `contrib/spyware_objects/spyware_objects_iocs_template.stix2` | MVT 兼容 STIX2 IOC 模板，供填充 Pegasus、Predator、Stalkerware 等权威 IOC |
| `contrib/spyware_objects/spyware_objects_report.py` | 将 `spyware_objects.json` 与 MVT 告警文件汇总为 Markdown 报告 |
| `contrib/spyware_objects/create_test_fixture.py` | 合成测试样本生成脚本，用于端到端验证 |
| `docs/ios/spyware_objects.md` | 当前使用说明文档 |

## 使用方法

首先安装本地修改后的 MVT 版本。若已在项目根目录，可执行：

```bash
sudo pip3 install -e .
```

然后对 iOS 文件系统转储或 sysdiagnose 解包目录运行新增模块：

```bash
mvt-ios --disable-update-check --disable-indicator-update-check \
  check-fs \
  --module SpywareObjects \
  --iocs contrib/spyware_objects/spyware_objects_iocs_template.stix2 \
  --output ./out \
  /path/to/ios_fs_dump
```

在生产场景中，建议不要仅依赖模板文件，而应加载经过验证的公共或组织内部 IOC。MVT 官方维护了公开指标索引库，并说明该库汇集了可与 MVT 兼容的公开 IOC。[2] Amnesty International 的 investigations 仓库也公开了若干针对人权捍卫者定向威胁调查所提取的 IOC。[3] 对 Stalkerware 场景，Echap 的 stalkerware-indicators 仓库提供了 `generated/stalkerware.stix2` 等文件，并明确说明这些指标不能提供完整覆盖，需要谨慎使用。[4]

| IOC 来源 | 推荐用法 | 说明 |
|---|---|---|
| MVT 官方公开 IOC 索引 | `mvt-ios download-iocs` | MVT 文档推荐的自动下载方式，会由 MVT 自动加载公开 STIX2 指标。[1] |
| AmnestyTech investigations | 手动下载所需 STIX2 并通过 `--iocs` 加载 | 适合 Pegasus 等定向威胁调查相关公开指标。[3] |
| Echap stalkerware-indicators | 下载 `generated/stalkerware.stix2` 并通过 `--iocs` 加载 | 适合商业跟踪软件、watchware、stalkerware 网络与应用指标。[4] |
| 组织内部 IOC | 将域名、URL、进程、文件、Bundle ID、配置文件 UUID 转换为 MVT 支持的 STIX2 类型 | 适合内部案件、威胁情报和红队验证。 |

运行结束后，可生成 Markdown 汇总报告：

```bash
python3.11 contrib/spyware_objects/spyware_objects_report.py ./out \
  -o ./out/spyware_objects_report.md
```

## 输出字段

`spyware_objects.json` 中每条记录均为结构化对象，典型字段如下。

| 字段 | 说明 |
|---|---|
| `object_type` | 对象类别，例如 `firmware`、`process`、`network`、`permission` |
| `indicator_type` | 检测指标类型，例如 `keyword_in_content`、`sensitive_tcc_permission` |
| `value` | 命中的值，例如进程名、域名、关键词、Bundle ID 或 profile UUID |
| `path` | 证据所在的相对路径 |
| `matched_text` | 证据片段，默认截断以避免输出过大 |
| `severity` | `critical`、`high`、`medium`、`low` 或 `informational` |
| `confidence` | 置信度，通常为 `high`、`medium` 或 `low` |
| `description` | 检测含义说明 |
| `source` | `heuristic`、`netusage_database`、`tcc_database` 或 `extracted_artifact` 等来源 |
| `matched_indicator` | 若命中 STIX2 IOC，则保存 MVT 指标对象 |

## 测试验证

本扩展已经通过合成 iOS 文件系统样本进行端到端测试。测试样本包含旧版 `SystemVersion.plist`、运行态日志中的 Predator 关键词与 URL、Safari 历史中的 Pegasus 域名、带有 Stalkerware Bundle ID 的应用、MDM/VPN 配置文件、TCC 敏感权限和 netusage 中的可疑进程。

| 测试项 | 结果 |
|---|---:|
| `python3.11 -m compileall` 编译检查 | 通过 |
| `mvt-ios check-fs --list-modules` 模块注册检查 | 已显示 `SpywareObjects` |
| 合成样本端到端运行 | 通过 |
| `spyware_objects.json` 结构化结果数 | 31 |
| `spyware_objects_detected.json` 告警数 | 27 |
| Markdown 报告生成 | 通过 |

复现测试可执行：

```bash
python3.11 contrib/spyware_objects/create_test_fixture.py
rm -rf tmp/spyware_objects_out
mvt-ios --disable-update-check --disable-indicator-update-check \
  check-fs \
  --module SpywareObjects \
  --iocs contrib/spyware_objects/spyware_objects_iocs_template.stix2 \
  --output tmp/spyware_objects_out \
  tmp/spyware_objects_fixture
python3.11 contrib/spyware_objects/spyware_objects_report.py \
  tmp/spyware_objects_out \
  -o tmp/spyware_objects_out/spyware_objects_report.md
```

## 判读与限制

IOC 命中比启发式命中更具直接证据价值。若 `matched_indicator` 不为空，说明检测结果与加载的 STIX2 指标发生匹配，应优先复核 IOC 来源、采集时间、命中路径和上下文。若仅出现关键词、无 bundle ID 进程或敏感权限等启发式命中，则应作为调查线索，而不是感染结论。

Stalkerware 检测尤其需要谨慎。Echap 项目明确警告，其指标不能提供完整检测覆盖，没有命中不应理解为设备不存在 Stalkerware。[4] 同样，Pegasus 与 Predator 等高级间谍软件具有快速更换基础设施和清除痕迹的能力，离线文件系统检测也可能受到设备重启、系统清理、iOS 版本变化和日志保留周期影响。因此，本扩展适合作为 MVT 的补充指标层，而不是最终鉴定报告。

## References

[1]: https://docs.mvt.re/en/latest/iocs/ "MVT Documentation: Indicators of Compromise (IOCs)"
[2]: https://github.com/mvt-project/mvt-indicators "mvt-project/mvt-indicators"
[3]: https://github.com/AmnestyTech/investigations "AmnestyTech investigations"
[4]: https://github.com/AssoEchap/stalkerware-indicators "AssoEchap stalkerware-indicators"
