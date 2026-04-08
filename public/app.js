const api = {
  expenses: '/api/expenses',
  categories: '/api/categories',
  overview: '/api/overview',
  reportCategories: '/api/report/categories',
  export: '/api/export'
};

const elements = {
  form: document.getElementById('transaction-form'),
  description: document.getElementById('description'),
  amount: document.getElementById('amount'),
  category: document.getElementById('category'),
  type: document.getElementById('type'),
  date: document.getElementById('date'),
  note: document.getElementById('note'),
  newCategory: document.getElementById('new-category'),
  addCategory: document.getElementById('add-category'),
  btnRefresh: document.getElementById('btn-refresh'),
  btnClearFilters: document.getElementById('btn-clear-filters'),
  btnExport: document.getElementById('btn-export'),
  filterStart: document.getElementById('filter-start'),
  filterEnd: document.getElementById('filter-end'),
  searchInput: document.getElementById('search-input'),
  transactionTable: document.getElementById('transaction-table'),
  rowTemplate: document.getElementById('row-template'),
  summaryBalance: document.getElementById('summary-balance'),
  summaryIncome: document.getElementById('summary-income'),
  summaryExpenses: document.getElementById('summary-expenses'),
  summaryCount: document.getElementById('summary-count'),
  categoryChart: document.getElementById('category-chart')
};

let expenseData = [];

const formatCurrency = value => {
  const amount = Number(value || 0);
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD'
  });
};

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.error || response.statusText || 'Request failed');
  }
  return response.json();
};

const loadCategories = async () => {
  const categories = await fetchJson(api.categories);
  elements.category.innerHTML = categories
    .map(category => `<option value="${category}">${category}</option>`)
    .join('');
};

const loadOverview = async () => {
  const params = new URLSearchParams();
  if (elements.filterStart.value) params.set('start', elements.filterStart.value);
  if (elements.filterEnd.value) params.set('end', elements.filterEnd.value);

  const overview = await fetchJson(`${api.overview}?${params}`);
  elements.summaryBalance.textContent = formatCurrency(overview.balance);
  elements.summaryIncome.textContent = formatCurrency(overview.income);
  elements.summaryExpenses.textContent = formatCurrency(overview.expenses);
  elements.summaryCount.textContent = overview.transactions;
};

const loadExpenses = async () => {
  const params = new URLSearchParams();
  if (elements.filterStart.value) params.set('start', elements.filterStart.value);
  if (elements.filterEnd.value) params.set('end', elements.filterEnd.value);

  expenseData = await fetchJson(`${api.expenses}?${params}`);
  renderTable();
  renderCategoryChart();
};

const renderTable = () => {
  const filterText = elements.searchInput.value.toLowerCase().trim();
  elements.transactionTable.innerHTML = '';

  expenseData
    .filter(item => {
      if (!filterText) return true;
      return [item.description, item.category, item.type, item.note]
        .join(' ')
        .toLowerCase()
        .includes(filterText);
    })
    .forEach(item => {
      const row = elements.rowTemplate.content.cloneNode(true);
      row.querySelector('.date').textContent = item.date;
      row.querySelector('.description').textContent = item.description;
      row.querySelector('.category').textContent = item.category;
      row.querySelector('.type').textContent = item.type;
      row.querySelector('.amount').textContent = formatCurrency(item.amount);
      row.querySelector('.note').textContent = item.note || '-';

      const actionCell = row.querySelector('.actions');
      const editButton = document.createElement('button');
      editButton.textContent = 'Edit';
      editButton.addEventListener('click', () => populateForm(item));

      const deleteButton = document.createElement('button');
      deleteButton.textContent = 'Delete';
      deleteButton.className = 'delete';
      deleteButton.addEventListener('click', () => deleteExpense(item.id));

      actionCell.append(editButton, deleteButton);
      elements.transactionTable.appendChild(row);
    });
};

const renderCategoryChart = async () => {
  const params = new URLSearchParams();
  if (elements.filterStart.value) params.set('start', elements.filterStart.value);
  if (elements.filterEnd.value) params.set('end', elements.filterEnd.value);

  const categories = await fetchJson(`${api.reportCategories}?${params}`);
  const canvas = elements.categoryChart;
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const padding = 40;
  const maxTotal = Math.max(...categories.map(x => x.total), 1);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, width, height);
  ctx.font = '14px Inter, sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText('Category totals', padding, 24);

  categories.forEach((item, index) => {
    const barWidth = (width - padding * 2) / categories.length - 16;
    const barHeight = (Number(item.total) / maxTotal) * (height - 100);
    const x = padding + index * (barWidth + 16);
    const y = height - padding - barHeight;
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(x, y, barWidth, barHeight);
    ctx.fillStyle = '#0f172a';
    ctx.fillText(item.category, x, height - padding + 16);
    ctx.fillText(formatCurrency(item.total), x, y - 8);
  });
};

const populateForm = item => {
  elements.description.value = item.description;
  elements.amount.value = item.amount;
  elements.category.value = item.category;
  elements.type.value = item.type;
  elements.date.value = item.date;
  elements.note.value = item.note;
  elements.form.dataset.editing = item.id;
  elements.form.querySelector('button[type=submit]').textContent = 'Update Transaction';
};

const resetForm = () => {
  elements.form.reset();
  delete elements.form.dataset.editing;
  elements.form.querySelector('button[type=submit]').textContent = 'Save Transaction';
};

const createExpense = async payload => {
  await fetchJson(api.expenses, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
};

const updateExpense = async (id, payload) => {
  await fetchJson(`${api.expenses}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
};

const deleteExpense = async id => {
  if (!confirm('Delete this transaction?')) return;
  await fetchJson(`${api.expenses}/${id}`, { method: 'DELETE' });
  await refreshUI();
};

const addCategory = async () => {
  const name = elements.newCategory.value.trim();
  if (!name) return;
  await fetchJson(api.categories, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  elements.newCategory.value = '';
  await loadCategories();
};

const refreshUI = async () => {
  await Promise.all([loadCategories(), loadOverview(), loadExpenses()]);
};

const handleSubmit = async event => {
  event.preventDefault();
  const payload = {
    description: elements.description.value.trim(),
    amount: Number(elements.amount.value),
    category: elements.category.value,
    date: elements.date.value,
    type: elements.type.value,
    note: elements.note.value.trim()
  };

  if (!payload.description || !payload.amount || !payload.category || !payload.date || !payload.type) {
    alert('Please fill in all required fields.');
    return;
  }

  try {
    if (elements.form.dataset.editing) {
      await updateExpense(elements.form.dataset.editing, payload);
    } else {
      await createExpense(payload);
    }
    resetForm();
    await refreshUI();
  } catch (error) {
    alert(error.message);
  }
};

const handleExport = () => {
  window.location.href = api.export;
};

const handleClearFilters = () => {
  elements.filterStart.value = '';
  elements.filterEnd.value = '';
  elements.searchInput.value = '';
  refreshUI();
};

const init = async () => {
  elements.date.value = new Date().toISOString().slice(0, 10);
  elements.form.addEventListener('submit', handleSubmit);
  elements.addCategory.addEventListener('click', addCategory);
  elements.btnRefresh.addEventListener('click', refreshUI);
  elements.btnExport.addEventListener('click', handleExport);
  elements.btnClearFilters.addEventListener('click', handleClearFilters);
  elements.searchInput.addEventListener('input', renderTable);

  await refreshUI();
};

window.addEventListener('DOMContentLoaded', init);
