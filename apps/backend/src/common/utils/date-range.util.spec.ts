import { BadRequestException } from '@nestjs/common';

import { resolveDateRange } from './date-range.util';

describe('resolveDateRange', () => {
  it('expands date-only ranges to full day boundaries', () => {
    expect(resolveDateRange('2026-04-14', '2026-04-14')).toEqual({
      dateFrom: '2026-04-14 00:00:00',
      dateTo: '2026-04-14 23:59:59'
    });
  });

  it('rejects invalid dates', () => {
    expect(() => resolveDateRange('bad-date', '2026-04-14')).toThrow(BadRequestException);
  });
});
