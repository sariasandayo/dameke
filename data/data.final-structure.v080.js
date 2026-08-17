// v0.80 final structure checkpoint before UI work
(function(){
  var root = typeof window !== 'undefined' ? window : this;
  var D = root.DAMEKE_DATA = root.DAMEKE_DATA || {};
  var expectedDataScripts = ["data/data.generated.js","data/data.fixups.v075.js","data/data.validation.v077.js","data/data.consolidation.v078.js","data/data.consolidation.v079.js","data/data.final-structure.v080.js"];
  var expectedRuntimeScripts = ["runtime/calc.runtime.fix.v063.js"];
  function currentScripts(){ var out=[]; var scripts=document.getElementsByTagName('script'); for(var i=0;i<scripts.length;i++){ var src=scripts[i].getAttribute('src')||''; if(src) out.push(src); } return out; }
  function hasScript(src){ var cur=currentScripts(); for(var i=0;i<cur.length;i++){ if(cur[i]===src) return true; } return false; }
  function dataScripts(){ var cur=currentScripts(), out=[]; for(var i=0;i<cur.length;i++){ if(String(cur[i]).slice(0,5)==='data/') out.push(cur[i]); } return out; }
  function runtimeScripts(){ var cur=currentScripts(), out=[]; for(var i=0;i<cur.length;i++){ if(String(cur[i]).slice(0,8)==='runtime/') out.push(cur[i]); } return out; }
  function missing(list){ var out=[]; for(var i=0;i<list.length;i++){ if(!hasScript(list[i])) out.push(list[i]); } return out; }
  function unexpectedData(){ var cur=dataScripts(), out=[]; for(var i=0;i<cur.length;i++){ var ok=false; for(var j=0;j<expectedDataScripts.length;j++){ if(cur[i]===expectedDataScripts[j]){ ok=true; break; } } if(!ok) out.push(cur[i]); } return out; }
  function orderMismatches(){ var cur=dataScripts(), out=[], last=-1; for(var i=0;i<expectedDataScripts.length;i++){ var idx=-1; for(var j=0;j<cur.length;j++){ if(cur[j]===expectedDataScripts[i]){ idx=j; break; } } if(idx<0) continue; if(idx<last) out.push({script:expectedDataScripts[i], actualIndex:idx, shouldBeAfterIndex:last}); if(idx>last) last=idx; } return out; }
  D.v080FinalStructureReport = function(){
    var missData = missing(expectedDataScripts);
    var missRuntime = missing(expectedRuntimeScripts);
    var unexpected = unexpectedData();
    var order = orderMismatches();
    var v060 = !!(D.v060IntegrationValidationReport && D.v060IntegrationValidationReport().ok);
    var v061 = D.v061BattleDataValidationReport ? D.v061BattleDataValidationReport().summary : null;
    var v078 = D.v078ValidationSwitchReport ? D.v078ValidationSwitchReport().canProceedToV079 : null;
    var v079 = D.v079ArchiveReadinessReport ? D.v079ArchiveReadinessReport().safeToArchiveSupersededDataScripts : null;
    return {version:'v0.80', loaded:true, dataScripts:dataScripts(), runtimeScripts:runtimeScripts(), missingDataScripts:missData, missingRuntimeScripts:missRuntime, unexpectedDataScripts:unexpected, orderMismatches:order, v060Ok:v060, v061Summary:v061, v078Ok:v078, v079Ok:v079, readyForUiPlanning: missData.length===0 && missRuntime.length===0 && unexpected.length===0 && order.length===0 && v060 && !!(v061 && v061.failures===0) && !!v078 && !!v079, pcMobileUiDirection:{pc:'two-column or multi-pane layout with persistent result area', mobile:'single-column accordion sections with sticky summary result'}, keepNow:['index.html','style.css','app.js','calc.js','data.js','data/data.generated.js','data/data.fixups.v075.js','data/data.validation.v077.js','data/data.consolidation.v078.js','data/data.consolidation.v079.js','data/data.final-structure.v080.js','runtime/calc.runtime.fix.v063.js','tools/extract_dameke_excel_data_node.js','tools/archive_v072_unused_files.js','tools/archive_v079_superseded_data_scripts.js','archive/ until external backup and stability confirmation'], note:'v0.80 is the final structure checkpoint before UI and responsive design work.'};
  };
})();
