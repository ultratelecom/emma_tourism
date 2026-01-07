import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Ask THA - AI Legal Guide to the Tobago House of Assembly';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function OGImage() {
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
          background: 'linear-gradient(135deg, #faf9f6 0%, #f5f4f1 100%)',
          fontFamily: 'Georgia, serif',
        }}
      >
        {/* Decorative top border */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '8px',
            background: 'linear-gradient(90deg, #8b0000, #c9a227, #8b0000)',
          }}
        />
        
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
              fontSize: 120,
              color: '#8b0000',
            }}
          >
            ⚖
          </div>
          
          {/* Title */}
          <div
            style={{
              fontSize: 72,
              fontWeight: 'bold',
              color: '#1a1a1a',
              letterSpacing: '-2px',
            }}
          >
            Ask THA
          </div>
          
          {/* Subtitle */}
          <div
            style={{
              fontSize: 32,
              color: '#6b7280',
              textAlign: 'center',
              maxWidth: '800px',
              lineHeight: 1.4,
            }}
          >
            Your AI Legal Guide to the
          </div>
          <div
            style={{
              fontSize: 36,
              color: '#8b0000',
              fontWeight: 'bold',
              textAlign: 'center',
            }}
          >
            Tobago House of Assembly Act
          </div>
          
          {/* Tagline */}
          <div
            style={{
              fontSize: 24,
              color: '#c9a227',
              marginTop: '16px',
              fontStyle: 'italic',
            }}
          >
            Clear answers about Tobago governance & the Constitution
          </div>
        </div>
        
        {/* Footer */}
        <div
          style={{
            position: 'absolute',
            bottom: '32px',
            fontSize: 18,
            color: '#9ca3af',
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

