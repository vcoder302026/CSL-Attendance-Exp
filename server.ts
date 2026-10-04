import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import crypto from 'crypto';
import fs from 'fs';

function getAppsScriptUrl() {
  try {
    const configContent = fs.readFileSync(path.join(process.cwd(), 'backend', 'config.js'), 'utf8');
    const match = configContent.match(/APPS_SCRIPT_URL\s*=\s*['"]([^'"]+)['"]/);
    if (match && match[1] && match[1] !== 'YOUR_APPS_SCRIPT_WEB_APP_URL') {
      return match[1];
    }
  } catch (e) {
    console.warn("Could not read backend/config.js");
  }
  return '';
}

let currentScriptUrl = getAppsScriptUrl();
let currentSheetId = '';
const configPath = path.join(process.cwd(), 'data', 'config.json');
try {
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    currentSheetId = config.sheetId || '';
  }
} catch (e) {
  console.error('Failed to load config', e);
}

function saveConfig(sheetId) {
  try {
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    const newSheetId = sheetId !== undefined ? sheetId : currentSheetId;
    
    fs.writeFileSync(configPath, JSON.stringify({ sheetId: newSheetId }));
    currentSheetId = newSheetId;
  } catch (e) {
    console.error('Failed to save config', e);
  }
}

async function appendToSheet(action, values) {
  if (!currentScriptUrl) return;
  try {
    // action is 'user' or 'log'
    await fetch(currentScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, values, sheetId: currentSheetId }),
      signal: AbortSignal.timeout(25000)
    });
  } catch (e: any) {
    console.warn('Non-fatal note: append to sheet via Apps Script:', e?.message || e);
  }
}

function formatSGT(timestamp) {
  const date = new Date(timestamp);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Singapore',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  }).formatToParts(date);
  
  const p: any = {};
  for (const part of parts) p[part.type] = part.value;
  return `${p.day} ${p.month} ${p.year} | ${p.hour}:${p.minute} ${p.dayPeriod}`;
}

function formatManualClockTime(dateStr?: string, hourVal?: string | number, minuteVal?: string | number, periodVal?: string): string {
  if (hourVal === undefined || hourVal === null || hourVal === '') {
    return formatSGT(Date.now());
  }
  
  let h = Number(hourVal);
  const m = Number(minuteVal || 0);
  let period = (periodVal || '').toUpperCase().trim();

  // If period not specified, detect from 24h
  if (!period) {
    if (h >= 12) {
      period = 'PM';
      if (h > 12) h -= 12;
    } else {
      period = 'AM';
      if (h === 0) h = 12;
    }
  } else {
    if (h > 12) {
      h -= 12;
      period = 'PM';
    } else if (h === 0) {
      h = 12;
    }
  }

  const hStr = String(h).padStart(2, '0');
  const mStr = String(m).padStart(2, '0');

  let dayStr = '';
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
    const [y, mon, d] = dateStr.trim().split('-').map(Number);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    dayStr = `${String(d).padStart(2, '0')} ${monthNames[mon - 1] || 'Jan'} ${y}`;
  } else if (dateStr && String(dateStr).trim()) {
    dayStr = String(dateStr).trim();
  } else {
    dayStr = getTodayDateSGT();
  }

  return `${dayStr} | ${hStr}:${mStr} ${period}`;
}


type ScanEvent = {
  id: string;
  name: string;
  email: string;
  action: string;
  qrTimestamp: number;
  scanTimestamp: number;
};

type RegistrationEvent = {
  id: string;
  name: string;
  email: string;
  registeredAt: number;
};

type RegisteredUser = {
  name: string;
  email: string;
  registeredAt: string;
  status: string;
};

const kioskEvents = new Map<string, ScanEvent[]>();
const kioskRegistrations = new Map<string, RegistrationEvent[]>();
const pendingScans = new Map<string, { sessionId: string; expiresAt: number; qrTimestamp: number }>();
const pendingApprovals = new Map<string, { id: string; name: string; email: string; status: 'pending' | 'approved' | 'rejected'; timestamp: number }>();

// Synced registered users from Google Sheet
let syncedRegisteredUsersList: RegisteredUser[] = [];
let lastUserSyncTime = 0;
let userSyncPromise: Promise<void> | null = null;

const usersCachePath = path.join(process.cwd(), 'data', 'users_cache.json');
try {
  if (fs.existsSync(usersCachePath)) {
    const list: RegisteredUser[] = JSON.parse(fs.readFileSync(usersCachePath, 'utf8'));
    if (Array.isArray(list)) {
      syncedRegisteredUsersList = list;
      console.log(`[Cache] Pre-loaded ${syncedRegisteredUsersList.length} registered users from disk cache`);
    }
  }
} catch (e) {
  console.error('Failed to load users cache from disk', e);
}

