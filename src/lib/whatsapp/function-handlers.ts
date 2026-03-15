import { servicesService } from '@/services/services';
import { appointmentsService } from '@/services/appointments';
import { bookingStateOptions } from '@/lib/whatsapp/booking-state';
import { loyaltyService } from '@/services/loyalty';
import { promosService } from '@/services/promos';
import { customersService } from '@/services/customers';

export async function handleFunctionCall(name: string, args: any, customerPhone: string) {
    console.log(`Executing function: ${name}`, args);

    // 1. Identify Customer
    const customer = await customersService.getCustomerByPhone(customerPhone);

    switch (name) {
        case "get_services":
            try {
                const services = await servicesService.getServices();
                const category = args.category;
                const filtered = category
                    ? services.filter(s => s.category?.toLowerCase() === category.toLowerCase())
                    : services;

                return filtered.map(s => ({
                    id: s.id,
                    name: s.name,
                    price: s.price,
                    duration: s.duration,
                    category: s.category
                }));
            } catch (error: any) {
                return { error: error.message };
            }

        case "get_available_slots":
            try {
                const { date, service_id } = args;
                const service = await servicesService.getServiceById(service_id);
                const duration = service?.duration || 60;

                const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.salonflow.space';
                const res = await fetch(`${baseUrl}/api/public/consolidated-availability?date=${date}&service_id=${service_id}&duration=${duration}`);
                const data = await res.json();

                return {
                    date,
                    slots: data.slots || [],
                    message: data.slots?.length > 0 ? "Available slots found." : "No slots available for this date."
                };
            } catch (error: any) {
                return { error: error.message };
            }

        case "book_appointment":
            try {
                const { service_id, date, time, customer_name, stylist_id, email } = args;

                // 1. Get current slot memory
                const currentSlots: any = await bookingStateOptions.getSlots(customerPhone) || {};

                // 2. Merge new extracted slots
                if (service_id) currentSlots.serviceId = service_id;
                if (date) currentSlots.date = date;
                if (time) currentSlots.time = time;
                if (customer_name) currentSlots.customerName = customer_name;
                
                // 3. Save merged slots back to memory
                currentSlots.lastInteraction = new Date().toISOString();
                await bookingStateOptions.saveSlots(customerPhone, currentSlots as any);

                // 4. Validate if we have everything
                const validation = await bookingStateOptions.validateAndFormatSlots(currentSlots);

                if (!validation.isComplete) {
                    // Tell Gemini what's missing so it can ask the user naturally
                    return { 
                        status: "INCOMPLETE",
                        message: "Please ask the user for the missing information.",
                        missing_fields: validation.missingFields,
                        current_known_slots: currentSlots
                    };
                }

                // --- SLOTS ARE COMPLETE. PROCEED TO BOOKING --- //

                // Ensure customer exists or create one
                let customerId = customer?.id;
                if (!customer) {
                    const newCustomer = await customersService.createCustomer({
                        name: customer_name || "WhatsApp Customer",
                        phone: customerPhone,
                        email: email
                    });
                    customerId = newCustomer.id;
                }

                const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                               (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                               (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.salonflow.space'));
                               
                const bookRes = await fetch(`${baseUrl}/api/public/book`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        customer: {
                            name: customer?.name || customer_name || "WhatsApp Customer",
                            phone: customerPhone,
                            email: email || customer?.email || null
                        },
                        appointment: {
                            service_id: currentSlots.serviceId as string,
                            stylist_id: stylist_id || 'NO_PREFERENCE',
                            date: currentSlots.date as string,
                            time: currentSlots.time as string
                        }
                    })
                });

                const bookData = await bookRes.json();
                
                // Clear memory after successful attempt
                await bookingStateOptions.saveSlots(customerPhone, null);

                if (bookRes.ok) {
                    return { 
                        status: "SUCCESS", 
                        message: `Successfully booked ${currentSlots.serviceName || 'your service'} on ${currentSlots.date} at ${currentSlots.time}. Please tell the user they are confirmed.`,
                        appointmentDetails: bookData.data 
                    };
                } else {
                    return { 
                        status: "FAILED", 
                        error: bookData.error || "Slot no longer available." 
                    };
                }
                
            } catch (error: any) {
                console.error("Booking slot error:", error);
                return { error: error.message };
            }

        case "get_customer_appointments":
            try {
                if (!customer) return { message: "No customer profile found for this number." };

                const appointments = await appointmentsService.getAppointments();

                // Filter for this customer and upcoming
                const filtered = appointments
                    .filter((a: any) => a.customer_id === customer.id && (a.status === 'Pending' || a.status === 'Confirmed'))
                    .sort((a: any, b: any) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime());

                return filtered.map((a: any) => ({
                    id: a.id,
                    date: a.appointment_date,
                    time: a.start_time,
                    status: a.status,
                    service: a.services_details?.[0]?.name || "Service"
                }));
            } catch (error: any) {
                return { error: error.message };
            }

        case "cancel_appointment":
            try {
                const { appointment_id } = args;
                // Verify appointment belongs to customer
                const apt = await appointmentsService.getAppointmentById(appointment_id);
                if (apt.customer_id !== customer?.id) {
                    return { error: "Unauthorized. This appointment does not belong to you." };
                }

                await appointmentsService.updateStatus(appointment_id, 'Cancelled');
                return { success: true, message: "Appointment cancelled successfully." };
            } catch (error: any) {
                return { error: error.message };
            }

        case "get_loyalty_info":
            try {
                if (!customer) return { message: "No loyalty profile found." };
                const loyaltyInfo = await loyaltyService.getCustomerLoyaltyInfo(customer.id);
                return {
                    points: loyaltyInfo.availablePoints,
                    pointsValue: loyaltyInfo.pointsValue,
                    cardValid: loyaltyInfo.cardValid,
                    totalVisits: loyaltyInfo.totalVisits,
                    eligibleForReward: loyaltyInfo.eligibleForVisitReward,
                    nextRewardAt: loyaltyInfo.nextRewardVisit
                };
            } catch (error: any) {
                return { error: error.message };
            }

        case "check_promo_code":
            try {
                const { code } = args;
                const promos = await promosService.getPromoCodes({ isActive: true });
                const promo = promos.find(p => p.code.toUpperCase() === code.toUpperCase());

                if (!promo) return { valid: false, message: "Invalid or expired promo code." };

                return {
                    valid: true,
                    type: promo.type,
                    value: promo.value,
                    description: promo.description,
                    minSpend: promo.min_spend
                };
            } catch (error: any) {
                return { error: error.message };
            }

        default:
            return { error: `Function ${name} not found.` };
    }
}
