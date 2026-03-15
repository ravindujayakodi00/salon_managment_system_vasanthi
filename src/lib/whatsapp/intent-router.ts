import { sendWhatsAppMessage, createTextMessage, createButtonsMessage } from '@/lib/whatsapp';
import { servicesService } from '@/services/services';
import { appointmentsService } from '@/services/appointments';
import { customersService } from '@/services/customers';
import { bookingStateOptions } from '@/lib/whatsapp/booking-state';

type Intent = 'GREETING' | 'HELP' | 'SERVICES' | 'START_BOOKING' | 'MY_APPOINTMENTS' | 'CANCEL' | 'UNKNOWN';

export const intentRouter = {
    detectIntent(text: string): Intent {
        const lowerText = text.toLowerCase().trim();
        
        // Exact small talk matches
        if (['hi', 'hello', 'hey', 'hai', 'ayubowan', 'get started'].includes(lowerText)) return 'GREETING';
        if (['help', 'menu', 'options', 'btn_menu'].includes(lowerText)) return 'HELP';
        
        // Keyword matches
        if (lowerText.includes('service') || lowerText.includes('price') || lowerText.includes('cost') || lowerText.includes('offer') || lowerText === 'btn_services') return 'SERVICES';
        
        // Appointment viewing
        if (lowerText === 'btn_my_appts' || ((lowerText.includes('my') || lowerText.includes('view') || lowerText.includes('check')) && 
            (lowerText.includes('appointment') || lowerText.includes('booking')))) {
            return 'MY_APPOINTMENTS';
        }
        
        // Cancel
        if (lowerText.includes('cancel')) return 'CANCEL';
        
        // Booking trigger (very lenient to catch most intents to book)
        if (lowerText === 'btn_book' || lowerText.includes('book') || lowerText.includes('appoint') || lowerText.includes('schedule') || lowerText.includes('new')) {
            return 'START_BOOKING';
        }

        return 'UNKNOWN';
    },

    async handleIntent(intent: Intent, phone: string): Promise<boolean> {
        // Return true if handled (skip AI), false if AI should handle it
        
        switch (intent) {
            case 'GREETING':
            case 'HELP':
                await this.sendMainMenu(phone);
                return true;
                
            case 'SERVICES':
                await this.sendServicesList(phone);
                return true;
                
            case 'MY_APPOINTMENTS':
                await this.sendMyAppointments(phone);
                return true;

            case 'START_BOOKING':
                // Clear any old, stale booking memory
                await bookingStateOptions.saveSlots(phone, null);
                return false; // Crucial: Return false so the webhook knows to pass this to Gemini AI to start the conversational flow

            default:
                return false; // Let AI or state machine handle it
        }
    },

    async sendMainMenu(phone: string) {
        const message = createButtonsMessage(
            "👋 Welcome to *SalonFlow*!\n\nI'm your virtual assistant. How can I help you today?",
            [
                { id: 'btn_book', title: '📅 Book' },
                { id: 'btn_services', title: '✂️ Services' },
                { id: 'btn_my_appts', title: '📋 Bookings' }
            ]
        );
        await sendWhatsAppMessage(phone, message);
    },

    async sendServicesList(phone: string) {
        try {
            const services = await servicesService.getServices();
            if (!services.length) {
                await sendWhatsAppMessage(phone, createTextMessage("We don't have any services listed right now. Please call us."));
                return;
            }

            // Group by category, limit to 10 total sections/rows for WhatsApp limits
            const categories = [...new Set(services.map(s => s.category || 'Other'))].slice(0, 3);
            
            let text = "✨ *Our Services & Prices* ✨\n\n";
            
            categories.forEach(cat => {
                const catServices = services.filter(s => (s.category || 'Other') === cat).slice(0, 5);
                text += `*${cat.toUpperCase()}*\n`;
                catServices.forEach(s => {
                    text += `▫️ ${s.name} - Rs.${s.price}\n`;
                });
                text += "\n";
            });

            const message = createButtonsMessage(text + "Tap below to book an appointment!", [
                { id: 'btn_book', title: '📅 Book Now' },
                { id: 'btn_menu', title: '🔙 Main Menu' }
            ]);
            
            await sendWhatsAppMessage(phone, message);
        } catch (error) {
            console.error('Error fetching services:', error);
            await sendWhatsAppMessage(phone, createTextMessage("Sorry, I couldn't load the services right now."));
        }
    },

    async sendMyAppointments(phone: string) {
        try {
            const customer = await customersService.getCustomerByPhone(phone);
            if (!customer) {
                await sendWhatsAppMessage(phone, createTextMessage("You don't have any appointments with us yet. Type 'book' to make one!"));
                return;
            }

            const allAppts = await appointmentsService.getAppointments();
            const upcoming = allAppts
                .filter((a: any) => a.customer_id === customer.id && (a.status === 'Pending' || a.status === 'Confirmed'))
                .sort((a: any, b: any) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime())
                .slice(0, 3); // Max 3 for readability

            if (upcoming.length === 0) {
                await sendWhatsAppMessage(phone, createButtonsMessage(
                    "You have no upcoming appointments.",
                    [{ id: 'btn_book', title: '📅 Book' }]
                ));
                return;
            }

            let text = "*Your Upcoming Appointments:*\n\n";
            upcoming.forEach((a: any, i: number) => {
                const serviceName = a.services_details?.[0]?.name || "Service";
                text += `${i + 1}. *${serviceName}*\n📅 ${a.appointment_date} at 🕒 ${a.start_time}\nStatus: ${a.status}\n\n`;
            });

            text += "To cancel an appointment, just tell me which one you want to cancel.";

            await sendWhatsAppMessage(phone, createTextMessage(text));
        } catch (error) {
            console.error('Error fetching appointments:', error);
            await sendWhatsAppMessage(phone, createTextMessage("Sorry, I couldn't check your appointments right now."));
        }
    }
};
