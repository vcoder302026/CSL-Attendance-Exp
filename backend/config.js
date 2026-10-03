// This file stores the Google Apps Script Web App URL.
// It is read by the Node.js server and pushed to Google Apps Script.
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwS3FVw_SEPabb3KLWpE_R9bmGEvAaXL533Zb6Zz29q1llqoACZ5MLHvv7cWBGQWMM/exec";

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { APPS_SCRIPT_URL };
}
