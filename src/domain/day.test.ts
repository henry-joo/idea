import { describe, expect, it } from 'vitest';
import { buildDinnerContext, dayFlags, evaluateEaten, EMPTY_ENTRY, type MealEntry } from './meal/day';
import { recommendMeal } from './meal/recommend';
import { DEFAULT_PROFILE } from './profile/defaults';

const P = DEFAULT_PROFILE;
const eat = (text: string): MealEntry => ({ text, skipped: false });
const skipped: MealEntry = { text: '', skipped: true };
const day = (b: MealEntry, l: MealEntry) => [evaluateEaten(b, 'BREAKFAST', P), evaluateEaten(l, 'LUNCH', P)];
const heavyLunch = '잡곡밥, 제육볶음, 양배추샐러드, 소고기무국';
const goodDay = day(eat('백미밥, 황태국, 계란말이, 시금치나물'), eat('잡곡밥, 소고기무국, 두부조림, 콩나물무침'));

describe('먹은 끼니 평가', () => {
  it('속 편한 구성은 좋은 한 끼', () => {
    const e = evaluateEaten(eat('백미밥, 황태국, 계란말이, 시금치나물'), 'BREAKFAST', P);
    expect(e.grade).toBe('GOOD');
    expect(e.items.every((i) => i.label === 'GOOD' || i.label === 'OK')).toBe(true);
  });
  it('돼지고기·튀김·샐러드가 섞이면 부담될 수 있는 한 끼, 아쉬운 반찬 이름을 말해 준다', () => {
    const e = evaluateEaten(eat('백미밥, 제육볶음, 생선까스, 양배추샐러드, 소고기무국'), 'LUNCH', P);
    expect(e.grade).toBe('CAUTION');
    expect(e.summary).toContain('제육볶음');
    expect(e.items.find((i) => i.name === '제육볶음')!.label).toBe('PITY');
  });
  it('거름·빈 입력은 등급이 없다', () => {
    expect(evaluateEaten(skipped, 'LUNCH', P)).toMatchObject({ skipped: true, grade: null, empty: false });
    expect(evaluateEaten(EMPTY_ENTRY, 'LUNCH', P)).toMatchObject({ empty: true, grade: null });
  });
  it('알아보지 못한 이름만 있으면 안내한다', () => {
    const e = evaluateEaten(eat('오늘의특선'), 'LUNCH', P);
    expect(e.grade).toBeNull();
    expect(e.unknown).toEqual(['오늘의특선']);
  });
  it('이름으로 추정한 반찬은 표시한다', () => {
    expect(evaluateEaten(eat('김치볶음밥'), 'LUNCH', P).items[0]!.inferred).toBe(true);
  });
});

describe('이유는 일상 말로', () => {
  it('좋은 반찬은 이유를 생략하고, 아쉬운 반찬은 한 줄로 말한다', () => {
    const e = evaluateEaten(eat('황태국, 제육볶음, 돈가스, 양배추샐러드, 잔치국수, 배추김치, 신김치'), 'LUNCH', P);
    const r = (n: string) => e.items.find((i) => i.name === n)!.reason;
    expect(r('황태국')).toBe('');
    expect(r('제육볶음')).toContain('돼지고기');
    expect(r('돈가스')).toContain('튀김');
    expect(r('양배추샐러드')).toContain('찬 생채소');
    expect(r('잔치국수')).toContain('밀가루');
    expect(r('배추김치')).toContain('2~3조각');
    expect(r('신김치·묵은지')).toContain('차');
  });
  it('전문 용어(한열·화식·하드 룰)가 화면 문구에 새지 않는다', () => {
    const e = evaluateEaten(eat('백미밥, 소시지볶음, 요구르트, 사과, 시금치나물'), 'BREAKFAST', P);
    for (const i of e.items) expect(i.reason).not.toMatch(/한열|화식|하드 룰|\(寒\)|\(溫\)|온열/);
  });
});

describe('하루 요약', () => {
  it('기름진 것·찬 것·단백질·채소·국물을 가려낸다', () => {
    const f = dayFlags(day(EMPTY_ENTRY, eat(heavyLunch)));
    expect(f.oily).toContain('제육볶음');
    expect(f.cold).toContain('양배추샐러드');
    expect(f.hasProtein).toBe(true);
    expect(f.hasCookedVeg).toBe(false);
    expect(f.hasWarmSoup).toBe(true);
    expect(f.entered).toBe(1);
  });
});

