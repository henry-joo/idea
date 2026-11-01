import type { Constitution, SubCondition, UserProfile } from './types';

/** 명세 §2 기본 임상 케이스: 소음인 · 기체증 · 부교감 저하 · 양약 복용 · 회사 아침/점심 · 야식 잦음 */
export const DEFAULT_PROFILE: UserProfile = {
  constitution: 'SOEUM',
  subCondition: 'QI_STAGNATION',
  autonomicStatus: {
    parasympatheticLow: true,
    takingWesternMeds: true,
    medSchedules: ['08:30', '13:00', '21:30'],
    medications: [],
  },
  mealEnvironment: {
    breakfast: 'CAFETERIA',
    lunch: 'CAFETERIA',
    dinner: 'HOME',
    weekendMode: 'HOME',
    lateNightHabit: 'FREQUENT',
  },
  routine: {
    breakfast: '07:50',
    lunch: '12:00',
    dinner: '19:00',
    bedtime: '23:30',
  },
  holidayDates: [],
};

/** 체질을 바꿀 때 제안하는 기본 병리 상태 */
export const DEFAULT_SUBCONDITION_BY_TYPE: Record<Constitution, SubCondition> = {
  SOEUM: 'QI_STAGNATION',
  SOYANG: 'HEAT_EXCESS',
  TAEEUM: 'METABOLIC_STASIS',
  TAEYANG: 'HEAT_EXCESS',
};

export function withConstitution(p: UserProfile, c: Constitution): UserProfile {
  return { ...p, constitution: c, subCondition: DEFAULT_SUBCONDITION_BY_TYPE[c] };
}
