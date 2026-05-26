"""
Cross-platform MT5 MQL5/Files path detection (mirrors bridge-desktop paths.rs).
"""
import os
import time
import getpass
from pathlib import Path
from typing import List, Optional

ACTIVITY_WINDOW_SECS = 24 * 3600


def is_invalid_mt5_files_override(path: str) -> bool:
    lower = path.lower()
    return (
        "paste_" in lower
        or "files_here" in lower
        or "bridge_url=" in lower
        or "vercel.app" in lower
        or "trycloudflare.com" in lower
        or "ngrok" in lower
    )


def normalize_mt5_files_dir(path: str) -> Optional[str]:
    trimmed = path.strip().strip('"').strip("'")
    if not trimmed or is_invalid_mt5_files_override(trimmed):
        return None

    p = Path(os.path.abspath(os.path.expandvars(trimmed)))
    name = p.name.lower()
    if name in ("mt5-commands", "mt5-responses"):
        p = p.parent

    path_str = str(p).lower().replace("\\", "/")
    if path_str.endswith("mql5/files"):
        return str(p)

    if "metaquotes" in path_str and "terminal" in path_str:
        with_mql5 = p / "MQL5" / "Files"
        if with_mql5.is_dir():
            return str(with_mql5)

    if "metatrader" in path_str and "mql5" not in path_str:
        with_mql5 = p / "MQL5" / "Files"
        if with_mql5.is_dir():
            return str(with_mql5)

    if p.is_dir():
        return str(p)

    return None


def ensure_mt5_bridge_dirs(files_dir: str) -> None:
    base = Path(files_dir)
    (base / "mt5-commands").mkdir(parents=True, exist_ok=True)
    (base / "mt5-responses").mkdir(parents=True, exist_ok=True)


def _dir_has_recent_activity(dir_path: Path) -> bool:
    if not dir_path.is_dir():
        return False
    cutoff = time.time() - ACTIVITY_WINDOW_SECS
    try:
        for entry in dir_path.iterdir():
            if entry.is_file():
                if entry.stat().st_mtime > cutoff:
                    return True
    except OSError:
        pass
    return False


def _files_dir_activity_score(files_dir: Path) -> float:
    score = 0.0
    for sub in ("mt5-commands", "mt5-responses"):
        if _dir_has_recent_activity(files_dir / sub):
            score += 1000.0
    try:
        score += files_dir.stat().st_mtime
    except OSError:
        pass
    return score


def _push_if_exists(candidates: List[str], path: Path) -> None:
    if path.is_dir():
        s = str(path)
        if s not in candidates:
            candidates.append(s)


def _scan_program_files_for_mt5(candidates: List[str]) -> None:
    if os.name != "nt":
        return
    for env_key in ("ProgramFiles", "ProgramFiles(x86)"):
        root = os.environ.get(env_key)
        if not root:
            continue
        try:
            for entry in Path(root).iterdir():
                if not entry.is_dir():
                    continue
                name = entry.name.lower()
                if "metatrader" in name or "mt5" in name:
                    _push_if_exists(candidates, entry / "MQL5" / "Files")
        except OSError:
            pass


def _terminal_hashes_files_dirs(terminal_root: Path) -> List[str]:
    out: List[str] = []
    if not terminal_root.is_dir():
        return out
    try:
        for entry in terminal_root.iterdir():
            if entry.is_dir():
                files = entry / "MQL5" / "Files"
                _push_if_exists(out, files)
    except OSError:
        pass
    return out


def collect_mt5_files_candidates() -> List[str]:
    candidates: List[str] = []
    home = Path.home()

    if os.name == "nt":
        appdata = os.environ.get("APPDATA")
        if appdata:
            terminal_root = Path(appdata) / "MetaQuotes" / "Terminal"
            for files in _terminal_hashes_files_dirs(terminal_root):
                _push_if_exists(candidates, Path(files))

        pf = os.environ.get("ProgramFiles")
        if pf:
            _push_if_exists(
                candidates, Path(pf) / "MetaTrader 5" / "MQL5" / "Files"
            )
        pf86 = os.environ.get("ProgramFiles(x86)")
        if pf86:
            _push_if_exists(
                candidates, Path(pf86) / "MetaTrader 5" / "MQL5" / "Files"
            )

        local = os.environ.get("LOCALAPPDATA")
        if local:
            terminal_root = Path(local) / "MetaQuotes" / "Terminal"
            for files in _terminal_hashes_files_dirs(terminal_root):
                _push_if_exists(candidates, Path(files))

        _scan_program_files_for_mt5(candidates)
    else:
        # macOS MetaQuotes official Wine
        metaquotes = (
            home
            / "Library"
            / "Application Support"
            / "net.metaquotes.wine.metatrader5"
            / "drive_c"
        )
        _push_if_exists(
            candidates,
            metaquotes / "Program Files" / "MetaTrader 5" / "MQL5" / "Files",
        )
        _push_if_exists(
            candidates,
            metaquotes
            / "Program Files (x86)"
            / "MetaTrader 5"
            / "MQL5"
            / "Files",
        )

        username = getpass.getuser()
        for terminal_root in [
            home / ".wine" / "drive_c" / "users" / username / "AppData" / "Roaming" / "MetaQuotes" / "Terminal",
            home / ".wine" / "drive_c" / "Users" / username / "AppData" / "Roaming" / "MetaQuotes" / "Terminal",
            home / ".wine" / "drive_c" / "users" / username.lower() / "AppData" / "Roaming" / "MetaQuotes" / "Terminal",
            home / ".wine" / "drive_c" / "Users" / username.lower() / "AppData" / "Roaming" / "MetaQuotes" / "Terminal",
        ]:
            for files in _terminal_hashes_files_dirs(terminal_root):
                _push_if_exists(candidates, Path(files))

    return candidates


def select_best_mt5_files_dir(candidates: List[str]) -> Optional[str]:
    if not candidates:
        return None
    best_path = None
    best_score = -1.0
    for path_str in candidates:
        score = _files_dir_activity_score(Path(path_str))
        if score > best_score:
            best_score = score
            best_path = path_str
    return best_path


def detect_mt5_files_dir() -> Optional[str]:
    candidates = collect_mt5_files_candidates()
    selected = select_best_mt5_files_dir(candidates)
    if selected:
        ensure_mt5_bridge_dirs(selected)
    return selected


def resolve_mt5_files_base(user_override: Optional[str] = None) -> Optional[str]:
    if user_override and user_override.strip():
        normalized = normalize_mt5_files_dir(user_override)
        if normalized:
            ensure_mt5_bridge_dirs(normalized)
            return normalized
    return detect_mt5_files_dir()
