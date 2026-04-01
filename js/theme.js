/**
 * theme.js — Gnoke Stitches
 * Dark / light theme toggle with localStorage persistence.
 * Copyright © 2026 Edmund Sparrow — GNU GPL v3
 */

const Theme = (() => {

  const STORAGE_KEY = 'gnoke_stitches_theme';

  function current() {
    return document.documentElement.getAttribute('data-theme') === 'dark'
      ? 'dark' : 'light';
  }

  function _apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
    _syncIcon(theme);
  }

  function _syncIcon(theme) {
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  function toggle() { _apply(current() === 'dark' ? 'light' : 'dark'); }

  function init() {
    _syncIcon(current());
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.addEventListener('click', toggle);
  }

  return { init, toggle, current };

})();
