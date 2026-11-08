import {EX, W, phases, workout} from './program.js';

export function serializeWorkout(items) {
  return items.map(item => item.id === 'run'
    ? {id: 'run', target: item.target, tip: item.tip, test: item.test ?? item.name === 'Контрольные 10 км'}
    : {id: item.id, n: item.n, reps: String(item.reps), weight: item.weight, rir: item.rir, rest: item.rest, tip: item.tip});
}

export function resolveWorkout(items, week, day, deferred = false) {
  return items.map(item => {
    if (item.id === 'run') {
      if (item.test && deferred) return {...workout(week, day, true).find(exercise => exercise.id === 'run'), test: true};
      return {...item, name: item.test ? 'Контрольный бег' : 'Бег'};
    }
    return {...item, name: EX[item.id][0], query: EX[item.id][3]};
  });
}

export function weekPlan(plan, week) {
  if (plan?.weeks?.[week]) return structuredClone(plan.weeks[week]);
  const range = W[week - 1][4].split('–').map(Number);
  return {note: phases[week - 1], kmMin: range[0], kmMax: range[1] ?? range[0], days: Array.from({length: 4}, (_, day) => serializeWorkout(workout(week, day)))};
}

export function plannedWorkout(plan, week, day, deferred = false) {
  const items = plan?.weeks?.[week]?.days[day];
  return items ? resolveWorkout(items, week, day, deferred) : resolveWorkout(serializeWorkout(workout(week, day)), week, day, deferred);
}

export function sessionWorkout(journal, week, day) {
  const session = journal.trainingV2?.sessions?.[week + '-' + day];
  return session?.plan ? resolveWorkout(session.plan, week, day, session.deferred) : plannedWorkout(journal.trainingV2?.plan, week, day, session?.deferred);
}

export function emptyPlan() {
  return {name: 'Мой план', weeks: Object.fromEntries(W.map((_, index) => [index + 1, {note: '', kmMin: 0, kmMax: 0, days: [[], [], [], []]}]))};
}

export function plannedSessions(plan, sessions = {}) {
  return W.reduce((total, _, index) => total + weekPlan(plan, index + 1).days.filter((day, dayIndex) => day.length || sessions[(index + 1) + '-' + dayIndex]).length, 0);
}
