export const VERSION = 1;
export function isSolved(state, order) {
  return state.cart.every(id => id === null) && state.shelf.every((id,i) => id === order[i]);
}
export function validState(state, order, gameId) {
  if (!state || state.version !== VERSION || state.gameId !== gameId ||
      typeof state.complete !== 'boolean' || !Array.isArray(state.shelf) ||
      !Array.isArray(state.cart) || state.shelf.length !== order.length || state.cart.length !== order.length) return false;
  const ids = [...state.shelf, ...state.cart].filter(id => id !== null);
  return ids.length === order.length && new Set(ids).size === order.length &&
    ids.every(id => order.includes(id)) && state.complete === isSolved(state, order);
}
export function freshState(order, gameId, random = Math.random) {
  const cart = [...order];
  for (let i=cart.length-1;i>0;i--) {const j=Math.floor(random()*(i+1)); [cart[i],cart[j]]=[cart[j],cart[i]];}
  return {version:VERSION, gameId, shelf:order.map(()=>null), cart, complete:false};
}
export function locate(state,id) {
  for (const zone of ['shelf','cart']) { const index=state[zone].indexOf(id); if(index>=0) return {zone,index}; }
  return null;
}
// All transitions clone, verify, then return a single atomic state. Pointer motion never mutates this state.
export function transition(state, action, order, gameId) {
  if (!validState(state,order,gameId) || state.complete) return state;
  const source=locate(state,action.id);
  if (!source) return state;
  const next={...state,shelf:[...state.shelf],cart:[...state.cart]};
  if(action.type==='swap') {
    const target=locate(state,action.otherId);
    if(source.zone!=='shelf'||!target||target.zone!=='shelf'||source.index===target.index) return state;
    [next.shelf[source.index],next.shelf[target.index]]=[next.shelf[target.index],next.shelf[source.index]];
  } else if(action.type==='move') {
    const zone=action.zone;
    if(!['shelf','cart'].includes(zone)) return state;
    if(zone==='cart'&&source.zone==='cart')return state;
    const index=zone==='cart'?state.cart.indexOf(null):action.index;
    if(source.zone===zone&&source.index===index) return state;
    if(!Number.isInteger(index)||index<0||index>=order.length||next[zone][index]!==null) return state;
    next[source.zone][source.index]=null;
    next[zone][index]=action.id;
  } else return state;
  next.complete=isSolved(next,order);
  return validState(next,order,gameId)?next:state;
}
