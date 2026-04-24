import { supabase } from '@/lib/supabase';
import type { InventoryProduct, InventoryTransaction, InventoryCategory, InventoryTransactionType } from '@/lib/types';
import { getCurrentOrganizationId } from '@/lib/org-scope';

export const inventoryService = {
    /**
     * Get all inventory products
     */
    async getProducts(includeInactive = false) {
        const organizationId = await getCurrentOrganizationId();
        let query = supabase
            .from('inventory')
            .select('*')
            .eq('organization_id', organizationId)
            .order('name');

        if (!includeInactive) {
            query = query.eq('is_active', true);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data as InventoryProduct[];
    },

    /**
     * Get products by category
     */
    async getProductsByCategory(category: InventoryCategory) {
        const organizationId = await getCurrentOrganizationId();
        const { data, error } = await supabase
            .from('inventory')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('category', category)
            .eq('is_active', true)
            .order('name');

        if (error) throw error;
        return data as InventoryProduct[];
    },

    /**
     * Get low stock products
     */
    async getLowStockProducts() {
        const organizationId = await getCurrentOrganizationId();
        const { data, error } = await supabase
            .from('inventory')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('is_active', true)
            .order('current_stock', { ascending: true });

        if (error) {
            console.error('Error fetching low stock products:', error);
            return [];
        }

        // Filter products where current stock is at or below minimum level
        const products = data as InventoryProduct[];
        return products?.filter(p => p.current_stock <= p.min_stock_level) || [];
    },

    /**
     * Get product by ID
     */
    async getProductById(id: string) {
        const organizationId = await getCurrentOrganizationId();
        const { data, error } = await supabase
            .from('inventory')
            .select('*')
            .eq('id', id)
            .eq('organization_id', organizationId)
            .single();

        if (error) throw error;
        return data as InventoryProduct;
    },

    /**
     * Create new product
     */
    async createProduct(product: {
        name: string;
        category: InventoryCategory;
        description?: string;
        sku?: string;
        current_stock: number;
        min_stock_level: number;
        unit: string;
        cost_per_unit: number;
        selling_price: number;
        supplier?: string;
    }) {
        const organizationId = await getCurrentOrganizationId();
        const { data, error } = await supabase
            .from('inventory')
            .insert({
                ...product,
                organization_id: organizationId,
                last_restocked_at: product.current_stock > 0 ? new Date().toISOString() : null
            })
            .select()
            .single();

        if (error) throw error;

        // Log initial stock if > 0
        if (product.current_stock > 0 && data) {
            await this.logTransaction({
                inventory_id: data.id,
                transaction_type: 'restock',
                quantity: product.current_stock,
                notes: 'Initial stock'
            });
        }

        return data as InventoryProduct;
    },

    /**
     * Update product
     */
    async updateProduct(id: string, updates: Partial<InventoryProduct>) {
        const organizationId = await getCurrentOrganizationId();
        const { data, error } = await supabase
            .from('inventory')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .eq('organization_id', organizationId)
            .select()
            .single();

        if (error) throw error;
        return data as InventoryProduct;
    },

    /**
     * Delete product (soft delete)
     */
    async deleteProduct(id: string) {
        const organizationId = await getCurrentOrganizationId();
        const { error } = await supabase
            .from('inventory')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('organization_id', organizationId);

        if (error) throw error;
    },

    /**
     * Restock product
     */
    async restockProduct(id: string, quantity: number, notes?: string) {
        // Get current stock
        const product = await this.getProductById(id);

        const organizationId = await getCurrentOrganizationId();
        // Update stock
        const { data, error } = await supabase
            .from('inventory')
            .update({
                current_stock: product.current_stock + quantity,
                last_restocked_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .eq('organization_id', organizationId)
            .select()
            .single();

        if (error) throw error;

        // Log transaction
        await this.logTransaction({
            inventory_id: id,
            transaction_type: 'restock',
            quantity,
            notes: notes || `Restocked ${quantity} ${product.unit}`
        });

        return data as InventoryProduct;
    },

    /**
     * Adjust stock (manual correction)
     */
    async adjustStock(id: string, newQuantity: number, reason: string) {
        const product = await this.getProductById(id);
        const difference = newQuantity - product.current_stock;
        const organizationId = await getCurrentOrganizationId();

        const { data, error } = await supabase
            .from('inventory')
            .update({
                current_stock: newQuantity,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .eq('organization_id', organizationId)
            .select()
            .single();

        if (error) throw error;

        // Log transaction
        await this.logTransaction({
            inventory_id: id,
            transaction_type: 'adjustment',
            quantity: difference,
            notes: reason
        });

        return data as InventoryProduct;
    },

    /**
     * Deduct stock (for sales)
     */
    async deductStock(id: string, quantity: number, invoiceId?: string) {
        const product = await this.getProductById(id);

        if (product.current_stock < quantity) {
            throw new Error(`Insufficient stock. Available: ${product.current_stock}, Requested: ${quantity}`);
        }

        const organizationId = await getCurrentOrganizationId();
        const { data, error } = await supabase
            .from('inventory')
            .update({
                current_stock: product.current_stock - quantity,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .eq('organization_id', organizationId)
            .select()
            .single();

        if (error) throw error;

        // Log transaction
        await this.logTransaction({
            inventory_id: id,
            transaction_type: 'sale',
            quantity: -quantity, // Negative for deduction
            reference_id: invoiceId,
            notes: `Sold via invoice ${invoiceId?.slice(0, 8)}`
        });

        return data as InventoryProduct;
    },

    /**
     * Log inventory transaction
     */
    async logTransaction(transaction: {
        inventory_id: string;
        transaction_type: InventoryTransactionType;
        quantity: number;
        reference_id?: string;
        notes?: string;
        created_by?: string;
    }) {
        const organizationId = await getCurrentOrganizationId();
        const { error } = await supabase
            .from('inventory_transactions')
            .insert({ ...transaction, organization_id: organizationId });

        if (error) throw error;
    },

    /**
     * Get transaction history for a product
     */
    async getProductTransactions(inventoryId: string) {
        const organizationId = await getCurrentOrganizationId();
        const { data, error } = await supabase
            .from('inventory_transactions')
            .select('*')
            .eq('inventory_id', inventoryId)
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;
        return data as InventoryTransaction[];
    },

    /**
     * Search products
     */
    async searchProducts(query: string) {
        const organizationId = await getCurrentOrganizationId();
        const { data, error } = await supabase
            .from('inventory')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('is_active', true)
            .or(`name.ilike.%${query}%,sku.ilike.%${query}%,description.ilike.%${query}%`)
            .order('name')
            .limit(20);

        if (error) throw error;
        return data as InventoryProduct[];
    }
};
