import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { Modal } from '../../components/common/Modal.js';
import { ActionMenu } from '../../components/common/ActionMenu.js';
import {
  Utensils,
  Plus,
  Search,
  Edit2,
  Trash2,
  Tag,
  Layers,
  Check,
  Scale,
  TrendingUp,
  AlertCircle,
  Eye,
  Percent,
  DollarSign,
  ChefHat,
  X,
  FileText,
  FolderTree,
  Sliders,
  Sparkles,
  Copy,
  Power,
  Package,
  Printer,
  Barcode,
  List,
  LayoutGrid,
  Download,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  Filter,
  ArrowUpDown,
  Flame,
} from 'lucide-react';
import { PrepStation } from '@pos/shared';

export const MenuCatalog: React.FC = () => {
  const { tenant } = useAuth();
  const { success, error } = useToast();

  const [activeTab, setActiveTab] = useState<'PRODUCTS' | 'CATEGORIES' | 'MODIFIERS'>('PRODUCTS');
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [modifierGroups, setModifierGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // View and Filter State
  const [viewMode, setViewMode] = useState<'TABLE' | 'GRID'>('TABLE');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedSubCategory, setSelectedSubCategory] = useState('ALL');
  const [selectedStation, setSelectedStation] = useState<string>('ALL');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'IN_STOCK' | 'OUT_OF_STOCK' | 'WITH_RECIPE' | 'NO_RECIPE'>('ALL');

  // Modals State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);

  const [isModifierModalOpen, setIsModifierModalOpen] = useState(false);
  const [editingModifierGroup, setEditingModifierGroup] = useState<any | null>(null);

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [viewingRecipeProduct, setViewingRecipeProduct] = useState<any | null>(null);
  const [previewProduct, setPreviewProduct] = useState<any | null>(null);

  // Print Modals State
  const [printingBarcodeProduct, setPrintingBarcodeProduct] = useState<any | null>(null);
  const [printingSpecProduct, setPrintingSpecProduct] = useState<any | null>(null);
  const [isPrintMenuModalOpen, setIsPrintMenuModalOpen] = useState(false);
  const [labelCopies, setLabelCopies] = useState<number>(1);
  const [labelFormat, setLabelFormat] = useState<'SHELF_TAG' | 'STICKER'>('SHELF_TAG');

  // Category Form (Supports Sub-Categories via parentId)
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    nameUrdu: '',
    sortOrder: 0,
    parentId: '' as string | null,
  });

  // Modifier / Addon Group Form
  const [modifierForm, setModifierForm] = useState({
    name: '',
    nameUrdu: '',
    minSelect: 0,
    maxSelect: 5,
    isRequired: false,
    options: [
      { name: 'Extra Garlic Mayo Sauce', price: 50, isDefault: false },
      { name: 'Extra Cheese Slice', price: 70, isDefault: false },
    ],
  });

  // Product Form with Recipe, Ingredients & Addons
  const [productForm, setProductForm] = useState({
    name: '',
    nameUrdu: '',
    categoryId: '',
    subCategoryId: '' as string | null,
    sku: '',
    barcode: '',
    basePrice: 500,
    costPrice: 0,
    station: PrepStation.KITCHEN,
    trackInventory: true,
    modifierGroupIds: [] as string[],
    recipe: {
      yieldCount: 1,
      ingredients: [] as Array<{ ingredientId: string; quantity: number; unit: string }>,
    },
  });

  const currencySymbol = tenant?.currency_symbol || 'Rs.';

  const fetchData = async () => {
    try {
      const [catsRes, prodsRes, ingsRes, modsRes] = await Promise.all([
        api.get('/menu/categories'),
        api.get('/menu/products'),
        api.get('/inventory/ingredients'),
        api.get('/menu/modifiers'),
      ]);
      setCategories(catsRes.categories || []);
      setProducts(prodsRes.products || []);
      setIngredients(ingsRes.ingredients || []);
      setModifierGroups(modsRes.modifierGroups || []);

      if (catsRes.categories?.length > 0 && !productForm.categoryId) {
        setProductForm((prev) => ({ ...prev, categoryId: catsRes.categories[0].id }));
      }
    } catch (err: any) {
      console.error('Failed to load menu data:', err);
      error(err.message || 'Failed to load menu data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Category Handlers
  const handleOpenCreateCategory = () => {
    setEditingCategory(null);
    setCategoryForm({ name: '', nameUrdu: '', sortOrder: 0, parentId: '' });
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: any) => {
    setEditingCategory(cat);
    setCategoryForm({
      name: cat.name,
      nameUrdu: cat.name_urdu || '',
      sortOrder: cat.sort_order || 0,
      parentId: cat.parent_id || '',
    });
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: categoryForm.name,
        nameUrdu: categoryForm.nameUrdu || undefined,
        sortOrder: Number(categoryForm.sortOrder || 0),
        parentId: categoryForm.parentId || null,
      };

      if (editingCategory) {
        await api.put(`/menu/categories/${editingCategory.id}`, payload);
        success('Category updated successfully');
      } else {
        await api.post('/menu/categories', payload);
        success('Category created successfully');
      }
      setIsCategoryModalOpen(false);
      setCategoryForm({ name: '', nameUrdu: '', sortOrder: 0, parentId: '' });
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to save category');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this category?')) return;
    try {
      await api.delete(`/menu/categories/${id}`);
      success('Category deleted successfully');
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to delete category');
    }
  };

  // Modifier / Addon Group Handlers
  const handleOpenCreateModifier = () => {
    setEditingModifierGroup(null);
    setModifierForm({
      name: '',
      nameUrdu: '',
      minSelect: 0,
      maxSelect: 5,
      isRequired: false,
      options: [
        { name: 'Extra Garlic Mayo Sauce', price: 50, isDefault: false },
      ],
    });
    setIsModifierModalOpen(true);
  };

  const handleOpenEditModifier = (group: any) => {
    setEditingModifierGroup(group);
    let parsedOpts = [];
    try {
      parsedOpts = Array.isArray(group.options) ? group.options : JSON.parse(group.options || '[]');
    } catch (_) {
      parsedOpts = [];
    }

    setModifierForm({
      name: group.name,
      nameUrdu: group.name_urdu || '',
      minSelect: group.min_select || 0,
      maxSelect: group.max_select || 5,
      isRequired: group.is_required || false,
      options: parsedOpts.map((opt: any) => ({
        name: opt.name,
        price: Number(opt.price || 0),
        isDefault: Boolean(opt.isDefault),
      })),
    });
    setIsModifierModalOpen(true);
  };

  const handleSaveModifierGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modifierForm.options.length === 0) {
      error('Please add at least one addon option');
      return;
    }

    try {
      const payload = {
        name: modifierForm.name,
        nameUrdu: modifierForm.nameUrdu || undefined,
        minSelect: Number(modifierForm.minSelect || 0),
        maxSelect: Number(modifierForm.maxSelect || 5),
        isRequired: Boolean(modifierForm.isRequired),
        options: modifierForm.options.map((opt) => ({
          name: opt.name,
          price: Number(opt.price || 0),
          isDefault: Boolean(opt.isDefault),
        })),
      };

      if (editingModifierGroup) {
        await api.put(`/menu/modifiers/${editingModifierGroup.id}`, payload);
        success('Addon group updated successfully');
      } else {
        await api.post('/menu/modifiers', payload);
        success('Addon group created successfully');
      }
      setIsModifierModalOpen(false);
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to save addon group');
    }
  };

  const handleDeleteModifierGroup = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this addon group?')) return;
    try {
      await api.delete(`/menu/modifiers/${id}`);
      success('Addon group deleted successfully');
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to delete addon group');
    }
  };

  // Modifier Options Dynamic Rows
  const addModifierOption = () => {
    setModifierForm({
      ...modifierForm,
      options: [...modifierForm.options, { name: '', price: 0, isDefault: false }],
    });
  };

  const removeModifierOption = (index: number) => {
    setModifierForm({
      ...modifierForm,
      options: modifierForm.options.filter((_, idx) => idx !== index),
    });
  };

  const updateModifierOption = (index: number, field: string, value: any) => {
    const updated = [...modifierForm.options];
    updated[index] = { ...updated[index], [field]: value };
    setModifierForm({ ...modifierForm, options: updated });
  };

  // Product Handlers
  const handleOpenCreateProduct = () => {
    setEditingProduct(null);
    setProductForm({
      name: '',
      nameUrdu: '',
      categoryId: categories[0]?.id || '',
      subCategoryId: '',
      sku: `PROD-${Date.now().toString().slice(-4)}`,
      barcode: '',
      basePrice: 500,
      costPrice: 0,
      station: PrepStation.KITCHEN,
      trackInventory: true,
      modifierGroupIds: [],
      recipe: { yieldCount: 1, ingredients: [] },
    });
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (prod: any) => {
    setEditingProduct(prod);
    setProductForm({
      name: prod.name,
      nameUrdu: prod.name_urdu || '',
      categoryId: prod.category_id,
      subCategoryId: prod.sub_category_id || '',
      sku: prod.sku,
      barcode: prod.barcode || '',
      basePrice: Number(prod.base_price),
      costPrice: Number(prod.cost_price || 0),
      station: prod.station || PrepStation.KITCHEN,
      trackInventory: prod.track_inventory !== false,
      modifierGroupIds: prod.modifierGroups ? prod.modifierGroups.map((mg: any) => mg.id) : [],
      recipe: {
        yieldCount: prod.recipe?.yieldCount || 1,
        ingredients:
          prod.recipe?.ingredients?.map((ri: any) => ({
            ingredientId: ri.ingredientId,
            quantity: ri.quantity,
            unit: ri.unit,
          })) || [],
      },
    });
    setIsProductModalOpen(true);
  };

  // Recipe Builder Helpers inside Product Modal
  const addRecipeIngredient = () => {
    if (ingredients.length === 0) {
      error('No inventory ingredients available. Create ingredients in Inventory first.');
      return;
    }
    const defaultIng = ingredients[0];
    setProductForm({
      ...productForm,
      recipe: {
        ...productForm.recipe,
        ingredients: [
          ...productForm.recipe.ingredients,
          { ingredientId: defaultIng.id, quantity: 1, unit: defaultIng.unit },
        ],
      },
    });
  };

  const removeRecipeIngredient = (index: number) => {
    setProductForm({
      ...productForm,
      recipe: {
        ...productForm.recipe,
        ingredients: productForm.recipe.ingredients.filter((_, idx) => idx !== index),
      },
    });
  };

  const updateRecipeIngredient = (index: number, field: string, value: any) => {
    const updated = [...productForm.recipe.ingredients];
    if (field === 'ingredientId') {
      const ing = ingredients.find((i) => i.id === value);
      updated[index] = {
        ...updated[index],
        ingredientId: value,
        unit: ing ? ing.unit : updated[index].unit,
      };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setProductForm({
      ...productForm,
      recipe: {
        ...productForm.recipe,
        ingredients: updated,
      },
    });
  };

  // Compute live estimated recipe cost in modal
  const modalCalculatedCost = productForm.recipe.ingredients.reduce((acc, it) => {
    const ing = ingredients.find((i) => i.id === it.ingredientId);
    const unitCost = ing ? Number(ing.cost_per_unit || 0) : 0;
    return acc + (Number(it.quantity) || 0) * unitCost;
  }, 0) / (Number(productForm.recipe.yieldCount) || 1);

  // Effective cost price: manual input if set (>0), otherwise fallback to calculated recipe cost
  const effectiveCostPrice = Number(productForm.costPrice) > 0
    ? Number(productForm.costPrice)
    : modalCalculatedCost;

  const modalBasePrice = Number(productForm.basePrice || 0);
  const modalGrossProfit = Math.max(0, modalBasePrice - effectiveCostPrice);
  const modalGrossMarginPercent = modalBasePrice > 0
    ? Math.round((modalGrossProfit / modalBasePrice) * 100)
    : 0;

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        categoryId: productForm.categoryId,
        subCategoryId: productForm.subCategoryId || null,
        name: productForm.name,
        nameUrdu: productForm.nameUrdu || undefined,
        sku: productForm.sku,
        barcode: productForm.barcode || undefined,
        basePrice: Number(productForm.basePrice),
        costPrice: Number(productForm.costPrice) > 0
          ? Number(productForm.costPrice)
          : (modalCalculatedCost > 0 ? Number(modalCalculatedCost.toFixed(2)) : 0),
        station: productForm.station,
        trackInventory: productForm.trackInventory,
        modifierGroupIds: productForm.modifierGroupIds,
      };

      if (editingProduct) {
        await api.put(`/menu/products/${editingProduct.id}`, payload);

        // Save recipe if ingredients exist
        if (productForm.recipe.ingredients.length > 0) {
          await api.post('/inventory/recipes', {
            productId: editingProduct.id,
            yieldCount: productForm.recipe.yieldCount,
            ingredients: productForm.recipe.ingredients,
          });
        }
        success('Product and recipe updated successfully');
      } else {
        if (productForm.recipe.ingredients.length > 0) {
          payload.recipe = productForm.recipe;
        }
        await api.post('/menu/products', payload);
        success('Product created with recipe successfully');
      }

      setIsProductModalOpen(false);
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to save product');
    }
  };

  // Duplicate Product
  const handleDuplicateProduct = (prod: any) => {
    setEditingProduct(null);
    setProductForm({
      name: `${prod.name} (Copy)`,
      nameUrdu: '',
      categoryId: prod.category_id,
      subCategoryId: prod.sub_category_id || '',
      sku: `PROD-${Date.now().toString().slice(-4)}`,
      barcode: '',
      basePrice: Number(prod.base_price),
      costPrice: Number(prod.cost_price || 0),
      station: prod.station || PrepStation.KITCHEN,
      trackInventory: prod.track_inventory !== false,
      modifierGroupIds: prod.modifierGroups ? prod.modifierGroups.map((mg: any) => mg.id) : [],
      recipe: {
        yieldCount: prod.recipe?.yieldCount || 1,
        ingredients:
          prod.recipe?.ingredients?.map((ri: any) => ({
            ingredientId: ri.ingredientId,
            quantity: ri.quantity,
            unit: ri.unit,
          })) || [],
      },
    });
    setIsProductModalOpen(true);
    success(`Duplicating "${prod.name}". Adjust any fields and click Save.`);
  };

  // Toggle Availability (In Stock vs 86'd)
  const handleToggleAvailability = async (prod: any) => {
    try {
      const newStatus = prod.is_available === false;
      await api.put(`/menu/products/${prod.id}`, { isAvailable: newStatus });
      success(`"${prod.name}" marked as ${newStatus ? 'In Stock (Available)' : 'Out of Stock (86\'d)'}`);
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to update product availability');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete/archive this product?')) return;
    try {
      await api.delete(`/menu/products/${id}`);
      success('Product removed successfully');
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to remove product');
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    if (products.length === 0) {
      error('No products available to export');
      return;
    }

    const headers = [
      'Product Name',
      'SKU',
      'Barcode',
      'Category',
      'Prep Station',
      'Selling Price',
      'Cost Price',
      'Gross Profit',
      'Margin %',
      'Status',
      'Inventory Tracked',
      'Addons Count',
    ];

    const rows = products.map((p) => {
      const base = Number(p.base_price || 0);
      const cost = Number(p.cost_price || p.calculatedCost || 0);
      const profit = Math.max(0, base - cost);
      const margin = base > 0 ? Math.round((profit / base) * 100) : 0;
      const status = p.is_available === false ? 'Out of Stock (86)' : 'In Stock';
      const addons = p.modifierGroups?.length || 0;

      return [
        `"${p.name.replace(/"/g, '""')}"`,
        `"${(p.name_urdu || '').replace(/"/g, '""')}"`,
        `"${p.sku || ''}"`,
        `"${p.barcode || ''}"`,
        `"${(p.category_name || '').replace(/"/g, '""')}"`,
        `"${p.station || 'KITCHEN'}"`,
        base,
        cost.toFixed(2),
        profit.toFixed(2),
        `${margin}%`,
        `"${status}"`,
        p.track_inventory !== false ? 'YES' : 'NO',
        addons,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `menu_catalog_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    success('Menu catalog CSV exported successfully');
  };

  // Filter products by search, category, sub-category, station, and stock filter
  const filteredProducts = products.filter((p) => {
    const q = search.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(q) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.barcode && p.barcode.toLowerCase().includes(q)) ;

    let matchesCategory = true;
    if (selectedCategory !== 'ALL') {
      const selectedCat = categories.find((c) => c.id === selectedCategory);
      if (selectedCat) {
        const subCatIds = categories.filter((c) => c.parent_id === selectedCategory).map((c) => c.id);
        matchesCategory = p.category_id === selectedCategory || subCatIds.includes(p.category_id);
      }
    }

    let matchesSubCategory = true;
    if (selectedSubCategory !== 'ALL') {
      matchesSubCategory = p.category_id === selectedSubCategory || p.sub_category_id === selectedSubCategory;
    }

    let matchesStation = true;
    if (selectedStation !== 'ALL') {
      matchesStation = p.station === selectedStation;
    }

    let matchesStock = true;
    if (stockFilter === 'IN_STOCK') {
      matchesStock = p.is_available !== false;
    } else if (stockFilter === 'OUT_OF_STOCK') {
      matchesStock = p.is_available === false;
    } else if (stockFilter === 'WITH_RECIPE') {
      matchesStock = Boolean(p.recipe?.ingredients?.length > 0 || p.cost_price > 0);
    } else if (stockFilter === 'NO_RECIPE') {
      matchesStock = !p.recipe || !p.recipe.ingredients || p.recipe.ingredients.length === 0;
    }

    return matchesSearch && matchesCategory && matchesSubCategory && matchesStation && matchesStock;
  });

  // Calculate Executive Stats
  const totalProductsCount = products.length;
  const inStockCount = products.filter((p) => p.is_available !== false).length;
  const outOfStockCount = products.filter((p) => p.is_available === false).length;
  const withRecipeCount = products.filter((p) => p.recipe?.ingredients?.length > 0).length;

  const validMarginProducts = products.filter((p) => Number(p.base_price) > 0);
  const avgMargin = validMarginProducts.length > 0
    ? Math.round(
        validMarginProducts.reduce((acc, p) => {
          const base = Number(p.base_price);
          const cost = Number(p.cost_price || p.calculatedCost || 0);
          const margin = Math.max(0, ((base - cost) / base) * 100);
          return acc + margin;
        }, 0) / validMarginProducts.length
      )
    : 0;

  // Active subcategories for selected main category
  const activeSubCategories = selectedCategory !== 'ALL'
    ? categories.filter((c) => c.parent_id === selectedCategory)
    : [];

  return (
    <div className="space-y-6 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-500 to-amber-500 flex items-center justify-center text-white shadow-md">
              <Utensils className="w-5 h-5" />
            </div>
            <span>Menu Catalog & Engineering</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Organize main & sub-categories, configure item add-ons & extra sauces, and track exact recipe gross margins.
          </p>
        </div>

        {/* Global Catalog Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsPrintMenuModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold shadow-sm transition-all"
            title="Preview and Print Customer Restaurant Menu"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print Menu</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold shadow-sm transition-all"
            title="Download CSV spreadsheet of entire catalog"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export CSV</span>
          </button>

          {activeTab === 'PRODUCTS' ? (
            <button
              onClick={handleOpenCreateProduct}
              className="flex items-center space-x-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/20 transition-all shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>New Product</span>
            </button>
          ) : activeTab === 'CATEGORIES' ? (
            <button
              onClick={handleOpenCreateCategory}
              className="flex items-center space-x-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/20 transition-all shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>New Category</span>
            </button>
          ) : (
            <button
              onClick={handleOpenCreateModifier}
              className="flex items-center space-x-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/20 transition-all shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>New Addon Group</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Module Tabs Switcher */}
      <div className="flex p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80 max-w-fit">
        <button
          onClick={() => setActiveTab('PRODUCTS')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'PRODUCTS'
              ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Utensils className="w-4 h-4" />
          <span>Products & Recipes ({products.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('CATEGORIES')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'CATEGORIES'
              ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <FolderTree className="w-4 h-4" />
          <span>Categories & Sub-Categories ({categories.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('MODIFIERS')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'MODIFIERS'
              ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>Addons & Extra Sauces ({modifierGroups.length})</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: MENU PRODUCTS & RECIPE MARGINS */}
      {/* ======================================================== */}
      {activeTab === 'PRODUCTS' && (
        <div className="space-y-4">
          {/* Executive Stats Bar (Like Toast POS / Square) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">Total Menu Items</span>
                <Package className="w-4 h-4 text-brand-500" />
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-black text-slate-900 dark:text-white">{totalProductsCount}</span>
                <span className="text-[11px] font-bold text-slate-400">({categories.length} categories)</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">In-Stock & Ready</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{inStockCount}</span>
                <span className="text-[11px] font-bold text-emerald-600/70">Available in POS</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">86'd / Out of Stock</span>
                <XCircle className="w-4 h-4 text-rose-500" />
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-black text-rose-600 dark:text-rose-400">{outOfStockCount}</span>
                <span className="text-[11px] font-bold text-rose-500/80">Hidden at POS</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">Avg Menu Margin</span>
                <TrendingUp className="w-4 h-4 text-brand-500" />
              </div>
              <div className="flex items-baseline space-x-2">
                <span className={`text-2xl font-black ${
                  avgMargin >= 50 ? 'text-emerald-600 dark:text-emerald-400' : avgMargin >= 25 ? 'text-amber-600' : 'text-slate-900 dark:text-white'
                }`}>
                  {avgMargin}%
                </span>
                <span className="text-[11px] font-bold text-slate-400">({withRecipeCount} recipes tracked)</span>
              </div>
            </div>
          </div>

          {/* Controls Bar: Search, Filters & View Mode Toggle */}
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search products by name, SKU, or barcode..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Station Filter, Stock Filter & View Mode */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Station Filter */}
                <select
                  value={selectedStation}
                  onChange={(e) => setSelectedStation(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl px-3 py-2 focus:ring-2 focus:ring-brand-500"
                >
                  <option value="ALL">All Stations</option>
                  <option value={PrepStation.KITCHEN}>Kitchen Station</option>
                  <option value={PrepStation.DRINKS}>Beverage Bar / Drinks</option>
                  <option value={PrepStation.BBQ}>Live BBQ / Grill</option>
                  <option value={PrepStation.DESSERTS}>Dessert Section</option>
                  <option value={PrepStation.PACKAGING}>Packaging / Counter</option>
                </select>

                {/* Stock / Recipe Filter */}
                <select
                  value={stockFilter}
                  onChange={(e) => setStockFilter(e.target.value as any)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl px-3 py-2 focus:ring-2 focus:ring-brand-500"
                >
                  <option value="ALL">All Stock Statuses</option>
                  <option value="IN_STOCK">In Stock Only</option>
                  <option value="OUT_OF_STOCK">86'd / Out of Stock Only</option>
                  <option value="WITH_RECIPE">With Recipe Configured</option>
                  <option value="NO_RECIPE">Missing Recipe</option>
                </select>

                {/* View Switcher: Table vs Grid */}
                <div className="flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <button
                    onClick={() => setViewMode('TABLE')}
                    className={`p-1.5 rounded-lg transition-all ${
                      viewMode === 'TABLE'
                        ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                    title="Table / List View"
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('GRID')}
                    className={`p-1.5 rounded-lg transition-all ${
                      viewMode === 'GRID'
                        ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                    title="Card / Grid View"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Category Pills Strip */}
            <div className="flex items-center space-x-1.5 overflow-x-auto text-xs font-bold pt-1 pb-0.5 scrollbar-thin">
              <button
                onClick={() => {
                  setSelectedCategory('ALL');
                  setSelectedSubCategory('ALL');
                }}
                className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                  selectedCategory === 'ALL'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                All Products ({products.length})
              </button>
              {categories
                .filter((c) => !c.parent_id)
                .map((c) => {
                  const catCount = products.filter(
                    (p) =>
                      p.category_id === c.id ||
                      categories.filter((sub) => sub.parent_id === c.id).some((sub) => sub.id === p.category_id)
                  ).length;
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        setSelectedCategory(c.id);
                        setSelectedSubCategory('ALL');
                      }}
                      className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center space-x-1.5 ${
                        selectedCategory === c.id
                          ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span>{c.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        selectedCategory === c.id ? 'bg-white/20 text-white dark:bg-black/20 dark:text-black' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                      }`}>
                        {catCount}
                      </span>
                    </button>
                  );
                })}
            </div>

            {/* Nested Sub-Categories Pills if available */}
            {activeSubCategories.length > 0 && (
              <div className="flex items-center space-x-1.5 overflow-x-auto text-[11px] font-semibold pt-1 border-t border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-400 pl-1">Subcategories:</span>
                <button
                  onClick={() => setSelectedSubCategory('ALL')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    selectedSubCategory === 'ALL'
                      ? 'bg-brand-500 text-white font-bold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  All Subcategories
                </button>
                {activeSubCategories.map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => setSelectedSubCategory(sub.id)}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      selectedSubCategory === sub.id
                        ? 'bg-brand-500 text-white font-bold'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    ↳ {sub.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* VIEW MODE 1: MODERN PRODUCTS DATA TABLE */}
          {viewMode === 'TABLE' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Menu Item</th>
                      <th className="px-4 py-3">Category & Subcategory</th>
                      <th className="px-4 py-3">Station</th>
                      <th className="px-4 py-3 text-right">Selling Price</th>
                      <th className="px-4 py-3 text-right">Recipe Cost</th>
                      <th className="px-4 py-3 text-right">Gross Profit</th>
                      <th className="px-4 py-3 text-center">Margin %</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-center">Addons</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200 font-medium">
                    {loading ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                          Loading menu products & recipe margins...
                        </td>
                      </tr>
                    ) : filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                          <Utensils className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                          <p className="font-bold text-slate-600 dark:text-slate-300">No products found matching filters</p>
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((p) => {
                        const costPrice = Number(p.cost_price || p.calculatedCost || 0);
                        const basePrice = Number(p.base_price || 0);
                        const grossProfit = Math.max(0, basePrice - costPrice);
                        const marginPercent = basePrice > 0 ? Math.round((grossProfit / basePrice) * 100) : 0;
                        const hasRecipe = p.recipe && p.recipe.ingredients && p.recipe.ingredients.length > 0;
                        const addonCount = p.modifierGroups ? p.modifierGroups.length : 0;
                        const isAvailable = p.is_available !== false;

                        return (
                          <tr
                            key={p.id}
                            className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                              !isAvailable ? 'bg-slate-50/50 dark:bg-slate-900/40 opacity-75' : ''
                            }`}
                          >
                            {/* Menu Item details with avatar */}
                            <td className="px-4 py-3">
                              <div className="flex items-center space-x-2.5">
                                <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-black text-slate-700 dark:text-slate-300 text-xs shrink-0">
                                  {p.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                                    <span>{p.name}</span>
                                    
                                  </div>
                                  <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-mono">
                                    <span>SKU: {p.sku}</span>
                                    {p.barcode && <span>• Barcode: {p.barcode}</span>}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Category & Subcategory */}
                            <td className="px-4 py-3">
                              <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-semibold border border-slate-200 dark:border-slate-700 inline-block">
                                {p.category_name || 'Unassigned'}
                              </span>
                            </td>

                            {/* Prep Station */}
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded bg-brand-500/10 text-brand-600 dark:text-brand-400 text-[10px] font-bold uppercase">
                                {p.station || 'KITCHEN'}
                              </span>
                            </td>

                            {/* Selling Price */}
                            <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-white text-sm">
                              {currencySymbol} {basePrice.toLocaleString()}
                            </td>

                            {/* Recipe Cost */}
                            <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-400">
                              {currencySymbol} {costPrice.toFixed(2)}
                            </td>

                            {/* Gross Profit */}
                            <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {currencySymbol} {grossProfit.toFixed(2)}
                            </td>

                            {/* Margin % */}
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                                  marginPercent >= 50
                                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                    : marginPercent >= 25
                                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                                    : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                                }`}
                              >
                                {marginPercent}%
                              </span>
                            </td>

                            {/* Status Pill */}
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                  isAvailable
                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${isAvailable ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                <span>{isAvailable ? 'In Stock' : '86\'d'}</span>
                              </span>
                            </td>

                            {/* Addons Count */}
                            <td className="px-4 py-3 text-center">
                              {addonCount > 0 ? (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
                                  <Sparkles className="w-3 h-3" />
                                  <span>{addonCount} Addons</span>
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[10px]">—</span>
                              )}
                            </td>

                            {/* 3-DOTS ACTION MENU (ALL CRUD & PRINT OPTIONS) */}
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <ActionMenu
                                items={[
                                  {
                                    label: 'Preview Details & Costing',
                                    icon: Eye,
                                    onClick: () => setPreviewProduct(p),
                                  },
                                  {
                                    label: 'Edit Product',
                                    icon: Edit2,
                                    onClick: () => handleOpenEditProduct(p),
                                  },
                                  {
                                    label: 'Recipe Ingredients',
                                    icon: ChefHat,
                                    onClick: () => {
                                      if (hasRecipe) {
                                        setViewingRecipeProduct(p);
                                      } else {
                                        handleOpenEditProduct(p);
                                      }
                                    },
                                  },
                                  {
                                    label: 'Print Barcode / Price Tag',
                                    icon: Barcode,
                                    divider: true,
                                    onClick: () => {
                                      setPrintingBarcodeProduct(p);
                                      setLabelCopies(1);
                                    },
                                  },
                                  {
                                    label: 'Print Recipe Spec Sheet',
                                    icon: Printer,
                                    onClick: () => setPrintingSpecProduct(p),
                                  },
                                  {
                                    label: 'Duplicate Item',
                                    icon: Copy,
                                    divider: true,
                                    onClick: () => handleDuplicateProduct(p),
                                  },
                                  {
                                    label: isAvailable ? 'Mark Out of Stock (86\'d)' : 'Mark In Stock (Available)',
                                    icon: Power,
                                    variant: isAvailable ? 'warning' : 'success',
                                    onClick: () => handleToggleAvailability(p),
                                  },
                                  {
                                    label: 'Delete Product',
                                    icon: Trash2,
                                    variant: 'danger',
                                    divider: true,
                                    onClick: () => handleDeleteProduct(p.id),
                                  },
                                ]}
                              />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW MODE 2: VISUAL PRODUCT CARDS / GRID VIEW */}
          {viewMode === 'GRID' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {loading ? (
                <div className="col-span-full py-12 text-center text-slate-400">
                  Loading menu cards...
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="col-span-full py-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <Utensils className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="font-bold text-slate-600 dark:text-slate-300">No products found matching filters</p>
                </div>
              ) : (
                filteredProducts.map((p) => {
                  const costPrice = Number(p.cost_price || p.calculatedCost || 0);
                  const basePrice = Number(p.base_price || 0);
                  const grossProfit = Math.max(0, basePrice - costPrice);
                  const marginPercent = basePrice > 0 ? Math.round((grossProfit / basePrice) * 100) : 0;
                  const addonCount = p.modifierGroups ? p.modifierGroups.length : 0;
                  const isAvailable = p.is_available !== false;

                  return (
                    <div
                      key={p.id}
                      className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${
                        !isAvailable ? 'opacity-70 bg-slate-50/50 dark:bg-slate-900/40' : ''
                      }`}
                    >
                      {/* Card Top: Badges and 3-Dots Action Menu */}
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                          <div className="flex items-center space-x-1.5 overflow-hidden">
                            <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold truncate">
                              {p.category_name || 'General'}
                            </span>
                            <span className="px-2 py-0.5 rounded-lg bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 text-[9px] font-extrabold uppercase">
                              {p.station || 'KITCHEN'}
                            </span>
                          </div>

                          {/* 3 VERTICAL DOTS ACTION MENU */}
                          <ActionMenu
                            items={[
                              {
                                label: 'Preview Details & Costing',
                                icon: Eye,
                                onClick: () => setPreviewProduct(p),
                              },
                              {
                                label: 'Edit Product',
                                icon: Edit2,
                                onClick: () => handleOpenEditProduct(p),
                              },
                              {
                                label: 'Recipe Ingredients',
                                icon: ChefHat,
                                onClick: () => {
                                  if (p.recipe?.ingredients?.length > 0) {
                                    setViewingRecipeProduct(p);
                                  } else {
                                    handleOpenEditProduct(p);
                                  }
                                },
                              },
                              {
                                label: 'Print Barcode / Price Tag',
                                icon: Barcode,
                                divider: true,
                                onClick: () => {
                                  setPrintingBarcodeProduct(p);
                                  setLabelCopies(1);
                                },
                              },
                              {
                                label: 'Print Recipe Spec Sheet',
                                icon: Printer,
                                onClick: () => setPrintingSpecProduct(p),
                              },
                              {
                                label: 'Duplicate Item',
                                icon: Copy,
                                divider: true,
                                onClick: () => handleDuplicateProduct(p),
                              },
                              {
                                label: isAvailable ? 'Mark Out of Stock (86\'d)' : 'Mark In Stock (Available)',
                                icon: Power,
                                variant: isAvailable ? 'warning' : 'success',
                                onClick: () => handleToggleAvailability(p),
                              },
                              {
                                label: 'Delete Product',
                                icon: Trash2,
                                variant: 'danger',
                                divider: true,
                                onClick: () => handleDeleteProduct(p.id),
                              },
                            ]}
                          />
                        </div>

                        {/* Product Title and Urdu Name */}
                        <div className="flex items-start space-x-3 mb-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-50 to-amber-50 dark:from-slate-800 dark:to-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-black text-brand-600 dark:text-brand-400 text-sm shrink-0">
                            {p.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                              {p.name}
                            </h3>
                            
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">SKU: {p.sku}</p>
                          </div>
                        </div>

                        {/* Availability Pill */}
                        <div className="mb-3">
                          <span
                            className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              isAvailable
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isAvailable ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            <span>{isAvailable ? 'In Stock (Available)' : 'Out of Stock (86\'d)'}</span>
                          </span>
                        </div>
                      </div>

                      {/* Financials & Margin Bar */}
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80">
                        <div className="flex items-baseline justify-between mb-1.5">
                          <span className="text-[11px] font-bold text-slate-500">Retail Price</span>
                          <span className="text-base font-black text-slate-900 dark:text-white font-mono">
                            {currencySymbol} {basePrice.toLocaleString()}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-2">
                          <span>Cost: <span className="font-mono font-bold">{currencySymbol} {costPrice.toFixed(0)}</span></span>
                          <span>Profit: <span className="font-mono font-bold text-emerald-600">{currencySymbol} {grossProfit.toFixed(0)}</span></span>
                          <span className={`font-black ${marginPercent >= 50 ? 'text-emerald-600' : marginPercent >= 25 ? 'text-amber-600' : 'text-rose-600'}`}>
                            {marginPercent}% Margin
                          </span>
                        </div>

                        {/* Visual Margin Bar */}
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              marginPercent >= 50 ? 'bg-emerald-500' : marginPercent >= 25 ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(5, marginPercent))}%` }}
                          />
                        </div>

                        {/* Footer Badges */}
                        <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-slate-100 dark:border-slate-800/60 text-[10px]">
                          {addonCount > 0 ? (
                            <span className="inline-flex items-center space-x-1 text-amber-600 dark:text-amber-400 font-bold">
                              <Sparkles className="w-3 h-3" />
                              <span>{addonCount} Addon Options</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">No Addons</span>
                          )}

                          <button
                            onClick={() => setPreviewProduct(p)}
                            className="font-bold text-brand-600 dark:text-brand-400 hover:underline"
                          >
                            Inspect details &rarr;
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: MENU CATEGORIES & SUB-CATEGORIES */}
      {/* ======================================================== */}
      {activeTab === 'CATEGORIES' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Menu Category Hierarchy
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Top-level parent categories appear as main sections, while sub-categories group specialized items.
                </p>
              </div>
              <button
                onClick={handleOpenCreateCategory}
                className="px-3.5 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Category</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Category Name</th>
                    <th className="px-4 py-3">Type / Hierarchy</th>
                                        <th className="px-4 py-3 text-center">Assigned Items</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200 font-medium">
                  {categories.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        No categories found. Create your first menu category.
                      </td>
                    </tr>
                  ) : (
                    categories.map((c) => {
                      const isSub = Boolean(c.parent_id);
                      const itemCount = products.filter((p) => p.category_id === c.id).length;

                      return (
                        <tr key={c.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center space-x-2">
                              {isSub ? (
                                <span className="text-slate-400 font-mono pl-3">↳</span>
                              ) : (
                                <FolderTree className="w-4 h-4 text-brand-500 shrink-0" />
                              )}
                              <span className={`font-bold ${isSub ? 'text-slate-700 dark:text-slate-300' : 'text-slate-900 dark:text-white'}`}>
                                {c.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {isSub ? (
                              <span className="px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-[10px] font-bold border border-amber-200 dark:border-amber-800">
                                Subcategory of {c.parent_name || 'Main'}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-lg bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 text-[10px] font-bold border border-brand-200 dark:border-brand-800">
                                Top-Level Parent
                              </span>
                            )}
                          </td>
                                                    <td className="px-4 py-3 text-center">
                            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[11px]">
                              {itemCount} Items
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <ActionMenu
                              items={[
                                {
                                  label: 'Edit Category',
                                  icon: Edit2,
                                  onClick: () => handleOpenEditCategory(c),
                                },
                                !isSub && {
                                  label: 'Add Sub-Category',
                                  icon: Plus,
                                  onClick: () => {
                                    setEditingCategory(null);
                                    setCategoryForm({ name: '', nameUrdu: '', sortOrder: 0, parentId: c.id });
                                    setIsCategoryModalOpen(true);
                                  },
                                },
                                {
                                  label: 'Delete Category',
                                  icon: Trash2,
                                  variant: 'danger',
                                  divider: true,
                                  onClick: () => handleDeleteCategory(c.id),
                                },
                              ]}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: ADDONS & MODIFIERS (Extra Sauces, Cheese, Sides) */}
      {/* ======================================================== */}
      {activeTab === 'MODIFIERS' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Product Addons, Extra Sauces & Modifiers</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Allow customers to customize food with extra dips, cheeses, toppings, and size upgrades.
                </p>
              </div>
              <button
                onClick={handleOpenCreateModifier}
                className="px-3.5 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Addon Group</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Addon Group Name</th>
                    <th className="px-4 py-3">Selection Rules</th>
                    <th className="px-4 py-3">Addon Items & Prices</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200 font-medium">
                  {modifierGroups.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-12 text-center text-slate-400">
                        <Sparkles className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                        <p className="font-bold text-slate-600 dark:text-slate-300">No addon groups created yet</p>
                        <p className="text-xs text-slate-400 mt-1">Create groups like "Extra Sauces", "Cheese Upgrades", or "Sides".</p>
                      </td>
                    </tr>
                  ) : (
                    modifierGroups.map((group) => {
                      let opts = [];
                      try {
                        opts = Array.isArray(group.options) ? group.options : JSON.parse(group.options || '[]');
                      } catch (_) {
                        opts = [];
                      }

                      return (
                        <tr key={group.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-4 py-3">
                            <span className="font-bold text-slate-900 dark:text-white block">{group.name}</span>
                            
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-semibold border border-slate-200 dark:border-slate-700">
                              {group.is_required ? 'Required (Mandatory)' : 'Optional'} • Max {group.max_select || 5} choices
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1.5">
                              {opts.map((opt: any, idx: number) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                                >
                                  {opt.name} (+{currencySymbol} {Number(opt.price || 0)})
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <ActionMenu
                              items={[
                                {
                                  label: 'Edit Addon Group',
                                  icon: Edit2,
                                  onClick: () => handleOpenEditModifier(group),
                                },
                                {
                                  label: 'Delete Addon Group',
                                  icon: Trash2,
                                  variant: 'danger',
                                  divider: true,
                                  onClick: () => handleDeleteModifierGroup(group.id),
                                },
                              ]}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: ADD / EDIT CATEGORY */}
      {/* ======================================================== */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title={editingCategory ? 'Edit Menu Category' : 'Create Menu Category / Sub-Category'}
        maxWidth="md"
      >
        <form onSubmit={handleSaveCategory} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Category Name (English) *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Traditional Karahi, Smash Burgers, Hot Beverages"
              value={categoryForm.name}
              onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
            />
          </div>

          

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Parent Category (Optional: Leave empty for Top-Level)
            </label>
            <select
              value={categoryForm.parentId || ''}
              onChange={(e) => setCategoryForm({ ...categoryForm, parentId: e.target.value || null })}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
            >
              <option value="">None (Top-Level Category)</option>
              {categories
                .filter((c) => !c.parent_id && (!editingCategory || c.id !== editingCategory.id))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    ↳ Make Subcategory under: {c.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold shadow-md"
            >
              {editingCategory ? 'Update Category' : 'Save Category'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 2: ADD / EDIT ADDON GROUP (Extra Sauces, Cheese, etc.) */}
      {/* ======================================================== */}
      <Modal
        isOpen={isModifierModalOpen}
        onClose={() => setIsModifierModalOpen(false)}
        title={editingModifierGroup ? 'Edit Addon Group' : 'Create New Addon Group'}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveModifierGroup} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Addon Group Name (English) *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Extra Sauces, Cheese Upgrades"
                value={modifierForm.name}
                onChange={(e) => setModifierForm({ ...modifierForm, name: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
              />
            </div>

            
          </div>

          <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Max Options Selectable</label>
              <input
                type="number"
                min={1}
                max={20}
                value={modifierForm.maxSelect}
                onChange={(e) => setModifierForm({ ...modifierForm, maxSelect: parseInt(e.target.value) || 1 })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 font-mono"
              />
            </div>
            <div className="flex items-center space-x-2 pt-4">
              <input
                type="checkbox"
                id="isRequired"
                checked={modifierForm.isRequired}
                onChange={(e) => setModifierForm({ ...modifierForm, isRequired: e.target.checked })}
                className="rounded text-brand-500 focus:ring-brand-400"
              />
              <label htmlFor="isRequired" className="font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                Required / Mandatory choice
              </label>
            </div>
          </div>

          {/* Addon Options Editor */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Addon Items & Prices</span>
              </span>
              <button
                type="button"
                onClick={addModifierOption}
                className="px-2.5 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 rounded-lg font-bold text-[11px] flex items-center space-x-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Option</span>
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {modifierForm.options.map((opt, idx) => (
                <div key={idx} className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800/80 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                  <input
                    type="text"
                    required
                    placeholder="Option name (e.g. Extra Cheese)"
                    value={opt.name}
                    onChange={(e) => updateModifierOption(idx, 'name', e.target.value)}
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white"
                  />
                  <div className="w-28 relative">
                    <span className="absolute left-2 top-1.5 text-slate-400 font-bold text-[10px]">{currencySymbol}</span>
                    <input
                      type="number"
                      required
                      min={0}
                      placeholder="Price"
                      value={opt.price}
                      onChange={(e) => updateModifierOption(idx, 'price', parseFloat(e.target.value) || 0)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-7 pr-2 py-1.5 text-xs font-mono font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeModifierOption(idx)}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                    title="Remove Option"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsModifierModalOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold shadow-md"
            >
              Save Addon Group
            </button>
          </div>
        </form>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 3: ADD / EDIT PRODUCT WITH ADDONS & RECIPE BUILDER */}
      {/* ======================================================== */}
      <Modal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        title={editingProduct ? 'Edit Menu Product & Recipe' : 'Add New Menu Item'}
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Product Name (English) *</label>
              <input
                type="text"
                required
                placeholder="e.g. Special Mutton Karahi Full"
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
              />
            </div>
            
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Category *</label>
              <select
                required
                value={productForm.categoryId}
                onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value, subCategoryId: '' })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.parent_name ? `↳ ${c.name}` : c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Subcategory (Optional)</label>
              <select
                value={productForm.subCategoryId || ''}
                onChange={(e) => setProductForm({ ...productForm, subCategoryId: e.target.value || null })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
              >
                <option value="">None (Direct under category)</option>
                {categories
                  .filter((c) => c.parent_id === productForm.categoryId)
                  .map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Prep Station</label>
              <select
                value={productForm.station}
                onChange={(e) => setProductForm({ ...productForm, station: e.target.value as any })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
              >
                <option value={PrepStation.KITCHEN}>Kitchen / Main Station</option>
                <option value={PrepStation.DRINKS}>Beverage Bar / Drinks</option>
                <option value={PrepStation.BBQ}>Live BBQ / Grill Station</option>
                <option value={PrepStation.DESSERTS}>Dessert Counter</option>
                <option value={PrepStation.PACKAGING}>Packaging / Dispatch Counter</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">SKU Code *</label>
              <input
                type="text"
                required
                placeholder="SKU-101"
                value={productForm.sku}
                onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Barcode</label>
              <input
                type="text"
                placeholder="Optional"
                value={productForm.barcode}
                onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Selling Price ({currencySymbol}) *</label>
              <input
                type="number"
                required
                min={0}
                step="any"
                value={productForm.basePrice}
                onChange={(e) => setProductForm({ ...productForm, basePrice: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300">Cost Price ({currencySymbol})</label>
                {modalCalculatedCost > 0 && (
                  <button
                    type="button"
                    onClick={() => setProductForm({ ...productForm, costPrice: parseFloat(modalCalculatedCost.toFixed(2)) })}
                    className="text-[10px] text-brand-600 dark:text-brand-400 font-bold hover:underline"
                    title="Copy calculated recipe cost into manual cost price"
                  >
                    Sync Recipe
                  </button>
                )}
              </div>
              <input
                type="number"
                min={0}
                step="any"
                placeholder={modalCalculatedCost > 0 ? modalCalculatedCost.toFixed(2) : '0'}
                value={productForm.costPrice || ''}
                onChange={(e) => setProductForm({ ...productForm, costPrice: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Real-time Profitability & Margin Preview Card */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="font-bold text-slate-700 dark:text-slate-300">Unit Profitability:</span>
              <span className="text-slate-500">Effective Cost: <strong className="font-mono text-slate-700 dark:text-slate-200">{currencySymbol} {effectiveCostPrice.toFixed(2)}</strong></span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500">Profit: <strong className="font-mono text-emerald-600 dark:text-emerald-400">{currencySymbol} {modalGrossProfit.toFixed(2)}</strong></span>
            </div>

            <div className="flex items-center space-x-1.5">
              <span className="text-slate-500 font-medium">Gross Margin:</span>
              <span
                className={`px-2.5 py-0.5 rounded-full font-black text-xs ${
                  modalGrossMarginPercent >= 50
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                    : modalGrossMarginPercent >= 25
                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                    : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                }`}
              >
                {modalGrossMarginPercent}%
              </span>
            </div>
          </div>

          {/* Applicable Addon Groups Checkbox Selector */}
          {modifierGroups.length > 0 && (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-amber-50/30 dark:bg-amber-950/20">
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1 flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Attach Addon Groups (Extra Sauces, Cheese, Upgrades)</span>
              </label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                Selected addons will be presented as customization options when this item is tapped in POS.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {modifierGroups.map((mg) => {
                  const isChecked = productForm.modifierGroupIds.includes(mg.id);
                  let optNames = '';
                  try {
                    const opts = Array.isArray(mg.options) ? mg.options : JSON.parse(mg.options || '[]');
                    optNames = opts.map((o: any) => o.name).join(', ');
                  } catch (_) {}

                  return (
                    <label
                      key={mg.id}
                      className={`flex items-start space-x-2 p-2 rounded-xl border cursor-pointer transition-colors ${
                        isChecked
                          ? 'border-amber-400 bg-amber-50/80 dark:bg-amber-950/50'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setProductForm({
                              ...productForm,
                              modifierGroupIds: [...productForm.modifierGroupIds, mg.id],
                            });
                          } else {
                            setProductForm({
                              ...productForm,
                              modifierGroupIds: productForm.modifierGroupIds.filter((id) => id !== mg.id),
                            });
                          }
                        }}
                        className="mt-0.5 rounded text-amber-500 focus:ring-amber-400"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-slate-900 dark:text-white block">{mg.name}</span>
                        {optNames && <span className="text-[10px] text-slate-500 line-clamp-1">{optNames}</span>}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Embedded Recipe Ingredients Section */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/40 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                  <ChefHat className="w-4 h-4 text-brand-500" />
                  <span>Recipe Ingredients & Automatic Inventory Depletion</span>
                </span>
                <p className="text-[11px] text-slate-500">
                  Exact raw ingredients deducted per order checkout via First-In, First-Out (FIFO) costing.
                </p>
              </div>

              <button
                type="button"
                onClick={addRecipeIngredient}
                className="px-2.5 py-1 bg-brand-500/10 text-brand-600 dark:text-brand-400 hover:bg-brand-500/20 rounded-lg font-bold text-xs flex items-center space-x-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Ingredient</span>
              </button>
            </div>

            {productForm.recipe.ingredients.length === 0 ? (
              <div className="py-4 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                No recipe ingredients linked. Click "Add Ingredient" to configure automatic batch stock deduction.
              </div>
            ) : (
              <div className="space-y-2">
                {productForm.recipe.ingredients.map((item, idx) => {
                  const ing = ingredients.find((i) => i.id === item.ingredientId);
                  const lineCost = ing ? Number(ing.cost_per_unit || 0) * (Number(item.quantity) || 0) : 0;

                  return (
                    <div
                      key={idx}
                      className="flex items-center space-x-2 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs"
                    >
                      <select
                        value={item.ingredientId}
                        onChange={(e) => updateRecipeIngredient(idx, 'ingredientId', e.target.value)}
                        className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1"
                      >
                        {ingredients.map((ingItem) => (
                          <option key={ingItem.id} value={ingItem.id}>
                            {ingItem.name} ({ingItem.unit}) - {currencySymbol} {Number(ingItem.cost_per_unit || 0).toFixed(2)}/{ingItem.unit}
                          </option>
                        ))}
                      </select>

                      <div className="w-24">
                        <input
                          type="number"
                          step="any"
                          min={0.001}
                          required
                          value={item.quantity}
                          onChange={(e) => updateRecipeIngredient(idx, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-right font-mono"
                          placeholder="Qty"
                        />
                      </div>

                      <span className="w-12 text-slate-500 font-bold text-[11px]">{item.unit}</span>

                      <div className="w-20 text-right font-mono text-slate-600 dark:text-slate-300 font-bold">
                        {currencySymbol} {lineCost.toFixed(1)}
                      </div>

                      <button
                        type="button"
                        onClick={() => removeRecipeIngredient(idx)}
                        className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                        title="Remove Ingredient"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsProductModalOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold shadow-md"
            >
              {editingProduct ? 'Update Product' : 'Save Product & Recipe'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 4: RECIPE INGREDIENTS QUICK VIEW */}
      {/* ======================================================== */}
      <Modal
        isOpen={!!viewingRecipeProduct}
        onClose={() => setViewingRecipeProduct(null)}
        title={`Recipe Ingredients: ${viewingRecipeProduct?.name || ''}`}
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
            <div className="flex justify-between font-bold text-slate-800 dark:text-slate-200">
              <span>Portion Yield Count:</span>
              <span>{viewingRecipeProduct?.recipe?.yieldCount || 1} Servings</span>
            </div>
            <div className="flex justify-between font-bold text-amber-600 dark:text-amber-400">
              <span>Recipe Portion Cost:</span>
              <span className="font-mono">{currencySymbol} {Number(viewingRecipeProduct?.cost_price || 0).toLocaleString()}</span>
            </div>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="px-3 py-2">Ingredient</th>
                  <th className="px-3 py-2 text-right">Quantity</th>
                  <th className="px-3 py-2 text-right">Unit Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {viewingRecipeProduct?.recipe?.ingredients?.map((ri: any, idx: number) => (
                  <tr key={idx}>
                    <td className="px-3 py-2 font-bold text-slate-900 dark:text-white">{ri.ingredientName || 'Raw Item'}</td>
                    <td className="px-3 py-2 text-right font-mono">{ri.quantity} {ri.unit}</td>
                    <td className="px-3 py-2 text-right font-bold text-slate-900 dark:text-white">{currencySymbol} {ri.unitCost || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => {
                const prod = viewingRecipeProduct;
                setViewingRecipeProduct(null);
                handleOpenEditProduct(prod);
              }}
              className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl text-xs"
            >
              Edit Recipe
            </button>
          </div>
        </div>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 5: PRODUCT PREVIEW & PROFITABILITY BREAKDOWN */}
      {/* ======================================================== */}
      {previewProduct && (
        <Modal
          isOpen={!!previewProduct}
          onClose={() => setPreviewProduct(null)}
          title="Product Preview & Performance Details"
          maxWidth="2xl"
        >
          <div className="space-y-5 text-xs">
            {/* Header info */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    {previewProduct.name}
                  </h3>
                  
                </div>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    Category: {previewProduct.category_name}
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800">
                    Station: {previewProduct.station || 'KITCHEN'}
                  </span>
                </div>
              </div>
              <div>
                <span
                  className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold border ${
                    previewProduct.is_available !== false
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                      : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${previewProduct.is_available !== false ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  <span>{previewProduct.is_available !== false ? 'In Stock (Available)' : 'Out of Stock (86\'d)'}</span>
                </span>
              </div>
            </div>

            {/* Financial Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl">
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Retail Price</span>
                <span className="text-base font-black text-slate-900 dark:text-white">
                  {currencySymbol} {Number(previewProduct.base_price).toLocaleString()}
                </span>
              </div>
              <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl">
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Cost Price</span>
                <span className="text-base font-black text-slate-700 dark:text-slate-300">
                  {currencySymbol} {Number(previewProduct.cost_price || 0).toLocaleString()}
                </span>
              </div>
              <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl">
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Gross Profit</span>
                <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                  {currencySymbol} {Math.max(0, Number(previewProduct.base_price) - Number(previewProduct.cost_price || 0)).toLocaleString()}
                </span>
              </div>
              <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl">
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Gross Margin</span>
                {(() => {
                  const base = Number(previewProduct.base_price) || 0;
                  const cost = Number(previewProduct.cost_price || 0);
                  const margin = base > 0 ? Math.round(((base - cost) / base) * 100) : 0;
                  return (
                    <span className={`text-base font-black ${
                      margin >= 50 ? 'text-emerald-600 dark:text-emerald-400' : margin >= 25 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {margin}%
                    </span>
                  );
                })()}
              </div>
            </div>

            {/* Product Meta */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-slate-50/70 dark:bg-slate-800/30 rounded-xl border border-slate-200/80 dark:border-slate-800 text-[11px]">
              <div>
                <span className="text-slate-500 block">SKU Code:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{previewProduct.sku}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Barcode:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{previewProduct.barcode || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Inventory Tracking:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{previewProduct.track_inventory ? 'Tracked via FIFO' : 'Untracked'}</span>
              </div>
            </div>

            {/* Addons attached */}
            {previewProduct.modifierGroups && previewProduct.modifierGroups.length > 0 && (
              <div className="space-y-2">
                <span className="font-bold text-slate-700 dark:text-slate-300 block">Available Addon Groups</span>
                <div className="flex flex-wrap gap-1.5">
                  {previewProduct.modifierGroups.map((mg: any) => (
                    <span key={mg.id} className="px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                      {mg.name} ({mg.options?.length || 0} options)
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Recipe Details if configured */}
            {previewProduct.recipe && previewProduct.recipe.ingredients && previewProduct.recipe.ingredients.length > 0 && (
              <div className="space-y-2">
                <span className="font-bold text-slate-700 dark:text-slate-300 block">Recipe Ingredients Breakdown</span>
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-100 dark:bg-slate-800/80 font-bold text-slate-700 dark:text-slate-300">
                      <tr>
                        <th className="px-3 py-1.5">Ingredient</th>
                        <th className="px-3 py-1.5 text-center">Quantity</th>
                        <th className="px-3 py-1.5 text-right">Unit Cost</th>
                        <th className="px-3 py-1.5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {previewProduct.recipe.ingredients.map((ri: any, idx: number) => {
                        const ing = ingredients.find((i) => i.id === ri.ingredientId);
                        const ingCost = Number(ing?.costPerUnit || ing?.cost_per_unit || 0);
                        const totalRow = ingCost * Number(ri.quantity || 0);
                        return (
                          <tr key={idx}>
                            <td className="px-3 py-1.5 font-medium">{ing?.name || 'Raw Ingredient'}</td>
                            <td className="px-3 py-1.5 text-center font-bold">{ri.quantity} {ri.unit}</td>
                            <td className="px-3 py-1.5 text-right text-slate-500">{currencySymbol} {ingCost.toFixed(2)}</td>
                            <td className="px-3 py-1.5 text-right font-bold text-slate-800 dark:text-slate-200">{currencySymbol} {totalRow.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    const p = previewProduct;
                    setPreviewProduct(null);
                    handleOpenEditProduct(p);
                  }}
                  className="px-3.5 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold flex items-center space-x-1.5 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Product</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const p = previewProduct;
                    setPreviewProduct(null);
                    setPrintingBarcodeProduct(p);
                  }}
                  className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold flex items-center space-x-1.5 transition-colors"
                >
                  <Barcode className="w-3.5 h-3.5" />
                  <span>Print Label</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setPreviewProduct(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-bold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* MODAL 6: PRINT BARCODE LABEL / SHELF PRICE TAG */}
      {/* ======================================================== */}
      {printingBarcodeProduct && (
        <Modal
          isOpen={!!printingBarcodeProduct}
          onClose={() => setPrintingBarcodeProduct(null)}
          title={`Print Barcode Label: ${printingBarcodeProduct.name}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            {/* Options */}
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center space-x-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Format</label>
                  <select
                    value={labelFormat}
                    onChange={(e) => setLabelFormat(e.target.value as any)}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold"
                  >
                    <option value="SHELF_TAG">Shelf Price Tag (50x30mm)</option>
                    <option value="STICKER">Barcode Sticker (80mm)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Copies</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={labelCopies}
                    onChange={(e) => setLabelCopies(parseInt(e.target.value) || 1)}
                    className="w-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center space-x-1.5 shadow-md"
              >
                <Printer className="w-4 h-4" />
                <span>Print Tag</span>
              </button>
            </div>

            {/* Printable Label Preview Box */}
            <div className="flex justify-center p-4 bg-slate-100 dark:bg-slate-950 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
              <div className="printable-area bg-white text-black p-4 rounded-xl border-2 border-black w-64 shadow-lg text-center space-y-2">
                <div className="border-b border-black pb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider block">
                    {tenant?.name || 'Restaurant POS'}
                  </span>
                  <span className="text-[9px] text-gray-600 block">{printingBarcodeProduct.category_name || 'Menu Item'}</span>
                </div>

                <div>
                  <h4 className="font-black text-sm text-black leading-tight">
                    {printingBarcodeProduct.name}
                  </h4>
                  
                </div>

                {/* Big Price */}
                <div className="py-1 bg-gray-100 rounded border border-gray-300">
                  <span className="text-[10px] font-bold uppercase text-gray-500 block">Retail Price</span>
                  <span className="text-xl font-black text-black font-mono">
                    {currencySymbol} {Number(printingBarcodeProduct.base_price).toLocaleString()}
                  </span>
                </div>

                {/* Barcode Graphic Stripes */}
                <div className="pt-1">
                  <div className="h-10 flex items-center justify-center space-x-0.5 mx-auto">
                    {[3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 3, 4, 1, 2, 3, 1, 4, 2, 1, 3, 2, 4, 1, 2, 3, 1].map((w, i) => (
                      <div
                        key={i}
                        className="bg-black h-8"
                        style={{ width: `${w * 1.5}px` }}
                      />
                    ))}
                  </div>
                  <span className="font-mono text-[10px] font-bold text-gray-800 tracking-widest block mt-0.5">
                    {printingBarcodeProduct.barcode || printingBarcodeProduct.sku}
                  </span>
                </div>

                <div className="text-[8px] text-gray-500 pt-1 border-t border-gray-200 flex justify-between">
                  <span>SKU: {printingBarcodeProduct.sku}</span>
                  <span>{new Date().toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setPrintingBarcodeProduct(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-xl font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* MODAL 7: PRINT RECIPE & KITCHEN SPEC SHEET */}
      {/* ======================================================== */}
      {printingSpecProduct && (
        <Modal
          isOpen={!!printingSpecProduct}
          onClose={() => setPrintingSpecProduct(null)}
          title={`Recipe Specification Sheet: ${printingSpecProduct.name}`}
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs">
            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="font-bold text-slate-700 dark:text-slate-300">
                Official Kitchen Specification & Costing Sheet
              </span>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center space-x-1.5 shadow-md"
              >
                <Printer className="w-4 h-4" />
                <span>Print Spec Sheet</span>
              </button>
            </div>

            {/* Printable Specification Area */}
            <div className="printable-area bg-white text-black p-6 rounded-2xl border border-slate-300 shadow-sm space-y-4">
              {/* Document Header */}
              <div className="border-b-2 border-black pb-3 flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-black uppercase text-black">{tenant?.name || 'Restaurant Management'}</h2>
                  <p className="text-xs font-bold text-gray-600">Standard Operating Procedure: Food Cost & Preparation</p>
                </div>
                <div className="text-right">
                  <span className="px-2 py-1 bg-black text-white font-mono font-bold text-xs rounded">
                    STATION: {printingSpecProduct.station || 'KITCHEN'}
                  </span>
                  <p className="text-[10px] text-gray-500 mt-1">Date: {new Date().toLocaleDateString()}</p>
                </div>
              </div>

              {/* Product Meta */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">Dish Name</span>
                  <span className="font-extrabold text-sm text-black">{printingSpecProduct.name}</span>
                  
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">Category</span>
                  <span className="font-bold text-black">{printingSpecProduct.category_name}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">SKU Code</span>
                  <span className="font-mono font-bold text-black">{printingSpecProduct.sku}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">Serving Yield</span>
                  <span className="font-bold text-black">{printingSpecProduct.recipe?.yieldCount || 1} Portion(s)</span>
                </div>
              </div>

              {/* Financial Breakdown Table */}
              <div className="grid grid-cols-3 gap-3 p-3 bg-gray-100 rounded-xl border border-gray-300 text-center">
                <div>
                  <span className="text-[10px] font-bold uppercase text-gray-600 block">Retail Price</span>
                  <span className="text-lg font-black font-mono text-black">
                    {currencySymbol} {Number(printingSpecProduct.base_price).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-gray-600 block">Recipe Unit Cost</span>
                  <span className="text-lg font-black font-mono text-gray-800">
                    {currencySymbol} {Number(printingSpecProduct.cost_price || 0).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-gray-600 block">Target Gross Margin</span>
                  {(() => {
                    const base = Number(printingSpecProduct.base_price) || 0;
                    const cost = Number(printingSpecProduct.cost_price || 0);
                    const margin = base > 0 ? Math.round(((base - cost) / base) * 100) : 0;
                    return (
                      <span className="text-lg font-black font-mono text-emerald-700">
                        {margin}%
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* Ingredients Table */}
              <div>
                <h4 className="font-black text-xs uppercase tracking-wider text-black mb-1.5">
                  Raw Material Ingredients & Standard Portions
                </h4>
                <div className="border border-black rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-200 text-black font-bold uppercase text-[10px]">
                      <tr>
                        <th className="p-2">Ingredient</th>
                        <th className="p-2 text-center">Standard Portion</th>
                        <th className="p-2 text-right">Unit Lot Cost</th>
                        <th className="p-2 text-right">Calculated Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 text-black">
                      {printingSpecProduct.recipe?.ingredients && printingSpecProduct.recipe.ingredients.length > 0 ? (
                        printingSpecProduct.recipe.ingredients.map((ri: any, idx: number) => {
                          const ing = ingredients.find((i) => i.id === ri.ingredientId);
                          const unitCost = Number(ing?.costPerUnit || ing?.cost_per_unit || 0);
                          const line = unitCost * Number(ri.quantity || 0);
                          return (
                            <tr key={idx}>
                              <td className="p-2 font-bold">{ing?.name || 'Raw Ingredient'}</td>
                              <td className="p-2 text-center font-mono">{ri.quantity} {ri.unit}</td>
                              <td className="p-2 text-right font-mono">{currencySymbol} {unitCost.toFixed(2)}</td>
                              <td className="p-2 text-right font-mono font-bold">{currencySymbol} {line.toFixed(2)}</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={4} className="p-4 text-center text-gray-500">
                            No granular recipe ingredients recorded. Explicit cost price applied: {currencySymbol} {printingSpecProduct.cost_price}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Kitchen Instructions */}
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-[11px] text-gray-700">
                <span className="font-bold text-black block mb-0.5">Chef Quality Assurance Notes:</span>
                <p>1. Weigh all raw ingredients accurately using digital scale prior to cooking.</p>
                <p>2. Adhere strictly to FIFO lot rotation—use older stock batches first.</p>
                <p>3. Notify manager immediately if ingredient stock reaches threshold.</p>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-6 border-t border-gray-300 text-center text-[10px]">
                <div className="border-t border-black pt-1">Head Chef Signature</div>
                <div className="border-t border-black pt-1">Restaurant Manager Signature</div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setPrintingSpecProduct(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-xl font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* MODAL 8: PRINT FULL RESTAURANT MENU (CUSTOMER DINE-IN) */}
      {/* ======================================================== */}
      {isPrintMenuModalOpen && (
        <Modal
          isOpen={isPrintMenuModalOpen}
          onClose={() => setIsPrintMenuModalOpen(false)}
          title="Print Customer Dining & Takeaway Menu"
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs">
            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="font-bold text-slate-700 dark:text-slate-300">
                Formatted Restaurant Menu for Guest Tables & Counter Handouts
              </span>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center space-x-1.5 shadow-md"
              >
                <Printer className="w-4 h-4" />
                <span>Print Full Menu</span>
              </button>
            </div>

            {/* Printable Menu Layout */}
            <div className="printable-area bg-white text-black p-8 rounded-2xl border-2 border-black space-y-6">
              {/* Header */}
              <div className="text-center border-b-2 border-black pb-4">
                <h1 className="text-2xl font-black uppercase tracking-wider text-black">
                  {tenant?.name || 'Restaurant Dining Menu'}
                </h1>
                <p className="text-xs font-bold text-gray-700 mt-1">Dine-In • Takeaway • Express Delivery</p>
                <p className="text-[10px] text-gray-500 mt-0.5">All Prices are in Pakistani Rupees ({currencySymbol})</p>
              </div>

              {/* Sections by Category */}
              <div className="space-y-6">
                {categories
                  .filter((c) => !c.parent_id)
                  .map((mainCat) => {
                    const catProducts = products.filter(
                      (p) =>
                        p.category_id === mainCat.id ||
                        categories.filter((sub) => sub.parent_id === mainCat.id).some((sub) => sub.id === p.category_id)
                    );
                    if (catProducts.length === 0) return null;

                    return (
                      <div key={mainCat.id} className="space-y-3">
                        <div className="border-b border-black pb-1 flex justify-between items-baseline">
                          <h3 className="text-sm font-black uppercase text-black tracking-wide">
                            {mainCat.name}
                          </h3>
                          
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                          {catProducts.map((prod) => (
                            <div key={prod.id} className="flex justify-between items-start border-b border-dotted border-gray-300 pb-1.5">
                              <div className="flex-1 pr-2">
                                <div className="flex items-center space-x-1.5">
                                  <span className="font-extrabold text-xs text-black">{prod.name}</span>
                                  
                                </div>
                                {prod.modifierGroups && prod.modifierGroups.length > 0 && (
                                  <span className="text-[9px] text-gray-500 italic block mt-0.5">
                                    + Addons available ({prod.modifierGroups.map((m: any) => m.name).join(', ')})
                                  </span>
                                )}
                              </div>
                              <span className="font-black font-mono text-xs text-black whitespace-nowrap">
                                {currencySymbol} {Number(prod.base_price).toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Footer */}
              <div className="text-center pt-4 border-t-2 border-black text-[10px] text-gray-600">
                <p className="font-bold">Thank you for dining with us!</p>
                <p>Government taxes and service charges applicable as per official regulations.</p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsPrintMenuModalOpen(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-xl font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
