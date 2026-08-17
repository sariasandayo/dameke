function ability(name, kind) { return { id: name, name, kind: kind || 'Generic', ignorableByMoldBreaker: ['てんねん','ふゆう','ふしぎなまもり','カブトアーマー','シェルアーマー'].includes(name) }; }
const TYPES = ['なし','ノーマル','ほのお','みず','でんき','くさ','こおり','かくとう','どく','じめん','ひこう','エスパー','むし','いわ','ゴースト','ドラゴン','あく','はがね','フェアリー','ステラ'];
window.DAMEKE_DATA = {
  typeOptions: ['なし','タイプなし','ノーマル','ほのお','みず','でんき','くさ','こおり','かくとう','どく','じめん','ひこう','エスパー','むし','いわ','ゴースト','ドラゴン','あく','はがね','フェアリー'].map(x => ({ id:x, name:x })),
  teraTypes: TYPES.map(x => ({ id: x, name: x })),
  weatherOptions: ['なし','にほんばれ','あめ','すなあらし','ゆき','おおひでり','おおあめ','らんきりゅう','ノーてんき・エアロック'].map(x => ({ id:x, name:x })),
  fieldOptions: ['なし','エレキフィールド','グラスフィールド','ミストフィールド','サイコフィールド'].map(x => ({ id:x, name:x })),
  pokemons: [
    { id:'pikachu', name:'ピカチュウ', types:['でんき'], baseStats:{H:35,A:55,B:40,C:50,D:50,S:90} },
    { id:'venusaur', name:'フシギバナ', types:['くさ','どく'], baseStats:{H:80,A:82,B:83,C:100,D:100,S:80} },
    { id:'charizard', name:'リザードン', types:['ほのお','ひこう'], baseStats:{H:78,A:84,B:78,C:109,D:85,S:100} },
    { id:'solgaleo', name:'ソルガレオ', types:['エスパー','はがね'], baseStats:{H:137,A:137,B:107,C:113,D:89,S:97} },
    { id:'tauros', name:'ケンタロス', types:['ノーマル'], baseStats:{H:75,A:100,B:95,C:40,D:70,S:110} },
    { id:'tauros_combat', name:'ケンタロス(コンバット種)', types:['かくとう'], baseStats:{H:75,A:110,B:105,C:30,D:70,S:100} },
    { id:'tauros_blaze', name:'ケンタロス(ブレイズ種)', types:['かくとう','ほのお'], baseStats:{H:75,A:110,B:105,C:30,D:70,S:100} },
    { id:'tauros_aqua', name:'ケンタロス(ウォーター種)', types:['かくとう','みず'], baseStats:{H:75,A:110,B:105,C:30,D:70,S:100} },
    { id:'morpeko_full', name:'モルペコ(まんぷくもよう)', types:['でんき','あく'], baseStats:{H:58,A:95,B:58,C:70,D:58,S:97} },
    { id:'morpeko_hangry', name:'モルペコ(はらぺこもよう)', types:['でんき','あく'], baseStats:{H:58,A:95,B:58,C:70,D:58,S:97} },
    { id:'ogerpon_green', name:'オーガポン(みどり)', types:['くさ'], baseStats:{H:80,A:120,B:84,C:60,D:96,S:110} },
    { id:'ogerpon_wellspring', name:'オーガポン(いど)', types:['くさ','みず'], baseStats:{H:80,A:120,B:84,C:60,D:96,S:110} },
    { id:'ogerpon_hearthflame', name:'オーガポン(かまど)', types:['くさ','ほのお'], baseStats:{H:80,A:120,B:84,C:60,D:96,S:110} },
    { id:'ogerpon_cornerstone', name:'オーガポン(いしずえ)', types:['くさ','いわ'], baseStats:{H:80,A:120,B:84,C:60,D:96,S:110} },
    { id:'zacian_crowned', name:'ザシアン(けんのおう)', types:['フェアリー','はがね'], baseStats:{H:92,A:150,B:115,C:80,D:115,S:148}, cannotDynamax:true }
  ],
  moves: [
    {id:'thunderbolt',name:'10まんボルト',type:'でんき',category:'特殊',power:90,contact:false},
    {id:'tackle',name:'たいあたり',type:'ノーマル',category:'物理',power:40,contact:true},
    {id:'struggle',name:'わるあがき',type:'ノーマル',category:'物理',power:50,contact:true},
    {id:'sunsteel',name:'メテオドライブ',type:'はがね',category:'物理',power:100,contact:true,ignoresAbilities:true},
    {id:'photon',name:'フォトンゲイザー',type:'エスパー',category:'特殊',power:100,contact:false,ignoresAbilities:true},
    {id:'light_that_burns',name:'てんこがすめつぼうのひかり',type:'エスパー',category:'特殊',power:200,contact:false,ignoresAbilities:true},
    {id:'tera_blast',name:'テラバースト',type:'ノーマル',category:'特殊',power:80,contact:false},
    {id:'tera_cluster',name:'テラクラスター',type:'ノーマル',category:'特殊',power:120,contact:false},
    {id:'shell_side_arm',name:'シェルアームズ',type:'どく',category:'特殊',power:90,contact:false},
    {id:'weather_ball',name:'ウェザーボール',type:'ノーマル',category:'特殊',power:50,contact:false},
    {id:'judgment',name:'さばきのつぶて',type:'ノーマル',category:'特殊',power:100,contact:false},
    {id:'natural_gift',name:'しぜんのめぐみ',type:'ノーマル',category:'物理',power:80,contact:false},
    {id:'terrain_pulse',name:'だいちのはどう',type:'ノーマル',category:'特殊',power:50,contact:false},
    {id:'multi_attack',name:'マルチアタック',type:'ノーマル',category:'物理',power:120,contact:true},
    {id:'revelation_dance',name:'めざめるダンス',type:'ノーマル',category:'特殊',power:90,contact:false},
    {id:'hidden_power',name:'めざめるパワー',type:'ノーマル',category:'特殊',power:60,contact:false},
    {id:'techno_blast',name:'テクノバスター',type:'ノーマル',category:'特殊',power:120,contact:false},
    {id:'raging_bull',name:'レイジングブル',type:'ノーマル',category:'物理',power:90,contact:true},
    {id:'aura_wheel',name:'オーラぐるま',type:'でんき',category:'物理',power:110,contact:true},
    {id:'ivy_cudgel',name:'ツタこんぼう',type:'くさ',category:'物理',power:100,contact:true},
    {id:'grass_pledge',name:'くさのちかい',type:'くさ',category:'特殊',power:80,contact:false},
    {id:'fire_pledge',name:'ほのおのちかい',type:'ほのお',category:'特殊',power:80,contact:false},
    {id:'water_pledge',name:'みずのちかい',type:'みず',category:'特殊',power:80,contact:false},
    {id:'hyper_voice',name:'ハイパーボイス',type:'ノーマル',category:'特殊',power:90,contact:false,sound:true},
    {id:'sacred_sword',name:'せいなるつるぎ',type:'かくとう',category:'物理',power:90,contact:true},
    {id:'darkest_lariat',name:'DDラリアット',type:'あく',category:'物理',power:85,contact:true},
    {id:'chip_away',name:'なしくずし',type:'ノーマル',category:'物理',power:70,contact:true},
    {id:'foul_play',name:'イカサマ',type:'あく',category:'物理',power:95,contact:true},
    {id:'night_shade',name:'ナイトヘッド',type:'ゴースト',category:'特殊',power:null,contact:false,damageKind:'AttackerLevel'}
  ],
  items: [
    {id:'none',name:'なし',kind:'None'}, {id:'ability_shield',name:'とくせいガード',kind:'AbilityProtection'},
    {id:'heavy_duty_boots',name:'あつぞこブーツ',kind:'HazardImmune'}, {id:'iron_ball',name:'くろいてっきゅう',kind:'Grounding'}, {id:'air_balloon',name:'ふうせん',kind:'Floating'},
    {id:'utility_umbrella',name:'ばんのうがさ',kind:'WeatherIgnore'},
    {id:'flame_plate',name:'ひのたまプレート',kind:'Plate',type:'ほのお'}, {id:'splash_plate',name:'しずくプレート',kind:'Plate',type:'みず'}, {id:'zap_plate',name:'いかずちプレート',kind:'Plate',type:'でんき'}, {id:'meadow_plate',name:'みどりのプレート',kind:'Plate',type:'くさ'}, {id:'icicle_plate',name:'つららのプレート',kind:'Plate',type:'こおり'}, {id:'fist_plate',name:'こぶしのプレート',kind:'Plate',type:'かくとう'}, {id:'toxic_plate',name:'もうどくプレート',kind:'Plate',type:'どく'}, {id:'earth_plate',name:'だいちのプレート',kind:'Plate',type:'じめん'}, {id:'sky_plate',name:'あおぞらプレート',kind:'Plate',type:'ひこう'}, {id:'mind_plate',name:'ふしぎのプレート',kind:'Plate',type:'エスパー'}, {id:'insect_plate',name:'たまむしプレート',kind:'Plate',type:'むし'}, {id:'stone_plate',name:'がんせきプレート',kind:'Plate',type:'いわ'}, {id:'spooky_plate',name:'もののけプレート',kind:'Plate',type:'ゴースト'}, {id:'draco_plate',name:'りゅうのプレート',kind:'Plate',type:'ドラゴン'}, {id:'dread_plate',name:'こわもてプレート',kind:'Plate',type:'あく'}, {id:'iron_plate',name:'こうてつプレート',kind:'Plate',type:'はがね'}, {id:'pixie_plate',name:'せいれいプレート',kind:'Plate',type:'フェアリー'},
    {id:'fire_memory',name:'ファイヤーメモリ',kind:'Memory',type:'ほのお'}, {id:'water_memory',name:'ウオーターメモリ',kind:'Memory',type:'みず'}, {id:'electric_memory',name:'エレクトロメモリ',kind:'Memory',type:'でんき'}, {id:'grass_memory',name:'グラスメモリ',kind:'Memory',type:'くさ'}, {id:'ice_memory',name:'アイスメモリ',kind:'Memory',type:'こおり'}, {id:'fighting_memory',name:'ファイトメモリ',kind:'Memory',type:'かくとう'}, {id:'poison_memory',name:'ポイズンメモリ',kind:'Memory',type:'どく'}, {id:'ground_memory',name:'グラウンドメモリ',kind:'Memory',type:'じめん'}, {id:'flying_memory',name:'フライングメモリ',kind:'Memory',type:'ひこう'}, {id:'psychic_memory',name:'サイキックメモリ',kind:'Memory',type:'エスパー'}, {id:'bug_memory',name:'バグメモリ',kind:'Memory',type:'むし'}, {id:'rock_memory',name:'ロックメモリ',kind:'Memory',type:'いわ'}, {id:'ghost_memory',name:'ゴーストメモリ',kind:'Memory',type:'ゴースト'}, {id:'dragon_memory',name:'ドラゴンメモリ',kind:'Memory',type:'ドラゴン'}, {id:'dark_memory',name:'ダークメモリ',kind:'Memory',type:'あく'}, {id:'steel_memory',name:'スチールメモリ',kind:'Memory',type:'はがね'}, {id:'fairy_memory',name:'フェアリーメモリ',kind:'Memory',type:'フェアリー'},
    {id:'burn_drive',name:'ブレイズカセット',kind:'Drive',type:'ほのお'}, {id:'douse_drive',name:'アクアカセット',kind:'Drive',type:'みず'}, {id:'shock_drive',name:'イナズマカセット',kind:'Drive',type:'でんき'}, {id:'chill_drive',name:'フリーズカセット',kind:'Drive',type:'こおり'},
    {id:'sitrus',name:'オボンのみ',kind:'Berry',isBerry:true,naturalGiftType:'エスパー'}, {id:'cheri',name:'クラボのみ',kind:'Berry',isBerry:true,naturalGiftType:'ほのお'}, {id:'chesto',name:'カゴのみ',kind:'Berry',isBerry:true,naturalGiftType:'みず'}, {id:'pecha',name:'モモンのみ',kind:'Berry',isBerry:true,naturalGiftType:'でんき'}, {id:'rawst',name:'チーゴのみ',kind:'Berry',isBerry:true,naturalGiftType:'くさ'}, {id:'aspear',name:'ナナシのみ',kind:'Berry',isBerry:true,naturalGiftType:'こおり'}
  ],
  abilities: [ability('かがくへんかガス','NeutralizingGas'), ability('ぎたい','Mimicry'), ability('てんきや','Forecast'), ability('ARシステム','RKSSystem'), ability('マルチタイプ','Multitype'), ability('なし','None'), ability('ぶきよう','ItemSuppress'), ability('きんちょうかん','BerrySuppressOpponent'), ability('かたやぶり','MoldBreakerEffect'), ability('てんねん'), ability('ふゆう','Levitate'), ability('うなぎのぼり','Levitate'), ability('マジックガード','HazardImmune'), ability('ノーてんき','IgnoreWeather'), ability('エアロック','IgnoreWeather'), ability('ノーマルスキン','Normalize'), ability('エレキスキン','Skin'), ability('スカイスキン','Skin'), ability('ドラゴンスキン','Skin'), ability('フェアリースキン','Skin'), ability('フリーズスキン','Skin'), ability('うるおいボイス','LiquidVoice'), ability('カブトアーマー','CriticalBlock'), ability('シェルアーマー','CriticalBlock'), ability('しんがん','IgnoreEvasion'), ability('するどいめ','IgnoreEvasion'), ability('はっこう','IgnoreEvasion')],
  specialStates: [{id:'none',name:'なし',kind:'none'}, {id:'zmove',name:'Zワザ',kind:'zmove'}, {id:'special_z',name:'専用Z',kind:'special_z'}, {id:'dynamax',name:'ダイマックス',kind:'dynamax'}, {id:'gmax',name:'キョダイマックス',kind:'gmax'}],
  typeChart4096: { 'ノーマル':{'ゴースト':0}, 'でんき':{'じめん':0,'くさ':2048,'でんき':2048,'みず':8192,'ひこう':8192}, 'ほのお':{'くさ':8192,'こおり':8192,'むし':8192,'はがね':8192,'ほのお':2048,'みず':2048,'いわ':2048,'ドラゴン':2048}, 'みず':{'ほのお':8192,'じめん':8192,'いわ':8192,'みず':2048,'くさ':2048,'ドラゴン':2048}, 'くさ':{'みず':8192,'じめん':8192,'いわ':8192,'ほのお':2048,'くさ':2048,'どく':2048,'ひこう':2048,'むし':2048,'ドラゴン':2048,'はがね':2048}, 'こおり':{'くさ':8192,'じめん':8192,'ひこう':8192,'ドラゴン':8192,'ほのお':2048,'みず':2048,'こおり':2048,'はがね':2048}, 'はがね':{'いわ':8192,'こおり':8192,'フェアリー':8192,'ほのお':2048,'みず':2048,'でんき':2048,'はがね':2048}, 'いわ':{'ほのお':8192,'こおり':8192,'ひこう':8192,'むし':8192,'かくとう':2048,'じめん':2048,'はがね':2048}, 'ゴースト':{'ノーマル':0,'ゴースト':8192,'エスパー':8192,'あく':2048}, 'かくとう':{'ノーマル':8192,'こおり':8192,'いわ':8192,'あく':8192,'はがね':8192,'どく':2048,'ひこう':2048,'エスパー':2048,'むし':2048,'フェアリー':2048,'ゴースト':0}, 'ひこう':{'くさ':8192,'かくとう':8192,'むし':8192,'でんき':2048,'いわ':2048,'はがね':2048}, 'エスパー':{'かくとう':8192,'どく':8192,'エスパー':2048,'はがね':2048,'あく':0}, 'どく':{'くさ':8192,'フェアリー':8192,'どく':2048,'じめん':2048,'いわ':2048,'ゴースト':2048,'はがね':0}, 'じめん':{'ほのお':8192,'でんき':8192,'どく':8192,'いわ':8192,'はがね':8192,'くさ':2048,'むし':2048,'ひこう':0}, 'あく':{'エスパー':8192,'ゴースト':8192,'かくとう':2048,'あく':2048,'フェアリー':2048}, 'ドラゴン':{'ドラゴン':8192,'はがね':2048,'フェアリー':0}, 'フェアリー':{'かくとう':8192,'ドラゴン':8192,'あく':8192,'ほのお':2048,'どく':2048,'はがね':2048} },
  zMax: { zByType:{'でんき':'スパーキングギガボルト','ノーマル':'ウルトラダッシュアタック','はがね':'ちょうぜつらせんれんげき','くさ':'ブルームシャインエクストラ','ゴースト':'むげんあんやへのいざない'}, maxByType:{'でんき':'ダイサンダー','ノーマル':'ダイアタック','はがね':'ダイスチル','くさ':'ダイソウゲン','ゴースト':'ダイホロウ'}, signatureZ:[{pokemon:['ソルガレオ'],move:'メテオドライブ',name:'サンシャインスマッシャー',type:'はがね',category:'物理',power:200,ignoresAbilities:true}], gmax:[] }
};


