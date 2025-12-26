"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RotateCw, Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RebalancePolicy {
  id: string;
  name: string;
  trigger: string;
  threshold: number;
  frequency: string;
  enabled: boolean;
}

export default function RebalancerPage() {
  const { toast } = useToast();
  const [policies, setPolicies] = useState<RebalancePolicy[]>([
    { id: '1', name: 'Drift-based Rebalance', trigger: 'drift', threshold: 5, frequency: 'daily', enabled: true },
    { id: '2', name: 'Time-based Rebalance', trigger: 'time', threshold: 0, frequency: 'weekly', enabled: true }
  ]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<RebalancePolicy | null>(null);
  const [formData, setFormData] = useState({ name: '', trigger: 'drift', threshold: 5, frequency: 'daily' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingPolicy) {
      setPolicies(policies.map(p => p.id === editingPolicy.id ? { ...editingPolicy, ...formData } : p));
      toast({ title: "Policy updated successfully" });
    } else {
      const newPolicy: RebalancePolicy = {
        id: Date.now().toString(),
        ...formData,
        enabled: true
      };
      setPolicies([...policies, newPolicy]);
      toast({ title: "Policy created successfully" });
    }

    setDialogOpen(false);
    setEditingPolicy(null);
    setFormData({ name: '', trigger: 'drift', threshold: 5, frequency: 'daily' });
  };

  const handleEdit = (policy: RebalancePolicy) => {
    setEditingPolicy(policy);
    setFormData({ name: policy.name, trigger: policy.trigger, threshold: policy.threshold, frequency: policy.frequency });
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setPolicies(policies.filter(p => p.id !== id));
    toast({ title: "Policy deleted successfully" });
  };

  const toggleEnabled = (id: string) => {
    setPolicies(policies.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p));
    toast({ title: "Policy status updated" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Rebalancer</h1>
          <p className="mt-1 text-muted-foreground">Rebalancing policies and triggers</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingPolicy(null); setFormData({ name: '', trigger: 'drift', threshold: 5, frequency: 'daily' }); }}>
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
                  placeholder="e.g. Drift-based Rebalance"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trigger">Trigger Type</Label>
                <Select value={formData.trigger} onValueChange={(value) => setFormData({ ...formData, trigger: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="drift">Drift-based</SelectItem>
                    <SelectItem value="time">Time-based</SelectItem>
                    <SelectItem value="volatility">Volatility-based</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.trigger === 'drift' && (
                <div className="space-y-2">
                  <Label htmlFor="threshold">Drift Threshold (%)</Label>
                  <Input
                    id="threshold"
                    type="number"
                    value={formData.threshold}
                    onChange={(e) => setFormData({ ...formData, threshold: parseFloat(e.target.value) })}
                    min="1"
                    max="50"
                    required
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="frequency">Check Frequency</Label>
                <Select value={formData.frequency} onValueChange={(value) => setFormData({ ...formData, frequency: value })}>
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
              <Button type="submit" className="w-full">
                {editingPolicy ? 'Update Policy' : 'Create Policy'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCw className="h-5 w-5" />
            Rebalance Policies
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {policies.map(policy => (
              <div key={policy.id} className="flex items-center justify-between rounded-lg border border-border p-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <p className="font-medium">{policy.name}</p>
                    <Badge variant="outline" className={policy.enabled ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}>
                      {policy.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {policy.trigger === 'drift' ? `Drift: ${policy.threshold}%` : policy.trigger.charAt(0).toUpperCase() + policy.trigger.slice(1)} •
                    Frequency: {policy.frequency}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => toggleEnabled(policy.id)}>
                    {policy.enabled ? 'Disable' : 'Enable'}
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
        </CardContent>
      </Card>
    </div>
  );
}
