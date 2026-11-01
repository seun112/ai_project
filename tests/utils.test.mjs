// index.html의 스크립트를 그대로 불러와 유틸을 검사한다.
// 실행: node --test tests/utils.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const source = html.match(/<script>([\s\S]*)<\/script>/)[1].replace(/\binit\(\);\s*$/, '');

function load(store = {}) {
  const localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
  const ctx = vm.createContext({ localStorage, console });
  vm.runInContext(source, ctx);
  return { ctx, store, call: (expr) => JSON.parse(vm.runInContext(`JSON.stringify(${expr})`, ctx)) };
}
const { ctx, call } = load();
const has = (name) => vm.runInContext(`typeof ${name}`, ctx) === 'function';
const q = JSON.stringify;

test('parseAmount 허용', () => {
  for (const [input, value] of [['0', 0], ['1200000', 1200000], ['1,200,000', 1200000], [' 500 ', 500], ['999', 999]]) {
    assert.deepEqual(call(`parseAmount(${q(input)})`), { ok: true, value }, input);
  }
});

test('parseAmount 거부', () => {
  for (const input of ['1.5', '-1', '-1.5', 'abc', '12a', '', '   ', '1,5', '1,20,000', ',100', '100,', '+100', '１００', '99999999999999999']) {
    const r = call(`parseAmount(${q(input)})`);
    assert.equal(r.ok, false, input);
    assert.ok(r.error.length > 0, input);
  }
  const nullish = call('parseAmount(null)');
  assert.equal(nullish.ok, false);
});

test('parseAmount 최소값', () => {
  const r = call(`parseAmount('0', { min: 1 })`);
  assert.equal(r.ok, false);
  assert.equal(r.error, '1원 이상 입력하세요.');
  assert.equal(call(`parseAmount('1', { min: 1 })`).ok, true);
});

test('parseOptionalAmount는 빈칸을 0원으로 본다', () => {
  for (const input of ['', '   ', null]) {
    assert.deepEqual(call(`parseOptionalAmount(${q(input)})`), { ok: true, value: 0 }, String(input));
  }
  assert.deepEqual(call(`parseOptionalAmount('1,000')`), { ok: true, value: 1000 });
  for (const input of ['1.5', '-1', 'abc']) assert.equal(call(`parseOptionalAmount(${q(input)})`).ok, false, input);
});

