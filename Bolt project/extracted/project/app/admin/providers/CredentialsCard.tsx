import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Plus, Eye, EyeOff, Key } from "lucide-react";
import { Credential } from "@/lib/admin/types";

interface CredentialsCardProps {
  credentials: Credential[];
  onAddCredential: (e: React.FormEvent<HTMLFormElement>) => void;
}

export function CredentialsCard({
  credentials,
  onAddCredential
}: CredentialsCardProps) {
  const [credDialogOpen, setCredDialogOpen] = useState(false);
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    onAddCredential(e);
    setCredDialogOpen(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Key className="h-4 w-4" />
          Credentials
        </CardTitle>
        <Dialog open={credDialogOpen} onOpenChange={setCredDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Credential</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Type</Label>
                <Select name="kind" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="apiKey">API Key</SelectItem>
                    <SelectItem value="oauth">OAuth</SelectItem>
                    <SelectItem value="token">Token</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Value</Label>
                <Input name="value" type="password" required />
              </div>
              <Button type="submit" className="w-full">Add Credential</Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {credentials.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">No credentials</p>
        ) : (
          <div className="space-y-2">
            {credentials.map(cred => (
              <div key={cred.id} className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
                <div>
                  <p className="text-sm font-medium">{cred.kind}</p>
                  <p className="text-xs text-muted-foreground">
                    {showSecret[cred.id] ? cred.encryptedValue.slice(0, 20) + '...' : '••••••••••••'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSecret(prev => ({ ...prev, [cred.id]: !prev[cred.id] }))}
                >
                  {showSecret[cred.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
