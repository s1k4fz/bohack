// Simple API client
export const API_BASE_URL = 'http://localhost:5001/api';

export interface OptimizationResult {
  parameters: {
    current_density: number;
    temperature: number;
    co2_flow: number;
  };
  metrics: {
    fe_score: number;
    voltage: number;
    spc: number;
  };
}

export interface TaskResponse {
  task_id: string;
  status: 'success' | 'failed';
  result?: OptimizationResult;
  error?: string;
  duration_ms?: number;
}

export async function createOptimizationTask(taskName: string, templateId: string | null): Promise<TaskResponse> {
  const taskId = `T-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  
  // Map template ID to internal template name
  let template = 'balanced';
  if (templateId === 'tmpl-002') template = 'precision';
  if (templateId === 'tmpl-003') template = 'speed';
  
  try {
    const response = await fetch(`${API_BASE_URL}/optimize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        task_id: taskId,
        template: template,
        task_name: taskName
      }),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to create task:', error);
    throw error;
  }
}

