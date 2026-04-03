/**
 * db-orders.js — Gnoke Tailors
 * All domain queries for orders and customer lookups.
 * Reads from DB, returns plain data. No DOM, no state writes.
 *
 * Public API:
 *   Orders.add(o)             → insert and persist
 *   Orders.forDate(date)      → [{order}] for a specific due_date
 *   Orders.toggle(id)         → flip ready flag and persist
 *   Orders.remove(id)         → delete and persist
 *   Orders.overdue()          → [{order}] past due and not ready
 *   Orders.allReady()         → [{order}] ready and unpaid
 *   Orders.stats()            → { total, done, overdue, deposits }
 *   Orders.debtors()          → [{order}] not ready, with balance > 0, sorted
 *   Orders.datesWithJobs()    → Set of date strings that have orders
 *   Customers.names(q)        → [{name}] distinct names matching query
 *   Customers.history(name)   → [{order}] for a customer, newest first
 *   Customers.allGrouped()    → [{name, orders[], lastStyle, count}]
 *
 * Copyright © 2026 Edmund Sparrow — GNU GPL v3
 */

const Orders = (() => {

  const today = () => new Date().toISOString().split('T')[0];

  async function update(id, o) {
    DB.run(
      `UPDATE orders
       SET name=?, phone=?, style=?, notes=?, price=?, deposit=?, due_date=?, swatch=?
       WHERE id=?`,
      [o.name, o.phone || '', o.style || '', o.notes || '',
       o.price || 0, o.deposit || 0, o.due_date, o.swatch || '', id]
    );
    await DB.persist();
  }

  function earnings(period) {
    // period: 'week' | 'month' | 'year'
    const t = today();
    let from;
    if (period === 'week') {
      const d = new Date(t);
      d.setDate(d.getDate() - d.getDay()); // start of week (Sun)
      from = d.toISOString().split('T')[0];
    } else if (period === 'month') {
      from = t.substring(0, 7) + '-01';
    } else {
      from = t.substring(0, 4) + '-01-01';
    }

    // Completed orders whose due_date falls in the period
    const completed = DB.query(
      `SELECT * FROM orders WHERE ready = 1 AND due_date >= ? AND due_date <= ?
       ORDER BY due_date DESC`,
      [from, t]
    );

    // All orders created in the period (regardless of ready status)
    const created = DB.query(
      `SELECT * FROM orders WHERE date(created_at) >= ? AND date(created_at) <= ?`,
      [from, t]
    );

    const totalValue    = completed.reduce((s, o) => s + o.price, 0);
    const totalCollected = completed.reduce((s, o) => s + o.price, 0); // full price when marked ready
    const depositsIn    = created.reduce((s, o) => s + o.deposit, 0);
    const jobsFinished  = completed.length;
    const jobsCreated   = created.length;

    return { completed, totalValue, totalCollected, depositsIn, jobsFinished, jobsCreated, from, to: t };
  }

  async function add(o) {
    DB.run(
      `INSERT INTO orders (name, phone, style, notes, price, deposit, due_date, swatch, ready)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [o.name, o.phone || '', o.style || '', o.notes || '', o.price || 0, o.deposit || 0,
       o.due_date || today(), o.swatch || '']
    );
    await DB.persist();
  }

  function forDate(date) {
    return DB.query(
      `SELECT * FROM orders WHERE due_date = ? ORDER BY created_at ASC`,
      [date]
    );
  }

  async function toggle(id) {
    DB.run(`UPDATE orders SET ready = 1 - ready WHERE id = ?`, [id]);
    await DB.persist();
  }

  async function remove(id) {
    DB.run(`DELETE FROM orders WHERE id = ?`, [id]);
    await DB.persist();
  }

  function overdue() {
    return DB.query(
      `SELECT * FROM orders WHERE due_date < ? AND ready = 0 ORDER BY due_date ASC`,
      [today()]
    );
  }

  function allReady() {
    return DB.query(
      `SELECT * FROM orders WHERE ready = 1 ORDER BY due_date ASC`
    );
  }

  function stats() {
    const t   = DB.one(`SELECT COUNT(*) as n FROM orders`);
    const d   = DB.one(`SELECT COUNT(*) as n FROM orders WHERE ready = 1`);
    const ov  = DB.one(`SELECT COUNT(*) as n FROM orders WHERE due_date < ? AND ready = 0`, [today()]);
    const dep = DB.one(`SELECT COALESCE(SUM(deposit),0) as n FROM orders`);
    return {
      total    : t?.n   || 0,
      done     : d?.n   || 0,
      overdue  : ov?.n  || 0,
      deposits : dep?.n || 0,
    };
  }

  function debtors() {
    return DB.query(
      `SELECT *, (price - deposit) as balance
       FROM orders
       WHERE ready = 0 AND (price - deposit) > 0
       ORDER BY balance DESC`
    );
  }

  function datesWithJobs() {
    const rows = DB.query(`SELECT DISTINCT due_date FROM orders`);
    return new Set(rows.map(r => r.due_date));
  }

  return { add, update, forDate, toggle, remove, overdue, allReady, stats, debtors, datesWithJobs, earnings };

})();


const Customers = (() => {

  function names(q) {
    const like = `%${q}%`;
    return DB.query(
      `SELECT DISTINCT name FROM orders WHERE name LIKE ? ORDER BY name ASC LIMIT 6`,
      [like]
    );
  }

  function history(name) {
    return DB.query(
      `SELECT * FROM orders WHERE name = ? ORDER BY created_at DESC`,
      [name]
    );
  }

  function allGrouped() {
    const names = DB.query(
      `SELECT DISTINCT name FROM orders ORDER BY name ASC`
    );
    return names.map(({ name }) => {
      const orders = history(name);
      return {
        name,
        orders,
        lastStyle : orders[0]?.style || '',
        count     : orders.length,
      };
    });
  }

  return { names, history, allGrouped };

})();