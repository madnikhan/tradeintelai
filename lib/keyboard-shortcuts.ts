'use client';

export type ShortcutHandler = () => void;

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  handler: ShortcutHandler;
  description: string;
}

class KeyboardShortcutsManager {
  private shortcuts: Map<string, KeyboardShortcut> = new Map();
  private isEnabled: boolean = true;

  register(shortcut: KeyboardShortcut) {
    const key = this.getShortcutKey(shortcut);
    this.shortcuts.set(key, shortcut);
  }

  unregister(key: string) {
    this.shortcuts.delete(key);
  }

  enable() {
    this.isEnabled = true;
  }

  disable() {
    this.isEnabled = false;
  }

  private getShortcutKey(shortcut: KeyboardShortcut): string {
    const parts: string[] = [];
    if (shortcut.ctrl || shortcut.meta) parts.push('ctrl');
    if (shortcut.shift) parts.push('shift');
    if (shortcut.alt) parts.push('alt');
    parts.push(shortcut.key.toLowerCase());
    return parts.join('+');
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    if (!this.isEnabled) return;

    // Check if event.key exists (some events may not have it)
    if (!event.key) {
      return;
    }

    const key = event.key.toLowerCase();
    const ctrl = event.ctrlKey || event.metaKey;
    const shift = event.shiftKey;
    const alt = event.altKey;

    // Build shortcut key
    const parts: string[] = [];
    if (ctrl) parts.push('ctrl');
    if (shift) parts.push('shift');
    if (alt) parts.push('alt');
    parts.push(key);

    const shortcutKey = parts.join('+');
    const shortcut = this.shortcuts.get(shortcutKey);

    if (shortcut) {
      event.preventDefault();
      event.stopPropagation();
      shortcut.handler();
    }
  };

  init() {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDown);
    }
  }

  destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.handleKeyDown);
    }
  }

  getAllShortcuts(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values());
  }
}

export const keyboardShortcuts = new KeyboardShortcutsManager();

// Initialize on module load
if (typeof window !== 'undefined') {
  keyboardShortcuts.init();
}

