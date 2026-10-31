// 화면 골격과 저장 시나리오
const visible = `[...document.querySelectorAll('[data-panel]')].filter((p) => !p.hidden).map((p) => p.dataset.panel).join()`;
const overflow = `document.documentElement.scrollWidth > document.documentElement.clientWidth`;
const isHidden = (id) => `document.getElementById('${id}').hidden`;
const raw = `localStorage.getItem('living-budget')`;
const setRaw = (value) => `localStorage.setItem('living-budget', ${JSON.stringify(value)})`;

export default async function ({ evaluate, reload, size, shot, check }) {
  check('처음 화면은 대시보드', (await evaluate(visible)) === 'dashboard');
  check('이번 달 표시', /^\d{4}년 \d{1,2}월$/.test(await evaluate(`document.getElementById('month-label').textContent`)));
  for (const name of ['calendar', 'weekly', 'piggy', 'settings', 'dashboard']) {
    await evaluate(`document.querySelector('[data-view="${name}"]').click()`);
    check(`${name} 탭 전환`, (await evaluate(visible)) === name);
  }

  // 첫 실행 저장과 새로고침 유지
  const first = await evaluate(raw);
  check('첫 실행에 기본 데이터 저장', first !== null && JSON.parse(first).categories.length === 4);
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
  check('초기화 후 앱 표시', !(await evaluate(isHidden('app'))) && (await evaluate(isHidden('recovery'))));
  const after = JSON.parse(await evaluate(raw));
  check('초기화 후 빈 데이터 저장', after.version === 1 && after.categories.length === 4 && after.piggy.balance === 0);
  await reload();
  check('초기화 후 새로고침해도 앱 표시', !(await evaluate(isHidden('app'))));

  // 저장 실패 안내
  await evaluate(`Storage.prototype.setItem = () => { throw new Error('quota'); }; saveState();`);
  check('저장 실패 안내 표시', !(await evaluate(isHidden('save-error'))));
  console.log('shot', await shot('save-error'));
  await reload();
  await evaluate(`saveState();`);
  check('저장 성공하면 안내 사라짐', await evaluate(isHidden('save-error')));
}
