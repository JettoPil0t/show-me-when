import { formatLocalTime } from './time.js';

export function newestFirst(incidents) {
  return [...incidents].sort((a, b) => Date.parse(b.openedAt) - Date.parse(a.openedAt));
}

function span(className) {
  const el = document.createElement('span');
  el.className = className;
  return el;
}

function fillRow(row, incident) {
  row.className = `row ${incident.severity}${row.classList.contains('is-acked') ? ' is-acked' : ''}`;
  row.querySelector('.id').textContent = incident.id;
  row.querySelector('.sev').textContent = incident.severity;
  row.querySelector('.what').textContent = `${incident.service} · ${incident.region} · ${incident.summary}`;
  const time = row.querySelector('time');
  time.dateTime = incident.openedAt;
  time.title = incident.openedAt;
  time.textContent = formatLocalTime(incident.openedAt);
  row.dataset.signature = JSON.stringify(incident);
}

function createRow(incident, onAck) {
  const row = document.createElement('li');
  row.dataset.testid = 'incident-row';
  row.dataset.id = incident.id;

  const action = span('action');
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.testid = 'ack';
  button.textContent = 'Ack';
  button.addEventListener('click', () => onAck(incident.id, row));
  action.append(button);

  row.append(span('id'), span('sev'), span('what'), document.createElement('time'), action);
  fillRow(row, incident);
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

function rowsById(list) {
  return new Map([...list.children].map((row) => [row.dataset.id, row]));
}

export function updateShownRows(list, incidents) {
  const shown = rowsById(list);
  for (const incident of incidents) {
    const row = shown.get(incident.id);
    if (row && row.dataset.signature !== JSON.stringify(incident)) fillRow(row, incident);
  }
}

export function notShown(list, incidents) {
  const shown = rowsById(list);
  return incidents.filter((incident) => !shown.has(incident.id));
}

export function renderList(list, incidents, { acked, onAck }) {
  const existing = rowsById(list);
  const ordered = newestFirst(incidents).map((incident) => {
    let row = existing.get(incident.id);
    if (row) {
      if (row.dataset.signature !== JSON.stringify(incident)) fillRow(row, incident);
    } else {
      row = createRow(incident, onAck);
      if (acked.has(incident.id)) markAcked(row, acked.get(incident.id));
    }
    existing.delete(incident.id);
    return row;
  });
  for (const stale of existing.values()) stale.remove();
  ordered.forEach((row, index) => {
    if (list.children[index] !== row) list.insertBefore(row, list.children[index] ?? null);
  });
}
