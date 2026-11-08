import names from './exercise-names.ru.json' with {type:'json'};

// Keep provider names intact: matching GIFs and upstream searches use English.
const normalize=value=>value.toLowerCase().replace(/[‐‑–—_-]/g,' ').replace(/\s+/g,' ').trim();
const englishNames=new Map();
for(const [english,russian] of Object.entries(names)) {
  const key=normalize(russian);
  if(!englishNames.has(key)||english.length<englishNames.get(key).length)englishNames.set(key,english);
}

export function exerciseName(name) {
  const key=normalize(name);
  return Object.hasOwn(names,key)?names[key]:name;
}

export function originalExerciseName(name) {
  return englishNames.get(normalize(name));
}
