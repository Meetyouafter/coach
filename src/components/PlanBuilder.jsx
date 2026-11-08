import {useEffect, useState} from 'react';
import {createPortal} from 'react-dom';
import {DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, pointerWithin, rectIntersection, useDraggable, useDroppable, useSensor, useSensors} from '@dnd-kit/core';
import {SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import {ChevronDown, Dumbbell, GripVertical, Plus, Route, Search, Trash2} from 'lucide-react';
import {EX} from '../../shared/program.js';
import {placePlanItem} from '../../shared/plan-builder.js';
import {SelectField} from './SelectField.jsx';

const title = id => id === 'run' ? 'Бег' : EX[id][0];
const itemKey = (day, id) => `item:${day}:${id}`;
const instructions = {draggable: 'Нажми пробел, чтобы взять упражнение. Стрелками выбери место, пробелом опусти. Escape отменяет перенос.'};

function keyboardCoordinates(event, args) {
  // Library entries are draggable sources, so they have no sortable droppable node.
  if (args.context.active?.data.current?.type !== 'library') return sortableKeyboardCoordinates(event, args);
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) return;
  event.preventDefault();
  const {collisionRect, droppableContainers, droppableRects} = args.context;
  if (!collisionRect) return;
  const candidates = droppableContainers.getEnabled().flatMap(container => {
    const data = container.data.current;
    if (data?.type !== 'item' && !(data?.type === 'day' && !data.count)) return [];
    const rect = droppableRects.get(container.id);
    if (!rect) return [];
    const dx = rect.left - collisionRect.left, dy = rect.top - collisionRect.top;
    const eligible = event.code === 'ArrowRight' ? dx > 1 : event.code === 'ArrowLeft' ? dx < -1 : event.code === 'ArrowDown' ? dy > 1 : dy < -1;
    return eligible ? [{rect, distance: dx * dx + dy * dy}] : [];
  }).sort((a, b) => a.distance - b.distance);
  if (candidates.length) return {x: candidates[0].rect.left, y: candidates[0].rect.top};
}

function collisions(args) {
  const hits = args.pointerCoordinates ? pointerWithin(args) : closestCenter(args);
  const items = hits.filter(hit => args.droppableContainers.find(container => container.id === hit.id)?.data.current?.type === 'item');
  if (items.length) return items;
  return hits.length ? hits : args.pointerCoordinates ? rectIntersection(args) : [];
}

function LibraryItem({id, disabled, onAdd}) {
  const {attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging} = useDraggable({id: 'library:' + id, data: {type: 'library', itemId: id, name: title(id)}, disabled});
  const Icon = id === 'run' ? Route : Dumbbell;
  return <div ref={setNodeRef} className={'builder-library-item' + (isDragging ? ' is-dragging' : '')}>
    <button type="button" ref={setActivatorNodeRef} className="builder-grip" {...attributes} {...listeners} disabled={disabled} aria-label={'Перетащить: ' + title(id)}><GripVertical size={19} aria-hidden="true" /></button>
    <Icon size={17} aria-hidden="true" /><span>{title(id)}</span><button type="button" className="builder-add-button" disabled={disabled} onClick={onAdd} aria-label={'Добавить: ' + title(id)}><Plus size={18} aria-hidden="true" /></button>
  </div>;
}

function ExerciseFields({item, onEdit}) {
  const numeric = event => event.target.value === '' ? '' : Number(event.target.value);
  return <details className="builder-item-settings"><summary>Настроить <ChevronDown size={15} aria-hidden="true" /></summary>
    {item.id === 'run' ? <label className="plan-editor-label">Беговое задание<input required maxLength={500} value={item.target} onChange={event => onEdit('target', event.target.value)} /></label> : <div className="plan-editor-grid">
      <label>Подходы<input type="number" min="1" max="20" required value={item.n} onChange={event => onEdit('n', numeric(event))} /></label>
      <label>Повторы<input required maxLength={80} value={item.reps} onChange={event => onEdit('reps', event.target.value)} /></label>
      <label>Вес<input maxLength={120} value={item.weight} onChange={event => onEdit('weight', event.target.value)} /></label>
      <label>Отдых, секунд<input type="number" min="0" max="1800" required value={item.rest} onChange={event => onEdit('rest', numeric(event))} /></label>
    </div>}
    {item.id === 'run' && <label className="plan-editor-label">Как бежать<textarea rows={2} maxLength={3000} value={item.tip} onChange={event => onEdit('tip', event.target.value)} /></label>}
  </details>;
}

