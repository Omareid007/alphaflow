"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface AuthTabProps {
  formData: {
    authMethod: string;
    customHeaders: Record<string, any>;
  };
  updateField: (field: string, value: any) => void;
}

export function AuthTab({ formData, updateField }: AuthTabProps) {
  return (
    <div className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label htmlFor="authMethod">Authentication Method</Label>
        <Select value={formData.authMethod} onValueChange={(value) => updateField('authMethod', value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="header">Header (API Key)</SelectItem>
            <SelectItem value="bearer">Bearer Token</SelectItem>
            <SelectItem value="basic">Basic Auth</SelectItem>
            <SelectItem value="oauth2">OAuth 2.0</SelectItem>
            <SelectItem value="query">Query Parameter</SelectItem>
            <SelectItem value="body">Request Body</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="customHeaders">Custom Headers (JSON)</Label>
        <Textarea
          id="customHeaders"
          value={JSON.stringify(formData.customHeaders, null, 2)}
          onChange={(e) => {
            try {
              updateField('customHeaders', JSON.parse(e.target.value));
            } catch {}
          }}
          placeholder='{"X-Custom-Header": "value"}'
          rows={4}
        />
        <p className="text-xs text-muted-foreground">JSON object with custom header key-value pairs</p>
      </div>
    </div>
  );
}
