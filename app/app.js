import { fetchIncidents, ack } from './api.js';
import { renderList, markAcked, updateShownRows, notShown } from './board.js';

export const REFRESH_MS = 2000;

const list = document.querySelector('[data-testid="incident-list"]');
const loader = document.querySelector('[data-testid="loader"]');
const empty = document.querySelector('[data-testid="empty"]');
const newBar = document.querySelector('[data-testid="new-bar"]');
const error = document.querySelector('.error');

const acked = new Map();
let latest = [];

function showError(message) {
  error.textContent = message;
  error.hidden = !message;
}

function rowFor(id) {
  return list.querySelector(`[data-testid="incident-row"][data-id="${CSS.escape(id)}"]`);
}

async function onAck(id, row) {
  const button = row.querySelector('[data-testid="ack"]');
  if (button) button.disabled = true;
  try {
    const reply = await ack(id);
    acked.set(id, reply.ackedAt);
    markAcked(rowFor(id) ?? row, reply.ackedAt);
    showError('');
  } catch (err) {
    if (button) button.disabled = false;
    showError(`Ack ${id} failed: ${err.message}`);
  }
}

function showAll() {
  renderList(list, latest, { acked, onAck });
  newBar.hidden = true;
  empty.hidden = list.children.length > 0;
}

function holdStill() {
  updateShownRows(list, latest);
  const waiting = notShown(list, latest).length;
  newBar.textContent = `${waiting} new`;
  newBar.hidden = waiting === 0;
}

function show(page) {
  latest = page.incidents;
  loader.remove();
  if (list.children.length === 0) showAll();
  else holdStill();
}

newBar.addEventListener('click', showAll);

async function refresh() {
  try {
    show(await fetchIncidents());
    showError('');
  } catch (err) {
    showError(`Could not load incidents: ${err.message}`);
  } finally {
    setTimeout(refresh, REFRESH_MS);
  }
}

refresh();
