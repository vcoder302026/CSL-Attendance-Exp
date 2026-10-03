import React, { useState, useEffect, useRef, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, User, ScanLine, Clock, Shield, ChevronRight, LogOut, Moon, Download, Plus, Search, CheckCircle2, LayoutDashboard, MonitorSmartphone, Settings, Eye, EyeOff, Home, UserPlus, AlertCircle, RefreshCw, Trash2, UserCheck, AlertTriangle, X, Check, Calendar } from 'lucide-react';
import { cn } from './lib/utils';

// Types
type ScanLog = {
  id: string;
  name: string;
  action: string;
  qrTimestamp: number;
  scanTimestamp: number;
};

function formatTimestamp(dateValue: string | number) {
  if (!dateValue && dateValue !== 0) return '';
  
  // If it is already in format "DD Mon YYYY | HH:MM AM/PM"
  if (typeof dateValue === 'string' && /^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\s*\|\s*\d{1,2}:\d{2}\s*(AM|PM)$/i.test(dateValue.trim())) {
    return dateValue.trim();
  }

  // If numeric or string of digits (epoch timestamp in ms or s)
  if (typeof dateValue === 'number' || (/^\d+$/.test(String(dateValue).trim()) && String(dateValue).trim().length >= 10)) {
    let num = Number(dateValue);
    if (num < 1e11) num *= 1000;
    const date = new Date(num);
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Singapore',
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    }).formatToParts(date);
    const p: Record<string, string> = {};
    for (const part of parts) p[part.type] = part.value;
    return `${p.day} ${p.month} ${p.year} | ${p.hour}:${p.minute} ${p.dayPeriod}`;
  }

  const str = String(dateValue).trim();

  // If ISO string like "2026-09-12T17:14:00.000Z" from Google Sheets / Apps Script:
  // The wall-clock date & time in the ISO string represents the actual recorded GMT+8 time in the sheet.
  // Using UTC values preserves the exact wall-clock time from the sheet without adding an extra offset.
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]00:?00)?$/i);
  if (isoMatch) {
    const [, year, month, day, hours, minutes] = isoMatch;
    const d = new Date(Date.UTC(+year, +month - 1, +day, +hours, +minutes));
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    }).formatToParts(d);
    const p: Record<string, string> = {};
    for (const part of parts) p[part.type] = part.value;
    return `${p.day} ${p.month} ${p.year} | ${p.hour}:${p.minute} ${p.dayPeriod}`;
  }

  // For any other date format, parse and ensure Asia/Singapore (GMT+8)
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Singapore',
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    }).formatToParts(parsed);
    const p: Record<string, string> = {};
    for (const part of parts) p[part.type] = part.value;
    return `${p.day} ${p.month} ${p.year} | ${p.hour}:${p.minute} ${p.dayPeriod}`;
  }

  return str;
}

function formatDate(dateValue: string | number) {
  if (!dateValue && dateValue !== 0) return '';
  
  if (typeof dateValue === 'number' || (/^\d+$/.test(String(dateValue).trim()) && String(dateValue).trim().length >= 10)) {
    let num = Number(dateValue);
    if (num < 1e11) num *= 1000;
    const date = new Date(num);
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Singapore',
      day: '2-digit', month: 'short', year: 'numeric'
    }).formatToParts(date);
    const p: Record<string, string> = {};
    for (const part of parts) p[part.type] = part.value;
    return `${p.day} ${p.month} ${p.year}`;
  }

  const str = String(dateValue).trim();
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const d = new Date(Date.UTC(+year, +month - 1, +day));
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      day: '2-digit', month: 'short', year: 'numeric'
    }).formatToParts(d);
    const p: Record<string, string> = {};
    for (const part of parts) p[part.type] = part.value;
    return `${p.day} ${p.month} ${p.year}`;
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Singapore',
      day: '2-digit', month: 'short', year: 'numeric'
    }).formatToParts(parsed);
    const p: Record<string, string> = {};
    for (const part of parts) p[part.type] = part.value;
    return `${p.day} ${p.month} ${p.year}`;
  }

  return str;
}

function getNowSGT() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(now);
  const p: Record<string, string> = {};
  for (const part of parts) p[part.type] = part.value;
  
  const hNum = parseInt(p.hour, 10);
  const period: 'AM' | 'PM' = hNum >= 12 ? 'PM' : 'AM';
  const h12 = hNum === 0 ? 12 : hNum > 12 ? hNum - 12 : hNum;

  return {
    date: `${p.year}-${p.month}-${p.day}`,
    hour: String(h12).padStart(2, '0'),
    minute: String(p.minute).padStart(2, '0'),
    period,
    time24: `${String(hNum).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`
  };
}

function formatManualDateTime(dateStr: string, hourStr: string, minuteStr: string, period: 'AM' | 'PM') {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayStr = String(d).padStart(2, '0');
  const monStr = monthNames[m - 1] || 'Jan';
  const yearStr = String(y);

  const cleanH = String(parseInt(hourStr, 10) || 12).padStart(2, '0');
  const cleanM = String(parseInt(minuteStr, 10) || 0).padStart(2, '0');

  return `${dayStr} ${monStr} ${yearStr} | ${cleanH}:${cleanM} ${period}`;
}

