import type { FoodTag } from '../food/types';
import type { HHMM } from '../shared/time';

/** 사용자가 입력한 약 한 줄 (D5) */
export interface MedicationEntry {
  /** 사용자가 적은 상품명·성분명 그대로 */
  name: string;
  /** 약물 사전 매칭 결과. 사전에 없으면 null */
  drugId: string | null;
  times: HHMM[];
  timing: 'BEFORE_MEAL' | 'AFTER_MEAL' | 'ANY';
}

export type DrugRuleKind = 'BLOCK' | 'SEPARATE' | 'CAUTION' | 'CONSISTENT';
export type DrugRuleTarget = FoodTag | 'MEAL_TIMING';

export interface DrugDef {
  id: string;
  ingredient: string;
  /** 상품명·성분명·영문명 (소문자 비교) */
  names: string[];
  classLabel: string;
  pathway?: string;
}

export interface DrugFoodRule {
  drugId: string;
  target: DrugRuleTarget;
  rule: DrugRuleKind;
  separateMinutes?: number;
  reason: string;
  /** 출처. 확인하지 못했으면 어디서 확인해야 하는지를 적는다 */
  source: string;
  /** 출처 원문을 직접 확인했는가. false면 화면에 "약사 확인 필요" */
  verified: boolean;
}

export interface DrugNote {
  drugName: string;
  ingredient: string;
  rule: DrugRuleKind;
  reason: string;
  source: string;
  verified: boolean;
}
