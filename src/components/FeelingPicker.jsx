import {Check} from 'lucide-react';

export const feelings = [
  {value: 1, image: 'rocket_3d.png', label: 'Очень легко', description: 'Почти без усилий, большой запас сил', color: '#8b5cff', end: '#38caff'},
  {value: 2, image: 'high_voltage_3d.png', label: 'Легко', description: 'Небольшая нагрузка, сил ещё много', color: '#06b887', end: '#b3e83b'},
  {value: 3, image: 'fire_3d.png', label: 'Умеренно', description: 'Пришлось поработать, но нагрузка под контролем', color: '#ff6841', end: '#ffc33b'},
  {value: 4, image: 'low_battery_3d.png', label: 'Тяжело', description: 'Потребовалось много усилий, запас сил небольшой', color: '#e34da2', end: '#b371ff'},
  {value: 5, image: 'skull_3d.png', label: 'Очень тяжело', description: 'Почти на пределе, сил практически не осталось', color: '#fb365f', end: '#ff8b4c'},
];
const colors = feeling => ({'--feeling-color': feeling.color, '--feeling-end': feeling.end});

export function FeelingBadge({value}) {
  const feeling = feelings.find(item => item.value === value);
  if (!feeling) return null;
  return <span className="feeling-badge" style={colors(feeling)} title={'Самочувствие: ' + feeling.description}><span className="feeling-badge-icon"><img src={'/feelings/' + feeling.image} alt="" width="28" height="28" /></span><span>{feeling.label}</span></span>;
}

export function FeelingPicker({value, onChange}) {
  return <fieldset className="feeling-picker"><legend>Насколько тяжело было упражнение? <span>необязательно</span></legend>
    <div className="feeling-options">{feelings.map(feeling => {
      return <button type="button" key={feeling.value} aria-pressed={value === feeling.value} aria-label={'Самочувствие: ' + feeling.label + '. ' + feeling.description} title={feeling.description} style={colors(feeling)} onClick={() => onChange(value === feeling.value ? undefined : feeling.value)}><span className={'feeling-sticker feeling-sticker-' + feeling.value}><img src={'/feelings/' + feeling.image} alt="" width="96" height="96" draggable="false" />{value === feeling.value && <Check className="feeling-selected-check" size={14} aria-hidden="true" />}</span><span className="feeling-label">{feeling.label}</span></button>;
    })}</div>
    <div className="feeling-picker-footer"><span>{value ? 'Нажми ещё раз, чтобы снять оценку.' : 'Можно пропустить.'}</span><a href="/feelings/NOTICE.txt" target="_blank" rel="noreferrer">Microsoft Fluent Emoji</a></div>
  </fieldset>;
}
