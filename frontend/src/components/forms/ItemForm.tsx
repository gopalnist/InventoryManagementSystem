import { useState, useEffect } from 'react';
import {
  Package,
  Wrench,
  DollarSign,
  ShoppingCart,
  Warehouse,
  ImagePlus,
  Info,
  ChevronDown,
  ChevronUp,
  X,
  Barcode,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useThemeStore } from '../../store/themeStore';
import type { Item, Category, Unit } from '../../types';

interface ItemFormProps {
  item?: Item | null;
  categories: Category[];
  units: Unit[];
  onSubmit: (data: ItemFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export interface ItemFormData {
  name: string;
  sku: string;
  item_type: 'goods' | 'service';
  description?: string;
  category_id?: string;
  unit_id?: string;
  // Sales info
  selling_price?: number;
  sales_description?: string;
  // Purchase info
  cost_price?: number;
  purchase_description?: string;
  // Inventory
  track_inventory: boolean;
  opening_stock?: number;
  reorder_point?: number;
  // Dimensions
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
}

interface FormSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultOpen?: boolean;
}

const sections: FormSection[] = [
  { id: 'basic', title: 'Basic Information', icon: Info, defaultOpen: true },
  { id: 'sales', title: 'Sales Information', icon: DollarSign, defaultOpen: true },
  { id: 'purchase', title: 'Purchase Information', icon: ShoppingCart, defaultOpen: true },
  { id: 'inventory', title: 'Inventory Tracking', icon: Warehouse, defaultOpen: false },
  { id: 'images', title: 'Images', icon: ImagePlus, defaultOpen: false },
];

export function ItemForm({ item, categories, units, onSubmit, onCancel, loading }: ItemFormProps) {
  const { currentTheme } = useThemeStore();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    basic: true,
    sales: true,
    purchase: true,
    inventory: false,
    images: false,
  });

  const [formData, setFormData] = useState<ItemFormData>({
    name: '',
    sku: '',
    item_type: 'goods',
    description: '',
    category_id: '',
    unit_id: '',
    selling_price: undefined,
    sales_description: '',
    cost_price: undefined,
    purchase_description: '',
    track_inventory: true,
    opening_stock: 0,
    reorder_point: 0,
    weight: undefined,
    length: undefined,
    width: undefined,
    height: undefined,
  });

  const [images, setImages] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name,
        sku: item.sku,
        item_type: item.item_type as 'goods' | 'service',
        description: item.description || '',
        category_id: item.category_id || '',
        unit_id: item.unit_id || '',
        selling_price: item.selling_price,
        sales_description: item.sales_description || '',
        cost_price: item.cost_price,
        purchase_description: item.purchase_description || '',
        track_inventory: item.track_inventory,
        opening_stock: 0,
        reorder_point: item.reorder_point || 0,
        weight: item.weight,
        length: item.dimensions?.length,
        width: item.dimensions?.width,
        height: item.dimensions?.height,
      });
    }
  }, [item]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const handleChange = (field: keyof ItemFormData, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Item name is required';
    if (!formData.sku.trim()) newErrors.sku = 'SKU is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onSubmit(formData);
  };

  const generateSKU = () => {
    const prefix = formData.name.slice(0, 3).toUpperCase() || 'ITM';
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    handleChange('sku', `${prefix}-${random}`);
  };

  const renderSectionHeader = (section: FormSection) => {
    const isExpanded = expandedSections[section.id];
    const Icon = section.icon;

    return (
      <button
        type="button"
        onClick={() => toggleSection(section.id)}
        className="flex w-full items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-100"
      >
        <div className="flex items-center gap-3">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${currentTheme.accent}`}>
            <Icon className="h-4 w-4 text-white" />
          </div>
          <span className="font-medium text-slate-700">{section.title}</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-slate-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-slate-400" />
        )}
      </button>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Item Type Selection */}
        <div className="flex gap-4 p-4 bg-slate-50 rounded-xl">
          <label className="flex-1">
            <input
              type="radio"
              name="item_type"
              value="goods"
              checked={formData.item_type === 'goods'}
              onChange={() => handleChange('item_type', 'goods')}
              className="sr-only peer"
            />
            <div className={`flex items-center justify-center gap-3 rounded-xl border-2 p-4 cursor-pointer transition-all peer-checked:border-blue-500 peer-checked:bg-blue-50 ${formData.item_type === 'goods' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
              <Package className={`h-6 w-6 ${formData.item_type === 'goods' ? 'text-blue-600' : 'text-slate-400'}`} />
              <div>
                <p className={`font-medium ${formData.item_type === 'goods' ? 'text-blue-700' : 'text-slate-700'}`}>Goods</p>
                <p className="text-xs text-slate-500">Physical products</p>
              </div>
            </div>
          </label>
          <label className="flex-1">
            <input
              type="radio"
              name="item_type"
              value="service"
              checked={formData.item_type === 'service'}
              onChange={() => handleChange('item_type', 'service')}
              className="sr-only peer"
            />
            <div className={`flex items-center justify-center gap-3 rounded-xl border-2 p-4 cursor-pointer transition-all peer-checked:border-purple-500 peer-checked:bg-purple-50 ${formData.item_type === 'service' ? 'border-purple-500 bg-purple-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
              <Wrench className={`h-6 w-6 ${formData.item_type === 'service' ? 'text-purple-600' : 'text-slate-400'}`} />
              <div>
                <p className={`font-medium ${formData.item_type === 'service' ? 'text-purple-700' : 'text-slate-700'}`}>Service</p>
                <p className="text-xs text-slate-500">Non-physical services</p>
              </div>
            </div>
          </label>
        </div>

        {/* Basic Information Section */}
        <div className="space-y-4">
          {renderSectionHeader(sections[0])}
          {expandedSections.basic && (
            <div className="animate-fade-in space-y-4 rounded-lg border border-slate-200 bg-white p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Input
                    label="Item Name *"
                    placeholder="Enter item name"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    error={errors.name}
                  />
                </div>
                <div>
                  <label className="label">SKU *</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="SKU-001"
                      value={formData.sku}
                      onChange={(e) => handleChange('sku', e.target.value)}
                      className={`input flex-1 ${errors.sku ? 'border-red-500' : ''}`}
                    />
                    <button
                      type="button"
                      onClick={generateSKU}
                      className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                      title="Generate SKU"
                    >
                      <Barcode className="h-4 w-4" />
                    </button>
                  </div>
                  {errors.sku && <p className="mt-1 text-xs text-red-500">{errors.sku}</p>}
                </div>
                <div>
                  <label className="label">Unit</label>
                  <select
                    value={formData.unit_id}
                    onChange={(e) => handleChange('unit_id', e.target.value)}
                    className="input"
                  >
                    <option value="">Select Unit</option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name} ({unit.abbreviation})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label">Category</label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => handleChange('category_id', e.target.value)}
                    className="input"
                  >
                    <option value="">Select Category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label">Description</label>
                  <textarea
                    placeholder="Enter item description..."
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    rows={3}
                    className="input resize-none"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sales Information Section */}
        <div className="space-y-4">
          {renderSectionHeader(sections[1])}
          {expandedSections.sales && (
            <div className="animate-fade-in space-y-4 rounded-lg border border-slate-200 bg-white p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Selling Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.selling_price || ''}
                      onChange={(e) => handleChange('selling_price', parseFloat(e.target.value) || 0)}
                      className="input pl-8"
                    />
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="label">Sales Description</label>
                  <textarea
                    placeholder="Description for sales invoices..."
                    value={formData.sales_description}
                    onChange={(e) => handleChange('sales_description', e.target.value)}
                    rows={2}
                    className="input resize-none"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Purchase Information Section */}
        <div className="space-y-4">
          {renderSectionHeader(sections[2])}
          {expandedSections.purchase && (
            <div className="animate-fade-in space-y-4 rounded-lg border border-slate-200 bg-white p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Cost Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.cost_price || ''}
                      onChange={(e) => handleChange('cost_price', parseFloat(e.target.value) || 0)}
                      className="input pl-8"
                    />
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="label">Purchase Description</label>
                  <textarea
                    placeholder="Description for purchase orders..."
                    value={formData.purchase_description}
                    onChange={(e) => handleChange('purchase_description', e.target.value)}
                    rows={2}
                    className="input resize-none"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Inventory Tracking Section (only for goods) */}
        {formData.item_type === 'goods' && (
          <div className="space-y-4">
            {renderSectionHeader(sections[3])}
            {expandedSections.inventory && (
              <div className="animate-fade-in space-y-4 rounded-lg border border-slate-200 bg-white p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.track_inventory}
                    onChange={(e) => handleChange('track_inventory', e.target.checked)}
                    className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-medium text-slate-700">Track inventory for this item</span>
                </label>
                
                {formData.track_inventory && (
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 animate-fade-in">
                    <div>
                      <label className="label">Opening Stock</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={formData.opening_stock || ''}
                        onChange={(e) => handleChange('opening_stock', parseInt(e.target.value) || 0)}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="label">Reorder Point</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={formData.reorder_point || ''}
                        onChange={(e) => handleChange('reorder_point', parseInt(e.target.value) || 0)}
                        className="input"
                      />
                      <p className="mt-1 text-xs text-slate-500">Alert when stock falls below this level</p>
                    </div>
                    <div>
                      <label className="label">Weight (kg)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={formData.weight || ''}
                        onChange={(e) => handleChange('weight', parseFloat(e.target.value) || 0)}
                        className="input"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="label">Dimensions (cm)</label>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Length"
                          value={formData.length || ''}
                          onChange={(e) => handleChange('length', parseFloat(e.target.value) || 0)}
                          className="input"
                        />
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Width"
                          value={formData.width || ''}
                          onChange={(e) => handleChange('width', parseFloat(e.target.value) || 0)}
                          className="input"
                        />
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Height"
                          value={formData.height || ''}
                          onChange={(e) => handleChange('height', parseFloat(e.target.value) || 0)}
                          className="input"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Images Section */}
        <div className="space-y-4">
          {renderSectionHeader(sections[4])}
          {expandedSections.images && (
            <div className="animate-fade-in rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap gap-4">
                {images.map((image, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={URL.createObjectURL(image)}
                      alt={`Preview ${index + 1}`}
                      className="h-24 w-24 rounded-lg object-cover border border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() => setImages(images.filter((_, i) => i !== index))}
                      className="absolute -right-2 -top-2 hidden group-hover:flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-500 transition-colors">
                  <ImagePlus className="h-6 w-6" />
                  <span className="mt-1 text-xs">Add Image</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) {
                        setImages([...images, ...Array.from(e.target.files)]);
                      }
                    }}
                    className="hidden"
                  />
                </label>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Upload up to 5 images. Max size: 5MB each.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          {item ? 'Update Item' : 'Save Item'}
        </Button>
      </div>
    </form>
  );
}

