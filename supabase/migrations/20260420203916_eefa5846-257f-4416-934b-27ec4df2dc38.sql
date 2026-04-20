DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'transactions'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'transactions'
        AND column_name = 'card_id'
    ) THEN
      ALTER TABLE public.transactions
      ADD COLUMN card_id uuid NULL;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'cards'
    ) AND NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name = 'transactions'
        AND constraint_name = 'transactions_card_id_fkey'
    ) THEN
      ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_card_id_fkey
      FOREIGN KEY (card_id) REFERENCES public.cards(id) ON DELETE SET NULL;
    END IF;
  END IF;
END
$$;