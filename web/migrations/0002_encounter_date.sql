-- Companion dates are independent of birthday/zodiac. Legacy dates remain unchanged.
ALTER TABLE toys ADD COLUMN encounter_date TEXT;
UPDATE toys SET encounter_date = birth_date WHERE encounter_date IS NULL;
