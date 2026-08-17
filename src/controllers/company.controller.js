const { CompanyDna, Company } = require('../models');
const { parseDocument } = require('../services/documentParserService');
const { extractFromDocument, extractFromEmails } = require('../services/companyDnaExtractionService');
const googleAuthService = require('../services/googleAuthService');
const { google } = require('googleapis');
const fs = require('fs');

const defaultTerms = [
  { from: '검토 요청', to: '피드백 요청' },
  { from: '부장님/차장님', to: "'님' 호칭" },
  { from: '신속하게', to: '우선순위 높음' },
  { from: 'ASAP', to: '~까지 확인' },
];

const defaultRules = [
  {
    id: 'email',
    title: '이메일 형식',
    description: '제목 앞머리에 [말머리] 필수 사용. 본문은 핵심 위주로 3문장 이내 요약 선호.',
    icon: 'mail',
  },
  {
    id: 'notice',
    title: '공지 사항',
    description: '전체 공지 시 @channel 사용 지양. 긴급도가 낮은 경우 스레드 활용 권장.',
    icon: 'notice',
  },
  {
    id: 'report',
    title: '보고 스타일',
    description: "성과(Outcome) 중심 보고. 문제 발생 시 해결 방안과 함께 보고하는 'Solution First' 문화.",
    icon: 'report',
  },
];

async function getOrCreateDna(companyId = 1) {
  let dna = await CompanyDna.findOne({ where: { companyId } });
  if (!dna) {
    dna = await CompanyDna.create({
      companyId,
      decisionStructure: '수평적 자율성 기반',
      channels: 'Slack & Notion',
      reporting: '상시 공유 (Always Sync)',
      terms: defaultTerms,
      rules: defaultRules,
      accuracy: 92,
      aiEnabled: true,
    });
  }
  return dna;
}

exports.list = async (req, res) => {
  const companies = await Company.findAll();
  res.json(companies);
};

exports.create = async (req, res) => {
  const { name } = req.body;
  const company = await Company.create({ name });
  res.status(201).json(company);
};

exports.getDna = async (req, res) => {
  const companyId = req.params.companyId ? parseInt(req.params.companyId, 10) : 1;
  const dna = await getOrCreateDna(companyId);
  res.json({
    decisionStructure: dna.decisionStructure,
    channels: dna.channels,
    reporting: dna.reporting,
    terms: dna.terms || defaultTerms,
    rules: dna.rules || defaultRules,
    accuracy: dna.accuracy,
    aiEnabled: dna.aiEnabled,
  });
};

exports.updateDna = async (req, res) => {
  const companyId = req.params.companyId ? parseInt(req.params.companyId, 10) : 1;
  let dna = await getOrCreateDna(companyId);

  const { decisionStructure, channels, reporting, terms, rules, accuracy, aiEnabled } = req.body;

  await dna.update({
    ...(decisionStructure !== undefined && { decisionStructure }),
    ...(channels !== undefined && { channels }),
    ...(reporting !== undefined && { reporting }),
    ...(terms !== undefined && { terms }),
    ...(rules !== undefined && { rules }),
    ...(accuracy !== undefined && { accuracy }),
    ...(aiEnabled !== undefined && { aiEnabled }),
  });

  res.json({
    decisionStructure: dna.decisionStructure,
    channels: dna.channels,
    reporting: dna.reporting,
    terms: dna.terms,
    rules: dna.rules,
    accuracy: dna.accuracy,
    aiEnabled: dna.aiEnabled,
  });
};

// ── Company DNA 자동 추출 엔드포인트 ──

/**
 * POST /api/company-dna/extract/file
 * 업로드된 문서(PDF/DOCX/TXT)에서 Company DNA 자동 추출
 */
exports.extractFromFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '파일이 업로드되지 않았습니다.' });
    }

    const { path: filePath, originalname } = req.file;

    // 1. 문서 파싱 → plain text
    const text = await parseDocument(filePath, originalname);

    // 임시 파일 삭제
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }

    if (!text || text.trim().length < 50) {
      return res.status(400).json({ error: '문서에서 추출된 텍스트가 너무 짧습니다. (최소 50자 이상의 내용이 필요합니다)' });
    }

    // 2. Gemini AI 구조화 추출
    const extracted = await extractFromDocument(text);

    // 3. DB 저장 (upsert)
    const companyId = req.body.companyId ? parseInt(req.body.companyId, 10) : 1;
    let dna = await getOrCreateDna(companyId);
    await dna.update({
      decisionStructure: extracted.decisionStructure,
      channels: extracted.channels,
      reporting: extracted.reporting,
      terms: extracted.terms,
      rules: extracted.rules,
      accuracy: extracted.accuracy,
      aiEnabled: true,
    });

    res.json({
      message: 'Company DNA가 문서에서 자동 생성되었습니다.',
      source: 'file',
      fileName: originalname,
      textLength: text.length,
      dna: {
        decisionStructure: dna.decisionStructure,
        channels: dna.channels,
        reporting: dna.reporting,
        terms: dna.terms,
        rules: dna.rules,
        accuracy: dna.accuracy,
        aiEnabled: dna.aiEnabled,
      },
    });
  } catch (err) {
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
    }
    console.error('[CompanyDNA extractFromFile Error]:', err.message);
    res.status(500).json({ error: err.message || 'Company DNA 추출에 실패했습니다.' });
  }
};

