import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get('superadmin_session');
  return NextResponse.json({ authenticated: session?.value === 'authenticated' });
}
