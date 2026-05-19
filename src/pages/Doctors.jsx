import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail,
  Phone,
  Plus,
  Search,
  Stethoscope,
  Trash2,
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
import { Checkbox } from '@/components/ui/checkbox';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

const emptyForm = {
  name: '',
  specialization: '',
  email: '',
  phone: '',
  notes: '',
  isActive: true,
};

export default function Doctors() {
  const navigate = useNavigate();
  const { selectedClinicId } = useClinic();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (selectedClinicId) loadDoctors();
  }, [selectedClinicId, search]);

  // Debounce the search input so we don't fire a request on every keystroke.
  useEffect(() => {
    if (searchInput === search) return;
    const timeoutId = setTimeout(() => {
      setSearch(searchInput);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchInput, search]);

  async function loadDoctors() {
    setLoading(true);
    try {
      const params = { clinicId: selectedClinicId, limit: 100, page: 1 };
      if (search) params.search = search;
      const res = await api.getDoctors(params);
      setDoctors(res.data.data || []);
      setPagination(res.data.pagination || { total: 0, pages: 1 });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setForm(emptyForm);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setForm(emptyForm);
  }

  async function handleCreate(e) {
    e.preventDefault();
    try {
      const res = await api.createDoctor({ ...form, clinicId: selectedClinicId });
      toast.success('Doctor added');
      closeModal();
      const created = res.data.data;
      if (created?._id) {
        navigate(`/doctors/${created._id}`);
      } else {
        loadDoctors();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Request failed');
    }
  }

  async function handleDelete(doc, e) {
    e.stopPropagation();
    if (!window.confirm(`Remove ${doc.name} from this clinic? This cannot be undone.`))
      return;
    try {
      await api.deleteDoctor(doc._id);
      toast.success('Doctor removed');
      loadDoctors();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  }

  return (
    <Layout title="Doctors">
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative w-full sm:w-[320px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by name, specialty, email, phone"
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
            <Button onClick={openAddModal} disabled={!selectedClinicId}>
              <Plus /> Add doctor
            </Button>
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : doctors.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Stethoscope className="size-5" />
              </div>
              <p className="text-sm font-medium">No doctors yet</p>
              <Button size="sm" onClick={openAddModal}>
                Add your first doctor
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Specialization</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {doctors.map((d) => (
                  <TableRow
                    key={d._id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/doctors/${d._id}`)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-[11px] font-semibold">
                            {d.name?.charAt(0)?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span>{d.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {d.specialization || '—'}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5 text-xs text-muted-foreground">
                        {d.phone ? (
                          <div className="inline-flex items-center gap-1.5 tabular-nums">
                            <Phone className="size-3" /> {d.phone}
                          </div>
                        ) : null}
                        {d.email ? (
                          <div className="inline-flex items-center gap-1.5">
                            <Mail className="size-3" /> {d.email}
                          </div>
                        ) : null}
                        {!d.phone && !d.email ? '—' : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {d.isActive ? (
                        <Badge variant="success" className="font-normal">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="danger" className="font-normal">
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={(e) => handleDelete(d, e)}
                        aria-label={`Delete ${d.name}`}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={(o) => (o ? setShowModal(true) : closeModal())}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Add doctor</DialogTitle>
            <DialogDescription>
              Add a new clinician to this clinic. You can configure their availability after.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="d-name">Full name *</Label>
                <Input
                  id="d-name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Dr. Jane Smith"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-spec">Specialization</Label>
                <Input
                  id="d-spec"
                  value={form.specialization}
                  onChange={(e) =>
                    setForm({ ...form, specialization: e.target.value })
                  }
                  placeholder="e.g. Orthodontics"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-phone">Phone</Label>
                <Input
                  id="d-phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="Clinic or direct line"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-email">Email</Label>
                <Input
                  id="d-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="doctor@example.com"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-notes">Notes</Label>
              <Textarea
                id="d-notes"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Optional internal notes"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="d-active"
                checked={form.isActive}
                onCheckedChange={(v) => setForm({ ...form, isActive: !!v })}
              />
              <Label htmlFor="d-active" className="cursor-pointer">
                Active (shown as available)
              </Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit">Add doctor</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