test('allocationSummary', { skip: !has('allocationSummary') }, () => {
  const cats = q([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  const sum = (texts, total) => call(`allocationSummary(${cats}, ${q(texts)}, ${total})`);
  assert.deepEqual(sum({}, 1000), { sum: 0, bad: false, left: 1000, ok: false });
  assert.deepEqual(sum({ a: '400', b: '', c: '600' }, 1000), { sum: 1000, bad: false, left: 0, ok: true });
  assert.deepEqual(sum({ a: '1,100' }, 1000), { sum: 1100, bad: false, left: -100, ok: false });
  assert.deepEqual(sum({ a: '400', b: '1.5' }, 1000), { sum: 400, bad: true, left: 600, ok: false });
  assert.deepEqual(sum({ a: '1000', b: '1.5' }, 1000), { sum: 1000, bad: true, left: 0, ok: false }, '합이 맞아도 잘못된 칸이 있으면 저장 불가');
  assert.deepEqual(sum({ a: '100', z: '900' }, 1000), { sum: 100, bad: false, left: 900, ok: false }, '목록에 없는 분류는 더하지 않음');
});

test('applySettlement', { skip: !has('applySettlement') }, () => {
  const month = { baseAmount: 900, carryIn: 200, deduction: 100, total: 1000, allocations: { a: 1000 } };
  const data = call(`(() => {
    const d = { months: { '2026-10': { total: 1, settled: true } } };
    applySettlement(d, '2026-11', ${q(month)});
    return d;
  })()`);
  assert.deepEqual(data.months['2026-11'], { ...month, settled: true });
  assert.deepEqual(data.months['2026-10'], { total: 1, settled: true }, '다른 달은 그대로');
});

test('formatWon', () => {
  assert.equal(call('formatWon(1200000)'), '1,200,000원');
  assert.equal(call('formatWon(0)'), '0원');
  assert.equal(call('formatWon(-50000)'), '-50,000원');
  assert.equal(call('formatWon(-0)'), '0원');
  assert.equal(call('formatWon(999)'), '999원');
});

test('날짜 유틸', { skip: !has('weeksOfMonth') }, () => {
  assert.equal(call(`toDateKey(new Date(2026, 0, 5))`), '2026-01-05');
  assert.equal(call(`monthKeyOf('2026-11-03')`), '2026-11');
  assert.equal(call(`addMonths('2026-12', 1)`), '2027-01');
  assert.equal(call(`addMonths('2027-01', -1)`), '2026-12');
  assert.equal(call(`addMonths('2026-11', 14)`), '2028-01');
  assert.equal(call(`daysInMonth('2028-02')`), 29);
  assert.equal(call(`daysInMonth('2026-02')`), 28);
  assert.equal(call(`monthDates('2026-02').length`), 28);
  assert.equal(call(`monthDates('2026-11')[0]`), '2026-11-01');
  assert.equal(call(`monthDates('2026-11').at(-1)`), '2026-11-30');
  assert.equal(call(`formatMonth('2026-03')`), '2026년 3월');
});

test('weeksOfMonth', { skip: !has('weeksOfMonth') }, () => {
  const summary = (m) => call(`weeksOfMonth('${m}').map((w) => [w[0].slice(8), w.at(-1).slice(8)].join('-'))`);
  // 1일이 일요일: 첫 주는 1일 하루, 마지막 주는 30일 월요일 하루
  assert.deepEqual(summary('2026-11'), ['01-01', '02-08', '09-15', '16-22', '23-29', '30-30']);
  // 1일이 월요일
  assert.deepEqual(summary('2026-06'), ['01-07', '08-14', '15-21', '22-28', '29-30']);
  // 윤년 2월, 1일이 화요일
  assert.deepEqual(summary('2028-02'), ['01-06', '07-13', '14-20', '21-27', '28-29']);
  for (const m of ['2026-11', '2026-06', '2028-02']) {
    const days = call(`weeksOfMonth('${m}').flat()`);
    assert.deepEqual(days, call(`monthDates('${m}')`), m);
    for (const week of call(`weeksOfMonth('${m}')`)) assert.ok(week.length <= 7);
  }
});

test('isLockedDate는 이번 달 이전만 잠근다', { skip: !has('isLockedDate') }, () => {
  vm.runInContext(`getToday = () => '2026-11-15';`, ctx);
  assert.equal(call(`isLockedDate('2026-10-31')`), true);
  assert.equal(call(`isLockedDate('2025-12-31')`), true);
  assert.equal(call(`isLockedDate('2026-11-01')`), false);
  assert.equal(call(`isLockedDate('2026-11-30')`), false);
});

test('getToday는 로컬 시간 기준이다', { skip: !has('getToday') }, () => {
  const d = new Date();
  const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  assert.equal(load().call('getToday()'), local);
});

test('createEmptyData', { skip: !has('createEmptyData') }, () => {
  const data = call('createEmptyData()');
  assert.equal(data.version, 1);
  assert.deepEqual(data.categories.map((c) => c.name), ['식비', '의류', '취미', '교통', '기타']);
  assert.ok(data.categories.every((c) => typeof c.id === 'string' && c.id && c.hidden === false));
  assert.equal(new Set(data.categories.map((c) => c.id)).size, 5);
  assert.deepEqual(data.months, {});
  assert.deepEqual(data.expenses, []);
  assert.deepEqual(data.piggy, { balance: 0, history: [] });
  assert.deepEqual(data.unsettled, []);
  assert.equal(call('isValidData(createEmptyData())'), true);
});

test('loadData 상태 구분', { skip: !has('loadData') }, () => {
  const KEY = load().call('STORAGE_KEY');
  assert.equal(load().call('loadData().status'), 'empty');

  const saved = load();
  assert.equal(saved.call('saveData(createEmptyData())'), true);
  assert.equal(load(saved.store).call('loadData().status'), 'ok');

  const good = JSON.parse(saved.store[KEY]);
  const bad = {
    '깨진 JSON': '{not json',
    null: 'null',
    배열: '[]',
    '다른 버전': q({ ...good, version: 2 }),
    '버전 없음': q({ ...good, version: undefined }),
    'categories 누락': q({ ...good, categories: undefined }),
    'categories 원소 오류': q({ ...good, categories: [{ id: 1 }] }),
    'months 배열': q({ ...good, months: [] }),
    'expenses 객체': q({ ...good, expenses: {} }),
    'piggy 잔액 문자': q({ ...good, piggy: { balance: '0', history: [] } }),
    'piggy 내역 누락': q({ ...good, piggy: { balance: 0 } }),
    'unsettled 누락': q({ ...good, unsettled: undefined }),
  };
  for (const [name, value] of Object.entries(bad)) {
    const t = load({ [KEY]: value });
    assert.equal(t.call('loadData().status'), 'corrupt', name);
    assert.equal(t.store[KEY], value, `${name}: 원본 유지`);
  }
});

test('formatSigned', { skip: !has('formatSigned') }, () => {
  assert.equal(call('formatSigned(45000)'), '+45,000원');
  assert.equal(call('formatSigned(0)'), '0원');
  assert.equal(call('formatSigned(-50000)'), '-50,000원');
});

test('정산 판단', { skip: !has('lastSettledMonth') }, () => {
  const months = {
    '2026-08': { total: 100, settled: true },
    '2026-09': { total: 200, settled: false },
    '2026-10': { total: 1000, settled: true },
    '2026-12': { total: 300, settled: true },
  };
  const data = q({ months, expenses: [
    { date: '2026-10-03', amount: 300 },
    { date: '2026-10-31', amount: 900 },
    { date: '2026-11-01', amount: 50 },
  ] });
  const is = (expr) => call(expr.replaceAll('DATA', data));

  assert.equal(call(`lastSettledMonth({ months: {} }, '2026-11')`), null);
  assert.equal(is(`lastSettledMonth(DATA, '2026-08')`), null, '이전 정산 없음');
  assert.equal(is(`lastSettledMonth(DATA, '2026-11')`), '2026-10', '미래 달 제외');
  assert.equal(is(`lastSettledMonth(DATA, '2026-10')`), '2026-08', '미정산 달 건너뜀');
  assert.equal(is(`lastSettledMonth(DATA, '2027-03')`), '2026-12', '건너뛴 달');

  assert.equal(is(`needsSettlement(DATA, '2026-10')`), false);
  assert.equal(is(`needsSettlement(DATA, '2026-09')`), true);
  assert.equal(is(`needsSettlement(DATA, '2026-11')`), true);

  assert.equal(is(`monthSpent(DATA, '2026-10')`), 1200);
  assert.equal(is(`monthBalance(DATA, '2026-10')`), -200);

  assert.deepEqual(is(`wizardSteps(DATA, '2026-08')`), ['total', 'allocate']);
  assert.deepEqual(is(`wizardSteps(DATA, '2026-11')`), ['result', 'total', 'allocate']);
});

test('computeTotal', { skip: !has('computeTotal') }, () => {
  assert.equal(call('computeTotal(1000000, 50000, 0)'), 1050000);
  assert.equal(call('computeTotal(1000000, 0, 30000)'), 970000);
  assert.equal(call('computeTotal(0, 50000, 0)'), 50000);
  assert.equal(call('computeTotal(100, 0, 300)'), -200);
});

test('saveData 실패를 false로 알린다', { skip: !has('saveData') }, () => {
  const t = load();
  vm.runInContext(`localStorage.setItem = () => { throw new Error('QuotaExceededError'); };`, t.ctx);
  assert.equal(t.call('saveData(createEmptyData())'), false);
});
