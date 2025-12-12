/**
 * AI Active Trader - Workflow Engine
 * Executes n8n-compatible workflow JSON files with sandboxed execution.
 * Supports plug-and-play automation templates.
 */

import { createLogger } from '../common';
import { CircuitBreaker, CircuitBreakerRegistry } from '../common/circuit-breaker';
import { KillSwitch } from '../common/kill-switch';

const logger = createLogger('workflow-engine');

export interface WorkflowNode {
  id: string;
  type: string;
  name: string;
  parameters: Record<string, unknown>;
  position: [number, number];
  credentials?: Record<string, string>;
  disabled?: boolean;
}

export interface WorkflowConnection {
  source: string;
  sourceHandle?: string;
  target: string;
  targetHandle?: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  settings?: {
    executionOrder?: 'v1' | 'v0';
    timezone?: string;
    saveDataErrorExecution?: 'all' | 'none';
    saveDataSuccessExecution?: 'all' | 'none';
  };
  staticData?: Record<string, unknown>;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkflowExecutionContext {
  workflowId: string;
  executionId: string;
  startTime: Date;
  nodeData: Map<string, unknown>;
  variables: Record<string, unknown>;
  credentials: Record<string, Record<string, string>>;
}

export interface WorkflowExecutionResult {
  executionId: string;
  workflowId: string;
  status: 'success' | 'error' | 'cancelled';
  startTime: Date;
  endTime: Date;
  durationMs: number;
  nodeResults: Map<string, { output: unknown; error?: string }>;
  error?: string;
}

type NodeExecutor = (node: WorkflowNode, context: WorkflowExecutionContext, input: unknown) => Promise<unknown>;

const NODE_EXECUTORS: Record<string, NodeExecutor> = {
  'n8n-nodes-base.start': async () => ({}),
  'n8n-nodes-base.set': async (node, _ctx, input) => {
    const values = node.parameters.values as Array<{ name: string; value: unknown }> || [];
    const output = { ...input as Record<string, unknown> };
    for (const v of values) {
      output[v.name] = v.value;
    }
    return output;
  },
  'n8n-nodes-base.if': async (node, _ctx, input) => {
    const conditions = node.parameters.conditions as { boolean?: Array<{ value1: unknown; value2: unknown; operation: string }> } || {};
    const boolConditions = conditions.boolean || [];
    
    for (const cond of boolConditions) {
      if (cond.operation === 'equal' && cond.value1 !== cond.value2) {
        return { branch: 'false', data: input };
      }
    }
    return { branch: 'true', data: input };
  },
  'n8n-nodes-base.httpRequest': async (node, ctx) => {
    const url = node.parameters.url as string;
    const method = (node.parameters.method as string) || 'GET';
    const headers = node.parameters.headers as Record<string, string> || {};
    const body = node.parameters.body as unknown;

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: method !== 'GET' ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return response.json();
    }
    return response.text();
  },
  'n8n-nodes-base.code': async (node, ctx, input) => {
    const code = node.parameters.jsCode as string || node.parameters.code as string || '';
    
    const safeEval = new Function('$input', 'console', `
      "use strict";
      const items = Array.isArray($input) ? $input : [$input];
      ${code}
      return items;
    `);

    const mockConsole = {
      log: (...args: unknown[]) => logger.debug('Workflow code log', { args }),
      warn: (...args: unknown[]) => logger.warn('Workflow code warn', { args }),
      error: (...args: unknown[]) => logger.error('Workflow code error'),
    };

    return safeEval(input, mockConsole);
  },
  'n8n-nodes-base.function': async (node, ctx, input) => {
    return NODE_EXECUTORS['n8n-nodes-base.code'](node, ctx, input);
  },
  'n8n-nodes-base.merge': async (_node, _ctx, input) => {
    if (Array.isArray(input)) {
      return input.flat();
    }
    return input;
  },
  'n8n-nodes-base.noOp': async (_node, _ctx, input) => input,
  'n8n-nodes-base.wait': async (node) => {
    const amount = (node.parameters.amount as number) || 1;
    const unit = (node.parameters.unit as string) || 'seconds';
    const multipliers: Record<string, number> = {
      seconds: 1000,
      minutes: 60000,
      hours: 3600000,
    };
    const delay = amount * (multipliers[unit] || 1000);
    await new Promise(resolve => setTimeout(resolve, Math.min(delay, 30000)));
    return {};
  },
};

