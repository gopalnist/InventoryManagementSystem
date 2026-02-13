import { useEffect, useState } from 'react';
import { Plus, Link2, Building2, AlertCircle } from 'lucide-react';

interface FulfillmentCenter {
  id: number;
  channel: string;
  code: string;
  name: string;
  type: string;
  is_active: boolean;
  mapped_warehouse: string | null;
}

export function FulfillmentCenters() {
  const [centers, setCenters] = useState<FulfillmentCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState('amazon');

  const channels = ['amazon', 'zepto', 'instamart', 'bigbasket', 'blinkit'];

  useEffect(() => {
    // TODO: Fetch from AMS API
    setTimeout(() => {
      setCenters([
        { id: 1, channel: 'amazon', code: 'BLR4', name: 'Bengaluru FC', type: 'FC', is_active: true, mapped_warehouse: 'WH-01' },
        { id: 2, channel: 'amazon', code: 'HKA2', name: 'Bengaluru Hub', type: 'HUB', is_active: true, mapped_warehouse: 'WH-01' },
        { id: 3, channel: 'amazon', code: 'HMH4', name: 'Kalyan FC', type: 'FC', is_active: true, mapped_warehouse: null },
        { id: 4, channel: 'amazon', code: 'HDL2', name: 'Sonepat FC', type: 'FC', is_active: true, mapped_warehouse: 'WH-02' },
        { id: 5, channel: 'zepto', code: 'DEL-FC1', name: 'Delhi Dark Store', type: 'DARKSTORE', is_active: true, mapped_warehouse: 'WH-02' },
        { id: 6, channel: 'zepto', code: 'BLR-FC1', name: 'Bengaluru Dark Store', type: 'DARKSTORE', is_active: true, mapped_warehouse: 'WH-01' },
      ]);
      setLoading(false);
    }, 500);
  }, []);

  const filteredCenters = centers.filter((c) => c.channel === selectedChannel);
  const unmappedCount = centers.filter((c) => c.channel === selectedChannel && !c.mapped_warehouse).length;

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
          <h2 className="text-2xl font-bold text-slate-900">Fulfillment Centers</h2>
          <p className="text-slate-500">Map channel FCs to your warehouses</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 font-semibold text-white shadow-lg hover:shadow-xl transition-all">
          <Plus className="h-5 w-5" />
          Add Mapping
        </button>
      </div>

      {/* Channel Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        {channels.map((channel) => (
          <button
            key={channel}
            onClick={() => setSelectedChannel(channel)}
            className={`px-4 py-3 text-sm font-medium capitalize transition-colors ${
              selectedChannel === channel
                ? 'border-b-2 border-orange-500 text-orange-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {channel}
          </button>
        ))}
      </div>

      {/* Warning for unmapped */}
      {unmappedCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200 p-4">
          <AlertCircle className="h-5 w-5 text-amber-600" />
          <p className="text-sm text-amber-800">
            <strong>{unmappedCount} fulfillment center(s)</strong> are not mapped to any warehouse.
            Orders to these FCs cannot be validated.
          </p>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                FC Code
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Name
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Type
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Status
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Mapped Warehouse
              </th>
              <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredCenters.map((center) => (
              <tr key={center.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <span className="font-mono font-medium text-slate-900">{center.code}</span>
                </td>
                <td className="px-6 py-4 text-slate-600">{center.name}</td>
                <td className="px-6 py-4">
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    {center.type}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      center.is_active
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {center.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {center.mapped_warehouse ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                      <Building2 className="h-3 w-3" />
                      {center.mapped_warehouse}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                      <AlertCircle className="h-3 w-3" />
                      Not Mapped
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors">
                    <Link2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredCenters.length === 0 && (
          <div className="py-12 text-center text-slate-500">
            No fulfillment centers for {selectedChannel}
          </div>
        )}
      </div>
    </div>
  );
}