function SortableExercise({item, day, workoutNames, index, disabled, targeted, onEdit, onRemove, onTransfer}) {
  const {attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging} = useSortable({id: itemKey(day, item.id), data: {type: 'item', day, itemId: item.id, name: title(item.id)}, disabled});
  return <article ref={setNodeRef} style={{transform: CSS.Transform.toString(transform), transition}} className={'builder-exercise' + (isDragging ? ' is-dragging' : '') + (targeted ? ' is-drop-target' : '')}>
    <div className="builder-exercise-heading"><button type="button" ref={setActivatorNodeRef} className="builder-grip" {...attributes} {...listeners} disabled={disabled} aria-label={'Переместить: ' + title(item.id)}><GripVertical size={20} aria-hidden="true" /></button><span className="builder-exercise-index">{String(index + 1).padStart(2, '0')}</span><strong>{title(item.id)}</strong><button type="button" className="builder-remove" onClick={onRemove} disabled={disabled} aria-label={'Убрать: ' + title(item.id)}><Trash2 size={16} aria-hidden="true" /></button></div>
    <p className="builder-exercise-summary">{item.id === 'run' ? item.target : `${item.n} × ${item.reps}${item.weight ? ' · ' + item.weight : ''}`}</p>
    <ExerciseFields item={item} onEdit={onEdit} />
    <div className="builder-item-alternatives"><label><span className="sr-only">Перенести {title(item.id)} в другое занятие</span><SelectField value="" disabled={disabled} onChange={event => {if (event.target.value !== '') onTransfer(Number(event.target.value));}}><option value="">Перенести в…</option>{workoutNames.map((name, target) => name && target !== day && <option key={target} value={target}>{name}</option>)}</SelectField></label></div>
  </article>;
}

function WorkoutLane({day, workoutNames, items, disabled, overId, onEdit, onRemove, onPlace}) {
  const {setNodeRef, isOver} = useDroppable({id: 'day:' + day, data: {type: 'day', day, name: workoutNames[day] || 'Новое занятие', count: items.length}, disabled});
  const targeted = isOver || items.some(item => itemKey(day, item.id) === overId);
  return <section ref={setNodeRef} className={'builder-lane' + (targeted ? ' is-over' : '')} aria-label={'Конструктор занятия: ' + (workoutNames[day] || 'Новое занятие')}>
    <div className="builder-lane-heading"><h3>{workoutNames[day] || 'Новое занятие'}</h3><span>{items.length} {items.length === 1 ? 'блок' : items.length >= 2 && items.length <= 4 ? 'блока' : 'блоков'}</span></div>
    <SortableContext items={items.map(item => itemKey(day, item.id))} strategy={verticalListSortingStrategy}>
      <div className="builder-lane-items">{items.map((item, index) => <SortableExercise key={item.id} item={item} day={day} workoutNames={workoutNames} index={index} disabled={disabled} targeted={overId === itemKey(day, item.id)} onEdit={(field, value) => onEdit(day, index, field, value)} onRemove={() => onRemove(day, index)} onTransfer={toDay => onPlace({itemId: item.id, fromDay: day, toDay})} />)}</div>
    </SortableContext>
    <div className="builder-dropzone"><Plus size={20} aria-hidden="true" /><span>{items.length ? 'Перетащи сюда следующий блок' : 'Перетащи упражнение или бег сюда'}</span>{!items.length && <small>Пустое занятие — день отдыха</small>}</div>
  </section>;
}

