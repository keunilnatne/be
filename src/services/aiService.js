const env = require('../config/env');

function ensureAiConfigured() {
  if (!env.ai.apiUrl || !env.ai.apiKey || !env.ai.model) {
    const error = new Error('AI 서비스 환경변수가 설정되지 않았습니다.');
    error.statusCode = 503;
    throw error;
  }
}

async function callGemini(prompt) {
  ensureAiConfigured();
  const url = `${env.ai.apiUrl}/models/${env.ai.model}:generateContent?key=${env.ai.apiKey}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      signal: controller.signal,
    });
    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data?.error?.message || 'AI 호출에 실패했습니다.');
      error.statusCode = response.status;
      const retryAfterHeader = Number(response.headers.get('retry-after'));
      const retryAfterMessage = error.message.match(/retry in\s+([\d.]+)s/i);
      if (Number.isFinite(retryAfterHeader) && retryAfterHeader > 0) {
        error.retryAfterMs = retryAfterHeader * 1000;
      } else if (retryAfterMessage) {
        error.retryAfterMs = Math.ceil(Number(retryAfterMessage[1]) * 1000);
      }
      throw error;
    }

    const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('');
    if (!text?.trim()) {
      const error = new Error('AI가 빈 응답을 반환했습니다.');
      error.statusCode = 502;
      throw error;
    }
    return text.trim();
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('AI 응답 시간이 초과되었습니다.');
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function parseJsonResponse(raw) {
  const cleaned = raw.replace(/```json|```/gi, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    const parseError = new Error('AI 응답을 JSON 형식으로 해석할 수 없습니다.');
    parseError.statusCode = 502;
    throw parseError;
  }
}

function buildOptimizationPrompt({ subject, body, purpose, context, requiredFacts, retryReason }) {
  return `당신은 국경을 넘는 업무 협업을 돕는 메시지 편집 AI입니다.

[원문 제목]
${subject}

[원문 본문]
${body}

[메시지 목적]
${purpose || '명시되지 않음'}

[발신자·수신자·조직·팀 맥락]
${JSON.stringify(context, null, 2)}

[반드시 그대로 보존할 원문 사실]
${requiredFacts.length ? requiredFacts.map((fact) => `- ${fact}`).join('\n') : '- 별도로 추출된 사실 없음'}

${retryReason ? `[재생성 사유]\n${retryReason}\n` : ''}
[지시사항]
1. 수신자의 language에 맞는 언어로 제목과 본문을 작성하세요.
2. 수신자의 직무, 관계, 커뮤니케이션 스타일을 우선 반영하세요.
3. Company DNA와 승인된 Team Memory는 개인 설정과 충돌하지 않는 범위에서 반영하세요.
4. 날짜, 금액, 비율, 이메일, 담당자 등 원문의 사실을 추측하거나 변경하지 마세요.
5. 원문에 없는 약속, 일정, 수치, 담당자를 새로 만들지 마세요.
6. 설명이나 마크다운 없이 아래 JSON 객체만 출력하세요.
{"subject":"최적화된 제목","body":"최적화된 본문","qualityScore":0}`;
}

async function optimizeMessage(input) {
  const raw = await callGemini(buildOptimizationPrompt(input));
  const parsed = parseJsonResponse(raw);
  if (!String(parsed.subject || '').trim() || !String(parsed.body || '').trim()) {
    const error = new Error('AI 결과에 제목 또는 본문이 없습니다.');
    error.statusCode = 502;
    throw error;
  }

  const numericScore = Number(parsed.qualityScore);
  return {
    subject: String(parsed.subject).trim(),
    body: String(parsed.body).trim(),
    qualityScore: Number.isFinite(numericScore)
      ? Math.max(0, Math.min(100, Math.round(numericScore)))
      : 90,
  };
}

function clampScore(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(100, Math.round(numeric))) : fallback;
}

function buildQualityPrompt({ subject, body, purpose, recipientContext }) {
  return `당신은 국경을 넘는 업무 메시지의 품질을 평가하는 AI입니다.

[제목]
${subject}

[본문]
${body}

[메시지 목적]
${purpose || '명시되지 않음'}

[수신자 Context]
${JSON.stringify(recipientContext || {}, null, 2)}

[평가 기준]
1. clarity: 핵심 내용과 요청이 명확한가
2. tone: 수신자와 업무 관계에 적합한 어조인가
3. culturalFit: 수신자의 언어와 문화적 맥락을 존중하는가
4. actionability: 수신자가 다음 행동을 이해할 수 있는가
5. 원문에 없는 사실을 새로 만들어내지 마세요.
6. 점수는 모두 0~100의 정수로 작성하세요.
7. 설명이나 마크다운 없이 아래 JSON 객체만 출력하세요.
{"overallScore":0,"breakdown":{"clarity":0,"tone":0,"culturalFit":0,"actionability":0},"strengths":["장점"],"improvements":["개선점"],"summary":"한 줄 요약"}`;
}

async function analyzeQuality(input) {
  const parsed = parseJsonResponse(await callGemini(buildQualityPrompt(input)));
  const breakdown = parsed.breakdown || {};
  const normalized = {
    clarity: clampScore(breakdown.clarity),
    tone: clampScore(breakdown.tone),
    culturalFit: clampScore(breakdown.culturalFit),
    actionability: clampScore(breakdown.actionability),
  };
  const calculated = Math.round(Object.values(normalized).reduce((sum, score) => sum + score, 0) / 4);
  return {
    overallScore: clampScore(parsed.overallScore, calculated),
    breakdown: normalized,
    strengths: (Array.isArray(parsed.strengths) ? parsed.strengths : []).map(String).slice(0, 5),
    improvements: (Array.isArray(parsed.improvements) ? parsed.improvements : []).map(String).slice(0, 5),
    summary: String(parsed.summary || '').trim(),
  };
}

function buildLegacyPrompt({ originalText, purpose, tags }) {
  const guidelines = tags.length
    ? tags.map((tag) => `- [${tag.category}] ${tag.label}: ${tag.promptGuideline}`).join('\n')
    : '- 별도 선호 정보 없음. 일반적인 업무 문체를 사용하세요.';

  return `업무 메시지를 수신자 성향에 맞게 다시 작성하세요.

[원문]
${originalText}

[목적]
${purpose || '명시되지 않음'}

[수신자 선호]
${guidelines}

원문의 사실을 바꾸지 말고 변환된 본문만 출력하세요.`;
}

async function convertMessage({ originalText, purpose, tags }) {
  return { convertedText: await callGemini(buildLegacyPrompt({ originalText, purpose, tags })) };
}

function buildTagInferencePrompt({ sampleText, taxonomy }) {
  const taxonomyText = taxonomy
    .map((tag) => `- category="${tag.category}", name="${tag.name}" (${tag.label}): ${tag.promptGuideline}`)
    .join('\n');

  return `아래 텍스트의 커뮤니케이션 스타일을 주어진 태그 안에서만 분류하세요.

[태그 목록]
${taxonomyText}

[텍스트]
${sampleText}

JSON 배열만 출력하세요.
[{"category":"tone","name":"formal","reason":"근거"}]`;
}

async function inferTags({ sampleText, taxonomy }) {
  const parsed = parseJsonResponse(await callGemini(buildTagInferencePrompt({ sampleText, taxonomy })));
  const taxonomyKeys = new Set(taxonomy.map((tag) => `${tag.category}:${tag.name}`));
  return (Array.isArray(parsed) ? parsed : []).filter(
    (item) => item && taxonomyKeys.has(`${item.category}:${item.name}`)
  );
}

module.exports = {
  analyzeQuality,
  buildOptimizationPrompt,
  buildQualityPrompt,
  callGemini,
  convertMessage,
  inferTags,
  optimizeMessage,
  parseJsonResponse,
};
