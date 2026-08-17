class ApiError extends Error {
  constructor(statusCode, message, details, code) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.code = code;
  }

  static badRequest(message, details) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = '인증이 필요합니다.') {
    return new ApiError(401, message);
  }

  static forbidden(message = '접근 권한이 없습니다.') {
    return new ApiError(403, message);
  }

  static notFound(message = '리소스를 찾을 수 없습니다.') {
    return new ApiError(404, message);
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
