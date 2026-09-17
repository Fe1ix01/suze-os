// View navigation only: no storage writes, network requests, or Auth lifecycle.
const routes = {
  home: { view: 'home', title: '首页' },
  career: { view: 'career', title: '求职模式' },
  learn: { view: 'learn', title: '学习模式' },
  entertainment: { view: 'entertainment', title: '娱乐模式' },
  journal: { view: 'journal', title: '记录' },
  data: { view: 'data', title: '数据' },
  review: { view: 'journal', title: '记录', focus: 'reviewText' },
  jobPanel: { view: 'career', title: '求职模式', focus: 'jobMetricsTitle' },
};
const aliases = { top: 'home', dashboard: 'home', workspace: 'career' };
const modes = new Set(['career', 'learn', 'entertainment']);

export function initViewRouter(onChange = () => {}) {
  const views = [...document.querySelectorAll('[data-view]')];
  const header = document.getElementById('appHeader');

  function render() {
    const hash = window.location.hash.slice(1);
    const key = Object.hasOwn(aliases, hash) ? aliases[hash] : Object.hasOwn(routes, hash) ? hash : 'home';
    const route = routes[key];
    if (hash !== key) {
      window.history.replaceState(null, '', '#' + key);
    }

    // An open modal must not carry tools or focus into another view.
    document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
    views.forEach(view => {
      const active = view.dataset.view === route.view;
      view.hidden = !active;
      view.toggleAttribute('inert', !active);
    });
    header.hidden = modes.has(route.view);
    header.toggleAttribute('inert', header.hidden);
    document.querySelectorAll('.nav-links a').forEach(link => {
      if (link.hash === '#' + route.view) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    document.title = 'Suze Flow · ' + route.title;
    onChange(route.view);

    const focus = document.getElementById(route.focus || route.view + 'Title');
    if (focus) {
      if (!focus.matches('input, textarea, button, a, [tabindex]')) focus.tabIndex = -1;
      focus.focus({ preventScroll: true });
      if (route.focus) focus.scrollIntoView({ block: 'center' });
      else window.scrollTo(0, 0);
    }
  }

  window.addEventListener('hashchange', render);
  render();
}
