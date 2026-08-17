const fs = require('fs');
const path = require('path');

/**
 * documentParserService.js
 * PDF, DOCX, TXT 파일을 텍스트로 변환하는 서비스
 */

/**
 * 파일을 읽어 plain text로 변환
 * @param {string} filePath - 파일 경로
 * @param {string} originalName - 원래 파일명 (확장자 판별용)
 * @returns {Promise<string>} 추출된 텍스트
 */
async function parseDocument(filePath, originalName) {
  const ext = path.extname(originalName || filePath).toLowerCase();

  switch (ext) {
    case '.pdf':
      return parsePdf(filePath);
    case '.docx':
      return parseDocx(filePath);
    case '.txt':
    case '.md':
      return parseTxt(filePath);
    default:
      throw new Error(`지원하지 않는 파일 형식입니다: ${ext} (지원: PDF, DOCX, TXT, MD)`);
  }
}

/**
 * PDF → plain text
 */
async function parsePdf(filePath) {
  const pdfParse = require('pdf-parse');
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  return data.text || '';
}

/**
 * DOCX → plain text
 */
async function parseDocx(filePath) {
  const mammoth = require('mammoth');
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value || '';
}

/**
 * TXT / MD → plain text
 */
async function parseTxt(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

module.exports = { parseDocument };
