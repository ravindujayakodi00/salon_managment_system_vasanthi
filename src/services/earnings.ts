import { supabase } from '@/lib/supabase';

interface StaffEarning {
    id: string;
    staff_id: string;
    date: string;
    service_revenue: number;
    commission_amount: number;
    salary_amount: number;
    total_earnings: number;
    appointments_count: number;
}

export const earningsService = {
    /**
     * Calculate and update earnings for a stylist based on invoice
     */
    async updateEarningsForInvoice(invoiceId: string) {
        try {

            // Get invoice details
            const { data: invoice, error: invoiceError } = await supabase
                .from('invoices')
                .select(`
                    *,
                    appointment:appointments(
                        stylist_id,
                        appointment_date
                    )
                `)
                .eq('id', invoiceId)
                .single();

            if (invoiceError) throw invoiceError;
            if (!invoice?.appointment) {
                console.warn('Invoice has no appointment linked:', invoiceId);
                return;
            }

            const stylistId = invoice.appointment.stylist_id;
            const date = invoice.appointment.appointment_date;
            const organizationId = (invoice as { organization_id?: string }).organization_id;

            if (!stylistId) {
                console.warn('Appointment has no stylist assigned:', invoice.appointment_id);
                return;
            }

            // Get commission settings for stylist role (tenant-scoped)
            let commissionQuery = supabase
                .from('commission_settings')
                .select('*')
                .eq('role', 'Stylist')
                .eq('is_active', true);
            if (organizationId) {
                commissionQuery = commissionQuery.eq('organization_id', organizationId);
            }
            const { data: commissionSettings } = await commissionQuery.single();

            const commissionRate = commissionSettings?.commission_percentage || 40;


            // Calculate service revenue (only services, not products/manual fees)
            const items = invoice.items as any[];
            const serviceRevenue = items
                .filter((item: any) => item.type === 'service')
                .reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);



            if (serviceRevenue === 0) {
                console.warn('Service revenue is 0, skipping earnings update');
                return;
            }

            const commissionAmount = (serviceRevenue * commissionRate) / 100;

            // Get or create earnings record for this date
            const { data: existingEarning } = await supabase
                .from('staff_earnings')
                .select('*')
                .eq('staff_id', stylistId)
                .eq('date', date)
                .single();

            if (existingEarning) {
                // Update existing record

                await supabase
                    .from('staff_earnings')
                    .update({
                        service_revenue: existingEarning.service_revenue + serviceRevenue,
                        commission_amount: existingEarning.commission_amount + commissionAmount,
                        total_earnings: existingEarning.total_earnings + commissionAmount,
                        appointments_count: existingEarning.appointments_count + 1,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existingEarning.id);
            } else {
                // Create new record

                await supabase
                    .from('staff_earnings')
                    .insert({
                        staff_id: stylistId,
                        date,
                        service_revenue: serviceRevenue,
                        commission_amount: commissionAmount,
                        salary_amount: 0,
                        total_earnings: commissionAmount,
                        appointments_count: 1
                    });
            }
        } catch (error) {
            console.error('Error updating earnings for invoice:', error);
            throw error;
        }
    },

    /**
     * Calculate daily salary for non-stylist staff
     */
    async calculateDailySalary(staffId: string, date: string) {
        try {
            // Get staff role
            const { data: staff } = await supabase
                .from('staff')
                .select('role')
                .eq('id', staffId)
                .single();

            if (staff?.role === 'Stylist') {
                return; // Stylists don't get daily salary
            }

            // Get salary settings
            const { data: salarySettings } = await supabase
                .from('salary_settings')
                .select('*')
                .eq('staff_id', staffId)
                .eq('is_active', true)
                .single();

            if (!salarySettings) return;

            const salaryAmount = salarySettings.salary_type === 'daily'
                ? salarySettings.amount
                : salarySettings.amount / 30; // Monthly salary divided by 30 days

            // Get or create earnings record
            const { data: existingEarning } = await supabase
                .from('staff_earnings')
                .select('*')
                .eq('staff_id', staffId)
                .eq('date', date)
                .single();

            if (existingEarning) {
                await supabase
                    .from('staff_earnings')
                    .update({
                        salary_amount: salaryAmount,
                        total_earnings: existingEarning.commission_amount + salaryAmount,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existingEarning.id);
            } else {
                await supabase
                    .from('staff_earnings')
                    .insert({
                        staff_id: staffId,
                        date,
                        service_revenue: 0,
                        commission_amount: 0,
                        salary_amount: salaryAmount,
                        total_earnings: salaryAmount,
                        appointments_count: 0
                    });
            }
        } catch (error) {
            console.error('Error calculating daily salary:', error);
            throw error;
        }
    },

    /**
     * Get staff earnings for a date range
     */
    async getStaffEarnings(staffId: string, startDate: string, endDate: string) {
        try {
            const { data, error } = await supabase
                .from('staff_earnings')
                .select('*')
                .eq('staff_id', staffId)
                .gte('date', startDate)
                .lte('date', endDate)
                .order('date', { ascending: false });

            if (error) throw error;
            return data as StaffEarning[];
        } catch (error) {
            console.error('Error fetching staff earnings:', error);
            throw error;
        }
    },

    /**
     * Get all staff earnings summary (for owner/manager)
     */
    async getAllStaffEarnings(startDate: string, endDate: string) {
        try {
            const { data, error } = await supabase
                .from('staff_earnings')
                .select(`
                    *,
                    staff:staff(id, name, role)
                `)
                .gte('date', startDate)
                .lte('date', endDate)
                .order('date', { ascending: false });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error fetching all staff earnings:', error);
            throw error;
        }
    },

    /**
     * Get earnings summary by staff member
     */
    async getEarningsSummaryByStaff(startDate: string, endDate: string) {
        try {
            // 1. Get all active staff first
            const { data: allStaff, error: staffError } = await supabase
                .from('staff')
                .select('id, name, role')
                .eq('is_active', true)
                .order('name');

            if (staffError) throw staffError;

            // 2. Get earnings for the period
            const earnings = await this.getAllStaffEarnings(startDate, endDate);

            // 3. Group earnings by staff
            const earningsMap = new Map();
            earnings?.forEach((earning: any) => {
                const staffId = earning.staff_id;
                if (!earningsMap.has(staffId)) {
                    earningsMap.set(staffId, {
                        total_revenue: 0,
                        total_commission: 0,
                        total_salary: 0,
                        total_earnings: 0,
                        appointments_count: 0
                    });
                }

                const summary = earningsMap.get(staffId);
                summary.total_revenue += earning.service_revenue || 0;
                summary.total_commission += earning.commission_amount || 0;
                summary.total_salary += earning.salary_amount || 0;
                summary.total_earnings += earning.total_earnings || 0;
                summary.appointments_count += earning.appointments_count || 0;
            });

            // 4. Merge all staff with earnings (including those with 0)
            const result = allStaff?.map(staff => {
                const staffEarnings = earningsMap.get(staff.id) || {
                    total_revenue: 0,
                    total_commission: 0,
                    total_salary: 0,
                    total_earnings: 0,
                    appointments_count: 0
                };

                return {
                    staff_id: staff.id,
                    staff_name: staff.name,
                    staff_role: staff.role,
                    ...staffEarnings
                };
            });

            return result;
        } catch (error) {
            console.error('Error getting earnings summary:', error);
            throw error;
        }
    },

    /**
     * Update earnings for multiple appointments in a single invoice (from POS)
     */
    async updateEarningsForMultipleAppointments(
        appointmentIds: string[],
        invoiceItems: any[],
        invoiceId: string
    ) {
        try {
            console.log('📊 Starting earnings update for appointments:', appointmentIds);

            // Get all appointments with stylist info
            const { data: appointments, error: appointmentsError } = await supabase
                .from('appointments')
                .select(`
                    id,
                    stylist_id,
                    appointment_date,
                    services,
                    stylist:staff!stylist_id(id, commission)
                `)
                .in('id', appointmentIds);

            if (appointmentsError) {
                console.error('❌ Error fetching appointments:');
                console.error('  Code:', appointmentsError.code);
                console.error('  Message:', appointmentsError.message);
                console.error('  Details:', appointmentsError.details);
                console.error('  Hint:', appointmentsError.hint);
                throw appointmentsError;
            }

            if (!appointments || appointments.length === 0) {
                console.warn('⚠️ No appointments found for earnings update');
                return;
            }

            console.log(`✅ Found ${appointments.length} appointment(s)`);

            const { data: invoiceRow } = await supabase
                .from('invoices')
                .select('organization_id')
                .eq('id', invoiceId)
                .single();
            const invoiceOrganizationId = invoiceRow?.organization_id as string | undefined;

            // Default commission rate (fallback if staff doesn't have one set)
            const DEFAULT_COMMISSION = 40;

            // Calculate earnings per stylist per appointment
            for (const appointment of appointments) {
                const stylistId = appointment.stylist_id;
                const date = appointment.appointment_date;

                if (!stylistId) {
                    console.warn(`⚠️ Appointment ${appointment.id} has no stylist assigned`);
                    continue;
                }

                // Get commission rate from stylist record, fall back to global settings
                let commissionRate = DEFAULT_COMMISSION;
                const stylistData = appointment.stylist as any; // Type assertion for nested relation

                if (stylistData && stylistData.commission) {
                    commissionRate = stylistData.commission;
                    console.log(`💰 Using stylist commission: ${commissionRate}%`);
                } else {
                    // Fallback to commission_settings table (tenant-scoped)
                    let cq = supabase
                        .from('commission_settings')
                        .select('*')
                        .eq('role', 'Stylist')
                        .eq('is_active', true);
                    if (invoiceOrganizationId) {
                        cq = cq.eq('organization_id', invoiceOrganizationId);
                    }
                    const { data: commissionSettings, error: commissionError } = await cq.single();

                    if (commissionError) {
                        console.warn('⚠️ Error fetching commission settings, using default:', commissionError);
                    } else if (commissionSettings?.commission_percentage) {
                        commissionRate = commissionSettings.commission_percentage;
                        console.log(`💰 Using global commission: ${commissionRate}%`);
                    }
                }

                // Find items belonging to this appointment
                let serviceRevenue = 0;
                let additionalFeesTotal = 0;

                for (const item of invoiceItems) {
                    // Match items by appointmentId
                    if (item.appointmentId === appointment.id) {
                        if (item.type === 'service' || item.type === 'appointment') {
                            const itemRevenue = (item.price || 0) * (item.quantity || 1);
                            serviceRevenue += itemRevenue;

                            // Add additional fee if present
                            const additionalFee = item.additionalFee || 0;
                            additionalFeesTotal += additionalFee;
                        }
                    }
                }

                if (serviceRevenue === 0 && additionalFeesTotal === 0) {
                    console.log(`ℹ️ No revenue for appointment ${appointment.id}, skipping`);
                    continue;
                }

                // Calculate commission on both service revenue and additional fees
                const totalRevenue = serviceRevenue + additionalFeesTotal;
                const commissionAmount = (totalRevenue * commissionRate) / 100;

                console.log(`💰 Earnings for ${appointment.id}: Revenue=${totalRevenue} (Service=${serviceRevenue}, AddFees=${additionalFeesTotal}), Commission=${commissionAmount} (${commissionRate}%)`);

                // Get or create earnings record for this date
                const { data: existingEarning, error: earningFetchError } = await supabase
                    .from('staff_earnings')
                    .select('*')
                    .eq('staff_id', stylistId)
                    .eq('date', date)
                    .single();

                if (earningFetchError && earningFetchError.code !== 'PGRST116') {
                    console.error('❌ Error fetching existing earning:', earningFetchError);
                    throw earningFetchError;
                }

                if (existingEarning) {
                    // Update existing record
                    const { error: updateError } = await supabase
                        .from('staff_earnings')
                        .update({
                            service_revenue: existingEarning.service_revenue + totalRevenue,
                            commission_amount: existingEarning.commission_amount + commissionAmount,
                            total_earnings: existingEarning.total_earnings + commissionAmount,
                            appointments_count: existingEarning.appointments_count + 1,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', existingEarning.id);

                    if (updateError) {
                        console.error('❌ Error updating earning:', updateError);
                        throw updateError;
                    }
                    console.log(`✅ Updated existing earning record for ${date}`);
                } else {
                    // Create new record
                    const { error: insertError } = await supabase
                        .from('staff_earnings')
                        .insert({
                            staff_id: stylistId,
                            date,
                            service_revenue: totalRevenue,
                            commission_amount: commissionAmount,
                            salary_amount: 0,
                            total_earnings: commissionAmount,
                            appointments_count: 1
                        });

                    if (insertError) {
                        console.error('❌ Error inserting earning:', insertError);
                        throw insertError;
                    }
                    console.log(`✅ Created new earning record for ${date}`);
                }
            }

            console.log('✅ Earnings update completed successfully');
        } catch (error: any) {
            console.error('❌ Error updating earnings for multiple appointments');
            console.error('  Error type:', typeof error);
            if (error && typeof error === 'object') {
                console.error('  Code:', error.code);
                console.error('  Message:', error.message);
                console.error('  Details:', error.details);
                console.error('  Hint:', error.hint);
            }
            console.error('  Full error:', JSON.stringify(error, null, 2));
            throw error;
        }
    },

    /**
     * Calculate and update earnings for walk-in services (no appointment)
     * Items should have stylistId and type='walk-in-service'
     */
    async updateEarningsForWalkIn(
        invoiceId: string,
        items: any[],
        invoiceDate: string // created_at from invoice
    ) {
        try {
            console.log('💰 Updating earnings for walk-in services...');

            // Filter walk-in service items that have stylistId
            const walkInItems = items.filter((item: any) =>
                item.type === 'walk-in-service' && item.stylistId
            );

            if (walkInItems.length === 0) {
                console.log('No walk-in items with stylistId found');
                return;
            }

            // Extract date from timestamp
            const date = invoiceDate.split('T')[0];
            console.log(`📅 Processing walk-in earnings for date: ${date}`);

            // Group items by stylist
            const itemsByStylist = new Map<string, any[]>();
            walkInItems.forEach((item: any) => {
                if (!itemsByStylist.has(item.stylistId)) {
                    itemsByStylist.set(item.stylistId, []);
                }
                itemsByStylist.get(item.stylistId)!.push(item);
            });

            console.log(`👨‍💼 Processing earnings for ${itemsByStylist.size} stylist(s)`);

            // Calculate and update earnings for each stylist
            for (const [stylistId, stylistItems] of itemsByStylist) {
                console.log(`\n💵 Processing stylist ${stylistId}...`);

                // Get stylist's commission rate (from staff table or default 40%)
                const { data: stylist } = await supabase
                    .from('staff')
                    .select('commission, name')
                    .eq('id', stylistId)
                    .single();

                const commissionRate = stylist?.commission || 40;
                console.log(`  Commission rate: ${commissionRate}%`);

                // Calculate revenue for this stylist's walk-in services
                const serviceRevenue = stylistItems.reduce((sum: number, item: any) =>
                    sum + (item.price * item.quantity), 0
                );
                const commissionAmount = (serviceRevenue * commissionRate) / 100;

                console.log(`  Service revenue: ${serviceRevenue}`);
                console.log(`  Commission: ${commissionAmount}`);

                // Get or create earnings record for this stylist and date
                const { data: existingEarning } = await supabase
                    .from('staff_earnings')
                    .select('*')
                    .eq('staff_id', stylistId)
                    .eq('date', date)
                    .single();

                if (existingEarning) {
                    // Update existing record
                    console.log(`  Updating existing earnings record...`);
                    const { error: updateError } = await supabase
                        .from('staff_earnings')
                        .update({
                            service_revenue: existingEarning.service_revenue + serviceRevenue,
                            commission_amount: existingEarning.commission_amount + commissionAmount,
                            total_earnings: existingEarning.total_earnings + commissionAmount,
                            // Don't increment appointments_count for walk-ins
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', existingEarning.id);

                    if (updateError) {
                        console.error('❌ Error updating earning:', updateError);
                        throw updateError;
                    }
                    console.log(`  ✅ Updated earnings for ${stylist?.name || stylistId}`);
                } else {
                    // Create new record
                    console.log(`  Creating new earnings record...`);
                    const { error: insertError } = await supabase
                        .from('staff_earnings')
                        .insert({
                            staff_id: stylistId,
                            date,
                            service_revenue: serviceRevenue,
                            commission_amount: commissionAmount,
                            salary_amount: 0,
                            total_earnings: commissionAmount,
                            appointments_count: 0 // 0 for walk-ins
                        });

                    if (insertError) {
                        console.error('❌ Error inserting earning:', insertError);
                        throw insertError;
                    }
                    console.log(`  ✅ Created earnings record for ${stylist?.name || stylistId}`);
                }
            }

            console.log('✅ Walk-in earnings update completed successfully');
        } catch (error: any) {
            console.error('❌ Error updating earnings for walk-in services');
            console.error('  Error:', error);
            throw error;
        }
    }
};
