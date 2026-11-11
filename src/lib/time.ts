import { zhTW } from 'date-fns/locale'
import { formatInTimeZone } from 'date-fns-tz'

export const APP_TIME_ZONE = 'Asia/Taipei'

export function formatTaipei(
  date: Date | string | number,
  pattern: string,
): string {
  return formatInTimeZone(date, APP_TIME_ZONE, pattern, { locale: zhTW })
}

/** Calendar date in Asia/Taipei as YYYY-MM-DD */
export function taipeiDateString(date: Date | string | number = new Date()): string {
  return formatInTimeZone(date, APP_TIME_ZONE, 'yyyy-MM-dd')
}
