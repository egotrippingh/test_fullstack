import { BadRequestException } from '@nestjs/common';

export interface ResolvedDateRange {
  dateFrom: string;
  dateTo: string;
}

function toClickHouseDateTime(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function parseBoundary(value: string | undefined, fallback: Date, boundary: 'start' | 'end'): Date {
  if (!value) {
    return fallback;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const time = boundary === 'start' ? '00:00:00.000' : '23:59:59.999';
    return new Date(`${value}T${time}Z`);
  }

  return new Date(value);
}

export function resolveDateRange(dateFrom?: string, dateTo?: string): ResolvedDateRange {
  const fallbackTo = new Date();
  const fallbackFrom = new Date(fallbackTo);
  fallbackFrom.setDate(fallbackTo.getDate() - 30);

  const from = parseBoundary(dateFrom, fallbackFrom, 'start');
  const to = parseBoundary(dateTo, fallbackTo, 'end');

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new BadRequestException('Invalid date range');
  }

  if (from > to) {
    throw new BadRequestException('dateFrom must be earlier than dateTo');
  }

  return {
    dateFrom: toClickHouseDateTime(from),
    dateTo: toClickHouseDateTime(to)
  };
}
