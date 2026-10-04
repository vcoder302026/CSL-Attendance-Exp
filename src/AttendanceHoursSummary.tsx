import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  Clock, 
  Users, 
  CheckCircle2, 
  Search, 
  Download, 
  ChevronDown, 
  ChevronRight, 
  ArrowUpDown, 
  Filter, 
  RefreshCw, 
  X, 
  AlertCircle,
  BarChart3,
  Layers,
  UserCheck
} from 'lucide-react';
import { cn } from './lib/utils';

export interface SessionRecord {
  id: string;
  volunteerName: string;
  volunteerEmail: string;
  dateKey: string; // YYYY-MM-DD
  displayDate: string; // e.g. Sat, 12 Sep 2026
  rawInTimestamp: string | null;
  rawOutTimestamp: string | null;
  inTime: string | null;
  outTime: string | null;
  durationMinutes: number;
  formattedDuration: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'MISSING_IN';
  dateObj: Date;
}

export interface VolunteerSummary {
  name: string;
  email: string;
  totalMinutes: number;
  formattedTotalTime: string;
  sessionsCount: number;
  completedSessionsCount: number;
  datesAttended: string[];
  sessions: SessionRecord[];
  mostRecentDateObj: Date | null;
}

interface AttendanceHoursSummaryProps {
  logs: string[][];
  isLoading?: boolean;
  onRefresh?: () => void;
}

// Helper: Parse various timestamp strings into Date objects
function parseLogTimestamp(str: string): Date | null {
  if (!str) return null;
  const trimmed = str.trim();

  // Pattern: "12 Sep 2026 | 02:29 PM"
  const m = trimmed.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s*\|\s*(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (m) {
    const [, day, monthStr, year, hourStr, minStr, ampm] = m;
    const months: Record<string, number> = { 
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, 
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 
    };
    const month = months[monthStr.toLowerCase()];
    if (month === undefined) return null;
    let hour = parseInt(hourStr, 10);
    if (ampm.toUpperCase() === 'PM' && hour < 12) hour += 12;
    if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
    return new Date(parseInt(year, 10), month, parseInt(day, 10), hour, parseInt(minStr, 10), 0);
  }

  // ISO string: "2026-09-12T17:14:00.000Z"
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]00:?00)?$/i);
  if (isoMatch) {
    const [, year, month, day, hours, minutes] = isoMatch;
    return new Date(Date.UTC(+year, +month - 1, +day, +hours, +minutes));
  }

  // Fallback to standard Date parsing
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d;
}

// Helper: Format Date to YYYY-MM-DD
function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Helper: Format Date for readable display (e.g. Sat, 12 Sep 2026)
function formatDisplayDate(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit', 
    month: 'short', 
    year: 'numeric', 
    weekday: 'short'
  }).formatToParts(d);
  const p: Record<string, string> = {};
  for (const part of parts) p[part.type] = part.value;
  return `${p.weekday}, ${p.day} ${p.month} ${p.year}`;
}

// Helper: Extract time portion only
function extractTimeOnly(timestampStr: string): string {
  if (!timestampStr) return '—';
  if (timestampStr.includes('|')) {
    const parts = timestampStr.split('|');
    return parts[1] ? parts[1].trim() : timestampStr;
  }
  const d = parseLogTimestamp(timestampStr);
  if (!d) return timestampStr;
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: true
  }).format(d);
}

// Helper: Format total minutes to human duration "2h 45m"
function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0m';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

// Helper: Today in YYYY-MM-DD format (Singapore / local)
function getTodayDateString(): string {
  const now = new Date();
  return formatDateKey(now);
}

