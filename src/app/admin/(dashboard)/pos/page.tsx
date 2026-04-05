'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ShoppingCart, Plus, Tag, Trash2, Printer, RotateCcw, Calendar, Clock, User, CheckCircle, ChevronDown, ChevronUp, CreditCard, Banknote, Landmark, X } from 'lucide-react';
import Button from '@/components/shared/Button';
import Input from '@/components/shared/Input';
import ReceiptModal from '@/components/pos/ReceiptModal';
import SplitPaymentModal from '@/components/pos/SplitPaymentModal';
import WalkInServicesPanel from '@/components/pos/WalkInServicesPanel';
import QuickCustomerForm from '@/components/pos/QuickCustomerForm';
import { formatCurrency } from '@/lib/utils';
import {
    calculateCartSubtotal,
    taxOnSubtotalBeforeDiscount,
    calculatePosGrandTotal,
} from '@/lib/pos-calculations';
import { PaymentBreakdown } from '@/lib/types';
import { schedulingService } from '@/services/scheduling';
import { servicesService } from '@/services/services';
import { customersService } from '@/services/customers';
import { invoicesService } from '@/services/invoices';
import { appointmentsService } from '@/services/appointments';
import { loyaltyService, CustomerLoyaltyInfo } from '@/services/loyalty';
import { inventoryService } from '@/services/inventory';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/lib/workspace';
import { useToast } from '@/context/ToastContext';
import { sendEmailFromServer } from '@/lib/email-server';
import { generateReceiptEmail } from '@/lib/email-templates';

