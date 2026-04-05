'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Package, Plus, Search, Filter, AlertTriangle, TrendingDown,
    Edit2, Trash2, BarChart3, RefreshCw, DollarSign
} from 'lucide-react';
import { inventoryService } from '@/services/inventory';
import type { InventoryProduct, InventoryCategory } from '@/lib/types';
import Input from '@/components/shared/Input';
import Button from '@/components/shared/Button';
import ProductFormModal from '@/components/inventory/ProductFormModal';

export default function InventoryPage() {
    const [products, setProducts] = useState<InventoryProduct[]>([]);
    const [lowStockProducts, setLowStockProducts] = useState<InventoryProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<InventoryCategory | 'All'>('All');
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<InventoryProduct | null>(null);

    const categories: Array<InventoryCategory | 'All'> = ['All', 'Hair Care', 'Skin Care', 'Tools', 'Supplies', 'Other'];

    useEffect(() => {
        loadProducts();
    }, []);

    const loadProducts = async () => {
        try {
            setLoading(true);
            const [allProducts, lowStock] = await Promise.all([
                inventoryService.getProducts(),
                inventoryService.getLowStockProducts()
            ]);
            setProducts(allProducts);
            setLowStockProducts(lowStock);
        } catch (error) {
            console.error('Error loading products:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        if (query.trim()) {
            const results = await inventoryService.searchProducts(query);
            setProducts(results);
        } else {
            loadProducts();
        }
    };

    const getStockStatus = (product: InventoryProduct) => {
        if (product.current_stock === 0) {
            return { color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-700', icon: '❌', label: 'Out of Stock' };
        } else if (product.current_stock < product.min_stock_level) {
            return { color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/20', icon: '🔴', label: 'Low Stock' };
        } else if (product.current_stock === product.min_stock_level) {
            return { color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/20', icon: '⚠️', label: 'At Minimum' };
        } else {
            return { color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/20', icon: '✅', label: 'In Stock' };
        }
    };

    const filteredProducts = selectedCategory === 'All'
        ? products
        : products.filter(p => p.category === selectedCategory);

    const totalValue = products.reduce((sum, p) => sum + (p.current_stock * p.cost_per_unit), 0);
    const lowStockCount = lowStockProducts.length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Inventory Management</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Manage salon products and stock levels
                    </p>
                </div>
                <Button onClick={() => setShowAddModal(true)}>
                    <Plus className="h-5 w-5 mr-2" />
                    Add Product
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="card p-6 surface-panel">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-xl">
                            <Package className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{products.length}</p>
                            <p className="text-sm text-gray-500">Total Products</p>
                        </div>
                    </div>
                </div>

                <div className="card p-6 surface-panel">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-xl">
                            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{lowStockCount}</p>
                            <p className="text-sm text-gray-500">Low Stock Items</p>
                        </div>
                    </div>
                </div>

                <div className="card p-6 surface-panel">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-xl">
                            <DollarSign className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                LKR {totalValue.toLocaleString()}
                            </p>
                            <p className="text-sm text-gray-500">Total Inventory Value</p>
                        </div>
                    </div>
                </div>

                <div className="card p-6 surface-panel">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-xl">
                            <BarChart3 className="h-6 w-6 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                {categories.length - 1}
                            </p>
                            <p className="text-sm text-gray-500">Categories</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Low Stock Alert */}
            {lowStockCount > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4"
                >
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5 text-yellow-600" />
                        <p className="text-yellow-800 dark:text-yellow-200 font-medium">
                            {lowStockCount} product{lowStockCount > 1 ? 's' : ''} running low on stock. Restock soon!
                        </p>
                    </div>
                </motion.div>
            )}

            {/* Filters and Search */}
            <div className="card p-4 surface-panel">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <Input
                                type="text"
                                placeholder="Search by name, SKU, or description..."
                                value={searchQuery}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearch(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {categories.map((category) => (
                            <button
                                key={category}
                                onClick={() => setSelectedCategory(category)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedCategory === category
                                    ? 'bg-primary-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                    }`}
                            >
                                {category}
                            </button>
                        ))}
                    </div>
                    <Button variant="outline" onClick={loadProducts}>
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Products Table */}
            <div className="card surface-panel overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-700/50">
                            <tr>
                                <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Product</th>
                                <th className="hidden md:table-cell px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</th>
                                <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Stock</th>
                                <th className="hidden md:table-cell px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Price</th>
                                <th className="px-3 sm:px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-3 sm:px-4 py-8 text-center text-gray-500">
                                        Loading products...
                                    </td>
                                </tr>
                            ) : filteredProducts.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-3 sm:px-4 py-8 text-center text-gray-500">
                                        No products found
                                    </td>
                                </tr>
                            ) : (
                                filteredProducts.map((product) => {
                                    const status = getStockStatus(product);
                                    return (
                                        <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                            <td className="px-3 sm:px-4 py-4">
                                                <div>
                                                    <p className="font-medium text-gray-900 dark:text-white">{product.name}</p>
                                                    {product.sku && (
                                                        <p className="text-xs text-gray-500">SKU: {product.sku}</p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="hidden md:table-cell px-3 sm:px-4 py-4 text-sm text-gray-900 dark:text-white">
                                                {product.category}
                                            </td>
                                            <td className="px-3 sm:px-4 py-4">
                                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                    {product.current_stock} {product.unit}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    Min: {product.min_stock_level} {product.unit}
                                                </p>
                                            </td>
                                            <td className="hidden md:table-cell px-3 sm:px-4 py-4">
                                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                                                    <span>{status.icon}</span>
                                                    {status.label}
                                                </span>
                                            </td>
                                            <td className="px-3 sm:px-4 py-4 text-sm text-gray-900 dark:text-white">
                                                LKR {product.selling_price.toLocaleString()}
                                            </td>
                                            <td className="px-3 sm:px-4 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => setEditingProduct(product)}
                                                        className="p-2 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                                                        title="Edit product"
                                                    >
                                                        <Edit2 className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={async () => {
                                                            if (confirm(`Delete ${product.name}?`)) {
                                                                await inventoryService.deleteProduct(product.id);
                                                                loadProducts();
                                                            }
                                                        }}
                                                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                        title="Delete product"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Product Form Modal */}
            <ProductFormModal
                isOpen={showAddModal || !!editingProduct}
                onClose={() => {
                    setShowAddModal(false);
                    setEditingProduct(null);
                }}
                product={editingProduct}
                onSuccess={loadProducts}
            />
        </div>
    );
}
