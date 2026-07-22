import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useListUsers,
  useCreateUser,
  useLockUser,
  useUnlockUser,
  getListUsersQueryKey,
} from '@workspace/api-client-react';
import { Loader2, Plus, Lock, Unlock, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import type { UserCreateInput } from '@workspace/api-client-react';

export default function AdminUsers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const { data: users, isLoading } = useListUsers(undefined, {
    query: { queryKey: getListUsersQueryKey(undefined) },
  });

  const createUser = useCreateUser();
  const lockUser = useLockUser();
  const unlockUser = useUnlockUser();

  const [createDialog, setCreateDialog] = useState(false);
  const [formData, setFormData] = useState<UserCreateInput & { password: string }>({
    name: '',
    email: '',
    gsmNumber: '',
    role: 'CAMPAIGN_EXPERT',
    password: '',
  });

  const handleCreate = () => {
    createUser.mutate(
      { data: formData },
      {
        onSuccess: () => {
          toast({ title: 'Kullanıcı oluşturuldu', description: 'Yeni kullanıcı başarıyla eklendi' });
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey(undefined) });
          setCreateDialog(false);
          setFormData({
            name: '',
            email: '',
            gsmNumber: '',
            role: 'CAMPAIGN_EXPERT',
            password: '',
          });
        },
        onError: (err: any) => {
          const msg = err?.data?.error || 'Kullanıcı oluşturulamadı';
          toast({ title: 'Hata', description: msg, variant: 'destructive' });
        },
      }
    );
  };

  const handleLock = (userId: string) => {
    lockUser.mutate(
      { id: userId },
      {
        onSuccess: () => {
          toast({ title: 'User Locked', description: 'User account has been locked' });
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey(undefined) });
        },
        onError: () => {
          toast({ title: 'Error', description: 'Failed to lock user', variant: 'destructive' });
        },
      }
    );
  };

  const handleUnlock = (userId: string) => {
    unlockUser.mutate(
      { id: userId },
      {
        onSuccess: () => {
          toast({ title: 'User Unlocked', description: 'User account has been unlocked' });
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey(undefined) });
        },
        onError: () => {
          toast({ title: 'Error', description: 'Failed to unlock user', variant: 'destructive' });
        },
      }
    );
  };

  const filteredUsers = users?.data.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground mt-1">Manage user accounts and permissions</p>
        </div>
        <Button onClick={() => setCreateDialog(true)} className="gap-2" data-testid="button-create-user">
          <Plus className="h-4 w-4" />
          Create User
        </Button>
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-users"
          />
        </div>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-3">
          {filteredUsers && filteredUsers.length > 0 ? (
            filteredUsers.map((user) => (
              <Card key={user.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold">{user.name}</h3>
                      <Badge>{user.role}</Badge>
                      {user.isLocked && <Badge variant="destructive">Locked</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>Email: {user.email}</div>
                      <div>GSM: {user.gsmNumber}</div>
                      {user.expertise && <div>Expertise: {user.expertise}</div>}
                      {user.region && <div>Region: {user.region}</div>}
                      <div>Created: {new Date(user.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {user.isLocked ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUnlock(user.id)}
                        className="gap-2"
                        data-testid={`button-unlock-${user.id}`}
                      >
                        <Unlock className="h-4 w-4" />
                        Unlock
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleLock(user.id)}
                        className="gap-2"
                        data-testid={`button-lock-${user.id}`}
                      >
                        <Lock className="h-4 w-4" />
                        Lock
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">No users found</p>
            </Card>
          )}
        </div>
      )}

      {/* Create User Dialog */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>Add a new user to the system</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user-name">Name *</Label>
              <Input
                id="user-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Doe"
                data-testid="input-user-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-email">Email *</Label>
              <Input
                id="user-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@campaigncell.com"
                data-testid="input-user-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-gsm">GSM Number *</Label>
              <Input
                id="user-gsm"
                value={formData.gsmNumber}
                onChange={(e) => setFormData({ ...formData, gsmNumber: e.target.value })}
                placeholder="+905551234567"
                data-testid="input-user-gsm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-role">Rol *</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value as any })}
              >
                <SelectTrigger id="user-role" data-testid="select-user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CAMPAIGN_EXPERT">Kampanya Uzmanı</SelectItem>
                  <SelectItem value="SUPERVISOR">Admin</SelectItem>
                  <SelectItem value="ADMIN">Sistem Yöneticisi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-password">Şifre *</Label>
              <Input
                id="user-password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
                data-testid="input-user-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createUser.isPending || !formData.name || !formData.email || !formData.gsmNumber || !formData.password}
              data-testid="button-submit-create-user"
            >
              {createUser.isPending ? 'Creating...' : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
