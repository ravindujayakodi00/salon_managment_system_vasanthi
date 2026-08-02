# Client Website - Appointment Booking API Reference

This document provides all the API endpoints and code needed to implement appointment booking on a client-facing website. The APIs connect to the SalonFlow management system.

## Base Configuration

```javascript
// API Base URL (your deployed URL)
const API_BASE_URL = 'https://your-domain.com/api/public';

// Supabase Configuration (for direct database access if preferred)
const SUPABASE_URL = 'https://gajoxzwbtrbtdlfubucy.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
```

---

## Booking Flow Overview

```
1. Customer selects a SERVICE
2. Customer selects a DATE
3. Two paths:
   a) "No preference" → Show all available stylists with their time slots
   b) "Preferred stylist" → Select stylist → Show their time slots
4. Customer enters their details
5. Submit booking
```

---

## API Endpoints

### 1. Get All Services
**GET** `/api/public/services`

Returns all active services grouped by category.

#### Query Parameters
| Param | Required | Description |
|-------|----------|-------------|
| category | No | Filter by category (e.g., "Hair", "Spa", "Bridal") |
| gender | No | Filter by gender ("Male", "Female", "Unisex") |

#### Example Request
```javascript
const response = await fetch(`${API_BASE_URL}/services`);
const data = await response.json();
```

#### Example Response
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Haircut",
      "description": "Professional haircut",
      "category": "Hair",
      "price": 1500,
      "duration": 45,
      "gender": "Unisex"
    }
  ],
  "grouped": {
    "Hair": [...],
    "Spa": [...],
    "Bridal": [...]
  },
  "total": 25
}
```

---

### 2. Get Stylists for a Service
**GET** `/api/public/stylists`

Returns stylists who can perform a specific service.

#### Query Parameters
| Param | Required | Description |
|-------|----------|-------------|
| service_id | Yes | The service UUID |
| date | No | Filter out unavailable stylists (YYYY-MM-DD) |
| branch_id | No | Filter by branch |

#### Example Request
```javascript
const response = await fetch(
  `${API_BASE_URL}/stylists?service_id=${serviceId}&date=${date}`
);
const data = await response.json();
```

#### Example Response
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Sarah Johnson",
      "workingDays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      "workingHours": { "start": "09:00", "end": "18:00" },
      "skills": [
        { "id": "uuid", "name": "Haircut", "category": "Hair" },
        { "id": "uuid", "name": "Hair Coloring", "category": "Hair" }
      ]
    }
  ],
  "total": 5
}
```

---

### 3. Get Time Slots for a Stylist
**GET** `/api/public/availability`

Returns available time slots for a specific stylist on a date.

#### Query Parameters
| Param | Required | Description |
|-------|----------|-------------|
| stylist_id | Yes | The stylist UUID |
| date | Yes | The date (YYYY-MM-DD) |
| duration | Yes | Service duration in minutes |

#### Example Request
```javascript
const response = await fetch(
  `${API_BASE_URL}/availability?stylist_id=${stylistId}&date=${date}&duration=${duration}`
);
const data = await response.json();
```

#### Example Response
```json
{
  "success": true,
  "data": [
    { "time": "09:00", "available": true },
    { "time": "09:30", "available": true },
    { "time": "10:00", "available": false, "reason": "Already booked" },
    { "time": "10:30", "available": true },
    { "time": "13:00", "available": false, "reason": "Break time" }
  ],
  "stylist": {
    "id": "uuid",
    "name": "Sarah Johnson",
    "workingHours": { "start": "09:00", "end": "18:00" }
  },
  "availableCount": 12,
  "total": 18
}
```

---

### 4. Get All Available Stylists with Time Slots (No Preference Flow)
**GET** `/api/public/available-stylists`

Returns ALL available stylists with their time slots for a service on a date. Use this for the "no preference" booking flow.

#### Query Parameters
| Param | Required | Description |
|-------|----------|-------------|
| service_id | Yes | The service UUID |
| date | Yes | The date (YYYY-MM-DD) |
| branch_id | No | Filter by branch |

#### Example Request
```javascript
const response = await fetch(
  `${API_BASE_URL}/available-stylists?service_id=${serviceId}&date=${date}`
);
const data = await response.json();
```

#### Example Response
```json
{
  "success": true,
  "service": {
    "id": "uuid",
    "name": "Haircut",
    "duration": 45,
    "price": 1500,
    "category": "Hair"
  },
  "date": "2024-12-15",
  "dayOfWeek": "Sunday",
  "data": [
    {
      "stylist": {
        "id": "uuid",
        "name": "Sarah Johnson",
        "workingHours": { "start": "09:00", "end": "18:00" }
      },
      "skills": [
        { "id": "uuid", "name": "Haircut", "category": "Hair" }
      ],
      "slots": [
        { "time": "09:00", "available": true },
        { "time": "09:30", "available": false, "reason": "Already booked" }
      ],
      "availableCount": 8
    }
  ],
  "totalStylists": 3
}
```

---

### 5. Create Booking
**POST** `/api/public/book`