export class WorkflowEngine {
  private workflows: Map<string, WorkflowDefinition> = new Map();
  private executions: Map<string, WorkflowExecutionResult> = new Map();
  private circuitRegistry: CircuitBreakerRegistry;
  private customExecutors: Map<string, NodeExecutor> = new Map();

  constructor() {
    this.circuitRegistry = CircuitBreakerRegistry.getInstance();
  }

  registerWorkflow(workflow: WorkflowDefinition): void {
    this.workflows.set(workflow.id, workflow);
    logger.info('Workflow registered', { id: workflow.id, name: workflow.name });
  }

  importN8nWorkflow(json: string | object): WorkflowDefinition {
    const data = typeof json === 'string' ? JSON.parse(json) : json;

    const workflow: WorkflowDefinition = {
      id: data.id || `wf_${Date.now()}`,
      name: data.name || 'Imported Workflow',
      nodes: (data.nodes || []).map((n: Record<string, unknown>) => ({
        id: n.id || n.name,
        type: n.type,
        name: n.name,
        parameters: n.parameters || {},
        position: n.position || [0, 0],
        credentials: n.credentials,
        disabled: n.disabled,
      })),
      connections: this.parseN8nConnections(data.connections || {}),
      settings: data.settings,
      staticData: data.staticData,
      tags: data.tags,
    };

    this.registerWorkflow(workflow);
    return workflow;
  }

  private parseN8nConnections(connections: Record<string, Record<string, Array<Array<{ node: string; type: string; index: number }>>>>): WorkflowConnection[] {
    const result: WorkflowConnection[] = [];

    for (const [sourceNode, outputs] of Object.entries(connections)) {
      for (const [outputType, targets] of Object.entries(outputs)) {
        for (const targetGroup of targets) {
          for (const target of targetGroup) {
            result.push({
              source: sourceNode,
              sourceHandle: outputType,
              target: target.node,
              targetHandle: target.type,
            });
          }
        }
      }
    }

    return result;
  }

  async execute(
    workflowId: string,
    initialData: Record<string, unknown> = {},
    credentials: Record<string, Record<string, string>> = {}
  ): Promise<WorkflowExecutionResult> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const killSwitch = KillSwitch.getInstance();
    if (killSwitch.isActive()) {
      throw new Error('Workflow execution blocked: Kill switch is active');
    }

    const executionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const startTime = new Date();

    const context: WorkflowExecutionContext = {
      workflowId,
      executionId,
      startTime,
      nodeData: new Map(),
      variables: { ...initialData },
      credentials,
    };

    const nodeResults = new Map<string, { output: unknown; error?: string }>();

