import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Users,
  Truck,
  Building2,
  Edit2,
  Trash2,
  Eye,
  Phone,
  Mail,
  MapPin,
  X,
} from 'lucide-react';
import { partiesApi } from '../services/api';
import type { Party, PartyCreate, PartyUpdate, PartyType } from '../types';
import { Button } from '../components/ui/Button';
import { Table, Pagination } from '../components/ui/Table';
import { Modal } from '../components/ui/Modal';
import { Input, Textarea, Select } from '../components/ui/Input';
import { useAppStore } from '../store/appStore';

const PARTY_TYPES = [
  { value: 'supplier', label: 'Supplier' },
  { value: 'customer', label: 'Customer' },
  { value: 'both', label: 'Both' },
];

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh',
].map((s) => ({ value: s, label: s }));

export function Parties() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { addNotification } = useAppStore();

  // List state
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>(searchParams.get('type') || '');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Detail view state
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  // Delete confirmation
  const [deleteParty, setDeleteParty] = useState<Party | null>(null);

  // Form state
  const [form, setForm] = useState<PartyCreate>({
    party_name: '',
    party_type: 'customer',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
    gstin: '',
    pan: '',
    payment_terms: '',
    credit_limit: undefined,
    credit_days: undefined,
  });

  // Load parties
  const loadParties = useCallback(async () => {
    setLoading(true);
    try {
      const result = await partiesApi.list({
        page,
        limit: 20,
        search: search || undefined,
        party_type: typeFilter || undefined,
        sort_by: 'created_at',
        sort_order: 'desc',
      });
      setParties(result.parties);
      setTotalPages(result.total_pages);
      setTotalItems(result.total);
    } catch (error) {
      addNotification('error', 'Failed to load parties');
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter, addNotification]);

  useEffect(() => {
    loadParties();
  }, [loadParties]);

  useEffect(() => {
    const action = searchParams.get('action');
    const type = searchParams.get('type');
    
    if (type) {
      setTypeFilter(type);
    }
    
    if (action === 'new') {
      if (type) {
        setForm((f) => ({ ...f, party_type: type as PartyType }));
      }
      setShowModal(true);
      setSearchParams({});
    }
  }, []);

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);

    try {
      if (editingParty) {
        await partiesApi.update(editingParty.id, form as PartyUpdate);
        addNotification('success', 'Party updated successfully');
      } else {
        await partiesApi.create(form);
        addNotification('success', 'Party created successfully');
      }
      setShowModal(false);
      resetForm();
      loadParties();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save party';
      addNotification('error', errorMessage);
    } finally {
      setFormLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!deleteParty) return;

    try {
      await partiesApi.delete(deleteParty.id);
      addNotification('success', 'Party deleted successfully');
      setDeleteParty(null);
      loadParties();
    } catch (error) {
      addNotification('error', 'Failed to delete party');
    }
  };

  // Reset form
  const resetForm = () => {
    setForm({
      party_name: '',
      party_type: 'customer',
      contact_person: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      country: 'India',
      gstin: '',
      pan: '',
      payment_terms: '',
      credit_limit: undefined,
      credit_days: undefined,
    });
    setEditingParty(null);
  };

  // Open edit modal
  const openEdit = (party: Party) => {
    setEditingParty(party);
    setForm({
      party_name: party.party_name,
      party_type: party.party_type,
      contact_person: party.contact_person || '',
      email: party.email || '',
      phone: party.phone || '',
      address: party.address || '',
      city: party.city || '',
      state: party.state || '',
      pincode: party.pincode || '',
      country: party.country || 'India',
      gstin: party.gstin || '',
      pan: party.pan || '',
      payment_terms: party.payment_terms || '',
      credit_limit: party.credit_limit,
      credit_days: party.credit_days,
    });
    setShowModal(true);
  };

  // Get party icon
  const PartyIcon = ({ type }: { type: PartyType }) => {
    switch (type) {
      case 'supplier':
        return <Truck className="h-5 w-5" />;
      case 'customer':
        return <Users className="h-5 w-5" />;
      default:
        return <Building2 className="h-5 w-5" />;
    }
  };

  // Get party type color
  const getTypeColor = (type: PartyType) => {
    switch (type) {
      case 'supplier':
        return 'bg-amber-100 text-amber-700';
      case 'customer':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-purple-100 text-purple-700';
    }
  };

  // Table columns
  const columns = [
    {
      key: 'party_name',
      header: 'PARTY',
      render: (party: Party) => (
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${getTypeColor(party.party_type)}`}>
            <PartyIcon type={party.party_type} />
          </div>
          <div>
            <p className="font-medium text-slate-800">{party.party_name}</p>
            <p className="text-xs text-slate-500">{party.party_code}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'party_type',
      header: 'TYPE',
      render: (party: Party) => (
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${getTypeColor(party.party_type)}`}>
          {party.party_type}
        </span>
      ),
    },
    {
      key: 'contact',
      header: 'CONTACT',
      render: (party: Party) => (
        <div className="text-sm">
          <p className="text-slate-800">{party.contact_person || '-'}</p>
          <p className="text-xs text-slate-500">{party.phone || party.email || '-'}</p>
        </div>
      ),
    },
    {
      key: 'city',
      header: 'LOCATION',
      render: (party: Party) => (
        <span className="text-slate-600">
          {[party.city, party.state].filter(Boolean).join(', ') || '-'}
        </span>
      ),
    },
    {
      key: 'gstin',
      header: 'GSTIN',
      render: (party: Party) => (
        <span className="font-mono text-xs text-slate-600">{party.gstin || '-'}</span>
      ),
    },
    {
      key: 'is_active',
      header: 'STATUS',
      render: (party: Party) => (
        <span className={`badge ${party.is_active ? 'badge-success' : 'badge-danger'}`}>
          {party.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '100px',
      render: (party: Party) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setSelectedParty(party); setShowDetail(true); }}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); openEdit(party); }}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setDeleteParty(party); }}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <div className="flex items-center justify-end">
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowModal(true)}>
          Add Party
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <button
          onClick={() => setTypeFilter('')}
          className={`card p-4 text-left transition-all hover:shadow-md ${!typeFilter ? 'ring-2 ring-blue-500' : ''}`}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{totalItems}</p>
              <p className="text-sm text-slate-500">All Parties</p>
            </div>
          </div>
        </button>
        <button
          onClick={() => setTypeFilter('supplier')}
          className={`card p-4 text-left transition-all hover:shadow-md ${typeFilter === 'supplier' ? 'ring-2 ring-amber-500' : ''}`}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {parties.filter((p) => p.party_type === 'supplier' || p.party_type === 'both').length}
              </p>
              <p className="text-sm text-slate-500">Suppliers</p>
            </div>
          </div>
        </button>
        <button
          onClick={() => setTypeFilter('customer')}
          className={`card p-4 text-left transition-all hover:shadow-md ${typeFilter === 'customer' ? 'ring-2 ring-blue-500' : ''}`}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {parties.filter((p) => p.party_type === 'customer' || p.party_type === 'both').length}
              </p>
              <p className="text-sm text-slate-500">Customers</p>
            </div>
          </div>
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or code..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">All Types</option>
            {PARTY_TYPES.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <Table
          columns={columns}
          data={parties}
          loading={loading}
          keyExtractor={(party) => party.id}
          onRowClick={(party) => { setSelectedParty(party); setShowDetail(true); }}
          emptyMessage="No parties found. Add your first supplier or customer."
        />
        {totalPages > 0 && (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={20}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); resetForm(); }}
        title={editingParty ? 'Edit Party' : 'Add New Party'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setShowModal(false); resetForm(); }}>
              Cancel
            </Button>
            <Button loading={formLoading} onClick={handleSubmit}>
              {editingParty ? 'Update' : 'Create'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-slate-800 uppercase tracking-wider">Basic Information</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Party Name"
                value={form.party_name}
                onChange={(e) => setForm({ ...form, party_name: e.target.value })}
                placeholder="Enter company/person name"
                required
              />
              <Select
                label="Party Type"
                value={form.party_type}
                onChange={(e) => setForm({ ...form, party_type: e.target.value as PartyType })}
                options={PARTY_TYPES}
                required
              />
            </div>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-slate-800 uppercase tracking-wider">Contact Information</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Contact Person"
                value={form.contact_person}
                onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                placeholder="Contact name"
              />
              <Input
                label="Phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+91 98765 43210"
              />
              <Input
                label="Email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="email@example.com"
                className="sm:col-span-2"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-slate-800 uppercase tracking-wider">Address</h3>
            <div className="space-y-4">
              <Textarea
                label="Address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Street address"
              />
              <div className="grid gap-4 sm:grid-cols-3">
                <Input
                  label="City"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="City"
                />
                <Select
                  label="State"
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  options={INDIAN_STATES}
                  placeholder="Select state"
                />
                <Input
                  label="PIN Code"
                  value={form.pincode}
                  onChange={(e) => setForm({ ...form, pincode: e.target.value })}
                  placeholder="400001"
                />
              </div>
            </div>
          </div>

          {/* Tax Info */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-slate-800 uppercase tracking-wider">Tax Information</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="GSTIN"
                value={form.gstin}
                onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                placeholder="22AAAAA0000A1Z5"
              />
              <Input
                label="PAN"
                value={form.pan}
                onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })}
                placeholder="AAAAA0000A"
              />
            </div>
          </div>

          {/* Credit Info */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-slate-800 uppercase tracking-wider">Credit Terms</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                label="Payment Terms"
                value={form.payment_terms}
                onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}
                placeholder="Net 30"
              />
              <Input
                label="Credit Limit (₹)"
                type="number"
                value={form.credit_limit || ''}
                onChange={(e) => setForm({ ...form, credit_limit: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="100000"
              />
              <Input
                label="Credit Days"
                type="number"
                value={form.credit_days || ''}
                onChange={(e) => setForm({ ...form, credit_days: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="30"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Detail Slide-over */}
      {showDetail && selectedParty && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDetail(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-lg animate-slide-in bg-white shadow-2xl">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <h2 className="text-lg font-semibold text-slate-800">Party Details</h2>
                <button
                  onClick={() => setShowDetail(false)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <div className="mb-6 flex items-center gap-4">
                  <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${getTypeColor(selectedParty.party_type)}`}>
                    <PartyIcon type={selectedParty.party_type} />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-800">{selectedParty.party_name}</h3>
                    <p className="text-slate-500">{selectedParty.party_code}</p>
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${getTypeColor(selectedParty.party_type)}`}>
                      {selectedParty.party_type}
                    </span>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <h4 className="mb-3 text-sm font-semibold text-slate-500 uppercase">Contact</h4>
                    <div className="space-y-3">
                      {selectedParty.contact_person && (
                        <div className="flex items-center gap-3 text-slate-700">
                          <Users className="h-4 w-4 text-slate-400" />
                          {selectedParty.contact_person}
                        </div>
                      )}
                      {selectedParty.phone && (
                        <div className="flex items-center gap-3 text-slate-700">
                          <Phone className="h-4 w-4 text-slate-400" />
                          {selectedParty.phone}
                        </div>
                      )}
                      {selectedParty.email && (
                        <div className="flex items-center gap-3 text-slate-700">
                          <Mail className="h-4 w-4 text-slate-400" />
                          {selectedParty.email}
                        </div>
                      )}
                    </div>
                  </div>

                  {(selectedParty.address || selectedParty.city) && (
                    <div>
                      <h4 className="mb-3 text-sm font-semibold text-slate-500 uppercase">Address</h4>
                      <div className="flex items-start gap-3 text-slate-700">
                        <MapPin className="h-4 w-4 mt-0.5 text-slate-400" />
                        <div>
                          {selectedParty.address && <p>{selectedParty.address}</p>}
                          <p>
                            {[selectedParty.city, selectedParty.state, selectedParty.pincode].filter(Boolean).join(', ')}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="mb-3 text-sm font-semibold text-slate-500 uppercase">Tax Information</h4>
                    <dl className="space-y-3">
                      <div className="flex justify-between">
                        <dt className="text-slate-500">GSTIN</dt>
                        <dd className="font-mono text-sm text-slate-800">{selectedParty.gstin || '-'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">PAN</dt>
                        <dd className="font-mono text-sm text-slate-800">{selectedParty.pan || '-'}</dd>
                      </div>
                    </dl>
                  </div>

                  <div>
                    <h4 className="mb-3 text-sm font-semibold text-slate-500 uppercase">Credit Terms</h4>
                    <dl className="space-y-3">
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Payment Terms</dt>
                        <dd className="text-slate-800">{selectedParty.payment_terms || '-'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Credit Limit</dt>
                        <dd className="text-slate-800">
                          {selectedParty.credit_limit ? `₹${selectedParty.credit_limit.toLocaleString()}` : '-'}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Credit Days</dt>
                        <dd className="text-slate-800">{selectedParty.credit_days || '-'}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 border-t border-slate-100 p-6">
                <Button variant="secondary" className="flex-1" onClick={() => openEdit(selectedParty)}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button variant="danger" onClick={() => { setDeleteParty(selectedParty); setShowDetail(false); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <Modal
        isOpen={!!deleteParty}
        onClose={() => setDeleteParty(null)}
        title="Delete Party"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteParty(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-slate-600">
          Are you sure you want to delete <strong>{deleteParty?.party_name}</strong>?
        </p>
      </Modal>
    </div>
  );
}

