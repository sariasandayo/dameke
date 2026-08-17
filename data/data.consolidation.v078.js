// v0.78 validation consolidation switch helper
(function(){
  var root = typeof window !== 'undefined' ? window : this;
  var D = root.DAMEKE_DATA = root.DAMEKE_DATA || {};
  var oldValidationScripts = ["data/data.generated.validation.v061.js","data/data.structure.v070.js","data/data.structure.v073.js","data/data.consolidation.v074.js","data/data.consolidation.v075.js","data/data.loader.v076.js","data/data.consolidation.v076.js","data/data.consolidation.v077.js"];
  var expectedDataScripts = ['data/data.generated.js','data/data.fixups.v075.js','data/data.validation.v077.js','data/data.consolidation.v078.js'];
  function currentScripts(){ var out=[]; var scripts=document.getElementsByTagName('script'); for(var i=0;i<scripts.length;i++){ var src=scripts[i].getAttribute('src')||''; if(src) out.push(src); } return out; }
  function hasScript(src){ var cur=currentScripts(); for(var i=0;i<cur.length;i++){ if(cur[i]===src) return true; } return false; }
  function dataScripts(){ var cur=currentScripts(), out=[]; for(var i=0;i<cur.length;i++){ if(String(cur[i]).slice(0,5)==='data/') out.push(cur[i]); } return out; }
  function runtimeScripts(){ var cur=currentScripts(), out=[]; for(var i=0;i<cur.length;i++){ if(String(cur[i]).slice(0,8)==='runtime/') out.push(cur[i]); } return out; }
  function oldScriptsStillLoaded(){ var out=[]; for(var i=0;i<oldValidationScripts.length;i++){ if(hasScript(oldValidationScripts[i])) out.push(oldValidationScripts[i]); } return out; }
  function missingExpected(){ var out=[]; for(var i=0;i<expectedDataScripts.length;i++){ if(!hasScript(expectedDataScripts[i])) out.push(expectedDataScripts[i]); } return out; }
  function orderMismatches(){ var cur=dataScripts(), out=[], last=-1; for(var i=0;i<expectedDataScripts.length;i++){ var src=expectedDataScripts[i]; var idx=-1; for(var j=0;j<cur.length;j++){ if(cur[j]===src){ idx=j; break; } } if(idx<0) continue; if(idx<last) out.push({script:src, actualIndex:idx, shouldBeAfterIndex:last}); if(idx>last) last=idx; } return out; }
  D.v078ValidationSwitchReport = function(){
    var miss=missingExpected(); var old=oldScriptsStillLoaded(); var order=orderMismatches();
    var v060 = !!(D.v060IntegrationValidationReport && D.v060IntegrationValidationReport().ok);
    var v061 = D.v061BattleDataValidationReport ? D.v061BattleDataValidationReport().summary : null;
    return {version:'v0.78', loaded:true, dataScripts:dataScripts(), runtimeScripts:runtimeScripts(), expectedDataScripts:expectedDataScripts.slice(0), candidateLoaded:hasScript('data/data.validation.v077.js'), oldValidationScriptsStillLoaded:old, missingExpected:miss, orderMismatches:order, v060Ok:v060, v061Summary:v061, canProceedToV079: miss.length===0 && old.length===0 && order.length===0 && hasScript('data/data.validation.v077.js') && v060 && !!(v061 && v061.failures===0), note:'v0.78 switches index.html from individual validation/structure/loader helper scripts to data/data.validation.v077.js.'};
  };
})();
