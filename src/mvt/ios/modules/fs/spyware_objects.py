# Mobile Verification Toolkit (MVT)
# Copyright (c) 2021-2026 The MVT Authors.
# Use of this software is governed by the MVT License 1.1 that can be found at
#   https://license.mvt.re/1.1/

"""Aggregate iOS spyware object detector.

This module complements MVT's IOC-oriented iOS extraction modules with a
multi-object detector that records suspicious traits across firmware, runtime
artifacts, processes, network traces, filesystem entries, applications,
configuration profiles, permissions, and logs/caches.
"""

import glob
import logging
import os
import plistlib
import re
import sqlite3
from pathlib import Path
from typing import Any, Iterable, Optional

from packaging.version import InvalidVersion, Version

from mvt.common.module_types import (
    ModuleAtomicResult,
    ModuleResults,
    ModuleSerializedResult,
)
from mvt.common.utils import convert_unix_to_iso

from ..base import IOSExtraction

log = logging.getLogger(__name__)


class SpywareObjects(IOSExtraction):
    """Detect spyware traits across multiple iOS forensic object classes.

    The detector is designed for full filesystem dumps and sysdiagnose-like
    folders. It does not require a live device and therefore treats memory as
    runtime artifacts exported by diagnostics, crashes, jetsam snapshots, panic
    logs, trace text, and other forensic text sources.
    """

    MAX_TEXT_SCAN_BYTES = 2 * 1024 * 1024
    MAX_TEXT_MATCHES_PER_FILE = 12

    FIRMWARE_VERSION_PATHS = [
        "System/Library/CoreServices/SystemVersion.plist",
        "private/var/db/analyticsd/Analytics-Journal-*.ips",
    ]

    SQLITE_CANDIDATES = {
        "tcc": [
            "private/var/mobile/Library/TCC/TCC.db",
            "private/var/root/Library/TCC/TCC.db",
            "private/var/db/TCC/TCC.db",
        ],
        "netusage": [
            "private/var/networkd/netusage.sqlite",
            "private/var/networkd/db/netusage.sqlite",
            "private/var/wireless/Library/Databases/DataUsage.sqlite",
        ],
    }

    TEXT_EXTENSIONS = {
        ".analytics",
        ".crash",
        ".ips",
        ".ipsync",
        ".json",
        ".log",
        ".plist",
        ".txt",
        ".trace",
    }

    RUNTIME_PATH_HINTS = (
        "crashreporter",
        "jetsam",
        "panic",
        "runningboard",
        "sysdiagnose",
        "system_logs",
        "tracev3",
        "analytics",
    )

    NETWORK_PATH_HINTS = (
        "safari",
        "chrome",
        "firefox",
        "webkit",
        "networkd",
        "netusage",
        "datausage",
        "favicon",
        "history",
    )

    APPLICATION_PATH_HINTS = (
        "/containers/bundle/application/",
        "/mobile/containers/bundle/application/",
        "/applications/",
    )

    PROFILE_PATH_HINTS = (
        "configurationprofiles",
        "mobileconfig",
        "mcprofileevents",
        "managed preferences",
        "profiles",
    )

    PERMISSION_SERVICES = {
        "kTCCServiceMicrophone": "microphone",
        "kTCCServiceCamera": "camera",
        "kTCCServiceLocation": "location",
        "kTCCServiceAddressBook": "contacts",
        "kTCCServicePhotos": "photos",
        "kTCCServiceCalendar": "calendar",
        "kTCCServiceBluetoothAlways": "bluetooth",
        "kTCCServiceListenEvent": "input_monitoring",
        "kTCCServiceAccessibility": "accessibility",
        "kTCCServiceSystemPolicyAllFiles": "full_disk_access",
    }

    SPYWARE_KEYWORDS = {
        "pegasus": "Pegasus family keyword",
        "predator": "Predator family keyword",
        "cytrops": "Cytrox/Predator vendor keyword",
        "cytrox": "Cytrox/Predator vendor keyword",
        "stalkerware": "Stalkerware keyword",
        "spyware": "Spyware keyword",
        "surveillance": "Surveillance keyword",
        "monitoring": "Monitoring keyword",
        "keylogger": "Keylogger keyword",
        "stealth": "Stealth keyword",
        "mdm": "Mobile device management keyword",
        "vpn": "VPN/proxy keyword",
        "payload": "Exploit payload keyword",
        "exploit": "Exploit keyword",
        "webkit": "WebKit exploitation keyword",
        "imtranscoderagent": "Process observed in historical iOS exploit chains",
        "bh": "Short suspicious process token observed in historical iOS traces",
        "pcsd": "Suspicious process token observed in historical iOS traces",
    }

    URL_RE = re.compile(
        r"(?i)\b(?:https?://|wss?://)[^\s\"'<>\\)\]]+|"
        r"\b(?:[a-z0-9-]+\.)+(?:com|net|org|info|biz|io|co|me|app|dev|cloud|"
        r"site|xyz|top|ru|cn|ir|ua|ly|to|cc)(?:/[^\s\"'<>\\)\]]*)?"
    )

    PROCESS_RE = re.compile(r"(?i)\b(?:process|proc|pid|executable|bundle)[:= ]+([A-Za-z0-9_.-]{2,80})")
    RANDOM_PROCESS_RE = re.compile(r"^[A-Za-z0-9]{16}$")

    def __init__(
        self,
        file_path: Optional[str] = None,
        target_path: Optional[str] = None,
        results_path: Optional[str] = None,
        module_options: Optional[dict] = None,
        log: logging.Logger = log,
        results: ModuleResults = [],
    ) -> None:
        super().__init__(
            file_path=file_path,
            target_path=target_path,
            results_path=results_path,
            module_options=module_options,
            log=log,
            results=results,
        )
        self._seen: set[tuple] = set()

    def serialize(self, record: ModuleAtomicResult) -> ModuleSerializedResult:
        return {
            "timestamp": record.get("timestamp"),
            "module": self.__class__.__name__,
            "event": f"spyware_{record.get('object_type', 'object')}",
            "data": f"{record.get('indicator_type')}: {record.get('value')}",
        }

    def _relpath(self, path: str) -> str:
        if not self.target_path:
            return path
        try:
            return os.path.relpath(path, self.target_path)
        except ValueError:
            return path

    def _safe_stat_time(self, path: str) -> str:
        try:
            return convert_unix_to_iso(os.stat(path).st_mtime)
        except Exception:
            return ""

    def _add_result(
        self,
        object_type: str,
        indicator_type: str,
        value: str,
        path: str = "",
        matched_text: str = "",
        severity: str = "medium",
        confidence: str = "medium",
        description: str = "",
        source: str = "heuristic",
        timestamp: str = "",
        extra: Optional[dict[str, Any]] = None,
    ) -> None:
        if not value and not matched_text and not path:
            return

        event = {
            "object_type": object_type,
            "indicator_type": indicator_type,
            "value": value,
            "path": path,
            "matched_text": matched_text[:500] if matched_text else "",
            "severity": severity,
            "confidence": confidence,
            "description": description,
            "source": source,
            "timestamp": timestamp,
        }
        if extra:
            event.update(extra)

        key = (
            event.get("object_type"),
            event.get("indicator_type"),
            event.get("value"),
            event.get("path"),
            event.get("matched_text"),
        )
        if key in self._seen:
            return
        self._seen.add(key)
        self.results.append(event)

    def _iter_files(self) -> Iterable[tuple[str, str]]:
        if not self.target_path:
            return
        for root, _, files in os.walk(self.target_path):
            for file_name in files:
                full_path = os.path.join(root, file_name)
                yield full_path, self._relpath(full_path)

    def _iter_matching_paths(self, patterns: Iterable[str]) -> Iterable[str]:
        if not self.target_path:
            return
        for pattern in patterns:
            for found_path in glob.glob(os.path.join(self.target_path, pattern), recursive=True):
                if os.path.exists(found_path):
                    yield found_path

    def _read_text_sample(self, file_path: str) -> str:
        try:
            if os.path.getsize(file_path) > self.MAX_TEXT_SCAN_BYTES:
                return ""
            with open(file_path, "rb") as handle:
                data = handle.read(self.MAX_TEXT_SCAN_BYTES)
            return data.decode("utf-8", errors="ignore")
        except Exception:
            return ""

    def _scan_firmware(self) -> None:
        for path in self._iter_matching_paths(["System/Library/CoreServices/SystemVersion.plist"]):
            rel = self._relpath(path)
            try:
                with open(path, "rb") as handle:
                    plist = plistlib.load(handle)
            except Exception as exc:
                self._add_result(
                    "firmware",
                    "system_version_parse_error",
                    rel,
                    path=rel,
                    severity="medium",
                    confidence="medium",
                    description=f"Unable to parse iOS SystemVersion.plist: {exc}",
                    timestamp=self._safe_stat_time(path),
                )
                continue

            version = str(plist.get("ProductVersion", ""))
            build = str(plist.get("ProductBuildVersion", ""))
            product_name = str(plist.get("ProductName", "iOS"))
            value = f"{product_name} {version} ({build})".strip()
            self._add_result(
                "firmware",
                "system_version",
                value,
                path=rel,
                severity="informational",
                confidence="high",
                description="Detected installed iOS firmware version.",
                timestamp=self._safe_stat_time(path),
                extra={"ios_version": version, "build": build},
            )
            try:
                if version and Version(version) < Version("16.0"):
                    self._add_result(
                        "firmware",
                        "outdated_ios_version",
                        value,
                        path=rel,
                        severity="high",
                        confidence="medium",
                        description=(
                            "The device appears to run an old iOS major version. "
                            "Old firmware increases exposure to known exploit chains."
                        ),
                        timestamp=self._safe_stat_time(path),
                        extra={"ios_version": version, "build": build},
                    )
            except InvalidVersion:
                self._add_result(
                    "firmware",
                    "unusual_ios_version_string",
                    value,
                    path=rel,
                    severity="medium",
                    confidence="low",
                    description="The iOS version string could not be parsed normally.",
                    timestamp=self._safe_stat_time(path),
                    extra={"ios_version": version, "build": build},
                )

    def _scan_filesystem_paths(self) -> None:
        for full_path, rel in self._iter_files():
            lower_rel = rel.lower()
            timestamp = self._safe_stat_time(full_path)

            for keyword, description in self.SPYWARE_KEYWORDS.items():
                if keyword in lower_rel:
                    object_type = "filesystem"
                    if any(hint in lower_rel for hint in self.RUNTIME_PATH_HINTS):
                        object_type = "memory_runtime_artifact"
                    elif any(hint in lower_rel for hint in self.NETWORK_PATH_HINTS):
                        object_type = "network"
                    elif any(hint in lower_rel for hint in self.PROFILE_PATH_HINTS):
                        object_type = "configuration_profile"
                    elif any(hint in lower_rel for hint in self.APPLICATION_PATH_HINTS):
                        object_type = "application"

                    self._add_result(
                        object_type,
                        "keyword_in_path",
                        keyword,
                        path=rel,
                        matched_text=rel,
                        severity="high" if keyword in {"pegasus", "predator", "cytrox", "cytrops"} else "medium",
                        confidence="medium",
                        description=description,
                        timestamp=timestamp,
                    )

            basename = os.path.basename(rel)
            stem, ext = os.path.splitext(basename)
            if self.RANDOM_PROCESS_RE.match(stem) and any(
                hint in lower_rel for hint in ("crash", "analytics", "logs", "tmp", "diagnostic")
            ):
                self._add_result(
                    "process",
                    "randomized_process_name",
                    stem,
                    path=rel,
                    severity="medium",
                    confidence="low",
                    description="A 16-character alphanumeric process-like name appears in diagnostics or logs.",
                    timestamp=timestamp,
                )

            if ext.lower() in self.TEXT_EXTENSIONS and (
                any(hint in lower_rel for hint in self.RUNTIME_PATH_HINTS + self.NETWORK_PATH_HINTS)
                or os.path.getsize(full_path) <= self.MAX_TEXT_SCAN_BYTES
            ):
                self._scan_text_file(full_path, rel, timestamp)

    def _scan_text_file(self, full_path: str, rel: str, timestamp: str) -> None:
        text = self._read_text_sample(full_path)
        if not text:
            return
        lower_text = text.lower()
        lower_rel = rel.lower()

        object_type = "log_cache"
        if any(hint in lower_rel for hint in self.RUNTIME_PATH_HINTS):
            object_type = "memory_runtime_artifact"
        elif any(hint in lower_rel for hint in self.NETWORK_PATH_HINTS):
            object_type = "network"

        matches = 0
        for keyword, description in self.SPYWARE_KEYWORDS.items():
            pos = lower_text.find(keyword)
            if pos == -1:
                continue
            snippet = text[max(0, pos - 120) : pos + 180]
            self._add_result(
                object_type,
                "keyword_in_content",
                keyword,
                path=rel,
                matched_text=snippet,
                severity="high" if keyword in {"pegasus", "predator", "cytrox", "cytrops"} else "medium",
                confidence="medium",
                description=description,
                timestamp=timestamp,
            )
            matches += 1
            if matches >= self.MAX_TEXT_MATCHES_PER_FILE:
                break

        for match in list(self.URL_RE.finditer(text))[: self.MAX_TEXT_MATCHES_PER_FILE]:
            url = match.group(0).rstrip(".,;:")
            self._add_result(
                "network",
                "url_or_domain_observed",
                url,
                path=rel,
                matched_text=text[max(0, match.start() - 80) : match.end() + 80],
                severity="informational",
                confidence="medium",
                description="URL or domain-like value observed in an iOS forensic text artifact.",
                source="extracted_artifact",
                timestamp=timestamp,
            )

        for match in list(self.PROCESS_RE.finditer(text))[: self.MAX_TEXT_MATCHES_PER_FILE]:
            proc = match.group(1).strip()
            if len(proc) < 2:
                continue
            self._add_result(
                "process",
                "process_reference",
                proc,
                path=rel,
                matched_text=match.group(0),
                severity="informational",
                confidence="low",
                description="Process-like reference observed in a runtime or diagnostic artifact.",
                source="extracted_artifact",
                timestamp=timestamp,
            )

    def _scan_applications(self) -> None:
        for app_path in self._iter_matching_paths([
            "private/var/containers/Bundle/Application/*/*.app/Info.plist",
            "private/var/mobile/Containers/Bundle/Application/*/*.app/Info.plist",
            "Applications/*.app/Info.plist",
        ]):
            rel = self._relpath(app_path)
            try:
                with open(app_path, "rb") as handle:
                    plist = plistlib.load(handle)
            except Exception:
                continue

            bundle_id = str(plist.get("CFBundleIdentifier", ""))
            name = str(
                plist.get("CFBundleDisplayName")
                or plist.get("CFBundleName")
                or plist.get("CFBundleExecutable")
                or ""
            )
            combined = f"{bundle_id} {name}".lower()
            for keyword, description in self.SPYWARE_KEYWORDS.items():
                if keyword in combined:
                    self._add_result(
                        "application",
                        "suspicious_application_metadata",
                        bundle_id or name,
                        path=rel,
                        matched_text=f"{bundle_id} {name}",
                        severity="high" if keyword in {"pegasus", "predator", "cytrox", "cytrops"} else "medium",
                        confidence="medium",
                        description=description,
                        timestamp=self._safe_stat_time(app_path),
                        extra={"bundle_id": bundle_id, "application_name": name},
                    )

    def _scan_configuration_profiles(self) -> None:
        profile_patterns = [
            "private/var/Managed Preferences/**/*.plist",
            "private/var/mobile/Library/ConfigurationProfiles/**/*",
            "private/var/db/ConfigurationProfiles/**/*",
            "**/*.mobileconfig",
        ]
        for profile_path in self._iter_matching_paths(profile_patterns):
            if os.path.isdir(profile_path):
                continue
            rel = self._relpath(profile_path)
            lower_rel = rel.lower()
            if not any(hint in lower_rel for hint in self.PROFILE_PATH_HINTS) and not rel.endswith(".mobileconfig"):
                continue

            text = self._read_text_sample(profile_path)
            lower_text = text.lower()
            profile_uuid = ""
            payload_types: list[str] = []
            try:
                with open(profile_path, "rb") as handle:
                    plist = plistlib.load(handle)
                profile_uuid = str(plist.get("PayloadUUID", ""))
                payloads = plist.get("PayloadContent", [])
                if isinstance(payloads, list):
                    for payload in payloads:
                        if isinstance(payload, dict) and payload.get("PayloadType"):
                            payload_types.append(str(payload.get("PayloadType")))
            except Exception:
                pass

            combined = f"{rel} {text[:4096]} {' '.join(payload_types)}".lower()
            if any(token in combined for token in ("com.apple.mdm", "mdm", "vpn", "proxy", "root", "certificate")):
                self._add_result(
                    "configuration_profile",
                    "sensitive_profile_payload",
                    profile_uuid or rel,
                    path=rel,
                    matched_text=", ".join(payload_types) or text[:250],
                    severity="medium",
                    confidence="medium",
                    description="Configuration profile contains MDM, VPN, proxy, root certificate, or managed preference traits.",
                    timestamp=self._safe_stat_time(profile_path),
                    extra={"profile_uuid": profile_uuid, "payload_types": payload_types},
                )

            for keyword, description in self.SPYWARE_KEYWORDS.items():
                if keyword in lower_text or keyword in lower_rel:
                    self._add_result(
                        "configuration_profile",
                        "keyword_in_profile",
                        keyword,
                        path=rel,
                        matched_text=text[:250],
                        severity="high" if keyword in {"pegasus", "predator", "cytrox", "cytrops"} else "medium",
                        confidence="medium",
                        description=description,
                        timestamp=self._safe_stat_time(profile_path),
                        extra={"profile_uuid": profile_uuid, "payload_types": payload_types},
                    )

    def _scan_tcc(self) -> None:
        for db_path in self._iter_matching_paths(self.SQLITE_CANDIDATES["tcc"]):
            rel = self._relpath(db_path)
            try:
                conn = self._open_sqlite_db(db_path)
                conn.row_factory = sqlite3.Row
                cur = conn.cursor()
                cur.execute("SELECT * FROM access")
            except Exception:
                continue

            try:
                for row in cur.fetchall():
                    row_dict = dict(row)
                    service = str(row_dict.get("service", ""))
                    client = str(row_dict.get("client", ""))
                    allowed = row_dict.get("allowed", row_dict.get("auth_value"))
                    if service not in self.PERMISSION_SERVICES:
                        continue
                    if str(allowed) not in {"1", "2", "3", "True", "true"}:
                        continue
                    readable_service = self.PERMISSION_SERVICES[service]
                    severity = "high" if readable_service in {"microphone", "camera", "location", "accessibility", "full_disk_access"} else "medium"
                    self._add_result(
                        "permission",
                        "sensitive_tcc_permission",
                        client,
                        path=rel,
                        matched_text=f"{client} -> {service}",
                        severity=severity,
                        confidence="medium",
                        description=f"Client has sensitive iOS privacy permission: {readable_service}.",
                        source="tcc_database",
                        timestamp="",
                        extra={"service": service, "permission": readable_service, "client": client},
                    )
            finally:
                try:
                    cur.close()
                    conn.close()
                except Exception:
                    pass

    def _scan_network_usage_databases(self) -> None:
        for db_path in self._iter_matching_paths(self.SQLITE_CANDIDATES["netusage"]):
            rel = self._relpath(db_path)
            try:
                conn = self._open_sqlite_db(db_path)
                conn.row_factory = sqlite3.Row
                cur = conn.cursor()
                cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
                tables = {row[0] for row in cur.fetchall()}
                if "ZPROCESS" not in tables:
                    continue
                cur.execute("PRAGMA table_info(ZPROCESS)")
                cols = {row[1] for row in cur.fetchall()}
                select_cols = [col for col in ("ZPROCNAME", "ZBUNDLENAME", "ZFIRSTTIMESTAMP", "ZTIMESTAMP") if col in cols]
                if not select_cols:
                    continue
                cur.execute(f"SELECT {', '.join(select_cols)} FROM ZPROCESS")
            except Exception:
                continue

            try:
                for row in cur.fetchall():
                    row_dict = dict(row)
                    proc = str(row_dict.get("ZPROCNAME", "") or "")
                    bundle = str(row_dict.get("ZBUNDLENAME", "") or "")
                    if not proc and not bundle:
                        continue
                    combined = f"{proc} {bundle}".lower()
                    if proc and not bundle:
                        self._add_result(
                            "process",
                            "process_without_bundle_id",
                            proc,
                            path=rel,
                            matched_text=combined,
                            severity="medium",
                            confidence="medium",
                            description="Network usage database contains a process entry without a bundle identifier.",
                            source="netusage_database",
                            timestamp="",
                            extra={"process_name": proc, "bundle_id": bundle},
                        )
                    if proc and self.RANDOM_PROCESS_RE.match(proc):
                        self._add_result(
                            "process",
                            "randomized_process_name",
                            proc,
                            path=rel,
                            matched_text=combined,
                            severity="medium",
                            confidence="low",
                            description="Network usage database contains a random-looking 16-character process name.",
                            source="netusage_database",
                            timestamp="",
                            extra={"process_name": proc, "bundle_id": bundle},
                        )
                    for keyword, description in self.SPYWARE_KEYWORDS.items():
                        if keyword in combined:
                            self._add_result(
                                "process",
                                "keyword_in_process_or_bundle",
                                keyword,
                                path=rel,
                                matched_text=combined,
                                severity="high" if keyword in {"pegasus", "predator", "cytrox", "cytrops"} else "medium",
                                confidence="medium",
                                description=description,
                                source="netusage_database",
                                timestamp="",
                                extra={"process_name": proc, "bundle_id": bundle},
                            )
            finally:
                try:
                    cur.close()
                    conn.close()
                except Exception:
                    pass

    def _apply_ioc_match(self, record: dict[str, Any]) -> None:
        if not self.indicators:
            return

        candidates = [
            str(record.get("value", "")),
            str(record.get("path", "")),
            str(record.get("matched_text", "")),
            str(record.get("bundle_id", "")),
            str(record.get("process_name", "")),
            str(record.get("profile_uuid", "")),
            str(record.get("client", "")),
        ]
        object_type = record.get("object_type", "")
        ioc_match = None

        if record.get("path"):
            ioc_match = self.indicators.check_file_path(str(record.get("path")))
            if not ioc_match:
                ioc_match = self.indicators.check_file_path_process(str(record.get("path")))

        if not ioc_match and object_type in {"process", "memory_runtime_artifact", "network", "log_cache"}:
            for candidate in candidates:
                ioc_match = self.indicators.check_process(candidate)
                if ioc_match:
                    break

        if not ioc_match and object_type in {"network", "memory_runtime_artifact", "log_cache"}:
            for candidate in candidates:
                ioc_match = self.indicators.check_url(candidate)
                if ioc_match:
                    break

        if not ioc_match and object_type in {"application", "permission"}:
            for candidate in candidates:
                ioc_match = self.indicators.check_app_id(candidate)
                if ioc_match:
                    break

        if not ioc_match and object_type == "configuration_profile":
            for candidate in candidates:
                ioc_match = self.indicators.check_profile(candidate)
                if ioc_match:
                    break

        if ioc_match:
            record["matched_indicator"] = ioc_match.ioc
            self.alertstore.critical(
                ioc_match.message,
                record.get("timestamp", ""),
                record,
                matched_indicator=ioc_match.ioc,
            )

    def check_indicators(self) -> None:
        emitted_heuristics = set()
        for record in self.results:
            self._apply_ioc_match(record)

            severity = str(record.get("severity", "")).lower()
            key = (
                record.get("object_type"),
                record.get("indicator_type"),
                record.get("value"),
                record.get("path"),
            )
            if key in emitted_heuristics:
                continue
            emitted_heuristics.add(key)

            if severity in {"critical", "high"}:
                self.alertstore.high(
                    record.get("description") or "High-risk spyware object trait detected.",
                    record.get("timestamp", ""),
                    record,
                )
            elif severity == "medium":
                self.alertstore.medium(
                    record.get("description") or "Suspicious spyware object trait detected.",
                    record.get("timestamp", ""),
                    record,
                )

    def run(self) -> None:
        if not self.target_path or not Path(self.target_path).exists():
            return

        self._scan_firmware()
        self._scan_network_usage_databases()
        self._scan_tcc()
        self._scan_applications()
        self._scan_configuration_profiles()
        self._scan_filesystem_paths()
