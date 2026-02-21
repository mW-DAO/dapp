/**
 * Web3 BigInt 转换工具函数
 * 用于安全地将合约返回的 BigInt 值转换为其他类型
 */

/**
 * 将 BigInt 转换为 Number
 * 注意：仅用于小整数（< Number.MAX_SAFE_INTEGER）
 * 如 NFT 数量、用户数、时间戳等
 * 
 * @param value - BigInt 值或 undefined
 * @param fallback - 默认值，默认为 0
 * @returns Number 类型的值
 */
export function toNumber(value: bigint | undefined, fallback = 0): number {
  return value !== undefined ? Number(value) : fallback;
}

/**
 * 将 BigInt 保持为 BigInt 类型
 * 用于需要保持 BigInt 进行后续计算的场景
 * 
 * @param value - BigInt 值或 undefined
 * @param fallback - 默认值，默认为 0n
 * @returns BigInt 类型的值
 */
export function toBigInt(value: bigint | undefined, fallback = 0n): bigint {
  return value ?? fallback;
}

/**
 * 将 BigInt 转换为字符串
 * 用于需要保持完整精度的大数值
 * 
 * @param value - BigInt 值或 undefined
 * @param fallback - 默认值，默认为 "0"
 * @returns 字符串类型的值
 */
export function toBigIntString(value: bigint | undefined, fallback = "0"): string {
  return value !== undefined ? value.toString() : fallback;
}
