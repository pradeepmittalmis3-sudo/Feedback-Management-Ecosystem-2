import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { UserPlus, Shield, UserX, Mail, UserCheck, Activity, Users, BarChart3, Clock, Loader2, Search, CheckSquare, Square } from 'lucide-react';
import { STORE_LOCATIONS, UserRole } from '@/types/feedback';
import { toast } from 'sonner';

type StoreAccessLevel = 'viewer' | 'editor';

interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole | null;
  department: string;
  active: boolean;
  status: 'Approved' | 'Pending' | 'Rejected';
  permissions: {
    reports: boolean;
    analytics: boolean;
  };
  storeAccess: StoreAccessLevel;
  allowedStores: string[];
}

const STORE_KEY_MAP = new Map(STORE_LOCATIONS.map(store => [store.trim().toLowerCase(), store]));
const STORE_ACCESS_KEYS = ['store_access', 'Store Access', 'store_permission', 'Store Permission', 'access_level', 'Access Level'];
const ALLOWED_STORE_KEYS = ['allowed_stores', 'Allowed Stores', 'store_scope', 'Store Scope', 'stores', 'Stores'];

const normalizeStoreName = (value: unknown) => {
  const cleaned = String(value || '').trim();
  if (!cleaned) return '';
  return STORE_KEY_MAP.get(cleaned.toLowerCase()) || cleaned;
};

const parseStoreAccess = (value: unknown, role: UserRole | null): StoreAccessLevel => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'viewer') return 'viewer';
  if (normalized === 'editor') return 'editor';
  return role === 'viewer' ? 'viewer' : 'editor';
};

const parseAllowedStores = (value: unknown) => {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map(normalizeStoreName)
          .filter(Boolean)
      )
    );
  }

  const raw = String(value || '').trim();
  if (!raw) return [];
  if (raw.toLowerCase() === 'all') return [...STORE_LOCATIONS];

  if (raw.startsWith('[') && raw.endsWith(']')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return Array.from(
          new Set(
            parsed
              .map(normalizeStoreName)
              .filter(Boolean)
          )
        );
      }
    } catch {
      // fallback to comma split
    }
  }

  return Array.from(
    new Set(
      raw
        .split(',')
        .map(token => normalizeStoreName(token))
        .filter(Boolean)
    )
  );
};

const serializeAllowedStores = (stores: string[]) => {
  if (!stores.length) return '';
  const normalized = Array.from(new Set(stores.map(normalizeStoreName).filter(Boolean)));
  if (normalized.length === STORE_LOCATIONS.length) return 'ALL';
  return normalized.join(', ');
};

