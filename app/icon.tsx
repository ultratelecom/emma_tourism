import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const size = {
  width: 32,
  height: 32,
};
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 18,
          background: 'linear-gradient(135deg, #8b0000 0%, #5c0000 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#d4af37',
          fontWeight: 'bold',
          fontFamily: 'Georgia, serif',
          borderRadius: '6px',
        }}
      >
        ⚖
      </div>
    ),
    {
      ...size,
    }
  );
}