const deletedLogsPath = path.join(process.cwd(), 'data', 'deleted_logs.json');
let deletedLogSignatures = new Set<string>();
try {
  if (fs.existsSync(deletedLogsPath)) {
    const list: string[] = JSON.parse(fs.readFileSync(deletedLogsPath, 'utf8'));
    if (Array.isArray(list)) {
      deletedLogSignatures = new Set(list);
    }
  }
} catch (e) {
  console.error('Failed to load deleted logs cache from disk', e);
}

function saveDeletedLogs() {
  try {
    const dir = path.dirname(deletedLogsPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(deletedLogsPath, JSON.stringify(Array.from(deletedLogSignatures)));
  } catch (e) {
    console.error('Failed to persist deleted logs', e);
  }
}

// Synced scan logs from Google Sheet
let syncedLogsCache: string[][] = [];
let lastLogsSyncTime = 0;
let logsSyncPromise: Promise<string[][]> | null = null;

const logsCachePath = path.join(process.cwd(), 'data', 'logs_cache.json');
try {
  if (fs.existsSync(logsCachePath)) {
    const list: string[][] = JSON.parse(fs.readFileSync(logsCachePath, 'utf8'));
    if (Array.isArray(list)) {
      syncedLogsCache = list;
      console.log(`[Cache] Pre-loaded ${syncedLogsCache.length} scan logs from disk cache`);
    }
  }
} catch (e) {
  console.error('Failed to load logs cache from disk', e);
}

function saveLogsCache() {
  try {
    const dir = path.dirname(logsCachePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(logsCachePath, JSON.stringify(syncedLogsCache));
  } catch (e) {
    console.error('Failed to persist logs cache to disk', e);
  }
}

function makeLogSignature(timestamp: string, email: string, action: string): string {
  return `${(timestamp || '').trim().toLowerCase()}:::${(email || '').trim().toLowerCase()}:::${(action || '').trim().toLowerCase()}`;
}

function normalizeName(name: string): string {
  return (name || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeEmail(email: string): string {
  return (email || '').trim().toLowerCase();
}

function checkUserExactMatch(u: RegisteredUser, testName: string, testEmail: string): boolean {
  if (!u.name || !u.email || !testName || !testEmail) return false;
  
  const normUserName = normalizeName(u.name);
  const normTestName = normalizeName(testName);
  
  // Name must match exactly
  if (normUserName !== normTestName) {
    return false;
  }

  const normUserEmail = normalizeEmail(u.email);
  const normTestEmail = normalizeEmail(testEmail);

  if (normUserEmail === normTestEmail) {
    return true;
  }

  // NTU email alias support: e.g. user@e.ntu.edu.sg vs user@ntu.edu.sg vs user@e
  const atIdx1 = normUserEmail.indexOf('@');
  const atIdx2 = normTestEmail.indexOf('@');
  if (atIdx1 !== -1 && atIdx2 !== -1) {
    const u1 = normUserEmail.slice(0, atIdx1);
    const d1 = normUserEmail.slice(atIdx1 + 1);
    const u2 = normTestEmail.slice(0, atIdx2);
    const d2 = normTestEmail.slice(atIdx2 + 1);
    const isNtuDomain = (d: string) => d.includes('ntu.edu.sg') || d === 'e' || d === 'e.ntu';
    if (u1 === u2 && isNtuDomain(d1) && isNtuDomain(d2)) {
      return true;
    }
  }

  return false;
}

function matchRegisteredUser(name: string, email: string): { matched: boolean; user?: RegisteredUser } {
  if (!name || !email) return { matched: false };
  for (const u of syncedRegisteredUsersList) {
    if (checkUserExactMatch(u, name, email)) {
      return { matched: true, user: u };
    }
  }
  return { matched: false };
}

async function syncUsersFromSheet(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastUserSyncTime < 8000) {
    return;
  }
  if (userSyncPromise) {
    return userSyncPromise;
  }
  if (!currentScriptUrl) {
    return;
  }

  userSyncPromise = (async () => {
    try {
      const url = `${currentScriptUrl}?type=users${currentSheetId ? `&sheetId=${encodeURIComponent(currentSheetId)}` : ''}`;
      const response = await fetch(url, { 
        redirect: 'follow',
        signal: AbortSignal.timeout(25000)
      });
      if (!response.ok) {
        console.warn('[Sync] Apps Script returned status:', response.status);
        return;
      }
      const json = await response.json();
      const rawRows: string[][] = json.data || [];

      if (!Array.isArray(rawRows)) return;

      // Smart column detection
      let startIndex = 0;
      let emailCol = -1;
      let nameCol = -1;
      let regCol = 0;
      let statusCol = 3;

      if (rawRows.length > 0) {
        const firstRow = rawRows[0].map(c => String(c).trim().toLowerCase());
        const isHeader = firstRow.some(c => c === 'email' || c === 'email address' || c === 'name' || c === 'full name' || c === 'registered at');
        if (isHeader) {
          startIndex = 1;
          const eIdx = firstRow.findIndex(c => c.includes('email') || c.includes('mail'));
          const nIdx = firstRow.findIndex(c => c === 'name' || c.includes('full name'));
          const rIdx = firstRow.findIndex(c => c.includes('register') || c.includes('time') || c.includes('date'));
          const sIdx = firstRow.findIndex(c => c.includes('status'));
          if (eIdx !== -1) emailCol = eIdx;
          if (nIdx !== -1) nameCol = nIdx;
          if (rIdx !== -1) regCol = rIdx;
          if (sIdx !== -1) statusCol = sIdx;
        }
      }

      const freshList: RegisteredUser[] = [];
      const seen = new Set<string>();

      for (let i = startIndex; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (!row || row.length === 0) continue;

        let rowEmail = '';
        let rowName = '';
        let rowRegAt = '';
        let rowStatus = 'Approved';

        if (emailCol !== -1 && nameCol !== -1) {
          rowEmail = row[emailCol] ? String(row[emailCol]).trim() : '';
          rowName = row[nameCol] ? String(row[nameCol]).trim() : '';
          rowRegAt = row[regCol] ? String(row[regCol]).trim() : '';
          rowStatus = row[statusCol] ? String(row[statusCol]).trim() : 'Approved';
        } else {
          // Detect per-row: column 2 usually email, column 1 name, column 0 timestamp
          if (row[2] && String(row[2]).includes('@')) {
            rowEmail = String(row[2]).trim();
            rowName = row[1] ? String(row[1]).trim() : '';
            rowRegAt = row[0] ? String(row[0]).trim() : '';
            rowStatus = row[3] ? String(row[3]).trim() : 'Approved';
          } else if (row[1] && String(row[1]).includes('@')) {
            rowEmail = String(row[1]).trim();
            rowName = row[2] ? String(row[2]).trim() : '';
            rowRegAt = row[0] ? String(row[0]).trim() : '';
            rowStatus = row[3] ? String(row[3]).trim() : 'Approved';
          } else {
            // Fallback default
            rowEmail = row[2] ? String(row[2]).trim() : '';
            rowName = row[1] ? String(row[1]).trim() : '';
            rowRegAt = row[0] ? String(row[0]).trim() : '';
            rowStatus = row[3] ? String(row[3]).trim() : 'Approved';
          }
        }

        if (!rowEmail || !rowName) continue;

        // Filter out explicitly deactivated or removed users
        const normStatus = rowStatus.toLowerCase();
        if (normStatus === 'inactive' || normStatus === 'deleted' || normStatus === 'removed' || normStatus === 'rejected' || normStatus === 'revoked') {
          continue;
        }

        const dedupKey = `${normalizeName(rowName)}::${normalizeEmail(rowEmail)}`;
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);

        freshList.push({
          name: rowName,
          email: rowEmail,
          registeredAt: rowRegAt || formatSGT(Date.now()),
          status: rowStatus || 'Approved'
        });
      }

      // Update in-memory list if valid rows or if sheet is explicitly empty
      if (freshList.length > 0 || rawRows.length === 0) {
        syncedRegisteredUsersList = freshList;
        lastUserSyncTime = Date.now();
        console.log(`[Sync] Loaded ${syncedRegisteredUsersList.length} active registered users from Google Sheet`);
        try {
          fs.writeFileSync(usersCachePath, JSON.stringify(syncedRegisteredUsersList));
        } catch (e) {}
      }
    } catch (err: any) {
      if (err?.name === 'TimeoutError' || err?.message?.includes('timeout') || err?.message?.includes('aborted')) {
        console.warn(`[Sync] Google Apps Script sync timed out after 25s. Serving ${syncedRegisteredUsersList.length} registered users from cache.`);
      } else {
        console.warn('[Sync] Non-fatal issue syncing users from sheet:', err?.message || err);
      }
    } finally {
      userSyncPromise = null;
    }
  })();

  return userSyncPromise;
}

async function isUserRegistered(name: string, email: string): Promise<{ registered: boolean; user?: RegisteredUser }> {
  if (!name || !email) return { registered: false };
  
  let match = matchRegisteredUser(name, email);
  if (match.matched) {
    return { registered: true, user: match.user };
  }

  // If not found in cache and last sync was more than 5s ago, sync
  if (Date.now() - lastUserSyncTime > 5000) {
    await syncUsersFromSheet(false);
    match = matchRegisteredUser(name, email);
    if (match.matched) return { registered: true, user: match.user };
  }

  // Force sync from Google Sheet if still not found
  if (Date.now() - lastUserSyncTime > 2000) {
    await syncUsersFromSheet(true);
    match = matchRegisteredUser(name, email);
    if (match.matched) return { registered: true, user: match.user };
  }

  return { registered: false };
}

function getTodayDateSGT(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Singapore',
    day: '2-digit', month: 'short', year: 'numeric'
  }).formatToParts(new Date());
  const p: any = {};
  for (const part of parts) p[part.type] = part.value;
  return `${p.day} ${p.month} ${p.year}`;
}

