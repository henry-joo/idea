import type { HHMM } from '../shared/time';

export type Constitution = 'SOEUM' | 'SOYANG' | 'TAEEUM' | 'TAEYANG';
export type SubCondition = 'QI_STAGNATION' | 'COLD_DEFICIENCY' | 'HEAT_EXCESS' | 'METABOLIC_STASIS';

export const CONSTITUTIONS: readonly Constitution[] = ['SOEUM', 'SOYANG', 'TAEEUM', 'TAEYANG'];
export const SUB_CONDITIONS: readonly SubCondition[] = [
  'QI_STAGNATION',
  'COLD_DEFICIENCY',
  'HEAT_EXCESS',
  'METABOLIC_STASIS',
];

/** 명세 §5-1 UserProfile (필드 그대로) + 하루 일과 확장 */
export interface UserProfile {
  constitution: Constitution;
  subCondition: SubCondition;
  autonomicStatus: {
    parasympatheticLow: boolean;
    takingWesternMeds: boolean;
    medSchedules: HHMM[];
  };
  mealEnvironment: {
    breakfast: 'CAFETERIA' | 'HOME' | 'SKIP';
    lunch: 'CAFETERIA' | 'RESTAURANT' | 'HOME';
    lateNightHabit: 'FREQUENT' | 'OCCASIONAL' | 'NONE';
  };
  /**
   * [확장] 하루 일과 시각. 복약 60분 창과 식사 시각의 충돌 판정,
   * 야식 후 익일 아침까지 공복 시간 계산에 쓴다.
   */
  routine: {
    breakfast: HHMM;
    lunch: HHMM;
    dinner: HHMM;
    bedtime: HHMM;
  };
}
