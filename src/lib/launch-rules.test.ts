import { describe, expect, it } from 'vitest';
import { signupSchema, notificationSchema } from './launch-rules';
describe('launch account rules', () => {
 it('requires at least eight password characters', () => {
  expect(signupSchema.safeParse({email:'person@example.com',password:'1234567',agreed:true}).success).toBe(false);
  expect(signupSchema.safeParse({email:'person@example.com',password:'12345678',agreed:true}).success).toBe(true);
 });
 it('requires terms and privacy consent', () => {
  expect(signupSchema.safeParse({email:'person@example.com',password:'12345678',agreed:false}).success).toBe(false);
 });
 it('only accepts valid emails for outfit or fabric notifications', () => {
  expect(notificationSchema.safeParse({email:'invalid',section:'fabric'}).success).toBe(false);
  expect(notificationSchema.safeParse({email:'person@example.com',section:'other'}).success).toBe(false);
  expect(notificationSchema.parse({email:'PERSON@example.com',section:'outfits'}).email).toBe('person@example.com');
 });
});