function getTodayISO_SGT(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

function isLogFromToday(timeStr: string): boolean {
  if (!timeStr) return false;
  const str = String(timeStr).trim();
  const now = new Date();

  // Singapore timezone date parts
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Singapore',
    day: '2-digit', month: 'short', year: 'numeric'
  }).formatToParts(now);
  const p: any = {};
  for (const part of parts) p[part.type] = part.value;

  const sgtDay2 = `${p.day} ${p.month} ${p.year}`; // e.g. "27 Sep 2026"
  const sgtDay1 = `${parseInt(p.day, 10)} ${p.month} ${p.year}`; // e.g. "7 Sep 2026"
  const isoDay = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now); // e.g. "2026-09-27"

  if (str.includes(sgtDay2) || str.includes(sgtDay1) || str.includes(isoDay)) return true;

  try {
    const cleanStr = str.replace('|', ' ').replace(/\s+/g, ' ');
    const d = new Date(cleanStr);
    if (!isNaN(d.getTime())) {
      const dParts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Singapore',
        day: '2-digit', month: 'short', year: 'numeric'
      }).formatToParts(d);
      const dp: any = {};
      for (const part of dParts) dp[part.type] = part.value;
      return `${dp.day} ${dp.month} ${dp.year}` === sgtDay2;
    }
  } catch (e) {}
  return false;
}

