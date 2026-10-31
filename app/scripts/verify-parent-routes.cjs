const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function load(file, requireMock) {
  const module = { exports: {} };
  new Function('require', 'module', 'exports', '__DEV__', fs.readFileSync(file, 'utf8'))(requireMock, module, module.exports, false);
  return module.exports;
}

// Exercise the installed Expo version's screen processing and redirect decision.
let processScreens;
load('node_modules/expo-router/build/layouts/TabsClient.js', name => {
  if (name === '../standard-navigation') return { integrateWithRouter: (_factory, _router, config) => { processScreens = config.processScreens; return {}; } };
  return {};
});
const source = ts.createSourceFile('layout.tsx', fs.readFileSync('src/app/parent/_layout.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const screens = [];
function visit(node) {
  if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === 'Tabs.Screen') {
    const attrs = node.attributes.properties;
    const name = attrs.find(a => a.name?.getText(source) === 'name').initializer.text;
    if (['index', 'plan', 'recordings'].includes(name)) {
      const options = name === 'index' ? {} : new Function(`return (${attrs.find(a => a.name?.getText(source) === 'options').initializer.expression.getText(source)});`)();
      screens.push({ name, options });
    }
  }
  ts.forEachChild(node, visit);
}
visit(source);
const redirects = [];
const hooks = {
  react: { useMemo: fn => fn(), useEffect: fn => fn() },
  '../Route': { useRouteNode: () => ({}) },
  '../constants': { NOT_FOUND_ROUTE_NAME: '+not-found' },
  '../global-state/useRouterActions': { useRouterActions: () => ({ replace: href => redirects.push(href) }) },
  '../layouts/GuardContext': { useGuardRedirect: () => undefined },
  '../link/preview/PreviewRouteContext': { useIsPreview: () => false },
  '../react-navigation/native': { useIsFocused: () => true },
  '../routeNode': { getValidInitialRouteName: () => 'index' },
  '../utils/orderRoutesByRouteNames': { orderRoutesByRouteNames: routes => routes },
  './useBuildHref': { useBuildHref: () => route => `/parent/${route.name}` },
};
const { useVisibleTabsWithRedirect } = load('node_modules/expo-router/build/standard-navigation/useVisibleTabsWithRedirect.js', name => hooks[name]);
function focus(screens, name) {
  redirects.length = 0;
  const processed = processScreens(screens);
  return useVisibleTabsWithRedirect({
    routes: processed.map(s => ({ key: s.name, name: s.name })),
    routeNames: processed.map(s => s.name), focusedRouteKey: name,
    descriptors: Object.fromEntries(processed.map(s => [s.name, { options: s.options, routeSource: 'layout' }])),
  });
}
for (const name of ['recordings', 'plan']) {
  // Confirm the previous configuration reproduces the reported return to Home.
  focus(screens.map(s => s.name === name ? { ...s, options: { href: null } } : s), name);
  assert.deepEqual(redirects, ['/parent/index']);
  assert.ok(focus(screens, name).focusedIndex >= 0);
  assert.deepEqual(redirects, []);
  const options = screens.find(s => s.name === name).options;
  assert.equal(options.tabBarButton(), null);
  assert.equal(options.tabBarItemStyle.display, 'none');
}
console.log('Parent routes passed: old home redirect reproduced; recordings/plan stay accessible with tab buttons hidden.');
