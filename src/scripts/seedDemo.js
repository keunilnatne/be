require('dotenv').config();
const { sequelize, Tag, EntityTag, Recipient } = require('../models');

const TAGS = [
  { category: 'tone', name: 'formal', label: '격식있는 존댓말', promptGuideline: '공식적인 존댓말과 격식을 갖춘 어투를 사용하세요.' },
  { category: 'tone', name: 'casual', label: '편안한 구어체', promptGuideline: '친근하고 편안한 어투를 사용하세요.' },
  { category: 'verbosity', name: 'concise', label: '핵심만 간결하게', promptGuideline: '군더더기 없이 핵심만 간결하게 전달하세요. 배경 설명은 최소화하세요.' },
  { category: 'verbosity', name: 'detailed', label: '배경까지 상세하게', promptGuideline: '배경과 맥락을 충분히 설명하고 상세하게 전달하세요.' },
  { category: 'structure', name: 'bullet-first', label: '결론/요청 먼저 불릿으로', promptGuideline: '결론과 요청사항을 먼저 불릿포인트로 정리한 뒤, 필요하면 설명을 덧붙이세요.' },
  { category: 'structure', name: 'narrative', label: '서술형 문단', promptGuideline: '서술형 문단으로 자연스러운 흐름으로 작성하세요.' },
  { category: 'directness', name: 'direct', label: '직설적 요청', promptGuideline: '돌려 말하지 말고 요청사항과 기한을 명확하게 밝히세요.' },
  { category: 'directness', name: 'indirect', label: '완곡한 요청', promptGuideline: '완곡하고 정중한 표현으로 요청하세요.' },
];

const RECIPIENTS = [
  {
    name: '박팀장',
    email: 'park.lead@example.com',
    jobRole: '의사결정자',
    tagNames: ['formal', 'concise', 'bullet-first', 'direct'],
  },
  {
    name: '김디자이너',
    email: 'kim.designer@example.com',
    jobRole: '디자이너',
    tagNames: ['casual', 'detailed', 'narrative', 'indirect'],
  },
];

async function seed() {
  await sequelize.sync({ alter: true });

  const tagByName = {};
  for (const t of TAGS) {
    const [tag] = await Tag.findOrCreate({
      where: { category: t.category, name: t.name },
      defaults: t,
    });
    tagByName[t.name] = tag;
  }

  for (const r of RECIPIENTS) {
    const [recipient] = await Recipient.findOrCreate({
      where: { email: r.email },
      defaults: { name: r.name, email: r.email, jobRole: r.jobRole },
    });

    for (const tagName of r.tagNames) {
      const tag = tagByName[tagName];
      await EntityTag.findOrCreate({
        where: { entityType: 'recipient', entityId: recipient.id, tagId: tag.id },
      });
    }

    console.log(`[seed] recipient ready: id=${recipient.id} name=${recipient.name}`);
  }

  console.log('[seed] 완료');
  await sequelize.close();
}

seed().catch((err) => {
  console.error('[seed] 실패:', err);
  process.exit(1);
});
