// v0.87 old UI/editor candidate archive readiness report
(function(){
  if(!window.DAMEKE_DATA) window.DAMEKE_DATA = {};
  function scripts(){
    return Array.prototype.slice.call(document.scripts || []).map(function(s){ return s.getAttribute('src') || ''; }).filter(Boolean);
  }
  window.DAMEKE_DATA.v087OldUiArchiveReadinessReport = function(){
    var list = scripts();
    var oldLoaded = list.filter(function(x){ return x === 'app.ui.v082.js' || x === 'app.integrated.v084.js'; });
    var appLoaded = list.indexOf('app.js') >= 0;
    return {
      version: 'v0.87',
      loaded: true,
      formalAppLoaded: appLoaded,
      oldUiOrCandidateStillLoaded: oldLoaded,
      safeToArchiveOldUiCandidate: appLoaded && oldLoaded.length === 0,
      archiveCandidates: ['app.ui.v082.js', 'app.integrated.v084.js'],
      note: 'v0.87 does not move files by itself. Use tools/archive_v087_old_ui_candidate.js after this report is safe.'
    };
  };
})();
