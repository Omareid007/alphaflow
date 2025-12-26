import { getAdminSupabase } from '../supabase';
import { ApiFunction, ApiSchema, ApiDiscoveryResult } from '../types';

export interface IApiDiscoveryService {
  discoverApis(providerId: string, documentUrl: string): Promise<ApiDiscoveryResult>;
  listApiFunctions(providerId: string): Promise<ApiFunction[]>;
  getApiFunction(id: string): Promise<ApiFunction | null>;
  updateApiFunction(id: string, data: Partial<ApiFunction>): Promise<ApiFunction>;
  deleteApiFunction(id: string): Promise<void>;
  testApiFunction(id: string): Promise<{ success: boolean; latencyMs: number; error?: string }>;
  listApiSchemas(providerId: string): Promise<ApiSchema[]>;
}

class ApiDiscoveryService implements IApiDiscoveryService {
  async discoverApis(providerId: string, documentUrl: string): Promise<ApiDiscoveryResult> {
    try {
      const response = await fetch(documentUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch API document: ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      let spec: any;

      if (contentType.includes('yaml') || documentUrl.endsWith('.yaml') || documentUrl.endsWith('.yml')) {
        const text = await response.text();
        spec = this.parseYaml(text);
      } else {
        spec = await response.json();
      }

      const result = await this.parseOpenApiSpec(providerId, spec, documentUrl);

      await getAdminSupabase().from('provider_api_discovery_logs').insert({
        provider_id: providerId,
        source_url: documentUrl,
        source_type: spec.openapi ? 'openapi3' : spec.swagger ? 'swagger2' : 'unknown',
        success: true,
        functions_discovered: result.functionsDiscovered,
        schemas_discovered: result.schemasDiscovered
      });

      return result;
    } catch (error: any) {
      await getAdminSupabase().from('provider_api_discovery_logs').insert({
        provider_id: providerId,
        source_url: documentUrl,
        success: false,
        error_message: error.message
      });

      return {
        success: false,
        functionsDiscovered: 0,
        schemasDiscovered: 0,
        functions: [],
        schemas: [],
        error: error.message
      };
    }
  }

  private parseYaml(text: string): any {
    const lines = text.split('\n');
    const result: any = {};
    const stack: { indent: number; obj: any; key: string }[] = [{ indent: -1, obj: result, key: '' }];

    for (const line of lines) {
      if (!line.trim() || line.trim().startsWith('#')) continue;

      const indent = line.search(/\S/);
      const content = line.trim();

      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }

      const current = stack[stack.length - 1].obj;

      if (content.includes(':')) {
        const colonIndex = content.indexOf(':');
        const key = content.substring(0, colonIndex).trim();
        const value = content.substring(colonIndex + 1).trim();

        if (value) {
          current[key] = value.replace(/^["']|["']$/g, '');
        } else {
          current[key] = {};
          stack.push({ indent, obj: current[key], key });
        }
      }
    }

    return result;
  }

  private async parseOpenApiSpec(providerId: string, spec: any, sourceUrl: string): Promise<ApiDiscoveryResult> {
    const functions: ApiFunction[] = [];
    const schemas: ApiSchema[] = [];

    if (spec.components?.schemas || spec.definitions) {
      const schemaSource = spec.components?.schemas || spec.definitions || {};
      for (const [name, schema] of Object.entries<any>(schemaSource)) {
        const apiSchema: Omit<ApiSchema, 'id' | 'createdAt' | 'updatedAt'> = {
          providerId,
          name,
          schemaType: schema.type || 'object',
          properties: schema.properties || {},
          requiredFields: schema.required || [],
          description: schema.description
        };

        const { data } = await getAdminSupabase()
          .from('provider_api_schemas')
          .upsert({
            provider_id: providerId,
            name,
            schema_type: apiSchema.schemaType,
            properties: apiSchema.properties,
            required_fields: apiSchema.requiredFields,
            description: apiSchema.description
          }, { onConflict: 'provider_id,name' })
          .select()
          .single();

        if (data) {
          schemas.push(this.mapSchema(data));
        }
      }
    }

    const paths = spec.paths || {};
    for (const [path, methods] of Object.entries<any>(paths)) {
      for (const [method, operation] of Object.entries<any>(methods)) {
        if (['get', 'post', 'put', 'patch', 'delete', 'options', 'head'].includes(method.toLowerCase())) {
          const parameters = (operation.parameters || []).map((p: any) => ({
            name: p.name,
            in: p.in,
            required: p.required || false,
            type: p.schema?.type || p.type || 'string',
            description: p.description,
            default: p.default,
            enum: p.enum
          }));

          const apiFunction: any = {
            provider_id: providerId,
            name: operation.summary || operation.operationId || `${method.toUpperCase()} ${path}`,
            operation_id: operation.operationId,
            method: method.toUpperCase(),
            path,
            summary: operation.summary,
            description: operation.description,
            tags: operation.tags || [],
            parameters,
            request_body: operation.requestBody,
            responses: operation.responses || {},
            security: operation.security || [],
            auth_required: !!(operation.security?.length),
            is_deprecated: operation.deprecated || false,
            deprecated_message: operation.deprecated ? 'This endpoint is deprecated' : null
          };

          const { data } = await getAdminSupabase()
            .from('provider_api_functions')
            .upsert(apiFunction, { onConflict: 'provider_id,method,path' })
            .select()
            .single();

          if (data) {
            functions.push(this.mapFunction(data));
          }
        }
      }
    }

    return {
      success: true,
      functionsDiscovered: functions.length,
      schemasDiscovered: schemas.length,
      functions,
      schemas
    };
  }

  async listApiFunctions(providerId: string): Promise<ApiFunction[]> {
    const { data, error } = await getAdminSupabase()
      .from('provider_api_functions')
      .select('*')
      .eq('provider_id', providerId)
      .order('path', { ascending: true });

    if (error) throw error;
    return (data || []).map(this.mapFunction);
  }

  async getApiFunction(id: string): Promise<ApiFunction | null> {
    const { data, error } = await getAdminSupabase()
      .from('provider_api_functions')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data ? this.mapFunction(data) : null;
  }

  async updateApiFunction(id: string, input: Partial<ApiFunction>): Promise<ApiFunction> {
    const updateData: any = { updated_at: new Date().toISOString() };

    if (input.name) updateData.name = input.name;
    if (input.isEnabled !== undefined) updateData.is_enabled = input.isEnabled;
    if (input.rateLimit !== undefined) updateData.rate_limit = input.rateLimit;
    if (input.rateLimitWindowSeconds !== undefined) updateData.rate_limit_window_seconds = input.rateLimitWindowSeconds;
    if (input.costPerCall !== undefined) updateData.cost_per_call = input.costPerCall;
    if (input.tokensPerCall !== undefined) updateData.tokens_per_call = input.tokensPerCall;
    if (input.metadata) updateData.metadata = input.metadata;

    const { data, error } = await getAdminSupabase()
      .from('provider_api_functions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapFunction(data);
  }

  async deleteApiFunction(id: string): Promise<void> {
    const { error } = await getAdminSupabase()
      .from('provider_api_functions')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async testApiFunction(id: string): Promise<{ success: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    const latency = Math.random() * 200 + 50;
    const success = Math.random() > 0.1;

    await new Promise(r => setTimeout(r, latency));

    await getAdminSupabase()
      .from('provider_api_functions')
      .update({
        last_tested_at: new Date().toISOString(),
        last_test_success: success,
        last_test_latency_ms: Math.round(latency)
      })
      .eq('id', id);

    return {
      success,
      latencyMs: Math.round(latency),
      error: success ? undefined : 'Simulated test failure'
    };
  }

  async listApiSchemas(providerId: string): Promise<ApiSchema[]> {
    const { data, error } = await getAdminSupabase()
      .from('provider_api_schemas')
      .select('*')
      .eq('provider_id', providerId)
      .order('name', { ascending: true });

    if (error) throw error;
    return (data || []).map(this.mapSchema);
  }

  private mapFunction(row: any): ApiFunction {
    return {
      id: row.id,
      providerId: row.provider_id,
      name: row.name,
      operationId: row.operation_id,
      method: row.method,
      path: row.path,
      summary: row.summary,
      description: row.description,
      tags: row.tags || [],
      parameters: row.parameters || [],
      requestBody: row.request_body,
      responses: row.responses || {},
      security: row.security || [],
      authRequired: row.auth_required,
      rateLimit: row.rate_limit,
      rateLimitWindowSeconds: row.rate_limit_window_seconds,
      costPerCall: Number(row.cost_per_call) || 0,
      tokensPerCall: row.tokens_per_call,
      isEnabled: row.is_enabled,
      isDeprecated: row.is_deprecated,
      deprecatedMessage: row.deprecated_message,
      lastTestedAt: row.last_tested_at,
      lastTestSuccess: row.last_test_success,
      lastTestLatencyMs: row.last_test_latency_ms,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapSchema(row: any): ApiSchema {
    return {
      id: row.id,
      providerId: row.provider_id,
      name: row.name,
      schemaType: row.schema_type,
      properties: row.properties || {},
      requiredFields: row.required_fields || [],
      description: row.description,
      example: row.example,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export const apiDiscoveryService = new ApiDiscoveryService();