function getFuzzyVolunteerSuggestions(query: string, users: { name: string; email: string }[]) {
  if (!query || !query.trim()) {
    // When volunteer name field is blank, show all volunteers sorted alphabetically (ascending)
    return [...users].sort((a, b) => {
      const nameCompare = (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
      if (nameCompare !== 0) return nameCompare;
      return (a.email || '').localeCompare(b.email || '', undefined, { sensitivity: 'base' });
    });
  }
  const q = query.trim().toLowerCase();
  
  const scored = users
    .map(user => {
      const name = (user.name || '').toLowerCase().trim();
      const email = (user.email || '').toLowerCase().trim();
      let score = 0;

      if (name === q) {
        score = 1000;
      } else if (name.startsWith(q)) {
        score = 800 + (100 - Math.min(name.length, 100));
      } else {
        const words = name.split(/\s+/).filter(Boolean);
        const qWords = q.split(/\s+/).filter(Boolean);
        
        // Every word in query matches the start of some word in name
        if (qWords.length > 0 && qWords.every(qw => words.some(w => w.startsWith(qw)))) {
          score = 650;
        } else if (words.some(w => w.startsWith(q))) {
          score = 600;
        } else if (name.includes(q)) {
          score = 500;
        } else {
          // Acronym check (e.g., "JD" for "John Doe")
          const acronym = words.map(w => w[0]).join('');
          if (acronym.startsWith(q)) {
            score = 450;
          } else {
            // Subsequence match
            let qIdx = 0;
            let matchCount = 0;
            for (let i = 0; i < name.length && qIdx < q.length; i++) {
              if (name[i] === q[qIdx]) {
                matchCount++;
                qIdx++;
              }
            }
            if (qIdx === q.length) {
              score = 300 + matchCount;
            } else if (email.includes(q)) {
              score = 250;
            } else {
              // Typo tolerance (Levenshtein / char differences for word parts)
              const hasTypoMatch = words.some(w => {
                if (Math.abs(w.length - q.length) > 2) return false;
                let diffs = 0;
                const minLen = Math.min(w.length, q.length);
                diffs += Math.abs(w.length - q.length);
                for (let i = 0; i < minLen; i++) {
                  if (w[i] !== q[i]) diffs++;
                }
                return diffs <= 2;
              });
              if (hasTypoMatch && q.length >= 3) {
                score = 200;
              }
            }
          }
        }
      }

      return { user, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 8).map(item => item.user);
}

// ----------------------------------------------------------------------
// FLOATING CONTROLS
// ----------------------------------------------------------------------
function FloatingControls({ isDark, toggleDark, onOpenAdmin, showAdminBtn, onLogout, onHome, className }: { isDark?: boolean, toggleDark: () => void, onOpenAdmin?: () => void, showAdminBtn?: boolean, onLogout?: () => void, onHome?: () => void, className?: string }) {
  return (
    <div className={className || "fixed top-4 right-4 z-[100] flex items-center gap-2"}>
      {showAdminBtn && onOpenAdmin && (
        <button 
          onClick={onOpenAdmin}
          className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white transition-all hover:scale-110 active:scale-95"
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      )}
      <button 
        onClick={toggleDark}
        className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white transition-all hover:scale-110 active:scale-95 text-xl"
        title="Toggle Dark Mode"
      >
        🌗
      </button>
      {onHome && (
        <button 
          onClick={onHome}
          className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white transition-all hover:scale-110 active:scale-95"
          title="Home"
        >
          <Home className="w-5 h-5" />
        </button>
      )}
      {onLogout && !onHome && (
        <button 
          onClick={onLogout}
          className="w-10 h-10 flex items-center justify-center text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-all hover:scale-110 active:scale-95"
          title="Sign Out"
        >
          <LogOut className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// LOGIN VIEW
// ----------------------------------------------------------------------
function LoginView({ onLogin }: { onLogin: (token: string) => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      onLogin(data.token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[100dvh] max-h-[100dvh] overflow-hidden flex items-center justify-center bg-slate-50 dark:bg-black p-4 transition-colors">
      <div className="w-full max-w-md bg-white dark:bg-neutral-950 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-neutral-900">
        <div className="flex flex-col items-center mb-6 sm:mb-8">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-indigo-100 dark:bg-indigo-900/50 rounded-2xl flex items-center justify-center mb-3 sm:mb-4">
            <Shield className="w-7 h-7 sm:w-8 sm:h-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">CSL Attendance</h1>
          <p className="text-slate-500 dark:text-neutral-400 mt-1 sm:mt-2 text-center text-xs sm:text-sm">Enter admin password to access the system.</p>
        </div>
        
        {error && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 rounded-xl text-xs sm:text-sm font-medium">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <div>
            <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-neutral-300 mb-1.5 sm:mb-2">Admin Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 sm:py-3 pr-12 rounded-xl border border-slate-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-slate-900 dark:text-white focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm sm:text-base"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 sm:py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors shadow-lg hover:shadow-xl active:scale-[0.98] disabled:opacity-50 flex items-center justify-center text-sm sm:text-base"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// ROLE SELECTION VIEW
// ----------------------------------------------------------------------
function RoleSelectionView({ onSelect }: { onSelect: (role: 'KIOSK' | 'ADMIN') => void }) {
  return (
    <div className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-slate-50 dark:bg-black flex flex-col items-center justify-center p-4 transition-colors">
      <div className="w-full max-w-2xl bg-white dark:bg-neutral-950 rounded-3xl p-6 sm:p-8 md:p-12 shadow-2xl border border-slate-200 dark:border-neutral-900 relative">
        <div className="mb-6 sm:mb-10 text-center">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mb-1.5 sm:mb-2">Choose Mode</h1>
          <p className="text-slate-500 dark:text-neutral-400 text-xs sm:text-sm">Select how you want to use the application.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <button
            onClick={() => onSelect('KIOSK')}
            className="group relative flex flex-col items-center p-6 sm:p-8 bg-slate-50 dark:bg-neutral-900 rounded-2xl border border-slate-200 dark:border-neutral-800 hover:border-indigo-500 hover:shadow-[0_0_30px_rgba(99,102,241,0.1)] dark:hover:shadow-[0_0_30px_rgba(99,102,241,0.2)] transition-all active:scale-[0.98]"
          >
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white dark:bg-neutral-950 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform shadow-sm group-hover:bg-indigo-50 dark:group-hover:bg-indigo-500/20">
              <MonitorSmartphone className="w-7 h-7 sm:w-8 sm:h-8 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-1.5 sm:mb-2">CSL Attendance Kiosk</h2>
            <p className="text-slate-500 dark:text-neutral-400 text-xs sm:text-sm text-center">Display the dynamic QR code for attendees to scan and clock in.</p>
          </button>
          
          <button
            onClick={() => onSelect('ADMIN')}
            className="group relative flex flex-col items-center p-6 sm:p-8 bg-slate-50 dark:bg-neutral-900 rounded-2xl border border-slate-200 dark:border-neutral-800 hover:border-emerald-500 hover:shadow-[0_0_30px_rgba(16,185,129,0.1)] dark:hover:shadow-[0_0_30px_rgba(16,185,129,0.2)] transition-all active:scale-[0.98]"
          >
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white dark:bg-neutral-950 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform shadow-sm group-hover:bg-emerald-50 dark:group-hover:bg-emerald-500/20">
              <LayoutDashboard className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-1.5 sm:mb-2">Admin Dashboard</h2>
            <p className="text-slate-500 dark:text-neutral-400 text-xs sm:text-sm text-center">Manage users, view logs, and configure Google Sheets integration.</p>
          </button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// ADMIN DASHBOARD COMPONENT
// ----------------------------------------------------------------------
function AdminDashboard({ onExit, adminToken, isOverlay = false, isDark, toggleDark }: { onExit: () => void, adminToken: string, isOverlay?: boolean, isDark?: boolean, toggleDark?: () => void }) {
  const [activeTab, setActiveTab] = useState<'LOGS' | 'USERS' | 'SETTINGS'>('LOGS');
  
  const [sheetId, setSheetId] = useState('');
  const [sheetIdMessage, setSheetIdMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);
  const [isVerifyingSheet, setIsVerifyingSheet] = useState(false);
  
  const [sheetSearchQuery, setSheetSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearchingSheets, setIsSearchingSheets] = useState(false);
  const [manualSheetUrl, setManualSheetUrl] = useState('');

  const [registeredUsers, setRegisteredUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [addUserMessage, setAddUserMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const [logs, setLogs] = useState<string[][]>(() => {
    try {
      const saved = localStorage.getItem('csl_admin_logs_cache');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('csl_admin_logs_cache');
      return !(saved && JSON.parse(saved).length > 0);
    } catch (e) {
      return true;
    }
  });
  const [searchQuery, setSearchQuery] = useState('');

  // Log Deletion with Confirmation Modal
  const [logToDelete, setLogToDelete] = useState<{ log: string[]; index: number } | null>(null);
  const [isDeletingLog, setIsDeletingLog] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteSuccess, setDeleteSuccess] = useState('');

  // Manual Clock In / Out (Admin Backup)
  const [showManualClockModal, setShowManualClockModal] = useState(false);
  const [manualClockName, setManualClockName] = useState('');
  const [manualClockEmail, setManualClockEmail] = useState('');
  const [manualClockAction, setManualClockAction] = useState<'Clock In' | 'Clock Out'>('Clock In');
  const [isSubmittingManualClock, setIsSubmittingManualClock] = useState(false);
  const [manualClockStatus, setManualClockStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fuzzy search & volunteer validation states
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [nameSuggestionHighlightIndex, setNameSuggestionHighlightIndex] = useState(-1);
  const [selectedVolunteer, setSelectedVolunteer] = useState<{ name: string; email: string } | null>(null);
  const [nameTouched, setNameTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Compute fuzzy suggestions from registered volunteers
  const fuzzySuggestions = useMemo(() => {
    return getFuzzyVolunteerSuggestions(manualClockName, registeredUsers);
  }, [manualClockName, registeredUsers]);

  // Validation: Volunteer Name must be at least 2 characters, Email must be valid email format
  const isValidName = manualClockName.trim().length >= 2;
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(manualClockEmail.trim());
  const isFormValid = isValidName && isValidEmail;

  const handleSelectVolunteer = (user: { name: string; email: string }) => {
    setManualClockName(user.name);
    setManualClockEmail(user.email); // Auto-populate associated email address!
    setSelectedVolunteer(user);
    setShowNameSuggestions(false);
    setNameSuggestionHighlightIndex(-1);
    setNameTouched(true);
    setEmailTouched(true);
    setManualClockStatus(null);
  };

  const handleNameInputChange = (val: string) => {
    setManualClockName(val);
    setShowNameSuggestions(true);
    setNameSuggestionHighlightIndex(-1);
    setNameTouched(true);

    // If typed name matches an existing registered volunteer exactly, auto-populate email
    const exactMatch = registeredUsers.find(
      u => u.name.trim().toLowerCase() === val.trim().toLowerCase()
    );
    if (exactMatch) {
      setManualClockEmail(exactMatch.email);
      setSelectedVolunteer(exactMatch);
    } else if (selectedVolunteer && val.trim().toLowerCase() !== selectedVolunteer.name.toLowerCase()) {
      setSelectedVolunteer(null);
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showNameSuggestions || fuzzySuggestions.length === 0) {
      if (e.key === 'ArrowDown') {
        setShowNameSuggestions(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setNameSuggestionHighlightIndex(prev => 
        prev < fuzzySuggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setNameSuggestionHighlightIndex(prev => 
        prev > 0 ? prev - 1 : fuzzySuggestions.length - 1
      );
    } else if (e.key === 'Enter') {
      if (nameSuggestionHighlightIndex >= 0 && nameSuggestionHighlightIndex < fuzzySuggestions.length) {
        e.preventDefault();
        handleSelectVolunteer(fuzzySuggestions[nameSuggestionHighlightIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowNameSuggestions(false);
    }
  };

  // Manual Clock time & date states
  const [manualClockUseCustomTime, setManualClockUseCustomTime] = useState(false);
  const [manualClockDate, setManualClockDate] = useState(() => getNowSGT().date);
  const [manualClockHour, setManualClockHour] = useState(() => getNowSGT().hour);
  const [manualClockMinute, setManualClockMinute] = useState(() => getNowSGT().minute);
  const [manualClockPeriod, setManualClockPeriod] = useState<'AM' | 'PM'>(() => getNowSGT().period);

  const resetManualClockTimeToNow = () => {
    const sgt = getNowSGT();
    setManualClockDate(sgt.date);
    setManualClockHour(sgt.hour);
    setManualClockMinute(sgt.minute);
    setManualClockPeriod(sgt.period);
  };

  const adjustManualClockMinutes = (offsetMinutes: number) => {
    setManualClockUseCustomTime(true);
    let h = parseInt(manualClockHour, 10) || 12;
    if (manualClockPeriod === 'PM' && h < 12) h += 12;
    if (manualClockPeriod === 'AM' && h === 12) h = 0;
    const m = parseInt(manualClockMinute, 10) || 0;
    
    const [y, mon, d] = (manualClockDate || getNowSGT().date).split('-').map(Number);
    const dateObj = new Date(y, mon - 1, d, h, m + offsetMinutes, 0);

    const newH = dateObj.getHours();
    const newM = dateObj.getMinutes();
    const period: 'AM' | 'PM' = newH >= 12 ? 'PM' : 'AM';
    const h12 = newH === 0 ? 12 : newH > 12 ? newH - 12 : newH;

    const yStr = dateObj.getFullYear();
    const mStr = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dStr = String(dateObj.getDate()).padStart(2, '0');

    setManualClockDate(`${yStr}-${mStr}-${dStr}`);
    setManualClockHour(String(h12).padStart(2, '0'));
    setManualClockMinute(String(newM).padStart(2, '0'));
    setManualClockPeriod(period);
  };

  const handleConfirmDeleteLog = async () => {
    if (!logToDelete) return;
    setIsDeletingLog(true);
    setDeleteError('');
    try {
      const res = await fetch('/api/admin/logs/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          timestamp: logToDelete.log[0],
          name: logToDelete.log[1],
          email: logToDelete.log[2],
          action: logToDelete.log[3],
          rowIndex: logToDelete.index
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete log record');

      // Instantly remove from logs state
      setLogs(prev => prev.filter((_, i) => i !== logToDelete.index));
      setLogToDelete(null);
      setDeleteSuccess('Attendance log record deleted successfully.');
      setTimeout(() => setDeleteSuccess(''), 4000);
    } catch (err: any) {
      setDeleteError(err.message || 'Error deleting log record');
    } finally {
      setIsDeletingLog(false);
    }
  };

  const handleManualClockSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setNameTouched(true);
    setEmailTouched(true);

    if (!isValidName || !isValidEmail) {
      setManualClockStatus({
        type: 'error',
        text: !isValidName 
          ? 'Volunteer Name must be at least 2 characters.' 
          : 'Please enter a valid Email Address.'
      });
      return;
    }

    setIsSubmittingManualClock(true);
    setManualClockStatus(null);
    try {
      const customTime = manualClockUseCustomTime
        ? formatManualDateTime(manualClockDate, manualClockHour, manualClockMinute, manualClockPeriod)
        : undefined;

      const res = await fetch('/api/admin/manual-clock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          name: manualClockName.trim(),
          email: manualClockEmail.trim(),
          action: manualClockAction,
          customTime,
          date: manualClockDate,
          hour: manualClockHour,
          minute: manualClockMinute,
          period: manualClockPeriod
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record manual clock');

      loadLogs();
      loadUsers();
      setManualClockStatus({
        type: 'success',
        text: `Successfully recorded ${manualClockAction} for ${manualClockName.trim()}${customTime ? ` at ${customTime}` : ''}!`
      });
      setTimeout(() => {
        setShowManualClockModal(false);
        setManualClockStatus(null);
        setManualClockName('');
        setManualClockEmail('');
        setSelectedVolunteer(null);
        setShowNameSuggestions(false);
        setNameTouched(false);
        setEmailTouched(false);
        resetManualClockTimeToNow();
        setManualClockUseCustomTime(false);
      }, 1500);
    } catch (err: any) {
      setManualClockStatus({ type: 'error', text: err.message || 'Failed to record clock event' });
    } finally {
      setIsSubmittingManualClock(false);
    }
  };

  const handleQuickClock = (user: any, action: 'Clock In' | 'Clock Out') => {
    setManualClockName(user.name);
    setManualClockEmail(user.email);
    setSelectedVolunteer(user);
    setManualClockAction(action);
    setManualClockStatus(null);
    setShowNameSuggestions(false);
    setNameSuggestionHighlightIndex(-1);
    setNameTouched(false);
    setEmailTouched(false);
    resetManualClockTimeToNow();
    setManualClockUseCustomTime(false);
    setShowManualClockModal(true);
  };
  
  const loadSettings = async () => {
    try {
      const res = await fetch('/api/settings', { headers: { 'Authorization': `Bearer ${adminToken}` }});
      const data = await res.json();
      if (res.ok) {
        setSheetId(data.sheetId || '');
      }
    } catch (err) {}
  };

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const res = await fetch('/api/admin/users', { headers: { 'Authorization': `Bearer ${adminToken}` }});
      const data = await res.json();
      if (res.ok) setRegisteredUsers(data.users || []);
    } catch (err) {} finally {
      setIsLoadingUsers(false);
    }
  };

  const loadLogs = async (silent = false) => {
    if (!silent && logs.length === 0) {
      setIsLoadingLogs(true);
    }
    try {
      const res = await fetch('/api/admin/logs', { headers: { 'Authorization': `Bearer ${adminToken}` }});
      const data = await res.json();
      if (res.ok && Array.isArray(data.logs)) {
        setLogs(data.logs);
        try {
          localStorage.setItem('csl_admin_logs_cache', JSON.stringify(data.logs));
        } catch (e) {}
      }
    } catch (err) {
      console.warn('Failed to load logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    loadSettings();
    loadUsers();
    loadLogs(false);

    // Keep logs and registered users fresh in background
    const timer = setInterval(() => {
      loadLogs(true);
      loadUsers();
    }, 12000);
    return () => clearInterval(timer);
  }, []);

  const handleCreateSheet = async () => {
    setSheetIdMessage(null);
    setIsCreatingSheet(true);
    try {
      const res = await fetch('/api/settings/create-sheet', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create sheet');
      setSheetId(data.sheetId);
      setSheetIdMessage({ type: 'success', text: `Successfully created new sheet with ID: ${data.sheetId}` });
      // Refresh the data tables
      loadLogs();
      loadUsers();
    } catch (err: any) {
      setSheetIdMessage({ type: 'error', text: err.message });
    } finally {
      setIsCreatingSheet(false);
    }
  };



  const handleManualAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddUserMessage(null);
    setIsAddingUser(true);
    try {
      const res = await fetch('/api/request-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newUserName, email: newUserEmail })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add user');
      
      const approveRes = await fetch('/api/approve-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ email: newUserEmail, action: 'approve' })
      });
      const approveData = await approveRes.json();
      if (!approveRes.ok) throw new Error(approveData.error || 'Failed to approve user');

      setAddUserMessage({ type: 'success', text: 'User added and approved successfully.' });
      setNewUserName('');
      setNewUserEmail('');
      loadUsers();
    } catch (err: any) {
      setAddUserMessage({ type: 'error', text: err.message });
    } finally {
      setIsAddingUser(false);
    }
  };
  
  const handleSearchSheets = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSearchingSheets(true);
    setSearchResults([]);
    setSheetIdMessage(null);
    try {
      const res = await fetch(`/api/settings/search-sheets?q=${encodeURIComponent(sheetSearchQuery)}`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const data = await res.json();
      if (res.ok) {
        setSearchResults(data.sheets);
        if (data.sheets.length === 0) {
          setSheetIdMessage({ type: 'error', text: 'No sheets found matching your query.' });
        }
      } else {
        throw new Error(data.error || 'Failed to search sheets');
      }
    } catch (err: any) {
      setSheetIdMessage({ type: 'error', text: err.message });
    } finally {
      setIsSearchingSheets(false);
    }
  };

  const handleManualSheetUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setSheetIdMessage(null);
    let extractedId = manualSheetUrl.trim();
    
    // Extract ID if it's a URL
    const match = extractedId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      extractedId = match[1];
    }
    
    if (!extractedId) {
      setSheetIdMessage({ type: 'error', text: 'Please enter a valid Google Sheets URL or ID.' });
      return;
    }
    
    handleSelectSheet(extractedId);
  };

  const handleSelectSheet = async (selectedSheetId: string) => {
    setSheetIdMessage(null);
    setIsVerifyingSheet(true);
    try {
      const res = await fetch('/api/settings/verify-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ sheetId: selectedSheetId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to verify sheet');
      setSheetId(selectedSheetId);
      setSheetIdMessage({ type: 'success', text: 'Sheet verified and configured successfully. Necessary tabs have been created if missing.' });
      // Refresh the data tables
      loadLogs();
      loadUsers();
    } catch (err: any) {
      setSheetIdMessage({ type: 'error', text: err.message });
    } finally {
      setIsVerifyingSheet(false);
    }
  };

  const filteredLogs = logs.filter(log => 
    log.some(field => field && field.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className={cn("flex flex-col font-sans transition-colors", isOverlay ? "h-full bg-slate-50 dark:bg-black overflow-y-auto" : "min-h-screen bg-slate-50 dark:bg-black")}>
      <header className="bg-white dark:bg-neutral-950 border-b border-slate-200 dark:border-neutral-900 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 md:h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">Admin Dashboard</h1>
              <p className="text-xs font-medium text-slate-500 dark:text-neutral-400 uppercase tracking-wider">CSL Attendance</p>
            </div>
          </div>
          {toggleDark && (
            <FloatingControls
              isDark={isDark}
              toggleDark={toggleDark}
              onHome={onExit}
              showAdminBtn={false}
              className="flex items-center gap-1 md:gap-2"
            />
          )}
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex bg-slate-200/50 dark:bg-neutral-900/50 p-1.5 rounded-xl w-full md:w-auto overflow-x-auto hide-scrollbar">
            <button
              onClick={() => setActiveTab('LOGS')}
              className={cn("flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap", activeTab === 'LOGS' ? "bg-white dark:bg-neutral-700 text-indigo-700 dark:text-indigo-300 shadow-sm" : "text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white")}
            >
              Scan Logs
            </button>
            <button
              onClick={() => setActiveTab('USERS')}
              className={cn("flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap", activeTab === 'USERS' ? "bg-white dark:bg-neutral-700 text-indigo-700 dark:text-indigo-300 shadow-sm" : "text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white")}
            >
              Manage Users
            </button>
            <button
              onClick={() => setActiveTab('SETTINGS')}
              className={cn("flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap", activeTab === 'SETTINGS' ? "bg-white dark:bg-neutral-700 text-indigo-700 dark:text-indigo-300 shadow-sm" : "text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white")}
            >
              Settings
            </button>
          </div>
          
          {activeTab === 'LOGS' && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
              <div className="relative w-full sm:w-64 md:w-80">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-neutral-950 border border-slate-300 dark:border-neutral-800 text-slate-900 dark:text-white rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm transition-all shadow-sm"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => loadLogs(false)}
                  disabled={isLoadingLogs}
                  className="inline-flex items-center justify-center p-2.5 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-slate-600 dark:text-neutral-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl transition-all shadow-sm hover:border-indigo-400 active:scale-95 disabled:opacity-50 cursor-pointer shrink-0"
                  title="Refresh logs from Google Sheet"
                >
                  <RefreshCw className={cn("w-4 h-4", isLoadingLogs && "animate-spin text-indigo-600")} />
                </button>

                <button
                  onClick={() => {
                    setManualClockName('');
                    setManualClockEmail('');
                    setSelectedVolunteer(null);
                    setShowNameSuggestions(false);
                    setNameSuggestionHighlightIndex(-1);
                    setNameTouched(false);
                    setEmailTouched(false);
                    setManualClockAction('Clock In');
                    setManualClockStatus(null);
                    resetManualClockTimeToNow();
                    setManualClockUseCustomTime(false);
                    setShowManualClockModal(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg text-sm cursor-pointer whitespace-nowrap shrink-0 flex-1 sm:flex-none"
                  title="Help a volunteer manually clock in or out"
                >
                  <Clock className="w-4 h-4" />
                  <span>Manual Clock In / Out</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {deleteSuccess && (
          <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 rounded-xl text-sm font-medium flex items-center justify-between animate-in fade-in">
            <span>{deleteSuccess}</span>
            <button onClick={() => setDeleteSuccess('')} className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-800/40 rounded-lg cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {activeTab === 'LOGS' ? (
          <div className="bg-white dark:bg-neutral-950 rounded-2xl border border-slate-200 dark:border-neutral-900 shadow-xl overflow-hidden flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto">
              <div className="divide-y divide-slate-200 dark:divide-neutral-800">
                {isLoadingLogs ? (
                  <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center">
                    <div className="w-6 h-6 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p>Loading recent logs from server...</p>
                  </div>
                ) : filteredLogs.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center">
                    <ScanLine className="w-12 h-12 text-slate-300 dark:text-neutral-700 mb-3" />
                    <p className="text-base font-medium text-slate-900 dark:text-white">No scan records found</p>
                    <p className="text-sm mt-1">Attendees scanned at the kiosk will appear here.</p>
                  </div>
                ) : (
                  filteredLogs.map((log, idx) => (
                    <div key={idx} className="p-4 sm:p-5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white truncate">{log[1]}</span>
                          <span className={cn(
                            "px-2 py-0.5 text-[10px] font-bold rounded uppercase shrink-0",
                            log[3] === 'Clock In' ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50" : "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50"
                          )}>
                            {log[3]}
                          </span>
                          {log[4] && log[4].includes('Manual') && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
                              Admin Backup
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-slate-500 dark:text-neutral-400 truncate">{log[2]}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-xs font-medium text-slate-500 dark:text-neutral-400 whitespace-nowrap">
                          {formatTimestamp(log[0])}
                        </div>
                        <button
                          onClick={() => {
                            setLogToDelete({ log, index: idx });
                            setDeleteError('');
                          }}
                          className="p-1.5 sm:p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                          title="Delete this attendance record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'SETTINGS' ? (
          <div className="flex-1 flex flex-col gap-6">
            <div className="bg-white dark:bg-neutral-950 rounded-2xl border border-slate-200 dark:border-neutral-900 shadow-xl p-6 max-w-2xl w-full">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Manage Google Sheet</h3>
              <p className="text-slate-500 dark:text-neutral-400 text-sm mb-6">Create a new sheet or search your Google Drive for an existing one. We will verify the required tabs are present.</p>

              {sheetIdMessage && (
                <div className={cn("p-3 rounded-xl mb-4 text-sm font-medium border break-all", sheetIdMessage.type === 'success' ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50" : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/50")}>
                  {sheetIdMessage.text}
                </div>
              )}

              {sheetId && (
                <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 p-4 rounded-xl mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-indigo-500 dark:text-indigo-400 font-bold uppercase tracking-wider mb-1">Currently Active Sheet</p>
                    <p className="text-sm font-medium text-slate-700 dark:text-neutral-300 break-all">{sheetId}</p>
                  </div>
                  <a
                    href={`https://docs.google.com/spreadsheets/d/${sheetId}/edit`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-colors shadow-sm shrink-0 whitespace-nowrap"
                  >
                    Open in Google Sheets
                  </a>
                </div>
              )}
              
              <div className="space-y-6">
                <div>
                  <button
                    onClick={handleCreateSheet}
                    disabled={isCreatingSheet || isVerifyingSheet}
                    className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors shadow-md hover:shadow-xl active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isCreatingSheet ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Plus className="w-5 h-5" />}
                    Create New Sheet
                  </button>
                  <p className="text-xs text-slate-400 mt-2">Automatically generates a new sheet with the correct tabs.</p>
                </div>
                
                <div className="relative border-t border-slate-200 dark:border-neutral-800 pt-6">
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-neutral-950 px-2 text-xs font-semibold text-slate-400 uppercase">OR CONNECT EXISTING</span>
                  
                  <div className="space-y-4">
                    <form onSubmit={handleSearchSheets} className="flex gap-2">
                      <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Search className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                          type="text"
                          value={sheetSearchQuery}
                          onChange={(e) => setSheetSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-slate-900 dark:text-white focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
                          placeholder="Search for a Google Sheet..."
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isSearchingSheets || isVerifyingSheet}
                        className="px-6 py-2.5 bg-slate-800 dark:bg-neutral-800 hover:bg-slate-900 dark:hover:bg-neutral-700 text-white font-bold rounded-xl transition-colors shadow-md disabled:opacity-50 flex items-center justify-center whitespace-nowrap text-sm"
                      >
                        {isSearchingSheets ? 'Searching...' : 'Search'}
                      </button>
                    </form>

                    {searchResults.length > 0 && (
                      <div className="mt-4 border border-slate-200 dark:border-neutral-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-neutral-800 bg-slate-50 dark:bg-neutral-900/50 max-h-[300px] overflow-y-auto">
                        {searchResults.map((sheet) => (
                          <div key={sheet.id} className="p-3 flex items-center justify-between hover:bg-white dark:hover:bg-neutral-800 transition-colors">
                            <div className="min-w-0 flex-1 pr-4">
                              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate" title={sheet.name}>{sheet.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {sheetId === sheet.id && <span className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 text-[10px] uppercase font-bold rounded-md">Currently Active</span>}
                              </div>
                            </div>
                            <button
                              onClick={() => handleSelectSheet(sheet.id)}
                              disabled={isVerifyingSheet || sheetId === sheet.id}
                              className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 font-bold rounded-lg transition-colors text-xs disabled:opacity-50 shrink-0"
                            >
                              {sheetId === sheet.id ? 'Active' : 'Select'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="relative border-t border-slate-200 dark:border-neutral-800 pt-6 mt-6">
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-neutral-950 px-2 text-xs font-semibold text-slate-400 uppercase">OR ENTER URL DIRECTLY</span>
                  
                  <form onSubmit={handleManualSheetUrl} className="flex gap-2">
                    <input
                      type="text"
                      value={manualSheetUrl}
                      onChange={(e) => setManualSheetUrl(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-slate-900 dark:text-white focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
                      placeholder="Paste Google Sheets URL or ID..."
                    />
                    <button
                      type="submit"
                      disabled={isVerifyingSheet || !manualSheetUrl.trim()}
                      className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors shadow-md disabled:opacity-50 flex items-center justify-center whitespace-nowrap text-sm"
                    >
                      Connect
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 flex-1">
            <div className="lg:col-span-1 bg-white dark:bg-neutral-950 rounded-2xl border border-slate-200 dark:border-neutral-900 shadow-xl overflow-hidden flex flex-col p-6 h-fit">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-500" />
                Manual Register
              </h3>
              <p className="text-sm text-slate-500 dark:text-neutral-400 mb-6">Manually register a new attendee.</p>
              
              {addUserMessage && (
                <div className={cn("p-3 rounded-xl mb-4 text-sm font-medium border", addUserMessage.type === 'success' ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50" : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/50")}>
                  {addUserMessage.text}
                </div>
              )}

              <form onSubmit={handleManualAddUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-neutral-300 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    required
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900 text-slate-900 dark:text-white focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-neutral-300 mb-1.5">Email Address</label>
                  <input
                    type="email"
                    required
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900 text-slate-900 dark:text-white focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
                    placeholder="john@example.com"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isAddingUser}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors shadow-md hover:shadow-xl active:scale-[0.98] disabled:opacity-50 flex justify-center mt-2"
                >
                  {isAddingUser ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : 'Register User'}
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-white dark:bg-neutral-950 rounded-2xl border border-slate-200 dark:border-neutral-900 shadow-xl overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-200 dark:border-neutral-900 bg-slate-50 dark:bg-neutral-900/50 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Registered Users</h3>
                <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 px-2.5 py-0.5 rounded-full text-xs font-bold">{registeredUsers.length} Users</span>
              </div>
              <div className="flex-1 overflow-y-auto">
                <div className="divide-y divide-slate-200 dark:divide-neutral-800">
                  {isLoadingUsers ? (
                    <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center">
                      <div className="w-6 h-6 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                      <p>Loading users...</p>
                    </div>
                  ) : registeredUsers.length === 0 ? (
                    <div className="p-12 text-center text-slate-500">
                      No users registered yet.
                    </div>
                  ) : (
                    registeredUsers.map((u, idx) => (
                      <div key={idx} className="p-4 sm:p-5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-slate-900 dark:text-white truncate">{u.name}</span>
                          <span className="text-sm text-slate-500 dark:text-neutral-400 truncate">{u.email}</span>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                          <div className="flex flex-col sm:items-end">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Registered</span>
                            <span className="text-xs font-medium text-slate-500 dark:text-neutral-400 whitespace-nowrap">
                              {formatTimestamp(u.registeredAt)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 ml-1 sm:ml-2">
                            <button
                              onClick={() => handleQuickClock(u, 'Clock In')}
                              className="px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800/60 rounded-lg transition-colors cursor-pointer"
                              title={`Manually Clock In ${u.name}`}
                            >
                              Clock In
                            </button>
                            <button
                              onClick={() => handleQuickClock(u, 'Clock Out')}
                              className="px-2.5 py-1 text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800/60 rounded-lg transition-colors cursor-pointer"
                              title={`Manually Clock Out ${u.name}`}
                            >
                              Clock Out
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {logToDelete && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Attendance Record</h3>
                  <p className="text-xs text-slate-500 dark:text-neutral-400">Permanently delete this attendance entry.</p>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-2xl p-4 mb-4 space-y-2 text-left text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400 dark:text-neutral-500 font-semibold">Attendee:</span>
                  <span className="font-bold text-slate-900 dark:text-white truncate max-w-[200px]">{logToDelete.log[1]}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400 dark:text-neutral-500 font-semibold">Email:</span>
                  <span className="font-mono text-xs text-slate-600 dark:text-neutral-300 truncate max-w-[200px]">{logToDelete.log[2]}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400 dark:text-neutral-500 font-semibold">Action:</span>
                  <span className={cn(
                    "font-bold text-xs px-2 py-0.5 rounded",
                    logToDelete.log[3] === 'Clock In' ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300" : "bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300"
                  )}>
                    {logToDelete.log[3]}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400 dark:text-neutral-500 font-semibold">Time:</span>
                  <span className="text-xs text-slate-700 dark:text-neutral-300">{formatTimestamp(logToDelete.log[0])}</span>
                </div>
              </div>

              {deleteError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 rounded-xl text-xs">
                  {deleteError}
                </div>
              )}

              <div className="flex items-center gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setLogToDelete(null)}
                  disabled={isDeletingLog}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-700 dark:text-neutral-200 font-bold rounded-xl text-sm transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteLog}
                  disabled={isDeletingLog}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold rounded-xl text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isDeletingLog ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Delete Record</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Manual Clock In / Out Modal (Admin Backup) */}
        {showManualClockModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center shrink-0">
                    <UserCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Manual Clock In / Out</h3>
                    <p className="text-xs text-slate-500 dark:text-neutral-400">Admin backup entry for volunteers</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowManualClockModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200 rounded-xl hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {manualClockStatus && (
                <div className={cn(
                  "p-3 rounded-xl mb-4 text-xs sm:text-sm font-medium border",
                  manualClockStatus.type === 'success' 
                    ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50" 
                    : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/50"
                )}>
                  {manualClockStatus.text}
                </div>
              )}

              <form onSubmit={handleManualClockSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-neutral-300 mb-2 uppercase tracking-wider">
                    Select Action
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setManualClockAction('Clock In')}
                      className={cn(
                        "py-3 px-4 rounded-xl border-2 font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer",
                        manualClockAction === 'Clock In'
                          ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 shadow-sm"
                          : "border-slate-200 dark:border-neutral-800 hover:bg-slate-50 dark:hover:bg-neutral-800 text-slate-600 dark:text-neutral-400"
                      )}
                    >
                      <Check className={cn("w-4 h-4", manualClockAction === 'Clock In' ? "opacity-100" : "opacity-0")} />
                      <span>Clock In</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setManualClockAction('Clock Out')}
                      className={cn(
                        "py-3 px-4 rounded-xl border-2 font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer",
                        manualClockAction === 'Clock Out'
                          ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 shadow-sm"
                          : "border-slate-200 dark:border-neutral-800 hover:bg-slate-50 dark:hover:bg-neutral-800 text-slate-600 dark:text-neutral-400"
                      )}
                    >
                      <Check className={cn("w-4 h-4", manualClockAction === 'Clock Out' ? "opacity-100" : "opacity-0")} />
                      <span>Clock Out</span>
                    </button>
                  </div>
                </div>

                {/* Volunteer Name with Fuzzy Search Autocomplete */}
                <div className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-neutral-300">
                      Volunteer Name <span className="text-red-500">*</span>
                    </label>
                    {selectedVolunteer && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        Selected from Registry
                      </span>
                    )}
                  </div>
                  
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Search className="w-4 h-4" />
                    </div>
                    <input
                      ref={nameInputRef}
                      type="text"
                      required
                      placeholder="Type to fuzzy search volunteer name..."
                      value={manualClockName}
                      onChange={(e) => handleNameInputChange(e.target.value)}
                      onFocus={() => setShowNameSuggestions(true)}
                      onClick={() => setShowNameSuggestions(true)}
                      onKeyDown={handleNameKeyDown}
                      className={cn(
                        "w-full pl-9 pr-9 py-2.5 rounded-xl border text-sm outline-none transition-all",
                        nameTouched && !isValidName
                          ? "border-red-400 dark:border-red-700 focus:ring-4 focus:ring-red-500/20 bg-red-50/20 dark:bg-red-950/20 text-slate-900 dark:text-white"
                          : "border-slate-300 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950 text-slate-900 dark:text-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500"
                      )}
                      autoComplete="off"
                    />
                    {manualClockName && (
                      <button
                        type="button"
                        onClick={() => {
                          setManualClockName('');
                          setManualClockEmail('');
                          setSelectedVolunteer(null);
                          setShowNameSuggestions(true);
                          setNameSuggestionHighlightIndex(-1);
                          nameInputRef.current?.focus();
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200 rounded-lg hover:bg-slate-200 dark:hover:bg-neutral-800"
                        title="Clear"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {nameTouched && !isValidName && (
                    <p className="text-[11px] text-red-500 mt-1 font-medium">
                      Volunteer Name must be at least 2 characters.
                    </p>
                  )}

                  {/* Fuzzy Search Dropdown */}
                  {showNameSuggestions && (
                    <>
                      {/* Invisible backdrop to dismiss suggestions when clicking away */}
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setShowNameSuggestions(false)} 
                      />

                      <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl shadow-2xl max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-neutral-800 animate-in fade-in zoom-in-95 duration-150">
                        <div className="p-2.5 bg-slate-50 dark:bg-neutral-950 border-b border-slate-100 dark:border-neutral-800 flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10 backdrop-blur-sm">
                          <span className="flex items-center gap-1.5">
                            <Search className="w-3.5 h-3.5 text-indigo-500" />
                            {manualClockName.trim() ? `Fuzzy Search Matches (${fuzzySuggestions.length})` : `All Volunteers (A–Z) (${fuzzySuggestions.length})`}
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            Click name to auto-populate email
                          </span>
                        </div>

                        {fuzzySuggestions.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-400 dark:text-neutral-500">
                            No registered volunteer found matching "{manualClockName}".
                          </div>
                        ) : (
                          fuzzySuggestions.map((u, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => handleSelectVolunteer(u)}
                              className={cn(
                                "w-full text-left p-3 hover:bg-indigo-50/80 dark:hover:bg-neutral-800/80 flex items-center justify-between transition-colors cursor-pointer group",
                                nameSuggestionHighlightIndex === i ? "bg-indigo-50 dark:bg-neutral-800" : ""
                              )}
                            >
                              <div className="min-w-0 pr-3">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                                    {u.name}
                                  </span>
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400">
                                    Registered
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-neutral-400 font-mono mt-0.5 truncate">
                                  {u.email}
                                </p>
                              </div>
                              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-indigo-50 dark:bg-indigo-950/50 px-2 py-1 rounded-lg shrink-0">
                                Select & Auto-fill
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Email Address (Auto-populated from selected volunteer) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-neutral-300">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    {selectedVolunteer && selectedVolunteer.email === manualClockEmail && (
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Auto-populated from volunteer
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      placeholder="e.g. john@example.com"
                      value={manualClockEmail}
                      onChange={(e) => {
                        setManualClockEmail(e.target.value);
                        setEmailTouched(true);
                      }}
                      className={cn(
                        "w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all font-mono",
                        emailTouched && !isValidEmail
                          ? "border-red-400 dark:border-red-700 focus:ring-4 focus:ring-red-500/20 bg-red-50/20 dark:bg-red-950/20 text-slate-900 dark:text-white"
                          : "border-slate-300 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950 text-slate-900 dark:text-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500"
                      )}
                    />
                    {isValidEmail && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                  {emailTouched && !isValidEmail && (
                    <p className="text-[11px] text-red-500 mt-1 font-medium">
                      Please enter a valid Email Address (e.g. name@example.com).
                    </p>
                  )}
                </div>

                {/* Time & Date Configuration (Hour and Min) */}
                <div className="border border-slate-200 dark:border-neutral-800 rounded-2xl p-4 bg-slate-50/70 dark:bg-neutral-950/70 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-neutral-300 flex items-center gap-1.5 uppercase tracking-wider">
                      <Clock className="w-3.5 h-3.5 text-indigo-500" />
                      Attendance Time
                    </label>
                    <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-neutral-800 p-0.5 rounded-lg text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setManualClockUseCustomTime(false);
                          resetManualClockTimeToNow();
                        }}
                        className={cn(
                          "px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer",
                          !manualClockUseCustomTime
                            ? "bg-white dark:bg-neutral-700 text-indigo-700 dark:text-indigo-300 shadow-xs"
                            : "text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white"
                        )}
                      >
                        Now
                      </button>
                      <button
                        type="button"
                        onClick={() => setManualClockUseCustomTime(true)}
                        className={cn(
                          "px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer",
                          manualClockUseCustomTime
                            ? "bg-white dark:bg-neutral-700 text-indigo-700 dark:text-indigo-300 shadow-xs"
                            : "text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white"
                        )}
                      >
                        Custom Time
                      </button>
                    </div>
                  </div>

                  {manualClockUseCustomTime ? (
                    <div className="space-y-3 pt-1 animate-in fade-in duration-150">
                      {/* Date and Quick Presets */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-neutral-400 mb-1">
                            Date
                          </label>
                          <div className="relative">
                            <input
                              type="date"
                              required
                              value={manualClockDate}
                              onChange={(e) => setManualClockDate(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-neutral-400 mb-1">
                            Quick Adjust
                          </label>
                          <div className="grid grid-cols-3 gap-1">
                            <button
                              type="button"
                              onClick={() => adjustManualClockMinutes(-15)}
                              className="px-2 py-2 bg-white dark:bg-neutral-900 hover:bg-slate-100 dark:hover:bg-neutral-800 border border-slate-200 dark:border-neutral-800 rounded-lg text-[11px] font-bold text-slate-600 dark:text-neutral-300 transition-colors cursor-pointer"
                              title="15 minutes earlier"
                            >
                              -15m
                            </button>
                            <button
                              type="button"
                              onClick={() => adjustManualClockMinutes(-30)}
                              className="px-2 py-2 bg-white dark:bg-neutral-900 hover:bg-slate-100 dark:hover:bg-neutral-800 border border-slate-200 dark:border-neutral-800 rounded-lg text-[11px] font-bold text-slate-600 dark:text-neutral-300 transition-colors cursor-pointer"
                              title="30 minutes earlier"
                            >
                              -30m
                            </button>
                            <button
                              type="button"
                              onClick={() => adjustManualClockMinutes(-60)}
                              className="px-2 py-2 bg-white dark:bg-neutral-900 hover:bg-slate-100 dark:hover:bg-neutral-800 border border-slate-200 dark:border-neutral-800 rounded-lg text-[11px] font-bold text-slate-600 dark:text-neutral-300 transition-colors cursor-pointer"
                              title="1 hour earlier"
                            >
                              -1h
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Hour & Minute Selectors */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-neutral-400">
                            Time (Hour & Minute)
                          </label>
                          <button
                            type="button"
                            onClick={resetManualClockTimeToNow}
                            className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
                          >
                            Reset to current time
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Hour Selector */}
                          <div className="flex-1">
                            <label className="sr-only">Hour</label>
                            <div className="relative">
                              <select
                                value={manualClockHour}
                                onChange={(e) => setManualClockHour(e.target.value)}
                                className="w-full pl-3 pr-7 py-2 rounded-xl border border-slate-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-slate-900 dark:text-white text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none cursor-pointer appearance-none"
                              >
                                {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((h) => (
                                  <option key={h} value={h}>{h} hr</option>
                                ))}
                              </select>
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">▼</span>
                            </div>
                          </div>

                          <span className="font-extrabold text-slate-400 text-lg select-none">:</span>

                          {/* Minute Selector */}
                          <div className="flex-1">
                            <label className="sr-only">Minute</label>
                            <div className="relative">
                              <select
                                value={manualClockMinute}
                                onChange={(e) => setManualClockMinute(e.target.value)}
                                className="w-full pl-3 pr-7 py-2 rounded-xl border border-slate-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-slate-900 dark:text-white text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none cursor-pointer appearance-none"
                              >
                                {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map((m) => (
                                  <option key={m} value={m}>{m} min</option>
                                ))}
                              </select>
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">▼</span>
                            </div>
                          </div>

                          {/* AM / PM Toggle */}
                          <div className="flex rounded-xl border border-slate-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-0.5 shrink-0 shadow-xs">
                            <button
                              type="button"
                              onClick={() => setManualClockPeriod('AM')}
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                                manualClockPeriod === 'AM'
                                  ? "bg-indigo-600 text-white shadow-xs"
                                  : "text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white"
                              )}
                            >
                              AM
                            </button>
                            <button
                              type="button"
                              onClick={() => setManualClockPeriod('PM')}
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                                manualClockPeriod === 'PM'
                                  ? "bg-indigo-600 text-white shadow-xs"
                                  : "text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white"
                              )}
                            >
                              PM
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Live preview */}
                      <div className="p-2.5 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 rounded-xl flex items-center justify-between text-xs">
                        <span className="text-slate-500 dark:text-neutral-400 font-medium">Log will be recorded as:</span>
                        <span className="font-bold text-indigo-700 dark:text-indigo-300 font-mono">
                          {formatManualDateTime(manualClockDate, manualClockHour, manualClockMinute, manualClockPeriod)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-100 dark:bg-neutral-900 rounded-xl flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-neutral-400">Current Time (SGT):</span>
                      <span className="font-bold text-slate-800 dark:text-neutral-200 font-mono">
                        {formatManualDateTime(manualClockDate, manualClockHour, manualClockMinute, manualClockPeriod)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowManualClockModal(false)}
                      disabled={isSubmittingManualClock}
                      className="px-4 py-2.5 bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-700 dark:text-neutral-200 font-bold rounded-xl text-sm transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingManualClock || !isFormValid}
                      className={cn(
                        "px-6 py-2.5 font-bold rounded-xl text-sm text-white shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
                        manualClockAction === 'Clock In' ? "bg-emerald-600 hover:bg-emerald-700" : "bg-indigo-600 hover:bg-indigo-700"
                      )}
                      title={!isFormValid ? "A valid Volunteer Name and Email Address are required" : undefined}
                    >
                      {isSubmittingManualClock ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Record {manualClockAction}</span>
                        </>
                      )}
                    </button>
                  </div>

                  {!isFormValid && (nameTouched || emailTouched) && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 text-right font-medium">
                      {!isValidName && !isValidEmail
                        ? 'Volunteer Name and a valid Email Address are required to clock in/out.'
                        : !isValidName
                        ? 'Volunteer Name must be at least 2 characters.'
                        : 'A valid Email Address is required to clock in/out.'}
                    </p>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ----------------------------------------------------------------------
// KIOSK VIEW
// ----------------------------------------------------------------------
function DynamicQRCode({ sessionId }: { sessionId: string }) {
  const [timestamp, setTimestamp] = useState(Date.now());
  const [timeLeft, setTimeLeft] = useState(15);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    setTimestamp(Date.now());
    setTimeLeft(15);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  useEffect(() => {
    setTimeLeft(15);
    const interval = setInterval(() => {
      setTimestamp(Date.now());
      setTimeLeft(15);
    }, 15000);
    return () => clearInterval(interval);
  }, [timestamp]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [timestamp]);

  const qrUrl = `${window.location.origin}/?kiosk=${sessionId}&t=${timestamp}`;

  return (
    <div className="flex flex-col items-center w-full">
      <div className="mb-4 sm:mb-6 flex flex-col items-center">
        <div className="flex items-center gap-2 text-amber-500 dark:text-amber-400 mb-1 sm:mb-2">
          <Clock className="w-5 h-5 md:w-6 md:h-6 animate-pulse" />
          <span className="font-mono text-xl md:text-2xl font-bold">{timeLeft}s</span>
        </div>
        <p className="text-slate-500 dark:text-neutral-400 text-xs sm:text-sm">Code expires in {timeLeft} seconds</p>
      </div>

      <div 
        onClick={handleManualRefresh}
        title="Click to generate new QR code immediately"
        className="p-4 md:p-8 bg-white dark:bg-neutral-900 rounded-3xl md:rounded-[2.5rem] shadow-2xl relative w-full max-w-[220px] sm:max-w-[280px] md:max-w-[360px] aspect-square flex items-center justify-center cursor-pointer hover:ring-4 hover:ring-indigo-500/20 active:scale-95 transition-all group"
      >
        <QRCodeSVG value={qrUrl} className="w-full h-full text-slate-900 dark:text-white" style={{ width: '100%', height: '100%' }} level="H" />
      </div>

      <div className="flex flex-col items-center gap-2 mt-5 sm:mt-6">
        <button
          onClick={handleManualRefresh}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-md hover:shadow-lg cursor-pointer"
          title="Immediately generate a new QR code for the next attendee"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Next Attendee (Refresh QR)</span>
        </button>
        <p className="text-emerald-600 dark:text-emerald-400 text-xs font-mono bg-emerald-100 dark:bg-emerald-400/10 px-3 py-1 rounded-full">
          Auto-refreshes every 15s
        </p>
      </div>
    </div>
  );
}

function KioskView({ onExit, adminToken, isDark, toggleDark }: { onExit: () => void, adminToken: string, isDark: boolean, toggleDark: () => void }) {
  const [recentLogs, setRecentLogs] = useState<ScanLog[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [pinError, setPinError] = useState('');
  const [sessionId] = useState(() => crypto.randomUUID());
  
  // Modal for admin dashboard while in kiosk mode
  const [showAdminOverlay, setShowAdminOverlay] = useState(false);

  useEffect(() => {
    let timeoutId: any;
    const poll = async () => {
      try {
        const res = await fetch(`/api/events?sessionId=${sessionId}`, {
          headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if (!res.ok) throw new Error('Poll failed');
        const data = await res.json();
        
        if (data.events && data.events.length > 0) {
          setRecentLogs(prev => [...data.events, ...prev].slice(0, 15));
        }
        if (data.pendingApprovals) {
          setPendingApprovals(data.pendingApprovals);
        }
      } catch (err) {
      } finally {
        timeoutId = setTimeout(poll, 2000);
      }
    };
    poll();
    return () => clearTimeout(timeoutId);
  }, [sessionId]);

  const handleApproveRegistration = async (email: string, action: 'approve' | 'reject') => {
    try {
      const res = await fetch('/api/approve-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ email, action, sessionId })
      });
      const data = await res.json();
      
      if (!res.ok) {
         throw new Error(data.error || 'Failed to update');
      }
      
      setPendingApprovals(prev => prev.filter(p => p.email !== email));
      setPinError('');
    } catch (e: any) {
      setPinError(e.message);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-white dark:bg-black text-slate-900 dark:text-white overflow-hidden transition-colors">
      <div className="flex-1 md:w-3/5 lg:w-2/3 flex flex-col bg-slate-50 dark:bg-neutral-950 border-r border-slate-200 dark:border-neutral-900 min-h-[55vh] md:min-h-0 relative">
        <div className="p-4 md:p-6 z-10 flex justify-between items-start shrink-0">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <QrCode className="w-6 h-6 md:w-8 md:h-8 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white truncate">CSL Attendance Kiosk</h1>
              <p className="text-slate-500 dark:text-neutral-400 text-xs md:text-sm font-mono mt-0.5 truncate">Session ID: {sessionId.split('-')[0]}</p>
            </div>
          </div>
          <FloatingControls
            isDark={isDark}
            toggleDark={toggleDark}
            onOpenAdmin={() => setShowAdminOverlay(true)}
            showAdminBtn={!showAdminOverlay}
            onHome={onExit}
            className="flex items-center gap-1 md:gap-2"
          />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 md:p-12 relative overflow-y-auto">
           <DynamicQRCode sessionId={sessionId} />
        </div>
      </div>

      <div className="w-full md:w-2/5 lg:w-1/3 bg-white dark:bg-neutral-950 flex flex-col shadow-2xl z-20 flex-1 md:flex-none md:h-screen min-h-[30vh]">
        <div className="p-4 md:p-6 border-b border-slate-200 dark:border-neutral-900 flex items-center justify-between shrink-0">
           <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
             <div className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
             <span className="text-xs md:text-sm font-medium tracking-wide uppercase">Live Sync Active</span>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-6">
          {pendingApprovals.length > 0 && (
            <div className="space-y-3 shrink-0">
              <h3 className="text-xs md:text-sm font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-2 sticky top-0 bg-white dark:bg-neutral-950 py-1 z-10">
                <Shield className="w-3 h-3 md:w-4 md:h-4" />
                Pending Registrations ({pendingApprovals.length})
              </h3>
              
              {pinError && (
                <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 text-xs rounded-lg">
                  {pinError}
                </div>
              )}
              
              <div className="space-y-2">
                {pendingApprovals.map(req => (
                  <div key={req.email} className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800/50 animate-in slide-in-from-right-4 fade-in shadow-sm">
                    <div className="font-bold text-amber-900 dark:text-amber-100 text-base">{req.name}</div>
                    <div className="text-xs text-amber-700 dark:text-amber-400/80 mb-3">{req.email}</div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleApproveRegistration(req.email, 'approve')} className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-colors mr-16 md:mr-24">Approve</button>
                      <button onClick={() => handleApproveRegistration(req.email, 'reject')} className="flex-1 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400 text-xs font-bold rounded-lg transition-colors mr-16 md:mr-24">Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3 shrink-0">
            <h3 className="text-xs md:text-sm font-medium text-slate-500 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-2 sticky top-0 bg-white dark:bg-neutral-950 py-1 z-10">
              <ScanLine className="w-3 h-3 md:w-4 md:h-4" />
              Recent Scans ({recentLogs.length})
            </h3>
            <div className="space-y-2">
              {recentLogs.length === 0 ? (
                <div className="text-center py-6 md:py-8 text-slate-400 dark:text-neutral-500 text-xs md:text-sm border border-slate-200 dark:border-neutral-900 rounded-2xl border-dashed">
                  No scans yet in this session
                </div>
              ) : (
                recentLogs.map((log) => (
                  <div key={log.id} className="bg-slate-50 dark:bg-neutral-900/50 rounded-xl p-3 md:p-4 border border-slate-200 dark:border-neutral-800/50 flex items-center justify-between animate-in slide-in-from-right-2 fade-in">
                    <div className="min-w-0 flex-1 mr-3">
                      <div className="font-bold text-slate-900 dark:text-white text-sm md:text-base truncate">{log.name}</div>
                      <div className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5 truncate">{log.action}</div>
                    </div>
                    <div className="text-[10px] md:text-xs font-mono text-slate-400 dark:text-neutral-500 shrink-0 whitespace-nowrap">
                      {new Date(log.scanTimestamp).toLocaleTimeString('en-SG', { timeZone: 'Asia/Singapore', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Admin Dashboard Overlay (opened from Gear Icon) */}
      {showAdminOverlay && (
        <div className="fixed inset-0 z-50 bg-white dark:bg-black animate-in slide-in-from-bottom-full">
          <AdminDashboard adminToken={adminToken} onExit={() => setShowAdminOverlay(false)} isOverlay={true} isDark={isDark} toggleDark={toggleDark} />
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// ATTENDEE SCANNER VIEW (Public)
// ----------------------------------------------------------------------

function AttendeeView({ onExit, isDark, toggleDark }: { onExit: () => void, isDark?: boolean, toggleDark?: () => void }) {
  const [step, setStep] = useState<'SCAN' | 'ACTION' | 'VERIFY_ATTENDEE' | 'WAITING_APPROVAL' | 'SUCCESS'>('SCAN');
  const [scanToken, setScanToken] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [lastAction, setLastAction] = useState<'Clock In' | 'Clock Out' | ''>('');
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading'>('idle');
  const [sessionId, setSessionId] = useState('');
  const [todayStatus, setTodayStatus] = useState<'NOT_CLOCKED_IN' | 'CLOCKED_IN' | 'CLOCKED_OUT'>('NOT_CLOCKED_IN');
  const [lastActionTime, setLastActionTime] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const kioskSessionId = params.get('kiosk');
    const t = params.get('t');
    if (kioskSessionId && t) {
      setSessionId(kioskSessionId);
      verifyScan(kioskSessionId, t);
    }
  }, []);

  // Whenever user reaches ACTION step, refresh their today attendance status
  useEffect(() => {
    if (step === 'ACTION' && email && name) {
      fetch(`/api/attendee-status?email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`)
        .then(r => r.json())
        .then(d => {
          if (d.registered) {
            if (d.currentStatus) setTodayStatus(d.currentStatus);
            if (d.lastActionTime) setLastActionTime(d.lastActionTime);
          }
        })
        .catch(() => {});
    }
  }, [step, email, name]);

  // Poll registration approval when in WAITING_APPROVAL step
  useEffect(() => {
    if (step !== 'WAITING_APPROVAL' || !email) return;

    let pollInterval: any;
    let isCancelled = false;

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/check-registration-status?email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (isCancelled) return;

        if (data.status === 'approved') {
          const approvedUser = data.user || { name, email };
          localStorage.setItem('attendee_email', approvedUser.email || email);
          localStorage.setItem('attendee_name', approvedUser.name || name);
          setEmail(approvedUser.email || email);
          setName(approvedUser.name || name);
          setTodayStatus('NOT_CLOCKED_IN');
          clearInterval(pollInterval);
          setStep('ACTION');
        } else if (data.status === 'rejected') {
          clearInterval(pollInterval);
          setError('Your registration request was declined by the kiosk administrator.');
          setStep('VERIFY_ATTENDEE');
          setIsNewUser(false);
          setInfoMessage('');
        }
      } catch (err) {
        // Silently continue polling on transient connection drop
      }
    };

    checkStatus();
    pollInterval = setInterval(checkStatus, 2000);

    return () => {
      isCancelled = true;
      clearInterval(pollInterval);
    };
  }, [step, email, name]);

  const verifyScan = async (sid: string, timestamp: string) => {
    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid, timestamp })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      setScanToken(data.scanToken);
      
      const savedEmail = (localStorage.getItem('attendee_email') || '').trim();
      const savedName = (localStorage.getItem('attendee_name') || '').trim();
      
      if (savedEmail && savedName) {
        try {
          // Verify with server and Google Sheet whether this attendee is still registered with exact match
          const statusRes = await fetch(`/api/attendee-status?email=${encodeURIComponent(savedEmail)}&name=${encodeURIComponent(savedName)}`);
          const statusData = await statusRes.json();
          if (statusData.registered) {
            setEmail(statusData.email || savedEmail);
            setName(statusData.name || savedName);
            if (statusData.currentStatus) setTodayStatus(statusData.currentStatus);
            if (statusData.lastActionTime) setLastActionTime(statusData.lastActionTime);
            setStep('ACTION');
            return;
          } else {
            // Attendee is not found in the sheet or was removed
            localStorage.removeItem('attendee_email');
            localStorage.removeItem('attendee_name');
            setEmail('');
            setName('');
            setError('Your registration was not found in the Google Sheet. Please verify your registered details.');
            setStep('VERIFY_ATTENDEE');
            return;
          }
        } catch {
          // In case of transient network error, fall back to verification step
          setStep('VERIFY_ATTENDEE');
          return;
        }
      }
      setStep('VERIFY_ATTENDEE');
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleSwitchAccount = () => {
    localStorage.removeItem('attendee_email');
    localStorage.removeItem('attendee_name');
    setEmail('');
    setName('');
    setError('');
    setInfoMessage('');
    setIsNewUser(false);
    setStep('VERIFY_ATTENDEE');
  };

  const renderHeader = (showSwitch = false) => (
    <div className="flex items-center justify-between shrink-0 mb-3 sm:mb-5 w-full">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 sm:w-9 sm:h-9 bg-indigo-600 dark:bg-indigo-500 rounded-xl flex items-center justify-center shadow-md shrink-0">
          <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        </div>
        <span className="font-bold text-slate-900 dark:text-white text-base sm:text-lg tracking-tight">CSL Attendance</span>
      </div>

      <div className="flex items-center gap-2">
        {showSwitch && email && (
          <button 
            onClick={handleSwitchAccount} 
            className="text-xs sm:text-sm font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 px-2.5 sm:px-3 py-1.5 rounded-xl transition-colors cursor-pointer shrink-0"
          >
            <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> 
            <span>Switch Volunteer</span>
          </button>
        )}
        {toggleDark && (
          <button
            onClick={toggleDark}
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white rounded-xl bg-slate-100 dark:bg-neutral-900 hover:bg-slate-200 dark:hover:bg-neutral-800 transition-all text-base sm:text-lg shrink-0 cursor-pointer shadow-sm hover:scale-110 active:scale-95"
            title="Toggle Dark Mode"
            type="button"
          >
            🌗
          </button>
        )}
      </div>
    </div>
  );

  const handleTriggerRegister = async (cleanName: string, cleanEmail: string) => {
    setStatus('loading');
    setError('');
    setInfoMessage('');
    try {
      const res = await fetch('/api/request-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName, email: cleanEmail, sessionId })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit registration request.');
      }

      if (data.alreadyRegistered && data.user) {
        // Was already registered
        localStorage.setItem('attendee_email', data.user.email || cleanEmail);
        localStorage.setItem('attendee_name', data.user.name || cleanName);
        setEmail(data.user.email || cleanEmail);
        setName(data.user.name || cleanName);
        setStatus('idle');
        setStep('ACTION');
        return;
      }

      // Enter waiting approval step
      setEmail(cleanEmail);
      setName(cleanName);
      setStatus('idle');
      setStep('WAITING_APPROVAL');
    } catch (err: any) {
      setError(err.message || 'Failed to send registration request.');
      setStatus('idle');
    }
  };

  const handleVerifyAttendee = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanEmail = email.trim();
    if (!cleanName || !cleanEmail) {
      setError('Please enter both your full name and email address.');
      return;
    }

    if (isNewUser) {
      await handleTriggerRegister(cleanName, cleanEmail);
      return;
    }

    setStatus('loading');
    setError('');
    setInfoMessage('');
    try {
      const res = await fetch('/api/verify-attendee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName, email: cleanEmail })
      });
      const data = await res.json();

      if (res.ok && data.registered && data.user) {
        localStorage.setItem('attendee_email', data.user.email || cleanEmail);
        localStorage.setItem('attendee_name', data.user.name || cleanName);
        setEmail(data.user.email || cleanEmail);
        setName(data.user.name || cleanName);
        if (data.currentStatus) setTodayStatus(data.currentStatus);
        if (data.lastActionTime) setLastActionTime(data.lastActionTime);
        setStatus('idle');
        setStep('ACTION');
        return;
      }

      // User not found in registered records -> change button to Register
      setIsNewUser(true);
      setError('');
      setInfoMessage('No registered record found for this name and email. Tap "Register" below to submit your registration request.');
      setStatus('idle');
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please check your connection.');
      setStatus('idle');
    }
  };

  const handleAction = async (action: 'Clock In' | 'Clock Out') => {
    if (!email || !name) {
      setStep('VERIFY_ATTENDEE');
      return;
    }
    
    setStatus('loading');
    setError('');
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanToken, name: name.trim(), email: email.trim(), action })
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'ALREADY_CLOCKED_IN') {
          setTodayStatus('CLOCKED_IN');
          setError(data.error || 'You have already clocked in for today. Please clock out instead.');
          setStatus('idle');
          return;
        }
        if (data.code === 'UNREGISTERED' || res.status === 403) {
          // Attendee was removed from sheet or not registered
          localStorage.removeItem('attendee_email');
          localStorage.removeItem('attendee_name');
          setEmail('');
          setName('');
          setError(data.error || 'Your registration was not found or was removed from the sheet.');
          setStep('VERIFY_ATTENDEE');
          setStatus('idle');
          return;
        }
        throw new Error(data.error || 'Failed to submit action');
      }
      if (data.currentStatus) {
        setTodayStatus(data.currentStatus);
      }
      setLastAction(action);
      setStep('SUCCESS');
    } catch (e: any) {
      setError(e.message);
      setStatus('idle');
    }
  };

  if (error && step === 'SCAN') {
    return (
      <div className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-slate-50 dark:bg-black p-4 sm:p-6 flex flex-col items-center justify-between transition-colors">
        {renderHeader(false)}
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4 max-w-sm mx-auto">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4 sm:mb-6">
            <Shield className="w-8 h-8 sm:w-10 sm:h-10 text-red-500 dark:text-red-400" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-2 text-center">Scan Failed or Expired</h2>
          <p className="text-slate-500 dark:text-neutral-400 text-xs sm:text-sm text-center mb-4">{error}</p>
          <p className="text-xs text-slate-400 dark:text-neutral-500 mb-6">Please rescan the live QR code on the kiosk screen.</p>
          <button 
            onClick={() => { try { window.close(); } catch(e){} }}
            className="px-6 py-2.5 sm:py-3 bg-slate-900 dark:bg-white text-white dark:text-neutral-900 font-bold rounded-xl shadow-lg hover:shadow-xl active:scale-[0.98] transition-all text-sm cursor-pointer"
          >
            Close Tab
          </button>
        </div>
      </div>
    );
  }

  if (step === 'SCAN') {
    return (
      <div className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-slate-50 dark:bg-black flex flex-col p-4 sm:p-6 transition-colors">
        {renderHeader(false)}
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-indigo-600 dark:border-indigo-400 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-600 dark:text-neutral-400 text-xs sm:text-sm font-medium animate-pulse">Verifying secure QR code...</p>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'WAITING_APPROVAL') {
    return (
      <div className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-slate-50 dark:bg-black flex flex-col p-4 sm:p-6 text-center transition-colors">
        {renderHeader(false)}

        <div className="w-full max-w-sm mx-auto flex-1 min-h-0 flex flex-col justify-center items-center">
          <div className="w-full bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mb-3 sm:mb-4 relative shrink-0">
              <Clock className="w-7 h-7 sm:w-8 sm:h-8 animate-pulse" />
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center shadow">
                <div className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            </div>
            
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-1 shrink-0">Registration Pending</h2>
            <p className="text-slate-500 dark:text-neutral-400 text-xs sm:text-sm mb-3 sm:mb-4 shrink-0">
              Your request has been submitted to the kiosk. Please ask the kiosk attendant to <span className="font-bold text-slate-900 dark:text-white">Approve</span> your registration on the kiosk screen.
            </p>

            <div className="w-full bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-2xl p-3 sm:p-4 mb-4 text-left shrink-0">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Registration Details</div>
              <div className="font-bold text-slate-900 dark:text-white text-sm sm:text-base truncate">{name}</div>
              <div className="text-xs text-slate-500 dark:text-neutral-400 font-mono truncate">{email}</div>
              <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                Waiting for approval...
              </div>
            </div>

            <button
              onClick={() => {
                setStep('VERIFY_ATTENDEE');
                setIsNewUser(true);
              }}
              className="w-full py-2.5 px-4 bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-700 dark:text-neutral-200 font-bold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer shrink-0"
            >
              Cancel / Edit Details
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'VERIFY_ATTENDEE') {
    return (
      <div className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-white dark:bg-neutral-950 flex flex-col p-4 sm:p-6 transition-colors">
        {renderHeader(false)}

        <div className="w-full max-w-sm mx-auto flex-1 min-h-0 flex flex-col justify-center">
          <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/50 rounded-2xl flex items-center justify-center mb-2 sm:mb-3 text-indigo-600 dark:text-indigo-400 shrink-0">
            {isNewUser ? <UserPlus className="w-6 h-6" /> : <User className="w-6 h-6" />}
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-1 shrink-0">Volunteer Check-In</h2>
          <p className="text-slate-500 dark:text-neutral-400 mb-2 sm:mb-3 text-xs sm:text-sm shrink-0">
            Enter your Full Name and Email Address. Registered volunteers will proceed to clock in/out, or you can register if you are new.
          </p>
          
          {error && (
             <div className="mb-2.5 p-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 rounded-xl text-xs font-medium animate-in fade-in shrink-0">
               {error}
             </div>
          )}

          {infoMessage && (
            <div className="mb-2.5 p-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs font-medium flex items-start gap-2 animate-in fade-in slide-in-from-top-2 shrink-0">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-amber-900 dark:text-amber-100">New Volunteer?</div>
                <div className="mt-0.5">{infoMessage}</div>
              </div>
            </div>
          )}
          
          <form onSubmit={handleVerifyAttendee} className="space-y-3 shrink-0">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-neutral-300 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError('');
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-neutral-900 rounded-xl border border-slate-300 dark:border-neutral-800 text-slate-900 dark:text-white focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
                placeholder="e.g. Thu Htet San"
              />
              <p className="text-[10px] text-slate-400 dark:text-neutral-500 mt-0.5">Must match your name in the registered sheet</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-neutral-300 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError('');
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-neutral-900 rounded-xl border border-slate-300 dark:border-neutral-800 text-slate-900 dark:text-white focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
                placeholder="e.g. THUH0001@e.ntu.edu.sg"
              />
              <p className="text-[10px] text-slate-400 dark:text-neutral-500 mt-0.5">Must match your email in the registered sheet</p>
            </div>

            {isNewUser ? (
              <button 
                type="submit"
                disabled={status === 'loading'}
                className="w-full py-3 mt-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm sm:text-base rounded-xl disabled:opacity-50 transition-all shadow-lg hover:shadow-xl active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
              >
                {status === 'loading' ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Register
                  </>
                )}
              </button>
            ) : (
              <button 
                type="submit"
                disabled={status === 'loading'}
                className="w-full py-3 mt-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm sm:text-base rounded-xl disabled:opacity-50 transition-all shadow-lg hover:shadow-xl active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
              >
                {status === 'loading' ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Verify & Proceed
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}

            <div className="mt-2 text-center">
              {!isNewUser ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsNewUser(true);
                    setError('');
                    setInfoMessage('New volunteer? Tap "Register" to submit your registration request.');
                  }}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  First time here? Register as a new volunteer
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsNewUser(false);
                    setError('');
                    setInfoMessage('');
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-neutral-300 underline cursor-pointer"
                >
                  Already registered? Switch back to Verify & Proceed
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (step === 'SUCCESS') {
    return (
      <div className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-emerald-50 dark:bg-emerald-950 flex flex-col p-4 sm:p-6 text-center animate-in fade-in zoom-in duration-300 transition-colors">
        {renderHeader(false)}

        <div className="w-full max-w-sm mx-auto flex-1 min-h-0 flex flex-col justify-center items-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-500 dark:bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-xl shadow-emerald-200 dark:shadow-emerald-900 mb-3 sm:mb-4 shrink-0">
            <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10" />
          </div>
          
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2 shrink-0">
            {lastAction === 'Clock In' ? 'Successful Clock In!' : lastAction === 'Clock Out' ? 'Successful Clock Out!' : 'Successful Clock In / Out!'}
          </h2>

          <div className="w-full bg-white/90 dark:bg-neutral-900/90 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 sm:p-5 shadow-lg mb-4 text-center">
            <p className="text-base sm:text-lg font-bold text-emerald-800 dark:text-emerald-300">
              You can now close this tab.
            </p>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-neutral-400 mt-1">
              Your attendance ({lastAction || 'Clock In/Out'}) has been recorded in Google Sheets.
            </p>
          </div>

          <div className="mb-6 text-center">
            <p className="text-sm font-bold text-slate-800 dark:text-neutral-200 truncate">{name}</p>
            <p className="text-xs text-slate-400 dark:text-neutral-500 font-mono truncate">{email}</p>
          </div>

          <button 
            onClick={() => { try { window.close(); } catch(e){} }} 
            className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-neutral-900 font-bold rounded-xl shadow-md hover:shadow-lg active:scale-[0.98] transition-all text-sm sm:text-base cursor-pointer shrink-0"
          >
            Close Tab
          </button>
          <p className="text-[11px] text-slate-400 dark:text-neutral-500 mt-2">
            If your browser prevents closing, you can safely close this tab manually.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-slate-50 dark:bg-black flex flex-col p-4 sm:p-6 relative transition-colors select-none">
      {renderHeader(true)}

      <div className="flex-1 min-h-0 flex flex-col justify-center max-w-sm mx-auto w-full">
        {error && (
          <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 rounded-xl text-xs sm:text-sm font-medium animate-in slide-in-from-top-2 shrink-0">
            {error}
          </div>
        )}

        <div className="text-center mb-4 sm:mb-6 shrink-0">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-1">
            Welcome{name ? `, ${name.split(' ')[0]}` : ''}!
          </h2>
          {name && (
            <p className="text-sm font-bold text-slate-700 dark:text-neutral-200 truncate">{name}</p>
          )}
          {email && (
            <p className="text-xs text-slate-500 dark:text-neutral-400 font-mono mt-0.5 mb-1 truncate">{email}</p>
          )}
          <p className="text-slate-500 dark:text-neutral-400 text-xs sm:text-sm mt-1">
            {todayStatus === 'CLOCKED_IN'
              ? 'You have already clocked in for today. Confirm below to clock out.'
              : 'Confirm below to record your clock-in attendance in Google Sheets.'}
          </p>
        </div>
        
        <div className="space-y-3 sm:space-y-4 shrink-0">
          {todayStatus === 'CLOCKED_IN' ? (
            <div className="space-y-3">
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-4 text-center animate-in fade-in">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 mb-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Clocked In Today</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-neutral-400">
                  Your clock-in was recorded today{lastActionTime ? ` at ${formatTimestamp(lastActionTime)}` : ''}.
                </p>
                <p className="text-xs font-semibold text-slate-800 dark:text-neutral-200 mt-1">
                  Ready to end your shift? Confirm below to clock out.
                </p>
              </div>

              <button 
                onClick={() => handleAction('Clock Out')}
                disabled={status === 'loading'}
                className="w-full py-4 sm:py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg sm:text-xl rounded-2xl disabled:opacity-50 transition-all shadow-lg hover:shadow-xl hover:shadow-indigo-500/20 active:scale-[0.98] flex items-center justify-center gap-3 cursor-pointer"
              >
                {status === 'loading' ? (
                  <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <LogOut className="w-5 h-5 sm:w-6 sm:h-6" />
                    <span>Confirm Clock Out</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {todayStatus === 'CLOCKED_OUT' && (
                <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl p-3 text-center text-xs text-indigo-700 dark:text-indigo-300 animate-in fade-in">
                  You clocked out earlier today{lastActionTime ? ` at ${formatTimestamp(lastActionTime)}` : ''}. Tap below to clock in again if starting a new shift.
                </div>
              )}

              <button 
                onClick={() => handleAction('Clock In')}
                disabled={status === 'loading'}
                className="w-full py-4 sm:py-5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-lg sm:text-xl rounded-2xl disabled:opacity-50 transition-all shadow-lg hover:shadow-xl hover:shadow-emerald-500/20 dark:hover:shadow-emerald-900/30 active:scale-[0.98] flex items-center justify-center gap-3 cursor-pointer"
              >
                {status === 'loading' ? (
                  <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
                    <span>Confirm Clock In</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 sm:mt-6 text-center shrink-0">
          <button
            onClick={handleSwitchAccount}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-neutral-300 underline cursor-pointer"
          >
            Not {name || email}? Use different details
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [isKioskUrl, setIsKioskUrl] = useState(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).has('kiosk');
    }
    return false;
  });
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [appMode, setAppMode] = useState<'KIOSK' | 'ADMIN' | null>(null);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check dark mode preference
    const isDarkStored = localStorage.getItem('darkMode') === 'true';
    if (isDarkStored) {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    }
  }, []);

  const toggleDark = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('kiosk')) {
      setIsKioskUrl(true);
    }
    
    // Check local storage for persistent login
    const storedToken = localStorage.getItem('adminToken');
    if (storedToken) setAdminToken(storedToken);
  }, []);

  const handleLogin = (token: string) => {
    setAdminToken(token);
    localStorage.setItem('adminToken', token);
  };

  const handleLogout = () => {
    setAdminToken(null);
    setAppMode(null);
    localStorage.removeItem('adminToken');
  };

  if (isKioskUrl) {
    return (
      <AttendeeView 
        onExit={() => { try { window.close(); } catch(e){} }} 
        isDark={isDark} 
        toggleDark={toggleDark} 
      />
    );
  }

  if (!adminToken) {
    return (
      <div className="h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-col">
        <FloatingControls isDark={isDark} toggleDark={toggleDark} showAdminBtn={false} />
        <LoginView onLogin={handleLogin} />
      </div>
    );
  }

  if (!appMode) {
    return (
      <div className="h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-col">
        <FloatingControls isDark={isDark} toggleDark={toggleDark} showAdminBtn={false} onLogout={handleLogout} />
        <RoleSelectionView onSelect={setAppMode} />
      </div>
    );
  }

  if (appMode === 'KIOSK') {
    return <KioskView onExit={() => setAppMode(null)} adminToken={adminToken} isDark={isDark} toggleDark={toggleDark} />;
  }

  if (appMode === 'ADMIN') {
    return (
      <>
        <AdminDashboard onExit={() => setAppMode(null)} adminToken={adminToken} isDark={isDark} toggleDark={toggleDark} />
      </>
    );
  }

  return null;
}
