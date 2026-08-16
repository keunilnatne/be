const { CompanyDna, Company } = require('../models');

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
