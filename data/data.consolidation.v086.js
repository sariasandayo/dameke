// v0.86 finalized integrated app report
(function(){
  if(!window.DAMEKE_DATA) window.DAMEKE_DATA = {};
  function scripts(){
    return Array.prototype.slice.call(document.scripts || []).map(function(s){ return s.getAttribute('src') || ''; }).filter(Boolean);
  }
  window.DAMEKE_DATA.v086FinalizedAppReport = function(){
    var list = scripts();
    var hasApp = list.indexOf('app.js') >= 0;
    var hasIntegratedCandidate = list.indexOf('app.integrated.v084.js') >= 0;
    var hasOldUi = list.indexOf('app.ui.v082.js') >= 0;
    var missing = [];
    if(!hasApp) missing.push('app.js');
    return {
      version: 'v0.86',
      loaded: true,
      formalAppLoaded: hasApp,
      integratedCandidateStillLoaded: hasIntegratedCandidate,
      oldUiStillLoaded: hasOldUi,
      oldSeparateScriptsStillLoaded: list.filter(function(x){ return x === 'app.ui.v082.js' || x === 'app.integrated.v084.js'; }),
      missingExpected: missing,
      canProceedToArchiveOldUi: hasApp && !hasIntegratedCandidate && !hasOldUi && missing.length === 0,
      nextRecommended: 'v0.87 archive old app.ui.v082.js and app.integrated.v084.js, then v0.88 form-change UI.',
      note: 'v0.86 makes the integrated app candidate the formal app.js. Calculation/UI behavior should remain unchanged.'
    };
  };
})();
