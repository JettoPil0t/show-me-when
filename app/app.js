import { fetchIncidents, ack } from './api.js';
import { renderList, markAcked } from './board.js';

export const REFRESH_MS = 2000;

const list = document.querySelector('[data-testid="incident-list"]');
const loader = document.querySelector('[data-testid="loader"]');
const empty = document.querySelector('[data-testid="empty"]');
const error = document.querySelector('.error');

const acked = new Map();

function showError(message) {
  error.textContent = message;
  error.hidden = !message;
}

async function onAck(id, row) {
  const button = row.querySelector('[data-testid="ack"]');
  if (button) button.disabled = true;
  try {
    const reply = await ack(id);
    acked.set(id, reply.ackedAt);
    markAcked(list.querySelector(`[data-testid="incident-row"][data-id="${CSS.escape(id)}"]`) ?? row, reply.ackedAt);
    showError('');
  } catch (err) {
    if (button) button.disabled = false;
    showError(`Ack ${id} failed: ${err.message}`);
  }
}

function show(page) {
  renderList(list, page.incidents, { acked, onAck });
  loader.remove();
  empty.hidden = page.incidents.length > 0;
}

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
