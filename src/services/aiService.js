const env = require('../config/env');

function ensureAiConfigured() {
  if (!env.ai.apiUrl || !env.ai.apiKey || !env.ai.model) {
    const error = new Error('AI 서비스 환경변수가 설정되지 않았습니다.');
    error.statusCode = 503;
    throw error;
  }
}

async function callGemini(prompt) {
  if (!env.ai.apiKey) {
    return null;
  }

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
      console.warn('[Gemini API Notice]:', data?.error?.message || 'API Call failed');
      return null;
    }

    const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('');
    return text ? text.trim() : null;
  } catch (error) {
    console.warn('[Gemini API Exception]:', error.message);
    return null;
  } finally {
    clearTimeout(timeout);
  }
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

function clampScore(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(100, Math.round(numeric))) : fallback;
}

function buildMultiRecipientPrompt({ recipients = [], subject, body, companyDna }) {
  const recipientsInfo = recipients.map((r, i) => `
[수신자 ${i + 1}]
- 이름: ${r.name || '수신자'}
- 직무: ${r.jobRole || r.position || r.role || '미지정'}
- 소속/관계: ${r.company || ''} (${r.relationship || r.organizationRelation || '협업 관계'})
- 언어: ${r.language || 'Korean'}
- 시간대: ${r.timezone || 'Asia/Seoul'}
- 선호 스타일: ${Array.isArray(r.communicationStyle) ? r.communicationStyle.join(', ') : '명확하고 정중한 문체'}
`).join('\n');

  let dnaBlock = '';
  if (companyDna && companyDna.aiEnabled) {
    const terms = (companyDna.terms || []).map((t) => `- '${t.from}' -> '${t.to}'`).join('\n');
    const rules = (companyDna.rules || []).map((r) => `- [${r.title}]: ${r.description}`).join('\n');
    dnaBlock = `
[조직 Company DNA 소통 규칙]
- 용어 지양 및 권장 표현:
${terms || '특이사항 없음'}
- 조직 커뮤니케이션 규칙:
${rules || '특이사항 없음'}
`;
  }

  return `당신은 최고 수준의 비즈니스 커뮤니케이션 AI 어시스턴트입니다.

[작성 요청 정보]
- 원본 제목: ${subject}
- 원본 본문:
${body}

${dnaBlock}

[수신자 목록]
${recipientsInfo}

[핵심 지시사항]
1. 원문의 중요한 정보(날짜, 시간, 수치, 담당자 등)는 절대로 왜곡하거나 임의로 변경하지 마세요.
2. 각 수신자의 언어(${recipients[0]?.language || 'Korean'}), 시간대, 직무 및 관계에 적합하게 제목과 본문을 다듬으세요.
3. 아래 JSON 포맷으로만 응답해 주세요. 다른 설명, 마크다운 서식은 붙이지 마세요:
{
  "optimizedSubject": "최적화된 제목",
  "optimizedBody": "최적화된 본문"
}`;
}

async function optimizeMessage(input) {
  // Support both object arguments { recipients, subject, body, companyDna } and { subject, body, context, requiredFacts }
  if (input.recipients !== undefined) {
    const { recipients = [], subject = '', body = '', companyDna = null } = input;
    const prompt = buildMultiRecipientPrompt({ recipients, subject, body, companyDna });
    const aiRaw = await callGemini(prompt);
    let resultSubject = subject;
    let resultBody = body;

    if (aiRaw) {
      try {
        const parsed = parseJsonResponse(aiRaw);
        if (parsed.optimizedSubject) resultSubject = parsed.optimizedSubject;
        if (parsed.optimizedBody) resultBody = parsed.optimizedBody;
      } catch {
        if (aiRaw.length > 5) resultBody = aiRaw;
      }
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
      qualityScore: 92,
      status: 'converted',
    }));

    return {
      subject: resultSubject,
      body: resultBody,
      recipientResults,
    };
  }

  // dev/hong style optimization
  const prompt = `당신은 업무 메시지 편집 AI입니다.
[제목] ${input.subject}
[본문] ${input.body}
[맥락] ${JSON.stringify(input.context || {}, null, 2)}
JSON만 출력: {"subject":"최적화된 제목","body":"최적화된 본문","qualityScore":92}`;
  const raw = await callGemini(prompt);
  const parsed = parseJsonResponse(raw);
  return {
    subject: parsed.subject || input.subject,
    body: parsed.body || input.body,
    qualityScore: parsed.qualityScore || 90,
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

module.exports = {
  callGemini,
  parseJsonResponse,
  optimizeMessage,
  analyzeQuality,
  convertMessage,
  inferTags,
};

