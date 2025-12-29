"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BasicInfoTab } from "./BasicInfoTab";
import { AuthTab } from "./AuthTab";
import { LimitsTab } from "./LimitsTab";
import { ReliabilityTab } from "./ReliabilityTab";
import { MonitoringTab } from "./MonitoringTab";

interface ProviderFormProps {
  onSubmit: (data: any) => void;
  initialData?: any;
  mode: "create" | "edit";
}

export function ProviderForm({
  onSubmit,
  initialData,
  mode,
}: ProviderFormProps) {
  const [formData, setFormData] = useState(
    initialData || {
      name: "",
      type: "data",
      baseUrl: "",
      apiVersion: "",
      authMethod: "header",
      status: "active",
      rateLimitRequests: 100,
      rateLimitWindowSeconds: 60,
      rateLimitPerKey: false,
      retryEnabled: true,
      retryMaxAttempts: 3,
      retryBackoffMs: 1000,
      retryBackoffMultiplier: 2.0,
      timeoutConnectMs: 5000,
      timeoutRequestMs: 30000,
      timeoutTotalMs: 60000,
      healthCheckEnabled: true,
      healthCheckEndpoint: "/health",
      healthCheckIntervalSeconds: 300,
      healthCheckTimeoutMs: 5000,
      connectionPoolSize: 10,
      connectionPoolTimeoutMs: 30000,
      webhookUrl: "",
      webhookSecret: "",
      webhookEvents: [],
      requestFormat: "json",
      responseFormat: "json",
      customHeaders: {},
      tags: [],
      metadata: {},
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const updateField = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="auth">Auth</TabsTrigger>
          <TabsTrigger value="limits">Limits</TabsTrigger>
          <TabsTrigger value="reliability">Reliability</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
        </TabsList>

        <TabsContent value="basic">
          <BasicInfoTab formData={formData} updateField={updateField} />
        </TabsContent>

        <TabsContent value="auth">
          <AuthTab formData={formData} updateField={updateField} />
        </TabsContent>

        <TabsContent value="limits">
          <LimitsTab formData={formData} updateField={updateField} />
        </TabsContent>

        <TabsContent value="reliability">
          <ReliabilityTab formData={formData} updateField={updateField} />
        </TabsContent>

        <TabsContent value="monitoring">
          <MonitoringTab formData={formData} updateField={updateField} />
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="submit" className="w-full sm:w-auto">
          {mode === "create" ? "Create Provider" : "Update Provider"}
        </Button>
      </div>
    </form>
  );
}
