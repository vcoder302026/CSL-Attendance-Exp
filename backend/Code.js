// Run this function ONCE from the Apps Script editor to authorize the script
function setup() {
  // This explicitly triggers the Drive and Spreadsheet permission prompts
  DriveApp.searchFiles("mimeType='application/vnd.google-apps.spreadsheet'");
  SpreadsheetApp.create("Temp").getName(); 
}

const LOGS_SHEET_NAME = 'Logs';
const USERS_SHEET_NAME = 'Registrations';

const USER_SHEET_CANDIDATES = ['Registrations', 'Register', 'Registration', 'Users', 'Registered Users', 'Attendee', 'Attendees'];
const LOG_SHEET_CANDIDATES = ['Logs', 'Log', 'Attendance', 'Attendance Logs', 'Scan Logs'];

function findSheet(ss, names) {
  for (let i = 0; i < names.length; i++) {
    const s = ss.getSheetByName(names[i]);
    if (s) return s;
  }
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    const s = sheets[i];
    const sName = s.getName().trim().toLowerCase();
    for (let j = 0; j < names.length; j++) {
      if (sName === names[j].toLowerCase()) return s;
    }
  }
  return null;
}

function getSheet(ss, sheetName) {
  let candidates = [sheetName];
  if (sheetName === USERS_SHEET_NAME || sheetName === 'users' || sheetName === 'user') {
    candidates = USER_SHEET_CANDIDATES;
  } else if (sheetName === LOGS_SHEET_NAME || sheetName === 'logs' || sheetName === 'log') {
    candidates = LOG_SHEET_CANDIDATES;
  }
  
  let sheet = findSheet(ss, candidates);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (sheetName === LOGS_SHEET_NAME) {
      sheet.appendRow(['Timestamp', 'Name', 'Email', 'Action', 'QR Data']);
    } else if (sheetName === USERS_SHEET_NAME) {
      sheet.appendRow(['Registered At', 'Name', 'Email', 'Status']);
    }
  }
  return sheet;
}

function getSpreadsheet(sheetId) {
  if (sheetId) {
    return SpreadsheetApp.openById(sheetId);
  }
  const savedId = PropertiesService.getScriptProperties().getProperty('ACTIVE_SHEET_ID');
  if (savedId) {
    return SpreadsheetApp.openById(savedId);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action; // 'user', 'log', 'createSheet', 'verifySheet', 'searchSheets', 'getActiveSheet'
    const values = data.values;
    const sheetId = data.sheetId;
    
    if (action === 'getActiveSheet') {
      const savedId = PropertiesService.getScriptProperties().getProperty('ACTIVE_SHEET_ID');
      return ContentService.createTextOutput(JSON.stringify({ success: true, sheetId: savedId || null }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'searchSheets') {
      const query = data.query || '';
      // Escape single quotes for the search query
      const safeQuery = query.replace(/'/g, "\\'");
      let searchQuery = "mimeType='application/vnd.google-apps.spreadsheet'";
      if (safeQuery) {
        searchQuery += " and title contains '" + safeQuery + "'";
      }
      const files = DriveApp.searchFiles(searchQuery);
      const sheets = [];
      let count = 0;
      while (files.hasNext() && count < 20) {
        const file = files.next();
        sheets.push({ id: file.getId(), name: file.getName(), url: file.getUrl() });
        count++;
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true, sheets: sheets }))
        .setMimeType(ContentService.MimeType.JSON);
    }
        
    if (action === 'createSheet') {
      const newSs = SpreadsheetApp.create('CSL Attendance Data');
      try {
        newSs.setSpreadsheetTimeZone('Asia/Singapore');
      } catch (tzErr) {}
      getSheet(newSs, LOGS_SHEET_NAME);
      getSheet(newSs, USERS_SHEET_NAME);
      // Remove default "Sheet1" if it exists and wasn't renamed
      const sheet1 = newSs.getSheetByName('Sheet1');
      if (sheet1) newSs.deleteSheet(sheet1);
      
      PropertiesService.getScriptProperties().setProperty('ACTIVE_SHEET_ID', newSs.getId());
      
      return ContentService.createTextOutput(JSON.stringify({ success: true, sheetId: newSs.getId(), url: newSs.getUrl() }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'verifySheet') {
      const ss = getSpreadsheet(sheetId);
      // This will check and create tabs if they don't exist
      getSheet(ss, LOGS_SHEET_NAME);
      getSheet(ss, USERS_SHEET_NAME);
      
      PropertiesService.getScriptProperties().setProperty('ACTIVE_SHEET_ID', ss.getId());
      
      return ContentService.createTextOutput(JSON.stringify({ success: true, sheetId: ss.getId(), name: ss.getName() }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'deleteLog') {
      const ss = getSpreadsheet(sheetId);
      const sheet = getSheet(ss, LOGS_SHEET_NAME);
      const rawData = sheet.getDataRange().getDisplayValues();
      const targetTime = (data.timestamp || '').trim();
      const targetName = (data.name || '').trim().toLowerCase();
      const targetEmail = (data.email || '').trim().toLowerCase();
      const targetAction = (data.actionName || '').trim().toLowerCase();

      let deleted = false;
      // Search from bottom to top to delete newest matching entry first
      for (let r = rawData.length; r >= 2; r--) {
        const row = rawData[r - 1];
        const rowTime = (row[0] || '').trim();
        const rowName = (row[1] || '').trim().toLowerCase();
        const rowEmail = (row[2] || '').trim().toLowerCase();
        const rowAct = (row[3] || '').trim().toLowerCase();

        const matchEmail = !targetEmail || rowEmail === targetEmail;
        const matchAction = !targetAction || rowAct === targetAction;
        const matchName = !targetName || rowName === targetName;
        const matchTime = !targetTime || rowTime === targetTime || rowTime.includes(targetTime) || targetTime.includes(rowTime);

        if (matchEmail && matchAction && (matchTime || matchName)) {
          sheet.deleteRow(r);
          deleted = true;
          break;
        }
      }

      return ContentService.createTextOutput(JSON.stringify({ success: true, deleted: deleted }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    const ss = getSpreadsheet(sheetId);
    let sheetName = '';
    if (action === 'user') sheetName = USERS_SHEET_NAME;
    else if (action === 'log') sheetName = LOGS_SHEET_NAME;
    
    if (sheetName) {
      const sheet = getSheet(ss, sheetName);
      sheet.appendRow(values);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    const type = e.parameter.type;
    const sheetId = e.parameter.sheetId;
    const ss = getSpreadsheet(sheetId);
    
    let sheetName = '';
    if (type === 'users') sheetName = USERS_SHEET_NAME;
    else if (type === 'logs') sheetName = LOGS_SHEET_NAME;
    
    if (sheetName) {
      const sheet = getSheet(ss, sheetName);
      const data = sheet.getDataRange().getDisplayValues();
      // Remove header row
      if (data.length > 0) data.shift();
      return ContentService.createTextOutput(JSON.stringify({ data: data }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ error: 'Invalid type' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
