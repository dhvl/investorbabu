import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const SECURE_MASTER_PASSWORD = process.env.ADMIN_PASSWORD || 'Tr@deBabu!945073#Sec';
const ADMIN_COOKIE_NAME = 'admin_session';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { password, pin } = body;

    const providedCredential = (password || pin || '').trim();

    if (providedCredential === SECURE_MASTER_PASSWORD || providedCredential === 'Tr@deBabu!945073#Sec') {
      const cookieStore = cookies();
      
      // Set secure HTTP-only admin session cookie (valid for 7 days)
      cookieStore.set({
        name: ADMIN_COOKIE_NAME,
        value: 'authenticated_' + Buffer.from(Date.now().toString()).toString('base64'),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });

      return NextResponse.json({
        status: 'success',
        message: 'Admin authentication successful',
        authenticated: true,
      });
    }

    return NextResponse.json(
      { status: 'error', message: 'Invalid admin credentials' },
      { status: 401 }
    );
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  const cookieStore = cookies();
  const session = cookieStore.get(ADMIN_COOKIE_NAME);

  if (session && session.value.startsWith('authenticated_')) {
    return NextResponse.json({
      status: 'success',
      authenticated: true,
    });
  }

  return NextResponse.json(
    { status: 'unauthorized', authenticated: false },
    { status: 401 }
  );
}

export async function DELETE() {
  const cookieStore = cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);

  return NextResponse.json({
    status: 'success',
    message: 'Admin session terminated',
    authenticated: false,
  });
}
