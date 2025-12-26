"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  runConnectivityTest,
  quickConnectivityCheck,
  logApiConfiguration,
  type ConnectivityReport,
} from '@/lib/api/connectivity-test';

export function ApiDebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState<ConnectivityReport | null>(null);

  const handleQuickCheck = async () => {
    setIsRunning(true);
    try {
      const result = await quickConnectivityCheck();
      alert(result ? 'Connection successful!' : 'Connection failed!');
    } finally {
      setIsRunning(false);
    }
  };

  const handleFullTest = async () => {
    setIsRunning(true);
    try {
      const result = await runConnectivityTest();
      setReport(result);
    } finally {
      setIsRunning(false);
    }
  };

  const handleLogConfig = () => {
    logApiConfiguration();
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(true)}
          className="shadow-lg"
        >
          API Debug
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96">
      <Card className="shadow-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">API Debug Panel</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
            >
              ✕
            </Button>
          </div>
          <CardDescription>
            Test and debug API connectivity
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            onClick={handleLogConfig}
            variant="outline"
            className="w-full"
            disabled={isRunning}
          >
            Log Configuration
          </Button>

          <Button
            onClick={handleQuickCheck}
            variant="outline"
            className="w-full"
            disabled={isRunning}
          >
            {isRunning ? 'Testing...' : 'Quick Connection Check'}
          </Button>

          <Button
            onClick={handleFullTest}
            variant="default"
            className="w-full"
            disabled={isRunning}
          >
            {isRunning ? 'Running Tests...' : 'Run Full Test Suite'}
          </Button>

          {report && (
            <div className="mt-4 p-3 bg-muted rounded-md text-sm space-y-2">
              <div className="font-semibold">Test Results:</div>
              <div className="space-y-1">
                <div>Total: {report.summary.total}</div>
                <div className="text-green-600">Passed: {report.summary.passed}</div>
                <div className="text-red-600">Failed: {report.summary.failed}</div>
                <div>Pass Rate: {report.summary.passRate.toFixed(1)}%</div>
              </div>
              <div className="text-xs text-muted-foreground pt-2">
                Check browser console for detailed results
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
