"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Users & Roles</h1>
        <p className="mt-1 text-muted-foreground">Manage admin users and permissions</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Admin Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="font-medium">admin@alphaflow.com</p>
                <p className="text-xs text-muted-foreground">Super Admin</p>
              </div>
              <Badge variant="outline" className="bg-success/10 text-success">Active</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
