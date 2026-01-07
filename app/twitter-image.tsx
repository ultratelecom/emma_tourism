import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Ask THA - AI Legal Guide to the Tobago House of Assembly';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #8b0000 0%, #5c0000 100%)',
          fontFamily: 'Georgia, serif',
        }}
      >
        {/* Main content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px',
          }}
        >
          {/* Scale icon */}
          <div
            style={{
              fontSize: 100,
              color: '#d4af37',
            }}
          >
            ⚖
          </div>
          
          {/* Title */}
          <div
            style={{
              fontSize: 72,
              fontWeight: 'bold',
              color: '#ffffff',
              letterSpacing: '-2px',
            }}
          >
            Ask THA
          </div>
          
          {/* Subtitle */}
          <div
            style={{
              fontSize: 28,
              color: '#f5f4f1',
              textAlign: 'center',
              maxWidth: '800px',
              lineHeight: 1.4,
            }}
          >
            AI Legal Guide to the Tobago House of Assembly
          </div>
          
          {/* Tagline */}
          <div
            style={{
              fontSize: 22,
              color: '#d4af37',
              marginTop: '8px',
              fontStyle: 'italic',
            }}
          >
            Understand Tobago's governance in plain language
          </div>
        </div>
        
        {/* Footer */}
        <div
          style={{
            position: 'absolute',
            bottom: '32px',
            fontSize: 18,
            color: 'rgba(255,255,255,0.7)',
          }}
        >
          asktha.vercel.app
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}

