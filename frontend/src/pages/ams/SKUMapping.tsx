import { useEffect, useState } from 'react';
import { Search, Plus, Upload, Link2, Package, CheckCircle2, AlertCircle } from 'lucide-react';

interface SKUMapping {
  id: number;
  internal_sku: string;
  internal_name: string;
  mappings: {
    type: string;
    value: string;
    channel?: string;
  }[];
}

export function SKUMapping() {
  const [skuMappings, setSKUMappings] = useState<SKUMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // TODO: Fetch from AMS API
    setTimeout(() => {
      setSKUMappings([
        {
          id: 1,
          internal_sku: 'NY-QUI-001',
          internal_name: 'Nourish You Organic Quinoa Seeds - 500g',
          mappings: [
            { type: 'EAN', value: '8906082910236' },
            { type: 'ASIN', value: 'B08XYZ1234', channel: 'amazon' },
            { type: 'SKU_ALIAS', value: 'NourishYou-Quinoa-500g' },
          ],
        },
        {
          id: 2,
          internal_sku: 'NY-CHI-002',
          internal_name: 'Nourish You Chia Seeds Premium - 250g',
          mappings: [
            { type: 'EAN', value: '8906082910243' },
            { type: 'ASIN', value: 'B08ABC5678', channel: 'amazon' },
          ],
        },
        {
          id: 3,
          internal_sku: 'NY-PUM-003',
          internal_name: 'Nourish You Pumpkin Seeds Raw - 500g',
          mappings: [
            { type: 'EAN', value: '8906082910250' },
          ],
        },
        {
          id: 4,
          internal_sku: 'NY-OAT-004',
          internal_name: 'Nourish You Rolled Oats - 1kg',
          mappings: [],
        },
      ]);
      setLoading(false);
    }, 500);
  }, []);

  const filteredMappings = skuMappings.filter(
    (item) =>
      item.internal_sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.internal_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.mappings.some((m) => m.value.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalMapped = skuMappings.filter((s) => s.mappings.length > 0).length;
  const totalUnmapped = skuMappings.filter((s) => s.mappings.length === 0).length;

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">SKU Mapping</h2>
          <p className="text-slate-500">Map external identifiers to internal SKUs</p>
        </div>
        <div className="flex gap-3">
          <button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            <Upload className="h-4 w-4" />
            Bulk Import
          </button>
          <button className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 font-semibold text-white shadow-lg hover:shadow-xl transition-all">
            <Plus className="h-5 w-5" />
            Add Mapping
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Total SKUs</p>
          <p className="text-2xl font-bold text-slate-900">{skuMappings.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Mapped</p>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600">{totalMapped}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Unmapped</p>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-600">{totalUnmapped}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search by SKU, name, EAN, ASIN..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
        />
      </div>

      {/* SKU Cards */}
      <div className="space-y-4">
        {filteredMappings.map((sku) => (
          <div
            key={sku.id}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100">
                  <Package className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-mono font-semibold text-slate-900">{sku.internal_sku}</h3>
                    {sku.mappings.length > 0 ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        {sku.mappings.length} mapping(s)
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        No mappings
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{sku.internal_name}</p>
                </div>
              </div>
              <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors">
                <Link2 className="h-5 w-5" />
              </button>
            </div>

            {/* Mappings */}
            {sku.mappings.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {sku.mappings.map((mapping, index) => (
                  <div
                    key={index}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5"
                  >
                    <span className="text-xs font-semibold uppercase text-slate-500">
                      {mapping.type}
                    </span>
                    <span className="font-mono text-sm text-slate-700">{mapping.value}</span>
                    {mapping.channel && (
                      <span className="rounded bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-700 capitalize">
                        {mapping.channel}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredMappings.length === 0 && (
        <div className="py-12 text-center text-slate-500">No SKU mappings found</div>
      )}
    </div>
  );
}


