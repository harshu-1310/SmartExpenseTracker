const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

const dbFile = path.join(dataDir, 'tracker.db');
const db = new sqlite3.Database(dbFile);

const initSql = [`
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL
);
`, `
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  category TEXT NOT NULL,
  date TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('expense', 'income')),
  note TEXT DEFAULT ''
);
`, `
INSERT OR IGNORE INTO categories (name) VALUES
  ('Transportation'),
  ('Food'),
  ('Rent'),
  ('Utilities'),
  ('Health'),
  ('Entertainment'),
  ('Salary'),
  ('Savings');
`];

initSql.forEach(script => {
  db.exec(script, err => {
    if (err) {
      console.error('Database initialization failed:', err.message);
    }
  });
});

module.exports = db;
