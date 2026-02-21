import { NextResponse } from "next/server";

/**
 * 统一 API 响应格式
 */
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T | null;
}

/**
 * 业务状态码
 */
export const ApiCode = {
  SUCCESS: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  UNPROCESSABLE: 422,
  SERVER_ERROR: 500,
} as const;

/**
 * 成功响应
 */
export function success<T>(data: T, message = "Success"): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    code: ApiCode.SUCCESS,
    message,
    data,
  });
}

/**
 * 失败响应
 */
export function error(
  message: string,
  code: number = ApiCode.SERVER_ERROR,
  httpStatus: number | undefined = undefined
): NextResponse<ApiResponse<null>> {
  return NextResponse.json(
    {
      code,
      message,
      data: null,
    },
    { status: httpStatus !== undefined ? httpStatus : code >= 400 && code < 600 ? code : 500 }
  );
}

/**
 * Alias for error to match common conventions
 */
export const apiError = error;

/**
 * 参数错误
 */
export function badRequest(message = "Invalid parameters"): NextResponse<ApiResponse<null>> {
  return error(message, ApiCode.BAD_REQUEST);
}

/**
 * 未授权
 */
export function unauthorized(message = "Unauthorized"): NextResponse<ApiResponse<null>> {
  return error(message, ApiCode.UNAUTHORIZED);
}

/**
 * 禁止访问
 */
export function forbidden(message = "Forbidden"): NextResponse<ApiResponse<null>> {
  return error(message, ApiCode.FORBIDDEN);
}

/**
 * 资源不存在
 */
export function notFound(message = "Not found"): NextResponse<ApiResponse<null>> {
  return error(message, ApiCode.NOT_FOUND);
}

/**
 * 无法处理的实体（如验证失败）
 */
export function unprocessable(message = "Unprocessable entity"): NextResponse<ApiResponse<null>> {
  return error(message, ApiCode.UNPROCESSABLE);
}
