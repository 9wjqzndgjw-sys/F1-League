-- Add AI-generated recap column to grand_prix table
-- Run this in Supabase SQL Editor or via Supabase CLI

alter table grand_prix
  add column if not exists recap text;
