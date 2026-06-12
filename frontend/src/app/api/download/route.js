/**
 * Next.js API route that proxies file downloads to the backend.
 * This avoids CORS issues since the browser talks to the same origin,
 * and the server-side fetch to the backend has no CORS restrictions.
 */

// Force Node.js runtime (not Edge) for reliable streaming
export const runtime = 'nodejs';
// Disable body parsing and response size limit for large files
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const format = searchParams.get('format') || 'csv';
  const method = searchParams.get('method') || 'GET';

  if (!url) {
    return new Response(JSON.stringify({ detail: 'Missing url parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
  let authHeader = request.headers.get('Authorization');
  
  // Also support token via query param for direct navigation downloads
  const token = searchParams.get('token');
  if (token && !authHeader) {
    authHeader = `Bearer ${token}`;
  }

  try {
    const backendResponse = await fetch(
      `${apiUrl}/${url}?format=${encodeURIComponent(format)}`,
      {
        method: method,
        headers: {
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
      }
    );

    if (!backendResponse.ok) {
      // Forward error response from backend
      const contentType = backendResponse.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const errorData = await backendResponse.json();
        return new Response(JSON.stringify(errorData), {
          status: backendResponse.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(backendResponse.statusText || 'Backend error', {
        status: backendResponse.status,
      });
    }

    // Read full response as buffer to avoid streaming issues
    const data = await backendResponse.arrayBuffer();

    // Forward relevant headers
    const headers = new Headers();
    const forwardHeaders = [
      'content-type',
      'content-disposition',
      'content-length',
    ];
    forwardHeaders.forEach((key) => {
      const value = backendResponse.headers.get(key);
      if (value) headers.set(key, value);
    });

    return new Response(data, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Download proxy error:', error);
    return new Response(
      JSON.stringify({ detail: 'Failed to connect to backend' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

