import { z } from 'zod';

// Shared between the client-side preflight and the server `form` remote function
// so validation rules stay identical on both sides.
export const loginSchema = z.strictObject({
	phone: z.string().regex(/^\d{8,11}$/, 'Invalid phone number'),
	email: z.email('Invalid email address'),
	password: z.string().min(6, 'Password must be at least 6 characters')
});

export type LoginInput = z.infer<typeof loginSchema>;
