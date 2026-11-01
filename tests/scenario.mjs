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
  console.log('shot', await shot('dashboard-left'));
  await setToday(null);
}
