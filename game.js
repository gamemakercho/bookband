import {CONFIG} from './config.js';
import {loadAssetBundle,drawBook,drawCart,drawCartForeground,drawIdlePaws,drawGripPaws} from './assets-loader.js';
import {freshState,validState,locate,transition,shelfDropPlan} from './state.js';
import {inside,localPoint,slotAt,shelfPlacement} from './geometry.js';

const canvas=document.querySelector('#board'),ctx=canvas.getContext('2d');
const message=document.querySelector('#message'),intro=document.querySelector('#intro');
const loading=document.querySelector('#loading'),help=document.querySelector('#help-dialog');
const order=CONFIG.correctOrder;
let bundle,state,selected=null,gesture=null,ready=false,started=false,completeTimer=null,animation=null,epoch=0;
let bookMasks=new Map(),cartMask=null,completionSent=false,completionStart=0;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
document.querySelector('#start-text').textContent=CONFIG.text.start;

function readSave() {
  try {const raw=localStorage.getItem(CONFIG.storageKey);if(!raw)return null;const saved=JSON.parse(raw);if(validState(saved,order,CONFIG.gameId))return saved;localStorage.removeItem(CONFIG.storageKey);}catch{/* Storage may be unavailable. Play remains possible. */}
  return null;
}
function save() {try {localStorage.setItem(CONFIG.storageKey,JSON.stringify(state));}catch{/* Private mode/quota: retain in-memory state. */}}
function maskFor(image,rect) {
  const c=document.createElement('canvas');c.width=rect[2];c.height=rect[3];const x=c.getContext('2d',{willReadFrequently:true});
  x.drawImage(image,...rect,0,0,c.width,c.height);return {data:x.getImageData(0,0,c.width,c.height).data,w:c.width,h:c.height};
}
function opaque(mask,point,size) {
  if(!mask||point[0]<0||point[1]<0||point[0]>=size[0]||point[1]>=size[1])return false;
  const x=Math.min(mask.w-1,Math.floor(point[0]/size[0]*mask.w)),y=Math.min(mask.h-1,Math.floor(point[1]/size[1]*mask.h));
  return mask.data[(y*mask.w+x)*4+3]>35;
}
function placement(id) {const p=locate(state,id);return p.zone==='shelf'?shelfPlacement(bundle.layout,p.index):bundle.layout.cart_book_samples[p.index];}
function heldPlacement() {
  if(!selected&&!gesture?.dragging)return null;
  const id=gesture?.dragging?gesture.book:selected.id;
  const base=gesture?.dragging?gesture.point:placement(id).center;
  const [w,h]=bundle.layout.held_book_size;
  return {center:[Math.max(w/2,Math.min(941-w/2,base[0])),Math.max(h/2,Math.min(1672-h/2,base[1]))],size:[w,h],grip_side:gesture?.dragging?gesture.side:selected.side,rotation_deg:0};
}
function hitBook(p,includeHeld=true) {
  if(includeHeld&&selected) {const q=heldPlacement();if(inside(localPoint(p,q),[0,0,...q.size]))return selected.id;}
  // Shelf hit regions include the full spine, even transparent rounded corners.
  for(let i=0;i<order.length;i++)if(state.shelf[i]) {const q=shelfPlacement(bundle.layout,i);if(inside(localPoint(p,q),[0,0,...q.size]))return state.shelf[i];}
  const r=bundle.layout.cart.dest_content_rect;
  const cartFront=bundle.layout.cart.foreground_clip_rects||[];
  if(cartFront.some(rect=>inside(p,rect))&&opaque(cartMask,[p[0]-r[0],p[1]-r[1]],[r[2],r[3]]))return null;
  // Traverse back to front and use actual sprite alpha, so covered books are not grabbed through another book/cart.
  for(let i=state.cart.length-1;i>=0;i--) {const id=state.cart[i];if(!id||id===selected?.id)continue;const q=bundle.layout.cart_book_samples[i];if(opaque(bookMasks.get(id),localPoint(p,q),q.size))return id;}
  return null;
}
function toPoint(e) {const r=canvas.getBoundingClientRect();return [(e.clientX-r.left)/r.width*941,(e.clientY-r.top)/r.height*1672];}
function active() {return ready&&started&&!state.complete&&!help.open;}
function select(id,p) {selected={id,side:p[0]<470.5?'left':'right'};render();syncAccess();}
function clearInteraction() {gesture=null;selected=null;render();syncAccess();}
function cancelGesture(e) {if(!gesture||e&&e.pointerId!==gesture.pointerId)return;clearInteraction();}
function commit(action) {
  const next=transition(state,action,order,CONFIG.gameId);selected=null;
  if(next!==state) {state=next;save();if(state.complete)complete();}
  render();syncAccess();
}
function tap(p,hit=hitBook(p)) {
  if(!active())return;
  if(hit) {
    if(selected?.id===hit){selected=null;render();syncAccess();return;}
    if(selected&&locate(state,hit).zone==='shelf') {commit({type:'move',id:selected.id,zone:'shelf',index:locate(state,hit).index});return;}
    select(hit,p);return;
  }
  if(selected) {
    const index=slotAt(p,bundle.layout);
    if(index>=0){commit({type:'move',id:selected.id,zone:'shelf',index});return;}
    if(inside(p,bundle.layout.cart.hit_rect)){commit({type:'move',id:selected.id,zone:'cart'});return;}
  }
  selected=null;render();syncAccess();
}
canvas.addEventListener('pointerdown',e=>{
  if(!active()||gesture||e.isPrimary===false||e.button!==0)return;
  e.preventDefault();const point=toPoint(e),book=hitBook(point);
  gesture={pointerId:e.pointerId,book,point,start:point,startCss:[e.clientX,e.clientY],side:selected?.id===book?selected.side:(point[0]<470.5?'left':'right'),dragging:false};
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{
  if(!gesture||e.pointerId!==gesture.pointerId)return;
  e.preventDefault();gesture.point=toPoint(e);
  if(gesture.book&&!gesture.dragging&&Math.hypot(e.clientX-gesture.startCss[0],e.clientY-gesture.startCss[1])>=CONFIG.dragThresholdCss){gesture.dragging=true;selected=null;}
  if(gesture.dragging)render();
});
canvas.addEventListener('pointerup',e=>{
  if(!gesture||e.pointerId!==gesture.pointerId)return;
  e.preventDefault();const g=gesture,p=toPoint(e);gesture=null;
  if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
  if(!active()){clearInteraction();return;}
  if(g.dragging) {
    const index=slotAt(p,bundle.layout);
    if(index>=0)commit({type:'move',id:g.book,zone:'shelf',index});
    else if(inside(p,bundle.layout.cart.hit_rect))commit({type:'move',id:g.book,zone:'cart'});
    else clearInteraction();
  }else if(Math.hypot(e.clientX-g.startCss[0],e.clientY-g.startCss[1])<CONFIG.dragThresholdCss)tap(p,hitBook(p));
  else clearInteraction();
});
canvas.addEventListener('pointercancel',cancelGesture);
canvas.addEventListener('lostpointercapture',cancelGesture);
window.addEventListener('blur',()=>{if(ready)clearInteraction();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&ready)clearInteraction();});

