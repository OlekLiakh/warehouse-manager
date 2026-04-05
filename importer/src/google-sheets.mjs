/**
 * Google Sheets API integration — STUB.
 * Will be implemented once GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY
 * are configured in .env.local by Olek.
 *
 * Future functionality:
 * - Fetch CSV from a Google Sheets file by ID
 * - List files in a Google Drive folder
 * - Return Buffer in the same format as local file reads
 */

/**
 * Download a Google Sheet as CSV buffer.
 * @param {string} fileId - Google Sheets file ID
 * @returns {Promise<Buffer>}
 */
export async function fetchSheetAsCSV(fileId) {
  throw new Error(
    'Google Sheets API не налаштовано. Встанови GOOGLE_SERVICE_ACCOUNT_EMAIL і GOOGLE_PRIVATE_KEY в .env.local'
  )
}

/**
 * List Google Sheets files in a Drive folder.
 * @param {string} folderId - Google Drive folder ID
 * @returns {Promise<Array<{ id: string, name: string }>>}
 */
export async function listSheetFiles(folderId) {
  throw new Error('Google Sheets API не налаштовано.')
}
