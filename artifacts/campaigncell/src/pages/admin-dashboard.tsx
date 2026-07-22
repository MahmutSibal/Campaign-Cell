import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { Users, Shield, FileText, Settings } from 'lucide-react';

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Panel</h1>
        <p className="text-muted-foreground mt-1">System administration and management</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Link href="/admin/users">
          <Card className="p-8 hover:bg-muted/50 transition-colors cursor-pointer">
            <Users className="h-12 w-12 text-primary mb-4" />
            <h3 className="text-xl font-semibold mb-2">User Management</h3>
            <p className="text-sm text-muted-foreground">
              Create, edit, and manage user accounts and roles
            </p>
          </Card>
        </Link>

        <Link href="/admin/audit">
          <Card className="p-8 hover:bg-muted/50 transition-colors cursor-pointer">
            <FileText className="h-12 w-12 text-primary mb-4" />
            <h3 className="text-xl font-semibold mb-2">Audit Log</h3>
            <p className="text-sm text-muted-foreground">
              View system audit logs and user activity
            </p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
