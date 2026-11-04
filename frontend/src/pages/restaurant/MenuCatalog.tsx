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
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Modals
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);

  const [isModifierModalOpen, setIsModifierModalOpen] = useState(false);
  const [editingModifierGroup, setEditingModifierGroup] = useState<any | null>(null);

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [viewingRecipeProduct, setViewingRecipeProduct] = useState<any | null>(null);
  const [previewProduct, setPreviewProduct] = useState<any | null>(null);

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

  const addModifierOptionRow = () => {
    setModifierForm((prev) => ({
      ...prev,
      options: [...prev.options, { name: '', price: 50, isDefault: false }],
    }));
  };

  const removeModifierOptionRow = (index: number) => {
    if (modifierForm.options.length <= 1) return;
    setModifierForm((prev) => ({
      ...prev,
      options: prev.options.filter((_, idx) => idx !== index),
    }));
  };

  const updateModifierOptionRow = (index: number, field: string, val: any) => {
    setModifierForm((prev) => {
      const newOpts = [...prev.options];
      newOpts[index] = { ...newOpts[index], [field]: val };
      return { ...prev, options: newOpts };
    });
  };

  // Product Handlers
  const handleOpenCreateProduct = () => {
    setEditingProduct(null);
    setProductForm({
      name: '',
      nameUrdu: '',
      categoryId: categories[0]?.id || '',
      sku: `PROD-${Date.now().toString().slice(-4)}`,
      barcode: '',
      basePrice: 500,
      costPrice: 0,
      station: PrepStation.KITCHEN,
      trackInventory: true,
      modifierGroupIds: [],
      recipe: {
        yieldCount: 1,
        ingredients: [],
      },
    });
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (prod: any) => {
    setEditingProduct(prod);
    setProductForm({
      name: prod.name,
      nameUrdu: prod.name_urdu || '',
      categoryId: prod.category_id,
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

  // Recipe Ingredient Rows in Product Modal
  const addRecipeIngredient = () => {
    if (ingredients.length === 0) {
      error('No ingredients defined in Inventory. Please add raw ingredients first.');
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
      nameUrdu: prod.name_urdu ? `${prod.name_urdu} (کاپی)` : '',
      categoryId: prod.category_id,
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

  // Toggle Availability
  const handleToggleAvailability = async (prod: any) => {
    try {
      const newStatus = prod.is_available === false;
      await api.put(`/menu/products/${prod.id}`, { isAvailable: newStatus });
      success(`"${prod.name}" marked as ${newStatus ? 'In Stock (Available)' : 'Out of Stock (Unavailable)'}`);
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

  // Filter products by search and category/sub-category
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      (p.name_urdu && p.name_urdu.includes(search));

    let matchesCategory = true;
    if (selectedCategory !== 'ALL') {
      const selectedCat = categories.find((c) => c.id === selectedCategory);
      if (selectedCat) {
        // If main category, match products of this category OR its sub-categories
        const subCatIds = categories.filter((c) => c.parent_id === selectedCategory).map((c) => c.id);
        matchesCategory = p.category_id === selectedCategory || subCatIds.includes(p.category_id);
      }
    }
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-500 to-amber-500 flex items-center justify-center text-white shadow-md">
              <Utensils className="w-5 h-5" />
            </div>
            <span>Menu Catalog & Addons Management</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Organize main & sub-categories, configure item add-ons & extra sauces, and track exact recipe gross margins.
          </p>
        </div>

        {/* Tab Switcher & Action Button */}
        <div className="flex items-center space-x-3">
          <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab('PRODUCTS')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'PRODUCTS'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Utensils className="w-3.5 h-3.5" />
              <span>Products ({products.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('CATEGORIES')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'CATEGORIES'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FolderTree className="w-3.5 h-3.5" />
              <span>Categories & Sub-Categories ({categories.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('MODIFIERS')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'MODIFIERS'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Addons & Extra Sauces ({modifierGroups.length})</span>
            </button>
          </div>

          {activeTab === 'PRODUCTS' ? (
            <button
              onClick={handleOpenCreateProduct}
              className="flex items-center space-x-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold shadow-md transition-all shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>New Product</span>
            </button>
          ) : activeTab === 'CATEGORIES' ? (
            <button
              onClick={handleOpenCreateCategory}
              className="flex items-center space-x-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold shadow-md transition-all shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>New Category / Sub-Category</span>
            </button>
          ) : (
            <button
              onClick={handleOpenCreateModifier}
              className="flex items-center space-x-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold shadow-md transition-all shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>New Addon Group</span>
            </button>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: MENU PRODUCTS & RECIPE MARGINS */}
      {/* ======================================================== */}
      {activeTab === 'PRODUCTS' && (
        <div className="space-y-4">
          {/* Controls Bar: Search & Category Filter */}
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search products by English or Urdu name, SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="flex items-center space-x-2 overflow-x-auto text-xs font-bold">
              <button
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                  selectedCategory === 'ALL'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                All Products
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCategory(c.id)}
                  className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                    selectedCategory === c.id
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {c.parent_name ? `↳ ${c.name}` : c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Products Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Item Details</th>
                    <th className="px-4 py-3">Category / Sub-Category</th>
                    <th className="px-4 py-3">Station</th>
                    <th className="px-4 py-3 text-right">Selling Price</th>
                    <th className="px-4 py-3 text-right">Recipe Cost</th>
                    <th className="px-4 py-3 text-right">Gross Profit</th>
                    <th className="px-4 py-3 text-center">Profit Margin %</th>
                    <th className="px-4 py-3 text-center">Addons</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200 font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                        Loading menu products & recipe margins...
                      </td>
                    </tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                        <Utensils className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                        <p className="font-bold text-slate-600 dark:text-slate-300">No products found</p>
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

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                              <span>{p.name}</span>
                              {p.name_urdu && <span className="text-[11px] font-urdu text-slate-400 font-normal">({p.name_urdu})</span>}
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">SKU: {p.sku}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-semibold border border-slate-200 dark:border-slate-700">
                              {p.category_name || 'Unassigned'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded bg-brand-500/10 text-brand-600 dark:text-brand-400 text-[10px] font-bold uppercase">
                              {p.station}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-white text-sm">
                            {currencySymbol} {basePrice.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-400">
                            {currencySymbol} {costPrice.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {currencySymbol} {grossProfit.toFixed(2)}
                          </td>
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
                          <td className="px-4 py-3 text-right whitespace-nowrap">
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
                                  label: 'Duplicate Item',
                                  icon: Copy,
                                  onClick: () => handleDuplicateProduct(p),
                                },
                                hasRecipe && {
                                  label: 'Recipe Ingredients',
                                  icon: ChefHat,
                                  onClick: () => setViewingRecipeProduct(p),
                                },
                                {
                                  label: p.is_available === false ? 'Mark In Stock' : 'Mark Out of Stock',
                                  icon: Power,
                                  variant: p.is_available === false ? 'success' : 'warning',
                                  divider: true,
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
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: MENU CATEGORIES & SUB-CATEGORIES */}
      {/* ======================================================== */}
      {activeTab === 'CATEGORIES' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center space-x-1.5">
                <FolderTree className="w-4 h-4 text-brand-500" />
                <span>Categories & Sub-Categories Hierarchy</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Organize menu structure with parent categories and touch-friendly POS sub-category chips.
              </p>
            </div>
            <button
              onClick={handleOpenCreateCategory}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Category</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Category Name</th>
                  <th className="px-4 py-3">Urdu Name</th>
                  <th className="px-4 py-3">Hierarchy / Parent</th>
                  <th className="px-4 py-3 text-center">Linked Products</th>
                  <th className="px-4 py-3 text-center">Sort Order</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200 font-medium">
                {categories.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                      {c.parent_name ? (
                        <span className="text-slate-400 font-mono text-sm ml-3">↳</span>
                      ) : (
                        <Tag className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                      )}
                      <span>{c.name}</span>
                    </td>
                    <td className="px-4 py-3 font-urdu text-sm text-slate-500 dark:text-slate-400">
                      {c.name_urdu || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {c.parent_name ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                          <span>Sub of {c.parent_name}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                          <span>📁 Main Category</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-bold font-mono">
                      {c.product_count || 0}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-slate-500">
                      {c.sort_order || 0}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <ActionMenu
                        items={[
                          {
                            label: 'Edit Category',
                            icon: Edit2,
                            onClick: () => handleOpenEditCategory(c),
                          },
                          !c.parent_id && {
                            label: 'Add Sub-Category',
                            icon: Plus,
                            onClick: () => {
                              setEditingCategory(null);
                              setCategoryForm({
                                name: '',
                                nameUrdu: '',
                                sortOrder: (c.subCategories?.length || 0) + 1,
                                parentId: c.id,
                              });
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: ADDONS & MODIFIERS (Extra Sauces, Cheese, Sides) */}
      {/* ======================================================== */}
      {activeTab === 'MODIFIERS' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center space-x-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Product Addons, Extra Sauces & Modifiers</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Create customizable item add-ons (extra sauces, dips, cheese slices) that cashiers and waiters can select on the POS.
              </p>
            </div>
            <button
              onClick={handleOpenCreateModifier}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create Addon Group</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Addon Group Name</th>
                  <th className="px-4 py-3">Urdu Name</th>
                  <th className="px-4 py-3">Selection Rules</th>
                  <th className="px-4 py-3">Addon Items & Prices</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200 font-medium">
                {modifierGroups.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                      <Sparkles className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                      <p className="font-bold text-slate-600 dark:text-slate-300">No addon groups created yet</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Create add-on groups like "Extra Sauces & Dips" or "Burger Upgrades" for customers to customize items.
                      </p>
                    </td>
                  </tr>
                ) : (
                  modifierGroups.map((mg) => {
                    let opts = [];
                    try {
                      opts = Array.isArray(mg.options) ? mg.options : JSON.parse(mg.options || '[]');
                    } catch (_) {
                      opts = [];
                    }

                    return (
                      <tr key={mg.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                          <div className="flex items-center space-x-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span>{mg.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-urdu text-sm text-slate-500 dark:text-slate-400">
                          {mg.name_urdu || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                            {mg.is_required ? 'Required' : 'Optional'} (Max {mg.max_select || 5})
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5 max-w-md">
                            {opts.map((opt: any, i: number) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-[11px] font-bold flex items-center space-x-1"
                              >
                                <span>{opt.name}</span>
                                <span className="font-mono text-[10px] text-amber-600 dark:text-amber-400">
                                  (+{currencySymbol} {Number(opt.price || 0)})
                                </span>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <ActionMenu
                            items={[
                              {
                                label: 'Edit Addon Group',
                                icon: Edit2,
                                onClick: () => handleOpenEditModifier(mg),
                              },
                              {
                                label: 'Delete Addon Group',
                                icon: Trash2,
                                variant: 'danger',
                                onClick: () => handleDeleteModifierGroup(mg.id),
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

      {/* ======================================================== */}
      {/* MODAL 1: ADD / EDIT CATEGORY & SUB-CATEGORY */}
      {/* ======================================================== */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title={editingCategory ? 'Edit Menu Category / Sub-Category' : 'Create Menu Category / Sub-Category'}
        maxWidth="md"
      >
        <form onSubmit={handleSaveCategory} className="space-y-3 text-xs">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Category Name (English) *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Smash Burgers or Karahi Specialties"
              value={categoryForm.name}
              onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Urdu Name (اردو نام)
            </label>
            <input
              type="text"
              dir="rtl"
              placeholder="مثلاً سمیش برگرز"
              value={categoryForm.nameUrdu}
              onChange={(e) => setCategoryForm({ ...categoryForm, nameUrdu: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-urdu text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Parent Category (Optional - Select to make this a Sub-Category)
            </label>
            <select
              value={categoryForm.parentId || ''}
              onChange={(e) => setCategoryForm({ ...categoryForm, parentId: e.target.value || null })}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
            >
              <option value="">📁 None (Top-Level Main Category)</option>
              {categories
                .filter((c) => !c.parent_id && (!editingCategory || c.id !== editingCategory.id))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    ↳ Sub-category under: {c.name}
                  </option>
                ))}
            </select>
            <p className="text-[10px] text-slate-400 mt-1">
              Sub-categories appear as touch-friendly secondary filter chips on the POS terminal.
            </p>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Sort Order
            </label>
            <input
              type="number"
              value={categoryForm.sortOrder}
              onChange={(e) => setCategoryForm({ ...categoryForm, sortOrder: parseInt(e.target.value) || 0 })}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
            />
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
              Save Category
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Addon Group Name (English) *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Extra Sauces & Dips"
                value={modifierForm.name}
                onChange={(e) => setModifierForm({ ...modifierForm, name: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Urdu Name (اردو نام)
              </label>
              <input
                type="text"
                dir="rtl"
                placeholder="مثلاً اضافی ساس اور چٹنی"
                value={modifierForm.nameUrdu}
                onChange={(e) => setModifierForm({ ...modifierForm, nameUrdu: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-urdu text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Requirement
              </label>
              <select
                value={modifierForm.isRequired ? 'true' : 'false'}
                onChange={(e) => setModifierForm({ ...modifierForm, isRequired: e.target.value === 'true' })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
              >
                <option value="false">Optional (Customer can skip)</option>
                <option value="true">Mandatory (Must select at least 1)</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Min Selection
              </label>
              <input
                type="number"
                min="0"
                value={modifierForm.minSelect}
                onChange={(e) => setModifierForm({ ...modifierForm, minSelect: parseInt(e.target.value) || 0 })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-center"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Max Selection Allowed
              </label>
              <input
                type="number"
                min="1"
                value={modifierForm.maxSelect}
                onChange={(e) => setModifierForm({ ...modifierForm, maxSelect: parseInt(e.target.value) || 1 })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-center"
              />
            </div>
          </div>

          {/* Addon Options Editor */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-3 bg-slate-50/50 dark:bg-slate-900/40">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-extrabold text-slate-900 dark:text-white flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Addon Items & Prices</span>
                </h4>
                <p className="text-[10px] text-slate-400">
                  Individual extra items customer can select on the POS
                </p>
              </div>
              <button
                type="button"
                onClick={addModifierOptionRow}
                className="px-2.5 py-1 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-lg text-[11px] flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="space-y-2">
              {modifierForm.options.map((opt, idx) => (
                <div key={idx} className="flex items-center space-x-2 bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                  <input
                    type="text"
                    required
                    placeholder="e.g. Extra Garlic Mayo Sauce"
                    value={opt.name}
                    onChange={(e) => updateModifierOptionRow(idx, 'name', e.target.value)}
                    className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                  />
                  <div className="w-32 flex items-center space-x-1">
                    <span className="text-[11px] font-bold text-slate-400">{currencySymbol}</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      required
                      placeholder="Price"
                      value={opt.price}
                      onChange={(e) => updateModifierOptionRow(idx, 'price', parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:text-white text-right"
                    />
                  </div>
                  {modifierForm.options.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeModifierOptionRow(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg"
                      title="Remove Option"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
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
        title={editingProduct ? 'Edit Menu Product' : 'Add New Menu Product'}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Product Name (English) *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Smash Cheese Burger"
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Urdu Name (اردو نام)
              </label>
              <input
                type="text"
                dir="rtl"
                placeholder="مثلاً سمیش چیز برگر"
                value={productForm.nameUrdu}
                onChange={(e) => setProductForm({ ...productForm, nameUrdu: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-urdu text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Category / Sub-Category *
              </label>
              <select
                value={productForm.categoryId}
                onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.parent_name ? `  ↳ ${c.name} (Sub of ${c.parent_name})` : `📁 ${c.name}`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                SKU / Item Code *
              </label>
              <input
                type="text"
                required
                value={productForm.sku}
                onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white uppercase font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Kitchen Station (KDS)
              </label>
              <select
                value={productForm.station}
                onChange={(e) => setProductForm({ ...productForm, station: e.target.value as any })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              >
                {Object.values(PrepStation).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Pricing, Costing & Live Margin Card */}
          <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                  Selling Price ({currencySymbol}) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs select-none">
                    {currencySymbol}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={productForm.basePrice || ''}
                    onChange={(e) => setProductForm({ ...productForm, basePrice: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs font-black text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Retail menu selling price to customer</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-200">
                    Product Cost ({currencySymbol}) *
                  </label>
                  {modalCalculatedCost > 0 && (
                    <button
                      type="button"
                      onClick={() => setProductForm({ ...productForm, costPrice: Number(modalCalculatedCost.toFixed(2)) })}
                      className="text-[10px] text-brand-600 dark:text-brand-400 hover:text-brand-700 font-bold hover:underline flex items-center space-x-1"
                      title="Sync cost with current recipe calculation"
                    >
                      <Sparkles className="w-2.5 h-2.5" />
                      <span>Use Recipe Cost ({currencySymbol} {modalCalculatedCost.toFixed(2)})</span>
                    </button>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs select-none">
                    {currencySymbol}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={productForm.costPrice === 0 ? '' : productForm.costPrice}
                    onChange={(e) => setProductForm({ ...productForm, costPrice: parseFloat(e.target.value) || 0 })}
                    placeholder={modalCalculatedCost > 0 ? modalCalculatedCost.toFixed(2) : "0.00"}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs font-bold text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {modalCalculatedCost > 0
                    ? `Recipe ingredients estimate: ${currencySymbol} ${modalCalculatedCost.toFixed(2)}`
                    : 'Wholesale, preparation, or raw material cost per item'}
                </p>
              </div>
            </div>

            {/* Live Profitability & Margin Summary Strip */}
            <div className="pt-2.5 border-t border-slate-200/80 dark:border-slate-700/80 grid grid-cols-3 gap-2 text-center">
              <div className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[10px] text-slate-400 block font-semibold">Effective Cost</span>
                <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 font-mono">
                  {currencySymbol} {effectiveCostPrice.toFixed(2)}
                </span>
              </div>

              <div className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[10px] text-slate-400 block font-semibold">Gross Profit / Item</span>
                <span className={`text-xs font-black font-mono ${modalGrossProfit > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
                  {currencySymbol} {modalGrossProfit.toFixed(2)}
                </span>
              </div>

              <div className={`p-2 rounded-lg border flex flex-col justify-center ${
                modalGrossMarginPercent >= 50
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  : modalGrossMarginPercent >= 20
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
              }`}>
                <span className="text-[10px] opacity-80 block font-semibold">Profit Margin</span>
                <span className="text-xs font-black">
                  {modalGrossMarginPercent}%
                </span>
              </div>
            </div>
          </div>

          {/* Applicable Addon Groups Checkbox Selector */}
          {modifierGroups.length > 0 && (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-amber-50/30 dark:bg-amber-950/20">
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1 flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Attach Addon Groups (Extra Sauces, Cheese, Upgrades)</span>
              </label>
              <p className="text-[10px] text-slate-400 mb-2">
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
                      className={`flex items-start space-x-2.5 p-2 rounded-xl border cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-amber-100/70 dark:bg-amber-900/40 border-amber-400 dark:border-amber-700 text-slate-900 dark:text-white'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
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
                      <div className="flex-1 text-[11px]">
                        <span className="font-bold block">{mg.name}</span>
                        {optNames && <span className="text-[10px] text-slate-400 block truncate max-w-xs">{optNames}</span>}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Embedded Recipe Ingredients Section */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 space-y-3 bg-slate-50/50 dark:bg-slate-900/40">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-extrabold text-slate-900 dark:text-white flex items-center space-x-1.5">
                  <Scale className="w-4 h-4 text-brand-500" />
                  <span>Recipe Ingredients (FIFO Stock Deductions)</span>
                </h4>
                <p className="text-[10px] text-slate-400">
                  Ingredients deduct from inventory when orders complete
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-semibold text-slate-500">Yield Count:</span>
                <input
                  type="number"
                  min="1"
                  required
                  value={productForm.recipe.yieldCount}
                  onChange={(e) =>
                    setProductForm({
                      ...productForm,
                      recipe: { ...productForm.recipe, yieldCount: parseInt(e.target.value) || 1 },
                    })
                  }
                  className="w-16 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-center font-bold"
                />
              </div>
            </div>

            <div className="space-y-2">
              {productForm.recipe.ingredients.map((item, idx) => (
                <div key={idx} className="flex items-center space-x-2">
                  <select
                    value={item.ingredientId}
                    onChange={(e) => updateRecipeIngredient(idx, 'ingredientId', e.target.value)}
                    className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                  >
                    {ingredients.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({currencySymbol} {i.cost_per_unit}/{i.unit})
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => updateRecipeIngredient(idx, 'quantity', parseFloat(e.target.value) || 0)}
                    className="w-24 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white font-bold"
                  />

                  <span className="text-xs font-semibold text-slate-500 w-12">{item.unit}</span>

                  <button
                    type="button"
                    onClick={() => removeRecipeIngredient(idx)}
                    className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg"
                    title="Remove Ingredient"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={addRecipeIngredient}
                className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold rounded-lg text-xs flex items-center justify-center space-x-1 transition-colors border border-dashed border-slate-300 dark:border-slate-700"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Ingredient to Recipe</span>
              </button>
            </div>
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
              Save Product
            </button>
          </div>
        </form>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 4: VIEW RECIPE INGREDIENTS */}
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
      {/* PRODUCT PREVIEW MODAL */}
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
                  {previewProduct.name_urdu && (
                    <span className="text-xs text-slate-500 font-arabic">
                      ({previewProduct.name_urdu})
                    </span>
                  )}
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
                  <span>{previewProduct.is_available !== false ? 'In Stock (Available)' : 'Out of Stock (Unavailable)'}</span>
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
                    setViewingRecipeProduct(p);
                  }}
                  className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold flex items-center space-x-1.5 transition-colors"
                >
                  <ChefHat className="w-3.5 h-3.5" />
                  <span>Manage Recipe</span>
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
    </div>
  );
};
