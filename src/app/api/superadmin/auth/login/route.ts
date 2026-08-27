import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const username = (body.username || '').trim();
    const password = (body.password || '').trim();

    // Default credentials in code
    const validUser = process.env.SUPERADMIN_USER || 'admin';
    const validPass = process.env.SUPERADMIN_PASS || 'admin';

    if (username === validUser && password === validPass) {
      const response = NextResponse.json({ success: true });
      response.cookies.set('superadmin_session', 'authenticated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24, // 24 hours
      });
      return response;
    }

    return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
  } catch {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}