export function AttendanceHoursSummary({ logs, isLoading = false, onRefresh }: AttendanceHoursSummaryProps) {
  // Date range filter states
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [activePreset, setActivePreset] = useState<'ALL' | 'THIS_MONTH' | 'LAST_30' | 'THIS_WEEK' | 'TODAY' | 'CUSTOM'>('ALL');

  // Search & view mode states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'VOLUNTEERS' | 'SESSIONS'>('VOLUNTEERS');
  const [sortMode, setSortMode] = useState<'HOURS_DESC' | 'HOURS_ASC' | 'SESSIONS_DESC' | 'NAME_ASC' | 'DATE_DESC'>('HOURS_DESC');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'COMPLETED' | 'IN_PROGRESS'>('ALL');

  // Track expanded volunteer cards
  const [expandedVolunteers, setExpandedVolunteers] = useState<Set<string>>(new Set());

  // Quick preset filters
  const applyPreset = (preset: 'ALL' | 'THIS_MONTH' | 'LAST_30' | 'THIS_WEEK' | 'TODAY') => {
    const now = new Date();
    setActivePreset(preset);

    if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
      return;
    }

    if (preset === 'TODAY') {
      const todayStr = formatDateKey(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
      return;
    }

    if (preset === 'THIS_MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(formatDateKey(start));
      setEndDate(formatDateKey(end));
      return;
    }

    if (preset === 'LAST_30') {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      setStartDate(formatDateKey(start));
      setEndDate(formatDateKey(now));
      return;
    }

    if (preset === 'THIS_WEEK') {
      const day = now.getDay();
      // Monday as first day of week
      const diffToMonday = (day === 0 ? -6 : 1) - day;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diffToMonday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      setStartDate(formatDateKey(monday));
      setEndDate(formatDateKey(sunday));
      return;
    }
  };

  const handleCustomStartDate = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStartDate(e.target.value);
    setActivePreset('CUSTOM');
  };

  const handleCustomEndDate = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEndDate(e.target.value);
    setActivePreset('CUSTOM');
  };

  const clearDateRange = () => {
    setStartDate('');
    setEndDate('');
    setActivePreset('ALL');
  };

  // Toggle individual volunteer card expansion
  const toggleVolunteerExpand = (key: string) => {
    setExpandedVolunteers(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Toggle expand / collapse all
  const toggleExpandAll = (volunteersList: VolunteerSummary[]) => {
    if (expandedVolunteers.size === volunteersList.length) {
      setExpandedVolunteers(new Set());
    } else {
      setExpandedVolunteers(new Set(volunteersList.map(v => (v.email || v.name).toLowerCase())));
    }
  };

  // Consolidated Processing Pipeline
  const { volunteerSummaries, allSessionsList, organizationTotals } = useMemo(() => {
    // Step 1: Parse and validate all logs
    interface ParsedLogItem {
      timeStr: string;
      name: string;
      email: string;
      action: string;
      dateObj: Date;
    }

    const validLogs: ParsedLogItem[] = [];
    for (const row of logs) {
      if (!row || row.length < 3) continue;
      const timeStr = row[0] || '';
      const name = (row[1] || '').trim();
      const email = (row[2] || '').trim();
      const action = (row[3] || '').trim();
      const dateObj = parseLogTimestamp(timeStr);
      if (dateObj) {
        validLogs.push({ timeStr, name, email, action, dateObj });
      }
    }

    // Step 2: Sort chronologically ascending
    validLogs.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

    // Step 3: Group by person (normalized email or name)
    const personMap = new Map<string, { name: string; email: string; logs: ParsedLogItem[] }>();
    for (const log of validLogs) {
      const key = (log.email || log.name).toLowerCase();
      if (!personMap.has(key)) {
        personMap.set(key, { name: log.name, email: log.email, logs: [] });
      }
      const p = personMap.get(key)!;
      if (!p.name && log.name) p.name = log.name;
      p.logs.push(log);
    }

    // Step 4: For each person, group by date and pair Clock In with Clock Out
    const summaries: VolunteerSummary[] = [];
    const allFilteredSessions: SessionRecord[] = [];

    for (const [personKey, person] of personMap.entries()) {
      // Group person's logs by dateKey (YYYY-MM-DD)
      const logsByDate = new Map<string, ParsedLogItem[]>();
      for (const item of person.logs) {
        const dk = formatDateKey(item.dateObj);
        if (!logsByDate.has(dk)) logsByDate.set(dk, []);
        logsByDate.get(dk)!.push(item);
      }

      const personSessions: SessionRecord[] = [];
      let sessionIndex = 0;

      for (const [dateKey, dayLogs] of logsByDate.entries()) {
        dayLogs.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
        let pendingIn: ParsedLogItem | null = null;

        for (const item of dayLogs) {
          const isClockIn = item.action.toLowerCase().includes('in');
          const isClockOut = item.action.toLowerCase().includes('out');

          if (isClockIn) {
            if (pendingIn) {
              // If repeated clock in occurs after more than 15 mins, treat previous as incomplete
              const gapMs = item.dateObj.getTime() - pendingIn.dateObj.getTime();
              if (gapMs > 15 * 60 * 1000) {
                sessionIndex++;
                personSessions.push({
                  id: `${personKey}-${dateKey}-${sessionIndex}`,
                  volunteerName: person.name,
                  volunteerEmail: person.email,
                  dateKey,
                  displayDate: formatDisplayDate(pendingIn.dateObj),
                  rawInTimestamp: pendingIn.timeStr,
                  rawOutTimestamp: null,
                  inTime: extractTimeOnly(pendingIn.timeStr),
                  outTime: null,
                  durationMinutes: 0,
                  formattedDuration: 'No Clock Out',
                  status: 'IN_PROGRESS',
                  dateObj: pendingIn.dateObj
                });
                pendingIn = item;
              }
            } else {
              pendingIn = item;
            }
          } else if (isClockOut) {
            sessionIndex++;
            if (pendingIn) {
              const diffMs = item.dateObj.getTime() - pendingIn.dateObj.getTime();
              const mins = Math.max(0, Math.round(diffMs / 60000));
              personSessions.push({
                id: `${personKey}-${dateKey}-${sessionIndex}`,
                volunteerName: person.name,
                volunteerEmail: person.email,
                dateKey,
                displayDate: formatDisplayDate(pendingIn.dateObj),
                rawInTimestamp: pendingIn.timeStr,
                rawOutTimestamp: item.timeStr,
                inTime: extractTimeOnly(pendingIn.timeStr),
                outTime: extractTimeOnly(item.timeStr),
                durationMinutes: mins,
                formattedDuration: formatDuration(mins),
                status: 'COMPLETED',
                dateObj: pendingIn.dateObj
              });
              pendingIn = null;
            } else {
              personSessions.push({
                id: `${personKey}-${dateKey}-${sessionIndex}`,
                volunteerName: person.name,
                volunteerEmail: person.email,
                dateKey,
                displayDate: formatDisplayDate(item.dateObj),
                rawInTimestamp: null,
                rawOutTimestamp: item.timeStr,
                inTime: null,
                outTime: extractTimeOnly(item.timeStr),
                durationMinutes: 0,
                formattedDuration: 'No Clock In',
                status: 'MISSING_IN',
                dateObj: item.dateObj
              });
            }
          }
        }

        if (pendingIn) {
          sessionIndex++;
          personSessions.push({
            id: `${personKey}-${dateKey}-${sessionIndex}`,
            volunteerName: person.name,
            volunteerEmail: person.email,
            dateKey,
            displayDate: formatDisplayDate(pendingIn.dateObj),
            rawInTimestamp: pendingIn.timeStr,
            rawOutTimestamp: null,
            inTime: extractTimeOnly(pendingIn.timeStr),
            outTime: null,
            durationMinutes: 0,
            formattedDuration: 'In Progress',
            status: 'IN_PROGRESS',
            dateObj: pendingIn.dateObj
          });
        }
      }

      // Step 5: Filter sessions according to Start Date and End Date
      const filteredPersonSessions = personSessions.filter(session => {
        if (startDate && session.dateKey < startDate) return false;
        if (endDate && session.dateKey > endDate) return false;
        if (filterStatus === 'COMPLETED' && session.status !== 'COMPLETED') return false;
        if (filterStatus === 'IN_PROGRESS' && session.status === 'COMPLETED') return false;
        return true;
      });

      // If person has sessions in range, calculate totals
      if (filteredPersonSessions.length > 0) {
        let totalMins = 0;
        let completedCount = 0;
        const uniqueDates = new Set<string>();
        let latestDate: Date | null = null;

        for (const s of filteredPersonSessions) {
          totalMins += s.durationMinutes;
          if (s.status === 'COMPLETED') completedCount++;
          uniqueDates.add(s.displayDate);
          if (!latestDate || s.dateObj.getTime() > latestDate.getTime()) {
            latestDate = s.dateObj;
          }
          allFilteredSessions.push(s);
        }

        summaries.push({
          name: person.name || personKey,
          email: person.email || '',
          totalMinutes: totalMins,
          formattedTotalTime: formatDuration(totalMins),
          sessionsCount: filteredPersonSessions.length,
          completedSessionsCount: completedCount,
          datesAttended: Array.from(uniqueDates),
          sessions: filteredPersonSessions,
          mostRecentDateObj: latestDate
        });
      }
    }

    // Step 6: Filter by search query (name or email)
    const query = searchQuery.trim().toLowerCase();
    const searchedSummaries = query
      ? summaries.filter(s => s.name.toLowerCase().includes(query) || s.email.toLowerCase().includes(query))
      : summaries;

    // Step 7: Sort volunteers
    searchedSummaries.sort((a, b) => {
      if (sortMode === 'HOURS_DESC') return b.totalMinutes - a.totalMinutes;
      if (sortMode === 'HOURS_ASC') return a.totalMinutes - b.totalMinutes;
      if (sortMode === 'SESSIONS_DESC') return b.sessionsCount - a.sessionsCount;
      if (sortMode === 'NAME_ASC') return a.name.localeCompare(b.name);
      if (sortMode === 'DATE_DESC') {
        const timeA = a.mostRecentDateObj ? a.mostRecentDateObj.getTime() : 0;
        const timeB = b.mostRecentDateObj ? b.mostRecentDateObj.getTime() : 0;
        return timeB - timeA;
      }
      return 0;
    });

    // Sort all sessions flat list chronologically descending
    allFilteredSessions.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());

    // Step 8: Calculate overall organization totals
    const totalMinutesOrg = summaries.reduce((acc, curr) => acc + curr.totalMinutes, 0);
    const totalCompletedOrg = summaries.reduce((acc, curr) => acc + curr.completedSessionsCount, 0);
    const totalSessionsOrg = summaries.reduce((acc, curr) => acc + curr.sessionsCount, 0);
    const avgSessionMinutesOrg = totalCompletedOrg > 0 ? Math.round(totalMinutesOrg / totalCompletedOrg) : 0;

    return {
      volunteerSummaries: searchedSummaries,
      allSessionsList: allFilteredSessions,
      organizationTotals: {
        activeVolunteers: summaries.length,
        totalSessions: totalSessionsOrg,
        completedSessions: totalCompletedOrg,
        totalMinutes: totalMinutesOrg,
        formattedTotalHours: (totalMinutesOrg / 60).toFixed(1),
        formattedDuration: formatDuration(totalMinutesOrg),
        avgSessionDuration: formatDuration(avgSessionMinutesOrg)
      }
    };
  }, [logs, startDate, endDate, searchQuery, sortMode, filterStatus]);

  // Export to CSV functionality
  const handleExportCSV = () => {
    if (allSessionsList.length === 0) return;

    const headers = [
      'Volunteer Name',
      'Email',
      'Session Date',
      'Clock In',
      'Clock Out',
      'Duration (Minutes)',
      'Duration (Formatted)',
      'Status',
      'Person Total In Period'
    ];

    // Build person totals map
    const personTotalMap = new Map<string, string>();
    for (const v of volunteerSummaries) {
      personTotalMap.set((v.email || v.name).toLowerCase(), v.formattedTotalTime);
    }

    const rows = allSessionsList.map(session => {
      const key = (session.volunteerEmail || session.volunteerName).toLowerCase();
      const personTotal = personTotalMap.get(key) || session.formattedDuration;
      return [
        `"${session.volunteerName.replace(/"/g, '""')}"`,
        `"${session.volunteerEmail.replace(/"/g, '""')}"`,
        `"${session.displayDate}"`,
        `"${session.inTime || '—'}"`,
        `"${session.outTime || '—'}"`,
        session.durationMinutes,
        `"${session.formattedDuration}"`,
        `"${session.status}"`,
        `"${personTotal}"`
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const startPart = startDate || 'all';
    const endPart = endDate || 'today';
    link.href = url;
    link.setAttribute('download', `CSL_Attendance_Hours_Summary_${startPart}_to_${endPart}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col gap-6 animate-in fade-in duration-200">
      {/* View Header & Title */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Attendance & Volunteer Hours
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-neutral-400 mt-1">
            Consolidate individual session dates, shift durations, and total hours served across any date range.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-slate-700 dark:text-neutral-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl transition-all shadow-sm text-xs font-semibold hover:border-indigo-400 active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Refresh attendance records"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin text-indigo-600")} />
              <span>Refresh</span>
            </button>
          )}

          <button
            onClick={handleExportCSV}
            disabled={allSessionsList.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer"
            title="Download full report as CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV Report</span>
          </button>
        </div>
      </div>

      {/* Date Range Selector & Presets Card */}
      <div className="bg-white dark:bg-neutral-950 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-neutral-900 shadow-sm">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          {/* Inputs for Start Date & End Date */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">
                Start:
              </span>
              <div className="relative">
                <input
                  type="date"
                  value={startDate}
                  onChange={handleCustomStartDate}
                  className="pl-3 pr-2 py-1.5 text-xs sm:text-sm font-medium bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all cursor-pointer"
                  title="Filter from start date"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">
                End:
              </span>
              <div className="relative">
                <input
                  type="date"
                  value={endDate}
                  onChange={handleCustomEndDate}
                  className="pl-3 pr-2 py-1.5 text-xs sm:text-sm font-medium bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all cursor-pointer"
                  title="Filter up to end date"
                />
              </div>
            </div>

            {(startDate || endDate) && (
              <button
                onClick={clearDateRange}
                className="text-xs text-slate-500 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white underline underline-offset-4 cursor-pointer px-1 py-1"
                title="Clear date range filters"
              >
                Clear Dates
              </button>
            )}
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-neutral-900 rounded-xl">
            <button
              onClick={() => applyPreset('ALL')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap",
                activePreset === 'ALL'
                  ? "bg-white dark:bg-neutral-800 text-indigo-700 dark:text-indigo-300 shadow-sm font-bold"
                  : "text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              All Time
            </button>
            <button
              onClick={() => applyPreset('THIS_MONTH')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap",
                activePreset === 'THIS_MONTH'
                  ? "bg-white dark:bg-neutral-800 text-indigo-700 dark:text-indigo-300 shadow-sm font-bold"
                  : "text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              This Month
            </button>
            <button
              onClick={() => applyPreset('LAST_30')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap",
                activePreset === 'LAST_30'
                  ? "bg-white dark:bg-neutral-800 text-indigo-700 dark:text-indigo-300 shadow-sm font-bold"
                  : "text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              Last 30 Days
            </button>
            <button
              onClick={() => applyPreset('THIS_WEEK')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap",
                activePreset === 'THIS_WEEK'
                  ? "bg-white dark:bg-neutral-800 text-indigo-700 dark:text-indigo-300 shadow-sm font-bold"
                  : "text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              This Week
            </button>
            <button
              onClick={() => applyPreset('TODAY')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap",
                activePreset === 'TODAY'
                  ? "bg-white dark:bg-neutral-800 text-indigo-700 dark:text-indigo-300 shadow-sm font-bold"
                  : "text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              Today
            </button>
          </div>
        </div>
      </div>

      {/* Aggregate Metric Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-neutral-950 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-neutral-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">
              Total Volunteer Hours
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
              {organizationTotals.formattedDuration}
            </span>
            <span className="text-xs text-slate-500 dark:text-neutral-400 font-medium">
              ({organizationTotals.formattedTotalHours} hrs)
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-1">
            Across {organizationTotals.completedSessions} completed shifts
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-950 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-neutral-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">
              Active Volunteers
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
              {organizationTotals.activeVolunteers}
            </span>
            <span className="text-xs text-slate-500 dark:text-neutral-400 font-medium">
              people
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-1">
            Attended in selected range
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-950 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-neutral-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">
              Total Sessions
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
              {organizationTotals.totalSessions}
            </span>
            <span className="text-xs text-slate-500 dark:text-neutral-400 font-medium">
              shifts
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-1">
            {organizationTotals.completedSessions} complete · {organizationTotals.totalSessions - organizationTotals.completedSessions} in progress
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-950 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-neutral-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">
              Avg Session Length
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
              {organizationTotals.avgSessionDuration}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-1">
            Per completed volunteer shift
          </p>
        </div>
      </div>

      {/* Filter and View Mode Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-3">
          {/* Search by Volunteer Name or Email */}
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search by volunteer name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-xs sm:text-sm shadow-sm transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1.5 shrink-0">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as any)}
              className="py-2 pl-2 pr-7 text-xs font-semibold bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 text-slate-700 dark:text-neutral-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none cursor-pointer shadow-sm"
            >
              <option value="HOURS_DESC">Most Hours (High to Low)</option>
              <option value="HOURS_ASC">Least Hours (Low to High)</option>
              <option value="SESSIONS_DESC">Most Sessions</option>
              <option value="NAME_ASC">Name (A to Z)</option>
              <option value="DATE_DESC">Most Recent Attendance</option>
            </select>
          </div>
        </div>

        {/* View Switcher: By Volunteer vs All Sessions */}
        <div className="flex items-center gap-2">
          {viewMode === 'VOLUNTEERS' && (
            <button
              onClick={() => toggleExpandAll(volunteerSummaries)}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors cursor-pointer whitespace-nowrap"
            >
              {expandedVolunteers.size === volunteerSummaries.length ? 'Collapse All' : 'Expand All'}
            </button>
          )}

          <div className="flex p-1 bg-slate-100 dark:bg-neutral-900 rounded-xl shrink-0">
            <button
              onClick={() => setViewMode('VOLUNTEERS')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap",
                viewMode === 'VOLUNTEERS'
                  ? "bg-white dark:bg-neutral-800 text-indigo-700 dark:text-indigo-300 shadow-sm"
                  : "text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              By Volunteer ({volunteerSummaries.length})
            </button>
            <button
              onClick={() => setViewMode('SESSIONS')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap",
                viewMode === 'SESSIONS'
                  ? "bg-white dark:bg-neutral-800 text-indigo-700 dark:text-indigo-300 shadow-sm"
                  : "text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              All Sessions ({allSessionsList.length})
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === 'VOLUNTEERS' ? (
        /* ============================================================== */
        /* VIEW MODE 1: CONSOLIDATED BY VOLUNTEER                          */
        /* ============================================================== */
        <div className="space-y-3">
          {volunteerSummaries.length === 0 ? (
            <div className="bg-white dark:bg-neutral-950 p-12 text-center rounded-2xl border border-slate-200 dark:border-neutral-900 shadow-sm flex flex-col items-center justify-center">
              <Calendar className="w-12 h-12 text-slate-300 dark:text-neutral-700 mb-3" />
              <p className="text-base font-medium text-slate-900 dark:text-white">
                No attendance sessions found
              </p>
              <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1 max-w-md">
                {startDate || endDate
                  ? 'No volunteer shifts recorded within this date range. Try widening the dates or selecting "All Time".'
                  : 'No scan logs have been recorded yet. Volunteer check-ins will appear here with calculated session durations.'}
              </p>
              {(startDate || endDate) && (
                <button
                  onClick={clearDateRange}
                  className="mt-4 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors cursor-pointer"
                >
                  Reset Date Filter
                </button>
              )}
            </div>
          ) : (
            volunteerSummaries.map((volunteer) => {
              const personKey = (volunteer.email || volunteer.name).toLowerCase();
              const isExpanded = expandedVolunteers.has(personKey);
              const initials = volunteer.name
                .split(' ')
                .filter(Boolean)
                .map(p => p[0])
                .slice(0, 2)
                .join('')
                .toUpperCase() || 'V';

              return (
                <div
                  key={personKey}
                  className="bg-white dark:bg-neutral-950 rounded-2xl border border-slate-200 dark:border-neutral-900 shadow-sm hover:shadow-md transition-all overflow-hidden"
                >
                  {/* Volunteer Header Card / Trigger */}
                  <div
                    onClick={() => toggleVolunteerExpand(personKey)}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-neutral-900/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center text-sm shrink-0 border border-indigo-200 dark:border-indigo-800/40">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base truncate">
                            {volunteer.name}
                          </h3>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-neutral-400 truncate">
                          {volunteer.email || 'No email provided'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100 dark:border-neutral-900">
                      {/* Dates Attended Inline Summary */}
                      <div className="hidden md:flex flex-col items-end max-w-xs">
                        <span className="text-[10px] font-semibold text-slate-400 dark:text-neutral-500 uppercase tracking-wider">
                          Dates Attended ({volunteer.datesAttended.length})
                        </span>
                        <p className="text-xs text-slate-600 dark:text-neutral-300 font-medium truncate text-right">
                          {volunteer.datesAttended.slice(0, 2).join(' · ')}
                          {volunteer.datesAttended.length > 2 && ` +${volunteer.datesAttended.length - 2} more`}
                        </p>
                      </div>

                      {/* Sessions Count */}
                      <div className="flex flex-col items-start sm:items-end">
                        <span className="text-[10px] font-semibold text-slate-400 dark:text-neutral-500 uppercase tracking-wider">
                          Sessions
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-neutral-200">
                          {volunteer.sessionsCount} {volunteer.sessionsCount === 1 ? 'shift' : 'shifts'}
                        </span>
                      </div>

                      {/* Total Time Spent at Session */}
                      <div className="flex flex-col items-start sm:items-end">
                        <span className="text-[10px] font-semibold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider">
                          Total Time
                        </span>
                        <span className="text-base sm:text-lg font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
                          {volunteer.formattedTotalTime}
                        </span>
                      </div>

                      {/* Expand / Collapse Chevron */}
                      <div className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Breakdown of Sessions */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 dark:border-neutral-900 bg-slate-50/70 dark:bg-neutral-900/40 p-4 sm:p-5">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 dark:text-neutral-300 uppercase tracking-wider">
                          Individual Session Breakdown ({volunteer.sessions.length})
                        </span>
                        <span className="text-xs text-slate-500 dark:text-neutral-400">
                          Consolidated time: <strong className="font-mono text-indigo-600 dark:text-indigo-400">{volunteer.formattedTotalTime}</strong>
                        </span>
                      </div>

                      <div className="bg-white dark:bg-neutral-950 rounded-xl border border-slate-200 dark:border-neutral-900 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs sm:text-sm">
                            <thead className="bg-slate-100/70 dark:bg-neutral-900/80 border-b border-slate-200 dark:border-neutral-900 text-slate-500 dark:text-neutral-400 text-[11px] uppercase tracking-wider">
                              <tr>
                                <th className="px-4 py-2.5 font-bold">Session Date</th>
                                <th className="px-4 py-2.5 font-bold">Clock In</th>
                                <th className="px-4 py-2.5 font-bold">Clock Out</th>
                                <th className="px-4 py-2.5 font-bold">Time Spent</th>
                                <th className="px-4 py-2.5 font-bold text-right">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-neutral-900">
                              {volunteer.sessions.map((session) => (
                                <tr key={session.id} className="hover:bg-slate-50/60 dark:hover:bg-neutral-900/50 transition-colors">
                                  <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                      <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                                      <span>{session.displayDate}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-slate-700 dark:text-neutral-300 font-mono whitespace-nowrap">
                                    {session.inTime || '—'}
                                  </td>
                                  <td className="px-4 py-3 text-slate-700 dark:text-neutral-300 font-mono whitespace-nowrap">
                                    {session.outTime || '—'}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    {session.status === 'COMPLETED' ? (
                                      <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                                        {session.formattedDuration}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 font-medium">
                                        {session.formattedDuration}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-right whitespace-nowrap">
                                    {session.status === 'COMPLETED' ? (
                                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                        Completed
                                      </span>
                                    ) : session.status === 'IN_PROGRESS' ? (
                                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                                        In Progress
                                      </span>
                                    ) : (
                                      <span className="text-xs font-semibold text-red-500">
                                        Missing Clock In
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* ============================================================== */
        /* VIEW MODE 2: FLAT LIST OF ALL SESSIONS                         */
        /* ============================================================== */
        <div className="bg-white dark:bg-neutral-950 rounded-2xl border border-slate-200 dark:border-neutral-900 shadow-sm overflow-hidden flex flex-col">
          {allSessionsList.length === 0 ? (
            <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center">
              <Calendar className="w-12 h-12 text-slate-300 dark:text-neutral-700 mb-3" />
              <p className="text-base font-medium text-slate-900 dark:text-white">
                No sessions found
              </p>
              <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1">
                No shift records matched the selected date parameters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-100/70 dark:bg-neutral-900/80 border-b border-slate-200 dark:border-neutral-900 text-slate-500 dark:text-neutral-400 text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3 font-bold">Session Date</th>
                    <th className="px-5 py-3 font-bold">Volunteer</th>
                    <th className="px-5 py-3 font-bold">Clock In</th>
                    <th className="px-5 py-3 font-bold">Clock Out</th>
                    <th className="px-5 py-3 font-bold">Time Spent</th>
                    <th className="px-5 py-3 font-bold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-neutral-900">
                  {allSessionsList.map((session) => (
                    <tr key={session.id} className="hover:bg-slate-50/60 dark:hover:bg-neutral-900/50 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{session.displayDate}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-slate-900 dark:text-white truncate">
                            {session.volunteerName}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-neutral-400 truncate">
                            {session.volunteerEmail}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-700 dark:text-neutral-300 font-mono whitespace-nowrap">
                        {session.inTime || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-700 dark:text-neutral-300 font-mono whitespace-nowrap">
                        {session.outTime || '—'}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {session.status === 'COMPLETED' ? (
                          <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono text-sm">
                            {session.formattedDuration}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">
                            {session.formattedDuration}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        {session.status === 'COMPLETED' ? (
                          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            Completed
                          </span>
                        ) : session.status === 'IN_PROGRESS' ? (
                          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                            In Progress
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-red-500">
                            Missing In
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
