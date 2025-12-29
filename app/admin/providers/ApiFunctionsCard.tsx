import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Search, Code, Trash2, Play, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiFunction } from "@/lib/admin/types";

interface ApiFunctionsCardProps {
  apiFunctions: ApiFunction[];
  discovering: boolean;
  onDiscoverApis: (e: React.FormEvent) => void;
  onToggleApiFunction: (funcId: string, enabled: boolean) => void;
  onTestApiFunction: (funcId: string) => void;
  onDeleteApiFunction: (funcId: string) => void;
}

export function ApiFunctionsCard({
  apiFunctions,
  discovering,
  onDiscoverApis,
  onToggleApiFunction,
  onTestApiFunction,
  onDeleteApiFunction,
}: ApiFunctionsCardProps) {
  const [discoverDialogOpen, setDiscoverDialogOpen] = useState(false);
  const [discoverUrl, setDiscoverUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    onDiscoverApis(e);
    setDiscoverDialogOpen(false);
    setDiscoverUrl("");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Code className="h-4 w-4" />
          API Functions
        </CardTitle>
        <Dialog open={discoverDialogOpen} onOpenChange={setDiscoverDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Search className="mr-2 h-4 w-4" />
              Discover APIs
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Discover API Functions</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>API Documentation URL</Label>
                <Input
                  name="url"
                  value={discoverUrl}
                  onChange={(e) => setDiscoverUrl(e.target.value)}
                  placeholder="https://api.example.com/openapi.json"
                  type="url"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Enter the URL to an OpenAPI/Swagger specification (JSON or
                  YAML)
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Supported formats:</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>- OpenAPI 3.x (openapi.json, openapi.yaml)</li>
                  <li>- Swagger 2.0 (swagger.json, swagger.yaml)</li>
                  <li>- Direct API spec URLs from providers</li>
                </ul>
              </div>
              <Button type="submit" className="w-full" disabled={discovering}>
                {discovering ? "Analyzing..." : "Discover APIs"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {apiFunctions.length === 0 ? (
          <div className="text-center py-8">
            <Code className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-muted-foreground">
              No API functions discovered yet
            </p>
            <p className="text-sm text-muted-foreground">
              Click &quot;Discover APIs&quot; to analyze the provider&apos;s API
              documentation
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>{apiFunctions.length} endpoints discovered</span>
              <span>
                {apiFunctions.filter((f) => f.isEnabled).length} enabled
              </span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Method</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-20">Enabled</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiFunctions.map((func) => (
                  <TableRow key={func.id}>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          func.method === "GET" &&
                            "bg-blue-500/10 text-blue-500",
                          func.method === "POST" &&
                            "bg-green-500/10 text-green-500",
                          func.method === "PUT" &&
                            "bg-yellow-500/10 text-yellow-500",
                          func.method === "PATCH" &&
                            "bg-orange-500/10 text-orange-500",
                          func.method === "DELETE" &&
                            "bg-red-500/10 text-red-500"
                        )}
                      >
                        {func.method}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-mono text-sm">{func.path}</p>
                        {func.summary && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {func.summary}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {func.lastTestSuccess === true && (
                        <Badge
                          variant="outline"
                          className="bg-success/10 text-success"
                        >
                          <CheckCircle className="mr-1 h-3 w-3" />
                          OK
                        </Badge>
                      )}
                      {func.lastTestSuccess === false && (
                        <Badge
                          variant="outline"
                          className="bg-destructive/10 text-destructive"
                        >
                          <XCircle className="mr-1 h-3 w-3" />
                          Failed
                        </Badge>
                      )}
                      {func.lastTestSuccess === null && (
                        <span className="text-xs text-muted-foreground">
                          Not tested
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={func.isEnabled}
                        onCheckedChange={(checked) =>
                          onToggleApiFunction(func.id, checked)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onTestApiFunction(func.id)}
                          title="Test endpoint"
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeleteApiFunction(func.id)}
                          title="Remove endpoint"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