// v0.16 power variation additions
(function(){
  const D = window.DAMEKE_DATA;
  if(!D || D.__powerVariationDataPatched) return;
  function upsertMove(m){ const i=D.moves.findIndex(x=>x.id===m.id || x.name===m.name); if(i>=0) D.moves[i]=Object.assign({}, D.moves[i], m); else D.moves.push(m); }
  function setPowerKind(name, powerKind, props){ const m=D.moves.find(x=>x.name===name); if(m) Object.assign(m, props||{}, {powerKind}); }
  const moves = [
    {id:'g_force',name:'Gのちから',type:'くさ',category:'物理',power:90,contact:true,powerKind:'GForce'},
    {id:'ice_ball',name:'アイスボール',type:'こおり',category:'物理',power:30,contact:true,powerKind:'Rollout'},
    {id:'rollout',name:'ころがる',type:'いわ',category:'物理',power:30,contact:true,powerKind:'Rollout'},
    {id:'acrobatics',name:'アクロバット',type:'ひこう',category:'物理',power:55,contact:true,powerKind:'Acrobatics'},
    {id:'stored_power',name:'アシストパワー',type:'エスパー',category:'特殊',power:20,powerKind:'PositiveRankUser'},
    {id:'power_trip',name:'つけあがる',type:'あく',category:'物理',power:20,contact:true,powerKind:'PositiveRankUser'},
    {id:'echoed_voice',name:'エコーボイス',type:'ノーマル',category:'特殊',power:40,sound:true,powerKind:'EchoedVoice'},
    {id:'fishious_rend',name:'エラがみ',type:'みず',category:'物理',power:85,contact:true,powerKind:'DoubleIfFirst'},
    {id:'bolt_beak',name:'でんげきくちばし',type:'でんき',category:'物理',power:85,contact:true,powerKind:'DoubleIfFirst'},
    {id:'electro_ball',name:'エレキボール',type:'でんき',category:'特殊',power:null,powerKind:'ElectroBall'},
    {id:'pursuit',name:'おいうち',type:'あく',category:'物理',power:40,contact:true,powerKind:'Pursuit'},
    {id:'punishment',name:'おしおき',type:'あく',category:'物理',power:60,contact:true,powerKind:'PositiveRankTarget'},
    {id:'last_respects',name:'おはかまいり',type:'ゴースト',category:'物理',power:50,contact:true,powerKind:'LastRespects'},
    {id:'return',name:'おんがえし',type:'ノーマル',category:'物理',power:null,contact:true,powerKind:'Friendship'},
    {id:'frustration',name:'やつあたり',type:'ノーマル',category:'物理',power:null,contact:true,powerKind:'Frustration'},
    {id:'gust',name:'かぜおこし',type:'ひこう',category:'特殊',power:40,powerKind:'DoubleIfTargetFlying'},
    {id:'twister',name:'たつまき',type:'ドラゴン',category:'特殊',power:40,powerKind:'DoubleIfTargetFlying'},
    {id:'reversal',name:'きしかいせい',type:'かくとう',category:'物理',power:null,contact:true,powerKind:'Reversal'},
    {id:'flail',name:'じたばた',type:'ノーマル',category:'物理',power:null,contact:true,powerKind:'Reversal'},
    {id:'smelling_salts',name:'きつけ',type:'ノーマル',category:'物理',power:70,contact:true,powerKind:'DoubleIfTargetParalyzed'},
    {id:'trump_card',name:'きりふだ',type:'ノーマル',category:'特殊',power:null,powerKind:'TrumpCard'},
    {id:'grass_knot',name:'くさむすび',type:'くさ',category:'特殊',power:null,powerKind:'LowKick'},
    {id:'low_kick',name:'けたぐり',type:'かくとう',category:'物理',power:null,contact:true,powerKind:'LowKick'},
    {id:'water_spout',name:'しおふき',type:'みず',category:'特殊',power:150,powerKind:'UserHp150'},
    {id:'eruption',name:'ふんか',type:'ほのお',category:'特殊',power:150,powerKind:'UserHp150'},
    {id:'dragon_energy',name:'ドラゴンエナジー',type:'ドラゴン',category:'特殊',power:150,powerKind:'UserHp150'},
    {id:'stomping_tantrum',name:'じだんだ',type:'じめん',category:'物理',power:75,contact:true,powerKind:'DoubleIfLastMoveFailed'},
    {id:'temper_flare',name:'やけっぱち',type:'ほのお',category:'物理',power:75,contact:true,powerKind:'DoubleIfLastMoveFailed'},
    {id:'payback',name:'しっぺがえし',type:'あく',category:'物理',power:50,contact:true,powerKind:'DoubleIfMovedSecond'},
    {id:'wring_out',name:'しぼりとる',type:'ノーマル',category:'特殊',power:null,powerKind:'TargetHp120'},
    {id:'crush_grip',name:'にぎりつぶす',type:'ノーマル',category:'物理',power:null,contact:true,powerKind:'TargetHp120'},
    {id:'gyro_ball',name:'ジャイロボール',type:'はがね',category:'物理',power:null,contact:true,powerKind:'GyroBall'},
    {id:'hex',name:'たたりめ',type:'ゴースト',category:'特殊',power:65,powerKind:'DoubleIfTargetStatus'},
    {id:'assurance',name:'ダメおし',type:'あく',category:'物理',power:60,contact:true,powerKind:'DoubleIfTargetDamaged'},
    {id:'barb_barrage',name:'どくばりセンボン',type:'どく',category:'物理',power:60,powerKind:'DoubleIfTargetPoison'},
    {id:'triple_axel',name:'トリプルアクセル',type:'こおり',category:'物理',power:20,contact:true,powerKind:'TripleAxel',hitCount:3},
    {id:'triple_kick',name:'トリプルキック',type:'かくとう',category:'物理',power:10,contact:true,powerKind:'TripleKick',hitCount:3},
    {id:'fling',name:'なげつける',type:'あく',category:'物理',power:null,powerKind:'Fling'},
    {id:'hard_press',name:'ハードプレス',type:'はがね',category:'物理',power:null,contact:true,powerKind:'HardPress'},
    {id:'spit_up',name:'はきだす',type:'ノーマル',category:'特殊',power:null,powerKind:'SpitUp'},
    {id:'heat_crash',name:'ヒートスタンプ',type:'ほのお',category:'物理',power:null,contact:true,powerKind:'HeavySlam'},
    {id:'heavy_slam',name:'ヘビーボンバー',type:'はがね',category:'物理',power:null,contact:true,powerKind:'HeavySlam'},
    {id:'infernal_parade',name:'ひゃっきやこう',type:'ゴースト',category:'特殊',power:60,powerKind:'DoubleIfTargetStatus'},
    {id:'beat_up',name:'ふくろだたき',type:'あく',category:'物理',power:null,powerKind:'BeatUp'},
    {id:'present',name:'プレゼント',type:'ノーマル',category:'物理',power:null,powerKind:'Present'},
    {id:'rage_fist',name:'ふんどのこぶし',type:'ゴースト',category:'物理',power:50,contact:true,powerKind:'RageFist'},
    {id:'magnitude',name:'マグニチュード',type:'じめん',category:'物理',power:null,powerKind:'Magnitude'},
    {id:'water_shuriken',name:'みずしゅりけん',type:'みず',category:'特殊',power:15,powerKind:'WaterShuriken',hitCount:5},
    {id:'wake_up_slap',name:'めざましビンタ',type:'かくとう',category:'物理',power:70,contact:true,powerKind:'DoubleIfTargetSleep'},
    {id:'avalanche',name:'ゆきなだれ',type:'こおり',category:'物理',power:60,contact:true,powerKind:'DoubleIfUserDamaged'},
    {id:'revenge',name:'リベンジ',type:'かくとう',category:'物理',power:60,contact:true,powerKind:'DoubleIfUserDamaged'},
    {id:'round',name:'りんしょう',type:'ノーマル',category:'特殊',power:60,sound:true,powerKind:'Round'},
    {id:'fury_cutter',name:'れんぞくぎり',type:'むし',category:'物理',power:40,contact:true,powerKind:'FuryCutter'}
  ];
  moves.forEach(upsertMove);
  ['ウェザーボール','だいちのはどう','くさのちかい','ほのおのちかい','みずのちかい','テラバースト'].forEach(name=>{
    const m=D.moves.find(x=>x.name===name);
    if(m){
      if(name==='ウェザーボール')m.powerKind='WeatherBall';
      if(name==='だいちのはどう')m.powerKind='TerrainPulse';
      if(['くさのちかい','ほのおのちかい','みずのちかい'].includes(name))m.powerKind='Pledge';
      if(name==='テラバースト')m.powerKind='TeraBlast';
    }
  });
  const berry=D.items.find(x=>x.kind==='Berry'&&x.naturalGiftPower==null); if(berry) berry.naturalGiftPower=80;
  D.__powerVariationDataPatched=true;
})();


// v0.17 speed modifier additions
(function(){
  const D = window.DAMEKE_DATA;
  if(!D || D.__speedDataPatched) return;
  function upsert(list, obj){ const i=list.findIndex(x=>x.id===obj.id || x.name===obj.name); if(i>=0) list[i]=Object.assign({}, list[i], obj); else list.push(obj); }
  function ability(name, kind){ return { id:name, name:name, kind:kind || 'Generic', ignorableByMoldBreaker:false }; }
  D.abilities = D.abilities || [];
  [
    ability('ようりょくそ','Chlorophyll'), ability('すいすい','SwiftSwim'), ability('すなかき','SandRush'), ability('ゆきかき','SlushRush'),
    ability('サーフテール','SurgeSurfer'), ability('スロースタート','SlowStart'), ability('かるわざ','Unburden'), ability('はやあし','QuickFeet'),
    ability('こだいかっせい','Protosynthesis'), ability('クォークチャージ','QuarkDrive')
  ].forEach(a=>upsert(D.abilities,a));
  D.items = D.items || [];
  [
    {id:'speed_powder',name:'スピードパウダー',kind:'SpeedPowder'},
    {id:'choice_scarf',name:'こだわりスカーフ',kind:'ChoiceScarf'},
    {id:'macho_brace',name:'きょうせいギプス',kind:'SpeedHalve'},
    {id:'power_weight',name:'パワーウエイト',kind:'SpeedHalve'},
    {id:'power_bracer',name:'パワーリスト',kind:'SpeedHalve'},
    {id:'power_belt',name:'パワーベルト',kind:'SpeedHalve'},
    {id:'power_lens',name:'パワーレンズ',kind:'SpeedHalve'},
    {id:'power_band',name:'パワーバンド',kind:'SpeedHalve'},
    {id:'power_anklet',name:'パワーアンクル',kind:'SpeedHalve'}
  ].forEach(x=>upsert(D.items,x));
  D.pokemons = D.pokemons || [];
  upsert(D.pokemons,{id:'ditto',name:'メタモン',types:['ノーマル'],weight:4.0,baseStats:{H:48,A:48,B:48,C:48,D:48,S:48}});
  D.__speedDataPatched = true;
})();


// v0.17 speed modifier additions v2
(function(){
  const D = window.DAMEKE_DATA;
  if(!D || D.__speedDataPatchedV2) return;
  function upsert(list, obj){ const i=list.findIndex(x=>x.id===obj.id || x.name===obj.name); if(i>=0) list[i]=Object.assign({}, list[i], obj); else list.push(obj); }
  function ability(name, kind){ return { id:name, name:name, kind:kind || 'Generic', ignorableByMoldBreaker:false }; }
  D.abilities = D.abilities || [];
  [
    ability('ようりょくそ','Chlorophyll'), ability('すいすい','SwiftSwim'), ability('すなかき','SandRush'), ability('ゆきかき','SlushRush'),
    ability('サーフテール','SurgeSurfer'), ability('スロースタート','SlowStart'), ability('かるわざ','Unburden'), ability('はやあし','QuickFeet'),
    ability('こだいかっせい','Protosynthesis'), ability('クォークチャージ','QuarkDrive')
  ].forEach(a=>upsert(D.abilities,a));
  D.items = D.items || [];
  [
    {id:'speed_powder',name:'スピードパウダー',kind:'SpeedPowder'}, {id:'choice_scarf',name:'こだわりスカーフ',kind:'ChoiceScarf'},
    {id:'macho_brace',name:'きょうせいギプス',kind:'SpeedHalve'}, {id:'power_weight',name:'パワーウエイト',kind:'SpeedHalve'},
    {id:'power_bracer',name:'パワーリスト',kind:'SpeedHalve'}, {id:'power_belt',name:'パワーベルト',kind:'SpeedHalve'},
    {id:'power_lens',name:'パワーレンズ',kind:'SpeedHalve'}, {id:'power_band',name:'パワーバンド',kind:'SpeedHalve'},
    {id:'power_anklet',name:'パワーアンクル',kind:'SpeedHalve'}
  ].forEach(x=>upsert(D.items,x));
  D.pokemons = D.pokemons || [];
  upsert(D.pokemons,{id:'ditto',name:'メタモン',types:['ノーマル'],weight:4.0,baseStats:{H:48,A:48,B:48,C:48,D:48,S:48}});
  D.__speedDataPatchedV2 = true;
})();


// v0.18 calculated weight additions
(function(){
  const D = window.DAMEKE_DATA;
  if(!D || D.__weightDataPatched) return;
  function upsert(list,obj){ const i=list.findIndex(x=>x.id===obj.id || x.name===obj.name); if(i>=0) list[i]=Object.assign({}, list[i], obj); else list.push(obj); }
  function ability(name,kind){ return {id:name,name:name,kind:kind||'Generic',ignorableByMoldBreaker:false}; }
  D.abilities = D.abilities || [];
  [ability('ライトメタル','LightMetal'), ability('ヘヴィメタル','HeavyMetal'), ability('メガソーラー','MegaSolar')].forEach(a=>upsert(D.abilities,a));
  D.items = D.items || [];
  upsert(D.items,{id:'float_stone',name:'かるいし',kind:'WeightHalve'});
  D.pokemons = D.pokemons || [];
  const weights = {
    'ピカチュウ':6.0, 'フシギバナ':100.0, 'リザードン':90.5, 'ソルガレオ':230.0, 'ケンタロス':88.4,
    'ケンタロス(コンバット種)':115.0, 'ケンタロス(ブレイズ種)':85.0, 'ケンタロス(ウォーター種)':110.0,
    'モルペコ(まんぷくもよう)':3.0, 'モルペコ(はらぺこもよう)':3.0,
    'オーガポン(みどり)':39.8, 'オーガポン(いど)':39.8, 'オーガポン(かまど)':39.8, 'オーガポン(いしずえ)':39.8,
    'ザシアン(けんのおう)':355.0, 'メタモン':4.0
  };
  D.pokemons.forEach(p=>{ if(p.weight == null && weights[p.name] != null) p.weight = weights[p.name]; });
  upsert(D.pokemons,{id:'terapagos_tera',name:'テラパゴス(テラスタル)',types:['ノーマル'],weight:16.0,baseStats:{H:95,A:95,B:110,C:105,D:110,S:85}});
  D.__weightDataPatched = true;
})();


// v0.19 UI cleanup: keep ability "なし" first
(function(){
  const D = window.DAMEKE_DATA;
  if(!D || !Array.isArray(D.abilities) || D.__uiAbilitySorted) return;
  const none = D.abilities.filter(a => a && a.id === 'なし');
  const rest = D.abilities.filter(a => a && a.id !== 'なし');
  if(none.length) D.abilities = [none[0]].concat(rest);
  D.__uiAbilitySorted = true;
})();


// v0.20 multihit metadata
(function(){
  const D = window.DAMEKE_DATA;
  if(!D || D.__multiHitDataPatched) return;
  function patch(name, props){ const m=(D.moves||[]).find(x=>x.name===name); if(m) Object.assign(m, props); }
  patch('トリプルアクセル',{powerKind:'TripleAxel',hitCount:3});
  patch('トリプルキック',{powerKind:'TripleKick',hitCount:3});
  patch('みずしゅりけん',{powerKind:'WaterShuriken',hitCount:5});
  patch('ふくろだたき',{powerKind:'BeatUp',hitCountKind:'Party'});
  D.__multiHitDataPatched = true;
})();


