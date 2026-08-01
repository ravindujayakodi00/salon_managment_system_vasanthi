import { NextResponse } from 'next/server';

/**
 * Retired because it accepted caller-supplied phone numbers, message content, staff IDs,
 * and organization IDs. Booking notifications now use /api/appointments/notify, which
 * derives those values from tenant-bound appointment records.
 */
export async function POST() {
    return NextResponse.json(
        { success: false, error: 'This endpoint has been retired.' },
        { status: 410 }
    );
}
