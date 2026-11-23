const fs = require('fs');
const vm = require('vm');
const root = require('path').resolve(__dirname, '../dist') + '/';
const dataContext = {window:{}};
vm.runInNewContext(fs.readFileSync(root+'data.js','utf8'),dataContext);
const data = dataContext.window.ATLAS_DATA;
const pages = ['home','atlas','overview/tao','overview/buddhist','overview/folk','overview/myth','temples','halls','texts','learn','sources','saved','identify',...data.deities.flatMap(x=>['deity/'+x.id,'relations/'+x.id]),...data.temples.map(x=>'temple/'+x.id),...data.articles.map(x=>'article/'+x.id)];
for(const narrow of [false,true]) {
  for(const page of pages) {
    const elements = new Map();
    function element(selector) {
      if(!elements.has(selector)) elements.set(selector,{innerHTML:'',textContent:'',value:'',dataset:{},open:false,classList:{add(){},remove(){},toggle(){}},addEventListener(){},setAttribute(){},appendChild(){},focus(){},close(){this.open=false;}});
      return elements.get(selector);
    }
    const context = {
      window:{ATLAS_DATA:data,matchMedia:()=>({matches:narrow}),scrollTo(){},addEventListener(){}},
      document:{querySelector:element,querySelectorAll:()=>[],createElement:()=>element('created'),addEventListener(){},title:''},
      location:{hash:'#'+page,href:'https://example.test/#'+page},
      localStorage:{getItem:()=>null},setTimeout,clearTimeout,navigator:{},console
    };
    vm.runInNewContext(fs.readFileSync(root+'app.js','utf8'),context,{timeout:2000});
    const html=element('#main').innerHTML;
    if(!html || html.includes('undefined') || html.includes('NaN')) throw new Error('Invalid rendered output '+page+' narrow='+narrow);
    for(const match of html.matchAll(/src="assets\/([^"]+)"/g)) if(!fs.existsSync(root+'assets/'+match[1])) throw new Error('Missing image '+match[1]);
  }
}
console.log('Rendered '+pages.length+' routes at both layout breakpoints without data or template errors.');