// v0.21 Z / Dynamax / G-Max rule data
(function(){
  const D = window.DAMEKE_DATA;
  if(!D || D.__specialMoveDataPatched) return;
  D.zMax = D.zMax || {};
  D.zMax.zByType = Object.assign({
    'ノーマル':'ウルトラダッシュアタック','ほのお':'ダイナミックフルフレイム','みず':'スーパーアクアトルネード','でんき':'スパーキングギガボルト','くさ':'ブルームシャインエクストラ','こおり':'レイジングジオフリーズ','かくとう':'ぜんりょくむそうげきれつけん','どく':'アシッドポイズンデリート','じめん':'ライジンググランドオーバー','ひこう':'ファイナルダイブクラッシュ','エスパー':'マキシマムサイブレイカー','むし':'ぜったいほしょくかいてんざん','いわ':'ワールズエンドフォール','ゴースト':'むげんあんやへのいざない','ドラゴン':'アルティメットドラゴンバーン','あく':'ブラックホールイクリプス','はがね':'ちょうぜつらせんれんげき','フェアリー':'ラブリースターインパクト'
  }, D.zMax.zByType || {});
  D.zMax.maxByType = Object.assign({
    'ノーマル':'ダイアタック','ほのお':'ダイバーン','みず':'ダイストリーム','でんき':'ダイサンダー','くさ':'ダイソウゲン','こおり':'ダイアイス','かくとう':'ダイナックル','どく':'ダイアシッド','じめん':'ダイアース','ひこう':'ダイジェット','エスパー':'ダイサイコ','むし':'ダイワーム','いわ':'ダイロック','ゴースト':'ダイホロウ','ドラゴン':'ダイドラグーン','あく':'ダイアーク','はがね':'ダイスチル','フェアリー':'ダイフェアリー'
  }, D.zMax.maxByType || {});
  D.zMax.dynamaxBanned = ['ザシアン(れきせんのゆうしゃ)','ザシアン(けんのおう)','ザマゼンタ(れきせんのゆうしゃ)','ザマゼンタ(たてのおう)','ムゲンダイナ'];
  D.zMax.gmaxEligible = ['フシギバナ','リザードン','カメックス','バタフリー','ピカチュウ','ニャース','カイリキー','ゲンガー','キングラー','ラプラス','イーブイ','カビゴン','ダストダス','メルメタル','ゴリランダー','エースバーン','インテレオン','アーマーガア','イオルブ','カジリガメ','セキタンザン','アップリュー','タルップル','サダイジャ','ストリンダー','マルヤクデ','ブリムオン','オーロンゲ','マホイップ','ダイオウドウ','ジュラルドン','ウーラオス(いちげきのかた)','ウーラオス(れんげきのかた)'];
  D.zMax.gmaxByPokemonType = {
    'フシギバナ':{'くさ':'キョダイベンタツ'}, 'リザードン':{'ほのお':'キョダイゴクエン'}, 'カメックス':{'みず':'キョダイホウゲキ'}, 'バタフリー':{'むし':'キョダイコワク'},
    'ピカチュウ':{'でんき':'キョダイバンライ'}, 'ニャース':{'ノーマル':'キョダイコバン'}, 'カイリキー':{'かくとう':'キョダイシンゲキ'}, 'ゲンガー':{'ゴースト':'キョダイゲンエイ'},
    'キングラー':{'みず':'キョダイホウマツ'}, 'ラプラス':{'こおり':'キョダイセンリツ'}, 'イーブイ':{'ノーマル':'キョダイホーヨー'}, 'カビゴン':{'ノーマル':'キョダイサイセイ'},
    'ダストダス':{'どく':'キョダイシュウキ'}, 'メルメタル':{'はがね':'キョダイユウゲキ'}, 'ゴリランダー':{'くさ':'キョダイコランダ'}, 'エースバーン':{'ほのお':'キョダイカキュウ'},
    'インテレオン':{'みず':'キョダイソゲキ'}, 'アーマーガア':{'ひこう':'キョダイフウゲキ'}, 'イオルブ':{'エスパー':'キョダイテンドウ'}, 'カジリガメ':{'みず':'キョダイガンジン'},
    'セキタンザン':{'いわ':'キョダイフンセキ'}, 'アップリュー':{'くさ':'キョダイサンゲキ'}, 'タルップル':{'くさ':'キョダイカンロ'}, 'サダイジャ':{'じめん':'キョダイサジン'},
    'ストリンダー':{'でんき':'キョダイカンデン'}, 'マルヤクデ':{'ほのお':'キョダイヒャッカ'}, 'ブリムオン':{'フェアリー':'キョダイテンバツ'}, 'オーロンゲ':{'あく':'キョダイスイマ'},
    'マホイップ':{'フェアリー':'キョダイダンエン'}, 'ダイオウドウ':{'はがね':'キョダイコウジン'}, 'ジュラルドン':{'ドラゴン':'キョダイゲンスイ'},
    'ウーラオス(いちげきのかた)':{'あく':'キョダイイチゲキ'}, 'ウーラオス(れんげきのかた)':{'みず':'キョダイレンゲキ'}
  };
  D.zMax.signatureZ = [
    {pokemon:['ピカチュウ'],move:'ボルテッカー',name:'ひっさつのピカチュート',type:'でんき',category:'物理',power:210},
    {pokemon:['ジュナイパー'],move:'かげぬい',name:'シャドーアローズストライク',type:'ゴースト',category:'物理',power:180},
    {pokemon:['ガオガエン'],move:'DDラリアット',name:'ハイパーダーククラッシャー',type:'あく',category:'物理',power:180},
    {pokemon:['アシレーヌ'],move:'うたかたのアリア',name:'わだつみのシンフォニア',type:'みず',category:'特殊',power:195},
    {pokemon:['カプ・コケコ','カプ・テテフ','カプ・ブルル','カプ・レヒレ'],move:'しぜんのいかり',name:'ガーディアン・デ・アローラ',type:'フェアリー',category:'特殊',power:1,damageKind:'GuardianOfAlola'},
    {pokemon:['マーシャドー'],move:'シャドースチール',name:'しちせいだっこんたい',type:'ゴースト',category:'物理',power:195},
    {pokemon:['ライチュウ(アローラ)'],move:'10まんボルト',name:'ライトニングサーフライド',type:'でんき',category:'特殊',power:175},
    {pokemon:['カビゴン'],move:'ギガインパクト',name:'ほんきをだすこうげき',type:'ノーマル',category:'物理',power:210},
    {pokemon:['イーブイ'],move:'とっておき',name:'ナインエボルブースト',type:'ノーマル',category:'変化',power:null},
    {pokemon:['ミュウ'],move:'サイコキネシス',name:'オリジンズスーパーノヴァ',type:'エスパー',category:'特殊',power:185},
    {pokemon:['ピカチュウ(サトシ)'],move:'10まんボルト',name:'1000まんボルト',type:'でんき',category:'特殊',power:195},
    {pokemon:['ソルガレオ','ネクロズマ(たそがれのたてがみ)'],move:'メテオドライブ',name:'サンシャインスマッシャー',type:'はがね',category:'物理',power:200,ignoresAbilities:true},
    {pokemon:['ルナアーラ','ネクロズマ(あかつきのつばさ)'],move:'シャドーレイ',name:'ムーンライトブラスター',type:'ゴースト',category:'特殊',power:200,ignoresAbilities:true},
    {pokemon:['ネクロズマ(ウルトラネクロズマ)'],move:'フォトンゲイザー',name:'てんこがすめつぼうのひかり',type:'エスパー',category:'特殊',power:200,ignoresAbilities:true,categoryFromAC:true},
    {pokemon:['ミミッキュ'],move:'じゃれつく',name:'ぽかぼかフレンドタイム',type:'フェアリー',category:'物理',power:190},
    {pokemon:['ルガルガン'],move:'ストーンエッジ',name:'ラジアルエッジストーム',type:'いわ',category:'物理',power:190},
    {pokemon:['ジャラランガ'],move:'スケイルノイズ',name:'ブレイジングソウルビート',type:'ドラゴン',category:'特殊',power:185}
  ];
  D.__specialMoveDataPatched = true;
})();


// v0.22 power modifier data additions
(function(){
  const D = window.DAMEKE_DATA;
  if(!D || D.__powerModifierDataPatched) return;
  function upsert(list,obj){const i=list.findIndex(x=>x.id===obj.id || x.name===obj.name); if(i>=0) list[i]=Object.assign({},list[i],obj); else list.push(obj);}
  function ability(name,kind){return {id:name,name:name,kind:kind||'Generic',ignorableByMoldBreaker:false};}
  D.abilities = D.abilities || [];
  ['オーラブレイク','とうそうしん','すてみ','てつのこぶし','アナライズ','かたいツメ','すなのちから','ちからずく','パンクロック','ダークオーラ','フェアリーオーラ','がんじょうあご','テクニシャン','どくぼうそう','ねつぼうそう','メガランチャー','たいねつ','かんそうはだ'].forEach(n=>upsert(D.abilities,ability(n,n)));
  D.items = D.items || [];
  const typeItems = [
    ['silk_scarf','シルクのスカーフ','ノーマル'],['charcoal','もくたん','ほのお'],['mystic_water','しんぴのしずく','みず'],['magnet','じしゃく','でんき'],['miracle_seed','きせきのタネ','くさ'],['never_melt_ice','とけないこおり','こおり'],['black_belt','くろおび','かくとう'],['poison_barb','どくバリ','どく'],['soft_sand','やわらかいすな','じめん'],['sharp_beak','するどいくちばし','ひこう'],['twisted_spoon','まがったスプーン','エスパー'],['silver_powder','ぎんのこな','むし'],['hard_stone','かたいいし','いわ'],['spell_tag','のろいのおふだ','ゴースト'],['dragon_fang','りゅうのキバ','ドラゴン'],['black_glasses','くろいメガネ','あく'],['metal_coat','メタルコート','はがね'],['fairy_feather','ようせいのハネ','フェアリー'],['sea_incense','うしおのおこう','みず'],['wave_incense','さざなみのおこう','みず'],['rose_incense','おはなのおこう','くさ'],['odd_incense','あやしいおこう','エスパー'],['rock_incense','がんせきおこう','いわ']
  ];
  upsert(D.items,{id:'muscle_band',name:'ちからのハチマキ',kind:'PhysicalBoost'});
  upsert(D.items,{id:'wise_glasses',name:'ものしりメガネ',kind:'SpecialBoost'});
  upsert(D.items,{id:'soul_dew',name:'こころのしずく',kind:'SoulDew'});
  upsert(D.items,{id:'adamant_orb',name:'こんごうだま',kind:'AdamantOrb'});
  upsert(D.items,{id:'lustrous_orb',name:'しらたま',kind:'LustrousOrb'});
  upsert(D.items,{id:'griseous_orb',name:'はっきんだま',kind:'GriseousOrb'});
  typeItems.forEach(x=>upsert(D.items,{id:x[0],name:x[1],kind:'TypeBoost',type:x[2]}));
  ['ノーマル','ほのお','みず','でんき','くさ','こおり','かくとう','どく','じめん','ひこう','エスパー','むし','いわ','ゴースト','ドラゴン','あく','はがね','フェアリー'].forEach(t=>upsert(D.items,{id:'gem_'+t,name:t+'のジュエル',kind:'Gem',type:t}));
  function patchMove(name,props){const m=(D.moves||[]).find(x=>x.name===name); if(m) Object.assign(m,props);}
  ['マッハパンチ','しんそく','でんこうせっか','アクアジェット','ふいうち','かげうち','つぶて','バレットパンチ','こおりのつぶて'].forEach(n=>patchMove(n,{priority:1}));
  D.__powerModifierDataPatched = true;
})();


// v0.25 attack modifier data additions
(function(){
  const D = window.DAMEKE_DATA;
  if(!D || D.__attackModifierDataPatched) return;
  function upsert(list,obj){const i=list.findIndex(x=>x.id===obj.id || x.name===obj.name); if(i>=0) list[i]=Object.assign({}, list[i], obj); else list.push(obj);}
  function ability(name){return {id:name,name:name,kind:'Generic',ignorableByMoldBreaker:false};}
  D.abilities = D.abilities || [];
  ['よわき','わざわいのうつわ','わざわいのおふだ','トランジスタ','ハドロンエンジン','ひひいろのこどう','フラワーギフト','こんじょう','しんりょく','もうか','げきりゅう','むしのしらせ','もらいび','サンパワー','プラス','マイナス','いわはこび','はがねつかい','ごりむちゅう','りゅうのあぎと','ちからもち','ヨガパワー','すいほう','はりこみ','あついしぼう','きよめのしお'].forEach(n=>upsert(D.abilities,ability(n)));
  D.items = D.items || [];
  [
    {id:'choice_band',name:'こだわりハチマキ',kind:'ChoiceBand'},
    {id:'choice_specs',name:'こだわりメガネ',kind:'ChoiceSpecs'},
    {id:'thick_club',name:'ふといホネ',kind:'ThickClub'},
    {id:'deep_sea_tooth',name:'しんかいのキバ',kind:'DeepSeaTooth'},
    {id:'light_ball',name:'でんきだま',kind:'LightBall'}
  ].forEach(x=>upsert(D.items,x));
  D.__attackModifierDataPatched = true;
})();


// v0.26 missing power modifier data additions
(function(){
  const D = window.DAMEKE_DATA;
  if(!D || D.__missingPowerModifierDataPatched) return;
  function upsert(list,obj){const i=list.findIndex(x=>x.id===obj.id || x.name===obj.name); if(i>=0) list[i]=Object.assign({}, list[i], obj); else list.push(obj);}
  function ability(name){return {id:name,name:name,kind:'Generic',ignorableByMoldBreaker:false};}
  D.abilities = D.abilities || [];
  ['そうだいしょう','きれあじ'].forEach(n=>upsert(D.abilities,ability(n)));
  D.items = D.items || [];
  upsert(D.items,{id:'punching_glove',name:'パンチグローブ',kind:'PunchingGlove'});
  function patchMove(name,props){const m=(D.moves||[]).find(x=>x.name===name); if(m) Object.assign(m,props);}
  ['いあいぎり','きりさく','つじぎり','エアカッター','エアスラッシュ','シェルブレード','サイコカッター','リーフブレード','クロスポイズン','シザークロス','せいなるつるぎ','れんぞくぎり','むねんのつるぎ','アクアカッター'].forEach(n=>patchMove(n,{cut:true}));
  ['ほのおのパンチ','れいとうパンチ','かみなりパンチ','マッハパンチ','バレットパンチ','ドレインパンチ','グロウパンチ','メガトンパンチ','れんぞくパンチ','アームハンマー','コメットパンチ','シャドーパンチ','プラズマフィスト'].forEach(n=>patchMove(n,{punch:true}));
  D.__missingPowerModifierDataPatched = true;
})();


// v0.26 fix: Supreme Overlord / Sharpness data
(function(){
  const D = window.DAMEKE_DATA;
  if(!D || D.__supremeSharpnessFixDataPatched) return;
  function upsert(list,obj){const i=list.findIndex(x=>x.id===obj.id || x.name===obj.name); if(i>=0) list[i]=Object.assign({}, list[i], obj); else list.push(obj);}
  function ability(name){return {id:name,name:name,kind:'Generic',ignorableByMoldBreaker:false};}
  D.abilities = D.abilities || [];
  ['そうだいしょう','きれあじ'].forEach(n=>upsert(D.abilities,ability(n)));
  function patchMove(name,props){const m=(D.moves||[]).find(x=>x.name===name); if(m) Object.assign(m,props);}
  ['いあいぎり','きりさく','つじぎり','エアカッター','エアスラッシュ','シェルブレード','サイコカッター','リーフブレード','クロスポイズン','シザークロス','せいなるつるぎ','れんぞくぎり','むねんのつるぎ','アクアカッター'].forEach(n=>patchMove(n,{cut:true}));
  D.__supremeSharpnessFixDataPatched = true;
})();


// v0.25 fix: Hustle ability data
(function(){
  const D = window.DAMEKE_DATA;
  if(!D || D.__hustleAbilityDataPatched) return;
  D.abilities = D.abilities || [];
  const i = D.abilities.findIndex(x => x.id === 'はりきり' || x.name === 'はりきり');
  const obj = {id:'はりきり',name:'はりきり',kind:'Generic',ignorableByMoldBreaker:false};
  if(i >= 0) D.abilities[i] = Object.assign({}, D.abilities[i], obj);
  else D.abilities.push(obj);
  D.__hustleAbilityDataPatched = true;
})();


// v0.27 defense modifier data additions
(function(){
  const D = window.DAMEKE_DATA;
  if(!D || D.__defenseModifierDataPatched) return;
  function upsert(list,obj){const i=list.findIndex(x=>x.id===obj.id || x.name===obj.name); if(i>=0) list[i]=Object.assign({}, list[i], obj); else list.push(obj);}
  function ability(name){return {id:name,name:name,kind:'Generic',ignorableByMoldBreaker:false};}
  D.abilities = D.abilities || [];
  ['わざわいのたま','わざわいのつるぎ','ふしぎなうろこ','くさのけがわ','ファーコート'].forEach(n=>upsert(D.abilities,ability(n)));
  D.items = D.items || [];
  [
    {id:'eviolite',name:'しんかのきせき',kind:'Eviolite'},
    {id:'assault_vest',name:'とつげきチョッキ',kind:'AssaultVest'},
    {id:'deep_sea_scale',name:'しんかいのウロコ',kind:'DeepSeaScale'},
    {id:'metal_powder',name:'メタルパウダー',kind:'MetalPowder'}
  ].forEach(x=>upsert(D.items,x));
  D.__defenseModifierDataPatched = true;
})();


// v0.28 critical/contact data additions
(function(){
  const D = window.DAMEKE_DATA;
  if(!D || D.__criticalContactDataPatched) return;
  function upsert(list,obj){const i=list.findIndex(x=>x.id===obj.id || x.name===obj.name); if(i>=0) list[i]=Object.assign({}, list[i], obj); else list.push(obj);}
  function ability(name,props){return Object.assign({id:name,name:name,kind:'Generic',ignorableByMoldBreaker:false}, props||{});}
  D.abilities = D.abilities || [];
  upsert(D.abilities, ability('えんかく'));
  upsert(D.abilities, ability('もふもふ'));
  upsert(D.abilities, ability('わるいてぐせ'));
  upsert(D.abilities, ability('カブトアーマー',{kind:'CriticalBlock'}));
  upsert(D.abilities, ability('シェルアーマー',{kind:'CriticalBlock'}));
  D.items = D.items || [];
  upsert(D.items,{id:'protective_pads',name:'ぼうごパッド',kind:'ProtectivePads'});
  upsert(D.items,{id:'punching_glove',name:'パンチグローブ',kind:'PunchingGlove'});
  function patchMove(name,props){const m=(D.moves||[]).find(x=>x.name===name); if(m) Object.assign(m,props);}
  ['やまあらし','こおりのいぶき','あんこくきょうだ','すいりゅうれんだ','トリックフラワー'].forEach(n=>patchMove(n,{alwaysCrit:true}));
  ['ほのおのパンチ','れいとうパンチ','かみなりパンチ','マッハパンチ','バレットパンチ','ドレインパンチ','グロウパンチ','メガトンパンチ','れんぞくパンチ','アームハンマー','コメットパンチ','シャドーパンチ','プラズマフィスト'].forEach(n=>patchMove(n,{punch:true}));
  // 固定ダメージ技は、今後 moves 側に fixedDamage:true または damageKind を持たせる想定。
  D.__criticalContactDataPatched = true;
})();