Creates a new appointment booking.

#### Request Body
```json
{
  "customer": {
    "name": "John Doe",
    "phone": "+94771234567",
    "email": "john@example.com",
    "gender": "Male",
    "date_of_birth": "1990-05-12"
  },
  "appointment": {
    "service_id": "service-uuid",
    "stylist_id": "stylist-uuid",
    "date": "2024-12-15",
    "time": "10:00",
    "notes": "First time customer"
  }
}
```

#### Example Request
```javascript
const response = await fetch(`${API_BASE_URL}/book`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    customer: {
      name: customerName,
      phone: customerPhone,
      email: customerEmail,
      gender: customerGender,
      date_of_birth: customerDateOfBirth
    },
    appointment: {
      service_id: selectedServiceId,
      stylist_id: selectedStylistId,
      date: selectedDate,
      time: selectedTime,
      notes: notes
    }
  })
});

const result = await response.json();
```

#### Success Response (201)
```json
{
  "success": true,
  "message": "Appointment booked successfully",
  "data": {
    "appointmentId": "uuid",
    "date": "2024-12-15",
    "time": "10:00",
    "status": "Pending",
    "service": {
      "name": "Haircut",
      "duration": 45,
      "price": 1500
    },
    "stylist": {
      "name": "Sarah Johnson"
    },
    "customer": {
      "name": "John Doe",
      "phone": "+94771234567"
    }
  }
}
```

#### Error Responses
| Status | Error |
|--------|-------|
| 400 | Validation errors (missing fields, past date) |
| 404 | Service or stylist not found |
| 409 | Time slot no longer available |
| 500 | Internal server error |

---

## Complete React Implementation Example

```jsx
import { useState, useEffect } from 'react';

const API_BASE = 'https://your-domain.com/api/public';

export default function BookingPage() {
  // State
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [hasStylistPreference, setHasStylistPreference] = useState(null);
  const [stylists, setStylists] = useState([]);
  const [selectedStylist, setSelectedStylist] = useState(null);
  const [timeSlots, setTimeSlots] = useState([]);
  const [selectedTime, setSelectedTime] = useState('');
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    phone: '',
    email: '',
    gender: 'Female'
  });
  const [loading, setLoading] = useState(false);

  // Step 1: Load services on mount
  useEffect(() => {
    fetch(`${API_BASE}/services`)
      .then(res => res.json())
      .then(data => setServices(data.data || []));
  }, []);

  // Step 2: When service and date are selected, and user has NO preference
  useEffect(() => {
    if (selectedService && selectedDate && hasStylistPreference === false) {
      setLoading(true);
      fetch(`${API_BASE}/available-stylists?service_id=${selectedService.id}&date=${selectedDate}`)
        .then(res => res.json())
        .then(data => {
          setStylists(data.data || []);
          setLoading(false);
        });
    }
  }, [selectedService, selectedDate, hasStylistPreference]);

  // Step 3: When service and date are selected, and user HAS preference
  useEffect(() => {
    if (selectedService && selectedDate && hasStylistPreference === true) {
      setLoading(true);
      fetch(`${API_BASE}/stylists?service_id=${selectedService.id}&date=${selectedDate}`)
        .then(res => res.json())
        .then(data => {
          setStylists(data.data || []);
          setLoading(false);
        });
    }
  }, [selectedService, selectedDate, hasStylistPreference]);

  // Step 4: When stylist is selected (preferred flow), load their time slots
  useEffect(() => {
    if (selectedStylist && selectedDate && selectedService && hasStylistPreference === true) {
      setLoading(true);
      fetch(`${API_BASE}/availability?stylist_id=${selectedStylist.id}&date=${selectedDate}&duration=${selectedService.duration}`)
        .then(res => res.json())
        .then(data => {
          setTimeSlots(data.data || []);
          setLoading(false);
        });
    }
  }, [selectedStylist, selectedDate, selectedService, hasStylistPreference]);

  // Handle booking submission
  const handleBooking = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: customerInfo,
          appointment: {
            service_id: selectedService.id,
            stylist_id: selectedStylist.id,
            date: selectedDate,
            time: selectedTime
          }
        })
      });

      const result = await response.json();
      
      if (result.success) {
        alert('Booking confirmed!');
        // Reset or redirect
      } else {
        alert(result.error || 'Booking failed');
      }
    } catch (error) {
      alert('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Step 1: Service Selection */}
      <section>
        <h2>Select a Service</h2>
        {services.map(service => (
          <button 
            key={service.id}
            onClick={() => setSelectedService(service)}
            className={selectedService?.id === service.id ? 'selected' : ''}
          >
            {service.name} - Rs {service.price} ({service.duration} mins)
          </button>
        ))}
      </section>

      {/* Step 2: Date Selection */}
      {selectedService && (
        <section>
          <h2>Select Date</h2>
          <input 
            type="date"
            value={selectedDate}
            min={new Date().toISOString().split('T')[0]}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </section>
      )}

      {/* Step 3: Stylist Preference */}
      {selectedService && selectedDate && (
        <section>
          <h2>Do you have a preferred stylist?</h2>
          <button onClick={() => setHasStylistPreference(true)}>
            Yes, I have a preference
          </button>
          <button onClick={() => setHasStylistPreference(false)}>
            No, show all available
          </button>
        </section>
      )}

      {/* Step 4a: Select Stylist (Preferred Flow) */}
      {hasStylistPreference === true && stylists.length > 0 && (
        <section>
          <h2>Select Your Preferred Stylist</h2>
          {stylists.map(stylist => (
            <button 
              key={stylist.id}
              onClick={() => setSelectedStylist(stylist)}
            >
              {stylist.name}
            </button>
          ))}
        </section>
      )}

      {/* Step 4b: Select Time (Preferred Flow) */}
      {hasStylistPreference === true && selectedStylist && timeSlots.length > 0 && (
        <section>
          <h2>Select Time</h2>
          {timeSlots.filter(slot => slot.available).map(slot => (
            <button 
              key={slot.time}
              onClick={() => setSelectedTime(slot.time)}
            >
              {slot.time}
            </button>
          ))}
        </section>
      )}

      {/* Step 4c: Select Stylist + Time (No Preference Flow) */}
      {hasStylistPreference === false && stylists.length > 0 && (
        <section>
          <h2>Available Stylists</h2>
          {stylists.map(item => (
            <div key={item.stylist.id}>
              <h3>{item.stylist.name}</h3>
              <div>
                {item.slots.filter(slot => slot.available).map(slot => (
                  <button 
                    key={slot.time}
                    onClick={() => {
                      setSelectedStylist(item.stylist);
                      setSelectedTime(slot.time);
                    }}
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Step 5: Customer Info */}
      {selectedStylist && selectedTime && (
        <section>
          <h2>Your Details</h2>
          <input 
            placeholder="Name"
            value={customerInfo.name}
            onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})}
          />
          <input 
            placeholder="Phone"
            value={customerInfo.phone}
            onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
          />
          <input 
            placeholder="Email (optional)"
            value={customerInfo.email}
            onChange={(e) => setCustomerInfo({...customerInfo, email: e.target.value})}
          />
          <input
            type="date"
            value={customerInfo.dateOfBirth}
            onChange={(e) => setCustomerInfo({...customerInfo, dateOfBirth: e.target.value})}
            required
          />
          <select 
            value={customerInfo.gender}
            onChange={(e) => setCustomerInfo({...customerInfo, gender: e.target.value})}
          >
            <option value="Female">Female</option>
            <option value="Male">Male</option>
            <option value="Other">Other</option>
          </select>
          
          <button onClick={handleBooking} disabled={loading}>
            {loading ? 'Booking...' : 'Confirm Booking'}
          </button>
        </section>
      )}
    </div>
  );
}
```