function fit(text,x,y,size,maxWidth,color='#fff1b4') {
  while(size>14) {ctx.font=`bold ${size}px system-ui, sans-serif`;if(ctx.measureText(text).width<=maxWidth)break;size--;}
  ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,x,y);
}
function outline(q,color='#fff0a3') {
  ctx.save();ctx.translate(...q.center);ctx.rotate((q.rotation_deg||0)*Math.PI/180);ctx.strokeStyle=color;ctx.lineWidth=4;ctx.setLineDash([12,6]);ctx.strokeRect(-q.size[0]/2-3,-q.size[1]/2-3,q.size[0]+6,q.size[1]+6);ctx.restore();
}
function render(now=performance.now()) {
  if(!bundle||!state)return;
  const l=bundle.layout;ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,941,1672);ctx.drawImage(bundle.background,0,0,941,1672);
  const heldId=gesture?.dragging?gesture.book:selected?.id;
  state.shelf.forEach((id,i)=>{if(id&&id!==heldId)drawBook(ctx,bundle,id,shelfPlacement(l,i));});
  if(heldId) {
    for(let i=0;i<order.length;i++)if(!state.shelf[i]) {const q=shelfPlacement(l,i);ctx.fillStyle='#fff2c615';ctx.fillRect(q.center[0]-q.size[0]/2,q.center[1]-q.size[1]/2,...q.size);}
    if(gesture?.dragging){const n=slotAt(gesture.point,l);if(n>=0&&shelfDropPlan(state,heldId,n))outline(shelfPlacement(l,n));}
  }
  drawCart(ctx,bundle);
  state.cart.forEach((id,i)=>{if(id&&id!==heldId)drawBook(ctx,bundle,id,l.cart_book_samples[i]);});
  drawCartForeground(ctx,bundle);
  if(heldId){const q=heldPlacement();drawBook(ctx,bundle,heldId,q);outline(q);drawGripPaws(ctx,bundle,q);}else drawIdlePaws(ctx,bundle);
  // The exact title is split into two lines within the blank header panel.
  const [hx,hy]=l.header_title_center;
  const split=CONFIG.text.title.lastIndexOf(' ');
  fit(CONFIG.text.title.slice(0,split),hx,hy-21,47,l.header_title_max_width);
  fit(CONFIG.text.title.slice(split+1),hx,hy+23,46,l.header_title_max_width);
  fit(CONFIG.text.subtitle,...l.header_subtitle_center,25,l.header_title_max_width,'#ffd0eb');
  fit(CONFIG.text.sign,...l.sign_label_center,38,l.sign_max_width,'#23263b');
  for(let i=0;i<order.length;i++)fit(String(i+1),shelfPlacement(l,i).center[0],l.shelf.number_baseline-10,28,60,'#392517');
  fit(CONFIG.text.footer,...l.footer_center,27,l.footer_max_width,'#ffdaeb');
  message.classList.toggle('complete',state.complete);
  message.textContent=state.complete?CONFIG.text.complete:state.shelf.every(Boolean)?CONFIG.text.incorrect:'';
  if(state.complete) {
    const elapsed=now-completionStart;
    const phase=reducedMotion?0:elapsed/280;
    for(let i=0;i<l.sparkle.particle_count;i++){
      const x=l.shelf.left+(i+.5)/l.sparkle.particle_count*(l.shelf.right-l.shelf.left),y=i%2?l.shelf.baseline+11:l.shelf.baseline-l.shelf.book_height-12;
      const radius=6+(Math.sin(phase+i*1.9)+1)*4;
      ctx.save();ctx.translate(x,y);ctx.fillStyle=l.sparkle.colors[i%l.sparkle.colors.length];ctx.beginPath();ctx.moveTo(0,-radius);ctx.lineTo(3,-3);ctx.lineTo(radius,0);ctx.lineTo(3,3);ctx.lineTo(0,radius);ctx.lineTo(-3,3);ctx.lineTo(-radius,0);ctx.lineTo(-3,-3);ctx.closePath();ctx.fill();ctx.restore();
    }
    if(!reducedMotion&&elapsed<l.sparkle.duration_ms)animation=requestAnimationFrame(render);
  }
}
function complete() {
  // Each fresh completion has exactly one notification. Restores do not enter this function.
  completionStart=performance.now();const run=epoch;
  completeTimer=setTimeout(()=>{
    if(epoch!==run||!state.complete||completionSent)return;
    completionSent=true;
    const detail=Object.freeze({gameId:CONFIG.gameId,status:'complete',complete:true});
    window.dispatchEvent(new CustomEvent('bookband:complete',{detail}));
    const callback=CONFIG.onGameComplete||window.onGameComplete;
    if(typeof callback==='function'){try{callback(detail);}catch(error){console.error('onGameComplete:',error);}}
    if(CONFIG.nextUrl)location.assign(new URL(CONFIG.nextUrl,location.href).href);
  },CONFIG.completionDelayMs);
}
function syncAccess() {
  const holder=document.querySelector('#a11y');holder.replaceChildren();
  if(!active())return;
  const add=(text,fn)=>{const b=document.createElement('button');b.textContent=text;b.onclick=()=>{if(active())fn();};holder.append(b);};
  // Unordered cart controls and numbered shelf controls allow keyboard/screen-reader play without exposing the answer order.
  state.cart.forEach(id=>{if(id)add(`카트: ${bundle.bookFrames.get(id).name_ko}`,()=>tap(placement(id).center,id));});
  state.shelf.forEach((id,i)=>add(`${i+1}번 자리${id?': '+bundle.bookFrames.get(id).name_ko:': 비어 있음'}`,()=>tap(shelfPlacement(bundle.layout,i).center,id||null)));
  if(selected)add('선택 취소',()=>{selected=null;render();syncAccess();});
}
document.querySelector('#start').onclick=()=>{started=true;intro.hidden=true;save();render();syncAccess();};
document.querySelector('#help').onclick=()=>{clearInteraction();help.showModal();};
document.querySelector('#close-help').onclick=()=>{help.close();syncAccess();};
help.addEventListener('close',()=>syncAccess());
document.querySelector('#restart').onclick=()=>{
  if(!ready)return;epoch++;clearTimeout(completeTimer);cancelAnimationFrame(animation);completionSent=false;
  state=freshState(order,CONFIG.gameId);selected=null;gesture=null;started=true;intro.hidden=true;
  try{localStorage.removeItem(CONFIG.storageKey);}catch{}save();render();syncAccess();
};
document.querySelector('#retry').onclick=()=>location.reload();
try {
  bundle=await loadAssetBundle('reshelve');
  if(order.length!==bundle.layout.shelf.slot_count||new Set(order).size!==order.length||!order.every(id=>bundle.bookFrames.has(id))||bundle.layout.cart_book_samples.length!==order.length)throw new Error('책 또는 배치 데이터가 맞지 않습니다.');
  for(const id of order)bookMasks.set(id,maskFor(bundle.bookImage,bundle.bookFrames.get(id).content_rect));
  cartMask=maskFor(bundle.cartImage,bundle.cart.content_rect);
  const restored=readSave();state=restored||freshState(order,CONFIG.gameId);started=!!restored;completionSent=!!restored?.complete;completionStart=performance.now()-bundle.layout.sparkle.duration_ms;
  loading.hidden=true;intro.hidden=started;ready=true;render();syncAccess();
  // Read-only snapshot for integration monitoring and developer verification; never exposes state mutation.
  window.Bookband=Object.freeze({getState:()=>JSON.parse(JSON.stringify(state)),getInteraction:()=>({selected:selected?.id||null,side:selected?.side||gesture?.side||null,dragging:!!gesture?.dragging}),get ready(){return ready;},gameId:CONFIG.gameId});
} catch(error) {
  console.error(error);document.querySelector('#load-text').textContent='이미지를 불러오지 못했어요. 연결을 확인한 뒤 다시 불러와 주세요.';
  document.querySelector('#retry').hidden=false;
}
