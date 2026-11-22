'use strict';

const state = { books: [], selected: null, isNewBook: false };
const grid = document.querySelector('#book-grid');
const status = document.querySelector('#status');
const dialog = document.querySelector('#book-dialog');
const detail = document.querySelector('#detail-view');
const form = document.querySelector('#edit-form');
const formError = document.querySelector('#form-error');
const linkRows = document.querySelector('#link-rows');
const search = document.querySelector('#search');
const sort = document.querySelector('#sort');
const themeToggle = document.querySelector('#theme-toggle');

// Theme handling
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.classList.toggle('dark', savedTheme === 'dark');
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

initTheme();
if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function cover(book, className) {
  const wrapper = element('div', className);
  const url = safeUrl(book.cover);
  const fallback = element('span', 'cover-fallback', book.title);
  wrapper.append(fallback);
  if (url) {
    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    img.loading = 'lazy';
    img.addEventListener('error', () => img.remove());
    wrapper.append(img);
  }
  return wrapper;
}

function ratingText(rating) {
  return Number(rating) > 0 ? `★ ${rating}` : 'Not rated';
}

function render() {
  const query = search.value.trim().toLocaleLowerCase();
  const entries = state.books.map((book, index) => ({ book, index })).filter(({ book }) =>
    [book.title, book.author, book.series_name || '', ...(book.tags || [])]
      .some(value => value.toLocaleLowerCase().includes(query)));
  const compare = {
    title: (a, b) => a.book.title.localeCompare(b.book.title),
    author: (a, b) => a.book.author.localeCompare(b.book.author),
    recent: (a, b) => b.book.end_date.localeCompare(a.book.end_date),
    rating: (a, b) => Number(b.book.rating) - Number(a.book.rating)
  };
  if (compare[sort.value]) entries.sort(compare[sort.value]);
  document.querySelector('#results-count').textContent = `${entries.length} book${entries.length !== 1 ? 's' : ''}`;
  grid.replaceChildren();
  status.textContent = entries.length ? '' : 'No books found. Try a different search.';
  for (const { book, index } of entries) {
    const card = element('button', 'book-card');
    card.type = 'button';
    card.setAttribute('aria-label', `View ${book.title} by ${book.author}`);
    const artwork = cover(book, 'book-cover');
    const info = element('div', 'card-info');
    info.append(element('h3', '', book.title), element('p', 'author', book.author));
    const meta = element('div', 'card-meta');
    meta.append(element('span', 'rating', ratingText(book.rating)), element('span', '', book.end_date.slice(0, 4)));
    info.append(meta);
    card.append(artwork, info);
    card.addEventListener('click', () => openBook(index));
    grid.append(card);
  }
}

async function loadBooks() {
  status.textContent = 'Loading your library...';
  try {
    const response = await fetch('./books.json');
    if (!response.ok) throw new Error('Failed to load books.json');
    const data = await response.json();
    state.books = data.books || [];
    render();
  } catch (error) {
    status.textContent = `Could not load the library: ${error.message}`;
  }
}