function StoreScopePicker({
  stores,
  disabled,
  onSave,
}: {
  stores: string[];
  disabled?: boolean;
  onSave: (stores: string[]) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [draftStores, setDraftStores] = useState<string[]>(stores);
  const [saving, setSaving] = useState(false);

  const normalizedDraft = useMemo(
    () => new Set(draftStores.map(store => normalizeStoreName(store).toLowerCase()).filter(Boolean)),
    [draftStores]
  );
  const orderedDraft = useMemo(
    () => STORE_LOCATIONS.filter(store => normalizedDraft.has(store.toLowerCase())),
    [normalizedDraft]
  );
  const allSelected = orderedDraft.length === STORE_LOCATIONS.length;
  const filteredStores = useMemo(
    () => STORE_LOCATIONS.filter(store => store.toLowerCase().includes(search.trim().toLowerCase())),
    [search]
  );

  useEffect(() => {
    if (open) {
      setDraftStores(stores);
      setSearch('');
    }
  }, [open, stores]);

  const toggleStore = (store: string) => {
    const key = store.toLowerCase();
    setDraftStores(prev => {
      const next = new Set(prev.map(item => normalizeStoreName(item).toLowerCase()).filter(Boolean));
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return STORE_LOCATIONS.filter(item => next.has(item.toLowerCase()));
    });
  };

  const toggleAll = () => {
    setDraftStores(allSelected ? [] : [...STORE_LOCATIONS]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(orderedDraft);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const label =
    stores.length === STORE_LOCATIONS.length
      ? 'All Stores'
      : stores.length === 0
      ? 'No Store'
      : stores.length === 1
      ? stores[0]
      : `${stores.length} Stores`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="h-8 max-w-[180px] justify-between gap-2 text-xs font-semibold"
        >
          <span className="truncate">{label}</span>
          {allSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5 opacity-60" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[330px] p-3 space-y-3">
        <div className="space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Search stores</p>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Type to filter stores"
              className="h-9 pl-8 text-sm"
            />
          </div>
        </div>

        <div className="rounded-md border border-border/50 overflow-hidden">
          <div className="px-3 py-2 bg-muted/30 border-b border-border/50">
            <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
              <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              Select All
            </label>
          </div>
          <div className="max-h-52 overflow-auto">
            {filteredStores.map(store => {
              const checked = normalizedDraft.has(store.toLowerCase());
              return (
                <label key={store} className="flex items-center gap-2 px-3 py-2.5 text-sm border-b border-border/40 last:border-b-0 cursor-pointer hover:bg-muted/20">
                  <Checkbox checked={checked} onCheckedChange={() => toggleStore(store)} />
                  {store}
                </label>
              );
            })}
            {filteredStores.length === 0 && (
              <div className="px-3 py-6 text-xs text-muted-foreground text-center">No stores found</div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground font-medium">{orderedDraft.length} selected</p>
          <Button size="sm" className="h-8 text-xs font-bold" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function PermissionsPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'pending'>('users');
  // Initialize from LocalStorage for 0ms loading feel
  const [users, setUsers] = useState<AppUser[]>(() => {
    const saved = localStorage.getItem('rajmandir_user_master');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((user: any) => ({
        ...user,
        role: user?.role ?? null,
        permissions: {
          reports: Boolean(user?.permissions?.reports),
          analytics: Boolean(user?.permissions?.analytics),
        },
        storeAccess: parseStoreAccess(user?.storeAccess ?? user?.store_access, user?.role ?? null),
        allowedStores: parseAllowedStores(user?.allowedStores ?? user?.allowed_stores),
      }));
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(true);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'user' as UserRole, department: '' });

  const sheetUrl = import.meta.env.VITE_GOOGLE_SHEET_API_URL;
  const pickFirst = (row: Record<string, unknown>, keys: string[]) => {
    for (const key of keys) {
      const value = row[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') return value;
    }
    return '';
  };
  const parseRole = (value: unknown): UserRole | null => {
    const normalized = String(value || '').trim().toLowerCase();
    return ['superadmin', 'admin', 'user', 'viewer'].includes(normalized) ? (normalized as UserRole) : null;
  };
  const parseStatus = (value: unknown): 'Approved' | 'Pending' | 'Rejected' => {
    const normalized = String(value || 'Pending').trim().toLowerCase();
    if (normalized === 'approved') return 'Approved';
    if (normalized === 'rejected') return 'Rejected';
    return 'Pending';
  };
  const parsePermissions = (value: unknown): { reports: boolean; analytics: boolean } => {
    const fallback = { reports: false, analytics: false };
    if (typeof value === 'object' && value !== null) {
      return {
        reports: Boolean((value as any).reports),
        analytics: Boolean((value as any).analytics),
      };
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return fallback;
      try {
        const parsed = JSON.parse(trimmed);
        return {
          reports: Boolean(parsed?.reports),
          analytics: Boolean(parsed?.analytics),
        };
      } catch {
        return fallback;
      }
    }
    return fallback;
  };

  const fetchUsers = async () => {
    if (!sheetUrl) return;
    try {
      setLoading(true);
      const requestUsers = async (url: string) => {
        const res = await fetch(url);
        if (!res.ok) return [];
        const data = await res.json();
        if (!data?.success || !Array.isArray(data?.data)) return [];
        return data.data as any[];
      };

      let rows = await requestUsers(`${sheetUrl}?action=GET_USERS`);
      if (!rows.length) rows = await requestUsers(sheetUrl);

      const mappedUsers = rows.map((u: any) => ({
        id: String(pickFirst(u, ['id', 'Id', 'ID', '_id'])).trim(),
        name: String(pickFirst(u, ['name', 'Name', 'full_name', 'Full Name', 'fullName'])).trim(),
        email: String(pickFirst(u, ['email', 'Email', 'email_id', 'Email ID', 'EmailId', 'mail', 'Mail'])).trim(),
        department: String(pickFirst(u, ['department', 'Department', 'dept', 'Dept']) || 'Staff').trim(),
        role: parseRole(pickFirst(u, ['role', 'Role', 'user_role', 'User Role'])),
        active: u.active === true || u.Active === true || String(u.active || '').toUpperCase() === 'TRUE',
        status: parseStatus(pickFirst(u, ['status', 'Status', 'user_status', 'User Status'])),
        permissions: parsePermissions(u.permissions ?? u.Permissions),
        storeAccess: parseStoreAccess(
          pickFirst(u, STORE_ACCESS_KEYS),
          parseRole(pickFirst(u, ['role', 'Role', 'user_role', 'User Role']))
        ),
        allowedStores: parseAllowedStores(pickFirst(u, ALLOWED_STORE_KEYS))
      }));

      setUsers(mappedUsers);
      localStorage.setItem('rajmandir_user_master', JSON.stringify(mappedUsers));
    } catch (err) {
      console.error(err);
      toast.error("Unable to fetch users from User Master");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Filter real user accounts (ignore feedback data rows)
  const allUsers = users.filter((u: any) => {
    // A real user MUST have an email and SHOULD NOT have customer feedback fields
    const hasEmail = u.email && u.email.includes('@');
    const isFeedback = u.mobile || u.feedback || u.mobile_number || u.your_feedback;
    return hasEmail && !isFeedback;
  });
  
  const pendingUsers = allUsers.filter(u => u.status?.toLowerCase() === 'pending' || !u.role);
  const confirmedUsers = allUsers.filter(u => u.status?.toLowerCase() === 'approved' && !!u.role);

  const updateSheetUser = async (user: AppUser, updates: Partial<AppUser>) => {
    if (!sheetUrl) return;
    try {
      const payload: Record<string, unknown> = {
        action: 'UPDATE_USER',
        id: user.id,
      };

      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.email !== undefined) payload.email = updates.email;
      if (updates.role !== undefined) payload.role = updates.role;
      if (updates.department !== undefined) payload.department = updates.department;
      if (updates.active !== undefined) payload.active = updates.active;
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.permissions !== undefined) payload.permissions = updates.permissions;
      if (updates.storeAccess !== undefined) payload.store_access = updates.storeAccess;
      if (updates.allowedStores !== undefined) payload.allowed_stores = serializeAllowedStores(updates.allowedStores);

      const res = await fetch(sheetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        fetchUsers(); // Refresh list
        return true;
      }
      toast.error(data?.error || "Database update failed");
    } catch (err) {
      toast.error("Database update failed");
    }
    return false;
  };

  const approveUser = async (user: AppUser, initialRole: UserRole) => {
    const success = await updateSheetUser(user, {
      status: 'Approved',
      role: initialRole,
      active: true,
      storeAccess: initialRole === 'viewer' ? 'viewer' : 'editor',
      allowedStores: [...STORE_LOCATIONS],
    });
    if (success) toast.success(`${user.name} approved as ${initialRole}`);
  };

  const rejectUser = async (user: AppUser) => {
    const success = await updateSheetUser(user, { status: 'Rejected' });
    if (success) toast.error("User request rejected");
  };

  const addUser = async () => {
    if (!newUser.name || !newUser.email) {
      toast.error("Name and Email required");
      return;
    }
    if (!sheetUrl) return;
    try {
      const res = await fetch(sheetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ 
          action: 'ADD_USER', 
          ...newUser, 
          status: 'Approved', 
          active: true,
          permissions: { reports: false, analytics: false },
          store_access: newUser.role === 'viewer' ? 'viewer' : 'editor',
          allowed_stores: 'ALL',
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchUsers();
        setNewUser({ name: '', email: '', role: 'user', department: '' });
        toast.success("User onboarded successfully");
      } else {
        toast.error(data?.error || "Onboarding failed");
      }
    } catch (err) {
      toast.error("Onboarding failed");
    }
  };

  const toggleUser = async (user: AppUser) => {
    const success = await updateSheetUser(user, { active: !user.active });
    if (success) toast.info("User status updated");
  };

  const togglePermission = async (user: AppUser, key: 'reports' | 'analytics') => {
    const success = await updateSheetUser(user, { 
      permissions: { ...user.permissions, [key]: !user.permissions[key] } 
    });
    if (success) toast.success("Permission updated live");
  };

  const updateStoreScope = async (user: AppUser, nextStores: string[]) => {
    const success = await updateSheetUser(user, { allowedStores: nextStores });
    if (success) toast.success("Store scope updated");
  };

  const updateStoreAccess = async (user: AppUser, nextAccess: StoreAccessLevel) => {
    const success = await updateSheetUser(user, { storeAccess: nextAccess });
    if (success) toast.success(`Store access set to ${nextAccess}`);
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600 shadow-inner">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-3xl font-display font-bold text-foreground tracking-tight">Permission Control</h2>
            <p className="text-sm text-muted-foreground font-medium flex items-center gap-2">
              {loading ? <Loader2 className="w-3 h-3 animate-spin text-primary" /> : <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />}
              {loading ? 'Syncing...' : 'Live System Connected'}
            </p>
          </div>
        </div>
        <div className="flex bg-muted/50 p-1.5 rounded-2xl border border-border/40 shadow-inner">
          <Button 
            variant={activeTab === 'users' ? 'secondary' : 'ghost'} 
            className={`h-10 rounded-xl px-5 font-bold text-sm transition-all ${activeTab === 'users' ? 'shadow-md shadow-black/5' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            Confirmed Users
          </Button>
          <Button 
            variant={activeTab === 'pending' ? 'secondary' : 'ghost'} 
            className={`h-10 rounded-xl px-5 font-bold text-sm relative transition-all ${activeTab === 'pending' ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-md shadow-amber-500/20' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            Pending Approval
            {pendingUsers.length > 0 && (
              <span className="absolute -top-2.5 -right-2.5 min-w-[22px] h-5.5 px-1.5 bg-red-600 text-[11px] font-black text-white rounded-full flex items-center justify-center border-2 border-background shadow-xl ring-2 ring-red-500/20 animate-pulse">
                {pendingUsers.length}
              </span>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Add User */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-2xl shadow-primary/5 border-border/40 bg-card/50 backdrop-blur-sm sticky top-24">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-primary" /> Onboard Staff
              </CardTitle>
              <CardDescription className="text-xs">Direct bypass for internal staff</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Name</label>
                <Input placeholder="Full Name" className="bg-background/50 h-10" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Email</label>
                <Input placeholder="user@rajmandir.com" type="email" className="bg-background/50 h-10" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Role</label>
                <Select value={newUser.role} onValueChange={(v: UserRole) => setNewUser({...newUser, role: v})}>
                  <SelectTrigger className="bg-background/50 h-10">
                    <SelectValue placeholder="Select Role" />
                  </SelectTrigger>
                  <SelectContent className="z-[9999]">
                    <SelectItem value="superadmin">Super Admin</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="user">User (Tasks)</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full mt-4 h-11 font-bold shadow-lg shadow-primary/20" onClick={addUser}>Activate Now</Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: User Lists */}
        <div className="lg:col-span-3">
          {activeTab === 'users' ? (
            <Card className="shadow-2xl shadow-black/5 border-border/40 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 bg-muted/20">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Users className="w-5 h-5 text-muted-foreground" /> Confirmed Access
                  </CardTitle>
                  <CardDescription>Granting Reports & Analytics permission live</CardDescription>
                </div>
                <Badge variant="outline" className="bg-background font-mono px-3 py-1">{confirmedUsers.length} Records</Badge>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[980px]">
                    <thead>
                      <tr className="bg-muted/30 border-b border-border/40">
                        <th className="py-4 px-6 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Employee Details</th>
                        <th className="py-4 px-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">System Role</th>
                        <th className="py-4 px-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Store Scope</th>
                        <th className="py-4 px-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Store Access</th>
                        <th className="py-4 px-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest text-center">Reports</th>
                        <th className="py-4 px-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest text-center">Analytics</th>
                        <th className="py-4 px-6 text-[11px] font-bold text-muted-foreground uppercase tracking-widest text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {(loading && users.length === 0) ? (
                        <tr>
                          <td colSpan={7} className="py-20 text-center">
                             <Loader2 className="w-8 h-8 animate-spin text-primary/30 mx-auto mb-3" />
                             <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-50">Direct Fast Loading...</p>
                          </td>
                        </tr>
                      ) : confirmedUsers.map((u) => (
                        <tr key={u.id} className="group hover:bg-primary/[0.02]">
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-4">
                              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-lg shadow-sm border ${u.role === 'superadmin' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-primary/5 text-primary border-primary/20'}`}>
                                {u.name.charAt(0)}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-foreground text-sm tracking-tight">{u.name}</span>
                                </div>
                                <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1 font-medium italic">
                                  <Mail className="w-3 h-3 opacity-60"/> {u.email}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <Badge variant="outline" className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border-2 tracking-wide uppercase ${u.role === 'superadmin' ? 'border-amber-500/20 text-amber-600' : 'border-primary/20 text-primary'}`}>
                              {u.role || 'unassigned'}
                            </Badge>
                          </td>
                          <td className="py-4 px-4">
                            <StoreScopePicker
                              stores={u.allowedStores}
                              disabled={u.role === 'superadmin'}
                              onSave={(stores) => updateStoreScope(u, stores)}
                            />
                          </td>
                          <td className="py-4 px-4">
                            {u.role === 'superadmin' ? (
                              <Badge variant="outline" className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border-2 border-amber-500/20 text-amber-600 uppercase">
                                editor
                              </Badge>
                            ) : (
                              <Select value={u.storeAccess} onValueChange={(value: StoreAccessLevel) => updateStoreAccess(u, value)}>
                                <SelectTrigger className="h-8 w-[110px] text-xs font-semibold bg-background/50">
                                  <SelectValue placeholder="Access" />
                                </SelectTrigger>
                                <SelectContent className="z-[9999]">
                                  <SelectItem value="viewer">Viewer</SelectItem>
                                  <SelectItem value="editor">Editor</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </td>
                          <td className="py-4 px-4 text-center">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className={`h-8 w-8 rounded-full ${u.permissions?.reports ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'text-muted-foreground hover:bg-muted'}`}
                              onClick={() => togglePermission(u, 'reports')}
                              disabled={u.role === 'superadmin'}
                            >
                              <Activity className={`w-4 h-4 ${u.permissions?.reports ? 'opacity-100' : 'opacity-30'}`} />
                            </Button>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className={`h-8 w-8 rounded-full ${u.permissions?.analytics ? 'bg-accent/10 text-accent hover:bg-accent/20' : 'text-muted-foreground hover:bg-muted'}`}
                              onClick={() => togglePermission(u, 'analytics')}
                              disabled={u.role === 'superadmin'}
                            >
                              <BarChart3 className={`w-4 h-4 ${u.permissions?.analytics ? 'opacity-100' : 'opacity-30'}`} />
                            </Button>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-2 isolate">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className={`h-9 w-9 rounded-xl transition-all ${u.active ? 'text-destructive hover:bg-destructive/10' : 'text-success hover:bg-success/10'}`}
                                onClick={() => toggleUser(u)}
                                disabled={u.role === 'superadmin'}
                              >
                                {u.active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4 shadow-success/10" />}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!loading && confirmedUsers.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-20 text-center text-muted-foreground italic font-medium">No confirmed users found in database.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-2xl shadow-black/5 border-border/40 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 bg-amber-500/5">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-600" /> Pending Signups
                  </CardTitle>
                  <CardDescription>Grant role access to allow login</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="bg-muted/30 border-b border-border/40">
                        <th className="py-4 px-6 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Name / Email</th>
                        <th className="py-4 px-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest text-center">Assign Role & Approve</th>
                        <th className="py-4 px-6 text-[11px] font-bold text-muted-foreground uppercase tracking-widest text-right">Reject</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {loading && users.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-20 text-center">
                             <Loader2 className="w-8 h-8 animate-spin text-amber-600/30 mx-auto mb-3" />
                             <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-50">Checking for new requests...</p>
                          </td>
                        </tr>
                      ) : pendingUsers.map((u) => (
                        <tr key={u.id} className="group hover:bg-amber-500/[0.02]">
                          <td className="py-6 px-6">
                            <div className="font-bold text-sm text-foreground">{u.name}</div>
                            <div className="text-xs text-muted-foreground font-mono">{u.email}</div>
                            <Badge variant="secondary" className="mt-2 text-[10px] bg-muted/50">{u.department}</Badge>
                          </td>
                          <td className="py-6 px-4">
                            <div className="flex items-center justify-center gap-2">
                              <Button size="sm" variant="outline" className="h-8 text-[10px] font-bold border-primary/30 hover:bg-primary/10" onClick={() => approveUser(u, 'user')}>Assign User Role</Button>
                              <Button size="sm" variant="outline" className="h-8 text-[10px] font-bold border-primary/30 hover:bg-primary/10" onClick={() => approveUser(u, 'admin')}>Assign Admin</Button>
                              <Button size="sm" variant="outline" className="h-8 text-[10px] font-bold border-primary/30 hover:bg-primary/10" onClick={() => approveUser(u, 'viewer')}>Assign Viewer</Button>
                            </div>
                          </td>
                          <td className="py-6 px-6 text-right">
                             <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => rejectUser(u)}>
                               <UserX className="w-5 h-5" />
                             </Button>
                          </td>
                        </tr>
                      ))}
                      {!loading && pendingUsers.length === 0 && (
                        <tr>
                          <td colSpan={3} className="py-20 text-center text-muted-foreground italic font-medium">No pending signup requests at this time.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

    </div>
  );
}
