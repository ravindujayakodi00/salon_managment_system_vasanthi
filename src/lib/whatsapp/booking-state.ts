import { sendWhatsAppMessage, createTextMessage, createButtonsMessage } from '@/lib/whatsapp';
import { servicesService } from '@/services/services';
import { customersService } from '@/services/customers';
import { getAdminClient } from '@/lib/supabase';

export type BookingState = 'IDLE' | 'SELECT_SERVICE' | 'SELECT_DATE' | 'SELECT_SLOT' | 'CONFIRMING' | 'BOOKED';

export interface AppointmentStateData {
    status: BookingState;
    serviceId?: string;
    serviceName?: string;
    serviceDuration?: number;
    date?: string; // YYYY-MM-DD
    time?: string; // HH:MM
    lastInteraction: string;
}

export const bookingFlow = {
    async getState(phone: string): Promise<AppointmentStateData | null> {
        const supabase = getAdminClient();
        const { data } = await supabase
            .from('bot_sessions')
            .select('appointment_state')
            .eq('phone_number', phone)
            .single();
            
        return data?.appointment_state || null;
    },

    async saveState(phone: string, state: AppointmentStateData | null) {
        const supabase = getAdminClient();
        
        // Check if session exists first
        const { data: existing } = await supabase
            .from('bot_sessions')
            .select('id')
            .eq('phone_number', phone)
            .single();

        if (existing) {
            await supabase
                .from('bot_sessions')
                .update({ 
                    appointment_state: state as any,
                    state_updated_at: new Date().toISOString()
                })
                .eq('phone_number', phone);
        } else {
            // Create the session if it doesn't exist yet (e.g. user typed 'book' as their very first message)
            await supabase
                .from('bot_sessions')
                .insert({
                    phone_number: phone,
                    appointment_state: state as any,
                    state_updated_at: new Date().toISOString(),
                    conversation_history: []
                });
        }
    },

    async handleBookingFlow(phone: string, text: string, currentState: AppointmentStateData): Promise<boolean> {
        const lowerText = text.toLowerCase().trim();
        
        // Allow user to cancel flow at any time
        if (lowerText === 'cancel' || lowerText === 'stop' || lowerText === 'exit') {
            await this.saveState(phone, null);
            await sendWhatsAppMessage(phone, createTextMessage("Booking cancelled. Type 'hi' to start over."));
            return true;
        }

        try {
            switch (currentState.status) {
                case 'IDLE':
                    // This shouldn't be reached as router should push to SELECT_SERVICE
                    return false;
                    
                case 'SELECT_SERVICE':
                    return await this.handleServiceSelection(phone, text, currentState);
                    
                case 'SELECT_DATE':
                    return await this.handleDateSelection(phone, text, currentState);
                    
                case 'SELECT_SLOT':
                    return await this.handleSlotSelection(phone, text, currentState);
                    
                case 'CONFIRMING':
                    return await this.handleConfirmation(phone, text, currentState);
                    
                default:
                    await this.saveState(phone, null);
                    return false;
            }
        } catch (error) {
            console.error('Booking flow error:', error);
            await sendWhatsAppMessage(phone, createTextMessage("Sorry, I encountered an error. Let's start over. Type 'book' to try again."));
            await this.saveState(phone, null);
            return true;
        }
    },

    async startBooking(phone: string) {
        // Step 1: Initialize state and show top services
        await this.saveState(phone, {
            status: 'SELECT_SERVICE',
            lastInteraction: new Date().toISOString()
        });

        const services = await servicesService.getServices();
        if (!services.length) {
            await sendWhatsAppMessage(phone, createTextMessage("Sorry, no services are currently available."));
            await this.saveState(phone, null);
            return;
        }

        // Get top 6 services for buttons (WhatsApp limits buttons to 3, so we use multiple messages or lists)
        // For simplicity in UI, we'll list them and ask them to reply with the exact name or ID
        let text = "*Step 1: Choose a Service*\n\nPlease reply with the *NAME* of the service you want to book:\n\n";
        
        // Take top 8 services 
        services.slice(0, 8).forEach((s, idx) => {
            text += `*${idx + 1}.* ${s.name} (Rs.${s.price})\n`;
        });
        text += "\n_(Or type 'cancel' to stop)_";

        await sendWhatsAppMessage(phone, createTextMessage(text));
    },

    async handleServiceSelection(phone: string, text: string, state: AppointmentStateData) {
        // Find matching service
        const services = await servicesService.getServices();
        const lowerText = text.toLowerCase().trim();
        
        // Try exact match first
        let selected = services.find(s => s.name.toLowerCase() === lowerText);
        
        // If they replied with a number, try to match the index of the top 8 services shown to them
        if (!selected && /^\d+$/.test(lowerText)) {
            const index = parseInt(lowerText, 10) - 1;
            const topServices = services.slice(0, 8);
            if (index >= 0 && index < topServices.length) {
                selected = topServices[index];
            }
        }

        // If no exact match or number, try partial match (check if user input is contained in service name, or vice versa)
        if (!selected) {
            selected = services.find(s => s.name.toLowerCase().includes(lowerText) || lowerText.includes(s.name.toLowerCase()));
        }
        
        // Try extracting service ID directly if we sent it via a button payload later
        if (!selected) {
             selected = services.find(s => s.id === text);
        }

        if (!selected) {
            await sendWhatsAppMessage(phone, createTextMessage("I couldn't find that service. Please reply with the exact name from the list."));
            return true;
        }

        // Update state to Date Selection
        state.status = 'SELECT_DATE';
        state.serviceId = selected.id;
        state.serviceName = selected.name;
        state.serviceDuration = selected.duration || 60;
        state.lastInteraction = new Date().toISOString();
        await this.saveState(phone, state);

        // Ask for Date
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = tomorrow.toISOString().split('T')[0];

        const msg = `Great! You selected *${selected.name}*.\n\n*Step 2: When would you like to come in?*\n\nPlease reply with a date (e.g., "Tomorrow", "Next Monday", or "${dateStr}")`;
        await sendWhatsAppMessage(phone, createTextMessage(msg));
        return true;
    },

    async handleDateSelection(phone: string, text: string, state: AppointmentStateData) {
        // Parse the date (very simplified for now - in production use a NLP date parser)
        const lowerText = text.toLowerCase().trim();
        let targetDate = new Date();
        
        if (lowerText.includes('tomorrow')) {
            targetDate.setDate(targetDate.getDate() + 1);
        } else if (lowerText.match(/^\d{4}-\d{2}-\d{2}$/)) {
            // YYYY-MM-DD
            targetDate = new Date(text);
        } else {
            // Try to let AI parse it by falling back, OR assume today if "today"
            if (lowerText.includes('today')) {
                // Keep targetDate as today
            } else {
                await sendWhatsAppMessage(phone, createTextMessage("I couldn't understand that date. Please use format YYYY-MM-DD (e.g., 2026-03-20) or say 'tomorrow'."));
                return true;
            }
        }

        const dateStr = targetDate.toISOString().split('T')[0];
        
        // Fetch valid slots for this date
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.salonflow.space';
        try {
            const res = await fetch(`${baseUrl}/api/public/consolidated-availability?date=${dateStr}&service_id=${state.serviceId}&duration=${state.serviceDuration}`);
            const data = await res.json();
            
            if (!data.slots || data.slots.length === 0) {
                await sendWhatsAppMessage(phone, createTextMessage(`Sorry, we are fully booked on ${dateStr}. Please reply with a different date.`));
                return true;
            }

            // Move to slot selection
            state.status = 'SELECT_SLOT';
            state.date = dateStr;
            state.lastInteraction = new Date().toISOString();
            await this.saveState(phone, state);

            let msg = `*Step 3: Choose a Time*\n\nAvailable slots on ${dateStr}:\n`;
            
            const displaySlots = data.slots.slice(0, 8); // Max 8 for readability
            displaySlots.forEach((slot: any) => {
                msg += `▫️ ${slot.time}\n`;
            });
            
            msg += `\nPlease reply with your preferred time (e.g., "${displaySlots[0].time}").`;
            await sendWhatsAppMessage(phone, createTextMessage(msg));
            return true;
        } catch (error) {
            console.error('Error fetching slots:', error);
            await sendWhatsAppMessage(phone, createTextMessage("Sorry, I couldn't fetch available times. Let's try another date."));
            return true;
        }
    },

    async handleSlotSelection(phone: string, text: string, state: AppointmentStateData) {
        const lowerText = text.toLowerCase().trim();
        
        // 1. Try strict mapping of HH:MM
        let timeStr = "";
        const timeMatch = text.match(/\d{1,2}:\d{2}/);
        
        if (timeMatch) {
            timeStr = timeMatch[0];
            // Normalize time if needed (e.g., "9:00" -> "09:00")
            if (timeStr.length === 4) timeStr = `0${timeStr}`;
        } else {
            // 2. Try to match am/pm if they just typed "10 am"
            const amPmMatch = lowerText.match(/^(\d{1,2})(?:\s*)?(am|pm)$/);
            if (amPmMatch) {
                let hour = parseInt(amPmMatch[1], 10);
                const isPm = amPmMatch[2] === 'pm';
                if (isPm && hour < 12) hour += 12;
                if (!isPm && hour === 12) hour = 0;
                timeStr = `${hour.toString().padStart(2, '0')}:00`;
            } else {
                await sendWhatsAppMessage(phone, createTextMessage("Please reply with a valid time from the list (e.g., *10:00*)."));
                return true;
            }
        }

        // Move to confirm
        state.status = 'CONFIRMING';
        state.time = timeStr;
        state.lastInteraction = new Date().toISOString();
        await this.saveState(phone, state);

        const summaryMsg = `*Step 4: Confirm Booking*\n\nHere are your details:\n` +
                           `▫️ Service: *${state.serviceName}*\n` +
                           `▫️ Date: *${state.date}*\n` +
                           `▫️ Time: *${state.time}*\n\n` +
                           `Please reply with *YES* to confirm or *NO* to cancel.`;

        await sendWhatsAppMessage(phone, createButtonsMessage(summaryMsg, [
            { id: 'book_yes', title: '✅ YES Confirm' },
            { id: 'book_no', title: '❌ NO Cancel' }
        ]));
        
        return true;
    },

    async handleConfirmation(phone: string, text: string, state: AppointmentStateData) {
        const lowerText = text.toLowerCase().trim();
        
        if (lowerText === 'no' || lowerText === 'book_no') {
            await this.saveState(phone, null);
            await sendWhatsAppMessage(phone, createTextMessage("Booking cancelled. Hope to see you another time!"));
            return true;
        }
        
        if (lowerText === 'yes' || lowerText === 'book_yes' || lowerText.includes('yes confirm')) {
            // Process booking
            try {
                // Ensure customer exists using the exact WhatsApp phone number
                let customer = await customersService.getCustomerByPhone(phone);
                
                if (!customer) {
                    customer = await customersService.createCustomer({
                        name: "WhatsApp Customer",
                        phone: phone // Ensure WhatsApp chatting number is used exclusively
                    });
                }

                // Call the internal booking API to leverage the dispatcher, branch assignment, SMS, and Email logic
                const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                               (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                               (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.salonflow.space'));
                               
                const bookRes = await fetch(`${baseUrl}/api/public/book`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        customer: {
                            name: customer.name,
                            phone: phone, // This maps correctly
                            email: customer.email || null
                        },
                        appointment: {
                            service_id: state.serviceId,
                            stylist_id: 'NO_PREFERENCE',
                            date: state.date,
                            time: state.time
                        }
                    })
                });

                const bookData = await bookRes.json();
                
                await this.saveState(phone, null); // Clear state

                if (bookRes.ok) {
                    await sendWhatsAppMessage(phone, createTextMessage(`🎉 *Booking Confirmed!*\n\nSee you on ${state.date} at ${state.time} for your ${state.serviceName}.\n\nYour reference ID is: ${bookData.data?.appointmentId?.slice(0, 8) || 'N/A'}`));
                } else {
                    await sendWhatsAppMessage(phone, createTextMessage(`Sorry, we couldn't confirm your booking: ${bookData.error || 'Slot no longer available'}. Please start over by typing 'book'.`));
                }
                
                return true;
            } catch (error: any) {
                console.error('Booking finalization error:', error);
                await sendWhatsAppMessage(phone, createTextMessage(`A technical error occurred while saving your booking. Please try again or call us.`));
                await this.saveState(phone, null);
                return true;
            }
        }
        
        await sendWhatsAppMessage(phone, createTextMessage("Please reply with YES or NO."));
        return true;
    }
};
