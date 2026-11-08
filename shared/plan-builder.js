import {EX} from './program.js';

export function createPlanItem(id) {
  if (id === 'run') return {id, target: '5 км легко', tip: '', test: false};
  const exercise = EX[id];
  return {id, n: 2, reps: String(exercise[5]), weight: exercise[1], rir: id === 'pogo' ? '' : '3–4', rest: 90, tip: exercise[2]};
}

// Work on a new draft only after a valid drop; cancelled drags leave the plan intact.
export function placePlanItem(plan, {itemId, fromDay = null, toDay, toIndex}) {
  if (!Number.isInteger(toDay) || !plan.days[toDay]) return {error: 'Выбери занятие для упражнения.'};
  const next = structuredClone(plan);
  const target = next.days[toDay];
  const source = fromDay === null ? null : next.days[fromDay];
  const sourceIndex = source?.findIndex(item => item.id === itemId) ?? -1;
  if (source && sourceIndex < 0) return {error: 'Упражнение уже изменилось. Попробуй ещё раз.'};
  if (fromDay !== toDay && target.some(item => item.id === itemId)) return {error: 'Это упражнение уже есть в выбранном занятии.'};
  const item = source ? source.splice(sourceIndex, 1)[0] : createPlanItem(itemId);
  const index = toIndex === undefined ? target.length : Math.max(0, Math.min(target.length, toIndex));
  target.splice(index, 0, item);
  return {plan: next};
}
