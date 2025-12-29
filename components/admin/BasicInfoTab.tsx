"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BasicInfoTabProps {
  formData: {
    name: string;
    type: string;
    baseUrl: string;
    apiVersion: string;
    requestFormat: string;
    responseFormat: string;
    tags: string[];
  };
  updateField: (field: string, value: any) => void;
}

export function BasicInfoTab({ formData, updateField }: BasicInfoTabProps) {
  return (
    <div className="space-y-4 mt-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Provider Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="e.g. OpenAI GPT-4"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="type">Type *</Label>
          <Select
            value={formData.type}
            onValueChange={(value) => updateField("type", value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="data">Data Provider</SelectItem>
              <SelectItem value="llm">LLM Provider</SelectItem>
              <SelectItem value="broker">Broker</SelectItem>
              <SelectItem value="news">News Feed</SelectItem>
              <SelectItem value="sentiment">Sentiment Analysis</SelectItem>
              <SelectItem value="analytics">Analytics</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="baseUrl">Base URL *</Label>
          <Input
            id="baseUrl"
            type="url"
            value={formData.baseUrl}
            onChange={(e) => updateField("baseUrl", e.target.value)}
            placeholder="https://api.provider.com"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="apiVersion">API Version</Label>
          <Input
            id="apiVersion"
            value={formData.apiVersion}
            onChange={(e) => updateField("apiVersion", e.target.value)}
            placeholder="v1, 2024-01, etc."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="requestFormat">Request Format</Label>
          <Select
            value={formData.requestFormat}
            onValueChange={(value) => updateField("requestFormat", value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="json">JSON</SelectItem>
              <SelectItem value="xml">XML</SelectItem>
              <SelectItem value="form">Form Data</SelectItem>
              <SelectItem value="graphql">GraphQL</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="responseFormat">Response Format</Label>
          <Select
            value={formData.responseFormat}
            onValueChange={(value) => updateField("responseFormat", value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="json">JSON</SelectItem>
              <SelectItem value="xml">XML</SelectItem>
              <SelectItem value="csv">CSV</SelectItem>
              <SelectItem value="text">Plain Text</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tags">Tags (comma-separated)</Label>
        <Input
          id="tags"
          value={formData.tags.join(", ")}
          onChange={(e) =>
            updateField(
              "tags",
              e.target.value
                .split(",")
                .map((t: string) => t.trim())
                .filter(Boolean)
            )
          }
          placeholder="production, high-priority, ml"
        />
      </div>
    </div>
  );
}
