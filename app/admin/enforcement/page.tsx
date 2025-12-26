"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Shield, Plus, Pencil, Trash2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useEnforcementRules,
  useCreateEnforcementRule,
  useUpdateEnforcementRule,
  useDeleteEnforcementRule,
  type EnforcementRule
} from "@/lib/api/hooks";

export default function EnforcementPage() {
  const { toast } = useToast();
  const { data: rules = [], isLoading, refetch } = useEnforcementRules();
  const createRule = useCreateEnforcementRule();
  const updateRule = useUpdateEnforcementRule();
  const deleteRule = useDeleteEnforcementRule();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<EnforcementRule | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    ruleType: 'position_limit',
    threshold: 10,
    description: '',
    scope: 'portfolio'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingRule) {
        await updateRule.mutateAsync({
          id: editingRule.id,
          name: formData.name,
          ruleType: formData.ruleType,
          threshold: String(formData.threshold),
          description: formData.description,
          condition: { scope: formData.scope },
        });
        toast({ title: "Rule updated successfully" });
      } else {
        await createRule.mutateAsync({
          name: formData.name,
          ruleType: formData.ruleType,
          threshold: String(formData.threshold),
          description: formData.description,
          condition: { scope: formData.scope },
          enabled: true,
        });
        toast({ title: "Rule created successfully" });
      }

      setDialogOpen(false);
      setEditingRule(null);
      setFormData({ name: '', ruleType: 'position_limit', threshold: 10, description: '', scope: 'portfolio' });
    } catch (error) {
      toast({ title: "Failed to save rule", variant: "destructive" });
    }
  };

  const handleEdit = (rule: EnforcementRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      ruleType: rule.ruleType,
      threshold: parseFloat(rule.threshold) || 10,
      description: rule.description || '',
      scope: rule.condition?.scope || 'portfolio'
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRule.mutateAsync(id);
      toast({ title: "Rule deleted successfully" });
    } catch (error) {
      toast({ title: "Failed to delete rule", variant: "destructive" });
    }
  };

  const toggleEnabled = async (rule: EnforcementRule) => {
    try {
      await updateRule.mutateAsync({
        id: rule.id,
        enabled: !rule.enabled,
      });
      toast({ title: "Rule status updated" });
    } catch (error) {
      toast({ title: "Failed to update rule", variant: "destructive" });
    }
  };

  const getSeverityFromType = (ruleType: string) => {
    if (ruleType.includes('loss') || ruleType.includes('critical')) return 'critical';
    if (ruleType.includes('limit') || ruleType.includes('high')) return 'high';
    return 'medium';
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
          <h1 className="text-3xl font-semibold tracking-tight">Enforcement</h1>
          <p className="mt-1 text-muted-foreground">Risk rules and guardrails ({rules.length} total)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingRule(null); setFormData({ name: '', ruleType: 'position_limit', threshold: 10, description: '', scope: 'portfolio' }); }}>
                <Plus className="mr-2 h-4 w-4" />
                Add Rule
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingRule ? 'Edit Rule' : 'Create New Rule'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Rule Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Max Position Size"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ruleType">Rule Type</Label>
                  <Select value={formData.ruleType} onValueChange={(value) => setFormData({ ...formData, ruleType: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="position_limit">Position Limit</SelectItem>
                      <SelectItem value="daily_loss">Daily Loss Limit</SelectItem>
                      <SelectItem value="concentration">Concentration Limit</SelectItem>
                      <SelectItem value="volatility">Volatility Threshold</SelectItem>
                      <SelectItem value="drawdown">Max Drawdown</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scope">Scope</Label>
                  <Select value={formData.scope} onValueChange={(value) => setFormData({ ...formData, scope: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="portfolio">Portfolio</SelectItem>
                      <SelectItem value="strategy">Strategy</SelectItem>
                      <SelectItem value="position">Position</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="threshold">Threshold Value</Label>
                  <Input
                    id="threshold"
                    type="number"
                    value={formData.threshold}
                    onChange={(e) => setFormData({ ...formData, threshold: parseFloat(e.target.value) })}
                    min="0"
                    step="0.1"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe when this rule applies..."
                    rows={3}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={createRule.isPending || updateRule.isPending}>
                  {createRule.isPending || updateRule.isPending ? 'Saving...' : (editingRule ? 'Update Rule' : 'Create Rule')}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Risk Rules
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">No enforcement rules found. Create one to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map(rule => {
                const severity = getSeverityFromType(rule.ruleType);
                return (
                  <div key={rule.id} className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <p className="font-medium">{rule.name}</p>
                        <Badge variant="outline" className={
                          severity === 'critical' ? 'bg-destructive/10 text-destructive' :
                          severity === 'high' ? 'bg-warning/10 text-warning' : 'bg-blue-400/10 text-blue-400'
                        }>
                          {severity}
                        </Badge>
                        <Badge variant="outline" className={rule.enabled ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}>
                          {rule.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {rule.condition?.scope || 'portfolio'} • {rule.ruleType.replace('_', ' ')} • Threshold: {rule.threshold}
                        {rule.description && ` • ${rule.description}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => toggleEnabled(rule)}>
                        {rule.enabled ? 'Disable' : 'Enable'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleEdit(rule)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(rule.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
