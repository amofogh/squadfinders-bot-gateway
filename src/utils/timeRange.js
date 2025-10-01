const UNIT_IN_MS = {
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
  mo: 30 * 24 * 60 * 60 * 1000,
  y: 365 * 24 * 60 * 60 * 1000
};

const TIMEFRAME_REGEX = /^(\d+)\s*(m|h|d|w|mo|y)$/i;

export const parseRelativeTimeframe = (value) => {
  if (!value) {
    return null;
  }

  const trimmed = String(value).trim().toLowerCase();
  const match = trimmed.match(TIMEFRAME_REGEX);

  if (!match) {
    return null;
  }

  const amount = Number.parseInt(match[1], 10);
  const unit = match[2];

  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  const unitMs = UNIT_IN_MS[unit];
  if (!unitMs) {
    return null;
  }

  return new Date(Date.now() - amount * unitMs);
};

export const parseDateInput = (value) => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
};

export const resolveTimeRange = ({ timeframe, since, until, defaultTimeframe = '30d' } = {}) => {
  const end = parseDateInput(until) ?? new Date();
  const start = parseDateInput(since) ?? parseRelativeTimeframe(timeframe ?? defaultTimeframe);

  if (!start || !end) {
    return null;
  }

  if (start > end) {
    return null;
  }

  return { start, end };
};
