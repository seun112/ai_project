// 화면 골격과 저장 시나리오
const visible = `[...document.querySelectorAll('[data-panel]')].filter((p) => !p.hidden).map((p) => p.dataset.panel).join()`;
const overflow = `document.documentElement.scrollWidth > document.documentElement.clientWidth`;
const isHidden = (id) => `document.getElementById('${id}').hidden`;
const raw = `localStorage.getItem('living-budget')`;
const setRaw = (value) => `localStorage.setItem('living-budget', ${JSON.stringify(value)})`;

// 이번 달을 정산 완료 상태로 만들어 마법사 없이 앱에 들어간다.
const seedSettled = `(() => {
  const data = JSON.parse(localStorage.getItem('living-budget'));
  const allocations = Object.fromEntries(data.categories.map((c) => [c.id, 250000]));
  data.months[monthKeyOf(getToday())] = { baseAmount: 1000000, carryIn: 0, deduction: 0, total: 1000000, allocations, settled: true };
  localStorage.setItem('living-budget', JSON.stringify(data));
})()`;

export default async function ({ evaluate, reload, size, shot, check, setToday }) {
  // 첫 실행 흐름
  check('첫 실행: 마법사 표시, 앱 숨김', !(await evaluate(isHidden('wizard'))) && (await evaluate(isHidden('app'))));
  check('첫 실행: 2단계로 시작', /정산 1 \/ 2$/.test(await evaluate(`document.getElementById('wizard-progress').textContent`)));
  check('첫 실행: 지난달 결과 없음', await evaluate(`document.querySelector('[data-step="result"]').hidden`));
  check('첫 실행: 이전 버튼 없음', await evaluate(isHidden('wizard-back')));
  console.log('shot', await shot('wizard-first'));

  // 총 금액 단계
  const type = (id, value) => `(() => { const el = document.getElementById('${id}'); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('input', { bubbles: true })); })()`;
  const text = (id) => `document.getElementById('${id}').textContent`;
  const next = `document.getElementById('wizard-next').click()`;
  const onTotal = `!document.querySelector('[data-step="total"]').hidden`;
  check('금액 칸에 포커스', (await evaluate(`document.activeElement.id`)) === 'base-amount');
  for (const [value, label] of [['', '빈 값'], ['1.5', '소수점'], ['-100', '음수'], ['abc', '문자'], ['0', '0원']]) {
    await evaluate(type('base-amount', value));
    await evaluate(next);
    check(`${label}: 다음 단계로 못 감`, await evaluate(onTotal));
    check(`${label}: 오류 표시`, !(await evaluate(isHidden('base-error'))), await evaluate(text('base-error')));
    check(`${label}: 잘못된 칸 표시`, (await evaluate(`document.getElementById('base-amount').getAttribute('aria-invalid')`)) === 'true');
  }
  console.log('shot', await shot('wizard-total-error'));
  await evaluate(type('base-amount', '1,000,000'));
  check('입력하면 오류가 사라짐', await evaluate(isHidden('base-error')));
  check('입력하면 총 금액이 바로 갱신', (await evaluate(text('total-amount'))) === '1,000,000원');
  check('계산식 표시', (await evaluate(text('total-base'))) === '1,000,000원' && (await evaluate(text('total-carry'))) === '+0원' && (await evaluate(text('total-deduction'))) === '−0원');
  console.log('shot', await shot('wizard-total'));
  await evaluate(next);
  check('올바른 금액이면 다음 단계로 이동', !(await evaluate(onTotal)));
  await evaluate(`document.getElementById('wizard-back').click()`);
  check('돌아와도 입력값 유지', (await evaluate(`document.getElementById('base-amount').value`)) === '1,000,000');

  // 분류별 배분 단계
  const alloc = (i, value) => `(() => { const el = document.querySelectorAll('[data-alloc]')[${i}]; el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('input', { bubbles: true })); })()`;
  const allocAttr = (i, name) => `document.querySelectorAll('[data-alloc]')[${i}].getAttribute('${name}')`;
  await evaluate(next);
  check('배분: 분류 5개 입력칸', (await evaluate(`document.querySelectorAll('[data-alloc]').length`)) === 5);
  check('배분: 첫 칸에 포커스', (await evaluate(`document.activeElement === document.querySelector('[data-alloc]')`)));
  check('배분: 총 금액 표시', (await evaluate(text('alloc-total'))) === '1,000,000원');
  check('배분: 처음에는 전액 미배분', (await evaluate(text('alloc-sum'))) === '0원' && (await evaluate(text('alloc-left'))) === '1,000,000원');
  await evaluate(alloc(0, '400,000'));
  check('입력하면 합계와 미배분이 바로 바뀜', (await evaluate(text('alloc-sum'))) === '400,000원' && (await evaluate(text('alloc-left'))) === '600,000원');
  await evaluate(alloc(1, '700000'));
  check('초과 배분은 -와 빨간색', (await evaluate(text('alloc-left'))) === '-100,000원' && (await evaluate(`document.getElementById('alloc-left').classList.contains('over')`)));
  console.log('shot', await shot('allocate-over'));
  await evaluate(alloc(1, '1.5'));
  check('잘못된 금액: 칸 표시와 안내', (await evaluate(allocAttr(1, 'aria-invalid'))) === 'true' && !(await evaluate(isHidden('alloc-hint'))), await evaluate(text('alloc-hint')));
  await evaluate(alloc(1, ''));
  check('빈칸은 0원: 오류 없음', (await evaluate(allocAttr(1, 'aria-invalid'))) === null && (await evaluate(isHidden('alloc-hint'))) && (await evaluate(text('alloc-sum'))) === '400,000원');
  await evaluate(`document.getElementById('wizard-back').click()`);
  await evaluate(next);
  check('이전으로 갔다 와도 배분 입력 유지', (await evaluate(`document.querySelectorAll('[data-alloc]')[0].value`)) === '400,000');
  await evaluate(`document.getElementById('wizard-back').click()`);

  await evaluate(seedSettled);
  await reload();
  check('정산 완료 후 앱 표시', (await evaluate(isHidden('wizard'))) && !(await evaluate(isHidden('app'))));
  check('처음 화면은 대시보드', (await evaluate(visible)) === 'dashboard');
  check('이번 달 표시', /^\d{4}년 \d{1,2}월$/.test(await evaluate(`document.getElementById('month-label').textContent`)));
  for (const name of ['calendar', 'weekly', 'piggy', 'settings', 'dashboard']) {
    await evaluate(`document.querySelector('[data-view="${name}"]').click()`);
    check(`${name} 탭 전환`, (await evaluate(visible)) === name);
  }

  // 첫 실행 저장과 새로고침 유지
  const first = await evaluate(raw);
  check('기본 분류가 저장되어 있음', first !== null && JSON.parse(first).categories.length === 5);
  await reload();
  check('새로고침 후 분류 id 유지', (await evaluate(raw)) === first);
  await evaluate(`const d = JSON.parse(${raw}); d.piggy.balance = 1234; ${setRaw('')}; localStorage.setItem('living-budget', JSON.stringify(d));`);
  await reload();
  check('저장한 값이 새로고침 후 유지', (await evaluate(`state.piggy.balance`)) === 1234);

  console.log('shot', await shot('desktop'));
  check('데스크톱 가로 넘침 없음', !(await evaluate(overflow)));
  await size(400, 800);
  check('400px 가로 넘침 없음', !(await evaluate(overflow)));
  check('400px 내비가 하단 고정', (await evaluate(`getComputedStyle(document.querySelector('.nav')).position`)) === 'fixed');
  console.log('shot', await shot('mobile'));

  // 손상 데이터
  for (const [label, value] of [['깨진 JSON', '{broken'], ['다른 버전', JSON.stringify({ version: 99 })]]) {
    await evaluate(setRaw(value));
    await reload();
    check(`${label}: 복구 화면 표시`, !(await evaluate(isHidden('recovery'))) && (await evaluate(isHidden('app'))));
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
  check('초기화 후 마법사 표시', !(await evaluate(isHidden('wizard'))) && (await evaluate(isHidden('recovery'))) && (await evaluate(isHidden('app'))));
  const after = JSON.parse(await evaluate(raw));
  check('초기화 후 빈 데이터 저장', after.version === 1 && after.categories.length === 5 && after.piggy.balance === 0);
  await reload();
  await reload();
  check('초기화 후 새로고침해도 마법사 표시', !(await evaluate(isHidden('wizard'))));

  // 저장 실패 안내
  await evaluate(`Storage.prototype.setItem = () => { throw new Error('quota'); }; saveState();`);
  check('저장 실패 안내 표시', !(await evaluate(isHidden('save-error'))));
  console.log('shot', await shot('save-error'));
  await reload();
  await evaluate(`saveState();`);
  check('저장 성공하면 안내 사라짐', await evaluate(isHidden('save-error')));

  // 다음 달 접속
  await size(1200, 800);
  await setToday('2026-11-15');
  await reload();
  await evaluate(seedSettled);
  await setToday('2026-12-02');
  await reload();
  const progress = () => evaluate(`document.getElementById('wizard-progress').textContent`);
  check('다음 달: 3단계로 시작', (await progress()) === '2026년 12월 정산 1 / 3', await progress());
  check('다음 달: 지난달 결과 표시', (await evaluate(`document.getElementById('result-title').textContent`)) === '2026년 11월 결과');
  check('다음 달: 남은 금액 부호 표시', (await evaluate(`document.getElementById('result-balance').textContent`)) === '+1,000,000원');
  console.log('shot', await shot('wizard-result'));
  await evaluate(`document.getElementById('wizard-next').click()`);
  check('다음 단계로 이동', (await progress()) === '2026년 12월 정산 2 / 3');
  await evaluate(`document.getElementById('base-amount').value = '500000'`);
  check('이전 버튼 표시', !(await evaluate(isHidden('wizard-back'))));
  await evaluate(`document.getElementById('wizard-back').click()`);
  check('이전 단계로 이동', (await progress()) === '2026년 12월 정산 1 / 3');

  // 탭을 열어둔 채 달이 바뀐 경우
  await setToday('2026-11-20');
  await reload();
  check('이번 달이 정산되어 있으면 앱 표시', !(await evaluate(isHidden('app'))));
  await evaluate(`getToday = () => '2026-12-01'; document.dispatchEvent(new Event('visibilitychange'));`);
  check('탭 복귀 시 달이 바뀌었으면 마법사 표시', !(await evaluate(isHidden('wizard'))) && (await evaluate(isHidden('app'))));
  await setToday(null);

  // 합계 검증과 저장
  await evaluate(`localStorage.clear()`);
  await reload();
  const nextBtn = `document.getElementById('wizard-next')`;
  await evaluate(type('base-amount', '1,000,000'));
  check('총 금액 단계 버튼은 다음', (await evaluate(`${nextBtn}.textContent`)) === '다음');
  await evaluate(next);
  check('배분 단계 버튼은 저장하고 시작', (await evaluate(`${nextBtn}.textContent`)) === '저장하고 시작');
  check('아직 나누지 않았으면 저장 비활성', await evaluate(`${nextBtn}.disabled`));
  await evaluate(`document.getElementById('wizard-back').click()`);
  check('이전으로 돌아가면 다음 버튼 활성', (await evaluate(`${nextBtn}.textContent`)) === '다음' && !(await evaluate(`${nextBtn}.disabled`)));
  await evaluate(next);
  await evaluate(alloc(0, '600,000'));
  check('합계가 모자라면 저장 비활성', await evaluate(`${nextBtn}.disabled`));
  await evaluate(alloc(1, '500,000'));
  check('합계가 넘치면 저장 비활성', await evaluate(`${nextBtn}.disabled`));
  await evaluate(alloc(1, '400,000'));
  await evaluate(alloc(2, 'abc'));
  check('합이 맞아도 잘못된 칸이 있으면 저장 비활성', await evaluate(`${nextBtn}.disabled`));
  await evaluate(`document.getElementById('wizard-form').requestSubmit()`);
  check('저장 차단: 제출해도 기록되지 않음', Object.keys(JSON.parse(await evaluate(raw)).months).length === 0);
  await evaluate(alloc(2, ''));
  check('합계가 맞으면 저장 활성', !(await evaluate(`${nextBtn}.disabled`)));
  const enter = (selector) => `!document.querySelector('${selector}').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))`;
  check('금액 칸 Enter는 저장으로 이어지지 않음', await evaluate(enter('[data-alloc]')));
  check('삭제 버튼 Enter는 막지 않음', !(await evaluate(enter('[data-act="del-ask"]'))));
  await evaluate(next);
  check('저장 후 앱 표시', (await evaluate(isHidden('wizard'))) && !(await evaluate(isHidden('app'))));
  const saved = Object.values(JSON.parse(await evaluate(raw)).months);
  check('정산 기록 저장', saved.length === 1 && saved[0].settled === true && saved[0].total === 1000000 && saved[0].baseAmount === 1000000);
  check('배분 저장, 빈칸은 0원', Object.values(saved[0].allocations).join() === '600000,400000,0,0,0', Object.values(saved[0].allocations).join());
  await reload();
  check('새로고침해도 정산 창이 다시 뜨지 않음', (await evaluate(isHidden('wizard'))) && !(await evaluate(isHidden('app'))));

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
  check('삭제 전 확인 표시', /^식비 분류를 삭제할까요\? 이번 달부터 목록에서 빠져요\.$/.test(await evaluate(`document.querySelector('.confirm span').textContent`)));
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
  check('분류를 바꿔도 저장 후 앱 표시', !(await evaluate(isHidden('app'))));
  const cats = JSON.parse(await evaluate(raw)).categories;
  check('지출 있는 분류는 숨김, 없는 분류는 삭제', cats.map((c) => `${c.name}:${c.hidden}`).join() === '식비:true,취미:false', cats.map((c) => `${c.name}:${c.hidden}`).join());
  const month = JSON.parse(await evaluate(raw)).months['2026-11'];
  check('배분은 남은 분류만 저장', Object.values(month.allocations).join() === '100000' && Object.keys(month.allocations)[0] === cats[1].id);

  await setToday('2026-12-02');
  await reload();
  await evaluate(next);
  await evaluate(type('base-amount', '100,000'));
  await evaluate(next);
  check('다음 달 정산에 숨긴 분류가 나오지 않음', (await names()) === '취미', await names());
  await setToday(null);
}
