# iOS SpyGuard

## 项目简介

**iOS SpyGuard** 是基于 [Mobile Verification Toolkit（MVT）](https://github.com/mvt-project/mvt) 扩展的 iOS 间谍软件检测工具。项目新增 `SpywareObjects` 检测模块，用于在 iOS 备份、文件系统转储、sysdiagnose 解包目录或其他 iOS 取证目录中发现 Pegasus、Predator、Stalkerware 等间谍软件相关的 IOC 与启发式痕迹。MVT 官方文档说明，MVT 可对 iPhone 备份或文件系统转储加载 STIX2 IOC 文件进行检测，并会将命中结果保存为带 `_detected` 后缀的 JSON 文件。[1] [2]

本工具重点实现多对象聚合检测，覆盖 **固件、文件系统、进程、网络、内存/运行态痕迹、应用、权限、配置文件、日志/缓存** 等对象。由于 iOS 常规离线取证无法直接读取实时物理内存，本文档中的“内存”检测特指 sysdiagnose、Jetsam、panic、CrashReporter、trace、runningboard 等运行态导出物中的进程、崩溃、载荷、WebKit、URL 和关键词片段。

> MVT 官方文档说明：“MVT uses Structured Threat Information Expression (STIX) files to identify potential traces of compromise.”[2]

## 检测能力

`SpywareObjects` 不替代 MVT 原有的 Safari、WebKit、Analytics、Netusage、ShutdownLog 等专用模块，而是补充一个从对象类别角度汇总风险线索的聚合模块。它可以复用 MVT 对 `domain-name:value`、`process:name`、`file:name`、`file:path`、`app:id`、`configuration-profile:id`、`url:value` 等 STIX2 类型的 IOC 匹配能力。[2]

| 对象类别 | 输出 `object_type` | 典型数据源 | 检测内容 |
|---|---|---|---|
| 固件与系统版本 | `firmware` | `SystemVersion.plist` | iOS 版本、构建号、过旧版本、异常版本文件 |
| 文件系统 | `filesystem` | 全盘路径、可疑目录、落地文件 | IOC 文件路径、Pegasus/Predator/Stalkerware 关键词、payload/exploit/WebKit 痕迹 |
| 进程 | `process` | `netusage.sqlite`、崩溃日志、运行态日志 | IOC 进程名、无 Bundle ID 联网进程、随机化进程名、商业监控关键词 |
| 网络 | `network` | Safari/WebKit/浏览器历史、日志、缓存 | IOC 域名与 URL、C2 域名、下载链路、利用链入口 |
| 内存/运行态 | `memory_runtime_artifact` | sysdiagnose、Jetsam、panic、CrashReporter、trace | 运行态 exploit、payload、WebKit、进程名、URL 与崩溃上下文 |
| 应用 | `application` | `.app/Info.plist`、应用 Bundle 路径 | Stalkerware/Watchware Bundle ID、可疑应用名称、伪装应用元数据 |
| 权限 | `permission` | `TCC.db` | 麦克风、相机、定位、通讯录、照片、蓝牙、辅助功能等敏感授权 |
| 配置文件 | `configuration_profile` | `ConfigurationProfiles`、`.mobileconfig` | MDM、VPN、代理、根证书、配置文件 UUID IOC |
| 日志/缓存 | `log_cache` | Analytics、CrashReporter、WebKit Storage、浏览器缓存 | exploit、payload、Pegasus、Predator、Stalkerware 等文本痕迹 |

## 支持的 iOS 手机型号

本工具的检测逻辑面向 **iOS/iPhoneOS 设备产生的备份与文件系统取证数据**，核心限制来自 MVT 可解析的数据类型、用户能否完成备份或文件系统采集，以及具体 iOS 版本的日志保留策略，而不是某一个硬件型号。MVT 文档建议在分析 iOS 设备前先选择合适的取证路径；文件系统转储可能需要越狱或专用取证能力，而 iTunes/Finder 备份通常是更安全、优先的采集方式。[3]

| 支持级别 | 明确支持的 iPhone 型号 | 说明 |
|---|---|---|
| 当前 iOS 主线型号 | iPhone 11、11 Pro、11 Pro Max、SE 第 2 代、12 mini、12、12 Pro、12 Pro Max、13 mini、13、13 Pro、13 Pro Max、SE 第 3 代、14、14 Plus、14 Pro、14 Pro Max、15、15 Plus、15 Pro、15 Pro Max、16、16 Plus、16 Pro、16 Pro Max、16e、17、17 Pro、17 Pro Max、iPhone Air、17e | Apple iPhone 用户指南的 iOS 26 兼容机型页面列出了这些可运行 iOS 26 的型号。[4] 对这些型号，建议优先采用 Finder/iTunes 加密备份、sysdiagnose 和可获得的日志进行检测。 |
| 历史 64 位型号 | iPhone 5s、6、6 Plus、6s、6s Plus、SE 第 1 代、7、7 Plus、8、8 Plus、X、XS、XS Max、XR | 这些设备通常仍可产生 iTunes/Finder 备份；只要可以导出备份或文件系统转储，本工具即可对相应文件进行离线检测。旧系统日志结构可能存在差异，检测覆盖取决于实际导出的数据。 |
| 不建议作为主要目标 | iPhone 5 及更早 32 位设备 | 本工具未针对 32 位旧版 iOS 结构进行专项适配。若能取得备份或文件系统转储，可尝试运行，但检测结果需要人工复核。 |

因此，推荐将“支持型号”理解为：**iPhone 5s 及更新机型均可尝试离线检测；iPhone 11 及更新、并运行当前 Apple 支持 iOS 主线版本的设备属于优先支持范围；全文件系统检测能力取决于能否安全取得文件系统转储。**

## 安装方法

建议在 Linux 或 macOS 环境中运行。若在全新环境安装，可执行以下命令：

```bash
git clone https://github.com/rakehellsx/ios-spyguard.git
cd ios-spyguard
python3.11 -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install -e .
```

如果直接在系统 Python 中安装，也可执行：

```bash
sudo pip3 install -e .
```

安装后确认命令可用：

```bash
mvt-ios --help
mvt-ios check-fs --list-modules /tmp
```

若输出模块列表中出现 `SpywareObjects`，说明扩展模块已经注册成功。

## 如何操作 iOS 手机并采集数据

### 方式一：优先推荐的加密备份采集

MVT 官方文档说明，加密备份会包含未加密备份没有的一些有价值记录，例如 Safari 历史和 Safari 状态等。[3] 因此，在用户同意和合法授权前提下，应优先创建 **加密本地备份**。

| 步骤 | 操作 |
|---|---|
| 1 | 准备一台可信的 Mac 或 Linux 取证工作站，安装 iOS 数据线所需依赖。Mac 可使用 Finder；Linux 可使用 `libimobiledevice`。 |
| 2 | 将 iPhone 连接到电脑，保持手机解锁。在手机弹窗中点击“信任此电脑”，并输入锁屏密码确认。 |
| 3 | 在 Finder 或 iTunes 中选择“将 iPhone 上的所有数据备份到此 Mac”，勾选“加密本地备份”，设置并妥善保存备份密码。 |
| 4 | 保持手机解锁直到备份完成。MVT 文档也建议备份期间尽量保持手机解锁。[1] |
| 5 | 找到备份目录后，先用 `mvt-ios decrypt-backup` 解密，再运行 `mvt-ios check-backup` 或将解密备份中的文件交给本工具扩展分析。 |

典型命令如下：

```bash
# 解密加密备份
MVT_IOS_BACKUP_PASSWORD='你的备份密码' \
  mvt-ios decrypt-backup \
  -d ./decrypted_backup \
  /path/to/iPhoneBackup/UDID

# 使用 MVT 原生备份检测与 IOC 文件
mvt-ios check-backup \
  --iocs contrib/spyware_objects/spyware_objects_iocs_template.stix2 \
  --output ./out_backup \
  ./decrypted_backup
```

### 方式二：文件系统转储检测

文件系统转储可提供比备份更多的系统文件，但 MVT 官方文档提醒，是否越狱、如何越狱以及是否会污染记录都需要谨慎评估。[3] 只有在具备授权、设备可控、风险可接受且备份分析不足时，才建议使用该方式。

```bash
mvt-ios --disable-update-check --disable-indicator-update-check \
  check-fs \
  --module SpywareObjects \
  --iocs contrib/spyware_objects/spyware_objects_iocs_template.stix2 \
  --output ./out_fs \
  /path/to/ios_filesystem_dump
```

### 方式三：sysdiagnose 或日志目录检测

如果无法取得完整文件系统，但可以取得 sysdiagnose、崩溃日志或运行态日志，可将其解包到目录后用 `check-fs` 指向该目录。此方式主要用于 `memory_runtime_artifact`、`log_cache`、`network` 和 `process` 线索分析。

```bash
unzip sysdiagnose_*.tar.gz -d ./sysdiagnose_unpacked  # 视实际格式调整
mvt-ios check-fs \
  --module SpywareObjects \
  --iocs contrib/spyware_objects/spyware_objects_iocs_template.stix2 \
  --output ./out_sysdiagnose \
  ./sysdiagnose_unpacked
```

## IOC 使用方法

本项目内置 `contrib/spyware_objects/spyware_objects_iocs_template.stix2` 作为模板。该文件仅用于演示 STIX2 格式，不应直接作为生产 IOC 规则库。MVT 文档说明，`--iocs` 可以多次使用，也可以通过 `MVT_STIX2` 环境变量加载多个 STIX2 文件。[2]

```bash
mvt-ios check-fs \
  --module SpywareObjects \
  --iocs ./pegasus.stix2 \
  --iocs ./predator.stix2 \
  --iocs ./stalkerware.stix2 \
  --output ./out \
  /path/to/ios_artifacts
```

也可以先下载 MVT 官方公开 IOC：

```bash
mvt-ios download-iocs
```

## 生成报告

检测完成后，`SpywareObjects` 会生成结构化结果与告警结果。可使用报告脚本生成 Markdown 报告：

```bash
python3.11 contrib/spyware_objects/spyware_objects_report.py ./out \
  -o ./out/spyware_objects_report.md
```

| 输出文件 | 含义 |
|---|---|
| `spyware_objects.json` | 所有结构化命中与启发式线索 |
| `spyware_objects_detected.json` | MVT 告警级命中 |
| `alerts.json` | MVT 汇总告警 |
| `timeline.csv` | MVT 时间线输出 |
| `spyware_objects_report.md` | 聚合 Markdown 报告 |

## 结果判读

IOC 命中比启发式命中具有更高证据价值。如果 `matched_indicator` 字段不为空，说明结果与加载的 STIX2 IOC 命中，应优先复核 IOC 来源、时间线、路径和上下文。若仅出现关键词、无 Bundle ID 进程、敏感权限或 MDM/VPN 配置文件等启发式命中，则应作为调查线索，而不是感染结论。

Pegasus、Predator 等高级间谍软件可能会快速更换基础设施并清除痕迹；Stalkerware 也可能使用合法签名、家长控制、MDM 或 VPN 伪装。因此，建议将本工具结果与设备所有者访谈、系统版本、备份时间、网络日志、崩溃日志、应用安装记录和配置文件记录综合分析。

## 项目结构

| 路径 | 说明 |
|---|---|
| `src/mvt/ios/modules/fs/spyware_objects.py` | 核心多对象检测模块 |
| `src/mvt/ios/modules/fs/__init__.py` | 模块注册入口 |
| `contrib/spyware_objects/spyware_objects_iocs_template.stix2` | STIX2 IOC 模板 |
| `contrib/spyware_objects/spyware_objects_report.py` | Markdown 报告生成脚本 |
| `contrib/spyware_objects/create_test_fixture.py` | 合成测试样本生成脚本 |
| `docs/ios/spyware_objects.md` | 扩展模块详细文档 |

## 测试

项目已使用合成 iOS 文件系统样本完成端到端验证。可复现如下：

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

验证摘要如下。

| 验证项 | 结果 |
|---|---|
| 模块注册 | `SpywareObjects` 已出现在 `check-fs` 模块列表 |
| `spyware_objects.json` | 31 条合成样本结果 |
| `spyware_objects_detected.json` | 27 条合成样本告警 |
| `alerts.json` | 27 条合成样本告警 |
| 编译检查 | 通过 |
| STIX2 模板 JSON 校验 | 通过 |
| 补丁格式检查 | 通过 |

## 合规与安全声明

本工具仅应用于 **获得明确授权** 的设备安全检测、应急响应、数字取证或研究场景。不得将其用于未授权访问、隐私侵犯、监控他人或规避法律责任。对于高危命中，建议由具备移动取证经验的专业人员进行复核。

## References

[1]: https://docs.mvt.re/en/latest/ios/backup/check/ "MVT Documentation: Check a Backup with mvt-ios"
[2]: https://docs.mvt.re/en/latest/iocs/ "MVT Documentation: Indicators of Compromise (IOCs)"
[3]: https://docs.mvt.re/en/latest/ios/methodology/ "MVT Documentation: iOS Forensic Methodology"
[4]: https://support.apple.com/guide/iphone/iphone-models-compatible-with-ios-26-iphe3fa5df43/ios "Apple Support: iPhone models compatible with iOS 26"
