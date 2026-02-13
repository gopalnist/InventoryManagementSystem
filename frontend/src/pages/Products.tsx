import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  Edit2,
  Trash2,
  Eye,
  Package,
  X,
  ChevronDown,
  ChevronUp,
  Barcode,
  DollarSign,
  ShoppingCart,
  Warehouse,
  ImagePlus,
  Info,
  Wrench,
  Tag,
  Scale,
  QrCode,
  Check,
  Columns3,
  GripVertical,
} from 'lucide-react';
import { productsApi, categoriesApi, unitsApi, brandsApi, manufacturersApi } from '../services/api';
import type { Product, ProductCreate, ProductUpdate, Category, Unit, Brand, Manufacturer } from '../types';
import { Button } from '../components/ui/Button';
import { Table, Pagination } from '../components/ui/Table';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Drawer } from '../components/ui/Drawer';
import { useAppStore } from '../store/appStore';
import { useThemeStore } from '../store/themeStore';

interface FormSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultOpen?: boolean;
}

const sections: FormSection[] = [
  { id: 'basic', title: 'Basic Information', icon: Info, defaultOpen: true },
  { id: 'identifiers', title: 'Product Identifiers', icon: QrCode, defaultOpen: false },
  { id: 'classification', title: 'Category & Brand', icon: Tag, defaultOpen: true },
  { id: 'dimensions', title: 'Dimensions & Weight', icon: Scale, defaultOpen: false },
  { id: 'sales', title: 'Sales Information', icon: DollarSign, defaultOpen: true },
  { id: 'purchase', title: 'Purchase Information', icon: ShoppingCart, defaultOpen: true },
  { id: 'inventory', title: 'Inventory Tracking', icon: Warehouse, defaultOpen: false },
  { id: 'images', title: 'Images', icon: ImagePlus, defaultOpen: false },
];

// Inline add modal types
type InlineAddType = 'category' | 'brand' | 'manufacturer' | 'unit' | null;

