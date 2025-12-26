"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AllocationPolicy {
  id: string;
  name: string;
  method: string;
  maxPositionSize: number;
  maxConcentration: number;
  enabled: boolean;
}

export default function AllocationPage() {
  const { toast } = useToast();
  const [policies, setPolicies] = useState<AllocationPolicy[]>([
    { id: '1', name: 'Equal Weight', method: 'equal', maxPositionSize: 10, maxConcentration: 25, enabled: true },
    { id: '2', name: 'Risk Parity', method: 'risk_parity', maxPositionSize: 15, maxConcentration: 30, enabled: true }
  ]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<AllocationPolicy | null>(null);
  const [formData, setFormData] = useState({ name: '', method: 'equal', maxPositionSize: 10, maxConcentration: 25 });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingPolicy) {
      setPolicies(policies.map(p => p.id === editingPolicy.id ? { ...editingPolicy, ...formData } : p));
      toast({ title: "Policy updated successfully" });
    } else {
      const newPolicy: AllocationPolicy = {
        id: Date.now().toString(),
        ...formData,
        enabled: true
      };
      setPolicies([...policies, newPolicy]);
      toast({ title: "Policy created successfully" });
    }

    setDialogOpen(false);
    setEditingPolicy(null);
    setFormData({ name: '', method: 'equal', maxPositionSize: 10, maxConcentration: 25 });
  };

  const handleEdit = (policy: AllocationPolicy) => {
    setEditingPolicy(policy);
    setFormData({ name: policy.name, method: policy.method, maxPositionSize: policy.maxPositionSize, maxConcentration: policy.maxConcentration });
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
          <h1 className="text-3xl font-semibold tracking-tight">Allocation</h1>
          <p className="mt-1 text-muted-foreground">Position allocation policies</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingPolicy(null); setFormData({ name: '', method: 'equal', maxPositionSize: 10, maxConcentration: 25 }); }}>
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
                <Label htmlFor="method">Allocation Method</Label>
                <Select value={formData.method} onValueChange={(value) => setFormData({ ...formData, method: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equal">Equal Weight</SelectItem>
                    <SelectItem value="risk_parity">Risk Parity</SelectItem>
                    <SelectItem value="market_cap">Market Cap Weighted</SelectItem>
                    <SelectItem value="volatility">Inverse Volatility</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxPositionSize">Max Position Size (%)</Label>
                <Input
                  id="maxPositionSize"
                  type="number"
                  value={formData.maxPositionSize}
                  onChange={(e) => setFormData({ ...formData, maxPositionSize: parseFloat(e.target.value) })}
                  min="1"
                  max="100"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxConcentration">Max Sector Concentration (%)</Label>
                <Input
                  id="maxConcentration"
                  type="number"
                  value={formData.maxConcentration}
                  onChange={(e) => setFormData({ ...formData, maxConcentration: parseFloat(e.target.value) })}
                  min="1"
                  max="100"
                  required
                />
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
            <Target className="h-5 w-5" />
            Allocation Policies
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
                    Method: {policy.method.replace('_', ' ')} • Max Position: {policy.maxPositionSize}% • Max Concentration: {policy.maxConcentration}%
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
