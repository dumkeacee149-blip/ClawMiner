import fs from 'node:fs';

export function loadState(filePath) {
  try {
    if (!fs.existsSync(filePath)) return { registrations: {}, leases: {} };
    const raw = fs.readFileSync(filePath, 'utf8');
    const j = JSON.parse(raw);
    return {
      registrations: j.registrations || {},
      leases: j.leases || {},
    };
  } catch {
    return { registrations: {}, leases: {} };
  }
}

export function saveState(filePath, state) {
  const out = JSON.stringify(state, null, 2);
  fs.writeFileSync(filePath, out, { mode: 0o600 });
}