async function getAllActiveLogs(force = false): Promise<string[][]> {
  const now = Date.now();
  if (!force && syncedLogsCache.length > 0 && (now - lastLogsSyncTime < 10000)) {
    return syncedLogsCache;
  }
  if (logsSyncPromise) return logsSyncPromise;
  if (!currentScriptUrl) return syncedLogsCache;

  logsSyncPromise = (async () => {
    try {
      const url = `${currentScriptUrl}?type=logs${currentSheetId ? `&sheetId=${encodeURIComponent(currentSheetId)}` : ''}`;
      const response = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(25000)
      });
      if (!response.ok) {
        console.warn('[Logs] Google Apps Script returned status:', response.status);
        return syncedLogsCache;
      }
      const data = await response.json();
      const rawLogs: string[][] = data.data || [];
      if (!Array.isArray(rawLogs)) return syncedLogsCache;

      const filtered = rawLogs.filter(row => {
        if (!row || row.length < 3) return false;
        const time = row[0] || '';
        const email = row[2] || '';
        const action = row[3] || '';
        const sig = makeLogSignature(time, email, action);
        return !deletedLogSignatures.has(sig);
      });

      if (filtered.length > 0 || rawLogs.length === 0) {
        syncedLogsCache = filtered;
        lastLogsSyncTime = Date.now();
        saveLogsCache();
      }
      return syncedLogsCache;
    } catch (e: any) {
      if (e?.name === 'TimeoutError' || e?.message?.includes('timeout') || e?.message?.includes('aborted')) {
        console.warn(`[Logs] Google Apps Script sync timed out after 25s. Serving ${syncedLogsCache.length} logs from cache.`);
      } else {
        console.warn('[Logs] Non-fatal issue syncing logs from sheet:', e?.message || e);
      }
      return syncedLogsCache;
    } finally {
      logsSyncPromise = null;
    }
  })();

  return logsSyncPromise;
}

async function getUserTodayAttendanceStatus(name: string, email: string): Promise<{
  hasClockedInToday: boolean;
  currentStatus: 'NOT_CLOCKED_IN' | 'CLOCKED_IN' | 'CLOCKED_OUT';
  lastActionToday: string | null;
  lastActionTime: string | null;
  allowedAction: 'Clock In' | 'Clock Out';
}> {
  const allLogs = await getAllActiveLogs(false);
  const normEmail = normalizeEmail(email);
  const normName = normalizeName(name);

  // In Google Sheets, rows are appended from top to bottom (row 0 is oldest, row N-1 is newest).
  // When iterating from the end to the beginning (reverse order), the first matching row from today
  // is the most recent action for today.
  for (let i = allLogs.length - 1; i >= 0; i--) {
    const row = allLogs[i];
    if (!row || row.length < 4) continue;
    const logTime = row[0] || '';
    const logName = row[1] || '';
    const logEmail = row[2] || '';
    const logAction = row[3] || '';

    const matchUser = checkUserExactMatch({ name: logName, email: logEmail, registeredAt: '', status: '' }, name, email) ||
      (normEmail && normalizeEmail(logEmail) === normEmail) ||
      (normName && normalizeName(logName) === normName);

    if (matchUser && isLogFromToday(logTime)) {
      if (logAction.toLowerCase().includes('clock in')) {
        return {
          hasClockedInToday: true,
          currentStatus: 'CLOCKED_IN',
          lastActionToday: 'Clock In',
          lastActionTime: logTime,
          allowedAction: 'Clock Out'
        };
      } else if (logAction.toLowerCase().includes('clock out')) {
        return {
          hasClockedInToday: true,
          currentStatus: 'CLOCKED_OUT',
          lastActionToday: 'Clock Out',
          lastActionTime: logTime,
          allowedAction: 'Clock In'
        };
      }
    }
  }

  return {
    hasClockedInToday: false,
    currentStatus: 'NOT_CLOCKED_IN',
    lastActionToday: null,
    lastActionTime: null,
    allowedAction: 'Clock In'
  };
}

