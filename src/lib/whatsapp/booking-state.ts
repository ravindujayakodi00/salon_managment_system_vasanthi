import { getAdminClient } from '@/lib/supabase';
import { servicesService } from '@/services/services';

export interface AppointmentSlots {
    serviceId?: string;
    serviceName?: string;
    date?: string; // YYYY-MM-DD
    time?: string; // HH:MM
    customerName?: string;
    email?: string;
    stylistId?: string;
    lastInteraction: string;
}

export const bookingStateOptions = {
    async getSlots(phone: string): Promise<AppointmentSlots | null> {
        const supabase = getAdminClient();
        const { data } = await supabase
            .from('bot_sessions')
            .select('appointment_state')
            .eq('phone_number', phone)
            .single();
            
        return data?.appointment_state || null;
    },

    async saveSlots(phone: string, slots: AppointmentSlots | null) {
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
                    appointment_state: slots as any,
                    state_updated_at: new Date().toISOString()
                })
                .eq('phone_number', phone);
        } else {
            // Create the session if it doesn't exist yet
            await supabase
                .from('bot_sessions')
                .insert({
                    phone_number: phone,
                    appointment_state: slots as any,
                    state_updated_at: new Date().toISOString(),
                    conversation_history: []
                });
        }
    },

    async validateAndFormatSlots(slots: AppointmentSlots): Promise<{ 
        isComplete: boolean; 
        missingFields: string[];
    }> {
        const missingFields: string[] = [];

        if (!slots.serviceId) {
            missingFields.push('service_id');
        } else if (!slots.serviceName) {
            // If we have an ID but no name, let's fetch it to enrich memory
            try {
                const service = await servicesService.getServiceById(slots.serviceId);
                if (service) {
                    slots.serviceName = service.name;
                }
            } catch (e) {
                console.error("Failed to enrich service name", e);
            }
        }

        if (!slots.date) missingFields.push('date');
        if (!slots.time) missingFields.push('time');

        return {
            isComplete: missingFields.length === 0,
            missingFields
        };
    }
};