---

## Database Schema Reference

### Services Table
```sql
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  price NUMERIC NOT NULL,
  duration INTEGER NOT NULL, -- in minutes
  gender TEXT CHECK (gender IN ('Male', 'Female', 'Unisex')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Staff Table
```sql
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  role TEXT CHECK (role IN ('Manager', 'Receptionist', 'Stylist')),
  branch_id UUID REFERENCES branches(id),
  specializations TEXT[] DEFAULT '{}', -- Array of service IDs
  working_days TEXT[] DEFAULT '{}', -- ["Monday", "Tuesday", ...]
  working_hours JSONB DEFAULT '{"start": "09:00", "end": "18:00"}',
  is_active BOOLEAN DEFAULT true,
  is_emergency_unavailable BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Customers Table
```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  email TEXT,
  gender TEXT CHECK (gender IN ('Male', 'Female', 'Other')),
  date_of_birth DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Appointments Table
```sql
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  stylist_id UUID REFERENCES staff(id),
  branch_id UUID REFERENCES branches(id),
  service_id UUID REFERENCES services(id),
  date DATE NOT NULL,
  time TIME NOT NULL,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Confirmed', 'InService', 'Completed', 'Cancelled', 'NoShow')),
  notes TEXT,
  payment_status TEXT DEFAULT 'Unpaid',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Utility Functions

### Format Time (12-hour)
```javascript
function formatTime(time) {
  if (!time) return '';
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}
```

### Format Date
```javascript
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}
```

### Get Minimum Bookable Date
```javascript
function getMinDate() {
  return new Date().toISOString().split('T')[0];
}
```

---

## Error Handling Best Practices

```javascript
async function apiCall(url, options = {}) {
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Something went wrong');
    }
    
    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}
```

---

## CORS Configuration (Server-side)

If the client website is on a different domain, ensure CORS is configured:

```javascript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/api/public/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },
    ];
  },
};
```

---

## Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/public/services` | GET | List all services |
| `/api/public/stylists` | GET | Get stylists for a service |
| `/api/public/availability` | GET | Get time slots for a stylist |
| `/api/public/available-stylists` | GET | Get all stylists with slots (no preference) |
| `/api/public/book` | POST | Create a booking |