async function startServer() {
  const app = express();
  // AI Studio reverse proxy forwards traffic to port 3000
  const PORT = 3000;

  // Background initialization: sync active sheet ID and users without blocking port 3000 binding
  (async () => {
    if (currentScriptUrl) {
      try {
        console.log('Fetching active sheet ID from Google Apps Script in background...');
        const response = await fetch(currentScriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'getActiveSheet' }),
          signal: AbortSignal.timeout(15000)
        });
        const data = await response.json();
        if (data.success && data.sheetId) {
          currentSheetId = data.sheetId;
          saveConfig(currentSheetId);
          console.log('Synchronized active sheet ID from Google Apps Script:', currentSheetId);
        }
      } catch (e: any) {
        console.warn('Background sync of active sheet ID completed or skipped:', e?.message || e);
      }
    }

    // Pre-load registered users and scan logs from Google Sheet on startup in background
    syncUsersFromSheet(false).catch(e => console.warn('Initial user sync note:', e?.message || e));
    getAllActiveLogs(false).catch(e => console.warn('Initial logs sync note:', e?.message || e));
  })();

  // Periodic background refresh every 20 seconds
  setInterval(() => {
    syncUsersFromSheet(false).catch(() => {});
    getAllActiveLogs(false).catch(() => {});
  }, 20000);

  app.use(express.json());

  // Prevent browser/proxy caching on API responses
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    next();
  });

const ADMIN_TOKEN = 'admin-token-123';
function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  if (token !== ADMIN_TOKEN) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

