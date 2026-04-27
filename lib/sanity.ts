import { createClient } from '@sanity/client'

export const client = createClient({
  projectId:  process.env.EXPO_PUBLIC_SANITY_PROJECT_ID!,
  dataset:    process.env.EXPO_PUBLIC_SANITY_DATASET!,
  apiVersion: process.env.EXPO_PUBLIC_SANITY_API_VERSION!,
  token:      process.env.EXPO_PUBLIC_SANITY_TOKEN!,
  useCdn:     false,
})
