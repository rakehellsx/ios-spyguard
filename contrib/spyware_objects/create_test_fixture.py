#!/usr/bin/env python3
"""Create a synthetic iOS filesystem fixture for SpywareObjects testing."""

from __future__ import annotations

import plistlib
import sqlite3
from pathlib import Path

BASE = Path("/home/ubuntu/mvt/tmp/spyware_objects_fixture")


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def write_plist(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as handle:
        plistlib.dump(data, handle)


def create_tcc(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    cur = conn.cursor()
    cur.execute("CREATE TABLE access (service TEXT, client TEXT, allowed INTEGER, auth_value INTEGER)")
    cur.execute("INSERT INTO access VALUES (?, ?, ?, ?)", ("kTCCServiceMicrophone", "com.example.monitoring", 1, 2))
    cur.execute("INSERT INTO access VALUES (?, ?, ?, ?)", ("kTCCServiceCamera", "com.example.monitoring", 1, 2))
    conn.commit()
    conn.close()


def create_netusage(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    cur = conn.cursor()
    cur.execute("CREATE TABLE ZPROCESS (ZPROCNAME TEXT, ZBUNDLENAME TEXT, ZFIRSTTIMESTAMP REAL, ZTIMESTAMP REAL)")
    cur.execute("INSERT INTO ZPROCESS VALUES (?, ?, ?, ?)", ("A1B2C3D4E5F6G7H8", "", 0, 0))
    cur.execute("INSERT INTO ZPROCESS VALUES (?, ?, ?, ?)", ("predator-agent", "com.example.predator", 0, 0))
    conn.commit()
    conn.close()


def main() -> None:
    if BASE.exists():
        import shutil
        shutil.rmtree(BASE)
    write_plist(
        BASE / "System/Library/CoreServices/SystemVersion.plist",
        {"ProductName": "iPhone OS", "ProductVersion": "15.7.1", "ProductBuildVersion": "19H117"},
    )
    write_text(
        BASE / "private/var/mobile/Library/Logs/CrashReporter/sysdiagnose/runtime.log",
        "Process: predator-agent pid 123 contacted https://replace-with-predator-url.example/path and loaded WebKit exploit payload\n",
    )
    write_text(
        BASE / "private/var/mobile/Library/Safari/History/pegasus_network.log",
        "visited http://replace-with-pegasus-domain.example/index.html during test\n",
    )
    write_plist(
        BASE / "private/var/containers/Bundle/Application/UUID/SpyMonitor.app/Info.plist",
        {"CFBundleIdentifier": "replace.with.stalkerware.bundleid", "CFBundleDisplayName": "Spy Monitor"},
    )
    write_plist(
        BASE / "private/var/mobile/Library/ConfigurationProfiles/ProfileTruth/ConfigProfile.plist",
        {
            "PayloadUUID": "replace-with-profile-uuid",
            "PayloadContent": [
                {"PayloadType": "com.apple.mdm", "PayloadUUID": "payload-mdm"},
                {"PayloadType": "com.apple.vpn.managed", "PayloadUUID": "payload-vpn"},
            ],
        },
    )
    create_tcc(BASE / "private/var/mobile/Library/TCC/TCC.db")
    create_netusage(BASE / "private/var/networkd/netusage.sqlite")
    print(BASE)


if __name__ == "__main__":
    main()
