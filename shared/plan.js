import {EX, names, workout} from './program.js';

export const weekdays = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

export function serializeWorkout(items) {
  return items.map(item => item.id === 'run'
    ? {id: 'run', target: item.target, tip: item.tip, test: item.test ?? item.name === 'Контрольные 10 км'}
    : {id: item.id, n: item.n, reps: String(item.reps), weight: item.weight, rir: item.rir, rest: item.rest, tip: item.tip});
}

export function resolveWorkout(items) {
  return items.map(item => item.id === 'run'
    ? {...item, name: item.test ? 'Контрольный бег' : 'Бег'}
    : {...item, name: EX[item.id][0], query: EX[item.id][3]});
}

export function emptyPlan() {
  return {name: 'Мой план', note: '', kmMin: 0, kmMax: 0, days: [[], [], [], []]};
}

export function currentPlan(plan) {
  if (plan?.days) return {...structuredClone(plan), dayNames: plan.dayNames ? [...plan.dayNames] : plan.days.map((_, index) => names[index] ?? `Занятие ${index + 1}`)};
  // Read older account data without carrying its week progression into the active plan.
  const previous = plan?.weeks?.[1] ?? Object.entries(plan?.weeks ?? {}).sort((a, b) => Number(a[0]) - Number(b[0]))[0]?.[1];
  if (previous) return {name: plan.name, ...structuredClone(previous), dayNames: [...names]};
  return {name: plan?.name ?? 'Мой план', dayNames: [...names], note: '', kmMin: 30, kmMax: 30, days: Array.from({length: 4}, (_, day) => serializeWorkout(workout(1, day)))};
}

export function plannedWorkout(plan, day) {
  return resolveWorkout(currentPlan(plan).days[day]);
}

export function sessionName(key, session) {
  return session.name ?? names[sessionDay(key, session)] ?? 'Занятие';
}

export function sessionDay(key, session) {
  return session.day ?? Number(key.split('-')[1]);
}

function restoreSessionItems(items, key, deferred) {
  const resolved = resolveWorkout(items);
  if (deferred && /^(?:[1-9]|1[0-2])-[0-3]$/.test(key)) {
    const [week, day] = key.split('-').map(Number);
    return resolved.map(item => item.id === 'run' && item.test ? {...workout(week, day, true).find(exercise => exercise.id === 'run'), test: true} : item);
  }
  return resolved;
}

export function sessionWorkout(journal, key) {
  const session = journal.trainingV2?.sessions?.[key];
  if (session?.plan) return restoreSessionItems(session.plan, key, session.deferred);
  if (/^(?:[1-9]|1[0-2])-[0-3]$/.test(key)) {
    const [week, day] = key.split('-').map(Number);
    const previous = journal.trainingV2?.plan?.weeks?.[week]?.days[day];
    return restoreSessionItems(previous ?? serializeWorkout(workout(week, day)), key, session?.deferred);
  }
  return plannedWorkout(journal.trainingV2?.plan, sessionDay(key, session));
}
