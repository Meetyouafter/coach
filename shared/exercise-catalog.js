import {originalExerciseName} from './exercise-names.js';

export const categories = [
  {id:'chest',label:'Грудь',description:'Жимы и разведения',bodyPart:'chest'},
  {id:'back',label:'Спина',description:'Тяги и подтягивания',bodyPart:'back'},
  {id:'shoulders',label:'Плечи',description:'Жимы и подъёмы рук',bodyPart:'shoulders'},
  {id:'arms',label:'Руки',description:'Бицепс и трицепс',bodyPart:'upper arms'},
  {id:'legs',label:'Ноги и ягодицы',description:'Приседания, выпады и тяги',bodyPart:'upper legs'},
  {id:'core',label:'Пресс',description:'Стабилизация и мышцы живота',bodyPart:'waist'},
  {id:'calves',label:'Икры',description:'Мышцы голени',bodyPart:'lower legs'},
  {id:'forearms',label:'Предплечья',description:'Хват и кисти',bodyPart:'lower arms'},
  {id:'cardio',label:'Кардио',description:'Выносливость и движение',bodyPart:'cardio'},
  {id:'neck',label:'Шея',description:'Движения для мышц шеи',bodyPart:'neck'},
];
export const equipmentLabels = {
  bodyweight:'Вес тела',barbell:'Штанга',dumbbell:'Гантели',cable:'Блок',
  'leverage machine':'Тренажёр','resistance band':'Резинка',band:'Резинка',
  kettlebell:'Гиря','smith machine':'Тренажёр Смита','stability ball':'Фитбол',
  'ez barbell':'EZ-гриф',weighted:'С отягощением',assisted:'С поддержкой',
};
export const muscleLabels = {
  pectorals:'Грудные мышцы',lats:'Широчайшие',traps:'Трапеции',
  'upper back':'Верх спины','erector spinae':'Разгибатели спины',
  deltoids:'Дельтовидные',biceps:'Бицепс',triceps:'Трицепс',
  forearms:'Предплечья',abdominals:'Пресс',obliques:'Косые мышцы живота',
  glutes:'Ягодицы',quadriceps:'Квадрицепсы',hamstrings:'Задняя поверхность бедра',
  calves:'Икры',adductors:'Приводящие мышцы',abductors:'Отводящие мышцы',
  'hip flexors':'Сгибатели бедра','cardiovascular system':'Выносливость',
};
const aliases = {
  'жим лежа':'bench press','жим лёжа':'bench press','жим ногами':'leg press',
  'румынская тяга':'romanian deadlift','жим сидя':'seated shoulder press',
  'отжимания':'push up','подтягивания':'pull up','приседания':'squat',
  'присед':'squat','выпады':'lunge','обратные выпады':'reverse lunge',
  'планка':'plank','боковая планка':'side plank','мост':'bridge',
  'тяга верхнего блока':'lat pulldown','горизонтальная тяга':'cable seated row',
  'жим гантелей сидя':'dumbbell seated shoulder press','румынская тяга с гантелями':'dumbbell romanian deadlift',
  'подъём на носки':'calf raise','подъем на носки':'calf raise','ягодичный мост':'hip thrust','мертвый жук':'dead bug','мёртвый жук':'dead bug',
  'скручивания':'crunch','жим паллофа':'pallof press','паллоф':'pallof',
  'жим':'press','тяга':'row','бицепс':'biceps','трицепс':'triceps',
  'гантели':'dumbbell','штанга':'barbell','икры':'calf',
};
export function searchTerm(value) {
  const key=value.trim().toLowerCase().replace(/\s+/g,' ');
  return aliases[key]??originalExerciseName(value)??value.trim();
}
export const bodyPartLabel = part => categories.find(item=>item.bodyPart===part)?.label??part;
export function safeGifUrl(value) {
  try {const url=new URL(value);return url.protocol==='https:'&&url.hostname==='static.exercisedb.dev'&&/^\/media\/[a-zA-Z0-9_-]+\.gif$/.test(url.pathname)?url.href:null;} catch{return null;}
}
export function normalizeExercise(value) {
  if(!value || typeof value.exerciseId!=='string' || !/^[a-zA-Z0-9_-]{1,40}$/.test(value.exerciseId) || typeof value.name!=='string') return null;
  const list = field => Array.isArray(value[field])?value[field].filter(x=>typeof x==='string').slice(0,30):[];
  return {id:value.exerciseId,name:value.name.slice(0,200),gifUrl:safeGifUrl(value.gifUrl),bodyParts:list('bodyParts'),equipment:list('equipments'),muscles:list('targetMuscles'),secondaryMuscles:list('secondaryMuscles'),instructions:list('instructions').map(line=>line.replace(/^Step\s*:?\s*\d+\s*[:.)-]\s*/i,''))};
}

