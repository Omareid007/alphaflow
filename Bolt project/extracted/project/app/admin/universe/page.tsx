"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Database, Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Universe {
  id: string;
  name: string;
  count: number;
  eligible: number;
  symbols: string[];
}

export default function UniversePage() {
  const { toast } = useToast();
  const [universes, setUniverses] = useState<Universe[]>([
    { id: '1', name: 'US Large Cap', count: 500, eligible: 487, symbols: ['AAPL', 'MSFT', 'GOOGL'] },
    { id: '2', name: 'Tech Sector', count: 150, eligible: 142, symbols: ['NVDA', 'AMD', 'INTC'] },
    { id: '3', name: 'High Momentum', count: 75, eligible: 75, symbols: ['TSLA', 'META', 'NFLX'] }
  ]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUniverse, setEditingUniverse] = useState<Universe | null>(null);
  const [formData, setFormData] = useState({ name: '', symbols: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const symbolArray = formData.symbols.split(',').map(s => s.trim()).filter(Boolean);

    if (editingUniverse) {
      setUniverses(universes.map(u => u.id === editingUniverse.id ? {
        ...editingUniverse,
        name: formData.name,
        symbols: symbolArray,
        count: symbolArray.length,
        eligible: symbolArray.length
      } : u));
      toast({ title: "Universe updated successfully" });
    } else {
      const newUniverse: Universe = {
        id: Date.now().toString(),
        name: formData.name,
        symbols: symbolArray,
        count: symbolArray.length,
        eligible: symbolArray.length
      };
      setUniverses([...universes, newUniverse]);
      toast({ title: "Universe created successfully" });
    }

    setDialogOpen(false);
    setEditingUniverse(null);
    setFormData({ name: '', symbols: '' });
  };

  const handleEdit = (universe: Universe) => {
    setEditingUniverse(universe);
    setFormData({ name: universe.name, symbols: universe.symbols.join(', ') });
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setUniverses(universes.filter(u => u.id !== id));
    toast({ title: "Universe deleted successfully" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Universe</h1>
          <p className="mt-1 text-muted-foreground">Manage trading universes and symbol eligibility</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingUniverse(null); setFormData({ name: '', symbols: '' }); }}>
              <Plus className="mr-2 h-4 w-4" />
              Create Universe
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingUniverse ? 'Edit Universe' : 'Create New Universe'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Universe Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. US Large Cap"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="symbols">Symbols (comma-separated)</Label>
                <Textarea
                  id="symbols"
                  value={formData.symbols}
                  onChange={(e) => setFormData({ ...formData, symbols: e.target.value })}
                  placeholder="AAPL, MSFT, GOOGL, TSLA..."
                  rows={4}
                  required
                />
                <p className="text-xs text-muted-foreground">Enter stock symbols separated by commas</p>
              </div>
              <Button type="submit" className="w-full">
                {editingUniverse ? 'Update Universe' : 'Create Universe'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {universes.map(uni => (
          <Card key={uni.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-lg">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  {uni.name}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(uni)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(uni.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Symbols</span>
                  <span className="font-medium">{uni.count}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Eligible</span>
                  <Badge variant="outline" className="bg-success/10 text-success">
                    {uni.eligible}
                  </Badge>
                </div>
                <div className="pt-2 text-xs text-muted-foreground">
                  {uni.symbols.slice(0, 5).join(', ')}
                  {uni.symbols.length > 5 && '...'}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