export function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { addNotification } = useAppStore();
  const { currentTheme } = useThemeStore();
  
  // Sample data based on Nourish You products (https://nourishyou.in/)
  const sampleItems: Item[] = [
    {
      id: '1',
      sku_code: 'NY-MLK-001',
      name: 'Millet Mlk Original - 200ml',
      description: 'The most delicious plant based mlk. Experience the pure goodness of Original Millet Milk, the best dairy alternative.',
      category_id: 'cat-1',
      category_name: 'Plant-Based Milk',
      primary_unit_id: 'unit-1',
      primary_unit_name: 'Pack',
      purchase_rate: 250,
      selling_rate: 330,
      mrp: 350,
      tax_rate: 5,
      hsn_code: '2202',
      reorder_level: 50,
      track_batches: true,
      track_serials: false,
      track_expiry: true,
      is_active: true,
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-01-15T10:00:00Z',
    },
    {
      id: '2',
      sku_code: 'NY-MLK-002',
      name: 'Millet Mlk Chocolate - 200ml',
      description: 'Rich, decadent taste of Chocolate Millet Mlk. The healthiest chocolatey treat out there.',
      category_id: 'cat-1',
      category_name: 'Plant-Based Milk',
      primary_unit_id: 'unit-1',
      primary_unit_name: 'Pack',
      purchase_rate: 260,
      selling_rate: 330,
      mrp: 350,
      tax_rate: 5,
      hsn_code: '2202',
      reorder_level: 50,
      track_batches: true,
      track_serials: false,
      track_expiry: true,
      is_active: true,
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-01-15T10:00:00Z',
    },
    {
      id: '3',
      sku_code: 'NY-KRD-001',
      name: 'Peanut Kurd - 450g',
      description: 'Creamy, dairy-free delight made from high-quality peanuts. Rich in probiotics and plant protein.',
      category_id: 'cat-2',
      category_name: 'Dairy-Free Alternatives',
      primary_unit_id: 'unit-2',
      primary_unit_name: 'Jar',
      purchase_rate: 140,
      selling_rate: 190,
      mrp: 210,
      tax_rate: 5,
      hsn_code: '2106',
      reorder_level: 30,
      track_batches: true,
      track_serials: false,
      track_expiry: true,
      is_active: true,
      created_at: '2024-01-14T10:00:00Z',
      updated_at: '2024-01-14T10:00:00Z',
    },
    {
      id: '4',
      sku_code: 'NY-PRD-001',
      name: 'Plant-based Prodigee - 500ml',
      description: 'Golden, aromatic, and 100% plant-powered. Zero trans fat, clean label ghee alternative.',
      category_id: 'cat-2',
      category_name: 'Dairy-Free Alternatives',
      primary_unit_id: 'unit-3',
      primary_unit_name: 'Bottle',
      purchase_rate: 380,
      selling_rate: 499,
      mrp: 549,
      tax_rate: 5,
      hsn_code: '1517',
      reorder_level: 25,
      track_batches: true,
      track_serials: false,
      track_expiry: true,
      is_active: true,
      created_at: '2024-01-13T10:00:00Z',
      updated_at: '2024-01-13T10:00:00Z',
    },
    {
      id: '5',
      sku_code: 'NY-QNA-001',
      name: 'White Quinoa - 500g',
      description: 'Whole protein grain, excellent choice for those seeking high-protein grains. Homegrown superfood.',
      category_id: 'cat-3',
      category_name: 'Quinoa',
      primary_unit_id: 'unit-4',
      primary_unit_name: 'Pouch',
      purchase_rate: 220,
      selling_rate: 289,
      mrp: 320,
      tax_rate: 0,
      hsn_code: '1008',
      reorder_level: 40,
      track_batches: true,
      track_serials: false,
      track_expiry: true,
      is_active: true,
      created_at: '2024-01-12T10:00:00Z',
      updated_at: '2024-01-12T10:00:00Z',
    },
    {
      id: '6',
      sku_code: 'NY-QNA-002',
      name: 'White Quinoa - 1kg',
      description: 'Whole protein grain, excellent choice for those seeking high-protein grains. Value pack.',
      category_id: 'cat-3',
      category_name: 'Quinoa',
      primary_unit_id: 'unit-4',
      primary_unit_name: 'Pouch',
      purchase_rate: 420,
      selling_rate: 549,
      mrp: 599,
      tax_rate: 0,
      hsn_code: '1008',
      reorder_level: 30,
      track_batches: true,
      track_serials: false,
      track_expiry: true,
      is_active: true,
      created_at: '2024-01-12T10:00:00Z',
      updated_at: '2024-01-12T10:00:00Z',
    },
    {
      id: '7',
      sku_code: 'NY-SED-001',
      name: 'Black Chia Seeds - 250g',
      description: 'Nature\'s super seeds, packed with Omega-3 and Fiber. Hydrating, tiny, fibrous and protein packed.',
      category_id: 'cat-4',
      category_name: 'Edible Seeds',
      primary_unit_id: 'unit-4',
      primary_unit_name: 'Pouch',
      purchase_rate: 170,
      selling_rate: 225,
      mrp: 250,
      tax_rate: 0,
      hsn_code: '1207',
      reorder_level: 35,
      track_batches: true,
      track_serials: false,
      track_expiry: true,
      is_active: true,
      created_at: '2024-01-11T10:00:00Z',
      updated_at: '2024-01-11T10:00:00Z',
    },
    {
      id: '8',
      sku_code: 'NY-SED-002',
      name: 'Black Chia Seeds - 500g',
      description: 'Nature\'s super seeds, packed with Omega-3 and Fiber. Value pack for regular users.',
      category_id: 'cat-4',
      category_name: 'Edible Seeds',
      primary_unit_id: 'unit-4',
      primary_unit_name: 'Pouch',
      purchase_rate: 320,
      selling_rate: 425,
      mrp: 475,
      tax_rate: 0,
      hsn_code: '1207',
      reorder_level: 25,
      track_batches: true,
      track_serials: false,
      track_expiry: true,
      is_active: true,
      created_at: '2024-01-11T10:00:00Z',
      updated_at: '2024-01-11T10:00:00Z',
    },
    {
      id: '9',
      sku_code: 'NY-BRK-001',
      name: 'Super Muesli - Belgium Dark Chocolate - 400g',
      description: 'Plant-based, gluten-free, homegrown millet blend (ragi, jowar, bajra) with Belgium dark chocolate.',
      category_id: 'cat-5',
      category_name: 'Breakfast',
      primary_unit_id: 'unit-4',
      primary_unit_name: 'Pouch',
      purchase_rate: 420,
      selling_rate: 560,
      mrp: 620,
      tax_rate: 12,
      hsn_code: '1904',
      reorder_level: 20,
      track_batches: true,
      track_serials: false,
      track_expiry: true,
      is_active: true,
      created_at: '2024-01-10T10:00:00Z',
      updated_at: '2024-01-10T10:00:00Z',
    },
    {
      id: '10',
      sku_code: 'NY-BRK-002',
      name: 'Super Muesli - Mixed Berries - 400g',
      description: 'Plant-based, gluten-free muesli with mixed berries. Perfect healthy breakfast option.',
      category_id: 'cat-5',
      category_name: 'Breakfast',
      primary_unit_id: 'unit-4',
      primary_unit_name: 'Pouch',
      purchase_rate: 400,
      selling_rate: 540,
      mrp: 599,
      tax_rate: 12,
      hsn_code: '1904',
      reorder_level: 20,
      track_batches: true,
      track_serials: false,
      track_expiry: true,
      is_active: true,
      created_at: '2024-01-10T10:00:00Z',
      updated_at: '2024-01-10T10:00:00Z',
    },
    {
      id: '11',
      sku_code: 'NY-SED-003',
      name: 'Roasted Pumpkin Seeds - 150g',
      description: 'Crunchy, lightly salted roasted pumpkin seeds. Rich in zinc and magnesium.',
      category_id: 'cat-6',
      category_name: 'Roasted Seeds',
      primary_unit_id: 'unit-4',
      primary_unit_name: 'Pouch',
      purchase_rate: 180,
      selling_rate: 249,
      mrp: 280,
      tax_rate: 5,
      hsn_code: '2008',
      reorder_level: 30,
      track_batches: true,
      track_serials: false,
      track_expiry: true,
      is_active: true,
      created_at: '2024-01-09T10:00:00Z',
      updated_at: '2024-01-09T10:00:00Z',
    },
    {
      id: '12',
      sku_code: 'NY-SED-004',
      name: 'Roasted Sunflower Seeds - 150g',
      description: 'Lightly roasted sunflower seeds. Great source of Vitamin E and healthy fats.',
      category_id: 'cat-6',
      category_name: 'Roasted Seeds',
      primary_unit_id: 'unit-4',
      primary_unit_name: 'Pouch',
      purchase_rate: 140,
      selling_rate: 199,
      mrp: 220,
      tax_rate: 5,
      hsn_code: '2008',
      reorder_level: 30,
      track_batches: true,
      track_serials: false,
      track_expiry: true,
      is_active: true,
      created_at: '2024-01-09T10:00:00Z',
      updated_at: '2024-01-09T10:00:00Z',
    },
    {
      id: '13',
      sku_code: 'NY-FLR-001',
      name: 'Ragi Flour - 500g',
      description: 'Homegrown finger millet flour. Gluten-free, rich in calcium and iron.',
      category_id: 'cat-7',
      category_name: 'Specialty Flours',
      primary_unit_id: 'unit-4',
      primary_unit_name: 'Pouch',
      purchase_rate: 85,
      selling_rate: 120,
      mrp: 140,
      tax_rate: 0,
      hsn_code: '1102',
      reorder_level: 40,
      track_batches: true,
      track_serials: false,
      track_expiry: true,
      is_active: true,
      created_at: '2024-01-08T10:00:00Z',
      updated_at: '2024-01-08T10:00:00Z',
    },
    {
      id: '14',
      sku_code: 'NY-FLR-002',
      name: 'Jowar Flour - 500g',
      description: 'Premium sorghum flour. Gluten-free alternative for rotis and baking.',
      category_id: 'cat-7',
      category_name: 'Specialty Flours',
      primary_unit_id: 'unit-4',
      primary_unit_name: 'Pouch',
      purchase_rate: 75,
      selling_rate: 110,
      mrp: 130,
      tax_rate: 0,
      hsn_code: '1102',
      reorder_level: 40,
      track_batches: true,
      track_serials: false,
      track_expiry: true,
      is_active: true,
      created_at: '2024-01-08T10:00:00Z',
      updated_at: '2024-01-08T10:00:00Z',
    },
    {
      id: '15',
      sku_code: 'NY-SNK-001',
      name: 'Quinoa Puffs - Masala - 50g',
      description: 'Crunchy quinoa puffs with Indian masala flavor. Healthy snacking option.',
      category_id: 'cat-8',
      category_name: 'Healthy Snacks',
      primary_unit_id: 'unit-1',
      primary_unit_name: 'Pack',
      purchase_rate: 35,
      selling_rate: 55,
      mrp: 65,
      tax_rate: 12,
      hsn_code: '1905',
      reorder_level: 60,
      track_batches: true,
      track_serials: false,
      track_expiry: true,
      is_active: true,
      created_at: '2024-01-07T10:00:00Z',
      updated_at: '2024-01-07T10:00:00Z',
    },
    {
      id: '16',
      sku_code: 'NY-SNK-002',
      name: 'Millet Cookies - Chocolate Chip - 150g',
      description: 'Delicious millet-based cookies with real chocolate chips. Guilt-free indulgence.',
      category_id: 'cat-8',
      category_name: 'Healthy Snacks',
      primary_unit_id: 'unit-1',
      primary_unit_name: 'Pack',
      purchase_rate: 120,
      selling_rate: 175,
      mrp: 199,
      tax_rate: 12,
      hsn_code: '1905',
      reorder_level: 40,
      track_batches: true,
      track_serials: false,
      track_expiry: true,
      is_active: false,
      created_at: '2024-01-07T10:00:00Z',
      updated_at: '2024-01-07T10:00:00Z',
    },
  ];

  // Sample categories based on Nourish You
  const sampleCategories: Category[] = [
    { id: 'cat-1', name: 'Plant-Based Milk', is_active: true, created_at: '', updated_at: '' },
    { id: 'cat-2', name: 'Dairy-Free Alternatives', is_active: true, created_at: '', updated_at: '' },
    { id: 'cat-3', name: 'Quinoa', is_active: true, created_at: '', updated_at: '' },
    { id: 'cat-4', name: 'Edible Seeds', is_active: true, created_at: '', updated_at: '' },
    { id: 'cat-5', name: 'Breakfast', is_active: true, created_at: '', updated_at: '' },
    { id: 'cat-6', name: 'Roasted Seeds', is_active: true, created_at: '', updated_at: '' },
    { id: 'cat-7', name: 'Specialty Flours', is_active: true, created_at: '', updated_at: '' },
    { id: 'cat-8', name: 'Healthy Snacks', is_active: true, created_at: '', updated_at: '' },
  ];

  // Sample units
  const sampleUnits: Unit[] = [
    { id: 'unit-1', name: 'Pack', symbol: 'pack', unit_type: 'quantity', is_active: true, created_at: '', updated_at: '' },
    { id: 'unit-2', name: 'Jar', symbol: 'jar', unit_type: 'quantity', is_active: true, created_at: '', updated_at: '' },
    { id: 'unit-3', name: 'Bottle', symbol: 'btl', unit_type: 'quantity', is_active: true, created_at: '', updated_at: '' },
    { id: 'unit-4', name: 'Pouch', symbol: 'pch', unit_type: 'quantity', is_active: true, created_at: '', updated_at: '' },
    { id: 'unit-5', name: 'Kilogram', symbol: 'kg', unit_type: 'weight', is_active: true, created_at: '', updated_at: '' },
    { id: 'unit-6', name: 'Gram', symbol: 'g', unit_type: 'weight', is_active: true, created_at: '', updated_at: '' },
    { id: 'unit-7', name: 'Pieces', symbol: 'pcs', unit_type: 'quantity', is_active: true, created_at: '', updated_at: '' },
  ];

  // List state - Product type but accepting legacy Item shape for sample data
  const [items, setItems] = useState<(Product | typeof sampleItems[0])[]>(sampleItems);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(2);
  const [totalItems, setTotalItems] = useState(sampleItems.length);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  
  // Supporting data - initialized with sample data
  const [categories, setCategories] = useState<Category[]>(sampleCategories);
  const [units, setUnits] = useState<Unit[]>(sampleUnits);
  const [brands, setBrands] = useState<string[]>(['Nourish You', 'One Good', 'Organic India', 'True Elements', 'Slurrp Farm']);
  const [manufacturers, setManufacturers] = useState<string[]>(['Nourish You Foods Pvt Ltd', 'One Good Foods', 'Organic India Pvt Ltd']);
  
  // Drawer state
  const [showDrawer, setShowDrawer] = useState(false);
  const [editingItem, setEditingItem] = useState<(Product | typeof sampleItems[0]) | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  
  // Detail view state
  const [selectedItem, setSelectedItem] = useState<(Product | typeof sampleItems[0]) | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  
  // Delete confirmation
  const [deleteItem, setDeleteItem] = useState<(Product | typeof sampleItems[0]) | null>(null);

  // Inline add modal
  const [inlineAddType, setInlineAddType] = useState<InlineAddType>(null);
  const [inlineAddValue, setInlineAddValue] = useState('');
  const [inlineAddParent, setInlineAddParent] = useState('');

  // Column visibility state
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    name: true,
    sku: true,
    category: true,
    stock: true,
    cost: true,
    price: true,
    tax: true,
    status: true,
  });

  // Form sections expanded state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    basic: true,
    identifiers: false,
    classification: true,
    dimensions: false,
    sales: true,
    purchase: true,
    inventory: false,
    images: false,
  });

  // Comprehensive form state matching Zoho Inventory
  const [form, setForm] = useState({
    // Basic Info
    item_type: 'goods' as 'goods' | 'service',
    name: '',
    sku_code: '',
    primary_unit_id: '',
    is_returnable: true,
    description: '',
    
    // Product Identifiers
    upc: '', // Universal Product Code (12-digit)
    ean: '', // European Article Number (13-digit)
    mpn: '', // Manufacturer Part Number
    isbn: '', // International Standard Book Number
    
    // Classification
    category_id: '',
    brand: '',
    manufacturer: '',
    
    // Dimensions & Weight
    weight: undefined as number | undefined,
    weight_unit: 'kg',
    length: undefined as number | undefined,
    width: undefined as number | undefined,
    height: undefined as number | undefined,
    dimension_unit: 'cm',
    
    // Sales Information
    selling_rate: undefined as number | undefined,
    mrp: undefined as number | undefined,
    sales_account: 'Sales',
    sales_description: '',
    tax_rate: undefined as number | undefined,
    tax_type: 'taxable' as 'taxable' | 'tax_exempt' | 'non_taxable',
    hsn_code: '',
    
    // Purchase Information
    purchase_rate: undefined as number | undefined,
    purchase_account: 'Cost of Goods Sold',
    purchase_description: '',
    preferred_vendor: '',
    
    // Inventory Tracking
    track_inventory: true,
    opening_stock: undefined as number | undefined,
    opening_stock_rate: undefined as number | undefined,
    reorder_level: undefined as number | undefined,
    track_batches: false,
    track_serials: false,
    track_expiry: false,
  });

  // Images state
  const [images, setImages] = useState<File[]>([]);

  // Load products from API
  const loadItems = useCallback(async () => {
    setLoading(true);
    
    try {
      const result = await productsApi.list({
        page,
        limit: 10,
        search: search || undefined,
        category_id: categoryFilter || undefined,
        sort_by: 'created_at',
        sort_order: 'desc',
      });
      setItems(result.products);
      setTotalPages(result.total_pages);
      setTotalItems(result.total);
    } catch (error) {
      console.error('Failed to load products:', error);
      // Use sample data as fallback when API is unavailable
      let filteredItems = [...sampleItems];
      
      if (search) {
        const searchLower = search.toLowerCase();
        filteredItems = filteredItems.filter(item => 
          item.name.toLowerCase().includes(searchLower) ||
          ('sku' in item ? item.sku : item.sku_code).toLowerCase().includes(searchLower) ||
          item.description?.toLowerCase().includes(searchLower)
        );
      }
      
      if (categoryFilter) {
        filteredItems = filteredItems.filter(item => item.category_id === categoryFilter);
      }
      
      const itemsPerPage = 10;
      const startIndex = (page - 1) * itemsPerPage;
      const paginatedItems = filteredItems.slice(startIndex, startIndex + itemsPerPage);
      
      setItems(paginatedItems);
      setTotalPages(Math.ceil(filteredItems.length / itemsPerPage));
      setTotalItems(filteredItems.length);
    } finally {
      setLoading(false);
    }
  }, [page, search, categoryFilter]);

  // Load supporting data from API
  const loadSupportingData = async () => {
    try {
      const [categoriesRes, unitsRes, brandsRes, manufacturersRes] = await Promise.all([
        categoriesApi.getTree().catch(() => ({ categories: sampleCategories })),
        unitsApi.list().catch(() => ({ units: sampleUnits })),
        brandsApi.list({ is_active: true }).catch(() => ({ brands: [] })),
        manufacturersApi.list({ is_active: true }).catch(() => ({ manufacturers: [] })),
      ]);
      setCategories(categoriesRes.categories || sampleCategories);
      setUnits(unitsRes.units || sampleUnits);
      setBrands(brandsRes.brands?.map((b: Brand) => b.name) || ['Nourish You', 'One Good', 'Organic India']);
      setManufacturers(manufacturersRes.manufacturers?.map((m: Manufacturer) => m.name) || ['Nourish You Foods Pvt Ltd']);
    } catch (error) {
      console.error('Failed to load supporting data:', error);
      // Keep sample data as fallback
    }
  };

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    loadSupportingData();
    
    // Check for action param
    if (searchParams.get('action') === 'new') {
      setShowDrawer(true);
      setSearchParams({});
    }
  }, []);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const generateSKU = () => {
    const prefix = form.name.slice(0, 3).toUpperCase() || 'ITM';
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    setForm({ ...form, sku_code: `${prefix}-${random}` });
  };

  // Inline add unit state
  const [inlineUnitSymbol, setInlineUnitSymbol] = useState('');

  // Handle inline add - integrated with API
  const handleInlineAdd = async () => {
    if (!inlineAddValue.trim()) return;
    
    try {
      switch (inlineAddType) {
        case 'category':
          const newCat = await categoriesApi.create({
            name: inlineAddValue,
            parent_id: inlineAddParent || undefined,
          });
          setCategories([...categories, newCat]);
          setForm({ ...form, category_id: newCat.id });
          addNotification('success', `Category "${inlineAddValue}" created`);
          break;
          
        case 'brand':
          const newBrand = await brandsApi.create({
            name: inlineAddValue,
          });
          // Update brands list with the new brand object
          const brandsRes = await brandsApi.list({ is_active: true });
          setBrands(brandsRes.brands?.map((b: Brand) => b.name) || []);
          setForm({ ...form, brand: inlineAddValue });
          addNotification('success', `Brand "${inlineAddValue}" created`);
          break;
          
        case 'manufacturer':
          const newMfr = await manufacturersApi.create({
            name: inlineAddValue,
          });
          // Update manufacturers list
          const mfrsRes = await manufacturersApi.list({ is_active: true });
          setManufacturers(mfrsRes.manufacturers?.map((m: Manufacturer) => m.name) || []);
          setForm({ ...form, manufacturer: inlineAddValue });
          addNotification('success', `Manufacturer "${inlineAddValue}" created`);
          break;
          
        case 'unit':
          if (!inlineUnitSymbol.trim()) {
            addNotification('error', 'Please enter unit symbol');
            return;
          }
          const newUnit = await unitsApi.create({
            name: inlineAddValue,
            symbol: inlineUnitSymbol,
            unit_type: 'quantity',
          });
          setUnits([...units, newUnit]);
          setForm({ ...form, primary_unit_id: newUnit.id });
          addNotification('success', `Unit "${inlineAddValue}" created`);
          setInlineUnitSymbol('');
          break;
      }
    } catch (error) {
      console.error('Failed to create:', error);
      addNotification('error', `Failed to create ${inlineAddType}`);
    }
    
    setInlineAddType(null);
    setInlineAddValue('');
    setInlineAddParent('');
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.name.trim() || !form.sku_code.trim()) {
      addNotification('error', 'Please fill in required fields');
      return;
    }

    setFormLoading(true);

    try {
      const productData: ProductCreate = {
        sku: form.sku_code,
        name: form.name,
        description: form.description,
        product_type: form.item_type === 'service' ? 'service' : 'goods',
        category_id: form.category_id || undefined,
        primary_unit_id: form.primary_unit_id || undefined,
        // Product identifiers
        upc: form.upc || undefined,
        ean: form.ean || undefined,
        mpn: form.mpn || undefined,
        isbn: form.isbn || undefined,
        // Dimensions
        weight: form.weight,
        length: form.length,
        width: form.width,
        height: form.height,
        // Sales info
        selling_price: form.selling_rate,
        mrp: form.mrp,
        sales_description: form.sales_description || undefined,
        sales_tax_rate: form.tax_rate,
        is_taxable: form.tax_type === 'taxable',
        hsn_code: form.hsn_code || undefined,
        // Purchase info
        cost_price: form.purchase_rate,
        purchase_description: form.purchase_description || undefined,
        // Inventory
        reorder_level: form.reorder_level,
        opening_stock: form.opening_stock,
        opening_stock_value: form.opening_stock_rate,
        track_batches: form.track_batches,
        track_serials: form.track_serials,
        track_expiry: form.track_expiry,
      };

      if (editingItem) {
        await productsApi.update(editingItem.id, productData as ProductUpdate);
        addNotification('success', 'Product updated successfully');
      } else {
        await productsApi.create(productData);
        addNotification('success', 'Product created successfully');
      }
      setShowDrawer(false);
      resetForm();
      loadItems();
    } catch (error: unknown) {
      console.error('Failed to save product:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save product';
      addNotification('error', errorMessage);
    } finally {
      setFormLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!deleteItem) return;
    
    try {
      await productsApi.delete(deleteItem.id);
      addNotification('success', 'Product deleted successfully');
      setDeleteItem(null);
      loadItems();
    } catch (error) {
      console.error('Failed to delete product:', error);
      addNotification('error', 'Failed to delete product');
    }
  };

  // Reset form
  const resetForm = () => {
    setForm({
      item_type: 'goods',
      name: '',
      sku_code: '',
      primary_unit_id: '',
      is_returnable: true,
      description: '',
      upc: '',
      ean: '',
      mpn: '',
      isbn: '',
      category_id: '',
      brand: '',
      manufacturer: '',
      weight: undefined,
      weight_unit: 'kg',
      length: undefined,
      width: undefined,
      height: undefined,
      dimension_unit: 'cm',
      selling_rate: undefined,
      mrp: undefined,
      sales_account: 'Sales',
      sales_description: '',
      tax_rate: undefined,
      tax_type: 'taxable',
      hsn_code: '',
      purchase_rate: undefined,
      purchase_account: 'Cost of Goods Sold',
      purchase_description: '',
      preferred_vendor: '',
      track_inventory: true,
      opening_stock: undefined,
      opening_stock_rate: undefined,
      reorder_level: undefined,
      track_batches: false,
      track_serials: false,
      track_expiry: false,
    });
    setEditingItem(null);
    setImages([]);
    setExpandedSections({
      basic: true,
      identifiers: false,
      classification: true,
      dimensions: false,
      sales: true,
      purchase: true,
      inventory: false,
      images: false,
    });
  };

  // Open edit drawer - populate all fields from product
  const openEdit = (item: Product | typeof sampleItems[0]) => {
    setEditingItem(item);
    
    // Get brand and manufacturer names if they exist
    const brandName = 'brand_name' in item ? item.brand_name : '';
    const manufacturerName = 'manufacturer_name' in item ? item.manufacturer_name : '';
    
    setForm({
      item_type: ('product_type' in item && item.product_type === 'service') ? 'service' : 'goods',
      name: item.name,
      sku_code: ('sku' in item ? item.sku : item.sku_code),
      primary_unit_id: item.primary_unit_id || '',
      is_returnable: true,
      description: item.description || '',
      
      // Product Identifiers
      upc: ('upc' in item ? item.upc : '') || '',
      ean: ('ean' in item ? item.ean : '') || '',
      mpn: ('mpn' in item ? item.mpn : '') || '',
      isbn: ('isbn' in item ? item.isbn : '') || '',
      
      // Classification
      category_id: item.category_id || '',
      brand: brandName || '',
      manufacturer: manufacturerName || '',
      
      // Dimensions & Weight
      weight: ('weight' in item ? item.weight : undefined) as number | undefined,
      weight_unit: 'kg',
      length: ('length' in item ? item.length : undefined) as number | undefined,
      width: ('width' in item ? item.width : undefined) as number | undefined,
      height: ('height' in item ? item.height : undefined) as number | undefined,
      dimension_unit: 'cm',
      
      // Sales Information
      selling_rate: ('selling_price' in item ? Number(item.selling_price) : item.selling_rate),
      mrp: item.mrp ? Number(item.mrp) : undefined,
      sales_account: 'Sales',
      sales_description: ('sales_description' in item ? item.sales_description : '') || '',
      tax_rate: ('sales_tax_rate' in item ? item.sales_tax_rate : item.tax_rate),
      tax_type: ('is_taxable' in item && item.is_taxable === false) ? 'non_taxable' : 'taxable',
      hsn_code: item.hsn_code || '',
      
      // Purchase Information
      purchase_rate: ('cost_price' in item ? Number(item.cost_price) : item.purchase_rate),
      purchase_account: 'Cost of Goods Sold',
      purchase_description: ('purchase_description' in item ? item.purchase_description : '') || '',
      preferred_vendor: '',
      
      // Inventory Tracking
      track_inventory: true,
      opening_stock: ('opening_stock' in item ? item.opening_stock : undefined) as number | undefined,
      opening_stock_rate: ('opening_stock_value' in item ? item.opening_stock_value : undefined) as number | undefined,
      reorder_level: item.reorder_level,
      track_batches: item.track_batches ?? false,
      track_serials: item.track_serials ?? false,
      track_expiry: item.track_expiry ?? false,
    });
    setShowDrawer(true);
  };

  // Flatten categories for dropdown
  const flattenCategories = (cats: Category[], prefix = ''): Array<{ value: string; label: string }> => {
    return cats.flatMap((cat) => [
      { value: cat.id, label: prefix + cat.name },
      ...(cat.children ? flattenCategories(cat.children, prefix + '  ↳ ') : []),
    ]);
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

  // Inline select with add button
  const renderSelectWithAdd = (
    label: string,
    value: string,
    options: Array<{ value: string; label: string }>,
    onChange: (val: string) => void,
    addType: InlineAddType,
    placeholder = 'Select...',
    required = false
  ) => (
    <div>
      <label className="label">{label}{required && ' *'}</label>
      <div className="flex gap-2">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input flex-1"
        >
          <option value="">{placeholder}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setInlineAddType(addType)}
          className={`flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 hover:bg-slate-50 transition-colors ${currentTheme.accent.replace('bg-', 'text-').replace('-600', '-600')}`}
          title={`Add new ${label.toLowerCase()}`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  // Generate random stock for demo
  const getRandomStock = (itemId: string) => {
    const seed = parseInt(itemId) || 1;
    return Math.floor((seed * 17 + 23) % 200) + 10;
  };

  // Column definitions with visibility keys
  const allColumns = [
    {
      key: 'name',
      visibilityKey: 'name',
      header: 'ITEM NAME',
      label: 'Item Name',
      required: true, // Cannot be hidden
      className: 'min-w-[280px] max-w-[400px]',
      render: (item: Item) => (
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${currentTheme.sidebar.logoAccent} text-white shadow-sm`}>
            <Package className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-800 break-words leading-tight">{item.name}</p>
            {item.hsn_code && (
              <p className="text-xs text-slate-400 mt-0.5">HSN: {item.hsn_code}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'sku_code',
      visibilityKey: 'sku',
      header: 'SKU',
      label: 'SKU Code',
      render: (item: Item) => (
        <div className="flex items-center gap-2">
          <Barcode className="h-4 w-4 text-slate-400" />
          <span className="font-mono text-sm text-slate-700">{('sku' in item ? item.sku : item.sku_code)}</span>
        </div>
      ),
    },
    {
      key: 'category_name',
      visibilityKey: 'category',
      header: 'CATEGORY',
      label: 'Category',
      render: (item: Item) => (
        <span className={`inline-flex items-center gap-1.5 rounded-full ${currentTheme.accentLight} px-3 py-1 text-xs font-medium`}>
          <span className={`h-1.5 w-1.5 rounded-full ${currentTheme.accent}`}></span>
          {item.category_name || 'Uncategorized'}
        </span>
      ),
    },
    {
      key: 'stock',
      visibilityKey: 'stock',
      header: 'STOCK',
      label: 'Stock on Hand',
      render: (item: Item) => {
        const stock = getRandomStock(item.id);
        const reorderLevel = item.reorder_level || 20;
        const isLowStock = stock <= reorderLevel;
        return (
          <div className="text-right">
            <p className={`font-semibold ${isLowStock ? 'text-amber-600' : 'text-slate-800'}`}>
              {stock}
            </p>
            <p className="text-xs text-slate-500">{item.primary_unit_name || 'units'}</p>
            {isLowStock && (
              <p className="text-xs text-amber-500 flex items-center justify-end gap-1 mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                Low
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: 'purchase_rate',
      visibilityKey: 'cost',
      header: 'COST',
      label: 'Cost Price',
      render: (item: Item) => (
        <div className="text-right">
          <p className="text-slate-600">
            {(('cost_price' in item ? item.cost_price : item.purchase_rate)) ? `₹${(('cost_price' in item ? Number(item.cost_price) : item.purchase_rate) || 0).toLocaleString('en-IN')}` : '-'}
          </p>
        </div>
      ),
    },
    {
      key: 'selling_rate',
      visibilityKey: 'price',
      header: 'PRICE',
      label: 'Selling Price',
      render: (item: Item) => (
        <div className="text-right">
          <p className="font-semibold text-slate-800">
            {(('selling_price' in item ? item.selling_price : item.selling_rate)) ? `₹${(('selling_price' in item ? Number(item.selling_price) : item.selling_rate) || 0).toLocaleString('en-IN')}` : '-'}
          </p>
          {item.mrp && item.mrp > (('selling_price' in item ? Number(item.selling_price) : item.selling_rate) || 0) && (
            <p className="text-xs text-slate-400 line-through">
              ₹{item.mrp.toLocaleString('en-IN')}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'tax_rate',
      visibilityKey: 'tax',
      header: 'TAX',
      label: 'Tax Rate',
      render: (item: Item) => (
        <span className="text-sm text-slate-600">
          {item.tax_rate !== undefined ? `${item.tax_rate}%` : '-'}
        </span>
      ),
    },
    {
      key: 'is_active',
      visibilityKey: 'status',
      header: 'STATUS',
      label: 'Status',
      render: (item: Item) => (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
          item.is_active 
            ? 'bg-emerald-50 text-emerald-700' 
            : 'bg-slate-100 text-slate-500'
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full ${item.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
          {item.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      visibilityKey: 'actions',
      header: '',
      label: 'Actions',
      required: true, // Cannot be hidden
      width: '120px',
      render: (item: Item) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setSelectedItem(item); setShowDetail(true); }}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            title="View Details"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); openEdit(item); }}
            className="rounded-lg p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
            title="Edit Item"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setDeleteItem(item); }}
            className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
            title="Delete Item"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  // Filter columns based on visibility
  const columns = allColumns.filter(col => 
    col.required || visibleColumns[col.visibilityKey]
  );

  // Toggle column visibility
  const toggleColumn = (key: string) => {
    setVisibleColumns(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${currentTheme.sidebar.logoAccent}`}>
              <Package className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{sampleItems.length}</p>
              <p className="text-sm text-slate-500">Total Items</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
              <Package className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{sampleItems.filter(i => i.is_active).length}</p>
              <p className="text-sm text-slate-500">Active Items</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
              <Package className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">3</p>
              <p className="text-sm text-slate-500">Low Stock</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
              <Tag className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{sampleCategories.length}</p>
              <p className="text-sm text-slate-500">Categories</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">
            Showing {items.length} of {totalItems} items
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" icon={<Upload className="h-4 w-4" />}>
            Import
          </Button>
          <Button variant="secondary" icon={<Download className="h-4 w-4" />}>
            Export
          </Button>
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowDrawer(true)}>
            Add Item
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search items by name, SKU, UPC, EAN..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div className="flex items-center gap-3">
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">All Categories</option>
              {flattenCategories(categories).map((cat) => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
            <button className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
              <Filter className="h-4 w-4" />
              Filters
            </button>
            
            {/* Column Customization */}
            <div className="relative">
              <button 
                onClick={() => setShowColumnSettings(!showColumnSettings)}
                className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition-colors ${
                  showColumnSettings 
                    ? `${currentTheme.accent} text-white border-transparent` 
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Columns3 className="h-4 w-4" />
                Columns
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <Table
          columns={columns}
          data={items}
          loading={loading}
          keyExtractor={(item) => item.id}
          onRowClick={(item) => { setSelectedItem(item); setShowDetail(true); }}
          emptyMessage="No items found. Add your first item to get started."
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

      {/* Comprehensive Add/Edit Item Drawer */}
      <Drawer
        isOpen={showDrawer}
        onClose={() => { setShowDrawer(false); resetForm(); }}
        title={editingItem ? 'Edit Item' : 'New Item'}
        subtitle={editingItem ? `Editing ${editingItem.name}` : 'Add a new item to your catalog'}
        size="xl"
      >
        <form onSubmit={handleSubmit} className="flex h-full flex-col">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Item Type Selection */}
            <div className="flex gap-4 p-4 bg-slate-50 rounded-xl">
              <label className="flex-1 cursor-pointer">
                <input
                  type="radio"
                  name="item_type"
                  value="goods"
                  checked={form.item_type === 'goods'}
                  onChange={() => setForm({ ...form, item_type: 'goods' })}
                  className="sr-only"
                />
                <div className={`flex items-center justify-center gap-3 rounded-xl border-2 p-4 transition-all ${form.item_type === 'goods' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                  <Package className={`h-6 w-6 ${form.item_type === 'goods' ? 'text-blue-600' : 'text-slate-400'}`} />
                  <div>
                    <p className={`font-medium ${form.item_type === 'goods' ? 'text-blue-700' : 'text-slate-700'}`}>Goods</p>
                    <p className="text-xs text-slate-500">Physical products you buy/sell</p>
                  </div>
                </div>
              </label>
              <label className="flex-1 cursor-pointer">
                <input
                  type="radio"
                  name="item_type"
                  value="service"
                  checked={form.item_type === 'service'}
                  onChange={() => setForm({ ...form, item_type: 'service' })}
                  className="sr-only"
                />
                <div className={`flex items-center justify-center gap-3 rounded-xl border-2 p-4 transition-all ${form.item_type === 'service' ? 'border-purple-500 bg-purple-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                  <Wrench className={`h-6 w-6 ${form.item_type === 'service' ? 'text-purple-600' : 'text-slate-400'}`} />
                  <div>
                    <p className={`font-medium ${form.item_type === 'service' ? 'text-purple-700' : 'text-slate-700'}`}>Service</p>
                    <p className="text-xs text-slate-500">Services you provide</p>
                  </div>
                </div>
              </label>
            </div>

            {/* SECTION: Basic Information */}
            <div className="space-y-4">
              {renderSectionHeader(sections[0])}
              {expandedSections.basic && (
                <div className="animate-fade-in space-y-4 rounded-lg border border-slate-200 bg-white p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Input
                        label="Item Name *"
                        placeholder="Enter item name"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="label">SKU *</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="SKU-001"
                          value={form.sku_code}
                          onChange={(e) => setForm({ ...form, sku_code: e.target.value })}
                          className="input flex-1"
                          required
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
                    </div>
                    {renderSelectWithAdd(
                      'Unit',
                      form.primary_unit_id,
                      units.map((u) => ({ value: u.id, label: `${u.name} (${u.symbol})` })),
                      (val) => setForm({ ...form, primary_unit_id: val }),
                      'unit',
                      'Select Unit'
                    )}
                    <div className="col-span-2">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.is_returnable}
                          onChange={(e) => setForm({ ...form, is_returnable: e.target.checked })}
                          className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <span className="font-medium text-slate-700">Returnable Item</span>
                          <p className="text-xs text-slate-500">Allow this item to be returned</p>
                        </div>
                      </label>
                    </div>
                    <div className="col-span-2">
                      <label className="label">Description</label>
                      <textarea
                        placeholder="Enter item description..."
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        rows={3}
                        className="input resize-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SECTION: Product Identifiers */}
            <div className="space-y-4">
              {renderSectionHeader(sections[1])}
              {expandedSections.identifiers && (
                <div className="animate-fade-in space-y-4 rounded-lg border border-slate-200 bg-white p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">UPC (12-digit)</label>
                      <input
                        type="text"
                        placeholder="012345678901"
                        value={form.upc}
                        onChange={(e) => setForm({ ...form, upc: e.target.value })}
                        maxLength={12}
                        className="input"
                      />
                      <p className="mt-1 text-xs text-slate-500">Universal Product Code</p>
                    </div>
                    <div>
                      <label className="label">EAN (13-digit)</label>
                      <input
                        type="text"
                        placeholder="0123456789012"
                        value={form.ean}
                        onChange={(e) => setForm({ ...form, ean: e.target.value })}
                        maxLength={13}
                        className="input"
                      />
                      <p className="mt-1 text-xs text-slate-500">European Article Number</p>
                    </div>
                    <div>
                      <label className="label">MPN</label>
                      <input
                        type="text"
                        placeholder="Manufacturer Part Number"
                        value={form.mpn}
                        onChange={(e) => setForm({ ...form, mpn: e.target.value })}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="label">ISBN</label>
                      <input
                        type="text"
                        placeholder="978-3-16-148410-0"
                        value={form.isbn}
                        onChange={(e) => setForm({ ...form, isbn: e.target.value })}
                        className="input"
                      />
                      <p className="mt-1 text-xs text-slate-500">For books only</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SECTION: Category & Brand */}
            <div className="space-y-4">
              {renderSectionHeader(sections[2])}
              {expandedSections.classification && (
                <div className="animate-fade-in space-y-4 rounded-lg border border-slate-200 bg-white p-4">
                  <div className="grid grid-cols-2 gap-4">
                    {renderSelectWithAdd(
                      'Category',
                      form.category_id,
                      flattenCategories(categories),
                      (val) => setForm({ ...form, category_id: val }),
                      'category',
                      'Select Category'
                    )}
                    {renderSelectWithAdd(
                      'Brand',
                      form.brand,
                      brands.map(b => ({ value: b, label: b })),
                      (val) => setForm({ ...form, brand: val }),
                      'brand',
                      'Select Brand'
                    )}
                    {renderSelectWithAdd(
                      'Manufacturer',
                      form.manufacturer,
                      manufacturers.map(m => ({ value: m, label: m })),
                      (val) => setForm({ ...form, manufacturer: val }),
                      'manufacturer',
                      'Select Manufacturer'
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* SECTION: Dimensions & Weight (for goods only) */}
            {form.item_type === 'goods' && (
              <div className="space-y-4">
                {renderSectionHeader(sections[3])}
                {expandedSections.dimensions && (
                  <div className="animate-fade-in space-y-4 rounded-lg border border-slate-200 bg-white p-4">
                    {/* Weight */}
                    <div>
                      <label className="label">Weight</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={form.weight || ''}
                          onChange={(e) => setForm({ ...form, weight: e.target.value ? Number(e.target.value) : undefined })}
                          className="input w-32"
                        />
                        <select
                          value={form.weight_unit}
                          onChange={(e) => setForm({ ...form, weight_unit: e.target.value })}
                          className="input w-24"
                        >
                          <option value="kg">kg</option>
                          <option value="g">g</option>
                          <option value="lb">lb</option>
                          <option value="oz">oz</option>
                        </select>
                      </div>
                    </div>

                    {/* Dimensions */}
                    <div>
                      <label className="label">Dimensions (L × W × H)</label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Length"
                            value={form.length || ''}
                            onChange={(e) => setForm({ ...form, length: e.target.value ? Number(e.target.value) : undefined })}
                            className="input w-full"
                          />
                        </div>
                        <span className="text-slate-400 font-medium">×</span>
                        <div className="flex-1">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Width"
                            value={form.width || ''}
                            onChange={(e) => setForm({ ...form, width: e.target.value ? Number(e.target.value) : undefined })}
                            className="input w-full"
                          />
                        </div>
                        <span className="text-slate-400 font-medium">×</span>
                        <div className="flex-1">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Height"
                            value={form.height || ''}
                            onChange={(e) => setForm({ ...form, height: e.target.value ? Number(e.target.value) : undefined })}
                            className="input w-full"
                          />
                        </div>
                        <select
                          value={form.dimension_unit}
                          onChange={(e) => setForm({ ...form, dimension_unit: e.target.value })}
                          className="input w-24"
                        >
                          <option value="cm">cm</option>
                          <option value="in">in</option>
                          <option value="m">m</option>
                          <option value="ft">ft</option>
                        </select>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">Enter dimensions in {form.dimension_unit}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SECTION: Sales Information */}
            <div className="space-y-4">
              {renderSectionHeader(sections[4])}
              {expandedSections.sales && (
                <div className="animate-fade-in space-y-4 rounded-lg border border-slate-200 bg-white p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Selling Price</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium pointer-events-none">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={form.selling_rate || ''}
                          onChange={(e) => setForm({ ...form, selling_rate: e.target.value ? Number(e.target.value) : undefined })}
                          className="input pl-10"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="label">MRP</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium pointer-events-none">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={form.mrp || ''}
                          onChange={(e) => setForm({ ...form, mrp: e.target.value ? Number(e.target.value) : undefined })}
                          className="input pl-10"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="label">Sales Account</label>
                      <select
                        value={form.sales_account}
                        onChange={(e) => setForm({ ...form, sales_account: e.target.value })}
                        className="input"
                      >
                        <option value="Sales">Sales</option>
                        <option value="Other Income">Other Income</option>
                        <option value="Interest Income">Interest Income</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Tax Preference</label>
                      <select
                        value={form.tax_type}
                        onChange={(e) => setForm({ ...form, tax_type: e.target.value as 'taxable' | 'tax_exempt' | 'non_taxable' })}
                        className="input"
                      >
                        <option value="taxable">Taxable</option>
                        <option value="tax_exempt">Tax Exempt</option>
                        <option value="non_taxable">Non Taxable</option>
                      </select>
                    </div>
                    {form.tax_type === 'taxable' && (
                      <>
                        <div>
                          <label className="label">Tax Rate (%)</label>
                          <select
                            value={form.tax_rate || ''}
                            onChange={(e) => setForm({ ...form, tax_rate: e.target.value ? Number(e.target.value) : undefined })}
                            className="input"
                          >
                            <option value="">Select Tax Rate</option>
                            <option value="0">0% - Nil</option>
                            <option value="5">5%</option>
                            <option value="12">12%</option>
                            <option value="18">18%</option>
                            <option value="28">28%</option>
                          </select>
                        </div>
                        <div>
                          <label className="label">HSN/SAC Code</label>
                          <input
                            type="text"
                            placeholder="Enter HSN/SAC code"
                            value={form.hsn_code}
                            onChange={(e) => setForm({ ...form, hsn_code: e.target.value })}
                            className="input"
                          />
                        </div>
                      </>
                    )}
                    <div className="col-span-2">
                      <label className="label">Sales Description</label>
                      <textarea
                        placeholder="Description to appear on sales invoices..."
                        value={form.sales_description}
                        onChange={(e) => setForm({ ...form, sales_description: e.target.value })}
                        rows={2}
                        className="input resize-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SECTION: Purchase Information */}
            <div className="space-y-4">
              {renderSectionHeader(sections[5])}
              {expandedSections.purchase && (
                <div className="animate-fade-in space-y-4 rounded-lg border border-slate-200 bg-white p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Cost Price</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium pointer-events-none">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={form.purchase_rate || ''}
                          onChange={(e) => setForm({ ...form, purchase_rate: e.target.value ? Number(e.target.value) : undefined })}
                          className="input pl-10"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="label">Purchase Account</label>
                      <select
                        value={form.purchase_account}
                        onChange={(e) => setForm({ ...form, purchase_account: e.target.value })}
                        className="input"
                      >
                        <option value="Cost of Goods Sold">Cost of Goods Sold</option>
                        <option value="Inventory Asset">Inventory Asset</option>
                        <option value="Expense">Expense</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Preferred Vendor</label>
                      <select
                        value={form.preferred_vendor}
                        onChange={(e) => setForm({ ...form, preferred_vendor: e.target.value })}
                        className="input"
                      >
                        <option value="">Select Vendor</option>
                        <option value="vendor1">ABC Suppliers</option>
                        <option value="vendor2">XYZ Trading</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Reorder Point</label>
                      <input
                        type="number"
                        placeholder="10"
                        value={form.reorder_level || ''}
                        onChange={(e) => setForm({ ...form, reorder_level: e.target.value ? Number(e.target.value) : undefined })}
                        className="input"
                      />
                      <p className="mt-1 text-xs text-slate-500">Get notified when stock falls below</p>
                    </div>
                    <div className="col-span-2">
                      <label className="label">Purchase Description</label>
                      <textarea
                        placeholder="Description to appear on purchase orders..."
                        value={form.purchase_description}
                        onChange={(e) => setForm({ ...form, purchase_description: e.target.value })}
                        rows={2}
                        className="input resize-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SECTION: Inventory Tracking (for goods only) */}
            {form.item_type === 'goods' && (
              <div className="space-y-4">
                {renderSectionHeader(sections[6])}
                {expandedSections.inventory && (
                  <div className="animate-fade-in space-y-4 rounded-lg border border-slate-200 bg-white p-4">
                    <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg bg-slate-50">
                      <input
                        type="checkbox"
                        checked={form.track_inventory}
                        onChange={(e) => setForm({ ...form, track_inventory: e.target.checked })}
                        className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="font-medium text-slate-700">Track Inventory for this item</span>
                        <p className="text-xs text-slate-500">You will be able to record stock adjustments</p>
                      </div>
                    </label>
                    
                    {form.track_inventory && (
                      <>
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                          <div>
                            <label className="label">Opening Stock</label>
                            <input
                              type="number"
                              placeholder="0"
                              value={form.opening_stock || ''}
                              onChange={(e) => setForm({ ...form, opening_stock: e.target.value ? Number(e.target.value) : undefined })}
                              className="input"
                            />
                          </div>
                          <div>
                            <label className="label">Opening Stock Rate per Unit</label>
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium pointer-events-none">₹</span>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={form.opening_stock_rate || ''}
                                onChange={(e) => setForm({ ...form, opening_stock_rate: e.target.value ? Number(e.target.value) : undefined })}
                                className="input pl-10"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3 pt-4 border-t border-slate-100">
                          <p className="text-sm font-medium text-slate-700">Advanced Tracking</p>
                          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-slate-50 transition-colors">
                            <input
                              type="checkbox"
                              checked={form.track_batches}
                              onChange={(e) => setForm({ ...form, track_batches: e.target.checked })}
                              className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <div>
                              <span className="font-medium text-slate-700">Track Batches</span>
                              <p className="text-xs text-slate-500">Track inventory by batch/lot numbers</p>
                            </div>
                          </label>
                          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-slate-50 transition-colors">
                            <input
                              type="checkbox"
                              checked={form.track_serials}
                              onChange={(e) => setForm({ ...form, track_serials: e.target.checked })}
                              className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <div>
                              <span className="font-medium text-slate-700">Track Serial Numbers</span>
                              <p className="text-xs text-slate-500">Track individual items by unique serial number</p>
                            </div>
                          </label>
                          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-slate-50 transition-colors">
                            <input
                              type="checkbox"
                              checked={form.track_expiry}
                              onChange={(e) => setForm({ ...form, track_expiry: e.target.checked })}
                              className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <div>
                              <span className="font-medium text-slate-700">Track Expiry Dates</span>
                              <p className="text-xs text-slate-500">For perishable goods with expiration dates</p>
                            </div>
                          </label>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* SECTION: Images */}
            <div className="space-y-4">
              {renderSectionHeader(sections[7])}
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
                    Upload up to 15 images. Formats: JPG, PNG, GIF. Max size: 5MB each.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
            <div className="text-sm text-slate-500">
              <span className="text-red-500">*</span> Required fields
            </div>
            <div className="flex items-center gap-3">
              <Button type="button" variant="secondary" onClick={() => { setShowDrawer(false); resetForm(); }}>
                Cancel
              </Button>
              <Button type="submit" loading={formLoading}>
                {editingItem ? 'Update Item' : 'Save Item'}
              </Button>
            </div>
          </div>
        </form>
      </Drawer>

      {/* Inline Add Modal */}
      <Modal
        isOpen={!!inlineAddType}
        onClose={() => { setInlineAddType(null); setInlineAddValue(''); setInlineAddParent(''); setInlineUnitSymbol(''); }}
        title={`Add New ${inlineAddType?.charAt(0).toUpperCase()}${inlineAddType?.slice(1) || ''}`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setInlineAddType(null); setInlineAddValue(''); setInlineUnitSymbol(''); }}>
              Cancel
            </Button>
            <Button onClick={handleInlineAdd} icon={<Check className="h-4 w-4" />}>
              Add
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label={`${inlineAddType?.charAt(0).toUpperCase()}${inlineAddType?.slice(1) || ''} Name`}
            placeholder={`Enter ${inlineAddType} name`}
            value={inlineAddValue}
            onChange={(e) => setInlineAddValue(e.target.value)}
            autoFocus
          />
          {inlineAddType === 'category' && (
            <div>
              <label className="label">Parent Category (Optional)</label>
              <select
                value={inlineAddParent}
                onChange={(e) => setInlineAddParent(e.target.value)}
                className="input"
              >
                <option value="">No Parent (Root Category)</option>
                {flattenCategories(categories).map((cat) => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
          )}
          {inlineAddType === 'unit' && (
            <Input
              label="Symbol / Abbreviation *"
              placeholder="e.g., pcs, kg, m"
              value={inlineUnitSymbol}
              onChange={(e) => setInlineUnitSymbol(e.target.value)}
            />
          )}
        </div>
      </Modal>

      {/* Detail Slide-over */}
      {showDetail && selectedItem && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDetail(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-lg animate-slide-in-right bg-white shadow-2xl">
            <div className="flex h-full flex-col">
              <div className={`flex items-center justify-between border-b border-slate-100 bg-gradient-to-r ${currentTheme.sidebar.bg} px-6 py-4`}>
                <h2 className="text-lg font-semibold text-white">Item Details</h2>
                <button
                  onClick={() => setShowDetail(false)}
                  className="rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <div className="mb-6 flex items-center gap-4">
                  <div className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${currentTheme.sidebar.logoAccent} text-white`}>
                    <Package className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-800">{selectedItem.name}</h3>
                    <p className="text-slate-500">SKU: {selectedItem.sku_code}</p>
                  </div>
                </div>
                
                <div className="space-y-6">
                  <div>
                    <h4 className="mb-3 text-sm font-semibold text-slate-500 uppercase">Pricing</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">Cost</p>
                        <p className="text-lg font-semibold text-slate-800">
                          ₹{selectedItem.purchase_rate?.toLocaleString() || '-'}
                        </p>
                      </div>
                      <div className={`rounded-lg ${currentTheme.accentLight} p-3`}>
                        <p className="text-xs">Selling</p>
                        <p className="text-lg font-semibold">
                          ₹{selectedItem.selling_rate?.toLocaleString() || '-'}
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">MRP</p>
                        <p className="text-lg font-semibold text-slate-800">
                          ₹{selectedItem.mrp?.toLocaleString() || '-'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="mb-3 text-sm font-semibold text-slate-500 uppercase">Details</h4>
                    <dl className="space-y-3">
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Category</dt>
                        <dd className="font-medium text-slate-800">{selectedItem.category_name || '-'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Unit</dt>
                        <dd className="font-medium text-slate-800">{selectedItem.primary_unit_name || '-'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">HSN Code</dt>
                        <dd className="font-medium text-slate-800">{selectedItem.hsn_code || '-'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Tax Rate</dt>
                        <dd className="font-medium text-slate-800">{selectedItem.tax_rate ? `${selectedItem.tax_rate}%` : '-'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Reorder Level</dt>
                        <dd className="font-medium text-slate-800">{selectedItem.reorder_level || '-'}</dd>
                      </div>
                    </dl>
                  </div>

                  <div>
                    <h4 className="mb-3 text-sm font-semibold text-slate-500 uppercase">Tracking</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedItem.track_batches && (
                        <span className="badge badge-info">Batch Tracking</span>
                      )}
                      {selectedItem.track_serials && (
                        <span className="badge badge-info">Serial Tracking</span>
                      )}
                      {selectedItem.track_expiry && (
                        <span className="badge badge-info">Expiry Tracking</span>
                      )}
                      {!selectedItem.track_batches && !selectedItem.track_serials && !selectedItem.track_expiry && (
                        <span className="text-sm text-slate-500">No special tracking enabled</span>
                      )}
                    </div>
                  </div>

                  {selectedItem.description && (
                    <div>
                      <h4 className="mb-3 text-sm font-semibold text-slate-500 uppercase">Description</h4>
                      <p className="text-slate-700">{selectedItem.description}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 border-t border-slate-100 p-6">
                <Button variant="secondary" className="flex-1" onClick={() => openEdit(selectedItem)}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button variant="danger" onClick={() => { setDeleteItem(selectedItem); setShowDetail(false); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <Modal
        isOpen={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        title="Delete Item"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteItem(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-slate-600">
          Are you sure you want to delete <strong>{deleteItem?.name}</strong>? This action cannot be undone.
        </p>
      </Modal>

      {/* Column Settings Modal (Portal-style for proper z-index) */}
      {showColumnSettings && (
        <div className="fixed inset-0 z-[100]">
          {/* Backdrop */}
          <div 
            className="absolute inset-0" 
            onClick={() => setShowColumnSettings(false)} 
          />
          {/* Dropdown positioned near the button */}
          <div 
            className="absolute right-8 top-40 w-72 animate-scale-in rounded-xl border border-slate-200 bg-white shadow-2xl"
            style={{ maxHeight: 'calc(100vh - 200px)' }}
          >
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Customize Columns</p>
                  <p className="text-xs text-slate-500">Toggle columns on/off</p>
                </div>
                <button
                  onClick={() => setShowColumnSettings(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="py-2 max-h-80 overflow-y-auto">
              {allColumns.filter(col => col.label).map((col) => (
                <label
                  key={col.visibilityKey}
                  className={`flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors ${
                    col.required ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <div className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={col.required || visibleColumns[col.visibilityKey]}
                      onChange={() => !col.required && toggleColumn(col.visibilityKey)}
                      disabled={col.required}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </div>
                  <GripVertical className="h-4 w-4 text-slate-300" />
                  <span className="text-sm text-slate-700 flex-1">{col.label}</span>
                  {col.required && (
                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">Required</span>
                  )}
                </label>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 rounded-b-xl flex items-center justify-between">
              <button
                onClick={() => {
                  setVisibleColumns({
                    name: true, sku: true, category: true, stock: true,
                    cost: true, price: true, tax: true, status: true,
                  });
                }}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Reset to Default
              </button>
              <button
                onClick={() => setShowColumnSettings(false)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium text-white ${currentTheme.accent} ${currentTheme.accentHover}`}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
