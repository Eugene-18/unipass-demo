import { OAuth2Client } from 'google-auth-library';

type GoogleProfile = {
  email: string;
  name: string;
};

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function verifyGoogleTokenAndGetProfile(credentialJwt: string): Promise<GoogleProfile> {
  if (!credentialJwt) {
    const error = new Error('Missing credential');
    (error as Error & { status?: number }).status = 400;
    throw error;
  }

  const ticket = await client.verifyIdToken({
    idToken: credentialJwt,
    audience: process.env.GOOGLE_CLIENT_ID
  });

  const payload = ticket.getPayload();
  if (!payload?.email || !payload?.name) {
    const error = new Error('Invalid token payload');
    (error as Error & { status?: number }).status = 401;
    throw error;
  }

  return {
    email: payload.email,
    name: payload.name
  };
}
