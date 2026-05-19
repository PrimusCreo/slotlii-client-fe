import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Mail,
  Phone,
  Plus,
  Search,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import Layout from '../components/Layout/Layout';
import { useClinic } from '../context/ClinicContext';
import * as api from '../api';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const initialForm = {
  name: '',
  phone: '',
  email: '',
  dateOfBirth: '',
  gender: '',
  address: '',
};

export default function Patients() {
  const { selectedClinicId } = useClinic();
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    if (selectedClinicId) loadPatients();
  }, [selectedClinicId, search]);

  // Debounce the search input so we don't fire a request on every keystroke.
  useEffect(() => {
    if (searchInput === search) return;
    const timeoutId = setTimeout(() => {
      setSearch(searchInput);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchInput, search]);

  async function loadPatients() {
    setLoading(true);
    try {
      const params = { clinicId: selectedClinicId, grouped: true, limit: 500 };
      if (search) params.search = search;
      const res = await api.getPatients(params);
      const payload = res.data.data;
      const groups = payload?.groups ?? [];
      const rows = [];
      for (const g of groups) {
        for (const p of g.patients || []) {
          rows.push({ ...p, _samePhoneCount: (g.patients || []).length });
        }
      }
      setPatients(rows);
      setPage(1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const total = patients.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.min(page, pages);
  const startIdx = (currentPage - 1) * limit;
  const displayedPatients = patients.slice(startIdx, startIdx + limit);

  async function handleCreatePatient(e) {
    e.preventDefault();
    try {
      await api.createPatient({ ...form, clinicId: selectedClinicId });
      toast.success('Patient created');
      setShowModal(false);
      setForm(initialForm);
      loadPatients();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create patient');
    }
  }

  return (
    <Layout title="Patients">
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative w-full sm:w-[320px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by name or phone"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-9 pl-9 pr-9"
            />
            {searchInput ? (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
          <span className="ml-auto text-sm text-muted-foreground">
            <Button onClick={() => setShowModal(true)}>
              <Plus /> Add patient
            </Button>
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : patients.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Users className="size-5" />
              </div>
              <p className="text-sm font-medium">No patients found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>History</TableHead>
                  <TableHead className="text-right">Registered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedPatients.map((p) => (
                  <TableRow
                    key={p._id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/patients/${p._id}`)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <Avatar className="size-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-[11px] font-semibold">
                            {p.name?.charAt(0)?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span>{p.name}</span>
                        {p._samePhoneCount > 1 ? (
                          <Badge variant="info" className="font-normal">
                            Same line ({p._samePhoneCount})
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5 tabular-nums">
                        <Phone className="size-3.5" /> {p.phone}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.email ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Mail className="size-3.5" /> {p.email}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">
                      {p.gender || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="info" className="font-normal">
                        {p.medicalHistory?.length || 0} records
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {!loading ? (
          <div className="flex flex-wrap items-center justify-between gap-4 border-t px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              {displayedPatients.length} of {total} row(s).
            </span>
            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
              <div className="flex items-center gap-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  Rows per page
                </Label>
                <Select
                  value={String(limit)}
                  onValueChange={(v) => {
                    setLimit(Number(v));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 15, 20, 30, 50].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <span className="text-sm font-medium tabular-nums">
                Page {currentPage} of {pages}
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(1)}
                  aria-label="First page"
                >
                  <ChevronsLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={currentPage >= pages}
                  onClick={() => setPage(currentPage + 1)}
                  aria-label="Next page"
                >
                  <ChevronRight className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={currentPage >= pages}
                  onClick={() => setPage(pages)}
                  aria-label="Last page"
                >
                  <ChevronsRight className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Add new patient</DialogTitle>
            <DialogDescription>
              Create a new patient record. You can edit details later.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreatePatient} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="p-name">Full name *</Label>
                <Input
                  id="p-name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-phone">Phone *</Label>
                <Input
                  id="p-phone"
                  required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="919876543210"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-email">Email</Label>
                <Input
                  id="p-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="john@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-dob">Date of birth</Label>
                <Input
                  id="p-dob"
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-gender">Gender</Label>
                <Select
                  value={form.gender || undefined}
                  onValueChange={(v) => setForm({ ...form, gender: v })}
                >
                  <SelectTrigger id="p-gender">
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-address">Address</Label>
                <Input
                  id="p-address"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="City, Country"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button type="submit">Add patient</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
