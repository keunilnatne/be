const { Op } = require('sequelize');
const { sequelize, TeamMemory } = require('../models');
const ApiError = require('../utils/ApiError');

const WRITABLE_FIELDS = [
  'title', 'purpose', 'reason', 'request', 'deadline',
  'text', 'suggestion', 'confidence',
];

function pickFields(body) {
  return WRITABLE_FIELDS.reduce((result, field) => {
    if (body[field] !== undefined) result[field] = body[field];
    return result;
  }, {});
}

function validateConfidence(value) {
  if (value === undefined || value === null) return;
  if (!Number.isInteger(Number(value)) || Number(value) < 0 || Number(value) > 100) {
    throw ApiError.badRequest('confidence는 0부터 100 사이의 정수여야 합니다.');
  }
}

async function createLog({ team, action, description, transaction }) {
  return TeamMemory.create({
    team,
    type: 'log',
    action,
    description,
    status: 'approved',
  }, { transaction });
}

async function list({ team, type = 'pattern', status, search, transaction }) {
  const where = { team, type };
  if (status) where.status = status;
  if (search) {
    where[Op.or] = [
      { title: { [Op.like]: `%${search}%` } },
      { purpose: { [Op.like]: `%${search}%` } },
      { text: { [Op.like]: `%${search}%` } },
      { suggestion: { [Op.like]: `%${search}%` } },
    ];
  }
  return TeamMemory.findAll({ where, order: [['updatedAt', 'DESC']], transaction });
}

function runInTransaction(transaction, callback) {
  return transaction ? callback(transaction) : sequelize.transaction(callback);
}

async function create({ team, body, transaction: outerTransaction }) {
  const type = body.type || 'pattern';
  if (!['pattern', 'candidate'].includes(type)) {
    throw ApiError.badRequest('type은 pattern 또는 candidate여야 합니다.');
  }
  if (type === 'pattern' && !String(body.title || '').trim()) {
    throw ApiError.badRequest('패턴 title은 필수입니다.');
  }
  if (type === 'candidate' && !String(body.suggestion || '').trim()) {
    throw ApiError.badRequest('후보 suggestion은 필수입니다.');
  }
  validateConfidence(body.confidence);

  return runInTransaction(outerTransaction, async (transaction) => {
    const memory = await TeamMemory.create({
      team,
      type,
      ...pickFields(body),
      status: type === 'candidate' ? 'pending' : 'approved',
    }, { transaction });
    await createLog({
      team,
      action: type === 'candidate' ? 'AI 패턴 감지' : '패턴 추가',
      description: type === 'candidate'
        ? `신뢰도 ${memory.confidence}%의 학습 후보가 생성되었습니다.`
        : `"${memory.title}" 패턴이 추가되었습니다.`,
      transaction,
    });
    return memory;
  });
}

async function findOwned(id, team, transaction) {
  const memory = await TeamMemory.findOne({ where: { id, team }, transaction });
  if (!memory) throw ApiError.notFound('Team Memory를 찾을 수 없습니다.');
  return memory;
}

async function update({ id, team, body, transaction: outerTransaction }) {
  validateConfidence(body.confidence);
  return runInTransaction(outerTransaction, async (transaction) => {
    const memory = await findOwned(id, team, transaction);
    if (memory.type !== 'pattern') throw ApiError.badRequest('저장된 패턴만 수정할 수 있습니다.');
    const fields = pickFields(body);
    if (fields.title !== undefined && !String(fields.title).trim()) {
      throw ApiError.badRequest('패턴 title은 빈 값일 수 없습니다.');
    }
    await memory.update(fields, { transaction });
    await createLog({
      team,
      action: '패턴 업데이트',
      description: `"${memory.title}" 패턴이 수정되었습니다.`,
      transaction,
    });
    return memory;
  });
}

async function remove({ id, team, transaction: outerTransaction }) {
  return runInTransaction(outerTransaction, async (transaction) => {
    const memory = await findOwned(id, team, transaction);
    if (memory.type !== 'pattern') throw ApiError.badRequest('저장된 패턴만 삭제할 수 있습니다.');
    const title = memory.title;
    await memory.destroy({ transaction });
    await createLog({
      team,
      action: '패턴 삭제',
      description: `"${title}" 패턴이 삭제되었습니다.`,
      transaction,
    });
  });
}

async function decideCandidate({ id, team, decision, transaction: outerTransaction }) {
  return runInTransaction(outerTransaction, async (transaction) => {
    const candidate = await findOwned(id, team, transaction);
    if (candidate.type !== 'candidate' || candidate.status !== 'pending') {
      throw new ApiError(409, '대기 중인 학습 후보만 승인하거나 거절할 수 있습니다.');
    }

    if (decision === 'approve') {
      await candidate.update({
        type: 'pattern',
        status: 'approved',
        title: candidate.title || 'AI 학습 패턴',
        purpose: candidate.purpose || candidate.suggestion,
      }, { transaction });
      await createLog({
        team,
        action: 'AI 패턴 저장',
        description: `신뢰도 ${candidate.confidence}%의 AI 학습 후보가 저장되었습니다.`,
        transaction,
      });
    } else {
      await candidate.update({ status: 'rejected' }, { transaction });
      await createLog({
        team,
        action: 'AI 패턴 무시',
        description: `신뢰도 ${candidate.confidence}%의 학습 후보를 무시했습니다.`,
        transaction,
      });
    }
    return candidate;
  });
}

module.exports = { create, decideCandidate, list, remove, update };