export function PlanBuilder({plan, selectedDay, tab, disabled, onChange, onEdit, onRemove}) {
  const [query, setQuery] = useState('');
  const [targetDay, setTargetDay] = useState(selectedDay ?? 0);
  const [active, setActive] = useState(null);
  const [overId, setOverId] = useState(null);
  const [message, setMessage] = useState('');
  useEffect(() => {setQuery('');}, [tab]);
  const sensors = useSensors(useSensor(PointerSensor, {activationConstraint: {distance: 8}}), useSensor(KeyboardSensor, {coordinateGetter: keyboardCoordinates}));
  const workoutNames = plan.dayNames;
  const ids = tab === 'run' ? ['run'] : tab === 'general' ? [...Object.keys(EX), 'run'] : Object.keys(EX);
  const matches = ids.filter(id => title(id).toLocaleLowerCase('ru-RU').includes(query.trim().toLocaleLowerCase('ru-RU')));
  function place(change) {
    if (disabled) return;
    const result = placePlanItem(plan, change);
    if (result.error) {setMessage(result.error); return;}
    onChange(result.plan);
    setMessage(`${title(change.itemId)} — ${workoutNames[change.toDay] || 'Новое занятие'}. Порядок обновлён.`);
  }
  function endDrag({active: dragged, over}) {
    setActive(null); setOverId(null);
    if (!over || disabled) {setMessage('Перенос отменён.'); return;}
    const from = dragged.data.current;
    const target = over.data.current;
    if (!target || target.day === undefined) return;
    if (from.type === 'item' && from.day === target.day && from.itemId === target.itemId) return;
    const targetItems = plan.days[target.day];
    let toIndex = target.type === 'item' ? targetItems.findIndex(item => item.id === target.itemId) : undefined;
    if (toIndex !== undefined && (from.type === 'library' || from.day !== target.day)) {
      const rect = dragged.rect.current.translated;
      if (rect && rect.top + rect.height / 2 > over.rect.top + over.rect.height / 2) toIndex++;
    }
    place({itemId: from.itemId, fromDay: from.type === 'item' ? from.day : null, toDay: target.day, toIndex});
  }
  const announcements = {
    onDragStart: ({active: item}) => `Взято: ${item.data.current.name}. Выбери место в занятии.`,
    onDragOver: ({over}) => over ? `Место вставки: ${workoutNames[over.data.current.day] || 'Новое занятие'}.` : 'Перемести блок над занятием.',
    onDragEnd: ({over}) => over ? 'Блок отпущен.' : 'Перенос отменён.',
    onDragCancel: () => 'Перенос отменён.',
  };
  return <DndContext sensors={sensors} collisionDetection={collisions} accessibility={{screenReaderInstructions: instructions, announcements}} onDragStart={({active: item}) => {setActive(item.data.current); setMessage('');}} onDragOver={({over}) => setOverId(over?.id ?? null)} onDragCancel={() => {setActive(null); setOverId(null); setMessage('Перенос отменён.');}} onDragEnd={endDrag}>
    <div className="plan-builder">
      <aside className="builder-library"><div className="builder-library-heading"><p className="tag">Библиотека</p><h3>{tab === 'run' ? 'Бег' : tab === 'general' ? 'Упражнения и бег' : 'Упражнения'}</h3><p className="muted">Тяни за ⋮⋮ в нужное занятие или добавляй кнопкой +.</p></div>
        <label className="builder-search"><Search size={16} aria-hidden="true" /><span className="sr-only">Поиск в библиотеке конструктора</span><input type="search" placeholder="Найти упражнение" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => {if (event.key === 'Enter') event.preventDefault();}} /></label>
        {selectedDay === undefined && <label className="builder-target-day">Добавлять кнопкой + в<SelectField value={targetDay} onChange={event => setTargetDay(Number(event.target.value))}>{workoutNames.map((name, day) => name && <option key={day} value={day}>{name}</option>)}</SelectField></label>}
        <div className="builder-library-list">{matches.map(id => <LibraryItem key={id} id={id} disabled={disabled} onAdd={() => place({itemId: id, toDay: targetDay})} />)}{!matches.length && <p className="muted">Ничего не найдено. Попробуй другое название.</p>}</div>
      </aside>
      <div className="builder-canvas"><div className="builder-canvas-heading"><h3>{selectedDay === undefined ? 'Конструктор занятий' : 'Конструктор занятия'}</h3><p className="muted">Добавляй блоки и меняй их порядок. Настройки открываются в карточке.</p><p role="status" aria-live="polite" className="builder-status">{message || 'Все изменения сохраняются кнопкой «Сохранить занятие».'}</p></div><div className="builder-lanes">{workoutNames.map((name, day) => (selectedDay === undefined ? Boolean(name) : day === selectedDay) && <WorkoutLane key={day} day={day} workoutNames={workoutNames} items={plan.days[day]} disabled={disabled} overId={overId} onEdit={onEdit} onRemove={onRemove} onPlace={place} />)}</div></div>
    </div>
    {typeof document !== 'undefined' && createPortal(<DragOverlay dropAnimation={{duration: 180, easing: 'ease-out'}}>{active && <div className="builder-drag-overlay"><GripVertical size={20} aria-hidden="true" /><strong>{active.name}</strong><span>{active.type === 'library' ? 'Добавить в занятие' : 'Переместить блок'}</span></div>}</DragOverlay>, document.body)}
  </DndContext>;
}