// v0.30 damage modifier data additions
(function(){
  const D = window.DAMEKE_DATA;
  if(!D || D.__damageModifierToRandomDataPatched) return;
  function upsert(list,obj){const i=list.findIndex(x=>x.id===obj.id || x.name===obj.name); if(i>=0) list[i]=Object.assign({}, list[i], obj); else list.push(obj);}
  D.abilities = D.abilities || [];
  upsert(D.abilities,{id:'おやこあい',name:'おやこあい',kind:'Generic',ignorableByMoldBreaker:false});
  function patchMove(name,props){const m=(D.moves||[]).find(x=>x.name===name); if(m) Object.assign(m,props);}
  // 技範囲は今後 move.target に入れる想定。ここでは既知の特殊範囲化要件だけを補助する。
  patchMove('テラクラスター',{originalTarget:'1体選択'});
  patchMove('ワイドフォース',{originalTarget:'1体選択'});
  D.__damageModifierToRandomDataPatched = true;
})();


// v0.31 STAB modifier data additions
(function(){
  const D = window.DAMEKE_DATA;
  if(!D || D.__stabModifierDataPatched) return;
  function upsert(list,obj){const i=list.findIndex(x=>x.id===obj.id || x.name===obj.name); if(i>=0) list[i]=Object.assign({}, list[i], obj); else list.push(obj);}
  D.abilities = D.abilities || [];
  upsert(D.abilities,{id:'てきおうりょく',name:'てきおうりょく',kind:'Generic',ignorableByMoldBreaker:false});
  D.__stabModifierDataPatched = true;
})();


// v0.32 type effectiveness data additions
(function(){
  const D = window.DAMEKE_DATA;
  if(!D || D.__typeEffectivenessDataPatched) return;
  function upsert(list,obj){const i=list.findIndex(x=>x.id===obj.id || x.name===obj.name); if(i>=0) list[i]=Object.assign({}, list[i], obj); else list.push(obj);}
  function ability(name){return {id:name,name:name,kind:'Generic',ignorableByMoldBreaker:false};}
  D.abilities = D.abilities || [];
  ['きもったま','しんがん','こんがりボディ','そうしょく','ちくでん','ちょすい','でんきエンジン','どしょく','ひらいしん','もらいび','よびみず','テラスシェル','ふしぎなまもり'].forEach(n=>upsert(D.abilities,ability(n)));
  D.items = D.items || [];
  upsert(D.items,{id:'ring_target',name:'ねらいのまと',kind:'RingTarget'});
  D.__typeEffectivenessDataPatched = true;
})();


// fix v0.32: Tar Shot UI and Thousand Arrows data
(function(){
  const D = window.DAMEKE_DATA;
  if(!D || D.__fixV032TarShotThousandArrows) return;
  function upsert(list,obj){
    const i = list.findIndex(x => x.id === obj.id || x.name === obj.name);
    if(i >= 0) list[i] = Object.assign({}, list[i], obj);
    else list.push(obj);
  }
  D.moves = D.moves || [];
  upsert(D.moves, {
    id: 'thousand_arrows',
    name: 'サウザンアロー',
    type: 'じめん',
    category: '物理',
    power: 90,
    contact: false,
    priority: 0,
    hitCount: 1,
    target: '相手全員',
    notes: 'v0.32確認用の仮データ。タイプ相性ではサウザンアロー専用処理を参照。'
  });
  D.typeChart4096 = D.typeChart4096 || {};
  D.typeChart4096['じめん'] = Object.assign({
    'ほのお': 8192,
    'でんき': 8192,
    'どく': 8192,
    'いわ': 8192,
    'はがね': 8192,
    'くさ': 2048,
    'むし': 2048,
    'ひこう': 0
  }, D.typeChart4096['じめん'] || {});
  D.__fixV032TarShotThousandArrows = true;
})();


// v0.33 late damage modifier data additions
(function(){
  const D = window.DAMEKE_DATA;
  if(!D || D.__lateDamageModifierDataPatched) return;
  function upsert(list,obj){const i=list.findIndex(x=>x.id===obj.id || x.name===obj.name); if(i>=0) list[i]=Object.assign({}, list[i], obj); else list.push(obj);}
  function ability(name){return {id:name,name:name,kind:'Generic',ignorableByMoldBreaker:false};}
  D.abilities = D.abilities || [];
  ['すりぬけ','ブレインフォース','スナイパー','いろめがね','もふもふ','こおりのりんぷん','パンクロック','ファントムガード','マルチスケイル','ハードロック','フィルター','プリズムアーマー','ふかしのこぶし','かんつうドリル'].forEach(n=>upsert(D.abilities,ability(n)));
  D.items = D.items || [];
  upsert(D.items,{id:'expert_belt',name:'たつじんのおび',kind:'ExpertBelt'});
  upsert(D.items,{id:'metronome_item',name:'メトロノーム',kind:'MetronomeItem'});
  upsert(D.items,{id:'life_orb',name:'いのちのたま',kind:'LifeOrb'});
  const berryTypes = {
    'ホズのみ':'ノーマル','オッカのみ':'ほのお','イトケのみ':'みず','ソクノのみ':'でんき','リンドのみ':'くさ','ヤチェのみ':'こおり','ヨプのみ':'かくとう','ビアーのみ':'どく','シュカのみ':'じめん','バコウのみ':'ひこう','ウタンのみ':'エスパー','タンガのみ':'むし','ヨロギのみ':'いわ','カシブのみ':'ゴースト','ハバンのみ':'ドラゴン','ナモのみ':'あく','リリバのみ':'はがね','ロゼルのみ':'フェアリー'
  };
  Object.keys(berryTypes).forEach(name=>upsert(D.items,{id:name,name:name,kind:'ResistBerry',type:berryTypes[name],isBerry:true}));
  function patchMove(name, props){const m=(D.moves||[]).find(x=>x.name===name); if(m) Object.assign(m,props); else upsert(D.moves,Object.assign({id:name,name:name,type:'ノーマル',category:'物理',power:1},props));}
  ['ハイパーボイス','ばくおんぱ','りんしょう','スケイルノイズ'].forEach(n=>patchMove(n,{sound:true}));
  ['ふみつけ','のしかかり','ドラゴンダイブ','ハードローラー','ヒートスタンプ','ヘビーボンバー','フライングプレス','ハイパーダーククラッシャー','サンダーダイブ'].forEach(n=>patchMove(n,{contact:true}));
  D.__lateDamageModifierDataPatched = true;
})();


// v0.34 fixed damage data and Merciless
(function(){
  const D = window.DAMEKE_DATA;
  if(!D || D.__fixedDamageDataPatched) return;
  function upsert(list,obj){const i=list.findIndex(x=>x.id===obj.id || x.name===obj.name); if(i>=0) list[i]=Object.assign({}, list[i], obj); else list.push(obj);}
  D.abilities = D.abilities || [];
  upsert(D.abilities,{id:'ひとでなし',name:'ひとでなし',kind:'Generic',ignorableByMoldBreaker:false});
  D.moves = D.moves || [];
  function mv(name,type,category,kind,power){upsert(D.moves,{id:name,name:name,type:type||'ノーマル',category:category||'特殊',power:power== null ? 1 : power,fixedDamage:true,fixedDamageKind:kind,contact:false,priority:0});}
  mv('ソニックブーム','ノーマル','特殊','sonicBoom',1);
  mv('りゅうのいかり','ドラゴン','特殊','dragonRage',1);
  mv('ナイトヘッド','ゴースト','特殊','level',1);
  mv('ちきゅうなげ','かくとう','物理','level',1);
  mv('サイコウェーブ','エスパー','特殊','psywave',1);
  mv('いかりのまえば','ノーマル','物理','halfHp',1);
  mv('しぜんのいかり','フェアリー','特殊','halfHp',1);
  mv('カタストロフィ','あく','特殊','halfHp',1);
  mv('がむしゃら','ノーマル','物理','endeavor',1);
  mv('カウンター','かくとう','物理','counter',1);
  mv('ミラーコート','エスパー','特殊','counter',1);
  mv('がまん','ノーマル','物理','counter',1);
  mv('メタルバースト','はがね','物理','metalBurst',1);
  mv('ほうふく','あく','物理','metalBurst',1);
  mv('いのちがけ','かくとう','特殊','finalGambit',1);
  mv('ハサミギロチン','ノーマル','物理','ohko',1);
  mv('つのドリル','ノーマル','物理','ohko',1);
  mv('じわれ','じめん','物理','ohko',1);
  mv('ぜったいれいど','こおり','特殊','ohko',1);
  mv('ガーディアン・デ・アローラ','フェアリー','特殊','guardian',1);
  D.__fixedDamageDataPatched = true;
})();


// v0.36 canonical data schema and normalization
(function(){
  const D = window.DAMEKE_DATA;
  if(!D || D.__schemaNormalizedV36) return;

  D.schemaVersion = 'v0.36-canonical';
  D.schema = {
    pokemon: {
      required: ['id','name','types','baseStats','weight','canEvolve','cannotDynamax','speciesKey'],
      optional: ['formKey','baseSpecies','regionalForm','isMega','isPrimal','specialFormTags']
    },
    move: {
      required: ['id','name','type','category','power','priority','target','contact','tags'],
      optional: ['powerKind','fixedDamageKind','hitKind','hitCountMin','hitCountMax','protectCategory','ignoresAbilities','zPowerOverride','maxPowerOverride','teraMinPowerExcluded','specialRules']
    },
    ability: {
      required: ['id','name','kind','ignorableByMoldBreaker','effectTags'],
      optional: ['rate','affectedTypes','affectedCategories','conditions']
    },
    item: {
      required: ['id','name','kind','effectTags'],
      optional: ['type','isBerry','naturalGiftType','naturalGiftPower','flingPower','targetSpecies','targetSpeciesGroup','rate','affectedStat','consumable','suppressible']
    }
  };

  function uniq(arr){ return Array.from(new Set((arr || []).filter(Boolean))); }
  function ensureArray(v){ return Array.isArray(v) ? v.slice() : (v ? [v] : []); }
  function normalizeIdText(text){ return String(text || '').trim(); }

  const moveBooleanTagMap = {
    sound: 'sound',
    punch: 'punch',
    cut: 'cut',
    bite: 'bite',
    pulse: 'pulse',
    recoil: 'recoil',
    sheerForce: 'sheerForce',
    alwaysCrit: 'alwaysCrit',
    fixedDamage: 'fixedDamage',
    ignoresAbilities: 'ignoresAbilities'
  };

  const powerKindTagMap = {
    BeatUp: 'multiHit',
    TripleAxel: 'multiHit',
    TripleKick: 'multiHit',
    WaterShuriken: 'multiHit',
    FuryCutter: 'variablePower',
    Rollout: 'variablePower',
    LowKick: 'weightPower',
    HeavySlam: 'weightPower',
    ElectroBall: 'speedPower',
    GyroBall: 'speedPower'
  };

  const itemKindTagMap = {
    ResistBerry: ['resistBerry','berry'],
    RingTarget: ['ringTarget'],
    PunchingGlove: ['punchingGlove'],
    LifeOrb: ['lifeOrb'],
    ExpertBelt: ['expertBelt'],
    MetronomeItem: ['metronomeItem'],
    AbilityProtection: ['abilityProtection'],
    WeatherIgnore: ['weatherIgnore'],
    Eviolite: ['eviolite'],
    AssaultVest: ['assaultVest'],
    DeepSeaScale: ['deepSeaScale'],
    MetalPowder: ['metalPowder']
  };

  const abilityKindTagMap = {
    CriticalBlock: ['criticalBlock'],
    IgnoreWeather: ['ignoreWeather'],
    MoldBreakerEffect: ['moldBreakerEffect'],
    ItemSuppress: ['itemSuppress'],
    BerrySuppressOpponent: ['berrySuppressOpponent'],
    Levitate: ['levitate'],
    HazardImmune: ['hazardImmune']
  };

  function normalizePokemon(p){
    p.id = normalizeIdText(p.id || p.name);
    p.name = normalizeIdText(p.name || p.id);
    p.types = Array.isArray(p.types) && p.types.length ? p.types : ['タイプなし'];
    p.baseStats = p.baseStats || {H:1,A:1,B:1,C:1,D:1,S:1};
    p.weight = Number.isFinite(Number(p.weight)) ? Number(p.weight) : 0;
    if(p.name === 'ヌケニン') p.baseStats.H = 1;
    if(p.canEvolve == null) p.canEvolve = false;
    if(p.cannotDynamax == null) p.cannotDynamax = false;
    if(!p.speciesKey) p.speciesKey = p.baseSpecies || p.name;
    if(!p.formKey) p.formKey = p.name;
    p.specialFormTags = uniq(ensureArray(p.specialFormTags));
    return p;
  }

  function normalizeMove(m){
    m.id = normalizeIdText(m.id || m.name);
    m.name = normalizeIdText(m.name || m.id);
    m.type = m.type || 'ノーマル';
    m.category = m.category || '変化';
    if(m.power == null) m.power = m.category === '変化' ? null : 1;
    if(m.priority == null) m.priority = 0;
    if(m.target == null) m.target = m.range || m.scope || m.targetType || m.originalTarget || '1体選択';
    if(m.contact == null) m.contact = false;
    let tags = ensureArray(m.tags);
    for(const [key, tag] of Object.entries(moveBooleanTagMap)) if(m[key]) tags.push(tag);
    if(m.contact) tags.push('contact');
    if(m.powerKind && powerKindTagMap[m.powerKind]) tags.push(powerKindTagMap[m.powerKind]);
    if(m.fixedDamageKind) tags.push('fixedDamage');
    if(m.hitCount || m.hitCountKind) tags.push('multiHit');
    m.tags = uniq(tags);
    if(m.fixedDamage && !m.fixedDamageKind && m.damageKind) m.fixedDamageKind = m.damageKind;
    if(m.hitCount != null && m.hitCountMin == null && m.hitCountMax == null){ m.hitCountMin = m.hitCount; m.hitCountMax = m.hitCount; }
    if(m.protectCategory == null){
      if(m.tags.includes('protectBypass')) m.protectCategory = 'bypass';
      else if(m.isZMove) m.protectCategory = 'zMove';
      else m.protectCategory = 'normal';
    }
    return m;
  }

  function normalizeAbility(a){
    a.id = normalizeIdText(a.id || a.name);
    a.name = normalizeIdText(a.name || a.id);
    if(!a.kind) a.kind = 'Generic';
    if(a.ignorableByMoldBreaker == null) a.ignorableByMoldBreaker = false;
    let tags = ensureArray(a.effectTags);
    if(abilityKindTagMap[a.kind]) tags = tags.concat(abilityKindTagMap[a.kind]);
    if(a.protectedFromSuppression) tags.push('protectedFromSuppression');
    if(a.ignorableByMoldBreaker) tags.push('ignorableByMoldBreaker');
    a.effectTags = uniq(tags);
    return a;
  }

  function normalizeItem(it){
    it.id = normalizeIdText(it.id || it.name);
    it.name = normalizeIdText(it.name || it.id);
    if(!it.kind) it.kind = 'Generic';
    let tags = ensureArray(it.effectTags);
    if(itemKindTagMap[it.kind]) tags = tags.concat(itemKindTagMap[it.kind]);
    if(it.isBerry) tags.push('berry');
    if(it.type) tags.push('typed');
    it.effectTags = uniq(tags);
    if(it.consumable == null) it.consumable = !!it.isBerry;
    if(it.suppressible == null) it.suppressible = it.kind !== 'AbilityProtection';
    return it;
  }

  D.pokemons = (D.pokemons || []).map(normalizePokemon);
  D.moves = (D.moves || []).map(normalizeMove);
  D.abilities = (D.abilities || []).map(normalizeAbility);
  D.items = (D.items || []).map(normalizeItem);

  function missingKeys(obj, keys){ return keys.filter(k => obj[k] == null); }
  function validateList(name, list, schema){
    const errors = [];
    const seen = new Set();
    (list || []).forEach((obj, idx) => {
      const miss = missingKeys(obj, schema.required || []);
      if(miss.length) errors.push(name + '[' + idx + '] ' + (obj.name || obj.id || '?') + ' missing: ' + miss.join(','));
      if(obj.id){
        if(seen.has(obj.id)) errors.push(name + '[' + idx + '] duplicate id: ' + obj.id);
        seen.add(obj.id);
      }
    });
    return errors;
  }

  D.validateSchema = function(){
    return [].concat(
      validateList('pokemons', D.pokemons, D.schema.pokemon),
      validateList('moves', D.moves, D.schema.move),
      validateList('abilities', D.abilities, D.schema.ability),
      validateList('items', D.items, D.schema.item)
    );
  };

  D.schemaReport = function(){
    const errors = D.validateSchema();
    return {
      schemaVersion: D.schemaVersion,
      counts: {
        pokemons: (D.pokemons || []).length,
        moves: (D.moves || []).length,
        abilities: (D.abilities || []).length,
        items: (D.items || []).length
      },
      errors: errors
    };
  };

  D.__schemaNormalizedV36 = true;
})();


