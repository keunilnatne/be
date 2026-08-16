const teamMemoryService = require('../services/teamMemoryService');

function teamOf(user) {
  return user.team || 'default';
}

function serialize(memory) {
  return {
    id: String(memory.id),
    team: memory.team,
    type: memory.type,
    title: memory.title || '',
    purpose: memory.purpose || '',
    reason: memory.reason || '',
    request: memory.request || '',
    deadline: memory.deadline || '',
    text: memory.text || '',
    suggestion: memory.suggestion || '',
    confidence: memory.confidence,
    action: memory.action || '',
    description: memory.description || '',
    status: memory.status,
    updatedAt: memory.updatedAt,
    unread: false,
  };
}

exports.listPatterns = async (req, res) => {
  const memories = await teamMemoryService.list({
    team: teamOf(req.user),
    type: 'pattern',
    status: 'approved',
    search: req.query.q,
  });
  res.json(memories.map(serialize));
};

exports.listCandidates = async (req, res) => {
  const memories = await teamMemoryService.list({
    team: teamOf(req.user),
    type: 'candidate',
    status: 'pending',
  });
  res.json(memories.map(serialize));
};

exports.listLogs = async (req, res) => {
  const memories = await teamMemoryService.list({ team: teamOf(req.user), type: 'log' });
  res.json(memories.map(serialize));
};

exports.create = async (req, res) => {
  const memory = await teamMemoryService.create({ team: teamOf(req.user), body: req.body });
  res.status(201).json(serialize(memory));
};

exports.update = async (req, res) => {
  const memory = await teamMemoryService.update({
    id: req.params.id,
    team: teamOf(req.user),
    body: req.body,
  });
  res.json(serialize(memory));
};

exports.remove = async (req, res) => {
  await teamMemoryService.remove({ id: req.params.id, team: teamOf(req.user) });
  res.status(204).send();
};

exports.approve = async (req, res) => {
  const memory = await teamMemoryService.decideCandidate({
    id: req.params.id,
    team: teamOf(req.user),
    decision: 'approve',
  });
  res.json(serialize(memory));
};

exports.reject = async (req, res) => {
  const memory = await teamMemoryService.decideCandidate({
    id: req.params.id,
    team: teamOf(req.user),
    decision: 'reject',
  });
  res.json(serialize(memory));
};

exports.serialize = serialize;
