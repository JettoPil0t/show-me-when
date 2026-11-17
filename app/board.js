import { formatLocalTime } from './time.js';

export function newestFirst(incidents) {
  return [...incidents].sort((a, b) => Date.parse(b.openedAt) - Date.parse(a.openedAt));
}

function span(className, text) {
  const el = document.createElement('span');
  el.className = className;
  el.textContent = text;
  return el;
}

function createRow(incident, onAck) {
  const row = document.createElement('li');
  row.dataset.testid = 'incident-row';
  row.dataset.id = incident.id;
  row.className = `row ${incident.severity}`;

  const time = document.createElement('time');
  time.dateTime = incident.openedAt;
  time.textContent = formatLocalTime(incident.openedAt);
  time.title = incident.openedAt;

  const action = document.createElement('span');
  action.className = 'action';
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.testid = 'ack';
  button.textContent = 'Ack';
  button.addEventListener('click', () => onAck(incident.id, row));
  action.append(button);

  row.append(
    span('id', incident.id),
    span('sev', incident.severity),
    span('what', `${incident.service} · ${incident.region} · ${incident.summary}`),
    time,
    action,
  );
  return row;
}

export function markAcked(row, ackedAt) {
  const action = row.querySelector('.action');
  const mark = document.createElement('span');
  mark.dataset.testid = 'acked';
  mark.className = 'acked';
  mark.textContent = 'acked';
  if (ackedAt) {
    mark.title = `acked ${ackedAt}`;
  }
  action.replaceChildren(mark);
  row.classList.add('is-acked');
}

export function renderList(list, incidents, { acked, onAck }) {
  const existing = new Map([...list.children].map((row) => [row.dataset.id, row]));
  const ordered = newestFirst(incidents).map((incident) => {
    const signature = JSON.stringify(incident);
    let row = existing.get(incident.id);
    if (row && row.dataset.signature !== signature) {
      const fresh = createRow(incident, onAck);
      row.replaceWith(fresh);
      row = fresh;
      if (acked.has(incident.id)) markAcked(row, acked.get(incident.id));
    }
    if (!row) {
      row = createRow(incident, onAck);
      if (acked.has(incident.id)) markAcked(row, acked.get(incident.id));
    }
    row.dataset.signature = signature;
    existing.delete(incident.id);
    return row;
  });
  for (const stale of existing.values()) stale.remove();
  ordered.forEach((row, index) => {
    if (list.children[index] !== row) list.insertBefore(row, list.children[index] ?? null);
  });
}