const programRules={
  bench:{query:'barbell bench press',words:['barbell','bench','press'],exclude:['incline','decline','close','reverse','wide']},
  leg:{query:'sled leg press',words:['leg','press'],exclude:['single','one','calf','narrow','wide']},
  rdl:{query:'dumbbell romanian deadlift',words:['dumbbell','romanian','deadlift']},
  row:{query:'cable seated row',words:['cable','seated','row'],exclude:['one arm','single arm']},
  calf:{query:'standing calf raise',words:['standing','calf','raise'],equipment:'bodyweight'},
  tib:{query:'tibialis raise',words:['tibialis','raise'],equipment:'bodyweight'},
  side:{query:'side plank',words:['side','plank'],equipment:'bodyweight',exclude:['raise','twist','crunch','knee']},
  press:{query:'dumbbell seated shoulder press',words:['dumbbell','seated','press'],exclude:['arnold','one arm']},
  chestrow:{query:'dumbbell incline row',words:['dumbbell','incline','row'],exclude:['rear','fly']},
  lateral:{query:'dumbbell lateral raise',words:['dumbbell','lateral','raise'],exclude:['rear','lying','incline']},
  curl:{query:'dumbbell biceps curl',words:['dumbbell','curl'],exclude:['incline','preacher','concentration','lying','hammer','wrist']},
  triceps:{query:'cable triceps pushdown',words:['cable','pushdown'],exclude:['one arm','reverse','single arm']},
  bug:{query:'dead bug',words:['dead','bug']},
  lunge:{query:'reverse lunge',words:['reverse','lunge'],equipment:'bodyweight'},
  bridge:{query:'lever hip thrust',words:['hip','thrust'],equipment:'leverage machine'},
  incline:{query:'dumbbell incline bench press',words:['dumbbell','incline','press'],exclude:['twist','hammer','close','one arm']},
  lat:{query:'cable lat pulldown',words:['cable','pulldown'],exclude:['one arm','single arm','straight arm','reverse']},
  seated:{query:'lever seated calf raise',words:['seated','calf','raise'],equipment:'leverage machine'},
  ham:{query:'lever seated leg curl',words:['seated','leg','curl'],equipment:'leverage machine'},
  pallof:{query:'cable pallof press',words:['pallof','press'],equipment:'cable'},
  crunch:{query:'reverse crunch',words:['reverse','crunch'],equipment:'bodyweight'},
  pogo:{query:'pogo jump',words:['pogo','jump']},
};
const cleanName=name=>name.toLowerCase().replace(/[-_]/g,' ').replace(/\s+/g,' ');
export function programQuery(id,fallback='') {return programRules[id]?.query??fallback;}
export function matchProgramExercise(id,items) {
  const rule=programRules[id];if(!rule)return null;
  const matches=items.filter(item=>{
    const name=cleanName(item.name);
    return item.gifUrl&&rule.words.every(word=>name.includes(word))&&!(rule.exclude??[]).some(word=>name.includes(word))&&(!rule.equipment||item.equipment.includes(rule.equipment));
  });
  return matches.sort((a,b)=>a.name.length-b.name.length)[0]??null;
}
