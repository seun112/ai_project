// 화면 틀, 정산 창, 저장 시나리오
const visible = `[...document.querySelectorAll('[data-panel]')].filter((p) => !p.hidden).map((p) => p.dataset.panel).join()`;
const overflow = `document.documentElement.scrollWidth > document.documentElement.clientWidth`;
const isHidden = (id) => `document.getElementById('${id}').hidden`;
const raw = `localStorage.getItem('living-budget')`;
const setRaw = (value) => `localStorage.setItem('living-budget', ${JSON.stringify(value)})`;
const type = (id, value) => `(() => { const el = document.getElementById('${id}'); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('input', { bubbles: true })); })()`;
const text = (id) => `document.getElementById('${id}').textContent`;
const next = `document.getElementById('settle-next').click()`;
const back = `document.getElementById('settle-back').click()`;
const nextDisabled = `document.getElementById('settle-next').disabled`;
const nextLabel = text('settle-next');
const onStep = (n) => `!document.querySelector('[data-step="${n}"]').hidden`;
const alloc = (i, value) => `(() => { const el = document.querySelectorAll('[data-alloc]')[${i}]; el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('input', { bubbles: true })); })()`;
const allocAttr = (i, name) => `document.querySelectorAll('[data-alloc]')[${i}].getAttribute('${name}')`;
const enter = (selector) => `!document.querySelector('${selector}').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))`;

// 이번 달을 정산 완료 상태로 만들어 정산 창 없이 앱에 들어간다.
const seedSettled = `(() => {
  const data = JSON.parse(localStorage.getItem('living-budget'));
  const allocations = Object.fromEntries(data.categories.map((c) => [c.id, 200000]));
  data.months[monthKeyOf(getToday())] = { baseAmount: 1000000, carryIn: 0, deduction: 0, total: 1000000, allocations, settled: true };
  localStorage.setItem('living-budget', JSON.stringify(data));
})()`;

