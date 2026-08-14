const env = require('../config/env');

function buildPrompt({ originalText, purpose, tags, language, timeContext }) {
  const guidelines = tags.length
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
  const url = `${env.ai.apiUrl}/models/${env.ai.model}:generateContent?key=${env.ai.apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  const data = await res.json();

  if (!res.ok) {
    const err = new Error(data?.error?.message || 'AI 호출 실패');
    err.statusCode = 502;
    throw err;
  }

  return (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
}

async function convertMessage({ originalText, purpose, tags, language, timeContext }) {
  const prompt = buildPrompt({ originalText, purpose, tags, language, timeContext });
  const convertedText = await callGemini(prompt);
  return { convertedText };
}

function buildTagInferencePrompt({ sampleText, taxonomy }) {
  const taxonomyText = taxonomy
    .map((t) => `- category="${t.category}", name="${t.name}" (${t.label}): ${t.promptGuideline}`)
    .join('\n');

  return `당신은 커뮤니케이션 스타일 분석기입니다. 아래 텍스트를 보고 이 사람에게 맞는 소통 스타일을, 반드시 아래 태그 목록 중에서만 골라 분류하세요.

[사용 가능한 태그 목록]
${taxonomyText}

[분석 대상 텍스트]
"""
${sampleText}
"""

[지시사항]
1. 위 목록에 등장하는 category마다 가장 적합한 태그를 최대 1개까지만 고르세요.
2. 텍스트에서 근거를 찾을 수 없는 카테고리는 생략하세요.
3. 목록에 없는 태그를 새로 만들지 마세요.
4. 아래 형식의 JSON 배열만 출력하세요. 다른 텍스트, 설명, 마크다운 코드블록은 절대 포함하지 마세요.
[{"category":"tone","name":"formal","reason":"한 문장 이유"}]`;
}

// 샘플 텍스트(수신 메시지, 특징 설명 등)를 기존 태그 taxonomy 안에서만 분류.
// 목록에 없는 항목은 걸러내 반환하므로, 호출 측에서 별도 검증 없이 신뢰 가능.
async function inferTags({ sampleText, taxonomy }) {
  const prompt = buildTagInferencePrompt({ sampleText, taxonomy });
  const raw = await callGemini(prompt);
  const cleaned = raw.replace(/```json|```/gi, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    const parseErr = new Error('AI 응답을 태그 목록으로 해석하지 못했습니다.');
    parseErr.statusCode = 502;
    throw parseErr;
  }

  const taxonomyKeySet = new Set(taxonomy.map((t) => `${t.category}:${t.name}`));
  return (Array.isArray(parsed) ? parsed : []).filter(
    (item) => item && taxonomyKeySet.has(`${item.category}:${item.name}`)
  );
}

module.exports = { convertMessage, inferTags };
