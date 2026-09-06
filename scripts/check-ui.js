// Actual application components; only the external IPC boundary is replaced.
const { default: React } = await import('/node_modules/.vite/deps/react.js');
const { default: ReactDOM } = await import('/node_modules/.vite/deps/react-dom_client.js');
const { default: Thinking } = await import('/src/ui/Thinking.tsx');
const { default: Sidebar } = await import('/src/Sidebar.tsx');
const { default: BotForge } = await import('/src/BotForge.tsx');
const { default: Terminals } = await import('/src/views/Terminals.tsx');
const tree = await import('/src/lib/agac.ts');
const { setActiveLang } = await import('/src/lib/i18n.ts');
setActiveLang('en');
const h = React.createElement;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (value, message) => { if (!value) throw new Error(message); };
const host = document.createElement('div');
host.style.cssText = 'position:fixed;inset:0;padding:24px;background:var(--bg);z-index:99999;display:flex;flex-direction:column';
document.body.append(host);
const root = ReactDOM.createRoot(host);
const render = async element => { root.render(element); await wait(100); };
const results = [];
const test = async (name, run) => {
  try { results.push({ name, passed: true, details: await run() }); }
  catch (error) { results.push({ name, passed: false, error: String(error) }); }
  await render(null);
};
let calls = [], modelFails = false, toolsFail = false, closeDelay = 0;
window.__TAURI_INTERNALS__ = {
  transformCallback: () => 1,
  unregisterCallback: () => {},
  invoke: async (command, args) => {
    calls.push({ command, args });
    if (command === 'model_models') {
      await wait(40);
      if (modelFails) throw new Error('Model server offline');
      return [{ id: 'test-model', contextLength: 8192 }];
    }
    if (command === 'mcp_tools') {
      await wait(60);
      if (toolsFail) throw new Error('Tools unavailable');
      return [{name:'fs_read',group:'read',description:'Read'}, {name:'fs_write',group:'write',description:'Write'}];
    }
    if (command === 'pty_close') await wait(closeDelay);
    return null;
  },
};
const native = async action => { window.webkit.messageHandlers.nativeInput.postMessage(JSON.stringify(action)); await wait(30); };
const point = element => { assert(element, 'Input target missing'); const r=element.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; };
const click = async element => { const p=point(element); await native({kind:'move',...p}); await native({kind:'down',...p}); await native({kind:'up',...p}); await wait(100); };
const key = async (element, key) => { element.focus(); await native({kind:'keyDown',key}); await native({kind:'keyUp',key}); await wait(250); };
const byText = text => [...host.querySelectorAll('button')].find(el=>el.textContent.trim()===text);
const bot = {id:'test',name:'Test',agent:'test-agent',backend:'yerel-model',model:'test-model',effort:null,workdir:'/tmp',preamble:'',permission:'sor',timeout:1800,tools:[],contextBudget:8192,maxTurns:100,forceWhenBusy:false,avatar:null,sessions:[],updatedAt:0};
await test('session collapse: native pointer and keyboard', async () => {
  let selected=0;
  await render(h(Sidebar,{bots:[bot],summaries:{},selectedId:bot.id,sessions:[{id:'one',title:'Existing session',running:false}],selectedSession:'one',snap:{endpoint:'http://localhost',agents:[],toolCount:0},desktop:{unlocked:false},waiting:[],onSelect:()=>selected++,onSelectSession:()=>selected++,onOpenSystem:()=>{},onToggleDesktop:()=>{},onEdit:()=>{},onDelete:()=>{},onDeleteSession:()=>{}}));
  const toggle=host.querySelector('[aria-controls="sessions-test"]');
  await click(toggle); await wait(650);
  const panel=host.querySelector('#sessions-test');
  assert(panel.getBoundingClientRect().height<1 && panel.inert,'Session list did not collapse');
  assert(selected===0,'Collapse changed the selected session');
  await key(toggle,'Return'); await wait(650);
  assert(panel.getBoundingClientRect().height>20 && !panel.inert,'Enter did not expand');
  await key(toggle,'space'); await wait(650);
  assert(panel.getBoundingClientRect().height<1 && selected===0,'Space selected a new session');
  await click(toggle); await wait(650);
  await click(host.querySelector('.row__name'));
  assert(selected===1,'Bot row no longer opens a new session');
  return {selectionCallbacks:selected,collapsedHeight:0};
});
await test('session expansion moves the next bot without bouncing', async () => {
  const second = {...bot, id:'second', name:'Second'};
  const props = {bots:[bot,second],summaries:{},selectedId:bot.id,sessions:[{id:'one',title:'Existing session',running:false}],selectedSession:'one',snap:{endpoint:'http://localhost',agents:[],toolCount:0},desktop:{unlocked:false},waiting:[],onSelect:()=>{},onSelectSession:()=>{},onOpenSystem:()=>{},onToggleDesktop:()=>{},onEdit:()=>{},onDelete:()=>{},onDeleteSession:()=>{}};
  await render(h(Sidebar, props));
  const positions=[];
  for (let cycle=0; cycle<4; cycle++) {
    const row=host.querySelector('[data-flip="second"]');
    const frames=[];
    let sampling=true;
    const sample=()=>{frames.push(row.getBoundingClientRect().y);if(sampling)requestAnimationFrame(sample);};
    requestAnimationFrame(sample);
    await click(host.querySelector('[aria-controls="sessions-test"]'));
    // Normal summary renders must not restart or add a second animation.
    for(let tick=0;tick<3;tick++){root.render(h(Sidebar,{...props,summaries:{test:{at:1,line:String(tick)}}}));await wait(35);}
    await wait(650);sampling=false;
    const direction=cycle%2===0?-1:1;
    const reversals=frames.slice(1).filter((y,i)=>(y-frames[i])*direction < -1).length;
    positions.push({cycle,reversals,start:frames[0],end:frames.at(-1)});
  }
  assert(positions.every(p=>p.reversals===0),JSON.stringify(positions));
  // A genuine order change still animates the surviving rows.
  root.render(h(Sidebar,{...props,bots:[second,bot],summaries:{}}));await wait(80);
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches) assert([...host.querySelectorAll('[data-flip]')].some(el=>el.getAnimations().length>0),'Reordering lost its animation');
  await wait(650);
  return positions;
});
await test('empty terminal centered at multiple widths', async () => {
  const offsets=[];
  for(const width of [700,1000,1350]) {
    await render(h('div',{style:{width,height:700,display:'flex',flexDirection:'column'}},h(Terminals,{view:{sessions:[]},agac:null,onAgac:()=>{},onReload:()=>{}})));
    const a=host.querySelector('.agac').getBoundingClientRect(),b=host.querySelector('.chat__bos').getBoundingClientRect();
    const dx=b.x+b.width/2-a.x-a.width/2;
    // The tree reserves 24px of bottom padding outside its content area.
    const dy=b.y+b.height/2-(a.y+(a.height-24)/2);
    offsets.push({width,dx,dy});assert(Math.abs(dx)<=1&&Math.abs(dy)<=1,'Empty state is off center');
  }
  return offsets;
});
await test('thinking stream never shrinks or changes width', async () => {
  let text='',done=false;const sizes=[];
  function sample(){const el=host.querySelector('.dusunce__kuyu');if(el)sizes.push({height:el.getBoundingClientRect().height,width:el.getBoundingClientRect().width});if(!done)requestAnimationFrame(sample);}
  requestAnimationFrame(sample);
  for(let i=0;i<130;i++){text+=' thinking';root.render(h(Thinking,{text,live:true}));await wait(22);}
  await wait(650);done=true;
  const reversals=sizes.slice(1).filter((s,i)=>s.height<sizes[i].height-1).length;
  const widthRange=Math.max(...sizes.map(s=>s.width))-Math.min(...sizes.map(s=>s.width));
  assert(reversals===0,`${reversals} height reversals`);assert(widthRange<1,'Width moved during streaming');
  await native({kind:'snapshot',name:'thinking'});await wait(150);
  await click(host.querySelector('.dusunce__baslik'));await wait(650);
  assert(host.querySelector('.dusunce__kuyu').getBoundingClientRect().height>60,'Thinking did not expand');
  const expandedHeight = host.querySelector('.dusunce__kuyu').getBoundingClientRect().height;
  const closingFrames = [];
  let closing = true;
  const recordClosing = () => { closingFrames.push(host.querySelector('.dusunce__kuyu').getBoundingClientRect().height); if (closing) requestAnimationFrame(recordClosing); };
  requestAnimationFrame(recordClosing);
  await click(host.querySelector('.dusunce__baslik'));await wait(650);closing = false;
  assert(Math.abs(host.querySelector('.dusunce__kuyu').getBoundingClientRect().height-60)<1,'Thinking did not collapse');
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) assert(closingFrames.some(height => height > 61 && height < expandedHeight - 1),'Closing transition skipped intermediate heights');
  root.render(h(Thinking,{text,live:false}));await wait(100);
  assert(!host.querySelector('.dusunce__baslik').textContent.includes('Thinking…'),'Live label remained');
  return {frames:sizes.length,reversals,widthRange};
});
await test('new bot tools load with model server offline; retries preserve selections', async () => {
  calls=[];modelFails=true;
  await render(h(BotForge,{agents:[],defaultWorkdir:'/tmp',onDone:()=>{},onCancel:()=>{}}));await wait(150);
  await click(byText('Tools & access'));await wait(250);
  assert(host.querySelectorAll('.toolset__arac').length===2,'New bot has no tools');
  await native({kind:'snapshot',name:'tools'});await wait(150);
  const read=byText('fs_read');assert(read.getAttribute('aria-pressed')==='true','Read default missing');
  await click(read);assert(read.getAttribute('aria-pressed')==='false','Cannot disable read');
  await click(byText('Engine'));await wait(250);
  assert(host.textContent.includes('Model server offline'),'Model error missing');
  modelFails=false;await click(byText('Try again'));await wait(200);
  assert(!host.textContent.includes('Model server offline'),'Model retry failed');
  await click(byText('Tools & access'));await wait(250);
  assert(byText('fs_read').getAttribute('aria-pressed')==='false','Retry restored disabled tool');
  return {modelRequests:calls.filter(c=>c.command==='model_models').length,toolRequests:calls.filter(c=>c.command==='mcp_tools').length};
});
await test('existing engines and tool failure stay independent', async () => {
  toolsFail=true;
  await render(h(BotForge,{bot,agents:[],defaultWorkdir:'/tmp',onDone:()=>{},onCancel:()=>{}}));await wait(150);
  await click(byText('Engine'));await wait(250);assert(!host.textContent.includes('Tools unavailable'),'Tool error leaked into models');
  await click(byText('Tools & access'));await wait(250);assert(host.textContent.includes('Tools unavailable'),'Tool error missing');
  toolsFail=false;await click(byText('Try again'));await wait(200);
  assert(byText('fs_read').getAttribute('aria-pressed')==='false','Existing bot tools changed');
  await render(null);
  await render(h(BotForge,{bot:{...bot,backend:'pcbridge-agent'},agents:[],defaultWorkdir:'/tmp',onDone:()=>{},onCancel:()=>{}}));
  await click(byText('Tools & access'));await wait(250);
  assert(host.textContent.includes('external agent'),'Agent explanation missing');
  assert(!host.querySelector('.toolset')&&!host.querySelector('.grp .seg'),'Ineffective permission controls visible');
});
await test('terminal close, split, drag and concurrent close use native input', async () => {
  let updateTree;let current;let trusted=0;
  const observe=e=>{if(e.isTrusted)trusted++;};host.addEventListener('pointerdown',observe);
  const names=Array.from({length:9},(_,i)=>`test-${i}`);
  const sessions=names.map(name=>({name,command:'bash',attached:false}));
  function Harness({count}){const [value,setValue]=React.useState(()=>tree.duzenKur(names.slice(0,count),'izgara'));updateTree=setValue;current=value;return h(Terminals,{view:{sessions},agac:value,onAgac:setValue,onReload:()=>{}});}
  calls=[];await render(h(Harness,{count:1}));
  await click(host.querySelector('.phead .pb:last-child'));await wait(250);
  assert(!host.querySelector('.pane'),'Single pane did not close');
  assert(calls.some(c=>c.command==='pty_close')&&!calls.some(c=>c.command==='tmux_kill'),'Wrong close operation');
  updateTree(tree.duzenKur(names.slice(0,8),'izgara'));await wait(200);
  await click(host.querySelector('.phead .pb:first-of-type'));await wait(200);
  assert(host.querySelectorAll('.pane').length===9,'Split button failed');
  const heads=host.querySelectorAll('.phead');
  const first=point(heads[0]),second=point(heads[1]);const before=tree.oturumlar(current).join();
  await native({kind:'move',...first});await native({kind:'down',...first});await native({kind:'move',...second,held:true});await native({kind:'up',...second});await wait(200);
  assert(tree.oturumlar(current).join()!==before,'Header drag did not swap panes');
  closeDelay=400;
  const buttons=[...host.querySelectorAll('.phead .pb:last-child')];
  await click(buttons[0]);await click(buttons[1]);await wait(650);closeDelay=0;
  assert(host.querySelectorAll('.pane').length===7,'Concurrent closes lost an update');
  for(let i=0;i<7;i++){await click(host.querySelector('.phead .pb:last-child'));await wait(100);}
  assert(!host.querySelector('.pane'),'Not all panes closed');
  updateTree(tree.duzenKur([names[0]],'izgara'));await wait(200);
  assert(host.querySelector('.pane'),'Closed session could not reopen');
  host.removeEventListener('pointerdown',observe);assert(trusted>0,'Input was not trusted');
  return {trustedPointerDowns:trusted,closeCalls:calls.filter(c=>c.command==='pty_close').length};
});
root.unmount();host.remove();
return {passed:results.every(result=>result.passed),theme:document.documentElement.dataset.theme,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,results};
