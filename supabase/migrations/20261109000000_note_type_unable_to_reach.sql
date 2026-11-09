-- Add "Unable to reach" note type (used on the Firm > Notes tab).
ALTER TYPE public.note_type ADD VALUE IF NOT EXISTS 'unable_to_reach';