/**
 * POST /api/company-dna/extract/gmail
 * Gmail 이메일에서 Company DNA 자동 추출
 */
exports.extractFromGmail = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: { message: '인증이 필요합니다. 먼저 로그인해 주세요.' } });
    }

    // 1. Gmail OAuth 클라이언트 가져오기
    let auth;
    try {
      auth = await googleAuthService.getAuthorizedClientForUser(userId);
    } catch (authErr) {
      return res.status(400).json({
        error: {
          message: '연결된 Gmail 계정이 없습니다. [설정 > 계정 연동] 또는 Google 로그인으로 Gmail을 먼저 연결해 주세요.',
        },
      });
    }

    const gmail = google.gmail({ version: 'v1', auth });
    const maxResults = parseInt(req.body.maxResults, 10) || 25;

    // 2. 보낸 메일 우선 조회 (부족 시 전체 메일함 조회)
    let listRes = await gmail.users.messages.list({
      userId: 'me',
      maxResults,
      q: 'in:sent',
    });

    let messageIds = listRes.data.messages || [];
    if (messageIds.length < 3) {
      listRes = await gmail.users.messages.list({
        userId: 'me',
        maxResults,
      });
      messageIds = listRes.data.messages || [];
    }

    if (messageIds.length < 3) {
      return res.status(400).json({
        error: {
          message: `분석에 필요한 이메일이 부족합니다. (현재 ${messageIds.length}건, 최소 3건 필요)`,
        },
      });
    }

    // 3. 각 이메일 본문 추출
    const emails = await Promise.all(
      messageIds.map(async (m) => {
        try {
          const { data: msg } = await gmail.users.messages.get({
            userId: 'me',
            id: m.id,
            format: 'full',
          });
          const headers = Object.fromEntries(
            (msg.payload?.headers || []).map((h) => [h.name, h.value])
          );
          const body = extractPlainTextBody(msg.payload);
          return {
            subject: headers.Subject || '(제목 없음)',
            body: body || msg.snippet || '',
          };
        } catch {
          return null;
        }
      })
    );

    const validEmails = emails.filter(Boolean);
    if (validEmails.length < 3) {
      return res.status(400).json({
        error: { message: '이메일 본문을 읽을 수 없습니다. Gmail 권한을 확인해 주세요.' },
      });
    }

    // 4. Gemini AI 구조화 추출
    const extracted = await extractFromEmails(validEmails);

    // 5. DB 저장
    const companyId = req.body.companyId ? parseInt(req.body.companyId, 10) : 1;
    let dna = await getOrCreateDna(companyId);
    await dna.update({
      decisionStructure: extracted.decisionStructure,
      channels: extracted.channels,
      reporting: extracted.reporting,
      terms: extracted.terms,
      rules: extracted.rules,
      accuracy: extracted.accuracy,
      aiEnabled: true,
    });

    res.json({
      message: 'Company DNA가 Gmail 이메일에서 자동 생성되었습니다.',
      source: 'gmail',
      emailCount: validEmails.length,
      dna: {
        decisionStructure: dna.decisionStructure,
        channels: dna.channels,
        reporting: dna.reporting,
        terms: dna.terms,
        rules: dna.rules,
        accuracy: dna.accuracy,
        aiEnabled: dna.aiEnabled,
      },
    });
  } catch (err) {
    console.error('[CompanyDNA extractFromGmail Error]:', err.message);
    res.status(err.statusCode || 500).json({
      error: { message: err.message || 'Gmail 기반 Company DNA 추출에 실패했습니다.' },
    });
  }
};

/**
 * 이메일 payload에서 plain text 본문 추출 (재귀)
 */
function extractPlainTextBody(payload) {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf-8');
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractPlainTextBody(part);
      if (text) return text;
    }
  }
  return '';
}
