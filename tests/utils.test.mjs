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
  const ctx = vm.createContext({ localStorage, console, crypto: globalThis.crypto, TextEncoder });
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
    const d = { categories: [{ id: 'a', name: '식비', hidden: false }], expenses: [], months: { '2026-10': { total: 1, settled: true } } };
    applySettlement(d, '2026-11', { ...${q(month)}, categories: [{ id: 'a', name: '식비' }] });
    return d;
  })()`);
  assert.deepEqual(data.months['2026-11'], { ...month, settled: true });
  assert.deepEqual(data.months['2026-10'], { total: 1, settled: true }, '다른 달은 그대로');
  assert.deepEqual(data.categories, [{ id: 'a', name: '식비', hidden: false }]);
});

test('정산 저장: 저금통과 미정산 기록', { skip: !has('applySettlement') }, () => {
  const t = load();
  vm.runInContext(`getToday = () => '2026-11-14';`, t.ctx);
  const settle = (piggyBalance, extra) => t.call(`(() => {
    const d = { categories: [], expenses: [], months: {}, piggy: { balance: ${piggyBalance}, history: [] }, unsettled: [] };
    applySettlement(d, '2026-11', { baseAmount: 1, carryIn: 0, deduction: 0, total: 1, allocations: {}, categories: [], lastMonth: '2026-10', ...${q(extra)} });
    return d;
  })()`);
  const history = (d) => d.piggy.history.map(({ date, type, amount, memo }) => ({ date, type, amount, memo }));

  const saved = settle(100, { piggyIn: 70000 });
  assert.equal(saved.piggy.balance, 70100, '남은 돈 저축');
  assert.deepEqual(history(saved), [{ date: '2026-11-14', type: 'save', amount: 70000, memo: '10월 남은 돈 저축' }]);
  assert.deepEqual(saved.unsettled, []);

  const taken = settle(150000, { piggyOut: 30000 });
  assert.equal(taken.piggy.balance, 120000, '저금통 차감');
  assert.deepEqual(history(taken), [{ date: '2026-11-14', type: 'deficit', amount: 30000, memo: '10월 초과분 차감' }]);

  const kept = settle(500, { kept: 85000 });
  assert.equal(kept.piggy.balance, 500, '그냥 두기는 저금통에 영향 없음');
  assert.deepEqual(kept.piggy.history, []);
  assert.deepEqual(kept.unsettled, [{ month: '2026-10', amount: 85000 }]);

  const plain = settle(500, {});
  assert.equal(plain.piggy.balance, 500, '0원은 내역을 남기지 않음');
  assert.deepEqual(plain.piggy.history, []);
  assert.deepEqual(plain.unsettled, []);
});

test('closeSkippedMonths', { skip: !has('closeSkippedMonths') }, () => {
  const months = call(`(() => {
    const d = { months: { '2026-08': { total: 100, settled: true }, '2026-09': { total: 5, settled: false } } };
    closeSkippedMonths(d, '2026-08', '2026-12');
    return d.months;
  })()`);
  assert.deepEqual(Object.keys(months).sort(), ['2026-08', '2026-09', '2026-10', '2026-11'], '이번 달은 만들지 않음');
  assert.deepEqual(months['2026-09'], { total: 5, settled: false }, '있는 기록은 덮어쓰지 않음');
  assert.equal(months['2026-10'].total, null, '총 금액 미설정');
  assert.equal(months['2026-11'].settled, false);
  assert.equal(months['2026-11'].skipped, true);

  const yearEnd = call(`(() => { const d = { months: {} }; closeSkippedMonths(d, '2026-11', '2027-02'); return Object.keys(d.months).sort(); })()`);
  assert.deepEqual(yearEnd, ['2026-12', '2027-01'], '연도 경계');
  const none = call(`(() => { const d = { months: {} }; closeSkippedMonths(d, '2026-10', '2026-11'); closeSkippedMonths(d, null, '2026-11'); return d.months; })()`);
  assert.deepEqual(none, {}, '건너뛴 달이 없거나 첫 정산');
});

test('건너뛴 달은 다음 정산의 기준이 되지 않는다', { skip: !has('applySettlement') }, () => {
  const t = load();
  vm.runInContext(`getToday = () => '2026-11-14';`, t.ctx);
  const result = t.call(`(() => {
    const d = { categories: [], expenses: [{ date: '2026-08-05', amount: 900 }], months: { '2026-08': { total: 1000, settled: true } }, piggy: { balance: 0, history: [] }, unsettled: [] };
    const before = settlementContext(d, '2026-11');
    applySettlement(d, '2026-11', { baseAmount: 500, carryIn: 0, deduction: 0, total: 500, allocations: {}, categories: [], lastMonth: '2026-08', piggyIn: 100 });
    return { before, after: settlementContext(d, '2026-12'), last: lastSettledMonth(d, '2026-11'), sep: needsSettlement(d, '2026-09') };
  })()`);
  assert.deepEqual(result.before, { mode: 'leftover', lastMonth: '2026-08', amount: 100, piggyBalance: 0 }, '건너뛰어도 마지막 정산 달의 결과');
  assert.equal(result.last, '2026-08', '건너뛴 달은 정산 달이 아님');
  assert.equal(result.after.lastMonth, '2026-11', '다음 달은 방금 정산한 달 기준');
  assert.equal(result.sep, true);
});

test('authErrors', { skip: !has('authErrors') }, () => {
  const errors = (form) => call(`authErrors(${q({ pw: '', pw2: '', ...form })})`);
  const badFormat = '이메일 형식으로 입력해 주세요.';
  assert.deepEqual(errors({ mode: 'login', email: 'tomato@example.com', pw: 'x' }), {}, '로그인은 길이를 보지 않음');
  assert.deepEqual(errors({ mode: 'login', email: '', pw: '' }), { email: '이메일을 입력해 주세요.', pw: '비밀번호를 입력해 주세요.' });
  assert.equal(errors({ mode: 'login', email: '   ', pw: 'x' }).email, '이메일을 입력해 주세요.');
  for (const email of ['tomato', 'tomato@', '@example.com', 'to mato@example.com', 'tomato@example', 'a@b@c.com']) {
    assert.equal(errors({ mode: 'login', email, pw: 'x' }).email, badFormat, email);
  }
  assert.deepEqual(errors({ mode: 'login', email: ' Tomato@Example.COM ', pw: 'x' }), {}, '앞뒤 공백과 대문자 허용');

  const ok = { mode: 'signup', email: 'new@example.com', pw: 'password', pw2: 'password' };
  assert.deepEqual(errors(ok), {}, '8자는 허용');
  assert.equal(errors({ ...ok, pw: 'passwor', pw2: 'passwor' }).pw, '비밀번호는 8자 이상으로 만들어 주세요.');
  assert.equal(errors({ ...ok, pw: '', pw2: 'password' }).pw, '비밀번호를 입력해 주세요.');
  assert.equal(errors({ ...ok, pw2: '' }).pw2, '비밀번호를 한 번 더 입력해 주세요.');
  assert.equal(errors({ ...ok, pw2: 'password2' }).pw2, '비밀번호가 서로 달라요.');
});

test('authServerErrors', { skip: !has('authServerErrors') }, () => {
  const errors = (code, mode) => call(`authServerErrors(${q(code)}, ${q(mode)})`);
  const failed = { pw: '지금은 처리할 수 없어요. 잠시 후 다시 시도해 주세요.' };
  assert.deepEqual(errors('invalid_credentials', 'login'), { pw: '이메일 또는 비밀번호가 맞지 않아요.', emailRed: true });
  assert.deepEqual(errors('user_already_exists', 'signup'), { email: '이미 가입된 이메일이에요.' });
  assert.deepEqual(errors('email_exists', 'signup'), { email: '이미 가입된 이메일이에요.' });
  assert.deepEqual(errors('weak_password', 'signup'), { pw: '비밀번호는 8자 이상으로 만들어 주세요.' });
  assert.deepEqual(errors('email_address_invalid', 'signup'), { email: '이메일 형식으로 입력해 주세요.' });
  assert.deepEqual(errors('over_request_rate_limit', 'login'), failed);
  assert.deepEqual(errors('unexpected_failure', 'signup'), failed);
  assert.deepEqual(call(`authServerErrors(undefined, 'login')`), failed, '연결 실패');
});

test('requestAuth: 라이브러리를 못 불러와도 멈추지 않는다', { skip: !has('requestAuth') }, async () => {
  const { ctx: c } = load();
  const result = await vm.runInContext(`requestAuth({ mode: 'login', email: 'a@b.co', pw: 'password1' })`, c);
  assert.equal(result.userId, undefined);
  assert.equal(result.code, undefined);
});

test('categoryNameError', { skip: !has('categoryNameError') }, () => {
  const cats = q([{ name: '식비' }, { name: '교통' }]);
  const error = (name) => call(`categoryNameError(${q(name)}, ${cats})`);
  assert.equal(error('반려동물'), '');
  assert.equal(error('  반려동물  '), '', '앞뒤 공백은 빼고 판단');
  assert.equal(error('가나다라마바사아자차'), '', '10자는 허용');
  assert.equal(error(''), '분류 이름을 입력해 주세요.');
  assert.equal(error('   '), '분류 이름을 입력해 주세요.');
  assert.equal(error('가나다라마바사아자차카'), '분류 이름은 10자 이하로 입력해 주세요.');
  assert.equal(error('식비'), '이미 있는 분류예요.');
  assert.equal(error(' 교통 '), '이미 있는 분류예요.');
});

test('applyCategories', { skip: !has('applyCategories') }, () => {
  const before = [
    { id: 'a', name: '식비', hidden: false },
    { id: 'b', name: '의류', hidden: false },
    { id: 'c', name: '취미', hidden: false },
    { id: 'old', name: '예전', hidden: true },
    { id: 'gone', name: '내역 없음', hidden: true },
  ];
  const expenses = [{ categoryId: 'b' }, { categoryId: 'old' }];
  const drafts = [{ id: 'a', name: '식비' }, { id: 'new', name: '반려동물' }];
  const result = call(`(() => {
    const d = { categories: ${q(before)}, expenses: ${q(expenses)} };
    applyCategories(d, ${q(drafts)});
    return d.categories;
  })()`);
  assert.deepEqual(result, [
    { id: 'a', name: '식비', hidden: false },
    { id: 'b', name: '의류', hidden: true },
    { id: 'old', name: '예전', hidden: true },
    { id: 'new', name: '반려동물', hidden: false },
  ], '내역 있는 분류는 숨기고, 내역 없는 분류는 지우고, 새 분류는 뒤에 붙임');
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
  assert.deepEqual(data.categories.map((c) => c.name), ['식비', '의류', '취미', '교통', '기타']);
  assert.ok(data.categories.every((c) => typeof c.id === 'string' && c.id && c.hidden === false));
  assert.equal(new Set(data.categories.map((c) => c.id)).size, 5);
  assert.deepEqual(data.months, {});
  assert.deepEqual(data.expenses, []);
  assert.deepEqual(data.piggy, { balance: 0, history: [] });
  assert.deepEqual(data.unsettled, []);
  assert.deepEqual(call('dataToRows(createEmptyData())').categories.map((c) => c.name), ['식비', '의류', '취미', '교통', '기타'], '만든 순서가 id 순서');
  assert.deepEqual([...data.categories].sort((a, b) => (a.id < b.id ? -1 : 1)), data.categories, '같은 1ms에 만들어도 id 순서가 만든 순서');
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
});

test('calcSettlement 총 금액', { skip: !has('calcSettlement') }, () => {
  const calc = (base) => call(`calcSettlement({ mode: 'first', amount: 0 }, { base: ${q(base)} })`);
  assert.deepEqual(calc('1,000,000'), { base: 1000000, carryIn: 0, deduction: 0, piggyIn: 0, piggyOut: 0, total: 1000000, why: '', ok: true });
  assert.equal(calc('').why, 'empty');
  assert.equal(calc('   ').why, 'empty');
  assert.equal(calc('1.5').why, 'base');
  assert.equal(calc('abc').why, 'base');
  assert.equal(calc('0').why, 'total');
  assert.equal(calc('1').ok, true);
});

test('calcSettlement 남은 돈 처리', { skip: !has('calcSettlement') }, () => {
  const calc = (inputs) => call(`calcSettlement({ mode: 'leftover', amount: 120000 }, ${q({ base: '1,000,000', ...inputs })})`);
  const ok = calc({ save: '70,000', carry: '50,000' });
  assert.equal(ok.ok, true);
  assert.equal(ok.piggyIn, 70000);
  assert.equal(ok.carryIn, 50000);
  assert.equal(ok.total, 1050000);
  assert.equal(calc({ save: '120,000', carry: '' }).ok, true, '빈칸은 0원');
  assert.equal(calc({ save: '', carry: '120000' }).total, 1120000);
  assert.equal(calc({ save: '', carry: '' }).why, 'sum');
  assert.equal(calc({ save: '70000', carry: '49999' }).why, 'sum');
  assert.equal(calc({ save: '70000', carry: '50001' }).why, 'sum');
  assert.equal(calc({ save: '1.5', carry: '50000' }).why, 'bad');
  assert.equal(calc({ save: '70000', carry: 'abc' }).why, 'bad');
  assert.equal(call(`calcSettlement({ mode: 'leftover', amount: 100 }, { base: 'abc', save: '1.5' })`).why, 'base', '기본 금액 오류가 먼저');
  assert.equal(call(`calcSettlement({ mode: 'leftover', amount: 100 }, { base: '', carry: '100' })`).why, 'empty');
  assert.equal(call(`calcSettlement({ mode: 'leftover', amount: 100 }, { base: '0', carry: '100' })`).ok, true, '기본 0원이어도 이월로 1원 이상');
  assert.equal(call(`calcSettlement({ mode: 'leftover', amount: 100 }, { base: '0', save: '100' })`).why, 'total');
});

test('calcSettlement 초과 처리', { skip: !has('calcSettlement') }, () => {
  const context = q({ mode: 'over', amount: 85000, piggyBalance: 150000 });
  const calc = (inputs) => call(`calcSettlement(${context}, ${q({ base: '1,000,000', ...inputs })})`);
  const next = calc({ option: 'next' });
  assert.equal(next.deduction, 85000);
  assert.equal(next.total, 915000);
  assert.equal(next.piggyOut, 0);
  const keep = calc({ option: 'keep' });
  assert.equal(keep.deduction, 0);
  assert.equal(keep.total, 1000000);
  assert.equal(keep.piggyOut, 0);
  const mix = calc({ option: 'mix', piggy: '30,000' });
  assert.equal(mix.piggyOut, 30000);
  assert.equal(mix.deduction, 55000);
  assert.equal(mix.piggyOut + mix.deduction, 85000, '저금통 + 다음 달 차감 = 초과분');
  assert.equal(mix.total, 945000);
  assert.equal(calc({ option: 'mix', piggy: '' }).deduction, 85000, '빈칸은 저금통에서 0원');
  assert.equal(calc({ option: 'mix', piggy: '85,000' }).ok, true);
  assert.equal(calc({ option: 'mix', piggy: '85,001' }).why, 'cap', '초과분보다 많이 뺄 수 없음');
  assert.equal(calc({ option: 'mix', piggy: '1.5' }).why, 'bad');
  const poor = q({ mode: 'over', amount: 85000, piggyBalance: 50000 });
  assert.equal(call(`calcSettlement(${poor}, { base: '1000', option: 'mix', piggy: '50001' })`).why, 'cap', '잔액보다 많이 뺄 수 없음');
  assert.equal(call(`calcSettlement(${poor}, { base: '100000', option: 'mix', piggy: '50000' })`).ok, true);
  assert.equal(calc({ base: '85000', option: 'next' }).why, 'total', '차감 후 0원이면 진행 불가');
});

test('settlementContext', { skip: !has('settlementContext') }, () => {
  const data = (spent) => q({
    months: { '2026-10': { total: 1000, settled: true } },
    expenses: [{ date: '2026-10-05', amount: spent }],
    piggy: { balance: 500 },
  });
  assert.equal(call(`settlementContext({ months: {}, expenses: [], piggy: { balance: 0 } }, '2026-11').mode`), 'first');
  assert.deepEqual(call(`settlementContext(${data(700)}, '2026-11')`), { mode: 'leftover', lastMonth: '2026-10', amount: 300, piggyBalance: 500 });
  assert.deepEqual(call(`settlementContext(${data(1200)}, '2026-11')`), { mode: 'over', lastMonth: '2026-10', amount: 200, piggyBalance: 500 });
  assert.equal(call(`settlementContext(${data(1000)}, '2026-11').mode`), 'even');
  assert.equal(call(`settlementContext(${data(700)}, '2027-02').lastMonth`), '2026-10', '건너뛴 달은 마지막 정산 달 기준');
});

test('formatDate는 요일을 붙인다', { skip: !has('formatDate') }, () => {
  assert.equal(call(`formatDate('2026-11-14')`), '2026년 11월 14일 (토)');
  assert.equal(call(`formatDate('2026-11-02')`), '2026년 11월 2일 (월)');
  assert.equal(call(`formatDate('2026-11-01')`), '2026년 11월 1일 (일)');
});

test('computeTotal', { skip: !has('computeTotal') }, () => {
  assert.equal(call('computeTotal(1000000, 50000, 0)'), 1050000);
  assert.equal(call('computeTotal(1000000, 0, 30000)'), 970000);
  assert.equal(call('computeTotal(0, 50000, 0)'), 50000);
  assert.equal(call('computeTotal(100, 0, 300)'), -200);
});

test('expenseError', { skip: !has('expenseError') }, () => {
  assert.equal(call(`expenseError('a', '9,000')`), '');
  assert.equal(call(`expenseError('a', '1')`), '');
  assert.equal(call(`expenseError('', '9000')`), '분류를 먼저 골라 주세요.');
  for (const text of ['', '1.5', '-1', 'abc']) assert.equal(call(`expenseError('a', ${q(text)})`), '금액은 원 단위 숫자만 입력할 수 있어요.', text);
  assert.equal(call(`expenseError('a', '0')`), '1원 이상 입력해 주세요.');
});

test('canEditDate는 이번 달 오늘까지만 허용한다', { skip: !has('canEditDate') }, () => {
  const t = load();
  vm.runInContext(`getToday = () => '2026-11-14';`, t.ctx);
  for (const date of ['2026-11-01', '2026-11-13', '2026-11-14']) assert.equal(t.call(`canEditDate('${date}')`), true, date);
  for (const date of ['2026-11-15', '2026-11-30', '2026-12-01', '2026-10-31', '2025-11-14']) assert.equal(t.call(`canEditDate('${date}')`), false, date);
});

test('바꿀 수 없는 날짜의 지출은 추가·삭제되지 않는다', { skip: !has('canEditDate') }, () => {
  const t = load();
  vm.runInContext(`getToday = () => '2026-11-14';`, t.ctx);
  const expense = (date) => q({ date, categoryId: 'a', amount: 100, memo: '' });
  const result = t.call(`(() => {
    const d = { expenses: [{ id: 'old', date: '2026-10-31', categoryId: 'a', amount: 1 }] };
    return {
      lastMonth: addExpense(d, ${expense('2026-10-31')}),
      future: addExpense(d, ${expense('2026-11-15')}),
      removeOld: deleteExpense(d, 'old'),
      removeNone: deleteExpense(d, 'nope'),
      count: d.expenses.length,
    };
  })()`);
  assert.deepEqual(result, { lastMonth: false, future: false, removeOld: false, removeNone: false, count: 1 });
});

test('updateExpense', { skip: !has('updateExpense') }, () => {
  const t = load();
  vm.runInContext(`getToday = () => '2026-11-14';`, t.ctx);
  const result = t.call(`(() => {
    const d = { expenses: [
      { id: 'now', date: '2026-11-03', categoryId: 'a', amount: 100, memo: '전' },
      { id: 'old', date: '2026-10-03', categoryId: 'a', amount: 200, memo: '전' },
    ] };
    const change = { categoryId: 'b', amount: 300, memo: '후' };
    return { now: updateExpense(d, 'now', change), old: updateExpense(d, 'old', change), none: updateExpense(d, 'zz', change), expenses: d.expenses };
  })()`);
  assert.equal(result.now, true);
  assert.equal(result.old, false, '지난달 기록은 수정 불가');
  assert.equal(result.none, false);
  assert.deepEqual(result.expenses[0], { id: 'now', date: '2026-11-03', categoryId: 'b', amount: 300, memo: '후' }, '날짜는 그대로');
  assert.deepEqual(result.expenses[1], { id: 'old', date: '2026-10-03', categoryId: 'a', amount: 200, memo: '전' });
});

test('지출 추가와 삭제', { skip: !has('addExpense') }, () => {
  const t = load();
  vm.runInContext(`getToday = () => '2026-11-14';`, t.ctx);
  const d = t.call(`(() => {
    const d = { expenses: [] };
    addExpense(d, { date: '2026-11-14', categoryId: 'a', amount: 9000, memo: '점심' });
    addExpense(d, { date: '2026-11-14', categoryId: 'b', amount: 1000, memo: '' });
    addExpense(d, { date: '2026-11-13', categoryId: 'a', amount: 500, memo: '' });
    const spent = daySpent(d, '2026-11-14');
    deleteExpense(d, d.expenses[0].id);
    return { spent, left: d.expenses, after: daySpent(d, '2026-11-14') };
  })()`);
  assert.equal(d.spent, 10000);
  assert.equal(d.after, 1000);
  assert.deepEqual(d.left.map((e) => e.amount), [1000, 500]);
  assert.ok(d.left.every((e) => typeof e.id === 'string' && e.id));
});

test('monthSummary는 그 달 지출만 합친다', { skip: !has('monthSummary') }, () => {
  const data = q({ expenses: [
    { date: '2026-10-31', categoryId: 'a', amount: 999 },
    { date: '2026-11-01', categoryId: 'a', amount: 100 },
    { date: '2026-11-30', categoryId: 'a', amount: 200 },
    { date: '2026-11-14', categoryId: 'b', amount: 50 },
    { date: '2026-12-01', categoryId: 'b', amount: 999 },
  ] });
  assert.deepEqual(call(`monthSummary(${data}, '2026-11')`), { spent: 350, byCategory: { a: 300, b: 50 } });
  assert.deepEqual(call(`monthSummary(${data}, '2027-01')`), { spent: 0, byCategory: {} });
});

test('PRD 예시: 분류 초과분은 총 잔액에서 감액된다', { skip: !has('monthSummary') }, () => {
  const data = q({ expenses: [
    { date: '2026-11-01', categoryId: 'food', amount: 450000 },
    { date: '2026-11-02', categoryId: 'cloth', amount: 100000 },
  ] });
  const { spent, byCategory } = call(`monthSummary(${data}, '2026-11')`);
  assert.equal(1000000 - spent, 450000, '총 잔액 45만');
  assert.equal(400000 - byCategory.food, -50000, '식비 잔액 -5만');
  assert.equal(600000 - byCategory.cloth, 500000, '의류 잔액 +50만');
});

test('usedPercent', { skip: !has('usedPercent') }, () => {
  assert.equal(call('usedPercent(0, 1000)'), 0);
  assert.equal(call('usedPercent(250, 1000)'), 25);
  assert.equal(call('usedPercent(1000, 1000)'), 100);
  assert.equal(call('usedPercent(5000, 1000)'), 100, '넘어도 100%');
  assert.equal(call('usedPercent(0, 0)'), 0, '배분 0원, 지출 없음');
  assert.equal(call('usedPercent(10, 0)'), 100, '배분 0원인데 지출 있음');
});

test('dayTotals', { skip: !has('dayTotals') }, () => {
  const data = q({ expenses: [
    { date: '2026-10-31', amount: 1 },
    { date: '2026-11-03', amount: 100 },
    { date: '2026-11-03', amount: 50 },
    { date: '2026-11-30', amount: 7 },
  ] });
  assert.deepEqual(call(`dayTotals(${data}, '2026-11')`), { '2026-11-03': 150, '2026-11-30': 7 });
});

test('earliestMonth', { skip: !has('earliestMonth') }, () => {
  assert.equal(call(`earliestMonth({ expenses: [], months: {} }, '2026-11')`), '2026-11');
  assert.equal(call(`earliestMonth({ expenses: [{ date: '2026-08-02' }], months: { '2026-09': {} } }, '2026-11')`), '2026-08');
  assert.equal(call(`earliestMonth({ expenses: [], months: { '2026-09': {} } }, '2026-11')`), '2026-09', '지출 없이 정산만 있는 달');
});

test('formatDay', { skip: !has('formatDay') }, () => {
  assert.equal(call(`formatDay('2026-11-14')`), '11월 14일 (토)');
  assert.equal(call(`formatDay('2026-01-05')`), '1월 5일 (월)');
});

test('settingsState와 안내 문구', { skip: !has('settingsState') }, () => {
  const cats = q([{ id: 'a' }, { id: 'b' }]);
  const month = q({ total: 1000, allocations: { a: 400, b: 600 } });
  const state = (total, a, b) => call(`settingsState(${cats}, ${month}, ${q({ total, allocations: { a, b } })})`);
  const hint = (total, a, b) => call(`settingsHint(settingsState(${cats}, ${month}, ${q({ total, allocations: { a, b } })}))`);

  assert.equal(state('1,000', '400', '600').ok, false);
  assert.equal(hint('1,000', '400', '600'), '바꾼 내용이 없어요.');
  assert.equal(hint('1000', '300', '600'), '100원을 더 나눠야 저장할 수 있어요.');
  assert.equal(hint('1000', '500', '600'), '총 금액보다 100원 많아요. 줄여 주세요.');
  assert.equal(hint('abc', '400', '600'), '총 금액은 원 단위 숫자만 입력할 수 있어요.');
  assert.equal(hint('', '400', '600'), '총 금액은 원 단위 숫자만 입력할 수 있어요.');
  assert.equal(hint('0', '0', '0'), '총 금액은 1원 이상이어야 해요.');
  assert.equal(hint('1000', '1.5', '600'), '금액은 원 단위 숫자만 입력할 수 있어요.');
  assert.equal(hint('1000', '500', '500'), '합계가 딱 맞아요. 저장할 수 있어요.');

  const moved = state('1000', '500', '500');
  assert.equal(moved.ok, true, '총 금액은 그대로, 배분만 변경');
  assert.deepEqual(moved.allocations, { a: 500, b: 500 });
  assert.equal(state('2000', '1400', '600').ok, true, '총 금액 변경');
  assert.equal(state('1000', '1000', '').ok, true, '빈칸은 0원');
  assert.equal(state('1000', '1000', '').allocations.b, 0);
  assert.equal(state('1', '1', '0').ok, true, '1원이면 저장 가능');
  assert.equal(state('0', '0', '0').ok, false, '0원은 저장 불가');
  assert.equal(state('1000', '1000', '0.5').ok, false);
});

test('applyMonthEdit', { skip: !has('applyMonthEdit') }, () => {
  const data = q({ months: { '2026-11': { baseAmount: 900, carryIn: 300, deduction: 200, total: 1000, allocations: { a: 1000 }, settled: true } } });
  const month = call(`(() => { const d = ${data}; applyMonthEdit(d, '2026-11', 800, { a: 500, b: 300 }); return d.months['2026-11']; })()`);
  assert.equal(month.total, 800);
  assert.deepEqual(month.allocations, { a: 500, b: 300 });
  assert.equal(month.carryIn, 300, '이월은 그대로');
  assert.equal(month.deduction, 200, '차감은 그대로');
  assert.equal(month.baseAmount, 700);
  assert.equal(month.baseAmount + month.carryIn - month.deduction, month.total, '공식 유지');
  assert.equal(month.settled, true);
});

test('분류 표시', { skip: !has('categoryName') }, () => {
  const data = q({ categories: [{ id: 'a', name: '식비', hidden: false }, { id: 'b', name: '의류', hidden: true }] });
  assert.deepEqual(call(`visibleCategories(${data}).map((c) => c.id)`), ['a']);
  assert.equal(call(`categoryName(${data}, 'b')`), '의류', '숨긴 분류도 이름은 남음');
  assert.equal(call(`categoryName(${data}, 'zzz')`), '삭제된 분류');
});

// ---- 서버 저장 ----

const sampleData = {
  categories: [{ id: 'c1', name: '식비', hidden: false }, { id: 'c2', name: '의류', hidden: true }],
  months: {
    '2026-11': { baseAmount: 1000, carryIn: 100, deduction: 50, total: 1050, allocations: { c1: 1050 }, settled: true, skipped: false },
    '2026-10': { baseAmount: 0, carryIn: 0, deduction: 0, total: null, allocations: {}, settled: false, skipped: true },
  },
  expenses: [{ id: 'e1', date: '2026-11-14', categoryId: 'c1', amount: 900, memo: '점심' }],
  piggy: { balance: 500, history: [{ id: 'p1', date: '2026-11-01', type: 'save', amount: 500, memo: '10월 남은 돈 저축' }] },
  unsettled: [{ month: '2026-09', amount: 70 }],
};
const toRows = (data) => call(`dataToRows(${q(data)})`);
const diff = (before, after) => call(`diffRows(${q(toRows(before))}, ${q(toRows(after))})`);

test('행 변환: 앱 데이터와 DB 행이 서로 맞다', { skip: !has('dataToRows') }, () => {
  const rows = toRows(sampleData);
  assert.deepEqual(rows.expenses[0], { id: 'e1', date: '2026-11-14', category_id: 'c1', amount: 900, memo: '점심' });
  assert.equal(rows.months[0].base_amount, 1000);
  assert.equal(rows.months[1].total, null, '건너뛴 달은 총 금액이 비어 있음');
  assert.equal(rows.piggy_balance, 500);
  const { piggy_balance: balance, ...rest } = rows;
  const back = call(`rowsToData(${q({ ...rest, piggy: [{ user_id: 'u', balance }] })})`);
  assert.deepEqual(back, sampleData);
  assert.equal(toRows({ ...sampleData, months: { '2026-11': { ...sampleData.months['2026-11'], skipped: undefined } } }).months[0].skipped, false, '정산으로 만든 달은 skipped가 없어도 false');
});

test('rowsToData는 만든 순서대로 정렬한다', { skip: !has('rowsToData') }, () => {
  const { piggy_balance: balance, ...rest } = toRows({ ...sampleData, categories: [{ id: 'c2', name: '둘', hidden: false }, { id: 'c1', name: '하나', hidden: false }] });
  const data = call(`rowsToData(${q({ ...rest, piggy: [{ balance }] })})`);
  assert.deepEqual(data.categories.map((c) => c.name), ['하나', '둘']);
});

test('diffRows는 바뀐 행만 고른다', { skip: !has('diffRows') }, () => {
  assert.deepEqual(diff(sampleData, sampleData), {}, '바뀐 게 없으면 보낼 것도 없음');

  const added = { ...sampleData, expenses: [...sampleData.expenses, { id: 'e2', date: '2026-11-14', categoryId: 'c2', amount: 1, memo: '' }] };
  assert.deepEqual(diff(sampleData, added), { expenses: [{ id: 'e2', date: '2026-11-14', category_id: 'c2', amount: 1, memo: '' }] });

  const edited = { ...sampleData, expenses: [{ ...sampleData.expenses[0], amount: 800 }] };
  assert.deepEqual(diff(sampleData, edited).expenses.map((e) => e.amount), [800]);

  assert.deepEqual(diff(sampleData, { ...sampleData, expenses: [] }), { deleted_expenses: ['e1'] });
  assert.deepEqual(diff(sampleData, { ...sampleData, categories: [sampleData.categories[0]] }), { deleted_categories: ['c2'] });

  const settled = {
    ...sampleData,
    months: { ...sampleData.months, '2026-12': { baseAmount: 1, carryIn: 0, deduction: 0, total: 1, allocations: {}, settled: true } },
    piggy: { balance: 400, history: [...sampleData.piggy.history, { id: 'p2', date: '2026-12-01', type: 'deficit', amount: 100, memo: '' }] },
    unsettled: [...sampleData.unsettled, { month: '2026-11', amount: 5 }],
  };
  const changes = diff(sampleData, settled);
  assert.deepEqual(Object.keys(changes).sort(), ['months', 'piggy_balance', 'piggy_history', 'unsettled'], '정산은 한 번에 함께 저장');
  assert.equal(changes.piggy_balance, 400);
  assert.deepEqual(changes.months.map((m) => m.month), ['2026-12']);

  const zero = call(`diffRows(emptyRows(), dataToRows(createEmptyData()))`);
  assert.equal(zero.piggy_balance, 0, '새 계정은 저금통 0원도 저장');
  assert.equal(zero.categories.length, 5);
});

test('fetchAll은 1000행이 넘어도 전부 읽는다', { skip: !has('fetchAll') }, async () => {
  const t = load();
  vm.runInContext(`
    var calls = [];
    client = { from: () => ({ select: () => ({ order: () => ({
      range: async (first, last) => {
        calls.push([first, last]);
        const all = Array.from({ length: 2500 }, (_, id) => ({ id }));
        return { data: all.slice(first, last + 1), error: null };
      },
    }) }) }) };
  `, t.ctx);
  const rows = await vm.runInContext(`fetchAll('expenses', 'id')`, t.ctx);
  assert.equal(rows.length, 2500);
  assert.equal(rows[2499].id, 2499);
  assert.equal(t.call('calls').length, 3);
});

test('loadData 상태 구분', { skip: !has('loadData') }, async () => {
  const withClient = (rowsOf) => {
    const t = load();
    t.ctx.rowsOf = rowsOf;
    vm.runInContext(`client = { from: (table) => ({ select: () => ({ order: () => ({ range: async () => rowsOf(table) }) }) }) };`, t.ctx);
    return vm.runInContext(`loadData()`, t.ctx);
  };
  const noRows = { data: [], error: null };
  assert.equal((await withClient(() => noRows)).status, 'empty', '저금통 행이 없으면 새 계정');

  const { piggy_balance: balance, ...rest } = toRows(sampleData);
  const tables = { ...rest, piggy: [{ user_id: 'u', balance }] };
  const ok = await withClient((table) => ({ data: tables[table], error: null }));
  assert.equal(ok.status, 'ok');
  assert.deepEqual(JSON.parse(JSON.stringify(ok.data)), sampleData);

  const failed = await withClient((table) => (table === 'expenses' ? { data: null, error: { message: 'x' } } : noRows));
  assert.equal(failed.status, 'failed', '한 테이블이라도 못 읽으면 실패 (빈 계정으로 착각하지 않음)');
  assert.equal(failed.data, undefined);
  assert.equal((await vm.runInContext(`client = null; loadData()`, load().ctx)).status, 'failed', '라이브러리를 못 불러온 경우');
});

test('saveData는 실패를 false로 알린다', { skip: !has('saveData') }, async () => {
  const run = (code) => {
    const t = load();
    vm.runInContext(code, t.ctx);
    return vm.runInContext(`saveData({ months: [] })`, t.ctx);
  };
  assert.equal(await run(`client = { rpc: async () => ({ error: null }) };`), true);
  assert.equal(await run(`client = { rpc: async () => ({ error: { message: 'x' } }) };`), false);
  assert.equal(await run(`client = { rpc: async () => { throw new Error('Failed to fetch'); } };`), false);
});

test('flushSaves: 순서대로 하나씩 보내고 실패분은 다시 보낸다', { skip: !has('flushSaves') }, async () => {
  const t = load();
  vm.runInContext(`
    var banner = { hidden: true };
    var document = { getElementById: () => banner };
    var sent = [];
    var active = 0;
    var overlap = false;
    var failNext = false;
    client = { rpc: async (name, { changes }) => {
      if (active > 0) overlap = true;
      active += 1;
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
      if (failNext) { failNext = false; return { error: { message: 'x' } }; }
      sent.push(name === 'save_changes' ? changes : null);
      return { error: null };
    } };
  `, t.ctx);
  t.ctx.setTimeout = setTimeout;
  vm.runInContext(`state = createEmptyData(); synced = dataToRows(state);`, t.ctx);

  await vm.runInContext(`flushSaves()`, t.ctx);
  assert.equal(t.call('sent').length, 0, '바뀐 게 없으면 서버를 부르지 않음');

  const done = vm.runInContext(`state.piggy.balance = 1; flushSaves(); state.piggy.balance = 2; flushSaves(); state.piggy.balance = 3; flushSaves();`, t.ctx);
  await done;
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(t.call('overlap'), false, '동시에 보내지 않음');
  assert.deepEqual(t.call('sent').map((c) => c.piggy_balance), [1, 3], '중간 값은 묶고 마지막 값이 마지막에 도착');

  await vm.runInContext(`failNext = true; state.piggy.balance = 4; flushSaves()`, t.ctx);
  assert.equal(t.call('banner.hidden'), false, '실패하면 안내');
  assert.equal(t.call('synced.piggy_balance'), 3, '실패한 변경은 저장된 것으로 치지 않음');
  await vm.runInContext(`flushSaves()`, t.ctx);
  assert.equal(t.call('banner.hidden'), true, '성공하면 안내 사라짐');
  assert.equal(t.call('sent').at(-1).piggy_balance, 4, '실패분을 다시 보냄');
});

test('fetchKeepingSaves: 저장 요청만 창을 닫아도 끝까지 보낸다', { skip: !has('fetchKeepingSaves') }, async () => {
  const t = load();
  vm.runInContext(`var seen = []; var fetch = async (url, init) => { seen.push(init.keepalive); return init; };`, t.ctx);
  const send = (url, size) => vm.runInContext(`fetchKeepingSaves(${q(url)}, { method: 'POST', body: 'x'.repeat(${size}) })`, t.ctx);
  await send('https://x.supabase.co/rest/v1/rpc/save_changes', 10);
  await send('https://x.supabase.co/rest/v1/rpc/save_changes', 70000);
  await send('https://x.supabase.co/rest/v1/expenses', 10);
  await vm.runInContext(`fetchKeepingSaves('https://x.supabase.co/rest/v1/months')`, t.ctx);
  assert.deepEqual(t.call('seen'), [true, false, false, false], '64KB를 넘으면 keepalive 없이 보내야 실패하지 않음');
});