// v0.37-v0.41 canonical data enrichment for moves, abilities, items, and pokemons
(function(){
  const D = window.DAMEKE_DATA;
  if(!D || D.__canonicalDataEnrichedV037041) return;
  function uniq(arr){ return Array.from(new Set((arr || []).filter(Boolean))); }
  function arr(v){ return Array.isArray(v) ? v.slice() : (v ? [v] : []); }
  function addTags(obj, tags){ obj.tags = uniq(arr(obj.tags).concat(tags || [])); }
  function addEffectTags(obj, tags){ obj.effectTags = uniq(arr(obj.effectTags).concat(tags || [])); }
  function upsert(list,obj){ const i=list.findIndex(x=>x.id===obj.id || x.name===obj.name); if(i>=0) list[i]=Object.assign({}, list[i], obj); else list.push(obj); }

  D.schemaVersion = 'v0.41-canonical';
  D.schema = D.schema || {};
  D.schema.pokemon = {required:['id','name','types','baseStats','weight','canEvolve','cannotDynamax','speciesKey','formKey']};
  D.schema.move = {required:['id','name','type','category','power','priority','target','contact','tags']};
  D.schema.ability = {required:['id','name','kind','ignorableByMoldBreaker','effectTags']};
  D.schema.item = {required:['id','name','kind','effectTags']};

  const TAGS_BY_MOVE_NAME = {
    punch:['ほのおのパンチ','れいとうパンチ','かみなりパンチ','マッハパンチ','バレットパンチ','ドレインパンチ','グロウパンチ','メガトンパンチ','れんぞくパンチ','アームハンマー','コメットパンチ','シャドーパンチ','プラズマフィスト'],
    cut:['いあいぎり','きりさく','つじぎり','エアカッター','エアスラッシュ','シェルブレード','サイコカッター','リーフブレード','クロスポイズン','シザークロス','せいなるつるぎ','れんぞくぎり','むねんのつるぎ','アクアカッター'],
    bite:['かみつく','かみくだく','ほのおのキバ','こおりのキバ','かみなりのキバ','サイコファング','エラがみ'],
    pulse:['あくのはどう','りゅうのはどう','みずのはどう','はどうだん','こんげんのはどう'],
    recoil:['すてみタックル','とっしん','フレアドライブ','ブレイブバード','ウッドハンマー','ボルテッカー','ワイルドボルト','もろはのずつき','アフロブレイク','じごくぐるま'],
    sound:['ハイパーボイス','ばくおんぱ','りんしょう','スケイルノイズ'],
    sheerForce:['10まんボルト','かえんほうしゃ','れいとうビーム','サイコキネシス','ヘドロばくだん','シャドーボール','エアスラッシュ','アイアンヘッド','どくづき','たきのぼり'],
    alwaysCrit:['やまあらし','こおりのいぶき','あんこくきょうだ','すいりゅうれんだ','トリックフラワー'],
    fixedDamage:['ソニックブーム','りゅうのいかり','ナイトヘッド','ちきゅうなげ','サイコウェーブ','いかりのまえば','しぜんのいかり','カタストロフィ','がむしゃら','カウンター','ミラーコート','がまん','メタルバースト','ほうふく','いのちがけ','ハサミギロチン','つのドリル','じわれ','ぜったいれいど','ガーディアン・デ・アローラ'],
    protectBypass:['フェイント','ゴーストダイブ','シャドーダイブ','いじげんホール','いじげんラッシュ','ハイパードリル','パワフルエッジ','みらいよち','はめつのねがい','キョダイイチゲキ','キョダイレンゲキ'],
    maxGuardBypass:['フェイント','みらいよち','はめつのねがい','キョダイイチゲキ','キョダイレンゲキ'],
    minimizeDouble:['ふみつけ','のしかかり','ドラゴンダイブ','ハードローラー','ヒートスタンプ','ヘビーボンバー','フライングプレス','ハイパーダーククラッシャー','サンダーダイブ'],
    parentalExcluded:['かまいたち','ゴッドバード','ソーラービーム','コールドフレア','フリーズボルト','ソーラーブレード','メテオビーム','ロケットずつき','エレクトロビーム','あなをほる','そらをとぶ','とびはねる','フリーフォール','ダイビング','ゴーストダイブ','シャドーダイブ','みらいよち','はめつのねがい','じばく','だいばくはつ','いのちがけ','がむしゃら','じわれ','ぜったいれいど','つのドリル','ハサミギロチン','なげつける','ころがる','アイスボール'],
    psychoShockDefense:['サイコショック','サイコブレイク','しんぴのつるぎ'],
    teraMinPowerExcluded:['エレキボール','ジャイロボール','きしかいせい','じたばた','くさむすび','けたぐり','ヒートスタンプ','ヘビーボンバー','なげつける','にぎりつぶす','しぼりとる','ハードプレス','しおふき','ふんか','ドラゴンエナジー']
  };
  const FIXED_KIND = {
    'ソニックブーム':'sonicBoom','りゅうのいかり':'dragonRage','ナイトヘッド':'level','ちきゅうなげ':'level','サイコウェーブ':'psywave','いかりのまえば':'halfHp','しぜんのいかり':'halfHp','カタストロフィ':'halfHp','がむしゃら':'endeavor','カウンター':'counter','ミラーコート':'counter','がまん':'counter','メタルバースト':'metalBurst','ほうふく':'metalBurst','いのちがけ':'finalGambit','ハサミギロチン':'ohko','つのドリル':'ohko','じわれ':'ohko','ぜったいれいど':'ohko','ガーディアン・デ・アローラ':'guardian'
  };
  const POWER_KIND_TAGS = {BeatUp:'multiHit',TripleAxel:'multiHit',TripleKick:'multiHit',WaterShuriken:'multiHit',Rollout:'variablePower',FuryCutter:'variablePower',LowKick:'weightPower',HeavySlam:'weightPower',ElectroBall:'speedPower',GyroBall:'speedPower'};

  D.moves = (D.moves || []).map(m => {
    m.id = String(m.id || m.name).trim();
    m.name = String(m.name || m.id).trim();
    m.type = m.type || 'ノーマル';
    m.category = m.category || '変化';
    if(m.power == null) m.power = m.category === '変化' ? null : 1;
    if(m.priority == null) m.priority = 0;
    if(m.target == null) m.target = m.range || m.scope || m.targetType || m.originalTarget || '1体選択';
    if(m.contact == null) m.contact = false;
    const tags = [];
    for(const [tag,names] of Object.entries(TAGS_BY_MOVE_NAME)) if(names.includes(m.name)) tags.push(tag);
    for(const k of ['sound','punch','cut','bite','pulse','recoil','sheerForce','alwaysCrit','fixedDamage','ignoresAbilities']) if(m[k]) tags.push(k);
    if(m.contact) tags.push('contact');
    if(m.powerKind && POWER_KIND_TAGS[m.powerKind]) tags.push(POWER_KIND_TAGS[m.powerKind]);
    if(m.hitCount || m.hitCountKind) tags.push('multiHit');
    if(FIXED_KIND[m.name]){ m.fixedDamageKind = FIXED_KIND[m.name]; tags.push('fixedDamage'); }
    if(m.fixedDamageKind) tags.push('fixedDamage');
    if(m.name === 'サウザンアロー') tags.push('thousandArrows');
    if(m.name === 'フライングプレス') tags.push('flyingPress');
    if(m.name === 'フリーズドライ') tags.push('freezeDry');
    if(m.name === 'ぜったいれいど') tags.push('absoluteZero');
    if(m.name === 'テラクラスター') tags.push('teraCluster');
    if(m.name === 'ワイドフォース') tags.push('expandingForce');
    m.tags = uniq(arr(m.tags).concat(tags));
    if(m.hitCount != null && m.hitCountMin == null && m.hitCountMax == null){ m.hitCountMin = m.hitCount; m.hitCountMax = m.hitCount; }
    if(!m.protectCategory){
      if(m.tags.includes('protectBypass')) m.protectCategory = 'bypass';
      else m.protectCategory = 'normal';
    }
    return m;
  });

  const ABILITY_TAGS_BY_NAME = {
    'カブトアーマー':['criticalBlock'],'シェルアーマー':['criticalBlock'],'ノーてんき':['ignoreWeather'],'エアロック':['ignoreWeather'],
    'かたやぶり':['moldBreakerEffect'],'ターボブレイズ':['moldBreakerEffect'],'テラボルテージ':['moldBreakerEffect'],
    'ぶきよう':['itemSuppress'],'きんちょうかん':['berrySuppressOpponent'],'ふゆう':['levitate'],'うなぎのぼり':['levitate'],
    'マジックガード':['hazardImmune'],'そうしょく':['typeImmunity'],'ちょすい':['typeImmunity'],'ちくでん':['typeImmunity'],'でんきエンジン':['typeImmunity'],
    'ひらいしん':['typeImmunity'],'よびみず':['typeImmunity'],'もらいび':['typeImmunity'],'こんがりボディ':['typeImmunity'],'どしょく':['typeImmunity'],
    'ふしぎなまもり':['typeEffectivenessGuard'],'テラスシェル':['typeEffectivenessOverride'],
    'こおりのりんぷん':['damageReduction'],'パンクロック':['damageReduction'],'ファントムガード':['damageReduction'],'マルチスケイル':['damageReduction'],
    'ハードロック':['superEffectiveReduction'],'フィルター':['superEffectiveReduction'],'プリズムアーマー':['superEffectiveReduction'],
    'てきおうりょく':['stabModifier'],'おやこあい':['parentalBond'],'ひとでなし':['merciless'],'えんかく':['nonContact'],
    'すりぬけ':['screenBypass'],'スナイパー':['criticalDamageBoost'],'いろめがね':['notVeryEffectiveBoost'],'ブレインフォース':['superEffectiveBoost']
  };
  D.abilities = (D.abilities || []).map(a => {
    a.id = String(a.id || a.name).trim();
    a.name = String(a.name || a.id).trim();
    if(!a.kind) a.kind = 'Generic';
    if(a.ignorableByMoldBreaker == null) a.ignorableByMoldBreaker = false;
    const tags = [];
    if(ABILITY_TAGS_BY_NAME[a.name]) tags.push(...ABILITY_TAGS_BY_NAME[a.name]);
    if(a.kind === 'CriticalBlock') tags.push('criticalBlock');
    if(a.kind === 'IgnoreWeather') tags.push('ignoreWeather');
    if(a.kind === 'MoldBreakerEffect') tags.push('moldBreakerEffect');
    if(a.kind === 'ItemSuppress') tags.push('itemSuppress');
    if(a.kind === 'BerrySuppressOpponent') tags.push('berrySuppressOpponent');
    if(a.kind === 'Levitate') tags.push('levitate');
    if(a.kind === 'HazardImmune') tags.push('hazardImmune');
    if(a.protectedFromSuppression) tags.push('protectedFromSuppression');
    if(a.ignorableByMoldBreaker) tags.push('ignorableByMoldBreaker');
    a.effectTags = uniq(arr(a.effectTags).concat(tags));
    return a;
  });

  const ITEM_TAGS_BY_KIND = {
    ResistBerry:['resistBerry','berry'], RingTarget:['ringTarget'], PunchingGlove:['punchingGlove'], LifeOrb:['lifeOrb'], ExpertBelt:['expertBelt'], MetronomeItem:['metronomeItem'], AbilityProtection:['abilityProtection'], WeatherIgnore:['weatherIgnore'], Eviolite:['eviolite'], AssaultVest:['assaultVest'], DeepSeaScale:['deepSeaScale'], MetalPowder:['metalPowder'], ChoiceBand:['choiceBand'], ChoiceSpecs:['choiceSpecs'], ThickClub:['thickClub'], DeepSeaTooth:['deepSeaTooth'], LightBall:['lightBall']
  };
  const ITEM_TARGET_SPECIES = {'ふといホネ':['カラカラ','ガラガラ','ガラガラ(アローラ)'], 'しんかいのキバ':['パールル'], 'しんかいのウロコ':['パールル'], 'でんきだま':['ピカチュウ'], 'メタルパウダー':['メタモン']};
  D.items = (D.items || []).map(it => {
    it.id = String(it.id || it.name).trim();
    it.name = String(it.name || it.id).trim();
    if(!it.kind) it.kind = 'Generic';
    const tags = [];
    if(ITEM_TAGS_BY_KIND[it.kind]) tags.push(...ITEM_TAGS_BY_KIND[it.kind]);
    if(it.isBerry) tags.push('berry');
    if(it.type) tags.push('typed');
    if(ITEM_TARGET_SPECIES[it.name] && !it.targetSpecies) it.targetSpecies = ITEM_TARGET_SPECIES[it.name].slice();
    it.effectTags = uniq(arr(it.effectTags).concat(tags));
    if(it.consumable == null) it.consumable = !!it.isBerry;
    if(it.suppressible == null) it.suppressible = it.kind !== 'AbilityProtection';
    return it;
  });

  const dynamaxBanned = new Set((D.zMax && D.zMax.dynamaxBanned) || []);
  D.pokemons = (D.pokemons || []).map(p => {
    p.id = String(p.id || p.name).trim();
    p.name = String(p.name || p.id).trim();
    p.types = Array.isArray(p.types) && p.types.length ? p.types : ['タイプなし'];
    p.baseStats = p.baseStats || {H:1,A:1,B:1,C:1,D:1,S:1};
    if(p.name === 'ヌケニン') p.baseStats.H = 1;
    p.weight = Number.isFinite(Number(p.weight)) ? Number(p.weight) : 0;
    if(p.canEvolve == null) p.canEvolve = false;
    if(p.cannotDynamax == null) p.cannotDynamax = dynamaxBanned.has(p.name);
    if(!p.baseSpecies) p.baseSpecies = p.name.replace(/^メガ/,'').replace(/\(.*\)$/,'');
    if(!p.speciesKey) p.speciesKey = p.baseSpecies || p.name;
    if(!p.formKey) p.formKey = p.name;
    p.specialFormTags = uniq(arr(p.specialFormTags));
    return p;
  });

  function validateList(label, list, required){
    const out = [], seen = new Set();
    (list || []).forEach((x,i) => {
      required.forEach(k => { if(x[k] == null) out.push(label+'['+i+'] '+(x.name||x.id||'?')+' missing '+k); });
      if(x.id){ if(seen.has(x.id)) out.push(label+' duplicate id '+x.id); seen.add(x.id); }
    });
    return out;
  }
  D.validateSchema = function(){
    return [].concat(
      validateList('pokemons',D.pokemons,D.schema.pokemon.required),
      validateList('moves',D.moves,D.schema.move.required),
      validateList('abilities',D.abilities,D.schema.ability.required),
      validateList('items',D.items,D.schema.item.required)
    );
  };
  D.schemaReport = function(){ return {schemaVersion:D.schemaVersion, counts:{pokemons:D.pokemons.length,moves:D.moves.length,abilities:D.abilities.length,items:D.items.length}, errors:D.validateSchema()}; };
  D.__canonicalDataEnrichedV037041 = true;
})();


