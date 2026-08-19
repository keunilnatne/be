const env = require('../config/env');
const ApiError = require('../utils/ApiError');

function aiFailure(statusCode, reason) {
  return ApiError.aiGenerationFailed(statusCode, reason ? { reason } : undefined);
}

function ensureAiConfigured() {
  if (!env.ai.apiUrl || !env.ai.apiKey || !env.ai.model) {
    throw aiFailure(503, 'AI_NOT_CONFIGURED');
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function callGemini(prompt) {
  ensureAiConfigured();

  const candidateModels = Array.from(new Set([
    env.ai.model,
    'gemini-flash-lite-latest',
    'gemini-2.5-flash-lite',
    'gemini-flash-latest',
  ].filter(Boolean)));

  let lastError = null;

  for (let i = 0; i < candidateModels.length; i++) {
    const model = candidateModels[i];
    if (i > 0) {
      await sleep(300 * i); // Exponential-like backoff between retries
    }

    const url = `${env.ai.apiUrl}/models/${model}:generateContent?key=${env.ai.apiKey}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal: controller.signal,
      });
      const rawBody = await response.text();
      let data = {};
      try {
        data = rawBody ? JSON.parse(rawBody) : {};
      } catch {
        if (response.ok) throw aiFailure(502, 'INVALID_PROVIDER_RESPONSE');
      }

      if (!response.ok) {
        console.warn(`[Gemini API Notice] (${model}):`, data?.error?.message || 'API Call failed');
        if (response.status === 401 || response.status === 403) {
          throw aiFailure(503, 'INVALID_API_CREDENTIALS');
        }
        lastError = response.status === 429 ? aiFailure(429, 'RATE_LIMITED') : aiFailure(502, 'PROVIDER_REQUEST_FAILED');
        continue;
      }

      const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('');
      if (!text?.trim()) {
        lastError = aiFailure(502, 'EMPTY_PROVIDER_RESPONSE');
        continue;
      }
      return text.trim();
    } catch (error) {
      console.warn(`[Gemini API Exception] (${model}):`, error.message);
      if (error.code === 'AI_GENERATION_FAILED' && error.statusCode === 503) {
        throw error;
      }
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }

  if (lastError?.code === 'AI_GENERATION_FAILED') throw lastError;
  if (lastError?.name === 'AbortError') throw aiFailure(504, 'PROVIDER_TIMEOUT');
  throw aiFailure(502, 'PROVIDER_CONNECTION_FAILED');
}

function parseJsonResponse(raw) {
  if (!raw) return {};
  const cleaned = raw.replace(/```json|```/gi, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return {};
  }
}

function parseRequiredJson(raw, requiredFields) {
  const parsed = parseJsonResponse(raw);
  const valid = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    && requiredFields.every((field) => typeof parsed[field] === 'string' && parsed[field].trim());
  if (!valid) throw aiFailure(502, 'INVALID_AI_JSON');
  return parsed;
}

function clampScore(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(100, Math.round(numeric))) : fallback;
}

function buildMultiRecipientPrompt({ recipients = [], subject, body }) {
  const recipientsInfo = recipients.map((r, i) => `
[수신자 ${i + 1}]
- 이름: ${r.name || '수신자'}
- 직무: ${r.jobRole || r.position || r.role || '미지정'}
- 소속/관계: ${r.company || ''} (${r.relationship || r.organizationRelation || '협업 관계'})
- 언어: ${r.language || 'Korean'}
- 시간대: ${r.timezone || 'Asia/Seoul'}
- 선호 스타일: ${Array.isArray(r.communicationStyle) ? r.communicationStyle.join(', ') : '명확하고 정중한 문체'}
`).join('\n');

  return `당신은 최고 수준의 비즈니스 커뮤니케이션 AI 어시스턴트입니다.

[작성 요청 정보]
- 원본 제목: ${subject}
- 원본 본문:
${body}

[수신자 목록]
${recipientsInfo}

[핵심 지시사항]
1. 원문의 중요한 정보(날짜, 시간, 수치, 담당자 등)는 절대로 왜곡하거나 임의로 변경하지 마세요.
2. 수신자 호칭: 수신자의 실제 이름이 명시된 경우, '팀원님'이나 '수신자님' 같은 어색한 임의 명칭 대신 반드시 수신자의 실제 이름(예: '${recipients[0]?.name || '수신자'} 님, 안녕하세요')을 사용하여 자연스럽고 정중하게 시작하세요.
3. 맺음말 규칙: 본문 끝에 기계적이거나 어색한 '~드림'을 억지로 붙이지 마세요. '감사합니다.', '좋은 하루 보내세요.' 또는 문맥에 맞는 자연스럽고 정중한 비즈니스 맺음말로 깔끔하게 마무리하세요.
4. 각 수신자의 언어(${recipients[0]?.language || 'Korean'}), 시간대, 직무 및 관계에 적합하게 제목과 본문을 다듬으세요.
5. 발신자 및 수신자의 업무 시간과 시간대를 고려하여, 업무 외 시간(야간/주말)에 작성 및 발송되는 경우 수신자에게 부담을 주지 않도록 정중한 양해와 배려의 표현(예: '편하신 업무 시간에 확인 부탁드립니다')을 문맥에 맞게 자연스럽게 반영하세요.
6. 원문 메시지가 수신자의 특성 및 비즈니스 소통 기준에 얼마나 부합하는지 및 최적화 완성도를 종합 평가하여 0~100점 사이의 적합도 점수(qualityScore: 정수)를 객관적으로 평가해 JSON에 포함하세요.
7. 아래 JSON 포맷으로만 응답해 주세요. 다른 설명, 마크다운 서식은 붙이지 마세요:
{
  "optimizedSubject": "최적화된 제목",
  "optimizedBody": "최적화된 본문",
  "qualityScore": 92
}`;
}

async function optimizeMessage(input) {
  // Support both object arguments { recipients, subject, body } and { subject, body, context, requiredFacts }
  if (input.recipients !== undefined) {
    const { recipients = [], subject = '', body = '' } = input;
    const prompt = buildMultiRecipientPrompt({ recipients, subject, body });
    const aiRaw = await callGemini(prompt);
    const parsed = parseRequiredJson(aiRaw, ['optimizedSubject', 'optimizedBody']);
    const resultSubject = parsed.optimizedSubject;
    const resultBody = parsed.optimizedBody;
    let score = Number(parsed.qualityScore);
    if (!Number.isFinite(score) || score <= 0) {
      score = 88;
    } else {
      score = Math.min(100, Math.max(50, Math.round(score)));
    }

    const recipientResults = recipients.map((r) => ({
      recipientId: r.id || null,
      recipientName: r.name || '수신자',
      recipientEmail: r.email || '',
      optimizedSubject: resultSubject,
      optimizedBody: resultBody,
      appliedContext: {
        language: r.language || 'Korean',
        timezone: r.timezone || 'Asia/Seoul',
        position: r.jobRole || r.position || r.role || '직무',
        relationship: r.relationship || r.organizationRelation || '협업 관계',
      },
      qualityScore: score,
      status: 'converted',
    }));

    return {
      subject: resultSubject,
      body: resultBody,
      qualityScore: score,
      recipientResults,
    };
  }

  // dev/hong style optimization
  const senderInfo = input.context?.sender || {};
  const recipientInfo = input.context?.recipient || {};
  const recipientLang = recipientInfo.language || 'Korean';
  const recipientDisplayName = recipientInfo.name || '수신자';
  const prompt = `당신은 최고 수준의 글로벌 비즈니스 이메일/메시지 최적화 AI 어시스턴트입니다.
[원본 제목] ${input.subject}
[원본 본문]
${input.body}
[발신자 정보]
- 이름: ${senderInfo.name || '발신자'}
- 직무: ${senderInfo.jobRole || '직무'}
- 언어: ${senderInfo.defaultLanguage || 'Korean'}
- 업무 시간: ${senderInfo.workHours || '09:00 - 18:00'} (${senderInfo.timezone || 'Asia/Seoul'})
- 선호 스타일: ${senderInfo.preferredStyle || '명확하고 정중한 스타일'}

[수신자 맥락 정보]
- 이름: ${recipientDisplayName}
- 직무: ${recipientInfo.jobRole || recipientInfo.position || recipientInfo.role || '직무'}
- 언어: ${recipientLang}
- 시간대: ${recipientInfo.timezone || 'Asia/Seoul'}
- 관계: ${recipientInfo.relationship || recipientInfo.organizationRelation || '협업 관계'}
- 응답 속도: ${recipientInfo.responseSpeed || '보통'}
${input.retryReason ? `[재시도 사유]: ${input.retryReason}` : ''}

[지시사항]
1. 원문의 핵심 수치, 날짜, 담당자, 고유명사는 누락하거나 왜곡하지 마세요.
2. 수신자 호칭: 수신자의 실제 이름('${recipientDisplayName}')이 주어진 경우, '팀원님'이나 '수신자님' 같은 임의 명칭 대신 반드시 실제 수신자의 이름(예: '${recipientDisplayName} 님, 안녕하세요')을 사용하여 친절하고 정중하게 시작하세요.
3. 맺음말 규칙: 본문 끝에 기계적이거나 어색한 '~드림'을 억지로 붙이지 마세요. '감사합니다.', '좋은 하루 보내세요.' 또는 문맥에 맞는 자연스럽고 정중한 비즈니스 맺음말로 깔끔하게 마무리하세요.
4. 수신자의 언어('${recipientLang}')에 맞춰 제목(subject)과 본문(body)을 모두 해당 언어로 완벽하게 최적화 및 번역하세요.
5. 수신자의 직무, 조직 관계, 선호 스타일에 맞춰 설득력 있고 격식 있는 톤을 적용하세요.
6. 발신자 및 수신자의 업무 시간과 시간대를 고려하여, 업무 외 시간(야간/주말)에 작성 및 발송되는 경우 수신자에게 부담을 주지 않도록 정중한 양해와 배려의 표현(예: '편하신 업무 시간에 확인 부탁드립니다')을 문맥에 맞게 자연스럽게 반영하세요.
7. 원문이 수신자의 직무/언어/관계/소통 스타일에 얼마나 잘 부합하는지 0~100점 사이의 적합도 점수(qualityScore: 정수)를 객관적으로 평가하여 JSON에 포함하세요.
8. 반드시 아래 JSON 형식으로만 응답하세요:
{"subject":"수신자 언어와 맥락에 최적화된 제목","body":"수신자 언어와 맥락에 최적화된 본문","qualityScore":92}`;
  const raw = await callGemini(prompt);
  const parsed = parseRequiredJson(raw, ['subject', 'body']);
  let score = Number(parsed.qualityScore);
  if (!Number.isFinite(score) || score <= 0) {
    score = 88;
  } else {
    score = Math.min(100, Math.max(50, Math.round(score)));
  }
  return {
    subject: parsed.subject,
    body: parsed.body,
    qualityScore: score,
  };
}

function buildQualityPrompt({ subject, body, purpose, recipientContext }) {
  return `당신은 비즈니스 메시지 품질 평가 AI입니다.
[제목] ${subject}
[본문] ${body}
[목적] ${purpose || '업무 소통'}
[수신자] ${JSON.stringify(recipientContext || {}, null, 2)}
JSON만 출력:
{"overallScore":92,"breakdown":{"clarity":90,"tone":95,"culturalFit":90,"actionability":93},"strengths":["명확한 요청"],"improvements":["세부 일정 표기 권장"],"summary":"적절한 격식의 비즈니스 메시지입니다."}`;
}

async function analyzeQuality(input) {
  const raw = await callGemini(buildQualityPrompt(input));
  const parsed = parseJsonResponse(raw);
  const breakdown = parsed.breakdown || { clarity: 90, tone: 95, culturalFit: 90, actionability: 93 };
  return {
    overallScore: clampScore(parsed.overallScore, 92),
    breakdown,
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : ['핵심 내용이 명확합니다.'],
    improvements: Array.isArray(parsed.improvements) ? parsed.improvements : ['일정 표기 보완 권장'],
    summary: parsed.summary || '수신자 맥락이 잘 반영된 메시지입니다.',
  };
}

async function convertMessage({ originalText, purpose, tags, language }) {
  const guidelines = tags && tags.length
    ? tags.map((t) => `- [${t.category}] ${t.label}: ${t.promptGuideline}`).join('\n')
    : '- 일반적인 비즈니스 정중체';
  const prompt = `비즈니스 메시지 변환:\n[원문] ${originalText}\n[목적] ${purpose || ''}\n[스타일] ${guidelines}\n변환된 텍스트만 출력하세요.`;
  const raw = await callGemini(prompt);
  return { convertedText: raw || originalText };
}

async function inferTags({ sampleText, taxonomy }) {
  if (!taxonomy || !taxonomy.length) return [];
  const taxonomyText = taxonomy
    .map((tag) => `- category="${tag.category}", name="${tag.name}" (${tag.label}): ${tag.promptGuideline}`)
    .join('\n');
  const prompt = `아래 텍스트에 가장 적합한 태그를 골라 JSON 배열로 출력하세요:
[목록]
${taxonomyText}
[텍스트]
${sampleText}
[출력 예시]
[{"category":"tone","name":"formal","reason":"격식체 사용"}]`;
  const raw = await callGemini(prompt);
  const parsed = parseJsonResponse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

async function extractSchedule({ subject, body, snippet, from, date }) {
  const rawContent = body || snippet || '';
  const cleanContent = stripHtml(rawContent);
  const content = (cleanContent.length > 30 ? cleanContent : rawContent).slice(0, 5000);
  const nowStr = date ? new Date(date).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  
  const prompt = `당신은 업무 및 안내 이메일에서 회의, 미팅, 마감일, 시스템 점검/작업 일정, 발표, 행사, 세미나 등 모든 일정 정보를 정밀하게 추출하는 전문 AI 비서입니다.
아래의 이메일을 분석하여 일정이 포함되어 있는지 판별하고, 정확한 정보를 JSON 형식으로만 응답하세요.

[이메일 정보]
- 메일 제목: ${subject || '(제목 없음)'}
- 보낸 사람: ${from || '알 수 없음'}
- 수신 시각: ${nowStr}
- 본문 내용:
${content}

[분석 및 추출 규칙]
1. hasSchedule:
   - 본문이나 제목에 회의, 미팅, 마감 기한, 시스템/서비스 점검 시간, 정기점검, 작업 시간, 행사, 발표, 세미나 등 특정 날짜나 시간(예: 8월 22일 00:00 ~ 06:00, 내일 오후 3시 등)에 진행되는 일정이 언급되어 있으면 반드시 true.
   - 날짜나 시간 정보가 아예 없는 단순 안부 인사말, 광고성 스팸 메일인 경우에만 false.
2. quote:
   - 일정이 있을 경우: 일정/시간/마감과 직결된 본문 속 실제 핵심 문장(예: "점검 시간 : 2026년 8월 22일 토요일 00:00 ~ 06:00" 또는 "내일 오후 3시까지 마감입니다")을 원문 그대로 1~2줄 인용.
   - 일정이 없을 경우: "".
3. title:
   - 일정이 있을 경우: 일정의 성격을 명확하게 나타내는 깔끔한 제목 (예: "닷홈 정기점검", "3분기 기획안 마감", "주간 스프린트 회의").
   - 일정이 없을 경우: "".
4. dateTime:
   - 일정이 있을 경우: 본문의 날짜/시간 또는 수신 시각(${nowStr})을 기준으로 "M.D 오전/오후 H:MM" (예: "8.22 오전 0:00", "8.20 오후 3:00") 형식으로 변환.
   - 일정이 없을 경우: "".
5. source: "메일 내용 기반"

반드시 아래 JSON 형식으로만 응답하세요:
{
  "hasSchedule": true,
  "quote": "점검 시간 : 2026년 8월 22일 토요일 00:00 ~ 06:00",
  "title": "닷홈 정기점검",
  "dateTime": "8.22 오전 0:00",
  "source": "메일 내용 기반"
}`;

  try {
    const raw = await callGemini(prompt);
    const parsed = parseJsonResponse(raw);
    return {
      hasSchedule: Boolean(parsed.hasSchedule),
      quote: parsed.quote || '',
      title: parsed.title || subject || '업무 일정',
      dateTime: parsed.dateTime || '',
      source: parsed.source || '메일 내용 기반',
    };
  } catch (error) {
    console.error('[AI extractSchedule error]:', error.message);
    const scheduleRegex = /(?:내일|오늘|모레|\d{1,2}월\s*\d{1,2}일|\d{1,2}\/\d{1,2}|[월화수목금토일]요일|오전|오후|\d{1,2}시|마감|회의|미팅|일정|점검|까지)/i;
    const hasMatch = scheduleRegex.test(content);
    return {
      hasSchedule: hasMatch,
      quote: hasMatch ? content.slice(0, 100) : '',
      title: subject || '업무 일정',
      dateTime: '일정 확인 필요',
      source: '메일 내용 기반',
    };
  }
}

module.exports = {
  callGemini,
  parseJsonResponse,
  parseRequiredJson,
  optimizeMessage,
  analyzeQuality,
  buildQualityPrompt,
  convertMessage,
  inferTags,
  extractSchedule,
};