    try {
      const startNodes = this.findStartNodes(workflow);
      const executionOrder = this.topologicalSort(workflow);

      for (const nodeId of executionOrder) {
        const node = workflow.nodes.find(n => n.id === nodeId || n.name === nodeId);
        if (!node || node.disabled) continue;

        const inputs = this.getNodeInputs(workflow, node, context);

        try {
          const output = await this.executeNode(node, context, inputs);
          context.nodeData.set(node.id, output);
          nodeResults.set(node.id, { output });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          nodeResults.set(node.id, { output: null, error: errorMsg });
          logger.error('Node execution failed', error instanceof Error ? error : undefined, {
            nodeId: node.id,
            nodeType: node.type,
          });
          throw error;
        }
      }

      const result: WorkflowExecutionResult = {
        executionId,
        workflowId,
        status: 'success',
        startTime,
        endTime: new Date(),
        durationMs: Date.now() - startTime.getTime(),
        nodeResults,
      };

      this.executions.set(executionId, result);
      logger.info('Workflow execution completed', {
        executionId,
        workflowId,
        durationMs: result.durationMs,
      });

      return result;

    } catch (error) {
      const result: WorkflowExecutionResult = {
        executionId,
        workflowId,
        status: 'error',
        startTime,
        endTime: new Date(),
        durationMs: Date.now() - startTime.getTime(),
        nodeResults,
        error: error instanceof Error ? error.message : String(error),
      };

      this.executions.set(executionId, result);
      return result;
    }
  }

  private async executeNode(
    node: WorkflowNode,
    context: WorkflowExecutionContext,
    input: unknown
  ): Promise<unknown> {
    const executor = this.customExecutors.get(node.type) || NODE_EXECUTORS[node.type];

    if (!executor) {
      logger.warn('Unknown node type, passing through', { type: node.type });
      return input;
    }

    const breaker = this.circuitRegistry.getOrCreate({
      name: `workflow:${node.type}`,
      failureThreshold: 5,
      timeout: 60000,
    });

    return breaker.execute(() => executor(node, context, input));
  }

  private findStartNodes(workflow: WorkflowDefinition): WorkflowNode[] {
    const targetNodes = new Set(workflow.connections.map(c => c.target));
    return workflow.nodes.filter(n =>
      !targetNodes.has(n.id) && !targetNodes.has(n.name) &&
      (n.type.includes('start') || n.type.includes('trigger') || n.type.includes('webhook'))
    );
  }

  private topologicalSort(workflow: WorkflowDefinition): string[] {
    const nodeIds = new Set(workflow.nodes.map(n => n.id));
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const id of nodeIds) {
      inDegree.set(id, 0);
      adjacency.set(id, []);
    }

    for (const conn of workflow.connections) {
      const sourceId = workflow.nodes.find(n => n.name === conn.source)?.id || conn.source;
      const targetId = workflow.nodes.find(n => n.name === conn.target)?.id || conn.target;

      if (nodeIds.has(sourceId) && nodeIds.has(targetId)) {
        adjacency.get(sourceId)!.push(targetId);
        inDegree.set(targetId, (inDegree.get(targetId) || 0) + 1);
      }
    }

    const queue: string[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id);
    }

    const result: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      for (const neighbor of adjacency.get(current) || []) {
        const newDegree = (inDegree.get(neighbor) || 1) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) queue.push(neighbor);
      }
    }

    return result;
  }

  private getNodeInputs(
    workflow: WorkflowDefinition,
    node: WorkflowNode,
    context: WorkflowExecutionContext
  ): unknown {
    const inputs: unknown[] = [];

    for (const conn of workflow.connections) {
      if (conn.target === node.id || conn.target === node.name) {
        const sourceNode = workflow.nodes.find(n => n.id === conn.source || n.name === conn.source);
        if (sourceNode) {
          const data = context.nodeData.get(sourceNode.id);
          if (data !== undefined) inputs.push(data);
        }
      }
    }

    return inputs.length === 0 ? context.variables : inputs.length === 1 ? inputs[0] : inputs;
  }

  registerNodeExecutor(type: string, executor: NodeExecutor): void {
    this.customExecutors.set(type, executor);
  }

  getWorkflow(id: string): WorkflowDefinition | undefined {
    return this.workflows.get(id);
  }

  getExecution(id: string): WorkflowExecutionResult | undefined {
    return this.executions.get(id);
  }

  listWorkflows(): WorkflowDefinition[] {
    return Array.from(this.workflows.values());
  }

  listExecutions(workflowId?: string, limit = 50): WorkflowExecutionResult[] {
    let executions = Array.from(this.executions.values());

    if (workflowId) {
      executions = executions.filter(e => e.workflowId === workflowId);
    }

    return executions
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(0, limit);
  }

  deleteWorkflow(id: string): boolean {
    return this.workflows.delete(id);
  }
}

export function createWorkflowEngine(): WorkflowEngine {
  return new WorkflowEngine();
}
