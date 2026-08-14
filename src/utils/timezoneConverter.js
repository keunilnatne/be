const { DateTime } = require('luxon');

// 보낸 사람과 받는 사람의 시간대가 다를 때 사용하는 순수 변환 함수.
// AI 로직과 완전히 분리되어 있어 독립적으로 테스트/재사용 가능.
//
// isoDateTime: 'YYYY-MM-DDTHH:mm' 형태 (오프셋 없이, fromTimezone 기준 로컬 시각)
// fromTimezone / toTimezone: IANA 타임존 문자열 (예: 'Asia/Seoul', 'America/New_York')
function convertTimezone({ isoDateTime, fromTimezone, toTimezone }) {
  const source = DateTime.fromISO(isoDateTime, { zone: fromTimezone });
  if (!source.isValid) {
    const err = new Error(`유효하지 않은 날짜/시간입니다: ${isoDateTime} (${source.invalidReason})`);
    err.statusCode = 400;
    throw err;
  }

  const target = source.setZone(toTimezone);
  if (!target.isValid) {
    const err = new Error(`유효하지 않은 타임존입니다: ${toTimezone}`);
    err.statusCode = 400;
    throw err;
  }

  // 캘린더 날짜(연/월/일)만 비교. source.startOf('day')/target.startOf('day')를 그대로 diff하면
  // 두 타임존의 UTC 오프셋 차이 때문에 24시간 단위가 아닌 실제 경과시간으로 계산되어
  // 같은 날짜인데도 소수점 dayOffset(예: 0.54)이 나오는 문제가 있어, 날짜만 떼어내 비교한다.
  const sourceDateOnly = DateTime.fromObject({ year: source.year, month: source.month, day: source.day });
  const targetDateOnly = DateTime.fromObject({ year: target.year, month: target.month, day: target.day });
  const dayOffset = Math.round(targetDateOnly.diff(sourceDateOnly, 'days').days);

  return {
    source: {
      timezone: fromTimezone,
      iso: source.toISO(),
      label: source.toFormat('yyyy-MM-dd (ccc) HH:mm'),
      offset: source.toFormat('ZZ'),
    },
    target: {
      timezone: toTimezone,
      iso: target.toISO(),
      label: target.toFormat('yyyy-MM-dd (ccc) HH:mm'),
      offset: target.toFormat('ZZ'),
    },
    // 0이면 같은 날짜, 1이면 상대방 기준 다음날, -1이면 전날로 넘어감
    dayOffset,
  };
}

// AI 프롬프트에 그대로 주입할 수 있는 한 줄 설명 생성
function describeBothZones({ isoDateTime, fromTimezone, toTimezone, fromLabel = fromTimezone, toLabel = toTimezone }) {
  const result = convertTimezone({ isoDateTime, fromTimezone, toTimezone });
  const dayNote = result.dayOffset > 0 ? ' (다음날)' : result.dayOffset < 0 ? ' (전날)' : '';
  return `${result.source.label} [${fromLabel}] = ${result.target.label}${dayNote} [${toLabel}]`;
}

module.exports = { convertTimezone, describeBothZones };
