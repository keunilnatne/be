const env = require('../config/env');

/**
 * companyDnaExtractionService.js
 * 텍스트(문서/이메일)에서 Gemini AI를 사용해 Company DNA를 구조화 JSON으로 추출
 * ※ 모델 학습/파인튜닝 없이 Zero-Shot Structured Extraction
 */

const EXTRACTION_PROMPT = `당신은 조직 커뮤니케이션 패턴 분석 전문가입니다.
아래 텍스트를 분석하여 이 조직의 소통 DNA를 JSON으로 출력하세요.

[분석 대상 텍스트]
{INPUT_TEXT}

[출력 JSON 스키마 - 반드시 이 형식만 출력하세요]
{
  "decisionStructure": "의사결정 구조 (예: 수평적 자율성 기반, 수직적 보고 체계, Top-down 등)",
  "channels": "주요 소통 채널 (예: Slack & Notion, 이메일 중심, Teams 등)",
  "reporting": "보고 스타일 (예: 상시 공유, 주간 보고, 일일 스탠드업 등)",
  "terms": [
    { "from": "지양하거나 비공식적인 표현", "to": "권장하는 공식 표현" }
  ],
  "rules": [
    { "id": "고유식별자", "title": "규칙 제목", "description": "규칙 상세 설명", "icon": "mail 또는 notice 또는 report" }
  ],
  "accuracy": 85
}

[분석 지시사항]
1. 텍스트에서 명시적으로 언급되거나 강하게 암시된 규칙만 추출하세요.
2. 존재하지 않는 내용을 추측하거나 지어내지 마세요.
3. terms는 최소 3개, 최대 10개를 추출하세요.
4. rules는 최소 2개, 최대 5개를 추출하세요.
5. accuracy는 텍스트의 구체성과 신뢰도에 따라 60~98 범위에서 판단하세요.
6. icon 값은 "mail", "notice", "report" 중 하나만 사용하세요.
7. JSON 외에 다른 텍스트는 출력하지 마세요.`;

const EMAIL_EXTRACTION_PROMPT = `당신은 조직 커뮤니케이션 패턴 분석 전문가입니다.
아래는 한 조직의 구성원이 실제로 보낸 업무 이메일 모음입니다.
이메일 패턴을 분석하여 이 조직의 소통 DNA를 JSON으로 출력하세요.

[업무 이메일 모음]
{INPUT_TEXT}

[출력 JSON 스키마 - 반드시 이 형식만 출력하세요]
{
  "decisionStructure": "이메일에서 드러나는 의사결정 구조",
  "channels": "주로 사용하는 소통 채널/도구",
  "reporting": "보고 및 공유 패턴",
  "terms": [
    { "from": "이메일에서 자주 사용되는 비공식 표현", "to": "조직이 선호하는 공식 표현" }
  ],
  "rules": [
    { "id": "고유식별자", "title": "이메일 규칙 제목", "description": "상세 설명", "icon": "mail 또는 notice 또는 report" }
  ],
  "accuracy": 85
}

[분석 지시사항]
1. 이메일의 제목 패턴, 인사/마무리 형식, 호칭 사용법, 톤앤매너를 분석하세요.
2. 반복적으로 등장하는 표현, 약어, 관용구를 terms에 포함하세요.
3. 이메일 형식 규칙(말머리 사용, CC 규칙 등)을 rules에 포함하세요.
4. terms는 최소 3개, 최대 10개를 추출하세요.
5. rules는 최소 2개, 최대 5개를 추출하세요.
6. accuracy는 이메일 수와 패턴 일관성에 따라 60~98 범위에서 판단하세요.
7. JSON 외에 다른 텍스트는 출력하지 마세요.`;

/**
 * Gemini API 호출 (추출 전용 - 타임아웃 60초)
 */
