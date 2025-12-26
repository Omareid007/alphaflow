"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, Plus, Pencil, Trash2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useAllocationPolicies,
  useCreateAllocationPolicy,
  useUpdateAllocationPolicy,
  useDeleteAllocationPolicy,
  type AllocationPolicy
} from "@/lib/api/hooks";

export default function AllocationPage() {
  const { toast } = useToast();
  const { data: policies = [], isLoading, refetch } = useAllocationPolicies();
  const createPolicy = useCreateAllocationPolicy();
  const updatePolicy = useUpdateAllocationPolicy();
  const deletePolicy = useDeleteAllocationPolicy();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<AllocationPolicy | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    maxPositionWeightPct: 10,
    maxSectorWeightPct: 25,
    rebalanceFrequency: 'daily'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingPolicy) {
        await updatePolicy.mutateAsync({
          id: editingPolicy.id,
          name: formData.name,
          maxPositionWeightPct: String(formData.maxPositionWeightPct),
          maxSectorWeightPct: String(formData.maxSectorWeightPct),
          rebalanceFrequency: formData.rebalanceFrequency,
        });
        toast({ title: "Policy updated successfully" });
      } else {
        await createPolicy.mutateAsync({
          name: formData.name,
          maxPositionWeightPct: String(formData.maxPositionWeightPct),
          maxSectorWeightPct: String(formData.maxSectorWeightPct),
          rebalanceFrequency: formData.rebalanceFrequency,
          isActive: false,
        });
        toast({ title: "Policy created successfully" });
      }

      setDialogOpen(false);
      setEditingPolicy(null);
      setFormData({ name: '', maxPositionWeightPct: 10, maxSectorWeightPct: 25, rebalanceFrequency: 'daily' });
    } catch (error) {
      toast({ title: "Failed to save policy", variant: "destructive" });
    }
  };

  const handleEdit = (policy: AllocationPolicy) => {
    setEditingPolicy(policy);
    setFormData({
      name: policy.name,
      maxPositionWeightPct: parseFloat(policy.maxPositionWeightPct) || 10,
      maxSectorWeightPct: parseFloat(policy.maxSectorWeightPct) || 25,
      rebalanceFrequency: policy.rebalanceFrequency || 'daily'
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePolicy.mutateAsync(id);
      toast({ title: "Policy deleted successfully" });
    } catch (error) {
      toast({ title: "Failed to delete policy", variant: "destructive" });
    }
  };

  const toggleEnabled = async (policy: AllocationPolicy) => {
    try {
      await updatePolicy.mutateAsync({
        id: policy.id,
        isActive: !policy.isActive,
      });
      toast({ title: "Policy status updated" });
    } catch (error) {
      toast({ title: "Failed to update policy", variant: "destructive" });
    }
  };

  if (isLoading) {
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
          <h1 className="text-3xl font-semibold tracking-tight">Allocation</h1>
          <p className="mt-1 text-muted-foreground">Position allocation policies ({policies.length} total)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingPolicy(null); setFormData({ name: '', maxPositionWeightPct: 10, maxSectorWeightPct: 25, rebalanceFrequency: 'daily' }); }}>
                <Plus className="mr-2 h-4 w-4" />
                New Policy
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingPolicy ? 'Edit Policy' : 'Create New Policy'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Policy Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Equal Weight Allocation"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxPositionWeightPct">Max Position Size (%)</Label>
                  <Input
                    id="maxPositionWeightPct"
                    type="number"
                    value={formData.maxPositionWeightPct}
                    onChange={(e) => setFormData({ ...formData, maxPositionWeightPct: parseFloat(e.target.value) })}
                    min="1"
                    max="100"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxSectorWeightPct">Max Sector Concentration (%)</Label>
                  <Input
                    id="maxSectorWeightPct"
                    type="number"
                    value={formData.maxSectorWeightPct}
                    onChange={(e) => setFormData({ ...formData, maxSectorWeightPct: parseFloat(e.target.value) })}
                    min="1"
                    max="100"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rebalanceFrequency">Rebalance Frequency</Label>
                  <Select value={formData.rebalanceFrequency} onValueChange={(value) => setFormData({ ...formData, rebalanceFrequency: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={createPolicy.isPending || updatePolicy.isPending}>
                  {createPolicy.isPending || updatePolicy.isPending ? 'Saving...' : (editingPolicy ? 'Update Policy' : 'Create Policy')}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Allocation Policies
          </CardTitle>
        </CardHeader>
        <CardContent>
          {policies.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">No allocation policies found. Create one to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {policies.map(policy => (
                <div key={policy.id} className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <p className="font-medium">{policy.name}</p>
                      <Badge variant="outline" className={policy.isActive ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}>
                        {policy.isActive ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Max Position: {policy.maxPositionWeightPct}% • Max Sector: {policy.maxSectorWeightPct}% • Frequency: {policy.rebalanceFrequency}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => toggleEnabled(policy)}>
                      {policy.isActive ? 'Disable' : 'Enable'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleEdit(policy)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(policy.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
