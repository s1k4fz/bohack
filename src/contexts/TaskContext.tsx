import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

export type TaskStatus = 'running' | 'queued' | 'analyzing' | 'completed' | 'failed';

export interface InitialConditions {
  currentDensity: number;
  temperature: number;
  co2Flow: number;
}

export interface ExpectedMetrics {
  fe: number;
  voltage: number;
  spc: number;
}

export interface TaskResult {
  fe: number;
  voltage: number;
  spc: number;
  co2Processed: number;
  coValue: number;
  completedAt: string;
}

function getSurrogateFE(j: number, T: number, v: number): number {
  const j_norm = (j - 250.0) / 150.0
  const fe_j = Math.exp(-0.5 * j_norm * j_norm)
  const fe_t = 0.9 + 0.2 * (T - 20) / 60.0
  const fe_v = (v / (v + 20.0)) * 1.5
  const fe_total = 95.0 * fe_j * fe_t * fe_v
  return Math.max(0, Math.min(99.9, fe_total))
}

function getSurrogateVoltage(j: number, T: number): number {
  const j_safe = Math.max(j, 1.0)
  const V0 = 1.5
  const Tafel_slope = 0.1
  const R_temp = 2.0 - 1.0 * (T - 20) / 60.0
  const v_ohmic = (j_safe / 1000.0) * R_temp
  const v_act = Tafel_slope * Math.log10(j_safe)
  return V0 + v_act + v_ohmic
}

function getSurrogateSPC(fe: number, voltage: number): number {
  return (voltage / (fe / 100.0 + 0.01)) * 2.5
}

function estimateExpectedMetrics(conditions: InitialConditions): ExpectedMetrics {
  const fe = getSurrogateFE(conditions.currentDensity, conditions.temperature, conditions.co2Flow)
  const voltage = getSurrogateVoltage(conditions.currentDensity, conditions.temperature)
  const spc = getSurrogateSPC(fe, voltage)
  return {
    fe: parseFloat(fe.toFixed(1)),
    voltage: parseFloat(voltage.toFixed(2)),
    spc: parseFloat(spc.toFixed(1)),
  }
}

export interface Task {
  id: string;
  name: string;
  description: string;
  status: TaskStatus;
  progress: number;
  timeElapsed: string;
  createdAt: string;
  initialConditions: InitialConditions;
  currentConditions?: InitialConditions;
  templateId?: string;
  expectedMetrics?: ExpectedMetrics;
  quboConfig?: string;
  lastAnomaly?: {
    type: string;
    severity: 'low' | 'medium' | 'high';
    message: string;
    at: string;
  };
  lastDecisionAt?: string;
  result?: TaskResult;
}

interface TaskContextType {
  runningTasks: Task[];
  completedTasks: Task[];
  allTasks: Task[];
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'progress' | 'timeElapsed' | 'status'>) => Task;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  completeTask: (taskId: string, result: TaskResult) => void;
  failTask: (taskId: string, error?: string) => void;
  getTask: (taskId: string) => Task | undefined;
  deleteTask: (taskId: string) => void;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

function generateTaskId(): string {
  return `T-${Math.floor(1000 + Math.random() * 9000)}`;
}

function formatNow(): string {
  return new Date().toISOString();
}

export function TaskProvider({ children }: { children: ReactNode }) {
  // Initialize from localStorage
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('tasks');
    return saved ? JSON.parse(saved) : [];
  });

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem('tasks', JSON.stringify(tasks));
  }, [tasks]);

  const runningTasks = tasks.filter(t => 
    t.status === 'running' || t.status === 'queued' || t.status === 'analyzing'
  );

  const completedTasks = tasks.filter(t => 
    t.status === 'completed' || t.status === 'failed'
  );

  const addTask = useCallback((taskData: Omit<Task, 'id' | 'createdAt' | 'progress' | 'timeElapsed' | 'status'>): Task => {
    const baseConditions = taskData.currentConditions || taskData.initialConditions
    const expected = taskData.expectedMetrics || estimateExpectedMetrics(baseConditions)

    const newTask: Task = {
      ...taskData,
      id: generateTaskId(),
      status: 'running',
      progress: 0,
      timeElapsed: '0s',
      createdAt: formatNow(),
      currentConditions: baseConditions,
      expectedMetrics: expected,
    };
    setTasks(prev => [newTask, ...prev]);
    return newTask;
  }, []);

  const updateTask = useCallback((taskId: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, ...updates } : t
    ));
  }, []);

  const completeTask = useCallback((taskId: string, result: TaskResult) => {
    setTasks(prev => prev.map(t => 
      t.id === taskId 
        ? { ...t, status: 'completed' as TaskStatus, progress: 100, result } 
        : t
    ));
  }, []);

  const failTask = useCallback((taskId: string) => {
    setTasks(prev => prev.map(t => 
      t.id === taskId 
        ? { ...t, status: 'failed' as TaskStatus } 
        : t
    ));
  }, []);

  const getTask = useCallback((taskId: string): Task | undefined => {
    return tasks.find(t => t.id === taskId);
  }, [tasks]);

  const deleteTask = useCallback((taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  }, []);

  return (
    <TaskContext.Provider value={{ 
      runningTasks, 
      completedTasks, 
      allTasks: tasks,
      addTask, 
      updateTask, 
      completeTask,
      failTask,
      getTask,
      deleteTask
    }}>
      {children}
    </TaskContext.Provider>
  );
}

export function useTasks() {
  const context = useContext(TaskContext);
  if (context === undefined) {
    throw new Error('useTasks must be used within a TaskProvider');
  }
  return context;
}