// v0.42 move tag enrichment for calculation-side tag references
(function(){
  const D = window.DAMEKE_DATA;
  if(!D || D.__moveTagReferenceDataV42) return;
  function uniq(arr){ return Array.from(new Set((arr || []).filter(Boolean))); }
  function addMoveTags(names, tags){
    (D.moves || []).forEach(m => {
      if(names.includes(m.name)) m.tags = uniq([].concat(m.tags || [], tags));
    });
  }
  addMoveTags(['ほのおのパンチ','れいとうパンチ','かみなりパンチ','マッハパンチ','バレットパンチ','ドレインパンチ','グロウパンチ','メガトンパンチ','れんぞくパンチ','アームハンマー','コメットパンチ','シャドーパンチ','プラズマフィスト'], ['punch']);
  addMoveTags(['いあいぎり','きりさく','つじぎり','エアカッター','エアスラッシュ','シェルブレード','サイコカッター','リーフブレード','クロスポイズン','シザークロス','せいなるつるぎ','れんぞくぎり','むねんのつるぎ','アクアカッター'], ['cut']);
  addMoveTags(['かみつく','かみくだく','ほのおのキバ','こおりのキバ','かみなりのキバ','サイコファング','エラがみ'], ['bite']);
  addMoveTags(['あくのはどう','りゅうのはどう','みずのはどう','はどうだん','こんげんのはどう'], ['pulse']);
  addMoveTags(['すてみタックル','とっしん','フレアドライブ','ブレイブバード','ウッドハンマー','ボルテッカー','ワイルドボルト','もろはのずつき','アフロブレイク','じごくぐるま'], ['recoil']);
  addMoveTags(['ハイパーボイス','ばくおんぱ','りんしょう','スケイルノイズ'], ['sound']);
  addMoveTags(['10まんボルト','かえんほうしゃ','れいとうビーム','サイコキネシス','ヘドロばくだん','シャドーボール','エアスラッシュ','アイアンヘッド','どくづき','たきのぼり'], ['sheerForce']);
  addMoveTags(['やまあらし','こおりのいぶき','あんこくきょうだ','すいりゅうれんだ','トリックフラワー'], ['alwaysCrit']);
  addMoveTags(['フェイント','ゴーストダイブ','シャドーダイブ','いじげんホール','いじげんラッシュ','ハイパードリル','パワフルエッジ','みらいよち','はめつのねがい','キョダイイチゲキ','キョダイレンゲキ'], ['protectBypass']);
  addMoveTags(['フェイント','みらいよち','はめつのねがい','キョダイイチゲキ','キョダイレンゲキ'], ['maxGuardBypass']);
  addMoveTags(['ふみつけ','のしかかり','ドラゴンダイブ','ハードローラー','ヒートスタンプ','ヘビーボンバー','フライングプレス','ハイパーダーククラッシャー','サンダーダイブ'], ['minimizeDouble']);
  addMoveTags(['きょじゅうざん','きょじゅうだん','ダイマックスほう'], ['doubleVsDynamax']);
  addMoveTags(['かまいたち','ゴッドバード','ソーラービーム','コールドフレア','フリーズボルト','ソーラーブレード','メテオビーム','ロケットずつき','エレクトロビーム','あなをほる','そらをとぶ','とびはねる','フリーフォール','ダイビング','ゴーストダイブ','シャドーダイブ','みらいよち','はめつのねがい','じばく','だいばくはつ','いのちがけ','がむしゃら','じわれ','ぜったいれいど','つのドリル','ハサミギロチン','なげつける','ころがる','アイスボール'], ['parentalExcluded']);
  addMoveTags(['トリプルアクセル','トリプルキック','みずしゅりけん','ふくろだたき','おうふくビンタ','みだれづき','みだれひっかき','タネマシンガン','つららばり','ロックブラスト','ダブルチョップ','ホネブーメラン','にどげり'], ['multiHit','teraMinPowerExcluded']);
  addMoveTags(['エレキボール','ジャイロボール','きしかいせい','じたばた','くさむすび','けたぐり','ヒートスタンプ','ヘビーボンバー','なげつける','にぎりつぶす','しぼりとる','ハードプレス','しおふき','ふんか','ドラゴンエナジー'], ['teraMinPowerExcluded']);
  addMoveTags(['サウザンアロー'], ['thousandArrows']);
  addMoveTags(['フライングプレス'], ['flyingPress','minimizeDouble']);
  addMoveTags(['フリーズドライ'], ['freezeDry']);
  addMoveTags(['ぜったいれいど'], ['absoluteZero','fixedDamage','parentalExcluded']);
  addMoveTags(['テラクラスター'], ['teraCluster']);
  addMoveTags(['ワイドフォース'], ['expandingForce']);
  D.__moveTagReferenceDataV42 = true;
})();


// v0.43 Z-Move / Dynamax power tables
(function(){
  const D = window.DAMEKE_DATA;
  if(!D || D.__zMaxPowerTablesV43) return;
  D.zMax = D.zMax || {};
  D.zMax.zPowerOverrides = Object.assign({
    'おうふくビンタ':100,'みだれづき':100,'たまなげ':100,'つっぱり':100,'みずしゅりけん':100,'れんぞくパンチ':100,'みだれひっかき':100,'とげキャノン':100,'ダブルニードル':100,'にどげり':100,'ダブルチョップ':100,'ホネブーメラン':100,'ふくろだたき':100,'プレゼント':100,'はきだす':100,'なげつける':100,'ソニックブーム':100,'りゅうのいかり':100,'ちきゅうなげ':100,'ナイトヘッド':100,'サイコウェーブ':100,'いかりのまえば':100,'しぜんのいかり':100,'カウンター':100,'ミラーコート':100,'がまん':100,'メタルバースト':100,
    'メガドレイン':120,'トリプルキック':120,
    'コアパニッシャー':140,'ダブルアタック':140,'スイープビンタ':140,'タネマシンガン':140,'つららばり':140,'ロックブラスト':140,'ボーンラッシュ':140,'ミサイルばり':140,'マグニチュード':140,
    'ウェザーボール':160,'たたりめ':160,'アシストパワー':160,'つけあがる':160,'エレキボール':160,'ジャイロボール':160,'おしおき':160,'きりふだ':160,'おんがえし':160,'やつあたり':160,'じたばた':160,'きしかいせい':160,'くさむすび':160,'けたぐり':160,'しぜんのめぐみ':160,'ヒートスタンプ':160,'ヘビーボンバー':160,'がむしゃら':160,
    'フライングプレス':170,
    'サウザンアロー':180,'ギアソーサー':180,'しぼりとる':180,'にぎりつぶす':180,'いのちがけ':180,'ハサミギロチン':180,'つのドリル':180,'じわれ':180,'ぜったいれいど':180,
    'グランドフォース':185,'マルチアタック':185,
    'Vジェネレート':220
  }, D.zMax.zPowerOverrides || {});
  D.zMax.maxPowerOverrides = Object.assign({
    'つっぱり':70,
    'カウンター':75,'ちきゅうなげ':75,
    'トリプルキック':80,'にどげり':80,
    'みずしゅりけん':90,'みだれづき':90,
    'マルチアタック':95,
    'みだれひっかき':100,'ふくろだたき':100,'きしかいせい':100,'けたぐり':100,'なげつける':100,'はきだす':100,'プレゼント':100,'いかりのまえば':100,'いのちがけ':100,'しぜんのいかり':100,'ナイトヘッド':100,'ミラーコート':100,'メタルバースト':100,
    'ダブルアタック':120,
    'アシストパワー':130,'つけあがる':130,'ウェザーボール':130,'だいちのはどう':130,'ギアソーサー':130,'スイープビンタ':130,'すいりゅうれんだ':130,'スケイルショット':130,'タネマシンガン':130,'ダブルウイング':130,'ダブルチョップ':130,'つららばり':130,'ドラゴンアロー':130,'ボーンラッシュ':130,'ホネブーメラン':130,'ミサイルばり':130,'ロックブラスト':130,'エレキボール':130,'くさむすび':130,'じたばた':130,'ジャイロボール':130,'ヒートスタンプ':130,'ヘビーボンバー':130,'がむしゃら':130,'じわれ':130,'ぜったいれいど':130,'つのドリル':130,'ハサミギロチン':130,
    'ライジングボルト':140,'ダイマックスほう':140,'ダブルパンツァー':140,'トリプルアクセル':140,'にぎりつぶす':140
  }, D.zMax.maxPowerOverrides || {});
  D.zMax.maxPowerTypeTables = Object.assign({
    low: {types:['どく','かくとう'], table:[[40,70],[50,75],[60,80],[70,85],[100,90],[140,95],[Infinity,100]]},
    normal: {types:null, table:[[40,90],[50,100],[60,110],[70,120],[100,135],[140,140],[Infinity,150]]}
  }, D.zMax.maxPowerTypeTables || {});
  D.zMax.legacyBaseMaxPowerTable = D.zMax.legacyBaseMaxPowerTable || [[40,90],[50,100],[60,110],[70,120],[100,130],[140,140],[Infinity,150]];
  D.zMax.zPowerBaseTable = D.zMax.zPowerBaseTable || [[59,100],[69,120],[79,140],[89,160],[99,175],[109,180],[119,185],[129,190],[139,195],[Infinity,200]];
  D.__zMaxPowerTablesV43 = true;
})();


// v0.44-v0.47 canonical Z/G-Max, species, item target, and ability tag enrichment
(function(){
  const D = window.DAMEKE_DATA;
  if(!D || D.__zSpeciesItemAbilityCanonicalV044047) return;
  function uniq(arr){ return Array.from(new Set((arr || []).filter(Boolean))); }
  function arr(v){ return Array.isArray(v) ? v.slice() : (v ? [v] : []); }
  function simpleSpeciesName(name){ return String(name || '').replace(/^メガ/,'').replace(/\(.*\)$/,''); }
  D.zMax = D.zMax || {};

  // Pokemon canonical keys.
  D.pokemons = (D.pokemons || []).map(p => {
    p.speciesKey = p.speciesKey || p.baseSpecies || simpleSpeciesName(p.name);
    p.formKey = p.formKey || p.name;
    p.baseSpecies = p.baseSpecies || p.speciesKey;
    p.specialFormTags = uniq(arr(p.specialFormTags));
    if(p.cannotDynamax == null) p.cannotDynamax = ((D.zMax.dynamaxBanned || []).includes(p.name) || (D.zMax.dynamaxBannedKeys || []).includes(p.speciesKey) || (D.zMax.dynamaxBannedKeys || []).includes(p.formKey));
    if(p.canEvolve == null) p.canEvolve = false;
    return p;
  });

  // Z / G-Max canonical structures. Keep legacy fields but provide key-based fields.
  D.zMax.signatureZRules = (D.zMax.signatureZ || D.zMax.signatureZRules || []).map(r => Object.assign({}, r, {
    pokemonKeys: uniq(arr(r.pokemonKeys).concat(arr(r.speciesKeys)).concat(arr(r.pokemon))),
    move: r.move
  }));
  D.zMax.signatureZ = D.zMax.signatureZ || D.zMax.signatureZRules;

  D.zMax.gmaxByKeyType = Object.assign({}, D.zMax.gmaxByKeyType || {}, D.zMax.gmaxByPokemonType || {});
  D.zMax.gmaxEligibleKeys = uniq(arr(D.zMax.gmaxEligibleKeys).concat(arr(D.zMax.gmaxEligible)));
  D.zMax.dynamaxBannedKeys = uniq(arr(D.zMax.dynamaxBannedKeys).concat(arr(D.zMax.dynamaxBanned)));

  // Item target species canonicalization.
  const itemTargetMap = {
    'ふといホネ':['カラカラ','ガラガラ','ガラガラ(アローラ)'],
    'しんかいのキバ':['パールル'],
    'しんかいのウロコ':['パールル'],
    'でんきだま':['ピカチュウ'],
    'メタルパウダー':['メタモン']
  };
  D.items = (D.items || []).map(it => {
    if(itemTargetMap[it.name]) it.targetSpecies = uniq(arr(it.targetSpecies).concat(itemTargetMap[it.name]));
    it.targetSpeciesKeys = uniq(arr(it.targetSpeciesKeys).concat(arr(it.targetSpecies)).concat(arr(it.targetSpeciesGroup)));
    return it;
  });

  // Ability effectTags canonicalization.
  const abilityTags = {
    'カブトアーマー':['criticalBlock'],'シェルアーマー':['criticalBlock'],'ノーてんき':['ignoreWeather'],'エアロック':['ignoreWeather'],
    'かたやぶり':['moldBreakerEffect'],'ターボブレイズ':['moldBreakerEffect'],'テラボルテージ':['moldBreakerEffect'],
    'ぶきよう':['itemSuppress'],'きんちょうかん':['berrySuppressOpponent'],'ふゆう':['levitate'],'うなぎのぼり':['levitate'],
    'マジックガード':['hazardImmune'],'きもったま':['ghostBypass'],'しんがん':['ghostBypass'],
    'こんがりボディ':['typeImmunity'],'そうしょく':['typeImmunity'],'ちくでん':['typeImmunity'],'ちょすい':['typeImmunity'],'でんきエンジン':['typeImmunity'],'どしょく':['typeImmunity'],'ひらいしん':['typeImmunity'],'もらいび':['typeImmunity'],'よびみず':['typeImmunity'],
    'ふしぎなまもり':['wonderGuard'],'テラスシェル':['teraShell'],'こおりのりんぷん':['damageReduction'],'パンクロック':['damageReduction'],'ファントムガード':['damageReduction'],'マルチスケイル':['damageReduction'],
    'ハードロック':['superEffectiveReduction'],'フィルター':['superEffectiveReduction'],'プリズムアーマー':['superEffectiveReduction'],
    'てきおうりょく':['stabModifier'],'おやこあい':['parentalBond'],'ひとでなし':['merciless'],'えんかく':['nonContact'],
    'すりぬけ':['screenBypass'],'スナイパー':['criticalDamageBoost'],'いろめがね':['notVeryEffectiveBoost'],'ブレインフォース':['superEffectiveBoost'],
    'ふかしのこぶし':['protectPiercingContact'],'かんつうドリル':['protectPiercingContact']
  };
  D.abilities = (D.abilities || []).map(a => {
    a.effectTags = uniq(arr(a.effectTags).concat(abilityTags[a.name] || []));
    if(a.kind === 'CriticalBlock') a.effectTags = uniq(a.effectTags.concat(['criticalBlock']));
    if(a.kind === 'IgnoreWeather') a.effectTags = uniq(a.effectTags.concat(['ignoreWeather']));
    if(a.kind === 'MoldBreakerEffect') a.effectTags = uniq(a.effectTags.concat(['moldBreakerEffect']));
    if(a.kind === 'ItemSuppress') a.effectTags = uniq(a.effectTags.concat(['itemSuppress']));
    if(a.kind === 'BerrySuppressOpponent') a.effectTags = uniq(a.effectTags.concat(['berrySuppressOpponent']));
    if(a.kind === 'Levitate') a.effectTags = uniq(a.effectTags.concat(['levitate']));
    if(a.kind === 'HazardImmune') a.effectTags = uniq(a.effectTags.concat(['hazardImmune']));
    if(a.ignorableByMoldBreaker) a.effectTags = uniq(a.effectTags.concat(['ignorableByMoldBreaker']));
    return a;
  });

  D.schemaVersion = 'v0.47-canonical';
  D.__zSpeciesItemAbilityCanonicalV044047 = true;
})();


// v0.48-v0.51 canonical name-reference migration data
(function(){
  const D = window.DAMEKE_DATA;
  if(!D || D.__nameReferenceCanonicalV048051) return;
  function uniq(arr){ return Array.from(new Set((arr || []).filter(Boolean))); }
  function arr(v){ return Array.isArray(v) ? v.slice() : (v ? [v] : []); }
  function simpleSpeciesName(name){ return String(name || '').replace(/^メガ/,'').replace(/\(.*\)$/,''); }

  const speciesAliases = {
    'ヌケニン':['shedinja'],
    'アルセウス':['arceus'],
    'シルヴァディ':['silvally'],
    'ピカチュウ':['pikachu'],
    'パールル':['clamperl'],
    'メタモン':['ditto'],
    'カラカラ':['cubone'],
    'ガラガラ':['marowak'],
    'ガラガラ(アローラ)':['marowak','alolan_marowak'],
    'ケンタロス':['tauros'],
    'ケンタロス(コンバット種)':['tauros','tauros_combat'],
    'ケンタロス(ブレイズ種)':['tauros','tauros_blaze'],
    'ケンタロス(ウォーター種)':['tauros','tauros_aqua'],
    'モルペコ(はらぺこもよう)':['morpeko_hangry'],
    'オーガポン(みどり)':['ogerpon_teal'],
    'オーガポン(いど)':['ogerpon_wellspring'],
    'オーガポン(かまど)':['ogerpon_hearthflame'],
    'オーガポン(いしずえ)':['ogerpon_cornerstone'],
    'テラパゴス(テラスタル)':['terapagos_terastal'],
    'ゲッコウガ(サトシゲッコウガ)':['greninja_ash']
  };
  D.pokemons = (D.pokemons || []).map(p => {
    p.speciesKey = p.speciesKey || p.baseSpecies || simpleSpeciesName(p.name);
    p.formKey = p.formKey || p.name;
    p.aliases = uniq(arr(p.aliases).concat(speciesAliases[p.name] || []));
    p.baseSpecies = p.baseSpecies || p.speciesKey;
    p.specialFormTags = uniq(arr(p.specialFormTags));
    if(p.name === 'ヌケニン') { p.baseStats = p.baseStats || {}; p.baseStats.H = 1; }
    return p;
  });

  D.formMoveType = Object.assign({}, D.formMoveType || {}, {
    'レイジングブル': {
      'ケンタロス':'ノーマル',
      'ケンタロス(コンバット種)':'かくとう',
      'ケンタロス(ブレイズ種)':'ほのお',
      'ケンタロス(ウォーター種)':'みず',
      'tauros':'ノーマル',
      'tauros_combat':'かくとう',
      'tauros_blaze':'ほのお',
      'tauros_aqua':'みず'
    },
    'ツタこんぼう': {
      'オーガポン(みどり)':'くさ',
      'オーガポン(いど)':'みず',
      'オーガポン(かまど)':'ほのお',
      'オーガポン(いしずえ)':'いわ',
      'ogerpon_teal':'くさ',
      'ogerpon_wellspring':'みず',
      'ogerpon_hearthflame':'ほのお',
      'ogerpon_cornerstone':'いわ'
    },
    'オーラぐるま': {
      'モルペコ(はらぺこもよう)':'あく',
      'morpeko_hangry':'あく',
      'default':'でんき'
    }
  });

  const itemTargetMap = {
    'ふといホネ':['カラカラ','ガラガラ','ガラガラ(アローラ)','cubone','marowak','alolan_marowak'],
    'しんかいのキバ':['パールル','clamperl'],
    'しんかいのウロコ':['パールル','clamperl'],
    'でんきだま':['ピカチュウ','pikachu'],
    'メタルパウダー':['メタモン','ditto']
  };
  const itemTagsByName = {
    'こだわりハチマキ':['choiceBand'], 'こだわりメガネ':['choiceSpecs'], 'ふといホネ':['thickClub'], 'しんかいのキバ':['deepSeaTooth'], 'でんきだま':['lightBall'],
    'しんかいのウロコ':['deepSeaScale'], 'メタルパウダー':['metalPowder'], 'しんかのきせき':['eviolite'], 'とつげきチョッキ':['assaultVest'],
    'たつじんのおび':['expertBelt'], 'メトロノーム':['metronomeItem'], 'いのちのたま':['lifeOrb'], 'ねらいのまと':['ringTarget'], 'パンチグローブ':['punchingGlove']
  };
  D.items = (D.items || []).map(it => {
    it.effectTags = uniq(arr(it.effectTags).concat(itemTagsByName[it.name] || []));
    if(itemTargetMap[it.name]) it.targetSpeciesKeys = uniq(arr(it.targetSpeciesKeys).concat(arr(it.targetSpecies)).concat(itemTargetMap[it.name]));
    return it;
  });

  const abilityTagsByName = {
    'カブトアーマー':['criticalBlock'],'シェルアーマー':['criticalBlock'],'ノーてんき':['ignoreWeather'],'エアロック':['ignoreWeather'],
    'かたやぶり':['moldBreakerEffect'],'ターボブレイズ':['moldBreakerEffect'],'テラボルテージ':['moldBreakerEffect'],
    'ぶきよう':['itemSuppress'],'きんちょうかん':['berrySuppressOpponent'],'ふゆう':['levitate'],'うなぎのぼり':['levitate'],
    'マジックガード':['hazardImmune'],'きもったま':['ghostBypass'],'しんがん':['ghostBypass'],
    'こんがりボディ':['typeImmunity'],'そうしょく':['typeImmunity'],'ちくでん':['typeImmunity'],'ちょすい':['typeImmunity'],'でんきエンジン':['typeImmunity'],'どしょく':['typeImmunity'],'ひらいしん':['typeImmunity'],'もらいび':['typeImmunity'],'よびみず':['typeImmunity'],
    'ふしぎなまもり':['wonderGuard'],'テラスシェル':['teraShell'],'こおりのりんぷん':['damageReduction'],'パンクロック':['damageReduction'],'ファントムガード':['damageReduction'],'マルチスケイル':['damageReduction'],
    'ハードロック':['superEffectiveReduction'],'フィルター':['superEffectiveReduction'],'プリズムアーマー':['superEffectiveReduction'],
    'てきおうりょく':['stabModifier'],'おやこあい':['parentalBond'],'ひとでなし':['merciless'],'えんかく':['nonContact'],
    'すりぬけ':['screenBypass'],'スナイパー':['criticalDamageBoost'],'いろめがね':['notVeryEffectiveBoost'],'ブレインフォース':['superEffectiveBoost'],
    'ふかしのこぶし':['protectPiercingContact'],'かんつうドリル':['protectPiercingContact']
  };
  D.abilities = (D.abilities || []).map(a => { a.effectTags = uniq(arr(a.effectTags).concat(abilityTagsByName[a.name] || [])); return a; });
  D.schemaVersion = 'v0.51-canonical';
  D.__nameReferenceCanonicalV048051 = true;
})();


