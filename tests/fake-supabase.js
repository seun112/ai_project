// 브라우저 검사에서 Supabase 대신 쓰는 가짜 클라이언트. 실제 서버와 계정을 건드리지 않는다.
// 계정과 행은 새로고침해도 남도록 localStorage에, 세션은 앱이 넘긴 저장소에 둔다.
// 실제 서버처럼 응답은 한 박자 늦게 온다. 오류 코드와 save_changes 동작도 실제 서버와 같다.
(() => {
  const USERS = 'fake-supabase-users';
  const SESSION = 'fake-supabase-session';
  const FAIL = 'fake-supabase-fail';
  const dbKey = (userId) => `fake-supabase-db:${userId}`;
  const users = () => JSON.parse(localStorage.getItem(USERS) ?? '{}');
  const later = () => new Promise((resolve) => setTimeout(resolve, 1));
  const refused = (code) => ({ data: { user: null, session: null }, error: { code, message: code } });
  const failing = (kind) => localStorage.getItem(FAIL) === kind;
  const emptyDb = () => ({ categories: [], months: [], expenses: [], piggy: [], piggy_history: [], unsettled: [] });
  const readDb = (userId) => JSON.parse(localStorage.getItem(dbKey(userId))) ?? emptyDb();
  const writeDb = (userId, db) => localStorage.setItem(dbKey(userId), JSON.stringify(db));

  const upsert = (rows, changed, key) => {
    const merged = new Map(rows.map((row) => [row[key], row]));
    for (const row of changed ?? []) merged.set(row[key], row);
    return [...merged.values()];
  };

  // supabase/schema.sql의 save_changes와 같은 순서로 반영한다. 호출 즉시 반영되어 검사에서 바로 읽을 수 있다.
  function saveChanges(userId, changes) {
    const db = readDb(userId);
    db.categories = upsert(db.categories, changes.categories, 'id');
    db.months = upsert(db.months, changes.months, 'month');
    db.expenses = upsert(db.expenses, changes.expenses, 'id');
    db.expenses = db.expenses.filter(({ id }) => !(changes.deleted_expenses ?? []).includes(id));
    db.categories = db.categories.filter(({ id }) => !(changes.deleted_categories ?? []).includes(id));
    if ('piggy_balance' in changes) db.piggy = [{ user_id: userId, balance: changes.piggy_balance }];
    const newHistory = (changes.piggy_history ?? []).filter(({ id }) => !db.piggy_history.some((row) => row.id === id));
    db.piggy_history.push(...newHistory);
    db.unsettled = upsert(db.unsettled, changes.unsettled, 'month');
    writeDb(userId, db);
  }

  function createClient(url, key, options) {
    const storage = options?.auth?.storage ?? localStorage;
    const sessionNow = () => JSON.parse(storage.getItem(SESSION));
    const startSession = (email) => {
      const session = { user: { id: email, email } };
      storage.setItem(SESSION, JSON.stringify(session));
      return { data: { user: session.user, session }, error: null };
    };
    const auth = {
      async getSession() {
        await later();
        return { data: { session: sessionNow() }, error: null };
      },
      async signUp({ email, password }) {
        await later();
        if (failing('auth')) throw new TypeError('Failed to fetch');
        if (password.length < 8) return refused('weak_password');
        const all = users();
        if (Object.hasOwn(all, email)) return refused('user_already_exists');
        localStorage.setItem(USERS, JSON.stringify({ ...all, [email]: password }));
        return startSession(email);
      },
      async signInWithPassword({ email, password }) {
        await later();
        if (failing('auth')) return refused(undefined);
        if (users()[email] !== password) return refused('invalid_credentials');
        return startSession(email);
      },
    };
    const from = (table) => ({
      select: () => ({
        order: (key) => ({
          async range(first, last) {
            await later();
            if (failing('load')) return { data: null, error: { message: 'load failed' } };
            const rows = readDb(sessionNow().user.id)[table];
            rows.sort((a, b) => (a[key] < b[key] ? -1 : 1));
            return { data: rows.slice(first, last + 1), error: null };
          },
        }),
      }),
    });
    const rpc = (name, { changes }) => {
      if (failing('save')) return later().then(() => ({ data: null, error: { message: 'save failed' } }));
      saveChanges(sessionNow().user.id, changes);
      return later().then(() => ({ data: null, error: null }));
    };
    return { auth, from, rpc };
  }

  globalThis.supabase = { createClient };

  // 검사에서 서버 데이터를 읽고 넣는 도구. 앱의 변환 함수를 빌려 앱 데이터 모양으로 다룬다.
  globalThis.fakeRead = (userId) => {
    const db = readDb(userId);
    return db.piggy.length === 0 ? null : JSON.stringify(rowsToData(db));
  };
  globalThis.fakeWrite = (userId, json) => {
    const { piggy_balance: balance, ...rows } = dataToRows(JSON.parse(json));
    writeDb(userId, { ...rows, piggy: [{ user_id: userId, balance }] });
  };
  globalThis.fakeClear = (userId) => localStorage.removeItem(dbKey(userId));
})();