describe('저녁 맞춤', () => {
  it('아무것도 안 적으면 기본 추천 안내', () => {
    const c = buildDinnerContext(P, day(EMPTY_ENTRY, EMPTY_ENTRY));
    expect(c.filled).toBe(false);
    expect(c.headline).toContain('적으면');
    expect(recommendMeal(P, 'DINNER', c).combos).toHaveLength(3);
  });

  it('찬 음식 + 기름진 점심 → 따뜻하고 담백하게, 양은 가볍게, 이유가 "오늘 먹은 것"과 짝으로 나온다', () => {
    const c = buildDinnerContext(P, day(EMPTY_ENTRY, eat(heavyLunch)));
    expect(c.headline).toContain('따뜻하게');
    expect(c.headline).toContain('담백하게');
    expect(c.portion.level).toBe('LIGHT');
    expect(c.wantTags.WARM_SOUP).toBeGreaterThan(0);
    expect(c.wantTags.RADISH).toBeGreaterThan(0);
    expect(c.reasons.find((r) => r.because.includes('제육볶음'))!.therefore).toContain('담백');
    expect(c.reasons.find((r) => r.because.includes('양배추샐러드'))!.therefore).toContain('따뜻한 국물');
  });

  it('잘 먹은 날은 평소 저녁', () => {
    const c = buildDinnerContext(P, goodDay);
    expect(c.reasons).toEqual([]);
    expect(c.headline).toContain('잘 드셨어요');
    expect(c.portion.level).toBe('NORMAL');
  });

  it('끼니를 거르면 든든하게, 양은 가득', () => {
    const c = buildDinnerContext(P, day(eat('백미밥, 황태국, 계란말이'), skipped));
    expect(c.portion.level).toBe('FULL');
    expect(c.reasons.some((r) => r.because.includes('점심을 거르셨어요'))).toBe(true);
    expect(c.headline).toContain('든든하게');
  });

  it('단백질이 없던 날엔 계란·두부·생선을 꼭 넣는다', () => {
    const c = buildDinnerContext(P, day(eat('백미밥, 시금치나물, 배추김치'), EMPTY_ENTRY));
    expect(c.reasons.some((r) => r.because.includes('단백질'))).toBe(true);
    const combo = recommendMeal(P, 'DINNER', c).combos[0]!;
    expect(combo.protein.tags.some((t) => ['EGG', 'TOFU', 'FISH'].includes(t))).toBe(true);
  });

  it('조합이 오늘의 이유를 말하고, 따뜻한 국물·익힌 무 국을 앞세운다', () => {
    const plan = recommendMeal(P, 'DINNER', buildDinnerContext(P, day(EMPTY_ENTRY, eat(heavyLunch))));
    const c = plan.combos[0]!;
    expect(c.soup.tags).toContain('RADISH');
    expect(c.why.join(' ')).toContain('익힌 무');
  });

  it('오늘 먹은 단백질·반찬은 저녁에서 피한다', () => {
    const ctx = buildDinnerContext(P, day(EMPTY_ENTRY, eat('백미밥, 닭가슴살찜, 시금치나물')));
    expect(ctx.avoidFoodIds).toContain('chicken');
    for (const c of recommendMeal(P, 'DINNER', ctx).combos) {
      expect(c.protein.ingredients.some((i) => i.foodId === 'chicken')).toBe(false);
    }
  });

  it('점심에 먹은 국은 저녁 국으로 다시 나오지 않는다', () => {
    const ctx = buildDinnerContext(P, day(EMPTY_ENTRY, eat('백미밥, 소고기무국, 두부조림')));
    for (const c of recommendMeal(P, 'DINNER', ctx).combos) expect(c.soup.id).not.toBe('soup_beef_radish');
  });

  it('익힌 채소가 없던 날은 나물을 두 가지로', () => {
    const ctx = buildDinnerContext(P, day(eat('백미밥, 계란말이'), EMPTY_ENTRY));
    expect(ctx.extraVeggie).toBe(true);
    const c = recommendMeal(P, 'DINNER', ctx).combos[0]!;
    expect(c.veggie2).toBeDefined();
    expect(c.veggie2!.id).not.toBe(c.veggie.id);
  });

  it('저녁 후보는 여전히 전부 담기 판정(규칙 엔진 가드레일 유지)', () => {
    const ctx = buildDinnerContext(P, day(eat('제육볶음, 양배추샐러드'), eat('돈가스, 잔치국수')));
    for (const c of recommendMeal(P, 'DINNER', ctx).combos) {
      for (const d of [c.rice, c.soup, c.protein, c.veggie]) {
        for (const bad of ['PORK', 'FRIED', 'RAW_SALAD', 'NOODLE'] as const) expect(d.tags, d.name).not.toContain(bad);
      }
    }
  });
});
