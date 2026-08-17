// v0.79 superseded data archive checkpoint helper
(function(){
  var root = typeof window !== 'undefined' ? window : this;
  var D = root.DAMEKE_DATA = root.DAMEKE_DATA || {};
  var superseded = ["data/data.generated.merge.v054.moves.js","data/data.generated.merge.v055.pokemons.js","data/data.generated.merge.v056.abilities.js","data/data.generated.merge.v057.items.js","data/data.generated.merge.v058.zmax.js","data/data.generated.fix.v059.js","data/data.generated.fix.v062.js","data/data.generated.defaults.v059b.js","data/data.generated.fix.v059c.js","data/data.generated.fix.v060b.js","data/data.generated.fix.v060c.js","data/data.generated.validation.v061.js","data/data.structure.v070.js","data/data.structure.v073.js","data/data.consolidation.v074.js","data/data.consolidation.v075.js","data/data.loader.v076.js","data/data.consolidation.v076.js","data/data.consolidation.v077.js"];
  D.v079ArchiveReadinessReport = function(){
    var scripts = Array.prototype.slice.call(document.scripts || []).map(function(s){ return s.getAttribute('src') || ''; }).filter(Boolean);
    var referenced = superseded.filter(function(s){ return scripts.indexOf(s) >= 0; });
    var v060 = !!(D.v060IntegrationValidationReport && D.v060IntegrationValidationReport().ok);
    var v061 = D.v061BattleDataValidationReport ? D.v061BattleDataValidationReport().summary : null;
    var v078 = D.v078ValidationSwitchReport ? D.v078ValidationSwitchReport().canProceedToV079 : null;
    return {
      version: 'v0.79',
      loaded: true,
      dataScripts: scripts.filter(function(s){ return /^data\//.test(s); }),
      runtimeScripts: scripts.filter(function(s){ return /^runtime\//.test(s); }),
      referencedSupersededScripts: referenced,
      v060Ok: v060,
      v061Summary: v061,
      v078Ok: v078,
      safeToArchiveSupersededDataScripts: referenced.length === 0 && v060 && !!(v061 && v061.failures === 0) && !!v078,
      expectedMainDataScripts: ['data/data.generated.js','data/data.fixups.v075.js','data/data.validation.v077.js','data/data.consolidation.v078.js','data/data.consolidation.v079.js'],
      note: 'If safeToArchiveSupersededDataScripts is true, run tools/archive_v079_superseded_data_scripts.js first dry-run, then --apply.'
    };
  };
})();
