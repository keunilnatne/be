class ApiError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
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
}

module.exports = ApiError;
