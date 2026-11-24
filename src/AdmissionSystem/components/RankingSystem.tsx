import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2, Info } from 'lucide-react';
import type { Department } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface RankingSystemProps {
  selectedDepartments: Department[];
  availableDepartments: Department[];
  maxSelections: number;
  isSelectionLocked?: boolean;
  onUpdate: (selected: Department[], available: Department[]) => void;
}

interface SortableItemProps {
  id: string;
  department: Department;
  index: number;
  onRemove: (id: string) => void;
  isDisabled: boolean;
  key?: string;
}

function SortableItem({ id, department, index, onRemove, isDisabled }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: isDisabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 shadow-sm transition-all duration-300",
        isDragging ? "z-50 shadow-md ring-2 ring-indigo-bloom/20 scale-[1.01] opacity-90" : "hover:border-indigo-bloom/30"
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-2 hover:bg-slate-50 rounded-lg transition-colors text-slate-400 hover:text-indigo-bloom"
      >
        <GripVertical size={20} />
      </div>
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-bloom text-white font-bold text-sm shrink-0">
        {index + 1}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h4 className="font-bold text-slate-800">{department.name}</h4>
          <span className={cn(
            "text-[10px] px-2 py-0.5 rounded-md font-bold",
            department.campus === '台北校區' ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-600"
          )}>
            {department.campus}
          </span>
        </div>
        <p className="text-xs text-slate-500">{department.code}</p>
      </div>
      <button
        type="button"
        disabled={isDisabled}
        onClick={() => onRemove(id)}
        className="p-2 text-slate-400 hover:text-dark-amethyst hover:bg-indigo-50 rounded-lg transition-all"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
}

export default function RankingSystem({
  selectedDepartments,
  availableDepartments,
  maxSelections,
  isSelectionLocked = false,
  onUpdate,
}: RankingSystemProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (isSelectionLocked) return;

    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = selectedDepartments.findIndex((d) => d.id === active.id);
      const newIndex = selectedDepartments.findIndex((d) => d.id === over.id);
      onUpdate(arrayMove(selectedDepartments, oldIndex, newIndex), availableDepartments);
    }
  };

  const addDepartment = (dept: Department) => {
    if (isSelectionLocked || selectedDepartments.length >= maxSelections) return;
    onUpdate([...selectedDepartments, dept], availableDepartments.filter((d) => d.id !== dept.id));
  };

  const removeDepartment = (id: string) => {
    if (isSelectionLocked) return;

    const dept = selectedDepartments.find((d) => d.id === id);
    if (dept) {
      onUpdate(
        selectedDepartments.filter((d) => d.id !== id),
        [...availableDepartments, dept]
      );
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-0">
      {/* Left: Selected Preferences */}
      <div className="lg:basis-[58%] lg:min-w-0">
        <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 h-full">
          <div className="flex items-center justify-between mb-4 gap-3">
            <h2 className="text-2xl font-bold text-slate-800 border-l-4 border-indigo-bloom pl-4">
              第二步：志願填報
            </h2>
            <span className={cn(
              "px-3 py-1 rounded-full text-xs font-bold",
              selectedDepartments.length === maxSelections ? "bg-green-100 text-green-700" : "bg-indigo-100 text-indigo-bloom"
            )}>
              已選 {selectedDepartments.length} / {maxSelections}
            </span>
          </div>

          <div className="mb-3 bg-white border border-slate-200 rounded-xl p-3 space-y-1">
            <p className="text-sm font-semibold text-slate-600">志願檢查</p>
            <p className="text-xs text-slate-500">
              最多可選 {maxSelections} 個，尚可選 {Math.max(0, maxSelections - selectedDepartments.length)} 個。
            </p>
            {isSelectionLocked && (
              <p className="text-xs font-semibold text-amber-600">目前不在報名期間，志願選填已鎖定。</p>
            )}
          </div>

          <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-2 mb-3">
            <Info className="text-amber-600 shrink-0 mt-0.5" size={18} />
            <p className="text-xs text-amber-800">
              請將左側可選系所加入志願，並依序調整優先順序。最多可填寫 {maxSelections} 個志願。
            </p>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <div className="space-y-2 min-h-[150px] max-h-[36vh] overflow-y-auto pr-1">
              {selectedDepartments.length === 0 ? (
                <div className="h-36 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 gap-2">
                  <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center">
                    <Plus size={24} />
                  </div>
                  <p>尚未選擇志願，請從右側加入</p>
                </div>
              ) : (
                <SortableContext
                  items={selectedDepartments.map((d) => d.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {selectedDepartments.map((dept, index) => (
                    <SortableItem
                      key={dept.id}
                      id={dept.id}
                      department={dept}
                      index={index}
                      onRemove={removeDepartment}
                      isDisabled={isSelectionLocked}
                    />
                  ))}
                </SortableContext>
              )}
            </div>
          </DndContext>
        </div>
      </div>

      {/* Right: Available Departments */}
      <div className="lg:basis-[42%] lg:min-w-0">
        <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 h-full flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
            可選系所清單
          </h3>
          <div className="space-y-2 max-h-[36vh] overflow-y-auto pr-2 custom-scrollbar">
            {availableDepartments.map((dept) => (
              <div
                key={dept.id}
                className="group p-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-indigo-bloom/30 hover:shadow-sm transition-all duration-300"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-700 group-hover:text-indigo-bloom transition-colors">
                        {dept.name}
                      </h4>
                      <span className={cn(
                        "text-[9px] px-1.5 py-0.5 rounded-md font-bold",
                        dept.campus === '台北校區' ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-600"
                      )}>
                        {dept.campus}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{dept.description}</p>
                  </div>
                  <button
                    disabled={isSelectionLocked || selectedDepartments.length >= maxSelections}
                    onClick={() => addDepartment(dept)}
                    className={cn(
                      "shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all",
                      isSelectionLocked || selectedDepartments.length >= maxSelections
                        ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                        : "bg-white text-indigo-bloom border border-indigo-bloom/20 hover:bg-indigo-bloom hover:text-white hover:border-indigo-bloom"
                    )}
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>
            ))}
            {availableDepartments.length === 0 && (
              <p className="text-center text-slate-400 py-8 italic">無更多可選系所</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
