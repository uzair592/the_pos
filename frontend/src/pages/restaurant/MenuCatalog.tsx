import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { Modal } from '../../components/common/Modal.js';
import { ActionMenu } from '../../components/common/ActionMenu.js';
import { ErpPageHeader } from '../../components/common/ErpPageHeader.js';
import { ErpMetricRibbon } from '../../components/common/ErpMetricRibbon.js';
import { formatPKR } from '../../utils/formatPKR.js';
import {
  Utensils,
  UtensilsCrossed,
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
import {
  PrepStation,
  getCompatibleUnits,
  convertRecipeQtyToBase,
  calculateBaseUnitCost,
  formatDisplayStock,
  STANDARD_UNITS,
} from '@pos/shared';

export const MenuCatalog: React.FC = () => {
  const { tenant } = useAuth();
  const { success, error } = useToast();
  const [searchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<'PRODUCTS' | 'CATEGORIES' | 'MODIFIERS'>('PRODUCTS');

  useEffect(() => {
    const tabParam = searchParams.get('tab')?.toLowerCase();
    if (tabParam === 'categories') {
      setActiveTab('CATEGORIES');
    } else if (tabParam === 'addons' || tabParam === 'modifiers') {
      setActiveTab('MODIFIERS');
    } else if (tabParam === 'recipes') {
      setActiveTab('PRODUCTS');
      setStockFilter('WITH_RECIPE');
    } else if (tabParam === 'items' || tabParam === 'products') {
      setActiveTab('PRODUCTS');
    }
  }, [searchParams]);
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [modifierGroups, setModifierGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // View and Filter State
  const [viewMode, setViewMode] = useState<'TABLE' | 'GRID'>('TABLE');
  const [search, setSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
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
      ingredients: [] as Array<{
        ingredientId: string;
        quantity: number;
        unit: string;
        enteredQuantity?: number;
        recipeUnit?: string;
      }>,
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

  const actionParam = searchParams.get('action');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (actionParam === 'new-product') {
      handleOpenCreateProduct();
    } else if (actionParam === 'new-category') {
      handleOpenCreateCategory();
    } else if (actionParam === 'new-modifier') {
      handleOpenCreateModifier();
    }
  }, [actionParam]);

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
            quantity: Number(ri.quantity),
            unit: ri.unit,
            enteredQuantity: Number(ri.enteredQuantity || ri.entered_quantity || ri.quantity),
            recipeUnit: ri.recipeUnit || ri.recipe_unit || ri.unit,
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
    const baseU = defaultIng ? (defaultIng.base_unit || defaultIng.unit || 'G') : 'G';
    setProductForm({
      ...productForm,
      recipe: {
        ...productForm.recipe,
        ingredients: [
          ...productForm.recipe.ingredients,
          {
            ingredientId: defaultIng.id,
            quantity: 1,
            unit: baseU,
            enteredQuantity: 1,
            recipeUnit: baseU,
          },
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
    const curr = updated[index];
    if (field === 'ingredientId') {
      const ing = ingredients.find((i) => i.id === value);
      const baseU = ing ? (ing.base_unit || ing.unit || 'KG') : 'KG';
      const enteredQ = Number(curr.enteredQuantity || curr.quantity || 1);
      updated[index] = {
        ...curr,
        ingredientId: value,
        unit: baseU,
        recipeUnit: baseU,
        enteredQuantity: enteredQ,
        quantity: enteredQ,
      };
    } else if (field === 'recipeUnit') {
      updated[index] = {
        ...curr,
        recipeUnit: value,
        unit: value,
      };
    } else if (field === 'enteredQuantity' || field === 'quantity') {
      const val = parseFloat(value) || 0;
      updated[index] = {
        ...curr,
        enteredQuantity: val,
        quantity: val,
      };
    } else {
      updated[index] = { ...curr, [field]: value };
    }
    setProductForm({
      ...productForm,
      recipe: {
        ...productForm.recipe,
        ingredients: updated,
      },
    });
  };

  // Compute live estimated recipe cost in modal based on base unit quantities
  const modalCalculatedCost = productForm.recipe.ingredients.reduce((acc, it) => {
    const ing = ingredients.find((i) => i.id === it.ingredientId);
    const unitCost = ing ? Number(ing.cost_per_unit || 0) : 0;
    const baseQ = Number(it.quantity || it.enteredQuantity || 0);
    return acc + baseQ * unitCost;
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

  const filteredCategoryTree = categories
    .filter((c) => !c.parent_id)
    .filter((c) => {
      if (!categorySearch) return true;
      const q = categorySearch.toLowerCase();
      const matchParent = c.name.toLowerCase().includes(q);
      const matchChild = categories.some((sub) => sub.parent_id === c.id && sub.name.toLowerCase().includes(q));
      return matchParent || matchChild;
    });

  // Calculate table view totals
  const totalSellingSum = filteredProducts.reduce((acc, p) => acc + Number(p.base_price || 0), 0);
  const totalCostSum = filteredProducts.reduce((acc, p) => acc + Number(p.cost_price || p.calculatedCost || 0), 0);
  const avgFilteredMargin = filteredProducts.length > 0 && totalSellingSum > 0
    ? Math.round(((totalSellingSum - totalCostSum) / totalSellingSum) * 100)
    : 0;

  return (
    <div className="h-[calc(100vh-48px)] flex flex-col overflow-hidden font-sans select-none bg-slate-50 dark:bg-slate-950">
      {/* 1. Zero-Bloat ERP Page Header (< 44px) */}
      <ErpPageHeader
        title="Menu Catalog"
        subtitle="Recipe Engineering & Margins"
        badge={`${products.length} Items`}
        actions={
          <div className="flex items-center gap-1.5">
            {/* View tabs inside header for zero vertical waste */}
            <div className="flex p-0.5 bg-slate-200/80 dark:bg-slate-800 rounded-lg text-xs font-semibold mr-1">
              <button
                type="button"
                onClick={() => setActiveTab('PRODUCTS')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  activeTab === 'PRODUCTS'
                    ? 'bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Products ({products.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('CATEGORIES')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  activeTab === 'CATEGORIES'
                    ? 'bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Categories ({categories.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('MODIFIERS')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  activeTab === 'MODIFIERS'
                    ? 'bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Addons ({modifierGroups.length})
              </button>
            </div>

            <button
              onClick={() => setIsPrintMenuModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold"
              title="Print Customer Menu"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Print Menu</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold"
              title="Export CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            {activeTab === 'PRODUCTS' ? (
              <button
                onClick={handleOpenCreateProduct}
                className="flex items-center gap-1 px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold shadow-xs shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ New Product</span>
              </button>
            ) : activeTab === 'CATEGORIES' ? (
              <button
                onClick={handleOpenCreateCategory}
                className="flex items-center gap-1 px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold shadow-xs shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ New Category</span>
              </button>
            ) : (
              <button
                onClick={handleOpenCreateModifier}
                className="flex items-center gap-1 px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold shadow-xs shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ New Addon Group</span>
              </button>
            )}
          </div>
        }
      />

      {/* 2. Compact Vyapar Summary Ribbon (44px) */}
      {activeTab === 'PRODUCTS' && (
        <ErpMetricRibbon
          metrics={[
            {
              label: 'Total Products',
              value: totalProductsCount,
              variant: 'slate',
            },
            {
              label: 'Available (In-Stock)',
              value: inStockCount,
              variant: 'emerald',
              onClick: () => setStockFilter(stockFilter === 'IN_STOCK' ? 'ALL' : 'IN_STOCK'),
            },
            {
              label: "86'd (Out of Stock)",
              value: outOfStockCount,
              variant: 'rose',
              onClick: () => setStockFilter(stockFilter === 'OUT_OF_STOCK' ? 'ALL' : 'OUT_OF_STOCK'),
            },
            {
              label: 'Recipes Tracked',
              value: `${withRecipeCount} of ${totalProductsCount}`,
              variant: 'indigo',
              onClick: () => setStockFilter(stockFilter === 'WITH_RECIPE' ? 'ALL' : 'WITH_RECIPE'),
            },
            {
              label: 'Avg Gross Margin',
              value: `${avgMargin}%`,
              variant: avgMargin >= 50 ? 'emerald' : avgMargin >= 25 ? 'amber' : 'rose',
            },
          ]}
          actions={
            <div className="flex items-center gap-1 text-xs">
              <span className="text-slate-400 text-[11px] hidden sm:inline">Category:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {selectedCategory === 'ALL'
                  ? 'All Categories'
                  : categories.find((c) => c.id === selectedCategory)?.name || 'Selected'}
              </span>
              {selectedCategory !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('ALL');
                    setSelectedSubCategory('ALL');
                  }}
                  className="text-xs text-rose-500 hover:text-rose-700 font-bold ml-1"
                >
                  Clear
                </button>
              )}
            </div>
          }
        />
      )}

      {/* 3. Main Master-Detail Workspace Area */}
      {activeTab === 'PRODUCTS' && (
        <div className="flex-1 flex overflow-hidden">
          {/* ========================================================= */}
          {/* LEFT MASTER PANE: Category Tree Navigation (w-56 / w-64)  */}
          {/* ========================================================= */}
          <div className="w-56 xl:w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0">
            {/* Category Search & Add Header */}
            <div className="p-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1.5 shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter categories..."
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md pl-7 pr-2 py-1 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>
              <button
                type="button"
                onClick={handleOpenCreateCategory}
                className="p-1 rounded-md bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 hover:bg-orange-100 border border-orange-200 dark:border-orange-800 shrink-0"
                title="Add New Category"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Scrollable Category List */}
            <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
              {/* All Items Button */}
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('ALL');
                  setSelectedSubCategory('ALL');
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                  selectedCategory === 'ALL'
                    ? 'bg-orange-600 text-white font-bold shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Utensils className="w-3.5 h-3.5 shrink-0 opacity-80" />
                  <span className="truncate">All Menu Items</span>
                </div>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                    selectedCategory === 'ALL'
                      ? 'bg-white/25 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {products.length}
                </span>
              </button>

              <div className="pt-1 pb-1">
                <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Categories ({categories.filter((c) => !c.parent_id).length})
                </div>
              </div>

              {filteredCategoryTree.map((c) => {
                const subCats = categories.filter((sub) => sub.parent_id === c.id);
                const isSelected = selectedCategory === c.id;
                const catItemCount = products.filter(
                  (p) => p.category_id === c.id || subCats.some((sub) => sub.id === p.category_id)
                ).length;

                return (
                  <div key={c.id} className="space-y-0.5">
                    {/* Parent Category Row */}
                    <div
                      className={`group w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs cursor-pointer transition-colors ${
                        isSelected && selectedSubCategory === 'ALL'
                          ? 'bg-orange-600 text-white font-bold shadow-xs'
                          : isSelected
                          ? 'bg-orange-100 dark:bg-orange-950/40 text-orange-900 dark:text-orange-200 font-semibold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                      onClick={() => {
                        setSelectedCategory(c.id);
                        setSelectedSubCategory('ALL');
                      }}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <FolderTree className="w-3.5 h-3.5 shrink-0 opacity-70" />
                        <span className="truncate">{c.name}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                            isSelected && selectedSubCategory === 'ALL'
                              ? 'bg-white/25 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {catItemCount}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditCategory(c);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-orange-600 transition-opacity"
                          title="Edit Category"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Child Subcategories Indented */}
                    {subCats.length > 0 && (
                      <div className="pl-3.5 space-y-0.5 border-l border-slate-200 dark:border-slate-800 ml-2.5 my-0.5">
                        {subCats.map((sub) => {
                          const isSubSelected = selectedSubCategory === sub.id;
                          const subCount = products.filter(
                            (p) => p.category_id === sub.id || p.sub_category_id === sub.id
                          ).length;

                          return (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => {
                                setSelectedCategory(c.id);
                                setSelectedSubCategory(sub.id);
                              }}
                              className={`w-full flex items-center justify-between px-2 py-1 rounded text-[11px] transition-colors ${
                                isSubSelected
                                  ? 'bg-orange-600 text-white font-bold'
                                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900'
                              }`}
                            >
                              <span className="truncate">↳ {sub.name}</span>
                              <span
                                className={`text-[9px] font-mono px-1 rounded ${
                                  isSubSelected ? 'bg-white/25 text-white' : 'text-slate-400'
                                }`}
                              >
                                {subCount}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ========================================================= */}
          {/* RIGHT DETAIL PANE: Menu Engineering Spreadsheet Grid     */}
          {/* ========================================================= */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-slate-950">
            {/* Compact Filter Strip (36px) */}
            <div className="h-9 min-h-[36px] bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 px-3 flex items-center justify-between gap-2 shrink-0">
              {/* Left Search input */}
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search item name, SKU, or barcode..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md pl-8 pr-3 py-1 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              {/* Center Filters */}
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {/* Station Filter */}
                <select
                  value={selectedStation}
                  onChange={(e) => setSelectedStation(e.target.value)}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-orange-500"
                >
                  <option value="ALL">All Stations</option>
                  <option value={PrepStation.KITCHEN}>Kitchen</option>
                  <option value={PrepStation.DRINKS}>Drinks Bar</option>
                  <option value={PrepStation.BBQ}>BBQ / Grill</option>
                  <option value={PrepStation.DESSERTS}>Desserts</option>
                  <option value={PrepStation.PACKAGING}>Packaging</option>
                </select>

                {/* Stock Filter */}
                <select
                  value={stockFilter}
                  onChange={(e) => setStockFilter(e.target.value as any)}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-orange-500"
                >
                  <option value="ALL">All Stock Statuses</option>
                  <option value="IN_STOCK">In Stock Only</option>
                  <option value="OUT_OF_STOCK">86'd / Out of Stock</option>
                  <option value="WITH_RECIPE">With Recipe</option>
                  <option value="NO_RECIPE">Missing Recipe</option>
                </select>

                {/* Table vs Grid toggle */}
                <div className="flex p-0.5 bg-slate-200 dark:bg-slate-800 rounded-md">
                  <button
                    type="button"
                    onClick={() => setViewMode('TABLE')}
                    className={`p-1 rounded transition-colors ${
                      viewMode === 'TABLE'
                        ? 'bg-white dark:bg-slate-900 text-orange-600 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                    title="Spreadsheet Table View"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('GRID')}
                    className={`p-1 rounded transition-colors ${
                      viewMode === 'GRID'
                        ? 'bg-white dark:bg-slate-900 text-orange-600 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                    title="Grid Card View"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Main Content Area */}
            {viewMode === 'TABLE' ? (
              <div className="flex-1 overflow-auto">
                <table className="w-full text-left text-xs border-collapse">
                  {/* Sticky Header */}
                  <thead className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[11px] sticky top-0 z-10 select-none divide-x divide-slate-200/80 dark:divide-slate-800">
                    <tr>
                      <th className="px-2.5 py-2 w-24">SKU / Code</th>
                      <th className="px-3 py-2 min-w-[180px]">Menu Item</th>
                      <th className="px-2.5 py-2">Category</th>
                      <th className="px-2.5 py-2 w-20 text-center">Station</th>
                      <th className="px-3 py-2 text-right w-28">Selling Price</th>
                      <th className="px-3 py-2 text-right w-28">Cost (COGS)</th>
                      <th className="px-3 py-2 text-right w-28">Gross Profit</th>
                      <th className="px-2.5 py-2 text-center w-24">Margin %</th>
                      <th className="px-2.5 py-2 text-center w-28">POS Status</th>
                      <th className="px-2.5 py-2 text-center w-24">Recipe</th>
                      <th className="px-2.5 py-2 text-right w-16">Action</th>
                    </tr>
                  </thead>

                  {/* Body with Dense Zebra Striping & Dividers */}
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800 text-slate-800 dark:text-slate-200 font-medium">
                    {loading ? (
                      <tr>
                        <td colSpan={11} className="px-4 py-12 text-center text-slate-400 font-medium">
                          Loading menu products & recipe margins...
                        </td>
                      </tr>
                    ) : filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="px-4 py-14 text-center text-slate-400">
                          <Utensils className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                          <p className="font-bold text-slate-600 dark:text-slate-300 text-sm">
                            No menu products found matching filters
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            Adjust category or search filters, or create a new item.
                          </p>
                          <button
                            type="button"
                            onClick={handleOpenCreateProduct}
                            className="mt-3 px-3 py-1.5 bg-orange-600 text-white text-xs font-bold rounded-lg shadow-xs hover:bg-orange-700"
                          >
                            + Add New Product
                          </button>
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((p) => {
                        const costPrice = Number(p.cost_price || p.calculatedCost || 0);
                        const basePrice = Number(p.base_price || 0);
                        const grossProfit = Math.max(0, basePrice - costPrice);
                        const marginPercent = basePrice > 0 ? Math.round((grossProfit / basePrice) * 100) : 0;
                        const hasRecipe = p.recipe && p.recipe.ingredients && p.recipe.ingredients.length > 0;
                        const isAvailable = p.is_available !== false;

                        return (
                          <tr
                            key={p.id}
                            className={`divide-x divide-slate-200/60 dark:divide-slate-800/60 hover:bg-orange-50/50 dark:hover:bg-orange-950/20 transition-colors even:bg-slate-50/50 dark:even:bg-slate-900/30 ${
                              !isAvailable ? 'opacity-70 bg-slate-100/40 dark:bg-slate-900/40' : ''
                            }`}
                          >
                            {/* SKU */}
                            <td className="px-2.5 py-1.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                              {p.sku || '—'}
                            </td>

                            {/* Menu Item Name & Details */}
                            <td className="px-3 py-1.5">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-300 shrink-0">
                                  {p.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-900 dark:text-white truncate text-xs">
                                    {p.name}
                                  </div>
                                  {p.name_urdu && (
                                    <div className="text-[10px] text-slate-400 truncate font-urdu">
                                      {p.name_urdu}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Category */}
                            <td className="px-2.5 py-1.5 whitespace-nowrap">
                              <span className="text-slate-700 dark:text-slate-300 font-semibold text-xs">
                                {p.category_name || 'Unassigned'}
                              </span>
                            </td>

                            {/* Prep Station */}
                            <td className="px-2.5 py-1.5 text-center whitespace-nowrap">
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold uppercase">
                                {p.station || 'KITCHEN'}
                              </span>
                            </td>

                            {/* Selling Price */}
                            <td className="px-3 py-1.5 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-white whitespace-nowrap">
                              {formatPKR(basePrice)}
                            </td>

                            {/* Cost Price */}
                            <td className="px-3 py-1.5 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                              {formatPKR(costPrice)}
                            </td>

                            {/* Gross Profit */}
                            <td className="px-3 py-1.5 text-right font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                              {formatPKR(grossProfit)}
                            </td>

                            {/* Margin % Badge */}
                            <td className="px-2.5 py-1.5 text-center whitespace-nowrap">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                                  marginPercent >= 60
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                    : marginPercent >= 40
                                    ? 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                                    : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                                }`}
                              >
                                {marginPercent}%
                              </span>
                            </td>

                            {/* POS Status Toggle (1-Click) */}
                            <td className="px-2.5 py-1.5 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleToggleAvailability(p)}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all border ${
                                  isAvailable
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300'
                                    : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300'
                                }`}
                                title="Click to toggle availability"
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${isAvailable ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                <span>{isAvailable ? 'In Stock' : "86'd"}</span>
                              </button>
                            </td>

                            {/* Recipe Indicator */}
                            <td className="px-2.5 py-1.5 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => {
                                  if (hasRecipe) {
                                    setViewingRecipeProduct(p);
                                  } else {
                                    handleOpenEditProduct(p);
                                  }
                                }}
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                                  hasRecipe
                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300'
                                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                {hasRecipe ? `${p.recipe.ingredients.length} Ingred.` : '+ Recipe'}
                              </button>
                            </td>

                            {/* Actions Menu */}
                            <td className="px-2.5 py-1.5 text-right whitespace-nowrap">
                              <ActionMenu
                                items={[
                                  {
                                    label: 'Preview Details',
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
                                    label: 'Print Barcode',
                                    icon: Barcode,
                                    divider: true,
                                    onClick: () => {
                                      setPrintingBarcodeProduct(p);
                                      setLabelCopies(1);
                                    },
                                  },
                                  {
                                    label: 'Duplicate Item',
                                    icon: Copy,
                                    divider: true,
                                    onClick: () => handleDuplicateProduct(p),
                                  },
                                  {
                                    label: isAvailable ? "Mark Out of Stock (86'd)" : 'Mark In Stock',
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

                  {/* Sticky Totals Footer */}
                  {filteredProducts.length > 0 && (
                    <tfoot className="bg-slate-100 dark:bg-slate-900 border-t-2 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold sticky bottom-0 z-10 select-none divide-x divide-slate-200/80 dark:divide-slate-800 text-xs">
                      <tr>
                        <td colSpan={4} className="px-3 py-2 text-slate-600 dark:text-slate-400 font-bold uppercase text-[11px]">
                          Showing {filteredProducts.length} Items (Avg Margin: {avgFilteredMargin}%)
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-900 dark:text-white">
                          {formatPKR(totalSellingSum / filteredProducts.length)} <span className="text-[10px] font-normal text-slate-400">avg</span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                          {formatPKR(totalCostSum / filteredProducts.length)} <span className="text-[10px] font-normal text-slate-400">avg</span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                          {formatPKR((totalSellingSum - totalCostSum) / filteredProducts.length)} <span className="text-[10px] font-normal text-slate-400">avg</span>
                        </td>
                        <td className="px-2.5 py-2 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                          {avgFilteredMargin}%
                        </td>
                        <td colSpan={3} className="px-3 py-2 text-right text-[11px] text-slate-500">
                          {filteredProducts.filter((p) => p.is_available !== false).length} in stock • {filteredProducts.filter((p) => p.is_available === false).length} 86'd
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            ) : (
              /* Grid View */
              <div className="flex-1 overflow-auto p-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                  {filteredProducts.map((p) => {
                    const costPrice = Number(p.cost_price || p.calculatedCost || 0);
                    const basePrice = Number(p.base_price || 0);
                    const grossProfit = Math.max(0, basePrice - costPrice);
                    const marginPercent = basePrice > 0 ? Math.round((grossProfit / basePrice) * 100) : 0;
                    const isAvailable = p.is_available !== false;

                    return (
                      <div
                        key={p.id}
                        className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex flex-col justify-between shadow-xs hover:border-orange-300 transition-all ${
                          !isAvailable ? 'opacity-70' : ''
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-1 mb-1">
                            <span className="font-mono text-[10px] text-slate-400">{p.sku || 'PROD'}</span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${
                                marginPercent >= 50
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-amber-50 text-amber-700'
                              }`}
                            >
                              {marginPercent}% margin
                            </span>
                          </div>
                          <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                            {p.name}
                          </h4>
                          <span className="text-[10px] text-slate-500 block truncate">
                            {p.category_name || 'General'}
                          </span>
                        </div>

                        <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                          <div>
                            <div className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                              {formatPKR(basePrice)}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              Cost: {formatPKR(costPrice)}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggleAvailability(p)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              isAvailable
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {isAvailable ? 'In Stock' : "86'd"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: MENU CATEGORIES & SUB-CATEGORIES */}
      {/* ======================================================== */}
      {activeTab === 'CATEGORIES' && (
        <div className="flex-1 overflow-auto p-3">
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
        <div className="flex-1 overflow-auto p-3">
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
        title={
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-brand-50 dark:bg-brand-950/50 rounded-xl text-brand-600 dark:text-brand-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingCategory ? 'Edit Menu Category' : 'Create Menu Category / Sub-Category'}
              </h3>
              <p className="text-xs text-slate-500 font-normal mt-0.5">Organize POS menu items into customer-facing departments</p>
            </div>
          </div>
        }
        maxWidth="xl"
      >
        <form onSubmit={handleSaveCategory} className="space-y-4">
          <div>
            <label className="form-label">
              Category Name (English) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Traditional Karahi, Smash Burgers, Hot Beverages"
              value={categoryForm.name}
              onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">
              Parent Category <span className="text-slate-400 font-normal">(Optional: Leave empty for Top-Level)</span>
            </label>
            <select
              value={categoryForm.parentId || ''}
              onChange={(e) => setCategoryForm({ ...categoryForm, parentId: e.target.value || null })}
              className="form-select"
            >
              <option value="">None (Top-Level Category)</option>
              {categories
                .filter((c) => !c.parent_id && (!editingCategory || c.id !== editingCategory.id))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    ↳ Subcategory under: {c.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(false)}
              className="px-5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all"
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
        title={
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-50 dark:bg-amber-950/50 rounded-xl text-amber-600 dark:text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingModifierGroup ? 'Edit Addon Group' : 'Create New Addon Group'}
              </h3>
              <p className="text-xs text-slate-500 font-normal mt-0.5">Define customization options, upgrades, and sauce additions</p>
            </div>
          </div>
        }
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveModifierGroup} className="space-y-4">
          <div>
            <label className="form-label">
              Addon Group Name (English) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Extra Sauces, Cheese Upgrades, Sides"
              value={modifierForm.name}
              onChange={(e) => setModifierForm({ ...modifierForm, name: e.target.value })}
              className="form-input"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div>
              <label className="form-label">Max Options Selectable</label>
              <input
                type="number"
                min={1}
                max={20}
                value={modifierForm.maxSelect}
                onChange={(e) => setModifierForm({ ...modifierForm, maxSelect: parseInt(e.target.value) || 1 })}
                className="form-input font-mono font-bold"
              />
            </div>
            <div className="flex items-center space-x-3 pt-6">
              <input
                type="checkbox"
                id="isRequired"
                checked={modifierForm.isRequired}
                onChange={(e) => setModifierForm({ ...modifierForm, isRequired: e.target.checked })}
                className="rounded text-brand-500 focus:ring-brand-400 w-4 h-4"
              />
              <label htmlFor="isRequired" className="text-sm font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                Required / Mandatory choice
              </label>
            </div>
          </div>

          {/* Addon Options Editor */}
          <div className="space-y-3">
            <div className="flex justify-between items-center pb-1 border-b border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Addon Items & Prices</span>
              </span>
              <button
                type="button"
                onClick={addModifierOption}
                className="px-3 py-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 rounded-xl font-bold text-xs flex items-center space-x-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Option</span>
              </button>
            </div>

            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {modifierForm.options.map((opt, idx) => (
                <div key={idx} className="flex items-center space-x-3 bg-slate-50 dark:bg-slate-850 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                  <input
                    type="text"
                    required
                    placeholder="Option name (e.g. Extra Cheese)"
                    value={opt.name}
                    onChange={(e) => updateModifierOption(idx, 'name', e.target.value)}
                    className="form-input"
                  />
                  <div className="w-36 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">{currencySymbol}</span>
                    <input
                      type="number"
                      required
                      min={0}
                      placeholder="0.00"
                      value={opt.price}
                      onChange={(e) => updateModifierOption(idx, 'price', parseFloat(e.target.value) || 0)}
                      className="form-input pl-8 pr-2 font-mono font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeModifierOption(idx)}
                    className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                    title="Remove Option"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsModifierModalOpen(false)}
              className="px-5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all"
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
        title={
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-brand-50 dark:bg-brand-950/50 rounded-xl text-brand-600 dark:text-brand-400">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingProduct ? 'Edit Menu Product & Recipe' : 'Add New Menu Item'}
              </h3>
              <p className="text-xs text-slate-500 font-normal mt-0.5">Configure selling prices, prep station, addon options, and FIFO recipe formulations</p>
            </div>
          </div>
        }
        maxWidth="5xl"
      >
        <form onSubmit={handleSaveProduct} className="space-y-5">
          {/* Section 1: Item Basic Identifiers */}
          <div className="bg-slate-50/80 dark:bg-slate-850/60 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="form-label">Product Name (English) <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Special Mutton Karahi Full"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  className="form-input text-base font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="form-label">Category <span className="text-rose-500">*</span></label>
                <select
                  required
                  value={productForm.categoryId}
                  onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value, subCategoryId: '' })}
                  className="form-select font-semibold"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.parent_name ? `↳ ${c.name}` : c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Subcategory <span className="text-slate-400 font-normal">(Optional)</span></label>
                <select
                  value={productForm.subCategoryId || ''}
                  onChange={(e) => setProductForm({ ...productForm, subCategoryId: e.target.value || null })}
                  className="form-select font-semibold"
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
                <label className="form-label">Prep Station <span className="text-rose-500">*</span></label>
                <select
                  value={productForm.station}
                  onChange={(e) => setProductForm({ ...productForm, station: e.target.value as any })}
                  className="form-select font-semibold"
                >
                  <option value={PrepStation.KITCHEN}>Kitchen / Main Station</option>
                  <option value={PrepStation.DRINKS}>Beverage Bar / Drinks</option>
                  <option value={PrepStation.BBQ}>Live BBQ / Grill Station</option>
                  <option value={PrepStation.DESSERTS}>Dessert Counter</option>
                  <option value={PrepStation.PACKAGING}>Packaging / Dispatch Counter</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="form-label">SKU Code <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="SKU-101"
                  value={productForm.sku}
                  onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                  className="form-input font-mono font-bold"
                />
              </div>
              <div>
                <label className="form-label">Barcode / UPC</label>
                <input
                  type="text"
                  placeholder="Optional"
                  value={productForm.barcode}
                  onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })}
                  className="form-input font-mono"
                />
              </div>
              <div>
                <label className="form-label">Selling Price ({currencySymbol}) <span className="text-rose-500">*</span></label>
                <input
                  type="number"
                  required
                  min={0}
                  step="any"
                  value={productForm.basePrice}
                  onChange={(e) => setProductForm({ ...productForm, basePrice: parseFloat(e.target.value) || 0 })}
                  className="form-input font-mono font-bold text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="form-label mb-0">Cost Price ({currencySymbol})</label>
                  {modalCalculatedCost > 0 && (
                    <button
                      type="button"
                      onClick={() => setProductForm({ ...productForm, costPrice: parseFloat(modalCalculatedCost.toFixed(2)) })}
                      className="text-xs text-brand-600 dark:text-brand-400 font-bold hover:underline"
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
                  placeholder={modalCalculatedCost > 0 ? modalCalculatedCost.toFixed(2) : '0.00'}
                  value={productForm.costPrice || ''}
                  onChange={(e) => setProductForm({ ...productForm, costPrice: parseFloat(e.target.value) || 0 })}
                  className="form-input font-mono text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Real-time Profitability & Margin Preview Card */}
          <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="w-4 h-4" />
              </div>
              <span className="font-bold text-slate-900 dark:text-white text-sm">Unit Profitability:</span>
              <span className="text-slate-500">Effective Cost: <strong className="font-mono text-slate-800 dark:text-slate-200">{currencySymbol} {effectiveCostPrice.toFixed(2)}</strong></span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500">Gross Profit: <strong className="font-mono text-emerald-600 dark:text-emerald-400 text-sm font-bold">{currencySymbol} {modalGrossProfit.toFixed(2)}</strong></span>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-slate-500 font-medium">Gross Margin:</span>
              <span
                className={`px-3 py-1 rounded-full font-black text-xs ${
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
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-amber-50/20 dark:bg-amber-950/10 space-y-3">
              <div>
                <label className="font-bold text-slate-900 dark:text-white flex items-center space-x-2 text-xs uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Attach Addon Groups (Extra Sauces, Cheese, Upgrades)</span>
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Selected addons will be presented as customization options when this item is tapped in POS.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
                      className={`flex items-start space-x-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        isChecked
                          ? 'border-amber-400 bg-amber-50/80 dark:bg-amber-950/50 shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300'
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
                        className="mt-0.5 rounded text-amber-500 focus:ring-amber-400 w-4 h-4"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-slate-900 dark:text-white block">{mg.name}</span>
                        {optNames && <span className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{optNames}</span>}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Embedded Recipe Ingredients Section */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-slate-50 dark:bg-slate-850 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
              <div>
                <span className="font-bold text-slate-900 dark:text-white flex items-center space-x-2 text-xs uppercase tracking-wider">
                  <ChefHat className="w-4 h-4 text-brand-500" />
                  <span>Recipe Formulation & Automatic Stock Depletion</span>
                </span>
                <p className="text-xs text-slate-500 mt-0.5">
                  Raw materials deducted automatically upon sale via First-In, First-Out (FIFO) costing.
                </p>
              </div>

              <button
                type="button"
                onClick={addRecipeIngredient}
                className="px-3.5 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold text-xs flex items-center space-x-1.5 transition-all shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Ingredient Line</span>
              </button>
            </div>

            {productForm.recipe.ingredients.length === 0 ? (
              <div className="py-6 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-xs">
                No recipe ingredients linked yet. Click "Add Ingredient Line" to configure automatic batch stock deduction.
              </div>
            ) : (
              <div className="space-y-3">
                {productForm.recipe.ingredients.map((item, idx) => {
                  const ing = ingredients.find((i) => i.id === item.ingredientId);
                  const baseU = ing ? (ing.base_unit || ing.unit || 'G') : (item.unit || 'G');
                  const recipeU = item.recipeUnit || baseU;
                  const enteredQ = Number(item.enteredQuantity !== undefined ? item.enteredQuantity : item.quantity) || 0;
                  const factor = Number(ing?.conversion_factor || 1);
                  const baseQ = convertRecipeQtyToBase(enteredQ, recipeU, baseU, factor);
                  const lineCost = (Number(ing?.cost_per_unit || 0)) * baseQ;

                  return (
                    <div
                      key={idx}
                      className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="flex-1">
                          <select
                            value={item.ingredientId}
                            onChange={(e) => updateRecipeIngredient(idx, 'ingredientId', e.target.value)}
                            className="form-select font-semibold"
                          >
                            {ingredients.map((ingItem) => (
                              <option key={ingItem.id} value={ingItem.id}>
                                {ingItem.name} ({ingItem.category || 'General'} • Base: {ingItem.base_unit || ingItem.unit})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="w-32">
                          <input
                            type="number"
                            step="any"
                            min={0.0001}
                            required
                            value={enteredQ}
                            onChange={(e) => updateRecipeIngredient(idx, 'enteredQuantity', e.target.value)}
                            className="form-input font-mono font-bold text-center"
                            placeholder="Qty"
                          />
                        </div>

                        <div className="w-32">
                          <select
                            value={recipeU}
                            onChange={(e) => updateRecipeIngredient(idx, 'recipeUnit', e.target.value)}
                            className="form-select font-mono font-bold"
                          >
                            {getCompatibleUnits(baseU).map((u) => (
                              <option key={u.code} value={u.code}>
                                {u.code}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="w-32 text-right font-mono text-slate-800 dark:text-slate-200 font-bold text-sm">
                          {currencySymbol} {lineCost.toFixed(2)}
                        </div>

                        <button
                          type="button"
                          onClick={() => removeRecipeIngredient(idx)}
                          className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                          title="Remove Ingredient"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-xs px-1 text-slate-500 pt-1">
                        <span className="font-mono bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
                          Portion Deduction: <strong className="text-brand-600 dark:text-brand-400 font-bold">{enteredQ.toLocaleString()} {recipeU}</strong> per serving
                        </span>
                        <span className="font-mono text-slate-500 text-xs">
                          FIFO Ingredient Cost: <strong className="text-slate-700 dark:text-slate-300 font-bold">{currencySymbol} {lineCost.toFixed(2)}</strong>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsProductModalOpen(false)}
              className="px-5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-7 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all"
            >
              {editingProduct ? 'Update Product & Recipe' : 'Save Product & Recipe'}
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
                {viewingRecipeProduct?.recipe?.ingredients?.map((ri: any, idx: number) => {
                  const enteredQ = ri.enteredQuantity !== undefined ? ri.enteredQuantity : ri.entered_quantity;
                  const recipeU = ri.recipeUnit || ri.recipe_unit;
                  const isConverted = enteredQ && recipeU && recipeU !== ri.unit;
                  const qtyDisplay = isConverted
                    ? `${enteredQ} ${recipeU} (${ri.quantity} ${ri.unit})`
                    : `${ri.quantity} ${ri.unit}`;

                  return (
                    <tr key={idx}>
                      <td className="px-3 py-2 font-bold text-slate-900 dark:text-white">{ri.ingredientName || 'Raw Item'}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-slate-800 dark:text-slate-200">{qtyDisplay}</td>
                      <td className="px-3 py-2 text-right font-bold text-slate-900 dark:text-white">{currencySymbol} {Number(ri.unitCost || 0).toFixed(4)}/{ri.unit}</td>
                    </tr>
                  );
                })}
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