function downloadJSON() {
  const data = { books: state.books };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'books.json';
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function addDetail(parent, label, value) {
  if (value === undefined || value === null || value === '') return;
  const block = element('div', 'detail-block');
  block.append(element('dt', '', label), element('dd', '', String(value)));
  parent.append(block);
}

function openBook(index) {
  state.selected = index;
  showDetails();
  dialog.showModal();
}

function showDetails() {
  const book = state.books[state.selected];
  document.querySelector('#dialog-eyebrow').textContent = 'BOOK DETAILS';
  document.querySelector('#dialog-title').textContent = book.title;
  form.hidden = true;
  detail.hidden = false;
  detail.replaceChildren();
  const overview = element('div', 'detail-overview');
  overview.append(cover(book, 'detail-cover'));
  const info = element('div', 'detail-info');
  info.append(element('p', 'detail-author', `by ${book.author}`));
  if (book.subtitle) info.append(element('p', 'detail-subtitle', book.subtitle));
  info.append(element('p', 'detail-rating', ratingText(book.rating)));
  const list = element('dl', 'details-list');
  addDetail(list, 'PAGES', book.pages);
  addDetail(list, 'STARTED', book.start_date);
  addDetail(list, 'FINISHED', book.end_date);
  if (book.series_name) addDetail(list, 'SERIES', `${book.series_name} · ${book.series_order} / ${book.series_total}`);
  info.append(list);
  overview.append(info);
  detail.append(overview);
  if (book.tags.length) {
    const tags = element('div', 'tags');
    for (const tag of book.tags) tags.append(element('span', 'tag', tag));
    detail.append(tags);
  }
  for (const [label, value] of [['Description', book.description], ['Notes', book.notes]]) {
    if (value) {
      const section = element('section', 'detail-section');
      section.append(element('h3', '', label), element('p', '', value));
      detail.append(section);
    }
  }
  if (book.links && Object.keys(book.links).length) {
    const section = element('section', 'detail-section');
    section.append(element('h3', '', 'Links'));
    const links = element('div', 'book-links');
    for (const [name, value] of Object.entries(book.links)) {
      const url = safeUrl(value);
      if (!url) continue;
      const link = element('a', '', Array.isArray(book.links) ? value : name);
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      links.append(link);
    }
    if (links.children.length) {
      section.append(links);
      detail.append(section);
    }
  }
  const actions = element('div', 'dialog-actions');
  const remove = element('button', 'button danger', 'Delete book');
  remove.type = 'button';
  remove.addEventListener('click', deleteBook);
  const edit = element('button', 'button primary', 'Edit book');
  edit.type = 'button';
  edit.addEventListener('click', startEdit);
  actions.append(remove, edit);
  detail.append(actions);
}

function startEdit() {
  const book = state.books[state.selected];
  document.querySelector('#dialog-eyebrow').textContent = 'EDIT BOOK';
  detail.hidden = true;
  form.hidden = false;
  formError.textContent = '';
  for (const name of ['title', 'subtitle', 'series_name', 'series_order', 'series_total', 'author', 'pages', 'rating', 'start_date', 'end_date', 'cover', 'description', 'notes']) {
    form.elements[name].value = book[name] ?? '';
  }
  updateSearchLinks();
  form.elements.tags.value = book.tags.join('\n');
  updateStatusCheckboxes();
  linkRows.replaceChildren();
  if (Array.isArray(book.links)) {
    for (const url of book.links) addLinkRow('', url, true);
  } else if (book.links) {
    for (const [label, url] of Object.entries(book.links)) addLinkRow(label, url, false, true);
  }
  form.elements.title.focus();
}

function startNewBook() {
  state.isNewBook = true;
  document.querySelector('#dialog-eyebrow').textContent = 'ADD NEW BOOK';
  document.querySelector('#dialog-title').textContent = 'Add a book to your library';
  detail.hidden = true;
  form.hidden = false;
  formError.textContent = '';
  const today = new Date().toISOString().split('T')[0];
  for (const name of ['title', 'subtitle', 'series_name', 'author', 'description', 'notes']) {
    form.elements[name].value = '';
  }
  updateSearchLinks();
  form.elements.cover.value = 'https://cdn.jasonlawton.com/books/cover.jpg';
  form.elements.series_order.value = '0';
  form.elements.series_total.value = '0';
  form.elements.pages.value = '0';
  form.elements.rating.value = '0';
  form.elements.start_date.value = today;
  form.elements.end_date.value = today;
  form.elements.tags.value = '';
  updateStatusCheckboxes();
  linkRows.replaceChildren();
  dialog.showModal();
  form.elements.title.focus();
}

function addLinkRow(label = '', url = '', legacyArray = false, existing = false) {
  const row = element('div', 'link-row');
  row.dataset.legacyArray = String(legacyArray);
  row.dataset.existing = String(existing || legacyArray);
  const labelField = element('label', '', 'Label');
  const labelInput = document.createElement('input');
  labelInput.className = 'link-label';
  labelInput.value = label;
  labelInput.placeholder = 'e.g. bookshop.org';
  labelField.append(labelInput);
  const urlField = element('label', '', 'URL');
  const urlInput = document.createElement('input');
  urlInput.className = 'link-url';
  urlInput.value = url;
  urlInput.placeholder = 'https://...';
  urlInput.inputMode = 'url';
  urlField.append(urlInput);
  const remove = element('button', 'button secondary remove-link', 'Remove');
  remove.type = 'button';
  remove.setAttribute('aria-label', 'Remove link');
  remove.addEventListener('click', () => row.remove());
  row.append(labelField, urlField, remove);
  linkRows.append(row);
  return labelInput;
}

document.querySelector('#add-link').addEventListener('click', () => addLinkRow().focus());

document.querySelector('#set-future-link').addEventListener('click', (e) => {
  e.preventDefault();
  form.elements.start_date.value = '2099-01-01';
  form.elements.end_date.value = '2099-01-01';
});

function updateSearchLinks() {
  const storygraphLink = document.querySelector('#storygraph-link');
  const amazonLink = document.querySelector('#amazon-link');
  const titleAmazonLink = document.querySelector('#title-amazon-link');
  const bookshopLink = document.querySelector('#bookshop-link');
  const title = form.elements.title.value.trim();
  if (title) {
    const encodedTitle = encodeURIComponent(title);
    storygraphLink.href = `https://app.thestorygraph.com/browse?search_term=${encodedTitle}`;
    storygraphLink.style.display = 'inline-block';
    amazonLink.href = `https://www.amazon.com/s?k=${encodedTitle}`;
    amazonLink.style.display = 'inline-block';
    titleAmazonLink.href = amazonLink.href;
    titleAmazonLink.style.display = 'inline-block';
    bookshopLink.href = `https://bookshop.org/beta-search?bkshp-astro=t&keywords=${encodedTitle}`;
    bookshopLink.style.display = 'inline-block';
  } else {
    storygraphLink.href = '#';
    storygraphLink.style.display = 'none';
    amazonLink.href = '#';
    amazonLink.style.display = 'none';
    titleAmazonLink.href = '#';
    titleAmazonLink.style.display = 'none';
    bookshopLink.href = '#';
    bookshopLink.style.display = 'none';
  }
}

form.elements.title.addEventListener('input', updateSearchLinks);

function saveChange(action, book) {
  if (action === 'add') {
    state.books.unshift(book);
  } else if (action === 'edit') {
    state.books[state.selected] = book;
  } else if (action === 'delete') {
    state.books.splice(state.selected, 1);
  }
  render();
}

form.addEventListener('submit', event => {
  event.preventDefault();
  formError.textContent = '';
  const book = state.isNewBook ? {
    title: '',
    subtitle: '',
    series_name: '',
    series_order: 0,
    series_total: 0,
    author: '',
    pages: 0,
    rating: 0,
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    cover: '',
    description: '',
    notes: '',
    tags: [],
    links: {}
  } : { ...state.books[state.selected] };
  for (const name of ['title', 'author', 'start_date', 'end_date', 'cover']) book[name] = form.elements[name].value;
  for (const name of ['subtitle', 'series_name', 'description', 'notes']) {
    const value = form.elements[name].value;
    if (value || Object.hasOwn(book, name)) book[name] = value;
  }
  for (const name of ['series_order', 'pages', 'rating']) book[name] = Number(form.elements[name].value);
  const total = form.elements.series_total.value.trim();
  book.series_total = total !== '' && Number.isFinite(Number(total)) ? Number(total) : total;
  book.tags = form.elements.tags.value.split('\n').map(tag => tag.trim().replace(/\s+/g, '-')).filter(Boolean);
  const rows = [...linkRows.querySelectorAll('.link-row')].map(row => ({
    label: row.querySelector('.link-label').value,
    url: row.querySelector('.link-url').value,
    legacyArray: row.dataset.legacyArray === 'true',
    existing: row.dataset.existing === 'true'
  }));
  const keepArray = Array.isArray(book.links) && rows.every(row => row.legacyArray && !row.label);
  if (keepArray) {
    book.links = rows.map(row => row.url);
  } else if (rows.length) {
    const labels = new Set();
    for (const row of rows) {
      if (!row.label.trim() || (!row.existing && !row.url.trim())) {
        formError.textContent = 'Enter a label and URL for each new link. Existing unlabeled links need labels when adding named links.';
        return;
      }
      if (labels.has(row.label)) {
        formError.textContent = 'Each link must have a unique label.';
        return;
      }
      labels.add(row.label);
    }
    book.links = Object.fromEntries(rows.map(row => [row.label, row.url]));
  } else if (Object.hasOwn(book, 'links')) {
    book.links = {};
  }
  const action = state.isNewBook ? 'add' : 'edit';
  saveChange(action, book);
  state.isNewBook = false;
  dialog.close();
});

async function deleteBook() {
  const book = state.books[state.selected];
  if (!window.confirm(`Delete “${book.title}” from your library? This cannot be undone.`)) return;
  saveChange('delete');
  dialog.close();
}

document.querySelector('#close-dialog').addEventListener('click', () => dialog.close());
document.querySelector('#cancel-edit').addEventListener('click', () => {
  if (state.isNewBook) {
    state.isNewBook = false;
    dialog.close();
  } else {
    showDetails();
  }
});
document.querySelector('#new-book').addEventListener('click', startNewBook);
document.querySelector('#download-btn').addEventListener('click', downloadJSON);
search.addEventListener('input', render);
sort.addEventListener('change', render);

// Auto-convert spaces to line breaks in tags field
form.elements.tags.addEventListener('input', (e) => {
  const value = e.target.value;
  if (value.includes(' ')) {
    e.target.value = value.split(/\s+/).filter(Boolean).join('\n');
  }
});

// Helper function to manage status tags
function updateStatusTags() {
  const tagsTextarea = form.elements.tags;
  const tags = tagsTextarea.value.split('\n').map(tag => tag.trim()).filter(Boolean);
  
  // Remove any existing status tags
  const otherTags = tags.filter(tag => tag !== 'to read' && tag !== 'currently reading');
  
  // Build the new tag list with status tags in the correct order
  const newTags = [];
  if (currentlyReadingCheckbox.checked) newTags.push('currently reading');
  if (toReadCheckbox.checked) newTags.push('to read');
  newTags.push(...otherTags);
  
  tagsTextarea.value = newTags.join('\n');
}

// Handle "to read" checkbox
const toReadCheckbox = document.querySelector('#to-read-checkbox');
toReadCheckbox.addEventListener('change', updateStatusTags);

// Handle "currently reading" checkbox
const currentlyReadingCheckbox = document.querySelector('#currently-reading-checkbox');
currentlyReadingCheckbox.addEventListener('change', updateStatusTags);

// Sync checkbox state when opening a book or starting new book
function updateStatusCheckboxes() {
  const tagsValue = form.elements.tags.value;
  const tags = tagsValue.split('\n').map(tag => tag.trim()).filter(Boolean);
  toReadCheckbox.checked = tags.includes('to read');
  currentlyReadingCheckbox.checked = tags.includes('currently reading');
}
loadBooks();
