/**
 * state.js — Gnoke Stitches
 * Single source of truth for all runtime state.
 * Copyright © 2026 Edmund Sparrow — GNU GPL v3
 */

const State = (() => {

  const today = new Date().toISOString().split('T')[0];

  const DEFAULTS = {
    activePage   : 'jobs-page',
    today        : today,
    selectedDate : today,
    expandedCard : null,
  };

  let _state       = { ...DEFAULTS };
  const _listeners = {};

  function get(key)         { return _state[key]; }
  function set(key, value)  {
    _state[key] = value;
    (_listeners[key] || []).forEach(fn => fn(value));
  }
  function on(key, callback) {
    if (!_listeners[key]) _listeners[key] = [];
    _listeners[key].push(callback);
  }
  function reset() { _state = { ...DEFAULTS }; }

  return { get, set, on, reset, DEFAULTS };

})();