app.use('/api/admin', requireAdmin);
app.use('/api/settings', requireAdmin);
app.use('/api/events', requireAdmin);
app.use('/api/approve-registration', requireAdmin);


  app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === process.env.ADMIN_PASSWORD) {
      res.json({ success: true, token: 'admin-token-123' }); // Basic token for this app
    } else {
      res.status(401).json({ error: 'Invalid password' });
    }
  });

  app.get('/api/settings', (req, res) => {
    res.json({ 
      scriptUrl: currentScriptUrl,
      sheetId: currentSheetId
    });
  });

  app.get('/api/settings/search-sheets', async (req, res) => {
    if (!currentScriptUrl) return res.status(400).json({ error: 'No Apps Script URL configured' });
    try {
      const response = await fetch(currentScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'searchSheets', query: req.query.q || '' }),
        signal: AbortSignal.timeout(20000)
      });
      const data = await response.json();
      if (data.success) {
        res.json({ sheets: data.sheets || [] });
      } else {
        res.status(500).json({ error: data.error || 'Failed to search sheets' });
      }
    } catch (e) {
      res.status(500).json({ error: 'Failed to communicate with Apps Script' });
    }
  });

  app.post('/api/settings/create-sheet', async (req, res) => {
    if (!currentScriptUrl) return res.status(400).json({ error: 'No Apps Script URL configured' });
    try {
      const response = await fetch(currentScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'createSheet' }),
        signal: AbortSignal.timeout(25000)
      });
      const data = await response.json();
      if (data.success) {
        saveConfig(data.sheetId);
        currentSheetId = data.sheetId;
        await syncUsersFromSheet(true);
        res.json({ success: true, sheetId: data.sheetId, url: data.url });
      } else {
        res.status(500).json({ error: data.error || 'Failed to create sheet' });
      }
    } catch (e) {
      res.status(500).json({ error: 'Failed to communicate with Apps Script' });
    }
  });

  app.post('/api/settings/verify-sheet', async (req, res) => {
    const { sheetId } = req.body;
    if (!currentScriptUrl || !sheetId) return res.status(400).json({ error: 'Missing Script URL or Sheet ID' });
    try {
      const response = await fetch(currentScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verifySheet', sheetId }),
        signal: AbortSignal.timeout(25000)
      });
      const data = await response.json();
      if (data.success) {
        saveConfig(data.sheetId);
        currentSheetId = data.sheetId;
        await syncUsersFromSheet(true);
        res.json({ success: true, sheetId: data.sheetId, name: data.name });
      } else {
        res.status(500).json({ error: data.error || 'Failed to verify sheet (check ID and permissions)' });
      }
    } catch (e) {
      res.status(500).json({ error: 'Failed to communicate with Apps Script' });
    }
  });

  app.get('/api/attendee-status', async (req, res) => {
    const email = req.query.email as string;
    const name = req.query.name as string;
    if (!email || !name) {
      return res.json({ registered: false });
    }
    const check = await isUserRegistered(name, email);
    if (!check.registered) {
      return res.json({ registered: false });
    }
    const resolvedName = check.user ? check.user.name : name;
    const resolvedEmail = check.user ? check.user.email : email;
    const todayStatus = await getUserTodayAttendanceStatus(resolvedName, resolvedEmail);

    res.json({
      registered: true,
      name: resolvedName,
      email: resolvedEmail,
      ...todayStatus
    });
  });

  app.post('/api/verify-attendee', async (req, res) => {
    const { name, email } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required.' });
    }
    const check = await isUserRegistered(name.trim(), email.trim());
    if (check.registered && check.user) {
      const todayStatus = await getUserTodayAttendanceStatus(check.user.name, check.user.email);
      return res.json({
        success: true,
        registered: true,
        user: {
          name: check.user.name,
          email: check.user.email
        },
        ...todayStatus
      });
    }
    return res.json({
      success: true,
      registered: false,
      isNewUser: true,
      error: 'Name and email do not match registered records. New volunteers can register below.',
      code: 'UNREGISTERED'
    });
  });

  app.post('/api/request-registration', async (req, res) => {
    const { name, email, sessionId } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required.' });
    }
    const cleanName = (name || '').trim();
    const cleanEmail = (email || '').trim();

    // Check if user is already registered in Google Sheet
    const check = await isUserRegistered(cleanName, cleanEmail);
    if (check.registered && check.user) {
      return res.json({
        success: true,
        status: 'approved',
        alreadyRegistered: true,
        user: check.user
      });
    }

    const regId = crypto.randomUUID();
    const key = cleanEmail.toLowerCase();
    const existing = pendingApprovals.get(key) ||
      Array.from(pendingApprovals.values()).find(p => normalizeEmail(p.email) === normalizeEmail(cleanEmail));

    if (existing) {
      existing.name = cleanName;
      existing.email = cleanEmail;
      existing.status = 'pending';
      existing.timestamp = Date.now();
    } else {
      pendingApprovals.set(key, {
        id: regId,
        name: cleanName,
        email: cleanEmail,
        status: 'pending',
        timestamp: Date.now()
      });
    }

    if (sessionId) {
      if (!kioskRegistrations.has(sessionId)) {
        kioskRegistrations.set(sessionId, []);
      }
      kioskRegistrations.get(sessionId)!.push({
        id: regId,
        name: cleanName,
        email: cleanEmail,
        registeredAt: Date.now()
      });
    }

    console.log(`[Registration Request] ${cleanName} (${cleanEmail}) queued for approval. Session: ${sessionId || 'none'}`);
    res.json({ success: true, status: 'pending' });
  });

  app.get('/api/check-registration-status', async (req, res) => {
    const email = (req.query.email as string || '').trim();
    const name = (req.query.name as string || '').trim();
    if (!email) {
      return res.json({ status: 'none' });
    }

    // Check if registered in Google Sheet or synchronized list
    const check = await isUserRegistered(name, email);
    if (check.registered && check.user) {
      pendingApprovals.delete(email.toLowerCase());
      return res.json({ status: 'approved', user: check.user });
    }

    const pending = pendingApprovals.get(email.toLowerCase()) ||
      Array.from(pendingApprovals.values()).find(p => normalizeEmail(p.email) === normalizeEmail(email));

    if (pending) {
      if (pending.status === 'approved') {
        return res.json({ status: 'approved', user: { name: pending.name, email: pending.email } });
      }
      if (pending.status === 'rejected') {
        return res.json({ status: 'rejected' });
      }
      return res.json({ status: 'pending' });
    }

    return res.json({ status: 'none' });
  });

  app.post('/api/approve-registration', async (req, res) => {
    const { email, action, sessionId, name } = req.body;
    if (!email || !action) {
      return res.status(400).json({ error: 'Missing email or action' });
    }

    const key = (email || '').trim().toLowerCase();
    let pending = pendingApprovals.get(key) ||
      Array.from(pendingApprovals.values()).find(p => normalizeEmail(p.email) === normalizeEmail(email));

    if (!pending && action === 'approve') {
      // Direct approval / manual registration from admin dashboard
      pending = {
        id: crypto.randomUUID(),
        name: (name || email.split('@')[0]).trim(),
        email: email.trim(),
        status: 'pending',
        timestamp: Date.now()
      };
      pendingApprovals.set(key, pending);
    }

    if (!pending) {
      return res.status(404).json({ error: 'Pending registration request not found' });
    }

    if (action === 'approve') {
      pending.status = 'approved';
      const regTime = formatSGT(Date.now());
      const approvedUser: RegisteredUser = {
        name: pending.name,
        email: pending.email,
        registeredAt: regTime,
        status: 'Approved'
      };

      // Add to syncedRegisteredUsersList immediately
      const existingIdx = syncedRegisteredUsersList.findIndex(
        u => normalizeEmail(u.email) === normalizeEmail(pending!.email)
      );
      if (existingIdx >= 0) {
        syncedRegisteredUsersList[existingIdx] = approvedUser;
      } else {
        syncedRegisteredUsersList.push(approvedUser);
      }

      // Persist to disk cache
      try {
        fs.writeFileSync(usersCachePath, JSON.stringify(syncedRegisteredUsersList));
      } catch (e) {}

      // Write row to Google Sheet Registrations tab
      appendToSheet('user', [
        regTime,
        approvedUser.name,
        approvedUser.email,
        'Approved'
      ]);

      if (sessionId && kioskEvents.has(sessionId)) {
        kioskEvents.get(sessionId)!.push({
          id: crypto.randomUUID(),
          name: approvedUser.name,
          email: approvedUser.email,
          action: 'Registered (Approved)',
          qrTimestamp: Date.now(),
          scanTimestamp: Date.now()
        });
      }

      console.log(`[Registration] Approved volunteer: ${approvedUser.name} (${approvedUser.email})`);
      return res.json({ success: true, status: 'approved', user: approvedUser });
    } else {
      pending.status = 'rejected';
      console.log(`[Registration] Declined volunteer: ${pending.name} (${pending.email})`);
      return res.json({ success: true, status: 'rejected' });
    }
  });
  
  app.get('/api/admin/logs', async (req, res) => {
    try {
      const isFresh = Date.now() - lastLogsSyncTime < 15000 && syncedLogsCache.length > 0;
      if (!isFresh) {
        if (syncedLogsCache.length === 0) {
          await getAllActiveLogs(true);
        } else {
          // Serve current cached logs instantly and refresh in the background
          getAllActiveLogs(false).catch(() => {});
        }
      }
      res.json({ logs: syncedLogsCache });
    } catch (e: any) {
      console.warn('[Logs] Handled error in logs endpoint, serving cached logs:', e?.message || e);
      res.json({ logs: syncedLogsCache });
    }
  });

  app.post('/api/admin/logs/delete', async (req, res) => {
    const { timestamp, name, email, action, rowIndex } = req.body;
    if (!email && !name) {
      return res.status(400).json({ error: 'Missing log identifiers' });
    }

    const sig = makeLogSignature(timestamp, email, action);
    deletedLogSignatures.add(sig);
    saveDeletedLogs();

    // Call Google Apps Script in background to delete row from Google Sheet
    if (currentScriptUrl) {
      try {
        await fetch(currentScriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'deleteLog',
            sheetId: currentSheetId,
            timestamp,
            name,
            email,
            actionName: action,
            rowIndex
          }),
          signal: AbortSignal.timeout(20000)
        });
      } catch (err: any) {
        console.warn('Non-fatal note: notify Apps Script of log deletion:', err?.message || err);
      }
    }

    // Also remove from any active kioskEvents
    for (const [sId, events] of kioskEvents.entries()) {
      kioskEvents.set(
        sId,
        events.filter(e => !(normalizeEmail(e.email) === normalizeEmail(email) && e.action === action))
      );
    }

    // Invalidate local logs cache so deleted entry is removed immediately
    syncedLogsCache = syncedLogsCache.filter(row => {
      const s = makeLogSignature(row[0] || '', row[2] || '', row[3] || '');
      return !deletedLogSignatures.has(s);
    });
    saveLogsCache();

    res.json({ success: true, message: 'Log deleted successfully' });
  });

  app.post('/api/admin/manual-clock', async (req, res) => {
    const { name, email, action, customTime, date, hour, minute, period } = req.body;
    if (!name || !email || !action) {
      return res.status(400).json({ error: 'Name, email, and action are required' });
    }

    const cleanName = (name || '').trim();
    const cleanEmail = (email || '').trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanName || cleanName.length < 2) {
      return res.status(400).json({ error: 'A valid Volunteer Name (at least 2 characters) is required' });
    }
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      return res.status(400).json({ error: 'A valid Email Address is required' });
    }

    const cleanAction = action === 'Clock Out' ? 'Clock Out' : 'Clock In';
    
    let logTime = (customTime || '').trim();
    if (!logTime && (hour !== undefined && hour !== null && hour !== '')) {
      logTime = formatManualClockTime(date, hour, minute, period);
    }
    if (!logTime) {
      logTime = formatSGT(Date.now());
    }

    // Un-suppress if this signature was previously marked deleted
    const sig = makeLogSignature(logTime, cleanEmail, cleanAction);
    if (deletedLogSignatures.has(sig)) {
      deletedLogSignatures.delete(sig);
      saveDeletedLogs();
    }

    // Check if volunteer is registered; if not registered, auto-add to local cache
    const match = matchRegisteredUser(cleanName, cleanEmail);
    let resolvedName = cleanName;
    if (match.matched && match.user) {
      resolvedName = match.user.name;
    } else {
      const newUser: RegisteredUser = {
        name: cleanName,
        email: cleanEmail,
        registeredAt: logTime,
        status: 'Approved'
      };
      syncedRegisteredUsersList.push(newUser);
      try {
        fs.writeFileSync(usersCachePath, JSON.stringify(syncedRegisteredUsersList));
      } catch (e) {}
      appendToSheet('user', [logTime, cleanName, cleanEmail, 'Approved']);
    }

    const logEntry = [
      logTime,
      resolvedName,
      cleanEmail,
      cleanAction,
      'Manual (Admin Backup)'
    ];

    // Append log to Google Sheet
    await appendToSheet('log', logEntry);
    syncedLogsCache.push(logEntry);
    saveLogsCache();

    // Notify any active kiosk feeds
    for (const [sId, events] of kioskEvents.entries()) {
      events.push({
        id: crypto.randomUUID(),
        name: resolvedName,
        email: cleanEmail,
        action: `${cleanAction} (Admin Backup)`,
        qrTimestamp: Date.now(),
        scanTimestamp: Date.now()
      });
    }

    console.log(`[Manual Clock] ${cleanAction} recorded for ${resolvedName} (${cleanEmail}) at ${logTime}`);
    res.json({ success: true, log: logEntry });
  });

  app.get('/api/admin/users', async (req, res) => {
    try {
      const isFresh = Date.now() - lastUserSyncTime < 15000 && syncedRegisteredUsersList.length > 0;
      if (!isFresh) {
        if (syncedRegisteredUsersList.length === 0) {
          await syncUsersFromSheet(true);
        } else {
          syncUsersFromSheet(false).catch(() => {});
        }
      }
      res.json({ users: syncedRegisteredUsersList });
    } catch (e: any) {
      console.warn('[Users] Handled issue in users endpoint, serving cached registry:', e?.message || e);
      res.json({ users: syncedRegisteredUsersList });
    }
  });

  app.post('/api/verify', (req, res) => {
    const { sessionId, timestamp } = req.body;
    if (!sessionId || !timestamp) {
      return res.status(400).json({ error: 'Missing parameters' });
    }
    
    // Strict 15-second verification window
    const age = Date.now() - Number(timestamp);
    if (age > 15000 || age < -5000) { 
      return res.status(400).json({ error: 'QR Code expired. Please scan the kiosk screen again.' });
    }
    
    const scanToken = crypto.randomUUID();
    pendingScans.set(scanToken, { sessionId, expiresAt: Date.now() + 5 * 60000, qrTimestamp: Number(timestamp) });
    res.json({ scanToken });
  });

  app.post('/api/scan', async (req, res) => {
    const { scanToken, name, email, action } = req.body;
    
    if (!scanToken || !name || !action || !email) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    let check = await isUserRegistered(name, email);
    if (!check.registered) {
      await syncUsersFromSheet(true);
      check = await isUserRegistered(name, email);
    }

    if (!check.registered) {
      return res.status(403).json({ 
        error: 'Name and email must be an exact match with registered records in the Google Sheet. Only registered attendees can clock in or out.', 
        code: 'UNREGISTERED' 
      });
    }

    const resolvedName = check.user ? check.user.name : name;
    const resolvedEmail = check.user ? check.user.email : email;

    // Check if volunteer is already clocked in today and attempting duplicate Clock In
    const currentDayStatus = await getUserTodayAttendanceStatus(resolvedName, resolvedEmail);
    if (action === 'Clock In' && currentDayStatus.currentStatus === 'CLOCKED_IN') {
      return res.status(400).json({ 
        error: 'You have already clocked in for today. Please clock out instead.', 
        code: 'ALREADY_CLOCKED_IN',
        currentStatus: 'CLOCKED_IN'
      });
    }

    const pending = pendingScans.get(scanToken);
    if (!pending) {
      return res.status(400).json({ error: 'Session invalid or expired. Please rescan.' });
    }
    if (Date.now() > pending.expiresAt) {
      pendingScans.delete(scanToken);
      return res.status(400).json({ error: 'Session timed out. Please rescan.' });
    }

    const { sessionId, qrTimestamp } = pending;
    pendingScans.delete(scanToken);

    if (!kioskEvents.has(sessionId)) {
      kioskEvents.set(sessionId, []);
    }
    const events = kioskEvents.get(sessionId)!;
    
    const isDuplicate = events.some(e => normalizeEmail(e.email) === normalizeEmail(email) && (Date.now() - e.scanTimestamp) < 10000);
    
    if (!isDuplicate) {
      const ev = {
        id: crypto.randomUUID(),
        name: resolvedName,
        email: resolvedEmail,
        action,
        qrTimestamp,
        scanTimestamp: Date.now()
      };
      events.push(ev);
      const logRow = [
        formatSGT(ev.scanTimestamp),
        ev.name,
        ev.email,
        ev.action,
        `${sessionId}-${ev.qrTimestamp}`
      ];
      // Append to sheet in background
      appendToSheet('log', logRow);
      syncedLogsCache.push(logRow);
      saveLogsCache();
    }

    const updatedStatus = await getUserTodayAttendanceStatus(resolvedName, resolvedEmail);
    res.json({ success: true, ...updatedStatus });
  });

  app.get('/api/events', (req, res) => {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });
    const events = kioskEvents.get(sessionId) || [];
    kioskEvents.set(sessionId, []);
    
    const registrations = kioskRegistrations.get(sessionId) || [];
    kioskRegistrations.set(sessionId, []);
    
    const pendingList = Array.from(pendingApprovals.values()).filter(p => p.status === 'pending');

    res.json({ events, registrations, pendingApprovals: pendingList });
  });

  const hasDistBuild = fs.existsSync(path.join(process.cwd(), 'dist', 'index.html'));
  if (process.env.NODE_ENV !== 'production' || !hasDistBuild) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
      }
    }));
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
