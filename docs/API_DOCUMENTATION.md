# Public Booking API Documentation

Base URL: `https://your-domain.com/api/public`

## Authentication
These endpoints are **public** and do not require authentication.

---

## 1. Get Services

```
GET /api/public/services
```

Returns all active salon services.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `category` | string | Filter by category (e.g., "Hair", "Spa") |
| `gender` | string | Filter by gender ("Male", "Female", "Unisex") |

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Men's Haircut",
      "description": "Classic haircut",
      "category": "Hair",
      "price": 800,
      "duration": 30,
      "gender": "Male"
    }
  ],
  "grouped": {
    "Hair": [...],
    "Spa": [...]
  },
  "total": 9
}
```

---

## 2. Get Stylists by Service

```
GET /api/public/stylists?service_id={id}&date={date}
```

Returns stylists who can perform a specific service.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `service_id` | uuid | ✅ | Service ID |
| `date` | date | ❌ | Filter by availability on date (YYYY-MM-DD) |
| `branch_id` | uuid | ❌ | Filter by branch |

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Sarah Johnson",
      "workingDays": ["Monday", "Tuesday", "Wednesday"],
      "workingHours": { "start": "09:00", "end": "18:00" },
      "skills": [
        { "id": "uuid", "name": "Haircut", "category": "Hair" }
      ]
    }
  ],
  "total": 3
}
```

---

## 3. Get Availability for a Stylist

```
GET /api/public/availability?stylist_id={id}&date={date}&duration={minutes}
```

Returns time slots for a specific stylist.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `stylist_id` | uuid | ✅ | Stylist ID |
| `date` | date | ✅ | Date (YYYY-MM-DD) |
| `duration` | number | ❌ | Service duration in minutes (default: 60) |

**Example Response:**
```json
{
  "success": true,
  "data": [
    { "time": "09:00", "available": true },
    { "time": "09:30", "available": false, "reason": "Already booked" },
    { "time": "10:00", "available": true }
  ],
  "stylist": { "id": "uuid", "name": "Sarah" },
  "availableCount": 12,
  "total": 18
}
```

---

## 4. Get All Available Stylists with Slots ⭐

```
GET /api/public/available-stylists?service_id={id}&date={date}
```

**All-in-one endpoint** - Returns all available stylists with their time slots.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `service_id` | uuid | ✅ | Service ID |
| `date` | date | ✅ | Date (YYYY-MM-DD) |
| `branch_id` | uuid | ❌ | Filter by branch |

**Example Response:**
```json
{
  "success": true,
  "service": { "id": "uuid", "name": "Haircut", "duration": 30, "price": 800 },
  "date": "2024-12-15",
  "dayOfWeek": "Sunday",
  "data": [
    {
      "stylist": { "id": "uuid", "name": "Sarah" },
      "skills": [{ "id": "uuid", "name": "Haircut" }],
      "slots": [
        { "time": "09:00", "available": true },
        { "time": "09:30", "available": false, "reason": "Already booked" }
      ],
      "availableCount": 12
    }
  ],
  "totalStylists": 3
}
```

---

## 5. Create Booking

```
POST /api/public/book
```

Creates a new appointment.

**Request Body:**
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
    "service_id": "uuid",
    "stylist_id": "uuid",
    "date": "2024-12-15",
    "time": "10:00",
    "notes": "First time customer"
  }
}
```

**Example Response:**
```json
{
  "success": true,
  "message": "Appointment booked successfully",
  "data": {
    "appointmentId": "uuid",
    "date": "2024-12-15",
    "time": "10:00",
    "status": "Pending",
    "service": { "name": "Haircut", "duration": 30, "price": 800 },
    "stylist": { "name": "Sarah" },
    "customer": { "name": "John Doe", "phone": "+94771234567" }
  }
}
```

**Error Responses:**
- `400` - Missing required fields or invalid data
- `404` - Service or stylist not found
- `409` - Time slot conflict (already booked)
- `500` - Server error

---

## Client-Side Implementation Example

```javascript
// Fetch services
const servicesRes = await fetch('/api/public/services');
const { data: services } = await servicesRes.json();

// Get available stylists with slots
const availRes = await fetch(
  `/api/public/available-stylists?service_id=${serviceId}&date=2024-12-15`
);
const { data: stylists } = await availRes.json();

// Book appointment
const bookRes = await fetch('/api/public/book', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    customer: { name: 'John', phone: '+94771234567', date_of_birth: '1990-05-12' },
    appointment: {
      service_id: serviceId,
      stylist_id: stylistId,
      date: '2024-12-15',
      time: '10:00'
    }
  })
});
```

---

## CORS Configuration

If your client website is on a different domain, add to `next.config.js`:

```javascript
async headers() {
  return [
    {
      source: '/api/public/:path*',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: '*' },
        { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
        { key: 'Access-Control-Allow-Headers', value: 'Content-Type' }
      ]
    }
  ];
}
```
