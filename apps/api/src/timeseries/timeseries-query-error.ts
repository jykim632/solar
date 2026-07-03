/** 시계열 쿼리 해석 단계의 도메인 에러 — controller에서 400으로 변환. */
export class TimeseriesQueryError extends Error {
  constructor(
    readonly path: string,
    message: string,
  ) {
    super(message);
    this.name = 'TimeseriesQueryError';
  }
}
