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
import { Shield, Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RiskRule {
  id: string;
  name: string;
  scope: string;
  severity: string;
  threshold: number;
  description: string;
  enabled: boolean;
}

export default function EnforcementPage() {
  const { toast } = useToast();
  const [rules, setRules] = useState<RiskRule[]>([
    { id: '1', name: 'Max Position Size', scope: 'portfolio', severity: 'high', threshold: 10, description: 'No single position exceeds 10% of portfolio', enabled: true },
    { id: '2', name: 'Daily Loss Limit', scope: 'portfolio', severity: 'critical', threshold: 2, description: 'Stop trading if daily loss exceeds 2%', enabled: true },
    { id: '3', name: 'Concentration Limit', scope: 'strategy', severity: 'medium', threshold: 30, description: 'Sector concentration cannot exceed 30%', enabled: true }
  ]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RiskRule | null>(null);
  const [formData, setFormData] = useState({ name: '', scope: 'portfolio', severity: 'medium', threshold: 10, description: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingRule) {
      setRules(rules.map(r => r.id === editingRule.id ? { ...editingRule, ...formData } : r));
      toast({ title: "Rule updated successfully" });
    } else {
      const newRule: RiskRule = {
        id: Date.now().toString(),
        ...formData,
        enabled: true
      };
      setRules([...rules, newRule]);
      toast({ title: "Rule created successfully" });
    }

    setDialogOpen(false);
    setEditingRule(null);
    setFormData({ name: '', scope: 'portfolio', severity: 'medium', threshold: 10, description: '' });
  };

  const handleEdit = (rule: RiskRule) => {
    setEditingRule(rule);
    setFormData({ name: rule.name, scope: rule.scope, severity: rule.severity, threshold: rule.threshold, description: rule.description });
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setRules(rules.filter(r => r.id !== id));
    toast({ title: "Rule deleted successfully" });
  };

  const toggleEnabled = (id: string) => {
    setRules(rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
    toast({ title: "Rule status updated" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Enforcement</h1>
          <p className="mt-1 text-muted-foreground">Risk rules and guardrails</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingRule(null); setFormData({ name: '', scope: 'portfolio', severity: 'medium', threshold: 10, description: '' }); }}>
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
                <Label htmlFor="severity">Severity</Label>
                <Select value={formData.severity} onValueChange={(value) => setFormData({ ...formData, severity: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
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
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                {editingRule ? 'Update Rule' : 'Create Rule'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Risk Rules
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {rules.map(rule => (
              <div key={rule.id} className="flex items-center justify-between rounded-lg border border-border p-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <p className="font-medium">{rule.name}</p>
                    <Badge variant="outline" className={
                      rule.severity === 'critical' ? 'bg-destructive/10 text-destructive' :
                      rule.severity === 'high' ? 'bg-warning/10 text-warning' : 'bg-blue-400/10 text-blue-400'
                    }>
                      {rule.severity}
                    </Badge>
                    <Badge variant="outline" className={rule.enabled ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}>
                      {rule.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{rule.scope} • {rule.description}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => toggleEnabled(rule.id)}>
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
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
