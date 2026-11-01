import type { MedicationEntry } from '../medication/types';
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
    /** 복약 시각 기본 목록. 약 목록(medications)의 시각과 합쳐 60분 창을 만든다 */
    medSchedules: HHMM[];
    /** [v2] 약 이름 입력 (D5) */
    medications: MedicationEntry[];
  };
  mealEnvironment: {
    breakfast: 'CAFETERIA' | 'HOME' | 'SKIP';
    lunch: 'CAFETERIA' | 'RESTAURANT' | 'HOME';
    /** [v2] 저녁 (D6) */
    dinner: 'HOME' | 'RESTAURANT' | 'SKIP';
    /** [v2] 주말·쉬는 날에는 아침·점심도 집밥 모드 */
    weekendMode: 'HOME';
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
  /** [v2] 쉬는 날로 직접 표시한 날짜 (공휴일 데이터가 없어서 사용자가 표시) */
  holidayDates: string[];
}
