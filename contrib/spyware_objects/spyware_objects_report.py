#!/usr/bin/env python3
"""Generate a Markdown summary report for MVT SpywareObjects results."""

from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3, "informational": 4, "": 5}


def load_json(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if isinstance(data, list):
        return [entry for entry in data if isinstance(entry, dict)]
    if isinstance(data, dict):
        for key in ("results", "alerts", "data"):
            value = data.get(key)
            if isinstance(value, list):
                return [entry for entry in value if isinstance(entry, dict)]
        return [data]
    return []


def normalize_result(record: dict[str, Any]) -> dict[str, Any]:
    if "object_type" in record:
        return record
    for container_key in ("event", "data"):
        data = record.get(container_key)
        if isinstance(data, dict):
            merged = dict(data)
            for key in ("level", "message", "timestamp", "event_time", "matched_indicator"):
                if key in record and key not in merged:
                    merged[key] = record[key]
            return merged
    return record


def esc(value: Any) -> str:
    text = "" if value is None else str(value)
    return text.replace("|", "\\|").replace("\n", " ")[:300]


def render_report(results: list[dict[str, Any]], alerts: list[dict[str, Any]], title: str) -> str:
    normalized_results = [normalize_result(record) for record in results]
    normalized_alerts = [normalize_result(record) for record in alerts]
    all_records = normalized_results + normalized_alerts

    object_counter = Counter(record.get("object_type", "unknown") for record in all_records)
    severity_counter = Counter(str(record.get("severity") or record.get("level") or "informational").lower() for record in all_records)
    indicator_counter = Counter(record.get("indicator_type", "unknown") for record in all_records)

    by_object: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in all_records:
        by_object[str(record.get("object_type", "unknown"))].append(record)

    lines: list[str] = []
    lines.append(f"# {title}\n")
    lines.append("## 摘要\n")
    lines.append(
        "本报告由 MVT `SpywareObjects` 模块输出自动汇总，覆盖固件、文件系统、进程、网络、运行态痕迹、应用、权限、配置文件、日志/缓存等对象。"
    )
    lines.append("")
    lines.append("| 指标 | 数量 |")
    lines.append("|---|---:|")
    lines.append(f"| 结构化结果 | {len(normalized_results)} |")
    lines.append(f"| 告警记录 | {len(normalized_alerts)} |")
    lines.append(f"| 涉及对象类别 | {len(object_counter)} |")
    lines.append("")

    lines.append("## 按严重性统计\n")
    lines.append("| 严重性 | 数量 |")
    lines.append("|---|---:|")
    for severity, count in sorted(severity_counter.items(), key=lambda item: SEVERITY_ORDER.get(item[0], 99)):
        lines.append(f"| {esc(severity)} | {count} |")
    lines.append("")

    lines.append("## 按对象类别统计\n")
    lines.append("| 对象类别 | 数量 |")
    lines.append("|---|---:|")
    for object_type, count in object_counter.most_common():
        lines.append(f"| {esc(object_type)} | {count} |")
    lines.append("")

    lines.append("## 按指标类型统计\n")
    lines.append("| 指标类型 | 数量 |")
    lines.append("|---|---:|")
    for indicator_type, count in indicator_counter.most_common():
        lines.append(f"| {esc(indicator_type)} | {count} |")
    lines.append("")

    lines.append("## 重点发现\n")
    lines.append("| 对象 | 严重性 | 指标类型 | 值 | 路径 | 说明 |")
    lines.append("|---|---|---|---|---|---|")
    sorted_records = sorted(
        all_records,
        key=lambda record: SEVERITY_ORDER.get(str(record.get("severity") or record.get("level") or "").lower(), 99),
    )
    for record in sorted_records[:100]:
        lines.append(
            "| {object_type} | {severity} | {indicator_type} | {value} | {path} | {description} |".format(
                object_type=esc(record.get("object_type", "unknown")),
                severity=esc(record.get("severity") or record.get("level") or "informational"),
                indicator_type=esc(record.get("indicator_type", "unknown")),
                value=esc(record.get("value", "")),
                path=esc(record.get("path", "")),
                description=esc(record.get("description") or record.get("message") or ""),
            )
        )
    lines.append("")

    lines.append("## 分对象明细\n")
    for object_type in sorted(by_object):
        lines.append(f"### {object_type}\n")
        lines.append("| 严重性 | 指标类型 | 值 | 路径 | 片段 |")
        lines.append("|---|---|---|---|---|")
        records = sorted(
            by_object[object_type],
            key=lambda record: SEVERITY_ORDER.get(str(record.get("severity") or record.get("level") or "").lower(), 99),
        )
        for record in records[:50]:
            lines.append(
                "| {severity} | {indicator_type} | {value} | {path} | {matched_text} |".format(
                    severity=esc(record.get("severity") or record.get("level") or "informational"),
                    indicator_type=esc(record.get("indicator_type", "unknown")),
                    value=esc(record.get("value", "")),
                    path=esc(record.get("path", "")),
                    matched_text=esc(record.get("matched_text", "")),
                )
            )
        lines.append("")

    lines.append("## 判读建议\n")
    lines.append(
        "高危或严重 IOC 命中应被优先复核，特别是域名/URL、进程名、配置文件 UUID、应用 Bundle ID 与文件路径的权威 IOC 命中。启发式命中并不等同于确认感染，应结合设备时间线、用户授权、网络日志、崩溃日志和备份数据库进一步验证。"
    )
    lines.append("")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a Markdown report from SpywareObjects JSON outputs.")
    parser.add_argument("results_dir", type=Path, help="MVT output directory containing spyware_objects.json")
    parser.add_argument("-o", "--output", type=Path, default=None, help="Output Markdown report path")
    parser.add_argument("--title", default="iOS 间谍软件对象检测报告", help="Report title")
    args = parser.parse_args()

    results = load_json(args.results_dir / "spyware_objects.json")
    alerts = []
    for candidate in ("spyware_objects_detected.json", "alerts.json"):
        alerts.extend(load_json(args.results_dir / candidate))

    report = render_report(results, alerts, args.title)
    output = args.output or (args.results_dir / "spyware_objects_report.md")
    output.write_text(report, encoding="utf-8")
    print(output)


if __name__ == "__main__":
    main()