// v0.53 generated data loader helpers
(function(){
  var root = (typeof window !== 'undefined') ? window : globalThis;
  var D = root.DAMEKE_DATA;
  if(!D) return;

  function generated(){ return root.DAMEKE_GENERATED_DATA || null; }
  function count(arr){ return Array.isArray(arr) ? arr.length : 0; }
  function duplicateNames(arr){
    var seen = Object.create(null);
    var dup = [];
    (arr || []).forEach(function(x){
      var n = x && x.name;
      if(!n) return;
      if(seen[n] === 1) dup.push(n);
      seen[n] = (seen[n] || 0) + 1;
    });
    return dup;
  }
  function duplicateIds(arr){
    var seen = Object.create(null);
    var dup = [];
    (arr || []).forEach(function(x){
      var n = x && x.id;
      if(!n) return;
      if(seen[n] === 1) dup.push(n);
      seen[n] = (seen[n] || 0) + 1;
    });
    return dup;
  }

  D.generatedDataReport = function(){
    var G = generated();
    if(!G){
      return { loaded:false, message:'data.generated.js が読み込まれていません。' };
    }
    return {
      loaded:true,
      schemaVersion:G.schemaVersion || '',
      counts:{
        pokemons:count(G.pokemons),
        moves:count(G.moves),
        abilities:count(G.abilities),
        items:count(G.items),
        zMaxMoves:count(G.zMaxMoves)
      },
      duplicates:{
        pokemonIds:duplicateIds(G.pokemons),
        pokemonNames:duplicateNames(G.pokemons),
        moveIds:duplicateIds(G.moves),
        moveNames:duplicateNames(G.moves),
        abilityIds:duplicateIds(G.abilities),
        abilityNames:duplicateNames(G.abilities),
        itemIds:duplicateIds(G.items),
        itemNames:duplicateNames(G.items)
      }
    };
  };

  D.useGeneratedData = function(parts){
    var G = generated();
    if(!G) throw new Error('data.generated.js が読み込まれていません。');
    parts = parts || {};
    if(parts.pokemons) D.pokemons = G.pokemons || [];
    if(parts.moves) D.moves = G.moves || [];
    if(parts.abilities) D.abilities = G.abilities || [];
    if(parts.items) D.items = G.items || [];
    if(parts.zMaxMoves){
      D.generatedZMaxMoves = G.zMaxMoves || [];
    }
    if(typeof D.normalizeCanonicalData === 'function') D.normalizeCanonicalData();
    return D.generatedDataReport();
  };
})();


// v0.54 generated moves integration helpers
(function(){
  var root = (typeof window !== 'undefined') ? window : globalThis;
  var D = root.DAMEKE_DATA;
  if(!D) return;

  function arr(x){ return Array.isArray(x) ? x : []; }
  function keyName(x){ return x && x.name ? String(x.name) : ''; }
  function keyId(x){ return x && x.id ? String(x.id) : ''; }
  function uniq(a){
    var seen = Object.create(null), out = [];
    arr(a).forEach(function(v){
      if(!v) return;
      v = String(v);
      if(seen[v]) return;
      seen[v] = true;
      out.push(v);
    });
    return out;
  }
  function legacyMoveTags(move){
    var tags = [];
    if(!move) return tags;
    if(move.contact) tags.push('contact');
    if(move.punch) tags.push('punch');
    if(move.cut) tags.push('cut');
    if(move.sound) tags.push('sound');
    if(move.bite) tags.push('bite');
    if(move.pulse) tags.push('pulse');
    if(move.recoil) tags.push('recoil');
    if(move.sheerForce) tags.push('sheerForce');
    if(move.fixedDamage || move.fixedDamageKind) tags.push('fixedDamage');
    if(move.alwaysCrit) tags.push('alwaysCrit');
    if(move.ignoresAbilities) tags.push('ignoresAbilities');
    return tags;
  }
  function indexMoves(moves){
    var byName = Object.create(null);
    var byId = Object.create(null);
    arr(moves).forEach(function(m){
      if(keyName(m) && !byName[keyName(m)]) byName[keyName(m)] = m;
      if(keyId(m) && !byId[keyId(m)]) byId[keyId(m)] = m;
    });
    return { byName: byName, byId: byId };
  }
  function mergeMove(generated, existing){
    if(!existing){
      var only = Object.assign({}, generated);
      only.tags = uniq(arr(generated.tags).concat(legacyMoveTags(generated)));
      return only;
    }

    // 既存Web版で実装済みだった特殊フラグ・powerKind等は維持する。
    // ただし、id/name/raw は生成データを優先し、Excel由来の識別と出典を残す。
    var merged = Object.assign({}, generated, existing);
    merged.id = generated.id || existing.id;
    merged.name = generated.name || existing.name;
    merged.raw = generated.raw || existing.raw || null;

    // 生成側と既存側のタグを合成する。旧booleanからのタグもこの段階で吸収する。
    merged.tags = uniq(arr(generated.tags).concat(arr(existing.tags), legacyMoveTags(generated), legacyMoveTags(existing)));

    // 生成側にしかない基本情報は、既存側が空なら補う。
    ['type','category','power','priority','target','contact','hitCountMin','hitCountMax','fixedDamageKind'].forEach(function(k){
      if((existing[k] === undefined || existing[k] === null || existing[k] === '') && generated[k] !== undefined){
        merged[k] = generated[k];
      }
    });

    return merged;
  }

  D.integrateGeneratedMoves = function(){
    var G = root.DAMEKE_GENERATED_DATA;
    if(!G || !Array.isArray(G.moves)){
      throw new Error('data.generated.js が読み込まれていないか、moves がありません。');
    }
    var before = arr(D.moves);
    var idx = indexMoves(before);
    var usedExistingNames = Object.create(null);
    var merged = arr(G.moves).map(function(g){
      var e = idx.byName[keyName(g)] || idx.byId[keyId(g)] || null;
      if(e && keyName(e)) usedExistingNames[keyName(e)] = true;
      return mergeMove(g, e);
    });

    // 生成Excelに存在しないが、Web側にだけ存在する仮技は末尾に残す。
    before.forEach(function(e){
      if(!keyName(e)) return;
      if(usedExistingNames[keyName(e)]) return;
      merged.push(Object.assign({}, e, { tags: uniq(arr(e.tags).concat(legacyMoveTags(e))) }));
    });

    D.moves = merged;
    if(typeof D.normalizeCanonicalData === 'function') D.normalizeCanonicalData();
    D.__generatedMovesIntegrated = true;
    return D.generatedMoveIntegrationReport();
  };

  D.generatedMoveIntegrationReport = function(){
    var G = root.DAMEKE_GENERATED_DATA || {};
    var moves = arr(D.moves);
    var duplicateNames = [];
    var seen = Object.create(null);
    moves.forEach(function(m){
      var n = keyName(m);
      if(!n) return;
      if(seen[n] === 1) duplicateNames.push(n);
      seen[n] = (seen[n] || 0) + 1;
    });
    return {
      integrated: !!D.__generatedMovesIntegrated,
      generatedMoves: arr(G.moves).length,
      currentMoves: moves.length,
      duplicateMoveNames: duplicateNames,
      sample: moves.slice(0, 5).map(function(m){ return { name:m.name, type:m.type, category:m.category, power:m.power, tags:m.tags }; })
    };
  };
})();


// fix v0.54 exclude signature Z moves from normal move list
(function(){
  var root = (typeof window !== 'undefined') ? window : globalThis;
  var D = root.DAMEKE_DATA;
  if(!D) return;

  var SIGNATURE_Z_MOVE_NAMES = {
    'てんこがすめつぼうのひかり': true,
    'ハイパーダーククラッシャー': true,
    'ガーディアン・デ・アローラ': true
  };

  function isExcludedSignatureZMove(move){
    return !!(move && SIGNATURE_Z_MOVE_NAMES[String(move.name || '')]);
  }

  D.isExcludedSignatureZMove = isExcludedSignatureZMove;

  var originalIntegrateGeneratedMoves = D.integrateGeneratedMoves;
  if(typeof originalIntegrateGeneratedMoves === 'function' && !originalIntegrateGeneratedMoves.__excludeSignatureZWrapped){
    var wrapped = function(){
      var report = originalIntegrateGeneratedMoves.apply(this, arguments);
      if(Array.isArray(D.moves)){
        D.moves = D.moves.filter(function(m){ return !isExcludedSignatureZMove(m); });
      }
      if(typeof D.normalizeCanonicalData === 'function') D.normalizeCanonicalData();
      if(report && typeof report === 'object'){
        report.currentMovesAfterSignatureZExclusion = Array.isArray(D.moves) ? D.moves.length : 0;
        report.excludedSignatureZMoves = Object.keys(SIGNATURE_Z_MOVE_NAMES);
      }
      return report;
    };
    wrapped.__excludeSignatureZWrapped = true;
    D.integrateGeneratedMoves = wrapped;
  }

  // すでに v0.54 loader により統合済みの場合も、即時に除外する。
  if(Array.isArray(D.moves)){
    D.moves = D.moves.filter(function(m){ return !isExcludedSignatureZMove(m); });
  }
})();


// v0.55 generated pokemons integration helpers
(function(){
  var root = (typeof window !== 'undefined') ? window : globalThis;
  var D = root.DAMEKE_DATA;
  if(!D) return;

  function arr(x){ return Array.isArray(x) ? x : []; }
  function keyName(x){ return x && x.name ? String(x.name) : ''; }
  function keyId(x){ return x && x.id ? String(x.id) : ''; }
  function hasOwn(o,k){ return Object.prototype.hasOwnProperty.call(o || {}, k); }
  function uniq(a){
    var seen = Object.create(null), out = [];
    arr(a).forEach(function(v){
      if(!v) return;
      v = String(v);
      if(seen[v]) return;
      seen[v] = true;
      out.push(v);
    });
    return out;
  }
  function indexPokemons(pokemons){
    var byName = Object.create(null);
    var byId = Object.create(null);
    arr(pokemons).forEach(function(p){
      if(keyName(p) && !byName[keyName(p)]) byName[keyName(p)] = p;
      if(keyId(p) && !byId[keyId(p)]) byId[keyId(p)] = p;
    });
    return { byName: byName, byId: byId };
  }
  function cloneStats(s){
    s = s || {};
    return { H:+s.H || 0, A:+s.A || 0, B:+s.B || 0, C:+s.C || 0, D:+s.D || 0, S:+s.S || 0 };
  }
  function mergePokemon(generated, existing){
    if(!existing){
      var only = Object.assign({}, generated);
      only.baseStats = cloneStats(generated.baseStats);
      only.types = arr(generated.types).slice();
      only.abilities = arr(generated.abilities).slice();
      only.specialFormTags = uniq(generated.specialFormTags);
      return only;
    }

    // Excel生成データを基本にする。ただし、Web側で調整済みのフラグや補助情報は失わない。
    var merged = Object.assign({}, existing, generated);
    merged.id = generated.id || existing.id;
    merged.name = generated.name || existing.name;
    merged.baseStats = cloneStats(generated.baseStats || existing.baseStats);
    merged.types = arr(generated.types && generated.types.length ? generated.types : existing.types).slice();
    merged.abilities = arr(generated.abilities && generated.abilities.length ? generated.abilities : existing.abilities).slice();
    merged.weight = (generated.weight !== undefined && generated.weight !== null && generated.weight !== '') ? generated.weight : existing.weight;

    // generated 側で null/false 初期値になりやすい項目は、既存が明示値を持つ場合に維持する。
    if(generated.canEvolve === null || generated.canEvolve === undefined){
      if(hasOwn(existing, 'canEvolve')) merged.canEvolve = existing.canEvolve;
    }
    if(existing.cannotDynamax === true) merged.cannotDynamax = true;
    else if(hasOwn(generated, 'cannotDynamax')) merged.cannotDynamax = !!generated.cannotDynamax;

    merged.speciesKey = generated.speciesKey || existing.speciesKey || merged.name;
    merged.formKey = generated.formKey || existing.formKey || merged.name;
    merged.baseSpecies = generated.baseSpecies || existing.baseSpecies || merged.speciesKey;
    merged.specialFormTags = uniq(arr(generated.specialFormTags).concat(arr(existing.specialFormTags)));

    // 将来の変換確認用に元データがあれば保持。
    if(generated.raw) merged.raw = generated.raw;
    return merged;
  }

  D.integrateGeneratedPokemons = function(){
    var G = root.DAMEKE_GENERATED_DATA;
    if(!G || !Array.isArray(G.pokemons)){
      throw new Error('data.generated.js が読み込まれていないか、pokemons がありません。');
    }
    var before = arr(D.pokemons);
    var idx = indexPokemons(before);
    var usedExistingNames = Object.create(null);
    var merged = arr(G.pokemons).map(function(g){
      var e = idx.byName[keyName(g)] || idx.byId[keyId(g)] || null;
      if(e && keyName(e)) usedExistingNames[keyName(e)] = true;
      return mergePokemon(g, e);
    });

    // Excel側に存在しないが、Web側にだけ存在する仮ポケモンは末尾に残す。
    before.forEach(function(e){
      if(!keyName(e)) return;
      if(usedExistingNames[keyName(e)]) return;
      merged.push(mergePokemon(e, e));
    });

    D.pokemons = merged;
    if(typeof D.normalizeCanonicalData === 'function') D.normalizeCanonicalData();
    D.__generatedPokemonsIntegrated = true;
    return D.generatedPokemonIntegrationReport();
  };

  D.generatedPokemonIntegrationReport = function(){
    var G = root.DAMEKE_GENERATED_DATA || {};
    var pokemons = arr(D.pokemons);
    var duplicateNames = [];
    var duplicateIds = [];
    var seenNames = Object.create(null);
    var seenIds = Object.create(null);
    pokemons.forEach(function(p){
      var n = keyName(p);
      var i = keyId(p);
      if(n){ if(seenNames[n] === 1) duplicateNames.push(n); seenNames[n] = (seenNames[n] || 0) + 1; }
      if(i){ if(seenIds[i] === 1) duplicateIds.push(i); seenIds[i] = (seenIds[i] || 0) + 1; }
    });
    return {
      integrated: !!D.__generatedPokemonsIntegrated,
      generatedPokemons: arr(G.pokemons).length,
      currentPokemons: pokemons.length,
      duplicatePokemonNames: duplicateNames,
      duplicatePokemonIds: duplicateIds,
      sample: pokemons.slice(0, 5).map(function(p){ return { name:p.name, types:p.types, baseStats:p.baseStats, weight:p.weight, abilities:p.abilities }; })
    };
  };
})();


