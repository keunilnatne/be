const DEFAULT_CODES = {
  400: 'VALIDATION_ERROR',
  401: 'AUTHENTICATION_REQUIRED',
  403: 'ACCESS_DENIED',
  404: 'RESOURCE_NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_SERVER_ERROR',
  502: 'UPSTREAM_SERVICE_ERROR',
  503: 'SERVICE_UNAVAILABLE',
  504: 'UPSTREAM_TIMEOUT',
};

class ApiError extends Error {
  constructor(statusCode, message, details, code) {
    super(message);
    this.statusCode = statusCode;
    this.details = details ?? null;
    this.code = code || ApiError.codeForStatus(statusCode);
  }

  static codeForStatus(statusCode) {
    return DEFAULT_CODES[statusCode] || (statusCode >= 500
      ? 'INTERNAL_SERVER_ERROR'
      : 'REQUEST_FAILED');
  }

  static badRequest(message, details, code = 'VALIDATION_ERROR') {
    return new ApiError(400, message, details, code);
  }

  static unauthorized(message = '인증이 필요합니다.', code = 'AUTHENTICATION_REQUIRED') {
    return new ApiError(401, message, null, code);
  }

  static forbidden(message = '접근 권한이 없습니다.', code = 'ACCESS_DENIED') {
    return new ApiError(403, message, null, code);
  }

  static notFound(message = '리소스를 찾을 수 없습니다.', code = 'RESOURCE_NOT_FOUND') {
    return new ApiError(404, message, null, code);
  }
  static aiGenerationFailed(statusCode = 502, details) {
    return new ApiError(
      statusCode,
      '메시지 생성에 실패했습니다. 잠시 후 다시 시도해주세요.',
      details,
      'AI_GENERATION_FAILED'
    );
  }

  static gmailNotConnected(details) {
    return new ApiError(
      409,
      'Gmail 계정이 연결되어 있지 않습니다.',
      details,
      'GMAIL_NOT_CONNECTED'
    );
  }

  static gmailSendFailed(details) {
    return new ApiError(
      502,
      'Gmail 전송에 실패했습니다. 잠시 후 다시 시도해주세요.',
      details,
      'GMAIL_SEND_FAILED'
    );
  }
}

module.exports = ApiError;
