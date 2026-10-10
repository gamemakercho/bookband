export function inside(p,r) {return p[0]>=r[0]&&p[0]<r[0]+r[2]&&p[1]>=r[1]&&p[1]<r[1]+r[3];}
export function localPoint(point, placement) {
  const a=-(placement.rotation_deg||0)*Math.PI/180, x=point[0]-placement.center[0],y=point[1]-placement.center[1];
  return [x*Math.cos(a)-y*Math.sin(a)+placement.size[0]/2,x*Math.sin(a)+y*Math.cos(a)+placement.size[1]/2];
}
export function slotAt(point,layout) {
  const s=layout.shelf;
  if(point[0]<s.left||point[0]>=s.right||!inside(point,s.drop_rect))return -1;
  return Math.floor((point[0]-s.left)/(s.right-s.left)*s.slot_count);
}
export function shelfPlacement(layout,index) {
  const s=layout.shelf,w=(s.right-s.left)/s.slot_count;
  return {center:[s.left+(index+.5)*w,s.baseline-s.book_height/2],size:[w,s.book_height],rotation_deg:0};
}
export function cartPlacements(layout,cart,heldId=null) {
  const slots=layout.cart_book_samples;
  return slots.map((sample,i)=>{
    if(!sample.stack)return sample;
    // Close physical gaps inside a pile without changing state, ids or book order.
    const below=slots.slice(0,i).filter((p,j)=>p.stack===sample.stack&&cart[j]&&cart[j]!==heldId);
    const bottom=sample.stack_baseline-below.reduce((sum,p)=>sum+p.size[0],0);
    return {...sample,center:[sample.center[0],bottom-sample.size[0]/2]};
  });
}
