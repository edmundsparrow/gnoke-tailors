/**
 * db-core.js — Gnoke Tailors
 * SQLite (sql.js / WASM) engine with IndexedDB persistence.
 * Requires: sql-wasm.js (CDN) loaded before this file.
 *
 * Public API:
 *   await DB.init()       → boot and run migrations
 *   DB.run(sql, params)   → write query
 *   DB.query(sql, params) → read → [{col: val}]
 *   DB.one(sql, params)   → first row or null
 *   await DB.persist()    → flush to IndexedDB
 *
 * Copyright © 2026 Edmund Sparrow — GNU GPL v3
 */

const DB = (() => {

  const IDB_NAME  = 'gnoke_stitches_db';
  const IDB_STORE = 'sqlite_binary';
  const IDB_KEY   = 'db';

  let _sql = null;
  let _db  = null;

  async function init() {
    _sql = await initSqlJs({
      locateFile: file =>
        `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${file}`
    });

    const saved = await _idbLoad();
    _db = saved ? new _sql.Database(saved) : new _sql.Database();

    _migrate();
    return true;
  }

  function _migrate() {
    _db.run(`
      CREATE TABLE IF NOT EXISTS orders (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT    NOT NULL,
        phone      TEXT    NOT NULL DEFAULT '',
        style      TEXT    NOT NULL DEFAULT '',
        notes      TEXT    NOT NULL DEFAULT '',
        price      REAL    NOT NULL DEFAULT 0,
        deposit    REAL    NOT NULL DEFAULT 0,
        due_date   TEXT    NOT NULL,
        swatch     TEXT    NOT NULL DEFAULT '',
        ready      INTEGER NOT NULL DEFAULT 0,
        created_at TEXT    NOT NULL DEFAULT (datetime('now'))
      );
    `);
    // Migration: add phone column if it doesn't exist (for existing databases)
    try { _db.run(`ALTER TABLE orders ADD COLUMN phone TEXT NOT NULL DEFAULT ''`); } catch(_) {}
    persist();
  }

  function run(sql, params = []) {
    _db.run(sql, params);
  }

  function query(sql, params = []) {
    const res = _db.exec(sql, params);
    return _rows(res);
  }

  function one(sql, params = []) {
    const rows = query(sql, params);
    return rows.length ? rows[0] : null;
  }

  function persist() {
    return new Promise((resolve, reject) => {
      const data = _db.export();
      const req  = indexedDB.open(IDB_NAME, 1);

      req.onupgradeneeded = e => {
        e.target.result.createObjectStore(IDB_STORE);
      };
      req.onsuccess = e => {
        const tx    = e.target.result.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        store.put(data, IDB_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror    = ()  => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  }

  function _idbLoad() {
    return new Promise(resolve => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = e => {
        e.target.result.createObjectStore(IDB_STORE);
      };
      req.onsuccess = e => {
        const tx    = e.target.result.transaction(IDB_STORE, 'readonly');
        const store = tx.objectStore(IDB_STORE);
        const get   = store.get(IDB_KEY);
        get.onsuccess = () => resolve(get.result || null);
        get.onerror   = () => resolve(null);
      };
      req.onerror = () => resolve(null);
    });
  }

  function _rows(result) {
    if (!result || !result.length) return [];
    const { columns, values } = result[0];
    return values.map(row => {
      const obj = {};
      columns.forEach((col, i) => { obj[col] = row[i]; });
      return obj;
    });
  }

  return { init, run, query, one, persist };

})();
