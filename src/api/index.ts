import { calendarMock } from './mocks/calendar.mock';
import { calendarReal } from './real/calendar.real';

const useMocks = import.meta.env.VITE_USE_MOCKS === 'true';

export const api = {
  calendar: useMocks ? calendarMock : calendarReal,
};
