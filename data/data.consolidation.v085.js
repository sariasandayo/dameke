// v0.85 integrated app switch report
(function(){
  if(!window.DAMEKE_DATA) window.DAMEKE_DATA = {};
  function scripts(){
    return Array.prototype.slice.call(document.scripts || []).map(function(s){ return s.getAttribute('src') || ''; }).filter(Boolean);
  }
  window.DAMEKE_DATA.v085IntegratedAppSwitchReport = function(){
    var list = scripts();
    var hasIntegrated = list.indexOf('app.integrated.v084.js') >= 0;
    var hasSeparateApp = list.indexOf('app.js') >= 0;
    var hasSeparateUi = list.indexOf('app.ui.v082.js') >= 0;
    var missing = [];
    if(!hasIntegrated) missing.push('app.integrated.v084.js');
    return {
      version: 'v0.85',
      loaded: true,
      integratedAppLoaded: hasIntegrated,
      separateAppLoaded: hasSeparateApp,
      separateUiLoaded: hasSeparateUi,
      oldSeparateScriptsStillLoaded: list.filter(function(x){ return x === 'app.js' || x === 'app.ui.v082.js'; }),
      missingExpected: missing,
      appIntegratedDiagnostic: window.DAMEKE_APP_INTEGRATED_V084_CANDIDATE || null,
      canProceedToV086: hasIntegrated && !hasSeparateApp && !hasSeparateUi && missing.length === 0,
      note: 'v0.85 switches index.html from app.js + app.ui.v082.js to app.integrated.v084.js. No calculation or UI logic is intentionally changed.'
    };
  };
})();
