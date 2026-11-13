alter table public.modules
  add column description text,
  add constraint modules_description_length check (char_length(description) <= 320);
