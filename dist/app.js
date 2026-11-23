(() => {
  'use strict';

  const data = window.ATLAS_DATA;
  const main = document.querySelector('#main');
  if (!data) {
    main.innerHTML = '<div class="loading">图鉴资料加载失败，请刷新页面重试。</div>';
    return;
  }

  const deityMap = new Map(data.deities.map(item => [item.id, item]));
  const sourceMap = new Map(data.sources.map(item => [item.id, item]));
  const templeMap = new Map(data.temples.map(item => [item.id, item]));
  const articleMap = new Map(data.articles.map(item => [item.id, item]));
  const imageMap = new Map(data.images.map(item => [item.id, item]));
  const dialog = document.querySelector('#search-dialog');
  const searchInput = document.querySelector('#global-search');
  let saved = readSaved();
  let atlasFilter = '全部';
  let atlasQuery = '';
  let atlasLimit = 16;
  let relationFilter = '全部';
  let templeQuery = '';
  let templeRegion = '全部地区';
  let templeType = '全部类型';
  let toastTimer;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const normalize = value => String(value ?? '').toLowerCase().replace(/[\s·，、]/g, '');
  const joinText = value => Array.isArray(value) ? value.join('、') : String(value || '');

  function readSaved() {
    try {
      const value = JSON.parse(localStorage.getItem('shenyou-saved') || '[]');
      return new Set(Array.isArray(value) ? value.filter(id => deityMap.has(id)) : []);
    } catch {
      return new Set();
    }
  }

  function updateSavedCount() {
    document.querySelector('#saved-count').textContent = saved.size ? saved.size : '';
  }

  function notify(message) {
    const toast = document.querySelector('#toast');
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 2600);
  }

  function saveDeity(id) {
    if (saved.has(id)) saved.delete(id);
    else saved.add(id);
    try {
      localStorage.setItem('shenyou-saved', JSON.stringify([...saved]));
      notify(saved.has(id) ? '已收入藏签，旅行时可以再翻看' : '已从藏签中移除');
    } catch {
      notify('本次浏览已记录，当前浏览器无法保存到下次');
    }
    updateSavedCount();
    document.querySelectorAll('[data-action="save"]').forEach(button => {
      if (button.dataset.id === id) {
        button.innerHTML = `<span class="bookmark-symbol"></span>${saved.has(id) ? '已收藏' : '收入藏签'}`;
        button.setAttribute('aria-pressed', String(saved.has(id)));
      }
    });
    if (location.hash === '#saved') renderSaved();
  }

  function getImage(deity) {
    if (!deity) return null;
    if (deity.image && imageMap.has(deity.image)) return imageMap.get(deity.image);
    const match = data.images.find(image => image.depicts.includes(deity.id) && !image.id.includes('hero') && image.id !== 'xiwangmu');
    return match || null;
  }

  function artImage(image, extraClass = '', eager = false) {
    return `<img class="${esc(extraClass)}" src="assets/${esc(image.filename)}" alt="${esc(image.title)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async">`;
  }

  function imageCredit(image, showTitle = true) {
    if (!image) return '';
    return `<div class="image-credit">${showTitle ? `${esc(image.title)}<br>` : ''}${esc(image.credit)} · <a href="${esc(image.sourceUrl)}" target="_blank" rel="noopener noreferrer">图像原出处</a> · <a href="${esc(image.licenseUrl || image.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(image.license)}</a>${image.changes ? `<br>${esc(image.changes)}` : ''}${image.note ? `<br>${esc(image.note)}` : ''}</div>`;
  }

  function deityCard(deity) {
    if (!deity) return '';
    const image = getImage(deity);
    const count = relationsFor(deity.id).length;
    const visual = image
      ? `<div class="deity-image">${artImage(image)}<span class="image-kind">${esc(image.depictionType || image.kind)}</span></div>`
      : `<div class="type-art"><span>${esc(deity.name.replace(/大帝|帝君|菩萨|天尊/g, '').slice(0, 4))}</span></div>`;
    return `<a class="deity-card" href="#deity/${esc(deity.id)}">${visual}<div class="deity-card-content"><div class="card-label">${esc(deity.tradition)} · ${esc(deity.group)}</div><h3>${esc(deity.name)}</h3><p>${esc(deity.hook || deity.role)}</p><div class="card-meta"><span>${count ? `${count} 条相关关系` : '认识这位神明'}</span><span>读一段故事</span></div></div></a>`;
  }

  function templeImage(temple) {
    const direct = temple.image ? imageMap.get(temple.image) : null;
    return direct || null;
  }

  function templeCard(temple) {
    const image = templeImage(temple);
    const names = temple.deities.map(id => deityMap.get(id)?.name).filter(Boolean).slice(0, 3);
    return `<a class="temple-card ${image ? '' : 'no-photo'}" href="#temple/${esc(temple.id)}">${image ? `<div class="temple-image">${artImage(image)}<span class="location-chip">${esc(temple.city)}</span></div>` : `<div class="temple-card-location"><span>${esc(temple.city)}</span><span>${esc(temple.type || '旅行看庙')}</span></div>`}<div class="temple-copy"><h3>${esc(temple.name)}</h3><p>${esc(temple.summary)}</p><div class="deity-names">遇见 ${esc(names.join(' · '))}</div></div></a>`;
  }

  function storyCard(article) {
    return `<a class="story-card" href="#article/${esc(article.id)}"><div class="card-label">${esc(article.kicker)}</div><h3>${esc(article.title)}</h3><p>${esc(article.summary)}</p><span class="read-more">展开读一读</span></a>`;
  }

  function sourceList(ids) {
    const sources = [...new Set(ids || [])].map(id => sourceMap.get(id)).filter(Boolean);
    if (!sources.length) return '<p>相关资料正在补充。</p>';
    return `<ul class="source-list">${sources.map(source => `<li><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)}</a><small>${esc(source.publisher)}</small></li>`).join('')}</ul>`;
  }

  function relationsFor(id) {
    return data.relations.filter(relation => relation.from === id || relation.to === id);
  }

  function contextCategory(context) {
    const value = String(context || '');
    if (/文学|小说|西游|封神/.test(value)) return '文学故事';
    if (/佛教|佛寺/.test(value)) return '佛教';
    if (/道教|神谱|四御|三清|科仪/.test(value)) return '道教';
    return '地方与民俗';
  }

  function breadcrumb(items) {
    return `<div class="breadcrumb"><a href="#home">神游</a>${items.map(item => `<span>／</span>${item.href ? `<a href="${esc(item.href)}">${esc(item.label)}</a>` : esc(item.label)}`).join('')}</div>`;
  }

  function featuredList(ids, count) {
    return ids.map(id => deityMap.get(id)).filter(Boolean).slice(0, count);
  }

  function homeGraph() {
    const nodes = [
      {id:'bixia', x:315, y:58, label:'泰山信仰'},
      {id:'fengdu', x:510, y:165, label:'生死信仰比较'},
      {id:'dizang', x:450, y:345, label:'台南东岳殿'},
      {id:'zhaogongming', x:165, y:345, label:'北京东岳庙'},
      {id:'songzi', x:110, y:135, label:'北京东岳庙'}
    ].filter(node => deityMap.has(node.id));
    return `<svg viewBox="0 0 620 420" role="group" aria-label="从东岳大帝探索泰山信仰、冥府与地方神的相关关系"><circle class="graph-ring" cx="310" cy="210" r="155"/><circle class="graph-ring" cx="310" cy="210" r="195"/>${nodes.map(node => `<path class="graph-line" d="M310 210 L${node.x} ${node.y}"/>`).join('')}<a href="#relations/dongyue" aria-label="探索东岳大帝的关系"><circle class="center-disc" cx="310" cy="210" r="60"/><text x="310" y="205" style="font-size:21px">东岳大帝</text><text class="small-label" x="310" y="231">从泰山到人间</text></a>${nodes.map(node => `<a href="#relations/${node.id}" aria-label="探索${esc(deityMap.get(node.id).name)}的关系"><circle class="node-disc" cx="${node.x}" cy="${node.y}" r="43"/><text x="${node.x}" y="${node.y + 5}">${esc(deityMap.get(node.id).name)}</text><text class="small-label" x="${node.x}" y="${node.y + 66}">${node.label}</text></a>`).join('')}</svg>`;
  }

  function renderHome() {
    const hero = imageMap.get('hero-large') || imageMap.get('hero');
    const recommended = featuredList(['guandi','guanyin','zhenwu','mazu'], 4);
    const temples = ['wudang','meizhou','jiezhou'].map(id => templeMap.get(id)).filter(Boolean);
    main.innerHTML = `<section class="hero">${hero ? `<div class="hero-art">${artImage(hero, '', true)}</div>` : ''}<div class="container hero-content"><div class="eyebrow">中国神仙与庙宇图鉴</div><h1>走进一座庙。<br>读懂<span>一方神明。</span></h1><p>那些见过、听过，却叫不出名字的神明，<br>都有值得认识的来历。</p><div class="hero-buttons"><a href="#atlas" class="button gold">开启神游</a><a href="#temples" class="button ghost">带着图鉴去看庙</a></div></div>${hero ? `<a class="art-caption" href="#sources">${esc(hero.title)}<br>古画里的众神，也在人间的庙宇相逢</a>` : ''}</section>
    <div class="container"><div class="search-ribbon"><span class="search-ribbon-label">你在庙里遇见了谁？</span><button class="home-search-button" data-action="search"><span class="search-symbol"></span><span>搜名字、别名，或神像特征</span><kbd>⌘ K</kbd></button><div class="hot-terms"><a href="#deity/guanyin">观音</a><a href="#deity/guandi">关公</a><a href="#deity/wencang">文昌</a></div></div><div class="overview-entry"><span>想先看懂全貌？</span><a href="#overview/tao">道教神谱</a><a href="#overview/buddhist">佛与菩萨</a><a href="#overview/folk">民间神明</a><a href="#overview/myth">上古神话</a></div></div>
    <section class="section home-featured"><div class="container"><div class="section-head"><div><div class="eyebrow">先认识一位</div><h2>一面之缘，也有千年故事。</h2><p>从熟悉的名字出发，走进更辽阔的神明世界。</p></div><a class="text-link" href="#atlas">全部 ${data.deities.length} 条图鉴</a></div><div class="deity-grid">${recommended.map(deityCard).join('')}</div></div></section>
    <section class="section relation-feature"><div class="container relation-feature-layout"><div><div class="eyebrow">顺着关系，继续探索</div><h2>为什么，他们会在<br>同一座庙里？</h2><p>一位泰山神，如何与生死、城隍、娘娘信仰产生联系？点开一尊神明，看看与他相连的世界。</p><a class="button gold" href="#relations/dongyue">展开关系图谱</a><p class="feature-caption">每条关系附语境说明，读懂同组尊神、地方奉祀与文学故事。</p></div><div class="mini-graph">${homeGraph()}</div></div></section>
    <section class="section"><div class="container"><div class="section-head"><div><div class="eyebrow">带着图鉴去旅行</div><h2>下一座庙，多看懂一点。</h2><p>先认主神，再看配祀，最后读懂一座庙的地方记忆。</p></div><a href="#temples" class="text-link">${data.temples.length} 处看庙指南</a></div><div class="temple-grid">${temples.map(templeCard).join('')}</div><div class="travel-entry"><div><h2>记不清名字，<br>还记得神像长什么样？</h2><p>红脸长须、手持净瓶、脚踏龟蛇……从你看见的细节寻找线索。</p><a class="text-link" href="#identify">打开神像辨认手册</a></div><div class="clue-pills">${['红脸长须','净瓶杨柳','龟蛇','狮子','白象','孩童','宝剑','寿桃'].map(clue => `<button data-action="clue" data-query="${clue}">${clue}</button>`).join('')}</div></div></div></section>
    <section class="section" style="padding-top:0"><div class="container"><div class="section-head"><div><div class="eyebrow">慢慢读，才有意思</div><h2>那些一直想问的问题。</h2></div><a class="text-link" href="#learn">入门读本</a></div><div class="stories-grid">${data.articles.slice(0, 3).map(storyCard).join('')}</div></div></section>`;
  }

  const clueMatches = {
    '红脸长须':['guandi'], '红脸':['guandi'], '净瓶杨柳':['guanyin'], '净瓶':['guanyin'],
    '龟蛇':['zhenwu'], '狮子':['wenshu','qinghua'], '白象':['puxian'],
    '孩童':['songzi','guanyin','chenjinggu','nezha'], '孩子':['songzi','guanyin','chenjinggu'],
    '宝剑':['lvdongbin','zhenwu','wenshu','sitianwang'], '寿桃':['shouxing','xiwangmu','fulushou'],
    '猴子':['qitian'], '三头六臂':['nezha'], '三只眼':['erlang'], '学业':['wencang','kuixing'],
    '生死':['dongyue','yanluo','fengdu','dizang','chenghuang'], '财富':['caishen','zhaogongming','bigan','guandi','fanli'],
    '求子':['songzi','guanyin','bixia','chenjinggu'], '医药':['yaowang','shennong','yaoshi']
  };

  function matchesQuery(deity, query) {
    const keyword = normalize(query);
    if (!keyword) return true;
    const knownClue = Object.entries(clueMatches).find(([key]) => normalize(key) === keyword);
    if (knownClue) return knownClue[1].includes(deity.id);
    const haystack = normalize([deity.id,deity.name,...deity.aliases,deity.role,deity.group,deity.summary,deity.hook,deity.storyTitle,...deity.identify,...deity.symbols].join(' '));
    return haystack.includes(keyword);
  }

  function filteredDeities() {
    return data.deities.filter(deity => (atlasFilter === '全部' || deity.traditions.includes(atlasFilter)) && matchesQuery(deity, atlasQuery));
  }

  function atlasResults() {
    const results = filteredDeities();
    return `<div class="results-head"><span>找到 ${results.length} 个条目${atlasQuery ? ` · 「${esc(atlasQuery)}」` : ''}</span><span>点开图鉴，查看辨认线索与关系</span></div><div class="deity-grid">${results.length ? results.slice(0, atlasLimit).map(deityCard).join('') : `<div class="empty-state"><h3>换一个线索，继续找找。</h3><p>可以搜「王母」「城隍」「净瓶」「龟蛇」，或试试殿堂匾额上的完整名称。</p><button class="button" data-action="reset-atlas">查看全部神明</button></div>`}</div>${results.length > atlasLimit ? `<div class="load-more"><button class="button" data-action="more">再看 ${Math.min(results.length - atlasLimit, 16)} 条图鉴</button></div>` : ''}`;
  }

  function renderAtlas() {
    main.innerHTML = `<div class="container"><div class="page-intro"><div class="eyebrow">神仙图鉴</div><h1>每一尊，都有来处。</h1><p>认识神明的名字、神职与常见造像，顺着关系继续探索。</p></div><div class="search-input-wrap"><span class="search-symbol"></span><input id="atlas-search" type="search" value="${esc(atlasQuery)}" placeholder="试试王母、文昌、龟蛇，或你看见的法器" autocomplete="off" aria-label="搜索神仙图鉴"></div><div class="filter-tabs" role="group" aria-label="按信仰传统筛选">${['全部','道教','佛教','民间信仰','上古神话'].map(filter => `<button data-action="filter" data-filter="${filter}" class="${filter === atlasFilter ? 'active' : ''}" aria-pressed="${filter === atlasFilter}">${filter}</button>`).join('')}</div><div class="filter-bar" aria-label="按神职快速查找">${['生死','财富','学业','求子','医药'].map(query => `<button class="chip ${atlasQuery === query ? 'active' : ''}" data-action="atlas-clue" data-query="${query}">${query}</button>`).join('')}<a class="chip" href="#identify">按神像特征找</a></div><div id="atlas-results" class="atlas-content">${atlasResults()}</div></div>`;
    document.querySelector('#atlas-search').addEventListener('input', event => {
      atlasQuery = event.target.value;
      atlasLimit = 16;
      document.querySelector('#atlas-results').innerHTML = atlasResults();
      document.querySelectorAll('[data-action="atlas-clue"]').forEach(button => button.classList.toggle('active', button.dataset.query === atlasQuery));
    });
  }

  function renderIdentify() {
    main.innerHTML = `<div class="container">${breadcrumb([{href:'#atlas',label:'神仙图鉴'},{label:'辨认神像'}])}<div class="page-intro" style="padding-top:10px"><div class="eyebrow">旅行时，先找一个细节</div><h1>你记得哪一个特征？</h1><p>点击你看见的法器、坐骑或外貌，查看可能对应的神明。图像线索需要结合题牌、主尊和配祀一起判断。</p></div><div class="travel-entry" style="grid-template-columns:1fr;margin:0 0 35px"><div class="clue-pills">${Object.keys(clueMatches).filter(key => !['红脸','净瓶','孩子','学业','生死','财富','求子','医药'].includes(key)).map(clue => `<button data-action="identify" data-query="${clue}">${clue}</button>`).join('')}</div></div><div id="identify-results"><div class="section-head"><h2>先看看这些常见神像。</h2></div><div class="deity-grid">${featuredList(['guandi','guanyin','zhenwu','wenshu'],4).map(deityCard).join('')}</div></div><div class="nuance-box" style="margin:35px 0 60px"><h3>现场辨认的顺序</h3><p>先读匾额与神位题牌，再看主尊手持物、坐骑和两侧配祀。冠帽、服饰和法器会因时代与地区改变，一项特征可以对应多位神明。</p></div></div>`;
  }

  function overviewBand(title, description, ids, className = '') {
    const entries = ids.map(id => deityMap.get(id)).filter(Boolean);
    return `<section class="overview-band ${className}"><div class="overview-band-label"><h2>${title}</h2><p>${description}</p></div><div class="overview-names">${entries.map(deity => `<a href="#deity/${esc(deity.id)}"><strong>${esc(deity.name)}</strong><span>${esc(deity.role)}</span></a>`).join('')}</div></section>`;
  }

  function renderOverview(system = 'tao') {
    const systems = {tao:'道教神谱',buddhist:'佛与菩萨',folk:'民间神明',myth:'上古神话'};
    if (!systems[system]) system = 'tao';
    const introductions = {
      tao:'先认识三清与诸帝，再沿星辰、山川、冥司和仙真展开。这里依据常见道教传统排列，具体经典与地方奉祀会有自己的组合。',
      buddhist:'从佛、菩萨、罗汉与护法认识佛教造像，再看寺院中常见的三尊组合。不同佛教传统各有相应的仪轨与艺术表现。',
      folk:'沿着人们的日常生活读神明。家宅、城镇、航海、营商、读书与生育的祈愿，会把不同来历的神聚在同一座庙里。',
      myth:'从天地开辟、造人、文明起源与始祖记忆读起。古代文献和地方传说保存了多种故事，人物关系需要回到具体文本中理解。'
    };
    let bands = '';
    let highlightIds = [];
    let sources = [];
    if (system === 'tao') {
      highlightIds = ['yuanshi','lingbao','laojun'];
      bands = overviewBand('三清', '道教最高尊神。三位合称三清，分别关联玉清、上清、太清。', ['yuanshi','lingbao','laojun'],'highest') +
        overviewBand('玉皇与诸帝', '常见神谱中，玉皇位居三清之下。「四御」有玉皇、紫微、勾陈、后土的组合，也有将玉皇另列的版本。', ['yuhuang','ziwei','gouchen','houtu','nanji','qinghua']) +
        overviewBand('天地水三官', '与上、中、下三元相联系，以赐福、赦罪、解厄为人熟知。', ['tianguan','diguan','shuiguan']) +
        overviewBand('星辰与护法', '把星象、岁时与仪式中的镇护、雷法联系起来。', ['doumu','beidou','taisui','zhenwu','leizu','leigong','wanglingguan']) +
        overviewBand('山川、女神与冥司', '各有自己的历史与职掌。这一组按信仰领域阅读，具体关系可以逐条点开查证。', ['dongyue','bixia','xiwangmu','dongwanggong','fengdu','yanluo']) +
        overviewBand('祖师与仙真', '有修道成仙的传说，也有宗派传承中的祖师。', ['zhangtianshi','lvdongbin','baxian']);
      sources = ['f_threepure','dao-siyu','dao-sanguan'];
    } else if (system === 'buddhist') {
      highlightIds = ['shijia','amituo','yaoshi'];
      bands = overviewBand('佛', '佛教中的觉悟者。寺院会依据不同经典与信仰安排主佛。', ['shijia','amituo','yaoshi','mile']) +
        overviewBand('菩萨', '观音与慈悲、文殊与智慧、普贤与行愿、地藏与大愿相连。', ['guanyin','wenshu','puxian','dizang','dashizhi']) +
        overviewBand('罗汉与护法', '罗汉关联修行证果，天王与韦驮守护佛法，常在寺院入口附近见到。', ['luohan','sitianwang','wei_tuo']) +
        overviewBand('华严三圣', '汉地常见组合为释迦牟尼或毗卢遮那佛与文殊、普贤。先看骑狮与骑象的两位菩萨，再辨认中央主佛。', ['shijia','wenshu','puxian']) +
        overviewBand('西方三圣', '阿弥陀佛与观音、大势至共同出现，是净土信仰的重要组合。', ['amituo','guanyin','dashizhi']);
      sources = ['f_dunhuang','f_threebuddhas','f_tianwang','f_dashizhi'];
    } else if (system === 'folk') {
      highlightIds = ['guandi','mazu','shouxing'];
      bands = overviewBand('守护一方', '城隍是一城的地方神职，土地守护本乡本土，龙王与妈祖又有水域、海洋的信仰背景。', ['chenghuang','tudi','longwang','mazu']) +
        overviewBand('家宅与平安', '从大门到厨房，也能看到人们如何想象守护与善恶。', ['menshen','zao','guandi','qitian','erlang','nezha']) +
        overviewBand('财富与文运', '财神可由不同人物承担。文昌与魁星则各有自己的形象和传统。', ['caishen','zhaogongming','bigan','fanli','wencang','kuixing']) +
        overviewBand('健康与家庭', '按祈愿功能把神明联系起来，再看每一位具体的名字与来历。', ['yaowang','songzi','chenjinggu','shouxing','fulushou']) +
        overviewBand('百业与公正', '技艺祖师和被纪念的历史人物，也会成为受奉祀的神明。', ['luban','bao','kuguan']);
      sources = ['f_caishen','f_mazu','dao-chenghuang','f_yaowang'];
    } else {
      highlightIds = ['nuwa','fuxi','xiwangmu'];
      bands = overviewBand('天地与人从何而来', '盘古开天地与女娲造人、补天，各有文献和流传脉络。', ['pangu','nuwa']) +
        overviewBand('文明与始祖记忆', '八卦、农业、医药、技艺与古史传说，在后世不断叠加成文明始祖的故事。', ['fuxi','shennong','huangdi']) +
        overviewBand('从神话走进后世信仰', '西王母在古代神话、汉代图像、道教神谱和民间供奉里，留下了不同时代的样貌。', ['xiwangmu','dongwanggong']);
      sources = ['myth-shanhai','myth-overview','myth-ancestors','dao-xiwangmu'];
    }
    main.innerHTML = `<div class="container"><div class="page-intro"><div class="eyebrow">神系总览</div><h1>从全貌，到每一位神明。</h1><p>天地山川、宗教修行与地方生活，留下了彼此交织的神明传统。</p></div><nav class="overview-tabs" aria-label="选择神明传统">${Object.entries(systems).map(([id,label]) => `<a href="#overview/${id}" class="${id === system ? 'active' : ''}" ${id === system ? 'aria-current="page"' : ''}>${label}</a>`).join('')}</nav><div class="overview-intro"><span class="card-label">${systems[system]}</span><p>${introductions[system]}</p></div><div class="overview-chart">${bands}</div><section class="section"><div class="section-head"><h2>从图像认识他们。</h2><a class="text-link" href="#atlas">查看更多图鉴</a></div><div class="deity-grid overview-featured">${highlightIds.map(id => deityCard(deityMap.get(id))).join('')}</div></section><section class="detail-section" style="margin-bottom:65px"><h2>这张总览的阅读依据</h2>${sourceList(sources)}</section></div>`;
  }

  function renderDeity(id) {
    const deity = deityMap.get(id);
    if (!deity) return renderMissing();
    const image = getImage(deity);
    const temples = data.temples.filter(temple => temple.deities.includes(id));
    const paragraphs = deity.storyParagraphs || [deity.story];
    const related = relationsFor(id).slice(0, 8).map(relation => {
      const other = deityMap.get(relation.from === id ? relation.to : relation.from);
      return `<a class="related-item" href="#deity/${esc(other.id)}"><strong>${esc(other.name)}</strong><span>${esc(relation.label)}</span><small>${esc(relation.context)}</small></a>`;
    }).join('');
    main.innerHTML = `<div class="container">
      ${breadcrumb([{href:'#atlas',label:'神仙图鉴'},{label:deity.name}])}
      <div class="detail-layout">
        <aside class="portrait-column">
          <div class="detail-portrait ${image ? '' : 'type-art'}">${image ? artImage(image, '', true) : `<span>${esc(deity.name)}</span>`}</div>
          ${imageCredit(image)}
          <div class="detail-actions">
            <button class="button small" data-action="save" data-id="${esc(id)}" aria-pressed="${saved.has(id)}"><span class="bookmark-symbol"></span>${saved.has(id) ? '已收藏' : '收入藏签'}</button>
            <button class="button small" data-action="share" data-id="${esc(id)}">分享图鉴</button>
          </div>
        </aside>
        <article class="detail-copy">
          <div class="deity-intro"><div class="card-label">${esc(deity.traditions.join(' · '))} · ${esc(deity.group)}</div>
          <h1>${esc(deity.name)}</h1>
          <div class="aliases">也称 ${esc(deity.aliases.join(' · ') || deity.name)}</div>
          <p class="deity-hook">${esc(deity.hook || deity.summary)}</p>
          <div class="deity-role">${esc(deity.role)}</div>
          <div class="detail-jumps"><button data-action="jump" data-target="story">读故事</button><button data-action="jump" data-target="recognize">认神像</button><a href="#relations/${esc(id)}">看关系</a><button data-action="jump" data-target="encounter">去哪里遇见</button></div></div>
          <section id="story" class="deity-story">
            <div class="eyebrow">名字背后的故事</div>
            <h2>${esc(deity.storyTitle || '神明的来历')}</h2>
            <div class="story-prose">${paragraphs.map(text => `<p>${esc(text)}</p>`).join('')}</div>
            <details class="story-evidence"><summary>故事从哪里来？</summary>${sourceList(deity.storySources || deity.sources)}</details>
          </section>
          <section id="recognize" class="detail-section"><h2>下一次在庙里，怎样认出这位？</h2><ul class="identify-list">${deity.identify.map(clue => `<li>${esc(clue)}</li>`).join('')}</ul><p class="symbol-line">常见线索 · ${esc(deity.symbols.join('、'))}</p></section>
          <details class="identity-notes"><summary>神职与不同说法</summary><p>${esc(deity.summary)}</p><p>${esc(deity.nuance)}</p></details>
          <section class="detail-section"><div class="section-head"><h2>顺着关系，继续读。</h2><a href="#relations/${esc(id)}" class="text-link">展开关系图</a></div><div class="related-list">${related || '<p>当前资料暂未收录直接关系。</p>'}</div></section>
          <section id="encounter" class="detail-section"><h2>去哪里遇见？</h2><p>${esc(deity.templeHint)}</p>${temples.map(temple => `<a class="detail-temple" href="#temple/${esc(temple.id)}"><strong>${esc(temple.name)}</strong><span>${esc(temple.city)}</span></a>`).join('')}</section>
          <section class="detail-section"><h2>图鉴依据与延伸阅读</h2>${sourceList(deity.sources)}</section>
        </article>
      </div></div>`;
    document.title = `${deity.name} · 神游图鉴`;
    if (image) {
      const button = document.createElement('button');
      button.className = 'zoom-art';
      button.dataset.action = 'view-art';
      button.dataset.id = image.id;
      button.textContent = image.depictionType === '相关文献' ? '放大读文献' : '放大看图';
      document.querySelector('.detail-portrait').appendChild(button);
    }
  }

  function graphMarkup(deity, relations) {
    const grouped = new Map();
    relations.forEach(relation => {
      const otherId = relation.from === deity.id ? relation.to : relation.from;
      if (!grouped.has(otherId)) grouped.set(otherId, relation);
    });
    const neighbors = [...grouped.entries()].slice(0, 8);
    const narrow = window.matchMedia('(max-width:600px)').matches;
    const width = narrow ? 380 : 800;
    const height = 520;
    const cx = width / 2;
    const cy = 255;
    const rx = narrow ? 130 : 280;
    const ry = 180;
    const radius = narrow ? 35 : neighbors.length > 6 ? 41 : 46;
    const centerRadius = narrow ? 53 : 67;
    const centerFontSize = Math.min(narrow ? 19 : 22, (centerRadius * 2 - 18) / deity.name.length);
    const positions = neighbors.map(([id, relation], index) => {
      const angle = -Math.PI / 2 + index * Math.PI * 2 / neighbors.length;
      return {id, relation, x:cx + rx * Math.cos(angle), y:cy + ry * Math.sin(angle)};
    });
    const shapes = positions.map(node => `<path class="graph-edge" d="M${cx} ${cy} L${node.x} ${node.y}"/><text class="edge-label" x="${cx + (node.x - cx) * .55}" y="${cy + (node.y - cy) * .55 - 7}"><title>${esc(node.relation.label)}</title>${esc(node.relation.label.slice(0, narrow ? 4 : 10))}</text>`).join('');
    const nodes = positions.map(node => {
      const name = deityMap.get(node.id).name;
      const label = narrow && name.length > 4
        ? `<text class="node-name" x="${node.x}" y="${node.y - 5}" style="font-size:16px"><tspan x="${node.x}">${esc(name.slice(0, 3))}</tspan><tspan x="${node.x}" dy="19">${esc(name.slice(3))}</tspan></text>`
        : `<text class="node-name" x="${node.x}" y="${node.y + 5}" style="font-size:${name.length > 4 ? 13 : 16}px">${esc(name)}</text>`;
      return `<a class="node-link" href="#relations/${esc(node.id)}" aria-label="以${esc(name)}为中心探索关系"><circle class="node-disc" cx="${node.x}" cy="${node.y}" r="${radius}"/>${label}${narrow ? '' : `<text x="${node.x}" y="${node.y + radius + 21}" style="font-size:12px;fill:#95b09d">${esc(contextCategory(node.relation.context))}</text>`}</a>`;
    }).join('');
    return `<svg class="interactive-graph" viewBox="0 0 ${width} ${height}" role="group" aria-label="${esc(deity.name)}关系图，点击周围的神明继续探索"><circle cx="${cx}" cy="${cy}" r="90" stroke="#dcc28b12" fill="none"/><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" stroke="#dcc28b10" fill="none"/>${shapes}${nodes}<circle class="center-disc" cx="${cx}" cy="${cy}" r="${centerRadius}"/><text class="node-name" x="${cx}" y="${cy - 2}" style="font-size:${centerFontSize}px">${esc(deity.name)}</text><text x="${cx}" y="${cy + 23}" style="font-size:12px;fill:#dcc28b">${esc(deity.tradition)}</text></svg>`;
  }

  function renderRelations(id) {
    const deity = deityMap.get(id) || deityMap.get('dongyue') || data.deities[0];
    const allRelations = relationsFor(deity.id);
    const relations = allRelations.filter(relation => relationFilter === '全部' || contextCategory(relation.context) === relationFilter);
    const otherIds = [...new Set(relations.map(relation => relation.from === deity.id ? relation.to : relation.from))];
    main.innerHTML = `<div class="container"><div class="page-intro"><div class="eyebrow">关系图谱</div><h1>从一位神，读懂一张网。</h1><p>点选周围的名字继续探索。连线展示有资料依据的关联，每条关系都能查看所属语境与来源。</p></div><div class="graph-context"><span>查看关系语境</span>${['全部','道教','佛教','地方与民俗','文学故事'].map(filter => `<button class="chip ${relationFilter === filter ? 'active' : ''}" data-action="relation-filter" data-filter="${filter}" data-id="${esc(deity.id)}" aria-pressed="${relationFilter === filter}">${filter}</button>`).join('')}</div><div class="graph-layout"><div class="graph-board"><div class="graph-toolbar"><select id="graph-select" aria-label="选择关系图中心神明">${data.deities.map(item => `<option value="${esc(item.id)}" ${item.id === deity.id ? 'selected' : ''}>${esc(item.name)} · ${esc(item.tradition)}</option>`).join('')}</select><button class="button small" data-action="random-relation">换一位探索</button></div>${relations.length ? graphMarkup(deity, relations) : '<div class="empty-state" style="border:0"><h3>这个语境里，暂未收录关系。</h3><p>切换「全部」，看看其他传统如何描述这位神明。</p></div>'}</div><aside class="graph-side"><div class="card-label">正在探索 · ${relations.length} 条关系</div><h2>${esc(deity.name)}</h2><p>${esc(deity.summary)}</p><a class="button gold small" href="#deity/${esc(deity.id)}">阅读完整图鉴</a><ul class="relation-summaries">${otherIds.slice(0, 5).map(otherId => `<li><button data-action="graph-node" data-id="${esc(otherId)}">${esc(deityMap.get(otherId).name)}</button><small>${esc(relations.find(relation => relation.from === otherId || relation.to === otherId).context)}</small></li>`).join('')}</ul><p class="graph-note">中心代表你正在查看的神明。连线的含义写在旁边，涉及地方传说或文学故事时会单独注明。${otherIds.length > 8 ? `图中展示前 8 位，全部 ${relations.length} 条关系见下方表格。` : ''}</p></aside></div><section class="graph-accessible"><div class="section-head"><h2>把每一条关系读清楚。</h2></div><table class="relation-table"><thead><tr><th>关联神明</th><th>关系与语境</th><th>资料说明</th></tr></thead><tbody>${relations.map(relation => { const other = deityMap.get(relation.from === deity.id ? relation.to : relation.from); return `<tr><td><a href="#deity/${esc(other.id)}">${esc(other.name)}</a></td><td>${esc(deityMap.get(relation.from).name)} · ${esc(relation.label)} · ${esc(deityMap.get(relation.to).name)}<small>${esc(relation.context)}</small></td><td class="note-cell">${esc(relation.note)}${(relation.sources || []).map(sourceId => sourceMap.get(sourceId)).filter(Boolean).slice(0, 1).map(source => `<small><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">查看依据 · ${esc(source.publisher)}</a></small>`).join('')}</td></tr>`; }).join('')}</tbody></table>${!relations.length ? '<p style="padding:20px 0">这个筛选下暂无关系记录。</p>' : ''}</section></div>`;
    document.querySelector('#graph-select').addEventListener('change', event => {
      relationFilter = '全部';
      location.hash = `relations/${event.target.value}`;
    });
  }

  function hallMatches(query) {
    const keyword = normalize(query);
    if (!keyword) return [];
    return (data.halls || []).filter(hall => hall.keywords.some(word => keyword.includes(normalize(word))));
  }

  function hallCard(hall) {
    return `<article class="hall-card"><h3>${esc(hall.name)}</h3><p>${esc(hall.summary)}</p><div class="hall-deities">${hall.deities.map(id => `<a href="#deity/${esc(id)}">${esc(deityMap.get(id).name)}</a>`).join('')}</div></article>`;
  }

  function templeResults() {
    const keyword = normalize(templeQuery);
    const results = data.temples.filter(temple => {
      const text = normalize([temple.name,temple.city,temple.summary,...temple.deities.flatMap(id => [deityMap.get(id)?.name,...(deityMap.get(id)?.aliases || [])])].join(' '));
      return text.includes(keyword) && (templeRegion === '全部地区' || temple.region === templeRegion) && (templeType === '全部类型' || temple.type === templeType);
    });
    const halls = hallMatches(templeQuery);
    const clues = halls.length ? `<section class="name-clues"><div class="section-head"><div><div class="eyebrow">名称里的线索</div><h2>先从这几个名字读起。</h2><p>按名称提供阅读线索，供奉身份可与现场题牌相互核对。</p></div></div><div class="hall-grid">${halls.slice(0,4).map(hallCard).join('')}</div></section>` : '';
    const empty = `<div class="empty-state"><h3>这座庙还在图鉴之外。</h3><p>可以看看门口匾额或殿内题牌，试着输入「三清」「天后」「城隍」「观音」等名字。</p><a class="button" href="#identify">按神像特征找线索</a>${templeQuery ? `<a class="text-link" href="https://www.baidu.com/s?wd=${encodeURIComponent(templeQuery + ' 主祀 文物') }" target="_blank" rel="noopener noreferrer">查找这座庙的公开资料</a>` : ''}</div>`;
    return `${clues}<div class="results-head"><span>精选导览 · 找到 ${results.length} 处</span><span>支持按主神和别名查找</span></div><div class="temple-grid temple-page-grid">${results.length ? results.map(templeCard).join('') : empty}</div>`;
  }

  function renderTemples() {
    const regions = [...new Set(data.temples.map(temple => temple.region).filter(Boolean))];
    const types = [...new Set(data.temples.map(temple => temple.type).filter(Boolean))];
    main.innerHTML = `<div class="container">
      <div class="page-intro"><div class="eyebrow">旅行看庙</div><h1>走到哪里，都多看懂一点。</h1><p>精选 ${data.temples.length} 处有资料依据的庙宇与圣地。也可以输入陌生庙宇的殿名，从主神与造像找线索。</p></div>
      <div class="search-input-wrap"><span class="search-symbol"></span><input id="temple-search" type="search" value="${esc(templeQuery)}" placeholder="输入庙名、城市、殿名或主神" aria-label="搜索庙宇与殿名"></div>
      <div class="temple-filters"><label>地区<select id="temple-region">${['全部地区',...regions].map(region => `<option ${region === templeRegion ? 'selected' : ''}>${esc(region)}</option>`).join('')}</select></label><label>类型<select id="temple-type">${['全部类型',...types].map(type => `<option ${type === templeType ? 'selected' : ''}>${esc(type)}</option>`).join('')}</select></label><a class="text-link" href="#halls">看不懂殿名？翻开殿堂手册</a></div>
      <div id="temple-results">${templeResults()}</div>
      <details class="coverage-note"><summary>为什么这里没有收录所有庙宇？</summary><p>这份图鉴以认识神明为线索，精选不同地区、传统和主祀的代表性庙宇。民间庙宇、佛寺、道观与历史祠庙的范围各有差别，单靠一份名单很难覆盖地方供奉的全部面貌。</p><p>游览未收录的庙宇时，可以用殿名手册、神像特征和神明别名继续查找。所列导览依据公开资料，殿宇陈设与开放范围请结合当地说明。</p></details>
      </div>`;
    const refresh = () => { document.querySelector('#temple-results').innerHTML = templeResults(); };
    document.querySelector('#temple-search').addEventListener('input', event => { templeQuery = event.target.value; refresh(); });
    document.querySelector('#temple-region').addEventListener('change', event => { templeRegion = event.target.value; refresh(); });
    document.querySelector('#temple-type').addEventListener('change', event => { templeType = event.target.value; refresh(); });
  }

  function renderHalls() {
    main.innerHTML = `<div class="container"><div class="page-intro"><div class="eyebrow">现场看庙手册</div><h1>一块匾额，也能读出故事。</h1><p>殿名常常提示主祀、组合或建筑用途。点进人物，再核对神位全称、法器与配祀。</p></div><div class="hall-grid">${(data.halls || []).map(hallCard).join('')}</div><div class="section-head" style="margin-top:35px"><a class="button" href="#temples">查找庙宇导览</a><a class="text-link" href="#identify">按神像特征辨认</a></div></div>`;
  }

  function renderTexts() {
    main.innerHTML = `<div class="container"><div class="page-intro"><div class="eyebrow">原典书架</div><h1>回到故事最初写下的地方。</h1><p>从人物档案读故事，再沿出处进入古籍。在线整理本与历史影印本可互相参照。</p></div><div class="source-grid">${(data.books || []).map(book => `<article class="source-block"><div class="card-label">${esc(book.kind)}</div><h2>${esc(book.title)}</h2><p>${esc(book.summary)}</p><a class="text-link" href="${esc(book.url)}" target="_blank" rel="noopener noreferrer">打开原典</a>${book.scan ? `<a class="text-link" href="${esc(book.scan)}" target="_blank" rel="noopener noreferrer">对照历史影印本</a>` : ''}</article>`).join('')}</div><div class="method-box" style="margin-bottom:55px"><h3>从古籍读神明，需要留意什么？</h3><p>古籍保存不同年代的传说、封号与信仰。人物故事按所据文本讲述，版本差异与文学身世保留说明。《神仙传》《搜神记》等传本经历辑录与流传，现代研究和文物资料可用于交叉核验。</p><p>现代书目用于延伸阅读与研究线索。目录、书评和试读各有范围；人物条目的具体依据另行列明，列入书目不表示已取得或读完该书全文。</p></div></div>`;
  }

  function renderTemple(id) {
    const temple = templeMap.get(id);
    if (!temple) return renderMissing();
    const image = templeImage(temple);
    main.innerHTML = `<div class="container">${breadcrumb([{href:'#temples',label:'旅行看庙'},{label:temple.name}])}<div class="temple-detail-hero">${image ? artImage(image, '', true) : '<div class="temple-fallback" style="height:100%"></div>'}<div class="temple-detail-title"><div class="eyebrow">${esc(temple.city)}</div><h1>${esc(temple.name)}</h1><p>循着殿堂与题牌，认识这里的神明。</p></div></div>${image ? imageCredit(image) : ''}<div class="temple-info-layout"><article><section class="detail-section"><h2>先读懂这座庙</h2><p>${esc(temple.summary)}</p></section><section class="detail-section"><h2>这里，会遇见谁？</h2><div class="deity-grid">${temple.deities.map(id => deityCard(deityMap.get(id))).join('')}</div></section>${temple.nuance ? `<div class="nuance-box"><h3>把地方供奉看仔细</h3><p>${esc(temple.nuance)}</p></div>` : ''}<section class="detail-section"><h2>资料与进一步阅读</h2>${sourceList(temple.sources)}</section></article><aside class="temple-sidebar"><h3>走进殿堂的观察顺序</h3><ul class="identify-list">${temple.tips.map(tip => `<li>${esc(tip)}</li>`).join('')}</ul><a class="button small" href="#identify">打开神像辨认手册</a><a class="button small" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(temple.city + ' ' + temple.name)}" target="_blank" rel="noopener noreferrer">在地图上查看</a></aside></div></div>`;
    document.title = `${temple.name} · 神游看庙指南`;
  }

  function renderLearn() {
    main.innerHTML = `<div class="container"><div class="page-intro learn-intro"><div><div class="eyebrow">入门读本</div><h1>把零散的名字，<br>连成有意思的世界。</h1></div><p>从神明的来历、彼此关系和庙里的相逢开始。每读懂一个问题，下次旅行就多一层发现。</p></div><div class="learning-path"><div class="learning-step"><div class="card-label">认名字与身份</div><h3>这位神，从哪里来？</h3><p>道教神谱、佛教传统、古代神话、民间信仰，都有各自的来历。</p><a class="text-link" href="#overview/tao">先看神系总览</a></div><div class="learning-step"><div class="card-label">顺着关系读</div><h3>他们，怎么连在一起？</h3><p>同组尊神、共同奉祀、文学身世，关系要放回具体语境来看。</p><a class="text-link" href="#relations/yuhuang">从玉皇大帝开始</a></div><div class="learning-step"><div class="card-label">在庙里实践</div><h3>一座庙，怎么看？</h3><p>沿着匾额、主尊、配祀和碑记，认识地方自己的信仰与记忆。</p><a class="text-link" href="#temples">选一处庙宇</a></div></div><div class="stories-grid" style="margin-bottom:50px">${data.articles.map(storyCard).join('')}</div><div class="method-box" style="margin-bottom:60px"><h2 style="font-size:26px;margin-bottom:18px">边看，边查证。</h2><p>本图鉴收录 ${data.deities.length} 个神明条目、${data.relations.length} 条有语境的关系和 ${data.temples.length} 处看庙指南。神职、称号、配祀和造像会随地区与时代变化，条目中的「再多了解一点」会保留这些差异。</p><p>古画与文物照片保留来源。文字资料可在各条目底部继续阅读，图像辨认线索适合与现场题牌相互参照。</p><a class="text-link" href="#texts" style="display:inline-block;margin-top:20px">打开原典书架</a></div></div>`;
  }

  function renderArticle(id) {
    const article = articleMap.get(id);
    if (!article) return renderMissing();
    main.innerHTML = `<div class="container">${breadcrumb([{href:'#learn',label:'入门读本'},{label:article.title}])}<article class="article-layout"><div class="eyebrow">${esc(article.kicker)}</div><h1>${esc(article.title)}</h1><p class="article-lead">${esc(article.summary)}</p><div class="article-body">${article.paragraphs.map(paragraph => `<p>${esc(paragraph)}</p>`).join('')}</div><section class="article-related"><h3 style="margin-bottom:20px">资料与延伸阅读</h3>${sourceList(article.sources)}</section><div class="hero-buttons"><a class="button" href="#learn">继续读下一篇</a><a class="button gold" href="#atlas">在图鉴里找一找</a></div></article></div>`;
    document.title = `${article.title} · 神游读本`;
  }

  function renderSaved() {
    const deities = [...saved].map(id => deityMap.get(id)).filter(Boolean);
    main.innerHTML = `<div class="container"><div class="page-intro"><div class="eyebrow">我的藏签</div><h1>把遇见，留在这里。</h1><p>收藏想了解的神明，下次走进庙宇时，再翻开看一看。藏签保存在当前浏览器。</p></div><div class="saved-bar"><span>${deities.length} 张藏签</span>${deities.length ? '<button data-action="export-saved">复制我的藏签清单</button>' : ''}</div><div class="deity-grid" style="padding-bottom:70px">${deities.length ? deities.map(deityCard).join('') : '<div class="empty-state"><h3>从第一位神明开始。</h3><p>在图鉴条目中点「收入藏签」，就能把想了解的神明留在这里。</p><a class="button gold" href="#atlas">去图鉴里逛逛</a></div>'}</div></div>`;
  }

  function renderSources() {
    const usedImages = data.images.filter(image => image.id !== 'hero');
    main.innerHTML = `<div class="container"><div class="page-intro"><div class="eyebrow">文献与图像</div><h1>每一次神游，都有来处。</h1><p>沿着原始资料继续阅读。不同文献和地方传统的说法，保留在各自的语境中。</p></div><div class="method-box"><h2 style="font-size:25px;margin-bottom:18px">我们怎样讲述神明</h2><p>以汉地常见庙宇、道观和佛寺中的神祇为主要范围。条目结合道教专题资料、博物馆与宗教部门介绍、文化遗产项目及相关研究，整理名字、图像和地方供奉。</p><p>关系图以「同组尊神」「配祀」「师承」「职能关联」「文学故事」等实际关系串联。图中的中心只表示当前查看对象，关系说明和来源可在表格中逐条阅读。</p><p>故事优先追溯古籍与相关经典，地方供奉参照文物、寺观与博物馆资料。古籍神像、地方塑像与相关文献配图分别注明。资料整理日期为 2026 年 11 月 22 日。</p></div><section class="section"><h2>文字资料 · ${data.sources.length} 项</h2><div class="source-grid">${data.sources.map(source => `<div class="source-block"><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)}</a><p>${esc(source.publisher)}</p></div>`).join('')}</div><h2 style="margin-bottom:30px">古画、壁画与庙宇实景</h2><div class="source-art-grid">${usedImages.map(image => `<div class="source-art">${artImage(image)}<strong>${esc(image.title)}</strong><p>${esc(image.credit)}<br>${esc(image.changes || '')}</p><a href="${esc(image.sourceUrl)}" target="_blank" rel="noopener noreferrer">查看原图与说明</a> · <a href="${esc(image.licenseUrl || image.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(image.license)}</a></div>`).join('')}</div></section></div>`;
  }

  function renderMissing() {
    main.innerHTML = '<div class="container section"><div class="empty-state"><h1>这张藏签，还没找到。</h1><p>回到图鉴，继续探索神明的来历。</p><a href="#atlas" class="button gold">查看神仙图鉴</a></div></div>';
  }

  function globalResults(query) {
    const resultContainer = document.querySelector('#global-results');
    if (!query.trim()) {
      resultContainer.innerHTML = `<p class="search-tip">从你刚遇见的神开始。</p>${featuredList(['guanyin','guandi','wencang','xiwangmu'], 4).map(deity => `<a class="global-result" href="#deity/${esc(deity.id)}"><div><strong>${esc(deity.name)}</strong><small>${esc(deity.role)}</small></div><span>${esc(deity.tradition)}</span></a>`).join('')}`;
      return;
    }
    const deityResults = data.deities.filter(deity => matchesQuery(deity, query)).slice(0, 7);
    const templeResults = data.temples.filter(temple => normalize(temple.name + temple.city).includes(normalize(query))).slice(0, 3);
    resultContainer.innerHTML = deityResults.map(deity => `<a class="global-result" href="#deity/${esc(deity.id)}"><div><strong>${esc(deity.name)}</strong><small>${esc(deity.role)}</small></div><span>${esc(deity.tradition)}</span></a>`).join('') + templeResults.map(temple => `<a class="global-result" href="#temple/${esc(temple.id)}"><div><strong>${esc(temple.name)}</strong><small>${esc(temple.city)}</small></div><span>看庙指南</span></a>`).join('') || '<p class="search-tip">暂时没有找到。试试完整神名，或「红脸」「龟蛇」「净瓶」等特征。</p>';
  }

  function openSearch() {
    searchInput.value = '';
    globalResults('');
    dialog.showModal();
    searchInput.focus();
  }

  function openArt(id) {
    const image = imageMap.get(id);
    if (!image) return;
    const viewer = document.querySelector('#art-dialog');
    document.querySelector('#art-dialog-content').innerHTML = `<img src="assets/${esc(image.filename)}" alt="${esc(image.title)}"><h2>${esc(image.title)}</h2>${imageCredit(image, false)}`;
    viewer.showModal();
  }

  async function copyText(text, successMessage) {
    try {
      await navigator.clipboard.writeText(text);
      notify(successMessage);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand('copy');
      textarea.remove();
      notify(copied ? successMessage : '可以从浏览器地址栏复制当前图鉴链接');
    }
  }

  async function shareDeity(id) {
    const deity = deityMap.get(id);
    const url = `${location.href.split('#')[0]}#deity/${id}`;
    if (navigator.share) {
      try {
        await navigator.share({title:`${deity.name} · 神游`,text:deity.role,url});
        return;
      } catch (error) {
        if (error.name === 'AbortError') return;
      }
    }
    await copyText(url, '图鉴链接已复制');
  }

  function applyAtlasQuery(query) {
    atlasQuery = query;
    atlasFilter = '全部';
    atlasLimit = 16;
    if (location.hash === '#atlas') renderAtlas();
    else location.hash = 'atlas';
  }

  document.addEventListener('click', event => {
    if (event.target.closest('.skip')) {
      event.preventDefault();
      main.focus();
      main.scrollIntoView();
      return;
    }
    const action = event.target.closest('[data-action]');
    if (!action) return;
    const type = action.dataset.action;
    if (type === 'search') openSearch();
    if (type === 'jump') document.getElementById(action.dataset.target)?.scrollIntoView({behavior:'smooth',block:'start'});
    if (type === 'view-art') openArt(action.dataset.id);
    if (type === 'save') saveDeity(action.dataset.id);
    if (type === 'share') shareDeity(action.dataset.id);
    if (type === 'clue' || type === 'atlas-clue') applyAtlasQuery(action.dataset.query);
    if (type === 'reset-atlas') applyAtlasQuery('');
    if (type === 'filter') {
      atlasFilter = action.dataset.filter;
      atlasLimit = 16;
      renderAtlas();
    }
    if (type === 'more') {
      atlasLimit += 16;
      document.querySelector('#atlas-results').innerHTML = atlasResults();
    }
    if (type === 'identify') {
      const matches = data.deities.filter(deity => matchesQuery(deity, action.dataset.query));
      document.querySelectorAll('[data-action="identify"]').forEach(button => button.classList.toggle('active', button === action));
      document.querySelector('#identify-results').innerHTML = `<div class="section-head"><div><h2>「${esc(action.dataset.query)}」可能指向谁？</h2><p>结合神位题牌，点开图鉴核对其他特征。</p></div></div><div class="deity-grid">${matches.map(deityCard).join('')}</div>`;
    }
    if (type === 'relation-filter') {
      relationFilter = action.dataset.filter;
      const scrollY = window.scrollY;
      renderRelations(action.dataset.id);
      window.scrollTo({top:scrollY,behavior:'instant'});
    }
    if (type === 'graph-node') {
      relationFilter = '全部';
      location.hash = `relations/${action.dataset.id}`;
    }
    if (type === 'random-relation') {
      const choices = data.deities.filter(deity => relationsFor(deity.id).length >= 2 && location.hash !== `#relations/${deity.id}`);
      relationFilter = '全部';
      location.hash = `relations/${choices[Math.floor(Math.random() * choices.length)].id}`;
    }
    if (type === 'export-saved') {
      const text = `我的神游藏签\n\n${[...saved].map(id => { const deity = deityMap.get(id); return `${deity.name} · ${deity.role}\n${location.href.split('#')[0]}#deity/${id}`; }).join('\n\n')}`;
      copyText(text, '藏签清单已复制');
    }
  });

  dialog.addEventListener('click', event => {
    if (event.target === dialog) {
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    }
    if (event.target.closest('a')) dialog.close();
  });
  searchInput.addEventListener('input', event => globalResults(event.target.value));
  document.querySelector('#art-dialog').addEventListener('click', event => {
    if (event.target.id === 'art-dialog') event.target.close();
  });
  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (dialog.open) dialog.close();
      else openSearch();
    }
  });

  function route() {
    if (dialog.open) dialog.close();
    const artDialog = document.querySelector('#art-dialog');
    if (artDialog.open) artDialog.close();
    const [page = 'home', id] = location.hash.slice(1).split('/');
    const activeNav = ({deity:'atlas',identify:'atlas',temple:'temples',halls:'temples',texts:'learn',article:'learn'})[page] || page || 'home';
    document.querySelectorAll('[data-nav]').forEach(link => {
      link.classList.toggle('active', link.dataset.nav === activeNav);
      if (link.dataset.nav === activeNav) link.setAttribute('aria-current','page');
      else link.removeAttribute('aria-current');
    });
    document.title = '神游 · 中国神仙与庙宇图鉴';
    if (page === 'atlas') renderAtlas();
    else if (page === 'overview') renderOverview(id);
    else if (page === 'deity') renderDeity(id);
    else if (page === 'relations') renderRelations(id);
    else if (page === 'temples') renderTemples();
    else if (page === 'halls') renderHalls();
    else if (page === 'texts') renderTexts();
    else if (page === 'temple') renderTemple(id);
    else if (page === 'learn') renderLearn();
    else if (page === 'article') renderArticle(id);
    else if (page === 'saved') renderSaved();
    else if (page === 'sources') renderSources();
    else if (page === 'identify') renderIdentify();
    else if (page === 'home' || !page) renderHome();
    else renderMissing();
    window.scrollTo({top:0,behavior:'instant'});
    updateSavedCount();
  }

  window.addEventListener('hashchange', route);
  route();
})();
