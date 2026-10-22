const imageCache = new Map();
const jsonCache = new Map();
const base = new URL(".", import.meta.url);
async function readJson(path) {
  const url = new URL(path, base).href;
  if (!jsonCache.has(url)) jsonCache.set(url, fetch(url).then(r => {
    if (!r.ok) throw new Error("JSON load failed: " + path);
    return r.json();
  }));
  return jsonCache.get(url);
}
function readImage(primary, fallback) {
  const url = new URL(primary, base).href;
  if (!imageCache.has(url)) imageCache.set(url, new Promise((resolve, reject) => {
    const im = new Image();
    let retried = false;
    im.onload = () => resolve(im);
    im.onerror = () => {
      if (!retried && fallback) { retried = true; im.src = new URL(fallback, base).href; }
      else reject(new Error("Image load failed: " + primary));
    };
    im.src = url;
  }));
  return imageCache.get(url);
}
export async function loadAssetBundle(mode = "reshelve") {
  const [layout, books, background, bookImage] = await Promise.all([
    readJson("layout.json"), readJson("assets/books-atlas-crisp-v2.json"),
    readImage("assets/library-background.webp", "assets/library-background.png"),
    readImage("assets/books-atlas-crisp-v2.webp", "assets/books-atlas-crisp-v2.png")
  ]);
  const bundle = { mode, layout, books, background, bookImage,
    bookFrames: new Map(books.frames.map(frame => [frame.id, frame])) };
  if (mode === "reshelve") {
    const [cart, paws, cartImage, pawImage] = await Promise.all([
      readJson("assets/book-cart.json"), readJson("assets/cat-paws-atlas.json"),
      readImage("assets/book-cart.webp", "assets/book-cart.png"),
      readImage("assets/cat-paws-atlas.webp", "assets/cat-paws-atlas.png")
    ]);
    Object.assign(bundle, { cart, paws, cartImage, pawImage,
      pawFrames: new Map(paws.frames.map(frame => [frame.id, frame])) });
  }
  return bundle;
}
export function drawSprite(ctx, image, rect, dest) {
  ctx.drawImage(image, rect[0], rect[1], rect[2], rect[3], dest[0], dest[1], dest[2], dest[3]);
}
export function drawBook(ctx, bundle, id, placement) {
  const frame = bundle.bookFrames.get(id);
  if (!frame) throw new Error("Unknown book id: " + id);
  const center = placement.center;
  const size = placement.size;
  ctx.save();
  // Sample the original atlas once at the final device resolution, including rotations.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(center[0], center[1]);
  ctx.rotate((placement.rotation_deg || 0) * Math.PI / 180);
  drawSprite(ctx, bundle.bookImage, frame.content_rect, [-size[0]/2, -size[1]/2, size[0], size[1]]);
  ctx.restore();
}
export function drawBookGlow(ctx, silhouette, placement, cssScale) {
  if (!silhouette) return;
  const [w,h]=placement.size, radius=1/Math.max(cssScale,.1);
  ctx.save();ctx.translate(...placement.center);
  ctx.rotate((placement.rotation_deg||0)*Math.PI/180);
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  // Source-alpha silhouette cached once. The next book draw covers its interior.
  // The cart foreground subsequently covers both the glow and the book.
  ctx.globalAlpha=.14;ctx.shadowColor='#fff1b7';ctx.shadowBlur=2;
  for(let i=0;i<12;i++){
    const angle=i*Math.PI/6;
    ctx.drawImage(silhouette,-w/2+Math.cos(angle)*radius,-h/2+Math.sin(angle)*radius,w,h);
  }
  ctx.restore();
}
export function shelfPlacement(bundle, index) {
  const s = bundle.layout.shelf;
  const width = (s.right - s.left) / s.slot_count;
  return { center: [s.left + (index + 0.5) * width, s.baseline - s.book_height/2],
    size: [width, s.book_height], rotation_deg: 0 };
}
export function drawShelf(ctx, bundle, ids) {
  ids.forEach((id, i) => { if (id) drawBook(ctx, bundle, id, shelfPlacement(bundle, i)); });
}
export function drawCart(ctx, bundle) {
  if (!bundle.cartImage) return;
  drawSprite(ctx, bundle.cartImage, bundle.cart.content_rect, bundle.layout.cart.dest_content_rect);
}
export function drawCartForeground(ctx,bundle) {
  const clips=bundle.layout.cart.foreground_clip_rects;
  if(!bundle.cartImage||!clips?.length)return;
  ctx.save();ctx.beginPath();clips.forEach(rect=>ctx.rect(...rect));ctx.clip();
  drawCart(ctx,bundle);ctx.restore();
}
export function drawIdlePaws(ctx, bundle, hideSide = null) {
  if (!bundle.pawImage) return;
  const p = bundle.layout.idle_paws;
  const clips=p.visible_clip_rects||[[0,0,...bundle.layout.design_size],[0,0,...bundle.layout.design_size]];
  [["idle_left", p.left_dest, clips[0]],
   ["idle_right", p.right_dest, clips[1]]].forEach(([id, dest, clip]) => {
    if (id === "idle_" + hideSide) return;
    ctx.save(); ctx.beginPath(); ctx.rect(...clip); ctx.clip();
    drawSprite(ctx, bundle.pawImage, bundle.pawFrames.get(id).content_rect, dest);
    ctx.restore();
  });
}
export function gripPlacement(bundle, bookPlacement) {
  const [cx, cy] = bookPlacement.center;
  const [bw,bh] = bookPlacement.size;
  const settings=bundle.layout.grip_paws||{};
  const width=settings.width||135,overlap=settings.book_overlap??6;
  const side = bookPlacement.grip_side || (cx >= 470.5 ? "right" : "left");
  const frame=bundle.pawFrames.get("grip_"+side),rect=frame.content_rect;
  const contact=frame.grip_anchor_in_content;
  const height=width*rect[3]/rect[2];
  const x=side==='left'?cx-bw/2-width+overlap:cx+bw/2-overlap;
  const y=cy+bh*(settings.anchor_y_ratio??.44)-contact[1]*width/rect[2];
  return {side,rect,dest:[x,y,width,height],anchor:[x+contact[0]*width/rect[2],cy+bh*(settings.anchor_y_ratio??.44)]};
}
export function drawGripPaws(ctx, bundle, bookPlacement) {
  if (!bundle.pawImage) return;
  const grip=gripPlacement(bundle,bookPlacement);
  drawIdlePaws(ctx, bundle, grip.side);
  // Render the original hand and wrist at their natural aspect ratio. No stretched forearm.
  drawSprite(ctx,bundle.pawImage,grip.rect,grip.dest);
}
function textFit(ctx, text, x, y, initial, maxWidth, color="#fff1b4") {
  let size=initial;
  do { ctx.font="bold "+size+"px sans-serif"; size--; }
  while(ctx.measureText(text).width>maxWidth && size>14);
  ctx.fillStyle=color; ctx.textAlign="center"; ctx.textBaseline="alphabetic"; ctx.fillText(text,x,y);
}
export function drawUi(ctx, bundle) {
  textFit(ctx,"책을 올바른 순서로",560,64,49,630);
  textFit(ctx,"제자리에!",560,109,48,630);
  textFit(ctx,"실제 서가의 책띠를 살펴보세요",560,139,25,630,"#ffc7ea");
  textFit(ctx,"신간도서 코너",470,565,38,320,"#18243f");
  const s=bundle.layout.shelf;
  for(let i=0;i<10;i++)textFit(ctx,String(i),s.left+(i+.5)*(s.right-s.left)/10,s.number_baseline,28,60,"#18130d");
  const footer=bundle.mode==="reshelve"?"끌어서 꽂기 · 찬 자리에는 밀어 넣기":"두 책을 차례로 누르면 자리가 바뀌어요";
  textFit(ctx,footer,470,1647,27,760,"#ffd7ee");
}
export function drawSparkles(ctx,bundle) {
  const positions=[[97,580],[265,584],[430,795],[608,773],[699,581],[858,584],[878,641],[62,771],[880,774]];
  for(const [x,y] of positions){
    ctx.save();ctx.translate(x,y);ctx.fillStyle="#fff3ae";ctx.beginPath();
    ctx.moveTo(0,-12);ctx.lineTo(3,-3);ctx.lineTo(12,0);ctx.lineTo(3,3);
    ctx.lineTo(0,12);ctx.lineTo(-3,3);ctx.lineTo(-12,0);ctx.lineTo(-3,-3);ctx.closePath();ctx.fill();ctx.restore();
  }
  textFit(ctx,"클리어!",470,bundle.mode==="reshelve"?1215:1430,78,600,"#ffe495");
}
export function renderAssetPreview(ctx,bundle,state="initial"){
  const [w,h]=bundle.layout.design_size;
  ctx.clearRect(0,0,w,h);ctx.imageSmoothingEnabled=false;ctx.drawImage(bundle.background,0,0,w,h);
  const order=["900","300","700","200","500","400","800","600","100","000"];
  if(state==="complete"){
    drawShelf(ctx,bundle,bundle.books.frames.map(f=>f.id));
    if(bundle.mode==="reshelve"){drawCart(ctx,bundle);drawIdlePaws(ctx,bundle);}
  }else if(bundle.mode==="reshelve"){
    drawCart(ctx,bundle);
    order.forEach((id,i)=>{if(state==="held"&&id==="500")return;drawBook(ctx,bundle,id,bundle.layout.cart_book_samples[i]);});
    drawCartForeground(ctx,bundle);
    if(state==="held"){
      const held={center:[690,724],size:bundle.layout.held_book_size,rotation_deg:0,grip_side:"right"};
      drawBook(ctx,bundle,"500",held);drawGripPaws(ctx,bundle,held);
    }else drawIdlePaws(ctx,bundle);
  }else drawShelf(ctx,bundle,order);
  drawUi(ctx,bundle);
  if(state==="complete")drawSparkles(ctx,bundle);
}

