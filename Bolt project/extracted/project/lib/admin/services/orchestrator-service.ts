import { adminSupabase } from '../supabase';
import { OrchestratorConfig, JobRun } from '../types';

export interface IOrchestratorService {
  getConfig(): Promise<OrchestratorConfig>;
  updateConfig(data: Partial<OrchestratorConfig>): Promise<OrchestratorConfig>;
  toggleKillSwitch(enabled: boolean): Promise<void>;
  triggerRun(jobType: string, mode: 'paper' | 'live'): Promise<JobRun>;
  getRecentRuns(limit?: number): Promise<JobRun[]>;
  getRunById(id: string): Promise<JobRun | null>;
}

class OrchestratorService implements IOrchestratorService {
  async getConfig(): Promise<OrchestratorConfig> {
    const { data, error } = await adminSupabase
      .from('admin_orchestrator_config')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('No orchestrator config found');
    return this.mapConfig(data);
  }

  async updateConfig(input: Partial<OrchestratorConfig>): Promise<OrchestratorConfig> {
    const existing = await this.getConfig();

    const { data, error } = await adminSupabase
      .from('admin_orchestrator_config')
      .update({
        ...(input.mode && { mode: input.mode }),
        ...(input.enabledAgents && { enabled_agents: input.enabledAgents }),
        ...(input.agentParams && { agent_params: input.agentParams }),
        ...(input.schedules && { schedules: input.schedules }),
        ...(input.killSwitch !== undefined && { kill_switch: input.killSwitch }),
        ...(input.metadata && { metadata: input.metadata }),
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return this.mapConfig(data);
  }

  async toggleKillSwitch(enabled: boolean): Promise<void> {
    await this.updateConfig({ killSwitch: enabled });
  }

  async triggerRun(jobType: string, mode: 'paper' | 'live'): Promise<JobRun> {
    const config = await this.getConfig();

    if (config.killSwitch) {
      throw new Error('Cannot trigger run: Kill switch is enabled');
    }

    const { data, error } = await adminSupabase
      .from('admin_job_runs')
      .insert({
        job_type: jobType,
        status: 'running',
        metrics: { mode }
      })
      .select()
      .single();

    if (error) throw error;

    setTimeout(async () => {
      const success = Math.random() > 0.2;
      await adminSupabase
        .from('admin_job_runs')
        .update({
          status: success ? 'completed' : 'failed',
          finished_at: new Date().toISOString(),
          metrics: {
            mode,
            duration: Math.floor(Math.random() * 30000) + 5000,
            itemsProcessed: Math.floor(Math.random() * 100) + 10
          },
          ...(success ? {} : { error: 'Simulated failure for testing' })
        })
        .eq('id', data.id);
    }, 100);

    return this.mapJobRun(data);
  }

  async getRecentRuns(limit: number = 20): Promise<JobRun[]> {
    const { data, error } = await adminSupabase
      .from('admin_job_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map(this.mapJobRun);
  }

  async getRunById(id: string): Promise<JobRun | null> {
    const { data, error } = await adminSupabase
      .from('admin_job_runs')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data ? this.mapJobRun(data) : null;
  }

  private mapConfig(row: any): OrchestratorConfig {
    return {
      id: row.id,
      mode: row.mode,
      enabledAgents: row.enabled_agents || [],
      agentParams: row.agent_params || {},
      schedules: row.schedules || [],
      killSwitch: row.kill_switch,
      metadata: row.metadata || {},
      updatedAt: row.updated_at
    };
  }

  private mapJobRun(row: any): JobRun {
    return {
      id: row.id,
      jobType: row.job_type,
      status: row.status,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      logsRef: row.logs_ref,
      metrics: row.metrics || {},
      error: row.error
    };
  }
}

export const orchestratorService = new OrchestratorService();