export default async function ({ evaluate, reload, size, shot, check, setToday }) {
  // 첫 접속: 앱 위에 정산 창이 뜬다
  const appBlocked = `!document.getElementById('app').hidden && document.getElementById('app').inert`;
  check('첫 실행: 정산 창 표시', !(await evaluate(isHidden('overlay'))));
  check('첫 실행: 뒤의 앱은 조작 불가', await evaluate(appBlocked));
  check('닫기 버튼 없음', (await evaluate(`[...document.querySelectorAll('#overlay button')].filter((b) => /닫기|취소/.test(b.textContent) && !b.hidden).length`)) === 0);
  check('Esc로 닫히지 않음', (await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); document.getElementById('overlay').hidden`)) === false);
  check('1 / 2 단계 표시', (await evaluate(text('settle-step'))) === '1 / 2 단계');
  check('이번 달 첫 정산 표시', /^\d{1,2}월 첫 정산$/.test(await evaluate(text('settle-label'))));
  check('1단계에 이전 버튼 없음', await evaluate(isHidden('settle-back')));
  check('처음 쓰는 달: 안내 표시', (await evaluate(text('first-notice'))) === '처음 쓰는 달이라 지난달 결과가 없어요. 이번 달에 쓸 돈만 정하면 돼요.' && !(await evaluate(isHidden('first-notice'))));
  check('처음 쓰는 달: 지난달 처리 없음', (await evaluate(isHidden('left-result'))) && (await evaluate(isHidden('over-result'))));
  console.log('shot', await shot('settle-first'));

  // 총 금액
  check('금액 칸에 포커스', (await evaluate(`document.activeElement.id`)) === 'base-amount');
  check('빈칸: 문구 없이 다음 비활성', (await evaluate(nextDisabled)) && (await evaluate(isHidden('settle-error'))));
  for (const [value, label, message] of [
    ['1.5', '소수점', '기본 금액은 원 단위 숫자만 입력할 수 있어요.'],
    ['-100', '음수', '기본 금액은 원 단위 숫자만 입력할 수 있어요.'],
    ['abc', '문자', '기본 금액은 원 단위 숫자만 입력할 수 있어요.'],
    ['0', '0원', '이번 달 총 금액은 1원 이상이어야 해요.'],
  ]) {
    await evaluate(type('base-amount', value));
    check(`${label}: 다음 비활성`, await evaluate(nextDisabled));
    check(`${label}: 안내 표시`, (await evaluate(text('settle-error'))) === message, await evaluate(text('settle-error')));
  }
  await evaluate(type('base-amount', 'abc'));
  check('잘못된 칸 표시', (await evaluate(`document.getElementById('base-amount').getAttribute('aria-invalid')`)) === 'true');
  console.log('shot', await shot('settle-total-error'));
  await evaluate(type('base-amount', '1,000,000'));
  check('입력하면 안내가 사라짐', await evaluate(isHidden('settle-error')));
  check('입력하면 총 금액이 바로 갱신', (await evaluate(text('calc-total'))) === '1,000,000원');
  check('이월·차감 표시', (await evaluate(text('calc-carry'))) === '+ 0원' && (await evaluate(text('calc-deduction'))) === '- 0원');
  console.log('shot', await shot('settle-total'));
  await evaluate(next);
  check('올바른 금액이면 2단계로 이동', await evaluate(onStep(2)));
  check('2 / 2 단계 표시', (await evaluate(text('settle-step'))) === '2 / 2 단계');
  check('2단계 제목', (await evaluate(text('settle-title'))) === '분류별로 나눠 주세요');
  await evaluate(back);
  check('돌아와도 입력값 유지', (await evaluate(`document.getElementById('base-amount').value`)) === '1,000,000');

  // 분류별 배분 단계
  await evaluate(next);
  check('배분: 분류 5개 입력칸', (await evaluate(`document.querySelectorAll('[data-alloc]').length`)) === 5);
  check('배분: 첫 칸에 포커스', await evaluate(`document.activeElement === document.querySelector('[data-alloc]')`));
  check('배분: 총 금액 표시', (await evaluate(text('alloc-total'))) === '1,000,000원');
  check('배분: 처음에는 전액 미배분', (await evaluate(text('alloc-sum'))) === '0원' && (await evaluate(text('alloc-left'))) === '1,000,000원');
  await evaluate(alloc(0, '400,000'));
  check('입력하면 합계와 미배분이 바로 바뀜', (await evaluate(text('alloc-sum'))) === '400,000원' && (await evaluate(text('alloc-left'))) === '600,000원');
  await evaluate(alloc(1, '700000'));
  check('초과 배분은 -와 빨간색', (await evaluate(text('alloc-left'))) === '-100,000원' && (await evaluate(`document.getElementById('alloc-left').classList.contains('neg-text')`)));
  console.log('shot', await shot('allocate-over'));
  await evaluate(alloc(1, '1.5'));
  check('잘못된 금액: 칸 표시와 안내', (await evaluate(allocAttr(1, 'aria-invalid'))) === 'true' && !(await evaluate(isHidden('alloc-hint'))), await evaluate(text('alloc-hint')));
  await evaluate(alloc(1, ''));
  check('빈칸은 0원: 오류 없음', (await evaluate(allocAttr(1, 'aria-invalid'))) === null && (await evaluate(isHidden('alloc-hint'))) && (await evaluate(text('alloc-sum'))) === '400,000원');
  await evaluate(back);
  await evaluate(next);
  check('이전으로 갔다 와도 배분 입력 유지', (await evaluate(`document.querySelectorAll('[data-alloc]')[0].value`)) === '400,000');
  await evaluate(back);

  await evaluate(seedSettled);
  await reload();
  check('정산 완료 후 창 없이 앱 표시', (await evaluate(isHidden('overlay'))) && !(await evaluate(`document.getElementById('app').inert`)));
  check('처음 화면은 대시보드', (await evaluate(visible)) === 'dashboard');
  check('탭 오른쪽에 오늘 날짜', /^\d{4}년 \d{1,2}월 \d{1,2}일 \([월화수목금토일]\)$/.test(await evaluate(text('today-label'))));
  check('탭은 대시보드, 달력, 설정 세 개', (await evaluate(`[...document.querySelectorAll('.tab')].map((t) => t.textContent).join()`)) === '대시보드,달력,설정');
  for (const name of ['calendar', 'settings', 'dashboard']) {
    await evaluate(`document.querySelector('[data-view="${name}"]').click()`);
    check(`${name} 탭 전환`, (await evaluate(visible)) === name);
    check(`${name} 탭 현재 표시`, (await evaluate(`document.querySelector('[aria-current="page"]').dataset.view`)) === name);
  }

  // 디자인 토큰
  check('바탕색은 목업과 같음', (await evaluate(`getComputedStyle(document.body).backgroundColor`)) === 'rgb(217, 240, 188)');
  check('글꼴 지정', (await evaluate(`getComputedStyle(document.body).fontFamily`)).includes('Gowun Dodum'));

  // 저장과 새로고침
  const first = await evaluate(raw);
  check('기본 분류가 저장되어 있음', first !== null && JSON.parse(first).categories.length === 5);
  await reload();
  check('새로고침 후 분류 id 유지', (await evaluate(raw)) === first);
  await evaluate(`const d = JSON.parse(${raw}); d.piggy.balance = 1234; localStorage.setItem('living-budget', JSON.stringify(d));`);
  await reload();
  check('저장한 값이 새로고침 후 유지', (await evaluate(`state.piggy.balance`)) === 1234);

  console.log('shot', await shot('desktop'));
  check('데스크톱 가로 넘침 없음', !(await evaluate(overflow)));
  await size(400, 800);
  check('400px 가로 넘침 없음', !(await evaluate(overflow)));
  console.log('shot', await shot('narrow'));

  // 손상 데이터
  for (const [label, value] of [['깨진 JSON', '{broken'], ['다른 버전', JSON.stringify({ version: 99 })]]) {
    await evaluate(setRaw(value));
    await reload();
    check(`${label}: 복구 화면 표시`, !(await evaluate(isHidden('recovery'))) && (await evaluate(isHidden('app'))) && (await evaluate(isHidden('overlay'))));
    check(`${label}: 원본 유지`, (await evaluate(raw)) === value);
  }
  console.log('shot', await shot('recovery'));
  check('복구 화면 400px 넘침 없음', !(await evaluate(overflow)));

  await evaluate(`document.getElementById('reset-start').click()`);
  check('초기화 첫 클릭은 확인만 표시', !(await evaluate(isHidden('reset-confirm'))));
  check('첫 클릭으로 데이터가 지워지지 않음', JSON.parse(await evaluate(raw)).version === 99);
  await evaluate(`document.getElementById('reset-cancel').click()`);
  check('취소하면 확인이 닫힘', await evaluate(isHidden('reset-confirm')));
  check('취소해도 데이터 유지', JSON.parse(await evaluate(raw)).version === 99);

  await evaluate(`document.getElementById('reset-start').click()`);
  console.log('shot', await shot('recovery-confirm'));
  await evaluate(`document.getElementById('reset-run').click()`);
  check('초기화 후 정산 창 표시', !(await evaluate(isHidden('overlay'))) && (await evaluate(isHidden('recovery'))));
  const after = JSON.parse(await evaluate(raw));
  check('초기화 후 빈 데이터 저장', after.version === 1 && after.categories.length === 5 && after.piggy.balance === 0);
  await reload();
  await reload();
  check('초기화 후 새로고침해도 정산 창 표시', !(await evaluate(isHidden('overlay'))));

  // 저장 실패 안내
  await evaluate(`Storage.prototype.setItem = () => { throw new Error('quota'); }; saveState();`);
  check('저장 실패 안내 표시', !(await evaluate(isHidden('save-error'))));
  console.log('shot', await shot('save-error'));
  await reload();
  await evaluate(`saveState();`);
  check('저장 성공하면 안내 사라짐', await evaluate(isHidden('save-error')));

  // 지난달 남은 돈 처리
  await size(1200, 800);
  const seedLastMonth = (spent, piggy = 0) => `(() => {
    const d = JSON.parse(localStorage.getItem('living-budget'));
    d.months['2026-10'] = { baseAmount: 1000000, carryIn: 0, deduction: 0, total: 1000000, allocations: {}, settled: true };
    d.expenses.push({ id: 'old', date: '2026-10-05', categoryId: d.categories[0].id, amount: ${spent}, memo: '' });
    d.piggy.balance = ${piggy};
    localStorage.setItem('living-budget', JSON.stringify(d));
  })()`;
  await setToday('2026-11-15');
  await evaluate(`localStorage.clear()`);
  await reload();
  await evaluate(seedLastMonth(880000));
  await reload();
  check('남은 돈: 결과 상자 표시', (await evaluate(text('left-label'))) === '10월 남은 돈' && (await evaluate(text('left-amount'))) === '+120,000원');
  check('남은 돈: 소제목', (await evaluate(text('left-title'))) === '남은 120,000원을 어떻게 할까요?');
  check('남은 돈: 저축 칸에 포커스', (await evaluate(`document.activeElement.id`)) === 'save-amount');
  await evaluate(type('base-amount', '1,000,000'));
  check('합이 안 맞으면 다음 비활성과 안내', (await evaluate(nextDisabled)) && (await evaluate(text('settle-error'))) === '저축과 이월을 더한 금액이 남은 120,000원과 같아야 해요.', await evaluate(text('settle-error')));
  await evaluate(type('save-amount', '70,000'));
  await evaluate(type('carry-amount', '1.5'));
  check('잘못된 금액: 칸 표시와 안내', (await evaluate(`document.getElementById('carry-amount').getAttribute('aria-invalid')`)) === 'true' && (await evaluate(text('settle-error'))) === '금액은 원 단위 숫자만 입력할 수 있어요.');
  await evaluate(type('carry-amount', '50,000'));
  check('합이 맞으면 다음 활성', !(await evaluate(nextDisabled)) && (await evaluate(isHidden('settle-error'))));
  check('이월이 총 금액에 반영', (await evaluate(text('calc-carry'))) === '+ 50,000원' && (await evaluate(text('calc-total'))) === '1,050,000원');
  console.log('shot', await shot('settle-leftover'));
  await size(320, 800);
  console.log('shot', await shot('settle-leftover-320'));
  check('남은 돈 320px 넘침 없음', (await evaluate(`document.getElementById('overlay').scrollWidth <= document.getElementById('overlay').clientWidth`)));
  await size(1200, 800);
  await evaluate(next);
  check('2단계 총 금액에 이월 반영', (await evaluate(text('alloc-total'))) === '1,050,000원');
  await evaluate(alloc(0, '1,050,000'));
  await evaluate(next);
  const leftoverMonth = JSON.parse(await evaluate(raw)).months['2026-11'];
  check('이월 저장', leftoverMonth.baseAmount === 1000000 && leftoverMonth.carryIn === 50000 && leftoverMonth.total === 1050000);
  const leftoverPiggy = JSON.parse(await evaluate(raw)).piggy;
  check('저축이 저금통과 내역에 기록', leftoverPiggy.balance === 70000 && leftoverPiggy.history.length === 1 && leftoverPiggy.history[0].type === 'save' && leftoverPiggy.history[0].amount === 70000);
  check('저축이 대시보드 저금통에 표시', (await evaluate(text('piggy-balance'))) === '70,000원');

  // 지난달 초과 처리
  const pick = (value) => `document.querySelector('input[name="over"][value="${value}"]').click()`;
  const optOn = (key) => `document.getElementById('opt-${key}').classList.contains('on')`;
  await evaluate(`localStorage.clear()`);
  await reload();
  await evaluate(seedLastMonth(1085000, 150000));
  await reload();
  check('초과: 결과 상자 표시', (await evaluate(text('over-label'))) === '10월 초과 지출' && (await evaluate(text('over-amount'))) === '-85,000원');
  check('초과: 초과 라벨도 표시', (await evaluate(`document.querySelector('#over-result .over-pill').textContent`)) === '초과');
  check('초과: 제목과 소제목', (await evaluate(text('settle-title'))) === '지난달 정리하고 이번 달 정해요' && (await evaluate(text('over-title'))) === '초과한 85,000원을 어떻게 할까요?');
  check('초과: 남은 돈 화면은 숨김', await evaluate(isHidden('left-choice')));
  check('초과: 첫 선택지가 기본', (await evaluate(optOn('next'))) && !(await evaluate(optOn('mix'))));
  check('초과: 저금통 입력은 닫혀 있음', await evaluate(isHidden('mix-more')));
  await evaluate(type('base-amount', '1,000,000'));
  check('다음 달 차감: 총 금액 반영', (await evaluate(text('calc-deduction'))) === '- 85,000원' && (await evaluate(text('calc-total'))) === '915,000원');
  await evaluate(pick('keep'));
  check('그냥 두기: 총 금액 영향 없음', (await evaluate(optOn('keep'))) && (await evaluate(text('calc-deduction'))) === '- 0원' && (await evaluate(text('calc-total'))) === '1,000,000원');
  await evaluate(pick('mix'));
  check('세 번째 선택: 저금통 입력이 열림', !(await evaluate(isHidden('mix-more'))) && (await evaluate(text('piggy-label'))) === '저금통에서 뺄 금액 (잔액 150,000원)');
  await evaluate(type('piggy-amount', '30,000'));
  check('저금통 차감: 나머지만 다음 달에서 차감', (await evaluate(text('calc-deduction'))) === '- 55,000원' && (await evaluate(text('calc-total'))) === '945,000원');
  console.log('shot', await shot('settle-over'));
  const dialogFits = `(() => {
    const overlay = document.getElementById('overlay');
    const box = document.querySelector('.dialog').getBoundingClientRect();
    return overlay.scrollWidth <= overlay.clientWidth && box.left >= 0 && box.right <= innerWidth;
  })()`;
  // 상자 안의 칩, 금액, 입력칸이 부모 밖으로 나가지 않고 칩이 한 줄로 유지되는지 본다.
  const contentFits = `(() => {
    const inside = (el, box) => {
      const a = el.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      return a.left >= b.left - 0.5 && a.right <= b.right + 0.5;
    };
    const dialog = document.querySelector('.dialog-in');
    const parts = [...document.querySelectorAll('#overlay .result .amt, #overlay .result .chip, #overlay .opt .field, #overlay .opt .unit span, #overlay .frow .unit')]
      .filter((el) => el.offsetParent !== null);
    const boxed = parts.every((el) => inside(el, el.closest('.result, .opt') ?? dialog));
    const oneLine = [...document.querySelectorAll('#overlay .chip')].filter((el) => el.offsetParent !== null).every((el) => el.getBoundingClientRect().height < 40);
    return boxed && oneLine;
  })()`;
  for (const width of [400, 320]) {
    await size(width, 800);
    check(`정산 창 ${width}px 넘침 없음`, await evaluate(dialogFits));
    check(`화면 ${width}px 넘침 없음`, !(await evaluate(overflow)));
    check(`정산 창 ${width}px 내용이 상자 안에 있음`, await evaluate(contentFits));
    console.log('shot', await shot(`settle-over-${width}`));
  }
  await size(1200, 800);
  await evaluate(type('piggy-amount', '90,000'));
  check('한도 초과: 다음 비활성과 안내', (await evaluate(nextDisabled)) && (await evaluate(text('mix-msg'))) === '85,000원까지만 뺄 수 있어요', await evaluate(text('mix-msg')));
  await evaluate(type('piggy-amount', 'abc'));
  check('잘못된 금액: 다음 비활성과 안내', (await evaluate(nextDisabled)) && (await evaluate(text('mix-msg'))) === '금액은 원 단위 숫자만 입력해요');
  await evaluate(type('piggy-amount', '30,000'));
  check('고치면 안내가 사라짐', !(await evaluate(nextDisabled)) && (await evaluate(text('mix-msg'))) === '');
  await evaluate(next);
  check('2단계 총 금액에 차감 반영', (await evaluate(text('alloc-total'))) === '945,000원');
  await evaluate(back);
  check('돌아와도 선택 유지', (await evaluate(optOn('mix'))) && (await evaluate(`document.getElementById('piggy-amount').value`)) === '30,000');
  await evaluate(next);
  await evaluate(alloc(0, '945,000'));
  await evaluate(next);
  const overMonth = JSON.parse(await evaluate(raw)).months['2026-11'];
  check('차감 저장', overMonth.baseAmount === 1000000 && overMonth.deduction === 55000 && overMonth.total === 945000);
  const overData = JSON.parse(await evaluate(raw));
  check('저금통 차감이 잔액과 내역에 기록', overData.piggy.balance === 120000 && overData.piggy.history.length === 1 && overData.piggy.history[0].type === 'deficit' && overData.piggy.history[0].amount === 30000);
  check('저금통 + 다음 달 차감 = 초과분', overData.piggy.history[0].amount + overMonth.deduction === 85000);
  check('저금통 차감이 대시보드에 표시', (await evaluate(text('piggy-balance'))) === '120,000원');

  // 초과 처리: 다음 달 차감과 그냥 두기
  for (const [option, deduction, unsettled] of [['next', 85000, 0], ['keep', 0, 85000]]) {
    await evaluate(`localStorage.clear()`);
    await reload();
    await evaluate(seedLastMonth(1085000, 150000));
    await reload();
    await evaluate(pick(option));
    await evaluate(type('base-amount', '1,000,000'));
    await evaluate(next);
    await evaluate(alloc(0, (1000000 - deduction).toLocaleString('ko-KR')));
    await evaluate(next);
    const d = JSON.parse(await evaluate(raw));
    check(`${option}: 총 금액과 차감`, d.months['2026-11'].deduction === deduction && d.months['2026-11'].total === 1000000 - deduction);
    check(`${option}: 저금통 그대로, 내역 없음`, d.piggy.balance === 150000 && d.piggy.history.length === 0);
    check(`${option}: 미정산 기록`, unsettled === 0 ? d.unsettled.length === 0 : d.unsettled[0].month === '2026-10' && d.unsettled[0].amount === unsettled);
  }
  check('미정산 금액은 화면에 표시하지 않음', !(await evaluate(`document.body.textContent`)).includes('미정산'));

  // 정산 도중 새로고침
  await evaluate(`localStorage.clear()`);
  await reload();
  await evaluate(seedLastMonth(880000, 500));
  await reload();
  await evaluate(type('save-amount', '120,000'));
  await evaluate(type('base-amount', '1,000,000'));
  await evaluate(next);
  await reload();
  check('도중 새로고침: 창이 처음부터 다시 뜸', (await evaluate(onStep(1))) && (await evaluate(`document.getElementById('base-amount').value`)) === '');
  check('도중 새로고침: 저금통 그대로', JSON.parse(await evaluate(raw)).piggy.balance === 500);

  // 지난달이 0원으로 딱 맞은 경우
  await evaluate(`localStorage.clear()`);
  await reload();
  await evaluate(seedLastMonth(1000000));
  await reload();
  check('0원: 처음 쓰는 달 문구 없음', await evaluate(isHidden('first-notice')));
  check('0원: 지난달 처리 없음', (await evaluate(isHidden('left-result'))) && (await evaluate(isHidden('left-choice'))) && (await evaluate(isHidden('over-result'))) && (await evaluate(isHidden('over-choice'))));
  check('0원: 제목 없음', await evaluate(isHidden('settle-title')));
  await evaluate(type('base-amount', '1,000,000'));
  check('0원: 총 금액만 정하고 다음 활성', !(await evaluate(nextDisabled)) && (await evaluate(text('calc-total'))) === '1,000,000원');
  console.log('shot', await shot('settle-even'));

  // 탭을 열어둔 채 달이 바뀐 경우
  await size(1200, 800);
  await setToday('2026-11-20');
  await reload();
  await evaluate(seedSettled);
  await reload();
  check('이번 달이 정산되어 있으면 창 없음', await evaluate(isHidden('overlay')));
  await evaluate(`getToday = () => '2026-12-01'; document.dispatchEvent(new Event('visibilitychange'));`);
  check('탭 복귀 시 달이 바뀌었으면 정산 창 표시', !(await evaluate(isHidden('overlay'))) && (await evaluate(appBlocked)));
  check('바뀐 달로 정산 표시', (await evaluate(text('settle-label'))) === '12월 첫 정산');
  await setToday(null);

  // 합계 검증과 저장
  await evaluate(`localStorage.clear()`);
  await reload();
  await evaluate(type('base-amount', '1,000,000'));
  check('1단계 버튼은 다음', (await evaluate(nextLabel)) === '다음');
  await evaluate(next);
  check('배분 단계 버튼은 저장하고 시작', (await evaluate(nextLabel)) === '저장하고 시작');
  check('아직 나누지 않았으면 저장 비활성', await evaluate(nextDisabled));
  await evaluate(back);
  check('이전으로 돌아가면 다음 버튼 활성', (await evaluate(nextLabel)) === '다음' && !(await evaluate(nextDisabled)));
  await evaluate(next);
  await evaluate(alloc(0, '600,000'));
  check('합계가 모자라면 저장 비활성', await evaluate(nextDisabled));
  await evaluate(alloc(1, '500,000'));
  check('합계가 넘치면 저장 비활성', await evaluate(nextDisabled));
  await evaluate(alloc(1, '400,000'));
  await evaluate(alloc(2, 'abc'));
  check('합이 맞아도 잘못된 칸이 있으면 저장 비활성', await evaluate(nextDisabled));
  await evaluate(`document.getElementById('settle-form').requestSubmit()`);
  check('저장 차단: 제출해도 기록되지 않음', Object.keys(JSON.parse(await evaluate(raw)).months).length === 0);
  await evaluate(alloc(2, ''));
  check('합계가 맞으면 저장 활성', !(await evaluate(nextDisabled)));
  check('금액 칸 Enter는 저장으로 이어지지 않음', await evaluate(enter('[data-alloc]')));
  check('삭제 버튼 Enter는 막지 않음', !(await evaluate(enter('[data-act="del-ask"]'))));
  await evaluate(next);
  check('저장 후 창이 닫힘', (await evaluate(isHidden('overlay'))) && !(await evaluate(`document.getElementById('app').inert`)));
  const saved = Object.values(JSON.parse(await evaluate(raw)).months);
  check('정산 기록 저장', saved.length === 1 && saved[0].settled === true && saved[0].total === 1000000 && saved[0].baseAmount === 1000000);
  check('배분 저장, 빈칸은 0원', Object.values(saved[0].allocations).join() === '600000,400000,0,0,0', Object.values(saved[0].allocations).join());
  await reload();
  check('새로고침해도 정산 창이 다시 뜨지 않음', await evaluate(isHidden('overlay')));

  // 분류 추가와 삭제
  await setToday('2026-11-15');
  await evaluate(`localStorage.clear()`);
  await reload();
  await evaluate(`(() => {
    const d = JSON.parse(localStorage.getItem('living-budget'));
    d.expenses.push({ id: 'e1', date: '2026-10-03', categoryId: d.categories[0].id, amount: 1000, memo: '' });
    localStorage.setItem('living-budget', JSON.stringify(d));
  })()`);
  await reload();
  await evaluate(type('base-amount', '100,000'));
  await evaluate(next);
  const rows = () => evaluate(`document.querySelectorAll('[data-alloc]').length`);
  const names = () => evaluate(`[...document.querySelectorAll('#alloc-rows label')].map((l) => l.textContent).join()`);
  const addCat = async (name) => {
    await evaluate(type('new-cat', name));
    await evaluate(`document.querySelector('[data-act="add-cat"]').click()`);
  };
  const removeCat = async (name) => {
    await evaluate(`document.querySelector('[aria-label="${name} 분류 삭제"]').click()`);
    await evaluate(`document.querySelector('[data-act="del-yes"]').click()`);
  };
  for (const [name, message] of [['', '분류 이름을 입력해 주세요.'], ['가나다라마바사아자차카', '분류 이름은 10자 이하로 입력해 주세요.'], ['식비', '이미 있는 분류예요.']]) {
    await addCat(name);
    check(`분류 이름 "${name}": 막히고 안내`, (await rows()) === 5 && (await evaluate(text('cat-error'))) === message, await evaluate(text('cat-error')));
  }
  await addCat('반려동물');
  check('분류 추가', (await rows()) === 6 && (await names()).endsWith('반려동물'));
  check('추가하면 안내와 입력값이 지워짐', (await evaluate(isHidden('cat-error'))) && (await evaluate(`document.getElementById('new-cat').value`)) === '');
  check('추가 후 이름 칸에 포커스', (await evaluate(`document.activeElement.id`)) === 'new-cat');
  await evaluate(type('new-cat', '여행'));
  check('이름 칸 Enter로 추가', await evaluate(enter('#new-cat')));
  check('Enter로 추가한 분류 표시', (await rows()) === 7);
  await addCat('<b>x</b>');
  check('분류 이름의 태그는 글자로 표시', await evaluate(`document.querySelector('#alloc-rows b') === null`));

  await evaluate(alloc(0, '100,000'));
  await evaluate(`document.querySelector('[aria-label="식비 분류 삭제"]').click()`);
  check('삭제 전 확인 표시', (await evaluate(`document.querySelector('.confirm span').textContent`)) === '식비 분류를 삭제할까요? 이번 달부터 목록에서 빠져요.');
  check('확인 줄의 취소에 포커스', (await evaluate(`document.activeElement.dataset.act`)) === 'del-no');
  console.log('shot', await shot('allocate-confirm'));
  await evaluate(`document.querySelector('[data-act="del-no"]').click()`);
  check('취소하면 분류와 금액 유지', (await rows()) === 8 && (await evaluate(`document.querySelectorAll('[data-alloc]')[0].value`)) === '100,000');
  await size(400, 800);
  check('배분 단계 400px 넘침 없음', !(await evaluate(overflow)));
  console.log('shot', await shot('allocate-narrow'));
  await size(1200, 800);

  await removeCat('식비');
  check('삭제하면 금액도 합계에서 빠짐', (await rows()) === 7 && (await evaluate(text('alloc-sum'))) === '0원');
  await removeCat('의류');
  await removeCat('교통');
  await removeCat('기타');
  await removeCat('여행');
  await removeCat('반려동물');
  await removeCat('<b>x</b>');
  check('한 개 남으면 삭제 버튼 비활성', (await rows()) === 1 && (await evaluate(`document.querySelector('[data-act="del-ask"]').disabled`)));
  await evaluate(alloc(0, '100,000'));
  await evaluate(next);
  check('분류를 바꿔도 저장 후 창이 닫힘', await evaluate(isHidden('overlay')));
  const cats = JSON.parse(await evaluate(raw)).categories;
  check('지출 있는 분류는 숨김, 없는 분류는 삭제', cats.map((c) => `${c.name}:${c.hidden}`).join() === '식비:true,취미:false', cats.map((c) => `${c.name}:${c.hidden}`).join());
  const month = JSON.parse(await evaluate(raw)).months['2026-11'];
  check('배분은 남은 분류만 저장', Object.values(month.allocations).join() === '100000' && Object.keys(month.allocations)[0] === cats[1].id);

  await setToday('2026-12-02');
  await reload();
  await evaluate(type('save-amount', '100,000'));
  await evaluate(type('base-amount', '100,000'));
  await evaluate(next);
  check('다음 달 정산에 숨긴 분류가 나오지 않음', (await names()) === '취미', await names());

  // 대시보드: 지출 입력과 오늘 내역
  await setToday('2026-11-14');
  await evaluate(`localStorage.clear()`);
  await reload();
  await evaluate(type('base-amount', '1,000,000'));
  await evaluate(next);
  await evaluate(alloc(0, '400,000'));
  await evaluate(alloc(1, '600,000'));
  await evaluate(next);
  const expenses = async () => JSON.parse(await evaluate(raw)).expenses;
  const enterExpense = async (amount, memo = '') => {
    await evaluate(type('in-amt', amount));
    await evaluate(type('in-memo', memo));
    await evaluate(`document.querySelector('[data-act="add-expense"]').click()`);
  };
  const lines = () => evaluate(`[...document.querySelectorAll('[aria-label="오늘 쓴 내역"] .line')].map((l) => l.textContent).join('|')`);
  check('정산 후 대시보드 표시', (await evaluate(text('today-spent'))) === '0원');
  check('빈 내역 안내', (await evaluate(`document.querySelector('[aria-label="오늘 쓴 내역"]').textContent`)) === '오늘 쓴 돈이 아직 없어요.');
  check('분류 칩 5개, 첫 분류 선택', (await evaluate(`document.querySelectorAll('[data-act="pick-category"]').length`)) === 5 && (await evaluate(`document.querySelector('[aria-pressed="true"]').textContent`)) === '식비');
  for (const [amount, message] of [['', '금액은 원 단위 숫자만 입력할 수 있어요.'], ['1.5', '금액은 원 단위 숫자만 입력할 수 있어요.'], ['0', '1원 이상 입력해 주세요.']]) {
    await enterExpense(amount);
    check(`금액 "${amount}": 막히고 안내`, (await evaluate(text('in-err'))) === message && (await expenses()).length === 0);
    check(`금액 "${amount}": 칸 표시`, (await evaluate(`document.getElementById('in-amt').getAttribute('aria-invalid')`)) === 'true');
  }
  await enterExpense('9,000', '점심 김치찌개');
  check('지출 추가: 오늘 날짜로 기록', (await expenses())[0].date === '2026-11-14' && (await expenses())[0].amount === 9000 && (await expenses())[0].memo === '점심 김치찌개');
  check('추가하면 오늘 쓴 돈과 내역이 바뀜', (await evaluate(text('today-spent'))) === '9,000원' && (await lines()) === '식비점심 김치찌개9,000원');
  check('추가하면 입력칸이 비고 포커스 유지', (await evaluate(`document.getElementById('in-amt').value`)) === '' && (await evaluate(`document.activeElement.id`)) === 'in-amt');
  check('오류 안내가 사라짐', await evaluate(isHidden('in-err')));
  await evaluate(`document.querySelectorAll('[data-act="pick-category"]')[1].click()`);
  await evaluate(type('in-amt', '4,500'));
  check('Enter로 추가', await evaluate(enter('#in-amt')));
  check('고른 분류로 기록, 메모 없음 표시', (await lines()).endsWith('의류메모 없음4,500원'), await lines());
  check('오늘 쓴 돈 합계', (await evaluate(text('today-spent'))) === '13,500원');
  await evaluate(type('in-amt', '777'));
  await evaluate(`document.querySelectorAll('[data-act="pick-category"]')[2].click()`);
  check('분류를 바꿔도 입력 중인 금액 유지', (await evaluate(`document.getElementById('in-amt').value`)) === '777');
  await evaluate(type('in-amt', ''));
  await evaluate(`document.querySelector('[data-act="delete-expense"]').click()`);
  check('내역 삭제: 오늘 쓴 돈이 바로 바뀜', (await evaluate(text('today-spent'))) === '4,500원' && (await expenses()).length === 1);
  await reload();
  check('새로고침해도 지출 유지', (await evaluate(text('today-spent'))) === '4,500원');
  await enterExpense('12345', '<b>메모</b>');
  check('메모의 태그는 글자로 표시', await evaluate(`document.querySelector('[data-panel="dashboard"] .line b') === null`));

  // 대시보드: 이번 달 남은 돈, 저금통, 분류별 남은 돈
  const meta = `document.querySelector('.remain .meta').textContent`;
  const catRow = (i) => `document.querySelectorAll('.cat-row')[${i}].textContent.replace(/\\s+/g, ' ').trim()`;
  const barWidth = (selector) => `document.querySelector('${selector} .bar > i').style.width`;
  check('남은 돈 표시', (await evaluate(text('month-remain'))) === '983,155원', await evaluate(text('month-remain')));
  check('사용 비율 표시', (await evaluate(meta)).replace(/\s+/g, ' ').includes('총 1,000,000원 중 16,845원 사용') && (await evaluate(meta)).includes('2% 썼어요'), await evaluate(meta));
  check('저금통 잔액 표시, 버튼 없음', (await evaluate(text('piggy-balance'))) === '0원' && (await evaluate(`document.querySelector('.piggy-row button') === null`)));
  check('분류별 줄은 표시 분류 수만큼', (await evaluate(`document.querySelectorAll('.cat-row').length`)) === 5);
  check('분류 남은 금액과 배분·사용', (await evaluate(catRow(0))) === '식비387,655원 배분 400,000원 · 사용 12,345원', await evaluate(catRow(0)));
  check('분류 막대 비율', (await evaluate(barWidth('.cat-row'))) === '3%', await evaluate(barWidth('.cat-row')));
  console.log('shot', await shot('dashboard'));

  await evaluate(`document.querySelectorAll('[data-act="pick-category"]')[0].click()`);
  await enterExpense('500,000', '큰 지출');
  check('분류 초과: -와 초과 라벨', (await evaluate(catRow(0))) === '식비 초과-112,345원 배분 400,000원 · 사용 512,345원', await evaluate(catRow(0)));
  check('분류 초과: 빨간색과 막대', await evaluate(`document.querySelector('.cat-row strong').classList.contains('neg-text') && document.querySelector('.cat-row .bar').classList.contains('over')`));
  check('분류 초과: 막대는 100%까지', (await evaluate(barWidth('.cat-row'))) === '100%');
  check('분류 초과분만큼 남은 돈 감소', (await evaluate(text('month-remain'))) === '483,155원');
  check('초과하지 않은 분류는 그대로', !(await evaluate(catRow(1))).includes('초과'));
  await evaluate(`document.querySelectorAll('[data-act="pick-category"]')[1].click()`);
  await enterExpense('600,000');
  check('총액 초과: -와 빨간색', (await evaluate(text('month-remain'))) === '-116,845원' && (await evaluate(`document.getElementById('month-remain').classList.contains('neg')`)));
  check('총액 초과: 막대 빨간색, 100%', (await evaluate(`document.querySelector('.remain .bar').classList.contains('over')`)) && (await evaluate(barWidth('.remain'))) === '100%' && (await evaluate(meta)).includes('100% 썼어요'));
  console.log('shot', await shot('dashboard-over'));
  await size(400, 800);
  check('대시보드 400px 넘침 없음', !(await evaluate(overflow)));
  console.log('shot', await shot('dashboard-400'));
  await size(1200, 800);
  await evaluate(`(() => { const d = JSON.parse(localStorage.getItem('living-budget')); d.piggy.balance = 150000; localStorage.setItem('living-budget', JSON.stringify(d)); })()`);
  await reload();
  check('저금통 잔액은 저장된 값', (await evaluate(text('piggy-balance'))) === '150,000원');

  // 이번 달 지출만 합산, 지난달 기록 잠금
  const remainBefore = await evaluate(text('month-remain'));
  await evaluate(`(() => {
    const d = JSON.parse(localStorage.getItem('living-budget'));
    d.expenses.push({ id: 'last', date: '2026-10-20', categoryId: d.categories[0].id, amount: 999, memo: '지난달' });
    localStorage.setItem('living-budget', JSON.stringify(d));
  })()`);
  await reload();
  check('지난달 지출은 합산하지 않음', (await evaluate(text('month-remain'))) === remainBefore);
  check('지난달 지출은 오늘 내역에 없음', !(await lines()).includes('지난달'));
  check('지난달 지출은 삭제되지 않음', (await evaluate(`deleteExpense(state, 'last')`)) === false && (await expenses()).some((e) => e.id === 'last'));
  check('지난달 날짜로 추가되지 않음', (await evaluate(`addExpense(state, { date: '2026-10-20', categoryId: 'x', amount: 1, memo: '' })`)) === false);
  check('미래 날짜로 추가되지 않음', (await evaluate(`addExpense(state, { date: '2026-11-15', categoryId: 'x', amount: 1, memo: '' })`)) === false);

  const countBefore = (await expenses()).length;
  await evaluate(`getToday = () => '2026-12-01'`);
  await evaluate(type('in-amt', '1,000'));
  await evaluate(`document.querySelector('[data-act="add-expense"]').click()`);
  check('열어둔 채 달이 바뀌면 입력 대신 정산 창', !(await evaluate(isHidden('overlay'))) && (await evaluate(appBlocked)));
  check('달이 바뀐 뒤 입력은 기록되지 않음', (await expenses()).length === countBefore);

  // 달력 보기
  await setToday('2026-11-14');
  await evaluate(`localStorage.clear()`);
  await reload();
  await evaluate(type('base-amount', '1,000,000'));
  await evaluate(next);
  await evaluate(alloc(0, '1,000,000'));
  await evaluate(next);
  await evaluate(`(() => {
    const d = JSON.parse(localStorage.getItem('living-budget'));
    const [food, cloth] = d.categories;
    d.months['2026-10'] = { baseAmount: 900000, carryIn: 0, deduction: 0, total: 900000, allocations: {}, settled: true };
    d.expenses.push(
      { id: 'n1', date: '2026-11-03', categoryId: food.id, amount: 100000, memo: '장보기' },
      { id: 'n2', date: '2026-11-03', categoryId: cloth.id, amount: 36500, memo: '' },
      { id: 'n3', date: '2026-11-14', categoryId: food.id, amount: 9000, memo: '점심' },
      { id: 'o1', date: '2026-10-20', categoryId: food.id, amount: 70000, memo: '모임' },
    );
    localStorage.setItem('living-budget', JSON.stringify(d));
  })()`);
  await reload();
  const openTab = (name) => `document.querySelector('[data-view="${name}"]').click()`;
  const dayBtn = (date) => `document.querySelector('[data-date="${date}"]')`;
  const dayText = (date) => `${dayBtn(date)}.textContent`;
  await evaluate(openTab('calendar'));
  check('달력: 제목과 이 달 쓴 돈', (await evaluate(text('cal-month'))) === '2026년 11월' && (await evaluate(text('cal-spent'))) === '이 달 쓴 돈 145,500원');
  check('달력: 날짜 칸 30개', (await evaluate(`document.querySelectorAll('.day').length`)) === 30);
  check('달력: 1일이 일요일 칸', (await evaluate(`document.querySelectorAll('.cal-grid [aria-hidden="true"]:not(.wd)').length`)) === 6);
  check('달력: 요일 순서 월~일', (await evaluate(`[...document.querySelectorAll('.wd')].map((w) => w.textContent).join('')`)) === '월화수목금토일');
  check('달력: 쓴 날은 합계와 표시', (await evaluate(dayText('2026-11-03'))) === '3136,500원' && (await evaluate(`${dayBtn('2026-11-03')}.classList.contains('has')`)));
  check('달력: 안 쓴 날은 0', (await evaluate(dayText('2026-11-04'))) === '40' && !(await evaluate(`${dayBtn('2026-11-04')}.classList.contains('has')`)));
  check('달력: 오늘 표시', (await evaluate(`${dayBtn('2026-11-14')}.classList.contains('today')`)) && (await evaluate(dayText('2026-11-14'))).includes('오늘'));
  check('달력: 처음에는 오늘 선택', (await evaluate(`${dayBtn('2026-11-14')}.getAttribute('aria-pressed')`)) === 'true' && (await evaluate(text('day-total'))) === '9,000원');
  check('달력: 이번 달 남은 돈', (await evaluate(text('cal-remain'))) === '이번 달 남은 돈 854,500원');
  check('달력: 이번 달에서 다음 달 버튼 비활성', await evaluate(`document.querySelector('[data-act="cal-next"]').disabled`));
  await evaluate(`${dayBtn('2026-11-03')}.click()`);
  check('날짜를 누르면 합계와 내역', (await evaluate(text('day-total'))) === '136,500원' && (await evaluate(`document.querySelectorAll('#day-list .line').length`)) === 2);
  check('내역에 분류, 메모, 금액', (await evaluate(`document.querySelector('#day-list .line').textContent`)) === '식비장보기100,000원');
  check('메모 없는 내역 표시', (await evaluate(`document.querySelectorAll('#day-list .line')[1].textContent`)).includes('메모 없음'));
  await evaluate(`${dayBtn('2026-11-04')}.click()`);
  check('쓴 돈 없는 날 안내', (await evaluate(text('day-list'))) === '이 날은 쓴 돈이 없어요.' && (await evaluate(text('day-total'))) === '0원');
  console.log('shot', await shot('calendar'));

  await evaluate(`document.querySelector('[data-act="cal-prev"]').click()`);
  check('지난달 이동: 제목과 이 달 쓴 돈', (await evaluate(text('cal-month'))) === '2026년 10월' && (await evaluate(text('cal-spent'))) === '이 달 쓴 돈 70,000원');
  check('지난달: 날짜 선택 없이 시작', (await evaluate(`document.querySelector('.day[aria-pressed="true"]') === null`)) && (await evaluate(`document.querySelector('.cal-side').textContent`)).includes('날짜를 누르면'));
  check('지난달: 읽기 전용 라벨', (await evaluate(text('cal-lock'))) === '지난달 기록 · 볼 수만 있어요');
  check('지난달: 남은 돈 없음', await evaluate(`document.getElementById('cal-remain') === null`));
  check('가장 이른 달에서 이전 버튼 비활성', await evaluate(`document.querySelector('[data-act="cal-prev"]').disabled`));
  await evaluate(`${dayBtn('2026-10-20')}.click()`);
  check('지난달 날짜도 내역을 볼 수 있음', (await evaluate(text('day-total'))) === '70,000원');
  console.log('shot', await shot('calendar-last-month'));
  await evaluate(`document.querySelector('[data-act="cal-next"]').click()`);
  check('이번 달로 돌아오면 오늘 선택', (await evaluate(text('cal-month'))) === '2026년 11월' && (await evaluate(text('day-total'))) === '9,000원');

  // 달력: 지출 수정과 삭제
  const calBtn = (act, i = 0) => `document.querySelectorAll('[data-act="${act}"]')[${i}].click()`;
  const value = (id) => `document.getElementById('${id}').value`;
  await evaluate(`${dayBtn('2026-11-03')}.click()`);
  check('이번 달 내역에 연필과 × 버튼', (await evaluate(`document.querySelectorAll('[data-act="cal-edit"]').length`)) === 2 && (await evaluate(`document.querySelectorAll('[data-act="cal-delete"]').length`)) === 2);
  await evaluate(calBtn('cal-edit'));
  check('연필: 수정 상자로 바뀜', (await evaluate(`document.querySelector('#day-list .entry-title').textContent`)) === '지출 수정');
  check('수정 상자에 현재 값', (await evaluate(value('ce-amt'))) === '100,000' && (await evaluate(value('ce-memo'))) === '장보기' && (await evaluate(`document.querySelector('[data-act="cal-edit-category"][aria-pressed="true"]').textContent`)) === '식비');
  check('수정 상자 금액 칸에 포커스', (await evaluate(`document.activeElement.id`)) === 'ce-amt');
  await evaluate(type('ce-amt', '1.5'));
  await evaluate(calBtn('cal-edit-save'));
  check('수정 오류: 안내와 빨간 칸', (await evaluate(text('ce-err'))) === '금액은 원 단위 숫자만 입력할 수 있어요.' && (await evaluate(`document.getElementById('ce-amt').getAttribute('aria-invalid')`)) === 'true');
  check('수정 오류: 저장되지 않음', (await expenses()).find((e) => e.id === 'n1').amount === 100000);
  console.log('shot', await shot('calendar-edit-error'));
  await evaluate(type('ce-amt', '0'));
  await evaluate(calBtn('cal-edit-save'));
  check('수정 오류: 0원 안내', (await evaluate(text('ce-err'))) === '1원 이상 입력해 주세요.');
  await evaluate(calBtn('cal-edit-cancel'));
  check('취소: 원래 줄로 돌아감, 변경 없음', (await evaluate(`document.querySelector('#day-list .entry') === null`)) && (await evaluate(text('day-total'))) === '136,500원');
  await evaluate(calBtn('cal-edit'));
  await evaluate(type('ce-amt', '120,000'));
  await evaluate(type('ce-memo', '장보기 수정'));
  await evaluate(calBtn('cal-edit-category', 1));
  check('분류 칩 선택 표시', (await evaluate(`document.querySelector('[data-act="cal-edit-category"][aria-pressed="true"]').textContent`)) === '의류');
  check('다른 칸 입력이 분류 선택으로 지워지지 않음', (await evaluate(value('ce-amt'))) === '120,000');
  await evaluate(calBtn('cal-edit-save'));
  const edited = (await expenses()).find((e) => e.id === 'n1');
  check('수정 저장', edited.amount === 120000 && edited.memo === '장보기 수정' && edited.date === '2026-11-03' && (await evaluate(`state.categories[1].id`)) === edited.categoryId);
  check('수정이 칸 합계에 바로 반영', (await evaluate(dayText('2026-11-03'))) === '3156,500원');
  check('수정이 이 달 쓴 돈에 바로 반영', (await evaluate(text('cal-spent'))) === '이 달 쓴 돈 165,500원');
  check('수정이 이번 달 남은 돈에 바로 반영', (await evaluate(text('cal-remain'))) === '이번 달 남은 돈 834,500원');
  await evaluate(calBtn('cal-edit', 1));
  await evaluate(type('ce-amt', '6,500'));
  check('수정 상자 Enter로 저장', await evaluate(enter('#ce-amt')));
  check('Enter 저장 반영', (await evaluate(text('day-total'))) === '126,500원');
  await evaluate(openTab('dashboard'));
  check('달력 수정이 대시보드에 반영', (await evaluate(text('month-remain'))) === '864,500원');
  await evaluate(openTab('calendar'));
  await evaluate(`${dayBtn('2026-11-03')}.click()`);
  await evaluate(calBtn('cal-delete', 1));
  check('삭제: 내역, 칸 합계, 남은 돈이 바로 바뀜', (await evaluate(`document.querySelectorAll('#day-list .line').length`)) === 1 && (await evaluate(dayText('2026-11-03'))) === '3120,000원' && (await evaluate(text('cal-remain'))) === '이번 달 남은 돈 871,000원');
  await evaluate(`${dayBtn('2026-11-14')}.click()`);
  await evaluate(calBtn('cal-edit'));
  await evaluate(type('ce-amt', '10,000'));
  await evaluate(calBtn('cal-edit-save'));
  await evaluate(openTab('dashboard'));
  check('오늘 지출 수정이 오늘 쓴 돈에 반영', (await evaluate(text('today-spent'))) === '10,000원');
  await evaluate(openTab('calendar'));
  await evaluate(`document.querySelector('[data-act="cal-prev"]').click()`);
  await evaluate(`${dayBtn('2026-10-20')}.click()`);
  check('지난달 내역에는 버튼 없음', await evaluate(`document.querySelector('#day-list button') === null`));
  check('지난달에는 추가 상자 없음', await evaluate(`document.getElementById('cn-amt') === null`));

  // 달력: 지출 추가
  await evaluate(`document.querySelector('[data-act="cal-next"]').click()`);
  await evaluate(`${dayBtn('2026-11-05')}.click()`);
  check('오늘 이전 날짜에 추가 상자', (await evaluate(`document.querySelector('.cal-side .entry-title').textContent`)) === '이 날 지출 추가');
  check('추가 상자는 첫 분류 선택', (await evaluate(`document.querySelector('[data-act="cal-add-category"][aria-pressed="true"]').textContent`)) === '식비');
  check('오늘 이전 날짜에 미래 문구 없음', await evaluate(`document.getElementById('cal-future') === null`));
  for (const [amount, message] of [['1.5', '금액은 원 단위 숫자만 입력할 수 있어요.'], ['', '금액은 원 단위 숫자만 입력할 수 있어요.'], ['0', '1원 이상 입력해 주세요.']]) {
    await evaluate(type('cn-amt', amount));
    await evaluate(calBtn('cal-add'));
    check(`추가 금액 "${amount}": 막히고 안내`, (await evaluate(text('cn-err'))) === message && (await evaluate(`document.getElementById('cn-amt').getAttribute('aria-invalid')`)) === 'true');
  }
  const countAdd = (await expenses()).length;
  await evaluate(type('cn-amt', '20,000'));
  await evaluate(type('cn-memo', '빠뜨린 지출'));
  await evaluate(calBtn('cal-add-category', 2));
  await evaluate(calBtn('cal-add'));
  const addedOne = (await expenses()).at(-1);
  check('고른 날짜로 추가', (await expenses()).length === countAdd + 1 && addedOne.date === '2026-11-05' && addedOne.amount === 20000 && addedOne.memo === '빠뜨린 지출');
  check('고른 분류로 추가', (await evaluate(`state.categories[2].id`)) === addedOne.categoryId);
  check('추가가 칸 합계와 내역에 바로 반영', (await evaluate(dayText('2026-11-05'))) === '520,000원' && (await evaluate(`document.querySelectorAll('#day-list .line').length`)) === 1);
  check('추가 후 입력칸이 비고 포커스 유지', (await evaluate(value('cn-amt'))) === '' && (await evaluate(`document.activeElement.id`)) === 'cn-amt');
  await evaluate(type('cn-amt', '1,000'));
  check('추가 상자 Enter로 추가', await evaluate(enter('#cn-amt')));
  check('Enter 추가 반영', (await evaluate(text('day-total'))) === '21,000원');
  await evaluate(type('cn-amt', '777'));
  await evaluate(calBtn('cal-edit'));
  await evaluate(calBtn('cal-edit-cancel'));
  check('수정을 취소해도 입력 중인 금액 유지', (await evaluate(value('cn-amt'))) === '777');
  await evaluate(`${dayBtn('2026-11-06')}.click()`);
  check('다른 날짜로 옮기면 입력 비움', (await evaluate(value('cn-amt'))) === '');

  // 달력: 미래 날짜
  await evaluate(`${dayBtn('2026-11-20')}.click()`);
  check('미래: 날짜 칩과 0원', (await evaluate(`document.querySelector('.cal-side .chip').textContent`)) === '11월 20일 (금)' && (await evaluate(text('day-total'))) === '0원');
  check('미래: 두 안내 문구', (await evaluate(text('day-list'))) === '이 날은 쓴 돈이 없어요.' && (await evaluate(text('cal-future'))) === '아직 오지 않은 날이에요.');
  check('미래: 맨 아래 이번 달 남은 돈', (await evaluate(`document.querySelector('.cal-side').lastElementChild.id`)) === 'cal-remain');
  check('미래: 연필, ×, 추가 상자 없음', await evaluate(`document.querySelector('.cal-side button') === null && document.querySelector('.cal-side .entry') === null`));
  console.log('shot', await shot('calendar-future'));

  // 달력: 대시보드 반영과 좁은 화면
  await evaluate(openTab('dashboard'));
  check('달력 추가가 대시보드 남은 돈에 반영', (await evaluate(text('month-remain'))) === '849,000원', await evaluate(text('month-remain')));
  check('다른 날 추가는 오늘 쓴 돈에 영향 없음', (await evaluate(text('today-spent'))) === '10,000원');
  await evaluate(openTab('calendar'));
  await evaluate(`${dayBtn('2026-11-14')}.click()`);
  console.log('shot', await shot('calendar-add'));
  for (const width of [400, 320]) {
    await size(width, 800);
    check(`달력 ${width}px 넘침 없음`, !(await evaluate(overflow)));
    check(`달력 ${width}px 금액이 칸에서 잘리지 않음`, await evaluate(`[...document.querySelectorAll('.day')].every((d) => d.scrollWidth <= d.clientWidth && d.scrollHeight <= d.clientHeight)`));
    console.log('shot', await shot(`calendar-${width}`));
  }
  await size(1200, 800);

  // 정산을 마치면 대시보드로 돌아간다
  await evaluate(`getToday = () => '2026-12-01'`);
  await evaluate(`${dayBtn('2026-11-14')}.click()`);
  check('달력에서 달이 바뀌면 정산 창', !(await evaluate(isHidden('overlay'))));
  await evaluate(type('save-amount', '849,000'));
  await evaluate(type('base-amount', '100,000'));
  await evaluate(next);
  await evaluate(alloc(0, '100,000'));
  await evaluate(next);
  check('정산을 마치면 대시보드 표시', (await evaluate(isHidden('overlay'))) && (await evaluate(visible)) === 'dashboard');
  check('대시보드 탭이 현재 표시', (await evaluate(`document.querySelector('[aria-current="page"]').dataset.view`)) === 'dashboard');

  // 설정: 이번 달 금액 수정
  await setToday('2026-11-14');
  await evaluate(`localStorage.clear()`);
  await reload();
  await evaluate(type('base-amount', '1,000,000'));
  await evaluate(next);
  await evaluate(alloc(0, '400,000'));
  await evaluate(alloc(1, '600,000'));
  await evaluate(next);
  await evaluate(`(() => {
    const d = JSON.parse(localStorage.getItem('living-budget'));
    d.expenses.push({ id: 's1', date: '2026-11-03', categoryId: d.categories[0].id, amount: 450000, memo: '식비' });
    localStorage.setItem('living-budget', JSON.stringify(d));
  })()`);
  await reload();
  const setAlloc = (i, val) => `(() => { const el = document.querySelectorAll('[data-set-alloc]')[${i}]; el.value = ${JSON.stringify(val)}; el.dispatchEvent(new Event('input', { bubbles: true })); })()`;
  const saveDisabled = `document.getElementById('set-save').disabled`;
  const savedMonth = async () => JSON.parse(await evaluate(raw)).months['2026-11'];
  await evaluate(openTab('settings'));
  check('설정: 분류 줄과 현재 금액', (await evaluate(`document.querySelectorAll('[data-set-alloc]').length`)) === 5 && (await evaluate(value('set-total'))) === '1,000,000' && (await evaluate(`document.querySelector('[data-set-alloc]').value`)) === '400,000');
  check('설정: 분류마다 사용 금액', (await evaluate(`document.querySelector('[data-panel="settings"] .used').textContent`)) === '사용 450,000원');
  check('설정: 미배분 0원', (await evaluate(text('set-left'))) === '0원');
  check('바뀐 내용 없으면 저장 비활성과 안내', (await evaluate(saveDisabled)) && (await evaluate(text('set-hint'))) === '바꾼 내용이 없어요.');
  await evaluate(setAlloc(0, '350,000'));
  check('모자라면 안내', (await evaluate(saveDisabled)) && (await evaluate(text('set-hint'))) === '50,000원을 더 나눠야 저장할 수 있어요.' && (await evaluate(text('set-left'))) === '50,000원');
  await evaluate(setAlloc(0, '450,000'));
  check('넘치면 안내와 빨간색', (await evaluate(saveDisabled)) && (await evaluate(text('set-hint'))) === '총 금액보다 50,000원 많아요. 줄여 주세요.' && (await evaluate(text('set-left'))) === '-50,000원' && (await evaluate(`document.getElementById('set-left').classList.contains('neg-text')`)));
  await evaluate(setAlloc(0, '1.5'));
  check('잘못된 배분: 칸 표시와 안내', (await evaluate(saveDisabled)) && (await evaluate(`document.querySelector('[data-set-alloc]').getAttribute('aria-invalid')`)) === 'true' && (await evaluate(text('set-hint'))) === '금액은 원 단위 숫자만 입력할 수 있어요.');
  await evaluate(setAlloc(0, '350,000'));
  await evaluate(type('set-total', 'abc'));
  check('잘못된 총 금액: 칸 표시와 안내', (await evaluate(saveDisabled)) && (await evaluate(`document.getElementById('set-total').getAttribute('aria-invalid')`)) === 'true' && (await evaluate(text('set-hint'))) === '총 금액은 원 단위 숫자만 입력할 수 있어요.');
  await evaluate(type('set-total', '0'));
  check('0원: 안내', (await evaluate(saveDisabled)) && (await evaluate(text('set-hint'))) === '총 금액은 1원 이상이어야 해요.');
  await evaluate(type('set-total', '950,000'));
  check('합계가 맞으면 저장 활성', !(await evaluate(saveDisabled)) && (await evaluate(text('set-hint'))) === '합계가 딱 맞아요. 저장할 수 있어요.');
  await evaluate(`document.getElementById('set-save').click()`);
  const edit1 = await savedMonth();
  check('저장: 총 금액과 배분 반영', edit1.total === 950000 && Object.values(edit1.allocations).join() === '350000,600000,0,0,0');
  check('저장: 공식 유지', edit1.baseAmount + edit1.carryIn - edit1.deduction === 950000);
  check('저장 후 대시보드로 이동', (await evaluate(visible)) === 'dashboard' && (await evaluate(`document.querySelector('[aria-current="page"]').dataset.view`)) === 'dashboard');
  check('이미 쓴 지출은 그대로', (await expenses()).length === 1);
  check('이미 쓴 돈보다 적은 분류는 초과 표시', (await evaluate(catRow(0))) === '식비 초과-100,000원 배분 350,000원 · 사용 450,000원', await evaluate(catRow(0)));
  check('대시보드 남은 돈 반영', (await evaluate(text('month-remain'))) === '500,000원');

  await evaluate(openTab('settings'));
  await evaluate(type('set-total', '100,000'));
  await evaluate(setAlloc(0, '100,000'));
  await evaluate(setAlloc(1, ''));
  check('총 금액을 쓴 돈보다 적게 정해도 저장 가능', !(await evaluate(saveDisabled)));
  await evaluate(`document.getElementById('set-save').click()`);
  check('총 금액이 쓴 돈보다 적으면 남은 돈이 음수', (await evaluate(text('month-remain'))) === '-350,000원' && (await evaluate(`document.getElementById('month-remain').classList.contains('neg')`)));

  // 설정: 저장 전 미리보기, 취소, 지난달 라벨
  await evaluate(openTab('settings'));
  check('미리보기: 처음에는 현재와 같음', (await evaluate(text('preview-total'))) === '현재 100,000원 → 변경 100,000원' && (await evaluate(text('preview-remain'))) === '-350,000원');
  check('미리보기: 음수는 빨간색', await evaluate(`document.getElementById('preview-remain').classList.contains('neg')`));
  check('지난달 수정 불가 라벨', (await evaluate(`document.querySelector('[data-panel="settings"] .lock').textContent`)) === '지난달 기록은 수정할 수 없어요');
  await evaluate(type('set-total', '1,000,000'));
  check('미리보기: 입력하면 바로 바뀜', (await evaluate(text('preview-total'))) === '현재 100,000원 → 변경 1,000,000원' && (await evaluate(text('preview-remain'))) === '550,000원');
  check('미리보기: 양수는 빨간색 해제', !(await evaluate(`document.getElementById('preview-remain').classList.contains('neg')`)));
  check('미리보기는 저장하지 않음', (await savedMonth()).total === 100000);
  await evaluate(setAlloc(0, '1,000,000'));
  console.log('shot', await shot('settings'));
  await evaluate(type('set-total', 'abc'));
  check('미리보기: 숫자가 아니면 -', (await evaluate(text('preview-total'))) === '현재 100,000원 → 변경 -' && (await evaluate(text('preview-remain'))) === '-');
  await evaluate(`document.querySelector('[data-act="set-cancel"]').click()`);
  check('취소: 대시보드로 돌아감', (await evaluate(visible)) === 'dashboard');
  check('취소: 저장되지 않음', (await savedMonth()).total === 100000 && (await evaluate(text('month-remain'))) === '-350,000원');
  await evaluate(openTab('settings'));
  check('취소 후 다시 열면 저장된 값', (await evaluate(value('set-total'))) === '100,000');
  await size(400, 800);
  check('설정 400px 넘침 없음', !(await evaluate(overflow)));
  console.log('shot', await shot('settings-400'));
  await size(320, 800);
  check('설정 320px 넘침 없음', !(await evaluate(overflow)));
  console.log('shot', await shot('settings-320'));
  await size(1200, 800);
  await setToday(null);
}
