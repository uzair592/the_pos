import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { Modal } from '../../components/common/Modal.js';
import { Utensils, Plus, Search, Edit2, Trash2, Tag, Layers, Check } from 'lucide-react';
import { PrepStation } from '@pos/shared';

export const MenuCatalog: React.FC = () => {
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Modals
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);

  // Forms
  const [categoryForm, setCategoryForm] = useState({ name: '', nameUrdu: '', sortOrder: 0 });
  const [productForm, setProductForm] = useState({
    name: '',
    nameUrdu: '',
    categoryId: '',
    sku: '',
    barcode: '',
    basePrice: 500,
    costPrice: 200,
    station: PrepStation.KITCHEN,
    trackInventory: true,
  });

  const fetchData = async () => {
    try {
      const [catsRes, prodsRes] = await Promise.all([
        api.get('/menu/categories'),
        api.get('/menu/products'),
      ]);
      setCategories(catsRes.categories || []);
      setProducts(prodsRes.products || []);
      if (catsRes.categories?.length > 0 && !productForm.categoryId) {
        setProductForm((prev) => ({ ...prev, categoryId: catsRes.categories[0].id }));
      }
    } catch (err) {
      console.error('Failed to load menu data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/menu/categories', categoryForm);
      setIsCategoryModalOpen(false);
      setCategoryForm({ name: '', nameUrdu: '', sortOrder: 0 });
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to create category');
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/menu/products', {
        ...productForm,
        basePrice: Number(productForm.basePrice),
        costPrice: Number(productForm.costPrice),
      });
      setIsProductModalOpen(false);
      setProductForm({
        name: '',
        nameUrdu: '',
        categoryId: categories[0]?.id || '',
        sku: '',
        barcode: '',
        basePrice: 500,
        costPrice: 200,
        station: PrepStation.KITCHEN,
        trackInventory: true,
      });
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to create product');
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

  return (
    <div className="p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Menu & Products Catalog</h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage your restaurant categories, menu products, prices, and preparation stations
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsCategoryModalOpen(true)}
            className="flex items-center space-x-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3.5 py-2 rounded-xl font-bold text-xs shadow-sm transition-all"
          >
            <Tag className="w-4 h-4 text-brand-600" />
            <span>Add Category</span>
          </button>
          <button
            onClick={() => setIsProductModalOpen(true)}
            className="flex items-center space-x-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Categories & Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex items-center space-x-2 overflow-x-auto w-full sm:w-auto pb-1 text-xs">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-colors ${
              selectedCategory === 'ALL' ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            All ({products.length})
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-colors ${
                selectedCategory === c.id ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search menu items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800"
          />
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
              <tr>
                <th className="px-6 py-3.5">Item Name</th>
                <th className="px-6 py-3.5">Category</th>
                <th className="px-6 py-3.5">SKU / Barcode</th>
                <th className="px-6 py-3.5">Selling Price</th>
                <th className="px-6 py-3.5">Cost Price</th>
                <th className="px-6 py-3.5">Station</th>
                <th className="px-6 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-400">
                    Loading menu catalog...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-400">
                    No products found. Click "Add Product" to create your first menu item.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="font-bold text-slate-900 text-sm">{p.name}</div>
                      {p.name_urdu && (
                        <div className="font-urdu text-xs text-slate-500" dir="rtl">{p.name_urdu}</div>
                      )}
                    </td>
                    <td className="px-6 py-3.5 font-semibold text-slate-600">
                      {p.category_name}
                    </td>
                    <td className="px-6 py-3.5 font-mono text-slate-500">
                      {p.sku}
                    </td>
                    <td className="px-6 py-3.5 font-extrabold text-slate-900">
                      PKR {Number(p.base_price).toLocaleString()}
                    </td>
                    <td className="px-6 py-3.5 text-slate-600">
                      PKR {Number(p.cost_price || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                        {p.station}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        p.is_available ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {p.is_available ? 'Available' : 'Unavailable'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add Category */}
      <Modal isOpen={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)} title="Add Menu Category" maxWidth="sm">
        <form onSubmit={handleCreateCategory} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Category Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Traditional Karahi"
              value={categoryForm.name}
              onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-xs"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Urdu Name (اردو نام)</label>
            <input
              type="text"
              dir="rtl"
              placeholder="مثلاً روایتی کڑاہی"
              value={categoryForm.nameUrdu}
              onChange={(e) => setCategoryForm({ ...categoryForm, nameUrdu: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-xs font-urdu"
            />
          </div>
          <button type="submit" className="w-full bg-brand-500 text-white font-bold py-2 rounded-lg">
            Create Category
          </button>
        </form>
      </Modal>

      {/* Modal: Add Product */}
      <Modal isOpen={isProductModalOpen} onClose={() => setIsProductModalOpen(false)} title="Add Product Item" maxWidth="lg">
        <form onSubmit={handleCreateProduct} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Product Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Chicken Shinwari Karahi"
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={productForm.categoryId}
                onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-xs"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Urdu Name (اردو نام)</label>
              <input
                type="text"
                dir="rtl"
                placeholder="چکن شنواری کڑاہی"
                value={productForm.nameUrdu}
                onChange={(e) => setProductForm({ ...productForm, nameUrdu: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-xs font-urdu"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">SKU / Item Code</label>
              <input
                type="text"
                required
                placeholder="KRH-SHIN-01"
                value={productForm.sku}
                onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Selling Price (PKR)</label>
              <input
                type="number"
                min="0"
                required
                value={productForm.basePrice}
                onChange={(e) => setProductForm({ ...productForm, basePrice: parseFloat(e.target.value) || 0 })}
                className="w-full border rounded-lg px-3 py-2 text-xs font-bold"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Estimated Cost Price (PKR)</label>
              <input
                type="number"
                min="0"
                value={productForm.costPrice}
                onChange={(e) => setProductForm({ ...productForm, costPrice: parseFloat(e.target.value) || 0 })}
                className="w-full border rounded-lg px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Kitchen Prep Station</label>
              <select
                value={productForm.station}
                onChange={(e) => setProductForm({ ...productForm, station: e.target.value as any })}
                className="w-full border rounded-lg px-3 py-2 text-xs font-bold"
              >
                <option value={PrepStation.KITCHEN}>Kitchen (Main Cooking)</option>
                <option value={PrepStation.BBQ}>BBQ / Grill</option>
                <option value={PrepStation.DRINKS}>Drinks / Beverages</option>
                <option value={PrepStation.DESSERTS}>Desserts / Bakery</option>
                <option value={PrepStation.PACKAGING}>Packaging / Dispatch</option>
              </select>
            </div>
            <div className="flex items-center pt-5">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={productForm.trackInventory}
                  onChange={(e) => setProductForm({ ...productForm, trackInventory: e.target.checked })}
                  className="rounded text-brand-500 focus:ring-brand-500"
                />
                <span className="font-semibold text-slate-700">Track Recipe Inventory Deductions</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t">
            <button
              type="button"
              onClick={() => setIsProductModalOpen(false)}
              className="px-4 py-2 border rounded-lg text-slate-600"
            >
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-brand-500 text-white rounded-lg font-bold">
              Save Product Item
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
