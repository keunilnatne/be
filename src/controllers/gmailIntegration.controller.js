const env = require('../config/env');
const gmailOAuthService = require('../services/gmailOAuthService');

function callbackHtml(payload) {
  const safePayload = JSON.stringify(payload).replace(/</g, '\\u003c');
  const safeOrigin = JSON.stringify(env.google.frontendOrigin);
  return `<!doctype html><html><body><script>
    if (window.opener) window.opener.postMessage(${safePayload}, ${safeOrigin});
    window.close();
  </script><p>Gmail 연결이 완료되었습니다. 이 창을 닫아 주세요.</p></body></html>`;
}

exports.connect = async (req, res) => {
  res.json({ authorizationUrl: gmailOAuthService.getAuthorizationUrl(req.user.id) });
};

exports.callback = async (req, res) => {
  if (req.query.error) {
    return res.status(400).send(callbackHtml({ type: 'gmail-auth-error', message: 'Google에서 Gmail 연결을 취소했습니다.' }));
  }
  const integration = await gmailOAuthService.connect({
    state: req.query.state,
    code: req.query.code,
  });
  res.type('html').send(callbackHtml({
    type: 'gmail-auth-success',
    email: integration.googleEmail,
  }));
};

exports.status = async (req, res) => {
  res.json(await gmailOAuthService.status(req.user.id));
};

exports.disconnect = async (req, res) => {
  await gmailOAuthService.disconnect(req.user.id);
  res.status(204).send();
};

exports.callbackHtml = callbackHtml;
