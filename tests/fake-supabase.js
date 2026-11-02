// 브라우저 검사에서 Supabase 대신 쓰는 가짜 클라이언트. 실제 서버와 계정을 건드리지 않는다.
// 계정은 새로고침해도 남도록 localStorage에, 세션은 앱이 넘긴 저장소에 둔다.
// 실제 서버처럼 응답은 한 박자 늦게 온다. 오류 코드도 실제 서버와 같다.
(() => {
  const USERS = 'fake-supabase-users';
  const SESSION = 'fake-supabase-session';
  const FAIL = 'fake-supabase-fail';
  const users = () => JSON.parse(localStorage.getItem(USERS) ?? '{}');
  const later = () => new Promise((resolve) => setTimeout(resolve, 1));
  const refused = (code) => ({ data: { user: null, session: null }, error: { code, message: code } });

  function createClient(url, key, options) {
    const storage = options?.auth?.storage ?? localStorage;
    const startSession = (email) => {
      const session = { user: { id: email, email } };
      storage.setItem(SESSION, JSON.stringify(session));
      return { data: { user: session.user, session }, error: null };
    };
    const auth = {
      async getSession() {
        await later();
        return { data: { session: JSON.parse(storage.getItem(SESSION)) }, error: null };
      },
      async signUp({ email, password }) {
        await later();
        if (localStorage.getItem(FAIL) === 'auth') throw new TypeError('Failed to fetch');
        if (password.length < 8) return refused('weak_password');
        const all = users();
        if (Object.hasOwn(all, email)) return refused('user_already_exists');
        localStorage.setItem(USERS, JSON.stringify({ ...all, [email]: password }));
        return startSession(email);
      },
      async signInWithPassword({ email, password }) {
        await later();
        if (localStorage.getItem(FAIL) === 'auth') return refused(undefined);
        if (users()[email] !== password) return refused('invalid_credentials');
        return startSession(email);
      },
    };
    return { auth };
  }

  globalThis.supabase = { createClient };
})();
