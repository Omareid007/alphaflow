"use client";

import { useEffect, useState } from "react";
import { Provider, Credential, Budget, ConnectionTestResult, UsageMetrics, ApiFunction, ApiDiscoveryResult } from "@/lib/admin/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { ProviderForm } from "@/components/admin/provider-form";
import { ProviderListCard } from "./ProviderListCard";
import { ProviderDetailCard } from "./ProviderDetailCard";
import { CredentialsCard } from "./CredentialsCard";
import { BudgetCard } from "./BudgetCard";
import { ApiFunctionsCard } from "./ApiFunctionsCard";

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [usageMetrics, setUsageMetrics] = useState<UsageMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [apiFunctions, setApiFunctions] = useState<ApiFunction[]>([]);
  const [discovering, setDiscovering] = useState(false);

  useEffect(() => {
    loadProviders();
  }, []);

  useEffect(() => {
    if (selectedProvider) {
      loadProviderDetails(selectedProvider.id);
      loadApiFunctions(selectedProvider.id);
    }
  }, [selectedProvider]);

  async function loadProviders() {
    try {
      const res = await fetch('/api/admin/providers');
      if (res.ok) {
        const data = await res.json();
        setProviders(data);
        if (data.length > 0 && !selectedProvider) {
          setSelectedProvider(data[0]);
        }
      }
    } catch (error) {
      toast.error('Failed to load providers');
    } finally {
      setLoading(false);
    }
  }

  async function loadProviderDetails(id: string) {
    try {
      const [credsRes, budgetRes, metricsRes] = await Promise.all([
        fetch(`/api/admin/providers/${id}/credentials`),
        fetch(`/api/admin/providers/${id}/budget`),
        fetch(`/api/admin/providers/${id}/usage?days=30`)
      ]);

      if (credsRes.ok) setCredentials(await credsRes.json());
      if (budgetRes.ok) setBudget(await budgetRes.json());
      if (metricsRes.ok) setUsageMetrics(await metricsRes.json());
    } catch (error) {
      console.error('Failed to load provider details:', error);
    }
  }

  async function handleCreateProvider(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      const res = await fetch('/api/admin/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: formData.get('type'),
          name: formData.get('name'),
          baseUrl: formData.get('baseUrl') || undefined,
          status: 'active',
          tags: [],
          metadata: {}
        })
      });

      if (res.ok) {
        toast.success('Provider created');
        setCreateDialogOpen(false);
        loadProviders();
      } else {
        toast.error('Failed to create provider');
      }
    } catch (error) {
      toast.error('Failed to create provider');
    }
  }

  async function handleCreateProviderEnhanced(data: any) {
    try {
      const res = await fetch('/api/admin/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        toast.success('Provider created successfully');
        setCreateDialogOpen(false);
        loadProviders();
      } else {
        const error = await res.json();
        toast.error(error.message || 'Failed to create provider');
      }
    } catch (error) {
      toast.error('Failed to create provider');
    }
  }

  async function handleTestConnection(id: string) {
    toast.loading('Testing connection...');
    try {
      const res = await fetch(`/api/admin/providers/${id}/test`, { method: 'POST' });
      if (res.ok) {
        const result: ConnectionTestResult = await res.json();
        if (result.success) {
          toast.success(`Connection successful (${result.latency}ms)`);
        } else {
          toast.error(`Connection failed: ${result.error}`);
        }
      }
    } catch (error) {
      toast.error('Test failed');
    }
  }

  async function loadApiFunctions(providerId: string) {
    try {
      const res = await fetch(`/api/admin/providers/${providerId}/functions`);
      if (res.ok) {
        const data = await res.json();
        setApiFunctions(data);
      }
    } catch (error) {
      console.error('Failed to load API functions:', error);
    }
  }

  async function handleDiscoverApis(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProvider) return;

    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const documentUrl = formData.get('url') as string;

    if (!documentUrl) return;

    setDiscovering(true);
    toast.loading('Analyzing API documentation...');

    try {
      const res = await fetch(`/api/admin/providers/${selectedProvider.id}/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentUrl })
      });

      const result: ApiDiscoveryResult = await res.json();

      if (result.success) {
        toast.success(`Discovered ${result.functionsDiscovered} endpoints and ${result.schemasDiscovered} schemas`);
        loadApiFunctions(selectedProvider.id);
      } else {
        toast.error(result.error || 'Failed to discover APIs');
      }
    } catch (error) {
      toast.error('Failed to discover APIs');
    } finally {
      setDiscovering(false);
    }
  }

  async function handleToggleApiFunction(funcId: string, enabled: boolean) {
    if (!selectedProvider) return;

    try {
      const res = await fetch(`/api/admin/providers/${selectedProvider.id}/functions/${funcId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: enabled })
      });

      if (res.ok) {
        toast.success(`Endpoint ${enabled ? 'enabled' : 'disabled'}`);
        loadApiFunctions(selectedProvider.id);
      }
    } catch (error) {
      toast.error('Failed to update endpoint');
    }
  }

  async function handleTestApiFunction(funcId: string) {
    if (!selectedProvider) return;

    toast.loading('Testing endpoint...');
    try {
      const res = await fetch(`/api/admin/providers/${selectedProvider.id}/functions/${funcId}/test`, {
        method: 'POST'
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success) {
          toast.success(`Test passed (${result.latencyMs}ms)`);
        } else {
          toast.error(`Test failed: ${result.error}`);
        }
        loadApiFunctions(selectedProvider.id);
      }
    } catch (error) {
      toast.error('Test failed');
    }
  }

  async function handleDeleteApiFunction(funcId: string) {
    if (!selectedProvider) return;

    try {
      const res = await fetch(`/api/admin/providers/${selectedProvider.id}/functions/${funcId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        toast.success('Endpoint removed');
        loadApiFunctions(selectedProvider.id);
      }
    } catch (error) {
      toast.error('Failed to remove endpoint');
    }
  }

  async function handleAddCredential(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedProvider) return;

    const formData = new FormData(e.currentTarget);

    try {
      const res = await fetch(`/api/admin/providers/${selectedProvider.id}/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: formData.get('kind'),
          value: formData.get('value')
        })
      });

      if (res.ok) {
        toast.success('Credential added');
        loadProviderDetails(selectedProvider.id);
      } else {
        toast.error('Failed to add credential');
      }
    } catch (error) {
      toast.error('Failed to add credential');
    }
  }

  async function handleUpdateBudget(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedProvider) return;

    const formData = new FormData(e.currentTarget);

    try {
      const res = await fetch(`/api/admin/providers/${selectedProvider.id}/budget`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dailyLimit: Number(formData.get('dailyLimit')),
          monthlyLimit: Number(formData.get('monthlyLimit')),
          softLimit: Number(formData.get('softLimit')),
          hardLimit: Number(formData.get('hardLimit'))
        })
      });

      if (res.ok) {
        toast.success('Budget updated');
        loadProviderDetails(selectedProvider.id);
      } else {
        toast.error('Failed to update budget');
      }
    } catch (error) {
      toast.error('Failed to update budget');
    }
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Providers & Budgets</h1>
          <p className="mt-1 text-muted-foreground">
            Manage external service providers and usage limits
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Provider
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Provider</DialogTitle>
            </DialogHeader>
            <ProviderForm mode="create" onSubmit={handleCreateProviderEnhanced} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <ProviderListCard
          providers={providers}
          selectedProvider={selectedProvider}
          onSelectProvider={setSelectedProvider}
        />

        {selectedProvider && (
          <div className="lg:col-span-2 space-y-6">
            <ProviderDetailCard
              provider={selectedProvider}
              onTestConnection={handleTestConnection}
              onRefresh={loadProviderDetails}
            />

            <CredentialsCard
              credentials={credentials}
              onAddCredential={handleAddCredential}
            />

            <BudgetCard
              budget={budget}
              usageMetrics={usageMetrics}
              onUpdateBudget={handleUpdateBudget}
            />

            <ApiFunctionsCard
              apiFunctions={apiFunctions}
              discovering={discovering}
              onDiscoverApis={handleDiscoverApis}
              onToggleApiFunction={handleToggleApiFunction}
              onTestApiFunction={handleTestApiFunction}
              onDeleteApiFunction={handleDeleteApiFunction}
            />
          </div>
        )}
      </div>
    </div>
  );
}
