const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/expenses', (req, res) => {
  const { start, end, category, type } = req.query;
  const filters = [];
  const params = [];

  if (start) {
    filters.push('date >= ?');
    params.push(start);
  }
  if (end) {
    filters.push('date <= ?');
    params.push(end);
  }
  if (category) {
    filters.push('category = ?');
    params.push(category);
  }
  if (type) {
    filters.push('type = ?');
    params.push(type);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const query = `SELECT * FROM expenses ${whereClause} ORDER BY date DESC, id DESC`;

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.post('/api/expenses', (req, res) => {
  const { description, amount, category, date, type, note } = req.body;
  if (!description || !amount || !category || !date || !type) {
    return res.status(400).json({ error: 'Missing required expense fields.' });
  }

  const stmt = db.prepare(`INSERT INTO expenses (description, amount, category, date, type, note) VALUES (?, ?, ?, ?, ?, ?)`);
  stmt.run(description, amount, category, date, type, note || '', function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ id: this.lastID, description, amount, category, date, type, note: note || '' });
  });
});

app.put('/api/expenses/:id', (req, res) => {
  const id = Number(req.params.id);
  const { description, amount, category, date, type, note } = req.body;
  if (!description || !amount || !category || !date || !type) {
    return res.status(400).json({ error: 'Missing required expense fields.' });
  }

  const stmt = db.prepare(`UPDATE expenses SET description = ?, amount = ?, category = ?, date = ?, type = ?, note = ? WHERE id = ?`);
  stmt.run(description, amount, category, date, type, note || '', id, function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Expense not found.' });
    }
    res.json({ id, description, amount, category, date, type, note: note || '' });
  });
});

app.delete('/api/expenses/:id', (req, res) => {
  const id = Number(req.params.id);
  const stmt = db.prepare('DELETE FROM expenses WHERE id = ?');
  stmt.run(id, function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Expense not found.' });
    }
    res.json({ deleted: true });
  });
});

app.get('/api/categories', (req, res) => {
  db.all('SELECT name FROM categories ORDER BY name', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows.map(row => row.name));
  });
});

app.post('/api/categories', (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Category name is required.' });
  }

  const stmt = db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)');
  stmt.run(name.trim(), function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ name: name.trim() });
  });
});

app.get('/api/report/summary', (req, res) => {
  const { start, end } = req.query;
  const filters = [];
  const params = [];

  if (start) {
    filters.push('date >= ?');
    params.push(start);
  }
  if (end) {
    filters.push('date <= ?');
    params.push(end);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const query = `
    SELECT type,
           COUNT(*) AS count,
           SUM(amount) AS total,
           ROUND(AVG(amount), 2) AS average
    FROM expenses
    ${whereClause}
    GROUP BY type
  `;

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.get('/api/report/categories', (req, res) => {
  const { start, end } = req.query;
  const filters = [];
  const params = [];

  if (start) {
    filters.push('date >= ?');
    params.push(start);
  }
  if (end) {
    filters.push('date <= ?');
    params.push(end);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const query = `
    SELECT category,
           COUNT(*) AS entries,
           SUM(amount) AS total
    FROM expenses
    ${whereClause}
    GROUP BY category
    ORDER BY total DESC
    LIMIT 10
  `;

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.get('/api/export', (req, res) => {
  db.all('SELECT * FROM expenses ORDER BY date DESC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.header('Content-Type', 'application/json');
    res.attachment('expense-export.json');
    res.send(JSON.stringify({ generatedAt: new Date().toISOString(), expenses: rows }, null, 2));
  });
});

app.get('/api/overview', (req, res) => {
  const { start, end } = req.query;
  const filters = [];
  const params = [];

  if (start) {
    filters.push('date >= ?');
    params.push(start);
  }
  if (end) {
    filters.push('date <= ?');
    params.push(end);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const query = `
    SELECT
      COUNT(*) AS transactionCount,
      SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expenseTotal,
      SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS incomeTotal
    FROM expenses
    ${whereClause}
  `;

  db.get(query, params, (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({
      transactions: row.transactionCount || 0,
      expenses: Number(row.expenseTotal || 0).toFixed(2),
      income: Number(row.incomeTotal || 0).toFixed(2),
      balance: Number((row.incomeTotal || 0) - (row.expenseTotal || 0)).toFixed(2)
    });
  });
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Smart Expense Tracker running on http://localhost:${PORT}`);
});