async function callGemini(prompt) {
  if (!env.ai.apiKey) {
    throw new Error('AI API 키가 설정되지 않았습니다 (GEMINI_API_KEY).');
  }

  const url = `${env.ai.apiUrl}/models/${env.ai.model}:generateContent?key=${env.ai.apiKey}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      signal: controller.signal,
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error?.message || 'Gemini API 호출 실패');
    }

    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('');
    return text ? text.trim() : null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * AI 응답에서 JSON 파싱
 */
function parseJsonResponse(raw) {
  if (!raw) return null;
  const cleaned = raw.replace(/```json|```/gi, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    console.warn('[CompanyDNA Extraction] JSON 파싱 실패:', cleaned.substring(0, 200));
    return null;
  }
}

/**
 * 추출 결과 유효성 검증 및 정규화
 */
function validateAndNormalize(extracted) {
  if (!extracted) return null;

  const validIcons = ['mail', 'notice', 'report'];

  return {
    decisionStructure: typeof extracted.decisionStructure === 'string'
      ? extracted.decisionStructure
      : '수평적 자율성 기반',
    channels: typeof extracted.channels === 'string'
      ? extracted.channels
      : 'Slack & Notion',
    reporting: typeof extracted.reporting === 'string'
      ? extracted.reporting
      : '상시 공유 (Always Sync)',
    terms: Array.isArray(extracted.terms)
      ? extracted.terms
          .filter((t) => t && typeof t.from === 'string' && typeof t.to === 'string')
          .slice(0, 10)
      : [],
    rules: Array.isArray(extracted.rules)
      ? extracted.rules
          .filter((r) => r && typeof r.title === 'string' && typeof r.description === 'string')
          .map((r) => ({
            id: r.id || `rule_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            title: r.title,
            description: r.description,
            icon: validIcons.includes(r.icon) ? r.icon : 'mail',
          }))
          .slice(0, 5)
      : [],
    accuracy: typeof extracted.accuracy === 'number'
      ? Math.max(60, Math.min(98, extracted.accuracy))
      : 75,
  };
}

/**
 * 문서 텍스트에서 Company DNA 추출
 * @param {string} text - 파싱된 문서 텍스트
 * @returns {Promise<object>} 구조화된 Company DNA
 */
async function extractFromDocument(text) {
  if (!text || text.trim().length < 50) {
    throw new Error('텍스트가 너무 짧아 분석할 수 없습니다. (최소 50자)');
  }

  // 텍스트가 너무 길면 앞쪽 15000자만 사용 (토큰 제한)
  const truncated = text.length > 15000 ? text.substring(0, 15000) + '\n...(이하 생략)' : text;
  const prompt = EXTRACTION_PROMPT.replace('{INPUT_TEXT}', truncated);

  console.log(`[CompanyDNA] 문서 분석 시작 (텍스트 ${text.length}자)`);
  const raw = await callGemini(prompt);
  const parsed = parseJsonResponse(raw);
  const result = validateAndNormalize(parsed);

  if (!result) {
    throw new Error('AI 응답을 파싱할 수 없습니다. 다시 시도해주세요.');
  }

  console.log(`[CompanyDNA] 문서 분석 완료 - terms: ${result.terms.length}, rules: ${result.rules.length}, accuracy: ${result.accuracy}`);
  return result;
}

/**
 * 이메일 텍스트 목록에서 Company DNA 추출
 * @param {Array<{subject: string, body: string}>} emails - 이메일 제목+본문 목록
 * @returns {Promise<object>} 구조화된 Company DNA
 */
async function extractFromEmails(emails) {
  if (!emails || emails.length < 3) {
    throw new Error('분석에 최소 3개 이상의 이메일이 필요합니다.');
  }

  const emailText = emails
    .map((e, i) => `--- 이메일 ${i + 1} ---\n제목: ${e.subject || '(제목 없음)'}\n본문:\n${e.body || '(내용 없음)'}\n`)
    .join('\n');

  const truncated = emailText.length > 15000
    ? emailText.substring(0, 15000) + '\n...(이하 생략)'
    : emailText;

  const prompt = EMAIL_EXTRACTION_PROMPT.replace('{INPUT_TEXT}', truncated);

  console.log(`[CompanyDNA] 이메일 분석 시작 (${emails.length}건, 텍스트 ${emailText.length}자)`);
  const raw = await callGemini(prompt);
  const parsed = parseJsonResponse(raw);
  const result = validateAndNormalize(parsed);

  if (!result) {
    throw new Error('AI 응답을 파싱할 수 없습니다. 다시 시도해주세요.');
  }

  console.log(`[CompanyDNA] 이메일 분석 완료 - terms: ${result.terms.length}, rules: ${result.rules.length}, accuracy: ${result.accuracy}`);
  return result;
}

module.exports = {
  extractFromDocument,
  extractFromEmails,
};
