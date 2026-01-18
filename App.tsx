
import React, { useState, useEffect, useRef } from 'react';
import { Todo, Phase, Priority, SubTask } from './types';
import Layout from './components/Layout';
import { breakdownTask, suggestScheduling, getProjectInsights } from './services/geminiService';

interface EditingSubTaskState {
  todoId: string;
  subTaskId: string;
  text: string;
  priority: Priority;
  estimatedTime: string;
}

const App: React.FC = () => {
  const [phase, setPhase] = useState<Phase>(Phase.PHASE_1);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [newSubTaskValues, setNewSubTaskValues] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(false);
  const [processingTaskId, setProcessingTaskId] = useState<string | null>(null);
  const [aiInsight, setAiInsight] = useState('');
  const [hasSelectedKey, setHasSelectedKey] = useState(false);
  
  // Main Todo Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // Subtask Editing state
  const [editingSubTask, setEditingSubTask] = useState<EditingSubTaskState | null>(null);
  const subTaskInputRef = useRef<HTMLInputElement>(null);

  // Local storage persistence
  useEffect(() => {
    const saved = localStorage.getItem('ai_todos');
    if (saved) setTodos(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('ai_todos', JSON.stringify(todos));
  }, [todos]);

  // Check for selected API key (Phase 5+)
  useEffect(() => {
    const checkKey = async () => {
      if (typeof window.aistudio?.hasSelectedApiKey === 'function') {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasSelectedKey(selected);
      }
    };
    checkKey();
  }, [phase]);

  // Focus management
  useEffect(() => {
    if (editingId && editInputRef.current) editInputRef.current.focus();
  }, [editingId]);

  useEffect(() => {
    if (editingSubTask && subTaskInputRef.current) subTaskInputRef.current.focus();
  }, [editingSubTask]);

  // Helper: Parse duration string to minutes for sorting
  const parseDuration = (timeStr?: string): number => {
    if (!timeStr) return 9999; // Put items without time at the end
    const time = timeStr.toLowerCase();
    let totalMinutes = 0;
    
    const hoursMatch = time.match(/(\d+)\s*h/);
    const minutesMatch = time.match(/(\d+)\s*m/);
    
    if (hoursMatch) totalMinutes += parseInt(hoursMatch[1]) * 60;
    if (minutesMatch) totalMinutes += parseInt(minutesMatch[1]);
    
    // If no match but contains digits, assume minutes
    if (totalMinutes === 0) {
        const digits = time.match(/\d+/);
        if (digits) totalMinutes = parseInt(digits[0]);
    }
    
    return totalMinutes || 9999;
  };

  // Helper: Priority Weighting
  const priorityWeight = { high: 0, medium: 1, low: 2 };

  // CRUD - TASKS
  const addTodo = () => {
    if (!inputValue.trim()) return;
    const newTodo: Todo = {
      id: crypto.randomUUID(),
      text: inputValue,
      completed: false,
      priority: 'medium',
      createdAt: Date.now(),
      subTasks: [],
      collapsed: false
    };
    setTodos([newTodo, ...todos]);
    setInputValue('');
  };

  const deleteTodo = (id: string) => {
    setTodos(todos.filter(t => t.id !== id));
  };

  const toggleTodo = (id: string) => {
    setTodos(todos.map(t => {
      if (t.id === id) {
        const newCompleted = !t.completed;
        const updatedSubTasks = t.subTasks?.map(st => ({ ...st, completed: newCompleted }));
        return { ...t, completed: newCompleted, subTasks: updatedSubTasks };
      }
      return t;
    }));
  };

  const toggleCollapse = (id: string) => {
    setTodos(todos.map(t => t.id === id ? { ...t, collapsed: !t.collapsed } : t));
  };

  const startEditing = (todo: Todo) => {
    setEditingId(todo.id);
    setEditingText(todo.text);
  };

  const saveEdit = () => {
    if (editingId) {
      const trimmed = editingText.trim();
      if (trimmed) {
        setTodos(todos.map(t => t.id === editingId ? { ...t, text: trimmed } : t));
      }
      setEditingId(null);
    }
  };

  // CRUD - SUBTASKS
  const addSubTask = (todoId: string) => {
    const text = newSubTaskValues[todoId];
    if (!text || !text.trim()) return;

    setTodos(todos.map(todo => {
      if (todo.id === todoId) {
        const newSub: SubTask = {
          id: crypto.randomUUID(),
          text: text.trim(),
          completed: false,
          priority: 'medium'
        };
        return {
          ...todo,
          subTasks: [...(todo.subTasks || []), newSub],
          completed: false,
          collapsed: false // Ensure expanded when adding a new subtask
        };
      }
      return todo;
    }));

    setNewSubTaskValues({ ...newSubTaskValues, [todoId]: '' });
  };

  const deleteSubTask = (todoId: string, subTaskId: string) => {
    setTodos(todos.map(todo => {
      if (todo.id === todoId) {
        const updatedSubTasks = todo.subTasks?.filter(st => st.id !== subTaskId) || [];
        const allSubTasksDone = updatedSubTasks.length > 0 
          ? updatedSubTasks.every(st => st.completed) 
          : todo.completed;
        return { ...todo, subTasks: updatedSubTasks, completed: allSubTasksDone };
      }
      return todo;
    }));
  };

  const toggleSubTask = (todoId: string, subTaskId: string) => {
    setTodos(todos.map(todo => {
      if (todo.id === todoId) {
        const updatedSubTasks = todo.subTasks?.map(st => 
          st.id === subTaskId ? { ...st, completed: !st.completed } : st
        );
        const allSubTasksDone = updatedSubTasks && updatedSubTasks.length > 0 
          ? updatedSubTasks.every(st => st.completed) 
          : todo.completed;
        return { ...todo, subTasks: updatedSubTasks, completed: allSubTasksDone };
      }
      return todo;
    }));
  };

  const startEditingSubTask = (todoId: string, st: SubTask) => {
    setEditingSubTask({
      todoId,
      subTaskId: st.id,
      text: st.text,
      priority: st.priority || 'medium',
      estimatedTime: st.estimatedTime || ''
    });
  };

  const saveSubTaskEdit = () => {
    if (editingSubTask) {
      const { todoId, subTaskId, text, priority, estimatedTime } = editingSubTask;
      if (text.trim()) {
        setTodos(todos.map(todo => {
          if (todo.id === todoId) {
            return {
              ...todo,
              subTasks: todo.subTasks?.map(st => 
                st.id === subTaskId 
                  ? { ...st, text: text.trim(), priority, estimatedTime } 
                  : st
              )
            };
          }
          return todo;
        }));
      }
      setEditingSubTask(null);
    }
  };

  // Subtask Sorting
  const sortSubTasks = (todoId: string, criteria: 'priority' | 'time') => {
    setTodos(todos.map(todo => {
        if (todo.id === todoId && todo.subTasks) {
            const sorted = [...todo.subTasks].sort((a, b) => {
                if (criteria === 'priority') {
                    return (priorityWeight[a.priority || 'medium'] - priorityWeight[b.priority || 'medium']);
                } else {
                    return parseDuration(a.estimatedTime) - parseDuration(b.estimatedTime);
                }
            });
            return { ...todo, subTasks: sorted };
        }
        return todo;
    }));
  };

  // AI SERVICES
  const handleBreakdown = async (id: string) => {
    setLoading(true);
    setProcessingTaskId(id);
    const todo = todos.find(t => t.id === id);
    if (todo) {
      try {
        const subtaskData = await breakdownTask(todo.text);
        setTodos(todos.map(t => t.id === id ? {
          ...t,
          completed: false,
          collapsed: false, // Automatically expand when broken down
          subTasks: subtaskData.map(data => ({ 
            id: crypto.randomUUID(), 
            text: data.text, 
            completed: false,
            priority: data.priority as Priority,
            estimatedTime: data.estimatedTime
          }))
        } : t));
      } catch (error) {
        console.error("AI breakdown failed", error);
      }
    }
    setLoading(false);
    setProcessingTaskId(null);
  };

  const handleSmartSchedule = async () => {
    if (todos.length === 0) return;
    setLoading(true);
    const taskPayload = todos.map(t => ({ id: t.id, text: t.text }));
    const suggestions = await suggestScheduling(taskPayload);
    
    setTodos(todos.map(t => {
      const suggestion = suggestions.find((s: any) => s.id === t.id);
      if (suggestion) {
        return {
          ...t,
          priority: suggestion.priority as Priority,
          estimatedTime: suggestion.estimatedTime,
          suggestedSlot: suggestion.suggestedSlot
        };
      }
      return t;
    }));
    setLoading(false);
  };

  const fetchInsights = async () => {
    setLoading(true);
    const insights = await getProjectInsights(todos);
    setAiInsight(insights || '');
    setLoading(false);
  };

  const openKeySelector = async () => {
    if (typeof window.aistudio?.openSelectKey === 'function') {
      await window.aistudio.openSelectKey();
      setHasSelectedKey(true);
    }
  };

  const isPhaseAtLeast = (p: Phase) => {
    const phases = Object.values(Phase);
    return phases.indexOf(phase) >= phases.indexOf(p);
  };

  return (
    <Layout currentPhase={phase} onPhaseChange={setPhase}>
      {/* Input Section */}
      <div className="flex gap-2 mb-8">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTodo()}
          placeholder="What needs to be done?"
          className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-white"
        />
        <button
          onClick={addTodo}
          className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-100"
        >
          Add Task
        </button>
      </div>

      {/* AI Controls Hub */}
      {isPhaseAtLeast(Phase.PHASE_4) && (
        <div className="flex flex-col gap-2 mb-6">
          <div className="flex gap-2 p-1 bg-slate-100/50 rounded-2xl">
            <button
              onClick={handleSmartSchedule}
              disabled={loading}
              className="flex-1 text-sm bg-white text-purple-700 border border-purple-100 py-3 rounded-xl font-bold hover:bg-purple-50 flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-sm active:shadow-inner"
            >
              <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles text-purple-500'}`}></i>
              AI Smart Schedule
            </button>
            {isPhaseAtLeast(Phase.PHASE_5) && (
              <button
                onClick={fetchInsights}
                disabled={loading}
                className="flex-1 text-sm bg-white text-blue-700 border border-blue-100 py-3 rounded-xl font-bold hover:bg-blue-50 flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-sm active:shadow-inner"
              >
                <i className="fa-solid fa-chart-line text-blue-500"></i>
                Project Hub Insights
              </button>
            )}
          </div>

          {/* Phase 5: Agentic Hub - Google AI Studio Integration */}
          {isPhaseAtLeast(Phase.PHASE_5) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
              <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl p-4 text-white shadow-lg border border-indigo-500/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <i className="fa-solid fa-cloud-bolt text-indigo-300"></i>
                    <span className="text-xs font-bold uppercase tracking-widest">AI Studio Managed</span>
                  </div>
                  {hasSelectedKey && (
                    <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/30">
                      Connected
                    </span>
                  )}
                </div>
                <h4 className="text-sm font-semibold mb-2">Connect your Google Project</h4>
                <p className="text-[11px] text-indigo-100/80 mb-4 leading-relaxed">
                  Unlock Pro features by connecting a paid API key from your GCP project. 
                  Manage prompts directly in the AI Studio dashboard.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={openKeySelector}
                    className="bg-white/10 hover:bg-white/20 transition-colors px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 flex items-center gap-2"
                  >
                    <i className="fa-solid fa-key"></i> {hasSelectedKey ? 'Switch Key' : 'Select Paid Key'}
                  </button>
                  <a 
                    href="https://aistudio.google.com/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="bg-indigo-500 hover:bg-indigo-400 transition-colors px-3 py-1.5 rounded-lg text-xs font-medium border border-indigo-400 flex items-center gap-2"
                  >
                    <i className="fa-solid fa-up-right-from-square"></i> Open AI Studio
                  </a>
                </div>
                <div className="mt-4 pt-3 border-t border-white/5">
                  <a 
                    href="https://ai.google.dev/gemini-api/docs/billing" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[10px] text-indigo-200/60 hover:text-white transition-colors underline decoration-indigo-200/20"
                  >
                    Learn about billing & paid projects
                  </a>
                </div>
              </div>
              
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-2 text-slate-800">
                  <i className="fa-solid fa-microchip text-indigo-500"></i>
                  <span className="text-sm font-bold">Model Configuration</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Current Model</span>
                    <span className="font-mono bg-slate-200 px-1.5 py-0.5 rounded">gemini-3-flash-preview</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Capabilities</span>
                    <span className="text-indigo-600 font-medium italic">Vision, Audio, Logic</span>
                  </div>
                  <div className="pt-2">
                    <div className="w-full bg-slate-200 rounded-full h-1.5">
                      <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: '85%' }}></div>
                    </div>
                    <span className="text-[9px] text-slate-400 mt-1 block">Agent Efficiency: 85%</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Insights Display */}
      {aiInsight && isPhaseAtLeast(Phase.PHASE_5) && (
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-2xl p-4 mb-6 text-sm text-indigo-900 italic shadow-sm">
          <div className="font-bold mb-1 flex items-center gap-2">
            <i className="fa-solid fa-brain text-indigo-500"></i> AI Agent Analysis
          </div>
          {aiInsight}
        </div>
      )}

      {/* Todo List */}
      <div className="space-y-4">
        {todos.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 opacity-50">
              <i className="fa-regular fa-clipboard text-3xl"></i>
            </div>
            <p className="font-medium">No tasks yet</p>
            <p className="text-xs">Add your first task to start the evolution</p>
          </div>
        ) : (
          todos.map(todo => (
            <div key={todo.id} className="group border border-slate-100 bg-slate-50/50 rounded-2xl p-5 hover:border-indigo-200 hover:bg-white transition-all shadow-sm hover:shadow-md">
              <div className="flex items-start gap-4">
                <button
                  onClick={() => toggleTodo(todo.id)}
                  className={`mt-1 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    todo.completed ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300 bg-white hover:border-indigo-400'
                  }`}
                >
                  {todo.completed && <i className="fa-solid fa-check text-xs scale-110"></i>}
                </button>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {editingId === todo.id ? (
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onBlur={saveEdit}
                        onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                        className="w-full text-lg font-medium bg-transparent border-b-2 border-indigo-500 focus:outline-none text-slate-700 py-0"
                      />
                    ) : (
                      <>
                        <span 
                          onClick={() => startEditing(todo)}
                          className={`text-lg font-medium cursor-pointer transition-colors ${todo.completed ? 'text-slate-400 line-through' : 'text-slate-700 hover:text-indigo-600'}`}
                        >
                          {todo.text}
                        </span>
                        
                        <div className="flex items-center gap-1">
                          {/* AI Breakdown Button: Prominent magic wand next to main task */}
                          {isPhaseAtLeast(Phase.PHASE_3) && !todo.completed && (
                            <button
                              onClick={() => handleBreakdown(todo.id)}
                              className="opacity-0 group-hover:opacity-100 transition-all text-indigo-500 hover:text-indigo-700 p-1.5 rounded-full hover:bg-indigo-50 active:scale-90"
                              title={processingTaskId === todo.id ? "Generating subtasks..." : "AI Breakdown Task"}
                              disabled={loading}
                            >
                              <i className={`fa-solid ${processingTaskId === todo.id ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles text-xs'}`}></i>
                            </button>
                          )}

                          {/* Collapse/Expand Toggle (Phase 3+) */}
                          {isPhaseAtLeast(Phase.PHASE_3) && (todo.subTasks?.length || 0) > 0 && (
                            <button
                              onClick={() => toggleCollapse(todo.id)}
                              className="text-slate-400 hover:text-indigo-500 p-1 rounded-full hover:bg-slate-100 transition-all"
                              title={todo.collapsed ? "Expand subtasks" : "Collapse subtasks"}
                            >
                              <i className={`fa-solid fa-chevron-${todo.collapsed ? 'right' : 'down'} text-[10px]`}></i>
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  
                  {/* Phase 2+ Priority & Schedule Badges */}
                  {isPhaseAtLeast(Phase.PHASE_2) && (
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${
                        todo.priority === 'high' ? 'bg-red-100 text-red-600' :
                        todo.priority === 'medium' ? 'bg-amber-100 text-amber-600' :
                        'bg-emerald-100 text-emerald-600'
                      }`}>
                        {todo.priority || 'medium'}
                      </span>
                      {isPhaseAtLeast(Phase.PHASE_4) && todo.estimatedTime && (
                        <div className="flex items-center gap-1.5 bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded-full font-medium">
                          <i className="fa-regular fa-clock text-[9px]"></i> {todo.estimatedTime}
                          {todo.suggestedSlot && (
                            <>
                              <span className="opacity-30">|</span>
                              <i className="fa-regular fa-calendar-check text-[9px]"></i> {todo.suggestedSlot}
                            </>
                          )}
                        </div>
                      )}
                      {(todo.subTasks?.length || 0) > 0 && todo.collapsed && (
                        <span className="text-[9px] text-slate-400 font-medium">
                          <i className="fa-solid fa-layer-group mr-1 opacity-50"></i>
                          {todo.subTasks?.length} subtasks hidden
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => deleteTodo(todo.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 p-2 rounded-xl transition-all hover:bg-red-50"
                    title="Delete task"
                  >
                    <i className="fa-solid fa-trash-can"></i>
                  </button>
                </div>
              </div>

              {/* Subtasks Section (Phase 3+) */}
              {isPhaseAtLeast(Phase.PHASE_3) && !todo.collapsed && (
                <div className="ml-10 mt-4 pt-4 border-t border-slate-100 space-y-3">
                  {/* Sort Controls for Subtasks */}
                  {(todo.subTasks?.length || 0) > 1 && (
                    <div className="flex items-center justify-end gap-3 mb-2 px-1">
                        <span className="text-[9px] uppercase font-bold text-slate-300 tracking-widest">Sort:</span>
                        <button 
                            onClick={() => sortSubTasks(todo.id, 'priority')}
                            className="text-[9px] font-bold text-indigo-400 hover:text-indigo-600 transition-colors flex items-center gap-1"
                        >
                            <i className="fa-solid fa-arrow-down-wide-short"></i> Priority
                        </button>
                        <button 
                            onClick={() => sortSubTasks(todo.id, 'time')}
                            className="text-[9px] font-bold text-indigo-400 hover:text-indigo-600 transition-colors flex items-center gap-1"
                        >
                            <i className="fa-solid fa-clock"></i> Time
                        </button>
                    </div>
                  )}

                  {todo.subTasks?.map(st => {
                    const isEditingThis = editingSubTask?.subTaskId === st.id;
                    return (
                      <div key={st.id} className="group/subtask flex flex-col gap-1">
                        <div className="flex items-center gap-3 text-sm">
                          <button
                            onClick={() => toggleSubTask(todo.id, st.id)}
                            className={`h-4 w-4 rounded border flex items-center justify-center transition-all ${
                              st.completed ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-slate-300 bg-white hover:border-indigo-400'
                            }`}
                          >
                            {st.completed && <i className="fa-solid fa-check text-[10px]"></i>}
                          </button>
                          
                          <div className="flex-1">
                            {isEditingThis ? (
                              <input
                                ref={subTaskInputRef}
                                type="text"
                                value={editingSubTask.text}
                                onChange={(e) => setEditingSubTask({...editingSubTask, text: e.target.value})}
                                onBlur={saveSubTaskEdit}
                                onKeyDown={(e) => e.key === 'Enter' && saveSubTaskEdit()}
                                className="w-full bg-transparent border-b border-indigo-400 focus:outline-none text-slate-600 py-0"
                              />
                            ) : (
                              <span 
                                onClick={() => startEditingSubTask(todo.id, st)}
                                className={`flex-1 cursor-pointer transition-colors ${st.completed ? 'text-slate-400 line-through' : 'text-slate-600 hover:text-indigo-500'}`}
                              >
                                {st.text}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 opacity-0 group-hover/subtask:opacity-100 transition-all">
                            <button
                              onClick={() => startEditingSubTask(todo.id, st)}
                              className="text-slate-200 hover:text-indigo-400 p-1"
                            >
                              <i className="fa-solid fa-pencil text-[9px]"></i>
                            </button>
                            <button
                              onClick={() => deleteSubTask(todo.id, st.id)}
                              className="text-slate-200 hover:text-red-400 p-1"
                            >
                              <i className="fa-solid fa-xmark text-xs"></i>
                            </button>
                          </div>
                        </div>
                        
                        {/* Subtask Metadata - Style Refined to be subtle/small */}
                        <div className="flex items-center gap-2 ml-7">
                          {isEditingThis ? (
                            <div className="flex items-center gap-1.5">
                              <select
                                value={editingSubTask.priority}
                                onChange={(e) => setEditingSubTask({...editingSubTask, priority: e.target.value as Priority})}
                                className={`text-[8px] uppercase font-bold px-1.5 py-0 rounded border-none focus:ring-0 ${
                                  editingSubTask.priority === 'high' ? 'bg-red-50 text-red-400' :
                                  editingSubTask.priority === 'medium' ? 'bg-amber-50 text-amber-400' :
                                  'bg-emerald-50 text-emerald-400'
                                }`}
                              >
                                <option value="low">Low</option>
                                <option value="medium">Med</option>
                                <option value="high">High</option>
                              </select>
                              <input
                                type="text"
                                value={editingSubTask.estimatedTime}
                                onChange={(e) => setEditingSubTask({...editingSubTask, estimatedTime: e.target.value})}
                                placeholder="Time..."
                                className="text-[8px] text-slate-400 bg-transparent border-b border-slate-200 focus:border-indigo-300 focus:outline-none w-12"
                              />
                            </div>
                          ) : (
                            st.priority && (
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[8px] uppercase font-bold px-1.5 py-0 rounded-full leading-tight ${
                                  st.priority === 'high' ? 'bg-red-50/50 text-red-400' :
                                  st.priority === 'medium' ? 'bg-amber-50/50 text-amber-400' :
                                  'bg-emerald-50/50 text-emerald-400'
                                }`}>
                                  {st.priority}
                                </span>
                                {st.estimatedTime && (
                                  <span className="text-[8px] text-slate-300 flex items-center gap-1 px-1 py-0 rounded-full font-medium italic">
                                    <i className="fa-regular fa-clock text-[7px]"></i> {st.estimatedTime}
                                  </span>
                                )}
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Quick Add Subtask */}
                  <div className="flex items-center gap-3 ml-7 py-0.5 opacity-30 focus-within:opacity-100 transition-opacity">
                    <i className="fa-solid fa-plus text-[9px] text-slate-300"></i>
                    <input
                      type="text"
                      placeholder="Next step..."
                      value={newSubTaskValues[todo.id] || ''}
                      onChange={(e) => setNewSubTaskValues({ ...newSubTaskValues, [todo.id]: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && addSubTask(todo.id)}
                      className="flex-1 text-[11px] bg-transparent border-none focus:ring-0 text-slate-400 focus:text-slate-600 placeholder-slate-200 py-0"
                    />
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Progress Footer */}
      <footer className="mt-12 pt-8 border-t border-slate-100 flex items-center justify-between text-slate-400 text-[10px] uppercase tracking-widest font-bold">
        <div>
          {todos.filter(t => t.completed).length} / {todos.length} Done
        </div>
        <div className="flex gap-4">
           <span className="flex items-center gap-1.5 text-indigo-50"><i className="fa-brands fa-react"></i> React 19</span>
           <span className="flex items-center gap-1.5 text-purple-100"><i className="fa-solid fa-bolt"></i> Gemini Agent</span>
        </div>
      </footer>
    </Layout>
  );
};

export default App;
