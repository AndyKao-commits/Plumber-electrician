import { zhTW } from 'date-fns/locale'
import { formatInTimeZone } from 'date-fns-tz'

export const APP_TIME_ZONE = 'Asia/Taipei'

export function formatTaipei(
  date: Date | string | number,
  pattern: string,
): string {
  return formatInTimeZone(date, APP_TIME_ZONE, pattern, { locale: zhTW })
}
