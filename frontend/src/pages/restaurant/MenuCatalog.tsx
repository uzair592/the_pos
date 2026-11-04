import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { Modal } from '../../components/common/Modal.js';
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
} from 'lucide-react';
import { PrepStation } from '@pos/shared';

export const MenuCatalog: React.FC = () => {
  const { tenant } = useAuth();
  const { success, error } = useToast();

  const [activeTab, setActiveTab] = useState<'PRODUCTS' | 'CATEGORIES'>('PRODUCTS');
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Modals
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [viewingRecipeProduct, setViewingRecipeProduct] = useState<any | null>(null);

  // Category Form
  const [categoryForm, setCategoryForm] = useState({ name: '', nameUrdu: '', sortOrder: 0 });

  // Product Form with Recipe & Ingredients
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
    recipe: {
      yieldCount: 1,
      ingredients: [] as Array<{ ingredientId: string; quantity: number; unit: string }>,
    },
  });

  const currencySymbol = tenant?.currency_symbol || 'Rs.';

  const fetchData = async () => {
    try {
      const [catsRes, prodsRes, ingsRes] = await Promise.all([
        api.get('/menu/categories'),
        api.get('/menu/products'),
        api.get('/inventory/ingredients'),
      ]);
      setCategories(catsRes.categories || []);
      setProducts(prodsRes.products || []);
      setIngredients(ingsRes.ingredients || []);

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
    setCategoryForm({ name: '', nameUrdu: '', sortOrder: 0 });
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: any) => {
    setEditingCategory(cat);
    setCategoryForm({
      name: cat.name,
      nameUrdu: cat.name_urdu || '',
      sortOrder: cat.sort_order || 0,
    });
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        await api.put(`/menu/categories/${editingCategory.id}`, categoryForm);
        success('Category updated successfully');
      } else {
        await api.post('/menu/categories', categoryForm);
        success('Category created successfully');
      }
      setIsCategoryModalOpen(false);
      setCategoryForm({ name: '', nameUrdu: '', sortOrder: 0 });
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
      recipe: {
        yieldCount: prod.recipe?.yieldCount || 1,
        ingredients: prod.recipe?.ingredients?.map((ri: any) => ({
          ingredientId: ri.ingredientId,
          quantity: ri.quantity,
          unit: ri.unit,
        })) || [],
      },
    });
    setIsProductModalOpen(true);
  };

  // Dynamic Recipe Ingredient Rows in Product Modal
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

  const updateRecipeIngredient = (index: number, field: string, value: any) => {
    const next = [...productForm.recipe.ingredients];
    if (field === 'ingredientId') {
      const selected = ingredients.find((i) => i.id === value);
      next[index] = {
        ...next[index],
        ingredientId: value,
        unit: selected?.unit || next[index].unit,
      };
    } else {
      next[index] = { ...next[index], [field]: value };
    }
    setProductForm({
      ...productForm,
      recipe: { ...productForm.recipe, ingredients: next },
    });
  };

  const removeRecipeIngredient = (index: number) => {
    const next = productForm.recipe.ingredients.filter((_, i) => i !== index);
    setProductForm({
      ...productForm,
      recipe: { ...productForm.recipe, ingredients: next },
    });
  };

  // Real-time Recipe Cost & Profit Margin in Product Modal
  const modalCalculatedCost = React.useMemo(() => {
    const yieldCount = Number(productForm.recipe.yieldCount) || 1;
    let total = 0;
    for (const item of productForm.recipe.ingredients) {
      const ing = ingredients.find((i) => i.id === item.ingredientId);
      if (ing) {
        total += Number(item.quantity || 0) * Number(ing.cost_per_unit || 0);
      }
    }
    return total > 0 ? Number((total / yieldCount).toFixed(2)) : Number(productForm.costPrice || 0);
  }, [productForm.recipe, ingredients, productForm.costPrice]);

  const modalGrossProfit = Number(productForm.basePrice || 0) - modalCalculatedCost;
  const modalGrossMarginPercent = Number(productForm.basePrice || 0) > 0
    ? Number(((modalGrossProfit / Number(productForm.basePrice)) * 100).toFixed(1))
    : 0;

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...productForm,
        basePrice: Number(productForm.basePrice),
        costPrice: modalCalculatedCost,
      };

      if (editingProduct) {
        await api.put(`/menu/products/${editingProduct.id}`, payload);
        success('Menu product and recipe updated successfully');
      } else {
        await api.post('/menu/products', payload);
        success('Menu product created with linked recipe ingredients');
      }
      setIsProductModalOpen(false);
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to save product');
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCategory === 'ALL' || p.category_id === selectedCategory;
    const matchesSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Menu & Recipe System
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Menu catalog, ingredient recipe linking, real-time profit margin analysis, and category control
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleOpenCreateCategory}
            className="flex items-center space-x-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 px-3.5 py-2 rounded-xl font-bold text-xs shadow-sm transition-all"
          >
            <Tag className="w-4 h-4 text-brand-600" />
            <span>Add Category</span>
          </button>
          <button
            onClick={handleOpenCreateProduct}
            className="flex items-center space-x-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Menu Product</span>
          </button>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 dark:border-slate-800 pb-3 text-xs font-bold">
        <button
          onClick={() => setActiveTab('PRODUCTS')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all ${
            activeTab === 'PRODUCTS'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Utensils className="w-4 h-4" />
          <span>Menu Products ({products.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('CATEGORIES')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all ${
            activeTab === 'CATEGORIES'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Tag className="w-4 h-4" />
          <span>Menu Categories ({categories.length})</span>
        </button>
      </div>

      {/* Tab: Products Catalog with Recipe Ingredients & Profit Margins */}
      {activeTab === 'PRODUCTS' && (
        <div className="space-y-4">
          {/* Category Filter Pills & Search */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex items-center space-x-2 overflow-x-auto w-full sm:w-auto pb-1 text-xs">
              <button
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-colors ${
                  selectedCategory === 'ALL'
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                All Categories ({products.length})
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCategory(c.id)}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-colors ${
                    selectedCategory === c.id
                      ? 'bg-brand-500 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {c.name} ({c.product_count || 0})
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64 shrink-0">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search menu item or SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Products Table with Real Profit Margins & Recipes */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="px-5 py-3.5">Menu Item</th>
                    <th className="px-5 py-3.5">Category</th>
                    <th className="px-5 py-3.5">Recipe & Ingredients</th>
                    <th className="px-5 py-3.5 text-right">Selling Price</th>
                    <th className="px-5 py-3.5 text-right">Ingredient Cost</th>
                    <th className="px-5 py-3.5 text-right">Gross Profit</th>
                    <th className="px-5 py-3.5 text-center">Profit Margin %</th>
                    <th className="px-5 py-3.5">Station</th>
                    <th className="px-5 py-3.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-10 text-center text-slate-400 italic">
                        No menu products match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => {
                      const sellingPrice = Number(p.base_price || 0);
                      const costPrice = Number(p.calculatedCost || p.cost_price || 0);
                      const grossProfit = Number(p.grossProfit || sellingPrice - costPrice);
                      const marginPercent = Number(p.grossMarginPercent || 0);

                      const hasRecipe = p.recipe && p.recipe.ingredients && p.recipe.ingredients.length > 0;

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="font-bold text-slate-900 dark:text-white text-sm">{p.name}</div>
                            {p.name_urdu && (
                              <div className="font-urdu text-xs text-slate-500" dir="rtl">{p.name_urdu}</div>
                            )}
                            <div className="font-mono text-[10px] text-slate-400">{p.sku}</div>
                          </td>
                          <td className="px-5 py-3.5 font-semibold text-slate-600 dark:text-slate-300">
                            {p.category_name}
                          </td>
                          <td className="px-5 py-3.5">
                            {hasRecipe ? (
                              <div>
                                <button
                                  type="button"
                                  onClick={() => setViewingRecipeProduct(p)}
                                  className="flex items-center space-x-1.5 text-brand-600 dark:text-brand-400 font-bold hover:underline"
                                >
                                  <Scale className="w-3.5 h-3.5" />
                                  <span>{p.recipe.ingredients.length} Ingredient(s)</span>
                                </button>
                                <span className="text-[10px] text-slate-400 block mt-0.5 truncate max-w-[160px]">
                                  {p.recipe.ingredients.map((i: any) => i.ingredientName).join(', ')}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">No recipe linked</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right font-extrabold text-slate-900 dark:text-white text-sm">
                            {currencySymbol} {sellingPrice.toLocaleString()}
                          </td>
                          <td className="px-5 py-3.5 text-right font-semibold text-amber-600 dark:text-amber-400">
                            {currencySymbol} {costPrice.toLocaleString()}
                          </td>
                          <td className="px-5 py-3.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            {currencySymbol} {grossProfit.toLocaleString()}
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                                marginPercent >= 50
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                  : marginPercent >= 25
                                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                              }`}
                            >
                              {marginPercent}% Margin
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase">
                              {p.station}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <button
                              onClick={() => handleOpenEditProduct(p)}
                              className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors mr-1"
                              title="Edit Product & Recipe"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
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

      {/* Tab: Categories Management */}
      {activeTab === 'CATEGORIES' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Menu Categories & Sections</h3>
              <p className="text-xs text-slate-500">Configure visual layout order and category labels for POS register and digital menus</p>
            </div>
            <button
              onClick={handleOpenCreateCategory}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Category</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((c) => (
              <div
                key={c.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">{c.name}</h4>
                    {c.sort_order > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 font-mono text-slate-600 dark:text-slate-300">
                        #{c.sort_order}
                      </span>
                    )}
                  </div>
                  {c.name_urdu && <p className="font-urdu text-xs text-slate-500 mt-0.5" dir="rtl">{c.name_urdu}</p>}
                  <p className="text-xs text-brand-600 dark:text-brand-400 font-semibold mt-1">
                    {c.product_count || 0} Menu Products
                  </p>
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleOpenEditCategory(c)}
                    className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-white dark:hover:bg-slate-700 rounded-lg"
                    title="Edit Category"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(c.id)}
                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                    title="Delete Category"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: View Recipe Breakdown */}
      <Modal
        isOpen={!!viewingRecipeProduct}
        onClose={() => setViewingRecipeProduct(null)}
        title={`Recipe Ingredients: ${viewingRecipeProduct?.name || ''}`}
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
            <div>
              <p className="font-bold text-slate-900 dark:text-white">Yield: {viewingRecipeProduct?.recipe?.yieldCount || 1} Serving(s)</p>
              <p className="text-slate-400 text-[11px]">Selling Price: {currencySymbol} {Number(viewingRecipeProduct?.base_price).toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="font-black text-amber-600 dark:text-amber-400 text-sm">
                Cost: {currencySymbol} {Number(viewingRecipeProduct?.calculatedCost || 0).toLocaleString()}
              </p>
              <p className="font-bold text-emerald-600 dark:text-emerald-400 text-[11px]">
                Profit: {currencySymbol} {Number(viewingRecipeProduct?.grossProfit || 0).toLocaleString()} ({viewingRecipeProduct?.grossMarginPercent}%)
              </p>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-2">Required Ingredients (FIFO Deducted)</h4>
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase">
                  <tr>
                    <th className="px-3 py-2">Ingredient</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Unit Cost</th>
                    <th className="px-3 py-2 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {viewingRecipeProduct?.recipe?.ingredients?.map((ri: any) => (
                    <tr key={ri.id}>
                      <td className="px-3 py-2 font-bold text-slate-900 dark:text-white">{ri.ingredientName}</td>
                      <td className="px-3 py-2 text-right">{ri.quantity} {ri.unit}</td>
                      <td className="px-3 py-2 text-right text-slate-500">{currencySymbol} {ri.costPerUnit}</td>
                      <td className="px-3 py-2 text-right font-bold text-slate-900 dark:text-white">{currencySymbol} {ri.lineCost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => {
                const prod = viewingRecipeProduct;
                setViewingRecipeProduct(null);
                handleOpenEditProduct(prod);
              }}
              className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-lg text-xs"
            >
              Edit Recipe Ingredients
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Add / Edit Product with Embedded Recipe Builder */}
      <Modal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        title={editingProduct ? 'Edit Menu Product & Recipe' : 'Add New Menu Product & Recipe'}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Product Name (English)</label>
              <input
                type="text"
                required
                placeholder="e.g. Chicken Karahi Full"
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Urdu Name (اردو نام)</label>
              <input
                type="text"
                dir="rtl"
                placeholder="مثلاً چکن کڑاہی فل"
                value={productForm.nameUrdu}
                onChange={(e) => setProductForm({ ...productForm, nameUrdu: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-urdu text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Category</label>
              <select
                value={productForm.categoryId}
                onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">SKU / Code</label>
              <input
                type="text"
                required
                value={productForm.sku}
                onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white uppercase font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Kitchen Station (KDS)</label>
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Selling Price ({currencySymbol})
              </label>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={productForm.basePrice}
                onChange={(e) => setProductForm({ ...productForm, basePrice: parseFloat(e.target.value) || 0 })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-black text-slate-900 dark:text-white text-base"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Calculated Ingredient Cost ({currencySymbol})
              </label>
              <div className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-amber-600 dark:text-amber-400">
                {currencySymbol} {modalCalculatedCost.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Real-time Profit Margin Indicator Banner */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="font-bold text-slate-800 dark:text-slate-200">
                Projected Profit: {currencySymbol} {modalGrossProfit.toLocaleString()}
              </span>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full font-black text-xs ${
                modalGrossMarginPercent >= 50
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                  : modalGrossMarginPercent >= 25
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                  : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
              }`}
            >
              {modalGrossMarginPercent}% Margin
            </span>
          </div>

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
                    className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={addRecipeIngredient}
                className="flex items-center space-x-1 text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline pt-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Ingredient to Recipe</span>
              </button>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsProductModalOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl shadow-md transition-all"
            >
              {editingProduct ? 'Save Product Changes' : 'Create Menu Product'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add / Edit Category */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title={editingCategory ? 'Edit Category' : 'Add Category'}
        maxWidth="sm"
      >
        <form onSubmit={handleSaveCategory} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Category Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Traditional Karahi"
              value={categoryForm.name}
              onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Urdu Name (اردو نام)</label>
            <input
              type="text"
              dir="rtl"
              placeholder="مثلاً روایتی کڑاہی"
              value={categoryForm.nameUrdu}
              onChange={(e) => setCategoryForm({ ...categoryForm, nameUrdu: e.target.value })}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-urdu text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Sort Order</label>
            <input
              type="number"
              min="0"
              value={categoryForm.sortOrder}
              onChange={(e) => setCategoryForm({ ...categoryForm, sortOrder: parseInt(e.target.value) || 0 })}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-2.5 rounded-xl shadow-md transition-all"
          >
            {editingCategory ? 'Save Changes' : 'Create Category'}
          </button>
        </form>
      </Modal>
    </div>
  );
};