export default function POSPage() {
    const { user } = useAuth();
    const { effectiveBranchId } = useWorkspace();
    const { showToast } = useToast();
    const [cart, setCart] = useState<any[]>([]);
    const [discount, setDiscount] = useState(0);
    const [discountInput, setDiscountInput] = useState(''); // Uncontrolled input for manual discount
    const [promoCode, setPromoCode] = useState('');
    const [services, setServices] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
    const [customerSearch, setCustomerSearch] = useState('');
    const [serviceSearch, setServiceSearch] = useState('');
    const [processingPayment, setProcessingPayment] = useState(false);
    const [manualItem, setManualItem] = useState({ description: '', price: '' });

    // Appointment integration state
    const [customerAppointments, setCustomerAppointments] = useState<any[]>([]);
    const [loadingAppointments, setLoadingAppointments] = useState(false);
    // Additional fee tracking: Map<appointmentId, {fee: number, reason: string}>
    const [appointmentAdditionalFees, setAppointmentAdditionalFees] = useState<Map<string, { fee: number, reason: string }>>(new Map());

    // Coupon state
    const [availableCoupons, setAvailableCoupons] = useState<any[]>([]);
    const [selectedCoupon, setSelectedCoupon] = useState<any>(null);
    const [couponDropdownOpen, setCouponDropdownOpen] = useState(false);

    // Payment method state
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [showSplitPayment, setShowSplitPayment] = useState(false);
    const [paymentBreakdown, setPaymentBreakdown] = useState<PaymentBreakdown[] | null>(null);

    // Receipt Modal
    const [showReceipt, setShowReceipt] = useState(false);

    // Inventory Products state
    const [products, setProducts] = useState<any[]>([]);
    const [productSearch, setProductSearch] = useState('');
    const [activeTab, setActiveTab] = useState<'services' | 'products' | 'appointments' | 'walkin'>('services');
    const [lastInvoice, setLastInvoice] = useState<any>(null);

    // Walk-in mode state
    const [staff, setStaff] = useState<any[]>([]);
    const [selectedStylistForService, setSelectedStylistForService] = useState<Map<string, string>>(new Map());

    // UI section toggles
    const [showExtraServices, setShowExtraServices] = useState(false);
    const [showManualFee, setShowManualFee] = useState(false);

    // Loyalty state
    const [loyaltyInfo, setLoyaltyInfo] = useState<CustomerLoyaltyInfo | null>(null);
    const [loyaltyLoading, setLoyaltyLoading] = useState(false);
    const [loyaltyDiscount, setLoyaltyDiscount] = useState(0);
    const [loyaltyType, setLoyaltyType] = useState<'card' | 'points' | 'visit' | 'none'>('none');
    const [pointsToRedeem, setPointsToRedeem] = useState(0);
    const [loyaltyCardStock, setLoyaltyCardStock] = useState(0);

    // Customer creation modal
    const [showCustomerForm, setShowCustomerForm] = useState(false);
    const [pendingPhone, setPendingPhone] = useState('');

    // Salon settings for tax
    const [salonSettings, setSalonSettings] = useState<any>(null);

    // Fetch services, coupons, and products on mount
    useEffect(() => {
        fetchServices();
        fetchAvailableCoupons();
        fetchProducts();
        fetchStaff();
    }, []);

    const fetchSettings = async () => {
        if (!user?.organizationId) return;
        try {
            const data = await schedulingService.getSalonSettings(user.organizationId);
            setSalonSettings(data);
        } catch (error) {
            console.error('Error fetching settings:', error);
        }
    };

    useEffect(() => {
        void fetchSettings();
    }, [user?.organizationId]);

    // Search customers when query changes
    useEffect(() => {
        if (customerSearch.length > 2) {
            searchCustomers();
        } else {
            setCustomers([]);
        }
    }, [customerSearch]);

    // Fetch customer appointments when customer is selected
    useEffect(() => {
        if (selectedCustomer) {
            fetchCustomerAppointments(selectedCustomer.id);
            fetchCustomerLoyalty(selectedCustomer.id);
        } else {
            setCustomerAppointments([]);
            setLoyaltyInfo(null);
            setLoyaltyDiscount(0);
            setLoyaltyType('none');
        }
    }, [selectedCustomer]);

    useEffect(() => {
        if (!selectedCustomer || !loyaltyInfo?.settings.option_card_enabled) {
            setLoyaltyCardStock(0);
            return;
        }
        let cancelled = false;
        loyaltyService.getAvailableCards().then(cards => {
            if (!cancelled) setLoyaltyCardStock(cards.length);
        }).catch(() => {
            if (!cancelled) setLoyaltyCardStock(0);
        });
        return () => {
            cancelled = true;
        };
    }, [selectedCustomer, loyaltyInfo?.settings.option_card_enabled, loyaltyInfo?.settings.card_price]);

    const fetchCustomerLoyalty = async (customerId: string) => {
        setLoyaltyLoading(true);
        try {
            const info = await loyaltyService.getCustomerLoyaltyInfo(customerId);
            setLoyaltyInfo(info);
        } catch (error) {
            console.error('Error fetching loyalty info:', error);
        } finally {
            setLoyaltyLoading(false);
        }
    };

    const fetchServices = async () => {
        try {
            const data = await servicesService.getServices();
            setServices(data || []);
        } catch (error) {
            console.error('Error fetching services:', error);
            showToast('Failed to load services', 'error');
        }
    };


    const fetchAvailableCoupons = async () => {
        try {
            const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format
            const { data, error } = await supabase
                .from('promo_codes')
                .select('*')
                .eq('is_active', true)
                .lte('start_date', today)
                .gte('end_date', today);

            if (error) {
                console.error('Error fetching promo codes:', error);
                setAvailableCoupons([]);
                return;
            }

            setAvailableCoupons(data || []);
        } catch (error) {
            console.error('Error fetching promo codes:', error);
            setAvailableCoupons([]);
        }
    };


    const fetchProducts = async () => {
        try {
            const data = await inventoryService.getProducts();
            setProducts(data || []);
        } catch (error) {
            console.error('Error fetching products:', error);
            showToast('Failed to load products', 'error');
        }
    };

    const fetchStaff = async () => {
        try {
            const { data, error } = await supabase
                .from('staff')
                .select('id, name, role')
                .eq('is_active', true)
                .eq('role', 'Stylist')
                .order('name');

            if (error) throw error;
            setStaff(data || []);
        } catch (error) {
            console.error('Error fetching staff:', error);
            showToast('Failed to load staff', 'error');
        }
    };

    const fetchCustomerAppointments = async (customerId: string) => {
        setLoadingAppointments(true);
        try {
            const data = await appointmentsService.getCustomerTodayAppointments(customerId);
            setCustomerAppointments(data || []);
        } catch (error) {
            console.error('Error fetching customer appointments:', error);
            showToast('Failed to load appointments', 'error');
        } finally {
            setLoadingAppointments(false);
        }
    };

    const searchCustomers = async () => {
        try {
            const data = await customersService.searchCustomers(customerSearch);
            setCustomers(data || []);
        } catch (error) {
            console.error('Error searching customers:', error);
            setCustomers([]);
        }
    };

    const handleQuickCustomerCreate = async (customerData: {
        name: string;
        phone: string;
        email?: string;
        gender?: string;
    }) => {
        try {
            const { data, error } = await supabase
                .from('customers')
                .insert({
                    name: customerData.name,
                    phone: customerData.phone,
                    email: customerData.email || null,
                    gender: customerData.gender || null,
                    total_visits: 0,
                    total_spent: 0
                })
                .select()
                .single();

            if (error) throw error;

            // Automatically select the newly created customer
            setSelectedCustomer(data);
            setCustomerSearch('');
            setCustomers([]);
            setShowCustomerForm(false);

            showToast(`Customer created: ${data.name}`, 'success');
        } catch (error) {
            console.error('Error creating customer:', error);
            showToast('Failed to create customer', 'error');
        }
    };
    // Check if appointment is already in cart
    const isAppointmentInCart = (appointmentId: string) => {
        return cart.some(item => item.appointmentId === appointmentId);
    };

    // Add appointment directly to cart on click
    const addAppointmentToCart = (appointment: any) => {
        if (isAppointmentInCart(appointment.id)) {
            showToast('This appointment is already in the bill', 'warning');
            return;
        }

        if (!appointment.services_data || appointment.services_data.length === 0) {
            showToast('No services found for this appointment', 'error');
            return;
        }

        // Get additional fee for this appointment (if any)
        const additionalFeeData = appointmentAdditionalFees.get(appointment.id);

        const newItems = appointment.services_data.map((service: any) => ({
            type: 'appointment',
            appointmentId: appointment.id,
            serviceId: service.id,
            name: service.name,
            price: service.price,
            quantity: 1,
            stylistId: appointment.stylist?.id, // Add stylist ID for commission tracking
            stylistName: appointment.stylist?.name || 'Unknown',
            startTime: appointment.start_time,
            duration: appointment.duration,
            additionalFee: additionalFeeData?.fee || 0, // Add additional fee
            additionalFeeReason: additionalFeeData?.reason || ''
        }));

        setCart([...cart, ...newItems]);

        const feeMsg = additionalFeeData && additionalFeeData.fee > 0
            ? ` + ${formatCurrency(additionalFeeData.fee)} additional fee`
            : '';
        showToast(`Added appointment (${appointment.start_time})${feeMsg} to bill`, 'success');
    };

    // Remove entire appointment from cart
    const removeAppointmentFromCart = (appointmentId: string) => {
        setCart(cart.filter(item => item.appointmentId !== appointmentId));
        showToast('Appointment removed from bill', 'info');
    };

    const addToCart = (service: any) => {
        const existingItem = cart.find(item => item.serviceId === service.id && !item.appointmentId);
        if (existingItem) {
            setCart(cart.map(item =>
                item.serviceId === service.id && !item.appointmentId
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
            ));
        } else {
            setCart([...cart, {
                type: 'service',
                serviceId: service.id,
                name: service.name,
                price: service.price,
                quantity: 1
            }]);
        }
        showToast(`${service.name} added to cart`, 'success');
    };

    // Add walk-in service with stylist to cart
    const addWalkInServiceToCart = (service: any, stylistId: string) => {
        if (!stylistId) {
            showToast('Please select a stylist', 'warning');
            return;
        }

        const stylist = staff.find(s => s.id === stylistId);
        if (!stylist) {
            showToast('Invalid stylist selected', 'error');
            return;
        }

        setCart([...cart, {
            type: 'walk-in-service',
            serviceId: service.id,
            stylistId: stylistId,
            stylistName: stylist.name,
            name: service.name,
            price: service.price,
            quantity: 1,
            appointmentId: null // Walk-in has no appointment
        }]);

        showToast(`${service.name} added (Stylist: ${stylist.name})`, 'success');

        // Clear selection for this service
        const newMap = new Map(selectedStylistForService);
        newMap.delete(service.id);
        setSelectedStylistForService(newMap);
    };

    const addProductToCart = (product: any) => {
        // Check stock availability
        if (product.current_stock <= 0) {
            showToast('Product out of stock!', 'error');
            return;
        }

        const existingItem = cart.find(item => item.productId === product.id);
        if (existingItem) {
            // Check if we have enough stock
            if (existingItem.quantity >= product.current_stock) {
                showToast(`Only ${product.current_stock} ${product.unit} available`, 'error');
                return;
            }
            setCart(cart.map(item =>
                item.productId === product.id
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
            ));
        } else {
            setCart([...cart, {
                type: 'product',
                productId: product.id,
                name: product.name,
                price: product.selling_price,
                quantity: 1,
                stock: product.current_stock,
                unit: product.unit
            }]);
        }
        showToast('Product added to cart', 'success');
    };

    const addManualItem = () => {
        if (!manualItem.description || !manualItem.price) {
            showToast('Please enter description and price', 'warning');
            return;
        }
        setCart([...cart, {
            type: 'manual',
            name: manualItem.description,
            price: parseFloat(manualItem.price),
            quantity: 1,
            description: manualItem.description
        }]);
        setManualItem({ description: '', price: '' });
        setShowManualFee(false);
        showToast('Manual item added', 'success');
    };

    const addLoyaltyCardToCart = () => {
        if (!loyaltyInfo?.settings.option_card_enabled) {
            showToast('Loyalty cards are not enabled for this salon', 'warning');
            return;
        }
        if (loyaltyInfo.cardValid) {
            showToast('This customer already has an active loyalty card', 'warning');
            return;
        }
        if (cart.some((i: any) => i.loyaltyCardPurchase)) {
            showToast('Loyalty card is already on this bill', 'warning');
            return;
        }
        if (loyaltyCardStock < 1) {
            showToast('No loyalty cards in stock. Generate cards under Loyalty Program.', 'error');
            return;
        }
        const s = loyaltyInfo.settings;
        const label = `Loyalty card — ${s.card_discount_percent}% off · ${s.card_validity_days} days`;
        setCart([...cart, {
            type: 'manual',
            name: label,
            price: s.card_price,
            quantity: 1,
            loyaltyCardPurchase: true,
        }]);
        showToast('Loyalty card added to bill. Customer receives benefits after payment.', 'success');
    };

    const removeFromCart = (index: number) => {
        setCart(cart.filter((_, i) => i !== index));
    };

    const updateItemQuantity = (index: number, delta: number) => {
        setCart(cart.map((item, i) => {
            if (i === index) {
                const newQty = item.quantity + delta;
                return newQty > 0 ? { ...item, quantity: newQty } : item;
            }
            return item;
        }).filter(item => item.quantity > 0));
    };

    const clearCart = () => {
        if (confirm('Are you sure you want to clear the bill?')) {
            setCart([]);
            setDiscount(0);
            setPromoCode('');
            setSelectedCoupon(null);
            showToast('Bill cleared', 'info');
        }
    };

    const handleSelectCoupon = async (coupon: any) => {
        if (subtotal < (coupon.min_spend || 0)) {
            showToast(`Minimum spend of ${formatCurrency(coupon.min_spend)} required for this coupon`, 'warning');
            return;
        }

        setSelectedCoupon(coupon);
        setPromoCode(coupon.code);

        const discountAmount = coupon.type === 'percentage'
            ? (subtotal * coupon.value) / 100
            : coupon.value;

        setDiscount(discountAmount);
        setCouponDropdownOpen(false);
        showToast(`Coupon ${coupon.code} applied!`, 'success');
    };

    const handleApplyPromo = async () => {
        if (!promoCode) return;
        const result = await invoicesService.validatePromoCode(promoCode, subtotal);
        if (result.valid) {
            setDiscount(result.discountAmount);
            showToast('Promo code applied!', 'success');
        } else {
            showToast('Invalid promo code', 'error');
            setDiscount(0);
        }
    };

    const clearCoupon = () => {
        setSelectedCoupon(null);
        setPromoCode('');
        setDiscount(0);
    };

    const handlePayment = async () => {
        if (!selectedCustomer) {
            showToast('Please select a customer', 'warning');
            return;
        }
        if (cart.length === 0) {
            showToast('Cart is empty', 'warning');
            return;
        }
        if (!user) {
            showToast('You must be logged in', 'error');
            return;
        }

        setProcessingPayment(true);
        try {
            // Branch is required for POS writes.
            // For Owner, this is driven by header scope:
            // - If user selected "All locations", effectiveBranchId is undefined => block checkout.
            if (!effectiveBranchId) {
                showToast('Select a branch location before checkout.', 'warning');
                setProcessingPayment(false);
                return;
            }
            const branchId = effectiveBranchId;

            const loyaltyCardQty = cart
                .filter((i: { loyaltyCardPurchase?: boolean }) => i.loyaltyCardPurchase)
                .reduce((sum, i: { quantity?: number }) => sum + (i.quantity || 1), 0);
            if (loyaltyCardQty > 0) {
                if (!loyaltyInfo?.settings.option_card_enabled) {
                    showToast('Remove the loyalty card line or enable the card program in Settings.', 'error');
                    setProcessingPayment(false);
                    return;
                }
                if (loyaltyInfo.cardValid) {
                    showToast('Customer already has a loyalty card. Remove the card line from the bill.', 'warning');
                    setProcessingPayment(false);
                    return;
                }
                const available = await loyaltyService.getAvailableCards();
                if (available.length < loyaltyCardQty) {
                    showToast(
                        `Only ${available.length} loyalty card(s) in stock. Generate more under Loyalty Program.`,
                        'error'
                    );
                    setProcessingPayment(false);
                    return;
                }
            }

            // Get unique appointment IDs from cart
            const appointmentIds = [...new Set(
                cart
                    .filter(item => item.appointmentId)
                    .map(item => item.appointmentId)
            )];

            const invoice = await invoicesService.createInvoice({
                customer_id: selectedCustomer.id,
                branch_id: branchId!,
                appointment_ids: appointmentIds.length > 0 ? appointmentIds : undefined,
                items: cart.map(item => ({
                    type: (item as { loyaltyCardPurchase?: boolean }).loyaltyCardPurchase
                        ? 'manual'
                        : item.type === 'walk-in-service'
                            ? 'service'
                            : item.type,
                    serviceId: item.serviceId,
                    appointmentId: item.appointmentId,
                    stylistId: item.stylistId, // Include stylist for commission tracking
                    name: item.name,
                    description: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    additionalFee: item.additionalFee || 0, // Include additional fee
                    additionalFeeReason: item.additionalFeeReason || '' // Include reason
                })),
                subtotal,
                discount,
                promo_code: promoCode || undefined,
                tax,
                total,
                payment_method: paymentBreakdown
                    ? paymentBreakdown.reduce((max, p) => p.amount > max.amount ? p : max).method
                    : paymentMethod,
                payment_breakdown: paymentBreakdown || undefined, // NEW: Split payment support
                created_by: user.id
            });

            if (loyaltyCardQty > 0 && user) {
                try {
                    for (let q = 0; q < loyaltyCardQty; q++) {
                        await loyaltyService.sellNextAvailableCard(selectedCustomer.id, user.id, invoice.id);
                    }
                    await fetchCustomerLoyalty(selectedCustomer.id);
                } catch (cardErr: unknown) {
                    console.error('Loyalty card assignment failed:', cardErr);
                    showToast(
                        `Payment saved, but assigning the loyalty card failed: ${cardErr instanceof Error ? cardErr.message : 'Unknown error'}`,
                        'warning'
                    );
                }
            }

            // Mark linked appointments as completed
            if (appointmentIds.length > 0) {
                try {
                    await appointmentsService.markAppointmentsCompletedViaPOS(appointmentIds);
                    showToast(`${appointmentIds.length} appointment(s) marked as completed`, 'success');
                } catch (aptError) {
                    console.error('Error marking appointments complete:', aptError);
                }
            }

            // Deduct inventory stock for products sold
            const productItems = cart.filter(item => item.type === 'product' && item.productId);
            if (productItems.length > 0) {
                try {
                    for (const item of productItems) {
                        await inventoryService.deductStock(item.productId, item.quantity, invoice.id);
                    }
                    showToast(`Stock updated for ${productItems.length} product(s)`, 'success');
                } catch (stockError) {
                    console.error('Error deducting stock:', stockError);
                    // Don't fail payment for stock errors, but log them
                    showToast('Warning: Stock levels may not have updated correctly', 'warning');
                }
            }

            // If promo code was used, increment usage
            if (promoCode && discount > 0) {
                await invoicesService.incrementPromoUsage(promoCode);
            }

            // Process loyalty transactions
            if (selectedCustomer && loyaltyInfo) {
                try {
                    // Redeem points if used
                    if (loyaltyType === 'points' && pointsToRedeem > 0) {
                        await loyaltyService.redeemPoints(selectedCustomer.id, pointsToRedeem, invoice.id);
                    }

                    // Apply visit reward if used
                    if (loyaltyType === 'visit' && loyaltyInfo.eligibleForVisitReward) {
                        await loyaltyService.applyVisitReward(selectedCustomer.id, invoice.id);
                    }

                    // Record this visit
                    const visitResult = await loyaltyService.recordVisit(selectedCustomer.id, invoice.id);
                    if (visitResult.rewardEarned) {
                        showToast(`🎉 Customer earned a visit reward! (Visit #${visitResult.visitNumber})`, 'success');
                    }

                    // Add points for this purchase (based on amount paid)
                    if (loyaltyInfo.settings.option_points_enabled) {
                        const earnedPoints = await loyaltyService.addPoints(selectedCustomer.id, total, invoice.id);
                        if (earnedPoints > 0) {
                            showToast(`Customer earned ${earnedPoints} loyalty points!`, 'success');
                        }
                    }
                } catch (loyaltyError) {
                    console.error('Error processing loyalty:', loyaltyError);
                    // Don't fail payment for loyalty errors
                }
            }

            // Record visit for customer
            await customersService.recordVisit(selectedCustomer.id, total);

            showToast('Payment processed successfully!', 'success');

            // Prepare for receipt
            const invoiceData = {
                ...invoice,
                customer: selectedCustomer,
                items: cart,
                subtotal,
                discount: totalDiscount,
                tax,
                total
            };
            setLastInvoice(invoiceData);
            setShowReceipt(true);

            // Send email receipt to customer
            if (selectedCustomer?.email) {
                try {
                    const emailHtml = generateReceiptEmail({
                        customer: {
                            name: selectedCustomer.name,
                            email: selectedCustomer.email,
                            phone: selectedCustomer.phone
                        },
                        invoice: {
                            id: invoice.id,
                            created_at: invoice.created_at
                        },
                        items: cart,
                        subtotal,
                        discount: totalDiscount,
                        tax,
                        total,
                        paymentMethod
                    });

                    const emailResult = await sendEmailFromServer(
                        selectedCustomer.email,
                        `Receipt for Your Visit - Invoice #${invoice.id.slice(0, 8)}`,
                        emailHtml
                    );

                    if (emailResult.success) {
                        showToast('✉️ Receipt sent to ' + selectedCustomer.email, 'success');
                    } else {
                        console.error('Email send failed:', emailResult.error);
                    }
                } catch (emailError: any) {
                    console.error('Error sending receipt email:', emailError);
                    // Don't block payment completion if email fails
                }
            }

            // Reset cart and state
            setCart([]);
            setPaymentBreakdown(null);
            setDiscount(0);
            setPromoCode('');
            setSelectedCoupon(null);
            setSelectedCustomer(null);
            setCustomerSearch('');
            setCustomerAppointments([]);
            setLoyaltyInfo(null);
            setLoyaltyDiscount(0);
            setLoyaltyType('none');
            setPointsToRedeem(0);
        } catch (error: any) {
            console.error('Error processing payment:', error);
            showToast('Payment failed: ' + error.message, 'error');
        } finally {
            setProcessingPayment(false);
        }
    };

    const subtotal = calculateCartSubtotal(
        cart.map((item: any) => ({
            price: item.price,
            quantity: item.quantity,
            additionalFee: item.additionalFee,
        }))
    );

    const enableTax = salonSettings?.enable_tax ?? false;
    const taxRate = salonSettings?.tax_rate ?? 0;
    const tax = taxOnSubtotalBeforeDiscount(subtotal, enableTax, taxRate);

    const totalDiscount = discount + loyaltyDiscount; // Combined promo + loyalty discount
    const total = calculatePosGrandTotal({
        subtotal,
        promoDiscount: discount,
        loyaltyDiscount,
        tax,
    });

    const loyaltyMode: 'none' | 'card' | 'points' | 'visits' = !loyaltyInfo
        ? 'none'
        : loyaltyInfo.settings.option_card_enabled
            ? 'card'
            : loyaltyInfo.settings.option_points_enabled
                ? 'points'
                : loyaltyInfo.settings.option_visits_enabled
                    ? 'visits'
                    : 'none';

    const filteredServices = services.filter(s =>
        s.name.toLowerCase().includes(serviceSearch.toLowerCase())
    );

    // Get appointments in cart
    const appointmentsInCart = [...new Set(cart.filter(item => item.appointmentId).map(item => item.appointmentId))];

    // Get appointments NOT in cart
    const availableAppointments = customerAppointments.filter(apt => !isAppointmentInCart(apt.id));

    // Group cart by appointment
    const getGroupedCart = () => {
        const appointmentGroups: { [key: string]: { appointment: any, items: any[] } } = {};
        const extraItems: any[] = [];

        cart.forEach((item, index) => {
            if (item.appointmentId) {
                if (!appointmentGroups[item.appointmentId]) {
                    const apt = customerAppointments.find(a => a.id === item.appointmentId);
                    appointmentGroups[item.appointmentId] = {
                        appointment: apt || { id: item.appointmentId, start_time: item.startTime },
                        items: []
                    };
                }
                appointmentGroups[item.appointmentId].items.push({ ...item, index });
            } else {
                extraItems.push({ ...item, index });
            }
        });

        return { appointmentGroups, extraItems };
    };

    const { appointmentGroups, extraItems } = getGroupedCart();

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">POS & Billing</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Process payments and generate invoices</p>
                </div>
                {lastInvoice && (
                    <Button variant="outline" onClick={() => setShowReceipt(true)} leftIcon={<Printer className="h-4 w-4" />}>
                        Last Receipt
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                {/* Left: Customer & Selection */}
                <div className="xl:col-span-2 space-y-4">
                    {/* Customer Search */}
                    <div className="card p-4 surface-panel">
                        <h2 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3 uppercase tracking-wide">Step 1: Select Customer</h2>
                        <div className="relative">
                            <Input
                                type="text"
                                placeholder="Search by phone or name..."
                                value={customerSearch}
                                onChange={(e) => setCustomerSearch(e.target.value)}
                                leftIcon={<Search className="h-5 w-5" />}
                            />
                            {customerSearch.length > 2 && (
                                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                                    {customers.length > 0 ? (
                                        customers.map(customer => (
                                            <button
                                                key={customer.id}
                                                className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0"
                                                onClick={() => {
                                                    setSelectedCustomer(customer);
                                                    setCustomerSearch('');
                                                    setCustomers([]);
                                                }}
                                            >
                                                <p className="font-medium text-gray-900 dark:text-white">{customer.name}</p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">{customer.phone}</p>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="p-4">
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 text-center">
                                                No customer found
                                            </p>
                                            <button
                                                onClick={() => {
                                                    // Open modal with phone number pre-filled
                                                    const phone = customerSearch.replace(/\D/g, '');
                                                    if (phone.length >= 9) {
                                                        setPendingPhone(phone);
                                                        setShowCustomerForm(true);
                                                    } else {
                                                        showToast('Please enter a valid phone number', 'warning');
                                                    }
                                                }}
                                                className="w-full p-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg flex items-center justify-center gap-2 transition-colors"
                                            >
                                                <Plus className="h-4 w-4" />
                                                Create Walk-in Customer
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        {selectedCustomer && (
                            <div className="mt-3 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl flex justify-between items-center">
                                <div>
                                    <p className="font-medium text-primary-900 dark:text-primary-100">{selectedCustomer.name}</p>
                                    <p className="text-sm text-primary-700 dark:text-primary-300">{selectedCustomer.phone}</p>
                                </div>
                                <button
                                    onClick={() => {
                                        setSelectedCustomer(null);
                                        setCustomerSearch('');
                                        setCustomerAppointments([]);
                                        setCart([]);
                                    }}
                                    className="text-primary-600 hover:text-primary-800 text-sm font-medium"
                                >
                                    Change
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Today's Appointments */}
                    {selectedCustomer && (
                        <div className="card p-4 surface-panel">
                            <h2 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3 uppercase tracking-wide flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                Step 2: Today's Appointments
                            </h2>

                            {loadingAppointments ? (
                                <div className="flex items-center justify-center py-6">
                                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-600 border-t-transparent"></div>
                                </div>
                            ) : customerAppointments.length === 0 ? (
                                <div className="text-center py-6 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                                    <Calendar className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                                    <p className="text-gray-500 dark:text-gray-400">No appointments for today</p>
                                    <p className="text-xs text-gray-400 mt-1">Add services manually below</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {customerAppointments.map(appointment => {
                                        const inCart = isAppointmentInCart(appointment.id);
                                        const appointmentTotal = appointment.services_data?.reduce((sum: number, s: any) => sum + s.price, 0) || 0;

                                        return (
                                            <motion.div
                                                key={appointment.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className={`p-3 rounded-xl border-2 transition-all ${inCart
                                                    ? 'border-success-500 bg-success-50 dark:bg-success-900/20'
                                                    : 'border-gray-200 dark:border-gray-700 hover:border-primary-400 cursor-pointer'
                                                    }`}
                                                onClick={() => !inCart && addAppointmentToCart(appointment)}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        {inCart ? (
                                                            <CheckCircle className="h-5 w-5 text-success-600" />
                                                        ) : (
                                                            <div className="h-5 w-5 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                                                        )}
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <Clock className="h-3.5 w-3.5 text-gray-500" />
                                                                <span className="font-medium text-gray-900 dark:text-white">{appointment.start_time}</span>
                                                                <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{appointment.duration}min</span>
                                                            </div>
                                                            <div className="flex items-center gap-1 mt-0.5">
                                                                <User className="h-3 w-3 text-gray-400" />
                                                                <span className="text-xs text-gray-500">{appointment.stylist?.name || 'No stylist'}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(appointmentTotal)}</p>
                                                        <p className="text-xs text-gray-500">{appointment.services_data?.length || 0} service(s)</p>
                                                    </div>
                                                </div>
                                                {!inCart && (
                                                    <>
                                                        <div className="mt-2 flex flex-wrap gap-1">
                                                            {appointment.services_data?.map((s: any) => (
                                                                <span key={s.id} className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">
                                                                    {s.name}
                                                                </span>
                                                            ))}
                                                        </div>
                                                        {/* Additional Fee Input */}
                                                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600" onClick={(e) => e.stopPropagation()}>
                                                            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">💰 Optional Additional Fee</p>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                <Input
                                                                    type="number"
                                                                    placeholder="Fee amount"
                                                                    value={appointmentAdditionalFees.get(appointment.id)?.fee || ''}
                                                                    onChange={(e) => {
                                                                        const newFees = new Map(appointmentAdditionalFees);
                                                                        const existing = newFees.get(appointment.id) || { fee: 0, reason: '' };
                                                                        newFees.set(appointment.id, {
                                                                            ...existing,
                                                                            fee: parseFloat(e.target.value) || 0
                                                                        });
                                                                        setAppointmentAdditionalFees(newFees);
                                                                    }}
                                                                    min="0"
                                                                    step="10"
                                                                    className="text-sm"
                                                                />
                                                                <Input
                                                                    type="text"
                                                                    placeholder="Reason (optional)"
                                                                    value={appointmentAdditionalFees.get(appointment.id)?.reason || ''}
                                                                    onChange={(e) => {
                                                                        const newFees = new Map(appointmentAdditionalFees);
                                                                        const existing = newFees.get(appointment.id) || { fee: 0, reason: '' };
                                                                        newFees.set(appointment.id, {
                                                                            ...existing,
                                                                            reason: e.target.value
                                                                        });
                                                                        setAppointmentAdditionalFees(newFees);
                                                                    }}
                                                                    className="text-sm"
                                                                />
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Loyalty (single active program from Settings) */}
                    {selectedCustomer && loyaltyInfo && loyaltyMode !== 'none' && (
                        <div className="card p-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800">
                            <h2 className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-3 uppercase tracking-wide flex items-center gap-2">
                                Loyalty
                            </h2>

                            {loyaltyLoading ? (
                                <div className="flex items-center justify-center py-4">
                                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-amber-600 border-t-transparent"></div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {loyaltyMode === 'card' && (
                                        <>
                                            <div className="flex items-center justify-between p-2 bg-white/60 dark:bg-gray-800/60 rounded-lg">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg" aria-hidden>🎫</span>
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900 dark:text-white">Loyalty card</p>
                                                        {loyaltyInfo.cardValid ? (
                                                            <p className="text-xs text-green-600">Active • {loyaltyInfo.cardDiscount}% off services</p>
                                                        ) : (
                                                            <p className="text-xs text-gray-500">No active card — sell one below or on this bill</p>
                                                        )}
                                                    </div>
                                                </div>
                                                {loyaltyInfo.cardValid && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setLoyaltyType('card');
                                                            setLoyaltyDiscount((subtotal * loyaltyInfo.cardDiscount) / 100);
                                                            showToast(`Card discount ${loyaltyInfo.cardDiscount}% applied`, 'success');
                                                        }}
                                                        disabled={loyaltyType === 'card'}
                                                        className={`px-2 py-1 text-xs rounded-lg transition-colors ${loyaltyType === 'card' ? 'bg-green-500 text-white' : 'bg-amber-500 text-white hover:bg-amber-600'}`}
                                                    >
                                                        {loyaltyType === 'card' ? 'Applied' : 'Apply discount'}
                                                    </button>
                                                )}
                                            </div>
                                            {!loyaltyInfo.cardValid && (
                                                <div className="p-3 rounded-lg bg-white/80 dark:bg-gray-800/80 border border-amber-200/80 dark:border-amber-800/50">
                                                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                                                        Sell a card ({formatCurrency(loyaltyInfo.settings.card_price)}) — customer gets{' '}
                                                        {loyaltyInfo.settings.card_discount_percent}% off for {loyaltyInfo.settings.card_validity_days} days after purchase.
                                                    </p>
                                                    <p className="text-xs text-gray-500 mb-2">In stock: {loyaltyCardStock}</p>
                                                    <Button
                                                        type="button"
                                                        variant="primary"
                                                        size="sm"
                                                        className="w-full"
                                                        onClick={addLoyaltyCardToCart}
                                                        disabled={loyaltyCardStock < 1 || cart.some((i: { loyaltyCardPurchase?: boolean }) => i.loyaltyCardPurchase)}
                                                    >
                                                        {cart.some((i: { loyaltyCardPurchase?: boolean }) => i.loyaltyCardPurchase)
                                                            ? 'Card on bill'
                                                            : 'Add loyalty card to bill'}
                                                    </Button>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {loyaltyMode === 'points' && (
                                        <div className="flex items-center justify-between p-2 bg-white/60 dark:bg-gray-800/60 rounded-lg">
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg" aria-hidden>⭐</span>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white">Points</p>
                                                    <p className="text-xs text-gray-600 dark:text-gray-400">
                                                        {loyaltyInfo.availablePoints} pts ({formatCurrency(loyaltyInfo.pointsValue)} value)
                                                    </p>
                                                </div>
                                            </div>
                                            {loyaltyInfo.availablePoints > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setLoyaltyType('points');
                                                        setPointsToRedeem(loyaltyInfo.availablePoints);
                                                        const discountAmt = Math.min(loyaltyInfo.pointsValue, subtotal);
                                                        setLoyaltyDiscount(discountAmt);
                                                        showToast(`Redeeming ${loyaltyInfo.availablePoints} points for ${formatCurrency(discountAmt)}`, 'success');
                                                    }}
                                                    disabled={loyaltyType === 'points'}
                                                    className={`px-2 py-1 text-xs rounded-lg transition-colors ${loyaltyType === 'points' ? 'bg-green-500 text-white' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
                                                >
                                                    {loyaltyType === 'points' ? 'Applied' : 'Redeem'}
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {loyaltyMode === 'visits' && (
                                        <div className="flex items-center justify-between p-2 bg-white/60 dark:bg-gray-800/60 rounded-lg">
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg" aria-hidden>🎯</span>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white">Visit rewards</p>
                                                    {loyaltyInfo.eligibleForVisitReward ? (
                                                        <p className="text-xs text-green-600">{loyaltyInfo.visitRewardDiscount}% off this visit</p>
                                                    ) : (
                                                        <p className="text-xs text-gray-600 dark:text-gray-400">
                                                            {loyaltyInfo.totalVisits} visits • {loyaltyInfo.nextRewardVisit} more until reward
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            {loyaltyInfo.eligibleForVisitReward && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setLoyaltyType('visit');
                                                        setLoyaltyDiscount((subtotal * loyaltyInfo.visitRewardDiscount) / 100);
                                                        showToast(`Visit reward ${loyaltyInfo.visitRewardDiscount}% applied`, 'success');
                                                    }}
                                                    disabled={loyaltyType === 'visit'}
                                                    className={`px-2 py-1 text-xs rounded-lg transition-colors ${loyaltyType === 'visit' ? 'bg-green-500 text-white' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                                                >
                                                    {loyaltyType === 'visit' ? 'Applied' : 'Apply'}
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {loyaltyType !== 'none' && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setLoyaltyType('none');
                                                setLoyaltyDiscount(0);
                                                setPointsToRedeem(0);
                                                showToast('Loyalty discount removed', 'info');
                                            }}
                                            className="w-full mt-2 text-xs text-gray-500 hover:text-gray-700 underline"
                                        >
                                            Clear loyalty discount
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}



                    {/* Manual Fee (Collapsible) */}
                    {selectedCustomer && (
                        <div className="card surface-panel overflow-hidden">
                            <button
                                onClick={() => setShowManualFee(!showManualFee)}
                                className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                            >
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                                    💵 Add Manual Fee
                                </span>
                                {showManualFee ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                            <AnimatePresence>
                                {showManualFee && (
                                    <motion.div
                                        initial={{ height: 0 }}
                                        animate={{ height: 'auto' }}
                                        exit={{ height: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="p-4 pt-0 border-t border-gray-100 dark:border-gray-700 space-y-3">
                                            <Input
                                                placeholder="Description"
                                                value={manualItem.description}
                                                onChange={(e) => setManualItem({ ...manualItem, description: e.target.value })}
                                            />
                                            <div className="flex flex-col sm:flex-row gap-2">
                                                <Input
                                                    type="number"
                                                    placeholder="Amount"
                                                    value={manualItem.price}
                                                    onChange={(e) => setManualItem({ ...manualItem, price: e.target.value })}
                                                />
                                                <Button variant="primary" size="sm" onClick={addManualItem}>
                                                    Add
                                                </Button>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}

                    {/* Walk-in Services Panel */}
                    {selectedCustomer && (
                        <WalkInServicesPanel
                            services={services}
                            staff={staff}
                            selectedStylistForService={selectedStylistForService}
                            onStylistChange={(serviceId, stylistId) => {
                                const newMap = new Map(selectedStylistForService);
                                newMap.set(serviceId, stylistId);
                                setSelectedStylistForService(newMap);
                            }}
                            onAddService={addWalkInServiceToCart}
                        />
                    )}
                </div>

                {/* Right: Bill Summary - At bottom on tablet, right side on desktop */}
                <div className="xl:col-span-3">
                    <div className="card p-4 sm:p-6 surface-panel xl:sticky xl:top-24">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <ShoppingCart className="h-5 w-5 text-primary-600" />
                                Bill Summary
                            </h2>
                            {cart.length > 0 && (
                                <button
                                    onClick={clearCart}
                                    className="text-sm text-danger-600 hover:text-danger-700 flex items-center gap-1"
                                >
                                    <RotateCcw className="h-3 w-3" /> Clear
                                </button>
                            )}
                        </div>

                        {/* Bill Items */}
                        <div className="space-y-4 mb-6 max-h-[40vh] overflow-y-auto">
                            {cart.length === 0 ? (
                                <div className="text-center py-12 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                                    <ShoppingCart className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                                    <p className="text-gray-500 dark:text-gray-400">No items in bill</p>
                                    <p className="text-xs text-gray-400 mt-1">Select a customer and add appointments</p>
                                </div>
                            ) : (
                                <>
                                    {/* Appointment Groups */}
                                    {Object.entries(appointmentGroups).map(([aptId, group]) => (
                                        <div key={aptId} className="bg-gradient-to-r from-primary-50 to-transparent dark:from-primary-900/20 rounded-xl p-4 border border-primary-200 dark:border-primary-800">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="h-4 w-4 text-primary-600" />
                                                    <span className="text-sm font-medium text-primary-800 dark:text-primary-200">
                                                        Appointment at {group.appointment.start_time}
                                                    </span>
                                                    <span className="text-xs bg-primary-200 dark:bg-primary-800 px-2 py-0.5 rounded text-primary-700 dark:text-primary-300">
                                                        {group.items[0]?.stylistName}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => removeAppointmentFromCart(aptId)}
                                                    className="text-primary-600 hover:text-danger-600 transition-colors"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </div>
                                            <div className="space-y-2">
                                                {group.items.map((item: any) => (
                                                    <div key={item.index} className="flex justify-between items-center text-sm">
                                                        <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
                                                        <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(item.price)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="mt-2 pt-2 border-t border-primary-200 dark:border-primary-700 flex justify-between font-medium">
                                                <span className="text-primary-800 dark:text-primary-200">Subtotal</span>
                                                <span className="text-primary-900 dark:text-primary-100">
                                                    {formatCurrency(group.items.reduce((s: number, i: any) => s + i.price * i.quantity, 0))}
                                                </span>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Extra Items */}
                                    {extraItems.length > 0 && (
                                        <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4">
                                            <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">
                                                Extra Services
                                            </div>
                                            <div className="space-y-2">
                                                {extraItems.map((item: any) => (
                                                    <div key={item.index} className="flex justify-between items-center">
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex-1">
                                                                <span className="text-gray-900 dark:text-white">{item.name}</span>
                                                                {item.type === 'walk-in-service' && item.stylistName && (
                                                                    <div className="flex items-center gap-1 mt-0.5">
                                                                        <User className="h-3 w-3 text-primary-500" />
                                                                        <span className="text-xs text-primary-600 dark:text-primary-400">
                                                                            {item.stylistName}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-1 text-xs">
                                                                <button
                                                                    onClick={() => updateItemQuantity(item.index, -1)}
                                                                    className="w-5 h-5 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300"
                                                                >-</button>
                                                                <span className="w-6 text-center">{item.quantity}</span>
                                                                <button
                                                                    onClick={() => updateItemQuantity(item.index, 1)}
                                                                    className="w-5 h-5 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300"
                                                                >+</button>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium">{formatCurrency(item.price * item.quantity)}</span>
                                                            <button onClick={() => removeFromCart(item.index)} className="text-gray-400 hover:text-danger-500">
                                                                <X className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Discount Section */}
                        {cart.length > 0 && (
                            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl space-y-3">
                                <label className="text-xs font-medium text-gray-500 mb-2 block">Discount</label>

                                {/* Manual Discount Input */}
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">Manual Discount (%)</label>
                                    <Input
                                        type="number"
                                        value={selectedCoupon ? '' : discountInput}
                                        onChange={(e) => {
                                            setDiscountInput(e.target.value);
                                        }}
                                        onBlur={(e) => {
                                            const percentage = parseFloat(e.target.value) || 0;
                                            const clampedPercentage = Math.min(Math.max(percentage, 0), 100);
                                            const discountAmount = (subtotal * clampedPercentage) / 100;
                                            setDiscount(discountAmount);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const percentage = parseFloat((e.target as HTMLInputElement).value) || 0;
                                                const clampedPercentage = Math.min(Math.max(percentage, 0), 100);
                                                const discountAmount = (subtotal * clampedPercentage) / 100;
                                                setDiscount(discountAmount);
                                            }
                                        }}
                                        placeholder="0"
                                        min="0"
                                        max="100"
                                        step="any"
                                        disabled={!!selectedCoupon}
                                        className="text-sm"
                                    />
                                    {discount > 0 && !selectedCoupon && (
                                        <p className="text-xs text-success-600 mt-1">
                                            Discount: {formatCurrency(discount)}
                                        </p>
                                    )}
                                </div>

                                {/* Divider */}
                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                                    </div>
                                    <div className="relative flex justify-center text-xs">
                                        <span className="bg-gray-50 dark:bg-gray-700/30 px-2 text-gray-500">or use promo code</span>
                                    </div>
                                </div>

                                {/* Promo Code Selector */}
                                {selectedCoupon ? (
                                    <div className="flex items-center justify-between bg-success-50 dark:bg-success-900/20 p-2 rounded-lg">
                                        <span className="text-success-700 dark:text-success-300 font-medium">{selectedCoupon.code}</span>
                                        <button onClick={clearCoupon} className="text-success-600 hover:text-success-800">
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <button
                                            onClick={() => setCouponDropdownOpen(!couponDropdownOpen)}
                                            className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                                            disabled={discount > 0}
                                        >
                                            <span className="text-gray-500">{availableCoupons.length > 0 ? 'Select promo code...' : 'No promo codes'}</span>
                                            <ChevronDown className="h-4 w-4" />
                                        </button>
                                        {couponDropdownOpen && availableCoupons.length > 0 && (
                                            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                                                {availableCoupons.map(coupon => (
                                                    <button
                                                        key={coupon.id}
                                                        onClick={() => handleSelectCoupon(coupon)}
                                                        className="w-full p-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                                                    >
                                                        <div className="flex justify-between">
                                                            <span className="font-medium">{coupon.code}</span>
                                                            <span className="text-primary-600">
                                                                {coupon.type === 'percentage' ? `${coupon.value}%` : formatCurrency(coupon.value)}
                                                            </span>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Totals */}
                        {cart.length > 0 && (
                            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                                    <span className="text-gray-900 dark:text-white">{formatCurrency(subtotal)}</span>
                                </div>
                                {discount > 0 && (
                                    <div className="flex justify-between text-sm text-success-600">
                                        <span>Discount {selectedCoupon ? `(${selectedCoupon.code})` : '(Manual)'}</span>
                                        <span>-{formatCurrency(discount)}</span>
                                    </div>
                                )}
                                {loyaltyDiscount > 0 && (
                                    <div className="flex justify-between text-sm text-amber-600">
                                        <span>Loyalty {loyaltyType === 'card' && '(Card)'}{loyaltyType === 'points' && '(Points)'}{loyaltyType === 'visit' && '(Visit Reward)'}</span>
                                        <span>-{formatCurrency(loyaltyDiscount)}</span>
                                    </div>
                                )}
                                {enableTax && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600 dark:text-gray-400">Tax ({taxRate}%)</span>
                                        <span className="text-gray-900 dark:text-white">{formatCurrency(tax)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-xl font-bold pt-2 border-t border-gray-200 dark:border-gray-700">
                                    <span className="text-gray-900 dark:text-white">Total</span>
                                    <span className="text-primary-600">{formatCurrency(total)}</span>
                                </div>
                            </div>
                        )}

                        {/* Payment Method & Button */}
                        {cart.length > 0 && (
                            <div className="mt-6 space-y-4">
                                <div>
                                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 block">Payment Method</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {(['Cash', 'Card'] as const).map(method => {
                                            const selected = paymentMethod === method && !paymentBreakdown;
                                            return (
                                                <button
                                                    key={method}
                                                    type="button"
                                                    onClick={() => { setPaymentMethod(method); setPaymentBreakdown(null); }}
                                                    className={`p-3 rounded-xl text-sm font-medium transition-all border ${selected
                                                        ? 'bg-primary-600 border-primary-600 text-white shadow-sm'
                                                        : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500'
                                                        }`}
                                                >
                                                    {method === 'Cash' ? (
                                                        <Banknote className={`h-5 w-5 mx-auto ${selected ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`} />
                                                    ) : (
                                                        <CreditCard className={`h-5 w-5 mx-auto ${selected ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`} />
                                                    )}
                                                    <div className="text-xs mt-1.5">{method}</div>
                                                </button>
                                            );
                                        })}
                                        <button
                                            type="button"
                                            onClick={() => { setPaymentMethod('BankTransfer'); setPaymentBreakdown(null); }}
                                            className={`p-3 rounded-xl text-sm font-medium transition-all border ${paymentMethod === 'BankTransfer' && !paymentBreakdown
                                                ? 'bg-primary-600 border-primary-600 text-white shadow-sm'
                                                : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500'
                                                }`}
                                        >
                                            <Landmark
                                                className={`h-5 w-5 mx-auto ${paymentMethod === 'BankTransfer' && !paymentBreakdown ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}
                                                aria-hidden
                                            />
                                            <div className="text-xs mt-1.5">Bank</div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowSplitPayment(true)}
                                            className={`p-3 rounded-xl text-sm font-medium transition-all border ${paymentBreakdown
                                                ? 'bg-primary-600 border-primary-600 text-white shadow-sm'
                                                : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500'
                                                }`}
                                        >
                                            <div className="flex justify-center items-center gap-1 min-h-[1.25rem]">
                                                <CreditCard className={`h-5 w-5 ${paymentBreakdown ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`} />
                                                <Banknote className={`h-5 w-5 ${paymentBreakdown ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`} />
                                            </div>
                                            <div className="text-xs mt-1.5">Split</div>
                                        </button>
                                    </div>
                                    {paymentBreakdown && (
                                        <div className="mt-2 p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg text-xs">
                                            <div className="font-medium text-primary-800 dark:text-primary-200 mb-1">Split Payment:</div>
                                            {paymentBreakdown.map((p, i) => (
                                                <div key={i} className="flex justify-between text-primary-700 dark:text-primary-300">
                                                    <span>{p.method}:</span>
                                                    <span>{formatCurrency(p.amount)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <Button
                                    variant="primary"
                                    size="lg"
                                    className="w-full py-4 text-lg"
                                    onClick={handlePayment}
                                    isLoading={processingPayment}
                                    disabled={!selectedCustomer || cart.length === 0}
                                >
                                    Complete Payment • {formatCurrency(total)}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Receipt Modal */}
            {
                lastInvoice && (
                    <ReceiptModal
                        isOpen={showReceipt}
                        onClose={() => setShowReceipt(false)}
                        invoice={lastInvoice}
                    />
                )
            }

            {/* Split Payment Modal */}
            {
                showSplitPayment && (
                    <SplitPaymentModal
                        total={total}
                        onConfirm={(breakdown, primaryMethod) => {
                            setPaymentBreakdown(breakdown);
                            setPaymentMethod(primaryMethod);
                            setShowSplitPayment(false);
                            showToast('Split payment configured', 'success');
                        }}
                        onCancel={() => setShowSplitPayment(false)}
                    />
                )
            }

            {/* Quick Customer Creation Form */}
            <QuickCustomerForm
                isOpen={showCustomerForm}
                onClose={() => setShowCustomerForm(false)}
                onSubmit={handleQuickCustomerCreate}
                initialPhone={pendingPhone}
            />
        </div >
    );
}