// v0.56 generated abilities integration helpers
(function(){
  var root = (typeof window !== 'undefined') ? window : globalThis;
  var D = root.DAMEKE_DATA;
  if(!D) return;

  function arr(x){ return Array.isArray(x) ? x : []; }
  function keyName(x){ return x && x.name ? String(x.name) : ''; }
  function keyId(x){ return x && x.id ? String(x.id) : ''; }
  function hasOwn(o,k){ return Object.prototype.hasOwnProperty.call(o || {}, k); }
  function uniq(a){
    var seen = Object.create(null), out = [];
    arr(a).forEach(function(v){
      if(!v) return;
      v = String(v);
      if(seen[v]) return;
      seen[v] = true;
      out.push(v);
    });
    return out;
  }
  function indexAbilities(abilities){
    var byName = Object.create(null);
    var byId = Object.create(null);
    arr(abilities).forEach(function(a){
      if(keyName(a) && !byName[keyName(a)]) byName[keyName(a)] = a;
      if(keyId(a) && !byId[keyId(a)]) byId[keyId(a)] = a;
    });
    return { byName: byName, byId: byId };
  }
  function legacyAbilityTags(ability){
    var tags = [];
    if(!ability) return tags;
    if(ability.ignorableByMoldBreaker) tags.push('ignorableByMoldBreaker');
    var kind = ability.kind || '';
    if(kind === 'CriticalBlock') tags.push('criticalBlock');
    if(kind === 'IgnoreWeather') tags.push('ignoreWeather');
    if(kind === 'MoldBreakerEffect') tags.push('moldBreakerEffect');
    if(kind === 'ItemSuppress') tags.push('itemSuppress');
    if(kind === 'BerrySuppressOpponent') tags.push('berrySuppressOpponent');
    if(kind === 'Levitate') tags.push('levitate');
    if(kind === 'WonderGuard') tags.push('wonderGuard');
    if(kind === 'TeraShell') tags.push('teraShell');
    return tags;
  }
  function mergeAbility(generated, existing){
    if(!existing){
      var only = Object.assign({}, generated);
      only.effectTags = uniq(arr(generated.effectTags).concat(legacyAbilityTags(generated)));
      only.ignorableByMoldBreaker = !!generated.ignorableByMoldBreaker;
      only.kind = generated.kind || 'Generic';
      return only;
    }

    // 既存Web版の kind / effectTags / 特別フラグを優先する。
    // Excel生成側は件数・名称・かたやぶり対象・raw情報の補完に使う。
    var merged = Object.assign({}, generated, existing);
    merged.id = generated.id || existing.id;
    merged.name = generated.name || existing.name;

    // kind は既存側が Generic 以外なら維持。既存が空または Generic なら生成側で補完。
    if(existing.kind && existing.kind !== 'Generic') merged.kind = existing.kind;
    else merged.kind = generated.kind || existing.kind || 'Generic';

    // かたやぶり対象は true を優先。Excel側のフラグも必ず反映する。
    merged.ignorableByMoldBreaker = !!(existing.ignorableByMoldBreaker || generated.ignorableByMoldBreaker);

    merged.effectTags = uniq(
      arr(generated.effectTags)
        .concat(arr(existing.effectTags))
        .concat(legacyAbilityTags(generated))
        .concat(legacyAbilityTags(existing))
        .concat(merged.ignorableByMoldBreaker ? ['ignorableByMoldBreaker'] : [])
    );

    // Excel由来の補助情報は raw として保持する。
    if(generated.raw) merged.raw = generated.raw;
    return merged;
  }

  D.integrateGeneratedAbilities = function(){
    var G = root.DAMEKE_GENERATED_DATA;
    if(!G || !Array.isArray(G.abilities)){
      throw new Error('data.generated.js が読み込まれていないか、abilities がありません。');
    }
    var before = arr(D.abilities);
    var idx = indexAbilities(before);
    var usedExistingNames = Object.create(null);
    var merged = arr(G.abilities).map(function(g){
      var e = idx.byName[keyName(g)] || idx.byId[keyId(g)] || null;
      if(e && keyName(e)) usedExistingNames[keyName(e)] = true;
      return mergeAbility(g, e);
    });

    // Excel側に存在しないが、Web側にだけ存在する仮特性は末尾に残す。
    before.forEach(function(e){
      if(!keyName(e)) return;
      if(usedExistingNames[keyName(e)]) return;
      merged.push(mergeAbility(e, e));
    });

    D.abilities = merged;
    if(typeof D.normalizeCanonicalData === 'function') D.normalizeCanonicalData();
    D.__generatedAbilitiesIntegrated = true;
    return D.generatedAbilityIntegrationReport();
  };

  D.generatedAbilityIntegrationReport = function(){
    var G = root.DAMEKE_GENERATED_DATA || {};
    var abilities = arr(D.abilities);
    var duplicateNames = [];
    var duplicateIds = [];
    var seenNames = Object.create(null);
    var seenIds = Object.create(null);
    var moldBreakerCount = 0;
    abilities.forEach(function(a){
      var n = keyName(a);
      var i = keyId(a);
      if(n){ if(seenNames[n] === 1) duplicateNames.push(n); seenNames[n] = (seenNames[n] || 0) + 1; }
      if(i){ if(seenIds[i] === 1) duplicateIds.push(i); seenIds[i] = (seenIds[i] || 0) + 1; }
      if(a && a.ignorableByMoldBreaker) moldBreakerCount++;
    });
    return {
      integrated: !!D.__generatedAbilitiesIntegrated,
      generatedAbilities: arr(G.abilities).length,
      currentAbilities: abilities.length,
      moldBreakerIgnorableCount: moldBreakerCount,
      duplicateAbilityNames: duplicateNames,
      duplicateAbilityIds: duplicateIds,
      sample: abilities.slice(0, 8).map(function(a){ return { name:a.name, kind:a.kind, ignorableByMoldBreaker:a.ignorableByMoldBreaker, effectTags:a.effectTags }; })
    };
  };
})();


// v0.57 generated items integration helpers
(function(){
  var root = (typeof window !== 'undefined') ? window : globalThis;
  var D = root.DAMEKE_DATA;
  if(!D) return;

  function arr(x){ return Array.isArray(x) ? x : []; }
  function keyName(x){ return x && x.name ? String(x.name) : ''; }
  function keyId(x){ return x && x.id ? String(x.id) : ''; }
  function hasOwn(o,k){ return Object.prototype.hasOwnProperty.call(o || {}, k); }
  function uniq(a){
    var seen = Object.create(null), out = [];
    arr(a).forEach(function(v){
      if(!v) return;
      v = String(v);
      if(seen[v]) return;
      seen[v] = true;
      out.push(v);
    });
    return out;
  }
  function indexItems(items){
    var byName = Object.create(null);
    var byId = Object.create(null);
    arr(items).forEach(function(item){
      if(keyName(item) && !byName[keyName(item)]) byName[keyName(item)] = item;
      if(keyId(item) && !byId[keyId(item)]) byId[keyId(item)] = item;
    });
    return { byName: byName, byId: byId };
  }
  function legacyItemTags(item){
    var tags = [];
    if(!item) return tags;
    var kind = item.kind || '';
    if(item.isBerry) tags.push('berry');
    if(item.type) tags.push('typed');
    if(item.naturalGiftType || item.naturalGiftPower) tags.push('naturalGift');
    if(item.flingPower !== undefined && item.flingPower !== null) tags.push('fling');
    if(kind === 'ResistBerry') tags.push('resistBerry');
    if(kind === 'RingTarget') tags.push('ringTarget');
    if(kind === 'PunchingGlove') tags.push('punchingGlove');
    if(kind === 'LifeOrb') tags.push('lifeOrb');
    if(kind === 'ExpertBelt') tags.push('expertBelt');
    if(kind === 'MetronomeItem') tags.push('metronomeItem');
    if(kind === 'ChoiceBand') tags.push('choiceBand');
    if(kind === 'ChoiceSpecs') tags.push('choiceSpecs');
    if(kind === 'ChoiceScarf') tags.push('choiceScarf');
    if(kind === 'PowerItem') tags.push('powerItem');
    if(kind === 'TypeBoost') tags.push('typeBoost');
    if(kind === 'Plate') tags.push('plate');
    if(kind === 'Gem') tags.push('gem');
    return tags;
  }
  function mergeItem(generated, existing){
    if(!existing){
      var only = Object.assign({}, generated);
      only.effectTags = uniq(arr(generated.effectTags).concat(legacyItemTags(generated)));
      only.kind = generated.kind || 'Generic';
      return only;
    }

    // 既存Web版の kind / effectTags / type / targetSpeciesKeys などの調整済み情報を優先する。
    // Excel生成側は件数・名称・しぜんのめぐみ・なげつける・raw情報の補完に使う。
    var merged = Object.assign({}, generated, existing);
    merged.id = generated.id || existing.id;
    merged.name = generated.name || existing.name;

    if(existing.kind && existing.kind !== 'Generic') merged.kind = existing.kind;
    else merged.kind = generated.kind || existing.kind || 'Generic';

    // タイプ付き道具や半減実で既存側が type を調整済みなら維持。なければ生成側で補完。
    if(existing.type !== undefined && existing.type !== null && existing.type !== '') merged.type = existing.type;
    else if(generated.type !== undefined) merged.type = generated.type;

    // しぜんのめぐみ・なげつけるはExcel生成側の値を優先。ただし既存側に手調整値があり生成側が空なら維持。
    ['naturalGiftPower','naturalGiftType','flingPower'].forEach(function(k){
      if(generated[k] !== undefined && generated[k] !== null && generated[k] !== '') merged[k] = generated[k];
      else if(existing[k] !== undefined) merged[k] = existing[k];
    });

    if(hasOwn(existing, 'isBerry')) merged.isBerry = !!existing.isBerry;
    else if(hasOwn(generated, 'isBerry')) merged.isBerry = !!generated.isBerry;

    merged.effectTags = uniq(
      arr(generated.effectTags)
        .concat(arr(existing.effectTags))
        .concat(legacyItemTags(generated))
        .concat(legacyItemTags(existing))
    );

    // 対象ポケモン系は既存Web版の調整済み情報を維持。
    merged.targetSpecies = arr(existing.targetSpecies).length ? arr(existing.targetSpecies).slice() : arr(generated.targetSpecies).slice();
    merged.targetSpeciesKeys = arr(existing.targetSpeciesKeys).length ? arr(existing.targetSpeciesKeys).slice() : arr(generated.targetSpeciesKeys).slice();
    merged.targetSpeciesGroup = existing.targetSpeciesGroup || generated.targetSpeciesGroup || null;

    if(generated.raw) merged.raw = generated.raw;
    return merged;
  }

  D.integrateGeneratedItems = function(){
    var G = root.DAMEKE_GENERATED_DATA;
    if(!G || !Array.isArray(G.items)){
      throw new Error('data.generated.js が読み込まれていないか、items がありません。');
    }
    var before = arr(D.items);
    var idx = indexItems(before);
    var usedExistingNames = Object.create(null);
    var merged = arr(G.items).map(function(g){
      var e = idx.byName[keyName(g)] || idx.byId[keyId(g)] || null;
      if(e && keyName(e)) usedExistingNames[keyName(e)] = true;
      return mergeItem(g, e);
    });

    // Excel側に存在しないが、Web側にだけ存在する仮道具は末尾に残す。
    before.forEach(function(e){
      if(!keyName(e)) return;
      if(usedExistingNames[keyName(e)]) return;
      merged.push(mergeItem(e, e));
    });

    D.items = merged;
    if(typeof D.normalizeCanonicalData === 'function') D.normalizeCanonicalData();
    D.__generatedItemsIntegrated = true;
    return D.generatedItemIntegrationReport();
  };

  D.generatedItemIntegrationReport = function(){
    var G = root.DAMEKE_GENERATED_DATA || {};
    var items = arr(D.items);
    var duplicateNames = [];
    var duplicateIds = [];
    var seenNames = Object.create(null);
    var seenIds = Object.create(null);
    var berryCount = 0;
    var naturalGiftCount = 0;
    var flingCount = 0;
    items.forEach(function(item){
      var n = keyName(item);
      var i = keyId(item);
      if(n){ if(seenNames[n] === 1) duplicateNames.push(n); seenNames[n] = (seenNames[n] || 0) + 1; }
      if(i){ if(seenIds[i] === 1) duplicateIds.push(i); seenIds[i] = (seenIds[i] || 0) + 1; }
      if(item && item.isBerry) berryCount++;
      if(item && (item.naturalGiftPower || item.naturalGiftType)) naturalGiftCount++;
      if(item && item.flingPower !== undefined && item.flingPower !== null) flingCount++;
    });
    return {
      integrated: !!D.__generatedItemsIntegrated,
      generatedItems: arr(G.items).length,
      currentItems: items.length,
      berryCount: berryCount,
      naturalGiftCount: naturalGiftCount,
      flingCount: flingCount,
      duplicateItemNames: duplicateNames,
      duplicateItemIds: duplicateIds,
      sample: items.slice(0, 8).map(function(item){ return { name:item.name, kind:item.kind, type:item.type, isBerry:item.isBerry, naturalGiftPower:item.naturalGiftPower, naturalGiftType:item.naturalGiftType, flingPower:item.flingPower, effectTags:item.effectTags }; })
    };
  };
})();


// v0.58 generated Z-Max integration helpers
(function(){
  var root = (typeof window !== 'undefined') ? window : globalThis;
  var D = root.DAMEKE_DATA;
  if(!D) return;

  function arr(x){ return Array.isArray(x) ? x : []; }
  function keyName(x){ return x && x.name ? String(x.name) : ''; }
  function keyId(x){ return x && x.id ? String(x.id) : ''; }
  function uniq(a){
    var seen = Object.create(null), out = [];
    arr(a).forEach(function(v){
      if(!v) return;
      v = String(v);
      if(seen[v]) return;
      seen[v] = true;
      out.push(v);
    });
    return out;
  }
  function indexByName(list){
    var out = Object.create(null);
    arr(list).forEach(function(x){
      var n = keyName(x);
      if(n && !out[n]) out[n] = x;
    });
    return out;
  }
  function parseAppliesWhen(raw){
    raw = raw == null ? '' : String(raw).trim();
    if(!raw) return null;
    return raw;
  }
  function normalizeZMaxMove(generated, existing){
    var base = Object.assign({}, existing || {}, generated || {});
    base.id = keyId(generated) || keyId(existing) || keyName(base);
    base.name = keyName(generated) || keyName(existing) || base.id;
    base.tags = uniq(arr(generated && generated.tags).concat(arr(existing && existing.tags)));
    base.appliesWhenRaw = parseAppliesWhen((generated && generated.appliesWhenRaw) || (existing && existing.appliesWhenRaw));
    if(generated && generated.raw) base.raw = generated.raw;
    return base;
  }

  D.integrateGeneratedZMax = function(){
    var G = root.DAMEKE_GENERATED_DATA;
    if(!G || !Array.isArray(G.zMaxMoves)){
      throw new Error('data.generated.js が読み込まれていないか、zMaxMoves がありません。');
    }
    D.zMax = D.zMax || {};

    var existingList = arr(D.zMax.generatedMoves);
    var existingByName = indexByName(existingList);
    var normalized = arr(G.zMaxMoves).map(function(g){
      return normalizeZMaxMove(g, existingByName[keyName(g)] || null);
    });

    D.zMax.generatedMoves = normalized;
    D.zMax.generatedMoveByName = indexByName(normalized);

    // 既存の zByType / maxByType / signatureZ / gmaxByPokemonType などは変更しない。
    // Excel由来データは、まず参照用補助データとして保持する。
    D.__generatedZMaxIntegrated = true;
    return D.generatedZMaxIntegrationReport();
  };

  D.generatedZMaxIntegrationReport = function(){
    var G = root.DAMEKE_GENERATED_DATA || {};
    var list = arr(D.zMax && D.zMax.generatedMoves);
    var duplicateNames = [];
    var duplicateIds = [];
    var seenNames = Object.create(null);
    var seenIds = Object.create(null);
    list.forEach(function(x){
      var n = keyName(x);
      var i = keyId(x);
      if(n){ if(seenNames[n] === 1) duplicateNames.push(n); seenNames[n] = (seenNames[n] || 0) + 1; }
      if(i){ if(seenIds[i] === 1) duplicateIds.push(i); seenIds[i] = (seenIds[i] || 0) + 1; }
    });
    return {
      integrated: !!D.__generatedZMaxIntegrated,
      generatedZMaxMoves: arr(G.zMaxMoves).length,
      currentZMaxMoves: list.length,
      duplicateZMaxMoveNames: duplicateNames,
      duplicateZMaxMoveIds: duplicateIds,
      sample: list.slice(0, 8).map(function(x){ return { name:x.name, type:x.type, category:x.category, power:x.power, tags:x.tags, appliesWhenRaw:x.appliesWhenRaw }; })
    };
  };
})();
