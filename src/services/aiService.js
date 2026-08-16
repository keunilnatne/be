const env = require('../config/env');

function buildPrompt({ originalText, purpose, tags, language, timeContext }) {
  const guidelines = tags && tags.length
    ? tags.map((t) => `- [${t.category}] ${t.label}: ${t.promptGuideline}`).join('\n')
    : '- 특별한 선호 정보 없음. 일반적인 업무 문체로 작성하세요.';

  const languageInstruction = language
    ? `모든 결과는 반드시 "${language}"로 작성하세요. (원문이 다른 언어여도 "${language}"로 번역해서 작성)`
    : '원문과 동일한 언어로 작성하세요.';

  const timeBlock = timeContext
    ? `\n[시간대 변환 정보 - 메시지에 자연스럽게 반영, 시각 왜곡 금지]\n${timeContext}\n`
    : '';

  return `당신은 업무 메시지를 수신자 성향에 맞게 변환하는 어시스턴트입니다.

[원문 메시지]
${originalText}

[메시지 목적]
${purpose || '명시되지 않음'}

[수신자가 선호하는 스타일 - 반드시 반영]
${guidelines}

[출력 언어]
${languageInstruction}
${timeBlock}
[지시사항]
1. 원문의 핵심 의미와 사실(날짜, 담당자, 수치 등)은 절대 임의로 바꾸지 마세요.
2. 위 선호 스타일을 최대한 반영해 메시지를 다시 작성하세요.
3. 시간대 변환 정보가 주어졌다면, 원문의 시각을 수신자 기준 시각으로 바꿔서 메시지에 반영하세요 (필요하면 발신자 기준 시각도 괄호로 함께 표기).
4. 변환된 메시지 본문만 출력하세요. 다른 설명, 따옴표, 마크다운 제목은 붙이지 마세요.`;
}

async function callGemini(prompt) {
  if (!env.ai.apiKey) {
    return null;
  }

  const url = `${env.ai.apiUrl}/models/${env.ai.model}:generateContent?key=${env.ai.apiKey}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    const data = await res.json();

    if (!res.ok) {
      console.warn('[Gemini API Notice]:', data?.error?.message || 'API Call failed');
      return null;
    }

    return (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
  } catch (err) {
    console.warn('[Gemini API Exception]:', err.message);
    return null;
  }
}

async function convertMessage({ originalText, purpose, tags, language, timeContext }) {
  const prompt = buildPrompt({ originalText, purpose, tags, language, timeContext });
  let convertedText = await callGemini(prompt);
  if (!convertedText) {
    convertedText = originalText;
  }
  return { convertedText };
}

function buildMultiRecipientPrompt({ recipients, subject, body, companyDna }) {
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

async function optimizeMessage({ recipients = [], subject = '', body = '', companyDna = null }) {
  const primaryRecipient = recipients[0] || {};
  const prompt = buildMultiRecipientPrompt({ recipients, subject, body, companyDna });

  let aiRaw = await callGemini(prompt);
  let resultSubject = subject;
  let resultBody = body;

  if (aiRaw) {
    try {
      const cleaned = aiRaw.replace(/```json|```/gi, '').trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.optimizedSubject) resultSubject = parsed.optimizedSubject;
      if (parsed.optimizedBody) resultBody = parsed.optimizedBody;
    } catch {
      if (aiRaw.length > 5) {
        resultBody = aiRaw;
      }
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

async function inferTags({ sampleText, taxonomy }) {
  if (!taxonomy || !taxonomy.length) return [];
  const taxonomyText = taxonomy
    .map((t) => `- category="${t.category}", name="${t.name}" (${t.label}): ${t.promptGuideline}`)
    .join('\n');

  const prompt = `당신은 커뮤니케이션 스타일 분석기입니다. 아래 텍스트를 보고 이 사람에게 맞는 소통 스타일을 분류하세요.
[가능한 태그]
${taxonomyText}
[텍스트]
${sampleText}`;

  const raw = await callGemini(prompt);
  if (!raw) return [];

  const cleaned = raw.replace(/```json|```/gi, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

module.exports = { convertMessage, inferTags, optimizeMessage };
