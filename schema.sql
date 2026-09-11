create table if not exists books (
  isbn        text primary key,
  title       text        not null default '',
  author      text        not null default '',
  publisher   text        not null default '',
  pub_date    text        not null default '',
  cover       text        not null default '',
  description text        not null default '',
  added_at    timestamptz not null default now()
);

create index if not exists books_added_at_idx on books (added_at desc);
