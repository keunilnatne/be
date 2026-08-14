const fs = require('fs');
const path = require('path');

// Gmail 연동(OAuth 토큰) 임시 저장소. DB 테이블 대신 로컬 JSON 파일 사용.
// (토큰을 공유 DB에 넣지 않기 위함 + 스키마 변경 없이 빠르게 반복하기 위함)
// TODO: 운영 단계에서는 암호화된 DB 컬럼 또는 별도 시크릿 스토어로 교체.
const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE_PATH = path.join(DATA_DIR, 'googleAccounts.json');

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE_PATH)) fs.writeFileSync(FILE_PATH, '{}', 'utf-8');
}

function readAll() {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(FILE_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function writeAll(data) {
  ensureFile();
  fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function getByUserId(userId) {
  return readAll()[String(userId)] || null;
}

function upsert(userId, account) {
  const all = readAll();
  const key = String(userId);
  all[key] = { ...(all[key] || {}), ...account, userId: Number(userId) };
  writeAll(all);
  return all[key];
}

module.exports = { getByUserId, upsert };
